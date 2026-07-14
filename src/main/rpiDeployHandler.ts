import { ipcMain, app, dialog, WebContents } from 'electron';
import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import fs from 'fs';
import path from 'path';

export interface RpiConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

const REMOTE_PATH = '/tmp/sketchblocks_run.py';

// Trust-on-first-use SSH host keys: the first connection to a host records its key
// fingerprint; later connections must present the same key, or the user is warned
// (a reflashed Pi looks the same as an impersonating machine) and asked to decide.
const knownHostsFile = (): string => path.join(app.getPath('userData'), 'known_hosts.json');

function loadKnownHosts(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(knownHostsFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveKnownHosts(hosts: Record<string, string>): void {
  fs.writeFileSync(knownHostsFile(), JSON.stringify(hosts, null, 2), 'utf-8');
}

// Synchronous so ssh2's handshake (and its readyTimeout) pauses while the dialog is open.
function verifyHostKey(hostId: string, fingerprint: string): { ok: boolean; reason?: string } {
  const hosts = loadKnownHosts();
  const known = hosts[hostId];
  if (known === fingerprint) return { ok: true };
  if (known === undefined) {
    hosts[hostId] = fingerprint;
    saveKnownHosts(hosts);
    return { ok: true };
  }
  const response = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Cancel', 'Trust New Key'],
    defaultId: 0,
    cancelId: 0,
    title: 'SSH host key changed',
    message: `The SSH host key for ${hostId} has changed.`,
    detail:
      `Stored fingerprint (SHA-256):\n${known}\n\nReceived:\n${fingerprint}\n\n` +
      'This is normal if the Pi was reflashed, but it can also mean another machine is ' +
      'intercepting the connection. Only trust the new key if you expected this change.',
  });
  if (response !== 1) {
    return { ok: false, reason: `Connection cancelled: the host key for ${hostId} does not match the stored key.` };
  }
  hosts[hostId] = fingerprint;
  saveKnownHosts(hosts);
  return { ok: true };
}

// Shared connect config with the TOFU host-key verifier wired in.
function connectOptions(conn: RpiConnection, onHostKeyError: (reason: string | null) => void): ConnectConfig {
  const hostId = `${conn.host}:${conn.port || 22}`;
  return {
    host: conn.host,
    port: conn.port || 22,
    username: conn.username,
    password: conn.password,
    readyTimeout: 10000,
    hostHash: 'sha256',
    hostVerifier: (fingerprint: string): boolean => {
      const { ok, reason } = verifyHostKey(hostId, fingerprint);
      if (!ok) onHostKeyError(reason ?? null);
      return ok;
    },
  };
}

// A single live run at a time: upload the program over SFTP, then run it on a PTY so
// the Stop button (Ctrl-C → SIGINT → KeyboardInterrupt) unwinds into the program's
// `finally: GPIO.cleanup()`. Output streams to the renderer as it arrives.
let runClient: Client | null = null;
let runStream: ClientChannel | null = null;

function endRun(): void {
  if (runStream) { try { runStream.close(); } catch { /* ignore */ } runStream = null; }
  if (runClient) { try { runClient.end(); } catch { /* ignore */ } runClient = null; }
}

export function registerRpiHandler(): void {
  ipcMain.handle('rpi-run-start', (e, code: string, conn: RpiConnection): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      endRun();   // stop any previous run first
      const wc: WebContents = e.sender;
      const send = (channel: string, msg: string): void => { if (!wc.isDestroyed()) wc.send(channel, msg); };
      const client = new Client();
      runClient = client;
      wc.once('destroyed', endRun);

      let hostKeyError: string | null = null;
      let started = false;
      const startDone = (r: { success: boolean; error?: string }): void => {
        if (!started) { started = true; resolve(r); }
      };
      const fail = (msg: string): void => {
        send('rpi-run-closed', msg);
        endRun();
        startDone({ success: false, error: msg });
      };

      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) { fail(`SFTP failed: ${err.message}`); return; }
          const up = sftp.createWriteStream(REMOTE_PATH);
          up.on('error', (e2: Error) => fail(`Upload failed: ${e2.message}`));
          up.on('close', () => {
            // -u = unbuffered so output streams line-by-line to the console.
            client.exec(`python3 -u ${REMOTE_PATH}`, { pty: true }, (err2, stream) => {
              if (err2) { fail(`Exec failed: ${err2.message}`); return; }
              runStream = stream;
              startDone({ success: true });
              stream.on('data', (d: Buffer) => send('rpi-run-output', d.toString()));
              stream.stderr.on('data', (d: Buffer) => send('rpi-run-output', d.toString()));
              stream.on('close', (codeNum: number | null) => {
                send('rpi-run-closed', codeNum ? `\n[process exited with code ${codeNum}]` : '');
                endRun();
              });
            });
          });
          up.end(code);
        });
      });

      client.on('error', (err) => fail(hostKeyError || `Connection error: ${err.message}`));
      client.connect(connectOptions(conn, (r) => { hostKeyError = r; }));
    });
  });

  // Install a Python package on the Pi (for sensor libraries etc.). Output streams to
  // the same console channel as a run. The name is validated so it cannot inject shell.
  ipcMain.handle('rpi-pip-install', (e, pkg: string, conn: RpiConnection): Promise<{ success: boolean; output: string }> => {
    return new Promise((resolve) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pkg)) {
        resolve({ success: false, output: `Invalid package name "${pkg}".` });
        return;
      }
      const wc: WebContents = e.sender;
      const send = (m: string): void => { if (!wc.isDestroyed()) wc.send('rpi-run-output', m); };
      const client = new Client();
      let hostKeyError: string | null = null;
      let out = '';
      let settled = false;
      const done = (r: { success: boolean; output: string }): void => {
        if (settled) return;
        settled = true;
        try { client.end(); } catch { /* ignore */ }
        resolve(r);
      };
      client.on('ready', () => {
        client.exec(`pip3 install --user ${pkg}`, (err, stream) => {
          if (err) { done({ success: false, output: `Exec failed: ${err.message}` }); return; }
          const onData = (d: Buffer): void => { const t = d.toString(); out += t; send(t); };
          stream.on('data', onData);
          stream.stderr.on('data', onData);
          stream.on('close', (code: number | null) =>
            done({ success: code === 0, output: out.trim() || (code === 0 ? 'Installed.' : `pip exited with code ${code}.`) }));
        });
      });
      client.on('error', (err) => done({ success: false, output: hostKeyError || `Connection error: ${err.message}` }));
      client.connect(connectOptions(conn, (r) => { hostKeyError = r; }));
    });
  });

  ipcMain.handle('rpi-run-stop', (): void => {
    if (runStream) {
      const s = runStream;
      try { s.write('\x03'); } catch { /* ignore */ }   // Ctrl-C → clean shutdown + GPIO.cleanup()
      setTimeout(() => { if (runStream === s) endRun(); }, 1200);   // force-close if it ignores Ctrl-C
    } else {
      endRun();
    }
  });
}

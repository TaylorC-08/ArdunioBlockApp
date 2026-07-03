import { ipcMain, app, dialog } from 'electron';
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

export interface RpiConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface DeployResult {
  success: boolean;
  output: string;
}

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

export function registerRpiHandler(): void {
  ipcMain.handle('rpi-deploy', (_e, code: string, conn: RpiConnection): Promise<DeployResult> => {
    return new Promise((resolve) => {
      const client = new Client();
      let out = '';
      let settled = false;
      let hostKeyError: string | null = null;
      const done = (r: DeployResult): void => {
        if (settled) return;
        settled = true;
        try { client.end(); } catch { /* ignore */ }
        resolve(r);
      };

      client.on('ready', () => {
        // Run python3 reading the program from stdin.
        client.exec('python3 -', (err, stream) => {
          if (err) { done({ success: false, output: `Exec failed: ${err.message}` }); return; }
          stream.on('close', (codeNum: number) => {
            done({
              success: codeNum === 0,
              output: out.trim() || (codeNum === 0 ? 'Script finished.' : `Exited with code ${codeNum}.`),
            });
          });
          stream.on('data', (d: Buffer) => { out += d.toString(); });
          stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
          stream.end(code);
        });
      });

      client.on('error', (e) => done({ success: false, output: hostKeyError || `Connection error: ${e.message}` }));

      const hostId = `${conn.host}:${conn.port || 22}`;
      client.connect({
        host: conn.host,
        port: conn.port || 22,
        username: conn.username,
        password: conn.password,
        readyTimeout: 10000,
        hostHash: 'sha256',
        hostVerifier: (fingerprint: string): boolean => {
          const { ok, reason } = verifyHostKey(hostId, fingerprint);
          if (!ok) hostKeyError = reason ?? null;
          return ok;
        },
      });
    });
  });
}

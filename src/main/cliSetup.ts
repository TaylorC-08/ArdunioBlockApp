import { ipcMain, net } from 'electron';
import { execFile, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import extract from 'extract-zip';
import { resolveCli, managedCliDir, managedCliPath } from './arduinoCli';

// Guided first-run setup: downloads the official arduino-cli release into the app's
// data folder and installs the Arduino AVR board core. The version and SHA-256 are
// pinned to the official release checksums — never resolved from "latest" at runtime.
const CLI_VERSION = '1.5.1';
const CLI_URL = `https://github.com/arduino/arduino-cli/releases/download/v${CLI_VERSION}/arduino-cli_${CLI_VERSION}_Windows_64bit.zip`;
const CLI_SHA256 = 'fabe42e0eb04d00e776a66178299ff95a46c623dbc260f997e58fd514853dd40';

export interface SetupResult {
  success: boolean;
  output: string;
}

type Progress = (msg: string) => void;

function cliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(resolveCli(), ['version'], (error) => resolve(!error));
  });
}

async function downloadCli(progress: Progress): Promise<void> {
  progress(`Downloading arduino-cli ${CLI_VERSION} from the official Arduino release…`);
  const res = await net.fetch(CLI_URL);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let lastPct = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) {
      const pct = Math.floor((received / total) * 100);
      if (pct >= lastPct + 20) { lastPct = pct; progress(`Downloading… ${pct}%`); }
    }
  }
  const buf = Buffer.concat(chunks);

  progress('Verifying download…');
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  if (hash !== CLI_SHA256) {
    throw new Error('Checksum mismatch — the download is corrupted or has been tampered with. Nothing was installed.');
  }

  const dir = managedCliDir();
  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, 'arduino-cli.zip');
  fs.writeFileSync(zipPath, buf);
  progress('Extracting…');
  await extract(zipPath, { dir });
  fs.rmSync(zipPath, { force: true });
  if (!fs.existsSync(managedCliPath())) throw new Error('Extraction did not produce arduino-cli.exe.');
}

// Run arduino-cli, forwarding its output lines as progress; rejects on a non-zero exit.
function runCli(args: string[], progress: Progress): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveCli(), args, { windowsHide: true });
    let output = '';
    let lastLine = '';
    const onData = (d: Buffer): void => {
      const text = d.toString();
      output += text;
      for (const raw of text.split(/[\r\n]+/)) {
        const line = raw.trim();
        if (line && line !== lastLine) { lastLine = line; progress(line); }
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`arduino-cli ${args.join(' ')} failed (exit ${code}).\n${output.slice(-1500).trim()}`));
    });
  });
}

let setupRunning = false;

export function registerCliSetupHandler(): void {
  ipcMain.handle('cli-setup-run', async (e): Promise<SetupResult> => {
    if (setupRunning) return { success: false, output: 'Setup is already running.' };
    setupRunning = true;
    const progress: Progress = (msg) => {
      if (!e.sender.isDestroyed()) e.sender.send('cli-setup-progress', msg);
    };
    try {
      if (!(await cliAvailable())) {
        await downloadCli(progress);
      } else {
        progress('arduino-cli found — checking board support…');
      }
      progress('Updating the board index…');
      await runCli(['core', 'update-index'], progress);
      progress('Installing Arduino AVR board support…');
      await runCli(['core', 'install', 'arduino:avr'], progress);
      progress('Setup complete.');
      return { success: true, output: 'Arduino tools are ready. You can now verify and upload sketches.' };
    } catch (err) {
      return { success: false, output: (err as Error).message };
    } finally {
      setupRunning = false;
    }
  });
}

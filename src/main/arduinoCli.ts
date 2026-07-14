import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export const DEFAULT_FQBN = 'arduino:avr:uno';

// Directory where the app's own managed copy of arduino-cli lives (installed by
// the guided setup in cliSetup.ts).
export function managedCliDir(): string {
  return path.join(app.getPath('userData'), 'tools');
}

export function managedCliPath(): string {
  return path.join(managedCliDir(), 'arduino-cli.exe');
}

// Prefer the app-managed copy, then common system installs, then PATH.
export function resolveCli(): string {
  const candidates = [
    managedCliPath(),
    'C:\\Program Files\\Arduino CLI\\arduino-cli.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'arduino-cli.exe'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'arduino-cli'; // fall back to PATH
}

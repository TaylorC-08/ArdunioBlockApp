import fs from 'fs';
import path from 'path';

export const DEFAULT_FQBN = 'arduino:avr:uno';

// arduino-cli is installed by winget but may not be on the spawned process's PATH.
export function resolveCli(): string {
  const candidates = [
    'C:\\Program Files\\Arduino CLI\\arduino-cli.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'arduino-cli.exe'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'arduino-cli'; // fall back to PATH
}

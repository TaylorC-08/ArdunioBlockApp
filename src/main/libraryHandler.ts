import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { resolveCli } from './arduinoCli';

export interface LibraryResult {
  success: boolean;
  output: string;
}

export function registerLibraryHandler(): void {
  ipcMain.handle('search-library', (_e, query: string): Promise<string[]> => {
    // A leading '-' would be parsed by arduino-cli as a flag, not a name.
    if (typeof query !== 'string' || query.startsWith('-')) return Promise.resolve([]);
    const cli = resolveCli();
    return new Promise((resolve) => {
      execFile(cli, ['lib', 'search', query, '--format', 'json'], { maxBuffer: 20 * 1024 * 1024 }, (_error, stdout) => {
        try {
          const parsed = JSON.parse(stdout);
          const libs = (parsed.libraries || []) as Array<{ name?: string }>;
          const names = [...new Set(libs.map(l => l.name).filter((n): n is string => !!n))];
          resolve(names.slice(0, 25));
        } catch {
          resolve([]);
        }
      });
    });
  });

  ipcMain.handle('install-library', (_e, name: string): Promise<LibraryResult> => {
    if (typeof name !== 'string' || name.startsWith('-')) {
      return Promise.resolve({ success: false, output: `Invalid library name "${name}".` });
    }
    const cli = resolveCli();
    return new Promise((resolve) => {
      execFile(cli, ['lib', 'install', name], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        const notFound = (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
        if (notFound) {
          resolve({ success: false, output: 'arduino-cli not found. Install it and restart the app.' });
          return;
        }
        const output = [stdout, stderr].filter(Boolean).join('\n').trim();
        resolve({
          success: !error,
          output: output || (error ? `Could not install "${name}".` : `Installed "${name}".`),
        });
      });
    });
  });
}

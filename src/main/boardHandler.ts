import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveCli, DEFAULT_FQBN } from './arduinoCli';

const SKETCH_NAME = 'upload_sketch';

export interface BoardPort {
  address: string;            // e.g. COM3
  protocol: string;           // e.g. serial
  name: string | null;        // e.g. Arduino Uno (null if unidentified)
  fqbn: string | null;        // e.g. arduino:avr:uno (null if unidentified)
}

export interface UploadResult {
  success: boolean;
  output: string;
}

export function registerBoardHandlers(): void {
  ipcMain.handle('list-boards', (): Promise<BoardPort[]> => {
    const cli = resolveCli();
    return new Promise((resolve) => {
      execFile(cli, ['board', 'list', '--format', 'json'], { maxBuffer: 5 * 1024 * 1024 }, (_error, stdout) => {
        try {
          const parsed = JSON.parse(stdout);
          // v1.x: { "detected_ports": [...] }; older: a bare array.
          const ports = Array.isArray(parsed) ? parsed : (parsed.detected_ports || []);
          const result: BoardPort[] = ports.map((p: Record<string, unknown>) => {
            const port = (p.port || {}) as Record<string, unknown>;
            const match = ((p.matching_boards as unknown[]) || [])[0] as Record<string, unknown> | undefined;
            return {
              address: (port.address as string) || '',
              protocol: (port.protocol as string) || '',
              name: (match?.name as string) || null,
              fqbn: (match?.fqbn as string) || null,
            };
          }).filter((b: BoardPort) => b.address);
          resolve(result);
        } catch {
          resolve([]);
        }
      });
    });
  });

  ipcMain.handle('upload-sketch', (_e, code: string, port: string, fqbn?: string): Promise<UploadResult> => {
    const cli = resolveCli();
    const sketchDir = path.join(os.tmpdir(), 'arduino-block-app', SKETCH_NAME);
    fs.mkdirSync(sketchDir, { recursive: true });
    fs.writeFileSync(path.join(sketchDir, `${SKETCH_NAME}.ino`), code, 'utf-8');

    return new Promise((resolve) => {
      // compile --upload builds then flashes in one step.
      execFile(
        cli,
        ['compile', '--upload', '-p', port, '--fqbn', fqbn || DEFAULT_FQBN, sketchDir],
        { maxBuffer: 20 * 1024 * 1024 },
        (error, stdout, stderr) => {
          const notFound = (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
          if (notFound) {
            resolve({ success: false, output: 'arduino-cli not found. Install it and restart the app.' });
            return;
          }
          const output = [stdout, stderr].filter(Boolean).join('\n').trim();
          resolve({
            success: !error,
            output: output || (error ? 'Upload failed.' : 'Upload complete.'),
          });
        },
      );
    });
  });
}

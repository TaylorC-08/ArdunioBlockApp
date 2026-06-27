import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveCli, DEFAULT_FQBN } from './arduinoCli';

const SKETCH_NAME = 'verify_sketch';

export interface Diagnostic {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface VerifyResult {
  success: boolean;
  diagnostics: Diagnostic[];
  rawOutput: string;
}

function parseDiagnostics(compilerErr: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  // gcc lines referencing the sketch: ...verify_sketch.ino:LINE:COL: error|warning: message
  const re = new RegExp(`${SKETCH_NAME}\\.ino:(\\d+):(\\d+):\\s+(error|warning):\\s+(.*)`);
  for (const line of compilerErr.split(/\r?\n/)) {
    const m = re.exec(line);
    if (m) {
      diags.push({
        line: parseInt(m[1], 10),
        column: parseInt(m[2], 10),
        severity: m[3] as 'error' | 'warning',
        message: m[4].trim(),
      });
    }
  }
  return diags;
}

// Strip the long temp sketch path so messages read as "verify_sketch.ino:2:14: ...".
function cleanOutput(text: string, sketchDir: string): string {
  if (!text) return '';
  return text
    .split('\r\n').join('\n')
    .split(sketchDir + path.sep).join('')
    .split(sketchDir).join('')
    .trim();
}

export function registerVerifyHandler(): void {
  ipcMain.handle('verify-sketch', (_e, code: string, fqbn?: string): Promise<VerifyResult> => {
    const cli = resolveCli();
    const sketchDir = path.join(os.tmpdir(), 'arduino-block-app', SKETCH_NAME);
    fs.mkdirSync(sketchDir, { recursive: true });
    fs.writeFileSync(path.join(sketchDir, `${SKETCH_NAME}.ino`), code, 'utf-8');

    return new Promise((resolve) => {
      execFile(
        cli,
        ['compile', '--fqbn', fqbn || DEFAULT_FQBN, '--format', 'json', sketchDir],
        { maxBuffer: 20 * 1024 * 1024 },
        (error, stdout, stderr) => {
          let compilerErr = '';
          try {
            const json = JSON.parse(stdout);
            compilerErr = json.compiler_err || '';
          } catch {
            // stdout isn't JSON — the CLI itself failed to run.
            const notFound = (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
            resolve({
              success: false,
              diagnostics: [],
              rawOutput: notFound
                ? 'arduino-cli not found. Install it and restart the app.'
                : (stderr || error?.message || 'Verification failed to run.'),
            });
            return;
          }
          const success = !error; // exit code 0 → compiled
          resolve({
            success,
            diagnostics: parseDiagnostics(compilerErr),
            rawOutput:
              cleanOutput(compilerErr, sketchDir) ||
              (success ? 'Done compiling. No errors.' : 'Compilation failed.'),
          });
        },
      );
    });
  });
}

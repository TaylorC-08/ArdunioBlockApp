import { ipcMain } from 'electron';
import { Client } from 'ssh2';

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

export function registerRpiHandler(): void {
  ipcMain.handle('rpi-deploy', (_e, code: string, conn: RpiConnection): Promise<DeployResult> => {
    return new Promise((resolve) => {
      const client = new Client();
      let out = '';
      let settled = false;
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

      client.on('error', (e) => done({ success: false, output: `Connection error: ${e.message}` }));

      client.connect({
        host: conn.host,
        port: conn.port || 22,
        username: conn.username,
        password: conn.password,
        readyTimeout: 10000,
      });
    });
  });
}

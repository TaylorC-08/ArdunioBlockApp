import { ipcMain, WebContents } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { resolveCli } from './arduinoCli';

// A single live `arduino-cli monitor` process streaming a board's serial output to the
// renderer. Only one port can be monitored at a time (and the port must be free for upload).

let monitorProc: ChildProcessWithoutNullStreams | null = null;
let monitorOwner: WebContents | null = null;   // window being streamed to

function stopMonitor(): void {
  if (monitorProc) {
    monitorProc.removeAllListeners();
    monitorProc.kill();
    monitorProc = null;
  }
  if (monitorOwner) {
    monitorOwner.removeListener('destroyed', stopMonitor);
    monitorOwner = null;
  }
}

export function registerSerialMonitorHandler(): void {
  ipcMain.handle('serial-monitor-start', (e, port: string, baud: number): { success: boolean; error?: string } => {
    stopMonitor();
    const cli = resolveCli();
    const wc = e.sender;
    const send = (channel: string, text: string): void => {
      if (!wc.isDestroyed()) wc.send(channel, text);
    };
    try {
      const proc = spawn(cli, ['monitor', '-p', port, '-c', `baudrate=${baud}`, '--quiet'], { windowsHide: true });
      monitorProc = proc;
      monitorOwner = wc;
      wc.once('destroyed', stopMonitor);   // free the port if the window goes away
      proc.stdout.on('data', (d: Buffer) => send('serial-data', d.toString()));
      proc.stderr.on('data', (d: Buffer) => send('serial-data', d.toString()));
      proc.on('error', (err) => {
        send('serial-closed', `Could not start serial monitor: ${err.message}`);
        if (monitorProc === proc) monitorProc = null;
      });
      proc.on('close', (code) => {
        send('serial-closed', code === 0 || code === null ? '' : `Serial monitor exited (code ${code}).`);
        if (monitorProc === proc) monitorProc = null;
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('serial-monitor-send', (_e, text: string, lineEnding: string): void => {
    if (monitorProc) monitorProc.stdin.write(text + lineEnding);
  });

  ipcMain.handle('serial-monitor-stop', (): void => stopMonitor());
}

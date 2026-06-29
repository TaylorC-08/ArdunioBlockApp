import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('get-app-version'),
  onMenuCmd: (cb: (cmd: string) => void): void => {
    ipcRenderer.on('menu-cmd', (_event, cmd: string) => cb(cmd));
  },
  fileOpen: (): Promise<{ content: string; filePath: string } | null> =>
    ipcRenderer.invoke('file-open'),
  fileSave: (xml: string, code: string, filePath: string | null): Promise<string | null> =>
    ipcRenderer.invoke('file-save', { xml, code, filePath }),
  fileSaveAs: (xml: string, code: string): Promise<string | null> =>
    ipcRenderer.invoke('file-save-as', { xml, code }),
  dialogUnsaved: (): Promise<number> =>
    ipcRenderer.invoke('dialog-unsaved'),
  verifySketch: (code: string, fqbn?: string): Promise<VerifyResult> =>
    ipcRenderer.invoke('verify-sketch', code, fqbn),
  listBoards: (): Promise<BoardPort[]> =>
    ipcRenderer.invoke('list-boards'),
  uploadSketch: (code: string, port: string, fqbn?: string): Promise<UploadResult> =>
    ipcRenderer.invoke('upload-sketch', code, port, fqbn),
  rpiDeploy: (code: string, conn: RpiConnection): Promise<DeployResult> =>
    ipcRenderer.invoke('rpi-deploy', code, conn),
  searchLibrary: (query: string): Promise<string[]> =>
    ipcRenderer.invoke('search-library', query),
  installLibrary: (name: string): Promise<UploadResult> =>
    ipcRenderer.invoke('install-library', name),
  serialMonitorStart: (port: string, baud: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('serial-monitor-start', port, baud),
  serialMonitorSend: (text: string, lineEnding: string): Promise<void> =>
    ipcRenderer.invoke('serial-monitor-send', text, lineEnding),
  serialMonitorStop: (): Promise<void> =>
    ipcRenderer.invoke('serial-monitor-stop'),
  onSerialData: (cb: (text: string) => void): void => {
    ipcRenderer.on('serial-data', (_event, text: string) => cb(text));
  },
  onSerialClosed: (cb: (message: string) => void): void => {
    ipcRenderer.on('serial-closed', (_event, message: string) => cb(message));
  },
});

interface RpiConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface DeployResult {
  success: boolean;
  output: string;
}

interface Diagnostic {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
}

interface VerifyResult {
  success: boolean;
  diagnostics: Diagnostic[];
  rawOutput: string;
}

interface BoardPort {
  address: string;
  protocol: string;
  name: string | null;
  fqbn: string | null;
}

interface UploadResult {
  success: boolean;
  output: string;
}

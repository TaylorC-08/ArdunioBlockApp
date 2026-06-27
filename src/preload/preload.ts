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
  verifySketch: (code: string): Promise<VerifyResult> =>
    ipcRenderer.invoke('verify-sketch', code),
});

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

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  onMenuCmd: (cb: (cmd: string) => void) => void;
  fileOpen: () => Promise<{ content: string; filePath: string } | null>;
  fileSave: (xml: string, code: string, filePath: string | null) => Promise<string | null>;
  fileSaveAs: (xml: string, code: string) => Promise<string | null>;
  dialogUnsaved: () => Promise<number>;
}

declare interface Window {
  electronAPI: ElectronAPI;
}

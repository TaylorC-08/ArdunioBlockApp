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

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  onMenuCmd: (cb: (cmd: string) => void) => void;
  fileOpen: () => Promise<{ content: string; filePath: string } | null>;
  fileSave: (xml: string, code: string, filePath: string | null) => Promise<string | null>;
  fileSaveAs: (xml: string, code: string) => Promise<string | null>;
  dialogUnsaved: () => Promise<number>;
  verifySketch: (code: string) => Promise<VerifyResult>;
}

declare interface Window {
  electronAPI: ElectronAPI;
}

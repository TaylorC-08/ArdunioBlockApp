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

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  onMenuCmd: (cb: (cmd: string) => void) => void;
  fileOpen: () => Promise<{ content: string; filePath: string } | null>;
  fileSave: (xml: string, code: string, filePath: string | null) => Promise<string | null>;
  fileSaveAs: (xml: string, code: string) => Promise<string | null>;
  dialogUnsaved: () => Promise<number>;
  verifySketch: (code: string, fqbn?: string) => Promise<VerifyResult>;
  listBoards: () => Promise<BoardPort[]>;
  uploadSketch: (code: string, port: string, fqbn?: string) => Promise<UploadResult>;
  rpiDeploy: (code: string, conn: RpiConnection) => Promise<DeployResult>;
  searchLibrary: (query: string) => Promise<string[]>;
  installLibrary: (name: string) => Promise<UploadResult>;
  serialMonitorStart: (port: string, baud: number) => Promise<{ success: boolean; error?: string }>;
  serialMonitorSend: (text: string, lineEnding: string) => Promise<void>;
  serialMonitorStop: () => Promise<void>;
  onSerialData: (cb: (text: string) => void) => void;
  onSerialClosed: (cb: (message: string) => void) => void;
}

declare interface Window {
  electronAPI: ElectronAPI;
}

// .ino example sketches are imported as raw text via esbuild's text loader
declare module '*.ino' {
  const content: string;
  export default content;
}

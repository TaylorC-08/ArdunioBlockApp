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
  cliMissing?: boolean;
  coreMissing?: boolean;
}

interface SetupResult {
  success: boolean;
  output: string;
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
  cliMissing?: boolean;
  coreMissing?: boolean;
}

interface RpiConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  onMenuCmd: (cb: (cmd: string) => void) => void;
  fileOpen: () => Promise<{ content: string; filePath: string } | null>;
  fileSave: (xml: string, code: string, filePath: string | null, lang: 'python' | 'cpp') => Promise<string | null>;
  fileSaveAs: (xml: string, code: string, lang: 'python' | 'cpp') => Promise<string | null>;
  dialogUnsaved: () => Promise<number>;
  verifySketch: (code: string, fqbn?: string) => Promise<VerifyResult>;
  listBoards: () => Promise<BoardPort[]>;
  uploadSketch: (code: string, port: string, fqbn?: string) => Promise<UploadResult>;
  rpiRunStart: (code: string, conn: RpiConnection) => Promise<{ success: boolean; error?: string }>;
  rpiRunStop: () => Promise<void>;
  rpiPipInstall: (pkg: string, conn: RpiConnection) => Promise<{ success: boolean; output: string }>;
  onRpiOutput: (cb: (text: string) => void) => void;
  onRpiClosed: (cb: (message: string) => void) => void;
  searchLibrary: (query: string) => Promise<string[]>;
  installLibrary: (name: string) => Promise<UploadResult>;
  serialMonitorStart: (port: string, baud: number) => Promise<{ success: boolean; error?: string }>;
  serialMonitorSend: (text: string, lineEnding: string) => Promise<void>;
  serialMonitorStop: () => Promise<void>;
  onSerialData: (cb: (text: string) => void) => void;
  onSerialClosed: (cb: (message: string) => void) => void;
  cliSetupRun: () => Promise<SetupResult>;
  onCliSetupProgress: (cb: (line: string) => void) => void;
  notifyDirty: (dirty: boolean) => void;
  confirmClose: () => void;
}

declare interface Window {
  electronAPI: ElectronAPI;
}

// .ino example sketches are imported as raw text via esbuild's text loader
declare module '*.ino' {
  const content: string;
  export default content;
}

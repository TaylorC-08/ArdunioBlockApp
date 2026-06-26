interface ElectronAPI {
  getAppVersion: () => Promise<string>;
}

declare interface Window {
  electronAPI: ElectronAPI;
}

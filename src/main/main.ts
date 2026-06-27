import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { registerFileHandlers } from './fileHandlers';
import { registerVerifyHandler } from './verifyHandler';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Arduino Block App',
  });

  registerFileHandlers(win);

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New',        accelerator: 'CmdOrCtrl+N',       click: () => win.webContents.send('menu-cmd', 'file-new') },
        { label: 'Open...',    accelerator: 'CmdOrCtrl+O',       click: () => win.webContents.send('menu-cmd', 'file-open') },
        { type: 'separator' },
        { label: 'Save',       accelerator: 'CmdOrCtrl+S',       click: () => win.webContents.send('menu-cmd', 'file-save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu-cmd', 'file-save-as') },
      ],
    },
    {
      label: 'Sketch',
      submenu: [
        { label: 'Verify', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.send('menu-cmd', 'verify') },
      ],
    },
  ]));

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  registerVerifyHandler();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

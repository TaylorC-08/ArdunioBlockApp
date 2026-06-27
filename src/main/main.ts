import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { registerFileHandlers } from './fileHandlers';
import { registerVerifyHandler } from './verifyHandler';
import { registerBoardHandlers } from './boardHandler';
import { registerRpiHandler } from './rpiDeployHandler';
import { registerLibraryHandler } from './libraryHandler';

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
        { label: 'Upload', accelerator: 'CmdOrCtrl+U', click: () => win.webContents.send('menu-cmd', 'upload') },
        { type: 'separator' },
        { label: 'Install Library…', click: () => win.webContents.send('menu-cmd', 'install-library') },
        { label: 'Blocks from Code', click: () => win.webContents.send('menu-cmd', 'import-blocks') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Getting Started', accelerator: 'F1', click: () => win.webContents.send('menu-cmd', 'show-tutorial') },
        { type: 'separator' },
        {
          label: 'About',
          click: () => dialog.showMessageBox(win, {
            type: 'info',
            title: 'About Arduino Block App',
            message: 'Arduino Block App',
            detail: `Version ${app.getVersion()}\n\nVisual block-based Arduino programming with live C++ generation, compile/verify, and board upload.`,
          }),
        },
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
  registerBoardHandlers();
  registerRpiHandler();
  registerLibraryHandler();
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

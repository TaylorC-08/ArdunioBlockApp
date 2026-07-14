import { app, BrowserWindow, ipcMain, Menu, dialog, session } from 'electron';
import path from 'path';
import { registerFileHandlers } from './fileHandlers';
import { registerVerifyHandler } from './verifyHandler';
import { registerBoardHandlers } from './boardHandler';
import { registerRpiHandler } from './rpiDeployHandler';
import { registerLibraryHandler } from './libraryHandler';
import { registerSerialMonitorHandler } from './serialMonitorHandler';
import { registerCliSetupHandler } from './cliSetup';

let mainWin: BrowserWindow | null = null;
// Mirrors the renderer's unsaved-changes flag (kept current via 'dirty-changed').
let rendererDirty = false;

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
    title: 'SketchBlocks',
  });
  mainWin = win;
  win.on('closed', () => { if (mainWin === win) mainWin = null; });

  // The app is a single local page. Block window.open and all navigation (e.g. a
  // file dragged onto the window) so no other content can load with the preload API.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  // Closing with unsaved changes: hand off to the renderer, which runs the
  // Save / Don't Save / Cancel flow and calls close-confirmed to proceed.
  win.on('close', (e) => {
    if (!rendererDirty) return;
    e.preventDefault();
    win.webContents.send('menu-cmd', 'confirm-close');
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New',        accelerator: 'CmdOrCtrl+N',       click: () => win.webContents.send('menu-cmd', 'file-new') },
        { label: 'Open...',    accelerator: 'CmdOrCtrl+O',       click: () => win.webContents.send('menu-cmd', 'file-open') },
        { label: 'Examples…',  accelerator: 'CmdOrCtrl+E',       click: () => win.webContents.send('menu-cmd', 'show-examples') },
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
        { label: 'Serial Monitor', accelerator: 'CmdOrCtrl+M', click: () => win.webContents.send('menu-cmd', 'serial-monitor') },
        { type: 'separator' },
        { label: 'Install Library…', click: () => win.webContents.send('menu-cmd', 'install-library') },
        { label: 'Blocks from Code', click: () => win.webContents.send('menu-cmd', 'import-blocks') },
        { label: 'Set Up Arduino Tools…', click: () => win.webContents.send('menu-cmd', 'cli-setup') },
        { label: 'Install Python Package (Pi)…', click: () => win.webContents.send('menu-cmd', 'rpi-pip') },
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
            title: 'About SketchBlocks',
            message: 'SketchBlocks',
            detail: `Version ${app.getVersion()}\n\nVisual block-based programming for Arduino boards with live C++ generation, compile/verify, and board upload.`,
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

// Single instance: a second launch focuses the running window instead of
// competing with it for serial ports.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });

  app.whenReady().then(() => {
    // The app requests no web permissions (camera, USB, geolocation, …).
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

    registerFileHandlers();
    registerSerialMonitorHandler();
    registerVerifyHandler();
    registerBoardHandlers();
    registerRpiHandler();
    registerLibraryHandler();
    registerCliSetupHandler();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

ipcMain.on('dirty-changed', (_e, dirty: boolean) => { rendererDirty = !!dirty; });
ipcMain.on('close-confirmed', (e) => { BrowserWindow.fromWebContents(e.sender)?.destroy(); });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

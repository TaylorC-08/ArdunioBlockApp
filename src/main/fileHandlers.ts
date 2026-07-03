import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';

// Paths the user explicitly picked in an open/save dialog this session. 'file-save'
// only writes to these, so the renderer can't direct a write to an arbitrary path.
const userPickedPaths = new Set<string>();

export function registerFileHandlers(): void {
  // Dialogs are parented to whichever window asked, so registration happens once
  // at startup rather than per window.
  const owner = (event: Electron.IpcMainInvokeEvent): BrowserWindow =>
    BrowserWindow.fromWebContents(event.sender)!;

  ipcMain.handle('file-open', async (event) => {
    const result = await dialog.showOpenDialog(owner(event), {
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    userPickedPaths.add(filePath);
    return { content, filePath };
  });

  ipcMain.handle('file-save', async (event, data: { xml: string; code: string; filePath: string | null }) => {
    let savePath = data.filePath;
    if (!savePath || !userPickedPaths.has(savePath)) {
      const result = await dialog.showSaveDialog(owner(event), {
        filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }],
        defaultPath: 'sketch.ino',
      });
      if (result.canceled || !result.filePath) return null;
      savePath = result.filePath;
      userPickedPaths.add(savePath);
    }
    fs.writeFileSync(savePath, buildFileContent(data.xml, data.code), 'utf-8');
    return savePath;
  });

  ipcMain.handle('file-save-as', async (event, data: { xml: string; code: string }) => {
    const result = await dialog.showSaveDialog(owner(event), {
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }],
      defaultPath: 'sketch.ino',
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, buildFileContent(data.xml, data.code), 'utf-8');
    userPickedPaths.add(result.filePath);
    return result.filePath;
  });

  ipcMain.handle('dialog-unsaved', async (event) => {
    const { response } = await dialog.showMessageBox(owner(event), {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'You have unsaved changes.',
      detail: 'Do you want to save your changes before continuing?',
    });
    return response; // 0=Save, 1=Don't Save, 2=Cancel
  });
}

function buildFileContent(xml: string, code: string): string {
  // No blocks (external/blockless file) — write clean code with no marker block.
  if (!xml) return code;
  const commented = xml.split('\n').map(l => `// ${l}`).join('\n');
  return `// [BLOCKLY_WORKSPACE_XML_START]\n${commented}\n// [BLOCKLY_WORKSPACE_XML_END]\n\n${code}`;
}

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';

export function registerFileHandlers(win: BrowserWindow): void {
  ipcMain.handle('file-open', async () => {
    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, filePath };
  });

  ipcMain.handle('file-save', async (_event, data: { xml: string; code: string; filePath: string | null }) => {
    let savePath = data.filePath;
    if (!savePath) {
      const result = await dialog.showSaveDialog(win, {
        filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }],
        defaultPath: 'sketch.ino',
      });
      if (result.canceled || !result.filePath) return null;
      savePath = result.filePath;
    }
    fs.writeFileSync(savePath, buildFileContent(data.xml, data.code), 'utf-8');
    return savePath;
  });

  ipcMain.handle('file-save-as', async (_event, data: { xml: string; code: string }) => {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }],
      defaultPath: 'sketch.ino',
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, buildFileContent(data.xml, data.code), 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('dialog-unsaved', async () => {
    const { response } = await dialog.showMessageBox(win, {
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

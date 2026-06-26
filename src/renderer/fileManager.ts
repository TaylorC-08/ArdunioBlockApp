import * as Blockly from 'blockly';

const XML_START = '// [BLOCKLY_WORKSPACE_XML_START]';
const XML_END   = '// [BLOCKLY_WORKSPACE_XML_END]';

let _filePath: string | null = null;
let _dirty = false;

export function getCurrentFilePath(): string | null { return _filePath; }
export function isDirty(): boolean { return _dirty; }

export function setFilePath(p: string | null): void {
  _filePath = p;
  updateTitle();
}

export function markDirty(dirty: boolean): void {
  _dirty = dirty;
  updateTitle();
}

function updateTitle(): void {
  const name = _filePath ? _filePath.split(/[\\/]/).pop()! : 'Untitled';
  document.title = `Arduino Block App — ${name}${_dirty ? ' *' : ''}`;
}

export function serializeWorkspace(workspace: Blockly.WorkspaceSvg): string {
  const dom = Blockly.Xml.workspaceToDom(workspace);
  return Blockly.Xml.domToPrettyText(dom);
}

export function loadWorkspace(workspace: Blockly.WorkspaceSvg, xmlStr: string): void {
  const dom = Blockly.utils.xml.textToDom(xmlStr);
  Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
}

/**
 * Splits a .ino file into its embedded Blockly XML (if present) and its code.
 * App-made files have the XML in a comment block at the top followed by code.
 * External files have no markers — xml is null and the whole file is code.
 */
export function parseFileContent(content: string): { xml: string | null; code: string } {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const start = lines.findIndex(l => l.trim() === XML_START);
  const end   = lines.findIndex(l => l.trim() === XML_END);
  if (start === -1 || end === -1 || end <= start) {
    return { xml: null, code: normalized };
  }
  const xml  = lines.slice(start + 1, end).map(l => l.replace(/^\/\/ ?/, '')).join('\n');
  const code = lines.slice(end + 1).join('\n').replace(/^\n+/, '');
  return { xml, code };
}

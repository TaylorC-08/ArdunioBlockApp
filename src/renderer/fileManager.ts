import * as Blockly from 'blockly';

// The two editing environments each behave like their own document: they keep a
// separate file path and dirty flag, and the active tab decides which one the
// title bar, Save, and Open act on. This is what lets an Arduino sketch and a
// Raspberry Pi script be open at once without one clobbering the other's file.
export type Env = 'arduino' | 'rpi';

const START_TAG = '[BLOCKLY_WORKSPACE_XML_START]';
const END_TAG   = '[BLOCKLY_WORKSPACE_XML_END]';

interface DocState { path: string | null; dirty: boolean; }
const docs: Record<Env, DocState> = {
  arduino: { path: null, dirty: false },
  rpi:     { path: null, dirty: false },
};
let activeEnv: Env = 'arduino';

export function langForEnv(env: Env): 'python' | 'cpp' {
  return env === 'rpi' ? 'python' : 'cpp';
}

export function setActiveEnv(env: Env): void {
  activeEnv = env;
  updateTitle();
}

export function getCurrentFilePath(): string | null { return docs[activeEnv].path; }
export function isDirty(env: Env = activeEnv): boolean { return docs[env].dirty; }
export function anyDirty(): boolean { return docs.arduino.dirty || docs.rpi.dirty; }

export function setFilePath(p: string | null, env: Env = activeEnv): void {
  docs[env].path = p;
  updateTitle();
}

export function markDirty(dirty: boolean, env: Env = activeEnv): void {
  docs[env].dirty = dirty;
  window.electronAPI.notifyDirty(anyDirty());   // main's close guard tracks either document
  updateTitle();
}

function updateTitle(): void {
  const path = docs[activeEnv].path;
  const name = path ? path.split(/[\\/]/).pop()! : 'Untitled';
  document.title = `SketchBlocks — ${name}${docs[activeEnv].dirty ? ' *' : ''}`;
}

export function serializeWorkspace(workspace: Blockly.WorkspaceSvg): string {
  const dom = Blockly.Xml.workspaceToDom(workspace);
  return Blockly.Xml.domToPrettyText(dom);
}

export function loadWorkspace(workspace: Blockly.WorkspaceSvg, xmlStr: string): void {
  const dom = Blockly.utils.xml.textToDom(xmlStr);
  Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
}

// Strip a leading line-comment marker (`// ` or `# `) so the same parser handles
// both Arduino (.ino) and Python (.py) files.
const stripComment = (line: string): string => line.replace(/^\s*(?:\/\/|#) ?/, '');

/**
 * Splits a saved file into its embedded Blockly XML (if present) and its code.
 * App-made files have the XML in a comment block at the top followed by code;
 * the comment style (`//` or `#`) depends on the language. External files have
 * no markers — xml is null and the whole file is code.
 */
export function parseFileContent(content: string): { xml: string | null; code: string } {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const start = lines.findIndex(l => stripComment(l).trim() === START_TAG);
  const end   = lines.findIndex(l => stripComment(l).trim() === END_TAG);
  if (start === -1 || end === -1 || end <= start) {
    return { xml: null, code: normalized };
  }
  const xml  = lines.slice(start + 1, end).map(stripComment).join('\n');
  const code = lines.slice(end + 1).join('\n').replace(/^\n+/, '');
  return { xml, code };
}

import * as Blockly from 'blockly';
import { arduinoGenerator } from './arduino/index';
import {
  getCurrentFilePath, isDirty, setFilePath, markDirty,
  serializeWorkspace, loadWorkspace, parseFileContent,
} from './fileManager';
import { initMonaco, getContent, setContent, onUserEdit, layout } from './monacoEditor';

const toolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    // ---- Program structure ----
    {
      kind: 'category',
      name: 'Structure',
      colour: '#C49A3F',
      contents: [
        { kind: 'block', type: 'arduino_setup' },
        { kind: 'block', type: 'arduino_loop' },
      ],
    },
    // ---- Arduino-specific ----
    {
      kind: 'category',
      name: 'Arduino I/O',
      colour: '#CC6600',
      contents: [
        { kind: 'block', type: 'arduino_pin_mode' },
        { kind: 'block', type: 'arduino_digital_write' },
        { kind: 'block', type: 'arduino_digital_read' },
        { kind: 'block', type: 'arduino_analog_write' },
        { kind: 'block', type: 'arduino_analog_read' },
        { kind: 'block', type: 'arduino_map' },
      ],
    },
    {
      kind: 'category',
      name: 'Time',
      colour: '#5F4B8B',
      contents: [
        { kind: 'block', type: 'arduino_delay' },
        { kind: 'block', type: 'arduino_delay_microseconds' },
        { kind: 'block', type: 'arduino_millis' },
      ],
    },
    {
      kind: 'category',
      name: 'Serial',
      colour: '#9E5C1A',
      contents: [
        { kind: 'block', type: 'arduino_serial_begin' },
        { kind: 'block', type: 'arduino_serial_print' },
        { kind: 'block', type: 'arduino_serial_println' },
      ],
    },
    { kind: 'sep' },
    // ---- Standard blocks ----
    {
      kind: 'category',
      name: 'Logic',
      colour: '#5C81A6',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      colour: '#5CA65C',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '#5C68A6',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_constrain' },
        { kind: 'block', type: 'math_random_int' },
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      colour: '#5CA68D',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_join' },
      ],
    },
    { kind: 'category', name: 'Variables', colour: '#A65C81', custom: 'VARIABLE' },
    { kind: 'category', name: 'Functions',  colour: '#9A5CA6', custom: 'PROCEDURE' },
  ],
};

window.addEventListener('load', () => {
  const blocklyDiv     = document.getElementById('blockly-div')      as HTMLElement;
  const monacoContainer = document.getElementById('monaco-container') as HTMLElement;
  const btnSync        = document.getElementById('btn-sync')         as HTMLButtonElement;
  const btnClear       = document.getElementById('btn-clear')        as HTMLButtonElement;

  initMonaco(monacoContainer);

  const workspace = Blockly.inject(blocklyDiv, {
    toolbox,
    media: 'media/',
    grid:  { spacing: 20, length: 3, colour: '#3a3a3a', snap: true },
    zoom:  { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
    trashcan: true,
  });

  Blockly.svgResize(workspace);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isLoadingFromFile = false;
  // Once the user types in the editor, blocks stop auto-overwriting it.
  let manualEdit = false;

  function generateCode(): string {
    const code = arduinoGenerator.workspaceToCode(workspace);
    if (!manualEdit) setContent(code || '// No blocks in workspace');
    return code;
  }

  function debouncedGenerateCode(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(generateCode, 150);
  }

  workspace.addChangeListener((e) => {
    debouncedGenerateCode();
    if (!isLoadingFromFile && !e.isUiEvent) markDirty(true);
  });

  onUserEdit(() => {
    manualEdit = true;
    markDirty(true);
  });

  function syncFromBlocks(): void {
    const code = arduinoGenerator.workspaceToCode(workspace) || '// No blocks in workspace';
    if (manualEdit && getContent() !== code &&
        !confirm('Overwrite manual edits with code generated from the blocks?')) {
      return;
    }
    setContent(code);
    manualEdit = false;
    markDirty(true);
  }

  btnSync.addEventListener('click', syncFromBlocks);
  btnClear.addEventListener('click', () => {
    workspace.clear();
    manualEdit = false;
    generateCode();
    markDirty(true);
  });

  window.addEventListener('resize', () => { Blockly.svgResize(workspace); layout(); });

  // ---- File operations ----

  async function checkUnsaved(): Promise<boolean> {
    if (!isDirty()) return true;
    const response = await window.electronAPI.dialogUnsaved();
    if (response === 2) return false;           // Cancel
    if (response === 0) return await doSave();  // Save then proceed
    return true;                                // Don't Save
  }

  // XML embedded only when blocks exist; external/blockless files save as plain code.
  async function save(saveAs: boolean): Promise<boolean> {
    const hasBlocks = workspace.getTopBlocks(false).length > 0;
    const xml  = hasBlocks ? serializeWorkspace(workspace) : '';
    const code = getContent();
    const savedPath = saveAs
      ? await window.electronAPI.fileSaveAs(xml, code)
      : await window.electronAPI.fileSave(xml, code, getCurrentFilePath());
    if (!savedPath) return false;
    setFilePath(savedPath);
    markDirty(false);
    return true;
  }

  const doSave   = () => save(false);
  const doSaveAs = () => save(true);

  async function fileNew(): Promise<void> {
    if (!await checkUnsaved()) return;
    isLoadingFromFile = true;
    workspace.clear();
    isLoadingFromFile = false;
    manualEdit = false;
    setFilePath(null);
    markDirty(false);
    generateCode();
  }

  async function fileOpen(): Promise<void> {
    if (!await checkUnsaved()) return;
    const result = await window.electronAPI.fileOpen();
    if (!result) return;
    const { xml, code } = parseFileContent(result.content);

    if (xml === null) {
      // External file — no blocks to restore; show its code for editing.
      isLoadingFromFile = true;
      workspace.clear();
      isLoadingFromFile = false;
      manualEdit = true;
      setContent(code);
      setFilePath(result.filePath);
      markDirty(false);
      return;
    }

    try {
      isLoadingFromFile = true;
      loadWorkspace(workspace, xml);
    } catch (err) {
      alert(`Failed to load workspace: ${err}`);
      return;
    } finally {
      isLoadingFromFile = false;
    }
    manualEdit = false;
    setFilePath(result.filePath);
    markDirty(false);
    generateCode();
  }

  window.electronAPI.onMenuCmd(async (cmd) => {
    if      (cmd === 'file-new')     await fileNew();
    else if (cmd === 'file-open')    await fileOpen();
    else if (cmd === 'file-save')    await doSave();
    else if (cmd === 'file-save-as') await doSaveAs();
  });
});

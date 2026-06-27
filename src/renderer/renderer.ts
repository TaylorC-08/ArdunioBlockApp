import * as Blockly from 'blockly';
import { arduinoGenerator } from './arduino/index';
import {
  getCurrentFilePath, isDirty, setFilePath, markDirty,
  serializeWorkspace, loadWorkspace, parseFileContent,
} from './fileManager';
import { initMonaco, getContent, setContent, onUserEdit, layout, setMarkers, clearMarkers, setLanguage } from './monacoEditor';
import { parseCodeToWorkspace } from './importer';
import { rpiToolbox, pythonGenerator } from './rpi/index';

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
        { kind: 'block', type: 'arduino_include' },
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
  const splitter       = document.getElementById('splitter')        as HTMLElement;
  const outputPanel    = document.getElementById('output-panel')    as HTMLElement;
  const wsContainer    = document.getElementById('workspace-container') as HTMLElement;
  const btnVerify      = document.getElementById('btn-verify')      as HTMLButtonElement;
  const btnUpload      = document.getElementById('btn-upload')      as HTMLButtonElement;
  const boardSelect    = document.getElementById('board-select')    as HTMLSelectElement;
  const btnRefreshBoards = document.getElementById('btn-refresh-boards') as HTMLButtonElement;
  const consoleEl      = document.getElementById('console')         as HTMLElement;
  const consoleStatus  = document.getElementById('console-status')  as HTMLElement;
  const consoleOutput  = document.getElementById('console-output')  as HTMLElement;
  const btnConsoleClose = document.getElementById('btn-console-close') as HTMLButtonElement;
  const helpOverlay    = document.getElementById('help-overlay')    as HTMLElement;
  const btnHelpClose   = document.getElementById('btn-help-close')  as HTMLButtonElement;
  const blocklyDivRpi  = document.getElementById('blockly-div-rpi') as HTMLElement;
  const arduinoActions = document.getElementById('arduino-actions') as HTMLElement;
  const rpiActions     = document.getElementById('rpi-actions')     as HTMLElement;
  const btnRpiSettings = document.getElementById('btn-rpi-settings') as HTMLButtonElement;
  const btnRpiRun      = document.getElementById('btn-rpi-run')     as HTMLButtonElement;
  const rpiOverlay     = document.getElementById('rpi-overlay')     as HTMLElement;
  const btnRpiClose    = document.getElementById('btn-rpi-close')   as HTMLButtonElement;
  const btnRpiSave     = document.getElementById('btn-rpi-save')    as HTMLButtonElement;
  const rpiHost        = document.getElementById('rpi-host')        as HTMLInputElement;
  const rpiPort        = document.getElementById('rpi-port')        as HTMLInputElement;
  const rpiUser        = document.getElementById('rpi-user')        as HTMLInputElement;
  const rpiPass        = document.getElementById('rpi-pass')        as HTMLInputElement;
  const libOverlay     = document.getElementById('lib-overlay')     as HTMLElement;
  const btnLibClose    = document.getElementById('btn-lib-close')   as HTMLButtonElement;
  const btnLibInstall  = document.getElementById('btn-lib-install') as HTMLButtonElement;
  const btnLibSearch   = document.getElementById('btn-lib-search')  as HTMLButtonElement;
  const libName        = document.getElementById('lib-name')        as HTMLInputElement;
  const libResults     = document.getElementById('lib-results')     as HTMLElement;

  initMonaco(monacoContainer);

  const blocklyConfig = {
    media: 'media/',
    grid:  { spacing: 20, length: 3, colour: '#3a3a3a', snap: true },
    zoom:  { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
    trashcan: true,
  };

  const workspace    = Blockly.inject(blocklyDiv, { toolbox, ...blocklyConfig });
  const rpiWorkspace = Blockly.inject(blocklyDivRpi, { toolbox: rpiToolbox, ...blocklyConfig });

  Blockly.svgResize(workspace);

  // 'arduino' | 'rpi' — which environment is active.
  let activeTab = 'arduino';
  const activeWorkspace = () => (activeTab === 'rpi' ? rpiWorkspace : workspace);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isLoadingFromFile = false;
  // Once the user types in the editor, blocks stop auto-overwriting it.
  let manualEdit = false;

  function generateCode(): string {
    const code = activeTab === 'rpi'
      ? pythonGenerator.workspaceToCode(rpiWorkspace)
      : arduinoGenerator.workspaceToCode(workspace);
    if (!manualEdit) {
      const empty = activeTab === 'rpi' ? '# No blocks in workspace' : '// No blocks in workspace';
      setContent(code || empty);
    }
    return code;
  }

  function debouncedGenerateCode(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(generateCode, 150);
  }

  function makeChangeListener(tab: string) {
    return (e: Blockly.Events.Abstract): void => {
      if (activeTab === tab) debouncedGenerateCode();
      if (!isLoadingFromFile && !e.isUiEvent) markDirty(true);
    };
  }
  workspace.addChangeListener(makeChangeListener('arduino'));
  rpiWorkspace.addChangeListener(makeChangeListener('rpi'));

  function setActiveTab(tab: string): void {
    if (tab === activeTab) return;
    activeTab = tab;
    const rpi = tab === 'rpi';
    blocklyDiv.classList.toggle('hidden', rpi);
    blocklyDivRpi.classList.toggle('hidden', !rpi);
    arduinoActions.classList.toggle('hidden', rpi);
    rpiActions.classList.toggle('hidden', !rpi);
    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', (t as HTMLElement).dataset.tab === tab));
    setLanguage(rpi ? 'python' : 'cpp');
    manualEdit = false; // editor follows the active tab's generated code
    Blockly.svgResize(activeWorkspace());
    generateCode();
    layout();
  }
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => setActiveTab((t as HTMLElement).dataset.tab!)));

  onUserEdit(() => {
    manualEdit = true;
    markDirty(true);
  });

  function syncFromBlocks(): void {
    const empty = activeTab === 'rpi' ? '# No blocks in workspace' : '// No blocks in workspace';
    const code = (activeTab === 'rpi'
      ? pythonGenerator.workspaceToCode(rpiWorkspace)
      : arduinoGenerator.workspaceToCode(workspace)) || empty;
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
    activeWorkspace().clear();
    manualEdit = false;
    generateCode();
    markDirty(true);
  });

  window.addEventListener('resize', () => { Blockly.svgResize(activeWorkspace()); layout(); });

  // ---- Draggable splitter between workspace and code panel ----
  let dragging = false;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    // Let mousemove reach window even over Blockly/Monaco.
    blocklyDiv.style.pointerEvents = 'none';
    outputPanel.style.pointerEvents = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = wsContainer.getBoundingClientRect();
    const width = Math.max(200, Math.min(rect.right - e.clientX, rect.width - 200));
    outputPanel.style.width = `${width}px`;
    Blockly.svgResize(workspace);
    layout();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    blocklyDiv.style.pointerEvents = '';
    outputPanel.style.pointerEvents = '';
  });

  // ---- Verify (compile via arduino-cli) ----
  function showConsole(status: string, statusClass: string, output: string): void {
    consoleStatus.textContent = status;
    consoleStatus.className = statusClass;
    consoleOutput.textContent = output;
    consoleEl.classList.add('visible');
    Blockly.svgResize(workspace);
    layout();
  }

  function hideConsole(): void {
    consoleEl.classList.remove('visible');
    Blockly.svgResize(workspace);
    layout();
  }

  // ---- Board selection ----
  let boards: BoardPort[] = [];

  function selectedBoard(): BoardPort | null {
    const i = boardSelect.selectedIndex;
    return i >= 0 && i < boards.length ? boards[i] : null;
  }

  // Selected board's FQBN, or undefined to let the handler use its default.
  function selectedFqbn(): string | undefined {
    return selectedBoard()?.fqbn || undefined;
  }

  async function refreshBoards(): Promise<void> {
    boards = await window.electronAPI.listBoards();
    boardSelect.innerHTML = '';
    if (boards.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'No boards detected';
      boardSelect.appendChild(opt);
      boardSelect.disabled = true;
      return;
    }
    boardSelect.disabled = false;
    for (const b of boards) {
      const opt = document.createElement('option');
      const label = b.name ? `${b.name} (${b.address})` : `Unknown board (${b.address})`;
      opt.textContent = label;
      boardSelect.appendChild(opt);
    }
  }

  btnRefreshBoards.addEventListener('click', refreshBoards);
  void refreshBoards();

  // ---- Verify (compile via arduino-cli) ----
  let busy = false;

  async function verify(): Promise<void> {
    if (busy) return;
    if (activeTab !== 'arduino') { showConsole('Arduino only', 'error', 'Verify compiles Arduino sketches. Switch to the Arduino tab.'); return; }
    busy = true;
    btnVerify.disabled = true;
    btnUpload.disabled = true;
    clearMarkers();
    const fqbn = selectedFqbn();
    showConsole('Compiling…', 'busy', `Compiling sketch with arduino-cli (${fqbn || 'arduino:avr:uno'})…`);
    let missingLib: string | null = null;
    try {
      const result = await window.electronAPI.verifySketch(getContent(), fqbn);
      setMarkers(result.diagnostics);
      if (result.success) {
        const warnings = result.diagnostics.filter(d => d.severity === 'warning').length;
        showConsole(warnings ? `Done — ${warnings} warning(s)` : 'Done compiling. No errors.', 'ok', result.rawOutput);
      } else {
        const errors = result.diagnostics.filter(d => d.severity === 'error').length;
        showConsole(errors ? `Failed — ${errors} error(s)` : 'Compilation failed', 'error', result.rawOutput);
        const m = result.rawOutput.match(/([A-Za-z0-9_]+)\.h: No such file or directory/);
        if (m) missingLib = m[1];
      }
    } finally {
      busy = false;
      btnVerify.disabled = false;
      btnUpload.disabled = false;
    }
    // Missing library? Open the search overlay pre-filled so the user can pick the
    // right library (header name often differs from library name), then re-verify.
    if (missingLib) showLibOverlay(missingLib, true);
  }

  async function upload(): Promise<void> {
    if (busy) return;
    if (activeTab !== 'arduino') { showConsole('Arduino only', 'error', 'Upload targets Arduino boards. Switch to the Arduino tab.'); return; }
    const board = selectedBoard();
    if (!board) {
      showConsole('No board', 'error', 'No board selected. Connect a board and click ⟳ to rescan.');
      return;
    }
    busy = true;
    btnVerify.disabled = true;
    btnUpload.disabled = true;
    clearMarkers();
    const fqbn = selectedFqbn();
    showConsole('Uploading…', 'busy', `Compiling and uploading to ${board.address} (${fqbn || 'arduino:avr:uno'})…`);
    try {
      const result = await window.electronAPI.uploadSketch(getContent(), board.address, fqbn);
      showConsole(result.success ? 'Upload complete' : 'Upload failed', result.success ? 'ok' : 'error', result.output);
    } finally {
      busy = false;
      btnVerify.disabled = false;
      btnUpload.disabled = false;
    }
  }

  btnVerify.addEventListener('click', verify);
  btnUpload.addEventListener('click', upload);
  btnConsoleClose.addEventListener('click', hideConsole);

  // ---- Getting Started overlay ----
  function showHelp(): void { helpOverlay.classList.add('visible'); }
  function hideHelp(): void { helpOverlay.classList.remove('visible'); }

  btnHelpClose.addEventListener('click', hideHelp);
  helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) hideHelp(); });

  // ---- Raspberry Pi: connection settings + run over SSH ----
  let rpiConn: RpiConnection = { host: '', port: 22, username: '', password: '' };

  function showRpiSettings(): void {
    rpiHost.value = rpiConn.host;
    rpiPort.value = String(rpiConn.port);
    rpiUser.value = rpiConn.username;
    rpiPass.value = rpiConn.password;
    rpiOverlay.classList.add('visible');
  }
  function hideRpiSettings(): void { rpiOverlay.classList.remove('visible'); }

  btnRpiSettings.addEventListener('click', showRpiSettings);
  btnRpiClose.addEventListener('click', hideRpiSettings);
  rpiOverlay.addEventListener('click', (e) => { if (e.target === rpiOverlay) hideRpiSettings(); });
  btnRpiSave.addEventListener('click', () => {
    rpiConn = {
      host: rpiHost.value.trim(),
      port: parseInt(rpiPort.value, 10) || 22,
      username: rpiUser.value.trim(),
      password: rpiPass.value,
    };
    hideRpiSettings();
  });

  async function runOnPi(): Promise<void> {
    if (busy) return;
    if (!rpiConn.host || !rpiConn.username) { showRpiSettings(); return; }
    busy = true;
    btnRpiRun.disabled = true;
    showConsole('Running…', 'busy', `Connecting to ${rpiConn.username}@${rpiConn.host}…`);
    try {
      const result = await window.electronAPI.rpiDeploy(getContent(), rpiConn);
      showConsole(result.success ? 'Run complete' : 'Run failed', result.success ? 'ok' : 'error', result.output);
    } finally {
      busy = false;
      btnRpiRun.disabled = false;
    }
  }
  btnRpiRun.addEventListener('click', runOnPi);

  // ---- Library search & install (arduino-cli lib search / install) ----
  // When the overlay is opened from a failed Verify, install should re-verify.
  let reverifyAfterInstall = false;

  async function doInstallLibrary(name: string): Promise<boolean> {
    showConsole('Installing…', 'busy', `Installing library "${name}"…`);
    const result = await window.electronAPI.installLibrary(name);
    showConsole(result.success ? 'Library installed' : 'Install failed', result.success ? 'ok' : 'error', result.output);
    return result.success;
  }

  async function installFromOverlay(name: string): Promise<void> {
    hideLibOverlay();
    const ok = await doInstallLibrary(name);
    if (ok && reverifyAfterInstall) { reverifyAfterInstall = false; await verify(); }
  }

  async function runLibSearch(): Promise<void> {
    const query = libName.value.trim();
    if (!query) return;
    libResults.innerHTML = '<div class="lib-empty">Searching…</div>';
    const names = await window.electronAPI.searchLibrary(query);
    libResults.innerHTML = '';
    if (names.length === 0) {
      libResults.innerHTML = '<div class="lib-empty">No matches. Try a different term or install by exact name.</div>';
      return;
    }
    for (const name of names) {
      const b = document.createElement('button');
      b.textContent = name;
      b.addEventListener('click', () => installFromOverlay(name));
      libResults.appendChild(b);
    }
  }

  function showLibOverlay(prefill = '', reverify = false): void {
    reverifyAfterInstall = reverify;
    libName.value = prefill;
    libResults.innerHTML = '';
    libOverlay.classList.add('visible');
    libName.focus();
    if (prefill) void runLibSearch();
  }
  function hideLibOverlay(): void { libOverlay.classList.remove('visible'); }

  btnLibClose.addEventListener('click', hideLibOverlay);
  libOverlay.addEventListener('click', (e) => { if (e.target === libOverlay) hideLibOverlay(); });
  btnLibSearch.addEventListener('click', runLibSearch);
  btnLibInstall.addEventListener('click', () => {
    const name = libName.value.trim();
    if (name) void installFromOverlay(name);
  });
  libName.addEventListener('keydown', (e) => { if (e.key === 'Enter') void runLibSearch(); });

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideHelp(); hideRpiSettings(); hideLibOverlay(); } });

  // ---- Import: generate blocks from the editor's code (constrained subset) ----
  function importBlocks(): void {
    isLoadingFromFile = true;
    const result = parseCodeToWorkspace(workspace, getContent());
    isLoadingFromFile = false;
    manualEdit = true; // keep the editor's code as-is; blocks are an aid
    if (result.imported === 0) {
      showConsole('Nothing converted', 'error',
        'Could not generate blocks from this code:\n\n' + result.skipped.join('\n'));
    } else {
      let msg = `Generated ${result.imported} block statement(s) from the code.`;
      if (result.skipped.length) {
        msg += `\n\n${result.skipped.length} line(s) could not be converted (left as code only):\n` +
          result.skipped.map(s => '  • ' + s).join('\n');
      }
      showConsole('Blocks generated', 'ok', msg);
    }
  }

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
      // Offer to reconstruct blocks from the recognized subset of the code.
      if (confirm('This file has no saved blocks. Try to generate blocks from the code?\n\nUnsupported lines stay as code only.')) {
        importBlocks();
        markDirty(false);
      }
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
    else if (cmd === 'verify')       await verify();
    else if (cmd === 'upload')       await upload();
    else if (cmd === 'show-tutorial') showHelp();
    else if (cmd === 'import-blocks') importBlocks();
    else if (cmd === 'install-library') showLibOverlay();
  });
});

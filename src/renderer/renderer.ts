import * as Blockly from 'blockly';
import { arduinoGenerator } from './arduino/index';
import {
  getCurrentFilePath, isDirty, setFilePath, markDirty,
  serializeWorkspace, loadWorkspace, parseFileContent,
} from './fileManager';
import { initMonaco, getContent, setContent, onUserEdit, layout, setMarkers, clearMarkers, setLanguage } from './monacoEditor';
import { parseCodeToWorkspace } from './importer';
import { exampleCategories } from './examples/index';
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
        { kind: 'block', type: 'arduino_comment' },
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
        { kind: 'block', type: 'arduino_digital_write_expr' },
        { kind: 'block', type: 'arduino_digital_read' },
        { kind: 'block', type: 'arduino_level' },
        { kind: 'block', type: 'arduino_analog_write' },
        { kind: 'block', type: 'arduino_analog_read' },
        { kind: 'block', type: 'arduino_map' },
        { kind: 'block', type: 'arduino_tone' },
        { kind: 'block', type: 'arduino_no_tone' },
        { kind: 'block', type: 'arduino_pulse_in' },
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
        { kind: 'block', type: 'arduino_serial_print_format' },
        { kind: 'block', type: 'arduino_serial_write' },
        { kind: 'block', type: 'arduino_serial_available' },
        { kind: 'block', type: 'arduino_serial_read' },
        { kind: 'block', type: 'arduino_serial_parse_int' },
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
        { kind: 'block', type: 'arduino_char_type' },
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
        { kind: 'block', type: 'arduino_for_dir' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '#5C68A6',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_modulo' },
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
        { kind: 'block', type: 'arduino_char' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_join' },
      ],
    },
    {
      kind: 'category',
      name: 'Strings',
      colour: '#5C9EA6',
      contents: [
        { kind: 'block', type: 'arduino_string' },
        { kind: 'block', type: 'arduino_string_fmt' },
        { kind: 'block', type: 'arduino_str_length' },
        { kind: 'block', type: 'arduino_str_toint' },
        { kind: 'block', type: 'arduino_str_charat' },
        { kind: 'block', type: 'arduino_str_substring' },
        { kind: 'block', type: 'arduino_str_indexof' },
        { kind: 'block', type: 'arduino_str_compare' },
        { kind: 'block', type: 'arduino_str_void' },
        { kind: 'block', type: 'arduino_str_replace' },
        { kind: 'block', type: 'arduino_str_setcharat' },
        { kind: 'block', type: 'arduino_str_concat' },
        { kind: 'block', type: 'arduino_str_reserve' },
        { kind: 'block', type: 'arduino_compound_assign' },
        { kind: 'block', type: 'arduino_cast' },
      ],
    },
    {
      kind: 'category',
      name: 'Arrays',
      colour: '#7C5CA6',
      contents: [
        { kind: 'block', type: 'arduino_array_get' },
        { kind: 'block', type: 'arduino_array_set' },
        { kind: 'block', type: 'arduino_array_get2' },
        { kind: 'block', type: 'arduino_array_set2' },
      ],
    },
    {
      kind: 'category',
      name: 'Libraries',
      colour: '#A6602C',
      contents: [
        { kind: 'block', type: 'arduino_lib_stmt' },
        { kind: 'block', type: 'arduino_lib_value' },
        { kind: 'block', type: 'arduino_return' },
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
  const btnImport      = document.getElementById('btn-import')        as HTMLButtonElement;
  const btnClear       = document.getElementById('btn-clear')        as HTMLButtonElement;
  const btnUndo        = document.getElementById('btn-undo')          as HTMLButtonElement;
  const btnRedo        = document.getElementById('btn-redo')          as HTMLButtonElement;
  const btnTidy        = document.getElementById('btn-tidy')          as HTMLButtonElement;
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
  const btnSerial      = document.getElementById('btn-serial')        as HTMLButtonElement;
  const serialPanel    = document.getElementById('serial')           as HTMLElement;
  const serialOutput   = document.getElementById('serial-output')    as HTMLElement;
  const serialStatus   = document.getElementById('serial-status')    as HTMLElement;
  const serialBaud     = document.getElementById('serial-baud')      as HTMLSelectElement;
  const serialInput    = document.getElementById('serial-input')     as HTMLInputElement;
  const serialEnding   = document.getElementById('serial-ending')    as HTMLSelectElement;
  const btnSerialToggle = document.getElementById('btn-serial-toggle') as HTMLButtonElement;
  const btnSerialClear = document.getElementById('btn-serial-clear')  as HTMLButtonElement;
  const btnSerialClose = document.getElementById('btn-serial-close')  as HTMLButtonElement;
  const btnSerialSend  = document.getElementById('btn-serial-send')   as HTMLButtonElement;
  const serialPlot     = document.getElementById('serial-plot')      as HTMLCanvasElement;
  const btnSerialPlot  = document.getElementById('btn-serial-plot')   as HTMLButtonElement;
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
  const btnExamples    = document.getElementById('btn-examples')    as HTMLButtonElement;
  const examplesOverlay = document.getElementById('examples-overlay') as HTMLElement;
  const btnExamplesClose = document.getElementById('btn-examples-close') as HTMLButtonElement;
  const examplesList   = document.getElementById('examples-list')   as HTMLElement;

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

  // ---- Text prompt for Blockly (Electron has no window.prompt, so the default
  // "Create variable…" / "Rename variable…" dialogs silently fail). ----
  const promptOverlay  = document.getElementById('prompt-overlay')  as HTMLElement;
  const promptMessage  = document.getElementById('prompt-message')  as HTMLElement;
  const promptInput    = document.getElementById('prompt-input')    as HTMLInputElement;
  const btnPromptOk    = document.getElementById('btn-prompt-ok')   as HTMLButtonElement;
  const btnPromptCancel = document.getElementById('btn-prompt-cancel') as HTMLButtonElement;

  let promptCallback: ((value: string | null) => void) | null = null;
  function closePrompt(value: string | null): void {
    if (!promptCallback) return;
    const cb = promptCallback;
    promptCallback = null;
    promptOverlay.classList.remove('visible');
    cb(value);
  }
  Blockly.dialog.setPrompt((message, defaultValue, callback) => {
    promptCallback = callback;
    promptMessage.textContent = message;
    promptInput.value = defaultValue ?? '';
    promptOverlay.classList.add('visible');
    promptInput.focus();
    promptInput.select();
  });
  btnPromptOk.addEventListener('click', () => closePrompt(promptInput.value));
  btnPromptCancel.addEventListener('click', () => closePrompt(null));
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); closePrompt(promptInput.value); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePrompt(null); }
  });
  promptOverlay.addEventListener('click', (e) => { if (e.target === promptOverlay) closePrompt(null); });

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
  btnImport.addEventListener('click', () => {
    if (activeTab !== 'arduino') setActiveTab('arduino');   // blocks are generated into the Arduino workspace
    importBlocks();
  });
  btnClear.addEventListener('click', () => {
    activeWorkspace().clear();
    manualEdit = false;
    generateCode();
    markDirty(true);
  });

  btnUndo.addEventListener('click', () => activeWorkspace().undo(false));
  btnRedo.addEventListener('click', () => activeWorkspace().undo(true));
  btnTidy.addEventListener('click', () => {
    const ws = activeWorkspace();
    ws.cleanUp();
    ws.zoomToFit();
  });

  window.addEventListener('resize', () => { Blockly.svgResize(activeWorkspace()); layout(); if (plotting) drawPlot(); });

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

  // ---- Output console panel ----
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
    // The serial monitor holds the port open, which blocks uploading. Free it, then reopen.
    const wasMonitoring = serialConnected;
    if (wasMonitoring) await disconnectSerial();
    const fqbn = selectedFqbn();
    showConsole('Uploading…', 'busy', `Compiling and uploading to ${board.address} (${fqbn || 'arduino:avr:uno'})…`);
    try {
      const result = await window.electronAPI.uploadSketch(getContent(), board.address, fqbn);
      showConsole(result.success ? 'Upload complete' : 'Upload failed', result.success ? 'ok' : 'error', result.output);
    } finally {
      busy = false;
      btnVerify.disabled = false;
      btnUpload.disabled = false;
      if (wasMonitoring) await connectSerial();   // resume watching after upload
    }
  }

  btnVerify.addEventListener('click', verify);
  btnUpload.addEventListener('click', upload);
  btnConsoleClose.addEventListener('click', hideConsole);

  // ---- Serial Monitor (streams a board's serial output via arduino-cli monitor) ----
  let serialConnected = false;

  function setSerialStatus(text: string, cls: string): void {
    serialStatus.textContent = text;
    serialStatus.className = cls;
  }

  function showSerialPanel(): void {
    serialPanel.classList.add('visible');
    Blockly.svgResize(workspace);
    layout();
  }
  function hideSerialPanel(): void {
    serialPanel.classList.remove('visible');
    Blockly.svgResize(workspace);
    layout();
  }

  async function connectSerial(): Promise<void> {
    const board = selectedBoard();
    if (!board) { setSerialStatus('No board selected — click ⟳ to rescan', 'off'); return; }
    const baud = parseInt(serialBaud.value, 10);
    setSerialStatus(`Connecting to ${board.address}…`, 'busy');
    const res = await window.electronAPI.serialMonitorStart(board.address, baud);
    if (res.success) {
      serialConnected = true;
      btnSerialToggle.textContent = 'Disconnect';
      btnSerialToggle.classList.add('connected');
      serialBaud.disabled = true;
      setSerialStatus(`Connected · ${board.address} · ${baud} baud`, 'ok');
    } else {
      setSerialStatus(res.error || 'Failed to open serial port', 'off');
    }
  }

  async function disconnectSerial(): Promise<void> {
    await window.electronAPI.serialMonitorStop();
    serialConnected = false;
    btnSerialToggle.textContent = 'Connect';
    btnSerialToggle.classList.remove('connected');
    serialBaud.disabled = false;
    setSerialStatus('Disconnected', 'off');
  }

  function appendSerial(text: string): void {
    // Keep pinned to the bottom only if the user is already near it.
    const atBottom = serialOutput.scrollHeight - serialOutput.scrollTop - serialOutput.clientHeight < 30;
    serialOutput.textContent += text;
    if (serialOutput.textContent!.length > 200000) {
      serialOutput.textContent = serialOutput.textContent!.slice(-150000);   // cap the buffer
    }
    if (atBottom) serialOutput.scrollTop = serialOutput.scrollHeight;
  }

  // ---- Serial Plotter (numeric values from the same stream, drawn as a live chart) ----
  let plotting = false;
  let plotBuffer = '';                          // accumulates partial lines between chunks
  const PLOT_MAX_POINTS = 400;
  const PLOT_COLORS = ['#4ec9b0', '#dcdcaa', '#9cdcfe', '#ce9178', '#c586c0', '#569cd6'];
  let plotSeries: number[][] = [];              // plotSeries[channel] = rolling values

  function feedPlot(text: string): void {
    plotBuffer += text;
    const lines = plotBuffer.split('\n');
    plotBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const nums = line.trim().split(/[\s,]+/).map(Number).filter(n => Number.isFinite(n));
      if (nums.length === 0) continue;
      nums.forEach((n, i) => {
        (plotSeries[i] ??= []).push(n);
        if (plotSeries[i].length > PLOT_MAX_POINTS) plotSeries[i].shift();
      });
    }
    drawPlot();
  }

  function drawPlot(): void {
    const w = serialPlot.clientWidth, h = serialPlot.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    serialPlot.width = Math.round(w * dpr);
    serialPlot.height = Math.round(h * dpr);
    const ctx = serialPlot.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    let min = Infinity, max = -Infinity;
    for (const s of plotSeries) for (const v of s) { if (v < min) min = v; if (v > max) max = v; }
    if (!isFinite(min)) return;
    if (min === max) { min -= 1; max += 1; }
    const pad = 8;
    const yOf = (v: number) => h - pad - ((v - min) / (max - min)) * (h - 2 * pad);

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, yOf(min)); ctx.lineTo(w - pad, yOf(min)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, yOf(max)); ctx.lineTo(w - pad, yOf(max)); ctx.stroke();

    plotSeries.forEach((s, si) => {
      if (s.length < 2) return;
      ctx.strokeStyle = PLOT_COLORS[si % PLOT_COLORS.length];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      s.forEach((v, i) => {
        const x = pad + (i / (s.length - 1)) * (w - 2 * pad);
        const y = yOf(v);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    });

    ctx.fillStyle = '#7d7d7d';
    ctx.font = '10px monospace';
    ctx.fillText(String(Math.round(max * 100) / 100), 4, 11);
    ctx.fillText(String(Math.round(min * 100) / 100), 4, h - 4);
  }

  function togglePlot(): void {
    plotting = !plotting;
    btnSerialPlot.classList.toggle('active', plotting);
    serialPlot.classList.toggle('hidden', !plotting);
    serialOutput.classList.toggle('hidden', plotting);
    if (plotting) { plotSeries = []; plotBuffer = ''; drawPlot(); }
  }
  btnSerialPlot.addEventListener('click', togglePlot);

  window.electronAPI.onSerialData((text) => {
    appendSerial(text);
    if (plotting) feedPlot(text);
  });
  window.electronAPI.onSerialClosed((message) => {
    if (!serialConnected) return;
    serialConnected = false;
    btnSerialToggle.textContent = 'Connect';
    btnSerialToggle.classList.remove('connected');
    serialBaud.disabled = false;
    setSerialStatus(message || 'Disconnected', 'off');
  });

  function openSerialMonitor(): void {
    if (activeTab !== 'arduino') setActiveTab('arduino');
    showSerialPanel();
    if (!serialConnected) void connectSerial();
  }

  function sendSerial(): void {
    if (!serialConnected) return;
    const text = serialInput.value;
    const ending = serialEnding.value.replace(/\\r/g, '\r').replace(/\\n/g, '\n');
    appendSerial('> ' + text + '\n');
    void window.electronAPI.serialMonitorSend(text, ending);
    serialInput.value = '';
  }

  btnSerial.addEventListener('click', openSerialMonitor);
  btnSerialClose.addEventListener('click', hideSerialPanel);
  btnSerialToggle.addEventListener('click', () => { if (serialConnected) void disconnectSerial(); else void connectSerial(); });
  btnSerialClear.addEventListener('click', () => { serialOutput.textContent = ''; });
  btnSerialSend.addEventListener('click', sendSerial);
  serialInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendSerial(); });

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

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideHelp(); hideRpiSettings(); hideLibOverlay(); hideExamples(); } });

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

  // ---- Examples: load a bundled Arduino sketch and generate blocks from it ----
  async function loadExample(code: string): Promise<void> {
    hideExamples();
    if (!await checkUnsaved()) return;
    if (activeTab !== 'arduino') setActiveTab('arduino');
    isLoadingFromFile = true;
    setContent(code);                 // editor keeps the example verbatim, comments and all
    const result = parseCodeToWorkspace(workspace, code);
    isLoadingFromFile = false;
    manualEdit = true;                // blocks are an aid; the loaded code stays authoritative
    setFilePath(null);
    markDirty(true);
    if (result.imported === 0) {
      showConsole('Loaded as code', 'busy',
        'Loaded the example into the editor. No blocks could be generated from it; edit it as code.');
    } else {
      let msg = `Loaded example — generated ${result.imported} block statement(s).`;
      if (result.skipped.length) {
        msg += `\n\n${result.skipped.length} line(s) could not be converted (left as code only):\n` +
          result.skipped.map(s => '  • ' + s).join('\n');
      }
      showConsole('Example loaded', 'ok', msg);
    }
  }

  function showExamples(): void {
    if (examplesList.childElementCount === 0) {
      for (const cat of exampleCategories) {
        const h = document.createElement('h3');
        h.textContent = cat.name;
        examplesList.appendChild(h);
        for (const ex of cat.examples) {
          const b = document.createElement('button');
          const name = document.createElement('div');
          name.className = 'ex-name';
          name.textContent = ex.name;
          const desc = document.createElement('div');
          desc.className = 'ex-desc';
          desc.textContent = ex.description;
          b.append(name, desc);
          b.addEventListener('click', () => void loadExample(ex.code));
          examplesList.appendChild(b);
        }
      }
    }
    examplesOverlay.classList.add('visible');
  }
  function hideExamples(): void { examplesOverlay.classList.remove('visible'); }

  btnExamples.addEventListener('click', showExamples);
  btnExamplesClose.addEventListener('click', hideExamples);
  examplesOverlay.addEventListener('click', (e) => { if (e.target === examplesOverlay) hideExamples(); });

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

  // Drop an empty setup()/loop() pair into the canvas so a fresh sketch isn't blank.
  function seedStarterBlocks(): void {
    const setup = workspace.newBlock('arduino_setup') as Blockly.BlockSvg;
    setup.initSvg(); setup.render(); setup.moveBy(40, 40);
    const loop = workspace.newBlock('arduino_loop') as Blockly.BlockSvg;
    loop.initSvg(); loop.render(); loop.moveBy(40, 220);
  }

  async function fileNew(): Promise<void> {
    if (!await checkUnsaved()) return;
    isLoadingFromFile = true;
    workspace.clear();
    seedStarterBlocks();
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

  // Fresh start: seed an empty setup()/loop() so the canvas isn't blank on first launch.
  isLoadingFromFile = true;
  seedStarterBlocks();
  isLoadingFromFile = false;
  generateCode();
  markDirty(false);

  window.electronAPI.onMenuCmd(async (cmd) => {
    if      (cmd === 'file-new')     await fileNew();
    else if (cmd === 'file-open')    await fileOpen();
    else if (cmd === 'file-save')    await doSave();
    else if (cmd === 'file-save-as') await doSaveAs();
    else if (cmd === 'verify')       await verify();
    else if (cmd === 'upload')       await upload();
    else if (cmd === 'serial-monitor') openSerialMonitor();
    else if (cmd === 'show-tutorial') showHelp();
    else if (cmd === 'import-blocks') importBlocks();
    else if (cmd === 'install-library') showLibOverlay();
    else if (cmd === 'show-examples') showExamples();
  });
});

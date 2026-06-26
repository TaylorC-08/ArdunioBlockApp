import * as Blockly from 'blockly';
import { arduinoGenerator } from './arduino/index';

const toolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
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
  const blocklyDiv  = document.getElementById('blockly-div')  as HTMLElement;
  const codeOutput  = document.getElementById('code-output')  as HTMLPreElement;
  const btnGenerate = document.getElementById('btn-generate') as HTMLButtonElement;
  const btnClear    = document.getElementById('btn-clear')    as HTMLButtonElement;

  const workspace = Blockly.inject(blocklyDiv, {
    toolbox,
    media: 'media/',
    grid:  { spacing: 20, length: 3, colour: '#3a3a3a', snap: true },
    zoom:  { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
    trashcan: true,
  });

  Blockly.svgResize(workspace);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function generateCode(): void {
    const code = arduinoGenerator.workspaceToCode(workspace);
    codeOutput.textContent = code || '// No blocks in workspace';
  }

  function debouncedGenerateCode(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(generateCode, 150);
  }

  workspace.addChangeListener(debouncedGenerateCode);
  btnGenerate.addEventListener('click', generateCode);
  btnClear.addEventListener('click', () => {
    workspace.clear();
    codeOutput.textContent = '// Click "Generate Code" to see output';
  });

  window.addEventListener('resize', () => Blockly.svgResize(workspace));
});

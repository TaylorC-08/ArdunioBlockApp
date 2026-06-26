import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

// ---- DOM element references with null safety ----

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element "#${id}" not found in the DOM.`);
  }
  if (!(el instanceof type)) {
    throw new Error(`Element "#${id}" is not a ${type.name}.`);
  }
  return el as T;
}

const toolboxElement = document.getElementById('toolbox') as Element;
if (!toolboxElement) {
  throw new Error('Required element "#toolbox" not found in the DOM.');
}

const blocklyDiv = getElement('blockly-div', HTMLElement);
const codeOutput = getElement('code-output', HTMLPreElement);
const btnGenerate = getElement('btn-generate', HTMLButtonElement);
const btnClear = getElement('btn-clear', HTMLButtonElement);

const workspace = Blockly.inject(blocklyDiv, {
  toolbox: toolboxElement,
  media: 'media/',
  grid: {
    spacing: 20,
    length: 3,
    colour: '#3a3a3a',
    snap: true,
  },
  zoom: {
    controls: true,
    wheel: true,
    startScale: 1.0,
    maxScale: 3,
    minScale: 0.3,
    scaleSpeed: 1.2,
  },
  trashcan: true,
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function generateCode(): void {
  const code = javascriptGenerator.workspaceToCode(workspace);
  codeOutput.textContent = code || '// No blocks in workspace';
}

function debouncedGenerateCode(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(generateCode, 150);
}

function clearWorkspace(): void {
  workspace.clear();
  codeOutput.textContent = '// Click "Generate Code" to see output';
}

workspace.addChangeListener(debouncedGenerateCode);

btnGenerate.addEventListener('click', generateCode);
btnClear.addEventListener('click', clearWorkspace);

window.addEventListener('resize', () => {
  Blockly.svgResize(workspace);
});

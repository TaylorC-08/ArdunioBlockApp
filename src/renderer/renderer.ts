import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

const toolboxElement = document.getElementById('toolbox') as Element;
const blocklyDiv = document.getElementById('blockly-div') as HTMLElement;
const codeOutput = document.getElementById('code-output') as HTMLPreElement;
const btnGenerate = document.getElementById('btn-generate') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;

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

function generateCode(): void {
  const code = javascriptGenerator.workspaceToCode(workspace);
  codeOutput.textContent = code || '// No blocks in workspace';
}

function clearWorkspace(): void {
  workspace.clear();
  codeOutput.textContent = '// Click "Generate Code" to see output';
}

workspace.addChangeListener(() => {
  generateCode();
});

btnGenerate.addEventListener('click', generateCode);
btnClear.addEventListener('click', clearWorkspace);

window.addEventListener('resize', () => {
  Blockly.svgResize(workspace);
});

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

const toolboxElement = document.getElementById('toolbox') as Element;
const blocklyDiv = document.getElementById('blockly-div') as HTMLElement;
const codeOutput = document.getElementById('code-output') as HTMLPreElement;
const btnGenerate = document.getElementById('btn-generate') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;

const workspace = Blockly.inject(blocklyDiv, {
  toolbox: toolboxElement,
  grid: {
    spacing: 20,
    length: 3,
    colour: '#2e2e2e',
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
  theme: Blockly.Theme.defineTheme('dark', {
    name: 'dark',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#1e1e1e',
      toolboxBackgroundColour: '#2d2d2d',
      toolboxForegroundColour: '#d4d4d4',
      flyoutBackgroundColour: '#252526',
      flyoutForegroundColour: '#d4d4d4',
      flyoutOpacity: 0.9,
      scrollbarColour: '#4e4e4e',
      insertionMarkerColour: '#fff',
      insertionMarkerOpacity: 0.3,
      scrollbarOpacity: 0.4,
      cursorColour: '#d0d0ff',
    },
  }),
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

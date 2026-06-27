import * as monaco from 'monaco-editor';

// Monaco loads its language services from a web worker. Point it at the
// separately-bundled worker (build:worker) so it loads same-origin.
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorkerUrl: () => 'editor.worker.js',
};

let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let suppressEdit = false;
let userEditCb: (() => void) | null = null;

export function initMonaco(container: HTMLElement): void {
  editor = monaco.editor.create(container, {
    value: '// Drag blocks or open a file to see code here',
    language: 'cpp',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    scrollBeyondLastLine: false,
  });
  editor.onDidChangeModelContent(() => {
    if (suppressEdit) return;
    userEditCb?.();
  });
}

export function getContent(): string {
  return editor?.getValue() ?? '';
}

// Programmatic update — does not fire the user-edit callback.
export function setContent(text: string): void {
  if (!editor) return;
  suppressEdit = true;
  editor.setValue(text);
  suppressEdit = false;
}

export function onUserEdit(cb: () => void): void {
  userEditCb = cb;
}

export function layout(): void {
  editor?.layout();
}

interface Diag { line: number; column: number; severity: 'error' | 'warning'; message: string; }

// Underline compiler errors/warnings in the editor gutter and text.
export function setMarkers(diags: Diag[]): void {
  const model = editor?.getModel();
  if (!model) return;
  const lineCount = model.getLineCount();
  monaco.editor.setModelMarkers(model, 'arduino', diags.map(d => {
    const line = Math.min(Math.max(d.line, 1), lineCount);
    return {
      startLineNumber: line,
      startColumn: d.column,
      endLineNumber: line,
      endColumn: model.getLineMaxColumn(line),
      message: d.message,
      severity: d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
    };
  }));
}

export function clearMarkers(): void {
  const model = editor?.getModel();
  if (model) monaco.editor.setModelMarkers(model, 'arduino', []);
}

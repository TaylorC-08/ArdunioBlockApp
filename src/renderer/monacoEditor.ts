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

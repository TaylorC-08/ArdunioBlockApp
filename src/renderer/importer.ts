import * as Blockly from 'blockly';

/**
 * Best-effort parser: turns a CONSTRAINED SUBSET of Arduino C++ back into blocks.
 * It recognizes the statement forms this app generates (inside setup()/loop()).
 * Anything it can't confidently map is returned in `skipped` and left to the user —
 * there is no general C++ -> Blockly conversion, so partial coverage is by design.
 */

export interface ImportResult {
  imported: number;
  skipped: string[];
}

type WS = Blockly.WorkspaceSvg;

function makeBlock(ws: WS, type: string): Blockly.BlockSvg {
  const b = ws.newBlock(type) as Blockly.BlockSvg;
  b.initSvg();
  b.render();
  return b;
}

// Build a value block for a simple expression, or null if unsupported.
function valueBlock(ws: WS, expr: string): Blockly.BlockSvg | null {
  const e = expr.trim();
  if (/^-?\d+$/.test(e)) {
    const b = makeBlock(ws, 'math_number');
    b.setFieldValue(e, 'NUM');
    return b;
  }
  if (/^".*"$/.test(e)) {
    const b = makeBlock(ws, 'text');
    b.setFieldValue(e.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\'), 'TEXT');
    return b;
  }
  return null;
}

function attachValue(ws: WS, parent: Blockly.BlockSvg, inputName: string, expr: string): boolean {
  const v = valueBlock(ws, expr);
  if (!v) return false;
  parent.getInput(inputName)!.connection!.connect(v.outputConnection!);
  return true;
}

const KNOWN_BAUDS = new Set(['9600', '19200', '38400', '57600', '115200']);

// Build a statement block from one trimmed statement, or null if unsupported.
function statementBlock(ws: WS, stmt: string): Blockly.BlockSvg | null {
  let m: RegExpMatchArray | null;

  if ((m = stmt.match(/^pinMode\(\s*(\d+)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)$/))) {
    const b = makeBlock(ws, 'arduino_pin_mode');
    b.setFieldValue(m[1], 'PIN');
    b.setFieldValue(m[2], 'MODE');
    return b;
  }
  if ((m = stmt.match(/^digitalWrite\(\s*(\d+)\s*,\s*(HIGH|LOW)\s*\)$/))) {
    const b = makeBlock(ws, 'arduino_digital_write');
    b.setFieldValue(m[1], 'PIN');
    b.setFieldValue(m[2], 'VALUE');
    return b;
  }
  if ((m = stmt.match(/^analogWrite\(\s*(\d+)\s*,\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'arduino_analog_write');
    b.setFieldValue(m[1], 'PIN');
    if (!attachValue(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^delay\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'arduino_delay');
    if (!attachValue(ws, b, 'MS', m[1])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^delayMicroseconds\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'arduino_delay_microseconds');
    if (!attachValue(ws, b, 'US', m[1])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^Serial\.begin\(\s*(\d+)\s*\)$/))) {
    if (!KNOWN_BAUDS.has(m[1])) return null;
    const b = makeBlock(ws, 'arduino_serial_begin');
    b.setFieldValue(m[1], 'BAUD');
    return b;
  }
  if ((m = stmt.match(/^Serial\.(print|println)\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, m[1] === 'println' ? 'arduino_serial_println' : 'arduino_serial_print');
    if (!attachValue(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
    return b;
  }
  return null;
}

// Split a brace body into top-level statements (on ';' outside parens/quotes).
function splitStatements(body: string): string[] {
  const out: string[] = [];
  let depth = 0, inStr = false, cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      cur += c;
      if (c === '"' && body[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ';' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

// Extract the body between the matching braces of `void <name>()`.
function extractBody(code: string, name: string): string | null {
  const re = new RegExp(`void\\s+${name}\\s*\\(\\s*\\)\\s*\\{`);
  const m = re.exec(code);
  if (!m) return null;
  let depth = 1;
  const start = m.index + m[0].length;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) return code.slice(start, i); }
  }
  return null;
}

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '');        // line comments
}

// Build a container (setup/loop) and chain its parsed child statements into it.
function buildContainer(ws: WS, type: string, body: string, x: number, y: number, skipped: string[]): number {
  const container = makeBlock(ws, type);
  container.moveBy(x, y);
  let imported = 0;
  let prev: Blockly.Connection | null = container.getInput('DO')!.connection;
  for (const stmt of splitStatements(body)) {
    const block = statementBlock(ws, stmt);
    if (!block) { skipped.push(stmt.length > 80 ? stmt.slice(0, 77) + '…' : stmt); continue; }
    prev!.connect(block.previousConnection!);
    prev = block.nextConnection;
    imported++;
  }
  return imported;
}

// Build a stack of #include blocks from top-level #include lines.
function buildIncludes(ws: WS, code: string): number {
  const re = /^\s*#include\s+([<"][^>"]+[>"])\s*$/gm;
  let m: RegExpExecArray | null;
  let count = 0;
  let prev: Blockly.Connection | null = null;
  while ((m = re.exec(code))) {
    const raw = m[1];                                   // <Servo.h> or "local.h"
    const lib = raw.startsWith('<') ? raw.slice(1, -1) : raw; // strip <>, keep quotes
    const b = makeBlock(ws, 'arduino_include');
    b.setFieldValue(lib, 'LIB');
    if (prev) prev.connect(b.previousConnection!);
    else b.moveBy(20, 20);
    prev = b.nextConnection;
    count++;
  }
  return count;
}

export function parseCodeToWorkspace(workspace: WS, code: string): ImportResult {
  workspace.clear();
  const clean = stripComments(code);
  const skipped: string[] = [];
  let imported = 0;

  imported += buildIncludes(workspace, clean);

  const setupBody = extractBody(clean, 'setup');
  const loopBody = extractBody(clean, 'loop');

  if (setupBody === null && loopBody === null && imported === 0) {
    // No recognizable structure at all.
    return { imported: 0, skipped: ['No #include, void setup() or void loop() found.'] };
  }

  if (setupBody) imported += buildContainer(workspace, 'arduino_setup', setupBody, 300, 20, skipped);
  if (loopBody)  imported += buildContainer(workspace, 'arduino_loop', loopBody, 300, 240, skipped);

  return { imported, skipped };
}

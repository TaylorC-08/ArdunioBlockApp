import * as Blockly from 'blockly';

/**
 * Best-effort parser: turns a CONSTRAINED SUBSET of Arduino C++ back into blocks.
 * It recognizes the statement forms this app generates plus the common shapes used
 * by the bundled Arduino IDE examples: variable declarations/assignments, if/else,
 * increasing for() loops, while(), and arithmetic/logic expressions.
 *
 * Anything it can't confidently map is returned in `skipped` and left to the user —
 * there is no general C++ -> Blockly conversion, so partial coverage is by design.
 * The editor keeps the original code (with comments) regardless; blocks are an aid.
 */

export interface ImportResult {
  imported: number;
  skipped: string[];
}

type WS = Blockly.WorkspaceSvg;
type B = Blockly.BlockSvg;

const KNOWN_BAUDS = new Set(['9600', '19200', '38400', '57600', '115200']);

// Create + render a block. `before` runs after creation but before initSvg, so
// variable fields can be set without spawning a stray default variable.
function makeBlock(ws: WS, type: string, before?: (b: B) => void): B {
  const b = ws.newBlock(type) as B;
  if (before) before(b);
  b.initSvg();
  b.render();
  return b;
}

function getVarId(ws: WS, name: string): string {
  const existing = ws.getVariable(name);
  return (existing ?? ws.createVariable(name)).getId();
}

function truncate(s: string): string {
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

// Undo C string escapes for a text block's value.
function unescapeStr(s: string): string {
  return s.replace(/\\(.)/g, (_, ch) =>
    ch === 'n' ? '\n' : ch === 't' ? '\t' : ch === 'r' ? '\r' : ch);
}

// ---- Expression parser (recursive descent) ----

interface Tok { t: 'num' | 'str' | 'id' | 'op' | 'p'; v: string; }

function tokenize(s: string): Tok[] | null {
  const toks: Tok[] = [];
  const ops2 = ['==', '!=', '<=', '>=', '&&', '||'];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1, str = '';
      while (j < s.length && s[j] !== '"') {
        if (s[j] === '\\' && j + 1 < s.length) { str += s[j] + s[j + 1]; j += 2; continue; }
        str += s[j]; j++;
      }
      if (j >= s.length) return null;           // unterminated string
      toks.push({ t: 'str', v: str }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: 'num', v: s.slice(i, j) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
    }
    const two = s.slice(i, i + 2);
    if (ops2.includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/<>!='.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    if ('(),'.includes(c)) { toks.push({ t: 'p', v: c }); i++; continue; }
    return null;                                 // unsupported character
  }
  return toks;
}

// Binary operator -> [block type, field value]
const BIN: { [op: string]: [string, string] } = {
  '||': ['logic_operation', 'OR'],   '&&': ['logic_operation', 'AND'],
  '==': ['logic_compare', 'EQ'],     '!=': ['logic_compare', 'NEQ'],
  '<':  ['logic_compare', 'LT'],     '<=': ['logic_compare', 'LTE'],
  '>':  ['logic_compare', 'GT'],     '>=': ['logic_compare', 'GTE'],
  '+':  ['math_arithmetic', 'ADD'],  '-':  ['math_arithmetic', 'MINUS'],
  '*':  ['math_arithmetic', 'MULTIPLY'], '/': ['math_arithmetic', 'DIVIDE'],
};

class ExprParser {
  private pos = 0;
  private made: B[] = [];
  constructor(private ws: WS, private toks: Tok[]) {}

  parse(): B | null {
    const b = this.binary(() => this.and(), ['||']);
    if (!b || this.pos !== this.toks.length) return this.fail();
    return b;
  }

  private fail(): null {
    for (const b of this.made) if (!(b as { disposed?: boolean }).disposed) b.dispose(false);
    this.made = [];
    return null;
  }

  private make(type: string): B {
    const b = makeBlock(this.ws, type);
    this.made.push(b);
    return b;
  }

  private peek(): Tok | undefined { return this.toks[this.pos]; }

  private binary(next: () => B | null, ops: string[]): B | null {
    let left = next();
    if (!left) return null;
    let t = this.peek();
    while (t && t.t === 'op' && ops.includes(t.v)) {
      this.pos++;
      const right = next();
      if (!right) return null;
      const [type, val] = BIN[t.v];
      const b = this.make(type);
      b.setFieldValue(val, 'OP');
      b.getInput('A')!.connection!.connect(left.outputConnection!);
      b.getInput('B')!.connection!.connect(right.outputConnection!);
      left = b;
      t = this.peek();
    }
    return left;
  }

  private and(): B | null { return this.binary(() => this.eq(), ['&&']); }
  private eq(): B | null { return this.binary(() => this.rel(), ['==', '!=']); }
  private rel(): B | null { return this.binary(() => this.add(), ['<', '<=', '>', '>=']); }
  private add(): B | null { return this.binary(() => this.mul(), ['+', '-']); }
  private mul(): B | null { return this.binary(() => this.unary(), ['*', '/']); }

  private unary(): B | null {
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '-') {
      this.pos++;
      const n = this.peek();
      if (n && n.t === 'num') {                  // fold "-5" into a negative literal
        this.pos++;
        const b = this.make('math_number');
        b.setFieldValue('-' + n.v, 'NUM');
        return b;
      }
      const operand = this.unary();
      if (!operand) return null;
      const b = this.make('math_single');
      b.setFieldValue('NEG', 'OP');
      b.getInput('NUM')!.connection!.connect(operand.outputConnection!);
      return b;
    }
    if (t && t.t === 'op' && t.v === '!') {
      this.pos++;
      const operand = this.unary();
      if (!operand) return null;
      const b = this.make('logic_negate');
      b.getInput('BOOL')!.connection!.connect(operand.outputConnection!);
      return b;
    }
    return this.primary();
  }

  private primary(): B | null {
    const t = this.peek();
    if (!t) return null;
    if (t.t === 'p' && t.v === '(') {
      this.pos++;
      const e = this.binary(() => this.and(), ['||']);
      const c = this.peek();
      if (!e || !c || c.v !== ')') return null;
      this.pos++;
      return e;
    }
    if (t.t === 'num') {
      this.pos++;
      const b = this.make('math_number');
      b.setFieldValue(t.v, 'NUM');
      return b;
    }
    if (t.t === 'str') {
      this.pos++;
      const b = this.make('text');
      b.setFieldValue(unescapeStr(t.v), 'TEXT');
      return b;
    }
    if (t.t === 'id') {
      this.pos++;
      if (t.v === 'true' || t.v === 'false') {
        const b = this.make('logic_boolean');
        b.setFieldValue(t.v === 'true' ? 'TRUE' : 'FALSE', 'BOOL');
        return b;
      }
      if (t.v === 'HIGH' || t.v === 'LOW') {
        const b = this.make('arduino_level');
        b.setFieldValue(t.v, 'LEVEL');
        return b;
      }
      const nx = this.peek();
      if (nx && nx.v === '(') return this.call(t.v);
      const b = this.make('variables_get');
      b.getField('VAR')!.setValue(getVarId(this.ws, t.v));
      return b;
    }
    return null;
  }

  private call(name: string): B | null {
    this.pos++;                                  // consume '('
    if (name === 'digitalRead' || name === 'analogRead') {
      // Take the pin argument as raw text (e.g. A0, ledPin) so it lands in the
      // block's text PIN field without being parsed into a variable.
      const parts: string[] = [];
      let depth = 1;
      while (this.pos < this.toks.length) {
        const tk = this.toks[this.pos];
        if (tk.v === '(') depth++;
        else if (tk.v === ')') { depth--; if (depth === 0) break; }
        parts.push(tk.v); this.pos++;
      }
      const c = this.peek();
      if (!c || c.v !== ')') return null;
      this.pos++;
      const pin = parts.join('');
      if (!pin) return null;
      const b = this.make(name === 'digitalRead' ? 'arduino_digital_read' : 'arduino_analog_read');
      b.setFieldValue(pin, 'PIN');
      return b;
    }
    if (name === 'millis') {
      const c = this.peek();
      if (!c || c.v !== ')') return null;
      this.pos++;
      return this.make('arduino_millis');
    }
    if (name === 'map') {
      const args = this.args();
      if (!args || args.length !== 5) return null;
      const b = this.make('arduino_map');
      const names = ['VALUE', 'FROM_LOW', 'FROM_HIGH', 'TO_LOW', 'TO_HIGH'];
      args.forEach((a, idx) => b.getInput(names[idx])!.connection!.connect(a.outputConnection!));
      return b;
    }
    return null;                                 // unsupported function call
  }

  private args(): B[] | null {
    const list: B[] = [];
    if (this.peek() && this.peek()!.v === ')') { this.pos++; return list; }
    for (;;) {
      const e = this.binary(() => this.and(), ['||']);
      if (!e) return null;
      list.push(e);
      const c = this.peek();
      if (!c) return null;
      if (c.v === ',') { this.pos++; continue; }
      if (c.v === ')') { this.pos++; return list; }
      return null;
    }
  }
}

function parseExpression(ws: WS, expr: string): B | null {
  const toks = tokenize(expr);
  if (!toks || toks.length === 0) return null;
  return new ExprParser(ws, toks).parse();
}

function attachExpr(ws: WS, parent: B, input: string, expr: string): boolean {
  const v = parseExpression(ws, expr);
  if (!v) return false;
  parent.getInput(input)!.connection!.connect(v.outputConnection!);
  return true;
}

// ---- Statement parsing ----

// Find a top-level '=' assignment (not ==, !=, <=, >=, or a compound +=/-=/...).
function topLevelAssign(stmt: string): { name: string; rhs: string } | null {
  let depth = 0, inStr = false;
  for (let i = 0; i < stmt.length; i++) {
    const c = stmt[i];
    if (inStr) { if (c === '"' && stmt[i - 1] !== '\\') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === '=' && depth === 0) {
      const prev = stmt[i - 1], next = stmt[i + 1];
      if (next === '=') { i++; continue; }                     // ==
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>') continue; // !=, <=, >=
      if (prev === '+' || prev === '-' || prev === '*' || prev === '/') return null; // compound: unsupported
      const lhs = stmt.slice(0, i).trim();
      const rhs = stmt.slice(i + 1).trim();
      const nm = lhs.match(/([A-Za-z_]\w*)$/);                 // last identifier is the variable
      if (!nm) return null;
      return { name: nm[1], rhs };
    }
  }
  return null;
}

// Build a single non-control statement block, or null if unsupported.
function simpleStmt(ws: WS, stmt: string): B | null {
  const asn = topLevelAssign(stmt);
  if (asn) {
    const b = makeBlock(ws, 'variables_set', x => x.getField('VAR')!.setValue(getVarId(ws, asn.name)));
    if (!attachExpr(ws, b, 'VALUE', asn.rhs)) { b.dispose(false); return null; }
    return b;
  }

  let m: RegExpMatchArray | null;
  if ((m = stmt.match(/^pinMode\(\s*([^,]+?)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)$/))) {
    const b = makeBlock(ws, 'arduino_pin_mode');
    b.setFieldValue(m[1], 'PIN');
    b.setFieldValue(m[2], 'MODE');
    return b;
  }
  if ((m = stmt.match(/^digitalWrite\(\s*([^,]+?)\s*,\s*(HIGH|LOW)\s*\)$/))) {
    const b = makeBlock(ws, 'arduino_digital_write');
    b.setFieldValue(m[1], 'PIN');
    b.setFieldValue(m[2], 'VALUE');
    return b;
  }
  if ((m = stmt.match(/^analogWrite\(\s*([^,]+?)\s*,\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'arduino_analog_write');
    b.setFieldValue(m[1], 'PIN');
    if (!attachExpr(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^delay\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'arduino_delay');
    if (!attachExpr(ws, b, 'MS', m[1])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^delayMicroseconds\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'arduino_delay_microseconds');
    if (!attachExpr(ws, b, 'US', m[1])) { b.dispose(false); return null; }
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
    if (!attachExpr(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
    return b;
  }
  return null;
}

// A parsed statement unit from a brace body.
type Unit =
  | { kind: 'simple'; text: string }
  | { kind: 'if'; cond: string; then: string; els: string | null }
  | { kind: 'for'; header: string; body: string }
  | { kind: 'while'; cond: string; body: string };

// Split a brace body into statement units, handling nested if/for/while blocks.
// Returns null if the structure is malformed (unbalanced braces, etc.).
function splitUnits(body: string): Unit[] | null {
  const units: Unit[] = [];
  const len = body.length;
  let i = 0;

  const skipWs = () => { while (i < len && /\s/.test(body[i])) i++; };

  // Read a balanced (...) or {...} starting at body[i] === open; returns inner text.
  const readBalanced = (open: string, close: string): string | null => {
    let depth = 0, inStr = false;
    const start = i;
    for (; i < len; i++) {
      const c = body[i];
      if (inStr) { if (c === '"' && body[i - 1] !== '\\') inStr = false; continue; }
      if (c === '"') { inStr = true; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) { const s = body.slice(start + 1, i); i++; return s; } }
    }
    return null;
  };

  const readUntilSemicolon = (): string => {
    const start = i; let depth = 0, inStr = false;
    for (; i < len; i++) {
      const c = body[i];
      if (inStr) { if (c === '"' && body[i - 1] !== '\\') inStr = false; continue; }
      if (c === '"') { inStr = true; continue; }
      if (c === '(' || c === '{') depth++;
      else if (c === ')' || c === '}') depth--;
      else if (c === ';' && depth === 0) { const s = body.slice(start, i); i++; return s; }
    }
    return body.slice(start, i);
  };

  while (true) {
    skipWs();
    if (i >= len) break;
    const start = i;
    const kw = body.slice(i).match(/^(if|for|while)\b/);
    if (kw) {
      let j = i + kw[1].length;
      while (j < len && /\s/.test(body[j])) j++;
      if (body[j] === '(') {
        i = j;
        const head = readBalanced('(', ')');
        if (head === null) return null;
        skipWs();
        if (body[i] === '{') {                    // braced body only (matches the examples)
          const blk = readBalanced('{', '}');
          if (blk === null) return null;
          if (kw[1] === 'if') {
            let els: string | null = null;
            const save = i;
            skipWs();
            if (body.slice(i).match(/^else\b/)) {
              i += 4; skipWs();
              if (body[i] === '{') els = readBalanced('{', '}');
              else i = save;                       // else-if / braceless else: leave for fallback
            } else i = save;
            units.push({ kind: 'if', cond: head, then: blk, els });
          } else if (kw[1] === 'for') {
            units.push({ kind: 'for', header: head, body: blk });
          } else {
            units.push({ kind: 'while', cond: head, body: blk });
          }
          continue;
        }
        i = start;                                 // no '{' — fall through to simple statement
      }
    }
    const stmt = readUntilSemicolon().trim();
    if (stmt) units.push({ kind: 'simple', text: stmt });
  }
  return units;
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const c of s) {
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

interface Counter { n: number; }

function buildIf(ws: WS, u: { cond: string; then: string; els: string | null }, skipped: string[], counter: Counter): B | null {
  const cond = parseExpression(ws, u.cond);
  if (!cond) return null;
  const b = makeBlock(ws, 'controls_if', x => {
    if (u.els) (x as unknown as { loadExtraState?: (s: object) => void }).loadExtraState?.({ hasElse: true });
  });
  b.getInput('IF0')!.connection!.connect(cond.outputConnection!);
  buildBody(ws, u.then, b.getInput('DO0')!.connection!, skipped, counter);
  if (u.els) {
    const elseInput = b.getInput('ELSE');
    if (elseInput) buildBody(ws, u.els, elseInput.connection!, skipped, counter);
    else skipped.push('else { … }');
  }
  return b;
}

function buildFor(ws: WS, u: { header: string; body: string }, skipped: string[], counter: Counter): B | null {
  const parts = splitTop(u.header, ';');
  if (parts.length !== 3) return null;
  const init = parts[0].trim(), cond = parts[1].trim(), step = parts[2].trim();

  const im = init.match(/^(?:[A-Za-z_]\w*\s+)*([A-Za-z_]\w*)\s*=\s*(.+)$/);
  if (!im) return null;
  const varName = im[1], fromExpr = im[2].trim();

  const cm = cond.match(/^[A-Za-z_]\w*\s*(<=|<)\s*(.+)$/);     // increasing loops only
  if (!cm) return null;
  let toExpr = cm[2].trim();
  if (cm[1] === '<') {
    if (/^\d+$/.test(toExpr)) toExpr = String(parseInt(toExpr, 10) - 1);
    else return null;                                          // can't make '<' inclusive safely
  }

  let by: string | null = null;
  if (/^(?:\+\+\s*[A-Za-z_]\w*|[A-Za-z_]\w*\s*\+\+)$/.test(step)) by = '1';
  else { const sm = step.match(/^[A-Za-z_]\w*\s*\+=\s*(.+)$/); if (sm) by = sm[1].trim(); }
  if (by === null) return null;                                // decreasing or unsupported step

  const b = makeBlock(ws, 'controls_for', x => x.getField('VAR')!.setValue(getVarId(ws, varName)));
  if (!attachExpr(ws, b, 'FROM', fromExpr) || !attachExpr(ws, b, 'TO', toExpr) || !attachExpr(ws, b, 'BY', by)) {
    b.dispose(false); return null;
  }
  buildBody(ws, u.body, b.getInput('DO')!.connection!, skipped, counter);
  return b;
}

function buildWhile(ws: WS, u: { cond: string; body: string }, skipped: string[], counter: Counter): B | null {
  const cond = parseExpression(ws, u.cond);
  if (!cond) return null;
  const b = makeBlock(ws, 'controls_whileUntil');
  b.setFieldValue('WHILE', 'MODE');
  b.getInput('BOOL')!.connection!.connect(cond.outputConnection!);
  buildBody(ws, u.body, b.getInput('DO')!.connection!, skipped, counter);
  return b;
}

// Parse a brace body and chain its statement blocks onto `firstConn`.
function buildBody(ws: WS, body: string, firstConn: Blockly.Connection, skipped: string[], counter: Counter): void {
  const units = splitUnits(body);
  if (!units) { skipped.push('(could not parse a code block)'); return; }
  let prev: Blockly.Connection | null = firstConn;
  for (const u of units) {
    let block: B | null = null;
    if (u.kind === 'simple') block = simpleStmt(ws, u.text);
    else if (u.kind === 'if') block = buildIf(ws, u, skipped, counter);
    else if (u.kind === 'for') block = buildFor(ws, u, skipped, counter);
    else block = buildWhile(ws, u, skipped, counter);

    if (!block) {
      const text = u.kind === 'simple' ? u.text
        : u.kind === 'if' ? `if (${u.cond}) { … }`
        : u.kind === 'for' ? `for (${u.header}) { … }`
        : `while (${u.cond}) { … }`;
      skipped.push(truncate(text));
      continue;
    }
    prev!.connect(block.previousConnection!);
    prev = block.nextConnection;
    counter.n++;
  }
}

// ---- Top-level helpers (includes, setup/loop bodies) ----

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '');        // line comments
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

function buildContainer(ws: WS, type: string, body: string, x: number, y: number, skipped: string[], counter: Counter): void {
  const container = makeBlock(ws, type);
  container.moveBy(x, y);
  buildBody(ws, body, container.getInput('DO')!.connection!, skipped, counter);
}

export function parseCodeToWorkspace(workspace: WS, code: string): ImportResult {
  workspace.clear();
  const clean = stripComments(code);
  const skipped: string[] = [];
  const counter: Counter = { n: 0 };

  counter.n += buildIncludes(workspace, clean);

  const setupBody = extractBody(clean, 'setup');
  const loopBody = extractBody(clean, 'loop');

  if (setupBody === null && loopBody === null && counter.n === 0) {
    return { imported: 0, skipped: ['No #include, void setup() or void loop() found.'] };
  }

  if (setupBody) buildContainer(workspace, 'arduino_setup', setupBody, 300, 20, skipped, counter);
  if (loopBody) buildContainer(workspace, 'arduino_loop', loopBody, 300, 240, skipped, counter);

  return { imported: counter.n, skipped };
}

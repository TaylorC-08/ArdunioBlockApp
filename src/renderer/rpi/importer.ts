import * as Blockly from 'blockly';

/**
 * Best-effort Raspberry Pi importer: turns a CONSTRAINED SUBSET of Python back into
 * blocks. It recognises the shapes this app generates and idiomatic RPi.GPIO code:
 * pin setup, digital read/write, sleep, print, assignments, if/elif/else, while, and
 * for-range loops, plus the on-start / repeat-forever program structure.
 *
 * Anything it can't confidently map (PWM/servo, events, buses, sensors, arbitrary
 * calls) is returned in `skipped` and left as code — there is no general Python →
 * Blockly conversion, so partial coverage is by design. The editor keeps the original
 * code regardless; blocks are an aid.
 */

export interface ImportResult {
  imported: number;
  skipped: string[];
}

type WS = Blockly.WorkspaceSvg;
type B = Blockly.BlockSvg;

function makeBlock(ws: WS, type: string, before?: (b: B) => void): B {
  const b = ws.newBlock(type) as B;
  if (before) before(b);
  if (typeof b.initSvg === 'function') { b.initSvg(); b.render(); }
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

// ---- Expression parser (recursive descent) ----

interface Tok { t: 'num' | 'str' | 'id' | 'op' | 'p'; v: string; }

function tokenize(s: string): Tok[] | null {
  const toks: Tok[] = [];
  const ops2 = ['==', '!=', '<=', '>=', '//'];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1, str = '';
      while (j < s.length && s[j] !== q) {
        if (s[j] === '\\' && j + 1 < s.length) { str += s[j] + s[j + 1]; j += 2; continue; }
        str += s[j]; j++;
      }
      if (j >= s.length) return null;
      toks.push({ t: 'str', v: str }); i = j + 1; continue;
    }
    if (c === '0' && (s[i + 1] === 'x' || s[i + 1] === 'X')) {
      let j = i + 2; while (j < s.length && /[0-9a-fA-F]/.test(s[j])) j++;
      toks.push({ t: 'num', v: String(parseInt(s.slice(i, j), 16)) }); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: 'num', v: s.slice(i, j) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      while (s[j] === '.' && /[A-Za-z_]/.test(s[j + 1] || '')) {
        j++; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      }
      toks.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
    }
    const two = s.slice(i, i + 2);
    if (ops2.includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/%<>='.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    if ('()[],'.includes(c)) { toks.push({ t: 'p', v: c }); i++; continue; }
    return null;
  }
  return toks;
}

const CMP: { [op: string]: string } = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };

class ExprParser {
  private pos = 0;
  private made: B[] = [];
  constructor(private ws: WS, private toks: Tok[]) {}

  parse(): B | null {
    const b = this.or();
    if (!b || this.pos !== this.toks.length) return this.fail();
    return b;
  }

  private fail(): null {
    for (const b of this.made) if (!(b as { disposed?: boolean }).disposed) b.dispose(false);
    this.made = [];
    return null;
  }
  private make(type: string): B { const b = makeBlock(this.ws, type); this.made.push(b); return b; }
  private peek(): Tok | undefined { return this.toks[this.pos]; }
  private isId(v: string): boolean { const t = this.peek(); return !!t && t.t === 'id' && t.v === v; }

  private or(): B | null {
    let left = this.and();
    if (!left) return null;
    while (this.isId('or')) {
      this.pos++;
      const right = this.and();
      if (!right) return null;
      const b = this.make('logic_operation');
      b.setFieldValue('OR', 'OP');
      b.getInput('A')!.connection!.connect(left.outputConnection!);
      b.getInput('B')!.connection!.connect(right.outputConnection!);
      left = b;
    }
    return left;
  }
  private and(): B | null {
    let left = this.not();
    if (!left) return null;
    while (this.isId('and')) {
      this.pos++;
      const right = this.not();
      if (!right) return null;
      const b = this.make('logic_operation');
      b.setFieldValue('AND', 'OP');
      b.getInput('A')!.connection!.connect(left.outputConnection!);
      b.getInput('B')!.connection!.connect(right.outputConnection!);
      left = b;
    }
    return left;
  }
  private not(): B | null {
    if (this.isId('not')) {
      this.pos++;
      const operand = this.not();
      if (!operand) return null;
      const b = this.make('logic_negate');
      b.getInput('BOOL')!.connection!.connect(operand.outputConnection!);
      return b;
    }
    return this.comparison();
  }
  private comparison(): B | null {
    let left = this.add();
    if (!left) return null;
    let t = this.peek();
    while (t && t.t === 'op' && CMP[t.v]) {
      this.pos++;
      const right = this.add();
      if (!right) return null;
      const b = this.make('logic_compare');
      b.setFieldValue(CMP[t.v], 'OP');
      b.getInput('A')!.connection!.connect(left.outputConnection!);
      b.getInput('B')!.connection!.connect(right.outputConnection!);
      left = b;
      t = this.peek();
    }
    return left;
  }
  private add(): B | null {
    let left = this.mul();
    if (!left) return null;
    let t = this.peek();
    while (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
      this.pos++;
      const right = this.mul();
      if (!right) return null;
      const b = this.make('math_arithmetic');
      b.setFieldValue(t.v === '+' ? 'ADD' : 'MINUS', 'OP');
      b.getInput('A')!.connection!.connect(left.outputConnection!);
      b.getInput('B')!.connection!.connect(right.outputConnection!);
      left = b;
      t = this.peek();
    }
    return left;
  }
  private mul(): B | null {
    let left = this.unary();
    if (!left) return null;
    let t = this.peek();
    while (t && t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) {
      this.pos++;
      const right = this.unary();
      if (!right) return null;
      let b: B;
      if (t.v === '%') {
        b = this.make('math_modulo');
        b.getInput('DIVIDEND')!.connection!.connect(left.outputConnection!);
        b.getInput('DIVISOR')!.connection!.connect(right.outputConnection!);
      } else {
        b = this.make('math_arithmetic');
        b.setFieldValue(t.v === '*' ? 'MULTIPLY' : 'DIVIDE', 'OP');
        b.getInput('A')!.connection!.connect(left.outputConnection!);
        b.getInput('B')!.connection!.connect(right.outputConnection!);
      }
      left = b;
      t = this.peek();
    }
    return left;
  }
  private unary(): B | null {
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '-') {
      this.pos++;
      const n = this.peek();
      if (n && n.t === 'num') {
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
    return this.atom();
  }
  private atom(): B | null {
    const t = this.peek();
    if (!t) return null;
    if (t.t === 'p' && t.v === '(') {
      this.pos++;
      const e = this.or();
      const c = this.peek();
      if (!e || !c || c.v !== ')') return null;
      this.pos++;
      return e;
    }
    if (t.t === 'num') { this.pos++; const b = this.make('math_number'); b.setFieldValue(t.v, 'NUM'); return b; }
    if (t.t === 'str') { this.pos++; const b = this.make('text'); b.setFieldValue(t.v, 'TEXT'); return b; }
    if (t.t === 'id') {
      this.pos++;
      if (t.v === 'True' || t.v === 'False') {
        const b = this.make('logic_boolean');
        b.setFieldValue(t.v === 'True' ? 'TRUE' : 'FALSE', 'BOOL');
        return b;
      }
      const nx = this.peek();
      if (nx && nx.v === '(') return this.call(t.v);
      if (t.v.includes('.')) return null;   // dotted non-call is unsupported
      const b = this.make('variables_get');
      b.getField('VAR')!.setValue(getVarId(this.ws, t.v));
      return b;
    }
    return null;
  }
  private call(name: string): B | null {
    this.pos++;   // consume '('
    // Collect raw argument text up to the matching ')'.
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
    if (name === 'GPIO.input' && /^\d+$/.test(parts.join(''))) {
      const b = this.make('rpi_digital_read');
      b.setFieldValue(parts.join(''), 'PIN');
      return b;
    }
    return null;   // other calls unsupported as values
  }
}

function parseExpression(ws: WS, expr: string): B | null {
  const toks = tokenize(expr.trim());
  if (!toks || toks.length === 0) return null;
  return new ExprParser(ws, toks).parse();
}

function attachExpr(ws: WS, parent: B, input: string, expr: string): boolean {
  const v = parseExpression(ws, expr);
  if (!v) return false;
  parent.getInput(input)!.connection!.connect(v.outputConnection!);
  return true;
}

// ---- Indentation-aware statement parser ----

interface Line { indent: number; text: string; }

type Unit =
  | { kind: 'simple'; text: string }
  | { kind: 'if'; branches: { cond: string; body: Unit[] }[]; elseBody: Unit[] | null }
  | { kind: 'while'; cond: string; body: Unit[] }
  | { kind: 'for'; varName: string; iter: string; body: Unit[] }
  | { kind: 'def'; name: string; params: string[]; body: Unit[] }
  | { kind: 'try'; body: Unit[] };

// Split into logical lines with indentation, dropping comments and blanks.
function toLines(code: string): Line[] {
  const out: Line[] = [];
  for (const raw of code.replace(/\r\n?/g, '\n').split('\n')) {
    const noComment = stripComment(raw);
    if (!noComment.trim()) continue;
    const indent = noComment.length - noComment.replace(/^[ \t]+/, '').length;
    out.push({ indent, text: noComment.trim() });
  }
  return out;
}

// Remove a trailing # comment, respecting quotes.
function stripComment(line: string): string {
  let inStr = false, q = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) { if (c === q && line[i - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '#') return line.slice(0, i);
  }
  return line;
}

const HEADER_RE = /^(if|elif|else|while|for|def|try|except|finally)\b/;

function parseBlock(lines: Line[], start: number, indent: number): [Unit[], number] {
  const units: Unit[] = [];
  let i = start;
  while (i < lines.length && lines[i].indent === indent) {
    const text = lines[i].text;
    const h = HEADER_RE.exec(text);
    if (h && text.endsWith(':')) {
      const kw = h[1];
      // Parse this header's indented body.
      const readBody = (from: number): [Unit[], number] => {
        if (from < lines.length && lines[from].indent > indent) {
          return parseBlock(lines, from, lines[from].indent);
        }
        return [[], from];
      };
      const [body, ni] = readBody(i + 1);
      i = ni;
      if (kw === 'if') {
        const branches = [{ cond: text.slice(2, -1).trim(), body }];
        let elseBody: Unit[] | null = null;
        for (;;) {
          if (i >= lines.length || lines[i].indent !== indent) break;
          const t = lines[i].text;
          if (/^elif\b/.test(t) && t.endsWith(':')) {
            const [eb, n2] = readBody(i + 1);
            branches.push({ cond: t.slice(4, -1).trim(), body: eb });
            i = n2;
          } else if (/^else\s*:$/.test(t)) {
            const [eb, n2] = readBody(i + 1);
            elseBody = eb; i = n2; break;
          } else break;
        }
        units.push({ kind: 'if', branches, elseBody });
      } else if (kw === 'while') {
        units.push({ kind: 'while', cond: text.slice(5, -1).trim(), body });
      } else if (kw === 'for') {
        const m = /^for\s+([A-Za-z_]\w*)\s+in\s+(.+):$/.exec(text);
        if (m) units.push({ kind: 'for', varName: m[1], iter: m[2].trim(), body });
        else units.push({ kind: 'simple', text });   // unrecognised for-form → skipped later
      } else if (kw === 'def') {
        const m = /^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:$/.exec(text);
        const params = m && m[2].trim() ? m[2].split(',').map(p => p.trim()) : [];
        units.push({ kind: 'def', name: m ? m[1] : '', params, body });
      } else if (kw === 'try') {
        units.push({ kind: 'try', body });
      }
      // else: a stray elif/else/except/finally continuation — its body was already
      // consumed above; drop it (the cleanup scaffold isn't represented as blocks).
    } else {
      units.push({ kind: 'simple', text });
      i++;
    }
  }
  return [units, i];
}

function parseModule(code: string): Unit[] {
  const lines = toLines(code);
  const [units] = parseBlock(lines, 0, lines.length ? lines[0].indent : 0);
  return units;
}

// ---- Statement → block ----

function simpleStmt(ws: WS, stmt: string): B | null {
  let m: RegExpMatchArray | null;

  if ((m = stmt.match(/^GPIO\.setup\(\s*(\d+)\s*,\s*GPIO\.(OUT|IN)\s*(?:,\s*pull_up_down\s*=\s*GPIO\.(PUD_UP|PUD_DOWN)\s*)?\)$/))) {
    const b = makeBlock(ws, 'rpi_pin_setup');
    b.setFieldValue(m[1], 'PIN');
    b.setFieldValue(m[3] === 'PUD_UP' ? 'IN_PUD_UP' : m[3] === 'PUD_DOWN' ? 'IN_PUD_DOWN' : m[2], 'MODE');
    return b;
  }
  if ((m = stmt.match(/^GPIO\.output\(\s*(\d+)\s*,\s*(GPIO\.HIGH|GPIO\.LOW|True|False|1|0)\s*\)$/))) {
    const b = makeBlock(ws, 'rpi_digital_write');
    b.setFieldValue(m[1], 'PIN');
    const hi = m[2] === 'GPIO.HIGH' || m[2] === 'True' || m[2] === '1';
    b.setFieldValue(hi ? 'HIGH' : 'LOW', 'VALUE');
    return b;
  }
  if ((m = stmt.match(/^time\.sleep\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'rpi_sleep');
    if (!attachExpr(ws, b, 'SECONDS', m[1])) { b.dispose(false); return null; }
    return b;
  }
  if (stmt.match(/^GPIO\.cleanup\(\s*\)$/)) return makeBlock(ws, 'rpi_cleanup');
  if ((m = stmt.match(/^print\((.*)\)$/))) {
    const b = makeBlock(ws, 'text_print');
    const arg = m[1].trim();
    if (arg && !attachExpr(ws, b, 'TEXT', arg)) { b.dispose(false); return null; }
    return b;
  }
  // name += expr  → change variable by
  if ((m = stmt.match(/^([A-Za-z_]\w*)\s*\+=\s*(.+)$/))) {
    const b = makeBlock(ws, 'math_change', x => x.getField('VAR')!.setValue(getVarId(ws, m![1])));
    if (!attachExpr(ws, b, 'DELTA', m[2])) { b.dispose(false); return null; }
    return b;
  }
  // name = expr  → set variable
  if ((m = stmt.match(/^([A-Za-z_]\w*)\s*=\s*(?!=)(.+)$/))) {
    const b = makeBlock(ws, 'variables_set', x => x.getField('VAR')!.setValue(getVarId(ws, m![1])));
    if (!attachExpr(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
    return b;
  }
  return null;
}

function buildIf(ws: WS, u: Extract<Unit, { kind: 'if' }>, skipped: string[]): B | null {
  const conds = u.branches.map(br => parseExpression(ws, br.cond));
  if (conds.some(c => !c)) { conds.forEach(c => c?.dispose(false)); return null; }
  const b = makeBlock(ws, 'controls_if', x => {
    const extra: { elseIfCount?: number; hasElse?: boolean } = {};
    if (u.branches.length > 1) extra.elseIfCount = u.branches.length - 1;
    if (u.elseBody) extra.hasElse = true;
    if (extra.elseIfCount || extra.hasElse) {
      (x as unknown as { loadExtraState?: (s: object) => void }).loadExtraState?.(extra);
    }
  });
  u.branches.forEach((br, idx) => {
    b.getInput('IF' + idx)!.connection!.connect(conds[idx]!.outputConnection!);
    buildBody(ws, br.body, b.getInput('DO' + idx)!.connection!, skipped);
  });
  if (u.elseBody) {
    const elseInput = b.getInput('ELSE');
    if (elseInput) buildBody(ws, u.elseBody, elseInput.connection!, skipped);
  }
  return b;
}

function buildWhile(ws: WS, u: Extract<Unit, { kind: 'while' }>, skipped: string[]): B | null {
  const cond = parseExpression(ws, u.cond);
  if (!cond) return null;
  const b = makeBlock(ws, 'controls_whileUntil');
  b.setFieldValue('WHILE', 'MODE');
  b.getInput('BOOL')!.connection!.connect(cond.outputConnection!);
  buildBody(ws, u.body, b.getInput('DO')!.connection!, skipped);
  return b;
}

function buildFor(ws: WS, u: Extract<Unit, { kind: 'for' }>, skipped: string[]): B | null {
  const m = u.iter.match(/^range\(\s*(.+)\s*\)$/);
  if (!m) return null;
  const args = m[1].split(',').map(s => s.trim());
  let fromE = '0', toE: string, byE = '1';
  if (args.length === 1) { toE = args[0]; }
  else if (args.length === 2) { fromE = args[0]; toE = args[1]; }
  else if (args.length === 3) { fromE = args[0]; toE = args[1]; byE = args[2]; }
  else return null;
  // range() upper bound is exclusive; Blockly's is inclusive → subtract 1.
  toE = /^-?\d+$/.test(toE) ? String(parseInt(toE, 10) - 1) : `${toE} - 1`;
  const b = makeBlock(ws, 'controls_for', x => x.getField('VAR')!.setValue(getVarId(ws, u.varName)));
  if (!attachExpr(ws, b, 'FROM', fromE) || !attachExpr(ws, b, 'TO', toE) || !attachExpr(ws, b, 'BY', byE)) {
    b.dispose(false); return null;
  }
  buildBody(ws, u.body, b.getInput('DO')!.connection!, skipped);
  return b;
}

function buildBody(ws: WS, units: Unit[], firstConn: Blockly.Connection, skipped: string[]): void {
  let prev: Blockly.Connection | null = firstConn;
  for (const u of units) {
    let block: B | null = null;
    if (u.kind === 'simple') block = simpleStmt(ws, u.text);
    else if (u.kind === 'if') block = buildIf(ws, u, skipped);
    else if (u.kind === 'while') block = buildWhile(ws, u, skipped);
    else if (u.kind === 'for') block = buildFor(ws, u, skipped);
    // def/try inside a body are not supported as nested blocks

    if (!block) {
      const text = u.kind === 'simple' ? u.text
        : u.kind === 'if' ? `if ${u.branches[0].cond}: …`
        : u.kind === 'for' ? `for ${u.varName} in ${u.iter}: …`
        : u.kind === 'while' ? `while ${u.cond}: …`
        : u.kind === 'def' ? `def ${u.name}(…): …`
        : 'try: …';
      skipped.push(truncate(text));
      continue;
    }
    prev!.connect(block.previousConnection!);
    prev = block.nextConnection;
  }
}

// ---- Top-level routing (structure detection) ----

const isImport = (s: string): boolean => /^(import|from)\s/.test(s);
const isSetmode = (s: string): boolean => /^GPIO\.setmode\(/.test(s);
// Artefacts our own generator emits (helper defs/objects start with an underscore).
const isHelper = (s: string): boolean => /^_\w/.test(s);

// Find a `while True:` unit inside a list (used to lift the main loop out of try/…).
function findLoop(units: Unit[]): Unit[] | null {
  for (const u of units) {
    if (u.kind === 'while' && /^True$/.test(u.cond)) return u.body;
    if (u.kind === 'try') { const inner = findLoop(u.body); if (inner) return inner; }
  }
  return null;
}

export function parsePythonToWorkspace(workspace: WS, code: string): ImportResult {
  workspace.clear();
  const skipped: string[] = [];
  const units = parseModule(code);

  const setupUnits: Unit[] = [];
  const funcDefs: Extract<Unit, { kind: 'def' }>[] = [];
  let loopUnits: Unit[] | null = null;

  for (const u of units) {
    if (u.kind === 'simple') {
      if (isImport(u.text) || isSetmode(u.text) || isHelper(u.text)) continue;
      setupUnits.push(u);
    } else if (u.kind === 'while' && /^True$/.test(u.cond)) {
      loopUnits = u.body;
    } else if (u.kind === 'try') {
      const inner = findLoop([u]);
      if (inner) loopUnits = inner;
      // non-loop statements inside try are dropped (they're our cleanup scaffold)
    } else if (u.kind === 'def') {
      if (!isHelper(u.name)) funcDefs.push(u);
    } else {
      setupUnits.push(u);   // top-level if/for/while(non-True) → part of setup
    }
  }

  let count = 0;

  // User functions become procedure definitions off to the side.
  let fy = 40;
  for (const f of funcDefs) {
    const def = makeBlock(workspace, 'procedures_defnoreturn', x => x.setFieldValue(f.name, 'NAME'));
    if (f.params.length) {
      (def as unknown as { loadExtraState: (s: object) => void }).loadExtraState({ params: f.params.map(name => ({ name })) });
    }
    def.moveBy(360, fy); fy += 160;
    buildBody(workspace, f.body, def.getInput('STACK')!.connection!, skipped);
    count++;
  }

  // on-start container
  const setup = makeBlock(workspace, 'rpi_setup');
  setup.moveBy(40, 40);
  buildBody(workspace, setupUnits, setup.getInput('DO')!.connection!, skipped);

  // repeat-forever container (only when a main loop was found)
  if (loopUnits) {
    const loop = makeBlock(workspace, 'rpi_loop');
    loop.moveBy(40, 260);
    buildBody(workspace, loopUnits, loop.getInput('DO')!.connection!, skipped);
  }

  // Count the statement blocks actually created (everything with a previous connection).
  count += workspace.getAllBlocks(false).filter(b => b.previousConnection).length;

  return { imported: count, skipped };
}

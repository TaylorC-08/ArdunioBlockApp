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

const KNOWN_BAUDS = new Set(['9600', '19200', '31250', '38400', '57600', '115200']);

// User-defined functions found in the sketch: name -> { returns a value?, parameter names }.
// Populated before setup()/loop() bodies are built so call sites can be resolved.
interface UserFunc { ret: boolean; params: string[]; }
let userFuncs = new Map<string, UserFunc>();

// String methods that mutate in place and appear as statements.
const STR_VOID_METHODS = new Set(['trim', 'toUpperCase', 'toLowerCase', 'replace', 'setCharAt', 'concat', 'reserve']);

// String methods that return a value (used in expressions).
const STR_VALUE_METHODS = new Set([
  'length', 'toInt', 'charAt', 'substring', 'indexOf', 'lastIndexOf',
  'equals', 'equalsIgnoreCase', 'compareTo', 'startsWith', 'endsWith',
]);

// C type names recognized as a cast, e.g. (char)x.
const CAST_TYPES = new Set([
  'char', 'byte', 'int', 'long', 'short', 'float', 'double', 'bool', 'boolean', 'word',
  'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t',
]);

// Arduino character-classification functions, mapped to the arduino_char_type block.
const CHAR_TYPE_FUNCS = new Set([
  'isAlphaNumeric', 'isAlpha', 'isAscii', 'isWhitespace', 'isControl', 'isDigit',
  'isGraph', 'isLowerCase', 'isPrintable', 'isPunct', 'isSpace', 'isUpperCase', 'isHexadecimalDigit',
]);

// Create + render a block. `before` runs after creation but before initSvg, so
// variable fields can be set without spawning a stray default variable.
function makeBlock(ws: WS, type: string, before?: (b: B) => void): B {
  const b = ws.newBlock(type) as B;
  if (before) before(b);
  if (typeof b.initSvg === 'function') { b.initSvg(); b.render(); }  // headless workspaces have no SVG
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

interface Tok { t: 'num' | 'str' | 'char' | 'id' | 'op' | 'p'; v: string; }

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
    if (c === "'") {                            // char literal, e.g. 'H' or '\n'
      let j = i + 1, ch = '';
      while (j < s.length && s[j] !== "'") {
        if (s[j] === '\\' && j + 1 < s.length) { ch += s[j] + s[j + 1]; j += 2; continue; }
        ch += s[j]; j++;
      }
      if (j >= s.length) return null;           // unterminated char literal
      toks.push({ t: 'char', v: ch }); i = j + 1; continue;
    }
    if (c === '0' && (s[i + 1] === 'x' || s[i + 1] === 'X')) {   // hex literal -> decimal
      let j = i + 2; while (j < s.length && /[0-9a-fA-F]/.test(s[j])) j++;
      toks.push({ t: 'num', v: String(parseInt(s.slice(i, j), 16)) }); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: 'num', v: s.slice(i, j) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      // allow dotted member access (e.g. Serial.available) as a single identifier
      while (s[j] === '.' && /[A-Za-z_]/.test(s[j + 1] || '')) {
        j++; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      }
      toks.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
    }
    const two = s.slice(i, i + 2);
    if (ops2.includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/%<>!='.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    if ('(),[]'.includes(c)) { toks.push({ t: 'p', v: c }); i++; continue; }
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
        const [type, val] = BIN[t.v];
        b = this.make(type);
        b.setFieldValue(val, 'OP');
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
      // C cast: (type) expr  — a single type keyword followed by ')'
      const nt = this.peek();
      if (nt && nt.t === 'id' && CAST_TYPES.has(nt.v) && this.toks[this.pos + 1] && this.toks[this.pos + 1].v === ')') {
        this.pos += 2;                            // consume type and ')'
        const operand = this.unary();
        if (!operand) return null;
        const b = this.make('arduino_cast');
        b.setFieldValue(nt.v, 'TYPE');
        b.getInput('VALUE')!.connection!.connect(operand.outputConnection!);
        return b;
      }
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
    if (t.t === 'char') {
      this.pos++;
      const b = this.make('arduino_char');
      b.setFieldValue(t.v, 'CHAR');               // keep escapes as-is (e.g. \n)
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
      if (nx && nx.v === '[') return this.arrayAccess(t.v);
      if (t.v.includes('.')) return null;          // dotted non-call (e.g. obj.field) is unsupported
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
    if (name === 'Serial.available' || name === 'Serial.read' || name === 'Serial.parseInt') {
      const c = this.peek();
      if (!c || c.v !== ')') return null;
      this.pos++;
      const type = name === 'Serial.available' ? 'arduino_serial_available'
        : name === 'Serial.read' ? 'arduino_serial_read'
        : 'arduino_serial_parse_int';
      return this.make(type);
    }
    if (name === 'map') {
      const args = this.args();
      if (!args || args.length !== 5) return null;
      const b = this.make('arduino_map');
      const names = ['VALUE', 'FROM_LOW', 'FROM_HIGH', 'TO_LOW', 'TO_HIGH'];
      args.forEach((a, idx) => b.getInput(names[idx])!.connection!.connect(a.outputConnection!));
      return b;
    }
    if (name === 'abs') {
      const args = this.args();
      if (!args || args.length !== 1) return null;
      const b = this.make('math_single');
      b.setFieldValue('ABS', 'OP');
      b.getInput('NUM')!.connection!.connect(args[0].outputConnection!);
      return b;
    }
    if (name === 'constrain') {
      const args = this.args();
      if (!args || args.length !== 3) return null;
      const b = this.make('math_constrain');
      ['VALUE', 'LOW', 'HIGH'].forEach((n, idx) => b.getInput(n)!.connection!.connect(args[idx].outputConnection!));
      return b;
    }
    if (CHAR_TYPE_FUNCS.has(name)) {
      const args = this.args();
      if (!args || args.length !== 1) return null;
      const b = this.make('arduino_char_type');
      b.setFieldValue(name, 'FUNC');
      b.getInput('CHAR')!.connection!.connect(args[0].outputConnection!);
      return b;
    }
    if (name === 'pulseIn') {
      // pin (raw text) and a HIGH/LOW state; an optional timeout arg is unsupported.
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
      const comma = parts.indexOf(',');
      if (comma < 0) return null;
      const pin = parts.slice(0, comma).join('');
      const state = parts.slice(comma + 1).join('');
      if (state !== 'HIGH' && state !== 'LOW') return null;
      const b = this.make('arduino_pulse_in');
      b.setFieldValue(pin, 'PIN');
      b.setFieldValue(state, 'STATE');
      return b;
    }
    if (name === 'random') {
      const args = this.args();
      // random(max) -> [0, max); random(min, max) -> [min, max). Blockly's block is inclusive,
      // so subtract 1 from the exclusive upper bound to match.
      if (args && (args.length === 1 || args.length === 2)) {
        const b = this.make('math_random_int');
        const lo = args.length === 2 ? args[0] : this.make('math_number');
        if (args.length === 1) (lo as B).setFieldValue('0', 'NUM');
        const hiSrc = args[args.length - 1];
        const minus = this.make('math_arithmetic');
        minus.setFieldValue('MINUS', 'OP');
        const one = this.make('math_number'); one.setFieldValue('1', 'NUM');
        minus.getInput('A')!.connection!.connect(hiSrc.outputConnection!);
        minus.getInput('B')!.connection!.connect(one.outputConnection!);
        b.getInput('FROM')!.connection!.connect(lo.outputConnection!);
        b.getInput('TO')!.connection!.connect(minus.outputConnection!);
        return b;
      }
      return null;
    }
    if (name === 'String') {                      // String() / String(x) / String(x, fmt) constructor
      const args = this.args();
      if (!args) return null;
      if (args.length === 0) return this.make('arduino_string');   // empty String -> String("")
      if (args.length === 1) {
        const b = this.make('arduino_string');
        b.getInput('VALUE')!.connection!.connect(args[0].outputConnection!);
        return b;
      }
      if (args.length === 2) {
        const b = this.make('arduino_string_fmt');
        b.getInput('VALUE')!.connection!.connect(args[0].outputConnection!);
        b.getInput('FMT')!.connection!.connect(args[1].outputConnection!);
        return b;
      }
      return null;
    }
    if (name.includes('.')) {                      // obj.method(...) used as a value
      const dot = name.lastIndexOf('.');
      const obj = name.slice(0, dot), method = name.slice(dot + 1);
      if (obj.includes('.') || !/^[A-Za-z_]\w*$/.test(obj)) return null;
      if (STR_VALUE_METHODS.has(method)) return this.stringValueMethod(obj, method);
      // generic library/device value call, e.g. Mouse.isPressed(x), Serial1.read()
      const args = this.args();
      if (!args || args.length > 3) return null;
      const b = this.make('arduino_lib_value');
      b.setFieldValue(obj, 'OBJ');
      b.setFieldValue(method, 'METHOD');
      args.forEach((a, i) => b.getInput('ARG' + i)!.connection!.connect(a.outputConnection!));
      return b;
    }

    const uf = userFuncs.get(name);
    if (uf && uf.ret) {                           // call to a value-returning user function
      const args = this.args();
      if (!args || args.length !== uf.params.length) return null;
      const b = this.make('procedures_callreturn');
      (b as unknown as { loadExtraState: (s: object) => void }).loadExtraState({ name, params: uf.params });
      args.forEach((a, i) => b.getInput('ARG' + i)!.connection!.connect(a.outputConnection!));
      return b;
    }
    return null;                                 // unsupported function call
  }

  // Parse name[expr] or name[expr][expr] into an array-get block.
  private arrayAccess(name: string): B | null {
    this.pos++;                                  // consume first '['
    const idx1 = this.binary(() => this.and(), ['||']);
    if (!idx1) return null;
    let c = this.peek();
    if (!c || c.v !== ']') return null;
    this.pos++;
    let idx2: B | null = null;
    if (this.peek() && this.peek()!.v === '[') {
      this.pos++;
      idx2 = this.binary(() => this.and(), ['||']);
      if (!idx2) return null;
      c = this.peek();
      if (!c || c.v !== ']') return null;
      this.pos++;
    }
    if (idx2) {
      const b = this.make('arduino_array_get2');
      b.setFieldValue(name, 'ARRAY');
      b.getInput('INDEX')!.connection!.connect(idx1.outputConnection!);
      b.getInput('INDEX2')!.connection!.connect(idx2.outputConnection!);
      return b;
    }
    const b = this.make('arduino_array_get');
    b.setFieldValue(name, 'ARRAY');
    b.getInput('INDEX')!.connection!.connect(idx1.outputConnection!);
    return b;
  }

  // obj.method(args) where the result is used as a value (the '(' is already consumed).
  private stringValueMethod(obj: string, method: string): B | null {
    const args = this.args();
    if (!args) return null;
    const objBlock = (): B => {
      const g = this.make('variables_get');
      g.getField('VAR')!.setValue(getVarId(this.ws, obj));
      return g;
    };
    // type, the value-input names for each arg, and the min/max accepted arg count.
    const build = (type: string, inputs: string[], min: number, max: number): B | null => {
      if (args.length < min || args.length > max) return null;
      const b = this.make(type);
      b.getInput('STR')!.connection!.connect(objBlock().outputConnection!);
      args.forEach((a, i) => b.getInput(inputs[i])!.connection!.connect(a.outputConnection!));
      return b;
    };
    switch (method) {
      case 'length':            return build('arduino_str_length', [], 0, 0);
      case 'toInt':             return build('arduino_str_toint', [], 0, 0);
      case 'charAt':            return build('arduino_str_charat', ['INDEX'], 1, 1);
      case 'substring':         return build('arduino_str_substring', ['START', 'END'], 1, 2);
      case 'indexOf': case 'lastIndexOf': {
        const b = build('arduino_str_indexof', ['SUB', 'FROM'], 1, 2);
        if (b) b.setFieldValue(method, 'DIR');
        return b;
      }
      case 'equals': case 'equalsIgnoreCase': case 'compareTo':
      case 'startsWith': case 'endsWith': {
        const b = build('arduino_str_compare', ['ARG', 'ARG2'], 1, 2);
        if (b) b.setFieldValue(method, 'METHOD');
        return b;
      }
      default: return null;
    }
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

// A bare variable declaration with no initializer or call, e.g. `int x;`, `byte b;`,
// `long a, b, c;`. These carry no runtime behavior on their own (the variable is
// declared globally when first used), so the importer drops them rather than skipping.
function isPureDeclaration(stmt: string): boolean {
  if (stmt.includes('=') || stmt.includes('(') || stmt.includes('[')) return false;
  return /^(?:(?:const|static|volatile|unsigned)\s+)*(?:int|long|short|byte|char|float|double|bool|boolean|word|size_t|uint8_t|uint16_t|uint32_t|String)\b\s+[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*$/.test(stmt);
}

// Build a single non-control statement block, or null if unsupported.
function simpleStmt(ws: WS, stmt: string): B | null {
  let m: RegExpMatchArray | null;

  // arr[i] = expr  or  arr[i][j] = expr  -> array set (checked before plain assignment)
  if ((m = stmt.match(/^([A-Za-z_]\w*)\s*\[([^\]]*)\](?:\s*\[([^\]]*)\])?\s*=\s*(?!=)(.+)$/))) {
    const name = m[1], idx1 = m[2], idx2 = m[3], val = m[4];
    const b = makeBlock(ws, idx2 !== undefined ? 'arduino_array_set2' : 'arduino_array_set');
    b.setFieldValue(name, 'ARRAY');
    const ok = attachExpr(ws, b, 'INDEX', idx1)
      && (idx2 === undefined || attachExpr(ws, b, 'INDEX2', idx2))
      && attachExpr(ws, b, 'VALUE', val);
    if (!ok) { b.dispose(false); return null; }
    return b;
  }

  const asn = topLevelAssign(stmt);
  if (asn) {
    const b = makeBlock(ws, 'variables_set', x => x.getField('VAR')!.setValue(getVarId(ws, asn.name)));
    if (!attachExpr(ws, b, 'VALUE', asn.rhs)) { b.dispose(false); return null; }
    return b;
  }

  if (stmt === 'break' || stmt === 'continue') {
    const b = makeBlock(ws, 'controls_flow_statements');
    b.setFieldValue(stmt === 'break' ? 'BREAK' : 'CONTINUE', 'FLOW');
    return b;
  }
  // while (cond) with an empty body, e.g. the `while (true);` halt at the end of the String demos
  if ((m = stmt.match(/^while\s*\(\s*(.+?)\s*\)$/))) {
    const cond = parseExpression(ws, m[1]);
    if (!cond) return null;
    const b = makeBlock(ws, 'controls_whileUntil');
    b.setFieldValue('WHILE', 'MODE');
    b.getInput('BOOL')!.connection!.connect(cond.outputConnection!);
    return b;
  }

  // x++ / ++x / x-- / --x  ->  change var by ±1
  if ((m = stmt.match(/^(?:(\+\+|--)\s*([A-Za-z_]\w*)|([A-Za-z_]\w*)\s*(\+\+|--))$/))) {
    const name = m[2] || m[3];
    const op   = m[1] || m[4];
    const b = makeBlock(ws, 'math_change', x => x.getField('VAR')!.setValue(getVarId(ws, name)));
    const num = makeBlock(ws, 'math_number');
    num.setFieldValue(op === '++' ? '1' : '-1', 'NUM');
    b.getInput('DELTA')!.connection!.connect(num.outputConnection!);
    return b;
  }
  // x += expr / x -= expr / x *= expr / x /= expr  (works for numbers and String append)
  if ((m = stmt.match(/^([A-Za-z_]\w*)\s*([+\-*/])=\s*(.+)$/))) {
    const b = makeBlock(ws, 'arduino_compound_assign', x => x.getField('VAR')!.setValue(getVarId(ws, m![1])));
    b.setFieldValue(m[2] + '=', 'OP');
    if (!attachExpr(ws, b, 'VALUE', m[3])) { b.dispose(false); return null; }
    return b;
  }

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
  if ((m = stmt.match(/^digitalWrite\(\s*([^,]+?)\s*,\s*(.+)\)$/))) {     // value is a variable/expression
    const b = makeBlock(ws, 'arduino_digital_write_expr');
    b.setFieldValue(m[1], 'PIN');
    if (!attachExpr(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
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
  if (stmt.match(/^Serial\.println\(\s*\)$/)) {                  // bare newline, no value
    return makeBlock(ws, 'arduino_serial_println');
  }
  if ((m = stmt.match(/^Serial\.(print|println)\(\s*(.+?)\s*,\s*(DEC|HEX|OCT|BIN)\s*\)$/))) {
    const b = makeBlock(ws, 'arduino_serial_print_format');
    b.setFieldValue(m[1], 'LN');
    b.setFieldValue(m[3], 'FORMAT');
    if (!attachExpr(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^Serial\.write\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, 'arduino_serial_write');
    if (!attachExpr(ws, b, 'VALUE', m[1])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^Serial\.(print|println)\(\s*(.+)\)$/))) {
    const b = makeBlock(ws, m[1] === 'println' ? 'arduino_serial_println' : 'arduino_serial_print');
    if (!attachExpr(ws, b, 'VALUE', m[2])) { b.dispose(false); return null; }
    return b;
  }
  if ((m = stmt.match(/^tone\(\s*([^,]+?)\s*,\s*(.+)\)$/))) {
    const rest = splitTop(m[2], ',').map(s => s.trim());
    if (rest.length === 1 || rest.length === 2) {
      const b = makeBlock(ws, 'arduino_tone');
      b.setFieldValue(m[1], 'PIN');
      if (!attachExpr(ws, b, 'FREQ', rest[0])) { b.dispose(false); return null; }
      if (rest.length === 2 && !attachExpr(ws, b, 'DURATION', rest[1])) { b.dispose(false); return null; }
      return b;
    }
  }
  if ((m = stmt.match(/^noTone\(\s*([^)]+?)\s*\)$/))) {
    const b = makeBlock(ws, 'arduino_no_tone');
    b.setFieldValue(m[1], 'PIN');
    return b;
  }
  // String mutating methods used as statements, e.g. s.trim(), s.replace("a","b")
  if ((m = stmt.match(/^([A-Za-z_]\w*)\.([A-Za-z]+)\((.*)\)$/)) && STR_VOID_METHODS.has(m[2])) {
    const obj = m[1], method = m[2];
    const argStrs = m[3].trim() === '' ? [] : splitTop(m[3], ',').map(s => s.trim());
    const str = makeBlock(ws, 'variables_get', x => x.getField('VAR')!.setValue(getVarId(ws, obj)));
    let b: B;
    if (method === 'trim' || method === 'toUpperCase' || method === 'toLowerCase') {
      if (argStrs.length !== 0) { str.dispose(false); return null; }
      b = makeBlock(ws, 'arduino_str_void');
      b.setFieldValue(method, 'METHOD');
    } else {
      const spec: { [k: string]: [string, string[]] } = {
        replace: ['arduino_str_replace', ['FIND', 'REP']],
        setCharAt: ['arduino_str_setcharat', ['INDEX', 'CHAR']],
        concat: ['arduino_str_concat', ['VALUE']],
        reserve: ['arduino_str_reserve', ['N']],
      };
      const [type, inputs] = spec[method];
      if (argStrs.length !== inputs.length) { str.dispose(false); return null; }
      b = makeBlock(ws, type);
      for (let i = 0; i < inputs.length; i++) {
        if (!attachExpr(ws, b, inputs[i], argStrs[i])) { b.dispose(false); str.dispose(false); return null; }
      }
    }
    b.getInput('STR')!.connection!.connect(str.outputConnection!);
    return b;
  }
  // call to a user-defined function as a statement, e.g. establishContact() or pulse(p, 2)
  if ((m = stmt.match(/^([A-Za-z_]\w*)\s*\((.*)\)$/)) && userFuncs.has(m[1])) {
    const uf = userFuncs.get(m[1])!;
    const argStrs = m[2].trim() === '' ? [] : splitTop(m[2], ',').map(s => s.trim());
    if (argStrs.length !== uf.params.length) return null;
    const b = makeBlock(ws, 'procedures_callnoreturn');
    (b as unknown as { loadExtraState: (s: object) => void }).loadExtraState({ name: m[1], params: uf.params });
    for (let i = 0; i < argStrs.length; i++) {
      if (!attachExpr(ws, b, 'ARG' + i, argStrs[i])) { b.dispose(false); return null; }
    }
    return b;
  }
  // return [value]  -> return block (early returns inside functions)
  if (stmt === 'return') return makeBlock(ws, 'arduino_return');
  if ((m = stmt.match(/^return\s+(.+)$/))) {
    const b = makeBlock(ws, 'arduino_return');
    if (!attachExpr(ws, b, 'VALUE', m[1])) { b.dispose(false); return null; }
    return b;
  }
  // generic library/device method call as a statement, e.g. Mouse.move(x,y,0), lcd.print("Hi")
  if ((m = stmt.match(/^([A-Za-z_]\w*)\.([A-Za-z]\w*)\((.*)\)$/))) {
    const argStrs = m[3].trim() === '' ? [] : splitTop(m[3], ',').map(s => s.trim());
    if (argStrs.length > 3) return null;
    const b = makeBlock(ws, 'arduino_lib_stmt');
    b.setFieldValue(m[1], 'OBJ');
    b.setFieldValue(m[2], 'METHOD');
    for (let i = 0; i < argStrs.length; i++) {
      if (!attachExpr(ws, b, 'ARG' + i, argStrs[i])) { b.dispose(false); return null; }
    }
    return b;
  }
  return null;
}

// A parsed statement unit from a brace body.
type ElseIf = { cond: string; body: string };
type Unit =
  | { kind: 'simple'; text: string }
  | { kind: 'if'; cond: string; then: string; elifs: ElseIf[]; els: string | null }
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
    const kw = body.slice(i).match(/^(if|for|while|switch)\b/);
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
            const elifs: ElseIf[] = [];
            let els: string | null = null;
            for (;;) {
              const save = i;
              skipWs();
              if (!body.slice(i).match(/^else\b/)) { i = save; break; }
              i += 4; skipWs();
              if (body.slice(i).match(/^if\b/)) {        // else if (cond) { ... }
                let k = i + 2;
                while (k < len && /\s/.test(body[k])) k++;
                if (body[k] !== '(') { i = save; break; } // braceless/odd else-if: leave for fallback
                i = k;
                const econd = readBalanced('(', ')');
                if (econd === null) return null;
                skipWs();
                if (body[i] !== '{') { i = save; break; }
                const eblk = readBalanced('{', '}');
                if (eblk === null) return null;
                elifs.push({ cond: econd, body: eblk });
                continue;
              }
              if (body[i] === '{') { els = readBalanced('{', '}'); if (els === null) return null; }
              else i = save;                              // braceless else: leave for fallback
              break;
            }
            units.push({ kind: 'if', cond: head, then: blk, elifs, els });
          } else if (kw[1] === 'for') {
            units.push({ kind: 'for', header: head, body: blk });
          } else if (kw[1] === 'switch') {
            const ifUnit = switchToIf(head, blk);
            if (!ifUnit) return null;               // malformed switch
            units.push(ifUnit);
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

// Convert a switch statement into an equivalent if / else-if / else chain, e.g.
//   switch (x) { case 0: A; break; case 1: case 2: B; break; default: C; }
//   -> if ((x) == 0) {A} else if ((x) == 1 || (x) == 2) {B} else {C}
// Cases that fall through (no break before the next label) are merged with ||.
function switchToIf(cond: string, block: string): (Unit & { kind: 'if' }) | null {
  // Locate case/default labels at brace/paren depth 0.
  const labels: { val: string | null; labelStart: number; bodyStart: number }[] = [];
  let i = 0, depth = 0, inStr = false;
  const len = block.length;
  while (i < len) {
    const c = block[i];
    if (inStr) { if (c === '"' && block[i - 1] !== '\\') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; i++; continue; }
    if (c === '{' || c === '(') { depth++; i++; continue; }
    if (c === '}' || c === ')') { depth--; i++; continue; }
    if (depth === 0) {
      const cm = block.slice(i).match(/^case\s+([^:]+):/);
      if (cm) { labels.push({ val: cm[1].trim(), labelStart: i, bodyStart: i + cm[0].length }); i += cm[0].length; continue; }
      const dm = block.slice(i).match(/^default\s*:/);
      if (dm) { labels.push({ val: null, labelStart: i, bodyStart: i + dm[0].length }); i += dm[0].length; continue; }
    }
    i++;
  }
  if (labels.length === 0) return null;

  const arms: { conds: string[]; body: string }[] = [];
  let els: string | null = null;
  let pending: string[] = [];                          // case values awaiting a non-empty body (fallthrough)
  for (let k = 0; k < labels.length; k++) {
    const end = k + 1 < labels.length ? labels[k + 1].labelStart : len;
    let seg = block.slice(labels[k].bodyStart, end);
    seg = seg.replace(/\bbreak\s*;\s*$/, '').trim();   // drop the trailing break
    if (labels[k].val === null) { els = seg; continue; }
    if (seg === '' && k + 1 < labels.length) { pending.push(labels[k].val!); continue; } // fall through
    arms.push({ conds: [...pending, labels[k].val!], body: seg });
    pending = [];
  }
  if (arms.length === 0) return null;

  const condOf = (vals: string[]) => vals.map(v => `(${cond}) == ${v}`).join(' || ');
  return {
    kind: 'if',
    cond: condOf(arms[0].conds),
    then: arms[0].body,
    elifs: arms.slice(1).map(a => ({ cond: condOf(a.conds), body: a.body })),
    els,
  };
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

function buildIf(ws: WS, u: { cond: string; then: string; elifs: ElseIf[]; els: string | null }, skipped: string[], counter: Counter): B | null {
  const cond = parseExpression(ws, u.cond);
  if (!cond) return null;
  const elifConds = u.elifs.map(e => parseExpression(ws, e.cond));
  if (elifConds.some(c => !c)) {                         // unparseable else-if condition: bail whole chain
    cond.dispose(false);
    elifConds.forEach(c => c?.dispose(false));
    return null;
  }
  const b = makeBlock(ws, 'controls_if', x => {
    if (u.elifs.length || u.els) {
      const state: { elseIfCount?: number; hasElse?: boolean } = {};
      if (u.elifs.length) state.elseIfCount = u.elifs.length;
      if (u.els) state.hasElse = true;
      (x as unknown as { loadExtraState?: (s: object) => void }).loadExtraState?.(state);
    }
  });
  b.getInput('IF0')!.connection!.connect(cond.outputConnection!);
  buildBody(ws, u.then, b.getInput('DO0')!.connection!, skipped, counter);
  u.elifs.forEach((e, idx) => {
    b.getInput('IF' + (idx + 1))!.connection!.connect(elifConds[idx]!.outputConnection!);
    buildBody(ws, e.body, b.getInput('DO' + (idx + 1))!.connection!, skipped, counter);
  });
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

  const cm = cond.match(/^[A-Za-z_]\w*\s*(<=|<|>=|>)\s*(.+)$/);
  if (!cm) return null;
  const op = cm[1];
  const decreasing = op === '>' || op === '>=';

  let toExpr = cm[2].trim();
  if (op === '<') {                                            // var < bound  ->  var <= bound - 1
    toExpr = /^-?\d+$/.test(toExpr) ? String(parseInt(toExpr, 10) - 1) : `${toExpr} - 1`;
  } else if (op === '>') {                                     // var > bound  ->  var >= bound + 1
    toExpr = /^-?\d+$/.test(toExpr) ? String(parseInt(toExpr, 10) + 1) : `${toExpr} + 1`;
  }

  let by: string | null = null;
  if (/^(?:(?:\+\+|--)\s*[A-Za-z_]\w*|[A-Za-z_]\w*\s*(?:\+\+|--))$/.test(step)) by = '1';
  else { const sm = step.match(/^[A-Za-z_]\w*\s*[+-]=\s*(.+)$/); if (sm) by = sm[1].trim(); }
  if (by === null) return null;                                // unsupported step

  // Increasing loops use the standard controls_for; decreasing loops use a block with an
  // explicit direction (controls_for can't represent counting down with non-literal bounds).
  const b = decreasing
    ? makeBlock(ws, 'arduino_for_dir', x => { x.getField('VAR')!.setValue(getVarId(ws, varName)); x.setFieldValue('down', 'DIR'); })
    : makeBlock(ws, 'controls_for', x => x.getField('VAR')!.setValue(getVarId(ws, varName)));
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
    // A bare declaration with no initializer (e.g. `byte b;`, `int x, y;`) needs no
    // block — the variable is declared globally on first use. Drop it silently.
    if (u.kind === 'simple' && isPureDeclaration(u.text)) continue;
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

// ---- User-defined functions ----

interface FuncDef { name: string; retVoid: boolean; params: string[]; body: string; }

// Scan top-level (brace depth 0) function definitions: `<type> <name>(<params>) { ... }`.
// setup() and loop() are handled separately and excluded.
function extractFunctions(code: string): FuncDef[] {
  const out: FuncDef[] = [];
  const len = code.length;
  let i = 0, depth = 0;
  while (i < len) {
    const c = code[i];
    if (c === '{') { depth++; i++; continue; }
    if (c === '}') { depth--; i++; continue; }
    if (depth === 0 && (i === 0 || /[^\w]/.test(code[i - 1]))) {
      const m = code.slice(i).match(/^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(([^;{}]*)\)\s*\{/);
      if (m && m[2] !== 'setup' && m[2] !== 'loop' && m[1] !== 'return' && m[1] !== 'else') {
        const retType = m[1], name = m[2], paramsRaw = m[3].trim();
        let j = i + m[0].length, d = 1;
        while (j < len && d > 0) { if (code[j] === '{') d++; else if (code[j] === '}') d--; j++; }
        const body = code.slice(i + m[0].length, j - 1);
        const params = paramsRaw === '' || paramsRaw === 'void' ? []
          : paramsRaw.split(',').map(p => p.trim().split(/[\s*&]+/).filter(Boolean).pop()!);
        out.push({ name, retVoid: retType === 'void', params, body });
        i = j; continue;
      }
    }
    i++;
  }
  return out;
}

function buildFunction(ws: WS, f: FuncDef, x: number, y: number, skipped: string[], counter: Counter): void {
  const type = f.retVoid ? 'procedures_defnoreturn' : 'procedures_defreturn';
  const b = makeBlock(ws, type, x2 => x2.setFieldValue(f.name, 'NAME'));
  if (f.params.length) {
    (b as unknown as { loadExtraState: (s: object) => void }).loadExtraState({ params: f.params.map(name => ({ name })) });
  }
  b.moveBy(x, y);

  // A value-returning function with a single trailing `return <expr>;` lifts it into the
  // RETURN input. Functions with early returns keep them as return statements in the body
  // (the empty RETURN input then generates a trailing `return 0;`).
  let body = f.body;
  if (!f.retVoid) {
    const returnCount = (body.match(/\breturn\b/g) || []).length;
    const rm = body.match(/\breturn\b\s*([^;]*);\s*$/);
    if (returnCount === 1 && rm) {
      body = body.slice(0, rm.index);
      const expr = rm[1].trim();
      if (expr && !attachExpr(ws, b, 'RETURN', expr)) skipped.push(truncate('return ' + expr));
    }
  }
  buildBody(ws, body, b.getInput('STACK')!.connection!, skipped, counter);
  counter.n++;
}

export function parseCodeToWorkspace(workspace: WS, code: string): ImportResult {
  workspace.clear();
  const clean = stripComments(code);
  const skipped: string[] = [];
  const counter: Counter = { n: 0 };

  counter.n += buildIncludes(workspace, clean);

  // Discover user functions first so calls inside setup()/loop()/other functions resolve.
  const funcs = extractFunctions(clean);
  userFuncs = new Map(funcs.map(f => [f.name, { ret: !f.retVoid, params: f.params }]));

  const setupBody = extractBody(clean, 'setup');
  const loopBody = extractBody(clean, 'loop');

  if (setupBody === null && loopBody === null && funcs.length === 0 && counter.n === 0) {
    return { imported: 0, skipped: ['No #include, void setup() or void loop() found.'] };
  }

  let fy = 460;
  for (const f of funcs) { buildFunction(workspace, f, 300, fy, skipped, counter); fy += 180; }

  if (setupBody) buildContainer(workspace, 'arduino_setup', setupBody, 300, 20, skipped, counter);
  if (loopBody) buildContainer(workspace, 'arduino_loop', loopBody, 300, 240, skipped, counter);

  return { imported: counter.n, skipped };
}

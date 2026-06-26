import * as Blockly from 'blockly';

export class ArduinoGenerator extends Blockly.CodeGenerator {
  // Operator precedence — mirrors C++ operator precedence table
  static readonly ORDER_ATOMIC         = 0;   // literals, identifiers
  static readonly ORDER_UNARY_POSTFIX  = 1;   // expr++, expr--, func()
  static readonly ORDER_UNARY_PREFIX   = 2;   // ++expr, --expr, !, ~, -
  static readonly ORDER_MULTIPLICATIVE = 5;   // *, /, %
  static readonly ORDER_ADDITIVE       = 6;   // +, -
  static readonly ORDER_SHIFT          = 7;   // <<, >>
  static readonly ORDER_RELATIONAL     = 9;   // <, <=, >, >=
  static readonly ORDER_EQUALITY       = 10;  // ==, !=
  static readonly ORDER_BITWISE_AND    = 11;  // &
  static readonly ORDER_BITWISE_XOR    = 12;  // ^
  static readonly ORDER_BITWISE_OR     = 13;  // |
  static readonly ORDER_LOGICAL_AND    = 14;  // &&
  static readonly ORDER_LOGICAL_OR     = 15;  // ||
  static readonly ORDER_ASSIGNMENT     = 16;  // =, +=, -=, ...
  static readonly ORDER_NONE           = 99;  // no precedence — always paren

  // Variables used during generation, tracked for global declarations
  usedVariables_: Set<string> = new Set();

  constructor() {
    super('Arduino');
    this.RESERVED_WORDS_ =
      'if,else,for,while,do,switch,case,break,continue,return,' +
      'void,int,float,double,bool,char,byte,word,long,unsigned,String,' +
      'true,false,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,' +
      'pinMode,digitalWrite,digitalRead,analogWrite,analogRead,' +
      'delay,delayMicroseconds,millis,micros,' +
      'Serial,abs,constrain,map,random,randomSeed,min,max,' +
      'setup,loop,sqrt,pow,sin,cos,tan,log,exp';
  }

  init(workspace: Blockly.Workspace): void {
    this.definitions_ = Object.create(null) as {[key: string]: string};
    this.usedVariables_ = new Set();

    if (!this.nameDB_) {
      this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_);
    } else {
      this.nameDB_.reset();
    }
    this.nameDB_.setVariableMap(workspace.getVariableMap());
  }

  finish(code: string): string {
    const includes: string[] = [];
    const setupStatements: string[] = [];
    const globalDefs: string[] = [];

    for (const [key, value] of Object.entries(this.definitions_)) {
      if (key.startsWith('include_')) includes.push(value);
      else if (key.startsWith('setup_')) setupStatements.push(value.trim());
      else globalDefs.push(value);
    }

    // Emit global int declarations for all user variables
    const varDecls: string[] = [];
    for (const varName of this.usedVariables_) {
      varDecls.push(`int ${varName} = 0;`);
    }

    const parts: string[] = [];
    if (includes.length)  parts.push(includes.join('\n'));
    if (varDecls.length)  parts.push(varDecls.join('\n'));
    if (globalDefs.length) parts.push(globalDefs.join('\n'));
    if (parts.length)     parts.push(''); // blank line before functions

    parts.push('void setup() {');
    for (const stmt of setupStatements) parts.push('  ' + stmt);
    parts.push('}');
    parts.push('');
    parts.push('void loop() {');

    const trimmed = code.trimEnd();
    if (trimmed) {
      for (const line of trimmed.split('\n')) {
        parts.push(line ? '  ' + line : '');
      }
    }

    parts.push('}');
    return parts.join('\n') + '\n';
  }

  scrub_(block: Blockly.Block, code: string, thisOnly?: boolean): string {
    let commentCode = '';
    // Only emit comments for statement-level blocks (not values)
    if (!block.outputConnection || !block.outputConnection.targetConnection) {
      const comment = block.getCommentText();
      if (comment) {
        commentCode = this.prefixLines(comment + '\n', '// ') + '\n';
      }
    }
    const nextBlock = block.nextConnection?.targetBlock() ?? null;
    const nextCode = thisOnly ? '' : (nextBlock ? (this.blockToCode(nextBlock) as string) : '');
    return commentCode + code + nextCode;
  }

  scrubNakedValue(line: string): string {
    return line + ';\n';
  }

  quote_(str: string): string {
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r') + '"';
  }
}

export const arduinoGenerator = new ArduinoGenerator();

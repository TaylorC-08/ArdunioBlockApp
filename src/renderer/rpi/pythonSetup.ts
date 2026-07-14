import { pythonGenerator } from 'blockly/python';

// Configures Blockly's stock Python generator for Raspberry Pi programs: it keeps
// generating all standard blocks unchanged, but adds import/cleanup management and
// assembles a proper program shape from the rpi_setup ("on start") and rpi_loop
// ("repeat forever") container blocks — mirroring how ArduinoGenerator.finish()
// assembles includes/globals/setup()/loop() on the Arduino side.

// Typed view of the extra state we hang off the stock singleton (its own fields,
// like definitions_, are protected at the type level).
export interface RpiGen {
  definitions_: Record<string, string>;
  functionNames_: Record<string, string>;
  rpiSetup_: string;   // code captured from the rpi_setup container
  rpiLoop_: string;    // code captured from the rpi_loop container
  usesGpio_: boolean;  // any GPIO block used → emit setmode + cleanup
  addImport(key: string, line: string): void;
  addDef(key: string, code: string): void;
  markGpio(): void;
}

export const gen = pythonGenerator as unknown as RpiGen;

// Emit an `import`/`from … import …` line once (deduped by key). Detected as an
// import (vs a definition) by finish() via the same test the stock generator uses.
gen.addImport = function (key, line) { this.definitions_['import_' + key] = line; };
// Emit a top-level helper (function/global) once, before the runtime code.
gen.addDef = function (key, code) { this.definitions_['def_' + key] = code; };
gen.markGpio = function () { this.usesGpio_ = true; };

// Prefix every non-blank line — used to indent captured bodies into the scaffold.
function indentLines(code: string, prefix: string): string {
  return code.split('\n').map((l) => (l ? prefix + l : l)).join('\n');
}

const IMPORT_RE = /^(from\s+\S+\s+)?import\s+\S+/;

const baseInit = pythonGenerator.init.bind(pythonGenerator);
pythonGenerator.init = function (workspace) {
  baseInit(workspace);
  gen.rpiSetup_ = '';
  gen.rpiLoop_ = '';
  gen.usesGpio_ = false;
};

pythonGenerator.finish = function (code) {
  // Split accumulated definitions into imports vs. everything else.
  const imports: string[] = [];
  const defs: string[] = [];
  for (const name in this.definitions_) {
    const def = this.definitions_[name];
    (IMPORT_RE.test(def) ? imports : defs).push(def);
  }
  // Reset generator state (mirrors the stock finish()).
  this.definitions_ = Object.create(null) as Record<string, string>;
  this.functionNames_ = Object.create(null) as Record<string, string>;

  const setupBody = (gen.rpiSetup_ + code).replace(/\n+$/, '');
  const loopBody = gen.rpiLoop_.replace(/\n+$/, '');
  const cleanup = gen.usesGpio_ ? 'GPIO.cleanup()' : 'pass';

  const runtime: string[] = [];
  if (gen.usesGpio_) runtime.push('GPIO.setmode(GPIO.BCM)');

  if (loopBody) {
    // Repeat-forever program: run setup once, then loop until interrupted, then clean up.
    if (setupBody) runtime.push(setupBody);
    runtime.push('try:');
    runtime.push('    while True:');
    runtime.push(indentLines(loopBody, '        '));
    runtime.push('except KeyboardInterrupt:');
    runtime.push('    pass');
    runtime.push('finally:');
    runtime.push('    ' + cleanup);
  } else if (gen.usesGpio_) {
    // Run-once GPIO program: guarantee cleanup even if it errors.
    runtime.push('try:');
    runtime.push(indentLines(setupBody || 'pass', '    '));
    runtime.push('finally:');
    runtime.push('    ' + cleanup);
  } else if (setupBody) {
    // Plain Python script (no GPIO) — emit as-is.
    runtime.push(setupBody);
  }

  const sections = [imports.join('\n'), defs.join('\n\n'), runtime.join('\n')].filter(Boolean);
  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '') + '\n';
};

export { pythonGenerator };

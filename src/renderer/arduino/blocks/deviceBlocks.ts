import * as Blockly from 'blockly';
import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

// Generic library/device method calls (Keyboard, Mouse, Servo, LiquidCrystal, extra serial
// ports, capacitive sensors, …) all share the form object.method(arg, …). Two blocks — a
// statement and a value — cover them with an object field, a method field, and up to three
// argument inputs. Also: a counting loop with an explicit direction, and a return statement.

Blockly.defineBlocksWithJsonArray([
  {
    type: 'arduino_lib_stmt',
    message0: '%1 . %2 ( %3 %4 %5 )',
    args0: [
      { type: 'field_input', name: 'OBJ', text: 'Keyboard' },
      { type: 'field_input', name: 'METHOD', text: 'press' },
      { type: 'input_value', name: 'ARG0' },
      { type: 'input_value', name: 'ARG1' },
      { type: 'input_value', name: 'ARG2' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: 20,
    tooltip: 'Call a library/device method, e.g. Mouse.move, Keyboard.press, myServo.write, lcd.print',
  },
  {
    type: 'arduino_lib_value',
    message0: '%1 . %2 ( %3 %4 %5 )',
    args0: [
      { type: 'field_input', name: 'OBJ', text: 'Mouse' },
      { type: 'field_input', name: 'METHOD', text: 'isPressed' },
      { type: 'input_value', name: 'ARG0' },
      { type: 'input_value', name: 'ARG1' },
      { type: 'input_value', name: 'ARG2' },
    ],
    inputsInline: true,
    output: null,
    colour: 20,
    tooltip: 'Call a library/device method that returns a value, e.g. Mouse.isPressed, Serial1.read',
  },
  {
    type: 'arduino_for_dir',
    message0: 'count %1 from %2 %3 %4 by %5',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'i' },
      { type: 'input_value', name: 'FROM', check: 'Number' },
      { type: 'field_dropdown', name: 'DIR', options: [['up to', 'up'], ['down to', 'down']] },
      { type: 'input_value', name: 'TO', check: 'Number' },
      { type: 'input_value', name: 'BY', check: 'Number' },
    ],
    message1: 'do %1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: 'Loop a variable from one value up or down to another, by a step',
  },
  {
    type: 'arduino_return',
    message0: 'return %1',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null,
    colour: 290,
    tooltip: 'Return from the current function, optionally with a value',
  },
]);

const O = ArduinoGenerator.ORDER_NONE;

function libArgs(block: Blockly.Block): string {
  const parts: string[] = [];
  for (const n of ['ARG0', 'ARG1', 'ARG2']) {
    if (block.getInputTargetBlock(n)) parts.push(arduinoGenerator.valueToCode(block, n, O));
  }
  return parts.join(', ');
}

arduinoGenerator.forBlock['arduino_lib_stmt'] = b =>
  `${b.getFieldValue('OBJ')}.${b.getFieldValue('METHOD')}(${libArgs(b)});\n`;

arduinoGenerator.forBlock['arduino_lib_value'] = b =>
  [`${b.getFieldValue('OBJ')}.${b.getFieldValue('METHOD')}(${libArgs(b)})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];

arduinoGenerator.forBlock['arduino_for_dir'] = function(block, generator) {
  const varName = generator.nameDB_!.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
  const from = generator.valueToCode(block, 'FROM', ArduinoGenerator.ORDER_ASSIGNMENT) || '0';
  const to   = generator.valueToCode(block, 'TO',   ArduinoGenerator.ORDER_ASSIGNMENT) || '0';
  const by   = generator.valueToCode(block, 'BY',   ArduinoGenerator.ORDER_ASSIGNMENT) || '1';
  const down = block.getFieldValue('DIR') === 'down';
  const branch = generator.statementToCode(block, 'DO');
  return `for (${varName} = ${from}; ${varName} ${down ? '>=' : '<='} ${to}; ${varName} ${down ? '-=' : '+='} ${by}) {\n${branch}}\n`;
};

arduinoGenerator.forBlock['arduino_return'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', O);
  return value ? `return ${value};\n` : 'return;\n';
};

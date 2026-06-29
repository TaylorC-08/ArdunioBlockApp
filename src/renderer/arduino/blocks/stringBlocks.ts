import * as Blockly from 'blockly';
import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

// Arduino String object support, plus a couple of general helpers (compound assignment
// and C casts) that the String examples also rely on. Outputs are left untyped (null) so
// String values can plug into any input without Blockly type-check rejections.

Blockly.defineBlocksWithJsonArray([
  // ---- String construction ----
  {
    type: 'arduino_string',
    message0: 'String ( %1 )',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    output: null,
    colour: 160,
    tooltip: 'Construct a String from a value',
  },
  {
    type: 'arduino_string_fmt',
    message0: 'String ( %1 , %2 )',
    args0: [
      { type: 'input_value', name: 'VALUE' },
      { type: 'input_value', name: 'FMT' },
    ],
    output: null,
    colour: 160,
    tooltip: 'Construct a String with a base (HEX/DEC/OCT/BIN) or number of decimal places',
  },
  // ---- Value-returning String methods ----
  {
    type: 'arduino_str_length',
    message0: 'length of %1',
    args0: [{ type: 'input_value', name: 'STR' }],
    output: 'Number',
    colour: 160,
    tooltip: 'Number of characters in a String',
  },
  {
    type: 'arduino_str_toint',
    message0: 'integer value of %1',
    args0: [{ type: 'input_value', name: 'STR' }],
    output: 'Number',
    colour: 160,
    tooltip: 'Convert a String to an integer',
  },
  {
    type: 'arduino_str_charat',
    message0: 'char at %2 of %1',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'input_value', name: 'INDEX', check: 'Number' },
    ],
    output: 'Number',
    colour: 160,
    tooltip: 'The character at a position in a String',
  },
  {
    type: 'arduino_str_substring',
    message0: 'substring of %1 from %2 to %3',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'input_value', name: 'START', check: 'Number' },
      { type: 'input_value', name: 'END', check: 'Number' },
    ],
    output: null,
    colour: 160,
    tooltip: 'A portion of a String. Leave "to" empty to go to the end.',
  },
  {
    type: 'arduino_str_indexof',
    message0: '%2 %3 in %1 from %4',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'field_dropdown', name: 'DIR', options: [['first index of', 'indexOf'], ['last index of', 'lastIndexOf']] },
      { type: 'input_value', name: 'SUB' },
      { type: 'input_value', name: 'FROM', check: 'Number' },
    ],
    output: 'Number',
    colour: 160,
    tooltip: 'Find a character or substring. Leave "from" empty to search the whole String.',
  },
  {
    type: 'arduino_str_compare',
    message0: '%1 %2 %3 %4',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'field_dropdown', name: 'METHOD', options: [
        ['equals', 'equals'], ['equals (ignore case)', 'equalsIgnoreCase'],
        ['compareTo', 'compareTo'], ['starts with', 'startsWith'], ['ends with', 'endsWith'],
      ] },
      { type: 'input_value', name: 'ARG' },
      { type: 'input_value', name: 'ARG2', check: 'Number' },
    ],
    output: null,
    colour: 160,
    tooltip: 'Compare a String with another. (compareTo returns a number; the rest a yes/no, except startsWith may take a start offset.)',
  },
  // ---- Void String methods (mutate in place) ----
  {
    type: 'arduino_str_void',
    message0: '%2 %1',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'field_dropdown', name: 'METHOD', options: [
        ['trim', 'trim'], ['make upper case', 'toUpperCase'], ['make lower case', 'toLowerCase'],
      ] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    tooltip: 'Modify a String in place',
  },
  {
    type: 'arduino_str_replace',
    message0: 'in %1 replace %2 with %3',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'input_value', name: 'FIND' },
      { type: 'input_value', name: 'REP' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    tooltip: 'Replace all occurrences of one substring with another',
  },
  {
    type: 'arduino_str_setcharat',
    message0: 'in %1 set char at %2 to %3',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'input_value', name: 'CHAR', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    tooltip: 'Set the character at a position in a String',
  },
  {
    type: 'arduino_str_concat',
    message0: 'append %2 to %1',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    tooltip: 'Append a value to the end of a String',
  },
  {
    type: 'arduino_str_reserve',
    message0: 'reserve %2 bytes in %1',
    args0: [
      { type: 'input_value', name: 'STR' },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    tooltip: 'Pre-allocate memory for a String to avoid fragmentation',
  },
  // ---- General helpers used by the String (and other) examples ----
  {
    type: 'arduino_compound_assign',
    message0: '%1 %2 %3',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'item' },
      { type: 'field_dropdown', name: 'OP', options: [['+=', '+='], ['-=', '-='], ['*=', '*='], ['/=', '/=']] },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 330,
    tooltip: 'Update a variable in place (add to / subtract from / etc.)',
  },
  {
    type: 'arduino_cast',
    message0: '( %1 ) %2',
    args0: [
      { type: 'field_input', name: 'TYPE', text: 'char' },
      { type: 'input_value', name: 'VALUE' },
    ],
    output: null,
    colour: 230,
    tooltip: 'Cast a value to a C type, e.g. (char)',
  },
]);

const O = ArduinoGenerator.ORDER_NONE;
const POST = ArduinoGenerator.ORDER_UNARY_POSTFIX;
const v = (block: Blockly.Block, name: string, dflt = '') =>
  arduinoGenerator.valueToCode(block, name, O) || dflt;
const hasInput = (block: Blockly.Block, name: string) => !!block.getInputTargetBlock(name);

arduinoGenerator.forBlock['arduino_string'] = b => [`String(${v(b, 'VALUE', '""')})`, POST];
arduinoGenerator.forBlock['arduino_string_fmt'] = b => [`String(${v(b, 'VALUE', '""')}, ${v(b, 'FMT', 'DEC')})`, POST];
arduinoGenerator.forBlock['arduino_str_length'] = b => [`${v(b, 'STR', '""')}.length()`, POST];
arduinoGenerator.forBlock['arduino_str_toint'] = b => [`${v(b, 'STR', '""')}.toInt()`, POST];
arduinoGenerator.forBlock['arduino_str_charat'] = b => [`${v(b, 'STR', '""')}.charAt(${v(b, 'INDEX', '0')})`, POST];

arduinoGenerator.forBlock['arduino_str_substring'] = b => {
  const str = v(b, 'STR', '""'), start = v(b, 'START', '0');
  return hasInput(b, 'END')
    ? [`${str}.substring(${start}, ${v(b, 'END')})`, POST]
    : [`${str}.substring(${start})`, POST];
};

arduinoGenerator.forBlock['arduino_str_indexof'] = b => {
  const dir = b.getFieldValue('DIR'), str = v(b, 'STR', '""'), sub = v(b, 'SUB', '""');
  return hasInput(b, 'FROM')
    ? [`${str}.${dir}(${sub}, ${v(b, 'FROM')})`, POST]
    : [`${str}.${dir}(${sub})`, POST];
};

arduinoGenerator.forBlock['arduino_str_compare'] = b => {
  const m = b.getFieldValue('METHOD'), str = v(b, 'STR', '""'), arg = v(b, 'ARG', '""');
  return hasInput(b, 'ARG2')
    ? [`${str}.${m}(${arg}, ${v(b, 'ARG2')})`, POST]
    : [`${str}.${m}(${arg})`, POST];
};

arduinoGenerator.forBlock['arduino_str_void'] = b => `${v(b, 'STR', '""')}.${b.getFieldValue('METHOD')}();\n`;
arduinoGenerator.forBlock['arduino_str_replace'] = b => `${v(b, 'STR', '""')}.replace(${v(b, 'FIND', '""')}, ${v(b, 'REP', '""')});\n`;
arduinoGenerator.forBlock['arduino_str_setcharat'] = b => `${v(b, 'STR', '""')}.setCharAt(${v(b, 'INDEX', '0')}, ${v(b, 'CHAR', "' '")});\n`;
arduinoGenerator.forBlock['arduino_str_concat'] = b => `${v(b, 'STR', '""')}.concat(${v(b, 'VALUE', '""')});\n`;
arduinoGenerator.forBlock['arduino_str_reserve'] = b => `${v(b, 'STR', '""')}.reserve(${v(b, 'N', '0')});\n`;

arduinoGenerator.forBlock['arduino_compound_assign'] = function(block, generator) {
  const name = generator.nameDB_!.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
  (generator as ArduinoGenerator).usedVariables_.add(name);
  return `${name} ${block.getFieldValue('OP')} ${v(block, 'VALUE', '0')};\n`;
};

arduinoGenerator.forBlock['arduino_cast'] = b => [`(${b.getFieldValue('TYPE')})(${v(b, 'VALUE', '0')})`, ArduinoGenerator.ORDER_UNARY_PREFIX];

import * as Blockly from 'blockly';
import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

// ---- Block shape definitions ----

Blockly.defineBlocksWithJsonArray([
  {
    type: 'arduino_setup',
    message0: 'void setup() %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 30,
    tooltip: 'Runs once when the board powers on or resets',
  },
  {
    type: 'arduino_loop',
    message0: 'void loop() %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 30,
    tooltip: 'Runs repeatedly, forever, after setup() finishes',
  },
  {
    type: 'arduino_include',
    message0: '#include %1',
    args0: [
      { type: 'field_input', name: 'LIB', text: 'Servo.h' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 290,
    tooltip: 'Include a library header, e.g. Servo.h. Emitted at the top of the sketch.',
  },
  {
    type: 'arduino_comment',
    message0: '// %1',
    args0: [
      { type: 'field_input', name: 'TEXT', text: 'comment' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#808080',
    tooltip: 'A code comment. It documents your program but does nothing when it runs.',
  },
  {
    type: 'arduino_pin_mode',
    message0: 'set pin %1 mode %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '13' },
      { type: 'field_dropdown', name: 'MODE', options: [
        ['OUTPUT', 'OUTPUT'],
        ['INPUT', 'INPUT'],
        ['INPUT_PULLUP', 'INPUT_PULLUP'],
      ]},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 180,
    tooltip: 'Configure a digital pin as input or output',
  },
  {
    type: 'arduino_digital_write',
    message0: 'digitalWrite pin %1 → %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '13' },
      { type: 'field_dropdown', name: 'VALUE', options: [
        ['HIGH', 'HIGH'],
        ['LOW', 'LOW'],
      ]},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 180,
    tooltip: 'Write HIGH or LOW to a digital pin',
  },
  {
    type: 'arduino_digital_write_expr',
    message0: 'digitalWrite pin %1 ← %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '13' },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 180,
    tooltip: 'Write a value (variable or expression) to a digital pin',
  },
  {
    type: 'arduino_digital_read',
    message0: 'digitalRead pin %1',
    args0: [
      { type: 'field_input', name: 'PIN', text: '2' },
    ],
    output: 'Number',
    colour: 180,
    tooltip: 'Read the value of a digital pin (HIGH=1, LOW=0)',
  },
  {
    type: 'arduino_level',
    message0: '%1',
    args0: [
      { type: 'field_dropdown', name: 'LEVEL', options: [
        ['HIGH', 'HIGH'],
        ['LOW', 'LOW'],
      ]},
    ],
    output: 'Number',
    colour: 180,
    tooltip: 'Digital logic level constant (HIGH or LOW)',
  },
  {
    type: 'arduino_analog_write',
    message0: 'analogWrite pin %1 value %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '9' },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 230,
    tooltip: 'Write a PWM value (0–255) to an analog-capable pin',
  },
  {
    type: 'arduino_analog_read',
    message0: 'analogRead pin %1',
    args0: [
      { type: 'field_input', name: 'PIN', text: 'A0' },
    ],
    output: 'Number',
    colour: 230,
    tooltip: 'Read an analog pin value (0–1023)',
  },
  {
    type: 'arduino_delay',
    message0: 'delay %1 ms',
    args0: [
      { type: 'input_value', name: 'MS', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: 'Pause execution for a number of milliseconds',
  },
  {
    type: 'arduino_delay_microseconds',
    message0: 'delayMicroseconds %1 μs',
    args0: [
      { type: 'input_value', name: 'US', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: 'Pause execution for a number of microseconds',
  },
  {
    type: 'arduino_millis',
    message0: 'millis()',
    output: 'Number',
    colour: 120,
    tooltip: 'Milliseconds since the program started',
  },
  {
    type: 'arduino_serial_begin',
    message0: 'Serial.begin %1 baud',
    args0: [
      { type: 'field_dropdown', name: 'BAUD', options: [
        ['9600', '9600'],
        ['19200', '19200'],
        ['31250', '31250'],
        ['38400', '38400'],
        ['57600', '57600'],
        ['115200', '115200'],
      ]},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 65,
    tooltip: 'Initialize serial communication at the given baud rate',
  },
  {
    type: 'arduino_serial_print',
    message0: 'Serial.print %1',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null,
    nextStatement: null,
    colour: 65,
    tooltip: 'Print a value to the serial monitor (no newline)',
  },
  {
    type: 'arduino_serial_println',
    message0: 'Serial.println %1',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null,
    nextStatement: null,
    colour: 65,
    tooltip: 'Print a value to the serial monitor followed by a newline',
  },
  {
    type: 'arduino_tone',
    message0: 'tone pin %1 frequency %2 duration (ms) %3',
    args0: [
      { type: 'field_input', name: 'PIN', text: '8' },
      { type: 'input_value', name: 'FREQ', check: 'Number' },
      { type: 'input_value', name: 'DURATION', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 65,
    tooltip: 'Play a square-wave tone on a pin. Leave duration empty to play continuously until noTone.',
  },
  {
    type: 'arduino_no_tone',
    message0: 'noTone pin %1',
    args0: [
      { type: 'field_input', name: 'PIN', text: '8' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 65,
    tooltip: 'Stop the tone playing on a pin',
  },
  {
    type: 'arduino_serial_available',
    message0: 'Serial.available()',
    output: 'Number',
    colour: 65,
    tooltip: 'Number of bytes waiting to be read from serial',
  },
  {
    type: 'arduino_serial_read',
    message0: 'Serial.read()',
    output: 'Number',
    colour: 65,
    tooltip: 'Read one incoming byte from serial (-1 if none available)',
  },
  {
    type: 'arduino_serial_parse_int',
    message0: 'Serial.parseInt()',
    output: 'Number',
    colour: 65,
    tooltip: 'Read the next valid integer from serial',
  },
  {
    type: 'arduino_serial_write',
    message0: 'Serial.write %1',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null,
    nextStatement: null,
    colour: 65,
    tooltip: 'Send raw bytes over serial',
  },
  {
    type: 'arduino_serial_print_format',
    message0: 'Serial %1 %2 as %3',
    args0: [
      { type: 'field_dropdown', name: 'LN', options: [['print', 'print'], ['println', 'println']] },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
      { type: 'field_dropdown', name: 'FORMAT', options: [['DEC', 'DEC'], ['HEX', 'HEX'], ['OCT', 'OCT'], ['BIN', 'BIN']] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 65,
    tooltip: 'Print a number to serial in the chosen base',
  },
  {
    type: 'arduino_array_get',
    message0: '%1 [ %2 ]',
    args0: [
      { type: 'field_input', name: 'ARRAY', text: 'myArray' },
      { type: 'input_value', name: 'INDEX', check: 'Number' },
    ],
    output: 'Number',
    colour: 260,
    tooltip: 'Read an element of an array by index',
  },
  {
    type: 'arduino_array_get2',
    message0: '%1 [ %2 ] [ %3 ]',
    args0: [
      { type: 'field_input', name: 'ARRAY', text: 'myArray' },
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'input_value', name: 'INDEX2', check: 'Number' },
    ],
    output: 'Number',
    colour: 260,
    tooltip: 'Read an element of a 2-dimensional array',
  },
  {
    type: 'arduino_array_set',
    message0: 'set %1 [ %2 ] to %3',
    args0: [
      { type: 'field_input', name: 'ARRAY', text: 'myArray' },
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 260,
    tooltip: 'Store a value into an array element',
  },
  {
    type: 'arduino_array_set2',
    message0: 'set %1 [ %2 ] [ %3 ] to %4',
    args0: [
      { type: 'field_input', name: 'ARRAY', text: 'myArray' },
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'input_value', name: 'INDEX2', check: 'Number' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 260,
    tooltip: 'Store a value into a 2-dimensional array element',
  },
  {
    type: 'arduino_char',
    message0: "char '%1'",
    args0: [{ type: 'field_input', name: 'CHAR', text: 'A' }],
    output: 'Number',
    colour: 160,
    tooltip: 'A single character literal, e.g. A or \\n. Its numeric (ASCII) value is used in expressions.',
  },
  {
    type: 'arduino_char_type',
    message0: '%1 is %2',
    args0: [
      { type: 'input_value', name: 'CHAR', check: 'Number' },
      { type: 'field_dropdown', name: 'FUNC', options: [
        ['alphanumeric', 'isAlphaNumeric'], ['a letter', 'isAlpha'], ['ASCII', 'isAscii'],
        ['whitespace', 'isWhitespace'], ['a control char', 'isControl'], ['a digit', 'isDigit'],
        ['printable, not space', 'isGraph'], ['lower case', 'isLowerCase'], ['printable', 'isPrintable'],
        ['punctuation', 'isPunct'], ['a space or tab', 'isSpace'], ['upper case', 'isUpperCase'],
        ['a hex digit', 'isHexadecimalDigit'],
      ]},
    ],
    output: 'Boolean',
    colour: 210,
    tooltip: 'Test what category a character belongs to',
  },
  {
    type: 'arduino_pulse_in',
    message0: 'pulseIn pin %1 state %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '7' },
      { type: 'field_dropdown', name: 'STATE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] },
    ],
    output: 'Number',
    colour: 230,
    tooltip: 'Measure the length, in microseconds, of a HIGH or LOW pulse on a pin',
  },
  {
    type: 'arduino_map',
    message0: 'map %1 from [%2, %3] to [%4, %5]',
    args0: [
      { type: 'input_value', name: 'VALUE', check: 'Number' },
      { type: 'input_value', name: 'FROM_LOW', check: 'Number' },
      { type: 'input_value', name: 'FROM_HIGH', check: 'Number' },
      { type: 'input_value', name: 'TO_LOW', check: 'Number' },
      { type: 'input_value', name: 'TO_HIGH', check: 'Number' },
    ],
    output: 'Number',
    colour: 230,
    tooltip: 'Re-map a number from one range to another',
  },
]);

// ---- Code generators ----

arduinoGenerator.forBlock['arduino_include'] = function(block, generator) {
  const lib = block.getFieldValue('LIB').trim();
  if (lib) {
    // Bracket form unless the user already wrote <...> or "..." themselves.
    const ref = /^[<"].*[>"]$/.test(lib) ? lib : `<${lib}>`;
    (generator as ArduinoGenerator).addDefinition(`include_${lib}`, `#include ${ref}`);
  }
  return '';
};

arduinoGenerator.forBlock['arduino_setup'] = function(block, generator) {
  const inner = block.getInputTargetBlock('DO');
  const code = inner ? (generator.blockToCode(inner) as string) : '';
  (generator as ArduinoGenerator).setupCode_ += code;
  return '';
};

arduinoGenerator.forBlock['arduino_loop'] = function(block, generator) {
  const inner = block.getInputTargetBlock('DO');
  const code = inner ? (generator.blockToCode(inner) as string) : '';
  (generator as ArduinoGenerator).loopCode_ += code;
  return '';
};

arduinoGenerator.forBlock['arduino_comment'] = function(block) {
  return `// ${block.getFieldValue('TEXT')}\n`;
};

arduinoGenerator.forBlock['arduino_pin_mode'] = function(block) {
  const pin  = block.getFieldValue('PIN');
  const mode = block.getFieldValue('MODE');
  return `pinMode(${pin}, ${mode});\n`;
};

arduinoGenerator.forBlock['arduino_digital_write'] = function(block) {
  const pin   = block.getFieldValue('PIN');
  const value = block.getFieldValue('VALUE');
  return `digitalWrite(${pin}, ${value});\n`;
};

arduinoGenerator.forBlock['arduino_digital_write_expr'] = function(block, generator) {
  const pin   = block.getFieldValue('PIN');
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || 'LOW';
  return `digitalWrite(${pin}, ${value});\n`;
};

arduinoGenerator.forBlock['arduino_digital_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  return [`digitalRead(${pin})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_analog_write'] = function(block, generator) {
  const pin   = block.getFieldValue('PIN');
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || '0';
  return `analogWrite(${pin}, ${value});\n`;
};

arduinoGenerator.forBlock['arduino_analog_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  return [`analogRead(${pin})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_level'] = function(block) {
  return [block.getFieldValue('LEVEL'), ArduinoGenerator.ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_delay'] = function(block, generator) {
  const ms = generator.valueToCode(block, 'MS', ArduinoGenerator.ORDER_NONE) || '1000';
  return `delay(${ms});\n`;
};

arduinoGenerator.forBlock['arduino_delay_microseconds'] = function(block, generator) {
  const us = generator.valueToCode(block, 'US', ArduinoGenerator.ORDER_NONE) || '100';
  return `delayMicroseconds(${us});\n`;
};

arduinoGenerator.forBlock['arduino_millis'] = function() {
  return ['millis()', ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_serial_begin'] = function(block) {
  const baud = block.getFieldValue('BAUD');
  return `Serial.begin(${baud});\n`;
};

arduinoGenerator.forBlock['arduino_serial_print'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || '""';
  return `Serial.print(${value});\n`;
};

arduinoGenerator.forBlock['arduino_serial_println'] = function(block, generator) {
  // No value attached → bare Serial.println() (prints a newline only).
  if (!block.getInputTargetBlock('VALUE')) return 'Serial.println();\n';
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || '""';
  return `Serial.println(${value});\n`;
};

arduinoGenerator.forBlock['arduino_serial_available'] = function() {
  return ['Serial.available()', ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_serial_read'] = function() {
  return ['Serial.read()', ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_serial_parse_int'] = function() {
  return ['Serial.parseInt()', ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_serial_write'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || '0';
  return `Serial.write(${value});\n`;
};

arduinoGenerator.forBlock['arduino_serial_print_format'] = function(block, generator) {
  const ln    = block.getFieldValue('LN');
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || '0';
  const fmt   = block.getFieldValue('FORMAT');
  return `Serial.${ln}(${value}, ${fmt});\n`;
};

arduinoGenerator.forBlock['arduino_tone'] = function(block, generator) {
  const pin  = block.getFieldValue('PIN');
  const freq = generator.valueToCode(block, 'FREQ', ArduinoGenerator.ORDER_NONE) || '440';
  const dur  = generator.valueToCode(block, 'DURATION', ArduinoGenerator.ORDER_NONE);
  return dur ? `tone(${pin}, ${freq}, ${dur});\n` : `tone(${pin}, ${freq});\n`;
};

arduinoGenerator.forBlock['arduino_no_tone'] = function(block) {
  return `noTone(${block.getFieldValue('PIN')});\n`;
};

arduinoGenerator.forBlock['arduino_array_get'] = function(block, generator) {
  const idx = generator.valueToCode(block, 'INDEX', ArduinoGenerator.ORDER_NONE) || '0';
  return [`${block.getFieldValue('ARRAY')}[${idx}]`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_array_get2'] = function(block, generator) {
  const i1 = generator.valueToCode(block, 'INDEX',  ArduinoGenerator.ORDER_NONE) || '0';
  const i2 = generator.valueToCode(block, 'INDEX2', ArduinoGenerator.ORDER_NONE) || '0';
  return [`${block.getFieldValue('ARRAY')}[${i1}][${i2}]`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_array_set'] = function(block, generator) {
  const idx = generator.valueToCode(block, 'INDEX', ArduinoGenerator.ORDER_NONE) || '0';
  const val = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_ASSIGNMENT) || '0';
  return `${block.getFieldValue('ARRAY')}[${idx}] = ${val};\n`;
};

arduinoGenerator.forBlock['arduino_array_set2'] = function(block, generator) {
  const i1 = generator.valueToCode(block, 'INDEX',  ArduinoGenerator.ORDER_NONE) || '0';
  const i2 = generator.valueToCode(block, 'INDEX2', ArduinoGenerator.ORDER_NONE) || '0';
  const val = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_ASSIGNMENT) || '0';
  return `${block.getFieldValue('ARRAY')}[${i1}][${i2}] = ${val};\n`;
};

arduinoGenerator.forBlock['arduino_char'] = function(block) {
  // CHAR holds the inner text (e.g. A or \n); emit it as a C char literal.
  return [`'${block.getFieldValue('CHAR')}'`, ArduinoGenerator.ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_char_type'] = function(block, generator) {
  const c = generator.valueToCode(block, 'CHAR', ArduinoGenerator.ORDER_NONE) || "' '";
  return [`${block.getFieldValue('FUNC')}(${c})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_pulse_in'] = function(block) {
  const pin = block.getFieldValue('PIN');
  return [`pulseIn(${pin}, ${block.getFieldValue('STATE')})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['arduino_map'] = function(block, generator) {
  const val  = generator.valueToCode(block, 'VALUE',     ArduinoGenerator.ORDER_NONE) || '0';
  const fLow = generator.valueToCode(block, 'FROM_LOW',  ArduinoGenerator.ORDER_NONE) || '0';
  const fHi  = generator.valueToCode(block, 'FROM_HIGH', ArduinoGenerator.ORDER_NONE) || '1023';
  const tLow = generator.valueToCode(block, 'TO_LOW',    ArduinoGenerator.ORDER_NONE) || '0';
  const tHi  = generator.valueToCode(block, 'TO_HIGH',   ArduinoGenerator.ORDER_NONE) || '255';
  return [`map(${val}, ${fLow}, ${fHi}, ${tLow}, ${tHi})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

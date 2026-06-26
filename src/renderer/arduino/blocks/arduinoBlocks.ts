import * as Blockly from 'blockly';
import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

// ---- Block shape definitions ----

Blockly.defineBlocksWithJsonArray([
  {
    type: 'arduino_pin_mode',
    message0: 'set pin %1 mode %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 13, min: 0, max: 53, precision: 1 },
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
      { type: 'field_number', name: 'PIN', value: 13, min: 0, max: 53, precision: 1 },
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
    type: 'arduino_digital_read',
    message0: 'digitalRead pin %1',
    args0: [
      { type: 'field_number', name: 'PIN', value: 2, min: 0, max: 53, precision: 1 },
    ],
    output: 'Number',
    colour: 180,
    tooltip: 'Read the value of a digital pin (HIGH=1, LOW=0)',
  },
  {
    type: 'arduino_analog_write',
    message0: 'analogWrite pin %1 value %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 9, min: 0, max: 13, precision: 1 },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 230,
    tooltip: 'Write a PWM value (0–255) to an analog-capable pin',
  },
  {
    type: 'arduino_analog_read',
    message0: 'analogRead pin A%1',
    args0: [
      { type: 'field_number', name: 'PIN', value: 0, min: 0, max: 15, precision: 1 },
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
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || '""';
  return `Serial.println(${value});\n`;
};

arduinoGenerator.forBlock['arduino_map'] = function(block, generator) {
  const val  = generator.valueToCode(block, 'VALUE',     ArduinoGenerator.ORDER_NONE) || '0';
  const fLow = generator.valueToCode(block, 'FROM_LOW',  ArduinoGenerator.ORDER_NONE) || '0';
  const fHi  = generator.valueToCode(block, 'FROM_HIGH', ArduinoGenerator.ORDER_NONE) || '1023';
  const tLow = generator.valueToCode(block, 'TO_LOW',    ArduinoGenerator.ORDER_NONE) || '0';
  const tHi  = generator.valueToCode(block, 'TO_HIGH',   ArduinoGenerator.ORDER_NONE) || '255';
  return [`map(${val}, ${fLow}, ${fHi}, ${tLow}, ${tHi})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

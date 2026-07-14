import * as Blockly from 'blockly';
import { Order } from 'blockly/python';
import { pythonGenerator, gen } from '../pythonSetup';

// Core digital GPIO (RPi.GPIO, BCM numbering) and sleep. Each GPIO block records the
// import and marks GPIO as used so pythonSetup emits setmode/cleanup around the program.

Blockly.defineBlocksWithJsonArray([
  {
    type: 'rpi_pin_setup',
    message0: 'setup pin %1 as %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 17, min: 0, max: 27, precision: 1 },
      { type: 'field_dropdown', name: 'MODE', options: [['output', 'OUT'], ['input', 'IN'], ['input (pull-up)', 'IN_PUD_UP'], ['input (pull-down)', 'IN_PUD_DOWN']] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 200,
    tooltip: 'Configure a GPIO pin as output, or input with an optional internal pull resistor (BCM numbering)',
  },
  {
    type: 'rpi_digital_write',
    message0: 'set pin %1 %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 17, min: 0, max: 27, precision: 1 },
      { type: 'field_dropdown', name: 'VALUE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 200,
    tooltip: 'Drive a GPIO output pin high or low',
  },
  {
    type: 'rpi_digital_read',
    message0: 'read pin %1',
    args0: [
      { type: 'field_number', name: 'PIN', value: 17, min: 0, max: 27, precision: 1 },
    ],
    output: 'Boolean',
    colour: 200,
    tooltip: 'Read the value of a GPIO input pin (True = HIGH)',
  },
  {
    type: 'rpi_sleep',
    message0: 'sleep %1 seconds',
    args0: [
      { type: 'input_value', name: 'SECONDS', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: 'Pause for a number of seconds',
  },
]);

pythonGenerator.forBlock['rpi_pin_setup'] = function (block) {
  gen.markGpio();
  gen.addImport('gpio', 'import RPi.GPIO as GPIO');
  const pin = block.getFieldValue('PIN');
  const mode = block.getFieldValue('MODE');
  if (mode === 'IN_PUD_UP') return `GPIO.setup(${pin}, GPIO.IN, pull_up_down=GPIO.PUD_UP)\n`;
  if (mode === 'IN_PUD_DOWN') return `GPIO.setup(${pin}, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)\n`;
  return `GPIO.setup(${pin}, GPIO.${mode})\n`;
};

pythonGenerator.forBlock['rpi_digital_write'] = function (block) {
  gen.markGpio();
  gen.addImport('gpio', 'import RPi.GPIO as GPIO');
  const pin = block.getFieldValue('PIN');
  const value = block.getFieldValue('VALUE');
  return `GPIO.output(${pin}, GPIO.${value})\n`;
};

pythonGenerator.forBlock['rpi_digital_read'] = function (block) {
  gen.markGpio();
  gen.addImport('gpio', 'import RPi.GPIO as GPIO');
  const pin = block.getFieldValue('PIN');
  return [`GPIO.input(${pin})`, Order.FUNCTION_CALL];
};

pythonGenerator.forBlock['rpi_sleep'] = function (block, generator) {
  gen.addImport('time', 'import time');
  const seconds = generator.valueToCode(block, 'SECONDS', Order.NONE) || '1';
  return `time.sleep(${seconds})\n`;
};

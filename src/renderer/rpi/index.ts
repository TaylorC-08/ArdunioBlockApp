import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';

// ---- Raspberry Pi GPIO blocks (RPi.GPIO, BCM numbering) ----
// Standard blocks (logic/loops/math/text/variables) use Blockly's built-in
// Python generator unchanged; only the GPIO/time blocks are custom.

Blockly.defineBlocksWithJsonArray([
  {
    type: 'rpi_pin_setup',
    message0: 'setup pin %1 as %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 17, min: 0, max: 27, precision: 1 },
      { type: 'field_dropdown', name: 'MODE', options: [['output', 'OUT'], ['input', 'IN']] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 200,
    tooltip: 'Configure a GPIO pin as input or output (BCM numbering)',
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
    tooltip: 'Read the value of a GPIO input pin',
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

// definitions_ is protected at the type level; go through the generator object each
// time since the dict is replaced on every generator init.
const pyDefs = pythonGenerator as unknown as { definitions_: Record<string, string> };

// gpio init (import + BCM mode) emitted once via the generator's definitions.
function ensureGpioInit(): void {
  pyDefs.definitions_['gpio_init'] =
    'import RPi.GPIO as GPIO\nGPIO.setmode(GPIO.BCM)';
}

pythonGenerator.forBlock['rpi_pin_setup'] = function (block) {
  ensureGpioInit();
  const pin = block.getFieldValue('PIN');
  const mode = block.getFieldValue('MODE');
  return `GPIO.setup(${pin}, GPIO.${mode})\n`;
};

pythonGenerator.forBlock['rpi_digital_write'] = function (block) {
  ensureGpioInit();
  const pin = block.getFieldValue('PIN');
  const value = block.getFieldValue('VALUE');
  return `GPIO.output(${pin}, GPIO.${value})\n`;
};

pythonGenerator.forBlock['rpi_digital_read'] = function (block) {
  ensureGpioInit();
  const pin = block.getFieldValue('PIN');
  return [`GPIO.input(${pin})`, Order.FUNCTION_CALL];
};

pythonGenerator.forBlock['rpi_sleep'] = function (block, generator) {
  pyDefs.definitions_['import_time'] = 'import time';
  const seconds = generator.valueToCode(block, 'SECONDS', Order.NONE) || '1';
  return `time.sleep(${seconds})\n`;
};

export const rpiToolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'GPIO', colour: '#A6328C',
      contents: [
        { kind: 'block', type: 'rpi_pin_setup' },
        { kind: 'block', type: 'rpi_digital_write' },
        { kind: 'block', type: 'rpi_digital_read' },
      ],
    },
    {
      kind: 'category', name: 'Time', colour: '#5F4B8B',
      contents: [{ kind: 'block', type: 'rpi_sleep' }],
    },
    { kind: 'sep' },
    {
      kind: 'category', name: 'Logic', colour: '#5C81A6',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category', name: 'Loops', colour: '#5CA65C',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
      ],
    },
    {
      kind: 'category', name: 'Math', colour: '#5C68A6',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
      ],
    },
    {
      kind: 'category', name: 'Text', colour: '#5CA68D',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_print' },
      ],
    },
    { kind: 'category', name: 'Variables', colour: '#A65C81', custom: 'VARIABLE' },
    { kind: 'category', name: 'Functions', colour: '#9A5CA6', custom: 'PROCEDURE' },
  ],
};

export { pythonGenerator };

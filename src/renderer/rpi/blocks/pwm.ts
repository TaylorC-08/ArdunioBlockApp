import * as Blockly from 'blockly';
import { Order } from 'blockly/python';
import { pythonGenerator, gen } from '../pythonSetup';

// Hardware PWM (RPi.GPIO software PWM). Each PWM channel is tracked by a per-pin
// variable pwm_<pin> so later "set duty"/"stop"/servo blocks can reference it.

Blockly.defineBlocksWithJsonArray([
  {
    type: 'rpi_pwm_start',
    message0: 'start PWM on pin %1 at %2 Hz duty %3 %%',
    args0: [
      { type: 'field_number', name: 'PIN', value: 18, min: 0, max: 27, precision: 1 },
      { type: 'field_number', name: 'FREQ', value: 1000, min: 1 },
      { type: 'input_value', name: 'DUTY', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 230,
    tooltip: 'Set the pin as an output first, then start PWM on it (duty 0–100%)',
  },
  {
    type: 'rpi_pwm_duty',
    message0: 'set PWM duty on pin %1 to %2 %%',
    args0: [
      { type: 'field_number', name: 'PIN', value: 18, min: 0, max: 27, precision: 1 },
      { type: 'input_value', name: 'DUTY', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 230,
    tooltip: 'Change the PWM duty cycle (0–100%) on a pin that PWM was started on',
  },
  {
    type: 'rpi_pwm_stop',
    message0: 'stop PWM on pin %1',
    args0: [{ type: 'field_number', name: 'PIN', value: 18, min: 0, max: 27, precision: 1 }],
    previousStatement: null,
    nextStatement: null,
    colour: 230,
    tooltip: 'Stop PWM on a pin',
  },
  {
    type: 'rpi_servo_attach',
    message0: 'attach servo on pin %1',
    args0: [{ type: 'field_number', name: 'PIN', value: 18, min: 0, max: 27, precision: 1 }],
    previousStatement: null,
    nextStatement: null,
    colour: 230,
    tooltip: 'Set up a 50 Hz PWM signal for a hobby servo on this pin',
  },
  {
    type: 'rpi_servo_write',
    message0: 'set servo on pin %1 to %2 °',
    args0: [
      { type: 'field_number', name: 'PIN', value: 18, min: 0, max: 27, precision: 1 },
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 230,
    tooltip: 'Move an attached servo to an angle (0–180°)',
  },
]);

const gpio = (): void => { gen.markGpio(); gen.addImport('gpio', 'import RPi.GPIO as GPIO'); };
const pwmVar = (pin: string): string => `pwm_${pin}`;

pythonGenerator.forBlock['rpi_pwm_start'] = function (block, generator) {
  gpio();
  const pin = block.getFieldValue('PIN');
  const freq = block.getFieldValue('FREQ');
  const duty = generator.valueToCode(block, 'DUTY', Order.NONE) || '0';
  return `${pwmVar(pin)} = GPIO.PWM(${pin}, ${freq})\n${pwmVar(pin)}.start(${duty})\n`;
};

pythonGenerator.forBlock['rpi_pwm_duty'] = function (block, generator) {
  gpio();
  const pin = block.getFieldValue('PIN');
  const duty = generator.valueToCode(block, 'DUTY', Order.NONE) || '0';
  return `${pwmVar(pin)}.ChangeDutyCycle(${duty})\n`;
};

pythonGenerator.forBlock['rpi_pwm_stop'] = function (block) {
  gpio();
  const pin = block.getFieldValue('PIN');
  return `${pwmVar(pin)}.stop()\n`;
};

pythonGenerator.forBlock['rpi_servo_attach'] = function (block) {
  gpio();
  const pin = block.getFieldValue('PIN');
  return `GPIO.setup(${pin}, GPIO.OUT)\n${pwmVar(pin)} = GPIO.PWM(${pin}, 50)\n${pwmVar(pin)}.start(0)\n`;
};

pythonGenerator.forBlock['rpi_servo_write'] = function (block, generator) {
  gpio();
  const pin = block.getFieldValue('PIN');
  const angle = generator.valueToCode(block, 'ANGLE', Order.NONE) || '0';
  // Standard hobby servo on 50 Hz: ~2% duty at 0°, ~12% at 180°.
  return `${pwmVar(pin)}.ChangeDutyCycle(2 + (${angle}) / 18.0)\n`;
};

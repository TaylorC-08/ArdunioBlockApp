import * as Blockly from 'blockly';
import { pythonGenerator, gen } from '../pythonSetup';

// Edge events: run a callback when a pin changes, or block until it changes. The
// callback body becomes a module-level def registered with GPIO.add_event_detect.

Blockly.defineBlocksWithJsonArray([
  {
    type: 'rpi_on_edge',
    message0: 'when pin %1 goes %2 (debounce %3 ms)',
    args0: [
      { type: 'field_number', name: 'PIN', value: 17, min: 0, max: 27, precision: 1 },
      { type: 'field_dropdown', name: 'EDGE', options: [['high', 'RISING'], ['low', 'FALLING'], ['either way', 'BOTH']] },
      { type: 'field_number', name: 'BOUNCE', value: 200, min: 0 },
    ],
    message1: 'do %1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: 60,
    tooltip: 'Run some blocks in the background whenever an input pin changes',
  },
  {
    type: 'rpi_wait_edge',
    message0: 'wait until pin %1 goes %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 17, min: 0, max: 27, precision: 1 },
      { type: 'field_dropdown', name: 'EDGE', options: [['high', 'RISING'], ['low', 'FALLING'], ['either way', 'BOTH']] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 60,
    tooltip: 'Pause the program until an input pin changes',
  },
]);

const gpio = (): void => { gen.markGpio(); gen.addImport('gpio', 'import RPi.GPIO as GPIO'); };

pythonGenerator.forBlock['rpi_on_edge'] = function (block, generator) {
  gpio();
  const pin = block.getFieldValue('PIN');
  const edge = block.getFieldValue('EDGE');
  const bounce = block.getFieldValue('BOUNCE');
  const inner = block.getInputTargetBlock('DO');
  const body = inner ? (generator.blockToCode(inner) as string) : '';
  const fn = `_on_pin_${pin}`;
  const indented = body.split('\n').map((l) => (l ? '    ' + l : l)).join('\n').replace(/\n+$/, '') || '    pass';
  gen.addDef(`cb_${pin}`, `def ${fn}(channel):\n${indented}`);
  return `GPIO.add_event_detect(${pin}, GPIO.${edge}, callback=${fn}, bouncetime=${bounce})\n`;
};

pythonGenerator.forBlock['rpi_wait_edge'] = function (block) {
  gpio();
  const pin = block.getFieldValue('PIN');
  const edge = block.getFieldValue('EDGE');
  return `GPIO.wait_for_edge(${pin}, GPIO.${edge})\n`;
};

import * as Blockly from 'blockly';
import { pythonGenerator, gen } from '../pythonSetup';

// Program-structure blocks: "on start" (runs once) and "repeat forever" (the main
// loop). Their generators stash the inner code into the generator's accumulators;
// pythonSetup's finish() wraps the loop in try/except KeyboardInterrupt/finally so
// Ctrl+C (the Stop button) exits cleanly and always runs GPIO.cleanup().

Blockly.defineBlocksWithJsonArray([
  {
    type: 'rpi_setup',
    message0: 'on start %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 200,
    tooltip: 'Runs once when the program starts',
  },
  {
    type: 'rpi_loop',
    message0: 'repeat forever %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 200,
    tooltip: 'Runs over and over until you press Stop',
  },
  {
    type: 'rpi_cleanup',
    message0: 'reset all pins',
    previousStatement: null,
    nextStatement: null,
    colour: 200,
    tooltip: 'Release the GPIO pins (GPIO.cleanup())',
  },
]);

pythonGenerator.forBlock['rpi_setup'] = function (block, generator) {
  const inner = block.getInputTargetBlock('DO');
  gen.rpiSetup_ += inner ? (generator.blockToCode(inner) as string) : '';
  return '';
};

pythonGenerator.forBlock['rpi_loop'] = function (block, generator) {
  const inner = block.getInputTargetBlock('DO');
  gen.rpiLoop_ += inner ? (generator.blockToCode(inner) as string) : '';
  return '';
};

pythonGenerator.forBlock['rpi_cleanup'] = function () {
  gen.markGpio();
  return 'GPIO.cleanup()\n';
};

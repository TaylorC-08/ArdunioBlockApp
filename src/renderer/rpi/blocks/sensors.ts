import * as Blockly from 'blockly';
import { Order } from 'blockly/python';
import { pythonGenerator, gen } from '../pythonSetup';

// Common sensors. HC-SR04 needs no library (bit-banged with GPIO + time). DHT uses
// the adafruit_dht package — install it with the "Install Python Package" tool
// (pip: adafruit-circuitpython-dht).

Blockly.defineBlocksWithJsonArray([
  {
    type: 'rpi_hcsr04',
    message0: 'distance (cm) trig pin %1 echo pin %2',
    args0: [
      { type: 'field_number', name: 'TRIG', value: 23, min: 0, max: 27, precision: 1 },
      { type: 'field_number', name: 'ECHO', value: 24, min: 0, max: 27, precision: 1 },
    ],
    output: 'Number',
    colour: 340,
    tooltip: 'Measure distance with an HC-SR04 ultrasonic sensor (set trig as output, echo as input first)',
  },
  {
    type: 'rpi_dht_read',
    message0: 'DHT11 pin %1 read %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 4, min: 0, max: 27, precision: 1 },
      { type: 'field_dropdown', name: 'KIND', options: [['temperature °C', 'temperature'], ['humidity %', 'humidity']] },
    ],
    output: 'Number',
    colour: 340,
    tooltip: 'Read temperature or humidity from a DHT11 sensor (needs the adafruit_dht package)',
  },
]);

const HCSR04_HELPER =
  'def _hcsr04(trig, echo):\n' +
  '    GPIO.output(trig, False)\n' +
  '    time.sleep(0.0002)\n' +
  '    GPIO.output(trig, True)\n' +
  '    time.sleep(0.00001)\n' +
  '    GPIO.output(trig, False)\n' +
  '    deadline = time.time() + 0.05\n' +
  '    start = time.time()\n' +
  '    while GPIO.input(echo) == 0 and time.time() < deadline:\n' +
  '        start = time.time()\n' +
  '    stop = time.time()\n' +
  '    while GPIO.input(echo) == 1 and time.time() < deadline:\n' +
  '        stop = time.time()\n' +
  '    return round((stop - start) * 17150, 1)';

pythonGenerator.forBlock['rpi_hcsr04'] = function (block) {
  gen.markGpio();
  gen.addImport('gpio', 'import RPi.GPIO as GPIO');
  gen.addImport('time', 'import time');
  gen.addDef('hcsr04', HCSR04_HELPER);
  const trig = block.getFieldValue('TRIG');
  const echo = block.getFieldValue('ECHO');
  return [`_hcsr04(${trig}, ${echo})`, Order.FUNCTION_CALL];
};

pythonGenerator.forBlock['rpi_dht_read'] = function (block) {
  gen.addImport('adafruit_dht', 'import adafruit_dht');
  gen.addImport('board', 'import board');
  const pin = block.getFieldValue('PIN');
  const kind = block.getFieldValue('KIND');
  gen.addDef(`dht_${pin}`, `_dht_${pin} = adafruit_dht.DHT11(getattr(board, 'D${pin}'))`);
  return [`_dht_${pin}.${kind}`, Order.MEMBER];
};

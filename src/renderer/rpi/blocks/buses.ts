import * as Blockly from 'blockly';
import { Order } from 'blockly/python';
import { pythonGenerator, gen } from '../pythonSetup';

// I2C (smbus2) and SPI (spidev). A single bus object is created once at module top
// and reused. Addresses/registers are text fields so hex like 0x48 can be entered.

Blockly.defineBlocksWithJsonArray([
  {
    type: 'rpi_i2c_write',
    message0: 'I2C write to %1 register %2 value %3',
    args0: [
      { type: 'field_input', name: 'ADDR', text: '0x48' },
      { type: 'field_input', name: 'REG', text: '0x00' },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 300,
    tooltip: 'Write a byte to an I2C device register',
  },
  {
    type: 'rpi_i2c_read',
    message0: 'I2C read from %1 register %2',
    args0: [
      { type: 'field_input', name: 'ADDR', text: '0x48' },
      { type: 'field_input', name: 'REG', text: '0x00' },
    ],
    output: 'Number',
    colour: 300,
    tooltip: 'Read a byte from an I2C device register',
  },
  {
    type: 'rpi_spi_transfer',
    message0: 'SPI transfer %1',
    args0: [{ type: 'input_value', name: 'DATA' }],
    output: null,
    colour: 300,
    tooltip: 'Send a list of bytes over SPI and return the bytes received',
  },
]);

function ensureI2c(): void {
  gen.addImport('smbus2', 'from smbus2 import SMBus');
  gen.addDef('i2c_bus', '_i2c = SMBus(1)');
}
function ensureSpi(): void {
  gen.addImport('spidev', 'import spidev');
  gen.addDef('spi_bus', '_spi = spidev.SpiDev()\n_spi.open(0, 0)\n_spi.max_speed_hz = 1000000');
}

pythonGenerator.forBlock['rpi_i2c_write'] = function (block, generator) {
  ensureI2c();
  const addr = block.getFieldValue('ADDR');
  const reg = block.getFieldValue('REG');
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || '0';
  return `_i2c.write_byte_data(${addr}, ${reg}, ${value})\n`;
};

pythonGenerator.forBlock['rpi_i2c_read'] = function (block) {
  ensureI2c();
  const addr = block.getFieldValue('ADDR');
  const reg = block.getFieldValue('REG');
  return [`_i2c.read_byte_data(${addr}, ${reg})`, Order.FUNCTION_CALL];
};

pythonGenerator.forBlock['rpi_spi_transfer'] = function (block, generator) {
  ensureSpi();
  const data = generator.valueToCode(block, 'DATA', Order.NONE) || '[]';
  return [`_spi.xfer2(${data})`, Order.FUNCTION_CALL];
};

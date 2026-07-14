import * as Blockly from 'blockly';
import { pythonGenerator } from './pythonSetup';

// Barrel — importing this module configures the Python generator and registers all
// Raspberry Pi block definitions as side effects, then exposes the toolbox.
import './blocks/structure';
import './blocks/gpio';
import './blocks/pwm';
import './blocks/events';
import './blocks/buses';
import './blocks/sensors';

export const rpiToolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Structure', colour: '#C49A3F',
      contents: [
        { kind: 'block', type: 'rpi_setup' },
        { kind: 'block', type: 'rpi_loop' },
        { kind: 'block', type: 'rpi_cleanup' },
      ],
    },
    {
      kind: 'category', name: 'GPIO', colour: '#A6328C',
      contents: [
        { kind: 'block', type: 'rpi_pin_setup' },
        { kind: 'block', type: 'rpi_digital_write' },
        { kind: 'block', type: 'rpi_digital_read' },
      ],
    },
    {
      kind: 'category', name: 'PWM & Servo', colour: '#5C68A6',
      contents: [
        { kind: 'block', type: 'rpi_pwm_start' },
        { kind: 'block', type: 'rpi_pwm_duty' },
        { kind: 'block', type: 'rpi_pwm_stop' },
        { kind: 'block', type: 'rpi_servo_attach' },
        { kind: 'block', type: 'rpi_servo_write' },
      ],
    },
    {
      kind: 'category', name: 'Events', colour: '#B89A2B',
      contents: [
        { kind: 'block', type: 'rpi_on_edge' },
        { kind: 'block', type: 'rpi_wait_edge' },
      ],
    },
    {
      kind: 'category', name: 'Buses', colour: '#8A5CA6',
      contents: [
        { kind: 'block', type: 'rpi_i2c_write' },
        { kind: 'block', type: 'rpi_i2c_read' },
        { kind: 'block', type: 'rpi_spi_transfer' },
      ],
    },
    {
      kind: 'category', name: 'Sensors', colour: '#A6497A',
      contents: [
        { kind: 'block', type: 'rpi_hcsr04' },
        { kind: 'block', type: 'rpi_dht_read' },
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

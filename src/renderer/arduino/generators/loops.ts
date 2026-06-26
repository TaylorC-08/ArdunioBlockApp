import * as Blockly from 'blockly';
import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

arduinoGenerator.forBlock['controls_repeat_ext'] = function(block, generator) {
  const repeats = generator.valueToCode(block, 'TIMES', ArduinoGenerator.ORDER_ADDITIVE) || '0';
  const branch = generator.statementToCode(block, 'DO');
  // Declare loop var inline — valid C++11, supported by Arduino IDE
  return `for (int _i = 0; _i < ${repeats}; _i++) {\n${branch}}\n`;
};

arduinoGenerator.forBlock['controls_whileUntil'] = function(block, generator) {
  const until = block.getFieldValue('MODE') === 'UNTIL';
  let condition = generator.valueToCode(block, 'BOOL', ArduinoGenerator.ORDER_NONE) || 'false';
  if (until) condition = `!(${condition})`;
  const branch = generator.statementToCode(block, 'DO');
  return `while (${condition}) {\n${branch}}\n`;
};

arduinoGenerator.forBlock['controls_for'] = function(block, generator) {
  const varName = generator.nameDB_!.getName(
    block.getFieldValue('VAR'),
    Blockly.Names.NameType.VARIABLE,
  );
  const from = generator.valueToCode(block, 'FROM', ArduinoGenerator.ORDER_ASSIGNMENT) || '0';
  const to   = generator.valueToCode(block, 'TO',   ArduinoGenerator.ORDER_ASSIGNMENT) || '0';
  const by   = generator.valueToCode(block, 'BY',   ArduinoGenerator.ORDER_ASSIGNMENT) || '1';
  const branch = generator.statementToCode(block, 'DO');
  // Variable is already globally declared by the variables generator
  return `for (${varName} = ${from}; ${varName} <= ${to}; ${varName} += ${by}) {\n${branch}}\n`;
};

arduinoGenerator.forBlock['controls_flow_statements'] = function(block) {
  return block.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n';
};

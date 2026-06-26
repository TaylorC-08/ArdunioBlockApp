import * as Blockly from 'blockly';
import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

arduinoGenerator.forBlock['variables_get'] = function(block, generator) {
  const varName = generator.nameDB_!.getName(
    block.getFieldValue('VAR'),
    Blockly.Names.NameType.VARIABLE,
  );
  (generator as ArduinoGenerator).usedVariables_.add(varName);
  return [varName, ArduinoGenerator.ORDER_ATOMIC];
};

arduinoGenerator.forBlock['variables_set'] = function(block, generator) {
  const varName = generator.nameDB_!.getName(
    block.getFieldValue('VAR'),
    Blockly.Names.NameType.VARIABLE,
  );
  (generator as ArduinoGenerator).usedVariables_.add(varName);
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_ASSIGNMENT) || '0';
  return `${varName} = ${value};\n`;
};

arduinoGenerator.forBlock['math_change'] = function(block, generator) {
  const varName = generator.nameDB_!.getName(
    block.getFieldValue('VAR'),
    Blockly.Names.NameType.VARIABLE,
  );
  (generator as ArduinoGenerator).usedVariables_.add(varName);
  const delta = generator.valueToCode(block, 'DELTA', ArduinoGenerator.ORDER_ADDITIVE) || '0';
  return `${varName} += ${delta};\n`;
};

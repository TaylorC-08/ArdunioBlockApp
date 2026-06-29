import * as Blockly from 'blockly';
import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

// User-defined functions map onto Blockly's standard procedure blocks. Definitions are
// emitted at global scope (before setup) via definitions_; calls become C function calls.
// Parameters and a value-returning function default to int — the block model doesn't
// carry C types, and the editor keeps the original sketch for exact types.

type ProcBlock = Blockly.Block & { getVars: () => string[] };

function defineProcedure(block: Blockly.Block, generator: ArduinoGenerator): string {
  const name = generator.nameDB_!.getName(block.getFieldValue('NAME'), Blockly.Names.NameType.PROCEDURE);
  const params = (block as ProcBlock).getVars().map(
    v => 'int ' + generator.nameDB_!.getName(v, Blockly.Names.NameType.VARIABLE),
  );
  const hasReturn = !!block.getInput('RETURN');
  const body = block.getInput('STACK') ? generator.statementToCode(block, 'STACK') : '';
  let code = `${hasReturn ? 'int' : 'void'} ${name}(${params.join(', ')}) {\n${body}`;
  if (hasReturn) {
    const ret = generator.valueToCode(block, 'RETURN', ArduinoGenerator.ORDER_NONE) || '0';
    code += `  return ${ret};\n`;
  }
  code += '}';
  generator.definitions_[`procedure_${name}`] = code;
  return '';
}

arduinoGenerator.forBlock['procedures_defnoreturn'] = function(block, generator) {
  return defineProcedure(block, generator as ArduinoGenerator);
};
arduinoGenerator.forBlock['procedures_defreturn'] = function(block, generator) {
  return defineProcedure(block, generator as ArduinoGenerator);
};

arduinoGenerator.forBlock['procedures_callreturn'] = function(block, generator) {
  const name = generator.nameDB_!.getName(block.getFieldValue('NAME'), Blockly.Names.NameType.PROCEDURE);
  const args = (block as ProcBlock).getVars().map(
    (_v, i) => generator.valueToCode(block, 'ARG' + i, ArduinoGenerator.ORDER_NONE) || '0',
  );
  return [`${name}(${args.join(', ')})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['procedures_callnoreturn'] = function(block, generator) {
  const tuple = arduinoGenerator.forBlock['procedures_callreturn']!(block, generator) as [string, number];
  return tuple[0] + ';\n';
};

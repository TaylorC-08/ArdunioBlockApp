import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

arduinoGenerator.forBlock['controls_if'] = function(block, generator) {
  let n = 0;
  let code = '';
  do {
    const condition = generator.valueToCode(block, 'IF' + n, ArduinoGenerator.ORDER_NONE) || 'false';
    const branch = generator.statementToCode(block, 'DO' + n);
    code += (n > 0 ? ' else ' : '') + `if (${condition}) {\n${branch}}`;
    n++;
  } while (block.getInput('IF' + n));

  if (block.getInput('ELSE')) {
    const branch = generator.statementToCode(block, 'ELSE');
    code += ` else {\n${branch}}`;
  }
  return code + '\n';
};

arduinoGenerator.forBlock['logic_compare'] = function(block, generator) {
  const ops: {[key: string]: [string, number]} = {
    EQ:  ['==', ArduinoGenerator.ORDER_EQUALITY],
    NEQ: ['!=', ArduinoGenerator.ORDER_EQUALITY],
    LT:  ['<',  ArduinoGenerator.ORDER_RELATIONAL],
    LTE: ['<=', ArduinoGenerator.ORDER_RELATIONAL],
    GT:  ['>',  ArduinoGenerator.ORDER_RELATIONAL],
    GTE: ['>=', ArduinoGenerator.ORDER_RELATIONAL],
  };
  const op = block.getFieldValue('OP') as string;
  const [operator, order] = ops[op];
  const a = generator.valueToCode(block, 'A', order) || '0';
  const b = generator.valueToCode(block, 'B', order) || '0';
  return [`${a} ${operator} ${b}`, order];
};

arduinoGenerator.forBlock['logic_operation'] = function(block, generator) {
  const isAnd = block.getFieldValue('OP') === 'AND';
  const op = isAnd ? '&&' : '||';
  const order = isAnd ? ArduinoGenerator.ORDER_LOGICAL_AND : ArduinoGenerator.ORDER_LOGICAL_OR;
  const a = generator.valueToCode(block, 'A', order) || 'false';
  const b = generator.valueToCode(block, 'B', order) || 'false';
  return [`${a} ${op} ${b}`, order];
};

arduinoGenerator.forBlock['logic_negate'] = function(block, generator) {
  const arg = generator.valueToCode(block, 'BOOL', ArduinoGenerator.ORDER_UNARY_PREFIX) || 'false';
  return [`!${arg}`, ArduinoGenerator.ORDER_UNARY_PREFIX];
};

arduinoGenerator.forBlock['logic_boolean'] = function(block) {
  return [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', ArduinoGenerator.ORDER_ATOMIC];
};

arduinoGenerator.forBlock['logic_null'] = function() {
  return ['0', ArduinoGenerator.ORDER_ATOMIC];
};

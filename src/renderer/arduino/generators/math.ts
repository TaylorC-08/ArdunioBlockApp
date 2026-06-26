import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

arduinoGenerator.forBlock['math_number'] = function(block) {
  const num = block.getFieldValue('NUM');
  return [String(num), ArduinoGenerator.ORDER_ATOMIC];
};

arduinoGenerator.forBlock['math_arithmetic'] = function(block, generator) {
  const ops: {[key: string]: [string, number]} = {
    ADD:      [' + ', ArduinoGenerator.ORDER_ADDITIVE],
    MINUS:    [' - ', ArduinoGenerator.ORDER_ADDITIVE],
    MULTIPLY: [' * ', ArduinoGenerator.ORDER_MULTIPLICATIVE],
    DIVIDE:   [' / ', ArduinoGenerator.ORDER_MULTIPLICATIVE],
    POWER:    ['',    ArduinoGenerator.ORDER_NONE], // handled below
  };
  const op = block.getFieldValue('OP') as string;
  const [operator, order] = ops[op];
  const a = generator.valueToCode(block, 'A', order) || '0';
  const b = generator.valueToCode(block, 'B', order) || '0';
  if (op === 'POWER') {
    return [`pow(${a}, ${b})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
  }
  return [`${a}${operator}${b}`, order];
};

arduinoGenerator.forBlock['math_single'] = function(block, generator) {
  const op  = block.getFieldValue('OP') as string;
  const arg = generator.valueToCode(block, 'NUM', ArduinoGenerator.ORDER_UNARY_PREFIX) || '0';
  const post = ArduinoGenerator.ORDER_UNARY_POSTFIX;
  switch (op) {
    case 'ROOT':  return [`sqrt(${arg})`, post];
    case 'ABS':   return [`abs(${arg})`, post];
    case 'NEG':   return [`-${arg}`, ArduinoGenerator.ORDER_UNARY_PREFIX];
    case 'LN':    return [`log(${arg})`, post];
    case 'LOG10': return [`log10(${arg})`, post];
    case 'EXP':   return [`exp(${arg})`, post];
    case 'POW10': return [`pow(10, ${arg})`, post];
    // Convert degrees to radians for trig
    case 'SIN':   return [`sin((${arg}) * M_PI / 180.0)`, post];
    case 'COS':   return [`cos((${arg}) * M_PI / 180.0)`, post];
    case 'TAN':   return [`tan((${arg}) * M_PI / 180.0)`, post];
    case 'ASIN':  return [`asin(${arg}) * 180.0 / M_PI`, post];
    case 'ACOS':  return [`acos(${arg}) * 180.0 / M_PI`, post];
    case 'ATAN':  return [`atan(${arg}) * 180.0 / M_PI`, post];
    default:      return [`abs(${arg})`, post];
  }
};

arduinoGenerator.forBlock['math_constant'] = function(block) {
  const constants: {[key: string]: [string, number]} = {
    PI:     ['M_PI',   ArduinoGenerator.ORDER_ATOMIC],
    E:      ['M_E',    ArduinoGenerator.ORDER_ATOMIC],
    GOLDEN_RATIO: ['1.61803398875', ArduinoGenerator.ORDER_ATOMIC],
    SQRT2:  ['M_SQRT2', ArduinoGenerator.ORDER_ATOMIC],
    SQRT1_2:['0.7071067811865476', ArduinoGenerator.ORDER_ATOMIC],
    INFINITY:['INFINITY', ArduinoGenerator.ORDER_ATOMIC],
  };
  const key = block.getFieldValue('CONSTANT') as string;
  return constants[key] ?? ['0', ArduinoGenerator.ORDER_ATOMIC];
};

arduinoGenerator.forBlock['math_number_property'] = function(block, generator) {
  const num = generator.valueToCode(block, 'NUMBER_TO_CHECK', ArduinoGenerator.ORDER_MULTIPLICATIVE) || '0';
  const prop = block.getFieldValue('PROPERTY') as string;
  switch (prop) {
    case 'EVEN': return [`(${num} % 2 == 0)`, ArduinoGenerator.ORDER_EQUALITY];
    case 'ODD':  return [`(${num} % 2 != 0)`, ArduinoGenerator.ORDER_EQUALITY];
    case 'POSITIVE': return [`(${num} > 0)`, ArduinoGenerator.ORDER_RELATIONAL];
    case 'NEGATIVE': return [`(${num} < 0)`, ArduinoGenerator.ORDER_RELATIONAL];
    default:     return [`(${num} > 0)`, ArduinoGenerator.ORDER_RELATIONAL];
  }
};

arduinoGenerator.forBlock['math_constrain'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_NONE) || '0';
  const low   = generator.valueToCode(block, 'LOW',   ArduinoGenerator.ORDER_NONE) || '0';
  const high  = generator.valueToCode(block, 'HIGH',  ArduinoGenerator.ORDER_NONE) || '255';
  return [`constrain(${value}, ${low}, ${high})`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['math_random_int'] = function(block, generator) {
  const from = generator.valueToCode(block, 'FROM', ArduinoGenerator.ORDER_NONE) || '0';
  const to   = generator.valueToCode(block, 'TO',   ArduinoGenerator.ORDER_NONE) || '100';
  // Arduino random(min, max) returns min <= x < max, so add 1 to match Blockly's inclusive range
  return [`random(${from}, ${to} + 1)`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

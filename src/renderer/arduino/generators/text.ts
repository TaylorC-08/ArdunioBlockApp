import { arduinoGenerator, ArduinoGenerator } from '../arduinoGenerator';

arduinoGenerator.forBlock['text'] = function(block, generator) {
  return [(generator as ArduinoGenerator).quote_(block.getFieldValue('TEXT')), ArduinoGenerator.ORDER_ATOMIC];
};

arduinoGenerator.forBlock['text_print'] = function(block, generator) {
  // Ensure Serial.begin(9600) runs in setup()
  generator.definitions_['setup_serial_begin'] = 'Serial.begin(9600);';
  const msg = generator.valueToCode(block, 'TEXT', ArduinoGenerator.ORDER_NONE) || '""';
  return `Serial.println(${msg});\n`;
};

arduinoGenerator.forBlock['text_join'] = function(block, generator) {
  const count = (block as any).itemCount_ as number;
  if (count === 0) return ['String()', ArduinoGenerator.ORDER_ATOMIC];
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const piece = generator.valueToCode(block, `ADD${i}`, ArduinoGenerator.ORDER_NONE) || '""';
    parts.push(`String(${piece})`);
  }
  return [parts.join(' + '), ArduinoGenerator.ORDER_ADDITIVE];
};

arduinoGenerator.forBlock['text_length'] = function(block, generator) {
  const text = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_UNARY_POSTFIX) || '""';
  return [`String(${text}).length()`, ArduinoGenerator.ORDER_UNARY_POSTFIX];
};

arduinoGenerator.forBlock['text_isEmpty'] = function(block, generator) {
  const text = generator.valueToCode(block, 'VALUE', ArduinoGenerator.ORDER_UNARY_POSTFIX) || '""';
  return [`(String(${text}).length() == 0)`, ArduinoGenerator.ORDER_EQUALITY];
};

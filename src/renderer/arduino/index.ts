// Barrel — importing this module registers all generators and block definitions as side effects
export { arduinoGenerator, ArduinoGenerator } from './arduinoGenerator';
import './generators/logic';
import './generators/loops';
import './generators/math';
import './generators/text';
import './generators/variables';
import './generators/procedures';
import './blocks/arduinoBlocks';
import './blocks/stringBlocks';
import './blocks/deviceBlocks';

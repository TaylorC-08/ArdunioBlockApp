const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function main() {
  try {
    // Ensure output directories exist
    fs.mkdirSync('dist/renderer', { recursive: true });

    // Copy index.html
    const htmlSrc = 'src/renderer/index.html';
    if (!fs.existsSync(htmlSrc)) {
      throw new Error(`Source file not found: ${htmlSrc}`);
    }
    fs.copyFileSync(htmlSrc, 'dist/renderer/index.html');
    console.log('✓ Copied index.html');

    // Copy Blockly media assets
    const mediaSrc = 'node_modules/blockly/media';
    const mediaDest = 'dist/renderer/media';
    if (!fs.existsSync(mediaSrc)) {
      console.warn('⚠ Blockly media directory not found at', mediaSrc);
      console.warn('  Run "npm install" first. Media assets will be missing.');
      return;
    }
    copyDir(mediaSrc, mediaDest);
    console.log('✓ Copied blockly/media');
  } catch (err) {
    console.error('✗ Asset copy failed:', err.message);
    process.exitCode = 1;
  }
}

main();
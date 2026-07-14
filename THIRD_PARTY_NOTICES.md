# Third-Party Notices

SketchBlocks is MIT-licensed (see [LICENSE](LICENSE)) and ships with, or downloads, the following third-party components.

## Bundled in the application

| Component | License | Source |
|---|---|---|
| Electron (incl. Chromium, Node.js) | MIT (Chromium: BSD-style; see the `LICENSES.chromium.html` shipped with the app) | https://github.com/electron/electron |
| Blockly | Apache-2.0 | https://github.com/google/blockly |
| Monaco Editor | MIT | https://github.com/microsoft/monaco-editor |
| ssh2 | MIT | https://github.com/mscdex/ssh2 |
| extract-zip | BSD-2-Clause | https://github.com/maxogden/extract-zip |

## Bundled example sketches

The example sketches under `src/renderer/examples/sketches/` come from the official
[arduino/arduino-examples](https://github.com/arduino/arduino-examples) repository.
Per their file headers, they are in the **public domain**, except `ArduinoISP.ino`
which is **BSD-licensed** (https://opensource.org/licenses/bsd-license.php).

The Raspberry Pi example programs under `src/renderer/rpi/examples/` are **original
works** authored for SketchBlocks and are covered by this project's MIT license.

## Downloaded at first run (not bundled)

| Component | License | Source |
|---|---|---|
| arduino-cli | GPL-3.0 | https://github.com/arduino/arduino-cli |
| Arduino AVR core (`arduino:avr`) | GPL-2.0/LGPL (per component) | https://github.com/arduino/ArduinoCore-avr |

These are fetched from the official Arduino GitHub releases at the user's request
during guided setup (checksum-verified), installed into the user's profile, and are
not distributed with SketchBlocks itself.

## Trademarks

"Arduino" is a trademark of Arduino SA. SketchBlocks is an independent project and is
not affiliated with or endorsed by Arduino.

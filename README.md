# SketchBlocks

Visual block-based programming for Arduino boards. Drag blocks, watch real C++ appear live, then compile and upload to your board — or type the code yourself and turn it back into blocks.

## Features

- **Block coding with live C++** — a Blockly workspace generates readable Arduino C++ as you build, side by side with a full Monaco code editor.
- **Code → Blocks** — open or paste a sketch and SketchBlocks reconstructs blocks from the recognized subset of the code (the original code is always kept verbatim).
- **Bundled examples** — the official Arduino example sketches, browsable in-app and convertible to blocks.
- **Verify & Upload** — compiles with `arduino-cli`, underlines errors in the editor, and flashes the selected board. Missing libraries are detected and offered for one-click install.
- **Serial monitor & plotter** — stream text from the board or plot numeric values live.
- **Raspberry Pi mode** — a full second environment that generates Python (RPi.GPIO) instead of C++:
  - An **on-start / repeat-forever** block structure that produces idiomatic Python with a
    `try/except KeyboardInterrupt/finally: GPIO.cleanup()` scaffold, so pins are always released.
  - Blocks for digital I/O (with pull-up/down), PWM & servo, edge events, I2C/SPI, and common
    sensors (HC-SR04, DHT), plus all the standard logic/loop/math blocks.
  - **Run over SSH** with live streaming output and a **Stop** button (Stop sends Ctrl-C so your
    program's cleanup runs). Host keys are verified trust-on-first-use.
  - **Python → Blocks** import, bundled example programs, and one-click **pip install** on the Pi.
  - Projects save as `.py` with the blocks embedded, so they reopen exactly.

## Install (Windows)

1. Download the latest `SketchBlocks-Setup-*.exe` from [Releases](../../releases) and run it.
   - The installer is not code-signed, so Windows SmartScreen will show an "unrecognized app" warning — click **More info → Run anyway**.
2. Launch SketchBlocks. The first time you click **Verify** or **Upload**, the app offers to download the free [arduino-cli](https://arduino.github.io/arduino-cli/) tool and Arduino AVR board support (about 25 MB, fetched from the official Arduino release and checksum-verified). One click and you're ready.
3. Plug in your board, click **⟳** to detect it, and upload. Clone boards (CH340/CP210x chips) may need their USB driver installed once.

## Build from source

Requires Node.js 20+.

```
npm install
npm start          # build and run
npm run dev        # watch mode
npm run typecheck  # typecheck main + renderer
npm run dist       # build the Windows installer into release/
```

## License

MIT — see [LICENSE](LICENSE). Bundled third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

SketchBlocks is an independent project, not affiliated with or endorsed by Arduino. "Arduino" is a trademark of Arduino SA.

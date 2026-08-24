# @dsh-community/dsh-desktop-app

Lightweight native desktop client and tray companion for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), built on **Tauri 2.0**.

## Architecture Overview

1. **Process Lifecycle Management (Rust)**:
   - Spawns the local `dsh` web server (`dsh --profile web`) upon desktop launch.
   - Monitors the server lifecycle and terminates the background process cleanly upon app exit.
2. **Embedded WebView**:
   - Embeds the local DSH Web UI directly inside a native OS window with smooth hardware acceleration.
3. **System Tray Companion**:
   - Provides a system tray icon with quick actions:
     - Show / Focus Main Window
     - Open Active Session
     - Quit Application & Clean Subprocesses

## Development

```sh
# Run the desktop app in development mode
pnpm --filter @dsh-community/dsh-desktop-app dev

# Run in HUD mode
pnpm --filter @dsh-community/dsh-desktop-app dev:hud

# Run test suite
node --test test/startup-config.test.mjs test/window-config.test.mjs
```

## Production Build

```sh
# Build native binaries for your current platform (MSI/EXE on Windows, DMG/App on macOS, AppImage/deb on Linux)
pnpm --filter @dsh-community/dsh-desktop-app tauri build
```

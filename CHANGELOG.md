# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.5] - 2026-09-01

### Added
- Rust/Tauri native desktop shell with a supervised Node.js DSH sidecar.
- Native menus, tray, notifications, workspaces, companion window and recovery UI.
- Signed GitHub Releases updater with a public verification key and protected CI signing key.

### Changed
- Rust/Tauri is now the only desktop build, development and release target.
- Workspace selection uses the native Windows folder picker and immediately enters the selected workspace.

### Removed
- The retired Electron shell, packaging scripts, dependencies and compatibility tests.

### Removed
- Startup full-window loading spinner; the web UI now appears directly once the embedded host is ready.
- Host HTTP readiness polling before first window load (the cordis boot promise already guarantees the web server is listening).
- Dead IPC surface: preload `startDraggingPet` / `openSession` / `newChat` bridges with no main-process handlers, and the never-mounted `AttentionCard` component (`shell.overlay` slot remains unpublished).

### Changed
- Plugin ↔ shell IPC consolidated onto the single `__DSH_DESKTOP_BRIDGE__` channel.
- Documentation aligned with the Rust/Tauri shell and sidecar architecture.

## [0.1.2] - 2026-08-30

### Fixed
- Restore the Electron DSH runtime dependency surface required by the profile loader.
- Remove the pet-window debug DOM dump and suppress the developer-tools application-menu entry.

## [0.2.11]

- Use DSH Web's in-app directory browser for workspace selection.
- Automatically migrate existing desktop profiles from the native directory picker.

## [0.2.10]

- Keep the web sidebar toggle callable after hiding its duplicate visual control.
- Disable automatic app launch after NSIS completion to prevent the installer Finish step from waiting on the desktop host.

## [0.2.9]

- Fix the top sidebar toggle when the web UI button has no accessible label.
- Hide the duplicate web UI sidebar toggle and add an exit timeout so installer completion cannot wait indefinitely.

## [0.2.8]

- Use a frameless custom title bar so the application menu shares one row with the window title and controls.
- Follow the system language for the title-bar menu and prevent confusion with older packaged builds.

## [0.1.1] - 2026-08-25

### Fixed & Improved
- Grant remote dsh origin IPC access to app commands in the desktop shell.
- Pin in-app directory browser via desktop patch to ensure Add Workspace dialog reliably renders inside desktop WebView.
- Harden desktop environment checks and screen capture utilities.
- Add recent sessions tray menu to desktop app for rapid switching.
- Refactor and expand JSDoc comments and TypeScript definitions across client UI components.

## [0.1.0] - 2026-08-24

### Added
- Dual-sided Cordis plugin `@mixian/dsh-desktop-plugin` supporting DSH Web and native runtimes.
- Real-time desktop interaction notifications with baseline snapshot seeding and deduplication.
- Opt-in `screen_capture` tool with cross-platform native commands (Windows PowerShell GDI, macOS `screencapture`, Linux `scrot`/`gnome-screenshot`) and transparent conversation attachments.
- Multi-agent tiling status grid view (`conversation.view` tab).
- Complete bilingual locale dictionaries (`zh` and `en`) with 100% key parity.
- Comprehensive native test suite covering locales, config schemas, screen capture formatting, notifier state machine, and desktop startup configurations.
- Automated bundle integrity verification script (`scripts/verify-bundle.mjs`).
- GitHub Actions CI workflow supporting Node.js 22/24 across Ubuntu, Windows, and macOS.
- Community guidelines: `CONTRIBUTING.md`, `SECURITY.md`, issue and pull request templates.

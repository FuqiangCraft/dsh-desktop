# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-27

### Added
- Add a native always-on-top desktop companion with expressive state-driven animations.
- Add companion controls and appearance settings to the desktop settings UI.
- Add signed automatic-update support for desktop application releases.

### Fixed & Improved
- Use custom plugin navigation artwork and remove the legacy woodfish character.
- Rotate the companion around its own axis for natural movement.
- Improve updater error messages with human-readable fallbacks.
- Make new-chat triggering reliable on Linux GTK/WebKit environments.
- Prevent duplicate desktop instances and restore the existing window on relaunch.
- Keep the background DSH host silent so desktop startup does not open a separate browser surface.
- Add built-in persistent pet settings independent of Web plugin installation; the companion is hidden by default until enabled.
- Refresh English and Chinese documentation for community plugin conventions.

## [0.1.1] - 2026-08-25

### Fixed & Improved
- Grant remote dsh origin IPC access to app commands in Tauri shell.
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
- Native Tauri 2.0 desktop shell managing DSH web server lifecycle and tray controls.
- Comprehensive native test suite covering locales, config schemas, screen capture formatting, notifier state machine, and Tauri startup configurations.
- Automated bundle integrity verification script (`scripts/verify-bundle.mjs`).
- GitHub Actions CI workflow supporting Node.js 22/24 across Ubuntu, Windows, and macOS.
- Community guidelines: `CONTRIBUTING.md`, `SECURITY.md`, issue and pull request templates.

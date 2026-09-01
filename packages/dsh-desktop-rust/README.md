# DSH Desktop Rust Host

This package is the native process boundary for the desktop application. It
supervises the Node.js DSH sidecar while Cordis and existing NPM plugins remain
fully compatible.

The Tauri shell starts the sidecar, loads its local DSH UI and exposes a
capability-scoped settings/window bridge. Rust owns the tray, recent-session
shortcuts, native notifications, the transparent companion window, validated
custom PNG resources, signed updates and production packaging.

```powershell
pnpm --filter @dsh-community/dsh-desktop-sidecar build
cargo run -p dsh-desktop-host
```

To start the Rust desktop shell during development:

```powershell
pnpm dev
```

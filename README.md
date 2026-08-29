# DeepSeek Harness Desktop Pro

[![CI](https://github.com/FuqiangCraft/dsh-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/FuqiangCraft/dsh-desktop/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@mixian/dsh-desktop-plugin.svg)](https://www.npmjs.com/package/@mixian/dsh-desktop-plugin)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Cordis plugin and a Tauri desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). The plugin adds desktop notifications for pending interactions, an opt-in `screen_capture` model tool, a multi-agent tiling canvas, a desk-pet companion window, and a desktop settings section. The shell runs `dsh --profile web` natively with tray controls.

[English](README.md) | [中文](README.zh.md)

## What it does

| Capability | Side | Notes |
|---|---|---|
| Interaction notifications | client | Subscribes to the sessions store; fires a browser desktop notification when a session waits on an approval, question, or plan review. Click opens that session. |
| `screen_capture` model tool | host | Captures the primary display and commits the screenshot into the conversation as an image attachment. **Disabled by default** — see [Consent](#consent). |
| Multi-agent tiling canvas | client | A `conversation.view` tab rendering a live, read-only grid of sessions and sub-agents from the sessions store. |
| Desk pet | client | A floating companion window (cat / robot / whale) driven by a state engine that derives pet state (idle / thinking / working / alert / success) from live sessions. Ships a custom navigation icon in the dsh nav bar. |
| Desktop settings | client | A settings section for pet preferences, window skins (frosted / anime / cyberpunk / space presets, custom uploads, blur & dim tuning), and about / update info. |
| Native shell | app | Tauri 2.0 app that starts `dsh --profile web`, embeds the local Web UI, pins in-app directory browsing, and provides tray controls with a recent-sessions menu and update checks. |

## How it plugs in

- The package declares a `dsh.bundle` manifest (object form: `{ "patch": "./cordis.patch.yml" }`) — this is what dsh recognizes as an installable plugin. `dsh.client` declares the web platform and the `@deepseek-ai/*` runtime packages it injects.
- Host side registers the `screen_capture` model tool only.
- Client side reads the sessions store and the `question/requested` interaction stream (via the `PendingWait.answer` channel) — it never registers a second `ctx.userQuestions` provider, so it works against the published runtime with no slot conflicts.
- The client bundle is a single file wrapped in the `window.__ModuleLoader__.load({ id, factory })` handshake (see `build.mjs`).

## Install

The plugin ships as [`@mixian/dsh-desktop-plugin`](https://www.npmjs.com/package/@mixian/dsh-desktop-plugin) with a dual-face Cordis bundle (`dsh.bundle` + `dsh.client`). Mount it with either mechanism:

```sh
# via a profile (recommended)
dsh plugin --profile web add @mixian/dsh-desktop-plugin

# from a source checkout
dsh plugin --profile web add ./packages/dsh-desktop-plugin

# or as a one-off overlay (no install)
dsh web --patch ./packages/dsh-desktop-plugin/cordis.patch.yml
```

### Consent

`screen_capture` exposes the operator's whole display. It is **not registered unless `screenCapture: true`** is set explicitly in the profile patch:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dsh-desktop-plugin
  config:
    screenCapture: true   # opt in: registers the screen_capture tool
```

The captured image is always surfaced back into the conversation for transparency — it is never silently injected.

### Run the desktop app

```sh
pnpm install
pnpm dev            # Electron dev
pnpm electron:package # Windows production bundle
```

Requires Node.js ≥ 22 and pnpm 11 (`corepack enable`).

## Model Experience

- The plugin adds **no tokens** when idle: the notification watcher, canvas, desk pet, and settings are client-side and read the sessions store; they never enter the model context.
- `screen_capture` adds one model-facing tool with a short description; its output is an image block in a durable `tool/result` event, subject to the same attachment limits as any image in the session. It requires a model that accepts image input.

## Known Limitations

- The floating Attention HUD targets the `shell.overlay` slot, which exists in dsh `master` but is **not yet in the published client runtime** (`@deepseek-ai/dsh-client-*@0.0.1-rc.1`). The component ships ready (`AttentionCard.tsx`) but mounts only once that slot is published.
- Screen capture is host-only and captures the primary display; multi-monitor and region capture are not supported.
- The multi-agent canvas is a read-only monitor; it does not create or attach sessions.
- Notifications use the browser desktop-notification API; native OS notifications and the `Alt+Space` global quick panel are planned, not shipped.
- Time travel, session rewind, and live fork are not implemented.

## Development

```sh
pnpm install
pnpm check          # lint + typecheck + tests + Electron build + plugin build + bundle verification
pnpm dev:plugin     # plugin dev loop
```

### Project layout

```
packages/dsh-desktop-plugin/   # dual-face Cordis plugin (dsh.bundle + dsh.client)
packages/dsh-desktop-electron/ # Electron desktop application
stubs/                         # local type-stubs for unpublished @deepseek-ai/* transitive deps
docs/                          # ARCHITECTURE_ANALYSIS + PUBLISHING_GUIDE (verified 2026-08)
```

## Documentation & community

- [Architecture analysis](docs/ARCHITECTURE_ANALYSIS.md) — dsh internals research and verified constraints
- [Publishing guide](docs/PUBLISHING_GUIDE.md) — packaging rules, registry submission, npm pitfalls
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Changelog](CHANGELOG.md)

The repo carries the `dsh-plugin`, `deepseek-harness`, and `cordis-plugin` topics for ecosystem discovery.

## License

MIT

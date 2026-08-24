# @dsh-community/dsh-desktop-plugin

![DSH Desktop Plugin logo](assets/logo.png)

Desktop-grade companion plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). Brings three desktop-class capabilities the stock web UI lacks:

1. **Native notifications for user interactions** — when any agent session enters a pending interaction (approval, question, or plan review), a browser desktop notification fires. Click it to jump into the session where the stock approval/question UI lives.
2. **`screen_capture` model tool** — captures the host display and commits the screenshot into the conversation as an image attachment, so the model can see what is on screen. **Disabled by default** (see Consent).
3. **Multi-agent tiling canvas** — a `conversation.view` tab that renders a live grid of every session and sub-agent, read straight from the sessions store.

A floating attention HUD and native OS shell (tray, global hotkey) are planned; see [Known Limitations](#known-limitations).

## Install

The plugin ships a dual-face Cordis bundle (`dsh.bundle` + `dsh.client`). Mount it with either mechanism:

```sh
# via a profile (recommended)
dsh plugin --profile web add /path/to/@dsh-community/dsh-desktop-plugin

# or as a one-off overlay
dsh web --patch /path/to/@dsh-community/dsh-desktop-plugin/cordis.patch.yml
```

Enable the opt-in `screen_capture` tool by patching the row's config:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dsh-desktop-plugin
  config:
    screenCapture: true   # opt in: registers the screen_capture tool
```

## Consent

`screen_capture` exposes the operator's whole display. It is **not registered unless `screenCapture: true`** is set explicitly, and it only fires when the model decides to call it (typically after the user asks for a screenshot). The captured image is always surfaced back into the conversation for transparency — it is never silently injected.

## Model Experience

- The plugin adds **no tokens** when idle: the notification watcher and canvas are client-side and read the sessions store; they never enter the model context.
- `screen_capture` adds one model-facing tool with a short description; its output is an image block in a durable `tool/result` event, subject to the same attachment limits as any image in the session. It requires a model that accepts image input.

## Known Limitations

- The floating attention HUD targets the `shell.overlay` frame-wide slot, which exists in DeepSeek Harness `master` but is **not yet present in the published client runtime** (`@deepseek-ai/dsh-client-*@0.0.1-rc.1`). The component ships ready but is mounted only once that slot is published. The notification watcher needs no slot and works today.
- Screen capture is host-only and captures the primary display; multi-monitor and region capture are not yet supported.
- The multi-agent canvas is a read-only monitor; it does not create or attach sessions.

## License

MIT

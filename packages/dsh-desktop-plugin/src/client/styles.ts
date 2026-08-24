/**
 * The attention-HUD stylesheet, hand-written as a template string and injected
 * once by the plugin body: the web server serves exactly one file per client
 * plugin, so no separate CSS artifact may exist. Tokens come only from the
 * shared `--dsw-alias-*` design platform (no literal colors); class names carry
 * the `dsh_desktop` prefix to stay unique in the assembled shell.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-desktop-style'

/** The plugin's injected stylesheet text. */
export const cssText = `
.dsh_desktop_attentionStack {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 320px;
  pointer-events: none;
}
.dsh_desktop_attentionCard {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: var(--dsw-alias-label-primary);
}
.dsh_desktop_attentionCard:hover {
  border-color: var(--dsw-alias-accent-primary);
}
.dsh_desktop_attentionKind {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh_desktop_attentionTitle {
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_desktop_canvas {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.dsh_desktop_canvasHeader {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh_desktop_canvasTitle {
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}
.dsh_desktop_canvasCount {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 10px;
  padding: 0 8px;
}
.dsh_desktop_canvasEmpty {
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
}
.dsh_desktop_canvasGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  min-width: 0;
}
.dsh_desktop_canvasCard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  text-align: left;
  font: inherit;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
.dsh_desktop_canvasCard:hover {
  border-color: var(--dsw-alias-accent-primary);
}
.dsh_desktop_canvasCardTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.dsh_desktop_canvasCardTitle {
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_desktop_canvasCardStatus {
  flex: none;
  font-size: 11px;
  line-height: 16px;
  padding: 1px 6px;
  border-radius: 8px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-layer-2);
}
.dsh_desktop_canvasCardStatus.is-running {
  color: var(--dsw-alias-success-primary);
}
.dsh_desktop_canvasCardMeta {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_desktop_canvasCardPending {
  color: var(--dsw-alias-warning-primary);
  font-size: 12px;
  line-height: 18px;
}
`

/** Inject the stylesheet once; idempotent across plugin reloads. */
export function adoptStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-desktop-plugin'
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = cssText
  document.head.appendChild(tag)
}

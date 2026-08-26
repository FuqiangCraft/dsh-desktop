/**
 * The attention-HUD, canvas, and desktop settings stylesheet, hand-written as
 * a template string and injected once by the plugin body: the web server serves
 * exactly one file per client plugin, so no separate CSS artifact may exist.
 * Tokens come only from the shared `--dsw-alias-*` design platform (no literal colors);
 * class names carry the `dsh_desktop` prefix to stay unique in the assembled shell.
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

/* Settings: Desktop & Companion Section */
.dsh_desktop_settingsSection {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 4px 32px;
  color: var(--dsw-alias-label-primary);
}
.dsh_desktop_settingsHeader {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dsh_desktop_settingsTitle {
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dsh_desktop_settingsSubtitle {
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_desktop_settingsGroup {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh_desktop_settingsGroupTitle {
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dsh_desktop_settingsCard {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.dsh_desktop_settingsRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh_desktop_settingsRow:last-child {
  border-bottom: none;
}
.dsh_desktop_petGalleryHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 10px;
}
.dsh_desktop_petGallery {
  display: flex;
  flex-direction: column;
  padding: 0 16px 8px;
}
.dsh_desktop_petRow {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 78px;
  padding: 10px 2px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh_desktop_petRow:last-child { border-bottom: 0; }
.dsh_desktop_petThumbnail {
  width: 52px;
  height: 52px;
  object-fit: contain;
  filter: drop-shadow(0 5px 7px rgba(15, 23, 42, 0.18));
}
.dsh_desktop_petThumbnailPlaceholder {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px dashed var(--dsw-alias-border-l1);
  border-radius: 10px;
}
.dsh_desktop_petMeta { min-width: 0; }
.dsh_desktop_petName {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}
.dsh_desktop_petDescription {
  margin-top: 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh_desktop_petSelect {
  min-width: 48px;
  padding: 6px 11px;
  border: 0;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh_desktop_petSelect:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_desktop_petSelect:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: default;
}
.dsh_desktop_petRow.is-selected .dsh_desktop_petThumbnail {
  filter: drop-shadow(0 5px 9px color-mix(in srgb, var(--dsw-alias-accent-primary) 40%, transparent));
}
.dsh_desktop_petSettings { max-width: 780px; gap: 26px; }
.dsh_desktop_petPageHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.dsh_desktop_petToolbarButton,
.dsh_desktop_petFolderButton {
  border: 0;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  padding: 7px 11px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh_desktop_petCatalog { padding: 0 16px; }
.dsh_desktop_petResourceRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 62px;
  padding: 10px 2px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dsh_desktop_petPath {
  margin-top: 2px;
  color: var(--dsw-alias-label-tertiary);
  font: 12px/18px ui-monospace, SFMono-Regular, Consolas, monospace;
}
.dsh_desktop_petAppearance { display: flex; flex-direction: column; gap: 10px; }
.dsh_desktop_petSizeRow {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 15px 16px;
  overflow: visible;
}
.dsh_desktop_petSizeRow .dsh_desktop_settingsSlider { width: 160px; }
.dsh_desktop_settingsRowInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dsh_desktop_settingsLabel {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}
.dsh_desktop_settingsDesc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_desktop_settingsControl {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh_desktop_settingsSelect {
  padding: 6px 10px;
  font-size: 13px;
  line-height: 18px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  outline: none;
  cursor: pointer;
}
.dsh_desktop_settingsSelect:focus {
  border-color: var(--dsw-alias-accent-primary);
}
.dsh_desktop_settingsToggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  cursor: pointer;
}
.dsh_desktop_settingsToggle input {
  opacity: 0;
  width: 0;
  height: 0;
}
.dsh_desktop_settingsToggleSlider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--dsw-alias-bg-layer-3);
  border-radius: 22px;
  transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.dsh_desktop_settingsToggleSlider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.dsh_desktop_settingsToggle input:checked + .dsh_desktop_settingsToggleSlider {
  background-color: var(--dsw-alias-accent-primary);
}
.dsh_desktop_settingsToggle input:checked + .dsh_desktop_settingsToggleSlider:before {
  transform: translateX(18px);
}
.dsh_desktop_settingsSliderContainer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh_desktop_settingsSlider {
  accent-color: var(--dsw-alias-accent-primary);
  cursor: pointer;
}
.dsh_desktop_settingsSliderValue {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  min-width: 36px;
  text-align: right;
}
.dsh_desktop_settingsBadge {
  font-size: 11px;
  line-height: 16px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-family: monospace;
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

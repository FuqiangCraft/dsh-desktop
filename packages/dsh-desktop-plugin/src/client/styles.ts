/**
 * The attention-HUD, canvas, skins & wallpaper, and desktop settings stylesheet.
 * Tokens come only from the shared `--dsw-alias-*` design platform;
 * class names carry the `dsh_desktop` prefix to stay unique in the assembled shell.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-desktop-style'

/** The plugin's injected stylesheet text. */
export const cssText = `
.dsh_desktop_petNavIcon > svg {
  display: none;
}
.dsh_desktop_petNavIcon::before {
  content: '';
  flex: none;
  width: 16px;
  height: 16px;
  background: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 22c-2.9 0-6.8-1.7-6.8-5.1 0-2.1 1.7-3.5 3.2-4.7 1.2-1 2.3-1.8 3.6-1.8s2.4.8 3.6 1.8c1.5 1.2 3.2 2.6 3.2 4.7C18.8 20.3 14.9 22 12 22ZM5.1 12.6c-1.7.3-3.4-1.2-3.8-3.3S2 5.2 3.7 4.9s3.4 1.2 3.8 3.3-.7 4.1-2.4 4.4Zm13.8 0c-1.7-.3-2.8-2.3-2.4-4.4s2.1-3.6 3.8-3.3 2.8 2.3 2.4 4.4-2.1 3.6-3.8 3.3ZM9.2 8.4C7.4 8.4 6 6.5 6 4.2S7.4 0 9.2 0s3.2 1.9 3.2 4.2-1.4 4.2-3.2 4.2Zm5.6 0c-1.8 0-3.2-1.9-3.2-4.2S13 0 14.8 0 18 1.9 18 4.2s-1.4 4.2-3.2 4.2Z'/%3E%3C/svg%3E") center / contain no-repeat;
}
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

/* Wallpaper & Glassmorphism Engine */
.dsh_desktop_wallpaperContainer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.dsh_desktop_wallpaperLayer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center;
  filter: saturate(1.12) contrast(1.03);
  forced-color-adjust: none;
  transition: opacity 0.25s ease-in-out;
}
.dsh_desktop_wallpaperMask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(248, 250, 252, calc(0.18 + var(--dsh-skin-dim, 0.35) * 0.72));
  transition: background 0.2s ease;
}

/* Full Glassmorphism Theme Overrides */
html.dsh-has-custom-skin,
html.dsh-has-custom-skin body {
  background: transparent !important;
}
/* DSH theme scopes redefine these tokens below <html>. Apply them at the
   consuming nodes so the wallpaper can show through every host surface. */
html.dsh-has-custom-skin body * {
  --dsw-alias-bg-base: rgba(255, 255, 255, 0.16) !important;
  --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.5) !important;
  --dsw-alias-bg-layer-2: rgba(248, 250, 252, 0.64) !important;
  --dsw-alias-bg-layer-3: rgba(241, 245, 249, 0.72) !important;
  --dsw-specific-sidebar-fill: rgba(248, 250, 252, 0.48) !important;
  --dsw-specific-input-major: rgba(255, 255, 255, 0.7) !important;
  --dsw-specific-tip: rgba(248, 250, 252, 0.66) !important;
  --dsw-specific-menu: rgba(255, 255, 255, 0.9) !important;
}
html.dsh-has-custom-skin body > *:not(#dsh-desktop-wallpaper-container) {
  position: relative;
  z-index: 1;
}
html.dsh-has-custom-skin [role="dialog"] {
  background: rgba(248, 250, 252, 0.68) !important;
  backdrop-filter: blur(var(--dsh-skin-blur, 12px)) saturate(1.15);
  -webkit-backdrop-filter: blur(var(--dsh-skin-blur, 12px)) saturate(1.15);
}
html.dsh-has-custom-skin [role="dialog"] > nav {
  background: rgba(248, 250, 252, 0.3);
  border-right: 1px solid rgba(148, 163, 184, 0.2);
}
html.dsh-has-custom-skin .dsh_desktop_settingsCard,
html.dsh-has-custom-skin .dsh_desktop_canvasCard,
html.dsh-has-custom-skin .dsh_desktop_attentionCard {
  background: rgba(255, 255, 255, 0.68) !important;
  backdrop-filter: blur(var(--dsh-skin-blur, 12px));
  -webkit-backdrop-filter: blur(var(--dsh-skin-blur, 12px));
}

/* Settings Sections & Tabs */
.dsh_desktop_settingsSection {
  --dsh-settings-text: var(--dsw-alias-label-primary, #171717);
  --dsh-settings-muted: var(--dsw-alias-label-tertiary, #737373);
  --dsh-settings-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --dsh-settings-subtle: var(--dsw-alias-bg-layer-2, #f5f5f5);
  --dsh-settings-hover: var(--dsw-alias-bg-layer-3, #ededed);
  --dsh-settings-border: var(--dsw-alias-border-l2, #e5e5e5);
  --dsh-settings-divider: var(--dsw-alias-border-l1, #eeeeee);
  --dsh-settings-accent: var(--dsw-alias-accent-primary, #2563eb);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  min-width: 0;
  max-width: 760px;
  padding: 4px 0 40px;
  color: var(--dsh-settings-text);
}
.dsh_desktop_settingsSection,
.dsh_desktop_settingsSection * {
  box-sizing: border-box;
}
.dsh_desktop_settingsSection h2,
.dsh_desktop_settingsSection p {
  margin: 0;
}
.dsh_desktop_notice {
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 10px 12px;
  border: 1px solid var(--dsh-settings-border);
  border-radius: 10px;
  background: var(--dsh-settings-surface);
  color: var(--dsh-settings-text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .1);
  font-size: 13px;
}
.dsh_desktop_notice.is-success { border-color: #22c55e; }
.dsh_desktop_notice.is-error { border-color: #ef4444; }
.dsh_desktop_settingsTabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--dsh-settings-subtle);
  border-radius: 10px;
  width: fit-content;
  max-width: 100%;
  border: 1px solid var(--dsh-settings-divider);
}
.dsh_desktop_settingsTab {
  padding: 7px 16px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsh-settings-muted);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.dsh_desktop_settingsTab:hover {
  color: var(--dsw-alias-label-primary);
}
.dsh_desktop_settingsTab.is-active {
  background: var(--dsh-settings-surface);
  color: var(--dsh-settings-text);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
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
  color: var(--dsh-settings-text);
}
.dsh_desktop_settingsSubtitle {
  font-size: 13px;
  line-height: 20px;
  color: var(--dsh-settings-muted);
}
.dsh_desktop_settingsCard {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsh-settings-border);
  border-radius: 12px;
  background: var(--dsh-settings-surface);
  overflow: hidden;
}

/* Skin Grid & Cards */
.dsh_desktop_skinGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 14px;
  padding: 16px;
}
.dsh_desktop_skinCard {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 2px solid transparent;
  padding: 0;
  font: inherit;
  color: inherit;
  background: var(--dsh-settings-subtle);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.dsh_desktop_skinCard:hover {
  transform: translateY(-2px);
  border-color: var(--dsw-alias-border-l2);
}
.dsh_desktop_skinCard.is-selected {
  border-color: var(--dsh-settings-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsh-settings-accent) 25%, transparent);
}
.dsh_desktop_skinThumbnail {
  width: 100%;
  height: 110px;
  object-fit: cover;
  background: #0f172a;
}
.dsh_desktop_skinMeta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
}
.dsh_desktop_skinName {
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dsh_desktop_skinDesc {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_desktop_skinActions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}
.dsh_desktop_skinBadge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--dsw-alias-accent-primary);
  color: #ffffff;
  font-weight: 600;
}
.dsh_desktop_skinDropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  border: 2px dashed var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.dsh_desktop_skinDropzone:hover,
.dsh_desktop_skinDropzone.is-dragover {
  border-color: var(--dsw-alias-accent-primary);
  background: color-mix(in srgb, var(--dsw-alias-accent-primary) 8%, var(--dsw-alias-bg-layer-1));
}
.dsh_desktop_dropzoneIcon {
  font-size: 24px;
}
.dsh_desktop_dropzoneText {
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dsh_desktop_dropzoneHint {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

/* Pet Catalog & Rows */
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
  padding: 7px 12px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh_desktop_petToolbarButton:hover,
.dsh_desktop_petFolderButton:hover {
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_desktop_petCatalog { padding: 0 16px; }
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
  overflow: hidden;
}
.dsh_desktop_petSizeRow .dsh_desktop_settingsSlider { width: 160px; }
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
.dsh_desktop_updateError {
  color: var(--dsw-alias-status-error, #c7352c);
}
.dsh_desktop_settingsSlider {
  width: 160px;
  accent-color: var(--dsw-alias-accent-primary);
  cursor: pointer;
}
.dsh_desktop_settingsSliderContainer {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}
.dsh_desktop_settingsSliderValue {
  min-width: 42px;
  color: var(--dsh-settings-muted);
  font: 12px/18px ui-monospace, SFMono-Regular, Consolas, monospace;
  text-align: right;
}

@media (max-width: 680px) {
  .dsh_desktop_settingsTabs { width: 100%; }
  .dsh_desktop_settingsTab { flex: 1; padding-inline: 8px; }
  .dsh_desktop_skinGrid { grid-template-columns: 1fr; padding: 12px; }
  .dsh_desktop_petSizeRow { align-items: flex-start; flex-direction: column; }
  .dsh_desktop_settingsSliderContainer,
  .dsh_desktop_settingsSlider { width: 100%; }
  .dsh_desktop_petPageHeader { align-items: flex-start; }
}

/* Version & Environment Dashboard */
.dsh_desktop_versionGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  padding: 16px;
}
.dsh_desktop_versionItem {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh_desktop_versionKey {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_desktop_versionVal {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, monospace;
}
.dsh_desktop_statusBadge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}
.dsh_desktop_statusBadge.is-online {
  color: var(--dsw-alias-success-primary);
}
.dsh_desktop_statusBadge.is-offline {
  color: var(--dsw-alias-warning-primary);
}
.dsh_desktop_updateBanner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  margin: 0 16px 16px;
  background: color-mix(in srgb, var(--dsw-alias-accent-primary) 12%, var(--dsw-alias-bg-layer-1));
  border: 1px solid var(--dsw-alias-accent-primary);
  border-radius: 10px;
}
.dsh_desktop_copyCmdBox {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
`

/** Inject the stylesheet once; idempotent across plugin reloads. */
export function adoptStyles(): void {
  if (typeof document === 'undefined') return
  const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing) {
    if (existing.textContent !== cssText) existing.textContent = cssText
    return
  }
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-desktop-plugin'
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = cssText
  document.head.appendChild(tag)
}

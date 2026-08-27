/** Mark the plugin-owned settings row so it can use a paw instead of the shell fallback gear. */
export function setupPetNavIcon(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  const labels = new Set(['宠物', 'Pets'])
  const applyIcon = () => {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
      const label = button.querySelector('span')?.textContent?.trim()
      button.classList.toggle('dsh_desktop_petNavIcon', labels.has(label ?? ''))
    }
  }

  applyIcon()
  const observer = new MutationObserver(applyIcon)
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    document.querySelectorAll('.dsh_desktop_petNavIcon').forEach((node) => {
      node.classList.remove('dsh_desktop_petNavIcon')
    })
  }
}

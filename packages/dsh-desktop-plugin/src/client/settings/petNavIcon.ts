/** Mark the plugin-owned settings rows so they can use dedicated icons instead of the shell fallback gear. */
export function setupPetNavIcon(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  const petLabels = new Set(['桌面宠物', '宠物', 'Desktop Pet', 'Pets'])
  const updateLabels = new Set(['应用更新', 'App Updates', 'Updates'])

  const applyIcon = () => {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
      const label = button.querySelector('span')?.textContent?.trim() ?? ''
      button.classList.toggle('dsh_desktop_petNavIcon', petLabels.has(label))
      button.classList.toggle('dsh_desktop_updateNavIcon', updateLabels.has(label))
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
    document.querySelectorAll('.dsh_desktop_updateNavIcon').forEach((node) => {
      node.classList.remove('dsh_desktop_updateNavIcon')
    })
  }
}

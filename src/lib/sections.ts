/** Open (and scroll to) a plan-editor section from anywhere in the app. */
export function openSection(id: string) {
  window.dispatchEvent(new CustomEvent('horizon:open-section', { detail: id }))
}

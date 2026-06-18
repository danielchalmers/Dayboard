// Background registration kept as a standalone, side-effect-free function so it
// stays unit-testable without evaluating WXT's defineBackground wrapper.
export function registerBackground(): void {
  if (chrome.action?.onClicked && chrome.tabs?.create) {
    chrome.action.onClicked.addListener(() => {
      void chrome.tabs.create({})
    })
  }
}

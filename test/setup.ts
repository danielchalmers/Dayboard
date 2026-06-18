import "@testing-library/jest-dom/vitest"

// jsdom (the Vitest environment) does not implement the Popover API, so provide
// no-op shims for the lifecycle methods our components call. The real top-layer,
// light-dismiss, and Escape behavior is covered by the Playwright e2e suite.
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function showPopover() {}
  HTMLElement.prototype.hidePopover = function hidePopover() {}
  HTMLElement.prototype.togglePopover = function togglePopover() {
    return true
  }
}

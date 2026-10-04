import "@testing-library/jest-dom/vitest"

// jsdom (the environment the DOM-facing tests opt into) does not implement the Popover API, so provide shims for the lifecycle methods our components call.
// The real top-layer, light-dismiss, and Escape behavior is covered by the Playwright e2e suite.
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.showPopover) {
  // jsdom's UA stylesheet hides `[popover]:not(:popover-open)`, and it never matches `:popover-open`, so every popover stays `display: none`, which jsdom treats as unfocusable.
  // Mirror the open state in an attribute and unhide it from there, so focus can move into a shown popover the way it does in a browser.
  // `!important` because jsdom weighs its UA rule against ours by specificity alone, and the UA selector is the more specific one.
  const OPEN_ATTRIBUTE = "data-test-popover-open"
  const style = document.createElement("style")
  style.textContent = `[popover][${OPEN_ATTRIBUTE}] { display: block !important; }`
  document.head.append(style)

  HTMLElement.prototype.showPopover = function showPopover() {
    this.setAttribute(OPEN_ATTRIBUTE, "")
  }
  HTMLElement.prototype.hidePopover = function hidePopover() {
    this.removeAttribute(OPEN_ATTRIBUTE)
  }
  HTMLElement.prototype.togglePopover = function togglePopover() {
    return this.toggleAttribute(OPEN_ATTRIBUTE)
  }
}

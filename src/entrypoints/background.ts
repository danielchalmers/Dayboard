// Minimal background so MV3 registers a service worker. Clockboard does its
// work on the new tab page; the worker is the stable anchor e2e uses to resolve
// the extension id.
export default defineBackground(() => {})

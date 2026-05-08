export function getChromeRuntime(): typeof chrome.runtime | null {
  return (globalThis as { chrome?: typeof chrome }).chrome?.runtime ?? null;
}

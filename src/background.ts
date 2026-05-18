if (typeof chrome !== "undefined" && chrome.action?.onClicked && chrome.tabs?.create) {
  chrome.action.onClicked.addListener(() => {
    void chrome.tabs.create({})
  })
}

export {}

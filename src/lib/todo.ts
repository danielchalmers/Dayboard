// Helpers for the todo widget.
// Tasks are added, checked, and removed on the card itself, like a note and unlike the quote list, so the dialog carries nothing but the name and color.

export interface TodoTask {
  id: string
  text: string
  done: boolean
}

// The card is not a task manager: it holds the few things you are actually doing today, and every one of them is on screen at once.
// A card is one fixed height, so a longer list could only scroll, and a list you have to scroll is no longer something a new tab shows you at a glance.
// Four is what fits without scrolling, and the cap is the widget rather than a limitation of it.
// It also keeps the card small in the chrome.storage.sync per-item quota the whole board shares, which the habit widget's history once blew.
export const MAX_TASKS = 4
export const MAX_TASK_LENGTH = 120

const cleanText = (text: string): string => text.trim().slice(0, MAX_TASK_LENGTH)

// Blank text and a full list both leave the list untouched, so the caller can compare identity to tell whether anything was actually added.
export const addTask = (tasks: TodoTask[], text: string): TodoTask[] => {
  const cleaned = cleanText(text)

  return cleaned && tasks.length < MAX_TASKS
    ? [...tasks, { id: crypto.randomUUID(), text: cleaned, done: false }]
    : tasks
}

export const toggleTask = (tasks: TodoTask[], id: string): TodoTask[] =>
  tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task
  )

export const removeTask = (tasks: TodoTask[], id: string): TodoTask[] =>
  tasks.filter((task) => task.id !== id)

// Accept whatever a stored or imported board carries: drop rows that aren't tasks and hold the rest to the same limits the card enforces.
// Anything else a task carries is left on it for the version that wrote it.
export const normalizeTasks = (value: unknown): TodoTask[] =>
  (Array.isArray(value) ? value : [])
    .filter(
      (entry): entry is TodoTask =>
        typeof entry?.id === "string" &&
        typeof entry?.text === "string" &&
        cleanText(entry.text) !== ""
    )
    .slice(0, MAX_TASKS)
    .map((task) => ({
      ...task,
      text: cleanText(task.text),
      done: task.done === true
    }))

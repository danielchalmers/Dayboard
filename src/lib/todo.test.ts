import { describe, expect, it } from "vitest"

import {
  addTask,
  MAX_TASK_LENGTH,
  MAX_TASKS,
  normalizeTasks,
  removeTask,
  toggleTask,
  type TodoTask
} from "./todo"

const task = (id: string, text: string, done = false): TodoTask => ({
  id,
  text,
  done
})

const fullList = (): TodoTask[] =>
  Array.from({ length: MAX_TASKS }, (_, index) =>
    task(String(index), `Task ${index}`)
  )

describe("addTask", () => {
  it("appends a trimmed, unchecked task", () => {
    expect(addTask([task("1", "First")], "  Second  ")).toMatchObject([
      { text: "First" },
      { text: "Second", done: false }
    ])
  })

  it("caps a very long task at the stored length", () => {
    expect(addTask([], "a".repeat(500))[0]!.text).toHaveLength(MAX_TASK_LENGTH)
  })

  it("returns the same list for blank text, so the field keeps what was typed", () => {
    const tasks = [task("1", "First")]

    expect(addTask(tasks, "   ")).toBe(tasks)
  })

  it("stops at the cap, which is the whole point of the widget", () => {
    const tasks = fullList()

    expect(addTask(tasks, "One too many")).toBe(tasks)
  })
})

describe("toggleTask", () => {
  it("checks only the named task and leaves the order alone", () => {
    const tasks = [task("1", "First"), task("2", "Second"), task("3", "Third")]
    const toggled = toggleTask(tasks, "2")

    expect(toggled.map(({ id, done }) => [id, done])).toEqual([
      ["1", false],
      ["2", true],
      ["3", false]
    ])
    expect(toggleTask(toggled, "2")[1]!.done).toBe(false)
  })
})

describe("removeTask", () => {
  it("drops just that task", () => {
    expect(removeTask([task("1", "First"), task("2", "Second")], "1")).toEqual([
      task("2", "Second")
    ])
  })
})

describe("normalizeTasks", () => {
  it("falls back to an empty list for anything that is not an array", () => {
    expect(normalizeTasks(undefined)).toEqual([])
    expect(normalizeTasks("Buy milk")).toEqual([])
  })

  it("drops rows that are not tasks, trims the rest, and squares up done", () => {
    expect(
      normalizeTasks([
        null,
        "Buy milk",
        { id: 7, text: "Numbered id" },
        { id: "1", text: "   " },
        { id: "2", text: "  Real task  ", done: "yes" }
      ])
    ).toEqual([task("2", "Real task")])
  })

  it("caps an oversized imported list", () => {
    expect(normalizeTasks([...fullList(), task("extra", "Extra")])).toHaveLength(
      MAX_TASKS
    )
  })

  it("keeps what a newer build stores on a task", () => {
    expect(
      normalizeTasks([{ id: "1", text: "Call Sam", done: false, due: "2026-10-08" }])
    ).toEqual([{ id: "1", text: "Call Sam", done: false, due: "2026-10-08" }])
  })
})

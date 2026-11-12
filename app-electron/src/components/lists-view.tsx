import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { Plus, Trash2, Lock, LockOpen, ListChecks, Check, Archive, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ListsViewProps {
  lists: QiList[]
  onListsChange: Dispatch<SetStateAction<QiList[]>>
}

function progress(list: QiList) {
  return { done: list.items.filter((i) => i.done).length, total: list.items.length }
}

const pad = (n: number) => String(n).padStart(2, "0")

// Local calendar day as YYYY-MM-DD, the same shape as targetDate
function dayOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Local midnight. new Date("YYYY-MM-DD") would parse the day as UTC and can shift it by one.
function localDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDay(day: string, withYear = true): string {
  return localDate(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  })
}

// How a completion day compares with the target day
function timing(target: string, completed: string): string {
  const days = Math.round((localDate(target).getTime() - localDate(completed).getTime()) / 86_400_000)
  if (days === 0) return "on time"
  const n = Math.abs(days)
  return `${n} ${n === 1 ? "day" : "days"} ${days > 0 ? "early" : "late"}`
}

function isOverdue(list: QiList, today: string): boolean {
  return list.completedAt === undefined && !!list.targetDate && list.targetDate < today
}

// Today's local day. Polled because the window stays open for days and a timer aimed at
// midnight would fire late after the machine sleeps.
function useToday(): string {
  const [today, setToday] = useState(() => dayOf(Date.now()))
  useEffect(() => {
    const t = setInterval(() => setToday(dayOf(Date.now())), 60_000)
    return () => clearInterval(t)
  }, [])
  return today
}

// Replace a list's items and keep its completion date in step: stamp it when the change
// makes every item done, clear it when a done item is unchecked or no items remain, and
// otherwise leave it alone, so adding items to a completed list keeps the original date.
export function withItems(list: QiList, items: ListItem[], now = Date.now()): QiList {
  const wasDone = new Set(list.items.filter((i) => i.done).map((i) => i.id))
  const next: QiList = { ...list, items }
  const allDone = (list: ListItem[]) => list.length > 0 && list.every((i) => i.done)
  if (items.length === 0 || items.some((i) => !i.done && wasDone.has(i.id))) delete next.completedAt
  else if (next.completedAt === undefined && allDone(items) && !allDone(list.items)) next.completedAt = now
  return next
}

// The goal's first line becomes the heading; any further lines follow as a paragraph
export function listToMarkdown(list: QiList): string {
  const [heading, ...rest] = list.goal.trim().split("\n")
  const parts = [`# ${heading?.trim() || "Untitled goal"}`]
  const body = rest.join("\n").trim()
  if (body) parts.push(body)
  const dates = [`Created ${dayOf(list.createdAt)}.`]
  if (list.targetDate) dates.push(`Target ${list.targetDate}.`)
  if (list.completedAt !== undefined) dates.push(`Completed ${dayOf(list.completedAt)}.`)
  parts.push(dates.join(" "))
  const items = list.items
    .filter((i) => i.text.trim())
    .map((i) => `- [${i.done ? "x" : " "}] ${i.text.trim()}`)
  if (items.length) parts.push(items.join("\n"))
  return parts.join("\n\n") + "\n"
}

export function ListsView({ lists, onListsChange }: ListsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(lists[0]?.id ?? null)
  const selected = lists.find((l) => l.id === selectedId) ?? null
  const today = useToday()

  // The goal is locked by default. Unlocking keeps the prior text so Escape can revert it.
  const [goalUnlocked, setGoalUnlocked] = useState(false)
  const goalBefore = useRef("")
  const goalInput = useRef<HTMLTextAreaElement>(null)

  const [newItem, setNewItem] = useState("")
  const addInput = useRef<HTMLInputElement>(null)
  const itemInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)
  const [stashStatus, setStashStatus] = useState<"idle" | "saved" | "failed">("idle")

  // Brief checkmark (or X on failure) after a stash attempt
  useEffect(() => {
    if (stashStatus === "idle") return
    const t = setTimeout(() => setStashStatus("idle"), 1500)
    return () => clearTimeout(t)
  }, [stashStatus])

  // Fall back to the first list if the selection disappears
  useEffect(() => {
    if (!selected && lists.length) setSelectedId(lists[0].id)
  }, [selected, lists])

  // Each list opens locked, except an untitled one, which has nothing to protect yet
  useEffect(() => {
    const goal = lists.find((l) => l.id === selectedId)?.goal ?? ""
    goalBefore.current = goal
    setGoalUnlocked(!goal.trim())
    setNewItem("")
    // Only re-run when switching lists, not on every goal keystroke
  }, [selectedId])

  useEffect(() => {
    if (goalUnlocked) goalInput.current?.focus()
  }, [goalUnlocked, selectedId])

  useEffect(() => {
    if (!pendingFocus) return
    const el = pendingFocus === "add" ? addInput.current : itemInputs.current[pendingFocus]
    el?.focus()
    setPendingFocus(null)
  }, [pendingFocus])

  const updateList = (id: string, fn: (l: QiList) => QiList) => {
    onListsChange((prev) => prev.map((l) => (l.id === id ? fn(l) : l)))
  }

  const updateItems = (fn: (items: ListItem[]) => ListItem[]) => {
    if (selected) updateList(selected.id, (l) => withItems(l, fn(l.items)))
  }

  // An empty value from the date input removes the target
  const setTargetDate = (value: string) => {
    if (!selected) return
    updateList(selected.id, (l) => {
      const next = { ...l }
      if (value) next.targetDate = value
      else delete next.targetDate
      return next
    })
  }

  const addList = () => {
    const list: QiList = { id: crypto.randomUUID(), goal: "", items: [], createdAt: Date.now() }
    onListsChange((prev) => [list, ...prev])
    setSelectedId(list.id)
  }

  const deleteList = (id: string) => {
    const idx = lists.findIndex((l) => l.id === id)
    const rest = lists.filter((l) => l.id !== id)
    onListsChange(rest)
    if (selectedId === id) setSelectedId(rest[Math.min(idx, rest.length - 1)]?.id ?? null)
  }

  const unlockGoal = () => {
    goalBefore.current = selected?.goal ?? ""
    setGoalUnlocked(true)
  }

  const lockGoal = () => {
    if (!selected) return
    const goal = selected.goal.trim()
    if (!goal) return
    updateList(selected.id, (l) => ({ ...l, goal }))
    setGoalUnlocked(false)
  }

  // Discard edits. A blank goal can't be locked, so it stays open for typing.
  const revertGoal = () => {
    if (!selected) return
    const goal = goalBefore.current
    updateList(selected.id, (l) => ({ ...l, goal }))
    if (goal.trim()) setGoalUnlocked(false)
  }

  const addItem = () => {
    const text = newItem.trim()
    if (!text) return
    updateItems((items) => [...items, { id: crypto.randomUUID(), text, done: false }])
    setNewItem("")
  }

  const removeItem = (id: string, focusPrevious = false) => {
    if (!selected) return
    const idx = selected.items.findIndex((i) => i.id === id)
    updateItems((items) => items.filter((i) => i.id !== id))
    if (focusPrevious) setPendingFocus(selected.items[idx - 1]?.id ?? "add")
  }

  // Save the selected list to the stash as a markdown checklist, titled by its goal
  const stashList = async () => {
    if (!selected) return
    try {
      const api = window.electronAPI
      if (!api) throw new Error("Stash unavailable")
      await api.saveStash(selected.goal.trim().split("\n")[0] || "list", listToMarkdown(selected))
      setStashStatus("saved")
    } catch {
      setStashStatus("failed")
    }
  }

  const canStash = !!selected && (!!selected.goal.trim() || selected.items.some((i) => i.text.trim()))
  const { done, total } = selected ? progress(selected) : { done: 0, total: 0 }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <div className="flex items-center justify-between gap-1 px-3 py-1.5 border-b border-border bg-surface shrink-0">
        <span className="text-xs font-mono text-muted-foreground">
          {lists.length} {lists.length === 1 ? "list" : "lists"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={addList}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors"
            title="New list"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            onClick={stashList}
            disabled={!canStash}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title={stashStatus === "failed" ? "Stash failed" : "Stash list as a markdown checklist"}
          >
            {stashStatus === "saved" ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : stashStatus === "failed" ? (
              <X className="w-3.5 h-3.5 text-destructive" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
            <span>Stash</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <ul className="w-56 shrink-0 border-r border-border overflow-y-auto">
          {lists.length === 0 && (
            <li className="px-3 py-4 text-xs text-muted-foreground">
              No lists yet. Start one with a goal and the actions to reach it.
            </li>
          )}
          {lists.map((list) => {
            const p = progress(list)
            const complete = p.total > 0 && p.done === p.total
            return (
              <li
                key={list.id}
                className={cn(
                  "group flex items-start gap-2 px-3 py-2 border-b border-border transition-colors duration-150 focus-within:bg-tab-hover",
                  selectedId === list.id
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
                )}
              >
                <button
                  onClick={() => setSelectedId(list.id)}
                  aria-current={selectedId === list.id ? "true" : undefined}
                  className="flex items-start gap-2 flex-1 min-w-0 text-left outline-none cursor-pointer"
                >
                  {complete ? (
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <ListChecks className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className={cn("block text-xs truncate", !list.goal.trim() && "italic text-muted-foreground/60")} title={list.goal}>
                      {list.goal.trim() || "Untitled goal"}
                    </span>
                    <span className="block text-[10px] font-mono text-muted-foreground/60 truncate">
                      {p.done}/{p.total} done
                      {list.completedAt !== undefined ? (
                        <> · done {formatDay(dayOf(list.completedAt), false)}</>
                      ) : list.targetDate ? (
                        <span className={cn(isOverdue(list, today) && "text-destructive")}>
                          {" "}· due {formatDay(list.targetDate, false)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => deleteList(list.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  aria-label={`Delete list ${list.goal || "Untitled goal"}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            )
          })}
        </ul>

        {selected ? (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Goal</span>
                <button
                  // Keep focus in the textarea so its blur doesn't lock before this click toggles
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={goalUnlocked ? lockGoal : unlockGoal}
                  disabled={goalUnlocked && !selected.goal.trim()}
                  title={goalUnlocked ? "Lock goal (Enter)" : "Unlock to edit goal"}
                  aria-label={goalUnlocked ? "Lock goal" : "Unlock goal"}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded-md transition-colors disabled:opacity-40",
                    goalUnlocked
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-tab-hover"
                  )}
                >
                  {goalUnlocked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{goalUnlocked ? "Lock" : "Locked"}</span>
                </button>
              </div>

              {goalUnlocked ? (
                <textarea
                  ref={goalInput}
                  value={selected.goal}
                  onChange={(e) => updateList(selected.id, (l) => ({ ...l, goal: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); lockGoal() }
                    if (e.key === "Escape") revertGoal()
                  }}
                  onBlur={lockGoal}
                  placeholder="What are you trying to accomplish?"
                  rows={2}
                  className="w-full resize-none rounded-lg bg-surface border border-primary/40 px-3 py-2 text-lg font-semibold leading-snug text-foreground outline-none placeholder:text-muted-foreground/40 placeholder:font-normal"
                />
              ) : (
                <p
                  onDoubleClick={unlockGoal}
                  className="px-3 py-2 rounded-lg border border-transparent text-lg font-semibold leading-snug text-foreground whitespace-pre-wrap break-words"
                >
                  {selected.goal}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-3 text-xs font-mono text-muted-foreground">
                <span>Created {formatDay(dayOf(selected.createdAt))}</span>
                <label className="flex items-center gap-1.5">
                  <span>Target</span>
                  <input
                    type="date"
                    value={selected.targetDate ?? ""}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className={cn(
                      "bg-transparent rounded px-1 outline-none hover:bg-tab-hover focus:bg-tab-hover",
                      isOverdue(selected, today) && "text-destructive"
                    )}
                  />
                </label>
                {selected.completedAt !== undefined && (
                  <span className="text-primary">
                    Completed {formatDay(dayOf(selected.completedAt))}
                    {selected.targetDate && ` (${timing(selected.targetDate, dayOf(selected.completedAt))})`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-4 mb-2">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-300"
                    style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {done} / {total} done
                </span>
              </div>

              <ul className="flex flex-col">
                {selected.items.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2.5 px-1 py-1 rounded-md hover:bg-tab-hover/50">
                    <button
                      role="checkbox"
                      aria-checked={item.done}
                      aria-label={item.done ? "Mark not done" : "Mark done"}
                      onClick={() => updateItems((items) => items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                      className={cn(
                        "flex items-center justify-center w-4 h-4 shrink-0 rounded border transition-colors",
                        item.done
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/50 hover:border-primary"
                      )}
                    >
                      {item.done && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                    <input
                      ref={(el) => { itemInputs.current[item.id] = el }}
                      value={item.text}
                      onChange={(e) => updateItems((items) => items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); setPendingFocus("add") }
                        if (e.key === "Backspace" && !item.text) { e.preventDefault(); removeItem(item.id, true) }
                      }}
                      onBlur={() => { if (!item.text.trim()) removeItem(item.id) }}
                      spellCheck={false}
                      className={cn(
                        "flex-1 min-w-0 bg-transparent text-sm outline-none",
                        item.done ? "line-through text-muted-foreground" : "text-foreground"
                      )}
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${item.text}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
                <li className="flex items-center gap-2.5 px-1 py-1">
                  <Plus className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                  <input
                    ref={addInput}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addItem() }
                      if (e.key === "Escape") setNewItem("")
                    }}
                    placeholder="Add an action..."
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                </li>
              </ul>

              {done > 0 && (
                <button
                  onClick={() => updateItems((items) => items.filter((i) => !i.done))}
                  className="mt-4 px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors"
                >
                  Clear completed
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            {lists.length ? "Select a list." : "Create a list to get started."}
          </div>
        )}
      </div>
    </div>
  )
}

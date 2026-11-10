import { useState, useRef, useEffect } from "react"
import { X, Plus, Trash2, Code2, Archive, Check, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownView } from "@/components/markdown-view"

interface NoteTab {
  id: string
  // User-chosen label; falls back to the id when unset
  name?: string
  content: string
}

interface NotepadViewProps {
  tabs: NoteTab[]
  onTabsChange: (tabs: NoteTab[]) => void
  // Highest tab number ever issued; never decreases when tabs close, so numbers are never reused
  lastTabNumber: number
  onLastTabNumberChange: (n: number) => void
}

const tabNumber = (id: string) => Number(id.slice(1)) || 0

const tabLabel = (tab: NoteTab) => tab.name ?? tab.id

const isDuplicateName = (tabs: NoteTab[], id: string, name: string) =>
  tabs.some((t) => t.id !== id && tabLabel(t).toLowerCase() === name.toLowerCase())

export const maxTabNumber = (tabs: NoteTab[]) =>
  tabs.reduce((max, t) => Math.max(max, tabNumber(t.id)), 0)

// Repair persisted tabs that got duplicate ids from the old length-based numbering
export function dedupeTabIds(tabs: NoteTab[]): NoteTab[] {
  const seen = new Set<string>()
  const result: NoteTab[] = []
  for (const tab of tabs) {
    const id = seen.has(tab.id) ? `_${maxTabNumber([...tabs, ...result]) + 1}` : tab.id
    seen.add(id)
    result.push({ ...tab, id })
  }
  return result
}

export function NotepadView({ tabs, onTabsChange, lastTabNumber, onLastTabNumberChange }: NotepadViewProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "_1")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [stashStatus, setStashStatus] = useState<"idle" | "saved" | "failed">("idle")
  // Tabs showing rendered markdown instead of the editor. Each tab keeps its own mode.
  const [previewIds, setPreviewIds] = useState<ReadonlySet<string>>(new Set())
  const previewing = previewIds.has(activeTab)

  const togglePreview = () => {
    const next = new Set(previewIds)
    if (!next.delete(activeTab)) next.add(activeTab)
    setPreviewIds(next)
  }

  // Brief checkmark (or X on failure) after a stash attempt
  useEffect(() => {
    if (stashStatus === "idle") return
    const t = setTimeout(() => setStashStatus("idle"), 1500)
    return () => clearTimeout(t)
  }, [stashStatus])

  const draftTrimmed = draftName.trim()
  const draftIsDuplicate =
    editingId !== null && draftTrimmed !== "" && isDuplicateName(tabs, editingId, draftTrimmed)

  const startRename = (tab: NoteTab) => {
    setEditingId(tab.id)
    setDraftName(tabLabel(tab))
  }

  // Set on Escape so the blur fired as the input unmounts doesn't commit the discarded draft
  const skipBlurCommit = useRef(false)

  const cancelRename = () => setEditingId(null)

  // Returns false (and keeps editing) when the name collides with another tab
  const commitRename = () => {
    if (editingId === null) return true
    if (draftIsDuplicate) return false
    // An empty name resets the tab to its default id label
    const name = draftTrimmed === "" || draftTrimmed === editingId ? undefined : draftTrimmed
    onTabsChange(tabs.map((t) => (t.id === editingId ? { ...t, name } : t)))
    setEditingId(null)
    return true
  }

  const addTab = () => {
    const next = Math.max(lastTabNumber, maxTabNumber(tabs)) + 1
    const newId = `_${next}`
    onTabsChange([...tabs, { id: newId, content: "" }])
    onLastTabNumberChange(next)
    setActiveTab(newId)
  }

  const closeTab = (id: string) => {
    if (tabs.length === 1) return
    const idx = tabs.findIndex((t) => t.id === id)
    const newTabs = tabs.filter((t) => t.id !== id)
    onTabsChange(newTabs)
    if (activeTab === id) {
      setActiveTab(newTabs[Math.max(0, idx - 1)].id)
    }
  }

  const clearAll = () => {
    onTabsChange([{ id: "_1", content: "" }])
    onLastTabNumberChange(1)
    setActiveTab("_1")
    setPreviewIds(new Set())
  }

  // Save the active tab's text to the stash, titled by the tab's name
  const stashNote = async () => {
    const current = tabs.find((t) => t.id === activeTab)
    if (!current?.content) return
    try {
      const api = window.electronAPI
      if (!api) throw new Error("Stash unavailable")
      await api.saveStash(tabLabel(current), current.content)
      setStashStatus("saved")
    } catch {
      setStashStatus("failed")
    }
  }

  const formatJson = () => {
    const current = tabs.find((t) => t.id === activeTab)
    if (!current) return
    try {
      const parsed = JSON.parse(current.content)
      const formatted = JSON.stringify(parsed, null, 2)
      onTabsChange(tabs.map((t) => (t.id === activeTab ? { ...t, content: formatted } : t)))
    } catch {
      // not valid JSON
    }
  }

  const updateContent = (value: string) => {
    onTabsChange(tabs.map((t) => (t.id === activeTab ? { ...t, content: value } : t)))
  }

  const current = tabs.find((t) => t.id === activeTab)

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <div className="flex items-center gap-0 border-b border-border bg-surface shrink-0 overflow-x-auto">
        <div className="flex items-center flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-1.5 px-3 py-2.5 border-r border-border cursor-pointer shrink-0 transition-colors duration-150",
                activeTab === tab.id
                  ? "bg-background text-foreground border-b-2 border-b-tab-active"
                  : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
              )}
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (editingId === tab.id) return
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab(tab.id) }
                else if (e.key === "F2") { e.preventDefault(); startRename(tab) }
              }}
            >
              {editingId === tab.id ? (
                <input
                  autoFocus
                  value={draftName}
                  maxLength={40}
                  size={Math.max(draftName.length, 2)}
                  onChange={(e) => setDraftName(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename()
                    else if (e.key === "Escape") {
                      // Blur before unmounting: removal alone doesn't reliably fire blur, which would leave the flag set
                      skipBlurCommit.current = true
                      e.currentTarget.blur()
                      cancelRename()
                    }
                  }}
                  // Leaving the field with a duplicate name discards the edit rather than trapping focus
                  onBlur={() => {
                    if (skipBlurCommit.current) { skipBlurCommit.current = false; return }
                    if (!commitRename()) cancelRename()
                  }}
                  spellCheck={false}
                  aria-invalid={draftIsDuplicate}
                  aria-label={`Rename tab ${tabLabel(tab)}`}
                  className={cn(
                    "text-xs font-mono bg-background text-foreground px-1 -mx-1 rounded-sm outline-none border",
                    draftIsDuplicate ? "border-destructive ring-1 ring-destructive" : "border-border"
                  )}
                />
              ) : (
                <span
                  className="text-xs font-mono max-w-[160px] truncate whitespace-pre"
                  title="Double-click or press F2 to rename"
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(tab) }}
                >
                  {tabLabel(tab)}
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive-foreground"
                  aria-label={`Close tab ${tabLabel(tab)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTab}
            className="flex items-center justify-center px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-tab-hover transition-colors shrink-0"
            aria-label="Add tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 shrink-0 border-l border-border">
          <button
            onClick={formatJson}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors"
            title="Format JSON"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            onClick={togglePreview}
            aria-pressed={previewing}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono hover:text-foreground hover:bg-tab-hover rounded-md transition-colors",
              previewing ? "text-foreground bg-tab-hover" : "text-muted-foreground"
            )}
            title={previewing ? "Back to editing" : "Preview markdown"}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>MD</span>
          </button>
          <button
            onClick={stashNote}
            disabled={!current?.content}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title={stashStatus === "failed" ? "Stash failed" : "Stash note"}
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
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-destructive hover:bg-tab-hover rounded-md transition-colors"
            title="Clear all tabs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear all</span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {draftIsDuplicate && (
          <div
            role="alert"
            className="absolute top-2 left-4 z-10 px-2.5 py-1.5 rounded-md text-xs font-mono bg-destructive text-destructive-foreground shadow-md pointer-events-none"
          >
            A tab named "{draftTrimmed}" already exists. Duplicate names aren't allowed.
          </div>
        )}
        {previewing ? (
          <MarkdownView source={current?.content ?? ""} />
        ) : (
          <textarea
            ref={textareaRef}
            value={current?.content ?? ""}
            onChange={(e) => updateContent(e.target.value)}
            placeholder="Start typing..."
            spellCheck={false}
            className={cn(
              "w-full h-full resize-none bg-background text-foreground",
              "font-mono text-sm leading-relaxed p-4",
              "outline-none border-0 placeholder:text-muted-foreground/40",
              "selection:bg-primary/30"
            )}
          />
        )}
        <div className="absolute bottom-3 right-4 text-[10px] font-mono text-muted-foreground/40 pointer-events-none">
          {(current?.content ?? "").split("\n").length} ln {'\u00B7'} {(current?.content ?? "").length} ch
        </div>
      </div>
    </div>
  )
}

import { useState, useRef } from "react"
import { X, Plus, Trash2, Code2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface NoteTab {
  id: string
  content: string
}

interface NotepadViewProps {
  tabs: NoteTab[]
  onTabsChange: (tabs: NoteTab[]) => void
}

export function NotepadView({ tabs, onTabsChange }: NotepadViewProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "_1")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const addTab = () => {
    const newId = `_${tabs.length + 1}`
    onTabsChange([...tabs, { id: newId, content: "" }])
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
    setActiveTab("_1")
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
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="text-xs font-mono">{tab.id}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive-foreground"
                  aria-label={`Close tab ${tab.id}`}
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
        <div className="absolute bottom-3 right-4 text-[10px] font-mono text-muted-foreground/40 pointer-events-none">
          {(current?.content ?? "").split("\n").length} ln {'\u00B7'} {(current?.content ?? "").length} ch
        </div>
      </div>
    </div>
  )
}

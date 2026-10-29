import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Plus, Trash2, FolderOpen, FileText, Search, X, Eye, Code2, ScanText } from "lucide-react"
import { cn } from "@/lib/utils"
import { scrapeText } from "@/lib/scrape"

// Page stashes are raw outerHTML; notes won't start with an <html> tag
const isHtmlContent = (text: string) => /^\s*<(!doctype html|html[\s>])/i.test(text)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export function StashView() {
  const [entries, setEntries] = useState<StashEntry[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [mode, setMode] = useState<"rendered" | "source" | "scraped">("rendered")
  // Only parse when the Scraped view is open; large pages take a moment
  const scraped = useMemo(() => (mode === "scraped" ? scrapeText(content) : ""), [mode, content])
  const [composing, setComposing] = useState(false)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteBody, setNoteBody] = useState("")

  const requestId = useRef(0)

  // Returns null when a newer search started while this one was in flight
  const refresh = useCallback(async () => {
    const id = ++requestId.current
    const [all, list] = await Promise.all([
      window.electronAPI?.listStash() ?? [],
      window.electronAPI?.searchStash(query) ?? [],
    ])
    if (id !== requestId.current) return null
    setTotal(all.length)
    setEntries(list)
    return list
  }, [query])

  // Debounced so content search doesn't re-read every file on each keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      refresh().then((list) => {
        if (!list) return
        setSelected((prev) => (prev && list.some((e) => e.name === prev) ? prev : list[0]?.name ?? null))
      })
    }, query ? 200 : 0)
    return () => clearTimeout(t)
  }, [refresh, query])

  useEffect(() => {
    setMode("rendered")
    if (!selected) { setContent(""); return }
    window.electronAPI?.readStash(selected).then(setContent).catch(() => setContent(""))
  }, [selected])

  const startNote = () => {
    setComposing(true)
    setNoteTitle("")
    setNoteBody("")
  }

  const saveNote = async () => {
    if (!noteBody.trim()) return
    const name = await window.electronAPI?.saveStash(noteTitle.trim() || "note", noteBody)
    setComposing(false)
    await refresh()
    if (name) setSelected(name)
  }

  const deleteEntry = async (name: string) => {
    await window.electronAPI?.deleteStash(name)
    const list = await refresh()
    if (list && selected === name) setSelected(list[0]?.name ?? null)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <div className="flex items-center justify-between gap-1 px-3 py-1.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-1 max-w-xs px-2 py-1 rounded-md bg-background border border-border focus-within:border-primary/40">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQuery("") }}
              placeholder="Search stash..."
              spellCheck={false}
              className="flex-1 min-w-0 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {query ? `${entries.length} of ${total}` : `${total} stashed`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startNote}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors"
            title="New text note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Note</span>
          </button>
          <button
            onClick={() => window.electronAPI?.openStashFolder()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors"
            title="Open stash folder"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Folder</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <ul className="w-56 shrink-0 border-r border-border overflow-y-auto">
          {entries.length === 0 && query && (
            <li className="px-3 py-4 text-xs text-muted-foreground">
              No matches for "{query}".
            </li>
          )}
          {total === 0 && !query && (
            <li className="px-3 py-4 text-xs text-muted-foreground">
              Nothing stashed yet. Save a page from the browser toolbar or add a note.
            </li>
          )}
          {entries.map((entry) => (
            <li
              key={entry.name}
              onClick={() => { setSelected(entry.name); setComposing(false) }}
              className={cn(
                "group flex items-start gap-2 px-3 py-2 cursor-pointer border-b border-border transition-colors duration-150",
                !composing && selected === entry.name
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono truncate" title={entry.name}>{entry.name}</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {formatDate(entry.mtime)} {'·'} {formatSize(entry.size)}
                </p>
                {entry.snippet && (
                  <p className="mt-1 text-[10px] font-mono text-muted-foreground/80 line-clamp-2 break-all">
                    {entry.snippet}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteEntry(entry.name) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${entry.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {composing ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
                <input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Title (optional)"
                  autoFocus
                  className="flex-1 bg-transparent text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground/40"
                />
                <button
                  onClick={() => setComposing(false)}
                  className="px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-tab-hover rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNote}
                  disabled={!noteBody.trim()}
                  className="px-2.5 py-1 text-xs font-mono rounded-md bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 transition-colors"
                >
                  Stash
                </button>
              </div>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write a note..."
                spellCheck={false}
                className="flex-1 w-full resize-none bg-background text-foreground font-mono text-sm leading-relaxed p-4 outline-none border-0 placeholder:text-muted-foreground/40 selection:bg-primary/30"
              />
            </>
          ) : selected && isHtmlContent(content) ? (
            <>
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0">
                {([["rendered", Eye, "Rendered"], ["source", Code2, "Source"], ["scraped", ScanText, "Scraped"]] as const).map(([value, Icon, text]) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md transition-colors",
                      mode === value
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-tab-hover"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{text}</span>
                  </button>
                ))}
              </div>
              {mode === "rendered" ? (
                // Empty sandbox: no scripts, forms, popups, or access to the app's origin
                <iframe srcDoc={content} sandbox="" title={selected} className="flex-1 w-full border-0 bg-white" />
              ) : mode === "scraped" ? (
                <textarea
                  value={scraped || "No readable text found."}
                  readOnly
                  className="flex-1 w-full resize-none bg-background text-foreground font-sans text-sm leading-relaxed whitespace-pre-wrap p-4 outline-none border-0 selection:bg-primary/30"
                />
              ) : (
                <textarea
                  value={content}
                  readOnly
                  spellCheck={false}
                  className="flex-1 w-full resize-none bg-background text-foreground font-mono text-sm leading-relaxed p-4 outline-none border-0 selection:bg-primary/30"
                />
              )}
            </>
          ) : selected ? (
            <textarea
              value={content}
              readOnly
              spellCheck={false}
              className="flex-1 w-full resize-none bg-background text-foreground font-mono text-sm leading-relaxed p-4 outline-none border-0 selection:bg-primary/30"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a stashed item.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

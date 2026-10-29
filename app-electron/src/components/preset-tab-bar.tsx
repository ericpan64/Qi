import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import type { PresetSite } from "../App"

interface PresetTabBarProps {
  sites: PresetSite[]
  activeId: string | null
  onSelect: (site: PresetSite) => void
  onRename: (id: string, label: string) => void
}

const hostname = (url: string) => {
  try { return new URL(url).hostname } catch { return url }
}

export function PresetTabBar({ sites, activeId, onSelect, onRename }: PresetTabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState("")
  // Set on Escape so the blur fired as the input unmounts doesn't commit the discarded draft
  const skipBlurCommit = useRef(false)

  const startRename = (site: PresetSite) => {
    setEditingId(site.id)
    setDraftLabel(site.label)
  }

  // Names are optional, so an empty draft is a valid (unnamed) label
  const commitRename = () => {
    if (editingId === null) return
    onRename(editingId, draftLabel.trim())
    setEditingId(null)
  }

  return (
    <div className="flex items-stretch h-11 bg-tab-bar border-b border-border overflow-x-auto shrink-0 select-none">
      {sites.map((site) => {
        const isActive = activeId === site.id
        const isEditing = editingId === site.id
        return (
          // A div rather than a button so the rename input can live inside it
          <div
            key={site.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(site)}
            onDoubleClick={() => startRename(site)}
            onKeyDown={(e) => {
              if (isEditing) return
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(site) }
            }}
            title="Double-click to rename"
            aria-label={site.label || hostname(site.url)}
            className={cn(
              "relative flex flex-col items-center justify-center px-4 min-w-[80px] max-w-[120px] shrink-0 cursor-pointer transition-colors duration-150 group",
              "border-r border-border",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
            )}
          >
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-tab-active rounded-t-full" />
            )}
            {isEditing ? (
              <input
                autoFocus
                value={draftLabel}
                maxLength={40}
                placeholder="Name"
                onChange={(e) => setDraftLabel(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename()
                  else if (e.key === "Escape") { skipBlurCommit.current = true; setEditingId(null) }
                }}
                onBlur={() => {
                  if (skipBlurCommit.current) { skipBlurCommit.current = false; return }
                  commitRename()
                }}
                spellCheck={false}
                aria-label={`Rename tab ${site.label || hostname(site.url)}`}
                className="w-full text-xs font-medium text-center leading-none mb-1.5 bg-background text-foreground px-1 py-0.5 rounded-sm outline-none border border-border placeholder:text-muted-foreground/40"
              />
            ) : site.label && (
              <span className="text-xs font-medium truncate whitespace-pre w-full text-center leading-none mb-1.5">
                {site.label}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono leading-none border",
                "transition-colors duration-150",
                isActive
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-border/40 bg-muted/30 text-muted-foreground/40 group-hover:border-border/60 group-hover:text-muted-foreground/60"
              )}
            >
              <span className="text-[10px] leading-none">{'⌘'}</span>
              <span>{typeof site.shortcut === "number" ? site.shortcut : site.shortcut}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

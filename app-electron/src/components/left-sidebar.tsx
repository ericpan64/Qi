import { Home, NotebookPen, Archive, ListChecks, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewMode } from "../App"

// The sidebar views, in display order. The view switcher renders the same list.
export const NAV_ITEMS: readonly { view: ViewMode; title: string; icon: LucideIcon }[] = [
  { view: "settings", title: "Home", icon: Home },
  { view: "notepad", title: "Notes", icon: NotebookPen },
  { view: "lists", title: "Lists", icon: ListChecks },
  { view: "stash", title: "Stash", icon: Archive },
]

interface LeftSidebarProps {
  activeView: ViewMode
  onSelect: (view: ViewMode) => void
}

export function LeftSidebar({ activeView, onSelect }: LeftSidebarProps) {
  return (
    <aside className="flex flex-col items-center gap-1 w-12 shrink-0 bg-tab-bar border-r border-border py-3 select-none">
      <div className="flex items-center justify-center w-8 h-8 mb-3">
        <span className="text-foreground/80 text-base font-semibold font-mono leading-none">气</span>
      </div>

      <div className="w-6 h-px bg-border mb-2" />

      {NAV_ITEMS.map(({ view, title, icon: Icon }) => (
        <button
          key={view}
          onClick={() => onSelect(view)}
          title={title}
          aria-label={title}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150",
            activeView === view
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </aside>
  )
}

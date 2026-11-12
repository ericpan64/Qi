import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/components/left-sidebar"
import type { ViewMode } from "../App"

// Index to highlight after one step. `open` is the highlighted index, or null when the
// switcher is closed. `current` is the active view's index, or -1 when a site is showing,
// in which case the switcher opens on `fallback` (the sidebar view used last) without stepping.
export function stepSwitcher(
  open: number | null,
  dir: 1 | -1,
  current: number,
  fallback: number,
  count: number
): number {
  if (open === null && current < 0) return fallback
  return ((open ?? current) + dir + count) % count
}

interface ViewSwitcherProps {
  index: number
  onPick: (view: ViewMode) => void
}

// One row of the sidebar views, shown while Alt is held. It takes no focus, so the field or
// webview that had focus keeps it.
export function ViewSwitcher({ index, onPick }: ViewSwitcherProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        role="listbox"
        aria-label="Switch view"
        className="flex gap-1 p-2 rounded-xl bg-surface border border-border shadow-lg pointer-events-auto select-none"
      >
        {NAV_ITEMS.map(({ view, title, icon: Icon }, i) => (
          <button
            key={view}
            role="option"
            aria-selected={i === index}
            // Keep focus where it was
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(view)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 w-16 h-16 rounded-lg transition-colors duration-100",
              i === index
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-mono">{title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

import { cn } from "@/lib/utils"
import type { PresetSite } from "../App"

interface PresetTabBarProps {
  sites: PresetSite[]
  activeId: string | null
  onSelect: (site: PresetSite) => void
}

export function PresetTabBar({ sites, activeId, onSelect }: PresetTabBarProps) {
  return (
    <div className="flex items-stretch h-11 bg-tab-bar border-b border-border overflow-x-auto shrink-0 select-none">
      {sites.map((site) => {
        const isActive = activeId === site.id
        return (
          <button
            key={site.id}
            onClick={() => onSelect(site)}
            className={cn(
              "relative flex flex-col items-center justify-center px-4 min-w-[80px] max-w-[120px] shrink-0 transition-colors duration-150 group",
              "border-r border-border",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
            )}
          >
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-tab-active rounded-t-full" />
            )}
            <span className="text-xs font-medium truncate w-full text-center leading-none mb-1.5">
              {site.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono leading-none border",
                "transition-colors duration-150",
                isActive
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-border/40 bg-muted/30 text-muted-foreground/40 group-hover:border-border/60 group-hover:text-muted-foreground/60"
              )}
            >
              <span className="text-[10px] leading-none">{'\u2318'}</span>
              <span>{typeof site.shortcut === "number" ? site.shortcut : site.shortcut}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

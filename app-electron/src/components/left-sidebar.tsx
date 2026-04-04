import { Home, NotebookPen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewMode } from "../App"

interface LeftSidebarProps {
  activeView: ViewMode
  onSettings: () => void
  onNotepad: () => void
}

function NavButton({ onClick, title, isActive, children }: {
  onClick: () => void
  title: string
  isActive: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

export function LeftSidebar({ activeView, onSettings, onNotepad }: LeftSidebarProps) {
  return (
    <aside className="flex flex-col items-center gap-1 w-12 shrink-0 bg-tab-bar border-r border-border py-3 select-none">
      <div className="flex items-center justify-center w-8 h-8 mb-3">
        <span className="text-foreground/80 text-base font-semibold font-mono leading-none">气</span>
      </div>

      <div className="w-6 h-px bg-border mb-2" />

      <NavButton onClick={onSettings} title="Home" isActive={activeView === "settings"}>
        <Home className="w-4 h-4" />
      </NavButton>

      <NavButton onClick={onNotepad} title="Notes" isActive={activeView === "notepad"}>
        <NotebookPen className="w-4 h-4" />
      </NavButton>
    </aside>
  )
}

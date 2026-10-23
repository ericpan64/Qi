import { useState, useEffect } from "react"
import { ArrowLeft, ArrowRight, House, RotateCw, Archive, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrowserToolbarProps {
  canGoBack: boolean
  canGoForward: boolean
  url: string
  onBack: () => void
  onForward: () => void
  onHome: () => void
  onReload: () => void
  onStashPage: () => Promise<boolean>
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    const host = u.host
    const rest = u.pathname + u.search + u.hash
    return rest === "/" ? host : host + rest
  } catch {
    return raw
  }
}

function NavButton({ onClick, title, disabled, children }: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150",
        disabled
          ? "text-muted-foreground/30 cursor-default"
          : "text-muted-foreground hover:bg-tab-hover hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

export function BrowserToolbar({ canGoBack, canGoForward, url, onBack, onForward, onHome, onReload, onStashPage }: BrowserToolbarProps) {
  const [stashed, setStashed] = useState(false)

  // Brief checkmark after a successful stash
  useEffect(() => {
    if (!stashed) return
    const t = setTimeout(() => setStashed(false), 1500)
    return () => clearTimeout(t)
  }, [stashed])

  const handleStash = async () => {
    if (await onStashPage()) setStashed(true)
  }

  return (
    <div className="flex items-center gap-0.5 h-9 px-2 bg-tab-bar border-b border-border shrink-0 select-none">
      <NavButton onClick={onBack} title="Back" disabled={!canGoBack}>
        <ArrowLeft className="w-3.5 h-3.5" />
      </NavButton>
      <NavButton onClick={onForward} title="Forward" disabled={!canGoForward}>
        <ArrowRight className="w-3.5 h-3.5" />
      </NavButton>
      <NavButton onClick={onHome} title="Home">
        <House className="w-3.5 h-3.5" />
      </NavButton>
      <NavButton onClick={onReload} title="Reload">
        <RotateCw className="w-3.5 h-3.5" />
      </NavButton>

      <div className="ml-2 flex-1 min-w-0">
        <span className="block text-xs text-muted-foreground truncate font-mono">
          {normalizeUrl(url)}
        </span>
      </div>

      <NavButton onClick={handleStash} title="Stash page HTML" disabled={!url}>
        {stashed ? <Check className="w-3.5 h-3.5 text-primary" /> : <Archive className="w-3.5 h-3.5" />}
      </NavButton>
    </div>
  )
}

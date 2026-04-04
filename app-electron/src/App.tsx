import { useState, useEffect, useCallback, useRef } from "react"
import { PresetTabBar } from "@/components/preset-tab-bar"
import { BrowserView } from "@/components/browser-view"
import { NotepadView } from "@/components/notepad-view"
import { SettingsView } from "@/components/settings-view"
import { LeftSidebar } from "@/components/left-sidebar"

export interface PresetSite {
  id: string
  label: string
  url: string
  shortcut: number | string
}

export type ViewMode = "browser" | "notepad" | "settings"

export default function App() {
  const [sites, setSites] = useState<PresetSite[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>("settings")
  const [loaded, setLoaded] = useState(false)

  // Notepad state (lifted for persistence)
  const [scratchTabs, setScratchTabs] = useState<{ id: string; content: string }[]>([
    { id: "_1", content: "" },
  ])
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load persisted data on mount
  useEffect(() => {
    window.electronAPI?.loadStore().then((data) => {
      if (data.websites?.length) {
        setSites(data.websites)
        setActiveId(data.websites[0].id)
      }
      if (data.scratchTabs?.length) {
        setScratchTabs(data.scratchTabs)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Auto-save scratch tabs (debounced)
  useEffect(() => {
    if (!loaded) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      window.electronAPI?.saveScratchTabs(scratchTabs)
    }, 500)
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current) }
  }, [scratchTabs, loaded])

  // Persist websites when they change
  useEffect(() => {
    if (!loaded) return
    window.electronAPI?.saveWebsites(sites)
  }, [sites, loaded])

  // Keyboard shortcuts: Cmd/Ctrl + digit
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const num = parseInt(e.key, 10)
        if (!isNaN(num)) {
          const match = sites.find((s) => s.shortcut === num)
          if (match) {
            e.preventDefault()
            setActiveId(match.id)
            setView("browser")
          }
        }
      }
    },
    [sites]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Listen for Cmd+digit from main process (works even when webview has focus)
  useEffect(() => {
    return window.electronAPI?.onSwitchTab((shortcut) => {
      const match = sites.find((s) => s.shortcut === shortcut)
      if (match) {
        setActiveId(match.id)
        setView("browser")
      }
    })
  }, [sites])

  const handleSelectSite = (site: PresetSite) => {
    setActiveId(site.id)
    setView("browser")
  }

  const activeSite = sites.find((s) => s.id === activeId) ?? null

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <LeftSidebar
        activeView={view}
        onSettings={() => setView("settings")}
        onNotepad={() => setView("notepad")}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <PresetTabBar
          sites={sites}
          activeId={view === "browser" ? activeId : null}
          onSelect={handleSelectSite}
        />

        <main className="flex flex-col flex-1 min-h-0">
          {view === "settings" ? (
            <SettingsView sites={sites} onSitesChange={setSites} />
          ) : view === "notepad" ? (
            <NotepadView tabs={scratchTabs} onTabsChange={setScratchTabs} />
          ) : (
            // Render all webviews, show/hide based on active site
            <div className="flex-1 relative min-h-0">
              {sites.map((site) => (
                <BrowserView
                  key={site.id}
                  site={site}
                  visible={view === "browser" && activeId === site.id}
                />
              ))}
              {!activeSite && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Select a site from the tab bar or add one in Settings.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

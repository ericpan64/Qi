import { useState, useEffect, useCallback, useRef } from "react"
import { PresetTabBar } from "@/components/preset-tab-bar"
import { BrowserView, type NavState } from "@/components/browser-view"
import { BrowserToolbar } from "@/components/browser-toolbar"
import { NotepadView, dedupeTabIds, maxTabNumber } from "@/components/notepad-view"
import { SettingsView } from "@/components/settings-view"
import { LeftSidebar } from "@/components/left-sidebar"
import { StashView } from "@/components/stash-view"

export interface PresetSite {
  id: string
  label: string
  url: string
  shortcut: number | string
}

export type ViewMode = "browser" | "notepad" | "settings" | "stash"

// Record the page's absolute base URL in stashed HTML so relative CSS/images resolve when
// rendered later. Replace any existing <base>, because a relative one would resolve against Qi.
function withBaseHref(html: string, url: string): string {
  if (!url) return html
  html = html.replace(/<base\b[^>]*>/gi, "")
  const tag = `<base href="${url.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`
  const head = html.match(/<head[^>]*>/i)
  if (!head || head.index === undefined) return tag + html
  const at = head.index + head[0].length
  return html.slice(0, at) + tag + html.slice(at)
}

export default function App() {
  const [sites, setSites] = useState<PresetSite[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>("settings")
  const [loaded, setLoaded] = useState(false)

  // Notepad state (lifted for persistence)
  const [scratchTabs, setScratchTabs] = useState<{ id: string; name?: string; content: string }[]>([
    { id: "_1", content: "" },
  ])
  const [lastTabNumber, setLastTabNumber] = useState(1)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Browser navigation state
  const webviewRefs = useRef<Record<string, WebviewElement | null>>({})
  const [navStates, setNavStates] = useState<Record<string, NavState>>({})

  // Load persisted data on mount
  useEffect(() => {
    window.electronAPI?.loadStore().then((data) => {
      if (data.websites?.length) {
        setSites(data.websites)
        setActiveId(data.websites[0].id)
      }
      if (data.scratchTabs?.length) {
        const tabs = dedupeTabIds(data.scratchTabs)
        setScratchTabs(tabs)
        setLastTabNumber(Math.max(data.lastTabNumber ?? 0, maxTabNumber(tabs)))
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Auto-save scratch tabs (debounced)
  useEffect(() => {
    if (!loaded) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      window.electronAPI?.saveScratchTabs(scratchTabs, lastTabNumber)
    }, 500)
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current) }
  }, [scratchTabs, lastTabNumber, loaded])

  // Persist websites when they change
  useEffect(() => {
    if (!loaded) return
    window.electronAPI?.saveWebsites(sites)

    // Prune stale refs and nav states for removed sites
    const siteIds = new Set(sites.map((s) => s.id))
    for (const id of Object.keys(webviewRefs.current)) {
      if (!siteIds.has(id)) delete webviewRefs.current[id]
    }
    setNavStates((prev) => {
      const next: Record<string, NavState> = {}
      for (const id of Object.keys(prev)) {
        if (siteIds.has(id)) next[id] = prev[id]
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
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

  const handleRenameSite = (id: string, label: string) => {
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)))
  }

  // Webview ref and nav state callbacks (stable refs to avoid re-renders)
  const handleWebviewRef = useCallback((siteId: string, el: WebviewElement | null) => {
    webviewRefs.current[siteId] = el
  }, [])

  const handleNavStateChange = useCallback((siteId: string, state: NavState) => {
    setNavStates((prev) => ({ ...prev, [siteId]: state }))
  }, [])

  // Toolbar actions
  const activeSite = sites.find((s) => s.id === activeId) ?? null
  const activeNav = (activeId && navStates[activeId]) || { canGoBack: false, canGoForward: false, url: "" }

  const handleBack = useCallback(() => {
    if (activeId) webviewRefs.current[activeId]?.goBack()
  }, [activeId])

  const handleForward = useCallback(() => {
    if (activeId) webviewRefs.current[activeId]?.goForward()
  }, [activeId])

  const handleHome = useCallback(() => {
    if (activeId && activeSite) webviewRefs.current[activeId]?.loadURL(activeSite.url)
  }, [activeId, activeSite])

  const handleReload = useCallback(() => {
    if (activeId) webviewRefs.current[activeId]?.reload()
  }, [activeId])

  // Save the active page's raw HTML to the stash as a .txt file
  const handleStashPage = useCallback(async () => {
    const wv = activeId ? webviewRefs.current[activeId] : null
    if (!wv) return false
    try {
      const api = window.electronAPI
      if (!api) throw new Error("Stash unavailable")
      // baseURI is already absolute and accounts for any <base> the page sets
      const { html, baseURI } = await wv.executeJavaScript<{ html: string; baseURI: string }>(
        "({ html: document.documentElement.outerHTML, baseURI: document.baseURI })"
      )
      const title = wv.getTitle() || activeSite?.label || "page"
      await api.saveStash(title, withBaseHref(html, baseURI))
      return true
    } catch {
      return false
    }
  }, [activeId, activeSite])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <LeftSidebar
        activeView={view}
        onSettings={() => setView("settings")}
        onNotepad={() => setView("notepad")}
        onStash={() => setView("stash")}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <PresetTabBar
          sites={sites}
          activeId={view === "browser" ? activeId : null}
          onSelect={handleSelectSite}
          onRename={handleRenameSite}
        />

        <main className="flex flex-col flex-1 min-h-0">
          {view === "settings" && (
            <SettingsView sites={sites} onSitesChange={setSites} />
          )}
          {view === "notepad" && (
            <NotepadView
              tabs={scratchTabs}
              onTabsChange={setScratchTabs}
              lastTabNumber={lastTabNumber}
              onLastTabNumberChange={setLastTabNumber}
            />
          )}
          {view === "stash" && <StashView />}

          {/* Toolbar, only visible in browser mode */}
          {view === "browser" && (
            <BrowserToolbar
              canGoBack={activeNav.canGoBack}
              canGoForward={activeNav.canGoForward}
              url={activeNav.url}
              onBack={handleBack}
              onForward={handleForward}
              onHome={handleHome}
              onReload={handleReload}
              onStashPage={handleStashPage}
            />
          )}

          {/* Browser pane, always mounted to preserve webview state */}
          <div
            className="flex-1 relative min-h-0"
            style={{ display: view === "browser" ? "flex" : "none" }}
          >
            {sites.map((site) => (
              <BrowserView
                key={site.id}
                site={site}
                visible={view === "browser" && activeId === site.id}
                onWebviewRef={handleWebviewRef}
                onNavStateChange={handleNavStateChange}
              />
            ))}
            {!activeSite && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a site from the tab bar or add one in Settings.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

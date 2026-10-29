import { useState } from "react"
import { Plus, X, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PresetSite } from "../App"

interface SettingsViewProps {
  sites: PresetSite[]
  onSitesChange: (sites: PresetSite[]) => void
}

function SiteCard({ site, onRemove }: { site: PresetSite; onRemove: () => void }) {
  const domain = (() => {
    try { return new URL(site.url).hostname } catch { return site.url }
  })()

  return (
    <div className="group relative bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3 hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
      <button
        onClick={onRemove}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center text-destructive-foreground"
        aria-label={`Remove ${site.label}`}
      >
        <X className="w-3 h-3" />
      </button>

      <span className="absolute top-2.5 left-2.5 text-[10px] font-mono text-muted-foreground/50 bg-muted rounded px-1 py-0.5">
        {typeof site.shortcut === "number" ? `\u2318${site.shortcut}` : site.shortcut}
      </span>

      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden mt-2">
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt={`${site.label} icon`}
          className="w-8 h-8 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
        />
      </div>

      <div className="text-center">
        {site.label && (
          <p className="text-sm font-semibold text-foreground leading-none mb-1 whitespace-pre">{site.label}</p>
        )}
        <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[120px]">{domain}</p>
      </div>
    </div>
  )
}

function AddSiteModal({ onAdd, onClose, nextShortcut }: {
  onAdd: (site: Omit<PresetSite, "id">) => void
  onClose: () => void
  nextShortcut: number
}) {
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    const normalized = url.startsWith("http") ? url : `https://${url}`
    onAdd({ label: label.trim(), url: normalized, shortcut: nextShortcut })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Add Website</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name <span className="normal-case tracking-normal text-muted-foreground/50">(optional)</span></label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="DuckDuckGo"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://duckduckgo.com"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!url.trim()}
            className="mt-1 w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add Site
          </button>
        </form>
      </div>
    </div>
  )
}

export function SettingsView({ sites, onSitesChange }: SettingsViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [windowSize, setWindowSize] = useState({
    leftWidth: 60, rightWidth: 60, topHeight: 60, bottomHeight: 60,
  })

  const removeSite = (id: string) => onSitesChange(sites.filter((s) => s.id !== id))

  const addSite = (site: Omit<PresetSite, "id">) => {
    const id = crypto.randomUUID()
    onSitesChange([...sites, { ...site, id }])
  }

  const handleSaveSizes = () => {
    window.electronAPI?.saveWindowSizes(windowSize)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Presets</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{sites.length} sites configured</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors",
              sites.length >= 9 && "opacity-40 cursor-not-allowed"
            )}
            disabled={sites.length >= 9}
          >
            <Plus className="w-4 h-4" />
            Add Website
          </button>
        </div>

        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Globe className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No sites yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} onRemove={() => removeSite(site.id)} />
            ))}
          </div>
        )}

        <div className="border-t border-border pt-8">
          <h2 className="text-sm font-semibold text-foreground mb-1">Window Size</h2>
          <p className="text-xs text-muted-foreground mb-5">Configure default positioning percentages</p>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {(["leftWidth", "rightWidth", "topHeight", "bottomHeight"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()} %
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={windowSize[key]}
                  onChange={(e) => setWindowSize((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveSizes}
            className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-tab-hover transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {showModal && (
        <AddSiteModal
          onAdd={addSite}
          onClose={() => setShowModal(false)}
          nextShortcut={sites.length + 1}
        />
      )}
    </div>
  )
}

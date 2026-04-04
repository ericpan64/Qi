import type { PresetSite } from "../App"

interface BrowserViewProps {
  site: PresetSite
  visible: boolean
}

export function BrowserView({ site, visible }: BrowserViewProps) {
  return (
    <webview
      src={site.url}
      // @ts-expect-error webview is an Electron element, not standard HTML
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        display: visible ? 'flex' : 'none',
      }}
    />
  )
}

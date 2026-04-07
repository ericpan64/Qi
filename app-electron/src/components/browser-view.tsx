import { useRef, useEffect } from "react"
import type { PresetSite } from "../App"

export interface NavState {
  canGoBack: boolean
  canGoForward: boolean
  url: string
}

interface BrowserViewProps {
  site: PresetSite
  visible: boolean
  onWebviewRef?: (siteId: string, el: WebviewElement | null) => void
  onNavStateChange?: (siteId: string, state: NavState) => void
}

export function BrowserView({ site, visible, onWebviewRef, onNavStateChange }: BrowserViewProps) {
  const ref = useRef<WebviewElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    onWebviewRef?.(site.id, el)

    const emitState = () => {
      onNavStateChange?.(site.id, {
        canGoBack: el.canGoBack(),
        canGoForward: el.canGoForward(),
        url: el.getURL(),
      })
    }

    el.addEventListener("did-navigate", emitState)
    el.addEventListener("did-navigate-in-page", emitState)
    el.addEventListener("did-stop-loading", emitState)

    return () => {
      el.removeEventListener("did-navigate", emitState)
      el.removeEventListener("did-navigate-in-page", emitState)
      el.removeEventListener("did-stop-loading", emitState)
      onWebviewRef?.(site.id, null)
    }
  }, [site.id, onWebviewRef, onNavStateChange])

  return (
    <webview
      ref={ref as React.Ref<WebviewElement>}
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

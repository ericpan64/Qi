import { useEffect, useId, useState } from "react"

type Mermaid = typeof import("mermaid").default

type DiagramState =
  | { status: "loading" }
  | { status: "ready"; svg: string }
  | { status: "error"; message: string }

let mermaidPromise: Promise<Mermaid> | null = null

// Imported on first use so notes without a diagram never load the library
function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      // Notes can hold pasted text. Strict mode sanitizes labels and disables click handlers.
      securityLevel: "strict",
      theme: "dark",
      suppressErrorRendering: true,
    })
    return mermaid
  })
  return mermaidPromise
}

export function MermaidDiagram({ source }: { source: string }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const [state, setState] = useState<DiagramState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    loadMermaid()
      .then((mermaid) => mermaid.render(id, source))
      .then(
        ({ svg }) => {
          if (!cancelled) setState({ status: "ready", svg })
        },
        (err: unknown) => {
          if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) })
        }
      )
    return () => {
      cancelled = true
    }
  }, [id, source])

  if (state.status === "ready") {
    return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: state.svg }} />
  }

  return (
    <>
      <pre>
        <code>{source}</code>
      </pre>
      {state.status === "error" && (
        <p role="alert" className="mermaid-error font-mono text-xs text-destructive whitespace-pre-wrap">
          {state.message}
        </p>
      )}
    </>
  )
}

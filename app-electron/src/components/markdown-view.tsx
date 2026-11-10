import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { MermaidDiagram } from "@/components/mermaid-diagram"

const EXTERNAL_URL = /^(https?:|mailto:)/i

const components: Components = {
  // The main process opens target="_blank" links in the system browser. A relative or
  // in-page href would navigate the app window itself, so it renders as plain text.
  a: ({ node: _node, href, children, ...props }) =>
    href && EXTERNAL_URL.test(href) ? (
      <a {...props} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  pre: ({ node, ...props }) => {
    const code = node?.children[0]
    if (
      code?.type === "element" &&
      Array.isArray(code.properties.className) &&
      code.properties.className.includes("language-mermaid")
    ) {
      const text = code.children[0]
      return <MermaidDiagram source={text?.type === "text" ? text.value.trim() : ""} />
    }
    return <pre {...props} />
  },
}

export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="markdown-body h-full overflow-y-auto p-4 pb-10 text-sm text-foreground selection:bg-primary/30">
      {source.trim() ? (
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {source}
        </Markdown>
      ) : (
        <p className="text-muted-foreground/40">Nothing to preview.</p>
      )}
    </div>
  )
}

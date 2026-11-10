import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

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

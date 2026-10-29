import { Readability } from "@mozilla/readability"

const BLOCKS = "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td"
const NOISE =
  "script, style, noscript, template, nav, header, footer, aside, form, button, dialog, [role=dialog], [role=navigation], [aria-hidden=true]"
// Below this, Readability probably missed the main content (e.g. docs pages, not articles)
const MIN_ARTICLE_CHARS = 200

// Plain text from block elements, one per paragraph; nested blocks aren't repeated
function blocksToText(root: ParentNode): string {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(BLOCKS))
  let out = ""
  let prevWasItem = false
  for (const el of blocks) {
    if (el.parentElement?.closest(BLOCKS)) continue
    const raw = el.textContent ?? ""
    const text = el.tagName === "PRE" ? raw.trimEnd() : raw.replace(/\s+/g, " ").trim()
    if (!text) continue
    const isItem = el.tagName === "LI"
    // Consecutive list items stay on adjacent lines; everything else is a paragraph
    if (out) out += isItem && prevWasItem ? "\n" : "\n\n"
    out += isItem ? `- ${text}` : text
    prevWasItem = isItem
  }
  return out
}

// Prepend the title unless the text already opens with it (e.g. a matching <h1>)
const withTitle = (title: string | null | undefined, body: string) =>
  title && body && !body.startsWith(title) ? `${title}\n\n${body}` : body

// Main readable text of a page: Readability's article, else the body minus page chrome.
// DOMParser documents are inert, so stashed scripts never run and nothing is fetched.
export function scrapeText(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  const fallbackDoc = doc.cloneNode(true) as Document // Readability mutates its input

  const article = new Readability(doc).parse()
  if (article?.content) {
    const body = blocksToText(parser.parseFromString(article.content, "text/html").body)
    if (body.length >= MIN_ARTICLE_CHARS) return withTitle(article.title?.trim(), body)
  }

  fallbackDoc.querySelectorAll(NOISE).forEach((el) => el.remove())
  return withTitle(fallbackDoc.title.trim(), blocksToText(fallbackDoc.body))
}

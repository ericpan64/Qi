# Qi

Qi is a small reference browser for the sites you look up most. It holds up to 9 preset websites in an always-on-top window that you show and hide with a global hotkey.

## Why

Checking docs or an API reference in a full browser means switching apps and finding the right tab. Qi keeps those pages in one window that opens over your current app with `Alt+Space` and hides the same way.

## What it does

- **Preset sites** -- Save up to 9 reference websites (docs, search, wikis, dashboards)
- **One-key switching** -- `Cmd+1` through `Cmd+9` jumps directly to a site
- **Show/hide** -- `Alt+Space` toggles the window globally, from any app
- **Snap to edges** -- `Alt+Arrow` snaps the window to a screen edge so it sits beside your work
- **Scratch pad** -- Jot notes, paste JSON, keep context without opening another app
- **Rename tabs** -- Double-click any site or scratch pad tab to rename it. Site names are optional; scratch pad names must be unique
- **Stash** -- Save the current page or scratch pad note for later. Search stashed items, and view saved pages as a rendered preview, raw source, or scraped text
- **Lists** -- Track a goal with a checklist of actions to reach it. The goal stays locked to prevent accidental edits; unlock it to change it. Each list shows the date you created it, takes an optional target date, and records the date you checked off the last action. Stash a list to save it as a markdown checklist
- **Remembers everything** -- Sites, notes, and window preferences persist across sessions

## Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Space` | Show or hide Qi |
| `Cmd+1` to `Cmd+9` | Jump to site 1 to 9 |
| `Alt+Left/Right/Up/Down` | Snap to screen edge |
| `Alt+Enter` | Toggle fullscreen |
| Double-click tab | Rename (`Enter` to save, `Esc` to cancel) |

## Run

Qi requires [Node.js](https://nodejs.org/) v18 or later and [pnpm](https://pnpm.io/).

```bash
cd app-electron
pnpm install
pnpm start
```

## Build

Run these from `app-electron`.

```bash
pnpm run package   # portable app
pnpm run make      # platform installer (DMG, ZIP)
```

## License

[MIT](LICENSE)

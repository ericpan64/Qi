# Qi

Qi is a small reference browser for the sites you look up most. It holds up to 9 preset websites in an always-on-top window that you show and hide with a global hotkey.

## Why

Checking docs or an API reference in a full browser means switching apps and finding the right tab. Qi keeps those pages in one window that opens over your current app with `Alt+Space` and hides the same way.

## What it does

- Saves up to 9 preset sites, such as docs, search, wikis, and dashboards.
- Jumps to a site with `Cmd+1` through `Cmd+9`.
- Shows or hides the window from any app with `Alt+Space`.
- Snaps the window to a screen edge with `Alt+Arrow`, so it sits beside your work.
- Includes scratch pads for notes and pasted text such as JSON.
- Renames a site or scratch pad tab when you double-click it. Site names are optional. Scratch pad names must be unique.
- Stashes the current page or scratch pad note for later. You can search stashed items and view a saved page as a rendered preview, raw source, or scraped text.
- Keeps sites, notes, and window preferences across sessions.

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

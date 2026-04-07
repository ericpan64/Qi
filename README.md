# Qi

A lightweight reference browser. Save the sites you look up most, switch between them instantly, and stay focused on your work.

Qi floats above your windows as an always-on-top overlay. You toggle it with a hotkey, grab what you need, and dismiss it -- no app switching, no lost context. It holds up to 9 preset websites you can reach with a single keystroke.

## Why

Browsers are built for browsing. When you just need to check docs, look up an API, or search a quick answer, a full browser pulls you out of flow. Qi keeps reference material one shortcut away so you never leave what you're doing.

## What It Does

- **Preset sites** -- Save up to 9 reference websites (docs, search, wikis, dashboards)
- **One-key switching** -- `Cmd+1` through `Cmd+9` jumps directly to a site
- **Show/hide** -- `Alt+Space` toggles the window globally, from any app
- **Snap to edges** -- `Alt+Arrow` snaps the window to a screen edge so it sits beside your work
- **Scratch pad** -- Jot notes, paste JSON, keep context without opening another app
- **Remembers everything** -- Sites, notes, and window preferences persist across sessions

## Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Space` | Show / hide Qi |
| `Cmd+1` .. `Cmd+9` | Jump to site 1-9 |
| `Alt+Left/Right/Up/Down` | Snap to screen edge |
| `Alt+Enter` | Toggle fullscreen |

## Run

Requires [Node.js](https://nodejs.org/) (v18+) and [pnpm](https://pnpm.io/).

```bash
cd app-electron
pnpm install
pnpm start
```

## Build

```bash
pnpm run package   # portable app
pnpm run make      # platform installer (DMG, ZIP)
```

## License

[MIT](LICENSE)

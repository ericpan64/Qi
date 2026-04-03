# Qi Reference Browser -- Design Document

Rewrite of the Electron-based `pithy/Qi-Reference-Browser` into **SvelteKit + Tauri 2.0** (`app/`).

---

## Overview

A keyboard-driven overlay browser for quick-reference websites. The app floats above all windows, toggles visibility with a global hotkey, and lets users snap it to screen edges. It manages a set of saved websites (max 9) with one-key tab switching and includes a scratch pad for notes.

---

## Core Components

### 1. Window Shell (Tauri Rust backend)

**Purpose**: Desktop window lifecycle, always-on-top enforcement, global shortcuts, screen-aware snapping.

| Responsibility | Electron Original | Tauri 2.0 Equivalent |
|---|---|---|
| Always-on-top window | `BrowserWindow({ alwaysOnTop: true })` | `WindowBuilder::new().always_on_top(true)` / window config |
| Global hotkeys | `globalShortcut.register()` | `tauri-plugin-global-shortcut` |
| Window snapping to edges | `activeWindow.setBounds(...)` | Tauri window `set_position` / `set_size` APIs |
| Toggle visibility | `win.show()` / `win.hide()` | `window.show()` / `window.hide()` via commands |
| Multi-monitor support | `screen.getDisplayMatching()` | `tauri::window::Monitor` / `available_monitors()` |
| Persistent config storage | `electron-store` | `tauri-plugin-store` |

**Key shortcuts to implement:**

| Shortcut | Action |
|----------|--------|
| `Alt+Space` | Toggle app visibility (global) |
| `Alt+Arrow` | Snap window to edge (left/right/top/bottom) |
| `Alt+Enter` | Toggle fullscreen |
| `Ctrl+0` | Home tab |
| `Ctrl+1`..`Ctrl+9` | Switch to site tab N |
| `` Ctrl+` `` | Scratch pad |
| `Ctrl+Left/Right` | Back / forward navigation in webview |

### 2. Webview / Site Viewer (SvelteKit component)

**Purpose**: Embed external websites inside the app.

**Tauri approach**: Use `<iframe>` for web content (Tauri 2.0 does not have a built-in `<webview>` tag like Electron). Alternatively, evaluate `tauri-plugin-webview` for multi-webview windows if iframe restrictions are too limiting (CORS, cookie isolation).

**Sub-components:**
- **NavigationBar** -- back, forward, home buttons + read-only URL display (click-to-copy)
- **BreadcrumbTrail** -- clickable history of visited pages within a site session
- **WebContent** -- the iframe/webview itself

**State per site tab:**
```
{
  url: string,          // current URL
  homeUrl: string,      // saved origin URL
  history: string[],    // breadcrumb trail
  canGoBack: boolean,
  canGoForward: boolean
}
```

> **Design decision needed**: iframe vs. Tauri multi-webview. Iframes have CORS and cookie limitations that may break many sites. Tauri 2.0's `WebviewBuilder` can create additional webviews in the same window, which behaves more like Electron's `<webview>`. Recommend starting with **Tauri multi-webview** for fidelity, falling back to iframe only for simpler use cases.

### 3. Tab System (SvelteKit component)

**Purpose**: Switch between Home, saved sites, and scratch pad.

**Structure:**
```
TabBar
  ├── (`) ScratchPad
  ├── (1) Site 1
  ├── (2) Site 2
  ├── ...
  └── (0) Home
```

- Tabs are derived from the saved websites list
- Active tab controls which content panel is visible
- Keyboard shortcuts (`Ctrl+N`) switch tabs via Tauri global shortcut -> invoke command -> Svelte store update

### 4. Home / Launcher View (SvelteKit component)

**Purpose**: Manage saved websites and window-snapping settings.

**Sub-components:**
- **WebsiteGrid** -- card grid of saved sites (favicon, name, domain, delete button)
- **AddWebsiteForm** -- URL + name input, validates format, prevents duplicates
- **WindowSizeSettings** -- sliders/inputs for snap percentages (left/right width %, top/bottom height %)

**Behaviors:**
- Drag-and-drop reorder of website cards
- Max 9 websites enforced
- Deterministic color generation per URL (hash-based)
- Auto-fetch favicon from `{origin}/favicon.ico`

### 5. Scratch Pad (SvelteKit component)

**Purpose**: Quick notes / JSON viewer with multiple sub-tabs.

**Sub-components:**
- **SubTabBar** -- add/close/switch between scratch tabs
- **TextEditor** -- textarea per sub-tab
- **Toolbar** -- "Format JSON" button, "Clear All" button

**Behaviors:**
- Auto-save on input (debounced 500ms)
- Sub-tabs auto-numbered (`_1`, `_2`, ...)
- Persisted to store

### 6. Persistent Store

**Purpose**: Save user data across sessions.

**Backend**: `tauri-plugin-store` (replaces `electron-store`)

**Schema:**
```json
{
  "websites": [
    { "url": "https://...", "name": "Docs", "color": "#ab12cd", "logo": "https://.../favicon.ico" }
  ],
  "windowSizes": {
    "leftWidthPercent": 60,
    "rightWidthPercent": 60,
    "topHeightPercent": 60,
    "bottomHeightPercent": 60
  },
  "scratchText": "[{\"id\":\"_1\",\"text\":\"...\"}]"
}
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────┐
│                Tauri 2.0 (Rust)                  │
│                                                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Global       │  │ Window Management        │  │
│  │ Shortcuts    │  │  - always on top         │  │
│  │ (plugin)     │  │  - snap to edges         │  │
│  │              │  │  - show/hide toggle      │  │
│  └──────┬───────┘  │  - multi-monitor aware   │  │
│         │          └────────────┬─────────────┘  │
│         │                      │                 │
│  ┌──────┴──────────────────────┴──────────────┐  │
│  │         Tauri Commands (IPC)               │  │
│  │  - switch_tab, toggle_visibility           │  │
│  │  - snap_window, get_monitors               │  │
│  │  - CRUD websites, save settings            │  │
│  └──────────────────┬────────────────────────┘  │
│                     │                            │
│  ┌──────────────────┴────────────────────────┐  │
│  │         tauri-plugin-store                 │  │
│  │         (persistent JSON config)           │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────── WebView ─────────────────────────┤
│                                                  │
│  SvelteKit Frontend                              │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ TabBar                                     │  │
│  │  (`) Scratch | (1) Site | ... | (0) Home   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐  │
│  │  Home    │ │  SiteViewer  │ │ ScratchPad │  │
│  │          │ │              │ │            │  │
│  │ Website  │ │ NavBar       │ │ SubTabs    │  │
│  │ Grid     │ │ Breadcrumbs  │ │ TextArea   │  │
│  │ Add Form │ │ WebContent   │ │ JSON Fmt   │  │
│  │ Settings │ │ (webview)    │ │            │  │
│  └──────────┘ └──────────────┘ └────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Svelte Stores (reactive state)             │  │
│  │  - websites, activeTab, windowSizes,       │  │
│  │    scratchTabs, siteStates                 │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## SvelteKit Route Structure

```
src/routes/
  +layout.svelte        -- TabBar + global keyboard listeners
  +page.svelte          -- Home/Launcher view (default route)

src/lib/
  components/
    TabBar.svelte
    WebsiteGrid.svelte
    WebsiteCard.svelte
    AddWebsiteForm.svelte
    WindowSizeSettings.svelte
    SiteViewer.svelte
    NavigationBar.svelte
    BreadcrumbTrail.svelte
    ScratchPad.svelte
    SubTabBar.svelte

  stores/
    websites.ts         -- website list + CRUD
    tabs.ts             -- active tab, tab switching
    windowSizes.ts      -- snap percentages
    scratch.ts          -- scratch pad text + sub-tabs
    siteState.ts        -- per-site navigation state

  utils/
    color.ts            -- deterministic hash color
    favicon.ts          -- favicon URL builder
    validation.ts       -- URL validation, duplicate check
```

---

## Tauri Command Interface (Rust -> JS)

```rust
#[tauri::command]
fn toggle_visibility(window: tauri::Window) -> Result<(), String>

#[tauri::command]
fn snap_window(window: tauri::Window, direction: &str) -> Result<(), String>

#[tauri::command]
fn get_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String>
```

Most data operations (website CRUD, scratch pad, settings) can be handled entirely in the frontend via `tauri-plugin-store`, keeping the Rust backend focused on window management and OS-level operations.

---

## Open Questions

1. **Webview strategy**: Use Tauri 2.0 multi-webview API or iframes? Multi-webview is more capable but adds complexity. Recommend multi-webview for sites that need cookies/auth.
2. **Tab cycling** (`Alt+Tab` / `Alt+Shift+Tab`): In the Electron version this cycled through multiple windows. With a single-window tab-based design, this becomes tab cycling instead.
3. **Site preload scripts**: Electron allowed injecting preload scripts into webviews. If using Tauri multi-webview, investigate `WebviewBuilder::initialization_script()` for equivalent functionality.
4. **Cross-platform shortcuts**: The original uses `Ctrl+` combos. On macOS, consider mapping to `Cmd+` or keeping `Ctrl+` for consistency.

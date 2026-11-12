import { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Forge-generated globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// --- Persistent Store ---

interface Website {
  id: string;
  label: string;
  url: string;
  shortcut: number | string;
}

interface WindowSizes {
  leftWidth: number;
  rightWidth: number;
  topHeight: number;
  bottomHeight: number;
}

interface StoreData {
  websites: Website[];
  windowSizes: WindowSizes;
  scratchTabs: { id: string; name?: string; content: string }[];
  lastTabNumber?: number;
  lists: QiList[];
}

interface ListItem {
  id: string;
  text: string;
  done: boolean;
}

interface QiList {
  id: string;
  goal: string;
  items: ListItem[];
  createdAt: number;
  targetDate?: string;
  completedAt?: number;
}

// A real YYYY-MM-DD day. The shape alone admits days like 2024-02-31, which Date rolls into
// the next month while the overdue check still compares the raw string.
function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Coerce persisted lists into the expected shape so a hand-edited store can't crash the view.
// IDs must be unique: the view selects, updates, and deletes by ID, so a duplicate would act on
// every list (or item) sharing it.
function normalizeLists(raw: unknown): QiList[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const uniqueId = (id: unknown): string => {
    const next = typeof id === 'string' && id && !seen.has(id) ? id : crypto.randomUUID();
    seen.add(next);
    return next;
  };
  return raw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({
      id: uniqueId(l.id),
      goal: typeof l.goal === 'string' ? l.goal : '',
      createdAt: typeof l.createdAt === 'number' ? l.createdAt : Date.now(),
      ...(isCalendarDay(l.targetDate) ? { targetDate: l.targetDate } : {}),
      ...(typeof l.completedAt === 'number' && Number.isFinite(l.completedAt)
        ? { completedAt: l.completedAt }
        : {}),
      items: (Array.isArray(l.items) ? l.items : [])
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map((i) => ({
          id: uniqueId(i.id),
          text: typeof i.text === 'string' ? i.text : '',
          done: i.done === true,
        })),
    }));
}

const DEFAULT_DATA: StoreData = {
  websites: [],
  windowSizes: { leftWidth: 60, rightWidth: 60, topHeight: 60, bottomHeight: 60 },
  scratchTabs: [{ id: '_1', content: '' }],
  lists: [],
};

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'qi-data.json');
}

function readStore(): StoreData {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    const parsed = { ...DEFAULT_DATA, ...JSON.parse(raw) };

    // Normalize legacy website entries that used "name" instead of "label"
    // and may be missing "id" or "shortcut" fields
    if (Array.isArray(parsed.websites)) {
      parsed.websites = parsed.websites.map((w: Record<string, unknown>, i: number) => ({
        id: (w.id as string) || crypto.randomUUID(),
        label: (w.label as string) || (w.name as string) || '',
        url: (w.url as string) || '',
        shortcut: w.shortcut ?? i + 1,
      }));
    }

    // Normalize legacy windowSizes keys (e.g. leftWidthPercent becomes leftWidth)
    const ws = parsed.windowSizes as Record<string, unknown>;
    parsed.windowSizes = {
      leftWidth: (ws.leftWidth as number) ?? (ws.leftWidthPercent as number) ?? DEFAULT_DATA.windowSizes.leftWidth,
      rightWidth: (ws.rightWidth as number) ?? (ws.rightWidthPercent as number) ?? DEFAULT_DATA.windowSizes.rightWidth,
      topHeight: (ws.topHeight as number) ?? (ws.topHeightPercent as number) ?? DEFAULT_DATA.windowSizes.topHeight,
      bottomHeight: (ws.bottomHeight as number) ?? (ws.bottomHeightPercent as number) ?? DEFAULT_DATA.windowSizes.bottomHeight,
    };

    parsed.lists = normalizeLists(parsed.lists);

    return parsed;
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function writeStore(data: StoreData): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
}

// --- Stash (raw .txt files on disk) ---

interface StashEntry {
  name: string;
  size: number;
  mtime: number;
  snippet?: string;
}

function getStashDir(): string {
  const dir = path.join(app.getPath('userData'), 'stash');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Resolve a renderer-supplied filename to a path inside the stash dir (no traversal)
function stashPath(name: string): string {
  const base = path.basename(name);
  if (!base.endsWith('.txt')) throw new Error(`Invalid stash file: ${name}`);
  return path.join(getStashDir(), base);
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
}

function listStash(): StashEntry[] {
  const dir = getStashDir();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

// Case-insensitive match on filename or content; content matches carry a snippet.
// Async reads so large HTML stashes don't block the main process (shortcuts, window).
async function searchStash(query: string): Promise<StashEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listStash();
  const dir = getStashDir();
  const results: StashEntry[] = [];
  for (const entry of listStash()) {
    let content: string;
    try {
      content = await fs.promises.readFile(path.join(dir, entry.name), 'utf-8');
    } catch {
      continue; // skip files deleted or unreadable mid-search
    }
    const idx = content.toLowerCase().indexOf(q);
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(content.length, idx + q.length + 60);
      const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
      results.push({ ...entry, snippet: `${start > 0 ? '…' : ''}${snippet}${end < content.length ? '…' : ''}` });
    } else if (entry.name.toLowerCase().includes(q)) {
      results.push(entry);
    }
  }
  return results;
}

function saveStash(title: string, content: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '');
  const stem = `${stamp}_${slugify(title)}`;
  let name = `${stem}.txt`;
  for (let i = 2; fs.existsSync(path.join(getStashDir(), name)); i++) {
    name = `${stem}-${i}.txt`;
  }
  fs.writeFileSync(path.join(getStashDir(), name), content, 'utf-8');
  return name;
}

// --- Window Management ---

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    alwaysOnTop: true,
    title: 'Qi',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow!.show());

  // On macOS, hide instead of destroying so Alt+Space / dock click can restore
  if (process.platform === 'darwin') {
    mainWindow.on('close', (e) => {
      if (!app.isQuitting) {
        e.preventDefault();
        mainWindow!.hide();
      }
    });
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Links in rendered markdown notes open in the system browser, never in a new app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Block Chromium's default Alt+Arrow navigation (back/forward)
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.alt && !input.control && !input.meta && !input.shift) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(input.key)) {
        _event.preventDefault();
      }
    }
    // Intercept Cmd/Ctrl+digit on the host page (when no webview has focus)
    if (input.type === 'keyDown' && (input.meta || input.control) && !input.alt && !input.shift) {
      const num = parseInt(input.key, 10);
      if (num >= 1 && num <= 9) {
        _event.preventDefault();
        mainWindow!.webContents.send('switch-tab', num);
      }
    }
  });

  // Intercept Cmd/Ctrl+digit inside webview guest pages (webviews have their own webContents)
  mainWindow.webContents.on('did-attach-webview', (_event, webviewContents) => {
    webviewContents.on('before-input-event', (_ev, input) => {
      if (input.type === 'keyDown' && (input.meta || input.control) && !input.alt && !input.shift) {
        const num = parseInt(input.key, 10);
        if (num >= 1 && num <= 9) {
          _ev.preventDefault();
          mainWindow!.webContents.send('switch-tab', num);
        }
      }
    });
  });
}

// --- Window Snapping ---

type SnapDirection = 'left' | 'right' | 'top' | 'bottom';

function snapWindow(direction: SnapDirection): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { windowSizes } = readStore();
  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const { x, y, width, height } = display.workArea;

  const bounds: Record<SnapDirection, Electron.Rectangle> = {
    left: { x, y, width: Math.round(width * windowSizes.leftWidth / 100), height },
    right: {
      x: x + width - Math.round(width * windowSizes.rightWidth / 100),
      y,
      width: Math.round(width * windowSizes.rightWidth / 100),
      height,
    },
    top: { x, y, width, height: Math.round(height * windowSizes.topHeight / 100) },
    bottom: {
      x,
      y: y + height - Math.round(height * windowSizes.bottomHeight / 100),
      width,
      height: Math.round(height * windowSizes.bottomHeight / 100),
    },
  };

  mainWindow.setBounds(bounds[direction]);
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function toggleVisibility(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// --- IPC Handlers ---

function registerIpc(): void {
  ipcMain.handle('store:load', () => readStore());

  ipcMain.handle('store:saveWebsites', (_e, websites: Website[]) => {
    const data = readStore();
    data.websites = websites;
    writeStore(data);
    return data.websites;
  });

  ipcMain.handle('store:saveWindowSizes', (_e, sizes: WindowSizes) => {
    const data = readStore();
    data.windowSizes = sizes;
    writeStore(data);
    return data.windowSizes;
  });

  ipcMain.handle('store:saveScratchTabs', (_e, tabs: { id: string; name?: string; content: string }[], lastTabNumber: number) => {
    const data = readStore();
    data.scratchTabs = tabs;
    data.lastTabNumber = lastTabNumber;
    writeStore(data);
    return data.scratchTabs;
  });

  ipcMain.handle('store:saveLists', (_e, lists: QiList[]) => {
    const data = readStore();
    data.lists = lists;
    writeStore(data);
    return data.lists;
  });

  // Blocking variant for the renderer's unload flush: an async invoke may not finish before teardown
  ipcMain.on('store:saveListsSync', (e, lists: QiList[]) => {
    const data = readStore();
    data.lists = lists;
    writeStore(data);
    e.returnValue = true;
  });

  ipcMain.handle('stash:list', () => listStash());
  ipcMain.handle('stash:search', (_e, query: string) => searchStash(query));
  ipcMain.handle('stash:read', (_e, name: string) => fs.readFileSync(stashPath(name), 'utf-8'));
  ipcMain.handle('stash:save', (_e, title: string, content: string) => saveStash(title, content));
  ipcMain.handle('stash:delete', (_e, name: string) => fs.rmSync(stashPath(name), { force: true }));
  ipcMain.handle('stash:openFolder', () => shell.openPath(getStashDir()));
}

// --- Global Shortcuts ---

function registerShortcuts(): void {
  globalShortcut.register('Alt+Space', toggleVisibility);

  globalShortcut.register('Alt+Enter', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  globalShortcut.register('Alt+Left', () => snapWindow('left'));
  globalShortcut.register('Alt+Right', () => snapWindow('right'));
  globalShortcut.register('Alt+Up', () => snapWindow('top'));
  globalShortcut.register('Alt+Down', () => snapWindow('bottom'));

  // Block Chromium's default Alt+Left/Right (back/forward navigation)
  app.on('browser-window-created', (_e, win) => {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.alt && !input.control && !input.meta && !input.shift) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(input.key)) {
          _event.preventDefault();
        }
      }
    });
  });

  // Tab shortcuts: createWindow() intercepts Cmd/Ctrl+1..9 in before-input-event
  // and forwards them to the renderer over IPC.
}

// --- App Lifecycle ---

app.whenReady().then(() => {
  // Remove default menu so Cmd+digit shortcuts pass through to webContents
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]));

  registerIpc();
  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

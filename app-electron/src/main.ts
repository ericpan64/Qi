import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
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
  scratchTabs: { id: string; content: string }[];
}

const DEFAULT_DATA: StoreData = {
  websites: [],
  windowSizes: { leftWidth: 60, rightWidth: 60, topHeight: 60, bottomHeight: 60 },
  scratchTabs: [{ id: '_1', content: '' }],
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

    return parsed;
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function writeStore(data: StoreData): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
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

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
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

  ipcMain.handle('store:saveScratchTabs', (_e, tabs: { id: string; content: string }[]) => {
    const data = readStore();
    data.scratchTabs = tabs;
    writeStore(data);
    return data.scratchTabs;
  });

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

  // Tab shortcuts: Cmd/Ctrl+1..9 are intercepted via before-input-event
  // in createWindow() and forwarded to the renderer via IPC.
}

// --- App Lifecycle ---

app.whenReady().then(() => {
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

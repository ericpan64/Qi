interface WebviewElement extends HTMLElement {
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  loadURL(url: string): Promise<void>
  getURL(): string
  getTitle(): string
  executeJavaScript<T = unknown>(code: string): Promise<T>
}

interface ElectronAPI {
  loadStore: () => Promise<{
    websites: import('../App').PresetSite[];
    windowSizes: { leftWidth: number; rightWidth: number; topHeight: number; bottomHeight: number };
    scratchTabs: { id: string; content: string }[];
    lastTabNumber?: number;
  }>;
  saveWebsites: (websites: unknown[]) => Promise<unknown>;
  saveWindowSizes: (sizes: unknown) => Promise<unknown>;
  saveScratchTabs: (tabs: unknown[], lastTabNumber: number) => Promise<unknown>;
  listStash: () => Promise<StashEntry[]>;
  searchStash: (query: string) => Promise<StashEntry[]>;
  readStash: (name: string) => Promise<string>;
  saveStash: (title: string, content: string) => Promise<string>;
  deleteStash: (name: string) => Promise<void>;
  openStashFolder: () => Promise<string>;
  onSwitchTab: (callback: (shortcut: number) => void) => () => void;
}

declare global {
  interface StashEntry {
    name: string;
    size: number;
    mtime: number;
    snippet?: string;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

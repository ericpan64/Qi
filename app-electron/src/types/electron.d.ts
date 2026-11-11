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
    scratchTabs: { id: string; name?: string; content: string }[];
    lastTabNumber?: number;
    lists?: QiList[];
  }>;
  saveWebsites: (websites: unknown[]) => Promise<unknown>;
  saveWindowSizes: (sizes: unknown) => Promise<unknown>;
  saveScratchTabs: (tabs: unknown[], lastTabNumber: number) => Promise<unknown>;
  saveLists: (lists: QiList[]) => Promise<unknown>;
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
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

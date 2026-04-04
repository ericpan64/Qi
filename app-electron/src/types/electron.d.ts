interface ElectronAPI {
  loadStore: () => Promise<{
    websites: import('../App').PresetSite[];
    windowSizes: { leftWidth: number; rightWidth: number; topHeight: number; bottomHeight: number };
    scratchTabs: { id: string; content: string }[];
  }>;
  saveWebsites: (websites: unknown[]) => Promise<unknown>;
  saveWindowSizes: (sizes: unknown) => Promise<unknown>;
  saveScratchTabs: (tabs: unknown[]) => Promise<unknown>;
  onSwitchTab: (callback: (shortcut: number) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

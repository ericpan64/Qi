import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveWebsites: (websites: unknown[]) => ipcRenderer.invoke('store:saveWebsites', websites),
  saveWindowSizes: (sizes: unknown) => ipcRenderer.invoke('store:saveWindowSizes', sizes),
  saveScratchTabs: (tabs: unknown[]) => ipcRenderer.invoke('store:saveScratchTabs', tabs),
  listStash: () => ipcRenderer.invoke('stash:list'),
  searchStash: (query: string) => ipcRenderer.invoke('stash:search', query),
  readStash: (name: string) => ipcRenderer.invoke('stash:read', name),
  saveStash: (title: string, content: string) => ipcRenderer.invoke('stash:save', title, content),
  deleteStash: (name: string) => ipcRenderer.invoke('stash:delete', name),
  openStashFolder: () => ipcRenderer.invoke('stash:openFolder'),
  onSwitchTab: (callback: (shortcut: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, shortcut: number) => callback(shortcut);
    ipcRenderer.on('switch-tab', handler);
    return () => ipcRenderer.removeListener('switch-tab', handler);
  },
});

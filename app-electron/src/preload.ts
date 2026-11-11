import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveWebsites: (websites: unknown[]) => ipcRenderer.invoke('store:saveWebsites', websites),
  saveWindowSizes: (sizes: unknown) => ipcRenderer.invoke('store:saveWindowSizes', sizes),
  saveScratchTabs: (tabs: unknown[], lastTabNumber: number) => ipcRenderer.invoke('store:saveScratchTabs', tabs, lastTabNumber),
  saveLists: (lists: unknown[]) => ipcRenderer.invoke('store:saveLists', lists),
  saveListsSync: (lists: unknown[]) => ipcRenderer.sendSync('store:saveListsSync', lists),
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
  setSwitcherOpen: (open: boolean) => ipcRenderer.send('switcher:open', open),
  onSwitcher: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('switcher', handler);
    return () => ipcRenderer.removeListener('switcher', handler);
  },
});

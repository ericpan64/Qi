import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveWebsites: (websites: unknown[]) => ipcRenderer.invoke('store:saveWebsites', websites),
  saveWindowSizes: (sizes: unknown) => ipcRenderer.invoke('store:saveWindowSizes', sizes),
  saveScratchTabs: (tabs: unknown[]) => ipcRenderer.invoke('store:saveScratchTabs', tabs),
  onSwitchTab: (callback: (shortcut: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, shortcut: number) => callback(shortcut);
    ipcRenderer.on('switch-tab', handler);
    return () => ipcRenderer.removeListener('switch-tab', handler);
  },
});

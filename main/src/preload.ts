import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  recorderDone: (projectId: string) => ipcRenderer.invoke('recorder:done', projectId),
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  openEditor: (projectId: string) => ipcRenderer.invoke('open-editor', projectId),
  openRecorder: (projectId: string) => ipcRenderer.invoke('open-recorder', projectId),
  onOpenProject: (cb: (projectId: string) => void) => {
    const handler = (_: unknown, projectId: string) => cb(projectId);
    ipcRenderer.on('open-project', handler);
    return () => ipcRenderer.removeListener('open-project', handler);
  },
  onSetProjectId: (cb: (projectId: string) => void) => {
    const handler = (_: unknown, projectId: string) => cb(projectId);
    ipcRenderer.on('set-project-id', handler);
    return () => ipcRenderer.removeListener('set-project-id', handler);
  },
  onMenuNewProject: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('menu:new-project', handler);
    return () => ipcRenderer.removeListener('menu:new-project', handler);
  },
  onMenuSetTheme: (cb: (theme: 'light' | 'dark') => void) => {
    const handler = (_: unknown, theme: 'light' | 'dark') => cb(theme);
    ipcRenderer.on('menu:set-theme', handler);
    return () => ipcRenderer.removeListener('menu:set-theme', handler);
  },
  onMenuSetLanguage: (cb: (lang: string) => void) => {
    const handler = (_: unknown, lang: string) => cb(lang);
    ipcRenderer.on('menu:set-language', handler);
    return () => ipcRenderer.removeListener('menu:set-language', handler);
  },
});

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('srtMaker', {
  chooseAudio: () => ipcRenderer.invoke('dialog:audio'),
  chooseModel: () => ipcRenderer.invoke('dialog:model'),
  chooseOutput: (defaultPath) => ipcRenderer.invoke('dialog:output', defaultPath),
  getDefaults: () => ipcRenderer.invoke('app:defaults'),
  getSystemStatus: () => ipcRenderer.invoke('app:system-status'),
  generate: (options) => ipcRenderer.invoke('srt:generate', options),
  showInFolder: (filePath) => ipcRenderer.invoke('file:show-in-folder', filePath),
  onProgress: (callback) => {
    const listener = (_event, message) => callback(message)
    ipcRenderer.on('srt:progress', listener)
    return () => ipcRenderer.removeListener('srt:progress', listener)
  },
})

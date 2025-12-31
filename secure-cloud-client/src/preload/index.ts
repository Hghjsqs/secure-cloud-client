import { contextBridge, ipcRenderer } from 'electron'

// api
const api = {
  // --- 1. 基础功能 ---
  
  // 选文件 (必须：因为浏览器没权限知道文件全路径，必须靠主进程)
  selectFile: () => ipcRenderer.invoke('dialog:openFile'),

  // --- 2. 数据库操作 (本地缓存) ---

  // 查本地文件 (必须：loadFiles 最后一步要从数据库读出来显示)
  getFiles: () => ipcRenderer.invoke('get-files'),

  // 【新增】同步服务器数据 (必须：前端拿到服务器List后，要传给主进程存入SQLite)
  syncServerFiles: (serverFiles) => ipcRenderer.invoke('sync-server-files', serverFiles),

  // --- 3. 上传功能 ---

  // 【新增】上传到服务器 (必须：前端把路径给主进程，主进程读取文件流并POST)
  uploadServer: (params) => ipcRenderer.invoke('upload-to-server', params)
}

// 暴露给渲染进程
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
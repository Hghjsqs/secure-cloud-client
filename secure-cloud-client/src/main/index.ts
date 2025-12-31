import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// 1. 引入必要工具
import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import FormData from 'form-data' // 注意：需要运行 npm install form-data

// 2. 引入数据库封装函数 (确保 database.ts 已经导出这些函数)
import { addFile, getFiles, syncServerFiles } from './database'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false // 允许跨域
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// =========================================================
// 👇 核心业务 IPC 监听区
// =========================================================

// 1. 获取本地数据库中的文件列表 
ipcMain.handle('get-files', () => {
  try {
    const files = getFiles() 
    console.log('读取本地数据库文件成功，数量:', files.length)
    return files
  } catch (error) {
    console.error('获取文件失败:', error)
    return []
  }
})

// 2. 将文件记录添加到本地数据库 (status 默认为 0: 未上传)
ipcMain.handle('add-file', (_event, file) => {
  try {
    const info = addFile({
      name: file.name,
      path: file.path,
      size: file.size, // 传入字节数
      status: 0,       // 初始状态为本地
      tag: file.tag
    })
    return info.lastInsertRowid
  } catch (error) {
    console.error('写入数据库失败:', error)
    return null
  }
})

// 3. 同步服务器列表至本地缓存
ipcMain.handle('sync-server-files', (_event, serverFiles) => {
  try {
    syncServerFiles(serverFiles)
    console.log('同步服务器列表成功')
    return true
  } catch (error) {
    console.error('同步失败:', error)
    return false
  }
})

// 4. 处理真实文件上传 (使用 Node.js fs 流)
ipcMain.handle('upload-to-server', async (_event, { filePath, token, serverUrl }) => {
  try {
    const form = new FormData()
    // 使用文件流读取，避免大文件占用内存
    form.append('file', fs.createReadStream(filePath))
    
    const res = await axios.post(serverUrl, form, {
      headers: {
        'Authorization': 'Bearer ' + token,
        ...form.getHeaders()
      }
    })
    return { success: true, data: res.data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 5. 打开文件对话框并获取文件元数据
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择文件加入云盘'
  })

  if (canceled) return null

  const filePath = filePaths[0]
  const stat = fs.statSync(filePath)
  const fileName = path.basename(filePath)

  return {
    name: fileName,
    path: filePath,
    size: stat.size, // 返回原始字节数，对应 BIGINT
    tag: '本地'
  }
})

// =========================================================

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
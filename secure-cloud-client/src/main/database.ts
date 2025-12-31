import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

// 1. 确定数据库存储路径
// 存放在用户数据的 AppData 目录下，保证数据持久化
const dbPath = join(app.getPath('userData'), 'database.db')
const db: DatabaseType = new Database(dbPath)

// 2. 初始化表结构 (适配后端 cloud_file 表)
// 增加了 server_id 用于关联云端，status 用于标识传输状态
const initScript = `
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,      -- 本地自增ID
    server_id INTEGER,                         -- 服务器端的文件ID
    name TEXT NOT NULL,                        -- 文件名 (file_name)
    size INTEGER,                              -- 文件大小 (file_size, BIGINT)
    path TEXT,                                 -- 本地文件的绝对路径
    parent_id INTEGER DEFAULT 0,               -- 父目录ID (parent_id)
    status INTEGER DEFAULT 0,                  -- 状态: 0=本地, 1=已同步, 2=传输中
    tag TEXT,                                  -- 标签
    created_at TEXT                            -- 上传时间 (create_time)
  );
`
db.exec(initScript)

/**
 * 数据库初始化函数
 */
export const initDB = (): void => {
  console.log('SQLite 数据库已就绪:', dbPath)
}

// --- 核心功能接口 ---

/**
 * 添加/保存文件记录
 * 适配了 tag 字段，解决 TypeScript 2353 报错
 */
export const addFile = (file: { 
  name: string; 
  path?: string; 
  size: number; 
  server_id?: number;
  status?: number;
  created_at?: string;
  tag?: string;      // 允许传入标签
}) => {
  const stmt = db.prepare(`
    INSERT INTO files (name, path, size, server_id, status, created_at, tag) 
    VALUES (@name, @path, @size, @serverId, @status, @createdAt, @tag)
  `)

  return stmt.run({
    name: file.name,
    path: file.path || '',
    size: file.size,
    serverId: file.server_id || null,
    status: file.status || 0,
    createdAt: file.created_at || new Date().toLocaleString(),
    tag: file.tag || '本地'
  })
}

/**
 * 获取本地存储的所有文件列表
 */
export const getFiles = () => {
  const stmt = db.prepare('SELECT * FROM files ORDER BY id DESC')
  return stmt.all()
}

/**
 * 同步服务器列表到本地缓存
 * 逻辑：删除所有旧的“云端”记录(status=1)，存入服务器最新的数据
 */
export const syncServerFiles = (serverFiles: any[]) => {
  const syncTransaction = db.transaction((files) => {
    // 1. 只清除已经同步过的云端记录，保留用户还没上传的本地文件(status=0)
    db.prepare('DELETE FROM files WHERE status = 1').run()

    // 2. 插入服务器数据
    const insertStmt = db.prepare(`
      INSERT INTO files (server_id, name, size, parent_id, status, created_at, tag, path)
      VALUES (@serverId, @name, @size, @parentId, 1, @createdAt, '云端', '')
    `)

    for (const file of files) {
      insertStmt.run({
        serverId: file.id,          // 对应后端的 id
        name: file.file_name,       // 对应后端的 file_name
        size: file.file_size,       // 对应后端的 file_size
        parentId: file.parent_id,   // 对应后端的 parent_id
        createdAt: file.create_time // 对应后端的 create_time
      })
    }
  })

  syncTransaction(serverFiles)
}

/**
 * 导出数据库实例（如果其他地方需要原生操作）
 */
export default db
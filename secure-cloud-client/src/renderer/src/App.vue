<template>
  <Login v-if="!isLoggedIn" @login-success="onLoginSuccess" />

  <div v-else class="app-container">
    <el-container class="layout-container">
      <el-aside width="220px" class="aside-menu">
        <div class="logo-area">
          <h3>☁️ 安全云盘</h3>
        </div>
        <el-menu default-active="1" class="el-menu-vertical">
          <el-menu-item index="1">
            <el-icon><Document /></el-icon>
            <span>我的文件</span>
          </el-menu-item>
          <el-menu-item index="2">
            <el-icon><Sort /></el-icon>
            <span>传输列表</span>
          </el-menu-item>
          <el-menu-item index="3">
            <el-icon><Setting /></el-icon>
            <span>设置</span>
          </el-menu-item>
        </el-menu>
        
        <div class="upload-btn-wrapper">
          <el-button type="primary" size="large" style="width: 100%" @click="uploadFile" :loading="isUploading">
            <el-icon class="el-icon--left"><Upload /></el-icon>
            上传文件
          </el-button>
        </div>
      </el-aside>

      <el-main>
        <div class="header-tools">
          <el-input
            v-model="searchText"
            placeholder="🔍 搜索文件名..."
            prefix-icon="Search"
            style="width: 300px; margin-right: 10px;"
            clearable
          />
          <el-button @click="loadFiles" type="success" plain>
            <el-icon><Refresh /></el-icon> 刷新同步
          </el-button>
          <el-button type="danger" plain @click="handleLogout" style="margin-left: auto;">
            退出登录
          </el-button>
        </div>

        <el-table 
          :data="filteredFileList" 
          style="width: 100%; margin-top: 20px;" 
          height="calc(100vh - 120px)"
          empty-text="暂无文件，请点击左下角上传"
          stripe
        >
          <el-table-column prop="name" label="文件名" min-width="200">
            <template #default="scope">
              <div style="display: flex; align-items: center;">
                <el-icon style="margin-right: 8px;"><Document /></el-icon>
                {{ scope.row.name }}
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="tag" label="来源" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.tag === '本地' ? 'info' : 'success'" size="small">
                {{ scope.row.tag || '云端' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="size" label="大小" width="120">
            <template #default="scope">
              {{ formatSize(scope.row.size) }}
            </template>
          </el-table-column>

          <el-table-column prop="created_at" label="上传/创建时间" width="180" />
        </el-table>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Login from './components/Login.vue'
import axios from 'axios'

// --- 状态定义 ---
const isLoggedIn = ref(false)
const isUploading = ref(false)
const fileList = ref<any[]>([]) // 存储原始数据
const searchText = ref('')

// 计算属性：实现前端搜索过滤
const filteredFileList = computed(() => {
  if (!searchText.value) return fileList.value
  return fileList.value.filter(item => 
    item.name.toLowerCase().includes(searchText.value.toLowerCase())
  )
})

// --- 工具函数：格式化文件大小 ---
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// --- 登录成功回调 ---
const onLoginSuccess = (token: string) => {
  localStorage.setItem('auth_token', token)
  isLoggedIn.value = true
  loadFiles() // 登录后立即同步
}

// --- 退出登录 ---
const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    localStorage.removeItem('auth_token')
    isLoggedIn.value = false
    fileList.value = []
    ElMessage.success('已退出')
  })
}

// --- 核心：加载与同步文件 ---
const loadFiles = async () => {
  const token = localStorage.getItem('auth_token')
  if (!token) return

  try {
    // 1. 先尝试从服务器拉取最新列表 (同步)
    // 注意：Header 带上 Bearer
    const res = await axios.get('http://192.168.2.173:8080/cloudFile/list', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'App-Id': '1' // 防一手空指针
      }
    })

    if (res.data.code === '00000' || res.data.success) {
      const serverFiles = res.data.data || []
      // 2. 呼叫主进程：把服务器数据同步进 SQLite
      // @ts-ignore
      await window.api.syncServerFiles(serverFiles)
      console.log('云端数据已同步至本地数据库')
    }
  } catch (error) {
    console.warn('连接服务器失败，将显示本地缓存:', error)
    // 这里不 return，允许离线查看本地数据
  }

  // 3. 无论联网是否成功，最后都从本地数据库读取数据显示
  try {
    // @ts-ignore
    const localFiles = await window.api.getFiles()
    fileList.value = localFiles
    ElMessage.success('列表已更新')
  } catch (err) {
    console.error('读取本地数据库失败', err)
  }
}

// --- 核心：上传文件 ---
const uploadFile = async () => {
  const token = localStorage.getItem('auth_token')
  if (!token) return ElMessage.warning('请先登录')

  try {
    // 1. 打开文件选择框
    // @ts-ignore
    const fileInfo = await window.api.selectFile()
    if (!fileInfo) return // 用户取消了

    isUploading.value = true
    ElMessage.info(`正在上传: ${fileInfo.name}`)

    // 2. 呼叫主进程进行上传
    // @ts-ignore
    const result = await window.api.uploadServer({
      filePath: fileInfo.path,
      token: token,
      serverUrl: 'http://192.168.2.173:8080/cloudFile/add'
    })

    if (result.success) {
      ElMessage.success('上传成功！')
      // 3. 上传成功后，刷新列表
      await loadFiles()
    } else {
      console.error('上传报错:', result.error)
      ElMessage.error('上传失败，请检查服务器日志')
    }

  } catch (error) {
    console.error('上传流程异常:', error)
    ElMessage.error('操作异常')
  } finally {
    isUploading.value = false
  }
}

// --- 初始化 ---
onMounted(() => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    isLoggedIn.value = true
    loadFiles() // 自动加载
  }
})
</script>

<style>
body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif; }
.layout-container { height: 100vh; }

.aside-menu {
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.logo-area {
  padding: 24px;
  text-align: center;
  color: #409eff;
  border-bottom: 1px solid #e4e7ed;
  background: white;
}
.logo-area h3 { margin: 0; font-size: 18px; letter-spacing: 1px; }

.el-menu-vertical { border-right: none !important; background-color: transparent; }
.el-menu-item { font-size: 15px; }

.upload-btn-wrapper { 
  padding: 20px; 
  margin-top: auto; 
  border-top: 1px solid #e4e7ed;
  background: white;
}

.header-tools { 
  display: flex; 
  align-items: center; 
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f2f5;
}

.app-container { background-color: white; height: 100vh; }
</style>
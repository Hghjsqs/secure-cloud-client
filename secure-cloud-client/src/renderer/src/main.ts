import { createApp } from 'vue'
import App from './App.vue'
// 1. 引入 Element Plus 的 CSS 样式文件
import 'element-plus/dist/index.css'
// 2. 引入 Element Plus 主程序
import ElementPlus from 'element-plus'

const app = createApp(App)

// 3. 告诉 Vue 使用这个 UI 库
app.use(ElementPlus)

app.mount('#app')
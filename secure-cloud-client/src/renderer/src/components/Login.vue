<template>
  <div class="login-container">
    <div class="login-box">
      <h2>☁️ 安全云盘登录</h2>
      <el-input v-model="username" placeholder="请输入账号" prefix-icon="User" />
      <el-input v-model="password" type="password" placeholder="请输入密码" prefix-icon="Lock" style="margin-top: 15px;" />
      <el-button type="primary" style="width: 100%; margin-top: 20px;" @click="handleLogin" :loading="isLoading">
        登 录
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

// 定义事件，告诉父组件“我登录成功了”
const emit = defineEmits(['login-success'])

const username = ref('')
const password = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  if (!username.value || !password.value) return ElMessage.warning('请输入账号密码')
  
  isLoading.value = true
  try {
    // 登录接口 URL
    const res = await axios.post('http://192.168.2.173:8080/loginApi', {
      account: username.value, 
      password: password.value
    })


    if (res.data.code === "00000") {
      ElMessage.success('登录成功')
      // 触发成功事件，把 Token 传出去
      emit('login-success', res.data.data.token)
    } else {
      ElMessage.error(res.data.msg || '登录失败')
    }
  } catch (error) {
    ElMessage.error('连接服务器失败')
    console.error(error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #2d3a4b; /* 深色背景 */
}
.login-box {
  width: 350px;
  padding: 40px;
  background: white;
  border-radius: 10px;
  text-align: center;
}
</style>
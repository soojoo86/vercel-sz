<template>
  <div style="border:1px solid #ccc;padding:20px;border-radius:8px;max-width:480px">
    <h3>{{isRegister ? '注册账号' : '账号登录'}}</h3>
    <div>
      <label>用户名</label>
      <input v-model="form.username" style="width:100%;margin:8px 0;padding:6px"/>
    </div>
    <div>
      <label>密码</label>
      <input v-model="form.password" type="password" style="width:100%;margin:8px 0;padding:6px"/>
    </div>

    <!-- 错误信息展示区域，所有问题都会打印在这里 -->
    <div v-if="errMsg" style="margin:12px 0;padding:8px;background:#ffe9e9;color:#c00;border-radius:4px;white-space:pre-wrap;">
      {{errMsg}}
    </div>

    <button @click="submit" :disabled="loading" style="padding:8px 16px;margin-right:10px">
      {{ loading ? "请求中..." : (isRegister?'注册':'登录') }}
    </button>
    <button @click="isRegister=!isRegister" :disabled="loading">
      切换{{isRegister?'去登录':'去注册'}}
    </button>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue'
const emit = defineEmits(['login-success'])

const isRegister = ref(false)
const errMsg = ref('')
const loading = ref(false)
const form = ref({username:'',password:''})

async function submit(){
  errMsg.value = ''
  loading.value = true
  const url = isRegister.value ? '/api/register' : '/api/login'

  try {
    console.log('[debug] 发起请求', url, form.value)
    const res = await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(form.value)
    })

    console.log('[debug] http状态码:', res.status, 'ok:', res.ok)

    let json;
    try {
      json = await res.json()
      console.log('[debug]后端返回JSON:', json)
    } catch(parseErr){
      // 后端500返回非JSON文本，捕获解析失败
      const textRaw = await res.text()
      errMsg.value = `❌服务器返回非JSON\nHTTP状态:${res.status}\n原始响应:\n${textRaw.slice(0,500)}`
      return
    }

    // 处理HTTP错误码（500/400/405都会走到这里）
    if(!res.ok){
      if(json?.msg){
        errMsg.value = `❌HTTP ${res.status}｜${json.msg}`
      }else{
        errMsg.value = `❌HTTP ${res.status}｜服务器内部异常，查看Vercel日志`
      }
      return
    }

    // 业务逻辑ok=false
    if(!json.ok){
      errMsg.value = `⚠️业务提示：${json.msg}`
      return
    }

    // 注册成功
    if(isRegister.value){
      errMsg.value = "✅注册成功！请切换到登录页面登录。"
      form.value.password = ''
      return
    }

    // 登录成功
    emit('login-success', json.user)

  }catch(netErr){
    // 真正网络层面错误：断网、跨域、DNS失败
    console.error('[debug]网络异常捕获', netErr)
    errMsg.value = `🌐网络异常: ${netErr.message}`
  }finally{
    loading.value = false
  }
}
</script>

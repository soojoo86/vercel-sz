<template>
  <div style="border:1px solid #ccc;padding:20px;border‑radius:8px;max‑width:400px">
    <h3>{{isRegister ? '注册账号' : '账号登录'}}</h3>
    <div>
      <label>用户名</label>
      <input v‑model="form.username" style="width:100%;margin:8px 0;padding:6px"/>
    </div>
    <div>
      <label>密码</label>
      <input v‑model="form.password" type="password" style="width:100%;margin:8px 0;padding:6px"/>
    </div>
    <p style="color:red">{{msg}}</p>
    <button @click="submit" style="padding:8px 16px;margin‑right:10px">{{isRegister?'注册':'登录'}}</button>
    <button @click="isRegister=!isRegister">切换{{isRegister?'去登录':'去注册'}}</button>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue'
const emit = defineEmits(['login‑success'])
const isRegister = ref(false)
const msg = ref('')
const form = ref({username:'',password:''})

async function submit(){
  msg.value=''
  const url = isRegister.value ? '/api/register' : '/api/login'
  const res = await fetch(url,{
    method:'POST',
    headers:{'Content‑Type':'application/json'},
    body:JSON.stringify(form.value)
  })
  const json = await res.json()
  if(!json.ok){
    msg.value = json.msg
    return
  }
  if(!isRegister.value){
    emit('login‑success', json.user)
  }else{
    msg.value="注册成功，请切换登录"
  }
}
</script>
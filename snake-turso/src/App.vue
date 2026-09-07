<template>
  <div style="max-width:900px;margin:20px auto;padding:0 16px">
    <h1>🐍贪吃蛇游戏（Turso积分排行榜）</h1>
    <div v-if="!user">
      <LoginRegister @login-success="onLogin"/>
    </div>
    <div v-else>
      <p>欢迎 {{user.username}}｜你的最高分：{{user.high_score}}</p>
      <SnakeGame @game-over="onGameOver"/>
      <RankBoard />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import LoginRegister from './components/LoginRegister.vue'
import SnakeGame from './components/SnakeGame.vue'
import RankBoard from './components/RankBoard.vue'

const user = ref(null)

async function checkLogin(){
  const res = await fetch('/api/me')
  const json = await res.json()
  if(json.ok) user.value = json.user
}
checkLogin()

function onLogin(u){
  user.value = u
}

async function onGameOver(score){
  await fetch('/api/submit-score',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({score})
  })
  const r = await fetch('/api/me')
  const j = await r.json()
  if(j.ok) user.value = j.user
}
</script>

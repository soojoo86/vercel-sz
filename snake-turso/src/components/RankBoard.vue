<template>
  <div style="margin-top:20px;border:1px solid #aaa;padding:16px;border-radius:8px">
    <h3>🏆积分排行榜Top10</h3>
    <ul v-if="list.length>0">
      <li v-for="(item,i) in list" :key="i">
        {{i+1}}. {{item.username}} —— 最高分：{{item.high_score}}
      </li>
    </ul>
    <div v-else>暂无排行榜数据</div>
    <button @click="fetchRank">刷新排行榜</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const list = ref([])

async function fetchRank(){
  const res = await fetch('/api/rank')
  const json = await res.json()
  if(json.ok) list.value = json.list
}
onMounted(()=>fetchRank())
</script>

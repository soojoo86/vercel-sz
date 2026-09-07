<template>
  <div>
    <canvas ref="canvasRef" width="400" height="400" style="border:2px solid #333;background:#fafafa"></canvas>
    <p>当前得分：{{score}}</p>
    <p>方向：↑ ↓ ← → 键盘控制，空格重新开始</p>
  </div>
</template>

<script setup>
import { ref, onMounted, defineEmits } from 'vue'
const emit = defineEmits(['game‑over'])
const canvasRef = ref(null)
const score = ref(0)

const CELL = 20
let snake = []
let food = {x:0,y:0}
let dir = {dx:1, dy:0}
let nextDir = {...dir}
let gameLoop = null
let gameOverFlag = false

function resetGame(){
  score.value = 0
  gameOverFlag = false
  snake = [{x:5,y:5},{x:4,y:5},{x:3,y:5}]
  dir = {dx:1,dy:0}
  nextDir = {...dir}
  spawnFood()
}

function spawnFood(){
  food.x = Math.floor(Math.random()*(400/CELL))
  food.y = Math.floor(Math.random()*(400/CELL))
}

function draw(){
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.fillStyle="#27ae60"
  snake.forEach(p=>ctx.fillRect(p.x*CELL,p.y*CELL,CELL‑1,CELL‑1))
  ctx.fillStyle="#e74c3c"
  ctx.fillRect(food.x*CELL,food.y*CELL,CELL‑1,CELL‑1)
}

function tick(){
  if(gameOverFlag) return
  dir = {...nextDir}
  const head = {x: snake[0].x + dir.dx, y: snake[0].y + dir.dy}
  if(head.x<0||head.y<0||head.x>=20||head.y>=20){
    endGame()
    return
  }
  for(let s of snake){
    if(s.x===head.x && s.y===head.y){
      endGame()
      return
    }
  }
  snake.unshift(head)
  if(head.x===food.x && head.y===food.y){
    score.value +=10
    spawnFood()
  }else{
    snake.pop()
  }
  draw()
}

function endGame(){
  gameOverFlag=true
  clearInterval(gameLoop)
  emit('game‑over', score.value)
}

function keyDown(e){
  if(e.key===' '){
    resetGame()
    clearInterval(gameLoop)
    gameLoop = setInterval(tick,130)
    return
  }
  switch(e.key){
    case 'ArrowUp': if(dir.dy!==1) nextDir={dx:0,dy:‑1};break;
    case 'ArrowDown': if(dir.dy!==‑1) nextDir={dx:0,dy:1};break;
    case 'ArrowLeft': if(dir.dx!==1) nextDir={dx:‑1,dy:0};break;
    case 'ArrowRight': if(dir.dx!==‑1) nextDir={dx:1,dy:0};break;
  }
}

onMounted(()=>{
  resetGame()
  draw()
  gameLoop = setInterval(tick,130)
  window.addEventListener('keydown',keyDown)
})
</script>
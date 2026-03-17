import { setTypoMode } from './typo.js'
import { refreshPokedex } from './pokedex.js'
import { startModeBlend } from './modes.js'

// ── UI 요소 참조 ──
function getUI() {
  return {
    body: document.body,
    title: document.querySelector('.mode-title'),
    btnAlter: document.getElementById('btn-alter'),
    dexNumber: document.querySelector('.dex-number'),
    dexName: document.querySelector('.dex-name'),
    fxCanvas: document.getElementById('fx-canvas'),
  }
}

// ── 화이트 플래시 ──
function flashWhite(duration = 200) {
  const overlay = document.createElement('div')
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '999',
    background: '#fff',
    opacity: '1',
    pointerEvents: 'none',
    transition: `opacity ${duration}ms ease-out`,
  })
  document.body.appendChild(overlay)
  requestAnimationFrame(() => { overlay.style.opacity = '0' })
  setTimeout(() => overlay.remove(), duration)
}

// ── 스캔라인 글리치 ──
function glitchScanlines(canvas, iterations = 5) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  let count = 0

  function drawGlitch() {
    if (count >= iterations) return
    // 랜덤 수평선
    const lineCount = 3 + Math.floor(Math.random() * 5)
    for (let i = 0; i < lineCount; i++) {
      const y = Math.random() * h
      const lineH = 1 + Math.random() * 3
      ctx.fillStyle = `rgba(0, 255, 247, ${0.3 + Math.random() * 0.5})`
      ctx.fillRect(0, y, w, lineH)
      // 오프셋 블록 글리치
      if (Math.random() > 0.5) {
        const blockW = 50 + Math.random() * 200
        const blockX = Math.random() * w
        ctx.fillStyle = `rgba(123, 47, 255, ${0.15 + Math.random() * 0.2})`
        ctx.fillRect(blockX, y - 2, blockW, lineH + 4)
      }
    }
    count++
    setTimeout(drawGlitch, 30 + Math.random() * 40)
  }
  drawGlitch()
}

// ── 타이핑 효과 ──
function typeText(element, text, speed = 40) {
  return new Promise(resolve => {
    element.textContent = ''
    let i = 0
    const timer = setInterval(() => {
      element.textContent += text[i]
      i++
      if (i >= text.length) {
        clearInterval(timer)
        resolve()
      }
    }, speed)
  })
}

// ── 중앙에서 빛 번지기 (MEW 복귀용) ──
function radialGlow(duration = 400) {
  const overlay = document.createElement('div')
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '999',
    pointerEvents: 'none',
    background: 'radial-gradient(circle at center, rgba(255,179,222,0.6) 0%, rgba(212,170,255,0.3) 40%, transparent 70%)',
    opacity: '0',
    transition: `opacity ${duration / 2}ms ease-in`,
  })
  document.body.appendChild(overlay)

  requestAnimationFrame(() => { overlay.style.opacity = '1' })
  setTimeout(() => {
    overlay.style.transition = `opacity ${duration / 2}ms ease-out`
    overlay.style.opacity = '0'
  }, duration / 2)
  setTimeout(() => overlay.remove(), duration)
}

// ── MEW → MEWTWO 전환 (800ms) ──
let isTransitioning = false

function transitionToMewtwo(onComplete) {
  if (isTransitioning) return
  isTransitioning = true
  const ui = getUI()

  // [0ms] 화이트 플래시 + 세포 블렌드 시작
  flashWhite(200)
  startModeBlend('mewtwo')

  // [100ms] 스캔라인 글리치
  setTimeout(() => {
    glitchScanlines(ui.fxCanvas, 5)
  }, 100)

  // [200ms] CSS 모드 전환 + 타이포 전환
  setTimeout(() => {
    ui.body.classList.add('mewtwo-mode')
    setTypoMode('mewtwo')
  }, 200)

  // [600ms] UI 텍스트 전환
  setTimeout(() => {
    if (ui.title) typeText(ui.title, '>_ MEWTWO.exe', 35)
    if (ui.dexNumber) ui.dexNumber.textContent = '#150'
    if (ui.dexName) ui.dexName.textContent = 'Mewtwo'
  }, 600)

  // [800ms] 완료
  setTimeout(() => {
    isTransitioning = false
    if (onComplete) onComplete()
    refreshPokedex()
  }, 800)
}

// ── MEWTWO → MEW 전환 (1000ms) ──
function transitionToMew(onComplete) {
  if (isTransitioning) return
  isTransitioning = true
  const ui = getUI()

  // [0ms] 중앙 radial glow + 세포 블렌드 시작
  radialGlow(500)
  startModeBlend('mew')

  // [200ms] HUD 페이드 (CSS 변수가 처리)
  // hex/scanline은 CSS variable transition으로 자동 처리

  // [400ms] CSS 모드 전환 + 타이포 전환
  setTimeout(() => {
    ui.body.classList.remove('mewtwo-mode')
    setTypoMode('mew')
  }, 400)

  // [700ms] UI 텍스트 복원
  setTimeout(() => {
    if (ui.title) typeText(ui.title, 'MEW', 60)
    if (ui.dexNumber) ui.dexNumber.textContent = '#151'
    if (ui.dexName) ui.dexName.textContent = 'Mew'
  }, 700)

  // [1000ms] 완료
  setTimeout(() => {
    isTransitioning = false
    if (onComplete) onComplete()
    refreshPokedex()
  }, 1000)
}

function getIsTransitioning() {
  return isTransitioning
}

export { transitionToMewtwo, transitionToMew, getIsTransitioning }

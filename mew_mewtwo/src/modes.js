import { transitionToMewtwo, transitionToMew, getIsTransitioning } from './transition.js'
import { setRendererMode } from './renderer.js'
import { setGravity } from './physics.js'

// ── 상태 ──
let currentMode = 'mew'       // 'mew' | 'mewtwo'
let isDrifting = false
let easterEggTriggered = false
let easterEggOverlay = null

// ── 모드 변경 콜백 ──
const modeChangeListeners = []

// ── 부드러운 모드 블렌드 (0 = mew, 1 = mewtwo) ──
let modeBlend = 0
let modeBlendTarget = 0
const MODE_BLEND_SPEED = 0.035  // 약 0.8~1초에 걸쳐 전환

// ── 모드 전환 ──
function setMode(mode) {
  if (getIsTransitioning()) return
  if (mode === currentMode) return

  if (mode === 'mewtwo') {
    transitionToMewtwo(() => {
      currentMode = 'mewtwo'
      setRendererMode('mewtwo')
      modeChangeListeners.forEach(fn => fn('mewtwo'))
    })
  } else {
    transitionToMew(() => {
      currentMode = 'mew'
      setRendererMode('mew')
      easterEggTriggered = false
      modeChangeListeners.forEach(fn => fn('mew'))
    })
  }
}

function toggleMode() {
  setMode(currentMode === 'mew' ? 'mewtwo' : 'mew')
}

// ── 드리프트 토글 ──
function toggleDrift() {
  isDrifting = !isDrifting
  setGravity(isDrifting ? 'drift' : 'normal')
  return isDrifting
}

// ── 이스터에그 감지 ──
function getMewtwoEasterEgg(bodies, canvasWidth, canvasHeight) {
  if (currentMode !== 'mewtwo') return false
  if (easterEggTriggered) return false
  if (bodies.length === 0) return false

  const cx = canvasWidth / 2
  const cy = canvasHeight / 2
  const radius = 150

  for (const body of bodies) {
    const dx = body.position.x - cx
    const dy = body.position.y - cy
    if (Math.sqrt(dx * dx + dy * dy) > radius) return false
  }

  return true
}

// ── 이스터에그 실행 ──
function triggerEasterEgg() {
  if (easterEggTriggered) return
  easterEggTriggered = true

  // 오버레이 생성
  easterEggOverlay = document.createElement('div')
  Object.assign(easterEggOverlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '500',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  })

  const panel = document.createElement('div')
  Object.assign(panel.style, {
    background: 'rgba(0, 6, 15, 0.85)',
    border: '1px solid rgba(0, 255, 247, 0.3)',
    padding: '32px 48px',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '1.1rem',
    color: '#00fff7',
    lineHeight: '2',
    textAlign: 'left',
    minWidth: '380px',
  })
  easterEggOverlay.appendChild(panel)
  document.body.appendChild(easterEggOverlay)

  // 타이핑 시퀀스
  const lines = [
    'MEW_ORIGIN.dat DETECTED...',
    'SEQUENCE CORRUPTED...',
    'RESTORING ORIGINAL...',
  ]

  typeLines(panel, lines, () => {
    // 2초 후 MEW 모드로 강제 전환
    setTimeout(() => {
      // 오버레이 페이드아웃
      easterEggOverlay.style.transition = 'opacity 0.6s ease'
      easterEggOverlay.style.opacity = '0'
      setTimeout(() => {
        easterEggOverlay.remove()
        easterEggOverlay = null
      }, 600)

      setMode('mew')
    }, 2000)
  })
}

// ── 한 줄씩 타이핑 ──
function typeLines(container, lines, onDone) {
  container.textContent = ''
  let lineIdx = 0

  function nextLine() {
    if (lineIdx >= lines.length) {
      if (onDone) onDone()
      return
    }

    const lineEl = document.createElement('div')
    container.appendChild(lineEl)

    const text = lines[lineIdx]
    let charIdx = 0

    const timer = setInterval(() => {
      lineEl.textContent += text[charIdx]
      charIdx++
      if (charIdx >= text.length) {
        clearInterval(timer)
        lineIdx++
        setTimeout(nextLine, 400)
      }
    }, 45)
  }

  nextLine()
}

// ── 블렌드 시작 ──
function startModeBlend(mode) {
  modeBlendTarget = mode === 'mewtwo' ? 1 : 0
}

// ── 블렌드 업데이트 (매 프레임 호출) ──
function updateModeBlend() {
  const diff = modeBlendTarget - modeBlend
  if (Math.abs(diff) < 0.001) {
    modeBlend = modeBlendTarget
  } else {
    modeBlend += diff * MODE_BLEND_SPEED * 2  // ease-out 느낌
    // 추가 선형 보간으로 끝까지 도달 보장
    modeBlend += Math.sign(diff) * MODE_BLEND_SPEED * 0.3
    modeBlend = modeBlendTarget === 1
      ? Math.min(modeBlend, 1)
      : Math.max(modeBlend, 0)
  }
}

function getModeBlend() {
  return modeBlend
}

// ── Getters ──
function getMode() {
  return currentMode
}

function getIsDrifting() {
  return isDrifting
}

function onModeChange(fn) {
  modeChangeListeners.push(fn)
}

export {
  getMode,
  setMode,
  toggleMode,
  getMewtwoEasterEgg,
  triggerEasterEgg,
  getModeBlend,
  updateModeBlend,
  startModeBlend,
  onModeChange,
}

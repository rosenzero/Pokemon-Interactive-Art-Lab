import { drawTypo } from './typo.js'
import { getModeBlend } from './modes.js'

// ── 상태 ──
let ctx = null
let canvas = null
let currentMode = 'mew'
let trails = []
let shockwaves = []
let hexParticles = []
let bodies = []
let getMousePosRef = null

// Hex rain 컬럼 상태
let hexColumns = []
let hexInited = false

// Fluid 마우스 리플
let mouseRipples = []
let lastRippleX = 0
let lastRippleY = 0

// ── 초기화 ──
function initRenderer(canvasEl, getOrbs, getMousePos) {
  canvas = canvasEl
  ctx = canvas.getContext('2d')
  getMousePosRef = getMousePos || null
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  function loop() {
    renderLoop(getOrbs)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  hexInited = false
}

// ── 모드 전환 ──
function setRendererMode(mode) {
  currentMode = mode
  hexInited = false
}

// ── 메인 렌더 루프 ──
function renderLoop(getOrbs) {
  const w = canvas.width
  const h = canvas.height
  bodies = typeof getOrbs === 'function' ? getOrbs() : []

  // 1. 캔버스 클리어 — blend로 부드럽게
  const blend = getModeBlend()
  if (blend < 0.01) {
    ctx.clearRect(0, 0, w, h)
  } else if (blend > 0.99) {
    ctx.fillStyle = 'rgba(0, 6, 15, 0.2)'
    ctx.fillRect(0, 0, w, h)
  } else {
    // 크로스: 잔상 강도를 blend에 따라 조절
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = `rgba(0, 6, 15, ${0.2 * blend})`
    ctx.fillRect(0, 0, w, h)
  }

  // 2~8. 레이어 순서대로 렌더
  drawHexBackground()
  drawTypo(ctx, w, h, getMousePosRef ? getMousePosRef() : null)
  drawFluidCursorInfluence()
  drawOrbGlow(bodies)
  drawTrails()
  drawMouseRipples()
  drawShockwaves()
  // drawOrbLabels(bodies)
}

// ── 오브 Glow (with fluid collision pulse) ──
function drawOrbGlow(orbBodies) {
  for (const body of orbBodies) {
    const dna = body.plugin?.dna
    if (!dna) continue

    const x = body.position.x
    const y = body.position.y
    const b = getModeBlend()
    const color = b < 0.5 ? dna.mewColor : dna.mewtwoColor
    const r = dna.radius

    // Fluid collision glow pulse (reference: fluid-synthesizer brightness flash)
    const pulse = body._glowPulse || 0
    const pulseBoost = pulse * 0.4

    if (b > 0.01) {
      // Sharp glow — blend로 페이드인
      const glowR = r * (1.4 + pulse * 0.6)
      const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, glowR)
      grad.addColorStop(0, hexToRgba(color, (0.6 + pulseBoost) * b))
      grad.addColorStop(0.6, hexToRgba(color, (0.2 + pulseBoost * 0.4) * b))
      grad.addColorStop(1, hexToRgba(color, 0))
      ctx.beginPath()
      ctx.arc(x, y, glowR, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // Decay glow pulse
    if (body._glowPulse > 0) {
      body._glowPulse = Math.max(0, body._glowPulse - 0.015)
    }
  }
}

// ── 트레일 파티클 ──
function addTrail(x, y, vx, vy) {
  const count = currentMode === 'mew' ? 3 : 2
  for (let i = 0; i < count; i++) {
    trails.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: vx * 0.3 + (Math.random() - 0.5) * 0.5,
      vy: vy * 0.3 + (Math.random() - 0.5) * 0.5,
      life: 1,
      decay: currentMode === 'mew' ? 0.02 + Math.random() * 0.02 : 0.03 + Math.random() * 0.01,
      radius: currentMode === 'mew'
        ? 6 + Math.random() * 10     // 큰 원
        : 2 + Math.random() * 5,     // 작은 원
      mode: currentMode,
    })
  }
}

function drawTrails() {
  for (let i = trails.length - 1; i >= 0; i--) {
    const t = trails[i]
    t.x += t.vx
    t.y += t.vy
    t.life -= t.decay
    t.vx *= 0.97
    t.vy *= 0.97

    if (t.life <= 0) {
      trails.splice(i, 1)
      continue
    }

    ctx.beginPath()
    ctx.arc(t.x, t.y, t.radius * t.life, 0, Math.PI * 2)

    if (t.mode === 'mew') {
      // 수채화 번짐 — 흰-핑크
      const alpha = t.life * 0.25
      ctx.fillStyle = `rgba(255, 200, 230, ${alpha})`
    } else {
      // 전기 잔상 — 사이언-퍼플
      const alpha = t.life * 0.6
      const hue = Math.random() > 0.5 ? '0, 255, 247' : '123, 47, 255'
      ctx.fillStyle = `rgba(${hue}, ${alpha})`
    }
    ctx.fill()
  }
}

// ── 충격파 ──
function triggerShockwave(x, y, mode) {
  if (mode === 'mew') {
    // 여러 겹, 천천히 확산
    for (let i = 0; i < 3; i++) {
      shockwaves.push({
        x, y,
        radius: 10 + i * 20,
        maxRadius: 350 + i * 80,
        speed: 3 + i * 0.5,
        life: 1,
        decay: 0.012,
        lineWidth: 2.5 - i * 0.5,
        mode: 'mew',
      })
    }
  } else {
    // 단일 링, 빠르고 강하게
    shockwaves.push({
      x, y,
      radius: 5,
      maxRadius: 600,
      speed: 10,
      life: 1,
      decay: 0.02,
      lineWidth: 3,
      mode: 'mewtwo',
    })
  }
}

function drawShockwaves() {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]
    sw.radius += sw.speed
    sw.life -= sw.decay

    if (sw.life <= 0 || sw.radius > sw.maxRadius) {
      shockwaves.splice(i, 1)
      continue
    }

    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    ctx.lineWidth = sw.lineWidth * sw.life

    if (sw.mode === 'mew') {
      ctx.strokeStyle = `rgba(255, 179, 222, ${sw.life * 0.6})`
    } else {
      ctx.strokeStyle = `rgba(0, 255, 247, ${sw.life * 0.8})`
      // MEWTWO 내부 글로우
      ctx.shadowColor = 'rgba(0, 255, 247, 0.4)'
      ctx.shadowBlur = 15
    }
    ctx.stroke()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }
}

// ── Fluid 커서 영향 범위 ──
function drawFluidCursorInfluence() {
  if (!getMousePosRef) return
  const mp = getMousePosRef()
  if (!mp || mp.x === null) return

  const mx = mp.smoothX
  const my = mp.smoothY

  const cBlend = getModeBlend()

  if (cBlend < 0.5) {
    // MEW: 넓은 유기적 영향권 + 가까운 오브로 DNA 글로우 라인
    const influenceR = 160

    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, influenceR)
    grad.addColorStop(0, 'rgba(255, 179, 222, 0.10)')
    grad.addColorStop(0.3, 'rgba(248, 180, 248, 0.06)')
    grad.addColorStop(0.6, 'rgba(212, 170, 255, 0.03)')
    grad.addColorStop(1, 'rgba(255, 179, 222, 0)')
    ctx.beginPath()
    ctx.arc(mx, my, influenceR, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // 가까운 오브들에게 DNA 흡수 글로우 연결선
    for (const body of bodies) {
      const dna = body.plugin?.dna
      if (!dna) continue
      const dx = body.position.x - mx
      const dy = body.position.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < influenceR && dist > 10) {
        const t = 1 - dist / influenceR
        ctx.beginPath()
        ctx.moveTo(mx, my)
        // 부드러운 곡선 연결
        const cpx = (mx + body.position.x) / 2 + (Math.random() - 0.5) * 20
        const cpy = (my + body.position.y) / 2 + (Math.random() - 0.5) * 20
        ctx.quadraticCurveTo(cpx, cpy, body.position.x, body.position.y)
        ctx.strokeStyle = hexToRgba(dna.mewColor, t * 0.12)
        ctx.lineWidth = 1.5 + t * 2
        ctx.stroke()
      }
    }
  } else {
    // MEWTWO: 사이킥 스캔 필드
    const scanR = 280
    const now = performance.now() * 0.001

    // 외곽 스캔 링 (회전 대시)
    ctx.strokeStyle = 'rgba(0, 255, 247, 0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([8, 16])
    ctx.lineDashOffset = -now * 40
    ctx.beginPath()
    ctx.arc(mx, my, scanR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // 내부 그라데이션 필드
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, scanR)
    grad.addColorStop(0, 'rgba(0, 255, 247, 0.04)')
    grad.addColorStop(0.4, 'rgba(123, 47, 255, 0.02)')
    grad.addColorStop(1, 'rgba(0, 255, 247, 0)')
    ctx.beginPath()
    ctx.arc(mx, my, scanR, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // 범위 내 오브에 에너지 연결선 — 전기 펄스 스타일
    for (const body of bodies) {
      const dna = body.plugin?.dna
      if (!dna) continue
      const bx = body.position.x
      const by = body.position.y
      const dx = bx - mx
      const dy = by - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < scanR && dist > 10) {
        const t = 1 - dist / scanR

        // 메인 에너지 라인 — 부드러운 곡선
        const midX = (mx + bx) / 2
        const midY = (my + by) / 2
        const perpX = -(by - my) / dist
        const perpY = (bx - mx) / dist
        const waveAmt = Math.sin(now * 2 + dna.dnaIndex) * 25 * t

        ctx.beginPath()
        ctx.moveTo(mx, my)
        ctx.quadraticCurveTo(midX + perpX * waveAmt, midY + perpY * waveAmt, bx, by)

        // 그라데이션 스트로크
        const lineGrad = ctx.createLinearGradient(mx, my, bx, by)
        lineGrad.addColorStop(0, `rgba(0, 255, 247, ${t * 0.12})`)
        lineGrad.addColorStop(0.5, `rgba(123, 47, 255, ${t * 0.08})`)
        lineGrad.addColorStop(1, `rgba(0, 255, 247, ${t * 0.04})`)
        ctx.strokeStyle = lineGrad
        ctx.lineWidth = 1 + t * 0.5
        ctx.stroke()

        // 에너지 파티클 — 선 위를 이동하는 밝은 점
        const particleT = (now * (0.8 + dna.dnaIndex * 0.05)) % 1
        const pt = particleT
        const px = mx * (1 - pt) * (1 - pt) + 2 * (midX + perpX * waveAmt) * (1 - pt) * pt + bx * pt * pt
        const py = my * (1 - pt) * (1 - pt) + 2 * (midY + perpY * waveAmt) * (1 - pt) * pt + by * pt * pt
        const pAlpha = t * 0.5 * (1 - Math.abs(pt - 0.5) * 2)
        if (pAlpha > 0.02) {
          ctx.beginPath()
          ctx.arc(px, py, 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(0, 255, 247, ${pAlpha})`
          ctx.fill()
        }
      }
    }
  }

  // 마우스 이동 시 리플 생성
  const dx = mx - lastRippleX
  const dy = my - lastRippleY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > 25) {
    mouseRipples.push({
      x: mx, y: my,
      radius: 8,
      maxRadius: currentMode === 'mew' ? 80 + Math.min(dist, 100) : 50,
      speed: currentMode === 'mew' ? 1.2 + Math.random() * 0.5 : 2.5,
      life: 1,
      decay: currentMode === 'mew' ? 0.02 : 0.035,
    })
    lastRippleX = mx
    lastRippleY = my
  }
}

// ── Fluid 마우스 리플 ──
function drawMouseRipples() {
  for (let i = mouseRipples.length - 1; i >= 0; i--) {
    const r = mouseRipples[i]
    r.radius += r.speed
    r.life -= r.decay

    if (r.life <= 0 || r.radius > r.maxRadius) {
      mouseRipples.splice(i, 1)
      continue
    }

    ctx.beginPath()
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
    ctx.lineWidth = 1.2 * r.life

    const rBlend = getModeBlend()
    if (rBlend < 0.5) {
      ctx.strokeStyle = `rgba(255, 179, 222, ${r.life * 0.25})`
    } else {
      ctx.strokeStyle = `rgba(0, 255, 247, ${r.life * 0.3})`
    }
    ctx.stroke()
  }
}

// ── Hex Background (MEWTWO 모드) ──
function initHexColumns() {
  const fontSize = 14
  const cols = Math.floor(canvas.width / fontSize)
  hexColumns = []
  for (let i = 0; i < cols; i++) {
    hexColumns.push({
      x: i * fontSize,
      y: Math.random() * canvas.height * -1,
      speed: 0.3 + Math.random() * 0.8,
      chars: [],
      nextChar: 0,
    })
    // 미리 랜덤 hex 문자열 생성
    const len = 8 + Math.floor(Math.random() * 16)
    for (let j = 0; j < len; j++) {
      hexColumns[i].chars.push(randomHex())
    }
  }
  hexInited = true
}

function drawHexBackground() {
  if (getModeBlend() < 0.1) return
  if (!hexInited) initHexColumns()

  const fontSize = 14
  ctx.font = `${fontSize}px 'Share Tech Mono', monospace`

  for (const col of hexColumns) {
    col.y += col.speed

    for (let j = 0; j < col.chars.length; j++) {
      const charY = col.y + j * fontSize
      if (charY < 0 || charY > canvas.height) continue

      // 선두 문자는 밝게, 나머지는 희미하게
      const distFromHead = j / col.chars.length
      const hexBlend = getModeBlend()
      const baseAlpha = j === col.chars.length - 1
        ? 0.15
        : 0.04 + (1 - distFromHead) * 0.06
      const alpha = baseAlpha * Math.min(1, (hexBlend - 0.1) / 0.3)

      ctx.fillStyle = `rgba(0, 255, 247, ${alpha})`
      ctx.fillText(col.chars[j], col.x, charY)
    }

    // 화면 밖으로 나가면 재순환
    if (col.y > canvas.height + col.chars.length * fontSize) {
      col.y = -col.chars.length * fontSize
      col.speed = 0.3 + Math.random() * 0.8
      // 문자 다시 랜덤화
      for (let j = 0; j < col.chars.length; j++) {
        col.chars[j] = randomHex()
      }
    }
  }
}

// ── MEWTWO 모드: 오브 라벨 ──
function drawOrbLabels(orbBodies) {
  if (currentMode !== 'mewtwo') return

  ctx.font = '9px "Share Tech Mono", monospace'
  ctx.textAlign = 'center'

  for (const body of orbBodies) {
    const dna = body.plugin?.dna
    if (!dna) continue

    const x = body.position.x
    const y = body.position.y + dna.radius + 12
    const label = `DATA_0x${dna.dnaIndex.toString(16).toUpperCase().padStart(2, '0')}`

    ctx.fillStyle = 'rgba(0, 255, 247, 0.4)'
    ctx.fillText(label, x, y)
  }

  ctx.textAlign = 'start'
}

// ── 유틸 ──
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function randomHex() {
  const chars = '0123456789ABCDEF'
  return chars[Math.floor(Math.random() * 16)]
}

export { initRenderer, addTrail, triggerShockwave, setRendererMode }

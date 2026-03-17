import Matter from 'matter-js'
import { CONFIG, getScreenScale, initPhysics, createOrbs, keepDrifting, updateSquish } from './physics.js'
import { initRenderer } from './renderer.js'
import { initTypo } from './typo.js'
import { initAudio, updateCursorNote } from './sound.js'

import { getMode, getModeBlend, updateModeBlend, onModeChange } from './modes.js'
import { setupInteractions, getLockedOrb } from './interactions.js'
import { initLang, getLangIdx, onLangChange } from './lang.js'
import { initPokedex, refreshPokedex } from './pokedex.js'

const { Runner, Events, Composite } = Matter

// ── 마우스 위치 (전역) ──
const mousePos = { x: null, y: null, smoothX: 0, smoothY: 0, _prevX: 0, _prevY: 0 }

function getMousePos() { return mousePos }

// ── 색상 유틸 ──
function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `rgb(${r},${g},${b})`
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `rgb(${r},${g},${b})`
}

function blendColors(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16)
  const g1 = parseInt(hex1.slice(3, 5), 16)
  const b1 = parseInt(hex1.slice(5, 7), 16)
  const r2 = parseInt(hex2.slice(1, 3), 16)
  const g2 = parseInt(hex2.slice(3, 5), 16)
  const b2 = parseInt(hex2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

window.addEventListener('load', () => {
  // ── 캔버스 참조 ──
  const physicsCanvas = document.getElementById('physics-canvas')
  const fxCanvas = document.getElementById('fx-canvas')

  // ── 캔버스 크기 설정 ──
  function resizeCanvases() {
    const w = window.innerWidth
    const h = window.innerHeight
    physicsCanvas.width = w
    physicsCanvas.height = h
  }
  resizeCanvases()

  // ── 마우스 + 터치 추적 ──
  window.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX
    mousePos.y = e.clientY
  })
  window.addEventListener('mouseleave', () => {
    mousePos.x = null
    mousePos.y = null
  })
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0]
    mousePos.x = t.clientX
    mousePos.y = t.clientY
  }, { passive: true })
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0]
    mousePos.x = t.clientX
    mousePos.y = t.clientY
  }, { passive: true })
  window.addEventListener('touchend', () => {
    mousePos.x = null
    mousePos.y = null
  })

  // ── Matter.js 초기화 ──
  const engine = initPhysics()
  let orbs = createOrbs(engine.world, null, 'mew')

  function getOrbs() { return orbs }

  Events.on(engine, 'afterUpdate', () => {
    const worldBodies = Composite.allBodies(engine.world)
      .filter(b => !b.isStatic && b.plugin?.dna)
    if (worldBodies.length > 0 && worldBodies[0] !== orbs[0]) {
      orbs = worldBodies
    }
  })

  // ── 언어 초기화 (타이포보다 먼저) ──
  initLang()

  // ── 타이포 아트 초기화 ──
  initTypo()

  // ── 도감 초기화 ──
  initPokedex()

  const TITLES = {
    mew:    ['뮤 #151', 'Mew #151', 'ミュウ #151'],
    mewtwo: ['뮤츠 #150', 'Mewtwo #150', 'ミュウツー #150'],
  }
  const FAVICONS = {
    mew:    `${import.meta.env.BASE_URL}mew_pixel.png`,
    mewtwo: `${import.meta.env.BASE_URL}mewtwo_pixel.png`,
  }
  function updateTitleAndFavicon() {
    const mode = getMode()
    document.title = TITLES[mode][getLangIdx()] || TITLES[mode][1]
    const icon = document.querySelector('link[rel="icon"]')
    const apple = document.querySelector('link[rel="apple-touch-icon"]')
    if (icon) icon.href = FAVICONS[mode]
    if (apple) apple.href = FAVICONS[mode]
  }
  updateTitleAndFavicon()
  onLangChange(updateTitleAndFavicon)
  onModeChange(updateTitleAndFavicon)

  // ── FX 렌더러 초기화 ──
  initRenderer(fxCanvas, getOrbs, getMousePos)

  // ── AudioContext 초기화 ──
  const startAudio = () => { initAudio() }
  document.addEventListener('click', startAudio, { once: true })
  document.addEventListener('touchstart', startAudio, { once: true })

  // ── 인터랙션 설정 ──
  setupInteractions(engine, physicsCanvas, getOrbs)

  // ── Matter.js Runner ──
  const runner = Runner.create()
  Runner.run(runner, engine)

  // ── Physics 캔버스: Fluid 렌더링 ──
  const pCtx = physicsCanvas.getContext('2d')
  mousePos.smoothX = window.innerWidth / 2
  mousePos.smoothY = window.innerHeight / 2

  // 커서 블롭 안정화용 상태
  let cursorSmoothAngle = 0
  const _ss = getScreenScale()
  let cursorSmoothR = 55 * _ss

  // ── hex→rgb 파싱 캐시 ──
  const _rgbCache = {}
  function hexToRgb(hex) {
    if (_rgbCache[hex]) return _rgbCache[hex]
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    _rgbCache[hex] = [r, g, b]
    return _rgbCache[hex]
  }

  function lerpColor(hex1, hex2, t) {
    const [r1, g1, b1] = hexToRgb(hex1)
    const [r2, g2, b2] = hexToRgb(hex2)
    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)
    return `rgb(${r},${g},${b})`
  }

  function lerpColorLighten(hex1, hex2, t, amt) {
    const [r1, g1, b1] = hexToRgb(hex1)
    const [r2, g2, b2] = hexToRgb(hex2)
    const r = Math.min(255, Math.round(r1 + (r2 - r1) * t) + amt)
    const g = Math.min(255, Math.round(g1 + (g2 - g1) * t) + amt)
    const b = Math.min(255, Math.round(b1 + (b2 - b1) * t) + amt)
    return `rgb(${r},${g},${b})`
  }

  function lerpColorDarken(hex1, hex2, t, amt) {
    const [r1, g1, b1] = hexToRgb(hex1)
    const [r2, g2, b2] = hexToRgb(hex2)
    const r = Math.max(0, Math.round(r1 + (r2 - r1) * t) - amt)
    const g = Math.max(0, Math.round(g1 + (g2 - g1) * t) - amt)
    const b = Math.max(0, Math.round(b1 + (b2 - b1) * t) - amt)
    return `rgb(${r},${g},${b})`
  }

  function renderPhysics() {
    pCtx.clearRect(0, 0, physicsCanvas.width, physicsCanvas.height)
    const now = performance.now() * 0.001

    // ── 블렌드 업데이트 (0=mew, 1=mewtwo) ──
    updateModeBlend()
    const blend = getModeBlend()
    const mewAlpha = 1 - blend        // mew 요소 불투명도
    const mtwoAlpha = blend            // mewtwo 요소 불투명도

    // ── 부드러운 마우스 보간 ──
    if (mousePos.x !== null) {
      mousePos.smoothX += (mousePos.x - mousePos.smoothX) * 0.15
      mousePos.smoothY += (mousePos.y - mousePos.smoothY) * 0.15
    }

    updateCursorNote(mousePos.x, mousePos.y, physicsCanvas.width, physicsCanvas.height)
    keepDrifting(orbs)
    updateSquish(orbs)

    // ═══════════════════════════════════════════════════
    // DNA 브리지 (mew 요소 — blend로 페이드)
    // ═══════════════════════════════════════════════════
    if (mewAlpha > 0.01) {
      const mergeDist = CONFIG.DNA_MERGE_DIST
      for (let i = 0; i < orbs.length; i++) {
        const a = orbs[i]
        const dnaA = a.plugin?.dna
        if (!dnaA) continue
        for (let j = i + 1; j < orbs.length; j++) {
          const b = orbs[j]
          const dnaB = b.plugin?.dna
          if (!dnaB) continue

          const dx = a.position.x - b.position.x
          const dy = a.position.y - b.position.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const threshold = dnaA.radius + dnaB.radius + mergeDist

          if (dist < threshold && dist > 0) {
            const t = 1 - dist / threshold
            const midX = (a.position.x + b.position.x) / 2
            const midY = (a.position.y + b.position.y) / 2
            const bridgeR = Math.min(dnaA.radius, dnaB.radius) * 0.6 * t

            if (bridgeR > 2) {
              pCtx.beginPath()
              pCtx.arc(midX, midY, bridgeR, 0, Math.PI * 2)
              pCtx.fillStyle = blendColors(dnaA.mewColor, dnaB.mewColor, 0.5)
              pCtx.globalAlpha = 0.8 * t * mewAlpha
              pCtx.fill()

              if (bridgeR > 5) {
                const qx1 = a.position.x * 0.7 + b.position.x * 0.3
                const qy1 = a.position.y * 0.7 + b.position.y * 0.3
                const qx2 = a.position.x * 0.3 + b.position.x * 0.7
                const qy2 = a.position.y * 0.3 + b.position.y * 0.7
                const subR = bridgeR * 0.8

                pCtx.beginPath()
                pCtx.arc(qx1, qy1, subR, 0, Math.PI * 2)
                pCtx.fillStyle = dnaA.mewColor
                pCtx.globalAlpha = 0.6 * t * mewAlpha
                pCtx.fill()

                pCtx.beginPath()
                pCtx.arc(qx2, qy2, subR, 0, Math.PI * 2)
                pCtx.fillStyle = dnaB.mewColor
                pCtx.globalAlpha = 0.6 * t * mewAlpha
                pCtx.fill()
              }
            }
          }
        }
      }
      pCtx.globalAlpha = 1
    }

    // ═══════════════════════════════════════════════════
    // 오브 본체 — blend로 색상 + 스타일 크로스페이드
    // ═══════════════════════════════════════════════════
    for (const body of orbs) {
      const dna = body.plugin?.dna
      if (!dna) continue

      const x = body.position.x
      const y = body.position.y

      // 블렌드된 색상
      const color = lerpColor(dna.mewColor, dna.mewtwoColor, blend)

      const sizeLerp = (Math.sin(now * dna.sizeFreq + dna.sizePhase) + 1) * 0.5
      const sizeScale = dna.sizeMin + (dna.sizeMax - dna.sizeMin) * sizeLerp
      const r = dna.radius * sizeScale

      const vx = body.velocity.x
      const vy = body.velocity.y
      const speed = Math.sqrt(vx * vx + vy * vy)

      // 유기적 호흡 (mew) — blend로 감쇠
      const breathe = 1 + Math.sin(now * 1.0 + dna.pulsePhase) * 0.08 * mewAlpha
      const breathe2 = 1 + Math.sin(now * 1.7 + dna.pulsePhase * 1.3) * 0.04 * mewAlpha

      // 속도 stretch — mew는 더 크게, mewtwo는 작게
      const velStretchMew = Math.min(speed * 0.1, 0.4)
      const velStretchMtwo = Math.min(speed * 0.06, 0.3)
      const velStretch = velStretchMew * mewAlpha + velStretchMtwo * mtwoAlpha

      const squish = dna.squish || 0
      const squishAngle = dna.squishAngle || 0

      const scaleX = breathe * breathe2 * (1 + velStretch + squish)
      const scaleY = breathe / breathe2 * (1 / Math.max(0.5, 1 + velStretch * 0.4 + squish * 0.6))

      const transformAngle = speed > 0.5 ? Math.atan2(vy, vx) : squishAngle

      pCtx.save()
      pCtx.translate(x, y)
      pCtx.rotate(transformAngle)

      // ── MEWTWO 외곽 글로우 (blend로 페이드인) ──
      if (mtwoAlpha > 0.01) {
        pCtx.beginPath()
        pCtx.ellipse(0, 0, r * scaleX * 1.15, r * scaleY * 1.15, 0, 0, Math.PI * 2)
        pCtx.fillStyle = color
        pCtx.globalAlpha = 0.15 * mtwoAlpha
        pCtx.fill()
      }

      // ── MEW 외막 (세포벽) — blend로 페이드아웃 ──
      if (mewAlpha > 0.01) {
        const membraneR = r * 1.08
        pCtx.beginPath()
        pCtx.ellipse(0, 0, membraneR * scaleX, membraneR * scaleY, 0, 0, Math.PI * 2)
        pCtx.fillStyle = color
        pCtx.globalAlpha = 0.35 * mewAlpha
        pCtx.fill()
      }

      // ── 메인 바디 — 항상 그리되 스타일을 블렌드 ──
      {
        const bodyR = r * 0.92
        // mew: 그라데이션, mewtwo: flat — blend로 크로스페이드
        if (mewAlpha > 0.3) {
          // 유기적 그라데이션 (mew 비중 클 때)
          const grad = pCtx.createRadialGradient(
            -bodyR * 0.15 * scaleX, -bodyR * 0.15 * scaleY, bodyR * 0.1,
            0, 0, bodyR * Math.max(scaleX, scaleY),
          )
          grad.addColorStop(0, lerpColorLighten(dna.mewColor, dna.mewtwoColor, blend, 40))
          grad.addColorStop(0.6, color)
          grad.addColorStop(1, lerpColorDarken(dna.mewColor, dna.mewtwoColor, blend, 30))
          pCtx.beginPath()
          pCtx.ellipse(0, 0, bodyR * scaleX, bodyR * scaleY, 0, 0, Math.PI * 2)
          pCtx.fillStyle = grad
          pCtx.globalAlpha = 0.9 * mewAlpha
          pCtx.fill()
        }

        // flat 바디 (mewtwo 비중 클 때)
        if (mtwoAlpha > 0.01) {
          pCtx.beginPath()
          pCtx.ellipse(0, 0, r * scaleX, r * scaleY, 0, 0, Math.PI * 2)
          pCtx.fillStyle = color
          pCtx.globalAlpha = 0.85 * mtwoAlpha
          pCtx.fill()
        }
      }

      // ── 핵 (mew 전용 — blend로 페이드) ──
      if (mewAlpha > 0.05) {
        const nucleusR = r * 0.3
        const nucleusOffX = -r * 0.1 * scaleX
        const nucleusOffY = -r * 0.05 * scaleY
        const nucleusPulse = 1 + Math.sin(now * 2.0 + dna.pulsePhase * 2) * 0.12
        pCtx.beginPath()
        pCtx.ellipse(
          nucleusOffX, nucleusOffY,
          nucleusR * nucleusPulse * scaleX, nucleusR * nucleusPulse * scaleY,
          0, 0, Math.PI * 2,
        )
        pCtx.fillStyle = lerpColorLighten(dna.mewColor, dna.mewtwoColor, blend, 60)
        pCtx.globalAlpha = 0.55 * mewAlpha
        pCtx.fill()
      }

      // ── 하이라이트 (mew 전용 — blend로 페이드) ──
      if (mewAlpha > 0.05) {
        const hlR = r * 0.18
        const hlX = -r * 0.28 * scaleX
        const hlY = -r * 0.3 * scaleY
        pCtx.beginPath()
        pCtx.ellipse(hlX, hlY, hlR * scaleX * 0.9, hlR * scaleY * 0.7, -0.3, 0, Math.PI * 2)
        pCtx.fillStyle = 'rgba(255, 255, 255, 0.55)'
        pCtx.globalAlpha = 0.6 * mewAlpha
        pCtx.fill()
      }

      pCtx.restore()
      pCtx.globalAlpha = 1
    }

    // ═══════════════════════════════════════════════════
    // 커서 — 크로스페이드
    // ═══════════════════════════════════════════════════
    if (mousePos.x !== null) {
      const mx = mousePos.smoothX
      const my = mousePos.smoothY

      const dx = mousePos.x - mousePos._prevX
      const dy = mousePos.y - mousePos._prevY
      const mSpeed = Math.sqrt(dx * dx + dy * dy)

      // ── MEW 커서 (blend로 페이드) ──
      if (mewAlpha > 0.01) {
        const targetR = (55 + Math.min(mSpeed * 0.8, 25)) * _ss
        cursorSmoothR += (targetR - cursorSmoothR) * 0.08
        const cursorR = cursorSmoothR
        const cursorPulse = 1 + Math.sin(now * 2.5) * 0.05
        const cursorPulse2 = 1 + Math.sin(now * 3.2) * 0.03

        pCtx.save()
        pCtx.translate(mx, my)
        if (mSpeed > 8) {
          const targetAngle = Math.atan2(dy, dx)
          let angleDiff = targetAngle - cursorSmoothAngle
          if (angleDiff > Math.PI) angleDiff -= Math.PI * 2
          if (angleDiff < -Math.PI) angleDiff += Math.PI * 2
          cursorSmoothAngle += angleDiff * 0.1
          pCtx.rotate(cursorSmoothAngle)
        }

        pCtx.beginPath()
        pCtx.ellipse(0, 0, cursorR * cursorPulse * 1.1, cursorR * cursorPulse2 * 1.1, 0, 0, Math.PI * 2)
        pCtx.fillStyle = '#ffb3de'
        pCtx.globalAlpha = 0.3 * mewAlpha
        pCtx.fill()

        pCtx.beginPath()
        pCtx.ellipse(0, 0, cursorR * cursorPulse, cursorR * cursorPulse2, 0, 0, Math.PI * 2)
        pCtx.fillStyle = '#ffb3de'
        pCtx.globalAlpha = 0.6 * mewAlpha
        pCtx.fill()

        pCtx.beginPath()
        pCtx.arc(0, 0, cursorR * 0.3, 0, Math.PI * 2)
        pCtx.fillStyle = '#ffd6ee'
        pCtx.globalAlpha = 0.5 * mewAlpha
        pCtx.fill()

        pCtx.beginPath()
        pCtx.ellipse(-cursorR * 0.25, -cursorR * 0.28, cursorR * 0.14, cursorR * 0.1, -0.3, 0, Math.PI * 2)
        pCtx.fillStyle = 'rgba(255,255,255,0.6)'
        pCtx.globalAlpha = 0.5 * mewAlpha
        pCtx.fill()

        pCtx.restore()
        pCtx.globalAlpha = 1

        // 위성 블롭
        for (let k = 0; k < 3; k++) {
          const orbitAngle = now * 1.8 + k * (Math.PI * 2 / 3)
          const orbitDist = cursorR * 0.9
          const sx = mx + Math.cos(orbitAngle) * orbitDist
          const sy = my + Math.sin(orbitAngle) * orbitDist
          const satPulse = 1 + Math.sin(now * 3 + k * 2) * 0.15
          pCtx.beginPath()
          pCtx.arc(sx, sy, cursorR * 0.2 * satPulse, 0, Math.PI * 2)
          pCtx.fillStyle = k === 0 ? '#f8b4f8' : k === 1 ? '#d4aaff' : '#b3e5fc'
          pCtx.globalAlpha = 0.5 * mewAlpha
          pCtx.fill()
        }
        pCtx.globalAlpha = 1
      }

      // ── MEWTWO 커서 (blend로 페이드인) ──
      if (mtwoAlpha > 0.01) {
        const locked = getLockedOrb()
        const scanRange = 300

        // 스캔 브라켓
        for (const body of orbs) {
          const dna = body.plugin?.dna
          if (!dna) continue

          const ox = body.position.x
          const oy = body.position.y
          const ddx = ox - mx
          const ddy = oy - my
          const dist = Math.sqrt(ddx * ddx + ddy * ddy)

          if (dist > scanRange) continue

          const isLocked = locked === body
          const t = 1 - dist / scanRange
          const sizeLerp2 = (Math.sin(now * dna.sizeFreq + dna.sizePhase) + 1) * 0.5
          const sizeScale2 = dna.sizeMin + (dna.sizeMax - dna.sizeMin) * sizeLerp2
          const rr = dna.radius * sizeScale2 * 1.4
          const bracketLen = isLocked ? 12 : 8
          const alpha = (isLocked ? 0.8 : t * 0.35) * mtwoAlpha

          pCtx.strokeStyle = `rgba(0, 255, 247, ${alpha})`
          pCtx.lineWidth = isLocked ? 2 : 1

          pCtx.beginPath()
          pCtx.moveTo(ox - rr, oy - rr + bracketLen)
          pCtx.lineTo(ox - rr, oy - rr)
          pCtx.lineTo(ox - rr + bracketLen, oy - rr)
          pCtx.stroke()
          pCtx.beginPath()
          pCtx.moveTo(ox + rr - bracketLen, oy - rr)
          pCtx.lineTo(ox + rr, oy - rr)
          pCtx.lineTo(ox + rr, oy - rr + bracketLen)
          pCtx.stroke()
          pCtx.beginPath()
          pCtx.moveTo(ox - rr, oy + rr - bracketLen)
          pCtx.lineTo(ox - rr, oy + rr)
          pCtx.lineTo(ox - rr + bracketLen, oy + rr)
          pCtx.stroke()
          pCtx.beginPath()
          pCtx.moveTo(ox + rr - bracketLen, oy + rr)
          pCtx.lineTo(ox + rr, oy + rr)
          pCtx.lineTo(ox + rr, oy + rr - bracketLen)
          pCtx.stroke()

          if (isLocked) {
            const lockPulse = 0.6 + Math.sin(now * 6) * 0.4
            pCtx.font = '9px "Share Tech Mono", monospace'
            pCtx.textAlign = 'center'
            pCtx.fillStyle = `rgba(0, 255, 247, ${lockPulse * mtwoAlpha})`
            pCtx.fillText(`[ ${dna.dnaType.toUpperCase()} // LOCKED ]`, ox, oy - rr - 8)
            pCtx.textAlign = 'start'

            const lineDist = Math.sqrt((ox - mx) ** 2 + (oy - my) ** 2)
            const perpNx = -(oy - my) / (lineDist || 1)
            const perpNy = (ox - mx) / (lineDist || 1)

            const arcConfigs = [
              { freq: 3.0, amp: 30, alpha: 0.25, width: 2.0, color: '0, 255, 247' },
              { freq: 4.5, amp: 18, alpha: 0.15, width: 1.2, color: '123, 47, 255' },
              { freq: 6.0, amp: 12, alpha: 0.10, width: 0.8, color: '0, 255, 247' },
            ]

            for (const arc of arcConfigs) {
              pCtx.beginPath()
              const segments = 20
              for (let seg = 0; seg <= segments; seg++) {
                const st = seg / segments
                const baseX = ox + (mx - ox) * st
                const baseY = oy + (my - oy) * st
                const envelope = Math.sin(st * Math.PI)
                const wave = Math.sin(now * arc.freq + st * 10) * arc.amp * envelope
                const px = baseX + perpNx * wave
                const py = baseY + perpNy * wave
                if (seg === 0) pCtx.moveTo(px, py)
                else pCtx.lineTo(px, py)
              }
              pCtx.strokeStyle = `rgba(${arc.color}, ${arc.alpha * lockPulse * mtwoAlpha})`
              pCtx.lineWidth = arc.width
              pCtx.stroke()
            }

            for (let p = 0; p < 3; p++) {
              const pt = ((now * 1.2 + p * 0.33) % 1)
              const baseX = ox + (mx - ox) * pt
              const baseY = oy + (my - oy) * pt
              const envelope = Math.sin(pt * Math.PI)
              const wave = Math.sin(now * 3 + pt * 10) * 25 * envelope
              const ppx = baseX + perpNx * wave
              const ppy = baseY + perpNy * wave
              const pAlpha = lockPulse * 0.7 * envelope * mtwoAlpha

              if (pAlpha > 0.05) {
                const pGrad = pCtx.createRadialGradient(ppx, ppy, 0, ppx, ppy, 5)
                pGrad.addColorStop(0, `rgba(0, 255, 247, ${pAlpha})`)
                pGrad.addColorStop(1, 'rgba(0, 255, 247, 0)')
                pCtx.beginPath()
                pCtx.arc(ppx, ppy, 5, 0, Math.PI * 2)
                pCtx.fillStyle = pGrad
                pCtx.fill()
              }
            }

            const lockRingR = rr + 4 + Math.sin(now * 4) * 2
            pCtx.strokeStyle = `rgba(0, 255, 247, ${lockPulse * 0.4 * mtwoAlpha})`
            pCtx.lineWidth = 1
            for (let i = 0; i < 4; i++) {
              const startAngle = now * 2 + i * (Math.PI / 2)
              pCtx.beginPath()
              pCtx.arc(ox, oy, lockRingR, startAngle, startAngle + 0.4)
              pCtx.stroke()
            }
          }
        }

        // 사이킥 커서
        const hasLock = !!locked
        const arcR = hasLock ? 24 : 18
        const arcSpeed = hasLock ? 3 : 1.5

        pCtx.strokeStyle = `rgba(0, 255, 247, ${(hasLock ? 0.7 : 0.45) * mtwoAlpha})`
        pCtx.lineWidth = 1.5
        for (let i = 0; i < 3; i++) {
          const startAngle = now * arcSpeed + i * (Math.PI * 2 / 3)
          pCtx.beginPath()
          pCtx.arc(mx, my, arcR, startAngle, startAngle + 0.8)
          pCtx.stroke()
        }

        pCtx.strokeStyle = `rgba(0, 255, 247, ${(hasLock ? 0.4 : 0.2) * mtwoAlpha})`
        pCtx.lineWidth = 1
        for (let i = 0; i < 2; i++) {
          const startAngle = -now * arcSpeed * 0.7 + i * Math.PI
          pCtx.beginPath()
          pCtx.arc(mx, my, arcR * 0.6, startAngle, startAngle + 0.6)
          pCtx.stroke()
        }

        const corePulse = 1 + Math.sin(now * 5) * 0.3
        pCtx.beginPath()
        pCtx.arc(mx, my, 3 * corePulse, 0, Math.PI * 2)
        pCtx.fillStyle = `rgba(0, 255, 247, ${(hasLock ? 0.9 : 0.6) * mtwoAlpha})`
        pCtx.fill()

        const s = 10
        pCtx.strokeStyle = `rgba(0, 255, 247, ${0.25 * mtwoAlpha})`
        pCtx.lineWidth = 1
        pCtx.beginPath()
        pCtx.moveTo(mx - s, my); pCtx.lineTo(mx - s * 0.35, my)
        pCtx.moveTo(mx + s * 0.35, my); pCtx.lineTo(mx + s, my)
        pCtx.moveTo(mx, my - s); pCtx.lineTo(mx, my - s * 0.35)
        pCtx.moveTo(mx, my + s * 0.35); pCtx.lineTo(mx, my + s)
        pCtx.stroke()

        if (hasLock) {
          const glowR = arcR + 8 + Math.sin(now * 3) * 4
          const grad = pCtx.createRadialGradient(mx, my, 0, mx, my, glowR)
          grad.addColorStop(0, `rgba(0, 255, 247, ${0.15 * mtwoAlpha})`)
          grad.addColorStop(0.5, `rgba(123, 47, 255, ${0.06 * mtwoAlpha})`)
          grad.addColorStop(1, 'rgba(0, 255, 247, 0)')
          pCtx.beginPath()
          pCtx.arc(mx, my, glowR, 0, Math.PI * 2)
          pCtx.fillStyle = grad
          pCtx.fill()
        }
      }

      mousePos._prevX = mousePos.x
      mousePos._prevY = mousePos.y
    }

    requestAnimationFrame(renderPhysics)
  }
  requestAnimationFrame(renderPhysics)

  // ── 리사이즈 ──
  window.addEventListener('resize', resizeCanvases)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvases)
  }
})

export { getMousePos }

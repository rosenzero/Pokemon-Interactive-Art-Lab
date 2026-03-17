// ── Typographic Art Layer ──
// A: 배경 대형 타이포 + C: 커서 반응형 키네틱 왜곡
// renderer.js의 FX 캔버스 위에 직접 그려짐

import { getLangIdx, onLangChange } from './lang.js'

let offscreen = null
let offCtx = null
let currentMode = 'mew'
let currentLangIdx = 0

// 언어별 타이포 텍스트
const TYPO_TEXT = {
  mew:    ['뮤', 'MEW', 'ミュウ'],
  mewtwo: ['뮤츠', 'MEWTWO', 'ミュウツー'],
}

// 오프스크린 텍스트 캐시
let cachedText = ''
let cachedW = 0
let cachedH = 0

// ── dataCorruption 키프레임 (레퍼런스 정확 재현) ──
// clip-path: inset(top% 0 bottom% 0) → 보이는 영역 = (top%, 100% - bottom%)
const DATA_CORRUPTION_FRAMES = [
  { top: 0,   bottom: 0   }, // 0%   — 전체 보임
  { top: 10,  bottom: 45  }, // 5%
  { top: 45,  bottom: 31  }, // 15%
  { top: 31,  bottom: 27  }, // 25%
  { top: 27,  bottom: 39  }, // 35%
  { top: 39,  bottom: 17  }, // 45%
  { top: 17,  bottom: 12  }, // 55%
  { top: 12,  bottom: 34  }, // 65%
  { top: 34,  bottom: 0   }, // 75%
  { top: 0,   bottom: 23  }, // 85%
  { top: 23,  bottom: 0   }, // 95%
  { top: 0,   bottom: 0   }, // 100% — 전체 보임
]

// ── glitch skew 키프레임 ──
const GLITCH_SKEW_FRAMES = [
  { t: 0.00, skewDeg: 0 },
  { t: 0.07, skewDeg: -0.5 },
  { t: 0.10, skewDeg: 0 },
  { t: 0.27, skewDeg: 0 },
  { t: 0.30, skewDeg: 0.8 },
  { t: 0.35, skewDeg: 0 },
  { t: 0.52, skewDeg: 0 },
  { t: 0.55, skewDeg: -1.0 },
  { t: 0.60, skewDeg: 0 },
  { t: 0.72, skewDeg: 0 },
  { t: 0.75, skewDeg: 0.4 },
  { t: 0.80, skewDeg: 0 },
  { t: 1.00, skewDeg: 0 },
]

function initTypo() {
  offscreen = document.createElement('canvas')
  offCtx = offscreen.getContext('2d')
  currentLangIdx = getLangIdx()
  onLangChange((idx) => {
    currentLangIdx = idx
    cachedText = '' // 언어 변경 시 캐시 무효화
  })
  // 폰트 로드 완료 후 캐시 무효화 — 첫 로드 시 시스템 폰트로 캐시되는 문제 방지
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { cachedText = '' })
  }
}

function setTypoMode(mode) {
  currentMode = mode
  cachedText = ''
}

// ── 언어별 폰트 선택 ──
function getFontFamily(mode, langIdx) {
  if (mode === 'mew') {
    if (langIdx === 0) return "'Jua', sans-serif"             // 둥글고 부드러운
    if (langIdx === 2) return "'Zen Maru Gothic', sans-serif"  // 마루고딕 (둥근)
    return "'Quicksand', sans-serif"
  } else {
    if (langIdx === 0) return "'Black Han Sans', sans-serif"   // 굵고 강렬한
    if (langIdx === 2) return "'Noto Sans JP', sans-serif"     // 날카로운
    return "'Fira Code', monospace"
  }
}

// ── 오프스크린에 텍스트 렌더 (캐시) ──
function renderTextToOffscreen(w, h) {
  const text = TYPO_TEXT[currentMode][currentLangIdx] || TYPO_TEXT[currentMode][1]

  if (cachedText === text && cachedW === w && cachedH === h) return
  cachedText = text
  cachedW = w
  cachedH = h

  offscreen.width = w
  offscreen.height = h
  offCtx.clearRect(0, 0, w, h)

  const fontFamily = getFontFamily(currentMode, currentLangIdx)
  const isLatin = currentLangIdx === 1

  const maxFontSize = currentMode === 'mew'
    ? w * (isLatin ? 0.30 : 0.25)
    : w * (isLatin ? 0.18 : 0.15)
  const fontSize = Math.min(maxFontSize, h * 0.45)
  // Jua, Black Han Sans: 400만 지원 / Zen Maru Gothic: 900 / Noto Sans JP: 900
  let fontWeight
  if (currentLangIdx === 0) fontWeight = '400'          // 한국어 (Jua, Black Han Sans)
  else if (currentLangIdx === 2) fontWeight = '900'     // 일본어
  else fontWeight = currentMode === 'mew' ? '700' : '400' // 영어

  offCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  offCtx.textAlign = 'center'
  offCtx.textBaseline = 'middle'

  if (currentMode === 'mew') {
    const grad = offCtx.createLinearGradient(
      w * 0.25, h * 0.3,
      w * 0.75, h * 0.7
    )
    grad.addColorStop(0, 'rgba(212, 170, 255, 0.14)')
    grad.addColorStop(0.5, 'rgba(255, 179, 222, 0.18)')
    grad.addColorStop(1, 'rgba(248, 180, 248, 0.12)')
    offCtx.fillStyle = grad
  } else {
    // MEWTWO: 희미한 메탈릭 사이언
    offCtx.fillStyle = 'rgba(0, 255, 247, 0.04)'
  }

  offCtx.fillText(text, w / 2, h / 2)
}

// ── 키프레임 보간 유틸 ──
function getCorruptionClip(frames, t) {
  // t: 0~1 (애니메이션 진행률)
  const totalFrames = frames.length
  const idx = t * (totalFrames - 1)
  const i = Math.floor(idx)
  const frac = idx - i
  const a = frames[Math.min(i, totalFrames - 1)]
  const b = frames[Math.min(i + 1, totalFrames - 1)]
  return {
    top: a.top + (b.top - a.top) * frac,
    bottom: a.bottom + (b.bottom - a.bottom) * frac,
  }
}

function getGlitchSkew(t) {
  // t: 0~1
  for (let i = GLITCH_SKEW_FRAMES.length - 2; i >= 0; i--) {
    if (t >= GLITCH_SKEW_FRAMES[i].t) {
      const a = GLITCH_SKEW_FRAMES[i]
      const b = GLITCH_SKEW_FRAMES[i + 1]
      const frac = (t - a.t) / (b.t - a.t)
      return a.skewDeg + (b.skewDeg - a.skewDeg) * frac
    }
  }
  return 0
}

// ── 메인 그리기 ──
function drawTypo(ctx, w, h, mousePos) {
  if (!offscreen) return

  const now = performance.now() * 0.001
  renderTextToOffscreen(w, h)

  const hasMouse = mousePos && mousePos.x !== null
  const mx = hasMouse ? mousePos.smoothX : w / 2
  const my = hasMouse ? mousePos.smoothY : h / 2

  if (currentMode === 'mew') {
    drawMewTypo(ctx, w, h, now, mx, my, hasMouse)
  } else {
    drawMewtwoTypo(ctx, w, h, now, mx, my, hasMouse)
  }
}

// ═══════════════════════════════════════════════════════
// MEW: 유기적 파동 왜곡
// ═══════════════════════════════════════════════════════
function drawMewTypo(ctx, w, h, now, mx, my, hasMouse) {
  const _isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const stripH = _isMobile ? 6 : 3
  const totalStrips = Math.ceil(h / stripH)
  const breathe = Math.sin(now * 0.4) * 3

  for (let i = 0; i < totalStrips; i++) {
    const y = i * stripH
    let offsetX = Math.sin(now * 0.6 + y * 0.008) * 2 + breathe

    if (hasMouse) {
      const distY = Math.abs(y - my)
      const distX = Math.abs(w / 2 - mx)
      const dist = Math.sqrt(distY * distY + distX * distX)
      const influence = Math.max(0, 1 - dist / 400)

      if (influence > 0) {
        const wave1 = Math.sin(now * 2.0 + y * 0.02) * 20
        const wave2 = Math.sin(now * 1.3 + y * 0.035) * 10
        const wave3 = Math.sin(now * 3.1 + y * 0.012) * 5
        offsetX += (wave1 + wave2 + wave3) * influence * influence
      }
    }

    ctx.drawImage(offscreen, 0, y, w, stripH, offsetX, y, w, stripH)
  }

  if (hasMouse) {
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 300)
    grad.addColorStop(0, 'rgba(255, 179, 222, 0.04)')
    grad.addColorStop(0.5, 'rgba(212, 170, 255, 0.02)')
    grad.addColorStop(1, 'rgba(255, 179, 222, 0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.beginPath()
    ctx.arc(mx, my, 300, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
}

// ═══════════════════════════════════════════════════════
// MEWTWO: data-corruption 글리치 (레퍼런스 정확 재현)
//
//   구조:
//   1. 기본 텍스트 (사이언)
//   2. ::before — clip-path 애니메이션 + 빨강 text-shadow + left: +2px
//   3. ::after  — clip-path 애니메이션 + 사이언 text-shadow + left: -2px
//   4. glitch skew 변형
//   5. scan-line 수직 이동
//   6. 커서 근접 시 강도 증가
// ═══════════════════════════════════════════════════════
function drawMewtwoTypo(ctx, w, h, now, mx, my, hasMouse) {
  const fontFamily = getFontFamily('mewtwo', currentLangIdx)
  const isLatin = currentLangIdx === 1
  const maxFontSize = w * (isLatin ? 0.18 : 0.15)
  const fontSize = Math.min(maxFontSize, h * 0.45)
  const fontWeight = currentLangIdx === 0 ? '400' : (currentLangIdx === 2 ? '900' : '400')
  const text = TYPO_TEXT.mewtwo[currentLangIdx] || TYPO_TEXT.mewtwo[1]

  // 텍스트 바운딩 영역
  const textCY = h / 2
  const textH = fontSize * 1.3
  const textTop = textCY - textH / 2
  const textBot = textCY + textH / 2

  // 커서 영향도
  const dist = hasMouse
    ? Math.sqrt((mx - w / 2) ** 2 + (my - h / 2) ** 2)
    : 9999
  const influence = Math.max(0.3, Math.min(1, 1 - dist / 500))

  // ── glitch skew (전체 텍스트에 적용) ──
  const glitchCycle = 2.5 // 2.5초 주기
  const glitchT = (now % glitchCycle) / glitchCycle
  const skewDeg = getGlitchSkew(glitchT) * influence * 1.5

  ctx.save()
  // skew를 텍스트 중앙 기준으로 적용
  ctx.translate(w / 2, textCY)
  ctx.transform(1, 0, Math.tan(skewDeg * Math.PI / 180), 1, 0, 0)
  ctx.translate(-w / 2, -textCY)

  // ── 1. 기본 텍스트 ──
  ctx.drawImage(offscreen, 0, 0)

  // ── 2. ::before 레이어 (빨강, +2px, clip-path 2s alternate-reverse) ──
  {
    // alternate-reverse: 핑퐁 타이밍
    const period = 2.0 * (1.2 - influence * 0.5) // 커서 가까우면 빨라짐
    const raw = (now % (period * 2)) / period
    const t = raw <= 1 ? 1 - raw : raw - 1 // alternate-reverse

    const clip = getCorruptionClip(DATA_CORRUPTION_FRAMES, t)
    const clipTopPx = textTop + (clip.top / 100) * textH
    const clipBotPx = textBot - (clip.bottom / 100) * textH
    const clipH = Math.max(0, clipBotPx - clipTopPx)

    if (clipH > 0) {
      const offset = 2 + influence * 3

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, clipTopPx, w, clipH)
      ctx.clip()

      // 빨강 text-shadow 시뮬레이션
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `rgba(255, 46, 99, ${0.35 * influence})`
      ctx.fillText(text, w / 2 + offset, textCY)

      // 약간 밝은 원본 복사 (오프셋)
      ctx.globalAlpha = 0.2 * influence
      ctx.drawImage(offscreen, offset, 0)
      ctx.globalAlpha = 1

      ctx.restore()
    }
  }

  // ── 3. ::after 레이어 (사이언, -2px, clip-path 3s alternate-reverse) ──
  {
    const period = 3.0 * (1.2 - influence * 0.4)
    const raw = (now % (period * 2)) / period
    const t = raw <= 1 ? 1 - raw : raw - 1

    const clip = getCorruptionClip(DATA_CORRUPTION_FRAMES, t)
    const clipTopPx = textTop + (clip.top / 100) * textH
    const clipBotPx = textBot - (clip.bottom / 100) * textH
    const clipH = Math.max(0, clipBotPx - clipTopPx)

    if (clipH > 0) {
      const offset = -(2 + influence * 2)

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, clipTopPx, w, clipH)
      ctx.clip()

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `rgba(8, 217, 214, ${0.35 * influence})`
      ctx.fillText(text, w / 2 + offset, textCY)

      ctx.globalAlpha = 0.2 * influence
      ctx.drawImage(offscreen, offset, 0)
      ctx.globalAlpha = 1

      ctx.restore()
    }
  }

  ctx.restore() // skew 해제

  // ── 4. 스캔라인 수직 이동 (4s 주기) ──
  {
    const scanPeriod = 4.0
    const scanProgress = (now % scanPeriod) / scanPeriod
    const scanH = 80
    const scanY = scanProgress * (h + scanH) - scanH

    const grad = ctx.createLinearGradient(0, scanY, 0, scanY + scanH)
    grad.addColorStop(0, 'rgba(0, 255, 247, 0)')
    grad.addColorStop(0.5, `rgba(0, 255, 247, ${0.03 * influence})`)
    grad.addColorStop(1, 'rgba(0, 255, 247, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, scanY, w, scanH)
  }

  // ── 5. 커서 근접 추가 글리치 (강한 순간적 교란) ──
  if (influence > 0.5) {
    // 가끔 수평 전체 시프트 (flickering)
    if (Math.random() < influence * 0.06) {
      const shiftX = (Math.random() - 0.5) * 15 * influence
      ctx.globalAlpha = 0.12
      ctx.drawImage(offscreen, shiftX, 0)
      ctx.globalAlpha = 1
    }

    // 얇은 글리치 라인
    const lineCount = Math.floor(influence * 4)
    for (let i = 0; i < lineCount; i++) {
      const ly = textTop + Math.random() * textH
      ctx.fillStyle = `rgba(0, 255, 247, ${0.03 + Math.random() * 0.04})`
      ctx.fillRect(0, ly, w, 1)
    }
  }

  // ── 6. 커서 전자기 글로우 ──
  if (hasMouse) {
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 200)
    grad.addColorStop(0, `rgba(0, 255, 247, ${0.025 * influence})`)
    grad.addColorStop(1, 'rgba(0, 255, 247, 0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.beginPath()
    ctx.arc(mx, my, 200, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
}

export { initTypo, setTypoMode, drawTypo }

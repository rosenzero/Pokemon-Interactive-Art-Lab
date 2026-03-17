// ── Mobile Performance Utilities ──

export const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024)

export const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 3)

// Scale a canvas for HiDPI while keeping CSS size at logical pixels
export function scaleCanvas(canvas) {
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * DPR
  canvas.height = h * DPR
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  return { w, h }
}

// Throttle helper — returns a function that fires at most once per `ms`
export function throttle(fn, ms) {
  let last = 0
  return function (...args) {
    const now = performance.now()
    if (now - last >= ms) {
      last = now
      fn.apply(this, args)
    }
  }
}

// Frame limiter for RAF — returns true if this frame should be skipped
let _lastFrame = 0
const TARGET_MS = isMobile ? 1000 / 30 : 0 // 30fps cap on mobile, uncapped desktop

export function shouldSkipFrame(now) {
  if (TARGET_MS === 0) return false
  if (now - _lastFrame < TARGET_MS) return true
  _lastFrame = now
  return false
}

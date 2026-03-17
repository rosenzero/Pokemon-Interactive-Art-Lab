import Matter from 'matter-js'
import { CONFIG } from './physics.js'
import { addTrail, triggerShockwave } from './renderer.js'
import { getMode, getMewtwoEasterEgg, triggerEasterEgg } from './modes.js'
import {
  playMewCollision,
  playMewtwoCollision,
  playFluidCollision,
  playOrbMergeHarmony,
  playPsychicBlast,
  playScanLock,
} from './sound.js'

const { Events, Body } = Matter

let mousePosition = { x: null, y: null }
let easterEggInterval = null
let lockedOrb = null
let prevLockedOrb = null

// ── Fluid collision tracking (reference: fluid-synthesizer) ──
const activeOrbCollisions = new Set()

function setupInteractions(engine, physicsCanvas, getOrbs) {
  // ── 마우스 + 터치 위치 추적 ──
  physicsCanvas.addEventListener('mousemove', (e) => {
    mousePosition.x = e.clientX
    mousePosition.y = e.clientY
  })
  physicsCanvas.addEventListener('mouseleave', () => {
    mousePosition.x = null
    mousePosition.y = null
  })

  // 터치
  physicsCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const t = e.touches[0]
    mousePosition.x = t.clientX
    mousePosition.y = t.clientY
  }, { passive: false })
  physicsCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const t = e.touches[0]
    mousePosition.x = t.clientX
    mousePosition.y = t.clientY
  }, { passive: false })
  physicsCanvas.addEventListener('touchend', () => {
    mousePosition.x = null
    mousePosition.y = null
  })

  // ── 충돌 이벤트 → 사운드 + 스프링 바운스 ──
  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA
      const b = pair.bodyB
      const impact = Math.hypot(
        (a.velocity?.x || 0) - (b.velocity?.x || 0),
        (a.velocity?.y || 0) - (b.velocity?.y || 0),
      )
      if (impact < 1) continue

      const dnaType = a.plugin?.dna?.dnaType || b.plugin?.dna?.dnaType || 'Normal'
      const mode = getMode()

      if (mode === 'mew') {
        playMewCollision(impact, dnaType)
      } else {
        playMewtwoCollision(impact)
      }

      // ── 스프링 바운스: 충돌 강도에 비례해 squish 주입 ──
      const squishAmount = Math.min(impact * 0.08, 0.6)
      const collisionAngle = Math.atan2(
        b.position.y - a.position.y,
        b.position.x - a.position.x,
      )

      if (a.plugin?.dna) {
        a.plugin.dna.squishVel = -squishAmount
        a.plugin.dna.squishAngle = collisionAngle
      }
      if (b.plugin?.dna) {
        b.plugin.dna.squishVel = -squishAmount
        b.plugin.dna.squishAngle = collisionAngle + Math.PI
      }

      // 충돌 지점에 미니 트레일
      const cx = (a.position.x + b.position.x) / 2
      const cy = (a.position.y + b.position.y) / 2
      if (impact > 4) {
        addTrail(cx, cy, 0, 0)
      }
    }
  })

  // ── MEWTWO 사이킥 폭발 (클릭) ──
  physicsCanvas.addEventListener('click', (e) => {
    const mode = getMode()
    if (mode !== 'mewtwo') return

    const mx = e.clientX
    const my = e.clientY
    const blastRadius = 350
    const currentOrbs = getOrbs()

    for (const orb of currentOrbs) {
      const dx = orb.position.x - mx
      const dy = orb.position.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < blastRadius && dist > 1) {
        const t = 1 - dist / blastRadius
        const force = t * 0.08
        const nx = dx / dist
        const ny = dy / dist
        Body.applyForce(orb, orb.position, { x: nx * force, y: ny * force })

        // 충돌 스프링 주입
        if (orb.plugin?.dna) {
          orb.plugin.dna.squishVel = t * 0.6
          orb.plugin.dna.squishAngle = Math.atan2(dy, dx)
        }
        orb._glowPulse = Math.max(orb._glowPulse || 0, t)
      }
    }

    triggerShockwave(mx, my, 'mewtwo')
    playPsychicBlast()
  })

  // ── Fluid cursor-orb interaction (reference: fluid-synthesizer) ──
  // 커서 블롭 근접 → 부드러운 밀어내기 + 글로우 펄스 + 사운드
  Events.on(engine, 'afterUpdate', () => {
    if (mousePosition.x === null) return
    const orbs = getOrbs()
    const mx = mousePosition.x
    const my = mousePosition.y
    const mode = getMode()

    // ── 모드별 커서-오브 인터랙션 ──
    let closestDist = Infinity
    let closestOrb = null

    for (const orb of orbs) {
      const dna = orb.plugin?.dna
      if (!dna) continue

      const dx = orb.position.x - mx
      const dy = orb.position.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (mode === 'mew') {
        // ═══ MEW: 부드러운 밀어내기 ═══
        const touchThreshold = dna.radius + 65
        if (dist < touchThreshold && dist > 1) {
          const overlap = 1 - dist / touchThreshold
          if (overlap > 0.5) {
            const pushStrength = (overlap - 0.5) * 0.001
            const nx = dx / dist
            const ny = dy / dist
            Body.applyForce(orb, orb.position, {
              x: nx * pushStrength,
              y: ny * pushStrength,
            })
          }
          if (!orb._fluidCollided) {
            orb._fluidCollided = true
            orb._glowPulse = 1.0
            if (Math.abs(dna.squish) < 0.05) {
              dna.squishVel = 0.04
              dna.squishAngle = Math.atan2(-dy, -dx)
            }
            playFluidCollision(mode, dna.dnaType)
          }
          orb._glowPulse = Math.max(orb._glowPulse || 0, 0.5)
        } else {
          orb._fluidCollided = false
          if (orb._glowPulse > 0) {
            orb._glowPulse = Math.max(0, (orb._glowPulse || 0) - 0.03)
          }
        }
      } else {
        // ═══ MEWTWO: 사이코키네시스 끌어당기기 + 스캔 ═══
        const pullRange = 280
        if (dist < pullRange && dist > 5) {
          const t = 1 - dist / pullRange

          // 텔레키네시스: 커서 방향으로 끌어당기기
          const pullForce = t * t * 0.0006
          const nx = dx / dist
          const ny = dy / dist
          Body.applyForce(orb, orb.position, {
            x: -nx * pullForce,
            y: -ny * pullForce,
          })

          // 가장 가까운 오브 추적 (락온 대상)
          if (dist < closestDist) {
            closestDist = dist
            closestOrb = orb
          }

          // 글로우 펄스
          orb._glowPulse = Math.max(orb._glowPulse || 0, t * 0.6)

          // 근접 시 squish + 사운드 (1회)
          const touchRange = dna.radius + 80
          if (dist < touchRange && !orb._fluidCollided) {
            orb._fluidCollided = true
            if (Math.abs(dna.squish) < 0.05) {
              dna.squishVel = 0.06
              dna.squishAngle = Math.atan2(-dy, -dx)
            }
            playFluidCollision(mode, dna.dnaType)
          }
        } else {
          orb._fluidCollided = false
          if (orb._glowPulse > 0) {
            orb._glowPulse = Math.max(0, (orb._glowPulse || 0) - 0.02)
          }
        }
      }
    }

    // ── MEWTWO 락온 상태 업데이트 ──
    if (mode === 'mewtwo') {
      const newLocked = (closestOrb && closestDist < 200) ? closestOrb : null
      if (newLocked && newLocked !== prevLockedOrb) {
        playScanLock()
      }
      prevLockedOrb = lockedOrb
      lockedOrb = newLocked
    } else {
      lockedOrb = null
      prevLockedOrb = null
    }

    // Orb-to-orb proximity detection (harmonic merging)
    for (let i = 0; i < orbs.length; i++) {
      for (let j = i + 1; j < orbs.length; j++) {
        const orbA = orbs[i]
        const orbB = orbs[j]
        const dnaA = orbA.plugin?.dna
        const dnaB = orbB.plugin?.dna
        if (!dnaA || !dnaB) continue

        const dx = orbA.position.x - orbB.position.x
        const dy = orbA.position.y - orbB.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const threshold = dnaA.radius + dnaB.radius + 20

        const pairKey = `${dnaA.dnaIndex}-${dnaB.dnaIndex}`

        if (dist < threshold) {
          if (!activeOrbCollisions.has(pairKey)) {
            activeOrbCollisions.add(pairKey)
            orbA._glowPulse = Math.max(orbA._glowPulse || 0, 0.7)
            orbB._glowPulse = Math.max(orbB._glowPulse || 0, 0.7)
            // 하모닉 머지 사운드
            playOrbMergeHarmony()
          }
        } else {
          activeOrbCollisions.delete(pairKey)
        }
      }
    }
  })

  // ── 이스터에그 체크 (500ms 간격) ──
  easterEggInterval = setInterval(() => {
    const orbs = getOrbs()
    if (getMewtwoEasterEgg(orbs, window.innerWidth, window.innerHeight)) {
      triggerEasterEgg()
    }
  }, 500)

}

function getLockedOrb() { return lockedOrb }

export { setupInteractions, getLockedOrb }

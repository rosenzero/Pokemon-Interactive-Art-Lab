import Matter from 'matter-js'

const { Engine, World, Bodies, Body, Events, Composite } = Matter

// ── 상수 ──
const CONFIG = {
  ORB_COUNT: 28,
  ORB_MIN_RADIUS: 34,
  ORB_MAX_RADIUS: 74,
  RESTITUTION: 0.98,         // 매우 높은 탄성 → 뽀잉뽀잉 바운스
  FRICTION: 0,               // 마찰 없음 → 우주 공간
  FRICTION_AIR: 0.001,       // 극미한 공기저항 → 더 오래 떠다님
  WALL_THICKNESS: 100,
  FLEE_RADIUS: 140,
  FLEE_FORCE: 0.006,
  RARE_INTERVAL: 30000,
  DNA_MERGE_DIST: 60,        // 머지 거리 늘림 → 더 자주 합체
  DRIFT_SPEED_MIN: 0.4,      // 최소 표류 속도
  DRIFT_SPEED_MAX: 1.2,      // 최대 표류 속도
  DRIFT_NUDGE_FORCE: 0.0003, // 주기적 미세 추진력
}

// ── DNA 타입 × 색상 매핑 (18 타입) ──
// 원작 타입 색감 기반 + 겹치는 계열 hue/채도/명도 보정
const DNA_TYPES = [
  { type: 'Fire',     mewColor: '#ffcba4', mewtwoColor: '#ff4500' },  // 피치 / 레드오렌지
  { type: 'Water',    mewColor: '#90caf9', mewtwoColor: '#1e88e5' },  // 블루 (ice와 분리: 더 진한 블루)
  { type: 'Grass',    mewColor: '#c8f5c8', mewtwoColor: '#00e676' },  // 연두
  { type: 'Psychic',  mewColor: '#f8b4f8', mewtwoColor: '#e040fb' },  // 핑크퍼플 (ghost와 분리: 핑크 쪽)
  { type: 'Electric', mewColor: '#fff176', mewtwoColor: '#ffe600' },  // 옐로 (채도 올림)
  { type: 'Ice',      mewColor: '#b2ebf2', mewtwoColor: '#00e5ff' },  // 시안 (water와 분리: 시안 계열)
  { type: 'Dragon',   mewColor: '#b39ddb', mewtwoColor: '#651fff' },  // 인디고 (ghost/poison과 분리: 남보라)
  { type: 'Dark',     mewColor: '#a1887f', mewtwoColor: '#37474f' },  // 다크브라운 (rock/normal과 분리)
  { type: 'Steel',    mewColor: '#b0bec5', mewtwoColor: '#78909c' },  // 블루그레이 (채도 올림)
  { type: 'Ghost',    mewColor: '#ce93d8', mewtwoColor: '#7c4dff' },  // 퍼플 (psychic과 분리: 블루바이올렛)
  { type: 'Poison',   mewColor: '#e6a3d0', mewtwoColor: '#ab47bc' },  // 마젠타핑크 (ghost/psychic과 분리)
  { type: 'Ground',   mewColor: '#ffcc80', mewtwoColor: '#ffab00' },  // 앰버 (fire와 분리: 골드 쪽)
  { type: 'Rock',     mewColor: '#d7c0a5', mewtwoColor: '#795548' },  // 샌드/탄 (dark와 분리)
  { type: 'Bug',      mewColor: '#dce775', mewtwoColor: '#aeea00' },  // 차트리우스 (채도 올림)
  { type: 'Flying',   mewColor: '#a8c8f0', mewtwoColor: '#82b1ff' },  // 스카이블루 (water/ice 사이)
  { type: 'Fighting', mewColor: '#ef9a9a', mewtwoColor: '#d50000' },  // 살몬/딥레드 (fairy와 완전 분리)
  { type: 'Normal',   mewColor: '#e0dcd0', mewtwoColor: '#bdbdbd' },  // 웜베이지 (steel과 분리)
  { type: 'Fairy',    mewColor: '#f8bbd0', mewtwoColor: '#ff80ab' },  // 핫핑크 (fighting과 분리)
]

let engine = null
let orbs = []

// ── 초기화 ──
function initPhysics() {
  engine = Engine.create()
  // 무중력 — 우주 공간
  engine.gravity.x = 0
  engine.gravity.y = 0

  const w = window.innerWidth
  const h = window.innerHeight
  const t = CONFIG.WALL_THICKNESS

  // 벽 (좌, 우, 바닥, 천장) — 높은 탄성으로 튕김
  const wallOpts = { isStatic: true, restitution: 1.0, friction: 0 }
  const walls = [
    Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, wallOpts),   // 바닥
    Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, wallOpts),       // 천장
    Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, wallOpts),       // 좌
    Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, wallOpts),    // 우
  ]
  walls.forEach(wall => { wall.render.visible = false })
  World.add(engine.world, walls)

  return engine
}

// ── 랜덤 표류 속도 생성 ──
function randomDriftVelocity() {
  const angle = Math.random() * Math.PI * 2
  const speed = CONFIG.DRIFT_SPEED_MIN + Math.random() * (CONFIG.DRIFT_SPEED_MAX - CONFIG.DRIFT_SPEED_MIN)
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
}

// ── 화면 크기 기반 스케일 계산 ──
function getScreenScale() {
  const w = window.innerWidth
  const h = window.innerHeight
  const area = w * h
  // 기준: 1920×1080 = 2,073,600
  const refArea = 1920 * 1080
  return Math.sqrt(area / refArea)
}

function getScaledOrbCount() {
  const scale = getScreenScale()
  // 완만한 스케일 — 모바일에서도 최소 18개
  const t = Math.max(0.65, scale)
  return Math.max(18, Math.min(40, Math.round(CONFIG.ORB_COUNT * t)))
}

// ── 오브 생성 ──
function createOrbs(world, count, mode = 'mew') {
  const w = window.innerWidth
  const h = window.innerHeight
  const scale = getScreenScale()
  const orbCount = count || getScaledOrbCount()
  const created = []

  // 반지름도 완만하게 — 최소 0.55배
  const rScale = Math.max(0.55, scale)
  const minR = CONFIG.ORB_MIN_RADIUS * rScale
  const maxR = CONFIG.ORB_MAX_RADIUS * rScale
  const bigR = (90 + Math.random() * 30) * rScale

  for (let i = 0; i < orbCount; i++) {
    const dna = DNA_TYPES[i % DNA_TYPES.length]
    // 처음 2개는 큰 세포, 나머지는 화면 비례 크기
    const radius = i < 2
      ? bigR
      : minR + Math.random() * (maxR - minR)

    // 화면 전체에 랜덤 배치 (우주에 흩어진 느낌)
    const x = radius + Math.random() * (w - radius * 2)
    const y = radius + Math.random() * (h - radius * 2)

    // 원형 바디 — 세포/계란 같은 부드러운 형태
    const orb = Bodies.circle(x, y, radius, {
      restitution: CONFIG.RESTITUTION,
      friction: CONFIG.FRICTION,
      frictionAir: CONFIG.FRICTION_AIR,
      render: { visible: false },
    })

    // 초기 표류 속도 부여
    Body.setVelocity(orb, randomDriftVelocity())
    // 느린 회전
    Body.setAngularVelocity(orb, (Math.random() - 0.5) * 0.02)

    // 커스텀 속성
    orb.plugin = orb.plugin || {}
    orb.plugin.dna = {
      dnaType: dna.type,
      mewColor: dna.mewColor,
      mewtwoColor: dna.mewtwoColor,
      dnaIndex: i,
      radius,
      // 스프링 바운스 상태
      squish: 0,           // 현재 찌그러짐 강도 (-1~1)
      squishVel: 0,         // 찌그러짐 속도
      squishAngle: 0,       // 찌그러짐 방향
      pulsePhase: Math.random() * Math.PI * 2, // 호흡 위상 (오브마다 다르게)
      // 느린 크기 변화 (레퍼런스: scale 0.5~1.6, 주기 8~22초)
      sizeMin: 0.45 + Math.random() * 0.2,     // 0.45~0.65
      sizeMax: 1.15 + Math.random() * 0.45,    // 1.15~1.6
      sizeFreq: 0.1 + Math.random() * 0.25,    // 주기 ~8~22초
      sizePhase: Math.random() * Math.PI * 2,
    }

    created.push(orb)
  }

  World.add(world, created)
  orbs = created
  return created
}

// ── 마우스 회피 (MEW 모드 전용) ──
function applyFleeForce(bodies, mousePosition, currentMode = 'mew') {
  if (currentMode !== 'mew') return
  if (!mousePosition || mousePosition.x === null) return

  const mx = mousePosition.x
  const my = mousePosition.y

  for (const body of bodies) {
    const dx = body.position.x - mx
    const dy = body.position.y - my
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < CONFIG.FLEE_RADIUS && dist > 0) {
      const force = CONFIG.FLEE_FORCE * (1 - dist / CONFIG.FLEE_RADIUS)
      const nx = dx / dist
      const ny = dy / dist
      Body.applyForce(body, body.position, {
        x: nx * force,
        y: ny * force,
      })
    }
  }
}

// ── 표류 유지 — 멈추지 않도록 미세 추진 ──
function keepDrifting(bodies) {
  for (const body of bodies) {
    const vx = body.velocity.x
    const vy = body.velocity.y
    const speed = Math.sqrt(vx * vx + vy * vy)

    // 너무 느려지면 랜덤 방향으로 살짝 밀어줌
    if (speed < CONFIG.DRIFT_SPEED_MIN) {
      const angle = Math.random() * Math.PI * 2
      Body.applyForce(body, body.position, {
        x: Math.cos(angle) * CONFIG.DRIFT_NUDGE_FORCE,
        y: Math.sin(angle) * CONFIG.DRIFT_NUDGE_FORCE,
      })
    }

    // 너무 빨라지면 살짝 감속
    if (speed > CONFIG.DRIFT_SPEED_MAX * 2) {
      Body.setVelocity(body, {
        x: vx * 0.95,
        y: vy * 0.95,
      })
    }
  }
}

// ── 스프링 바운스 물리 (매 프레임 호출) ──
function updateSquish(bodies) {
  const SPRING = 0.15     // 스프링 강도 (높을수록 빠르게 복원)
  const DAMPING = 0.75    // 감쇠 (1=감쇠없음, 0=즉시멈춤)

  for (const body of bodies) {
    const dna = body.plugin?.dna
    if (!dna) continue

    // 스프링 복원력: squish → 0 으로 되돌리려는 힘
    const springForce = -dna.squish * SPRING
    dna.squishVel = (dna.squishVel + springForce) * DAMPING

    dna.squish += dna.squishVel

    // 아주 작으면 멈춤
    if (Math.abs(dna.squish) < 0.001 && Math.abs(dna.squishVel) < 0.001) {
      dna.squish = 0
      dna.squishVel = 0
    }
  }
}

// ── 오브 형태 업데이트 (모드 전환 시) ──
function updateOrbShapes(mode) {
  if (!engine) return []

  const snapshots = orbs.map(orb => ({
    x: orb.position.x,
    y: orb.position.y,
    vx: orb.velocity.x,
    vy: orb.velocity.y,
    angularVelocity: orb.angularVelocity,
    dna: orb.plugin.dna,
  }))

  World.remove(engine.world, orbs)

  const newOrbs = []
  for (const snap of snapshots) {
    const orb = Bodies.circle(snap.x, snap.y, snap.dna.radius, {
      restitution: CONFIG.RESTITUTION,
      friction: CONFIG.FRICTION,
      frictionAir: CONFIG.FRICTION_AIR,
      render: { visible: false },
    })

    Body.setVelocity(orb, { x: snap.vx, y: snap.vy })
    Body.setAngularVelocity(orb, snap.angularVelocity)

    orb.plugin = orb.plugin || {}
    orb.plugin.dna = { ...snap.dna }

    newOrbs.push(orb)
  }

  World.add(engine.world, newOrbs)
  orbs = newOrbs
  return newOrbs
}

// ── 중력 설정 ──
function setGravity(mode) {
  if (!engine) return
  engine.gravity.y = mode === 'drift' ? 0 : 0
}

// ── 폭발 ──
function explodeAll(bodies, mode = 'mew') {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2

  for (const body of bodies) {
    const dx = body.position.x - cx
    const dy = body.position.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / dist
    const ny = dy / dist

    if (mode === 'mew') {
      const force = 0.015 + Math.random() * 0.01
      Body.applyForce(body, body.position, { x: nx * force, y: ny * force })
    } else {
      const force = 0.04 + Math.random() * 0.03
      Body.applyForce(body, body.position, { x: nx * force, y: ny * force })
    }
  }
}

// ── 뮤 실루엣 좌표 (40개) ──
function getRareSilhouettePositions() {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const s = Math.min(window.innerWidth, window.innerHeight) * 0.0018

  const head = []
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12
    head.push({
      x: cx + Math.cos(angle) * 70 * s,
      y: cy - 40 * s + Math.sin(angle) * 65 * s,
    })
  }

  const earL = [
    { x: cx - 55 * s, y: cy - 110 * s },
    { x: cx - 75 * s, y: cy - 155 * s },
    { x: cx - 40 * s, y: cy - 145 * s },
  ]

  const earR = [
    { x: cx + 55 * s, y: cy - 110 * s },
    { x: cx + 75 * s, y: cy - 155 * s },
    { x: cx + 40 * s, y: cy - 145 * s },
  ]

  const eyes = [
    { x: cx - 25 * s, y: cy - 50 * s },
    { x: cx + 25 * s, y: cy - 50 * s },
  ]

  const torso = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10
    torso.push({
      x: cx + Math.cos(angle) * 45 * s,
      y: cy + 80 * s + Math.sin(angle) * 55 * s,
    })
  }

  const tail = []
  for (let i = 0; i < 10; i++) {
    const t = i / 9
    tail.push({
      x: cx + (30 + t * 120) * s,
      y: cy + (110 - t * 30) * s + Math.sin(t * Math.PI * 1.5) * 50 * s,
    })
  }

  return [...head, ...earL, ...earR, ...eyes, ...torso, ...tail]
}

export {
  CONFIG,
  DNA_TYPES,
  getScreenScale,
  initPhysics,
  createOrbs,
  applyFleeForce,
  keepDrifting,
  updateSquish,
  updateOrbShapes,
  setGravity,
  explodeAll,
  getRareSilhouettePositions,
}

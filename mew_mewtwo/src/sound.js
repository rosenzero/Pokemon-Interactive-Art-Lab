// ── Fluid Synthesizer Audio Engine ──
// 레퍼런스(fluid-synthesizer)처럼 앰비언트 드론 + 커서 인터랙티브 + 세포 충돌 합성

let audioCtx = null
let masterGain = null
let initialized = false

// ── 이펙트 체인 노드 ──
let reverbNode = null
let delayNode = null
let delayFeedback = null
let filterNode = null
let lfoNode = null

// ── 앰비언트 드론 ──
let mewAmbientOscs = []
let mewAmbientGain = null
let mewNoiseSource = null
let mewtwoAmbientOscs = []
let mewtwoAmbientGain = null
let mewtwoSubOsc = null
let mewtwoNoiseSource = null
let ambientStarted = false
let currentAmbientMode = 'mew'

// ── 커서 인터랙티브 신스 ──
let cursorOsc = null
let cursorGain = null
let cursorFilter = null
let cursorSubOsc = null      // MEWTWO 서브 레이어
let cursorSubGain = null
let cursorDistortion = null  // MEWTWO 디스토션
let currentNoteIndex = -1

// ── MEW: 펜타토닉 스케일 (C 메이저, 밝고 따뜻) ──
const SCALE = [
  130.81, 146.83, 164.81, 196.00, 220.00,  // C3 D3 E3 G3 A3
  261.63, 293.66, 329.63, 392.00, 440.00,  // C4 D4 E4 G4 A4
  523.25, 587.33, 659.25, 783.99, 880.00,  // C5 D5 E5 G5 A5
]

// ── MEWTWO: 다크 마이너 스케일 (낮은 옥타브, 불안하고 무거운) ──
const MEWTWO_SCALE = [
  55.00,  58.27,  65.41,  73.42,  77.78,   // A1 Bb1 C2 D2 Eb2
  110.00, 116.54, 130.81, 146.83, 155.56,  // A2 Bb2 C3 D3 Eb3
  220.00, 233.08, 261.63, 293.66, 311.13,  // A3 Bb3 C4 D4 Eb4
]

// ── DNA 타입별 주파수 매핑 ──
const DNA_FREQ = {
  Fire:     523.25, Water:    587.33, Grass:    659.25,
  Psychic:  698.46, Electric: 783.99, Ice:      880.00,
  Dragon:   987.77, Dark:     440.00, Steel:    493.88,
  Ghost:    554.37, Poison:   622.25, Ground:   415.30,
  Rock:     369.99, Bug:      739.99, Flying:   830.61,
  Fighting: 349.23, Normal:   261.63, Fairy:    659.25,
}

// ══════════════════════════════════════
//  초기화
// ══════════════════════════════════════

function initAudio() {
  if (initialized) return
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()

  // ── 마스터 ──
  masterGain = audioCtx.createGain()
  masterGain.gain.value = 0.5
  masterGain.connect(audioCtx.destination)

  // ── 리버브 (합성 임펄스) ──
  reverbNode = audioCtx.createConvolver()
  const impulseLen = audioCtx.sampleRate * 2.5
  const impulse = audioCtx.createBuffer(2, impulseLen, audioCtx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch)
    for (let i = 0; i < impulseLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLen, 2.0)
    }
  }
  reverbNode.buffer = impulse
  const reverbGain = audioCtx.createGain()
  reverbGain.gain.value = 0.35
  reverbNode.connect(reverbGain)
  reverbGain.connect(masterGain)

  // ── 딜레이 (핑퐁 느낌) ──
  delayNode = audioCtx.createDelay(1.0)
  delayNode.delayTime.value = 0.375 // 8분음표 @160bpm
  delayFeedback = audioCtx.createGain()
  delayFeedback.gain.value = 0.3
  delayNode.connect(delayFeedback)
  delayFeedback.connect(delayNode)
  delayNode.connect(masterGain)

  // ── 필터 + LFO (호흡) ──
  filterNode = audioCtx.createBiquadFilter()
  filterNode.type = 'lowpass'
  filterNode.frequency.value = 1200
  filterNode.Q.value = 1.5
  filterNode.connect(masterGain)
  filterNode.connect(reverbNode)
  filterNode.connect(delayNode)

  lfoNode = audioCtx.createOscillator()
  const lfoGain = audioCtx.createGain()
  lfoNode.type = 'sine'
  lfoNode.frequency.value = 0.12 // 매우 느린 호흡
  lfoGain.gain.value = 600
  lfoNode.connect(lfoGain)
  lfoGain.connect(filterNode.frequency)
  lfoNode.start()

  // ── 커서 인터랙티브 신스 (연속 톤) ──
  cursorOsc = audioCtx.createOscillator()
  cursorFilter = audioCtx.createBiquadFilter()
  cursorGain = audioCtx.createGain()
  cursorOsc.type = 'sine'
  cursorOsc.frequency.value = 440
  cursorFilter.type = 'lowpass'
  cursorFilter.frequency.value = 800
  cursorFilter.Q.value = 2
  cursorGain.gain.value = 0 // 시작 시 무음
  cursorOsc.connect(cursorFilter)
  cursorFilter.connect(cursorGain)
  cursorGain.connect(filterNode)
  cursorOsc.start()

  // ── MEWTWO 전용: 서브 오실레이터 + 디스토션 ──
  // 서브 베이스 (1옥타브 아래, triangle — 깊은 진동)
  cursorSubOsc = audioCtx.createOscillator()
  cursorSubGain = audioCtx.createGain()
  cursorSubOsc.type = 'triangle'
  cursorSubOsc.frequency.value = 220
  cursorSubGain.gain.value = 0
  cursorSubOsc.connect(cursorSubGain)
  cursorSubGain.connect(masterGain) // 필터 우회 → 저음 보존
  cursorSubOsc.start()

  // 디스토션 (sawtooth → distortion → 별도 경로)
  cursorDistortion = audioCtx.createWaveShaper()
  cursorDistortion.curve = makeDistortionCurve(30)
  cursorDistortion.oversample = '4x'

  initialized = true

  // 바로 앰비언트 시작
  startAmbient()
}

function ensureCtx() {
  if (!audioCtx) return false
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return true
}

// ══════════════════════════════════════
//  앰비언트 BGM
// ══════════════════════════════════════

function startAmbient() {
  if (ambientStarted || !audioCtx) return
  ambientStarted = true

  buildMewAmbient()
  buildMewtwoAmbient()

  // MEW로 시작
  const now = audioCtx.currentTime
  mewAmbientGain.gain.setValueAtTime(0, now)
  mewAmbientGain.gain.linearRampToValueAtTime(0.09, now + 3)
  mewtwoAmbientGain.gain.setValueAtTime(0, now)
}

// ── MEW: 맑고 따뜻한 패드 — 생명, 자연, 신비 ──
function buildMewAmbient() {
  mewAmbientGain = audioCtx.createGain()
  mewAmbientGain.gain.value = 0
  mewAmbientGain.connect(masterGain)

  // 코드: C3 + E3 + G3 + C4 (밝은 C Major)
  // 각 음을 2개씩 살짝 디튠해서 코러스 효과
  const chordFreqs = [130.81, 164.81, 196.00, 261.63]
  const detunes = [-5, 5]

  for (const freq of chordFreqs) {
    for (const detune of detunes) {
      const osc = audioCtx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(mewAmbientGain)
      osc.start()
      mewAmbientOscs.push(osc)
    }
  }

  // 높은 옥타브 쉬머 (E5 + G5, 아주 작은 볼륨)
  const shimmerFreqs = [659.25, 783.99]
  for (const freq of shimmerFreqs) {
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.detune.value = Math.random() * 8 - 4
    const shimGain = audioCtx.createGain()
    shimGain.gain.value = 0.015
    osc.connect(shimGain)
    shimGain.connect(mewAmbientGain)
    osc.start()
    mewAmbientOscs.push(osc)
  }

  // 부드러운 노이즈 (바다/바람)
  const noiseLen = audioCtx.sampleRate * 2
  const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate)
  const noiseData = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.012
  }
  mewNoiseSource = audioCtx.createBufferSource()
  mewNoiseSource.buffer = noiseBuf
  mewNoiseSource.loop = true
  const noiseFilter = audioCtx.createBiquadFilter()
  noiseFilter.type = 'lowpass'
  noiseFilter.frequency.value = 350
  mewNoiseSource.connect(noiseFilter)
  noiseFilter.connect(mewAmbientGain)
  mewNoiseSource.start()
}

// ── MEWTWO: 다크하고 웅장한 드론 — 레퍼런스 스타일 ──
function buildMewtwoAmbient() {
  mewtwoAmbientGain = audioCtx.createGain()
  mewtwoAmbientGain.gain.value = 0
  mewtwoAmbientGain.connect(masterGain)

  // 코드: C1 + G1 + Eb2 + Bb2 (Cm7 — 한 옥타브 낮춰서 더 웅장)
  // sawtooth + triangle 믹스로 FM Synth 같은 풍성한 하모닉스
  const chordDef = [
    { freq: 32.70,  type: 'sawtooth', detune: -8 },  // C1
    { freq: 32.70,  type: 'sawtooth', detune: 8 },
    { freq: 49.00,  type: 'triangle', detune: -6 },  // G1
    { freq: 49.00,  type: 'triangle', detune: 6 },
    { freq: 77.78,  type: 'sawtooth', detune: -4 },  // Eb2
    { freq: 77.78,  type: 'triangle', detune: 4 },
    { freq: 116.54, type: 'triangle', detune: -3 },  // Bb2
    { freq: 116.54, type: 'triangle', detune: 3 },
  ]

  for (const def of chordDef) {
    const osc = audioCtx.createOscillator()
    osc.type = def.type
    osc.frequency.value = def.freq
    osc.detune.value = def.detune
    osc.connect(mewtwoAmbientGain)
    osc.start()
    mewtwoAmbientOscs.push(osc)
  }

  // 깊은 서브 베이스 (C0, 16Hz — 극저음 체감 진동)
  mewtwoSubOsc = audioCtx.createOscillator()
  mewtwoSubOsc.type = 'sine'
  mewtwoSubOsc.frequency.value = 16.35
  const subGain = audioCtx.createGain()
  subGain.gain.value = 0.15
  mewtwoSubOsc.connect(subGain)
  subGain.connect(mewtwoAmbientGain)
  mewtwoSubOsc.start()

  // 다크 노이즈 레이어 (불안한 바람)
  const noiseLen = audioCtx.sampleRate * 3
  const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate)
  const noiseData = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.03
  }
  mewtwoNoiseSource = audioCtx.createBufferSource()
  mewtwoNoiseSource.buffer = noiseBuf
  mewtwoNoiseSource.loop = true
  const noiseFilter = audioCtx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = 120
  noiseFilter.Q.value = 0.6
  mewtwoNoiseSource.connect(noiseFilter)
  noiseFilter.connect(mewtwoAmbientGain)
  mewtwoNoiseSource.start()

  // 느린 LFO로 노이즈 필터 주파수 변조 (숨쉬는 바람)
  const windLfo = audioCtx.createOscillator()
  const windLfoGain = audioCtx.createGain()
  windLfo.type = 'sine'
  windLfo.frequency.value = 0.05
  windLfoGain.gain.value = 80
  windLfo.connect(windLfoGain)
  windLfoGain.connect(noiseFilter.frequency)
  windLfo.start()
}

// ── 모드 전환: 크로스페이드 ──
function setAmbientMode(mode) {
  if (!audioCtx || !mewAmbientGain || !mewtwoAmbientGain) return
  const now = audioCtx.currentTime
  const fade = 2 // 크로스페이드 시간

  currentAmbientMode = mode

  if (mode === 'mew') {
    // MEW 페이드인, MEWTWO 페이드아웃
    mewAmbientGain.gain.cancelScheduledValues(now)
    mewtwoAmbientGain.gain.cancelScheduledValues(now)
    mewAmbientGain.gain.setValueAtTime(mewAmbientGain.gain.value, now)
    mewtwoAmbientGain.gain.setValueAtTime(mewtwoAmbientGain.gain.value, now)
    mewAmbientGain.gain.linearRampToValueAtTime(0.09, now + fade)
    mewtwoAmbientGain.gain.linearRampToValueAtTime(0, now + fade)
    if (filterNode) {
      filterNode.frequency.cancelScheduledValues(now)
      filterNode.frequency.setValueAtTime(filterNode.frequency.value, now)
      filterNode.frequency.linearRampToValueAtTime(1400, now + fade)
    }
  } else {
    // MEWTWO 페이드인, MEW 페이드아웃
    mewAmbientGain.gain.cancelScheduledValues(now)
    mewtwoAmbientGain.gain.cancelScheduledValues(now)
    mewAmbientGain.gain.setValueAtTime(mewAmbientGain.gain.value, now)
    mewtwoAmbientGain.gain.setValueAtTime(mewtwoAmbientGain.gain.value, now)
    mewAmbientGain.gain.linearRampToValueAtTime(0, now + fade)
    mewtwoAmbientGain.gain.linearRampToValueAtTime(0.08, now + fade)
    if (filterNode) {
      filterNode.frequency.cancelScheduledValues(now)
      filterNode.frequency.setValueAtTime(filterNode.frequency.value, now)
      filterNode.frequency.linearRampToValueAtTime(500, now + fade)
    }
  }
}

// ══════════════════════════════════════
//  커서 → 음높이 매핑 (레퍼런스)
// ══════════════════════════════════════

function updateCursorNote(mouseX, mouseY, screenWidth, screenHeight) {
  if (!ensureCtx() || !cursorOsc) return
  const mode = currentAmbientMode

  if (mouseX === null || mouseY === null) {
    // 마우스 나감 → 페이드아웃
    const fadeTime = audioCtx.currentTime + 0.3
    cursorGain.gain.linearRampToValueAtTime(0, fadeTime)
    if (cursorSubGain) cursorSubGain.gain.linearRampToValueAtTime(0, fadeTime)
    currentNoteIndex = -1
    return
  }

  const now = audioCtx.currentTime

  // ── 모드별 스케일 + 파형 선택 ──
  const scale = mode === 'mew' ? SCALE : MEWTWO_SCALE
  const targetType = mode === 'mew' ? 'sine' : 'sawtooth'
  if (cursorOsc.type !== targetType) cursorOsc.type = targetType

  // Y축 → 스케일 노트 (위 = 높은 음)
  const normalizedY = 1 - Math.max(0, Math.min(1, mouseY / screenHeight))
  const noteIndex = Math.max(0, Math.min(scale.length - 1, Math.floor(normalizedY * scale.length)))

  // X축 → 커서 필터 (모드별 범위)
  const normalizedX = Math.max(0, Math.min(1, mouseX / screenWidth))
  if (mode === 'mew') {
    // MEW: 넓고 밝은 필터 스윕
    cursorFilter.frequency.linearRampToValueAtTime(300 + normalizedX * 2500, now + 0.1)
    cursorFilter.Q.linearRampToValueAtTime(2, now + 0.1)
  } else {
    // MEWTWO: 좁고 어두운 필터 → 레조넌스 강조
    cursorFilter.frequency.linearRampToValueAtTime(120 + normalizedX * 900, now + 0.1)
    cursorFilter.Q.linearRampToValueAtTime(6, now + 0.1)
  }

  if (noteIndex !== currentNoteIndex) {
    currentNoteIndex = noteIndex
    const freq = scale[noteIndex]
    cursorOsc.frequency.linearRampToValueAtTime(freq, now + 0.08)

    if (mode === 'mew') {
      cursorGain.gain.linearRampToValueAtTime(0.15, now + 0.05)
      // 서브 오실레이터 끄기
      if (cursorSubGain) cursorSubGain.gain.linearRampToValueAtTime(0, now + 0.1)
    } else {
      // MEWTWO: 메인 볼륨 낮추고, 서브 베이스 활성화
      cursorGain.gain.linearRampToValueAtTime(0.08, now + 0.05)
      if (cursorSubOsc && cursorSubGain) {
        cursorSubOsc.frequency.linearRampToValueAtTime(freq * 0.5, now + 0.08)
        cursorSubGain.gain.linearRampToValueAtTime(0.12, now + 0.05)
      }
    }
  }
}

// ══════════════════════════════════════
//  MEW 사운드
// ══════════════════════════════════════

function playMewCollision(impact, dnaType = 'Normal') {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime
  const freq = DNA_FREQ[dnaType] || DNA_FREQ.Normal
  const vol = Math.min(0.45, 0.06 + impact * 0.035)

  // 벨 톤 + 5도 화음 → 필터 체인으로
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
  osc.connect(gain)
  gain.connect(filterNode)
  osc.start(now)
  osc.stop(now + 0.85)

  // 5도 화음
  const osc2 = audioCtx.createOscillator()
  const gain2 = audioCtx.createGain()
  osc2.type = 'sine'
  osc2.frequency.value = freq * 1.5
  gain2.gain.setValueAtTime(vol * 0.4, now)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
  osc2.connect(gain2)
  gain2.connect(filterNode)
  osc2.start(now)
  osc2.stop(now + 0.65)
}

function playMewBurst() {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime

  const freqs = [523.25, 659.25, 783.99, 880.00, 1046.50]
  freqs.forEach((freq, i) => {
    const t = now + i * 0.1
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    osc.connect(gain)
    gain.connect(filterNode)
    osc.start(t)
    osc.stop(t + 0.3)
  })
}

// ══════════════════════════════════════
//  MEWTWO 사운드
// ══════════════════════════════════════

function makeDistortionCurve(amount = 50) {
  const samples = 44100
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180))
      / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

function playMewtwoCollision(impact) {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime

  // 더 낮은 주파수 — 웅장한 임팩트
  let freq
  if (impact > 15) freq = 35
  else if (impact > 5) freq = 55
  else freq = 80

  const vol = Math.min(0.6, 0.12 + impact * 0.05)

  // 메인 임팩트 — 낮은 sawtooth + 디스토션
  const osc = audioCtx.createOscillator()
  const distortion = audioCtx.createWaveShaper()
  const gain = audioCtx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.value = freq
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.3)
  distortion.curve = makeDistortionCurve(60)
  distortion.oversample = '4x'
  gain.gain.setValueAtTime(vol, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
  osc.connect(distortion)
  distortion.connect(gain)
  gain.connect(masterGain) // 마스터 직결 (필터 우회 → 더 선명)
  osc.start(now)
  osc.stop(now + 0.4)

  // 서브 레이어 — 깊은 sine으로 체감 무게감
  const subOsc = audioCtx.createOscillator()
  const subGain = audioCtx.createGain()
  subOsc.type = 'sine'
  subOsc.frequency.value = freq * 0.5
  subGain.gain.setValueAtTime(vol * 0.8, now)
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
  subOsc.connect(subGain)
  subGain.connect(masterGain)
  subOsc.start(now)
  subOsc.stop(now + 0.5)

  // 메탈릭 링 — 높은 주파수 사인파 (금속성 울림)
  const ringFreq = freq * 12 + Math.random() * 200
  const ringOsc = audioCtx.createOscillator()
  const ringGain = audioCtx.createGain()
  ringOsc.type = 'sine'
  ringOsc.frequency.value = ringFreq
  ringOsc.frequency.exponentialRampToValueAtTime(ringFreq * 0.6, now + 0.4)
  ringGain.gain.setValueAtTime(vol * 0.15, now)
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
  ringOsc.connect(ringGain)
  ringGain.connect(reverbNode) // 리버브로 → 금속 잔향
  ringOsc.start(now)
  ringOsc.stop(now + 0.45)

  // 노이즈 버스트 (임팩트 3 이상이면 발동 — 더 자주)
  if (impact > 3) {
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.1)
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.9
    }
    const noiseSrc = audioCtx.createBufferSource()
    const noiseGain = audioCtx.createGain()
    const noiseFilter = audioCtx.createBiquadFilter()
    noiseSrc.buffer = noiseBuffer
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 150 + impact * 20
    noiseFilter.Q.value = 2
    noiseGain.gain.setValueAtTime(vol * 0.4, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    noiseSrc.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(masterGain)
    noiseSrc.start(now)
    noiseSrc.stop(now + 0.12)
  }
}

// ── 모드 전환음 ──
function playMewtwoModeEnter() {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(2000, now)
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.8)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.linearRampToValueAtTime(0.15, now + 0.1)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
  osc.connect(gain)
  gain.connect(filterNode)
  osc.start(now)
  osc.stop(now + 0.9)

  setAmbientMode('mewtwo')
}

function playMewModeEnter() {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 1.0)
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.1, now + 0.3)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0)
  osc.connect(gain)
  gain.connect(filterNode)
  osc.start(now)
  osc.stop(now + 1.05)

  setAmbientMode('mew')
}

// ── 커서-세포 충돌: 하모닉 플럭 ──
function playFluidCollision(mode = 'mew', dnaType = 'Normal') {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime
  const freq = DNA_FREQ[dnaType] || DNA_FREQ.Normal

  if (mode === 'mew') {
    // 부드러운 플럭 — 펜타토닉 스케일에서 랜덤 2음 화음
    const noteA = SCALE[Math.floor(Math.random() * SCALE.length)]
    const noteB = SCALE[Math.min(SCALE.length - 1, Math.floor(Math.random() * SCALE.length))]

    const osc1 = audioCtx.createOscillator()
    const osc2 = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc1.type = 'sine'
    osc2.type = 'sine'
    osc1.frequency.value = noteA
    osc2.frequency.value = noteB
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(filterNode)
    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.65)
    osc2.stop(now + 0.65)
  } else {
    // 디지털 글리치 — 짧은 피치다운 + 노이즈 찢김
    const osc = audioCtx.createOscillator()
    const dist = audioCtx.createWaveShaper()
    const gain = audioCtx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq * 0.8, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.15, now + 0.15)
    dist.curve = makeDistortionCurve(25)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc.connect(dist)
    dist.connect(gain)
    gain.connect(masterGain)
    osc.start(now)
    osc.stop(now + 0.22)

    // 짧은 고주파 블립 (디지털 스캔 느낌)
    const blip = audioCtx.createOscillator()
    const blipGain = audioCtx.createGain()
    blip.type = 'sine'
    blip.frequency.value = freq * 3
    blipGain.gain.setValueAtTime(0.08, now)
    blipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    blip.connect(blipGain)
    blipGain.connect(reverbNode)
    blip.start(now)
    blip.stop(now + 0.08)
  }
}

// ── 오브끼리 충돌: 하모닉 인터랙션 ──
function playOrbMergeHarmony() {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime

  // 펜타토닉에서 간격 있는 2음 선택
  const indexA = Math.floor(Math.random() * SCALE.length)
  const offset = 1 + Math.floor(Math.random() * 3)
  const indexB = Math.min(SCALE.length - 1, indexA + offset)

  const osc1 = audioCtx.createOscillator()
  const osc2 = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc1.type = 'sine'
  osc2.type = 'sine'
  osc1.frequency.value = SCALE[indexA]
  osc2.frequency.value = SCALE[indexB]
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(filterNode)
  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + 0.55)
  osc2.stop(now + 0.55)
}

// ── MEWTWO 사이킥 폭발 사운드 ──
function playPsychicBlast() {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime

  // 역방향 스윕 — 저음에서 고음으로 빠르게 올라갔다 꺼짐
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(60, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15)
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.5)
  gain.gain.setValueAtTime(0.25, now)
  gain.gain.linearRampToValueAtTime(0.35, now + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  osc.connect(gain)
  gain.connect(filterNode)
  osc.start(now)
  osc.stop(now + 0.55)

  // 사이킥 링 — 높은 sine 펄스
  const ring = audioCtx.createOscillator()
  const ringGain = audioCtx.createGain()
  ring.type = 'sine'
  ring.frequency.setValueAtTime(800, now)
  ring.frequency.exponentialRampToValueAtTime(200, now + 0.4)
  ringGain.gain.setValueAtTime(0.2, now + 0.05)
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
  ring.connect(ringGain)
  ringGain.connect(masterGain)
  ring.start(now)
  ring.stop(now + 0.5)

  // 노이즈 버스트 — 짧고 강한 임팩트
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.1)
  const noiseBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.9
  }
  const noiseSrc = audioCtx.createBufferSource()
  const noiseGain = audioCtx.createGain()
  const noiseFilter = audioCtx.createBiquadFilter()
  noiseSrc.buffer = noiseBuf
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = 300
  noiseFilter.Q.value = 1.0
  noiseGain.gain.setValueAtTime(0.3, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  noiseSrc.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(masterGain)
  noiseSrc.start(now)
  noiseSrc.stop(now + 0.15)
}

// ── MEWTWO 스캔/락온 사운드 ──
function playScanLock() {
  if (!ensureCtx()) return
  const now = audioCtx.currentTime

  // 짧은 디지털 비프 2회
  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.08
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1200 + i * 400
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.connect(gain)
    gain.connect(filterNode)
    osc.start(t)
    osc.stop(t + 0.07)
  }
}

export {
  initAudio,
  updateCursorNote,
  setAmbientMode,
  playMewCollision,
  playMewBurst,
  playMewtwoCollision,
  playMewtwoModeEnter,
  playMewModeEnter,
  playFluidCollision,
  playOrbMergeHarmony,
  playPsychicBlast,
  playScanLock,
}

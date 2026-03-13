/**
 * phantom.js — 초대형 타이포그래피 + 한/영/일 키보드 전환
 * 1) Ghostly Reveal: 고오스 커서 근처에서만 획이 드러남
 * 2) Color Bleed: 커서가 가까울수록 보라색 가스 글로우가 스며듦
 * 3) 키보드 1/2/3으로 한/영/일 전환 (그림자 페이드 애니메이션)
 */

import { getGastlyPos } from './gastly.js';

let offCanvas, offCtx;
let revealRadius = 0;

// ── 언어 전환 ───────────────────────────────────────────
const LANGS = ['팬텀', 'GENGAR', 'ゲンガー'];
const LANG_LABELS = ['한', 'EN', '日'];
const LANG_CODES = ['ko', 'en', 'jp'];

let langIdx = 0;
let prevLangIdx = -1;
let transition = 0;      // 0 = 전환 없음, 1 = 전환 중 최대
let transitionDir = 0;   // 0 = idle, 1 = fade-out 중, 2 = fade-in 중

const CONFIG = {
  fontFamily: '"Noto Sans KR", "Noto Sans JP", "Malgun Gothic", sans-serif',
  fillRatio: 0.85,
  revealRadius: 0.28,
  revealSoftness: 0.55,
  baseColor: [45, 15, 70],
  glowColor: [190, 110, 255],
  maxGlowIntensity: 1.0,
  colorBleedRadius: 0.35,
  letterSpacing: 0.08,
  transitionSpeed: 0.045,
};

// ── 유틸리티 ────────────────────────────────────────────

function calcFontSize(ctx, W, text) {
  let size = W * 0.5;
  ctx.font = `900 ${size}px ${CONFIG.fontFamily}`;
  const measured = ctx.measureText(text).width;
  const targetW = W * CONFIG.fillRatio;
  const spacingExtra = size * CONFIG.letterSpacing * ([...text].length - 1);
  size = size * targetW / (measured + spacingExtra);
  return Math.min(size, W * 0.6);
}

function renderText(ctx, text, cx, cy, fontSize, ghostPos, H, alpha, offsetY) {
  if (alpha < 0.005) return;

  ctx.font = `900 ${fontSize}px ${CONFIG.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = [...text];
  const spacing = fontSize * CONFIG.letterSpacing;

  let totalWidth = 0;
  const charWidths = chars.map(ch => {
    const w = ctx.measureText(ch).width;
    totalWidth += w;
    return w;
  });
  totalWidth += spacing * (chars.length - 1);

  let drawX = cx - totalWidth / 2;
  const bleedRadius = H * CONFIG.colorBleedRadius;
  const time = performance.now() / 1000;

  for (let i = 0; i < chars.length; i++) {
    const charCenterX = drawX + charWidths[i] / 2;

    const cdx = ghostPos.x - charCenterX;
    const cdy = ghostPos.y - (cy + offsetY);
    const charDist = Math.sqrt(cdx * cdx + cdy * cdy);
    const charBleed = Math.max(0, 1 - charDist / bleedRadius);
    const charEased = charBleed * charBleed * (3 - 2 * charBleed);

    const wobble = Math.sin(time * 1.2 + i * 1.8) * fontSize * 0.012 * charEased;

    const cr = Math.round(CONFIG.baseColor[0] + (CONFIG.glowColor[0] - CONFIG.baseColor[0]) * charEased);
    const cg = Math.round(CONFIG.baseColor[1] + (CONFIG.glowColor[1] - CONFIG.baseColor[1]) * charEased);
    const cb = Math.round(CONFIG.baseColor[2] + (CONFIG.glowColor[2] - CONFIG.baseColor[2]) * charEased);

    ctx.save();
    ctx.globalAlpha = alpha;

    const charGlow = charEased * CONFIG.maxGlowIntensity;
    if (charGlow > 0.01) {
      ctx.shadowColor = `rgba(${CONFIG.glowColor[0]}, ${CONFIG.glowColor[1]}, ${CONFIG.glowColor[2]}, ${charGlow * 0.7})`;
      ctx.shadowBlur = fontSize * 0.15 * charGlow;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
    ctx.fillText(chars[i], charCenterX, cy + offsetY + wobble);

    if (charGlow > 0.3) {
      ctx.globalAlpha = alpha * (charGlow - 0.3) * 0.4;
      ctx.shadowBlur = fontSize * 0.3 * charGlow;
      ctx.fillText(chars[i], charCenterX, cy + offsetY + wobble);
    }

    ctx.restore();
    drawX += charWidths[i] + spacing;
  }
}

// ── 언어 변경 콜백 ──────────────────────────────────────
const langChangeListeners = [];

export function onLangChange(fn) {
  langChangeListeners.push(fn);
}

export function getLangIdx() {
  return langIdx;
}

// ── UI 인디케이터 ───────────────────────────────────────

let indicatorItems = [];

function getInitialLang() {
  // 1) URL 해시 우선 (#ko, #en, #jp)
  const hash = location.hash.replace('#', '').toLowerCase();
  const hashIdx = LANG_CODES.indexOf(hash);
  if (hashIdx >= 0) return hashIdx;

  // 2) 브라우저 언어
  const browserLang = (navigator.language || '').toLowerCase();
  if (browserLang.startsWith('ja')) return 2;
  if (browserLang.startsWith('ko')) return 0;
  return 1; // 기본 영어
}

function switchLang(idx) {
  if (idx >= 0 && idx < LANGS.length && idx !== langIdx && transitionDir === 0) {
    prevLangIdx = langIdx;
    langIdx = idx;
    transitionDir = 1;
    transition = 0;
    updateIndicator(idx);
    langChangeListeners.forEach(fn => fn(idx));
    history.replaceState(null, '', '#' + LANG_CODES[idx]);
  }
}

function createUI() {
  const container = document.createElement('div');
  container.className = 'lang-indicator';

  LANG_LABELS.forEach((label, i) => {
    const item = document.createElement('div');
    item.className = 'lang-indicator-item' + (i === langIdx ? ' active' : '');
    item.innerHTML = `<span class="lang-indicator-key">${i + 1}</span>${label}`;
    item.addEventListener('click', () => switchLang(i));
    item.addEventListener('touchend', (e) => {
      e.preventDefault();
      switchLang(i);
    });
    container.appendChild(item);
    indicatorItems.push(item);
  });

  document.body.appendChild(container);
}

function updateIndicator(idx) {
  indicatorItems.forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

// ── Export ───────────────────────────────────────────────

export function initPhantom() {
  offCanvas = document.createElement('canvas');
  offCtx = offCanvas.getContext('2d');

  langIdx = getInitialLang();
  history.replaceState(null, '', '#' + LANG_CODES[langIdx]);

  createUI();

  window.addEventListener('keydown', (e) => {
    const idx = parseInt(e.key) - 1;
    switchLang(idx);
  });
}

initPhantom.draw = function (ctx, canvas) {
  if (!offCanvas) return;

  const W = canvas.width;
  const H = canvas.height;
  const ghostPos = getGastlyPos();
  const cx = W / 2;
  const cy = H / 2;

  if (offCanvas.width !== W || offCanvas.height !== H) {
    offCanvas.width = W;
    offCanvas.height = H;
  }

  // ── 전환 애니메이션 업데이트 ──
  if (transitionDir > 0) {
    transition += CONFIG.transitionSpeed;
    if (transition >= 1) {
      transition = 1;
      if (transitionDir === 1) {
        transitionDir = 2;  // fade-out 끝 → fade-in 시작
        transition = 0;
      } else {
        transitionDir = 0;  // 전환 완료
        transition = 0;
        prevLangIdx = -1;
      }
    }
  }

  offCtx.clearRect(0, 0, W, H);

  // ── 텍스트 렌더링 ──
  if (transitionDir === 1 && prevLangIdx >= 0) {
    // fade-out: 이전 텍스트가 아래로 내려가며 사라짐
    const eased = transition * transition;
    const alpha = 1 - eased;
    const offsetY = eased * H * 0.04;
    const text = LANGS[prevLangIdx];
    const fontSize = calcFontSize(offCtx, W, text);
    renderText(offCtx, text, cx, cy, fontSize, ghostPos, H, alpha, offsetY);
  } else if (transitionDir === 2) {
    // fade-in: 새 텍스트가 위에서 내려오며 나타남
    const eased = transition * transition * (3 - 2 * transition);
    const alpha = eased;
    const offsetY = (1 - eased) * H * -0.04;
    const text = LANGS[langIdx];
    const fontSize = calcFontSize(offCtx, W, text);
    renderText(offCtx, text, cx, cy, fontSize, ghostPos, H, alpha, offsetY);
  } else {
    // 정상 상태
    const text = LANGS[langIdx];
    const fontSize = calcFontSize(offCtx, W, text);
    renderText(offCtx, text, cx, cy, fontSize, ghostPos, H, 1, 0);
  }

  // ── Reveal 마스크 ──
  const targetR = H * CONFIG.revealRadius;
  revealRadius += (targetR - revealRadius) * 0.08;

  offCtx.globalCompositeOperation = 'destination-in';

  const gx = ghostPos.x;
  const gy = ghostPos.y;
  const innerR = revealRadius * (1 - CONFIG.revealSoftness);
  const outerR = revealRadius;

  const mask = offCtx.createRadialGradient(gx, gy, innerR, gx, gy, outerR);
  mask.addColorStop(0, 'rgba(255, 255, 255, 1)');
  mask.addColorStop(1, 'rgba(255, 255, 255, 0)');

  offCtx.fillStyle = mask;
  offCtx.fillRect(0, 0, W, H);
  offCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(offCanvas, 0, 0);
};

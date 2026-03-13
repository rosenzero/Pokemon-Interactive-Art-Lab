/**
 * background.js — 팬텀이 숨어있는 어둠의 공간감 표현
 */

/**
 * 어두운 보라색 배경 + 방사형 글로우 + 심호흡 맥동 + 비네팅
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W - 캔버스 너비
 * @param {number} H - 캔버스 높이
 * @param {number} time - 경과 시간 (초 단위, 맥동 계산용)
 */
export function drawBackground(ctx, W, H, time) {
  const cx = W / 2;
  const cy = H / 2;

  // 1. 기본 배경 — 짙은 보라-검정
  ctx.fillStyle = '#0b0018';
  ctx.fillRect(0, 0, W, H);

  // 2. 보라색 방사형 글로우 (팬텀 위치 중심)
  //    심호흡 효과: opacity를 0.35~0.55 사이에서 느리게 맥동
  const breathe = Math.sin(time * 0.4);
  const glowOpacity = 0.45 + breathe * 0.1; // 0.35 ~ 0.55
  const glowRadius = W * 0.42;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
  glow.addColorStop(0, `rgba(55, 10, 90, ${glowOpacity})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 3. 비네팅 — 가장자리를 순수 검정으로 어둡게
  const vignetteRadius = Math.max(W, H) * 0.55;
  const vignette = ctx.createRadialGradient(cx, cy, vignetteRadius * 0.3, cx, cy, vignetteRadius);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/**
 * main.js 호환용 — initBackground 패턴
 */
export function initBackground(ctx, canvas) {
  // 초기화 시 특별한 작업 없음
}

// main.js의 initBackground.draw?.() 호출 패턴 지원
initBackground.draw = function (ctx, canvas) {
  const time = performance.now() / 1000;
  drawBackground(ctx, canvas.width, canvas.height, time);
};

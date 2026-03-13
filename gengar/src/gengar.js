/**
 * gengar.js — 어둠 속 팬텀의 눈 두 개 + 이빨 웃음
 */

let mouseRef = { x: 0, y: 0 };

// ── 눈 하나를 그리는 함수 ──────────────────────────────
function drawEye(ctx, ex, ey, s, flip, mx, my, time) {
  // flip = -1(왼쪽) or 1(오른쪽)
  ctx.save();
  ctx.translate(ex, ey);

  // 반달 모양: 윗선은 직선 대각선, 아랫선은 크게 볼록
  const w = s * 0.95;
  const h = s * 0.8;
  const slant = s * 0.35; // 기울기 더 강하게

  const innerX = -w * flip;  // 코 쪽 꼭짓점 (아래)
  const innerY = slant;
  const outerX = w * flip;   // 바깥 꼭짓점 (위)
  const outerY = -slant;

  // 눈 형태 path
  ctx.beginPath();
  ctx.moveTo(innerX, innerY);
  // 윗선 — 거의 직선 대각선
  ctx.bezierCurveTo(
    innerX + (outerX - innerX) * 0.33, innerY + (outerY - innerY) * 0.33 - h * 0.05,
    innerX + (outerX - innerX) * 0.66, innerY + (outerY - innerY) * 0.66 - h * 0.03,
    outerX, outerY
  );
  // 아랫선 — 크게 볼록한 반달
  ctx.bezierCurveTo(
    innerX + (outerX - innerX) * 0.7, outerY + h * 1.25,
    innerX + (outerX - innerX) * 0.3, innerY + h * 1.0,
    innerX, innerY
  );
  ctx.closePath();

  // 눈 글로우
  ctx.shadowColor = 'rgba(245, 120, 80, 0.5)';
  ctx.shadowBlur = s * 0.6;

  // 살몬/코랄 그라디언트
  const eyeGrad = ctx.createRadialGradient(
    0, h * 0.15, 0,
    0, 0, w * 0.95
  );
  eyeGrad.addColorStop(0, '#f8a88a');   // 밝은 살몬 중심
  eyeGrad.addColorStop(0.5, '#f08868'); // 코랄
  eyeGrad.addColorStop(0.85, '#d86a55');
  eyeGrad.addColorStop(1, '#c05545');
  ctx.fillStyle = eyeGrad;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // --- 동공 (마우스 추적) ---
  const dx = mx - ex;
  const dy = my - ey;
  const angle = Math.atan2(dy, dx);
  const dist = Math.min(Math.sqrt(dx * dx + dy * dy), w * 3);
  const maxOffset = w * 0.2;
  const ratio = dist / (w * 3);
  const px = Math.cos(angle) * maxOffset * ratio;
  const py = Math.sin(angle) * maxOffset * ratio;

  // 동공 — 세로 슬릿
  ctx.save();
  ctx.clip();

  // 동공 위치: 눈 중심 약간 아래 (아랫선이 볼록하므로)
  const pupilCx = px;
  const pupilCy = h * 0.12 + py;
  const pupilW = s * 0.1;
  const pupilH = s * 0.3;

  ctx.beginPath();
  ctx.ellipse(pupilCx, pupilCy, pupilW, pupilH, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#12000a';
  ctx.fill();

  // 동공 하이라이트
  ctx.beginPath();
  ctx.ellipse(
    pupilCx - pupilW * 0.4, pupilCy - pupilH * 0.25,
    pupilW * 0.25, pupilW * 0.2, 0, 0, Math.PI * 2
  );
  ctx.fillStyle = 'rgba(255, 210, 190, 0.3)';
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

// ── 이빨 웃음을 그리는 함수 ──────────────────────────────
function drawGrin(ctx, cx, cy, s, time) {
  ctx.save();
  ctx.translate(cx, cy);

  const grinW = s * 4.8;   // 눈 바깥 끝까지 닿는 넓이
  const grinH = s * 1.4;   // 입 높이

  const tremble = Math.sin(time * 1.2) * s * 0.006;

  // 초승달 형태: 양쪽 끝이 높이 올라가고 가운데가 낮은 웃는 입
  const endY = -grinH * 0.45 + tremble; // 양 끝이 많이 올라감

  // --- 입 외곽 (초승달 웃음) ---
  ctx.beginPath();
  ctx.moveTo(-grinW / 2, endY);
  // 윗선: 양쪽이 높고 가운데가 약간 아래로 — 완만한 U자
  ctx.bezierCurveTo(
    -grinW * 0.2, grinH * 0.05,
    grinW * 0.2, grinH * 0.05,
    grinW / 2, endY
  );
  // 아랫선: 더 깊게 볼록 — 초승달 아래쪽
  ctx.bezierCurveTo(
    grinW * 0.25, grinH * 0.95,
    -grinW * 0.25, grinH * 0.95,
    -grinW / 2, endY
  );
  ctx.closePath();

  // 입 안쪽 어둠
  ctx.fillStyle = '#0a0010';
  ctx.shadowColor = 'rgba(100, 0, 60, 0.4)';
  ctx.shadowBlur = s * 0.3;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // --- 이빨 (4개, 넓은 직사각형 블록) ---
  ctx.save();
  ctx.clip();

  const teethCount = 6;
  const teethW = grinW * 1.1;
  const toothW = teethW / teethCount;
  const startX = -teethW / 2;

  // 이빨 전체를 하나의 흰색 블록으로 채우기 (틈 없이)
  ctx.fillStyle = '#ede6ed';
  ctx.fillRect(-teethW / 2, -grinH * 0.6, teethW, grinH * 1.8);

  // 세로 구분선만 그리기
  ctx.strokeStyle = 'rgba(90, 70, 100, 0.4)';
  ctx.lineWidth = s * 0.025;
  for (let i = 1; i < teethCount; i++) {
    const lx = startX + i * toothW;
    ctx.beginPath();
    ctx.moveTo(lx, -grinH * 0.6);
    ctx.lineTo(lx, grinH * 1.2);
    ctx.stroke();
  }

  ctx.restore();

  // --- 입 외곽선 (초승달과 동일한 path) ---
  ctx.beginPath();
  ctx.moveTo(-grinW / 2, endY);
  ctx.bezierCurveTo(
    -grinW * 0.2, grinH * 0.05,
    grinW * 0.2, grinH * 0.05,
    grinW / 2, endY
  );
  ctx.bezierCurveTo(
    grinW * 0.25, grinH * 0.95,
    -grinW * 0.25, grinH * 0.95,
    -grinW / 2, endY
  );
  ctx.closePath();
  ctx.strokeStyle = 'rgba(60, 15, 50, 0.5)';
  ctx.lineWidth = s * 0.035;
  ctx.stroke();

  // 입꼬리 올라감
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const ecx = (grinW / 2) * side;
    ctx.moveTo(ecx, endY);
    ctx.quadraticCurveTo(
      ecx + s * 0.12 * side, endY - s * 0.15,
      ecx + s * 0.06 * side, endY - s * 0.22
    );
    ctx.strokeStyle = 'rgba(60, 15, 50, 0.4)';
    ctx.lineWidth = s * 0.03;
    ctx.stroke();
  }

  ctx.restore();
}

// ── 메인 드로우 함수 ──────────────────────────────────
export function drawGengar(ctx, W, H, time, mouse) {
  const cx = W / 2;
  const cy = H / 2;
  const s = Math.min(W, H) * 0.09;

  const mx = mouse ? mouse.x : cx;
  const my = mouse ? mouse.y : cy;

  // 눈 위치: 서로 가깝게, 입 바로 위
  const eyeSpacing = s * 1.35;
  const eyeY = cy - s * 1.1;

  drawEye(ctx, cx - eyeSpacing, eyeY, s, -1, mx, my, time);
  drawEye(ctx, cx + eyeSpacing, eyeY, s, 1, mx, my, time);

  // 입: 눈 아래 여유 있게
  const grinY = cy + s * 0.65;
  drawGrin(ctx, cx, grinY, s, time);
}

// ── main.js 호환 ──────────────────────────────────────
export function initGengar(ctx, canvas) {
  window.addEventListener('mousemove', (e) => {
    mouseRef.x = e.clientX;
    mouseRef.y = e.clientY;
  });
  window.addEventListener('touchmove', (e) => {
    mouseRef.x = e.targetTouches[0].clientX;
    mouseRef.y = e.targetTouches[0].clientY;
  });
  window.addEventListener('touchstart', (e) => {
    mouseRef.x = e.targetTouches[0].clientX;
    mouseRef.y = e.targetTouches[0].clientY;
  });
  mouseRef.x = canvas.width / 2;
  mouseRef.y = canvas.height / 2;
}

initGengar.draw = function (ctx, canvas) {
  const time = performance.now() / 1000;
  drawGengar(ctx, canvas.width, canvas.height, time, mouseRef);
};

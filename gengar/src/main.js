import { initBackground } from './background.js';
import { initPhantom } from './phantom.js';
import { initGengar } from './gengar.js';
import { initGastly } from './gastly.js';
import { initPokedex } from './pokedex.js';

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

initBackground(ctx, canvas);
initPhantom();
initGengar(ctx, canvas);
initGastly(ctx, canvas, mouse);
initPokedex();

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  initBackground.draw?.(ctx, canvas);
  initPhantom.draw?.(ctx, canvas);
  initGengar.draw?.(ctx, canvas);
  initGastly.draw?.();

  requestAnimationFrame(animate);
}

animate();

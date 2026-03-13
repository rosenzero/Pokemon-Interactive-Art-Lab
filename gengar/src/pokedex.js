/**
 * pokedex.js — 도감 모달 (한/영/일 언어 연동)
 * 우상단 DEX 버튼 클릭 시 팬텀 도감 카드 표시
 */

import meta from '../meta.json';
import { getLangIdx, onLangChange } from './phantom.js';
import { getGastlyPos } from './gastly.js';

let overlay, card, btn, btnIcon;
let isOpen = false;
let isHovering = false;

const BTN_LABELS = ['도감', 'DEX', '図鑑'];

// ── 언어별 콘텐츠 ────────────────────────────────────────

const CONTENT = {
  ko: {
    name: meta.name,
    sub: `${meta.nameEn} · ${meta.nameJa}`,
    types: ['고스트', '독'],
    category: '그림자 포켓몬',
    height: '1.5m',
    weight: '40.5kg',
    desc: '어둠에 떠있는 웃는 얼굴의 정체는 사람에게 저주를 걸고 기뻐하는 팬텀이다.',
    labelCategory: '분류',
    labelHeight: '높이',
    labelWeight: '몸무게',
  },
  en: {
    name: meta.nameEn,
    sub: `${meta.name} · ${meta.nameJa}`,
    types: ['Ghost', 'Poison'],
    category: 'Shadow Pokémon',
    height: '4\'11"',
    weight: '89.3 lbs',
    desc: 'The smiling face floating in the darkness is Gengar, who delights in cursing people.',
    labelCategory: 'Category',
    labelHeight: 'Height',
    labelWeight: 'Weight',
  },
  jp: {
    name: meta.nameJa,
    sub: `${meta.name} · ${meta.nameEn}`,
    types: ['ゴースト', 'どく'],
    category: 'シャドーポケモン',
    height: '1.5m',
    weight: '40.5kg',
    desc: '闇に浮かぶ笑顔の正体は、人に呪いをかけて喜ぶゲンガーだ。',
    labelCategory: '分類',
    labelHeight: '高さ',
    labelWeight: '重さ',
  },
};

const LANG_KEYS = ['ko', 'en', 'jp'];

const TYPE_COLORS = {
  '고스트': '#7b62a8', '독': '#a040a0',
  'Ghost': '#7b62a8', 'Poison': '#a040a0',
  'ゴースト': '#7b62a8', 'どく': '#a040a0',
};

// ── DOM ──────────────────────────────────────────────────

function buildCard(lang) {
  const c = CONTENT[lang];
  const typeHTML = c.types
    .map(t => `<span class="pokedex-type" style="background:${TYPE_COLORS[t] || '#888'}">${t}</span>`)
    .join('');

  return `
    <div class="pokedex-header">
      <span class="pokedex-number">#${String(meta.id).padStart(3, '0')}</span>
      <button class="pokedex-close">&times;</button>
    </div>
    <div class="pokedex-sprite">
      <img src="${import.meta.env.BASE_URL}pixel_gengar.png" alt="${c.name}" class="pokedex-sprite-img" />
    </div>
    <div class="pokedex-names">
      <div class="pokedex-name-main">${c.name}</div>
      <div class="pokedex-name-sub">${c.sub}</div>
    </div>
    <div class="pokedex-types">${typeHTML}</div>
    <div class="pokedex-divider"></div>
    <div class="pokedex-info">
      <div class="pokedex-row">
        <span class="pokedex-label">${c.labelCategory}</span>
        <span class="pokedex-value">${c.category}</span>
      </div>
      <div class="pokedex-row">
        <span class="pokedex-label">${c.labelHeight}</span>
        <span class="pokedex-value">${c.height}</span>
      </div>
      <div class="pokedex-row">
        <span class="pokedex-label">${c.labelWeight}</span>
        <span class="pokedex-value">${c.weight}</span>
      </div>
    </div>
    <div class="pokedex-essence">${c.desc}</div>
  `;
}

function updateCard(langIdx) {
  const lang = LANG_KEYS[langIdx] || 'ko';
  card.innerHTML = buildCard(lang);
  card.querySelector('.pokedex-close').addEventListener('click', close);
}

function createDOM() {
  overlay = document.createElement('div');
  overlay.className = 'pokedex-overlay';

  card = document.createElement('div');
  card.className = 'pokedex-card';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  updateCard(getLangIdx());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });
}

function open() {
  if (isOpen) return;
  isOpen = true;
  updateCard(getLangIdx());
  overlay.classList.add('active');
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  overlay.classList.remove('active');
}

// ── 유령 hover 감지 ──────────────────────────────────────

function isGhostNear(el) {
  const rect = el.getBoundingClientRect();
  const pos = getGastlyPos();
  const ghostR = window.innerHeight * 0.13;
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  const dx = pos.x - cx;
  const dy = pos.y - cy;
  return Math.sqrt(dx * dx + dy * dy) < ghostR;
}

function checkGhostHover() {
  if (!btn) return;
  const pos = getGastlyPos();
  const nearBtn = isGhostNear(btn);

  // 버튼에 유령이 가까우면 열기
  if (nearBtn && !isHovering && !isOpen) {
    isHovering = true;
    btn.classList.add('ghost-hover');
    open();
  } else if (!nearBtn && isHovering) {
    isHovering = false;
    btn.classList.remove('ghost-hover');
  }

  // 도감이 열려있을 때, 유령이 카드와 버튼 모두에서 멀어지면 닫기
  if (isOpen && card) {
    const nearCard = isGhostNear(card);
    if (!nearBtn && !nearCard) {
      close();
    }
  }

  requestAnimationFrame(checkGhostHover);
}

// ── Export ────────────────────────────────────────────────

export function initPokedex() {
  createDOM();

  // 언어 변경 시 도감 내용 + 버튼 텍스트 갱신
  onLangChange((idx) => {
    updateCard(idx);
    btnIcon.textContent = BTN_LABELS[idx] || BTN_LABELS[0];
  });

  // 우상단 도감 버튼
  btn = document.createElement('button');
  btn.className = 'pokedex-btn';
  const initLabel = BTN_LABELS[getLangIdx()] || BTN_LABELS[0];
  btn.innerHTML = `<span class="pokedex-btn-icon">${initLabel}</span>`;
  btnIcon = btn.querySelector('.pokedex-btn-icon');
  btn.addEventListener('click', () => { if (!isOpen) open(); else close(); });
  document.body.appendChild(btn);

  // 유령 커서 hover 감지 루프
  requestAnimationFrame(checkGhostHover);
}

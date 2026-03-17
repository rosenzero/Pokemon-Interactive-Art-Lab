/**
 * pokedex.js — 도감 모달 (한/영/일 언어 연동)
 * 우상단 DEX 버튼 클릭으로 뮤/뮤츠 도감 카드 표시
 * 모드에 따라 표시되는 포켓몬이 다름 (mew → 뮤, mewtwo → 뮤츠)
 */

import meta from '../meta.json'
import { getLangIdx, onLangChange } from './lang.js'
import { getMode, toggleMode } from './modes.js'
import {
  playMewtwoModeEnter, playMewModeEnter,
} from './sound.js'

let overlay, card, btn, dnaBtn
let isOpen = false

// ── 언어별 콘텐츠 ──

const CONTENT = {
  mew: {
    ko: {
      name: '뮤',
      sub: 'Mew · ミュウ',
      number: '#151',
      types: ['에스퍼'],
      category: '신종 포켓몬',
      height: '0.4m',
      weight: '4.0kg',
      desc: '모든 포켓몬의 유전자를 갖고 있어 온갖 기술을 사용할 수 있다고 한다.',
      labelCategory: '분류',
      labelHeight: '높이',
      labelWeight: '몸무게',
    },
    en: {
      name: 'Mew',
      sub: '뮤 · ミュウ',
      number: '#151',
      types: ['Psychic'],
      category: 'New Species Pokémon',
      height: '1\'04"',
      weight: '8.8 lbs',
      desc: 'Said to possess the genes of every Pokémon, enabling it to learn any move.',
      labelCategory: 'Category',
      labelHeight: 'Height',
      labelWeight: 'Weight',
    },
    jp: {
      name: 'ミュウ',
      sub: '뮤 · Mew',
      number: '#151',
      types: ['エスパー'],
      category: 'しんしゅポケモン',
      height: '0.4m',
      weight: '4.0kg',
      desc: 'すべてのポケモンの遺伝子を持つと言われ、あらゆる技を使えるという。',
      labelCategory: '分類',
      labelHeight: '高さ',
      labelWeight: '重さ',
    },
  },
  mewtwo: {
    ko: {
      name: '뮤츠',
      sub: 'Mewtwo · ミュウツー',
      number: '#150',
      types: ['에스퍼'],
      category: '유전 포켓몬',
      height: '2.0m',
      weight: '122.0kg',
      desc: '유전자 조작으로 만들어진 포켓몬. 하지만 뮤처럼 부드러운 마음을 만들 수는 없었다.',
      labelCategory: '분류',
      labelHeight: '높이',
      labelWeight: '몸무게',
    },
    en: {
      name: 'Mewtwo',
      sub: '뮤츠 · ミュウツー',
      number: '#150',
      types: ['Psychic'],
      category: 'Genetic Pokémon',
      height: '6\'07"',
      weight: '269.0 lbs',
      desc: 'A Pokémon created by genetic manipulation. However, scientists failed to give it a compassionate heart like Mew\'s.',
      labelCategory: 'Category',
      labelHeight: 'Height',
      labelWeight: 'Weight',
    },
    jp: {
      name: 'ミュウツー',
      sub: '뮤츠 · Mewtwo',
      number: '#150',
      types: ['エスパー'],
      category: 'いでんしポケモン',
      height: '2.0m',
      weight: '122.0kg',
      desc: '遺伝子操作によって作られたポケモン。だがミュウのような穏やかな心を作ることはできなかった。',
      labelCategory: '分類',
      labelHeight: '高さ',
      labelWeight: '重さ',
    },
  },
}

const LANG_KEYS = ['ko', 'en', 'jp']

const TYPE_COLORS = {
  '에스퍼': '#f95587',
  'Psychic': '#f95587',
  'エスパー': '#f95587',
}

// ── DOM 생성 ──

function buildCard(lang, mode) {
  const c = CONTENT[mode][lang]
  const sprite = mode === 'mew'
    ? `${import.meta.env.BASE_URL}mew_pixel.png`
    : `${import.meta.env.BASE_URL}mewtwo_pixel.png`

  const typeHTML = c.types
    .map(t => `<span class="pokedex-type" style="background:${TYPE_COLORS[t] || '#888'}">${t}</span>`)
    .join('')

  const isMewtwo = mode === 'mewtwo'
  const accentColor = isMewtwo ? '0, 255, 247' : '255, 179, 222'
  const accentHex = isMewtwo ? '#00fff7' : '#ffb3de'

  return `
    <div class="pokedex-header">
      <span class="pokedex-number" style="color: rgba(${accentColor}, 0.6)">${c.number}</span>
      <button class="pokedex-close" style="color: rgba(${accentColor}, 0.4)">&times;</button>
    </div>
    <div class="pokedex-sprite">
      <img src="${sprite}" alt="${c.name}" class="pokedex-sprite-img"
           style="filter: drop-shadow(0 0 12px rgba(${accentColor}, 0.3))" />
    </div>
    <div class="pokedex-names">
      <div class="pokedex-name-main">${c.name}</div>
      <div class="pokedex-name-sub">${c.sub}</div>
    </div>
    <div class="pokedex-types">${typeHTML}</div>
    <div class="pokedex-divider" style="background: linear-gradient(90deg, transparent, rgba(${accentColor}, 0.3), transparent)"></div>
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
  `
}

function updateCard(langIdx) {
  const lang = LANG_KEYS[langIdx] || 'ko'
  const mode = getMode()
  card.innerHTML = buildCard(lang, mode)
  card.querySelector('.pokedex-close').addEventListener('click', close)

  // 모드에 따라 카드 테마 적용
  const isMewtwo = mode === 'mewtwo'
  card.classList.toggle('pokedex-card--mewtwo', isMewtwo)
  card.classList.toggle('pokedex-card--mew', !isMewtwo)
}

function createDOM() {
  overlay = document.createElement('div')
  overlay.className = 'pokedex-overlay'

  card = document.createElement('div')
  card.className = 'pokedex-card'

  overlay.appendChild(card)
  document.body.appendChild(overlay)

  updateCard(getLangIdx())

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close()
  })
}

function open() {
  if (isOpen) return
  isOpen = true
  updateCard(getLangIdx())
  overlay.classList.add('active')
}

function close() {
  if (!isOpen) return
  isOpen = false
  overlay.classList.remove('active')
}

// ── Export ──

// ── SVG 아이콘 ──
// Font Awesome 6 — book-open (CC BY 4.0)
const ICON_POKEDEX = `<svg viewBox="0 0 576 512" width="18" height="18" fill="currentColor">
  <path d="M249.6 471.5c10.8 3.8 22.4-4.1 22.4-15.5l0-377.4c0-4.2-1.6-8.4-5-11C247.4 52 202.4 32 144 32C93.5 32 46.3 45.3 18.1 56.1C6.8 60.5 0 71.7 0 83.8L0 454.1c0 11.9 12.8 20.2 24.1 16.5C55.6 460.1 105.5 448 144 448c33.9 0 79 14 105.6 23.5zm76.8 0C353 462 398.1 448 432 448c38.5 0 88.4 12.1 119.9 22.6c11.3 3.8 24.1-4.6 24.1-16.5l0-370.3c0-12.1-6.8-23.3-18.1-27.6C529.7 45.3 482.5 32 432 32c-58.4 0-103.4 20-123 35.6c-3.3 2.6-5 6.8-5 11L304 456c0 11.4 11.7 19.3 22.4 15.5z"/>
</svg>`

// Font Awesome 6 — dna (CC BY 4.0)
const ICON_DNA = `<svg viewBox="0 0 448 512" width="18" height="18" fill="currentColor">
  <path d="M416 0c17.7 0 32 14.3 32 32c0 59.8-30.3 107.5-69.4 146.6c-28 28-62.5 53.5-97.3 77.4l-2.5 1.7c-11.9 8.1-23.8 16.1-35.5 23.9l-1.6 1c-6 4-11.9 7.9-17.8 11.9c-20.9 14-40.8 27.7-59.3 41.5l118.5 0c-9.8-7.4-20.1-14.7-30.7-22.1l7-4.7 3-2c15.1-10.1 30.9-20.6 46.7-31.6c25 18.1 48.9 37.3 69.4 57.7C417.7 372.5 448 420.2 448 480c0 17.7-14.3 32-32 32s-32-14.3-32-32L64 480c0 17.7-14.3 32-32 32s-32-14.3-32-32c0-59.8 30.3-107.5 69.4-146.6c28-28 62.5-53.5 97.3-77.4c-34.8-23.9-69.3-49.3-97.3-77.4C30.3 139.5 0 91.8 0 32C0 14.3 14.3 0 32 0S64 14.3 64 32l320 0c0-17.7 14.3-32 32-32zM338.6 384l-229.2 0c-10.1 10.6-18.6 21.3-25.5 32l280.2 0c-6.8-10.7-15.3-21.4-25.5-32zM109.4 128l229.2 0c10.1-10.7 18.6-21.3 25.5-32L83.9 96c6.8 10.7 15.3 21.3 25.5 32zm55.4 48c18.4 13.8 38.4 27.5 59.3 41.5c20.9-14 40.8-27.7 59.3-41.5l-118.5 0z"/>
</svg>`

export function initPokedex() {
  createDOM()

  // 언어 변경 시 도감 내용 갱신
  onLangChange((idx) => {
    updateCard(idx)
  })

  // 우상단 버튼 그룹
  const group = document.createElement('div')
  group.className = 'top-btn-group'

  // 도감 버튼 (아이콘)
  btn = document.createElement('button')
  btn.className = 'icon-btn pokedex-btn'
  btn.innerHTML = ICON_POKEDEX
  btn.title = 'Pokédex'
  btn.addEventListener('click', () => { if (!isOpen) open(); else close() })
  group.appendChild(btn)

  // DNA 전환 버튼
  dnaBtn = document.createElement('button')
  dnaBtn.className = 'icon-btn dna-btn'
  dnaBtn.id = 'btn-alter'
  dnaBtn.innerHTML = ICON_DNA
  dnaBtn.title = 'Sequence: Alter'
  dnaBtn.addEventListener('click', () => {
    const mode = getMode()
    if (mode === 'mew') playMewtwoModeEnter()
    else playMewModeEnter()
    toggleMode()
  })
  group.appendChild(dnaBtn)

  document.body.appendChild(group)
}

// 모드 전환 시 외부에서 호출하여 도감 내용 갱신
export function refreshPokedex() {
  if (card) updateCard(getLangIdx())
}

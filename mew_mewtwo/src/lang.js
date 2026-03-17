/**
 * lang.js — 한/영/일 언어 전환 시스템
 * 키보드 1/2/3 또는 클릭으로 전환, URL 해시 연동
 */

import { getMode } from './modes.js'

const LANG_LABELS = ['한', 'EN', '日']
const LANG_CODES = ['ko', 'en', 'jp']

let langIdx = 0
const langChangeListeners = []
let indicatorItems = []

// ── 초기 언어 감지 ──
function getInitialLang() {
  const hash = location.hash.replace('#', '').toLowerCase()
  const hashIdx = LANG_CODES.indexOf(hash)
  if (hashIdx >= 0) return hashIdx

  const browserLang = (navigator.language || '').toLowerCase()
  if (browserLang.startsWith('ja')) return 2
  if (browserLang.startsWith('ko')) return 0
  return 1
}

// ── 언어 전환 ──
function switchLang(idx) {
  if (idx >= 0 && idx < LANG_LABELS.length && idx !== langIdx) {
    langIdx = idx
    updateIndicator(idx)
    langChangeListeners.forEach(fn => fn(idx))
    history.replaceState(null, '', '#' + LANG_CODES[idx])
  }
}

// ── UI 인디케이터 (우하단) ──
function createUI() {
  const container = document.createElement('div')
  container.className = 'lang-indicator'

  LANG_LABELS.forEach((label, i) => {
    const item = document.createElement('div')
    item.className = 'lang-indicator-item' + (i === langIdx ? ' active' : '')
    item.innerHTML = `<span class="lang-indicator-key">${i + 1}</span>${label}`
    item.addEventListener('click', () => switchLang(i))
    item.addEventListener('touchend', (e) => {
      e.preventDefault()
      switchLang(i)
    })
    container.appendChild(item)
    indicatorItems.push(item)
  })

  document.body.appendChild(container)
}

function updateIndicator(idx) {
  indicatorItems.forEach((el, i) => {
    el.classList.toggle('active', i === idx)
  })
}

// ── Export ──
export function getLangIdx() {
  return langIdx
}

export function onLangChange(fn) {
  langChangeListeners.push(fn)
}

export function initLang() {
  langIdx = getInitialLang()
  history.replaceState(null, '', '#' + LANG_CODES[langIdx])
  createUI()

  window.addEventListener('keydown', (e) => {
    const idx = parseInt(e.key) - 1
    switchLang(idx)
  })
}

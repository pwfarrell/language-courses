'use strict';
/* =========================================================
   Shared course engine: skill tree, lessons, levels, review
   Needs CFG (course config) and COURSE (course text) first.
   ========================================================= */

/* ---------- parse the course text ---------- */
const SECTIONS = [], UNITS = [], LESSONS = [], ALLW = [], SENTS = [];
const splitAlts = s => (s || '').split('/').map(x => x.trim()).filter(Boolean);
const tok = s => s.replace(/[.,!?;:"“”()]/g, ' ').split(/\s+/).filter(Boolean);
const parseTiles = src => src.split(' + ').map(p => {
  const i = p.indexOf('=');
  return i < 0 ? { t: p.trim(), rom: '' } : { t: p.slice(0, i).trim(), rom: p.slice(i + 1).trim() };
});
(() => {
  let sec = null, u = null, l = null;
  const keys = new Set();
  COURSE.split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line || line.startsWith('//')) return;
    const f = line.split('|').map(x => x.trim());
    const tag = f[0];
    if (tag === 'S') { sec = { n: SECTIONS.length + 1, title: f[1], native: f[2] || '', units: [] }; SECTIONS.push(sec); }
    else if (tag === 'U') {
      u = { n: UNITS.length + 1, title: f[1], native: f[2] || '', icon: f[3] || 'chat', tip: f[4] || '', nativeRom: f[5] || '', guide: [], lessons: [], sec };
      UNITS.push(u); sec.units.push(u);
    }
    else if (tag === 'G') u.guide.push({ p: f[1], ex: [] });
    else if (tag === 'X') { if (!u.guide.length) u.guide.push({ p: '', ex: [] }); u.guide[u.guide.length - 1].ex.push({ t: f[1], en: f[2], rom: f[3] || '' }); }
    else if (tag === 'L') {
      l = { id: 'u' + u.n + 'l' + (u.lessons.length + 1), n: u.lessons.length + 1, title: f[1], script: f[2] === 'script', words: [], sentences: [], unit: u };
      u.lessons.push(l); LESSONS.push(l);
    }
    else if (tag === 'w') {
      let key = f[1].toLowerCase();
      if (keys.has(key)) key += '#' + f[2];
      keys.add(key);
      const w = { key, t: f[1], en: f[2], note: f[3] || '', alts: splitAlts(f[4]), rom: f[5] || '', digit: f[6] || '', script: l.script, unit: u.n, lesson: l.id };
      ALLW.push(w); l.words.push(w);
    }
    else if (tag === 's') {
      const explicit = f[1].includes('=');
      const s = { en: f[2], tAlts: splitAlts(f[3]), enAlts: splitAlts(f[4]), explicit, extras: f[5] ? parseTiles(f[5]) : null, unit: u.n, lesson: l.id };
      if (explicit) { s.tiles = parseTiles(f[1]); s.text = s.tiles.map(x => x.t).join(' '); }
      else s.text = f[1];
      SENTS.push(s); l.sentences.push(s);
    }
  });
})();

/* tiles: keep capitals only on names and titles */
const PROPER = { t: new Set(CFG.properBase || []), en: new Set(['I', 'OK']) };
SENTS.forEach(s => {
  if (!s.explicit) [s.text, ...s.tAlts].forEach(x => tok(x).slice(1).forEach(t => { if (/^[A-Z]/.test(t)) PROPER.t.add(t); }));
  [s.en, ...s.enAlts].forEach(x => tok(x).slice(1).forEach(t => { if (/^[A-Z]/.test(t)) PROPER.en.add(t); }));
});
const keepCase = (t, lang) => PROPER[lang].has(t) || /^[A-Z]{2}/.test(t);
const disp = (t, i, lang) => (i === 0 && !keepCase(t, lang)) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
const J = '\u0001';
SENTS.forEach(s => {
  if (!s.explicit) s.tiles = tok(s.text).map((t, i) => ({ t: disp(t, i, 't'), rom: '' }));
  s.tTargets = [s.tiles.map(x => x.t).join(J).toLowerCase(), ...s.tAlts.map(a => tok(a).join(J).toLowerCase())];
  s.enTiles = tok(s.en).map((t, i) => ({ t: disp(t, i, 'en'), rom: '' }));
  s.enTargets = [s.enTiles.map(x => x.t).join(J).toLowerCase(), ...s.enAlts.map(a => tok(a).join(J).toLowerCase())];
  s.rom = s.tiles.map(x => x.rom).filter(Boolean).join(' ');
});

/* skill tree rows: 1, 2, 1, 2 ... inside each section */
const ROWS = [];
SECTIONS.forEach(sec => {
  let i = 0, wide = false;
  while (i < sec.units.length) {
    const n = Math.min(wide ? 2 : 1, sec.units.length - i);
    const row = { sec, units: sec.units.slice(i, i + n), idx: ROWS.length };
    row.units.forEach(u => { u.row = row.idx; });
    ROWS.push(row); i += n; wide = !wide;
  }
});

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function rich(s) {
  let h = esc(s);
  if (CFG.scriptRe) h = h.replace(CFG.scriptRe, m => '<span class="t">' + m + '</span>');
  return h.replace(/\*(.+?)\*/g, '<b class="t em">$1</b>');
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
const GOAL = 30, MAXL = 5;
const norm = s => s.toLowerCase().replace(/[-‐–]/g, ' ').replace(/[.,!?;:"“”'’()]/g, '').replace(/\s+/g, ' ').trim();
const glossParts = en => en.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[,;/]/).map(x => x.trim().replace(/^to /, '').replace(/[?!.]/g, '').trim()).filter(Boolean);
const overlaps = (a, b) => { const pa = glossParts(a.en), pb = glossParts(b.en); return pa.some(p => pb.includes(p)); };
const typeable = w => CFG.typing && !w.script && !/^\(/.test(w.en);
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const ICON = {
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.4 2.2c.5 3.2-1.7 4.6-1.7 7 0 1.1.7 1.9 1.6 1.9 1.4 0 2-1.3 1.7-3.3 2.4 1.7 4.2 4.5 4.2 7.4A7.2 7.2 0 0 1 12 22a7.2 7.2 0 0 1-7.2-6.9c0-3.5 2.2-5.7 4-7.5 1.8-1.8 3.6-3.4 4.6-5.4z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.8 5.9 6.5.8-4.8 4.5 1.3 6.4L12 17l-5.8 3.2 1.3-6.4-4.8-4.5 6.5-.8z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.8 7.6l4.9 3.8L12 4.6l4.3 6.8 4.9-3.8-1.9 11.2H4.7z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.6-4.7-9.5-9.3C1.1 8.3 3.4 4.8 6.9 4.8c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.5 0 5.8 3.5 4.4 6.9C19.6 16.3 12 21 12 21z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.6l4.6 4.6L19.2 7.4" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  okCircle: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="currentColor"/><path class="mk" d="M11.5 20.5l5.5 5.5 11.5-12" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  badCircle: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="currentColor"/><path class="mk" d="M13.5 13.5l13 13M26.5 13.5l-13 13" fill="none" stroke-width="4" stroke-linecap="round"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 9.2v5.6h3.8l5 4.2V5l-5 4.2z"/><path d="M15.6 8.6a4.8 4.8 0 0 1 0 6.8M18.2 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  tree: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="3.2" fill="currentColor"/><circle cx="6" cy="13" r="3.2" fill="currentColor"/><circle cx="18" cy="13" r="3.2" fill="currentColor"/><circle cx="12" cy="20" r="2.6" fill="currentColor"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 5A1.8 1.8 0 0 1 5.3 3.2H11v17.6H5.3a1.8 1.8 0 0 1-1.8-1.8zM13 3.2h5.7A1.8 1.8 0 0 1 20.5 5v14a1.8 1.8 0 0 1-1.8 1.8H13z"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4h11.5l-2.4 4.2L17 12.5H5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
};
/* skill icons: 24px stroke drawings */
const SKILL_ICON = {
  chat: '<path d="M4 4.5h16v11.5H10.5L5 20.5V16H4z"/>',
  chats: '<path d="M2.5 3.5h12.5v8.5H8l-3.5 3v-3h-2z"/><path d="M18 8h3.5v8.5h-2v3l-3.5-3H10v-2"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M2.8 20c0-3.6 2.8-6.4 6.2-6.4s6.2 2.8 6.2 6.4"/><circle cx="17.2" cy="9" r="2.5"/><path d="M16.6 13.8c2.7.2 4.6 2.6 4.6 5.4"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  pin: '<path d="M12 21.2s-7-6.3-7-11.7a7 7 0 0 1 14 0c0 5.4-7 11.7-7 11.7z"/><circle cx="12" cy="9.5" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2.1"/>',
  bowl: '<path d="M3 11.5h18a9 9 0 0 1-18 0z"/><path d="M8.5 8c0-1.6 1.2-1.6 1.2-3.5M13.5 8c0-1.6 1.2-1.6 1.2-3.5"/>',
  cup: '<path d="M4 8.5h12V14a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.2h1.8a2.6 2.6 0 0 1 0 5.2H16"/><path d="M8 3.5v2.2M12 3.5v2.2"/>',
  hourglass: '<path d="M6.5 3h11M6.5 21h11M8 3v3.5L12 12l-4 5.5V21M16 3v3.5L12 12l4 5.5V21"/>',
  bag: '<path d="M5 8h14l-1.2 13H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  stack: '<rect x="4" y="15" width="16" height="4.5" rx="1.2"/><rect x="6.2" y="9.5" width="11.6" height="4.5" rx="1.2"/><rect x="8.5" y="4" width="7" height="4.5" rx="1.2"/>',
  blocks: '<rect x="2.5" y="7" width="8" height="10" rx="2"/><rect x="13.5" y="7" width="8" height="10" rx="2"/><path d="M10.5 12h3"/>',
  puzzle: '<path d="M4 7.5h4a2.2 2.2 0 1 1 4.4 0H16.5v4a2.2 2.2 0 1 1 0 4.4v4.6H4v-4.6a2.2 2.2 0 1 0 0-4.4z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.2c0-.7.5-1.2 1.2-1.2h3.6c.7 0 1.2.5 1.2 1.2V7M3 13h18"/>',
  factory: '<path d="M3 21V10.5l5 3v-3l5 3v-3l5 3V3.5h3V21z"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3h6v3.5H9zM8.5 11h7M8.5 15h5"/>',
  spark: '<path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M5.6 18.4l3.2-3.2M15.2 8.8l3.2-3.2"/>',
  cross: '<path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z"/>',
};
function skillIcon(name) {
  if (name.startsWith('text:')) return '<span class="disc-text t">' + esc(name.slice(5)) + '</span>';
  return '<svg class="disc-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (SKILL_ICON[name] || SKILL_ICON.chat) + '</svg>';
}

/* ---------- audio: only when the device has a voice for this language ---------- */
let voice = null;
function findVoice() {
  try {
    const vs = window.speechSynthesis.getVoices();
    voice = vs.find(v => CFG.voiceRe.test(v.lang)) || null;
    document.body.classList.toggle('has-tts', !!voice);
  } catch (e) { voice = null; }
}
if ('speechSynthesis' in window) { findVoice(); try { window.speechSynthesis.addEventListener('voiceschanged', findVoice); } catch (e) {} }
function say(text, slow) {
  if (!voice || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = slow ? 0.55 : 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
const autoSay = text => { if (state.audio) say(text); };
const tts = (text, cls) => `<button class="tts ${cls || ''}" data-a="say" data-t="${esc(text)}" aria-label="Play audio">${ICON.speaker}</button>`;
let noListenUntil = 0;
const canListen = () => !!voice && state.audio && Date.now() > noListenUntil;
const speakText = s => s.includes('→') ? s.split('→').pop().trim() : s;

/* ---------- progress: browser cache + private sync to the viewer's account ---------- */
const blank = () => ({ v: 2, xp: 0, streak: 0, lastDay: null, skills: {}, unlocked: {}, str: {}, daily: {}, rom: true, audio: true, openAll: false, updatedAt: 0 });
function normalize(o) {
  const b = blank();
  if (!o || typeof o !== 'object') return b;
  o = JSON.parse(JSON.stringify(o));
  const s = { ...b, ...o, skills: { ...(o.skills || {}) }, unlocked: { ...(o.unlocked || {}) }, str: { ...(o.str || {}) }, daily: { ...(o.daily || {}) },
    rom: o.rom !== false, audio: o.audio !== false, openAll: !!o.openAll };
  if (o.done && !o.skills) {
    UNITS.forEach(u => {
      let k = 0;
      while (k < u.lessons.length && o.done[u.lessons[k].id]) k++;
      if (k === u.lessons.length) s.skills[u.n] = { level: 1, step: 0 };
      else if (k > 0) s.skills[u.n] = { level: 0, step: k };
    });
  }
  if (CFG.legacyIds && o.v !== 2) {
    const str = {};
    Object.entries(s.str).forEach(([k, v]) => { const i = CFG.legacyIds.indexOf(k); str[i >= 0 && ALLW[i] ? ALLW[i].key : k] = v; });
    s.str = str;
  }
  delete s.done; s.v = 2;
  return s;
}
function loadLocal() { try { const r = localStorage.getItem(CFG.key); return r ? normalize(JSON.parse(r)) : blank(); } catch (e) { return blank(); } }
function saveLocal() { try { localStorage.setItem(CFG.key, JSON.stringify(state)); } catch (e) {} }
let state = loadLocal();

/* sync adapters (sync-github.js or sync-claude.js) plug in through window.Sync */
const SyncA = () => (typeof window !== 'undefined' && window.Sync) || null;
function commit() { state.updatedAt = Date.now(); saveLocal(); const S = SyncA(); if (S) S.push(); }
const stable = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
const rank = s => (s ? s.level * 1000 + s.step : 0);
/* combine two copies of progress without losing work done on either device */
function mergeStates(a, b) {
  const m = normalize(a), n = normalize(b);
  const newer = (m.updatedAt || 0) >= (n.updatedAt || 0) ? m : n, older = newer === m ? n : m;
  const out = { ...newer };
  out.xp = Math.max(m.xp || 0, n.xp || 0);
  out.skills = {};
  new Set([...Object.keys(m.skills), ...Object.keys(n.skills)]).forEach(k => { out.skills[k] = rank(m.skills[k]) >= rank(n.skills[k]) ? (m.skills[k] || n.skills[k]) : n.skills[k]; });
  out.unlocked = { ...older.unlocked, ...newer.unlocked };
  out.daily = { ...older.daily };
  Object.entries(newer.daily).forEach(([k, v]) => { out.daily[k] = Math.max(v, out.daily[k] || 0); });
  out.str = { ...older.str, ...newer.str };
  if ((m.lastDay || '') !== (n.lastDay || '')) { const late = (m.lastDay || '') > (n.lastDay || '') ? m : n; out.lastDay = late.lastDay; out.streak = late.streak; }
  else out.streak = Math.max(m.streak || 0, n.streak || 0);
  out.updatedAt = Math.max(m.updatedAt || 0, n.updatedAt || 0);
  return out;
}
function applyRemote(r) {
  if (!r) return false;
  const merged = mergeStates(state, r);
  if (stable(merged) === stable(state)) return false;
  state = merged; saveLocal();
  if (!L) { renderTop(); if (view === 'learn') renderLearn(); } else renderTop();
  return true;
}

const sk = u => state.skills[u.n] || { level: 0, step: 0 };
const crowns = () => UNITS.reduce((a, u) => a + sk(u).level, 0);
const liveStreak = () => (state.lastDay === dayKey() || state.lastDay === yesterdayKey()) ? state.streak : 0;
const isUnlocked = u => state.openAll || !!state.unlocked[u.n] || UNITS.every(x => x.row >= u.row || sk(x).level >= 1);
function learnedWords() {
  const out = [];
  UNITS.forEach(u => { const s = sk(u); u.lessons.forEach((l, i) => { if (s.level >= 1 || i < s.step) out.push(...l.words); }); });
  return out;
}
const learnedLessons = () => LESSONS.filter(l => { const s = sk(l.unit); return s.level >= 1 || l.n <= s.step; });
const romOn = w => CFG.romanization && state.rom && !(w && w.script);

/* =========================================================
   Home: top bar, skill tree, words
   ========================================================= */
let view = 'learn', sel = null, resetAsk = false, wordQuery = '', wordFilter = 'learned';

function renderTop() {
  const lit = state.lastDay === dayKey();
  $('#topbar').innerHTML = `
    <div class="brand">${esc(CFG.brand)} <span class="brand-sub t">${esc(CFG.brandSub)}</span></div>
    <div class="chips">
      <span class="chip chip-streak ${lit ? 'is-lit' : ''}" title="Day streak" aria-label="${liveStreak()} day streak">${ICON.flame}<b>${liveStreak()}</b></span>
      <span class="chip chip-crown" title="Crowns" aria-label="${crowns()} crowns">${ICON.crown}<b>${crowns()}</b></span>
      <span class="chip chip-xp" title="Total XP" aria-label="${state.xp} XP">${ICON.star}<b>${state.xp}</b></span>
    </div>`;
}
function renderTabs() {
  $('#tabs').innerHTML = `
    <button class="tab ${view === 'learn' ? 'is-on' : ''}" data-a="tab" data-v="learn" ${view === 'learn' ? 'aria-current="page"' : ''}>${ICON.tree}Learn</button>
    <button class="tab ${view === 'words' ? 'is-on' : ''}" data-a="tab" data-v="words" ${view === 'words' ? 'aria-current="page"' : ''}>${ICON.book}Words</button>`;
}

const RING = 2 * Math.PI * 46;
function skillHTML(u) {
  const s = sk(u), open = isUnlocked(u);
  const max = s.level >= MAXL;
  const frac = max ? 1 : s.step / u.lessons.length;
  const cls = !open ? 'is-locked' : max ? 'is-max' : '';
  const status = !open ? 'locked' : s.level ? `level ${s.level} of ${MAXL}` : s.step ? `lesson ${s.step + 1} of ${u.lessons.length}` : 'not started';
  return `<button class="skill ${cls} ${sel === u.n ? 'is-sel' : ''}" data-a="skill" data-u="${u.n}" aria-expanded="${sel === u.n}" aria-label="${esc(u.title)}, ${status}" style="--uc:var(--u${(u.n - 1) % 6 + 1});--ud:var(--u${(u.n - 1) % 6 + 1}d)">
    <span class="medal">
      <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-bg" cx="50" cy="50" r="46"/>${frac > 0 && open ? `<circle class="ring-fg" cx="50" cy="50" r="46" stroke-dasharray="${(frac * RING).toFixed(1)} ${RING.toFixed(1)}"/>` : ''}</svg>
      <span class="disc">${open ? skillIcon(u.icon) : ICON.lock}</span>
      ${s.level > 0 ? `<span class="crown">${ICON.crown}<b>${s.level}</b></span>` : ''}
    </span>
    <span class="skill-name">${esc(u.title)}</span>
  </button>`;
}
function popHTML(u, row) {
  const s = sk(u), open = isUnlocked(u), n = u.lessons.length;
  const i = row.units.indexOf(u);
  const ax = row.units.length === 1 ? 0 : (i === 0 ? -1 : 1) * 82;
  const words = u.lessons.reduce((a, l) => a + l.words.length, 0);
  let body;
  if (!open) {
    body = `<p class="pop-meta">Locked. Reach level 1 in the skills above to open it, or unlock it now if you already know that material.</p>
      <div class="pop-btns"><button class="btn btn-brand" data-a="unlock" data-u="${u.n}">Unlock now</button><button class="btn btn-ghost" data-a="guide" data-u="${u.n}">${ICON.bulb}Tips</button></div>`;
  } else {
    const max = s.level >= MAXL;
    const meta = s.level === 0 ? `Lesson ${s.step + 1} of ${n}` : max ? `Level ${MAXL} of ${MAXL}. Practice keeps it fresh.` : `Level ${s.level} · Lesson ${s.step + 1} of ${n} toward level ${s.level + 1}`;
    const next = s.level === 0 ? u.lessons[s.step] : max ? null : u.lessons[s.step % n];
    const pct = max ? 100 : s.step / n * 100;
    body = `<p class="pop-meta">${meta}</p>
      <div class="pop-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
      ${next ? `<p class="pop-next">${s.level === 0 ? 'Next' : 'Review'}: <strong>${esc(next.title)}</strong> · ${next.words.length} ${next.script ? 'letters' : 'words'}</p>` : ''}
      <div class="pop-btns"><button class="btn btn-brand" data-a="start" data-u="${u.n}">${s.level === 0 ? (s.step ? 'Continue' : 'Start') : max ? 'Practice' : 'Level up'}</button><button class="btn btn-ghost" data-a="guide" data-u="${u.n}">${ICON.bulb}Tips</button></div>`;
  }
  return `<div class="skill-pop" id="pop" style="--ax:${ax}px;--uc:var(--u${(u.n - 1) % 6 + 1})" role="region" aria-label="${esc(u.title)}">
    <div class="pop-head"><h3>${esc(u.title)}</h3><span class="t">${esc(u.native)}</span></div>
    <p class="pop-sub">${n} lessons · ${words} ${u.lessons.every(l => l.script) ? 'letters' : 'words'}</p>${body}</div>`;
}

function renderLearn() {
  const today = state.daily[dayKey()] || 0;
  const pct = Math.min(100, today / GOAL * 100);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ l: 'SMTWTFS'[d.getDay()], on: (state.daily[dayKey(d)] || 0) > 0, today: i === 0 });
  }
  let h = `<section class="today" aria-label="Today">
      ${CFG.mascot(today >= GOAL ? 'wow' : 'happy', 62)}
      <div class="today-main">
        <div class="row-between"><span class="eyebrow">Daily goal</span><span class="num">${today} / ${GOAL} XP</span></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${GOAL}" aria-valuenow="${Math.min(today, GOAL)}"><i style="width:${pct}%"></i></div>
        <ol class="week" aria-label="Last seven days">${days.map(d => `<li class="${d.on ? 'on' : ''} ${d.today ? 'is-today' : ''}"><span class="dot">${d.on ? ICON.check : ''}</span>${d.l}</li>`).join('')}</ol>
      </div>
    </section>`;
  if (learnedWords().length >= 4) h += `<button class="practice-row" data-a="practice">${ICON.dumbbell}<div><strong>Practice weak words</strong><span>Review what you've learned · +10 XP</span></div><span class="go">Start</span></button>`;
  SECTIONS.forEach(sec => {
    const done = sec.units.filter(u => sk(u).level >= 1).length;
    h += `<div class="sec-label"><span class="eyebrow">Section ${sec.n}</span><span>${esc(sec.title)}</span></div><div class="tree">`;
    ROWS.filter(r => r.sec === sec).forEach(row => {
      h += `<div class="tree-row">${row.units.map(skillHTML).join('')}</div>`;
      const su = row.units.find(u => u.n === sel);
      if (su) h += popHTML(su, row);
    });
    const all = done === sec.units.length;
    h += `</div><div class="checkpoint ${all ? 'is-done' : ''}">
      <span class="cp-icon">${all ? ICON.check : ICON.flag}</span>
      <div><span class="eyebrow">Checkpoint ${sec.n}</span><strong>${esc(sec.title)}</strong><span class="cp-meta">${all ? 'Complete. Every skill here is at level 1 or higher.' : `${done} of ${sec.units.length} skills at level 1`}</span></div></div>`;
  });
  $('#main').innerHTML = h;
}

function renderWords() {
  const learned = learnedWords();
  const total = ALLW.length;
  let h = `<h1 class="page-title">Words</h1>
    <p class="lede">${learned.length} of ${total} learned. Gold bars show how well each one has stuck.</p>`;
  if (learned.length >= 4) h += `<button class="practice-row" data-a="practice">${ICON.dumbbell}<div><strong>Practice weak words</strong><span>Your shakiest words, a match round, and two sentences</span></div><span class="go">Start</span></button>`;
  h += `<div class="wtools">
      <label class="sr" for="word-search">Search words</label>
      <input id="word-search" class="search" type="search" placeholder="Search ${esc(CFG.target)} or English" value="${esc(wordQuery)}" autocomplete="off" spellcheck="false">
      <div class="seg" role="group" aria-label="Which words">
        <button class="${wordFilter === 'learned' ? 'is-on' : ''}" data-a="wf" data-v="learned" aria-pressed="${wordFilter === 'learned'}">Learned</button>
        <button class="${wordFilter === 'all' ? 'is-on' : ''}" data-a="wf" data-v="all" aria-pressed="${wordFilter === 'all'}">All ${total}</button>
      </div></div>
    <div id="word-list"></div>
    <section class="settings" aria-label="Settings">
      <h2 class="set-title">Settings</h2>
      ${CFG.romanization ? `<label class="switch" for="rom-toggle"><span><strong>Show romanization</strong><span class="set-sub">Turn off once you can read the script.</span></span><input type="checkbox" id="rom-toggle" ${state.rom ? 'checked' : ''}><span class="track"></span></label>` : ''}
      <label class="switch tts-only" for="audio-toggle"><span><strong>Play audio automatically</strong><span class="set-sub">Uses your device's ${esc(CFG.target)} voice.</span></span><input type="checkbox" id="audio-toggle" ${state.audio ? 'checked' : ''}><span class="track"></span></label>
      <label class="switch" for="open-toggle"><span><strong>Open every skill</strong><span class="set-sub">Skip the unlock order if you already know the basics.</span></span><input type="checkbox" id="open-toggle" ${state.openAll ? 'checked' : ''}><span class="track"></span></label>
      ${SyncA() ? SyncA().settingsHTML() : '<p class="sync">Progress is saved in this browser.</p>'}
      ${resetAsk
        ? `<div class="reset-row"><p>Erase all XP, crowns, your streak, and word strength?</p><button class="btn btn-ghost" data-a="reset-no">Keep it</button><button class="btn btn-bad" data-a="reset-yes">Erase</button></div>`
        : `<div><button class="btn-text" data-a="reset">Reset progress</button></div>`}
    </section>`;
  $('#main').innerHTML = h;
  renderWordList();
  if (SyncA()) SyncA().renderStatus();
}
function renderWordList() {
  const box = $('#word-list');
  if (!box) return;
  const learnedSet = new Set(learnedWords().map(w => w.key));
  const q = norm(wordQuery);
  const match = w => !q || norm(w.t).includes(q) || norm(w.en).includes(q) || (w.rom && norm(w.rom).includes(q));
  let h = '', shown = 0;
  UNITS.forEach(u => {
    const ws = u.lessons.flatMap(l => l.words).filter(w => (wordFilter === 'all' || learnedSet.has(w.key)) && match(w));
    if (!ws.length) return;
    shown += ws.length;
    h += `<section class="wgroup"><h2>${esc(u.title)} <span class="t">${esc(u.native)}</span></h2><ul class="wlist">`;
    ws.forEach(w => {
      const s = state.str[w.key] || 0, known = learnedSet.has(w.key);
      h += `<li class="wrow ${known ? '' : 'is-new'}">
        <div class="w-t"><div><span class="t">${esc(w.digit ? w.digit + ' ' + w.t : w.t)}</span>${romOn(w) && w.rom ? `<span class="rom">${esc(w.rom)}</span>` : ''}</div>${tts(w.t)}</div>
        <div class="w-en">${w.script ? 'sounds like <strong>' + esc(w.en) + '</strong>' : esc(w.en)}</div>
        ${known ? `<div class="meter" role="img" aria-label="Strength ${s} of 5">${[0, 1, 2, 3, 4].map(i => `<i class="${i < s ? 'on' : ''}"></i>`).join('')}</div>` : `<span class="w-unit">Skill ${u.n}</span>`}</li>`;
    });
    h += '</ul></section>';
  });
  if (!shown) {
    h = q ? `<p class="empty-line">No words match “${esc(wordQuery)}”.</p>`
      : `<div class="empty">${CFG.mascot('happy', 56)}<p><strong>Your word list starts here.</strong> Finish the first lesson of “${esc(UNITS[0].title)}” and its words show up with their meanings and a strength meter. Switch to “All ${ALLW.length}” to browse the whole course.</p></div>`;
  }
  box.innerHTML = h;
}

function render() {
  renderTop(); renderTabs();
  if (view === 'learn') renderLearn(); else renderWords();
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- tips (unit guide) ---------- */
function openGuide(n) {
  const u = UNITS[n - 1];
  const g = $('#guide');
  g.innerHTML = `
    <div class="l-head gutter"><button class="icon-btn" data-a="guide-close" aria-label="Close tips">${ICON.x}</button><span class="eyebrow">Skill ${u.n} tips</span></div>
    <div class="l-body"><article class="l-body-in gutter guide-in">
      <header><h1 class="guide-title">${esc(u.title)}</h1><div class="guide-native"><span class="t">${esc(u.native)}</span>${u.nativeRom && romOn() ? `<span class="rom">${esc(u.nativeRom)}</span>` : ''}</div></header>
      <p class="guide-tip">${rich(u.tip)}</p>
      ${u.guide.map(gp => `${gp.p ? `<p>${rich(gp.p)}</p>` : ''}${gp.ex.length ? `<div class="ex-list">${gp.ex.map(x => `<div class="ex-row"><div class="ex-t"><div><span class="t">${esc(x.t)}</span>${x.rom && romOn() ? `<span class="rom">${esc(x.rom)}</span>` : ''}</div>${tts(speakText(x.t))}</div><div class="ex-en">${esc(x.en)}</div></div>`).join('')}</div>` : ''}`).join('')}
      <h2 class="guide-sub">In this skill</h2>
      <ol class="guide-lessons">${u.lessons.map(l => `<li><strong>${esc(l.title)}</strong><span>${l.words.map(w => esc(w.t)).join(' · ')}</span></li>`).join('')}</ol>
    </article></div>
    <footer class="l-foot"><div class="l-foot-in gutter"><button class="btn btn-brand" data-a="guide-close" id="guide-done">Got it</button></div></footer>`;
  g.hidden = false;
  document.body.classList.add('locked');
  const b = g.querySelector('.l-body'); if (b) b.scrollTop = 0;
  const d = $('#guide-done'); if (d) d.focus({ preventScroll: true });
}
function closeGuide() {
  const g = $('#guide'); g.hidden = true; g.innerHTML = '';
  if (!L) document.body.classList.remove('locked');
}

/* =========================================================
   Session engine
   ========================================================= */
let L = null;

function distractors(w, n) {
  const tl = w.t.toLowerCase();
  const ok = x => x !== w && x.t.toLowerCase() !== tl && x.script === w.script && !overlaps(x, w);
  const tiers = [
    ALLW.filter(x => ok(x) && x.lesson === w.lesson),
    ALLW.filter(x => ok(x) && x.unit === w.unit && x.lesson !== w.lesson),
    ALLW.filter(x => ok(x) && x.unit !== w.unit),
  ];
  const out = [];
  for (const tier of tiers) for (const x of shuffle(tier)) {
    if (out.length >= n) return out;
    if (!out.some(o => o.t.toLowerCase() === x.t.toLowerCase() || overlaps(o, x))) out.push(x);
  }
  return out;
}
function uniquePairs(ws) {
  const out = [];
  ws.forEach(w => { if (!out.some(o => o.t.toLowerCase() === w.t.toLowerCase() || overlaps(o, w))) out.push(w); });
  return out;
}
function pickExtras(s, lang, n) {
  if (lang === 't' && s.extras) return shuffle(s.extras).slice(0, n + 1);
  const ans = (lang === 't' ? s.tiles : s.enTiles).map(x => x.t.toLowerCase());
  const block = new Set(ans);
  if (lang === 't') ans.forEach(t => (CFG.syn || []).forEach(g => { if (g.includes(t)) g.forEach(x => block.add(x)); }));
  else ['a', 'an', 'the'].forEach(x => block.add(x));
  const src = x => lang === 't' ? (x.explicit ? x.tiles : tok(x.text).map(t => ({ t, rom: '' }))) : tok(x.en).map(t => ({ t, rom: '' }));
  const tiers = [SENTS.filter(x => x !== s && x.lesson === s.lesson), SENTS.filter(x => x.unit === s.unit && x.lesson !== s.lesson), SENTS.filter(x => x.unit !== s.unit)];
  const out = [], seen = new Set();
  for (const tier of tiers) for (const tile of shuffle(tier.flatMap(src))) {
    const lo = tile.t.toLowerCase();
    if (block.has(lo) || seen.has(lo)) continue;
    seen.add(lo);
    out.push({ t: keepCase(tile.t, lang) ? tile.t : tile.t.toLowerCase(), rom: tile.rom });
    if (out.length >= n) return out;
  }
  return out;
}
const pickType = () => Math.random() < 0.5 ? 'pick-en' : 'pick-t';
const withDigit = (w, p) => !!w.digit && Math.random() < (p || 0.45);
function wordEx(w, prodP) {
  if (withDigit(w, 0.3)) return { t: 'pick-en', w, digit: true };
  if (Math.random() < prodP) return { t: typeable(w) && Math.random() < 0.6 ? 'type' : 'pick-t', w };
  return { t: 'pick-en', w };
}
function listening(ws, sents) {
  const q = [];
  if (!canListen()) return q;
  const w = shuffle(ws.filter(x => !x.script))[0] || shuffle(ws)[0];
  if (w) q.push({ t: 'listen-pick', w });
  if (sents.length) q.push({ t: 'listen-build', s: shuffle(sents)[0] });
  return q;
}

/* level 0: a first-time lesson, new words introduced one at a time */
function buildLesson(les) {
  const ws = les.words, head = [], tail = [];
  ws.forEach((w, i) => {
    head.push({ t: 'intro', w });
    if (i > 0) { const p = ws[i - 1]; const t = pickType(); head.push({ t, w: p, digit: t === 'pick-en' && withDigit(p) }); }
  });
  head.push({ t: 'pick-en', w: ws[ws.length - 1] });
  const pairs = uniquePairs(shuffle(ws)).slice(0, 5);
  if (pairs.length >= 3) tail.push({ t: 'match', ws: pairs });
  les.sentences.forEach((s, i) => tail.push({ t: i % 2 ? 'build-en' : 'build-t', s }));
  shuffle(ws.filter(typeable)).slice(0, 2).forEach(w => tail.push({ t: 'type', w }));
  if (!ws.some(typeable)) shuffle(ws).slice(0, 2).forEach(w => tail.push({ t: 'pick-t', w }));
  tail.push(...listening(ws, les.sentences));
  return [...head, ...shuffle(tail)];
}
/* levels 1-4: review one lesson's words plus older ones, harder each level */
function buildLevelUp(u, les, level) {
  const all = u.lessons.flatMap(l => l.words);
  const focus = les ? les.words : shuffle(all).slice(0, 6);
  const review = shuffle(all.filter(w => !focus.includes(w))).slice(0, 3);
  const ws = uniquePairs(shuffle([...focus, ...review]));
  const prodP = Math.min(0.85, 0.25 + 0.15 * level);
  const q = ws.map(w => wordEx(w, prodP));
  const m = uniquePairs(shuffle(ws)).slice(0, 5);
  if (m.length >= 3) q.splice(Math.min(3, q.length), 0, { t: 'match', ws: m });
  const unitS = u.lessons.flatMap(l => l.sentences);
  const sents = [...(les ? les.sentences : []), ...shuffle(unitS.filter(s => !les || s.lesson !== les.id)).slice(0, les ? 1 : 3)];
  shuffle(sents).slice(0, 3).forEach(s => q.push({ t: Math.random() < prodP ? 'build-t' : 'build-en', s }));
  q.push(...listening(ws, sents));
  return q;
}
function buildPractice() {
  const learned = uniquePairs(shuffle(learnedWords()).sort((a, b) => (state.str[a.key] || 0) - (state.str[b.key] || 0)));
  const pick = learned.slice(0, 8);
  const q = pick.map(w => wordEx(w, 0.5));
  const m = uniquePairs(shuffle(pick)).slice(0, 5);
  if (m.length >= 3) q.splice(Math.min(4, q.length), 0, { t: 'match', ws: m });
  const sents = shuffle(learnedLessons().flatMap(l => l.sentences)).slice(0, 2);
  sents.forEach((s, i) => q.push({ t: i ? 'build-en' : 'build-t', s }));
  q.push(...listening(pick, []));
  return q;
}

function prep(ex) {
  const e = { ...ex, orig: ex };
  if (e.t === 'pick-en' || e.t === 'pick-t' || e.t === 'listen-pick') { e.options = shuffle([e.w, ...distractors(e.w, 3)]); e.sel = -1; }
  if (e.t === 'type') e.typed = '';
  if (e.t === 'build-t' || e.t === 'build-en' || e.t === 'listen-build') {
    const lang = e.t === 'build-en' ? 'en' : 't';
    const tiles = lang === 'en' ? e.s.enTiles : e.s.tiles;
    e.lang = lang;
    e.targets = lang === 'en' ? e.s.enTargets : e.s.tTargets;
    e.bank = shuffle([...tiles, ...pickExtras(e.s, lang, tiles.length >= 5 ? 3 : 2)].map((t, k) => ({ ...t, k })));
    e.placed = [];
  }
  if (e.t === 'match') { e.left = shuffle(e.ws); e.right = shuffle(e.ws); e.selL = null; e.selR = null; e.matched = new Set(); e.bad = null; e.errors = 0; }
  return e;
}

function startSkill(n) {
  const u = UNITS[n - 1], s = sk(u);
  if (s.level === 0) { const les = u.lessons[s.step]; openSession({ kind: 'lesson', u, les, q: buildLesson(les) }); }
  else if (s.level < MAXL) { const les = u.lessons[s.step % u.lessons.length]; openSession({ kind: 'levelup', u, les, q: buildLevelUp(u, les, s.level) }); }
  else openSession({ kind: 'skillpractice', u, les: null, q: buildLevelUp(u, null, MAXL) });
}
function startPractice() {
  if (learnedWords().length < 4) { toast('Finish a lesson first to unlock practice.'); return; }
  openSession({ kind: 'practice', u: null, les: null, q: buildPractice() });
}
function openSession(o) {
  L = { ...o, queue: o.q, done: 0, hearts: 5, graded: 0, correct: 0, mistakes: 0, str: {}, start: Date.now(), phase: 'answer', ex: null, praise: Math.floor(Math.random() * CFG.praise.length), confirmQuit: false, anim: '' };
  $('#lesson').hidden = false;
  document.body.classList.add('locked');
  next();
}
function next() {
  if (!L.queue.length) { finish(); return; }
  L.ex = prep(L.queue.shift());
  L.phase = 'answer'; L.anim = '';
  renderLesson();
  const body = document.querySelector('#lesson .l-body'); if (body) body.scrollTop = 0;
  const e = L.ex;
  if (e.t === 'intro' || (e.t === 'pick-en' && !e.digit)) autoSay(e.w.t);
  if (e.t === 'build-en') autoSay(e.s.text);
  if (e.t === 'listen-pick') say(e.w.t);
  if (e.t === 'listen-build') say(e.s.text);
}
function bump(key, d) { L.str[key] = (L.str[key] || 0) + d; }

function typeTargets(w) {
  const set = new Set([w.t, ...w.alts].map(norm));
  if (!/\(/.test(w.en)) {
    const parts = glossParts(w.en);
    ALLW.forEach(x => { if (x !== w && !x.script && glossParts(x.en).some(p => parts.includes(p))) { set.add(norm(x.t)); x.alts.forEach(a => set.add(norm(a))); } });
  }
  return set;
}
function check() {
  const e = L.ex;
  if (L.phase !== 'answer') return;
  let ok;
  if (e.options) {
    if (e.sel < 0) return;
    ok = e.options[e.sel] === e.w;
    bump(e.w.key, ok ? 1 : -2);
  } else if (e.t === 'type') {
    const v = norm(e.typed || '');
    if (!v) return;
    const targets = typeTargets(e.w);
    e.typo = false; e.other = false;
    if (targets.has(v)) { ok = true; e.other = v !== norm(e.w.t) && !e.w.alts.map(norm).includes(v); }
    else if ([...targets].some(t => t.length >= 4 && lev(t, v) === 1)) { ok = true; e.typo = true; }
    else ok = false;
    bump(e.w.key, ok ? 1 : -2);
  } else if (e.bank) {
    if (!e.placed.length) return;
    const got = e.placed.map(k => e.bank.find(t => t.k === k).t).join(J).toLowerCase();
    ok = e.targets.includes(got);
  } else return;
  grade(ok);
}
function grade(ok) {
  const e = L.ex;
  L.graded++;
  if (ok) {
    L.correct++;
    L.praise = (L.praise + 1) % CFG.praise.length;
    if (e.t === 'pick-t' || e.t === 'type') autoSay(e.w.t);
    if (e.t === 'build-t') autoSay(e.s.text);
  } else { L.mistakes++; L.hearts--; L.queue.push(e.orig); }
  L.phase = 'feedback'; L.lastOk = ok; L.anim = ok ? 'pop' : 'shake';
  renderLesson();
  const c = $('#cont'); if (c) c.focus({ preventScroll: true });
}
function cont() {
  if (L.phase !== 'feedback') return;
  if (L.hearts <= 0) { showFail(); return; }
  L.done++;
  next();
}
function tapMatch(side, key) {
  const e = L.ex;
  if (L.phase !== 'answer' || e.matched.has(key)) return;
  if (side === 'L') { e.selL = e.selL === key ? null : key; const w = e.ws.find(x => x.key === key); if (e.selL && w) autoSay(w.t); }
  else e.selR = e.selR === key ? null : key;
  if (e.selL && e.selR) {
    if (e.selL === e.selR) { e.matched.add(e.selL); bump(e.selL, 1); }
    else {
      e.errors++; L.mistakes++; bump(e.selL, -1);
      const pair = [e.selL, e.selR]; e.bad = pair;
      setTimeout(() => { if (L && L.ex === e && e.bad === pair) { e.bad = null; renderLesson(); } }, 500);
    }
    e.selL = e.selR = null;
  }
  if (e.matched.size === e.ws.length) {
    L.graded++; if (!e.errors) L.correct++;
    L.phase = 'feedback'; L.lastOk = true; L.anim = 'pop';
    L.praise = (L.praise + 1) % CFG.praise.length;
    renderLesson();
    const c = $('#cont'); if (c) c.focus({ preventScroll: true });
    return;
  }
  renderLesson();
}
function skipListening() {
  noListenUntil = Date.now() + 15 * 60 * 1000;
  L.queue = L.queue.filter(x => x.t !== 'listen-pick' && x.t !== 'listen-build');
  toast('Listening exercises are off for 15 minutes.');
  L.done++;
  next();
}

/* ---------- exercise markup ---------- */
const tHTML = (w, big) => `<span class="t ${big ? 't-xl' : ''}">${esc(w.t)}</span>`;
const romHTML = (w, cls) => romOn(w) && w.rom ? `<span class="rom ${cls || ''}">${esc(w.rom)}</span>` : '';
function optCls(e, i) {
  if (L.phase === 'feedback') {
    if (e.options[i] === e.w) return 'is-right';
    if (i === e.sel) return 'is-wrong';
    return '';
  }
  return e.sel === i ? 'is-sel' : '';
}
const listenBox = text => `<div class="listen"><button class="say-big" data-a="say" data-t="${esc(text)}" aria-label="Play again">${ICON.speaker}</button><button class="say-slow" data-a="say-slow" data-t="${esc(text)}">Slower</button></div>`;
function tileHTML(t, where, fb) {
  return `<button class="tile ${L.ex.lang === 't' ? 'is-t' : ''}" data-a="tile" data-where="${where}" data-k="${t.k}" ${fb ? 'disabled' : ''}><span class="${L.ex.lang === 't' ? 't' : ''}">${esc(t.t)}</span>${L.ex.lang === 't' && t.rom && CFG.romanization && state.rom ? `<span class="rom">${esc(t.rom)}</span>` : ''}</button>`;
}
function buildArea(e, fb) {
  return `<div class="answer-line ${L.anim === 'shake' ? 'shake' : ''}" aria-label="Your answer">${e.placed.map(k => tileHTML(e.bank.find(t => t.k === k), 'line', fb)).join('')}</div>
    <div class="bank" aria-label="Word tiles">${e.bank.map(t => e.placed.includes(t.k)
      ? `<span class="tile ghost ${e.lang === 't' ? 'is-t' : ''}" aria-hidden="true"><span class="${e.lang === 't' ? 't' : ''}">${esc(t.t)}</span>${e.lang === 't' && t.rom && CFG.romanization && state.rom ? `<span class="rom">${esc(t.rom)}</span>` : ''}</span>`
      : tileHTML(t, 'bank', fb)).join('')}</div>`;
}
function exHTML(e) {
  const fb = L.phase === 'feedback';
  if (e.t === 'intro') {
    const w = e.w;
    return `<div><span class="tag">${w.script ? 'New letter' : 'New word'}</span><h2 class="ex-label">${w.script ? 'Meet this letter' : 'Learn this word'}</h2></div>
      <div class="intro">
        <div class="head">${w.digit ? `<span class="digit t">${esc(w.digit)}</span>` : ''}${tHTML(w, true)}${tts(w.t)}</div>
        ${romHTML(w, 'rom-lg')}
        <div class="mean">${w.script ? 'Sounds like “' + esc(w.en) + '”' : esc(w.en)}</div>
        ${w.note ? `<p class="note">${rich(w.note)}</p>` : ''}
      </div>`;
  }
  if (e.t === 'pick-en') {
    const w = e.w;
    const label = w.script ? 'What sound does this letter make?' : e.digit ? 'What number is this?' : 'What does this mean?';
    const prompt = e.digit ? `<div class="digit-xl t">${esc(w.digit)}</div>` : `<div>${tHTML(w, true)}${romHTML(w)}</div>${tts(w.t)}`;
    return `<h2 class="ex-label">${label}</h2>
      <div class="prompt ${L.anim === 'shake' ? 'shake' : ''}">${prompt}</div>
      <div class="opts" role="group" aria-label="Answers">${e.options.map((o, i) => `<button class="opt ${optCls(e, i)}" data-a="opt" data-i="${i}" ${fb ? 'disabled' : ''} aria-pressed="${e.sel === i}"><span class="key">${i + 1}</span><span>${esc(o.en)}</span></button>`).join('')}</div>`;
  }
  if (e.t === 'pick-t' || e.t === 'listen-pick') {
    const w = e.w, listen = e.t === 'listen-pick';
    const label = listen ? 'What did you hear?' : w.script ? 'Which letter makes this sound?' : `Choose the ${esc(CFG.target)} for`;
    const prompt = listen ? listenBox(w.t) : `<p class="prompt-en ${L.anim === 'shake' ? 'shake' : ''}">“${esc(w.en)}”</p>`;
    return `<h2 class="ex-label">${label}</h2>${prompt}
      <div class="opts ${w.script ? 'opts-letters' : ''}" role="group" aria-label="Answers">${e.options.map((o, i) => `<button class="opt ${optCls(e, i)}" data-a="opt" data-i="${i}" ${fb ? 'disabled' : ''} aria-pressed="${e.sel === i}"><span class="key">${i + 1}</span><span class="stack">${tHTML(o)}${listen ? '' : romHTML(o)}</span></button>`).join('')}</div>`;
  }
  if (e.t === 'type') {
    const cls = fb ? (L.lastOk ? 'is-right' : 'is-wrong') : '';
    return `<h2 class="ex-label">Type this in ${esc(CFG.target)}</h2>
      <p class="prompt-en ${L.anim === 'shake' ? 'shake' : ''}">“${esc(e.w.en)}”</p>
      <label class="sr" for="type-in">Your answer</label>
      <input id="type-in" class="type-in t ${cls}" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Type in ${esc(CFG.target)}" value="${esc(e.typed || '')}" ${fb ? 'disabled' : ''}>`;
  }
  if (e.t === 'match') {
    const cls = (side, w) => {
      const s = side === 'L' ? e.selL : e.selR;
      if (e.matched.has(w.key)) return 'is-done';
      if (e.bad && e.bad[side === 'L' ? 0 : 1] === w.key) return 'is-wrong';
      return s === w.key ? 'is-sel' : '';
    };
    return `<h2 class="ex-label">Tap the matching pairs</h2>
      <div class="match">
        <div class="mcol">${e.left.map(w => `<button class="mbtn ${w.script ? 'is-letter' : ''} ${cls('L', w)}" data-a="match" data-side="L" data-k="${esc(w.key)}" ${e.matched.has(w.key) || fb ? 'disabled' : ''}>${tHTML(w)}${romHTML(w)}</button>`).join('')}</div>
        <div class="mcol">${e.right.map(w => `<button class="mbtn ${cls('R', w)}" data-a="match" data-side="R" data-k="${esc(w.key)}" ${e.matched.has(w.key) || fb ? 'disabled' : ''}>${esc(w.en)}</button>`).join('')}</div>
      </div>`;
  }
  if (e.t === 'build-t') return `<h2 class="ex-label">Write this in ${esc(CFG.target)}</h2><p class="prompt-en">${esc(e.s.en)}</p>${buildArea(e, fb)}`;
  if (e.t === 'build-en') return `<h2 class="ex-label">Write this in English</h2>
      <div class="prompt"><div><span class="t t-lg">${esc(e.s.text)}</span>${romOn() && e.s.rom ? `<span class="rom">${esc(e.s.rom)}</span>` : ''}</div>${tts(e.s.text)}</div>${buildArea(e, fb)}`;
  if (e.t === 'listen-build') return `<h2 class="ex-label">Tap what you hear</h2>${listenBox(e.s.text)}${buildArea(e, fb)}`;
  return '';
}

function footHTML(e) {
  if (L.phase === 'feedback') {
    const ok = L.lastOk;
    let title, detail = '';
    const sentT = s => `<span class="t">${esc(s.text)}</span>${romOn() && s.rom ? `<br><span class="rom">${esc(s.rom)}</span>` : ''}`;
    if (ok) {
      const p = CFG.praise[L.praise];
      title = `<span class="t">${esc(p[0])}</span> ${esc(p[1])}`;
      if (e.t === 'build-t') detail = romOn() && e.s.rom ? `<span class="rom">${esc(e.s.rom)}</span>` : '';
      else if (e.t === 'listen-build') detail = `${sentT(e.s)}<br>${esc(e.s.en)}`;
      else if (e.t === 'match') detail = e.errors ? `All matched, with ${e.errors} slip${e.errors > 1 ? 's' : ''}.` : 'All pairs matched.';
      else if (e.t === 'type' && e.typo) detail = `Watch the spelling: <span class="t">${esc(e.w.t)}</span>`;
      else if (e.t === 'type' && e.other) detail = `Also correct: <span class="t">${esc(e.w.t)}</span>`;
      else if (e.t === 'listen-pick') detail = `<span class="t">${esc(e.w.t)}</span> means “${esc(e.w.en)}.”`;
      else if (e.w && e.w.note) detail = rich(e.w.note);
    } else {
      title = 'Correct answer:';
      if (e.t === 'pick-en') detail = `<strong>${esc(e.w.en)}</strong>${e.w.note ? '<br>' + rich(e.w.note) : ''}`;
      else if (e.t === 'pick-t' || e.t === 'type' || e.t === 'listen-pick') detail = `<span class="t">${esc(e.w.t)}</span>${romOn(e.w) && e.w.rom ? ` <span class="rom">${esc(e.w.rom)}</span>` : ''}${e.t === 'listen-pick' ? ` (${esc(e.w.en)})` : ''}`;
      else if (e.t === 'build-t' || e.t === 'listen-build') detail = `${sentT(e.s)}${e.t === 'listen-build' ? '<br>' + esc(e.s.en) : ''}`;
      else if (e.t === 'build-en') detail = `<strong>${esc(e.s.en)}</strong>`;
    }
    return `<footer class="l-foot ${ok ? 'ok' : 'bad'}"><div class="l-foot-in gutter">
      <div class="fb" role="status">${ok ? ICON.okCircle : ICON.badCircle}<div><div class="fb-title">${title}</div>${detail ? `<div class="fb-detail">${detail}</div>` : ''}</div></div>
      <button class="btn ${ok ? 'btn-ok' : 'btn-bad'}" data-a="continue" id="cont">Continue</button></div></footer>`;
  }
  if (e.t === 'intro') return `<footer class="l-foot"><div class="l-foot-in gutter"><button class="btn btn-brand" data-a="intro-next" id="cont">Continue</button></div></footer>`;
  if (e.t === 'match') return `<footer class="l-foot"><div class="l-foot-in gutter"><p class="foot-hint">${e.matched.size} of ${e.ws.length} pairs matched</p></div></footer>`;
  const ready = e.bank ? e.placed.length > 0 : e.t === 'type' ? !!(e.typed || '').trim() : e.sel >= 0;
  const skip = (e.t === 'listen-pick' || e.t === 'listen-build') ? `<button class="btn-text btn-skip" data-a="nolisten">Can't listen now</button>` : '';
  return `<footer class="l-foot"><div class="l-foot-in gutter">${skip}<button class="btn btn-brand" data-a="check" id="check-btn" ${ready ? '' : 'disabled'}>Check</button></div></footer>`;
}

function renderLesson() {
  if (!L || L.phase === 'end') return;
  const e = L.ex;
  const answered = L.done + (L.phase === 'feedback' ? 1 : 0);
  const total = L.done + 1 + L.queue.length;
  const pct = Math.round(answered / total * 100);
  $('#lesson').innerHTML = `
    <div class="l-head gutter">
      <button class="icon-btn" data-a="quit" aria-label="Quit lesson">${ICON.x}</button>
      <div class="l-bar" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
      <span class="hearts" aria-label="${L.hearts} hearts left">${ICON.heart}<b>${L.hearts}</b></span>
    </div>
    <div class="l-body"><div class="l-body-in gutter">${exHTML(e)}</div></div>
    ${footHTML(e)}
    ${L.confirmQuit ? `<button class="scrim" data-a="quit-no" aria-label="Keep learning"></button>
      <div class="sheet gutter" role="dialog" aria-modal="true" aria-labelledby="quit-title"><div class="sheet-in">
        ${CFG.mascot('sad', 72)}<h2 id="quit-title">Quit this lesson?</h2><p>You'll lose the progress you've made in it.</p>
        <button class="btn btn-brand" data-a="quit-no" id="keep-btn">Keep learning</button>
        <button class="btn-text" data-a="quit-yes">Quit lesson</button></div></div>` : ''}`;
  if (L.confirmQuit) { const k = $('#keep-btn'); if (k) k.focus({ preventScroll: true }); }
  else if (e.t === 'type' && L.phase === 'answer') {
    const inp = $('#type-in');
    if (inp) { inp.focus({ preventScroll: true }); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (err) {} }
  }
}

function fmtTime(s) { return Math.floor(s / 60) + ':' + pad(s % 60); }
function finish() {
  const secs = Math.round((Date.now() - L.start) / 1000);
  const acc = L.graded ? Math.round(L.correct / L.graded * 100) : 100;
  const perfect = L.mistakes === 0;
  const xp = L.kind === 'lesson' || L.kind === 'levelup' ? 10 + (perfect ? 5 : 0) : 10;
  Object.entries(L.str).forEach(([k, d]) => { state.str[k] = Math.max(0, Math.min(5, (state.str[k] || 0) + d)); });
  state.xp += xp;
  const t = dayKey();
  state.daily[t] = (state.daily[t] || 0) + xp;
  const keys = Object.keys(state.daily).sort();
  while (keys.length > 21) delete state.daily[keys.shift()];
  let streakUp = false;
  if (state.lastDay !== t) { state.streak = state.lastDay === yesterdayKey() ? state.streak + 1 : 1; state.lastDay = t; streakUp = true; }
  let levelUp = 0, skillNote = '';
  if (L.u && (L.kind === 'lesson' || L.kind === 'levelup')) {
    const s = { ...sk(L.u) };
    s.step++;
    if (s.step >= L.u.lessons.length) { s.level++; s.step = 0; levelUp = s.level; }
    state.skills[L.u.n] = s;
    skillNote = levelUp ? '' : s.level === 0 ? `${L.u.title}: lesson ${s.step} of ${L.u.lessons.length} done` : `${L.u.title}: ${s.step} of ${L.u.lessons.length} toward level ${s.level + 1}`;
  }
  commit();
  L.phase = 'end';
  renderTop();
  const title = levelUp ? `${esc(L.u.title)} is level ${levelUp}` : L.kind === 'practice' || L.kind === 'skillpractice' ? 'Practice complete' : perfect ? 'Perfect lesson' : 'Lesson complete';
  $('#lesson').innerHTML = `
    <div class="end"><div class="end-in gutter">
      ${levelUp ? `<div class="crown-big">${ICON.crown}<b>${levelUp}</b></div>` : CFG.mascot('happy', 120)}
      <h1 class="end-title">${title}</h1>
      <p class="end-sub">${levelUp ? (levelUp >= MAXL ? 'Maximum level. That skill is solid.' : `Level ${levelUp + 1} adds more typing and sentence building.`) : `<span class="t">${esc(CFG.endWord[0])}</span> ${CFG.endWord[2] && romOn() ? `<span class="rom">${esc(CFG.endWord[2])}</span>` : ''} ${esc(CFG.endWord[1])}`}</p>
      ${skillNote ? `<p class="end-note">${esc(skillNote)}</p>` : ''}
      <div class="stats">
        <div class="stat st-sun"><span class="stat-k">XP earned</span><span class="stat-v">+${xp}</span></div>
        <div class="stat st-ok"><span class="stat-k">Accuracy</span><span class="stat-v">${acc}%</span></div>
        <div class="stat st-sel"><span class="stat-k">Time</span><span class="stat-v">${fmtTime(secs)}</span></div>
      </div>
      ${streakUp ? `<p class="streak-note">${ICON.flame}${state.streak}-day streak</p>` : ''}
    </div></div>
    <footer class="l-foot"><div class="l-foot-in gutter"><button class="btn btn-brand" data-a="close" id="cont">Continue</button></div></footer>`;
  const c = $('#cont'); if (c) c.focus({ preventScroll: true });
}
function showFail() {
  L.phase = 'end';
  Object.entries(L.str).forEach(([k, d]) => { if (d < 0) state.str[k] = Math.max(0, (state.str[k] || 0) + d); });
  commit();
  $('#lesson').innerHTML = `
    <div class="end"><div class="end-in gutter">
      ${CFG.mascot('sad', 120)}
      <h1 class="end-title sad">Out of hearts</h1>
      <p class="end-sub">Five misses ends a lesson. Run it again; the words that tripped you up will come first in practice.</p>
    </div></div>
    <footer class="l-foot"><div class="l-foot-in gutter end-btns">
      <button class="btn btn-ghost" data-a="close">Back to skills</button>
      <button class="btn btn-brand" data-a="retry" id="cont">Try again</button></div></footer>`;
  const c = $('#cont'); if (c) c.focus({ preventScroll: true });
}
function closeLesson() {
  const was = L && L.u ? L.u.n : null;
  $('#lesson').hidden = true; $('#lesson').innerHTML = '';
  document.body.classList.remove('locked');
  L = null;
  if (was) sel = was;
  render();
  if (view === 'learn') requestAnimationFrame(() => { const p = $('#pop'); if (p) p.scrollIntoView({ block: 'nearest' }); });
}

/* =========================================================
   Events
   ========================================================= */
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a;
  if (a === 'say') { say(b.dataset.t); return; }
  if (a === 'say-slow') { say(b.dataset.t, true); return; }
  if (a === 'guide') { openGuide(+b.dataset.u); return; }
  if (a === 'guide-close') { closeGuide(); return; }
  if (a === 'tab') { view = b.dataset.v; resetAsk = false; render(); window.scrollTo(0, 0); return; }
  if (a === 'skill') {
    const n = +b.dataset.u;
    sel = sel === n ? null : n;
    renderLearn();
    if (sel) requestAnimationFrame(() => { const p = $('#pop'); if (p) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    return;
  }
  if (a === 'start') { startSkill(+b.dataset.u); return; }
  if (a.startsWith('sync-') && SyncA()) { SyncA().action(a, b); return; }
  if (a === 'unlock') { state.unlocked[+b.dataset.u] = true; commit(); renderLearn(); toast('Skill unlocked.'); return; }
  if (a === 'practice') { startPractice(); return; }
  if (a === 'wf') { wordFilter = b.dataset.v; renderWords(); return; }
  if (a === 'reset') { resetAsk = true; renderWords(); return; }
  if (a === 'reset-no') { resetAsk = false; renderWords(); return; }
  if (a === 'reset-yes') { const keep = { rom: state.rom, audio: state.audio }; state = { ...blank(), ...keep }; resetAsk = false; sel = null; commit(); render(); toast('Progress erased.'); return; }
  if (!L) return;
  if (a === 'opt' && L.phase === 'answer') { L.ex.sel = +b.dataset.i; renderLesson(); return; }
  if (a === 'tile' && L.phase === 'answer') {
    const e = L.ex, k = +b.dataset.k;
    if (b.dataset.where === 'bank') { e.placed.push(k); const t = e.bank.find(x => x.k === k); if (e.lang === 't' && t && e.t !== 'listen-build') autoSay(t.t); }
    else e.placed = e.placed.filter(x => x !== k);
    renderLesson(); return;
  }
  if (a === 'match') { tapMatch(b.dataset.side, b.dataset.k); return; }
  if (a === 'check') { check(); return; }
  if (a === 'continue') { cont(); return; }
  if (a === 'intro-next') { L.done++; next(); return; }
  if (a === 'nolisten') { skipListening(); return; }
  if (a === 'quit') { L.confirmQuit = true; renderLesson(); return; }
  if (a === 'quit-no') { L.confirmQuit = false; renderLesson(); return; }
  if (a === 'quit-yes' || a === 'close') { closeLesson(); return; }
  if (a === 'retry') {
    const { kind, u } = L;
    if (kind === 'practice') startPractice(); else startSkill(u.n);
    return;
  }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'type-in' && L && L.ex && L.ex.t === 'type' && L.phase === 'answer') {
    L.ex.typed = t.value;
    const b = $('#check-btn'); if (b) b.disabled = !t.value.trim();
  }
  if (t.id === 'word-search') { wordQuery = t.value; renderWordList(); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'rom-toggle') { state.rom = t.checked; commit(); renderWordList(); }
  if (t.id === 'audio-toggle') { state.audio = t.checked; commit(); }
  if (t.id === 'open-toggle') { state.openAll = t.checked; commit(); }
});
document.addEventListener('keydown', ev => {
  const g = $('#guide');
  if (g && !g.hidden) { if (ev.key === 'Escape') closeGuide(); return; }
  if (!L || $('#lesson').hidden || L.phase === 'end') return;
  if (ev.key === 'Escape') { L.confirmQuit = !L.confirmQuit; renderLesson(); return; }
  if (L.confirmQuit) return;
  const e = L.ex;
  const inInput = ev.target && ev.target.tagName === 'INPUT';
  if (!inInput && L.phase === 'answer' && e.options && /^[1-9]$/.test(ev.key)) {
    const i = +ev.key - 1; if (i < e.options.length) { e.sel = i; renderLesson(); } return;
  }
  if (ev.key === 'Enter') {
    if (ev.target && ev.target.tagName === 'BUTTON' && ev.target.id !== 'cont' && ev.target.id !== 'check-btn') return;
    ev.preventDefault();
    if (L.phase === 'feedback') cont();
    else if (e.t === 'intro') { L.done++; next(); }
    else check();
  }
});

render();
if (SyncA()) setTimeout(() => SyncA().init(), 0);

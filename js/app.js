// DV87 STAINED THEME · Vigil. Theme state, pane radio group, settings card, light choreography, scheduler
// (full rate while something moves / 30 fps idle dust + cloud / sleep), CSS fallback, test hook window.__stained.
import { createRenderer } from './glass.js';

const Q = new URLSearchParams(location.search);
const root = document.documentElement;
const $ = (s) => document.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const SLEEP_AFTER = (Q.has('sleep') ? +Q.get('sleep') : 20) * 1000;
const NET = Q.has('fast') ? 60 : 650;
const OFFLINE = Q.has('offline'), LOCKED = Q.has('locked'), STATIC = Q.has('still');

const THEMES = [
  { n: 'Rose', d: 'warm, for mornings and letters', c: [0.86, 0.17, 0.34], hex: '#E8657F' },
  { n: 'Cobalt', d: 'for late reading, deep and calm', c: [0.13, 0.31, 0.9], hex: '#6D8CFF' },
  { n: 'Emerald', d: 'for focus, like a library lamp', c: [0.05, 0.6, 0.36], hex: '#3FC28A' },
  { n: 'Amber', d: 'for evenings, honey and candle', c: [0.98, 0.6, 0.08], hex: '#F2A93B' },
  { n: 'Amethyst', d: 'for ideas that are not ready yet', c: [0.5, 0.2, 0.84], hex: '#A77BF0' },
  { n: 'Daylight', d: 'clear glass, nothing between you and the page', c: [0.9, 0.9, 0.84], hex: '#DCD6C8' },
];
const lin = (c) => c.map((v) => Math.pow(v, 2.2));
const GLASS = new Float32Array(THEMES.flatMap((t) => lin(t.c)));                       // tints baked into the panes
const LIGHT = THEMES.map((t) => { const l = lin(t.c), m = Math.max(...l); return l.map((v) => 0.92 * v / m + 0.08); });   // light through each
LIGHT[5] = [1.0, 0.94, 0.8];
const LCOLS = new Float32Array(LIGHT.flat());

const store = {
  get(k) { try { return localStorage.getItem('dv87.v1.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('dv87.v1.' + k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem('dv87.v1.' + k); } catch (e) {} },
};

// ---------------------------------------------------------------- state
const applied0 = store.get('applied');
let preview0 = null; try { preview0 = JSON.parse(store.get('preview') || 'null'); } catch (e) {}
if (preview0 && !(preview0.until > Date.now() && THEMES[preview0.i])) { preview0 = null; store.del('preview'); }
const st = {
  sel: preview0 ? preview0.i : (applied0 !== null && THEMES[+applied0] ? +applied0 : 1),
  applied: applied0 !== null && THEMES[+applied0] ? +applied0 : null,
  preview: preview0,
  tint: store.get('tint') !== '0', sun: store.get('sun') === '1',
  a: new Float32Array(6), h: new Float32Array(6), hT: new Float32Array(6), flare: new Float32Array(6),
  glint: [-9, 2, 0], wave: 2, from: [0, 0, 0], to: [0, 0, 0],
  off: [0, 0], offV: [0, 0], offT: [0, 0],
  warm: [1, 1, 1], warmT: [1, 1, 1], stretch: 1, stretchT: 1, pi: 1, piT: 1,
  time: 3.0, speed: 1, intro: false, clock: 0,
  state: 'idle', lastInput: performance.now(), running: false, sleeping: false, frames: 0, idleFrames: 0, dirty: true, scissored: 0,
  fx: false, mode: 'desktop',
};
const firstVisit = st.applied === null && !st.preview;

// ---------------------------------------------------------------- DOM
const panes = $('#panes'), win = $('#win');
const btns = THEMES.map((t, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pane'; b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', `${t.n}, ${t.d}`);
  b.style.setProperty('--pc', t.hex);
  b.innerHTML = `<span class="tag" aria-hidden="true">${t.n}</span>`;
  b.addEventListener('click', () => pick(i, 'pointer'));
  b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { st.hT[i] = 1; wake(); } });
  b.addEventListener('pointerleave', () => { st.hT[i] = 0; wake(); });
  b.addEventListener('focus', () => { if (b.matches(':focus-visible')) { st.hT[i] = 0.6; wake(); } });
  b.addEventListener('blur', () => { st.hT[i] = 0; wake(); });
  panes.appendChild(b);
  return b;
});
panes.addEventListener('keydown', (e) => {
  const i = btns.indexOf(document.activeElement); if (i < 0) return;
  const j = { ArrowRight: (i + 1) % 6, ArrowLeft: (i + 5) % 6, ArrowDown: (i + 2) % 6, ArrowUp: (i + 4) % 6, Home: 0, End: 5 }[e.key];
  if (j !== undefined) { e.preventDefault(); st.hT[i] = 0; btns[j].focus(); st.hT[j] = 0.6; pick(j, 'key'); }
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(i, 'key'); }
});
const el = { tn: $('#tn'), td: $('#td'), chip: $('#chip'), chipT: $('#chip-t'), apply: $('#apply'), applyL: $('#apply-l'), preview: $('#preview'),
  previewL: $('#preview-l'), msg: $('#msg'), revert: $('#revert'), tint: $('#tint'), sun: $('#sun'), sunNote: $('#sun-note'), card: $('#card'), fbpool: $('#fbpool') };

let accT = 0;
function setAccent(delay = 0) {
  const t = THEMES[st.sel];
  clearTimeout(accT);
  if (delay) accT = setTimeout(() => root.style.setProperty('--acc', t.hex), delay); else root.style.setProperty('--acc', t.hex);
  el.tn.textContent = t.n; el.td.textContent = t.d;
  el.chipT.textContent = t.hex; el.chip.setAttribute('aria-label', `Copy accent colour ${t.hex}`);
  btns.forEach((b, k) => { b.setAttribute('aria-checked', String(k === st.sel)); b.tabIndex = k === st.sel ? 0 : -1; });
}
const fmtUntil = (ms) => {
  const d = new Date(ms), now = new Date();
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');   // no Intl: its first use costs a long frame
  return (d.getDate() !== now.getDate() ? 'tomorrow, ' : 'today, ') + hm;
};
function say(text, kind = '') { el.msg.textContent = text; el.msg.className = 'msg' + (kind ? ' ' + kind : ''); }
function syncButtons() {
  const n = THEMES[st.sel].n;
  const isApplied = st.applied === st.sel, isPrev = !!(st.preview && st.preview.i === st.sel);
  if (st.state === 'busy') return;
  el.apply.classList.remove('err'); el.card.classList.remove('err');
  el.apply.classList.toggle('done', isApplied);
  el.apply.setAttribute('aria-disabled', String(LOCKED || isApplied));
  el.applyL.textContent = isApplied ? 'Applied' : 'Apply theme';
  el.preview.setAttribute('aria-disabled', String(LOCKED || isApplied || isPrev));
  el.previewL.textContent = isPrev ? 'Previewing' : 'Preview for a day';
  el.revert.hidden = !st.preview;
  if (LOCKED) say('Appearance is managed by your workspace admin.');
  else if (isPrev) say(`Previewing ${n} until ${fmtUntil(st.preview.until)}.`);
  else if (isApplied) say(`${n} is your theme.`, 'ok');
  else if (st.state === 'picked') say(`Trying ${n}. Apply to keep it, or preview it for a day.`);
}
function emit(extra = {}) {
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: THEMES[st.sel].n.toLowerCase(), accent: THEMES[st.sel].hex, applied: st.applied === st.sel, ...extra } }));
}

// ---------------------------------------------------------------- choreography
function poolColourNow() {
  const w = Math.max(0, Math.min(1, st.wave));
  return st.to.map((v, k) => st.from[k] + (v - st.from[k]) * w);
}
function shiftFor(i) {
  const c = i % 2, r = Math.floor(i / 2), L = layout;
  return [(c - 0.5) * L.shift[0], (r - 1) * L.shift[1]];
}
function pick(i, how) {
  if (LOCKED) return;
  st.lastInput = performance.now();
  if (i === st.sel) { st.flare[i] = Math.max(st.flare[i], 0.5); st.glint = [i, -0.2, 0.7]; wake(); return; }
  st.from = poolColourNow(); st.to = LIGHT[i].slice();
  st.sel = i; st.state = 'picked';
  if (RM.matches) { st.wave = 2; st.from = st.to.slice(); st.a.fill(0); st.a[i] = 1; st.offT = shiftFor(i); st.off = st.offT.slice(); st.offV = [0, 0]; }
  else { st.wave = -0.3; st.flare[i] = 1; st.glint = [i, -0.25, 1]; }
  st.offT = shiftFor(i);
  setAccent(RM.matches || !st.fx ? 0 : 280); syncButtons(); emit();
  if (!st.fx) placeFallback();
  wake();
}
function sunTargets() {
  if (!st.sun) { st.warmT = [1, 1, 1]; st.stretchT = 1; el.sunNote.textContent = 'Warmer panes at dusk, cooler at dawn'; return; }
  const now = new Date();
  const h = Q.has('hour') ? +Q.get('hour') : now.getHours() + now.getMinutes() / 60;
  let w, s, name;
  if (h >= 5 && h < 9) { w = [0.86, 0.95, 1.1]; s = 0.92; name = 'dawn light, cooler'; }
  else if (h >= 9 && h < 16) { w = [1, 0.99, 0.96]; s = 1; name = 'midday light'; }
  else if (h >= 16 && h < 21) { w = [1.14, 0.84, 0.58]; s = 1.12; name = 'dusk light, warmer'; }
  else { w = [0.62, 0.7, 0.92]; s = 1.05; name = 'moonlight, dimmer'; }
  st.warmT = w; st.stretchT = s;
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  el.sunNote.textContent = `Now: ${name} · ${String(hh).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- card controls
el.tint.addEventListener('click', () => {
  st.tint = !st.tint; el.tint.setAttribute('aria-checked', String(st.tint));
  if (st.tint) root.removeAttribute('data-tint'); else root.setAttribute('data-tint', 'off');
  store.set('tint', st.tint ? '1' : '0'); emit({ tint: st.tint });
});
el.sun.addEventListener('click', () => {
  st.sun = !st.sun; el.sun.setAttribute('aria-checked', String(st.sun)); store.set('sun', st.sun ? '1' : '0');
  sunTargets(); if (RM.matches) { st.warm = st.warmT.slice(); st.stretch = st.stretchT; }
  st.lastInput = performance.now(); wake();
});
el.chip.addEventListener('click', async () => {
  const hex = THEMES[st.sel].hex; let ok = false;
  try { await navigator.clipboard.writeText(hex); ok = true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = hex; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-99px;opacity:0';
    document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); el.chip.focus();
  }
  el.chipT.textContent = ok ? 'Copied' : hex;
  say(ok ? `Copied ${hex} to the clipboard.` : `Copy did not work here. The accent is ${hex}.`, ok ? 'ok' : '');
  clearTimeout(el.chip._t); el.chip._t = setTimeout(() => { el.chipT.textContent = THEMES[st.sel].hex; }, 1400);
});
el.apply.addEventListener('click', async () => {
  if (el.apply.getAttribute('aria-disabled') === 'true' || st.state === 'busy') return;
  const i = st.sel, n = THEMES[i].n;
  st.state = 'busy'; el.apply.setAttribute('aria-busy', 'true'); el.applyL.textContent = 'Saving…'; el.apply.classList.remove('err'); el.card.classList.remove('err');
  say(`Saving ${n}…`);
  await new Promise((r) => setTimeout(r, NET));
  el.apply.removeAttribute('aria-busy');
  if (OFFLINE) {
    st.state = 'error'; el.apply.classList.add('err'); el.card.classList.add('err'); el.applyL.textContent = 'Try again';
    say('Couldn’t save: you’re offline. Your pick stays on this device until you reconnect.', 'err');
    return;
  }
  st.applied = i; store.set('applied', String(i));
  st.preview = null; store.del('preview');
  st.state = 'applied'; syncButtons();
  say(`${n} is now your theme.`, 'ok');
  if (!RM.matches) { st.flare[i] = 0.8; st.glint = [i, -0.25, 1]; }
  emit({ applied: true }); st.lastInput = performance.now(); wake();
});
el.preview.addEventListener('click', () => {
  if (el.preview.getAttribute('aria-disabled') === 'true' || st.state === 'busy') return;
  st.preview = { i: st.sel, until: Date.now() + 864e5 }; store.set('preview', JSON.stringify(st.preview));
  st.state = 'preview'; syncButtons(); emit({ preview: st.preview.until });
});
el.revert.addEventListener('click', () => {
  st.preview = null; store.del('preview');
  const back = st.applied !== null ? st.applied : 1;
  st.state = 'idle'; pick(back, 'revert'); st.state = 'idle'; syncButtons();
  say(`Back to ${THEMES[back].n}.`, 'ok');
  el.preview.focus();
});

// ---------------------------------------------------------------- layout (css px, page coordinates)
let layout = null;
function readLayout() {
  const W = root.clientWidth, H = innerHeight;
  const portrait = matchMedia('(max-aspect-ratio: 1/1)').matches;
  const short = !portrait && matchMedia('(max-height: 560px)').matches;
  const fixed = getComputedStyle(win).position === 'fixed';
  const sx = fixed ? 0 : scrollX, sy = fixed ? 0 : scrollY;
  const pr = panes.getBoundingClientRect(), wr = win.getBoundingClientRect();
  const glass = { cx: pr.left + pr.width / 2 + sx, ys: pr.top + sy, hw: pr.width / 2, rh: pr.height / 3, yb: pr.bottom + sy };
  const F = Math.max(0, wr.width / 2 - pr.width / 2);
  const side = $('.side').getBoundingClientRect();
  const docH = Math.max(H, root.scrollHeight), docW = W;
  let O, U, V, axis, shift, mode;
  if (portrait) {
    mode = 'portrait';
    const top = glass.yb + F - 0.03 * H;
    const vh = Math.max(0.62 * H, Math.min(side.bottom + scrollY + 40 - top, 1.15 * H));
    O = [-0.07 * W, top]; U = [1.14 * W, 0.1 * W]; V = [0, vh]; axis = 1; shift = [0.06 * W, 0.02 * H];
  } else if (short) {
    mode = 'short';
    const gr = glass.cx + glass.hw + F;
    O = [gr + 6, 0.06 * H]; U = [W - gr + 30, 0.16 * (W - gr)]; V = [0, 0.95 * H]; axis = 0; shift = [18, 12];
  } else {
    mode = 'desktop';
    const u = Math.min(W / 1600, H / 1000), fx = W / 2 - 800 * u, fy = Math.max(0, (H - 1000 * u) / 2);
    O = [fx + 560 * u, fy + 176 * u]; U = [930 * u, 245 * u]; V = [0, 612 * u]; axis = 0; shift = [44 * u, 30 * u];
  }
  layout = { W, H, docW, docH, glass, F, fixed, O, U, V, axis, shift, mode, block: Math.max(60, Math.round(glass.hw * 0.75)),
    cols: GLASS, wr: { x: wr.left + sx, y: wr.top + sy, w: wr.width, h: wr.height } };
  st.mode = mode;
  st.offT = shiftFor(st.sel);
  return layout;
}

// ---------------------------------------------------------------- renderer + fallback
const canvas = $('#scene'), lightC = $('#light');
const fxdpr = +Q.get('fxdpr') || 0;
let R = null;
function startFx() {
  if (root.classList.contains('no-fx') && Q.has('nofx')) return null;
  const r = createRenderer(canvas, lightC, { fxdpr });
  if (!r) { root.classList.add('no-fx'); return null; }
  root.classList.remove('no-fx');
  return r;
}
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R = null; st.fx = false; root.classList.add('no-fx'); placeFallback(); });
lightC.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R = null; st.fx = false; root.classList.add('no-fx'); placeFallback(); });
const restore = () => {
  if (R) return;
  setTimeout(() => {
    if (R) return;
    const a = canvas.getContext('webgl2') || canvas.getContext('webgl'), b = lightC.getContext('webgl2') || lightC.getContext('webgl');
    if (!a || !b || a.isContextLost() || b.isContextLost()) return;
    R = startFx(); st.fx = !!R; if (R) { readLayout(); R.resize(layout); st.dirty = true; wake(); }
  }, 30);
};
canvas.addEventListener('webglcontextrestored', restore);
lightC.addEventListener('webglcontextrestored', restore);

function archPoly(cx, ys, hw, r, n = 14) {          // points of an equilateral arch (circles of radius r at cx∓hw)
  const pts = [], top = Math.sqrt(r * r - hw * hw);
  for (let k = 0; k <= n; k++) { const y = ys - top * (1 - k / n); const x = cx - (Math.sqrt(r * r - (y - ys) ** 2) - hw); pts.push([x, y]); }
  const right = pts.slice().reverse().map(([x, y]) => [2 * cx - x, y]);
  return pts.concat(right);
}
function placeFallback() {
  if (!layout) return;
  const L = layout, g = L.glass, wr = L.wr;
  // window frame + arch head, as clip paths relative to the .win box
  const ox = wr.x, oy = wr.y;
  const outer = archPoly(g.cx - ox, g.ys - oy, g.hw, 2 * g.hw + L.F), half = outer.length / 2;
  const ring = outer.slice(0, half).concat([[g.cx - ox - g.hw - L.F, wr.h], [g.cx - ox + g.hw + L.F, wr.h]], outer.slice(half));   // apex → left → bottom → right → apex
  const fw = $('.fb-win'), head = $('.fb-head');
  fw.style.clipPath = `polygon(${ring.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
  const inner = archPoly(g.hw, Math.sqrt(3) * g.hw, g.hw, 2 * g.hw);
  Object.assign(head.style, { left: (g.cx - ox - g.hw) + 'px', top: (g.ys - oy - Math.sqrt(3) * g.hw) + 'px', width: 2 * g.hw + 'px', height: Math.sqrt(3) * g.hw + 'px',
    clipPath: `polygon(${inner.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})` });
  btns.forEach((b) => b.style.setProperty('--d', (g.hw / 2.2).toFixed(1) + 'px'));
  const ax = L.fixed ? 0 : scrollX, ay = L.fixed ? 0 : scrollY;
  const sx = L.mode === 'portrait' ? scrollX : 0, sy = L.mode === 'portrait' ? scrollY : 0;
  const o = [L.O[0] + st.offT[0] - sx, L.O[1] + st.offT[1] - sy];
  el.fbpool.style.transform = `matrix(${L.U[0] / 100},${L.U[1] / 100},${L.V[0] / 100},${L.V[1] / 100},${o[0]},${o[1]})`;
  void ax; void ay;
}

// ---------------------------------------------------------------- per-frame values
const F = { light: [0, 0, 0], glint: [-9, 2, 0], beam: { s: [0, 0], e: [0, 0], sw: 1, ew: 1 }, beamC: [0, 0, 0], int: new Float32Array(6), a: new Float32Array(6),
  cols: LCOLS, pool: { o: [0, 0], inv: new Float32Array(4), to: [0, 0, 0], from: [0, 0, 0], wave: 2, wo: [0, 0], wd: [0, 0], i: 1, cloud: 0.12, warm: [1, 1, 1] } };
function frameData() {
  const L = layout;
  // the light pool and the window are anchored to the page (portrait / desktop) or to the screen (short landscape, fixed window)
  const ax = L.fixed ? 0 : scrollX, ay = L.fixed ? 0 : scrollY;
  F.scrollX = scrollX; F.scrollY = scrollY; F.ax = ax; F.ay = ay; F.docW = L.docW; F.docH = L.docH;
  F.glass = { cx: L.glass.cx - ax, ys: L.glass.ys - ay, hw: L.glass.hw, rh: L.glass.rh, yb: L.glass.yb - ay }; F.F = L.F;
  let sa = 0; const lt = [0, 0, 0], sc = [0, 0];
  for (let i = 0; i < 6; i++) {
    const a = st.a[i];
    F.a[i] = a;
    F.int[i] = 0.07 + 2.2 * a + 0.42 * st.h[i] + 0.9 * st.flare[i];
    for (let k = 0; k < 3; k++) lt[k] += LIGHT[i][k] * a;
    const c = i % 2, r = Math.floor(i / 2);
    sc[0] += a * (F.glass.cx - F.glass.hw / 2 + c * F.glass.hw); sc[1] += a * (F.glass.ys + F.glass.rh * (r + 0.5)); sa += a;
  }
  const P = st.pi;
  F.light = lt.map((v, k) => v * P * st.warm[k]);
  F.beamC = F.light;
  F.glint = st.glint;
  const U = [L.U[0] * st.stretch, L.U[1] * st.stretch * st.stretch], V = L.V;
  const o = [L.O[0] + st.off[0] - ax, L.O[1] + st.off[1] - ay];
  const det = U[0] * V[1] - V[0] * U[1];
  const inv = F.pool.inv; inv[0] = V[1] / det; inv[1] = -U[1] / det; inv[2] = -V[0] / det; inv[3] = U[0] / det;
  F.pool.o = o; F.pool.to = st.to; F.pool.from = st.from; F.pool.wave = st.wave;
  F.pool.wo = o; F.pool.wd = L.axis === 0 ? [inv[0], inv[2]] : [inv[1], inv[3]];
  F.pool.i = P; F.pool.cloud = RM.matches ? 0 : 0.13; F.pool.warm = st.warm;
  const ce = [o[0] + U[0] / 2 + V[0] / 2, o[1] + U[1] / 2 + V[1] / 2];
  F.beam.s = sa > 0.01 ? [sc[0] / sa, sc[1] / sa] : [F.glass.cx, F.glass.ys + F.glass.rh * 1.5];
  F.beam.e = ce; F.beam.sw = F.glass.hw * 0.42; F.beam.ew = 0.32 * Math.min(Math.hypot(U[0], U[1]), Math.hypot(V[0], V[1]));
  F.dust = RM.matches ? 0 : 1; F.poolK = 0.55; F.expo = 1.45; F.overK = 0.36; F.time = st.time;
  return F;
}

// ---------------------------------------------------------------- animation step
const approach = (v, t, rate, dt) => v + (t - v) * (1 - Math.exp(-rate * dt));
function step(dt) {
  st.clock += dt;
  let pane = false, poolCh = false;
  for (let i = 0; i < 6; i++) {
    let T = i === st.sel ? 1 : 0;
    if (st.intro && st.clock < 0.15) T = 0;
    const a0 = st.a[i];
    st.a[i] = approach(a0, T, T > a0 ? 5.2 : 7, dt);
    if (Math.abs(st.a[i] - T) < 0.002) st.a[i] = T;
    if (st.a[i] !== a0) poolCh = true;
    const h0 = st.h[i]; st.h[i] = approach(h0, st.hT[i], 12, dt); if (Math.abs(st.h[i] - st.hT[i]) < 0.003) st.h[i] = st.hT[i];
    if (st.h[i] !== h0) pane = true;
    if (st.flare[i] > 0) { st.flare[i] *= Math.exp(-3.6 * dt); if (st.flare[i] < 0.01) st.flare[i] = 0; pane = true; }
  }
  if (st.glint[2] > 0) { st.glint[1] += dt / 0.6; if (st.glint[1] > 1.15) st.glint[2] = Math.max(0, st.glint[2] - dt * 4); pane = true; }
  if (st.wave < 1.4) { st.wave += dt / 0.95; poolCh = true; }
  // the pool slides toward the picked pane's projection (critically damped spring)
  for (let k = 0; k < 2; k++) {
    const w = 9, x = st.off[k] - st.offT[k];
    st.offV[k] += (-w * w * x - 2 * w * st.offV[k]) * dt; st.off[k] += st.offV[k] * dt;
    if (Math.abs(x) < 0.05 && Math.abs(st.offV[k]) < 0.05) { st.off[k] = st.offT[k]; st.offV[k] = 0; } else poolCh = true;
  }
  for (let k = 0; k < 3; k++) { const w0 = st.warm[k]; st.warm[k] = approach(w0, st.warmT[k], 3, dt); if (Math.abs(st.warm[k] - st.warmT[k]) < 0.002) st.warm[k] = st.warmT[k]; if (st.warm[k] !== w0) poolCh = true; }
  const s0 = st.stretch; st.stretch = approach(s0, st.stretchT, 3, dt); if (Math.abs(st.stretch - st.stretchT) < 0.001) st.stretch = st.stretchT; if (st.stretch !== s0) poolCh = true;
  const p0 = st.pi; st.pi = approach(p0, st.piT, 4, dt); if (Math.abs(st.pi - st.piT) < 0.002) st.pi = st.piT; if (st.pi !== p0) poolCh = true;
  if (st.intro && st.wave >= 1.4 && st.a[st.sel] === 1) st.intro = false;
  st.time += dt * st.speed;
  return { pane: pane || poolCh, pool: poolCh };
}

// ---------------------------------------------------------------- scheduler
let lastT = 0, lastIdle = 0;
function scissorRect() {           // window box + the reach of its bloom (css px, screen)
  const L = layout, ax = L.fixed ? 0 : scrollX, ay = L.fixed ? 0 : scrollY, m = 170;
  return [L.wr.x - ax - m, L.wr.y - ay - m, L.wr.w + 2 * m, L.wr.h + 2 * m];
}
function draw(scissor) {
  if (!R) return;
  const f = frameData();
  R.frame(f, scissor);
  if (!scissor) R.over(f); else st.scissored++;
  st.frames++;
}
function tick(now) {
  if (document.hidden || !R) { st.running = false; st.sleeping = true; return; }
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  const ch = step(dt);
  const quiet = now - st.lastInput > SLEEP_AFTER;
  if (ch.pane || st.dirty) {
    draw(ch.pool || st.dirty ? null : scissorRect()); st.dirty = false;
  } else if (!RM.matches && !STATIC && st.speed > 0) {
    if (quiet) st.speed = Math.max(0, st.speed - dt * 1.2);
    if (now - lastIdle >= 32 || st.speed === 0) { lastIdle = now; draw(null); st.idleFrames++; }   // 30 fps idle
  } else {
    st.running = false; st.sleeping = true; return;
  }
  requestAnimationFrame(tick);
}
function wake() {
  if (!R) return;
  if (!RM.matches && !STATIC && st.speed === 0) st.speed = 1;
  if (st.running) return;
  st.running = true; st.sleeping = false; lastT = performance.now();
  requestAnimationFrame(tick);
}
const input = () => { st.lastInput = performance.now(); wake(); };
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, input, { passive: true });
addEventListener('scroll', () => { st.dirty = true; if (!st.fx) placeFallback(); input(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { st.dirty = true; wake(); } });
let rz = 0;
addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { readLayout(); if (R) R.resize(layout); placeFallback(); st.dirty = true; wake(); }); });
RM.addEventListener('change', () => { st.dirty = true; wake(); });

// ---------------------------------------------------------------- boot
let readyRes; const ready = new Promise((r) => (readyRes = r));
window.__stained = {
  ready, THEMES, get R() { return R; }, pick, wake,
  state() {
    return { sel: st.sel, applied: st.applied, preview: st.preview, a: Array.from(st.a), h: Array.from(st.h), wave: st.wave, off: st.off.slice(), offT: st.offT.slice(),
      warm: st.warm.slice(), stretch: st.stretch, tint: st.tint, sun: st.sun, state: st.state, intro: st.intro, time: st.time, speed: st.speed,
      fx: st.fx, running: st.running, sleeping: st.sleeping, frames: st.frames, idleFrames: st.idleFrames, scissored: st.scissored,
      draws: R ? R.draws : 0, overDraws: R ? R.overDraws : 0, px: R ? R.px : 0, bakes: R ? R.bakes : 0, dpr: R ? R.dpr : 0, opx: R ? R.opx : 0,
      canvas: [canvas.width, canvas.height], light: [lightC.width, lightC.height], mode: st.mode, glass: layout && layout.glass, F: layout && layout.F,
      busy: st.state === 'busy' };
  },
};

(async () => {
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) {}
  setAccent();
  el.tint.setAttribute('aria-checked', String(st.tint));
  el.sun.setAttribute('aria-checked', String(st.sun));
  sunTargets(); st.warm = st.warmT.slice(); st.stretch = st.stretchT;
  if (LOCKED) {
    btns.forEach((b) => { b.setAttribute('aria-disabled', 'true'); b.tabIndex = -1; }); btns[st.sel].tabIndex = 0;
    [el.tint, el.sun, el.chip].forEach((b) => (b.disabled = true));
  }
  syncButtons();
  if (st.preview) say(`Previewing ${THEMES[st.sel].n} until ${fmtUntil(st.preview.until)}.`);
  readLayout();
  R = startFx(); st.fx = !!R;
  st.to = LIGHT[st.sel].slice(); st.off = st.offT.slice();
  if (R) R.resize(layout);
  placeFallback();
  if (firstVisit && !RM.matches && !STATIC && R) {
    st.intro = true; st.wave = -0.55; st.from = [0, 0, 0]; st.clock = 0;
  } else {
    st.a[st.sel] = 1; st.from = st.to.slice(); st.wave = 2;
  }
  if (RM.matches || STATIC) st.speed = 0;
  st.dirty = true;
  if (R) { draw(null); wake(); }
  requestAnimationFrame(() => root.classList.add('ready'));
  readyRes(true);
})();

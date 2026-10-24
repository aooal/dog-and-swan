(() => {
'use strict';

/* ============ 設定與工具 ============ */
const CFG = window.GAME_CONFIG;
const MEM = CFG.memories;
const N = MEM.length;
// 每一站要收集的愛心數：可填陣列（每站各自設定），或填單一數字（每站遞增 5 顆）
const goalFor = i => {
  const h = CFG.heartsPerStop;
  if (Array.isArray(h)) return h[Math.min(i, h.length - 1)];
  return (h || 12) + i * 5;
};
const W = 400;
let H = 700;   // 高度會依裝置螢幕比例自動調整（手機長螢幕也能填滿）
const FONT = '"PingFang TC","Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const ease = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const hex2rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const rgbLerp = (A, B, t) => A.map((v, i) => lerp(v, B[i], t));
const rgbStr = a => `rgb(${a.map(Math.round).join(',')})`;

document.title = '小狗騎天鵝 ♥';
$('toName').textContent = CFG.herName || '你';

/* 存檔（失敗也沒關係） */
const KEY = 'dogswan.v1';
const loadSave = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const writeSave = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
let unlocked = clamp(+loadSave().done || 0, 0, N);

/* ============ 畫布縮放 ============ */
const canvas = $('c'), ctx = canvas.getContext('2d'), stageEl = $('stage');
let scale = 1;
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const ar = clamp(vh / vw, 1.6, 2.1);
  H = Math.round(W * ar);
  const w = Math.min(vw, vh / ar), h = w * ar;
  stageEl.style.width = w + 'px';
  stageEl.style.height = h + 'px';
  stageEl.style.setProperty('--u', (w / W) + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = canvas.width / W;
  if (typeof buildMap === 'function') buildMap();
  if (typeof P !== 'undefined' && state === 'ready') P.y = H * .42;
}
window.addEventListener('resize', resize);

/* ============ 音效（Web Audio，無外部檔案） ============ */
let AC = null, muted = false, musicTimer = null, noteI = 0;
// iPhone 的「靜音開關」會讓網頁音效消失，必須把音訊類別改成「播放」才會有聲音
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
let keepAlive = null;
function silentWavUrl() {   // 舊版 iOS 的備援：播放一段無聲音檔，讓系統把網頁視為媒體播放
  const n = 8000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true); new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function ensureKeepAlive() {
  if (navigator.audioSession) return;           // 新版 iOS 不需要備援
  try {
    if (!keepAlive) {
      keepAlive = new Audio(silentWavUrl());
      keepAlive.loop = true; keepAlive.setAttribute('playsinline', '');
    }
    if (keepAlive.paused) { const r = keepAlive.play(); if (r && r.catch) r.catch(() => {}); }
  } catch (e) {}
}
function audioInit() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
    if (AC) AC.onstatechange = () => { if (AC.state !== 'running' && !document.hidden) tryResume(); };
  }
  tryResume(); ensureKeepAlive();
  if (AC && !musicTimer) musicTimer = setInterval(music, 480);
}
function tryResume() {
  if (!AC || AC.state === 'running') return;
  try { const r = AC.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}
function tone(f, d, type = 'sine', vol = .12, slide = 0) {
  if (!AC || muted) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
}
const SCALE = [523, 659, 784, 659, 440, 523, 659, 523, 349, 440, 523, 440, 392, 494, 587, 494];
function music() {
  if (document.hidden) return;
  tone(SCALE[noteI++ % SCALE.length], 1.1, 'sine', .06);
}
const sfx = {
  flap: () => tone(360, .12, 'triangle', .07, 220),
  heart: () => { tone(784, .12, 'sine', .14); setTimeout(() => tone(1175, .18, 'sine', .12), 70); },
  bone: () => { tone(523, .1, 'square', .07); setTimeout(() => tone(784, .1, 'square', .07), 80); setTimeout(() => tone(1047, .16, 'square', .07), 160); },
  hit: () => tone(180, .3, 'sawtooth', .1, -90),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .35, 'triangle', .13), i * 110)),
  bounce: () => tone(240, .1, 'sine', .06, 120),
  power: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, .14, 'square', .06), i * 55)),
  smash: () => { tone(420, .14, 'square', .07, -200); tone(180, .2, 'triangle', .08, -60); }
};
const UNLOCK_EVENTS = ['click', 'touchend', 'pointerup', 'keydown'];
function unlockAudio() {          // 每次碰畫面都檢查一次：從別的 App 回來後，這裡會把音樂接回來
  audioInit();
  if (AC && AC.state === 'running') document.body.classList.add('audio-on');
}
UNLOCK_EVENTS.forEach(ev => document.addEventListener(ev, unlockAudio, true));
$('mute').addEventListener('click', e => {
  e.stopPropagation(); audioInit(); muted = !muted;
  $('mute').textContent = muted ? '🔇' : '🔊';
});

/* ============ 背景配色（隨旅程從早晨走到夜晚） ============ */
const PAL = [
  ['#8fd3ff', '#e9f7ff'],
  ['#78c4f4', '#fff3d9'],
  ['#ffb98a', '#ffe6bd'],
  ['#f58fa8', '#ffcaa2'],
  ['#4a4590', '#d9789a'],
  ['#14163a', '#3d3478']
].map(p => p.map(hex2rgb));
function skyColors(p) {
  const f = clamp(p, 0, 1) * (PAL.length - 1), i = Math.min(PAL.length - 2, Math.floor(f)), t = f - i;
  return [rgbLerp(PAL[i][0], PAL[i + 1][0], t), rgbLerp(PAL[i][1], PAL[i + 1][1], t)];
}
const HILL_DAY = [[150, 205, 170], [112, 186, 132]], HILL_NIGHT = [[44, 48, 98], [28, 34, 72]];
const stars = Array.from({ length: 46 }, () => ({ x: rand(0, W), y: rand(0, 380), r: rand(.8, 2), ph: rand(0, 6) }));
const bgClouds = Array.from({ length: 6 }, (_, i) => ({ x: rand(0, W), y: rand(70, 360), s: rand(.7, 1.4), v: rand(.2, .5) }));

/* ============ 遊戲狀態 ============ */
let state = 'title';           // title ready play over travel card finale
let stage = 0, hearts = 0, lives = 3;
let reached = 0;               // 地圖上已抵達的節點
let travelFrom = 0, travelTo = 1, travelT = 0, finalTravel = false;
let bannerT = 0, shake = 0, scroll = 0, clock = 0, trailT = 0;
let heartDelay = .6, cloudT = 1.6, powerT = 8, boneT = 12;
const fx = { speed: 0, slow: 0, shield: 0 };            // 道具剩餘秒數
const PU = {
  speed:  { name: '加速', color: '#ff9f43', dur: 5 },
  slow:   { name: '緩速', color: '#4d9bff', dur: 6 },
  shield: { name: '無敵', color: '#f7c531', dur: 6 }
};
const pBanner = { t: 0, text: '', color: '#fff' };
const P = { x: 112, y: 300, vy: 0, t: 0, flap: 0, inv: 0 };
const items = [], clouds = [], particles = [];

const speedNow = () => Math.min(200, 140 + 12 * stage);

/* ============ 輸入 ============ */
function flap() { P.vy = -420; P.flap = .32; sfx.flap(); }
function tap() {
  audioInit();
  if (state === 'ready') { state = 'play'; flap(); }
  else if (state === 'play') flap();
}
canvas.addEventListener('pointerdown', e => { e.preventDefault(); tap(); });
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); tap(); }
});

const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

function startFlight() {
  hearts = 0; lives = 3; items.length = 0; clouds.length = 0;
  P.y = H * .42; P.vy = 0; P.inv = 0; P.flap = 0;
  heartDelay = .6; cloudT = 1.6; powerT = rand(6, 9); boneT = 12;
  fx.speed = fx.slow = fx.shield = 0; pBanner.t = 0;
  bannerT = 2.4; state = 'ready';
  ['title', 'card', 'over', 'letter'].forEach(id => hide($(id)));
}
function beginTravel(from, to, isFinal) {
  state = 'travel'; travelFrom = from; travelTo = to; travelT = 0; finalTravel = isFinal;
  items.length = 0; clouds.length = 0;
  reached = from;
}
function onGoal() { sfx.win(); beginTravel(stage, stage + 1, false); }

function lockBtn(btn, ms) {      // 剛出現的畫面，按鈕先鎖一下，避免玩遊戲時狂點的手指誤觸
  btn.disabled = true;
  setTimeout(() => { btn.disabled = false; }, ms);
}
function showCard(i) {
  const m = MEM[i];
  $('cardTitle').textContent = m.title;
  $('cardDate').textContent = m.date || '';
  $('cardText').textContent = m.text;
  const ph = $('cardPhoto');
  const empty = '<div class="ph-empty">🐶🦢</div>';
  ph.innerHTML = '';
  if (m.photo) {
    const img = new Image(); img.alt = m.title;
    img.onerror = () => { ph.innerHTML = empty; };
    img.src = m.photo; ph.appendChild(img);
  } else ph.innerHTML = empty;
  $('cardBtn').textContent = i < N - 1 ? '繼續飛行 ✈' : '前往終點 ♥';
  lockBtn($('cardBtn'), 1500);
  show($('card'));
}
function showLetter() {
  state = 'finale';
  const lp = $('letterPhoto');
  lp.innerHTML = '';
  if (CFG.finale.photo) {
    const img = new Image(); img.alt = '';
    img.onerror = () => lp.classList.add('hidden');
    img.src = CFG.finale.photo; lp.appendChild(img); lp.classList.remove('hidden');
  } else lp.classList.add('hidden');
  $('letterTitle').textContent = CFG.finale.title;
  $('letterText').textContent = CFG.finale.text;
  $('letterFrom').textContent = '— ' + (CFG.fromName || '');
  lockBtn($('btnAgain'), 1500);
  show($('letter'));
}

function refreshTitle() {
  const s = unlocked;
  $('btnStart').classList.toggle('hidden', s > 0);
  $('btnContinue').classList.toggle('hidden', s === 0);
  const pend = Number.isInteger(loadSave().pending);
  $('btnContinue').textContent = s >= N && !pend ? '再看一次最後的信' : '繼續旅程';
  $('btnRestart').classList.toggle('hidden', s === 0);
}
function toTitle() {
  state = 'title'; refreshTitle();
  ['card', 'over', 'letter'].forEach(id => hide($(id))); show($('title'));
}
function fresh() { unlocked = 0; writeSave({ done: 0 }); stage = 0; reached = 0; startFlight(); }

$('btnStart').onclick = () => { audioInit(); fresh(); };
$('btnRestart').onclick = () => { audioInit(); fresh(); };
$('btnContinue').onclick = () => {
  audioInit();
  const sv = loadSave();
  if (Number.isInteger(sv.pending) && sv.pending >= 0 && sv.pending < N) {   // 上次停在某張回憶卡片
    stage = sv.pending; reached = stage + 1; hide($('title')); state = 'card'; showCard(stage); return;
  }
  if (unlocked >= N) { reached = N + 1; $('title').classList.add('hidden'); showLetter(); }
  else { stage = unlocked; reached = unlocked; startFlight(); }
};
$('btnRetry').onclick = () => { startFlight(); };

/* 暫停 / 結束 */
let pausedFrom = 'play';
function pauseGame() {
  if (state !== 'play' && state !== 'ready') return;
  pausedFrom = state; state = 'paused'; show($('pauseMenu'));
}
function resumeGame() {
  if (state !== 'paused') return;
  audioInit();
  state = pausedFrom; hide($('pauseMenu'));
}
function quitGame() {
  hide($('pauseMenu'));
  items.length = 0; clouds.length = 0; particles.length = 0;
  fx.speed = fx.slow = fx.shield = 0;
  toTitle();
}
$('pause').addEventListener('click', e => { e.stopPropagation(); audioInit(); pauseGame(); });
$('btnResume').onclick = resumeGame;
$('btnQuit').onclick = quitGame;
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { state === 'paused' ? resumeGame() : pauseGame(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
  else { tryResume(); ensureKeepAlive(); }
});
window.addEventListener('pageshow', () => { tryResume(); ensureKeepAlive(); });
window.addEventListener('focus', () => { tryResume(); });
$('btnAgain').onclick = () => { toTitle(); };
$('cardBtn').onclick = () => {
  writeSave({ done: unlocked });
  hide($('card'));
  if (stage < N - 1) { stage++; startFlight(); }
  else beginTravel(N, N + 1, true);
};

/* ============ 玩法：生成、碰撞 ============ */
const LO = 130, HI_OFF = 175;
function spawnHeart() {
  const hi = H - HI_OFF;
  let hy = rand(LO, hi), tries = 0;
  while (tries++ < 10 && clouds.some(c => c.x > W - 220 && Math.abs(c.y - hy) < 110)) hy = rand(LO, hi);
  items.push({ type: 'heart', x: W + 40, y: hy, ph: rand(0, 6) });   // 同一時間場上只會有一顆愛心
}
function spawnCloud() {
  const hi = H - HI_OFF;
  const hs = items.filter(i => i.type === 'heart');
  let cy = rand(LO - 20, hi + 20), tries = 0;
  while (tries++ < 10 && hs.some(h => Math.abs(h.y - cy) < 110)) cy = rand(LO - 20, hi + 20);
  const r = rand(26, 36);
  clouds.push({ x: W + 60 + rand(0, 40), y0: cy, y: cy, r, vx: rand(10, 40),
    amp: Math.min(60, stage * 10), f: rand(1, 2), ph: rand(0, 6) });
}
function spawnBone() { items.push({ type: 'bone', x: W + 40, y: rand(LO, H - HI_OFF), ph: 0 }); }
function spawnPower() {
  const kinds = Object.keys(PU);
  items.push({ type: 'pu', kind: kinds[Math.random() * kinds.length | 0], x: W + 40, y: rand(LO, H - HI_OFF), ph: rand(0, 6) });
}
function applyPower(kind) {
  const p = PU[kind];
  if (kind === 'speed') { fx.speed = p.dur; fx.slow = 0; }
  else if (kind === 'slow') { fx.slow = p.dur; fx.speed = 0; }
  else fx.shield = p.dur;
  pBanner.t = 1.6; pBanner.text = p.name + '！'; pBanner.color = p.color;
  sfx.power();
}
function burst(x, y, n, type, color) {
  for (let i = 0; i < n; i++) particles.push({
    x, y, vx: rand(-130, 130), vy: rand(-170, 40), life: 0, max: rand(.5, 1),
    size: rand(4, 9), type, color
  });
}
function hitTest(a, b, r) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r; }

function update(dt) {
  if (state === 'paused') return;
  clock += dt;
  const sp = state === 'play' ? speedNow() * (fx.speed > 0 ? 1.6 : fx.slow > 0 ? .55 : 1) : (state === 'ready' ? 50 : 30);
  scroll += sp * dt;
  bgClouds.forEach(c => { c.x -= c.v * 20 * dt * (state === 'play' ? 1.4 : 1); if (c.x < -120) { c.x = W + 80; c.y = rand(70, 360); } });
  P.t += dt;
  if (P.flap > 0) P.flap -= dt;
  if (P.inv > 0) P.inv -= dt;
  if (shake > 0) shake -= dt;
  if (pBanner.t > 0) pBanner.t -= dt;

  if (state === 'ready') {
    P.y = H * .42 + Math.sin(P.t * 3) * 8; P.vy = 0;
    if (bannerT > 0) bannerT -= dt;
  }
  if (state === 'play') {
    if (bannerT > 0) bannerT -= dt;
    P.vy = Math.min(P.vy + 1500 * dt, 620);
    P.y += P.vy * dt;
    if (P.y < 80) { P.y = 80; P.vy = Math.max(P.vy, 0); }
    if (P.y > H - 95) { P.y = H - 95; P.vy = -380; sfx.bounce(); }

    for (const k in fx) if (fx[k] > 0) fx[k] -= dt;
    if (!items.some(it => it.type === 'heart')) { heartDelay -= dt; if (heartDelay <= 0) spawnHeart(); }
    cloudT -= dt; if (cloudT <= 0) { spawnCloud(); cloudT = Math.max(.9, rand(1.4, 2.0) - stage * .1); }
    powerT -= dt; if (powerT <= 0) { spawnPower(); powerT = rand(9, 14); }
    boneT -= dt;  if (boneT <= 0) { if (lives < 3) spawnBone(); boneT = rand(10, 16); }

    const body = { x: P.x, y: P.y + 8 }, head = { x: P.x + 13, y: P.y - 64 };
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.x -= sp * dt;
      if (it.type === 'heart') {  // 輕微吸附，讓手機操作更友善
        const dx = body.x - it.x, dy = body.y - it.y, d = Math.hypot(dx, dy);
        if (d < 90 && d > 1) { it.x += dx / d * 90 * dt; it.y += dy / d * 90 * dt; }
      }
      const r = it.type === 'heart' ? 34 : 38;
      if (hitTest(body, it, r) || hitTest(head, it, r - 8)) {
        items.splice(i, 1);
        if (it.type === 'heart') {
          hearts++; heartDelay = rand(.4, .9); sfx.heart(); burst(it.x, it.y, 8, 'heart', '#ff6f91');
          if (hearts >= goalFor(stage)) { onGoal(); return; }
        } else if (it.type === 'bone') {
          lives = Math.min(3, lives + 1); sfx.bone(); burst(it.x, it.y, 10, 'spark', '#ffd36b');
        } else {
          applyPower(it.kind); burst(it.x, it.y, 14, 'spark', PU[it.kind].color);
        }
      } else if (it.type === 'heart' ? it.x < P.x - 60 : it.x < -60) {
        items.splice(i, 1);
        if (it.type === 'heart') heartDelay = rand(.4, .9);
      }
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.x -= (sp + c.vx) * dt;
      c.y = c.y0 + Math.sin(clock * c.f + c.ph) * c.amp;
      const touch = hitTest(body, c, c.r * .8 + 22) || hitTest(head, c, c.r * .8 + 12);
      if (touch && fx.shield > 0) {            // 無敵：直接撞散烏雲
        clouds.splice(i, 1); sfx.smash(); burst(c.x, c.y, 14, 'puff', '#dfe3f5'); continue;
      }
      if (touch && P.inv <= 0) {
        lives--; P.inv = 1.6; P.vy = -230; shake = .3; sfx.hit();
        burst(P.x, P.y - 10, 10, 'puff', '#9aa0c0');
        if (lives <= 0) { state = 'over'; lockBtn($('btnRetry'), 900); show($('over')); }
      }
      if (c.x < -90) clouds.splice(i, 1);
    }
    trailT -= dt;
    if (trailT <= 0) {
      trailT = .07;
      particles.push({ x: P.x - 52, y: P.y + 12, vx: -sp * .6, vy: rand(-12, 12), life: 0, max: .6, size: rand(2, 4), type: 'spark', color: '#fff6c8' });
    }
  }
  if (state === 'travel') {
    travelT += dt / 2.3;
    if (travelT >= 1) {
      travelT = 1; reached = travelTo;
      if (finalTravel) { unlocked = N; writeSave({ done: N }); showLetter(); }
      else {
        state = 'card'; unlocked = Math.max(unlocked, stage + 1);
        writeSave({ done: unlocked, pending: stage }); showCard(stage);
      }
    }
  }
  if (state === 'finale' || state === 'card') {
    if (state === 'finale' && Math.random() < dt * 9) {
      particles.push({ x: rand(0, W), y: H + 20, vx: rand(-15, 15), vy: rand(-140, -70), life: 0, max: 6,
        size: rand(8, 18), type: 'heart', color: ['#ff6f91', '#ff9fb5', '#ffc2d1', '#ffb347'][Math.random() * 4 | 0], float: true });
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (!q.float) q.vy += 300 * dt;
    if (q.life > q.max) particles.splice(i, 1);
  }
}

/* ============ 繪圖：基本形狀 ============ */
function heartPath(c, s) {
  c.beginPath();
  c.moveTo(0, s * .9);
  c.bezierCurveTo(-s * 1.4, -s * .05, -s * .95, -s * .95, 0, -s * .38);
  c.bezierCurveTo(s * .95, -s * .95, s * 1.4, -s * .05, 0, s * .9);
  c.closePath();
}
function drawHeart(x, y, s, fill, rot = 0, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  heartPath(ctx, s); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
}
function ell(x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function label(str, x, y, size, fill, align = 'center', weight = '700', outline) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = outline; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}

/* ============ 繪圖：黃金獵犬騎天鵝 ============ */
function drawSprite(x, y, s, rot, t, flapOn, vy) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);

  /* --- 天鵝 --- */
  const wing = -.25 + Math.sin(t * (flapOn ? 22 : 5)) * (flapOn ? .75 : .25);
  // 遠側翅膀
  ctx.save(); ctx.translate(-4, 4); ctx.rotate(wing * .8 - .1);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -44, -78, -22); ctx.quadraticCurveTo(-40, -2, 0, 4);
  ctx.fillStyle = '#d8e3f2'; ctx.fill(); ctx.restore();
  // 尾羽
  ctx.beginPath(); ctx.moveTo(-40, 6); ctx.quadraticCurveTo(-62, -2, -76, -18); ctx.quadraticCurveTo(-60, 10, -38, 20);
  ctx.fillStyle = '#eef3fa'; ctx.fill();
  // 身體
  const g = ctx.createLinearGradient(0, -18, 0, 36); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dde7f4');
  ctx.beginPath(); ctx.ellipse(0, 8, 52, 27, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  // 脖子
  ctx.lineCap = 'round';
  const neck = () => { ctx.beginPath(); ctx.moveTo(34, 4); ctx.bezierCurveTo(64, 4, 38, -34, 58, -54); };
  neck(); ctx.lineWidth = 15; ctx.strokeStyle = '#d3dfef'; ctx.stroke();
  neck(); ctx.lineWidth = 12; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  // 頭與嘴
  ctx.beginPath(); ctx.arc(62, -57, 9.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(69, -60); ctx.lineTo(90, -53); ctx.lineTo(69, -50); ctx.closePath(); ctx.fillStyle = '#f7a24b'; ctx.fill();
  ell(70, -58, 3.2, 3.2, '#3a2a30');
  ell(64, -60, 2.2, 2.2, '#3a2a30'); ell(64.7, -60.7, .8, .8, '#fff');
  // 近側翅膀
  ctx.save(); ctx.translate(-10, 6); ctx.rotate(wing);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-26, -50, -82, -24); ctx.quadraticCurveTo(-42, -4, 4, 8);
  ctx.fillStyle = '#f6f9ff'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#c9d8ec'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-20, -8); ctx.quadraticCurveTo(-45, -22, -66, -16); ctx.strokeStyle = '#d5e1f1'; ctx.stroke();
  ctx.restore();

  /* --- 黃金獵犬 --- */
  ctx.save(); ctx.translate(0, -20);
  const wag = Math.sin(t * 13) * 9;
  const earSwing = .18 + Math.sin(t * 9) * .12 - clamp(vy, -300, 500) * .0008;
  // 尾巴
  ctx.beginPath(); ctx.moveTo(-14, -8); ctx.quadraticCurveTo(-34, -6, -36, -26 + wag);
  ctx.lineWidth = 11; ctx.strokeStyle = '#dc9a3d'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, -8); ctx.quadraticCurveTo(-34, -6, -36, -26 + wag);
  ctx.lineWidth = 5; ctx.strokeStyle = '#f0c179'; ctx.stroke();
  // 後腿、身體、胸毛、前腳
  ell(-7, -7, 15, 11, '#d99a3f');
  ell(2, -17, 19, 16, '#e5aa4a');
  ell(14, -10, 9, 12, '#f2c47c');
  ell(14, -1, 5.5, 8, '#e5aa4a'); ell(15, 5, 6, 3.4, '#f5d49b');
  // 圍巾
  ctx.beginPath(); ctx.moveTo(2, -30); ctx.quadraticCurveTo(-14, -30 + Math.sin(t * 10) * 4, -34, -26 + Math.sin(t * 10 + 1) * 6);
  ctx.lineWidth = 7; ctx.strokeStyle = '#e8566e'; ctx.stroke();
  ell(10, -31, 12, 5.5, '#ee6a82');
  // 遠側耳
  ctx.save(); ctx.translate(21, -57); ctx.rotate(-.35 - earSwing * .6); ell(0, 8, 6, 12, '#b57729'); ctx.restore();
  // 頭
  ell(13, -46, 16.5, 15.5, '#efb657');
  ell(8, -60, 8, 4, '#f2bf68');           // 頭頂毛
  ell(26, -41, 11.5, 8.5, '#f8dfa9');      // 口鼻
  ell(35, -44, 3.8, 3.2, '#3a2a30');       // 鼻子
  ell(34.3, -45, 1.1, .8, '#fff');
  ctx.beginPath(); ctx.arc(29, -39, 5, .15 * Math.PI, .85 * Math.PI);
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#7a4b32'; ctx.stroke();
  ell(29, -34 + Math.sin(t * 8) * .8, 3.6, 5, '#ff8fa6');   // 舌頭
  ell(20, -51, 2.9, 3.2, '#3a2a30'); ell(21, -52, 1, 1, '#fff'); // 眼睛
  ell(14, -42, 4.2, 3, 'rgba(255,130,130,.4)');             // 腮紅
  // 近側垂耳
  ctx.save(); ctx.translate(6, -56); ctx.rotate(earSwing); ell(0, 11, 7.5, 14, '#c0812f'); ctx.restore();
  ctx.restore();

  ctx.restore();
}

/* ============ 繪圖：場景 ============ */
function drawScene() {
  const p = state === 'title' ? 0 : clamp((stage + hearts / goalFor(stage)) / N, 0, 1);
  const [top, bot] = skyColors(p);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, rgbStr(top)); sky.addColorStop(1, rgbStr(bot));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  const night = clamp((p - .5) / .45, 0, 1);
  // 星星
  const sa = clamp((p - .62) * 3, 0, 1);
  if (sa > 0) stars.forEach(s => {
    ctx.globalAlpha = sa * (.55 + .45 * Math.sin(clock * 2 + s.ph));
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;
  // 太陽
  const sunY = lerp(150, 560, clamp(p / .78, 0, 1)), sunA = 1 - clamp((p - .72) * 5, 0, 1);
  if (sunA > 0) {
    const sg = ctx.createRadialGradient(W * .72, sunY, 8, W * .72, sunY, 120);
    sg.addColorStop(0, `rgba(255,236,170,${.9 * sunA})`); sg.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = sunA; ell(W * .72, sunY, 38, 38, '#fff1b8'); ctx.globalAlpha = 1;
  }
  // 月亮
  const ma = clamp((p - .7) * 4, 0, 1);
  if (ma > 0) {
    ctx.globalAlpha = ma;
    const mg = ctx.createRadialGradient(W * .3, 170, 6, W * .3, 170, 90);
    mg.addColorStop(0, 'rgba(255,248,214,.5)'); mg.addColorStop(1, 'rgba(255,248,214,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 60, W, 220);
    ctx.save(); ctx.beginPath();
    ctx.rect(0, 0, W, H); ctx.arc(W * .3 + 13, 163, 24, 0, Math.PI * 2);
    ctx.clip('evenodd');
    ctx.beginPath(); ctx.arc(W * .3, 170, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8d6'; ctx.fill(); ctx.restore();
    ctx.globalAlpha = 1;
  }
  // 背景雲
  const cc = rgbLerp([255, 255, 255], [190, 170, 220], night);
  bgClouds.forEach(c => {
    ctx.globalAlpha = .75 - night * .3; ctx.fillStyle = rgbStr(cc);
    const s = c.s * 30;
    [[0, 0, 1], [-1, .25, .75], [1, .2, .8], [.4, -.45, .7]].forEach(([dx, dy, k]) => {
      ctx.beginPath(); ctx.arc(c.x + dx * s, c.y + dy * s, s * k, 0, 7); ctx.fill();
    });
  });
  ctx.globalAlpha = 1;
  // 丘陵
  const far = rgbLerp(HILL_DAY[0], HILL_NIGHT[0], night), near = rgbLerp(HILL_DAY[1], HILL_NIGHT[1], night);
  hill(H - 150, 26, .012, .25, far);
  hill(H - 82, 20, .018, .6, near);
}
function hill(base, amp, freq, sf, col) {
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 10; x += 10) {
    const xx = x + scroll * sf;
    ctx.lineTo(x, base + Math.sin(xx * freq) * amp + Math.sin(xx * freq * 2.3 + 1.7) * amp * .4);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = rgbStr(col); ctx.fill();
}

function drawCloud(c) {
  const r = c.r;
  ctx.fillStyle = '#7d82a6';
  [[0, 0, 1], [-.9, .3, .72], [.9, .25, .78], [.2, -.55, .7]].forEach(([dx, dy, k]) => {
    ctx.beginPath(); ctx.arc(c.x + dx * r, c.y + dy * r, r * k, 0, 7); ctx.fill();
  });
  ctx.fillStyle = '#9096b8'; ctx.beginPath(); ctx.arc(c.x - r * .15, c.y - r * .15, r * .72, 0, 7); ctx.fill();
  ell(c.x - r * .3, c.y - r * .05, 2.6, 3.2, '#3a3550'); ell(c.x + r * .3, c.y - r * .05, 2.6, 3.2, '#3a3550');
  ctx.beginPath(); ctx.arc(c.x, c.y + r * .38, r * .22, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#3a3550'; ctx.stroke();
}
function drawBone(x, y, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 3) * .3 - .5);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e2c88f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-16, -5, 32, 10, 5); ctx.fill(); ctx.stroke();
  [[-17, -6], [-17, 6], [17, -6], [17, 6]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(dx, dy, 6.5, 0, 7); ctx.fill(); ctx.stroke(); });
  ctx.fillStyle = '#fff'; ctx.fillRect(-14, -4, 28, 8);
  ctx.restore();
}
function drawPower(x, y, kind, t) {
  const col = PU[kind].color, r = 24 + Math.sin(t * 5) * 1.5;
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = .3; ell(0, 0, r + 9, r + 9, col); ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(-7, -8, 3, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.3, col); g.addColorStop(1, col);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath();
  if (kind === 'speed') {
    [[3, -14], [-8, 3], [-1, 3], [-4, 14], [8, -4], [1, -4]].forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  } else if (kind === 'slow') {
    ctx.moveTo(-8, -12); ctx.lineTo(8, -12); ctx.lineTo(0, 0); ctx.closePath();
    ctx.moveTo(-8, 12); ctx.lineTo(8, 12); ctx.lineTo(0, 0);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 6 : 14;
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  label(PU[kind].name, x, y + r + 14, 12, '#fff', 'center', '800', col);
}
function drawParticles() {
  particles.forEach(q => {
    const a = 1 - q.life / q.max;
    if (q.type === 'heart') drawHeart(q.x, q.y, q.size * (q.float ? 1 : .8), q.color, Math.sin(q.life * 3) * .3, a);
    else { ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (q.type === 'puff' ? 1.4 : 1) * a + .5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  });
}

function drawHUD() {
  for (let i = 0; i < 3; i++) {
    if (i < lives) drawHeart(26 + i * 28, 28, 10, '#ff5f84');
    else { ctx.globalAlpha = .45; drawHeart(26 + i * 28, 28, 10, '#ffffff'); ctx.globalAlpha = 1; }
  }
  const bw = 150, bx = W / 2 - bw / 2 + 6, by = 22;
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 7); ctx.fill();
  const f = hearts / goalFor(stage);
  if (f > 0) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ffb3c6'); g.addColorStop(1, '#ff5f84');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(14, bw * f), 14, 7); ctx.fill();
  }
  drawHeart(bx + bw + 14, by + 7, 8, '#ff5f84');
  label(`第 ${stage + 1} / ${N} 站　${hearts}/${goalFor(stage)}`, W / 2 + 6, 52, 13, '#fff', 'center', '700', 'rgba(120,60,80,.45)');
  let py = 68;
  Object.keys(PU).forEach(k => {
    if (fx[k] <= 0) return;
    const w = 110, x = W / 2 - w / 2 + 6;
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.roundRect(x, py, w, 16, 8); ctx.fill();
    ctx.fillStyle = PU[k].color; ctx.beginPath(); ctx.roundRect(x, py, Math.max(16, w * fx[k] / PU[k].dur), 16, 8); ctx.fill();
    label(PU[k].name, x + w / 2, py + 8.5, 11, '#fff', 'center', '800', 'rgba(0,0,0,.3)');
    py += 22;
  });
}

/* ============ 繪圖：旅程地圖 ============ */
const nodes = [], pathPts = [], nodeIdx = [];
function buildMap() {
  nodes.length = pathPts.length = nodeIdx.length = 0;
  for (let i = 0; i < N + 2; i++) {
    nodes.push({ x: W / 2 + Math.sin(i * 1.35 + .3) * 105, y: (H - 120) - i * ((H - 250) / (N + 1)) });
  }
  const cr = (a, b, c, d, t) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[Math.max(0, i - 1)], p1 = nodes[i], p2 = nodes[i + 1], p3 = nodes[Math.min(nodes.length - 1, i + 2)];
    nodeIdx.push(pathPts.length);
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      pathPts.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t) });
    }
  }
  nodeIdx.push(pathPts.length); pathPts.push({ x: nodes[nodes.length - 1].x, y: nodes[nodes.length - 1].y });
}
function pathAt(idx) {
  const i = clamp(Math.floor(idx), 0, pathPts.length - 2), t = idx - i;
  const a = pathPts[i], b = pathPts[i + 1];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), ang: Math.atan2(b.y - a.y, b.x - a.x) };
}

function drawMap() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#bfe6ff'); g.addColorStop(.6, '#e8f6ff'); g.addColorStop(1, '#fff2dc');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  bgClouds.forEach(c => {
    ctx.globalAlpha = .8; ctx.fillStyle = '#fff'; const s = c.s * 26;
    [[0, 0, 1], [-1, .25, .75], [1, .2, .8]].forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(c.x + dx * s, c.y + dy * s, s * k, 0, 7); ctx.fill(); });
  });
  ctx.globalAlpha = 1;
  // 小島
  nodes.forEach((n, i) => {
    ell(n.x, n.y + 14, 40, 15, 'rgba(120,170,140,.25)');
    ell(n.x, n.y + 9, 34, 12, '#b9e3b0');
    ell(n.x, n.y + 5, 28, 8, '#cdeec4');
  });
  // 路徑（未走：虛線；已走：粉紅）
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pathPts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.setLineDash([2, 13]); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke(); ctx.setLineDash([]);
  const upto = state === 'travel'
    ? lerp(nodeIdx[travelFrom], nodeIdx[travelTo], ease(travelT))
    : nodeIdx[Math.min(reached, nodes.length - 1)];
  ctx.beginPath();
  for (let i = 0; i <= Math.floor(upto) && i < pathPts.length; i++) i ? ctx.lineTo(pathPts[i].x, pathPts[i].y) : ctx.moveTo(pathPts[i].x, pathPts[i].y);
  const e = pathAt(upto); ctx.lineTo(e.x, e.y);
  ctx.setLineDash([2, 13]); ctx.lineWidth = 6; ctx.strokeStyle = '#ff7a9c'; ctx.stroke(); ctx.setLineDash([]);

  // 節點
  nodes.forEach((n, i) => {
    const visited = i <= reached, last = i === nodes.length - 1, first = i === 0;
    const r = last ? 26 : 19;
    ell(n.x, n.y - 6, r + 4, r + 4, 'rgba(255,255,255,.9)');
    ell(n.x, n.y - 6, r, r, visited ? '#ff7a9c' : '#d3dbe8');
    if (first) label('起', n.x, n.y - 6, 16, '#fff');
    else if (last) drawHeart(n.x, n.y - 7, visited ? 15 : 13, visited ? '#fff' : '#f4f7fb');
    else if (visited) drawHeart(n.x, n.y - 7, 9.5, '#fff');
    else label('?', n.x, n.y - 6, 17, '#fff');
    if (!first && !last && visited) {
      let t = MEM[i - 1].title; if (t.length > 9) t = t.slice(0, 9) + '…';
      label(t, n.x, n.y + 24, 13, '#8a4a5c', 'center', '700', 'rgba(255,255,255,.95)');
    }
  });

  // 旅行中的小狗與天鵝
  let pos, ang = 0;
  if (state === 'travel') { const q = pathAt(lerp(nodeIdx[travelFrom], nodeIdx[travelTo], ease(travelT))); pos = q; ang = Math.sin(q.ang) * .15; }
  else pos = nodes[Math.min(reached, nodes.length - 1)];
  const bob = Math.sin(clock * 4) * 4;
  drawSprite(pos.x, pos.y - 44 + bob, .52, ang, clock, state === 'travel', 0);
  if (state === 'travel' && Math.random() < .5) particles.push({ x: pos.x - 24, y: pos.y - 36, vx: rand(-20, 0), vy: rand(-20, 10), life: 0, max: .7, size: rand(2, 4), type: 'spark', color: '#fff3b8' });
  if (state === 'travel') label(`前往第 ${travelTo} 站…`, W / 2, 40, 16, '#fff', 'center', '700', 'rgba(255,122,156,.8)');
}

/* ============ 主繪圖與迴圈 ============ */
function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (shake > 0) ctx.translate(rand(-5, 5) * shake * 3, rand(-5, 5) * shake * 3);

  if (state === 'travel' || state === 'card' || state === 'finale') {
    drawMap(); drawParticles(); return;
  }
  drawScene();
  if (state === 'title') {
    drawSprite(W / 2, H * .6 + Math.sin(clock * 2.5) * 10, 1.35, Math.sin(clock * 1.5) * .05, clock, false, 0);
    drawParticles(); return;
  }
  items.forEach(it => {
    const bob = Math.sin(clock * 4 + it.ph) * 4;
    if (it.type === 'heart') drawHeart(it.x, it.y + bob, 15 + Math.sin(clock * 6 + it.ph) * 1.2, '#ff5f84');
    else if (it.type === 'bone') drawBone(it.x, it.y + bob, clock);
    else drawPower(it.x, it.y + bob, it.kind, clock);
  });
  clouds.forEach(drawCloud);
  drawParticles();
  const blink = P.inv > 0 && Math.floor(P.inv * 12) % 2 === 0;
  if (blink) ctx.globalAlpha = .4;
  drawSprite(P.x, P.y, 1, clamp(P.vy / 900, -.35, .5), P.t, P.flap > 0, P.vy);
  ctx.globalAlpha = 1;
  if (fx.shield > 0 && (fx.shield > 1.5 || Math.floor(clock * 8) % 2 === 0)) {
    ctx.save(); ctx.translate(P.x + 5, P.y - 20); ctx.scale(98 / 72, 1);
    const g = ctx.createRadialGradient(0, 0, 36, 0, 0, 72);
    g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(.8, 'rgba(255,220,100,.3)'); g.addColorStop(1, 'rgba(255,240,160,.85)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 72, 0, 7); ctx.fill(); ctx.restore();
  }
  if (fx.speed > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = W + 60 - ((i * 97 + clock * 900) % (W + 140)), y = (i * 83 + 40) % H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46, y); ctx.stroke();
    }
  }
  if (fx.slow > 0) { ctx.fillStyle = 'rgba(110,170,255,.14)'; ctx.fillRect(0, 0, W, H); }
  drawHUD();
  if (pBanner.t > 0) {
    ctx.globalAlpha = clamp(pBanner.t, 0, 1);
    label(pBanner.text, W / 2, 190, 34, '#fff', 'center', '800', pBanner.color);
    ctx.globalAlpha = 1;
  }
  if (bannerT > 0) {
    ctx.globalAlpha = clamp(bannerT, 0, 1);
    label(`第 ${stage + 1} 站`, W / 2, 130, 34, '#fff', 'center', '800', 'rgba(255,122,156,.85)');
    ctx.globalAlpha = 1;
  }
  if (state === 'ready') {
    const a = .6 + .4 * Math.sin(clock * 5);
    ctx.globalAlpha = a;
    label('點一下螢幕，拍拍翅膀！', W / 2, H * .62, 20, '#fff', 'center', '800', 'rgba(255,122,156,.85)');
    label('收集愛心 ♥　躲開烏雲　撿道具有驚喜', W / 2, H * .62 + 30, 15, '#fff', 'center', '700', 'rgba(255,122,156,.85)');
    ctx.globalAlpha = 1;
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  update(dt); render();
  const showPause = state === 'ready' || state === 'play';
  if (showPause === $('pause').classList.contains('hidden')) $('pause').classList.toggle('hidden', !showPause);
  requestAnimationFrame(loop);
}
resize();
refreshTitle();
requestAnimationFrame(loop);

/* 除錯用：網址加上 ?debug 才會開放 */
if (location.search.includes('debug')) {
  window.__g = {
    get state() { return state; }, get hearts() { return hearts; }, get lives() { return lives; },
    get stage() { return stage; },
    setHearts(n) { hearts = n; }, setStage(n) { stage = n; },
    goal() { onGoal(); }, protect() { lives = 99; },
    power(k) { applyPower(k); }, pause() { pauseGame(); }, resume() { resumeGame(); }, spawnPower() { spawnPower(); }, get items() { return items.map(i => ({ type: i.type, x: i.x, y: i.y })); }, get P() { return { y: P.y, vy: P.vy }; }, get fx() { return { ...fx }; }
  };
}
})();

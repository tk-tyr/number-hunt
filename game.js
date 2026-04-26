'use strict';

// ===== ランク閾値 [秒, 絵文字, ラベル] =====
// 達人基準: N × G² - G  (N: simple=1, hard=2, vhard=3, hell=4 / G: グリッドサイズ)
// 伝説 = 達人×2/3  上級 = 達人×3/2  中級 = 達人×5/2  初級 = 達人×4
const RANKS = {
  '3x3': {
    simple: [[4,'👑','伝説'],[6,'🏆','達人'],[9,'🥇','上級'],[15,'🥈','中級'],[24,'🥉','初級']],
    hard:   [[10,'👑','伝説'],[15,'🏆','達人'],[23,'🥇','上級'],[38,'🥈','中級'],[60,'🥉','初級']],
    vhard:  [[16,'👑','伝説'],[24,'🏆','達人'],[36,'🥇','上級'],[60,'🥈','中級'],[96,'🥉','初級']],
    hell:   [[22,'👑','伝説'],[33,'🏆','達人'],[50,'🥇','上級'],[83,'🥈','中級'],[132,'🥉','初級']],
  },
  '4x4': {
    simple: [[8,'👑','伝説'],[12,'🏆','達人'],[18,'🥇','上級'],[30,'🥈','中級'],[48,'🥉','初級']],
    hard:   [[19,'👑','伝説'],[28,'🏆','達人'],[42,'🥇','上級'],[70,'🥈','中級'],[112,'🥉','初級']],
    vhard:  [[29,'👑','伝説'],[44,'🏆','達人'],[66,'🥇','上級'],[110,'🥈','中級'],[176,'🥉','初級']],
    hell:   [[40,'👑','伝説'],[60,'🏆','達人'],[90,'🥇','上級'],[150,'🥈','中級'],[240,'🥉','初級']],
  },
  '5x5': {
    simple: [[13,'👑','伝説'],[20,'🏆','達人'],[30,'🥇','上級'],[50,'🥈','中級'],[80,'🥉','初級']],
    hard:   [[30,'👑','伝説'],[45,'🏆','達人'],[68,'🥇','上級'],[113,'🥈','中級'],[180,'🥉','初級']],
    vhard:  [[47,'👑','伝説'],[70,'🏆','達人'],[105,'🥇','上級'],[175,'🥈','中級'],[280,'🥉','初級']],
    hell:   [[63,'👑','伝説'],[95,'🏆','達人'],[143,'🥇','上級'],[238,'🥈','中級'],[380,'🥉','初級']],
  },
};

// 難易度別ペナルティ（ミス1回あたりの加算秒数）
const PENALTIES = { simple: 1, hard: 2, vhard: 3, hell: 4 };

let currentGrid   = 5;
let currentMode   = 'simple';
let problems      = [];
let nextNum       = 1;
let timerInterval = null;
let startMs       = 0;
let lastElapsed   = 0;
let penaltyCount  = 0;  // ミス回数

// ===== ベストタイム =====
function bestKey()      { return `nh-best-${currentGrid}x${currentGrid}-${currentMode}`; }
function getBest()      { return parseFloat(localStorage.getItem(bestKey())) || null; }
function saveBest(t)    { localStorage.setItem(bestKey(), String(t)); }

// ===== 画面切替 =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function showTitle() {
  if (timerInterval) clearInterval(timerInterval);
  refreshTitle();
  showScreen('title');
}

function refreshTitle() {
  const best = getBest();
  document.getElementById('best-display').textContent = best ? `ベスト: ${fmt(best)}秒` : '';
  document.getElementById('mode-desc').textContent = MODE_INFO[currentMode]?.desc || '';
}

// ===== グリッドサイズ選択 =====
function selectSize(size) {
  currentGrid = size;
  document.querySelectorAll('#size-btns .sel-btn').forEach(btn => {
    btn.classList.toggle('selected', Number(btn.dataset.size) === size);
  });
  refreshTitle();
}

// ===== モード選択 =====
function selectMode(mode) {
  currentMode = mode;
  document.querySelectorAll('#mode-btns .sel-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === mode);
  });
  refreshTitle();
}

// ===== ゲーム開始 =====
function startGame() {
  const count = currentGrid * currentGrid;
  problems     = generateProblems(currentMode, currentGrid);
  nextNum      = 1;
  lastElapsed  = 0;
  penaltyCount = 0;

  showScreen('game');
  renderGrid();
  document.getElementById('next-display').textContent = '1';
  document.getElementById('timer').textContent = '0.00';
  document.getElementById('math-note').textContent =
    (currentMode === 'vhard' || currentMode === 'hell') ? '×÷は＋－より先に計算' : '';
  updatePenaltyInfo();

  if (timerInterval) clearInterval(timerInterval);
  startMs = Date.now();
  timerInterval = setInterval(() => {
    const el = document.getElementById('timer');
    if (el) el.textContent = fmt((Date.now() - startMs) / 1000);
  }, 50);
}

// ===== グリッド描画 =====
function renderGrid() {
  const grid = document.getElementById('grid');
  grid.className = `grid-${currentGrid}`;
  grid.innerHTML = '';
  problems.forEach(({ display, answer }) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = display;
    const len = display.length;
    if      (len >= 8) cell.dataset.len = 'xl';
    else if (len >= 6) cell.dataset.len = 'l';
    else if (len >= 4) cell.dataset.len = 'm';
    cell.addEventListener('click', () => onTap(cell, answer), { passive: true });
    grid.appendChild(cell);
  });
}

// ===== タップ処理 =====
function onTap(cell, answer) {
  if (cell.classList.contains('done')) return;
  if (answer === nextNum) {
    cell.classList.add('hit');
    beep(660, 0.08);
    setTimeout(() => {
      cell.classList.remove('hit');
      cell.classList.add('done');
      cell.textContent = '✓';
      delete cell.dataset.len;
    }, 180);
    nextNum++;
    const count = currentGrid * currentGrid;
    if (nextNum <= count) {
      document.getElementById('next-display').textContent = nextNum;
    } else {
      endGame();
    }
  } else {
    if (!cell.classList.contains('miss')) {
      cell.classList.add('miss');
      beep(180, 0.12, 0.12);
      setTimeout(() => cell.classList.remove('miss'), 220);

      // ペナルティ加算: startMs を後ろにずらすことでタイマーを即時進める
      const penaltySec = PENALTIES[currentMode] ?? 0;
      startMs -= penaltySec * 1000;
      penaltyCount++;
      updatePenaltyInfo();
      showPenaltyFlash(penaltySec);
    }
  }
}

// ===== ペナルティ表示 =====
function updatePenaltyInfo() {
  const penaltySec = PENALTIES[currentMode] ?? 0;
  const el = document.getElementById('penalty-info');
  if (!el) return;
  if (penaltyCount === 0) {
    el.textContent = `ミス: ＋${penaltySec}秒／回`;
  } else {
    const total = penaltySec * penaltyCount;
    el.textContent = `ミス: ＋${penaltySec}秒／回　　累計 ＋${total}秒（${penaltyCount}回）`;
  }
}

function showPenaltyFlash(sec) {
  const el = document.getElementById('penalty-flash');
  if (!el) return;
  el.textContent = `＋${sec}秒`;
  el.classList.remove('show');
  void el.offsetWidth; // reflow でアニメーションをリセット
  el.classList.add('show');
}

// ===== ゲーム終了 =====
function endGame() {
  clearInterval(timerInterval);
  lastElapsed = (Date.now() - startMs) / 1000;
  const best = getBest();
  const isNewBest = !best || lastElapsed < best;
  if (isNewBest) saveBest(lastElapsed);
  beep(880, 0.12);
  setTimeout(() => beep(1100, 0.18), 110);
  showResult(isNewBest);
}

// ===== リザルト表示 =====
function showResult(isNewBest) {
  const { emoji, label, guide } = getRank(lastElapsed);
  const modeName  = MODE_INFO[currentMode]?.label || currentMode;
  const gridLabel = `${currentGrid}×${currentGrid}`;

  const penaltySec = PENALTIES[currentMode] ?? 0;
  const penaltyTotal = penaltySec * penaltyCount;

  document.getElementById('result-combo').textContent = `${gridLabel}  ${modeName}`;
  document.getElementById('result-time').textContent  = fmt(lastElapsed);
  document.getElementById('result-rank').textContent  = `${emoji} ${label}`;
  document.getElementById('result-rank-guide').textContent = guide;

  const penaltyEl = document.getElementById('result-penalty');
  if (penaltyCount > 0) {
    penaltyEl.textContent = `ペナルティ ＋${penaltyTotal}秒（ミス${penaltyCount}回 × ${penaltySec}秒）`;
  } else {
    penaltyEl.textContent = 'ノーミス！';
  }

  const best = getBest();
  document.getElementById('result-best').textContent = isNewBest
    ? '🎉 新記録！'
    : `ベスト: ${fmt(best)}秒`;

  showScreen('result');
}

// ===== ランク判定 =====
function getRank(sec) {
  const key  = `${currentGrid}x${currentGrid}`;
  const list = RANKS[key]?.[currentMode] || RANKS['5x5'].simple;
  for (const [t, emoji, label] of list) {
    if (sec < t) {
      const guide = buildRankGuide(list, label);
      return { emoji, label, guide };
    }
  }
  return { emoji: '👶', label: 'これから！', guide: buildRankGuide(list, null) };
}

// ランク基準の一覧テキストを生成
function buildRankGuide(list, currentLabel) {
  const emojis = ['👑','🏆','🥇','🥈','🥉','👶'];
  const lines   = list.map(([t, e, lbl]) => {
    const mark = lbl === currentLabel ? '◀' : '';
    return `${e}${lbl}: ${t}秒未満 ${mark}`;
  });
  lines.push(`${emojis[5]}これから！`);
  return lines.join('  ');
}

// ===== ユーティリティ =====
function fmt(sec) { return Number(sec).toFixed(2); }

function beep(freq, dur, vol = 0.15) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (_) {}
}

function shareScore() {
  const { emoji, label } = getRank(lastElapsed);
  const modeName  = MODE_INFO[currentMode]?.label || currentMode;
  const gridLabel = `${currentGrid}×${currentGrid}`;
  const best      = getBest();
  const lines     = [
    '🔢 ナンバーハント',
    `${gridLabel} ${modeName}`,
    `タイム: ${fmt(lastElapsed)}秒  ${emoji} ${label}`,
    best ? `ベスト: ${fmt(best)}秒` : '',
    '#ナンバーハント',
  ].filter(Boolean).join('\n');

  if (navigator.share) {
    navigator.share({ text: lines }).catch(() => copyText(lines));
  } else {
    copyText(lines);
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => alert('コピーしました！\n友達に送ってみよう！'))
    .catch(() => {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('コピーしました！\n友達に送ってみよう！');
    });
}

// ===== 初期化 =====
refreshTitle();

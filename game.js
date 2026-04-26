'use strict';

// ===== ランク閾値 [秒, 絵文字, ラベル] =====
// 達人基準: N × G² - G  (G: グリッドサイズ)
//   シンプル N=0.8（厳しめ）  ハード N=2.5  ベリーハード N=4.0  ヘル N=6.0（緩め）
// 伝説=達人×2/3  上級=達人×3/2  中級=達人×5/2  初級=達人×4
const RANKS = {
  '3x3': {
    simple: [[3,'👑','伝説'],[4,'🏆','達人'],[6,'🥇','上級'],[10,'🥈','中級'],[16,'🥉','初級']],
    hard:   [[13,'👑','伝説'],[20,'🏆','達人'],[30,'🥇','上級'],[50,'🥈','中級'],[80,'🥉','初級']],
    vhard:  [[22,'👑','伝説'],[33,'🏆','達人'],[50,'🥇','上級'],[83,'🥈','中級'],[132,'🥉','初級']],
    hell:   [[34,'👑','伝説'],[51,'🏆','達人'],[77,'🥇','上級'],[128,'🥈','中級'],[204,'🥉','初級']],
  },
  '4x4': {
    simple: [[6,'👑','伝説'],[9,'🏆','達人'],[14,'🥇','上級'],[23,'🥈','中級'],[36,'🥉','初級']],
    hard:   [[24,'👑','伝説'],[36,'🏆','達人'],[54,'🥇','上級'],[90,'🥈','中級'],[144,'🥉','初級']],
    vhard:  [[40,'👑','伝説'],[60,'🏆','達人'],[90,'🥇','上級'],[150,'🥈','中級'],[240,'🥉','初級']],
    hell:   [[61,'👑','伝説'],[92,'🏆','達人'],[138,'🥇','上級'],[230,'🥈','中級'],[368,'🥉','初級']],
  },
  '5x5': {
    simple: [[10,'👑','伝説'],[15,'🏆','達人'],[23,'🥇','上級'],[38,'🥈','中級'],[60,'🥉','初級']],
    hard:   [[39,'👑','伝説'],[58,'🏆','達人'],[87,'🥇','上級'],[145,'🥈','中級'],[232,'🥉','初級']],
    vhard:  [[63,'👑','伝説'],[95,'🏆','達人'],[143,'🥇','上級'],[238,'🥈','中級'],[380,'🥉','初級']],
    hell:   [[97,'👑','伝説'],[145,'🏆','達人'],[218,'🥇','上級'],[363,'🥈','中級'],[580,'🥉','初級']],
  },
};

// 難易度別ペナルティ（ミス1回あたりの加算秒数）
const PENALTIES = { simple: 1, hard: 2, vhard: 3, hell: 4 };

let currentGrid    = 5;
let currentMode    = 'simple';
let problems       = [];
let nextNum        = 1;
let timerInterval  = null;
let countdownTimer = null;
let startMs        = 0;
let lastElapsed    = 0;
let penaltyCount   = 0;
let soundEnabled   = localStorage.getItem('nh-sound') !== 'false';
let hintTimer      = null;

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
  if (timerInterval)  clearInterval(timerInterval);
  if (countdownTimer) clearInterval(countdownTimer);
  if (hintTimer)      { clearTimeout(hintTimer); hintTimer = null; }
  // カウントダウン中断時にオーバーレイを閉じグリッドを戻す
  const overlay = document.getElementById('countdown-overlay');
  if (overlay) overlay.style.display = 'none';
  const grid = document.getElementById('grid');
  if (grid) grid.style.pointerEvents = '';
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
  if (timerInterval)  clearInterval(timerInterval);
  if (countdownTimer) clearInterval(countdownTimer);
  if (hintTimer)      { clearTimeout(hintTimer); hintTimer = null; }

  problems     = generateProblems(currentMode, currentGrid);
  nextNum      = 1;
  lastElapsed  = 0;
  penaltyCount = 0;

  const flash = document.getElementById('penalty-flash');
  if (flash) { flash.classList.remove('show'); flash.textContent = ''; }

  showScreen('game');
  renderGrid();
  document.getElementById('next-display').textContent = '1';
  document.getElementById('timer').textContent = '0.00';
  document.getElementById('math-note').textContent =
    (currentMode === 'vhard' || currentMode === 'hell') ? '×÷は＋－より先に計算' : '';
  updatePenaltyInfo();
  updateProgress();

  // カウントダウン中はグリッドを無効化
  document.getElementById('grid').style.pointerEvents = 'none';

  showCountdown(() => {
    document.getElementById('grid').style.pointerEvents = '';
    startMs = Date.now();
    timerInterval = setInterval(() => {
      const el = document.getElementById('timer');
      if (el) el.textContent = fmt((Date.now() - startMs) / 1000);
    }, 50);
  });
}

// ===== カウントダウン =====
function showCountdown(onDone) {
  const overlay = document.getElementById('countdown-overlay');
  const el      = document.getElementById('countdown-number');
  overlay.style.display = 'flex';
  el.className  = '';

  let count = 3;

  const tick = () => {
    if (count < 0) {
      overlay.style.display = 'none';
      onDone();
      return;
    }
    el.textContent = count > 0 ? String(count) : 'GO!';
    el.className   = '';       // クラスを外してアニメーションをリセット
    void el.offsetWidth;       // reflow してから付け直す
    el.className   = count === 0 ? 'go' : 'pop';
    count--;
    countdownTimer = setTimeout(tick, count >= 0 ? 900 : 750);
  };

  tick();
}

// ===== グリッド描画 =====
function renderGrid() {
  const grid = document.getElementById('grid');
  grid.className = `grid-${currentGrid}`;
  grid.innerHTML = '';
  const hintModes = ['hard', 'vhard', 'hell'];
  problems.forEach(({ display, answer }) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = display;
    cell.dataset.display = display;
    const len = display.length;
    if      (len >= 8) cell.dataset.len = 'xl';
    else if (len >= 6) cell.dataset.len = 'l';
    else if (len >= 4) cell.dataset.len = 'm';

    cell.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onTap(cell, answer);
      if (hintModes.includes(currentMode)) {
        if (hintTimer) clearTimeout(hintTimer);
        hintTimer = setTimeout(() => showCellHint(cell, answer), 500);
      }
    });
    const cancelHint = () => { if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; } };
    cell.addEventListener('pointerup',     cancelHint);
    cell.addEventListener('pointercancel', cancelHint);
    cell.addEventListener('contextmenu',   e => e.preventDefault());

    grid.appendChild(cell);
  });
}

// ===== タップ処理 =====
function onTap(cell, answer) {
  if (cell.classList.contains('done') ||
      cell.classList.contains('hit')  ||
      cell.classList.contains('miss')) return;
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
    updateProgress();
    const count = currentGrid * currentGrid;
    if (nextNum <= count) {
      document.getElementById('next-display').textContent = nextNum;
    } else {
      endGame();
    }
  } else {
    if (!cell.classList.contains('miss')) {
      cell.classList.add('miss');
      beep(360, 0.1, 0.22);
      setTimeout(() => beep(240, 0.15, 0.18), 100);
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

// ===== 進捗バー =====
function updateProgress() {
  const total  = currentGrid * currentGrid;
  const done   = nextNum - 1;
  const pct    = total > 0 ? (done / total) * 100 : 0;
  const fillEl = document.getElementById('progress-bar-fill');
  const textEl = document.getElementById('progress-text');
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (textEl) textEl.textContent = `${done} / ${total}`;
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
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
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
// 任意のグリッド・モード用ヘルパー（ベスト一覧でも使用）
function getRankFor(sec, gridSize, mode) {
  const list = RANKS[`${gridSize}x${gridSize}`]?.[mode] || RANKS['5x5'].simple;
  for (const [t, emoji, label] of list) {
    if (sec < t) return { emoji, label };
  }
  return { emoji: '👶', label: 'これから！' };
}

// 現在のゲーム用（ガイド文付き）
function getRank(sec) {
  const list          = RANKS[`${currentGrid}x${currentGrid}`]?.[currentMode] || RANKS['5x5'].simple;
  const { emoji, label } = getRankFor(sec, currentGrid, currentMode);
  return { emoji, label, guide: buildRankGuide(list, label) };
}

// ===== ベスト一覧 =====
function openBestList() {
  renderBestList();
  showScreen('bestlist');
}

function renderBestList() {
  const sizes     = [3, 4, 5];
  const modes     = ['simple', 'hard', 'vhard', 'hell'];
  const modeNames = { simple: 'シンプル', hard: 'ハード', vhard: 'ベリーハード', hell: 'ヘル' };

  let html = '<table class="best-table"><thead><tr><th></th>';
  modes.forEach(m => { html += `<th>${modeNames[m]}</th>`; });
  html += '</tr></thead><tbody>';

  sizes.forEach(g => {
    html += `<tr><th>${g}×${g}</th>`;
    modes.forEach(m => {
      const best = parseFloat(localStorage.getItem(`nh-best-${g}x${g}-${m}`)) || null;
      if (best) {
        const { emoji } = getRankFor(best, g, m);
        html += `<td><span class="bl-rank">${emoji}</span><span class="bl-time">${fmt(best)}秒</span></td>`;
      } else {
        html += `<td class="bl-empty">−</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('bestlist-content').innerHTML = html;
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

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  return _audioCtx;
}

function beep(freq, dur, vol = 0.15) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
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

// ===== サウンド =====
function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('nh-sound', String(soundEnabled));
  updateSoundBtns();
}

function updateSoundBtns() {
  document.querySelectorAll('.btn-sound').forEach(btn => {
    if (btn.dataset.soundType === 'full') {
      btn.textContent = soundEnabled ? '🔊 サウンドON' : '🔇 サウンドOFF';
    } else {
      btn.textContent = soundEnabled ? '🔊' : '🔇';
    }
  });
}

// ===== ヒント =====
function showCellHint(cell, answer) {
  hintTimer = null;
  if (cell.classList.contains('done') || currentMode === 'simple') return;
  const origText = cell.dataset.display || cell.textContent;
  cell.textContent = `= ${answer}`;
  delete cell.dataset.len;
  cell.classList.add('hint-show');
  const penaltySec = PENALTIES[currentMode] ?? 0;
  startMs -= penaltySec * 1000;
  penaltyCount++;
  updatePenaltyInfo();
  showPenaltyFlash(penaltySec);
  beep(440, 0.12, 0.08);
  setTimeout(() => {
    if (!cell.classList.contains('done')) {
      cell.textContent = origText;
      const len = origText.length;
      if      (len >= 8) cell.dataset.len = 'xl';
      else if (len >= 6) cell.dataset.len = 'l';
      else if (len >= 4) cell.dataset.len = 'm';
      else               delete cell.dataset.len;
    }
    cell.classList.remove('hint-show');
  }, 1500);
}

// ===== 初期化 =====
refreshTitle();
updateSoundBtns();

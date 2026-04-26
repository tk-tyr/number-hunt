'use strict';

const MODE_INFO = {
  simple: { label: 'シンプル',    desc: '数字をそのままタップ。まずはここから！' },
  hard:   { label: 'ハード',      desc: '足し算・引き算の答えを探してタップ！' },
  vhard:  { label: 'ベリーハード', desc: '掛け算・割り算の答えを探してタップ！' },
  hell:   { label: 'ヘル',        desc: '複合演算・累乗・平方根も登場。×は＋より先！' },
};

// gridSize×gridSize 問（答えは 1〜gridSize²）を生成
function generateProblems(mode, gridSize) {
  const count   = gridSize * gridSize;
  const answers = shuffleArr([...Array(count)].map((_, i) => i + 1));
  return answers.map(n => makeProblem(n, mode));
}

function makeProblem(n, mode) {
  switch (mode) {
    case 'simple': return { display: String(n), answer: n };
    case 'hard':   return makeAddSub(n);
    case 'vhard':  return makeMulDiv(n);
    case 'hell':   return makeHell(n);
    default:       return { display: String(n), answer: n };
  }
}

// ===== ユーティリティ =====
function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rnd(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

// ===== ハード: 足し算・引き算 =====
function makeAddSub(n) {
  if (n >= 2 && Math.random() < 0.5) {
    const b = rnd(1, n - 1);
    return { display: `${n - b}＋${b}`, answer: n };
  }
  const b = rnd(1, 25);
  return { display: `${n + b}－${b}`, answer: n };
}

// ===== ベリーハード: 掛け算・割り算 =====
function makeMulDiv(n) {
  const opts = [];
  for (let a = 2; a * a <= n; a++) {
    if (n % a === 0) {
      const b = n / a;
      opts.push(`${a}×${b}`);
      if (a !== b) opts.push(`${b}×${a}`);
    }
  }
  for (let k = 2; k <= 12; k++) {
    if (n * k <= 150) opts.push(`${n * k}÷${k}`);
  }
  if (opts.length === 0) opts.push(`${n * 2}÷2`);
  return { display: pick(opts), answer: n };
}

// ===== ヘル: 複合演算・累乗・平方根 =====
// ×÷は＋－より優先（標準数学記法）
function makeHell(n) {
  const opts = [];

  // a² = n（平方数: 1,4,9,16,25 など）
  const sq = Math.round(Math.sqrt(n));
  if (sq >= 2 && sq * sq === n) opts.push(`${sq}²`);

  // √(n²)  ※n≤12 まで表示
  if (n <= 12) opts.push(`√${n * n}`);

  // a×b＋c = n  (×優先: a*b + c = n)
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const c = n - a * b;
      if (c >= 1 && c <= 9) opts.push(`${a}×${b}＋${c}`);
    }
  }

  // a×b－c = n  (×優先: a*b - c = n)
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const c = a * b - n;
      if (c >= 1 && c <= 9) opts.push(`${a}×${b}－${c}`);
    }
  }

  // (a＋b)×c = n
  for (let c = 2; c <= 9; c++) {
    if (n % c === 0) {
      const s = n / c;
      for (let b = 1; b <= Math.floor(s / 2); b++) {
        if (s - b >= 1) opts.push(`(${b}＋${s - b})×${c}`);
      }
    }
  }

  // (a－b)×c = n
  for (let c = 2; c <= 9; c++) {
    if (n % c === 0) {
      const diff = n / c;
      for (let b = 1; b <= 9; b++) {
        const a = diff + b;
        if (a >= 2 && a <= 19) opts.push(`(${a}－${b})×${c}`);
      }
    }
  }

  if (opts.length === 0) return makeMulDiv(n);
  return { display: pick(opts), answer: n };
}

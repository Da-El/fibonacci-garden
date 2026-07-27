/* Iteration 49: the Speculator's wheel stakes the whole barn, and nobody has
   ever worked out what it pays. If the expected value is above 1 it is a free
   lunch and a rational player always spins; if far below, it is a trap. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn; const s = E('state');
s.offset = 0;

const W = E('WHEEL');
const ev = W.reduce(function (a, w) { return a + w.m; }, 0) / W.length;
const zeros = W.filter(function (w) { return w.m === 0; }).length;
const best = Math.max.apply(null, W.map(function (w) { return w.m; }));

console.log('  segments: ' + W.map(function (w) { return w.label; }).join(' ') +
            '   (' + W.length + ' equal slices)');
console.log('  expected value ×' + ev.toFixed(4) + '  ·  ' + zeros + ' in ' + W.length +
            ' lose everything  ·  best ×' + best);

/* ---- the wheel must not be strictly better than selling ---- */
check('the wheel is not a free lunch', ev <= 1.0,
      'expected value ×' + ev.toFixed(3) + ' — a rational player would always spin');
check('nor so poor that nobody should ever spin', ev >= 0.85,
      'expected value ×' + ev.toFixed(3));
check('there is a real chance of losing the lot', zeros >= 2 && zeros / W.length <= 0.5,
      zeros + ' of ' + W.length);
check('there is a jackpot worth chasing', best >= 2.5, '×' + best);

/* ---- the slices must be reachable, all of them ---- */
{
  const hit = {};
  for (let k = 0; k < 4000; k++) hit[E('pickSegment')(k / 4000)] = 1;
  check('every slice can actually come up', Object.keys(hit).length === W.length,
        Object.keys(hit).length + ' of ' + W.length + ' reachable');
  // and no slice may be favoured by the picker
  const counts = new Array(W.length).fill(0);
  for (let k = 0; k < 80000; k++) counts[E('pickSegment')(k / 80000)]++;
  const lo = Math.min.apply(null, counts), hi = Math.max.apply(null, counts);
  check('the slices are equally likely', (hi - lo) / hi < 0.02,
        counts.join(','));
}

/* ---- losing the barn must never produce a dead save ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0; st.level = 8;
  st.coins = 0;
  st.plots = [null, null, null];
  st.barn = { elm: { 3: 5 } };
  // the worst outcome: the wheel takes everything
  st.barn = {};
  G('ensureSolvent()');
  const alive = st.coins > 0 || st.plots.some(Boolean) || G('barnCountAll()') > 0;
  check('losing the whole barn never leaves a dead save', alive,
        'coins=' + st.coins + ' plots=' + st.plots.filter(Boolean).length);
}

/* ---- it must not be spinnable for free, or with nothing at stake ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0;
  st.barn = {};
  const before = st.coins;
  let threw = null;
  try { G('spinWheel()'); } catch (e) { threw = e; }
  check('spinning an empty barn does nothing and does not crash',
        !threw && st.coins === before, threw ? threw.message : 'coins moved');
}

/* ---- and what the README claims must be what the wheel does ---- */
{
  const readme = require('fs').readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const labels = W.map(function (w) { return w.label.replace('×', '') ; });
  const uniq = Array.from(new Set(labels)).sort();
  console.log('  distinct outcomes: ×' + uniq.join(' ×'));
  const claimed = readme.match(/×0 \/ ×1[^)]*\)/);
  check('the README lists the outcomes the wheel has',
        !claimed || uniq.every(function (u) { return claimed[0].indexOf(u) > -1; }),
        claimed ? claimed[0] : 'no claim found');
  const fracClaim = readme.match(/one slice in (\w+) takes everything/);
  if (fracClaim) {
    const words = { two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8 };
    const denom = words[fracClaim[1]];
    check('the README states the right chance of losing it all',
          denom && Math.abs(zeros / W.length - 1 / denom) < 0.02,
          'says 1 in ' + fracClaim[1] + ', actually ' + zeros + ' in ' + W.length);
  }
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

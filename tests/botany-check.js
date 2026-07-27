/* Iteration 39: the game's whole premise is that the Fibonacci fractions are
   real and are the reason the plants look right. So before dressing that
   claim up in an almanac, check the renderer actually honours it: does each
   species place its elements at the divergence angle it advertises, and do
   the fractions form the real phyllotactic ladder? */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const GOLDEN = E('GOLDEN');

/* ---- 1. the advertised fractions must be Fibonacci over Fibonacci ---- */
{
  const FIB = E('FIB');
  const bad = [];
  E('SPECIES').forEach(function (sp) {
    if (!sp.frac) return;                       // golden-angle species
    if (FIB.indexOf(sp.frac[0]) < 0 || FIB.indexOf(sp.frac[1]) < 0) bad.push(sp.id + ' ' + sp.frac.join('/'));
  });
  check('every stated fraction is one Fibonacci number over another', !bad.length, bad.join(' '));
}

/* ---- 2. the label must agree with the angle the renderer uses ---- */
{
  const bad = [];
  E('SPECIES').forEach(function (sp) {
    const label = E('fracLabel')(sp);
    const ang = E('angleOf')(sp);
    const m = label.match(/([\d.]+)°/);
    if (!m) { bad.push(sp.id + ' has no angle in its label'); return; }
    if (Math.abs(parseFloat(m[1]) - ang) > 0.011) bad.push(sp.id + ' says ' + m[1] + ' draws ' + ang.toFixed(3));
  });
  check('the stated angle is the angle the renderer uses', !bad.length, bad.join(' '));
}

/* ---- 3. the golden-angle species must actually use the golden angle ---- */
{
  const bad = [];
  E('SPECIES').forEach(function (sp) {
    if (sp.frac) return;
    if (Math.abs(E('angleOf')(sp) - GOLDEN) > 1e-9) bad.push(sp.id);
  });
  check('the golden-angle species use 137.5077640500378', !bad.length, bad.join(' '));
  check('that constant really is the golden angle',
        Math.abs(GOLDEN - 360 / Math.pow((1 + Math.sqrt(5)) / 2, 2)) < 1e-9,
        GOLDEN + ' vs 360/phi^2 = ' + (360 / Math.pow((1 + Math.sqrt(5)) / 2, 2)));
}

/* ---- 4. the ladder: consecutive fractions must be linked by the mediant,
          which is how the real phyllotactic series is built ---- */
{
  const fracs = E('SPECIES').filter(function (s) { return s.frac; })
    .map(function (s) { return s.frac; });
  const uniq = [];
  fracs.forEach(function (f) {
    if (!uniq.some(function (u) { return u[0] === f[0] && u[1] === f[1]; })) uniq.push(f);
  });
  uniq.sort(function (a, b) { return a[0] / a[1] - b[0] / b[1]; });
  // 1/2, 1/3, 2/5, 3/8, 5/13, 8/21 ... each is the mediant of the two before
  const ladder = [[1, 2], [1, 3], [2, 5], [3, 8], [5, 13], [8, 21], [13, 34]];
  const mediantOk = [];
  for (let i = 2; i < ladder.length; i++) {
    const a = ladder[i - 2], b = ladder[i - 1], c = ladder[i];
    mediantOk.push(a[0] + b[0] === c[0] && a[1] + b[1] === c[1]);
  }
  check('the ladder is built by the mediant, as real phyllotaxis is',
        mediantOk.every(Boolean));
  const off = uniq.filter(function (f) {
    return !ladder.some(function (l) { return l[0] === f[0] && l[1] === f[1]; });
  });
  check('every species sits on that ladder', !off.length,
        off.map(function (f) { return f.join('/'); }).join(' '));
  console.log('  fractions in use: ' + uniq.map(function (f) { return f.join('/'); }).join(', '));
  console.log('  they converge on: ' + (uniq[uniq.length - 1][0] / uniq[uniq.length - 1][1] * 360).toFixed(3) +
              '° -> ' + GOLDEN.toFixed(3) + '°');
}

/* ---- 5. the drawn art must actually place elements at that angle ---- */
{
  const bad = [];
  E('SPECIES').forEach(function (sp) {
    if (sp.form !== 'disc' && sp.form !== 'rosette' && sp.form !== 'cone') return;
    const svg = E('plantSVG')(sp, 40, undefined, 'low');
    // recover the placement angles from the drawn transforms
    const pts = [];
    const re = /translate\((-?[\d.]+) (-?[\d.]+)\)/g;
    let m;
    while ((m = re.exec(svg))) pts.push([parseFloat(m[1]), parseFloat(m[2])]);
    if (pts.length < 8) return;                 // not enough to measure
    // the angle between successive placements, modulo the full turn
    const want = E('angleOf')(sp);
    let hits = 0, tried = 0;
    for (let i = 1; i < Math.min(pts.length, 30); i++) {
      const a0 = Math.atan2(pts[i - 1][1], pts[i - 1][0]) * 180 / Math.PI;
      const a1 = Math.atan2(pts[i][1], pts[i][0]) * 180 / Math.PI;
      let d = ((a1 - a0) % 360 + 360) % 360;
      const w = ((want % 360) + 360) % 360;
      tried++;
      if (Math.abs(d - w) < 1.5 || Math.abs(d - w) > 358.5) hits++;
    }
    // cones sort their scales by depth for painting, so ordering is lost there
    if (sp.form !== 'cone' && tried && hits / tried < 0.6) {
      bad.push(sp.id + ' ' + hits + '/' + tried + ' placements at ' + want.toFixed(2) + '°');
    }
  });
  check('the art places elements at the advertised divergence angle', !bad.length, bad.join('; '));
}

/* ---- 6. the almanac's countable claim: the spiral arms it prints must be
          Fibonacci, and must be derived rather than written down ---- */
{
  const FIB = E('FIB');
  const bad = [], mismatched = [];
  E('SPECIES').forEach(function (sp) {
    const arms = E('spiralArms')(sp, E('totalFor')(sp));
    if (arms.length !== 2) { bad.push(sp.id + ' gave ' + arms.length + ' arm counts'); return; }
    if (!arms.every(function (m) { return FIB.indexOf(m) > -1; })) {
      bad.push(sp.id + ' ' + arms.join('&') + ' not Fibonacci');
    }
    /* A species with a stated fraction shows that fraction's own numbers.
       Where the numerator is 1 the plant makes straight columns rather than
       spirals, and the card has to say columns — claiming spirals there
       would be false. */
    if (sp.frac && !(arms[0] === sp.frac[0] && arms[1] === sp.frac[1])) {
      mismatched.push(sp.id + ' says ' + sp.frac.join('/') + ' but counts ' + arms.join('&'));
    }
    if (sp.frac && sp.frac[0] === 1 && !E('isColumnar')(sp)) {
      mismatched.push(sp.id + ' is columnar but not flagged as such');
    }
    if (sp.frac && sp.frac[0] > 1 && E('isColumnar')(sp)) {
      mismatched.push(sp.id + ' is not columnar but is flagged as such');
    }
  });
  check('every spiral-arm count the almanac prints is a Fibonacci number', !bad.length, bad.join(' '));
  check("a species' arms match its own stated fraction", !mismatched.length, mismatched.join('; '));
}

/* ---- 7. the mediant claim on each card must be arithmetically true ---- */
{
  const L = E('PHYLLO_LADDER');
  const bad = [];
  for (let i = 2; i < L.length; i++) {
    if (L[i - 2][0] + L[i - 1][0] !== L[i][0] || L[i - 2][1] + L[i - 1][1] !== L[i][1]) {
      bad.push(L[i].join('/'));
    }
  }
  check('every rung the almanac names is the mediant of the two before it',
        !bad.length, bad.join(' '));
  // and the card must not claim a mediant for the first two rungs
  const first = E('ladderNote')(E('SPECIES').filter(function (s) { return s.frac && s.frac[1] === 2; })[0]);
  check('the bottom rung is not claimed to be a mediant of anything',
        first.indexOf('⊕') < 0);
}

/* ---- 8. the drops the almanac quotes must be the drops actually needed ---- */
{
  const h2 = H.build(); const E2 = h2.evalIn; const s2 = E2('state');
  s2.offset = 0; s2.coins = 9999999; s2.level = 16;
  const bad = [];
  E2('SPECIES').forEach(function (sp) {
    const quoted = E2('dropsToFinish')(sp);
    s2.plots[0] = { s: sp.id, stage: 0, q: 0, stageAt: E2('NOW()'), perfects: 0, spills: 0, hired: false, glass: 0 };
    s2.offset += 30 * 24 * 3600000;
    E2('growthTick()');
    E2('curPlot = 0');
    let poured = 0;
    while (s2.plots[0] && s2.plots[0].stage < sp.stages) { s2.water = 999; E2('advanceStage("water", true)'); poured++; }
    if (poured !== quoted) bad.push(sp.id + ' quotes ' + quoted + ' takes ' + poured);
    s2.plots[0] = null;
  });
  check('the almanac quotes the drops a plant really costs you', !bad.length, bad.join(' '));
  // and under glass it must quote every stage
  const g = E2('SPECIES')[0];
  check('under glass it quotes every stage', E2('dropsToFinish')(g, true) === g.stages,
        E2('dropsToFinish')(g, true) + ' vs ' + g.stages);
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

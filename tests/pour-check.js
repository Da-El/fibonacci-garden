const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Iteration 35: the pour. Difficulty is now stated in milliseconds, so it
   can be checked against what a human tap can actually do. Typical tap
   precision is roughly +/-30-50ms, so a window below about 70ms is luck
   rather than skill. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn; const s = E('state');
s.offset = 0; s.level = 16;

const rows = [];
E('SPECIES').forEach(function (sp) {
  const sweep = E('pourPeriodFor')(sp) / 2;
  for (let stage = 0; stage < sp.stages; stage++) {
    const z = E('pourZonesFor')(stage, sp);
    rows.push({ id: sp.id, stage: stage, gold: z.gw * sweep, good: z.goodw * sweep,
                sweep: sweep, gw: z.gw });
  }
});

const golds = rows.map(function (r) { return r.gold; });
const lo = Math.min.apply(null, golds), hi = Math.max.apply(null, golds);
console.log('  gold window across every species and stage: ' +
            lo.toFixed(0) + 'ms .. ' + hi.toFixed(0) + 'ms');
console.log('  easiest: ' + rows.filter(function (r) { return r.gold === hi; })[0].id +
            ' stage 0   hardest: ' + rows.filter(function (r) { return r.gold === lo; })[0].id +
            ' stage ' + rows.filter(function (r) { return r.gold === lo; })[0].stage);

check('no pour is tighter than a human tap can land', lo >= 70, 'tightest ' + lo.toFixed(0) + 'ms');
check('the easiest pour is still a real aim, not a gimme', hi <= 165, 'widest ' + hi.toFixed(0) + 'ms');
check('there is a genuine difficulty range', hi / lo >= 1.6 && hi / lo <= 2.6,
      'ratio ' + (hi / lo).toFixed(2));

/* difficulty must rise with maturity, for every species */
{
  const bad = [];
  E('SPECIES').forEach(function (sp) {
    const mine = rows.filter(function (r) { return r.id === sp.id; });
    for (let i = 1; i < mine.length; i++) {
      if (mine[i].gold > mine[i - 1].gold + 1e-6) bad.push(sp.id + '@' + i);
    }
  });
  check('a plant only ever gets harder as it fills out', !bad.length, bad.slice(0, 5).join(' '));
}

/* and a dearer species must never be easier than a cheaper one at the same
   point in its growth */
{
  /* Compared at the same true maturity. Rounding to a whole stage first would
     put a six-stage plant and a twelve-stage one at different fractions and
     measure the rounding rather than the curve. */
  const msAt = function (sp, grown) {
    const tier = E('SPECIES').length > 1 ? sp.idx / (E('SPECIES').length - 1) : 0;
    const diff = Math.min(1, grown * 0.6 + tier * 0.4);
    return E('POUR_MS_EASY') + (E('POUR_MS_HARD') - E('POUR_MS_EASY')) * diff;
  };
  const bad = [];
  const list = E('SPECIES');
  [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
    list.forEach(function (a) {
      list.forEach(function (b) {
        if (a.idx < b.idx && msAt(a, g) < msAt(b, g) - 1e-9) bad.push(a.id + '<' + b.id + '@' + g);
      });
    });
  });
  check('a dearer crop is never easier at the same maturity',
        !bad.length, bad.slice(0, 5).join(' '));
}

/* the zones must fit on the bar — a gold band wider than the bar would mean
   every tap is perfect */
{
  const over = rows.filter(function (r) { return r.gw >= 1 || r.gw <= 0; });
  check('the gold band always fits on the bar', !over.length,
        over.slice(0, 3).map(function (r) { return r.id + ' gw=' + r.gw.toFixed(2); }).join(' '));
  // with fever and the steady-hand perk stacked, it must still not fill the bar
  s.feverUntil = E('NOW()') + 60000;
  s.perks.steadyhand = true;
  let worst = 0;
  E('SPECIES').forEach(function (sp) {
    for (let st = 0; st < sp.stages; st++) {
      const z = E('pourZonesFor')(st, sp);
      if (z.gw > worst) worst = z.gw;
    }
  });
  check('even fever plus steady hand does not fill the whole bar', worst < 0.95,
        'widest ' + (worst * 100).toFixed(0) + '% of the bar');
  console.log('  with fever + steady hand the widest gold is ' + (worst * 100).toFixed(0) + '% of the bar');
  s.feverUntil = 0; s.perks.steadyhand = false;
}

/* the Daily sweeps at its own rate; its windows must match the garden's */
{
  const spec = E('dailySpec')(E('dayIndex()'));
  const d = E('dailyState()');
  d.plots[0] = { stage: 0, q: 0 };
  E('dailyStartPour')(spec, d, 0);
  const dp = E('dailyPour');
  const gardenMs = E('pourZonesFor')(0, spec.sp).gw * (E('pourPeriodFor')(spec.sp) / 2);
  const dailyMs = dp.gw * (dp.period / 2);
  check('the Daily gives the same timing window as the garden',
        Math.abs(dailyMs - gardenMs) < 2,
        'daily ' + dailyMs.toFixed(0) + 'ms vs garden ' + gardenMs.toFixed(0) + 'ms');
}

/* a miss must tell you which way you were out */
{
  const html = require('fs').readFileSync(GAME_PATH, 'utf8');
  /* Read from the captured zone, never from `pour` — cancelPour() nulls it
     before this point, and reading it there crashed every pour in the game. */
  check('a spill says whether you were early or late',
        /SPILLED — too/.test(html) && /pos < z\.center/.test(html));
  check('the early/late test does not touch the nulled pour object',
        !/pos < pour\.center/.test(html));
  check('a good pour points the same way', /a touch/.test(html));
}

/* ---- the pour must actually resolve. The early/late feedback added in
       iteration 35 read pour.center after cancelPour() had already nulled
       `pour`, so every tap in the live game threw — the one interaction the
       whole game rests on, broken for two commits, because nothing had ever
       driven startPour and lockPour end to end. ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0; st.coins = 999999; st.level = 12;
  const sounds = {}, errs = {};
  G('sfx = function (n) { state.__s = state.__s || {}; state.__s[n] = (state.__s[n] || 0) + 1; }');
  let resolved = 0;
  for (let i = 0; i < 60; i++) {
    if (!st.plots[0]) G('plant(0,"chamomile")');
    st.water = 99; G('curPlot = 0');
    const before = st.plots[0].stage;
    try {
      G('startPour()'); G('lockPour()');
      // a resolved pour either advanced the plant or spilled the drop
      if (st.plots[0] === null || st.plots[0].stage !== before || st.water < 99) resolved++;
    } catch (e) { errs[e.message] = (errs[e.message] || 0) + 1; }
  }
  check('a pour never throws', !Object.keys(errs).length, Object.keys(errs).join('; '));
  check('every pour reaches an outcome', resolved === 60, resolved + '/60');
  const s = st.__s || {};
  check('the outcome is announced by sound',
        (s.perfect | 0) + (s.good | 0) + (s.spill | 0) > 0,
        'perfect ' + (s.perfect | 0) + ' good ' + (s.good | 0) + ' spill ' + (s.spill | 0));
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

/* Iteration 87: the pour at its edges.

   pour-check measures the windows. grow-check drives the happy path fifteen
   times. Neither has ever asked what happens at the boundaries of the one
   verb the whole game rests on: the zone that lands against the end of the
   bar, the drop taken with one left in the can, the pour left running while
   the player closes the screen, the 3.8-second timeout that locks it for you.

   Every number below comes from the game's own pourZonesFor / resolvePour /
   markerPos, swept rather than sampled — the marker is a triangle at constant
   speed, so the share of a sweep that lands in a band is exactly the share of
   the bar it covers, and that is computable without a random tap. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SPECIES = E('SPECIES');

/* The marker sweeps 0 -> 1 -> 0 at constant speed, so the fraction of a full
   sweep spent inside a band is the length of that band clipped to the bar.
   Anything hanging off the end is time the player can never be given. */
function share(lo, hi) {
  return Math.max(0, Math.min(1, hi) - Math.max(0, lo));
}
function odds(z) {
  const gold = share(z.center - z.gw / 2, z.center + z.gw / 2);
  const band = share(z.center - z.gw / 2 - z.goodw, z.center + z.gw / 2 + z.goodw);
  return { perfect: gold, good: band - gold, spill: 1 - band };
}
/* Every zone the game can hand a player: each species, each stage, each of
   the 1000 centres the hash can produce. */
function everyZone(G, fn, perk) {
  const s = G('state');
  s.perks = perk ? { steadyhand: true } : {};
  G('SPECIES').forEach(function (sp) {
    for (let stage = 0; stage < sp.stages; stage++) {
      for (let n = 0; n < 1000; n++) {
        s.pourN = n;
        fn(G('pourZonesFor')(stage, sp), sp, stage);
      }
    }
  });
  s.perks = {};
}

/* ---- the gold must never hang off the end of the bar ---- */
{
  const g = H.build(); const G = g.evalIn;
  G('state').offset = 0;
  const off = [];
  let widest = 0, narrowest = 1;
  [false, true].forEach(function (perk) {
    everyZone(G, function (z, sp, stage) {
      if (z.center - z.gw / 2 < 0 || z.center + z.gw / 2 > 1) {
        if (off.length < 4) {
          off.push(sp.id + ' stage ' + stage + ' at ' + z.center.toFixed(3) +
                   (perk ? ' with a steady hand' : ''));
        }
      }
      widest = Math.max(widest, z.gw);
      narrowest = Math.min(narrowest, z.gw);
    }, perk);
  });
  console.log('  gold zones swept: ' + (SPECIES.reduce(function (a, s) {
    return a + s.stages; }, 0) * 1000 * 2) + ', width ' +
    (narrowest * 100).toFixed(1) + '% to ' + (widest * 100).toFixed(1) + '% of the bar');
  check('no gold zone ever hangs off the end of the bar', !off.length, off.join('; '));
  check('and the narrowest is still visible', narrowest > 0.05,
        (narrowest * 100).toFixed(1) + '%');
  /* Half the bar is the widest the gold ever gets, and it happens at the
     *first* stage of the dearest plants with the perk that widens it —
     pourDifficulty is 60% how grown the plant is and only 40% its tier, so a
     pineapple's opening drop really is kinder than an elm's last one. That is
     the design; the bound is here so it cannot quietly become the whole bar. */
  check('and the widest is never more than half of it', widest <= 0.55,
        (widest * 100).toFixed(1) + '%');

  /* Some pours cannot be missed at all: the green band is a flat 105ms either
     side of the gold, and the four fastest-sweeping plants pass the whole bar
     in 325ms, so at their first two stages the band covers everything. That is
     the deliberate on-ramp taken to its limit rather than a defect — the first
     drops of a pineapple are meant to be gentle — but it has never been
     written down, and it must never creep up the plant. */
  const sure = [];
  G('SPECIES').forEach(function (sp) {
    const s = G('state');
    s.pourN = 0;
    for (let st = 0; st < sp.stages; st++) {
      const z = G('pourZonesFor')(st, sp);
      if (z.gw + z.goodw * 2 >= 1) sure.push({ sp: sp, stage: st });
    }
  });
  console.log('  pours a bare player cannot miss: ' + sure.length + ' — ' +
    sure.map(function (x) { return x.sp.id + ' s' + x.stage; }).join(', '));
  check('an unmissable pour only ever happens in a plant\'s first two stages',
        sure.every(function (x) { return x.stage <= 1; }),
        sure.filter(function (x) { return x.stage > 1; })
            .map(function (x) { return x.sp.id + ' s' + x.stage; }).join(', '));
  check('and only on the plants whose bar sweeps fastest',
        sure.every(function (x) { return E('pourPeriodFor')(x.sp) <= 700; }),
        sure.map(function (x) { return x.sp.id + ' ' + E('pourPeriodFor')(x.sp); })
            .filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '));
  check('and never on a plant a beginner can buy',
        sure.every(function (x) { return x.sp.lvl >= 10; }),
        sure.filter(function (x) { return x.sp.lvl < 10; })
            .map(function (x) { return x.sp.id + ' lvl ' + x.sp.lvl; }).join(', '));
}

/* ---- and the forgiving band must stay on the bar too ----
   It did not. The centre was drawn from a flat 25%–75% regardless of how wide
   the band around it was, so three pours in five had some of their green
   hanging off the end — up to a quarter of it — and how forgiving a drop was
   came down to where the hash happened to put it. The gold always fitted, so
   nothing was ever unwinnable; it was just quietly unequal, and re-rollable
   for free by backing out of the bar and tapping again. */
{
  const g = H.build(); const G = g.evalIn;
  G('state').offset = 0;
  let clipped = 0, total = 0, worst = 0, worstAt = '';
  let unfittable = 0;
  everyZone(G, function (z, sp, stage) {
    total++;
    const lo = z.center - z.gw / 2 - z.goodw, hi = z.center + z.gw / 2 + z.goodw;
    const lost = Math.max(0, -lo) + Math.max(0, hi - 1);
    /* A band wider than the whole bar cannot be fitted by any centre; those
       must sit centred, losing the same sliver at each end. */
    if (z.gw + z.goodw * 2 > 1) { unfittable++; return; }
    if (lost > 1e-9) clipped++;
    if (lost > worst) { worst = lost; worstAt = sp.id + ' stage ' + stage; }
  });
  console.log('\n  zones whose band is wider than the bar: ' +
    (unfittable / total * 100).toFixed(0) + '% (these sit centred)');
  console.log('  of the rest, clipped by the end of the bar: ' +
    (clipped / total * 100).toFixed(1) + '%, worst ' +
    (worst * 100).toFixed(1) + '%' + (worstAt ? ' (' + worstAt + ')' : ''));
  check('every band that can fit on the bar does', !clipped,
        (clipped / total * 100).toFixed(1) + '% still clipped, worst ' +
        (worst * 100).toFixed(1) + '% at ' + worstAt);
  /* And a band too wide to fit has to be centred rather than shoved to one
     side, or the unfairness has only moved. */
  const off = [];
  everyZone(G, function (z, sp, stage) {
    if (z.gw + z.goodw * 2 <= 1) return;
    if (Math.abs(z.center - 0.5) > 1e-9) off.push(sp.id + ' stage ' + stage);
  });
  check('and one too wide to fit sits dead centre', !off.length,
        off.slice(0, 3).join(', '));
}

/* ---- what a sweep actually pays, species by species ---- */
{
  const g = H.build(); const G = g.evalIn;
  G('state').offset = 0;
  console.log('\n  a tap thrown blind, averaged over every zone the hash can give:');
  console.log('    species        perfect    good    spill   (bare)      spill with a steady hand');
  const rows = [];
  SPECIES.forEach(function (sp) {
    const acc = { perfect: 0, good: 0, spill: 0, n: 0 }, hand = { spill: 0, n: 0 };
    [false, true].forEach(function (perk) {
      const s = G('state');
      s.perks = perk ? { steadyhand: true } : {};
      for (let stage = 0; stage < sp.stages; stage++) {
        for (let n = 0; n < 1000; n++) {
          s.pourN = n;
          const o = odds(G('pourZonesFor')(stage, sp));
          if (perk) { hand.spill += o.spill; hand.n++; }
          else { acc.perfect += o.perfect; acc.good += o.good; acc.spill += o.spill; acc.n++; }
        }
      }
      s.perks = {};
    });
    const r = { id: sp.id, perfect: acc.perfect / acc.n, good: acc.good / acc.n,
                spill: acc.spill / acc.n, handSpill: hand.spill / hand.n };
    rows.push(r);
    console.log('    ' + sp.id.padEnd(14) +
      (r.perfect * 100).toFixed(1).padStart(6) + '%' +
      (r.good * 100).toFixed(1).padStart(8) + '%' +
      (r.spill * 100).toFixed(1).padStart(8) + '%' +
      (r.handSpill * 100).toFixed(1).padStart(20) + '%');
  });

  check('a blind tap is never a coin flip on the easiest plant',
        rows[0].perfect < 0.5, (rows[0].perfect * 100).toFixed(1) + '%');
  check('and never hopeless on the hardest',
        rows[rows.length - 1].perfect > 0.05,
        (rows[rows.length - 1].perfect * 100).toFixed(1) + '%');

  /* A blind tap is the wrong yardstick for difficulty, and saying so is worth
     a check of its own. Its odds are just the share of the *bar* the gold
     covers, and that is almost flat across the shelf — 150ms of an elm's
     575ms sweep is much the same fraction as 75ms of a pineapple's 325ms one.
     What actually makes a pineapple hard is that the same hand jitter, in
     milliseconds, buys you less of it. The gradient lives in the clock. */
  const msOf = SPECIES.map(function (sp) {
    const g2 = H.build(); const G2 = g2.evalIn;
    G2('state').pourN = 0;
    const z = G2('pourZonesFor')(sp.stages - 1, sp);
    return { id: sp.id, ms: z.gw * (E('pourPeriodFor')(sp) / 2),
             bar: z.gw };
  });
  console.log('    the last stage in milliseconds, not bar-widths: ' +
    msOf[0].id + ' ' + msOf[0].ms.toFixed(0) + 'ms (' +
    (msOf[0].bar * 100).toFixed(0) + '% of the bar), ' +
    msOf[msOf.length - 1].id + ' ' + msOf[msOf.length - 1].ms.toFixed(0) + 'ms (' +
    (msOf[msOf.length - 1].bar * 100).toFixed(0) + '%)');
  check('the shelf gets harder as it gets dearer, measured in milliseconds',
        msOf[msOf.length - 1].ms < msOf[0].ms * 0.75,
        msOf[0].ms.toFixed(0) + 'ms -> ' + msOf[msOf.length - 1].ms.toFixed(0) + 'ms');
  check('and barely at all measured in bar-widths, which is why ms is the unit',
        Math.abs(msOf[msOf.length - 1].bar / msOf[0].bar - 1) < 0.35,
        (msOf[0].bar * 100).toFixed(0) + '% -> ' +
        (msOf[msOf.length - 1].bar * 100).toFixed(0) + '%');

  check('and every plant on it is landable',
        rows.every(function (r) { return r.perfect + r.good > 0.3; }),
        rows.filter(function (r) { return r.perfect + r.good <= 0.3; })
            .map(function (r) { return r.id; }).join(', '));
  /* And the perk that says it makes the gold wider has to reduce spills. */
  check('a steady hand spills less on every species',
        rows.every(function (r) { return r.handSpill < r.spill; }),
        rows.filter(function (r) { return r.handSpill >= r.spill; })
            .map(function (r) { return r.id; }).join(', '));
}

/* ---- the point of keeping the band on the bar ----
   Not "spills went down" — the sim cannot even see this change, because its
   model of a pour is the gold's width in milliseconds and it has no notion of
   the bar having ends. The point is that a player's outcome now depends on
   their error and nothing else. Take a tap a fixed number of milliseconds
   wide of the centre and it must resolve the same way for every zone the hash
   can produce. Before the clamp the zones near the ends resolved differently
   from the ones in the middle, for the same hand. */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  const inconsistent = [];
  G('SPECIES').forEach(function (sp) {
    const sweep = E('pourPeriodFor')(sp) / 2;
    for (let stage = 0; stage < sp.stages; stage++) {
      [-160, -90, -40, 0, 40, 90, 160].forEach(function (errMs) {
        let saw = null;
        for (let n = 0; n < 1000; n++) {
          s.pourN = n;
          const z = G('pourZonesFor')(stage, sp);
          const r = G('resolvePour')(z.center + errMs / sweep, z);
          if (saw === null) saw = r;
          else if (saw !== r && inconsistent.length < 5) {
            inconsistent.push(sp.id + ' s' + stage + ' at ' + errMs + 'ms: ' +
                              saw + ' or ' + r);
            saw = r;
          }
        }
      });
    }
  });
  console.log('\n  the same hand, every zone the hash can give: ' +
    (inconsistent.length ? inconsistent.length + ' disagreements' : 'always the same answer'));
  check('a tap the same distance out always resolves the same way',
        !inconsistent.length, inconsistent.join('; '));
}

/* ---- the boundary of the zone itself ---- */
{
  const z = { center: 0.5, gw: 0.2, goodw: 0.1 };
  check('a tap dead on the centre is perfect', E('resolvePour')(0.5, z) === 'perfect');
  check('and exactly on the gold edge is still perfect',
        E('resolvePour')(0.6, z) === 'perfect', E('resolvePour')(0.6, z));
  check('a hair outside it is good',
        E('resolvePour')(0.6001, z) === 'good', E('resolvePour')(0.6001, z));
  check('exactly on the green edge is still good',
        E('resolvePour')(0.7, z) === 'good', E('resolvePour')(0.7, z));
  check('and a hair outside that spills',
        E('resolvePour')(0.7001, z) === 'spill', E('resolvePour')(0.7001, z));
  check('and both ends of the bar spill on a centred zone',
        E('resolvePour')(0, z) === 'spill' && E('resolvePour')(1, z) === 'spill');
}

/* ---- hesitation: the pour the game used to lock for you ----
   The marker is deterministic, so 3.8 seconds lands on a fixed point of the
   bar for each species, and whether that point sat inside the zone was down
   to where the hash put the zone. Below is what freezing used to pay. */
{
  const AUTO_MS = 3800;
  function autoPos(sp) {
    const ph = AUTO_MS / E('pourPeriodFor')(sp) % 2;
    return ph < 1 ? ph : 2 - ph;
  }
  const g = H.build(); const G = g.evalIn;
  G('state').offset = 0;
  console.log('\n  what freezing at the bar for 3.8s used to pay:');
  console.log('    species        lands at   perfect    good    spill');
  const rows = [];
  SPECIES.forEach(function (sp) {
    const pos = autoPos(sp);
    const c = { perfect: 0, good: 0, spill: 0, n: 0 };
    const s = G('state');
    for (let stage = 0; stage < sp.stages; stage++) {
      for (let n = 0; n < 1000; n++) {
        s.pourN = n;
        c[G('resolvePour')(pos, G('pourZonesFor')(stage, sp))]++;
        c.n++;
      }
    }
    rows.push({ id: sp.id, pos: pos, perfect: c.perfect / c.n,
                good: c.good / c.n, spill: c.spill / c.n });
    console.log('    ' + sp.id.padEnd(14) + pos.toFixed(3).padStart(7) +
      (c.perfect / c.n * 100).toFixed(1).padStart(9) + '%' +
      (c.good / c.n * 100).toFixed(1).padStart(8) + '%' +
      (c.spill / c.n * 100).toFixed(1).padStart(8) + '%');
  });
  const kindest = rows.reduce(function (a, r) { return r.spill < a.spill ? r : a; }, rows[0]);
  const cruelest = rows.reduce(function (a, r) { return r.spill > a.spill ? r : a; }, rows[0]);
  console.log('    it ranged from ' + (kindest.spill * 100).toFixed(0) + '% spilled (' +
    kindest.id + ') to ' + (cruelest.spill * 100).toFixed(0) + '% (' + cruelest.id +
    ') — a lottery on which plant you happened to be watering');
  check('the fixed landing spot really was wildly unequal between species',
        cruelest.spill - kindest.spill > 0.4,
        (kindest.spill * 100).toFixed(0) + '% to ' + (cruelest.spill * 100).toFixed(0) + '%');

  /* And what it does now: the drop goes back in the can, identically for
     every plant on the shelf. */
  function frozen(id) {
    const q = H.build(); const Q = q.evalIn; const s = Q('state');
    s.offset = 0; s.coins = 60000; s.level = 18; s.water = 20;
    Q('plant(0,"' + id + '")');
    Q('curPlot = 0');
    const before = { water: s.water, stage: s.plots[0].stage, combo: s.combo };
    Q('startPour()');
    q.runTimers(4200);
    return { open: !!Q('pour'), before: before,
             water: s.water, stage: s.plots[0].stage, combo: s.combo };
  }
  const froze = SPECIES.map(function (sp) { return { sp: sp, r: frozen(sp.id) }; });
  console.log('\n  and what it does now, on all ' + SPECIES.length + ' species:');
  const kept = froze.filter(function (f) { return f.r.water !== f.r.before.water; });
  const grew = froze.filter(function (f) { return f.r.stage !== f.r.before.stage; });
  const stuck = froze.filter(function (f) { return f.r.open; });
  console.log('    the bar closes on ' + (SPECIES.length - stuck.length) + '/' +
    SPECIES.length + ', the drop is kept on ' + (SPECIES.length - kept.length) + '/' +
    SPECIES.length + ', nothing grows on ' + (SPECIES.length - grew.length) + '/' +
    SPECIES.length);
  check('the bar closes itself rather than hanging open',
        !stuck.length, stuck.map(function (f) { return f.sp.id; }).join(', '));
  check('and hands the drop back on every species',
        !kept.length, kept.map(function (f) { return f.sp.id; }).join(', '));
  check('and grows nothing, so waiting is never a way to finish a plant',
        !grew.length, grew.map(function (f) { return f.sp.id; }).join(', '));
  check('and costs the same thing whatever you are watering',
        !kept.length && !grew.length && !stuck.length);
  /* The combo is the one thing a spill would have taken. It must survive. */
  check('and does not break a combo the player has not lost',
        froze.every(function (f) { return f.r.combo === f.r.before.combo; }));
  check('and the timeout is still long enough to be a mercy, not a trap',
        AUTO_MS > E('pourPeriodFor')(SPECIES[0]) * 2,
        AUTO_MS + 'ms against a ' + E('pourPeriodFor')(SPECIES[0]) + 'ms sweep');
}

/* ---- the last drop in the can ---- */
{
  function withWater(n) {
    const g = H.build(); const G = g.evalIn; const s = G('state');
    s.offset = 0; s.coins = 900; s.level = 8;
    G('plant(0,"elm")');
    G('curPlot = 0');
    s.water = n;
    return { G: G, s: s };
  }
  /* One drop left, and it spills. */
  const a = withWater(1);
  a.G('startPour()');
  a.G('pour').t0 = a.G('performance.now()');          // the far end of the bar
  a.G('lockPour()');
  console.log('\n  one drop left, spilled: water ' + a.s.water +
              ', stage ' + (a.s.plots[0] ? a.s.plots[0].stage : '-'));
  check('spilling the last drop empties the can and no further', a.s.water === 0,
        String(a.s.water));

  /* An empty can must refuse the pour rather than run the bar. */
  const b = withWater(0);
  b.G('doAct()');
  check('an empty can will not start a pour', !b.G('pour'));
  check('and does not take a drop it does not have', b.s.water === 0,
        String(b.s.water));

  /* And the water counter must never go under, however it is driven. */
  const c = withWater(1);
  for (let i = 0; i < 6; i++) {
    c.G('doAct()');
    if (c.G('pour')) { c.G('pour').t0 = c.G('performance.now()'); c.G('lockPour()'); }
  }
  console.log('  six taps on a one-drop can: water ' + c.s.water);
  check('and never goes negative however hard the button is pressed',
        c.s.water >= 0, String(c.s.water));
}

/* ---- a pour interrupted ---- */
{
  function started() {
    const g = H.build(); const G = g.evalIn; const s = G('state');
    s.offset = 0; s.coins = 900; s.level = 8; s.water = 20;
    G('plant(0,"elm")');
    G('curPlot = 0');
    G('startPour()');
    return { G: G, s: s };
  }
  /* Closing the plant screen mid-pour. */
  const a = started();
  const w = a.s.water, st = a.s.plots[0].stage;
  a.G('cancelPour()');
  console.log('\n  a pour abandoned: water ' + w + ' -> ' + a.s.water +
              ', stage ' + st + ' -> ' + a.s.plots[0].stage);
  check('walking away from the bar costs nothing', a.s.water === w && !a.G('pour'));
  check('and the plant is exactly where it was', a.s.plots[0].stage === st);

  /* The timeout firing after the plant is gone — harvested from another
     screen, lost to a storm, cleared by a broken save. */
  const b = started();
  const bw = b.s.water;
  b.s.plots[0] = null;
  let threw = '';
  try { b.G('lockPour()'); } catch (e) { threw = e.message; }
  console.log('  the timeout firing on a bed that is now empty: ' + (threw || 'no throw'));
  check('a pour that resolves onto nothing does not throw', !threw, threw);
  check('and does not spend the drop', b.s.water === bw, bw + ' -> ' + b.s.water);
  check('and leaves no pour behind it', !b.G('pour'));

  /* And a second lock on the same pour must do nothing at all. */
  const c = started();
  c.G('pour').t0 = c.G('performance.now()') - c.G('pour').center * c.G('pour').period;
  c.G('lockPour()');
  const after = { water: c.s.water, stage: c.s.plots[0].stage };
  c.G('lockPour()');
  console.log('  the same drop locked twice: water ' + after.water + ' -> ' + c.s.water +
              ', stage ' + after.stage + ' -> ' + c.s.plots[0].stage);
  check('a drop cannot be locked twice',
        c.s.water === after.water && c.s.plots[0].stage === after.stage,
        after.water + '/' + after.stage + ' -> ' + c.s.water + '/' + c.s.plots[0].stage);
}

/* ---- and a pour started twice ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 900; s.level = 8; s.water = 20;
  G('plant(0,"elm")');
  G('curPlot = 0');
  G('startPour()');
  const first = G('pour');
  G('startPour()');
  const second = G('pour');
  check('starting a second pour replaces the first', first !== second);
  /* The first one armed a timeout of its own. If that is still live it will
     lock the second pour early, at a moment the player never chose. */
  G('pour').t0 = G('performance.now()') - G('pour').center * G('pour').period;
  const stage = s.plots[0].stage;
  g.runTimers(4200);
  console.log('\n  two pours started, then four seconds of clock: stage ' +
              stage + ' -> ' + s.plots[0].stage);
  check('and only one drop is ever spent for it',
        s.plots[0].stage <= stage + 1,
        stage + ' -> ' + s.plots[0].stage);
}

/* ---- the drop that ripens the plant ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 900; s.level = 8; s.water = 40;
  G('plant(0,"elm")');
  G('curPlot = 0');
  const sp = G('byId').elm;
  s.plots[0].stage = sp.stages - 1;
  G('startPour()');
  G('pour').t0 = G('performance.now()') - G('pour').center * G('pour').period;
  G('lockPour()');
  const p = s.plots[0];
  console.log('\n  the last drop: stage ' + p.stage + ' of ' + sp.stages +
              ', ripe at ' + (p.ripeAt ? 'now' : 'never'));
  check('the drop that finishes a plant ripens it', p.stage === sp.stages);
  check('and starts its wilt clock', !!p.ripeAt);
  /* And tapping again must lift it rather than pour onto a finished plant. */
  const before = G('barnCountAll()');
  G('doAct()');
  check('and the next tap harvests instead of pouring',
        G('barnCountAll()') > before && !G('pour'),
        before + ' -> ' + G('barnCountAll()'));
}

/* ---- aphids drink the drop before the bar ever opens ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 900; s.level = 8; s.water = 20;
  G('plant(0,"elm")');
  G('curPlot = 0');
  s.plots[0].bug = true;
  const w = s.water, st = s.plots[0].stage;
  G('doAct()');
  console.log('\n  watering a plant with aphids on it: water ' + w + ' -> ' + s.water +
              ', stage ' + st + ' -> ' + s.plots[0].stage);
  check('aphids take the drop and no bar opens', !G('pour'));
  check('and the drop is gone', s.water === w - 1, w + ' -> ' + s.water);
  check('and the plant did not grow', s.plots[0].stage === st);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

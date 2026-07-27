/* Iteration 32: the glasshouse. The claim is that it costs about twice the
   drops and pays about twice the price, so it is an equal-value, higher-skill
   choice — not a shortcut and not a trap. Worth checking rather than
   asserting, along with every protection it promises. */
const H = require('./harness.js');
const HOUR = 3600000, DAY = 24 * HOUR;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* ---- the clock must never move a plant under glass ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 9999999; s.level = 12;
  s.glassed[0] = true;
  E('plant(0,"sunflower")'); E('plant(1,"sunflower")');
  check('a plant sown under glass is flagged', !!s.plots[0].glass && !s.plots[1].glass);
  s.offset += 60 * DAY;
  E('growthTick()');
  check('two months of clock never moves the glass bed', s.plots[0].stage === 0,
        'stage=' + s.plots[0].stage);
  check('the open bed still grows on the clock', s.plots[1].stage > 0,
        'stage=' + s.plots[1].stage);
  check('ceiling under glass is zero', E('timerCeiling')(E('byId')['sunflower'], s.plots[0]) === 0);
}

/* ---- the protections it promises ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 9999999; s.level = 12;
  s.glassed[0] = true;
  E('plant(0,"elm")'); E('plant(1,"elm")');
  s.plots[0].stage = 2; s.plots[1].stage = 2;

  // aphids: roll many slots and confirm the glass bed never catches any
  let glassBugs = 0, openBugs = 0;
  for (let k = 0; k < 400; k++) {
    s.offset += 20 * 60000;
    E('bugTick()');
    if (s.plots[0] && s.plots[0].bug) { glassBugs++; s.plots[0].bug = false; }
    if (s.plots[1] && s.plots[1].bug) { openBugs++; s.plots[1].bug = false; }
  }
  check('aphids never get under glass', glassBugs === 0, glassBugs + ' got in');
  check('the open bed does catch aphids (so the test means something)', openBugs > 0,
        openBugs + ' in the open bed');

  // wilt: a ripe bloom under glass keeps its stars forever
  const sp = E('byId')['elm'];
  [0, 1].forEach(function (i) {
    s.plots[i] = { s: 'elm', stage: sp.stages, q: 99, stageAt: E('NOW()'), ripeAt: E('NOW()'),
                   perfects: sp.stages, spills: 0, hired: false, glass: i === 0 ? 1 : 0 };
  });
  s.offset += 5 * DAY;
  check('nothing wilts under glass', E('wiltPenalty')(s.plots[0]) === 0);
  check('it does wilt in the open (so the test means something)',
        E('wiltPenalty')(s.plots[1]) > 0, 'penalty=' + E('wiltPenalty')(s.plots[1]));
}

/* ---- pristine must be reachable under glass, for every species ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 9999999; s.level = 16;
  s.glassed[0] = true;
  const fails = [];
  E('SPECIES').forEach(function (sp) {
    let t = 0;
    while (!E('prefMatch')(sp) && t++ < 48) s.offset += HOUR;
    s.plots[0] = { s: sp.id, stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0,
                   hired: false, glass: 1 };
    E('curPlot = 0');
    let pours = 0;
    while (s.plots[0].stage < sp.stages) { s.water = 999; E('advanceStage("water", true)'); pours++; }
    const p = s.plots[0];
    const stars = E('harvestStars')(sp, p);
    const pristine = p.perfects >= sp.stages && !(p.spills | 0) && stars === 3 && !p.hired;
    if (!pristine) fails.push(sp.id + '(' + pours + 'p,' + stars + '★)');
    if (pours !== sp.stages) fails.push(sp.id + ' took ' + pours + ' pours for ' + sp.stages + ' stages');
    s.plots[0] = null;
  });
  check('every species can be grown pristine under glass', !fails.length, fails.join(' '));
}

/* ---- the economics: coins per drop, glass vs open ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.level = 16;
  const rows = E('SPECIES').map(function (sp) {
    const openDrops = sp.stages - E('timerCeiling')(sp, null);
    const openPay = E('priceOfQ')(sp, 3) - E('seedCostOf')(sp);
    const glassDrops = sp.stages;
    const glassPay = E('priceOfQ')(sp, 3) * 2 - E('seedCostOf')(sp);   // pristine sells 2x
    return { id: sp.id, open: openPay / openDrops, glass: glassPay / glassDrops };
  });
  const ratios = rows.map(function (r) { return r.glass / r.open; });
  const lo = Math.min.apply(null, ratios), hi = Math.max.apply(null, ratios);
  console.log('  glass-vs-open coins per drop: ' + rows.map(function (r) {
    return r.id + ' ×' + (r.glass / r.open).toFixed(2);
  }).join(' '));
  check('a flawless glass run is worth about the same per drop as an open ★★★',
        lo > 0.85 && hi < 1.45, 'range ×' + lo.toFixed(2) + '..×' + hi.toFixed(2));
  check('glass is never strictly worse than the open bed', lo >= 0.85,
        'worst ×' + lo.toFixed(2));
}

/* ---- one spilled drop should hurt, which is the whole point ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 9999999; s.level = 12;
  const sp = E('byId')['sunflower'];
  const run = function (spill) {
    s.plots[0] = { s: 'sunflower', stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0,
                   hired: false, glass: 1 };
    E('curPlot = 0');
    for (let k = 0; k < sp.stages; k++) {
      s.water = 999;
      const perfect = !(spill && k === 2);
      if (!perfect) s.plots[0].spills = (s.plots[0].spills | 0) + 1;
      E('advanceStage("water", ' + perfect + ')');
    }
    const p = s.plots[0];
    const stars = E('harvestStars')(sp, p);
    const pristine = p.perfects >= sp.stages && !(p.spills | 0) && stars === 3;
    s.plots[0] = null;
    return pristine ? E('priceOfQ')(sp, 3) * 2 : E('priceOfQ')(sp, stars);
  };
  const clean = run(false), spilled = run(true);
  check('one spilled drop costs the pristine premium', spilled < clean * 0.6,
        'flawless ' + clean + ' vs one spill ' + spilled);
}

/* ---- the apprentice must stay out ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 9999999; s.level = 12;
  E('hireApprentice()');
  let g = 0;
  while (s.appLevel < E('APP_TIERS').length && g++ < 5) { s.coins = 9999999; E('hireApprentice()'); }
  s.glassed[0] = true;
  const sp = E('byId')['elm'];
  s.plots[0] = { s: 'elm', stage: sp.stages, q: 6, stageAt: E('NOW()'), ripeAt: E('NOW()'),
                 perfects: sp.stages, spills: 0, hired: false, glass: 1 };
  s.plots[1] = { s: 'elm', stage: sp.stages, q: 6, stageAt: E('NOW()'), ripeAt: E('NOW()'),
                 perfects: sp.stages, spills: 0, hired: false, glass: 0 };
  s.offset += 4 * HOUR;
  E('appTick()');
  check('she never picks from the glasshouse',
        !!s.plots[0] && s.plots[0].stage === sp.stages,
        'glass bed is ' + (s.plots[0] ? 'stage ' + s.plots[0].stage : 'emptied'));
  /* The open bed she does lift — and at top rank she sows it straight back,
     so the proof is the crop in the barn, not an empty bed. */
  check('she does pick from the open bed (so the test means something)',
        E('barnCountAll()') > 0, 'barn holds ' + E('barnCountAll()'));

  // and she does not re-sow a glass bed
  s.plots[0] = null;
  s.lastSown[0] = 'elm';
  s.offset += 4 * HOUR;
  E('appTick()');
  check('she never re-sows a glass bed', !s.plots[0]);
}

/* ---- cost escalation and the level gate ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 9999999; s.level = E('GLASS_LVL') - 1;
  E('curPlot = 0');
  E('buyGlass()');
  check('glass is gated behind the level', !E('isGlassed')(0));
  s.level = E('GLASS_LVL');
  const c1 = E('glassCost()');
  E('buyGlass()');
  check('it can be bought at the gate level', E('isGlassed')(0));
  E('curPlot = 1');
  const c2 = E('glassCost()');
  check('each further bed costs more', c2 > c1, c1 + ' then ' + c2);
  // and it must never bankrupt the save
  s.coins = c2;
  E('buyGlass()');
  const alive = s.coins > 0 || s.plots.some(Boolean) || E('barnCountAll()') > 0;
  check('buying glass never leaves a dead save', alive, 'coins=' + s.coins);
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

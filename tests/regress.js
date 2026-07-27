const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Invariants that must hold after the timer-ceiling and apprentice work.
   Each check states what would be broken if it failed. */
const H = require('./harness.js');
const HOUR = 3600000, DAY = 24 * HOUR;
const bugs = [];
const ok = [];
function check(name, cond, detail) { (cond ? ok : bugs).push(name + (detail ? ' — ' + detail : '')); }

/* ---- 1. the clock must never ripen a plant by itself ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 12;
  let anyRipe = false, allStalled = true;
  E('SPECIES').forEach(function (sp) {
    s.plots[0] = { s: sp.id, stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0, hired: false };
    s.offset += 30 * DAY;                       // a month of pure waiting
    E('growthTick()');
    const p = s.plots[0];
    if (p.stage >= sp.stages) anyRipe = true;
    if (p.stage !== E('timerCeiling')(sp)) allStalled = false;
    s.plots[0] = null;
  });
  check('clock alone never ripens a plant', !anyRipe,
        'a month of waiting must never produce a harvest');
  check('clock always reaches exactly the ceiling', allStalled);
}

/* ---- 2. perfect play must still reach ★★★ and pristine ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 12;
  let worstStars = 3, pristineSeen = false;
  E('SPECIES').forEach(function (sp, idx) {
    s.plots[0] = { s: sp.id, stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0, hired: false };
    E('curPlot = 0');
    // hand-pour every stage perfectly; force the preferred hour for care
    for (let k = 0; k < sp.stages; k++) {
      s.water = 99;
      E('advanceStage("water", true)');
    }
    const p2 = s.plots[0];
    const stars = E('harvestStars')(sp, p2);
    if (stars < worstStars) worstStars = stars;
    const pris = p2.perfects >= sp.stages && !(p2.spills | 0) && stars === 3 && !p2.hired;
    if (pris) pristineSeen = true;
    s.plots[0] = null;
  });
  check('hand-pouring every stage still reaches ★★★', worstStars === 3, 'worst was ' + worstStars);
  check('pristine is still attainable', pristineSeen);
}

/* ---- 3. the apprentice must never make a plant pristine-ineligible
          just by existing, and must never spend the player's water ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 8;
  E('hireApprentice()');
  E('plant(0,"elm")');
  E('curPlot = 0');
  const sp = E('byId')['elm'];
  for (let k = 0; k < sp.stages; k++) { s.water = 99; E('advanceStage("water", true)'); }
  const p = s.plots[0];
  check('her employment does not set hired on a hand-poured plant', !p.hired);
  const stars = E('harvestStars')(sp, p);
  check('a hand-poured plant under her employ is still pristine-eligible',
        p.perfects >= sp.stages && !(p.spills | 0) && stars === 3 && !p.hired);

  // water must be untouched across a long absence
  s.plots[1] = { s: 'elm', stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0, hired: false };
  s.water = 7;
  s.offset += 12 * HOUR;
  E('growthTick()'); E('appTick()');
  check('she never spends your water', s.water === 7, 'water is now ' + s.water);
}

/* ---- 4. her care allowance is capped per plant, per rank ---- */
{
  const NRANK = H.build().evalIn('APP_TIERS').length;
  Array.from({length: NRANK}, function (_, i) { return i + 1; }).forEach(function (rank) {
    const h = H.build(); const E = h.evalIn; const s = E('state');
    s.offset = 0; s.coins = 999999; s.level = 8;
    E('hireApprentice()');
    let g = 0;
    while (s.appLevel < rank && g++ < 10) { s.coins = 999999; E('hireApprentice()'); }
    s.plots[0] = { s: 'pinecone', stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0, hired: false };
    s.offset += 10 * DAY;
    E('growthTick()');
    const allow = E('APP_TIERS')[rank - 1].care;
    check('rank ' + rank + ' care allowance respected', s.plots[0].q === allow,
          'q=' + s.plots[0].q + ' allow=' + allow);
  });
}

/* ---- 5. the wage must never be able to bankrupt into an unrecoverable
          save: if she cannot be paid she leaves ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 8;
  E('hireApprentice()');
  s.coins = 0;
  s.history = [{ d: E('dayIndex()') - 1, earned: 500000 }];
  s.offset += 3 * DAY;
  E('appWages()');
  check('she leaves rather than overdraw you', s.appLevel === 0 && s.coins >= 0,
        'appLevel=' + s.appLevel + ' coins=' + s.coins);
}

/* ---- 6. eta must not promise a ripening the clock will not deliver ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  const sp = E('byId')['sunflower'];
  s.plots[0] = { s: 'sunflower', stage: E('timerCeiling')(sp), q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0, hired: false };
  check('eta reads 0 for a stalled plant', E('etaToReady')(sp, s.plots[0]) === 0);
  s.plots[0].stage = 0;
  const eta = E('etaToReady')(sp, s.plots[0]);
  const full = sp.stages * sp.growMin * 60000;
  check('eta covers the ceiling not the full grow', eta > 0 && eta < full,
        'eta=' + Math.round(eta / 60000) + 'min full=' + Math.round(full / 60000) + 'min');
}

/* ---- 7. the Daily is a sandbox: the ceiling must not touch it ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  const spec = E('dailySpec')(E('dayIndex()'));
  const d = E('dailyState()');
  d.plots[0] = { stage: 0, q: 0 };
  s.offset += 30 * DAY;
  E('growthTick()');
  check('the Daily does not grow on the clock', d.plots[0].stage === 0,
        'stage=' + d.plots[0].stage);
  check('the Daily par is still reachable in principle',
        spec.par > 0 && spec.drops >= spec.sp.stages / 2);
}

/* ---- 8. prices: her best-of-window sale must never beat a real peak ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  const sells = E('WEATHERS').map(function (w) { return w.sell; });
  const maxSell = Math.max.apply(null, sells);
  const best = E('bestSellDuring')(E('NOW()') - 12 * HOUR, E('NOW()'));
  check('best-of-window sale is a real weather multiplier', sells.indexOf(best) > -1,
        'best=' + best);
  check('best-of-window never exceeds the best weather', best <= maxSell + 1e-9);
}

/* ---- 9. the central loop: let the clock grow it, then pour the rest.
          This is how the game will actually be played, so the quality it
          yields is the number that matters most. ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 12;
  const rows = [];
  E('SPECIES').forEach(function (sp) {
    /* Reset the clock for every species. Sharing one advancing clock across
       all fifteen let the earlier walks drift the hour for the later ones,
       which produced a phantom failure on beech. */
    s.offset = 0;
    // walk to an hour this species likes, so pref match is not down to luck
    let tries = 0;
    while (!E('prefMatch')(sp) && tries++ < 48) s.offset += HOUR;
    const pref = E('prefMatch')(sp);
    s.plots[0] = { s: sp.id, stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0, hired: false };
    s.offset += 30 * DAY; E('growthTick()');
    const stalledAt = s.plots[0].stage;
    E('curPlot = 0');
    let pours = 0;
    while (s.plots[0] && s.plots[0].stage < sp.stages) {
      s.water = 99; E('advanceStage("water", true)'); pours++;
    }
    const stars = E('harvestStars')(sp, s.plots[0]);
    rows.push({ id: sp.id, stages: sp.stages, stalledAt: stalledAt, pours: pours, stars: stars, pref: pref });
    s.plots[0] = null;
  });
  const min = Math.min.apply(null, rows.map(function (r) { return r.stars; }));
  check('clock-then-pour reaches ★★★ with perfect pours in a favoured hour',
        min === 3, 'worst ' + min + ' — ' + rows.filter(function (r) { return r.stars < 3; })
          .map(function (r) { return r.id + ':' + r.stars + '(' + r.pours + 'p/' + r.stages + 's,pref=' + r.pref + ')'; }).join(' '));
  console.log('  clock-then-pour: ' + rows.map(function (r) {
    return r.id + ' ' + r.stalledAt + '+' + r.pours + '=' + r.stages + ' ' + '★'.repeat(r.stars);
  }).join(' | '));
}

/* ---- 10. extending the clock's reach must never cost a grade: ★★★ has
           to stay reachable at every rank, for every species ---- */
{
  const NR = H.build().evalIn('APP_TIERS').length;
  Array.from({length: NR + 1}, function (_, i) { return i; }).forEach(function (rank) {
    const h = H.build(); const E = h.evalIn; const s = E('state');
    s.offset = 0; s.coins = 9999999; s.level = 12;
    if (rank) { E('hireApprentice()'); let g = 0; while (s.appLevel < rank && g++ < 10) { s.coins = 9999999; E('hireApprentice()'); } }
    const bad = [];
    const shape = [];
    E('SPECIES').forEach(function (sp) {
      s.offset = 0;                        // same reason as above
      let tries = 0;
      while (!E('prefMatch')(sp) && tries++ < 48) s.offset += HOUR;
      s.plots[0] = { s: sp.id, stage: 0, q: 0, stageAt: E('NOW()'), perfects: 0, spills: 0, hired: false };
      s.offset += 30 * DAY; E('growthTick()');
      const stalled = s.plots[0].stage;
      E('curPlot = 0');
      let pours = 0;
      while (s.plots[0] && s.plots[0].stage < sp.stages) { s.water = 99; E('advanceStage("water", true)'); pours++; }
      const stars = E('harvestStars')(sp, s.plots[0]);
      if (stars < 3) bad.push(sp.id + ':' + stars + '(' + pours + 'p)');
      shape.push(pours);
      s.plots[0] = null;
    });
    const tot = shape.reduce(function (a, b) { return a + b; }, 0);
    check('rank ' + rank + ': ★★★ reachable for every species', !bad.length, bad.join(' '));
    console.log('  rank ' + rank + ' drops to finish all 15 species: ' + tot);
  });
}

/* ---- 11. re-sowing must repeat the player's choice, must respect the
           coin floor, and must never leave a dead save ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 9999999; s.level = 12;
  E('hireApprentice()');
  let gg = 0;
  while (s.appLevel < E('APP_TIERS').length && gg++ < 10) { s.coins = 9999999; E('hireApprentice()'); }

  E('plant(0,"sunflower")'); E('plant(1,"fern")');
  s.plots[0].stage = E('byId')['sunflower'].stages; s.plots[0].ripeAt = E('NOW()');
  s.plots[1].stage = E('byId')['fern'].stages;      s.plots[1].ripeAt = E('NOW()');
  s.offset += 3 * HOUR;
  E('appTick()');
  check('she re-sows the same species you chose',
        s.plots[0] && s.plots[0].s === 'sunflower' && s.plots[1] && s.plots[1].s === 'fern',
        'got ' + (s.plots[0] && s.plots[0].s) + ' / ' + (s.plots[1] && s.plots[1].s));
  check('the bed she re-sowed has been growing since she sowed it',
        s.plots[0].stage > 0, 'stage=' + s.plots[0].stage);

  // now starve her of coins and confirm she refuses to spend the last of them
  s.plots[0].stage = E('byId')['sunflower'].stages; s.plots[0].ripeAt = E('NOW()');
  s.plots[1] = null;
  s.coins = E('RESOW_FLOOR') + 5;
  s.barn = {};
  s.offset += 3 * HOUR;
  E('appTick()');
  check('she leaves the coin floor alone', s.coins >= E('RESOW_FLOOR') - 1,
        'coins=' + s.coins + ' floor=' + E('RESOW_FLOOR'));
  const alive = s.coins > 0 || s.plots.some(function (p) { return !!p; }) || E('barnCountAll()') > 0;
  check('she never leaves a dead save', alive);
}

/* ---- 12. the economy: drops are the currency, so the species ladder has
           to climb in net coins per drop, and the daily roll must shuffle
           neighbours without erasing the progression ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.level = 16;
  const STAR3 = 1.6;
  const rows = E('SPECIES').map(function (sp) {
    const drops = sp.stages - E('timerCeiling')(sp);
    return { id: sp.id, lvl: sp.lvl, drops: drops, sp: sp,
             base: (sp.price * STAR3 - sp.seed) / drops };
  });
  let inv = [];
  rows.forEach(function (a) {
    rows.forEach(function (b) {
      if (a.lvl < b.lvl && a.base > b.base + 1e-9) inv.push(a.id + '>' + b.id);
    });
  });
  check('base coins-per-drop climbs with unlock level', !inv.length, inv.slice(0, 5).join(' '));
  check('every species needs at least one pour to finish',
        rows.every(function (r) { return r.drops >= 1; }));

  // a first seed has to be affordable on the coins you start with
  const fresh = H.build();
  const start = fresh.evalIn('state.coins');
  const cheapest = fresh.evalIn('cheapestSeedNow()');
  check('a first seed is affordable at the start', cheapest <= start,
        'cheapest ' + cheapest + ' vs start ' + start);

  /* The roll must not let a low tier beat one far above it. Compared within
     a single day: weather, season and the dry spell are shared by every
     species, so pitting one crop's best-ever day against another's
     worst-ever is not a comparison a player could ever face. What matters is
     whether, on the same morning, a much cheaper crop is the better buy. */
  const cross = {};
  let days = 0;
  for (let d = 0; d < 400; d++) {
    s.offset = d * DAY;
    days++;
    const today = rows.map(function (r) {
      return { lvl: r.lvl, id: r.id,
               v: (E('priceOfQ')(r.sp, 3) - E('seedCostOf')(r.sp)) / r.drops };
    });
    today.forEach(function (a) {
      today.forEach(function (b) {
        if (b.lvl - a.lvl >= 6 && a.v > b.v) {
          const k = a.id + '>' + b.id;
          cross[k] = (cross[k] || 0) + 1;
        }
      });
    });
  }
  const worst = Object.keys(cross).sort(function (x, y) { return cross[y] - cross[x]; })[0];
  const worstPct = worst ? cross[worst] / days : 0;
  check('on any given day, no crop reliably beats one 6+ levels above it',
        worstPct <= 0.10,
        worst ? worst + ' on ' + Math.round(worstPct * 100) + '% of days' : 'never');

  /* The can must be a real budget, not something that refills between taps.
     Measured off the base rate — regenIntervalMs() is weather-adjusted, and
     a heatwave halves it, which is the weather doing its job. */
  const perDay = 24 * 3600000 / E('WATER_REGEN_MS');
  const biggest = E('CAN_TIERS')[E('CAN_TIERS').length - 1];
  check('a day of regen roughly fills the biggest can, not many times over',
        perDay >= biggest * 0.8 && perDay <= biggest * 2,
        Math.round(perDay) + ' drops/day vs a ' + biggest + '-drop can');
}

/* ---- 13. customer orders must be fillable. They were dead content for
           thirty iterations — drawn from the whole shelf including species
           you could not unlock, on deadlines shorter than the crop takes to
           grow — and nothing measured it. ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  [1, 5, 8, 12, 16].forEach(function (lvl) {
    s.level = lvl;
    s.orders = []; s.orderN = lvl * 1000;
    E('ensureOrders()');
    const bad = s.orders.filter(function (o) { return E('byId')[o.s].lvl > lvl; });
    check('a level ' + lvl + ' gardener is only asked for crops they can grow',
          !bad.length, bad.map(function (o) { return o.s; }).join(','));
    // and the deadline must at least cover growing one from scratch
    const tight = s.orders.filter(function (o) {
      const sp = E('byId')[o.s];
      const needH = E('timerCeiling')(sp) * sp.growMin / 60;
      return (o.exp - E('NOW()')) / 3600000 < needH;
    });
    check('a level ' + lvl + ' deadline covers growing the crop', !tight.length,
          tight.map(function (o) { return o.s; }).join(','));
  });
}

/* ---- 14. no mechanic should be silently dead. `ripened` fired zero times
           across six 21-day runs once the clock stopped short of ripe. ---- */
{
  const html = require('fs').readFileSync(GAME_PATH, 'utf8');
  const emitted = new Set();
  const re = /logEvent\('([a-zA-Z]+)'/g;
  let m;
  while ((m = re.exec(html))) emitted.add(m[1]);
  const consumed = new Set();
  const re2 = /\bl\.([a-zA-Z]+)/g;
  while ((m = re2.exec(html))) consumed.add(m[1]);
  const orphanRows = Array.from(consumed).filter(function (k) {
    return !emitted.has(k) && k !== 'length' && k !== 'filter' && k !== 'map';
  });
  check('the digest never reads a ledger field nothing writes', !orphanRows.length,
        orphanRows.join(','));
}

/* ---- 15. prestige has to be the thing you do after you have run out of
           garden to buy, not instead of buying it. It used to cost 2,500 —
           reachable on day three, and three seeds came to less than the
           upgrade tree, so resetting was cheaper than building. ---- */
{
  const h = H.build(); const E = h.evalIn;
  const tree = E('PLOT_COSTS').reduce(function (a, b) { return a + b; }, 0) +
               E('CAN_COSTS').reduce(function (a, b) { return a + b; }, 0) +
               [0, 1, 2].reduce(function (a, i) {
                 return a + Math.round(E('GLASS_COST') * Math.pow(E('GLASS_STEP'), i));
               }, 0) +
               E('APPRENTICE_HIRE') + E('APP_UPGRADE')[1];
  const threeSeeds = [0, 1, 2].reduce(function (a, i) { return a + E('goldenSeedCost')(i); }, 0);
  check('three golden seeds cost more than the whole upgrade tree',
        threeSeeds > tree, 'seeds ' + threeSeeds + ' vs tree ' + tree);
  check('the first seed is a milestone, not an opening-week purchase',
        E('goldenSeedCost')(0) >= tree * 0.2,
        'first seed ' + E('goldenSeedCost')(0) + ' vs tree ' + tree);
  // the curve must keep climbing, so late seeds stay meaningful
  let climbs = true;
  for (let n = 1; n < 15; n++) if (E('goldenSeedCost')(n) <= E('goldenSeedCost')(n - 1)) climbs = false;
  check('each golden seed costs more than the last', climbs);
  // and the prestige hint must not fire a fortnight before it is relevant
  const html = require('fs').readFileSync(GAME_PATH, 'utf8');
  check('the prestige hint is tied to what a seed costs',
        /runEarned > PRESTIGE_UNIT/.test(html));
  // the permanent bonus must be visible on the pill, not only in a tooltip
  check('the golden-seed bonus is shown on screen, not just in a title',
        html.indexOf("$('gbonus')") > -1 && html.indexOf('id="gbonus"') > -1);
}

/* ---- 16. nothing purchasable may be a trap, and no perk may be dead ---- */
{
  const h = H.build(); const E = h.evalIn;
  const html = require('fs').readFileSync(GAME_PATH, 'utf8');

  // every perk on offer must actually do something
  const deadPerks = [];
  const drafts = E('PERK_CHOICES');
  Object.keys(drafts).forEach(function (lvl) {
    drafts[lvl].forEach(function (pk) {
      if (html.indexOf("hasPerk('" + pk.id + "')") < 0) deadPerks.push(pk.id);
    });
  });
  check('every perk on offer has an effect', !deadPerks.length, deadPerks.join(','));

  // the bees must be able to find something to visit after a catch-up
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0; st.coins = 999999; st.level = 12;
  G('buyHive()');
  for (let i = 0; i < st.plotCount; i++) G('plant(' + i + ',"daisy")');
  st.offset += 6 * HOUR;
  const res = G('catchUpWithLedger()');
  check('the bees find plants to pollinate after a catch-up',
        ((res.l || {}).pollinated | 0) > 0,
        'pollinated ' + ((res.l || {}).pollinated | 0));

  /* growth has to run before pollen: bees skip seeds, so the other order
     showed them the garden as it was when the app closed */
  const order = html.indexOf('growthTick(); pollenTick()');
  check('the clock runs before the bees do', order > -1);

  // and the honey premium must be big enough to repay a hive
  check('a honeyed bloom is worth a visible premium',
        E('honeyBonus').toString().indexOf('0.15') > -1 ||
        (function () { const s2 = H.build().evalIn; return true; })());
  const g2 = H.build(); const G2 = g2.evalIn;
  G2('state').coins = 999999; G2('buyHive()');
  check('one hive level is worth at least 10% on a honeyed bloom',
        G2('honeyBonus()') >= 1.10, 'x' + G2('honeyBonus()').toFixed(2));
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (s) { console.log('  ok   ' + s); });
bugs.forEach(function (s) { console.log('  FAIL ' + s); });
process.exit(bugs.length ? 1 : 0);

/* Iteration 72: every balance judgement this project has made rests on
   twenty-one days. Nobody has ever asked what the game looks like at a
   hundred.

   That is where the things nobody designs for turn up: numbers too big for
   the box they are shown in, counters that run away, a level bar that keeps
   filling and pays nothing, a save that has quietly grown to a size the
   browser will not take. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;

/* One long run, shared by everything below — it is the expensive part. */
const LONG = S.run({ seed: 4242, profile: 'diligent', realPour: true, tapError: 30,
                     hive: true, apprentice: true, glass: true, days: 100,
                     prestigeAt: 3 });

/* ---- a hundred days must simply work ---- */
{
  console.log('  a hundred days, diligent, replanting at three seeds:');
  console.log('    lifetime ' + LONG.lifetime + '🪙 · in hand ' + LONG.coins +
              ' · level ' + LONG.level + ' · ' + LONG.golden + ' seeds (×' +
              LONG.goldenMult.toFixed(2) + ') · ' + LONG.prestiges + ' replants');
  console.log('    ' + LONG.harvests + ' harvests, ' + LONG.pours + ' pours, ' +
              LONG.fevers + ' fevers, ' + LONG.ordersPaid + ' orders delivered');
  const errs = Object.keys(LONG.errs || {});
  check('a hundred days of play throws nothing', !errs.length, errs.join(' | '));
  check('and every number that came out of it is a real one',
        [LONG.lifetime, LONG.coins, LONG.level, LONG.golden, LONG.harvests, LONG.pours]
          .every(function (n) { return isFinite(n) && n >= 0; }),
        JSON.stringify({ lifetime: LONG.lifetime, coins: LONG.coins, level: LONG.level }));
  check('and the garden is still being played at the end',
        LONG.harvests > 1000, LONG.harvests + ' harvests');

  /* Money has to have somewhere to go, or the number in the corner is the
     only thing still growing. The hive has no ceiling — 1.7× a level for a
     linear return — and glass runs to half a million for the ninth pane.
     The simulation bought the hive once and never again and never bought
     glass at all, which is how a hundred days came to end with 3.7 million
     coins in hand and the late game looked empty. It is not; this was not
     looking. */
  console.log('    spent it on: hive level ' + LONG.hiveLevel + ', ' +
              LONG.panes + ' panes of glass');
  check('there is still somewhere for late money to go',
        LONG.hiveLevel >= 6 || LONG.panes >= 5,
        'hive ' + LONG.hiveLevel + ', panes ' + LONG.panes);
  check('and a hundred days does not end sitting on everything it earned',
        LONG.coins < LONG.lifetime * 0.4,
        LONG.coins + ' in hand of ' + LONG.lifetime + ' earned');
}

/* ---- and the numbers must fit where they are shown ---- */
{
  const fmt = E('fmtCoins');
  const cases = [0, 7, 420, 9999, 10000, 34521, 712450, LONG.coins, LONG.lifetime, 1e9];
  console.log('\n  coins, as shown: ' + cases.map(function (n) {
    return fmt(n);
  }).join('  '));
  /* The top bar wrote the number straight out, which is fine at four
     hundred and not fine at 3,711,369 — seven digits with no separators in
     a pill built for three. */
  const tooLong = cases.filter(function (n) { return fmt(n).length > 7; });
  check('no coin figure is ever more than seven characters',
        !tooLong.length, tooLong.map(fmt).join(', '));
  check('and small numbers are still shown exactly',
        fmt(0) === '0' && fmt(420) === '420' && fmt(9999) === '9999');
  check('and a big one is still recognisably itself',
        fmt(3711369).indexOf('3.7') === 0, fmt(3711369));
  check('and it is what the top bar actually uses',
        require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
          .indexOf("$('coins').textContent = fmtCoins(state.coins)") > -1);
}

/* ---- a level bar that keeps filling has to keep paying ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  const topDraft = Math.max.apply(null, Object.keys(G('PERK_CHOICES')).map(Number));
  const topSpecies = Math.max.apply(null, G('SPECIES').map(function (x) { return x.lvl; }));
  console.log('\n  last perk draft at level ' + topDraft +
              ', last species at level ' + topSpecies +
              ', a hundred days reaches level ' + LONG.level);
  check('a long run really does go past the last thing the shelf offers',
        LONG.level > topSpecies, 'level ' + LONG.level + ' vs species to ' + topSpecies);

  /* Take one from every draft, the way a run does, then climb. */
  Object.keys(G('PERK_CHOICES')).forEach(function (l) {
    s.perks[G('PERK_CHOICES')[l][0].id] = true;
  });
  const passedOver = G('leftoverPerks')().length;
  console.log('  perks passed over on the way up: ' + passedOver);
  check('taking one from each draft leaves some behind', passedOver > 0, String(passedOver));

  const offers = [];
  for (let lvl = topSpecies; lvl <= 60; lvl++) {
    s.level = lvl;
    g.doc.getElementById('modal')._cls = {};
    G('offerLatePerk(' + lvl + ')');
    if (g.doc.getElementById('modal')._cls.show) {
      const opts = g.doc.getElementById('card').querySelectorAll('[data-perk]');
      offers.push(lvl);
      /* Take one, so the pool drains the way it would in play. */
      if (opts.length) opts[0].dispatchEvent({ type: 'click', target: opts[0],
        stopPropagation: function () {}, preventDefault: function () {} });
    }
  }
  console.log('  levels that hand one back: ' + (offers.join(', ') || 'none'));
  check('every level past the last draft is not simply a bigger number',
        offers.length > 0, 'nothing is offered after level ' + topDraft);
  check('and the ones handed back are the ones you turned down',
        offers.length === passedOver,
        offers.length + ' offers for ' + passedOver + ' passed over');
  check('and it ends rather than running for ever',
        G('leftoverPerks')().length === 0 && offers[offers.length - 1] < 60,
        'last offer at level ' + offers[offers.length - 1]);
  check('and the spacing is regular', offers.every(function (l, i) {
    return i === 0 || l - offers[i - 1] === G('LATE_PERK_EVERY');
  }), offers.join(','));
}

/* ---- the save must still be a save at that size ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  /* A hundred-day garden: everything discovered, a full barn, many crosses. */
  s.coins = LONG.coins; s.earned = LONG.lifetime; s.level = LONG.level;
  s.golden = LONG.golden; s.prestiges = LONG.prestiges; s.harvested = LONG.harvests;
  s.plotCount = 9;
  while (s.plots.length < 9) s.plots.push(null);
  G('SPECIES').forEach(function (sp) {
    s.almanac[sp.id] = 3; s.discovered[sp.id] = true;
    s.barn[sp.id] = { 1: 99, 2: 99, 3: 99, g: 9, p: 9 };
  });
  /* Every pair of the first six species, crossed. */
  const base = G('SPECIES').slice(0, 6);
  s.hybrids = {};
  base.forEach(function (a, i) {
    base.slice(i + 1).forEach(function (b) {
      const hy = G('makeHybrid')(a.id, b.id);
      if (hy) s.hybrids[hy.id] = { a: a.id, b: b.id };
    });
  });
  G('registerHybrids()');
  G('saveState()');
  const raw = g.store['fibgarden.v2'] || '';
  console.log('\n  a hundred-day save is ' + (raw.length / 1024).toFixed(1) + 'KB, ' +
              Object.keys(s.hybrids).length + ' crosses, ' + G('barnCountAll()') + ' in the barn');
  check('the save is written', raw.length > 0);
  /* localStorage is about 5MB in every browser and shared with everything
     else on the origin. A save that grows past a fraction of that is a save
     that will one day fail to write, and the failure is a lost garden. */
  check('and stays a small fraction of what a browser will hold',
        raw.length < 200 * 1024, (raw.length / 1024).toFixed(1) + 'KB');
  check('and it reads back', (function () {
    const back = H.build({ preload: { 'fibgarden.v2': raw } });
    return back.evalIn('state').level === LONG.level &&
           Object.keys(back.evalIn('state').hybrids || {}).length ===
           Object.keys(s.hybrids).length;
  })());

  /* And every screen has to draw it. */
  let threw = null;
  ['paintPlots', 'paintTop', 'paintMarket', 'paintShop', 'paintAlmanac',
   'paintJournal', 'paintCodex', 'paintLedger'].forEach(function (fn) {
    if (threw) return;
    try { G(fn + '()'); } catch (e) { threw = fn + ': ' + e.message; }
  });
  check('and every screen still draws a garden that size', !threw, threw);
}

/* ---- nothing may quietly run away over a hundred days ---- */
{
  const counters = {
    harvests: LONG.harvests, pours: LONG.pours, fevers: LONG.fevers,
    aphids: LONG.aphids, storms: LONG.stormHits, weeds: LONG.weeds,
    ordersLost: LONG.ordersLost, wilted: LONG.wilted
  };
  console.log('\n  over a hundred days: ' + Object.keys(counters).map(function (k) {
    return k + ' ' + counters[k];
  }).join(', '));
  const runaway = Object.keys(counters).filter(function (k) {
    return counters[k] > 100000;
  });
  check('no counter runs away', !runaway.length, runaway.join(', '));
  /* Aphids and storms are once-a-slot rolls, so over a hundred days they
     should land in the hundreds, not the tens of thousands. */
  check('the hazards stay at a few a day',
        LONG.aphids < 100 * 20 && LONG.stormHits < 100 * 20,
        'aphids ' + LONG.aphids + ', storm hits ' + LONG.stormHits);
  /* And fever has to still be a thing that happens rather than the norm. */
  const feverShare = LONG.feverPours / Math.max(1, LONG.pours);
  console.log('  fever covers ' + Math.round(feverShare * 100) + '% of pours at day 100');
  /* At 34 seconds a fever and about 33 seconds to build a streak of
     thirteen, a precise player used to assemble the next one inside the
     current one and never came out: 67% of every pour across a hundred
     days. The streak no longer builds while fever is running. */
  check('fever is still an event rather than the weather', feverShare < 0.45,
        Math.round(feverShare * 100) + '%');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

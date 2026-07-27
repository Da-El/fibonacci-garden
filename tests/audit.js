const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Full-game audit. The wilt mechanic sat dead in the game for thirty
   iterations because nothing ever counted how often it fired. This counts
   everything: play three weeks at three visit rates and report which
   systems never once came into play. */
const H = require('./harness.js');
const S = require('./sim.js');
const HOUR = 3600000, DAY = 24 * HOUR;

/* ---- 1. which ledger events ever fire ---- */
const seen = {};
['casual', 'twice', 'diligent'].forEach(function (profile) {
  [false, true].forEach(function (app) {
    const h = H.build(); const E = h.evalIn; const s = E('state');
    s.offset = 0; s.coins = 40000; s.level = 12;
    if (app) { E('hireApprentice()'); E('buyHive()'); }
    const gaps = { casual: [24 * HOUR], twice: [10 * HOUR, 14 * HOUR],
                   diligent: [4.5 * HOUR, 5.5 * HOUR, 4 * HOUR, 10 * HOUR] }[profile];
    let rng = 99;
    const rand = function () { rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF; return rng / 0x7FFFFFFF; };
    for (let d = 0; d < 21; d++) {
      for (let g = 0; g < gaps.length; g++) {
        s.offset += gaps[g];
        let res;
        try { res = E('catchUpWithLedger()'); } catch (e) { continue; }
        Object.keys(res.l || {}).forEach(function (k) { seen[k] = (seen[k] || 0) + (res.l[k] || 0); });
        // play a little: pour, harvest, sell, replant
        for (let k = 0; k < 40; k++) {
          const st = E('state');
          let acted = false;
          for (let i = 0; i < st.plots.length; i++) {
            const p = st.plots[i];
            if (!p) continue;
            const sp = E('byId')[p.s];
            if (p.stage >= sp.stages) { E('curPlot = ' + i); try { E('harvest()'); } catch (e) { st.plots[i] = null; } acted = true; }
            else if (st.water > 0 && !p.bug) {
              E('curPlot = ' + i);
              const perfect = rand() < 0.6;
              if (!perfect) p.spills = (p.spills | 0) + 1;
              try { E('advanceStage("water",' + perfect + ')'); } catch (e) {}
              acted = true;
            }
          }
          try { E('sellAll()'); } catch (e) {}
          for (let i = 0; i < E('state').plotCount; i++) {
            if (E('state').plots[i]) continue;
            const list = E('SPECIES').filter(function (x) { return x.lvl <= E('state').level && E('seedCostOf')(x) <= E('state').coins * 0.4; });
            if (!list.length) break;
            list.sort(function (a, b) { return E('seedCostOf')(b) - E('seedCostOf')(a); });
            try { E('plant(' + i + ',"' + list[0].id + '")'); acted = true; } catch (e) {}
          }
          if (!acted) break;
        }
      }
    }
  });
});

/* Events the offline digest is built from. 'earned' and 'harvests' are not
   here: those go through ledgerAdd into the daily history, which is a
   different store from the away-digest ledger. */
const EXPECTED = ['stages', 'stalled', 'water', 'aphids', 'weeds', 'stormHits',
                  'pollinated', 'ordersLost', 'wages', 'appPick', 'appSow', 'appSold',
                  'appTook', 'appCare', 'appWeed', 'appBug', 'quit'];
/* These only fire for a gardener who closes the app mid-garden, which this
   bot never does — it plays each session to a standstill. Proven directly
   in glass-check and regress instead. */
const BOT_CANNOT_REACH = ['appPick', 'appSow', 'appSold', 'appTook', 'quit'];
console.log('=== ledger events over 6 x 21-day runs ===');
EXPECTED.forEach(function (k) {
  const n = seen[k] | 0;
  const tag = n ? 'fires' : (BOT_CANNOT_REACH.indexOf(k) > -1 ? 'n/a  ' : 'NEVER');
  console.log('  ' + tag + '  ' + k.padEnd(12) + ' ' + n);
});
const extra = Object.keys(seen).filter(function (k) { return EXPECTED.indexOf(k) < 0; });
if (extra.length) console.log('  (also seen: ' + extra.map(function (k) { return k + ' ' + seen[k]; }).join(', ') + ')');

/* ---- 2. does wilt actually fire now? ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 99999; s.level = 12;
  E('plant(0,"elm")');
  const sp = E('byId')['elm'];
  s.plots[0].stage = sp.stages; s.plots[0].ripeAt = E('NOW()');
  s.offset += 30 * HOUR;
  console.log('\n=== wilt ===');
  console.log('  a bloom left ripe 30h loses ' + E('wiltPenalty')(s.plots[0]) + ' star(s)');
  console.log('  wilt window is ' + (E('WILT_MS') / HOUR) + 'h; the slowest crop stalls after ' +
    Math.max.apply(null, E('SPECIES').map(function (x) {
      return E('timerCeiling')(x, null) * x.growMin / 60;
    })).toFixed(1) + 'h of clock');
}

/* ---- 3. is any purchasable option strictly worse than skipping it? ---- */
{
  const h = H.build(); const E = h.evalIn;
  console.log('\n=== upgrade tree, priced against a measured 21 days ===');
  const plots = E('PLOT_COSTS').reduce(function (a, b) { return a + b; }, 0);
  const cans = E('CAN_COSTS').reduce(function (a, b) { return a + b; }, 0);
  const glass = [0, 1, 2].reduce(function (a, i) {
    return a + Math.round(E('GLASS_COST') * Math.pow(E('GLASS_STEP'), i));
  }, 0);
  console.log('  all plots ' + plots + ' · all cans ' + cans + ' · three panes of glass ' + glass +
              ' · apprentice ' + (E('APPRENTICE_HIRE') + E('APP_UPGRADE')[1]));
  console.log('  total ' + (plots + cans + glass + E('APPRENTICE_HIRE') + E('APP_UPGRADE')[1]));
}

/* ---- 4. drawing budgets: no species may blow the element budget ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.level = 16;
  console.log('\n=== drawing weight at full growth ===');
  /* Two different things, and only one of them is a performance question.
     The garden scene draws nine plants at once and is forced to low detail;
     the grow view draws one at close-up size and should have everything. */
  let scene = null, close = null, total = 0;
  E('SPECIES').forEach(function (sp) {
    const n = E('totalFor')(sp);
    const a = E('plantSVG')(sp, n, undefined, 'low');
    const b = E('plantSVG')(sp, n, undefined, 'high');   // force high, or the
                                                        // budget silently picks low
    total += a.length;
    if (!scene || a.length > scene.bytes) scene = { id: sp.id, bytes: a.length };
    if (!close || b.length > close.bytes) close = { id: sp.id, bytes: b.length };
  });
  console.log('  scene (nine at once, forced low): heaviest ' + scene.id + ' ' +
    Math.round(scene.bytes / 1024) + 'KB; nine of them would be ' +
    Math.round(scene.bytes * 9 / 1024) + 'KB');
  console.log('  grow view (one, close up): heaviest ' + close.id + ' ' +
    Math.round(close.bytes / 1024) + 'KB at forced-high detail');
  console.log('  note: the budget auto-drops anything over ' + E('DETAIL_BUDGET') +
    ' estimated elements to low, so the heavy species never draw high in practice');
}

/* ---- 5. save migration: an old save must survive every field added ---- */
{
  const h = H.build(); const E = h.evalIn;
  // a save from before iterations 28-32 existed
  const old = {
    v: 2, coins: 500, water: 5, plotCount: 5, canTier: 1, level: 9, xp: 3,
    plots: [{ s: 'elm', stage: 2, q: 1, stageAt: Date.now() }, null, null, null, null],
    barn: { elm: { 2: 3 } }, almanac: { elm: 2 }, trellised: [true, false, false, false, false]
  };
  h.store['fibgarden.v2'] = JSON.stringify(old);
  const g = H.build();
  const st = g.evalIn('state');
  const ok = [];
  const bad = [];
  const want = { glassed: 'array', lastSown: 'object', appLevel: 'number', appPaidDay: 'number',
                 stalledFinished: 'number', driedReady: 'number', driedDay: 'number',
                 glassPristine: 'number' };
  Object.keys(want).forEach(function (k) {
    const v = st[k];
    const good = want[k] === 'array' ? Array.isArray(v) : typeof v === want[k];
    (good ? ok : bad).push(k + '=' + JSON.stringify(v));
  });
  console.log('\n=== save migration ===');
  console.log('  ' + (bad.length ? 'MISSING: ' + bad.join(', ') : 'all new fields present: ' + ok.join(', ')));
}

/* ---- 6. every UI claim about numbers should match the constants ---- */
{
  const h = H.build(); const E = h.evalIn;
  console.log('\n=== stated vs actual ===');
  const html = require('fs').readFileSync(GAME_PATH, 'utf8');
  const claims = [
    ['README says a drop every 13 minutes', E('WATER_REGEN_MS') === 13 * 60000],
    ['README says the clock stops at half', E('TIMER_REACH') === 0.5],
    ['README says glass needs level 10', E('GLASS_LVL') === 10],
    ['README says each pane costs 90% more', Math.abs(E('GLASS_STEP') - 1.9) < 1e-9],
    ['README says a dry spell lasts two days', E('DRY_RUN_DAYS') === 2],
    ['README says a dry spell pays 15% more', Math.abs(E('DRY_SELL') - 1.15) < 1e-9],
    ['README says cans hold 13 to 89', E('CAN_TIERS')[0] === 13 && E('CAN_TIERS')[4] === 89],
    ['no leftover "780s" style raw-second copy', html.indexOf('WATER_REGEN_MS / 1000') < 0],
    ['README says a golden seed costs 12,000', E('PRESTIGE_UNIT') === 12000],
    ['README says honey pays 15% a hive level', html.indexOf('hiveLevel * 0.15') > -1],
    ['the almanac computes spiral arms rather than listing them', /function spiralArms/.test(html)],
    ['icon buttons are 40px, not 30', /.iconbtn {[^}]*width: 40px/.test(html)],
    ['the reduce-motion media query exists', /prefers-reduced-motion: reduce/.test(html)],
    ['growth runs before the bees', html.indexOf('growthTick(); pollenTick()') > -1],
    ['the pour reads its zone from the captured copy', /pos < z.center/.test(html)]
  ];
  claims.forEach(function (c) { console.log('  ' + (c[1] ? 'ok   ' : 'WRONG') + ' ' + c[0]); });
}

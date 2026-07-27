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
    /* Tests the order, not whether the two calls sit next to each other. The
       adjacency version went stale the moment the apprentice was moved
       between them in iteration 58, and printed WRONG for four iterations
       without failing anything, because this file only ever printed. */
    ['growth runs before the bees', (function () {
      const cu = html.slice(html.indexOf('function catchUpWithLedger'),
                            html.indexOf('function showWelcomeBack'));
      return cu.indexOf('growthTick()') > -1 &&
             cu.indexOf('pollenTick()') > cu.indexOf('growthTick()');
    })()],
    ['the pour reads its zone from the captured copy', html.indexOf('pos < z.center') > -1],
    ['the season boost is trimmed to at most +22%',
      Math.max.apply(null, E('SEASONS').map(function (s) {
        return Math.max.apply(null, Object.keys(s.boost).map(function (k) { return s.boost[k]; }));
      })) <= 1.22],
    ['the market judges the day as a whole', E('priceStanding').length === 0],
    ['the ledger records the day price mood', html.indexOf('mult: dayPriceMult()') > -1],
    ['a Daily budget is a whole number of plants',
      (function () {
        for (let d = 0; d < 60; d++) {
          const sp2 = E('dailySpec')(E('dayIndex()') + d);
          if (sp2.drops % sp2.sp.stages !== 0) return false;
        }
        return true;
      })()],
    ['the Daily par is a fraction of a flawless run', html.indexOf('DAILY_PAR_FRACTION') > -1],
    ['the breeding bench shows which rungs you hold', html.indexOf('function ladderStrip') > -1],
    ['the bench says whether a cross lands on a rung', html.indexOf('function onLadder') > -1],
    ['the wheel does not beat selling',
      E('WHEEL').reduce(function (a, w) { return a + w.m; }, 0) / E('WHEEL').length <= 1.0],
    ['a level costs one Fibonacci step every two', html.indexOf('XP_STEP') > -1],
    ['rich soil extends the clock rather than hurrying it',
      html.indexOf("hasPerk('richsoil') ? 1 : 0") > -1],
    ['deep well scales with the can', html.indexOf("hasPerk('deepwell') ? 1.25 : 1") > -1],
    ['a ripe bloom wilts in hours, not a day', E('WILT_MS') <= 8 * 3600000],
    ['the wilt warning arrives before the damage', html.indexOf('wiltSoon') > -1],
    ['the apprentice picks before the storms fall',
      html.indexOf('growthTick(); appWages(); appTick();') > -1],
    ['fever no longer widens the gold zone', html.indexOf('feverActive() ? 1.5 : 1') < 0],
    ['fever is a combo of 13 for 34 seconds',
      E('FEVER_COMBO') === 13 && E('FEVER_MS') === 34000],
    ['a long absence is described in days, weeks or years',
      /year/.test(E('fmtLong')(3650 * DAY))],
    ['the garden name is capped where it is read', html.indexOf('GARDEN_NAME_MAX') > -1],

    /* ---- iterations 59-62 ---- */
    ['anything slower on the shelf is richer', (function () {
      const eco = E('SPECIES').map(function (sp) {
        const ceil = E('timerCeiling')(sp, null);
        return { lvl: sp.lvl, id: sp.id,
                 hours: ceil * sp.growMin / (sp.pref === 'any' ? 1 : 1.25) / 60,
                 per: (sp.price * E('STAR_MULT')[2] - sp.seed) / sp.stages };
      });
      return eco.every(function (e) {
        return !eco.some(function (o) {
          return o.id !== e.id && o.lvl <= e.lvl &&
                 o.hours < e.hours - 1e-9 && o.per >= e.per - 1e-9;
        });
      });
    })()],
    ['a plant is drawn the same way at every stage of its life',
      html.indexOf('estimateElements(sp, totalFor(sp)) > DETAIL_BUDGET') > -1],
    ['a rosette fits inside its own frame', html.indexOf('82 / Math.sqrt(total)') > -1],
    ['the romanesco keeps a second level when detail is dropped',
      E('FRACTAL_INNER') === 21],
    ['a 44-pixel thumbnail draws thirteen elements, not two hundred',
      E('ICON_ELEMENTS') === 13],
    ['and the two forms that recurse know when they are drawn small',
      html.indexOf('iconDetail() ? 1') > -1 && html.indexOf('!iconDetail() && i < FRACTAL_INNER') > -1],
    ['the score re-times itself rather than waiting to be told',
      html.indexOf('if (beatMs() !== musicBeat) musicRetime();') > -1],
    ['the chord is as full as the garden is in bloom',
      html.indexOf('2 + Math.round(blooms / 2)') > -1],
    ['the settings screen says so', html.indexOf('your blooms fill the chord') > -1],

    /* ---- iterations 64-67 ---- */
    ['the tutorial waits for the player rather than a timer',
      E('STEPS').filter(function (s) { return s.await; }).length >= 4],
    ['and a hesitated pour locks itself rather than hanging',
      /auto: setTimeout\(function \(\) \{ lockPour\(\); \}, \d+\)/.test(html)],
    ['every achievement pays something',
      E('ACHIEVEMENTS').every(function (a) { return (a.coins | 0) > 0 || (a.golden | 0) > 0; })],
    ['and none is already true on a fresh save',
      !E('ACHIEVEMENTS').some(function (a) {
        try { return a.test(E('freshState')()); } catch (e) { return false; }
      })],
    ['every season announces every boost it gives', (function () {
      return E('SEASONS').every(function (s) {
        const said = (s.blurb.match(/\+(\d+)%/g) || []).map(function (t) {
          return 1 + parseInt(t, 10) / 100;
        });
        return Object.keys(s.boost).every(function (f) {
          return said.some(function (v) { return Math.abs(v - s.boost[f]) < 0.005; });
        });
      });
    })()],
    ['a bed the game cannot read is let go of rather than crashed on',
      html.indexOf('function forgetTheUnknown') > -1 &&
      html.indexOf('forgetTheUnknown();') > -1],
    ['and it runs after the crosses are rebuilt, not before',
      html.indexOf('registerHybrids();        // bred plants') <
      html.indexOf('forgetTheUnknown();       //')],
    ['ripeness is asked in one place, safely',
      html.indexOf('function isRipe(p)') > -1 &&
      html.indexOf('p && p.stage >= byId[p.s].stages') < 0],
    ['and stock the game cannot name is worth nothing, not NaN',
      E('tierPrice')(null, 1) === 0],

    /* ---- iterations 69-72 ---- */
    ['no journal objective asks you to neglect the garden',
      !E('CHAPTERS').some(function (c) {
        return c.objs.some(function (o) {
          return /weeds/i.test(o.t) && o.need > 1;
        });
      })],
    ['a bed can be planted and poured from the keyboard',
      html.indexOf("s.addEventListener('keydown'") > -1 &&
      html.indexOf("d.addEventListener('keydown'") > -1],
    ['and the shot can be taken with the space bar',
      /e\.key === ' ' \|\| e\.key === 'Enter'/.test(html) &&
      html.indexOf('doAct();') > -1],
    ['and Escape gets you out of a pour',
      /if \(pour\) \{ cancelPour\(\)/.test(html)],
    ['a replant keeps what you learned and takes what you bought',
      html.indexOf('almanac: state.almanac') > -1 &&
      html.indexOf('perks: state.perks') > -1 &&
      html.indexOf('state = freshState();') > -1],
    ['coins are shortened once they stop being readable',
      E('fmtCoins')(3711369) === '3.71M' && E('fmtCoins')(9999) === '9999'],
    ['and the top bar is what uses it',
      html.indexOf("$('coins').textContent = fmtCoins(state.coins)") > -1],
    ['a level past the last draft still pays something',
      html.indexOf('function offerLatePerk') > -1 && E('LATE_PERK_EVERY') === 3],
    ['and the streak does not build while fever is already running',
      html.indexOf('if (!feverActive()) state.combo++;') > -1],
    ['late money still has somewhere to go',
      /hiveLevel/.test(html) && !/hiveLevel >= \d+/.test(html)],

    /* ---- iterations 74-77 ---- */
    ['the daily gift does not hand out the permanent bonus',
      E('GIFTS').every(function (x) { return !(x.golden | 0); })],
    ['and its seventh day is still worth coming back for',
      !!E('GIFTS')[E('GIFTS').length - 1].fillCan],
    ['and it cannot be claimed twice in a day',
      html.indexOf('if (state.lastGiftDay === today) return;') > -1],
    ['a ladybird cannot be farmed by hoarding the barn',
      html.indexOf('Math.max(60, Math.round(best * 3))') > -1],
    ['and its water never comes to nothing on a full can',
      html.indexOf('const spare = 5 - drops;') > -1],
    ['compost still earns no care, as the shop says',
      html.indexOf('no care point') > -1 &&
      html.indexOf("if (via === 'water') {") > -1],
    ['the Daily can set any wild species, not just the first half',
      (function () {
        const seen = {};
        for (let d = 0; d < 365; d++) seen[E('dailySpec')(E('dayIndex()') + d).sp.id] = 1;
        return Object.keys(seen).length === E('BASE_SPECIES').length;
      })()],
    ['every shared roll takes the calendar and nothing off the save',
      html.indexOf('function dailySpec(day)') > -1 &&
      html.indexOf('const pool = BASE_SPECIES;') > -1],
    ['coins over ten thousand are shortened wherever they are shown',
      html.indexOf('fmtCoins(state.coins)') > -1 &&
      html.indexOf('fmtCoins(value)') > -1]
  ];
  let wrong = 0;
  claims.forEach(function (c) {
    if (!c[1]) wrong++;
    console.log('  ' + (c[1] ? 'ok   ' : 'WRONG') + ' ' + c[0]);
  });
  /* This file used to only print. A claim that went stale — the bees one did,
     for four iterations — sat in the output saying the game was wrong, and
     nothing anywhere cared. An audit that cries wolf is worse than none, so
     it reports a verdict the runner reads like every other file. */
  console.log('\nPASS ' + (claims.length - wrong) + ' / FAIL ' + wrong);
  if (wrong) {
    claims.filter(function (c) { return !c[1]; })
          .forEach(function (c) { console.log('  FAIL ' + c[0]); });
  }
}

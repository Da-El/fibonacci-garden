const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Iteration 34: the first five minutes. The tutorial had been telling new
   players "you could simply walk away" long after the clock stopped
   finishing plants. Two things to prove: a fresh save can actually reach a
   first harvest and a first sale, and nothing the tutorial or the hints
   claim contradicts the constants. */
const H = require('./harness.js');
const HOUR = 3600000, MIN = 60000;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* ---- a brand-new gardener, playing only what the tutorial teaches ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  const startCoins = s.coins, startWater = s.water;
  check('a fresh save starts with coins and water', startCoins > 0 && startWater > 0,
        startCoins + '🪙, ' + startWater + ' drops');
  check('the first seed is affordable', E('cheapestSeedNow()') <= startCoins,
        'cheapest ' + E('cheapestSeedNow()') + ' vs ' + startCoins);

  E('plant(0,"elm")');
  const sp = E('byId')['elm'];
  check('a first seed can be sown', !!s.plots[0]);

  // wait for the clock to do its half, exactly as the tutorial describes
  s.offset += 4 * HOUR;
  E('growthTick()');
  const ceil = E('timerCeiling')(sp, s.plots[0]);
  check('the clock stops halfway, as the tutorial now says',
        s.plots[0].stage === ceil && ceil < sp.stages,
        'stage ' + s.plots[0].stage + ' of ' + sp.stages);
  check('and it says so on the plant', E('isThirsty')(s.plots[0]));

  // finish it with the starting can
  E('curPlot = 0');
  const need = sp.stages - s.plots[0].stage;
  check('the starting can holds enough to finish a first plant',
        E('waterCap()') >= need, 'can ' + E('waterCap()') + ', needs ' + need);
  let poured = 0;
  while (s.plots[0] && s.plots[0].stage < sp.stages && s.water > 0) {
    E('advanceStage("water", true)'); poured++;
  }
  check('a first plant can be finished on the opening can', s.plots[0].stage >= sp.stages,
        'poured ' + poured);

  const before = s.coins;
  E('harvest()');
  check('a first harvest reaches the barn', E('barnCountAll()') > 0);
  E('sellAll()');
  check('a first sale makes money', s.coins > before, before + ' -> ' + s.coins);
  check('and leaves enough to sow again', s.coins >= E('cheapestSeedNow()'),
        s.coins + '🪙 vs ' + E('cheapestSeedNow()'));
}

/* ---- how long does the opening actually take? ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  const sp = E('byId')['elm'];
  const ceilH = E('timerCeiling')(sp, null) * sp.growMin / 60;
  console.log('  first elm: ' + E('timerCeiling')(sp, null) + ' stages on the clock (' +
    (ceilH * 60).toFixed(0) + ' min), then ' + (sp.stages - E('timerCeiling')(sp, null)) +
    ' pours from a can of ' + E('waterCap()'));
  check('the opening wait is minutes, not hours', ceilH < 1, ceilH.toFixed(2) + 'h');
}

/* ---- every claim the tutorial and hints make must match the code ---- */
{
  const h = H.build(); const E = h.evalIn;
  const html = require('fs').readFileSync(GAME_PATH, 'utf8');
  const steps = html.slice(html.indexOf('const STEPS = ['), html.indexOf('let coachIdx'));
  const hints = html.slice(html.indexOf('const HINTS = {'), html.indexOf('function hint(key)'));
  const copy = steps + hints;

  check('the tutorial no longer says you can walk away',
        copy.indexOf('simply walk away') < 0);
  check('it states the 13-minute drop that the code uses',
        copy.indexOf('13 minutes') > -1 && E('WATER_REGEN_MS') === 13 * 60000);
  check('it states the half-grown ceiling that the code uses',
        copy.indexOf('half grown') > -1 && E('TIMER_REACH') === 0.5);
  check('the dry-spell copy matches the constants',
        copy.indexOf('twice as long') > -1 && E('DRY_REGEN') === 2 &&
        copy.indexOf('two days') > -1 && E('DRY_RUN_DAYS') === 2 &&
        copy.indexOf('15%') > -1 && Math.abs(E('DRY_SELL') - 1.15) < 1e-9);
  check('the apprentice hint no longer claims she waters',
        !/apprentice[\s\S]{0,400}?watering/.test(hints));
  check('every hint the code fires is defined',
        (function () {
          const fired = new Set();
          const re = /hint\('([a-z]+)'\)/g; let m;
          while ((m = re.exec(html))) fired.add(m[1]);
          const missing = Array.from(fired).filter(function (k) {
            return hints.indexOf(k + ':') < 0 && hints.indexOf(k + ' :') < 0;
          });
          return !missing.length || (bugs.push('undefined hints: ' + missing.join(',')) && false);
        })());
  check('every hint defined is actually fired somewhere',
        (function () {
          const defined = [];
          const re = /^\s{2}([a-z]+):\s*\{ ic:/gm; let m;
          while ((m = re.exec(hints))) defined.push(m[1]);
          const dead = defined.filter(function (k) { return html.indexOf("hint('" + k + "')") < 0; });
          return !dead.length || (bugs.push('never-fired hints: ' + dead.join(',')) && false);
        })());
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

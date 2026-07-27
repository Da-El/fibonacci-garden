/* Iteration 46: the Daily is generated from the date, so every player gets
   the same one — which means a bad seed is a bad day for everybody, and
   nobody would ever know. Walk a year of dates and check each one is
   winnable, worth winning, and not trivial. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn; const s = E('state');
s.offset = 0;

/* The best a perfect player can do: spend every drop on a perfect pour,
   sowing a fresh plant whenever one ripens, and harvest at the end. */
function bestPossible(spec) {
  const sp = spec.sp;
  const perPlant = sp.stages;                 // the Daily has no clock at all
  const plants = Math.floor(spec.drops / perPlant);
  const leftover = spec.drops - plants * perPlant;
  // every stage perfect gives full care, so ★★★
  const each = Math.round(sp.price * E('STAR_MULT')[3]);
  return { plants: plants, score: plants * each, leftover: leftover, each: each };
}

/* And what an ordinary player manages: most pours land, some spill. */
function typical(spec, accuracy) {
  const sp = spec.sp;
  const effective = spec.drops * accuracy;    // spilled drops advance nothing
  const plants = Math.floor(effective / sp.stages);
  // care comes only from the pours that landed, so quality is proportional
  const care = sp.stages * accuracy;
  const stars = care >= Math.ceil(sp.stages * 2 / 3) ? 3
              : care >= Math.ceil(sp.stages / 3) ? 2 : 1;
  return { plants: plants, score: Math.round(plants * sp.price * E('STAR_MULT')[stars]), stars: stars };
}

/* ---- a year of dates ---- */
{
  const today = E('dayIndex()');
  const rows = [];
  for (let d = 0; d < 365; d++) {
    const spec = E('dailySpec')(today + d);
    const best = bestPossible(spec);
    rows.push({ day: d, spec: spec, best: best,
                ratio: best.score / spec.par,
                mid: typical(spec, 0.7).score / spec.par });
  }

  const unwinnable = rows.filter(function (r) { return r.ratio < 1.05; });
  check('every day in a year can be beaten by perfect play', !unwinnable.length,
        unwinnable.slice(0, 4).map(function (r) {
          return 'd+' + r.day + ' ' + r.spec.sp.id + ' best ' + r.best.score + ' vs par ' + r.spec.par;
        }).join('; '));

  const trivial = rows.filter(function (r) { return r.mid > 1.8; });
  check('no day is a walkover for a mediocre run', !trivial.length,
        trivial.slice(0, 4).map(function (r) {
          return 'd+' + r.day + ' ' + r.spec.sp.id + ' x' + r.mid.toFixed(2);
        }).join('; '));

  const ratios = rows.map(function (r) { return r.ratio; });
  const lo = Math.min.apply(null, ratios), hi = Math.max.apply(null, ratios);
  console.log('  perfect play beats par by x' + lo.toFixed(2) + ' .. x' + hi.toFixed(2) +
              ' (mean x' + (ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length).toFixed(2) + ')');
  check('the margin for perfect play is consistent across the year',
        hi / lo <= 2.2, 'x' + lo.toFixed(2) + '..x' + hi.toFixed(2));

  // the drop budget must always be enough for at least one whole plant
  const starved = rows.filter(function (r) { return r.spec.drops < r.spec.sp.stages; });
  check('every day gives enough drops to finish at least one plant', !starved.length,
        starved.slice(0, 4).map(function (r) {
          return r.spec.sp.id + ' needs ' + r.spec.sp.stages + ' has ' + r.spec.drops;
        }).join('; '));

  // and the leftover should be small, or the budget is sloppy
  const waste = rows.map(function (r) { return r.best.leftover / r.spec.drops; });
  const avgWaste = waste.reduce(function (a, b) { return a + b; }, 0) / waste.length;
  console.log('  drops that cannot be used: ' + Math.round(avgWaste * 100) + '% on average');
  check('the drop budget is not mostly unusable', avgWaste <= 0.30,
        Math.round(avgWaste * 100) + '%');

  // variety: a year of the same species would be dull
  const species = {};
  rows.forEach(function (r) { species[r.spec.sp.id] = (species[r.spec.sp.id] || 0) + 1; });
  const kinds = Object.keys(species).length;
  console.log('  species used across the year: ' + kinds + ' — ' +
    Object.keys(species).sort(function (a, b) { return species[b] - species[a]; })
      .slice(0, 5).map(function (k) { return k + ' ' + species[k]; }).join(', '));
  check('the year uses a real spread of species', kinds >= 6, kinds + ' kinds');
  const commonest = Math.max.apply(null, Object.keys(species).map(function (k) { return species[k]; }));
  check('no single species dominates the year', commonest / 365 <= 0.25,
        Math.round(commonest / 365 * 100) + '%');
}

/* ---- the Daily must ask for the same skill the garden does ---- */
{
  const spec = E('dailySpec')(E('dayIndex()'));
  const d = E('dailyState()');
  d.plots[0] = { stage: 0, q: 0 };
  E('dailyStartPour')(spec, d, 0);
  const dp = E('dailyPour');
  const gardenMs = E('pourZonesFor')(0, spec.sp).gw * (E('pourPeriodFor')(spec.sp) / 2);
  const dailyMs = dp.gw * (dp.period / 2);
  check('the Daily asks for the same timing as the garden',
        Math.abs(dailyMs - gardenMs) < 2,
        'daily ' + dailyMs.toFixed(0) + 'ms vs garden ' + gardenMs.toFixed(0) + 'ms');
}

/* ---- it must stay a sandbox: no coins, no XP, no garden effects ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0; st.coins = 500; st.level = 8;
  const before = { coins: st.coins, xp: st.xp, harvested: st.harvested, water: st.water };
  const spec = G('dailySpec')(G('dayIndex()'));
  const d = G('dailyState()');
  for (let i = 0; i < d.plots.length; i++) d.plots[i] = { stage: spec.sp.stages, q: 99 };
  for (let i = 0; i < d.plots.length; i++) { try { G('dailyHarvest')(spec, d, i); } catch (e) {} }
  check('the Daily never touches your coins', st.coins === before.coins,
        before.coins + ' -> ' + st.coins);
  check('the Daily never touches your water', st.water === before.water);
  check('the Daily never counts toward your garden', st.harvested === before.harvested);
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

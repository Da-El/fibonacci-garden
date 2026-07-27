/* Iteration 76: this game has a world, and the world is supposed to be the
   same for everybody.

   The weather, the season, what seeds cost today, what blooms fetch today,
   whether a dry spell is coming, and which garden the Daily sets — all of it
   is derived by hashing the day rather than by rolling dice, so that two
   people opening the app on the same afternoon see the same sky and can
   talk about it. Nothing has ever checked that they do.

   The other half of the claim matters more: nothing a player does may shift
   it. A hash that quietly takes anything off the save is a world that bends
   to whoever is looking at it. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* Everything a player can see about the world, read at one instant. */
function worldReading(E) {
  return {
    day: E('dayIndex()'),
    season: E('seasonNow')().id,
    weather: E('weatherNow')().id,
    forecast: [1, 2, 3].map(function (k) {
      return E('weatherAt')(E('weatherSlot()') + k).id;
    }).join(','),
    dryNow: !!E('dryNow()'),
    dryIn: E('dryDaysAway()'),
    /* The wild shelf only. A player who has bred a cross has a species
       nobody else has, and its price is theirs — comparing the whole of
       SPECIES compares list lengths rather than the world. */
    seedPrices: E('BASE_SPECIES').map(function (sp) { return E('seedCostOf')(sp); }).join(','),
    priceMults: E('BASE_SPECIES').map(function (sp) {
      return E('priceMult')(sp).toFixed(4);
    }).join(','),
    daily: (function () {
      const d = E('dailySpec')(E('dayIndex()'));
      return d ? d.sp.id + '/' + d.drops + '/' + d.plots + '/' + d.par : 'none';
    })()
  };
}

function gardener(setup) {
  const h = H.build();
  const E = h.evalIn; const s = E('state');
  s.offset = 0;
  if (setup) setup(E, s, h);
  return { h: h, E: E, s: s };
}

/* ---- two fresh gardens must see the same world ---- */
{
  const a = gardener(), b = gardener();
  const wa = worldReading(a.E), wb = worldReading(b.E);
  console.log('  day ' + wa.day + ': ' + wa.season + ', ' + wa.weather +
    ', forecast ' + wa.forecast + (wa.dryNow ? ', dry spell on' : ', dry in ' + wa.dryIn + 'd'));
  console.log('  today\'s Daily: ' + wa.daily);
  const differ = Object.keys(wa).filter(function (k) { return wa[k] !== wb[k]; });
  check('two gardens opened at the same moment see the same world',
        !differ.length, differ.join(', '));
}

/* ---- and a played garden must see the same one as an untouched garden ---- */
{
  const quiet = gardener();
  const busy = gardener(function (E, s) {
    /* A very different player: rich, high level, nine beds, a full barn, an
       apprentice, a hive, crosses bred, hundreds of harvests and pours. */
    s.coins = 250000; s.level = 18; s.plotCount = 9; s.canTier = 4;
    s.harvested = 900; s.pourN = 4321; s.orderN = 77; s.golden = 9;
    s.prestiges = 4; s.bestCombo = 34; s.compost = 40;
    while (s.plots.length < 9) s.plots.push(null);
    while (s.trellised.length < 9) s.trellised.push(true);
    while (s.glassed.length < 9) s.glassed.push(true);
    E('SPECIES').forEach(function (sp) {
      s.almanac[sp.id] = 3; s.discovered[sp.id] = true;
      s.barn[sp.id] = { 3: 40 };
    });
    s.perks = { greenthumb: true, deepwell: true, richsoil: true };
    s.hiveLevel = 6; s.appLevel = 2;
    const hy = E('makeHybrid')('elm', 'beech');
    if (hy) { s.hybrids = {}; s.hybrids[hy.id] = { a: 'elm', b: 'beech' }; E('registerHybrids()'); }
    for (let i = 0; i < 9; i++) E('plant(' + i + ',"elm")');
    E('catchUpWithLedger()');
  });

  const wq = worldReading(quiet.E), wb = worldReading(busy.E);
  const differ = Object.keys(wq).filter(function (k) { return wq[k] !== wb[k]; });
  console.log('\n  a rich, high-level, nine-bed garden against an untouched one:');
  differ.forEach(function (k) {
    console.log('    ' + k + ': "' + wq[k] + '" vs "' + wb[k] + '"');
  });
  /* Sale prices legitimately differ — a perk, a golden seed and the season
     all move what YOU get, and that is your garden rather than the world.
     What must not differ is the roll underneath it. */
  const SHARED = ['day', 'season', 'weather', 'forecast', 'dryNow', 'dryIn',
                  'seedPrices', 'priceMults', 'daily'];
  const bent = SHARED.filter(function (k) { return wq[k] !== wb[k]; });
  check('nothing a player has done bends the shared world',
        !bent.length, bent.map(function (k) {
          return k + ': ' + wq[k] + ' vs ' + wb[k];
        }).join(' | '));
}

/* ---- and it must be the same tomorrow for both of them ---- */
{
  const a = gardener(), b = gardener();
  const DAY = 24 * 3600000;
  const trailA = [], trailB = [];
  for (let d = 0; d < 30; d++) {
    trailA.push(worldReading(a.E).weather + worldReading(a.E).season[0]);
    trailB.push(worldReading(b.E).weather + worldReading(b.E).season[0]);
    a.s.offset += DAY;
    /* The busy one plays every day; the quiet one does nothing at all. */
    b.s.offset += DAY;
    b.E('catchUpWithLedger()');
  }
  const same = trailA.join('|') === trailB.join('|');
  console.log('\n  thirty days apart, one playing and one not: ' +
              (same ? 'identical skies' : 'they diverged'));
  check('a month of playing does not change the weather anyone else gets', same,
        trailA.slice(0, 6).join(',') + ' vs ' + trailB.slice(0, 6).join(','));
}

/* ---- the world must actually vary, or "shared" means nothing ---- */
{
  const g = gardener();
  const DAY = 24 * 3600000;
  const seen = { weather: {}, season: {}, daily: {} };
  for (let d = 0; d < 60; d++) {
    const w = worldReading(g.E);
    seen.weather[w.weather] = 1;
    seen.season[w.season] = 1;
    seen.daily[w.daily] = 1;
    g.s.offset += DAY;
  }
  console.log('  over sixty days: ' + Object.keys(seen.weather).length + ' kinds of weather, ' +
    Object.keys(seen.season).length + ' seasons, ' + Object.keys(seen.daily).length + ' Dailies');
  check('the weather really changes', Object.keys(seen.weather).length >= 4,
        Object.keys(seen.weather).join(','));
  check('and all four seasons come round', Object.keys(seen.season).length === 4,
        Object.keys(seen.season).join(','));
  /* Nine species times three plant counts times two bed counts was fifty-
     four possible gardens in total, and the pool stopped at level 8 — so oak,
     aloe, vine, fern, romanesco and pineapple could never appear at all. The
     Daily hands you the beds and counts out the drops, so nothing in it needs
     unlocking; the cap only meant the mode showed a game nobody was still
     playing. The whole shelf now, and ninety gardens. */
  check('the Daily is a different garden most days',
        Object.keys(seen.daily).length >= 35, Object.keys(seen.daily).length + ' of 60');
  const dailySpecies = {};
  for (let d = 0; d < 365; d++) dailySpecies[g.E('dailySpec')(g.E('dayIndex()') + d).sp.id] = 1;
  check('and over a year every wild species turns up in one',
        Object.keys(dailySpecies).length === g.E('BASE_SPECIES').length,
        Object.keys(dailySpecies).length + ' of ' + g.E('BASE_SPECIES').length);
}

/* ---- the same day is the same world, whichever hour you open it ---- */
{
  /* The day index is what everything hangs off, so the season, the seed
     prices and the Daily must not shift when the clock crosses an hour. */
  const readings = [];
  for (let hour = 0; hour < 24; hour += 3) {
    const g = gardener(function (E, s) { s.offset += hour * 3600000; });
    const w = worldReading(g.E);
    readings.push({ hour: hour, day: w.day, season: w.season,
                    seeds: w.seedPrices, daily: w.daily });
  }
  /* Only within one calendar day: crossing midnight is meant to change it. */
  const sameDay = readings.filter(function (r) { return r.day === readings[0].day; });
  const shifted = sameDay.filter(function (r) {
    return r.season !== sameDay[0].season || r.seeds !== sameDay[0].seeds ||
           r.daily !== sameDay[0].daily;
  });
  console.log('\n  checked ' + sameDay.length + ' hours inside one day');
  check('the season, the seed prices and the Daily hold all day',
        !shifted.length, shifted.map(function (r) { return r.hour + 'h'; }).join(', '));
  /* But the weather must move within a day, or the forecast is pointless. */
  const skies = {};
  for (let hour = 0; hour < 24; hour += 1) {
    const g = gardener(function (E, s) { s.offset += hour * 3600000; });
    skies[worldReading(g.E).weather] = 1;
  }
  check('and the weather still moves through the day',
        Object.keys(skies).length >= 2, Object.keys(skies).join(','));
}

/* ---- nothing shared may be seeded from the save ---- */
{
  /* The structural version of the same claim: read the source and check that
     the hashes behind the shared world take the day or the slot and nothing
     else. A hash that quietly reaches for state is a world that bends. */
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const SHARED_FNS = ['priceMult', 'seedMult', 'weatherAt', 'dailySpec', 'seasonNow'];
  const leaky = [];
  SHARED_FNS.forEach(function (fn) {
    const i = html.indexOf('function ' + fn);
    if (i < 0) { leaky.push(fn + ' is missing'); return; }
    /* Some of these are one-liners, so looking for the next "\n}" walks
       straight past the end and swallows whatever comes next — which is how
       seasonNow was first reported as reading state.feverUntil. Take the
       body by counting braces from the opening one. */
    let depth = 0, end = i;
    for (let k = html.indexOf('{', i); k < html.length; k++) {
      if (html[k] === '{') depth++;
      else if (html[k] === '}') { depth--; if (!depth) { end = k; break; } }
    }
    const body = html.slice(i, end);
    /* state.golden or state.level here would make your sky depend on your save. */
    const m = body.match(/state\.[a-zA-Z]+/g);
    if (m) leaky.push(fn + ' reads ' + Array.from(new Set(m)).join(','));
  });
  console.log('  shared-world functions reading the save: ' + (leaky.join(' | ') || 'none'));
  check('every shared roll is seeded from the calendar and nothing else',
        !leaky.length, leaky.join(' | '));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

/* Iteration 65: twenty-two achievements and not one has ever been audited.

   Every one of them is a function reading a field on the save. If nothing
   ever writes that field the achievement cannot fire, and it sits in the list
   as a promise the game has no way to keep — the exact shape of the dead
   wilt penalty, the dead orders, and the bees that never flew. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const ACH = E('ACHIEVEMENTS');
const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* ---- the list has to be well formed ---- */
{
  const ids = ACH.map(function (a) { return a.id; });
  const dupes = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
  console.log('  ' + ACH.length + ' achievements: ' +
    ACH.filter(function (a) { return a.coins; }).length + ' pay coins, ' +
    ACH.filter(function (a) { return a.golden; }).length + ' pay a golden seed');
  check('every achievement has its own id', !dupes.length, dupes.join(', '));
  check('every one is named', ACH.every(function (a) { return !!a.name; }));
  check('and every one pays something',
        ACH.every(function (a) { return (a.coins | 0) > 0 || (a.golden | 0) > 0; }),
        ACH.filter(function (a) { return !a.coins && !a.golden; })
           .map(function (a) { return a.id; }).join(', '));
  check('and every one has a test that is a function',
        ACH.every(function (a) { return typeof a.test === 'function'; }));
}

/* ---- every field an achievement waits on must be one the game writes ---- */
{
  /* Read the counter out of each test's own source, then look for somewhere
     in the game that increases it. A field only ever read is a condition that
     can never come true. */
  const unwritten = [];
  const fields = {};
  ACH.forEach(function (a) {
    const src = a.test.toString();
    const names = (src.match(/s\.([A-Za-z_][A-Za-z0-9_]*)/g) || [])
      .map(function (m) { return m.slice(2); });
    fields[a.id] = names;
    names.forEach(function (f) {
      /* Somewhere other than inside this list, the game has to assign it,
         push to it, or step it. */
      const written = new RegExp('state\\.' + f +
        '\\s*(=|\\+\\+|\\+=|\\[|\\.push)|' + f + ':\\s').test(html);
      if (!written && unwritten.indexOf(a.id + '.' + f) < 0) {
        unwritten.push(a.id + '.' + f);
      }
    });
  });
  console.log('  fields they wait on: ' +
    Object.keys(fields).map(function (k) { return fields[k].join('/'); })
      .filter(function (v, i, arr) { return v && arr.indexOf(v) === i; }).join(', '));
  check('every counter an achievement waits on is one the game writes',
        !unwritten.length, unwritten.join(', '));
}

/* ---- none may already be true on a brand-new save ---- */
{
  const g = H.build(); const G = g.evalIn;
  const fresh = G('freshState')();
  const free = ACH.filter(function (a) {
    try { return a.test(fresh); } catch (e) { return false; }
  });
  check('none is already earned before you have played',
        !free.length, free.map(function (a) { return a.id; }).join(', '));
  /* And loading that save must not hand out a windfall. */
  const before = G('state').coins;
  G('checkAch()');
  check('and loading a new save pays nothing out',
        G('state').coins === before, before + ' -> ' + G('state').coins);
}

/* ---- each has to be reachable: build the state it asks for ---- */
{
  const reachable = [], stuck = [];
  ACH.forEach(function (outer) {
    const g = H.build(); const G = g.evalIn; const s = G('state');
    /* The test has to come from THIS harness. Taking it from another one
       closes over that harness's byId, so a hybrid registered here is
       invisible to it and the ladder award can never be satisfied. */
    const a = G('ACHIEVEMENTS').filter(function (x) { return x.id === outer.id; })[0];
    s.offset = 0;
    /* A gardener who has done everything the game offers. */
    s.harvested = 100; s.ordersDelivered = 25; s.goldenHarvests = 5;
    s.pristineHarvests = 3; s.prestiges = 2; s.bestCombo = 21;
    s.wheelBest = 3; s.level = 18; s.plotCount = G('MAX_PLOTS');
    s.canTier = G('CAN_TIERS').length - 1;
    s.glassed = [true, true, true, false, false, false, false, false, false];
    s.almanacRewarded = true; s.dailyWins = 10; s.dailyStreak = 10;
    s.bred = 6; s.hybridsBred = 6;
    G('SPECIES').forEach(function (sp) { s.almanac[sp.id] = 3; });
    /* The ladder award reads state.hybrids and looks each id up in byId, so
       a real cross has to exist and be registered, not a flag invented by
       the test. */
    const hy = G('makeHybrid')('elm', 'beech');   // 1/2 + 1/3 = 2/5, both Fibonacci
    if (hy) { G('byId')[hy.id] = hy; s.hybrids = {}; s.hybrids[hy.id] = true; }
    let got = false;
    try { got = !!a.test(s); } catch (e) { got = false; }
    (got ? reachable : stuck).push(a.id);
  });
  if (stuck.length) console.log('  cannot be reached even by a maxed save: ' + stuck.join(', '));
  check('every achievement is reachable by a gardener who did everything',
        !stuck.length, stuck.join(', '));
}

/* ---- and what a real three weeks actually earns ---- */
{
  const rows = [];
  ['casual', 'twice', 'diligent'].forEach(function (profile) {
    const r = S.run({ seed: 4242, profile: profile, realPour: true, tapError: 30 });
    rows.push({ profile: profile, ach: r.ach || {}, earned: r.earned });
  });
  const everGot = {};
  rows.forEach(function (r) {
    Object.keys(r.ach).forEach(function (k) { if (r.ach[k]) everGot[k] = true; });
  });
  console.log('\n  after three weeks of real play:');
  rows.forEach(function (r) {
    const n = Object.keys(r.ach).filter(function (k) { return r.ach[k]; }).length;
    console.log('    ' + r.profile.padEnd(9) + n + ' of ' + ACH.length + ' earned');
  });
  const never = ACH.filter(function (a) { return !everGot[a.id]; })
                   .map(function (a) { return a.id; });
  console.log('  earned by nobody in three weeks: ' + (never.join(', ') || 'none'));
  /* Some are meant to be long-haul — fifty harvests, seven Dailies — so this
     is not a demand that everything falls in three weeks. But if most of the
     list is unreachable in three weeks the list is not pacing the game, it is
     decorating it. */
  check('a good part of the list falls within three weeks',
        never.length <= ACH.length / 2,
        never.length + ' of ' + ACH.length + ' unearned by anyone');
  /* The list has to have a spread — some met in the first week by anybody,
     some still ahead of you after three. A list where everything falls at
     once is a checklist; one where nothing does is wallpaper.

     Not "the diligent player earns more than the casual one": they earn the
     same eleven, because the list is milestones and three weeks is long
     enough for every visit rate to reach the same ones. Sooner, not more. */
  const everyone = ACH.filter(function (a) {
    return rows.every(function (r) { return r.ach[a.id]; });
  }).length;
  console.log('  earned by every visit rate: ' + everyone +
              ' · still ahead of all of them: ' + never.length);
  check('some of it is met by every kind of player', everyone >= 5, String(everyone));
  check('and some of it is still ahead of all of them at three weeks',
        never.length >= 3, String(never.length));
}

/* ---- the payouts have to mean something ---- */
{
  const goldenWorth = E('PRESTIGE_UNIT');
  const coinsOnly = ACH.filter(function (a) { return a.coins && !a.golden; });
  const goldOnly = ACH.filter(function (a) { return a.golden; });
  const totalCoins = coinsOnly.reduce(function (t, a) { return t + a.coins; }, 0);
  console.log('\n  coin awards total ' + totalCoins + '🪙 across ' + coinsOnly.length +
    '; a golden seed is worth ' + goldenWorth + '🪙 of run, so ' + goldOnly.length +
    ' golden awards are the real prize');
  /* A golden seed costs 12,000 coins of a run to earn any other way, so it
     has to be the harder half of the list — otherwise the big reward is
     attached to the easy things. */
  const cheapGolden = goldOnly.filter(function (a) {
    return ['h1', 'o1', 'gold1', 'day1'].indexOf(a.id) > -1;
  });
  check('no golden seed is attached to a first-time-you-do-anything award',
        !cheapGolden.length, cheapGolden.map(function (a) { return a.id; }).join(', '));
  check('the coin awards are all worth having',
        coinsOnly.every(function (a) { return a.coins >= 25; }),
        coinsOnly.filter(function (a) { return a.coins < 25; })
                 .map(function (a) { return a.id + ':' + a.coins; }).join(', '));
  /* And no single one may be a shortcut past the early game. */
  const biggest = coinsOnly.reduce(function (m, a) { return a.coins > m.coins ? a : m; });
  check('and none is worth more than a late seed',
        biggest.coins <= 400, biggest.id + ' pays ' + biggest.coins);
}

/* ---- an achievement must be paid once and only once ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.harvested = 1;
  const start = s.coins;
  G('checkAch()');
  const afterFirst = s.coins;
  G('checkAch()'); G('checkAch()'); G('checkAch()');
  console.log('\n  first harvest: ' + start + ' -> ' + afterFirst +
              ', then three more checks -> ' + s.coins);
  check('earning one pays out', afterFirst > start, start + ' -> ' + afterFirst);
  check('and checking again pays nothing more', s.coins === afterFirst,
        afterFirst + ' -> ' + s.coins);
  check('and it is recorded on the save', s.ach.h1 === true);
}

/* ---- and the game must look, at the moments one could come true ---- */
{
  /* An award nobody checks for is an award you get later, by accident, when
     something unrelated happens to call it. */
  const moments = ['harvest', 'deliverOrder', 'doPrestige', 'spinWheel', 'buyPlot', 'doBreed'];
  const missing = moments.filter(function (fn) {
    const i = html.indexOf('function ' + fn);
    if (i < 0) return false;                       // that function is named differently
    const body = html.slice(i, i + 3000);
    return body.indexOf('checkAch()') < 0;
  });
  console.log('  actions that do not check for an award afterwards: ' +
              (missing.join(', ') || 'none'));
  check('the game checks for an award after the things that earn them',
        missing.length <= 2, missing.join(', '));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

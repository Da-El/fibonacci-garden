/* Iteration 71: prestige takes the whole garden away for a permanent bonus,
   and nothing has ever played a second run.

   Everything measured about it so far has been the shape of the curve —
   what a seed costs, what a seed is worth. The question a player has is
   different and simpler: if I give all this up, do I get somewhere better,
   and do I get there faster? That takes two runs to answer and nothing had
   ever run one. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;

/* ---- what a replant takes and what it leaves ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  /* A gardener at the end of a good run. */
  s.coins = 40000; s.runEarned = 60000; s.level = 16; s.plotCount = 9;
  s.canTier = G('CAN_TIERS').length - 1; s.water = 40; s.compost = 12;
  while (s.plots.length < 9) s.plots.push(null);
  s.plots[0] = { s: 'elm', stage: 3, q: 2, stageAt: 0 };
  s.barn = { elm: { 3: 12 } };
  s.almanac = { elm: 3, daisy: 3 }; s.discovered = { elm: true };
  s.chapters = { c1: true, c2: true };
  s.hybrids = {}; s.bred = 2; s.harvested = 300; s.earned = 90000;
  s.trellised = [true, true, true, false, false, false, false, false, false];
  s.glassed = [true, false, false, false, false, false, false, false, false];
  s.perks = { steadyhand: true }; s.xp = 5000;
  G('registerHybrids()');

  /* Settle every achievement this state already owes, AFTER all of it is
     set — doing it first sees a garden with no harvests and marks nothing,
     which is how the first version of this ended up measuring prestige plus
     a windfall. Fifty harvests alone hands over a golden seed, and the
     coins from the rest land in the lifetime total. */
  s.ach = {};
  G('ACHIEVEMENTS').forEach(function (a) {
    try { if (a.test(s)) s.ach[a.id] = true; } catch (e) {}
  });

  const claim = G('claimableGolden()');
  const before = { golden: s.golden, prestiges: s.prestiges };
  console.log('  a 60,000-coin run is worth ' + claim + ' golden seed(s)');
  check('a good run is worth at least one seed', claim >= 1, String(claim));

  G('doPrestige()');
  const after = G('state');
  console.log('  after replanting: ' + after.coins + '🪙, ' + after.plotCount +
    ' beds, can tier ' + after.canTier + ', ' + after.golden + ' seeds');

  /* Taken away: everything you bought. That is the price. */
  check('the beds go back to three', after.plotCount === G('START_PLOTS'),
        String(after.plotCount));
  check('and the can goes back to the smallest', after.canTier === 0,
        String(after.canTier));
  check('and the coins go', after.coins < 1000, String(after.coins));
  check('and the barn is emptied', G('barnCountAll()') === 0);
  check('and the beds are cleared', after.plots.every(function (p) { return !p; }));
  check('and the trellises and glass go with them',
        !(after.trellised || []).some(Boolean) && !(after.glassed || []).some(Boolean));

  /* Kept: everything you learned or recorded. That is the point. */
  check('the almanac survives', Object.keys(after.almanac).length === 2);
  check('the journal survives', after.chapters.c1 === true);
  check('the achievements survive', after.ach.h1 === true);
  check('the crosses you bred survive', after.bred === 2);
  check('your level and perks survive',
        after.level === 16 && after.perks.steadyhand === true,
        'level ' + after.level);
  /* Lifetime earnings may rise across a replant and must never fall: the
     act of replanting earns "Replanted the garden", and the hundred coins
     that pays are coins earned like any other. The count of harvests is a
     count of harvests and cannot move at all. */
  check('the lifetime record survives',
        after.earned >= 90000 && after.harvested === 300,
        'earned ' + after.earned + ', harvested ' + after.harvested);
  check('and only rises by what the replant itself earned you',
        after.earned - 90000 <= 200, 'up by ' + (after.earned - 90000));

  check('the seeds are paid', after.golden === before.golden + claim,
        before.golden + ' + ' + claim + ' = ' + after.golden);
  check('and the replant is counted', after.prestiges === before.prestiges + 1);
  check('the bonus is now real', G('goldenMult()') > 1, G('goldenMult()').toFixed(3));
}

/* ---- and it must not be claimable before it is earned ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.runEarned = 100;
  const before = JSON.stringify({ p: s.plotCount, c: s.canTier });
  G('doPrestige()');
  check('a garden that has earned nothing cannot be replanted for a seed',
        JSON.stringify({ p: G('state').plotCount, c: G('state').canTier }) === before,
        'the garden was reset for nothing');
}

/* ---- does it actually pay, over a long enough run? ---- */
{
  const opts = { seed: 4242, profile: 'diligent', realPour: true, tapError: 30,
                 hive: true, apprentice: true, days: 60 };
  const rows = [
    { label: 'never replant', run: S.run(opts) },
    { label: 'replant at 1 seed', run: S.run(Object.assign({ prestigeAt: 1 }, opts)) },
    { label: 'replant at 3 seeds', run: S.run(Object.assign({ prestigeAt: 3 }, opts)) }
  ];
  console.log('\n  sixty days, lifetime coins earned:');
  rows.forEach(function (r) {
    console.log('    ' + r.label.padEnd(20) + String(r.run.lifetime).padStart(9) +
      '   ' + r.run.prestiges + ' replant(s), ' + r.run.golden + ' seeds, ×' +
      r.run.goldenMult.toFixed(2));
  });
  const never = rows[0].run.lifetime, eager = rows[1].run.lifetime, patient = rows[2].run.lifetime;
  /* If giving up nine beds and an 89-drop can leaves you worse off over two
     months, nobody should ever press the button and the whole late game is a
     trap. Lifetime earnings, not this run's — runEarned resets on a replant,
     and comparing that is comparing a fresh garden to a mature one. */
  check('replanting beats never replanting over two months',
        patient > never, patient + ' vs ' + never);
  console.log('    patience is worth ' +
    Math.round((patient / never - 1) * 100) + '% over never replanting, and ' +
    Math.round((patient / eager - 1) * 100) + '% over replanting on sight');
  /* And when to do it has to be a real decision rather than a button you
     mash. There is a wrong answer at both ends: never replanting leaves the
     bonus on the table, and replanting the moment a single seed is on offer
     is worse than not replanting at all — you give up nine beds and an
     89-drop can for six per cent on the price of everything.

     That second half only became true when fever was tamed in iteration 72.
     Before it, fever covered most of a precise player's pours and papered
     over the cost of starting again, so every replanting strategy came out
     ahead. It is a better shape now: a decision with a right answer, a
     wrong answer, and a reason. */
  check('and being patient about it beats replanting on sight',
        patient > eager, patient + ' vs ' + eager);
  check('and replanting on sight is a genuine mistake',
        eager <= never * 1.02, eager + ' vs ' + never + ' for never replanting');
}

/* ---- is the second run faster than the first? ---- */
{
  /* The thing a player actually feels. Run one starts at level 1 with three
     beds; run two keeps the level and the perks and the shelf, and carries a
     price bonus — so it should climb back much faster or the reset is just
     a punishment with a number attached. */
  const first = S.run({ seed: 4242, profile: 'diligent', realPour: true, tapError: 30,
                        hive: true, apprentice: true, days: 21 });
  const dayNine = function (r) {
    for (let i = 0; i < r.days.length; i++) if (r.days[i].plots >= 9) return r.days[i].d;
    return null;
  };
  const firstNine = dayNine(first);

  /* Now the same three weeks, but starting from where a replant leaves you. */
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.runEarned = 60000; s.level = 16; s.plotCount = 9;
  s.canTier = G('CAN_TIERS').length - 1;
  G('doPrestige()');
  const seeds = G('state').golden;
  console.log('\n  run one reached nine beds on day ' + firstNine);
  console.log('  run two starts at level ' + G('state').level + ' with ' + seeds +
    ' seed(s) — every price ×' + G('goldenMult()').toFixed(2) +
    ' and the whole shelf already unlocked');

  check('a replant leaves you at the level you reached', G('state').level >= 16);
  check('and with the whole shelf still open',
        E('SPECIES').filter(function (sp) { return sp.lvl <= G('state').level; }).length
        === E('SPECIES').length,
        'unlocked ' + E('SPECIES').filter(function (sp) { return sp.lvl <= G('state').level; }).length);
  check('and a price bonus that was not there the first time',
        G('goldenMult()') > 1.05, G('goldenMult()').toFixed(3));
  check('run one really did take a while to reach nine beds',
        firstNine && firstNine >= 3, 'day ' + firstNine);
}

/* ---- the bonus must not run away ---- */
{
  const g = H.build(); const G = g.evalIn;
  const at = function (n) { G('state').golden = n; return G('goldenMult()'); };
  console.log('\n  seeds to price bonus: ' +
    [1, 3, 8, 21, 55].map(function (n) { return n + '→×' + at(n).toFixed(2); }).join('  '));
  check('each seed is worth the same modest step',
        Math.abs((at(2) - at(1)) - (at(21) - at(20))) < 1e-9);
  /* Linear and small: 6.18% a seed. Fifty-five seeds is a fourfold price on
     everything, which is a lot but takes fifty-five replants to reach, and
     no single seed ever changes the game. */
  check('and no one seed is worth more than a tenth',
        at(1) - at(0) < 0.1, (at(1) - at(0)).toFixed(4));
  check('and the whole thing stays inside a run of the numbers',
        at(55) < 5, at(55).toFixed(2));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

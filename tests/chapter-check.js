/* Iteration 69: eleven chapters of objectives, and the only thing anyone has
   ever asked of them is whether a gardener who has done everything meets
   every one. That is a check on the wiring, not on the journal.

   The question the journal exists to answer is: after this, what should I
   do? So the thing to measure is when each chapter actually falls in a real
   run — whether they arrive spread out or all at once, whether any of them
   is already met before you start, and whether the thing each one asks for
   is something the game has by then given you a way to do. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const CH = E('CHAPTERS');

/* ---- the shape of the thing ---- */
{
  console.log('  ' + CH.length + ' chapters, ' +
    CH.reduce(function (t, c) { return t + c.objs.length; }, 0) + ' objectives');
  const ids = CH.map(function (c) { return c.id; });
  check('every chapter has its own id',
        ids.filter(function (i, n) { return ids.indexOf(i) !== n; }).length === 0);
  check('every chapter is titled and quoted',
        CH.every(function (c) { return c.title && c.quote; }));
  check('every chapter pays something',
        CH.every(function (c) {
          const r = c.reward || {};
          return (r.coins | 0) + (r.golden | 0) + (r.compost | 0) > 0;
        }));
  check('and says what it pays',
        CH.every(function (c) { return c.reward && c.reward.label; }));
  const noGet = [];
  CH.forEach(function (c) {
    c.objs.forEach(function (o) {
      if (typeof o.get !== 'function' || !o.t || !o.need) noGet.push(c.id + ': ' + o.t);
    });
  });
  check('every objective has a target and a way to read progress',
        !noGet.length, noGet.join(', '));
}

/* ---- nothing may already be done before you have played ---- */
{
  const g = H.build(); const G = g.evalIn;
  const fresh = G('freshState')();
  const free = [];
  G('CHAPTERS').forEach(function (c) {
    c.objs.forEach(function (o) {
      let have = 0;
      try { have = o.get(fresh) | 0; } catch (e) { have = 0; }
      const need = o.need === -1 ? G('BASE_SPECIES').length : o.need;
      if (have >= need) free.push(c.id + ': ' + o.t);
    });
  });
  check('no objective is already met on a brand-new save',
        !free.length, free.join(', '));
}

/* ---- when each one actually falls, across three weeks ---- */
{
  /* What the simulated player actually does: plants, pours, harvests,
     sells, delivers, buys beds and cans, shelters beds, keeps a hive and
     hires help. It does not breed, buy glass, promote or replant, so the
     four chapters resting on those are outside what this can see. */
  const SIM_DOES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  const r = S.run({ seed: 4242, profile: 'diligent', realPour: true,
                    tapError: 30, chapterTrail: true, hive: true, apprentice: true });
  const trail = r.chapterTrail || {};
  console.log('\n  a diligent three weeks, chapter by chapter:');
  const late = [], never = [];
  CH.forEach(function (c) {
    const day = trail[c.id];
    console.log('    ' + c.id.padEnd(4) + c.title.padEnd(22) +
      (day ? 'complete on day ' + day : 'not reached in 21 days'));
    if (!day) never.push(c.id);
    else if (day > 21) late.push(c.id);
  });
  const reached = CH.length - never.length;
  console.log('  ' + reached + ' of ' + CH.length + ' complete inside three weeks');

  /* The first chapter has to fall almost at once, or the journal never
     starts leading. */
  check('the first chapter is finished in the first few days',
        trail.c1 && trail.c1 <= 3, 'day ' + trail.c1);
  /* And the ones the simulation is capable of reaching, it has to reach —
     otherwise the ask is beyond an ordinary three weeks of play. */
  const missed = SIM_DOES.filter(function (id) { return !trail[id]; });
  check('every chapter that asks only for ordinary play is reached',
        !missed.length, missed.join(', '));
  /* Not all at once. A journal that empties on day two stops guiding. */
  const days = Object.keys(trail).map(function (k) { return trail[k]; });
  const spread = days.length ? Math.max.apply(null, days) - Math.min.apply(null, days) : 0;
  console.log('  first to last: day ' + Math.min.apply(null, days) +
              ' to day ' + Math.max.apply(null, days));
  check('and they do not all fall on the same few days', spread >= 7,
        spread + ' days between the first and the last');
}

/* ---- the reward has to grow with the ask ----
   There is no honest way to score "reach level 4" against "breed a true
   Fibonacci fraction" by counting what each asks for — the first version of
   this took the log of every target and duly reported that earning 5,000
   coins is five times harder than breeding a hybrid. The order the chapters
   are in is the design's own statement of difficulty; what has to hold is
   that the money follows it. */
{
  const worth = CH.map(function (c) {
    const r = c.reward || {};
    return (r.coins | 0) + (r.golden | 0) * E('PRESTIGE_UNIT') + (r.compost | 0) * 20;
  });
  console.log('  what each one pays: ' + worth.map(function (x) {
    return x >= 1000 ? Math.round(x / 1000) + 'k' : String(x);
  }).join(' '));
  /* Coins alone must climb — the golden-seed chapters are a different
     currency and a different kind of milestone, so they are taken out
     rather than compared against a few hundred coins. */
  const coinOnly = CH.filter(function (c) { return !(c.reward || {}).golden; });
  const coins = coinOnly.map(function (c) { return c.reward.coins | 0; });
  const backwards = [];
  for (let i = 1; i < coins.length; i++) {
    if (coins[i] < coins[i - 1]) {
      backwards.push(coinOnly[i - 1].id + ' ' + coins[i - 1] + ' -> ' +
                     coinOnly[i].id + ' ' + coins[i]);
    }
  }
  console.log('  coin chapters climb: ' + coins.join(' -> '));
  check('the coin rewards climb through the journal',
        !backwards.length, backwards.join('; '));
  /* And a golden seed has to be reserved for the later half, since it is
     worth as much as twelve thousand coins of a run. */
  const goldenEarly = CH.filter(function (c, i) {
    return (c.reward || {}).golden && i < CH.length / 3;
  });
  check('and no golden seed is paid out in the first third',
        !goldenEarly.length, goldenEarly.map(function (c) { return c.id; }).join(', '));
  check('the last chapter is the biggest prize',
        worth[worth.length - 1] >= Math.max.apply(null, worth) * 0.9,
        worth[worth.length - 1] + ' vs a best of ' + Math.max.apply(null, worth));
}

/* ---- a chapter must not ask for something the game has not offered ---- */
{
  /* Objectives naming a system, against the level that system unlocks at.
     Being told to put a bed under glass eight levels before glass exists is
     an instruction you can only follow by ignoring it for a fortnight. */
  const GATES = [
    [/under glass|glasshouse/i, E('GLASS_LVL')],
    [/apprentice|head gardener/i, 1],
    [/hive|pollinated/i, 1],
    [/breed|hybrid|fibonacci fraction/i, 1],
    [/replant|prestige/i, 1]
  ];
  const early = [];
  CH.forEach(function (c, ci) {
    c.objs.forEach(function (o) {
      GATES.forEach(function (gate) {
        if (!gate[0].test(o.t)) return;
        /* Where in the journal it sits, as a fraction; and where the gate
           sits against the level curve. A late system asked for early is
           the fault; the reverse is fine. */
        const at = ci / (CH.length - 1);
        const gateAt = gate[1] / 18;
        if (gateAt > at + 0.35) {
          early.push(c.id + ' asks for "' + o.t + '" at ' + Math.round(at * 100) +
                     '% through, unlocked at level ' + gate[1]);
        }
      });
    });
  });
  check('no chapter asks for a system the game has not opened yet',
        !early.length, early.join('; '));
}

/* ---- claiming one must pay once, and only when it is done ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  const c1 = G('CHAPTERS')[0];
  const before = s.coins;
  G('claimChapter("' + c1.id + '")');
  check('an unfinished chapter cannot be claimed', s.coins === before,
        before + ' -> ' + s.coins);
  /* Satisfy it for real, the way play does. */
  /* 'Sell something at market' reads state.earned, not runEarned — the
     lifetime figure rather than the one that resets on a replant. */
  s.harvested = 5; s.earned = 500; s.runEarned = 500;
  const done = G('chapterProgress')(G('CHAPTERS')[0]);
  if (done.all) {
    G('claimChapter("' + c1.id + '")');
    const paid = s.coins;
    check('a finished one pays out', paid > before, before + ' -> ' + paid);
    G('claimChapter("' + c1.id + '")');
    G('claimChapter("' + c1.id + '")');
    check('and claiming it again pays nothing more', s.coins === paid,
          paid + ' -> ' + s.coins);
    check('and it is recorded', s.chapters[c1.id] === true);
  } else {
    console.log('\n  (chapter one not satisfiable from state alone: ' +
      done.rows.filter(function (r) { return !r.done; })
              .map(function (r) { return r.t + ' ' + r.have + '/' + r.need; }).join(', ') + ')');
    check('chapter one can be satisfied by setting the fields it reads', false,
          done.rows.filter(function (r) { return !r.done; })
                   .map(function (r) { return r.t; }).join(', '));
  }
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

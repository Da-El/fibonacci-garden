/* Iteration 84: the glasshouse, played rather than costed.

   Iteration 32 worked out what a pane should be worth on paper and concluded
   it comes to roughly the same coins per drop, because pouring every stage
   is what makes a 💎 pristine possible and a pristine sells for twice a
   ★★★. Nobody has ever played a glassed garden for three weeks and put it
   beside an open one. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SEEDS = [11, 22, 33, 44];

/* A gardener with one bed under glass and a plant in it. */
function glassed(species) {
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 60000; s.level = 16;
  while (s.glassed.length < s.plotCount) s.glassed.push(false);
  G('plant(0,"' + (species || 'elm') + '")');
  G('curPlot = 0');
  G('buyGlass()');
  return { h: g, E: G, s: s, sp: G('byId')[species || 'elm'] };
}

/* ---- the rule: nothing grows on its own in there ---- */
{
  const g = glassed('sunflower');
  check('a pane can be bought and lands on the bed', !!g.s.glassed[0]);
  check('and the plant knows it is under glass', !!g.s.plots[0].glass);
  const stage = g.s.plots[0].stage;
  /* A week of clock, which would carry an open bed to its ceiling many
     times over. */
  g.s.offset += 7 * 24 * 3600000;
  g.E('growthTick()');
  console.log('  a week of clock over a glassed sunflower: stage ' +
              stage + ' -> ' + g.s.plots[0].stage);
  check('the clock never advances a plant under glass',
        g.s.plots[0].stage === stage, stage + ' -> ' + g.s.plots[0].stage);
  check('and the ceiling really is zero for it',
        g.E('timerCeiling')(g.sp, g.s.plots[0]) === 0,
        String(g.E('timerCeiling')(g.sp, g.s.plots[0])));

  /* And an open bed beside it must still grow, or the test proved nothing. */
  const o = H.build(); const O = o.evalIn; const os = O('state');
  os.offset = 0; os.coins = 900; os.level = 16;
  O('plant(0,"sunflower")');
  os.offset += 7 * 24 * 3600000;
  O('growthTick()');
  check('while an open bed beside it does grow', os.plots[0].stage > 0,
        'stage ' + os.plots[0].stage);
}

/* ---- and it shelters what it holds ---- */
{
  const g = glassed('sunflower');
  g.s.plots[0].stage = 4;
  g.s.stormChecked = g.E('weatherSlot()') - 900;
  g.E('stormTick()');
  check('a storm cannot reach a plant under glass',
        g.s.plots[0].stage === 4, String(g.s.plots[0].stage));

  const b = glassed('sunflower');
  b.s.plots[0].stage = 3;
  b.s.bugSlot = -1;
  b.s.bugChecked = -1;
  for (let k = 0; k < 200; k++) { b.s.offset += 10 * 60000; b.E('bugTick()'); }
  check('and aphids cannot get in', !b.s.plots[0].bug);

  const w = glassed('elm');
  const sp = w.E('byId')['elm'];
  w.s.plots[0].stage = sp.stages;
  w.s.plots[0].ripeAt = w.E('NOW()') - 5 * 24 * 3600000;
  console.log('  a bloom left standing five days under glass wilts by ' +
              w.E('wiltPenalty')(w.s.plots[0]) + ' stars');
  check('and a ripe bloom does not spoil in there',
        w.E('wiltPenalty')(w.s.plots[0]) === 0,
        String(w.E('wiltPenalty')(w.s.plots[0])));
}

/* ---- the pristine: earned by not spilling, once ---- */
{
  /* Pour every stage perfectly and the bloom must come out pristine. */
  const g = glassed('elm');
  const sp = g.sp;
  let poured = 0;
  while (g.s.plots[0] && g.s.plots[0].stage < sp.stages && poured < 30) {
    g.E('advanceStage("water", true)');
    poured++;
  }
  const p = g.s.plots[0];
  console.log('\n  a glassed elm poured perfectly: ' + poured + ' drops, ' +
    p.perfects + ' perfect, ' + (p.spills | 0) + ' spilled');
  check('every stage of a glassed plant is a pour', poured === sp.stages,
        poured + ' of ' + sp.stages);
  check('and pouring them all perfectly spills nothing', !(p.spills | 0));
  const before = g.E('barnCountAll()');
  g.E('harvest()');
  const pristine = (g.s.barn[sp.id] || {}).p | 0;
  console.log('  and it went into the barn as: ' +
    Object.keys(g.s.barn[sp.id] || {}).join(', '));
  check('a flawless glassed bloom is banked as pristine', pristine > 0,
        JSON.stringify(g.s.barn[sp.id]));
  check('and a pristine is worth twice a ★★★',
        g.E('tierPrice')(sp, 'p') === g.E('priceOfQ')(sp, 3) * 2,
        g.E('tierPrice')(sp, 'p') + ' against ' + g.E('priceOfQ')(sp, 3));
}

/* ---- and one spilled drop is all it takes ---- */
{
  const g = glassed('elm');
  const sp = g.sp;
  /* Spill the very first one, then pour the rest perfectly. */
  g.s.plots[0].spills = 1;
  let poured = 0;
  while (g.s.plots[0] && g.s.plots[0].stage < sp.stages && poured < 30) {
    g.E('advanceStage("water", true)');
    poured++;
  }
  g.E('harvest()');
  const tiers = Object.keys(g.s.barn[sp.id] || {});
  console.log('  the same plant with one drop spilled: ' + tiers.join(', '));
  check('one spilled drop costs the pristine',
        tiers.indexOf('p') < 0, tiers.join(', '));
  check('but the bloom is still worth having',
        tiers.length > 0, tiers.join(', '));
}

/* ---- what a glassed garden is actually worth ---- */
{
  function mean(glass, err) {
    let earned = 0, harvests = 0, pristine = 0;
    SEEDS.forEach(function (seed) {
      const r = S.run({ seed: seed, profile: 'diligent', realPour: true,
                        tapError: err, days: 21, glass: glass, forOrders: false });
      earned += r.earned; harvests += r.harvests;
      pristine += (r.qualityMix && r.qualityMix.p) || 0;
    });
    return { earned: earned / SEEDS.length, harvests: harvests / SEEDS.length,
             pristine: pristine / SEEDS.length };
  }
  console.log('\n  three weeks, averaged over ' + SEEDS.length + ' seeds:');
  console.log('    tap error   glass   harvests   pristine    earned    against open');
  const rows = {};
  [15, 30].forEach(function (err) {
    const open = mean(false, err), pane = mean(true, err);
    rows[err] = { open: open, pane: pane };
    [['no', open], ['yes', pane]].forEach(function (r) {
      console.log('    ±' + String(err).padStart(2) + 'ms' + r[0].padStart(9) +
        r[1].harvests.toFixed(0).padStart(11) + r[1].pristine.toFixed(1).padStart(11) +
        Math.round(r[1].earned).toString().padStart(10) +
        (r[0] === 'yes' ? ('   ' + ((pane.earned / open.earned - 1) * 100).toFixed(1) + '%') : ''));
    });
  });

  /* The thing glass is for. */
  check('glass really does produce more flawless blooms',
        rows[30].pane.pristine > rows[30].open.pristine * 1.3,
        rows[30].pane.pristine.toFixed(1) + ' against ' + rows[30].open.pristine.toFixed(1));
  check('and a precise hand gets far more of them than a loose one',
        rows[15].pane.pristine > rows[30].pane.pristine * 3,
        rows[15].pane.pristine.toFixed(1) + ' against ' + rows[30].pane.pristine.toFixed(1));

  /* And what it costs, stated rather than hidden. Every stage under glass
     is a drop, so a glassed bed finishes fewer plants for the same water —
     it is a bet on your own hand rather than an investment, and the hint
     that offers it says exactly that: one spilled drop is all that stands
     between you and the best bloom in the game. */
  const cost15 = 1 - rows[15].pane.earned / rows[15].open.earned;
  const cost30 = 1 - rows[30].pane.earned / rows[30].open.earned;
  console.log('    glass costs ' + (cost15 * 100).toFixed(1) + '% of a precise run and ' +
              (cost30 * 100).toFixed(1) + '% of an ordinary one');
  check('glass is close to free for a player who does not spill',
        cost15 < 0.03, (cost15 * 100).toFixed(1) + '%');
  check('and never so expensive that taking it is a mistake',
        cost30 < 0.12, (cost30 * 100).toFixed(1) + '%');
  check('and precision is what decides which it is',
        cost15 < cost30, (cost15 * 100).toFixed(1) + '% against ' + (cost30 * 100).toFixed(1) + '%');
}

/* ---- and the game must say it is a bet, not a bargain ---- */
{
  const tx = E('HINTS').glass.tx.replace(/<[^>]+>/g, '');
  console.log('\n  what the game says: "' + tx.slice(0, 130) + '"');
  check('the hint says the clock stops in there', /nothing grows on its own/i.test(tx));
  check('and that every stage is yours', /every stage is yours/i.test(tx));
  check('and what that buys you', /pristine|flawless/i.test(tx));
  /* It must not promise money, because it does not pay any. */
  check('and does not promise it will make you richer',
        !/more coins|earn more|pays better|profit/i.test(tx), tx.slice(0, 80));
  check('and warns that one spill is enough to lose it',
        /one spilled drop|one spill/i.test(tx), tx.slice(-70));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

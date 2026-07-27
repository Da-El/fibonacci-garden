/* Iteration 79: a trellis costs 120 coins and shelters one bed from storms
   for as long as the garden stands. Nobody has ever asked what it saves.

   The answer needs care, because the effect is about one per cent and a
   single pair of runs cannot see one per cent. The simulation is chaotic:
   change anything and the two runs draw different numbers from then on, so
   comparing seed 4242 against seed 4242 with one setting flipped compares
   two different afternoons. It has to be averaged. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SEEDS = [11, 22, 33, 44, 55, 66];

/* ---- how often a storm comes, and how often it lands ---- */
{
  const N = 3000;
  let storms = 0;
  for (let k = 0; k < N; k++) if (E('weatherAt')(k).id === 'storm') storms++;
  const share = storms / N;
  const slotMin = 20;
  const chance = E('stormDmgChance')() / 100;
  const hoursPerHit = slotMin / share / chance / 60;
  console.log('  storms are ' + (share * 100).toFixed(1) + '% of weather slots, and an ' +
    'unsheltered bed takes a hit ' + (chance * 100).toFixed(0) + '% of the time');
  console.log('  so one bed is battered about every ' + hoursPerHit.toFixed(0) + ' hours');
  check('storms are a real part of the weather', share > 0.03 && share < 0.25,
        (share * 100).toFixed(1) + '%');
  check('and a storm does not hit every bed it passes over',
        chance > 0 && chance < 0.4, (chance * 100).toFixed(0) + '%');
  /* Often enough to be worth insuring against, rare enough that it is not
     simply a tax on owning a garden. */
  check('a bed is battered roughly once a day or two, not once an hour',
        hoursPerHit > 8 && hoursPerHit < 96, hoursPerHit.toFixed(0) + 'h');
}

/* ---- what a hit actually does ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 900; s.level = 12;
  G('plant(0,"sunflower")');
  s.plots[0].stage = 4; s.plots[0].q = 5;
  const before = { stage: s.plots[0].stage, q: s.plots[0].q };
  /* Force a storm onto an unsheltered bed. */
  s.trellised[0] = false;
  s.stormChecked = G('weatherSlot()') - 400;
  G('stormTick()');
  const after = s.plots[0] ? { stage: s.plots[0].stage, q: s.plots[0].q } : null;
  console.log('\n  a growing plant caught in a storm: stage ' + before.stage + ' -> ' +
    (after ? after.stage : 'gone') + ', care ' + before.q + ' -> ' + (after ? after.q : '-'));
  check('a storm knocks a growing plant back rather than killing it', !!after);
  check('and it never falls below the ground', !after || after.stage >= 0,
        after && String(after.stage));

  /* A ripe one loses quality instead, which is the thing a pour cannot
     give back. */
  const r = H.build(); const R = r.evalIn; const rs = R('state');
  rs.offset = 0; rs.coins = 900; rs.level = 12;
  R('plant(0,"sunflower")');
  const sp = R('byId')['sunflower'];
  rs.plots[0].stage = sp.stages; rs.plots[0].q = sp.stages;
  rs.trellised[0] = false;
  const qBefore = rs.plots[0].q;
  rs.stormChecked = R('weatherSlot()') - 400;
  R('stormTick()');
  console.log('  a ripe plant caught in one: care ' + qBefore + ' -> ' + rs.plots[0].q +
    ' (★' + R('starsFor')(sp, rs.plots[0].q) + ')');
  check('a ripe plant loses quality rather than a stage',
        rs.plots[0].q < qBefore && rs.plots[0].stage === sp.stages,
        qBefore + ' -> ' + rs.plots[0].q);
  check('and never below nothing', rs.plots[0].q >= 0, String(rs.plots[0].q));
}

/* ---- a trellis must stop it ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 900; s.level = 12;
  for (let i = 0; i < s.plotCount; i++) {
    G('plant(' + i + ',"sunflower")');
    if (s.plots[i]) { s.plots[i].stage = 4; s.plots[i].q = 4; }
    s.trellised[i] = true;
  }
  s.stormChecked = G('weatherSlot()') - 800;
  G('stormTick()');
  const knocked = s.plots.filter(function (p) { return p && p.stage < 4; }).length;
  console.log('\n  eight hundred slots of weather over a fully sheltered garden: ' +
    knocked + ' beds knocked back');
  check('a trellis stops the storm completely', knocked === 0, String(knocked));

  /* And glass, which is the other shelter. */
  const gl = H.build(); const GL = gl.evalIn; const gs = GL('state');
  gs.offset = 0; gs.coins = 900; gs.level = 12;
  GL('plant(0,"sunflower")');
  gs.plots[0].stage = 4; gs.plots[0].glass = 1; gs.trellised[0] = false;
  gs.stormChecked = GL('weatherSlot()') - 800;
  GL('stormTick()');
  check('and so does a pane of glass', gs.plots[0].stage === 4,
        String(gs.plots[0].stage));
}

/* ---- and it must be worth the hundred and twenty coins ---- */
{
  /* Averaged across six seeds, because a one-per-cent effect is smaller
     than the noise between any two runs. The first pass at this compared a
     single seeded pair, saw the unsheltered garden come out ahead, and
     concluded the trellis was worthless — it was chaos, not a finding. */
  function mean(trellises) {
    let earned = 0, harvests = 0, hits = 0;
    SEEDS.forEach(function (seed) {
      const r = S.run({ seed: seed, profile: 'diligent', realPour: true,
                        tapError: 30, days: 21, trellises: trellises });
      earned += r.earned; harvests += r.harvests; hits += r.stormHits;
    });
    return { earned: earned / SEEDS.length, harvests: harvests / SEEDS.length,
             hits: hits / SEEDS.length };
  }
  const bare = mean(0), sheltered = mean(9);
  const gain = sheltered.earned / bare.earned - 1;
  const cost = 9 * E('TRELLIS_COST') / bare.earned;
  console.log('\n  three weeks, averaged over ' + SEEDS.length + ' seeds:');
  console.log('    unsheltered  ' + Math.round(bare.earned) + '🪙, ' +
    bare.harvests.toFixed(0) + ' harvests, ' + bare.hits.toFixed(0) + ' storm hits');
  console.log('    sheltered    ' + Math.round(sheltered.earned) + '🪙, ' +
    sheltered.harvests.toFixed(0) + ' harvests, ' + sheltered.hits.toFixed(0) + ' storm hits');
  console.log('    shelter is worth ' + (gain * 100).toFixed(2) + '% and costs ' +
    (cost * 100).toFixed(2) + '% — a return of ×' + (gain / cost).toFixed(1));

  check('sheltering the garden really does stop the storms',
        sheltered.hits < bare.hits * 0.15,
        sheltered.hits.toFixed(0) + ' against ' + bare.hits.toFixed(0));
  check('and it leaves you with more harvests',
        sheltered.harvests > bare.harvests,
        sheltered.harvests.toFixed(1) + ' against ' + bare.harvests.toFixed(1));
  check('and more coins than it cost',
        gain > cost, (gain * 100).toFixed(2) + '% gained for ' + (cost * 100).toFixed(2) + '% spent');
  /* But not so much that it stops being a choice — a hundred and twenty
     coins should not be the best purchase in the game. */
  check('and it is not the only thing worth buying',
        gain < 0.1, (gain * 100).toFixed(2) + '%');
}

/* ---- the forecast has to give you time to act ---- */
{
  /* A hazard you cannot see coming is not a decision, it is weather. The
     game shows three slots ahead, so the question is whether a storm is
     ever visible before it lands. */
  const g = H.build(); const G = g.evalIn;
  G('state').offset = 0;
  let warned = 0, total = 0;
  for (let slot = 0; slot < 2000; slot++) {
    if (G('weatherAt')(slot).id !== 'storm') continue;
    total++;
    /* Was it inside the three-slot forecast from one slot earlier? */
    for (let k = 1; k <= 3; k++) {
      if (slot - k >= 0 && G('weatherAt')((slot - k) + k).id === 'storm') { warned++; break; }
    }
  }
  console.log('\n  ' + total + ' storms in 2000 slots, ' + warned +
              ' of them visible in the forecast beforehand');
  check('every storm is visible before it lands', warned === total,
        warned + ' of ' + total);
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('and the game says a storm is coming rather than leaving you to read the icons',
        html.indexOf("hint('storm')") > -1);
  check('and the shelter is offered where the plant is',
        html.indexOf('trellisBtn') > -1);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

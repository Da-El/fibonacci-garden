/* Iteration 41: the journal was written in iteration 16 and nothing has
   checked it since. Every objective reads a state field — so the first
   question is whether those fields still exist, because one renamed field
   makes a whole chapter unachievable and nothing would say so. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn; const s = E('state');
s.offset = 0;

/* ---- 1. every objective must read a field that exists ---- */
{
  const chapters = E('CHAPTERS');
  const dead = [];
  chapters.forEach(function (ch) {
    ch.objs.forEach(function (o) {
      let v;
      try { v = o.get(s); } catch (e) { dead.push(ch.id + ' "' + o.t + '" threw: ' + e.message); return; }
      if (v === undefined || (typeof v === 'number' && isNaN(v))) {
        dead.push(ch.id + ' "' + o.t + '" reads undefined');
      }
    });
  });
  check('every objective reads a field that exists', !dead.length, dead.join('; '));
}

/* ---- 2. a maxed-out garden must satisfy every objective. If an objective
          cannot be met by a player who has done everything, it is dead. ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0;
  // a gardener who has done absolutely everything
  st.level = 16; st.coins = 9999999; st.plotCount = 9;
  st.harvested = 500; st.earned = 500000; st.runEarned = 500000;
  st.bestCombo = 34; st.goldenHarvests = 20; st.pristineHarvests = 5;
  st.ordersDelivered = 40; st.prestiges = 3; st.golden = 5;
  st.pollinatedSold = 30; st.hive = true; st.hiveLevel = 3;
  st.weedsCleared = 30; st.bred = 8;
  st.appLevel = 2; st.canTier = 4;
  st.stalledFinished = 40; st.driedReady = 4; st.glassPristine = 3;
  st.trellised = [true, true, true, true, true, true, true, true, true];
  st.glassed = [true, true, true, false, false, false, false, false, false];
  G('SPECIES').forEach(function (sp) { st.almanac[sp.id] = 3; });
  G('BASE_SPECIES').forEach(function (sp) { st.discovered[sp.id] = true; });
  /* Actually breed some, through the real bench. Faking a registry entry
     would prove nothing: fibHybridCount and hybridsGrown look the species up
     by id, so a made-up id reads as zero and chapter 7 would look dead when
     it is only unexercised. */
  const pairs = [['sedum', 'pear'], ['pear', 'houseleek'], ['houseleek', 'pinecone'],
                 ['elm', 'beech'], ['sedum', 'houseleek'], ['beech', 'pear']];
  pairs.forEach(function (pr) {
    st.coins = 9999999;
    try { G('doBreed("' + pr[0] + '","' + pr[1] + '")'); } catch (e) {}
  });
  // and grow every hybrid that came out of it, so "grow a plant you bred" holds
  G('SPECIES').filter(function (sp) { return sp.hybrid; })
    .forEach(function (sp) { st.almanac[sp.id] = 3; });
  st.bred = Math.max(st.bred, Object.keys(st.hybrids || {}).length);

  const unmet = [];
  G('CHAPTERS').forEach(function (ch) {
    ch.objs.forEach(function (o) {
      const need = o.need === -1 ? G('BASE_SPECIES').length : o.need;
      let have = 0;
      try { have = o.get(st); } catch (e) { unmet.push(ch.id + ' "' + o.t + '" threw'); return; }
      if (!(have >= need)) unmet.push(ch.id + ' "' + o.t + '" ' + have + '/' + need);
    });
  });
  check('a gardener who has done everything meets every objective',
        !unmet.length, unmet.join('; '));
}

/* ---- 3. rewards must be sized against the current economy ---- */
{
  const E2 = H.build().evalIn;
  const seed = E2('goldenSeedCost')(0);
  const tree = E2('PLOT_COSTS').reduce(function (a, b) { return a + b; }, 0) +
               E2('CAN_COSTS').reduce(function (a, b) { return a + b; }, 0);
  let coins = 0, golden = 0;
  E2('CHAPTERS').forEach(function (ch) {
    coins += ch.reward.coins || 0;
    golden += ch.reward.golden || 0;
  });
  console.log('  the whole journal pays ' + coins + ' coins and ' + golden + ' golden seeds');
  console.log('  for scale: plots+cans cost ' + tree + ', one golden seed costs ' + seed + ' earned');
  check('the journal pays something worth having against the current tree',
        coins >= tree * 0.15, coins + ' vs a ' + tree + ' tree');
  check('the golden seeds it pays are a real head start', golden >= 4, golden + ' seeds');
}

/* ---- 4. the systems added since iteration 16 should have a goal ---- */
{
  const E3 = H.build().evalIn;
  const text = E3('CHAPTERS').map(function (ch) {
    return ch.title + ' ' + ch.quote + ' ' + ch.objs.map(function (o) { return o.t; }).join(' ');
  }).join(' ').toLowerCase();
  const missing = [];
  [['glass', 'the glasshouse'], ['dry', 'the dry spell'],
   ['apprentice', 'the apprentice'], ['thirst|waiting|stall', 'the stalled plant']]
    .forEach(function (pair) {
      if (!new RegExp(pair[0]).test(text)) missing.push(pair[1]);
    });
  check('every major system has a goal attached', !missing.length, missing.join(', '));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

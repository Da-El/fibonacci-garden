/* Iteration 94: the first bloom a real beginner grows.

   tutor-check walks the coach steps and onboard-check reads the numbers the
   tutorial quotes. Both drive a player who does the right thing at the right
   moment. Nobody has played the opening the way a beginner actually plays it:
   imprecisely, with whatever seed looked nice, at whatever hour they happened
   to open the app, without knowing that the clock stops halfway or that the
   can is the whole budget.

   A new garden starts with 20 coins, 13 drops and three beds. Everything
   below starts there and does nothing a beginner could not do. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const MIN = 60000, HOUR = 60 * MIN;

/* A gardener who taps roughly. `err` is how far off the gold they land, in
   milliseconds, alternating either side so the misses are not all one way. */
function beginner(opts) {
  opts = opts || {};
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  G('tutor').done = true;                      // the coach is a separate story
  if (opts.hour !== undefined) {
    const d = new Date(G('NOW()'));
    d.setHours(opts.hour, 0, 0, 0);
    s.offset = d.getTime() - G('Date.now()');
  }
  let flip = 1;
  const pourOnce = function (i) {
    G('curPlot = ' + i);
    if (s.water <= 0) return 'dry';
    const before = s.plots[i] ? s.plots[i].stage : -1;
    G('doAct()');
    const pr = G('pour');
    if (!pr) return 'no bar';
    flip = -flip;
    const off = (opts.err === undefined ? 80 : opts.err) / (pr.period / 2) * flip;
    pr.t0 = G('performance.now()') -
            Math.max(0.001, Math.min(0.999, pr.center + off)) * pr.period;
    G('lockPour()');
    return s.plots[i] && s.plots[i].stage > before ? 'grew' : 'spilled';
  };
  return { g: g, G: G, s: s, pour: pourOnce };
}

/* ---- what a new gardener is handed ---- */
{
  const b = beginner();
  console.log('  a new garden: ' + b.s.coins + '🪙, ' + b.s.water + ' drops, ' +
    b.s.plotCount + ' beds, level ' + b.s.level);
  const shelf = E('SPECIES').filter(function (sp) { return sp.lvl <= b.s.level; });
  const afford = shelf.filter(function (sp) {
    return b.G('seedCostOf')(sp) <= b.s.coins;
  });
  console.log('  species unlocked: ' + shelf.length + ', of which affordable: ' +
    afford.map(function (sp) { return sp.id + ' ' + b.G('seedCostOf')(sp) + '🪙'; }).join(', '));
  check('a beginner can afford to plant something', afford.length > 0,
        b.s.coins + '🪙 in hand');
  check('and can afford to fill every bed they have',
        afford.length && b.G('seedCostOf')(afford[0]) * b.s.plotCount <= b.s.coins,
        b.G('seedCostOf')(afford[0]) * b.s.plotCount + '🪙 for ' + b.s.plotCount +
        ' against ' + b.s.coins + '🪙');
  /* And the can has to hold enough to finish at least one of them, or the
     first plant is a wall rather than a lesson. */
  const cheap = afford[0];
  const pours = cheap.stages - b.G('timerCeiling')(cheap, null);
  console.log('  the cheapest plant needs ' + pours + ' drops from a can of ' + b.s.water);
  check('and the can holds enough to finish one', b.s.water >= pours,
        b.s.water + ' drops for ' + pours);
}

/* ---- their first hour, played badly ---- */
{
  const b = beginner({ err: 80, hour: 21 });     // an evening player, sloppy
  const sp = E('SPECIES').filter(function (x) {
    return x.lvl <= 1 && b.G('seedCostOf')(x) <= 6;
  })[0] || E('byId').elm;
  for (let i = 0; i < b.s.plotCount; i++) b.G('plant(' + i + ',"' + sp.id + '")');
  const spent = 20 - b.s.coins;
  let spills = 0, grew = 0, dry = 0;
  /* An hour of real time, checking in every ten minutes the way somebody
     fiddling with a new app does. */
  for (let t = 0; t < 6; t++) {
    b.s.offset += 10 * MIN;
    b.G('growthTick()');
    b.G('tickWater()');
    for (let i = 0; i < b.s.plotCount; i++) {
      if (!b.s.plots[i]) continue;
      if (b.s.plots[i].stage >= sp.stages) { b.G('curPlot = ' + i); b.G('harvest()'); continue; }
      const r = b.pour(i);
      if (r === 'spilled') spills++;
      else if (r === 'grew') grew++;
      else if (r === 'dry') dry++;
    }
  }
  const banked = b.G('barnCountAll()');
  console.log('\n  an evening beginner, one hour, tapping 80ms out:');
  console.log('    planted 3 for ' + spent + '🪙 · poured ' + (grew + spills) +
    ' (' + spills + ' spilled) · ' + dry + ' taps on an empty can');
  console.log('    ends with ' + banked + ' in the barn, ' + b.s.coins + '🪙, ' +
    b.s.water + ' drops, ' + b.s.plots.filter(Boolean).length + ' beds growing');

  check('a sloppy beginner still lands most of their drops',
        spills < grew, spills + ' spilled against ' + grew + ' grown');
  check('and is not left with an empty garden after an hour',
        b.s.plots.filter(Boolean).length > 0 || banked > 0,
        banked + ' banked, ' + b.s.plots.filter(Boolean).length + ' growing');
  /* The wall that would end a first session: no coins, no water, no plants.
     A beginner must never be able to reach it in an hour. */
  const stuck = b.s.coins < b.G('seedCostOf')(sp) && b.s.water === 0 &&
                !b.s.plots.filter(Boolean).length && !banked;
  check('and never reaches a dead stop with nothing to do', !stuck,
        b.s.coins + '🪙, ' + b.s.water + ' drops, ' +
        b.s.plots.filter(Boolean).length + ' beds, ' + banked + ' banked');
}

/* ---- the first bloom, and how long it takes ---- */
{
  const b = beginner({ err: 80, hour: 21 });
  const sp = E('byId').elm;
  b.G('plant(0,"elm")');
  let mins = 0, taps = 0;
  while (mins < 8 * 60 && b.G('barnCountAll()') === 0) {
    b.s.offset += 5 * MIN; mins += 5;
    b.G('growthTick()'); b.G('tickWater()');
    if (!b.s.plots[0]) break;
    if (b.s.plots[0].stage >= sp.stages) { b.G('curPlot = 0'); b.G('harvest()'); break; }
    if (b.s.water > 0) { b.pour(0); taps++; }
  }
  const q = b.G('barnCountAll()') ? Object.keys(b.s.barn.elm || {})[0] : '-';
  console.log('\n  their first bloom arrived after ' + mins + ' minutes and ' +
    taps + ' taps, at ★' + q);
  check('a beginner reaches their first harvest', b.G('barnCountAll()') > 0,
        mins + ' minutes');
  check('and it takes minutes rather than an evening', mins <= 90,
        mins + ' minutes');
  /* It should not be a ★★★ — that is what the rest of the game is for — but
     it must be worth more than the seed, or the first thing they learn is
     that growing loses money. */
  const worth = b.G('barnValueAll()');
  const seed = b.G('seedCostOf')(sp);
  console.log('    and it sold for ' + worth + '🪙 against a ' + seed + '🪙 seed');
  check('and the first bloom is worth more than its seed', worth > seed,
        worth + '🪙 against ' + seed + '🪙');
}

/* ---- and nothing they can do in the first hour is unrecoverable ---- */
{
  /* Spend everything, on the worst thing to spend it on, and check the game
     still hands them a way back. */
  const b = beginner();
  b.s.coins = 20;
  const sp = E('byId').elm;
  for (let i = 0; i < b.s.plotCount; i++) b.G('plant(' + i + ',"elm")');
  b.s.coins = 0; b.s.water = 0;
  console.log('\n  a beginner with nothing left: ' + b.s.coins + '🪙, ' +
    b.s.water + ' drops, ' + b.s.plots.filter(Boolean).length + ' beds planted');
  /* Water comes back on its own — that is the whole point of the gate. */
  b.s.offset += 3 * HOUR;
  b.G('tickWater()');
  console.log('  three hours later the can holds ' + b.s.water);
  check('water always comes back on its own', b.s.water > 0, String(b.s.water));
  check('and the clock has grown the beds meanwhile',
        (b.G('growthTick()'), b.s.plots.some(function (p) { return p && p.stage > 0; })),
        b.s.plots.map(function (p) { return p ? p.stage : '-'; }).join(','));
  /* And with no coins at all, an empty bed is still not a dead end: weeds
     clear for nothing and sometimes leave compost. */
  const w = beginner();
  w.s.coins = 0;
  w.s.weeds = { 0: true };
  const compost = w.s.compost;
  w.G('clearWeed(0)');
  console.log('  clearing a weed with no coins: compost ' + compost + ' -> ' + w.s.compost);
  check('and clearing a weed costs nothing', w.s.coins === 0 && !w.s.weeds[0]);
}

/* ---- the empty can has to explain itself ---- */
{
  const b = beginner();
  b.G('plant(0,"elm")');
  b.s.water = 0;
  b.G('curPlot = 0');
  b.G('doAct()');
  /* The toast is an element, not a log: the game writes it into #toast and
     the accessibility live region beside it. Read the element. */
  const toast = b.G('$')('toast').textContent;
  console.log('\n  tapping a plant with an empty can says: "' + (toast || '(nothing)') + '"');
  check('an empty can says so rather than doing nothing', !!toast, String(toast));
  check('and says when the next drop arrives',
        /\d/.test(String(toast)), String(toast));
  check('and no bar opens', !b.G('pour'));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

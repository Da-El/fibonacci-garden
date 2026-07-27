/* Iteration 67: how the game fails.

   The save tests cover a file that is damaged — truncated, not JSON, empty.
   This covers the harder case: a file that is perfectly well-formed and
   describes a garden the game can no longer make sense of. A plot holding a
   species that no longer exists. A barn full of one. An order for one. A
   hybrid whose parents have gone. A plant grown past the last stage its
   species has.

   None of that is hypothetical. Every hybrid in this game is reconstructed
   at boot from the pair of parents recorded in the save, and everything that
   references one references it by an id that only exists if that
   reconstruction worked. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const STORE = 'fibgarden.v2';

/* Boot with a given save and report whether the game came up alive. */
function bootWith(save) {
  let h = null, threw = null;
  try {
    h = H.build({ preload: (function () { const o = {}; o[STORE] = JSON.stringify(save); return o; })() });
  } catch (e) { threw = e; }
  if (threw) return { threw: threw };
  const E = h.evalIn; const s = E('state');
  return {
    h: h, E: E, s: s, threw: null,
    playable: function () {
      return s.coins >= 0 && Array.isArray(s.plots) &&
             s.plots.length >= s.plotCount && isFinite(s.water);
    }
  };
}

/* A save that was fine when it was written. */
function goodSave() {
  return {
    coins: 4000, water: 20, canTier: 2, plotCount: 9, level: 12,
    plots: [{ s: 'elm', stage: 2, q: 1, stageAt: 0 },
            { s: 'sunflower', stage: 4, q: 3, stageAt: 0 }, null,
            null, null, null, null, null, null],
    barn: { elm: { 1: 3, 3: 2 }, sunflower: { 2: 1 } },
    orders: [], orderN: 3, golden: 1, runEarned: 900, prestiges: 0,
    almanac: { elm: 3 }, discovered: { elm: true }, ach: {},
    trellised: [false, false, false, false, false, false, false, false, false],
    glassed: [false, false, false, false, false, false, false, false, false],
    weeds: [0, 0, 0, 0, 0, 0, 0, 0, 0], hybrids: {}, lastSeen: 0
  };
}

/* ---- the control: a good save must come up untouched ---- */
{
  const g = bootWith(goodSave());
  check('a sound save boots', !g.threw, g.threw && g.threw.message);
  if (!g.threw) {
    /* Coins can rise on load: checkAch pays out anything a migrated save
       already qualifies for, which is correct and is why save-check accounts
       for it too. What may not change is the garden. */
    check('and nothing in it is thrown away',
          g.s.coins >= 4000 && g.s.plotCount === 9 &&
          g.s.plots.filter(Boolean).length === 2,
          'coins ' + g.s.coins + ' plots ' + g.s.plots.filter(Boolean).length);
  }
}

/* ---- a garden the game can no longer read ---- */
{
  const CASES = [
    ['a plot holds a species that no longer exists', function (sv) {
      sv.plots[0] = { s: 'moonflower', stage: 3, q: 2, stageAt: 0 };
    }],
    ['a plot holds a hybrid whose parents are gone', function (sv) {
      sv.plots[0] = { s: 'hy_ghost_phantom', stage: 3, q: 2, stageAt: 0 };
    }],
    ['the barn holds a species that no longer exists', function (sv) {
      sv.barn.moonflower = { 1: 5, 3: 2 };
    }],
    ['a hybrid names a parent that is gone', function (sv) {
      sv.hybrids = { hy_elm_moonflower: { a: 'elm', b: 'moonflower' } };
    }],
    ['a hybrid names itself as its own parent', function (sv) {
      sv.hybrids = { hy_elm_elm: { a: 'elm', b: 'elm' } };
    }],
    ['an order asks for a species that is gone', function (sv) {
      sv.orders = [{ s: 'moonflower', n: 2, stars: 2, pay: 400, exp: 1e15 }];
    }],
    ['a plant is grown past its own last stage', function (sv) {
      sv.plots[0] = { s: 'elm', stage: 99, q: 4, stageAt: 0 };
    }],
    ['a plant has a negative stage', function (sv) {
      sv.plots[0] = { s: 'elm', stage: -5, q: -3, stageAt: 0 };
    }],
    ['a plot entry is not an object at all', function (sv) {
      sv.plots[0] = 'elm';
    }],
    ['the water is not a number', function (sv) { sv.water = 'lots'; }],
    ['the level is beyond anything the game has', function (sv) { sv.level = 9999; }],
    ['more beds than the game allows', function (sv) { sv.plotCount = 400; }],
    ['the barn count is negative', function (sv) { sv.barn.elm = { 1: -20 }; }],
    ['every array is one entry short', function (sv) {
      sv.trellised = [false]; sv.glassed = [false]; sv.weeds = [0];
    }],
    ['the save was written by a later version', function (sv) {
      sv.v = 999; sv.somethingNew = { nested: [1, 2, 3] }; sv.plots[0].futureField = true;
    }]
  ];

  console.log('  a well-formed save describing an impossible garden:');
  CASES.forEach(function (c) {
    const sv = goodSave();
    c[1](sv);
    const g = bootWith(sv);
    if (g.threw) {
      console.log('    ' + c[0].padEnd(48) + 'THREW ' + g.threw.message.slice(0, 40));
      check(c[0] + ' does not stop the game booting', false, g.threw.message);
      return;
    }
    /* Booting is not enough: the garden has to be usable afterwards, and the
       screens that read it must not throw when they meet the bad entry. */
    let paintErr = null;
    ['paintPlots', 'paintTop', 'paintMarket', 'paintShop', 'paintAlmanac',
     'paintJournal', 'catchUpWithLedger'].forEach(function (fn) {
      if (paintErr) return;
      try { g.E(fn + '()'); } catch (e) { paintErr = fn + ': ' + e.message; }
    });
    const alive = g.playable();
    console.log('    ' + c[0].padEnd(48) +
      (paintErr ? 'PAINT ' + paintErr.slice(0, 40) : alive ? 'survives' : 'unplayable'));
    check(c[0] + ' does not stop the game booting', true);
    check('  and the garden is still usable after it', alive,
          'coins ' + g.s.coins + ' water ' + g.s.water + ' plots ' + g.s.plotCount);
    check('  and every screen still draws', !paintErr, paintErr);
  });
}

/* ---- and nothing bad may be left behind to poison later frames ---- */
{
  /* Surviving the boot is half of it. If the dead reference is still sitting
     in the save, it comes back on the next frame, and the next. */
  const sv = goodSave();
  sv.plots[0] = { s: 'moonflower', stage: 3, q: 2, stageAt: 0 };
  sv.barn.moonflower = { 1: 5 };
  const g = bootWith(sv);
  if (!g.threw) {
    g.E('paintPlots()'); g.E('paintMarket()');
    const stillThere = g.s.plots[0] && g.s.plots[0].s === 'moonflower';
    const inBarn = !!(g.s.barn && g.s.barn.moonflower);
    console.log('\n  after a frame: the dead plant is ' +
      (stillThere ? 'still in the bed' : 'cleared') + ', the dead stock is ' +
      (inBarn ? 'still in the barn' : 'cleared'));
    /* Either it is cleaned up or it is inert — what it may not do is make
       the value of the barn or the picture of the garden nonsense. */
    const v = g.E('barnValueAll()');
    check('a dead species cannot make the barn worth a nonsense amount',
          isFinite(v) && v >= 0, String(v));
    const n = g.E('barnCountAll()');
    check('nor make the count nonsense', isFinite(n) && n >= 0, String(n));
    let threw = null;
    try { g.E('sellAll()'); } catch (e) { threw = e; }
    check('and selling the barn with a dead species in it does not throw',
          !threw, threw && threw.message);
    check('and leaves the coins a real number',
          isFinite(g.s.coins) && g.s.coins >= 0, String(g.s.coins));
  }
}

/* ---- a screen that throws must not take the game with it ---- */
{
  /* The once-a-second tick paints. If one paint throws, everything after it
     in that tick is skipped — growth, wages, the apprentice. The question is
     whether the next tick recovers or the game is dead until reload. */
  const g = bootWith(goodSave());
  const tick = g.h.intervals.filter(function (t) { return t.ms === 1000; })[0];
  check('there is a heartbeat', !!tick);
  if (tick) {
    let first = null;
    try { tick.fn(); } catch (e) { first = e; }
    check('a normal tick does not throw', !first, first && first.message);

    /* Break a plant mid-flight, the way a bad frame would. */
    g.s.plots[1] = { s: 'notaplant', stage: 2, q: 1, stageAt: 0 };
    let broke = null;
    try { tick.fn(); } catch (e) { broke = e; }
    check('a tick that meets a broken plant does not throw',
          !broke, broke && broke.message);
    g.s.plots[1] = null;
    let after = null;
    try { tick.fn(); } catch (e) { after = e; }
    check('and the heartbeat keeps going afterwards', !after, after && after.message);
  }
}

/* ---- and nothing anywhere may throw on a garden it cannot read ----
   forgetTheUnknown() clears a dead reference at boot, so in practice one
   should never be met at runtime. This asks the harder question anyway:
   if one did appear — from a bug not yet found, a half-written save, a
   future migration — how much of the game would it take down?

   Every function in the game that takes no arguments, called against a
   garden holding a plant that does not exist. Eight of a hundred and
   forty-seven threw the first time this ran. */
{
  const sv = goodSave();
  const g = bootWith(sv);
  /* Injected after the boot rescue, on purpose: this is about what survives
     a bad entry appearing, not about the rescue. */
  g.s.plots[1] = { s: 'ghostplant', stage: 3, q: 2, stageAt: 0 };
  g.s.barn.ghostplant = { 3: 4 };
  g.s.orders.push({ s: 'ghostplant', n: 2, stars: 2, pay: 400, exp: 1e15 });
  g.s.almanac.ghostplant = 2;

  const src = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const names = [];
  const re = /^function ([a-zA-Z][a-zA-Z0-9_]*)\(\s*\)/gm;
  let m;
  while ((m = re.exec(src))) if (names.indexOf(m[1]) < 0) names.push(m[1]);

  /* Two of these genuinely need a context to be called in: the pour marker
     wants a pour in flight and starting one wants an open plot. Asking them
     out of context is the fuzz being unfair, not the game being fragile. */
  const NEEDS_CONTEXT = ['markerPos', 'startPour', 'lockPour', 'cancelPour'];
  const broke = [];
  names.forEach(function (fn) {
    if (NEEDS_CONTEXT.indexOf(fn) > -1) return;
    try { g.E(fn + '()'); } catch (e) { broke.push(fn + ': ' + e.message.slice(0, 45)); }
  });
  console.log('\n  ' + names.length + ' functions called against a garden holding a lost plant');
  console.log('  threw: ' + (broke.length ? broke.join(' | ') : 'none'));
  check('nothing in the game throws on a bed it cannot read',
        !broke.length, broke.join(' | '));
  /* And the thing that matters most: whatever happened, the coins are still
     a number. A NaN there is a save nobody can recover. */
  check('and the coins are still a real number after all of it',
        isFinite(g.s.coins) && g.s.coins >= 0, String(g.s.coins));
  check('and so is the water', isFinite(g.s.water) && g.s.water >= 0, String(g.s.water));
}

/* ---- a save the game writes must be one the game can read ---- */
{
  /* The strongest form of this: play, save, reload, and nothing is lost or
     made impossible. If the game can write a state it cannot read, that is a
     lost garden and there is no recovering from it. */
  const g = bootWith(goodSave());
  g.s.offset = 0;
  g.E('hireApprentice()');
  const hy = g.E('makeHybrid')('elm', 'beech');
  if (hy) {
    g.s.hybrids = g.s.hybrids || {};
    g.s.hybrids[hy.id] = { a: 'elm', b: 'beech' };
    g.E('registerHybrids()');
    g.s.plots[2] = { s: hy.id, stage: 2, q: 1, stageAt: g.E('NOW()') };
    g.s.barn[hy.id] = { 3: 2 };
  }
  g.E('saveState()');
  const raw = g.h.store[STORE];
  check('the game writes a save', !!raw, 'nothing written');

  const back = bootWith(JSON.parse(raw));
  check('and can read back what it just wrote', !back.threw,
        back.threw && back.threw.message);
  if (!back.threw) {
    console.log('\n  round trip with a cross planted and stocked: ' +
      'plots ' + back.s.plots.filter(Boolean).length +
      ', barn ' + back.E('barnCountAll()') +
      ', hybrids ' + Object.keys(back.s.hybrids || {}).length);
    check('the cross is still a real species after a reload',
          !hy || !!back.E('byId')[hy.id], 'byId lost ' + (hy && hy.id));
    check('the bed it was planted in still holds it',
          !hy || (back.s.plots[2] && back.s.plots[2].s === hy.id));
    check('and the barn can still be valued',
          isFinite(back.E('barnValueAll()')), String(back.E('barnValueAll()')));
    let threw = null;
    try { back.E('paintPlots()'); back.E('paintMarket()'); back.E('paintAlmanac()'); }
    catch (e) { threw = e; }
    check('and every screen draws it', !threw, threw && threw.message);
  }
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

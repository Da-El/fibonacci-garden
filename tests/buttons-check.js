/* Iteration 78: every button this game writes, pressed until it stops
   giving.

   Iteration 74 found the daily gift paying out twice because the claim had
   no guard of its own — closing the card hides the button but does not
   destroy it. That is a shape, not an incident: a button is a thing that
   can be pressed again, and every purchase, claim and confirmation in this
   game is one. None of them had ever been pressed twice by anything. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* Nothing anywhere may leave the garden in a state the game cannot make. */
function impossible(E) {
  const s = E('state');
  const bad = [];
  if (!isFinite(s.coins) || s.coins < 0) bad.push('coins ' + s.coins);
  if (!isFinite(s.water) || s.water < 0) bad.push('water ' + s.water);
  if (s.water > E('waterCap()')) bad.push('water ' + s.water + ' over a cap of ' + E('waterCap()'));
  if (!isFinite(s.compost) || s.compost < 0) bad.push('compost ' + s.compost);
  if (s.plotCount > E('MAX_PLOTS') || s.plotCount < E('START_PLOTS')) bad.push('beds ' + s.plotCount);
  if (s.canTier < 0 || s.canTier > E('CAN_TIERS').length - 1) bad.push('can tier ' + s.canTier);
  if (!isFinite(s.golden) || s.golden < 0) bad.push('golden ' + s.golden);
  if (!isFinite(s.level) || s.level < 1) bad.push('level ' + s.level);
  if (s.plots.length !== s.plotCount) bad.push('plots ' + s.plots.length + ' for ' + s.plotCount + ' beds');
  return bad;
}

function press(el, times) {
  for (let i = 0; i < (times || 1); i++) {
    el.dispatchEvent({ type: 'click', target: el, currentTarget: el,
      stopPropagation: function () {}, preventDefault: function () {} });
  }
}

/* A gardener who can afford anything, so a refusal is a real refusal rather
   than simply being broke. */
function rich() {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 400000; s.level = 16; s.runEarned = 90000;
  h.doc.getElementById('scene').clientWidth = 390;
  h.doc.getElementById('bed').clientWidth = 390;
  h.doc.getElementById('bed').clientHeight = 200;
  return { h: h, E: E, s: s };
}

/* ---- press everything, twice, and see what survives ---- */
{
  const SCREENS = [
    ['the shop',      'paintShop'],
    ['the market',    'paintMarket'],
    ['the settings',  'openSettings'],
    ['the keepsake',  'openKeepsake'],
    ['the breeder',   'openBreeder'],
    ['the postcard',  'openPostcard'],
    ['the planter',   'openPlanter(0)'],
    ['the daily row', 'paintDailyRow'],
    ['the journal',   'paintJournal'],
    ['the almanac',   'paintAlmanac']
  ];
  const broken = [], threw = [];
  let pressed = 0;
  SCREENS.forEach(function (sc) {
    const g = rich();
    try { g.E(sc[1].indexOf('(') > 0 ? sc[1] : sc[1] + '()'); } catch (e) {
      threw.push(sc[0] + ' would not open: ' + e.message.slice(0, 40));
      return;
    }
    /* Every element that has a click handler on it, anywhere on the screen. */
    const ids = Object.keys(g.h.ids);
    ids.forEach(function (id) {
      const el = g.h.doc.getElementById(id);
      if (!el || !el.listenerCount || !el.listenerCount('click')) return;
      let err = null;
      try { press(el, 3); } catch (e) { err = e; }
      pressed++;
      if (err) { threw.push(sc[0] + '/#' + id + ': ' + err.message.slice(0, 40)); return; }
      const bad = impossible(g.E);
      if (bad.length) broken.push(sc[0] + '/#' + id + ' -> ' + bad.join(', '));
    });
  });
  console.log('  pressed ' + pressed + ' buttons three times each across ' +
              SCREENS.length + ' screens');
  check('no button in the game throws when pressed', !threw.length, threw.slice(0, 3).join(' | '));
  check('and none of them can leave the garden in a state that cannot exist',
        !broken.length, broken.slice(0, 3).join(' | '));
}

/* ---- and the ones that must fire once must fire once ---- */
{
  /* The gift is the one this sweep was written for, and it is fixed. These
     are the others of the same kind: a thing that is claimed rather than
     bought, where a second press is a second payout. */
  const g = rich();
  g.E('checkDailyGift()');
  const gift = g.h.doc.getElementById('c-gift');
  if (gift && gift.listenerCount('click')) {
    press(gift, 1);
    const after = { coins: g.s.coins, compost: g.s.compost, day: g.s.lastGiftDay };
    press(gift, 6);
    console.log('\n  the daily gift, pressed seven times: ' +
      after.coins + ' -> ' + g.s.coins + ' coins');
    check('the daily gift pays exactly once however often it is pressed',
          g.s.coins === after.coins && g.s.compost === after.compost,
          after.coins + ' -> ' + g.s.coins);
  }

  /* Replanting: the button is behind a confirmation, and pressing the
     confirmation twice must not take two gardens away. */
  const p = rich();
  p.s.plotCount = 9;
  while (p.s.plots.length < 9) p.s.plots.push(null);
  p.E('paintShop()');
  const btn = p.h.doc.getElementById('prestigeBtn');
  if (btn && btn.listenerCount('click')) {
    press(btn, 1);
    const go = p.h.doc.getElementById('c-go');
    if (go && go.listenerCount('click')) {
      const seedsBefore = p.s.golden;
      const claim = p.E('claimableGolden()');
      press(go, 5);
      /* Read the state again rather than through the reference taken before.
         doPrestige does `state = freshState()` — it replaces the object
         wholesale — so anything held across it is looking at the garden
         that was thrown away, which is how this first reported that
         replanting five times did nothing at all. */
      const after = p.E('state');
      console.log('  replanting, confirmed five times: ' + seedsBefore + ' -> ' +
        after.golden + ' seeds for a claim of ' + claim);
      check('replanting five times over pays for one replant',
            after.golden <= seedsBefore + claim + 1,
            seedsBefore + ' + ' + claim + ' -> ' + after.golden);
      check('and it really did replant', after.golden > seedsBefore,
            seedsBefore + ' -> ' + after.golden);
      check('and leaves one garden, not none',
            after.plotCount === p.E('START_PLOTS'), String(after.plotCount));
    }
  }
}

/* ---- a purchase pressed twice buys twice, and stops when it should ---- */
{
  /* The opposite failure: a button that refuses a legitimate second press.
     Beds and cans are meant to be bought repeatedly, right up to the end. */
  const g = rich();
  g.E('paintShop()');
  const buyPlot = g.h.doc.getElementById('buyplot');
  if (buyPlot && buyPlot.listenerCount('click')) {
    press(buyPlot, 20);
    console.log('\n  the bed button pressed twenty times: ' + g.s.plotCount + ' beds');
    check('buying beds works repeatedly and stops at the last one',
          g.s.plotCount === g.E('MAX_PLOTS'), String(g.s.plotCount));
  }
  const buyCan = g.h.doc.getElementById('buycan');
  if (buyCan && buyCan.listenerCount('click')) {
    press(buyCan, 20);
    console.log('  the can button pressed twenty times: tier ' + g.s.canTier +
                ' of ' + (g.E('CAN_TIERS').length - 1) + ', holding ' + g.E('waterCap()'));
    check('and the can fills up to the biggest and no further',
          g.s.canTier === g.E('CAN_TIERS').length - 1, String(g.s.canTier));
  }
  check('and the garden is still coherent afterwards', !impossible(g.E).length,
        impossible(g.E).join(', '));
}

/* ---- and a poor gardener may not buy anything at all ---- */
{
  const g = rich();
  g.s.coins = 0;
  g.E('paintShop()');
  const before = {
    beds: g.s.plotCount, can: g.s.canTier, compost: g.s.compost,
    hive: g.s.hiveLevel | 0, app: g.s.appLevel | 0
  };
  ['buyplot', 'buycan', 'buycompost', 'buyhive', 'hireapp'].forEach(function (id) {
    const el = g.h.doc.getElementById(id);
    if (el && el.listenerCount && el.listenerCount('click')) press(el, 3);
  });
  console.log('\n  with no coins: ' + g.s.plotCount + ' beds, can tier ' + g.s.canTier +
    ', ' + g.s.compost + ' compost, hive ' + (g.s.hiveLevel | 0));
  check('nothing can be bought with nothing',
        g.s.plotCount === before.beds && g.s.canTier === before.can &&
        g.s.compost === before.compost && (g.s.hiveLevel | 0) === before.hive &&
        (g.s.appLevel | 0) === before.app,
        JSON.stringify(before) + ' -> beds ' + g.s.plotCount + ' can ' + g.s.canTier);
  check('and the coins never go below nothing', g.s.coins >= 0, String(g.s.coins));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

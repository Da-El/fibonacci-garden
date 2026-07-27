/* Iteration 75: two systems that hand you something for nothing — the
   ladybird that wanders across the screen, and the compost that skips a
   stage without a drop.

   Neither has ever been measured. A free thing is the easiest place in a
   game to put a number nobody checks, and the ladybird's was a tenth of
   your barn with no ceiling on it. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;

function garden(level) {
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = level || 1; s.coins = 500;
  return { h: g, E: G, s: s };
}
/* The first slot that produces each kind of boon, so all four can be driven. */
function slotFor(G, kind) {
  for (let slot = 0; slot < 400; slot++) {
    if (G('hash32')((slot * 7 + 3) >>> 0) % 4 === kind) return slot;
  }
  return -1;
}

/* ---- all four boons must exist and give something ---- */
{
  const g = garden(8);
  const seen = [];
  for (let kind = 0; kind < 4; kind++) {
    const slot = slotFor(g.E, kind);
    check('boon ' + kind + ' is reachable', slot >= 0);
    if (slot < 0) continue;
    const before = { coins: g.s.coins, compost: g.s.compost,
                     water: g.s.water, fever: g.s.feverUntil };
    const msg = g.E('ladyBoon')(slot);
    const moved = g.s.coins !== before.coins || g.s.compost !== before.compost ||
                  g.s.water !== before.water || g.s.feverUntil !== before.fever;
    seen.push(msg);
    check('and it actually gives something', moved, msg);
    check('and says what it gave', !!msg && msg.length > 2, msg);
  }
  console.log('  the four boons: ' + seen.join(' · '));
  check('no two boons are the same', new Set(seen).size === seen.length, seen.join(' | '));

  /* And none of them may be worth nothing in the state you are most likely
     to be in when you tap it. The water boon used to be a flat min() against
     the cap, so a full can turned it into no water at all — and it said "+5
     water 💧" while giving none. */
  const full = garden(8);
  full.s.water = full.E('waterCap()');
  const c0 = full.s.coins;
  const msg = full.E('ladyBoon')(slotFor(full.E, 2));
  console.log('  tapped with a full can: "' + msg + '" (coins ' + c0 + ' -> ' + full.s.coins + ')');
  check('the water boon is worth something even with a full can',
        full.s.coins > c0, msg);
  check('and says what it really gave', msg.indexOf('🪙') > -1, msg);

  /* Half full: some water, some coins, and both reported. */
  const half = garden(8);
  half.s.water = half.E('waterCap()') - 2;
  const before = { w: half.s.water, c: half.s.coins };
  const m2 = half.E('ladyBoon')(slotFor(half.E, 2));
  check('and a part-full can takes what fits and pays for the rest',
        half.s.water === half.E('waterCap()') && half.s.coins > before.c, m2);
  check('and never spills over the top of the can',
        half.s.water <= half.E('waterCap()'),
        half.s.water + ' of ' + half.E('waterCap()'));
}

/* ---- the coin boon must not be farmable ---- */
{
  /* It pays out in coins and leaves the stock alone, so a player who hoards
     instead of selling can tap a bug twice an hour for a tenth of everything
     they own, indefinitely. Uncapped, a barn of 9,600 blooms turned one tap
     into 200,705 coins — thirteen hundred times the next best boon. */
  const rows = [];
  [[1, 0], [1, 20], [8, 300], [16, 2000], [16, 40000]].forEach(function (c) {
    const g = garden(c[0]);
    g.s.barn = { elm: { 2: c[1] } };
    const worth = g.E('barnValueAll()');
    const slot = slotFor(g.E, 0);
    g.s.coins = 0;
    g.E('ladyBoon')(slot);
    rows.push({ lvl: c[0], barn: worth, paid: g.s.coins });
  });
  console.log('\n  the coin boon:   level  barn worth   pays');
  rows.forEach(function (r) {
    console.log('                   ' + String(r.lvl).padStart(5) +
      String(r.barn).padStart(12) + String(r.paid).padStart(7));
  });
  const huge = rows[rows.length - 1], big = rows[rows.length - 2];
  check('a hoarded barn does not pay more than a working one',
        huge.paid === big.paid, huge.paid + ' vs ' + big.paid);
  check('and no single tap is worth more than a few good blooms',
        huge.paid < 4000, String(huge.paid));
  /* But it still has to grow with the garden, or it is a rounding error by
     the second week. */
  check('and it still grows with what you can grow',
        rows[rows.length - 1].paid > rows[0].paid * 10,
        rows[0].paid + ' -> ' + rows[rows.length - 1].paid);
  check('and it is never nothing', rows.every(function (r) { return r.paid > 0; }));
}

/* ---- how often one turns up ---- */
{
  const g = garden(8);
  let seen = 0;
  const SLOTS = 288;                       // a full day of five-minute slots
  for (let slot = 0; slot < SLOTS; slot++) {
    if (g.E('hash32')((slot * 97 + 41) >>> 0) % 100 < 18) seen++;
  }
  const everyMin = SLOTS * 5 / Math.max(1, seen);
  console.log('\n  a ladybird every ' + everyMin.toFixed(0) +
              ' minutes of play (' + seen + ' in a day of slots)');
  /* Often enough to be a thing that happens, rare enough to be lucky. */
  check('a ladybird is not constant', everyMin >= 15, everyMin.toFixed(0) + ' min');
  check('and not so rare nobody ever sees one', everyMin <= 60, everyMin.toFixed(0) + ' min');
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('the perk that makes them commoner really does',
        html.indexOf("hasPerk('ladymagnet') ? 36 : 18") > -1);
  check('and so does the bird bath', html.indexOf("hasDeco('bath')") > -1);
  check('and only one is ever on screen',
        html.indexOf("document.getElementById('ladybug')") > -1);
}

/* ---- compost: what it does and what it costs ---- */
{
  const g = garden(8);
  g.s.coins = 500;
  g.E('plant(0,"elm")');
  g.E('curPlot = 0');
  g.s.compost = 3;
  const p = g.s.plots[0];
  const stage = p.stage, q = p.q, water = g.s.water;
  g.E('doCompost()');
  console.log('\n  one compost: stage ' + stage + ' -> ' + g.s.plots[0].stage +
    ', care ' + q + ' -> ' + g.s.plots[0].q + ', water ' + water + ' -> ' + g.s.water +
    ', compost 3 -> ' + g.s.compost);
  check('compost advances a stage', g.s.plots[0].stage === stage + 1,
        stage + ' -> ' + g.s.plots[0].stage);
  check('and costs no water', g.s.water === water, water + ' -> ' + g.s.water);
  check('and one piece of compost', g.s.compost === 2, String(g.s.compost));
  /* The shop says "no care point — watering with love beats shortcuts", and
     that has to be true or the shop is lying about the only reason not to
     use it. */
  check('and earns no care, exactly as the shop says',
        g.s.plots[0].q === q, q + ' -> ' + g.s.plots[0].q);
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('and the shop says so where you buy it',
        html.indexOf('no care point') > -1);
}

/* ---- and it cannot be spent on nothing ---- */
{
  const g = garden(8);
  g.s.coins = 500;
  g.E('plant(0,"elm")');
  g.E('curPlot = 0');
  g.s.plots[0].stage = g.E('byId')['elm'].stages;      // ripe
  g.s.compost = 3;
  g.E('doCompost()');
  check('compost cannot be spent on a plant that is already ripe',
        g.s.compost === 3, String(g.s.compost));

  g.s.plots[0].stage = 1;
  g.s.compost = 0;
  const before = g.s.plots[0].stage;
  g.E('doCompost()');
  check('and cannot be spent when you have none',
        g.s.plots[0].stage === before && g.s.compost === 0,
        'stage ' + g.s.plots[0].stage + ' compost ' + g.s.compost);
  check('and never goes negative', g.s.compost >= 0, String(g.s.compost));

  g.s.plots[0] = null;
  let threw = null;
  try { g.E('doCompost()'); } catch (e) { threw = e; }
  check('and an empty bed does not throw', !threw, threw && threw.message);
}

/* ---- is it ever worth buying? ---- */
{
  const price = 45 / 3;                              // the shop sells three for 45
  const rows = E('SPECIES').map(function (sp) {
    return { id: sp.id, per: (sp.price * E('STAR_MULT')[2] - sp.seed) / sp.stages };
  });
  const worth = rows.filter(function (r) { return r.per > price; });
  console.log('\n  compost costs ' + price + '🪙 a piece; a drop is worth ' +
    rows[0].per.toFixed(1) + ' on an elm and ' +
    rows[rows.length - 1].per.toFixed(1) + ' on a pineapple');
  console.log('  species where a compost pays for itself in coins alone: ' +
    worth.map(function (r) { return r.id; }).join(', '));
  /* It is not really a coin trade — it buys thirteen minutes of not waiting,
     at the price of the care point that stage would have earned. But it must
     pay for itself somewhere, or it is a button nobody should ever press. */
  check('compost is worth its price on the top of the shelf',
        worth.length >= 2, worth.length + ' of ' + rows.length);
  check('and is not worth it on the bottom, which is what makes it a choice',
        worth.length <= rows.length - 4, worth.length + ' of ' + rows.length);
}

/* ---- and the fever boon must not undo the fever rule ---- */
{
  const g = garden(8);
  const slot = slotFor(g.E, 3);
  g.E('ladyBoon')(slot);
  check('the fever boon starts fever', g.E('feverActive()'));
  /* Iteration 72 froze the combo while fever runs, so that each fever is
     built from cold. A ladybird handing out fever must not become a way to
     stack them either. */
  const until = g.s.feverUntil;
  g.E('ladyBoon')(slot);
  const gained = g.s.feverUntil - until;
  console.log('\n  a second ladybird during fever adds ' + Math.round(gained / 1000) + 's');
  check('and a second one extends it rather than restarting it',
        gained > 0 && gained <= 40000, Math.round(gained / 1000) + 's');
  check('and fever still ends', (function () {
    g.s.offset += 10 * 60000;
    return !g.E('feverActive()');
  })());
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

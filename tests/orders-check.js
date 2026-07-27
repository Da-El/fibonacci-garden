/* Iteration 80: three offers on the board at all times, and across a
   hundred days a garden delivered six of them.

   That number looks like a broken system and is not one — the board is a
   rolling shop window that replaces whatever lapses, so most of what
   "expires" was never accepted. The real question is different and harder:
   is an order ever worth changing what you plant for, and if it is not,
   does the game say so? */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SEEDS = [11, 22, 33, 44];

/* ---- the shape of an offer ---- */
{
  const s = E('state');
  s.offset = 0; s.level = 16;
  const rows = [];
  for (let n = 0; n < 400; n++) {
    const o = E('makeOrder')(n);
    const sp = E('byId')[o.s];
    rows.push({
      sp: sp, qty: o.qty, stars: o.stars, pay: o.pay,
      market: E('tierPrice')(sp, o.stars) * o.qty,
      hours: (o.exp - E('NOW()')) / 3600000,
      growH: E('timerCeiling')(sp) * sp.growMin / 60
    });
  }
  const prem = rows.reduce(function (t, r) { return t + r.pay / r.market; }, 0) / rows.length;
  const hrs = rows.map(function (r) { return r.hours; });
  console.log('  400 offers at level 16:');
  console.log('    premium over the market: ×' + prem.toFixed(2));
  console.log('    deadlines ' + Math.min.apply(null, hrs).toFixed(0) + 'h to ' +
              Math.max.apply(null, hrs).toFixed(0) + 'h');
  check('an order pays well over the market', prem > 1.4, '×' + prem.toFixed(2));
  check('but not so much that nothing else is worth selling', prem < 4,
        '×' + prem.toFixed(2));
  /* Every offer must be growable inside its own deadline, or it is a
     shop window full of things nobody could ever hand over. */
  const impossible = rows.filter(function (r) { return r.hours < r.growH; });
  check('every offer can be grown inside its own deadline',
        !impossible.length, impossible.length + ' of ' + rows.length);
  check('and none of them expires the same hour it appears',
        Math.min.apply(null, hrs) >= 4, Math.min.apply(null, hrs).toFixed(1) + 'h');

  /* And customers must ask for things you are actually growing. Drawing
     from the whole unlocked shelf meant most offers were for plants you had
     left behind five levels ago. */
  const asked = {};
  rows.forEach(function (r) { asked[r.sp.id] = 1; });
  const unlocked = E('SPECIES').filter(function (x) { return x.lvl <= 16; });
  const lowHalf = unlocked.slice(0, Math.floor(unlocked.length / 2))
    .filter(function (x) { return asked[x.id]; });
  console.log('    species asked for: ' + Object.keys(asked).length + ' of ' +
    unlocked.length + ' unlocked, ' + lowHalf.length + ' of them from the bottom half');
  check('customers ask for the best things you can grow',
        lowHalf.length === 0, lowHalf.map(function (x) { return x.id; }).join(', '));
  check('and for more than one of them', Object.keys(asked).length >= 3,
        String(Object.keys(asked).length));
}

/* ---- and a beginner must be offered something they can grow ---- */
{
  const g = H.build(); const G = g.evalIn; const gs = G('state');
  gs.offset = 0; gs.level = 1;
  const early = [];
  for (let n = 0; n < 60; n++) {
    const o = G('makeOrder')(n);
    early.push(G('byId')[o.s]);
  }
  const locked = early.filter(function (sp) { return sp.lvl > 1; });
  console.log('\n  at level 1, ' + new Set(early.map(function (x) { return x.id; })).size +
              ' different species asked for, ' + locked.length + ' of them not yet unlocked');
  check('a beginner is never asked for a plant they cannot grow',
        !locked.length, locked.slice(0, 3).map(function (x) { return x.id; }).join(', '));
}

/* ---- delivering must take the stock and pay the price ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16; s.coins = 100;
  const o = G('makeOrder')(7);
  s.orders = [o];
  const sp = G('byId')[o.s];
  s.barn[o.s] = {}; s.barn[o.s][o.stars] = o.qty + 2;
  /* Settle what this state already owes before measuring. Delivering runs
     checkAch, and a level-16 gardener with no deliveries owes both "Master
     gardener" and "First delivery" — 350 coins that are nothing to do with
     the order and would be read as part of its price. */
  G('ACHIEVEMENTS').forEach(function (a) {
    try { if (a.test(s)) s.ach[a.id] = true; } catch (e) {}
  });
  s.ach.o1 = true;                        // the one this very delivery earns
  const before = { coins: s.coins, stock: G('barnCountAll()'), done: s.ordersDelivered | 0 };
  G('deliverOrder(0)');
  console.log('\n  delivering ' + o.qty + '× ' + sp.name + ' at ★' + o.stars +
    ': ' + before.coins + ' -> ' + s.coins + '🪙, stock ' + before.stock + ' -> ' +
    G('barnCountAll()'));
  check('delivering pays what was offered', s.coins === before.coins + o.pay,
        before.coins + ' + ' + o.pay + ' = ' + s.coins);
  check('and takes exactly what was asked for',
        G('barnCountAll()') === before.stock - o.qty,
        before.stock + ' -> ' + G('barnCountAll()'));
  check('and counts the delivery', (s.ordersDelivered | 0) === before.done + 1);
  check('and the board fills the empty slot', s.orders.length === 3,
        String(s.orders.length));

  /* And it must refuse when the stock is not there. */
  const p = H.build(); const P = p.evalIn; const ps = P('state');
  ps.offset = 0; ps.level = 16; ps.coins = 100;
  const o2 = P('makeOrder')(7);
  ps.orders = [o2];
  ps.barn[o2.s] = {}; ps.barn[o2.s][o2.stars] = Math.max(0, o2.qty - 1);
  const coins = ps.coins;
  P('deliverOrder(0)');
  check('an order cannot be delivered short', ps.coins === coins,
        coins + ' -> ' + ps.coins);
  /* Nor with blooms below the quality asked for. */
  const q = H.build(); const Q = q.evalIn; const qs = Q('state');
  qs.offset = 0; qs.level = 16; qs.coins = 100;
  const o3 = Q('makeOrder')(13);
  if (o3.stars > 1) {
    qs.orders = [o3];
    qs.barn[o3.s] = { 1: o3.qty + 3 };            // plenty, but all one-star
    const c3 = qs.coins;
    Q('deliverOrder(0)');
    check('nor with blooms below the quality asked for', qs.coins === c3,
          c3 + ' -> ' + qs.coins);
  }
}

/* ---- what the board is actually worth, three ways ---- */
{
  /* Averaged over four seeds, because the run is chaotic and the effect
     being looked for is a few per cent. */
  function mean(mode) {
    let delivered = 0, earned = 0;
    SEEDS.forEach(function (seed) {
      const r = S.run({ seed: seed, profile: 'diligent', realPour: true,
                        tapError: 30, days: 21, forOrders: mode });
      delivered += r.ordersPaid; earned += r.earned;
    });
    return { delivered: delivered / SEEDS.length, earned: earned / SEEDS.length };
  }
  const ignore = mean(false), one = mean('one'), all = mean(true);
  console.log('\n  three weeks, averaged over ' + SEEDS.length + ' seeds:');
  [['fill only what you happen to have', ignore],
   ['plant for the best offer', one],
   ['plant for all three', all]].forEach(function (r) {
    console.log('    ' + r[0].padEnd(34) + r[1].delivered.toFixed(1).padStart(6) +
      ' delivered' + Math.round(r[1].earned).toString().padStart(10) + '🪙');
  });

  check('a garden that never plants for the board still fills some',
        ignore.delivered >= 8, ignore.delivered.toFixed(1));
  check('and planting for it really does fill many more',
        all.delivered > ignore.delivered * 3,
        all.delivered.toFixed(1) + ' against ' + ignore.delivered.toFixed(1));

  /* The finding, stated rather than hidden: committing beds to a customer
     costs more than the premium pays back, at every level of commitment.
     The board is a bonus on what you grow, not a reason to grow something —
     and the more of the garden you give it, the worse it goes. */
  console.log('    planting for one offer costs ' +
    Math.round((1 - one.earned / ignore.earned) * 100) + '% of three weeks; ' +
    'planting for all three costs ' +
    Math.round((1 - all.earned / ignore.earned) * 100) + '%');
  check('and giving the whole garden to the board is worse than giving it one bed',
        all.earned < one.earned, Math.round(all.earned) + ' against ' + Math.round(one.earned));
  check('so the board stays a bonus on what you grow rather than a plan',
        ignore.earned > one.earned,
        Math.round(ignore.earned) + ' against ' + Math.round(one.earned));
}

/* ---- and the game must not oversell it ---- */
{
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('the planter marks what a customer is waiting on',
        html.indexOf('📋 order: ') > -1);
  /* The hint tells you orders "pay well over market", which is true — an
     order really is worth about twice the blooms. What it must not do is
     promise that chasing them is the way to play. */
  const hint = (html.match(/orders:\s*\{[^}]*tx:\s*'([^']*)'/) || [])[1] || '';
  console.log('\n  what the game says about orders: "' +
              hint.replace(/<[^>]+>/g, '').slice(0, 110) + '"');
  check('and says they pay over market, which they do',
        /over market|pay well/i.test(hint), hint.slice(0, 60));
  check('and says they expire, which they do', /expire/i.test(hint));
  check('and does not tell you to build your garden around them',
        !/always|best way|should plant|focus/i.test(hint), hint.slice(0, 80));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

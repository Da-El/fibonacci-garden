/* Iteration 85: the apprentice, at both ranks, net of what she is paid.

   She has been measured before, but always by `earned` — which is gross.
   Her wage comes out of coins, not out of earnings, so every previous
   reading of her counted her benefit and none of her cost. Corrected, she
   is a net loss at her first rank for two of the three visit rates. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SEEDS = [11, 22, 33, 44];

/* ---- her terms must be legible ---- */
{
  const T = E('APP_TIERS');
  console.log('  ' + T.length + ' ranks:');
  T.forEach(function (t, i) {
    console.log('    ' + t.name.padEnd(15) + 'reach ' + t.reach +
      ', retainer ' + t.base + '🪙/day plus ' + (E('APP_SHARE')[t.lvl] * 100) +
      '% of yesterday' + (t.resow ? ', and she re-sows' : ''));
  });
  check('there is more than one rank', T.length >= 2, String(T.length));
  check('and the second reaches further than the first',
        T[1].reach > T[0].reach, T[0].reach + ' -> ' + T[1].reach);
  check('and asks a bigger share for it',
        E('APP_SHARE')[2] > E('APP_SHARE')[1],
        E('APP_SHARE')[1] + ' -> ' + E('APP_SHARE')[2]);
  check('and neither reach ever finishes a plant for you',
        T.every(function (t) { return t.reach < 1; }),
        T.map(function (t) { return t.reach; }).join(', '));
}

/* ---- she must never cost you quality ----
   Her reach carries the clock further, and care comes only from pours — so
   every stage she takes off you is up to two care points you no longer
   earn. A flat allowance of two covered that for fourteen species and left
   the twelve-stage sunflower two short. */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  const short = [];
  G('SPECIES').forEach(function (sp) {
    [1, 2].forEach(function (lvl) {
      s.appLevel = 0;
      const mine = G('timerCeiling')(sp, null);
      s.appLevel = lvl;
      const hers = G('timerCeiling')(sp, null);
      const taken = hers - mine;
      const given = G('appCareFor')(sp);
      if (given < taken * 2) {
        short.push(sp.id + ' at rank ' + lvl + ': takes ' + taken +
                   ' stages, gives ' + given + ' care');
      }
    });
  });
  console.log('\n  species where her reach costs more care than she tends: ' +
              (short.length || 'none'));
  check('she gives back two care for every stage her reach takes',
        !short.length, short.join('; '));

  /* And the allowance must still be a floor, not a ceiling on her rank. */
  s.appLevel = 1;
  const elm = G('byId')['elm'];
  check('her rank still sets a minimum she always tends',
        G('appCareFor')(elm) >= G('APP_TIERS')[0].care,
        String(G('appCareFor')(elm)));
}

/* ---- and she must never water ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 3000; s.level = 12;
  G('hireApprentice()');
  for (let i = 0; i < s.plotCount; i++) G('plant(' + i + ',"elm")');
  const water = s.water;
  s.offset += 3 * 24 * 3600000;
  G('catchUpWithLedger()');
  console.log('  three days away with her employed: water ' + water + ' -> ' + s.water);
  check('she never drinks from your can',
        s.water >= water, water + ' -> ' + s.water);
  const hint = E('HINTS').apprentice.tx.replace(/<[^>]+>/g, '');
  check('and the hint says the pours stay yours',
        /never takes a pour off you|stay yours/i.test(hint), hint.slice(0, 60));
  check('and warns that she costs more in a good week',
        /share|costs more/i.test(hint), hint.slice(-60));
}

/* ---- she leaves rather than bankrupting you ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 3000; s.level = 12;
  G('hireApprentice()');
  s.coins = 3;
  s.offset += 10 * 24 * 3600000;
  G('appWages()');
  console.log('  with three coins in hand and ten days of wages owed: ' +
    (s.appLevel ? 'she stayed' : 'she left') + ', ' + s.coins + '🪙 remaining');
  check('she leaves when she cannot be paid', s.appLevel === 0);
  check('and never takes you below nothing', s.coins >= 0, String(s.coins));
}

/* ---- what she is actually worth, net ---- */
{
  function mean(profile, cfg) {
    let gross = 0, wages = 0;
    SEEDS.forEach(function (seed) {
      const r = S.run(Object.assign({ seed: seed, profile: profile, realPour: true,
                                      tapError: 30, days: 21, forOrders: false }, cfg));
      gross += r.earned; wages += r.wagesPaid || 0;
    });
    const n = SEEDS.length;
    return { gross: gross / n, wages: wages / n, net: (gross - wages) / n };
  }
  console.log('\n  three weeks, four seeds, net of her wages:');
  console.log('    visit rate     alone      rank 1            rank 2');
  const rows = {};
  ['casual', 'twice', 'diligent'].forEach(function (p) {
    const none = mean(p, { apprentice: false });
    const r1 = mean(p, { apprentice: true, capRank: 1 });
    const r2 = mean(p, { apprentice: true, capRank: 2 });
    rows[p] = { none: none, r1: r1, r2: r2 };
    console.log('    ' + p.padEnd(14) + Math.round(none.net).toString().padStart(8) +
      Math.round(r1.net).toString().padStart(11) + ' (' +
      ((r1.net / none.net - 1) * 100).toFixed(1) + '%)' +
      Math.round(r2.net).toString().padStart(11) + ' (' +
      ((r2.net / none.net - 1) * 100).toFixed(1) + '%)');
  });

  /* Promotion has to be worth it, at every rate — that much holds. */
  const promoted = ['casual', 'twice', 'diligent'].every(function (p) {
    return rows[p].r2.net > rows[p].none.net;
  });
  check('a head gardener pays for herself at every visit rate', promoted,
        ['casual', 'twice', 'diligent'].map(function (p) {
          return p + ' ' + ((rows[p].r2.net / rows[p].none.net - 1) * 100).toFixed(1) + '%';
        }).join(', '));
  check('and is worth more than the first rank everywhere',
        ['casual', 'twice', 'diligent'].every(function (p) {
          return rows[p].r2.net > rows[p].r1.net;
        }));

  /* And the finding, recorded rather than papered over: her first rank is a
     net loss for two of the three, and for the twice-a-day gardener it is a
     loss before the wage is even counted. Her reach means fewer pours; fewer
     pours means shorter combos; and that player pours enough per session for
     combos to be where their money is. */
  const losing = ['casual', 'twice', 'diligent'].filter(function (p) {
    return rows[p].r1.net < rows[p].none.net;
  });
  console.log('    her first rank is a net loss for: ' + (losing.join(', ') || 'nobody'));
  ['casual', 'twice', 'diligent'].forEach(function (p) {
    console.log('      ' + p.padEnd(10) + 'she brings ' +
      ((rows[p].r1.gross / rows[p].none.gross - 1) * 100).toFixed(1) +
      '% and costs ' + ((rows[p].r1.wages / rows[p].none.gross) * 100).toFixed(1) + '%');
  });
  /* Not asserted as good — asserted as known, and bounded so it cannot get
     worse without something failing. */
  check('the first rank is never worse than a tenth of a run',
        losing.every(function (p) {
          return rows[p].r1.net > rows[p].none.net * 0.9;
        }),
        losing.map(function (p) {
          return p + ' ' + ((rows[p].r1.net / rows[p].none.net - 1) * 100).toFixed(1) + '%';
        }).join(', '));
  check('and it is a clear gain for the gardener who plays most',
        rows.diligent.r1.net > rows.diligent.none.net,
        ((rows.diligent.r1.net / rows.diligent.none.net - 1) * 100).toFixed(1) + '%');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

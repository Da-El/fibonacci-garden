/* Iteration 57: every offline system replays when the app reopens — growth,
   water, weather, pests, weeds, the apprentice, her wages, orders. All of it
   has only ever been tested across gaps of hours. Here are the gaps that
   actually happen: a holiday, a forgotten phone, a device whose clock was
   corrected backwards. */
const path = require('path');
const H = require('./harness.js');
const HOUR = 3600000, DAY = 24 * HOUR;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* A garden mid-play, then away for a given stretch. */
function awayFor(ms, setup) {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 6000; s.level = 12; s.plotCount = 9;
  while (s.plots.length < 9) s.plots.push(null);
  while (s.trellised.length < 9) s.trellised.push(false);
  while (s.glassed.length < 9) s.glassed.push(false);
  for (let i = 0; i < 9; i++) E('plant(' + i + ',"chamomile")');
  s.water = E('waterCap()');
  if (setup) setup(E, s);
  E('catchUpWithLedger()');                       // settle the starting point
  const before = { coins: s.coins, water: s.water, level: s.level };
  s.offset += ms;
  let res = null, threw = null;
  try { res = E('catchUpWithLedger()'); } catch (e) { threw = e; }
  return { h: h, E: E, s: s, before: before, l: (res && res.l) || {}, threw: threw };
}

const GAPS = [
  ['a day', DAY], ['a week', 7 * DAY], ['a month', 30 * DAY],
  ['a year', 365 * DAY], ['a decade', 3650 * DAY]
];

console.log('  away for…    coins        water   plants  digest rows  worst single count');
GAPS.forEach(function (g) {
  const r = awayFor(g[1]);
  check('coming back after ' + g[0] + ' does not throw', !r.threw, r.threw && r.threw.message);
  if (r.threw) return;

  const rows = Object.keys(r.l).filter(function (k) { return r.l[k]; });
  const worst = rows.reduce(function (m, k) { return Math.max(m, r.l[k]); }, 0);
  const alive = r.s.plots.filter(Boolean).length;
  console.log('  ' + g[0].padEnd(12) + String(r.s.coins).padStart(8) +
    String(r.s.water).padStart(12) + String(alive).padStart(9) +
    String(rows.length).padStart(12) + String(worst).padStart(20));

  /* Nothing may go backwards or become nonsense. */
  check('  ' + g[0] + ': water stays inside the can',
        r.s.water >= 0 && r.s.water <= r.E('waterCap()'),
        r.s.water + ' of ' + r.E('waterCap()'));
  check('  ' + g[0] + ': coins never go negative', r.s.coins >= 0, String(r.s.coins));
  check('  ' + g[0] + ': no counter overflows or goes negative',
        Object.keys(r.l).every(function (k) {
          return isFinite(r.l[k]) && r.l[k] >= 0 && r.l[k] < 1e7;
        }),
        Object.keys(r.l).map(function (k) { return k + '=' + r.l[k]; }).join(' '));
  check('  ' + g[0] + ': every plant is in a sane state',
        r.s.plots.every(function (p) {
          if (!p) return true;
          const sp = r.E('byId')[p.s];
          return sp && p.stage >= 0 && p.stage <= sp.stages && p.q >= 0 && isFinite(p.q);
        }));
  /* A digest is meant to be read. Thousands of anything is not a report. */
  check('  ' + g[0] + ': the digest stays readable', rows.length <= 12,
        rows.length + ' rows');
  check('  ' + g[0] + ': the garden is still playable',
        r.s.coins > 0 || r.s.plots.some(Boolean) || r.E('barnCountAll()') > 0);
});

/* ---- a month away with an apprentice on the payroll ---- */
{
  console.log('\n  with an apprentice on wages:');
  [['a week', 7 * DAY], ['a month', 30 * DAY], ['a year', 365 * DAY]].forEach(function (g) {
    const r = awayFor(g[1], function (E, s) {
      s.coins = 3000;
      E('hireApprentice()');
    });
    if (r.threw) { check('a month away with her employed does not throw', false, r.threw.message); return; }
    console.log('    ' + g[0].padEnd(9) + ' coins ' + String(r.s.coins).padStart(7) +
      '   wages ' + String(r.l.wages || 0).padStart(7) +
      '   she ' + (r.s.appLevel ? 'stayed' : 'left'));
    check('  ' + g[0] + ' of wages cannot overdraw you', r.s.coins >= 0, String(r.s.coins));
    check('  ' + g[0] + ': if she cannot be paid she leaves rather than lending',
          r.s.coins >= 0 && (r.s.appLevel > 0 || (r.l.quit | 0) > 0 || !r.l.wages),
          'coins ' + r.s.coins + ' level ' + r.s.appLevel);
    check('  ' + g[0] + ': the garden survives her',
          r.s.coins > 0 || r.s.plots.some(Boolean) || r.E('barnCountAll()') > 0);
  });
}

/* ---- a clock that went backwards ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 5000; s.level = 12;
  for (let i = 0; i < s.plotCount; i++) E('plant(' + i + ',"elm")');
  s.offset += 3 * DAY;
  E('catchUpWithLedger()');
  const settled = { coins: s.coins, water: s.water };

  // the device's clock is corrected back by two days
  s.offset -= 2 * DAY;
  let threw = null, res = null;
  try { res = E('catchUpWithLedger()'); } catch (e) { threw = e; }
  console.log('\n  clock moved back two days: ' + (threw ? 'THREW ' + threw.message :
    'coins ' + s.coins + ', water ' + s.water + ', ' + s.plots.filter(Boolean).length + ' plants'));
  check('a clock corrected backwards does not throw', !threw, threw && threw.message);
  check('and does not hand out water for time that did not pass',
        s.water >= 0 && s.water <= E('waterCap()'), s.water + ' of ' + E('waterCap()'));
  check('nor take coins for it', s.coins >= 0 && s.coins <= settled.coins + 1,
        settled.coins + ' -> ' + s.coins);
  check('the garden is still playable afterwards',
        s.coins > 0 || s.plots.some(Boolean) || E('barnCountAll()') > 0);
}

/* ---- and the returning screen must still say something sensible ---- */
{
  const r = awayFor(30 * DAY);
  if (!r.threw) {
    let threw = null;
    try { r.E('showWelcomeBack')(30 * DAY, r.l); } catch (e) { threw = e; }
    check('the welcome-back screen renders after a month', !threw, threw && threw.message);
    /* getElementById makes a stub on demand, so asking for an id the game only
       creates inside an innerHTML string always hands back an empty one. Read
       the card the function actually writes to. */
    const card = r.h.doc.getElementById('card');
    const text = (card && card.innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('\n  after a month it says: ' + text.slice(0, 150));
    check('and it says how long you were gone', /month|day|week/.test(text), text.slice(0, 60));
    check('with nothing reading as undefined', !/undefined|NaN/.test(text));
  }
}

/* ---- how long you were away has to read like a person would say it ---- */
{
  const g = H.build(); const G = g.evalIn;
  const cases = [
    [45 * 60000, /^\d+m$/, 'minutes'],
    [5 * HOUR, /h/, 'hours'],
    [3 * DAY, /day/, 'days'],
    [21 * DAY, /week/, 'weeks'],
    [200 * DAY, /month/, 'months'],
    [3650 * DAY, /year/, 'years']
  ];
  const bad = [];
  cases.forEach(function (c) {
    const got = G('fmtLong')(c[0]);
    if (!c[1].test(got)) bad.push(c[2] + ' read as "' + got + '"');
  });
  console.log('\n  a decade away now reads: "' + G('fmtLong')(3650 * DAY) + '"');
  check('a long absence is described in units a person uses', !bad.length, bad.join('; '));
  /* It used to stop at hours, so a decade came back as "87600h 0m" — the
     duration, technically, and no use at all on the one screen whose whole
     job is to say how long you were gone. */
  check('nothing is ever reported as thousands of hours',
        !/^\d{4,}h/.test(G('fmtLong')(3650 * DAY)), G('fmtLong')(3650 * DAY));
}

/* ---- and the digest must not report damage as a headcount ---- */
{
  const r = awayFor(3650 * DAY);
  if (!r.threw) {
    r.E('showWelcomeBack')(3650 * DAY, r.l);
    const text = (r.h.doc.getElementById('card').innerHTML || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const claim = (text.match(/(\d+)\s+plants?\s+(?:was|were)\s+battered/) || [])[1];
    console.log('  and the storm row says: "' +
      (text.match(/[^.]*storm[^.]*/) || ['(no storm row)'])[0].trim().slice(0, 70) + '"');
    /* Nine beds once reported "a storm battered 7732 plants" — it was counting
       damage events and calling them plants. */
    check('the digest never claims more plants battered than you own',
          !claim || Number(claim) <= r.s.plotCount,
          claim + ' battered, ' + r.s.plotCount + ' beds');
  }
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

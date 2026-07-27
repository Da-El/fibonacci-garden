/* Iteration 90: a garden left for a season.

   away-check covers a day, a month and a decade of absence, but always
   against a tidy garden — beds empty or uniform, nobody employed, nothing in
   flight. The absence that actually happens is the messy one: plants at every
   stage, orders live, an apprentice on the payroll, a hive, a pane of glass, a
   streak worth keeping. Everything in that garden compounds while you are
   gone, and nothing has ever checked that it compounds to a number a person
   can read.

   Three absences, against one real mid-run save: a long weekend, a holiday,
   and a season. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const DAY = 24 * 3600000;

/* A garden in the middle of a run. Every bed doing something different,
   because a garden where all three beds agree cannot show an ordering bug. */
function midRun() {
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 40000; s.level = 16;
  G('hireApprentice()'); G('hireApprentice()');       // second call promotes
  G('buyHive()');
  /* Bed 0: ripe and waiting. Bed 1: halfway. Bed 2: under glass, so nothing
     in there may move at all. */
  G('plant(0,"sunflower")');
  G('plant(1,"romanesco")');
  G('plant(2,"pineapple")');
  const sun = G('byId').sunflower;
  s.plots[0].stage = sun.stages; s.plots[0].ripeAt = G('NOW()'); s.plots[0].q = 8;
  s.plots[1].stage = 3; s.plots[1].q = 4;
  G('curPlot = 2');
  G('buyGlass()');
  s.barn.elm = { 1: 6, 2: 4, 3: 2 };
  s.dailyStreak = 5;
  s.lastGiftDay = G('dayIndex()');
  G('ensureOrders()');
  s.coins = 40000;
  return { g: g, G: G, s: s };
}

function leaveFor(days) {
  const m = midRun();
  const before = {
    coins: m.s.coins, water: m.s.water, streak: m.s.dailyStreak,
    glassStage: m.s.plots[2] ? m.s.plots[2].stage : -1,
    orders: (m.s.orders || []).length
  };
  m.s.offset += days * DAY;
  let threw = '';
  let res = null;
  try { res = m.G('catchUpWithLedger()'); } catch (e) { threw = e.message; }
  const l = (res && res.l) || {};
  let rows = 0, digestThrew = '';
  try {
    m.G('showWelcomeBack')(days * DAY, l);
    rows = (m.G('$')('card').innerHTML.match(/class="wbrow/g) || []).length;
  } catch (e) { digestThrew = e.message; }
  return { m: m, s: m.s, G: m.G, l: l, rows: rows, before: before,
           threw: threw, digestThrew: digestThrew };
}

/* ---- three absences ---- */
const runs = { '3 days': leaveFor(3), '3 weeks': leaveFor(21), '3 months': leaveFor(91) };
{
  console.log('  away        digest rows   coins        water   streak   she stayed');
  Object.keys(runs).forEach(function (k) {
    const r = runs[k];
    console.log('    ' + k.padEnd(11) + String(r.rows).padStart(6) +
      String(Math.round(r.s.coins)).padStart(14) +
      String(r.s.water).padStart(8) + String(r.s.dailyStreak).padStart(9) +
      (r.s.appLevel ? '      yes' : '       no'));
  });

  const broke = Object.keys(runs).filter(function (k) { return runs[k].threw; });
  check('coming back never throws, however long you were gone',
        !broke.length, broke.map(function (k) { return k + ': ' + runs[k].threw; }).join('; '));
  const dbroke = Object.keys(runs).filter(function (k) { return runs[k].digestThrew; });
  check('and the digest builds every time', !dbroke.length,
        dbroke.map(function (k) { return k + ': ' + runs[k].digestThrew; }).join('; '));

  /* The digest is a card on a phone. Past a dozen rows it stops being a
     report and becomes a wall, and a three-month absence must not print
     three months of everything. */
  const walls = Object.keys(runs).filter(function (k) { return runs[k].rows > 14; });
  check('and is a report rather than a wall, at every length',
        !walls.length, walls.map(function (k) { return k + ': ' + runs[k].rows + ' rows'; }).join(', '));
  check('and always says something', Object.keys(runs).every(function (k) {
    return runs[k].rows > 0;
  }), Object.keys(runs).map(function (k) { return k + ' ' + runs[k].rows; }).join(', '));
}

/* ---- nothing may run away with itself ---- */
{
  const bad = [];
  Object.keys(runs).forEach(function (k) {
    const s = runs[k].s;
    ['coins', 'water', 'compost', 'level', 'xp'].forEach(function (f) {
      const v = s[f];
      if (typeof v === 'number' && (!isFinite(v) || v < 0)) bad.push(k + '.' + f + '=' + v);
    });
    if (s.water > E('CAN_TIERS')[4] * 1.3) bad.push(k + ' water ' + s.water + ' over any can');
  });
  check('no counter goes negative or infinite over a season', !bad.length, bad.join(', '));

  /* Storm damage was once reported as "a storm battered 7732 plants" — it
     counts hits, not plants, and nine beds over ninety days is a big number
     that has to be said in words a person can use. */
  const l = runs['3 months'].l;
  console.log('\n  ninety-one days away: ' + Object.keys(l).map(function (k) {
    return k + ' ' + l[k];
  }).join(' · '));
  const card = runs['3 months'].G('$')('card').innerHTML.replace(/<[^>]+>/g, ' ');
  const huge = (card.match(/\b\d{5,}\b/g) || []).filter(function (n) {
    return String(n).indexOf('🪙') < 0;
  });
  console.log('  five-figure numbers in the digest: ' + (huge.join(', ') || 'none'));
  check('the digest never prints a count nobody can use',
        !huge.filter(function (n) { return +n > 9999 && +n < 1e9; }).length ||
        /beyond counting|countless|many/i.test(card),
        huge.join(', '));
}

/* ---- her wages must not eat the garden ---- */
{
  Object.keys(runs).forEach(function (k) {
    const r = runs[k];
    console.log('  ' + k.padEnd(10) + 'wages ' + String(r.l.wages | 0).padStart(7) +
      '🪙 · coins ' + Math.round(r.s.coins) + '🪙 · she ' +
      (r.s.appLevel ? 'stayed' : 'left'));
  });
  check('wages are never more than the purse could pay',
        Object.keys(runs).every(function (k) { return runs[k].s.coins >= 0; }),
        Object.keys(runs).map(function (k) { return k + ' ' + runs[k].s.coins; }).join(', '));
  /* She is paid daily, so a season of absence is a season of wages. Either
     she was affordable the whole time or she left — there is no third
     outcome, and "she left" has to be said. */
  const q = runs['3 months'];
  check('and if she could not be paid she left rather than running a debt',
        q.s.appLevel > 0 || (q.l.quit | 0) > 0,
        'rank ' + q.s.appLevel + ', quit ' + (q.l.quit | 0));
}

/* ---- the glassed bed is untouched ---- */
{
  Object.keys(runs).forEach(function (k) {
    const r = runs[k];
    const p = r.s.plots[2];
    check('a season under glass grows nothing on its own (' + k + ')',
          !p || p.stage === r.before.glassStage,
          p ? r.before.glassStage + ' -> ' + p.stage : 'bed emptied');
  });
  /* And she must not have lifted it either — a glassed bed is the player's. */
  const q = runs['3 months'];
  check('and she leaves a glassed bed alone for the whole season',
        !!q.s.plots[2], q.s.plots[2] ? 'still there' : 'gone');
}

/* ---- the streak breaks honestly ---- */
{
  /* The streak was written in exactly one place and reset in none, so it was
     a lifetime win count wearing the word "streak" — and `dailyWins` beside
     it already counts lifetime wins. Three months away and it came back
     untouched. It is computed from the day it last advanced now. */
  const short = runs['3 days'], long = runs['3 months'];
  console.log('\n  a streak of ' + short.before.streak + ' after 3 days: ' +
    short.G('streakNow()') + ' · after 91 days: ' + long.G('streakNow()'));
  check('a streak does not survive three months away',
        long.G('streakNow()') === 0, String(long.G('streakNow()')));
  check('and does not survive three days either — a streak is consecutive',
        short.G('streakNow()') === 0, String(short.G('streakNow()')));
  check('and never goes negative', long.G('streakNow()') >= 0,
        String(long.G('streakNow()')));

  /* But it must survive the one gap that is not a gap: today. */
  const t = midRun();
  t.s.dailyStreak = 4;
  t.s.dailyStreakDay = t.G('dayIndex()');
  check('a win earned today still reads as a live streak',
        t.G('streakNow()') === 4, String(t.G('streakNow()')));
  t.s.dailyStreakDay = t.G('dayIndex()') - 1;
  check('and so does one earned yesterday, until today is over',
        t.G('streakNow()') === 4, String(t.G('streakNow()')));
  t.s.dailyStreakDay = t.G('dayIndex()') - 2;
  check('but a day missed in between ends it',
        t.G('streakNow()') === 0, String(t.G('streakNow()')));

  /* And the screen must show the live figure, not the stored one. */
  t.s.dailyStreak = 9; t.s.dailyStreakDay = t.G('dayIndex()') - 40;
  t.G('paintDailyRow()');
  const info = t.G('$')('dailyinfo').textContent;
  console.log('  after forty days away the header reads: "' + info + '"');
  check('and the header shows the live streak rather than the stored one',
        /streak 0\b/.test(info), info);
  check('while lifetime wins are still counted separately',
        /won \d/.test(info), info);
  /* The daily gift must be claimable again on the day you return, rather
     than the absence eating it. */
  check('and the gift is available again when you come back',
        long.s.lastGiftDay !== long.G('dayIndex()'),
        'gift day ' + long.s.lastGiftDay + ', today ' + long.G('dayIndex()'));
}

/* ---- weeds and orders are bounded by the garden, not by the calendar ---- */
{
  const q = runs['3 months'];
  /* `weeds` is a plotIdx -> true map, not an array. */
  const weeds = Object.keys(q.s.weeds || {}).filter(function (k) {
    return q.s.weeds[k];
  }).length;
  console.log('  weeds after 91 days: ' + weeds + ' of ' + q.s.plotCount + ' beds · ' +
    'orders on the board: ' + (q.s.orders || []).length);
  check('weeds cannot exceed the number of beds', weeds <= q.s.plotCount,
        weeds + ' of ' + q.s.plotCount);
  check('and the order board does not pile up', (q.s.orders || []).length <= 5,
        String((q.s.orders || []).length));
  check('and every order on it is one the game can still name',
        (q.s.orders || []).every(function (o) { return !!q.G('byId')[o.s]; }),
        (q.s.orders || []).map(function (o) { return o.s; }).join(', '));
}

/* ---- and the save still survives the round trip ---- */
{
  const q = runs['3 months'];
  q.G('saveState()');
  const raw = q.m.g.store['fibgarden.v2'];
  check('a garden left a season still saves', !!raw && raw.length > 20,
        raw ? raw.length + ' bytes' : 'nothing written');
  let reread = null;
  try { reread = JSON.parse(raw); } catch (e) { /* left null */ }
  check('and what it wrote is valid JSON', !!reread);
  check('and holds no NaN or null where a number belongs',
        reread && ['coins', 'water', 'level', 'plotCount'].every(function (f) {
          return typeof reread[f] === 'number' && isFinite(reread[f]);
        }),
        reread ? JSON.stringify({ coins: reread.coins, water: reread.water,
                                  level: reread.level }) : 'unreadable');
  console.log('  the save after a season: ' + (raw ? raw.length : 0) + ' bytes');
  check('and has not grown past what localStorage will take',
        raw && raw.length < 200000, (raw ? raw.length : 0) + ' bytes');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

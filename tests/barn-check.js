/* Iteration 89: the barn as a decision.

   market-check measures the spread and whether the market explains it.
   Nobody has ever played the decision the spread is supposed to create:
   hold, or sell now. A ripe bloom wilts in the bed — a star every six hours —
   but nothing has ever asked what happens to it once it is crated up. If the
   barn is a freezer and prices swing, waiting is strictly better than selling
   and the market is a button with extra steps.

   Everything below reads the game's own priceOf / tierPrice / barnValueAll
   across real days of its real weather, season and daily roll. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const DAY = 24 * 3600000;

/* Walk the world forward a day at a time and read what a fixed barn is
   worth on each. Nothing is played — this is the price the game would give
   a hoarder who simply waited. */
function valueByDay(days, stock) {
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16;
  s.barn = stock || { pineapple: { 3: 10 }, romanesco: { 3: 10 }, elm: { 3: 10 } };
  const out = [];
  for (let d = 0; d < days; d++) {
    out.push({
      day: d,
      value: G('barnValueAll()'),
      weather: G('weatherNow()').id,
      season: G('seasonNow()').id,
      mult: G('dayPriceMult()')
    });
    s.offset += DAY;
  }
  return out;
}

/* ---- the barn does not rot ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16;
  s.barn = { elm: { 3: 5 } };
  const before = JSON.parse(JSON.stringify(s.barn));
  s.offset += 90 * DAY;
  G('catchUpWithLedger()');
  console.log('  a barn left ninety days: ' + JSON.stringify(s.barn));
  check('nothing in the barn spoils, however long it is left',
        JSON.stringify(s.barn) === JSON.stringify(before),
        JSON.stringify(s.barn));
  /* And that is the whole tension: wilt is a pressure to *harvest*, not a
     pressure to sell. Once it is crated the clock stops. */
  const p = { s: 'elm', stage: G('byId').elm.stages, q: 6, ripeAt: G('NOW()') - 30 * 3600000 };
  console.log('  while a bloom left standing thirty hours loses ' +
              G('wiltPenalty')(p) + ' stars');
  check('but a bloom left in the bed does', G('wiltPenalty')(p) > 0,
        String(G('wiltPenalty')(p)));
}

/* ---- so what does waiting actually pay? ---- */
{
  const days = valueByDay(28);
  const vals = days.map(function (d) { return d.value; });
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  const mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  console.log('\n  the same barn, valued on each of 28 days:');
  console.log('    worst ' + lo + '🪙, best ' + hi + '🪙, average ' +
    Math.round(mean) + '🪙 — a spread of ' + ((hi / lo - 1) * 100).toFixed(0) + '%');
  const sample = days.slice(0, 8).map(function (d) {
    return d.weather.slice(0, 4) + ' ' + d.value;
  });
  console.log('    first week: ' + sample.join(' · '));

  check('the day you sell on is worth something', hi > lo * 1.15,
        lo + ' -> ' + hi);
  check('and not so much that one day is the whole game', hi < lo * 2.2,
        ((hi / lo - 1) * 100).toFixed(0) + '%');

  /* The decision only exists if a patient seller beats an impatient one by
     enough to notice and not so much that selling on sight is a mistake.
     A player who sells the day they harvest gets the average; one who waits
     for a good day gets something nearer the best. */
  const patient = hi / mean, hasty = 1;
  console.log('    selling on the best day of a month beats selling blind by ' +
    ((patient / hasty - 1) * 100).toFixed(0) + '%');
  check('waiting for a good day is worth waiting for',
        patient > 1.08, ((patient - 1) * 100).toFixed(0) + '%');
  check('but selling blind is never ruinous',
        mean / lo > 1.02, ((mean / lo - 1) * 100).toFixed(1) + '%');
}

/* ---- and the board's verdict has to be worth reading ----
   The market says "a good day · ×1.31 on the last ten". If that word does not
   track what the barn is actually worth, the explanation is decoration and
   the 42% goes to whoever happened to open the app on the right morning.

   Judged against a weather-free valuation, because the board deliberately
   leaves the weather out — it moves within the day and has its own line
   underneath, the next-hour outlook. */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16;
  const sp = G('byId').pineapple;
  const rows = [];
  for (let d = 0; d < 40; d++) {
    /* Feed the board a real history rather than a synthetic one: it judges
       today against the last ten days it has actually seen. */
    G('ledgerToday()');
    const stand = G('priceStanding()');
    if (stand) rows.push({ word: stand.word, ratio: stand.ratio,
                           value: G('priceOfQ')(sp, 3, 1) });
    s.offset += DAY;
  }
  const good = rows.filter(function (r) { return /good/.test(r.word); });
  const poor = rows.filter(function (r) { return /poor|slow/.test(r.word); });
  const avg = function (a) {
    return a.length ? a.reduce(function (t, r) { return t + r.value; }, 0) / a.length : 0;
  };
  console.log('\n  forty days judged by the board:');
  const tally = {};
  rows.forEach(function (r) { tally[r.word] = (tally[r.word] | 0) + 1; });
  Object.keys(tally).forEach(function (w) {
    console.log('    ' + w.padEnd(18) + tally[w] + ' days');
  });
  console.log('    a pineapple on a "good" day: ' + Math.round(avg(good)) +
    '🪙 · on a "poor" or "slow" one: ' + Math.round(avg(poor)));
  check('the board sees enough days to have an opinion', rows.length > 30,
        rows.length + ' of 40');
  check('and it says more than one thing', Object.keys(tally).length > 1,
        Object.keys(tally).join(', '));

  /* Every word it knows has to be a word a player can actually see. Two of
     the five were not: "a very good day" asked for ×1.18 and "a poor day"
     for ×0.85, and across 1,198 days the ratio never leaves 0.895–1.156 —
     the ten-day window judges today against a mean that already contains
     days like today, so it cannot swing that far. They were copy nobody
     would ever read. The thresholds come from the measured distribution
     now, and this holds them to firing. */
  const years = H.build(); const Y = years.evalIn; const ys = Y('state');
  ys.offset = 0; ys.level = 16;
  const seen = {};
  for (let d = 0; d < 600; d++) {
    Y('ledgerToday()');
    const st = Y('priceStanding()');
    if (st) seen[st.word] = (seen[st.word] | 0) + 1;
    ys.offset += DAY;
  }
  const total = Object.keys(seen).reduce(function (a, k) { return a + seen[k]; }, 0);
  const WORDS = ['a very good day', 'a good day', 'an ordinary day',
                 'a slow day', 'a poor day'];
  console.log('  over 600 days: ' + WORDS.map(function (w) {
    return w.replace(/^an? /, '') + ' ' + (((seen[w] | 0) / total * 100).toFixed(0)) + '%';
  }).join(' · '));
  const never = WORDS.filter(function (w) { return !seen[w]; });
  check('every verdict the board can say is one a player will actually see',
        !never.length, never.join(', ') + ' never fired');
  check('and the extremes stay rare',
        WORDS.filter(function (w) { return /very good|poor/.test(w); })
             .every(function (w) { return seen[w] / total < 0.2; }),
        WORDS.filter(function (w) { return /very good|poor/.test(w); })
             .map(function (w) { return ((seen[w] | 0) / total * 100).toFixed(0) + '%'; }).join(', '));
  check('and an ordinary day is the commonest thing to read',
        seen['an ordinary day'] === Math.max.apply(null, WORDS.map(function (w) { return seen[w] | 0; })),
        ((seen['an ordinary day'] | 0) / total * 100).toFixed(0) + '%');
  check('and a day it calls good really does pay more than one it calls poor',
        avg(good) > avg(poor), Math.round(avg(good)) + ' against ' + Math.round(avg(poor)));
  /* The word must be a function of the ratio it quotes, and in the right
     direction. Asserted as monotonicity rather than against a copy of the
     thresholds — a check that repeats the constant goes stale the moment the
     constant is retuned, which is exactly what happened to this one when the
     verdicts were re-cut. Sort the days by ratio and the verdict must never
     go backwards. */
  const RANK = { 'a poor day': 0, 'a slow day': 1, 'an ordinary day': 2,
                 'a good day': 3, 'a very good day': 4 };
  const byRatio = rows.slice().sort(function (a, b) { return a.ratio - b.ratio; });
  const backwards = byRatio.filter(function (r, i) {
    return i > 0 && RANK[r.word] < RANK[byRatio[i - 1].word];
  });
  check('and a higher ratio never reads as a worse day', !backwards.length,
        backwards.slice(0, 2).map(function (r) {
          return r.word + ' at ×' + r.ratio.toFixed(3);
        }).join(', '));
  check('and every word it used is one it knows',
        rows.every(function (r) { return RANK[r.word] !== undefined; }),
        rows.filter(function (r) { return RANK[r.word] === undefined; })
            .map(function (r) { return r.word; }).join(', '));
}

/* ---- and a hoarder must actually lose something ----
   If holding costs nothing at all, the answer is always hold, and the market
   is a button. The cost is that coins in the barn are coins you cannot spend:
   every plot, can, pane and seed is bought with money you did not hold. */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16; s.coins = 0;
  s.barn = { pineapple: { 3: 10 } };
  const worth = G('barnValueAll()');
  console.log('\n  a barn worth ' + worth + '🪙 with nothing in the purse:');
  const seed = G('seedCostOf')(G('byId').elm);
  console.log('    cheapest seed costs ' + seed + '🪙 · coins in hand ' + s.coins);
  check('stock in the barn cannot be spent on anything',
        s.coins < seed && worth > seed,
        'barn ' + worth + '🪙, coins ' + s.coins + '🪙, seed ' + seed + '🪙');
  /* Which is the real cost of holding, and the game has to be able to say it:
     the market screen shows what the barn is worth so the choice is legible. */
  G('paintMarket()');
  const info = G('$')('barninfo').textContent;
  console.log('    the market header reads: "' + info + '"');
  check('and the market says what the barn is worth right now',
        /worth/.test(info) && /\d/.test(info), info);
  check('and how much of it there is', /held/.test(info), info);
}

/* ---- fever is the one thing that makes selling urgent ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16;
  s.barn = { pineapple: { 3: 10 } };
  const calm = G('barnValueAll()');
  G('startFever()');
  const hot = G('barnValueAll()');
  console.log('\n  the same barn, calm ' + calm + '🪙 · in fever ' + hot + '🪙 (×' +
    (hot / calm).toFixed(3) + ')');
  check('fever really does lift the whole barn', hot > calm, calm + ' -> ' + hot);
  check('and by the golden ratio, which is what it says',
        Math.abs(hot / calm - E('PHI')) < 0.01, (hot / calm).toFixed(3));
  /* And it lasts seconds, not days — which is what makes it the one moment
     the game genuinely wants you to sell into. */
  const secs = E('FEVER_MS') / 1000;
  console.log('  and it lasts ' + secs + 's, against a day-to-day swing you can wait out');
  check('and it is over in well under a minute', secs < 60, secs + 's');
  check('so the hoarder who ignores it leaves the best price on the table',
        E('PHI') > 1.6, String(E('PHI')));
}

/* ---- the dearest day of a year, so the spread cannot quietly widen ---- */
{
  const year = valueByDay(365);
  const vals = year.map(function (v) { return v.value; });
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  const mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  console.log('\n  across a full year: worst ' + lo + '🪙, best ' + hi + '🪙, mean ' +
    Math.round(mean) + '🪙 — best is ' + ((hi / mean - 1) * 100).toFixed(0) +
    '% over average');
  check('even the best day of a year is not a jackpot',
        hi < mean * 1.6, ((hi / mean - 1) * 100).toFixed(0) + '%');
  check('and the worst is not a disaster',
        lo > mean * 0.6, ((1 - lo / mean) * 100).toFixed(0) + '%');
  /* A hoarder who waits a year for the single best day gains this much over
     one who sells whenever. Stated, so it can be judged rather than assumed. */
  console.log('  so waiting a year for the perfect day is worth ' +
    ((hi / mean - 1) * 100).toFixed(0) + '% — less than one fever');
  check('waiting a whole year beats nothing a single fever cannot',
        hi / mean < E('PHI'), (hi / mean).toFixed(3) + ' against ' + E('PHI'));
}

/* ---- and the ★★★ the apprentice leaves you must be the valuable part ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16;
  const sp = G('byId').pineapple;
  const tiers = ['1', '2', '3', 'p', 'g'];
  console.log('\n  one pineapple by tier: ' + tiers.map(function (t) {
    return t + ' ' + G('tierPrice')(sp, t) + '🪙';
  }).join(' · '));
  const p = tiers.map(function (t) { return G('tierPrice')(sp, t); });
  check('every tier is worth more than the one below it',
        p.every(function (v, i) { return i === 0 || v > p[i - 1]; }),
        p.join(' < '));
  /* She sells ★ and ★★ and leaves the rest. Every tier she leaves has to be
     worth more each than any she sells, or her judgement is arbitrary — and
     the two she is most obviously right to leave, the pristine and the
     golden, have to be worth a multiple rather than a margin, because those
     are the ones a player is holding for an order or a record. */
  check('every tier she leaves is worth more than any she sells',
        Math.min(p[2], p[3], p[4]) > Math.max(p[0], p[1]),
        'sells up to ' + Math.max(p[0], p[1]) + ', leaves from ' + Math.min(p[2], p[3], p[4]));
  check('and the two rarest are worth a multiple of her best sale',
        p[3] >= Math.max(p[0], p[1]) * 2 && p[4] >= Math.max(p[0], p[1]) * 2,
        p[3] + ' and ' + p[4] + ' against ' + Math.max(p[0], p[1]));
  check('and a pristine is worth more than two ★★★',
        p[3] >= p[2] * 2, p[3] + ' against ' + p[2]);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

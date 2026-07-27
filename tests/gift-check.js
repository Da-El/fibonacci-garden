/* Iteration 74: a daily gift with a seven-day streak, and nothing has ever
   claimed one.

   It is a modal with a button, and until iteration 70 nothing in this suite
   could press a button — so seventy iterations of balance work were done
   against a player who never took the gift. Which matters, because the
   seventh day used to pay a golden seed: the permanent bonus on every price
   in the game, worth twelve thousand coins of earnings by the only other
   route to one. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const GIFTS = E('GIFTS');
const DAY = 24 * 3600000;

/* Open today's gift and take it. */
function claim(g) {
  g.h.doc.getElementById('card').innerHTML = '';
  g.E('checkDailyGift()');
  if (g.h.doc.getElementById('card').innerHTML.indexOf('c-gift') < 0) return false;
  const btn = g.h.doc.getElementById('c-gift');
  btn.dispatchEvent({ type: 'click', target: btn,
    stopPropagation: function () {}, preventDefault: function () {} });
  return true;
}
function gardener() {
  const g = H.build(); const E2 = g.evalIn; const s = E2('state');
  s.offset = 0;
  return { h: g, E: E2, s: s };
}

/* ---- the week itself ---- */
{
  console.log('  the seven days: ' + GIFTS.map(function (x) { return x.label; }).join(' · '));
  check('the streak is a week long', GIFTS.length === 7, String(GIFTS.length));
  check('every day pays something',
        GIFTS.every(function (x) {
          return (x.coins | 0) + (x.compost | 0) + (x.golden | 0) > 0 || x.fillCan;
        }));
  check('and every day says what it pays', GIFTS.every(function (x) { return !!x.label; }));

  /* A golden seed is the permanent multiplier on every price you will ever
     see, and earning one any other way costs twelve thousand coins and the
     whole garden. Handing one over every seventh day for opening the app
     made the permanent reward an attendance record: a hundred days paid
     fourteen from the gift against three for actually replanting. */
  const seeds = GIFTS.reduce(function (t, x) { return t + (x.golden | 0); }, 0);
  check('the week does not hand out the permanent bonus', seeds === 0,
        seeds + ' golden seed(s) a week');
  /* But the seventh day still has to be the one worth coming back for. */
  const last = GIFTS[6];
  check('and the seventh day is still the prize',
        !!last.fillCan || (last.coins | 0) > (GIFTS[5].coins | 0),
        last.label);
}

/* ---- claiming it, one day at a time ---- */
{
  const g = gardener();
  const got = [];
  for (let d = 0; d < 9; d++) {
    if (claim(g)) got.push(d + 1);
    g.s.offset += DAY;
  }
  console.log('\n  nine days running: claimed on ' + got.join(', ') +
              ', streak reached ' + g.s.giftStreak);
  check('it can be claimed at all', got.length > 0, String(got.length));
  check('and once a day, every day', got.length === 9, got.length + ' of 9');
  check('and the streak counts them', g.s.giftStreak === 9, String(g.s.giftStreak));
}

/* ---- and only once a day ---- */
{
  const g = gardener();
  claim(g);
  const after = { coins: g.s.coins, compost: g.s.compost, water: g.s.water };
  /* Press it again without the day turning over. The card is closed but the
     button still exists, and until this iteration pressing it paid again. */
  const btn = g.h.doc.getElementById('c-gift');
  for (let i = 0; i < 5; i++) {
    btn.dispatchEvent({ type: 'click', target: btn,
      stopPropagation: function () {}, preventDefault: function () {} });
  }
  console.log('  five more presses of the same button: ' +
    after.coins + ' -> ' + g.s.coins + ' coins');
  check('pressing the button again pays nothing more',
        g.s.coins === after.coins && g.s.compost === after.compost,
        after.coins + ' -> ' + g.s.coins);
  check('and does not advance the streak', g.s.giftStreak === 1,
        String(g.s.giftStreak));
}

/* ---- breaking it, and what that costs ---- */
{
  const g = gardener();
  for (let d = 0; d < 5; d++) { claim(g); g.s.offset += DAY; }
  const at = g.s.giftStreak;
  g.s.offset += DAY * 2;                       // missed a day
  claim(g);
  console.log('\n  a streak of ' + at + ', then one day missed: back to ' + g.s.giftStreak);
  check('missing a day resets the streak', g.s.giftStreak === 1,
        'streak is ' + g.s.giftStreak);
  /* And it has to be recoverable in a week rather than being a punishment
     that follows you around. */
  for (let d = 0; d < 7; d++) { g.s.offset += DAY; claim(g); }
  check('and a week of coming back rebuilds it', g.s.giftStreak >= 7,
        String(g.s.giftStreak));
}

/* ---- coming back after a life happened ---- */
{
  const g = gardener();
  claim(g);
  g.s.offset += 45 * DAY;
  const before = { coins: g.s.coins, streak: g.s.giftStreak };
  const took = claim(g);
  console.log('  away six weeks, then back: ' + (took ? 'a gift is waiting' : 'nothing offered') +
              ', streak ' + before.streak + ' -> ' + g.s.giftStreak);
  check('six weeks away and there is still a gift waiting', took);
  check('and it starts the chain again rather than refusing you',
        g.s.giftStreak === 1, String(g.s.giftStreak));
  check('and nothing about it goes negative',
        g.s.coins >= before.coins && isFinite(g.s.water));
}

/* ---- what a hundred days of it is actually worth ---- */
{
  const withGift = S.run({ seed: 4242, profile: 'diligent', realPour: true, tapError: 30,
                           hive: true, apprentice: true, glass: true, days: 100,
                           prestigeAt: 3 });
  console.log('\n  a hundred days: ' + withGift.gifts + ' gifts claimed, streak ' +
    withGift.giftStreak + ', ' + withGift.giftCans + ' cans filled, ' +
    withGift.golden + ' golden seeds from ' + withGift.prestiges + ' replants');
  check('the gift is claimed about once a day over a long run',
        Math.abs(withGift.gifts - 100) <= 2, withGift.gifts + ' in 100 days');
  check('and a full can arrives about once a week',
        Math.abs(withGift.giftCans - 14) <= 2, String(withGift.giftCans));
  /* The point of the change: the permanent bonus is now something you earn
     by playing rather than by being present. */
  check('and every golden seed a long player has was earned by replanting',
        withGift.golden <= withGift.prestiges * 6,
        withGift.golden + ' seeds from ' + withGift.prestiges + ' replants');
}

/* ---- and it must not be the reason to open the app ---- */
{
  /* A week of gifts against a day of play. If showing up pays more than
     gardening does, the gift is the game. */
  const week = GIFTS.reduce(function (t, x) { return t + (x.coins | 0); }, 0);
  const day = S.run({ seed: 4242, profile: 'casual', realPour: true, tapError: 45,
                      days: 3 }).earned / 3;
  console.log('  a week of gifts pays ' + week + '🪙; a casual day of gardening earns ' +
              Math.round(day) + '🪙');
  check('a whole week of gifts is worth less than a day of gardening',
        week < day, week + ' vs ' + Math.round(day));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

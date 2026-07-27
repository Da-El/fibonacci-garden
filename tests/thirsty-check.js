/* Iteration 30: the stalled plant as a moment. Checks the count, the tab
   title, and that the sound announces a stall exactly once. */
const H = require('./harness.js');
const HOUR = 3600000, DAY = 24 * HOUR;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 8;

  // count sound calls by wrapping the table entry
  let plays = 0;
  E('SFX.thirsty = (function(orig){ return function(){ __c(); }; })(SFX.thirsty)');
  // the harness has no __c, so instead swap in a counter we can read back
  E('SFX.thirsty = function(){ state.__plays = (state.__plays|0) + 1; }');

  E('plant(0,"elm")'); E('plant(1,"elm")'); E('plant(2,"daisy")');
  check('nothing is thirsty the moment it is sown', E('thirstyCount()') === 0);

  s.offset += 6 * HOUR;
  E('growthTick()');
  check('all three stall once the clock has run', E('thirstyCount()') === 3,
        'count=' + E('thirstyCount()'));
  check('the stall announces itself once', (s.__plays | 0) === 1, 'plays=' + (s.__plays | 0));

  // growing further must not re-announce
  s.offset += 6 * HOUR;
  E('growthTick()');
  check('a second tick does not announce again', (s.__plays | 0) === 1, 'plays=' + (s.__plays | 0));

  // pouring clears the thirst on that plant
  E('curPlot = 0'); s.water = 99;
  E('advanceStage("water", true)');
  const sp = E('byId')['elm'];
  const stillThirsty = s.plots[0].stage >= E('timerCeiling')(sp) && s.plots[0].stage < sp.stages;
  check('pouring past the ceiling keeps it thirsty until ripe', stillThirsty === E('isThirsty')(s.plots[0]));

  // a plant with aphids is paused, not thirsty — the tag must not double up
  s.plots[1].bug = true;
  check('an aphid-struck plant is not counted as thirsty', !E('isThirsty')(s.plots[1]));

  // the title carries the counts
  E('paintTop()');
  const t1 = h.doc.title;
  check('the tab title carries the thirsty count', /💧\d/.test(t1), 'title="' + t1 + '"');
  s.plots.forEach(function (p, i) { if (p) { p.stage = E('byId')[p.s].stages; p.ripeAt = E('NOW()'); } });
  E('paintTop()');
  const t2 = h.doc.title;
  check('the tab title carries the ready count', /🌼\d/.test(t2), 'title="' + t2 + '"');

  // and reverts when there is nothing to do
  s.plots = [null, null, null];
  E('paintTop()');
  check('the title is plain when nothing waits', h.doc.title === 'Fibonacci Garden',
        'title="' + h.doc.title + '"');
}

/* the offline path must not play the sound — the digest reports it instead */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 8;
  E('SFX.thirsty = function(){ state.__plays = (state.__plays|0) + 1; }');
  E('plant(0,"elm")');
  s.offset += 10 * HOUR;
  const res = E('catchUpWithLedger()');
  check('a catch-up reports stalls in the digest, not by sound',
        (s.__plays | 0) === 0 && (res.l.stalled | 0) > 0,
        'plays=' + (s.__plays | 0) + ' stalled=' + (res.l.stalled | 0));
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

/* Iteration 88: a deepening pass over 84–87.

   Four iterations measured four systems. This asks what each of them left
   unfinished, and the largest answer came from the audit's own prose: five of
   the apprentice's ledger events are listed as unreachable by the bot with
   the note "proven directly in glass-check and regress instead". They are
   not. Neither file mentions them. screens-check hands `showWelcomeBack` a
   synthetic `{appPick: 3}` — which proves the digest can render the line, not
   that the game ever produces one — and sim.js accumulates them without ever
   asserting they are non-zero.

   So everything the apprentice does while you are away — lifting ripe blooms,
   re-sowing the bed, minding the stall — has been costed in coins for four
   iterations and never once watched happening. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const HOUR = 3600000, DAY = 24 * HOUR;

/* A garden with a head gardener in it, ripe blooms in the beds and stock in
   the barn — the state she exists for, and the one an active bot never
   reaches because it plays every session to a standstill. */
function awayForDays(days, opts) {
  opts = opts || {};
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = opts.coins === undefined ? 40000 : opts.coins;
  s.level = 16;
  G('hireApprentice()');
  if (opts.rank !== 1) G('hireApprentice()');            // second call promotes
  for (let i = 0; i < s.plotCount; i++) G('plant(' + i + ',"' + (opts.sp || 'elm') + '")');
  const sp = G('byId')[opts.sp || 'elm'];
  s.plots.forEach(function (p) {
    if (!p) return;
    p.stage = sp.stages; p.ripeAt = G('NOW()'); p.q = opts.q === undefined ? 2 : opts.q;
  });
  if (opts.barn) s.barn[sp.id] = opts.barn;
  s.offset += days * DAY;
  const l = (G('catchUpWithLedger()') || {}).l || {};
  return { G: G, s: s, l: l, sp: sp };
}

/* ---- 85 deepened: she is watched doing the job, not just paid for it ---- */
{
  const r = awayForDays(3, { barn: { 1: 5, 2: 3, 3: 2 } });
  console.log('  three days away with a head gardener:');
  ['appPick', 'appSow', 'appSold', 'appTook', 'appCare'].forEach(function (k) {
    console.log('    ' + k.padEnd(9) + (r.l[k] | 0));
  });
  check('she lifts the ripe blooms rather than letting them wilt',
        (r.l.appPick | 0) > 0, String(r.l.appPick | 0));
  check('and sows the bed again so it is growing when you look',
        (r.l.appSow | 0) > 0, String(r.l.appSow | 0));
  check('and sells the ordinary stock while you are away',
        (r.l.appSold | 0) > 0, String(r.l.appSold | 0));
  check('and the coins she took for it are recorded',
        (r.l.appTook | 0) > 0, String(r.l.appTook | 0));
  /* Every one of those four was reported by the audit as never firing, under
     a note claiming they were covered elsewhere. This is that coverage. */
  check('and the beds really are full again', r.s.plots.every(Boolean),
        r.s.plots.map(function (p) { return p ? p.s : '-'; }).join(' '));

  /* The line she must not cross: the best stock is yours to sell. */
  const left = r.s.barn[r.sp.id] || {};
  console.log('    barn afterwards: ' + JSON.stringify(left));
  check('but she never sells a ★★★', (left['3'] | 0) === 2,
        JSON.stringify(left));
  check('and clears the ★ and ★★ she is there to shift',
        !(left['1'] | 0) && !(left['2'] | 0), JSON.stringify(left));

  /* And a rank 1 apprentice must not re-sow — that is what the promotion is
     for, and it is half of what makes the second rank worth buying. */
  const one = awayForDays(3, { rank: 1, barn: { 1: 4 } });
  console.log('    the same three days at rank 1: sowed ' + (one.l.appSow | 0) +
              ', picked ' + (one.l.appPick | 0));
  check('a first-rank apprentice lifts blooms but does not re-sow',
        (one.l.appPick | 0) > 0 && !(one.l.appSow | 0),
        'picked ' + (one.l.appPick | 0) + ', sowed ' + (one.l.appSow | 0));
}

/* ---- and she will not re-sow you into a dead save ---- */
{
  const poor = awayForDays(3, { coins: 700 });
  const floor = E('RESOW_FLOOR');
  console.log('\n  a head gardener with almost nothing in the purse: ' +
    poor.s.coins + '🪙 left, sowed ' + (poor.l.appSow | 0) +
    ' (floor is ' + floor + ')');
  check('she leaves enough in the purse to start again',
        poor.s.coins >= 0, String(poor.s.coins));
  check('and stops sowing rather than spending past the floor',
        poor.s.coins >= floor || !(poor.l.appSow | 0),
        poor.s.coins + ' against a floor of ' + floor);
}

/* ---- and nothing she does touches a bed under glass ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 60000; s.level = 16;
  G('hireApprentice()'); G('hireApprentice()');
  G('plant(0,"elm")');
  G('curPlot = 0');
  G('buyGlass()');
  const sp = G('byId').elm;
  s.plots[0].stage = sp.stages; s.plots[0].ripeAt = G('NOW()'); s.plots[0].q = 2;
  s.offset += 3 * DAY;
  G('catchUpWithLedger()');
  console.log('  a ripe bloom under glass after three days: ' +
              (s.plots[0] ? 'still there' : 'she took it'));
  check('a bloom under glass is left for you', !!s.plots[0]);
  check('and it has not wilted in there',
        s.plots[0] && G('wiltPenalty')(s.plots[0]) === 0,
        s.plots[0] ? String(G('wiltPenalty')(s.plots[0])) : 'gone');
}

/* ---- 84 deepened: does a second and third pane still pay? ----
   Glass is bought per bed at a 90% markup each time. Iteration 84 measured
   one pane. Nobody has asked whether the third is still worth having. */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 999999; s.level = 16;
  const costs = [];
  for (let i = 0; i < s.plotCount; i++) {
    costs.push(G('glassCost()'));
    G('plant(' + i + ',"elm")');
    G('curPlot = ' + i);
    G('buyGlass()');
  }
  console.log('\n  panes of glass cost ' + costs.join(' -> ') + '🪙');
  check('every bed can be glassed', s.glassed.filter(Boolean).length === s.plotCount,
        s.glassed.filter(Boolean).length + ' of ' + s.plotCount);
  check('and each pane costs more than the last',
        costs.every(function (c, i) { return i === 0 || c > costs[i - 1]; }),
        costs.join(' -> '));
  check('and the escalation is the stated 90%',
        costs.every(function (c, i) {
          return i === 0 || Math.abs(c / costs[i - 1] - E('GLASS_STEP')) < 0.02;
        }), costs.join(' -> '));
  /* The thing a third pane buys: a pristine needs every stage poured, and a
     glassed bed is the only place that is possible without racing the clock.
     So the ceiling on pristines is the number of panes, and that has to keep
     rising or the last one is decoration. */
  check('and a glassed bed stops the clock however many there are',
        s.plots.every(function (p, i) {
          return G('timerCeiling')(G('byId').elm, p) === 0;
        }));
  /* What glass costs, stated rather than bounded by a round number. It is
     the dearest thing in the game — three panes come to more than every plot
     and every can put together — and iteration 84 already measured that it
     earns nothing. It is not an investment; it is the only route to a
     pristine bloom. So the shape that matters is that the *first* pane is
     the affordable one: you glass a bed, chase pristines in it, and the
     second and third are for a player who has run out of other things to
     buy. */
  const total = costs.reduce(function (a, b) { return a + b; }, 0);
  const rest = E('PLOT_COSTS').reduce(function (a, b) { return a + b; }, 0) +
               E('CAN_COSTS').reduce(function (a, b) { return a + b; }, 0) +
               E('APPRENTICE_HIRE');
  console.log('  three panes ' + total + '🪙 against ' + rest +
              '🪙 for every plot, every can and hiring her');
  check('glass is the dearest thing in the game', total > rest,
        total + ' against ' + rest);
  check('but the first pane is a fifth of it, so one glassed bed is reachable',
        costs[0] < total / 4, costs[0] + ' of ' + total);
  check('and one pane is affordable at the level it unlocks',
        costs[0] < E('PLOT_COSTS')[E('PLOT_COSTS').length - 1] * 1.5,
        costs[0] + ' against a last plot at ' + E('PLOT_COSTS')[E('PLOT_COSTS').length - 1]);
}

/* ---- 86 deepened: the hour is stated where the choice is made ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 9000; s.level = 16;
  function planterAt(hour) {
    const d = new Date(G('NOW()'));
    d.setHours(hour, 30, 0, 0);
    s.offset = d.getTime() - G('Date.now()');
    G('openPlanter(0)');
    return G('$')('card').innerHTML.replace(/<[^>]+>/g, ' ');
  }
  const noon = planterAt(12), night = planterAt(1), dusk = planterAt(18);
  /* The verdict replaced the description in iteration 92 rather than
     following it: "☀️ loves daytime — wait for daylight" measured 223px
     against the 222px of text a 320px phone gives a planter row, and the
     badge cannot wrap. The icon carries which half of the day it wants. */
  console.log('\n  the planter at noon says of a day-lover: ' +
    (/☀️\s*now!/.test(noon) ? '"☀️ now!"' : 'nothing'));
  console.log('  and at 01:30: ' +
    (/☀️\s*wait for daylight/.test(night) ? '"☀️ wait for daylight"' : 'nothing'));
  check('the planter says when a species suits the hour you are in',
        /☀️\s*now!/.test(noon), 'not found');
  check('and says to wait when it does not',
        /☀️\s*wait for daylight/.test(night));
  check('and tells a night-lover the same, the other way round',
        /🌙\s*now!/.test(night) && /🌙\s*wait for dark/.test(noon));
  check('and an easygoing plant still says what easygoing means',
        /easygoing/.test(noon) && /easygoing/.test(night));
  check('and names the golden hour when every plant is content',
        /golden hour/.test(dusk));
  /* An easygoing species must not be told to wait for anything. */
  check('and never tells an easygoing plant to wait',
        !/easygoing\s+—\s+wait/.test(noon + night + dusk));
  /* The badge must still light up, not merely carry words. */
  check('and the badge still marks the ones that suit right now',
        G('$')('card').innerHTML.indexOf('prefbadge match') > -1);
}

/* ---- the whole game: every ledger event the digest can show ---- */
{
  /* The digest is built from ledger keys. Any key the game writes that the
     audit does not know about is a line nobody has ever checked fires, and
     any key the digest reads that nothing writes is a line that never shows. */
  const html = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const written = {};
  (html.match(/logEvent\('([a-zA-Z]+)'/g) || []).forEach(function (m) {
    written[m.slice(10, -1)] = true;
  });
  const read = {};
  (html.match(/l\.([a-zA-Z]+)/g) || []).forEach(function (m) {
    read[m.slice(2)] = true;
  });
  const orphanWrites = Object.keys(written).filter(function (k) { return !read[k]; });
  console.log('\n  ledger keys the game writes: ' + Object.keys(written).length +
    ', of which the digest never reads: ' + (orphanWrites.join(', ') || 'none'));
  check('every event the game records is something the digest can show',
        !orphanWrites.length, orphanWrites.join(', '));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

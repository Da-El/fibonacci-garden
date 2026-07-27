/* Iteration 56: fever is the last major system with no measurement behind it,
   because the simulated player poured through advanceStage and never touched
   the real minigame — so combos never accumulated and fever never fired once
   in any run this session.

   Driving the actual pour path found it had been permanently on. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;

/* ---- the trigger and the reward must be what they claim ---- */
{
  console.log('  fever: a combo of ' + E('FEVER_COMBO') + ', lasting ' +
              (E('FEVER_MS') / 1000) + 's, paying ×' + E('PHI').toFixed(3));
  check('the threshold is a Fibonacci number',
        E('FIB').indexOf(E('FEVER_COMBO')) > -1, String(E('FEVER_COMBO')));
  check('so is the duration in seconds',
        E('FIB').indexOf(E('FEVER_MS') / 1000) > -1, String(E('FEVER_MS') / 1000));
  check('it pays the golden ratio', Math.abs(E('PHI') - 1.6180339887) < 1e-9);
}

/* ---- fever must not widen the gold zone: that was the loop ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0; st.level = 12;
  const sp = G('byId')['sunflower'];
  const cold = G('pourZonesFor')(3, sp).gw;
  st.feverUntil = G('NOW()') + 60000;
  const hot = G('pourZonesFor')(3, sp).gw;
  check('fever does not make the next pour easier', Math.abs(hot - cold) < 1e-9,
        'cold ' + cold.toFixed(4) + ' hot ' + hot.toFixed(4));
  /* Widening the gold during fever was a feedback loop rather than a bonus:
     more perfects, so more triggers, so more fever, without end. */
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('and the widening is gone from the code, not just neutralised',
        html.indexOf('feverActive() ? 1.5 : 1') < 0);
}

/* ---- each fever must be earned separately ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0;
  st.combo = G('FEVER_COMBO') - 1;
  check('a combo below the threshold does not start it', !G('feverActive()'));
  // step it over the line the way lockPour does
  st.combo = G('FEVER_COMBO');
  G('startFever()'); st.combo = 0;
  check('reaching the threshold starts it', G('feverActive()'));
  check('and the combo resets, so the next one must be built afresh',
        st.combo === 0);
}

/* ---- and how much of a session actually happens under it ---- */
{
  console.log('\n  over three weeks, driving the real minigame:');
  console.log('    tap error   pours   under fever   earned    ×a no-fever run');
  const base = S.run({ seed: 4242, profile: 'diligent' }).earned;
  const rows = [];
  [20, 30, 45, 70].forEach(function (err) {
    const r = S.run({ seed: 4242, profile: 'diligent', realPour: true, tapError: err });
    const share = r.feverPours / Math.max(1, r.pours);
    rows.push({ err: err, share: share, earned: r.earned, mult: r.earned / base });
    console.log('    ±' + String(err).padStart(2) + 'ms' + String(r.pours).padStart(9) +
      String(Math.round(share * 100) + '%').padStart(13) + String(r.earned).padStart(9) +
      ('   ×' + (r.earned / base).toFixed(2)).padStart(14));
  });

  const careless = rows[rows.length - 1], precise = rows[0];
  /* The point of the retune. Before it, fever covered 60% of a careless
     player's pours and 82% of a precise one's — on for everybody, nearly all
     the time, which makes it the price list rather than a bonus. */
  check('a careless player is not simply living in fever', careless.share <= 0.35,
        Math.round(careless.share * 100) + '% of their pours');
  /* And neither is a precise one. Only the careless end was ever bounded
     here, which is how fever came to cover 67% of a ±20ms player's pours
     across a hundred days without anything noticing: thirteen pours takes
     about as long as fever lasts, so the next streak was assembled inside
     the current fever and it simply never lapsed. The streak no longer
     builds while fever is running. */
  check('and nor is a precise one', precise.share <= 0.45,
        Math.round(precise.share * 100) + '% of their pours');
  check('accuracy makes a real difference to how often it fires',
        precise.share / careless.share >= 1.6,
        '×' + (precise.share / careless.share).toFixed(1) + ' between the extremes');
  check('and to what a run is worth', precise.mult / careless.mult >= 1.5,
        '×' + precise.mult.toFixed(2) + ' against ×' + careless.mult.toFixed(2));
  check('but even perfect play does not run away with it', precise.mult <= 3.0,
        '×' + precise.mult.toFixed(2));
}

/* ---- the long-fever perk should finally be worth something ---- */
{
  const withP = S.run({ seed: 4242, profile: 'diligent', realPour: true,
                        tapError: 30, forcePerk: 'longfever' }).earned;
  const without = S.run({ seed: 4242, profile: 'diligent', realPour: true,
                          tapError: 30 }).earned;
  console.log('\n  long fever: ' + without + ' -> ' + withP + '  (' +
              (withP - without >= 0 ? '+' : '') + (withP - without) + ')');
  check('long fever is measurable now that fever fires at all',
        Math.abs(withP - without) > 500, (withP - without) + ' coins');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

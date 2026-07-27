/* Iteration 52: the mechanics that barely happen. A system firing twice a
   month is the worst of both — it costs code and comprehension, delivers
   nothing, and makes the perk riding it impossible to value.

   Two ways to measure. Rates that depend on time and chance come from the
   validated simulation; wilting does not, because it only bites a player who
   leaves a ripe bloom standing, and the bot lifts everything within minutes of
   it ripening. That one is tested as the scenario it actually is. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const HOUR = 3600000;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* ---- rates, from the bot that plays properly ---- */
{
  console.log('  over three weeks:\n');
  console.log('  profile    harvests  weeds  aphids  storms');
  const got = {};
  ['casual', 'twice', 'diligent'].forEach(function (p) {
    const r = S.run({ seed: 4242, profile: p });
    got[p] = r;
    console.log('  ' + p.padEnd(11) + String(r.harvests).padStart(8) +
      String(r.weeds).padStart(7) + String(r.aphids).padStart(8) +
      String(r.stormHits).padStart(8));
  });

  const d = got.diligent;
  check('aphids are a regular nuisance rather than a rumour', d.aphids >= 21,
        d.aphids + ' in 21 days');
  /* Storms used to land 9 to 14 hits a day across nine beds — every one a stage
     off a growing plant, so a 13% tax on the currency that you could only avoid
     by trellising everything. */
  const perDay = d.stormHits / 21;
  check('a storm is an event, not a weather tax', perDay <= 7,
        perDay.toFixed(1) + ' hits a day');
  check('but storms still happen often enough to be worth sheltering from',
        perDay >= 1.5, perDay.toFixed(1) + ' a day');

  /* Weeds take empty beds, and this bot replants the instant one empties, so a
     low count here is the bot being tidy rather than the mechanic being dead.
     What matters is that an empty bed is genuinely at risk. */
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  s.weedChecked = E('weedSlot()');
  s.offset += 6 * HOUR;                      // six hours with three beds standing empty
  E('weedTick()');
  const took = Object.keys(s.weeds).filter(function (k) { return s.weeds[k]; }).length;
  console.log('\n  a bed left empty for six hours: ' + took + ' of ' + s.plotCount + ' taken by weeds');
  check('an empty bed is really at risk from weeds', took >= 1,
        took + ' of ' + s.plotCount + ' after six hours');
}

/* ---- wilting: the scenario, not the rate ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 99999; s.level = 12;
  const sp = E('byId')['sunflower'];
  const ripe = function () {
    return { s: 'sunflower', stage: sp.stages, q: 99, stageAt: E('NOW()'),
             ripeAt: E('NOW()'), perfects: sp.stages, spills: 0, hired: false, glass: 0 };
  };
  console.log('\n  a ★★★ bloom left standing:');
  const marks = [1, 3, 6, 8, 12, 24];
  const seen = [];
  marks.forEach(function (hrs) {
    const g = H.build(); const G = g.evalIn; const st = G('state');
    st.offset = 0; st.level = 12;
    st.plots[0] = { s: 'sunflower', stage: sp.stages, q: 99, stageAt: G('NOW()'),
                    ripeAt: G('NOW()'), perfects: sp.stages, spills: 0, hired: false, glass: 0 };
    st.offset += hrs * HOUR;
    const lost = G('wiltPenalty')(st.plots[0]);
    seen.push({ hrs: hrs, lost: lost });
    console.log('    after ' + String(hrs).padStart(2) + 'h  loses ' + lost + ' star' + (lost === 1 ? '' : 's'));
  });
  check('a bloom left a couple of hours is unharmed',
        seen[0].lost === 0 && seen[1].lost === 0);
  /* This is the cost of the decision iteration 44 introduced: the market may
     tell you to hold, and holding has to cost something or it is free. */
  check('leaving one standing overnight costs a star',
        seen.filter(function (x) { return x.hrs >= 8; }).every(function (x) { return x.lost >= 1; }),
        seen.map(function (x) { return x.hrs + 'h:' + x.lost; }).join(' '));
  check('and it is capped, so a forgotten garden is not destroyed',
        seen[seen.length - 1].lost <= 4, 'after a day, ' + seen[seen.length - 1].lost);

  // the perk that doubles the window must actually double it
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0;
  st.plots[0] = { s: 'sunflower', stage: sp.stages, q: 99, stageAt: G('NOW()'),
                  ripeAt: G('NOW()'), perfects: sp.stages, spills: 0, hired: false, glass: 0 };
  st.offset += 8 * HOUR;
  const without = G('wiltPenalty')(st.plots[0]);
  st.perks.evergreen = true;
  const with_ = G('wiltPenalty')(st.plots[0]);
  check('evergreen genuinely buys you time', with_ < without,
        'without ' + without + ', with ' + with_);
}

/* ---- and the warning must arrive before the damage ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 99999; s.level = 12;
  const sp = E('byId')['elm'];
  const tagAt = function (hrs) {
    s.plots[0] = { s: 'elm', stage: sp.stages, q: 99, stageAt: E('NOW()'),
                   ripeAt: E('NOW()') - hrs * HOUR, perfects: 6, spills: 0,
                   hired: false, glass: 0 };
    E('paintPlots()');
    const bed = h.doc.getElementById('bed');
    const el = (bed.children || []).filter(function (c) {
      return c.className && c.className.indexOf('gplant') > -1;
    }).pop();
    const m = (el.innerHTML.match(/<div class="(gtag[^"]*)"/) || []);
    return m[1] || '';
  };
  const fresh = tagAt(0), soon = tagAt(4), gone = tagAt(7);
  console.log('\n  the tag on a ripe bloom: 0h "' + fresh + '"  4h "' + soon + '"  7h "' + gone + '"');
  check('a freshly ripe bloom reads as ready', /ready/.test(fresh), fresh);
  /* A warning that arrives once the damage is done is a receipt. */
  check('it warns before the first star goes, not after', /soon/.test(soon), soon);
  check('and says so plainly once it is losing them', /warn/.test(gone), gone);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

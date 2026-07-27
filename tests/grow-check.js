/* Iteration 86: every species, grown from seed to a perfect bloom, one at a
   time, through the real minigame.

   The shelf has been costed, the drawings have been read, the fractions have
   been checked against the renderer. Nobody had ever grown one. Everything
   below is a plant put in the ground, poured stage by stage through
   startPour and lockPour, lifted, and looked at.

   What that turned up: a perfect pour is worth one care point, not two. The
   second comes from `prefMatch` — watering in the species' favourite hours.
   So the clock-carried plant, which is what an idle gardener harvests, reaches
   ★★★ only when the hour suits it: at the wrong hour thirteen of the fifteen
   are capped at ★★ however precisely you pour, and the evening gardener has
   more of the shelf out of hours than the morning one — eight species against
   five, including the dearest plant in the game. That is what the shelf's ☀️/🌙 badge is for, and the
   game has three answers to it — the golden hour, the lantern and the hive —
   each of which is exercised below. The lantern was only half of one until
   this iteration: it lifted night-lovers alone, five species of fifteen and
   neither of the two the money is in. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SPECIES = E('SPECIES');

/* Put the world's clock at a given local hour without disturbing the plant.

   The harness pins Date.now() to a fixed epoch, so this has to be figured
   from the game's own clock rather than the host's — measuring the offset
   against the real wall clock put every reading twelve hours out and made a
   day-lover look like it preferred one in the morning. */
function snapHour(G, hour) {
  const s = G('state');
  const d = new Date(G('NOW()'));
  d.setHours(hour, 30, 0, 0);
  s.offset = d.getTime() - G('Date.now()');
}

/* Grow one plant to ripe and lift it.
     hour    — the local hour to pour in
     byHand  — pour every stage yourself, never letting the clock take one
     aim     — tap error in milliseconds; 0 is dead centre
     glass / lantern / bees — the escapes, switched on one at a time */
function grow(id, o) {
  o = o || {};
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 99999; s.level = 18; s.water = 400;
  const sp = G('byId')[id];
  if (o.lantern) { s.decos = s.decos || {}; s.decos.lantern = true; }
  G('plant(0,"' + id + '")');
  if (!s.plots[0]) return { failed: 'would not plant' };
  G('curPlot = 0');
  if (o.glass) G('buyGlass()');

  /* Unless we are pouring it all by hand, let the clock take it as far as it
     will — which is what an idle gardener comes home to. Advance a fortnight
     rather than a computed span: a stage's real duration is growMin divided
     by the growth rate, and weather and season move that rate, so
     ceiling × growMin left two species a stage short of their ceiling and
     made the split look uneven when it was not. The time it actually took is
     then read off stageAt, which the clock advances stage by stage. */
  const planted = G('NOW()');
  const ceil = o.byHand ? 0 : G('timerCeiling')(sp, s.plots[0]);
  let hours = 0;
  if (ceil > 0) {
    s.offset += 14 * 24 * 3600000;
    G('growthTick()');
    hours = (s.plots[0].stageAt - planted) / 3600000;
  }
  const free = s.plots[0].stage;
  if (o.bees) {
    s.hive = true;
    s.pollenSlot = Math.floor(G('NOW()') / G('POLLEN_SLOT_MS')) - 3;
    G('pollenTick()');
  }
  snapHour(G, o.hour === undefined ? 12 : o.hour);

  let pours = 0, spilled = 0, guard = 0;
  while (s.plots[0] && s.plots[0].stage < sp.stages && guard++ < 40) {
    G('startPour()');
    const pr = G('pour');
    if (!pr) break;
    /* markerPos is (now - t0)/period folded into a triangle, so setting t0
       backwards by exactly the fraction we want lands the drop there. Aim
       away from whichever edge is nearer, or a big error clamps at the end
       of the bar and comes out smaller than it was meant to be. */
    const wide = o.wideEvery && pours % o.wideEvery === 0;
    const err = (wide ? o.wide : (o.aim || 0)) / (pr.period / 2) *
                (pr.center > 0.5 ? -1 : 1);
    const target = Math.max(0.001, Math.min(0.999, pr.center + err));
    pr.t0 = G('performance.now()') - target * pr.period;
    const before = s.plots[0].stage;
    G('lockPour()');
    pours++;
    if (!s.plots[0]) break;
    if (s.plots[0].stage === before) spilled++;
  }

  const p = s.plots[0];
  const stars = p ? G('starsFor')(sp, p.q) : 0;
  const held = G('barnCountAll()');
  G('harvest()');
  return {
    sp: sp, free: free, pours: pours, spilled: spilled, stars: stars,
    q: p ? p.q : 0, tiers: Object.keys(s.barn[id] || {}),
    banked: G('barnCountAll()') > held, almanac: s.almanac[id] | 0,
    hours: hours, G: G, s: s
  };
}

function favouriteHour(sp) { return sp.pref === 'night' ? 1 : 12; }
function wrongHour(sp) { return sp.pref === 'night' ? 12 : 1; }

/* ---- every species, poured by hand from seed ---- */
{
  console.log('  every species, every stage poured by hand, in its own good hour:');
  console.log('    species        drops   spilled   care   stars   banked as');
  const notThree = [], notBanked = [], spilt = [], failed = [];
  SPECIES.forEach(function (sp) {
    const r = grow(sp.id, { aim: 0, byHand: true, hour: favouriteHour(sp) });
    if (r.failed) return failed.push(sp.id + ': ' + r.failed);
    console.log('    ' + sp.id.padEnd(14) + String(r.pours).padStart(5) +
      String(r.spilled).padStart(10) + String(r.q).padStart(7) +
      ('★'.repeat(r.stars)).padStart(8) + '   ' + r.tiers.join(','));
    if (r.pours !== sp.stages) spilt.push(sp.id + ' took ' + r.pours + ' of ' + sp.stages);
    if (r.stars < 3) notThree.push(sp.id + ' reached ★' + r.stars + ' on ' + r.q + ' care');
    if (!r.banked) notBanked.push(sp.id);
    if (r.spilled) spilt.push(sp.id + ' spilled ' + r.spilled);
  });
  check('every species can be planted and grown to ripe', !failed.length, failed.join('; '));
  check('a hand-poured plant takes exactly one drop a stage', !spilt.length, spilt.join('; '));
  check('and every one of the fifteen reaches ★★★', !notThree.length, notThree.join('; '));
  check('and every one lands in the barn', !notBanked.length, notBanked.join(', '));
}

/* ---- the same, at the hour that does not suit them ---- */
{
  const bad = SPECIES.map(function (sp) {
    return { sp: sp, r: grow(sp.id, { aim: 0, byHand: true, hour: wrongHour(sp) }) };
  }).filter(function (x) { return x.r.stars < 3; });
  console.log('\n  hand-poured at the wrong hour, still ★★★: ' +
              (SPECIES.length - bad.length) + ' of ' + SPECIES.length);
  check('pouring every stage yourself earns ★★★ whatever the hour',
        !bad.length, bad.map(function (x) { return x.sp.id + ' ★' + x.r.stars; }).join(', '));
}

/* ---- and what the idle gardener comes home to ---- */
{
  console.log('\n  left to the clock, then poured out — in its good hour and in the wrong one:');
  console.log('    species      clock gives   you pour   good hour   wrong hour   hours');
  const missedGood = [], cappedWrong = [];
  const rows = [];
  SPECIES.forEach(function (sp) {
    const good = grow(sp.id, { aim: 0, hour: favouriteHour(sp) });
    const bad = grow(sp.id, { aim: 0, hour: wrongHour(sp) });
    rows.push({ sp: sp, good: good, bad: bad });
    console.log('    ' + sp.id.padEnd(12) + String(good.free).padStart(8) +
      String(good.pours).padStart(11) +
      ('★'.repeat(good.stars) + ' (' + good.q + ')').padStart(12) +
      ('★'.repeat(bad.stars) + ' (' + bad.q + ')').padStart(13) +
      good.hours.toFixed(1).padStart(8));
    if (good.stars < 3) missedGood.push(sp.id + ' ★' + good.stars + ' on ' + good.q + ' care');
    if (bad.stars < 3) cappedWrong.push(sp.id);
  });
  check('a plant the clock carried still reaches ★★★ in its favourite hours',
        !missedGood.length, missedGood.join('; '));

  /* The finding, recorded rather than smoothed over: the second care point on
     a drop is the hour, not the aim. An easygoing plant matches always, so
     precision alone carries it; the other nine need the hour as well. */
  const anyPref = SPECIES.filter(function (s) { return s.pref === 'any'; })
                         .map(function (s) { return s.id; });
  console.log('    capped at ★★ at the wrong hour: ' + cappedWrong.length + ' of ' +
              SPECIES.length + ' — every species that is not easygoing');
  check('and is capped at ★★ at the wrong hour, on exactly the fussy species',
        cappedWrong.length === SPECIES.length - anyPref.length &&
        cappedWrong.every(function (id) { return anyPref.indexOf(id) < 0; }),
        cappedWrong.join(', ') + ' against easygoing ' + anyPref.join(', '));
  check('so an easygoing species is never held back by the clock',
        anyPref.every(function (id) {
          return rows.filter(function (r) { return r.sp.id === id; })[0].bad.stars === 3;
        }), anyPref.join(', '));

  /* Both halves of the split must matter: the clock has to give something and
     leave something, or one of the two is decoration. */
  check('the clock carries every plant part of the way',
        rows.every(function (r) { return r.good.free > 0; }));
  check('and never all of the way',
        rows.every(function (r) { return r.good.pours > 0; }));
  check('and what it gives is about half',
        rows.every(function (r) {
          const share = r.good.free / r.sp.stages;
          return share >= 0.4 && share <= 0.75;
        }),
        rows.map(function (r) {
          return r.sp.id + ' ' + Math.round(r.good.free / r.sp.stages * 100) + '%';
        }).slice(0, 3).join(', '));
  check('and no plant sits more than a working day reaching its ceiling',
        rows.every(function (r) { return r.good.hours <= 8; }),
        rows.filter(function (r) { return r.good.hours > 8; })
            .map(function (r) { return r.sp.id + ' ' + r.good.hours.toFixed(1) + 'h'; }).join(', '));
}

/* ---- the four ways out of the wrong hour ---- */
{
  /* A day-lover, clock-carried, poured at one in the morning: the case the
     row above shows capped at ★★. Each of these must lift it. */
  const day = SPECIES.filter(function (s) { return s.pref === 'day'; })[0];
  const night = SPECIES.filter(function (s) { return s.pref === 'night'; })[0];
  console.log('\n  ' + day.id + ' (☀️) left to the clock and poured at 01:30 — ★' +
              grow(day.id, { aim: 0, hour: 1 }).stars);
  const golden = grow(day.id, { aim: 0, hour: 18 });     // dusk suits everything
  console.log('    poured at dusk instead:            ★' + golden.stars +
              ' on ' + golden.q + ' care');
  check('the golden hour lifts a plant poured at the wrong time of day',
        golden.stars === 3, '★' + golden.stars);

  /* The lantern used to lift night-lovers only — five species of fifteen, and
     neither of the two the money is in. Both halves of the shelf now. */
  const lampNight = grow(night.id, { aim: 0, hour: 12, lantern: true });
  const lampDay = grow(day.id, { aim: 0, hour: 1, lantern: true });
  console.log('    ' + night.id + ' (🌙) at noon under a lantern:      ★' + lampNight.stars +
              ' on ' + lampNight.q + ' care');
  console.log('    ' + day.id + ' (☀️) at 01:30 under a lantern:     ★' + lampDay.stars +
              ' on ' + lampDay.q + ' care');
  check('a lantern lifts a night-lover watered in daylight',
        lampNight.stars === 3, '★' + lampNight.stars);
  check('and a day-lover watered after dark, which it used not to',
        lampDay.stars === 3, '★' + lampDay.stars);
  check('and its blurb no longer promises only half of that',
        !/night-lover/i.test(E('DECOS').filter(function (d) { return d.id === 'lantern'; })[0].blurb),
        E('DECOS').filter(function (d) { return d.id === 'lantern'; })[0].blurb);

  const bare = grow(day.id, { aim: 0, hour: 1 });
  const bees = grow(day.id, { aim: 0, hour: 1, bees: true });
  console.log('    ' + day.id + ' (☀️) at 01:30 with a hive:        ★' + bees.stars +
              ' on ' + bees.q + ' care (against ' + bare.q + ' without)');
  check('and the bees hand you care you did not pour for',
        bees.q > bare.q, bare.q + ' -> ' + bees.q);

  /* And it has to say so the first time a drop lands outside the hours,
     because the badge that would tell you is on the screen behind the bar. */
  const tx = E('HINTS').hours.tx.replace(/<[^>]+>/g, '');
  console.log('    the game says: "' + tx.slice(0, 96) + '…"');
  check('the game says a drop out of hours is worth half',
        /one care point/.test(tx) && /right hour/.test(tx), tx.slice(0, 70));
  check('and names both ways out', /dawn and dusk/i.test(tx) && /lantern/i.test(tx));
  /* Hints are suppressed while the tutorial is running, so the coach has to
     be finished before either of these means anything. */
  function pourAt(hour) {
    const g = H.build(); const G = g.evalIn; const s = G('state');
    s.offset = 0; s.coins = 9999; s.level = 12; s.water = 40;
    G('tutor').done = true; G('tutor').hints = {};
    snapHour(G, hour);
    G('plant(0,"' + day.id + '")');
    G('curPlot = 0');
    G('startPour()');
    G('pour').t0 = G('performance.now()') - G('pour').center * G('pour').period;
    G('lockPour()');
    return G('tutor').hints;
  }
  check('and shows it when a drop actually lands out of hours',
        !!pourAt(1).hours, JSON.stringify(pourAt(1)));
  check('and stays quiet when they are watering in the right ones',
        !pourAt(12).hours, JSON.stringify(pourAt(12)));

  /* And the game has to say which hour a plant wants, before you buy it. */
  const shelf = E('prefWord')(day) + ' / ' + E('prefWord')(night) + ' / ' +
                E('prefWord')(SPECIES.filter(function (s) { return s.pref === 'any'; })[0]);
  console.log('    the shelf says: ' + shelf);
  check('and the shelf names the hour each species wants',
        /daytime/.test(shelf) && /night/.test(shelf) && /easygoing/.test(shelf), shelf);
}

/* ---- the almanac keeps the best you ever grew ---- */
{
  const r = grow('sunflower', { aim: 0, byHand: true, hour: favouriteHour(E('byId').sunflower) });
  console.log('\n  after one perfect sunflower the almanac reads ★' + r.almanac);
  check('a perfect bloom is recorded in the almanac at its quality',
        r.almanac === 3, '★' + r.almanac);
  /* Harvest a poor one afterwards and the record must stand. */
  const s = r.s, G = r.G;
  G('plant(0,"sunflower")');
  G('curPlot = 0');
  const sp = G('byId').sunflower;
  s.plots[0].stage = sp.stages; s.plots[0].q = 0; s.plots[0].ripeAt = G('NOW()');
  G('harvest()');
  console.log('  and after a ★ one on top of it: ★' + s.almanac.sunflower);
  check('and a poorer bloom afterwards does not erase it',
        s.almanac.sunflower === 3, '★' + s.almanac.sunflower);
}

/* ---- a sloppy hand costs quality, never the plant ---- */
{
  /* The good band reaches 105ms past the gold either side, and the gold's own
     half-width is 75ms at its widest — so nothing under about 180ms off ever
     spills at all. A 90ms error costs the perfect and nothing else. */
  console.log('\n  the same three with every other drop thrown 240ms wide:');
  console.log('    species      drops   spilled   care   stars   banked as');
  const lost = [], stillTop = [], nothingSpilled = [];
  ['elm', 'sunflower', 'pineapple'].forEach(function (id) {
    const sp = E('byId')[id];
    const r = grow(id, { byHand: true, wideEvery: 2, wide: 240,
                         hour: favouriteHour(sp) });
    console.log('    ' + id.padEnd(13) + String(r.pours).padStart(5) +
      String(r.spilled).padStart(10) + String(r.q).padStart(7) +
      ('★'.repeat(r.stars)).padStart(8) + '   ' + r.tiers.join(','));
    if (!r.banked) lost.push(id);
    if (!r.spilled) nothingSpilled.push(id);
    if (r.stars >= 3 && r.tiers.indexOf('p') >= 0) stillTop.push(id);
  });
  check('pouring badly really does spill drops', !nothingSpilled.length,
        nothingSpilled.join(', ') + ' spilled nothing at 240ms out');
  check('and a badly poured plant is still harvested', !lost.length, lost.join(', '));
  check('and never comes out pristine', !stillTop.length, stillTop.join(', '));
}

/* ---- under glass every stage is yours, and a clean run is flawless ---- */
{
  console.log('\n  the same three under glass, poured perfectly:');
  console.log('    species      clock gives   you pour   banked as');
  const wrong = [];
  ['elm', 'sunflower', 'pineapple'].forEach(function (id) {
    const sp = E('byId')[id];
    const r = grow(id, { aim: 0, glass: true, hour: favouriteHour(sp) });
    console.log('    ' + id.padEnd(13) + String(r.free).padStart(8) +
      String(r.pours).padStart(11) + '   ' + r.tiers.join(','));
    if (r.free !== 0) wrong.push(id + ' grew ' + r.free + ' stages on its own');
    if (r.pours !== sp.stages) wrong.push(id + ' poured ' + r.pours + ' of ' + sp.stages);
    if (r.tiers.indexOf('p') < 0) wrong.push(id + ' banked as ' + r.tiers.join(','));
  });
  check('under glass nothing grows on its own and a clean run is pristine',
        !wrong.length, wrong.join('; '));
}

/* ---- what a ★★★ bloom really costs, measured from the grow ---- */
{
  const rows = SPECIES.map(function (sp) {
    const r = grow(sp.id, { aim: 0, hour: favouriteHour(sp) });
    const net = sp.price * E('STAR_MULT')[3] - sp.seed;
    return { id: sp.id, pours: r.pours, hours: r.hours, per: net / Math.max(1, r.pours) };
  });
  console.log('\n  what a ★★★ bloom costs and pays, from the grow rather than the table:');
  console.log('    species        drops    hours   coins per drop');
  rows.forEach(function (r) {
    console.log('    ' + r.id.padEnd(14) + String(r.pours).padStart(5) +
      r.hours.toFixed(1).padStart(9) + r.per.toFixed(1).padStart(14));
  });
  check('the coins-per-drop ladder holds when the plants are actually grown',
        rows.every(function (r, i) { return i === 0 || r.per >= rows[i - 1].per * 0.75; }),
        rows.map(function (r) { return r.id + ' ' + r.per.toFixed(0); }).join(' '));
  check('and the top of the shelf pays several times the bottom',
        rows[rows.length - 1].per > rows[0].per * 4,
        rows[0].per.toFixed(1) + ' -> ' + rows[rows.length - 1].per.toFixed(1));
}

/* ---- why the evening is the worse shift, before any simulation ----
   This is the whole finding stated deterministically: which species are out
   of hours at nine in the morning and at nine at night, and what the dearest
   of them is worth. No seeds, no averaging, nothing to be noisy about. */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  function outOfHours(hour) {
    snapHour(G, hour);
    return G('SPECIES').filter(function (sp) { return !G('prefMatch')(sp); });
  }
  const morn = outOfHours(9), eve = outOfHours(21);
  /* Shelf price, not `priceOf` — that one carries the day's weather and mood,
     so it moves with the harness epoch and would put a different pair of
     numbers in the log every time the fixed clock is retuned. */
  function dearest(list) {
    return list.reduce(function (a, sp) { return Math.max(a, sp.price); }, 0);
  }
  console.log('\n  out of hours at 09:00: ' + morn.length + ' of 15, dearest ' +
              dearest(morn) + '🪙 — ' + morn.map(function (x) { return x.id; }).join(' '));
  console.log('  out of hours at 21:00: ' + eve.length + ' of 15, dearest ' +
              dearest(eve) + '🪙 — ' + eve.map(function (x) { return x.id; }).join(' '));
  check('the evening gardener has more of the shelf out of hours',
        eve.length > morn.length, morn.length + ' against ' + eve.length);
  check('and the dearest plant they cannot star is worth far more',
        dearest(eve) > dearest(morn) * 2,
        dearest(morn) + '🪙 against ' + dearest(eve) + '🪙');
  /* And the top of the shelf must be among them, or the gap is a rounding
     error rather than the thing the money is in. */
  const top = G('SPECIES')[G('SPECIES').length - 1];
  check('and the dearest plant in the game is one of them',
        eve.indexOf(top) >= 0, top.id);
  s.offset = 0;
}

/* ---- and what that is worth over a fortnight of real play ---- */
{
  const S = require('./sim.js');
  /* Six seeds, and casual only. Four said the gap was 18.3% and the lantern
     was worth 0.2% to a morning gardener; eight said 10.8% and 2.2%. The
     numbers below are a magnitude, not a measurement — the check above is the
     measurement. */
  const SEEDS = [11, 22, 33, 44, 55, 66];
  function mean(cfg) {
    let e = 0;
    SEEDS.forEach(function (seed) {
      e += S.run(Object.assign({ seed: seed, realPour: true, tapError: 30,
                                 days: 14, forOrders: false }, cfg)).earned;
    });
    return e / SEEDS.length;
  }
  console.log('\n  a fortnight, ' + SEEDS.length + ' seeds, once a day, by the hour kept:');
  console.log('    hour   bare      with a lantern');
  const rows = { casual: {} };
  [9, 21].forEach(function (hr) {
    const bare = mean({ profile: 'casual', startHour: hr });
    const lamp = mean({ profile: 'casual', startHour: hr, deco: 'lantern' });
    rows.casual[hr] = { bare: bare, lamp: lamp };
    console.log('    ' + (hr + 'h').padEnd(7) + Math.round(bare).toString().padStart(6) +
      Math.round(lamp).toString().padStart(15) +
      '  (' + ((lamp / bare - 1) * 100).toFixed(1) + '%)');
  });

  const gap = 1 - rows.casual[21].bare / rows.casual[9].bare;
  console.log('    the evening gardener earns ' + (gap * 100).toFixed(1) +
              '% less than the morning one, bare');
  check('the hour a player keeps is worth real money',
        gap > 0.05, (gap * 100).toFixed(1) + '%');
  check('and the lantern is what closes most of that gap',
        1 - rows.casual[21].lamp / rows.casual[9].bare < gap * 0.6,
        (gap * 100).toFixed(1) + '% -> ' +
        ((1 - rows.casual[21].lamp / rows.casual[9].bare) * 100).toFixed(1) + '%');
  /* And it has to be worth more to the player who keeps the wrong hours than
     to the one who keeps the right ones, or it is not a fix, it is a flat
     bonus everybody has to buy.

     Stated as a comparison, not as an absolute. An earlier version asserted
     it was worth under 3% to the morning player and read 0.2% four times
     running — then 6.8% once the sim's day alignment moved by a few hours,
     because a morning gardener still has five night-loving species out of
     hours and how much they plant of them is a seed-by-seed accident. What
     is not an accident is the shape underneath, which the block above states
     without a simulation at all. */
  const morning = rows.casual[9].lamp / rows.casual[9].bare - 1;
  const evening = rows.casual[21].lamp / rows.casual[21].bare - 1;
  check('and is worth more to the gardener who keeps the wrong hours',
        evening > morning * 1.5,
        (morning * 100).toFixed(1) + '% against ' + (evening * 100).toFixed(1) + '%');
  const lamp = E('DECOS').filter(function (d) { return d.id === 'lantern'; })[0];
  const worth = rows.casual[21].lamp - rows.casual[21].bare;
  console.log('    it costs ' + lamp.cost + '🪙 and returns ' + Math.round(worth) +
              '🪙 over the fortnight it is measured in');
  check('and costs enough to be a decision', lamp.cost >= 1000, String(lamp.cost));
  check('but pays for itself well inside a fortnight', worth > lamp.cost * 2,
        lamp.cost + '🪙 for ' + Math.round(worth) + '🪙');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

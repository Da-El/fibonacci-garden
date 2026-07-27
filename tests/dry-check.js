/* Iteration 31: the dry spell. It only works if it is always announced a
   day ahead, if the run length is what it claims, and if a gardener who
   filled the can beats one who did not. */
const H = require('./harness.js');
const HOUR = 3600000, DAY = 24 * HOUR;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn; const s = E('state');
const RUN = E('DRY_RUN_DAYS');

/* ---- frequency and run length over a long stretch ---- */
{
  const today = E('dayIndex()');
  let dry = 0, runs = [], cur = 0, maxRun = 0;
  for (let d = 0; d < 700; d++) {
    if (E('isDryDay')(today + d)) { dry++; cur++; }
    else { if (cur) { runs.push(cur); if (cur > maxRun) maxRun = cur; } cur = 0; }
  }
  const share = dry / 700;
  check('a dry spell covers about two days in seven',
        share > 0.24 && share < 0.32, Math.round(share * 100) + '% of days');
  check('runs are never longer than the declared length', maxRun === RUN,
        'longest run ' + maxRun + ', declared ' + RUN);
  check('every run is the full declared length',
        runs.every(function (r) { return r === RUN; }),
        'lengths seen: ' + Array.from(new Set(runs)).join(','));
}

/* ---- the notice must never be missing ---- */
{
  s.offset = 0;
  const today = E('dayIndex()');
  let unannounced = 0;
  for (let d = 1; d < 400; d++) {
    const day = today + d;
    const startsToday = E('isDryDay')(day) && !E('isDryDay')(day - 1);
    if (!startsToday) continue;
    // stand on the day before and ask how far away it is
    s.offset = (d - 1) * DAY;
    if (E('dryDaysAway()') !== 1) unannounced++;
  }
  check('every spell is announced the day before', unannounced === 0,
        unannounced + ' arrived unannounced');
}

/* ---- the effects are real and the right size ----
   Averaged over many days of each kind. A single-day comparison is useless
   here: priceMult is a per-day roll of ±15%, which is the same size as the
   effect being measured, and regenIntervalMs also folds in the weather. */
{
  s.offset = 0;
  const today = E('dayIndex()');
  const dryDays = [], wetDays = [];
  for (let d = 0; d < 210; d++) (E('isDryDay')(today + d) ? dryDays : wetDays).push(d);
  check('the sample has both kinds of day', dryDays.length > 20 && wetDays.length > 20,
        dryDays.length + ' dry, ' + wetDays.length + ' wet');

  const mean = function (days, fn) {
    let t = 0;
    days.forEach(function (d) { s.offset = d * DAY; t += fn(); });
    return t / days.length;
  };
  // regen with the weather divided back out, so only the spell is left
  const regenOf = function () { return E('regenIntervalMs()') * E('weatherNow().regen'); };
  const rDry = mean(dryDays, regenOf), rWet = mean(wetDays, regenOf);
  check('a drop takes twice as long in a dry spell',
        Math.abs(rDry / rWet - E('DRY_REGEN')) < 0.02,
        'ratio ' + (rDry / rWet).toFixed(3) + ' vs declared ' + E('DRY_REGEN'));

  const priceOf1 = function () { return E('priceOf')(E('byId')['elm'], 1); };  // sellMult pinned
  const pDry = mean(dryDays, priceOf1), pWet = mean(wetDays, priceOf1);
  check('prices are up by the declared amount in a dry spell',
        Math.abs(pDry / pWet - E('DRY_SELL')) < 0.06,
        'ratio ' + (pDry / pWet).toFixed(3) + ' vs declared ' + E('DRY_SELL'));
}

/* ---- does preparing pay? Two gardeners, same dry spell. ---- */
{
  const sim = function (prepare) {
    const g = H.build(); const G = g.evalIn; const st = G('state');
    st.coins = 999999; st.level = 8; st.canTier = 4;      // the 89-drop can
    // stand on the day before a spell
    const today = G('dayIndex()');
    let d = 0;
    while (d < 60 && !(G('isDryDay')(today + d) && !G('isDryDay')(today + d - 1))) d++;
    st.offset = (d - 1) * DAY;
    st.water = prepare ? G('waterCap()') : 0;             // full can, or empty
    st.lastTick = G('NOW()');
    let poured = 0;
    // two days of the spell: keep a bed going and pour whenever there is water
    for (let hh = 0; hh < 48; hh++) {
      st.offset += HOUR;
      G('tickWater()');
      for (let i = 0; i < st.plotCount; i++) {
        if (!st.plots[i]) G('plant(' + i + ',"elm")');
      }
      G('growthTick()');
      for (let i = 0; i < st.plotCount; i++) {
        const p = st.plots[i];
        if (!p) continue;
        const sp = G('byId')[p.s];
        while (st.water > 0 && st.plots[i] && st.plots[i].stage < sp.stages) {
          G('curPlot = ' + i);
          G('advanceStage("water", true)');
          poured++;
        }
        if (st.plots[i] && st.plots[i].stage >= sp.stages) { G('curPlot = ' + i); G('bankHarvest(' + i + ')'); }
      }
    }
    return poured;
  };
  const ready = sim(true), caught = sim(false);
  check('a full can before the spell buys real extra watering', ready > caught,
        'prepared poured ' + ready + ' vs unprepared ' + caught);
  check('the advantage is meaningful, not a rounding error',
        ready - caught >= 10, 'difference ' + (ready - caught) + ' pours');
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

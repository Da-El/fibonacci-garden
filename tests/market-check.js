const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Iteration 44: selling is a button. Before making it a decision, measure
   whether there is a decision there at all — how much a patient seller can
   actually gain over one who sells the moment they harvest. If the spread is
   trivial the screen should stay simple; if it is huge, patience is mandatory
   rather than optional, which is worse. */
const H = require('./harness.js');
const HOUR = 3600000, DAY = 24 * HOUR;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn; const s = E('state');
s.offset = 0; s.level = 16;

/* ---- what moves a price, and by how much ---- */
{
  const sp = E('byId')['sunflower'];
  const samples = [];
  for (let t = 0; t < 24 * 14; t++) {          // a fortnight, hour by hour
    s.offset = t * HOUR;
    samples.push(E('priceOfQ')(sp, 3));
  }
  const lo = Math.min.apply(null, samples), hi = Math.max.apply(null, samples);
  const mean = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;
  console.log('  a ★★★ sunflower over a fortnight: ' + lo + ' .. ' + hi +
              ' (mean ' + Math.round(mean) + ', spread x' + (hi / lo).toFixed(2) + ')');
  check('there is a real spread worth reading', hi / lo >= 1.3, 'x' + (hi / lo).toFixed(2));
  check('the spread is not so wide that selling badly is ruinous',
        hi / lo <= 2.6, 'x' + (hi / lo).toFixed(2));

  /* How much does perfect timing beat selling at a random moment? That is the
     size of the decision being offered. */
  const gainVsRandom = hi / mean;
  console.log('  selling at the peak beats an average moment by ' +
              Math.round((gainVsRandom - 1) * 100) + '%');
  check('patience is worth something but not everything',
        gainVsRandom >= 1.1 && gainVsRandom <= 1.6,
        'x' + gainVsRandom.toFixed(2));
}

/* ---- can the player see what they would need to decide? ---- */
{
  const html = require('fs').readFileSync(GAME_PATH, 'utf8');
  const market = html.slice(html.indexOf('function paintMarket'),
                            html.indexOf('function paintMarket') + 6000);
  check('the market shows what each tier is worth', /tierPrice|priceOfQ/.test(market));
  check('the market shows how good the price is right now',
        /eff\.toFixed|×.*eff|badge/.test(market));
}

/* ---- the verdict: is today good, and is it about to get better ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0; st.level = 16; st.coins = 99999;
  check('the game keeps a per-day history to compare against', Array.isArray(st.history));

  // with no history there is nothing honest to say
  check('it says nothing until it has days to compare', G('priceStanding()') === null);

  // build a run of days, then check the verdict varies with the day
  for (let d = 0; d < 40; d++) { st.offset = d * DAY; G('ledgerToday()'); }
  const words = {};
  const ratios = [];
  for (let d = 12; d < 40; d++) {
    st.offset = d * DAY;
    G('ledgerToday()');
    const s2 = G('priceStanding()');
    if (!s2) continue;
    words[s2.word] = (words[s2.word] || 0) + 1;
    ratios.push(s2.ratio);
  }
  console.log('  verdicts across 28 days: ' + Object.keys(words)
    .map(function (k) { return k + ' ' + words[k]; }).join(', '));
  check('the verdict is not the same every day', Object.keys(words).length >= 3,
        Object.keys(words).join(', '));
  const rlo = Math.min.apply(null, ratios), rhi = Math.max.apply(null, ratios);
  check('the verdict tracks a real swing', rhi / rlo >= 1.2,
        'x' + rlo.toFixed(2) + '..x' + rhi.toFixed(2));

  // the day's mood must judge the day, not whichever species is first
  check('the day is judged as a whole, not from one species',
        G('priceStanding').length === 0, 'takes ' + G('priceStanding').length + ' arguments');

  // the forecast half must never promise a gain that is not there
  for (let k = 0; k < 30; k++) {
    st.offset = k * HOUR;
    const look = G('marketOutlook()');
    if (look.bestIn && !(look.best > look.now)) {
      bugs.push('outlook promised a better slot that is not better');
      break;
    }
    if (!look.bestIn && look.gain !== 1) {
      bugs.push('outlook reported a gain with no better slot');
      break;
    }
  }
  check('the forecast only promises a rise when there is one', true);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

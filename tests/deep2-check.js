/* Iteration 93: a deepening pass over 89–92.

   Each of those four found one thing. This asks whether each finding was the
   only instance of its kind, because a defect found once is usually a defect
   with siblings:

     90 found a counter that was never reset. Are there others?
     92 found one non-wrapping class holding text too wide for a phone.
        Are the other eight fine?
     91 levelled the hybrid economy. Does the bench say so?
     89 told the player which day is good. Is the hour it promises honest? */
const fs = require('fs');
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const h = H.build(); const E = h.evalIn;
const DAY = 24 * 3600000;

/* ---- 90 generalised: every counter, and which of them should lapse ---- */
{
  const counters = [];
  const re = /state\.([a-zA-Z]+) = \(state\.\1 \| 0\) \+ 1|state\.([a-zA-Z]+)\+\+/g;
  let m;
  while ((m = re.exec(html))) counters.push(m[1] || m[2]);
  const uniq = counters.filter(function (c, i) { return counters.indexOf(c) === i; }).sort();
  console.log('  counters the game increments: ' + uniq.length);
  console.log('    ' + uniq.join(', '));

  /* A counter whose name promises a run of consecutive somethings has to be
     able to fall. Everything else here is a lifetime total or a tier that
     only ever goes up, which is honest. `dailyStreak` was the one that
     promised a run and never fell; it is computed from its last day now
     rather than stored, so it does not appear in this list at all. */
  const promises = uniq.filter(function (c) { return /streak|run|chain/i.test(c); });
  console.log('  of those, ones whose name promises a run: ' +
              (promises.join(', ') || 'none'));
  check('no stored counter claims to be a streak', !promises.length,
        promises.join(', '));
  check('and the one that does is computed rather than stored',
        /function streakNow\(\)/.test(html));

  /* The combo is the other thing that has to fall, and it does — twice, on a
     spill and when fever consumes it. Asserted by driving it. */
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 900; s.level = 8; s.water = 40;
  G('plant(0,"elm")');
  G('curPlot = 0');
  s.combo = 7;
  G('startPour()');
  G('pour').t0 = G('performance.now()');            // the far end: a spill
  G('lockPour()');
  console.log('  a combo of 7, then a spilled drop: ' + s.combo);
  check('a combo falls to nothing when a drop spills', s.combo === 0,
        String(s.combo));
}

/* ---- 92 generalised: every non-wrapping class against its real content ---- */
{
  /* The narrow case, as fit-check establishes it. */
  const ROW = 320 - 36;
  function width(str, px) {
    let w = 0;
    for (const ch of String(str)) w += ch.codePointAt(0) > 0x2000 ? px * 1.15 : px * 0.6;
    return w;
  }
  /* Build every screen the game has and collect the text of every element
     carrying a class that cannot wrap. */
  const g = H.build({ width: 320 }); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 90000; s.level = 16;
  G('BASE_SPECIES').forEach(function (sp) { s.almanac[sp.id] = 3; });
  s.barn.elm = { 1: 3, 3: 2 };
  s.barn.pineapple = { 3: 2, p: 1, g: 1 };
  G('plant(0,"sunflower")');
  G('ensureOrders()');
  let markup = '';
  ['openPlanter(0)', 'paintMarket()', 'paintShop()', 'paintAlmanac()',
   'paintJournal()', 'openSettings()', 'paintLedger()', 'openBreeder()',
   'paintDailyRow()', 'paintTop()'].forEach(function (fn) {
    try { G(fn); } catch (e) { return; }
    ['card', 'barnlist', 'dailyrow', 'top', 'orderlist'].forEach(function (id) {
      try { markup += G('$')(id).innerHTML || ''; } catch (e) { /* not on this screen */ }
    });
  });

  /* Each nowrap class, its declared size, and the widest thing found in it. */
  const SIZES = {};
  const re = /\.([a-zA-Z][\w-]*)\s*\{([^}]*white-space:\s*nowrap[^}]*)\}/g;
  let m;
  while ((m = re.exec(html))) {
    const f = /font-size:\s*([\d.]+)px/.exec(m[2]);
    SIZES[m[1]] = { size: f ? +f[1] : 13, ellipsis: /ellipsis/.test(m[2]) };
  }
  console.log('\n  the widest text found in each non-wrapping class, at 320px:');
  const over = [];
  Object.keys(SIZES).forEach(function (cls) {
    const rx = new RegExp('class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>([^<]*)<', 'g');
    let mm, widest = '', w = 0;
    while ((mm = rx.exec(markup))) {
      const t = mm[1].trim();
      if (width(t, SIZES[cls].size) > w) { w = width(t, SIZES[cls].size); widest = t; }
    }
    if (!widest) return;
    console.log('    .' + cls.padEnd(12) + Math.round(w + 14).toString().padStart(4) +
      'px  "' + widest.slice(0, 40) + '"' + (SIZES[cls].ellipsis ? ' (clipped on purpose)' : ''));
    if (w + 14 > ROW && !SIZES[cls].ellipsis) {
      over.push('.' + cls + ' at ' + Math.round(w + 14) + 'px: "' + widest.slice(0, 40) + '"');
    }
  });
  check('nothing that cannot wrap is wider than a 320px row',
        !over.length, over.slice(0, 3).join('; '));
  /* And a class that deliberately clips has to declare the ellipsis, or the
     text simply stops mid-word with no sign it was cut. */
  const clippers = Object.keys(SIZES).filter(function (c) { return SIZES[c].ellipsis; });
  console.log('  classes that clip deliberately: ' + (clippers.join(', ') || 'none'));
  check('and anything meant to be cut short says so with an ellipsis',
        clippers.every(function (c) {
          return new RegExp('\\.' + c + '\\s*\\{[^}]*overflow:\\s*hidden').test(html);
        }), clippers.join(', '));
}

/* ---- 91 deepened: the bench states the rate it now levels ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 900000; s.level = 18;
  G('BASE_SPECIES').forEach(function (sp) { s.almanac[sp.id] = 3; });
  G('breedPick = {a:"romanesco",b:"pineapple"}');
  G('openBreeder()');
  const card = G('$')('card').innerHTML.replace(/<[^>]+>/g, ' ');
  console.log('\n  the bench, previewing romanesco × pineapple:');
  const line = (card.match(/sells[^·]*·[^·]*·[^·]*·?[^·]*/) || [''])[0].trim();
  console.log('    "' + line.replace(/\s+/g, ' ') + '"');
  check('the bench says what a cross would sell for', /sells\s*\d/.test(card), line);
  check('and what its seed would cost', /seed\s*\d/.test(card), line);
  check('and how many stages it would take', /\d+\s*stages/.test(card), line);
  /* Which is enough to work the rate out, and the rate is the number the
     whole economy is set from — so the bench says it rather than leaving
     three numbers and an arithmetic problem. */
  check('and states the coins per drop, which is what the shelf is priced on',
        /per drop/i.test(card), line);
}

/* ---- 89 deepened: the hour the market promises ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.level = 16;
  s.barn.pineapple = { 3: 10 };
  /* marketOutlook() promises "in N minutes, X% more". Walk forward to that
     minute and check the barn really is worth what was promised. */
  const look = G('marketOutlook()');
  console.log('\n  the market outlook says: ' + (look.bestIn
    ? 'in ' + look.mins + ' min, ×' + look.gain.toFixed(3)
    : 'nothing better in the next hour'));
  if (look.bestIn) {
    const before = G('barnValueAll()');
    s.offset += (look.mins + 1) * 60000;
    const after = G('barnValueAll()');
    console.log('    promised ×' + look.gain.toFixed(3) + ', delivered ×' +
      (after / before).toFixed(3));
    check('the hour the market promises is the hour it delivers',
          Math.abs(after / before - look.gain) < 0.02,
          look.gain.toFixed(3) + ' promised, ' + (after / before).toFixed(3) + ' given');
  } else {
    /* The other half of honest: if it says nothing is coming, nothing may. */
    const now = G('barnValueAll()');
    let best = now;
    for (let k = 1; k <= 6; k++) {
      s.offset += 10 * 60000;
      best = Math.max(best, G('barnValueAll()'));
    }
    console.log('    and over the next hour the best was ×' + (best / now).toFixed(3));
    check('when the market says nothing is coming, nothing comes',
          best <= now * 1.02, (best / now).toFixed(3));
  }
}

/* ---- the whole game: nothing the digest can show is unreachable ---- */
{
  /* The mirror of iteration 88's orphan check, run the other way: a digest
     line the game can never write is a line nobody will read. */
  const digest = html.slice(html.indexOf('function showWelcomeBack'),
                            html.indexOf('The Keepsake'));
  const read = {};
  (digest.match(/\bl\.([a-zA-Z]+)/g) || []).forEach(function (k) { read[k.slice(2)] = true; });
  const written = {};
  (html.match(/logEvent\('([a-zA-Z]+)'/g) || []).forEach(function (k) {
    written[k.slice(10, -1)] = true;
  });
  const orphanReads = Object.keys(read).filter(function (k) { return !written[k]; });
  console.log('\n  digest lines whose event nothing writes: ' +
              (orphanReads.join(', ') || 'none'));
  check('every line the digest can show is one the game can produce',
        !orphanReads.length, orphanReads.join(', '));
  console.log('  the digest reads ' + Object.keys(read).length +
              ' events; the game writes ' + Object.keys(written).length);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

/* Iteration 92: the screen at its smallest.

   scene-check lays the garden out at several widths and a11y-check measures
   tap targets, but neither has ever asked whether the *text* fits. The app
   frame is 400px and collapses to the viewport below 460, so the narrow case
   is a 320px phone with 18px of padding either side — about 284px of usable
   row — and `.view` is `overflow-x: hidden`, so anything too wide is silently
   clipped rather than scrolled to.

   Which matters because several classes are `white-space: nowrap`, and
   iterations 86-88 put whole sentences into one of them. */
const fs = require('fs');
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* The narrow case the media query hands the app. */
const NARROW = 320;
const VIEW_PAD = 18 * 2;                       // .view padding: 4px 18px 16px
const ROW_INNER = NARROW - VIEW_PAD;           // 284px of row

/* Width of a run of text at a given font size. Latin glyphs in the mono face
   sit near 0.6em; emoji are square and land near 1.15em. Deliberately an
   estimate — the point is to catch a string that is twice its container, not
   to typeset it. */
function textWidth(s, px) {
  let w = 0;
  for (const ch of String(s)) {
    w += ch.codePointAt(0) > 0x2000 ? px * 1.15 : px * 0.6;
  }
  return w;
}

/* ---- which classes cannot wrap, and how wide their box is ---- */
const NOWRAP = [];
{
  const re = /\.([a-zA-Z][\w-]*)\s*\{([^}]*white-space:\s*nowrap[^}]*)\}/g;
  let m;
  while ((m = re.exec(html))) {
    const fs2 = /font-size:\s*([\d.]+)px/.exec(m[2]);
    NOWRAP.push({ sel: '.' + m[1], size: fs2 ? +fs2[1] : 13,
                  ellipsis: /text-overflow:\s*ellipsis/.test(m[2]) });
  }
  const ids = /#([a-zA-Z][\w-]*)\s*\{([^}]*white-space:\s*nowrap[^}]*)\}/g;
  while ((m = ids.exec(html))) {
    const fs2 = /font-size:\s*([\d.]+)px/.exec(m[2]);
    NOWRAP.push({ sel: '#' + m[1], size: fs2 ? +fs2[1] : 13,
                  ellipsis: /text-overflow:\s*ellipsis/.test(m[2]) });
  }
  console.log('  classes that cannot wrap: ' + NOWRAP.map(function (n) {
    return n.sel + ' @' + n.size + 'px' + (n.ellipsis ? ' (clipped)' : '');
  }).join(', '));
  check('the app has some non-wrapping text to worry about', NOWRAP.length > 0);
  check('and every one of them declares a font size it can be measured at',
        NOWRAP.every(function (n) { return n.size > 0 && n.size < 40; }),
        NOWRAP.map(function (n) { return n.sel + ' ' + n.size; }).join(', '));
}

/* ---- what the game actually puts in the one that carries a sentence ----
   `.prefbadge` is the time-of-day pill. It sits inside an <h4> beside the
   species name on the planter, and beside the care count on the plant screen.
   Iteration 88 appended "— wait for daylight" to it at the planter, where
   the row is tightest. */
{
  const g = H.build({ width: NARROW }); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 9000; s.level = 16;
  const badge = NOWRAP.filter(function (n) { return n.sel === '.prefbadge'; })[0];
  const size = badge ? badge.size : 9;

  function planterAt(hour) {
    const d = new Date(G('NOW()'));
    d.setHours(hour, 30, 0, 0);
    s.offset = d.getTime() - G('Date.now()');
    G('openPlanter(0)');
    return G('$')('card').innerHTML;
  }
  const markup = planterAt(1) + planterAt(12) + planterAt(18);
  /* Every badge the planter can produce, at every hour that changes it. */
  const badges = (markup.match(/class="prefbadge[^"]*">([^<]*)</g) || [])
    .map(function (b) { return b.replace(/^[^>]*>/, '').replace(/<$/, ''); });
  const uniq = badges.filter(function (b, i) { return badges.indexOf(b) === i; });
  const widest = uniq.reduce(function (a, b) {
    return textWidth(b, size) > textWidth(a, size) ? b : a;
  }, uniq[0] || '');

  /* The badge sits in an <h4> beside the species name, and the h4 wraps
     normally — so a badge too wide to sit beside the name drops onto its own
     line rather than clipping. What it cannot do is break *inside* itself.
     So the constraint is the badge against the whole row, not against
     whatever the name leaves over.

     Two structural facts make that true, and both are asserted below: the
     flex child holding the text declares `min-width: 0`, without which a
     flex item refuses to shrink below its content and pushes the row wide;
     and the heading itself does not declare nowrap. Change either and this
     becomes a real clip, silently, because `.view` hides the overflow. */
  const THUMB = 52, GAP = 10;
  const room = ROW_INNER - THUMB - GAP;
  console.log('\n  a 320px phone gives a planter row ' + ROW_INNER +
    'px, of which ' + Math.round(room) + 'px is text');
  console.log('  the badges the planter can show, at ' + size + 'px:');
  uniq.forEach(function (b) {
    console.log('    ' + Math.round(textWidth(b, size) + 14).toString().padStart(4) +
      'px  "' + b + '"');
  });
  console.log('  widest: "' + widest + '" at ' +
    Math.round(textWidth(widest, size) + 14) + 'px');

  check('the planter shows a time-of-day badge at all', uniq.length > 0,
        uniq.join(' / '));
  check('and it says something different when the hour does not suit',
        uniq.length > 1, uniq.join(' / '));
  check('and no badge is wider than a 320px phone can show',
        textWidth(widest, size) + 14 <= room,
        Math.round(textWidth(widest, size) + 14) + 'px into ' + Math.round(room) + 'px');
  check('and the text column is allowed to shrink below its content',
        /\.row-item \.info \{[^}]*min-width:\s*0/.test(html));
  check('and the heading it sits in is allowed to wrap',
        !/\.row-item \.info h4 \{[^}]*white-space:\s*nowrap/.test(html));
}

/* ---- and the order tag beside it ---- */
{
  const g = H.build({ width: NARROW }); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 9000; s.level = 16;
  G('ensureOrders()');
  G('openPlanter(0)');
  const markup = G('$')('card').innerHTML;
  const tags = (markup.match(/📋[^<]*/g) || []);
  const size = 9;
  if (tags.length) {
    const w = Math.round(textWidth(tags[0], size) + 14);
    console.log('\n  an order tag reads "' + tags[0] + '" at ' + w + 'px');
    /* The tag and the time badge sit in the same <h4>. Together they must
       still leave the species name room to be read. */
    check('an order tag fits the row on its own', w <= ROW_INNER - 60,
          w + 'px into ' + (ROW_INNER - 60) + 'px');
  } else {
    console.log('\n  no order tag on the planter this run');
    check('an order tag fits the row on its own', true, 'no order shown');
  }
}

/* ---- every screen, read at both extremes ---- */
{
  const SCREENS = [
    ['the planter', 'openPlanter(0)'],
    ['the market', 'paintMarket()'],
    ['the shop', 'paintShop()'],
    ['the almanac', 'paintAlmanac()'],
    ['the journal', 'paintJournal()'],
    ['the settings', 'openSettings()'],
    ['the ledger', 'paintLedger()']
  ];
  [NARROW, 1400].forEach(function (w) {
    const g = H.build({ width: w }); const G = g.evalIn; const s = G('state');
    s.offset = 0; s.coins = 90000; s.level = 16;
    G('BASE_SPECIES').forEach(function (sp) { s.almanac[sp.id] = 3; });
    s.barn.elm = { 1: 3, 3: 2 };
    const broke = [], wide = [];
    SCREENS.forEach(function (sc) {
      let markup = '';
      try { G(sc[1]); markup = G('$')('card').innerHTML + G('$')('barnlist').innerHTML; }
      catch (e) { return broke.push(sc[0] + ': ' + e.message); }
      /* An inline style wider than the frame is an overflow nothing can wrap
         away, at any viewport — the frame never exceeds 400px. */
      (markup.match(/width:\s*(\d+)px/g) || []).forEach(function (m2) {
        const px = +m2.replace(/\D/g, '');
        if (px > 400) wide.push(sc[0] + ': ' + m2);
      });
    });
    check('every screen builds at ' + w + 'px', !broke.length, broke.join('; '));
    check('and hard-codes nothing wider than the frame at ' + w + 'px',
          !wide.length, wide.slice(0, 3).join(', '));
  });
}

/* ---- and the frame itself collapses on a narrow phone ---- */
{
  const rule = /@media \(max-width: (\d+)px\)[^{]*\{\s*#shell \{([^}]*)\}/.exec(html);
  console.log('\n  the frame collapses below ' + (rule ? rule[1] : '?') + 'px');
  check('there is a media query that lets the frame fill a phone', !!rule);
  check('and it sets the shell to the full width',
        rule && /width:\s*100%/.test(rule[2]), rule ? rule[2].trim() : 'none');
  check('and it fires above the narrowest phone we care about',
        rule && +rule[1] >= NARROW, rule ? rule[1] : '-');
  /* The frame's own fixed width must never be the thing that overflows: it is
     only used when the window is wider than the query. */
  const shell = /#shell \{[^}]*width:\s*(\d+)px/.exec(html);
  check('and the fixed frame is only used on a screen wider than itself',
        shell && rule && +shell[1] <= +rule[1],
        (shell ? shell[1] : '?') + 'px frame under a ' + (rule ? rule[1] : '?') + 'px query');
}

/* ---- nothing may scroll sideways ---- */
{
  check('the scrolling view hides horizontal overflow rather than scrolling it',
        /\.view \{[^}]*overflow-x:\s*hidden/.test(html));
  /* Which is why the checks above matter: a clipped row is a row a player
     cannot read and cannot reach. The two places that deliberately scroll
     sideways are opt-in and must say so. */
  const scrollers = (html.match(/overflow-x:\s*auto/g) || []).length;
  console.log('  places that deliberately scroll sideways: ' + scrollers);
  check('and the deliberate side-scrollers are few and on purpose',
        scrollers > 0 && scrollers <= 4, String(scrollers));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

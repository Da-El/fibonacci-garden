/* Iteration 77: the screens that get built once and then never looked at
   again — the species card, the hybrid card, the ledger, the codex, the
   proof, the postcard, the keepsake, the breeder, the welcome-back digest,
   the settings.

   Every one of them is a wall of markup written from the save. They are
   opened by a tap most players make a handful of times, so a wrong number
   or a stale label in one can sit there for a very long time. Until
   iteration 70 taught the harness to parse markup into elements, nothing
   here could be read at all. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const DAY = 24 * 3600000;

/* A gardener far enough in to have something on every screen. */
function furnished() {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 26000; s.level = 16; s.plotCount = 9;
  s.canTier = 3; s.harvested = 240; s.earned = 90000; s.runEarned = 30000;
  s.golden = 4; s.prestiges = 1; s.bestCombo = 21; s.ordersDelivered = 12;
  s.goldenHarvests = 3; s.pristineHarvests = 1; s.compost = 8;
  h.doc.getElementById('scene').clientWidth = 390;
  h.doc.getElementById('bed').clientWidth = 390;
  h.doc.getElementById('bed').clientHeight = 200;
  while (s.plots.length < 9) s.plots.push(null);
  while (s.trellised.length < 9) s.trellised.push(false);
  while (s.glassed.length < 9) s.glassed.push(false);
  E('SPECIES').forEach(function (sp, i) {
    s.almanac[sp.id] = (i % 3) + 1;
    s.discovered[sp.id] = true;
    s.barn[sp.id] = { 2: 3, 3: 2 };
  });
  const hy = E('makeHybrid')('elm', 'beech');
  if (hy) { s.hybrids = {}; s.hybrids[hy.id] = { a: 'elm', b: 'beech' }; E('registerHybrids()'); }
  for (let i = 0; i < 9; i++) E('plant(' + i + ',"' + E('SPECIES')[i % 8].id + '")');
  E('ensureOrders()');
  /* A fortnight of history, so the ledger has something to draw. */
  for (let d = 0; d < 14; d++) { s.offset += DAY; E('catchUpWithLedger()'); }
  return { h: h, E: E, s: s };
}

/* Read a card as a person would: tags stripped, whitespace collapsed. */
function readCard(g, id) {
  const el = g.h.doc.getElementById(id || 'card');
  /* Some screens are written as markup and some are built with
     createElement and appendChild — the gallery, the journal, the shop, the
     market and the achievement list are all the second kind. Reading only
     innerHTML reported five of them as saying nothing at all. */
  let html = el.innerHTML || '';
  (function walk(n) {
    (n.children || []).forEach(function (c) {
      html += ' ' + (c.innerHTML || '') + ' ' + (c._text || '');
      walk(c);
    });
  })(el);
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const g = furnished();

/* ---- every screen must open, say something, and say nothing broken ---- */
{
  const SCREENS = [
    ['the almanac gallery',  function () { g.E('paintAlmanac()'); }, 'alcards'],
    ['the ledger',           function () { g.E('paintLedger()'); },  'ledger'],
    ['the codex',            function () { g.E('paintCodex()'); },   'codex'],
    ['the journal',          function () { g.E('paintJournal()'); }, 'chapters'],
    ['the shop',             function () { g.E('paintShop()'); },    'canlist'],
    ['the market',           function () { g.E('paintMarket()'); },  'barnlist'],
    ['the achievements',     function () { g.E('paintAlmanac()'); }, 'achlist'],
    ['the settings',         function () { g.E('openSettings()'); }, 'card'],
    ['the keepsake',         function () { g.E('openKeepsake()'); }, 'card'],
    ['the postcard',         function () { g.E('openPostcard()'); }, 'card'],
    ['the breeder',          function () { g.E('openBreeder()'); },  'card'],
    ['a species card',       function () {
      g.E('paintAlmanac()');
      const cards = g.h.doc.getElementById('alcards').children;
      const first = cards.filter(function (c) { return c._cls && c._cls.alcard && !c._cls.unknown; })[0];
      if (first) first.dispatchEvent({ type: 'click', target: first,
        stopPropagation: function () {}, preventDefault: function () {} });
    }, 'card'],
    ['a hybrid card',        function () {
      const hy = g.E('SPECIES').filter(function (sp) { return sp.hybrid; })[0];
      if (hy) g.E('showHybridCard')(hy, false);
    }, 'card'],
    ['the welcome-back digest', function () {
      g.E('showWelcomeBack')(30 * DAY, { stages: 40, wages: 900, appPick: 3 });
    }, 'card']
  ];

  console.log('  screen                    words   opens');
  const empty = [], broken = [], threw = [];
  SCREENS.forEach(function (sc) {
    g.h.doc.getElementById(sc[2]).innerHTML = '';
    let err = null;
    try { sc[1](); } catch (e) { err = e; }
    if (err) { threw.push(sc[0] + ': ' + err.message.slice(0, 50)); console.log('    ' + sc[0].padEnd(26) + 'THREW'); return; }
    const text = readCard(g, sc[2]);
    const words = text ? text.split(' ').length : 0;
    console.log('    ' + sc[0].padEnd(26) + String(words).padStart(5) + '   ' +
      (words ? text.slice(0, 40) : '(nothing)'));
    if (!words) empty.push(sc[0]);
    if (/undefined|NaN|\[object|null/.test(text)) {
      broken.push(sc[0] + ': ' + (text.match(/[^ ]*(undefined|NaN|\[object|null)[^ ]*/) || [])[0]);
    }
  });
  check('every screen opens without throwing', !threw.length, threw.join(' | '));
  check('and every one of them says something', !empty.length, empty.join(', '));
  check('and none of them says undefined, NaN or [object Object]',
        !broken.length, broken.join(' | '));
}

/* ---- and what they say has to be what the game knows ---- */
{
  /* The species card quotes the plant's own numbers. If it drifts from the
     table it is drawn from, it is teaching botany that is not in the game. */
  const sp = g.E('byId')['sunflower'];
  g.s.almanac.sunflower = 3;
  g.E('paintAlmanac()');
  const cards = g.h.doc.getElementById('alcards').children
    .filter(function (c) { return c._cls && c._cls.alcard; });
  const sunflower = cards.filter(function (c) {
    return (c.innerHTML || '').indexOf('Sunflower') > -1;
  })[0];
  check('the almanac has a card for every species',
        cards.length === g.E('SPECIES').length,
        cards.length + ' of ' + g.E('SPECIES').length);
  if (sunflower) {
    sunflower.dispatchEvent({ type: 'click', target: sunflower,
      stopPropagation: function () {}, preventDefault: function () {} });
    const text = readCard(g);
    console.log('\n  the sunflower card: ' + text.slice(0, 120));
    check('the card names the plant', text.indexOf(sp.name) > -1, text.slice(0, 40));
    check('and quotes the element count the game uses',
          text.indexOf(String(g.E('totalFor')(sp))) > -1,
          'expected ' + g.E('totalFor')(sp));
    check('and the fraction the renderer draws with',
          text.indexOf(g.E('fracLabel')(sp).split(' ')[0]) > -1,
          g.E('fracLabel')(sp));
    check('and carries its botanical note', text.indexOf(sp.fact.slice(0, 25)) > -1);
  }
}

/* ---- a screen with nothing to show must say so, not show nothing ---- */
{
  /* An empty barn, an empty almanac, no history: the awkward states. */
  const fresh = H.build(); const F = fresh.evalIn; const s = F('state');
  s.offset = 0;
  fresh.doc.getElementById('scene').clientWidth = 390;
  fresh.doc.getElementById('bed').clientWidth = 390;
  const EMPTY = [
    ['the market with nothing in the barn', 'paintMarket', 'marketnote'],
    ['the ledger with no history',          'paintLedger', 'ledger'],
    ['the journal on day one',              'paintJournal', 'chapters'],
    ['the almanac before anything grew',    'paintAlmanac', 'alcards']
  ];
  console.log('\n  the empty states:');
  const silent = [];
  EMPTY.forEach(function (e) {
    let err = null;
    try { F(e[1] + '()'); } catch (ex) { err = ex; }
    const el = fresh.doc.getElementById(e[2]);
    const text = ((el && el.innerHTML) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const shown = el && (el.style.display !== 'none');
    console.log('    ' + e[0].padEnd(38) + (err ? 'THREW' : (text ? text.slice(0, 34) : '(blank)')));
    if (err) silent.push(e[0] + ' threw');
    else if (!text && !shown) silent.push(e[0] + ' is blank');
  });
  check('a screen with nothing on it explains itself rather than sitting blank',
        !silent.length, silent.join(', '));
}

/* ---- the ledger must draw the history it has ---- */
{
  g.E('paintLedger()');
  const text = readCard(g, 'ledger');
  console.log('\n  the ledger: ' + text.slice(0, 110));
  check('the ledger shows something after a fortnight', text.length > 20,
        String(text.length));
  check('and nothing in it is a broken number',
        !/undefined|NaN/.test(text), text.slice(0, 60));
}

/* ---- the proof must be interactive and honest ---- */
{
  g.E('paintCodex()');
  const slider = g.h.doc.getElementById('proofslider');
  check('the proof has a slider to turn', !!slider);
  /* Sweep inside the slider's own range. Driving it to values it does not
     accept measures nothing: the first version of this pushed 0 to 100 at a
     control declared min=60 max=200 and then reported that the sweep could
     not reach the golden angle. */
  const lo = Number(slider.getAttribute('min') || 60);
  const hi = Number(slider.getAttribute('max') || 200);
  const angles = [];
  [lo, lo + (hi - lo) * 0.25, (lo + hi) / 2, lo + (hi - lo) * 0.75, hi].forEach(function (v) {
    slider.value = String(v);
    slider.dispatchEvent({ type: 'input', target: slider,
      stopPropagation: function () {}, preventDefault: function () {} });
    const shown = (g.h.doc.getElementById('proofangle').textContent || '').trim();
    angles.push(shown);
  });
  console.log('\n  turning the proof slider: ' + angles.join(' → '));
  check('turning it changes the angle it reports',
        new Set(angles).size >= 4, angles.join(','));
  check('and every angle it reports is a real number',
        angles.every(function (a) { return /\d/.test(a) && !/NaN|undefined/.test(a); }),
        angles.join(','));
  /* And the golden angle has to be somewhere in the range it sweeps. */
  const nums = angles.map(function (a) { return parseFloat(a); }).filter(isFinite);
  check('and the sweep covers the golden angle',
        Math.min.apply(null, nums) <= g.E('GOLDEN') &&
        Math.max.apply(null, nums) >= g.E('GOLDEN'),
        nums.join(',') + ' against ' + g.E('GOLDEN').toFixed(2));
}

/* ---- the keepsake must round-trip through its own screen ---- */
{
  g.E('openKeepsake()');
  /* The code is the textarea's *content*, not its value — the card is one
     string of markup with the code inside the tag. Reading .value off the
     element found by id gets the stub the game bound to, which never held
     it. Take it out of the markup the screen actually wrote. */
  const raw = g.h.doc.getElementById('card').innerHTML || '';
  const code = ((raw.match(/<textarea[^>]*>([^<]*)<\/textarea>/) || [])[1] || '').trim();
  console.log('\n  the keepsake code is ' + code.length + ' characters, starting "' +
              code.slice(0, 12) + '"');
  check('the keepsake screen shows a code', code.length > 20, String(code.length));
  check('and it is labelled so a stray paste is recognised',
        code.indexOf('FIBGDN') === 0, code.slice(0, 10));
  /* And the import screen must accept the code the export screen produced —
     the one pair of screens in this game that has to agree with each other. */
  const back = H.build(); const B = back.evalIn;
  B('state').offset = 0;
  B('openImport()');
  back.doc.getElementById('savecode').value = code;
  const btn = back.doc.getElementById('k-load');
  if (btn) {
    btn.dispatchEvent({ type: 'click', target: btn,
      stopPropagation: function () {}, preventDefault: function () {} });
  }
  const msg = (back.doc.getElementById('importmsg').textContent || '').trim();
  /* An empty complaint is not the same as acceptance — the first version of
     this asked only that the screen had not objected, which passes just as
     well when nothing happened at all. What acceptance looks like is the
     confirmation card, showing the level and the coins it is about to load. */
  const confirm = (back.doc.getElementById('card').innerHTML || '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('  pasting it into a fresh garden offers: "' + confirm.slice(0, 80) + '"');
  check('the import screen does not object to it', !msg, msg.slice(0, 60));
  check('and offers to load it', /load this garden/i.test(confirm), confirm.slice(0, 60));
  check('and shows what is inside before replacing anything',
        confirm.indexOf(String(g.s.level)) > -1 && /golden seeds/.test(confirm),
        confirm.slice(0, 80));
  /* And taking it must really bring the garden across. */
  const yes = back.doc.getElementById('k-yes');
  if (yes) {
    yes.dispatchEvent({ type: 'click', target: yes,
      stopPropagation: function () {}, preventDefault: function () {} });
  }
  /* Taking it writes the save and reloads the page, which is right in a
     browser and impossible here — the harness cannot reload. So the thing
     to check is that the garden is now in the store, and that starting the
     game from that store finds it. */
  const stored = back.store['fibgarden.v2'];
  check('and taking it writes the garden to the store', !!stored,
        'nothing was written');
  if (stored) {
    const reopened = H.build({ preload: { 'fibgarden.v2': stored } });
    const r = reopened.evalIn('state');
    console.log('  reopening after the load: level ' + r.level + ', ' +
                r.golden + ' seeds, ' + r.plotCount + ' beds');
    check('and reopening the game finds the garden that was loaded',
          r.level === g.s.level && r.plotCount === g.s.plotCount,
          'level ' + r.level + ' of ' + g.s.level +
          ', beds ' + r.plotCount + ' of ' + g.s.plotCount);
    check('with the crosses it was bred with intact',
          Object.keys(r.hybrids || {}).length === Object.keys(g.s.hybrids || {}).length,
          Object.keys(r.hybrids || {}).length + ' of ' +
          Object.keys(g.s.hybrids || {}).length);
  }
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

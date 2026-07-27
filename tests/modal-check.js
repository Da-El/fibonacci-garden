/* Iteration 95: every screen, opened on a broken world.

   broken-check feeds the game a save that is well-formed and describes a
   garden it cannot read, and proves the game still *boots*. buttons-check
   presses every button on a state that should refuse it. Neither has ever
   opened the screens on that world — and a screen is where a lost species
   becomes "undefined", where a missing price becomes NaN, and where a
   division by an empty barn becomes Infinity.

   Twenty-two painters and openers, against six worlds that should never
   exist and one that certainly can. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* Everything that draws a screen or a card. Painters take no arguments;
   the two that do are given one a player could produce. */
const SCREENS = [
  ['the garden', 'paintPlots()'],
  ['the top bar', 'paintTop()'],
  ['the sky', 'paintSky()'],
  ['the planter', 'openPlanter(0)'],
  ['the plant screen', 'openGrow(0)'],
  ['the market', 'paintMarket()'],
  ['the orders', 'paintOrders()'],
  ['the shop', 'paintShop()'],
  ['the decorations', 'paintDecos()'],
  ['the almanac', 'paintAlmanac()'],
  ['the codex', 'paintCodex()'],
  ['the journal', 'paintJournal()'],
  ['the ledger', 'paintLedger()'],
  ['the settings', 'openSettings()'],
  ['the breeding bench', 'openBreeder()'],
  ['the keepsake', 'openKeepsake()'],
  ['the postcard', 'openPostcard()'],
  ['the proof', 'paintProof()'],
  ['the Daily row', 'paintDailyRow()'],
  ['the fever bar', 'paintFever()'],
  ['the grow footer', 'paintGrowFoot()'],
  ['the import screen', 'openImport()']
];

/* The worlds. Each is a thing a save can genuinely say, whether or not the
   game ever wrote it: a corrupted file, a hand-edited one, a hybrid whose
   parents were lost, a version that dropped a species. */
const WORLDS = {
  'a fresh garden': function () {},
  'a bed holding a species that no longer exists': function (s) {
    s.plots[0] = { s: 'ghostplant', stage: 2, q: 3, stageAt: 0, perfects: 0, spills: 0 };
  },
  'a barn full of one': function (s) {
    s.barn = { ghostplant: { 3: 4 }, elm: { 1: 2 } };
  },
  'an order for one': function (s) {
    s.orders = [{ s: 'ghostplant', qty: 2, stars: 2, pay: 400, due: 9e12, id: 'x' }];
  },
  'a hybrid whose parents are gone': function (s) {
    s.hybrids = { hy_ghost_a_ghost_b: { a: 'ghost_a', b: 'ghost_b' } };
    s.almanac.hy_ghost_a_ghost_b = 3;
  },
  'nothing at all — no coins, no water, no beds, empty barn': function (s) {
    s.coins = 0; s.water = 0; s.barn = {}; s.orders = [];
    s.plots = [null, null, null]; s.almanac = {}; s.history = [];
  },
  'a level far past the shelf, and everything mastered': function (s) {
    s.level = 60; s.xp = 9e6; s.coins = 9e9; s.prestiges = 12; s.golden = 400;
    s.plotCount = 9;
    while (s.plots.length < 9) s.plots.push(null);
    while (s.glassed.length < 9) s.glassed.push(false);
    while (s.trellised.length < 9) s.trellised.push(false);
    H.build().evalIn('SPECIES').forEach(function (sp) {
      s.almanac[sp.id] = 3;
      s.barn[sp.id] = { 1: 99, 3: 99, p: 9, g: 9 };
    });
  }
};

/* Open every screen on a world and report what came back. A screen may
   legitimately decline to draw; what it may not do is throw, or write the
   word `undefined`, `NaN` or `Infinity` where a player would read it. */
function sweep(name, arrange) {
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  arrange(s);
  G('registerHybrids()');
  const threw = [], junk = [];
  let read = 0;
  /* Every id the markup declares, not a hand-picked handful. The first
     version of this read ten containers and came back with empty strings for
     three of the seven worlds — because paintTop writes into #coins, #water
     and #brandsub, which are siblings of #top rather than children of it, and
     the harness keeps ids in a flat map with no tree to walk up. Three checks
     were passing on nothing at all. */
  const ALL = Object.keys(g.ids);
  SCREENS.forEach(function (sc) {
    try { G(sc[1]); }
    catch (e) { threw.push(sc[0] + ': ' + e.message); return; }
    let text = '';
    ALL.forEach(function (id) {
      const el = g.ids[id];
      if (!el) return;
      text += ' ' + (el.innerHTML || '') + ' ' + (el.textContent || '');
    });
    read += text.length;
    const bad = text.match(/\bundefined\b|\bNaN\b|\bInfinity\b|\[object Object\]/);
    if (bad) junk.push(sc[0] + ': "' + bad[0] + '"');
  });
  return { threw: threw, junk: junk, read: read, ids: ALL.length, G: G, s: s };
}

Object.keys(WORLDS).forEach(function (name) {
  const r = sweep(name, WORLDS[name]);
  console.log('  ' + (r.threw.length || r.junk.length ? 'x' : '·') + ' ' + name.padEnd(52) +
    (r.read / 1000).toFixed(0) + 'k of text read across ' + r.ids + ' ids' +
    (r.threw.length ? ' — ' + r.threw.length + ' threw' : '') +
    (r.junk.length ? ' — ' + r.junk.length + ' printed junk' : ''));
  if (r.threw.length) console.log('      ' + r.threw.slice(0, 3).join(' | '));
  if (r.junk.length) console.log('      ' + r.junk.slice(0, 3).join(' | '));
  check('every screen opens on ' + name, !r.threw.length,
        r.threw.slice(0, 2).join('; '));
  check('and none of them prints a machine word at ' + name.slice(0, 24),
        !r.junk.length, r.junk.slice(0, 2).join('; '));
});

/* ---- and the broken world must still be playable, not just readable ---- */
{
  const r = sweep('a bed holding a species that no longer exists',
                  WORLDS['a bed holding a species that no longer exists']);
  console.log('\n  after opening every screen on a lost species:');
  console.log('    the bed now holds: ' + (r.s.plots[0] ? r.s.plots[0].s : 'nothing'));
  /* forgetTheUnknown() clears it at boot, which is the design: a bed pointing
     at nothing is dropped rather than carried around. */
  check('a bed pointing at a species the game lost is emptied rather than kept',
        !r.s.plots[0] || !!r.G('byId')[r.s.plots[0].s],
        r.s.plots[0] ? r.s.plots[0].s : 'emptied');
  /* And the emptied bed must be plantable again — the recovery has to lead
     somewhere. */
  r.s.coins = 500;
  r.G('plant(0,"elm")');
  check('and can be planted in again', !!r.s.plots[0] && r.s.plots[0].s === 'elm',
        r.s.plots[0] ? r.s.plots[0].s : 'still empty');
}

/* ---- the empty world must say something rather than nothing ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  WORLDS['nothing at all — no coins, no water, no beds, empty barn'](s);
  const said = {};
  [['the market', 'paintMarket()', 'barninfo'],
   ['the almanac', 'paintAlmanac()', 'card'],
   ['the journal', 'paintJournal()', 'card']].forEach(function (sc) {
    try { G(sc[1]); said[sc[0]] = (G('$')(sc[2]).textContent || '').trim(); }
    catch (e) { said[sc[0]] = 'THREW: ' + e.message; }
  });
  console.log('\n  with nothing at all, the screens say:');
  Object.keys(said).forEach(function (k) {
    console.log('    ' + k.padEnd(14) + '"' + said[k].slice(0, 60) + '"');
  });
  /* An empty market is the one a new player sees before their first harvest,
     so it has to be a sentence rather than a blank. */
  const note = G('$')('marketnote');
  check('an empty barn shows the note that explains what the market is for',
        note.style.display !== 'none', note.style.display || '(shown)');
  check('and no screen came back as a thrown error',
        !Object.keys(said).some(function (k) { return /^THREW/.test(said[k]); }),
        Object.keys(said).map(function (k) { return said[k]; })
          .filter(function (v) { return /^THREW/.test(v); }).join('; '));
}

/* ---- and a maxed world must not print numbers nobody can read ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  WORLDS['a level far past the shelf, and everything mastered'](s);
  G('paintTop()'); G('paintMarket()');
  /* Read the pills paintTop actually writes, not the bar they sit in — the
     harness keeps ids flat, so #top is empty however much the top bar says. */
  const top = ['coins', 'water', 'golden', 'gbonus', 'brandsub'].map(function (id) {
    return G('$')(id).textContent || '';
  }).join(' ');
  const barn = G('$')('barninfo').textContent || '';
  console.log('\n  a maxed garden shows: "' + top.trim().slice(0, 60) + '"');
  console.log('  and a barn of: "' + barn + '"');
  /* fmtCoins exists precisely so a billion does not arrive as ten digits. */
  const digits = (top + barn).match(/\d{7,}/g) || [];
  check('nine billion coins is not printed as nine billion digits',
        !digits.length, digits.slice(0, 2).join(', '));
  check('and the barn still states a value', /worth/.test(barn), barn);
  /* And a level past the last unlock must still draw a progress bar rather
     than dividing by a species that does not exist. */
  check('and a level past the shelf still paints a bar',
        !/NaN|Infinity/.test(top), top.trim().slice(0, 60));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

/* Iteration 62: this is a phone game and nothing had ever timed a frame, or
   counted a node, or asked how much markup a screen writes.

   Wall-clock in Node is close to meaningless — there is no layout, no paint,
   no compositor. What does carry over is the amount of work handed to the
   browser: how many DOM nodes each screen builds, how much markup it has to
   parse, and whether anything is rebuilt that nobody is looking at. Those are
   countable here and they are what a slow phone actually chokes on. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* The heaviest state the game can reach: nine of the busiest plant, every
   species discovered, and a barn holding every tier of everything. */
function loaded(speciesId) {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 18; s.plotCount = 9;
  while (s.plots.length < 9) s.plots.push(null);
  while (s.trellised.length < 9) s.trellised.push(false);
  while (s.glassed.length < 9) s.glassed.push(false);
  h.doc.getElementById('scene').clientWidth = 390;
  h.doc.getElementById('bed').clientWidth = 390;
  h.doc.getElementById('bed').clientHeight = 200;
  const id = speciesId || 'romanesco';
  for (let i = 0; i < 9; i++) {
    E('plant(' + i + ',"' + id + '")');
    if (s.plots[i]) s.plots[i].stage = E('byId')[id].stages;
  }
  E('SPECIES').forEach(function (sp) {
    s.almanac[sp.id] = 3; s.discovered[sp.id] = true;
    s.barn[sp.id] = { 1: 40, 2: 40, 3: 40, g: 5, p: 5, h3: 3, h2: 3, h1: 3 };
  });
  E('ensureOrders()');
  return { h: h, E: E, s: s };
}

function weigh(h, id) {
  const el = h.doc.getElementById(id);
  if (!el) return null;
  let html = el.innerHTML || '';
  (function walk(n) {
    (n.children || []).forEach(function (c) { html += (c.innerHTML || ''); walk(c); });
  })(el);
  return { kb: html.length / 1024, nodes: (html.match(/<[a-zA-Z]/g) || []).length };
}

/* ---- what each screen hands the browser ---- */
{
  const g = loaded();
  const SCREENS = [
    { id: 'bed',       paint: 'paintPlots',   cap: 4500, what: 'the garden, nine romanesco' },
    { id: 'barnlist',  paint: 'paintMarket',  cap: 9000, what: 'a barn holding every tier of everything' },
    { id: 'alcards',   paint: 'paintAlmanac', cap: 5000, what: 'the almanac gallery' },
    { id: 'orderlist', paint: 'paintMarket',  cap: 1500, what: 'the order board' },
    { id: 'canlist',   paint: 'paintShop',    cap: 1500, what: 'the shop' },
    { id: 'chapters',  paint: 'paintJournal', cap: 1500, what: 'the journal' },
    { id: 'codex',     paint: 'paintCodex',   cap: 1500, what: 'the codex' }
  ];
  console.log('  screen        markup    nodes   ceiling');
  const over = [];
  SCREENS.forEach(function (sc) {
    try { g.E(sc.paint + '()'); } catch (e) {}
    const w = weigh(g.h, sc.id);
    if (!w) { over.push(sc.id + ' does not exist'); return; }
    console.log('    ' + sc.id.padEnd(12) + (w.kb.toFixed(0) + 'KB').padStart(7) +
      String(w.nodes).padStart(9) + String(sc.cap).padStart(10) +
      (w.nodes > sc.cap ? '   OVER' : ''));
    if (w.nodes > sc.cap) {
      over.push(sc.id + ': ' + w.nodes + ' nodes for ' + sc.what + ', ceiling ' + sc.cap);
    }
  });
  check('no screen builds more DOM than its ceiling', !over.length, over.join('; '));
}

/* ---- a 44-pixel picture must not be drawn like a 400-pixel one ---- */
{
  const g = loaded();
  const rows = g.s.barn;
  let tiers = 0;
  Object.keys(rows).forEach(function (id) { tiers += Object.keys(rows[id]).length; });
  g.E('paintMarket()');
  const w = weigh(g.h, 'barnlist');
  const perRow = w.nodes / Math.max(1, tiers);
  console.log('\n  the barn list: ' + tiers + ' rows, ' + w.nodes + ' nodes, ' +
              perRow.toFixed(0) + ' per row');
  /* A thumbnail is 44 pixels across and the viewBox inside it is 300 units,
     so a romanesco bud of radius three is under half a pixel. The market drew
     all 232 of them, once per row, for up to eight rows per species — 242
     nodes a row and near a megabyte of markup. */
  check('a barn row costs a thumbnail, not a plant', perRow < 90,
        perRow.toFixed(0) + ' nodes per row');

  const E = g.E;
  const icon = {}, low = {};
  E('SPECIES').forEach(function (sp) {
    const n = function (s) { return (s.match(/<[a-zA-Z]/g) || []).length; };
    icon[sp.id] = n(E('plantSVG')(sp, E('totalFor')(sp), Infinity, 'icon'));
    low[sp.id] = n(E('plantSVG')(sp, E('totalFor')(sp), Infinity, 'low'));
  });
  const worst = Object.keys(icon).reduce(function (m, k) {
    return icon[k] > icon[m] ? k : m;
  }, Object.keys(icon)[0]);
  console.log('  heaviest icon: ' + worst + ' at ' + icon[worst] +
              ' nodes (' + low[worst] + ' in the scene)');
  check('no icon costs more than a hundred nodes', icon[worst] <= 100,
        worst + ' at ' + icon[worst]);
  const notCheaper = Object.keys(icon).filter(function (k) { return icon[k] >= low[k]; });
  check('and every icon is cheaper than the same plant in the scene',
        !notCheaper.length, notCheaper.join(', '));
  /* Fern and romanesco cost their nodes to recursion rather than to element
     count, so clamping the count alone left them at 172 and 143. They have to
     know they are being drawn small. */
  check('including the two that recurse', icon['fern'] <= 60 && icon['romanesco'] <= 80,
        'fern ' + icon['fern'] + ', romanesco ' + icon['romanesco']);
}

/* ---- the scene must tear down what it builds ---- */
{
  const g = loaded();
  g.E('paintPlots()');
  const one = g.h.doc.getElementById('bed').children.length;
  for (let i = 0; i < 20; i++) g.E('paintPlots()');
  const many = g.h.doc.getElementById('bed').children.length;
  console.log('\n  beds after 1 paint: ' + one + ', after 21: ' + many);
  check('painting the garden twenty times leaves nine beds', one === many,
        one + ' -> ' + many);
}

/* ---- the same picture must not be built twice ---- */
{
  const g = loaded();
  g.E('paintPlots()');
  const h0 = g.E('svgCacheHits'), m0 = g.E('svgCacheMiss');
  for (let i = 0; i < 20; i++) g.E('paintPlots()');
  const hits = g.E('svgCacheHits') - h0, misses = g.E('svgCacheMiss') - m0;
  console.log('  twenty repaints: ' + hits + ' cache hits, ' + misses + ' misses');
  check('repainting an unchanged garden rebuilds no artwork',
        misses === 0, misses + ' misses');
}

/* ---- and the clock must cost nothing when nothing is happening ---- */
{
  const g = loaded('pineapple');
  /* pineapple grows slowly on purpose: ten minutes of a garden where nothing
     ripens, nothing is pollinated, nothing gets a drop. */
  for (let i = 0; i < 9; i++) if (g.s.plots[i]) g.s.plots[i].stage = 1;
  g.s.water = g.E('waterCap')();
  let paints = 0;
  g.E('(function(){ const o = paintPlots; paintPlots = function () { window.__n = (window.__n|0) + 1; return o.apply(null, arguments); }; })()');
  g.h.win.__n = 0;
  const tick = g.h.intervals.filter(function (t) { return t.ms === 1000; })[0];
  for (let i = 0; i < 600; i++) { g.s.offset += 1000; tick.fn(); }
  paints = g.h.win.__n | 0;
  console.log('  ten idle minutes in the garden: ' + paints + ' scene rebuilds');
  check('an idle garden is not rebuilt once a second', paints <= 5,
        paints + ' rebuilds in 600 ticks');
}

/* ---- a permanent button must not collect a handler per repaint ----
   Paint functions run every time their screen is opened. Any of them that
   binds a handler with addEventListener to an element the static markup
   declares stacks a new one each time, and then one tap fires all of them —
   which for a shop button means buying every tier you can afford at once.

   Only elements from the static markup count. Everything a paint function
   writes with innerHTML is destroyed and rebuilt, so binding a handler to
   one of those is correct and stacks nothing. Twenty-one elements looked
   like they were leaking before the harness modelled that, and not one of
   them was. */
{
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const staticIds = [];
  const head = src.slice(0, src.indexOf('<script>'));
  let m;
  const re = /\bid="([A-Za-z0-9_-]+)"/g;
  while ((m = re.exec(head))) staticIds.push(m[1]);

  const g = loaded('elm');
  g.E('hireApprentice()');
  const FNS = ['paintMarket', 'paintShop', 'paintAlmanac', 'paintCodex',
               'paintJournal', 'paintPlots', 'paintOrders', 'paintDailyRow',
               'paintLedger', 'openSettings', 'openKeepsake', 'openPostcard',
               'openBreeder', 'openPlanter(0)', 'openGrow(0)'];
  const sweep = function () {
    FNS.forEach(function (f) {
      try { g.E(f.indexOf('(') > 0 ? f : f + '()'); } catch (e) {}
    });
  };
  const count = function () {
    const o = {};
    staticIds.forEach(function (id) {
      const el = g.h.doc.getElementById(id);
      if (el && el._on) {
        o[id] = Object.keys(el._on).reduce(function (a, t) { return a + el._on[t].length; }, 0);
      }
    });
    return o;
  };
  sweep(); const a = count();
  sweep(); const b = count();
  const growing = Object.keys(b).filter(function (id) { return (b[id] || 0) > (a[id] || 0); })
    .map(function (id) { return id + ' ' + a[id] + '->' + b[id]; });
  console.log('\n  ' + staticIds.length + ' elements in the static markup; ' +
    (growing.length ? 'gaining handlers: ' + growing.join(', ')
                    : 'none gains a handler when its screen is redrawn'));
  check('no permanent button collects a handler every time its screen is drawn',
        !growing.length, growing.join('; '));
}

/* ---- nothing may be painted before there is anything to paint ---- */
{
  const g = loaded();
  const t = process.hrtime.bigint();
  for (let i = 0; i < 5; i++) H.build();
  const boot = Number(process.hrtime.bigint() - t) / 1e6 / 5;
  console.log('\n  parsing and running the whole game: ' + boot.toFixed(0) + 'ms');
  /* Not a browser number — there is no layout here — but it does say the
     script itself is not the problem, and it would catch the file doubling. */
  check('the game parses and boots in well under a second', boot < 400,
        boot.toFixed(0) + 'ms');

  /* Raw bytes are not what a phone downloads — every static host on earth
     serves this compressed, and it is cached by a service worker after the
     first visit. The number that matters is the one that goes over the air
     once. 100KB is roughly a second on a slow connection. */
  const zlib = require('zlib');
  const raw = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'));
  const gz = zlib.gzipSync(raw).length;
  console.log('  the whole game: ' + (raw.length / 1024).toFixed(0) + 'KB in one file, ' +
              (gz / 1024).toFixed(0) + 'KB over the wire');
  check('and the download stays around a hundred kilobytes',
        gz < 150 * 1024, (gz / 1024).toFixed(0) + 'KB gzipped');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

/* Iteration 55: nine beds are positioned by hand into rows with depth scaling,
   and nobody has ever looked at the result. These are the things eyes would
   catch immediately — a plant off the edge, two overlapping, a back row drawn
   in front — checked structurally instead. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const px = function (v) { return parseFloat(String(v || '0').replace('px', '')) || 0; };

/* Lay out a garden of n beds at a given viewport width and read back where
   everything landed. */
function layout(plots, width, fill) {
  const h = H.build({ width: width });
  const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 16;
  s.plotCount = plots;
  while (s.plots.length < plots) s.plots.push(null);
  while (s.trellised.length < plots) s.trellised.push(false);
  while (s.glassed.length < plots) s.glassed.push(false);
  s.plots.length = plots; s.trellised.length = plots; s.glassed.length = plots;
  if (fill) fill(E, s);
  E('paintPlots()');
  const bed = h.doc.getElementById('bed');
  const kids = (bed.children || []).filter(function (c) {
    return c.className && (c.className.indexOf('gplant') > -1 || c.className.indexOf('gspot') > -1);
  });
  /* paintPlots clears by querySelectorAll, which the harness stubs, so earlier
     paints linger. The last `plots` children are this paint's. */
  const mine = kids.slice(-plots);
  return mine.map(function (el, i) {
    return { i: i, el: el,
             left: px(el.style.left), bottom: px(el.style.bottom),
             w: px(el.style.width), h: px(el.style.height),
             z: parseInt(el.style.zIndex, 10) || 0,
             opacity: parseFloat(el.style.opacity || '1'),
             cls: el.className };
  });
}

const WIDTHS = [{ n: 'mobile', w: 390 }, { n: 'tablet', w: 768 }, { n: 'desktop', w: 1280 }];
const COUNTS = [3, 6, 9];

/* ---- everything must land inside the bed ---- */
{
  const out = [];
  WIDTHS.forEach(function (v) {
    COUNTS.forEach(function (n) {
      const got = layout(n, v.w);
      if (got.length !== n) { out.push(v.n + '/' + n + ': laid out ' + got.length); return; }
      got.forEach(function (g) {
        if (g.left < -2) out.push(v.n + '/' + n + ' bed ' + g.i + ' starts at ' + Math.round(g.left));
        if (g.left + g.w > v.w + 2) {
          out.push(v.n + '/' + n + ' bed ' + g.i + ' ends at ' + Math.round(g.left + g.w) + ' of ' + v.w);
        }
        if (g.bottom < -2) out.push(v.n + '/' + n + ' bed ' + g.i + ' sits below the soil');
        if (!(g.w > 4)) out.push(v.n + '/' + n + ' bed ' + g.i + ' has no width');
        /* Only a planted bed sets its height inline — an empty one is a hole
           in the soil whose height comes from the aspect-ratio on its own
           artwork, which is correct and cannot be read from the style here. */
        if (/gplant/.test(g.cls) && !(g.h > 4)) {
          out.push(v.n + '/' + n + ' bed ' + g.i + ' has no height');
        }
      });
    });
  });
  check('every bed lands inside the garden at every size', !out.length,
        out.slice(0, 4).join('; '));
}

/* ---- no two beds in the same row may overlap ---- */
{
  const clashes = [];
  WIDTHS.forEach(function (v) {
    COUNTS.forEach(function (n) {
      const got = layout(n, v.w);
      const rows = {};
      got.forEach(function (g) { (rows[g.z] = rows[g.z] || []).push(g); });
      Object.keys(rows).forEach(function (z) {
        const r = rows[z].slice().sort(function (a, b) { return a.left - b.left; });
        for (let k = 1; k < r.length; k++) {
          const gap = r[k].left - (r[k - 1].left + r[k - 1].w);
          if (gap < -1) {
            clashes.push(v.n + '/' + n + ' beds overlap by ' + Math.round(-gap) + 'px');
          }
        }
      });
    });
  });
  check('no two beds in a row overlap', !clashes.length, clashes.slice(0, 4).join('; '));
}

/* ---- back rows must be smaller, dimmer and behind ---- */
{
  const wrong = [];
  /* Planted, not empty: only a growing plant sets its own opacity, so an
     empty garden would make the depth check pass without testing anything. */
  const got = layout(9, 390, function (E, s2) {
    for (let i = 0; i < 9; i++) {
      s2.plots[i] = { s: 'elm', stage: 3, q: 2, stageAt: E('NOW()'), perfects: 1,
                      spills: 0, hired: false, glass: 0 };
    }
  });
  const rows = {};
  got.forEach(function (g) { (rows[g.z] = rows[g.z] || []).push(g); });
  const zs = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
  console.log('  a nine-bed garden on a phone lays out in ' + zs.length + ' rows:');
  zs.forEach(function (z) {
    const r = rows[z];
    console.log('    z=' + z + '  ' + r.length + ' beds, width ' + Math.round(r[0].w) +
                'px, opacity ' + r[0].opacity.toFixed(2) + ', bottom ' + Math.round(r[0].bottom));
  });
  check('a nine-bed garden really is drawn in rows', zs.length >= 2, zs.length + ' rows');
  for (let k = 1; k < zs.length; k++) {
    const back = rows[zs[k - 1]][0], front = rows[zs[k]][0];
    if (!(front.w >= back.w)) wrong.push('row ' + k + ' is not larger than the one behind');
    if (!(front.opacity >= back.opacity - 1e-9)) wrong.push('row ' + k + ' is not brighter than the one behind');
    if (!(front.bottom <= back.bottom)) wrong.push('row ' + k + ' does not sit lower than the one behind');
  }
  check('rows further back are smaller, dimmer and higher up', !wrong.length,
        wrong.join('; '));
}

/* ---- empty and weedy beds must be placed like planted ones ---- */
{
  const planted = layout(9, 390, function (E, s) {
    for (let i = 0; i < 9; i++) {
      const sp = E('byId')['elm'];
      s.plots[i] = { s: 'elm', stage: 2, q: 1, stageAt: E('NOW()'), perfects: 0,
                     spills: 0, hired: false, glass: 0 };
    }
  });
  const empty = layout(9, 390, function (E, s) {
    for (let i = 0; i < 9; i++) s.plots[i] = null;
  });
  const weedy = layout(9, 390, function (E, s) {
    for (let i = 0; i < 9; i++) { s.plots[i] = null; s.weeds[i] = true; }
  });
  const same = function (a, b) {
    return a.length === b.length && a.every(function (g, i) {
      return Math.abs(g.left - b[i].left) < 1.5 && Math.abs(g.bottom - b[i].bottom) < 1.5;
    });
  };
  check('an empty bed sits exactly where a planted one would', same(planted, empty));
  check('a weedy bed sits there too', same(planted, weedy));
  check('a weedy bed is marked as such',
        weedy.every(function (g) { return /weedy/.test(g.cls); }),
        weedy.map(function (g) { return g.cls; })[0]);
}

/* ---- and the layout must survive the sizes in between ---- */
{
  const bad = [];
  for (let w = 300; w <= 1400; w += 37) {
    const got = layout(9, w);
    got.forEach(function (g) {
      if (g.left < -2 || g.left + g.w > w + 2) {
        bad.push(w + 'px: bed ' + g.i + ' at ' + Math.round(g.left) + '..' + Math.round(g.left + g.w));
      }
    });
  }
  check('the garden fits at every width from 300 to 1400', !bad.length,
        bad.slice(0, 3).join('; '));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

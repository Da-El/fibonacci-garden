/* Iteration 60: the game has drawn every plant in it thousands of times and
   nothing has ever looked at the result.

   The scene tests check where plants are placed. The botany tests check that
   the angles are the ones the almanac claims. Nobody has checked the markup
   in between: that it is well-formed, that the coordinates are numbers, that
   the thing stays inside its own frame, and — the one that matters most —
   that two different species do not come out looking the same. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SPECIES = E('SPECIES');
const plantSVG = E('plantSVG');
const elementsAt = E('elementsAt');

/* Every number that appears in a coordinate or a colour, so a NaN anywhere
   in the geometry shows up as a broken shape rather than as nothing. */
function badTokens(svg) {
  const bad = [];
  ['NaN', 'undefined', 'Infinity', 'null'].forEach(function (t) {
    if (svg.indexOf(t) > -1) bad.push(t);
  });
  return bad;
}

function tagBalance(svg) {
  const open = (svg.match(/<[a-zA-Z]/g) || []).length;
  const close = (svg.match(/<\/[a-zA-Z]/g) || []).length +
                (svg.match(/\/>/g) || []).length;
  return open - close;
}

function nodeCount(svg) { return (svg.match(/<[a-zA-Z]/g) || []).length; }

/* Where the plant actually is on the page.

   The first version of this read raw coordinates and ignored the rotate()
   on each group, which for a rosette — where every leaf is the same shape
   turned to a different angle — measured nothing at all. It has to walk the
   transform stack, or it is not measuring the drawing, only the source. */
function extents(svg) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, seen = 0;
  const stack = [];
  function note(x, y) {
    if (!isFinite(x) || !isFinite(y)) return;
    let X = x, Y = y;
    for (let i = stack.length - 1; i >= 0; i--) {
      const t = stack[i];
      if (t.rot) {
        const r = t.rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
        const nx = X * c - Y * sn; Y = X * sn + Y * c; X = nx;
      }
      X += t.tx; Y += t.ty;
    }
    seen++;
    if (X < minX) minX = X; if (X > maxX) maxX = X;
    if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
  }
  svg.split(/(<\/?g[^>]*>)/).forEach(function (chunk) {
    if (/^<g/.test(chunk)) {
      const r = chunk.match(/rotate\((-?[\d.]+)/);
      const t = chunk.match(/translate\((-?[\d.]+)[ ,](-?[\d.]+)/);
      stack.push({ rot: r ? +r[1] : 0, tx: t ? +t[1] : 0, ty: t ? +t[2] : 0 });
      return;
    }
    if (/^<\/g/.test(chunk)) { stack.pop(); return; }
    let m;
    const circ = /<circle[^>]*?cx="(-?[\d.]+)"[^>]*?cy="(-?[\d.]+)"[^>]*?r="([\d.]+)"/g;
    while ((m = circ.exec(chunk))) {
      note(+m[1] - +m[3], +m[2]); note(+m[1] + +m[3], +m[2]);
      note(+m[1], +m[2] - +m[3]); note(+m[1], +m[2] + +m[3]);
    }
    const ell = /<ellipse[^>]*?cx="(-?[\d.]+)"[^>]*?cy="(-?[\d.]+)"[^>]*?rx="([\d.]+)"[^>]*?ry="([\d.]+)"/g;
    while ((m = ell.exec(chunk))) {
      note(+m[1] - +m[3], +m[2]); note(+m[1] + +m[3], +m[2]);
      note(+m[1], +m[2] - +m[4]); note(+m[1], +m[2] + +m[4]);
    }
    const cmd = /[MLQC]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g;
    while ((m = cmd.exec(chunk))) note(+m[1], +m[2]);
  });
  return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, seen: seen };
}

function viewBox(svg) {
  const m = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)"/);
  return m ? { x: +m[1], y: +m[2], w: +m[3], h: +m[4] } : null;
}

/* ---- every species, at every stage it can be in ---- */
{
  const broken = [], unbalanced = [], empty = [];
  let drawn = 0;
  SPECIES.forEach(function (sp) {
    for (let stage = 1; stage <= sp.stages; stage++) {
      const svg = plantSVG(sp, elementsAt(sp, stage));
      drawn++;
      if (!svg || svg.indexOf('<svg') !== 0) { empty.push(sp.id + '@' + stage); continue; }
      const bad = badTokens(svg);
      if (bad.length) broken.push(sp.id + '@' + stage + ' has ' + bad.join(','));
      if (tagBalance(svg) !== 0) {
        unbalanced.push(sp.id + '@' + stage + ' off by ' + tagBalance(svg));
      }
    }
  });
  console.log('  drew ' + drawn + ' pictures across ' + SPECIES.length + ' species');
  check('every species draws at every stage', !empty.length, empty.slice(0, 4).join(', '));
  check('with no NaN or undefined anywhere in the geometry',
        !broken.length, broken.slice(0, 4).join('; '));
  check('and every tag it opens it closes', !unbalanced.length,
        unbalanced.slice(0, 4).join('; '));
}

/* ---- the plant has to stay inside its own frame ----
   Three sides, not four. SVG clips to its viewport, so anything past the
   edge is simply not drawn, and running the stem out of the bottom is how
   a plant is planted — it disappears into the soil. Off the left, the right
   or the top is a plant the player only sees part of. */
{
  const spills = [], sunk = [];
  console.log('\n  how much room each full-grown plant leaves itself:');
  console.log('    species      left  right   top  bottom   (+ spills out)');
  SPECIES.forEach(function (sp) {
    const svg = plantSVG(sp, elementsAt(sp, sp.stages));
    const vb = viewBox(svg), ex = extents(svg);
    if (!vb) { spills.push(sp.id + ' has no viewBox'); return; }
    if (!ex.seen) { spills.push(sp.id + ' drew nothing measurable'); return; }
    const outL = vb.x - ex.minX, outR = ex.maxX - (vb.x + vb.w);
    const outT = vb.y - ex.minY, outB = ex.maxY - (vb.y + vb.h);
    console.log('    ' + sp.id.padEnd(12) + outL.toFixed(0).padStart(4) +
      outR.toFixed(0).padStart(7) + outT.toFixed(0).padStart(6) +
      outB.toFixed(0).padStart(8));
    const sides = Math.max(outL, outR, outT);
    if (sides > 2) {
      spills.push(sp.id + ' spills ' + sides.toFixed(0) + 'px off the side or top');
    }
    /* And the stem is allowed to run into the ground, but not for ever —
       markup drawn a long way outside the frame is markup nobody sees. */
    if (outB > vb.h * 0.4) sunk.push(sp.id + ' draws ' + outB.toFixed(0) + 'px below the frame');
  });
  /* Every rosette used to fail this: the longest leaf reached 177 units in a
     frame that stops at 150, so the outer sixth of every succulent was cut
     off on all four sides — and nothing noticed for thirty-five iterations
     because the only check that had ever looked ignored the rotation that
     put it there. */
  check('no plant is drawn off the side or the top of its picture',
        !spills.length, spills.slice(0, 4).join('; '));
  check('and no stem runs miles below the ground', !sunk.length, sunk.join('; '));
}

/* ---- a plant has to visibly grow, and never visibly un-grow ---- */
{
  const flat = [], shrinking = [];
  SPECIES.forEach(function (sp) {
    let prev = -1;
    for (let stage = 1; stage <= sp.stages; stage++) {
      const n = nodeCount(plantSVG(sp, elementsAt(sp, stage)));
      if (stage > 1 && n < prev) shrinking.push(sp.id + '@' + stage + ': ' + prev + '->' + n);
      prev = n;
    }
    const first = nodeCount(plantSVG(sp, elementsAt(sp, 1)));
    const last = nodeCount(plantSVG(sp, elementsAt(sp, sp.stages)));
    if (last <= first) flat.push(sp.id + ' ' + first + '->' + last);
  });
  check('every plant has more in it at the end than at the start',
        !flat.length, flat.join(', '));
  /* Detail used to be chosen from how big the plant is right now, so a fern
     drew 1056 nodes at stage eight and 250 at stage nine — three quarters of
     itself gone at the exact moment it ripened, and a romanesco and a vine
     did the same mid-life. It is chosen from what the plant will grow into
     now, so a plant looks like itself the whole way up. */
  check('and no plant ever gets simpler as it grows',
        !shrinking.length, shrinking.slice(0, 4).join('; '));
}

/* ---- two species must not come out looking the same ---- */
{
  const seen = {}, clashes = [];
  SPECIES.forEach(function (sp) {
    /* Strip the per-render gradient ids, which are a counter and differ on
       every call — they would make identical drawings look distinct. */
    const svg = plantSVG(sp, elementsAt(sp, sp.stages))
      .replace(/(lf|pt|dc|st)[a-z0-9]+/gi, '#');
    if (seen[svg]) clashes.push(seen[svg] + ' and ' + sp.id + ' draw identically');
    seen[svg] = sp.id;
  });
  check('no two species draw the same picture', !clashes.length, clashes.join('; '));

  /* Weaker but more telling: the six growth forms must each look like
     themselves. A disc is petals round a seed head, a stem is leaves up a
     shaft — if two forms produce the same shapes, the second shelf added
     five species and no variety. */
  const forms = {};
  SPECIES.forEach(function (sp) { (forms[sp.form] = forms[sp.form] || []).push(sp.id); });
  console.log('  forms drawn: ' + Object.keys(forms).map(function (f) {
    return f + '(' + forms[f].length + ')';
  }).join(' '));
  check('all six growth forms are actually used by a species',
        Object.keys(forms).length === 6, Object.keys(forms).join(','));

  const shapes = {};
  Object.keys(forms).forEach(function (f) {
    const sp = E('byId')[forms[f][0]];
    const svg = plantSVG(sp, elementsAt(sp, sp.stages));
    shapes[f] = {
      circles: (svg.match(/<circle/g) || []).length,
      paths: (svg.match(/<path/g) || []).length,
      groups: (svg.match(/<g /g) || []).length,
      ellipses: (svg.match(/<ellipse/g) || []).length
    };
  });
  const sigs = Object.keys(shapes).map(function (f) {
    const s = shapes[f];
    return f + ':' + [s.circles, s.paths, s.groups, s.ellipses].join('/');
  });
  console.log('  shape mix per form (circles/paths/groups/ellipses):');
  sigs.forEach(function (s) { console.log('    ' + s); });
  const kinds = {};
  Object.keys(shapes).forEach(function (f) {
    const s = shapes[f];
    /* Which primitive dominates — that is what makes a form recognisable at
       a glance, and it should not be the same one for all six. */
    const top = ['circles', 'paths', 'ellipses'].reduce(function (m, k) {
      return s[k] > s[m] ? k : m;
    }, 'circles');
    kinds[top] = (kinds[top] || 0) + 1;
  });
  check('the six forms are not all built from the same primitive',
        Object.keys(kinds).length >= 2, JSON.stringify(kinds));
}

/* ---- low detail must actually be cheaper ---- */
{
  const rows = [];
  SPECIES.forEach(function (sp) {
    const n = elementsAt(sp, sp.stages);
    rows.push({ id: sp.id,
                hi: nodeCount(plantSVG(sp, n, undefined, 'high')),
                lo: nodeCount(plantSVG(sp, n, undefined, 'low')) });
  });
  const sorted = rows.slice().sort(function (a, b) { return b.lo - a.lo; });
  console.log('\n  heaviest in the scene, where nine draw at once:');
  sorted.slice(0, 4).forEach(function (r) {
    console.log('    ' + r.id.padEnd(11) + String(r.lo).padStart(5) + ' nodes (' +
      r.hi + ' up close, ×' + (r.hi / r.lo).toFixed(1) + ')');
  });
  /* A romanesco used to cost 722 either way: dropping the inner spiral still
     left a group, a circle and a facet for each of 232 buds, on a plant
     where a bud is three pixels across. "Low detail" that costs the same as
     high is a switch that does nothing.

     A plant whose full size is over the budget is drawn low whatever you
     ask for — that is the budget doing its job, not the switch failing —
     so the two agreeing is only a fault below the line. */
  const overBudget = {};
  SPECIES.forEach(function (sp) {
    overBudget[sp.id] = E('estimateElements')(sp, E('totalFor')(sp)) > E('DETAIL_BUDGET');
  });
  const same = rows.filter(function (r) { return r.lo >= r.hi && !overBudget[r.id]; });
  check('low detail is cheaper than high on every plant the budget allows',
        !same.length, same.map(function (r) { return r.id; }).join(', '));
  console.log('  always drawn low, being over the ' + E('DETAIL_BUDGET') +
              '-element budget: ' +
              (SPECIES.filter(function (sp) { return overBudget[sp.id]; })
                      .map(function (sp) { return sp.id; }).join(', ') || 'none'));
  /* And the budget has to still be doing something. A limit nothing reaches
     is a limit that is not protecting anything. */
  check('the detail budget still catches at least one plant',
        Object.keys(overBudget).some(function (k) { return overBudget[k]; }));
  const worst = sorted[0];
  check('and the heaviest plant is affordable nine times over',
        worst.lo * 9 < 5000, worst.id + ': ' + worst.lo * 9 + ' nodes for a full garden');
}

/* ---- the cache must not hand back another plant's picture ---- */
{
  const wrong = [];
  SPECIES.forEach(function (sp) {
    const n = elementsAt(sp, sp.stages);
    const a = plantSVG(sp, n);            // may populate the cache
    const b = plantSVG(sp, n);            // must come from it
    if (a !== b) wrong.push(sp.id + ' differs between calls');
  });
  check('asking for the same plant twice gives the same picture',
        !wrong.length, wrong.join('; '));

  /* Detail level is part of what a picture is, so it has to be part of what
     the cache is keyed on — otherwise the first plant drawn at low detail
     poisons every later request for the same plant at high. */
  const sp = E('byId')['sunflower'];
  const n = elementsAt(sp, sp.stages);
  const lo = plantSVG(sp, n, undefined, 'low');
  const hi = plantSVG(sp, n, undefined, 'high');
  check('and a low-detail draw does not poison the high-detail one',
        lo !== hi || E('estimateElements')(sp, n) > E('DETAIL_BUDGET'),
        'sunflower low=' + (lo.length) + ' high=' + (hi.length) + ' bytes');
}

/* ---- nothing small may ask for detail nobody can see ---- */
{
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const lines = html.split('\n');
  const greedy = [];
  lines.forEach(function (l, i) {
    if (l.indexOf('plantSVG(') < 0) return;
    if (l.indexOf('function plantSVG') > -1) return;
    if (l.indexOf("'low'") > -1) return;
    /* A .thumb is 44 pixels square. Anything drawn into one at full detail
       is hundreds of nodes the player cannot possibly resolve — and the
       list of locked seeds drew one per species, greyed out, at a third
       opacity, because it was the single row that forgot to ask. */
    if (/class="thumb"/.test(l)) greedy.push((i + 1) + ': ' + l.trim().slice(0, 70));
  });
  console.log('\n  thumbnails drawn at full detail: ' + (greedy.length || 'none'));
  check('no 44-pixel thumbnail is drawn at full detail', !greedy.length,
        greedy.join(' | '));

  /* The scene is the one place nine plants draw at once, so it must ask for
     low every time — the whole budget rests on that being true. */
  const scene = lines.filter(function (l) {
    return l.indexOf('class="gart"') > -1 && l.indexOf('plantSVG') > -1;
  });
  check('the scene always draws its nine plants at low detail',
        scene.length > 0 && scene.every(function (l) { return l.indexOf("'low'") > -1; }),
        scene.length + ' call site(s)');
}

/* ---- hybrids have to draw too ---- */
{
  const g = H.build(); const G = g.evalIn;
  const made = [], broke = [];
  [['elm', 'daisy'], ['sunflower', 'pinecone'], ['vine', 'romanesco'],
   ['aloe', 'fern'], ['oak', 'pineapple']].forEach(function (pair) {
    const hy = G('makeHybrid')(pair[0], pair[1]);
    if (!hy) { broke.push(pair.join('+') + ' would not cross'); return; }
    G('byId')[hy.id] = hy;
    const svg = G('plantSVG')(hy, G('elementsAt')(hy, hy.stages));
    made.push(hy.id + ' as ' + hy.form);
    if (!svg || svg.indexOf('<svg') !== 0) broke.push(hy.id + ' drew nothing');
    else if (badTokens(svg).length) broke.push(hy.id + ' has ' + badTokens(svg).join(','));
    else if (tagBalance(svg) !== 0) broke.push(hy.id + ' is unbalanced');
  });
  console.log('\n  crosses drawn: ' + made.length + ' — ' +
              made.map(function (m) { return m.split(' as ')[1]; }).join(', '));
  check('every cross draws as cleanly as its parents', !broke.length,
        broke.join('; '));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

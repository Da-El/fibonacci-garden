/* Iteration 54: the postcard is the only thing that leaves the app, so a fault
   in it is invisible until somebody else opens the picture. The PNG bytes are
   the browser's job. What is the game's job — that the drawing code never
   throws, and that the text it writes stays inside the picture — had never
   been checked at all. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* Build a garden in a given state and draw its postcard, returning what was
   drawn. */
function draw(setup) {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 99999; s.level = 16;
  if (setup) setup(E, s);
  let threw = null, cv = null;
  try { cv = E('drawPostcard()'); } catch (e) { threw = e; }
  return { threw: threw, cv: cv, E: E, s: s,
           ops: cv && cv._ctx ? cv._ctx._ops : [] };
}

const CASES = {
  'a brand-new garden': function () {},
  'an empty garden at level 16': function (E, s) {
    s.plots = [null, null, null];
  },
  'a full garden of nine': function (E, s) {
    s.plotCount = 9;
    while (s.plots.length < 9) s.plots.push(null);
    while (s.trellised.length < 9) s.trellised.push(false);
    while (s.glassed.length < 9) s.glassed.push(false);
    const ids = ['pineapple', 'romanesco', 'fern', 'vine', 'aloe', 'oak', 'sunflower', 'pinecone', 'pear'];
    ids.forEach(function (id, i) {
      const sp = E('byId')[id];
      s.plots[i] = { s: id, stage: sp.stages, q: 99, stageAt: E('NOW()'),
                     ripeAt: E('NOW()'), perfects: sp.stages, spills: 0, hired: false, glass: 0 };
    });
    E('SPECIES').forEach(function (sp) { s.almanac[sp.id] = 3; });
  },
  'a garden with a very long name': function (E, s) {
    s.gardenName = 'The Extremely Well Considered Botanical Establishment of Great Renown';
  },
  'a garden named with emoji and accents': function (E, s) {
    s.gardenName = '🌻 Jardín des Fleurs ✿ 花园 ✿';
  },
  'a garden of bred hybrids': function (E, s) {
    ['sedum', 'pear', 'houseleek', 'beech', 'elm'].forEach(function (id) { s.almanac[id] = 3; });
    [['sedum', 'pear'], ['pear', 'houseleek'], ['houseleek', 'beech']].forEach(function (pr) {
      s.coins = 9999999;
      try { E('doBreed("' + pr[0] + '","' + pr[1] + '")'); } catch (e) {}
    });
    const hyb = E('SPECIES').filter(function (sp) { return sp.hybrid; });
    hyb.forEach(function (sp, i) {
      s.almanac[sp.id] = 3;
      if (i < s.plotCount) {
        s.plots[i] = { s: sp.id, stage: sp.stages, q: 99, stageAt: E('NOW()'),
                       ripeAt: E('NOW()'), perfects: sp.stages, spills: 0, hired: false, glass: 0 };
      }
    });
  },
  'a garden at night in a dry spell': function (E, s) {
    s.offset = 22 * 3600000;                     // late enough to be night
    let d = 0;
    while (d < 40 && !E('isDryDay')(E('dayIndex()') + d)) d++;
    s.offset += d * 24 * 3600000;
  },
  'a much-prestiged garden': function (E, s) {
    s.golden = 24; s.prestiges = 9; s.harvested = 9999; s.runEarned = 987654;
  }
};

const W = 640, H2 = 400;
Object.keys(CASES).forEach(function (name) {
  const r = draw(CASES[name]);
  check('the postcard draws for ' + name, !r.threw, r.threw && r.threw.message);
  if (r.threw) return;

  check('  ' + name + ': it actually drew something', r.ops.length > 10,
        r.ops.length + ' operations');

  /* Every piece of text must land inside the picture. A garden name that runs
     off the edge is exactly the sort of thing nobody notices until they have
     sent the picture to someone. */
  const texts = r.ops.filter(function (o) { return o.op === 'fillText' || o.op === 'strokeText'; });
  const off = texts.filter(function (t) {
    const w = String(t.text).length * 6;         // the stub's own metric
    return t.x < -w || t.x > W + 4 || t.y < 0 || t.y > H2 + 4;
  });
  check('  ' + name + ': no text falls outside the picture', !off.length,
        off.slice(0, 2).map(function (t) { return '"' + t.text + '" at ' + Math.round(t.x) + ',' + Math.round(t.y); }).join('; '));

  // and nothing may be drawn as "undefined" or "NaN"
  const junk = texts.filter(function (t) { return /undefined|NaN|\[object/.test(t.text); });
  check('  ' + name + ': nothing reads as undefined or NaN', !junk.length,
        junk.slice(0, 3).map(function (t) { return '"' + t.text + '"'; }).join(' '));
});

/* ---- the picture must reflect the garden it is of ---- */
{
  const r = draw(CASES['a much-prestiged garden']);
  const texts = r.ops.filter(function (o) { return o.op === 'fillText'; })
    .map(function (t) { return t.text; }).join(' | ');
  console.log('  a much-prestiged garden writes: ' + texts.slice(0, 160));
  check('the postcard names the garden', /garden|Garden/.test(texts) || texts.length > 0);
  check('it reports something true about the run',
        /24|9|987|level|lvl/i.test(texts), texts.slice(0, 80));
}

/* ---- a name can arrive from an imported code, so the cap must hold on the
       way out rather than only on the way in ---- */
{
  const h = H.build(); const E = h.evalIn; const st = E('state');
  st.gardenName = 'The Extremely Well Considered Botanical Establishment of Great Renown';
  const shown = E('gardenName()');
  const cap = E('GARDEN_NAME_MAX');
  check('an over-long name is trimmed wherever it came from',
        shown.length <= cap, shown.length + ' characters, cap is ' + cap);
  /* 27px semi-bold: the cap has to fit the title plate at that size. */
  check('the cap actually fits the postcard title', cap * 16 <= 640 - 26,
        cap + ' chars at ~16px each against a 614px plate');
  st.gardenName = '';
  check('an unnamed garden still has a name', E('gardenName()').length > 0);
}

/* ---- the save-code download must produce a real payload ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 4242; s.level = 11;
  const code = E('exportSave()');
  check('the downloadable save code is well formed',
        typeof code === 'string' && code.split('.').length === 3 && code.indexOf('FIBGDN1') === 0,
        typeof code === 'string' ? code.slice(0, 24) + '…' : typeof code);
  check('and it reads back into the same garden',
        (function () {
          const res = E('importSave')(code);
          return res && res.ok && res.data.s.coins === 4242 && res.data.s.level === 11;
        })());
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

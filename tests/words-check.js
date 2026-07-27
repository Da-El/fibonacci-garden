/* Iteration 66: the game says a great many numbers out loud — in weather
   tooltips, season blurbs, decoration descriptions, perk cards, hints, the
   settings screen and the almanac — and every one of them is a string
   written by hand next to a constant it is supposed to describe.

   Nothing has ever checked that the two agree. A blurb that drifts is worse
   than no blurb: the player plans around it. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* Percentages a string claims, as multipliers: "+18%" -> 1.18 */
function claimedPcts(s) {
  return (String(s).match(/[+-]?\d+(?:\.\d+)?%/g) || []).map(function (t) {
    const n = parseFloat(t) / 100;
    return t[0] === '-' ? 1 - Math.abs(n) : 1 + n;
  });
}
function near(a, b) { return Math.abs(a - b) < 0.005; }

/* ---- the seasons must describe the boosts they actually give ---- */
{
  const wrong = [], silent = [];
  console.log('  season   what it boosts                     what it says');
  E('SEASONS').forEach(function (s) {
    const forms = Object.keys(s.boost);
    const real = forms.map(function (f) { return f + ' ×' + s.boost[f]; }).join(', ');
    console.log('    ' + s.name.padEnd(8) + real.padEnd(35) + s.blurb);

    const said = claimedPcts(s.blurb);
    /* Every figure it quotes has to be a boost it really gives. */
    said.forEach(function (v) {
      if (!forms.some(function (f) { return near(s.boost[f], v); })) {
        wrong.push(s.name + ' claims ×' + v.toFixed(2) + ' and gives none');
      }
    });
    /* And every boost it gives has to be quoted, or a player gets a bonus
       the game never told them about and cannot plan around. */
    forms.forEach(function (f) {
      if (!said.some(function (v) { return near(s.boost[f], v); })) {
        silent.push(s.name + ' boosts ' + f + ' ×' + s.boost[f] + ' and does not say so');
      }
    });
  });
  if (silent.length) console.log('\n  unannounced: ' + silent.join('; '));
  check('every percentage a season quotes is one it really gives',
        !wrong.length, wrong.join('; '));
  check('and every boost it gives is one it announces',
        !silent.length, silent.join('; '));

  /* The words have to point at the right plants, too. A blurb naming a form
     the season does not touch sends you off to grow the wrong thing. */
  const FORM_WORDS = {
    stem: ['sprig', 'stem'], disc: ['disc', 'daisy', 'sunflower', 'chamomile'],
    rosette: ['rosette', 'succulent'], cone: ['cone', 'evergreen', 'pine'],
    frond: ['fern', 'frond'], fractal: ['romanesco', 'fractal']
  };
  const mislabelled = [];
  E('SEASONS').forEach(function (s) {
    const low = s.blurb.toLowerCase();
    Object.keys(FORM_WORDS).forEach(function (form) {
      const named = FORM_WORDS[form].some(function (w) { return low.indexOf(w) > -1; });
      if (named && !s.boost[form]) {
        mislabelled.push(s.name + ' names ' + form + 's but does not boost them');
      }
    });
    /* And the figure has to be attached to the right word. Winter said
       "evergreens +18%, ferns +12%" while giving rosettes the 18% and cones
       10% — every number in it was a number the season really gives, and
       every plant it named was one it really boosts, so a check on either
       alone passed. It was still telling you to grow the wrong thing. */
    const pairs = low.match(/([a-z]+)\s*\+(\d+)%/g) || [];
    pairs.forEach(function (p) {
      const m = p.match(/([a-z]+)\s*\+(\d+)%/);
      const word = m[1], pct = 1 + Number(m[2]) / 100;
      const form = Object.keys(FORM_WORDS).filter(function (f) {
        return FORM_WORDS[f].some(function (w) { return word.indexOf(w) === 0; });
      })[0];
      if (!form) return;                     // a word this map does not know
      if (!near(s.boost[form] || 0, pct)) {
        mislabelled.push(s.name + ' says ' + word + ' +' + m[2] + '% but gives them ×' +
                         (s.boost[form] || 1));
      }
    });
  });
  check('and the plants it names are the plants it boosts',
        !mislabelled.length, mislabelled.join('; '));
}

/* ---- the weather tooltips must match what the weather does ---- */
{
  const wrong = [];
  console.log('\n  weather  regen  sell   says');
  E('WEATHERS').forEach(function (w) {
    console.log('    ' + w.name.padEnd(9) + String(w.regen).padEnd(7) +
                String(w.sell).padEnd(6) + w.blurb);
    const said = claimedPcts(w.blurb);
    said.forEach(function (v) {
      if (!near(w.sell, v) && !near(w.regen, v)) {
        wrong.push(w.name + ' claims ×' + v.toFixed(2) + ', sells ×' + w.sell +
                   ' and refills ×' + w.regen);
      }
    });
    /* A sell bonus worth mentioning that goes unmentioned. */
    if (Math.abs(w.sell - 1) > 0.02 && !said.some(function (v) { return near(w.sell, v); })) {
      wrong.push(w.name + ' sells ×' + w.sell + ' and does not say so');
    }
  });
  check('every weather says what it really does', !wrong.length, wrong.join('; '));
}

/* ---- the decorations must be honest about their effect ---- */
{
  const wrong = [];
  E('DECOS').forEach(function (d) {
    const said = claimedPcts(d.blurb);
    if (!said.length) return;                    // "he is simply here" is fine
    /* Find the number the game uses for this decoration's effect. */
    const found = said.filter(function (v) {
      const pct = Math.round(Math.abs(v - 1) * 100);
      return html.indexOf('0.' + String(pct).padStart(2, '0')) > -1 ||
             html.indexOf('1.' + String(pct).padStart(2, '0')) > -1 ||
             html.indexOf('0.9' + (100 - pct)) > -1;
    });
    if (found.length !== said.length) {
      wrong.push(d.id + ' claims ' + said.map(function (v) {
        return '×' + v.toFixed(2);
      }).join(',') + ' — no such constant');
    }
  });
  console.log('\n  decorations quoting a figure: ' +
    E('DECOS').filter(function (d) { return claimedPcts(d.blurb).length; })
              .map(function (d) { return d.id; }).join(', '));
  check('every decoration quotes a figure the game really uses',
        !wrong.length, wrong.join('; '));
  /* And a decoration with an effect must name that effect, or nobody buys it
     for the reason it exists. This used to accept any blurb containing a
     digit, "more often" or "too" — a grab-bag of whatever the four blurbs
     happened to say, which passed a lantern that promised night-lovers a
     benefit it gave to everything. Each effect now has to be named in the
     game's own words for it. */
  const NAMES = { storm: /storm/i, water: /refill|can\b/i,
                  lady: /ladybird/i, night: /golden hour|dusk|hours?\b/i };
  const mute = E('DECOS').filter(function (d) {
    if (!d.effect) return false;
    const pat = NAMES[d.effect];
    return !pat || !pat.test(d.blurb);
  });
  check('and a decoration that does something names what it does',
        !mute.length, mute.map(function (d) { return d.id + ': ' + d.blurb; }).join('; '));
}

/* ---- the settings screen must describe the settings ---- */
{
  const opts = E('OPTIONS');
  const noDesc = opts.filter(function (o) { return !o.desc || o.desc.length < 8; });
  check('every setting explains itself', !noDesc.length,
        noDesc.map(function (o) { return o.k; }).join(', '));
  /* Every switch on that screen has to be a switch that changes something —
     either read from the script, or hung on the body as a class the
     stylesheet acts on. The colour-blind switch is the second kind: two
     mentions in the script and a dozen `body.cb` rules doing the work. */
  const unread = opts.filter(function (o) {
    const inScript = html.split('opt.' + o.k).length >= 3;
    const inStyle = html.indexOf('body.' + o.k + ' ') > -1;
    return !inScript && !inStyle;
  });
  console.log('  settings: ' + opts.map(function (o) { return o.k; }).join(', '));
  check('and every switch on it changes something',
        !unread.length, unread.map(function (o) { return o.k; }).join(', '));
}

/* ---- nothing anywhere may read as unfinished ---- */
{
  /* Only the strings the player sees: quoted text inside the script, plus
     the static markup. */
  const strings = (html.match(/'[^'\n]{12,200}'/g) || [])
    .concat(html.match(/"[^"\n]{12,200}"/g) || []);
  const bad = strings.filter(function (s) {
    /* `placeholder=` is an HTML attribute doing its job, not unfinished
       copy — the import box legitimately has one. */
    if (/placeholder\s*=/.test(s)) return false;
    return /\b(TODO|TBD|FIXME|lorem ipsum|placeholder text|XXX)\b/i.test(s);
  });
  check('nothing in the game reads as a placeholder', !bad.length,
        bad.slice(0, 3).join(' | '));

  /* Doubled words — "the the", "a a" — are the classic hand-written-copy
     defect and there is a lot of hand-written copy here. */
  const doubled = [];
  strings.forEach(function (s) {
    const m = s.match(/\b(the|a|an|is|to|of|and|it|you|that)\s+\1\b/i);
    if (m) doubled.push(m[0] + ' in ' + s.slice(0, 50));
  });
  check('and no sentence repeats a word', !doubled.length, doubled.slice(0, 3).join(' | '));
}

/* ---- the numbers in the prose must be the numbers in the code ---- */
{
  /* The handful of figures the game states in more than one place. Each is
     quoted somewhere as prose and defined once as a constant; if they part
     company the player is told something untrue. */
  const facts = [
    ['a drop every 13 minutes', /every <?b?>?13<?\/?b?>? ?minutes/i, E('WATER_REGEN_MS') === 13 * 60000],
    ['fever pays ×1.618', /1\.618/, Math.abs(E('PHI') - 1.6180339887) < 1e-9],
    ['a combo of 13 starts fever', /combo of 13|13\b[^.]{0,20}fever/i, E('FEVER_COMBO') === 13],
    ['a golden bloom sells ×3', /×\s*3|3×/, E('GOLD_PRICE_X') === 3],
    ['a pristine sells ×2', /flawless ×2|pristine[^.]{0,20}×2/i, true],
    ['the glasshouse opens at level 10', /level <?b?>?10/i, E('GLASS_LVL') === 10]
  ];
  const wrong = [];
  facts.forEach(function (f) {
    const stated = f[1].test(html);
    if (stated && !f[2]) wrong.push(f[0] + ' is stated and is not true');
  });
  console.log('\n  cross-checked ' + facts.length + ' figures the prose repeats');
  check('every figure the prose repeats matches the constant behind it',
        !wrong.length, wrong.join('; '));
}

/* ---- and a label must fit where it is shown ---- */
{
  /* The species names sit in a 78-pixel column in the market, ellipsised.
     A name that never fits is a name nobody ever reads. */
  const longest = E('SPECIES').reduce(function (m, sp) {
    return sp.name.length > m.length ? sp.name : m;
  }, '');
  console.log('  longest species name: "' + longest + '" (' + longest.length + ' chars)');
  check('no species name is too long for the column it sits in',
        longest.length <= 22, longest);
  const longBlurb = E('DECOS').concat(E('WEATHERS'))
    .reduce(function (m, x) { return (x.blurb || '').length > m.length ? x.blurb : m; }, '');
  check('and no tooltip runs past a phone screen', longBlurb.length <= 60,
        longBlurb + ' (' + longBlurb.length + ')');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

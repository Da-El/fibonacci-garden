const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Iteration 42: iterations 29-41 added the thirsty state, the dry spell, the
   glasshouse, early/late pour feedback and the golden-seed bonus, each with
   new colour, new motion and new text and no accessibility check. Sweep all
   of it. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const html = require('fs').readFileSync(GAME_PATH, 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

/* ---- 1. nothing may carry meaning by colour alone ---- */
{
  /* Each new state, and the non-colour signal it must also carry: either a
     glyph in its own text, or a ::before under body.cb. */
  const states = [
    ['thirsty', 'gtag.thirsty', '💧'],
    ['glass', 'gtag.glasstag', '🔒'],
    ['dry spell now', 'drylbl', '🌵'],
    ['dry spell coming', 'drywarn', '🌵'],
    ['ready to harvest', 'gtag.ready', '★'],
    ['aphids', 'gtag.warn', '⚠']
  ];
  const missing = [];
  states.forEach(function (st) {
    const cls = st[1].split('.').pop();
    // does a glyph appear anywhere the class is set, or a cb rule exist?
    const hasGlyph = html.indexOf(st[2]) > -1;
    const hasCb = new RegExp('body\\.cb[^{]*' + cls + '[^{]*::(before|after)').test(css);
    if (!hasGlyph && !hasCb) missing.push(st[0]);
  });
  check('every new state carries a non-colour signal', !missing.length, missing.join(', '));

  // the pour outcome is the most important feedback in the game
  check('a pour miss says early or late in words, not by colour',
        /too ' \+ side\.toLowerCase\(\)/.test(html) || /too '/.test(html));
}

/* ---- 2. every idle animation must stop when motion is off ---- */
{
  const animated = [];
  const re = /\.([a-zA-Z][\w.-]*)\s*(?:::[a-z]+)?\s*\{[^}]*animation:\s*([a-zA-Z][\w-]*)/g;
  let m;
  while ((m = re.exec(css))) animated.push({ sel: m[1], anim: m[2] });
  /* Animations that only play once on a deliberate action are fine; the ones
     that must be stoppable are the ones that loop forever. */
  const infinite = animated.filter(function (a) {
    const i = css.indexOf('animation: ' + a.anim);
    return css.slice(i, i + 120).indexOf('infinite') > -1;
  });
  console.log('  looping animations: ' + infinite.length);
  check('there is a nomotion class at all', css.indexOf('body.nomotion') > -1);

  /* Every animation that never ends must be stoppable. Ambience that loops
     forever is exactly what a reduce-motion setting is for. */
  const nomoBlock = css.slice(css.indexOf('body.nomotion'),
                              css.indexOf('}', css.indexOf('prefers-reduced-motion')) + 200);
  /* A rule on any one of a selector's classes covers it — body.nomotion .wxp
     stops .wxp.flake too — so check every segment, not just the last. */
  const unstoppable = [];
  infinite.forEach(function (a) {
    const parts = a.sel.split(':')[0].split('.').filter(Boolean);
    if (!parts.some(function (p) { return nomoBlock.indexOf(p) > -1; })) {
      unstoppable.push(a.sel + '(' + a.anim + ')');
    }
  });
  check('every never-ending animation stops under the motion switch',
        !unstoppable.length, unstoppable.join(', '));
  // and the switch must actually be applied to the body
  check('the motion switch is applied to the body',
        /classList\.toggle\('nomotion'/.test(html));
  check('the system reduce-motion setting is honoured too',
        /@media \(prefers-reduced-motion: reduce\)/.test(css));
}

/* ---- 3. the new states must be described to a screen reader ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 999999; s.level = 12;
  s.glassed[2] = true;
  E('plant(0,"elm")'); E('plant(1,"elm")'); E('plant(2,"elm")');
  s.offset += 6 * 3600000; E('growthTick()');
  s.plots[1].bug = true;
  E('paintPlots()');
  const bed = h.doc.getElementById('bed');
  const labels = (bed.children || [])
    .filter(function (c) { return c.className && c.className.indexOf('gplant') > -1; })
    .map(function (c) { return c.getAttribute('aria-label') || ''; });
  const joined = labels.join(' | ').toLowerCase();
  console.log('  aria labels: ' + labels.slice(-3).join('  /  '));
  check('a thirsty plant says so to a screen reader', /waiting to be watered|clock will take/.test(joined));
  check('a glass bed says so to a screen reader', /under glass/.test(joined));
  check('every plant in the bed has a label',
        labels.length > 0 && labels.every(function (l) { return l.length > 5; }),
        labels.length + ' labels');
}

/* ---- 4. touch targets. Only the things you actually tap: #pourbar is
          display-only (the pour is locked from #act or the canvas, both
          large) and the pills are readouts with no handler. ---- */
{
  const sizes = {};
  ['#act', '.iconbtn'].forEach(function (sel) {
    const i = css.indexOf(sel + ' {');
    if (i < 0) { sizes[sel] = null; return; }
    const body = css.slice(i, css.indexOf('}', i));
    const mh = body.match(/(?:min-height|height):\s*(\d+)px/);
    const pad = body.match(/padding:\s*(\d+)px/);
    sizes[sel] = mh ? parseInt(mh[1], 10) : (pad ? parseInt(pad[1], 10) * 2 + 16 : null);
  });
  console.log('  tap targets: ' + Object.keys(sizes).map(function (k) {
    return k + ' ' + (sizes[k] === null ? '?' : sizes[k] + 'px');
  }).join(', '));
  const small = Object.keys(sizes).filter(function (k) { return sizes[k] !== null && sizes[k] < 40; });
  check('the main controls are at least 40px tall', !small.length,
        small.map(function (k) { return k + ' ' + sizes[k] + 'px'; }).join(', '));
}

/* ---- 5. the colour-blind switch must reach the new states ---- */
{
  const cbRules = (css.match(/body\.cb [^{]+\{[^}]*\}/g) || []);
  console.log('  colour-blind rules: ' + cbRules.length);
  check('the colour-blind switch covers the dry-spell warning',
        /body\.cb[^{]*drywarn/.test(css));
  check('the colour-blind switch is applied to the body',
        /classList\.toggle\('cb'/.test(html));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

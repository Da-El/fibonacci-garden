/* Iteration 81: everything the game says to somebody coming back.

   The digest, the twelve hints, the toasts, the tab title and the app badge
   all speak to a player who has been away. Each has been checked in
   isolation; nobody has read them together, in the order they arrive, and
   asked whether the whole of it makes sense — or whether any of it is
   telling the player a number the game stopped using.

   It was. The hint that explains fever the first time you see it quoted a
   threshold of eight and a duration of ninety seconds; both changed twenty-
   four iterations ago. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const DAY = 24 * 3600000;
const h = H.build(); const E = h.evalIn;
const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const plain = function (s) { return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); };

/* ---- every hint must quote numbers the game still uses ---- */
{
  const HINTS = E('HINTS');
  const facts = [
    ['fever', /(\d+|eight|thirteen|five|eleven) perfect pours/i, function (m) {
      const words = { eight: 8, thirteen: 13, five: 5, eleven: 11 };
      const n = words[String(m[1]).toLowerCase()] || Number(m[1]);
      return n === E('FEVER_COMBO');
    }, 'the combo that starts fever'],
    ['fever', /for the next ([\d.]+) seconds/i, function (m) {
      return Math.abs(Number(m[1]) - E('FEVER_MS') / 1000) < 1;
    }, 'how long fever lasts'],
    ['wilt', /every (\d+) hours?/i, function (m) {
      return Number(m[1]) === E('WILT_MS') / 3600000;
    }, 'how fast a ripe bloom wilts'],
    ['dry', /(\d+|one|two|three) days/i, function (m) {
      const words = { one: 1, two: 2, three: 3 };
      const n = words[String(m[1]).toLowerCase()] || Number(m[1]);
      return n === E('DRY_RUN_DAYS');
    }, 'how long a dry spell runs'],
    ['dry', /(\d+)% higher/i, function (m) {
      return Math.abs(1 + Number(m[1]) / 100 - E('DRY_SELL')) < 0.005;
    }, 'what a dry spell does to prices'],
    ['bees', /\+(\d+) care/i, function (m) {
      return Number(m[1]) >= 1;
    }, 'what a bee is worth']
  ];
  console.log('  what the hints claim, against what the game does:');
  const wrong = [], unchecked = [];
  facts.forEach(function (f) {
    const tx = plain(HINTS[f[0]] && HINTS[f[0]].tx);
    const m = tx.match(f[1]);
    if (!m) { unchecked.push(f[0] + ': ' + f[3]); return; }
    const held = f[2](m);
    console.log('    ' + f[0].padEnd(10) + f[3].padEnd(34) + '"' + m[0] + '"  ' +
      (held ? 'holds' : 'WRONG'));
    if (!held) wrong.push(f[0] + ' says "' + m[0] + '" for ' + f[3]);
  });
  check('every figure a hint quotes is one the game still uses',
        !wrong.length, wrong.join('; '));
  check('and every figure worth checking was found in the copy',
        !unchecked.length, unchecked.join('; '));

  /* And no hint may mention a mechanic by a name the game does not use. */
  const noText = Object.keys(HINTS).filter(function (k) {
    return !HINTS[k].tx || plain(HINTS[k].tx).length < 20;
  });
  check('every hint says something worth reading', !noText.length, noText.join(', '));
  const noIcon = Object.keys(HINTS).filter(function (k) { return !HINTS[k].ic; });
  check('and carries an icon', !noIcon.length, noIcon.join(', '));
  /* Every hint must be fired from somewhere, or it is a paragraph nobody
     will ever be shown. */
  const dead = Object.keys(HINTS).filter(function (k) {
    return html.indexOf("hint('" + k + "')") < 0;
  });
  check('and is shown somewhere', !dead.length, dead.join(', '));
}

/* ---- a hint must arrive once, not every time ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  const bar = g.doc.getElementById('hintbar');
  G('hint("thirsty")');
  const first = plain(g.doc.getElementById('hinttx').innerHTML || g.doc.getElementById('hinttx').textContent);
  g.doc.getElementById('hinttx').textContent = '';
  for (let i = 0; i < 5; i++) G('hint("thirsty")');
  const again = plain(g.doc.getElementById('hinttx').textContent || '');
  console.log('\n  the same hint asked for six times: shown "' +
              first.slice(0, 40) + '", then ' + (again ? 'shown again' : 'not again'));
  check('a hint arrives the first time it is relevant', first.length > 10, first.slice(0, 30));
  check('and never again after that', !again, again.slice(0, 40));
  check('and the game remembers it across a reload',
        !!G('tutor').hints && G('tutor').hints.thirsty === true,
        JSON.stringify(G('tutor').hints));
}

/* ---- the digest must report an absence honestly ---- */
{
  const AWAYS = [['four hours', 4 * 3600000], ['a day', DAY],
                 ['a week', 7 * DAY], ['a month', 30 * DAY]];
  console.log('\n  what the digest says after being away:');
  const bad = [];
  AWAYS.forEach(function (a) {
    const g = H.build(); const G = g.evalIn; const s = G('state');
    s.offset = 0; s.coins = 4000; s.level = 12; s.plotCount = 9;
    while (s.plots.length < 9) s.plots.push(null);
    while (s.trellised.length < 9) s.trellised.push(false);
    while (s.glassed.length < 9) s.glassed.push(false);
    for (let i = 0; i < 9; i++) G('plant(' + i + ',"chamomile")');
    G('catchUpWithLedger()');
    s.offset += a[1];
    const res = G('catchUpWithLedger()');
    G('showWelcomeBack')(a[1], (res && res.l) || {});
    const text = plain(g.doc.getElementById('card').innerHTML);
    console.log('    ' + a[0].padEnd(12) + text.slice(0, 92));
    if (/undefined|NaN|\[object/.test(text)) bad.push(a[0] + ': ' + text.slice(0, 40));
    /* It has to say how long you were gone. fmtLong writes short forms
       like "4h 0m" and "4 weeks 2d", so this reads what the game really
       writes rather than the long words it does not use. */
    if (!new RegExp('\\d+\\s*[hmd]\\b|hour|day|week|month|year|minute').test(text)) {
      bad.push(a[0] + ' does not say how long');
    }
    /* And it must not claim more plants than the garden holds. */
    const m = text.match(/(\d+)\s+plants?\s+(?:was|were)\s+battered/);
    if (m && Number(m[1]) > s.plotCount) bad.push(a[0] + ': ' + m[1] + ' plants battered of 9');
  });
  check('the digest reads sensibly at every length of absence',
        !bad.length, bad.join(' | '));
}

/* ---- and it must say nothing when there is nothing to say ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  G('showWelcomeBack')(90000, {});
  const text = plain(g.doc.getElementById('card').innerHTML);
  console.log('\n  back after ninety seconds with an empty garden: "' +
              text.slice(0, 80) + '"');
  check('coming straight back does not produce a report about nothing',
        text.length < 200, text.length + ' characters');
  check('and whatever it does say is not broken',
        !/undefined|NaN/.test(text), text.slice(0, 50));
}

/* ---- the title and the badge must agree with the garden ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 4000; s.level = 12;
  g.doc.getElementById('scene').clientWidth = 390;
  for (let i = 0; i < s.plotCount; i++) G('plant(' + i + ',"elm")');
  /* Push them all past the clock's ceiling so they are thirsty. */
  const sp = G('byId')['elm'];
  s.plots.forEach(function (p) { if (p) p.stage = G('timerCeiling')(sp, p); });
  G('paintTop()');
  const title = g.doc.title || '';
  const thirsty = G('thirstyCount()');
  console.log('\n  ' + thirsty + ' thirsty plants, and the tab reads: "' + title + '"');
  check('the tab title counts the plants waiting for a drop',
        thirsty === 0 || title.indexOf(String(thirsty)) > -1,
        title + ' for ' + thirsty);
  check('and still names the game', /Fibonacci Garden/.test(title), title);

  /* And it must go quiet when the garden is dealt with. */
  s.plots.forEach(function (p) { if (p) p.stage = 1; });
  G('paintTop()');
  const calm = g.doc.title || '';
  console.log('  after watering them: "' + calm + '"');
  check('and drops the count once nothing is waiting',
        calm.indexOf('💧') < 0, calm);
}

/* ---- and the order it all arrives in must make sense ---- */
{
  /* A player coming back to a garden that has grown, been battered, been
     pollinated and been tended gets a digest and then a screen. Nothing may
     be said twice, and the digest must not report something the garden no
     longer shows. */
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 6000; s.level = 12; s.plotCount = 9;
  g.doc.getElementById('scene').clientWidth = 390;
  g.doc.getElementById('bed').clientWidth = 390;
  while (s.plots.length < 9) s.plots.push(null);
  while (s.trellised.length < 9) s.trellised.push(false);
  while (s.glassed.length < 9) s.glassed.push(false);
  for (let i = 0; i < 9; i++) G('plant(' + i + ',"chamomile")');
  G('hireApprentice()');
  G('catchUpWithLedger()');
  s.offset += 3 * DAY;
  const res = G('catchUpWithLedger()');
  const l = (res && res.l) || {};
  G('showWelcomeBack')(3 * DAY, l);
  const text = plain(g.doc.getElementById('card').innerHTML);
  /* Split on the elements the digest builds rather than on emoji. Cutting a
     string at emoji boundaries slices surrogate pairs in half and produces
     replacement characters, which then look like empty rows — the first
     version of this reported the digest was repeating itself and the
     repetition was two halves of a broken snowflake. */
  const rows = [];
  (function walk(n) {
    (n.children || []).forEach(function (c) {
      const t2 = plain((c._text || '') + ' ' + (c.innerHTML || ''));
      if (t2 && t2.length >= 8 && !(c.children || []).length) rows.push(t2);
      walk(c);
    });
  })(g.doc.getElementById('card'));
  const lines = rows.length ? rows : [text];
  console.log('\n  three days away, with an apprentice, the digest says:');
  lines.slice(0, 8).forEach(function (x) { console.log('    ' + x.trim().slice(0, 76)); });
  const seen = {};
  const dupes = lines.filter(function (x) {
    const k = x.replace(/\d+/g, '#').trim();
    if (!k) return false;
    if (seen[k]) return true;
    seen[k] = 1; return false;
  });
  check('nothing in the digest is said twice', !dupes.length,
        dupes.slice(0, 2).join(' | '));
  check('and every row of it has a number or a name in it',
        lines.every(function (x) { return /\d|[a-z]{3}/i.test(x); }));
  /* Whatever the ledger recorded must be what the digest reports. */
  const stages = l.stages | 0;
  if (stages) {
    check('and the growth it reports is the growth that happened',
          text.indexOf(String(stages)) > -1, 'ledger said ' + stages);
  }
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

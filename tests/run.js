/* Runs the whole suite and reports a single verdict.
   Usage: node tests/run.js        (from the repo root, or anywhere)

   Each check file loads the game's inline <script> into a headless harness
   and drives the real functions — no reimplementation, so a check that
   passes is a statement about the game rather than about a model of it. */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FILES = [
  ['regress',       'core invariants: the clock, quality, the apprentice, orders, prestige'],
  ['dry-check',     'the dry spell: frequency, warning, effect size, whether preparing pays'],
  ['thirsty-check', 'the stalled plant: counting, announcing, the tab title'],
  ['glass-check',   'the glasshouse: the clock stopping, its protections, its economics'],
  ['onboard-check', 'the first five minutes, and every number the tutorial quotes'],
  ['pour-check',    'the pour: timing windows, difficulty curve, and that it resolves at all'],
  ['botany-check',  'the Fibonacci claims, checked against what the renderer draws'],
  ['sound-check',   'every sound: defined, triggered, and mixed within a sane range'],
  ['journal-check', 'the journal: every objective reachable by a gardener who did everything'],
  ['a11y-check',    'colour, motion, screen readers and tap targets'],
  ['market-check',  'the price spread, and whether the market explains it'],
  ['save-check',    'old saves, corrupt saves, export codes, a failing localStorage'],
  ['daily-check',   'a year of Dailies: every one winnable, fair, and worth winning'],
  ['breed-check',   'the mediant, the price cap, and every rung reachable'],
  ['wheel-check',   "the gamble's expected value, its odds, and its worst outcome"],
  ['perk-check',    'every perk draft measured — is either side the obvious pick?'],
  ['level-check',   'the XP curve against three weeks of real play'],
  ['quiet-check',   'the mechanics that barely fire — wilt, weeds, aphids, storms'],
  ['postcard-check','the postcard: draws for every garden, and stays inside the picture'],
  ['scene-check',   'the garden lays out inside its bounds at every size and bed count'],
  ['fever-check',   'fever: how often it fires, what it is worth, and that it ends'],
  ['away-check',    'coming back after a day, a month, a decade, or a corrected clock'],
  ['draw-check',    'what the plants actually look like: bounds, growth, detail, distinctness'],
  ['budget-check',  'what each screen hands the browser: nodes, markup, and wasted rebuilds'],
  ['score-check',   'the generative score: mode, tempo, and whether it ever changes back'],
  ['shelf-check',   'every species measured against every other: is any one of them dead?'],
  ['boon-check',    'the ladybird and the compost: two systems that hand you something free'],
  ['gift-check',    'the daily gift and the streak: what it pays, and what breaking it costs'],
  ['long-check',    'a hundred days: big numbers, a level bar past the shelf, a save at scale'],
  ['prestige2-check','a second and third run: what a replant costs, keeps, and is worth'],
  ['keys-check',    'the whole loop played by keyboard, without touching a coordinate'],
  ['chapter-check', 'the journal walked against a real run: when each chapter falls'],
  ['broken-check',  'a save that is well-formed and describes a garden the game cannot read'],
  ['words-check',   'every figure the game states out loud, against the constant behind it'],
  ['ach-check',     'every achievement: reachable, paid once, and worth the asking'],
  ['tutor-check',   'the first five minutes, walked step by step the way a player does'],
  ['audit',         'stated versus actual: every claim this project makes about itself']
];

let pass = 0, fail = 0, broken = [];
FILES.forEach(function (f) {
  const file = path.join(__dirname, f[0] + '.js');
  if (!fs.existsSync(file)) { broken.push(f[0] + ' (missing)'); return; }
  let out = '';
  try {
    out = execFileSync(process.execPath, [file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const m = out.match(/PASS (\d+) \/ FAIL (\d+)/);
  if (!m) { broken.push(f[0] + ' (no verdict)'); console.log('  ??  ' + f[0]); return; }
  const p = +m[1], b = +m[2];
  pass += p; fail += b;
  console.log('  ' + (b ? 'FAIL' : ' ok ') + '  ' + f[0].padEnd(14) + String(p).padStart(3) + ' passed' +
              (b ? ', ' + b + ' FAILED' : '') + '   — ' + f[1]);
  if (b) out.split('\n').filter(function (l) { return /^\s+FAIL/.test(l); })
              .forEach(function (l) { console.log('        ' + l.trim()); });
});

console.log('\n' + pass + ' checks passed, ' + fail + ' failed' +
            (broken.length ? ', ' + broken.length + ' could not run: ' + broken.join(', ') : ''));
process.exit(fail || broken.length ? 1 : 0);

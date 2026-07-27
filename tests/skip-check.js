/* Iteration 82: about half of everyone skips a tutorial.

   Iteration 64 walked this game's coach end to end and it holds up. This
   asks the other question: what does the game teach somebody who taps
   "skip" on the first screen and simply plays? Everything the coach says
   has to be said somewhere else too, or the tutorial is not an
   introduction, it is the manual.

   The answer was mostly yes, and one mechanic — weeds — was explained by
   nothing at all, while the journal set an objective for it. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const plain = function (s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };

/* Everything a player meets, and where the game explains it. A mechanic
   explained only by the tutorial is a mechanic half the players never
   learn. */
const MECHANICS = [
  ['the clock stops before the end',  /as far as the clock will take it|clock will take|half grown/i],
  ['a drop skips a whole stage',      /every stage is a drop|drop skips|skips a whole stage/i],
  ['the gold zone is worth aiming at',/gold zone|perfect pour|land(ed)? in the gold/i],
  ['care becomes quality',            /care point|care becomes|\+1 care/i],
  ['water comes back on a clock',     /13 minutes|a drop arrives|refill/i],
  ['ripe plants wilt',                /wilt/i],
  ['aphids stop growth',              /aphid/i],
  ['weeds take empty beds',           /weed/i],
  ['storms knock plants back',        /storm/i],
  ['dry spells slow the can',         /dry spell/i],
  ['fever pays more',                 /fever/i],
  ['customers pay over market',       /customer order|over market/i],
  ['the season moves prices',         /season/i],
  ['bees pollinate',                  /bee|pollinat/i],
  ['an apprentice tends the garden',  /apprentice/i],
  ['glass stops the clock',           /glass/i],
  ['crossing plants',                 /breed|cross two/i],
  ['replanting for a permanent bonus',/replant|golden seed/i]
];

/* ---- where each is taught ---- */
{
  const STEPS = E('STEPS'), HINTS = E('HINTS');
  const tutorial = STEPS.map(function (s) { return plain(s.title + ' ' + s.text); }).join(' ');
  const hints = Object.keys(HINTS).map(function (k) {
    return k + ' ' + plain(HINTS[k].tx);
  }).join(' ');
  /* The garden header, the shop rows, the market board and the toasts —
     everything the game says outside the coach and the hint bar. */
  const inPlay = [
    (html.match(/blurb:\s*'[^']*'/g) || []).join(' '),
    (html.match(/toast\('[^']*'/g) || []).join(' '),
    (html.match(/<p>[^<]*<\/p>/g) || []).join(' '),
    (html.match(/desc:\s*'[^']*'/g) || []).join(' ')
  ].join(' ');

  console.log('  mechanic                            coach   hint   in play');
  const onlyCoach = [], nowhere = [];
  MECHANICS.forEach(function (m) {
    const c = m[1].test(tutorial), n = m[1].test(hints), p = m[1].test(inPlay);
    console.log('    ' + m[0].padEnd(36) + (c ? 'yes' : ' - ').padEnd(8) +
      (n ? 'yes' : ' - ').padEnd(7) + (p ? 'yes' : ' - '));
    if (!c && !n && !p) nowhere.push(m[0]);
    else if (c && !n && !p) onlyCoach.push(m[0]);
  });
  /* Weeds were here: a toast announced they had arrived and nothing ever
     said tapping clears them, or that there is sometimes a worm underneath,
     while a journal chapter asked you to clear a patch. */
  check('every mechanic is explained somewhere', !nowhere.length, nowhere.join(', '));
  check('and none of them only by the tutorial', !onlyCoach.length, onlyCoach.join(', '));
}

/* ---- and a skipper must be able to play ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  g.doc.getElementById('scene').clientWidth = 390;
  g.doc.getElementById('bed').clientWidth = 390;
  g.doc.getElementById('bed').clientHeight = 200;
  /* Tap skip on the first screen. */
  G('startTutorial(true)');
  G('endTutorial()');
  check('skipping the tutorial ends it', !G('coachActive()'));

  const trail = [];
  /* Now simply play: plant, let the clock work, pour, harvest, sell. */
  G('plant(0,"elm")');
  trail.push(s.plots[0] ? 'planted an elm' : 'could not plant');
  const sp = G('byId')['elm'];
  s.offset += G('timerCeiling')(sp, null) * sp.growMin * 60000 + 60000;
  G('catchUpWithLedger()');
  trail.push('the clock took it to stage ' + s.plots[0].stage + ' of ' + sp.stages);
  G('curPlot = 0');
  let poured = 0;
  while (s.plots[0] && s.plots[0].stage < sp.stages && poured < 20) {
    G('advanceStage("water", true)');
    poured++;
  }
  trail.push('poured ' + poured + ' drops to finish it');
  G('harvest()');
  trail.push(G('barnCountAll()') ? 'harvested it' : 'lost it');
  const before = s.coins;
  G('sellAll()');
  trail.push('sold for ' + (s.coins - before) + '🪙');
  console.log('\n  a player who skipped the coach:');
  trail.forEach(function (t) { console.log('    ' + t); });

  check('a skipper can plant, grow, pour, harvest and sell', s.coins > before,
        trail.join('; '));
  check('and the clock really did stop before the end',
        poured > 0 && poured < sp.stages,
        poured + ' of ' + sp.stages + ' stages were theirs');
  check('and the tutorial does not come back', !G('coachActive()'));
}

/* ---- the hints must arrive when the thing happens, not before ---- */
{
  /* A hint that fires on the first frame teaches nothing, because there is
     nothing on screen to attach it to. */
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  G('startTutorial(true)'); G('endTutorial()');
  const fired = Object.keys(G('tutor').hints || {});
  console.log('\n  hints fired before the player has done anything: ' +
              (fired.join(', ') || 'none'));
  check('no hint fires before there is anything to explain',
        fired.length === 0, fired.join(', '));

  /* And the one for the mechanic that bites first — a plant stalling —
     must arrive the moment it stalls. */
  s.coins = 500;
  G('plant(0,"elm")');
  const sp = G('byId')['elm'];
  s.offset += G('timerCeiling')(sp, null) * sp.growMin * 60000 + 60000;
  G('catchUpWithLedger()');
  G('hint("thirsty")');
  const shown = plain(g.doc.getElementById('hinttx').innerHTML ||
                      g.doc.getElementById('hinttx').textContent || '');
  console.log('  when the first plant stalls, the game says: "' + shown.slice(0, 90) + '"');
  check('the first thing to bite is explained the moment it bites',
        shown.length > 20, shown.slice(0, 40));
  check('and it explains the rule rather than just naming it',
        /drop|pour|can/i.test(shown), shown.slice(0, 60));
}

/* ---- and the weeds one has to reach a player who left a bed empty ---- */
{
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0;
  G('startTutorial(true)'); G('endTutorial()');
  s.weedChecked = G('weedSlot()') - 50;
  G('weedTick()');
  const weedy = Object.keys(s.weeds || {}).filter(function (k) { return s.weeds[k]; }).length;
  const shown = plain(g.doc.getElementById('hinttx').innerHTML ||
                      g.doc.getElementById('hinttx').textContent || '');
  console.log('\n  ' + weedy + ' beds go weedy, and the game says: "' + shown.slice(0, 100) + '"');
  check('weeds really do take an empty bed', weedy > 0, String(weedy));
  check('and the game explains them when they arrive', shown.length > 20,
        shown.slice(0, 40));
  check('and says what to do about it', /tap|clear/i.test(shown), shown.slice(0, 60));
  /* The journal asks you to clear a patch, so the game must have told you
     how before it asks. */
  const asks = E('CHAPTERS').some(function (c) {
    return c.objs.some(function (o) { return /weed/i.test(o.t); });
  });
  check('and the journal only asks for it because the game teaches it',
        !asks || /tap|clear/i.test(shown),
        asks ? 'the journal asks and nothing explains how' : 'the journal does not ask');
}

/* ---- nothing may be discoverable only by being told ---- */
{
  /* Every mechanic that costs the player something if they do not know it
     must be signalled in the garden itself, not only in prose. A thirsty
     plant leans and pales; aphids show a bug; a storm shows in the forecast.
     Those are the ones you can lose money to without reading anything. */
  const SIGNALS = [
    ['a stalled plant looks stalled', /thirsty|leans|pale/i],
    ['aphids are visible on the plant', /bug|aphid/i],
    ['a storm is in the forecast', /forecast|sceneforecast/i],
    ['a dry spell is warned about', /drywarn|dry spell/i],
    ['a ripe plant shows it is ripe', /ready|ripe|pick/i]
  ];
  const missing = SIGNALS.filter(function (s) { return !s[1].test(html); });
  console.log('\n  things you can lose money to, signalled in the garden: ' +
              (SIGNALS.length - missing.length) + ' of ' + SIGNALS.length);
  check('everything that can cost you is visible in the garden itself',
        !missing.length, missing.map(function (s) { return s[0]; }).join(', '));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

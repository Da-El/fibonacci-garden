/* Iteration 64: the first five minutes is the most important path in this
   game and no test has ever walked it.

   It could not. Every coachDid() in the game — the four steps that wait for
   the player to actually do something — fires from inside a setTimeout, and
   the harness dropped deferred work on the floor. So the interactive spine of
   onboarding, the part that decides whether anyone gets as far as a second
   session, had never advanced a single step under test.

   Timers run now. This walks the tutorial the way a new player does. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* A brand-new player: no save, no coins beyond the starting handful. */
function newcomer() {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  h.doc.getElementById('scene').clientWidth = 390;
  h.doc.getElementById('bed').clientWidth = 390;
  h.doc.getElementById('bed').clientHeight = 200;
  return { h: h, E: E, s: s,
           step: function () { return E('coachIdx'); },
           waiting: function () { return E('coachAwait'); } };
}

/* ---- the tutorial has to be there at all ---- */
{
  const g = newcomer();
  const STEPS = g.E('STEPS');
  console.log('  the tutorial is ' + STEPS.length + ' steps');
  check('there is a tutorial', STEPS.length >= 6, String(STEPS.length));
  const noText = STEPS.filter(function (s) { return !s.title || !s.text; });
  check('every step says something', !noText.length, noText.length + ' blank');
  /* A step that spotlights an element nobody can see is a step pointing at
     nothing, and the box lands in the middle of the screen with no target. */
  const sels = STEPS.filter(function (s) { return s.sel; }).map(function (s) { return s.sel; });
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const missing = sels.filter(function (sel) {
    const id = sel.match(/^#([A-Za-z0-9_-]+)/);
    if (id) return html.indexOf('id="' + id[1] + '"') < 0;
    const cls = sel.match(/\.([A-Za-z0-9_-]+)/);
    return cls ? html.indexOf(cls[1]) < 0 : false;
  });
  check('every step points at something that exists', !missing.length, missing.join(', '));
}

/* ---- and it has to be walkable, one real action at a time ---- */
{
  const g = newcomer();
  const STEPS = g.E('STEPS');
  g.E('startTutorial(true)');
  const trail = [];
  let stuck = null;

  /* Do the thing the current step is waiting for. Anything without an
     `await` is a Next button, which is what a player taps. */
  function act(await_) {
    switch (await_) {
      case 'planter':
        g.E('openPlanter(0)');
        break;
      case 'planted':
        g.E('plant(0,"elm")');
        break;
      case 'pourStarted':
        g.E('openGrow(0)');
        g.E('startPour()');
        break;
      case 'poured':
        g.E('lockPour()');
        break;
      default:
        g.E('coachAdvance()');
    }
    /* A tenth of a second: long enough for the 30ms and 60ms nudges the game
       uses to advance the coach, short enough that the 3800ms auto-lock on a
       hesitated pour does not fire and skip the step that teaches you to tap
       in the gold. */
    g.h.runTimers(100);
  }

  for (let guard = 0; guard < STEPS.length + 4; guard++) {
    const i = g.step();
    if (i < 0 || i >= STEPS.length) break;
    const w = g.waiting();
    trail.push((i + 1) + (w ? ':' + w : ':next'));
    act(w);
    if (g.step() === i) { stuck = (i + 1) + ' waiting for ' + (w || 'next'); break; }
  }

  console.log('  walked: ' + trail.join(' -> '));
  check('every step of the tutorial can actually be completed', !stuck,
        'stuck at step ' + stuck);
  check('and walking it reaches the end',
        g.E('coachIdx') >= STEPS.length || !g.E('coachActive()'),
        'ended at step ' + (g.E('coachIdx') + 1) + ' of ' + STEPS.length);
  check('which marks the tutorial done', g.E('tutor').done === true,
        JSON.stringify(g.E('tutor')));
}

/* ---- doing the thing must be what advances it, not time passing ---- */
{
  const g = newcomer();
  g.E('startTutorial(true)');
  g.E('coachAdvance()');                     // past the welcome, onto 'planter'
  check('the second step waits for the player', g.waiting() === 'planter',
        String(g.waiting()));
  const before = g.step();
  g.h.runTimers(100);
  g.h.runTimers(100);
  check('and waiting does not advance it by itself', g.step() === before,
        before + ' -> ' + g.step());
  g.E('openPlanter(0)');
  g.h.runTimers(100);
  check('but opening the planter does', g.step() === before + 1,
        before + ' -> ' + g.step());
}

/* ---- hesitating on a pour must not strand the learner ----
   startPour arms a 3800ms timer that locks the drop for you if you never
   tap. Nothing had ever run it, because deferred work was discarded. A
   beginner reading the instruction is exactly the person it fires on, so
   what it does to them matters more than what it does to anyone. */
{
  const g = newcomer();
  g.s.coins = 500;
  g.E('plant(0,"elm")');
  g.E('openGrow(0)');
  const water = g.s.water, stage = g.s.plots[0].stage;
  g.E('startPour()');
  check('a pour arms a timer to resolve itself', g.h.pendingTimers() > 0,
        g.h.pendingTimers() + ' pending');
  g.h.runTimers(500);
  check('and half a second of hesitation is not enough to trigger it',
        g.E('pour') !== null);
  g.h.runTimers(4000);
  console.log('\n  hesitating four seconds: water ' + water + ' -> ' + g.s.water +
              ', stage ' + stage + ' -> ' + (g.s.plots[0] ? g.s.plots[0].stage : '-'));
  check('but four seconds does', g.E('pour') === null);
  check('and it costs the drop rather than hanging', g.s.water < water,
        water + ' -> ' + g.s.water);
  check('leaving the plant in a sane state',
        g.s.plots[0] && g.s.plots[0].stage >= stage &&
        g.s.plots[0].stage <= g.E('byId')['elm'].stages);

  /* And the coach must move on either way — the code says a miss still
     teaches it, so a beginner who hesitates is not left on a step whose
     instruction they can no longer follow. */
  const t = newcomer();
  t.s.coins = 500;
  t.E('startTutorial(true)');
  while (t.waiting() !== 'poured' && t.step() < t.E('STEPS').length) {
    const w = t.waiting();
    if (w === 'planter') t.E('openPlanter(0)');
    else if (w === 'planted') t.E('plant(0,"elm")');
    else if (w === 'pourStarted') { t.E('openGrow(0)'); t.E('startPour()'); }
    else t.E('coachAdvance()');
    t.h.runTimers(100);
  }
  const at = t.step();
  check('the tutorial reaches the tap-in-the-gold step', t.waiting() === 'poured',
        'waiting for ' + t.waiting());
  t.h.runTimers(4000);                       // never tap; let it lock itself
  /* The auto-lock schedules the coach nudge 60ms later, so the clock has to
     move again — draining once fires the lock and stops short of what it
     arms. */
  t.h.runTimers(100);
  check('and a spilled drop still moves the tutorial on', t.step() > at,
        'step ' + (at + 1) + ' -> ' + (t.step() + 1));
}

/* ---- a player who skips must stay skipped ---- */
{
  const g = newcomer();
  g.E('startTutorial(true)');
  g.E('endTutorial()');
  check('skipping ends it', !g.E('coachActive()'));
  check('and records that it is done', g.E('tutor').done === true);
  /* Reload: the tutorial must not come back. Nothing is more irritating in a
     game you return to than being taught it again. */
  const again = H.build({ preload: { 'fibgarden.tutor': JSON.stringify(g.E('tutor')) } });
  check('and it does not start again on the next visit',
        !again.evalIn('coachActive()'), 'coachIdx=' + again.evalIn('coachIdx'));
}

/* ---- and a half-finished tutorial must resume, not restart ---- */
{
  const g = newcomer();
  g.E('startTutorial(true)');
  g.E('coachAdvance()'); g.E('coachAdvance()');
  const at = g.E('tutor').step;
  check('progress through the tutorial is saved', at > 0, 'step ' + at);
  const back = H.build({ preload: { 'fibgarden.tutor': JSON.stringify(g.E('tutor')) } });
  back.evalIn('startTutorial(false)');
  console.log('\n  left at step ' + (at + 1) + ', came back to step ' +
              (back.evalIn('coachIdx') + 1));
  check('and coming back resumes where you left off',
        back.evalIn('coachIdx') === at, at + ' vs ' + back.evalIn('coachIdx'));
}

/* ---- the tutorial must not teach a number the game does not use ---- */
{
  const g = newcomer();
  const STEPS = g.E('STEPS');
  const words = STEPS.map(function (s) { return s.title + ' ' + s.text; }).join(' ');
  const nums = (words.match(/\b\d+\b/g) || []).map(Number);
  console.log('  numbers the tutorial quotes: ' + (nums.join(', ') || 'none'));
  /* Every figure it states has to be one the game really uses, or the first
     thing a player learns is something untrue. */
  const known = [g.E('START_PLOTS'), g.E('MAX_PLOTS'), 9, 3,
                 g.E('WATER_REGEN_MS') / 60000, g.E('waterCap')(),
                 g.E('FEVER_COMBO'), Math.round(g.E('FEVER_MS') / 1000),
                 /* derived, not a constant: a drop every 13 minutes is about
                    110 a day, and that is the figure the water step quotes */
                 Math.round(24 * 60 / (g.E('WATER_REGEN_MS') / 60000)),
                 Math.floor(24 * 60 / (g.E('WATER_REGEN_MS') / 60000) / 10) * 10]
                 .concat(g.E('FIB'));
  const unknown = nums.filter(function (n) { return known.indexOf(n) < 0; });
  check('every number the tutorial states is one the game uses',
        !unknown.length, unknown.join(', ') + ' (known: ' + known.join(',') + ')');
  check('and nothing in it reads as a placeholder',
        !/TODO|TBD|lorem|xxx/i.test(words));
  /* Room on a phone. A step whose text runs past a screenful pushes the
     Next button off the bottom and the tutorial dead-ends. */
  const longest = STEPS.reduce(function (m, s) {
    return s.text.replace(/<[^>]+>/g, '').length > m.n
      ? { n: s.text.replace(/<[^>]+>/g, '').length, t: s.title } : m;
  }, { n: 0, t: '' });
  console.log('  longest step: "' + longest.t + '" at ' + longest.n + ' characters');
  check('no step is longer than a phone screen holds', longest.n <= 260,
        longest.t + ' at ' + longest.n);
}

/* ---- and the newcomer must be able to afford the thing it asks for ---- */
{
  const g = newcomer();
  const cheapest = g.E('cheapestSeedNow()');
  console.log('\n  a new gardener starts with ' + g.s.coins + '🪙 and ' +
              g.s.water + ' drops; the cheapest seed is ' + cheapest + '🪙');
  check('a new player can afford the seed the tutorial tells them to buy',
        g.s.coins >= cheapest, g.s.coins + ' vs ' + cheapest);
  /* The tutorial asks for an elm by name, so it is that one specifically
     that has to be affordable and unlocked. */
  const elm = g.E('byId')['elm'];
  check('and the elm it names by name is one of them',
        elm && elm.lvl <= g.s.level && g.E('seedCostOf')(elm) <= g.s.coins,
        'elm costs ' + (elm ? g.E('seedCostOf')(elm) : '?'));
  check('with drops enough to finish it',
        g.s.water >= elm.stages - g.E('timerCeiling')(elm, null),
        g.s.water + ' drops, needs ' + (elm.stages - g.E('timerCeiling')(elm, null)));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

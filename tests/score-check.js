/* Iteration 61: the score has been playing since iteration 20 and nothing
   has ever listened to it.

   It could not: the harness handed the game a null AudioContext, so every
   note returned at the first line, and it stubbed setInterval to nothing, so
   the thing that drives the score never ran. Both are real now — notes are
   recorded, intervals can be stepped — and the questions the setting screen
   makes to the player can finally be asked of the code. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

/* A garden with the music on and the clock somewhere specific. */
function garden(opts) {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0;
  const o = E('opt'); o.sound = true; o.music = true; o.ambient = false;
  if (opts && opts.hour !== undefined) {
    /* Move the in-game clock to the hour asked for. hourNow() reads local
       hours, not UTC — measuring against UTC put every test an unknown
       number of hours away from the hour it thought it had set. */
    s.offset += (opts.hour - E('hourNow')()) * 3600000;
  }
  if (opts && opts.season) s.offset += opts.season;
  const ctx = E('audio()');
  return { h: h, E: E, s: s, ctx: ctx,
           bar: function () { ctx.notes.length = 0; E('playBar()'); return ctx.notes; } };
}

/* ---- the season has to pick the mode ---- */
{
  const g = garden();
  const heard = {};
  Object.keys(g.E('SCALES')).forEach(function (season) {
    const scale = g.E('SCALES')[season];
    heard[season] = scale.join(',');
  });
  const distinct = Object.keys(heard).filter(function (k, i, a) {
    return a.findIndex(function (o) { return heard[o] === heard[k]; }) === i;
  });
  console.log('  modes: ' + Object.keys(heard).map(function (k) {
    return k + ' [' + heard[k] + ']';
  }).join('  '));
  check('all four seasons are in different modes',
        distinct.length === 4, distinct.length + ' distinct of 4');
  /* Each has to be a seven-note scale, or it is not a mode, it is a bug. */
  check('and every mode is a seven-note scale',
        Object.keys(heard).every(function (k) { return g.E('SCALES')[k].length === 7; }));
  const roots = g.E('SEASON_ROOT');
  check('and each season has its own root note',
        Object.keys(roots).length === 4 &&
        new Set(Object.keys(roots).map(function (k) { return roots[k]; })).size === 4,
        JSON.stringify(roots));

  /* The bars the game actually plays must land on the scale it chose. */
  const season = g.E('seasonNow')().id;
  const scale = g.E('SCALES')[season], root = g.E('SEASON_ROOT')[season];
  const notes = g.bar().filter(function (n) { return n.kind === 'osc'; });
  const offScale = notes.filter(function (n) {
    /* semitones above the root, folded into an octave */
    const semis = Math.round(12 * Math.log2(n.freq / root));
    return scale.indexOf(((semis % 12) + 12) % 12) < 0;
  });
  console.log('  a bar in ' + season + ': ' + notes.length + ' notes, ' +
    notes.map(function (n) { return Math.round(n.freq); }).join(' ') + ' Hz');
  check('every note it plays is in the season\'s scale',
        !offScale.length, offScale.map(function (n) { return Math.round(n.freq); }).join(','));
}

/* ---- the hour has to set the tempo, and keep setting it ---- */
{
  const day = garden({ hour: 12 }), night = garden({ hour: 2 });
  const dayBeat = day.E('beatMs')(), nightBeat = night.E('beatMs')();
  console.log('\n  tempo: ' + dayBeat + 'ms by day, ' + nightBeat + 'ms at night');
  check('the garden plays slower at night', nightBeat > dayBeat,
        dayBeat + ' vs ' + nightBeat);
}

/* ---- fever doubles it, AND it comes back down ----
   This is the bug this file was written for. musicRetime() was called from
   exactly one place — the moment fever starts — and there is no fever-ending
   code anywhere in the game: feverActive() is a comparison against a
   timestamp and nothing more. So the score went double-time on the first
   combo of thirteen and stayed there for the rest of the session. */
{
  const g = garden({ hour: 12 });
  g.E('startMusic()');
  /* Ask the game what tempo it thinks it is at, and confirm a real interval
     is registered at that period — reading the last interval in the list
     would pick up whatever the tick loop happened to register last. */
  const iv = function () { return g.E('musicBeat'); };
  const registered = function () {
    const id = g.E('musicTimer');
    const t = g.h.intervals.filter(function (x) { return x.id === id; })[0];
    return t ? t.ms : null;
  };
  const calm = iv();
  g.E('startFever()');
  const hot = iv();
  /* Let fever lapse the way it really does — by the clock passing it. */
  g.s.offset += g.E('FEVER_MS') + 5000;
  check('fever really has ended', !g.E('feverActive()'));
  /* One more bar goes by, and the score has to notice by itself. */
  g.h.tickIntervals(1);
  const after = iv();
  console.log('\n  score tempo: ' + calm + 'ms → fever ' + hot + 'ms → after ' + after + 'ms');
  check('fever puts the score into double time', hot < calm, hot + ' vs ' + calm);
  check('and when fever ends the score comes back down',
        after === calm, after + 'ms against the ' + calm + 'ms it started at');
  check('and the interval it is running on matches the tempo it claims',
        registered() === after, registered() + ' vs ' + after);
}

/* ---- and the same for the sun going down ---- */
{
  const g = garden({ hour: 12 });
  g.E('startMusic()');
  const last = function () { return g.E('musicBeat'); };
  const byDay = last();
  g.s.offset += 10 * 3600000;                 // noon to ten at night
  check('the clock really has moved to night', !g.E('isDay()'));
  g.h.tickIntervals(1);
  const byNight = last();
  console.log('  crossing dusk: ' + byDay + 'ms → ' + byNight + 'ms');
  /* "The hour sets the tempo" used to be true only of the hour you happened
     to open the app in — nothing re-timed when the sun went down. */
  check('the score slows down when the sun does', byNight > byDay,
        byDay + ' -> ' + byNight);
}

/* ---- the chord has to be as full as the garden ---- */
{
  const rows = [];
  [0, 2, 4, 6, 9].forEach(function (n) {
    const g = garden({ hour: 12 });
    g.s.plotCount = 9;
    while (g.s.plots.length < 9) g.s.plots.push(null);
    g.s.coins = 9999;
    for (let i = 0; i < 9; i++) {
      g.E('plant(' + i + ',"elm")');
      if (i < n) g.s.plots[i].stage = g.E('byId')['elm'].stages;   // in bloom
    }
    const notes = g.bar().filter(function (x) { return x.type === 'triangle'; });
    rows.push({ blooms: n, voices: notes.length });
  });
  console.log('\n  blooms → chord voices: ' + rows.map(function (r) {
    return r.blooms + '→' + r.voices;
  }).join('  '));
  /* Iteration 20 called this music that plays the garden, and for forty
     iterations it played nothing but the calendar and the clock. */
  check('an empty garden and a full one do not sound the same',
        rows[0].voices < rows[rows.length - 1].voices,
        rows[0].voices + ' vs ' + rows[rows.length - 1].voices);
  let backwards = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].voices < rows[i - 1].voices) {
      backwards.push(rows[i - 1].blooms + '→' + rows[i].blooms);
    }
  }
  check('and the chord never thins out as the garden fills',
        !backwards.length, backwards.join(', '));
  check('but it does not grow without limit', rows[rows.length - 1].voices <= 5,
        String(rows[rows.length - 1].voices));
}

/* ---- the entries have to be spaced by the sequence ---- */
{
  const g = garden({ hour: 12 });
  g.s.plotCount = 9;
  while (g.s.plots.length < 9) g.s.plots.push(null);
  g.s.coins = 9999;
  for (let i = 0; i < 9; i++) {
    g.E('plant(' + i + ',"elm")');
    g.s.plots[i].stage = g.E('byId')['elm'].stages;
  }
  const notes = g.bar().filter(function (n) { return n.type === 'triangle'; })
                       .sort(function (a, b) { return a.at - b.at; });
  const beat = g.E('beatMs')() / 1000;
  const steps = [];
  for (let i = 1; i < notes.length; i++) {
    steps.push(Math.round((notes[i].at - notes[i - 1].at) / (beat * 0.06)));
  }
  console.log('  entry gaps, in sixteenths of a beat: ' + steps.join(' '));
  const FIB = g.E('FIB');
  check('the chord rolls in on Fibonacci spacing',
        steps.length >= 3 && steps.every(function (s, i) { return s === FIB[i]; }),
        steps.join(',') + ' against ' + FIB.slice(0, steps.length).join(','));
}

/* ---- and it has to sit under everything else ---- */
{
  const g = garden({ hour: 12 });
  const notes = g.bar();
  const loudest = notes.reduce(function (m, n) { return Math.max(m, n.peak || 0); }, 0);
  /* Every sound effect is a function, not a table of gains, so the only
     honest way to ask how loud they are is to play them all and listen. */
  g.ctx.notes.length = 0;
  Object.keys(g.E('SFX')).forEach(function (k) {
    try { g.E('SFX')[k](3); } catch (e) {}
  });
  const sfxPeak = g.ctx.notes.reduce(function (m, n) { return Math.max(m, n.peak || 0); }, 0);
  console.log('\n  loudest note in a bar: ' + loudest.toFixed(3) +
              ' · loudest sound effect: ' + sfxPeak.toFixed(3));
  check('no note in the score is louder than the loudest effect',
        loudest <= sfxPeak, loudest.toFixed(3) + ' vs ' + sfxPeak.toFixed(3));
  check('and the score bus sits below the effects',
        g.E('musicGain')().gain.value <= 0.2,
        String(g.E('musicGain')().gain.value));
}

/* ---- silence has to mean silence ---- */
{
  const g = garden({ hour: 12 });
  g.E('opt').music = false;
  check('nothing plays with the score switched off', g.bar().length === 0,
        String(g.bar().length) + ' notes');
  g.E('opt').music = true; g.E('opt').sound = false;
  check('nor with sound switched off entirely', g.bar().length === 0,
        String(g.bar().length) + ' notes');

  const q = garden({ hour: 12 });
  q.E('startMusic()');
  const running = q.h.intervals.length;
  q.E('stopMusic()');
  check('stopping the score really stops it',
        q.h.intervals.length < running,
        running + ' -> ' + q.h.intervals.length);
  check('and leaves no timer behind', q.E('musicTimer') === null,
        String(q.E('musicTimer')));
  /* Counting every note here counts the sound effects the tick loop fires
     too — a one-time hint chimes on the first pass — so the honest question
     is whether three bars with the score running are louder than three bars
     without it, not whether the app is silent. */
  const playing = garden({ hour: 12 });
  playing.E('startMusic()');
  playing.ctx.notes.length = 0;
  playing.h.tickIntervals(3);
  const withScore = playing.ctx.notes.length;
  q.ctx.notes.length = 0;
  q.h.tickIntervals(3);
  const without = q.ctx.notes.length;
  console.log('\n  three bars with the score: ' + withScore +
              ' notes · with it stopped: ' + without);
  check('a stopped score really does stop playing',
        without < withScore, without + ' against ' + withScore);
}

/* ---- starting twice must not start two of them ---- */
{
  const g = garden({ hour: 12 });
  const before = g.h.intervals.length;
  g.E('startMusic()');
  const one = g.h.intervals.length;
  g.E('startMusic()');
  const two = g.h.intervals.length;
  check('starting the score twice leaves one score playing',
        two === one && one > before, before + ' -> ' + one + ' -> ' + two);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

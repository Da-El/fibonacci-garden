/* Iteration 96: the sound of a session, start to finish.

   sound-check verifies every sound is defined, triggered somewhere in the
   source, and mixed within a sane range. score-check drives the generative
   music. Neither has ever listened to a session in order — what actually
   fires, how often, and whether anything is deafening by repetition.

   The harness records every oscillator into ctx.notes, so this plays twenty
   minutes of ordinary gardening and counts the result. A sound that fires
   forty times a minute is not a sound, it is a texture; and a sound nothing
   in ordinary play ever reaches is a sound nobody has heard. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SFX_NAMES = Object.keys(E('SFX'));
const MIN = 60000;

/* Play a session and return what was heard. The music is left off unless
   asked for, so the effects can be counted without a bar line under them. */
function session(opts) {
  opts = opts || {};
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 4000; s.level = 10; s.water = 60;
  G('tutor').done = true;
  const o = G('opt');
  o.sound = true; o.music = !!opts.music;
  /* Count each sfx by name as well as by note, by wrapping the table the
     game dispatches through — the real functions still run, so the mix is
     the real mix. */
  const fired = {};
  const SFX = G('SFX');
  Object.keys(SFX).forEach(function (k) {
    const real = SFX[k];
    SFX[k] = function (a) { fired[k] = (fired[k] | 0) + 1; return real(a); };
  });
  const ctx = G('audio()') || null;
  let flip = 1;
  for (let m = 0; m < (opts.mins || 20); m++) {
    s.offset += MIN;
    G('growthTick()');
    G('tickWater()');
    for (let i = 0; i < s.plotCount; i++) {
      const p = s.plots[i];
      if (!p) {
        if (s.coins >= 40) G('plant(' + i + ',"' + (opts.sp || 'daisy') + '")');
        continue;
      }
      const sp = G('byId')[p.s];
      if (p.stage >= sp.stages) { G('curPlot = ' + i); G('harvest()'); continue; }
      if (s.water <= 0) continue;
      G('curPlot = ' + i);
      G('doAct()');
      const pr = G('pour');
      if (!pr) continue;
      flip = -flip;
      /* A real hand is not a constant. Pouring every drop dead centre made
         every bloom pristine, so the ordinary harvest sound never fired once
         in twenty minutes and the check read that as a defect. Rotate through
         a hit, a near miss and a spill, which is what a session sounds like. */
      const ladder = opts.err !== undefined ? [opts.err]
                                            : [15, 15, 90, 15, 240, 15, 90];
      const err = ladder[(m + i) % ladder.length] / (pr.period / 2) * flip;
      pr.t0 = G('performance.now()') -
              Math.max(0.001, Math.min(0.999, pr.center + err)) * pr.period;
      G('lockPour()');
    }
    /* And the things a player touches between pours, which are where half
       the sound set lives. */
    if (m % 4 === 3) { G('sfx')('tap'); G('paintMarket()'); }
    if (G('barnCountAll()') > 6) G('sellAll()');
  }
  return { g: g, G: G, s: s, fired: fired,
           notes: (G('audio()') && G('audio()').notes) || [] };
}

/* ---- twenty minutes of ordinary play, counted ---- */
{
  const r = session({ mins: 20 });
  const total = Object.keys(r.fired).reduce(function (a, k) { return a + r.fired[k]; }, 0);
  console.log('  twenty minutes of ordinary play: ' + total + ' sounds, ' +
    r.notes.length + ' notes');
  console.log('    sound        fired   per minute');
  const rows = Object.keys(r.fired).sort(function (a, b) { return r.fired[b] - r.fired[a]; });
  rows.forEach(function (k) {
    console.log('    ' + k.padEnd(12) + String(r.fired[k]).padStart(5) +
      (r.fired[k] / 20).toFixed(1).padStart(12));
  });

  check('a session makes a sound at all', total > 0, String(total));
  check('and every sound it makes reaches the audio context',
        r.notes.length > 0, String(r.notes.length));

  /* Nothing may be so frequent it stops being a signal. Twelve a minute is
     one every five seconds, which is about the rate of the pour itself. */
  const loud = rows.filter(function (k) { return r.fired[k] / 20 > 12; });
  console.log('    louder than one every five seconds: ' + (loud.join(', ') || 'none'));
  check('nothing fires more than a dozen times a minute',
        !loud.length, loud.map(function (k) {
          return k + ' ' + (r.fired[k] / 20).toFixed(1) + '/min';
        }).join(', '));

  /* And the ones that never fire. Some are genuinely rare — a jackpot, a
     level-up, a storm — but they have to be reachable from *somewhere*, and
     sound-check proves each has a call site. What this adds is which ones an
     ordinary twenty minutes never reaches, stated rather than assumed. */
  const silent = SFX_NAMES.filter(function (k) { return !r.fired[k]; });
  console.log('    never heard in ordinary play: ' + (silent.join(', ') || 'none'));
  /* Some are rare by design — a storm, the wheel, a level-up, a jackpot —
     and sound-check already proves each has a call site. What matters here
     is that the sounds the *loop* makes all fire, every session, and that the
     rare ones are the rare ones rather than an arbitrary dozen. */
  const LOOP = ['pourStart', 'perfect', 'good', 'spill', 'harvest', 'plant', 'coin'];
  LOOP.forEach(function (k) {
    check('the loop\'s own sound fires: ' + k, (r.fired[k] | 0) > 0,
          String(r.fired[k] | 0));
  });
  check('and everything unheard is something ordinary play does not do',
        silent.every(function (k) { return LOOP.indexOf(k) < 0; }),
        silent.filter(function (k) { return LOOP.indexOf(k) > -1; }).join(', '));
}

/* ---- and the mix holds when three things land at once ---- */
{
  const r = session({ mins: 3 });
  const peaks = r.notes.map(function (n) { return n.peak || 0; }).filter(function (p) { return p; });
  const hi = Math.max.apply(null, peaks.concat(0));
  console.log('\n  loudest single note in the session: ' + hi.toFixed(3));
  check('no single note is at full scale', hi < 1, hi.toFixed(3));
  check('and none is silent either', peaks.some(function (p) { return p > 0.01; }),
        String(peaks.length) + ' notes with a peak');

  /* Three sounds inside one animation frame is the real worst case: a
     perfect pour that completes a combo that tips into fever. Summed, they
     must not clip. */
  const g = H.build(); const G = g.evalIn;
  G('opt').sound = true;
  const before = G('audio()').notes.length;
  G('sfx')('perfect', 13); G('sfx')('jackpot'); G('sfx')('fever');
  const burst = G('audio()').notes.slice(before);
  const sum = burst.reduce(function (a, n) { return a + (n.peak || 0); }, 0);
  console.log('  a perfect pour, a jackpot and fever together: ' + burst.length +
    ' notes, peaks summing to ' + sum.toFixed(2));
  check('the worst simultaneous burst does not clip', sum < 4,
        sum.toFixed(2) + ' across ' + burst.length + ' notes');
}

/* ---- silence must be honoured ---- */
{
  const g = H.build(); const G = g.evalIn;
  G('opt').sound = false;
  const before = (G('audio()') && G('audio()').notes.length) || 0;
  SFX_NAMES.forEach(function (k) { G('sfx')('' + k); });
  const after = (G('audio()') && G('audio()').notes.length) || 0;
  console.log('\n  every sound fired with sound switched off: ' +
    (after - before) + ' notes');
  check('sound off means no note is ever played', after === before,
        (after - before) + ' notes escaped');

  /* And the music must not run either, even though it is on its own timer. */
  const m = H.build(); const M = m.evalIn;
  M('opt').sound = false; M('opt').music = true;
  M('startMusic()');
  const mb = (M('audio()') && M('audio()').notes.length) || 0;
  m.tickIntervals(8);
  const ma = (M('audio()') && M('audio()').notes.length) || 0;
  console.log('  and eight bars of music with sound off: ' + (ma - mb) + ' notes');
  check('and the score is silent too', ma === mb, (ma - mb) + ' notes escaped');
}

/* ---- with the music on, the garden actually plays ---- */
{
  const m = H.build(); const M = m.evalIn; const s = M('state');
  s.offset = 0;
  M('opt').sound = true; M('opt').music = true;
  /* The score runs on its own interval, and that interval is only armed by
     startMusic() — settings toggles it, and nothing else does. */
  M('startMusic()');
  const before = M('audio()').notes.length;
  m.tickIntervals(16);
  const played = M('audio()').notes.length - before;
  console.log('\n  sixteen bars with the music on: ' + played + ' notes');
  check('the score plays when it is switched on', played > 0, String(played));
  /* And it must be quieter than the effects it sits under, or the game is
     a piece of music with gardening on top. */
  const musicPeak = M('audio()').notes.slice(before)
    .reduce(function (a, n) { return Math.max(a, n.peak || 0); }, 0);
  const g = H.build(); const G = g.evalIn;
  G('opt').sound = true;
  const eb = G('audio()').notes.length;
  G('sfx')('perfect', 3);
  const fxPeak = G('audio()').notes.slice(eb)
    .reduce(function (a, n) { return Math.max(a, n.peak || 0); }, 0);
  console.log('  loudest music note ' + musicPeak.toFixed(3) +
    ' against a perfect pour at ' + fxPeak.toFixed(3));
  check('the score sits under the sounds the player is making',
        musicPeak < fxPeak, musicPeak.toFixed(3) + ' against ' + fxPeak.toFixed(3));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

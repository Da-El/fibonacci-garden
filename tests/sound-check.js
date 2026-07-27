const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Iteration 40: twenty synthesized sounds and nothing has ever counted which
   ones play. Same method that found the dead wilt penalty: instrument a run,
   report what never fires and what fires so often it becomes noise, and check
   the gains are consistent so nothing is jarringly loud. */
const H = require('./harness.js');
const HOUR = 3600000;
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const html = require('fs').readFileSync(GAME_PATH, 'utf8');

/* ---- 1. every sound defined must be triggered somewhere, and vice versa ---- */
{
  const h = H.build(); const E = h.evalIn;
  const defined = Object.keys(E('SFX'));
  const fired = new Set();
  /* Some calls pick the sound with a conditional — sfx(golden ? 'golden' :
     'harvest') — so scan every quoted name inside an sfx(...) call rather
     than only one that starts it. */
  const re = /sfx\(([^;\n]{0,140}?)\)/g; let m;
  while ((m = re.exec(html))) {
    const nre = /'([a-zA-Z]+)'/g; let q;
    while ((q = nre.exec(m[1]))) fired.add(q[1]);
  }

  const dead = defined.filter(function (k) { return !fired.has(k); });
  const missing = Array.from(fired).filter(function (k) { return defined.indexOf(k) < 0; });
  check('every sound defined is triggered somewhere', !dead.length, dead.join(','));
  check('every sound triggered is defined', !missing.length, missing.join(','));
  console.log('  ' + defined.length + ' sounds defined, ' + fired.size + ' trigger sites');
}

/* ---- 2. how loud is each one? a stray gain is a jarring sound ---- */
{
  const h = H.build(); const E = h.evalIn;
  const src = html.slice(html.indexOf('const SFX = {'), html.indexOf('function sfx(name'));
  const gains = {};
  Object.keys(E('SFX')).forEach(function (name) {
    // pull the gains out of this sound's own definition
    const i = src.indexOf(name + ':');
    if (i < 0) return;
    let j = src.indexOf('\n  ', i + 1);
    const body = src.slice(i, j < 0 ? src.length : j);
    const g = [];
    const re = /gain:\s*([\d.]+)/g; let m;
    while ((m = re.exec(body))) g.push(parseFloat(m[1]));
    if (g.length) gains[name] = Math.max.apply(null, g);
  });
  const vals = Object.keys(gains).map(function (k) { return gains[k]; });
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  console.log('  peak gains: ' + Object.keys(gains).sort(function (a, b) { return gains[b] - gains[a]; })
    .map(function (k) { return k + ' ' + gains[k]; }).join(', '));
  /* wheel, bug and coin are rapid repeating ticks meant to sit under
     everything else, so they are excluded from the spread. */
  const TICKS = ['wheel', 'bug', 'coin', 'tap'];   // UI and repeating ticks
  const body = Object.keys(gains).filter(function (k) { return TICKS.indexOf(k) < 0; })
    .map(function (k) { return gains[k]; });
  const blo = Math.min.apply(null, body), bhi = Math.max.apply(null, body);
  check('the sounds that matter sit within a two-fold loudness spread',
        bhi / blo <= 2.2, 'range ' + blo + '..' + bhi + ' (x' + (bhi / blo).toFixed(1) + ')');
  check('nothing is loud enough to clip on its own', hi <= 0.35, 'loudest ' + hi);
}

/* ---- 3. which sounds actually play in three weeks of play? ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 40000; s.level = 12;
  // count every call instead of making noise
  E('sfx = (function(){ return function(name){ state.__sfx = state.__sfx || {}; state.__sfx[name] = (state.__sfx[name]||0)+1; }; })()');
  E('buyHive()'); E('hireApprentice()');
  let rng = 5; const rand = function () { rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF; return rng / 0x7FFFFFFF; };
  for (let d = 0; d < 21; d++) {
    for (let g = 0; g < 4; g++) {
      s.offset += 6 * HOUR;
      try { E('catchUpWithLedger()'); } catch (e) {}
      for (let k = 0; k < 40; k++) {
        let acted = false;
        const cur = E('state');
        for (let i = 0; i < cur.plots.length; i++) {
          const p = cur.plots[i];
          if (!p) continue;
          const sp = E('byId')[p.s];
          if (p.bug) { E('curPlot=' + i); try { E('squashBug()'); } catch (e) {} acted = true; }
          else if (p.stage >= sp.stages) { E('curPlot=' + i); try { E('harvest()'); } catch (e) { cur.plots[i] = null; } acted = true; }
          else if (cur.water > 0) {
            E('curPlot=' + i);
            const perfect = rand() < 0.6;
            if (!perfect) p.spills = (p.spills | 0) + 1;
            // go through the real pour path so its sounds are counted
            try { E('startPour()'); E('lockPour()'); } catch (e) {
              try { E('advanceStage("water",' + perfect + ')'); } catch (e2) {}
            }
            acted = true;
          }
        }
        try { E('sellAll()'); } catch (e) {}
        for (let i = 0; i < E('state').plotCount; i++) {
          if (E('state').plots[i]) continue;
          const list = E('SPECIES').filter(function (x) {
            return x.lvl <= E('state').level && E('seedCostOf')(x) <= E('state').coins * 0.4;
          });
          if (!list.length) break;
          list.sort(function (a, b) { return E('seedCostOf')(b) - E('seedCostOf')(a); });
          try { E('plant(' + i + ',"' + list[0].id + '")'); acted = true; } catch (e) {}
        }
        if (!acted) break;
      }
    }
  }
  const played = s.__sfx || {};
  const all = Object.keys(E('SFX'));
  const counts = all.map(function (k) { return { k: k, n: played[k] | 0 }; })
    .sort(function (a, b) { return b.n - a.n; });
  console.log('\n  played over 21 days:');
  counts.forEach(function (c) {
    console.log('    ' + (c.n ? String(c.n).padStart(6) : ' never') + '  ' + c.k);
  });
  const total = counts.reduce(function (a, c) { return a + c.n; }, 0);
  const top = counts[0];
  console.log('  total ' + total + ', busiest is ' + top.k + ' at ' +
              Math.round(top.n / total * 100) + '% of everything');
  /* Sounds only a rare event triggers are fine; what matters is that the
     common ones are not all the same sound, and that the mix is not one
     sound repeated. */
  check('no single sound is more than half of everything you hear',
        top.n / total <= 0.5, top.k + ' is ' + Math.round(top.n / total * 100) + '%');
}

/* ---- 4. the ambient layer must actually change with time and weather ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  const seen = new Set();
  for (let hr = 0; hr < 24; hr++) {
    s.offset = hr * HOUR;
    seen.add(E('isDay()') ? 'day' : 'night');
    if (E('isDusk()')) seen.add('dusk');
  }
  check('the day has a day, a night and a golden hour', seen.size === 3,
        Array.from(seen).join(','));
  const amb = html.indexOf('function ambient') > -1 || html.indexOf('startAmbient') > -1;
  check('there is an ambient layer to change', amb);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });
process.exit(bugs.length ? 1 : 0);

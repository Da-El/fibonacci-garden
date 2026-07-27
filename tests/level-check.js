/* Iteration 51: levels 1-8 unlock the nine wild species and the shelf runs to
   16, but the XP curve has never been measured against the current economy.
   If a committed player finishes three weeks at level 10, then levels 12, 14
   and 16 — a third of the shelf — may as well not exist. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;

/* ---- the curve itself ---- */
{
  const s = E('state');
  const rows = [];
  let cum = 0;
  for (let lvl = 1; lvl <= 17; lvl++) {
    s.level = lvl;
    const need = E('xpForNext()');
    cum += need;
    rows.push({ lvl: lvl, need: need, cum: cum });
  }
  console.log('  level  xp to next   cumulative   unlocks');
  const unlockAt = {};
  E('SPECIES').forEach(function (sp) {
    if (!unlockAt[sp.lvl]) unlockAt[sp.lvl] = [];
    unlockAt[sp.lvl].push(sp.id);
  });
  rows.forEach(function (r) {
    console.log('  ' + String(r.lvl).padStart(5) + String(r.need).padStart(11) +
      String(r.cum).padStart(13) + '   ' + ((unlockAt[r.lvl + 1] || []).join(', ')));
  });
  let climbs = true;
  for (let i = 1; i < rows.length; i++) if (rows[i].need < rows[i - 1].need) climbs = false;
  check('each level costs at least as much as the last', climbs);
  check('the top of the shelf is not absurdly far',
        rows[15].cum <= rows[7].cum * 30,
        'level 16 costs ' + rows[15].cum + ' against level 8 at ' + rows[7].cum);
}

/* ---- where does XP actually come from? ---- */
{
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sources = [];
  const re = /addXP\((\d+|[a-zA-Z][\w.()' ?:]*)\)/g;
  let m;
  while ((m = re.exec(html))) sources.push(m[1]);
  const counts = {};
  sources.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
  console.log('\n  XP is awarded from ' + sources.length + ' places: ' +
    Object.keys(counts).map(function (k) { return k + (counts[k] > 1 ? '×' + counts[k] : ''); }).join(', '));
  check('there is more than one way to earn XP', Object.keys(counts).length >= 3,
        Object.keys(counts).join(', '));
}

/* ---- and how far does a real three weeks get you? ---- */
{
  console.log('\n  after three weeks:');
  const reach = {};
  ['casual', 'twice', 'diligent'].forEach(function (profile) {
    const r = S.run({ seed: 4242, profile: profile });
    reach[profile] = r.level;
    const locked = E('SPECIES').filter(function (sp) { return sp.lvl > r.level; });
    console.log('    ' + profile.padEnd(9) + 'level ' + String(r.level).padStart(2) +
      '   ' + (E('SPECIES').length - locked.length) + ' of ' + E('SPECIES').length +
      ' species' + (locked.length ? '   still locked: ' + locked.map(function (x) { return x.id; }).join(', ') : ''));
  });
  const top = Math.max.apply(null, E('SPECIES').map(function (sp) { return sp.lvl; }));
  check('a once-a-day gardener gets past the first shelf in three weeks',
        reach.casual >= 8, 'reached ' + reach.casual);
  check('playing more visibly gets you further',
        reach.diligent > reach.twice || reach.twice > reach.casual,
        reach.casual + ' / ' + reach.twice + ' / ' + reach.diligent);
  /* Not the whole shelf. A committed player should end three weeks within
     reach of the last crop but not holding it — content you have exhausted is
     worse than content you can see coming. */
  check('a committed gardener ends three weeks one unlock short of the last',
        reach.diligent >= top - 2 && reach.diligent < top,
        'reached ' + reach.diligent + ', the last crop needs ' + top);
  check('and a once-a-day gardener still has a third of the shelf ahead',
        reach.casual < top - 3, 'reached ' + reach.casual + ' of ' + top);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

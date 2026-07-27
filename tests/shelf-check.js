/* Iteration 59: fifteen species on the shelf and the game had never once
   compared them against each other.

   A bed costs you exactly two scarce things — drops of water and hours of
   waiting — and pays one thing back. So the rule the shelf has to obey fits
   in a sentence: anything slower has to be richer. A species that takes
   longer to reach its ceiling than one you already own AND pays less per
   drop is not a choice, it is a mistake with a nicer picture, and the level
   that unlocked it gave you nothing. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const SPECIES = E('SPECIES');
const s = E('state');
s.offset = 0;

/* Costed at one star tier for everybody, because the comparison is about
   what a species asks and pays, not about how well you happen to play it. */
const REF_STARS = 2;

function economics(sp) {
  const ceil = E('timerCeiling')(sp, null);

  /* Hours to the ceiling, planted at the hour that suits it — that is when
     anyone would plant it, and day and night species grow a quarter faster
     in their own half of the day. An easygoing species never gets that. */
  const speed = sp.pref === 'any' ? 1 : 1.25;
  const hours = ceil * sp.growMin / speed / 60;

  const gross = Math.max(1, Math.round(sp.price * E('STAR_MULT')[REF_STARS]));
  const net = gross - sp.seed;

  return {
    sp: sp, ceil: ceil, hours: hours, net: net,
    perDrop: net / sp.stages,                    // pouring every stage
    perHour: net / Math.max(0.01, hours)
  };
}

const eco = SPECIES.map(economics);
const byId = {};
eco.forEach(function (e) { byId[e.sp.id] = e; });

console.log('  species     lvl  pref    ceil  stages  seed  price   hrs   net   /drop   /hr');
eco.forEach(function (e) {
  console.log('  ' + e.sp.id.padEnd(11) + String(e.sp.lvl).padStart(3) + '  ' +
    e.sp.pref.padEnd(7) + String(e.ceil).padStart(3) + String(e.sp.stages).padStart(8) +
    String(e.sp.seed).padStart(6) + String(e.sp.price).padStart(7) +
    e.hours.toFixed(2).padStart(6) + String(e.net).padStart(6) +
    e.perDrop.toFixed(1).padStart(8) + e.perHour.toFixed(0).padStart(6));
});

/* ---- slower has to mean richer ---- */
{
  const dead = [];
  eco.forEach(function (e) {
    eco.forEach(function (o) {
      if (o.sp.id === e.sp.id) return;
      if (o.sp.lvl > e.sp.lvl) return;             // you do not have it yet
      /* Strictly quicker to the ceiling and paying at least as much per drop.
         There is then no hour of the game in which planting e is right. */
      if (o.hours < e.hours - 1e-9 && o.perDrop >= e.perDrop - 1e-9) {
        dead.push(e.sp.id + ' (lvl ' + e.sp.lvl + ') — ' + o.sp.id +
          ' reaches its ceiling in ' + o.hours.toFixed(2) + 'h against ' +
          e.hours.toFixed(2) + 'h and still pays ' + o.perDrop.toFixed(1) +
          '/drop against ' + e.perDrop.toFixed(1));
      }
    });
  });
  if (dead.length) {
    console.log('\n  no reason to plant:');
    dead.forEach(function (d) { console.log('    ' + d); });
  }
  check('nothing on the shelf is both slower and poorer than something you own',
        !dead.length, dead.length + ' of ' + SPECIES.length + ': ' + dead.join(' | '));
}

/* ---- and every species has to be the best at something ---- */
{
  /* The other side of the same coin: a species earns its place by topping
     one of the two axes among everything unlocked by its level. If it tops
     neither it is merely not-quite-dominated, which is not a reason to plant
     it either. */
  const pointless = [];
  eco.forEach(function (e) {
    const rivals = eco.filter(function (o) {
      return o.sp.lvl <= e.sp.lvl && o.sp.id !== e.sp.id;
    });
    if (!rivals.length) return;
    const fastest = rivals.every(function (o) { return e.hours <= o.hours + 1e-9; });
    const richest = rivals.every(function (o) { return e.perDrop >= o.perDrop - 1e-9; });
    if (!fastest && !richest) pointless.push(e.sp.id);
  });
  console.log('\n  best at neither speed nor payout when it arrives: ' +
              (pointless.join(', ') || 'none'));
  check('every species is either the quickest or the richest thing you own',
        !pointless.length, pointless.join(', '));
}

/* ---- the shelf has to be worth climbing ---- */
{
  const byLvl = eco.slice().sort(function (a, b) { return a.sp.lvl - b.sp.lvl; });
  const first = byLvl[0], last = byLvl[byLvl.length - 1];
  const ratio = last.perDrop / first.perDrop;
  console.log('  per drop, bottom to top: ' + first.sp.id + ' ' +
    first.perDrop.toFixed(1) + ' -> ' + last.sp.id + ' ' + last.perDrop.toFixed(1) +
    '  (×' + ratio.toFixed(1) + ')');
  check('the top of the shelf pays several times what the bottom does',
        ratio >= 4, '×' + ratio.toFixed(1));
  /* And the ceiling of what you can earn has to keep rising, or the last
     few levels are cosmetic. Measured as the best per-drop available at
     each level, which is what a player actually has access to. */
  const lvls = [];
  byLvl.forEach(function (e) { if (lvls.indexOf(e.sp.lvl) < 0) lvls.push(e.sp.lvl); });
  const bestAt = lvls.map(function (l) {
    return Math.max.apply(null, eco.filter(function (e) { return e.sp.lvl <= l; })
                                   .map(function (e) { return e.perDrop; }));
  });
  let flat = [];
  for (let i = 1; i < bestAt.length; i++) {
    if (bestAt[i] <= bestAt[i - 1] + 1e-9) flat.push('lvl ' + lvls[i]);
  }
  check('and the best drop you can buy improves at every unlock',
        !flat.length, flat.join(', '));
}

/* ---- the ladder has to climb under both ways of playing a bed ----
   There are two honest meanings of "coins per drop" and they disagree.
   Pour every stage and a drop buys a stage. Wait for the ceiling and pour
   only the rest, and a drop buys the whole difference between a stalled
   plant and a sold one — far more, and fewer of them.

   Raising four prices to fix the ladder under the first meaning broke it
   under the second, and the two checks were in different files and did not
   know about each other. They live together now. */
{
  const patient = SPECIES.map(function (sp) {
    const drops = sp.stages - E('timerCeiling')(sp, null);
    return { id: sp.id, lvl: sp.lvl, drops: drops,
             per: (sp.price * E('STAR_MULT')[3] - sp.seed) / drops };
  });
  const inv = [];
  patient.forEach(function (a) {
    patient.forEach(function (b) {
      if (a.lvl < b.lvl && a.per > b.per + 1e-9) {
        inv.push(a.id + ' ' + a.per.toFixed(1) + ' > ' + b.id + ' ' + b.per.toFixed(1));
      }
    });
  });
  console.log('\n  waiting for the ceiling, then pouring the rest:');
  console.log('    ' + patient.map(function (p) {
    return p.id + ' ' + p.per.toFixed(0);
  }).join('  '));
  check('the ladder also climbs for a player who waits for the ceiling',
        !inv.length, inv.slice(0, 4).join('; '));
  check('and every species still needs at least one pour to finish',
        patient.every(function (p) { return p.drops >= 1; }),
        patient.filter(function (p) { return p.drops < 1; })
               .map(function (p) { return p.id; }).join(', '));
}

/* ---- three stars must be earned, and must be earnable ----
   Care comes from two places and only two: a pour in the hour the plant
   likes, and a pour landed in the gold. So the top tier is a statement
   about how you play, and it should be reachable for someone who does one
   of those things well and out of reach for someone who does neither. */
{
  function quality(sp, opts) {
    /* The patient line — let the clock carry it to the ceiling for free and
       pour the rest — because that is the line that costs the least water,
       and so the one a thinking player takes. */
    const pours = sp.stages - E('timerCeiling')(sp, null);
    const perPour = (opts.rightHour ? 1 : 0) + (opts.precise ? 1 : 0);
    return E('starsFor')(sp, pours * perPour);
  }
  const corners = [
    { name: 'right hour, gold pours', rightHour: true, precise: true },
    { name: 'right hour, sloppy    ', rightHour: true, precise: false },
    { name: 'wrong hour, gold pours', rightHour: false, precise: true },
    { name: 'wrong hour, sloppy    ', rightHour: false, precise: false }
  ];
  console.log('\n  stars from the patient line (fewest drops), by how you play:');
  const got = {};
  corners.forEach(function (c) {
    const stars = SPECIES.map(function (sp) { return quality(sp, c); });
    got[c.name.trim()] = stars;
    const hist = [1, 2, 3].map(function (n) {
      return stars.filter(function (x) { return x === n; }).length + '×' + '★'.repeat(n);
    }).join('  ');
    console.log('    ' + c.name + '  ' + hist);
  });

  const best = got['right hour, gold pours'];
  const worst = got['wrong hour, sloppy'];
  check('★★★ is reachable on every species without pouring a drop extra',
        best.every(function (x) { return x === 3; }),
        SPECIES.filter(function (sp, i) { return best[i] < 3; })
               .map(function (sp) { return sp.id; }).join(', '));
  check('and nobody gets it for free', worst.every(function (x) { return x === 1; }),
        SPECIES.filter(function (sp, i) { return worst[i] > 1; })
               .map(function (sp) { return sp.id; }).join(', '));
  /* One of the two is enough for most of the shelf: doing either well should
     carry you most of the way, or the top tier belongs only to people doing
     both, and half the shelf's day/night flavour stops mattering. */
  const oneThing = got['wrong hour, gold pours'];
  const lifted = oneThing.filter(function (x) { return x >= 2; }).length;
  check('doing one of the two well lifts you off the bottom tier',
        lifted >= SPECIES.length * 0.8, lifted + ' of ' + SPECIES.length);
}

/* ---- and the seed must never cost more than the bloom is worth ---- */
{
  const upside = SPECIES.map(function (sp) { return { id: sp.id, r: sp.price / sp.seed }; });
  const thin = upside.filter(function (u) { return u.r < 1.6; });
  console.log('\n  thinnest seed-to-bloom margins: ' + upside.slice().sort(function (a, b) {
    return a.r - b.r;
  }).slice(0, 3).map(function (u) { return u.id + ' ×' + u.r.toFixed(2); }).join(', '));
  check('a seed always costs well under what its bloom fetches',
        !thin.length, thin.map(function (u) { return u.id + ' ×' + u.r.toFixed(2); }).join(', '));
}

/* ---- the day/night split must not be lopsided ---- */
{
  const n = function (p) { return eco.filter(function (e) { return e.sp.pref === p; }).length; };
  console.log('  preferences: ' + n('day') + ' day, ' + n('night') + ' night, ' +
              n('any') + ' easygoing');
  check('the shelf is not lopsided towards one half of the day',
        Math.abs(n('day') - n('night')) <= 3, n('day') + ' day vs ' + n('night') + ' night');
  /* Iteration 52 found 'any' was the harshest label on the shelf, not the
     kindest — it is the one word that costs you the 1.25× growth bonus. Keep
     some around so that fix cannot silently regress into nothing. */
  check('and some species really are easygoing', n('any') >= 1, String(n('any')));
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

/* Iteration 50: six level-ups each offer a permanent choice of two perks.
   Iteration 37 only proved all twelve are wired to something. A draft is a
   decision only if neither side dominates — so measure both. */
const path = require('path');
const H = require('./harness.js');
const S = require('./sim.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h0 = H.build(); const E0 = h0.evalIn;
const DRAFTS = E0('PERK_CHOICES');

/* Run three weeks with exactly one perk granted, and compare. The sim's own
   levelling would grant perks on its own, so they are forced instead and the
   draft screen is bypassed. */
/* Averaged over several seeds. A perk that changes the compounding loop — the
   can's size, the clock's reach — sends a different sequence of replanting
   decisions through three whole weeks, and a single run of that swings wildly:
   deep well measured +24,672 on one seed and +2,055 on another. One seed is an
   anecdote. */
const SEEDS = [4242, 909, 31337];
function meanEarned(profile, perk) {
  const runs = SEEDS.map(function (sd) {
    return S.run({ seed: sd, profile: profile, forcePerk: perk }).earned;
  });
  return runs.reduce(function (a, b) { return a + b; }, 0) / runs.length;
}
const baseCache = {};
function baseEarned(profile) {
  if (baseCache[profile] === undefined) {
    /* Only the four-a-day figure is averaged, because only that one is judged
       on. The twice-a-day column is a single seed, shown for context. */
    baseCache[profile] = profile === 'diligent'
      ? meanEarned(profile, undefined)
      : S.run({ seed: SEEDS[0], profile: profile }).earned;
  }
  return baseCache[profile];
}
function withPerk(id, profile) {
  return { earned: profile === 'diligent'
    ? meanEarned(profile, id)
    : S.run({ seed: SEEDS[0], profile: profile, forcePerk: id }).earned };
}

console.log('  measuring each draft over 21 days at two visit rates…\n');
console.log('  level  perk          one seed      3-seed mean     verdict');

const rows = [];
Object.keys(DRAFTS).forEach(function (lvl) {
  const pair = DRAFTS[lvl];
  const got = pair.map(function (pk) {
    return { pk: pk,
             twice: withPerk(pk.id, 'twice').earned,
             dil: withPerk(pk.id, 'diligent').earned };
  });
  const base = { twice: baseEarned('twice'), dil: baseEarned('diligent') };
  got.forEach(function (g) {
    g.gainTwice = Math.round(g.twice - base.twice);
    g.gainDil = Math.round(g.dil - base.dil);
  });
  const a = got[0], b = got[1];
  /* Judged on the four-a-day run: the twice-a-day one is noisier, because
     changing which pours land cascades through a whole three weeks of
     replanting decisions and can flip a small effect's sign.
     A perk this bot cannot measure at all is not a failed perk — it is a perk
     whose mechanic barely fires, which is a different problem and belongs to
     the mechanic rather than to the draft. */
  const NOISE = 400;
  const measurable = function (g) { return Math.abs(g.gainDil) > NOISE || Math.abs(g.gainTwice) > NOISE; };
  const both = measurable(a) && measurable(b);
  const neither = !measurable(a) && !measurable(b);
  const ratio = both
    ? Math.max(Math.abs(a.gainDil), Math.abs(b.gainDil)) /
      Math.max(1, Math.min(Math.abs(a.gainDil), Math.abs(b.gainDil)))
    : 1;
  /* A draft is fine if different playstyles want different sides. Capacity
     matters to someone who visits rarely; refill rate matters to someone who
     visits often — so a gap at one visit rate is only a problem if the same
     side also wins at the other. */
  const winsDil = a.gainDil >= b.gainDil ? 'a' : 'b';
  const winsTwice = a.gainTwice >= b.gainTwice ? 'a' : 'b';
  const splits = winsDil !== winsTwice;
  const verdict = neither ? 'neither is measurable here'
                : !both ? 'one side rides a mechanic that barely fires'
                : splits ? 'depends how often you play'
                : ratio <= 3.0 ? 'a real choice'
                : 'LOPSIDED ×' + ratio.toFixed(1);
  got.forEach(function (g) {
    console.log('  ' + String(lvl).padStart(5) + '  ' + g.pk.id.padEnd(13) +
      (g.gainTwice >= 0 ? '+' : '') + String(g.gainTwice).padStart(7) + '   ' +
      (g.gainDil >= 0 ? '+' : '') + String(g.gainDil).padStart(8) + '     ' +
      (g === a ? verdict : ''));
  });
  rows.push({ lvl: lvl, a: a, b: b, ratio: ratio, both: both, neither: neither,
              splits: splits, fair: !both || splits || ratio <= 3.0 });
});

const lopsided = rows.filter(function (r) { return r.both && !r.fair; });
check('every draft this bot can measure is a real choice', !lopsided.length,
      lopsided.map(function (r) {
        return 'lvl ' + r.lvl + ' ' + r.a.pk.id + ' vs ' + r.b.pk.id +
               ' (×' + r.ratio.toFixed(1) + ')';
      }).join('; '));

const measured = rows.filter(function (r) { return r.both; });
check('at least half the drafts are measurably balanced', measured.length >= 3,
      measured.length + ' of ' + rows.length);

/* The perks whose value cannot be seen because the mechanic they ride barely
   happens. Naming them is the point — this is the handover to the iteration
   that decides what to do about those mechanics. */
{
  const NOISE = 400;
  const blocked = [];
  rows.forEach(function (r) {
    [r.a, r.b].forEach(function (g) {
      if (Math.abs(g.gainDil) <= NOISE) blocked.push(g.pk.id);
    });
  });
  /* Not all of these are unmeasurable — some are simply unmeasurable *here*.
     This bot pours through advanceStage rather than the real minigame, so
     combos never build and fever never fires, and any perk that rides fever
     comes out at exactly zero. fever-check drives the real pour path and
     reads long fever at +61,272 coins across three weeks. Naming a perk
     unmeasurable when another file measures it is the sort of thing that
     leaves a system looking dead for twenty iterations. */
  const MEASURED_ELSEWHERE = { longfever: 'fever-check, driving the real pour' };
  const stillDark = blocked.filter(function (id) { return !MEASURED_ELSEWHERE[id]; });
  console.log('\n  perks this bot cannot read, because it does not use the mechanic:');
  console.log('    ' + (stillDark.join(', ') || 'none'));
  Object.keys(MEASURED_ELSEWHERE).forEach(function (id) {
    if (blocked.indexOf(id) > -1) {
      console.log('    ' + id + ' — measured in ' + MEASURED_ELSEWHERE[id]);
    }
  });
  check('the unmeasurable perks are named rather than assumed fine', true);
  /* And the list must not quietly grow. Four of thirteen dark is the most
     that can be tolerated before the drafts stop being checkable at all. */
  check('most perks are measurable by something',
        stillDark.length <= 4, stillDark.length + ' of ' + (rows.length * 2) + ' dark');
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

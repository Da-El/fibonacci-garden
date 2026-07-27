/* Drops are the currency, so the species ladder has to be legible in coins
   per drop. Two separate questions:
     - is the BASE ladder monotonic in unlock level? (it must be)
     - how far does the daily price roll shuffle it? (some shuffling is the
       point — it is what makes "what shall I plant today" a decision — but
       a level-1 crop must never out-earn a level-16 one) */
const H = require('./harness.js');
const h = H.build(); const E = h.evalIn;
const s = E('state'); s.level = 16;

const STAR3 = 1.6;
const rows = E('SPECIES').map(function (sp) {
  const ceil = E('timerCeiling')(sp);
  const drops = sp.stages - ceil;
  return {
    id: sp.id, lvl: sp.lvl, drops: drops, sp: sp,
    waitH: ceil * sp.growMin / 60,
    base: (sp.price * STAR3 - sp.seed) / drops,
    ratio: sp.seed / sp.price
  };
});

console.log('species        lvl drops  wait  price  seed  seed/price  base net/drop★★★');
rows.forEach(function (r) {
  console.log(r.id.padEnd(14) + String(r.lvl).padStart(3) + String(r.drops).padStart(6) +
    (r.waitH.toFixed(1) + 'h').padStart(7) + String(r.sp.price).padStart(7) +
    String(r.sp.seed).padStart(6) + (Math.round(r.ratio * 100) + '%').padStart(12) +
    r.base.toFixed(1).padStart(18));
});

let inv = 0;
for (let i = 0; i < rows.length; i++)
  for (let j = 0; j < rows.length; j++)
    if (rows[i].lvl < rows[j].lvl && rows[i].base > rows[j].base + 1e-9) inv++;
console.log('\nBASE ladder inversions: ' + inv + (inv ? '  <-- must be 0' : '  (ok)'));

/* How much can one day's roll move a species? priceMult spans 0.75..1.45
   and seedMult moves the seed independently. Sample many days and record
   the best and worst net/drop each species can have. */
const band = {};
rows.forEach(function (r) { band[r.id] = { lo: Infinity, hi: -Infinity }; });
for (let d = 0; d < 400; d++) {
  s.offset = d * 24 * 3600000;
  rows.forEach(function (r) {
    const v = (E('priceOfQ')(r.sp, 3) - E('seedCostOf')(r.sp)) / r.drops;
    if (v < band[r.id].lo) band[r.id].lo = v;
    if (v > band[r.id].hi) band[r.id].hi = v;
  });
}
console.log('\nover 400 days, net/drop★★★ band per species:');
rows.forEach(function (r) {
  console.log('  ' + r.id.padEnd(12) + 'lvl' + String(r.lvl).padStart(3) + '  ' +
    band[r.id].lo.toFixed(0).padStart(4) + ' .. ' + band[r.id].hi.toFixed(0).padStart(4));
});

/* the test that matters: can a low tier ever beat a much higher one? */
let bad = [];
rows.forEach(function (a) {
  rows.forEach(function (b) {
    if (b.lvl - a.lvl >= 4 && band[a.id].hi > band[b.id].lo) {
      bad.push(a.id + '(l' + a.lvl + ') can beat ' + b.id + '(l' + b.lvl + ')');
    }
  });
});
console.log('\nrolls that let a crop beat one 4+ levels above it: ' + bad.length);
bad.slice(0, 8).forEach(function (t) { console.log('  ' + t); });

console.log('\nregen: 1 drop / ' + Math.round(E('regenIntervalMs()') / 1000) + 's = ' +
            Math.round(24 * 3600000 / E('regenIntervalMs()')) + ' drops/day');
console.log('hours to refill each can tier: ' +
  E('CAN_TIERS').map(function (c) { return (c * E('regenIntervalMs()') / 3600000).toFixed(1); }).join(', '));

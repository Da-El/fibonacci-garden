/* Iteration 36: the long game. The prestige curve was set against an economy
   2.5x richer than the current one, so the first question is simply when
   each playstyle can claim its first golden seed, and whether the curve then
   stays interesting or runs away. */
const H = require('./harness.js');
const S = require('./sim.js');

const h = H.build(); const E = h.evalIn;

console.log('=== the golden-seed curve ===');
let cum = 0;
for (let n = 0; n < 12; n++) {
  const c = E('goldenSeedCost')(n);
  cum += c;
  console.log('  seed ' + String(n + 1).padStart(2) + '  costs ' + String(c).padStart(9) +
              '  cumulative ' + String(cum).padStart(10) +
              '  all prices then +' + ((Math.pow(1.0618, n + 1) - 1) * 100).toFixed(0) + '%');
}

console.log('\n=== when can each playstyle first replant? ===');
['casual', 'twice', 'diligent'].forEach(function (profile) {
  const r = S.run({ apprentice: false, seed: 4242, profile: profile });
  const first = E('goldenSeedCost')(0);
  let dayHit = null, seedsAt21 = 0;
  r.days.forEach(function (row) {
    if (dayHit === null && row.earned >= first) dayHit = row.d;
  });
  // how many seeds would 21 days of earnings buy?
  let spent = 0, claim = 0;
  while (claim < 99) {
    const c = E('goldenSeedCost')(claim);
    if (r.earned - spent < c) break;
    spent += c; claim++;
  }
  seedsAt21 = claim;
  console.log('  ' + profile.padEnd(9) + ' earned ' + String(r.earned).padStart(7) +
              '  first seed on ' + (dayHit ? 'day ' + dayHit : 'never') +
              '  seeds after 21 days: ' + seedsAt21);
});

console.log('\n=== where does late money go? ===');
const tree = E('PLOT_COSTS').reduce(function (a, b) { return a + b; }, 0) +
             E('CAN_COSTS').reduce(function (a, b) { return a + b; }, 0) +
             [0, 1, 2].reduce(function (a, i) {
               return a + Math.round(E('GLASS_COST') * Math.pow(E('GLASS_STEP'), i));
             }, 0) +
             E('APPRENTICE_HIRE') + E('APP_UPGRADE')[1];
console.log('  the whole upgrade tree: ' + tree);
console.log('  the first three golden seeds: ' +
            [0, 1, 2].reduce(function (a, i) { return a + E('goldenSeedCost')(i); }, 0));
console.log('  PRESTIGE_UNIT ' + E('PRESTIGE_UNIT') + ', each seed costs 45% more than the last');

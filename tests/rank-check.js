/* Is each promotion worth paying for? Lock her at each rank and compare. */
const S = require('./sim.js');

['casual', 'twice', 'diligent'].forEach(function (profile) {
  const base = S.run({ apprentice: false, seed: 4242, profile: profile });
  console.log('=== ' + profile + ' (no apprentice: ' + base.earned + ') ===');
  let prevNet = 0;
  [1, 2].forEach(function (rank) {
    const r = S.run({ apprentice: true, capRank: rank, seed: 4242, profile: profile });
    const gross = r.earned - base.earned;
    const net = gross - r.wagesPaid;
    console.log('  rank ' + rank + ' (' + (r.appLevel === rank ? 'ok' : 'REACHED ' + r.appLevel) + ')' +
      '  gross +' + String(gross).padStart(6) +
      '  wages -' + String(r.wagesPaid).padStart(6) +
      '  net ' + (net >= 0 ? '+' : '') + String(net).padStart(6) +
      '  Δnet vs rank' + (rank - 1) + ' ' + (net - prevNet >= 0 ? '+' : '') + (net - prevNet));
    prevNet = net;
  });
});

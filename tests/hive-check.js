/* Does the beehive earn its 650 coins? Measured through the full playing
   simulation, which buys plots and keeps a real garden going. */
const S = require('./sim.js');
['casual', 'twice', 'diligent'].forEach(function (profile) {
  const off = S.run({ seed: 4242, profile: profile });
  const on = S.run({ seed: 4242, profile: profile, hive: true });
  const gain = on.earned - off.earned;
  console.log(profile.padEnd(9) +
    ' without ' + String(off.earned).padStart(7) +
    '  with ' + String(on.earned).padStart(7) +
    '  gain ' + (gain >= 0 ? '+' : '') + String(gain).padStart(6) +
    '  ' + (gain > 1500 ? 'earns its keep' : 'DOES NOT earn its keep'));
});

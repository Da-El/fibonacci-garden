/* Does the upgrade tree span the three weeks, or is it over in a day?
   Reports the day each profile reaches each milestone. */
const S = require('./sim.js');

['casual', 'twice', 'diligent'].forEach(function (profile) {
  const r = S.run({ apprentice: false, seed: 4242, profile: profile });
  const first = function (pred) {
    for (let i = 0; i < r.days.length; i++) if (pred(r.days[i])) return r.days[i].d;
    return null;
  };
  const fmt = function (d) { return d === null ? ' never' : ('d' + d).padStart(6); };
  console.log(profile.padEnd(9) +
    ' earned ' + String(r.earned).padStart(7) +
    '  6 plots ' + fmt(first(function (x) { return x.plots >= 6; })) +
    '  9 plots ' + fmt(first(function (x) { return x.plots >= 9; })) +
    '  lvl 8 ' + fmt(first(function (x) { return x.lvl >= 8; })) +
    '  lvl 12 ' + fmt(first(function (x) { return x.lvl >= 12; })) +
    '  final lvl ' + r.level + ' can-tier ' + r.canTier);
});

/* Iteration 45: persistence is where a bug costs someone their garden, and it
   has only ever been checked for field presence. Test the failure modes: old
   schemas, corrupt data, a failing localStorage, and whether the export code
   really round-trips everything added since iteration 12. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const KEY = 'fibgarden.v2';
const boot = function (saved) {
  return H.build({ preload: { 'fibgarden.v2': typeof saved === 'string' ? saved : JSON.stringify(saved) } });
};

/* ---- 1. a save from an older schema must load, and keep its garden ---- */
{
  const shapes = {
    'a first-week save': { coins: 40, water: 6, plotCount: 3, level: 2, xp: 4,
      plots: [{ s: 'elm', stage: 1, q: 1, stageAt: Date.now() }, null, null],
      barn: {}, almanac: {} },
    'pre-apprentice (iter 26)': { coins: 900, water: 20, plotCount: 6, canTier: 2, level: 8,
      plots: new Array(6).fill(null), barn: { elm: { 2: 4 } },
      almanac: { elm: 3 }, trellised: [true, false, false, false, false, false],
      harvested: 40, earned: 3000, golden: 1, prestiges: 1 },
    'pre-glass (iter 31)': { coins: 5000, water: 30, plotCount: 9, canTier: 3, level: 11,
      plots: new Array(9).fill(null), barn: {}, almanac: { sunflower: 3 },
      trellised: new Array(9).fill(false), appLevel: 2, appSlot: 12, appPaidDay: 3,
      harvested: 200, earned: 40000, hive: true, hiveLevel: 2 }
  };
  Object.keys(shapes).forEach(function (name) {
    let g = null, threw = null;
    try { g = boot(shapes[name]); } catch (e) { threw = e; }
    if (threw) { check('loads ' + name, false, threw.message); return; }
    const st = g.evalIn('state');
    const want = shapes[name];
    /* Coins may go UP on load — an old save can qualify for achievements it
       never claimed, and checkAch pays them on the way in. What must never
       happen is losing anything. So assert the floor, and account for any
       rise so it cannot hide a real gain from somewhere else. */
    const owed = g.evalIn('ACHIEVEMENTS')
      .filter(function (a) { return st.ach[a.id]; })
      .reduce(function (t, a) { return t + (a.coins || 0); }, 0);
    check('loads ' + name + ' without losing anything',
          st.coins >= want.coins && st.level === want.level && st.plotCount === want.plotCount,
          'coins ' + st.coins + '/' + want.coins + ' level ' + st.level + '/' + want.level +
          ' plots ' + st.plotCount + '/' + want.plotCount);
    check('  ' + name + ': any coins gained are accounted for',
          st.coins - want.coins <= owed,
          'gained ' + (st.coins - want.coins) + ', achievements explain ' + owed);
    // and every field added since must be present and sane
    const added = ['glassed', 'lastSown', 'stalledFinished', 'driedReady', 'glassPristine'];
    const missing = added.filter(function (f) { return st[f] === undefined; });
    check('  ' + name + ' gains the fields added since', !missing.length, missing.join(','));
  });
}

/* ---- 2. corrupt data must be refused, never half-loaded ---- */
{
  const bad = {
    'truncated json': '{"coins":500,"plots":[nul',
    'not json at all': 'hello world',
    'an empty string': '',
    'a json array': '[1,2,3]',
    'the literal null': 'null',
    'plots not an array': '{"coins":5,"plots":"three"}',
    'negative coins': '{"coins":-9999,"plots":[null,null,null]}'
  };
  Object.keys(bad).forEach(function (name) {
    let g = null, threw = null;
    try { g = boot(bad[name]); } catch (e) { threw = e; }
    if (threw) { check('survives ' + name, false, threw.message); return; }
    const st = g.evalIn('state');
    const sane = Array.isArray(st.plots) && typeof st.coins === 'number' &&
                 st.coins >= 0 && st.plotCount >= 3;
    check('survives ' + name + ' with a sane garden', sane,
          'coins=' + st.coins + ' plots=' + (Array.isArray(st.plots) ? st.plots.length : typeof st.plots));
  });
}

/* ---- 3. a save must never be left in a dead state ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.coins = 0; s.plots = [null, null, null]; s.barn = {};
  E('ensureSolvent()');
  check('a garden with nothing left is rescued',
        s.coins > 0 || s.plots.some(Boolean) || E('barnCountAll()') > 0,
        'coins=' + s.coins + ' plots=' + s.plots.filter(Boolean).length);

  const spends = ['buyPlot()', 'buyCan()', 'buyGlass()', 'hireApprentice()', 'buyHive()'];
  const dead = [];
  spends.forEach(function (call) {
    const g = H.build(); const G = g.evalIn; const st = G('state');
    st.level = 16; st.coins = 999999; G('curPlot = 0');
    try { G(call); } catch (e) {}
    // now strip them to nothing and see whether the game puts them back on their feet
    st.coins = 0; st.plots = st.plots.map(function () { return null; }); st.barn = {};
    G('ensureSolvent()');
    if (!(st.coins > 0 || st.plots.some(Boolean) || G('barnCountAll()') > 0)) dead.push(call);
  });
  check('no purchase can leave an unrecoverable save', !dead.length, dead.join(', '));
}

/* ---- 4. the export code must carry everything added since iteration 12 ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 4242; s.level = 13; s.plotCount = 7;
  while (s.plots.length < 7) s.plots.push(null);
  while (s.trellised.length < 7) s.trellised.push(false);
  while (s.glassed.length < 7) s.glassed.push(false);
  s.glassed[2] = true; s.trellised[1] = true;
  s.lastSown = { 0: 'elm', 2: 'fern' };
  s.appLevel = 2; s.appPaidDay = 99;
  s.stalledFinished = 17; s.driedReady = 3; s.glassPristine = 2; s.driedDay = 55;
  s.hive = true; s.hiveLevel = 2; s.golden = 4; s.prestiges = 2;
  s.almanac = { elm: 3, fern: 2 }; s.barn = { fern: { 3: 2, p: 1 } };
  s.plots[0] = { s: 'elm', stage: 2, q: 3, stageAt: E('NOW()'), perfects: 2, spills: 0,
                 hired: false, glass: 0 };

  const code = E('exportSave()');
  check('an export code is produced', typeof code === 'string' && code.length > 40);
  check('it is labelled so a stray paste is recognised', code.indexOf('FIBGDN1') === 0);

  const res = E('importSave')(code);
  check('the code reads back', res && res.ok === true, res && res.why);

  if (res && res.ok) {
    const st = res.data.s;
    const fields = ['coins', 'level', 'plotCount', 'appLevel', 'appPaidDay',
                    'stalledFinished', 'driedReady', 'glassPristine', 'driedDay',
                    'hiveLevel', 'golden', 'prestiges'];
    const lost = fields.filter(function (f) { return st[f] !== s[f]; });
    check('every scalar field survives the round trip', !lost.length,
          lost.map(function (f) { return f + ' ' + s[f] + '->' + st[f]; }).join(', '));
    check('glassed beds survive', JSON.stringify(st.glassed) === JSON.stringify(s.glassed));
    check('lastSown survives', JSON.stringify(st.lastSown) === JSON.stringify(s.lastSown));
    check('the barn survives', JSON.stringify(st.barn) === JSON.stringify(s.barn));
    check('a growing plant survives, glass flag and all',
          st.plots[0] && st.plots[0].s === 'elm' && st.plots[0].stage === 2 &&
          st.plots[0].glass === 0, JSON.stringify(st.plots[0]));
  }
}

/* ---- 5. a damaged code must be refused rather than half-applied ---- */
{
  const h = H.build(); const E = h.evalIn;
  const code = E('exportSave()');
  const cases = {
    'truncated': code.slice(0, Math.floor(code.length * 0.7)),
    'wrong prefix': 'NOTAGARDEN' + code.slice(7),
    'checksum tampered': code.replace(/\.([A-Z0-9]+)\./, '.ZZZZ.'),
    'body tampered': code.slice(0, -12) + 'AAAAAAAAAAAA',
    'empty': '',
    'random text': 'have a nice day'
  };
  const accepted = [];
  Object.keys(cases).forEach(function (name) {
    let r;
    try { r = E('importSave')(cases[name]); } catch (e) { r = { ok: false, why: 'threw' }; }
    if (r && r.ok) accepted.push(name);
  });
  check('every damaged code is refused', !accepted.length, accepted.join(', '));
  // and the refusal must say something a person can act on
  const r = E('importSave')(cases.truncated);
  check('a refusal explains itself', !!(r && r.why && r.why.length > 10), r && r.why);
}

/* ---- 6. localStorage failing must not crash or lose the garden ---- */
{
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.coins = 777;
  E('localStorage.setItem = function () { throw new Error("QuotaExceededError"); }');
  let threw = null;
  try { E('saveState()'); } catch (e) { threw = e; }
  check('a full localStorage does not crash the game', !threw, threw && threw.message);
  check('and the garden is still there in memory', E('state').coins === 777);

  // reading a missing store must also be survivable
  const g = H.build(); const G = g.evalIn;
  G('localStorage.getItem = function () { throw new Error("SecurityError"); }');
  let threw2 = null;
  try { G('loadState()'); } catch (e) { threw2 = e; }
  check('a blocked localStorage does not crash the game', !threw2, threw2 && threw2.message);
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

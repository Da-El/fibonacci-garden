/* Iteration 91: every hybrid, bred and then actually grown.

   breed-check verifies the mediant, the price cap and that every rung of the
   phyllotactic ladder is reachable. It has never planted one. A hybrid is the
   only species the game invents at runtime — its form, hue, petal count, disc
   and fraction are all assembled from two parents at the moment you cross
   them — so it is the species most likely to be missing a field the renderer,
   the market, the almanac or the save assumes is there.

   Every wild pair is crossed below, and then a sample of them is put in the
   ground and grown through the real pour. */
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn;
const BASE = E('BASE_SPECIES').map(function (s) { return s.id; });

/* A gardener who has grown everything, so every pair is breeding stock. */
function breeder() {
  const g = H.build(); const G = g.evalIn; const s = G('state');
  s.offset = 0; s.coins = 9999999; s.level = 18;
  G('BASE_SPECIES').forEach(function (sp) { s.almanac[sp.id] = 3; });
  return { g: g, G: G, s: s };
}

/* ---- every wild pair crosses, and the child is a whole species ---- */
const REQUIRED = ['id', 'name', 'form', 'stages', 'seed', 'price', 'growMin',
                  'lvl', 'leafHue', 'pref', 'fact'];
let bredCount = 0;
{
  const b = breeder();
  const broken = [], nameless = [], dupes = {}, sameName = [];
  const forms = {};
  for (let i = 0; i < BASE.length; i++) {
    for (let j = i + 1; j < BASE.length; j++) {
      const sp = b.G('makeHybrid')(BASE[i], BASE[j]);
      if (!sp) { broken.push(BASE[i] + '×' + BASE[j] + ': nothing'); continue; }
      bredCount++;
      forms[sp.form] = (forms[sp.form] | 0) + 1;
      REQUIRED.forEach(function (f) {
        const v = sp[f];
        if (v === undefined || v === null ||
            (typeof v === 'number' && !isFinite(v))) {
          if (broken.length < 5) broken.push(sp.id + ' has no ' + f);
        }
      });
      if (!sp.name || /undefined|NaN/.test(sp.name)) nameless.push(sp.id + ': ' + sp.name);
      if (dupes[sp.id]) sameName.push(sp.id);
      dupes[sp.id] = true;
    }
  }
  console.log('  ' + bredCount + ' crosses from ' + BASE.length + ' wild species');
  console.log('  forms produced: ' + Object.keys(forms).map(function (f) {
    return f + ' ' + forms[f];
  }).join(', '));
  check('every wild pair produces a species', !broken.length, broken.join('; '));
  check('and every one of them has a name a person could read',
        !nameless.length, nameless.slice(0, 3).join(', '));
  check('and no two crosses collide on the same id', !sameName.length,
        sameName.slice(0, 3).join(', '));
  check('and the crosses cover more than one growth form',
        Object.keys(forms).length > 1, Object.keys(forms).join(', '));
}

/* ---- the mediant, and what happens when a golden parent is involved ---- */
{
  const b = breeder();
  const golden = [], rungs = [];
  BASE.forEach(function (a) {
    BASE.forEach(function (c) {
      if (a >= c) return;
      const sp = b.G('makeHybrid')(a, c);
      if (!sp) return;
      const fa = b.G('fracOf')(b.G('byId')[a]), fc = b.G('fracOf')(b.G('byId')[c]);
      if (fa && fc) {
        const m = b.G('reduceFrac')(b.G('mediant')(fa, fc));
        if (sp.frac[0] !== m[0] || sp.frac[1] !== m[1]) {
          rungs.push(a + '×' + c + ': ' + sp.frac + ' not ' + m);
        }
      } else if (sp.frac !== null) {
        golden.push(a + '×' + c + ' kept ' + sp.frac + ' from a golden parent');
      }
    });
  });
  check('a cross of two fractions is exactly their mediant', !rungs.length,
        rungs.slice(0, 3).join('; '));
  check('and crossing into a golden-angle parent stays golden',
        !golden.length, golden.slice(0, 3).join('; '));
}

/* ---- and every one of them can actually be grown ----
   Through plant → pour → harvest, on the real functions. A field the
   renderer needs and the hybrid lacks shows up here and nowhere else. */
function growOne(B, id) {
  const s = B.G('state');
  s.water = 400; s.coins = 999999;
  for (let i = 0; i < s.plotCount; i++) s.plots[i] = null;
  B.G('plant(0,"' + id + '")');
  if (!s.plots[0]) return { failed: 'would not plant' };
  B.G('curPlot = 0');
  const sp = B.G('byId')[id];
  let drew = '', pours = 0, threw = '';
  try {
    /* Every stage drawn, because a hybrid's form is assembled and an early
       stage can be fine while a late one is missing a petal count. */
    for (let st = 0; st <= sp.stages; st++) {
      drew = B.G('plantSVG')(sp, B.G('elementsAt')(sp, st));
      if (!drew || drew.indexOf('NaN') > -1 || drew.indexOf('undefined') > -1) {
        return { failed: 'stage ' + st + ' drew NaN or undefined' };
      }
    }
    while (s.plots[0] && s.plots[0].stage < sp.stages && pours < 40) {
      B.G('startPour()');
      const pr = B.G('pour');
      if (!pr) break;
      pr.t0 = B.G('performance.now()') - pr.center * pr.period;
      B.G('lockPour()');
      pours++;
    }
    const held = B.G('barnCountAll()');
    B.G('harvest()');
    return { pours: pours, banked: B.G('barnCountAll()') > held,
             almanac: s.almanac[id] | 0, svg: drew.length,
             tiers: Object.keys(s.barn[id] || {}) };
  } catch (e) { threw = e.message; }
  return { failed: threw };
}

{
  const b = breeder();
  /* A spread rather than all 105: one from each growth form the crosses can
     produce, plus a second-generation cross of two hybrids. */
  const picks = [];
  const seenForm = {};
  for (let i = 0; i < BASE.length && picks.length < 8; i++) {
    for (let j = i + 1; j < BASE.length && picks.length < 8; j++) {
      const sp = b.G('makeHybrid')(BASE[i], BASE[j]);
      if (!sp || seenForm[sp.form + sp.stages]) continue;
      seenForm[sp.form + sp.stages] = true;
      picks.push([BASE[i], BASE[j]]);
    }
  }
  console.log('\n  growing one cross of each form and length:');
  console.log('    cross                       form      drops   banked as   svg');
  const failed = [], notBanked = [], noAlmanac = [];
  picks.forEach(function (p) {
    b.G('doBreed')(p[0], p[1]);
    const id = b.G('hybridId')(p[0], p[1]);
    const sp = b.G('byId')[id];
    if (!sp) return failed.push(p.join('×') + ': never registered');
    const r = growOne(b, id);
    if (r.failed) return failed.push(sp.name + ': ' + r.failed);
    console.log('    ' + sp.name.padEnd(20) + sp.form.padEnd(12) +
      String(r.pours).padStart(5) + '   ' + r.tiers.join(',').padEnd(10) +
      String(r.svg).padStart(7));
    if (!r.banked) notBanked.push(sp.name);
    if (!r.almanac) noAlmanac.push(sp.name);
  });
  check('every hybrid can be planted, drawn at every stage, poured and lifted',
        !failed.length, failed.slice(0, 3).join('; '));
  check('and lands in the barn', !notBanked.length, notBanked.join(', '));
  check('and is recorded in the almanac', !noAlmanac.length, noAlmanac.join(', '));
}

/* ---- a cross of two hybrids, which is where the damping lives ---- */
{
  const b = breeder();
  b.G('doBreed')('elm', 'daisy');
  b.G('doBreed')('sedum', 'beech');
  const a = b.G('hybridId')('elm', 'daisy'), c = b.G('hybridId')('sedum', 'beech');
  b.s.almanac[a] = 3; b.s.almanac[c] = 3;
  b.G('doBreed')(a, c);
  const gen2 = b.G('byId')[b.G('hybridId')(a, c)];
  console.log('\n  a second-generation cross: ' + (gen2 ? gen2.name : 'none') +
    (gen2 ? ' · gen ' + gen2.gen + ' · ' + gen2.price + '🪙' : ''));
  check('two hybrids can be crossed again', !!gen2);
  check('and the child knows it is a later generation',
        gen2 && gen2.gen >= 2, gen2 ? String(gen2.gen) : '-');
  /* The damping is what stops breeding being a money printer: the vigour
     bonus shrinks as 1 + 0.55/gen and the price is capped outright. */
  check('and its price is still under the cap',
        gen2 && gen2.price <= E('HYBRID_PRICE_CAP'),
        gen2 ? gen2.price + ' against ' + E('HYBRID_PRICE_CAP') : '-');
  const g1 = b.G('byId')[a];
  check('and the vigour bonus shrinks with each generation',
        gen2 && gen2.price <= Math.max(g1.price, b.G('byId')[c].price) * 1.3,
        gen2 ? gen2.price + ' from ' + g1.price + ' and ' + b.G('byId')[c].price : '-');
  const r = growOne(b, gen2.id);
  check('and a second-generation cross grows like any other',
        !r.failed && r.banked, r.failed || 'banked');
}

/* ---- a hybrid must survive being written down and read back ---- */
{
  const b = breeder();
  b.G('doBreed')('sunflower', 'pineapple');
  const id = b.G('hybridId')('sunflower', 'pineapple');
  const made = b.G('byId')[id];
  b.G('plant(0,"' + id + '")');
  b.G('saveState()');
  const raw = b.g.store['fibgarden.v2'];
  console.log('\n  a garden holding a hybrid saves to ' + raw.length + ' bytes');

  /* Reload it into a fresh game, which is the path that actually matters:
     a hybrid is not stored, it is rebuilt at boot from the parents recorded
     against it. The save goes back through localStorage, not through a
     constructor argument — the harness preloads the store and the game reads
     it the way it always does. */
  const fresh = H.build({ preload: { 'fibgarden.v2': raw } });
  const F = fresh.evalIn;
  const back = F('byId')[id];
  check('a hybrid is rebuilt from its parents on load', !!back, id);
  check('and comes back identical', back && back.name === made.name &&
        back.price === made.price && back.stages === made.stages,
        back ? back.name + ' ' + back.price + '/' + made.price : 'missing');
  check('and the bed still holds it', !!F('state').plots[0] &&
        F('state').plots[0].s === id,
        F('state').plots[0] ? F('state').plots[0].s : 'empty');
  check('and it can still be drawn after the round trip',
        back && F('plantSVG')(back, F('totalFor')(back)).indexOf('NaN') < 0);
}

/* ---- and it must price into the shelf rather than beside it ----
   The seed cost was a flat 38% of the price under a comment claiming the
   margin stayed in line with wild species. The shelf tightens from 21% at
   the bottom to 54% at the top, and that tightening is the whole reason the
   coins-per-drop ladder does not run away — so a top-tier price on a
   mid-shelf seed made romanesco × pineapple pay 64.4 a drop against the best
   wild plant's 41.7. Breeding was simply a better crop than anything for
   sale. A cross is seeded to sit level with its dearer parent now. */
{
  const b = breeder();
  const per = function (sp) {
    return (sp.price * E('STAR_MULT')[3] - sp.seed) / sp.stages;
  };
  const rows = [];
  for (let i = 0; i < BASE.length; i++) {
    for (let j = i + 1; j < BASE.length; j++) {
      const sp = b.G('makeHybrid')(BASE[i], BASE[j]);
      if (!sp) continue;
      rows.push({ id: sp.id, cross: BASE[i] + '×' + BASE[j],
                  per: per(sp), price: sp.price, seed: sp.seed,
                  parent: Math.max(per(b.G('byId')[BASE[i]]),
                                   per(b.G('byId')[BASE[j]])) });
    }
  }
  const best = E('SPECIES').filter(function (s) { return !s.hybrid; })
                           .reduce(function (m, s) { return Math.max(m, per(s)); }, 0);
  const hi = Math.max.apply(null, rows.map(function (r) { return r.per; }));
  const lo = Math.min.apply(null, rows.map(function (r) { return r.per; }));
  console.log('\n  hybrid coins-per-drop runs ' + lo.toFixed(1) + ' to ' + hi.toFixed(1) +
    ', against a best wild plant at ' + best.toFixed(1));
  check('no cross ever out-earns the best wild plant per drop',
        hi <= best + 0.1, hi.toFixed(1) + ' against ' + best.toFixed(1));
  /* The rule underneath that, which is the one that generalises: a cross is
     never a better rate than the better of the two plants it came from. */
  const over = rows.filter(function (r) { return r.per > r.parent + 0.1; });
  console.log('  crosses that beat their own dearer parent: ' + over.length +
    ' of ' + rows.length);
  check('and never beats the dearer of its own parents', !over.length,
        over.slice(0, 3).map(function (r) {
          return r.cross + ' ' + r.per.toFixed(1) + ' vs ' + r.parent.toFixed(1);
        }).join(', '));
  check('and none of them is worthless either', lo > best * 0.05,
        lo.toFixed(1) + ' against ' + best.toFixed(1));
  check('and every cross is capped in price',
        rows.every(function (r) { return r.price <= E('HYBRID_PRICE_CAP'); }),
        String(Math.max.apply(null, rows.map(function (r) { return r.price; }))));
  /* And a cross must still be worth sowing: a seed that costs more than the
     bloom sells for at ★ is a plant nobody can afford to get wrong. */
  const upside = rows.filter(function (r) { return r.seed >= r.price; });
  check('and a ★ bloom always covers its own seed', !upside.length,
        upside.slice(0, 3).map(function (r) {
          return r.cross + ' seed ' + r.seed + ' price ' + r.price;
        }).join(', '));
  /* The vigour bonus has to still be visible, or the fix removed the point
     of breeding: the ticket price is what a customer order pays against. */
  const dearer = rows.filter(function (r) {
    const p = r.cross.split('×');
    return r.price > Math.max(b.G('byId')[p[0]].price, b.G('byId')[p[1]].price);
  });
  console.log('  crosses dearer than either parent: ' + dearer.length + ' of ' + rows.length);
  check('but a cross is still often dearer than either parent, which is the point',
        dearer.length > rows.length / 3,
        dearer.length + ' of ' + rows.length);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

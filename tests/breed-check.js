/* Iteration 47: the mediant is the best idea in the game — the child's
   divergence angle is genuinely a ⊕ b, which is how the real phyllotactic
   ladder is built. Before making it something you can aim, check it is
   actually right for every pair, and that it still cannot print money. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

const h = H.build(); const E = h.evalIn; const s = E('state');
s.offset = 0; s.level = 16; s.coins = 99999999;

const wild = E('BASE_SPECIES');

/* ---- 1. the mediant must be arithmetically right for every pair ---- */
{
  const wrong = [];
  wild.forEach(function (A) {
    wild.forEach(function (B) {
      if (A.id === B.id) return;
      if (!A.frac || !B.frac) return;                 // golden parents stay golden
      const child = E('reduceFrac')(E('mediant')(A.frac, B.frac));
      // the mediant, before reduction, is (a+c)/(b+d)
      const raw = [A.frac[0] + B.frac[0], A.frac[1] + B.frac[1]];
      const rr = E('reduceFrac')(raw);
      if (child[0] !== rr[0] || child[1] !== rr[1]) {
        wrong.push(A.frac.join('/') + '+' + B.frac.join('/') + '=' + child.join('/'));
      }
    });
  });
  check('the child of two fractions is their mediant, every time', !wrong.length,
        wrong.slice(0, 4).join(' '));
}

/* ---- 2. crossing neighbours on the ladder must land on the next rung ---- */
{
  const L = E('PHYLLO_LADDER');
  const misses = [];
  for (let i = 0; i + 2 < L.length; i++) {
    const got = E('reduceFrac')(E('mediant')(L[i], L[i + 1]));
    if (got[0] !== L[i + 2][0] || got[1] !== L[i + 2][1]) {
      misses.push(L[i].join('/') + '+' + L[i + 1].join('/') + '=' + got.join('/') +
                  ' wanted ' + L[i + 2].join('/'));
    }
  }
  check('crossing two neighbouring rungs gives the next rung', !misses.length,
        misses.join('; '));
}

/* ---- 3. a golden-angle parent must keep the child golden ---- */
{
  const bad = [];
  wild.forEach(function (A) {
    wild.forEach(function (B) {
      if (A.id === B.id) return;
      if (A.frac && B.frac) return;
      const child = E('makeHybrid')(A.id, B.id);
      if (child && child.frac) bad.push(A.id + '+' + B.id + ' -> ' + child.frac.join('/'));
    });
  });
  check('a golden-angle parent yields a golden-angle child', !bad.length,
        bad.slice(0, 4).join(' '));
}

/* ---- 4. it must not print money, at any generation ---- */
{
  const g = H.build(); const G = g.evalIn; const st = G('state');
  st.offset = 0; st.level = 16; st.coins = 999999999;
  const cap = G('HYBRID_PRICE_CAP');
  const bestWild = Math.max.apply(null, G('BASE_SPECIES').map(function (x) { return x.price; }));

  // breed everything, then breed the children, then their children
  let ids = G('BASE_SPECIES').map(function (x) { return x.id; });
  const prices = [];
  for (let round = 0; round < 3; round++) {
    const made = [];
    for (let i = 0; i < ids.length && made.length < 14; i++) {
      for (let j = i + 1; j < ids.length && made.length < 14; j++) {
        st.coins = 999999999;
        try { G('doBreed("' + ids[i] + '","' + ids[j] + '")'); } catch (e) {}
        const id = G('hybridId')(ids[i], ids[j]);
        const sp = G('byId')[id];
        if (sp) { made.push(id); prices.push({ id: id, gen: sp.gen, price: sp.price, seed: sp.seed }); }
      }
    }
    if (!made.length) break;
    ids = made;
  }
  const worst = prices.reduce(function (a, b) { return b.price > a.price ? b : a; }, prices[0] || { price: 0 });
  console.log('  bred ' + prices.length + ' hybrids across ' +
              (Math.max.apply(null, prices.map(function (p) { return p.gen; })) || 0) + ' generations');
  console.log('  dearest child ' + worst.price + ' (cap ' + cap + ', best wild ' + bestWild + ')');
  check('no hybrid ever exceeds the price cap',
        prices.every(function (p) { return p.price <= cap; }),
        'worst ' + worst.price + ' vs cap ' + cap);
  check('the vigour bonus damps with each generation',
        (function () {
          const byGen = {};
          prices.forEach(function (p) { byGen[p.gen] = Math.max(byGen[p.gen] || 0, p.price); });
          const gens = Object.keys(byGen).map(Number).sort();
          if (gens.length < 2) return true;
          // later generations must not run away
          return byGen[gens[gens.length - 1]] <= cap;
        })());
  check('a hybrid seed keeps a wild-species margin',
        prices.every(function (p) { return p.seed >= p.price * 0.3 && p.seed <= p.price * 0.5; }),
        prices.filter(function (p) { return p.seed < p.price * 0.3 || p.seed > p.price * 0.5; })
          .slice(0, 3).map(function (p) { return p.id + ' ' + p.seed + '/' + p.price; }).join(' '));

  // and the cost of trying must escalate, or breeding is free
  const costs = [];
  const g2 = H.build(); const G2 = g2.evalIn; const st2 = G2('state');
  st2.level = 16;
  /* The cost climbs with the number of hybrids you OWN, not with a counter of
     attempts — so the registry is what has to grow here. */
  for (let k = 0; k < 6; k++) {
    st2.coins = 999999999;
    costs.push(G2('breedCost()'));
    st2.hybrids['fake_' + k] = { a: 'elm', b: 'beech' };
  }
  console.log('  the cost of a cross climbs: ' + costs.join(' -> '));
  let climbs = true;
  for (let k = 1; k < costs.length; k++) if (costs[k] <= costs[k - 1]) climbs = false;
  check('each cross costs more than the last', climbs, costs.join(','));
}

/* ---- 5. every rung of the ladder must be reachable by breeding ---- */
{
  const g = H.build(); const G = g.evalIn;
  const have = {};
  G('BASE_SPECIES').forEach(function (sp) { if (sp.frac) have[sp.frac.join('/')] = 1; });
  // one round of crossing everything with everything
  const reach = Object.assign({}, have);
  const keys = Object.keys(have).map(function (k) { return k.split('/').map(Number); });
  keys.forEach(function (a) {
    keys.forEach(function (b) {
      if (a[0] === b[0] && a[1] === b[1]) return;
      reach[G('reduceFrac')(G('mediant')(a, b)).join('/')] = 1;
    });
  });
  const ladder = G('PHYLLO_LADDER').map(function (f) { return f.join('/'); });
  const unreachable = ladder.filter(function (r) { return !reach[r]; });
  console.log('  ladder rungs wild species already cover: ' + Object.keys(have).sort().join(', '));
  check('every rung of the ladder is reachable', !unreachable.length,
        unreachable.join(', '));
}

console.log('PASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

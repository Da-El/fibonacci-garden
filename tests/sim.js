/* A 21-day simulated player, driving the game's real functions.
   Used to answer balance questions the preview pane cannot. */
const H = require('./harness.js');

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

function run(cfg) {
  cfg = cfg || {};
  const h = H.build();
  const E = h.evalIn;
  const S = function () { return E('state'); };

  // deterministic "skill": fraction of pours that land gold
  let rng = cfg.seed || 12345;
  const rand = function () { rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF; return rng / 0x7FFFFFFF; };
  /* A flat hit rate cannot see anything that changes the gold zone, so perks
     like the steady hand and fever measured as worth exactly nothing. Model a
     tap instead: the player aims at the centre with a normal error in
     milliseconds, and whether that lands depends on the window the game
     actually offers for this species at this stage. */
  const tapError = cfg.tapError === undefined ? 34 : cfg.tapError;   // ±ms, 1 sigma
  const POUR_SECONDS = cfg.pourSeconds === undefined ? 2.5 : cfg.pourSeconds;
  const flatSkill = cfg.skill;                                       // opt-out for old callers
  const erf = function (z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
                   - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return Math.abs(y);
  };
  const perfectChance = function (plotIdx) {
    if (flatSkill !== undefined) return flatSkill;
    const p = S().plots[plotIdx];
    if (!p) return 0.5;
    const sp = E('byId')[p.s];
    const z = E('pourZonesFor')(p.stage, sp);
    const goldMs = z.gw * (E('pourPeriodFor')(sp) / 2);
    return Math.min(0.995, erf((goldMs / 2) / tapError));
  };

  const st = S();
  st.offset = 0;
  /* Grant exactly one perk and nothing else, so a draft's two sides can be
     compared without the level-up screen choosing for us. */
  if (cfg.forcePerk) st.perks[cfg.forcePerk] = true;
  const advance = function (ms) { S().offset += ms; };

  const log = { wagesPaid: 0, earned: 0, harvests: 0, sold: 0, days: [], appWater: 0, quit: 0, wageRates: [] };
  /* Swallowed exceptions mean the game function stopped halfway and the
     numbers below are measuring something that never happened. Count
     them so a silent harness gap can never pass for a clean run. */
  const errs = {};
  const guardCall = function (where, fn) {
    try { return fn(); }
    catch (e) { errs[where + ': ' + e.message] = (errs[where + ': ' + e.message] || 0) + 1; return undefined; }
  };

  let hiredDay = -1;

  function session() {
    const res = E('catchUpWithLedger()');
    const l = res.l || {};
    if (l.wages) log.wagesPaid += l.wages;
    if (l.appPick) log.appPick = (log.appPick || 0) + l.appPick;
    if (l.appSold) log.appSold = (log.appSold || 0) + l.appSold;
    if (l.appTook) { log.appTook = (log.appTook || 0) + l.appTook; log.earned += l.appTook; }
    if (l.quit) log.quit++;
    log.weeds = (log.weeds || 0) + (l.weeds || 0);
    log.ordersLost = (log.ordersLost || 0) + (l.ordersLost || 0);
    log.aphids = (log.aphids || 0) + (l.aphids || 0);
    log.stormHits = (log.stormHits || 0) + (l.stormHits || 0);

    const s = S();

    /* Claim the daily gift. The simulation had never opened it — it is a
       modal with a button, and nothing here had ever pressed one — so a
       hundred days of play reported none of what it pays, which is how a
       golden seed every seventh day went unnoticed for seventy iterations. */
    if (cfg.gift !== false) {
      /* Empty the card first. checkDailyGift returns without touching it if
         today's gift is already claimed, and the button it wrote yesterday
         is still sitting there with its handler — pressing that is pressing
         a button nobody has been shown, and it paid out every time. */
      h.doc.getElementById('card').innerHTML = '';
      guardCall('checkDailyGift', function () { E('checkDailyGift()'); return true; });
      const btn = h.doc.getElementById('c-gift');
      if (h.doc.getElementById('card').innerHTML.indexOf('c-gift') > -1 &&
          btn && btn.listenerCount && btn.listenerCount('click')) {
        const before = S().water;
        btn.dispatchEvent({ type: 'click', target: btn,
          stopPropagation: function () {}, preventDefault: function () {} });
        log.gifts = (log.gifts || 0) + 1;
        if (S().water > before) log.giftCans = (log.giftCans || 0) + 1;
      }
    }

    // clear pests and weeds
    s.plots.forEach(function (p, i) {
      if (p && p.bug) { E('curPlot = ' + i); guardCall('squashBug', function () { E('squashBug()'); return true; }); }
    });
    /* Clear weeds by calling the game's own function rather than zeroing the
       array. Setting state.weeds[i] = 0 skips the worm, the experience, and
       the weedsCleared counter a journal chapter is waiting on — so a run
       that pulled weeds all fortnight reported having pulled none. Same
       shape as selling the barn before delivering an order. */
    for (let i = 0; i < s.plotCount; i++) {
      if (s.weeds && s.weeds[i]) guardCall('clearWeed', function () { E('clearWeed(' + i + ')'); return true; });
    }

    /* Spend the can down, finishing the plant nearest to ripe first, and
       harvest and replant as we go. Pouring only once per plot per visit
       made the bot plot-limited rather than water-limited, which hid every
       effect that saving drops is supposed to have. A real player with
       drops left over replants and finishes the new plant by hand. */
    const replant = function (i) {
      const st = S();
      const list = E('SPECIES').filter(function (x) { return x.lvl <= st.level; });
      const afford = list.filter(function (x) { return E('seedCostOf')(x) <= S().coins * 0.5; });
      if (!afford.length) return false;
      afford.sort(function (a, b) { return E('seedCostOf')(b) - E('seedCostOf')(a); });
      return !!guardCall('plant', function () { E('plant(' + i + ',"' + afford[0].id + '")'); return true; });
    };

    let guard = 0;
    while (guard++ < 4000) {
      const st = S();

      // bank anything ripe before spending more water
      let picked = false;
      for (let i = 0; i < st.plots.length; i++) {
        const p = st.plots[i];
        if (!p || p.stage < E('byId')[p.s].stages) continue;
        if (E('wiltPenalty')(p) > 0) log.wilted = (log.wilted || 0) + 1;
        E('curPlot = ' + i);
        if (guardCall('harvest', function () { E('harvest()'); return true; })) log.harvests++;
        else st.plots[i] = null;
        picked = true;
      }
      if (picked) continue;

      if (S().water <= 0) break;

      const order = [];
      S().plots.forEach(function (p, i) {
        if (!p) return;
        const sp = E('byId')[p.s];
        if (p.stage < sp.stages) order.push({ i: i, left: sp.stages - p.stage });
      });
      if (order.length) {
        order.sort(function (a, b) { return a.left - b.left; });
        const pick = order[0];
        E('curPlot = ' + pick.i);
        const p = S().plots[pick.i];
        if (cfg.realPour) {
          /* Drive the actual minigame. markerPos() is (now - t0) / period, so
             setting t0 places the marker exactly where we want it — which lets
             a simulated tap aim at the centre with a real error in milliseconds
             and then go through lockPour itself. Combos, fever and the spill
             path are the game's own rather than a copy of them. */
          if (!guardCall('startPour', function () { E('startPour()'); return true; })) break;
          const pr = E('pour');
          if (!pr) break;
          const sweep = pr.period / 2;
          // a normal error, from two uniforms
          const u1 = Math.max(1e-9, rand()), u2 = rand();
          const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          const offMs = gauss * tapError;
          let target = pr.center + offMs / sweep;
          target = Math.max(0.001, Math.min(0.999, target));
          pr.t0 = E('performance.now()') - target * pr.period;
          /* A pour takes a couple of seconds for a person: aim, tap, watch it
             land. The bot's whole session used to happen at one instant, so a
             ninety-second fever covered every pour in it and fever measured as
             the normal state of the game. Advance the clock as we play. */
          S().offset += POUR_SECONDS * 1000;
          log.pours = (log.pours || 0) + 1;
          if (E('feverActive()')) log.feverPours = (log.feverPours || 0) + 1;
          if (!guardCall('lockPour', function () { E('lockPour()'); return true; })) break;
          if (E('feverActive()') && !E('state').__wasFever) log.fevers = (log.fevers || 0) + 1;
          E('state').__wasFever = E('feverActive()');
        } else {
          const perfect = rand() < perfectChance(pick.i);
          if (!perfect) p.spills = (p.spills | 0) + 1;
          if (!guardCall('advanceStage', function () {
            E('advanceStage("water",' + (perfect ? 'true' : 'false') + ')'); return true;
          })) break;
        }
        continue;
      }

      // nothing growing and water to spare: sell up and sow the empty beds
      guardCall('sellAll', function () { E('sellAll()'); return true; });
      let sown = false;
      for (let i = 0; i < S().plotCount; i++) if (!S().plots[i] && replant(i)) sown = true;
      if (!sown) break;
    }

    /* Deliver first, then sell what is left.

       These were the other way round, so every run emptied the barn and then
       looked for something in it to fulfil an order with. Three weeks of
       simulated play reported zero orders delivered for dozens of iterations,
       and every judgement made about the order board was made against a
       player who structurally could not deliver one. An order pays a premium
       over the market, so delivering first is also simply what anyone would
       do. */
    for (let k = 0; k < 6; k++) {
      const orders = S().orders || [];
      let did = false;
      for (let oi = 0; oi < orders.length; oi++) {
        const c0 = S().coins;
        if (!guardCall('deliverOrder', function () { E('deliverOrder(' + oi + ')'); return true; })) continue;
        if (S().coins > c0) { log.earned += S().coins - c0; log.ordersPaid = (log.ordersPaid || 0) + 1; did = true; break; }
      }
      if (!did) break;
    }

    // then sell whatever the customers did not want
    const before = S().coins;
    guardCall('sellAll', function () { E('sellAll()'); return true; });
    log.earned += Math.max(0, S().coins - before);
    log.sold++;

    // reinvest: plots, then can, then seeds
    const s2 = S();
    if (cfg.hive && !E('hasHive()') && s2.coins > E('HIVE_COST') * 2.5) E('buyHive()');
    if (cfg.apprentice && !E('hasApprentice()') && s2.coins > E('APPRENTICE_HIRE') * 2.2) {
      E('hireApprentice()');
      hiredDay = E('dayIndex()');
    }
    if (cfg.apprentice && E('hasApprentice()') && S().appLevel < (cfg.capRank || 99)) {
      const lvl = S().appLevel;
      const up = E('APP_UPGRADE')[lvl];
      if (up && S().coins > up * 2.5) E('hireApprentice()');
    }
    for (let k = 0; k < 3; k++) {
      const s = S();
      const cost = E('PLOT_COSTS')[s.plotCount - E('START_PLOTS')];
      if (s.plotCount < E('MAX_PLOTS') && cost && s.coins > cost * 2.4) guardCall('buyPlot', function () { E('buyPlot()'); return true; });
      else break;
    }
    for (let k = 0; k < 2; k++) {
      const s = S();
      const cc = E('CAN_COSTS')[s.canTier];
      if (cc && s.coins > cc * 3) guardCall('buyCan', function () { E('buyCan()'); return true; });
      else break;
    }
    /* Shelter a bed or two once there is money spare. A trellis is one of
       the cheapest things on the shelf and a storm costs a whole stage, so
       anyone would — and the simulation never bought one, which left a
       journal chapter looking permanently out of reach. */
    {
      const s = S();
      const tc = E('TRELLIS_COST');
      const sheltered = (s.trellised || []).filter(Boolean).length;
      const want = cfg.trellises === undefined ? 3 : cfg.trellises;
      if (sheltered < want && s.coins > tc * 6) {
        for (let i = 0; i < s.plotCount; i++) {
          if (s.trellised[i]) continue;
          E('curPlot = ' + i);
          guardCall('buyTrellis', function () { E('buyTrellis()'); return true; });
          break;
        }
      }
    }
    /* Once the beds and the can are bought there is still somewhere for
       money to go — glass over a bed, and the hive, which has no ceiling and
       costs 1.7× a level for a linear return. The simulation bought the hive
       once and never again, and never bought glass at all, so a hundred days
       ended with 3.7 million coins in hand and the late game looked like it
       had nothing to spend on. It has; this was not looking. */
    {
      const s = S();
      if (cfg.glass && s.level >= E('GLASS_LVL')) {
        const panes = (s.glassed || []).filter(Boolean).length;
        const cost = Math.round(E('GLASS_COST') * Math.pow(E('GLASS_STEP'), panes));
        if (panes < s.plotCount && s.coins > cost * 3) {
          for (let i = 0; i < s.plotCount; i++) {
            if (s.glassed[i]) continue;
            E('curPlot = ' + i);
            guardCall('buyGlass', function () { E('buyGlass()'); return true; });
            break;
          }
        }
      }
      if (cfg.hive && E('hasHive()')) {
        const up = Math.round(E('HIVE_COST') * Math.pow(1.7, s.hiveLevel));
        if (s.coins > up * 4) guardCall('buyHive', function () { E('buyHive()'); return true; });
      }
    }

    /* Replant the whole garden once enough has been earned to be worth
       golden seeds. A player does this deliberately and rarely, so the bar
       is a real one: at least the asked-for number of seeds, and never
       before the beds and the can have been bought, since those go. */
    if (cfg.prestigeAt) {
      const s = S();
      const claim = E('claimableGolden()');
      if (claim >= cfg.prestigeAt && s.plotCount >= E('MAX_PLOTS')) {
        log.prestiges = (log.prestiges || 0) + 1;
        log.prestigeDays = log.prestigeDays || [];
        log.prestigeDays.push({ day: log.days.length + 1, seeds: claim,
                                earned: s.runEarned });
        guardCall('doPrestige', function () { E('doPrestige()'); return true; });
      }
    }

    // plant the best affordable species in every empty plot
    const sp3 = S();
    const list = E('SPECIES').filter(function (x) { return x.lvl <= sp3.level; });

    /* What the board is asking for, and how much of it is still wanted after
       what is already in the barn. The planter in the real game flags these
       with a badge; the simulation had never looked at the board at all when
       deciding what to sow, which is why it delivered six orders in a
       hundred days out of nearly four hundred offered. Planting for a
       customer is the whole point of the board. */
    const wanted = {};
    if (cfg.forOrders !== false) {
      /* How much of the board to chase. Giving it everything it asks for is
         up to nine beds at a time, which is the whole garden — a person
         picks one customer and grows for them while the rest of the beds
         carry on earning. 'one' is that person; true is the maximalist. */
      let list = (sp3.orders || []).slice();
      if (cfg.forOrders === 'one') {
        list.sort(function (a, b) { return b.pay - a.pay; });
        list = list.slice(0, 1);
      }
      list.forEach(function (o) {
        const sp = E('byId')[o.s];
        if (!sp || sp.lvl > sp3.level) return;
        /* Only if there is time to grow one before the deadline. */
        const ceilMs = E('timerCeiling')(sp) * sp.growMin * 60000;
        if (o.exp - E('NOW()') < ceilMs * 1.2) return;
        const have = E('orderAvail') ? E('orderAvail')(o) : 0;
        const short = Math.max(0, o.qty - have);
        if (short) wanted[o.s] = (wanted[o.s] || 0) + short;
      });
    }
    /* Count what is already growing towards each order, so nine beds do not
       all go to one customer who wants two. */
    sp3.plots.forEach(function (p) {
      if (p && wanted[p.s]) wanted[p.s]--;
    });

    for (let i = 0; i < sp3.plotCount; i++) {
      if (sp3.plots[i]) continue;
      const afford = list.filter(function (x) { return E('seedCostOf')(x) <= S().coins * 0.5; });
      if (!afford.length) continue;
      const asked = afford.filter(function (x) { return wanted[x.id] > 0; });
      let pick;
      if (asked.length) {
        asked.sort(function (a, b) { return E('seedCostOf')(b) - E('seedCostOf')(a); });
        pick = asked[0];
        wanted[pick.id]--;
      } else {
        afford.sort(function (a, b) { return E('seedCostOf')(b) - E('seedCostOf')(a); });
        pick = afford[0];
      }
      guardCall('plant', function () { E('plant(' + i + ',"' + pick.id + '")'); return true; });
    }
  }

  /* Gaps between sessions, summing to 24h. A diligent player checks in
     four times a day; a casual one opens the app once. The apprentice is
     for the second kind, so both have to be measured. */
  const PROFILE = {
    diligent: [4.5 * HOUR, 5.5 * HOUR, 4 * HOUR, 10 * HOUR],
    casual: [24 * HOUR],
    twice: [10 * HOUR, 14 * HOUR]
  };
  const gaps = PROFILE[cfg.profile || 'diligent'];
  /* Which day each journal chapter was first complete on. The journal exists
     to answer "what should I do next", and that question is only answerable
     by knowing when each one actually falls in a run rather than whether it
     can be satisfied by a synthetic maxed-out save. */
  const chapterTrail = {};
  const days = cfg.days || 21;
  for (let d = 0; d < days; d++) {
    for (let k = 0; k < gaps.length; k++) {
      advance(gaps[k]);
      session();
    }
    if (cfg.chapterTrail) {
      E('CHAPTERS').forEach(function (c) {
        if (chapterTrail[c.id]) return;
        let p = null;
        try { p = E('chapterProgress')(c); } catch (e) { return; }
        if (p && p.all) chapterTrail[c.id] = d + 1;
      });
    }
    const s = S();
    log.days.push({
      d: d + 1, coins: s.coins, earned: s.runEarned, wages: log.wagesPaid,
      plots: s.plotCount, lvl: s.level, app: s.appLevel,
      wage: s.appLevel ? E('appWage()') : 0
    });
  }

  const s = S();
  return {
    coins: s.coins, earned: s.runEarned, sellEarned: log.earned, wagesPaid: log.wagesPaid,
    harvests: log.harvests, plots: s.plotCount, level: s.level,
    appLevel: s.appLevel, quit: log.quit,
    wilted: log.wilted | 0, weeds: log.weeds | 0, ordersPaid: log.ordersPaid | 0,
    ordersLost: log.ordersLost | 0, aphids: log.aphids | 0, stormHits: log.stormHits | 0,
    bestCombo: s.bestCombo | 0, fevers: log.fevers | 0,
    pours: log.pours | 0, feverPours: log.feverPours | 0,
    appPick: log.appPick || 0, appSold: log.appSold || 0, appTook: log.appTook || 0,
    finalWage: s.appLevel ? E('appWage()') : 0,
    goldenSeeds: s.goldenSeeds || 0,
    qualityMix: s.qualityMix || {}, speciesGrown: s.speciesGrown || {},
    canTier: s.canTier, coins: s.coins,
    /* which achievements a real run actually earns — nothing had ever
       reported this, so the achievement audit was reading undefined */
    ach: Object.assign({}, s.ach),
    chapterTrail: chapterTrail,
    /* runEarned resets on a replant; state.earned is the lifetime figure and
       is the only one that can compare a player who prestiges against one
       who does not. */
    lifetime: s.earned | 0,
    gifts: log.gifts || 0,
    giftCans: log.giftCans || 0,
    giftStreak: s.giftStreak | 0,
    hiveLevel: s.hiveLevel | 0,
    panes: (s.glassed || []).filter(Boolean).length,
    prestiges: log.prestiges || 0,
    prestigeDays: log.prestigeDays || [],
    golden: s.golden | 0,
    goldenMult: E("goldenMult()"),
    errs: errs,
    days: log.days
  };
}

module.exports = { run: run };

if (require.main === module) {
  const without = run({ apprentice: false, seed: 4242 });
  const with_ = run({ apprentice: true, seed: 4242 });
  const benefit = with_.earned - without.earned;
  console.log('--- WITHOUT apprentice ---');
  console.log('  earned', without.earned, ' coins', without.coins, ' harvests', without.harvests, ' plots', without.plots, ' lvl', without.level);
  console.log('--- WITH apprentice ---');
  console.log('  earned', with_.earned, ' coins', with_.coins, ' harvests', with_.harvests, ' plots', with_.plots, ' lvl', with_.level);
  console.log('  rank', with_.appLevel, ' waters', with_.appWater, ' finalWage', with_.finalWage, ' quit', with_.quit);
  console.log('--- verdict ---');
  console.log('  gross benefit  ', benefit);
  console.log('  wages paid     ', with_.wagesPaid);
  console.log('  wages as % of benefit', benefit > 0 ? Math.round(with_.wagesPaid / benefit * 100) + '%' : 'n/a');
  console.log('  net benefit    ', benefit - with_.wagesPaid);
  console.log('\n  wage curve:', with_.days.filter(function (r) { return r.app; }).map(function (r) { return 'd' + r.d + ':' + r.wage; }).join(' '));
  [['without', without], ['with', with_]].forEach(function (pair) {
    const e = Object.keys(pair[1].errs);
    if (e.length) console.log('\n  !! swallowed errors (' + pair[0] + '):', e.map(function (k) { return k + ' x' + pair[1].errs[k]; }).join('; '));
  });
}

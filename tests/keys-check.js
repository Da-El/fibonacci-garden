/* Iteration 70: the accessibility checks read attributes. This plays the
   game.

   Now that the harness records listeners and can fire them, the question is
   no longer "does this bed have a role and a label" but "can somebody who
   never touches the screen plant a seed, pour a drop, and lift a bloom".
   Those are different questions and only the second one is the promise. */
const path = require('path');
const H = require('./harness.js');
const bugs = [], ok = [];
function check(n, c, d) { (c ? ok : bugs).push(n + (d ? ' — ' + d : '')); }

function garden() {
  const h = H.build(); const E = h.evalIn; const s = E('state');
  s.offset = 0; s.coins = 900;
  h.doc.getElementById('scene').clientWidth = 390;
  h.doc.getElementById('bed').clientWidth = 390;
  h.doc.getElementById('bed').clientHeight = 200;
  E('paintPlots()');
  return { h: h, E: E, s: s };
}

/* Press a key on an element the way a browser would. */
function press(el, key) {
  let stopped = false, prevented = false;
  el.dispatchEvent({
    type: 'keydown', key: key, target: el, currentTarget: el,
    stopPropagation: function () { stopped = true; },
    preventDefault: function () { prevented = true; }
  });
  return { stopped: stopped, prevented: prevented };
}
function click(el) {
  el.dispatchEvent({
    type: 'click', target: el, currentTarget: el,
    stopPropagation: function () {}, preventDefault: function () {}
  });
}

/* ---- everything you can reach must say what it is ---- */
{
  const g = garden();
  const bed = g.h.doc.getElementById('bed');
  const spots = bed.querySelectorAll('.gspot').concat(bed.querySelectorAll('.gplant'))
    .filter(function (e) { return e && e.setAttribute; });
  console.log('  ' + spots.length + ' places in the bed you can reach');
  const noName = spots.filter(function (e) { return !e.getAttribute('aria-label'); });
  const noRole = spots.filter(function (e) {
    return e.getAttribute('role') !== 'button' && e.tagName !== 'BUTTON';
  });
  const noStop = spots.filter(function (e) { return e.getAttribute('tabindex') === null; });
  check('every bed in the garden is a stop on the way round',
        !noStop.length, noStop.length + ' without a tabindex');
  check('and announces itself as something you can press',
        !noRole.length, noRole.length + ' without a button role');
  check('and says what it is', !noName.length, noName.length + ' unlabelled');

  /* The label has to be worth reading. "button" tells you nothing. */
  const vague = spots.filter(function (e) {
    const l = (e.getAttribute('aria-label') || '').toLowerCase();
    return l.length < 8 || l === 'button' || l === 'plot';
  });
  check('and says something useful, not just "button"',
        !vague.length, vague.map(function (e) { return e.getAttribute('aria-label'); }).join(' | '));
}

/* ---- and the whole loop must be playable without a pointer ---- */
{
  const g = garden();
  const bed = g.h.doc.getElementById('bed');
  const trail = [];

  /* 1. an empty bed, reached by keyboard, opened with Enter */
  const spot = bed.querySelectorAll('.gspot')[0];
  check('there is an empty bed to start from', !!spot);
  if (spot) {
    press(spot, 'Enter');
    const opened = g.h.doc.getElementById('modal')._cls.show ||
                   g.h.doc.getElementById('card').innerHTML.length > 0;
    trail.push('Enter on a bed -> ' + (opened ? 'the planter' : 'nothing'));
    check('pressing Enter on an empty bed opens the planter', opened);

    /* 2. pick a seed from it, by pressing the button rather than tapping */
    const seedBtns = g.h.doc.getElementById('card').querySelectorAll('button[data-sp]');
    const real = seedBtns.filter(function (b) { return b && b.dataset && b.dataset.sp; });
    check('the planter offers seeds you can press', real.length > 0,
          real.length + ' offered');
    if (real.length) {
      click(real[0]);
      const planted = !!g.s.plots[0];
      trail.push('press a seed -> ' + (planted ? 'planted ' + g.s.plots[0].s : 'nothing'));
      check('and pressing one plants it', planted);
    }
  }

  /* 3. the planted bed, reached again, opened with the space bar */
  g.E('paintPlots()');
  const plant = bed.querySelectorAll('.gplant')[0];
  check('the planted bed is reachable too', !!plant);
  if (plant) {
    press(plant, ' ');
    const growOpen = g.h.doc.getElementById('grow')._cls.show;
    trail.push('Space on a plant -> ' + (growOpen ? 'the plant view' : 'nothing'));
    check('and the space bar opens it', growOpen);
  }

  /* 4. pour, and lock the pour, from the keyboard */
  const act = g.h.doc.getElementById('act');
  const before = g.s.water;
  click(act);
  const pouring = !!g.E('pour');
  trail.push('press water -> ' + (pouring ? 'the drop is sweeping' : 'nothing'));
  check('the water button starts a pour', pouring);
  if (pouring) {
    /* The shot is taken with the same key that started it, and the handler
       for that lives on the window rather than on the bar — a keyboard
       player never touches the bar at all. */
    g.h.win.dispatchEvent({
      type: 'keydown', key: ' ', target: { tagName: 'DIV' },
      stopPropagation: function () {}, preventDefault: function () {}
    });
    g.h.runTimers(100);
    const done = !g.E('pour');
    trail.push('press space to lock -> ' + (done ? 'resolved' : 'still sweeping'));
    check('and pressing space again takes the shot', done);
    check('and it cost a drop', g.s.water < before, before + ' -> ' + g.s.water);
  }

  /* Escape has to get you out of everything, or a keyboard player who opens
     the wrong thing is stuck in it. */
  const esc = function () {
    g.h.win.dispatchEvent({
      type: 'keydown', key: 'Escape', target: { tagName: 'DIV' },
      stopPropagation: function () {}, preventDefault: function () {}
    });
  };
  g.E('openPlanter(1)');
  esc();
  check('Escape closes a card you did not mean to open',
        !g.h.doc.getElementById('modal')._cls.show);
  g.E('openGrow(0)');
  g.E('startPour()');
  esc();
  check('and Escape calls off a pour rather than spilling it', !g.E('pour'));

  console.log('\n  played without touching a coordinate:');
  trail.forEach(function (t) { console.log('    ' + t); });
}

/* ---- Enter and Space must both work, and nothing else should ---- */
{
  const g = garden();
  const bed = g.h.doc.getElementById('bed');
  const spot = bed.querySelectorAll('.gspot')[0];
  if (spot) {
    /* A handler that fires on every key turns typing into a minefield for
       anyone using a screen reader, which sends keys constantly. */
    const idle = g.h.doc.getElementById('card').innerHTML;
    ['a', 'Tab', 'ArrowDown', 'Shift', 'Escape'].forEach(function (k) { press(spot, k); });
    check('a bed ignores keys that are not Enter or Space',
          g.h.doc.getElementById('card').innerHTML === idle,
          'the card changed after an ordinary keypress');
    const r = press(spot, 'Enter');
    check('and Enter is swallowed so the page does not also scroll', r.prevented);
  }
}

/* ---- the tab strip must be operable, and say where you are ----
   The tab strip lives in the static markup, and the harness only builds a
   tree out of what the game writes at runtime — so this part is read from
   the file rather than pressed. Worth being explicit about: it is a weaker
   check than the ones above, and it is weaker because of the tool. */
{
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const head = html.slice(0, html.indexOf('<script>'));
  const tabs = head.match(/<div class="tab[^"]*"[^>]*>/g) || [];
  console.log('\n  ' + tabs.length + ' tabs in the markup');
  check('there are tabs', tabs.length >= 4, String(tabs.length));
  const named = tabs.filter(function (t) { return t.indexOf('aria-label') > -1; });
  check('every tab is named', named.length === tabs.length,
        named.length + ' of ' + tabs.length);
  const says = tabs.filter(function (t) { return t.indexOf('aria-selected') > -1; });
  check('and every tab says whether it is the one you are on',
        says.length === tabs.length, says.length + ' of ' + tabs.length);
  const stops = tabs.filter(function (t) { return t.indexOf('tabindex="0"') > -1; });
  check('and every tab is a stop on the way round',
        stops.length === tabs.length, stops.length + ' of ' + tabs.length);
  const roled = tabs.filter(function (t) { return t.indexOf('role="tab"') > -1; });
  check('and carries a tab role', roled.length === tabs.length,
        roled.length + ' of ' + tabs.length);
  check('and a tab answers to the keyboard at all',
        html.indexOf("t.addEventListener('keydown'") > -1);
  /* Exactly one may claim to be the current one at rest. */
  const selected = tabs.filter(function (t) { return t.indexOf('aria-selected="true"') > -1; });
  check('and exactly one is marked current to begin with',
        selected.length === 1, selected.length + ' marked current');
}

/* ---- and something must be said out loud when it matters ---- */
{
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const live = (html.match(/aria-live="(polite|assertive)"/g) || []).length;
  console.log('  ' + live + ' live region(s)');
  check('there is a region that announces what happened', live >= 1, String(live));
  /* A toast nobody hears is a toast that did not happen. The live region has
     to be the thing the toasts are written into. */
  const i = html.indexOf('aria-live=');
  const id = html.slice(Math.max(0, i - 220), i).match(/id="([A-Za-z0-9_-]+)"[^>]*$/);
  const liveId = id && id[1];
  console.log('  the live region is #' + liveId);
  check('and it is the element the game writes its messages into',
        !!liveId && html.indexOf("$('" + liveId + "')") > -1,
        '#' + liveId);

  const g = garden();
  const region = g.h.doc.getElementById(liveId);
  const was = region.textContent || '';
  g.E('toast("A test message")');
  const now = region.textContent || '';
  check('and a message really lands in it', now !== was && now.length > 0,
        JSON.stringify(now));
}

/* ---- nothing may be reachable that does nothing ---- */
{
  const g = garden();
  /* An element with a tabindex is a stop on the way round. If pressing it
     does nothing, it is a dead end that everyone using a keyboard has to
     walk past, every time. */
  const html = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const head = html.slice(0, html.indexOf('<script>'));
  const stops = (head.match(/tabindex="0"/g) || []).length;
  console.log('  ' + stops + ' keyboard stops declared in the markup');
  check('the markup declares keyboard stops at all', stops >= 4, String(stops));
  /* Anything given a button role must have something to press. */
  const roleButtons = (head.match(/role="button"/g) || []).length;
  const labelled = (head.match(/role="button"[^>]*aria-label|aria-label[^>]*role="button"/g) || []).length;
  check('every button role in the markup carries a label',
        roleButtons === 0 || labelled >= roleButtons,
        labelled + ' labelled of ' + roleButtons);
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bugs.length);
ok.forEach(function (t) { console.log('  ok   ' + t); });
bugs.forEach(function (t) { console.log('  FAIL ' + t); });

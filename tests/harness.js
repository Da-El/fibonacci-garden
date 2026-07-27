const path = require('path');
/* The game, found relative to this file so the suite is portable. */
const GAME_PATH = path.join(__dirname, '..', 'index.html');
/* Headless harness: loads the game's <script> into Node with just enough
   DOM to let it boot, then exposes the module scope so simulations can
   drive the real functions rather than a reimplementation of them. */
const fs = require('fs');
const GAME = GAME_PATH;

function makeStyle() {
  const s = {};
  s.setProperty = function (k, v) { s[k] = String(v); };
  s.getPropertyValue = function (k) { return k in s ? s[k] : ''; };
  s.removeProperty = function (k) { delete s[k]; };
  return s;
}

function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], childNodes: [], style: makeStyle(), dataset: {}, classList: null,
    _cls: {}, _html: '', _text: '', attrs: {},
    parentNode: null, scrollTop: 0, scrollHeight: 0, offsetWidth: 320, offsetHeight: 480,
    value: '', checked: false, disabled: false,
    appendChild: function (c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
    removeChild: function (c) { const i = this.children.indexOf(c); if (i > -1) { this.children.splice(i, 1); this.childNodes.splice(i, 1); } return c; },
    remove: function () { if (this.parentNode) this.parentNode.removeChild(this); },
    insertBefore: function (c) { this.children.unshift(c); this.childNodes.unshift(c); c.parentNode = this; return c; },
    setAttribute: function (k, v) { this.attrs[k] = String(v); if (k === 'class') this._setCls(String(v)); },
    getAttribute: function (k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute: function (k) { delete this.attrs[k]; },
    hasAttribute: function (k) { return k in this.attrs; },
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () { return true; },
    /* Returning null here would make paint code throw partway through a
       game function, truncating its side effects and quietly corrupting
       any simulation. Hand back a cached stub per selector instead. */
    _q: {},
    querySelector: function (sel) {
      if (!this._q[sel]) { const e = makeEl('div'); e.parentNode = this; this._q[sel] = e; }
      return this._q[sel];
    },
    querySelectorAll: function (sel) { return [this.querySelector(sel)]; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 320, height: 480, right: 320, bottom: 480 }; },
    focus: function () {}, blur: function () {}, click: function () {}, select: function () {},
    animate: function () { return { finished: Promise.resolve(), cancel: function () {} }; },
    closest: function () { return null; },
    contains: function () { return false; },
    scrollIntoView: function () {},
    _setCls: function (s) { this._cls = {}; String(s).split(/\s+/).forEach(function (c) { if (c) this._cls[c] = 1; }, this); }
  };
  el.classList = {
    add: function () { for (let i = 0; i < arguments.length; i++) el._cls[arguments[i]] = 1; },
    remove: function () { for (let i = 0; i < arguments.length; i++) delete el._cls[arguments[i]]; },
    toggle: function (c, on) { if (on === undefined) on = !el._cls[c]; if (on) el._cls[c] = 1; else delete el._cls[c]; return !!on; },
    contains: function (c) { return !!el._cls[c]; }
  };
  Object.defineProperty(el, 'className', {
    get: function () { return Object.keys(el._cls).join(' '); },
    set: function (v) { el._setCls(v); }
  });
  Object.defineProperty(el, 'innerHTML', { get: function () { return el._html; }, set: function (v) { el._html = String(v); } });
  Object.defineProperty(el, 'textContent', { get: function () { return el._text; }, set: function (v) { el._text = String(v); } });
  Object.defineProperty(el, 'innerText', { get: function () { return el._text; }, set: function (v) { el._text = String(v); } });
  Object.defineProperty(el, 'firstChild', { get: function () { return el.children[0] || null; } });
  Object.defineProperty(el, 'lastChild', { get: function () { return el.children[el.children.length - 1] || null; } });
  return el;
}

function build(opts) {
  opts = opts || {};
  const html = fs.readFileSync(GAME, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('no <script> block found');
  const src = m[1];

  /* every id the markup declares, so $() never returns null */
  const ids = {};
  const idRe = /\bid="([A-Za-z0-9_-]+)"/g;
  let g;
  while ((g = idRe.exec(html))) ids[g[1]] = makeEl('div');

  /* Seed the store before the game boots, so loading an existing save can be
     tested at all. Without this every build starts from a blank slate and the
     entire migration path is unreachable. */
  const store = {};
  if (opts.preload) Object.keys(opts.preload).forEach(function (k) { store[k] = opts.preload[k]; });
  const localStorage = {
    getItem: function (k) { return k in store ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    clear: function () { for (const k in store) delete store[k]; }
  };

  let clock = opts.startTime || Date.UTC(2026, 6, 1, 9, 0, 0);
  const doc = {
    body: makeEl('body'),
    documentElement: makeEl('html'),
    head: makeEl('head'),
    hidden: false,
    visibilityState: 'visible',
    title: 'Fibonacci Garden',
    getElementById: function (id) { if (!ids[id]) ids[id] = makeEl('div'); return ids[id]; },
    createElement: function (t) { return makeEl(t); },
    createElementNS: function (ns, t) { return makeEl(t); },
    createTextNode: function (t) { const e = makeEl('#text'); e._text = t; return e; },
    createDocumentFragment: function () { return makeEl('#fragment'); },
    _q: {},
    querySelector: function (sel) {
      if (!this._q[sel]) this._q[sel] = makeEl('div');
      return this._q[sel];
    },
    querySelectorAll: function (sel) { return [this.querySelector(sel)]; },
    addEventListener: function () {}, removeEventListener: function () {},
    activeElement: null,
    fonts: { ready: Promise.resolve() }
  };

  const timers = [];
  const win = {
    document: doc,
    localStorage: localStorage,
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
    scrollX: 0, scrollY: 0,
    location: { href: 'file:///game/index.html', origin: 'file://', search: '', hash: '', reload: function () {} },
    navigator: { vibrate: function () {}, userAgent: 'node', standalone: false, serviceWorker: null, clipboard: null, share: null },
    matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
    requestAnimationFrame: function (fn) { return 0; },
    cancelAnimationFrame: function () {},
    setTimeout: function (fn, ms) { timers.push({ fn: fn, at: clock + (ms || 0) }); return timers.length; },
    clearTimeout: function () {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    addEventListener: function () {}, removeEventListener: function () {},
    getComputedStyle: function () { return { getPropertyValue: function () { return ''; }, fontSize: '16px' }; },
    AudioContext: null, webkitAudioContext: null,
    /* A frozen performance.now() means the pour minigame can never resolve:
       markerPos() is (now - t0) / period, so the marker sits at 0 forever and
       the outcome sounds never fire. Advance it a little on every read so
       pours land in varied places. */
    performance: { now: (function () { let t = 0; return function () { t += 37; return t; }; })() },
    alert: function () {}, confirm: function () { return true; }, prompt: function () { return null; },
    Image: function () { return makeEl('img'); },
    Blob: function () {}, URL: { createObjectURL: function () { return ''; }, revokeObjectURL: function () {} }
  };
  win.window = win; win.self = win; win.globalThis = win;
  win.top = win; win.parent = win;

  const sandbox = {
    window: win, document: doc, localStorage: localStorage, navigator: win.navigator,
    location: win.location, performance: win.performance, screen: { width: 390, height: 844 },
    requestAnimationFrame: win.requestAnimationFrame, cancelAnimationFrame: win.cancelAnimationFrame,
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
    setInterval: win.setInterval, clearInterval: win.clearInterval,
    getComputedStyle: win.getComputedStyle,
    matchMedia: win.matchMedia, alert: win.alert, confirm: win.confirm, prompt: win.prompt,
    Math: Math, JSON: JSON, Date: Date, console: console,
    Object: Object, Array: Array, String: String, Number: Number, Boolean: Boolean,
    Map: Map, Set: Set, Promise: Promise, Error: Error, RegExp: RegExp,
    isNaN: isNaN, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    Intl: Intl, Float32Array: Float32Array, Uint8Array: Uint8Array, Int32Array: Int32Array
  };

  /* run the script, then hand back everything it declared at top level.
     A trailing return of `eval` lets the sim reach into the closure. */
  const names = Object.keys(sandbox);
  const wrapped = '"use strict";\n' + src + '\n;return function(__expr){ return eval(__expr); };';
  let evalIn;
  try {
    const fn = new Function(names.join(','), wrapped);
    evalIn = fn.apply(null, names.map(function (n) { return sandbox[n]; }));
  } catch (e) {
    throw new Error('script threw on load: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
  }

  return {
    evalIn: evalIn,
    get: function (name) { return evalIn(name); },
    call: function (expr) { return evalIn(expr); },
    setClock: function (t) { clock = t; evalIn('__CLOCK_SET')(t); },
    store: store, win: win, doc: doc, timers: timers, ids: ids
  };
}

module.exports = { build: build, makeEl: makeEl };

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

/* A canvas that records what was drawn on it instead of drawing. The postcard
   is the only artefact that leaves the app, and the PNG bytes are the
   browser's job — but whether the game's drawing code throws, and whether the
   text it writes stays inside the picture, is the game's job and was never
   checked. */
/* A Web Audio context that plays nothing and remembers everything.

   Every node the game builds is a plain object with the methods the game
   calls, so the real audio code runs end to end; every oscillator that gets
   start()ed is appended to ctx.notes with its frequency, waveform, when it
   was scheduled and how loud the gain envelope was told to make it. That is
   enough to ask real questions of the score — did the tempo change, did the
   chord get fuller, is it the right mode for the season — without any of it
   making a sound. */
function makeAudioContext() {
  function Ctx() {
    const ctx = this;
    this.currentTime = 0;
    this.state = 'running';
    this.notes = [];
    this.sampleRate = 44100;
    function param(name, owner) {
      return {
        value: 0,
        setValueAtTime: function (v, t) { owner[name] = v; owner[name + 'At'] = t; return this; },
        linearRampToValueAtTime: function (v, t) { owner[name + 'To'] = v; return this; },
        exponentialRampToValueAtTime: function (v, t) {
          owner.peak = Math.max(owner.peak || 0, v); return this;
        },
        setTargetAtTime: function (v) { return this; },
        cancelScheduledValues: function () { return this; }
      };
    }
    function node(kind) {
      const n = { kind: kind, peak: 0, connectedTo: null };
      n.connect = function (dest) { n.connectedTo = dest; return dest; };
      n.disconnect = function () {};
      return n;
    }
    this.destination = node('destination');
    this.createGain = function () {
      const n = node('gain');
      n.gain = param('gainValue', n);
      return n;
    };
    this.createBiquadFilter = function () {
      const n = node('filter');
      n.frequency = param('freq', n);
      n.Q = param('q', n);
      n.type = 'lowpass';
      return n;
    };
    this.createOscillator = function () {
      const n = node('osc');
      n.frequency = param('freq', n);
      n.detune = param('detune', n);
      n.type = 'sine';
      n.start = function (t) {
        /* Walk the graph to whichever gain this note goes through, so a
           note's loudness is the envelope it was actually given. */
        let g = n.connectedTo, hops = 0, peak = 0;
        while (g && hops++ < 6) { if (g.peak) { peak = g.peak; break; } g = g.connectedTo; }
        ctx.notes.push({ freq: n.freq, type: n.type, at: t, peak: peak, kind: 'osc' });
      };
      n.stop = function () {};
      return n;
    };
    this.createBufferSource = function () {
      const n = node('buffer');
      n.buffer = null;
      n.playbackRate = param('rate', n);
      n.start = function (t) { ctx.notes.push({ at: t, kind: 'noise' }); };
      n.stop = function () {};
      return n;
    };
    this.createBuffer = function (ch, len, rate) {
      return { length: len, sampleRate: rate, numberOfChannels: ch,
               getChannelData: function () { return new Float32Array(len); } };
    };
    this.createStereoPanner = function () {
      const n = node('pan'); n.pan = param('pan', n); return n;
    };
    this.createDynamicsCompressor = function () {
      const n = node('comp');
      ['threshold', 'knee', 'ratio', 'attack', 'release'].forEach(function (k) {
        n[k] = param(k, n);
      });
      return n;
    };
    this.resume = function () { ctx.state = 'running'; return Promise.resolve(); };
    this.suspend = function () { ctx.state = 'suspended'; return Promise.resolve(); };
    this.close = function () { return Promise.resolve(); };
  }
  return Ctx;
}

function makeCanvasContext(el) {
  const ops = [];
  const noop = function (name) {
    return function () {
      ops.push({ op: name, args: Array.prototype.slice.call(arguments) });
    };
  };
  const ctx = {
    _ops: ops,
    canvas: el,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
    textBaseline: '', globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0,
    shadowColor: '', globalCompositeOperation: '',
    fillRect: noop('fillRect'), strokeRect: noop('strokeRect'),
    clearRect: noop('clearRect'), beginPath: noop('beginPath'),
    closePath: noop('closePath'), moveTo: noop('moveTo'), lineTo: noop('lineTo'),
    arc: noop('arc'), ellipse: noop('ellipse'), rect: noop('rect'),
    quadraticCurveTo: noop('quadraticCurveTo'), bezierCurveTo: noop('bezierCurveTo'),
    fill: noop('fill'), stroke: noop('stroke'), clip: noop('clip'),
    save: noop('save'), restore: noop('restore'), translate: noop('translate'),
    rotate: noop('rotate'), scale: noop('scale'), setTransform: noop('setTransform'),
    drawImage: noop('drawImage'), setLineDash: noop('setLineDash'),
    fillText: function (t, x, y) { ops.push({ op: 'fillText', text: String(t), x: x, y: y, font: ctx.font }); },
    strokeText: function (t, x, y) { ops.push({ op: 'strokeText', text: String(t), x: x, y: y }); },
    measureText: function (t) { return { width: String(t).length * 6 }; },
    createLinearGradient: function () {
      return { addColorStop: function () {} };
    },
    createRadialGradient: function () { return { addColorStop: function () {} }; },
    createPattern: function () { return null; }
  };
  return ctx;
}

function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], childNodes: [], style: makeStyle(), dataset: {}, classList: null,
    _cls: {}, _html: '', _text: '', attrs: {},
    parentNode: null, scrollTop: 0, scrollHeight: 0, offsetWidth: 320, offsetHeight: 480,
    /* The scene lays its beds out from clientWidth, so leaving this at zero
       would silently fall back to the game's own default and every layout
       check would be measuring the fallback rather than the size asked for. */
    clientWidth: 0, clientHeight: 0,
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
    _setCls: function (s) { this._cls = {}; String(s).split(/\s+/).forEach(function (c) { if (c) this._cls[c] = 1; }, this); },
    getContext: function (kind) {
      if (kind !== '2d') return null;
      if (!this._ctx) this._ctx = makeCanvasContext(this);
      return this._ctx;
    },
    toBlob: function (cb) { if (cb) cb({ size: 1, type: 'image/png' }); },
    toDataURL: function () { return 'data:image/png;base64,'; }
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

/* The game reads the wall clock — NOW() is Date.now() plus an offset — so
   handing it the real Date made every run start at a different moment. The day
   index, the weather slots, the season, the dry spell and the Daily all shift
   with it, which meant no simulation was reproducible and every balance number
   carried an uncontrolled variable. Runs now start from a fixed instant.

   Chosen to be a Monday at 09:00 UTC, well clear of a week boundary, so a
   21-day run covers three whole seasons and several dry spells. */
const EPOCH = Date.UTC(2026, 0, 5, 9, 0, 0);
function makeFixedDate(epoch) {
  function FixedDate(a, b, c, d, e, f, g) {
    if (!(this instanceof FixedDate)) return new Date(epoch).toString();
    switch (arguments.length) {
      case 0: return new Date(epoch);
      case 1: return new Date(a);
      default: return new Date(a, b, c || 1, d || 0, e || 0, f || 0, g || 0);
    }
  }
  FixedDate.now = function () { return epoch; };
  FixedDate.UTC = Date.UTC;
  FixedDate.parse = Date.parse;
  FixedDate.prototype = Date.prototype;
  return FixedDate;
}

function build(opts) {
  opts = opts || {};
  const FixedDate = makeFixedDate(opts.epoch || EPOCH);
  const html = fs.readFileSync(GAME, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('no <script> block found');
  const src = m[1];

  /* every id the markup declares, so $() never returns null */
  const ids = {};
  const idRe = /\bid="([A-Za-z0-9_-]+)"/g;
  let g;
  while ((g = idRe.exec(html))) ids[g[1]] = makeEl('div');
  /* Give the scene and its bed a real size, so a layout can be measured at a
     chosen viewport rather than at whatever the game's fallback happens to be. */
  const vw = opts.width || 390;
  if (ids.scene) { ids.scene.clientWidth = vw; ids.scene.clientHeight = Math.round(vw * 0.62); }
  if (ids.bed) { ids.bed.clientWidth = vw; ids.bed.clientHeight = Math.round(vw * 0.42); }

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
  const intervals = [];
  let intervalSeq = 0;
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
    /* Intervals used to be dropped on the floor, which meant every repeating
       thing in the game — the tick loop, the score — existed in tests only
       as source to be read. They are recorded now, and a test can step them
       by hand. Nothing fires unless a test asks it to. */
    setInterval: function (fn, ms) {
      intervals.push({ id: ++intervalSeq, fn: fn, ms: ms || 0 });
      return intervalSeq;
    },
    clearInterval: function (id) {
      for (let i = 0; i < intervals.length; i++) {
        if (intervals[i].id === id) { intervals.splice(i, 1); return; }
      }
    },
    addEventListener: function () {}, removeEventListener: function () {},
    getComputedStyle: function () { return { getPropertyValue: function () { return ''; }, fontSize: '16px' }; },
    /* A recording Web Audio context. Null here meant every note the game
       played returned at the first line, so the score — which is nothing
       but notes — could not be measured at all, only read. Now each note
       lands in ctx.notes and a test can ask what the garden actually
       sounded like. */
    AudioContext: makeAudioContext(), webkitAudioContext: null,
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
    Math: Math, JSON: JSON, Date: FixedDate, console: console,
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
    store: store, win: win, doc: doc, timers: timers, ids: ids,
    intervals: intervals,
    /* Fire every registered interval n times, newest list each pass so a
       callback that re-times itself is followed rather than lost. */
    tickIntervals: function (n) {
      for (let i = 0; i < (n || 1); i++) {
        intervals.slice().forEach(function (t) {
          if (intervals.indexOf(t) > -1) t.fn();
        });
      }
    }
  };
}

module.exports = { build: build, makeEl: makeEl };

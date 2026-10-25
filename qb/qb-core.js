/* qb-core.js — Question Bank core (global `QB`)
 * =============================================================================
 * Registry, course tree, seeded RNG, number formatting, complex maths, input
 * parsing / answer checking and small HTML helpers. No DOM access here, so the
 * file also loads in a Node `vm` context for tests.
 *
 * REGISTRY
 *   QB.course(id, {title, code, colour})
 *   QB.module(courseId, moduleId, {title, order})
 *   QB.topic(courseId, moduleId, topicId, {title, order, pack:'M7'})   // pack may be 'M7,M9'
 *   QB.add({ id, course, module, topic, title, difficulty:1|2|3, marks,
 *            variants:[{id,label,weight?}], tags:[], gen(r, variant){ return Q } })
 *     - The course/module/topic tree for all three courses is defined at the
 *       bottom of this file. Use those ids (QB.tree() lists them).
 *     - variant: the framework ALWAYS passes a concrete variant id when the type
 *       declares variants ("Random" is resolved from the seed before gen runs).
 *       It passes null only when the type has no variants.
 *   Q = { stem, figure, given:[[label,value],...], parts:[{q, answers:[{label,value,unit,tol,sig,abs}], working}], notes }
 *     answers[i]: value = number in SI base units (A, V, Ω, F, W, Hz, rad, deg ...).
 *       tol  relative tolerance (default 0.02); abs  absolute tolerance (default 0,
 *       auto 1e-9 when value is 0); sig  digits shown in the answer key (default 3);
 *       alt  [other accepted values]; hint optional text under the box.
 *       unit '' for dimensionless. Unit 'rad' inputs accept "0.8pi" / "0.8π".
 *   QB.make(typeOrId, seed, variant) -> Q (with .seed .variant .typeId filled in)
 *   QB.validate(Q) -> [] of problem strings (used by tests and the app)
 *
 * RNG  (r passed to gen; QB.rng(seed) makes one)
 *   r.int(a,b) inclusive · r.float(a,b,dp=2) · r.pick(arr) · r.pickw([[w,v],..])
 *   r.shuffle(arr) (copy) · r.bool(p=.5) · r.sign() · r.next() in [0,1)
 *   r.eseries('E6'|'E12'|'E24', min, max) standard value in [min,max] (SI units)
 *   r.cap(min,max) E6 capacitor · r.nice(a,b,step) · r.retry(fn, n=50) (throws if all null)
 *
 * FORMATTING  QB.fmt
 *   eng(x, unit='', sig=3)   "2.31 mA", "4.7 kΩ", "15.2 µF" (plain text / SVG labels)
 *   num(x, sig=3)            "0.0231", "1230", "2.31×10⁻⁸"
 *   fix(x, dp)               fixed decimals
 *   phasor(re, im, sig=4) or phasor(cx, sig)  -> TeX "29.8\angle -38.4^\circ"
 *   cx(re, im, sig=4) or cx(z, sig)            -> TeX "3.2 + j4.1"
 *   tex.eng(x, unit, sig)    TeX "2.31\,\text{mA}"  (µ -> \mu, Ω -> \Omega)
 *   tex.num(x, sig)          TeX "2.31\times10^{-3}" when needed
 *   tex.frac(a,b) · tex.ang(deg, dp=2) · tex.pi(x) ("0.8\pi")
 *   r(x) / ohm(x)            resistor shorthand "4.7 kΩ" (sig 2–3, trailing zeros dropped)
 *
 * COMPLEX  QB.cx(re,im) -> immutable; .add .sub .mul .div (accept cx or number),
 *   .abs() .arg() (rad) .argd() (deg) .conj() .inv() .neg() .scale(k) .re .im
 *   QB.cx.polar(mag, deg) · QB.cx.par(a, b, ...) parallel impedance · QB.par(r1, r2, ...) real parallel
 *
 * HTML HELPERS (return strings)
 *   QB.steps([...html]) numbered working steps · QB.final(tex) boxed final answer
 *   QB.callout('trap'|'tip'|'check', html) · QB.tbl(head, rows)
 *
 * UNITS / CONSTANTS  QB.units.VT = 0.026 (Boylestad r_e = 26 mV / I_E) · QB.deg(rad) · QB.rad(deg)
 * PARSING  QB.parse('2.3m') -> 0.0023 · QB.checkAnswer(answer, text) -> {ok, val, msg}
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB = G.QB || {};
  QB.version = '1.0.0';

  /* ------------------------------------------------------------ registry */
  QB.courses = {};      // id -> course
  QB.types = [];        // all question types, insertion order
  QB.byId = {};
  QB.warnings = [];

  QB.course = function (id, o) {
    var c = QB.courses[id] || (QB.courses[id] = { id: id, modules: {}, order: Object.keys(QB.courses).length });
    Object.assign(c, o || {});
    return c;
  };
  QB.module = function (cid, mid, o) {
    var c = QB.courses[cid] || QB.course(cid, { title: cid });
    var m = c.modules[mid] || (c.modules[mid] = { id: mid, course: cid, topics: {}, order: Object.keys(c.modules).length + 1 });
    Object.assign(m, o || {});
    return m;
  };
  QB.topic = function (cid, mid, tid, o) {
    var m = QB.module(cid, mid);
    var t = m.topics[tid] || (m.topics[tid] = { id: tid, course: cid, module: mid, types: [], order: Object.keys(m.topics).length + 1 });
    Object.assign(t, o || {});
    t.key = cid + '.' + mid + '.' + tid;
    return t;
  };
  QB.getTopic = function (cid, mid, tid) {
    var c = QB.courses[cid]; if (!c) return null;
    var m = c.modules[mid]; if (!m) return null;
    return m.topics[tid] || null;
  };
  QB.add = function (t) {
    if (!t || !t.id || typeof t.gen !== 'function') { QB.warnings.push('QB.add: bad type ' + (t && t.id)); return; }
    if (QB.byId[t.id]) { QB.warnings.push('QB.add: duplicate id ' + t.id); return; }
    var tp = QB.getTopic(t.course, t.module, t.topic);
    if (!tp) {
      QB.warnings.push('QB.add: unknown topic ' + t.course + '.' + t.module + '.' + t.topic + ' for ' + t.id + ' (placed in "Other")');
      tp = QB.topic(t.course, t.module || 'other', t.topic || 'other', { title: 'Other', order: 99 });
    }
    t.difficulty = t.difficulty || 2;
    t.marks = t.marks || 0;
    t.tags = t.tags || [];
    t.variants = t.variants || [];
    t.order = tp.types.length;
    tp.types.push(t);
    QB.types.push(t);
    QB.byId[t.id] = t;
    return t;
  };
  function sorted(obj) { return Object.keys(obj).map(function (k) { return obj[k]; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  /** QB.tree() -> [{course, modules:[{module, topics:[topic]}]}] sorted by order */
  QB.tree = function () {
    return sorted(QB.courses).map(function (c) {
      return { course: c, modules: sorted(c.modules).map(function (m) { return { module: m, topics: sorted(m.topics) }; }) };
    });
  };
  QB.topicOf = function (t) { return QB.getTopic(t.course, t.module, t.topic); };

  /* ------------------------------------------------------------ RNG */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var ESER = {
    E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
    E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
    E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
  };
  QB.ESERIES = ESER;
  function clean(x) { return parseFloat(x.toPrecision(12)); }
  QB.eseriesList = function (series, min, max) {
    var base = ESER[series] || ESER.E12, out = [];
    var d0 = Math.floor(Math.log10(min)) - 1, d1 = Math.ceil(Math.log10(max)) + 1;
    for (var d = d0; d <= d1; d++) for (var i = 0; i < base.length; i++) {
      var v = clean(base[i] * Math.pow(10, d));
      if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(v);
    }
    return out;
  };
  QB.rng = function (seed) {
    var f = mulberry32((seed >>> 0) ^ 0xA5A5A5A5);
    for (var i = 0; i < 4; i++) f();
    var r = {
      seed: seed,
      next: f,
      int: function (a, b) { return a + Math.floor(f() * (b - a + 1)); },
      float: function (a, b, dp) { var x = a + f() * (b - a); dp = dp == null ? 2 : dp; return clean(Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp)); },
      pick: function (arr) { return arr[Math.floor(f() * arr.length)]; },
      pickw: function (pairs) {
        var tot = 0, i; for (i = 0; i < pairs.length; i++) tot += pairs[i][0];
        var x = f() * tot; for (i = 0; i < pairs.length; i++) { x -= pairs[i][0]; if (x < 0) return pairs[i][1]; }
        return pairs[pairs.length - 1][1];
      },
      shuffle: function (arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(f() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
      bool: function (p) { return f() < (p == null ? 0.5 : p); },
      sign: function () { return f() < 0.5 ? -1 : 1; },
      eseries: function (series, min, max) {
        var l = QB.eseriesList(series, min, max);
        if (!l.length) throw new Error('eseries: no ' + series + ' value in [' + min + ',' + max + ']');
        return l[Math.floor(f() * l.length)];
      },
      cap: function (min, max) { return r.eseries('E6', min, max); },
      nice: function (a, b, step) { var n = Math.floor((b - a) / step + 1e-9); return clean(a + step * Math.floor(f() * (n + 1))); },
      retry: function (fn, n) {
        n = n || 50;
        for (var i = 0; i < n; i++) { var v = fn(i); if (v !== null && v !== undefined && v !== false) return v; }
        throw new Error('r.retry: no valid instance after ' + n + ' tries');
      }
    };
    return r;
  };
  QB.newSeed = function () { return 1 + Math.floor(Math.random() * 999998); };

  /* ------------------------------------------------------------ make / validate */
  QB.resolveVariant = function (t, seed, variant) {
    if (!t.variants || !t.variants.length) return null;
    if (variant && t.variants.some(function (v) { return v.id === variant; })) return variant;
    var vr = QB.rng((seed >>> 0) ^ 0x5bd1e995);
    return vr.pickw(t.variants.map(function (v) { return [v.weight == null ? 1 : v.weight, v.id]; }));
  };
  QB.make = function (typeOrId, seed, variant) {
    var t = typeof typeOrId === 'string' ? QB.byId[typeOrId] : typeOrId;
    if (!t) throw new Error('QB.make: unknown type ' + typeOrId);
    seed = (seed == null ? QB.newSeed() : seed) >>> 0;
    var vid = QB.resolveVariant(t, seed, variant);
    var r = QB.rng(seed);
    // gen may return null to reject an instance: redraw from the same RNG stream (deterministic per seed)
    var q = r.retry(function () { return t.gen(r, vid); }, 400);
    q.seed = seed; q.variant = vid; q.typeId = t.id; q.type = t;
    q.parts = (q.parts || []).map(function (p) {
      p.answers = (p.answers || []).map(function (a) {
        if (a.tol == null) a.tol = 0.02;
        if (a.sig == null) a.sig = 3;
        if (a.unit == null) a.unit = '';
        return a;
      });
      return p;
    });
    q.given = q.given || [];
    return q;
  };
  var BAD = /NaN|undefined|Infinity/;
  QB.validate = function (q) {
    var errs = [];
    function txt(name, s) { if (s != null && typeof s !== 'string') errs.push(name + ' is not a string'); else if (s && BAD.test(s.replace(/<svg[\s\S]*?<\/svg>/g, ''))) errs.push(name + ' contains ' + s.match(BAD)[0]); }
    txt('stem', q.stem);
    if (!q.stem) errs.push('empty stem');
    if (q.figure != null && q.figure !== '') {
      if (typeof q.figure !== 'string' || q.figure.trim().indexOf('<svg') !== 0) errs.push('figure is not an <svg> string');
      else if (BAD.test(q.figure)) errs.push('figure contains ' + q.figure.match(BAD)[0]);
    }
    (q.given || []).forEach(function (g, i) { txt('given[' + i + ']', String(g[0]) + ' ' + String(g[1])); });
    if (!q.parts || !q.parts.length) errs.push('no parts');
    (q.parts || []).forEach(function (p, i) {
      txt('part ' + i + ' q', p.q); txt('part ' + i + ' working', p.working);
      if (!p.working) errs.push('part ' + i + ' has no working');
      (p.answers || []).forEach(function (a, j) {
        if (typeof a.value !== 'number' || !isFinite(a.value)) errs.push('part ' + i + ' answer ' + j + ' (' + a.label + ') not finite: ' + a.value);
        if (!(a.tol >= 0)) errs.push('part ' + i + ' answer ' + j + ' bad tol');
      });
    });
    txt('notes', q.notes);
    return errs;
  };

  /* ------------------------------------------------------------ formatting */
  var PREF = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  function stripZeros(s) { return s.indexOf('.') >= 0 && s.indexOf('e') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }
  function toSig(x, sig, keep) {
    if (x === 0) return '0';
    var s = Number(x).toPrecision(sig);
    if (s.indexOf('e') >= 0) s = String(Number(s));   // expand when small exponent
    if (s.indexOf('e') >= 0) return s;
    return keep ? s : stripZeros(s);
  }
  var SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  function engSplit(x) {
    var ax = Math.abs(x);
    if (ax === 0 || !isFinite(ax)) return [x, ''];
    for (var i = 0; i < PREF.length; i++) {
      if (ax >= PREF[i][0] * 0.99995) return [x / PREF[i][0], PREF[i][1]];
    }
    return [x / 1e-15, 'f'];
  }
  // units that never take an SI prefix
  var NOPREFIX = { '%': 1, '°': 1, 'deg': 1, 'pu': 1, 'rpm': 1, 'r/min': 1, '': 0, 'dB': 1, 'rad/s': 0 };
  ['cm⁻³','cm^-3','cm-3','/cm³','cm/s','V/cm','cm²/Vs','cm²/(V·s)','Ω·cm','S/cm','m⁻³','cm','V²','m³'].forEach(function (u) { NOPREFIX[u] = 1; });
  var fmt = QB.fmt = {};
  fmt.num = function (x, sig, keep) {
    sig = sig || 3;
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    var e = Math.floor(Math.log10(Math.abs(x)));
    if (e >= 6 || e < -4) {
      var m = x / Math.pow(10, e); var ms = toSig(m, sig, keep);
      if (Math.abs(parseFloat(ms)) >= 10) { e += 1; ms = toSig(x / Math.pow(10, e), sig, keep); }
      return ms + '×10' + String(e).split('').map(function (c) { return SUP[c]; }).join('');
    }
    return toSig(x, sig, keep).replace(/^-/, '−');
  };
  fmt.fix = function (x, dp) { return Number(x).toFixed(dp == null ? 2 : dp).replace(/^-/, '−'); };
  fmt.eng = function (x, unit, sig, keep) {
    unit = unit == null ? '' : unit; sig = sig || 3;
    if (!isFinite(x)) return String(x);
    if (unit === 'm²') return fmt.num(x * 1e6, sig, keep) + ' mm²';
    if (NOPREFIX[unit] === 1) return fmt.num(x, sig, keep) + (unit === '°' ? '°' : (unit ? ' ' + unit : ''));
    var s = engSplit(x); var m = s[0], p = s[1];
    var ms = toSig(m, sig, keep);
    if (Math.abs(parseFloat(ms)) >= 1000 && p !== 'T') { s = engSplit(parseFloat(ms) * (x / m)); m = s[0]; p = s[1]; ms = toSig(m, sig, keep); }
    ms = ms.replace(/^-/, '−');
    return ms + ((p || unit) ? ' ' + p + unit : '');
  };
  fmt.r = fmt.ohm = function (x, sig) { return fmt.eng(x, 'Ω', sig || 3); };
  function texUnit(u) {
    if (!u) return '';
    var out = '', run = '';
    function flush() { if (run) { out += '\\text{' + run + '}'; run = ''; } }
    for (var i = 0; i < u.length; i++) {
      var ch = u[i];
      if (ch === 'µ' || ch === 'μ') { flush(); out += '\\mu '; }
      else if (ch === 'Ω') { flush(); out += '\\Omega'; }
      else if (ch === '°') { flush(); out += '^\\circ'; }
      else if (ch === '%') { flush(); out += '\\%'; }
      else if (ch === '·') { flush(); out += '\\cdot'; }
      else run += ch;
    }
    flush();
    return out;
  }
  fmt.tex = {};
  fmt.tex.unit = texUnit;
  fmt.tex.num = function (x, sig, keep) {
    sig = sig || 3;
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    var e = Math.floor(Math.log10(Math.abs(x)));
    if (e >= 6 || e < -4) {
      var ms = toSig(x / Math.pow(10, e), sig, keep);
      if (Math.abs(parseFloat(ms)) >= 10) { e += 1; ms = toSig(x / Math.pow(10, e), sig, keep); }
      return ms + '\\times10^{' + e + '}';
    }
    return toSig(x, sig, keep);
  };
  fmt.tex.eng = function (x, unit, sig, keep) {
    unit = unit == null ? '' : unit; sig = sig || 3;
    if (!isFinite(x)) return String(x);
    if (unit === '°') return fmt.tex.num(x, sig, keep) + '^\\circ';
    if (unit === 'm²') return fmt.tex.num(x * 1e6, sig, keep) + '\\ \\text{mm}^2';
    if (NOPREFIX[unit] === 1) return fmt.tex.num(x, sig, keep) + '\\ ' + texUnit(unit);
    var s = engSplit(x); var ms = toSig(s[0], sig, keep);
    if (Math.abs(parseFloat(ms)) >= 1000) { var s2 = engSplit(parseFloat(ms) * (x / s[0])); s = s2; ms = toSig(s[0], sig, keep); }
    var pu = s[1] + unit;
    return ms + (pu ? '\\,' + texUnit(pu) : '');
  };
  fmt.tex.frac = function (a, b) { return '\\frac{' + a + '}{' + b + '}'; };
  fmt.tex.ang = function (deg, dp) { return Number(deg).toFixed(dp == null ? 2 : dp) + '^\\circ'; };
  fmt.tex.pi = function (x, sig) {
    var k = x / Math.PI; var s = toSig(k, sig || 3);
    if (s === '0') return '0'; if (s === '1') return '\\pi'; if (s === '-1') return '-\\pi';
    return s + '\\pi';
  };
  fmt.phasor = function (re, im, sig) {
    var z = (re && typeof re === 'object') ? re : QB.cx(re, im);
    if (re && typeof re === 'object') sig = im;
    sig = sig || 4;
    var a = z.argd(); if (Math.abs(a) < 5e-13) a = 0;
    return toSig(z.abs(), sig) + '\\angle ' + toSig(a, sig) + '^\\circ';
  };
  fmt.cx = function (re, im, sig) {
    var z = (re && typeof re === 'object') ? re : QB.cx(re, im);
    if (re && typeof re === 'object') sig = im;
    sig = sig || 4;
    var a = z.re, b = z.im;
    var rs = Math.abs(a) < 1e-12 ? '' : toSig(a, sig);
    if (Math.abs(b) < 1e-12) return rs || '0';
    var bs = toSig(Math.abs(b), sig);
    if (!rs) return (b < 0 ? '-' : '') + 'j' + bs;
    return rs + (b < 0 ? ' - ' : ' + ') + 'j' + bs;
  };

  /* ------------------------------------------------------------ complex */
  function Cx(re, im) { this.re = re; this.im = im || 0; }
  function C(z) { return z instanceof Cx ? z : new Cx(+z, 0); }
  Cx.prototype = {
    add: function (b) { b = C(b); return new Cx(this.re + b.re, this.im + b.im); },
    sub: function (b) { b = C(b); return new Cx(this.re - b.re, this.im - b.im); },
    mul: function (b) { b = C(b); return new Cx(this.re * b.re - this.im * b.im, this.re * b.im + this.im * b.re); },
    div: function (b) { b = C(b); var d = b.re * b.re + b.im * b.im; return new Cx((this.re * b.re + this.im * b.im) / d, (this.im * b.re - this.re * b.im) / d); },
    abs: function () { return Math.hypot(this.re, this.im); },
    arg: function () { return Math.atan2(this.im, this.re); },
    argd: function () { return Math.atan2(this.im, this.re) * 180 / Math.PI; },
    conj: function () { return new Cx(this.re, -this.im); },
    inv: function () { return new Cx(1, 0).div(this); },
    neg: function () { return new Cx(-this.re, -this.im); },
    scale: function (k) { return new Cx(this.re * k, this.im * k); },
    toString: function () { return fmt.cx(this); }
  };
  QB.cx = function (re, im) { return new Cx(re, im); };
  QB.cx.Cx = Cx;
  QB.cx.polar = function (mag, deg) { var a = deg * Math.PI / 180; return new Cx(mag * Math.cos(a), mag * Math.sin(a)); };
  QB.cx.par = function () { var s = new Cx(0, 0); for (var i = 0; i < arguments.length; i++) s = s.add(C(arguments[i]).inv()); return s.inv(); };
  QB.par = function () { var s = 0; for (var i = 0; i < arguments.length; i++) s += 1 / arguments[i]; return 1 / s; };
  QB.deg = function (rad) { return rad * 180 / Math.PI; };
  QB.rad = function (deg) { return deg * Math.PI / 180; };
  QB.units = { VT: 0.026, VBE: 0.7, VBEge: 0.3, VCEsat: 0.2 };

  /* ------------------------------------------------------------ parsing / checking */
  var PFX = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };
  QB.parse = function (s, unit) {
    if (s == null) return NaN;
    s = String(s).trim().replace(/[−–]/g, '-').replace(/\s+/g, ' ').replace(/×\s*10\^?/g, 'e').replace(/\*\s*10\^/g, 'e');
    if (!s) return NaN;
    var m;
    // resistor code 4k7, 2M2, 4R7
    if ((m = s.match(/^([+-]?\d+)([kKMmRr])(\d+)\s*(Ω|ohms?)?$/))) {
      var mult = /[Rr]/.test(m[2]) ? 1 : PFX[m[2]];
      return parseFloat(m[1] + '.' + m[3]) * mult;
    }
    // multiples of pi: 0.8pi, -pi/2, 2π/3, pi
    var ps = s.replace(/π/g, 'pi');
    if (/pi/.test(ps)) {
      if ((m = ps.match(/^([+-]?)(\d*\.?\d*)\s*\*?\s*pi\s*(?:\/\s*(\d+\.?\d*))?\s*(rad)?$/))) {
        var k = m[2] === '' ? 1 : parseFloat(m[2]); if (isNaN(k)) return NaN;
        var v = k * Math.PI / (m[3] ? parseFloat(m[3]) : 1);
        return m[1] === '-' ? -v : v;
      }
      return NaN;
    }
    // fraction a/b
    if ((m = s.match(/^([+-]?\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/))) return parseFloat(m[1]) / parseFloat(m[2]);
    m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
    if (!m) return NaN;
    var x = parseFloat(m[1]); var suf = m[2].trim();
    if (!suf) return x;
    var u = (unit || '').trim();
    var ul = u.toLowerCase();
    // strip the unit (case-insensitive, also common spellings)
    var sl = suf.replace(/ohms?$/i, 'Ω').replace(/deg(rees)?$/i, '°');
    if (u && (sl === u || sl.toLowerCase() === ul)) return x;
    if (u && sl.length > u.length && (sl.slice(-u.length) === u || sl.slice(-u.length).toLowerCase() === ul)) sl = sl.slice(0, -u.length).trim();
    else if (/^[fpnuµμmkKMGT]?(Ω|V|A|W|F|H|Hz|VA|VAr|var|s|rad|rpm|°|%|N·?m|Wb|T|J)$/.test(sl)) sl = sl.replace(/(Ω|V|A|W|F|H|Hz|VA|VAr|var|s|rad|rpm|°|%|N·?m|Wb|T|J)$/, '');
    if (sl === '') return x;
    if (sl.length === 1 && PFX[sl] != null) return x * PFX[sl];
    if (sl === '%' ) return x;
    return NaN;
  };
  QB.checkAnswer = function (a, text) {
    var v = QB.parse(text, a.unit);
    if (!isFinite(v)) return { ok: false, val: v, msg: 'Could not read a number' };
    var vals = [a.value].concat(a.alt || []);
    for (var i = 0; i < vals.length; i++) {
      var t = vals[i];
      var tol = Math.max(Math.abs(t) * (a.tol == null ? 0.02 : a.tol), a.abs || 0, t === 0 ? 1e-9 : 0);
      if (Math.abs(v - t) <= tol + 1e-15) return { ok: true, val: v };
      // percent typed as a fraction or vice versa is NOT accepted silently
    }
    return { ok: false, val: v, msg: '' };
  };
  QB.answerText = function (a) {
    if (a.unit === 'rad' && a.showPi !== false) return QB.fmt.num(a.value / Math.PI, a.sig) + 'π rad';
    if (!a.unit) return QB.fmt.num(a.value, a.sig);          // dimensionless: never an SI prefix (0.7, not "700 m")
    return QB.fmt.eng(a.value, a.unit, a.sig);
  };

  /* ------------------------------------------------------------ html helpers */
  QB.steps = function (arr) { return '<ol class="qb-steps">' + arr.filter(Boolean).map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>'; };
  QB.final = function (tex) { return '<div class="qb-final">$$\\boxed{' + tex + '}$$</div>'; };
  QB.callout = function (kind, html) { return '<div class="qb-callout ' + kind + '"><p>' + html + '</p></div>'; };
  QB.tbl = function (head, rows) {
    var h = head ? '<thead><tr>' + head.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead>' : '';
    return '<div class="qb-tbl"><table>' + h + '<tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  };
  QB.esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  /* ============================================================ COURSE TREE */
  QB.course('mach', { title: 'Electrical Machines', code: 'ENGE X300', colour: '#a85a18', short: 'Machines' });
  QB.course('dsp', { title: 'Digital Signal Processing', code: 'ENGE3000', colour: '#215f9f', short: 'DSP' });
  QB.course('edc', { title: 'Electronic Devices and Circuits', code: 'ENGE2003', colour: '#2b7552', short: 'EDC' });

  function tree(cid, mods) {
    mods.forEach(function (m, i) {
      QB.module(cid, m[0], { title: m[1], order: i + 1, span: m[2] });
      m[3].forEach(function (t, j) { QB.topic(cid, m[0], t[0], { title: t[1], order: j + 1, pack: t[2] }); });
    });
  }
  tree('mach', [
    ['ac', 'Module 1 · AC power', 'Ch1–2', [
      ['power', 'Power and efficiency', 'M1'],
      ['phasor', 'Phasors and complex power', 'M1'],
      ['pfc', 'Power-factor correction', 'M2'],
      ['3ph', 'Three-phase star and delta', 'M2'],
      ['dc', 'DC source and battery models', 'M2']]],
    ['mag', 'Module 2 · Magnetics and transformers', 'Ch3', [
      ['magcct', 'Magnetic circuits', 'M3'],
      ['energy', 'Inductance, energy and force', 'M3'],
      ['ironloss', 'Iron loss', 'M3'],
      ['ideal', 'Ideal transformer and referral', 'M4'],
      ['eqcct', 'Equivalent circuit and tests', 'M4'],
      ['regeff', 'Regulation and efficiency', 'M5'],
      ['tx3ph', 'Three-phase transformers', 'M5']]],
    ['basics', 'Module 3 · Machine basics and DC machines', 'Ch4–6', [
      ['speed', 'Speed, poles and τ–n curves', 'M6'],
      ['dcm', 'DC machines', 'M6'],
      ['rmf', 'Rotating magnetic fields', 'M6']]],
    ['im', 'Module 4 · Induction machines', 'Ch7', [
      ['slip', 'Slip and power flow', 'M7'],
      ['eqcct', 'Equivalent-circuit performance', 'M7,M9'],
      ['tests', 'No-load and blocked-rotor tests', 'M8'],
      ['tmax', 'Maximum torque and external rotor resistance', 'M8'],
      ['vf', 'V/f speed control', 'M8'],
      ['gen', 'Generator mode', 'M8']]],
    ['sync', 'Module 5 · Synchronous machines and per-unit', 'Ch8', [
      ['pu', 'Per-unit', 'M10'],
      ['xs', 'Synchronous reactance from OC/SC tests', 'M10'],
      ['phasor', 'Phasors, E0 and δ', 'M11'],
      ['pangle', 'Power–angle and stability limit', 'M11'],
      ['pfc', 'PFC with a synchronous motor', 'M11']]]
  ]);
  tree('dsp', [
    ['sig', 'Signals and systems', 'L02–L04', [
      ['sampling', 'Sampling and aliasing', 'D1'],
      ['seq', 'Sequences, periodicity and energy', 'D1'],
      ['adc', 'Quantisation and the ADC', 'D1'],
      ['props', 'System properties', 'D1'],
      ['corr', 'Correlation', 'D1'],
      ['lccde', 'LCCDEs: modes, recursion and h(n)', 'D2'],
      ['conv', 'Convolution', 'D2']]],
    ['freq', 'Frequency analysis', 'L05–L06', [
      ['dtft', 'DTFT and standard pairs', 'D3'],
      ['dtftprop', 'DTFT properties and shortcuts', 'D3'],
      ['freqresp', 'Frequency response H(ω)', 'D4'],
      ['pzgeom', 'Pole-zero geometry', 'D4'],
      ['dft', 'The DFT and IDFT', 'D5'],
      ['circconv', 'Circular and linear convolution via the DFT', 'D5'],
      ['spectral', 'Spectral analysis: Fs, N, T0 and windows', 'D6'],
      ['block', 'Block convolution: overlap-add and overlap-save', 'D6']]],
    ['z', 'z-domain', 'L07–L08', [
      ['zt', 'z-transform and ROC', 'D7'],
      ['zprop', 'z-transform properties and interconnections', 'D7'],
      ['invz', 'Inverse z-transform', 'D8'],
      ['stab', 'Transfer function, causality and stability', 'D8'],
      ['unilat', 'Unilateral z-transform and initial conditions', 'D9']]],
    ['filt', 'Filters', 'L09–L10', [
      ['pzdesign', 'Pole-zero design: FIR, notch and comb', 'D10'],
      ['linphase', 'Linear phase and group delay', 'D10,D12'],
      ['inverse', 'Inverse systems', 'D10'],
      ['bilinear', 'Bilinear transform and prewarping', 'D11'],
      ['butter', 'Butterworth design', 'D11'],
      ['cheby', 'Chebyshev order and ripple', 'D12'],
      ['fir', 'Window-method FIR design', 'D12']]]
  ]);
  tree('edc', [
    ['diode', 'Module 1 · Diodes', 'Weeks 1–2', [
      ['semi', 'Semiconductor physics and circuit tools', 'E1'],
      ['models', 'Shockley equation and diode models', 'E2'],
      ['dcct', 'Diode circuits: assume and verify', 'E2'],
      ['rect', 'Rectifiers and capacitor filters', 'E3'],
      ['zener', 'Zener regulators', 'E3'],
      ['clip', 'Clippers and clampers', 'E3']]],
    ['bjt', 'Module 2 · BJTs', 'Weeks 3–5', [
      ['modes', 'Currents and operating modes', 'E4'],
      ['bias', 'DC bias: fixed, emitter and voltage divider', 'E4'],
      ['bias2', 'DC bias II: other configurations, pnp and design', 'E5'],
      ['ss', 'Small-signal: r_e model and CE amplifiers', 'E6'],
      ['ss2', 'Small-signal: every configuration and loading', 'E7'],
      ['multi', 'Multistage, Darlington and current mirrors', 'E8']]],
    ['fet', 'Module 3 · FETs', 'Weeks 6–8', [
      ['devices', 'FET devices and Shockley’s equation', 'E9'],
      ['bias', 'FET DC bias', 'E10'],
      ['ss', 'Small-signal: g_m, r_d and common source', 'E11'],
      ['ss2', 'Source follower, common gate and loading', 'E12']]],
    ['amp', 'Module 4 · Op-amps and power amplifiers', 'Weeks 9–10', [
      ['diff', 'Differential amplifiers and CMRR', 'E13'],
      ['opamp', 'Ideal op-amp circuits', 'E13'],
      ['power', 'Power amplifiers: class A and B', 'E13']]]
  ]);
})(typeof window !== 'undefined' ? window : globalThis);

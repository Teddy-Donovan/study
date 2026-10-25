/* qb-sch.js — SVG schematic library (global `QB.sch`)
 * =============================================================================
 * Black-on-white textbook schematics as SVG strings. Every figure gets a white
 * background, a viewBox fitted to its content, and labels placed with a simple
 * collision check so they never sit on wires, parts or each other.
 *
 * LABEL MARKUP (all `label`/`sym` strings): TeX-lite.  R_1  V_{CC}  R_2'  z^{-1}
 *   \beta \omega \Omega \phi \delta \tau \mu \pi \theta \alpha \Delta \infty \cdot
 *   \times \pm \Phi \lambda \mathcal{R} (-> ℛ).  Latin letters in symbols are
 *   italic, subscripts upright. `value` strings are upright plain text ("62 kΩ").
 *
 * LOW LEVEL  const d = QB.sch.drawing();   coordinates in px (10-px grid; default
 *   two-terminal length 60). Points are [x,y]; y grows downward.
 *   Two-terminal parts (all take {from|at, to | dir:'right'|'left'|'up'|'down', len,
 *     label, value, side:'left'|'right'|'top'|'bottom', flip, labelStyle:'stack'|'line'}):
 *     d.resistor d.capacitor({polar}) d.inductor d.vsrc({style:'circle'|'battery'})
 *     d.acsrc d.isrc d.depV d.depI d.diode d.zener d.led d.meter({kind:'V'|'A'|'W'})
 *     d.switch({closed}) d.coil
 *     Each returns {start, end, mid, a, b} and moves the cursor d.here to `end`.
 *     Direction convention: + of a source, the arrow of isrc/depI and the cathode of
 *     a diode are at the `end` side (so dir:'up' puts + at the top).
 *   Three-terminal: d.bjt({at, anchor:'base'|'collector'|'emitter'|'center', type:'npn'|'pnp',
 *     flipX, flipY, rot:0|90|180|270, circle:true, label, value}) -> {base, collector, emitter, center}
 *     d.jfet({type:'n'|'p', ...same}) -> {gate, drain, source}
 *     d.mosfet({type:'nE'|'pE'|'nD'|'pD', ...}) -> {gate, drain, source}
 *     d.opamp({at, anchor:'out'|'inv'|'noninv'|'center', plusTop:false, supplies:false, label})
 *       -> {inv, noninv, out, vpos, vneg}
 *     d.transformer({at (top-left pin), h:70, dots:'same'|'opposite'|false, core:true, n1, n2, w:70})
 *       -> {p1, p2, s1, s2}
 *   Symbols: d.ground(p,{lead}) d.rail(p,{label, value, dir:'up'|'down'}) d.dot(p) / d.node(p)
 *     d.terminal(p,{label, side}) d.label(p, markup, {anchor:'start'|'middle'|'end', size, italic, valign})
 *     d.labelNear(p, markup, {prefer:['right','left','top','bottom'], gap}) (collision-checked)
 *     d.current({at, dir, label, side, onWire, len}) current arrow beside (or on) a wire
 *     d.polarity({a, b, label, side}) "+ label −" voltage marking
 *     d.wire({from, to, path:'-|'|'|-'|'straight', pts:[[x,y]..], arrow:'end'|'start'|'both', dash})
 *     d.line(p1, p2, ...) shorthand straight polyline
 *   Blocks (DSP): d.box({at, anchor:'in'|'center', w, h, label}) -> {in,out,top,bottom,center}
 *     d.gain({at, k, dir:'right'}) -> {in,out}   d.sum({at, r, signs:{left:'+',bottom:'−'}}) -> {left,right,top,bottom}
 *   Raw: d.rect(x,y,w,h,{fill,dash}) d.circle(cx,cy,r,{fill}) d.path(dstring,bbox) d.poly(pts,{closed,fill})
 *   d.svg({scale:1.25, title}) -> '<svg ...>' string
 *
 * HIGH-LEVEL TEMPLATES  QB.sch.<name>(opts) -> svg string. See QB.sch.catalog for
 * every name, its option keys and sample values (tests/gallery.html renders them).
 * Option value conventions (all templates):
 *   key absent / false  -> optional part not drawn (mandatory parts show the symbol only)
 *   key: true           -> part drawn with its symbol only (e.g. CE:true)
 *   key: '62 kΩ'        -> symbol + value text;  key: 62000 -> value auto-formatted (Ω, F, H, V)
 *   key: {label:'R_B', value:'240 kΩ'} -> custom symbol
 *   labels: {RC:'R_D'}  -> override default symbols;  values:false -> symbols only
 *   nodes:true          -> node dots + node-voltage labels (V_B, V_C, V_E ...)
 * Markup note: in a symbol label, anything after "= <number>" is upright ("f_s = 8 kHz", "V_P = −6 V").
 * Template groups (see QB.sch.catalog for keys): BJT, FET, Diodes (diodeSeriesString, diodeParallel, halfWave,
 *   centreTap, bridge, zenerShunt, clipperSeries, clipperShunt, clamper), Op-amp/power (opInverting, opNonInverting,
 *   opSumming, opFollower, diffPair, classA, classATransformer, classBPushPull), AC (seriesRLC, parallelRL, parallelRC,
 *   loadWithPFCap, starLoad, deltaLoad, batteryModel), Machines (transformerEquiv, ocTest, scTest, imPerPhase,
 *   imTestNoLoad, imTestBlocked, dcMachine, syncModel), DSP (blockCascade, blockParallel, blockFeedback,
 *   directFormI, directFormII, adcChain), Magnetics (magCore, reluctanceCircuit).
 * Helpers for custom figures: S._run(d, [spec..], a, b, side) places element specs {k:'R'|'L'|'C'|'Z'|'D'|'ZD'|'LED'|
 *   'V'|'B'|'AC'|'I'|'SW', label, value, rev} along a straight run; S._loop(d, o, srcSpec, top, right) draws a series loop.
 *   currents:true       -> current arrows (I_B, I_C, I_E ...)
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB = G.QB || {};
  var S = QB.sch = {};
  var INK = '#111';
  var SW = 1.7;
  var FS = 13, FSS = 9.5;
  var FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
  S.style = { ink: INK, stroke: SW, font: FONT, size: FS };

  /* ---------------------------------------------------------- text metrics (Arial, /1000 em) */
  var AW = {
    ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
    '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
    A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
    '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333,
    a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
    '{': 334, '|': 260, '}': 334, '~': 584,
    'β': 575, 'ω': 690, 'Ω': 768, 'π': 570, 'φ': 650, 'Φ': 780, 'δ': 556, 'τ': 450, 'µ': 576, 'μ': 576, 'θ': 556, 'α': 578, 'λ': 500, 'Δ': 668, '∞': 712, '−': 584, '×': 584, '°': 400, '·': 278, '±': 584,
    '′': 190, '→': 1000, 'ℛ': 820, 'σ': 600, 'γ': 500, 'ε': 450, 'η': 556, 'ρ': 570, 'ψ': 700, 'Σ': 650, 'ϕ': 650, '…': 1000, '≈': 584, '≤': 584, '≥': 584
  };
  function cw(ch) { return (AW[ch] != null ? AW[ch] : 600) / 1000; }
  var GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'µ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', psi: 'ψ', omega: 'ω',
    Delta: 'Δ', Omega: 'Ω', Phi: 'Φ', Sigma: 'Σ', infty: '∞', cdot: '·', times: '×', pm: '±', to: '→', circ: '°', approx: '≈', le: '≤', ge: '≥', prime: '′', angle: '∠', ldots: '…', minus: '−' };

  /** parse TeX-lite markup into runs [{t, lvl:0|-1|1, it}] */
  function parseMarkup(str, italic) {
    var runs = [];
    str = String(str == null ? '' : str);
    str = str.replace(/\\mathcal\{R\}/g, 'ℛ').replace(/\\mathrm\{([^}]*)\}/g, '\u0001$1\u0002').replace(/\\text\{([^}]*)\}/g, '\u0001$1\u0002');
    // a value after "= <number>" is upright (units are never italic): "f_s = 8 kHz"
    if (italic) str = str.replace(/(=\s*)([−\-+]?\d[^\u0001\u0002]*)$/, function (_, a, b) { return a + '\u0001' + b + '\u0002'; });
    var i = 0, roman = 0;
    function push(t, lvl) {
      if (!t) return;
      for (var k = 0; k < t.length; k++) {
        var ch = t[k];
        if (ch === '\u0001') { roman++; continue; }
        if (ch === '\u0002') { roman = Math.max(0, roman - 1); continue; }
        var it = !!(italic && lvl === 0 && !roman && /[A-Za-zα-ωϕ]/.test(ch) && ch !== 'Ω' && ch !== 'Δ' && ch !== 'Σ' && ch !== 'Φ');
        var last = runs[runs.length - 1];
        if (last && last.lvl === lvl && last.it === it) last.t += ch; else runs.push({ t: ch, lvl: lvl, it: it });
      }
    }
    function readGroup() {
      if (str[i] === '{') {
        var depth = 1, j = i + 1;
        while (j < str.length && depth) { if (str[j] === '{') depth++; else if (str[j] === '}') depth--; j++; }
        var g = str.slice(i + 1, j - 1); i = j; return g;
      }
      if (str[i] === '\\') { var m = str.slice(i).match(/^\\([A-Za-z]+)/); if (m) { i += m[0].length; return GREEK[m[1]] || m[1]; } }
      var c = str[i]; i++; return c || '';
    }
    function expand(g) { return g.replace(/\\([A-Za-z]+)\s?/g, function (_, n) { return GREEK[n] != null ? GREEK[n] : n; }).replace(/-/g, '−'); }
    while (i < str.length) {
      var ch = str[i];
      if (ch === '_' || ch === '^') {
        i++; var g = readGroup();
        push(expand(g), ch === '_' ? -1 : 1);
        continue;
      }
      if (ch === '\\') {
        var m = str.slice(i).match(/^\\([A-Za-z]+)\s?/);
        if (m) { i += m[0].length; push(GREEK[m[1]] != null ? GREEK[m[1]] : m[1], 0); continue; }
        if (str[i + 1] === ',' || str[i + 1] === ' ') { i += 2; push(' ', 0); continue; }
      }
      if (ch === "'") { i++; push('′', 0); continue; }
      if (ch === '{' || ch === '}') { i++; continue; }
      if (ch === '-' && italic) { i++; push('−', 0); continue; }
      push(ch, 0); i++;
    }
    return runs;
  }
  function runsWidth(runs, fs) {
    var w = 0;
    runs.forEach(function (r) { var f = r.lvl ? fs * 0.73 : fs; for (var k = 0; k < r.t.length; k++) w += cw(r.t[k]) * f; if (r.it) w += 0.02 * f; });
    return w;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function r2(x) { return Math.round(x * 100) / 100; }
  /** a "line" = array of runs; makeLine(sym, value) => runs for "sym" or "value" or "sym = value" */
  function lineRuns(sym, val, joiner) {
    var runs = [];
    if (sym != null && sym !== '') runs = runs.concat(parseMarkup(sym, true));
    if (val != null && val !== '') {
      if (runs.length) runs.push({ t: joiner == null ? ' = ' : joiner, lvl: 0, it: false });
      runs = runs.concat(parseMarkup(String(val).replace(/-/g, '−'), false));
    }
    return runs;
  }
  function textSVG(lines, x, y, anchor, fs) {
    // lines: array of runs-arrays; (x,y) = anchor point of the box's top line baseline
    fs = fs || FS;
    var out = '';
    var lh = fs * 1.22;
    lines.forEach(function (runs, li) {
      var w = runsWidth(runs, fs);
      var x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
      var by = y + li * lh;
      var s = '<text x="' + r2(x0) + '" y="' + r2(by) + '" font-size="' + fs + '">';
      var cur = 0;
      runs.forEach(function (r) {
        var target = r.lvl === -1 ? fs * 0.32 : r.lvl === 1 ? -fs * 0.42 : 0;
        var dy = target - cur; cur = target;
        s += '<tspan' + (dy ? ' dy="' + r2(dy) + '"' : '') + (r.lvl ? ' font-size="' + r2(fs * 0.73) + '"' : '') + (r.it ? ' font-style="italic"' : '') + '>' + esc(r.t).replace(/ /g, '&#160;') + '</tspan>';
      });
      s += '</text>';
      out += s;
    });
    return out;
  }
  function linesBox(lines, fs) {
    fs = fs || FS;
    var w = 0; lines.forEach(function (l) { w = Math.max(w, runsWidth(l, fs)); });
    var hasSub = lines.length && lines[lines.length - 1].some(function (r) { return r.lvl === -1; });
    var hasSup = lines.length && lines[0].some(function (r) { return r.lvl === 1; });
    var h = fs * 0.74 + (lines.length - 1) * fs * 1.22 + (hasSub ? fs * 0.3 : fs * 0.06);
    return { w: w, h: h, asc: fs * 0.74 + (hasSup ? fs * 0.25 : 0), sup: hasSup };
  }
  S._parse = parseMarkup; S._width = function (m, fs) { return runsWidth(parseMarkup(m, true), fs || FS); };

  /* ---------------------------------------------------------- geometry helpers */
  var DIRS = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k]; }
  function len(a) { return Math.hypot(a[0], a[1]); }
  function P(p) { return r2(p[0]) + ',' + r2(p[1]); }
  function boxOverlap(a, b) {
    var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return (w > 0 && h > 0) ? w * h : 0;
  }
  function segBox(p, q, pad) { pad = pad || 0; return { x0: Math.min(p[0], q[0]) - pad, y0: Math.min(p[1], q[1]) - pad, x1: Math.max(p[0], q[0]) + pad, y1: Math.max(p[1], q[1]) + pad }; }

  /* ---------------------------------------------------------- drawing */
  function Drawing(opts) {
    opts = opts || {};
    this.items = [];           // svg fragments
    this.bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    this.obst = [];            // obstacle boxes for labels
    this.labels = [];          // deferred label requests
    this.here = [0, 0];
    this.unit = opts.unit || 60;
    this.fs = opts.fontSize || FS;
  }
  var D = Drawing.prototype;
  D.grow = function (b) { this.bb.x0 = Math.min(this.bb.x0, b.x0); this.bb.y0 = Math.min(this.bb.y0, b.y0); this.bb.x1 = Math.max(this.bb.x1, b.x1); this.bb.y1 = Math.max(this.bb.y1, b.y1); };
  D.ob = function (b, kind) { this.obst.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, kind: kind || 'part' }); this.grow(b); };
  D.raw = function (s, bbox, obstacle) { this.items.push(s); if (bbox) { if (obstacle === false) this.grow(bbox); else this.ob(bbox); } return this; };
  D.pathStr = function (pts) { return 'M' + pts.map(P).join('L'); };
  /** stroke a polyline */
  D.poly = function (pts, o) {
    o = o || {};
    var d = 'M' + pts.map(P).join('L') + (o.closed ? 'Z' : '');
    var attrs = ' fill="' + (o.fill || 'none') + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.sw ? ' stroke-width="' + o.sw + '"' : '') + (o.stroke ? ' stroke="' + o.stroke + '"' : '');
    this.items.push('<path d="' + d + '"' + attrs + '/>');
    var self = this;
    for (var i = 0; i + 1 < pts.length; i++) {
      var b = segBox(pts[i], pts[i + 1], o.pad == null ? 1.5 : o.pad);
      if (o.noObstacle) self.grow(b); else self.ob(b, o.kind || 'wire');
    }
    if (pts.length === 1) this.grow(segBox(pts[0], pts[0], 2));
    return this;
  };
  D.line = function () { var pts = [].slice.call(arguments); this.poly(pts); this.here = pts[pts.length - 1]; return { start: pts[0], end: pts[pts.length - 1] }; };
  D.path = function (dstr, bbox, o) { o = o || {}; this.items.push('<path d="' + dstr + '" fill="' + (o.fill || 'none') + '"' + (o.sw ? ' stroke-width="' + o.sw + '"' : '') + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.stroke ? ' stroke="' + o.stroke + '"' : '') + '/>'); if (bbox) { if (o.noObstacle) this.grow(bbox); else this.ob(bbox); } return this; };
  D.rect = function (x, y, w, h, o) { o = o || {}; this.items.push('<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '" fill="' + (o.fill || 'none') + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.sw ? ' stroke-width="' + o.sw + '"' : '') + (o.rx ? ' rx="' + o.rx + '"' : '') + (o.stroke ? ' stroke="' + o.stroke + '"' : '') + '/>'); var b = { x0: x, y0: y, x1: x + w, y1: y + h }; if (o.noObstacle) this.grow(b); else this.ob(b); return this; };
  D.circle = function (cx, cy, r, o) { o = o || {}; this.items.push('<circle cx="' + r2(cx) + '" cy="' + r2(cy) + '" r="' + r2(r) + '" fill="' + (o.fill || 'none') + '"' + (o.sw ? ' stroke-width="' + o.sw + '"' : '') + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.stroke ? ' stroke="' + o.stroke + '"' : '') + '/>'); var b = { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }; if (o.noObstacle) this.grow(b); else this.ob(b); return this; };
  D.arrowHead = function (tip, dirv, o) {
    o = o || {}; var L = o.len || 8, W = o.w || 3.2;
    var u = mul(dirv, 1 / len(dirv)), n = [-u[1], u[0]];
    var b = sub(tip, mul(u, L));
    var p1 = add(b, mul(n, W)), p2 = sub(b, mul(n, W));
    this.items.push('<path d="M' + P(tip) + 'L' + P(p1) + 'L' + P(p2) + 'Z" fill="' + (o.fill || INK) + '" stroke-width="0.8"/>');
    this.grow(segBox(p1, p2, 1)); this.grow(segBox(tip, tip, 1));
    return this;
  };
  D.wire = function (o) {
    o = o || {};
    var from = o.from || this.here, pts;
    if (o.pts) pts = [from].concat(o.pts);
    else {
      var to = o.to;
      if (!to) { var dv = DIRS[o.dir || 'right']; to = add(from, mul(dv, o.len == null ? this.unit : o.len)); }
      if (o.path === '-|') pts = [from, [to[0], from[1]], to];
      else if (o.path === '|-') pts = [from, [from[0], to[1]], to];
      else pts = [from, to];
    }
    this.poly(pts, { dash: o.dash });
    if (o.arrow === 'end' || o.arrow === 'both') this.arrowHead(pts[pts.length - 1], sub(pts[pts.length - 1], pts[pts.length - 2]));
    if (o.arrow === 'start' || o.arrow === 'both') this.arrowHead(pts[0], sub(pts[0], pts[1]));
    if (o.arrow === 'mid') { var a = pts[pts.length - 2], b = pts[pts.length - 1]; this.arrowHead(mul(add(a, b), 0.5).map(function (v, i) { return v + (b[i] - a[i]) / len(sub(b, a)) * 4; }), sub(b, a)); }
    this.here = pts[pts.length - 1];
    return { start: pts[0], end: pts[pts.length - 1], pts: pts };
  };
  D.dot = D.node = function (p, o) { o = o || {}; var r = o.r || 3; this.items.push('<circle cx="' + r2(p[0]) + '" cy="' + r2(p[1]) + '" r="' + r + '" fill="' + INK + '" stroke="none"/>'); this.ob({ x0: p[0] - r - 1, y0: p[1] - r - 1, x1: p[0] + r + 1, y1: p[1] + r + 1 }, 'dot'); if (o.label) this.labelNear(p, o.label, { prefer: o.prefer || [o.side || 'right'], gap: 5 }); return { at: p }; };
  D.terminal = function (p, o) {
    o = o || {};
    this.items.push('<circle cx="' + r2(p[0]) + '" cy="' + r2(p[1]) + '" r="3.4" fill="#fff"/>');
    this.ob({ x0: p[0] - 4.5, y0: p[1] - 4.5, x1: p[0] + 4.5, y1: p[1] + 4.5 }, 'dot');
    if (o.label) this.labelNear(p, o.label, { prefer: o.side ? [o.side] : ['left', 'top', 'right', 'bottom'], gap: 6, value: o.value });
    return { at: p };
  };
  /* ----- labels ----- */
  /**
   * queue a label. cands: [{x,y,anchor:'start'|'middle'|'end', v:'top'|'middle'|'bottom'}] where (x,y)
   * is the reference point: v=top -> box top at y; middle -> box centred on y; bottom -> box bottom at y.
   */
  D.queueLabel = function (lines, cands, o) {
    o = o || {};
    if (!lines || !lines.length || !lines.some(function (l) { return l.length; })) return;
    this.labels.push({ lines: lines.filter(function (l) { return l.length; }), cands: cands, fs: o.fs || this.fs, strict: o.strict });
  };
  function candBox(lb, c) {
    var x0 = c.anchor === 'middle' ? c.x - lb.w / 2 : c.anchor === 'end' ? c.x - lb.w : c.x;
    var y0 = c.v === 'top' ? c.y : c.v === 'bottom' ? c.y - lb.h : c.y - lb.h / 2;
    return { x0: x0, y0: y0, x1: x0 + lb.w, y1: y0 + lb.h };
  }
  D.placeLabels = function () {
    var self = this;
    this.labels.forEach(function (L) {
      var lb = linesBox(L.lines, L.fs);
      var best = null, bestScore = Infinity;
      L.cands.forEach(function (c, ci) {
        var b = candBox(lb, c);
        var pad = { x0: b.x0 - 2, y0: b.y0 - 1.5, x1: b.x1 + 2, y1: b.y1 + 1.5 };
        var ov = 0;
        self.obst.forEach(function (o) { ov += boxOverlap(pad, o) * (o.kind === 'label' ? 3 : 1); });
        var score = ov * 10 + ci;            // first free candidate wins
        if (score < bestScore) { bestScore = score; best = { b: b, c: c }; }
      });
      var b = best.b;
      self.items.push('<g class="lbl">' + textSVG(L.lines, b.x0, b.y0 + lb.asc, 'start', L.fs) + '</g>');
      self.ob({ x0: b.x0 - 1, y0: b.y0 - 1, x1: b.x1 + 1, y1: b.y1 + 1 }, 'label');
    });
    this.labels = [];
  };
  /** explicit label at a point (still registered as an obstacle and in the bbox) */
  D.label = function (p, markup, o) {
    o = o || {};
    var lines = (Array.isArray(markup) ? markup : [markup]).map(function (m) { return o.plain ? parseMarkup(m, false) : parseMarkup(m, o.italic !== false); });
    if (o.value) lines = [lineRuns(markup, o.value)];
    this.queueLabel(lines, [{ x: p[0], y: p[1], anchor: o.anchor || 'middle', v: o.valign || 'middle' }], { fs: o.size });
    return this;
  };
  /** label near a point with collision-checked side choice */
  D.labelNear = function (p, markup, o) {
    o = o || {};
    var g = o.gap == null ? 6 : o.gap;
    var lines = Array.isArray(markup) ? markup.map(function (m) { return parseMarkup(m, true); }) : [o.value ? lineRuns(markup, o.value) : parseMarkup(markup, o.italic !== false)];
    var C = {
      right: { x: p[0] + g, y: p[1], anchor: 'start', v: 'middle' },
      left: { x: p[0] - g, y: p[1], anchor: 'end', v: 'middle' },
      top: { x: p[0], y: p[1] - g, anchor: 'middle', v: 'bottom' },
      bottom: { x: p[0], y: p[1] + g, anchor: 'middle', v: 'top' },
      topright: { x: p[0] + g * 0.6, y: p[1] - g * 0.6, anchor: 'start', v: 'bottom' },
      topleft: { x: p[0] - g * 0.6, y: p[1] - g * 0.6, anchor: 'end', v: 'bottom' },
      bottomright: { x: p[0] + g * 0.6, y: p[1] + g * 0.6, anchor: 'start', v: 'top' },
      bottomleft: { x: p[0] - g * 0.6, y: p[1] + g * 0.6, anchor: 'end', v: 'top' }
    };
    var pref = (o.prefer || ['right']).slice();
    ['right', 'left', 'top', 'bottom', 'topright', 'topleft', 'bottomright', 'bottomleft'].forEach(function (k) { if (pref.indexOf(k) < 0 && !o.strict) pref.push(k); });
    this.queueLabel(lines, pref.map(function (k) { return C[k]; }), { fs: o.size });
    return this;
  };

  /* ----- placement of two-terminal elements ----- */
  D._ends = function (o) {
    var from = o.from || o.at || this.here;
    var to = o.to;
    if (!to) { var dv = DIRS[o.dir || 'right'] || DIRS.right; to = add(from, mul(dv, o.len == null ? this.unit : o.len)); }
    return [from, to];
  };
  /** element labels for a two-terminal part: queue stacked/line label beside the body */
  D._partLabel = function (o, a, b, half, gap) {
    var lines;
    var sym = o.label, val = o.value;
    if ((sym == null || sym === '') && (val == null || val === '')) return;
    var style = o.labelStyle || 'stack';
    if (style === 'line') lines = [lineRuns(sym, val)];
    else lines = [lineRuns(sym, null), lineRuns(null, val)].filter(function (l) { return l.length; });
    var mid = mul(add(a, b), 0.5);
    var vertical = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
    var g = (gap == null ? 7 : gap) + half;
    var C = {
      right: { x: mid[0] + g, y: mid[1], anchor: 'start', v: 'middle' },
      left: { x: mid[0] - g, y: mid[1], anchor: 'end', v: 'middle' },
      top: { x: mid[0], y: mid[1] - g, anchor: 'middle', v: 'bottom' },
      bottom: { x: mid[0], y: mid[1] + g, anchor: 'middle', v: 'top' }
    };
    var order = vertical ? ['right', 'left', 'top', 'bottom'] : ['top', 'bottom', 'right', 'left'];
    if (o.side) { order.splice(order.indexOf(o.side), 1); order.unshift(o.side); }
    if (o.sideStrict) order = [o.side];
    // also allow sliding along the element for long elements
    var cands = order.map(function (k) { return C[k]; });
    var ddx = b[0] - a[0], ddy = b[1] - a[1], dl = Math.hypot(ddx, ddy);
    if (dl && Math.abs(ddx) > 0.2 * dl && Math.abs(ddy) > 0.2 * dl) {
      // diagonal element: candidates along both normals, the one matching o.side first
      var nn = [[-ddy / dl, ddx / dl], [ddy / dl, -ddx / dl]];
      var want = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[o.side || 'top'];
      nn.sort(function (p, q) { return (q[0] * want[0] + q[1] * want[1]) - (p[0] * want[0] + p[1] * want[1]); });
      var dc = nn.map(function (nv) {
        return { x: mid[0] + nv[0] * g, y: mid[1] + nv[1] * g, anchor: nv[0] > 0.3 ? 'start' : nv[0] < -0.3 ? 'end' : 'middle', v: nv[1] > 0.3 ? 'top' : nv[1] < -0.3 ? 'bottom' : 'middle' };
      });
      cands = (o.sideStrict ? [dc[0]] : dc.concat(cands));
    }
    if (vertical) {
      var L = Math.abs(b[1] - a[1]);
      [0.25, -0.25].forEach(function (f) { cands.push({ x: C[order[0]].x, y: mid[1] + f * L, anchor: C[order[0]].anchor, v: 'middle' }); });
    }
    this.queueLabel(lines, cands, { fs: o.fs });
  };
  /**
   * generic two-terminal: body(d, u0, L, T) draws the body; T maps local (u along, v across) -> page.
   * bodyLen: length of the body along the axis; half: half-width across (for label gap and obstacle).
   */
  D._two = function (o, bodyLen, half, body) {
    var e = this._ends(o), a = e[0], b = e[1];
    var dvec = sub(b, a), L = len(dvec);
    var u = L ? mul(dvec, 1 / L) : [1, 0], n = [-u[1], u[0]];
    if (o.flip) n = mul(n, -1);
    var bl = Math.min(bodyLen, L);
    var u0 = (L - bl) / 2;
    function T(uu, vv) { return add(add(a, mul(u, uu)), mul(n, vv)); }
    if (u0 > 0.01) { this.poly([a, T(u0, 0)]); this.poly([T(u0 + bl, 0), b]); }
    body.call(this, T, u0, bl, u, n);
    // body obstacle
    var c1 = T(u0, -half), c2 = T(u0 + bl, half);
    this.ob(segBox(c1, c2, 1), 'part');
    this._partLabel(o, a, b, Math.max(half, 2), o.gap);
    this.here = b;
    return { start: a, end: b, a: a, b: b, mid: mul(add(a, b), 0.5) };
  };
  D.resistor = function (o) {
    o = o || {};
    return this._two(o, 36, 7, function (T, u0, bl) {
      var pts = [T(u0, 0)], n = 6, step = bl / (n * 2);
      for (var k = 0; k < n; k++) { pts.push(T(u0 + step * (2 * k + 1), (k % 2 ? -1 : 1) * 6.5)); }
      pts.push(T(u0 + bl, 0));
      this.items.push('<path d="' + this.pathStr(pts) + '" fill="none" stroke-linejoin="miter"/>');
    });
  };
  D.capacitor = function (o) {
    o = o || {};
    return this._two(o, 9, 13, function (T, u0, bl) {
      this.items.push('<path d="M' + P(T(u0, -13)) + 'L' + P(T(u0, 13)) + '" fill="none" stroke-width="2.2"/>');
      if (o.polar) {
        var p1 = T(u0 + bl, -13), p2 = T(u0 + bl + 5, 0), p3 = T(u0 + bl, 13);
        this.items.push('<path d="M' + P(p1) + 'Q' + P(p2) + ' ' + P(p3) + '" fill="none" stroke-width="2.2"/>');
        var pp = T(u0 - 6, -11);
        this.items.push(textSVG([parseMarkup('+', false)], pp[0] - 3.5, pp[1] + 3.5, 'start', 10));
      } else {
        this.items.push('<path d="M' + P(T(u0 + bl, -13)) + 'L' + P(T(u0 + bl, 13)) + '" fill="none" stroke-width="2.2"/>');
      }
    });
  };
  D.inductor = D.coil = function (o) {
    o = o || {};
    var nh = o.turns || 4;
    return this._two(o, o.bodyLen || 40, 7, function (T, u0, bl) {
      var r = bl / (2 * nh), d = 'M' + P(T(u0, 0));
      for (var k = 0; k < nh; k++) {
        var e = T(u0 + (2 * k + 2) * r, 0);
        d += 'A' + r2(r) + ',' + r2(r * 1.05) + ' 0 0 ' + (o.flipArc ? 0 : 1) + ' ' + P(e);
      }
      this.items.push('<path d="' + d + '" fill="none"/>');
    });
  };
  function srcBody(kind) {
    return function (T, u0, bl, u, n) {
      var c = T(u0 + bl / 2, 0), R = bl / 2;
      this.items.push('<circle cx="' + r2(c[0]) + '" cy="' + r2(c[1]) + '" r="' + r2(R) + '" fill="#fff"/>');
      var self = this;
      if (kind === 'v') {
        var pp = T(u0 + bl * 0.73, 0), pm = T(u0 + bl * 0.27, 0);
        // + sign: two short strokes; − sign
        var s = 4;
        self.items.push('<path d="M' + P([pp[0] - s, pp[1]]) + 'L' + P([pp[0] + s, pp[1]]) + 'M' + P([pp[0], pp[1] - s]) + 'L' + P([pp[0], pp[1] + s]) + 'M' + P([pm[0] - s, pm[1]]) + 'L' + P([pm[0] + s, pm[1]]) + '" fill="none" stroke-width="1.4"/>');
      } else if (kind === 'ac') {
        var w = R * 0.62, h = R * 0.38, d = 'M' + P(add(c, [-w, 0])) + 'C' + P(add(c, [-w / 2, -h * 2])) + ' ' + P(add(c, [-w / 2 + 0.01, -h * 2])) + ' ' + P(c) + 'S' + P(add(c, [w / 2, h * 2])) + ' ' + P(add(c, [w, 0]));
        // simpler explicit sine via two cubic halves
        d = 'M' + P(add(c, [-w, 0])) + 'C' + P(add(c, [-w * 0.65, -h * 1.6])) + ' ' + P(add(c, [-w * 0.35, -h * 1.6])) + ' ' + P(c) + 'C' + P(add(c, [w * 0.35, h * 1.6])) + ' ' + P(add(c, [w * 0.65, h * 1.6])) + ' ' + P(add(c, [w, 0]));
        self.items.push('<path d="' + d + '" fill="none" stroke-width="1.5"/>');
        if (kind === 'ac' && self._acPol) { /* optional */ }
      } else if (kind === 'i') {
        var t1 = T(u0 + bl * 0.22, 0), t2 = T(u0 + bl * 0.8, 0);
        self.items.push('<path d="M' + P(t1) + 'L' + P(T(u0 + bl * 0.6, 0)) + '" fill="none" stroke-width="1.6"/>');
        self.arrowHead(t2, u, { len: 8, w: 3.6 });
      }
    };
  }
  D.vsrc = function (o) {
    o = o || {};
    if (o.style === 'battery') {
      return this._two(o, 12, 14, function (T, u0, bl) {
        // long plate (+) at end side, short plate (−) at start side
        this.items.push('<path d="M' + P(T(u0, -7)) + 'L' + P(T(u0, 7)) + '" stroke-width="3.2" fill="none"/>');
        this.items.push('<path d="M' + P(T(u0 + bl, -14)) + 'L' + P(T(u0 + bl, 14)) + '" fill="none"/>');
        if (o.signs !== false) {
          var pp = T(u0 + bl + 6, -12), pm = T(u0 - 6, -12);
          this.items.push(textSVG([parseMarkup('+', false)], pp[0] - 3.5, pp[1] + 4, 'start', 11));
          this.items.push(textSVG([parseMarkup('−', false)], pm[0] - 3.5, pm[1] + 4, 'start', 11));
        }
      });
    }
    return this._two(o, o.size || 36, (o.size || 36) / 2, srcBody('v'));
  };
  D.battery = function (o) { o = o || {}; o.style = 'battery'; return this.vsrc(o); };
  D.acsrc = function (o) {
    o = o || {};
    var r = this._two(o, o.size || 36, (o.size || 36) / 2, srcBody('ac'));
    if (o.signs) {
      var e = this._ends(o), a = e[0], b = e[1], dv = sub(b, a), L = len(dv), u = mul(dv, 1 / L), n = [-u[1], u[0]];
      var c = mul(add(a, b), 0.5), R = (o.size || 36) / 2;
      var pp = add(add(c, mul(u, R * 0.95)), mul(n, -R * 0.65)), pm = add(add(c, mul(u, -R * 0.95)), mul(n, -R * 0.65));
      this.items.push(textSVG([parseMarkup('+', false)], pp[0] - 3.5, pp[1] + 4, 'start', 11));
      this.items.push(textSVG([parseMarkup('−', false)], pm[0] - 3.5, pm[1] + 4, 'start', 11));
    }
    return r;
  };
  D.isrc = function (o) { o = o || {}; return this._two(o, o.size || 36, (o.size || 36) / 2, srcBody('i')); };
  function diamond(kind) {
    return function (T, u0, bl, u) {
      var h = bl / 2;
      var pts = [T(u0, 0), T(u0 + h, h), T(u0 + bl, 0), T(u0 + h, -h)];
      this.items.push('<path d="' + this.pathStr(pts) + 'Z" fill="#fff"/>');
      if (kind === 'v') {
        var pp = T(u0 + bl * 0.72, 0), pm = T(u0 + bl * 0.28, 0), s = 3.6;
        this.items.push('<path d="M' + P([pp[0] - s, pp[1]]) + 'L' + P([pp[0] + s, pp[1]]) + 'M' + P([pp[0], pp[1] - s]) + 'L' + P([pp[0], pp[1] + s]) + 'M' + P([pm[0] - s, pm[1]]) + 'L' + P([pm[0] + s, pm[1]]) + '" fill="none" stroke-width="1.4"/>');
      } else {
        this.items.push('<path d="M' + P(T(u0 + bl * 0.24, 0)) + 'L' + P(T(u0 + bl * 0.6, 0)) + '" fill="none" stroke-width="1.6"/>');
        this.arrowHead(T(u0 + bl * 0.78, 0), u, { len: 7.5, w: 3.4 });
      }
    };
  }
  D.depV = function (o) { o = o || {}; return this._two(o, 36, 18, diamond('v')); };
  D.depI = function (o) { o = o || {}; return this._two(o, 36, 18, diamond('i')); };
  function diodeBody(kind) {
    return function (T, u0, bl, u, n) {
      var h = 8.5;
      var tri = [T(u0, -h), T(u0, h), T(u0 + bl, 0)];
      this.items.push('<path d="' + this.pathStr(tri) + 'Z" fill="' + (kind === 'led' ? '#fff' : '#fff') + '"/>');
      if (kind === 'zener') {
        this.items.push('<path d="M' + P(T(u0 + bl - 4, -h - 3)) + 'L' + P(T(u0 + bl, -h)) + 'L' + P(T(u0 + bl, h)) + 'L' + P(T(u0 + bl + 4, h + 3)) + '" fill="none"/>');
      } else {
        this.items.push('<path d="M' + P(T(u0 + bl, -h)) + 'L' + P(T(u0 + bl, h)) + '" fill="none"/>');
      }
      if (kind === 'led') {
        var self = this;
        [[0.35, 0], [0.75, 0]].forEach(function (f) {
          var s = T(u0 + bl * f[0], -h - 3), e = T(u0 + bl * f[0] + 6, -h - 13);
          self.items.push('<path d="M' + P(s) + 'L' + P(e) + '" fill="none" stroke-width="1.2"/>');
          self.arrowHead(e, sub(e, s), { len: 5, w: 2.4 });
        });
      }
    };
  }
  D.diode = function (o) { o = o || {}; return this._two(o, 16, 9, diodeBody('d')); };
  D.zener = function (o) { o = o || {}; return this._two(o, 16, 10, diodeBody('zener')); };
  D.led = function (o) { o = o || {}; var r = this._two(o, 16, 22, diodeBody('led')); return r; };
  D.meter = function (o) {
    o = o || {};
    var kind = o.kind || 'V', self = this, rr = 14;
    var res = this._two(o, 2 * rr, rr, function (T, u0, bl) {
      var c = T(u0 + bl / 2, 0);
      this.items.push('<circle cx="' + r2(c[0]) + '" cy="' + r2(c[1]) + '" r="' + rr + '" fill="#fff"/>');
      this.items.push(textSVG([parseMarkup(kind, false)], c[0] - runsWidth(parseMarkup(kind, false), 13) / 2, c[1] + 4.6, 'start', 13));
      self._meterC = c;
    });
    res.center = self._meterC;
    var dv = sub(res.b, res.a), u = mul(dv, 1 / len(dv)), n = [-u[1], u[0]];
    res.v = add(self._meterC, mul(n, rr));     // voltage-coil pin (wattmeter), on the +n side
    res.vOpp = add(self._meterC, mul(n, -rr));
    return res;
  };

  D.zbox = D.impedance = function (o) {
    o = o || {};
    return this._two(o, o.bodyLen || 34, 8, function (T, u0, bl) {
      var pts = [T(u0, -8), T(u0 + bl, -8), T(u0 + bl, 8), T(u0, 8)];
      this.items.push('<path d="' + this.pathStr(pts) + 'Z" fill="#fff" stroke-linejoin="miter"/>');
    });
  };
  /** machine / generic circle two-terminal with a text inside ("M", "G", "3~") */
  D.mach = function (o) {
    o = o || {};
    var R = o.r || 18, self = this, txt = o.text || 'M';
    return this._two(o, 2 * R, R, function (T, u0, bl) {
      var c = T(u0 + bl / 2, 0);
      this.items.push('<circle cx="' + r2(c[0]) + '" cy="' + r2(c[1]) + '" r="' + R + '" fill="#fff"/>');
      var lines = String(txt).split('\n').map(function (t) { return parseMarkup(t, false); });
      var lb = linesBox(lines, 12);
      lines.forEach(function (l, i) { var w = runsWidth(l, 12); self.items.push(textSVG([l], c[0] - w / 2, c[1] - lb.h / 2 + lb.asc + i * 12 * 1.22, 'start', 12)); });
    });
  };
  D['switch'] = function (o) {
    o = o || {};
    return this._two(o, 28, 10, function (T, u0, bl) {
      var a = T(u0, 0), b = T(u0 + bl, 0);
      this.items.push('<circle cx="' + r2(a[0]) + '" cy="' + r2(a[1]) + '" r="2.4" fill="#fff"/><circle cx="' + r2(b[0]) + '" cy="' + r2(b[1]) + '" r="2.4" fill="#fff"/>');
      var tip = o.closed ? T(u0 + bl, -2.4) : T(u0 + bl - 2, -11);
      this.items.push('<path d="M' + P(T(u0 + 2, -1)) + 'L' + P(tip) + '" fill="none"/>');
    });
  };

  /* ----- three-terminal devices ----- */
  function makeXf(o, pinLocal, anchorName) {
    var fx = o.flipX ? -1 : 1, fy = o.flipY ? -1 : 1;
    var th = ((o.rot || 0) % 360) * Math.PI / 180, cs = Math.round(Math.cos(th) * 1e9) / 1e9, sn = Math.round(Math.sin(th) * 1e9) / 1e9;
    function lin(p) { var x = p[0] * fx, y = p[1] * fy; return [x * cs - y * sn, x * sn + y * cs]; }
    var at = o.at || [0, 0];
    var aLocal = anchorName && pinLocal[anchorName] ? pinLocal[anchorName] : [0, 0];
    var off = sub(at, lin(aLocal));
    return function (p) { return add(lin(p), off); };
  }
  D._device = function (o, pins, drawLocal, labelInfo) {
    var X = makeXf(o, pins, o.anchor);
    var self = this;
    var ctx = {
      line: function (pts, extra) { self.items.push('<path d="' + self.pathStr(pts.map(X)) + '" fill="none"' + (extra || '') + '/>'); var pp = pts.map(X); for (var i = 0; i + 1 < pp.length; i++) self.ob(segBox(pp[i], pp[i + 1], 1.5), 'part'); },
      arrow: function (tip, from, sz) { var t = X(tip), f = X(from); self.arrowHead(t, sub(t, f), sz || { len: 8, w: 3.4 }); },
      circle: function (c, r) { var cc = X(c); self.items.push('<circle cx="' + r2(cc[0]) + '" cy="' + r2(cc[1]) + '" r="' + r + '" fill="none"/>'); self.ob({ x0: cc[0] - r, y0: cc[1] - r, x1: cc[0] + r, y1: cc[1] + r }, 'part'); },
      text: function (p, s, fs) { var pp = X(p); var rr = parseMarkup(s, false); self.items.push(textSVG([rr], pp[0] - runsWidth(rr, fs || 12) / 2, pp[1] + (fs || 12) * 0.36, 'start', fs || 12)); },
      X: X
    };
    drawLocal(ctx);
    var out = {};
    Object.keys(pins).forEach(function (k) { out[k] = X(pins[k]); });
    // label
    var sym = o.label, val = o.value;
    if ((sym != null && sym !== '') || (val != null && val !== '')) {
      var lines = [lineRuns(sym, null), lineRuns(null, val)].filter(function (l) { return l.length; });
      var c = X(labelInfo.center), r = labelInfo.r;
      // preferred: away from the control pin
      var ctrl = X(labelInfo.ctrl);
      var away = sub(c, ctrl);
      var prefer = Math.abs(away[0]) >= Math.abs(away[1]) ? (away[0] > 0 ? 'right' : 'left') : (away[1] > 0 ? 'bottom' : 'top');
      if (o.labelSide) prefer = o.labelSide;
      var g = r + 6;
      var C = {
        right: { x: c[0] + g, y: c[1], anchor: 'start', v: 'middle' },
        left: { x: c[0] - g, y: c[1], anchor: 'end', v: 'middle' },
        top: { x: c[0], y: c[1] - g, anchor: 'middle', v: 'bottom' },
        bottom: { x: c[0], y: c[1] + g, anchor: 'middle', v: 'top' }
      };
      var order = [prefer].concat(['right', 'left', 'top', 'bottom'].filter(function (k) { return k !== prefer; }));
      var cands = order.map(function (k) { return C[k]; });
      cands.splice(1, 0, { x: c[0] + g, y: c[1] - r, anchor: 'start', v: 'middle' }, { x: c[0] + g, y: c[1] + r, anchor: 'start', v: 'middle' });
      if (prefer === 'left') { cands.splice(1, 2, { x: c[0] - g, y: c[1] - r, anchor: 'end', v: 'middle' }, { x: c[0] - g, y: c[1] + r, anchor: 'end', v: 'middle' }); }
      this.queueLabel(lines, cands);
    }
    out.center = X(labelInfo.center);
    return out;
  };
  D.bjt = function (o) {
    o = o || {};
    var pnp = o.type === 'pnp';
    var pins = { base: [-22, 0], collector: [14, -30], emitter: [14, 30], center: [5, 0] };
    var circ = o.circle !== false;
    return this._device(o, pins, function (c) {
      if (circ) c.circle([5, 0], 19);
      c.line([[-22, 0], [0, 0]]);
      c.line([[0, -12], [0, 12]], ' stroke-width="3"');
      c.line([[0, -6], [14, -16], [14, -30]]);
      c.line([[0, 6], [14, 16], [14, 30]]);
      if (!pnp) c.arrow([12.6, 15], [0, 6]);           // npn: arrow out of the base along the emitter
      else c.arrow([1.8, 7.3], [12, 14.6]);            // pnp: arrow into the base
    }, { center: [5, 0], r: circ ? 19 : 16, ctrl: [-22, 0] });
  };
  D.jfet = function (o) {
    o = o || {};
    var p = o.type === 'p';
    var pins = { gate: [-24, 0], drain: [14, -30], source: [14, 30], center: [4, 0] };
    var circ = !!o.circle;
    return this._device(o, pins, function (c) {
      if (circ) c.circle([4, 0], 20);
      c.line([[0, -17], [0, 17]], ' stroke-width="3"');
      c.line([[0, -11], [14, -11], [14, -30]]);
      c.line([[0, 11], [14, 11], [14, 30]]);
      c.line([[-24, 0], [0, 0]]);
      if (!p) c.arrow([-1, 0], [-10, 0]); else c.arrow([-13, 0], [-3, 0]);
    }, { center: [6, 0], r: circ ? 20 : 17, ctrl: [-24, 0] });
  };
  D.mosfet = function (o) {
    o = o || {};
    var t = o.type || 'nE';
    var pch = t[0] === 'p', enh = t[1] !== 'D';
    var pins = { gate: [-24, 0], drain: [14, -30], source: [14, 30], center: [4, 0] };
    var circ = !!o.circle;
    return this._device(o, pins, function (c) {
      if (circ) c.circle([4, 0], 21);
      c.line([[-7, -14], [-7, 14]], ' stroke-width="2"');
      c.line([[-24, 0], [-7, 0]]);
      if (enh) { c.line([[0, -17], [0, -8]], ' stroke-width="3"'); c.line([[0, -4.5], [0, 4.5]], ' stroke-width="3"'); c.line([[0, 8], [0, 17]], ' stroke-width="3"'); }
      else c.line([[0, -17], [0, 17]], ' stroke-width="3"');
      c.line([[0, -12.5], [14, -12.5], [14, -30]]);
      c.line([[0, 12.5], [14, 12.5], [14, 30]]);
      c.line([[3, 0], [14, 0], [14, 12.5]]);
      if (!pch) c.arrow([1.5, 0], [12, 0], { len: 7, w: 3.2 }); else c.arrow([13, 0], [2, 0], { len: 7, w: 3.2 });
    }, { center: [6, 0], r: circ ? 21 : 17, ctrl: [-24, 0] });
  };
  D.opamp = function (o) {
    o = o || {};
    var top = o.plusTop ? 'noninv' : 'inv';
    var pins = { inv: [-12, o.plusTop ? 16 : -16], noninv: [-12, o.plusTop ? -16 : 16], out: [68, 0], vpos: [24, -32], vneg: [24, 32], center: [24, 0] };
    var self = this;
    var res = this._device(o, pins, function (c) {
      c.line([[0, -32], [0, 32], [56, 0], [0, -32]], ' stroke-linejoin="miter"');
      c.line([[-12, -16], [0, -16]]); c.line([[-12, 16], [0, 16]]); c.line([[56, 0], [68, 0]]);
      var pTop = o.plusTop ? '+' : '−', pBot = o.plusTop ? '−' : '+';
      c.text([7, -16], pTop, 14); c.text([7, 16], pBot, 14);
      if (o.supplies) { c.line([[24, -18.3], [24, -32]]); c.line([[24, 18.3], [24, 32]]); }
    }, { center: [22, 0], r: 26, ctrl: [-12, 0] });
    return res;
  };
  D.transformer = function (o) {
    o = o || {};
    var at = o.at || this.here, h = o.h || 70, w = o.w || 70;
    var x0 = at[0], y0 = at[1];
    var xc1 = x0 + w / 2 - 13, xc2 = x0 + w / 2 + 13;
    var coilTop = y0 + h * 0.15, coilBot = y0 + h * 0.85, nh = o.turns || 4, r = (coilBot - coilTop) / (2 * nh);
    var d1 = 'M' + P([xc1, coilTop]), d2 = 'M' + P([xc2, coilTop]);
    for (var k = 0; k < nh; k++) {
      d1 += 'A' + r2(Math.min(r * 1.05, 9)) + ',' + r2(r) + ' 0 0 1 ' + P([xc1, coilTop + (2 * k + 2) * r]);
      d2 += 'A' + r2(Math.min(r * 1.05, 9)) + ',' + r2(r) + ' 0 0 0 ' + P([xc2, coilTop + (2 * k + 2) * r]);
    }
    this.items.push('<path d="' + d1 + '" fill="none"/><path d="' + d2 + '" fill="none"/>');
    this.ob({ x0: xc1 - 2, y0: coilTop, x1: xc2 + 2, y1: coilBot });
    this.poly([[x0, y0], [xc1, y0], [xc1, coilTop]]);
    this.poly([[x0, y0 + h], [xc1, y0 + h], [xc1, coilBot]]);
    this.poly([[x0 + w, y0], [xc2, y0], [xc2, coilTop]]);
    this.poly([[x0 + w, y0 + h], [xc2, y0 + h], [xc2, coilBot]]);
    var ymid = (coilTop + coilBot) / 2;
    if (o.ct) this.poly([[xc2, ymid], [x0 + w, ymid]]);
    if (o.ctp) this.poly([[xc1, ymid], [x0, ymid]]);
    if (o.core !== false) {
      var xm = (xc1 + xc2) / 2;
      this.items.push('<path d="M' + P([xm - 2.5, coilTop - 4]) + 'L' + P([xm - 2.5, coilBot + 4]) + 'M' + P([xm + 2.5, coilTop - 4]) + 'L' + P([xm + 2.5, coilBot + 4]) + '" fill="none" stroke-width="1.5"/>');
    }
    if (o.dots !== false) {
      var dy2 = o.dots === 'opposite' ? coilBot - 3 : coilTop + 3;
      this.dot([xc1 - 9, coilTop + 3], { r: 2.6 }); this.dot([xc2 + 9, dy2], { r: 2.6 });
    }
    var self = this;
    if (o.n1 || o.n2 || o.ratio) {
      var lbl = o.ratio ? o.ratio : (o.n1 || '') + (o.n1 && o.n2 ? ' : ' : '') + (o.n2 || '');
      this.label([(xc1 + xc2) / 2, y0 + h + 10], lbl, { anchor: 'middle', valign: 'top' });
    }
    return { p1: [x0, y0], p2: [x0, y0 + h], s1: [x0 + w, y0], s2: [x0 + w, y0 + h], sc: [x0 + w, ymid], pc: [x0, ymid], c1: [xc1, (coilTop + coilBot) / 2], c2: [xc2, (coilTop + coilBot) / 2] };
  };
  D.ground = function (p, o) {
    o = o || {};
    var lead = o.lead || 0, x = p[0], y = p[1];
    if (lead) { this.poly([[x, y], [x, y + lead]]); y += lead; }
    if (o.type === 'chassis') {
      this.items.push('<path d="M' + P([x - 10, y]) + 'L' + P([x + 10, y]) + 'M' + P([x - 10, y]) + 'L' + P([x - 14, y + 7]) + 'M' + P([x, y]) + 'L' + P([x - 4, y + 7]) + 'M' + P([x + 10, y]) + 'L' + P([x + 6, y + 7]) + '" fill="none"/>');
    } else {
      this.items.push('<path d="M' + P([x - 11, y]) + 'L' + P([x + 11, y]) + 'M' + P([x - 7, y + 4.5]) + 'L' + P([x + 7, y + 4.5]) + 'M' + P([x - 3, y + 9]) + 'L' + P([x + 3, y + 9]) + '" fill="none"/>');
    }
    this.ob({ x0: x - 12, y0: y - 1, x1: x + 12, y1: y + 10 });
    return { at: p };
  };
  D.rail = function (p, o) {
    o = o || {};
    var down = o.dir === 'down', x = p[0], y = p[1];
    this.items.push('<path d="M' + P([x - 10, y]) + 'L' + P([x + 10, y]) + '" fill="none" stroke-width="2"/>');
    this.ob({ x0: x - 11, y0: y - 1.5, x1: x + 11, y1: y + 1.5 });
    var lines = [lineRuns(o.label, o.value)];
    if (lines[0].length) this.queueLabel(lines, [{ x: x, y: down ? y + 6 : y - 6, anchor: 'middle', v: down ? 'top' : 'bottom' },
      { x: x + 13, y: y, anchor: 'start', v: 'middle' }, { x: x - 13, y: y, anchor: 'end', v: 'middle' }]);
    return { at: p };
  };
  D.current = function (o) {
    o = o || {};
    var at = o.at, dv = DIRS[o.dir || 'down'], L = o.len || 20;
    var n = [-dv[1], dv[0]]; // left of travel for right-handed
    var sideVec;
    var vertical = dv[0] === 0;
    if (vertical) sideVec = (o.side || 'left') === 'left' ? [-1, 0] : [1, 0];
    else sideVec = (o.side || 'top') === 'top' ? [0, -1] : [0, 1];
    var g = o.onWire ? 0 : (o.gap == null ? 10 : o.gap);
    var c = add(at, mul(sideVec, g));
    var s = add(c, mul(dv, -L / 2)), e = add(c, mul(dv, L / 2));
    if (!o.onWire) this.poly([s, sub(e, mul(dv, 3))], { kind: 'part' });
    this.arrowHead(e, dv, { len: o.onWire ? 9 : 8, w: 3.6 });
    this.ob(segBox(s, e, 3));
    if (o.label) {
      var lab = add(c, mul(sideVec, 5));
      var lines = [lineRuns(o.label, o.value)];
      var cands = vertical ? [{ x: lab[0], y: c[1], anchor: sideVec[0] < 0 ? 'end' : 'start', v: 'middle' }, { x: c[0] - sideVec[0] * 2 * g - sideVec[0] * 5, y: c[1], anchor: sideVec[0] < 0 ? 'start' : 'end', v: 'middle' }]
        : [{ x: c[0], y: lab[1], anchor: 'middle', v: sideVec[1] < 0 ? 'bottom' : 'top' }, { x: c[0], y: c[1] - sideVec[1] * (2 * g + 5), anchor: 'middle', v: sideVec[1] < 0 ? 'top' : 'bottom' }];
      this.queueLabel(lines, cands);
    }
    return { at: at };
  };
  D.polarity = function (o) {
    o = o || {};
    var a = o.a, b = o.b, mid = mul(add(a, b), 0.5);
    var vertical = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
    var side = o.side || (vertical ? 'right' : 'top');
    var sv = side === 'right' ? [1, 0] : side === 'left' ? [-1, 0] : side === 'top' ? [0, -1] : [0, 1];
    var g = o.gap == null ? 12 : o.gap;
    var pa = add(add(a, mul(sub(b, a), 0.12)), mul(sv, g)), pb = add(add(b, mul(sub(a, b), 0.12)), mul(sv, g));
    this.label(pa, '+', { plain: true, size: 13 });
    this.label(pb, '−', { plain: true, size: 13 });
    if (o.label) {
      var pm = add(mid, mul(sv, g));
      var lines = [lineRuns(o.label, o.value)];
      var anc = sv[0] > 0 ? 'start' : sv[0] < 0 ? 'end' : 'middle';
      this.queueLabel(lines, [{ x: pm[0] + sv[0] * -4, y: pm[1], anchor: vertical ? (sv[0] > 0 ? 'start' : 'end') : 'middle', v: 'middle' }]);
      if (vertical) this.labels[this.labels.length - 1].cands[0].x = pm[0] + (sv[0] > 0 ? -4 : 4);
    }
    return this;
  };
  /* ----- blocks ----- */
  D.box = function (o) {
    o = o || {};
    var lab = o.label || '';
    var lines = (Array.isArray(lab) ? lab : [lab]).map(function (m) { return parseMarkup(m, o.italic !== false); });
    var lb = linesBox(lines, o.fs || FS);
    var w = o.w || Math.max(48, lb.w + 20), h = o.h || Math.max(34, lb.h + 16);
    var at = o.at || this.here, anchor = o.anchor || 'in';
    var x0 = anchor === 'center' ? at[0] - w / 2 : anchor === 'out' ? at[0] - w : at[0];
    var y0 = at[1] - h / 2;
    if (anchor === 'top') { x0 = at[0] - w / 2; y0 = at[1]; }
    this.items.push('<rect x="' + r2(x0) + '" y="' + r2(y0) + '" width="' + r2(w) + '" height="' + r2(h) + '" fill="#fff"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>');
    this.ob({ x0: x0, y0: y0, x1: x0 + w, y1: y0 + h });
    this.items.push(textSVG(lines, x0 + w / 2 - lb.w / 2, y0 + h / 2 - lb.h / 2 + lb.asc, 'start', o.fs || FS).replace(/<text x="([\d.\-]+)"/g, function (m0, xx) { return m0; }));
    // centre each line individually
    if (lines.length > 1) {
      this.items.pop();
      var self = this, lh = (o.fs || FS) * 1.22;
      lines.forEach(function (l, i) { var lw = runsWidth(l, o.fs || FS); self.items.push(textSVG([l], x0 + w / 2 - lw / 2, y0 + h / 2 - lb.h / 2 + lb.asc + i * lh, 'start', o.fs || FS)); });
    }
    var yc = y0 + h / 2;
    this.here = [x0 + w, yc];
    return { in: [x0, yc], out: [x0 + w, yc], top: [x0 + w / 2, y0], bottom: [x0 + w / 2, y0 + h], center: [x0 + w / 2, yc], w: w, h: h, x0: x0, y0: y0 };
  };
  D.gain = function (o) {
    o = o || {};
    var at = o.at || this.here, dv = DIRS[o.dir || 'right'], Lg = o.len || 34, Hg = o.h || 15;
    var n = [-dv[1], dv[0]];
    var tip = add(at, mul(dv, Lg));
    var p1 = add(at, mul(n, Hg)), p2 = sub(at, mul(n, Hg));
    this.items.push('<path d="M' + P(p1) + 'L' + P(tip) + 'L' + P(p2) + 'Z" fill="#fff" stroke-linejoin="miter"/>');
    var bb = { x0: Math.min(p1[0], p2[0], tip[0]), y0: Math.min(p1[1], p2[1], tip[1]), x1: Math.max(p1[0], p2[0], tip[0]), y1: Math.max(p1[1], p2[1], tip[1]) };
    this.ob(bb);
    if (o.k != null && o.k !== '') {
      var lines = [parseMarkup(String(o.k), true)];
      var c = add(at, mul(dv, Lg * 0.4));
      var side = o.labelSide;
      // label outside the triangle, beside its base
      var cands = [];
      if (dv[0] !== 0) cands = [{ x: c[0], y: bb.y0 - 4, anchor: 'middle', v: 'bottom' }, { x: c[0], y: bb.y1 + 4, anchor: 'middle', v: 'top' }];
      else cands = [{ x: bb.x1 + 5, y: c[1], anchor: 'start', v: 'middle' }, { x: bb.x0 - 5, y: c[1], anchor: 'end', v: 'middle' }];
      if (side === 'bottom' || side === 'left') cands.reverse();
      this.queueLabel(lines, cands, { fs: o.fs || 12 });
    }
    this.here = tip;
    return { in: at, out: tip };
  };
  D.sum = function (o) {
    o = o || {};
    var c = o.at || this.here, r = o.r || 10;
    if (o.anchor === 'left') c = [c[0] + r, c[1]];
    this.items.push('<circle cx="' + r2(c[0]) + '" cy="' + r2(c[1]) + '" r="' + r + '" fill="#fff"/>');
    if (o.cross !== false) this.items.push('<path d="M' + P([c[0] - r * 0.55, c[1]]) + 'L' + P([c[0] + r * 0.55, c[1]]) + 'M' + P([c[0], c[1] - r * 0.55]) + 'L' + P([c[0], c[1] + r * 0.55]) + '" fill="none" stroke-width="1.3"/>');
    this.ob({ x0: c[0] - r, y0: c[1] - r, x1: c[0] + r, y1: c[1] + r });
    var self = this, signs = o.signs || {};
    var off = { left: [-r - 5, -r + 1], right: [r + 5, -r + 1], top: [r - 1, -r - 6], bottom: [r - 1, r + 7] };
    Object.keys(signs).forEach(function (k) { if (!signs[k]) return; var p = add(c, off[k]); self.label(p, signs[k] === '-' ? '−' : signs[k], { plain: true, size: 12 }); });
    this.here = [c[0] + r, c[1]];
    return { left: [c[0] - r, c[1]], right: [c[0] + r, c[1]], top: [c[0], c[1] - r], bottom: [c[0], c[1] + r], center: c };
  };

  /* ----- output ----- */
  D.svg = function (o) {
    o = o || {};
    this.placeLabels();
    var pad = o.pad == null ? 10 : o.pad;
    var b = this.bb;
    if (!isFinite(b.x0)) b = { x0: 0, y0: 0, x1: 10, y1: 10 };
    var x = Math.floor(b.x0 - pad), y = Math.floor(b.y0 - pad), w = Math.ceil(b.x1 - b.x0 + 2 * pad), h = Math.ceil(b.y1 - b.y0 + 2 * pad);
    var sc = o.scale || 1.25;
    var title = o.title ? '<title>' + esc(o.title) + '</title>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="qb-sch" viewBox="' + x + ' ' + y + ' ' + w + ' ' + h + '" width="' + Math.round(w * sc) + '" height="' + Math.round(h * sc) + '" role="img"' + (o.title ? ' aria-label="' + esc(o.title) + '"' : '') + '>' + title +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fff"/>' +
      '<g fill="none" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linecap="round" stroke-linejoin="round" font-family="' + FONT.replace(/"/g, '&quot;') + '">' +
      this.items.join('').replace(/<text /g, '<text fill="' + INK + '" stroke="none" ') +
      '</g></svg>';
  };
  S.drawing = function (o) { return new Drawing(o); };
  S.Drawing = Drawing;
  S.markupWidth = function (m, fs) { return runsWidth(parseMarkup(m, true), fs || FS); };
  S._lineRuns = lineRuns; S._textSVG = textSVG; S._linesBox = linesBox;
})(typeof window !== 'undefined' ? window : globalThis);

/* =============================================================================
 * HIGH-LEVEL TEMPLATES
 * ============================================================================= */
(function (G) {
  'use strict';
  var QB = G.QB, S = QB.sch;
  var UNIT = { R: 'Ω', C: 'F', L: 'H', V: 'V', I: 'A' };
  function unitOf(key) { var c = key.replace(/^r/, 'R')[0]; return UNIT[c] || ''; }
  /** resolve an option into {on, label, value} */
  function pv(o, key, sym, unit, mandatory) {
    var raw = o[key];
    var s = (o.labels && o.labels[key] != null) ? o.labels[key] : sym;
    unit = unit == null ? unitOf(key) : unit;
    var res;
    if (raw === undefined || raw === null || raw === false) res = mandatory ? { on: true, label: s, value: null } : { on: false };
    else if (raw === true) res = { on: true, label: s, value: null };
    else if (typeof raw === 'number') res = { on: true, label: s, value: QB.fmt.eng(raw, unit) };
    else if (typeof raw === 'object') res = { on: true, label: raw.label != null ? raw.label : s, value: raw.value == null ? null : (typeof raw.value === 'number' ? QB.fmt.eng(raw.value, unit) : raw.value) };
    else res = { on: true, label: s, value: String(raw) };
    if (o.values === false) res.value = null;
    if (o.symbols === false && res.value) res.label = null;
    return res;
  }
  function L(p, extra) { var r = { label: p.label, value: p.value }; if (extra) for (var k in extra) r[k] = extra[k]; return r; }
  function betaText(o, key) {
    var b = o[key || 'beta'];
    if (b == null || b === false) return null;
    if (typeof b === 'number') return 'β = ' + QB.fmt.num(b, 3);
    return String(b);
  }
  function fin(d, o, title) { return d.svg({ scale: o.scale, title: o.title || title, pad: o.pad }); }
  S._pv = pv;

  /* ------------------------------------------------------------ shared chains */
  /** input chain leftwards from node: [C] [Rs] then source to ground (or a v_i terminal) */
  function inputChain(d, node, o, gy, K) {
    K = K || {};
    var C = pv(o, K.C || 'C1', K.Csym || 'C_1', 'F'), Rs = pv(o, K.Rs || 'Rs', K.Rssym || 'R_s', 'Ω'),
      vs = pv(o, K.vs || 'vs', K.vssym || 'v_s', 'V'), vi = pv(o, K.vi || 'vi', K.visym || 'v_i', 'V');
    if (!C.on && !Rs.on && !vs.on && !vi.on) return null;
    var x = node[0], y = node[1];
    d.dot(node);
    if (C.on) { d.line([x, y], [x - 15, y]); d.capacitor(L(C, { from: [x - 15, y], to: [x - 70, y], side: 'top', polar: o.polarC })); x -= 70; }
    if (Rs.on || vs.on) {
      if (vi.on) { d.line([x, y], [x - 12, y]); x -= 12; d.dot([x, y]); d.labelNear([x, y], vi.label, { prefer: ['top', 'topleft'], gap: 7 }); }
      if (Rs.on) { d.resistor(L(Rs, { from: [x, y], to: [x - 62, y], side: 'top' })); x -= 62; }
      var xs = x - 22; d.line([x, y], [xs, y]);
      d.acsrc(L(vs.on ? vs : { label: 'v_s' }, { from: [xs, gy], to: [xs, y], side: 'left', signs: true }));
      d.ground([xs, gy]);
      return { x: xs };
    }
    d.line([x, y], [x - 22, y]); d.terminal([x - 22, y], { label: vi.label, side: 'left' });
    return { x: x - 22 };
  }
  /** output chain rightwards from node: [C] then RL to ground and/or a v_o terminal */
  function outputChain(d, node, o, gy, K) {
    K = K || {};
    var C = pv(o, K.C || 'C2', K.Csym || 'C_2', 'F'), RL = pv(o, K.RL || 'RL', K.RLsym || 'R_L', 'Ω'), vo = pv(o, K.vo || 'vo', K.vosym || 'v_o', 'V');
    if (!C.on && !RL.on && !vo.on) return null;
    var x = node[0], y = node[1];
    d.dot(node);
    if (C.on) { d.line([x, y], [x + 30, y]); d.capacitor(L(C, { from: [x + 30, y], to: [x + 90, y], side: 'top', polar: o.polarC })); x += 90; }
    else { d.line([x, y], [x + 40, y]); x += 40; }
    if (RL.on) {
      var xr = x + (K.gapRL || 50);
      d.line([x, y], [xr, y]);
      d.resistor(L(RL, { from: [xr, y], to: [xr, gy], side: 'right' }));
      d.ground([xr, gy]);
      if (vo.on) { d.dot([xr, y]); d.line([xr, y], [xr + 40, y]); d.terminal([xr + 40, y], { label: vo.label, side: 'right' }); }
      return { x: xr };
    }
    if (vo.on) { d.line([x, y], [x + 20, y]); d.terminal([x + 20, y], { label: vo.label, side: 'right' }); }
    return { x: x };
  }
  S._inputChain = inputChain; S._outputChain = outputChain;

  /* ------------------------------------------------------------ generic single-device stage */
  var BJTK = { dev: 'bjt', supply: 'VCC', top: 'RC', bias: 'RB', b1: 'R1', b2: 'R2', em: 'RE', em1: 'RE1', em2: 'RE2', byp: 'CE', fb: 'RF', gate: 'VBB',
    sym: { VCC: 'V_{CC}', RC: 'R_C', RB: 'R_B', R1: 'R_1', R2: 'R_2', RE: 'R_E', RE1: 'R_{E1}', RE2: 'R_{E2}', CE: 'C_E', RF: 'R_F', VBB: 'V_{BB}' },
    nodes: ['V_B', 'V_C', 'V_E'], cur: ['I_B', 'I_C', 'I_E'], rs: 'R_s' };
  var FETK = { dev: 'fet', supply: 'VDD', top: 'RD', bias: 'RG', b1: 'R1', b2: 'R2', em: 'RS', em1: 'RS1', em2: 'RS2', byp: 'CS', fb: 'RG', gate: 'VGG',
    sym: { VDD: 'V_{DD}', RD: 'R_D', RG: 'R_G', R1: 'R_1', R2: 'R_2', RS: 'R_S', RS1: 'R_{S1}', RS2: 'R_{S2}', CS: 'C_S', VGG: 'V_{GG}' },
    nodes: ['V_G', 'V_D', 'V_S'], cur: ['I_G', 'I_D', 'I_S'], rs: 'R_{sig}' };
  /**
   * cfg: {K, bias:'fixed'|'emitter'|'vdb'|'self'|'gatebat'|'feedback'|'none', takeoff:'collector'|'emitter',
   *       xb, xc, yT, rail:true, topLeft (x where the top wire starts), noIO}
   */
  function stage(d, o, cfg) {
    var K = cfg.K, sy = K.sym;
    var xb = cfg.xb, xc = cfg.xc, yT = cfg.yT || 40;
    var yCn = yT + 90, yCp = yCn + 20, yB = yCp + 30, yEp = yB + 30;
    var bias = cfg.bias, follower = cfg.takeoff === 'emitter';
    var sup = pv(o, K.supply, sy[K.supply], 'V', true);
    var RT = pv(o, K.top, sy[K.top], 'Ω', !follower && cfg.topMandatory !== false);
    var RE = pv(o, K.em, sy[K.em], 'Ω', follower), RE1 = pv(o, K.em1, sy[K.em1], 'Ω'), RE2 = pv(o, K.em2, sy[K.em2], 'Ω');
    var CE = pv(o, K.byp, sy[K.byp], 'F');
    var split = RE1.on && RE2.on;
    if (split) RE = { on: false };
    var legEnd = split ? yEp + 135 : RE.on ? yEp + 90 : yEp + 30;
    var need = { vdb: yB + 110, self: yB + 100, gatebat: yB + 140 }[bias] || 0;
    var gy = Math.max(legEnd, need, cfg.gy || 0);
    if (follower && (o.RL || o.C2)) gy = Math.max(gy, yEp + 100);
    // device
    var q, dev = K.dev;
    var qlab = pv(o, cfg.qkey || 'Q', null, '', false);
    var bt = betaText(o, cfg.betaKey);
    if (dev === 'bjt') q = d.bjt({ at: [xc, yCp], anchor: 'collector', type: o.type === 'pnp' ? 'pnp' : 'npn', label: qlab.on ? qlab.label || qlab.value : null, value: bt });
    else if ((o.device || 'jfet') === 'jfet') q = d.jfet({ at: [xc, yCp], anchor: 'drain', type: o.type === 'p' ? 'p' : 'n', label: qlab.on ? qlab.label || qlab.value : null, value: o.dev || bt });
    else q = d.mosfet({ at: [xc, yCp], anchor: 'drain', type: o.device, label: qlab.on ? qlab.label || qlab.value : null, value: o.dev || bt });
    var ctrl = q.base || q.gate, ptop = q.collector || q.drain, pbot = q.emitter || q.source;
    // supply and top resistor
    if (cfg.rail !== false) { d.rail([xc, yT - 18], { label: sup.label, value: sup.value }); d.line([xc, yT - 18], [xc, yT]); }
    var topWire = (bias === 'fixed' || bias === 'emitter' || bias === 'vdb');
    if (topWire) { d.line([cfg.topLeft != null ? cfg.topLeft : xb, yT], [xc, yT]); if (cfg.topLeft != null && cfg.topLeft < xb) d.dot([xb, yT]); }
    if (cfg.topRight) d.line([xc, yT], [cfg.topRight, yT]);
    if ((topWire && cfg.rail !== false) || cfg.topRight) d.dot([xc, yT]);
    if (RT.on) d.resistor(L(RT, { from: [xc, yT], to: [xc, yCn], side: 'right' })); else d.line([xc, yT], [xc, yCn]);
    d.line([xc, yCn], ptop);
    // bias network
    var bnode = [xb, yB];
    if (bias === 'fixed' || bias === 'emitter') { var RB = pv(o, K.bias, sy[K.bias], 'Ω', true); d.resistor(L(RB, { from: [xb, yT], to: [xb, yB], side: 'left' })); d.line(bnode, ctrl); }
    else if (bias === 'vdb') {
      var R1 = pv(o, K.b1, sy[K.b1], 'Ω', true), R2 = pv(o, K.b2, sy[K.b2], 'Ω', true);
      d.resistor(L(R1, { from: [xb, yT], to: [xb, yB], side: 'left' }));
      d.resistor(L(R2, { from: [xb, yB], to: [xb, gy], side: 'left' })); d.ground([xb, gy]);
      d.dot(bnode); d.line(bnode, ctrl);
    } else if (bias === 'self') {
      var RG = pv(o, K.bias, sy[K.bias], 'Ω', true);
      d.resistor(L(RG, { from: [xb, yB], to: [xb, gy], side: 'left' })); d.ground([xb, gy]);
      d.dot(bnode); d.line(bnode, ctrl);
    } else if (bias === 'gatebat') {
      var RG2 = pv(o, K.bias, sy[K.bias], 'Ω', true), VG = pv(o, K.gate, sy[K.gate], 'V', true);
      var yb2 = yB + 75;
      d.resistor(L(RG2, { from: [xb, yB], to: [xb, yb2], side: 'left' }));
      // n-channel: gate at −V_GG, so the battery's + terminal is at the grounded (bottom) end
      if (o.type === 'p') d.battery(L(VG, { from: [xb, gy], to: [xb, yb2], side: 'left' }));
      else d.battery(L(VG, { from: [xb, yb2], to: [xb, gy], side: 'left' }));
      d.ground([xb, gy]);
      d.dot(bnode); d.line(bnode, ctrl);
    } else if (bias === 'feedback') {
      var RF = pv(o, K.fb === 'RG' ? 'RG' : 'RF', K.fb === 'RG' ? 'R_G' : 'R_F', 'Ω', true);
      d.dot([xc, yCn]);
      d.resistor(L(RF, { from: [xc, yCn], to: [xb + 10, yCn], side: 'top' }));
      d.line([xb + 10, yCn], [xb, yCn], [xb, yB]);
      bnode = [xb, yB];
      d.line(bnode, ctrl);
    } else { bnode = [ctrl[0] - 20, yB]; d.line(ctrl, bnode); }
    // emitter leg
    var ex = xc, eNode = null, bypTop = null;
    if (split) {
      d.resistor(L(RE1, { from: pbot, to: [xc, yEp + 70], side: 'right' }));
      d.resistor(L(RE2, { from: [xc, yEp + 70], to: [xc, gy], side: 'right' }));
      bypTop = [xc, yEp + 70]; eNode = [xc, yEp + 10];
    } else if (RE.on) {
      d.resistor(L(RE, { from: pbot, to: [xc, gy], side: 'right' }));
      bypTop = [xc, yEp + 14]; eNode = [xc, yEp + 14];
    } else { d.line(pbot, [xc, gy]); eNode = null; }
    d.ground([xc, gy]);
    var xCE = xc + 85;
    if (CE.on && bypTop) {
      d.dot(bypTop); d.line(bypTop, [xCE, bypTop[1]]);
      d.capacitor(L(CE, { from: [xCE, bypTop[1]], to: [xCE, gy], side: 'right', polar: o.polarC }));
      d.ground([xCE, gy]);
    }
    // node labels / currents
    var npn = !(o.type === 'pnp' || o.type === 'p');
    if (o.nodes) {
      var nd = K.nodes;
      d.label([ctrl[0] - 12, yB - 5], nd[0], { anchor: 'middle', valign: 'bottom' });
      d.dot([xc, yCn]); d.labelNear([xc, yCn], nd[1], { prefer: follower ? ['right'] : ['topright', 'right'], gap: 6 });
      if (eNode) { d.dot(eNode); d.labelNear(eNode, nd[2], { prefer: ['right', 'bottomright'], gap: 6 }); }
    }
    if (o.currents) {
      var c = K.cur;
      if (dev === 'bjt') d.current({ at: [(bnode[0] + ctrl[0]) / 2 + 4, yB], dir: npn ? 'right' : 'left', label: c[0], side: 'bottom' });
      d.current({ at: [xc, (yCn + yCp) / 2], dir: npn ? 'down' : 'up', label: c[1], side: 'left', len: 18 });
      d.current({ at: [xc, yEp + (RE.on || split ? 13 : 15)], dir: npn ? 'down' : 'up', label: c[2], side: 'left', len: 18 });
    }
    var outNode = follower ? (eNode || [xc, yEp + 14]) : [xc, yCn];
    return { d: d, gy: gy, bnode: bnode, cnode: [xc, yCn], enode: eNode, out: outNode, q: q, yB: yB, xCE: xCE, hasCE: CE.on && !!bypTop };
  }
  S._stage = stage;
  function ampIO(st, o, K) {
    if (o.noIO) return;
    inputChain(st.d, st.bnode, o, st.gy, { Rssym: K.rs });
    var gap = st.hasCE ? 50 : 40;
    outputChain(st.d, st.out, o, st.gy, { gapRL: gap });
  }

  /* ------------------------------------------------------------ BJT templates */
  S.bjtFixedBias = function (o) { o = o || {}; var d = S.drawing(); var st = stage(d, o, { K: BJTK, bias: 'fixed', xb: 120, xc: 220 }); ampIO(st, o, BJTK); return fin(d, o, 'Fixed-bias BJT'); };
  S.bjtEmitterBias = function (o) { o = Object.assign({ RE: true }, o || {}); var d = S.drawing(); var st = stage(d, o, { K: BJTK, bias: 'emitter', xb: 120, xc: 220 }); ampIO(st, o, BJTK); return fin(d, o, 'Emitter-stabilised BJT bias'); };
  S.bjtVDB = function (o) { o = o || {}; if (!o.RE1 && o.RE == null) o = Object.assign({ RE: true }, o); var d = S.drawing(); var st = stage(d, o, { K: BJTK, bias: 'vdb', xb: 120, xc: 220 }); ampIO(st, o, BJTK); return fin(d, o, 'Voltage-divider bias BJT'); };
  S.bjtCollectorFeedback = function (o) { o = o || {}; var d = S.drawing(); var st = stage(d, o, { K: BJTK, bias: 'feedback', xb: 120, xc: 220 }); ampIO(st, o, BJTK); return fin(d, o, 'Collector-feedback BJT'); };
  S.bjtEmitterFollower = function (o) {
    o = o || {}; var d = S.drawing();
    var bias = o.R1 || o.R2 ? 'vdb' : 'fixed';
    var st = stage(d, o, { K: BJTK, bias: bias, xb: 120, xc: 220, takeoff: 'emitter', topMandatory: false });
    ampIO(st, o, BJTK);
    return fin(d, o, 'Emitter follower');
  };
  /** common base: emitter input, base grounded (or bypassed), collector output */
  S.bjtCommonBase = function (o) {
    o = o || {}; var d = S.drawing();
    var VCC = pv(o, 'VCC', 'V_{CC}', 'V', true), VEE = pv(o, 'VEE', 'V_{EE}', 'V'), RC = pv(o, 'RC', 'R_C', 'Ω', true), RE = pv(o, 'RE', 'R_E', 'Ω', true);
    var xm = 260, ys = 120, gy = 230;
    var q = d.bjt({ at: [xm, ys + 36], anchor: 'base', type: o.type === 'pnp' ? 'pnp' : 'npn', flipY: true, rot: 270, value: betaText(o) || (o.alpha ? 'α = ' + o.alpha : null), labelSide: 'bottom' });
    // q.emitter left, q.collector right
    var xe = 190, xcn = 330;
    d.line(q.emitter, [xe, ys]); d.line(q.collector, [xcn, ys]);
    d.line(q.base, [xm, ys + 52]); d.ground([xm, ys + 52]);
    d.resistor(L(RE, { from: [xe, ys], to: [xe, gy - 20], side: 'left' }));
    if (VEE.on) { d.line([xe, gy - 20], [xe, gy]); d.rail([xe, gy], { label: VEE.label, value: VEE.value, dir: 'down' }); }
    else { d.line([xe, gy - 20], [xe, gy]); d.ground([xe, gy]); }
    d.resistor(L(RC, { from: [xcn, ys], to: [xcn, 30], side: 'right' }));
    d.line([xcn, 30], [xcn, 22]); d.rail([xcn, 22], { label: VCC.label, value: VCC.value });
    if (o.currents) {
      d.current({ at: [xe + 18, ys], dir: o.type === 'pnp' ? 'left' : 'right', label: 'I_E', side: 'top', len: 16 });
      d.current({ at: [xcn - 14, ys], dir: o.type === 'pnp' ? 'left' : 'right', label: 'I_C', side: 'top', len: 16 });
    }
    if (o.nodes) { d.labelNear([xe, ys], 'V_E', { prefer: ['topright'] }); }
    inputChain(d, [xe, ys], o, gy, {});
    outputChain(d, [xcn, ys], o, gy, {});
    return fin(d, o, 'Common-base amplifier');
  };
  /** two RC-coupled voltage-divider CE stages. Stage keys: s1:{R1,R2,RC,RE,CE,beta}, s2:{...} or shared top-level */
  S.bjtTwoStageRC = function (o) {
    o = o || {}; var d = S.drawing();
    var base = { VCC: o.VCC, nodes: o.nodes, currents: o.currents, type: o.type, values: o.values, polarC: o.polarC };
    var s1 = Object.assign({}, base, { R1: o.R1, R2: o.R2, RC: o.RC, RE: o.RE == null ? true : o.RE, CE: o.CE, beta: o.beta, Q: 'Q_1', labels: { R1: 'R_1', R2: 'R_2', RC: 'R_{C1}', RE: 'R_{E1}', CE: 'C_{E1}' } }, o.s1 || {});
    var s2 = Object.assign({}, base, { R1: o.R3 || o.R1, R2: o.R4 || o.R2, RC: o.RC2 || o.RC, RE: o.RE2 || (o.RE == null ? true : o.RE), CE: o.CE2 != null ? o.CE2 : o.CE, beta: o.beta2 || o.beta, Q: 'Q_2', labels: { R1: 'R_3', R2: 'R_4', RC: 'R_{C2}', RE: 'R_{E2}', CE: 'C_{E2}' } }, o.s2 || {});
    s2.VCC = false;
    var st1 = stage(d, s1, { K: BJTK, bias: 'vdb', xb: 120, xc: 220, gy: 300 });
    var xb2 = 390, xc2 = 490;
    var st2 = stage(d, s2, { K: BJTK, bias: 'vdb', xb: xb2, xc: xc2, rail: false, topLeft: 220, gy: st1.gy });
    // coupling capacitor from collector 1 to base 2
    var Cc = pv(o, 'Cc', 'C_2', 'F', true);
    var y1 = st1.cnode[1], yb = st2.bnode[1];
    d.dot(st1.cnode);
    d.line(st1.cnode, [262, y1], [262, yb]);
    d.capacitor(L(Cc, { from: [262, yb], to: [xb2 - 15, yb], side: 'top' }));
    d.line([xb2 - 15, yb], [xb2, yb]);
    inputChain(d, st1.bnode, o, st1.gy, {});
    outputChain(d, st2.cnode, Object.assign({}, o, { C2: o.Cout == null ? true : o.Cout, labels: Object.assign({ C2: 'C_3' }, o.labels || {}) }), st2.gy, { gapRL: st2.hasCE ? 50 : 40 });
    return fin(d, o, 'Two-stage RC-coupled amplifier');
  };
  /** Darlington pair: Q1 emitter -> Q2 base; collectors tied. bias via RB (or R1/R2); output 'emitter' (default) or 'collector' */
  S.darlington = function (o) {
    o = o || {}; var d = S.drawing();
    var VCC = pv(o, 'VCC', 'V_{CC}', 'V', true), RB = pv(o, 'RB', 'R_B', 'Ω'), R1 = pv(o, 'R1', 'R_1', 'Ω'), R2 = pv(o, 'R2', 'R_2', 'Ω'), RC = pv(o, 'RC', 'R_C', 'Ω'), RE = pv(o, 'RE', 'R_E', 'Ω', true);
    var xb = 110, x1 = 200, yT = 40, yb1 = 180, gy = 380;
    var q1 = d.bjt({ at: [x1, yb1], anchor: 'center', label: 'Q_1', labelSide: 'top' });
    var q2 = d.bjt({ at: [q1.emitter[0], q1.emitter[1] + 40], anchor: 'base', label: 'Q_2', labelSide: 'right' });
    var bTxt = [betaText(o, 'beta1'), betaText(o, 'beta2')].filter(Boolean).join(', ');
    var x2 = q2.collector[0];
    d.rail([x2, yT - 18], { label: VCC.label, value: VCC.value }); d.line([x2, yT - 18], [x2, yT]);
    d.line(q1.emitter, [q1.emitter[0], q1.emitter[1] + 40]);
    var yc = yb1 - 60;
    d.line(q1.collector, [q1.collector[0], yc], [q2.collector[0], yc]); d.dot([q2.collector[0], yc]);
    d.line(q2.collector, [q2.collector[0], yc]);
    var xr = q2.collector[0];
    d.line([xb, yT], [xr, yT]);
    if (RC.on) d.resistor(L(RC, { from: [xr, yT], to: [xr, yc], side: 'right' })); else d.line([xr, yT], [xr, yc]);
    if (R1.on || R2.on) {
      d.resistor(L(pv(o, 'R1', 'R_1', 'Ω', true), { from: [xb, yT], to: [xb, yb1], side: 'left' }));
      d.resistor(L(pv(o, 'R2', 'R_2', 'Ω', true), { from: [xb, yb1], to: [xb, gy], side: 'left' })); d.ground([xb, gy]);
    } else d.resistor(L(RB.on ? RB : { label: 'R_B' }, { from: [xb, yT], to: [xb, yb1], side: 'left' }));
    d.dot([xb, yT]); d.dot([xb, yb1]); d.line([xb, yb1], q1.base);
    d.resistor(L(RE, { from: q2.emitter, to: [q2.emitter[0], gy], side: 'right' })); d.ground([q2.emitter[0], gy]);
    if (o.box) { var bx0 = q1.base[0] + 6, by0 = yc + 8, bx1 = q2.emitter[0] + 22, by1 = q2.emitter[1] - 6; d.poly([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], { closed: true, dash: '4 3', sw: 1.2 }); }
    if (bTxt) d.label([q2.emitter[0] + (o.box ? 30 : 26), (q1.center[1] + q2.center[1]) / 2], bTxt, { anchor: 'start', plain: true });
    if (o.currents) { d.current({ at: [xb + 40, yb1], dir: 'right', label: 'I_{B1}', side: 'bottom' }); d.current({ at: [q2.emitter[0], q2.emitter[1] + 13], dir: 'down', label: 'I_E', side: 'left', len: 16 }); }
    inputChain(d, [xb, yb1], o, gy, {});
    var out = o.output === 'collector' ? [xr, yc] : [q2.emitter[0], q2.emitter[1] + 14];
    outputChain(d, out, o, gy, {});
    return fin(d, o, 'Darlington pair');
  };
  /** current mirror: Q1 diode-connected with Rref from VCC; Q2 output with RC (load) or I_o arrow */
  S.currentMirror = function (o) {
    o = o || {}; var d = S.drawing();
    var VCC = pv(o, 'VCC', 'V_{CC}', 'V', true), Rref = pv(o, 'Rref', 'R_{ref}', 'Ω', true), RC = pv(o, 'RC', 'R_C', 'Ω');
    var x1 = 120, x2 = 300, yT = 40, yCp = 150, gy = 240;
    var q1 = d.bjt({ at: [x1, yCp], anchor: 'collector', flipX: true, label: 'Q_1' });
    var q2 = d.bjt({ at: [x2, yCp], anchor: 'collector', label: 'Q_2' });
    d.line(q1.base, q2.base);
    var yj = yCp - 18;
    d.line([x1, yj], q1.collector); d.dot([x1, yj]);
    var xj = q1.base[0] + 18;
    d.line([x1, yj], [xj, yj], [xj, q1.base[1]]); d.dot([xj, q1.base[1]]);
    d.line(q1.emitter, [x1, gy]); d.ground([x1, gy]); d.line(q2.emitter, [x2, gy]); d.ground([x2, gy]);
    d.rail([x1, yT - 18], { label: VCC.label, value: VCC.value }); d.line([x1, yT - 18], [x1, yT]);
    d.resistor(L(Rref, { from: [x1, yT], to: [x1, yj], side: 'left' }));
    if (RC.on) {
      d.line([x1, yT], [x2, yT]); d.dot([x1, yT]);
      d.resistor(L(RC, { from: [x2, yT], to: [x2, yj], side: 'right' })); d.line([x2, yj], q2.collector);
      if (o.vo) { d.dot([x2, yj]); d.line([x2, yj], [x2 + 40, yj]); d.terminal([x2 + 40, yj], { label: o.vo === true ? 'V_o' : o.vo, side: 'right' }); }
    } else {
      d.line(q2.collector, [x2, yj - 40]); d.terminal([x2, yj - 40], { label: o.load || 'to load', side: 'top' });
    }
    d.current({ at: [x1, yT + 18], dir: 'down', label: o.Iref === false ? null : (o.Iref || 'I_{ref}'), side: 'right', len: 16 });
    d.current({ at: [x2, yj + 8], dir: 'down', label: o.Io || 'I_o', side: 'left', len: 16 });
    return fin(d, o, 'BJT current mirror');
  };
  /**
   * small-signal models. kind 're' (βr_e, βI_b) or 'hybrid' (r_π, g_m v_π).
   * keys: Rs, vs, vi, RB (bias resistance, e.g. 'R_1∥R_2'), ro (true/value), RC, RL, vo, RE (unbypassed), Zi, Zo
   */
  function bjtSS(o, kind) {
    var d = S.drawing();
    var hy = kind === 'hybrid';
    var yt = 40, yb = 170, gy = yb;
    var RB = pv(o, 'RB', 'R_B', 'Ω'), rin = pv(o, hy ? 'rpi' : 're', hy ? 'r_π' : 'βr_e', 'Ω', true), ro = pv(o, 'ro', 'r_o', 'Ω'),
      RC = pv(o, 'RC', 'R_C', 'Ω'), RL = pv(o, 'RL', 'R_L', 'Ω'), RE = pv(o, 'RE', 'R_E', 'Ω');
    var src = hy ? (o.gm || 'g_m v_π') : (o.betaIb || 'βI_b');
    var xB = 170, xR = 240, xS = 340;
    var yE = RE.on ? yb - 10 : yb;
    var x = xB;
    // base node and input
    d.terminal([xB - 1, yt - 0.01], {}); // marker removed below (kept for symmetry)
    d.items.pop(); d.obst.pop();
    d.line([xB, yt], [xR, yt]);
    if (RB.on) { d.dot([xB, yt]); d.resistor(L(RB, { from: [xB, yt], to: [xB, yb], side: 'left' })); if (RE.on) d.ground([xB, yb]); }
    d.dot([xR, yt]);
    d.resistor(L(rin, { from: [xR, yt], to: [xR, yE], side: 'right' }));
    if (hy) { d.polarity({ a: [xR, yt + 6], b: [xR, yE - 6], label: 'v_π', side: 'left', gap: 12 }); }
    else d.current({ at: [xR, yt + 14], dir: 'down', label: 'I_b', side: 'left', len: 14 });
    d.labelNear([xR, yt], 'b', { prefer: ['top'], gap: 6 });
    // e node
    if (RE.on) {
      d.line([xR, yE], [xS, yE]); d.dot([xR + 50, yE]);
      d.resistor(L(RE, { from: [xR + 50, yE], to: [xR + 50, yE + 70], side: 'right' })); d.ground([xR + 50, yE + 70]);
      d.labelNear([xR + 50, yE], 'e', { prefer: ['topright'], gap: 4 });
      gy = yE + 70;
    } else { d.labelNear([xR + 50, yb], 'e', { prefer: ['bottom'], gap: 14 }); }
    // collector side
    var ytc = yt;
    d.depI({ from: [xS, yE], to: [xS, ytc], label: src, side: 'left', flip: false });
    var xo = xS;
    var rows = [];
    if (ro.on) rows.push(['ro', ro]);
    if (RC.on) rows.push(['RC', RC]);
    if (RL.on) rows.push(['RL', RL]);
    xo = xS;
    rows.forEach(function (r) {
      var xn = xo + 70;
      d.line([xo, ytc], [xn, ytc]); d.dot([xo, ytc]);
      if (r[0] === 'ro') { d.resistor(L(r[1], { from: [xn, ytc], to: [xn, yE], side: 'right' })); d.line([xn, yE], [xo, yE]); d.dot([xo, yE]); }
      else { d.resistor(L(r[1], { from: [xn, ytc], to: [xn, yb], side: 'right' })); if (RE.on) d.ground([xn, yb]); else { d.line([xn, yb], [xo, yb]); d.dot([xo, yb]); } }
      xo = xn;
    });
    d.labelNear([xS, ytc], 'c', { prefer: ['top'], gap: 6 });
    // ground bus bottom (when RE absent everything returns on yb)
    if (!RE.on) { d.line([xB, yb], [xS, yb]); d.ground([xB + 30 < xR ? (xB + xR) / 2 : xR + 40, yb], { lead: 0 }); }
    if (o.vo || RL.on || RC.on) { d.line([xo, ytc], [xo + 40, ytc]); d.terminal([xo + 40, ytc], { label: o.vo === false ? null : (typeof o.vo === 'string' ? o.vo : 'v_o'), side: 'right' }); if (!RE.on) { d.line([xo, yb], [xo + 40, yb]); d.terminal([xo + 40, yb], {}); } }
    // input
    var ich = inputChain(d, [xB, yt], Object.assign({}, o, { C1: false }), RE.on ? gy : yb, { Rssym: 'R_s' });
    if (o.Zi) { var zx = xB - 14; d.wire({ from: [zx - 26, yt + 34], to: [zx, yt + 34], arrow: 'end' }); d.label([zx - 30, yt + 34], 'Z_i', { anchor: 'end' }); }
    if (o.Zo) { var zx2 = xo + 14; d.wire({ from: [zx2 + 26, yt + 34], to: [zx2, yt + 34], arrow: 'end' }); d.label([zx2 + 30, yt + 34], 'Z_o', { anchor: 'start' }); }
    return fin(d, o, hy ? 'Hybrid-π small-signal model' : 'r_e small-signal model');
  }
  S.hybridPiModel = function (o) { return bjtSS(o || {}, 'hybrid'); };
  S.reModel = function (o) { return bjtSS(o || {}, 're'); };

  /* ------------------------------------------------------------ FET templates */
  function fetStage(o, bias, takeoff, title) {
    var d = S.drawing();
    var oo = Object.assign({}, o);
    if (oo.Rsig != null && oo.Rs == null) oo.Rs = oo.Rsig;
    if (!oo.labels) oo.labels = {};
    oo.labels = Object.assign({ Rs: 'R_{sig}' }, oo.labels);
    var st = stage(d, oo, { K: FETK, bias: bias, xb: 120, xc: 220, takeoff: takeoff, topMandatory: takeoff !== 'emitter' });
    ampIO(st, oo, FETK);
    return fin(d, o, title);
  }
  S.jfetFixedBias = function (o) { return fetStage(o || {}, 'gatebat', null, 'JFET fixed bias'); };
  S.jfetSelfBias = function (o) { o = Object.assign({ RS: true }, o || {}); return fetStage(o, 'self', null, 'JFET self-bias'); };
  S.fetVDB = function (o) { o = Object.assign({ RS: true }, o || {}); return fetStage(o, 'vdb', null, 'FET voltage-divider bias'); };
  S.emosDrainFeedback = function (o) { o = Object.assign({ device: 'nE' }, o || {}); return fetStage(o, 'feedback', null, 'E-MOSFET drain-feedback bias'); };
  S.sourceFollower = function (o) { o = Object.assign({ RS: true }, o || {}); var bias = o.R1 || o.R2 ? 'vdb' : 'self'; return fetStage(o, bias, 'emitter', 'Source follower'); };
  S.commonGate = function (o) {
    o = o || {}; var d = S.drawing();
    var VDD = pv(o, 'VDD', 'V_{DD}', 'V', true), RD = pv(o, 'RD', 'R_D', 'Ω', true), RS = pv(o, 'RS', 'R_S', 'Ω', true);
    var xm = 260, ys = 120, gy = 230;
    var dev = o.device || 'jfet';
    var q = dev === 'jfet' ? d.jfet({ at: [xm, ys + 38], anchor: 'gate', type: o.type === 'p' ? 'p' : 'n', flipY: true, rot: 270, value: o.dev })
      : d.mosfet({ at: [xm, ys + 38], anchor: 'gate', type: dev, flipY: true, rot: 270, value: o.dev });
    var xe = 190, xcn = 330;
    d.line(q.source, [xe, ys]); d.line(q.drain, [xcn, ys]);
    d.line(q.gate, [xm, ys + 52]); d.ground([xm, ys + 52]);
    d.resistor(L(RS, { from: [xe, ys], to: [xe, gy], side: 'left' })); d.ground([xe, gy]);
    d.resistor(L(RD, { from: [xcn, ys], to: [xcn, 30], side: 'right' }));
    d.line([xcn, 30], [xcn, 22]); d.rail([xcn, 22], { label: VDD.label, value: VDD.value });
    var oo = Object.assign({}, o); oo.labels = Object.assign({ Rs: 'R_{sig}' }, o.labels || {}); if (oo.Rsig != null && oo.Rs == null) oo.Rs = oo.Rsig;
    inputChain(d, [xe, ys], oo, gy, { Rssym: 'R_{sig}' });
    outputChain(d, [xcn, ys], o, gy, {});
    return fin(d, o, 'Common-gate amplifier');
  };
  /** FET small-signal: gate open, g_m v_gs from d to s, r_d, R_D, R_L; RG to ground; optional unbypassed RS */
  S.fetSmallSignal = function (o) {
    o = o || {}; var d = S.drawing();
    var RG = pv(o, 'RG', 'R_G', 'Ω'), rd = pv(o, 'rd', 'r_d', 'Ω'), RD = pv(o, 'RD', 'R_D', 'Ω'), RL = pv(o, 'RL', 'R_L', 'Ω'), RS = pv(o, 'RS', 'R_S', 'Ω');
    var yt = 40, yb = 170, xG = 170, xS = 300;
    var yE = RS.on ? yb - 10 : yb;
    d.line([xG, yt], [xG + 40, yt]); d.terminal([xG + 40, yt], {}); d.labelNear([xG + 40, yt], 'G', { prefer: ['top'], gap: 7 });
    if (RG.on) { d.dot([xG, yt]); d.resistor(L(RG, { from: [xG, yt], to: [xG, yb], side: 'left' })); }
    d.polarity({ a: [xG + 40, yt + 12], b: [xG + 40, yE - 4], label: 'v_{gs}', side: 'right', gap: 4 });
    var x0 = xS;
    d.depI({ from: [xS, yE], to: [xS, yt], label: o.gm || 'g_m v_{gs}', side: 'left' });
    d.labelNear([xS, yt], 'D', { prefer: ['top'], gap: 6 });
    var xo = xS, rows = [];
    if (rd.on) rows.push(['rd', rd]); if (RD.on) rows.push(['RD', RD]); if (RL.on) rows.push(['RL', RL]);
    rows.forEach(function (r) {
      var xn = xo + 70; d.line([xo, yt], [xn, yt]); d.dot([xo, yt]);
      if (r[0] === 'rd') { d.resistor(L(r[1], { from: [xn, yt], to: [xn, yE], side: 'right' })); d.line([xn, yE], [xo, yE]); d.dot([xo, yE]); }
      else { d.resistor(L(r[1], { from: [xn, yt], to: [xn, yb], side: 'right' })); if (RS.on) d.ground([xn, yb]); else { d.line([xn, yb], [xo, yb]); d.dot([xo, yb]); } }
      xo = xn;
    });
    if (RS.on) {
      d.line([xG + 40, yE], [xS, yE]); d.dot([xS - 50, yE]);
      d.labelNear([xS - 50, yE], 'S', { prefer: ['topleft'], gap: 4 });
      d.resistor(L(RS, { from: [xS - 50, yE], to: [xS - 50, yE + 70], side: 'right' })); d.ground([xS - 50, yE + 70]);
      if (RG.on) d.ground([xG, yb]);
    } else { d.line([xG, yb], [xS, yb]); d.ground([(xG + xS) / 2, yb]); d.labelNear([(xG + xS) / 2 + 40, yb], 'S', { prefer: ['bottom'], gap: 6 }); }
    if (RG.on || true) d.line([xG + 40, yE], [xG + 40, yE]);
    d.line([xo, yt], [xo + 40, yt]); d.terminal([xo + 40, yt], { label: typeof o.vo === 'string' ? o.vo : 'v_o', side: 'right' });
    if (!RS.on) { d.line([xo, yb], [xo + 40, yb]); d.terminal([xo + 40, yb], {}); }
    inputChain(d, [xG, yt], Object.assign({}, o, { C1: false, labels: Object.assign({ Rs: 'R_{sig}' }, o.labels || {}) }), RS.on ? yE + 70 : yb, {});
    if (o.Zi) { d.wire({ from: [xG - 40, yt + 30], to: [xG - 14, yt + 30], arrow: 'end' }); d.label([xG - 44, yt + 30], 'Z_i', { anchor: 'end' }); }
    if (o.Zo) { d.wire({ from: [xo + 40, yt + 30], to: [xo + 14, yt + 30], arrow: 'end' }); d.label([xo + 44, yt + 30], 'Z_o', { anchor: 'start' }); }
    return fin(d, o, 'FET small-signal model');
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* =============================================================================
 * HIGH-LEVEL TEMPLATES II: diodes, op-amps/power amps, AC, machines, DSP, magnetics
 * ============================================================================= */
(function (G) {
  'use strict';
  var QB = G.QB, S = QB.sch, pv = S._pv;
  function L(p, extra) { var r = { label: p.label, value: p.value }; if (extra) for (var k in extra) r[k] = extra[k]; return r; }
  function fin(d, o, title) { return d.svg({ scale: o.scale, title: o.title || title, pad: o.pad }); }
  function num(v) { return typeof v === 'number' ? QB.fmt.num(v, 3) : String(v); }
  /** shorthand option -> element spec. spec kinds: R L C Z(box) D ZD(zener) LED V(dc circle) B(battery) AC I SW W(wire) */
  function spec(o, key, kind, sym, unit, mand, extra) {
    var p = pv(o, key, sym, unit, mand);
    if (!p.on) return null;
    var s = { k: kind, label: p.label, value: p.value };
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }
  /** draw one element between a and b (rev swaps ends; for D/ZD/LED this flips the cathode, for V/B the + end) */
  function el(d, s, a, b, side) {
    if (!s || s.k === 'W') { d.line(a, b); return; }
    var from = s.rev ? b : a, to = s.rev ? a : b;
    var o = { from: from, to: to, label: s.label, value: s.value, side: s.side || side, labelStyle: s.labelStyle, polar: s.polar, signs: s.signs };
    var f = { R: 'resistor', L: 'inductor', C: 'capacitor', Z: 'zbox', D: 'diode', ZD: 'zener', LED: 'led', V: 'vsrc', B: 'battery', AC: 'acsrc', I: 'isrc', SW: 'switch', DV: 'depV', DI: 'depI' }[s.k] || 'resistor';
    if (s.k === 'AC' && s.signs == null) o.signs = true;
    if (s.k === 'SW') o.closed = s.closed;
    return d[f](o);
  }
  /** place a list of elements in a straight run from a to b; each gets an equal slot, leads fill the rest */
  function run(d, list, a, b, side, slot) {
    list = (list || []).filter(Boolean);
    if (!list.length) { d.line(a, b); return []; }
    var dv = [b[0] - a[0], b[1] - a[1]], Ltot = Math.hypot(dv[0], dv[1]), u = [dv[0] / Ltot, dv[1] / Ltot];
    var n = list.length, sl = slot || Math.min(70, Ltot / n);
    var lead = (Ltot - sl * n) / (n + 1);
    var p = a, pts = [];
    for (var i = 0; i < n; i++) {
      var s0 = [p[0] + u[0] * lead, p[1] + u[1] * lead];
      if (lead > 0.5) d.line(p, s0);
      var e0 = [s0[0] + u[0] * sl, s0[1] + u[1] * sl];
      el(d, list[i], s0, e0, side);
      pts.push([s0, e0]);
      p = e0;
    }
    if (lead > 0.5) d.line(p, b);
    return pts;
  }
  function slotsLen(list, dflt) { return (list || []).filter(Boolean).reduce(function (s, e) { return s + (e.len || dflt); }, 0); }
  /** output terminal pair at x with polarity marks and a label between them */
  function outPair(d, top, bot, x, label) {
    d.dot(top); d.dot(bot);
    d.line(top, [x, top[1]]); d.line(bot, [x, bot[1]]);
    d.terminal([x, top[1]]); d.terminal([x, bot[1]]);
    if (label) {
      d.label([x, top[1] + 17], '+', { plain: true, size: 13 });
      d.label([x, bot[1] - 17], '−', { plain: true, size: 13 });
      d.label([x, (top[1] + bot[1]) / 2], label, { anchor: 'middle' });
      d.labels = d.labels.splice(-3, 3).concat(d.labels);
    }
  }
  /**
   * series loop: source on the left leg (from bottom to top, + at top), `top` list left->right,
   * `right` list top->bottom, bottom wire back. Returns geometry.
   */
  function loop(d, o, src, top, right, cfg) {
    cfg = cfg || {};
    var x0 = cfg.x0 || 50, yt = cfg.yt || 50, yb = cfg.yb || 190;
    top = (top || []).filter(Boolean); right = (right || []).filter(Boolean);
    var w = Math.max(cfg.minW || 160, top.length * 82 + 40);
    var xr = x0 + w;
    if (src) el(d, src, [x0, yb], [x0, yt], 'left'); else { d.terminal([x0, yt]); d.terminal([x0, yb]); }
    var tp = run(d, top, [x0, yt], [xr, yt], 'top', 62);
    var rp = run(d, right, [xr, yt], [xr, yb], 'right', right.length > 1 ? 56 : 66);
    d.line([xr, yb], [x0, yb]);
    return { x0: x0, xr: xr, yt: yt, yb: yb, tp: tp, rp: rp };
  }
  function diodeSpec(s, i, dflt) {
    // s: true | string (value, e.g. 'Si') | {label, value, k, rev}
    var k = 'D', lab = 'D_' + (i + 1), val = null, rev = false;
    if (dflt && dflt.label) lab = dflt.label;
    if (s && typeof s === 'object') { k = s.k || s.kind || 'D'; if (s.label != null) lab = s.label; val = s.value || null; rev = !!s.rev; }
    else if (typeof s === 'string') val = s;
    return { k: k === 'zener' ? 'ZD' : k === 'led' ? 'LED' : k, label: lab, value: val, rev: rev };
  }
  S._el = el; S._run = run; S._loop = loop; S._outPair = outPair;

  /* ------------------------------------------------------------ DIODES */
  /**
   * diodeSeriesString: E (left source), diodes: N | [spec..] (spec: 'Si' | {label,value,k:'D'|'zener'|'led',rev}),
   * rev: true|[bools], R (series resistor on top, after the diodes), R2 (right leg resistor, output),
   * E2 (second source in the right leg), E2rev (E2 + at bottom), Erev, vo, I (current arrow label), ground.
   * Explicit lists override: top:[spec], right:[spec] with spec {k:'R'|'D'|'ZD'|'LED'|'V'|'B', label, value, rev}.
   */
  S.diodeSeriesString = function (o) {
    o = o || {}; var d = S.drawing();
    var src = spec(o, 'E', o.battery ? 'B' : 'V', 'E', 'V', true, { rev: !!o.Erev });
    var top = o.top;
    if (!top) {
      var ds = Array.isArray(o.diodes) ? o.diodes : new Array(o.diodes || o.N || 1).fill(o.dtype || null);
      top = ds.map(function (s, i) { var sp = diodeSpec(s, i, ds.length === 1 ? { label: 'D' } : null); var rv = Array.isArray(o.rev) ? o.rev[i] : o.rev; if (rv) sp.rev = !sp.rev; return sp; });
      var R = spec(o, 'R', 'R', 'R', 'Ω'); if (R) { if (o.Rfirst) top.unshift(R); else top.push(R); }
    }
    var right = o.right;
    if (!right) { right = [spec(o, 'R2', 'R', 'R_2', 'Ω'), spec(o, 'E2', o.battery ? 'B' : 'V', 'E_2', 'V', false, { rev: !o.E2rev })].filter(Boolean); }
    var g = loop(d, o, src, top, right, {});
    if (o.I) d.current({ at: [g.x0 + 28, g.yt], dir: 'right', label: o.I === true ? 'I' : o.I, side: 'top', len: 16 });
    if (o.vo) {
      if (g.rp.length && right[0] && right[0].k === 'R') { var s = g.rp[0]; outPair(d, [g.xr, s[0][1] - 6], [g.xr, s[1][1] + 6], g.xr + 55, o.vo === true ? 'V_o' : o.vo); }
      else outPair(d, [g.xr, g.yt], [g.xr, g.yb], g.xr + 50, o.vo === true ? 'V_o' : o.vo);
    }
    if (o.ground) d.ground([g.xr, g.yb], { lead: 0 });
    return fin(d, o, 'Series diode circuit');
  };
  /**
   * diodeParallel: E, R (series), diodes: N | [spec..] (each its own vertical branch, cathode down), RL (extra branch), vo, currents.
   * Rb: [labels] optional series resistor in each diode branch.
   */
  S.diodeParallel = function (o) {
    o = o || {}; var d = S.drawing();
    var src = spec(o, 'E', o.battery ? 'B' : 'V', 'E', 'V', true);
    var R = spec(o, 'R', 'R', 'R', 'Ω', true);
    var ds = Array.isArray(o.diodes) ? o.diodes : new Array(o.diodes || o.N || 2).fill(o.dtype || null);
    var x0 = 50, yt = 50, yb = 200, x = x0;
    el(d, src, [x0, yb], [x0, yt], 'left');
    run(d, [R], [x0, yt], [x0 + 130, yt], 'top', 62);
    x = x0 + 130;
    var xs = [];
    ds.forEach(function (s, i) {
      var sp = diodeSpec(s, i); if (o.rev) sp.rev = !sp.rev;
      var xb = x + i * 80 + (i ? 0 : 20);
      xs.push(xb);
      var list = [sp];
      if (o.Rb && o.Rb[i]) list.push({ k: 'R', label: o.Rb[i].label || o.Rb[i], value: o.Rb[i].value });
      run(d, list, [xb, yt], [xb, yb], 'right', list.length > 1 ? 52 : 60);
    });
    var xl = xs[xs.length - 1];
    var RL = spec(o, 'RL', 'R', 'R_L', 'Ω');
    if (RL) { xl += 90; run(d, [RL], [xl, yt], [xl, yb], 'right', 66); xs.push(xl); }
    d.line([x, yt], [xl, yt]); d.line([xl, yb], [x0, yb]);
    xs.slice(0, -1).forEach(function (xx, i) { if (i > 0 || xx > x) { d.dot([xx, yt]); d.dot([xx, yb]); } });
    if (xs[0] > x) { d.dot([xs[0], yt]); d.dot([xs[0], yb]); }
    if (o.currents) {
      d.current({ at: [x0 + 145, yt], dir: 'right', label: 'I', side: 'top', len: 14, gap: 9 });
      xs.forEach(function (xx, i) { if (i < ds.length) d.current({ at: [xx, yt + 26], dir: (o.rev ? 'up' : 'down'), label: 'I_{D' + (i + 1) + '}', side: 'left', len: 14 }); });
    }
    if (o.vo) outPair(d, [xl, yt], [xl, yb], xl + 50, o.vo === true ? 'V_o' : o.vo);
    if (o.ground) d.ground([x0 + 100, yb]);
    return fin(d, o, 'Parallel diodes');
  };
  /** source part for rectifiers: ac source, or transformer (tx:true | ratio string) fed by an ac source */
  function rectSource(d, o, yt, yb, ct) {
    var vs = pv(o, 'vs', 'v_s', 'V', true);
    if (o.tx || ct) {
      var vp = pv(o, 'vp', 'v_p', 'V', false);
      var tx = d.transformer({ at: [70, yt], h: yb - yt, w: 80, ct: !!ct, dots: false, ratio: typeof o.tx === 'string' ? o.tx : (o.ratio || null) });
      d.acsrc(L(vp.on ? vp : { label: null }, { from: [40, yb], to: [40, yt], side: 'left' }));
      d.line([40, yt], tx.p1); d.line([40, yb], tx.p2);
      if (vs.on && (vs.label || vs.value) && o.showVs !== false) d.label([tx.s1[0] + 14, (yt + yb) / 2 + (ct ? -34 : 0)], vs.label, { anchor: 'start', value: vs.value });
      return { top: tx.s1, bot: tx.s2, mid: tx.sc, x: tx.s1[0] };
    }
    d.acsrc(L(vs, { from: [50, yb], to: [50, yt], side: 'left' }));
    return { top: [50, yt], bot: [50, yb], x: 50 };
  }
  /** load section: optional C and RL vertical between top node and bottom/ground, plus vo pair */
  function rectLoad(d, o, xa, yt, yb, gnd) {
    var C = spec(o, 'C', 'C', 'C', 'F', false, { polar: !!o.polarC });
    var RL = spec(o, 'RL', 'R', 'R_L', 'Ω', true);
    var x = xa, last = xa;
    if (C) { x += 60; d.line([xa, yt], [x, yt]); run(d, [C], [x, yt], [x, yb], 'left', 40); if (gnd) d.ground([x, yb]); last = x; }
    x += 70; d.line([last, yt], [x, yt]); if (C) d.dot([last, yt]);
    run(d, [RL], [x, yt], [x, yb], 'right', 66); if (gnd) d.ground([x, yb]);
    if (!gnd) { d.line([x, yb], [xa, yb]); if (C) d.dot([last, yb]); }
    if (o.vo) outPair(d, [x, yt], [x, yb], x + 50, o.vo === true ? 'v_o' : o.vo);
    if (o.IL) d.current({ at: [x, yt + 20], dir: 'down', label: o.IL === true ? 'I_L' : o.IL, side: 'left', len: 14 });
    return x;
  }
  /** halfWave: vs (ac source) | tx (transformer, ratio string) + vp, D, rev (diode reversed -> negative output), C (filter), RL, vo, IL */
  S.halfWave = function (o) {
    o = o || {}; var d = S.drawing();
    var yt = 50, yb = 190;
    var s = rectSource(d, o, yt, yb);
    var D = diodeSpec(o.D, 0, { label: 'D' }); if (o.rev) D.rev = true;
    var xa = s.x + 120;
    run(d, [D], s.top, [xa, yt], 'top', 50);
    d.line(s.bot, [xa, yb]);
    rectLoad(d, o, xa, yt, yb, false);
    return fin(d, o, 'Half-wave rectifier');
  };
  /** centreTap: vp, ratio (e.g. '1 : 2'), vs (each half, label beside the secondary), D1, D2, C, RL, vo, IL */
  S.centreTap = function (o) {
    o = o || {}; var d = S.drawing();
    var yt = 40, yb = 220;
    var s = rectSource(d, Object.assign({}, o, { tx: o.ratio || true, showVs: false }), yt, yb, true);
    var xa = s.x + 130;
    run(d, [diodeSpec(o.D1, 0)], s.top, [xa, yt], 'top', 50);
    run(d, [diodeSpec(o.D2, 1)], s.bot, [xa, yb], 'bottom', 50);
    d.line([xa, yb], [xa, yt]); d.dot([xa, yt]);
    var ym = s.mid[1];
    d.line(s.mid, [s.x + 40, ym]); d.ground([s.x + 40, ym]);
    if (o.vs) { var vs = pv(o, 'vs', 'v_s', 'V'); d.label([s.x + 12, (yt + ym) / 2], vs.label, { anchor: 'start', value: vs.value }); d.label([s.x + 12, (ym + yb) / 2], vs.label, { anchor: 'start', value: vs.value }); }
    // load to ground at the same level as the centre tap
    var C = spec(o, 'C', 'C', 'C', 'F', false, { polar: !!o.polarC }), RL = spec(o, 'RL', 'R', 'R_L', 'Ω', true);
    var x = xa, gy = ym + 50;
    if (C) { x += 50; d.line([xa, yt], [x, yt]); run(d, [C], [x, yt], [x, gy], 'right', 40); d.ground([x, gy]); }
    var xr = x + (C ? 100 : 70); d.line([x, yt], [xr, yt]); if (C) d.dot([x, yt]);
    run(d, [RL], [xr, yt], [xr, gy], 'right', 66); d.ground([xr, gy]);
    if (o.vo) { d.dot([xr, yt]); d.line([xr, yt], [xr + 45, yt]); d.terminal([xr + 45, yt], { label: o.vo === true ? 'v_o' : o.vo, side: 'right' }); }
    return fin(d, o, 'Centre-tapped full-wave rectifier');
  };
  /** bridge: vs | tx (+vp, ratio), D1..D4 (labels/values), C, RL, vo, IL. Diamond: ac at top/bottom, + at right, − (ground) at left */
  S.bridge = function (o) {
    o = o || {}; var d = S.drawing();
    var cx = 260, cy = 140, h = 62, yt = cy - h - 28, yb = cy + h + 28;
    var s = rectSource(d, o, yt, yb);
    var T = [cx, cy - h], B = [cx, cy + h], Lf = [cx - h, cy], R = [cx + h, cy];
    d.line(s.top, [cx, yt], T); d.line(s.bot, [cx, yb], B);
    [T, B].forEach(function (p) { d.dot(p); });
    var dl = (o.dlabels || ['D_1', 'D_2', 'D_3', 'D_4']);
    var Ds = [o.D1, o.D2, o.D3, o.D4].map(function (x, i) { var sp = diodeSpec(x, i, { label: dl[i] }); return sp; });
    function diag(a, b, sp, side) { var f = 0.2; var a2 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], b2 = [b[0] - (b[0] - a[0]) * f, b[1] - (b[1] - a[1]) * f]; d.line(a, a2); el(d, sp, a2, b2, side); d.line(b2, b); }
    // all diodes point towards the + node (right)
    diag(T, R, Ds[0], 'top'); diag(Lf, T, Ds[1], 'top'); diag(B, R, Ds[2], 'bottom'); diag(Lf, B, Ds[3], 'bottom');
    d.dot(Lf); d.dot(R);
    d.line(Lf, [Lf[0], cy + 22]); d.ground([Lf[0], cy + 22]);
    var xa = R[0] + 40; d.line(R, [xa, cy]);
    var gy = cy + h + 10;
    // load to ground
    var C = spec(o, 'C', 'C', 'C', 'F', false, { polar: !!o.polarC }), RL = spec(o, 'RL', 'R', 'R_L', 'Ω', true);
    var x = xa;
    if (C) { x += 30; d.line([xa, cy], [x, cy]); run(d, [C], [x, cy], [x, gy], 'right', 40); d.ground([x, gy]); }
    var xr = x + (C ? 100 : 70); d.line([x, cy], [xr, cy]); if (C) d.dot([x, cy]);
    run(d, [RL], [xr, cy], [xr, gy], 'right', 66); d.ground([xr, gy]);
    if (o.vo) { d.dot([xr, cy]); d.line([xr, cy], [xr + 45, cy]); d.terminal([xr + 45, cy], { label: o.vo === true ? 'v_o' : o.vo, side: 'right' }); }
    if (o.IL) d.current({ at: [xr, cy + 18], dir: 'down', label: o.IL === true ? 'I_L' : o.IL, side: 'left', len: 14 });
    return fin(d, o, 'Bridge rectifier');
  };
  /** zenerShunt: Vi (source; vi:true for an ac/variable source), R, Vz (zener label/value), PZM (text), RL, vo, currents (I_R, I_Z, I_L) */
  S.zenerShunt = function (o) {
    o = o || {}; var d = S.drawing();
    var x0 = 50, yt = 50, yb = 200;
    var Vi = pv(o, 'Vi', 'V_i', 'V', true);
    if (o.ac) d.acsrc(L(Vi, { from: [x0, yb], to: [x0, yt], side: 'left' })); else d.vsrc(L(Vi, { from: [x0, yb], to: [x0, yt], side: 'left' }));
    var R = spec(o, 'R', 'R', 'R', 'Ω', true);
    var xz = x0 + 150;
    run(d, [R], [x0, yt], [xz, yt], 'top', 62);
    var Vz = pv(o, 'Vz', 'V_Z', 'V', true);
    var zl = Vz.value ? Vz.label + ' = ' + Vz.value : Vz.label;
    var zv = o.PZM ? (typeof o.PZM === 'string' ? o.PZM : 'P_{ZM} = ' + QB.fmt.eng(o.PZM, 'W')) : null;
    d.zener({ from: [xz, yb - 40], to: [xz, yt + 40], label: zl, value: zv, side: 'left' });
    d.line([xz, yt], [xz, yt + 40]); d.line([xz, yb - 40], [xz, yb]);
    d.dot([xz, yt]); d.dot([xz, yb]);
    var xr = xz;
    var RL = spec(o, 'RL', 'R', 'R_L', 'Ω');
    if (RL) { xr = xz + 90; d.line([xz, yt], [xr, yt]); run(d, [RL], [xr, yt], [xr, yb], 'right', 66); d.line([xr, yb], [xz, yb]); }
    d.line([xz, yb], [x0, yb]);
    if (o.currents) {
      d.current({ at: [x0 + 128, yt], dir: 'right', label: 'I_R', side: 'top', len: 14, gap: 9 });
      d.current({ at: [xz, yt + 22], dir: 'down', label: 'I_Z', side: 'right', len: 14 });
      if (RL) d.current({ at: [xr, yt + 22], dir: 'down', label: 'I_L', side: 'left', len: 14 });
    }
    if (o.vo) outPair(d, [xr, yt], [xr, yb], xr + 50, o.vo === true ? 'V_L' : o.vo);
    if (o.ground) d.ground([(x0 + xz) / 2, yb]);
    return fin(d, o, 'Zener shunt regulator');
  };
  /** battery spec helper for clippers: V (value), Vrev (+ at the other end) */
  function batSpec(o, key, sym, rev) { var s = spec(o, key, 'B', sym, 'V'); if (s) s.rev = !!rev; return s; }
  /** clipperSeries: vi, D (spec), rev, V (battery in series with the diode), Vrev, R, vo */
  S.clipperSeries = function (o) {
    o = o || {}; var d = S.drawing();
    var src = { k: 'AC', label: pv(o, 'vi', 'v_i', 'V', true).label, value: pv(o, 'vi', 'v_i', 'V', true).value };
    var D = diodeSpec(o.D, 0, { label: 'D' }); if (o.rev) D.rev = true;
    var top = [D, batSpec(o, 'V', 'V', o.Vrev)]; if (o.Vfirst) top.reverse();
    var R = spec(o, 'R', 'R', 'R', 'Ω', true);
    var g = loop(d, o, src, top, [R], {});
    if (o.vo !== false) outPair(d, [g.xr, g.rp[0][0][1] - 8], [g.xr, g.rp[0][1][1] + 8], g.xr + 55, o.vo && o.vo !== true ? o.vo : 'v_o');
    return fin(d, o, 'Series clipper');
  };
  /**
   * clipperShunt: vi, R (series), D (spec), rev, V (battery in the diode branch), Vrev, zener:true (zener instead of diode),
   * double:true -> second branch D2/V2 (opposite orientation by default), V2, V2rev, vo
   */
  S.clipperShunt = function (o) {
    o = o || {}; var d = S.drawing();
    var x0 = 50, yt = 50, yb = 210;
    var vi = pv(o, 'vi', 'v_i', 'V', true);
    d.acsrc(L(vi, { from: [x0, yb], to: [x0, yt], side: 'left', signs: true }));
    var R = spec(o, 'R', 'R', 'R', 'Ω', true);
    var xb = x0 + 150;
    run(d, [R], [x0, yt], [xb, yt], 'top', 62);
    function branch(x, dk, rev, vkey, vsym, vrev, dl) {
      var D = diodeSpec(o[dk], 0, { label: dl }); if (o.zener) D.k = 'ZD';
      D.rev = !!rev;                     // default (rev false): cathode at the top (diode conducts upward)
      D = Object.assign({}, D); D.rev = !D.rev; // run() goes top->bottom, so flip to put the cathode on top
      var list = [D, batSpec(o, vkey, vsym, !vrev)];
      run(d, list, [x, yt], [x, yb], 'right', list[1] ? 56 : 62);
      d.dot([x, yt]); d.dot([x, yb]);
    }
    branch(xb, 'D', o.rev, 'V', 'V', o.Vrev, o.double ? 'D_1' : 'D');
    var xo = xb;
    if (o.double) { xo = xb + 100; d.line([xb, yt], [xo, yt]); d.line([xo, yb], [xb, yb]); branch(xo, 'D2', o.rev2 != null ? o.rev2 : !o.rev, 'V2', 'V_2', o.V2rev != null ? o.V2rev : !o.Vrev, 'D_2'); if (o.V) { /* relabel first battery */ } }
    var RL = spec(o, 'RL', 'R', 'R_L', 'Ω');
    if (RL) { var xl = xo + 90; d.line([xo, yt], [xl, yt]); run(d, [RL], [xl, yt], [xl, yb], 'right', 66); d.line([xl, yb], [xo, yb]); xo = xl; }
    d.line([xb, yb], [x0, yb]);
    if (o.vo !== false) outPair(d, [xo, yt], [xo, yb], xo + 50, o.vo && o.vo !== true ? o.vo : 'v_o');
    return fin(d, o, 'Shunt clipper');
  };
  /** clamper: vi, C (series), D (shunt; default cathode up = output clamped below), rev, V (battery in the diode branch), Vrev, R (load), vo */
  S.clamper = function (o) {
    o = o || {}; var d = S.drawing();
    var x0 = 50, yt = 50, yb = 210;
    var vi = pv(o, 'vi', 'v_i', 'V', true);
    d.acsrc(L(vi, { from: [x0, yb], to: [x0, yt], side: 'left', signs: true }));
    var C = spec(o, 'C', 'C', 'C', 'F', true);
    var xb = x0 + 140;
    run(d, [C], [x0, yt], [xb, yt], 'top', 30);
    var D = diodeSpec(o.D, 0, { label: 'D' }); D.rev = !o.rev;
    var list = [D, batSpec(o, 'V', 'V', !o.Vrev)];
    run(d, list, [xb, yt], [xb, yb], 'right', list[1] ? 56 : 62);
    d.dot([xb, yt]); d.dot([xb, yb]);
    var R = spec(o, 'R', 'R', 'R', 'Ω', true);
    var xr = xb + 90; d.line([xb, yt], [xr, yt]); run(d, [R], [xr, yt], [xr, yb], 'right', 66); d.line([xr, yb], [x0, yb]);
    if (o.vo !== false) outPair(d, [xr, yt], [xr, yb], xr + 50, o.vo && o.vo !== true ? o.vo : 'v_o');
    return fin(d, o, 'Clamper');
  };

  /* ------------------------------------------------------------ OP-AMPS */
  function supplies(d, oa, o) {
    if (!o.supplies && !o.Vpos) return;
    var vp = pv(o, 'Vpos', '+V_{CC}', 'V', true), vn = pv(o, 'Vneg', '−V_{EE}', 'V', true);
    d.line(oa.vpos, [oa.vpos[0], oa.vpos[1] - 12]); d.rail([oa.vpos[0], oa.vpos[1] - 12], { label: vp.label, value: vp.value });
    d.line(oa.vneg, [oa.vneg[0], oa.vneg[1] + 12]); d.rail([oa.vneg[0], oa.vneg[1] + 12], { label: vn.label, value: vn.value, dir: 'down' });
  }
  function inTerm(d, p, o, key, sym, x) {
    var v = pv(o, key, sym, 'V', true);
    d.terminal([x, p[1]], { label: v.label, value: v.value, side: 'left' });
  }
  function outTerm(d, out, o, x) {
    var xo = out[0] + 26;
    d.line(out, [xo, out[1]]); d.dot([xo, out[1]]);
    var RL = spec(o, 'RL', 'R', 'R_L', 'Ω');
    var xe = xo + 40;
    if (RL) { var xl = xo + 50; d.line([xo, out[1]], [xl, out[1]]); run(d, [RL], [xl, out[1]], [xl, out[1] + 100], 'right', 62); d.ground([xl, out[1] + 100]); xe = xl + 40; d.dot([xl, out[1]]); d.line([xl, out[1]], [xe, out[1]]); }
    else d.line([xo, out[1]], [xe, out[1]]);
    var vo = pv(o, 'vo', 'v_o', 'V', true);
    d.terminal([xe, out[1]], { label: vo.label, value: vo.value, side: 'right' });
    return xo;
  }
  function gndOrR(d, p, o, key, sym, xg) {
    var R = spec(o, key, 'R', sym, 'Ω');
    d.line(p, [xg, p[1]]);
    if (R) { run(d, [R], [xg, p[1]], [xg, p[1] + 66], 'left', 50); d.ground([xg, p[1] + 66]); }
    else { d.line([xg, p[1]], [xg, p[1] + 18]); d.ground([xg, p[1] + 18]); }
  }
  /** opInverting: R1 (input), Rf, vi, vo, Rp (resistor from + to ground), RL, supplies:true | Vpos/Vneg, Cf (capacitor across Rf) */
  S.opInverting = function (o) {
    o = o || {}; var d = S.drawing();
    var oa = d.opamp({ at: [230, 130], anchor: 'inv', label: o.label , supplies: !!(o.supplies || o.Vpos) });
    var xn = 200, yi = oa.inv[1];
    d.line(oa.inv, [xn, yi]); d.dot([xn, yi]);
    run(d, [spec(o, 'R1', 'R', 'R_1', 'Ω', true)], [80, yi], [xn, yi], 'top', 62);
    inTerm(d, [80, yi], o, 'vi', 'v_i', 80);
    var yf = yi - (o.supplies || o.Vpos ? 85 : 60), xo = oa.out[0] + 26;
    d.line([xn, yi], [xn, yf]);
    var Cf = spec(o, 'Cf', 'C', 'C_f', 'F');
    run(d, [spec(o, 'Rf', 'R', 'R_f', 'Ω', true)], [xn, yf], [xo, yf], 'top', 62);
    if (Cf) { var yc = yf - 50; d.dot([xn, yf]); d.dot([xo, yf]); d.line([xn, yf], [xn, yc]); run(d, [Cf], [xn, yc], [xo, yc], 'top', 20); d.line([xo, yc], [xo, yf]); }
    d.line([xo, yf], [xo, oa.out[1]]);
    gndOrR(d, oa.noninv, o, 'Rp', 'R_p', xn - 10);
    outTerm(d, oa.out, o);
    supplies(d, oa, o);
    return fin(d, o, 'Inverting amplifier');
  };
  /** opNonInverting: R1 (to ground), Rf, vi, vo, Rs (source resistor into +), RL, supplies */
  S.opNonInverting = function (o) {
    o = o || {}; var d = S.drawing();
    var oa = d.opamp({ at: [230, 100], anchor: 'noninv', plusTop: true, label: o.label , supplies: !!(o.supplies || o.Vpos) });
    var Rs = spec(o, 'Rs', 'R', 'R_s', 'Ω');
    if (Rs) run(d, [Rs], [90, 100], [230, 100], 'top', 62); else d.line([90, 100], [230, 100]);
    inTerm(d, [90, 100], o, 'vi', 'v_i', 90);
    var xn = 200, yi = oa.inv[1], yf = yi + 56, xo = oa.out[0] + 26;
    d.line(oa.inv, [xn, yi], [xn, yf]); d.dot([xn, yf]);
    run(d, [spec(o, 'Rf', 'R', 'R_f', 'Ω', true)], [xn, yf], [xo, yf], 'bottom', 62);
    d.line([xo, yf], [xo, oa.out[1]]);
    run(d, [spec(o, 'R1', 'R', 'R_1', 'Ω', true)], [xn, yf], [xn, yf + 72], 'left', 56); d.ground([xn, yf + 72]);
    outTerm(d, oa.out, o);
    supplies(d, oa, o);
    return fin(d, o, 'Non-inverting amplifier');
  };
  /**
   * opSumming: inputs: N | [{v:'v_1', R:'10 kΩ'} | 'v_1'] (default 3), Rf, vo, Rp, RL, supplies.
   * R values may also come from R1..R4 keys.
   */
  S.opSumming = function (o) {
    o = o || {}; var d = S.drawing();
    var ins = Array.isArray(o.inputs) ? o.inputs : new Array(o.inputs || o.N || 3).fill(null);
    var n = ins.length, sp = 56;
    var yi0 = 60 + (n + 0) * sp;              // y of the inverting input
    var oa = d.opamp({ at: [250, yi0], anchor: 'inv', label: o.label , supplies: !!(o.supplies || o.Vpos) });
    var xb = 205;
    d.line(oa.inv, [xb, yi0]);
    var ytop = yi0 - (n - 1) * sp;
    ins.forEach(function (it, i) {
      var y = ytop + i * sp, k = i + 1;
      var v = it && typeof it === 'object' ? it.v : it, Rv = it && typeof it === 'object' ? it.R : null;
      var Rk = pv(o, 'R' + k, 'R_' + k, 'Ω', true); if (Rv != null) Rk.value = typeof Rv === 'number' ? QB.fmt.eng(Rv, 'Ω') : Rv;
      run(d, [{ k: 'R', label: Rk.label, value: Rk.value }], [80, y], [xb, y], 'top', 60);
      var vv = String(v || ('v_' + k)).split(' = ');
      d.terminal([80, y], { label: vv[0], value: vv[1] || null, side: 'left' });
      if (i < n - 1) d.dot([xb, y]);
    });
    var yf = ytop - sp, xo = oa.out[0] + 26;
    d.line([xb, yi0], [xb, yf]); d.dot([xb, yi0 - 0.01]);
    run(d, [spec(o, 'Rf', 'R', 'R_f', 'Ω', true)], [xb, yf], [xo, yf], 'top', 62);
    d.line([xo, yf], [xo, oa.out[1]]);
    gndOrR(d, oa.noninv, o, 'Rp', 'R_p', xb + 15);
    outTerm(d, oa.out, o);
    supplies(d, oa, o);
    return fin(d, o, 'Summing amplifier');
  };
  /** opFollower: vi, Rs (source resistance), vo, RL, supplies */
  S.opFollower = function (o) {
    o = o || {}; var d = S.drawing();
    var oa = d.opamp({ at: [230, 120], anchor: 'inv', label: o.label , supplies: !!(o.supplies || o.Vpos) });
    var xn = 205, yf = oa.inv[1] - 40, xo = oa.out[0] + 26;
    d.line(oa.inv, [xn, oa.inv[1]], [xn, yf], [xo, yf], [xo, oa.out[1]]);
    var Rs = spec(o, 'Rs', 'R', 'R_s', 'Ω'), yn = oa.noninv[1];
    if (Rs) run(d, [Rs], [90, yn], oa.noninv, 'bottom', 62); else d.line([110, yn], oa.noninv);
    inTerm(d, [Rs ? 90 : 110, yn], o, 'vi', 'v_i', Rs ? 90 : 110);
    outTerm(d, oa.out, o);
    supplies(d, oa, o);
    return fin(d, o, 'Voltage follower');
  };
  /**
   * diffPair: BJT differential amplifier. VCC, VEE, RC (both; or RC1/RC2), RE (tail resistor) | tail:'I' (current source, IEE label),
   * RB (base resistors to ground), v1, v2 (input terminals; vs:true -> ac sources), vo1, vo2 (collector outputs), vo (differential label), beta, currents
   */
  S.diffPair = function (o) {
    o = o || {}; var d = S.drawing();
    var x1 = 190, x2 = 330, yT = 40, yCn = 112, yCp = 140;
    var q1 = d.bjt({ at: [x1, yCp], anchor: 'collector', label: 'Q_1', labelSide: 'left' });
    var q2 = d.bjt({ at: [x2, yCp], anchor: 'collector', flipX: true, label: 'Q_2', labelSide: 'right' });
    var VCC = pv(o, 'VCC', 'V_{CC}', 'V', true), VEE = pv(o, 'VEE', '−V_{EE}', 'V', true);
    var xm = (x1 + x2) / 2;
    d.rail([xm, yT - 16], { label: VCC.label, value: VCC.value }); d.line([xm, yT - 16], [xm, yT]); d.dot([xm, yT]);
    d.line([x1, yT], [x2, yT]);
    var RC1 = pv(o, o.RC1 ? 'RC1' : 'RC', o.RC1 ? 'R_{C1}' : 'R_C', 'Ω', true), RC2 = pv(o, o.RC2 ? 'RC2' : 'RC', o.RC2 ? 'R_{C2}' : 'R_C', 'Ω', true);
    d.resistor(L(RC1, { from: [x1, yT], to: [x1, yCn], side: 'left' })); d.line([x1, yCn], q1.collector);
    d.resistor(L(RC2, { from: [x2, yT], to: [x2, yCn], side: 'right' })); d.line([x2, yCn], q2.collector);
    var ye = q1.emitter[1] + 18, yt2 = ye + 90;
    d.line(q1.emitter, [x1, ye], [x2, ye], q2.emitter); d.dot([xm, ye]);
    if (o.tail === 'I') { var I = pv(o, 'IEE', 'I_{EE}', 'A', true); d.isrc(L(I, { from: [xm, ye], to: [xm, yt2], side: 'right' })); }
    else d.resistor(L(pv(o, 'RE', 'R_E', 'Ω', true), { from: [xm, ye], to: [xm, yt2], side: 'right' }));
    d.line([xm, yt2], [xm, yt2 + 8]); d.rail([xm, yt2 + 8], { label: VEE.label, value: VEE.value, dir: 'down' });
    // inputs
    var RB = spec(o, 'RB', 'R', 'R_B', 'Ω');
    [[q1.base, -1, 'v1', 'v_{i1}'], [q2.base, 1, 'v2', 'v_{i2}']].forEach(function (t) {
      var b = t[0], s = t[1], xe = b[0] + s * 60;
      d.line(b, [xe, b[1]]);
      if (RB) { var xr = b[0] + s * 30; d.dot([xr, b[1]]); run(d, [{ k: 'R', label: RB.label, value: RB.value }], [xr, b[1]], [xr, b[1] + 70], s < 0 ? 'right' : 'left', 50); d.ground([xr, b[1] + 70]); }
      var v = pv(o, t[2], t[3], 'V', true);
      if (o.vs) { d.acsrc({ from: [xe, b[1] + 70], to: [xe, b[1]], label: v.label, value: v.value, side: s < 0 ? 'left' : 'right', signs: true }); d.ground([xe, b[1] + 70]); }
      else d.terminal([xe, b[1]], { label: v.label, side: s < 0 ? 'left' : 'right' });
    });
    if (o.vo1) { d.dot([x1, yCn]); d.line([x1, yCn], [x1 + 34, yCn]); d.terminal([x1 + 34, yCn], { label: o.vo1 === true ? 'v_{o1}' : o.vo1, side: 'bottom' }); }
    if (o.vo2) { d.dot([x2, yCn]); d.line([x2, yCn], [x2 - 34, yCn]); d.terminal([x2 - 34, yCn], { label: o.vo2 === true ? 'v_{o2}' : o.vo2, side: 'bottom' }); }
    if (o.vo && o.vo1 && o.vo2) { d.label([x1 + 42, yCn - 14], '+', { plain: true }); d.label([x2 - 42, yCn - 14], '−', { plain: true }); d.label([xm, yCn - 14], o.vo === true ? 'v_o' : o.vo); }
    if (o.beta) d.label([xm, yCp + 4], typeof o.beta === 'number' ? 'β = ' + o.beta : o.beta, { plain: true });
    if (o.currents) {
      d.current({ at: [x1, yCn + 15], dir: 'down', label: 'I_{C1}', side: 'right', len: 14, gap: 8 });
      d.current({ at: [x2, yCn + 15], dir: 'down', label: 'I_{C2}', side: 'left', len: 14, gap: 8 });
      d.current({ at: [xm, ye + 20], dir: 'down', label: o.tail === 'I' ? null : 'I_E', side: 'left', len: 14 });
    }
    return fin(d, o, 'Differential amplifier');
  };
  /** classA: series-fed class A (fixed bias). VCC, RB, RC (load), RE, beta, C1, vi, vo, currents, nodes — same keys as bjtFixedBias */
  S.classA = function (o) {
    o = Object.assign({ C1: true, vi: true }, o || {});
    var d = S.drawing();
    var st = S._stage(d, o, { K: { dev: 'bjt', supply: 'VCC', top: 'RC', bias: 'RB', b1: 'R1', b2: 'R2', em: 'RE', em1: 'RE1', em2: 'RE2', byp: 'CE', sym: { VCC: 'V_{CC}', RC: 'R_C', RB: 'R_B', R1: 'R_1', R2: 'R_2', RE: 'R_E', RE1: 'R_{E1}', RE2: 'R_{E2}', CE: 'C_E' }, nodes: ['V_B', 'V_C', 'V_E'], cur: ['I_B', 'I_C', 'I_E'] }, bias: o.R1 ? 'vdb' : 'fixed', xb: 120, xc: 220 });
    S._inputChain(d, st.bnode, o, st.gy, {});
    if (o.vo) { d.dot(st.cnode); d.line(st.cnode, [st.cnode[0] + 50, st.cnode[1]]); d.terminal([st.cnode[0] + 50, st.cnode[1]], { label: o.vo === true ? 'v_o' : o.vo, side: 'right' }); }
    return fin(d, o, 'Series-fed class A amplifier');
  };
  /** classATransformer: VCC, R1+R2 (or RB), RE, CE, beta, ratio ('N_1 : N_2'), RL (secondary load), C1, vi, vs, Rs, currents */
  S.classATransformer = function (o) {
    o = o || {}; var d = S.drawing();
    var xb = 120, xc = 230, yT = 40, h = 80, yCp = yT + h + 40;
    var VCC = pv(o, 'VCC', 'V_{CC}', 'V', true);
    d.rail([xc, yT - 18], { label: VCC.label, value: VCC.value }); d.line([xc, yT - 18], [xc, yT]);
    d.line([xb, yT], [xc, yT]); d.dot([xc, yT]);
    var tx = d.transformer({ at: [xc, yT], h: h, w: 90, dots: o.dots || false, ratio: o.ratio || null });
    d.line(tx.p2, [xc, yCp]);
    var q = d.bjt({ at: [xc, yCp], anchor: 'collector', label: o.Q || null, value: o.beta ? (typeof o.beta === 'number' ? 'β = ' + o.beta : o.beta) : null, labelSide: 'left' });
    var RL = pv(o, 'RL', 'R_L', 'Ω', true), xl = tx.s1[0] + 40;
    d.line(tx.s1, [xl, yT]); d.line(tx.s2, [xl, yT + h]);
    d.resistor(L(RL, { from: [xl, yT], to: [xl, yT + h], side: 'right' }));
    var RE = pv(o, 'RE', 'R_E', 'Ω'), CE = pv(o, 'CE', 'C_E', 'F');
    var gy = q.emitter[1] + 90, yB = q.base[1];
    if (RE.on) {
      d.resistor(L(RE, { from: q.emitter, to: [xc, gy], side: 'right' }));
      if (CE.on) { var yb = q.emitter[1] + 12, xce = xc + 70; d.dot([xc, yb]); d.line([xc, yb], [xce, yb]); d.capacitor(L(CE, { from: [xce, yb], to: [xce, gy], side: 'right', polar: o.polarC })); d.ground([xce, gy]); }
    } else d.line(q.emitter, [xc, gy]);
    d.ground([xc, gy]);
    if (o.R1 || o.R2) {
      d.resistor(L(pv(o, 'R1', 'R_1', 'Ω', true), { from: [xb, yT], to: [xb, yB], side: 'left' }));
      d.resistor(L(pv(o, 'R2', 'R_2', 'Ω', true), { from: [xb, yB], to: [xb, gy], side: 'left' })); d.ground([xb, gy]);
    } else d.resistor(L(pv(o, 'RB', 'R_B', 'Ω', true), { from: [xb, yT], to: [xb, yB], side: 'left' }));
    d.dot([xb, yB]); d.line([xb, yB], q.base);
    S._inputChain(d, [xb, yB], Object.assign({ C1: true }, o), gy, {});
    if (o.currents) { d.current({ at: [xc, yCp - 20], dir: 'down', label: 'I_C', side: 'left', len: 14 }); d.current({ at: [xl, yT + 20], dir: 'down', label: 'I_L', side: 'left', len: 14, gap: 9 }); }
    return fin(d, o, 'Transformer-coupled class A amplifier');
  };
  /**
   * classBPushPull: complementary-symmetry class B / AB. VCC, VEE (omit -> single supply with ground), RL,
   * bias:'none'|'diodes'|'R' (diodes: R1-D1-D2-R2 string; R: R1-R2-R3), vi, C1 (input cap), vo, currents
   */
  S.classBPushPull = function (o) {
    o = o || {}; var d = S.drawing();
    var xc = 260, yo = 190;
    var qn = d.bjt({ at: [xc, yo - 18], anchor: 'emitter', label: o.Qn || 'Q_1', labelSide: 'right' });
    var qp = d.bjt({ at: [xc, yo + 18], anchor: 'emitter', type: 'pnp', flipY: true, label: o.Qp || 'Q_2', labelSide: 'right' });
    d.line(qn.emitter, [xc, yo]); d.line(qp.emitter, [xc, yo]); d.dot([xc, yo]);
    var VCC = pv(o, 'VCC', 'V_{CC}', 'V', true), VEE = pv(o, 'VEE', '−V_{CC}', 'V');
    var yT = qn.collector[1] - 40, yB = qp.collector[1] + 40;
    d.line(qn.collector, [xc, yT]); d.rail([xc, yT], { label: VCC.label, value: VCC.value });
    var bias = o.bias || 'none', xb = qn.base[0] - 50;
    if (bias === 'none') {
      d.line(qn.base, [xb + 26, qn.base[1]], [xb + 26, qp.base[1]], qp.base);
      var nin = [xb + 26, yo]; d.dot(nin);
      S._inputChain(d, nin, Object.assign({ C1: false }, o, { vi: o.vi == null ? true : o.vi }), yB, {});
    } else {
      // bias string at xb
      d.line(qn.base, [xb, qn.base[1]]); d.line(qp.base, [xb, qp.base[1]]);
      d.dot([xb, qn.base[1]]); d.dot([xb, qp.base[1]]);
      d.line([xb, yT + 0.01], [xc, yT + 0.01]); d.dot([xc, yT]);
      d.resistor(L(pv(o, 'R1', 'R_1', 'Ω', true), { from: [xb, yT], to: [xb, qn.base[1]], side: 'left' }));
      if (bias === 'diodes') {
        d.diode({ from: [xb, qn.base[1]], to: [xb, yo - 2], label: 'D_1', side: 'right' });
        d.diode({ from: [xb, yo + 2], to: [xb, qp.base[1]], label: 'D_2', side: 'right' });
        d.line([xb, yo - 2], [xb, yo + 2]);
      } else d.resistor(L(pv(o, 'R2', 'R_2', 'Ω', true), { from: [xb, qn.base[1]], to: [xb, qp.base[1]], side: 'left' }));
      d.resistor(L(pv(o, bias === 'R' ? 'R3' : 'R2', bias === 'R' ? 'R_3' : 'R_2', 'Ω', true), { from: [xb, qp.base[1]], to: [xb, yB], side: 'left' }));
      d.line([xb, yB], [xc, yB]);
      var nin2 = [xb, bias === 'diodes' ? yo : qn.base[1]];
      // input via capacitor to the mid-point (diodes) or to the upper base
      S._inputChain(d, nin2, Object.assign({ C1: true }, o, { vi: o.vi == null ? true : o.vi }), yB + 60, {});
    }
    d.line(qp.collector, [xc, yB]);
    if (VEE.on) { if (bias !== 'none') d.dot([xc, yB]); d.line([xc, yB], [xc, yB + 10]); d.rail([xc, yB + 10], { label: VEE.label, value: VEE.value, dir: 'down' }); }
    else { if (bias !== 'none') d.dot([xc, yB]); d.ground([xc, yB]); }
    var Cout = spec(o, 'Cout', 'C', 'C', 'F');
    var xr = xc + 80;
    if (Cout) { run(d, [Cout], [xc, yo], [xr, yo], 'top', 20); xr += 30; d.line([xr - 30, yo], [xr, yo]); } else d.line([xc, yo], [xr, yo]);
    var RL = pv(o, 'RL', 'R_L', 'Ω', true);
    d.resistor(L(RL, { from: [xr, yo], to: [xr, yo + 80], side: 'right' })); d.ground([xr, yo + 80]);
    if (o.vo) { d.dot([xr, yo]); d.line([xr, yo], [xr + 40, yo]); d.terminal([xr + 40, yo], { label: o.vo === true ? 'v_o' : o.vo, side: 'right' }); }
    if (o.currents) d.current({ at: [xr, yo + 20], dir: 'down', label: 'i_L', side: 'left', len: 14 });
    return fin(d, o, 'Class B push-pull amplifier');
  };

  /* ------------------------------------------------------------ AC CIRCUITS */
  /** source spec for AC circuits: V (label/value), dc:true -> dc source */
  function acSrc(o, key, sym) { var p = pv(o, key || 'V', sym || 'V', 'V', true); return { k: o.dc ? 'V' : 'AC', label: p.label, value: p.value, signs: true }; }
  var KSYM = { R: ['R', 'R', 'Ω'], L: ['L', 'L', 'H'], C: ['C', 'C', 'F'], Z: ['Z', 'Z', 'Ω'], X: ['L', 'jX', 'Ω'] };
  /** seriesRLC: V, R, L (or XL), C (or XC), Z (box), order:'RLC' (letters R L C Z), I (current label), drops:true (V_R, V_L, V_C marks), vo */
  S.seriesRLC = function (o) {
    o = o || {}; var d = S.drawing();
    var order = (o.order || 'RLCZ').split('');
    var els = [];
    order.forEach(function (k) {
      if (k === 'R' && o.R != null && o.R !== false) els.push(spec(o, 'R', 'R', 'R', 'Ω'));
      if (k === 'L' && (o.L || o.XL)) els.push(spec(o, o.XL ? 'XL' : 'L', 'L', o.XL ? 'jX_L' : 'L', o.XL ? 'Ω' : 'H'));
      if (k === 'C' && (o.C || o.XC)) els.push(spec(o, o.XC ? 'XC' : 'C', 'C', o.XC ? '−jX_C' : 'C', o.XC ? 'Ω' : 'F'));
      if (k === 'Z' && o.Z) els.push(spec(o, 'Z', 'Z', 'Z', 'Ω'));
    });
    var top = els.slice(), right = [];
    if (top.length > 2) right = [top.pop()];
    var g = loop(d, o, acSrc(o), top, right, { minW: 200 });
    if (o.I) d.current({ at: [g.x0 + 24, g.yt], dir: 'right', label: o.I === true ? 'I' : o.I, side: 'top', len: 14, gap: 9 });
    if (o.drops) {
      g.tp.forEach(function (s, i) { var e = top[i]; d.polarity({ a: s[0], b: s[1], label: 'V_' + (e.k === 'Z' ? 'Z' : e.k), side: 'bottom', gap: 16 }); });
      g.rp.forEach(function (s, i) { var e = right[i]; d.polarity({ a: s[0], b: s[1], label: 'V_' + e.k, side: 'left', gap: 26 }); });
    }
    return fin(d, o, 'Series RLC circuit');
  };
  /** generic parallel branches from a source: branches = list of element specs (one per branch; an array = series elements in that branch) */
  function parallelCkt(d, o, branches, cfg) {
    cfg = cfg || {};
    var x0 = 50, yt = 50, yb = 200;
    el(d, acSrc(o), [x0, yb], [x0, yt], 'left');
    var Rs = spec(o, 'Rs', 'R', 'R_s', 'Ω');
    var x = x0;
    if (Rs) { run(d, [Rs], [x0, yt], [x0 + 110, yt], 'top', 62); x = x0 + 110; }
    var xs = [];
    branches.forEach(function (b, i) {
      var xb = x + 80 + i * 90;
      xs.push(xb);
      var list = Array.isArray(b) ? b : [b];
      run(d, list, [xb, yt], [xb, yb], 'right', list.length > 1 ? 54 : 66);
    });
    var xl = xs[xs.length - 1];
    d.line([x, yt], [xl, yt]); d.line([xl, yb], [x0, yb]);
    xs.forEach(function (xx, i) { if (i < xs.length - 1) { d.dot([xx, yt]); d.dot([xx, yb]); } });
    if (o.currents) {
      d.current({ at: [x + 34, yt], dir: 'right', label: 'I', side: 'top', len: 14, gap: 9 });
      xs.forEach(function (xx, i) { var lb = cfg.ilabels && cfg.ilabels[i]; if (lb) d.current({ at: [xx, yt + 22], dir: 'down', label: lb, side: 'left', len: 14 }); });
    }
    return { xs: xs, yt: yt, yb: yb };
  }
  /** parallelRL: V, R, L (or XL), Rs (series source resistance), RL2 (series R in the L branch, coil resistance), currents (I, I_R, I_L) */
  S.parallelRL = function (o) {
    o = o || {}; var d = S.drawing();
    var R = spec(o, 'R', 'R', 'R', 'Ω', true), Lb = spec(o, o.XL ? 'XL' : 'L', 'L', o.XL ? 'jX_L' : 'L', o.XL ? 'Ω' : 'H', true);
    var Lbr = o.RLs ? [spec(o, 'RLs', 'R', 'R_L', 'Ω'), Lb] : Lb;
    parallelCkt(d, o, [R, Lbr], { ilabels: ['I_R', 'I_L'] });
    return fin(d, o, 'Parallel RL circuit');
  };
  /** parallelRC: V, R, C (or XC), Rs, currents (I, I_R, I_C) */
  S.parallelRC = function (o) {
    o = o || {}; var d = S.drawing();
    var R = spec(o, 'R', 'R', 'R', 'Ω', true), C = spec(o, o.XC ? 'XC' : 'C', 'C', o.XC ? '−jX_C' : 'C', o.XC ? 'Ω' : 'F', true);
    parallelCkt(d, o, [R, C], { ilabels: ['I_R', 'I_C'] });
    return fin(d, o, 'Parallel RC circuit');
  };
  /**
   * loadWithPFCap: V (source), load:'box'|'RL'|'motor' (box text from P/pf: e.g. P:'10 kW', pf:'0.7 lag'),
   * R/X labels for load:'RL', C (correction capacitor; omit to leave it out), sw:true (switch in the capacitor branch),
   * Zline (line impedance box), currents (I_s, I_L, I_C)
   */
  S.loadWithPFCap = function (o) {
    o = o || {}; var d = S.drawing();
    var x0 = 50, yt = 50, yb = 220;
    el(d, acSrc(o), [x0, yb], [x0, yt], 'left');
    var x = x0;
    var Zl = spec(o, 'Zline', 'Z', 'Z_{line}', 'Ω');
    if (Zl) { run(d, [Zl], [x0, yt], [x0 + 120, yt], 'top', 50); x = x0 + 120; }
    var C = spec(o, 'C', 'C', 'C', 'F');
    var xl = x + 100, xc = C ? xl + 110 : xl;
    d.line([x, yt], [xc, yt]); d.line([xc, yb], [x0, yb]);
    if (C) { d.dot([xl, yt]); d.dot([xl, yb]); }
    var kind = o.load || 'box';
    if (kind === 'RL') {
      run(d, [spec(o, 'R', 'R', 'R', 'Ω', true), spec(o, o.XL ? 'XL' : 'X', 'L', 'jX_L', 'Ω', true)], [xl, yt], [xl, yb], 'right', 56);
    } else if (kind === 'motor') {
      d.line([xl, yt], [xl, yt + 50]); d.mach({ from: [xl, yt + 50], to: [xl, yb - 50], text: 'M', label: o.loadLabel || null, value: o.P ? o.P + (o.pf ? ', ' + o.pf : '') : null, side: 'right' }); d.line([xl, yb - 50], [xl, yb]);
    } else {
      var lines = ['\\text{Load}'];
      if (o.P) lines.push(o.P); if (o.pf) lines.push(o.pf);
      var bh = Math.max(56, lines.length * 17 + 14);
      d.line([xl, yt], [xl, (yt + yb) / 2 - bh / 2]); d.line([xl, (yt + yb) / 2 + bh / 2], [xl, yb]);
      d.box({ at: [xl, (yt + yb) / 2], anchor: 'center', label: lines, italic: false, w: 84, h: bh });
    }
    if (C) {
      var list = o.sw ? [{ k: 'SW', label: null, closed: o.sw === 'closed' }, C] : [C];
      run(d, list, [xc, yt], [xc, yb], 'right', list.length > 1 ? 50 : 60);
    } else { /* no capacitor: shorten */ }
    if (o.currents) {
      d.current({ at: [x + 34, yt], dir: 'right', label: 'I_s', side: 'top', len: 14, gap: 9 });
      d.current({ at: [xl, yt + 18], dir: 'down', label: 'I_L', side: 'left', len: 12 });
      if (C) d.current({ at: [xc, yt + 18], dir: 'down', label: 'I_C', side: 'left', len: 12 });
    }
    return fin(d, o, 'Load with power-factor correction');
  };
  /** element(s) along an arm a->b for 3-phase loads; kind 'box'|'R'|'RL'|'RC' */
  function arm(d, a, b, kind, lab, side) {
    var list;
    if (kind === 'R') list = [{ k: 'R', label: lab.R || lab.Z, value: lab.v }];
    else if (kind === 'RL') list = [{ k: 'R', label: lab.R || 'R' }, { k: 'L', label: lab.X || 'jX' }];
    else if (kind === 'RC') list = [{ k: 'R', label: lab.R || 'R' }, { k: 'C', label: lab.X || '−jX' }];
    else list = [{ k: 'Z', label: lab.Z, value: lab.v }];
    run(d, list, a, b, side, list.length > 1 ? 44 : 50);
  }
  /**
   * starLoad: Z (label for all) or Za/Zb/Zc, value (Z value text), kind:'box'|'R'|'RL'|'RC', neutral:true,
   * lines: ['A','B','C'] labels, VL (line-voltage text at the terminals), currents (I_A, I_B, I_C), Vph (phase-voltage mark on arm a)
   */
  S.starLoad = function (o) {
    o = o || {}; var d = S.drawing();
    var N = [330, 160], R = o.kind === 'RL' || o.kind === 'RC' ? 140 : 125;
    var ang = [-90, 150, 30];
    var ends = ang.map(function (a) { var t = a * Math.PI / 180; return [N[0] + R * Math.cos(t), N[1] + R * Math.sin(t)]; });
    var ph = o.phases || ['a', 'b', 'c'];
    var zl = [o.Za || o.Z || 'Z_{' + ph[0] + '}', o.Zb || o.Z || 'Z_{' + ph[1] + '}', o.Zc || o.Z || 'Z_{' + ph[2] + '}'];
    ends.forEach(function (e, i) { arm(d, e, N, o.kind || 'box', { Z: o.Z === true ? 'Z' : zl[i], v: o.value }, i === 0 ? 'right' : i === 1 ? 'left' : 'right'); });
    d.dot(N); d.labelNear(N, 'N', { prefer: ['right', 'bottomright'], gap: 8 });
    var lines = o.lines || ['A', 'B', 'C'], xl = 60;
    var yA = ends[0][1] - 0, yB = ends[1][1], yC = N[1] + 145, xCr = ends[2][0] + 30;
    d.line(ends[0], [ends[0][0], yA], [xl, yA]);
    d.line(ends[1], [xl, yB]);
    d.line(ends[2], [xCr, ends[2][1]], [xCr, yC], [xl, yC]);
    var tl = [[xl, yA], [xl, yB], [xl, yC]];
    if (o.neutral) { var yN = N[1] + 105; d.line(N, [N[0], yN], [xl, yN]); tl.push([xl, yN]); }
    tl.forEach(function (p, i) { d.terminal(p, { label: i < 3 ? lines[i] : 'N', side: 'left' }); });
    if (o.currents) tl.slice(0, 3).forEach(function (p, i) { d.current({ at: [p[0] + 45, p[1]], dir: 'right', label: 'I_' + lines[i], side: 'top', len: 14, gap: 8 }); });
    if (o.VL) d.label([xl - 30, (yA + yB) / 2], o.VL, { anchor: 'end', plain: true });
    return fin(d, o, 'Star-connected load');
  };
  /** deltaLoad: Z or Zab/Zbc/Zca, value, kind, lines, currents (line currents), phaseCurrents:true (I_AB ...), VL */
  S.deltaLoad = function (o) {
    o = o || {}; var d = S.drawing();
    var A = [330, 50], B = [215, 249], C = [445, 249];
    var lines = o.lines || ['A', 'B', 'C'];
    var nm = function (a, b) { return 'Z_{' + lines[a] + lines[b] + '}'; };
    var zl = [o.Zab || o.Z || nm(0, 1), o.Zbc || o.Z || nm(1, 2), o.Zca || o.Z || nm(2, 0)];
    var k = o.kind || 'box';
    arm(d, A, B, k, { Z: o.Z === true ? 'Z' : zl[0], v: o.value }, 'left');
    arm(d, B, C, k, { Z: o.Z === true ? 'Z' : zl[1], v: o.value }, 'bottom');
    arm(d, C, A, k, { Z: o.Z === true ? 'Z' : zl[2], v: o.value }, 'right');
    [A, B, C].forEach(function (p) { d.dot(p); });
    var xl = 60, yA = A[1], yB = B[1] + 30, yC = C[1] + 60;
    d.line(A, [xl, yA]); d.line(B, [B[0], yB], [xl, yB]); d.line(C, [C[0], yC], [xl, yC]);
    var tl = [[xl, yA], [xl, yB], [xl, yC]];
    tl.forEach(function (p, i) { d.terminal(p, { label: lines[i], side: 'left' }); });
    if (o.currents) tl.forEach(function (p, i) { d.current({ at: [p[0] + 45, p[1]], dir: 'right', label: 'I_' + lines[i], side: 'top', len: 14, gap: 8 }); });
    if (o.phaseCurrents) {
      var mid = function (p, q, f) { return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; };
      d.labelNear(mid(A, B, 0.15), 'I_{' + lines[0] + lines[1] + '}', { prefer: ['left'], gap: 10 });
      var pa = mid(A, B, 0.1), pb = mid(A, B, 0.2); d.arrowHead(pb, [pb[0] - pa[0], pb[1] - pa[1]]);
    }
    if (o.VL) d.label([xl - 30, (yA + yB) / 2], o.VL, { anchor: 'end', plain: true });
    return fin(d, o, 'Delta-connected load');
  };
  /**
   * batteryModel: E (emf), r (internal resistance), box:true (dashed outline around the cell), RL (load), sw (switch), I, V (terminal voltage),
   * norton:true (current source I_N with parallel r)
   */
  S.batteryModel = function (o) {
    o = o || {}; var d = S.drawing();
    var x0 = 60, yt = 50, yb = 200, xt = 200;
    var r = pv(o, 'r', o.norton ? 'R_N' : 'r', 'Ω', true);
    if (o.norton) {
      var I = pv(o, 'IN', 'I_N', 'A', true);
      d.isrc(L(I, { from: [x0, yb], to: [x0, yt], side: 'left' }));
      var xr = x0 + 70; d.line([x0, yt], [xt, yt]); d.line([xt, yb], [x0, yb]);
      d.resistor(L(r, { from: [xr, yt], to: [xr, yb], side: 'right' })); d.dot([xr, yt]); d.dot([xr, yb]);
    } else {
      var E = pv(o, 'E', 'E', 'V', true);
      d.vsrc(L(E, { from: [x0, yb], to: [x0, yt], side: 'left', style: o.cell ? 'battery' : null }));
      run(d, [{ k: 'R', label: r.label, value: r.value }], [x0, yt], [xt, yt], 'top', 60);
      d.line([xt, yb], [x0, yb]);
    }
    var srcP = o.norton ? pv(o, 'IN', 'I_N', 'A', true) : pv(o, 'E', 'E', 'V', true);
    var lw = Math.max(S.markupWidth(srcP.label || '', 13), S.markupWidth(String(srcP.value || ''), 13) * 0.95);
    var bl = x0 - 18 - 7 - lw - 12;
    if (o.box !== false) d.rect(bl, yt - 40, xt - 14 - bl, yb - yt + 60, { dash: '5 4', sw: 1.1, noObstacle: true });
    d.terminal([xt, yt], { label: o.box !== false ? null : 'a', side: 'top' }); d.terminal([xt, yb]);
    var xl = xt + 90;
    var RL = spec(o, 'RL', 'R', 'R_L', 'Ω');
    if (RL || o.sw) {
      var top = o.sw ? [{ k: 'SW', closed: o.sw === 'closed' }] : [];
      run(d, top, [xt, yt], [xl, yt], 'top', 30);
      run(d, [RL || { k: 'R', label: 'R_L' }], [xl, yt], [xl, yb], 'right', 66);
      d.line([xl, yb], [xt, yb]);
    }
    if (o.I) d.current({ at: [xt + 30, yt], dir: 'right', label: o.I === true ? 'I' : o.I, side: 'top', len: 14, gap: 9 });
    if (o.V) { d.label([xt + 16, yt + 20], '+', { plain: true }); d.label([xt + 16, yb - 20], '−', { plain: true }); d.label([xt + 10, (yt + yb) / 2], o.V === true ? 'V' : o.V, { anchor: 'start' }); }
    return fin(d, o, o.norton ? 'Norton source model' : 'Battery with internal resistance');
  };

  /* ------------------------------------------------------------ MACHINES */
  function lbl(o, key, dflt) { return (o.labels && o.labels[key] != null) ? o.labels[key] : dflt; }
  function vTerm(d, top, bot, label, side, value) {
    d.terminal(top); d.terminal(bot);
    if (!label) return;
    var s = side === 'left' ? -1 : 1;
    d.label([top[0] + s * 2, top[1] + 18], '+', { plain: true });
    d.label([bot[0] + s * 2, bot[1] - 18], '−', { plain: true });
    d.label([top[0] + s * 6, (top[1] + bot[1]) / 2], label, { anchor: side === 'left' ? 'end' : 'start', value: value });
  }
  function shunt(d, x1, x2, yt, yb, Rc, Xm) {
    if (Rc) { d.resistor(L(Rc, { from: [x1, yt], to: [x1, yb], side: 'left' })); }
    if (Xm) { d.inductor(L(Xm, { from: [x2, yt], to: [x2, yb], side: 'right' })); }
    d.dot([x1, yt]); d.dot([x1, yb]); if (Rc && Xm) { d.dot([x2, yt]); d.dot([x2, yb]); }
  }
  /**
   * transformerEquiv: kind:'full'|'simplified'|'series' (no magnetising branch), side:'primary'|'secondary' (referred side),
   * ideal:true (full circuit with an ideal transformer, ratio 'N_1 : N_2', nothing referred), R1,X1,R2,X2,Rc,Xm,Req,Xeq (values),
   * labels:{...} override, V1, V2 (terminal voltage labels or true), I1, I2, I0 (current arrows), load:true|'Z_L' (load box)
   */
  S.transformerEquiv = function (o) {
    o = o || {}; var d = S.drawing();
    var kind = o.kind || 'full', sec = o.side === 'secondary', ideal = !!o.ideal && kind === 'full';
    var p1 = sec && !ideal ? "'" : '', p2 = sec || ideal ? '' : "'";
    var sfx = sec ? '2' : '1';
    var yt = 50, yb = 180, x0 = 40;
    var R1 = pv(o, 'R1', lbl(o, 'R1', 'R_1' + p1), 'Ω', true), X1 = pv(o, 'X1', lbl(o, 'X1', 'jX_1' + p1), 'Ω', true);
    var R2 = pv(o, 'R2', lbl(o, 'R2', 'R_2' + p2), 'Ω', true), X2 = pv(o, 'X2', lbl(o, 'X2', 'jX_2' + p2), 'Ω', true);
    var Rc = o.Rc === false ? null : pv(o, 'Rc', lbl(o, 'Rc', 'R_c'), 'Ω', true), Xm = pv(o, 'Xm', lbl(o, 'Xm', 'jX_m'), 'Ω', true);
    var Req = pv(o, 'Req', lbl(o, 'Req', 'R_{eq' + sfx + '}'), 'Ω', true), Xeq = pv(o, 'Xeq', lbl(o, 'Xeq', 'jX_{eq' + sfx + '}'), 'Ω', true);
    var x = x0 + 20, xs1, xs2, xp2, xs2b;
    d.line([x0, yt], [x, yt]);
    var V1 = o.V1 === false ? null : (o.V1 && o.V1 !== true ? o.V1 : 'V_1' + p1), V2 = o.V2 === false ? null : (o.V2 && o.V2 !== true ? o.V2 : 'V_2' + p2);
    if (kind === 'simplified') {
      xs1 = x + 30; xs2 = xs1 + 80;
      d.line([x, yt], [xs2, yt]); shunt(d, xs1, xs2, yt, yb, Rc, Xm);
      run(d, [{ k: 'R', label: Req.label, value: Req.value }, { k: 'L', label: Xeq.label, value: Xeq.value }], [xs2, yt], [xs2 + 170, yt], 'top', 64);
      x = xs2 + 170;
      if (o.I0) d.current({ at: [xs1, yt + 22], dir: 'down', label: o.I0 === true ? 'I_0' : o.I0, side: 'right', len: 12, gap: 8 });
    } else {
      run(d, [{ k: 'R', label: R1.label, value: R1.value }, { k: 'L', label: X1.label, value: X1.value }], [x, yt], [x + 160, yt], 'top', 64);
      x += 160;
      if (kind !== 'series') {
        xs1 = x + 30; xs2 = xs1 + 80;
        d.line([x, yt], [xs2 + 20, yt]); shunt(d, xs1, xs2, yt, yb, Rc, Xm); x = xs2 + 20;
        if (o.I0) d.current({ at: [x - 100 - 18, yt], dir: 'right', label: o.I0 === true ? 'I_0' : o.I0, side: 'top', len: 0.01, gap: 0 });
      }
      if (ideal) {
        var tx = d.transformer({ at: [x + 10, yt], h: yb - yt, w: 80, dots: 'same', core: true, ratio: o.ratio || 'N_1 : N_2' });
        d.line([x, yt], tx.p1); d.line([x, yb], tx.p2); xp2 = x; x = tx.s1[0]; xs2b = x;
      }
      run(d, [{ k: 'L', label: X2.label, value: X2.value }, { k: 'R', label: R2.label, value: R2.value }], [x, yt], [x + 160, yt], 'top', 64);
      x += 160;
    }
    var xe = x + 30;
    d.line([x, yt], [xe, yt]);
    if (ideal) { d.line([x0, yb], [xp2, yb]); d.line([xs2b, yb], [xe, yb]); }
    else d.line([x0, yb], [xe, yb]);
    vTerm(d, [x0, yt], [x0, yb], V1, 'left');
    if (o.load) {
      var xl = xe + 60; d.line([xe, yt], [xl, yt]); d.line([xe, yb], [xl, yb]);
      d.zbox({ from: [xl, yt + 25], to: [xl, yb - 25], label: o.load === true ? 'Z_L' + p2 : o.load, side: 'right' }); d.line([xl, yt], [xl, yt + 25]); d.line([xl, yb - 25], [xl, yb]);
      d.dot([xe, yt]); d.dot([xe, yb]);
      if (V2) { d.label([xe + 14, yt + 18], '+', { plain: true }); d.label([xe + 14, yb - 18], '−', { plain: true }); d.label([xe + 10, (yt + yb) / 2], V2, { anchor: 'start' }); }
    } else vTerm(d, [xe, yt], [xe, yb], V2, 'right');
    if (o.I1) d.current({ at: [x0 + 17, yt], dir: 'right', label: o.I1 === true ? 'I_1' + p1 : o.I1, side: 'top', len: 0.01, gap: 0, onWire: true });
    if (o.I2) d.current({ at: [xe - 12, yt], dir: 'right', label: o.I2 === true ? 'I_2' + p2 : o.I2, side: 'top', len: 0.01, gap: 0, onWire: true });
    return fin(d, o, 'Transformer equivalent circuit');
  };
  /** single-phase test rig shared by ocTest / scTest */
  function txTest(o, sc) {
    var d = S.drawing();
    var x0 = 40, yt = 50, yb = 200;
    var vs = pv(o, 'vs', sc ? '\\text{reduced } V' : '\\text{rated } V', 'V', true);
    d.acsrc({ from: [x0, yb], to: [x0, yt], side: 'left', label: o.vs === false ? null : vs.label, value: vs.value, signs: true });
    var A = pv(o, 'I', sc ? 'I_{sc}' : 'I_{oc}', 'A', false), W = pv(o, 'P', sc ? 'P_{sc}' : 'P_{oc}', 'W', false), V = pv(o, 'V', sc ? 'V_{sc}' : 'V_{oc}', 'V', false);
    d.meter({ kind: 'A', from: [x0 + 30, yt], to: [x0 + 80, yt], label: A.on ? A.label : null, value: A.value, side: 'top' });
    d.line([x0, yt], [x0 + 30, yt]);
    var w = d.meter({ kind: 'W', from: [x0 + 110, yt], to: [x0 + 160, yt], label: W.on ? W.label : null, value: W.value, side: 'top' });
    d.line([x0 + 80, yt], [x0 + 110, yt]);
    d.line(w.v, [w.v[0], yb]); d.dot([w.v[0], yb]);
    var xv = x0 + 220;
    d.line([x0 + 160, yt], [xv + 40, yt]);
    d.meter({ kind: 'V', from: [xv, yb], to: [xv, yt], label: V.on ? V.label : null, value: V.value, side: 'right' });
    d.dot([xv, yt]); d.dot([xv, yb]);
    var tx = d.transformer({ at: [xv + 40, yt], h: yb - yt, w: 80, dots: false });
    d.line([x0, yb], tx.p2);
    var side = o.sideLabel != null ? o.sideLabel : (o.hv ? ['HV', 'LV'] : (sc ? ['HV', 'LV'] : ['LV', 'HV']));
    if (side) { d.label([tx.c1[0] - 12, yt - 14], '\\text{' + side[0] + '}', { anchor: 'end' }); d.label([tx.c2[0] + 12, yt - 14], '\\text{' + side[1] + '}', { anchor: 'start' }); }
    var xs = tx.s1[0] + 40;
    if (sc) { d.line(tx.s1, [xs, yt], [xs, yb], tx.s2); d.label([xs + 8, (yt + yb) / 2], '\\text{short}', { anchor: 'start' }); }
    else { d.line(tx.s1, [xs, yt]); d.line(tx.s2, [xs, yb]); d.terminal([xs, yt]); d.terminal([xs, yb]); d.label([xs + 10, (yt + yb) / 2], '\\text{open}', { anchor: 'start' }); }
    return fin(d, o, sc ? 'Transformer short-circuit test' : 'Transformer open-circuit test');
  }
  /** ocTest: vs (source label; false hides), V, I, P (meter readings, e.g. V:'240 V' or {label,value}), sideLabel:['LV','HV'] | false */
  S.ocTest = function (o) { return txTest(o || {}, false); };
  /** scTest: same keys as ocTest; default side labels HV (metered) / LV (shorted) */
  S.scTest = function (o) { return txTest(o || {}, true); };
  /**
   * imPerPhase: kind:'simplified'|'exact', R1,X1,X2,R2 (values), Rc (false -> omit), Xm, split:true (R2' + R2'(1−s)/s),
   * mode:'motor'|'gen' (gen: I2' reversed, load resistor labelled R_2'/s with s<0), V1, I1, I2, I0 (currents), s (slip text, e.g. 's = 0.04')
   */
  S.imPerPhase = function (o) {
    o = o || {}; var d = S.drawing();
    var exact = o.kind === 'exact', gen = o.mode === 'gen';
    var yt = 50, yb = 190, x0 = 40;
    var R1 = pv(o, 'R1', lbl(o, 'R1', 'R_1'), 'Ω', true), X1 = pv(o, 'X1', lbl(o, 'X1', 'jX_1'), 'Ω', true), X2 = pv(o, 'X2', lbl(o, 'X2', "jX_2'"), 'Ω', true);
    var R2 = pv(o, 'R2', lbl(o, 'R2', o.split ? "R_2'" : "R_2'/s"), 'Ω', true);
    var Rc = o.Rc === false ? null : pv(o, 'Rc', lbl(o, 'Rc', 'R_c'), 'Ω', true), Xm = pv(o, 'Xm', lbl(o, 'Xm', 'jX_m'), 'Ω', true);
    var x = x0 + 20, xs1, xs2;
    d.line([x0, yt], [x, yt]);
    function sh() { xs1 = x + 30; xs2 = Rc ? xs1 + 80 : xs1; d.line([x, yt], [xs2 + 20, yt]); shunt(d, xs1, xs2, yt, yb, Rc, Rc ? Xm : null); if (!Rc) { d.inductor(L(Xm, { from: [xs1, yt], to: [xs1, yb], side: 'right' })); } x = xs2 + 20; }
    if (!exact) sh();
    var ser = [{ k: 'R', label: R1.label, value: R1.value }, { k: 'L', label: X1.label, value: X1.value }];
    if (!exact) ser.push({ k: 'L', label: X2.label, value: X2.value });
    if (o.split) ser.push({ k: 'R', label: R2.label, value: R2.value });
    var wL = ser.length * 76;
    if (exact) { run(d, ser, [x, yt], [x + wL, yt], 'top', 62); x += wL; sh(); var s2 = [{ k: 'L', label: X2.label, value: X2.value }]; if (o.split) s2.push({ k: 'R', label: R2.label, value: R2.value }); run(d, s2, [x, yt], [x + s2.length * 76, yt], 'top', 62); x += s2.length * 76; }
    else { run(d, ser, [x, yt], [x + wL, yt], 'top', 62); x += wL; }
    var xr = x + 20;
    d.line([x, yt], [xr, yt]);
    var Rload = o.split ? pv(o, 'Rload', lbl(o, 'Rload', "R_2'(1−s)/s"), 'Ω', true) : R2;
    d.resistor(L(Rload, { from: [xr, yt], to: [xr, yb], side: 'right' }));
    d.line([xr, yb], [x0, yb]);
    vTerm(d, [x0, yt], [x0, yb], o.V1 === false ? null : (o.V1 && o.V1 !== true ? o.V1 : 'V_1'), 'left');
    if (o.I1) d.current({ at: [x0 + (gen ? 12 : 17), yt], dir: gen ? 'left' : 'right', label: o.I1 === true ? 'I_1' : o.I1, side: 'top', onWire: true, gap: 0 });
    if (o.I2) d.current({ at: [xr, yt + 26], dir: gen ? 'up' : 'down', label: o.I2 === true ? "I_2'" : o.I2, side: 'left', len: 14, gap: 9 });
    if (o.I0) d.current({ at: [xs1, yt + 26], dir: 'down', label: o.I0 === true ? 'I_0' : o.I0, side: Rc ? 'right' : 'left', len: 12, gap: 8 });
    if (o.s || gen) d.label([xr + 8, yb + 20], o.s ? o.s : 's < 0', { anchor: 'middle', plain: false });
    return fin(d, o, gen ? 'Induction generator per-phase circuit' : 'Induction motor per-phase circuit');
  };
  /** 3-phase motor test rig (two-wattmeter method) */
  function imTest(o, blocked) {
    var d = S.drawing();
    var ys = [50, 130, 210], xL = 40;
    var lines = o.lines || ['A', 'B', 'C'];
    d.box({ at: [xL, 130], anchor: 'out', w: 86, h: 200, label: blocked ? ['\\text{3φ supply}', '\\text{reduced V}', '\\text{rated f}'] : ['\\text{3φ supply}', '\\text{rated V}'], italic: true, fs: 12 });
    var xm = 560, mc = [xm, 130], R = 34;
    var A = pv(o, 'I', blocked ? 'I_{BR}' : 'I_{NL}', 'A', false), V = pv(o, 'V', blocked ? 'V_{BR}' : 'V_{NL}', 'V', false);
    var W1 = pv(o, 'P1', 'W_1', 'W', false), W2 = pv(o, 'P2', 'W_2', 'W', false);
    var one = o.meters === 'one';
    // line A: ammeter + W1
    d.line([xL, ys[0]], [xL + 40, ys[0]]);
    d.meter({ kind: 'A', from: [xL + 40, ys[0]], to: [xL + 90, ys[0]], label: A.on ? A.label : null, value: A.value, side: 'top' });
    d.line([xL + 90, ys[0]], [xL + 130, ys[0]]);
    var w1 = d.meter({ kind: 'W', from: [xL + 130, ys[0]], to: [xL + 180, ys[0]], label: W1.on ? (one ? W1.label : W1.label) : (one ? 'W' : 'W_1'), value: W1.value, side: 'top' });
    d.line([xL + 180, ys[0]], [xm, ys[0]], [xm, mc[1] - R]);
    d.line(w1.v, [w1.v[0], ys[1]]); d.dot([w1.v[0], ys[1]]);
    // line B
    d.line([xL, ys[1]], [xm - R, ys[1]]);
    // line C (W2)
    if (!one) {
      d.line([xL, ys[2]], [xL + 130, ys[2]]);
      var w2 = d.meter({ kind: 'W', from: [xL + 130, ys[2]], to: [xL + 180, ys[2]], label: W2.on ? W2.label : 'W_2', value: W2.value, side: 'bottom' });
      d.line(w2.vOpp, [w2.vOpp[0], ys[1]]);
      d.line([xL + 180, ys[2]], [xm, ys[2]], [xm, mc[1] + R]);
    } else d.line([xL, ys[2]], [xm, ys[2]], [xm, mc[1] + R]);
    // voltmeter A-B
    var xv = xL + 290;
    d.meter({ kind: 'V', from: [xv, ys[1]], to: [xv, ys[0]], label: V.on ? V.label : null, value: V.value, side: 'right' });
    d.dot([xv, ys[0]]); d.dot([xv, ys[1]]);
    // motor
    d.circle(mc[0], mc[1], R, { fill: '#fff' });
    d.label([mc[0], mc[1] - 7], 'M', { plain: true, size: 15 }); d.label([mc[0], mc[1] + 10], '3∼', { plain: true, size: 12 });
    var xsh = mc[0] + R + 46;
    d.poly([[mc[0] + R, mc[1] - 3], [xsh, mc[1] - 3]], { sw: 1.4 }); d.poly([[mc[0] + R, mc[1] + 3], [xsh, mc[1] + 3]], { sw: 1.4 });
    if (blocked) {
      d.rect(xsh - 12, mc[1] - 20, 12, 40, { fill: '#fff' });
      for (var k = 0; k < 5; k++) d.poly([[xsh - 12, mc[1] - 20 + k * 10 + 10], [xsh, mc[1] - 20 + k * 10]], { sw: 1, noObstacle: true });
      d.label([xsh - 6, mc[1] + 34], o.note || '\\text{rotor locked}', { anchor: 'middle' });
    } else d.label([xsh - 14, mc[1] + 22], o.note || '\\text{no load}', { anchor: 'middle', valign: 'top' });
    ys.forEach(function (y, i) { d.labelNear([xL + 14, y], lines[i], { prefer: ['top'], gap: 5 }); });
    return fin(d, o, blocked ? 'Induction motor blocked-rotor test' : 'Induction motor no-load test');
  }
  /** imTestNoLoad: two-wattmeter no-load test. V, I, P1, P2 (readings), meters:'two'|'one', lines, note */
  S.imTestNoLoad = function (o) { return imTest(o || {}, false); };
  /** imTestBlocked: blocked-rotor test, same keys as imTestNoLoad */
  S.imTestBlocked = function (o) { return imTest(o || {}, true); };
  /**
   * dcMachine: kind:'separate'|'shunt'|'series'|'compound' (long-shunt), mode:'motor'|'gen', Ra, Rf, Lf (field symbol label),
   * Radj (field rheostat), Rs (series field), VT, VF (separate field supply), EA, currents (I_L, I_A, I_F)
   */
  S.dcMachine = function (o) {
    o = o || {}; var d = S.drawing();
    var kind = o.kind || 'shunt', gen = o.mode === 'gen';
    var yt = 50, yb = 220, xT = 40;
    var Ra = pv(o, 'Ra', 'R_A', 'Ω', true), EA = pv(o, 'EA', 'E_A', 'V', true), Rf = pv(o, 'Rf', 'R_F', 'Ω', kind !== 'series');
    var Radj = pv(o, 'Radj', 'R_{adj}', 'Ω'), Rs = pv(o, 'Rs', 'R_S', 'Ω', kind === 'series' || kind === 'compound');
    var Lf = pv(o, 'Lf', 'L_F', 'H', true);
    var VTp = pv(o, 'VT', 'V_T', 'V', true), VT = o.VT === false ? null : VTp.label;
    var xA;
    function armature(x, y0, y1) {
      // Ra then armature circle (with E_A label); + of E_A at top
      d.resistor(L(Ra, { from: [x, y0], to: [x, y0 + 64], side: 'right' }));
      d.line([x, y0 + 64], [x, y0 + 78]);
      d.mach({ from: [x, y0 + 78], to: [x, y1 - 10], text: gen ? 'G' : 'M', r: 20, label: EA.label, value: EA.value, side: 'right' });
      d.label([x - 14, y0 + 82], '+', { plain: true, size: 12 });
      d.line([x, y1 - 10], [x, y1]);
    }
    function fieldBranch(x, y0, y1, withSrc) {
      var list = [];
      if (Radj.on) list.push({ k: 'R', label: Radj.label, value: Radj.value });
      list.push({ k: 'R', label: Rf.label, value: Rf.value });
      list.push({ k: 'L', label: Lf.label, value: Lf.value });
      run(d, list, [x, y0], [x, y1], 'left', 46);
    }
    if (kind === 'separate') {
      var VF = pv(o, 'VF', 'V_F', 'V', true);
      d.vsrc(L(VF, { from: [xT, yb], to: [xT, yt], side: 'left' }));
      var xf = xT + 90;
      d.line([xT, yt], [xf, yt]); d.line([xf, yb], [xT, yb]);
      fieldBranch(xf, yt, yb);
      if (o.currents) d.current({ at: [xT + 40, yt], dir: 'right', label: 'I_F', side: 'top', len: 14, gap: 8 });
      xT = xf + 90; xA = xT + 130;
    } else xA = xT + (kind === 'series' ? 210 : 230);
    var xTop0 = xT;
    // series field on the top line
    var xa0 = xT;
    if (kind === 'series' || kind === 'compound') {
      var xs0 = xT + (kind === 'compound' ? 80 : 30), xs1 = xs0 + 110;
      d.line([xT, yt], [xs0, yt]);
      run(d, [{ k: 'L', label: Rs.label, value: Rs.value }], [xs0, yt], [xs1, yt], 'top', 50);
      xa0 = xs1;
    }
    if (kind === 'shunt') {
      var xf2 = xT + 100;
      d.line([xT, yt], [xA, yt]); d.line([xA, yb], [xT, yb]);
      fieldBranch(xf2, yt, yb); d.dot([xf2, yt]); d.dot([xf2, yb]);
    } else if (kind === 'compound') {
      // long shunt: shunt field across the terminals, series field in the armature path
      var xf3 = xT + 50;
      d.line([xa0, yt], [xA, yt]); d.line([xA, yb], [xT, yb]);
      fieldBranch(xf3, yt, yb); d.dot([xf3, yt]); d.dot([xf3, yb]);
    } else {
      d.line([xa0, yt], [xA, yt]); d.line([xA, yb], [xT, yb]);
    }
    if (kind === 'compound') { /* series field drawn between xs0 and xs1, shift so the shunt branch sits left of it */ }
    armature(xA, yt, yb);
    vTerm(d, [xTop0, yt], [xTop0, yb], VT, 'left', VTp.value);
    if (o.currents) {
      if (kind !== 'separate') d.current({ at: [xTop0 + (gen ? 12 : 17), yt], dir: gen ? 'left' : 'right', label: 'I_L', side: 'top', onWire: true, gap: 0 });
      d.current({ at: [xA - 0, yt + 150], dir: gen ? 'up' : 'down', label: 'I_A', side: 'left', len: 14, gap: 10 });
      if (kind === 'shunt') d.current({ at: [xT + 100, yt + 18], dir: 'down', label: 'I_F', side: 'right', len: 12, gap: 9 });
      if (kind === 'compound') d.current({ at: [xT + 50, yt + 18], dir: 'down', label: 'I_F', side: 'right', len: 12, gap: 9 });
    }
    return fin(d, o, 'DC machine equivalent circuit');
  };
  /**
   * syncModel: per-phase synchronous machine. mode:'gen'|'motor' (current direction), Xs, Ra (optional), E0 (label/value),
   * V (terminal voltage label), I (current label), bus:true (infinite bus at the terminals), load:true|'Z_L'
   */
  S.syncModel = function (o) {
    o = o || {}; var d = S.drawing();
    var gen = o.mode !== 'motor';
    var x0 = 50, yt = 50, yb = 190;
    var E0 = pv(o, 'E0', 'E_0', 'V', true);
    d.acsrc(L(E0, { from: [x0, yb], to: [x0, yt], side: 'left', signs: true }));
    var list = [];
    var Ra = spec(o, 'Ra', 'R', 'R_a', 'Ω'); if (Ra) list.push(Ra);
    var Xs = pv(o, 'Xs', 'jX_s', 'Ω', true); list.push({ k: 'L', label: Xs.label, value: Xs.value });
    var xt = x0 + 60 + list.length * 80;
    run(d, list, [x0, yt], [xt, yt], 'top', 64);
    d.line([xt, yb], [x0, yb]);
    var V = o.V === false ? null : (o.V && o.V !== true ? o.V : 'V');
    if (o.bus) {
      d.line([xt, yt], [xt + 40, yt]); d.line([xt, yb], [xt + 40, yb]);
      d.poly([[xt + 40, yt - 20], [xt + 40, yb + 20]], { sw: 4 });
      d.label([xt + 52, (yt + yb) / 2], '\\text{infinite bus}', { anchor: 'start' });
      d.dot([xt, yt]); d.dot([xt, yb]);
      if (V) { d.label([xt + 14 - 26, yt + 18], '+', { plain: true }); d.label([xt + 14 - 26, yb - 18], '−', { plain: true }); d.label([xt - 8, (yt + yb) / 2], V, { anchor: 'end' }); }
    } else if (o.load) {
      var xl = xt + 60; d.line([xt, yt], [xl, yt]); d.line([xt, yb], [xl, yb]);
      d.line([xl, yt], [xl, yt + 30]); d.zbox({ from: [xl, yt + 30], to: [xl, yb - 30], label: o.load === true ? 'Z_L' : o.load, side: 'right' }); d.line([xl, yb - 30], [xl, yb]);
      d.dot([xt, yt]); d.dot([xt, yb]);
      if (V) { d.label([xt + 12, yt + 18], '+', { plain: true }); d.label([xt + 12, yb - 18], '−', { plain: true }); d.label([xt + 8, (yt + yb) / 2], V, { anchor: 'start' }); }
    } else vTerm(d, [xt, yt], [xt, yb], V, 'right');
    d.current({ at: [xt - 22, yt], dir: gen ? 'right' : 'left', label: o.I === false ? null : (o.I && o.I !== true ? o.I : 'I_a'), side: 'top', onWire: true, gap: 0 });
    return fin(d, o, gen ? 'Synchronous generator per-phase model' : 'Synchronous motor per-phase model');
  };

  /* ------------------------------------------------------------ DSP BLOCKS */
  function arrowTo(d, a, b) { d.wire({ from: a, to: b, arrow: 'end' }); }
  function sigLabel(d, p, s) { if (s) d.label([p[0], p[1] - 8], s, { anchor: 'middle', valign: 'bottom' }); }
  function blk(d, at, lab, anchor) { var lines = Array.isArray(lab) ? lab : [lab]; return d.box({ at: at, anchor: anchor || 'in', label: lines, h: lines.length > 1 ? 18 + lines.length * 15 : 38 }); }
  /** blockCascade: blocks:['H_1(z)','H_2(z)'] (strings or arrays of lines), x (input label), y (output label), mid:[labels between blocks] */
  S.blockCascade = function (o) {
    o = o || {}; var d = S.drawing();
    var blocks = o.blocks || ['H_1(z)', 'H_2(z)'], mid = o.mid || [];
    var x = 30, y = 60;
    d.line([x, y], [x, y]);
    blocks.forEach(function (b, i) {
      var lbl = i === 0 ? (o.x == null ? 'x(n)' : o.x) : (mid[i - 1] || '');
      var len = Math.max(60, S.markupWidth(lbl, 13) + 24);
      arrowTo(d, [x, y], [x + len, y]); sigLabel(d, [x + len / 2, y], lbl);
      var bx = blk(d, [x + len, y], b); x = bx.out[0];
    });
    var yl = o.y == null ? 'y(n)' : o.y, len2 = Math.max(60, S.markupWidth(yl, 13) + 24);
    arrowTo(d, [x, y], [x + len2, y]); sigLabel(d, [x + len2 / 2, y], yl);
    return fin(d, o, 'Cascade of systems');
  };
  /** blockParallel: blocks (stacked), signs:['+','+'] at the adder, x, y */
  S.blockParallel = function (o) {
    o = o || {}; var d = S.drawing();
    var blocks = o.blocks || ['H_1(z)', 'H_2(z)'], n = blocks.length, sp = 70;
    var y0 = 60, ym = y0 + (n - 1) * sp / 2, xs = 110, xb = 160, xsum = 330;
    var xl = o.x == null ? 'x(n)' : o.x;
    d.wire({ from: [20, ym], to: [xs, ym], arrow: 'mid' });
    sigLabel(d, [55, ym], xl); d.dot([xs, ym]);
    d.line([xs, y0], [xs, y0 + (n - 1) * sp]);
    var signs = o.signs || [];
    var sm = d.sum({ at: [xsum, ym], r: 11 });
    var xo = 0;
    blocks.forEach(function (b, i) {
      var y = y0 + i * sp;
      arrowTo(d, [xs, y], [xb, y]);
      var bx = blk(d, [xb, y], b); xo = Math.max(xo, bx.out[0]);
      var sgn = signs[i] || '+';
      if (Math.abs(y - ym) < 1) { arrowTo(d, bx.out, sm.left); d.label([sm.left[0] - 7, ym - 11], sgn === '-' ? '−' : sgn, { plain: true, size: 12 }); }
      else if (y < ym) { d.line(bx.out, [xsum, y]); arrowTo(d, [xsum, y], sm.top); d.label([xsum + 10, sm.top[1] - 9], sgn === '-' ? '−' : sgn, { plain: true, size: 12 }); }
      else { d.line(bx.out, [xsum, y]); arrowTo(d, [xsum, y], sm.bottom); d.label([xsum + 10, sm.bottom[1] + 9], sgn === '-' ? '−' : sgn, { plain: true, size: 12 }); }
    });
    var yl = o.y == null ? 'y(n)' : o.y;
    arrowTo(d, sm.right, [sm.right[0] + 70, ym]); sigLabel(d, [sm.right[0] + 35, ym], yl);
    return fin(d, o, 'Parallel systems');
  };
  /** blockFeedback: G (forward block or array of blocks), H (feedback block; false -> unity), sign:'-'|'+', x, y, e (error label) */
  S.blockFeedback = function (o) {
    o = o || {}; var d = S.drawing();
    var y = 60;
    var xl = o.x == null ? 'x(n)' : o.x;
    var x0 = 20, xsum = x0 + Math.max(70, S.markupWidth(xl, 13) + 30);
    arrowTo(d, [x0, y], [xsum - 11, y]); sigLabel(d, [(x0 + xsum - 11) / 2, y], xl);
    var sm = d.sum({ at: [xsum, y], r: 11 });
    d.label([xsum - 19, y - 12], '+', { plain: true, size: 12 });
    var x = sm.right[0];
    var Gs = Array.isArray(o.G) ? o.G : [o.G || 'G(z)'];
    Gs.forEach(function (g, i) { var len = i === 0 && o.e ? Math.max(56, S.markupWidth(o.e, 13) + 20) : 44; arrowTo(d, [x, y], [x + len, y]); if (i === 0 && o.e) sigLabel(d, [x + len / 2, y], o.e); var b = blk(d, [x + len, y], g); x = b.out[0]; });
    var xn = x + 40; d.line([x, y], [xn, y]); d.dot([xn, y]);
    var yl = o.y == null ? 'y(n)' : o.y;
    arrowTo(d, [xn, y], [xn + 60, y]); sigLabel(d, [xn + 30, y], yl);
    var yf = y + 75;
    d.line([xn, y], [xn, yf]);
    var xc = (xsum + xn) / 2;
    if (o.H === false) { d.line([xn, yf], [xsum, yf]); }
    else { var hb = blk(d, [xc, yf], o.H || 'H(z)', 'center'); hb = { in: [hb.x0 + hb.w, yf], out: [hb.x0, yf] }; arrowTo(d, [xn, yf], hb.in); d.line(hb.out, [xsum, yf]); }
    arrowTo(d, [xsum, yf], sm.bottom);
    var sg = o.sign === '+' ? '+' : '−';
    d.label([xsum - 12, sm.bottom[1] + 10], sg, { plain: true, size: 13 });
    return fin(d, o, 'Feedback system');
  };
  function coefLabel(v, sym, neg) {
    if (typeof v === 'string') return v;
    if (v == null) return sym;
    var x = neg ? -v : v;
    return QB.fmt.num(x, 3);
  }
  function dfArgs(args) {
    var b, a, o;
    if (Array.isArray(args[0])) { b = args[0]; a = args[1] || [1]; o = args[2] || {}; }
    else { o = args[0] || {}; b = o.b || [1]; a = o.a || [1]; }
    return { b: b, a: a, o: o };
  }
  function isZero(v) { return typeof v === 'number' && Math.abs(v) < 1e-12; }
  function delayV(d, x, y0, y1) {
    var ym = (y0 + y1) / 2;
    var bx = d.box({ at: [x, ym], anchor: 'center', w: 44, h: 28, label: 'z^{-1}', fs: 12 });
    arrowTo(d, [x, y0], [x, bx.y0]); d.line([x, bx.y0 + 28], [x, y1]);
  }
  /**
   * directFormI(b, a, opts) or directFormI({b, a, ...}): y(n) = Σ b_k x(n−k) − Σ_{k≥1} a_k y(n−k). a[0] must be 1.
   * opts: symbolic:true (labels b_k, −a_k instead of numbers), x, y (signal labels). Zero coefficients are skipped.
   */
  S.directFormI = function () {
    var A = dfArgs(arguments), b = A.b, a = A.a, o = A.o; var d = S.drawing();
    var M = b.length - 1, N = a.length - 1;
    while (M > 0 && isZero(b[M]) && !o.symbolic) M--;
    while (N > 0 && isZero(a[N]) && !o.symbolic) N--;
    var rows = Math.max(M, N) + 1, sp = 78, y0 = 50;
    var xX = 90, xS = 260, xY = 430;
    var xl = o.x == null ? 'x(n)' : o.x, yl = o.y == null ? 'y(n)' : o.y;
    var need = [];
    for (var k = 0; k < rows; k++) need[k] = (k <= M && (o.symbolic || !isZero(b[k]))) || (k >= 1 && k <= N && (o.symbolic || !isZero(a[k])));
    var last = 0; for (k = 0; k < rows; k++) if (need[k]) last = k;
    var sums = [];
    for (k = 0; k <= last; k++) if (need[k] || k === 0) { sums[k] = d.sum({ at: [xS, y0 + k * sp], r: 10 }); }
    // adder column links (upwards)
    var prev = null;
    for (k = last; k >= 0; k--) if (sums[k]) { if (prev != null) arrowTo(d, sums[prev].top, sums[k].bottom); prev = k; }
    // x side
    d.wire({ from: [20, y0], to: [xX, y0] }); sigLabel(d, [48, y0], xl); d.dot([xX, y0]);
    for (k = 1; k <= M; k++) delayV(d, xX, y0 + (k - 1) * sp, y0 + k * sp);
    for (k = 0; k <= M; k++) {
      var yk = y0 + k * sp;
      if (!o.symbolic && isZero(b[k])) continue;
      if (k < M) d.dot([xX, yk]);
      d.line([xX, yk], [xX + 34, yk]);
      var g = d.gain({ at: [xX + 34, yk], k: o.symbolic ? 'b_' + k : coefLabel(b[k], 'b_' + k), len: 32, h: 13 });
      arrowTo(d, g.out, sums[k].left);
    }
    // y side
    var yo = y0;
    d.line(sums[0].right, [xY, yo]); d.dot([xY, yo]);
    arrowTo(d, [xY, yo], [xY + 70, yo]); sigLabel(d, [xY + 35, yo], yl);
    for (k = 1; k <= N; k++) delayV(d, xY, y0 + (k - 1) * sp, y0 + k * sp);
    for (k = 1; k <= N; k++) {
      var yk2 = y0 + k * sp;
      if (!o.symbolic && isZero(a[k])) continue;
      if (k < N) d.dot([xY, yk2]);
      d.line([xY, yk2], [xY - 34, yk2]);
      var g2 = d.gain({ at: [xY - 34, yk2], dir: 'left', k: o.symbolic ? '−a_' + k : coefLabel(a[k], '−a_' + k, true), len: 32, h: 13 });
      arrowTo(d, g2.out, sums[k].right);
    }
    if (o.wlabel) { }
    return fin(d, o, 'Direct form I');
  };
  /** directFormII(b, a, opts) or directFormII({b, a, ...}): canonical form with one delay line w(n). opts: symbolic, x, y, w (label of the delay-line node, default none) */
  S.directFormII = function () {
    var A = dfArgs(arguments), b = A.b, a = A.a, o = A.o; var d = S.drawing();
    var M = b.length - 1, N = a.length - 1;
    while (M > 0 && isZero(b[M]) && !o.symbolic) M--;
    while (N > 0 && isZero(a[N]) && !o.symbolic) N--;
    var K = Math.max(M, N), sp = 78, y0 = 50;
    var xL = 150, xW = 270, xR = 390;
    var xl = o.x == null ? 'x(n)' : o.x, yl = o.y == null ? 'y(n)' : o.y;
    var sl = [], sr = [];
    var lastL = 0, lastR = 0;
    for (var k = 1; k <= N; k++) if (o.symbolic || !isZero(a[k])) lastL = k;
    for (k = 1; k <= M; k++) if (o.symbolic || !isZero(b[k])) lastR = k;
    for (k = 0; k <= lastL; k++) if (k === 0 || o.symbolic || !isZero(a[k])) sl[k] = d.sum({ at: [xL, y0 + k * sp], r: 10 });
    for (k = 0; k <= lastR; k++) if (k === 0 || o.symbolic || !isZero(b[k])) sr[k] = d.sum({ at: [xR, y0 + k * sp], r: 10 });
    function chain(s, last) { var prev = null; for (var j = last; j >= 0; j--) if (s[j]) { if (prev != null) arrowTo(d, s[prev].top, s[j].bottom); prev = j; } }
    chain(sl, lastL); chain(sr, lastR);
    arrowTo(d, [20, y0], sl[0].left); sigLabel(d, [60, y0], xl);
    d.line(sl[0].right, [xW, y0]); d.dot([xW, y0]);
    if (o.w) d.label([xW + 4, y0 - 8], o.w === true ? 'w(n)' : o.w, { anchor: 'start', valign: 'bottom' });
    for (k = 1; k <= K; k++) delayV(d, xW, y0 + (k - 1) * sp, y0 + k * sp);
    for (k = 1; k <= K; k++) if (k < K) d.dot([xW, y0 + k * sp]);
    for (k = 1; k <= N; k++) {
      if (!o.symbolic && isZero(a[k])) continue;
      var yk = y0 + k * sp;
      d.line([xW, yk], [xW - 36, yk]);
      var g = d.gain({ at: [xW - 36, yk], dir: 'left', k: o.symbolic ? '−a_' + k : coefLabel(a[k], '−a_' + k, true), len: 32, h: 13 });
      arrowTo(d, g.out, sl[k].right);
    }
    for (k = 0; k <= M; k++) {
      if (!o.symbolic && isZero(b[k])) continue;
      var yk2 = y0 + k * sp;
      d.line([xW, yk2], [xW + 36, yk2]);
      var g2 = d.gain({ at: [xW + 36, yk2], k: o.symbolic ? 'b_' + k : coefLabel(b[k], 'b_' + k), len: 32, h: 13 });
      arrowTo(d, g2.out, sr[k] ? sr[k].left : [xR - 10, yk2]);
    }
    if (K > 0 && (lastL < K || lastR < K)) d.dot([xW, y0 + K * sp - 0.01]);
    arrowTo(d, sr[0].right, [xR + 80, y0]); sigLabel(d, [xR + 45, y0], yl);
    return fin(d, o, 'Direct form II');
  };
  /**
   * adcChain: stages (array of block labels; each a string or array of lines; use \\text{} for words),
   * signals (labels on the arrows, length stages+1), fs ('F_s = 8 kHz'), bits ('b = 8'), dac:true (append DAC + reconstruction filter)
   */
  S.adcChain = function (o) {
    o = o || {}; var d = S.drawing();
    var st = o.stages || [['\\text{Anti-aliasing}', '\\text{filter}'], ['\\text{Sampler}', o.fs || 'F_s'], ['\\text{Quantiser}', o.bits ? o.bits : 'b \\text{ bits}'], ['\\text{Encoder}']];
    if (o.dac && !o.stages) st = st.concat([['\\text{DAC}'], ['\\text{Reconstruction}', '\\text{filter}']]);
    var sg = o.signals || (o.dac ? ['x_a(t)', '', 'x(n)', 'x_q(n)', '\\text{bits}', '', 'y_a(t)'] : ['x_a(t)', '', 'x(n)', 'x_q(n)', '\\text{bits}']);
    var x = 20, y = 60;
    st.forEach(function (b, i) {
      var lab = sg[i] || '';
      var len = Math.max(44, S.markupWidth(lab, 13) + 22);
      arrowTo(d, [x, y], [x + len, y]); sigLabel(d, [x + len / 2, y], lab);
      var bx = d.box({ at: [x + len, y], label: Array.isArray(b) ? b : [b], h: 52, fs: 12.5 }); x = bx.out[0];
    });
    var l2 = sg[st.length] || '', len2 = Math.max(44, S.markupWidth(l2, 13) + 22);
    arrowTo(d, [x, y], [x + len2, y]); sigLabel(d, [x + len2 / 2, y], l2);
    return fin(d, o, 'ADC chain');
  };

  /* ------------------------------------------------------------ MAGNETICS */
  var CORE = '#e4e4e4';
  function coilOnVertical(d, xl, xr, yTop, yBot, turns) {
    var n = turns || 6, dy = (yBot - yTop) / n;
    for (var k = 0; k < n; k++) {
      var y = yTop + k * dy + dy * 0.2;
      d.poly([[xl - 6, y + dy * 0.6], [xr + 6, y]], { sw: 1.6, noObstacle: true });
    }
    d.ob({ x0: xl - 7, y0: yTop, x1: xr + 7, y1: yBot });
    return { top: [xl - 6, yTop + dy * 0.2 + dy * 0.6], bot: [xl - 6, yTop + (n - 1) * dy + dy * 0.8] };
  }
  function leads(d, c, xt, o, cur) {
    d.line(c.top, [xt, c.top[1]]); d.line(c.bot, [xt, c.bot[1]]);
    d.terminal([xt, c.top[1]]); d.terminal([xt, c.bot[1]]);
    if (cur !== false) d.current({ at: [xt + 18, c.top[1]], dir: 'right', label: o.I === true || o.I == null ? 'i' : o.I, side: 'top', len: 12, gap: 7 });
  }
  /**
   * magCore: kind:'C' (rectangular core, coil on the left leg) | 'toroid' | 'shell' (3-leg, coil on the centre leg),
   * N ('N = 500' label), I (current label, default i), gap (true | 'g = 1 mm'; shell: gapLeg:'centre'|'right'|'left'), lc (mean-length label),
   * A (cross-section label), mu (text in the window, e.g. 'µ_r = 2000'), phi (flux label, default Φ; false hides), N2 (second winding on the right leg)
   */
  S.magCore = function (o) {
    o = o || {}; var d = S.drawing();
    var kind = o.kind || 'C';
    var Nl = o.N == null ? 'N' : (typeof o.N === 'number' ? 'N = ' + o.N : o.N);
    var phi = o.phi === false ? null : (o.phi || 'Φ');
    var gapL = o.gap ? (o.gap === true ? 'g' : o.gap) : null;
    if (kind === 'toroid') {
      var c = [220, 160], R1 = 95, R0 = 60, Rm = (R1 + R0) / 2;
      d.circle(c[0], c[1], R1, { fill: CORE }); d.circle(c[0], c[1], R0, { fill: '#fff' });
      if (gapL) {
        var gw = 5;
        d.rect(c[0] + R0 - 3, c[1] - gw, R1 - R0 + 6, 2 * gw, { fill: '#fff', noObstacle: true });
        d.items.push('<path d="M' + (c[0] + R0) + ',' + (c[1] - gw) + 'L' + (c[0] + R1) + ',' + (c[1] - gw) + 'M' + (c[0] + R0) + ',' + (c[1] + gw) + 'L' + (c[0] + R1) + ',' + (c[1] + gw) + '" fill="none"/>');
        d.label([c[0] + R1 + 10, c[1]], gapL, { anchor: 'start' });
      }
      // winding on the left of the ring: radial strokes
      var n = 8, a0 = 140, a1 = 220, pts = [];
      for (var k = 0; k < n; k++) {
        var t = (a0 + (a1 - a0) * k / (n - 1)) * Math.PI / 180;
        var p = [c[0] + (R1 + 6) * Math.cos(t), c[1] + (R1 + 6) * Math.sin(t)], q = [c[0] + (R0 - 6) * Math.cos(t + 0.06), c[1] + (R0 - 6) * Math.sin(t + 0.06)];
        d.poly([p, q], { sw: 1.6, noObstacle: true }); pts.push(p);
      }
      var top = pts[pts.length - 1], bot = pts[0];
      // pts[0] at 140° (lower left), last at 220° (upper left)
      var xt = c[0] - R1 - 50;
      d.line(top, [xt, top[1]]); d.line(bot, [xt, bot[1]]); d.terminal([xt, top[1]]); d.terminal([xt, bot[1]]);
      d.current({ at: [xt + 18, top[1]], dir: 'right', label: o.I === true || o.I == null ? 'i' : o.I, side: 'top', len: 12, gap: 7 });
      d.label([c[0], c[1] - (o.mu ? 10 : 0)], Nl, { anchor: 'middle' });
      d.circle(c[0], c[1], Rm, { dash: '5 4', sw: 1.1, noObstacle: true });
      if (phi) { var ta = -50 * Math.PI / 180; var tip = [c[0] + Rm * Math.cos(ta), c[1] + Rm * Math.sin(ta)]; d.arrowHead(tip, [-Math.sin(ta), Math.cos(ta)]); d.label([tip[0] + 14, tip[1] - 10], phi, { anchor: 'start' }); }
      if (o.lc) d.label([c[0], c[1] + R1 + 16], o.lc, { anchor: 'middle', valign: 'top' });
      if (o.A) d.label([c[0], c[1] - R1 - 10], o.A, { anchor: 'middle', valign: 'bottom' });
      if (o.mu) d.label([c[0], c[1] + 14], o.mu, { anchor: 'middle' });
      return fin(d, o, 'Toroidal core');
    }
    if (kind === 'shell') {
      var X0 = 80, Y0 = 40, W = 340, H = 220, t = 40, tc = 60;
      var wl = (W - 2 * t - tc) / 2;
      d.rect(X0, Y0, W, H, { fill: CORE });
      d.rect(X0 + t, Y0 + t, wl, H - 2 * t, { fill: '#fff' });
      d.rect(X0 + t + wl + tc, Y0 + t, wl, H - 2 * t, { fill: '#fff' });
      var xcL = X0 + t + wl, xcR = xcL + tc, ym = Y0 + H / 2;
      if (gapL) {
        var leg = o.gapLeg || 'centre', gx0 = leg === 'centre' ? xcL : leg === 'left' ? X0 : X0 + W - t, gx1 = gx0 + (leg === 'centre' ? tc : t);
        d.rect(gx0 - 2, ym - 4, gx1 - gx0 + 4, 8, { fill: '#fff', noObstacle: true });
        d.items.push('<path d="M' + gx0 + ',' + (ym - 4) + 'L' + gx1 + ',' + (ym - 4) + 'M' + gx0 + ',' + (ym + 4) + 'L' + gx1 + ',' + (ym + 4) + '" fill="none"/>');
        d.label(leg === 'centre' ? [xcR + 6, ym] : leg === 'left' ? [gx1 + 6, ym] : [gx0 - 6, ym], gapL, { anchor: leg === 'right' ? 'end' : 'start' });
      }
      var cl = coilOnVertical(d, xcL, xcR, Y0 + t + 14, ym - (gapL && (o.gapLeg || 'centre') === 'centre' ? 14 : -40), 6);
      // leads out through the left window to the left
      var xt2 = X0 - 40;
      d.items.push('<path d="M' + cl.top[0] + ',' + cl.top[1] + 'L' + xt2 + ',' + cl.top[1] + 'M' + cl.bot[0] + ',' + cl.bot[1] + 'L' + xt2 + ',' + cl.bot[1] + '" fill="none"/>');
      d.terminal([xt2, cl.top[1]]); d.terminal([xt2, cl.bot[1]]);
      d.current({ at: [xt2 + 18, cl.top[1]], dir: 'right', label: o.I === true || o.I == null ? 'i' : o.I, side: 'top', len: 12, gap: 7 });
      d.label([xcL - 8, Y0 + t + 30], Nl, { anchor: 'end' });
      // mean paths
      var mx = (xcL + xcR) / 2, lx = X0 + t / 2, rx = X0 + W - t / 2, ty = Y0 + t / 2, by = Y0 + H - t / 2;
      d.poly([[mx, ty], [lx, ty], [lx, by], [mx, by], [mx, ty]], { dash: '5 4', sw: 1.1, noObstacle: true });
      d.poly([[mx, ty], [rx, ty], [rx, by], [mx, by]], { dash: '5 4', sw: 1.1, noObstacle: true });
      if (phi) {
        var ya = by - 38;
        d.arrowHead([mx, ya - 6], [0, -1]); d.arrowHead([lx, ya + 6], [0, 1]); d.arrowHead([rx, ya + 6], [0, 1]);
        d.label([xcR + 6, ya - 4], phi, { anchor: 'start' });
        d.label([X0 + t + 6, ya + 4], o.phi1 || 'Φ_1', { anchor: 'start' }); d.label([X0 + W - t - 6, ya + 4], o.phi2 || 'Φ_2', { anchor: 'end' });
      }
      if (o.lc) d.label([X0 + W / 2, Y0 - 8], o.lc, { anchor: 'middle', valign: 'bottom' });
      if (o.A) d.label([X0 + W / 2, Y0 + H + 10], o.A, { anchor: 'middle', valign: 'top' });
      if (o.mu) d.label([X0 + t + wl + tc + wl / 2, ym], o.mu, { anchor: 'middle' });
      return fin(d, o, 'Shell-type core');
    }
    // rectangular C core
    var X = 90, Y = 40, Wc = 260, Hc = 220, T = 44;
    d.rect(X, Y, Wc, Hc, { fill: CORE });
    d.rect(X + T, Y + T, Wc - 2 * T, Hc - 2 * T, { fill: '#fff' });
    var ymid = Y + Hc / 2;
    if (gapL) {
      var gx = X + Wc - T;
      d.rect(gx - 2, ymid - 5, T + 4, 10, { fill: '#fff', noObstacle: true });
      d.items.push('<path d="M' + gx + ',' + (ymid - 5) + 'L' + (gx + T) + ',' + (ymid - 5) + 'M' + gx + ',' + (ymid + 5) + 'L' + (gx + T) + ',' + (ymid + 5) + '" fill="none"/>');
      d.label([X + Wc + 10, ymid], gapL, { anchor: 'start' });
    }
    var cc = coilOnVertical(d, X, X + T, Y + T + 10, Y + Hc - T - 10, 7);
    leads(d, cc, X - 46, o);
    d.label([X + T + 10, ymid], Nl, { anchor: 'start' });
    if (o.N2) {
      var c2 = coilOnVertical(d, X + Wc - T, X + Wc, Y + T + 10, ymid - 16, 4);
      var xt3 = X + Wc + 46;
      var ctop = [X + Wc + 6, c2.top[1] - 4 * 0], cbot = [X + Wc + 6, c2.bot[1] - 14];
      d.line([X + Wc + 6, Y + T + 12], [xt3, Y + T + 12]); d.line([X + Wc + 6, ymid - 22], [xt3, ymid - 22]);
      d.terminal([xt3, Y + T + 12]); d.terminal([xt3, ymid - 22]);
      d.label([X + Wc - T - 10, Y + T + 30], typeof o.N2 === 'number' ? 'N_2 = ' + o.N2 : o.N2, { anchor: 'end' });
    }
    var m0 = X + T / 2, m1 = X + Wc - T / 2, n0 = Y + T / 2, n1 = Y + Hc - T / 2;
    d.poly([[m0, n0], [m1, n0], [m1, n1], [m0, n1], [m0, n0]], { dash: '5 4', sw: 1.1, noObstacle: true });
    if (phi) { d.arrowHead([(m0 + m1) / 2 + 6, n0], [1, 0]); d.label([(m0 + m1) / 2, Y + T + 6], phi, { anchor: 'middle', valign: 'top' }); }
    if (o.lc) d.label([(m0 + m1) / 2, Y + Hc - T - 6], o.lc, { anchor: 'middle', valign: 'bottom' });
    if (o.A) d.label([(m0 + m1) / 2, Y + Hc + 10], o.A, { anchor: 'middle', valign: 'top' });
    if (o.mu) d.label([(m0 + m1) / 2 + 12, ymid], o.mu, { anchor: 'middle' });
    return fin(d, o, 'Magnetic core');
  };
  /**
   * reluctanceCircuit: kind:'series' (default) | 'parallel' (shell: centre limb with the MMF, two outer limbs).
   * F (MMF label, default 'ℱ = Ni'), series: [labels] of reluctances (default ['\\mathcal{R}_c','\\mathcal{R}_g']), values:[..],
   * parallel: Rc (centre), R1 (left), R2 (right), Rg (gap in the centre limb, optional), phi labels (phi, phi1, phi2)
   */
  S.reluctanceCircuit = function (o) {
    o = o || {}; var d = S.drawing();
    var F = o.F || 'ℱ = Ni';
    if (o.kind === 'parallel') {
      var yt = 50, yb = 220, xl = 60, xc = 210, xr = 360;
      d.line([xl, yt], [xr, yt]); d.line([xl, yb], [xr, yb]);
      var rl = function (k, s) { var v = o[k]; return { k: 'R', label: v && typeof v === 'object' ? v.label : s, value: v && typeof v === 'object' ? v.value : (typeof v === 'string' ? v : null) }; };
      run(d, [rl('R1', '\\mathcal{R}_1')], [xl, yt], [xl, yb], 'left', 66);
      run(d, [rl('R2', '\\mathcal{R}_2')], [xr, yt], [xr, yb], 'right', 66);
      var cen = [rl('Rc', '\\mathcal{R}_c')]; if (o.Rg) cen.push(rl('Rg', '\\mathcal{R}_g'));
      cen.push({ k: 'V', label: F, rev: true });
      run(d, cen, [xc, yt], [xc, yb], 'right', cen.length > 2 ? 46 : 56);
      d.dot([xc, yt]); d.dot([xc, yb]);
      var ph = o.phi === false ? null : (o.phi || 'Φ');
      if (ph) {
        d.current({ at: [(xl + xc) / 2, yt], dir: 'left', label: o.phi1 || 'Φ_1', side: 'top', len: 14, gap: 8 });
        d.current({ at: [(xc + xr) / 2, yt], dir: 'right', label: o.phi2 || 'Φ_2', side: 'top', len: 14, gap: 8 });
      }
      return fin(d, o, 'Parallel magnetic circuit');
    }
    var labs = o.series || ['\\mathcal{R}_c', '\\mathcal{R}_g'], vals = o.values || [];
    var els = labs.map(function (s, i) { return { k: 'R', label: s, value: vals[i] || null }; });
    var top = els.slice(), right = top.length > 2 ? [top.pop()] : (top.length === 2 ? [top.pop()] : []);
    var g = loop(d, o, { k: 'V', label: F }, top, right, { minW: 170 });
    if (o.phi !== false) d.current({ at: [g.x0 + 24, g.yt], dir: 'right', label: o.phi || 'Φ', side: 'top', len: 14, gap: 9 });
    return fin(d, o, 'Magnetic equivalent circuit');
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* =============================================================================
 * CATALOG: every template with its option keys and sample values.
 * tests/gallery.html renders these; course agents copy the samples.
 * ============================================================================= */
(function (G) {
  'use strict';
  var S = G.QB.sch;
  var IO = 'IO keys: C1, Rs, vs, vi (input, drawn leftwards) · C2, RL, vo (output, drawn rightwards). nodes:true, currents:true.';
  S.catalog = [
    /* ---- BJT ---- */
    { name: 'bjtFixedBias', group: 'BJT', keys: 'VCC, RB, RC, beta, Q, type:"npn"|"pnp". ' + IO,
      samples: [{ title: 'DC bias with node labels', o: { VCC: '12 V', RB: '240 kΩ', RC: '2.2 kΩ', beta: 50, nodes: true, currents: true } },
        { title: 'AC amplifier, coupling caps', o: { VCC: '12 V', RB: '470 kΩ', RC: '3 kΩ', beta: 100, C1: true, C2: true, vi: true, vo: true } }] },
    { name: 'bjtEmitterBias', group: 'BJT', keys: 'VCC, RB, RC, RE (or RE1+RE2), CE (bypass), beta. ' + IO,
      samples: [{ title: 'Emitter-stabilised', o: { VCC: '20 V', RB: '430 kΩ', RC: '2 kΩ', RE: '1 kΩ', beta: 50, currents: true } },
        { title: 'pnp, negative supply', o: { type: 'pnp', VCC: '−18 V', RB: '510 kΩ', RC: '3.3 kΩ', RE: '1.2 kΩ', beta: 120, nodes: true } }] },
    { name: 'bjtVDB', group: 'BJT', keys: 'VCC, R1, R2, RC, RE | RE1+RE2 (partial bypass), CE, beta, Q, type. ' + IO,
      samples: [{ title: 'DC (WS5 Q7 style)', o: { VCC: '16 V', R1: '62 kΩ', R2: '9.1 kΩ', RC: '3.9 kΩ', RE: '0.68 kΩ', beta: 80, nodes: true, currents: true } },
        { title: 'Bypassed CE amplifier with source and load', o: { VCC: '22 V', R1: '56 kΩ', R2: '8.2 kΩ', RC: '6.8 kΩ', RE: '1.5 kΩ', CE: true, beta: 90, C1: true, C2: true, Rs: '1 kΩ', vs: true, RL: '10 kΩ', vo: true } },
        { title: 'Partially bypassed RE', o: { VCC: '15 V', R1: '47 kΩ', R2: '10 kΩ', RC: '2.7 kΩ', RE1: '220 Ω', RE2: '1 kΩ', CE: true, beta: 150, C1: true, C2: true, vi: true, vo: true } }] },
    { name: 'bjtCollectorFeedback', group: 'BJT', keys: 'VCC, RF, RC, RE (optional), CE, beta. ' + IO,
      samples: [{ title: 'Collector feedback with RE', o: { VCC: '10 V', RF: '250 kΩ', RC: '4.7 kΩ', RE: '1.2 kΩ', beta: 90, currents: true } },
        { title: 'AC version', o: { VCC: '9 V', RF: '180 kΩ', RC: '2.7 kΩ', beta: 200, C1: true, C2: true, vi: true, vo: true } }] },
    { name: 'bjtEmitterFollower', group: 'BJT', keys: 'VCC, RB or R1+R2, RE, RC (optional), beta. Output taken at the emitter. ' + IO,
      samples: [{ title: 'Fixed-bias emitter follower', o: { VCC: '12 V', RB: '220 kΩ', RE: '3.3 kΩ', beta: 100, C1: true, C2: true, vi: true, vo: true } },
        { title: 'Divider bias, with load', o: { VCC: '16 V', R1: '82 kΩ', R2: '22 kΩ', RE: '2.2 kΩ', beta: 120, C1: true, C2: true, Rs: '600 Ω', vs: true, RL: '1 kΩ', vo: true } }] },
    { name: 'bjtCommonBase', group: 'BJT', keys: 'VCC, VEE (omit -> RE to ground), RC, RE, beta or alpha, type. ' + IO,
      samples: [{ title: 'Dual-supply common base', o: { VCC: '8 V', VEE: '−2 V', RC: '5 kΩ', RE: '1 kΩ', alpha: 0.98, C1: true, C2: true, vi: true, vo: true, currents: true } }] },
    { name: 'bjtTwoStageRC', group: 'BJT', keys: 'VCC, R1,R2,RC,RE,CE,beta (stage 1; stage 2 uses R3,R4,RC2,RE2,CE2,beta2 or copies), s1:{..}, s2:{..} overrides, Cc (coupling), Cout. ' + IO,
      samples: [{ title: 'Identical stages (Week 5 example)', o: { VCC: '20 V', R1: '15 kΩ', R2: '4.7 kΩ', RC: '2.2 kΩ', RE: '1 kΩ', CE: true, beta: 200, C1: true, vi: true, RL: '10 kΩ', vo: true } }] },
    { name: 'darlington', group: 'BJT', keys: 'VCC, RB or R1+R2, RC (optional), RE, beta1, beta2, output:"emitter"|"collector", box:true (dashed outline). ' + IO,
      samples: [{ title: 'Darlington emitter follower', o: { VCC: '18 V', RB: '3.3 MΩ', RE: '390 Ω', beta1: 'β_D = 8000', C1: true, C2: true, vi: true, vo: true, box: true } }] },
    { name: 'currentMirror', group: 'BJT', keys: 'VCC, Rref, RC (load; omit for an "I_o to load" terminal), Iref, Io labels, vo.',
      samples: [{ title: 'Basic mirror with load', o: { VCC: '12 V', Rref: '1.1 kΩ', RC: '2.2 kΩ', vo: true } }, { title: 'Mirror as current sink', o: { VCC: true, Rref: '10 kΩ', Io: 'I_o ≈ I_{ref}' } }] },
    { name: 'reModel', group: 'BJT', keys: 'Rs, vs, vi, RB (e.g. "R_1∥R_2"), re (label, default βr_e), betaIb, ro, RC, RL, RE (unbypassed), vo, Zi, Zo.',
      samples: [{ title: 'CE r_e model with source and load', o: { Rs: true, vs: true, RB: { label: 'R_1∥R_2' }, ro: true, RC: true, RL: true, Zi: true, Zo: true } },
        { title: 'Unbypassed R_E', o: { vi: true, RB: true, RC: true, RE: true } }] },
    { name: 'hybridPiModel', group: 'BJT', keys: 'same as reModel; rpi (label, default r_π), gm (label, default g_m v_π).',
      samples: [{ title: 'Hybrid-π with r_o', o: { vi: true, RB: true, ro: true, RC: true, RL: true, Zi: true, Zo: true } }] },
    /* ---- FET ---- */
    { name: 'jfetFixedBias', group: 'FET', keys: 'VDD, VGG, RG, RD, dev (text beside device), type:"n"|"p". ' + IO,
      samples: [{ title: 'Fixed bias', o: { VDD: '16 V', VGG: '2 V', RG: '1 MΩ', RD: '2 kΩ', dev: 'I_{DSS} = 10 mA', nodes: true, currents: true } }] },
    { name: 'jfetSelfBias', group: 'FET', keys: 'VDD, RG, RD, RS, CS (bypass), dev, type. Rsig = signal-source resistance. ' + IO,
      samples: [{ title: 'Self-bias DC', o: { VDD: '20 V', RG: '1 MΩ', RD: '3.3 kΩ', RS: '1 kΩ', dev: 'V_P = −6 V', nodes: true, currents: true } },
        { title: 'Bypassed CS amplifier', o: { VDD: '20 V', RG: '1 MΩ', RD: '3.3 kΩ', RS: '1 kΩ', CS: true, C1: true, C2: true, vi: true, vo: true, RL: '10 kΩ' } }] },
    { name: 'fetVDB', group: 'FET', keys: 'VDD, R1, R2, RD, RS, CS, device:"jfet"|"nE"|"nD"|"pE"|"pD", type. ' + IO,
      samples: [{ title: 'JFET divider bias', o: { VDD: '16 V', R1: '2.1 MΩ', R2: '270 kΩ', RD: '2.4 kΩ', RS: '1.5 kΩ', nodes: true } },
        { title: 'E-MOSFET divider bias amplifier', o: { device: 'nE', VDD: '24 V', R1: '10 MΩ', R2: '6.8 MΩ', RD: '2.2 kΩ', RS: '0.75 kΩ', CS: true, C1: true, C2: true, Rsig: '1 kΩ', vs: true, vo: true } }] },
    { name: 'emosDrainFeedback', group: 'FET', keys: 'VDD, RG (drain to gate), RD, device (default "nE"). ' + IO,
      samples: [{ title: 'Drain feedback', o: { VDD: '12 V', RG: '10 MΩ', RD: '2 kΩ', dev: 'V_{GS(Th)} = 3 V', C1: true, C2: true, vi: true, vo: true } }] },
    { name: 'sourceFollower', group: 'FET', keys: 'VDD, RG or R1+R2, RS, RD (optional), device. Output at the source. ' + IO,
      samples: [{ title: 'JFET source follower', o: { VDD: '9 V', RG: '1 MΩ', RS: '2.2 kΩ', C1: true, C2: true, vi: true, vo: true } }] },
    { name: 'commonGate', group: 'FET', keys: 'VDD, RD, RS, device, dev. Rsig. ' + IO,
      samples: [{ title: 'Common gate', o: { VDD: '15 V', RD: '3.3 kΩ', RS: '1.1 kΩ', C1: true, C2: true, vi: true, vo: true } }] },
    { name: 'fetSmallSignal', group: 'FET', keys: 'Rsig/Rs, vs, vi, RG, gm (label), rd, RD, RL, RS (unbypassed), vo, Zi, Zo.',
      samples: [{ title: 'CS small-signal model', o: { vi: true, RG: true, rd: true, RD: true, RL: true, Zi: true, Zo: true } }, { title: 'Unbypassed R_S', o: { vi: true, RG: true, RD: true, RS: true } }] },
    /* ---- Diodes and rectifiers ---- */
    { name: 'diodeSeriesString', group: 'Diodes', keys: 'E, Erev, battery:true (cell symbol), diodes: N | [\'Si\' | {label,value,k:"D"|"zener"|"led",rev}], rev (bool or [bools]), R (series, top), Rfirst, R2 (right leg), E2, E2rev, vo, I, ground. Or explicit top:[spec], right:[spec] with spec {k:"R"|"D"|"ZD"|"LED"|"V"|"B", label, value, rev}.',
      samples: [{ title: 'Two series Si diodes', o: { E: '12 V', diodes: [{ label: 'D_1', value: 'Si' }, { label: 'D_2', value: 'Si' }], R2: '5.6 kΩ', vo: true, I: true } },
        { title: 'Reversed diode, two sources', o: { E: '10 V', diodes: 1, rev: true, R: '2.2 kΩ', E2: '5 V', I: 'I_D' } },
        { title: 'Si + Ge + LED string', o: { E: '20 V', top: [{ k: 'D', label: 'D_1', value: 'Si' }, { k: 'D', label: 'D_2', value: 'Ge' }, { k: 'LED', label: 'LED', value: '2 V' }], right: [{ k: 'R', label: 'R', value: '1 kΩ' }], vo: true, ground: true } }] },
    { name: 'diodeParallel', group: 'Diodes', keys: 'E, R (series), diodes: N | [spec], rev, Rb:[labels] (series R in each diode branch), RL, vo, currents, ground.',
      samples: [{ title: 'Two parallel diodes', o: { E: '10 V', R: '0.33 kΩ', diodes: [{ label: 'D_1', value: 'Si' }, { label: 'D_2', value: 'Si' }], vo: true, currents: true } },
        { title: 'Si ∥ Ge with load', o: { E: '12 V', R: '2.2 kΩ', diodes: [{ label: 'D_1', value: 'Si' }, { label: 'D_2', value: 'Ge' }], RL: '4.7 kΩ' } }] },
    { name: 'halfWave', group: 'Diodes', keys: 'vs (ac source), tx:true | "1 : 4" (transformer, primary vp), vp, D (spec), rev (negative output), C (filter), polarC, RL, vo, IL.',
      samples: [{ title: 'Half-wave with RL', o: { vs: '20 V peak', RL: '2 kΩ', vo: true } },
        { title: 'Transformer, reservoir capacitor', o: { tx: '10 : 1', vp: '230 V rms', vs: true, C: '470 µF', polarC: true, RL: '1 kΩ', vo: true, IL: true } },
        { title: 'Reversed diode (negative output)', o: { vs: true, rev: true, RL: true, vo: true } }] },
    { name: 'centreTap', group: 'Diodes', keys: 'vp, ratio ("1 : 2"), vs (label beside each half), D1, D2, C, polarC, RL, vo.',
      samples: [{ title: 'Centre-tapped full wave', o: { vp: '120 V rms', ratio: '1 : 2', vs: true, RL: '1 kΩ', vo: true } },
        { title: 'With filter capacitor', o: { vp: true, vs: '12 V rms', C: '1000 µF', polarC: true, RL: '470 Ω', vo: true } }] },
    { name: 'bridge', group: 'Diodes', keys: 'vs | tx (+vp), D1..D4 (spec), dlabels, C, polarC, RL, vo, IL. Negative output node grounded.',
      samples: [{ title: 'Bridge with RL', o: { vs: '170 V peak', RL: '1 kΩ', vo: true } },
        { title: 'Transformer + capacitor filter', o: { tx: '20 : 1', vp: '230 V', vs: true, C: '2200 µF', polarC: true, RL: '100 Ω', vo: true, IL: true } }] },
    { name: 'zenerShunt', group: 'Diodes', keys: 'Vi, ac:true (ac/variable source), R, Vz, PZM (number W or text), RL, vo, currents (I_R, I_Z, I_L), ground.',
      samples: [{ title: 'Zener regulator with load', o: { Vi: '16 V', R: '1 kΩ', Vz: '10 V', PZM: 0.03, RL: '1.2 kΩ', vo: true, currents: true } },
        { title: 'No load, variable input', o: { Vi: true, ac: true, R: '220 Ω', Vz: '20 V', vo: 'V_o' } }] },
    { name: 'clipperSeries', group: 'Diodes', keys: 'vi, D (spec), rev, V (battery in series with the diode), Vrev, Vfirst, R, vo (false hides).',
      samples: [{ title: 'Series clipper', o: { vi: '±20 V', R: '2.2 kΩ' } },
        { title: 'Series clipper with bias', o: { vi: true, V: '5 V', R: true, rev: true } }] },
    { name: 'clipperShunt', group: 'Diodes', keys: 'vi, R, D (spec), rev, V (battery in the diode branch), Vrev, zener:true, double:true (second branch D2/V2, opposite), V2, V2rev, rev2, RL, vo.',
      samples: [{ title: 'Biased shunt clipper', o: { vi: '16 V peak', R: '1 kΩ', V: '4 V' } },
        { title: 'Double-ended clipper', o: { vi: true, R: true, double: true, V: '3 V', V2: '5 V' } }] },
    { name: 'clamper', group: 'Diodes', keys: 'vi, C, D (spec), rev (clamp upward), V (battery with the diode), Vrev, R (load), vo.',
      samples: [{ title: 'Negative clamper', o: { vi: '±10 V square', C: '1 µF', R: '100 kΩ' } },
        { title: 'Biased clamper', o: { vi: true, C: true, V: '5 V', rev: true, R: true } }] },
    /* ---- Op-amps and power amps ---- */
    { name: 'opInverting', group: 'Op-amp', keys: 'R1, Rf, Cf (optional across Rf), vi, vo, Rp (+ input to ground), RL, supplies:true | Vpos/Vneg, label.',
      samples: [{ title: 'Inverting amplifier', o: { R1: '10 kΩ', Rf: '100 kΩ', vi: true, vo: true } },
        { title: 'With bias resistor, load and supplies', o: { R1: '4.7 kΩ', Rf: '47 kΩ', Rp: '4.3 kΩ', RL: '2 kΩ', supplies: true, vi: '0.5 V' } }] },
    { name: 'opNonInverting', group: 'Op-amp', keys: 'R1 (to ground), Rf, vi, Rs, vo, RL, supplies.',
      samples: [{ title: 'Non-inverting amplifier', o: { R1: '10 kΩ', Rf: '90 kΩ', vi: true, vo: true } },
        { title: 'Source resistance and load', o: { R1: true, Rf: true, Rs: '1 kΩ', RL: '10 kΩ', supplies: true } }] },
    { name: 'opSumming', group: 'Op-amp', keys: 'inputs: N | [{v, R}] | ["v_1", ...] (default 3), R1..Rn (values), Rf, Rp, RL, vo, supplies.',
      samples: [{ title: 'Three-input summer', o: { inputs: 3, R1: '10 kΩ', R2: '20 kΩ', R3: '50 kΩ', Rf: '100 kΩ' } },
        { title: 'Two inputs with values', o: { inputs: [{ v: 'v_1 = 0.2 V', R: '33 kΩ' }, { v: 'v_2 = −0.5 V', R: '22 kΩ' }], Rf: '330 kΩ', Rp: true } }] },
    { name: 'opFollower', group: 'Op-amp', keys: 'vi, Rs, vo, RL, supplies.',
      samples: [{ title: 'Voltage follower', o: { vi: true, vo: true } }, { title: 'Buffering a source', o: { vi: { label: 'v_s' }, Rs: '100 kΩ', RL: '1 kΩ' } }] },
    { name: 'diffPair', group: 'Op-amp', keys: 'VCC, VEE, RC (or RC1/RC2), RE | tail:"I" + IEE, RB, v1, v2, vs:true (ac sources), vo1, vo2, vo (differential label), beta, currents.',
      samples: [{ title: 'BJT differential pair', o: { VCC: '+9 V', VEE: '−9 V', RC: '47 kΩ', RE: '43 kΩ', v1: true, v2: true, vo1: true, vo2: true, vo: true } },
        { title: 'Current-source tail', o: { VCC: '+12 V', VEE: '−12 V', RC: '10 kΩ', tail: 'I', IEE: '1 mA', RB: '20 kΩ', vs: true, v1: true, v2: true, vo2: true, currents: true } }] },
    { name: 'classA', group: 'Op-amp', keys: 'Series-fed class A. Same keys as bjtFixedBias (VCC, RB or R1+R2, RC, RE, beta, C1, vi, vo, currents, nodes).',
      samples: [{ title: 'Series-fed class A', o: { VCC: '20 V', RB: '1 kΩ', RC: '20 Ω', beta: 25, vo: true, currents: true } },
        { title: 'Divider-biased', o: { VCC: '15 V', R1: '1.5 kΩ', R2: '330 Ω', RC: '16 Ω', RE: '4.7 Ω', beta: 60, vi: true } }] },
    { name: 'classATransformer', group: 'Op-amp', keys: 'VCC, R1+R2 (or RB), RE, CE, polarC, beta, ratio ("N_1 : N_2" or "3 : 1"), RL, dots, C1, vi, vs, Rs, currents.',
      samples: [{ title: 'Transformer-coupled class A', o: { VCC: '10 V', R1: '1 kΩ', R2: '330 Ω', RE: '10 Ω', CE: true, ratio: '3 : 1', RL: '8 Ω', vi: true } },
        { title: 'Fixed bias, currents', o: { VCC: '12 V', RB: '2.2 kΩ', ratio: 'a = 4', RL: '16 Ω', beta: 80, currents: true } }] },
    { name: 'classBPushPull', group: 'Op-amp', keys: 'VCC, VEE (omit -> lower collector to ground), RL, Cout (output capacitor), bias:"none"|"diodes"|"R" (R1,D1,D2,R2 or R1,R2,R3), vi, C1, vo, currents, Qn, Qp.',
      samples: [{ title: 'Complementary class B', o: { VCC: '+12 V', VEE: '−12 V', RL: '8 Ω', vi: true, vo: true } },
        { title: 'Class AB with diode bias', o: { VCC: '+15 V', VEE: '−15 V', bias: 'diodes', R1: '1 kΩ', R2: '1 kΩ', RL: '4 Ω', vo: true, currents: true } }] },
    /* ---- AC circuits ---- */
    { name: 'seriesRLC', group: 'AC', keys: 'V, dc, R, L | XL ("jX_L" label), C | XC, Z (box), order ("RLC", any subset), I, drops:true (V_R, V_L, V_C).',
      samples: [{ title: 'Series RLC with drops', o: { V: '230 V, 50 Hz', R: '10 Ω', L: '50 mH', C: '200 µF', I: true, drops: true } },
        { title: 'R–L series (reactance form)', o: { V: { label: 'V_s' }, R: '8 Ω', XL: '6 Ω', I: 'I' } },
        { title: 'Load impedance box', o: { V: '240∠0° V', R: '0.5 Ω', Z: '12 + j9 Ω', order: 'RZ', I: true } }] },
    { name: 'parallelRL', group: 'AC', keys: 'V, R, L | XL, RLs (coil resistance in series with L), Rs (source resistance), currents (I, I_R, I_L).',
      samples: [{ title: 'Parallel RL', o: { V: '120 V, 60 Hz', R: '20 Ω', XL: '15 Ω', currents: true } }, { title: 'Coil with resistance', o: { V: true, R: '50 Ω', L: '0.2 H', RLs: '5 Ω', Rs: '1 Ω' } }] },
    { name: 'parallelRC', group: 'AC', keys: 'V, R, C | XC, Rs, currents (I, I_R, I_C).',
      samples: [{ title: 'Parallel RC', o: { V: '230 V', R: '100 Ω', XC: '80 Ω', currents: true } }, { title: 'Values only', o: { V: '10 V, 1 kHz', R: '1 kΩ', C: '0.1 µF' } }] },
    { name: 'loadWithPFCap', group: 'AC', keys: 'V, load:"box"|"RL"|"motor", P, pf (box text), R, XL (for RL), loadLabel, C (correction; omit -> none), sw:true|"closed", Zline, currents (I_s, I_L, I_C).',
      samples: [{ title: 'Inductive load with correction capacitor', o: { V: '415 V, 50 Hz', P: '20 kW', pf: '0.75 lag', C: true, currents: true } },
        { title: 'Motor, switched capacitor, line impedance', o: { V: true, load: 'motor', P: '5 kW', pf: '0.8', C: true, sw: true, Zline: '0.2 + j0.4 Ω' } },
        { title: 'R–L load, no capacitor', o: { V: '230 V', load: 'RL', R: '12 Ω', XL: '16 Ω' } }] },
    { name: 'starLoad', group: 'AC', keys: 'Z (label for all) or Za/Zb/Zc, value, kind:"box"|"R"|"RL"|"RC", neutral:true, lines:["A","B","C"], phases, VL (text), currents.',
      samples: [{ title: 'Balanced star with neutral', o: { Z: 'Z_Y', value: '10∠30° Ω', neutral: true, currents: true } },
        { title: 'R–L arms', o: { kind: 'RL', VL: 'V_L = 415 V' } }] },
    { name: 'deltaLoad', group: 'AC', keys: 'Z or Zab/Zbc/Zca, value, kind:"box"|"R"|"RL"|"RC", lines, currents, phaseCurrents, VL.',
      samples: [{ title: 'Balanced delta', o: { Z: 'Z_Δ', value: '30∠40° Ω', currents: true } }, { title: 'Unbalanced resistive delta', o: { kind: 'R', Zab: 'R_{AB}', Zbc: 'R_{BC}', Zca: 'R_{CA}', VL: '400 V' } }] },
    { name: 'batteryModel', group: 'AC', keys: 'E, cell:true (cell symbol), r, box (default true; false = no dashed outline), RL, sw:true|"closed", I, V, norton:true (+IN).',
      samples: [{ title: 'Battery with internal resistance and load', o: { E: '12.6 V', r: '0.05 Ω', RL: '1.2 Ω', I: true, V: 'V_T' } },
        { title: 'Norton model with switch', o: { norton: true, IN: '20 A', r: '0.6 Ω', sw: true, RL: true } }] },
    /* ---- Machines ---- */
    { name: 'transformerEquiv', group: 'Machines', keys: 'kind:"full"|"simplified"|"series", side:"primary"|"secondary" (referral), ideal:true (+ratio; nothing referred), R1, X1, R2, X2, Rc (false omits), Xm, Req, Xeq, labels:{..}, V1, V2, I1, I2, I0, load:true|"Z_L".',
      samples: [{ title: 'Full circuit referred to primary', o: { kind: 'full', V1: true, V2: true, I1: true, I2: true } },
        { title: 'Simplified, referred to secondary, with load', o: { kind: 'simplified', side: 'secondary', Req: '0.06 Ω', Xeq: '0.2 Ω', I0: true, load: true } },
        { title: 'Full with ideal transformer', o: { kind: 'full', ideal: true, ratio: '2400 : 240' } }] },
    { name: 'ocTest', group: 'Machines', keys: 'vs (source text; false hides), V, I, P (meter readings), sideLabel:["LV","HV"] | false.',
      samples: [{ title: 'Open-circuit test', o: { V: '240 V', I: '0.8 A', P: '60 W' } }, { title: 'Symbols only', o: { V: true, I: true, P: true } }] },
    { name: 'scTest', group: 'Machines', keys: 'same as ocTest (default HV side metered, LV shorted).',
      samples: [{ title: 'Short-circuit test', o: { V: '48 V', I: '20.8 A', P: '617 W' } }, { title: 'Symbols only', o: { V: true, I: true, P: true } }] },
    { name: 'imPerPhase', group: 'Machines', keys: 'kind:"simplified"|"exact", R1, X1, X2, R2, Rc (false omits), Xm, split:true (+Rload), mode:"motor"|"gen", V1, I1, I2, I0, s (text), labels.',
      samples: [{ title: 'Simplified (course form)', o: { R1: '0.2 Ω', X1: '0.5 Ω', X2: '0.5 Ω', R2: '0.15 Ω / s', Xm: '20 Ω', Rc: false, I1: true, I2: true, I0: true } },
        { title: 'Exact, split rotor resistance', o: { kind: 'exact', split: true, I1: true, I2: true, s: 's = 0.04' } },
        { title: 'Generator (s < 0)', o: { mode: 'gen', Rc: true, I1: true, I2: true } }] },
    { name: 'imTestNoLoad', group: 'Machines', keys: 'V, I, P1, P2 (readings), meters:"two"|"one", lines, note.',
      samples: [{ title: 'No-load test (two wattmeters)', o: { V: '400 V', I: '6.2 A', P1: '1.2 kW', P2: '−0.4 kW' } }, { title: 'Single wattmeter', o: { meters: 'one', V: true, I: true, P1: true } }] },
    { name: 'imTestBlocked', group: 'Machines', keys: 'same as imTestNoLoad.',
      samples: [{ title: 'Blocked-rotor test', o: { V: '75 V', I: '25 A', P1: '1.5 kW', P2: '0.6 kW' } }, { title: 'Symbols only', o: { V: true, I: true } }] },
    { name: 'dcMachine', group: 'Machines', keys: 'kind:"separate"|"shunt"|"series"|"compound" (long shunt), mode:"motor"|"gen", Ra, Rf, Lf, Radj, Rs (series field), VT, VF, EA, currents.',
      samples: [{ title: 'Shunt motor', o: { kind: 'shunt', Ra: '0.25 Ω', Rf: '120 Ω', VT: '240 V', currents: true } },
        { title: 'Separately excited generator', o: { kind: 'separate', mode: 'gen', Ra: true, Rf: true, Radj: true, VF: true, currents: true } },
        { title: 'Series motor', o: { kind: 'series', Ra: '0.1 Ω', Rs: '0.05 Ω', VT: true, currents: true } },
        { title: 'Long-shunt compound', o: { kind: 'compound', Ra: true, Rs: true, Rf: true, currents: true } }] },
    { name: 'syncModel', group: 'Machines', keys: 'mode:"gen"|"motor", Xs, Ra, E0, V, I (label; false hides), bus:true (infinite bus), load:true|"Z_L".',
      samples: [{ title: 'Generator on an infinite bus', o: { mode: 'gen', Xs: '1.2 Ω', bus: true } }, { title: 'Motor with Ra', o: { mode: 'motor', Ra: true, Xs: true, E0: { label: 'E_0∠δ' } } },
        { title: 'Generator supplying a load', o: { Xs: true, load: true, I: 'I_a' } }] },
    /* ---- DSP ---- */
    { name: 'blockCascade', group: 'DSP', keys: 'blocks:[labels | [lines]], x, y, mid:[labels between blocks].',
      samples: [{ title: 'Two systems in cascade', o: { blocks: ['H_1(z)', 'H_2(z)'], mid: ['w(n)'] } }, { title: 'Three blocks', o: { blocks: ['H_1(ω)', 'H_2(ω)', 'H_3(ω)'], x: 'X(ω)', y: 'Y(ω)' } }] },
    { name: 'blockParallel', group: 'DSP', keys: 'blocks (stacked), signs:["+","−"], x, y.',
      samples: [{ title: 'Parallel connection', o: { blocks: ['H_1(z)', 'H_2(z)'] } }, { title: 'Three branches, one subtracted', o: { blocks: ['H_1(z)', 'z^{-2}', 'H_3(z)'], signs: ['+', '+', '-'] } }] },
    { name: 'blockFeedback', group: 'DSP', keys: 'G (block or [blocks]), H (block; false -> unity), sign:"-"|"+", x, y, e.',
      samples: [{ title: 'Negative feedback', o: { G: 'G(z)', H: 'H(z)', e: 'e(n)' } }, { title: 'Positive feedback through a delay', o: { G: ['K', 'z^{-1}'], H: 'a', sign: '+', x: 'X(z)', y: 'Y(z)' } }] },
    { name: 'directFormI', group: 'DSP', keys: 'call (b, a, opts) or ({b, a, ...}); a[0] = 1; symbolic:true, x, y. Zero coefficients are skipped (unless symbolic).',
      samples: [{ title: 'Second order (numeric)', o: { b: [1, 0.5, 0.25], a: [1, -0.9, 0.81] } }, { title: 'Symbolic, M = 1, N = 2', o: { b: [1, 1], a: [1, 1, 1], symbolic: true } }] },
    { name: 'directFormII', group: 'DSP', keys: 'same as directFormI, plus w:true|"w(n)" (delay-line label).',
      samples: [{ title: 'Canonical second order', o: { b: [2, 0, -1], a: [1, -0.5, 0.06], w: true } }, { title: 'Symbolic third order', o: { b: [1, 1, 1, 1], a: [1, 1, 1, 1], symbolic: true } }] },
    { name: 'adcChain', group: 'DSP', keys: 'stages ([lines] per block; use \\\\text{} for words), signals (arrow labels), fs, bits, dac:true.',
      samples: [{ title: 'ADC', o: { fs: 'F_s = 8 kHz', bits: 'b = 8' } }, { title: 'ADC + DAC chain', o: { dac: true } }] },
    /* ---- Magnetics ---- */
    { name: 'magCore', group: 'Magnetics', keys: 'kind:"C"|"toroid"|"shell", N, I, gap (true | "g = 1 mm"), gapLeg (shell), lc, A, mu, phi (false hides), phi1/phi2 (shell), N2 (C core).',
      samples: [{ title: 'C core with air gap', o: { N: 'N = 500', gap: 'l_g = 1 mm', lc: 'l_c = 0.6 m', A: 'A = 20 cm²', mu: 'µ_r = 3000' } },
        { title: 'Toroid with gap', o: { kind: 'toroid', N: 300, gap: 'g', lc: 'l_c = 30 cm', A: 'A = 4 cm²' } },
        { title: 'Shell core, gap in centre limb', o: { kind: 'shell', N: 'N', gap: 'g', lc: 'l', A: 'A' } },
        { title: 'Two windings', o: { N: 'N_1', N2: 'N_2', lc: 'l_c' } }] },
    { name: 'reluctanceCircuit', group: 'Magnetics', keys: 'kind:"series"|"parallel", F (MMF label), series:[labels], values:[..], parallel: Rc, R1, R2, Rg ({label,value} or text), phi, phi1, phi2.',
      samples: [{ title: 'Core + gap in series', o: { series: ['\\mathcal{R}_c', '\\mathcal{R}_g'], values: ['199 kA/Wb', '398 kA/Wb'] } },
        { title: 'Shell core (parallel)', o: { kind: 'parallel', Rg: true } }] }
    /*CATALOG-END*/
  ];
})(typeof window !== 'undefined' ? window : globalThis);

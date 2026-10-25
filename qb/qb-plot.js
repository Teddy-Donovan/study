/* qb-plot.js — small SVG plots for the question bank (global `QB.plot`)
 * =============================================================================
 * Every function returns an '<svg ...>' string: white background, black ink, clear
 * axes with ticks. Labels use the same TeX-lite markup as QB.sch (x_a(t), \omega, ...).
 * Load after qb-core.js and qb-sch.js (uses the schematic text renderer).
 *
 * Common opts (all plots): width, height (px of the viewBox; svg is scaled 1.25 like
 *   schematics unless opts.scale), title, xlabel, ylabel, xmin, xmax, ymin, ymax,
 *   xticks: [values] | n (count hint), yticks, xtickLabels / ytickLabels: {value: markup} or fn(v),
 *   xpi: true (x ticks as multiples of π), grid: true (light grid), legend: true|'tr'|'tl'|'br'|'bl'.
 *
 * QB.plot.stem(ns, vals, opts)      discrete sequence. opts.values:true (print values), opts.n0:true
 *   (arrow at n = 0), opts.stems2: {ns, vals, dash, label} (second sequence, hollow markers)
 * QB.plot.curves([{x:[], y:[], label, colour, dash, width, fn, from, to, n}], opts)
 *   series given as arrays, or fn(x) sampled n times on [from, to]. opts.hlines/vlines:
 *   [{y|x, label, dash}], opts.points: [{x, y, label, hollow}], opts.logx, opts.fill:{i, y0} (shade under series i)
 * QB.plot.phasors([{re, im, label, colour, dash, from:[re, im]}], opts)  arrows from the origin
 *   (or from `from` for head-to-tail). opts.arcs: [{a: index|deg, b: index|deg, label}], opts.axes:true
 * QB.plot.poleZero({poles, zeros, roc:{rin, rout}}, opts)  poles/zeros as [re, im] or {re, im};
 *   duplicates show a multiplicity label. ROC shading: rin..rout (rout Infinity = outside).
 *   opts.R (plot radius), opts.labels:true (annotate coordinates)
 * QB.plot.loadLine({kind:'output'|'transfer', ...})
 *   output: vmax (V_CC, x-intercept), imax (y-intercept), q:{v, i, label}, curves:[{i, label}] (device curves,
 *     flat with a knee), ac:{vmax, imax} (ac load line), iunit:'mA' (display scale), xlabel, ylabel
 *   transfer (JFET/D-MOSFET): IDSS, VP, RS (self-bias line), VG (divider: V_G − I_D R_S), q:true|{v,i}, iunit
 * QB.plot.torqueSpeed({V, R1, X1, X2, R2 | curves:[{R2, label}], ns, poles, f, range:'motor'|'full',
 *   load:{tau, type:'const'|'fan'}, mark:{tmax, start, op}, data:[{n:[], tau:[], label}]})
 *   τ = 3 V² (R2/s) / (ω_s [(R1 + R2/s)² + (X1 + X2)²]) on the simplified circuit (V = phase voltage).
 * QB.plot.catalog  samples rendered by tests/gallery.html.
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB = G.QB || {};
  var S = QB.sch;
  var P = QB.plot = {};
  var INK = '#111', GRID = '#dcdcdc', FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
  var PAL = ['#111111', '#1f5fa8', '#b2401c', '#2b7552', '#7a4fa0'];
  var DASH = [null, '6 4', '2 3', '8 3 2 3'];
  function r2(x) { return Math.round(x * 100) / 100; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------------------------------------------------------- text */
  function runs(m, it) { return S._parse(m, it !== false); }
  function tw(m, fs, it) { var w = 0; (S._parse(m, it !== false)).forEach(function (r) { var f = r.lvl ? fs * 0.73 : fs; for (var k = 0; k < r.t.length; k++) w += (S._width(r.t[k], f) || f * 0.55); }); return w; }
  /** text at (x,y) where y is the visual middle; anchor start|middle|end */
  function txt(m, x, y, anchor, fs, it, extra) {
    fs = fs || 12;
    var w = S.markupWidth ? measure(m, fs, it) : 0;
    var x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    var s = S._textSVG([runs(m, it)], x0, y + fs * 0.36, 'start', fs);
    if (extra) s = s.replace('<text ', '<text ' + extra + ' ');
    return s.replace(/<text /g, '<text fill="' + INK + '" stroke="none" ');
  }
  function measure(m, fs, it) {
    var rr = runs(m, it), w = 0;
    rr.forEach(function (r) { var f = r.lvl ? fs * 0.73 : fs; w += S._width(r.t, f) * (it === false ? 1 : 1); });
    return w;
  }

  /* ---------------------------------------------------------- ticks */
  function niceStep(span, n) {
    var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function ticks(a, b, n) {
    if (!(b > a)) return [a];
    var st = niceStep(b - a, n || 5), out = [];
    for (var v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : parseFloat(v.toPrecision(10)));
    return out;
  }
  function fmtTick(v) {
    if (v === 0) return '0';
    var a = Math.abs(v);
    var s = (a >= 1e4 || a < 1e-3) ? QB.fmt.num(v, 3) : String(parseFloat(v.toPrecision(6)));
    return s.replace(/^-/, '−');
  }
  function piLabel(v) {
    var k = v / Math.PI;
    if (Math.abs(k) < 1e-9) return '0';
    var fr = [[1, 1], [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8]];
    var sg = k < 0 ? '−' : '', ak = Math.abs(k);
    for (var i = 0; i < 40; i++) { if (Math.abs(ak - i) < 1e-6) return sg + (i === 1 ? 'π' : i + 'π'); }
    for (var j = 0; j < fr.length; j++) {
      for (var w = 0; w < 4; w++) { var val = w + fr[j][0] / fr[j][1]; if (Math.abs(ak - val) < 1e-6) { var num = w * fr[j][1] + fr[j][0]; return sg + (num === 1 ? '' : num) + 'π/' + fr[j][1]; } }
    }
    return sg + QB.fmt.num(ak, 3) + 'π';
  }
  function piTicks(a, b) {
    var span = (b - a) / Math.PI, step = span > 6 ? Math.PI : span > 2.5 ? Math.PI / 2 : span > 1.2 ? Math.PI / 4 : Math.PI / 8;
    var out = []; for (var v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(v);
    return out;
  }

  /* ---------------------------------------------------------- frame */
  /**
   * Axes object. o: width, height, xmin..ymax, margins auto. Draws axes through zero when zero is inside
   * the range (textbook style) or on the box edge otherwise (opts.box:true forces a frame).
   */
  function Frame(o) {
    this.o = o;
    this.W = o.width || 440; this.H = o.height || 240;
    this.ml = o.ml != null ? o.ml : 52; this.mr = o.mr != null ? o.mr : 18; this.mt = o.mt != null ? o.mt : (o.title ? 28 : 14); this.mb = o.mb != null ? o.mb : 40;
    this.x0 = o.xmin; this.x1 = o.xmax; this.y0 = o.ymin; this.y1 = o.ymax;
    if (this.x1 === this.x0) { this.x1 += 1; this.x0 -= 1; }
    if (this.y1 === this.y0) { this.y1 += 1; this.y0 -= 1; }
    this.logx = !!o.logx;
    this.items = [];
    this.top = [];
  }
  Frame.prototype.X = function (x) { var a = this.x0, b = this.x1; if (this.logx) { x = Math.log10(x); a = Math.log10(a); b = Math.log10(b); } return this.ml + (x - a) / (b - a) * (this.W - this.ml - this.mr); };
  Frame.prototype.Y = function (y) { return this.mt + (this.y1 - y) / (this.y1 - this.y0) * (this.H - this.mt - this.mb); };
  Frame.prototype.axes = function () {
    var o = this.o, self = this, it = this.items;
    var L = this.ml, R = this.W - this.mr, T = this.mt, B = this.H - this.mb;
    var xt = Array.isArray(o.xticks) ? o.xticks : (o.xpi ? piTicks(this.x0, this.x1) : (this.logx ? logTicks(this.x0, this.x1) : ticks(this.x0, this.x1, typeof o.xticks === 'number' ? o.xticks : 6)));
    var yt = Array.isArray(o.yticks) ? o.yticks : ticks(this.y0, this.y1, typeof o.yticks === 'number' ? o.yticks : 5);
    var ax = (this.y0 <= 0 && this.y1 >= 0 && !o.box) ? this.Y(0) : B;
    var ay = (this.x0 <= 0 && this.x1 >= 0 && !o.box && !this.logx && !o.yAxisLeft) ? this.X(0) : L;
    if (o.grid !== false) {
      xt.forEach(function (v) { var x = self.X(v); it.push('<path d="M' + r2(x) + ',' + T + 'V' + B + '" stroke="' + GRID + '" stroke-width="0.8"/>'); });
      yt.forEach(function (v) { var y = self.Y(v); it.push('<path d="M' + L + ',' + r2(y) + 'H' + R + '" stroke="' + GRID + '" stroke-width="0.8"/>'); });
    }
    if (o.box) it.push('<rect x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="' + (B - T) + '" fill="none" stroke="' + INK + '" stroke-width="1"/>');
    // axes lines with arrowheads
    it.push('<path d="M' + L + ',' + r2(ax) + 'H' + (R + 6) + '" stroke="' + INK + '" stroke-width="1.3"/>');
    it.push('<path d="M' + r2(ay) + ',' + B + 'V' + (T - 6) + '" stroke="' + INK + '" stroke-width="1.3"/>');
    it.push(arrowHead(R + 10, ax, 1, 0)); it.push(arrowHead(ay, T - 10, 0, -1));
    var xl = o.xtickLabels, yl = o.ytickLabels;
    var below = (ax > B - 1 || o.xlabBottom) ? B : ax;
    xt.forEach(function (v) {
      var x = self.X(v);
      it.push('<path d="M' + r2(x) + ',' + r2(ax - 3) + 'V' + r2(ax + 3) + '" stroke="' + INK + '" stroke-width="1"/>');
      var lab = typeof xl === 'function' ? xl(v) : (xl && xl[v] != null ? xl[v] : (o.xpi ? piLabel(v) : fmtTick(v)));
      if (lab === '' || lab == null) return;
      if (Math.abs(x - ay) < 2 && ay > L + 1 && v === 0 && below !== B) { it.push(txt('0', x - 4, below + 12, 'end', 11, false)); return; }
      it.push(txt(lab, x, below + 13, 'middle', 11, false));
    });
    yt.forEach(function (v) {
      var y = self.Y(v);
      if (Math.abs(v) < 1e-12 && ay > L + 1 && ax < B - 1) return;
      it.push('<path d="M' + r2(ay - 3) + ',' + r2(y) + 'H' + r2(ay + 3) + '" stroke="' + INK + '" stroke-width="1"/>');
      var lab = typeof yl === 'function' ? yl(v) : (yl && yl[v] != null ? yl[v] : fmtTick(v));
      if (lab === '' || lab == null) return;
      it.push(txt(lab, (ay > L + 1 ? ay : L) - 6, y, 'end', 11, false));
    });
    if (o.xlabel) it.push(txt(o.xlabel, R + 4, below + (below === B ? 30 : 28), 'end', 12));
    if (o.ylabel) it.push(txt(o.ylabel, (ay > L + 1 ? ay : L) + 8, T - 4, 'start', 12));
    if (o.title) it.push(txt(o.title, this.W / 2, 13, 'middle', 13, false, 'font-weight="bold"'));
    this.ax = ax; this.ay = ay;
  };
  function logTicks(a, b) { var out = []; for (var e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { var v = Math.pow(10, e); if (v >= a * 0.999 && v <= b * 1.001) out.push(v); } return out; }
  function arrowHead(x, y, ux, uy, L, W, col) {
    L = L || 8; W = W || 3.2;
    var bx = x - ux * L, by = y - uy * L, nx = -uy, ny = ux;
    return '<path d="M' + r2(x) + ',' + r2(y) + 'L' + r2(bx + nx * W) + ',' + r2(by + ny * W) + 'L' + r2(bx - nx * W) + ',' + r2(by - ny * W) + 'Z" fill="' + (col || INK) + '" stroke="none"/>';
  }
  Frame.prototype.svg = function () {
    var o = this.o, sc = o.scale || 1.25;
    var vb = '0 0 ' + this.W + ' ' + this.H;
    return '<svg xmlns="http://www.w3.org/2000/svg" class="qb-plot" viewBox="' + vb + '" width="' + Math.round(this.W * sc) + '" height="' + Math.round(this.H * sc) + '" role="img"' + (o.title ? ' aria-label="' + esc(o.title) + '"' : '') + ' font-family="' + FONT.replace(/"/g, '&quot;') + '">' +
      '<rect x="0" y="0" width="' + this.W + '" height="' + this.H + '" fill="#fff"/>' +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' + this.items.join('') + this.top.join('') + '</g></svg>';
  };
  Frame.prototype.polyline = function (xs, ys, col, dash, w) {
    var d = '', pen = false, self = this;
    for (var i = 0; i < xs.length; i++) {
      var y = ys[i];
      if (y == null || !isFinite(y)) { pen = false; continue; }
      var X = this.X(xs[i]), Y = this.Y(Math.max(this.y0 - (this.y1 - this.y0), Math.min(this.y1 + (this.y1 - this.y0), y)));
      d += (pen ? 'L' : 'M') + r2(X) + ',' + r2(Y); pen = true;
    }
    this.items.push('<path d="' + d + '" stroke="' + (col || INK) + '" stroke-width="' + (w || 1.8) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' clip-path="url(#' + this.clipId() + ')"/>');
  };
  Frame.prototype.clipId = function () {
    if (!this._clip) {
      this._clip = 'qbpc' + (P._uid = (P._uid || 0) + 1);
      this.items.unshift('<defs><clipPath id="' + this._clip + '"><rect x="' + this.ml + '" y="' + (this.mt - 2) + '" width="' + (this.W - this.ml - this.mr + 2) + '" height="' + (this.H - this.mt - this.mb + 4) + '"/></clipPath></defs>');
    }
    return this._clip;
  };
  Frame.prototype.legend = function (entries, pos) {
    if (!entries.length) return;
    var fs = 11.5, lh = 16, w = 0;
    entries.forEach(function (e) { w = Math.max(w, measure(e.label, fs)); });
    var bw = w + 38, bh = entries.length * lh + 8;
    pos = typeof pos === 'string' ? pos : 'tr';
    var x = pos[1] === 'l' ? this.ml + 8 : this.W - this.mr - bw - 4, y = pos[0] === 'b' ? this.H - this.mb - bh - 6 : this.mt + 4;
    var t = this.top;
    t.push('<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(bw) + '" height="' + bh + '" fill="#fff" fill-opacity="0.92" stroke="#bbb" stroke-width="0.8" rx="3"/>');
    entries.forEach(function (e, i) {
      var yy = y + 4 + lh / 2 + i * lh;
      if (e.marker) t.push('<circle cx="' + r2(x + 16) + '" cy="' + r2(yy) + '" r="3.2" fill="' + (e.hollow ? '#fff' : e.colour) + '" stroke="' + e.colour + '" stroke-width="1.4"/>');
      else t.push('<path d="M' + r2(x + 6) + ',' + r2(yy) + 'H' + r2(x + 28) + '" stroke="' + e.colour + '" stroke-width="2"' + (e.dash ? ' stroke-dasharray="' + e.dash + '"' : '') + '/>');
      t.push(txt(e.label, x + 33, yy, 'start', fs));
    });
  };
  function range(vals, pad, inc0) {
    var lo = Infinity, hi = -Infinity;
    vals.forEach(function (v) { if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (inc0) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    var sp = hi - lo || Math.abs(hi) || 1;
    return [lo - sp * (pad || 0), hi + sp * (pad || 0)];
  }

  /* ---------------------------------------------------------- stem */
  P.stem = function (ns, vals, o) {
    o = Object.assign({}, o || {});
    ns = ns || []; vals = vals || [];
    var all = vals.slice(); if (o.stems2) all = all.concat(o.stems2.vals);
    var yr = range(all, 0.12, true);
    var nAll = ns.concat(o.stems2 ? o.stems2.ns : []);
    var nr = range(nAll, 0, false);
    if (o.xmin == null) o.xmin = nr[0] - 1; if (o.xmax == null) o.xmax = nr[1] + 1;
    if (o.ymin == null) o.ymin = yr[0]; if (o.ymax == null) o.ymax = yr[1] + (o.values ? (yr[1] - yr[0]) * 0.08 : 0);
    if (o.xticks == null) { var span = o.xmax - o.xmin; o.xticks = []; var st = span > 40 ? 10 : span > 20 ? 5 : span > 12 ? 2 : 1; for (var n = Math.ceil(o.xmin / st) * st; n <= o.xmax; n += st) o.xticks.push(n); }
    o.xlabel = o.xlabel == null ? 'n' : o.xlabel;
    if (o.yAxisLeft == null) o.yAxisLeft = true;
    if (o.xlabBottom == null) o.xlabBottom = true;
    o.width = o.width || Math.max(300, Math.min(560, 60 + (o.xmax - o.xmin) * 26));
    o.height = o.height || 210;
    var F = new Frame(o); F.axes();
    function draw(ns, vs, col, hollow, dash, dx) {
      ns.forEach(function (n, i) {
        var v = vs[i]; if (v == null || !isFinite(v)) return;
        var x = F.X(n) + (dx || 0), y0 = F.Y(0), y = F.Y(v);
        F.items.push('<path d="M' + r2(x) + ',' + r2(y0) + 'V' + r2(y) + '" stroke="' + col + '" stroke-width="1.7"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>');
        F.top.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="3.6" fill="' + (hollow ? '#fff' : col) + '" stroke="' + col + '" stroke-width="1.5"/>');
        if (o.values && vs === vals) { var lab = typeof o.values === 'function' ? o.values(v, n) : QB.fmt.num(v, 3); F.top.push(txt(lab, x, v >= 0 ? y - 10 : y + 11, 'middle', 10.5, false)); }
      });
    }
    draw(ns, vals, o.colour || INK, false);
    if (o.stems2) draw(o.stems2.ns, o.stems2.vals, o.stems2.colour || PAL[2], true, o.stems2.dash, o.stems2.offset || 0);
    if (o.n0) { var x0 = F.X(0); F.top.push(arrowHead(x0, F.H - F.mb + 26, 0, -1, 6, 2.6)); F.top.push('<path d="M' + r2(x0) + ',' + (F.H - F.mb + 26) + 'V' + (F.H - F.mb + 34) + '" stroke="' + INK + '" stroke-width="1.2"/>'); }
    if (o.legend && o.stems2) F.legend([{ label: o.label || (o.ylabel || 'x(n)'), colour: o.colour || INK, marker: true }, { label: o.stems2.label || '', colour: o.stems2.colour || PAL[2], marker: true, hollow: true }], o.legend);
    return F.svg();
  };

  /* ---------------------------------------------------------- curves */
  function sample(s) {
    if (s.fn) { var n = s.n || 300, a = s.from, b = s.to, xs = [], ys = []; for (var i = 0; i <= n; i++) { var x = a + (b - a) * i / n; xs.push(x); var y; try { y = s.fn(x); } catch (e) { y = NaN; } ys.push(y); } return { x: xs, y: ys }; }
    return { x: s.x || [], y: s.y || [] };
  }
  P.curves = function (series, o) {
    o = Object.assign({}, o || {});
    series = (series || []).map(function (s) { var d = sample(s); return Object.assign({}, s, d); });
    var xs = [], ys = [];
    series.forEach(function (s) { xs = xs.concat(s.x); ys = ys.concat(s.y); });
    (o.points || []).forEach(function (p) { xs.push(p.x); ys.push(p.y); });
    (o.hlines || []).forEach(function (h) { ys.push(h.y); });
    (o.vlines || []).forEach(function (h) { xs.push(h.x); });
    var xr = range(xs, 0, false), yr = range(ys, 0.08, o.zero !== false);
    if (o.xmin == null) o.xmin = xr[0]; if (o.xmax == null) o.xmax = xr[1];
    if (o.ymin == null) o.ymin = yr[0]; if (o.ymax == null) o.ymax = yr[1];
    var F = new Frame(o); F.axes();
    var leg = [];
    series.forEach(function (s, i) {
      var col = s.colour || PAL[i % PAL.length], dash = s.dash === undefined ? (o.mono ? DASH[i % DASH.length] : null) : s.dash;
      if (o.fill && o.fill.i === i) {
        var y0 = o.fill.y0 || 0, d = 'M' + r2(F.X(s.x[0])) + ',' + r2(F.Y(y0));
        s.x.forEach(function (x, k) { if (isFinite(s.y[k])) d += 'L' + r2(F.X(x)) + ',' + r2(F.Y(Math.min(F.y1, Math.max(F.y0, s.y[k])))); });
        d += 'L' + r2(F.X(s.x[s.x.length - 1])) + ',' + r2(F.Y(y0)) + 'Z';
        F.items.push('<path d="' + d + '" fill="' + col + '" fill-opacity="0.12" stroke="none"/>');
      }
      F.polyline(s.x, s.y, col, dash, s.width);
      if (s.label) {
        if (o.legend) leg.push({ label: s.label, colour: col, dash: dash });
        else if (s.labelAt != null) {
          // inline label at a given x
          var k = 0, best = Infinity; s.x.forEach(function (x, j) { var dd = Math.abs(x - s.labelAt); if (dd < best) { best = dd; k = j; } });
          F.top.push(txt(s.label, F.X(s.x[k]) + 4, F.Y(s.y[k]) - 9, 'start', 11.5));
        }
      }
    });
    (o.hlines || []).forEach(function (h) { var y = F.Y(h.y); F.items.push('<path d="M' + F.ml + ',' + r2(y) + 'H' + (F.W - F.mr) + '" stroke="' + (h.colour || '#555') + '" stroke-width="1.1" stroke-dasharray="' + (h.dash || '5 4') + '"/>'); if (h.label) F.top.push(txt(h.label, F.W - F.mr - 2, y - 8, 'end', 11)); });
    (o.vlines || []).forEach(function (h) { var x = F.X(h.x); F.items.push('<path d="M' + r2(x) + ',' + F.mt + 'V' + (F.H - F.mb) + '" stroke="' + (h.colour || '#555') + '" stroke-width="1.1" stroke-dasharray="' + (h.dash || '5 4') + '"/>'); if (h.label) F.top.push(txt(h.label, x + 4, F.mt + 8, 'start', 11)); });
    (o.points || []).forEach(function (p) {
      var x = F.X(p.x), y = F.Y(p.y);
      F.top.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="3.6" fill="' + (p.hollow ? '#fff' : (p.colour || INK)) + '" stroke="' + (p.colour || INK) + '" stroke-width="1.5"/>');
      if (p.label) F.top.push(txt(p.label, x + (p.anchor === 'end' ? -7 : 7), y - 9, p.anchor || 'start', 11.5));
    });
    if (o.legend && leg.length) F.legend(leg, o.legend);
    return F.svg();
  };

  /* ---------------------------------------------------------- phasors */
  P.phasors = function (list, o) {
    o = Object.assign({}, o || {});
    list = list || [];
    var pts = [[0, 0]];
    list.forEach(function (p) { var f = p.from || [0, 0]; pts.push(f, [f[0] + p.re, f[1] + p.im]); });
    var mx = 0; pts.forEach(function (p) { mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1])); });
    mx = mx || 1;
    var xr = range(pts.map(function (p) { return p[0]; }), 0.18, true), yr = range(pts.map(function (p) { return p[1]; }), 0.18, true);
    var size = o.size || 300;
    var sx = xr[1] - xr[0], sy = yr[1] - yr[0];
    var W = o.width || (sx >= sy ? size : Math.max(180, size * sx / sy)), H = o.height || (sx >= sy ? Math.max(170, size * sy / sx) : size);
    var F = new Frame(Object.assign({ grid: false, xticks: [], yticks: [], ml: 22, mr: 26, mt: 20, mb: 22 }, o, { width: W + 48, height: H + 42 }));
    // equal scaling
    var pw = F.W - F.ml - F.mr, ph = F.H - F.mt - F.mb, k = Math.min(pw / sx, ph / sy);
    var cx = (xr[0] + xr[1]) / 2, cy = (yr[0] + yr[1]) / 2;
    F.x0 = cx - pw / k / 2; F.x1 = cx + pw / k / 2; F.y0 = cy - ph / k / 2; F.y1 = cy + ph / k / 2;
    var X0 = F.X(0), Y0 = F.Y(0);
    F.items.push('<path d="M' + F.ml + ',' + r2(Y0) + 'H' + (F.W - F.mr) + 'M' + r2(X0) + ',' + (F.H - F.mb) + 'V' + F.mt + '" stroke="#888" stroke-width="1"/>');
    F.items.push(arrowHead(F.W - F.mr + 4, Y0, 1, 0, 7, 2.8, '#888')); F.items.push(arrowHead(X0, F.mt - 4, 0, -1, 7, 2.8, '#888'));
    F.items.push(txt(o.xlabel || 'Re', F.W - F.mr + 4, Y0 + 12, 'end', 11, false)); F.items.push(txt(o.ylabel || 'Im', X0 + 6, F.mt - 2, 'start', 11, false));
    list.forEach(function (p, i) {
      var f = p.from || [0, 0], col = p.colour || PAL[i % PAL.length];
      var a = [F.X(f[0]), F.Y(f[1])], b = [F.X(f[0] + p.re), F.Y(f[1] + p.im)];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 1) return;
      var ux = dx / L, uy = dy / L;
      F.items.push('<path d="M' + r2(a[0]) + ',' + r2(a[1]) + 'L' + r2(b[0] - ux * 6) + ',' + r2(b[1] - uy * 6) + '" stroke="' + col + '" stroke-width="2"' + (p.dash ? ' stroke-dasharray="' + p.dash + '"' : '') + '/>');
      F.items.push(arrowHead(b[0], b[1], ux, uy, 10, 4, col));
      if (p.label) {
        var lx = b[0] + ux * 8, ly = b[1] + uy * 8;
        var an = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle';
        if (Math.abs(uy) < 0.25) { lx = b[0] - ux * 4; ly = b[1] - 13; an = 'middle'; }
        if (p.labelPos === 'mid') { lx = (a[0] + b[0]) / 2 - uy * 10; ly = (a[1] + b[1]) / 2 + ux * 10; an = -uy > 0.3 ? 'start' : -uy < -0.3 ? 'end' : 'middle'; }
        F.top.push(txt(p.label, lx, ly + (Math.abs(ux) <= 0.35 ? uy * 6 : 0), an, 12));
      }
    });
    (o.arcs || []).forEach(function (ar) {
      function ang(v) { return typeof v === 'number' && Number.isInteger(v) && list[v] && ar.byIndex !== false && v < list.length ? Math.atan2(list[v].im, list[v].re) : (v || 0) * Math.PI / 180; }
      var a1 = ang(ar.a), a2 = ang(ar.b), r = (ar.r || 0.22) * Math.min(pw, ph) / 2;
      var p1 = [X0 + r * Math.cos(a1), Y0 - r * Math.sin(a1)], p2 = [X0 + r * Math.cos(a2), Y0 - r * Math.sin(a2)];
      var sweep = a2 > a1 ? 0 : 1, large = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
      F.items.push('<path d="M' + r2(p1[0]) + ',' + r2(p1[1]) + 'A' + r2(r) + ',' + r2(r) + ' 0 ' + large + ' ' + sweep + ' ' + r2(p2[0]) + ',' + r2(p2[1]) + '" stroke="' + INK + '" stroke-width="1.1"/>');
      var am = (a1 + a2) / 2, rl = r + 12;
      if (ar.label) F.top.push(txt(ar.label, X0 + rl * Math.cos(am), Y0 - rl * Math.sin(am), Math.cos(am) > 0.3 ? 'start' : Math.cos(am) < -0.3 ? 'end' : 'middle', 12));
    });
    return F.svg();
  };

  /* ---------------------------------------------------------- pole-zero */
  function pz(p) { return Array.isArray(p) ? { re: +p[0], im: +(p[1] || 0) } : typeof p === 'number' ? { re: p, im: 0 } : { re: +p.re, im: +(p.im || 0) }; }
  function groupMult(list) {
    var out = [];
    list.map(pz).forEach(function (p) {
      var g = null; out.forEach(function (q) { if (Math.hypot(q.re - p.re, q.im - p.im) < 1e-6) g = q; });
      if (g) g.m++; else out.push({ re: p.re, im: p.im, m: 1 });
    });
    return out;
  }
  P.poleZero = function (spec, o) {
    spec = spec || {}; o = Object.assign({}, o || {});
    var poles = groupMult(spec.poles || []), zeros = groupMult(spec.zeros || []);
    var mx = 1;
    poles.concat(zeros).forEach(function (p) { mx = Math.max(mx, Math.abs(p.re), Math.abs(p.im)); });
    var roc = spec.roc;
    if (roc) { if (isFinite(roc.rout) && roc.rout) mx = Math.max(mx, roc.rout); if (roc.rin) mx = Math.max(mx, roc.rin); }
    var R = o.R || Math.max(1.3, mx * 1.22);
    var size = o.size || 300;
    var F = new Frame(Object.assign({ grid: false, xticks: [], yticks: [], ml: 26, mr: 34, mt: o.title ? 46 : 24, mb: 26 }, o, { width: size + 60, height: size + 50 + (o.title ? 22 : 0), xmin: -R, xmax: R, ymin: -R, ymax: R }));
    var X0 = F.X(0), Y0 = F.Y(0), k = (F.X(1) - X0), kY = (Y0 - F.Y(1));
    var rr = Math.min(k, kY);
    // equalise
    F.Y = function (y) { return Y0 - y * rr; }; F.X = function (x) { return X0 + x * rr; };
    var L = F.ml, Rt = F.W - F.mr, T = F.mt, B = F.H - F.mb;
    if (roc) {
      var rin = roc.rin || 0, rout = roc.rout == null ? Infinity : roc.rout;
      var big = 2 * (Rt - L);
      var ro = isFinite(rout) ? rout * rr : big, ri = rin * rr;
      var clip = 'qbpz' + (P._uid = (P._uid || 0) + 1);
      F.items.push('<defs><clipPath id="' + clip + '"><rect x="' + L + '" y="' + T + '" width="' + (Rt - L) + '" height="' + (B - T) + '"/></clipPath>' +
        '<pattern id="' + clip + 'h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0V7" stroke="#8aa9d0" stroke-width="2"/></pattern></defs>');
      var dd = 'M' + r2(X0 + ro) + ',' + r2(Y0) + 'A' + r2(ro) + ',' + r2(ro) + ' 0 1 0 ' + r2(X0 - ro) + ',' + r2(Y0) + 'A' + r2(ro) + ',' + r2(ro) + ' 0 1 0 ' + r2(X0 + ro) + ',' + r2(Y0) + 'Z';
      if (ri > 0) dd += 'M' + r2(X0 + ri) + ',' + r2(Y0) + 'A' + r2(ri) + ',' + r2(ri) + ' 0 1 1 ' + r2(X0 - ri) + ',' + r2(Y0) + 'A' + r2(ri) + ',' + r2(ri) + ' 0 1 1 ' + r2(X0 + ri) + ',' + r2(Y0) + 'Z';
      F.items.push('<path d="' + dd + '" fill="#dbe7f5" fill-rule="evenodd" stroke="none" clip-path="url(#' + clip + ')"/>');
      F.items.push('<path d="' + dd + '" fill="url(#' + clip + 'h)" fill-opacity="0.55" fill-rule="evenodd" stroke="none" clip-path="url(#' + clip + ')"/>');
      if (ri > 0) F.items.push('<circle cx="' + r2(X0) + '" cy="' + r2(Y0) + '" r="' + r2(ri) + '" stroke="#3d6fae" stroke-width="1.2" stroke-dasharray="4 3"/>');
      if (isFinite(rout)) F.items.push('<circle cx="' + r2(X0) + '" cy="' + r2(Y0) + '" r="' + r2(ro) + '" stroke="#3d6fae" stroke-width="1.2" stroke-dasharray="4 3"/>');
      if (o.rocLabel !== false) F.top.push(txt(o.rocLabel || 'ROC', Rt - 4, T + 10, 'end', 11.5, false));
    }
    // axes
    F.items.push('<path d="M' + L + ',' + r2(Y0) + 'H' + (Rt + 4) + 'M' + r2(X0) + ',' + B + 'V' + (T - 4) + '" stroke="' + INK + '" stroke-width="1.2"/>');
    F.items.push(arrowHead(Rt + 8, Y0, 1, 0, 7, 2.8)); F.items.push(arrowHead(X0, T - 8, 0, -1, 7, 2.8));
    F.top.push(txt(o.xlabel || 'Re(z)', Rt + 6, Y0 + 14, 'end', 11.5, false)); F.top.push(txt(o.ylabel || 'Im(z)', X0 + 6, T - 6, 'start', 11.5, false));
    // unit circle
    if (o.unitCircle !== false) {
      F.items.push('<circle cx="' + r2(X0) + '" cy="' + r2(Y0) + '" r="' + r2(rr) + '" stroke="' + INK + '" stroke-width="1.2" stroke-dasharray="5 3"/>');
      F.items.push('<path d="M' + r2(X0 + rr) + ',' + r2(Y0 - 3) + 'V' + r2(Y0 + 3) + 'M' + r2(X0 - rr) + ',' + r2(Y0 - 3) + 'V' + r2(Y0 + 3) + 'M' + r2(X0 - 3) + ',' + r2(Y0 - rr) + 'H' + r2(X0 + 3) + 'M' + r2(X0 - 3) + ',' + r2(Y0 + rr) + 'H' + r2(X0 + 3) + '" stroke="' + INK + '" stroke-width="1"/>');
      F.top.push(txt('1', X0 + rr + 3, Y0 + 11, 'start', 10.5, false)); F.top.push(txt('j', X0 + 5, Y0 - rr - 7, 'start', 10.5));
      F.top.push(txt('−1', X0 - rr - 3, Y0 + 11, 'end', 10.5, false));
    }
    var col = o.colour || INK;
    function mlabel(p, x, y) {
      var lab = '';
      if (p.m > 1) lab = '(' + p.m + ')';
      if (o.labels) lab += (lab ? ' ' : '') + QB.fmt.cx(p.re, p.im, 3);
      if (lab) F.top.push(txt(lab, x + 8, y - 9, 'start', 11, false));
    }
    zeros.forEach(function (p) { var x = F.X(p.re), y = F.Y(p.im); F.top.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="5" fill="#fff" stroke="' + col + '" stroke-width="1.8"/>'); mlabel(p, x, y); });
    poles.forEach(function (p) { var x = F.X(p.re), y = F.Y(p.im), s = 5; F.top.push('<path d="M' + r2(x - s) + ',' + r2(y - s) + 'L' + r2(x + s) + ',' + r2(y + s) + 'M' + r2(x - s) + ',' + r2(y + s) + 'L' + r2(x + s) + ',' + r2(y - s) + '" stroke="' + col + '" stroke-width="2"/>'); mlabel(p, x, y); });
    if (o.title) F.top.push(txt(o.title, F.W / 2, 13, 'middle', 13, false, 'font-weight="bold"'));
    return F.svg();
  };

  /* ---------------------------------------------------------- load line */
  P.loadLine = function (spec, o) {
    spec = spec || {}; o = Object.assign({}, spec.opts || {}, o || {});
    var ius = { A: 1, mA: 1e3, 'µA': 1e6 }[spec.iunit || 'mA'] || 1e3;
    var iu = spec.iunit || 'mA';
    if (spec.kind === 'transfer') {
      var IDSS = spec.IDSS, VP = spec.VP, RS = spec.RS, VG = spec.VG || 0;
      var vmin = Math.min(VP, 0), vmax = Math.max(0, VG > 0 ? VG * 1.05 : 0, spec.vmax || 0);
      var series = [{ fn: function (v) { if ((VP < 0 && v < VP) || (VP > 0 && v > VP)) return NaN; return IDSS * Math.pow(1 - v / VP, 2) * ius; }, from: vmin, to: vmax > 0 && spec.dmos ? vmax : Math.max(vmax, 0) || 0, n: 200, label: 'I_D = I_{DSS}(1 − V_{GS}/V_P)²' }];
      if (!spec.dmos && VP < 0) series[0].to = 0;
      if (RS) series.push({ fn: function (v) { return (VG - v) / RS * ius; }, from: vmin, to: Math.max(vmax, VG), n: 2, colour: PAL[1], dash: '6 4', label: VG ? 'V_{GS} = V_G − I_D R_S' : 'V_{GS} = −I_D R_S' });
      var pts = [];
      var q = spec.q;
      if (q === true && RS) {
        // solve IDSS(1-v/VP)^2 = (VG - v)/RS for v in [VP, ...]
        var f = function (v) { return IDSS * Math.pow(1 - v / VP, 2) - (VG - v) / RS; };
        var a = VP, b = Math.max(0, Math.min(VG, spec.dmos ? vmax : 0)) || 0; if (VG > 0) b = Math.min(VG, spec.dmos ? vmax : 0);
        var lo = Math.min(a, b), hi = Math.max(a, b);
        for (var k = 0; k < 80; k++) { var m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
        q = { v: (lo + hi) / 2, i: IDSS * Math.pow(1 - (lo + hi) / 2 / VP, 2) };
      }
      if (q && typeof q === 'object') pts.push({ x: q.v, y: q.i * ius, label: q.label || 'Q' });
      var oo = Object.assign({ xlabel: 'V_{GS} (V)', ylabel: 'I_D (' + iu + ')', ymin: 0, legend: 'tl', points: pts }, o);
      if (oo.ymax == null) oo.ymax = IDSS * ius * 1.12;
      if (oo.xmin == null) oo.xmin = vmin * 1.05;
      if (oo.xmax == null) oo.xmax = Math.max(VG, 0) * 1.05 + (VG > 0 ? 0 : Math.abs(vmin) * 0.08);
      return P.curves(series, oo);
    }
    var Vm = spec.vmax, Im = spec.imax;
    var ser = [{ x: [0, Vm], y: [Im * ius, 0], colour: INK, width: 2, label: o.legend ? 'dc load line' : null }];
    var pts2 = [];
    (spec.curves || []).forEach(function (c, i) {
      var ic = c.i * ius, knee = c.knee || Vm * 0.04, xs = [], ys = [];
      for (var j = 0; j <= 60; j++) { var v = Vm * 1.05 * j / 60; xs.push(v); ys.push(ic * (1 - Math.exp(-v / knee * 1.8)) * (1 + (c.slope || 0) * v)); }
      ser.push({ x: xs, y: ys, colour: '#666', width: 1.3, label: null, labelAt: Vm * 0.98 });
      pts2.push({ lbl: c.label, x: Vm * 1.05, y: ys[ys.length - 1] });
    });
    if (spec.ac) ser.push({ x: [0, spec.ac.vmax], y: [spec.ac.imax * ius, 0], colour: PAL[2], dash: '6 4', width: 1.8, label: o.legend ? 'ac load line' : null });
    var q2 = spec.q, pts = [];
    if (q2) pts.push({ x: q2.v, y: q2.i * ius, label: q2.label || 'Q' });
    var yMax = Im * ius; (spec.curves || []).forEach(function (c) { yMax = Math.max(yMax, c.i * ius); }); if (spec.ac) yMax = Math.max(yMax, spec.ac.imax * ius);
    var xMax = Math.max(Vm, spec.ac ? spec.ac.vmax : 0);
    var oo2 = Object.assign({ xlabel: spec.xlabel || 'V_{CE} (V)', ylabel: spec.ylabel || 'I_C (' + iu + ')', xmin: 0, ymin: 0, xmax: xMax * 1.1, ymax: yMax * 1.15, points: pts, mr: (spec.curves && spec.curves.length) ? 70 : 18 }, o);
    var svg = P.curves(ser, oo2);
    // curve labels at the right end + intercept labels (drawn by re-rendering with a Frame: simplest is to inject text)
    var F = new Frame(Object.assign({}, oo2)); // same geometry
    var extra = '';
    pts2.forEach(function (p) { if (p.lbl) extra += txt(p.lbl, F.X(p.x) + 4, F.Y(p.y), 'start', 10.5); });
    if (spec.labels !== false) {
      extra += txt(spec.vlabel || QB.fmt.eng(Vm, 'V'), F.X(Vm) + 5, F.Y(0) - 9, 'start', 10.5, false);
      extra += txt(spec.ilabel || QB.fmt.num(Im * ius, 3) + ' ' + iu, F.X(0) + 6, F.Y(Im * ius) - 8, 'start', 10.5, false);
    }
    return svg.replace('</g></svg>', extra + '</g></svg>');
  };

  /* ---------------------------------------------------------- torque-speed */
  P.torqueSpeed = function (spec, o) {
    spec = spec || {}; o = Object.assign({}, o || {});
    var f = spec.f || 50, p = spec.poles || 4;
    var ns = spec.ns || 120 * f / p;           // r/min
    var ws = 2 * Math.PI * ns / 60;
    var full = spec.range === 'full';
    var series = [], pts = [];
    function tau(s, R2) {
      var V = spec.V, R1 = spec.R1 || 0, X = (spec.X1 || 0) + (spec.X2 || 0);
      return 3 * V * V * (R2 / s) / (ws * (Math.pow(R1 + R2 / s, 2) + X * X));
    }
    var cs = spec.curves || (spec.R2 != null ? [{ R2: spec.R2, label: spec.label }] : []);
    var nmin = full ? -0.5 * ns : 0, nmax = full ? 1.6 * ns : ns;
    var all = [];
    cs.forEach(function (c, i) {
      var xs = [], ys = [];
      for (var k = 0; k <= 400; k++) { var n = nmin + (nmax - nmin) * k / 400; var s = (ns - n) / ns; if (Math.abs(s) < 1e-6) s = 1e-6; xs.push(n); ys.push(tau(s, c.R2)); }
      series.push({ x: xs, y: ys, label: c.label || null, colour: c.colour || PAL[i % PAL.length], dash: c.dash, width: 2 });
      all = all.concat(ys);
      var m = spec.mark || {};
      var R1 = spec.R1 || 0, X = (spec.X1 || 0) + (spec.X2 || 0);
      if (m.tmax) {
        var smax = c.R2 / Math.sqrt(R1 * R1 + X * X), nT = ns * (1 - smax);
        if (nT >= nmin) pts.push({ x: nT, y: tau(smax, c.R2), label: cs.length > 1 ? null : 'τ_{max}' });
      }
      if (m.start) pts.push({ x: 0, y: tau(1, c.R2), label: cs.length > 1 ? null : 'τ_{start}', anchor: 'start' });
    });
    (spec.data || []).forEach(function (dd, i) { series.push({ x: dd.n, y: dd.tau, label: dd.label, colour: PAL[(cs.length + i) % PAL.length], width: 2 }); all = all.concat(dd.tau); });
    if (spec.load) {
      var Lt = spec.load.tau, typ = spec.load.type || 'const';
      var lx = [], ly = [];
      for (var k2 = 0; k2 <= 60; k2++) { var n2 = Math.max(0, nmin) + (nmax - Math.max(0, nmin)) * k2 / 60; lx.push(n2); ly.push(typ === 'fan' ? Lt * Math.pow(n2 / ns, 2) : Lt); }
      series.push({ x: lx, y: ly, colour: '#666', dash: '6 4', width: 1.5, label: spec.load.label || (o.legend ? 'load' : null) });
      if (spec.mark && spec.mark.op && cs.length) {
        // intersection on the stable side (s between 0 and smax)
        var c0 = cs[0], R1b = spec.R1 || 0, Xb = (spec.X1 || 0) + (spec.X2 || 0), smx = c0.R2 / Math.sqrt(R1b * R1b + Xb * Xb);
        var g = function (s) { var n = ns * (1 - s); return tau(s, c0.R2) - (typ === 'fan' ? Lt * Math.pow(n / ns, 2) : Lt); };
        var lo = 1e-6, hi = Math.min(1, smx);
        if (g(lo) * g(hi) < 0) { for (var it = 0; it < 80; it++) { var mm = (lo + hi) / 2; if (g(lo) * g(mm) <= 0) hi = mm; else lo = mm; } var so = (lo + hi) / 2; pts.push({ x: ns * (1 - so), y: tau(so, c0.R2), label: 'operating point', anchor: 'end' }); }
      }
    }
    var yr = range(all, 0.1, true);
    var oo = Object.assign({ xlabel: 'n (r/min)', ylabel: 'τ (N·m)', xmin: nmin, xmax: nmax * (full ? 1 : 1.04), ymin: Math.min(0, yr[0]), ymax: yr[1], points: pts, vlines: [{ x: ns, label: 'n_s' }], width: 460, height: 260, legend: cs.length > 1 ? (full ? 'bl' : 'tr') : false }, o);
    return P.curves(series, oo);
  };

  /* ---------------------------------------------------------- catalog */
  P.catalog = [
    { name: 'stem', group: 'Plots', keys: 'stem(ns, vals, {xlabel, ylabel, values, n0, stems2:{ns, vals, label, dash}, legend, ymin, ymax})',
      samples: [{ title: 'Sequence with values', args: [[-2, -1, 0, 1, 2, 3, 4], [0.5, 1, 2, 1.5, 0, -1, 0.25], { ylabel: 'x(n)', values: true, n0: true }] },
        { title: 'Two sequences', args: [[0, 1, 2, 3, 4, 5, 6, 7], [1, 0.8, 0.64, 0.51, 0.41, 0.33, 0.26, 0.21], { ylabel: 'h(n)', stems2: { ns: [0, 1, 2, 3, 4, 5, 6, 7], vals: [1, -0.8, 0.64, -0.51, 0.41, -0.33, 0.26, -0.21], label: 'g(n)' }, legend: 'tr', label: 'h(n)' }] }] },
    { name: 'curves', group: 'Plots', keys: 'curves([{x,y | fn,from,to,n, label, colour, dash, labelAt}], {xlabel, ylabel, xpi, legend, hlines, vlines, points, fill, logx, mono})',
      samples: [{ title: 'Magnitude response (π ticks)', args: [[{ fn: 'mag', from: 0, to: Math.PI, label: '|H(ω)|' }], { xpi: true, xlabel: 'ω', ylabel: '|H(ω)|', hlines: [{ y: 0.707, label: '0.707' }], legend: 'tr' }] },
        { title: 'Two curves, legend, marked point', args: [[{ fn: 'exp', from: 0, to: 5, label: 'v_C(t)' }, { fn: 'expd', from: 0, to: 5, label: 'i(t)', dash: '6 4' }], { xlabel: 't (ms)', ylabel: 'v (V)', legend: 'tr', points: [{ x: 1, y: 6.32, label: 'τ' }] }] }] },
    { name: 'phasors', group: 'Plots', keys: 'phasors([{re, im, label, colour, dash, from:[re,im], labelPos:"mid"}], {arcs:[{a, b, label}], size})',
      samples: [{ title: 'V, I and angle', args: [[{ re: 230, im: 0, label: 'V' }, { re: 120, im: -90, label: 'I' }], { arcs: [{ a: 1, b: 0, label: 'φ' }] }] },
        { title: 'E_0 = V + jX_s I (head to tail)', args: [[{ re: 1, im: 0, label: 'V' }, { re: 0.8, im: -0.6, label: 'I_a', colour: '#b2401c' }, { re: 0.6, im: 0.8, from: [1, 0], label: 'jX_sI_a', dash: '5 3', labelPos: 'mid' }, { re: 1.6, im: 0.8, label: 'E_0', colour: '#1f5fa8' }], { arcs: [{ a: 0, b: 3, label: 'δ' }] }] }] },
    { name: 'poleZero', group: 'Plots', keys: 'poleZero({poles, zeros, roc:{rin, rout}}, {R, labels, rocLabel, size, title})',
      samples: [{ title: 'Causal, |z| > 0.9', args: [{ poles: [[0.9 * Math.cos(Math.PI / 4), 0.9 * Math.sin(Math.PI / 4)], [0.9 * Math.cos(Math.PI / 4), -0.9 * Math.sin(Math.PI / 4)]], zeros: [[-1, 0], [-1, 0]], roc: { rin: 0.9 } }, {}] },
        { title: 'Two-sided ROC 0.5 < |z| < 2', args: [{ poles: [[0.5, 0], [2, 0]], zeros: [[0, 0]], roc: { rin: 0.5, rout: 2 } }, { labels: true }] }] },
    { name: 'loadLine', group: 'Plots', keys: 'loadLine({kind:"output", vmax, imax, q:{v,i}, curves:[{i,label}], ac:{vmax,imax}, iunit}) | ({kind:"transfer", IDSS, VP, RS, VG, q:true})',
      samples: [{ title: 'BJT dc load line with I_B curves', args: [{ vmax: 12, imax: 0.006, q: { v: 6.3, i: 0.003 }, curves: [{ i: 0.001, label: '10 µA' }, { i: 0.002, label: '20 µA' }, { i: 0.003, label: '30 µA' }, { i: 0.004, label: '40 µA' }, { i: 0.005, label: '50 µA' }] }] },
        { title: 'JFET self-bias graphical solution', args: [{ kind: 'transfer', IDSS: 0.008, VP: -4, RS: 1000, q: true }] }] },
    { name: 'torqueSpeed', group: 'Plots', keys: 'torqueSpeed({V, R1, X1, X2, R2 | curves:[{R2,label}], f, poles, ns, range:"motor"|"full", load:{tau, type}, mark:{tmax,start,op}, data})',
      samples: [{ title: 'Motor curve with load and τmax', args: [{ V: 230, R1: 0.3, X1: 0.8, X2: 0.8, R2: 0.25, f: 50, poles: 4, load: { tau: 80 }, mark: { tmax: true, start: true, op: true } }] },
        { title: 'Effect of extra rotor resistance (full range)', args: [{ V: 230, R1: 0.3, X1: 0.8, X2: 0.8, curves: [{ R2: 0.25, label: "R_2' = 0.25 Ω" }, { R2: 0.8, label: "R_2' = 0.8 Ω" }], f: 50, poles: 4, range: 'full' }] }] }
  ];
  // the catalog stores functions by name so it stays JSON-cloneable for tests
  P._fns = {
    mag: function (w) { var a = 0.8; return (1 - a) / Math.sqrt(1 - 2 * a * Math.cos(w) + a * a); },
    exp: function (t) { return 10 * (1 - Math.exp(-t)); },
    expd: function (t) { return 10 * Math.exp(-t); }
  };
  var curves0 = P.curves;
  P.curves = function (series, o) {
    series = (series || []).map(function (s) { if (typeof s.fn === 'string') { var f = P._fns[s.fn]; return Object.assign({}, s, { fn: f }); } return s; });
    return curves0(series, o);
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* bank-dsp-2.js — DSP question bank, part 2 (z-domain L07–L08, filters L09–L10)
 * =============================================================================
 * Modules: dsp.z  (zt, zprop, invz, stab, unilat)
 *          dsp.filt (pzdesign, linphase, inverse, bilinear, butter, cheby, fir)
 * Packs: D7–D12, DX1, DX2. Notation follows the course (ctx_D.md): ω rad/sample
 * for DT, Ω rad/s for CT, sinc x = sin x / x, partial fractions in z^{-1},
 * T = 1 in bilinear designs, Chebyshev order with cosh^{-1}.
 * Each gen also returns Q.meta (raw parameters) for the Python cross-check in
 * tests/check-dsp-2.py. The app ignores it.
 * Figures: QB.plot.poleZero and QB.sch.directFormI/II are used when present and
 * valid; otherwise a local fallback drawn with QB.sch.drawing() is used.
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB;
  if (!QB || !QB.add) return;
  var TX = QB.fmt.tex, PI = Math.PI;
  var C = QB.cx;

  /* ------------------------------------------------------------ number / TeX helpers */
  function nf(x, s) {
    if (typeof x !== 'number' || !isFinite(x)) return 'NaN';
    if (Math.abs(x) < 1e-10) return '0';
    return TX.num(x, s || 4);
  }
  function near(a, b, e) { return Math.abs(a - b) < (e || 1e-9); }
  function cxv(z) { return (z && typeof z === 'object') ? z : C(+z, 0); }
  function isReal(z) { return Math.abs(cxv(z).im) < 1e-9; }
  function cabs(z) { return cxv(z).abs(); }
  /** TeX for a complex number */
  function cf(z, s) {
    z = cxv(z);
    if (Math.abs(z.im) < 1e-9) return nf(z.re, s);
    var re = Math.abs(z.re) < 1e-9 ? '' : nf(z.re, s);
    var im = nf(Math.abs(z.im), s);
    if (im === '1') im = '';
    if (!re) return (z.im < 0 ? '-' : '') + 'j' + im;
    return re + (z.im < 0 ? ' - ' : ' + ') + 'j' + im;
  }
  /** polar TeX r e^{jθ} with θ as a multiple of π when tidy */
  function piT(th) {
    var k = th / PI;
    var fr = [[1, 6], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [5, 6], [1, 1], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [5, 8], [7, 8], [1, 10], [3, 10], [7, 10], [9, 10], [1, 12], [5, 12], [7, 12], [11, 12], [1, 20], [3, 20], [1, 9], [2, 9], [4, 9]];
    var sg = k < 0 ? '-' : ''; var a = Math.abs(k);
    if (a < 1e-12) return '0';
    for (var i = 0; i < fr.length; i++) if (Math.abs(a - fr[i][0] / fr[i][1]) < 1e-9) {
      var p = fr[i][0], q = fr[i][1];
      if (q === 1) return sg + (p === 1 ? '\\pi' : p + '\\pi');
      return sg + '\\frac{' + (p === 1 ? '' : p) + '\\pi}{' + q + '}';
    }
    return nf(th, 4);
  }
  /** z^{-k} power text */
  function zi(k) { if (k === 0) return ''; if (k === 1) return 'z^{-1}'; if (k === -1) return 'z'; if (k < 0) return 'z^{' + (-k) + '}'; return 'z^{-' + k + '}'; }
  function sp(k) { if (k === 0) return ''; if (k === 1) return 's'; return 's^{' + k + '}'; }
  /** polynomial TeX: c[k] multiplies pw(k) (default z^{-k}); k0 = index offset */
  function polyTex(c, pw, k0, s) {
    pw = pw || zi; k0 = k0 || 0;
    var out = '';
    for (var i = 0; i < c.length; i++) {
      var v = c[i]; if (Math.abs(v) < 1e-12) continue;
      var k = i + k0, body = pw(k), a = Math.abs(v);
      var cs = (body && near(a, 1)) ? '' : nf(a, s);
      if (!out) out = (v < 0 ? '-' : '') + cs + body;
      else out += (v < 0 ? ' - ' : ' + ') + cs + body;
    }
    return out || '0';
  }
  /** signed sum of [coef, body] pairs */
  function sumTex(terms, s) {
    var out = '';
    terms.forEach(function (t) {
      var c = t[0], b = t[1] || '';
      if (Math.abs(c) < 1e-12) return;
      var a = Math.abs(c), cs = (b && near(a, 1)) ? '' : nf(a, s);
      if (!out) out = (c < 0 ? '-' : '') + cs + b;
      else out += (c < 0 ? ' - ' : ' + ') + cs + b;
    });
    return out || '0';
  }
  function fac(p, v) { v = v || 'z^{-1}'; p = cxv(p); if (!isReal(p)) return '(1 - ' + cfp(p) + v + ')'; var r = p.re; if (near(r, 1)) return '(1 - ' + v + ')'; if (near(r, -1)) return '(1 + ' + v + ')'; return r >= 0 ? '(1 - ' + nf(r) + v + ')' : '(1 + ' + nf(-r) + v + ')'; }
  function cfp(z) { var s = cf(z); return /[+\-]/.test(s.replace(/^-/, '')) ? '(' + s + ')' : s; }
  function pn(p) { p = +p; if (near(p, 1)) return ''; return '(' + nf(p) + ')^n'; }
  function pnk(p, n) { return '(' + nf(p) + ')^{' + n + '}'; }
  function body(p, kind, mult) {
    var b = pn(p);
    var pre = mult === 2 ? '(n+1)' : '';
    return pre + b + (kind === 'a' ? 'u(-n-1)' : 'u(n)');
  }
  function rocTex(rin, rout) {
    if (rout === Infinity && !rin) return '\\text{all } z';
    if (rout === Infinity) return '|z|>' + nf(rin);
    if (!rin) return '|z|<' + nf(rout);
    return nf(rin) + '<|z|<' + nf(rout);
  }
  function dB(x) { return 20 * Math.log10(x); }
  /** y(n) + a1 y(n-1) + a2 y(n-2) with tidy signs and unit coefficients */
  function lhsY(a) { var t = sumTex(a.slice(1).map(function (q, k) { return [q, 'y(n-' + (k + 1) + ')']; })); return 'y(n)' + (t === '0' ? '' : (t[0] === '-' ? '' : '+') + t); }
  function seqTex(vals, i0, s) { return '\\{' + vals.map(function (v, i) { var t = nf(v, s || 4); return i === i0 ? '\\underset{\\uparrow}{' + t + '}' : t; }).join(',\\ ') + '\\}'; }
  function ans(label, value, o) {
    o = o || {};
    var a = { label: label, value: value, unit: o.unit || '', tol: o.tol == null ? 0.01 : o.tol, sig: o.sig || 4 };
    a.abs = o.abs == null ? 0.002 : o.abs;
    if (o.alt) a.alt = o.alt;
    if (o.hint) a.hint = o.hint;
    return a;
  }
  function ansInt(label, value, hint) { return { label: label, value: value, unit: '', tol: 0, abs: 0.01, sig: 4, hint: hint }; }
  function flag(label, v, hint) { return { label: label, value: v ? 1 : 0, unit: '', tol: 0, abs: 0.01, sig: 1, hint: hint || 'enter 1 for yes, 0 for no' }; }
  function steps(a) { return QB.steps(a); }
  function fin(t) { return QB.final(t); }
  function $(t) { return '$' + t + '$'; }
  function $$(t) { return '$$' + t + '$$'; }

  /* ------------------------------------------------------------ polynomial and PF maths */
  function pmul(a, b) { var o = []; for (var i = 0; i < a.length + b.length - 1; i++) o.push(0); for (i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) o[i + j] += a[i] * b[j]; return o; }
  function pfromRoots(ps) { var c = [1]; ps.forEach(function (p) { c = pmul(c, [1, -p]); }); return c; }   // Π(1 - p w), real p
  function peval(c, w) { var s = 0, x = 1; for (var i = 0; i < c.length; i++) { s += c[i] * x; x *= w; } return s; }
  function cpeval(c, w) { var s = C(0, 0), x = C(1, 0); for (var i = 0; i < c.length; i++) { s = s.add(x.scale(c[i])); x = x.mul(w); } return s; }
  function cl(c) { return c.map(function (v) { return Math.abs(v) < 1e-13 ? 0 : v; }); }
  /** roots of 1 + a1 w + a2 w^2 in terms of poles p (z-plane): p^2 + a1 p + a2 = 0 */
  function poles2(a1, a2) {
    var D = a1 * a1 - 4 * a2;
    if (D >= 0) { var s = Math.sqrt(D); return [C((-a1 + s) / 2, 0), C((-a1 - s) / 2, 0)]; }
    var s2 = Math.sqrt(-D); return [C(-a1 / 2, s2 / 2), C(-a1 / 2, -s2 / 2)];
  }
  /** residues A_i for N(w)/Π(1-p_i w), distinct p_i (real numbers) */
  function residues(num, ps) {
    return ps.map(function (p, i) {
      var v = peval(num, 1 / p);
      ps.forEach(function (q, j) { if (j !== i) v /= (1 - q / p); });
      return v;
    });
  }
  /** causal / anticausal sequence value from PF terms */
  function seqVal(terms, n) {
    var s = 0;
    terms.forEach(function (t) {
      if (t.kind === 'd') { if (n === (t.k || 0)) s += t.A; return; }
      var f = t.mult === 2 ? (n + 1) : 1;
      if (t.kind === 'c' && n >= 0) s += t.A * f * Math.pow(t.p, n);
      if (t.kind === 'a' && n <= -1) s -= t.A * f * Math.pow(t.p, n);
    });
    return s;
  }
  /** series coefficients of N(w)/D(w) in ascending w */
  function series(num, den, K) {
    var out = [];
    for (var k = 0; k < K; k++) {
      var v = k < num.length ? num[k] : 0;
      for (var j = 1; j < den.length && j <= k; j++) v -= den[j] * out[k - j];
      out.push(v / den[0]);
    }
    return out;
  }
  function freqResp(b, a, w) { var e = C(Math.cos(w), -Math.sin(w)); return cpeval(b, e).div(cpeval(a, e)); }
  function acosh(x) { return Math.log(x + Math.sqrt(x * x - 1)); }

  /* ------------------------------------------------------------ figures: pole-zero */
  var FILL = '#dbe7f5';
  function circD(r) { return 'M' + r.toFixed(2) + ',0A' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 1 0 ' + (-r).toFixed(2) + ',0A' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 1 0 ' + r.toFixed(2) + ',0Z'; }
  function pzDraw(o) {
    var d = QB.sch.drawing();
    var pts = (o.poles || []).concat(o.zeros || []).map(cxv);
    var m = 1.2;
    pts.forEach(function (p) { m = Math.max(m, p.abs() * 1.15, Math.abs(p.re) * 1.2, Math.abs(p.im) * 1.2); });
    if (o.rin && isFinite(o.rin)) m = Math.max(m, o.rin * 1.18);
    if (o.rout && isFinite(o.rout)) m = Math.max(m, o.rout * 1.18);
    var E = 130, k = E / m;
    // ROC shading
    if (o.rin != null || o.rout != null) {
      var rin = o.rin || 0, rout = o.rout == null ? Infinity : o.rout;
      if (!(rout <= rin)) {
        var outer = isFinite(rout) ? circD(rout * k) : 'M' + (-E) + ',' + (-E) + 'L' + E + ',' + (-E) + 'L' + E + ',' + E + 'L' + (-E) + ',' + E + 'Z';
        var inner = rin > 0 ? circD(rin * k) : '';
        d.raw('<path d="' + outer + inner + '" fill="' + FILL + '" fill-rule="evenodd" stroke="none"/>', { x0: -E, y0: -E, x1: E, y1: E }, false);
        if (rin > 0) d.circle(0, 0, rin * k, { dash: '6 4', sw: 1.3, noObstacle: true, stroke: '#215f9f' });
        if (isFinite(rout)) d.circle(0, 0, rout * k, { dash: '6 4', sw: 1.3, noObstacle: true, stroke: '#215f9f' });
      }
    }
    d.poly([[-E, 0], [E + 6, 0]], { sw: 1.1, noObstacle: true }); d.arrowHead([E + 12, 0], [1, 0], { len: 7, w: 3 });
    d.poly([[0, E], [0, -E - 6]], { sw: 1.1, noObstacle: true }); d.arrowHead([0, -E - 12], [0, -1], { len: 7, w: 3 });
    d.circle(0, 0, k, { dash: '2 3', sw: 1, noObstacle: true, stroke: '#555' });
    d.label([E + 14, 14], 'Re z', { plain: true, size: 11, anchor: 'end' });
    d.label([10, -E - 12], 'Im z', { plain: true, size: 11, anchor: 'start' });
    d.label([k + 4, 10], '1', { plain: true, size: 10, anchor: 'start' });
    function group(list) {
      var g = [];
      list.map(cxv).forEach(function (p) {
        for (var i = 0; i < g.length; i++) if (g[i].p.sub(p).abs() < 1e-6) { g[i].n++; return; }
        g.push({ p: p, n: 1 });
      });
      return g;
    }
    group(o.zeros || []).forEach(function (z) {
      var x = z.p.re * k, y = -z.p.im * k;
      d.circle(x, y, 5.5, { sw: 1.8, fill: '#fff' });
      if (z.n > 1) d.labelNear([x, y], '(' + z.n + ')', { prefer: ['topright', 'bottomright', 'topleft'], gap: 9, italic: false });
    });
    group(o.poles || []).forEach(function (z) {
      var x = z.p.re * k, y = -z.p.im * k, r = 5.5;
      d.path('M' + (x - r) + ',' + (y - r) + 'L' + (x + r) + ',' + (y + r) + 'M' + (x - r) + ',' + (y + r) + 'L' + (x + r) + ',' + (y - r), { x0: x - r, y0: y - r, x1: x + r, y1: y + r }, { sw: 2.2 });
      if (z.n > 1) d.labelNear([x, y], '(' + z.n + ')', { prefer: ['topright', 'bottomright', 'topleft'], gap: 9, italic: false });
    });
    if (o.note) d.label([-E, E + 16], o.note, { plain: true, size: 11, anchor: 'start' });
    return d.svg({ scale: 1.15, title: o.title || 'Pole-zero plot' });
  }
  function okSvg(s) { return typeof s === 'string' && s.trim().indexOf('<svg') === 0 && !/NaN|undefined|Infinity/.test(s); }
  function pzArr(z) { z = cxv(z); var a = [z.re, z.im]; a.re = z.re; a.im = z.im; return a; }
  /** pole-zero figure: QB.plot.poleZero when present, else local drawing */
  function pzFig(o) {
    var P = QB.plot && QB.plot.poleZero;
    if (typeof P === 'function') {
      try {
        var arg = { poles: (o.poles || []).map(pzArr), zeros: (o.zeros || []).map(pzArr) };
        if (o.rin != null || o.rout != null) arg.roc = { rin: o.rin || 0, rout: o.rout == null ? Infinity : o.rout };
        var s = P(arg, {});
        if (okSvg(s)) return s;
      } catch (e) { /* fall through */ }
    }
    return pzDraw(o);
  }

  /* ------------------------------------------------------------ figures: direct forms */
  function gl(v) { var s = nf(v, 4); return s.replace(/^-/, '−'); }
  function dfDraw(b, a, form) {
    var d = QB.sch.drawing();
    var M = b.length - 1, Nn = a.length - 1, dy = 64;
    function act(arr, k) { return k < arr.length && Math.abs(arr[k]) > 1e-12; }
    /* gains from the delay column (colX) toward an adder chain at x; side = +1 (chain right of column) or -1 */
    function chain(x, side, coefs, kmax, sign, colX) {
      var last = 0, k;
      for (k = 1; k <= kmax; k++) if (act(coefs, k)) last = k;
      if (!last) return false;
      for (k = 1; k <= last; k++) {
        if (!act(coefs, k)) continue;
        var y = k * dy;
        d.dot([colX, y]);
        var g0 = [colX + side * 12, y];
        d.wire({ from: [colX, y], to: g0 });
        var g = d.gain({ at: g0, dir: side < 0 ? 'left' : 'right', k: gl(sign * coefs[k]), len: 30, h: 13 });
        if (k === last) d.wire({ from: g.out, to: [x, y] });
        else { d.wire({ from: g.out, to: [x - side * 9, y], arrow: 'end' }); d.sum({ at: [x, y], r: 9 }); }
      }
      var cur = [x, last * dy];
      for (k = last - 1; k >= 0; k--) {
        if (k === 0) { d.wire({ from: cur, to: [x, 9], arrow: 'end' }); break; }
        if (act(coefs, k)) { d.wire({ from: cur, to: [x, k * dy + 9], arrow: 'end' }); cur = [x, k * dy - 9]; }
      }
      return true;
    }
    function delays(x, n) {
      for (var k = 1; k <= n; k++) {
        var yb = (k - 0.5) * dy;
        d.wire({ from: [x, (k - 1) * dy], to: [x, yb - 14] });
        d.box({ at: [x, yb], anchor: 'center', w: 38, h: 28, label: 'z^{-1}' });
        d.wire({ from: [x, yb + 14], to: [x, k * dy] });
      }
    }
    var k;
    if (form === 'I') {
      var xl = -170, s1 = -60, s2 = 50, xr = 160;
      d.terminal([xl - 50, 0], { label: 'x(n)', side: 'left' });
      d.wire({ from: [xl - 50, 0], to: [xl, 0] }); d.dot([xl, 0]);
      delays(xl, M);
      var g0 = d.gain({ at: [xl + 12, 0], dir: 'right', k: gl(b[0]), len: 30, h: 13 });
      d.wire({ from: [xl, 0], to: [xl + 12, 0] });
      d.wire({ from: g0.out, to: [s1 - 9, 0], arrow: 'end' }); d.sum({ at: [s1, 0], r: 9 });
      chain(s1, 1, b, M, 1, xl);
      d.wire({ from: [s1 + 9, 0], to: [s2 - 9, 0], arrow: 'end' }); d.sum({ at: [s2, 0], r: 9 });
      d.wire({ from: [s2 + 9, 0], to: [xr, 0] }); d.dot([xr, 0]);
      d.wire({ from: [xr, 0], to: [xr + 50, 0], arrow: 'end' }); d.label([xr + 56, 0], 'y(n)', { anchor: 'start' });
      delays(xr, Nn);
      chain(s2, -1, a, Nn, -1, xr);
      return d.svg({ scale: 1.1, title: 'Direct form I' });
    }
    var K = Math.max(M, Nn), xL = -100, xC = 0, xR = 100;
    d.terminal([xL - 60, 0], { label: 'x(n)', side: 'left' });
    d.wire({ from: [xL - 60, 0], to: [xL - 9, 0], arrow: 'end' });
    d.sum({ at: [xL, 0], r: 9 });
    d.wire({ from: [xL + 9, 0], to: [xC, 0] }); d.dot([xC, 0]);
    delays(xC, K);
    chain(xL, -1, a, Nn, -1, xC);
    var gb = d.gain({ at: [xC + 12, 0], dir: 'right', k: gl(b[0]), len: 30, h: 13 });
    d.wire({ from: [xC, 0], to: [xC + 12, 0] });
    var anyB = false; for (k = 1; k <= M; k++) if (act(b, k)) anyB = true;
    if (anyB) {
      d.wire({ from: gb.out, to: [xR - 9, 0], arrow: 'end' }); d.sum({ at: [xR, 0], r: 9 });
      chain(xR, 1, b, M, 1, xC);
      d.wire({ from: [xR + 9, 0], to: [xR + 60, 0], arrow: 'end' });
    } else d.wire({ from: gb.out, to: [xR + 60, 0], arrow: 'end' });
    d.label([xR + 66, 0], 'y(n)', { anchor: 'start' });
    return d.svg({ scale: 1.1, title: 'Direct form II' });
  }
  /** b, a in z^{-1} with a[0] = 1 */
  function dfFig(b, a, form) {
    form = form === 'I' ? 'I' : 'II';
    var fn = QB.sch['directForm' + form];
    if (typeof fn === 'function') {
      try {
        var s = fn(b.slice(), a.slice());
        if (okSvg(s)) return s;
      } catch (e) { /* fall through */ }
    }
    try { return dfDraw(b, a, form); } catch (e2) { return null; }
  }

  /* ------------------------------------------------------------ figures: block diagrams */
  function blockFeedback(G, F, sign) {
    var d = QB.sch.drawing();
    d.terminal([-150, 0], { label: 'x(n)', side: 'left' });
    d.wire({ from: [-150, 0], to: [-99, 0], arrow: 'end' });
    d.sum({ at: [-90, 0], r: 9, signs: { left: '+', bottom: sign < 0 ? '-' : '+' } });
    d.wire({ from: [-81, 0], to: [-40, 0], arrow: 'end' });
    d.label([-62, -12], 'e(n)', { size: 11 });
    var g = d.box({ at: [-40, 0], label: 'G(z)', w: 64, h: 34 });
    d.wire({ from: g.out, to: [90, 0] }); d.dot([60, 0]);
    d.wire({ from: [90, 0], to: [130, 0], arrow: 'end' }); d.label([136, 0], 'y(n)', { anchor: 'start' });
    var f = d.box({ at: [0, 70], anchor: 'center', label: 'F(z)', w: 64, h: 34 });
    d.wire({ from: [60, 0], pts: [[60, 70], [32, 70]], arrow: 'end' });
    d.wire({ from: [-32, 70], pts: [[-90, 70], [-90, 9]], arrow: 'end' });
    d.label([-40, 116], G + ', ' + F, { plain: true, size: 11 });
    return d.svg({ scale: 1.1, title: 'Feedback interconnection' });
  }
  function blockCombo(labels, sign) {
    // x -> H1 -> node -> {H2 (top) ; H3 -> H4 (bottom)} -> adder(+ top, sign bottom) -> y
    var d = QB.sch.drawing();
    d.terminal([-200, 0], { label: 'x(n)', side: 'left' });
    d.wire({ from: [-200, 0], to: [-170, 0] });
    var b1 = d.box({ at: [-170, 0], label: labels[0], w: 60, h: 32 });
    d.wire({ from: b1.out, to: [-80, 0] }); d.dot([-80, 0]);
    d.wire({ from: [-80, 0], pts: [[-80, -45], [-30, -45]], arrow: 'end' });
    var b2 = d.box({ at: [-30, -45], label: labels[1], w: 60, h: 32 });
    d.wire({ from: [-80, 0], pts: [[-80, 45], [-60, 45]], arrow: 'end' });
    var b3 = d.box({ at: [-60, 45], label: labels[2], w: 56, h: 32 });
    d.wire({ from: b3.out, to: [16, 45], arrow: 'end' });
    var b4 = d.box({ at: [16, 45], label: labels[3], w: 56, h: 32 });
    d.wire({ from: b2.out, pts: [[110, -45], [110, -9]], arrow: 'end' });
    d.wire({ from: b4.out, pts: [[110, 45], [110, 9]], arrow: 'end' });
    d.sum({ at: [110, 0], r: 9, signs: { top: '+', bottom: sign < 0 ? '-' : '+' } });
    d.wire({ from: [119, 0], to: [160, 0], arrow: 'end' }); d.label([166, 0], 'y(n)', { anchor: 'start' });
    return d.svg({ scale: 1.1, title: 'Block diagram' });
  }

  /* ------------------------------------------------------------ shared value pools */
  var PR = [0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.9];          // inside unit circle
  var PO = [1.25, 1.5, 2, 2.5, 3, 4];                          // outside
  var PALL = PR.concat(PO);
  function pickPoles(r, n, pool, minRatio) {
    pool = pool || PALL; minRatio = minRatio || 1.2;
    return r.retry(function () {
      var ps = [];
      for (var i = 0; i < n; i++) ps.push(r.pick(pool) * r.sign());
      for (i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
        var a = Math.abs(ps[i]), b = Math.abs(ps[j]);
        if (Math.max(a, b) / Math.min(a, b) < minRatio) return null;
      }
      return ps;
    }, 200);
  }
  function sortAbs(ps) { return ps.slice().sort(function (a, b) { return Math.abs(a) - Math.abs(b); }); }

  /** PF working list for distinct real poles: returns html lines */
  function coverLines(num, ps, A, label) {
    return ps.map(function (p, i) {
      var others = ps.filter(function (q, j) { return j !== i; });
      var den = others.map(function (q) { return '(1 ' + (q / p >= 0 ? '- ' : '+ ') + nf(Math.abs(q / p)) + ')'; }).join('');
      return $((label || 'A') + '_{' + (i + 1) + '}=\\Big[(1' + (p >= 0 ? '-' : '+') + nf(Math.abs(p)) + 'w)X\\Big]_{w=' + nf(1 / p) + '}=\\dfrac{' + nf(peval(num, 1 / p)) + '}{' + (den || '1') + '}=' + nf(A[i]));
    });
  }
  function kindOf(p, rin, rout) { return Math.abs(p) <= rin + 1e-9 ? 'c' : 'a'; }

  /* =========================================================================
   * MODULE z · TOPIC zt — z-transform and ROC
   * ========================================================================= */
  var COEF = [1, 2, 3, -1, -2, 4, 0.5, -3];

  QB.add({
    id: 'dsp.z.zt-roc', course: 'dsp', module: 'z', topic: 'zt',
    title: 'z-transform and ROC of a sum of exponentials', difficulty: 2, marks: 6,
    variants: [{ id: 'right', label: 'Right-sided (causal)' }, { id: 'left', label: 'Left-sided (anticausal)' }, { id: 'two', label: 'Two-sided (ring ROC)' }, { id: 'none', label: 'Two-sided, no common ROC', weight: 0.6 }],
    tags: ['T6 Q1', 'exam-style', 'ROC'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var a = r.pick(PALL) * r.sign(), b = r.pick(PALL) * r.sign();
        var A = Math.abs(a), B = Math.abs(b);
        if (Math.max(A, B) / Math.min(A, B) < 1.3) return null;
        if ((v === 'two' && A > B) || (v === 'none' && A < B)) { var t = a; a = b; b = t; }
        var c1 = r.pick(COEF), c2 = r.pick(COEF);
        var kinds = v === 'right' ? ['c', 'c'] : v === 'left' ? ['a', 'a'] : ['c', 'a'];
        var k1 = kinds[0] === 'c' ? c1 : -c1, k2 = kinds[1] === 'c' ? c2 : -c2;
        if (Math.abs(k1 + k2) < 1e-9) return null;
        return { a: a, b: b, c1: c1, c2: c2, kinds: kinds, k1: k1, k2: k2 };
      }, 300);
      var a = P.a, b = P.b, k1 = P.k1, k2 = P.k2, kinds = P.kinds;
      var A = Math.abs(a), B = Math.abs(b);
      var b0 = k1 + k2, b1 = -(k1 * b + k2 * a), a1 = -(a + b), a2 = a * b;
      var rin, rout, exists = true;
      if (v === 'right') { rin = Math.max(A, B); rout = Infinity; }
      else if (v === 'left') { rin = 0; rout = Math.min(A, B); }
      else if (v === 'two') { rin = A; rout = B; }
      else { exists = false; }
      var xT = sumTex([[P.c1, body(a, kinds[0])], [P.c2, body(b, kinds[1])]]);
      var piece = function (c, p, kind, k) {
        if (kind === 'c') return $(nf(c) + pn(p) + 'u(n)\\ \\longleftrightarrow\\ \\dfrac{' + nf(k) + '}{' + fac(p).slice(1, -1) + '},\\quad |z|>' + nf(Math.abs(p)));
        return $(nf(c) + pn(p) + 'u(-n-1)\\ \\longleftrightarrow\\ \\dfrac{' + nf(k) + '}{' + fac(p).slice(1, -1) + '},\\quad |z|<' + nf(Math.abs(p))) + ' (the anticausal pair is $-p^nu(-n-1)\\leftrightarrow\\frac{1}{1-pz^{-1}}$, so the sign flips)';
      };
      var stem = 'Find the z-transform of ' + $$('x(n)=' + xT) + ' and its region of convergence. Write $X(z)$ as one ratio of polynomials in $z^{-1}$.';
      var parts = [];
      var wa = steps([
        'Split into pieces and use the table, keeping the sign of each piece:',
        piece(P.c1, a, kinds[0], k1),
        piece(P.c2, b, kinds[1], k2),
        'Add over the common denominator $' + fac(a) + fac(b) + '=' + polyTex([1, a1, a2]) + '$:',
        $$('X(z)=\\frac{' + nf(k1) + fac(b) + (k2 >= 0 ? '+' : '-') + nf(Math.abs(k2)) + fac(a) + '}{' + polyTex([1, a1, a2]) + '}=\\frac{' + polyTex([b0, b1]) + '}{' + polyTex([1, a1, a2]) + '}')
      ]) + fin('b_0=' + nf(b0) + ',\\ b_1=' + nf(b1) + ',\\ a_1=' + nf(a1) + ',\\ a_2=' + nf(a2));
      var fig = pzFig({ poles: [a, b], zeros: [0, -b1 / b0], rin: exists ? rin : undefined, rout: exists ? rout : undefined, title: 'Poles, zeros and ROC' });
      if (v !== 'none') {
        parts.push({ q: '(a) Find $X(z)=\\dfrac{b_0+b_1z^{-1}}{1+a_1z^{-1}+a_2z^{-2}}$.', answers: [ans('$b_0$', b0), ans('$b_1$', b1), ans('$a_1$', a1), ans('$a_2$', a2)], working: wa });
        var ra = [];
        if (rin > 0) ra.push(ans('inner radius $r_1$', rin));
        if (isFinite(rout)) ra.push(ans('outer radius $r_2$', rout));
        var why = v === 'right' ? 'Both pieces are causal, so the ROC is outside the <b>outermost</b> pole: $|z|>' + nf(Math.max(A, B)) + '$ (it includes $z=\\infty$).'
          : v === 'left' ? 'Both pieces are anticausal, so the ROC is inside the <b>innermost</b> pole: $|z|<' + nf(Math.min(A, B)) + '$.'
            : 'Intersection of $|z|>' + nf(A) + '$ and $|z|<' + nf(B) + '$ is the ring $' + nf(A) + '<|z|<' + nf(B) + '$.';
        parts.push({ q: '(b) State the ROC. Enter its finite boundary radii.', answers: ra, working: steps([why, 'The ROC is bounded by poles and contains none.']) + fin('\\text{ROC: }' + rocTex(rin, rout)) + '<div class="qb-fig">' + fig + '</div>' });
      } else {
        parts.push({ q: '(a) Transform each piece and give the radius that bounds its ROC.', answers: [ans('radius for the causal piece', A), ans('radius for the anticausal piece', B)], working: steps([piece(P.c1, a, kinds[0], k1), piece(P.c2, b, kinds[1], k2)]) + fin('|z|>' + nf(A) + '\\quad\\text{and}\\quad |z|<' + nf(B)) });
        parts.push({ q: '(b) Does $X(z)$ exist?', answers: [flag('exists? (1/0)', false)], working: steps(['The ROC is the intersection $|z|>' + nf(A) + '\\ \\cap\\ |z|<' + nf(B) + '$.', 'Since $' + nf(A) + '>' + nf(B) + '$ the intersection is empty.']) + fin('\\text{ROC}=\\varnothing:\\ \\text{the z-transform does not exist}') });
      }
      if (v !== 'none') {
        var z2 = -b1 / b0;
        parts.push({ q: '(c) Write $X(z)$ in positive powers of $z$. One zero is at $z=0$; find the other zero. Check the pole and zero count.', answers: [ans('second zero $z_2$', z2)], working: steps([
          'Multiply top and bottom by $z^2$: ' + $('X(z)=\\dfrac{z(' + polyTex([b0, b1], function (k) { return k === 0 ? 'z' : ''; }) + ')}{(z ' + (a >= 0 ? '-' : '+') + nf(Math.abs(a)) + ')(z ' + (b >= 0 ? '-' : '+') + nf(Math.abs(b)) + ')}'),
          'Zeros: $z=0$ and $z=-b_1/b_0=' + nf(z2) + '$. Poles: $z=' + nf(a) + '$ and $z=' + nf(b) + '$.',
          '$X(\\infty)=b_0=' + nf(b0) + '$ is finite and nonzero, so nothing sits at $z=\\infty$. Count: 2 zeros, 2 poles.'
        ]) + fin('z_2=' + nf(z2)) });
        var dt = rin < 1 && rout > 1;
        var X1 = peval([b0, b1], 1) / peval([1, a1, a2], 1);
        var pa = [flag('DTFT exists? (1/0)', dt)];
        if (dt) pa.push(ans('$X(\\omega)$ at $\\omega=0$', X1));
        parts.push({ q: '(d) Does the DTFT of $x(n)$ exist? If it does, find $X(\\omega)$ at $\\omega=0$.', answers: pa, working: steps([
          'The DTFT is $X(z)$ on $|z|=1$, so it exists only if the ROC contains the unit circle.',
          'ROC $' + rocTex(rin, rout) + '$ ' + (dt ? 'contains' : 'does <b>not</b> contain') + ' $|z|=1$.',
          dt ? 'At $\\omega=0$, $z=1$: $X(0)=\\dfrac{' + nf(b0) + (b1 >= 0 ? '+' : '-') + nf(Math.abs(b1)) + '}{' + nf(peval([1, a1, a2], 1)) + '}=' + nf(X1) + '$.' : 'So $X(\\omega)$ does not exist.'
        ]) + fin(dt ? 'X(0)=' + nf(X1) : '\\text{no DTFT}') });
      }
      return {
        stem: stem, figure: null, parts: parts,
        notes: QB.callout('trap', 'The anticausal pair is $-a^nu(-n-1)\\leftrightarrow\\frac{1}{1-az^{-1}}$. A piece written as $+c\\,a^nu(-n-1)$ transforms to $-\\frac{c}{1-az^{-1}}$.'),
        meta: { a: a, b: b, c1: P.c1, c2: P.c2, kinds: kinds, v: v }
      };
    }
  });

  QB.add({
    id: 'dsp.z.zt-finite', course: 'dsp', module: 'z', topic: 'zt',
    title: 'Finite-length sequence: X(z), ROC and poles at 0 and ∞', difficulty: 1, marks: 4,
    variants: [{ id: 'causal', label: 'Samples at n ≥ 0' }, { id: 'anti', label: 'Samples at n ≤ 0' }, { id: 'both', label: 'Samples either side of n = 0' }],
    tags: ['L07', 'ROC'],
    gen: function (r, v) {
      var L = r.int(3, 5);
      var x = []; for (var i = 0; i < L; i++) x.push(r.pick([1, 2, 3, -1, -2, 0, 4, -3]));
      if (!x[0]) x[0] = 1; if (!x[L - 1]) x[L - 1] = -1;
      var n0 = v === 'causal' ? r.int(0, 1) : v === 'anti' ? -(L - 1) - r.int(0, 1) : -r.int(1, L - 2);
      var nmin = n0, nmax = n0 + L - 1;
      var i0 = -n0;   // arrow index
      var arrowOk = i0 >= 0 && i0 < L;
      var xs = arrowOk ? seqTex(x, i0, 3) : seqTex(x, -1, 3) + ',\\ \\text{first sample at } n=' + n0;
      var Xt = polyTex(x, zi, n0);
      var X1 = 0, Xm1 = 0; x.forEach(function (v2, i) { X1 += v2; Xm1 += v2 * Math.pow(-1, n0 + i); });
      var p0 = Math.max(0, nmax), pinf = Math.max(0, -nmin);
      var d = r.retry(function () { var dd = r.pick([-3, -2, -1, 1, 2, 3]); return dd; });
      var m0 = nmin - d, m1 = nmax - d;     // x(n+d) occupies n = nmin-d .. nmax-d
      var q0 = Math.max(0, m1), qinf = Math.max(0, -m0);
      var roc = function (lo, hi) { return lo >= 0 ? (hi > 0 ? '|z|>0\\ (\\text{all } z \\text{ except } 0)' : '\\text{all } z') : (hi > 0 ? '0<|z|<\\infty' : '|z|<\\infty\\ (\\text{all } z\\text{ except }\\infty)'); };
      var shiftT = d > 0 ? 'x(n+' + d + ')' : 'x(n-' + (-d) + ')';
      return {
        stem: 'A finite-length sequence is ' + $$('x(n)=' + xs) + ' where the arrow marks $n=0$ and $x(n)=0$ elsewhere.',
        figure: null,
        parts: [
          { q: '(a) Write $X(z)$ and evaluate it at $z=1$ and $z=-1$.', answers: [ans('$X(1)$', X1), ans('$X(-1)$', Xm1)], working: steps([
            'The coefficient of $z^{-n}$ is $x(n)$: ' + $('X(z)=' + Xt),
            '$X(1)=\\sum x(n)=' + nf(X1) + '$ and $X(-1)=\\sum(-1)^nx(n)=' + nf(Xm1) + '$.'
          ]) + fin('X(1)=' + nf(X1) + ',\\quad X(-1)=' + nf(Xm1)) },
          { q: '(b) Give the ROC. How many poles does $X(z)$ have at $z=0$ and at $z=\\infty$?', answers: [ansInt('poles at $z=0$', p0), ansInt('poles at $z=\\infty$', pinf)], working: steps([
            'Samples run from $n=' + nmin + '$ to $n=' + nmax + '$.',
            nmax > 0 ? 'The $z^{-' + nmax + '}$ term blows up at $z=0$: ' + p0 + ' pole' + (p0 > 1 ? 's' : '') + ' at the origin, so $z=0$ is excluded.' : 'No negative powers of $z$, so $z=0$ is allowed.',
            nmin < 0 ? 'The $' + zi(nmin) + '$ term blows up at $z=\\infty$: ' + pinf + ' pole' + (pinf > 1 ? 's' : '') + ' at infinity, so $z=\\infty$ is excluded.' : 'No positive powers of $z$, so $X(\\infty)$ is finite and $z=\\infty$ is allowed.'
          ]) + fin('\\text{ROC: }' + roc(nmin, nmax)) },
          { q: '(c) Give the ROC of $' + shiftT + '$ and its number of poles at $z=0$ and at $z=\\infty$.', answers: [ansInt('poles at $z=0$', q0), ansInt('poles at $z=\\infty$', qinf)], working: steps([
            'Shift: $' + shiftT + '\\leftrightarrow ' + (d > 0 ? 'z^{' + d + '}' : 'z^{-' + (-d) + '}') + 'X(z)$. The samples now run from $n=' + m0 + '$ to $n=' + m1 + '$.',
            'Poles at 0: ' + q0 + '. Poles at $\\infty$: ' + qinf + '.'
          ]) + fin('\\text{ROC: }' + roc(m0, m1)) }
        ],
        meta: { x: x, n0: n0, d: d }
      };
    }
  });

  var W0 = [PI / 6, PI / 4, PI / 3, PI / 2, 2 * PI / 3, 3 * PI / 4];
  QB.add({
    id: 'dsp.z.zt-cos', course: 'dsp', module: 'z', topic: 'zt',
    title: 'Damped sinusoid: transform, poles and ROC', difficulty: 2, marks: 4,
    variants: [{ id: 'cos', label: 'Damped cosine' }, { id: 'sin', label: 'Damped sine' }],
    tags: ['L07', 'Euler'],
    gen: function (r, v) {
      var rr = r.pick([0.5, 0.6, 0.75, 0.8, 0.9, 1.25, 1.5]), w0 = r.pick(W0), Am = r.pick([1, 2, 3, 0.5]);
      var cw = Math.cos(w0), sw = Math.sin(w0);
      var a1 = -2 * rr * cw, a2 = rr * rr;
      var bnum = v === 'cos' ? [Am, -Am * rr * cw] : [0, Am * rr * sw];
      var fn = v === 'cos' ? '\\cos' : '\\sin';
      var dt = rr < 1;
      var X1 = peval(bnum, 1) / peval([1, a1, a2], 1);
      var xT = (Am === 1 ? '' : nf(Am)) + '(' + nf(rr) + ')^n' + fn + '\\!\\left(' + piT(w0) + 'n\\right)u(n)';
      var euler = v === 'cos' ? fn + '(\\omega_0n)=\\tfrac12\\left(e^{j\\omega_0n}+e^{-j\\omega_0n}\\right)' : fn + '(\\omega_0n)=\\tfrac1{2j}\\left(e^{j\\omega_0n}-e^{-j\\omega_0n}\\right)';
      var pa = [flag('DTFT exists? (1/0)', dt)]; if (dt) pa.push(ans('$X(\\omega)$ at $\\omega=0$', X1));
      return {
        stem: 'Find the z-transform, poles and ROC of ' + $$('x(n)=' + xT),
        figure: null,
        parts: [
          { q: '(a) Write $X(z)=\\dfrac{b_0+b_1z^{-1}}{1+a_1z^{-1}+a_2z^{-2}}$.', answers: [ans('$b_0$', bnum[0]), ans('$b_1$', bnum[1]), ans('$a_1$', a1), ans('$a_2$', a2)], working: steps([
            'Euler: $' + euler + '$, so $x(n)$ is two causal exponentials with bases $' + nf(rr) + 'e^{\\pm j' + piT(w0) + '}$.',
            'Each piece gives $\\frac{1}{1-re^{\\pm j\\omega_0}z^{-1}}$. Combining over $(1-re^{j\\omega_0}z^{-1})(1-re^{-j\\omega_0}z^{-1})=1-2r\\cos\\omega_0z^{-1}+r^2z^{-2}$:',
            $$('X(z)=\\frac{' + polyTex(bnum) + '}{' + polyTex([1, a1, a2]) + '}'),
            v === 'cos' ? 'Numerator $A(1-r\\cos\\omega_0z^{-1})$ with $r\\cos\\omega_0=' + nf(rr * cw) + '$.' : 'Numerator $A\\,r\\sin\\omega_0z^{-1}$ with $r\\sin\\omega_0=' + nf(rr * sw) + '$.'
          ]) + fin('X(z)=\\dfrac{' + polyTex(bnum) + '}{' + polyTex([1, a1, a2]) + '}') },
          { q: '(b) Give the pole radius and angle, and the ROC radius.', answers: [ans('pole radius', rr), ans('pole angle', w0, { unit: 'rad' }), ans('ROC: $|z|>$', rr)], working: steps([
            'Poles at $re^{\\pm j\\omega_0}=' + nf(rr) + 'e^{\\pm j' + piT(w0) + '}$ (check: $|p|^2=a_2=' + nf(a2) + '$).',
            'Both pieces are causal, so the ROC is outside the pole circle.'
          ]) + fin('|z|>' + nf(rr)) + '<div class="qb-fig">' + pzFig({ poles: [C.polar(rr, w0 * 180 / PI), C.polar(rr, -w0 * 180 / PI)], zeros: v === 'cos' ? [0, rr * cw] : [0], rin: rr, title: 'Poles and ROC' }) + '</div>' },
          { q: '(c) Does the DTFT exist? If so, find $X(\\omega)$ at $\\omega=0$.', answers: pa, working: steps([
            dt ? 'The ROC $|z|>' + nf(rr) + '$ contains $|z|=1$.' : 'The ROC $|z|>' + nf(rr) + '$ misses $|z|=1$, so there is no DTFT.',
            dt ? '$X(0)=X(z{=}1)=\\dfrac{' + nf(peval(bnum, 1)) + '}{' + nf(peval([1, a1, a2], 1)) + '}=' + nf(X1) + '$.' : ''
          ]) + fin(dt ? 'X(0)=' + nf(X1) : '\\text{no DTFT}') }
        ],
        meta: { r: rr, w0: w0, A: Am, v: v }
      };
    }
  });

  /* =========================================================================
   * TOPIC zprop — properties and interconnections
   * ========================================================================= */
  QB.add({
    id: 'dsp.z.zprop-ops', course: 'dsp', module: 'z', topic: 'zprop',
    title: 'Properties: shift, reversal, scaling, n·x(n) and expansion', difficulty: 2, marks: 4,
    variants: [{ id: 'shift', label: 'Time shift' }, { id: 'reverse', label: 'Time reversal' }, { id: 'scale', label: 'Scaling by z₀ⁿ' }, { id: 'diff', label: 'Multiply by n' }, { id: 'expand', label: 'Time expansion' }],
    tags: ['L07 slides 10-14', 'T6 Q1(c)(d)'],
    gen: function (r, v) {
      var a = r.pick(PR) * r.sign(), c = r.pick([1, 2, 3, -1, 0.5]);
      var A = Math.abs(a);
      var base = $$('x(n)=' + sumTex([[c, body(a, 'c')]]) + '\\ \\longleftrightarrow\\ X(z)=\\frac{' + nf(c) + '}{' + fac(a).slice(1, -1) + '},\\quad |z|>' + nf(A));
      var parts = [], meta = { v: v, a: a, c: c }, stem;
      if (v === 'shift') {
        var d = r.int(1, 3), adv = r.bool();
        var yT = adv ? 'x(n+' + d + ')' : 'x(n-' + d + ')';
        var n0 = adv ? -d : d;
        meta.d = d; meta.adv = adv;
        stem = 'Given ' + base + 'use properties only to find the transform and ROC of $y(n)=' + yT + '$.';
        parts.push({ q: '(a) Find $Y(z)$, the first nonzero sample index $n_0$ and $y(n_0+1)$.', answers: [ansInt('$n_0$', n0), ans('$y(n_0+1)$', c * a)], working: steps([
          'Shift: $x(n-d)\\leftrightarrow z^{-d}X(z)$. Here $d=' + (adv ? -d : d) + '$, so $Y(z)=' + (adv ? 'z^{' + d + '}' : 'z^{-' + d + '}') + '\\dfrac{' + nf(c) + '}{' + fac(a).slice(1, -1) + '}$.',
          'x(n) starts at $n=0$, so $y(n)$ starts at $n_0=' + n0 + '$, and $y(n_0+1)=x(1)=' + nf(c) + '(' + nf(a) + ')=' + nf(c * a) + '$.'
        ]) + fin('n_0=' + n0 + ',\\ y(n_0+1)=' + nf(c * a)) });
        parts.push({ q: '(b) Give the ROC of $Y(z)$. Is $z=\\infty$ in it?', answers: [ans('inner radius', A), flag('$z=\\infty$ in ROC? (1/0)', !adv)], working: steps([
          'A shift keeps the ring $|z|>' + nf(A) + '$; only $0$ or $\\infty$ can change.',
          adv ? 'The factor $z^{' + d + '}$ blows up at $z=\\infty$ ($y(n)\\ne0$ for some $n<0$), so $\\infty$ is removed.' : 'The factor $z^{-' + d + '}$ is fine at $\\infty$; the signal is still causal.'
        ]) + fin(adv ? nf(A) + '<|z|<\\infty' : '|z|>' + nf(A)) });
      } else if (v === 'reverse') {
        var P = r.retry(function () { var p = r.pick(PR) * r.sign(), q = r.pick(PO) * r.sign(); return Math.abs(p) * 1.3 < Math.abs(q) ? [p, q] : null; });
        var c2 = r.pick([1, 2, -1, -2, 3]);
        a = P[0]; var b = P[1]; A = Math.abs(a); var B = Math.abs(b);
        meta.a = a; meta.b = b; meta.c2 = c2;
        var xT = sumTex([[c, body(a, 'c')], [c2, body(b, 'a')]]);
        stem = 'A two-sided signal is $x(n)=' + xT + '$, with ROC $' + nf(A) + '<|z|<' + nf(B) + '$. Let $y(n)=x(-n)$.';
        parts.push({ q: '(a) Give the ROC of $Y(z)$.', answers: [ans('inner radius', 1 / B), ans('outer radius', 1 / A)], working: steps([
          'Reversal: $x(-n)\\leftrightarrow X(z^{-1})$, and the ROC radii are inverted <b>and swapped</b>.',
          '$' + nf(A) + '<|z^{-1}|<' + nf(B) + '\\iff ' + nf(1 / B) + '<|z|<' + nf(1 / A) + '$.'
        ]) + fin(nf(1 / B) + '<|z|<' + nf(1 / A)) });
        parts.push({ q: '(b) Find the poles of $Y(z)$, and the samples $y(1)$ and $y(-1)$.', answers: [ans('pole from $' + nf(a) + '$', 1 / a), ans('pole from $' + nf(b) + '$', 1 / b), ans('$y(1)$', c2 / b), ans('$y(-1)$', c * a)], working: steps([
          'Every pole $p$ moves to $1/p$: $' + nf(a) + '\\to' + nf(1 / a) + '$ and $' + nf(b) + '\\to' + nf(1 / b) + '$.',
          '$y(1)=x(-1)=' + nf(c2) + '(' + nf(b) + ')^{-1}=' + nf(c2 / b) + '$, and $y(-1)=x(1)=' + nf(c) + '(' + nf(a) + ')=' + nf(c * a) + '$.'
        ]) + fin('y(1)=' + nf(c2 / b) + ',\\ y(-1)=' + nf(c * a)) });
      } else if (v === 'scale') {
        var z0 = r.retry(function () { var t = r.pick([2, 0.5, -1, -2, 1.5, -0.5]); return Math.abs(Math.abs(a * t) - 1) > 0.05 ? t : null; });
        meta.z0 = z0;
        stem = 'Given ' + base + 'find the transform and ROC of $y(n)=(' + nf(z0) + ')^n\\,x(n)$.';
        parts.push({ q: '(a) Find the pole of $Y(z)$ and the ROC.', answers: [ans('pole', a * z0), ans('ROC: $|z|>$', Math.abs(a * z0))], working: steps([
          'Scaling: $z_0^nx(n)\\leftrightarrow X(z/z_0)$, ROC $|z_0|R_x$.',
          '$Y(z)=\\dfrac{' + nf(c) + '}{1-' + cfp(a) + '(z/' + cfp(z0) + ')^{-1}}=\\dfrac{' + nf(c) + '}{' + fac(a * z0).slice(1, -1) + '}$: the pole moves from $' + nf(a) + '$ to $' + nf(a * z0) + '$.'
        ]) + fin('|z|>' + nf(Math.abs(a * z0))) });
        parts.push({ q: '(b) Find $y(2)$.', answers: [ans('$y(2)$', c * Math.pow(a * z0, 2))], working: steps(['$y(n)=' + nf(c) + '(' + nf(a * z0) + ')^nu(n)$, so $y(2)=' + nf(c * Math.pow(a * z0, 2)) + '$.']) + fin('y(2)=' + nf(c * Math.pow(a * z0, 2))) });
      } else if (v === 'diff') {
        stem = 'Given ' + base + 'find the transform of $y(n)=n\\,x(n)$.';
        parts.push({ q: '(a) Write $Y(z)=\\dfrac{\\beta z^{-1}}{(1-az^{-1})^2}$. Find $\\beta$ and the order of the pole at $z=a$.', answers: [ans('$\\beta$', c * a), ansInt('pole order', 2)], working: steps([
          'Differentiation: $nx(n)\\leftrightarrow -z\\dfrac{dX}{dz}$. With $X=\\dfrac{' + nf(c) + 'z}{z-' + cfp(a) + '}$, $\\dfrac{dX}{dz}=\\dfrac{-' + nf(c) + '(' + nf(a) + ')}{(z-' + cfp(a) + ')^2}$.',
          '$Y(z)=\\dfrac{' + nf(c * a) + 'z}{(z-' + cfp(a) + ')^2}=\\dfrac{' + nf(c * a) + 'z^{-1}}{' + fac(a) + '^2}$, ROC $|z|>' + nf(A) + '$ (double pole).'
        ]) + fin('\\beta=' + nf(c * a)) });
        parts.push({ q: '(b) Use the initial value theorem to find $y(0)$, then find $y(3)$.', answers: [ans('$y(0)$', 0), ans('$y(3)$', 3 * c * Math.pow(a, 3))], working: steps([
          'The signal is causal, so $y(0)=\\lim_{z\\to\\infty}Y(z)=0$ (agrees with $0\\cdot x(0)$).',
          '$y(3)=3x(3)=3(' + nf(c) + ')(' + nf(a) + ')^3=' + nf(3 * c * Math.pow(a, 3)) + '$.'
        ]) + fin('y(0)=0,\\ y(3)=' + nf(3 * c * Math.pow(a, 3))) });
      } else {
        var k = r.pick([2, 3]); meta.k = k;
        stem = 'Given ' + base + 'let $y(n)=x_{(' + k + ')}(n)$, i.e. $x(n/' + k + ')$ when $n$ is a multiple of ' + k + ' and 0 otherwise.';
        parts.push({ q: '(a) Find the ROC radius and the number of poles of $Y(z)$.', answers: [ans('ROC: $|z|>$', Math.pow(A, 1 / k)), ansInt('number of poles', k)], working: steps([
          'Expansion: $x_{(k)}(n)\\leftrightarrow X(z^k)$, ROC $R_x^{1/k}$.',
          '$Y(z)=\\dfrac{' + nf(c) + '}{1' + (a >= 0 ? '-' : '+') + nf(A) + 'z^{-' + k + '}}$: ' + k + ' poles on the circle of radius $' + nf(A) + '^{1/' + k + '}=' + nf(Math.pow(A, 1 / k)) + '$.'
        ]) + fin('|z|>' + nf(Math.pow(A, 1 / k))) });
        parts.push({ q: '(b) Find $y(' + k + ')$ and $y(' + (2 * k) + ')$.', answers: [ans('$y(' + k + ')$', c * a), ans('$y(' + 2 * k + ')$', c * a * a)], working: steps(['$y(' + k + ')=x(1)=' + nf(c * a) + '$ and $y(' + 2 * k + ')=x(2)=' + nf(c * a * a) + '$.']) + fin('y(' + k + ')=' + nf(c * a) + ',\\ y(' + 2 * k + ')=' + nf(c * a * a)) });
      }
      return { stem: stem, figure: null, parts: parts, notes: QB.callout('trap', 'Shift direction: $x(n+4)\\leftrightarrow z^{+4}X(z)$. Reversal inverts <b>and swaps</b> the ROC radii.'), meta: meta };
    }
  });

  /* Laurent polynomials {n0, c} for FIR blocks */
  function lp(n0, c) { return { n0: n0, c: c.slice() }; }
  function lmul(a, b) { return { n0: a.n0 + b.n0, c: pmul(a.c, b.c) }; }
  function ladd(a, b, s) {
    var n0 = Math.min(a.n0, b.n0), n1 = Math.max(a.n0 + a.c.length, b.n0 + b.c.length), c = [];
    for (var n = n0; n < n1; n++) { var va = (n >= a.n0 && n < a.n0 + a.c.length) ? a.c[n - a.n0] : 0, vb = (n >= b.n0 && n < b.n0 + b.c.length) ? b.c[n - b.n0] : 0; c.push(va + s * vb); }
    return { n0: n0, c: cl(c) };
  }
  function lval(a, n) { return (n >= a.n0 && n < a.n0 + a.c.length) ? a.c[n - a.n0] : 0; }
  function ltex(a) { return polyTex(a.c, zi, a.n0); }
  function lseq(a) {
    var n0 = Math.min(a.n0, 0), n1 = Math.max(a.n0 + a.c.length - 1, 0), v = [];
    for (var n = n0; n <= n1; n++) v.push(lval(a, n));
    return seqTex(v, -n0, 4);
  }

  QB.add({
    id: 'dsp.z.zprop-blocks', course: 'dsp', module: 'z', topic: 'zprop',
    title: 'Interconnections: H(z) from a block diagram, causality', difficulty: 2, marks: 6,
    variants: [{ id: 'fbneg', label: 'Negative feedback loop' }, { id: 'fbpos', label: 'Positive feedback loop' }, { id: 'combo', label: 'FIR blocks, cascade and parallel (T6 Q3)' }],
    tags: ['T6 Q3', 'L03 slides 11-12'],
    gen: function (r, v) {
      if (v === 'combo') {
        var h1 = lp(0, [r.pick([0.5, 1, 2]), r.pick([0.25, 0.5, -0.5, 1]), r.pick([0, 0.5, -0.5])]);
        if (!h1.c[2]) h1.c.pop();
        var h2 = lp(0, [1, r.pick([-1, 1, -0.5, 0.5])]);
        var same = r.bool(0.6);
        var h3 = same ? lp(0, h2.c) : lp(0, [1, r.pick([-1, 1, 0.5])]);
        var nc = r.bool(0.75);
        var h4 = nc ? lp(-1, [1, 0, r.pick([0, 1, -1]), r.pick([2, -2, 1])]) : lp(1, [r.pick([1, 2, -1]), r.pick([0, 0.5, 1])]);
        h4.c = cl(h4.c); while (h4.c.length > 1 && !h4.c[h4.c.length - 1]) h4.c.pop();
        var sg = r.pick([-1, 1]);
        var inner = ladd(h2, lmul(h3, h4), sg);
        var H = lmul(h1, inner); H.c = cl(H.c);
        var first = null; for (var i = 0; i < H.c.length; i++) if (Math.abs(H.c[i]) > 1e-12) { first = H.n0 + i; break; }
        var causal = first >= 0;
        var bl = function (h, nm) { return $(nm + '(z)=' + ltex(h)); };
        var seqS = function (h) { return lseq(h); };
        var fig = blockCombo(['H_1(z)', 'H_2(z)', 'H_3(z)', 'H_4(z)'], sg);
        return {
          stem: 'Find the transfer function and impulse response of the system in the figure, where ' + $$('h_1(n)=' + seqS(h1) + ',\\quad h_2(n)=' + seqS(h2) + ',\\quad h_3(n)=' + seqS(h3) + ',\\quad h_4(n)=' + seqS(h4)) + 'The arrow marks $n=0$. Is the system causal?',
          figure: fig,
          parts: [
            { q: '(a) Find $h(n)$ at $n=-1$, $0$ and $1$.', answers: [ans('$h(-1)$', lval(H, -1)), ans('$h(0)$', lval(H, 0)), ans('$h(1)$', lval(H, 1))], working: steps([
              'Block transfer functions (the $n=0$ sample multiplies $z^0$, $n=-1$ multiplies $z^{+1}$): ' + bl(h1, 'H_1') + ', ' + bl(h2, 'H_2') + ', ' + bl(h3, 'H_3') + ', ' + bl(h4, 'H_4') + '.',
              'The figure is $H_1$ in cascade with ($H_2$ ' + (sg < 0 ? 'minus' : 'plus') + ' the $H_3\\to H_4$ branch): $H(z)=H_1(z)\\big[H_2(z)' + (sg < 0 ? '-' : '+') + 'H_3(z)H_4(z)\\big]$.',
              '$H_3H_4=' + ltex(lmul(h3, h4)) + '$, so the bracket is $' + ltex(inner) + '$.',
              $$('H(z)=' + ltex(H)),
              'Read off the coefficients: $h(n)=' + lseq(H) + '$.'
            ]) + fin('h(-1)=' + nf(lval(H, -1)) + ',\\ h(0)=' + nf(lval(H, 0)) + ',\\ h(1)=' + nf(lval(H, 1))) },
            { q: '(b) Is the system causal?', answers: [flag('causal? (1/0)', causal)], working: steps([
              causal ? 'No positive powers of $z$ survive in the final $H(z)$, so $h(n)=0$ for $n<0$.' : 'The final $H(z)$ has a $' + zi(first) + '$ term, so $h(' + first + ')\\ne0$.',
              'Decide from the <b>final</b> $H(z)$, not from one block: terms can cancel.'
            ]) + fin(causal ? '\\text{causal}' : '\\text{not causal}') }
          ],
          meta: { v: v, h1: h1, h2: h2, h3: h3, h4: h4, sg: sg }
        };
      }
      var P = r.retry(function () {
        var g0 = r.pick([1, 2, 0.5]), g1 = r.pick([0.5, 1, -0.5, -1, 2]), k = r.pick([0.2, 0.25, 0.4, 0.5, 0.6, 0.8, 1]);
        var s = v === 'fbneg' ? 1 : -1;
        var a1 = s * k * g0, a2 = s * k * g1;
        var ps = poles2(a1, a2), m = Math.max(ps[0].abs(), ps[1].abs());
        if (Math.abs(m - 1) < 0.06 || Math.min(ps[0].abs(), ps[1].abs()) < 0.05) return null;
        var zz = -g1 / g0;  // zero
        if (Math.abs(peval([1, a1, a2], 1 / zz)) < 1e-6) return null;
        return { g0: g0, g1: g1, k: k, a1: a1, a2: a2, ps: ps, m: m };
      });
      var s = v === 'fbneg' ? 1 : -1;
      var Gt = polyTex([P.g0, P.g1]), Ft = nf(P.k) + 'z^{-1}';
      var stab = P.m < 1;
      var H1 = (P.g0 + P.g1) / (1 + P.a1 + P.a2);
      var ans2 = [ans('largest pole magnitude', P.m), flag('stable? (1/0)', stab)];
      if (stab) ans2.push(ans('$H(\\omega)$ at $\\omega=0$', H1));
      var pzs = '<div class="qb-fig">' + pzFig({ poles: P.ps, zeros: [0, -P.g1 / P.g0], rin: P.m, title: 'Poles, zeros and causal ROC' }) + '</div>';
      return {
        stem: 'In the figure the adder output $e(n)$ drives $G(z)=' + Gt + '$ to give $y(n)$, and $y(n)$ is fed back through $F(z)=' + Ft + '$ to the <b>' + (s > 0 ? 'minus' : 'plus') + '</b> input of the adder.',
        figure: blockFeedback('G(z)=' + Gt.replace(/z\^\{-1\}/g, 'z⁻¹'), 'F(z)=' + Ft.replace(/z\^\{-1\}/g, 'z⁻¹'), -s),
        parts: [
          { q: '(a) Find $H(z)=Y(z)/X(z)$ as $\\dfrac{b_0+b_1z^{-1}}{1+a_1z^{-1}+a_2z^{-2}}$.', answers: [ans('$a_1$', P.a1), ans('$a_2$', P.a2)], working: steps([
            'Adder: $E=X' + (s > 0 ? '-' : '+') + 'FY$. Forward: $Y=GE$. So $Y=GX' + (s > 0 ? '-' : '+') + 'GFY$ and $H=\\dfrac{G}{1' + (s > 0 ? '+' : '-') + 'GF}$.',
            '$GF=(' + Gt + ')(' + Ft + ')=' + polyTex([0, P.k * P.g0, P.k * P.g1]) + '$.',
            $$('H(z)=\\frac{' + Gt + '}{' + polyTex([1, P.a1, P.a2]) + '}')
          ]) + fin('a_1=' + nf(P.a1) + ',\\ a_2=' + nf(P.a2)) },
          { q: '(b) Is the system causal? Find the largest pole magnitude and decide stability. If it is stable, find $H(\\omega)$ at $\\omega=0$.', answers: ans2, working: steps([
            'All blocks are causal and the loop has a delay ($z^{-1}$ in $F$), so the system is causal: ROC $|z|>\\max|p|$.',
            'Poles: roots of $z^2' + (P.a1 >= 0 ? '+' : '-') + nf(Math.abs(P.a1)) + 'z' + (P.a2 >= 0 ? '+' : '-') + nf(Math.abs(P.a2)) + '=0$: $p=' + cf(P.ps[0]) + ',\\ ' + cf(P.ps[1]) + '$, so $\\max|p|=' + nf(P.m) + '$.',
            stab ? 'All poles inside the unit circle: stable. $H(0)=H(z{=}1)=\\dfrac{' + nf(P.g0 + P.g1) + '}{' + nf(1 + P.a1 + P.a2) + '}=' + nf(H1) + '$.' : 'A pole lies outside the unit circle, so the causal ROC misses $|z|=1$: unstable, and $H(\\omega)$ does not exist.'
          ]) + fin(stab ? 'H(0)=' + nf(H1) : '\\text{unstable}') + pzs }
        ],
        meta: { v: v, g0: P.g0, g1: P.g1, k: P.k }
      };
    }
  });

  QB.add({
    id: 'dsp.z.zprop-conv', course: 'dsp', module: 'z', topic: 'zprop',
    title: 'Convolution using the z-transform', difficulty: 2, marks: 6,
    variants: [{ id: 'causal', label: 'Two causal signals' }, { id: 'ring', label: 'Two-sided signal (ring ROC)' }, { id: 'cancel', label: 'Pole-zero cancellation' }],
    tags: ['T6 Q2', 'Y = HX'],
    gen: function (r, v) {
      if (v === 'cancel') {
        var a = r.pick(PR) * r.sign(), g = r.pick([1, 2, -1, 3, 0.5]);
        return {
          stem: 'The input $x(n)=(' + nf(a) + ')^nu(n)$ is applied to an LTI system with $h(n)=' + sumTex([[g, '\\delta(n+1)'], [-g * a, '\\delta(n)']]) + '$.',
          figure: null,
          parts: [
            { q: '(a) Find $Y(z)$ and $y(n)$. Enter $y(-1)$ and $y(0)$.', answers: [ans('$y(-1)$', g), ans('$y(0)$', 0)], working: steps([
              '$X(z)=\\dfrac{1}{' + fac(a).slice(1, -1) + '}$, $|z|>' + nf(Math.abs(a)) + '$. $H(z)=' + polyTex([g, -g * a], zi, -1) + '=' + nf(g) + 'z' + fac(a) + '$, $|z|<\\infty$.',
              '$Y=HX=' + nf(g) + 'z$: the zero of $H$ at $z=' + nf(a) + '$ cancels the pole of $X$.',
              'So $y(n)=' + nf(g) + '\\delta(n+1)$.'
            ]) + fin('y(n)=' + nf(g) + '\\delta(n+1)') },
            { q: '(b) Is the system causal? Why is the ROC of $Y$ larger than $R_x\\cap R_h$?', answers: [flag('causal? (1/0)', false)], working: steps([
              'Not causal: $h(-1)=' + nf(g) + '\\ne0$ (the $z^{+1}$ term).',
              '$R_x\\cap R_h=' + nf(Math.abs(a)) + '<|z|<\\infty$, but with no pole left the ROC of $Y$ grows to all $z$ except $\\infty$. This is the "at least" in the convolution property.'
            ]) + fin('\\text{not causal; ROC of }Y:\\ |z|<\\infty') }
          ],
          meta: { v: v, a: a, g: g }
        };
      }
      if (v === 'causal') {
        var P = pickPoles(r, 2, PR, 1.25), c1 = r.pick([1, 2, 3, -1, 0.5]);
        var a = P[0], b = P[1];
        var Aa = residues([c1], [a, b]);
        var y2 = seqVal([{ A: Aa[0], p: a, kind: 'c' }, { A: Aa[1], p: b, kind: 'c' }], 2);
        return {
          stem: 'Use the z-transform to find $y(n)=x_1(n)*x_2(n)$ for ' + $$('x_1(n)=' + sumTex([[c1, body(a, 'c')]]) + ',\\qquad x_2(n)=' + body(b, 'c')),
          figure: null,
          parts: [
            { q: '(a) Write $Y(z)$ with its ROC and expand it as $\\dfrac{A}{1-' + cfp(a) + 'z^{-1}}+\\dfrac{B}{1-' + cfp(b) + 'z^{-1}}$.', answers: [ans('$A$', Aa[0]), ans('$B$', Aa[1])], working: steps([
              '$Y(z)=X_1X_2=\\dfrac{' + nf(c1) + '}{' + fac(a) + fac(b) + '}$, ROC $|z|>' + nf(Math.max(Math.abs(a), Math.abs(b))) + '$.'
            ].concat(coverLines([c1], [a, b], Aa))) + fin('A=' + nf(Aa[0]) + ',\\ B=' + nf(Aa[1])) },
            { q: '(b) Write $y(n)$ and evaluate $y(2)$.', answers: [ans('$y(2)$', y2)], working: steps([
              'Both terms are causal: $y(n)=' + sumTex([[Aa[0], body(a, 'c')], [Aa[1], body(b, 'c')]]) + '$.',
              'Check: $y(0)=A+B=' + nf(Aa[0] + Aa[1]) + '=x_1(0)x_2(0)$.'
            ]) + fin('y(2)=' + nf(y2)) }
          ],
          meta: { v: v, a: a, b: b, c1: c1 }
        };
      }
      // ring
      var Q = r.retry(function () {
        var a = r.pick(PR) * r.sign(), d = r.pick(PR) * r.sign(), b = r.pick(PO) * r.sign();
        if (Math.abs(Math.abs(a) - Math.abs(d)) < 0.05) return null;
        var c = r.pick([1, 2, -1, -2]);
        var num = [1 - c, c * a - b];
        if (Math.abs(num[0]) < 1e-9 && Math.abs(num[1]) < 1e-9) return null;
        return { a: a, b: b, d: d, c: c, num: num };
      });
      var ps = [Q.a, Q.b, Q.d], As = residues(Q.num, ps);
      var rin = Math.max(Math.abs(Q.a), Math.abs(Q.d)), rout = Math.abs(Q.b);
      var terms = [{ A: As[0], p: Q.a, kind: 'c' }, { A: As[1], p: Q.b, kind: 'a' }, { A: As[2], p: Q.d, kind: 'c' }];
      return {
        stem: 'Use the z-transform to find $y(n)=x_1(n)*x_2(n)$ for ' + $$('x_1(n)=' + sumTex([[1, body(Q.a, 'c')], [Q.c, body(Q.b, 'a')]]) + ',\\qquad x_2(n)=' + body(Q.d, 'c')),
        figure: null,
        parts: [
          { q: '(a) Find $X_1(z)$ as one fraction, and the ROC of $Y(z)$.', answers: [ans('ROC inner radius', rin), ans('ROC outer radius', rout)], working: steps([
            '$X_1(z)=\\dfrac{1}{' + fac(Q.a).slice(1, -1) + '}' + (Q.c > 0 ? '-' : '+') + '\\dfrac{' + nf(Math.abs(Q.c)) + '}{' + fac(Q.b).slice(1, -1) + '}=\\dfrac{' + polyTex(Q.num) + '}{' + fac(Q.a) + fac(Q.b) + '}$, ROC $' + nf(Math.abs(Q.a)) + '<|z|<' + nf(rout) + '$.',
            '$X_2(z)=\\dfrac{1}{' + fac(Q.d).slice(1, -1) + '}$, $|z|>' + nf(Math.abs(Q.d)) + '$.',
            'ROC of $Y$: the intersection, $' + nf(rin) + '<|z|<' + nf(rout) + '$.'
          ]) + fin(rocTex(rin, rout)) },
          { q: '(b) Expand $Y(z)$ in partial fractions. Enter the coefficients for the poles $' + nf(Q.a) + '$, $' + nf(Q.b) + '$ and $' + nf(Q.d) + '$.', answers: [ans('$A_1$ (pole ' + nf(Q.a) + ')', As[0]), ans('$A_2$ (pole ' + nf(Q.b) + ')', As[1]), ans('$A_3$ (pole ' + nf(Q.d) + ')', As[2])], working: steps([$('Y(z)=\\dfrac{' + polyTex(Q.num) + '}{' + fac(Q.a) + fac(Q.b) + fac(Q.d) + '}')].concat(coverLines(Q.num, ps, As)).concat(['Check at $w=0$: $\\sum A_i=' + nf(As[0] + As[1] + As[2]) + '=' + nf(Q.num[0]) + '$.'])) + fin('A_1=' + nf(As[0]) + ',\\ A_2=' + nf(As[1]) + ',\\ A_3=' + nf(As[2])) },
          { q: '(c) Write $y(n)$ and find $y(0)$ and $y(-1)$.', answers: [ans('$y(0)$', seqVal(terms, 0)), ans('$y(-1)$', seqVal(terms, -1))], working: steps([
            'Poles $' + nf(Q.a) + '$ and $' + nf(Q.d) + '$ are inside the ring (causal terms); pole $' + nf(Q.b) + '$ is outside it (anticausal, $-Ap^nu(-n-1)$).',
            $('y(n)=' + sumTex([[As[0], body(Q.a, 'c')], [As[2], body(Q.d, 'c')], [-As[1], body(Q.b, 'a')]]))
          ]) + fin('y(0)=' + nf(seqVal(terms, 0)) + ',\\ y(-1)=' + nf(seqVal(terms, -1))) }
        ],
        meta: { v: v, a: Q.a, b: Q.b, d: Q.d, c: Q.c }
      };
    }
  });

  /* =========================================================================
   * TOPIC invz — inverse z-transform
   * ========================================================================= */
  function denTex(ps, nonmonic) {
    return ps.map(function (p, i) {
      if (nonmonic === i) { var c = 1 / p; return '(' + nf(c) + (p > 0 ? ' - ' : ' + ') + 'z^{-1})'; }
      return fac(p);
    }).join('');
  }
  function rocPick(r, v, ps) {
    var s = sortAbs(ps), n = s.length;
    if (v === 'causal') return { rin: Math.abs(s[n - 1]), rout: Infinity };
    if (v === 'anti') return { rin: 0, rout: Math.abs(s[0]) };
    var k = r.int(1, n - 1);
    return { rin: Math.abs(s[k - 1]), rout: Math.abs(s[k]) };
  }
  function pickN(r, v) {
    if (v === 'causal') return [[0, 2], [1, 3]];
    return v === 'anti' ? [[-1, -2], [-1, -3]] : [[0, -1], [1, -2]];
  }

  QB.add({
    id: 'dsp.z.invz-pf', course: 'dsp', module: 'z', topic: 'invz',
    title: 'Inverse z-transform by partial fractions (distinct poles)', difficulty: 2, marks: 6,
    variants: [{ id: 'causal', label: 'Causal ROC' }, { id: 'anti', label: 'Anticausal ROC' }, { id: 'two', label: 'Two-sided (ring) ROC' }, { id: 'complex', label: 'Complex-conjugate poles, causal', weight: 0.8 }],
    tags: ['T7', 'L08 slide 4', 'exam-style'],
    gen: function (r, v) {
      if (v === 'complex') {
        var rr = r.pick([0.5, 0.6, 0.7071, 0.8, 0.9]), th = r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3, PI / 6]);
        var b0 = r.pick([1, 2, 1, 3]), b1 = r.pick([0, 1, -1, 0.5, 2]);
        var p = C.polar(rr, th * 180 / PI), a1 = -2 * rr * Math.cos(th), a2 = rr * rr;
        var w = p.inv();
        var Ac = cpeval([b0, b1], w).div(C(1, 0).sub(p.conj().mul(w)));
        var mag = Ac.abs(), ang = Ac.arg();
        var h = series([b0, b1], [1, a1, a2], 4);
        return {
          stem: 'Find the causal inverse of ' + $$('H(z)=\\frac{' + polyTex([b0, b1]) + '}{' + polyTex([1, a1, a2]) + '}') + 'as a real closed form.',
          figure: null,
          parts: [
            { q: '(a) Find the poles in polar form.', answers: [ans('pole radius $r$', rr), ans('pole angle $\\theta$', th, { unit: 'rad' })], working: steps([
              'Roots of $p^2' + (a1 >= 0 ? '+' : '-') + nf(Math.abs(a1)) + 'p+' + nf(a2) + '=0$: $p=' + cf(p) + '$ and its conjugate.',
              '$r=\\sqrt{a_2}=' + nf(rr) + '$, $\\theta=' + piT(th) + '$.'
            ]) + fin('p=' + nf(rr) + 'e^{\\pm j' + piT(th) + '}') },
            { q: '(b) Find the partial-fraction coefficient $A$ for $p=re^{j\\theta}$ (its magnitude and angle).', answers: [ans('$|A|$', mag), ans('$\\angle A$', ang, { unit: 'rad', abs: 0.01 })], working: steps([
              'Cover-up with $w=z^{-1}=1/p=' + cf(w) + '$: $A=\\dfrac{' + polyTex([b0, b1]) + '}{1-p^*z^{-1}}\\Big|_{z^{-1}=1/p}$.',
              'Numerator $=' + cf(cpeval([b0, b1], w)) + '$, denominator $1-p^*/p=' + cf(C(1, 0).sub(p.conj().mul(w))) + '$.',
              '$A=' + cf(Ac) + '$, so $|A|=' + nf(mag) + '$ and $\\angle A=' + nf(ang) + '$ rad.'
            ]) + fin('A=' + nf(mag) + 'e^{j' + nf(ang) + '}') },
            { q: '(c) Write $h(n)=2|A|r^n\\cos(\\theta n+\\angle A)u(n)$ and evaluate $h(2)$ and $h(3)$.', answers: [ans('$h(2)$', h[2]), ans('$h(3)$', h[3])], working: steps([
              $('h(n)=' + nf(2 * mag) + '(' + nf(rr) + ')^n\\cos\\!\\left(' + piT(th) + 'n' + (ang >= 0 ? '+' : '-') + nf(Math.abs(ang)) + '\\right)u(n)'),
              'Check against the recursion $h(n)=' + nf(-a1) + 'h(n-1)' + (a2 >= 0 ? '-' : '+') + nf(Math.abs(a2)) + 'h(n-2)+' + nf(b0) + '\\delta(n)' + (b1 ? (b1 > 0 ? '+' : '-') + nf(Math.abs(b1)) + '\\delta(n-1)' : '') + '$: $h(0..3)=' + h.map(function (q) { return nf(q); }).join(',\\ ') + '$.'
            ]) + fin('h(2)=' + nf(h[2]) + ',\\ h(3)=' + nf(h[3])) }
          ],
          notes: QB.callout('trap', 'A real $H(z)$ must give a real $h(n)$. Combine the conjugate pair into one cosine.'),
          meta: { v: v, r: rr, th: th, b: [b0, b1] }
        };
      }
      var np = v === 'two' ? r.pick([2, 3]) : r.pick([2, 2, 3]);
      var ps = pickPoles(r, np, PALL, 1.25);
      var num = [r.pick([1, 2, 3, -1, 4])];
      for (var i = 1; i < np; i++) num.push(r.pick([0, 1, -1, 2, -2, 0.5]));
      while (num.length > 1 && !num[num.length - 1]) num.pop();
      var As = residues(num, ps);
      var nm = -1;
      ps.forEach(function (p, i) { if (nm < 0 && [0.5, 0.25, 0.2].indexOf(Math.abs(p)) >= 0 && r.bool(0.5)) nm = i; });
      var scale = nm >= 0 ? 1 / ps[nm] : 1;
      var shown = num.map(function (c) { return c * scale; });
      var R = rocPick(r, v, ps);
      var terms = ps.map(function (p, i) { return { A: As[i], p: p, kind: kindOf(p, R.rin, R.rout) }; });
      var NN = pickN(r, v)[0];
      var xv = NN.map(function (n) { return seqVal(terms, n); });
      var xT = sumTex(terms.map(function (t) { return [t.kind === 'c' ? t.A : -t.A, body(t.p, t.kind)]; }));
      var pfT = sumTex(ps.map(function (p, i) { return [As[i], '\\frac{1}{' + fac(p).slice(1, -1) + '}']; }));
      var fig = pzFig({ poles: ps, zeros: [], rin: R.rin, rout: R.rout, title: 'Poles and the given ROC' });
      return {
        stem: 'Find $x(n)$ for ' + $$('X(z)=\\frac{' + polyTex(shown) + '}{' + denTex(ps, nm) + '},\\qquad \\text{ROC: }' + rocTex(R.rin, R.rout)),
        figure: null,
        parts: [
          { q: '(a) Expand $X(z)=\\sum_i\\dfrac{A_i}{1-p_iz^{-1}}$. Enter $A_i$ for the poles in the order ' + ps.map(function (p) { return $(nf(p)); }).join(', ') + '.', answers: As.map(function (A, i) { return ans('$A_' + (i + 1) + '$ (pole ' + nf(ps[i]) + ')', A); }), working: steps([
            nm >= 0 ? 'Make every factor monic first: $' + denTex([ps[nm]], 0) + '=' + nf(1 / ps[nm]) + fac(ps[nm]) + '$, so $X(z)=\\dfrac{' + polyTex(num) + '}{' + denTex(ps) + '}$.' : 'The factors are already monic, $(1-p_iz^{-1})$.',
            'Numerator degree ' + (num.length - 1) + ' &lt; denominator degree ' + np + ' in $z^{-1}$: proper, no division needed. Let $w=z^{-1}$.'
          ].concat(coverLines(num, ps, As)).concat(['Check at $w=0$: $\\sum A_i=' + nf(As.reduce(function (s, q) { return s + q; }, 0)) + '=' + nf(num[0]) + '$.'])) + fin('X(z)=' + pfT) },
          { q: '(b) Use the ROC to write $x(n)$, then evaluate $x(' + NN[0] + ')$ and $x(' + NN[1] + ')$.', answers: [ans('$x(' + NN[0] + ')$', xv[0]), ans('$x(' + NN[1] + ')$', xv[1])], working: steps(ps.map(function (p, i) {
            return 'Pole $' + nf(p) + '$: the ROC is ' + (terms[i].kind === 'c' ? 'outside it, causal term $' + nf(As[i]) + pn(p) + 'u(n)$.' : 'inside it, anticausal term $' + nf(-As[i]) + pn(p) + 'u(-n-1)$.');
          }).concat([$('x(n)=' + xT), '$x(' + NN[0] + ')=' + nf(xv[0]) + '$, $x(' + NN[1] + ')=' + nf(xv[1]) + '$.'])) + fin('x(n)=' + xT) + '<div class="qb-fig">' + fig + '</div>' }
        ],
        notes: QB.callout('trap', 'Causal or anticausal is decided by each pole against the <b>ROC</b>, not against the unit circle. The anticausal term carries a minus sign and $u(-n-1)$.'),
        meta: { v: v, ps: ps, num: num, rin: R.rin, rout: R.rout === Infinity ? -1 : R.rout, NN: NN }
      };
    }
  });

  QB.add({
    id: 'dsp.z.invz-repeated', course: 'dsp', module: 'z', topic: 'invz',
    title: 'Inverse z-transform with a repeated pole', difficulty: 3, marks: 6,
    variants: [{ id: 'causal', label: 'Causal ROC' }, { id: 'anti', label: 'Anticausal ROC' }, { id: 'two', label: 'Two-sided ROC' }],
    tags: ['D8 Ex 3(a)', '(n+1)p^n'],
    gen: function (r, v) {
      var P = pickPoles(r, 2, PALL, 1.3), p = P[0], q = P[1];
      var num = [r.pick([1, 2, 3, -1]), r.pick([0, 0, 1, -1, 0.5])];
      if (!num[1]) num.pop();
      var A2 = peval(num, 1 / p) / (1 - q / p), Cq = peval(num, 1 / q) / Math.pow(1 - p / q, 2), A1 = num[0] - A2 - Cq;
      var R;
      if (v === 'causal') R = { rin: Math.max(Math.abs(p), Math.abs(q)), rout: Infinity };
      else if (v === 'anti') R = { rin: 0, rout: Math.min(Math.abs(p), Math.abs(q)) };
      else R = { rin: Math.min(Math.abs(p), Math.abs(q)), rout: Math.max(Math.abs(p), Math.abs(q)) };
      var kp = kindOf(p, R.rin, R.rout), kq = kindOf(q, R.rin, R.rout);
      var terms = [{ A: A1, p: p, kind: kp }, { A: A2, p: p, kind: kp, mult: 2 }, { A: Cq, p: q, kind: kq }];
      var NN = pickN(r, v)[1];
      var xv = NN.map(function (n) { return seqVal(terms, n); });
      var sg = function (k, A) { return k === 'c' ? A : -A; };
      var xT = sumTex([[sg(kp, A1), body(p, kp)], [sg(kp, A2), body(p, kp, 2)], [sg(kq, Cq), body(q, kq)]]);
      return {
        stem: 'Find $x(n)$ for ' + $$('X(z)=\\frac{' + polyTex(num) + '}{' + fac(p) + '^2' + fac(q) + '},\\qquad\\text{ROC: }' + rocTex(R.rin, R.rout)),
        figure: null,
        parts: [
          { q: '(a) Expand $X(z)=\\dfrac{A_1}{1-' + cfp(p) + 'z^{-1}}+\\dfrac{A_2}{(1-' + cfp(p) + 'z^{-1})^2}+\\dfrac{C}{1-' + cfp(q) + 'z^{-1}}$.', answers: [ans('$A_1$', A1), ans('$A_2$', A2), ans('$C$', Cq)], working: steps([
            'Let $w=z^{-1}$. $A_2$ by cover-up of the squared factor at $w=1/p=' + nf(1 / p) + '$: $A_2=\\dfrac{' + nf(peval(num, 1 / p)) + '}{1-' + cfp(q) + '(' + nf(1 / p) + ')}=' + nf(A2) + '$.',
            '$C$ at $w=1/q=' + nf(1 / q) + '$: $C=\\dfrac{' + nf(peval(num, 1 / q)) + '}{(1-' + cfp(p) + '(' + nf(1 / q) + '))^2}=' + nf(Cq) + '$.',
            '$A_1$ from $w=0$: $' + nf(num[0]) + '=A_1+A_2+C$, so $A_1=' + nf(A1) + '$.'
          ]) + fin('A_1=' + nf(A1) + ',\\ A_2=' + nf(A2) + ',\\ C=' + nf(Cq)) },
          { q: '(b) Write $x(n)$ and evaluate $x(' + NN[0] + ')$ and $x(' + NN[1] + ')$.', answers: [ans('$x(' + NN[0] + ')$', xv[0]), ans('$x(' + NN[1] + ')$', xv[1])], working: steps([
            'Pairs: $\\frac{1}{(1-pz^{-1})^2}\\leftrightarrow (n+1)p^nu(n)$ (causal) or $-(n+1)p^nu(-n-1)$ (anticausal).',
            'Pole $' + nf(p) + '$ (double): ' + (kp === 'c' ? 'ROC outside, causal.' : 'ROC inside, anticausal.') + ' Pole $' + nf(q) + '$: ' + (kq === 'c' ? 'causal.' : 'anticausal.'),
            $('x(n)=' + xT)
          ]) + fin('x(' + NN[0] + ')=' + nf(xv[0]) + ',\\ x(' + NN[1] + ')=' + nf(xv[1])) }
        ],
        notes: QB.callout('trap', '$\\frac{1}{(1-pz^{-1})^2}\\to(n+1)p^n$, not $np^n$.'),
        meta: { v: v, p: p, q: q, num: num, NN: NN }
      };
    }
  });

  QB.add({
    id: 'dsp.z.invz-improper', course: 'dsp', module: 'z', topic: 'invz',
    title: 'Improper X(z): divide first, then partial fractions', difficulty: 2, marks: 6,
    variants: [{ id: 'causal', label: 'Causal ROC' }, { id: 'two', label: 'Two-sided ROC' }, { id: 'anti', label: 'Anticausal ROC' }],
    tags: ['T8 Q5(c)', 'b_N/a_N'],
    gen: function (r, v) {
      var np = v === 'two' ? 2 : r.pick([1, 2, 2]);
      var ps = np === 2 ? pickPoles(r, 2, PALL, 1.3) : [r.pick(PALL) * r.sign()];
      var num = r.retry(function () {
        var n = [1]; for (var i = 0; i < np; i++) n.push(r.pick([1, -1, 2, -2, 0.5, -0.5, 0.64, 1.5]));
        for (i = 0; i < np; i++) if (Math.abs(peval(n, 1 / ps[i])) < 1e-6) return null;
        return n;
      });
      var den = pfromRoots(ps);
      var K = num[np] / den[np];
      var As = residues(num, ps);   // cover-up on the full fraction works (constant vanishes)
      var R = rocPick(r, v, ps);
      var terms = ps.map(function (p, i) { return { A: As[i], p: p, kind: kindOf(p, R.rin, R.rout) }; });
      terms.push({ kind: 'd', A: K, k: 0 });
      var NN = v === 'causal' ? [0, 1] : v === 'anti' ? [0, -1] : [0, -1];
      var xv = NN.map(function (n) { return seqVal(terms, n); });
      var xT = sumTex([[K, '\\delta(n)']].concat(ps.map(function (p, i) { return [terms[i].kind === 'c' ? As[i] : -As[i], body(p, terms[i].kind)]; })));
      return {
        stem: 'Find $h(n)$ for ' + $$('H(z)=\\frac{' + polyTex(num) + '}{' + polyTex(den) + '},\\qquad\\text{ROC: }' + rocTex(R.rin, R.rout)),
        figure: null,
        parts: [
          { q: '(a) The numerator and denominator have the same degree in $z^{-1}$. Find the constant $K$ from the division and the partial-fraction coefficients.', answers: [ans('$K$', K)].concat(As.map(function (A, i) { return ans('$A_' + (i + 1) + '$ (pole ' + nf(ps[i]) + ')', A); })), working: steps([
            'Factor: $' + polyTex(den) + '=' + ps.map(function (p) { return fac(p); }).join('') + '$.',
            '$M=N=' + np + '$, so the quotient is a constant: the ratio of the <b>highest</b>-power coefficients, $K=' + nf(num[np]) + '/' + nf(den[np]) + '=' + nf(K) + '$.',
            'Cover-up on the full fraction (the constant vanishes when multiplied by $(1-p_iz^{-1})$ at $z^{-1}=1/p_i$):'
          ].concat(coverLines(num, ps, As)).concat(['Check at $w=0$: $K+\\sum A_i=' + nf(K + As.reduce(function (s, q) { return s + q; }, 0)) + '=1$.'])) + fin('K=' + nf(K) + ',\\ ' + As.map(function (A, i) { return 'A_' + (i + 1) + '=' + nf(A); }).join(',\\ ')) },
          { q: '(b) Write $h(n)$ and evaluate $h(' + NN[0] + ')$ and $h(' + NN[1] + ')$.', answers: [ans('$h(' + NN[0] + ')$', xv[0]), ans('$h(' + NN[1] + ')$', xv[1])], working: steps([
            '$K\\leftrightarrow K\\delta(n)$. ' + ps.map(function (p, i) { return 'Pole $' + nf(p) + '$: ' + (terms[i].kind === 'c' ? 'causal.' : 'anticausal.'); }).join(' '),
            $('h(n)=' + xT)
          ]) + fin('h(' + NN[0] + ')=' + nf(xv[0]) + ',\\ h(' + NN[1] + ')=' + nf(xv[1])) }
        ],
        notes: QB.callout('trap', 'The constant is $b_N/a_N$ (highest powers), not the ratio of the constant terms. Forgetting it loses the $\\delta(n)$ term.'),
        meta: { v: v, ps: ps, num: num, rin: R.rin, rout: R.rout === Infinity ? -1 : R.rout, NN: NN }
      };
    }
  });

  QB.add({
    id: 'dsp.z.invz-longdiv', course: 'dsp', module: 'z', topic: 'invz',
    title: 'Power series by long division', difficulty: 2, marks: 3,
    variants: [{ id: 'causal', label: 'Causal: ascending powers of z⁻¹' }, { id: 'left', label: 'Left-sided: ascending powers of z' }],
    tags: ['L08 slide 5', 'D8 Q1'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var a1 = r.pick([-1, -0.5, 0.5, 1, -1.5, 0.25, -0.75]), a2 = r.pick([0.5, 0.25, -0.5, 0.75, -0.25, 0.125]);
        var ps = poles2(a1, a2); var mn = Math.min(ps[0].abs(), ps[1].abs()), mx = Math.max(ps[0].abs(), ps[1].abs());
        if (mn < 0.1) return null;
        var M = r.pick([1, 1, 2]);
        var b = [r.pick([1, 2, -1]), r.pick([1, 2, -1, 0.5, 3])]; if (M === 2) b.push(r.pick([1, -1, 0.5]));
        return { a1: a1, a2: a2, b: b, mn: mn, mx: mx, ps: ps };
      });
      var den = [1, P.a1, P.a2], vals, idx, work;
      if (v === 'causal') {
        vals = series(P.b, den, 4); idx = [0, 1, 2, 3];
        var rem = P.b.slice(), lines = [];
        while (rem.length < 7) rem.push(0);
        for (var k = 0; k < 4; k++) {
          var q = rem[k];
          for (var j = 0; j < 3; j++) rem[k + j] -= q * den[j];
          lines.push('Quotient term $' + (q < 0 ? '-' : '') + nf(Math.abs(q)) + zi(k) + '$; remainder $' + polyTex(cl(rem.slice(k + 1, k + 3)), zi, k + 1) + '$.');
        }
        work = steps(['Causal ROC $|z|>' + nf(P.mx) + '$: divide in ascending powers of $z^{-1}$. Each quotient term $c\\,z^{-n}$ gives $x(n)=c$.'].concat(lines).concat(['Check by recursion: $x(n)=b_n-(' + nf(P.a1) + ')x(n-1)-(' + nf(P.a2) + ')x(n-2)$ gives the same numbers.']));
      } else {
        // u = z: X = (b0 u^2 + b1 u + b2)/(u^2 + a1 u + a2) -> ascending u: num [b2|0, b1, b0], den [a2, a1, 1]
        var nu = [P.b.length > 2 ? P.b[2] : 0, P.b[1], P.b[0]];
        var cs = series(nu, [P.a2, P.a1, 1], 4);
        vals = cs; idx = [0, -1, -2, -3];
        work = steps([
          'Left-sided ROC $|z|<' + nf(P.mn) + '$: write both polynomials starting from the highest power of $z^{-1}$ and divide; quotient terms are powers of $z$.',
          'In $u=z$: $X=\\dfrac{' + polyTex(nu, function (k) { return k === 0 ? '' : k === 1 ? 'z' : 'z^{' + k + '}'; }) + '}{' + polyTex([P.a2, P.a1, 1], function (k) { return k === 0 ? '' : k === 1 ? 'z' : 'z^{' + k + '}'; }) + '}$ (top and bottom multiplied by $z^2$).',
          'Divide by the lowest power of $z$ first: quotient $' + polyTex(cs, function (k) { return k === 0 ? '' : k === 1 ? 'z' : 'z^{' + k + '}'; }) + '+\\cdots$',
          'The coefficient of $z^{m}$ is $x(-m)$.'
        ]);
      }
      return {
        stem: 'Use long division to find the first samples of $x(n)$ for ' + $$('X(z)=\\frac{' + polyTex(P.b) + '}{' + polyTex(den) + '},\\qquad\\text{ROC: }' + (v === 'causal' ? '|z|>' + nf(P.mx) : '|z|<' + nf(P.mn))),
        figure: null,
        parts: [
          { q: '(a) Find ' + idx.map(function (n) { return '$x(' + n + ')$'; }).join(', ') + '.', answers: idx.map(function (n, i) { return ans('$x(' + n + ')$', vals[i]); }), working: work + fin(idx.map(function (n, i) { return 'x(' + n + ')=' + nf(vals[i]); }).join(',\\ ')) }
        ],
        notes: QB.callout('tip', 'Long division gives numbers, not a closed form. Use it to check a partial-fraction answer.'),
        meta: { v: v, b: P.b, a: den }
      };
    }
  });

  QB.add({
    id: 'dsp.z.invz-allroc', course: 'dsp', module: 'z', topic: 'invz',
    title: 'All possible signals for one X(z), and the absolutely summable one', difficulty: 2, marks: 7,
    variants: [{ id: 'p2', label: 'Two poles (3 ROCs)' }, { id: 'p3', label: 'Three poles (4 ROCs)' }],
    tags: ['T7 Q1', 'T7 Q2', 'DX2 Q6', 'exam-style'],
    gen: function (r, v) {
      var np = v === 'p2' ? 2 : 3;
      var ps = r.retry(function () { var s = pickPoles(r, np, PALL, 1.25); var inn = s.filter(function (p) { return Math.abs(p) < 1; }).length; return (inn > 0 && inn < np) || r.bool(0.2) ? s : null; });
      ps = sortAbs(ps);
      var num = [r.pick([1, 2, 3, -1])]; for (var i = 1; i < np; i++) num.push(r.pick([0, 1, -1, 2, 0.5]));
      while (num.length > 1 && !num[num.length - 1]) num.pop();
      var As = residues(num, ps);
      var rad = ps.map(Math.abs);
      var rows = [], stab = null;
      for (var k = 0; k <= np; k++) {
        var rin = k === 0 ? 0 : rad[k - 1], rout = k === np ? Infinity : rad[k];
        var terms = ps.map(function (p, j) { return { A: As[j], p: p, kind: j < k ? 'c' : 'a' }; });
        var xT = sumTex(terms.map(function (t) { return [t.kind === 'c' ? t.A : -t.A, body(t.p, t.kind)]; }));
        var typ = k === np ? 'causal' : k === 0 ? 'anticausal' : 'two-sided';
        var st = rin < 1 && rout > 1;
        if (st) stab = { k: k, terms: terms, rin: rin, rout: rout, typ: typ };
        rows.push([$(rocTex(rin, rout)), $(xT), typ + (st ? ', <b>stable</b>' : '')]);
      }
      var x0 = seqVal(stab.terms, 0), xm1 = seqVal(stab.terms, -1);
      return {
        stem: 'Determine all possible signals $x(n)$ with ' + $$('X(z)=\\frac{' + polyTex(num) + '}{' + ps.map(function (p) { return fac(p); }).join('') + '}') + 'and identify the one that is absolutely summable.',
        figure: pzFig({ poles: ps, zeros: [], title: 'Pole positions' }),
        parts: [
          { q: '(a) Expand in partial fractions (poles in the order ' + ps.map(function (p) { return $(nf(p)); }).join(', ') + ') and state how many ROCs are possible.', answers: As.map(function (A, j) { return ans('$A_' + (j + 1) + '$ (pole ' + nf(ps[j]) + ')', A); }).concat([ansInt('number of ROCs', np + 1)]), working: steps(coverLines(num, ps, As).concat(['$' + np + '$ poles at distinct radii give $' + (np + 1) + '$ rings, so $' + (np + 1) + '$ possible signals (other sign combinations have an empty ROC).'])) + fin(sumTex(ps.map(function (p, j) { return [As[j], '\\frac{1}{' + fac(p).slice(1, -1) + '}']; }))) },
          { q: '(b) List every ROC with its $x(n)$. For the absolutely summable one, find $x(0)$ and $x(-1)$.', answers: [ans('$x(0)$', x0), ans('$x(-1)$', xm1)], working: QB.tbl(['ROC', '$x(n)$', 'type'], rows) + steps([
            'Absolutely summable means the ROC contains $|z|=1$: that is $' + rocTex(stab.rin, stab.rout) + '$ (' + stab.typ + ').',
            '$x(0)=' + nf(x0) + '$ and $x(-1)=' + nf(xm1) + '$.'
          ]) + fin(rocTex(stab.rin, stab.rout) + ':\\ x(0)=' + nf(x0) + ',\\ x(-1)=' + nf(xm1)) }
        ],
        notes: QB.callout('trap', '$N$ distinct pole radii give $N+1$ ROCs, not $2^N$. Only the ring containing $|z|=1$ is stable.'),
        meta: { v: v, ps: ps, num: num }
      };
    }
  });

  /* =========================================================================
   * TOPIC stab — transfer function, causality and stability
   * ========================================================================= */
  QB.add({
    id: 'dsp.z.stab-decide', course: 'dsp', module: 'z', topic: 'stab',
    title: 'Causal? Stable? Decide from the poles and the ROC', difficulty: 1, marks: 4,
    variants: [{ id: 'roc', label: 'ROC given' }, { id: 'causal', label: '"The system is causal"' }, { id: 'stable', label: '"The system is stable"' }, { id: 'complex', label: 'Complex poles, causal' }],
    tags: ['L08 slide 8', 'DX1 Q5(c)'],
    gen: function (r, v) {
      var ps, den, num = [1, r.pick([0, 1, 0.5, -1, 2])];
      if (v === 'complex') {
        var rr = r.pick([0.5, 0.8, 0.9, 1.2, 1.5, 0.95]), th = r.pick(W0);
        var a1 = -2 * rr * Math.cos(th), a2 = rr * rr;
        den = [1, a1, a2]; ps = [C.polar(rr, th * 180 / PI), C.polar(rr, -th * 180 / PI)];
        var st = rr < 1;
        return {
          stem: 'A causal system has ' + $$('H(z)=\\frac{' + polyTex(num) + '}{' + polyTex(den) + '}'),
          figure: null,
          parts: [{ q: '(a) Find the pole radius and angle, and decide whether the system is stable.', answers: [ans('pole radius', rr), ans('pole angle', th, { unit: 'rad' }), flag('stable? (1/0)', st)], working: steps([
            'Poles: $p^2' + (a1 >= 0 ? '+' : '-') + nf(Math.abs(a1)) + 'p+' + nf(a2) + '=0$, so $|p|=\\sqrt{' + nf(a2) + '}=' + nf(rr) + '$ and $\\angle p=\\pm' + piT(th) + '$.',
            'Causal: ROC $|z|>' + nf(rr) + '$. ' + (st ? 'It contains $|z|=1$ (both poles inside): stable.' : 'It misses $|z|=1$: unstable.')
          ]) + fin(st ? '\\text{stable}' : '\\text{unstable}') + '<div class="qb-fig">' + pzFig({ poles: ps, zeros: [0, -num[1]], rin: rr, title: 'Causal ROC' }) + '</div>' }],
          meta: { v: v, r: rr, th: th }
        };
      }
      ps = sortAbs(r.retry(function () { var s = pickPoles(r, 2, PALL, 1.25); return (Math.abs(s[0]) < 1) !== (Math.abs(s[1]) < 1) || r.bool(0.3) ? s : null; }));
      den = pfromRoots(ps);
      var rad = ps.map(Math.abs);
      var R;
      if (v === 'roc') { var k = r.int(0, 2); R = { rin: k === 0 ? 0 : rad[k - 1], rout: k === 2 ? Infinity : rad[k] }; }
      else if (v === 'causal') R = { rin: rad[1], rout: Infinity };
      else { R = rad[1] < 1 ? { rin: rad[1], rout: Infinity } : rad[0] > 1 ? { rin: 0, rout: rad[0] } : { rin: rad[0], rout: rad[1] }; }
      var causal = R.rout === Infinity, stable = R.rin < 1 && R.rout > 1;
      var anti = R.rin === 0;
      var dWord = causal ? 'causal' : anti ? 'anticausal' : 'two-sided (noncausal)';
      var given = v === 'roc' ? 'with ROC $' + rocTex(R.rin, R.rout) + '$' : v === 'causal' ? 'and the system is known to be <b>causal</b>' : 'and the system is known to be <b>stable</b>';
      var parts = [];
      parts.push({ q: '(a) Find the pole magnitudes (smaller first).', answers: [ans('$|p_1|$', rad[0]), ans('$|p_2|$', rad[1])], working: steps([
        'Factor the denominator: $' + polyTex(den) + '=' + fac(ps[0]) + fac(ps[1]) + '$, poles $' + nf(ps[0]) + '$ and $' + nf(ps[1]) + '$.'
      ]) + fin('|p_1|=' + nf(rad[0]) + ',\\ |p_2|=' + nf(rad[1])) });
      var pa = [flag('causal? (1/0)', causal), flag('stable? (1/0)', stable)];
      if (v === 'stable') { if (R.rin > 0) pa.push(ans('ROC inner radius', R.rin)); if (isFinite(R.rout)) pa.push(ans('ROC outer radius', R.rout)); }
      parts.push({ q: '(b) ' + (v === 'stable' ? 'Give the ROC. ' : v === 'causal' ? 'Give the ROC. ' : '') + 'Is the system causal? Is it stable?', answers: pa, working: steps([
        v === 'causal' ? 'Causal means the ROC is outside the outermost pole: $|z|>' + nf(rad[1]) + '$.' : v === 'stable' ? 'Stable means the ROC contains $|z|=1$. The only ring that does is $' + rocTex(R.rin, R.rout) + '$.' : 'The ROC is $' + rocTex(R.rin, R.rout) + '$.',
        'Causal needs the exterior of a circle (including $\\infty$); this ROC is ' + dWord + '.',
        'Stable needs $|z|=1$ in the ROC: ' + (stable ? 'yes.' : 'no.')
      ]) + fin('\\text{' + dWord + ', ' + (stable ? 'stable' : 'unstable') + '}') + '<div class="qb-fig">' + pzFig({ poles: ps, zeros: [0, -num[1]], rin: R.rin, rout: R.rout, title: 'Poles and ROC' }) + '</div>' });
      return {
        stem: 'An LTI system has ' + $$('H(z)=\\frac{' + polyTex(num) + '}{' + polyTex(den) + '}') + given + '.',
        figure: null, parts: parts,
        notes: QB.callout('trap', 'Stability depends on the ROC, not on the pole positions alone. Causal <b>and</b> stable needs every pole inside the unit circle.'),
        meta: { v: v, ps: ps, rin: R.rin, rout: R.rout === Infinity ? -1 : R.rout }
      };
    }
  });

  QB.add({
    id: 'dsp.z.stab-sysid', course: 'dsp', module: 'z', topic: 'stab',
    title: 'System identification from an input–output pair', difficulty: 2, marks: 8,
    variants: [{ id: 'stable', label: 'Causal and stable' }, { id: 'unstable', label: 'Causal but unstable' }],
    tags: ['T7 Q3', 'D8 Q4', 'exam-style'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var al = r.pick(PR) * r.sign(), d = r.pick(PR) * r.sign();
        var c = v === 'stable' ? r.pick(PR) * r.sign() : r.pick(PO) * r.sign();
        if (Math.abs(al - c) < 0.05 || Math.abs(al - d) < 0.05 || Math.abs(Math.abs(c) - Math.abs(d)) < 0.05) return null;
        return { al: al, c: c, d: d };
      });
      var al = P.al, c = P.c, d = P.d;
      var num = [1, -al], den = pfromRoots([c, d]);
      var As = residues(num, [c, d]);
      var h1 = As[0] * c + As[1] * d;
      var st = Math.abs(c) < 1;
      var xT = body(al, 'c') + (c > 0 ? ' - ' : ' + ') + nf(Math.abs(c)) + '(' + nf(al) + ')^{n-1}u(n-1)';
      var parts = [
        { q: '(a) Find $H(z)=\\dfrac{1+b_1z^{-1}}{1+a_1z^{-1}+a_2z^{-2}}$ and the difference equation.', answers: [ans('$b_1$', -al), ans('$a_1$', den[1]), ans('$a_2$', den[2])], working: steps([
          'Delay property on the second term of $x(n)$: $X(z)=\\dfrac{1}{' + fac(al).slice(1, -1) + '}' + (c > 0 ? '-' : '+') + '\\dfrac{' + nf(Math.abs(c)) + 'z^{-1}}{' + fac(al).slice(1, -1) + '}=\\dfrac{' + fac(c).slice(1, -1) + '}{' + fac(al).slice(1, -1) + '}$.',
          '$Y(z)=\\dfrac{1}{' + fac(d).slice(1, -1) + '}$.',
          $$('H(z)=\\frac{Y}{X}=\\frac{' + fac(al).slice(1, -1) + '}{' + fac(c) + fac(d) + '}=\\frac{' + polyTex(num) + '}{' + polyTex(den) + '}'),
          'Cross-multiply: $y(n)' + sumTex([[den[1], 'y(n-1)'], [den[2], 'y(n-2)']]).replace(/^([^-])/, '+$1') + '=x(n)' + (al > 0 ? '-' : '+') + nf(Math.abs(al)) + 'x(n-1)$.'
        ]) + fin('b_1=' + nf(-al) + ',\\ a_1=' + nf(den[1]) + ',\\ a_2=' + nf(den[2])) },
        { q: '(b) The system is causal. Find $h(n)=A\\,(' + nf(c) + ')^nu(n)+B\\,(' + nf(d) + ')^nu(n)$ and $h(1)$. Is it stable?', answers: [ans('$A$', As[0]), ans('$B$', As[1]), ans('$h(1)$', h1), flag('stable? (1/0)', st)], working: steps(coverLines(num, [c, d], As).concat([
          'Causal: ROC $|z|>' + nf(Math.max(Math.abs(c), Math.abs(d))) + '$, every term causal. $h(1)=' + nf(As[0]) + '(' + nf(c) + ')+' + '(' + nf(As[1]) + ')(' + nf(d) + ')=' + nf(h1) + '$ (recursion: $h(1)=-a_1+b_1=' + nf(-den[1] - al) + '$).',
          st ? 'Both poles inside the unit circle: stable.' : 'The pole at $' + nf(c) + '$ is outside the unit circle, so the causal ROC misses $|z|=1$: unstable.'
        ])) + fin('h(n)=' + sumTex([[As[0], body(c, 'c')], [As[1], body(d, 'c')]])) }
      ];
      if (v === 'unstable') {
        var rin = Math.abs(d), rout = Math.abs(c);
        parts.push({ q: '(c) Another system obeys the same difference equation but is stable. Find its ROC and $h(-1)$. Is it causal?', answers: [ans('ROC inner radius', rin), ans('ROC outer radius', rout), ans('$h(-1)$', -As[0] / c), flag('causal? (1/0)', false)], working: steps([
          'Stable: the ROC must contain $|z|=1$, so $' + nf(rin) + '<|z|<' + nf(rout) + '$.',
          'The pole at $' + nf(c) + '$ is outside the ring: anticausal term $-' + cfp(As[0]) + '(' + nf(c) + ')^nu(-n-1)$.',
          '$h(-1)=-A(' + nf(c) + ')^{-1}=' + nf(-As[0] / c) + '$. Two-sided, so not causal.'
        ]) + fin('h(n)=' + sumTex([[-As[0], body(c, 'a')], [As[1], body(d, 'c')]])) });
      } else {
        var H1 = peval(num, 1) / peval(den, 1);
        parts.push({ q: '(c) A unit step is applied to this system (initially at rest). What value does the output settle to?', answers: [ans('$y(\\infty)$', H1)], working: steps(['The system is stable, so the step response settles to the DC gain $H(1)=\\dfrac{' + nf(peval(num, 1)) + '}{' + nf(peval(den, 1)) + '}=' + nf(H1) + '$.']) + fin('y(\\infty)=' + nf(H1)) });
      }
      return {
        stem: 'A <b>causal</b> LTI system produces the output $y(n)=' + body(d, 'c') + '$ in response to the input ' + $$('x(n)=' + xT),
        figure: null, parts: parts,
        meta: { v: v, al: al, c: c, d: d }
      };
    }
  });

  QB.add({
    id: 'dsp.z.stab-lccde', course: 'dsp', module: 'z', topic: 'stab',
    title: 'LCCDE to H(z): system type, poles and stability', difficulty: 1, marks: 5,
    variants: [{ id: 'arma', label: 'Pole-zero (ARMA)' }, { id: 'ar', label: 'All-pole (AR), terms on the right' }, { id: 'fir', label: 'FIR (MA)' }],
    tags: ['D8 Q2', 'L08 slides 9-11'],
    gen: function (r, v) {
      var stem, parts, meta = { v: v }, b, a, fig;
      if (v === 'fir') {
        var c = r.pick([0.9, 0.8, 0.5, 0.125, 0.64, 0.81, 0.25]), k = r.pick([2, 3, 4]);
        b = [1]; for (var i = 1; i < k; i++) b.push(0); b.push(-c);
        var zr = Math.pow(c, 1 / k);
        meta.c = c; meta.k = k;
        var zs = []; for (i = 0; i < k; i++) zs.push(C.polar(zr, 360 * i / k));
        var hk = [1]; for (i = 1; i < k; i++) hk.push(0);
        return {
          stem: 'A causal system is $y(n)=x(n)-' + nf(c) + 'x(n-' + k + ')$.',
          figure: null,
          parts: [
            { q: '(a) Find the radius of its zeros and the number of poles at $z=0$.', answers: [ans('zero radius', zr), ansInt('poles at $z=0$', k)], working: steps([
              '$H(z)=1-' + nf(c) + 'z^{-' + k + '}=\\dfrac{z^{' + k + '}-' + nf(c) + '}{z^{' + k + '}}$.',
              'Zeros: $z^{' + k + '}=' + nf(c) + '$, so $' + k + '$ zeros at radius $' + nf(c) + '^{1/' + k + '}=' + nf(zr) + '$, angles $2\\pi m/' + k + '$. A ' + k + 'th-order pole at the origin.'
            ]) + fin('|z_m|=' + nf(zr)) + '<div class="qb-fig">' + pzFig({ poles: hk.map(function () { return 0; }), zeros: zs, title: 'FIR pole-zero plot' }) + '</div>' },
            { q: '(b) Classify the system and decide stability. Give $h(' + k + ')$.', answers: [flag('stable? (1/0)', true), ans('$h(' + k + ')$', -c)], working: steps(['FIR (all-zero, moving average): its only poles are at $z=0$, so it is always stable.', '$h(n)$ is the coefficient list: $h(' + k + ')=' + nf(-c) + '$.']) + fin('\\text{FIR, stable},\\ h(' + k + ')=' + nf(-c)) }
          ],
          meta: meta
        };
      }
      var P = r.retry(function () {
        var s;
        if (v === 'ar' && r.bool(0.5)) { var q = r.pick([0.25, 0.81, 0.64, 0.9, 0.49, 1.44, -0.25, -0.81]); s = { a: [1, 0, -q], form: 'pure', q: q }; }
        else { var pp = pickPoles(r, 2, PR.concat([1.25, -1.25, 1.5, -1.5]), 1.25); s = { a: pfromRoots(pp) }; }
        var ps = poles2(s.a[1], s.a[2]); s.ps = ps; s.m = Math.max(ps[0].abs(), ps[1].abs());
        if (Math.abs(s.m - 1) < 0.04) return null;
        return s;
      });
      a = cl(P.a);
      b = v === 'arma' ? [r.pick([1, 2]), r.pick([1, -1, 0.5, 2])] : [1];
      var h = series(b, a, 3);
      var st = P.m < 1;
      var lhs = lhsY(a);
      var rhs = polyTex(b, function (k) { return k === 0 ? 'x(n)' : 'x(n-' + k + ')'; });
      var eq = v === 'ar' ? 'y(n)=' + sumTex([[-a[1], 'y(n-1)'], [-a[2], 'y(n-2)'], [b[0], 'x(n)']]) : lhs + '=' + rhs;
      meta.a = a; meta.b = b;
      return {
        stem: 'A causal system is described by ' + $$(eq),
        figure: null,
        parts: [
          { q: '(a) Find $H(z)$ with denominator $1+a_1z^{-1}+a_2z^{-2}$.', answers: [ans('$a_1$', a[1]), ans('$a_2$', a[2])], working: steps([
            v === 'ar' ? 'Move every $y$ term to the left first: $' + lhs + '=' + rhs + '$.' : 'All $y$ terms are already on the left.',
            'Transform term by term: $Y(z)(' + polyTex(a) + ')=X(z)(' + polyTex(b) + ')$.',
            $$('H(z)=\\frac{' + polyTex(b) + '}{' + polyTex(a) + '}')
          ]) + fin('a_1=' + nf(a[1]) + ',\\ a_2=' + nf(a[2])) + '<div class="qb-fig">' + dfFig(b, a, 'II') + '</div>' },
          { q: '(b) Classify the system, find the largest pole magnitude and decide stability.', answers: [ans('largest $|p|$', P.m), flag('stable? (1/0)', st)], working: steps([
            (v === 'ar' ? 'All-pole (AR): numerator is a constant, so there is a double zero at $z=0$.' : 'Pole-zero (ARMA).'),
            'Poles: $' + cf(P.ps[0]) + '$ and $' + cf(P.ps[1]) + '$, so $\\max|p|=' + nf(P.m) + '$.',
            'Causal: ' + (st ? 'all poles inside $|z|=1$, stable.' : 'a pole outside $|z|=1$, unstable.')
          ]) + fin(st ? '\\text{stable}' : '\\text{unstable}') },
          { q: '(c) Find $h(0)$, $h(1)$ and $h(2)$ by recursion.', answers: [ans('$h(0)$', h[0]), ans('$h(1)$', h[1]), ans('$h(2)$', h[2])], working: steps([
            'Set $x(n)=\\delta(n)$ with the system at rest: $h(n)=' + sumTex([[-a[1], 'h(n-1)'], [-a[2], 'h(n-2)']]) + '+' + polyTex(b, function (k) { return k === 0 ? '\\delta(n)' : '\\delta(n-' + k + ')'; }) + '$.',
            '$h(0)=' + nf(h[0]) + '$, $h(1)=' + nf(h[1]) + '$, $h(2)=' + nf(h[2]) + '$.'
          ]) + fin('h(0..2)=' + h.map(function (q) { return nf(q); }).join(',\\ ')) }
        ],
        notes: QB.callout('trap', '$y(n)=0.9y(n-2)+x(n)$ gives the denominator $1-0.9z^{-2}$: move the $y$ terms across before reading coefficients.'),
        meta: meta
      };
    }
  });

  /* =========================================================================
   * TOPIC unilat — unilateral z-transform and initial conditions
   * ========================================================================= */
  function inputX(r, kind, avoid) {
    if (kind === 'step') return { num: [1], poles: [1], tex: 'u(n)', X: '\\dfrac{1}{1-z^{-1}}', g: 1, d: 1 };
    if (kind === 'impulse') return { num: [1], poles: [], tex: '\\delta(n)', X: '1', g: 1, d: null };
    var d = r.retry(function () { var t = r.pick([0.5, 0.25, -0.5, 0.2, 0.4, -0.25, 0.8, 0.6]); return avoid.every(function (p) { return Math.abs(p - t) > 0.04; }) ? t : null; });
    var g = r.pick([1, 1, 2, 3]);
    return { num: [g], poles: [d], tex: (g === 1 ? '' : nf(g)) + body(d, 'c'), X: '\\dfrac{' + nf(g) + '}{' + fac(d).slice(1, -1) + '}', g: g, d: d };
  }

  QB.add({
    id: 'dsp.z.unilat-first', course: 'dsp', module: 'z', topic: 'unilat',
    title: 'First-order LCCDE with an initial condition', difficulty: 1, marks: 4,
    variants: [{ id: 'step', label: 'Step input' }, { id: 'exp', label: 'Exponential input' }, { id: 'impulse', label: 'Impulse input' }],
    tags: ['D9 Q1', 'L08 slide 13'],
    gen: function (r, v) {
      var a = r.pick([0.5, -0.5, 0.25, 0.8, 0.6, -0.4, 0.9]), b = r.pick([1, 1, 2, 0.5]), c = r.pick([1, 2, 4, -2, -1, 3]);
      var X = inputX(r, v, [a, 1]);
      var zi = a * c;                          // coefficient of a^n in y_zi
      var zsNum = X.num.map(function (q) { return q * b; });
      var zsP = [a].concat(X.poles);
      var zsA = residues(zsNum, zsP);
      var tot = [zi + zsA[0]].concat(zsA.slice(1));
      var y0 = b * X.g * 1 + a * c;   // x(0) = g (or 1)
      var y1 = b * (v === 'step' ? 1 : v === 'impulse' ? 0 : X.g * X.d) + a * y0;
      var modes = zsP.map(function (p) { return body(p, 'c'); });
      var ans2 = [ans('$y_{zs}$: coeff. of $' + (pn(a) || '1') + '$', zsA[0])];
      if (zsP.length > 1) ans2.push(ans('$y_{zs}$: coeff. of $' + (pn(zsP[1]) || 'u(n)') + '$', zsA[1]));
      return {
        stem: 'Solve $y(n)' + (a > 0 ? '-' : '+') + nf(Math.abs(a)) + 'y(n-1)=' + (b === 1 ? '' : nf(b)) + 'x(n)$ for $n\\ge0$ with $x(n)=' + X.tex + '$ and $y(-1)=' + nf(c) + '$, using the unilateral z-transform.',
        figure: null,
        parts: [
          { q: '(a) Find $Y^+(z)$ and the zero-input response $y_{zi}(n)=K' + pn(a) + 'u(n)$.', answers: [ans('$K$', zi)], working: steps([
            '$\\mathcal Z^+\\{y(n-1)\\}=z^{-1}Y^+(z)+y(-1)$. The input starts at $n=0$, so it needs no extra term.',
            '$Y^+' + (a > 0 ? '-' : '+') + nf(Math.abs(a)) + '\\big[z^{-1}Y^+ + ' + cfp(c) + '\\big]=' + nf(b) + 'X(z)$, so $Y^+(z)=\\dfrac{' + nf(a * c) + '}{' + fac(a).slice(1, -1) + '}+\\dfrac{' + nf(b) + 'X(z)}{' + fac(a).slice(1, -1) + '}$.',
            'The first term is the zero-input part: $y_{zi}(n)=' + nf(zi) + pn(a) + 'u(n)$.'
          ]) + fin('y_{zi}(n)=' + sumTex([[zi, body(a, 'c')]])) },
          { q: '(b) Find the zero-state response $y_{zs}(n)$.', answers: ans2, working: steps([
            '$Y_{zs}(z)=\\dfrac{' + nf(b) + '}{' + fac(a).slice(1, -1) + '}\\cdot ' + X.X + '$.'
          ].concat(zsP.length > 1 ? coverLines(zsNum, zsP, zsA) : ['A single pole: $y_{zs}(n)=' + nf(zsA[0]) + pn(a) + 'u(n)$.'])) + fin('y_{zs}(n)=' + sumTex(zsA.map(function (A, i) { return [A, modes[i]]; }))) },
          { q: '(c) Write the total response and check $y(0)$ and $y(1)$ by recursion.', answers: [ans('$y(0)$', y0), ans('$y(1)$', y1)], working: steps([
            $('y(n)=' + sumTex(tot.map(function (A, i) { return [A, modes[i]]; }))),
            'Recursion: $y(0)=' + nf(b) + 'x(0)' + (a > 0 ? '+' : '-') + nf(Math.abs(a)) + 'y(-1)=' + nf(y0) + '$, $y(1)=' + nf(b) + 'x(1)' + (a > 0 ? '+' : '-') + nf(Math.abs(a)) + 'y(0)=' + nf(y1) + '$. The closed form agrees.'
          ]) + fin('y(0)=' + nf(y0) + ',\\ y(1)=' + nf(y1)) }
        ],
        meta: { v: v, a: a, b: b, c: c, g: X.g, d: X.d }
      };
    }
  });

  QB.add({
    id: 'dsp.z.unilat-second', course: 'dsp', module: 'z', topic: 'unilat',
    title: 'Second-order LCCDE with y(−1), y(−2): zero-input and zero-state', difficulty: 3, marks: 8,
    variants: [{ id: 'step', label: 'Step input' }, { id: 'exp', label: 'Exponential input' }, { id: 'impulse', label: 'Impulse input' }, { id: 'repeated', label: 'Input pole = system pole' }],
    tags: ['L08 slide 14', 'D9 Ex 1-3', 'DX2 Q7', 'exam-style'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var pp = pickPoles(r, 2, [0.5, 0.25, 0.4, 0.2, 0.8, 0.6, 0.75, 2, 3], 1.25);
        if (Math.abs(pp[0] - 1) < 0.05 || Math.abs(pp[1] - 1) < 0.05) return null;
        var y1 = r.pick([1, 2, -1, 4, -2, 0, 3]), y2 = r.pick([0, 1, -1, 2, 4, -4]);
        if (!y1 && !y2) return null;
        return { ps: pp, y1: y1, y2: y2 };
      });
      var p1 = P.ps[0], p2 = P.ps[1], y1 = P.y1, y2 = P.y2;
      var a = pfromRoots([p1, p2]), a1 = a[1], a2 = a[2];
      var b = [1, v === 'repeated' ? 0 : r.pick([0, 0, 1, -1, 0.5])];
      if (!b[1]) b.pop();
      var X = v === 'repeated' ? { num: [1], poles: [p1], tex: body(p1, 'c'), X: '\\dfrac{1}{' + fac(p1).slice(1, -1) + '}', g: 1, d: p1 } : inputX(r, v, [p1, p2, 1]);
      var Ic = [a1 * y1 + a2 * y2, a2 * y1];          // I(z)
      var zi = residues([-Ic[0], -Ic[1]], [p1, p2]);
      var zsNum = pmul(b, X.num), zs, zsModes, zsTex;
      if (v === 'repeated') {
        var A2 = peval(zsNum, 1 / p1) / (1 - p2 / p1), Cq = peval(zsNum, 1 / p2) / Math.pow(1 - p1 / p2, 2), A1 = peval(zsNum, 0) - A2 - Cq;
        zs = [A1, Cq, A2];       // p1, p2, (n+1)p1
        zsModes = [body(p1, 'c'), body(p2, 'c'), body(p1, 'c', 2)];
      } else {
        var zp = [p1, p2].concat(X.poles);
        zs = residues(zsNum, zp);
        zsModes = zp.map(function (p) { return body(p, 'c'); });
      }
      var tot = zs.slice(); tot[0] += zi[0]; tot[1] += zi[1];
      // recursion for y(0), y(1)
      var xs = function (n) { if (n < 0) return 0; if (v === 'impulse') return n === 0 ? 1 : 0; return X.g * Math.pow(X.d, n); };
      var yy = { '-1': y1, '-2': y2 };
      for (var n = 0; n <= 1; n++) { var s = 0; b.forEach(function (bk, k) { s += bk * xs(n - k); }); s -= a1 * yy[n - 1] + a2 * yy[n - 2]; yy[n] = s; }
      var lhs = lhsY(a);
      var rhs = polyTex(b, function (k) { return k === 0 ? 'x(n)' : 'x(n-' + k + ')'; });
      var ansZs = zs.map(function (A, i) { return ans('$y_{zs}$: coeff. of $' + zsModes[i].replace(/u\(n\)$/, '').replace(/^$/, '1') + '$', A); });
      return {
        stem: 'A causal system obeys ' + $$(lhs + '=' + rhs) + 'with $y(-1)=' + nf(y1) + '$, $y(-2)=' + nf(y2) + '$ and input $x(n)=' + X.tex + '$. Use the unilateral z-transform.',
        figure: dfFig(b, a, 'I'),
        parts: [
          { q: '(a) Transform the equation and find the IC polynomial $I(z)=I_0+I_1z^{-1}$ in $A(z)Y^+(z)+I(z)=B(z)X(z)$.', answers: [ans('$I_0$', Ic[0]), ans('$I_1$', Ic[1])], working: steps([
            '$\\mathcal Z^+\\{y(n-1)\\}=z^{-1}Y^++y(-1)$ and $\\mathcal Z^+\\{y(n-2)\\}=z^{-2}Y^++z^{-1}y(-1)+y(-2)$. The input is causal, so $x(n-k)\\to z^{-k}X$.',
            '$I(z)=a_1y(-1)+a_2y(-2)+a_2y(-1)z^{-1}=' + nf(a1) + '(' + nf(y1) + ')+' + '(' + nf(a2) + ')(' + nf(y2) + ')+(' + nf(a2) + ')(' + nf(y1) + ')z^{-1}$.',
            '$A(z)=' + polyTex(a) + '=' + fac(p1) + fac(p2) + '$.'
          ]) + fin('I(z)=' + polyTex(cl(Ic))) },
          { q: '(b) Find the zero-input response $y_{zi}(n)=c_1' + pn(p1) + '+c_2' + pn(p2) + '$.', answers: [ans('$c_1$', zi[0]), ans('$c_2$', zi[1])], working: steps([
            '$Y_{zi}=-\\dfrac{I(z)}{A(z)}=\\dfrac{' + polyTex(cl([-Ic[0], -Ic[1]])) + '}{' + fac(p1) + fac(p2) + '}$ (system poles only).'
          ].concat(coverLines([-Ic[0], -Ic[1]], [p1, p2], zi, 'c')).concat(['Check: $y_{zi}(-1)=' + nf(zi[0] / p1 + zi[1] / p2) + '$ and $y_{zi}(-2)=' + nf(zi[0] / (p1 * p1) + zi[1] / (p2 * p2)) + '$ reproduce the ICs.'])) + fin('y_{zi}(n)=' + sumTex([[zi[0], body(p1, 'c')], [zi[1], body(p2, 'c')]])) },
          { q: '(c) Find the zero-state response $y_{zs}(n)$.', answers: ansZs, working: steps([
            '$Y_{zs}=H(z)X(z)=\\dfrac{' + polyTex(zsNum) + '}{' + fac(p1) + (v === 'repeated' ? '^2' : '') + fac(p2) + X.poles.filter(function (q) { return v !== 'repeated'; }).map(function (q) { return fac(q); }).join('') + '}$.'
          ].concat(v === 'repeated' ? [
            'The input pole lands on the system pole $' + nf(p1) + '$: a double pole, so an $(n+1)(' + nf(p1) + ')^n$ term appears.',
            'Squared-factor coefficient at $w=' + nf(1 / p1) + '$: $' + nf(zs[2]) + '$. Pole $' + nf(p2) + '$ at $w=' + nf(1 / p2) + '$: $' + nf(zs[1]) + '$. From $w=0$: $' + nf(zsNum[0]) + '=A_1+' + cfp(zs[2]) + '+' + cfp(zs[1]) + '$, so $A_1=' + nf(zs[0]) + '$.'
          ] : coverLines(zsNum, [p1, p2].concat(X.poles), zs))) + fin('y_{zs}(n)=' + sumTex(zs.map(function (A, i) { return [A, zsModes[i]]; }))) },
          { q: '(d) Give the total response and check $y(0)$ and $y(1)$ by recursion.', answers: [ans('$y(0)$', yy[0]), ans('$y(1)$', yy[1])], working: steps([
            $('y(n)=y_{zi}+y_{zs}=' + sumTex(tot.map(function (A, i) { return [A, zsModes[i]]; }))),
            'Recursion: $y(0)=' + nf(yy[0]) + '$, $y(1)=' + nf(yy[1]) + '$. The closed form gives the same values. ' + (Math.max(Math.abs(p1), Math.abs(p2)) > 1 ? 'A pole lies outside the unit circle, so $y(n)$ grows without bound.' : '')
          ]) + fin('y(0)=' + nf(yy[0]) + ',\\ y(1)=' + nf(yy[1])) }
        ],
        notes: QB.callout('trap', 'Do not drop the $z^{-1}y(-1)$ term from $\\mathcal Z^+\\{y(n-2)\\}$. The input gets no IC terms because $x(-1)=x(-2)=0$.'),
        meta: { v: v, p1: p1, p2: p2, y1: y1, y2: y2, b: b, g: X.g, d: X.d }
      };
    }
  });

  QB.add({
    id: 'dsp.z.unilat-kill', course: 'dsp', module: 'z', topic: 'unilat',
    title: 'Choose an initial condition so that a mode disappears', difficulty: 3, marks: 5,
    variants: [{ id: 'y1s', label: 'Unknown y(−1), stable mode removed' }, { id: 'y1u', label: 'Unknown y(−1), growing mode removed' }, { id: 'y2', label: 'Unknown y(−2)' }],
    tags: ['D9 Q5', 'D9 Q10'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var p = v === 'y1u' ? r.pick([2, 1.5, -2, 2.5, -1.5]) : r.pick([0.5, 0.25, 0.8, -0.5, 0.4, 0.6]);
        var q = r.pick([0.2, 0.4, -0.25, 0.5, -0.4, 0.25, 0.6]);
        if (Math.abs(Math.abs(p) - Math.abs(q)) < 0.05) return null;
        return { p: p, q: q };
      });
      var p = P.p, q = P.q, a = pfromRoots([p, q]);
      var c, Nw;
      if (v === 'y2') { c = 1 / ((p - 1) * q); Nw = [1 - a[2] * c, a[2] * c]; }       // 1 - (1-w)(a2 c)
      else { c = 1 / (1 - p); Nw = [1 - a[1] * c, a[1] * c - a[2] * c, a[2] * c]; }   // 1 - (1-w)(a1 c + a2 c w)
      var R1 = peval(Nw, 1) / ((1 - p) * (1 - q));
      var Rq = peval(Nw, 1 / q) / ((1 - 1 / q) * (1 - p / q));
      var y0 = v === 'y2' ? 1 - a[2] * c : 1 - a[1] * c;
      var unk = v === 'y2' ? 'y(-2)' : 'y(-1)', kn = v === 'y2' ? 'y(-1)=0' : 'y(-2)=0';
      var lhs = lhsY(a);
      var Iw = v === 'y2' ? sumTex([[a[2], 'c']]) : sumTex([[a[1], 'c'], [a[2], 'c\\,z^{-1}']]);
      return {
        stem: 'A system obeys $' + lhs + '=x(n)$ with $x(n)=u(n)$, $' + kn + '$ and $' + unk + '=c$.',
        figure: null,
        parts: [
          { q: '(a) Find $c$ so that the $(' + nf(p) + ')^n$ mode does not appear in $y(n)$.', answers: [ans('$c$', c)], working: steps([
            '$A(z)=' + fac(p) + fac(q) + '$, $I(z)=' + Iw + '$.',
            'Over one denominator: $Y=\\dfrac{1-(1-z^{-1})I(z)}{(1-z^{-1})' + fac(p) + fac(q) + '}$.',
            'The mode $p^n$ disappears when the numerator is zero at $z^{-1}=1/p=' + nf(1 / p) + '$. Solving gives $c=' + nf(c) + '$.'
          ]) + fin(unk + '=' + nf(c)) },
          { q: '(b) With that $c$, write $y(n)=K_1u(n)+K_2(' + nf(q) + ')^nu(n)$ and give $y(0)$.', answers: [ans('$K_1$', R1), ans('$K_2$', Rq), ans('$y(0)$', y0)], working: steps([
            'The factor $' + fac(p) + '$ cancels. Residues: at $z^{-1}=1$, $K_1=' + nf(R1) + '=H(1)$; at $z^{-1}=' + nf(1 / q) + '$, $K_2=' + nf(Rq) + '$.',
            'Check: $y(0)=x(0)-a_1y(-1)-a_2y(-2)=' + nf(y0) + '=K_1+K_2$.',
            p > 1 || p < -1 ? 'The growing mode is cancelled only for this exact $c$; any rounding re-excites it. Stability is a property of $H(z)$, not of the ICs.' : ''
          ]) + fin('y(n)=' + sumTex([[R1, 'u(n)'], [Rq, body(q, 'c')]])) }
        ],
        meta: { v: v, p: p, q: q }
      };
    }
  });

  /* =========================================================================
   * MODULE filt · TOPIC pzdesign — notch, resonator, comb, LP→HP
   * ========================================================================= */
  function hz(x) { return nf(x, 4) + '\\ \\text{Hz}'; }
  var FSL = [500, 1000, 2000, 8000, 600, 1200, 4000, 800];
  var F0L = [50, 60, 100, 125, 250, 200, 150, 1000, 400];

  QB.add({
    id: 'dsp.filt.pz-notch', course: 'dsp', module: 'filt', topic: 'pzdesign',
    title: 'Notch filter from zero (and pole) placement', difficulty: 2, marks: 5,
    variants: [{ id: 'firpi', label: 'FIR notch, unity gain at ω = π' }, { id: 'firdc', label: 'FIR notch, unity gain at DC' }, { id: 'iirpi', label: 'Notch with poles, gain 1 at ω = π' }, { id: 'iirdc', label: 'Notch with poles, gain 1 at DC' }],
    tags: ['T8 Q1', 'T8 Q3', 'DX1 Q6', 'exam-style'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var Fs = r.pick(FSL), F0 = r.pick(F0L);
        var w0 = 2 * PI * F0 / Fs;
        if (w0 < 0.08 * PI || w0 > 0.85 * PI) return null;
        return { Fs: Fs, F0: F0, w0: w0 };
      });
      var Fs = P.Fs, F0 = P.F0, w0 = P.w0, c2 = 2 * Math.cos(w0);
      var iir = v.indexOf('iir') === 0, atPi = /pi$/.test(v);
      var rr = iir ? r.pick([0.9, 0.95, 0.85, 0.98, 0.8]) : 0;
      var num = [1, -c2, 1], den = iir ? [1, -2 * rr * Math.cos(w0), rr * rr] : [1];
      var wN = atPi ? -1 : 1;
      var g = peval(num, wN) / peval(den, wN);
      var b0 = 1 / g;
      var B = num.map(function (q) { return q * b0; });
      var Ft = r.pick(atPi ? [0, Fs / 4] : [Fs / 2, Fs / 4]);
      if (Math.abs(Ft - F0) < 1) Ft = atPi ? 0 : Fs / 2;
      var Ht = freqResp(B, den, 2 * PI * Ft / Fs).abs();
      var parts = [
        { q: '(a) Find $\\omega_0$ and the numerator $1-2\\cos\\omega_0z^{-1}+z^{-2}$ that places zeros at $e^{\\pm j\\omega_0}$.', answers: [ans('$\\omega_0$', w0, { unit: 'rad' }), ans('$2\\cos\\omega_0$', c2)], working: steps([
          '$\\omega_0=2\\pi F_0/F_s=2\\pi(' + F0 + ')/' + Fs + '=' + piT(w0) + '=' + nf(w0) + '$ rad.',
          'Zeros at $e^{\\pm j\\omega_0}$: $(1-e^{j\\omega_0}z^{-1})(1-e^{-j\\omega_0}z^{-1})=1-' + nf(c2) + 'z^{-1}+z^{-2}$.'
        ]) + fin('\\omega_0=' + piT(w0) + ',\\ 2\\cos\\omega_0=' + nf(c2)) }
      ];
      if (iir) parts.push({ q: '(b) Place poles at $' + nf(rr) + 'e^{\\pm j\\omega_0}$. Find the denominator $1+a_1z^{-1}+a_2z^{-2}$.', answers: [ans('$a_1$', den[1]), ans('$a_2$', den[2])], working: steps(['$1-2r\\cos\\omega_0z^{-1}+r^2z^{-2}$ with $r=' + nf(rr) + '$: $a_1=-2(' + nf(rr) + ')\\cos(' + piT(w0) + ')=' + nf(den[1]) + '$, $a_2=' + nf(den[2]) + '$.']) + fin('a_1=' + nf(den[1]) + ',\\ a_2=' + nf(den[2])) });
      var L = iir ? '(c)' : '(b)';
      parts.push({ q: L + ' Find $b_0$ so that $|H(\\omega)|=1$ at ' + (atPi ? '$\\omega=\\pi$' : '$\\omega=0$') + ', then find $|H|$ at $F=' + Ft + '$ Hz.', answers: [ans('$b_0$', b0), ans('$|H|$ at ' + Ft + ' Hz', Ht)], working: steps([
        'At ' + (atPi ? '$\\omega=\\pi$, $z^{-1}=-1$' : '$\\omega=0$, $z^{-1}=1$') + ': $H=b_0\\dfrac{' + nf(peval(num, wN)) + '}{' + nf(peval(den, wN)) + '}=1$, so $b_0=' + nf(b0) + '$.',
        'At ' + Ft + ' Hz, $\\omega=' + piT(2 * PI * Ft / Fs) + '$: $|H|=' + nf(Ht) + '$' + (iir ? '.' : ' (use $|H(\\omega)|=b_0|2\\cos\\omega-2\\cos\\omega_0|$).'),
        iir ? 'The poles sit just behind the zeros and cancel their effect except near $F_0$: a narrow notch, about $2(1-r)F_s/(2\\pi)=' + nf(2 * (1 - rr) * Fs / (2 * PI), 3) + '$ Hz wide.' : 'With no poles, the second-order FIR notch is very wide: it also cuts frequencies well away from $F_0$.'
      ]) + fin('H(z)=' + nf(b0) + (iir ? '\\dfrac{' + polyTex(num) + '}{' + polyTex(den) + '}' : '(' + polyTex(num) + ')')) + '<div class="qb-fig">' + pzFig({ poles: iir ? [C.polar(rr, w0 * 180 / PI), C.polar(rr, -w0 * 180 / PI)] : [0, 0], zeros: [C.polar(1, w0 * 180 / PI), C.polar(1, -w0 * 180 / PI)], title: 'Notch poles and zeros' }) + dfFig(B, den, 'II') + '</div>' });
      return {
        stem: 'A signal sampled at $F_s=' + Fs + '$ Hz is corrupted by a ' + F0 + ' Hz tone. Design a second-order ' + (iir ? 'pole-zero' : 'FIR') + ' notch filter that removes it completely, with $|H(\\omega)|=1$ at ' + (atPi ? '$\\omega=\\pi$' : '$\\omega=0$ (DC)') + '.',
        figure: null, parts: parts,
        notes: QB.callout('trap', 'Normalise at the frequency the question asks for. $\\omega=\\pi$ means substitute $z^{-1}=-1$.'),
        meta: { v: v, Fs: Fs, F0: F0, r: rr, Ft: Ft }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.pz-resonator', course: 'dsp', module: 'filt', topic: 'pzdesign',
    title: 'Digital resonator: poles at r e^{±jω₀}', difficulty: 2, marks: 5,
    variants: [{ id: 'pm1', label: 'Zeros at z = ±1' }, { id: 'origin', label: 'Zeros at the origin' }],
    tags: ['L09 slide 17', 'D10 N4', 'DX2 Q8'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var w0 = r.pick([PI / 6, PI / 4, PI / 3, PI / 2, 2 * PI / 5, 3 * PI / 4, PI / 5]), Fs = r.pick([8000, 12000, 24000, 6000, 10000, 16000]);
        var F0 = w0 * Fs / (2 * PI);
        if (Math.abs(F0 - Math.round(F0)) > 1e-6) return null;
        return { w0: w0, Fs: Fs, F0: Math.round(F0) };
      });
      var w0 = P.w0, rr = r.pick([0.9, 0.95, 0.8, 0.85, 0.98]);
      var den = [1, -2 * rr * Math.cos(w0), rr * rr];
      var fz = v === 'pm1' ? 2 * Math.sin(w0) : 1;
      var dfar = Math.sqrt(1 - 2 * rr * Math.cos(2 * w0) + rr * rr);
      var G = fz / ((1 - rr) * dfar), b0 = 1 / G;
      var num = v === 'pm1' ? [b0, 0, -b0] : [b0];
      var H0 = Math.abs(peval(num, 1) / peval(den, 1)), Hpi = Math.abs(peval(num, -1) / peval(den, -1));
      return {
        stem: 'A digital resonator at $F_s=' + P.Fs + '$ Hz has poles at $' + nf(rr) + 'e^{\\pm j\\omega_0}$ with $F_0=' + P.F0 + '$ Hz, and ' + (v === 'pm1' ? 'zeros at $z=\\pm1$' : 'a double zero at the origin') + '.',
        figure: null,
        parts: [
          { q: '(a) Write $H(z)$ and find the denominator coefficients.', answers: [ans('$a_1$', den[1]), ans('$a_2$', den[2])], working: steps([
            '$\\omega_0=2\\pi(' + P.F0 + ')/' + P.Fs + '=' + piT(w0) + '$. Denominator $1-2r\\cos\\omega_0z^{-1}+r^2z^{-2}=' + polyTex(den) + '$.',
            $$('H(z)=\\frac{b_0' + (v === 'pm1' ? '(1-z^{-2})' : '') + '}{' + polyTex(den) + '}')
          ]) + fin('a_1=' + nf(den[1]) + ',\\ a_2=' + nf(den[2])) },
          { q: '(b) Find $b_0$ so that $|H(\\omega_0)|=1$. Then give $|H(0)|$ and $|H(\\pi)|$.', answers: [ans('$b_0$', b0), ans('$|H(0)|$', H0), ans('$|H(\\pi)|$', Hpi)], working: steps([
            'Distances from $e^{j\\omega_0}$: ' + (v === 'pm1' ? 'zeros $|1-e^{-j2\\omega_0}|=2\\sin\\omega_0=' + nf(fz) + '$; ' : 'zeros at the origin contribute 1; ') + 'near pole $1-r=' + nf(1 - rr) + '$; far pole $\\sqrt{1-2r\\cos2\\omega_0+r^2}=' + nf(dfar) + '$.',
            '$|H(\\omega_0)|=b_0\\cdot\\dfrac{' + nf(fz) + '}{(' + nf(1 - rr) + ')(' + nf(dfar) + ')}=' + nf(G) + 'b_0=1\\Rightarrow b_0=' + nf(b0) + '$.',
            v === 'pm1' ? 'The zeros at $\\pm1$ give $|H(0)|=|H(\\pi)|=0$.' : '$|H(0)|=b_0/' + nf(peval(den, 1)) + '=' + nf(H0) + '$, $|H(\\pi)|=b_0/' + nf(peval(den, -1)) + '=' + nf(Hpi) + '$.'
          ]) + fin('b_0=' + nf(b0)) + '<div class="qb-fig">' + pzFig({ poles: [C.polar(rr, w0 * 180 / PI), C.polar(rr, -w0 * 180 / PI)], zeros: v === 'pm1' ? [1, -1] : [0, 0], title: 'Resonator poles and zeros' }) + dfFig(num, den, 'II') + '</div>' }
        ],
        notes: QB.callout('tip', 'The true peak sits slightly off $\\omega_0$; normalise at $\\omega_0$ when the question says so.'),
        meta: { v: v, w0: w0, r: rr }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.pz-comb', course: 'dsp', module: 'filt', topic: 'pzdesign',
    title: 'Moving-average comb filter: nulls, gain and delay', difficulty: 1, marks: 4,
    variants: [{ id: 'design', label: 'Choose M to null a hum and its harmonics' }, { id: 'analyse', label: 'Given M, find the nulls' }],
    tags: ['T8 Q2', 'DX1 Q6(d)', 'L09 slide 21'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var Fs = r.pick([1000, 1200, 8000, 2000, 6000, 4800, 3000]), L = r.int(4, 10);
        var F1 = Fs / L;
        if (v === 'design' && Math.abs(F1 - Math.round(F1)) > 1e-9) return null;
        return { Fs: Fs, L: L, F1: F1 };
      });
      var Fs = P.Fs, L = P.L, M = L - 1, F1 = P.F1;
      var nN = Math.floor(L / 2);
      var Ft = F1 / 2, wt = 2 * PI * Ft / Fs;
      var Ht = Math.abs(Math.sin(L * wt / 2) / Math.sin(wt / 2)) / L;
      var nulls = []; for (var k = 1; k <= nN; k++) nulls.push(k * F1);
      var stem = v === 'design' ? 'A signal sampled at $F_s=' + Fs + '$ Hz is corrupted by a ' + nf(F1) + ' Hz hum and all its harmonics. Use $y(n)=\\frac{1}{M+1}\\sum_{k=0}^{M}x(n-k)$.'
        : 'The comb filter $H(z)=\\frac1{' + L + '}\\sum_{k=0}^{' + M + '}z^{-k}$ runs at $F_s=' + Fs + '$ Hz.';
      return {
        stem: stem, figure: null,
        parts: [
          { q: '(a) ' + (v === 'design' ? 'Find $M$. ' : '') + 'Give the lowest null frequency and the number of nulls in $0\\lt F\\le F_s/2$.', answers: (v === 'design' ? [ansInt('$M$', M)] : []).concat([ans('lowest null', F1, { unit: 'Hz' }), ansInt('number of nulls', nN)]), working: steps([
            '$H(z)=\\dfrac{1}{M+1}\\dfrac{1-z^{-(M+1)}}{1-z^{-1}}$: zeros at $e^{j2\\pi k/(M+1)}$, $k=1..M$ (the $k=0$ zero is cancelled by the pole at $z=1$).',
            'Nulls at $F_k=kF_s/(M+1)$. ' + (v === 'design' ? '$F_s/(M+1)=' + nf(F1) + '\\Rightarrow M+1=' + L + '$, $M=' + M + '$.' : '$M+1=' + L + '$, so $F_1=' + Fs + '/' + L + '=' + nf(F1) + '$ Hz.'),
            'In $(0,F_s/2]$: $' + nulls.map(function (q) { return nf(q); }).join(',\\ ') + '$ Hz.' + (L % 2 === 0 ? ' $M+1$ is even, so $F_s/2$ itself is a null.' : '')
          ]) + fin('F_k=' + nulls.map(function (q) { return nf(q); }).join(',\\ ') + '\\ \\text{Hz}') + '<div class="qb-fig">' + pzFig({ poles: nulls.map(function () { return 0; }).concat(nulls.map(function () { return 0; })).slice(0, M), zeros: (function () { var z = []; for (var k = 1; k <= M; k++) z.push(C.polar(1, 360 * k / L)); return z; })(), title: 'Comb zeros' }) + '</div>' },
          { q: '(b) Find the gain at ' + nf(Ft) + ' Hz and the delay in ms. What is the DC gain?', answers: [ans('$|H|$ at ' + nf(Ft) + ' Hz', Ht), ans('delay', M / 2 / Fs * 1000, { hint: 'in ms' }), ans('DC gain', 1)], working: steps([
            '$|H(\\omega)|=\\dfrac{1}{M+1}\\left|\\dfrac{\\sin((M+1)\\omega/2)}{\\sin(\\omega/2)}\\right|$ with $\\omega=2\\pi(' + nf(Ft) + ')/' + Fs + '=' + piT(wt) + '$: $|H|=' + nf(Ht) + '$.',
            'Symmetric taps: linear phase with delay $M/2=' + nf(M / 2) + '$ samples $=' + nf(M / 2 / Fs * 1000) + '$ ms.',
            'DC gain $\\sum h(n)=' + L + '\\times\\frac1{' + L + '}=1$.'
          ]) + fin('|H|=' + nf(Ht) + ',\\ \\tau=' + nf(M / 2 / Fs * 1000) + '\\ \\text{ms}') }
        ],
        notes: QB.callout('trap', 'Null spacing is $F_s/(M+1)$, where $M+1$ is the number of taps, not $F_s/M$.'),
        meta: { v: v, Fs: Fs, L: L }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.pz-lp2hp', course: 'dsp', module: 'filt', topic: 'pzdesign',
    title: 'Lowpass to highpass: h_HP(n) = (−1)ⁿ h_LP(n)', difficulty: 1, marks: 3,
    variants: [{ id: 'fir', label: 'FIR prototype' }, { id: 'iir', label: 'IIR prototype' }],
    tags: ['L09 slide 15', 'D10 N1'],
    gen: function (r, v) {
      var b, a;
      if (v === 'fir') { var c0 = r.pick([0.25, 0.2, 0.1, 0.5]), c1 = r.pick([0.5, 0.6, 0.8, 1]); b = [c0, c1, c0]; a = [1]; }
      else { b = [1, r.pick([1, 2, 0.5])]; if (r.bool(0.5)) b.push(r.pick([1, 0.5])); a = [1, -r.pick([0.5, 0.8, 0.9, 0.6]), r.pick([0, 0.2, 0.25, 0.16])]; if (!a[2]) a.pop(); }
      var flip = function (c) { return c.map(function (q, k) { return k % 2 ? -q : q; }); };
      var bh = flip(b), ah = flip(a);
      var H0 = Math.abs(peval(bh, 1) / peval(ah, 1)), Hpi = Math.abs(peval(bh, -1) / peval(ah, -1));
      return {
        stem: 'A lowpass filter has ' + $$('H_{LP}(z)=' + (v === 'fir' ? polyTex(b) : '\\frac{' + polyTex(b) + '}{' + polyTex(a) + '}')) + 'Form the highpass filter $H_{HP}(z)=H_{LP}(-z)$.',
        figure: null,
        parts: [
          { q: '(a) Find the $z^{-1}$ coefficients of $H_{HP}$' + (v === 'fir' ? '' : ' (numerator $b_1$ and denominator $a_1$)') + '.', answers: v === 'fir' ? [ans('$b_0$', bh[0]), ans('$b_1$', bh[1]), ans('$b_2$', bh[2])] : [ans('$b_1$', bh[1]), ans('$a_1$', ah[1])], working: steps([
            '$H_{LP}(-z)$: every odd power of $z^{-1}$ changes sign, in both numerator and denominator. Even powers keep their sign.',
            $$('H_{HP}(z)=' + (v === 'fir' ? polyTex(bh) : '\\frac{' + polyTex(bh) + '}{' + polyTex(ah) + '}'))
          ]) + fin('H_{HP}(z)=' + (v === 'fir' ? polyTex(bh) : '\\dfrac{' + polyTex(bh) + '}{' + polyTex(ah) + '}')) },
          { q: '(b) Find $|H_{HP}|$ at $\\omega=0$ and $\\omega=\\pi$.', answers: [ans('$|H_{HP}(0)|$', H0), ans('$|H_{HP}(\\pi)|$', Hpi)], working: steps([
            'Every pole and zero $p$ moves to $-p$, so the response is shifted by $\\pi$: $|H_{HP}(0)|=|H_{LP}(\\pi)|$ and $|H_{HP}(\\pi)|=|H_{LP}(0)|$.',
            '$|H_{HP}(0)|=' + nf(H0) + '$, $|H_{HP}(\\pi)|=' + nf(Hpi) + '$.'
          ]) + fin('|H_{HP}(0)|=' + nf(H0) + ',\\ |H_{HP}(\\pi)|=' + nf(Hpi)) }
        ],
        meta: { v: v, b: b, a: a }
      };
    }
  });

  /* =========================================================================
   * TOPIC linphase — linear phase and group delay
   * ========================================================================= */
  var LPT = { I: { sym: 1, odd: 1 }, II: { sym: 1, odd: 0 }, III: { sym: -1, odd: 1 }, IV: { sym: -1, odd: 0 } };
  QB.add({
    id: 'dsp.filt.lp-fill', course: 'dsp', module: 'filt', topic: 'linphase',
    title: 'Complete h(n) for linear phase: types I–IV', difficulty: 1, marks: 5,
    variants: [{ id: 'I', label: 'Type I (symmetric, M odd)' }, { id: 'II', label: 'Type II (symmetric, M even)' }, { id: 'III', label: 'Type III (antisymmetric, M odd)' }, { id: 'IV', label: 'Type IV (antisymmetric, M even)' }],
    tags: ['T9 Q8', 'DX2 Q10', 'L10 slides 33-36'],
    gen: function (r, v) {
      var t = LPT[v];
      var M = t.odd ? r.pick([5, 7]) : r.pick([4, 6]);
      var al = (M - 1) / 2, h = [];
      for (var n = 0; n <= Math.floor((M - 1) / 2); n++) h[n] = r.pick([1, 2, 3, -1, -2, 4, 5]);
      for (n = 0; n < M; n++) { var m = M - 1 - n; if (m < n) h[n] = t.sym * h[m]; }
      if (t.odd && t.sym < 0) h[al] = 0;
      // missing: one or two interior samples whose mirror is shown, plus the middle for type III
      var cand = []; for (n = 1; n < M - 1; n++) if (!(t.odd && n === al)) cand.push(n);
      var miss = [];
      var pairs = r.shuffle(cand);
      pairs.forEach(function (n) { if (miss.length < (M > 5 ? 2 : 1) && miss.indexOf(M - 1 - n) < 0) miss.push(n); });
      if (t.odd && t.sym < 0) miss.push(al);
      if (t.odd && t.sym > 0 && r.bool(0.3)) miss = miss.slice(0, 1);
      miss.sort(function (x, y) { return x - y; });
      var shown = h.map(function (q, n) { return miss.indexOf(n) >= 0 ? '\\ast' : nf(q); });
      var shownT = '\\{' + shown.map(function (s, n) { return n === 0 ? '\\underset{\\uparrow}{' + s + '}' : s; }).join(',\\ ') + '\\}';
      var H0 = h.reduce(function (s, q) { return s + q; }, 0), Hpi = h.reduce(function (s, q, n) { return s + q * Math.pow(-1, n); }, 0);
      // amplitude expression
      var terms = [];
      for (n = 0; n < Math.floor(M / 2); n++) { var k = al - n; terms.push([2 * h[n], (t.sym > 0 ? '\\cos' : '\\sin') + '(' + (k === 1 ? '' : nf(k)) + '\\omega)']); }
      var Aex = (t.odd && t.sym > 0 ? nf(h[al]) + (terms.length ? ' + ' : '') : '') + sumTex(terms);
      if (t.odd && t.sym > 0) Aex = sumTex([[h[al], '']].concat(terms));
      var forced = { I: 'none', II: '$z=-1$ ($H(\\pi)=0$): it cannot be a highpass', III: '$z=+1$ and $z=-1$: it can only be a bandpass', IV: '$z=+1$ ($H(0)=0$): it cannot be a lowpass' }[v];
      return {
        stem: 'Find the missing samples so that ' + $$('h(n)=' + shownT) + 'has linear phase. The arrow marks $n=0$.',
        figure: null,
        parts: [
          { q: '(a) Fill in the missing samples.', answers: miss.map(function (n) { return ans('$h(' + n + ')$', h[n]); }), working: steps([
            '$h(0)=' + nf(h[0]) + '$ and $h(' + (M - 1) + ')=' + nf(h[M - 1]) + '$, so the filter must be <b>' + (t.sym > 0 ? 'symmetric' : 'antisymmetric') + '</b>: $h(n)=' + (t.sym > 0 ? '' : '-') + 'h(' + (M - 1) + '-n)$.',
            t.odd && t.sym < 0 ? 'Antisymmetric with odd $M=' + M + '$ forces the middle sample $h(' + al + ')=-h(' + al + ')=0$.' : (t.odd ? '' : '$M=' + M + '$ is even, so there is no middle sample.'),
            miss.filter(function (n) { return !(t.odd && n === al && t.sym < 0); }).map(function (n) { return '$h(' + n + ')=' + (t.sym > 0 ? '' : '-') + 'h(' + (M - 1 - n) + ')=' + nf(h[n]) + '$'; }).join(', ')
          ]) + fin('h(n)=' + seqTex(h, 0, 3)) },
          { q: '(b) Give the group delay and the linear-phase type. Evaluate $H(0)$ and $H(\\pi)$.', answers: [ans('group delay', al), ans('$H(0)$', H0), ans('$H(\\pi)$', Hpi)], working: steps([
            'Factor out $e^{-j' + nf(al) + '\\omega}$ and pair the samples equidistant from $\\alpha=' + nf(al) + '$:',
            $$('H(\\omega)=\\Big[' + Aex + '\\Big]e^{-j(' + nf(al) + '\\omega' + (t.sym < 0 ? '-\\pi/2' : '') + ')}'),
            'Phase $-' + nf(al) + '\\omega' + (t.sym < 0 ? '+\\pi/2' : '') + '$ (plus $\\pm\\pi$ where the bracket is negative): linear, group delay $\\alpha=(M-1)/2=' + nf(al) + '$ samples.',
            'Type ' + v + '. Forced zeros: ' + forced + '. Check: $H(0)=\\sum h(n)=' + nf(H0) + '$, $H(\\pi)=\\sum(-1)^nh(n)=' + nf(Hpi) + '$.'
          ]) + fin('\\tau=' + nf(al) + ',\\ H(0)=' + nf(H0) + ',\\ H(\\pi)=' + nf(Hpi)) }
        ],
        notes: QB.callout('trap', 'The middle sample is forced to zero only for antisymmetric filters with odd $M$. The group delay is $(M-1)/2$, not $M/2$.'),
        meta: { v: v, h: h, miss: miss }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.lp-zeros', course: 'dsp', module: 'filt', topic: 'linphase',
    title: 'Zeros forced by linear phase: build the shortest h(n)', difficulty: 3, marks: 5,
    variants: [{ id: 'I', label: 'Type I, complex zero off the circle' }, { id: 'II', label: 'Type II, real zero' }, { id: 'III', label: 'Type III, real zero' }, { id: 'IV', label: 'Type IV, zero on the unit circle' }],
    tags: ['L10 slides 33-36', 'reciprocal zeros'],
    gen: function (r, v) {
      var zs, desc;
      if (v === 'I') { var rr = r.pick([0.5, 0.8, 2, 1.25, 0.6]), th = r.pick(W0.slice(0, 5)); var z0 = C.polar(rr, th * 180 / PI); zs = [z0, z0.conj(), z0.inv(), z0.conj().inv()]; desc = 'a zero at $z_0=' + nf(rr) + 'e^{j' + piT(th) + '}$'; }
      else if (v === 'IV') { var th2 = r.pick(W0.slice(0, 5)); var e = C.polar(1, th2 * 180 / PI); zs = [e, e.conj(), C(1, 0)]; desc = 'a zero at $z_0=e^{j' + piT(th2) + '}$'; }
      else { var a = r.pick([0.5, -0.5, 2, 0.25, -2, 0.8, 4]); zs = [C(a, 0), C(1 / a, 0), C(-1, 0)]; if (v === 'III') zs.push(C(1, 0)); desc = 'a zero at $z_0=' + nf(a) + '$'; }
      var c = [C(1, 0)];
      zs.forEach(function (z) { var o = []; for (var i = 0; i <= c.length; i++) { var t1 = i < c.length ? c[i] : C(0, 0), t2 = i > 0 ? c[i - 1].mul(z) : C(0, 0); o.push(t1.sub(t2)); } c = o; });
      var h = cl(c.map(function (q) { return q.re; }));
      var M = h.length, al = (M - 1) / 2;
      var tdesc = { I: 'symmetric, odd length', II: 'symmetric, even length', III: 'antisymmetric, odd length', IV: 'antisymmetric, even length' }[v];
      var why = v === 'I' ? 'Real coefficients add $z_0^*$; symmetry adds $1/z_0$ and $1/z_0^*$: a group of four. Type I forces nothing else.'
        : v === 'IV' ? '$z_0$ is on the unit circle, so $1/z_0^*=z_0$: the group is just $z_0,z_0^*$. Type IV forces a zero at $z=1$.'
          : 'A real zero pairs with its reciprocal $1/z_0$. Type ' + v + ' forces ' + (v === 'II' ? '$z=-1$' : '$z=\\pm1$') + '.';
      return {
        stem: 'A Type ' + v + ' linear-phase FIR filter (' + tdesc + ') has ' + desc + '. Find the shortest such filter with $h(0)=1$.',
        figure: null,
        parts: [
          { q: '(a) How many zeros must it have, and what is its length $M$ and group delay?', answers: [ansInt('number of zeros', zs.length), ansInt('$M$', M), ans('group delay', al)], working: steps([
            why,
            'Zeros: ' + zs.map(function (z) { return $(cf(z, 3)); }).join(', ') + '. That is ' + zs.length + ' zeros, so $M=' + M + '$ taps and $\\alpha=(M-1)/2=' + nf(al) + '$.'
          ]) + fin('M=' + M + ',\\ \\tau=' + nf(al)) + '<div class="qb-fig">' + pzFig({ zeros: zs, poles: zs.map(function () { return 0; }), title: 'Forced zero set' }) + '</div>' },
          { q: '(b) Multiply out $\\prod(1-z_kz^{-1})$ and give $h(1)$ and $h(2)$.', answers: [ans('$h(1)$', h[1]), ans('$h(2)$', h[2])], working: steps([
            'Pair conjugates first so every factor is real, then multiply.',
            $('H(z)=' + polyTex(h)),
            'Check: the coefficients are ' + (v === 'I' || v === 'II' ? 'symmetric' : 'antisymmetric') + ', as Type ' + v + ' requires.'
          ]) + fin('h(n)=' + seqTex(h, 0, 4)) }
        ],
        meta: { v: v, zs: zs.map(function (z) { return [z.re, z.im]; }) }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.lp-delay', course: 'dsp', module: 'filt', topic: 'linphase',
    title: 'Group delay: allpass section and symmetric FIR', difficulty: 2, marks: 4,
    variants: [{ id: 'allpass', label: 'First-order allpass' }, { id: 'fir', label: 'Symmetric FIR' }],
    tags: ['D10 N6', 'DX2 Q8(e)', 'L09 slides 9-10'],
    gen: function (r, v) {
      if (v === 'allpass') {
        var a = r.pick([0.5, -0.5, 0.8, -0.8, 0.25, 0.6, -0.6, -0.25]);
        var tau = function (w) { return (1 - a * a) / (1 + 2 * a * Math.cos(w) + a * a); };
        return {
          stem: 'A causal first-order section is ' + $$('H(z)=\\frac{' + polyTex([a, 1]) + '}{' + polyTex([1, a]) + '}'),
          figure: null,
          parts: [
            { q: '(a) Find the pole and zero, and show $|H(\\omega)|=1$. Is it minimum phase?', answers: [ans('pole', -a), ans('zero', -1 / a), flag('minimum phase? (1/0)', false)], working: steps([
              'Pole at $z=' + nf(-a) + '$, zero at $z=' + nf(-1 / a) + '$: reciprocals, the allpass signature.',
              '$H(\\omega)=e^{-j\\omega}\\dfrac{1+' + cfp(a) + 'e^{j\\omega}}{1+' + cfp(a) + 'e^{-j\\omega}}$: a number over its own conjugate, so $|H|=1$.',
              'The zero is outside the unit circle, so it is <b>not</b> minimum phase (its causal inverse is unstable).'
            ]) + fin('p=' + nf(-a) + ',\\ z=' + nf(-1 / a)) },
            { q: '(b) Evaluate $\\tau(\\omega)=\\dfrac{1-a^2}{1+2a\\cos\\omega+a^2}$ at $\\omega=0$, $\\pi/2$ and $\\pi$ (samples).', answers: [ans('$\\tau(0)$', tau(0)), ans('$\\tau(\\pi/2)$', tau(PI / 2)), ans('$\\tau(\\pi)$', tau(PI))], working: steps([
              'With $a=' + nf(a) + '$: $\\tau(0)=\\dfrac{' + nf(1 - a * a) + '}{' + nf(Math.pow(1 + a, 2)) + '}=' + nf(tau(0)) + '$, $\\tau(\\pi/2)=\\dfrac{' + nf(1 - a * a) + '}{' + nf(1 + a * a) + '}=' + nf(tau(PI / 2)) + '$, $\\tau(\\pi)=\\dfrac{' + nf(1 - a * a) + '}{' + nf(Math.pow(1 - a, 2)) + '}=' + nf(tau(PI)) + '$.',
              'The delay changes with $\\omega$ while $|H|=1$: an allpass is a phase equaliser.'
            ]) + fin('\\tau=' + nf(tau(0)) + ',\\ ' + nf(tau(PI / 2)) + ',\\ ' + nf(tau(PI))) }
          ],
          meta: { v: v, a: a }
        };
      }
      var M = r.pick([3, 5, 7]), al = (M - 1) / 2, h = [];
      for (var n = 0; n <= al; n++) h[n] = r.pick([1, 2, 3, 0.5, -1]);
      for (n = al + 1; n < M; n++) h[n] = h[M - 1 - n];
      var Fs = r.pick([1000, 8000, 2000, 500]), w1 = r.pick([PI / 2, PI / 3, PI / 4, 2 * PI / 3]);
      var A = h[al]; for (n = 0; n < al; n++) A += 2 * h[n] * Math.cos((al - n) * w1);
      return {
        stem: 'An FIR filter $h(n)=' + seqTex(h, 0, 3) + '$ runs at $F_s=' + Fs + '$ Hz.',
        figure: null,
        parts: [
          { q: '(a) Find the group delay in samples and in ms.', answers: [ans('delay (samples)', al), ans('delay (ms)', al / Fs * 1000)], working: steps(['$h(n)=h(' + (M - 1) + '-n)$: symmetric, so the phase is linear with $\\tau=(M-1)/2=' + al + '$ samples $=' + al + '/' + Fs + '$ s.']) + fin('\\tau=' + al + '\\ \\text{samples}=' + nf(al / Fs * 1000) + '\\ \\text{ms}') },
          { q: '(b) Write $H(\\omega)=A(\\omega)e^{-j' + al + '\\omega}$ and evaluate $|H|$ at $\\omega=' + piT(w1) + '$.', answers: [ans('$|H|$', Math.abs(A))], working: steps([
            $('A(\\omega)=' + sumTex([[h[al], '']].concat(h.slice(0, al).map(function (q, n) { return [2 * q, '\\cos(' + (al - n === 1 ? '' : al - n) + '\\omega)']; })))),
            '$A(' + piT(w1) + ')=' + nf(A) + '$, so $|H|=' + nf(Math.abs(A)) + '$.'
          ]) + fin('|H|=' + nf(Math.abs(A))) }
        ],
        meta: { v: v, h: h, Fs: Fs, w1: w1 }
      };
    }
  });

  /* =========================================================================
   * TOPIC inverse — inverse systems
   * ========================================================================= */
  function phaseWord(zs) {
    var inn = zs.filter(function (z) { return cabs(z) < 1; }).length;
    return inn === zs.length ? 'minimum phase' : inn === 0 ? 'maximum phase' : 'nonminimum phase (mixed)';
  }
  QB.add({
    id: 'dsp.filt.inv-fir', course: 'dsp', module: 'filt', topic: 'inverse',
    title: 'Inverse of an FIR channel: phase type and stable inverse', difficulty: 2, marks: 6,
    variants: [{ id: 'min', label: 'Minimum phase' }, { id: 'max', label: 'Maximum phase' }, { id: 'mixed', label: 'Mixed (nonminimum) phase' }],
    tags: ['D10 Ex 3', 'T8 Q4'],
    gen: function (r, v) {
      var zs = r.retry(function () {
        var z1 = r.pick(v === 'max' ? PO : PR) * r.sign(), z2 = r.pick(v === 'min' ? PR : PO) * r.sign();
        return Math.max(Math.abs(z1), Math.abs(z2)) / Math.min(Math.abs(z1), Math.abs(z2)) > 1.2 ? sortAbs([z1, z2]) : null;
      });
      var h = pfromRoots(zs), As = residues([1], zs);
      var rin, rout;
      if (v === 'min') { rin = Math.abs(zs[1]); rout = Infinity; } else if (v === 'max') { rin = 0; rout = Math.abs(zs[0]); } else { rin = Math.abs(zs[0]); rout = Math.abs(zs[1]); }
      var terms = zs.map(function (p, i) { return { A: As[i], p: p, kind: kindOf(p, rin, rout) }; });
      var NN = v === 'min' ? [0, 1] : [0, -1];
      var hv = NN.map(function (n) { return seqVal(terms, n); });
      var cst = Math.abs(zs[1]) < 1;
      var chk = 0; for (var k = 0; k < 3; k++) chk += h[k] * seqVal(terms, -k);
      var hIT = sumTex(terms.map(function (t) { return [t.kind === 'c' ? t.A : -t.A, body(t.p, t.kind)]; }));
      return {
        stem: 'A causal FIR channel is $H(z)=' + polyTex(h) + '$.',
        figure: null,
        parts: [
          { q: '(a) Find the zeros. Is the causal inverse stable?', answers: [ans('$|z_1|$ (smaller)', Math.abs(zs[0])), ans('$|z_2|$', Math.abs(zs[1])), flag('causal inverse stable? (1/0)', cst)], working: steps([
            'Factor: $H(z)=' + fac(zs[0]) + fac(zs[1]) + '$, zeros $' + nf(zs[0]) + '$ and $' + nf(zs[1]) + '$: <b>' + phaseWord(zs) + '</b>.',
            '$H_I=1/H$ has poles at the zeros of $H$. Causal inverse: ROC $|z|>' + nf(Math.abs(zs[1])) + '$, which ' + (cst ? 'contains' : 'misses') + ' $|z|=1$.'
          ]) + fin(cst ? '\\text{causal inverse stable}' : '\\text{causal inverse unstable}') },
          { q: '(b) Find the stable inverse $h_I(n)$: give the partial-fraction coefficients and $h_I(' + NN[0] + ')$, $h_I(' + NN[1] + ')$.', answers: [ans('$A_1$ (pole ' + nf(zs[0]) + ')', As[0]), ans('$A_2$ (pole ' + nf(zs[1]) + ')', As[1]), ans('$h_I(' + NN[0] + ')$', hv[0]), ans('$h_I(' + NN[1] + ')$', hv[1])], working: steps([
            'Stable inverse: the ROC containing $|z|=1$, $' + rocTex(rin, rout) + '$ (' + (v === 'min' ? 'causal' : v === 'max' ? 'anticausal' : 'two-sided, noncausal') + ').'
          ].concat(coverLines([1], zs, As)).concat([
            'Check: $A_1+A_2=' + nf(As[0] + As[1]) + '=H_I(\\infty)=1$.',
            $('h_I(n)=' + hIT),
            'Check: $\\sum_kh(k)h_I(-k)=' + nf(chk) + '$ (this is $(h*h_I)(0)$, which must be 1).'
          ])) + fin('h_I(n)=' + hIT) + '<div class="qb-fig">' + pzFig({ poles: zs, zeros: [0, 0], rin: rin, rout: rout, title: 'Stable inverse: poles and ROC' }) + '</div>' }
        ],
        notes: QB.callout('trap', 'A pole outside the unit circle gives $-Ap^nu(-n-1)$ in the stable inverse. "The inverse" usually means the causal one; read whether "stable inverse" is asked.'),
        meta: { v: v, zs: zs }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.inv-iir', course: 'dsp', module: 'filt', topic: 'inverse',
    title: 'Inverse of a pole-zero system (T8 Q5 style)', difficulty: 3, marks: 7,
    variants: [{ id: 'mixed', label: 'Nonminimum phase: noncausal stable inverse' }, { id: 'min', label: 'Minimum phase: causal stable inverse' }, { id: 'notch', label: 'Zeros on the unit circle' }],
    tags: ['T8 Q5', 'D10 N5'],
    gen: function (r, v) {
      if (v === 'notch') {
        var w0 = r.pick(W0), b0 = r.pick([0.25, 0.5, 0.2764, 1, 2]);
        var hI1 = 2 * Math.cos(w0) / b0;
        return {
          stem: 'An FIR notch is $H(z)=' + nf(b0) + '(1-2\\cos(' + piT(w0) + ')z^{-1}+z^{-2})$. Consider its causal inverse $H_I(z)=1/H(z)$.',
          figure: null,
          parts: [
            { q: '(a) Find the radius and angle of the poles of $H_I$. Does a stable inverse exist?', answers: [ans('pole radius', 1), ans('pole angle', w0, { unit: 'rad' }), flag('stable inverse exists? (1/0)', false)], working: steps([
              'Poles of $H_I$ are the zeros of $H$: $e^{\\pm j' + piT(w0) + '}$, on the unit circle.',
              'No ROC bounded by these poles can contain $|z|=1$, so no stable inverse exists. You cannot "un-notch" a signal.'
            ]) + fin('|p|=1:\\ \\text{no stable inverse}') },
            { q: '(b) The causal inverse is an oscillator. Find $h_I(0)$ and $h_I(1)$.', answers: [ans('$h_I(0)$', 1 / b0), ans('$h_I(1)$', hI1)], working: steps([
              '$h_I(n)=2\\cos\\omega_0\\,h_I(n-1)-h_I(n-2)+\\frac{1}{b_0}\\delta(n)$.',
              '$h_I(0)=1/b_0=' + nf(1 / b0) + '$, $h_I(1)=2\\cos\\omega_0/b_0=' + nf(hI1) + '$. In closed form $h_I(n)=\\dfrac{\\sin(\\omega_0(n+1))}{b_0\\sin\\omega_0}u(n)$, which never decays.'
            ]) + fin('h_I(0)=' + nf(1 / b0) + ',\\ h_I(1)=' + nf(hI1)) }
          ],
          meta: { v: v, w0: w0, b0: b0 }
        };
      }
      var zs = r.retry(function () {
        var z1 = r.pick(PR) * r.sign(), z2 = r.pick(v === 'min' ? PR : PO) * r.sign();
        return Math.max(Math.abs(z1), Math.abs(z2)) / Math.min(Math.abs(z1), Math.abs(z2)) > 1.2 ? sortAbs([z1, z2]) : null;
      });
      var deg2 = r.bool(0.5), D, dps;
      if (deg2) { var rr = r.pick([0.5, 0.8, 0.6, 0.9]), th = r.pick([PI / 3, PI / 4, PI / 2, 2 * PI / 3]); D = [1, -2 * rr * Math.cos(th), rr * rr]; dps = [C.polar(rr, th * 180 / PI), C.polar(rr, -th * 180 / PI)]; }
      else { var d = r.retry(function () { var t = r.pick(PR) * r.sign(); return zs.every(function (z) { return Math.abs(z - t) > 0.04; }) ? t : null; }); D = [1, -d]; dps = [C(d, 0)]; }
      var Nn = pfromRoots(zs);
      var K = deg2 ? D[2] / Nn[2] : 0;
      var As = residues(D, zs);
      var rin, rout;
      if (v === 'min') { rin = Math.abs(zs[1]); rout = Infinity; } else { rin = Math.abs(zs[0]); rout = Math.abs(zs[1]); }
      var terms = zs.map(function (p, i) { return { A: As[i], p: p, kind: kindOf(p, rin, rout) }; });
      if (deg2) terms.push({ kind: 'd', A: K, k: 0 });
      var NN = v === 'min' ? [0, 1] : [0, -1];
      var hv = NN.map(function (n) { return seqVal(terms, n); });
      var hIT = sumTex((deg2 ? [[K, '\\delta(n)']] : []).concat(zs.map(function (p, i) { return [terms[i].kind === 'c' ? As[i] : -As[i], body(p, terms[i].kind)]; })));
      var aK = deg2 ? [ans('$K$', K)] : [];
      return {
        stem: 'A channel is modelled by ' + $$('H(z)=\\frac{' + polyTex(Nn) + '}{' + polyTex(D) + '},\\qquad\\text{ROC: }|z|>' + nf(Math.max.apply(null, dps.map(cabs)))),
        figure: null,
        parts: [
          { q: '(a) Find the zeros and classify the phase type.', answers: [ans('$|z_1|$ (smaller)', Math.abs(zs[0])), ans('$|z_2|$', Math.abs(zs[1]))], working: steps([
            'Numerator: $' + polyTex(Nn) + '=' + fac(zs[0]) + fac(zs[1]) + '$, zeros $' + nf(zs[0]) + '$, $' + nf(zs[1]) + '$. Poles: ' + dps.map(function (p) { return $(cf(p)); }).join(', ') + ' (inside, so $H$ is causal and stable).',
            'Zeros ' + (v === 'min' ? 'both inside: <b>minimum phase</b>.' : 'one inside and one outside: <b>nonminimum phase</b>.')
          ]) + fin(v === 'min' ? '\\text{minimum phase}' : '\\text{nonminimum phase}') + '<div class="qb-fig">' + pzFig({ poles: dps, zeros: zs, title: 'Channel poles and zeros' }) + '</div>' },
          { q: '(b) Find the stable inverse $H_I(z)$, its ROC and $h_I(n)$. Enter ' + (deg2 ? '$K$, ' : '') + 'the coefficients for the poles $' + nf(zs[0]) + '$, $' + nf(zs[1]) + '$, and $h_I(' + NN[0] + ')$, $h_I(' + NN[1] + ')$.', answers: aK.concat([ans('$A_1$', As[0]), ans('$A_2$', As[1]), ans('$h_I(' + NN[0] + ')$', hv[0]), ans('$h_I(' + NN[1] + ')$', hv[1])]), working: steps([
            '$H_I(z)=\\dfrac{' + polyTex(D) + '}{' + polyTex(Nn) + '}$, ROC $' + rocTex(rin, rout) + '$ (contains $|z|=1$): ' + (v === 'min' ? '<b>causal</b>.' : '<b>noncausal</b> (two-sided).'),
            deg2 ? 'Equal degrees: constant $K=' + nf(D[2]) + '/' + nf(Nn[2]) + '=' + nf(K) + '$.' : 'Proper (degree 1 over degree 2): no constant.'
          ].concat(coverLines(D, zs, As)).concat([
            'Check: $' + (deg2 ? 'K+' : '') + 'A_1+A_2=' + nf(K + As[0] + As[1]) + '=H_I(\\infty)=1$.',
            $('h_I(n)=' + hIT)
          ])) + fin('h_I(n)=' + hIT) }
        ],
        notes: QB.callout('trap', 'Equal numerator and denominator degrees in $z^{-1}$ give a $K\\delta(n)$ term with $K=$ (last numerator coeff.)/(last denominator coeff.).'),
        meta: { v: v, zs: zs, D: D }
      };
    }
  });

  /* =========================================================================
   * TOPIC bilinear — bilinear transform and prewarping
   * ========================================================================= */
  function specHz(r) {
    return r.retry(function () {
      var Fs = r.pick([8000, 10000, 12000, 16000, 20000, 30000, 40000, 48000]);
      var fp = r.pick([0.05, 0.1, 0.125, 0.15, 0.2, 0.25]) * Fs / 2 * 2 / 2;   // keep tidy
      fp = Math.round(fp / 100) * 100;
      var ratio = r.pick([1.5, 2, 2.5, 3, 1.6, 1.8]);
      var fs2 = Math.round(fp * ratio / 100) * 100;
      if (fp <= 0 || fs2 >= Fs / 2 * 0.95 || fs2 <= fp) return null;
      return { Fs: Fs, fp: fp, fst: fs2 };
    });
  }
  QB.add({
    id: 'dsp.filt.bl-warp', course: 'dsp', module: 'filt', topic: 'bilinear',
    title: 'Frequency warping: prewarp the specs, or find where a cutoff lands', difficulty: 1, marks: 3,
    variants: [{ id: 'prewarp', label: 'Prewarp digital band edges (T = 1)' }, { id: 'unwarp', label: 'Where does an analogue cutoff land?' }, { id: 'noprewarp', label: 'Effect of skipping the prewarp' }],
    tags: ['T9 Q4', 'D11 Q2(c)', 'DX2 Q11(c)'],
    gen: function (r, v) {
      if (v === 'prewarp') {
        var S = specHz(r), wp = 2 * PI * S.fp / S.Fs, ws = 2 * PI * S.fst / S.Fs;
        var dp = r.pick([0.8, 0.9, 0.85, 0.707]), ds = r.pick([0.1, 0.2, 0.05, 0.15]);
        var Wp = 2 * Math.tan(wp / 2), Ws = 2 * Math.tan(ws / 2);
        return {
          stem: 'A digital lowpass filter must satisfy $' + nf(dp) + '\\le|H(\\omega)|\\le1$ up to ' + S.fp + ' Hz and $|H(\\omega)|\\le' + nf(ds) + '$ from ' + S.fst + ' Hz, at $F_s=' + S.Fs + '$ Hz. It will be designed by the bilinear transform with $T=1$.',
          figure: null,
          parts: [
            { q: '(a) Find $\\omega_p$ and $\\omega_s$.', answers: [ans('$\\omega_p$', wp, { unit: 'rad' }), ans('$\\omega_s$', ws, { unit: 'rad' })], working: steps(['$\\omega=2\\pi f/F_s$: $\\omega_p=2\\pi(' + S.fp + ')/' + S.Fs + '=' + piT(wp) + '$, $\\omega_s=' + piT(ws) + '$.']) + fin('\\omega_p=' + piT(wp) + ',\\ \\omega_s=' + piT(ws)) },
            { q: '(b) Give the analogue specifications.', answers: [ans('$\\Omega_p$', Wp), ans('$\\Omega_s$', Ws)], working: steps([
              'Prewarp: $\\Omega=\\frac2T\\tan\\frac\\omega2$ with $T=1$: $\\Omega_p=2\\tan(' + piT(wp / 2) + ')=' + nf(Wp) + '$, $\\Omega_s=2\\tan(' + piT(ws / 2) + ')=' + nf(Ws) + '$.',
              'Only the frequencies move; the magnitude limits $' + nf(dp) + '$ and $' + nf(ds) + '$ stay the same.'
            ]) + fin(nf(dp) + '\\le|H(\\Omega)|\\le1,\\ \\Omega\\le' + nf(Wp) + ';\\quad |H(\\Omega)|\\le' + nf(ds) + ',\\ \\Omega\\ge' + nf(Ws)) }
          ],
          meta: { v: v, Fs: S.Fs, fp: S.fp, fst: S.fst }
        };
      }
      var Fs = r.pick([8000, 10000, 5000, 16000, 44100, 1000]);
      var fc = Math.round(r.pick([0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.35]) * Fs);
      var T = 1 / Fs, wc = 2 * PI * fc / Fs;
      if (v === 'unwarp') {
        var w = 2 * Math.atan(2 * PI * fc * T / 2), f = w * Fs / (2 * PI);
        return {
          stem: 'An analogue lowpass filter has its 3-dB cutoff at $f_c=' + fc + '$ Hz ($\\Omega_c=2\\pi f_c$). It is mapped to a digital filter with the bilinear transform, $T=1/F_s$, $F_s=' + Fs + '$ Hz, <b>without</b> prewarping.',
          figure: null,
          parts: [{ q: '(a) At what digital frequency is the digital filter 3 dB down? Give $\\omega$ and the frequency in Hz.', answers: [ans('$\\omega_{3dB}$', w, { unit: 'rad' }), ans('$f_{3dB}$', f, { unit: 'Hz' })], working: steps([
            'The bilinear map gives exactly the analogue gain at $\\omega=2\\arctan(\\Omega T/2)$, not at $\\Omega T$.',
            '$\\omega=2\\arctan\\!\\left(\\dfrac{2\\pi(' + fc + ')}{2(' + Fs + ')}\\right)=' + nf(w) + '$ rad $=' + nf(w / PI) + '\\pi$.',
            '$f=\\omega F_s/(2\\pi)=' + nf(f) + '$ Hz, which is ' + nf(fc - f) + ' Hz below $f_c$: warping compresses the axis.'
          ]) + fin('f_{3dB}=' + nf(f) + '\\ \\text{Hz}') }],
          meta: { v: v, Fs: Fs, fc: fc }
        };
      }
      var Wc = 2 / T * Math.tan(wc / 2);
      var wn = 2 * Math.atan(2 * PI * fc * T / 2), fn2 = wn * Fs / (2 * PI);
      return {
        stem: 'A first-order digital lowpass filter with its 3-dB cutoff at $f_c=' + fc + '$ Hz is needed, $F_s=' + Fs + '$ Hz. It is built from $H_a(s)=\\dfrac{\\Omega_c}{s+\\Omega_c}$ with the bilinear transform, $T=1/F_s$.',
        figure: null,
        parts: [
          { q: '(a) Find the prewarped $\\Omega_c$ in rad/s and the frequency it corresponds to in Hz.', answers: [ans('$\\Omega_c$', Wc, { unit: 'rad/s' }), ans('$\\Omega_c/2\\pi$', Wc / (2 * PI), { unit: 'Hz' })], working: steps([
            '$\\omega_c=2\\pi(' + fc + ')/' + Fs + '=' + piT(wc) + '$.',
            '$\\Omega_c=\\frac2T\\tan\\frac{\\omega_c}2=' + (2 * Fs) + '\\tan(' + piT(wc / 2) + ')=' + nf(Wc) + '$ rad/s, i.e. ' + nf(Wc / (2 * PI)) + ' Hz (not ' + fc + ' Hz).'
          ]) + fin('\\Omega_c=' + nf(Wc) + '\\ \\text{rad/s}') },
          { q: '(b) A classmate skips prewarping and uses $\\Omega_c=2\\pi(' + fc + ')$. Where is their filter 3 dB down (Hz)?', answers: [ans('$f_{3dB}$', fn2, { unit: 'Hz' })], working: steps(['$\\omega=2\\arctan(\\Omega_cT/2)=2\\arctan(' + nf(PI * fc / Fs) + ')=' + nf(wn) + '$ rad, so $f=' + nf(fn2) + '$ Hz: too low by ' + nf(fc - fn2) + ' Hz.']) + fin('f_{3dB}=' + nf(fn2) + '\\ \\text{Hz}') }
        ],
        meta: { v: v, Fs: Fs, fc: fc }
      };
    }
  });

  /** bilinear map of factored analogue polynomials. Returns z^{-1} coefficients (not normalised). */
  function bl1(a, K) { return [K + a, a - K]; }                      // s + a
  function bl2(b, c, K) { return [K * K + b * K + c, 2 * (c - K * K), K * K - b * K + c]; }   // s^2 + b s + c
  function norm(b, a) { var a0 = a[0]; return { b: b.map(function (q) { return q / a0; }), a: a.map(function (q) { return q / a0; }) }; }

  QB.add({
    id: 'dsp.filt.bl-map', course: 'dsp', module: 'filt', topic: 'bilinear',
    title: 'Bilinear transform: convert H(s) to H(z)', difficulty: 2, marks: 5,
    variants: [{ id: 'lp1', label: 'First-order lowpass a/(s+a)' }, { id: 'hp1', label: 'First-order highpass s/(s+a)' }, { id: 'lp2', label: 'Second-order c/(s²+bs+c)' }, { id: 'res', label: '(s+α)/((s+α)²+β²) (T9 Q2)' }, { id: 'int', label: 'Integrator 1/s (T9 Q3)' }],
    tags: ['T9 Q2', 'T9 Q3', 'D11 factor method'],
    gen: function (r, v) {
      var T = r.pick([1, 1, 0.1, 0.5, 2]), K = 2 / T;
      var Hs, B, A, dc = null, wk = [], sb, sa;
      if (v === 'lp1' || v === 'hp1') {
        var a = r.pick([0.5, 1, 2, 3, 0.2, 5, 10]);
        if (T === 0.1) a = r.pick([5, 10, 20, 2]);
        A = bl1(a, K);
        B = v === 'lp1' ? [a, a] : [K, -K];
        Hs = v === 'lp1' ? '\\frac{' + nf(a) + '}{s+' + nf(a) + '}' : '\\frac{s}{s+' + nf(a) + '}';
        sb = v === 'lp1' ? [a] : [1, 0]; sa = [1, a];
        wk.push('$s+' + nf(a) + '\\to\\dfrac{(K+a)+(a-K)z^{-1}}{1+z^{-1}}=\\dfrac{' + polyTex(A) + '}{1+z^{-1}}$.');
        wk.push(v === 'lp1' ? 'Numerator $' + nf(a) + '\\to' + nf(a) + '(1+z^{-1})/(1+z^{-1})$.' : 'Numerator $s\\to K\\dfrac{1-z^{-1}}{1+z^{-1}}$.');
        dc = v === 'lp1' ? 1 : 0;
      } else if (v === 'lp2') {
        var cc = r.pick([1, 2, 4, 0.5, 9]), bb = r.pick([1, 1.4142, 0.5, 2, 3]);
        if (T === 0.1) { cc = r.pick([25, 100, 9]); bb = r.pick([5, 10, 2]); }
        A = bl2(bb, cc, K); B = [cc, 2 * cc, cc]; sb = [cc]; sa = [1, bb, cc];
        Hs = '\\frac{' + nf(cc) + '}{s^2+' + nf(bb) + 's+' + nf(cc) + '}';
        wk.push('$s^2+bs+c\\to\\dfrac{(K^2+bK+c)+2(c-K^2)z^{-1}+(K^2-bK+c)z^{-2}}{(1+z^{-1})^2}$ with $b=' + nf(bb) + '$, $c=' + nf(cc) + '$: $' + polyTex(A) + '$.');
        wk.push('Numerator $' + nf(cc) + '(1+z^{-1})^2$.');
        dc = 1;
      } else if (v === 'res') {
        var al = r.pick([0.1, 0.2, 0.5, 1]), be = r.pick([1, 2, 3, 4]);
        var cc2 = al * al + be * be;
        A = bl2(2 * al, cc2, K); B = pmul(bl1(al, K), [1, 1]); sb = [1, al]; sa = [1, 2 * al, cc2];
        Hs = '\\frac{s+' + nf(al) + '}{(s+' + nf(al) + ')^2+' + nf(be * be) + '}';
        wk.push('Denominator $s^2+' + nf(2 * al) + 's+' + nf(cc2) + '\\to' + polyTex(A) + '$ (over $(1+z^{-1})^2$).');
        wk.push('Numerator $s+' + nf(al) + '\\to[' + polyTex(bl1(al, K)) + '](1+z^{-1})/(1+z^{-1})^2=' + polyTex(B) + '$.');
        dc = al / cc2;
      } else {
        A = [K, -K]; B = [1, 1]; Hs = '\\frac1s'; sb = [1]; sa = [1, 0];
        wk.push('$\\dfrac1s\\to\\dfrac{1+z^{-1}}{K(1-z^{-1})}=\\dfrac T2\\,\\dfrac{1+z^{-1}}{1-z^{-1}}$.');
      }
      var N = norm(B, A);
      var poles = A.length === 2 ? [C(-A[1] / A[0], 0)] : poles2(A[1] / A[0], A[2] / A[0]);
      var ansA = N.b.map(function (q, i) { return ans('$b_' + i + '$', q); }).concat(N.a.slice(1).map(function (q, i) { return ans('$a_' + (i + 1) + '$', q); }));
      var pm = Math.max.apply(null, poles.map(cabs));
      return {
        stem: 'Convert $H(s)=' + Hs + '$ to a digital filter with the bilinear transform, $s=\\dfrac2T\\dfrac{1-z^{-1}}{1+z^{-1}}$, using $T=' + nf(T) + '$ ($2/T=' + nf(K) + '$).',
        figure: null,
        parts: [
          { q: '(a) Find $H(z)$ normalised so that $a_0=1$.', answers: ansA, working: steps(['Map each factor with $K=2/T=' + nf(K) + '$ (factor method):'].concat(wk).concat([
            $$('H(z)=\\frac{' + polyTex(cl(B)) + '}{' + polyTex(A) + '}=\\frac{' + polyTex(cl(N.b)) + '}{' + polyTex(N.a) + '}'),
            'Difference equation: $y(n)=' + sumTex(N.a.slice(1).map(function (q, i) { return [-q, 'y(n-' + (i + 1) + ')']; }).concat(N.b.map(function (q, i) { return [q, i ? 'x(n-' + i + ')' : 'x(n)']; }))) + '$.'
          ])) + fin('H(z)=\\dfrac{' + polyTex(cl(N.b)) + '}{' + polyTex(N.a) + '}') + '<div class="qb-fig">' + dfFig(cl(N.b), N.a, 'II') + '</div>' },
          { q: '(b) Find the largest pole magnitude' + (dc !== null ? ' and check the DC gain $H(z{=}1)$ against $H(s{=}0)$' : '') + '.', answers: [ans('largest $|p|$', pm)].concat(dc !== null ? [ans('$H(1)$', dc)] : []), working: steps([
            'Poles: ' + poles.map(function (p) { return $(cf(p)); }).join(', ') + ', so $\\max|p|=' + nf(pm) + '$. ' + (pm < 1 - 1e-9 ? 'The LHP maps inside the unit circle: stable.' : 'The pole at $z=1$ comes from $s=0$: marginally stable, avoid inputs with DC.'),
            dc !== null ? '$s=0\\to z=1$: $H(1)=\\dfrac{\\sum b_k}{\\sum a_k}=' + nf(dc) + '=H(s{=}0)$.' : '',
            v === 'lp1' || v === 'lp2' ? '$s=\\infty\\to z=-1$: the analogue zeros at infinity become zeros at $z=-1$.' : ''
          ]) + fin('\\max|p|=' + nf(pm)) }
        ],
        notes: QB.callout('trap', 'In a pure "convert this $H(s)$" question $T$ does not cancel: use the $T$ you are given. (In a prewarped design it does cancel.)'),
        meta: { v: v, T: T, sb: sb, sa: sa }
      };
    }
  });

  /* =========================================================================
   * TOPIC butter — Butterworth design
   * ========================================================================= */
  function bwSpec(r, lin, Nset) {
    return r.retry(function () {
      var S = {};
      if (lin) {
        S.dp = r.pick([0.8, 0.85, 0.9, 0.707, 0.95]); S.ds = r.pick([0.1, 0.15, 0.2, 0.05, 0.01]);
        S.Ap = -dB(S.dp); S.As = -dB(S.ds);
        S.wp = r.pick([0.1, 0.15, 0.2, 0.25, 0.3]) * PI; S.ws = S.wp + r.pick([0.15, 0.2, 0.3, 0.25, 0.35]) * PI;
      } else {
        S.Ap = r.pick([0.5, 1, 2, 3]); S.As = r.pick([15, 20, 25, 30, 40]);
        var H = specHz(r); S.Fs = H.Fs; S.fp = H.fp; S.fst = H.fst;
        S.wp = 2 * PI * H.fp / H.Fs; S.ws = 2 * PI * H.fst / H.Fs;
        S.dp = Math.pow(10, -S.Ap / 20); S.ds = Math.pow(10, -S.As / 20);
      }
      if (S.ws >= 0.95 * PI) return null;
      S.Wp = 2 * Math.tan(S.wp / 2); S.Ws = 2 * Math.tan(S.ws / 2);
      S.ep = 1 / (S.dp * S.dp) - 1; S.es = 1 / (S.ds * S.ds) - 1;
      S.Nraw = Math.log10(S.es / S.ep) / (2 * Math.log10(S.Ws / S.Wp));
      S.N = Math.ceil(S.Nraw - 1e-9);
      if (S.N - S.Nraw < 0.03 || S.N > 9) return null;
      if (Nset && Nset.indexOf(S.N) < 0) return null;
      return S;
    }, 400);
  }
  function specText(S, lin) {
    if (lin) return '$' + nf(S.dp) + '\\le|H(\\omega)|\\le1$ for $0\\le\\omega\\le' + piT(S.wp) + '$, and $|H(\\omega)|\\le' + nf(S.ds) + '$ for $' + piT(S.ws) + '\\le\\omega\\le\\pi$';
    return 'passband ripple $\\le' + nf(S.Ap) + '$ dB up to ' + S.fp + ' Hz, stopband attenuation $\\ge' + nf(S.As) + '$ dB from ' + S.fst + ' Hz, sampling frequency ' + S.Fs + ' Hz';
  }
  function bwSteps(S, lin) {
    return [
      lin ? 'Edges already in rad/sample: $\\omega_p=' + piT(S.wp) + '$, $\\omega_s=' + piT(S.ws) + '$; $\\delta_p=' + nf(S.dp) + '$, $\\delta_s=' + nf(S.ds) + '$.'
        : '$\\omega_p=2\\pi(' + S.fp + ')/' + S.Fs + '=' + piT(S.wp) + '$, $\\omega_s=' + piT(S.ws) + '$. $\\delta_p=10^{-' + nf(S.Ap) + '/20}=' + nf(S.dp) + '$, $\\delta_s=10^{-' + nf(S.As) + '/20}=' + nf(S.ds) + '$.',
      'Prewarp ($T=1$): $\\Omega_p=2\\tan(\\omega_p/2)=' + nf(S.Wp) + '$, $\\Omega_s=2\\tan(\\omega_s/2)=' + nf(S.Ws) + '$.',
      '$\\dfrac{1-\\delta_p^2}{\\delta_p^2}=' + nf(S.ep) + '$, $\\dfrac{1-\\delta_s^2}{\\delta_s^2}=' + nf(S.es) + '$.',
      $$('N=\\frac{\\log\\left(' + nf(S.es) + '/' + nf(S.ep) + '\\right)}{2\\log(' + nf(S.Ws) + '/' + nf(S.Wp) + ')}=' + nf(S.Nraw) + '\\ \\Rightarrow\\ N=' + S.N + '\\ \\text{(round up)}')
    ];
  }
  function bwGain(W, Wc, N) { return -10 * Math.log10(1 + Math.pow(W / Wc, 2 * N)); }

  QB.add({
    id: 'dsp.filt.bw-order', course: 'dsp', module: 'filt', topic: 'butter',
    title: 'Butterworth order and cutoff from digital specs', difficulty: 2, marks: 5,
    variants: [{ id: 'dbpass', label: 'Specs in dB, meet passband exactly' }, { id: 'dbstop', label: 'Specs in dB, meet stopband exactly' }, { id: 'linpass', label: 'Linear specs, meet passband exactly' }, { id: 'linstop', label: 'Linear specs, meet stopband exactly' }],
    tags: ['T9 Q5', 'DX1 Q7', 'exam-style'],
    gen: function (r, v) {
      var lin = v.indexOf('lin') === 0, pass = /pass$/.test(v);
      var S = bwSpec(r, lin);
      var Wc = pass ? S.Wp / Math.pow(S.ep, 1 / (2 * S.N)) : S.Ws / Math.pow(S.es, 1 / (2 * S.N));
      var gO = pass ? bwGain(S.Ws, Wc, S.N) : bwGain(S.Wp, Wc, S.N);
      return {
        stem: 'A digital lowpass filter has ' + specText(S, lin) + '. It is to be designed by applying the bilinear transform ($T=1$) to an analogue Butterworth filter.',
        figure: null,
        parts: [
          { q: '(a) Find the prewarped edges and the order $N$.', answers: [ans('$\\Omega_p$', S.Wp), ans('$\\Omega_s$', S.Ws), ansInt('$N$', S.N)], working: steps(bwSteps(S, lin)) + fin('\\Omega_p=' + nf(S.Wp) + ',\\ \\Omega_s=' + nf(S.Ws) + ',\\ N=' + S.N) },
          { q: '(b) Choose $\\Omega_c$ to meet the <b>' + (pass ? 'passband' : 'stopband') + '</b> exactly, and check the gain at the other edge (dB).', answers: [ans('$\\Omega_c$', Wc), ans('gain at $\\Omega_' + (pass ? 's' : 'p') + '$ (dB)', gO, { abs: 0.05 })], working: steps([
            pass ? '$\\Omega_c=\\Omega_p\\left(\\dfrac{\\delta_p^2}{1-\\delta_p^2}\\right)^{1/2N}=\\dfrac{' + nf(S.Wp) + '}{' + nf(S.ep) + '^{1/' + (2 * S.N) + '}}=' + nf(Wc) + '$.' : '$\\Omega_c=\\Omega_s\\left(\\dfrac{\\delta_s^2}{1-\\delta_s^2}\\right)^{1/2N}=\\dfrac{' + nf(S.Ws) + '}{' + nf(S.es) + '^{1/' + (2 * S.N) + '}}=' + nf(Wc) + '$.',
            'Check: $-10\\log_{10}[1+(\\Omega/\\Omega_c)^{2N}]$ at $\\Omega_' + (pass ? 's' : 'p') + '$ gives $' + nf(gO) + '$ dB, ' + (pass ? 'beyond the $-' + nf(S.As, 3) + '$ dB needed.' : 'inside the $-' + nf(S.Ap, 3) + '$ dB allowed.'),
            'Because of prewarping this analogue gain is exactly the digital gain at $\\omega_' + (pass ? 's' : 'p') + '$.'
          ]) + fin('\\Omega_c=' + nf(Wc)) }
        ],
        notes: QB.callout('trap', 'Always round $N$ <b>up</b>. Say which band you meet exactly: the two choices give different $\\Omega_c$, and both are valid.'),
        meta: { v: v, wp: S.wp, ws: S.ws, dp: S.dp, ds: S.ds }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.bw-radius', course: 'dsp', module: 'filt', topic: 'butter',
    title: 'Butterworth order from the pole radius', difficulty: 1, marks: 3,
    variants: [{ id: 'hz', label: 'Test frequency in Hz' }, { id: 'rads', label: 'Test frequency in rad/s' }],
    tags: ['T9 Q6', 'D11 Ex 3'],
    gen: function (r, v) {
      var P = r.retry(function () {
        var R = r.pick([50, 100, 200, 500, 1000, 2000, 3141.59, 6283.19]);
        var A = r.pick([30, 40, 50, 60, 80]);
        var W1 = v === 'hz' ? 2 * PI * r.pick([10, 20, 50, 100, 200, 500, 1000, 1500]) : R * r.pick([2, 3, 4, 5, 2.5, 8]);
        var ratio = W1 / R; if (ratio < 1.6 || ratio > 20) return null;
        var Nraw = Math.log10(Math.pow(10, A / 10) - 1) / (2 * Math.log10(ratio)), N = Math.ceil(Nraw - 1e-9);
        if (N - Nraw < 0.02 || N > 12) return null;
        return { R: R, A: A, W1: W1, Nraw: Nraw, N: N };
      });
      var att = 10 * Math.log10(1 + Math.pow(P.W1 / P.R, 2 * P.N));
      var re = -P.R * Math.sin(PI / (2 * P.N));
      var f1 = P.W1 / (2 * PI);
      return {
        stem: 'The poles of an analogue Butterworth lowpass filter lie on a circle of radius ' + nf(P.R) + ' rad/s. The filter must attenuate by at least ' + P.A + ' dB at ' + (v === 'hz' ? nf(f1) + ' Hz' : nf(P.W1) + ' rad/s') + '.',
        figure: null,
        parts: [
          { q: '(a) Find the minimum order $N$ and the attenuation it actually gives.', answers: [ansInt('$N$', P.N), ans('attenuation (dB)', att, { abs: 0.05 })], working: steps([
            'Pole radius $=\\Omega_c=' + nf(P.R) + '$ rad/s. ' + (v === 'hz' ? '$\\Omega_1=2\\pi(' + nf(f1) + ')=' + nf(P.W1) + '$ rad/s (no prewarp: this is purely analogue).' : '$\\Omega_1=' + nf(P.W1) + '$ rad/s.'),
            '$1+(\\Omega_1/\\Omega_c)^{2N}\\ge10^{' + P.A + '/10}\\Rightarrow N\\ge\\dfrac{\\log(10^{' + (P.A / 10) + '}-1)}{2\\log(' + nf(P.W1 / P.R) + ')}=' + nf(P.Nraw) + '$, so $N=' + P.N + '$.',
            'With $N=' + P.N + '$: $10\\log_{10}(1+' + nf(P.W1 / P.R) + '^{' + 2 * P.N + '})=' + nf(att) + '$ dB.'
          ]) + fin('N=' + P.N) },
          { q: '(b) Give the real part of the pole closest to the $j\\Omega$ axis.', answers: [ans('Re $s_0$', re)], working: steps([
            '$s_k=\\Omega_ce^{j(\\pi/2+\\pi(2k+1)/2N)}$. The pole nearest the axis is $k=0$: angle $90^\\circ+' + nf(90 / P.N) + '^\\circ$.',
            'Re $s_0=-\\Omega_c\\sin(\\pi/2N)=' + nf(re) + '$ rad/s.'
          ]) + fin('\\text{Re }s_0=' + nf(re)) }
        ],
        meta: { v: v, R: P.R, A: P.A, W1: P.W1 }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.bw-design', course: 'dsp', module: 'filt', topic: 'butter',
    title: 'Full Butterworth design to H(z) and the difference equation', difficulty: 3, marks: 9,
    variants: [{ id: 'stop', label: 'Meet stopband exactly (T9 Q5)' }, { id: 'pass', label: 'Meet passband exactly (L10 slide 17)' }],
    tags: ['T9 Q5', 'D11 Q4-Q5', 'DX1 Q7', 'exam-style'],
    gen: function (r, v) {
      var S = bwSpec(r, false, [1, 2, 3]);
      var pass = v === 'pass', N = S.N;
      var Wc = pass ? S.Wp / Math.pow(S.ep, 1 / (2 * N)) : S.Ws / Math.pow(S.es, 1 / (2 * N));
      var K = 2, den, num = [Math.pow(Wc, N)], Hs, mapT;
      if (N === 1) { den = bl1(Wc, K); Hs = '\\frac{' + nf(Wc) + '}{s+' + nf(Wc) + '}'; mapT = 's+\\Omega_c\\to' + polyTex(den); }
      else if (N === 2) { den = bl2(Math.SQRT2 * Wc, Wc * Wc, K); Hs = '\\frac{' + nf(Wc * Wc) + '}{s^2+' + nf(Math.SQRT2 * Wc) + 's+' + nf(Wc * Wc) + '}'; mapT = 's^2+\\sqrt2\\Omega_cs+\\Omega_c^2\\to' + polyTex(den); }
      else { var f1 = bl1(Wc, K), f2 = bl2(Wc, Wc * Wc, K); den = pmul(f1, f2); Hs = '\\frac{' + nf(Math.pow(Wc, 3)) + '}{(s+' + nf(Wc) + ')(s^2+' + nf(Wc) + 's+' + nf(Wc * Wc) + ')}'; mapT = '(' + polyTex(f1) + ')(' + polyTex(f2) + ')=' + polyTex(den); }
      var bin = N === 1 ? [1, 1] : N === 2 ? [1, 2, 1] : [1, 3, 3, 1];
      var B = bin.map(function (q) { return q * num[0]; });
      var Nz = norm(B, den);
      var gp = bwGain(S.Wp, Wc, N), gs = bwGain(S.Ws, Wc, N);
      var ansH = [ans('$b_0$', Nz.b[0])].concat(Nz.a.slice(1).map(function (q, i) { return ans('$a_' + (i + 1) + '$', q); }));
      var pAng = []; for (var k = 0; k < N; k++) pAng.push(90 + 180 * (2 * k + 1) / (2 * N));
      return {
        stem: 'A digital lowpass filter is required with ' + specText(S, false) + '. Obtain the transfer function and difference equation by applying the bilinear transform ($T=1$) to an analogue Butterworth filter, choosing $\\Omega_c$ to meet the <b>' + (pass ? 'passband' : 'stopband') + '</b> exactly.',
        figure: null,
        parts: [
          { q: '(a) Find the order $N$ and the cutoff $\\Omega_c$.', answers: [ansInt('$N$', N), ans('$\\Omega_c$', Wc)], working: steps(bwSteps(S, false).concat([
            pass ? '$\\Omega_c=\\Omega_p/(' + nf(S.ep) + ')^{1/' + (2 * N) + '}=' + nf(Wc) + '$.' : '$\\Omega_c=\\Omega_s/(' + nf(S.es) + ')^{1/' + (2 * N) + '}=' + nf(Wc) + '$.'
          ])) + fin('N=' + N + ',\\ \\Omega_c=' + nf(Wc)) },
          { q: '(b) Write $H(s)$ and apply the bilinear transform. Give $b_0$ and the denominator coefficients of $H(z)$ (with $a_0=1$).', answers: ansH, working: steps([
            'LHP poles on the circle of radius $\\Omega_c$ at angles ' + pAng.map(function (q) { return nf(q, 4) + '^\\circ'; }).map($).join(', ') + ': $H(s)=' + Hs.replace(/^\\frac/, '\\dfrac') + '$.',
            'Factor method with $K=2$: $' + mapT + '$; the numerator becomes $\\Omega_c^N(1+z^{-1})^N=' + polyTex(B) + '$.',
            $$('H(z)=\\frac{' + polyTex(B) + '}{' + polyTex(den) + '}=\\frac{' + polyTex(Nz.b) + '}{' + polyTex(Nz.a) + '}'),
            'Difference equation:' + $$('\\begin{aligned}y(n)=\\ &' + sumTex(Nz.a.slice(1).map(function (q, i) { return [-q, 'y(n-' + (i + 1) + ')']; })) + '\\\\ &' + sumTex(Nz.b.map(function (q, i) { return [q, i ? 'x(n-' + i + ')' : 'x(n)']; })).replace(/^([^-])/, '+$1') + '\\end{aligned}')
          ]) + fin('H(z)=\\dfrac{' + polyTex(Nz.b) + '}{' + polyTex(Nz.a) + '}') + '<div class="qb-fig">' + dfFig(Nz.b, Nz.a, 'II') + '</div>' },
          { q: '(c) Check the design: gain (dB) at $\\Omega_p$ and $\\Omega_s$.', answers: [ans('gain at $\\Omega_p$ (dB)', gp, { abs: 0.03 }), ans('gain at $\\Omega_s$ (dB)', gs, { abs: 0.05 })], working: steps([
            '$-10\\log_{10}[1+(\\Omega_p/\\Omega_c)^{' + 2 * N + '}]=' + nf(gp) + '$ dB (limit $-' + nf(S.Ap) + '$ dB) and $-10\\log_{10}[1+(\\Omega_s/\\Omega_c)^{' + 2 * N + '}]=' + nf(gs) + '$ dB (limit $-' + nf(S.As) + '$ dB).',
            'DC gain: $\\sum b_k/\\sum a_k=' + nf(Nz.b.reduce(function (s, q) { return s + q; }, 0) / Nz.a.reduce(function (s, q) { return s + q; }, 0)) + '$.'
          ]) + fin(nf(gp) + '\\ \\text{dB},\\ ' + nf(gs) + '\\ \\text{dB}') }
        ],
        notes: QB.callout('trap', 'Sign flip in the difference equation: a denominator term $-0.8z^{-1}$ becomes $+0.8y(n-1)$.'),
        meta: { v: v, Fs: S.Fs, fp: S.fp, fst: S.fst, Ap: S.Ap, As: S.As }
      };
    }
  });

  /* =========================================================================
   * TOPIC cheby — Chebyshev order and ripple
   * ========================================================================= */
  function chN(dp, ds, ratio) {
    var ep = Math.sqrt(1 / (dp * dp) - 1);
    var arg = Math.sqrt(1 - ds * ds) / (ep * ds);
    return { ep: ep, arg: arg, num: acosh(arg), den: acosh(ratio), raw: acosh(arg) / acosh(ratio) };
  }
  QB.add({
    id: 'dsp.filt.ch-order', course: 'dsp', module: 'filt', topic: 'cheby',
    title: 'Chebyshev ε and order N (with cosh⁻¹)', difficulty: 2, marks: 5,
    variants: [{ id: 'analog', label: 'Analogue specs (rad/s)' }, { id: 'digdb', label: 'Digital specs in dB (Type I)' }, { id: 'diglin', label: 'Digital linear specs' }, { id: 'type2', label: 'Type II (T9 Q7)' }],
    tags: ['T9 Q7', 'DX2 Q9', 'L10 slides 24, 27'],
    gen: function (r, v) {
      var S = r.retry(function () {
        var s = {};
        if (v === 'analog') { s.Ap = r.pick([0.5, 1, 2, 3]); s.As = r.pick([30, 40, 50, 60]); s.Wp = r.pick([1000, 500, 2000, 1]); s.Ws = s.Wp * r.pick([1.5, 2, 2.5, 3, 1.8]); s.dp = Math.pow(10, -s.Ap / 20); s.ds = Math.pow(10, -s.As / 20); }
        else if (v === 'diglin') { s.dp = r.pick([0.9, 0.95, 0.8, 0.85]); s.ds = r.pick([0.01, 0.05, 0.1, 0.02]); s.wp = r.pick([0.1, 0.2, 0.25, 0.3]) * PI; s.ws = s.wp + r.pick([0.1, 0.15, 0.2, 0.3]) * PI; if (s.ws > 0.9 * PI) return null; s.Wp = 2 * Math.tan(s.wp / 2); s.Ws = 2 * Math.tan(s.ws / 2); }
        else { s.Ap = r.pick([0.5, 1, 2]); s.As = r.pick([30, 40, 50, 60]); var H = specHz(r); s.Fs = H.Fs; s.fp = H.fp; s.fst = H.fst; s.wp = 2 * PI * H.fp / H.Fs; s.ws = 2 * PI * H.fst / H.Fs; s.Wp = 2 * Math.tan(s.wp / 2); s.Ws = 2 * Math.tan(s.ws / 2); s.dp = Math.pow(10, -s.Ap / 20); s.ds = Math.pow(10, -s.As / 20); }
        var c = chN(s.dp, s.ds, s.Ws / s.Wp); s.c = c; s.N = Math.ceil(c.raw - 1e-9);
        if (s.N - c.raw < 0.03 || s.N > 12) return null;
        var bw = Math.log10((1 / (s.ds * s.ds) - 1) / (1 / (s.dp * s.dp) - 1)) / (2 * Math.log10(s.Ws / s.Wp));
        s.Nb = Math.ceil(bw - 1e-9); if (s.Nb - bw < 0.02) return null; s.Nbraw = bw;
        return s;
      });
      var dig = v !== 'analog';
      var specT = v === 'analog' ? 'at most ' + nf(S.Ap) + ' dB passband ripple up to $\\Omega_p=' + nf(S.Wp) + '$ rad/s and at least ' + nf(S.As) + ' dB attenuation from $\\Omega_s=' + nf(S.Ws) + '$ rad/s'
        : v === 'diglin' ? '$' + nf(S.dp) + '\\le|H(\\omega)|\\le1$ for $\\omega\\le' + piT(S.wp) + '$ and $|H(\\omega)|\\le' + nf(S.ds) + '$ for $\\omega\\ge' + piT(S.ws) + '$'
          : 'passband ripple $\\le' + nf(S.Ap) + '$ dB, stopband attenuation $\\ge' + nf(S.As) + '$ dB, passband edge ' + S.fp + ' Hz, stopband edge ' + S.fst + ' Hz, sampling at ' + S.Fs + ' Hz';
      var typ = v === 'type2' ? 'Type II' : 'Type I';
      var parts = [];
      var w1 = [];
      if (dig) w1.push((v === 'diglin' ? '$\\omega_p=' + piT(S.wp) + '$, $\\omega_s=' + piT(S.ws) + '$.' : '$\\omega_p=2\\pi(' + S.fp + ')/' + S.Fs + '=' + piT(S.wp) + '$, $\\omega_s=' + piT(S.ws) + '$.') + ' Prewarp ($T=1$): $\\Omega_p=' + nf(S.Wp) + '$, $\\Omega_s=' + nf(S.Ws) + '$, ratio $' + nf(S.Ws / S.Wp) + '$.');
      w1.push('$\\delta_p=' + nf(S.dp) + '$, $\\delta_s=' + nf(S.ds) + '$. $\\epsilon=\\sqrt{1/\\delta_p^2-1}=' + nf(S.c.ep) + '$ (from the passband, for both types).');
      w1.push('Numerator: $\\cosh^{-1}\\!\\left(\\dfrac{\\sqrt{1-\\delta_s^2}}{\\epsilon\\,\\delta_s}\\right)=\\cosh^{-1}(' + nf(S.c.arg) + ')=' + nf(S.c.num) + '$. Denominator: $\\cosh^{-1}(' + nf(S.Ws / S.Wp) + ')=' + nf(S.c.den) + '$.');
      w1.push('$N=' + nf(S.c.num) + '/' + nf(S.c.den) + '=' + nf(S.c.raw) + '\\Rightarrow N=' + S.N + '$ (round up; the Type I and Type II values are the same).');
      var A1 = dig ? [ans('$\\Omega_p$', S.Wp), ans('$\\Omega_s$', S.Ws)] : [];
      parts.push({ q: '(a) ' + (dig ? 'Prewarp the edges, then find' : 'Find') + ' $\\epsilon$ and $N$ for the ' + typ + ' prototype.', answers: A1.concat([ans('$\\epsilon$', S.c.ep), ansInt('$N$', S.N)]), working: steps(w1) + fin('\\epsilon=' + nf(S.c.ep) + ',\\ N=' + S.N) });
      parts.push({ q: '(b) What order would a Butterworth filter need for the same specification?', answers: [ansInt('$N_{BW}$', S.Nb)], working: steps([
        '$N=\\dfrac{\\log\\frac{\\delta_p^2(1-\\delta_s^2)}{\\delta_s^2(1-\\delta_p^2)}}{2\\log(\\Omega_s/\\Omega_p)}=' + nf(S.Nbraw) + '\\Rightarrow ' + S.Nb + '$.',
        'Chebyshev saves ' + (S.Nb - S.N) + ' order' + (S.Nb - S.N === 1 ? '' : 's') + '. Elliptic would need fewer still; Bessel more.'
      ]) + fin('N_{BW}=' + S.Nb) });
      return {
        stem: 'A ' + (dig ? 'digital lowpass filter is to be designed by applying the bilinear transform ($T=1$) to an analogue Chebyshev ' + typ + ' filter' : 'analogue Chebyshev ' + typ + ' lowpass filter must have') + (dig ? ', with ' : ' ') + specT + '.',
        figure: null, parts: parts,
        notes: QB.callout('trap', 'The slides print "cos$^{-1}$". Both arguments exceed 1, so use $\\cosh^{-1}x=\\ln(x+\\sqrt{x^2-1})$. $\\epsilon$ always comes from $\\delta_p$.'),
        meta: { v: v, dp: S.dp, ds: S.ds, Wp: S.Wp, Ws: S.Ws }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.ch-poles', course: 'dsp', module: 'filt', topic: 'cheby',
    title: 'Chebyshev Type I poles on the ellipse and H(s)', difficulty: 3, marks: 5,
    variants: [{ id: 'N2', label: 'N = 2' }, { id: 'N3', label: 'N = 3' }, { id: 'N4', label: 'N = 4' }],
    tags: ['L10 slide 22', 'D12 Ex 1', 'D12 New Q2'],
    gen: function (r, v) {
      var N = +v.slice(1), Ap = r.pick([0.5, 1, 2, 3]), Wp = r.pick([1, 1, 0.5, 2, 0.6498, 1.5]);
      var ep = Math.sqrt(Math.pow(10, Ap / 10) - 1);
      var beta = Math.pow((Math.sqrt(1 + ep * ep) + 1) / ep, 1 / N);
      var r1 = Wp * (beta * beta + 1) / (2 * beta), r2 = Wp * (beta * beta - 1) / (2 * beta);
      var ps = []; for (var k = 0; k < N; k++) { var ph = PI / 2 + (2 * k + 1) * PI / (2 * N); ps.push(C(r2 * Math.cos(ph), r1 * Math.sin(ph))); }
      var prod = C(1, 0); ps.forEach(function (p) { prod = prod.mul(p.neg()); });
      var Kn = prod.re / (N % 2 ? 1 : Math.sqrt(1 + ep * ep));
      var H0 = N % 2 ? 1 : 1 / Math.sqrt(1 + ep * ep);
      var facs = []; for (k = 0; k < Math.floor(N / 2); k++) facs.push('(s^2+' + nf(-2 * ps[k].re) + 's+' + nf(ps[k].abs() * ps[k].abs()) + ')');
      if (N % 2) facs.push('(s+' + nf(-ps[(N - 1) / 2].re) + ')');
      return {
        stem: 'Find the poles and transfer function of a Chebyshev Type I lowpass filter with $N=' + N + '$, ' + nf(Ap) + ' dB passband ripple and $\\Omega_p=' + nf(Wp) + '$ rad/s.',
        figure: null,
        parts: [
          { q: '(a) Find $\\epsilon$, $\\beta$ and the ellipse semi-axes $r_1$ (along $j\\Omega$) and $r_2$ (along $\\sigma$).', answers: [ans('$\\epsilon$', ep), ans('$\\beta$', beta), ans('$r_1$', r1), ans('$r_2$', r2)], working: steps([
            '$\\epsilon=\\sqrt{10^{' + nf(Ap) + '/10}-1}=' + nf(ep) + '$.',
            '$\\beta=\\left(\\dfrac{\\sqrt{1+\\epsilon^2}+1}{\\epsilon}\\right)^{1/' + N + '}=(' + nf((Math.sqrt(1 + ep * ep) + 1) / ep) + ')^{1/' + N + '}=' + nf(beta) + '$.',
            '$r_1=\\Omega_p\\dfrac{\\beta^2+1}{2\\beta}=' + nf(r1) + '$, $r_2=\\Omega_p\\dfrac{\\beta^2-1}{2\\beta}=' + nf(r2) + '$.'
          ]) + fin('r_1=' + nf(r1) + ',\\ r_2=' + nf(r2)) },
          { q: '(b) Find the pole $p_0$ ($k=0$) and the numerator constant $K$ of $H(s)=K/\\prod(s-p_k)$. What is $|H(0)|$?', answers: [ans('Re $p_0$', ps[0].re), ans('Im $p_0$', ps[0].im), ans('$K$', Kn), ans('$|H(0)|$', H0)], working: steps([
            '$\\phi_k=90^\\circ+(2k+1)\\dfrac{180^\\circ}{2N}$: ' + ps.map(function (p, k) { return $(nf(90 + (2 * k + 1) * 90 / N) + '^\\circ'); }).join(', ') + '.',
            '$p_k=r_2\\cos\\phi_k+jr_1\\sin\\phi_k$: ' + ps.map(function (p) { return $(cf(p)); }).join(', ') + '.',
            'Denominator: $' + facs.join('') + '$.',
            N % 2 ? 'Odd $N$: $K=\\prod(-p_k)=' + nf(Kn) + '$, so $|H(0)|=1$.' : 'Even $N$: $K=\\prod(-p_k)/\\sqrt{1+\\epsilon^2}=' + nf(prod.re) + '/' + nf(Math.sqrt(1 + ep * ep)) + '=' + nf(Kn) + '$, so $|H(0)|=\\delta_p=' + nf(H0) + '$.'
          ]) + fin('H(s)=\\dfrac{' + nf(Kn) + '}{' + facs.join('') + '}') }
        ],
        notes: QB.callout('trap', 'For even $N$ the DC gain is $\\delta_p$, not 1.'),
        meta: { v: v, Ap: Ap, Wp: Wp }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.ch-resp', course: 'dsp', module: 'filt', topic: 'cheby',
    title: 'Chebyshev Type I response: T_N(x) and gain at a frequency', difficulty: 2, marks: 3,
    variants: [{ id: 'pass', label: 'Inside the passband (cos form)' }, { id: 'stop', label: 'In the stopband (cosh form)' }],
    tags: ['DX2 Q9(d)', 'L10 slides 20-24'],
    gen: function (r, v) {
      var N = r.int(2, 6), Ap = r.pick([0.5, 1, 2, 3]), Wp = r.pick([1, 1000, 0.6498, 2]);
      var x = v === 'pass' ? r.pick([0.3, 0.5, 0.6, 0.8, 0.9, 0.25]) : r.pick([1.5, 2, 2.5, 3, 1.25, 4]);
      var ep2 = Math.pow(10, Ap / 10) - 1;
      var TN = v === 'pass' ? Math.cos(N * Math.acos(x)) : Math.cosh(N * acosh(x));
      var g = -10 * Math.log10(1 + ep2 * TN * TN);
      var g0 = N % 2 ? 0 : -Ap;
      return {
        stem: 'A Chebyshev Type I lowpass filter has $N=' + N + '$, ' + nf(Ap) + ' dB ripple and $\\Omega_p=' + nf(Wp) + '$ rad/s. Use $|H(\\Omega)|^2=\\dfrac{1}{1+\\epsilon^2T_N^2(\\Omega/\\Omega_p)}$.',
        figure: null,
        parts: [
          { q: '(a) Find $T_N(x)$ and the gain (dB) at $\\Omega=' + nf(x * Wp) + '$ rad/s.', answers: [ans('$T_N(x)$', TN, { abs: 0.002 }), ans('gain (dB)', g, { abs: 0.03 })], working: steps([
            '$x=\\Omega/\\Omega_p=' + nf(x) + '$, $\\epsilon^2=10^{' + nf(Ap) + '/10}-1=' + nf(ep2) + '$.',
            v === 'pass' ? '$|x|\\le1$: $T_N(x)=\\cos(N\\cos^{-1}x)=\\cos(' + N + '\\times' + nf(Math.acos(x)) + ')=' + nf(TN) + '$.' : '$x>1$: $T_N(x)=\\cosh(N\\cosh^{-1}x)=\\cosh(' + N + '\\times' + nf(acosh(x)) + ')=' + nf(TN) + '$.',
            'Gain $=-10\\log_{10}(1+\\epsilon^2T_N^2)=' + nf(g) + '$ dB.'
          ]) + fin('T_N=' + nf(TN) + ',\\ ' + nf(g) + '\\ \\text{dB}') },
          { q: '(b) What is the DC gain in dB?', answers: [ans('DC gain (dB)', g0, { abs: 0.02 })], working: steps([N % 2 ? '$N$ odd: $T_N(0)=0$, so $|H(0)|=1$ (0 dB).' : '$N$ even: $T_N(0)=\\pm1$, so $|H(0)|=\\delta_p$, i.e. $-' + nf(Ap) + '$ dB.']) + fin(nf(g0) + '\\ \\text{dB}') }
        ],
        meta: { v: v, N: N, Ap: Ap, x: x }
      };
    }
  });

  /* =========================================================================
   * TOPIC fir — window-method FIR design
   * ========================================================================= */
  var WIN = {
    rect: { name: 'rectangular', f: function () { return 1; } },
    bartlett: { name: 'Bartlett', f: function (n, M) { return 1 - 2 * Math.abs(n - (M - 1) / 2) / (M - 1); } },
    hanning: { name: 'Hanning', f: function (n, M) { return 0.5 * (1 - Math.cos(2 * PI * n / (M - 1))); } },
    hamming: { name: 'Hamming', f: function (n, M) { return 0.54 - 0.46 * Math.cos(2 * PI * n / (M - 1)); } },
    blackman: { name: 'Blackman', f: function (n, M) { return 0.42 - 0.5 * Math.cos(2 * PI * n / (M - 1)) + 0.08 * Math.cos(4 * PI * n / (M - 1)); } }
  };
  var WINF = { rect: 'w(n)=1', bartlett: 'w(n)=1-\\frac{2|n-(M-1)/2|}{M-1}', hanning: 'w(n)=\\tfrac12\\left(1-\\cos\\frac{2\\pi n}{M-1}\\right)', hamming: 'w(n)=0.54-0.46\\cos\\frac{2\\pi n}{M-1}', blackman: 'w(n)=0.42-0.5\\cos\\frac{2\\pi n}{M-1}+0.08\\cos\\frac{4\\pi n}{M-1}' };
  function hdF(kind, m, w1, w2) {
    if (kind === 'lp') return m === 0 ? w1 / PI : Math.sin(w1 * m) / (PI * m);
    if (kind === 'hp') return m === 0 ? 1 - w1 / PI : -Math.sin(w1 * m) / (PI * m);
    if (kind === 'bp') return m === 0 ? (w2 - w1) / PI : (Math.sin(w2 * m) - Math.sin(w1 * m)) / (PI * m);
    return m === 0 ? 1 - (w2 - w1) / PI : -(Math.sin(w2 * m) - Math.sin(w1 * m)) / (PI * m);   // bs
  }
  function hdTex(kind, w1, w2) {
    if (kind === 'lp') return 'h_d(n)=\\frac{\\sin(' + piT(w1) + 'n)}{\\pi n},\\quad h_d(0)=' + nf(w1 / PI);
    if (kind === 'hp') return 'h_d(n)=\\delta(n)-\\frac{\\sin(' + piT(w1) + 'n)}{\\pi n},\\quad h_d(0)=1-' + nf(w1 / PI);
    if (kind === 'bp') return 'h_d(n)=\\frac{\\sin(' + piT(w2) + 'n)-\\sin(' + piT(w1) + 'n)}{\\pi n},\\quad h_d(0)=' + nf((w2 - w1) / PI);
    return 'h_d(n)=\\delta(n)-\\frac{\\sin(' + piT(w2) + 'n)-\\sin(' + piT(w1) + 'n)}{\\pi n}';
  }
  function Hdesc(kind, w1, w2) {
    if (kind === 'lp') return 'H_d(\\omega)=\\begin{cases}1,&|\\omega|<' + piT(w1) + '\\\\0,&' + piT(w1) + '\\le|\\omega|\\le\\pi\\end{cases}';
    if (kind === 'hp') return 'H_d(\\omega)=\\begin{cases}0,&|\\omega|<' + piT(w1) + '\\\\1,&' + piT(w1) + '\\le|\\omega|\\le\\pi\\end{cases}';
    if (kind === 'bp') return 'H_d(\\omega)=\\begin{cases}1,&' + piT(w1) + '<|\\omega|<' + piT(w2) + '\\\\0,&\\text{otherwise}\\end{cases}';
    return 'H_d(\\omega)=\\begin{cases}0,&' + piT(w1) + '<|\\omega|<' + piT(w2) + '\\\\1,&\\text{otherwise}\\end{cases}';
  }
  function Aw(h, w) { var M = h.length, al = (M - 1) / 2, s = 0; for (var n = 0; n < M; n++) s += h[n] * Math.cos((al - n) * w); return s; }

  QB.add({
    id: 'dsp.filt.fir-window', course: 'dsp', module: 'filt', topic: 'fir',
    title: 'Window-method FIR: compute the coefficients h(n)', difficulty: 2, marks: 6,
    variants: [{ id: 'lp', label: 'Lowpass' }, { id: 'hp', label: 'Highpass' }, { id: 'bp', label: 'Bandpass' }],
    tags: ['T9 Q9', 'DX1 Q8', 'D12 Ex 3', 'exam-style'],
    gen: function (r, v) {
      var M = r.pick([5, 7, 9, 7]), wk = r.pick(['rect', 'hanning', 'hamming', 'hamming', 'blackman', 'bartlett']);
      var w1, w2;
      if (v === 'lp') w1 = r.pick([PI / 4, PI / 3, PI / 2, PI / 6, PI / 5]);
      else if (v === 'hp') w1 = r.pick([PI / 2, PI / 3, 2 * PI / 3, PI / 4]);
      else { var pr = r.pick([[PI / 4, PI / 2], [PI / 3, 2 * PI / 3], [PI / 6, PI / 2], [PI / 4, 3 * PI / 4]]); w1 = pr[0]; w2 = pr[1]; }
      var al = (M - 1) / 2, rows = [], h = [], hd = [], wv = [];
      for (var n = 0; n < M; n++) { hd[n] = hdF(v, n - al, w1, w2); wv[n] = WIN[wk].f(n, M); h[n] = hd[n] * wv[n]; rows.push([n, n - al, nf(hd[n]), nf(wv[n]), nf(h[n])]); }
      var wT = v === 'lp' ? 0 : v === 'hp' ? PI : (w1 + w2) / 2;
      var Hv = Math.abs(Aw(h, wT));
      return {
        stem: 'A causal linear-phase FIR filter of length $M=' + M + '$ is to approximate ' + $$(Hdesc(v, w1, w2)) + 'using the window method with a <b>' + WIN[wk].name + '</b> window (course definition, $0\\le n\\le M-1$).',
        figure: null,
        parts: [
          { q: '(a) Find the ideal impulse response $h_d(n)$ and its value at $n=0$.', answers: [ans('$h_d(0)$', hdF(v, 0, w1, w2))], working: steps([
            'Inverse DTFT: $h_d(n)=\\dfrac1{2\\pi}\\int H_d(\\omega)e^{j\\omega n}d\\omega$.',
            $$(hdTex(v, w1, w2)),
            'It is noncausal and infinitely long, so it must be shifted and truncated.'
          ]) + fin('h_d(0)=' + nf(hdF(v, 0, w1, w2))) },
          { q: '(b) Shift by $\\alpha=(M-1)/2$ and window: $h(n)=h_d(n-\\alpha)w(n)$. Give $h(0)$, $h(1)$ and $h(' + al + ')$.', answers: [ans('$h(0)$', h[0], { abs: 0.0005 }), ans('$h(1)$', h[1], { abs: 0.0005 }), ans('$h(' + al + ')$', h[al])], working: steps([
            '$\\alpha=' + al + '$. Window: $' + WINF[wk] + '$.',
            'Compute half the table and mirror it (the result is symmetric):'
          ]) + QB.tbl(['$n$', '$n-\\alpha$', '$h_d(n-\\alpha)$', '$w(n)$', '$h(n)$'], rows) + fin('h(n)=' + seqTex(h, 0, 4)) },
          { q: '(c) Find $|H(\\omega)|$ at $\\omega=' + piT(wT) + '$ using $A(\\omega)=h(\\alpha)+2\\sum_{n<\\alpha}h(n)\\cos((\\alpha-n)\\omega)$.', answers: [ans('$|H(' + piT(wT) + ')|$', Hv)], working: steps([
            '$A(' + piT(wT) + ')=' + sumTex([[h[al], '']].concat(h.slice(0, al).map(function (q, n) { return [2 * q, '\\cos(' + piT((al - n) * wT) + ')']; }))) + '=' + nf(Aw(h, wT)) + '$.',
            v === 'lp' ? 'This is $\\sum h(n)$. It is not exactly 1 because the window truncates and tapers $h_d$; divide by $\\sum h(n)$ to force unity DC gain.' : 'Ideally this would be 1; the short window smears the response.'
          ]) + fin('|H|=' + nf(Hv)) }
        ],
        notes: QB.callout('trap', 'Use $M-1$ in the window cosine, shift by $\\alpha$ before windowing, and use the course sinc ($\\sin x/x$): $h_d(0)$ must equal $\\omega_c/\\pi$ for a lowpass.'),
        meta: { v: v, M: M, win: wk, w1: w1, w2: w2 || 0 }
      };
    }
  });

  var WSEL = [{ k: 'rect', A: 21, f: 4 }, { k: 'hanning', A: 44, f: 8 }, { k: 'hamming', A: 53, f: 8 }, { k: 'blackman', A: 75, f: 12 }];
  QB.add({
    id: 'dsp.filt.fir-spec', course: 'dsp', module: 'filt', topic: 'fir',
    title: 'Choose the window from As and the length M from the transition width', difficulty: 2, marks: 4,
    variants: [{ id: 'rad', label: 'Edges in rad/sample' }, { id: 'hz', label: 'Edges in Hz' }],
    tags: ['L10 slides 41-44', 'window table'],
    gen: function (r, v) {
      var S = r.retry(function () {
        var As = r.pick([18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 74]);
        var s = { As: As };
        if (v === 'hz') {
          s.Fs = r.pick([8000, 10000, 16000, 20000, 44100, 48000]);
          s.fp = Math.round(r.pick([0.1, 0.15, 0.2, 0.25]) * s.Fs / 100) * 100; s.fst = s.fp + Math.round(r.pick([0.02, 0.05, 0.08, 0.1]) * s.Fs / 100) * 100;
          if (s.fst <= s.fp || s.fst >= s.Fs / 2) return null;
          s.wp = 2 * PI * s.fp / s.Fs; s.ws = 2 * PI * s.fst / s.Fs;
        } else { s.wp = r.pick([0.2, 0.25, 0.3, 0.4]) * PI; s.ws = s.wp + r.pick([0.05, 0.1, 0.04, 0.08, 0.2]) * PI; }
        return s;
      });
      var W = WSEL.filter(function (q) { return q.A >= S.As; })[0];
      var dw = S.ws - S.wp;
      var Mraw = W.f * PI / dw, M = Math.ceil(Mraw - 1e-7); var Mo = M % 2 ? M : M + 1;
      var wc = (S.wp + S.ws) / 2, al = (Mo - 1) / 2;
      var spec = v === 'hz' ? 'passband edge ' + S.fp + ' Hz, stopband edge ' + S.fst + ' Hz, $F_s=' + S.Fs + '$ Hz' : '$\\omega_p=' + piT(S.wp) + '$, $\\omega_s=' + piT(S.ws) + '$';
      return {
        stem: 'A linear-phase FIR lowpass filter needs at least ' + S.As + ' dB stopband attenuation, with ' + spec + '. Design it by the window method, using the table of window properties (minimum stopband attenuation: rectangular 21 dB, Bartlett 26 dB, Hanning 44 dB, Hamming 53 dB, Blackman 75 dB; mainlobe width $4\\pi/M$, $8\\pi/M$, $8\\pi/M$, $8\\pi/M$, $12\\pi/M$). Take the transition width equal to the mainlobe width and use an odd $M$.',
        figure: null,
        parts: [
          { q: '(a) Which window should you use? Enter its minimum stopband attenuation in dB.', answers: [ans('window attenuation (dB)', W.A, { abs: 0.5 })], working: steps([
            'Pick the window with the narrowest mainlobe whose attenuation is at least ' + S.As + ' dB.',
            W.k === 'hanning' ? 'Bartlett (26 dB) and Hanning (44 dB) have the same mainlobe; ' + (S.As > 26 ? 'Bartlett is not enough, so Hanning.' : 'Hanning gives far more attenuation for the same width.') : 'The ' + WIN[W.k].name + ' window (' + W.A + ' dB) is the first that is enough.'
          ]) + fin('\\text{' + WIN[W.k].name + ' window}') },
          { q: '(b) Find the length $M$, the cutoff $\\omega_c$ of the ideal filter, and the delay $\\alpha$.', answers: [ansInt('$M$', Mo), ans('$\\omega_c$', wc, { unit: 'rad' }), ans('$\\alpha$', al)], working: steps([
            (v === 'hz' ? '$\\omega_p=2\\pi(' + S.fp + ')/' + S.Fs + '=' + piT(S.wp) + '$, $\\omega_s=' + piT(S.ws) + '$. ' : '') + 'Transition width $\\Delta\\omega=\\omega_s-\\omega_p=' + piT(dw) + '$.',
            '$' + W.f + '\\pi/M\\le\\Delta\\omega\\Rightarrow M\\ge' + W.f + '\\pi/' + nf(dw) + '=' + nf(Mraw) + '$, so $M=' + M + '$' + (M !== Mo ? ', made odd: $M=' + Mo + '$.' : '.'),
            '$\\omega_c=(\\omega_p+\\omega_s)/2=' + piT(wc) + '$ and $\\alpha=(M-1)/2=' + al + '$ samples.'
          ]) + fin('M=' + Mo + ',\\ \\omega_c=' + piT(wc) + ',\\ \\alpha=' + al) }
        ],
        notes: QB.callout('tip', 'A taper buys lower sidelobes with a wider mainlobe: a wider transition for the same $M$.'),
        meta: { v: v, As: S.As, wp: S.wp, ws: S.ws }
      };
    }
  });

  QB.add({
    id: 'dsp.filt.fir-ideal', course: 'dsp', module: 'filt', topic: 'fir',
    title: 'Ideal impulse responses by the inverse DTFT', difficulty: 1, marks: 3,
    variants: [{ id: 'lpdelay', label: 'Lowpass with built-in delay' }, { id: 'hp', label: 'Highpass' }, { id: 'bs', label: 'Bandstop' }],
    tags: ['T9 Q1', 'L10 slide 38'],
    gen: function (r, v) {
      var w1, w2, D = 0, kind;
      if (v === 'lpdelay') { w1 = r.pick([PI / 4, PI / 3, PI / 2, PI / 6]); D = r.int(2, 4); kind = 'lp'; }
      else if (v === 'hp') { w1 = r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3]); kind = 'hp'; }
      else { var pr = r.pick([[PI / 4, PI / 2], [PI / 3, 2 * PI / 3], [PI / 6, PI / 2]]); w1 = pr[0]; w2 = pr[1]; kind = 'bs'; }
      var ns = [D, D + 1, D + 2];
      var vals = ns.map(function (n) { return hdF(kind, n - D, w1, w2); });
      var Ht = v === 'lpdelay' ? 'H_d(\\omega)=\\begin{cases}e^{-j' + D + '\\omega},&|\\omega|<' + piT(w1) + '\\\\0,&\\text{otherwise}\\end{cases}' : Hdesc(kind, w1, w2);
      return {
        stem: 'Find the impulse response of the ideal filter ' + $$(Ht) + 'and explain why it cannot be built exactly.',
        figure: null,
        parts: [
          { q: '(a) Find $h_d(n)$ and evaluate it at $n=' + ns.join(', ') + '$.', answers: ns.map(function (n, i) { return ans('$h_d(' + n + ')$', vals[i], { abs: 0.0005 }); }), working: steps([
            v === 'lpdelay' ? '$h_d(n)=\\dfrac1{2\\pi}\\int_{-\\omega_c}^{\\omega_c}e^{-j' + D + '\\omega}e^{j\\omega n}d\\omega=\\dfrac{\\sin(\\omega_c(n-' + D + '))}{\\pi(n-' + D + ')}$: the delay just shifts the sinc.' : (v === 'hp' ? 'Highpass $=1-$lowpass, so $h_d(n)=\\delta(n)-\\dfrac{\\sin\\omega_cn}{\\pi n}$.' : 'Bandstop $=1-$bandpass: $h_d(n)=\\delta(n)-\\dfrac{\\sin\\omega_2n-\\sin\\omega_1n}{\\pi n}$.'),
            $(hdTex(kind, w1, w2).replace(/n\)/g, 'n)') + (D ? '\\ (\\text{with } n\\to n-' + D + ')' : '')),
            ns.map(function (n, i) { return '$h_d(' + n + ')=' + nf(vals[i]) + '$'; }).join(', ')
          ]) + fin(ns.map(function (n, i) { return 'h_d(' + n + ')=' + nf(vals[i]); }).join(',\\ ')) },
          { q: '(b) Is $h_d(n)$ causal? Is it of finite length?', answers: [flag('causal? (1/0)', false), flag('finite length? (1/0)', false)], working: steps(['$h_d(n)\\ne0$ for $n<0$ (the sinc tails extend both ways), so it is noncausal; it is also infinitely long. These are the two reasons the ideal filter is not realisable (T9 Q1). A delay alone cannot fix either.']) + fin('\\text{noncausal, infinite length}') }
        ],
        meta: { v: v, w1: w1, w2: w2 || 0, D: D }
      };
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);

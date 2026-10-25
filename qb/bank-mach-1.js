/* bank-mach-1.js — Electrical Machines question bank, part 1
 * Course 'mach', modules 'ac' (power, phasor, pfc, 3ph, dc) and 'mag'
 * (magcct, energy, ironloss, ideal, eqcct, regeff, tx3ph).
 * Methods and notation follow packs M1–M5 and the Jun23/Jun24/mock papers:
 *   rms phasors, V1 = V1∠0° reference, φ = angle of I relative to V (lag φ<0, Q>0),
 *   S = V I*, n = N1/N2, simplified transformer circuit referred to the primary,
 *   torque τ, ω = 2πn/60.
 * Figures are drawn with the low-level QB.sch.drawing() API (no templates needed).
 * Each Q also carries Q.data (raw inputs) for the Python cross-check in tests/.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var QB = G.QB;
  if (!QB || !QB.add) return;
  var F = QB.fmt, TX = F.tex, CX = QB.cx;
  var PI = Math.PI, SQ3 = Math.sqrt(3), MU0 = 4 * PI * 1e-7, G0 = 9.81;

  /* ------------------------------------------------------------ helpers */
  function sg(x, s) { return parseFloat(Number(x).toPrecision(s || 3)); }
  function N(x, s) { return TX.num(x, s || 4); }
  function E(x, u, s) { return TX.eng(x, u, s || 4); }
  function DG(x, s) { return N(x, s || 4) + '^\\circ'; }
  function PL(mag, deg, u) { var dd = Math.abs(deg) < 5e-9 ? 0 : deg; return N(mag) + '\\angle{' + N(dd) + '^\\circ}' + (u ? '\\ \\text{' + u + '}' : ''); }
  function PZ(z, u) { return PL(z.abs(), z.argd(), u); }
  function CR(z) { return F.cx(z, 4); }
  function txt(u) { return '\\ \\text{' + u + '}'; }
  function ohmT(x, s) { return E(x, 'Ω', s); }
  function pv(x, u, s) { return F.eng(x, u, s || 4); }        // plain text for SVG values
  function m(s) { return '$' + s + '$'; }
  function mm(s) { return '$$' + s + '$$'; }
  function ans(label, value, unit, o) {
    o = o || {};
    var a = { label: label, value: value, unit: unit || '', tol: o.tol == null ? 0.01 : o.tol, sig: o.sig || 4 };
    if (o.abs != null) a.abs = o.abs;
    if (o.alt) a.alt = o.alt;
    if (o.hint) a.hint = o.hint;
    return a;
  }
  function angA(label, deg, o) { o = o || {}; return ans(label, deg, '°', { abs: o.abs || 0.3, tol: 0.005, hint: o.hint }); }
  function pctA(label, v, o) { o = o || {}; return ans(label, v, '%', { abs: o.abs || 0.05, tol: 0.003, hint: o.hint }); }
  function W(steps, fin) { return QB.steps(steps) + (fin ? QB.final(fin) : ''); }
  function P(q, answers, steps, fin) { return { q: q, answers: answers || [], working: W(steps, fin) }; }
  function ll(Q) { return Math.abs(Q) < 1e-9 ? 'unity' : (Q > 0 ? 'lag' : 'lead'); }
  function pfT(pf, Q) { return N(pf) + '\\ \\text{' + ll(Q) + '}'; }
  function acosd(x) { return Math.acos(x) * 180 / PI; }
  function tand(d) { return Math.tan(d * PI / 180); }
  function sind(d) { return Math.sin(d * PI / 180); }
  function cosd(d) { return Math.cos(d * PI / 180); }
  function omega(f) { return 2 * PI * f; }
  function wT(f) { return '\\omega = 2\\pi(' + f + ') = ' + N(omega(f)) + '\\ \\text{rad/s}'; }
  function Q(stem, figure, given, parts, notes, data) { return { stem: stem, figure: figure || null, given: given || [], parts: parts, notes: notes || '', data: data || {} }; }
  /** register a type; gen is retried until it returns a valid (non-null) instance */
  function ADD(t) { var g = t.gen; t.gen = function (r, v) { return r.retry(function () { return g(r, v); }, 400); }; return QB.add(t); }
  function trap(h) { return QB.callout('trap', h); }
  function tip(h) { return QB.callout('tip', h); }

  /* ------------------------------------------------------------ figures */
  var S = QB.sch;
  function elem(d, k, o) {
    if (k === 'R') return d.resistor(o);
    if (k === 'L') return d.inductor(o);
    if (k === 'C') return d.capacitor(o);
    if (k === 'M') return d.mach(Object.assign({ text: o.text || 'M' }, o));
    return d.zbox(o);
  }
  /** single loop: AC source on the left, series elements along the top */
  function figSeries(els, o) {
    o = o || {};
    var d = S.drawing(), H = 130, step = 85, x = 40;
    d.acsrc({ from: [0, H], to: [0, 0], label: o.src || 'V_1', value: o.srcv, side: 'left' });
    d.wire({ from: [0, 0], to: [x, 0] });
    els.forEach(function (e) { elem(d, e.k, { from: [x, 0], to: [x + step, 0], label: e.label, value: e.value, side: 'top' }); x += step; });
    d.wire({ from: [x, 0], to: [x + 25, 0] }); d.wire({ from: [x + 25, 0], to: [x + 25, H] }); d.wire({ from: [x + 25, H], to: [0, H] });
    if (o.I) d.current({ at: [20, 0], dir: 'right', label: o.I, side: 'bottom' });
    return d.svg({ title: o.title || 'Series circuit' });
  }
  /** AC source feeding parallel branches; each branch is an array of elements (top to bottom) */
  function figParallel(branches, o) {
    o = o || {};
    var d = S.drawing(), H = 150, gap = o.gap || 105, n = branches.length;
    d.acsrc({ from: [0, H], to: [0, 0], label: o.src || 'V_1', value: o.srcv, side: 'left' });
    var xr = gap * n;
    d.wire({ from: [0, 0], to: [xr, 0] }); d.wire({ from: [0, H], to: [xr, H] });
    branches.forEach(function (b, i) {
      var x = gap * (i + 1), seg = H / b.els.length;
      b.els.forEach(function (e, j) {
        var y0 = j * seg, y1 = (j + 1) * seg;
        if (b.els.length > 1) { y0 += j === 0 ? 0 : 0; }
        elem(d, e.k, { from: [x, y0], to: [x, y1], label: e.label, value: e.value, side: 'right', text: e.text });
      });
      if (i < n - 1) { d.dot([x, 0]); d.dot([x, H]); }
      if (b.I) d.current({ at: [x, b.els.length > 1 ? 14 : 18], dir: 'down', label: b.I, side: 'left', len: 16 });
    });
    if (o.I) d.current({ at: [gap * 0.45, 0], dir: 'right', label: o.I, side: 'top' });
    return d.svg({ title: o.title || 'Parallel circuit' });
  }
  /** battery / DC source model with a load (resistor or motor) */
  function figBattery(o) {
    o = o || {};
    var d = S.drawing();
    d.rect(-80, -44, 182, 196, { dash: '5 4', noObstacle: true });
    d.vsrc({ from: [0, 125], to: [0, 45], label: 'E', value: o.E, side: 'left' });
    d.wire({ from: [0, 45], to: [0, 0] });
    d.resistor({ from: [0, 0], to: [80, 0], label: 'R_S', value: o.RS, side: 'top' });
    d.wire({ from: [80, 0], to: [130, 0] }); d.wire({ from: [0, 125], to: [130, 125] });
    d.terminal([130, 0]); d.terminal([130, 125]);
    d.label([136, 62], o.Vlab || 'V', { anchor: 'start' });
    d.wire({ from: [130, 0], to: [200, 0] }); d.wire({ from: [130, 125], to: [200, 125] });
    if (o.load === 'M') d.mach({ from: [200, 0], to: [200, 125], text: 'M', label: o.loadLab || '', value: o.loadVal, side: 'right' });
    else if (o.load === 'R') d.resistor({ from: [200, 0], to: [200, 125], label: o.loadLab || 'R_L', value: o.loadVal, side: 'right' });
    else d.zbox({ from: [200, 0], to: [200, 125], label: o.loadLab || 'load', value: o.loadVal, side: 'right' });
    d.current({ at: [165, 0], dir: 'right', label: 'I', side: 'top' });
    d.label([11, 166], 'battery model', { anchor: 'middle', plain: true, size: 11 });
    return d.svg({ title: 'Battery model with load' });
  }
  /** DC source, cable resistance (go + return), motor */
  function figCable(o) {
    o = o || {};
    var d = S.drawing();
    d.vsrc({ from: [0, 120], to: [0, 0], label: 'E', value: o.E, side: 'left' });
    d.resistor({ from: [0, 0], to: [110, 0], label: 'R_{cable}', value: o.R, side: 'top' });
    d.wire({ from: [110, 0], to: [210, 0] }); d.wire({ from: [0, 120], to: [210, 120] });
    d.terminal([140, 0]); d.terminal([140, 120]);
    d.label([150, 60], 'V_M', { anchor: 'start' });
    d.mach({ from: [210, 0], to: [210, 120], text: 'M', side: 'right', label: o.mlab, value: o.mval });
    d.current({ at: [125, 0], dir: 'right', label: 'I', side: 'top' });
    return d.svg({ title: 'DC source, cable and motor' });
  }
  /** three-phase balanced load in star or delta, terminals a, b, c */
  function fig3phLoad(conn, zlab, zval, o) {
    o = o || {};
    var d = S.drawing();
    if (conn === 'star') {
      var Nn = [220, 80], A = [220, 0], B = [150, 140], Cc = [290, 140];
      d.wire({ from: [0, 0], to: A }); d.wire({ from: [0, 140], to: B }); d.wire({ from: [0, 200], to: [290, 200] }); d.wire({ from: [290, 200], to: Cc });
      d.zbox({ from: A, to: Nn, label: zlab, value: zval, side: 'right' });
      d.zbox({ from: B, to: Nn, label: zlab, side: 'left' });
      d.zbox({ from: Cc, to: Nn, label: zlab, side: 'right' });
      d.dot(Nn); d.label([234, 86], 'N', { anchor: 'start', plain: true });
    } else {
      var A2 = [220, 0], B2 = [160, 120], C2 = [280, 120];
      d.wire({ from: [0, 0], to: A2 }); d.wire({ from: [0, 120], to: B2 }); d.wire({ from: [0, 180], to: [280, 180] }); d.wire({ from: [280, 180], to: C2 });
      d.zbox({ from: A2, to: B2, label: zlab, value: zval, side: 'left' });
      d.zbox({ from: B2, to: C2, label: zlab, side: 'bottom' });
      d.zbox({ from: C2, to: A2, label: zlab, side: 'right' });
      d.dot(A2); d.dot(B2); d.dot(C2);
    }
    var ys = conn === 'star' ? [0, 140, 200] : [0, 120, 180];
    ['a', 'b', 'c'].forEach(function (t, i) { d.terminal([0, ys[i]], { label: t, side: 'left' }); });
    d.current({ at: [60, 0], dir: 'right', label: 'I_L', side: 'top' });
    if (o.VL) d.label([-24, (ys[0] + ys[1]) / 2], 'V_L = ' + o.VL, { anchor: 'end', size: 12 });
    d.label([110, ys[2] + 22], conn === 'star' ? 'star (Y)' : 'delta (Δ)', { anchor: 'middle', plain: true, size: 11 });
    return d.svg({ title: conn === 'star' ? 'Balanced star load' : 'Balanced delta load' });
  }
  /** three-phase supply bus with load boxes (block diagram) */
  function figBus(boxes, o) {
    o = o || {};
    var d = S.drawing(), n = boxes.length, dx = 120, xr = 40 + dx * n;
    [0, 14, 28].forEach(function (y, i) { d.wire({ from: [0, y], to: [xr, y] }); d.terminal([0, y]); d.label([-8, y], 'abc'[i], { anchor: 'end', plain: true, size: 11 }); });
    d.label([10, -16], o.supply || '3-phase supply', { anchor: 'start', plain: true, size: 11 });
    boxes.forEach(function (b, i) {
      var x = 70 + dx * i;
      [0, 14, 28].forEach(function (y, k) { d.wire({ from: [x - 14 + 14 * k, y], to: [x - 14 + 14 * k, 70] }); d.dot([x - 14 + 14 * k, y], { r: 2.4 }); });
      d.rect(x - 42, 70, 84, 50, { fill: '#fff' });
      d.label([x, 86], b.t, { anchor: 'middle', plain: true, size: 12 });
      if (b.s) d.label([x, 104], b.s, { anchor: 'middle', plain: true, size: 10.5 });
    });
    return d.svg({ title: 'Three-phase supply and loads' });
  }
  /** C-core / U-core / toroid with coil */
  function figCore(o) {
    o = o || {};
    var d = S.drawing(), grey = '#d6d6d6', t = 30;
    var type = o.type || 'C1';
    if (type === 'toroid') {
      d.circle(100, 100, 85, { fill: grey }); d.circle(100, 100, 50, { fill: '#fff' });
      d.rect(140, 95, 50, 10, { fill: '#fff', stroke: 'none', noObstacle: true });
      d.line([148, 95], [186, 95]); d.line([148, 105], [186, 105]);
      if (o.gap) d.labelNear([188, 100], o.gap, { prefer: ['right'], gap: 8 });
      for (var k = 0; k < 5; k++) { var a1 = (150 + k * 12) * PI / 180; d.line([100 + 44 * Math.cos(a1), 100 - 44 * Math.sin(a1)], [100 + 92 * Math.cos(a1 + 0.12), 100 - 92 * Math.sin(a1 + 0.12)]); }
      var aS = (150) * PI / 180, aE = (198) * PI / 180;
      var p1 = [100 + 92 * Math.cos(aS + 0.12), 100 - 92 * Math.sin(aS + 0.12)], p2 = [100 + 92 * Math.cos(aE + 0.12), 100 - 92 * Math.sin(aE + 0.12)];
      d.wire({ from: p1, to: [-75, p1[1]] }); d.wire({ from: p2, to: [-75, p2[1]] });
      d.terminal([-75, p1[1]]); d.terminal([-75, p2[1]]);
      d.current({ at: [-45, p1[1]], dir: 'right', label: 'I', side: 'top' });
      if (o.N) d.label([-72, (p1[1] + p2[1]) / 2], o.N, { anchor: 'start', size: 12 });
      d.circle(100, 100, 67.5, { dash: '4 4', noObstacle: true });
      if (o.A) d.label([100, 200], o.A, { anchor: 'middle', valign: 'top', size: 12 });
      if (o.extra) d.label([100, 222], o.extra, { anchor: 'middle', valign: 'top', size: 12 });
      return d.svg({ title: 'Toroidal core with a saw-cut gap' });
    }
    var W0 = 220, H0 = 170;
    d.rect(0, 0, W0, H0, { fill: grey }); d.rect(t, t, W0 - 2 * t, H0 - 2 * t, { fill: '#fff' });
    function gapH(x0, y0, g) { d.rect(x0 - 1, y0, t + 2, g, { fill: '#fff', stroke: 'none', noObstacle: true }); d.line([x0, y0], [x0 + t, y0]); d.line([x0, y0 + g], [x0 + t, y0 + g]); }
    function gapV(x0, y0, g) { d.rect(x0, y0 - 1, g, t + 2, { fill: '#fff', stroke: 'none', noObstacle: true }); d.line([x0, y0], [x0, y0 + t]); d.line([x0 + g, y0], [x0 + g, y0 + t]); }
    if (type === 'C1') { gapH(W0 - t, H0 / 2 - 5, 10); if (o.gap) d.labelNear([W0 + 4, H0 / 2], o.gap, { prefer: ['right'], gap: 6 }); }
    if (type === 'C2' || type === 'paper') {
      var gw = type === 'paper' ? 4 : 10;
      gapV(W0 / 2 - gw / 2, 0, gw); gapV(W0 / 2 - gw / 2, H0 - t, gw);
      if (o.gap) d.labelNear([W0 / 2, -4], o.gap, { prefer: ['top'], gap: 6 });
      d.label([W0 / 2, H0 + 8], type === 'paper' ? 'paper at both joints' : 'two gaps', { anchor: 'middle', valign: 'top', plain: true, size: 11 });
    }
    if (type === 'U2') {
      gapH(0, H0 - t - 10, 10); gapH(W0 - t, H0 - t - 10, 10);
      d.rect(-1, H0 - t - 10 + 0.5, W0 + 2, 9, { fill: '#fff', stroke: 'none', noObstacle: true });
      d.line([0, H0 - t - 10], [t, H0 - t - 10]); d.line([W0 - t, H0 - t - 10], [W0, H0 - t - 10]);
      d.line([0, H0 - t], [W0, H0 - t]); d.line([t, H0 - t - 10], [W0 - t, H0 - t - 10]);
      d.line([0, H0 - t - 10], [0, H0 - t - 10]);
      if (o.gap) d.labelNear([W0 + 4, H0 - t - 5], o.gap, { prefer: ['right'], gap: 6 });
      d.label([W0 / 2, H0 + 8], 'armature', { anchor: 'middle', valign: 'top', plain: true, size: 11 });
    }
    // coil on the left limb
    var y0 = 40, dy = 15, nt = 5;
    for (var j = 0; j < nt; j++) d.line([-7, y0 + j * dy], [t + 7, y0 + j * dy + 8]);
    var yb = y0 + (nt - 1) * dy;
    d.wire({ from: [-7, y0], to: [-95, y0] }); d.wire({ from: [-7, yb], to: [-95, yb] });
    d.terminal([-95, y0]); d.terminal([-95, yb]);
    d.current({ at: [-60, y0], dir: 'right', label: 'I', side: 'top' });
    if (o.N) d.label([-92, (y0 + yb) / 2], o.N, { anchor: 'start', size: 12 });
    d.rect(t / 2, t / 2, W0 - t, H0 - t, { dash: '4 4', noObstacle: true });
    var lines = [o.A, o.l, o.mu].filter(Boolean);
    lines.forEach(function (s, i) { d.label([W0 / 2, t + 22 + i * 20], s, { anchor: 'middle', size: 12 }); });
    return d.svg({ title: 'Magnetic core with coil' });
  }
  /** shell core with coil on the centre limb */
  function figShell(o) {
    o = o || {};
    var d = S.drawing(), grey = '#d6d6d6';
    var Wd = 280, Hd = 180, to = 28, tc = 48, win = (Wd - 2 * to - tc) / 2;
    d.rect(0, 0, Wd, Hd, { fill: grey });
    d.rect(to, to, win, Hd - 2 * to, { fill: '#fff' });
    d.rect(to + win + tc, to, win, Hd - 2 * to, { fill: '#fff' });
    var xc = to + win;
    function gapH(x0, w, y0, g) { d.rect(x0 - 1, y0, w + 2, g, { fill: '#fff', stroke: 'none', noObstacle: true }); d.line([x0, y0], [x0 + w, y0]); d.line([x0, y0 + g], [x0 + w, y0 + g]); }
    if (o.gapC) gapH(xc, tc, Hd / 2 + 22, 8);
    if (o.gapR) gapH(Wd - to, to, Hd / 2 - 4, 8);
    for (var j = 0; j < 4; j++) d.line([xc - 6, 50 + j * 13], [xc + tc + 6, 50 + j * 13 + 7]);
    d.wire({ from: [xc - 6, 50], to: [xc - 30, 50] }); d.wire({ from: [xc - 6, 89], to: [xc - 30, 89] });
    d.terminal([xc - 30, 50]); d.terminal([xc - 30, 89]);
    if (o.N) d.label([xc - 34, 70], o.N, { anchor: 'end', size: 12 });
    d.wire({ from: [xc + tc / 2, Hd / 2 + 50], to: [xc + tc / 2, 30], arrow: 'end', dash: '4 3' });
    d.label([xc + tc / 2 + 6, 128], '\\Phi', { anchor: 'start', size: 12 });
    if (o.gapC) d.label([xc + tc + 8, Hd / 2 + 26], o.gapC, { anchor: 'start', size: 12 });
    if (o.gapR) d.label([Wd + 8, Hd / 2], o.gapR, { anchor: 'start', size: 12 });
    (o.notes || []).forEach(function (s, i) { d.label([Wd / 2, Hd + 12 + i * 18], s, { anchor: 'middle', valign: 'top', size: 11.5, plain: true }); });
    return d.svg({ title: 'Shell-type core' });
  }
  /** ideal transformer: source, series R, n:1, load */
  function figIdeal(o) {
    o = o || {};
    var d = S.drawing(), H = 110;
    d.acsrc({ from: [0, H], to: [0, 0], label: 'V_S', value: o.Vs, side: 'left' });
    d.resistor({ from: [0, 0], to: [90, 0], label: o.Rlab || 'R_S', value: o.Rs, side: 'top' });
    d.wire({ from: [90, 0], to: [120, 0] }); d.wire({ from: [0, H], to: [120, H] });
    var t = d.transformer({ at: [120, 0], h: H, w: 80, ratio: o.ratio, dots: 'same' });
    d.wire({ from: t.s1, to: [270, 0] }); d.wire({ from: t.s2, to: [270, H] });
    if (o.loadK === 'R') d.resistor({ from: [270, 0], to: [270, H], label: 'R_L', value: o.ZL, side: 'right' });
    else d.zbox({ from: [270, 0], to: [270, H], label: 'Z_L', value: o.ZL, side: 'right' });
    d.current({ at: [105, 0], dir: 'right', label: 'I_1', side: 'top' });
    d.current({ at: [235, 0], dir: 'right', label: 'I_2', side: 'top' });
    if (o.zarrows) {
      [[8, 'Z_3'], [85, 'Z_2'], [215, 'Z_1']].forEach(function (p) { d.wire({ from: [p[0], H + 18], to: [p[0] + 26, H + 18], arrow: 'end' }); d.label([p[0] + 13, H + 32], p[1], { anchor: 'middle' }); });
    }
    d.label([110, H / 2], 'V_1', { anchor: 'end' }); d.label([212, H / 2], 'V_2', { anchor: 'start' });
    return d.svg({ title: 'Ideal transformer circuit' });
  }
  /** simplified equivalent circuit referred to the primary */
  function figEquiv(o) {
    o = o || {};
    var d = S.drawing(), H = 140;
    d.terminal([0, 0]); d.terminal([0, H]);
    d.label([-8, H / 2], o.V1 || 'V_1', { anchor: 'end' });
    d.wire({ from: [0, 0], to: [150, 0] }); d.wire({ from: [0, H], to: [o.load ? 370 : 330, H] });
    d.resistor({ from: [55, 0], to: [55, H], label: 'R_C', value: o.Rc, side: 'right' });
    d.inductor({ from: [125, 0], to: [125, H], label: 'jX_M', value: o.Xm, side: 'right' });
    d.dot([55, 0]); d.dot([125, 0]); d.dot([55, H]); d.dot([125, H]);
    d.resistor({ from: [150, 0], to: [225, 0], label: 'R', value: o.R, side: 'top' });
    d.inductor({ from: [225, 0], to: [300, 0], label: 'jX', value: o.X, side: 'top' });
    d.wire({ from: [300, 0], to: [o.load ? 370 : 330, 0] });
    d.terminal([330, 0]); d.terminal([330, H]);
    d.label([337, H / 2 + (o.load ? 30 : 0)], "V_2'", { anchor: 'start' });
    if (o.load) d.zbox({ from: [370, 0], to: [370, H], label: o.loadLab || "Z_L'", value: o.load, side: 'right' });
    d.current({ at: [22, 0], dir: 'right', label: 'I_1', side: 'top' });
    d.current({ at: [315, 0], dir: 'right', label: "I_2'", side: 'top' });
    if (o.note) d.label([165, H + 22], o.note, { anchor: 'middle', plain: true, size: 11 });
    return d.svg({ title: 'Simplified equivalent circuit referred to the primary' });
  }
  /** OC or SC test set-up */
  function figTest(kind, o) {
    o = o || {};
    var d = S.drawing(), H = 120;
    d.acsrc({ from: [0, H], to: [0, 0], label: kind === 'sc' ? 'reduced V' : 'rated V', side: 'left' });
    d.meter({ from: [0, 0], to: [60, 0], kind: 'A' });
    d.meter({ from: [60, 0], to: [120, 0], kind: 'W' });
    d.wire({ from: [120, 0], to: [190, 0] }); d.wire({ from: [0, H], to: [190, H] });
    d.meter({ from: [155, 0], to: [155, H], kind: 'V' }); d.dot([155, 0]); d.dot([155, H]);
    var t = d.transformer({ at: [190, 0], h: H, w: 80, dots: false });
    if (kind === 'sc') { d.wire({ from: t.s1, to: [300, 0] }); d.wire({ from: t.s2, to: [300, H] }); d.wire({ from: [300, 0], to: [300, H] }); d.label([306, H / 2], 'short', { anchor: 'start', plain: true, size: 11 }); }
    else { d.wire({ from: t.s1, to: [300, 0] }); d.wire({ from: t.s2, to: [300, H] }); d.terminal([300, 0]); d.terminal([300, H]); d.label([306, H / 2], 'open', { anchor: 'start', plain: true, size: 11 }); }
    d.label([230, H + 14], (kind === 'sc' ? 'SC test' : 'OC test') + (o.side ? ' on ' + o.side + ' side' : ''), { anchor: 'middle', valign: 'top', plain: true, size: 11 });
    return d.svg({ title: kind === 'sc' ? 'Short-circuit test' : 'Open-circuit test' });
  }
  /** Y or Δ winding symbols for a 3-phase transformer */
  function figConn(hv, lv, o) {
    o = o || {};
    var d = S.drawing();
    function sym(cx, cy, c) {
      if (c === 'Y') { [90, 210, 330].forEach(function (a) { d.line([cx, cy], [cx + 36 * cosd(a), cy - 36 * sind(a)]); }); d.dot([cx, cy], { r: 2.4 }); }
      else { var p = [90, 210, 330].map(function (a) { return [cx + 40 * cosd(a), cy - 40 * sind(a)]; }); d.poly([p[0], p[1], p[2]], { closed: true }); }
    }
    sym(60, 60, hv); sym(250, 60, lv);
    d.wire({ from: [115, 60], to: [195, 60], arrow: 'end' });
    d.label([60, 118], 'HV: ' + (hv === 'Y' ? 'star' : 'delta'), { anchor: 'middle', plain: true, size: 11.5 });
    d.label([250, 118], 'LV: ' + (lv === 'Y' ? 'star' : 'delta'), { anchor: 'middle', plain: true, size: 11.5 });
    if (o.hvV) d.label([60, 136], o.hvV, { anchor: 'middle', plain: true, size: 11.5 });
    if (o.lvV) d.label([250, 136], o.lvV, { anchor: 'middle', plain: true, size: 11.5 });
    d.label([155, 44], o.mid || '', { anchor: 'middle', plain: true, size: 11 });
    return d.svg({ title: 'Three-phase transformer connection' });
  }
  /** daily load profile (bars) */
  function figProfile(periods) {
    var d = S.drawing(), sx = 14, sy = 90, t0 = 0;
    d.line([0, 0], [0, -1.45 * sy]); d.line([0, 0], [24 * sx + 10, 0]);
    [0, 6, 12, 18, 24].forEach(function (h) { d.line([h * sx, 0], [h * sx, 4]); d.label([h * sx, 14], String(h), { anchor: 'middle', plain: true, size: 10.5 }); });
    d.label([24 * sx + 14, 0], 'h', { anchor: 'start', plain: true, size: 10.5 });
    [0.5, 1].forEach(function (v) { d.line([-4, -v * sy], [0, -v * sy]); d.label([-7, -v * sy], String(v), { anchor: 'end', plain: true, size: 10.5 }); });
    d.label([4, -1.45 * sy - 8], 'load (pu of rating)', { anchor: 'start', plain: true, size: 10.5 });
    periods.forEach(function (p) {
      var x0 = t0 * sx, w = p.h * sx, h = Math.max(p.x * sy, 0.5);
      if (p.x > 0) d.rect(x0, -h, w, h, { fill: '#e2e2e2', noObstacle: true });
      d.label([x0 + w / 2, -h - 8], p.x > 0 ? p.lab : 'no load', { anchor: 'middle', plain: true, size: 10 });
      t0 += p.h;
    });
    return d.svg({ title: 'Daily load profile' });
  }
  /** v(t) and i(t) sketch with a time shift */
  function figWave(o) {
    var d = S.drawing(), Tpx = 160, Av = 50, Ai = 34, sh = o.shiftFrac * Tpx;   // sh > 0: current peaks later (lag)
    d.line([0, 0], [1.6 * Tpx, 0]); d.line([0, -62], [0, 62]);
    function curve(A, s, dash) { var pts = []; for (var k = 0; k <= 64; k++) { var x = k * 1.6 * Tpx / 64; pts.push([x, -A * Math.cos(2 * PI * (x - s) / Tpx)]); } d.poly(pts, { dash: dash, noObstacle: true }); }
    curve(Av, 0); curve(Ai, sh, '5 3');
    var xv = Tpx, xi = Tpx + sh;
    d.line([xv, -Av], [xv, -Av - 14]); d.line([xi, -Ai], [xi, -Av - 14]);
    d.wire({ from: [Math.min(xv, xi), -Av - 10], to: [Math.max(xv, xi), -Av - 10], arrow: 'both' });
    d.label([(xv + xi) / 2, -Av - 22], 'Δt', { anchor: 'middle', valign: 'bottom', plain: true, size: 11.5 });
    d.label([1.6 * Tpx + 6, 0], 't', { anchor: 'start' });
    d.label([30, -Av - 4], 'v(t)', { anchor: 'middle', valign: 'bottom', size: 11.5 });
    d.label([1.6 * Tpx - 4, Av + 14], 'i(t): dashed', { anchor: 'end', valign: 'top', plain: true, size: 11 });
    return d.svg({ title: 'Voltage and current waveforms' });
  }

  /* ============================================================ MODULE 1 · AC POWER */

  /* ---------- ac.power ---------- */
  ADD({
    id: 'mach.ac.power.mech-eff', course: 'mach', module: 'ac', topic: 'power',
    title: 'Motor or generator: input, output, efficiency and torque', difficulty: 1, marks: 5,
    variants: [{ id: '1ph', label: 'Single-phase motor (V, I, pf, τ, n)' }, { id: '3ph', label: 'Three-phase motor (find pf, η)' },
      { id: 'rated', label: 'Rated output, η and speed (find P_IN, τ, I)' }, { id: 'gen', label: 'Generator driven at τ, n' }],
    tags: ['exam-style', 'Q1', 'Jun24 Q1b', '2023 quiz Q1'],
    gen: function (r, v) {
      var n = r.pick([650, 960, 1420, 1430, 1450, 1455, 1460, 1750, 2860, 2900, 2910]), w = 2 * PI * n / 60;
      var wS = '\\omega = \\dfrac{2\\pi n}{60} = \\dfrac{2\\pi(' + n + ')}{60} = ' + N(w) + txt('rad/s');
      if (v === '1ph') {
        var V = r.pick([110, 115, 120, 230, 240]), I = r.float(V < 200 ? 6 : 3, V < 200 ? 18 : 12, 1), pf = r.float(0.7, 0.92, 2);
        var Pin = V * I * pf, eta0 = r.float(0.72, 0.9, 2), tau = sg(eta0 * Pin / w, 3), Pout = tau * w, eta = Pout / Pin;
        if (eta > 0.95 || eta < 0.6) return null;
        return Q('A single-phase AC motor runs from ' + m(E(V, 'V')) + ' and draws ' + m(E(I, 'A')) + ' at a power factor of ' + N(pf) + ' lagging. Its output shaft runs at ' + n + ' rpm with an output torque of ' + m(E(tau, 'N·m')) + '.', null,
          [['$V_1$', V + ' V'], ['$I_1$', I + ' A'], ['pf', pf + ' lag'], ['$n$', n + ' rpm'], ['$\\tau$', tau + ' Nm']],
          [P('(a) Find the input (electrical) power.', [ans('$P_{IN}$', Pin, 'W')],
            ['A motor\'s input is electrical: ' + m('P_{IN} = V_1I_1\\cos\\phi = ' + V + '\\times' + I + '\\times' + pf)], 'P_{IN} = ' + E(Pin, 'W')),
          P('(b) Find the output (mechanical) power.', [ans('$\\omega$', w, 'rad/s'), ans('$P_{OUT}$', Pout, 'W')],
            ['Convert the speed first (never put rpm into τω): ' + m(wS), m('P_{OUT} = \\tau\\omega = ' + N(tau) + '\\times' + N(w) + ' = ' + E(Pout, 'W'))], 'P_{OUT} = ' + E(Pout, 'W')),
          P('(c) Find the efficiency and the power loss.', [pctA('$\\eta$', 100 * eta), ans('$P_{LOSS}$', Pin - Pout, 'W')],
            [m('\\eta = P_{OUT}/P_{IN} = ' + N(Pout) + '/' + N(Pin) + ' = ' + N(100 * eta) + '\\%'), m('P_{LOSS} = P_{IN} - P_{OUT} = ' + N(Pin) + ' - ' + N(Pout) + ' = ' + E(Pin - Pout, 'W'))], '\\eta = ' + N(100 * eta) + '\\%,\\ P_{LOSS} = ' + E(Pin - Pout, 'W'))],
          trap('Using rpm directly in $P = \\tau\\omega$ gives an output about 10× too large (bigger than the input). Convert with $\\omega = 2\\pi n/60$ first.'),
          { V: V, I: I, pf: pf, n: n, tau: tau });
      }
      if (v === '3ph') {
        var VL = r.pick([400, 415, 440]), IL = r.float(4, 30, 1), pf3 = r.float(0.74, 0.9, 2);
        var Pin3 = sg(SQ3 * VL * IL * pf3, 3), S3 = SQ3 * VL * IL, pfa = Pin3 / S3;
        var eta3 = r.float(0.8, 0.92, 2), tau3 = sg(eta3 * Pin3 / w, 3), Po3 = tau3 * w;
        if (pfa >= 0.98 || Po3 / Pin3 > 0.96) return null;
        return Q('A three-phase induction motor runs at ' + n + ' rpm. The input line voltage is ' + m(E(VL, 'V')) + ', the line current is ' + m(E(IL, 'A')) + ', the input electrical power is ' + m(E(Pin3, 'W')) + ' and the output torque is ' + m(E(tau3, 'N·m')) + '.', null,
          [['$V_L$', VL + ' V'], ['$I_L$', IL + ' A'], ['$P_{IN}$', F.eng(Pin3, 'W')], ['$n$', n + ' rpm'], ['$\\tau$', tau3 + ' Nm']],
          [P('(a) Find the input power factor (assume lagging).', [ans('pf', pfa, '')],
            ['A 3-phase nameplate gives line values, so ' + m('S = \\sqrt3V_LI_L = \\sqrt3(' + VL + ')(' + IL + ') = ' + E(S3, 'VA')), m('\\text{pf} = P/S = ' + N(Pin3) + '/' + N(S3))], '\\text{pf} = ' + N(pfa) + '\\ \\text{lag}'),
          P('(b) Find the output power and hence the efficiency.', [ans('$P_{OUT}$', Po3, 'W'), pctA('$\\eta$', 100 * Po3 / Pin3)],
            [m(wS), m('P_{OUT} = \\tau\\omega = ' + N(tau3) + '\\times' + N(w) + ' = ' + E(Po3, 'W')), m('\\eta = ' + N(Po3) + '/' + N(Pin3) + ' = ' + N(100 * Po3 / Pin3) + '\\%')], 'P_{OUT} = ' + E(Po3, 'W') + ',\\ \\eta = ' + N(100 * Po3 / Pin3) + '\\%')],
          tip('Using $3V_LI_L$ (instead of $\\sqrt3V_LI_L$) would make S too big by $\\sqrt3$ and the pf too small.'), { VL: VL, IL: IL, Pin: Pin3, n: n, tau: tau3 });
      }
      if (v === 'rated') {
        var Pr = r.pick([0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15]) * 1000, etaR = r.float(0.78, 0.92, 2), pfR = r.float(0.75, 0.88, 2);
        var three = Pr >= 3000 || r.bool(0.3), Vr = three ? r.pick([400, 415]) : r.pick([230, 240]);
        var PinR = Pr / etaR, tauR = Pr / w, Ir = three ? PinR / (SQ3 * Vr * pfR) : PinR / (Vr * pfR);
        return Q('A ' + F.eng(Pr, 'W') + ' ' + (three ? 'three-phase' : 'single-phase') + ' motor has a rated efficiency of ' + Math.round(etaR * 100) + ' % and a rated speed of ' + n + ' rpm. It runs from ' + (three ? 'a ' + Vr + ' V three-phase' : 'a ' + Vr + ' V single-phase') + ' supply at a power factor of ' + pfR + ' lagging.', null,
          [['rating', F.eng(Pr, 'W')], ['$\\eta$', Math.round(etaR * 100) + ' %'], ['$n$', n + ' rpm'], ['$V$', Vr + ' V'], ['pf', pfR + ' lag']],
          [P('(a) Find the rated output power, input power and loss.', [ans('$P_{OUT}$', Pr, 'W'), ans('$P_{IN}$', PinR, 'W'), ans('$P_{LOSS}$', PinR - Pr, 'W')],
            ['A motor is rated by its <b>output</b> (shaft) power: ' + m('P_{OUT} = ' + E(Pr, 'W')), m('P_{IN} = P_{OUT}/\\eta = ' + N(Pr) + '/' + etaR + ' = ' + E(PinR, 'W')), m('P_{LOSS} = ' + N(PinR) + ' - ' + N(Pr) + ' = ' + E(PinR - Pr, 'W'))], 'P_{IN} = ' + E(PinR, 'W') + ',\\ P_{LOSS} = ' + E(PinR - Pr, 'W')),
          P('(b) Find the rated torque.', [ans('$\\tau$', tauR, 'N·m')], [m(wS), m('\\tau = P_{OUT}/\\omega = ' + N(Pr) + '/' + N(w))], '\\tau = ' + E(tauR, 'N·m')),
          P('(c) Find the ' + (three ? 'line' : 'supply') + ' current.', [ans(three ? '$I_L$' : '$I_1$', Ir, 'A')],
            [three ? m('I_L = \\dfrac{P_{IN}}{\\sqrt3V_L\\,\\text{pf}} = \\dfrac{' + N(PinR) + '}{\\sqrt3(' + Vr + ')(' + pfR + ')}') : m('I_1 = \\dfrac{P_{IN}}{V_1\\,\\text{pf}} = \\dfrac{' + N(PinR) + '}{' + Vr + '\\times' + pfR + '}'), 'Use the <b>input</b> power, not the rating.'], (three ? 'I_L' : 'I_1') + ' = ' + E(Ir, 'A'))],
          trap('The rating is the output. Using it as the input power makes the current and loss too small.'), { Pr: Pr, eta: etaR, n: n, V: Vr, pf: pfR, three: three });
      }
      // generator
      var tauG = r.nice(20, 400, 5), Pm = tauG * w, etaG = r.float(0.8, 0.94, 2), Pe = etaG * Pm, VG = r.pick([230, 240, 400, 415]), threeG = VG > 300, pfG = r.float(0.8, 1, 2);
      var IG = threeG ? Pe / (SQ3 * VG * pfG) : Pe / (VG * pfG);
      return Q('A ' + (threeG ? 'three-phase' : 'single-phase') + ' generator is driven by a prime mover at ' + n + ' rpm with a shaft torque of ' + m(E(tauG, 'N·m')) + '. The generator efficiency is ' + Math.round(etaG * 100) + ' % and it supplies a load at ' + VG + ' V' + (threeG ? ' (line)' : '') + ' with a power factor of ' + pfG + (pfG < 1 ? ' lagging' : '') + '.', null,
        [['$\\tau$', tauG + ' Nm'], ['$n$', n + ' rpm'], ['$\\eta$', Math.round(etaG * 100) + ' %'], ['$V$', VG + ' V'], ['pf', String(pfG)]],
        [P('(a) Find the mechanical input power.', [ans('$P_{IN}$', Pm, 'W')], ['For a generator the input is mechanical. ' + m(wS), m('P_{IN} = \\tau\\omega = ' + tauG + '\\times' + N(w))], 'P_{IN} = ' + E(Pm, 'W')),
          P('(b) Find the electrical output power and the loss.', [ans('$P_{OUT}$', Pe, 'W'), ans('$P_{LOSS}$', Pm - Pe, 'W')], [m('P_{OUT} = \\eta P_{IN} = ' + etaG + '\\times' + N(Pm) + ' = ' + E(Pe, 'W')), m('P_{LOSS} = P_{IN}(1-\\eta) = ' + E(Pm - Pe, 'W'))], 'P_{OUT} = ' + E(Pe, 'W')),
          P('(c) Find the output current.', [ans(threeG ? '$I_L$' : '$I_1$', IG, 'A')], [threeG ? m('I_L = P/(\\sqrt3V_L\\text{pf}) = ' + N(Pe) + '/(\\sqrt3\\times' + VG + '\\times' + pfG + ')') : m('I_1 = P/(V_1\\text{pf}) = ' + N(Pe) + '/(' + VG + '\\times' + pfG + ')')], (threeG ? 'I_L' : 'I_1') + ' = ' + E(IG, 'A'))],
        tip('Motor: electrical in, mechanical out. Generator: the reverse.'), { tau: tauG, n: n, eta: etaG, V: VG, pf: pfG, three: threeG });
    }
  });

  ADD({
    id: 'mach.ac.power.tau-omega', course: 'mach', module: 'ac', topic: 'power',
    title: 'Torque, speed and mechanical power', difficulty: 1, marks: 3,
    variants: [{ id: 'tau', label: 'Find torque' }, { id: 'P', label: 'Find power' }, { id: 'n', label: 'Find speed' }, { id: 'hoist', label: 'Hoist: τ = mgr' }],
    tags: ['PQ 1.14'],
    gen: function (r, v) {
      if (v === 'hoist') {
        var mass = r.nice(100, 2000, 50), rad = r.pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.4]), vel = r.float(0.3, 2, 1), eta = r.float(0.75, 0.92, 2);
        var Fh = mass * G0, tau = Fh * rad, wd = vel / rad, nd = wd * 60 / (2 * PI), Pm = tau * wd, Pin = Pm / eta;
        return Q('A hoist lifts a mass of ' + mass + ' kg at a steady ' + vel + ' m/s using a drum of radius ' + rad + ' m driven directly by a motor. The motor efficiency is ' + Math.round(eta * 100) + ' %. Take $g = 9.81$ m/s².', null,
          [['$m$', mass + ' kg'], ['$v$', vel + ' m/s'], ['$r$', rad + ' m'], ['$\\eta$', Math.round(eta * 100) + ' %']],
          [P('(a) Find the motor torque and speed.', [ans('$\\tau$', tau, 'N·m'), ans('$n$', nd, 'rpm')], [m('F = mg = ' + mass + '\\times9.81 = ' + E(Fh, 'N')), m('\\tau = Fr = ' + N(Fh) + '\\times' + rad + ' = ' + E(tau, 'N·m')), m('\\omega = v/r = ' + vel + '/' + rad + ' = ' + N(wd) + txt('rad/s') + ',\\ n = 60\\omega/2\\pi = ' + N(nd) + txt('rpm'))], '\\tau = ' + E(tau, 'N·m') + ',\\ n = ' + N(nd) + txt('rpm')),
            P('(b) Find the mechanical output power and the electrical input power.', [ans('$P_{OUT}$', Pm, 'W'), ans('$P_{IN}$', Pin, 'W')], [m('P_{OUT} = \\tau\\omega = ' + N(tau) + '\\times' + N(wd) + ' = ' + E(Pm, 'W') + '\\ (= Fv)'), m('P_{IN} = P_{OUT}/\\eta = ' + E(Pin, 'W'))], 'P_{IN} = ' + E(Pin, 'W'))],
          '', { m: mass, v: vel, r: rad, eta: eta });
      }
      var n = r.pick([500, 750, 960, 1450, 1500, 2910, 3000, 6000, 12000, 50000]), w = 2 * PI * n / 60;
      if (v === 'tau') {
        var Pk = r.pick([0.37, 0.75, 2.2, 7.5, 15, 37, 90, 250]) * 1000, tq = Pk / w;
        return Q('Find the torque when the mechanical power is ' + m(E(Pk, 'W')) + ' and the speed is ' + n + ' rpm.', null, [['$P$', F.eng(Pk, 'W')], ['$n$', n + ' rpm']],
          [P('Find $\\omega$ and $\\tau$.', [ans('$\\omega$', w, 'rad/s'), ans('$\\tau$', tq, 'N·m')], [m('\\omega = 2\\pi(' + n + ')/60 = ' + N(w) + txt('rad/s')), m('\\tau = P/\\omega = ' + N(Pk) + '/' + N(w))], '\\tau = ' + E(tq, 'N·m'))], '', { P: Pk, n: n });
      }
      if (v === 'P') {
        var tq2 = r.pick([0.5, 1.2, 4.25, 12, 25, 48, 110, 300]), Pw = tq2 * w;
        return Q('Find the mechanical power when the speed is ' + n + ' rpm and the torque is ' + tq2 + ' Nm.', null, [['$\\tau$', tq2 + ' Nm'], ['$n$', n + ' rpm']],
          [P('Find $\\omega$ and $P$.', [ans('$\\omega$', w, 'rad/s'), ans('$P$', Pw, 'W')], [m('\\omega = 2\\pi(' + n + ')/60 = ' + N(w) + txt('rad/s')), m('P = \\tau\\omega = ' + tq2 + '\\times' + N(w))], 'P = ' + E(Pw, 'W'))], '', { tau: tq2, n: n });
      }
      var tq3 = sg(r.pick([0.5, 2, 10, 50, 191, 1000, 5000]) * r.float(0.8, 1.3, 2), 3), Pn = sg(tq3 * w, 3), wn = Pn / tq3, nn = wn * 60 / (2 * PI);
      return Q('Find the speed in rpm when the power is ' + m(E(Pn, 'W')) + ' and the torque is ' + m(E(tq3, 'N·m')) + '.', null, [['$P$', F.eng(Pn, 'W')], ['$\\tau$', F.eng(tq3, 'N·m')]],
        [P('Find $\\omega$ and $n$.', [ans('$\\omega$', wn, 'rad/s'), ans('$n$', nn, 'rpm')], [m('\\omega = P/\\tau = ' + N(Pn) + '/' + N(tq3) + ' = ' + N(wn) + txt('rad/s')), m('n = 60\\omega/2\\pi = ' + N(nn) + txt('rpm'))], 'n = ' + N(nn) + txt('rpm'))], '', { P: Pn, tau: tq3 });
    }
  });

  ADD({
    id: 'mach.ac.power.inst-power', course: 'mach', module: 'ac', topic: 'power',
    title: 'Instantaneous power p(t) and phase from waveforms', difficulty: 2, marks: 4,
    variants: [{ id: 'pq', label: 'Given P and Q: peaks, p(t) range' }, { id: 'delay', label: 'Given a time shift: φ, pf, P, Q' }],
    tags: ['Workshop 1'],
    gen: function (r, v) {
      var V = r.pick([110, 120, 230, 240]), f = r.pick([50, 60]);
      if (v === 'pq') {
        var Pp = r.nice(50, 2000, 10), Qp = r.sign() * r.nice(20, 1500, 10), Sp = Math.hypot(Pp, Qp), I = Sp / V, phi = -Math.atan2(Qp, Pp) * 180 / PI;
        return Q('A single-phase load on a ' + V + ' V, ' + f + ' Hz supply absorbs ' + m(E(Pp, 'W')) + ' and ' + m(E(Qp, 'VAr')) + '. Take $v(t) = \\sqrt2V_1\\cos\\omega t$.', null,
          [['$V_1$', V + ' V'], ['$P$', Pp + ' W'], ['$Q$', Qp + ' VAr'], ['$f$', f + ' Hz']],
          [P('(a) Find the peak voltage, the rms and peak current, and the current angle φ.', [ans('$V_{pk}$', Math.SQRT2 * V, 'V'), ans('$I_1$', I, 'A'), ans('$I_{pk}$', Math.SQRT2 * I, 'A'), angA('$\\phi$', phi, { hint: 'signed: negative = lagging' })],
            [m('V_{pk} = \\sqrt2\\times' + V + ' = ' + E(Math.SQRT2 * V, 'V')), m('S = \\sqrt{P^2+Q^2} = \\sqrt{' + Pp + '^2 + ' + Qp + '^2} = ' + E(Sp, 'VA')), m('I_1 = S/V_1 = ' + E(I, 'A') + ',\\ I_{pk} = \\sqrt2 I_1 = ' + E(Math.SQRT2 * I, 'A')), m('\\phi = -\\tan^{-1}(Q/P) = ' + DG(phi)) + ' (' + (Qp > 0 ? 'Q > 0, so the current lags' : 'Q < 0, so the current leads') + ')'], '\\phi = ' + DG(phi) + '\\ (' + ll(Qp) + ')'),
            P('(b) $p(t) = P + S\\cos(2\\omega t + \\phi)$. Find its frequency, maximum and minimum.', [ans('$f_p$', 2 * f, 'Hz'), ans('$p_{max}$', Pp + Sp, 'W'), ans('$p_{min}$', Pp - Sp, 'W')],
              ['The fluctuating term is at twice the supply frequency: ' + m('f_p = 2f = ' + 2 * f + txt('Hz')), m('p_{max} = P + S = ' + E(Pp + Sp, 'W') + ',\\quad p_{min} = P - S = ' + E(Pp - Sp, 'W')), 'The minimum is negative because $Q \\ne 0$: energy flows back to the source for part of each cycle.'], 'p_{min} = ' + E(Pp - Sp, 'W'))],
          '', { V: V, f: f, P: Pp, Q: Qp });
      }
      var Vr = V, Ir = r.float(1, 20, 1), late = r.bool(0.6), dtms = r.float(0.4, 3.5, 2), T = 1000 / f, phd = dtms / T * 360;
      if (phd > 80) return null;
      var phi2 = late ? -phd : phd, S2 = Vr * Ir, P2 = S2 * cosd(phi2), Q2 = S2 * sind(-phi2);
      return Q('A ' + Vr + ' V rms, ' + f + ' Hz supply feeds a load. On the oscilloscope the current (rms ' + Ir + ' A) reaches its peak ' + dtms + ' ms ' + (late ? '<b>after</b>' : '<b>before</b>') + ' the voltage peak.', figWave({ shiftFrac: (late ? 1 : -1) * dtms / T }),
        [['$V_1$', Vr + ' V'], ['$I_1$', Ir + ' A'], ['$f$', f + ' Hz'], ['$\\Delta t$', dtms + ' ms ' + (late ? 'after' : 'before')]],
        [P('(a) Find the phase angle φ of the current (signed) and the power factor.', [angA('$\\phi$', phi2, { hint: 'negative = lagging' }), ans('pf', cosd(phi2), '')],
          [m('T = 1/f = ' + N(T) + txt('ms')), m('|\\phi| = \\dfrac{\\Delta t}{T}\\times360^\\circ = \\dfrac{' + dtms + '}{' + N(T) + '}\\times360^\\circ = ' + DG(phd)), 'The current peaks ' + (late ? 'later, so it lags: ' + m('\\phi = -' + DG(phd)) : 'earlier, so it leads: ' + m('\\phi = +' + DG(phd))), m('\\text{pf} = \\cos\\phi = ' + N(cosd(phi2)) + '\\ \\text{' + (late ? 'lag' : 'lead') + '}')], '\\text{pf} = ' + N(cosd(phi2)) + '\\ \\text{' + (late ? 'lag' : 'lead') + '}'),
          P('(b) Find P and Q.', [ans('$P$', P2, 'W'), ans('$Q$', Q2, 'VAr')], [m('S = V_1I_1 = ' + E(S2, 'VA')), m('P = S\\cos\\phi = ' + E(P2, 'W')), m('Q = S\\sin(-\\phi) = ' + E(Q2, 'VAr'))], 'P = ' + E(P2, 'W') + ',\\ Q = ' + E(Q2, 'VAr'))],
        trap('Current peaking <b>later</b> means lagging (φ < 0, Q > 0).'), { V: Vr, I: Ir, f: f, dt: dtms, late: late });
    }
  });

  /* ---------- ac.phasor ---------- */
  function xDesc(k, val, f, useLC) {      // element description: reactance or L/C value
    if (k === 'L') return useLC ? { txt: 'L = ' + E(val / omega(f), 'H'), plain: pv(val / omega(f), 'H') } : { txt: 'X_L = ' + ohmT(val), plain: 'j' + pv(val, 'Ω') };
    return useLC ? { txt: 'C = ' + E(1 / (omega(f) * val), 'F'), plain: pv(1 / (omega(f) * val), 'F') } : { txt: 'X_C = ' + ohmT(val), plain: '−j' + pv(val, 'Ω') };
  }
  ADD({
    id: 'mach.ac.phasor.series', course: 'mach', module: 'ac', topic: 'phasor',
    title: 'Series R–L–C circuit: impedance, phasors and S = V I*', difficulty: 2, marks: 9,
    variants: [{ id: 'rl', label: 'Series RL, V given' }, { id: 'rc', label: 'Series RC, V given' }, { id: 'rlc', label: 'Series RLC, V given' }, { id: 'rlc-i', label: 'Series RLC, current phasor given (Jun23 Q1c)' }],
    tags: ['exam-style', 'Q1', 'Jun23 Q1c', 'Jun24 Q1c'],
    gen: function (r, v) {
      var f = r.pick([50, 50, 60]), useLC = r.bool(0.5);
      var R = r.eseries('E12', 4.7, 150), XL = 0, XC = 0;
      if (v !== 'rc') { XL = useLC ? omega(f) * r.eseries('E12', 0.01, 1) : r.nice(5, 120, 1); }
      if (v !== 'rl') {
        XC = useLC ? 1 / (omega(f) * r.eseries('E12', 10e-6, 1000e-6)) : r.nice(5, 120, 1);
        if (XC > 4 * R + 200) return null;
      }
      if (v === 'rlc' || v === 'rlc-i') { if (Math.abs(XL - XC) < 0.15 * R) return null; }
      if (Math.abs(XL - XC) > 6 * R || Math.abs(XL - XC) < 0.2 * R) return null;
      var Z = CX(R, XL - XC), els = [{ k: 'R', label: 'R', value: pv(R, 'Ω') }];
      var dl = v !== 'rc' ? xDesc('L', XL, f, useLC) : null, dc = v !== 'rl' ? xDesc('C', XC, f, useLC) : null;
      if (dl) els.push({ k: 'L', label: useLC ? 'L' : 'jX_L', value: dl.plain });
      if (dc) els.push({ k: 'C', label: useLC ? 'C' : '−jX_C', value: dc.plain });
      var Vs, I;
      if (v === 'rlc-i') { I = CX.polar(r.nice(2, 20, 1), r.pick([-40, -30, -20, -10, 10, 20, 30, 40])); Vs = I.mul(Z); }
      else { Vs = CX(r.pick([110, 120, 230, 240]), 0); I = Vs.div(Z); }
      var VR = I.mul(R), VL = I.mul(CX(0, XL)), VC = I.mul(CX(0, -XC)), Ssup = Vs.mul(I.conj());
      var givenEl = [['$R$', F.eng(R, 'Ω')]];
      if (dl) givenEl.push([useLC ? '$L$' : '$X_L$', useLC ? F.eng(XL / omega(f), 'H') : F.eng(XL, 'Ω')]);
      if (dc) givenEl.push([useLC ? '$C$' : '$X_C$', useLC ? F.eng(1 / (omega(f) * XC), 'F') : F.eng(XC, 'Ω')]);
      givenEl.push(['$f$', f + ' Hz']);
      var name = v === 'rl' ? 'series RL' : v === 'rc' ? 'series RC' : 'series RLC';
      var stem = 'A single-phase ' + name + ' load (values below) is supplied at ' + f + ' Hz. ' + (v === 'rlc-i' ? 'The current is known to be ' + m('I_1 = ' + PZ(I, 'A')) + '.' : 'Take ' + m('V_1 = ' + PL(Vs.re, 0, 'V')) + ' as the reference.');
      if (v === 'rlc-i') givenEl.push(['$I_1$', m(PZ(I, 'A'))]); else givenEl.push(['$V_1$', Vs.re + ' V']);
      var fig = figSeries(els, { src: 'V_1', srcv: v === 'rlc-i' ? '' : Vs.re + ' V', I: 'I_1' });
      var xs = [];
      if (useLC && dl) xs.push(m('X_L = 2\\pi fL = 2\\pi(' + f + ')(' + N(XL / omega(f)) + ') = ' + ohmT(XL)));
      if (useLC && dc) xs.push(m('X_C = \\dfrac{1}{2\\pi fC} = \\dfrac{1}{2\\pi(' + f + ')(' + N(1 / (omega(f) * XC)) + ')} = ' + ohmT(XC)));
      var zline = m('Z = R ' + (dl ? '+ jX_L ' : '') + (dc ? '- jX_C ' : '') + '= ' + N(R) + (dl ? ' + j' + N(XL) : '') + (dc ? ' - j' + N(XC) : '') + ' = ' + CR(Z) + ' = ' + PZ(Z, 'Ω'));
      var nature = Z.im > 0 ? 'inductive overall (current lags)' : 'capacitive overall (current leads)';
      var parts = [];
      if (v === 'rlc-i') {
        parts.push(P('(a) Find the element voltages $V_R$, $V_L$ and $V_C$ (polar).', [ans('$|V_R|$', VR.abs(), 'V'), ans('$|V_L|$', VL.abs(), 'V'), ans('$|V_C|$', VC.abs(), 'V'), angA('$\\angle V_C$', VC.argd())],
          xs.concat([m('V_R = I_1R = ' + PZ(I) + '\\times' + N(R) + ' = ' + PZ(VR, 'V')), m('V_L = I_1(jX_L) = ' + PZ(I) + '\\times' + PL(XL, 90) + ' = ' + PZ(VL, 'V')), m('V_C = I_1(-jX_C) = ' + PZ(I) + '\\times' + PL(XC, -90) + ' = ' + PZ(VC, 'V'))]), 'V_C = ' + PZ(VC, 'V')));
        parts.push(P('(b) Find $Z$ (polar) and hence $V_1$.', [ans('$|Z|$', Z.abs(), 'Ω'), angA('$\\angle Z$', Z.argd()), ans('$|V_1|$', Vs.abs(), 'V'), angA('$\\angle V_1$', Vs.argd())],
          [zline + ' — ' + nature + '.', m('V_1 = I_1Z = ' + PZ(I) + '\\times' + PZ(Z) + ' = ' + PZ(Vs, 'V'))], 'V_1 = ' + PZ(Vs, 'V')));
        parts.push(P('(c) Find $I_1^*$, the complex power $S = V_1I_1^*$, and P and Q.', [ans('$P$', Ssup.re, 'W'), ans('$Q$', Ssup.im, 'VAr', { abs: 1 })],
          [m('I_1^* = ' + PL(I.abs(), -I.argd(), 'A')), m('S = V_1I_1^* = ' + PZ(Vs) + '\\times' + PL(I.abs(), -I.argd()) + ' = ' + PZ(Ssup) + ' = ' + CR(Ssup) + txt('VA')), 'Check: ' + m('I^2R = ' + N(I.abs() * I.abs() * R) + txt('W') + ',\\ I^2(X_L - X_C) = ' + N(I.abs() * I.abs() * (XL - XC)) + txt('VAr'))], 'P = ' + E(Ssup.re, 'W') + ',\\ Q = ' + E(Ssup.im, 'VAr')));
      } else {
        parts.push(P('(a) Find the impedance $Z$ in polar form. Is the load inductive or capacitive?', [ans('$|Z|$', Z.abs(), 'Ω'), angA('$\\angle Z$', Z.argd())], xs.concat([zline, 'It is ' + nature + '.']), 'Z = ' + PZ(Z, 'Ω')));
        var vparts = [m('V_R = I_1R = ' + PZ(VR, 'V'))];
        var va = [ans('$|I_1|$', I.abs(), 'A'), angA('$\\angle I_1$', I.argd()), ans('$|V_R|$', VR.abs(), 'V')];
        if (dl) { vparts.push(m('V_L = I_1(jX_L) = ' + PZ(VL, 'V'))); va.push(ans('$|V_L|$', VL.abs(), 'V')); }
        if (dc) { vparts.push(m('V_C = I_1(-jX_C) = ' + PZ(VC, 'V'))); va.push(ans('$|V_C|$', VC.abs(), 'V')); }
        parts.push(P('(b) Find the current $I_1$ and the element voltages (magnitudes).', va,
          [m('I_1 = \\dfrac{V_1}{Z} = \\dfrac{' + PL(Vs.re, 0) + '}{' + PZ(Z) + '} = ' + PZ(I, 'A'))].concat(vparts).concat([(v === 'rlc' && (VL.abs() > Vs.abs() || VC.abs() > Vs.abs())) ? 'Note that an element voltage exceeds the supply: $V_L$ and $V_C$ are 180° apart and partly cancel.' : 'The magnitudes do not add; the phasors do: ' + m('V_1 = V_R + ' + (dl ? 'V_L' : '') + (dl && dc ? ' + ' : '') + (dc ? 'V_C' : ''))]), 'I_1 = ' + PZ(I, 'A')));
        parts.push(P('(c) Find $S = V_1I_1^*$, P, Q and the power factor.', [ans('$P$', Ssup.re, 'W'), ans('$Q$', Ssup.im, 'VAr', { abs: 1 }), ans('pf', Math.cos(Z.arg()), '')],
          [m('S = V_1I_1^* = ' + PL(Vs.re, 0) + '\\times' + PL(I.abs(), -I.argd()) + ' = ' + PZ(Ssup) + ' = ' + CR(Ssup) + txt('VA')), m('\\text{pf} = \\cos\\phi = \\cos(' + DG(I.argd()) + ') = ' + pfT(Math.cos(Z.arg()), Ssup.im)), 'Check: ' + m('P = I^2R = ' + N(I.abs() * I.abs()) + '\\times' + N(R) + ' = ' + E(I.abs() * I.abs() * R, 'W'))], 'S = ' + CR(Ssup) + '\\ \\text{VA},\\ \\text{pf} = ' + pfT(Math.cos(Z.arg()), Ssup.im)));
      }
      return Q(stem, fig, givenEl, parts, trap('Leaving out the conjugate in $S = V_1I_1^*$ flips the sign of Q (and the lead/lag label).'),
        { v: v, R: R, XL: XL, XC: XC, f: f, V: Vs.re, Imag: I.abs(), Iang: I.argd() });
    }
  });

  ADD({
    id: 'mach.ac.phasor.parallel', course: 'mach', module: 'ac', topic: 'phasor',
    title: 'Parallel R–L / R–C load: branch currents and power', difficulty: 2, marks: 8,
    variants: [{ id: 'rl', label: 'Parallel RL' }, { id: 'rc', label: 'Parallel RC' }, { id: 'rlc', label: 'Parallel RLC' }],
    tags: ['exam-style', '2024 test Q3', 'PQ 2.17'],
    gen: function (r, v) {
      var V = r.pick([110, 120, 200, 230, 240]), f = r.pick([50, 60]);
      var R = r.eseries('E12', 10, 330), XL = v !== 'rc' ? r.nice(10, 300, 5) : 0, XC = v !== 'rl' ? r.nice(10, 300, 5) : 0;
      if (v === 'rlc' && Math.abs(1 / XL - 1 / XC) < 0.1 / R) return null;
      var IR = CX(V / R, 0), IL = XL ? CX(0, -V / XL) : CX(0, 0), IC = XC ? CX(0, V / XC) : CX(0, 0), I1 = IR.add(IL).add(IC);
      var Z = CX(V, 0).div(I1), Sx = CX(V, 0).mul(I1.conj());
      var br = [{ els: [{ k: 'R', label: 'R', value: pv(R, 'Ω') }], I: 'I_R' }];
      if (XL) br.push({ els: [{ k: 'L', label: 'jX_L', value: 'j' + pv(XL, 'Ω') }], I: 'I_L' });
      if (XC) br.push({ els: [{ k: 'C', label: '−jX_C', value: '−j' + pv(XC, 'Ω') }], I: 'I_C' });
      var given = [['$V_1$', V + ' V'], ['$f$', f + ' Hz'], ['$R$', F.eng(R, 'Ω')]];
      if (XL) given.push(['$X_L$', F.eng(XL, 'Ω')]); if (XC) given.push(['$X_C$', F.eng(XC, 'Ω')]);
      var bsteps = [m('I_R = V_1/R = ' + V + '/' + N(R) + ' = ' + PZ(IR, 'A'))];
      var bans = [ans('$|I_R|$', IR.abs(), 'A')];
      if (XL) { bsteps.push(m('I_L = V_1/(jX_L) = ' + PL(V, 0) + '/' + PL(XL, 90) + ' = ' + PZ(IL, 'A'))); bans.push(ans('$|I_L|$', IL.abs(), 'A')); }
      if (XC) { bsteps.push(m('I_C = V_1/(-jX_C) = ' + PL(V, 0) + '/' + PL(XC, -90) + ' = ' + PZ(IC, 'A'))); bans.push(ans('$|I_C|$', IC.abs(), 'A')); }
      var qcheck = (XL ? '\\dfrac{V^2}{X_L}' : '') + (XL && XC ? ' - ' : '') + (XC ? (XL ? '' : '-') + '\\dfrac{V^2}{X_C}' : '');
      return Q('A parallel load (shown) is connected to ' + m(PL(V, 0, 'V')) + ', ' + f + ' Hz.', figParallel(br, { srcv: V + ' V', I: 'I_1' }), given,
        [P('(a) Find the branch currents as phasors.', bans, bsteps.concat(['The voltage is common to every branch, so each branch is just Ohm\'s law.']), 'I_R = ' + PZ(IR, 'A') + (XL ? ',\\ I_L = ' + PZ(IL, 'A') : '') + (XC ? ',\\ I_C = ' + PZ(IC, 'A') : '')),
          P('(b) Find the supply current $I_1$ and the load impedance $Z$.', [ans('$|I_1|$', I1.abs(), 'A'), angA('$\\angle I_1$', I1.argd()), ans('$|Z|$', Z.abs(), 'Ω')],
            [m('I_1 = I_R ' + (XL ? '+ I_L ' : '') + (XC ? '+ I_C ' : '') + '= ' + CR(I1) + ' = ' + PZ(I1, 'A')), m('Z = V_1/I_1 = ' + PZ(Z, 'Ω'))], 'I_1 = ' + PZ(I1, 'A')),
          P('(c) Find P, Q and the power factor. Check P and Q from the elements.', [ans('$P$', Sx.re, 'W'), ans('$Q$', Sx.im, 'VAr', { abs: 1 }), ans('pf', Sx.re / Sx.abs(), '')],
            [m('S = V_1I_1^* = ' + V + '\\times(' + CR(I1.conj()) + ') = ' + CR(Sx) + txt('VA')), m('\\text{pf} = P/S = ' + pfT(Sx.re / Sx.abs(), Sx.im)), 'Check: ' + m('P = V^2/R = ' + V + '^2/' + N(R) + ' = ' + E(V * V / R, 'W')) + ', ' + m('Q = ' + qcheck + ' = ' + E(Sx.im, 'VAr'))], 'P = ' + E(Sx.re, 'W') + ',\\ Q = ' + E(Sx.im, 'VAr'))],
        trap('In a parallel load use $V^2/R$, not $I_1^2R$: the line current does not all flow through the resistor.'),
        { v: v, V: V, R: R, XL: XL, XC: XC });
    }
  });

  ADD({
    id: 'mach.ac.phasor.rx-measure', course: 'mach', module: 'ac', topic: 'phasor',
    title: 'Finding R and X (or L, C) from V, I and P measurements', difficulty: 2, marks: 6,
    variants: [{ id: 'series', label: 'Series RL model' }, { id: 'parallel', label: 'Parallel RL model' }, { id: 'rc', label: 'Parallel RC (leading) load' }, { id: 'vrvl', label: 'Series RL from V_R and V_1' }],
    tags: ['PQ 2.18', 'PQ 2.19', 'PQ 2.21'],
    gen: function (r, v) {
      var V = r.pick([110, 120, 140, 200, 230, 240]), f = r.pick([50, 60]), w = omega(f);
      if (v === 'vrvl') {
        var V1 = r.nice(100, 240, 10), VR = r.nice(0.45 * V1, 0.9 * V1, 5), I = r.nice(2, 20, 1);
        if (VR >= V1) return null;
        var VL = Math.sqrt(V1 * V1 - VR * VR), phi = -acosd(VR / V1), S = V1 * I, Pv = S * cosd(phi), Qv = S * sind(-phi);
        return Q('In a series RL circuit the supply voltage magnitude is ' + m(E(V1, 'V')) + ' and the resistor voltage is ' + m(E(VR, 'V')) + '.', figSeries([{ k: 'R', label: 'R' }, { k: 'L', label: 'jX' }], { src: 'V_1', I: 'I_1' }),
          [['$V_1$', V1 + ' V'], ['$V_R$', VR + ' V'], ['$I_1$ (part c)', I + ' A']],
          [P('(a) Find $V_L$.', [ans('$V_L$', VL, 'V')], ['$V_R$ and $V_L$ are perpendicular (same current, R in phase, L at +90°): ' + m('V_L = \\sqrt{V_1^2 - V_R^2} = \\sqrt{' + V1 + '^2 - ' + VR + '^2}')], 'V_L = ' + E(VL, 'V')),
            P('(b) Find the power-factor angle and the power factor.', [angA('$\\phi$', phi, { hint: 'signed' }), ans('pf', VR / V1, '')], [m('\\phi = -\\cos^{-1}(V_R/V_1) = -\\cos^{-1}(' + N(VR / V1) + ') = ' + DG(phi)) + ' (negative: current lags)'], '\\text{pf} = ' + N(VR / V1) + '\\ \\text{lag}'),
            P('(c) With $I_1 = ' + I + '$ A, find S, P and Q, and hence R and X.', [ans('$S$', S, 'VA'), ans('$P$', Pv, 'W'), ans('$Q$', Qv, 'VAr'), ans('$R$', Pv / (I * I), 'Ω'), ans('$X$', Qv / (I * I), 'Ω')],
              [m('S = V_1I_1 = ' + E(S, 'VA')), m('P = S\\cos\\phi = ' + E(Pv, 'W') + ',\\ Q = S\\sin(-\\phi) = ' + E(Qv, 'VAr')), 'Series, so use $I^2$: ' + m('R = P/I^2 = ' + ohmT(Pv / (I * I)) + ',\\ X = Q/I^2 = ' + ohmT(Qv / (I * I)))], 'R = ' + ohmT(Pv / (I * I)) + ',\\ X = ' + ohmT(Qv / (I * I)))],
          trap('$V_1 \\ne V_R + V_L$: add the voltages at 90°.'), { V1: V1, VR: VR, I: I });
      }
      var I2 = r.float(1.5, 20, 1), S2 = V * I2, pfm = r.float(0.25, 0.9, 2), P2 = sg(S2 * pfm, 3);
      if (P2 >= S2 * 0.97) return null;
      var Qmag = Math.sqrt(S2 * S2 - P2 * P2), lead = v === 'rc', Q2 = lead ? -Qmag : Qmag;
      var base = [m('S = V_1I_1 = ' + V + '\\times' + I2 + ' = ' + E(S2, 'VA')), m('Q = ' + (lead ? '-' : '+') + '\\sqrt{S^2 - P^2} = ' + (lead ? '-' : '+') + '\\sqrt{' + N(S2) + '^2 - ' + N(P2) + '^2} = ' + E(Q2, 'VAr')) + (lead ? ' (negative: capacitive)' : ' (positive: inductive)')];
      var given = [['$V_1$', V + ' V'], ['$I_1$', I2 + ' A'], ['$P_1$', F.eng(P2, 'W')], ['$f$', f + ' Hz']];
      var stem = 'A single-phase ' + (lead ? 'capacitive' : 'inductive') + ' load on ' + V + ' V, ' + f + ' Hz draws ' + I2 + ' A and ' + F.eng(P2, 'W') + '.';
      if (v === 'series') {
        var Rs = P2 / (I2 * I2), Xs = Qmag / (I2 * I2);
        return Q(stem + ' Model it as a <b>series</b> RL circuit.', figSeries([{ k: 'R', label: 'R_S' }, { k: 'L', label: 'jX_S' }], { I: 'I_1', srcv: V + ' V' }), given,
          [P('(a) Find S, Q and the power factor.', [ans('$S$', S2, 'VA'), ans('$Q$', Q2, 'VAr'), ans('pf', P2 / S2, '')], base.concat([m('\\text{pf} = P/S = ' + N(P2 / S2) + '\\ \\text{lag}')]), '\\text{pf} = ' + N(P2 / S2) + '\\ \\text{lag}'),
            P('(b) Find $R_S$, $X_S$ and $L_S$.', [ans('$R_S$', Rs, 'Ω'), ans('$X_S$', Xs, 'Ω'), ans('$L_S$', Xs / w, 'H')], ['Series: same current through both, so use $I^2$.', m('R_S = P/I^2 = ' + N(P2) + '/' + I2 + '^2 = ' + ohmT(Rs)), m('X_S = Q/I^2 = ' + N(Qmag) + '/' + I2 + '^2 = ' + ohmT(Xs)), m('L_S = X_S/\\omega = ' + N(Xs) + '/' + N(w) + ' = ' + E(Xs / w, 'H')), 'Check: ' + m('|Z| = V/I = ' + ohmT(V / I2) + ' = \\sqrt{R_S^2 + X_S^2}')], 'R_S = ' + ohmT(Rs) + ',\\ X_S = ' + ohmT(Xs))],
          trap('Using $V^2/P$ here gives the <i>parallel</i> resistance, a completely different number.'), { v: v, V: V, I: I2, P: P2, f: f });
      }
      var Rp = V * V / P2, Xp = V * V / Qmag;
      if (v === 'parallel') {
        return Q(stem + ' Model it as a <b>parallel</b> RL circuit.', figParallel([{ els: [{ k: 'R', label: 'R_P' }] }, { els: [{ k: 'L', label: 'jX_P' }] }], { I: 'I_1', srcv: V + ' V' }), given,
          [P('(a) Find S, Q and the power factor.', [ans('$S$', S2, 'VA'), ans('$Q$', Q2, 'VAr'), ans('pf', P2 / S2, '')], base.concat([m('\\text{pf} = ' + N(P2 / S2) + '\\ \\text{lag}')]), '\\text{pf} = ' + N(P2 / S2) + '\\ \\text{lag}'),
            P('(b) Find $R_P$, $X_P$ and $L_P$.', [ans('$R_P$', Rp, 'Ω'), ans('$X_P$', Xp, 'Ω'), ans('$L_P$', Xp / w, 'H')], ['Parallel: same voltage across both, so use $V^2$.', m('R_P = V^2/P = ' + V + '^2/' + N(P2) + ' = ' + ohmT(Rp)), m('X_P = V^2/Q = ' + V + '^2/' + N(Qmag) + ' = ' + ohmT(Xp)), m('L_P = X_P/\\omega = ' + E(Xp / w, 'H'))], 'R_P = ' + ohmT(Rp) + ',\\ X_P = ' + ohmT(Xp))],
          trap('$R = P/I^2$ only works for a series model. In a parallel model the line current does not all flow in R.'), { v: v, V: V, I: I2, P: P2, f: f });
      }
      var Cp = 1 / (w * Xp), phi2 = acosd(P2 / S2);
      return Q(stem + ' It is modelled as a resistor $R$ in <b>parallel</b> with a capacitor $C$.', figParallel([{ els: [{ k: 'R', label: 'R' }], I: 'I_R' }, { els: [{ k: 'C', label: 'C' }], I: 'I_C' }], { I: 'I_1', srcv: V + ' V' }), given,
        [P('(a) Find R.', [ans('$R$', Rp, 'Ω')], ['All the real power is in R, which has the full $V_1$ across it: ' + m('R = V^2/P = ' + V + '^2/' + N(P2))], 'R = ' + ohmT(Rp)),
          P('(b) Find S, Q, the angle φ and the power factor.', [ans('$S$', S2, 'VA'), ans('$Q$', Q2, 'VAr'), angA('$\\phi$', phi2, { hint: 'signed' }), ans('pf', P2 / S2, '')], base.concat([m('\\phi = +\\cos^{-1}(P/S) = ' + DG(phi2)) + ' (positive: the current leads)']), '\\text{pf} = ' + N(P2 / S2) + '\\ \\text{lead}'),
          P('(c) Find the reactance and the capacitance.', [ans('$|X|$', Xp, 'Ω'), ans('$C$', Cp, 'F')], [m('X = V^2/Q = ' + V + '^2/(' + N(Q2) + ') = ' + ohmT(-Xp)), m('C = \\dfrac{1}{\\omega|X|} = \\dfrac{1}{' + N(w) + '\\times' + N(Xp) + '} = ' + E(Cp, 'F'))], 'C = ' + E(Cp, 'F'))],
        trap('Q is negative for a capacitor, so the pf is <b>leading</b> and φ is positive.'), { v: v, V: V, I: I2, P: P2, f: f });
    }
  });

  function motorLoad(r) {
    var Pout = r.pick([0.75, 1.1, 1.5, 2.2, 3, 4]) * 1000, eta = r.float(0.75, 0.9, 2), pf = r.float(0.7, 0.86, 2), Pm = Pout / eta, Sm = Pm / pf, Qm = Sm * Math.sin(Math.acos(pf));
    return { Pout: Pout, eta: eta, pf: pf, P: Pm, S: Sm, Q: Qm };
  }
  ADD({
    id: 'mach.ac.phasor.multi-load', course: 'mach', module: 'ac', topic: 'phasor',
    title: 'Two loads on one supply: adding P and Q', difficulty: 2, marks: 8,
    variants: [{ id: 'motor-rc', label: 'Motor + series RC load' }, { id: 'motor-heater', label: 'Motor + heater' }, { id: 'motor-rl', label: 'Motor + series RL load' }, { id: 'two-motors', label: 'Two motors (one given by S and pf)' }],
    tags: ['exam-style', 'M1 N4'],
    gen: function (r, v) {
      var V = r.pick([230, 240]), f = 50, A = motorLoad(r), B = {}, desc = '', bfig = {};
      if (v === 'motor-rc' || v === 'motor-rl') {
        var Rb = r.nice(10, 80, 2), Xb = r.nice(10, 80, 2), Zb = CX(Rb, v === 'motor-rc' ? -Xb : Xb), Ib = CX(V, 0).div(Zb), Sb = CX(V, 0).mul(Ib.conj());
        B = { P: Sb.re, Q: Sb.im, Z: Zb, I: Ib, R: Rb, X: Xb };
        desc = 'Load B is a ' + Rb + ' Ω resistor in series with ' + (v === 'motor-rc' ? 'a capacitor' : 'an inductor') + ' of reactance ' + Xb + ' Ω.';
        bfig = { els: [{ k: 'R', label: 'R_B', value: Rb + ' Ω' }, { k: v === 'motor-rc' ? 'C' : 'L', label: v === 'motor-rc' ? '−jX_B' : 'jX_B', value: (v === 'motor-rc' ? '−j' : 'j') + Xb + ' Ω' }], I: 'I_B' };
      } else if (v === 'motor-heater') {
        var Ph = r.pick([0.5, 1, 1.5, 2, 2.4, 3]) * 1000; B = { P: Ph, Q: 0 };
        desc = 'Load B is a ' + F.eng(Ph, 'W') + ' resistive heater.';
        bfig = { els: [{ k: 'R', label: 'heater', value: F.eng(Ph, 'W') }], I: 'I_B' };
      } else {
        var Sb2 = r.nice(1000, 4000, 100), pfb = r.float(0.65, 0.9, 2); B = { P: Sb2 * pfb, Q: Sb2 * Math.sin(Math.acos(pfb)), S: Sb2, pf: pfb };
        desc = 'Load B is a second motor drawing ' + F.eng(Sb2, 'VA') + ' at ' + pfb + ' pf lagging.';
        bfig = { els: [{ k: 'M', label: 'B', text: 'M' }], I: 'I_B' };
      }
      var Pt = A.P + B.P, Qt = A.Q + B.Q, St = Math.hypot(Pt, Qt), It = St / V, pft = Pt / St;
      var fig = figParallel([{ els: [{ k: 'M', label: 'A', text: 'M' }], I: 'I_A' }, bfig], { srcv: V + ' V, ' + f + ' Hz', I: 'I_S', gap: 115 });
      var bsteps;
      if (B.Z) bsteps = [m('Z_B = ' + CR(B.Z) + ' = ' + PZ(B.Z, 'Ω')), m('I_B = V/Z_B = ' + PZ(B.I, 'A')), m('S_B = VI_B^* = ' + CR(CX(B.P, B.Q)) + txt('VA')), 'Check: ' + m('I_B^2R_B = ' + E(B.I.abs() * B.I.abs() * B.R, 'W'))];
      else if (v === 'motor-heater') bsteps = ['A resistor absorbs no reactive power: ' + m('P_B = ' + E(B.P, 'W') + ',\\ Q_B = 0')];
      else bsteps = [m('P_B = S_B\\,\\text{pf} = ' + N(B.S) + '\\times' + B.pf + ' = ' + E(B.P, 'W')), m('Q_B = S_B\\sin(\\cos^{-1}' + B.pf + ') = ' + E(B.Q, 'VAr'))];
      return Q('A ' + V + ' V, ' + f + ' Hz single-phase supply feeds two loads in parallel. Load A is a motor delivering ' + F.eng(A.Pout, 'W') + ' of mechanical output at ' + Math.round(A.eta * 100) + ' % efficiency and ' + A.pf + ' pf lagging. ' + desc, fig,
        [['$V$', V + ' V'], ['A: $P_{OUT}$, η, pf', F.eng(A.Pout, 'W') + ', ' + Math.round(A.eta * 100) + ' %, ' + A.pf + ' lag']],
        [P('(a) Find the electrical P, S and Q of load A, and its current.', [ans('$P_A$', A.P, 'W'), ans('$S_A$', A.S, 'VA'), ans('$Q_A$', A.Q, 'VAr'), ans('$I_A$', A.S / V, 'A')],
          [m('P_A = P_{OUT}/\\eta = ' + N(A.Pout) + '/' + A.eta + ' = ' + E(A.P, 'W')), m('S_A = P_A/\\text{pf} = ' + E(A.S, 'VA')), m('Q_A = S_A\\sin(\\cos^{-1}' + A.pf + ') = +' + E(A.Q, 'VAr')) + ' (lagging: positive)', m('I_A = S_A/V = ' + E(A.S / V, 'A'))], 'Q_A = ' + E(A.Q, 'VAr')),
          P('(b) Find the P and Q of load B.', [ans('$P_B$', B.P, 'W'), ans('$Q_B$', B.Q, 'VAr', { abs: 1 })], bsteps, 'S_B = ' + CR(CX(B.P, B.Q)) + '\\ \\text{VA}'),
          P('(c) Find the total P, Q, S, the supply pf and the supply current.', [ans('$P$', Pt, 'W'), ans('$Q$', Qt, 'VAr', { abs: 1 }), ans('$S$', St, 'VA'), ans('pf', pft, ''), ans('$I_S$', It, 'A')],
            ['P and Q are each conserved; S is not.', m('P = ' + N(A.P) + ' + ' + N(B.P) + ' = ' + E(Pt, 'W')), m('Q = ' + N(A.Q) + ' + (' + N(B.Q) + ') = ' + E(Qt, 'VAr')), m('S = \\sqrt{P^2 + Q^2} = ' + E(St, 'VA') + ',\\ \\text{pf} = P/S = ' + pfT(pft, Qt)), m('I_S = S/V = ' + E(It, 'A'))], '\\text{pf} = ' + pfT(pft, Qt) + ',\\ I_S = ' + E(It, 'A'))],
        trap('Never add apparent powers or current magnitudes: $S \\ne S_A + S_B$.'), { v: v, V: V, A: { Pout: A.Pout, eta: A.eta, pf: A.pf }, B: { R: B.R, X: B.X, P: B.P, S: B.S, pf: B.pf } });
    }
  });

  /* ---------- ac.pfc ---------- */
  function loadSpec(r) {
    var V = r.pick([110, 115, 120, 200, 230, 240]), f = r.pick([50, 50, 60]), kind = r.pick(['PQ', 'VIP', 'RL']);
    var P0, Q0, desc, given, fig, steps, raw = { kind: kind };
    if (kind === 'PQ') {
      P0 = r.nice(40, 3000, 10); Q0 = sg(P0 * r.float(0.4, 1.4, 2), 3); raw.P = P0; raw.Q = Q0;
      desc = 'A single-phase load absorbs ' + F.eng(P0, 'W') + ' and ' + F.eng(Q0, 'VAr') + ' from a ' + V + ' V, ' + f + ' Hz supply.';
      given = [['$P_L$', F.eng(P0, 'W')], ['$Q_L$', F.eng(Q0, 'VAr')]];
      steps = ['The load P and Q are given directly.'];
      fig = figParallel([{ els: [{ k: 'C', label: 'C' }], I: 'I_C' }, { els: [{ k: 'Z', label: 'load', value: 'P_L, Q_L' }], I: 'I_L' }], { srcv: V + ' V', I: 'I_S' });
    } else if (kind === 'VIP') {
      var I = r.float(V < 150 ? 4 : 2, V < 150 ? 20 : 12, 1), S = V * I, pf = r.float(0.55, 0.85, 2); P0 = sg(S * pf, 3); Q0 = Math.sqrt(S * S - P0 * P0); raw.I = I; raw.P = P0;
      desc = 'A single-phase motor on ' + V + ' V, ' + f + ' Hz draws ' + I + ' A and ' + F.eng(P0, 'W') + '.';
      given = [['$I$', I + ' A'], ['$P_L$', F.eng(P0, 'W')]];
      steps = [m('S_L = VI = ' + V + '\\times' + I + ' = ' + E(S, 'VA')), m('Q_L = +\\sqrt{S_L^2 - P_L^2} = ' + E(Q0, 'VAr')) + ' (a motor is inductive)'];
      fig = figParallel([{ els: [{ k: 'C', label: 'C' }], I: 'I_C' }, { els: [{ k: 'M', label: 'motor', text: 'M' }], I: 'I_L' }], { srcv: V + ' V', I: 'I_S' });
    } else {
      var R = r.nice(5, 120, 1), X = sg(R * r.float(0.5, 1.6, 2), 3), Z = CX(R, X), Il = V / Z.abs(); raw.R = R; raw.X = X;
      P0 = Il * Il * R; Q0 = Il * Il * X;
      desc = 'A load modelled as ' + R + ' Ω in series with an inductive reactance of ' + X + ' Ω is connected to ' + V + ' V, ' + f + ' Hz.';
      given = [['$R$', R + ' Ω'], ['$X_L$', X + ' Ω']];
      steps = [m('|Z| = \\sqrt{' + R + '^2 + ' + X + '^2} = ' + ohmT(Z.abs()) + ',\\ I_L = V/|Z| = ' + E(Il, 'A')), m('P_L = I_L^2R = ' + E(P0, 'W') + ',\\ Q_L = I_L^2X = ' + E(Q0, 'VAr'))];
      fig = figParallel([{ els: [{ k: 'C', label: 'C' }], I: 'I_C' }, { els: [{ k: 'R', label: 'R', value: R + ' Ω' }, { k: 'L', label: 'jX_L', value: 'j' + X + ' Ω' }], I: 'I_L' }], { srcv: V + ' V', I: 'I_S' });
    }
    return { V: V, f: f, kind: kind, P: P0, Q: Q0, desc: desc, given: given, fig: fig, steps: steps, raw: raw };
  }
  ADD({
    id: 'mach.ac.pfc.cap-1ph', course: 'mach', module: 'ac', topic: 'pfc',
    title: 'Power-factor correction capacitor (single-phase)', difficulty: 2, marks: 8,
    variants: [{ id: 'unity', label: 'Correct to unity' }, { id: 'lag', label: 'Correct to a lagging target' }, { id: 'two', label: 'Both solutions (lag and lead) for one pf' }, { id: 'reverse', label: 'C given: find the new pf' }],
    tags: ['exam-style', 'Q1', 'Jun24 Q1d', 'PQ 2.20'],
    gen: function (r, v) {
      var L = loadSpec(r), V = L.V, f = L.f, w = omega(f), P0 = L.P, Q0 = L.Q, S0 = Math.hypot(P0, Q0), pf0 = P0 / S0;
      if (pf0 > 0.9) return null;
      var a1 = P('(a) Find the load P, Q, power factor and current.', [ans('$P_L$', P0, 'W'), ans('$Q_L$', Q0, 'VAr'), ans('pf', pf0, ''), ans('$I_L$', S0 / V, 'A')],
        L.steps.concat([m('S_L = \\sqrt{P_L^2+Q_L^2} = ' + E(S0, 'VA') + ',\\ \\text{pf} = P_L/S_L = ' + pfT(pf0, Q0)), m('I_L = S_L/V = ' + E(S0 / V, 'A'))]), '\\text{pf} = ' + pfT(pf0, Q0));
      var given = [['$V$', V + ' V'], ['$f$', f + ' Hz']].concat(L.given);
      var data = { v: v, V: V, f: f, load: L.raw };
      if (v === 'reverse') {
        var C = r.eseries('E12', 0.3 * Q0 / (w * V * V), 1.6 * Q0 / (w * V * V)), Qc = -w * C * V * V, Qs = Q0 + Qc, Ss = Math.hypot(P0, Qs);
        if (Math.abs(Qs) < 0.02 * P0) return null;
        data.C = C;
        return Q(L.desc + ' A ' + F.eng(C, 'F') + ' capacitor is connected across the supply.', L.fig, given.concat([['$C$', F.eng(C, 'F')]]),
          [a1, P('(b) Find the reactive power of the capacitor and the new supply Q.', [ans('$Q_C$', Qc, 'VAr'), ans('$Q_S$', Qs, 'VAr', { abs: 0.5 })], [m('Q_C = -\\omega CV^2 = -(' + N(w) + ')(' + N(C) + ')(' + V + '^2) = ' + E(Qc, 'VAr')), m('Q_S = Q_L + Q_C = ' + N(Q0) + ' + (' + N(Qc) + ') = ' + E(Qs, 'VAr'))], 'Q_S = ' + E(Qs, 'VAr')),
            P('(c) Find the new supply pf (with lead/lag) and supply current.', [ans('pf', P0 / Ss, ''), ans('$I_S$', Ss / V, 'A')], ['P is unchanged by the capacitor.', m('S_S = \\sqrt{P^2 + Q_S^2} = ' + E(Ss, 'VA')), m('\\text{pf} = P/S_S = ' + pfT(P0 / Ss, Qs)) + (Qs < 0 ? ' (over-corrected)' : ''), m('I_S = S_S/V = ' + E(Ss / V, 'A'))], '\\text{pf} = ' + pfT(P0 / Ss, Qs))],
          trap('Read the frequency: at 60 Hz, $\\omega = 377$ rad/s.'), data);
      }
      var pft = v === 'unity' ? 1 : r.pick([0.85, 0.88, 0.9, 0.92, 0.95, 0.98]);
      if (pft <= pf0 + 0.04) return null;
      var tg = Math.tan(Math.acos(pft)), QsL = P0 * tg, QcL = QsL - Q0, CL = -QcL / (w * V * V), Snew = P0 / pft;
      data.pft = pft;
      var b = P('(b) Find the supply Q needed for ' + (v === 'unity' ? 'unity pf' : 'a supply pf of ' + pft + ' lagging') + ', the capacitor reactive power and the capacitance.',
        [ans('$Q_S$', QsL, 'VAr', { abs: 0.5 }), ans('$Q_C$', QcL, 'VAr'), ans('$C$', CL, 'F')],
        ['A capacitor takes no real power, so ' + m('P_S = P_L = ' + E(P0, 'W')),
          v === 'unity' ? m('Q_S = 0') : m('Q_S = P\\tan(\\cos^{-1}' + pft + ') = ' + N(P0) + '\\times' + N(tg) + ' = ' + E(QsL, 'VAr')),
          m('Q_C = Q_S - Q_L = ' + N(QsL) + ' - ' + N(Q0) + ' = ' + E(QcL, 'VAr')) + ' (negative: generated)',
          m('C = \\dfrac{|Q_C|}{\\omega V^2} = \\dfrac{' + N(-QcL) + '}{' + N(w) + '\\times' + V + '^2} = ' + E(CL, 'F'))], 'C = ' + E(CL, 'F'));
      if (v === 'two') {
        var QsD = -P0 * tg, QcD = QsD - Q0, CD = -QcD / (w * V * V);
        return Q(L.desc + ' A capacitor is to be connected across the supply so that the supply pf is ' + pft + '.', L.fig, given.concat([['target pf', String(pft)]]),
          [a1, b, P('(c) Find the other capacitance that also gives a pf of ' + pft + ' (leading), and the supply current in both cases.', [ans('$C_{lead}$', CD, 'F'), ans('$I_S$', Snew / V, 'A')],
            ['Over-correction: ' + m('Q_S = -P\\tan(\\cos^{-1}' + pft + ') = ' + E(QsD, 'VAr')), m('Q_C = ' + N(QsD) + ' - ' + N(Q0) + ' = ' + E(QcD, 'VAr') + ',\\quad C = ' + N(-QcD) + '/(' + N(w) + '\\times' + V + '^2) = ' + E(CD, 'F')), 'Both give the same S, so the same current: ' + m('S = P/\\text{pf} = ' + E(Snew, 'VA') + ',\\ I_S = ' + E(Snew / V, 'A')), 'The smaller (lagging) capacitor is the sensible choice.'], 'C_{lead} = ' + E(CD, 'F'))],
          trap('One pf value has two capacitor solutions: under-corrected (lag) and over-corrected (lead).'), data);
      }
      return Q(L.desc + ' A capacitor is to be connected across the supply to raise the supply power factor to ' + (v === 'unity' ? 'unity' : pft + ' lagging') + '.', L.fig, given.concat([['target pf', v === 'unity' ? '1' : pft + ' lag']]),
        [a1, b, P('(c) Find the new supply S and current. Has the load current changed?', [ans('$S_S$', Snew, 'VA'), ans('$I_S$', Snew / V, 'A')],
          [m('S_S = P/\\text{pf} = ' + N(P0) + '/' + pft + ' = ' + E(Snew, 'VA')), m('I_S = S_S/V = ' + E(Snew / V, 'A')) + ' (down from ' + m(E(S0 / V, 'A')) + ')', 'The load still sees the same voltage, so its own current and pf are unchanged; only the supply side changes.'], 'I_S = ' + E(Snew / V, 'A'))],
        trap('Use the voltage <b>across the capacitor</b> and $|Q_C|$ in $C = |Q_C|/(\\omega V^2)$.'), data);
    }
  });

  ADD({
    id: 'mach.ac.pfc.bank-3ph', course: 'mach', module: 'ac', topic: 'pfc',
    title: 'Three-phase capacitor bank: star vs delta', difficulty: 3, marks: 8,
    variants: [{ id: 'delta', label: 'Delta-connected bank' }, { id: 'star', label: 'Star-connected bank' }, { id: 'compare', label: 'Compare star and delta' }, { id: 'miswired', label: 'Delta-sized bank wired in star' }],
    tags: ['exam-style', 'Q1', 'mock Q1c', 'PQ 2.29'],
    gen: function (r, v) {
      var VL = r.pick([400, 415, 440]), f = 50, w = omega(f), mode = r.pick(['kva', 'mech']);
      var Pm, Qm, desc, boxes, steps, Ph = 0, raw = { mode: mode };
      if (mode === 'kva') {
        var Sm = r.nice(10, 120, 5) * 1000, pfm = r.float(0.7, 0.86, 2); raw.S = Sm; raw.pf = pfm; Pm = Sm * pfm; Qm = Sm * Math.sin(Math.acos(pfm));
        desc = 'A star-connected motor rated ' + F.eng(Sm, 'VA') + ' runs at ' + pfm + ' pf lagging';
        steps = [m('P = S\\,\\text{pf} = ' + N(Sm) + '\\times' + pfm + ' = ' + E(Pm, 'W')), m('Q = S\\sin(\\cos^{-1}' + pfm + ') = ' + E(Qm, 'VAr'))];
        boxes = [{ t: 'motor', s: F.eng(Sm, 'VA') + ', ' + pfm + ' lag' }];
      } else {
        var Po = r.nice(5, 75, 1) * 1000, eta = r.float(0.85, 0.94, 2), pfm2 = r.float(0.72, 0.86, 2); Ph = r.nice(0, 30, 5) * 1000;
        raw.Po = Po; raw.eta = eta; raw.pf = pfm2; raw.Ph = Ph; Pm = Po / eta; Qm = Pm * Math.tan(Math.acos(pfm2));
        desc = 'An induction motor delivers ' + F.eng(Po, 'W') + ' at ' + Math.round(eta * 100) + ' % efficiency and ' + pfm2 + ' pf lagging' + (Ph ? ', alongside a ' + F.eng(Ph, 'W') + ' balanced resistive heater' : '');
        steps = [m('P_{im} = ' + N(Po) + '/' + eta + ' = ' + E(Pm, 'W') + ',\\ Q_{im} = P_{im}\\tan(\\cos^{-1}' + pfm2 + ') = ' + E(Qm, 'VAr'))].concat(Ph ? ['The heater adds ' + m(E(Ph, 'W')) + ' and no Q.'] : []);
        boxes = [{ t: 'motor', s: F.eng(Po, 'W') + ' out' }].concat(Ph ? [{ t: 'heater', s: F.eng(Ph, 'W') }] : []);
        Pm += Ph;
      }
      var S0 = Math.hypot(Pm, Qm), pf0 = Pm / S0, IL0 = S0 / (SQ3 * VL);
      var pft = r.pick([0.9, 0.92, 0.95, 0.97, 0.98, 1]);
      if (pft <= pf0 + 0.03) return null;
      var Qs = Pm * Math.tan(Math.acos(pft)), Qc = Qs - Qm, Qper = -Qc / 3, Vy = VL / SQ3;
      var CD = Qper / (w * VL * VL), CY = Qper / (w * Vy * Vy), IL1 = Pm / pft / (SQ3 * VL);
      boxes.push({ t: 'C bank', s: v === 'star' ? 'star' : v === 'compare' ? 'Y or Δ' : 'delta' });
      var fig = figBus(boxes, { supply: VL + ' V, ' + f + ' Hz, 3-phase' });
      var a = P('(a) Find the total P, Q, pf and line current before correction.', [ans('$P$', Pm, 'W'), ans('$Q$', Qm, 'VAr'), ans('pf', pf0, ''), ans('$I_L$', IL0, 'A')],
        steps.concat([m('S = \\sqrt{P^2+Q^2} = ' + E(S0, 'VA') + ',\\ \\text{pf} = ' + pfT(pf0, Qm)), m('I_L = \\dfrac{S}{\\sqrt3V_L} = \\dfrac{' + N(S0) + '}{\\sqrt3(' + VL + ')} = ' + E(IL0, 'A'))]), 'I_L = ' + E(IL0, 'A'));
      var b = P('(b) Find the total reactive power the bank must supply for ' + (pft === 1 ? 'unity pf' : 'a pf of ' + pft + ' lagging') + ', and the new line current.', [ans('$Q_C$', Qc, 'VAr'), ans("$I_L'$", IL1, 'A')],
        [pft === 1 ? m('Q_S = 0') : m('Q_S = P\\tan(\\cos^{-1}' + pft + ') = ' + E(Qs, 'VAr')), m('Q_C = Q_S - Q = ' + E(Qc, 'VAr') + '\\ \\Rightarrow\\ ' + E(Qper, 'VAr') + '\\ \\text{per capacitor}'), m("I_L' = \\dfrac{P/\\text{pf}}{\\sqrt3V_L} = " + E(IL1, 'A'))], 'Q_C = ' + E(Qc, 'VAr'));
      var data = { v: v, VL: VL, load: raw, pft: pft };
      var cStar = m('V_C = V_L/\\sqrt3 = ' + E(Vy, 'V') + ',\\quad C_Y = \\dfrac{|Q_C|/3}{\\omega V_C^2} = \\dfrac{' + N(Qper) + '}{' + N(w) + '\\times' + N(Vy) + '^2} = ' + E(CY, 'F'));
      var cDelta = m('V_C = V_L = ' + VL + '\\ \\text{V},\\quad C_\\Delta = \\dfrac{|Q_C|/3}{\\omega V_L^2} = \\dfrac{' + N(Qper) + '}{' + N(w) + '\\times' + VL + '^2} = ' + E(CD, 'F'));
      var stem = 'A ' + VL + ' V, ' + f + ' Hz three-phase supply feeds a plant. ' + desc + '. A bank of three capacitors is to be added to raise the supply pf to ' + (pft === 1 ? 'unity' : pft + ' lagging') + '.';
      var given = [['$V_L$', VL + ' V'], ['$f$', f + ' Hz'], ['target pf', pft === 1 ? '1' : pft + ' lag']];
      if (v === 'delta' || v === 'star') {
        return Q(stem + ' The capacitors are connected in <b>' + v + '</b>.', fig, given,
          [a, b, P('(c) Find the capacitance of each capacitor and its voltage rating.', [ans('$C$', v === 'star' ? CY : CD, 'F'), ans('$V_C$', v === 'star' ? Vy : VL, 'V')], ['Each capacitor supplies one third of $|Q_C|$ at the voltage across it.', v === 'star' ? cStar : cDelta], 'C_' + (v === 'star' ? 'Y' : '\\Delta') + ' = ' + E(v === 'star' ? CY : CD, 'F'))],
          trap('A star capacitor sees $V_L/\\sqrt3$, not $V_L$. Using $V_L$ undersizes a star bank by 3.'), data);
      }
      if (v === 'compare') {
        return Q(stem, fig, given, [a, b, P('(c) Find the capacitance per phase for a delta bank and for a star bank. State the ratio and the voltage rating of each.', [ans('$C_\\Delta$', CD, 'F'), ans('$C_Y$', CY, 'F'), ans('$C_Y/C_\\Delta$', 3, '')], [cDelta, cStar, m('C_Y/C_\\Delta = 3') + '. The delta bank needs a ' + VL + ' V rating; the star bank only ' + N(Vy) + ' V.'], 'C_\\Delta = ' + E(CD, 'F') + ',\\ C_Y = ' + E(CY, 'F'))],
          tip('Same total $Q_C$, same line current into the bank, whichever connection.'), data);
      }
      var Qs2 = Qm + Qc / 3, S2 = Math.hypot(Pm, Qs2);
      return Q(stem + ' The capacitors are sized for a <b>delta</b> connection, but the electrician wires them in <b>star</b> by mistake.', fig, given,
        [a, b, P('(c) Find the capacitance per phase (delta sizing).', [ans('$C_\\Delta$', CD, 'F')], [cDelta], 'C_\\Delta = ' + E(CD, 'F')),
          P('(d) With the bank wired in star, find the reactive power it supplies and the resulting supply pf.', [ans("$Q_C'$", Qc / 3, 'VAr'), ans('pf', Pm / S2, '')], ['In star each capacitor sees $V_L/\\sqrt3$, so its vars fall by 3: ' + m("Q_C' = Q_C/3 = " + E(Qc / 3, 'VAr')), m('Q_S = ' + N(Qm) + ' + (' + N(Qc / 3) + ') = ' + E(Qs2, 'VAr')), m('\\text{pf} = P/\\sqrt{P^2+Q_S^2} = ' + pfT(Pm / S2, Qs2))], '\\text{pf} = ' + pfT(Pm / S2, Qs2))],
        '', data);
    }
  });

  ADD({
    id: 'mach.ac.pfc.supply-q', course: 'mach', module: 'ac', topic: 'pfc',
    title: 'Supply P_S, Q_S and capacitor Q_C, then C at a new supply (Jun24 style)', difficulty: 2, marks: 8,
    variants: [{ id: 'lag', label: 'Target pf lagging' }, { id: 'lead', label: 'Target pf leading' }],
    tags: ['exam-style', 'Jun24 Q1d'],
    gen: function (r, v) {
      var PL = r.nice(40, 400, 5), QL = r.nice(20, 400, 5), SL = Math.hypot(PL, QL), pfL = PL / SL;
      if (pfL > 0.88) return null;
      var pft = r.pick([0.85, 0.9, 0.92, 0.95]);
      if (v === 'lag' && pft <= pfL + 0.03) return null;
      var Qs = (v === 'lead' ? -1 : 1) * PL * Math.tan(Math.acos(pft)), Qc = Qs - QL;
      var Qc2 = -r.nice(10, Math.max(15, Math.round(QL)), 5), V2 = r.pick([110, 115, 120, 230, 240]), f2 = r.pick([50, 60]), C2 = -Qc2 / (omega(f2) * V2 * V2);
      return Q('A series RL load absorbs a real power of ' + PL + ' W and a reactive power of ' + QL + ' VAr. A power-factor correction capacitor $C$ is connected across the input supply.',
        figParallel([{ els: [{ k: 'C', label: 'C' }], I: 'Q_C' }, { els: [{ k: 'L', label: 'L' }, { k: 'R', label: 'R' }], I: 'P_L, Q_L' }], { I: 'P_S, Q_S', src: 'V_1' }),
        [['$P_L$', PL + ' W'], ['$Q_L$', QL + ' VAr'], ['target pf', pft + ' ' + v]],
        [P('(i) Find the power factor of the RL load (sketch its power triangle).', [ans('$S_L$', SL, 'VA'), ans('pf', pfL, '')], ['Triangle: P horizontal, Q up, S the hypotenuse.', m('S_L = \\sqrt{' + PL + '^2 + ' + QL + '^2} = ' + E(SL, 'VA')), m('\\text{pf} = ' + PL + '/' + N(SL) + ' = ' + N(pfL) + '\\ \\text{lag}')], '\\text{pf} = ' + N(pfL) + '\\ \\text{lag}'),
          P('(ii) For a supply pf of ' + pft + ' ' + (v === 'lag' ? 'lagging' : 'leading') + ', find $P_S$, $Q_S$ and the capacitor reactive power $Q_C$.', [ans('$P_S$', PL, 'W'), ans('$Q_S$', Qs, 'VAr'), ans('$Q_C$', Qc, 'VAr')],
            ['The capacitor absorbs no real power: ' + m('P_S = ' + PL + '\\ \\text{W}'), m('Q_S = ' + (v === 'lead' ? '-' : '') + 'P_S\\tan(\\cos^{-1}' + pft + ') = ' + E(Qs, 'VAr')), m('Q_C = Q_S - Q_L = ' + N(Qs) + ' - ' + QL + ' = ' + E(Qc, 'VAr'))], 'Q_C = ' + E(Qc, 'VAr')),
          P('(iii) For another target the capacitor is found to absorb ' + Qc2 + ' VAr. Find the capacitance if the supply is ' + V2 + ' V, ' + f2 + ' Hz.', [ans('$C$', C2, 'F')],
            [m('\\omega = 2\\pi(' + f2 + ') = ' + N(omega(f2)) + txt('rad/s')), m('C = \\dfrac{|Q_C|}{\\omega V^2} = \\dfrac{' + (-Qc2) + '}{' + N(omega(f2)) + '\\times' + V2 + '^2} = ' + E(C2, 'F'))], 'C = ' + E(C2, 'F'))],
        trap('Part (iii) uses the <b>new</b> $Q_C$ and the stated frequency, not the value from part (ii).'), { v: v, PL: PL, QL: QL, pft: pft, Qc2: Qc2, V2: V2, f2: f2 });
    }
  });

  ADD({
    id: 'mach.ac.pfc.benefits', course: 'mach', module: 'ac', topic: 'pfc',
    title: 'Why correct the pf: line loss and spare capacity', difficulty: 2, marks: 6,
    variants: [{ id: 'cable', label: 'Cable loss before and after' }, { id: 'capacity', label: 'Extra load on the same kVA supply' }],
    tags: ['short-answer support'],
    gen: function (r, v) {
      if (v === 'cable') {
        var V = r.pick([230, 240, 415]), three = V > 300, P0 = r.nice(2, 40, 1) * 1000, pf0 = r.float(0.6, 0.8, 2), pf1 = r.pick([0.95, 0.97, 1]), Rl = r.pick([0.05, 0.08, 0.1, 0.15, 0.2, 0.3]);
        var k = three ? SQ3 * V : V, I0 = P0 / (k * pf0), I1 = P0 / (k * pf1), n = three ? 3 : 2, L0 = n * I0 * I0 * Rl, L1 = n * I1 * I1 * Rl;
        return Q('A ' + (three ? 'three-phase ' + V + ' V' : 'single-phase ' + V + ' V') + ' load takes ' + F.eng(P0, 'W') + ' at ' + pf0 + ' pf lagging through a feeder with ' + Rl + ' Ω per conductor (' + (three ? 'three' : 'go and return,') + ' conductors). Capacitors raise the pf to ' + pf1 + '. Ignore the feeder voltage drop.', null,
          [['$P$', F.eng(P0, 'W')], ['pf before', pf0 + ' lag'], ['pf after', String(pf1)], ['$R$ per conductor', Rl + ' Ω']],
          [P('(a) Find the line current before and after correction.', [ans('$I_{before}$', I0, 'A'), ans('$I_{after}$', I1, 'A')], [three ? m('I_L = \\dfrac{P}{\\sqrt3V_L\\,\\text{pf}}') : m('I = \\dfrac{P}{V\\,\\text{pf}}'), m('I_{before} = ' + E(I0, 'A') + ',\\quad I_{after} = ' + E(I1, 'A'))], 'I_{after} = ' + E(I1, 'A')),
            P('(b) Find the feeder loss before and after, and the percentage saving.', [ans('$P_{loss,before}$', L0, 'W'), ans('$P_{loss,after}$', L1, 'W'), pctA('saving', 100 * (1 - L1 / L0))], [m('P_{loss} = ' + n + 'I^2R'), m('P_{before} = ' + n + '(' + N(I0) + ')^2(' + Rl + ') = ' + E(L0, 'W')), m('P_{after} = ' + n + '(' + N(I1) + ')^2(' + Rl + ') = ' + E(L1, 'W')), 'Saving ' + m('= 1 - (\\text{pf}_0/\\text{pf}_1)^2 = ' + N(100 * (1 - L1 / L0)) + '\\%')], '\\text{saving} = ' + N(100 * (1 - L1 / L0)) + '\\%')],
          tip('The same useful power is delivered with less current, so less $I^2R$ in the conductors.'), { v: v, V: V, three: three, P: P0, pf0: pf0, pf1: pf1, R: Rl });
      }
      var Sr = r.nice(50, 500, 10) * 1000, pf0b = r.float(0.65, 0.8, 2), pf1b = r.pick([0.95, 0.97, 1]), P0b = Sr * pf0b, Q0b = Sr * Math.sin(Math.acos(pf0b));
      var Qc = P0b * Math.tan(Math.acos(pf1b)) - Q0b, Pnew = Sr * pf1b, extra = Pnew - P0b;
      return Q('A plant is supplied through a ' + F.eng(Sr, 'VA') + ' transformer, which is fully loaded at ' + pf0b + ' pf lagging.', null,
        [['$S_{rated}$', F.eng(Sr, 'VA')], ['pf now', pf0b + ' lag'], ['target', String(pf1b)]],
        [P('(a) Find the plant P and Q, and the capacitor Q needed to raise the pf to ' + pf1b + ' with the same P.', [ans('$P$', P0b, 'W'), ans('$Q$', Q0b, 'VAr'), ans('$Q_C$', Qc, 'VAr')], [m('P = S\\,\\text{pf} = ' + E(P0b, 'W') + ',\\ Q = ' + E(Q0b, 'VAr')), m('Q_C = P\\tan(\\cos^{-1}' + pf1b + ') - Q = ' + E(Qc, 'VAr'))], 'Q_C = ' + E(Qc, 'VAr')),
          P('(b) After correction, how much extra real power (at pf ' + pf1b + ') can the transformer supply before it is again at its kVA rating?', [ans('$\\Delta P$', extra, 'W')], [m('P_{max} = S_{rated}\\times\\text{pf} = ' + E(Pnew, 'W')), m('\\Delta P = ' + N(Pnew) + ' - ' + N(P0b) + ' = ' + E(extra, 'W'))], '\\Delta P = ' + E(extra, 'W'))],
        tip('Correcting the pf frees kVA capacity: the transformer is limited by current (S), not by P.'), { v: v, S: Sr, pf0: pf0b, pf1: pf1b });
    }
  });

  /* ---------- ac.3ph ---------- */
  ADD({
    id: 'mach.ac.3ph.balanced-load', course: 'mach', module: 'ac', topic: '3ph',
    title: 'Balanced star or delta load: phase and line quantities, P and Q', difficulty: 2, marks: 6,
    variants: [{ id: 'star', label: 'Star-connected' }, { id: 'delta', label: 'Delta-connected' }, { id: 'reconnect', label: 'Delta, then reconnected in star' }],
    tags: ['exam-style', 'Q1', 'Jun23 Q1b', 'PQ 2.30', 'mock Q1b'],
    gen: function (r, v) {
      var VL = r.pick([380, 400, 415, 440, 460]), resist = r.bool(0.35), R = resist ? r.nice(10, 100, 2) : r.nice(2, 40, 1), X = resist ? 0 : r.nice(2, 40, 1);
      var conn = v === 'star' ? 'star' : 'delta', Z = CX(R, X);
      function solve(c) { var V1 = c === 'star' ? VL / SQ3 : VL, I1 = CX(V1, 0).div(Z), IL = c === 'star' ? I1.abs() : SQ3 * I1.abs(), S1 = CX(V1, 0).mul(I1.conj()); return { V1: V1, I1: I1, IL: IL, P: 3 * S1.re, Q: 3 * S1.im }; }
      var s = solve(conn), zt = resist ? N(R) + '\\ \\Omega' : CR(Z) + '\\ \\Omega';
      var pf = R / Z.abs();
      var ph = conn === 'star' ? m('V_1 = V_L/\\sqrt3 = ' + VL + '/\\sqrt3 = ' + E(s.V1, 'V')) : m('V_1 = V_L = ' + VL + '\\ \\text{V}') + ' (delta: each phase is across two lines)';
      var a = P('(a) Find the phase voltage, phase current' + (resist ? '' : ' (magnitude and angle)') + ' and line current.', [ans('$V_1$', s.V1, 'V'), ans('$|I_1|$', s.I1.abs(), 'A')].concat(resist ? [] : [angA('$\\angle I_1$', s.I1.argd())]).concat([ans('$I_L$', s.IL, 'A')]),
        [ph, resist ? m('I_1 = V_1/R = ' + N(s.V1) + '/' + R + ' = ' + E(s.I1.abs(), 'A')) : m('Z = ' + CR(Z) + ' = ' + PZ(Z, 'Ω') + ',\\ I_1 = V_1/Z = ' + PZ(s.I1, 'A')), conn === 'star' ? m('I_L = I_1 = ' + E(s.IL, 'A')) : m('I_L = \\sqrt3I_1 = ' + E(s.IL, 'A'))], 'I_L = ' + E(s.IL, 'A'));
      var b = P('(b) Find the power factor, total P and total Q.', [ans('pf', pf, '')].concat([ans('$P$', s.P, 'W')]).concat(resist ? [] : [ans('$Q$', s.Q, 'VAr')]),
        [m('\\text{pf} = \\cos\\angle Z = ' + (resist ? '1' : N(pf) + '\\ \\text{lag}')), m('P = 3I_1^2R = 3(' + N(s.I1.abs()) + ')^2(' + R + ') = ' + E(s.P, 'W')), resist ? '' : m('Q = 3I_1^2X = ' + E(s.Q, 'VAr')), 'Check: ' + m('\\sqrt3V_LI_L\\,\\text{pf} = \\sqrt3(' + VL + ')(' + N(s.IL) + ')(' + N(pf) + ') = ' + E(s.P, 'W'))], 'P = ' + E(s.P, 'W'));
      var parts = [a, b], data = { v: v, VL: VL, R: R, X: X };
      if (v === 'reconnect') {
        var s2 = solve('star');
        parts.push(P('(c) The same impedances are reconnected in star on the same supply. Find the new line current and total P, and the factors by which they change.', [ans("$I_L'$", s2.IL, 'A'), ans("$P'$", s2.P, 'W'), ans('$P_\\Delta/P_Y$', 3, '')],
          [m("V_1' = V_L/\\sqrt3 = " + E(s2.V1, 'V') + ',\\ I_L\' = I_1\' = ' + E(s2.IL, 'A')), m("P' = " + E(s2.P, 'W')), 'Phase V and phase I fall by $\\sqrt3$; line current, P and Q fall by 3; the pf is unchanged.'], "P' = P/3 = " + E(s2.P, 'W')));
      }
      return Q('A balanced three-phase load is connected in <b>' + conn + '</b> to a ' + VL + ' V (line), 50 Hz supply. Each phase is ' + m(zt) + '.', fig3phLoad(conn, 'Z', resist ? R + ' Ω' : R + ' + j' + X + ' Ω', { VL: VL + ' V' }),
        [['$V_L$', VL + ' V'], ['$Z$ per phase', resist ? R + ' Ω' : R + ' + j' + X + ' Ω'], ['connection', conn]], parts,
        trap('φ is between phase voltage and phase current. Use $3V_1I_1$ with phase values or $\\sqrt3V_LI_L$ with line values, never a mix.'), data);
    }
  });

  ADD({
    id: 'mach.ac.3ph.line-phase', course: 'mach', module: 'ac', topic: '3ph',
    title: 'Line and phase quantities for star and delta', difficulty: 1, marks: 4,
    variants: [{ id: 'req-star', label: 'Phase requirement → line values (star)' }, { id: 'req-delta', label: 'Phase requirement → line values (delta)' }, { id: 'reconnect', label: 'Star resistive load reconnected in delta' }],
    tags: ['PQ 2.26', 'PQ 2.28'],
    gen: function (r, v) {
      if (v === 'reconnect') {
        var VL = r.pick([208, 230, 400, 415]), IL = r.nice(2, 40, 1), V1 = VL / SQ3, R = V1 / IL, I1d = VL / R, ILd = SQ3 * I1d;
        return Q('A star-connected three-phase resistive load draws ' + IL + ' A from a ' + VL + ' V supply.', fig3phLoad('star', 'R', null, { VL: VL + ' V' }), [['$V_L$', VL + ' V'], ['$I_L$', IL + ' A']],
          [P('(a) Find the resistance of each phase.', [ans('$R$', R, 'Ω')], [m('V_1 = ' + VL + '/\\sqrt3 = ' + E(V1, 'V')), m('R = V_1/I_1 = ' + N(V1) + '/' + IL)], 'R = ' + ohmT(R)),
            P('(b) The load is reconnected in delta on the same supply. Find the new phase voltage, phase current and line current.', [ans('$V_1$', VL, 'V'), ans('$I_1$', I1d, 'A'), ans('$I_L$', ILd, 'A')], [m('V_1 = V_L = ' + VL + '\\ \\text{V},\\ I_1 = V_L/R = ' + E(I1d, 'A')), m('I_L = \\sqrt3I_1 = ' + E(ILd, 'A') + ' = 3\\times' + IL)], 'I_L = ' + E(ILd, 'A'))],
          tip('Phase voltage and phase current rise by $\\sqrt3$; line current rises by 3.'), { v: v, VL: VL, IL: IL });
      }
      var V1r = r.pick([110, 120, 220, 230, 240, 254]), I1r = r.nice(2, 50, 1), Pf = r.float(0.75, 1, 2), star = v === 'req-star';
      var VLr = star ? SQ3 * V1r : V1r, ILr = star ? I1r : SQ3 * I1r, Pt = 3 * V1r * I1r * Pf;
      return Q('Each phase of a balanced three-phase load needs a phase voltage of ' + V1r + ' V and a phase current of ' + I1r + ' A at ' + Pf + ' pf. The load is connected in <b>' + (star ? 'star' : 'delta') + '</b>.', fig3phLoad(star ? 'star' : 'delta', 'Z', null, {}),
        [['$V_1$', V1r + ' V'], ['$I_1$', I1r + ' A'], ['pf', String(Pf)]],
        [P('(a) Find the required supply line voltage and line current.', [ans('$V_L$', VLr, 'V'), ans('$I_L$', ILr, 'A')], star ? [m('V_L = \\sqrt3V_1 = ' + E(VLr, 'V')), m('I_L = I_1 = ' + I1r + '\\ \\text{A}')] : [m('V_L = V_1 = ' + V1r + '\\ \\text{V}'), m('I_L = \\sqrt3I_1 = ' + E(ILr, 'A'))], 'V_L = ' + E(VLr, 'V') + ',\\ I_L = ' + E(ILr, 'A')),
          P('(b) Find the total power, and check it with line quantities.', [ans('$P$', Pt, 'W')], [m('P = 3V_1I_1\\cos\\phi = 3(' + V1r + ')(' + I1r + ')(' + Pf + ') = ' + E(Pt, 'W')), 'Check: ' + m('\\sqrt3V_LI_L\\cos\\phi = \\sqrt3(' + N(VLr) + ')(' + N(ILr) + ')(' + Pf + ') = ' + E(Pt, 'W'))], 'P = ' + E(Pt, 'W'))],
        '', { v: v, V1: V1r, I1: I1r, pf: Pf });
    }
  });

  ADD({
    id: 'mach.ac.3ph.nameplate', course: 'mach', module: 'ac', topic: '3ph',
    title: 'Three-phase motor nameplate: torque, input, line and phase current', difficulty: 2, marks: 6,
    variants: [{ id: 'star', label: 'Connection not stated (assume star)' }, { id: 'delta', label: 'Delta-connected windings' }],
    tags: ['M1 N6', 'PQ 1.22'],
    gen: function (r, v) {
      var VL = r.pick([400, 415, 440]), Pr = r.pick([2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37]) * 1000, n = r.pick([960, 1440, 1455, 1460, 2900, 2935]), eta = r.float(0.82, 0.94, 2), pf = r.float(0.78, 0.9, 2);
      var w = 2 * PI * n / 60, tau = Pr / w, Pin = Pr / eta, IL = Pin / (SQ3 * VL * pf), Sx = Pin / pf, Qx = Sx * Math.sin(Math.acos(pf));
      var star = v === 'star', V1 = star ? VL / SQ3 : VL, I1 = star ? IL : IL / SQ3;
      return Q('A three-phase induction motor is rated ' + VL + ' V, ' + F.eng(Pr, 'W') + ', ' + n + ' rpm, with an efficiency of ' + Math.round(eta * 100) + ' % and a pf of ' + pf + ' lagging. ' + (star ? 'Its connection is not stated.' : 'Its stator windings are connected in delta.'), null,
        [['rating', VL + ' V, ' + F.eng(Pr, 'W') + ', ' + n + ' rpm'], ['$\\eta$', Math.round(eta * 100) + ' %'], ['pf', pf + ' lag']],
        [P('(a) Find the rated torque.', [ans('$\\tau$', tau, 'N·m')], ['The nameplate power is the shaft output.', m('\\omega = 2\\pi(' + n + ')/60 = ' + N(w) + txt('rad/s')), m('\\tau = ' + N(Pr) + '/' + N(w))], '\\tau = ' + E(tau, 'N·m')),
          P('(b) Find the input power, line current and input reactive power.', [ans('$P_{IN}$', Pin, 'W'), ans('$I_L$', IL, 'A'), ans('$Q$', Qx, 'VAr')], [m('P_{IN} = P_{OUT}/\\eta = ' + E(Pin, 'W')), m('I_L = \\dfrac{P_{IN}}{\\sqrt3V_L\\,\\text{pf}} = \\dfrac{' + N(Pin) + '}{\\sqrt3(' + VL + ')(' + pf + ')} = ' + E(IL, 'A')), m('S = P_{IN}/\\text{pf} = ' + E(Sx, 'VA') + ',\\ Q = S\\sin(\\cos^{-1}' + pf + ') = ' + E(Qx, 'VAr'))], 'I_L = ' + E(IL, 'A')),
          P('(c) Find the phase voltage and phase current of the windings.', [ans('$V_1$', V1, 'V'), ans('$I_1$', I1, 'A')], star ? ['Assume star when not stated: ' + m('V_1 = V_L/\\sqrt3 = ' + E(V1, 'V') + ',\\ I_1 = I_L = ' + E(I1, 'A'))] : ['Delta: ' + m('V_1 = V_L = ' + VL + '\\ \\text{V},\\ I_1 = I_L/\\sqrt3 = ' + E(I1, 'A'))], 'V_1 = ' + E(V1, 'V') + ',\\ I_1 = ' + E(I1, 'A'))],
        trap('Nameplate values are line voltage, line current and total (output) power.'), { v: v, VL: VL, Pr: Pr, n: n, eta: eta, pf: pf });
    }
  });

  /* ---------- ac.dc ---------- */
  ADD({
    id: 'mach.ac.dc.battery', course: 'mach', module: 'ac', topic: 'dc',
    title: 'Battery model: E, R_S, losses and maximum power', difficulty: 1, marks: 5,
    variants: [{ id: 'oc-load', label: 'Open-circuit V and one load test (Jun23 Q1a)' }, { id: 'oc-sc', label: 'Open- and short-circuit tests' }, { id: 'two-points', label: 'Two load points' }, { id: 'model-given', label: 'E and R_S given: resistive load and starter' }],
    tags: ['exam-style', 'Q1', 'Jun23 Q1a', 'PQ 2.6', 'PQ 2.7'],
    gen: function (r, v) {
      var data = { v: v };
      if (v === 'oc-sc') {
        var Voc = r.pick([1.55, 1.6, 1.61, 3.7, 4.2, 9.2, 12.6]), Rint = sg(r.float(0.05, 0.6, 3) * (Voc > 5 ? 0.2 : 1), 2), Isc = sg(Voc / Rint, 3), Rs = Voc / Isc, Il = sg(Isc * r.float(0.1, 0.3, 2), 2);
        var Vt = Voc - Il * Rs, Pmax = Voc * Voc / (4 * Rs); data.Voc = Voc; data.Isc = Isc; data.I = Il;
        return Q('An open-circuit voltage and short-circuit current test on a battery gives ' + m('V_{OC} = ' + E(Voc, 'V')) + ' and ' + m('I_{SC} = ' + E(Isc, 'A')) + '.', figBattery({ load: 'R' }), [['$V_{OC}$', Voc + ' V'], ['$I_{SC}$', Isc + ' A'], ['load current', Il + ' A']],
          [P('(a) Find E and $R_S$.', [ans('$E$', Voc, 'V'), ans('$R_S$', Rs, 'Ω')], [m('E = V_{OC} = ' + E(Voc, 'V')), m('R_S = V_{OC}/I_{SC} = ' + Voc + '/' + Isc + ' = ' + ohmT(Rs))], 'R_S = ' + ohmT(Rs)),
            P('(b) Find the output voltage and power at a load current of ' + Il + ' A.', [ans('$V$', Vt, 'V'), ans('$P_{out}$', Vt * Il, 'W')], [m('V = E - IR_S = ' + Voc + ' - ' + Il + '\\times' + N(Rs) + ' = ' + E(Vt, 'V')), m('P = VI = ' + E(Vt * Il, 'W'))], 'V = ' + E(Vt, 'V')),
            P('(c) Find the maximum output power.', [ans('$P_{max}$', Pmax, 'W')], ['Maximum power is at $R_L = R_S$ (only 50 % efficiency).', m('P_{max} = \\dfrac{E^2}{4R_S} = \\dfrac{' + Voc + '^2}{4\\times' + N(Rs) + '} = ' + E(Pmax, 'W'))], 'P_{max} = ' + E(Pmax, 'W'))], '', data);
      }
      if (v === 'two-points') {
        var E0 = r.pick([12.6, 12.7, 12.8, 13.2, 13.8]), Rs2 = r.pick([0.01, 0.012, 0.015, 0.02, 0.025]), Ia = r.nice(2, 10, 1), Ib = r.nice(60, 250, 5), Va = sg(E0 - Ia * Rs2, 4), Vb = sg(E0 - Ib * Rs2, 4);
        var Rc = (Va - Vb) / (Ib - Ia), Ec = Va + Ia * Rc, Ic = r.nice(100, 300, 10), Vc = Ec - Ic * Rc; data.Va = Va; data.Ia = Ia; data.Vb = Vb; data.Ib = Ib; data.Ic = Ic;
        return Q('A car battery delivers ' + Va + ' V while supplying ' + Ia + ' A to the lights. When the starter motor is engaged the total current is ' + Ib + ' A and the terminal voltage falls to ' + Vb + ' V. Use the model $E$ in series with $R_S$.', figBattery({ load: 'M' }),
          [['$V_1, I_1$', Va + ' V, ' + Ia + ' A'], ['$V_2, I_2$', Vb + ' V, ' + Ib + ' A']],
          [P('(a) Find $R_S$ and $E$.', [ans('$R_S$', Rc, 'Ω'), ans('$E$', Ec, 'V')], [m('R_S = -\\dfrac{\\Delta V}{\\Delta I} = \\dfrac{' + Va + ' - ' + Vb + '}{' + Ib + ' - ' + Ia + '} = ' + ohmT(Rc)), m('E = V_1 + I_1R_S = ' + Va + ' + ' + Ia + '\\times' + N(Rc) + ' = ' + E(Ec, 'V'))], 'E = ' + E(Ec, 'V')),
            P('(b) Find the terminal voltage, the power to the load and the internal loss at ' + Ic + ' A.', [ans('$V$', Vc, 'V'), ans('$P_{load}$', Vc * Ic, 'W'), ans('$P_{loss}$', Ic * Ic * Rc, 'W')], [m('V = E - IR_S = ' + E(Vc, 'V')), m('P_{load} = VI = ' + E(Vc * Ic, 'W') + ',\\ P_{loss} = I^2R_S = ' + E(Ic * Ic * Rc, 'W')), 'Check: ' + m('EI = ' + E(Ec * Ic, 'W'))], 'P_{load} = ' + E(Vc * Ic, 'W')),
            P('(c) Find the maximum power the battery could deliver.', [ans('$P_{max}$', Ec * Ec / (4 * Rc), 'W')], [m('P_{max} = E^2/(4R_S) = ' + E(Ec * Ec / (4 * Rc), 'W'))], 'P_{max} = ' + E(Ec * Ec / (4 * Rc), 'W'))], '', data);
      }
      if (v === 'model-given') {
        var Em = r.pick([12, 12.5, 12.6, 24, 48]), Rm = r.pick([0.01, 0.015, 0.02, 0.03, 0.05]) * (Em > 20 ? 2 : 1), RL = r.pick([0.5, 1, 1.5, 2, 4]) * (Em > 20 ? 2 : 1), Vst = sg(Em * r.float(0.6, 0.8, 2), 3);
        var Ir = Em / (Rm + RL), Vr = Ir * RL, Ist = (Em - Vst) / Rm; data.E = Em; data.R = Rm; data.RL = RL; data.Vst = Vst;
        return Q('A battery is modelled as ' + m('E = ' + E(Em, 'V')) + ' in series with ' + m('R_S = ' + ohmT(Rm)) + '.', figBattery({ E: Em + ' V', RS: pv(Rm, 'Ω'), load: 'R' }), [['$E$', Em + ' V'], ['$R_S$', F.eng(Rm, 'Ω')], ['$R_L$', RL + ' Ω'], ['$V$ (starter)', Vst + ' V']],
          [P('(a) Find the short-circuit current and the internal loss on short circuit.', [ans('$I_{SC}$', Em / Rm, 'A'), ans('$P$', Em * Em / Rm, 'W')], [m('I_{SC} = E/R_S = ' + E(Em / Rm, 'A')), m('P = I^2R_S = ' + E(Em * Em / Rm, 'W'))], 'I_{SC} = ' + E(Em / Rm, 'A')),
            P('(b) Find the output voltage and current with a ' + RL + ' Ω load.', [ans('$I$', Ir, 'A'), ans('$V$', Vr, 'V')], [m('I = \\dfrac{E}{R_S + R_L} = \\dfrac{' + Em + '}{' + N(Rm) + ' + ' + RL + '} = ' + E(Ir, 'A')), m('V = IR_L = ' + E(Vr, 'V'))], 'V = ' + E(Vr, 'V')),
            P('(c) With the starter motor on, the terminal voltage falls to ' + Vst + ' V. Find the motor current and the power supplied to it.', [ans('$I$', Ist, 'A'), ans('$P$', Vst * Ist, 'W')], [m('I = \\dfrac{E - V}{R_S} = \\dfrac{' + Em + ' - ' + Vst + '}{' + N(Rm) + '} = ' + E(Ist, 'A')), m('P = VI = ' + E(Vst * Ist, 'W'))], 'P = ' + E(Vst * Ist, 'W'))],
          trap('Power to the load uses the terminal voltage ($VI$), not $EI$.'), data);
      }
      var Eoc = r.pick([12.6, 12.8, 13.2, 13.8]), Ist2 = r.nice(150, 400, 10), Vt2 = sg(Eoc * r.float(0.62, 0.8, 2), 3), Rs3 = (Eoc - Vt2) / Ist2, In = r.nice(5, 40, 5), Vn = Eoc - In * Rs3;
      data.Voc = Eoc; data.I = Ist2; data.V = Vt2; data.In = In;
      return Q('The equivalent circuit shown models a car battery. Its open-circuit voltage is measured at ' + Eoc + ' V. A DC starter motor is connected; it draws ' + Ist2 + ' A and the battery voltage falls to ' + Vt2 + ' V.', figBattery({ load: 'M' }),
        [['$V_{OC}$', Eoc + ' V'], ['$I$ (starter)', Ist2 + ' A'], ['$V$ (starter)', Vt2 + ' V']],
        [P('(i) Find E.', [ans('$E$', Eoc, 'V')], ['On open circuit $I = 0$, so there is no drop across $R_S$: ' + m('E = V_{OC} = ' + Eoc + '\\ \\text{V}')], 'E = ' + Eoc + '\\ \\text{V}'),
          P('(ii) Find $R_S$, the power dissipated in it, and the power delivered to the motor.', [ans('$R_S$', Rs3, 'Ω'), ans('$P_{R_S}$', Ist2 * Ist2 * Rs3, 'W'), ans('$P_{motor}$', Vt2 * Ist2, 'W')], [m('R_S = \\dfrac{E - V}{I} = \\dfrac{' + Eoc + ' - ' + Vt2 + '}{' + Ist2 + '} = ' + ohmT(Rs3)), m('P_{R_S} = I^2R_S = ' + E(Ist2 * Ist2 * Rs3, 'W') + ',\\ P_{motor} = VI = ' + E(Vt2 * Ist2, 'W')), 'Check: ' + m('EI = ' + E(Eoc * Ist2, 'W'))], 'R_S = ' + ohmT(Rs3)),
          P('(iii) Find the battery output voltage when a load drawing ' + In + ' A is connected.', [ans('$V$', Vn, 'V')], [m('V = E - IR_S = ' + Eoc + ' - ' + In + '\\times' + N(Rs3) + ' = ' + E(Vn, 'V'))], 'V = ' + E(Vn, 'V'))],
        '', data);
    }
  });

  ADD({
    id: 'mach.ac.dc.cable', course: 'mach', module: 'ac', topic: 'dc',
    title: 'DC supply through a cable: motor voltage, loss and efficiency', difficulty: 2, marks: 5,
    variants: [{ id: 'current', label: 'Motor current given' }, { id: 'power', label: 'Motor power given (quadratic)' }, { id: 'size', label: 'Size the cable for a minimum voltage' }],
    tags: ['mock Q1a'],
    gen: function (r, v) {
      var Es = r.pick([24, 48, 110, 220]), Rc = sg(r.float(0.02, 0.3, 3) * Es / 48, 2), data = { v: v, E: Es, R: Rc };
      if (v === 'current') {
        var I = r.nice(0.1 * Es / Rc * 0.3, 0.1 * Es / Rc * 1.2, 1), Vm = Es - I * Rc;
        if (I < 1 || Vm < 0.75 * Es || Vm > 0.98 * Es) return null;
        var Pin = Vm * I, eta = r.float(0.75, 0.9, 2), Po = sg(eta * Pin, 3), n = r.pick([900, 1200, 1500, 1800, 3000]), w = 2 * PI * n / 60; data.I = I; data.Po = Po; data.n = n;
        return Q('A DC motor is supplied from an ideal ' + Es + ' V source through a cable of total resistance (go and return) ' + Rc + ' Ω. The motor draws ' + I + ' A and delivers ' + F.eng(Po, 'W') + ' of mechanical power at ' + n + ' rpm.', figCable({ E: Es + ' V', R: Rc + ' Ω' }),
          [['$E$', Es + ' V'], ['$R_{cable}$', Rc + ' Ω'], ['$I$', I + ' A'], ['$P_{OUT}$', F.eng(Po, 'W')], ['$n$', n + ' rpm']],
          [P('(i) Find the motor terminal voltage and the cable loss.', [ans('$V_M$', Vm, 'V'), ans('$P_{cable}$', I * I * Rc, 'W')], [m('V_M = E - IR = ' + Es + ' - ' + I + '\\times' + Rc + ' = ' + E(Vm, 'V')), m('P_{cable} = I^2R = ' + E(I * I * Rc, 'W'))], 'V_M = ' + E(Vm, 'V')),
            P('(ii) Find the motor input power, efficiency and output torque.', [ans('$P_{IN}$', Pin, 'W'), pctA('$\\eta$', 100 * Po / Pin), ans('$\\tau$', Po / w, 'N·m')], [m('P_{IN} = V_MI = ' + E(Pin, 'W')), m('\\eta = ' + N(Po) + '/' + N(Pin) + ' = ' + N(100 * Po / Pin) + '\\%'), m('\\omega = ' + N(w) + txt('rad/s') + ',\\ \\tau = P/\\omega = ' + E(Po / w, 'N·m'))], '\\eta = ' + N(100 * Po / Pin) + '\\%')],
          trap('The motor input is $V_MI$, not $EI$: the cable loss is not the motor\'s.'), data);
      }
      if (v === 'power') {
        var Pm = sg(r.float(0.1, 0.22, 2) * Es * Es / Rc, 2);
        var disc = Es * Es - 4 * Rc * Pm; if (disc <= 0) return null;
        var Ip = (Es - Math.sqrt(disc)) / (2 * Rc), Vp = Es - Ip * Rc; data.P = Pm;
        return Q('A DC motor takes an electrical input of ' + F.eng(Pm, 'W') + ' at its terminals. It is fed from an ideal ' + Es + ' V source through a cable of total resistance ' + Rc + ' Ω.', figCable({ E: Es + ' V', R: Rc + ' Ω', mval: F.eng(Pm, 'W') }),
          [['$E$', Es + ' V'], ['$R$', Rc + ' Ω'], ['$P_M$', F.eng(Pm, 'W')]],
          [P('(a) Find the current, choosing the sensible root.', [ans('$I$', Ip, 'A')], [m('P_M = V_MI = (E - IR)I \\Rightarrow RI^2 - EI + P_M = 0'), m(Rc + 'I^2 - ' + Es + 'I + ' + N(Pm) + ' = 0'), m('I = \\dfrac{E - \\sqrt{E^2 - 4RP_M}}{2R} = ' + E(Ip, 'A')), 'The other root gives a huge current with most of the voltage lost in the cable.'], 'I = ' + E(Ip, 'A')),
            P('(b) Find the motor voltage, cable loss and transmission efficiency.', [ans('$V_M$', Vp, 'V'), ans('$P_{cable}$', Ip * Ip * Rc, 'W'), pctA('$\\eta_{cable}$', 100 * Pm / (Es * Ip))], [m('V_M = E - IR = ' + E(Vp, 'V')), m('P_{cable} = I^2R = ' + E(Ip * Ip * Rc, 'W')), m('\\eta = P_M/(EI) = ' + N(100 * Pm / (Es * Ip)) + '\\%')], 'V_M = ' + E(Vp, 'V'))], '', data);
      }
      var I3 = r.nice(10, 120, 5), Vmin = sg(Es * r.float(0.9, 0.96, 2), 3), len = r.nice(10, 80, 5), rho = 1.72e-8;
      var Rmax = (Es - Vmin) / I3, Amin = rho * 2 * len / Rmax; data.I = I3; data.Vmin = Vmin; data.len = len;
      return Q('A ' + Es + ' V DC source feeds a motor drawing ' + I3 + ' A through a two-core copper cable of route length ' + len + ' m (so ' + 2 * len + ' m of conductor). The motor voltage must not fall below ' + Vmin + ' V. Take ' + m('\\rho_{Cu} = 1.72\\times10^{-8}\\ \\Omega\\text{m}') + '.', figCable({ E: Es + ' V', R: '?' }),
        [['$E$', Es + ' V'], ['$I$', I3 + ' A'], ['$V_{min}$', Vmin + ' V'], ['route length', len + ' m']],
        [P('(a) Find the maximum total cable resistance.', [ans('$R_{max}$', Rmax, 'Ω')], [m('R_{max} = \\dfrac{E - V_{min}}{I} = \\dfrac{' + Es + ' - ' + Vmin + '}{' + I3 + '} = ' + ohmT(Rmax))], 'R_{max} = ' + ohmT(Rmax)),
          P('(b) Find the minimum conductor cross-section and the cable loss at that size.', [ans('$A_{min}$', Amin, 'm²', { hint: 'in m² (1 mm² = 1e-6 m²)' }), ans('$P_{cable}$', I3 * I3 * Rmax, 'W')], [m('R = \\dfrac{\\rho l}{A} \\Rightarrow A = \\dfrac{\\rho l}{R} = \\dfrac{1.72\\times10^{-8}\\times' + 2 * len + '}{' + N(Rmax) + '} = ' + N(Amin) + '\\ \\text{m}^2 = ' + N(Amin * 1e6) + '\\ \\text{mm}^2'), m('P = I^2R = ' + E(I3 * I3 * Rmax, 'W'))], 'A_{min} = ' + N(Amin * 1e6) + '\\ \\text{mm}^2')],
        trap('Count both conductors: the current goes out and back.'), data);
    }
  });

  /* ============================================================ MODULE 2 · MAGNETICS AND TRANSFORMERS */

  function relT(name, l, mu, A, val) { return m(name + ' = \\dfrac{l}{\\mu_R\\mu_0A} = \\dfrac{' + N(l) + '}{' + (mu === 1 ? '' : mu + '\\times') + '4\\pi\\times10^{-7}\\times' + N(A) + '} = ' + E(val, 'At/Wb')); }
  function relG(name, g, A, val) { return m(name + ' = \\dfrac{l_G}{\\mu_0A} = \\dfrac{' + N(g) + '}{4\\pi\\times10^{-7}\\times' + N(A) + '} = ' + E(val, 'At/Wb')); }
  function cm2(x) { return x + ' cm²'; }

  /* ---------- mag.magcct ---------- */
  ADD({
    id: 'mach.mag.magcct.core-L', course: 'mach', module: 'mag', topic: 'magcct',
    title: 'Gapped core: reluctance, inductance and coil current', difficulty: 2, marks: 7,
    variants: [{ id: 'one-gap-I', label: 'C-core, one gap: find I for a given B' }, { id: 'two-gap-I', label: 'Two C-cores (two gaps): find I' },
      { id: 'one-gap-B', label: 'C-core, one gap: find Φ and B for a given I' }, { id: 'paper', label: 'Two cores: no gap, then a paper gap (find B)' },
      { id: 'toroid', label: 'Toroid with a saw-cut slot, infinite μ' }],
    tags: ['exam-style', 'Q2', 'Jun23 Q2a', 'Jun24 Q2a', '2024 test Q4', 'mock Q2a'],
    gen: function (r, v) {
      var data = { v: v };
      if (v === 'toroid') {
        var dcm = r.pick([1.5, 2, 2.5, 3, 4]), Nt = r.nice(50, 400, 10), g = r.pick([0.3, 0.4, 0.5, 0.6, 0.8, 1]), Bt = r.pick([1, 1.2, 1.4, 1.5]), f = r.pick([50, 60]);
        var At = PI * Math.pow(dcm / 200, 2), Rg = g * 1e-3 / (MU0 * At), Lt = Nt * Nt / Rg, It = Bt * g * 1e-3 / (MU0 * Nt), Vm = 4.44 * Nt * f * Bt * At;
        Object.assign(data, { d: dcm, N: Nt, g: g, B: Bt, f: f });
        return Q('A toroidal core has a circular cross-section of diameter ' + dcm + ' cm and a winding of ' + Nt + ' turns. The core can be assumed to have infinite permeability. A fine saw cuts a slot to make an air gap of ' + g + ' mm in one side of the core.',
          figCore({ type: 'toroid', N: 'N = ' + Nt, gap: 'l_G = ' + g + ' mm', A: 'd = ' + dcm + ' cm (circular section)' }),
          [['$d$', dcm + ' cm'], ['$N$', String(Nt)], ['$l_G$', g + ' mm'], ['$\\mu_R$', '∞']],
          [P('(i) Find the reluctance of the gap and the inductance of the winding.', [ans('$\\mathcal{R}_G$', Rg, 'At/Wb'), ans('$L$', Lt, 'H')],
            [m('A = \\pi(d/2)^2 = \\pi(' + N(dcm / 200) + ')^2 = ' + N(At) + '\\ \\text{m}^2'), 'Infinite permeability means $\\mathcal{R}_C = 0$; one slot is one gap.', relG('\\mathcal{R}_G', g * 1e-3, At, Rg), m('L = \\dfrac{N^2}{\\mathcal{R}_G} = \\dfrac{' + Nt + '^2}{' + N(Rg) + '} = ' + E(Lt, 'H'))], 'L = ' + E(Lt, 'H')),
            P('(ii) Find the DC current that gives ' + Bt + ' T in the gap.', [ans('$I$', It, 'A')], [m('NI = H_Gl_G = \\dfrac{B}{\\mu_0}l_G \\Rightarrow I = \\dfrac{Bl_G}{\\mu_0N} = \\dfrac{' + Bt + '\\times' + N(g * 1e-3) + '}{4\\pi\\times10^{-7}\\times' + Nt + '}')], 'I = ' + E(It, 'A')),
            P('(iii) If the peak flux density must not exceed ' + Bt + ' T, find the maximum ' + f + ' Hz voltage that can be applied.', [ans('$V_{max}$', Vm, 'V')], ['Use the back-emf equation; it needs no reluctance.', m('V_{max} = 4.44Nf\\hat BA = 4.44\\times' + Nt + '\\times' + f + '\\times' + Bt + '\\times' + N(At) + ' = ' + E(Vm, 'V'))], 'V_{max} = ' + E(Vm, 'V') + '\\ \\text{rms}')],
          tip('The mean diameter is not needed: with infinite permeability only the gap matters.'), data);
      }
      var Acm = r.pick([4, 5, 6, 8, 10, 12, 15, 20, 25]), A = Acm * 1e-4, lc = r.nice(20, 80, 5) / 100, mu = r.nice(1000, 5000, 500), Nn = r.nice(20, 400, 10);
      var gmm = r.pick([0.2, 0.25, 0.3, 0.4, 0.5, 0.8, 1, 1.2, 1.5, 2]), twoGaps = v === 'two-gap-I';
      Object.assign(data, { A: Acm, lc: lc, mu: mu, N: Nn, g: gmm });
      if (v === 'paper') {
        var Np = r.nice(5, 40, 1), Ip = r.float(0.5, 5, 1), tp = r.pick([0.05, 0.07, 0.08, 0.1, 0.12]);
        var B0 = mu * MU0 * Np * Ip / lc, Rc = lc / (mu * MU0 * A), RgP = 2 * tp * 1e-3 / (MU0 * A), B1 = Np * Ip / ((Rc + RgP) * A);
        if (B0 > 1.6 || B0 < 0.15) return null;
        Object.assign(data, { N: Np, I: Ip, t: tp });
        return Q('Two identical C-cores are clamped together to form a closed magnetic circuit. The cross-section is ' + Acm + ' cm², the relative permeability is ' + mu + ' and the total mean iron path (both cores) is ' + N(lc * 100) + ' cm. A ' + Np + '-turn coil carrying ' + Ip + ' A is wound on one core.',
          figCore({ type: 'paper', N: 'N = ' + Np, gap: 't = ' + tp + ' mm', A: 'A = ' + Acm + ' cm²', l: 'l_C = ' + N(lc * 100) + ' cm', mu: '\\mu_R = ' + mu }),
          [['$A$', cm2(Acm)], ['$\\mu_R$', String(mu)], ['$l_C$', N(lc * 100) + ' cm'], ['$N$, $I$', Np + ', ' + Ip + ' A'], ['paper', tp + ' mm']],
          [P('(a) Assuming the gap between the cores is zero, find the flux density.', [ans('$B$', B0, 'T')], [m('NI = H_Cl_C = \\dfrac{B}{\\mu_R\\mu_0}l_C \\Rightarrow B = \\dfrac{\\mu_R\\mu_0NI}{l_C} = \\dfrac{' + mu + '\\times4\\pi\\times10^{-7}\\times' + N(Np * Ip) + '}{' + N(lc) + '} = ' + E(B0, 'T'))], 'B = ' + E(B0, 'T')),
            P('(b) A sheet of paper ' + tp + ' mm thick ($\\mu_R = 1$) is placed between the cores. Find the new flux density.', [ans('$\\mathcal{R}_G$', RgP, 'At/Wb'), ans("$B'$", B1, 'T')],
              ['The flux crosses the paper twice per loop (two joints): ' + m('l_G = 2\\times' + tp + ' = ' + N(2 * tp) + '\\ \\text{mm}'), relT('\\mathcal{R}_C', lc, mu, A, Rc), relG('\\mathcal{R}_G', 2 * tp * 1e-3, A, RgP), m("B' = \\dfrac{NI}{(\\mathcal{R}_C + \\mathcal{R}_G)A} = \\dfrac{" + N(Np * Ip) + '}{' + N(Rc + RgP) + '\\times' + N(A) + '} = ' + E(B1, 'T'))], "B' = " + E(B1, 'T'))],
          trap('Two cores face to face means two joints, so the paper counts twice.'), data);
      }
      var Rc2 = lc / (mu * MU0 * A), lg = (twoGaps ? 2 : 1) * gmm * 1e-3, Rg2 = lg / (MU0 * A), Rt = Rc2 + Rg2, L = Nn * Nn / Rt;
      var fig = figCore({ type: twoGaps ? 'C2' : 'C1', N: 'N = ' + Nn, gap: (twoGaps ? 'g = ' : 'l_G = ') + gmm + ' mm', A: 'A = ' + Acm + ' cm²', l: 'l_C = ' + N(lc * 100) + ' cm', mu: '\\mu_R = ' + mu });
      var a = P('(a) Find the reluctances of the ' + (twoGaps ? 'gaps (total)' : 'gap') + ' and the core, and the inductance of the coil.', [ans('$\\mathcal{R}_G$', Rg2, 'At/Wb'), ans('$\\mathcal{R}_C$', Rc2, 'At/Wb'), ans('$L$', L, 'H')],
        [m('A = ' + Acm + '\\ \\text{cm}^2 = ' + N(A) + '\\ \\text{m}^2') + (twoGaps ? '. Two C-cores face to face give <b>two</b> gaps: ' + m('l_G = 2\\times' + gmm + ' = ' + N(2 * gmm) + '\\ \\text{mm}') : ''), relG('\\mathcal{R}_G', lg, A, Rg2), relT('\\mathcal{R}_C', lc, mu, A, Rc2), 'In series: ' + m('\\mathcal{R}_T = ' + E(Rt, 'At/Wb')), m('L = \\dfrac{N^2}{\\mathcal{R}_T} = \\dfrac{' + Nn + '^2}{' + N(Rt) + '} = ' + E(L, 'H'))], 'L = ' + E(L, 'H'));
      var stem = (twoGaps ? 'Two identical iron C-cores are placed face to face with an air gap of ' + gmm + ' mm at each joint.' : 'An iron C-core has a single air gap of ' + gmm + ' mm.') + ' The cross-sectional area is ' + Acm + ' cm², the total mean iron path is ' + N(lc * 100) + ' cm and ' + m('\\mu_R = ' + mu) + '. A coil of ' + Nn + ' turns is wound on the core. Neglect fringing.';
      var given = [['$A$', cm2(Acm)], ['$l_C$', N(lc * 100) + ' cm'], ['$\\mu_R$', String(mu)], ['$N$', String(Nn)], [twoGaps ? 'gap (each)' : '$l_G$', gmm + ' mm']];
      if (v === 'one-gap-B') {
        var Ib = r.float(0.5, 8, 1), Phi = Nn * Ib / Rt, Bb = Phi / A;
        if (Bb > 1.7 || Bb < 0.2) return null;
        data.I = Ib;
        return Q(stem + ' The coil carries a DC current of ' + Ib + ' A.', fig, given.concat([['$I$', Ib + ' A']]),
          [a, P('(b) Find the flux and the flux density in the gap, and the fraction of the mmf dropped across the gap.', [ans('$\\Phi$', Phi, 'Wb'), ans('$B$', Bb, 'T'), pctA('gap share', 100 * Rg2 / Rt)],
            [m('\\Phi = \\dfrac{NI}{\\mathcal{R}_T} = \\dfrac{' + Nn + '\\times' + Ib + '}{' + N(Rt) + '} = ' + E(Phi, 'Wb')), m('B = \\Phi/A = ' + E(Bb, 'T')) + (Bb > 1.6 ? ' (close to saturation: the linear model is optimistic)' : ''), 'The mmf divides like voltage across series resistors: ' + m('\\mathcal{R}_G/\\mathcal{R}_T = ' + N(100 * Rg2 / Rt) + '\\%')], 'B = ' + E(Bb, 'T'))],
          tip('Even a small gap usually carries most of the mmf.'), data);
      }
      var B = r.pick([0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5]), Phi2 = B * A, NI = Phi2 * Rt, I = NI / Nn;
      data.B = B;
      return Q(stem + ' The flux density in the core is to be ' + B + ' T.', fig, given.concat([['$B$', B + ' T']]),
        [a, P('(b) Find the coil current, and the mmf across the gap' + (twoGaps ? 's' : '') + ' and across the iron.', [ans('$I$', I, 'A'), ans('$\\mathcal{F}_G$', Phi2 * Rg2, 'At'), ans('$\\mathcal{F}_C$', Phi2 * Rc2, 'At')],
          [m('\\Phi = BA = ' + B + '\\times' + N(A) + ' = ' + E(Phi2, 'Wb')), m('NI = \\Phi\\mathcal{R}_T = ' + N(Phi2) + '\\times' + N(Rt) + ' = ' + N(NI) + '\\ \\text{At}'), m('I = NI/N = ' + N(NI) + '/' + Nn + ' = ' + E(I, 'A')), m('\\mathcal{F}_G = \\Phi\\mathcal{R}_G = ' + N(Phi2 * Rg2) + '\\ \\text{At},\\ \\mathcal{F}_C = \\Phi\\mathcal{R}_C = ' + N(Phi2 * Rc2) + '\\ \\text{At}')], 'I = ' + E(I, 'A'))],
        trap('Units: 1 cm² = 10⁻⁴ m², 1 mm = 10⁻³ m. ' + (twoGaps ? 'Two C-cores give two gaps.' : 'A single gap is counted once.')), data);
    }
  });

  ADD({
    id: 'mach.mag.magcct.shell', course: 'mach', module: 'mag', topic: 'magcct',
    title: 'Shell (E) core with parallel flux paths', difficulty: 3, marks: 7,
    variants: [{ id: 'sym-I', label: 'Symmetric, gap in centre limb: find I' }, { id: 'sym-Phi', label: 'Symmetric: current given, find Φ and B' }, { id: 'asym', label: 'Unequal outer limbs (gap in one): flux split' }],
    tags: ['M3 N2', 'two-path cores'],
    gen: function (r, v) {
      var Nn = r.nice(50, 500, 10), lcen = r.nice(6, 20, 1) / 100, Ac = r.pick([6, 8, 10, 12, 16, 20]) * 1e-4, Ao = Ac / 2, lo = r.nice(20, 50, 2) / 100, mu = r.nice(1000, 4000, 500);
      var data = { v: v, N: Nn, lc: lcen, Ac: Ac * 1e4, lo: lo, mu: mu };
      var Rcen = lcen / (mu * MU0 * Ac), Ro = lo / (mu * MU0 * Ao);
      if (v === 'asym') {
        var g = r.pick([0.2, 0.3, 0.5, 0.8, 1]), Rgr = g * 1e-3 / (MU0 * Ao), RL = Ro, RR = Ro + Rgr, Rp = RL * RR / (RL + RR), Rt = Rcen + Rp, Bc = r.pick([0.8, 1, 1.2, 1.4]);
        var Phi = Bc * Ac, NI = Phi * Rt, PhiL = Phi * RR / (RL + RR), PhiR = Phi * RL / (RL + RR);
        if (PhiL / Ao > 1.9) return null;
        Object.assign(data, { g: g, B: Bc });
        return Q('A shell-type core has a ' + Nn + '-turn coil on its centre limb (length ' + N(lcen * 100) + ' cm, area ' + N(Ac * 1e4) + ' cm², no gap). The flux returns through two outer paths, each of length ' + N(lo * 100) + ' cm and area ' + N(Ao * 1e4) + ' cm². The <b>right</b> outer path has an air gap of ' + g + ' mm; the left one has none. All the iron has ' + m('\\mu_R = ' + mu) + '. Neglect fringing.',
          figShell({ N: 'N = ' + Nn, gapR: 'l_G = ' + g + ' mm', notes: ['centre: ' + N(lcen * 100) + ' cm, ' + N(Ac * 1e4) + ' cm²;  outer: ' + N(lo * 100) + ' cm, ' + N(Ao * 1e4) + ' cm² each'] }),
          [['$N$', String(Nn)], ['centre $l$, $A$', N(lcen * 100) + ' cm, ' + N(Ac * 1e4) + ' cm²'], ['outer $l$, $A$', N(lo * 100) + ' cm, ' + N(Ao * 1e4) + ' cm²'], ['gap (right)', g + ' mm'], ['$\\mu_R$', String(mu)]],
          [P('(a) Find the reluctance of each path and the total reluctance seen by the coil.', [ans('$\\mathcal{R}_{centre}$', Rcen, 'At/Wb'), ans('$\\mathcal{R}_{left}$', RL, 'At/Wb'), ans('$\\mathcal{R}_{right}$', RR, 'At/Wb'), ans('$\\mathcal{R}_T$', Rt, 'At/Wb')],
            [relT('\\mathcal{R}_{centre}', lcen, mu, Ac, Rcen), relT('\\mathcal{R}_{left}', lo, mu, Ao, RL), m('\\mathcal{R}_{right} = \\mathcal{R}_{left} + \\dfrac{l_G}{\\mu_0A_o} = ' + N(RL) + ' + ' + N(Rgr) + ' = ' + E(RR, 'At/Wb')), 'The two outer paths are in parallel, then in series with the centre limb:', m('\\mathcal{R}_T = \\mathcal{R}_{centre} + \\dfrac{\\mathcal{R}_L\\mathcal{R}_R}{\\mathcal{R}_L + \\mathcal{R}_R} = ' + N(Rcen) + ' + ' + N(Rp) + ' = ' + E(Rt, 'At/Wb'))], '\\mathcal{R}_T = ' + E(Rt, 'At/Wb')),
            P('(b) Find the coil current for ' + Bc + ' T in the centre limb, and how the flux splits between the outer limbs.', [ans('$I$', NI / Nn, 'A'), ans('$\\Phi_L$', PhiL, 'Wb'), ans('$\\Phi_R$', PhiR, 'Wb')],
              [m('\\Phi = B A_c = ' + Bc + '\\times' + N(Ac) + ' = ' + E(Phi, 'Wb')), m('I = \\Phi\\mathcal{R}_T/N = ' + E(NI / Nn, 'A')), 'Flux divides like current, inversely with reluctance:', m('\\Phi_L = \\Phi\\dfrac{\\mathcal{R}_R}{\\mathcal{R}_L+\\mathcal{R}_R} = ' + E(PhiL, 'Wb') + ',\\quad \\Phi_R = \\Phi\\dfrac{\\mathcal{R}_L}{\\mathcal{R}_L+\\mathcal{R}_R} = ' + E(PhiR, 'Wb')), m('B_L = ' + E(PhiL / Ao, 'T') + ',\\ B_R = ' + E(PhiR / Ao, 'T')) + (PhiL / Ao > 1.6 ? ' — the left limb is near saturation.' : '')], '\\Phi_L = ' + E(PhiL, 'Wb') + ',\\ \\Phi_R = ' + E(PhiR, 'Wb'))],
          tip('The gapped path takes less flux; the ungapped limb carries most of it.'), data);
      }
      var gc = r.pick([0.5, 0.8, 1, 1.5, 2]), Rg = gc * 1e-3 / (MU0 * Ac), Rt2 = Rcen + Rg + Ro / 2, L = Nn * Nn / Rt2;
      data.g = gc;
      var fig = figShell({ N: 'N = ' + Nn, gapC: 'l_G = ' + gc + ' mm', notes: ['centre: ' + N(lcen * 100) + ' cm, ' + N(Ac * 1e4) + ' cm²;  outer: ' + N(lo * 100) + ' cm, ' + N(Ao * 1e4) + ' cm² each'] });
      var a = P('(a) Draw the magnetic equivalent circuit and find the total reluctance and the inductance.', [ans('$\\mathcal{R}_T$', Rt2, 'At/Wb'), ans('$L$', L, 'H')],
        ['Source $NI$ in series with $\\mathcal{R}_{centre}$ and $\\mathcal{R}_G$, then the two outer reluctances in parallel.', relT('\\mathcal{R}_{centre}', lcen, mu, Ac, Rcen), relG('\\mathcal{R}_G', gc * 1e-3, Ac, Rg), relT('\\mathcal{R}_{outer}', lo, mu, Ao, Ro), m('\\mathcal{R}_{\\parallel} = \\mathcal{R}_{outer}/2 = ' + E(Ro / 2, 'At/Wb')), m('\\mathcal{R}_T = ' + N(Rcen) + ' + ' + N(Rg) + ' + ' + N(Ro / 2) + ' = ' + E(Rt2, 'At/Wb')), m('L = N^2/\\mathcal{R}_T = ' + E(L, 'H'))], 'L = ' + E(L, 'H'));
      var stem = 'A shell-type core has a ' + Nn + '-turn coil on its centre limb. The centre limb has length ' + N(lcen * 100) + ' cm and area ' + N(Ac * 1e4) + ' cm², and contains a ' + gc + ' mm air gap. The flux returns through two identical outer paths, each ' + N(lo * 100) + ' cm long with area ' + N(Ao * 1e4) + ' cm². All the iron has ' + m('\\mu_R = ' + mu) + '. Neglect fringing.';
      var given = [['$N$', String(Nn)], ['centre $l$, $A$', N(lcen * 100) + ' cm, ' + N(Ac * 1e4) + ' cm²'], ['outer $l$, $A$', N(lo * 100) + ' cm, ' + N(Ao * 1e4) + ' cm²'], ['$l_G$', gc + ' mm'], ['$\\mu_R$', String(mu)]];
      if (v === 'sym-Phi') {
        var I = r.float(0.5, 6, 1), Phi2 = Nn * I / Rt2;
        if (Phi2 / Ac > 1.7 || Phi2 / Ac < 0.2) return null;
        data.I = I;
        return Q(stem + ' The coil carries ' + I + ' A DC.', fig, given.concat([['$I$', I + ' A']]),
          [a, P('(b) Find the flux in the centre limb, the flux density in the gap, and the flux density in each outer limb.', [ans('$\\Phi$', Phi2, 'Wb'), ans('$B_G$', Phi2 / Ac, 'T'), ans('$B_{outer}$', Phi2 / 2 / Ao, 'T')],
            [m('\\Phi = NI/\\mathcal{R}_T = ' + Nn + '\\times' + I + '/' + N(Rt2) + ' = ' + E(Phi2, 'Wb')), m('B_G = \\Phi/A_c = ' + E(Phi2 / Ac, 'T')), 'The flux splits equally: ' + m('\\Phi/2 = ' + E(Phi2 / 2, 'Wb') + ',\\ B_{outer} = ' + E(Phi2 / 2 / Ao, 'T'))], 'B_G = ' + E(Phi2 / Ac, 'T'))], '', data);
      }
      var Bg = r.pick([0.8, 1, 1.2, 1.4]), Phi3 = Bg * Ac, I3 = Phi3 * Rt2 / Nn;
      data.B = Bg;
      return Q(stem + ' The flux density in the gap is to be ' + Bg + ' T.', fig, given.concat([['$B_G$', Bg + ' T']]),
        [a, P('(b) Find the coil current and the flux density in each outer limb.', [ans('$I$', I3, 'A'), ans('$B_{outer}$', Phi3 / 2 / Ao, 'T')],
          [m('\\Phi = B_GA_c = ' + E(Phi3, 'Wb')), m('NI = \\Phi\\mathcal{R}_T = ' + N(Phi3 * Rt2) + '\\ \\text{At} \\Rightarrow I = ' + E(I3, 'A')), m('B_{outer} = \\dfrac{\\Phi/2}{A_o} = ' + E(Phi3 / 2 / Ao, 'T')) + ' — the same as the centre, which is why the outer limbs have half the area.'], 'I = ' + E(I3, 'A'))], '', data);
    }
  });

  ADD({
    id: 'mach.mag.magcct.back-emf', course: 'mach', module: 'mag', topic: 'magcct',
    title: 'Back-emf equation: turns, peak flux density and maximum voltage', difficulty: 2, marks: 6,
    variants: [{ id: 'turns', label: 'Design primary and secondary turns' }, { id: 'vmax', label: 'Maximum voltage for N, A, B̂' }, { id: 'reactor', label: 'Toroid winding: turns, then L, X and I' }, { id: 'new-supply', label: 'Same winding on a new frequency' }],
    tags: ['exam-style', 'Q2', '2024 test Q5', '2023 quiz Q3', 'PQ 3.25'],
    gen: function (r, v) {
      var f = r.pick([50, 60]), Bm = r.pick([1.2, 1.3, 1.4, 1.5, 1.6, 1.65]), Acm = r.pick([10, 12, 15, 20, 25, 30, 40, 50]), A = Acm * 1e-4, data = { v: v, f: f, B: Bm, A: Acm };
      if (v === 'turns') {
        var V1 = r.pick([110, 120, 230, 240, 415, 480]), V2 = r.pick([12, 24, 32, 48, 55, 110]);
        if (V2 >= V1) return null;
        var Nraw = V1 / (4.44 * f * Bm * A), N1 = Math.ceil(Nraw - 1e-9), Ba = V1 / (4.44 * N1 * f * A), N2raw = N1 * V2 / V1, N2 = Math.round(N2raw);
        if (Math.abs(Nraw - Math.round(Nraw)) < 0.03 || Math.abs(N2raw - Math.round(N2raw) - 0.5) < 0.05) return null;
        Object.assign(data, { V1: V1, V2: V2 });
        return Q('A single-phase ' + V1 + ' V/' + V2 + ' V, ' + f + ' Hz transformer uses a core of cross-sectional area ' + Acm + ' cm². The peak flux density must not exceed ' + Bm + ' T.', null,
          [['$V_1/V_2$', V1 + ' V / ' + V2 + ' V'], ['$f$', f + ' Hz'], ['$A$', cm2(Acm)], ['$\\hat B_{max}$', Bm + ' T']],
          [P('(a) Use the back-emf equation to find the number of primary turns.', [ans('$N_1$', N1, '', { tol: 0, abs: 0.5, alt: [Math.floor(Nraw)] })], [m('N_1 = \\dfrac{V_1}{4.44f\\hat B_{max}A} = \\dfrac{' + V1 + '}{4.44\\times' + f + '\\times' + Bm + '\\times' + N(A) + '} = ' + N(Nraw)), 'Round <b>up</b> so that $\\hat B$ stays below the limit: ' + m('N_1 = ' + N1)], 'N_1 = ' + N1),
            P('(b) Find the actual peak flux density.', [ans('$\\hat B$', Ba, 'T')], [m('\\hat B = \\dfrac{V_1}{4.44N_1fA} = \\dfrac{' + V1 + '}{4.44\\times' + N1 + '\\times' + f + '\\times' + N(A) + '} = ' + E(Ba, 'T'))], '\\hat B = ' + E(Ba, 'T')),
            P('(c) Choose the number of secondary turns.', [ans('$N_2$', N2, '', { tol: 0, abs: 0.5 })], [m('N_2 = N_1V_2/V_1 = ' + N1 + '\\times' + V2 + '/' + V1 + ' = ' + N(N2raw)) + ', nearest integer'], 'N_2 = ' + N2)],
          tip('Too few turns: the core saturates and the magnetising current becomes large and distorted. Too many: the core is under-used and the copper loss rises.'), data);
      }
      if (v === 'vmax' || v === 'new-supply') {
        var Nt = r.nice(40, 600, 5), Vm = 4.44 * Nt * f * Bm * A, f2 = f === 50 ? r.pick([25, 40, 60, 100]) : r.pick([30, 50, 120]);
        Object.assign(data, { N: Nt, f2: f2 });
        if (v === 'vmax') {
          return Q('A winding of ' + Nt + ' turns is placed on a core of cross-section ' + Acm + ' cm². The peak flux density must not exceed ' + Bm + ' T.', figCore({ type: 'C0', N: 'N = ' + Nt, A: 'A = ' + Acm + ' cm²' }),
            [['$N$', String(Nt)], ['$A$', cm2(Acm)], ['$\\hat B_{max}$', Bm + ' T'], ['$f$', f + ' Hz']],
            [P('(a) Find the maximum rms voltage that can be applied at ' + f + ' Hz.', [ans('$V_{max}$', Vm, 'V')], [m('V_{max} = 4.44Nf\\hat B_{max}A = 4.44\\times' + Nt + '\\times' + f + '\\times' + Bm + '\\times' + N(A) + ' = ' + E(Vm, 'V'))], 'V_{max} = ' + E(Vm, 'V')),
              P('(b) Find the maximum voltage if the frequency is ' + f2 + ' Hz.', [ans("$V_{max}'$", Vm * f2 / f, 'V')], ['Same $N$ and $\\hat B$, so $V_{max}\\propto f$: ' + m("V_{max}' = " + N(Vm) + '\\times' + f2 + '/' + f + ' = ' + E(Vm * f2 / f, 'V'))], "V_{max}' = " + E(Vm * f2 / f, 'V'))],
            trap('$E$ is rms and $\\hat B$ is peak. The equation contains no reluctance: gaps change the current, not the voltage.'), data);
        }
        var Vr = sg(Vm * r.float(0.85, 0.99, 2), 3), Bop = Vr / (4.44 * Nt * f * A), B2 = Bop * f / f2;
        data.V = Vr;
        return Q('A ' + Nt + '-turn winding on a core of ' + Acm + ' cm² is rated ' + Vr + ' V at ' + f + ' Hz. The core saturates above about ' + Bm + ' T.', null,
          [['$N$', String(Nt)], ['$A$', cm2(Acm)], ['rated', Vr + ' V, ' + f + ' Hz'], ['$\\hat B_{sat}$', Bm + ' T']],
          [P('(a) Find the peak flux density at rated voltage.', [ans('$\\hat B$', Bop, 'T')], [m('\\hat B = \\dfrac{V}{4.44NfA} = \\dfrac{' + Vr + '}{4.44\\times' + Nt + '\\times' + f + '\\times' + N(A) + '} = ' + E(Bop, 'T'))], '\\hat B = ' + E(Bop, 'T')),
            P('(b) The same ' + Vr + ' V is applied at ' + f2 + ' Hz. Find the new peak flux density, and the highest voltage that keeps ' + m('\\hat B \\le ' + Bm + '\\ \\text{T}') + ' at ' + f2 + ' Hz.', [ans("$\\hat B'$", B2, 'T'), ans("$V_{max}'$", 4.44 * Nt * f2 * Bm * A, 'V')],
              [m("\\hat B \\propto V/f \\Rightarrow \\hat B' = " + N(Bop) + '\\times' + f + '/' + f2 + ' = ' + E(B2, 'T')) + (B2 > Bm ? ' — above saturation: the magnetising current would become large and peaky.' : ' — below saturation, so this is safe.'), m("V_{max}' = 4.44Nf'\\hat B_{max}A = " + E(4.44 * Nt * f2 * Bm * A, 'V'))], "\\hat B' = " + E(B2, 'T'))],
          tip('Constant V/f keeps the flux constant.'), data);
      }
      var D = r.nice(50, 150, 10), Vt = r.pick([110, 230, 240]), mu = r.nice(500, 3000, 250), Nr = r.nice(100, 400, 10), Va = r.nice(20, 150, 10), lpath = PI * D / 1000;
      var Nraw2 = Vt / (4.44 * f * Bm * A), Rr = lpath / (mu * MU0 * A), Lr = Nr * Nr / Rr, Xr = omega(f) * Lr;
      if (Math.abs(Nraw2 - Math.round(Nraw2)) < 0.03) return null;
      Object.assign(data, { D: D, V: Vt, mu: mu, N2: Nr, Va: Va });
      return Q('A winding is placed on a toroidal iron core of mean diameter ' + D + ' mm, cross-section ' + Acm + ' cm² and ' + m('\\mu_R = ' + mu) + '. The desired peak flux density is ' + Bm + ' T.', figCore({ type: 'toroid', N: 'N', A: 'D = ' + D + ' mm, A = ' + Acm + ' cm²', extra: '\\mu_R = ' + mu }),
        [['$D$', D + ' mm'], ['$A$', cm2(Acm)], ['$\\mu_R$', String(mu)], ['$\\hat B$', Bm + ' T']],
        [P('(a) For a rated voltage of ' + Vt + ' V at ' + f + ' Hz, find the number of turns.', [ans('$N$', Math.ceil(Nraw2), '', { tol: 0, abs: 0.5, alt: [Math.floor(Nraw2)] })], [m('N = \\dfrac{V}{4.44f\\hat BA} = \\dfrac{' + Vt + '}{4.44\\times' + f + '\\times' + Bm + '\\times' + N(A) + '} = ' + N(Nraw2)) + '; round up to ' + Math.ceil(Nraw2) + ' (rounding down is also accepted).'], 'N = ' + Math.ceil(Nraw2)),
          P('(b) For a different rating the winding has ' + Nr + ' turns. Find its inductance and reactance at ' + f + ' Hz.', [ans('$\\mathcal{R}$', Rr, 'At/Wb'), ans('$L$', Lr, 'H'), ans('$X$', Xr, 'Ω')],
            [m('l = \\pi D = \\pi\\times' + N(D / 1000) + ' = ' + N(lpath) + '\\ \\text{m}'), relT('\\mathcal{R}', lpath, mu, A, Rr), m('L = N^2/\\mathcal{R} = ' + Nr + '^2/' + N(Rr) + ' = ' + E(Lr, 'H')), m('X = 2\\pi fL = ' + ohmT(Xr))], 'X = ' + ohmT(Xr)),
          P('(c) Find the current when ' + Va + ' V is applied to the ' + Nr + '-turn winding.', [ans('$I$', Va / Xr, 'A')], [m('I = V/X = ' + Va + '/' + N(Xr) + ' = ' + E(Va / Xr, 'A'))], 'I = ' + E(Va / Xr, 'A'))],
        trap('Toroid path length is $\\pi D_{mean}$, not $\\pi r$.'), data);
    }
  });

  ADD({
    id: 'mach.mag.magcct.gapped-inductor', course: 'mach', module: 'mag', topic: 'magcct',
    title: 'Gapped inductor design (infinite-μ core)', difficulty: 2, marks: 6,
    variants: [{ id: 'find-gap', label: 'Find the gap for L, then I_max' }, { id: 'find-N', label: 'Gap given: find N for L' }, { id: 'design', label: 'Design from L, Î and B̂: N, gap, energy' }],
    tags: ['PQ 3.10', 'M3 N5'],
    gen: function (r, v) {
      var Acm = r.pick([2, 3, 4, 5, 6, 8, 10]), A = Acm * 1e-4, L = r.pick([0.5, 1, 2, 2.5, 5, 10, 20]) * 1e-3, Bs = r.pick([0.3, 0.35, 0.4, 1, 1.2, 1.4]), data = { v: v, A: Acm, L: L, B: Bs };
      var mat = Bs < 0.5 ? 'ferrite' : 'laminated iron';
      if (v === 'find-gap') {
        var Nn = r.nice(20, 200, 5), lg = MU0 * Nn * Nn * A / L, Im = Nn * Bs * A / L;
        if (lg < 0.1e-3 || lg > 10e-3) return null;
        data.N = Nn;
        return Q('A ' + mat + ' core (treat as infinite permeability, saturating at ' + Bs + ' T) has a cross-section of ' + Acm + ' cm² and a single air gap. A winding of ' + Nn + ' turns is to give an inductance of ' + F.eng(L, 'H') + '.', figCore({ type: 'C1', N: 'N = ' + Nn, gap: 'l_G = ?', A: 'A = ' + Acm + ' cm²' }),
          [['$A$', cm2(Acm)], ['$N$', String(Nn)], ['$L$', F.eng(L, 'H')], ['$B_{sat}$', Bs + ' T']],
          [P('(a) Find the gap length.', [ans('$l_G$', lg, 'm', { hint: 'in m' })], [m('L = \\dfrac{N^2}{\\mathcal{R}_G} = \\dfrac{\\mu_0N^2A}{l_G} \\Rightarrow l_G = \\dfrac{\\mu_0N^2A}{L} = \\dfrac{4\\pi\\times10^{-7}\\times' + Nn + '^2\\times' + N(A) + '}{' + N(L) + '} = ' + E(lg, 'm'))], 'l_G = ' + E(lg, 'm')),
            P('(b) Find the maximum current before the core saturates.', [ans('$I_{max}$', Im, 'A')], [m('\\Phi_{sat} = B_{sat}A = ' + E(Bs * A, 'Wb')), m('N\\Phi = LI \\Rightarrow I_{max} = \\dfrac{N\\Phi_{sat}}{L} = \\dfrac{' + Nn + '\\times' + N(Bs * A) + '}{' + N(L) + '} = ' + E(Im, 'A'))], 'I_{max} = ' + E(Im, 'A'))], '', data);
      }
      if (v === 'find-N') {
        var g = r.pick([0.5, 0.8, 1, 1.5, 2]), Rg = g * 1e-3 / (MU0 * A), Nraw = Math.sqrt(L * Rg), Nr = Math.round(Nraw), La = Nr * Nr / Rg;
        if (Nr < 5) return null;
        data.g = g;
        return Q('A ' + mat + ' core (infinite permeability) of cross-section ' + Acm + ' cm² has a ' + g + ' mm air gap. Find the winding needed for an inductance of ' + F.eng(L, 'H') + '.', figCore({ type: 'C1', N: 'N = ?', gap: 'l_G = ' + g + ' mm', A: 'A = ' + Acm + ' cm²' }),
          [['$A$', cm2(Acm)], ['$l_G$', g + ' mm'], ['$L$', F.eng(L, 'H')]],
          [P('(a) Find the gap reluctance and the number of turns (nearest integer).', [ans('$\\mathcal{R}_G$', Rg, 'At/Wb'), ans('$N$', Nr, '', { tol: 0, abs: 0.5 })], [relG('\\mathcal{R}_G', g * 1e-3, A, Rg), m('N = \\sqrt{L\\mathcal{R}_G} = \\sqrt{' + N(L) + '\\times' + N(Rg) + '} = ' + N(Nraw) + ' \\Rightarrow ' + Nr)], 'N = ' + Nr),
            P('(b) Find the actual inductance with that integer N, and the current at which B reaches ' + Bs + ' T.', [ans('$L$', La, 'H'), ans('$I_{sat}$', Bs * g * 1e-3 / (MU0 * Nr), 'A')], [m('L = N^2/\\mathcal{R}_G = ' + E(La, 'H')), m('I = \\dfrac{Bl_G}{\\mu_0N} = ' + E(Bs * g * 1e-3 / (MU0 * Nr), 'A'))], 'L = ' + E(La, 'H'))], '', data);
      }
      var Ipk = r.pick([2, 5, 8, 10, 15, 20]), Bm = Bs, Nraw2 = L * Ipk / (Bm * A), N2 = Math.ceil(Nraw2 - 1e-9), lg2 = MU0 * N2 * N2 * A / L, Ba = MU0 * N2 * Ipk / lg2, En = 0.5 * L * Ipk * Ipk, f = 50;
      if (Math.abs(Nraw2 - Math.round(Nraw2)) < 0.02 || N2 < 5 || lg2 > 10e-3) return null;
      data.I = Ipk;
      return Q('You need a ' + F.eng(L, 'H') + ' inductor that carries a peak current of ' + Ipk + ' A. The core cross-section is ' + Acm + ' cm² and its peak flux density must stay at or below ' + Bm + ' T. Assume infinite core permeability and a single air gap.', null,
        [['$L$', F.eng(L, 'H')], ['$\\hat I$', Ipk + ' A'], ['$A$', cm2(Acm)], ['$\\hat B_{max}$', Bm + ' T']],
        [P('(a) Using $\\lambda = N\\Phi = LI$, find the minimum number of turns.', [ans('$N$', N2, '', { tol: 0, abs: 0.5 })], [m('N\\hat BA = L\\hat I \\Rightarrow N = \\dfrac{L\\hat I}{\\hat BA} = \\dfrac{' + N(L) + '\\times' + Ipk + '}{' + Bm + '\\times' + N(A) + '} = ' + N(Nraw2)) + '; round up to ' + N2 + '.'], 'N = ' + N2),
          P('(b) Find the gap length, and the actual peak flux density.', [ans('$l_G$', lg2, 'm', { hint: 'in m' }), ans('$\\hat B$', Ba, 'T')], [m('l_G = \\dfrac{\\mu_0N^2A}{L} = ' + E(lg2, 'm')), m('\\hat B = \\dfrac{\\mu_0N\\hat I}{l_G} = ' + E(Ba, 'T'))], 'l_G = ' + E(lg2, 'm')),
          P('(c) Find the peak stored energy, and the rms voltage across the inductor on a 50 Hz supply at this peak current.', [ans('$W$', En, 'J'), ans('$V$', 4.44 * N2 * f * Ba * A, 'V')], [m('W = \\tfrac12L\\hat I^2 = ' + E(En, 'J')) + ' (all in the gap, since $\\mu_R\\to\\infty$)', m('V = 4.44Nf\\hat BA = ' + E(4.44 * N2 * f * Ba * A, 'V')) + '; check ' + m('\\omega LI_{rms} = ' + E(omega(f) * L * Ipk / Math.SQRT2, 'V'))], 'W = ' + E(En, 'J'))], '', data);
    }
  });

  /* ---------- mag.energy ---------- */
  ADD({
    id: 'mach.mag.energy.energy-force', course: 'mach', module: 'mag', topic: 'energy',
    title: 'Energy stored in air gaps and the force across them', difficulty: 2, marks: 6,
    variants: [{ id: 'one-gap', label: 'One gap (slot or two facing poles)' }, { id: 'two-gaps', label: 'Two gaps (U-core + armature, two C-cores)' }, { id: 'iron-and-gap', label: 'Energy split between iron and gap' }],
    tags: ['exam-style', 'Q2', 'Jun23 Q2a(ii)', 'Jun24 Q2a(iii)', 'mock Q2a'],
    gen: function (r, v) {
      var Acm = r.pick([4, 5, 6, 8, 10, 12, 20]), A = Acm * 1e-4, g = r.pick([0.4, 0.5, 1, 1.5, 2, 3, 4]), B = r.pick([0.6, 0.8, 1, 1.1, 1.2, 1.4, 1.5, 1.8]), data = { v: v, A: Acm, g: g, B: B };
      var wd = B * B / (2 * MU0);
      if (v === 'iron-and-gap') {
        var lc = r.nice(20, 80, 5) / 100, mu = r.nice(1000, 5000, 500), Nn = r.nice(20, 300, 10);
        var Wg = wd * A * g * 1e-3, Wi = wd / mu * A * lc, Rc = lc / (mu * MU0 * A), Rg = g * 1e-3 / (MU0 * A), L = Nn * Nn / (Rc + Rg), I = B * A * (Rc + Rg) / Nn;
        Object.assign(data, { lc: lc, mu: mu, N: Nn });
        return Q('An iron C-core (' + m('\\mu_R = ' + mu) + ', mean iron path ' + N(lc * 100) + ' cm, cross-section ' + Acm + ' cm²) has one air gap of ' + g + ' mm and a ' + Nn + '-turn coil. It operates at ' + B + ' T.', figCore({ type: 'C1', N: 'N = ' + Nn, gap: 'l_G = ' + g + ' mm', A: 'A = ' + Acm + ' cm²', l: 'l_C = ' + N(lc * 100) + ' cm', mu: '\\mu_R = ' + mu }),
          [['$A$', cm2(Acm)], ['$l_C$', N(lc * 100) + ' cm'], ['$\\mu_R$', String(mu)], ['$l_G$', g + ' mm'], ['$N$', String(Nn)], ['$B$', B + ' T']],
          [P('(a) Find the energy stored in the gap and in the iron.', [ans('$W_G$', Wg, 'J'), ans('$W_C$', Wi, 'J')], [m('W_G = \\dfrac{B^2}{2\\mu_0}Al_G = \\dfrac{' + B + '^2}{2\\times4\\pi\\times10^{-7}}\\times' + N(A) + '\\times' + N(g * 1e-3) + ' = ' + E(Wg, 'J')), m('W_C = \\dfrac{B^2}{2\\mu_R\\mu_0}Al_C = ' + E(Wi, 'J'))], 'W_G = ' + E(Wg, 'J')),
            P('(b) Find L and the coil current, and confirm that ½LI² equals the total energy.', [ans('$L$', L, 'H'), ans('$I$', I, 'A'), ans('$W$', Wg + Wi, 'J')], [m('\\mathcal{R}_C = ' + E(Rc, 'At/Wb') + ',\\ \\mathcal{R}_G = ' + E(Rg, 'At/Wb')), m('L = N^2/(\\mathcal{R}_C+\\mathcal{R}_G) = ' + E(L, 'H')), m('I = BA(\\mathcal{R}_C+\\mathcal{R}_G)/N = ' + E(I, 'A')), m('\\tfrac12LI^2 = ' + E(0.5 * L * I * I, 'J') + ' = W_G + W_C'), 'The energies split in the ratio of the reluctances: ' + m('W_G/W_C = \\mathcal{R}_G/\\mathcal{R}_C = ' + N(Rg / Rc))], 'W = ' + E(Wg + Wi, 'J'))],
          tip('B is the same in iron and gap, but the iron stores $1/\\mu_R$ as much energy per m³.'), data);
      }
      var two = v === 'two-gaps', ctx = two ? r.pick(['U', 'CC']) : r.pick(['slot', 'poles']);
      var Wg2 = wd * A * g * 1e-3 * (two ? 2 : 1), F1 = wd * A, Ft = F1 * (two ? 2 : 1);
      data.ctx = ctx;
      var desc = { U: 'A U-shaped electromagnet attracts an iron armature across two air gaps, each ' + g + ' mm long. Each pole face has an area of ' + Acm + ' cm².', CC: 'Two U-shaped core halves face each other so that the flux crosses two gaps in series, each ' + g + ' mm. The cross-section is ' + Acm + ' cm² everywhere.', slot: 'A toroidal core with a saw-cut slot of ' + g + ' mm has a cross-section of ' + Acm + ' cm².', poles: 'An actuator has two iron poles with a single ' + g + ' mm air gap between them. Each pole face is ' + Acm + ' cm².' }[ctx];
      var fig = ctx === 'slot' ? figCore({ type: 'toroid', gap: 'l_G = ' + g + ' mm', N: 'N', A: 'A = ' + Acm + ' cm²' }) : figCore({ type: ctx === 'U' ? 'U2' : (ctx === 'CC' ? 'C2' : 'C1'), gap: (two ? 'g = ' : 'l_G = ') + g + ' mm', A: 'A = ' + Acm + ' cm²', N: 'N' });
      return Q(desc + ' The flux density in the gap' + (two ? 's' : '') + ' is ' + B + ' T. Neglect fringing.', fig,
        [['$A$', cm2(Acm)], [two ? 'gap (each)' : '$l_G$', g + ' mm'], ['$B$', B + ' T']],
        [P('(a) Find the energy stored in the air gap' + (two ? 's' : '') + '.', [ans('$W_G$', Wg2, 'J')], [m('w = \\dfrac{B^2}{2\\mu_0} = \\dfrac{' + B + '^2}{2\\times4\\pi\\times10^{-7}} = ' + N(wd) + '\\ \\text{J/m}^3'), m('W_G = w\\times A\\times l_G' + (two ? '\\times2' : '') + ' = ' + N(wd) + '\\times' + N(A) + '\\times' + N(g * 1e-3) + (two ? '\\times2' : '') + ' = ' + E(Wg2, 'J'))], 'W_G = ' + E(Wg2, 'J')),
          P('(b) Find the total force pulling the faces together.', [ans('$F$', Ft, 'N')], [m('F_1 = \\dfrac{B^2}{2\\mu_0}A = ' + N(wd) + '\\times' + N(A) + ' = ' + E(F1, 'N')) + ' per gap', two ? 'Two gaps pull, so ' + m('F = 2F_1 = ' + E(Ft, 'N')) : 'One gap, so the area is used once.'], 'F = ' + E(Ft, 'N')),
          P('(c) The coil current is halved (unsaturated core, gap unchanged). Find the new force.', [ans("$F'$", Ft / 4, 'N')], ['At constant gap $B\\propto I$, so $F\\propto I^2$: ' + m("F' = F/4 = " + E(Ft / 4, 'N'))], "F' = " + E(Ft / 4, 'N'))],
        trap(two ? 'Two gaps: use $2A$ for the force (or $F_1$ per gap × 2), not both.' : 'A single slot or a single pole pair is one gap: use $A$ once.'), data);
    }
  });

  ADD({
    id: 'mach.mag.energy.lifter', course: 'mach', module: 'mag', topic: 'energy',
    title: 'Electromagnet holding a weight', difficulty: 2, marks: 6,
    variants: [{ id: 'min-B', label: 'Minimum B to hold a core; does a paper gap still hold?' }, { id: 'find-I', label: 'Coil current for a required pull' }, { id: 'gap-change', label: 'Gap closes at constant current' }],
    tags: ['2024 test Q4', 'M3 N4'],
    gen: function (r, v) {
      var Acm = r.pick([3, 4, 5, 6, 8, 10]), A = Acm * 1e-4, data = { v: v, A: Acm };
      if (v === 'min-B') {
        var mass = r.pick([0.2, 0.3, 0.5, 0.8, 1, 1.5]), mu = r.nice(2000, 5000, 500), lc = r.nice(15, 40, 1) / 100, Nn = r.nice(5, 50, 1), I = r.float(1, 5, 1), t = r.pick([0.05, 0.07, 0.1]);
        var Bmin = Math.sqrt(2 * MU0 * mass * G0 / (2 * A)), Rc = lc / (mu * MU0 * A), Rg = 2 * t * 1e-3 / (MU0 * A), Bact = Nn * I / ((Rc + Rg) * A), Fact = Bact * Bact / (2 * MU0) * 2 * A;
        if (Bact > 1.5) return null;
        Object.assign(data, { m: mass, mu: mu, lc: lc, N: Nn, I: I, t: t });
        return Q('An electromagnet uses two identical C-cores. The upper core is fixed and magnetic attraction holds the lower core, which has a mass of ' + mass + ' kg. The cross-section is ' + Acm + ' cm², ' + m('\\mu_R = ' + mu) + ' and the total iron path is ' + N(lc * 100) + ' cm. A ' + Nn + '-turn coil carrying ' + I + ' A is on the upper core. A sheet of paper ' + t + ' mm thick sits between the cores at both joints. Take $g = 9.81$ m/s².',
          figCore({ type: 'paper', N: 'N = ' + Nn, gap: 't = ' + t + ' mm', A: 'A = ' + Acm + ' cm²', l: 'l_C = ' + N(lc * 100) + ' cm', mu: '\\mu_R = ' + mu }),
          [['$m$', mass + ' kg'], ['$A$', cm2(Acm)], ['$\\mu_R$', String(mu)], ['$l_C$', N(lc * 100) + ' cm'], ['$N$, $I$', Nn + ', ' + I + ' A'], ['paper', t + ' mm']],
          [P('(a) Find the minimum flux density needed to support the lower core.', [ans('$B_{min}$', Bmin, 'T')], [m('mg = ' + mass + '\\times9.81 = ' + E(mass * G0, 'N')), 'Both pole faces pull, so the force area is $2A$: ' + m('B = \\sqrt{\\dfrac{2\\mu_0mg}{2A}} = \\sqrt{\\dfrac{2\\times4\\pi\\times10^{-7}\\times' + N(mass * G0) + '}{' + N(2 * A) + '}} = ' + E(Bmin, 'T'))], 'B_{min} = ' + E(Bmin, 'T')),
            P('(b) Find the actual flux density with the paper in place, and the holding force. Does the core stay up?', [ans('$B$', Bact, 'T'), ans('$F$', Fact, 'N')], [m('l_G = 2t = ' + N(2 * t) + '\\ \\text{mm}'), m('\\mathcal{R}_C = ' + E(Rc, 'At/Wb') + ',\\ \\mathcal{R}_G = ' + E(Rg, 'At/Wb')), m('B = \\dfrac{NI}{(\\mathcal{R}_C+\\mathcal{R}_G)A} = ' + E(Bact, 'T')), m('F = \\dfrac{B^2}{2\\mu_0}(2A) = ' + E(Fact, 'N')) + (Bact >= Bmin ? ' ≥ mg: it holds.' : ' < mg: it falls.')], 'B = ' + E(Bact, 'T'))],
          '', data);
      }
      var Nn2 = r.nice(100, 800, 50), g = r.pick([0.5, 1, 1.5, 2, 3]), Freq = r.nice(50, 600, 10);
      var Bf = Math.sqrt(MU0 * Freq / A), I2 = Bf * 2 * g * 1e-3 / (MU0 * Nn2), Rg2 = 2 * g * 1e-3 / (MU0 * A), L = Nn2 * Nn2 / Rg2;
      if (Bf > 1.4) return null;
      Object.assign(data, { N: Nn2, g: g, F: Freq });
      var fig = figCore({ type: 'U2', N: 'N = ' + Nn2, gap: 'g = ' + g + ' mm', A: 'A = ' + Acm + ' cm² (each pole)' });
      if (v === 'find-I') {
        return Q('A U-shaped iron core with a ' + Nn2 + '-turn coil attracts an iron armature across two air gaps of ' + g + ' mm each. Each pole face is ' + Acm + ' cm². Treat the iron as infinitely permeable.', fig,
          [['$N$', String(Nn2)], ['gap (each)', g + ' mm'], ['$A$', cm2(Acm)], ['pull', Freq + ' N']],
          [P('(a) Find the coil current needed for a total pull of ' + Freq + ' N.', [ans('$B$', Bf, 'T'), ans('$I$', I2, 'A')], ['Two pole faces: ' + m('F = \\dfrac{B^2}{2\\mu_0}(2A) \\Rightarrow B = \\sqrt{\\dfrac{\\mu_0F}{A}} = \\sqrt{\\dfrac{4\\pi\\times10^{-7}\\times' + Freq + '}{' + N(A) + '}} = ' + E(Bf, 'T')), 'Total gap ' + m('l_G = 2g = ' + N(2 * g) + '\\ \\text{mm}') + ': ' + m('I = \\dfrac{Bl_G}{\\mu_0N} = ' + E(I2, 'A'))], 'I = ' + E(I2, 'A')),
            P('(b) Find the inductance and the stored energy at that current.', [ans('$L$', L, 'H'), ans('$W$', 0.5 * L * I2 * I2, 'J')], [relG('\\mathcal{R}_G', 2 * g * 1e-3, A, Rg2), m('L = N^2/\\mathcal{R}_G = ' + E(L, 'H')), m('W = \\tfrac12LI^2 = ' + E(0.5 * L * I2 * I2, 'J'))], 'W = ' + E(0.5 * L * I2 * I2, 'J'))], '', data);
      }
      var k = r.pick([2, 3, 4]), g2 = g / k, B2 = Bf * k, F2 = Freq * k * k;
      data.k = k;
      return Q('A U-shaped iron core with a ' + Nn2 + '-turn coil holds an armature across two gaps of ' + g + ' mm each with a pull of ' + Freq + ' N. Each pole face is ' + Acm + ' cm²; treat the iron as infinitely permeable.', fig,
        [['$N$', String(Nn2)], ['gap (each)', g + ' mm'], ['$A$', cm2(Acm)], ['pull', Freq + ' N']],
        [P('(a) Find the gap flux density and the coil current.', [ans('$B$', Bf, 'T'), ans('$I$', I2, 'A')], [m('B = \\sqrt{\\mu_0F/A} = ' + E(Bf, 'T')), m('I = \\dfrac{B(2g)}{\\mu_0N} = ' + E(I2, 'A'))], 'I = ' + E(I2, 'A')),
          P('(b) The armature moves in until each gap is ' + N(g2) + ' mm, at the same current. Estimate the new B and force, and comment.', [ans("$B'$", B2, 'T'), ans("$F'$", F2, 'N')], ['At constant $NI$ with only gap reluctance, $B\\propto 1/l_G$ and $F\\propto B^2$:', m("B' = " + k + '\\times' + N(Bf) + ' = ' + E(B2, 'T') + ',\\quad F\' = ' + k + '^2\\times' + Freq + ' = ' + E(F2, 'N')), B2 > 1.6 ? 'But ' + m(E(B2, 'T')) + ' is beyond the knee of the B–H curve: the iron saturates, so the real force is lower and the infinite-μ model fails.' : 'This is still below saturation, so the estimate is reasonable.'], "F' = " + E(F2, 'N'))], '', data);
    }
  });

  /* ---------- mag.ironloss ---------- */
  ADD({
    id: 'mach.mag.ironloss.scale', course: 'mach', module: 'mag', topic: 'ironloss',
    title: 'Scaling hysteresis and eddy-current loss to new B̂ and f', difficulty: 2, marks: 4,
    variants: [{ id: 'B-and-f', label: 'New B̂ and new f given (Jun23 Q2a(iii))' }, { id: 'fixed-V', label: 'Same voltage, new frequency' }, { id: 'v-over-f', label: 'Constant V/f' }, { id: 'inverse', label: 'B̂ for the same loss at a new f' }],
    tags: ['exam-style', 'Q2', 'Jun23 Q2a(iii)', 'PQ 3.13'],
    gen: function (r, v) {
      var Pt = r.pick([3, 8, 12, 20, 45, 100, 150, 400]), h = r.pick([20, 25, 30, 40, 50, 60, 70]) / 100, B1 = r.pick([0.8, 1, 1.2, 1.4, 1.5]), f1 = r.pick([50, 60]);
      var PH1 = h * Pt, PE1 = (1 - h) * Pt, data = { v: v, P: Pt, h: h, B1: B1, f1: f1 };
      var split = [m('P_{H1} = ' + Math.round(h * 100) + '\\%\\times' + Pt + ' = ' + E(PH1, 'W') + ',\\quad P_{E1} = ' + E(PE1, 'W'))];
      var stem = 'A laminated core operating at ' + m('\\hat B = ' + B1 + '\\ \\text{T}') + ', ' + f1 + ' Hz has an iron loss of ' + Pt + ' W, of which ' + Math.round(h * 100) + ' % is hysteresis and ' + Math.round((1 - h) * 100) + ' % is eddy-current loss.';
      var given = [['$P_{FE}$', Pt + ' W'], ['hysteresis share', Math.round(h * 100) + ' %'], ['$\\hat B_1$, $f_1$', B1 + ' T, ' + f1 + ' Hz']];
      function scaled(B2, f2, lead) {
        var kb = Math.pow(B2 / B1, 2), PH2 = PH1 * kb * f2 / f1, PE2 = PE1 * kb * Math.pow(f2 / f1, 2);
        return [P(lead, [ans('$P_H$', PH2, 'W'), ans('$P_E$', PE2, 'W'), ans('$P_{FE}$', PH2 + PE2, 'W')],
          split.concat([m('P_{H2} = P_{H1}\\left(\\dfrac{\\hat B_2}{\\hat B_1}\\right)^2\\dfrac{f_2}{f_1} = ' + N(PH1) + '\\left(\\dfrac{' + N(B2) + '}{' + B1 + '}\\right)^2\\dfrac{' + f2 + '}{' + f1 + '} = ' + E(PH2, 'W')), m('P_{E2} = P_{E1}\\left(\\dfrac{\\hat B_2}{\\hat B_1}\\right)^2\\left(\\dfrac{f_2}{f_1}\\right)^2 = ' + E(PE2, 'W')), m('P_{FE2} = ' + E(PH2 + PE2, 'W'))]), 'P_{FE} = ' + E(PH2 + PE2, 'W'))];
      }
      if (v === 'B-and-f') {
        var B2 = r.pick([0.6, 0.8, 1, 1.1, 1.2, 1.3, 1.6]), f2 = r.pick([25, 40, 60, 100, 120, 200, 400]);
        if (B2 === B1 || f2 === f1) return null;
        Object.assign(data, { B2: B2, f2: f2 });
        return Q(stem, null, given.concat([['$\\hat B_2$, $f_2$', B2 + ' T, ' + f2 + ' Hz']]), scaled(B2, f2, 'Find the new hysteresis, eddy-current and total iron loss at ' + B2 + ' T, ' + f2 + ' Hz.'),
          trap('Split the loss first: hysteresis ∝ $\\hat B^2f$, eddy ∝ $\\hat B^2f^2$. One factor for the total loses all the marks.'), data);
      }
      if (v === 'fixed-V') {
        var f3 = f1 === 50 ? r.pick([60, 40, 100]) : r.pick([50, 100]), B3 = B1 * f1 / f3;
        data.f2 = f3;
        var pp = scaled(B3, f3, '(b) Find the new hysteresis, eddy-current and total iron loss.');
        return Q(stem + ' The same winding is now supplied at the <b>same voltage</b> but at ' + f3 + ' Hz.', null, given.concat([['new $f$', f3 + ' Hz (same V)']]),
          [P('(a) Find the new peak flux density.', [ans('$\\hat B_2$', B3, 'T')], ['From the back-emf equation $\\hat B\\propto V/f$: ' + m('\\hat B_2 = ' + B1 + '\\times' + f1 + '/' + f3 + ' = ' + E(B3, 'T'))], '\\hat B_2 = ' + E(B3, 'T'))].concat(pp),
          tip('At fixed V: $P_H\\propto 1/f$ and $P_E$ is unchanged.'), data);
      }
      if (v === 'v-over-f') {
        var kf = r.pick([0.5, 0.8, 1.2, 1.5, 2]), f4 = f1 * kf;
        data.f2 = f4;
        return Q(stem + ' A variable-frequency drive supplies it at ' + N(f4) + ' Hz with the voltage scaled in proportion (constant V/f).', null, given.concat([['new $f$', N(f4) + ' Hz, V/f constant']]),
          [P('(a) What is the new peak flux density?', [ans('$\\hat B_2$', B1, 'T')], ['$\\hat B\\propto V/f$, which is unchanged: ' + m('\\hat B_2 = ' + B1 + '\\ \\text{T}')], '\\hat B_2 = ' + B1 + '\\ \\text{T}')].concat(scaled(B1, f4, '(b) Find the new hysteresis, eddy and total loss.')), '', data);
      }
      var f5 = r.pick([100, 200, 400, 1000]), kf2 = f5 / f1, fac = h * kf2 + (1 - h) * kf2 * kf2, B5 = B1 / Math.sqrt(fac);
      data.f2 = f5;
      return Q(stem + ' The core is to run at ' + f5 + ' Hz with the <b>same total iron loss</b>.', null, given.concat([['new $f$', f5 + ' Hz']]),
        [P('(a) Find the loss multiplier at ' + f5 + ' Hz if ' + m('\\hat B') + ' were unchanged.', [ans('factor', fac, '')], split.concat([m('\\text{factor} = ' + h + '\\times' + N(kf2) + ' + ' + N(1 - h) + '\\times' + N(kf2) + '^2 = ' + N(fac))]), '\\text{factor} = ' + N(fac)),
          P('(b) Find the peak flux density that gives the same loss.', [ans('$\\hat B_2$', B5, 'T')], ['Both parts scale with $\\hat B^2$, so take a square root: ' + m('\\hat B_2 = \\hat B_1/\\sqrt{' + N(fac) + '} = ' + E(B5, 'T'))], '\\hat B_2 = ' + E(B5, 'T'))], '', data);
    }
  });

  ADD({
    id: 'mach.mag.ironloss.separate', course: 'mach', module: 'mag', topic: 'ironloss',
    title: 'Separating iron loss; laminations; core-loss resistance', difficulty: 3, marks: 5,
    variants: [{ id: 'two-freq', label: 'Loss at two frequencies, same B̂: separate P_H and P_E' }, { id: 'lamination', label: 'Thinner laminations' }, { id: 'rc', label: 'R_C from the iron loss; new voltage' }],
    tags: ['PQ 3.26', 'Jun24 Q2c(iii)'],
    gen: function (r, v) {
      var data = { v: v };
      if (v === 'two-freq') {
        var f1 = 50, f2 = r.pick([25, 60, 100]), a = r.float(0.1, 2, 2), b = r.float(0.002, 0.04, 3);
        var P1 = sg(a * f1 + b * f1 * f1, 4), P2 = sg(a * f2 + b * f2 * f2, 4);
        var bb = (P2 / f2 - P1 / f1) / (f2 - f1), aa = P1 / f1 - bb * f1, f3 = r.pick([40, 80, 150, 200]);
        if (aa <= 0 || bb <= 0) return null;
        Object.assign(data, { P1: P1, P2: P2, f2: f2, f3: f3 });
        return Q('Tests on a core at the same peak flux density give an iron loss of ' + P1 + ' W at ' + f1 + ' Hz and ' + P2 + ' W at ' + f2 + ' Hz.', null,
          [['$P_1$ at ' + f1 + ' Hz', P1 + ' W'], ['$P_2$ at ' + f2 + ' Hz', P2 + ' W']],
          [P('(a) Using $P = af + bf^2$ (hysteresis + eddy at fixed B̂), find the hysteresis and eddy loss at ' + f1 + ' Hz.', [ans('$P_H$', aa * f1, 'W'), ans('$P_E$', bb * f1 * f1, 'W')], [m('P/f = a + bf'), m(N(P1 / f1) + ' = a + ' + f1 + 'b,\\quad ' + N(P2 / f2) + ' = a + ' + f2 + 'b'), m('b = \\dfrac{' + N(P2 / f2) + ' - ' + N(P1 / f1) + '}{' + f2 + ' - ' + f1 + '} = ' + N(bb) + ',\\quad a = ' + N(aa)), m('P_H = af_1 = ' + E(aa * f1, 'W') + ',\\ P_E = bf_1^2 = ' + E(bb * f1 * f1, 'W'))], 'P_H = ' + E(aa * f1, 'W') + ',\\ P_E = ' + E(bb * f1 * f1, 'W')),
            P('(b) Predict the total loss at ' + f3 + ' Hz (same B̂).', [ans('$P$', aa * f3 + bb * f3 * f3, 'W')], [m('P = ' + N(aa) + '\\times' + f3 + ' + ' + N(bb) + '\\times' + f3 + '^2 = ' + E(aa * f3 + bb * f3 * f3, 'W'))], 'P = ' + E(aa * f3 + bb * f3 * f3, 'W'))],
          tip('Dividing by f turns the loss into a straight line: intercept = hysteresis, slope = eddy.'), data);
      }
      if (v === 'lamination') {
        var Pt = r.pick([20, 40, 60, 100, 250]), e = r.pick([40, 50, 60, 70]) / 100, t1 = r.pick([0.5, 0.35, 0.65]), t2 = r.pick([0.27, 0.23, 0.3, 0.35, 0.2]);
        if (t2 >= t1) return null;
        var PE2 = e * Pt * Math.pow(t2 / t1, 2), PH = (1 - e) * Pt;
        Object.assign(data, { P: Pt, e: e, t1: t1, t2: t2 });
        return Q('A core built from ' + t1 + ' mm laminations has an iron loss of ' + Pt + ' W, of which ' + Math.round(e * 100) + ' % is eddy-current loss. It is rebuilt with ' + t2 + ' mm laminations of the same steel, at the same B̂ and f.', null,
          [['$P_{FE}$', Pt + ' W'], ['eddy share', Math.round(e * 100) + ' %'], ['$t_1 \\to t_2$', t1 + ' → ' + t2 + ' mm']],
          [P('Find the new eddy-current loss and the new total iron loss.', [ans('$P_E$', PE2, 'W'), ans('$P_{FE}$', PH + PE2, 'W')], ['Eddy loss ∝ (lamination thickness)²; hysteresis depends on the steel, not the thickness.', m('P_{E2} = ' + N(e * Pt) + '\\left(\\dfrac{' + t2 + '}{' + t1 + '}\\right)^2 = ' + E(PE2, 'W')), m('P_{FE2} = ' + N(PH) + ' + ' + N(PE2) + ' = ' + E(PH + PE2, 'W'))], 'P_{FE} = ' + E(PH + PE2, 'W'))],
          tip('Thin insulated laminations break up the eddy-current paths.'), data);
      }
      var V = r.pick([110, 230, 240, 415, 3300, 11000]), Pf = V > 1000 ? r.nice(200, 5000, 50) : r.nice(5, 120, 1), k = r.pick([0.5, 0.8, 0.9, 1.1]), Rc = V * V / Pf;
      Object.assign(data, { V: V, P: Pf, k: k });
      return Q('A transformer winding at its rated ' + V + ' V, 50 Hz has an iron loss of ' + F.eng(Pf, 'W') + ' (open-circuit test).', null, [['$V$', V + ' V'], ['$P_{FE}$', F.eng(Pf, 'W')]],
        [P('(a) Find the core-loss resistance $R_C$.', [ans('$R_C$', Rc, 'Ω')], ['Iron loss ∝ $\\hat B^2$ ∝ $V^2$ at fixed f, which is how a resistor behaves:', m('R_C = V^2/P_{FE} = ' + V + '^2/' + N(Pf) + ' = ' + ohmT(Rc))], 'R_C = ' + ohmT(Rc)),
          P('(b) Estimate the iron loss if the voltage is ' + Math.round(k * 100) + ' % of rated (same f).', [ans("$P_{FE}'$", Pf * k * k, 'W')], [m("P_{FE}' = \\dfrac{(" + N(k * V) + ')^2}{R_C} = ' + k + '^2\\times' + N(Pf) + ' = ' + E(Pf * k * k, 'W'))], "P_{FE}' = " + E(Pf * k * k, 'W'))], '', data);
    }
  });

  /* ---------- transformer helpers ---------- */
  function xfmr(r, three) {
    var S = three ? r.pick([50, 100, 250, 500, 1000, 2000]) * 1e3 : r.pick([1, 2, 2.4, 3, 5, 10, 20, 50]) * 1e3;
    var pr = r.pick(three ? [[11000, 415], [11000, 433], [3300, 415], [6600, 415], [22000, 11000], [2200, 220], [33000, 11000]] : [[240, 48], [240, 24], [240, 32], [415, 110], [2400, 240], [3300, 240], [6600, 415], [230, 115], [480, 120]]);
    var V1 = pr[0], V2 = pr[1], n = V1 / V2, Vph = three ? V1 / SQ3 : V1, Ir = three ? S / (SQ3 * V1) : S / V1, Zb = Vph / Ir;
    var R = sg(r.float(0.008, 0.03, 3) * Zb, 3), X = sg(r.float(0.03, 0.08, 3) * Zb, 3), Rc = sg(r.float(60, 300, 0) * Zb, 3), Xm = sg(r.float(10, 40, 0) * Zb, 3);
    return { three: three, S: S, V1: V1, V2: V2, n: n, Vph: Vph, Ir: Ir, R: R, X: X, Rc: Rc, Xm: Xm };
  }
  function xName(t) { return (t.three ? 'three-phase, star-connected ' : 'single-phase ') + F.eng(t.S, 'VA') + ', ' + F.eng(t.V1, 'V') + '/' + F.eng(t.V2, 'V'); }
  function xfig(t, o) { o = o || {}; return figEquiv(Object.assign({ Rc: pv(t.Rc, 'Ω'), Xm: 'j' + pv(t.Xm, 'Ω'), R: pv(t.R, 'Ω'), X: 'j' + pv(t.X, 'Ω'), note: t.three ? 'per phase, referred to the primary' : 'referred to the primary' }, o)); }
  function xGiven(t) { return [['rating', F.eng(t.S, 'VA') + ', ' + F.eng(t.V1, 'V') + '/' + F.eng(t.V2, 'V') + (t.three ? ', 3-ph Y' : '')], ['$R$, $X$', F.eng(t.R, 'Ω') + ', ' + F.eng(t.X, 'Ω')], ['$R_C$, $X_M$', F.eng(t.Rc, 'Ω') + ', ' + F.eng(t.Xm, 'Ω')]]; }
  function v1Steps(V2p, I2p, Z, V1) {
    var drop = I2p.mul(Z);
    return [m("V_1 = V_2' + I_2'(R + jX) = " + N(V2p) + ' + (' + PZ(I2p) + ')(' + PZ(Z) + ')'), m('= ' + N(V2p) + ' + ' + PZ(drop) + ' = ' + N(V2p) + ' + (' + CR(drop) + ') = ' + CR(V1) + ' = ' + PZ(V1, 'V'))];
  }

  /* ---------- mag.ideal ---------- */
  ADD({
    id: 'mach.mag.ideal.referral', course: 'mach', module: 'mag', topic: 'ideal',
    title: 'Ideal transformer: referring the load, Z seen, currents and voltages', difficulty: 1, marks: 5,
    variants: [{ id: 'resistive', label: 'Resistive load (Jun24 Q2b)' }, { id: 'complex', label: 'Complex load, phasors' }, { id: 'max-power', label: 'Turns ratio for maximum power' }],
    tags: ['exam-style', 'Q2', 'Jun24 Q2b', 'PQ 3.20'],
    gen: function (r, v) {
      var Vs = r.pick([12, 24, 48, 120, 240]), n = r.pick([2, 3, 4, 5, 6, 8, 10]), Rs = r.eseries('E12', 2.2, 47), data = { v: v, Vs: Vs, n: n, Rs: Rs };
      if (v === 'max-power') {
        var RL = r.eseries('E12', 0.2, 16), nopt = Math.sqrt(Rs / RL);
        if (nopt < 1.2) return null;
        var I1 = Vs / (2 * Rs), Pm = Vs * Vs / (4 * Rs); data.RL = RL;
        return Q('A source of ' + Vs + ' V with internal resistance ' + F.eng(Rs, 'Ω') + ' is to drive a ' + F.eng(RL, 'Ω') + ' load through an ideal transformer.', figIdeal({ Vs: Vs + ' V', Rs: pv(Rs, 'Ω'), ratio: 'n : 1', loadK: 'R', ZL: pv(RL, 'Ω') }),
          [['$V_S$', Vs + ' V'], ['$R_S$', F.eng(Rs, 'Ω')], ['$R_L$', F.eng(RL, 'Ω')]],
          [P('(a) Find the turns ratio $n = N_1/N_2$ for maximum power to the load.', [ans('$n$', nopt, '')], ['Maximum power when the referred load equals the source resistance: ' + m("R_L' = n^2R_L = R_S \\Rightarrow n = \\sqrt{R_S/R_L} = \\sqrt{" + N(Rs) + '/' + N(RL) + '} = ' + N(nopt))], 'n = ' + N(nopt)),
            P('(b) With that ratio, find $I_1$, $I_2$, $V_2$ and the load power.', [ans('$I_1$', I1, 'A'), ans('$I_2$', nopt * I1, 'A'), ans('$V_2$', nopt * I1 * RL, 'V'), ans('$P_L$', Pm, 'W')], [m('I_1 = V_S/(2R_S) = ' + E(I1, 'A')), m('I_2 = nI_1 = ' + E(nopt * I1, 'A') + ',\\ V_2 = I_2R_L = ' + E(nopt * I1 * RL, 'V')), m('P_L = I_2^2R_L = V_S^2/(4R_S) = ' + E(Pm, 'W'))], 'P_L = ' + E(Pm, 'W'))], '', data);
      }
      if (v === 'complex') {
        var Rl = r.float(0.1, 2, 2), Xl = sg(Rl * r.float(0.3, 1.2, 2), 2), ZL = CX(Rl, Xl), ZLp = ZL.scale(n * n), Zt = ZLp.add(Rs), I1c = CX(Vs, 0).div(Zt), V1c = I1c.mul(ZLp), I2c = I1c.scale(n), V2c = V1c.scale(1 / n), PL = I2c.abs() * I2c.abs() * Rl;
        if (ZLp.abs() < 0.3 * Rs || ZLp.abs() > 6 * Rs) return null;
        Object.assign(data, { R: Rl, X: Xl });
        return Q('A ' + Vs + ' V, 50 Hz source with series resistance ' + F.eng(Rs, 'Ω') + ' feeds the primary of an ideal ' + n + ':1 transformer. The secondary supplies ' + m('Z_L = ' + N(Rl) + ' + j' + N(Xl) + '\\ \\Omega') + '. Take the source at 0°.', figIdeal({ Vs: Vs + ' V', Rs: pv(Rs, 'Ω'), ratio: n + ' : 1', ZL: Rl + ' + j' + Xl + ' Ω' }),
          [['$V_S$', Vs + ' V'], ['$R_S$', F.eng(Rs, 'Ω')], ['$n$', n + ':1'], ['$Z_L$', Rl + ' + j' + Xl + ' Ω']],
          [P('(a) Find the load impedance referred to the primary.', [ans("$|Z_L'|$", ZLp.abs(), 'Ω'), angA("$\\angle Z_L'$", ZLp.argd())], [m("Z_L' = n^2Z_L = " + (n * n) + '(' + CR(ZL) + ') = ' + CR(ZLp) + ' = ' + PZ(ZLp, 'Ω')) + ' (the angle does not change)'], "Z_L' = " + PZ(ZLp, 'Ω')),
            P('(b) Find $I_1$ and $V_1$ in polar form.', [ans('$|I_1|$', I1c.abs(), 'A'), angA('$\\angle I_1$', I1c.argd()), ans('$|V_1|$', V1c.abs(), 'V'), angA('$\\angle V_1$', V1c.argd())], [m("Z_{tot} = R_S + Z_L' = " + CR(Zt) + ' = ' + PZ(Zt, 'Ω')), m('I_1 = V_S/Z_{tot} = ' + PZ(I1c, 'A')), m("V_1 = I_1Z_L' = " + PZ(V1c, 'V'))], 'I_1 = ' + PZ(I1c, 'A')),
            P('(c) Find the actual secondary current and voltage, and the real power in the load.', [ans('$|I_2|$', I2c.abs(), 'A'), ans('$|V_2|$', V2c.abs(), 'V'), ans('$P_L$', PL, 'W')], [m('I_2 = nI_1 = ' + PZ(I2c, 'A') + ',\\ V_2 = V_1/n = ' + PZ(V2c, 'V')), m('P_L = |I_2|^2R_L = ' + E(PL, 'W'))], 'P_L = ' + E(PL, 'W'))], '', data);
      }
      var RL2 = r.eseries('E12', 0.1, 22), Z1 = RL2, Z2 = n * n * RL2, Z3 = Rs + Z2;
      if (Z2 < 0.3 * Rs || Z2 > 8 * Rs) return null;
      var I1r = Vs / Z3, I2r = n * I1r, V1r = I1r * Z2, V2r = V1r / n, Pl = I2r * I2r * RL2; data.RL = RL2;
      return Q('In the circuit the transformer is ideal with a turns ratio of ' + n + ':1. The supply is ' + m('V_S = ' + Vs + '\\ \\text{V}') + ', the series resistor is ' + F.eng(Rs, 'Ω') + ' and the load is ' + F.eng(RL2, 'Ω') + '. $Z_1$ is seen looking into the load from the secondary, $Z_2$ looking into the primary, and $Z_3$ by the source.',
        figIdeal({ Vs: Vs + ' V', Rs: pv(Rs, 'Ω'), ratio: n + ' : 1', loadK: 'R', ZL: pv(RL2, 'Ω'), zarrows: true }),
        [['$V_S$', Vs + ' V'], ['$R_S$', F.eng(Rs, 'Ω')], ['$n$', n + ':1'], ['$R_L$', F.eng(RL2, 'Ω')]],
        [P('(i) Find $Z_1$, $Z_2$ and $Z_3$.', [ans('$Z_1$', Z1, 'Ω'), ans('$Z_2$', Z2, 'Ω'), ans('$Z_3$', Z3, 'Ω')], [m('Z_1 = R_L = ' + ohmT(Z1)), m('Z_2 = n^2Z_1 = ' + (n * n) + '\\times' + N(Z1) + ' = ' + ohmT(Z2)), m('Z_3 = R_S + Z_2 = ' + ohmT(Z3))], 'Z_3 = ' + ohmT(Z3)),
          P('(ii) Find $I_1$, $I_2$, $V_1$ and $V_2$.', [ans('$I_1$', I1r, 'A'), ans('$I_2$', I2r, 'A'), ans('$V_1$', V1r, 'V'), ans('$V_2$', V2r, 'V')], [m('I_1 = V_S/Z_3 = ' + Vs + '/' + N(Z3) + ' = ' + E(I1r, 'A')), m('I_2 = nI_1 = ' + E(I2r, 'A')), m('V_1 = I_1Z_2 = ' + E(V1r, 'V') + ',\\ V_2 = V_1/n = ' + E(V2r, 'V')), 'Check: ' + m('V_1I_1 = ' + E(V1r * I1r, 'W') + ' = V_2I_2')], 'V_2 = ' + E(V2r, 'V')),
          P('(iii) Find the load power and the efficiency of power transfer from the source.', [ans('$P_L$', Pl, 'W'), pctA('$\\eta$', 100 * Pl / (Vs * I1r))], [m('P_L = I_2^2R_L = ' + E(Pl, 'W')), m('\\eta = P_L/(V_SI_1) = ' + N(Pl) + '/' + N(Vs * I1r) + ' = ' + N(100 * Pl / (Vs * I1r)) + '\\%')], '\\eta = ' + N(100 * Pl / (Vs * I1r)) + '\\%')],
        trap('Impedance refers by $n^2$, not $n$. Current goes the opposite way to voltage.'), data);
    }
  });

  ADD({
    id: 'mach.mag.ideal.refer-params', course: 'mach', module: 'mag', topic: 'ideal',
    title: 'Referring winding parameters to one side', difficulty: 2, marks: 5,
    variants: [{ id: 'to-primary', label: 'Refer to the primary (HV), then no-load current' }, { id: 'to-secondary', label: 'Refer to the secondary (LV), then SC voltage' }],
    tags: ['PQ 3.27'],
    gen: function (r, v) {
      var t = xfmr(r, false), n = t.n, a = r.float(0.4, 0.6, 2), b = r.float(0.4, 0.6, 2);
      var R1 = sg(t.R * a, 3), R2 = sg(t.R * (1 - a) / (n * n), 3), X1 = sg(t.X * b, 3), X2 = sg(t.X * (1 - b) / (n * n), 3), R = R1 + n * n * R2, X = X1 + n * n * X2;
      var data = { v: v, S: t.S, V1: t.V1, V2: t.V2, R1: R1, R2: R2, X1: X1, X2: X2, Rc: t.Rc, Xm: t.Xm };
      var stem = 'A ' + xName(t) + ' transformer has primary resistance ' + F.eng(R1, 'Ω') + ', secondary resistance ' + F.eng(R2, 'Ω') + ', primary leakage reactance ' + F.eng(X1, 'Ω') + ', secondary leakage reactance ' + F.eng(X2, 'Ω') + ' (secondary values <b>not</b> referred), magnetising reactance ' + F.eng(t.Xm, 'Ω') + ' and core-loss resistance ' + F.eng(t.Rc, 'Ω') + ' (both on the primary).';
      var given = [['$R_1$, $X_1$', F.eng(R1, 'Ω') + ', ' + F.eng(X1, 'Ω')], ['$R_2$, $X_2$', F.eng(R2, 'Ω') + ', ' + F.eng(X2, 'Ω')], ['$R_C$, $X_M$ (primary)', F.eng(t.Rc, 'Ω') + ', ' + F.eng(t.Xm, 'Ω')]];
      var nS = m('n = ' + t.V1 + '/' + t.V2 + ' = ' + N(n) + ',\\ n^2 = ' + N(n * n));
      if (v === 'to-primary') {
        var V = t.V1, IC = V / t.Rc, IM = V / t.Xm;
        return Q(stem, xfig(t, { R: '?', X: 'j?' }), given,
          [P('(a) Draw the simplified circuit referred to the primary and find R and X.', [ans('$R$', R, 'Ω'), ans('$X$', X, 'Ω')], [nS, m("R = R_1 + n^2R_2 = " + N(R1) + ' + ' + N(n * n) + '\\times' + N(R2) + ' = ' + ohmT(R)), m('X = X_1 + n^2X_2 = ' + N(X1) + ' + ' + N(n * n) + '\\times' + N(X2) + ' = ' + ohmT(X)), '$R_C \\parallel jX_M$ sits across $V_1$; $R + jX$ is in series to $V_2\'$.'], 'R = ' + ohmT(R) + ',\\ X = ' + ohmT(X)),
            P('(b) Find the no-load input current and power at rated voltage.', [ans('$I_0$', Math.hypot(IC, IM), 'A'), ans('$P_0$', V * V / t.Rc, 'W')], [m('I_C = V/R_C = ' + E(IC, 'A') + ',\\ I_M = V/X_M = ' + E(IM, 'A')), m('I_0 = \\sqrt{I_C^2 + I_M^2} = ' + E(Math.hypot(IC, IM), 'A')), m('P_0 = V^2/R_C = ' + E(V * V / t.Rc, 'W'))], 'I_0 = ' + E(Math.hypot(IC, IM), 'A')),
            P('(c) Find the rated primary current and the supply voltage that drives it into a short-circuited secondary (neglect the shunt branch).', [ans('$I_{1,rated}$', t.S / V, 'A'), ans('$V_{SC}$', t.S / V * Math.hypot(R, X), 'V')], [m('I_{1} = S/V_1 = ' + E(t.S / V, 'A')), m('V_{SC} = I_1|R + jX| = ' + N(t.S / V) + '\\times' + N(Math.hypot(R, X)) + ' = ' + E(t.S / V * Math.hypot(R, X), 'V'))], 'V_{SC} = ' + E(t.S / V * Math.hypot(R, X), 'V'))],
          trap('Secondary values refer by $n^2$: $R_2\' = n^2R_2$, not $nR_2$.'), data);
      }
      var R2s = R1 / (n * n) + R2, X2s = X1 / (n * n) + X2, I2r = t.S / t.V2;
      return Q(stem, null, given,
        [P('(a) Find the series resistance and reactance referred to the <b>secondary</b>.', [ans("$R''$", R2s, 'Ω'), ans("$X''$", X2s, 'Ω')], [nS, 'Moving a primary impedance to the secondary divides by $n^2$:', m("R'' = R_1/n^2 + R_2 = " + N(R1) + '/' + N(n * n) + ' + ' + N(R2) + ' = ' + ohmT(R2s)), m("X'' = X_1/n^2 + X_2 = " + ohmT(X2s))], "R'' = " + ohmT(R2s) + ",\\ X'' = " + ohmT(X2s)),
          P('(b) Find $R_C$ and $X_M$ referred to the secondary.', [ans("$R_C''$", t.Rc / (n * n), 'Ω'), ans("$X_M''$", t.Xm / (n * n), 'Ω')], [m("R_C'' = R_C/n^2 = " + ohmT(t.Rc / (n * n)) + ",\\ X_M'' = X_M/n^2 = " + ohmT(t.Xm / (n * n)))], "X_M'' = " + ohmT(t.Xm / (n * n))),
          P('(c) A short-circuit test is done from the LV side at rated LV current. Find that current and the voltage needed.', [ans('$I_{2,rated}$', I2r, 'A'), ans('$V_{SC}$', I2r * Math.hypot(R2s, X2s), 'V')], [m('I_2 = S/V_2 = ' + E(I2r, 'A')), m("V_{SC} = I_2|R'' + jX''| = " + E(I2r * Math.hypot(R2s, X2s), 'V')) + ' — the same per-unit value as on the HV side.'], 'V_{SC} = ' + E(I2r * Math.hypot(R2s, X2s), 'V'))], '', data);
    }
  });

  /* ---------- mag.eqcct ---------- */
  ADD({
    id: 'mach.mag.eqcct.ocsc', course: 'mach', module: 'mag', topic: 'eqcct',
    title: 'Equivalent-circuit parameters from open- and short-circuit tests', difficulty: 2, marks: 6,
    variants: [{ id: '1ph', label: 'Single-phase, both tests on the primary' }, { id: 'oc-lv', label: 'OC test on the LV side: refer to HV' }, { id: '3ph-star', label: 'Three-phase star, line readings' }, { id: 'to-lv', label: 'Parameters referred to the LV side' }],
    tags: ['exam-style', 'Q2', 'Jun23 Q2b', 'mock Q2b', 'PQ 3.29', '2024 test Q6'],
    gen: function (r, v) {
      var three = v === '3ph-star', t = xfmr(r, three), n = t.n;
      var ocLV = v === 'oc-lv', Vp = t.Vph, Ioc = Vp * Math.hypot(1 / t.Rc, 1 / t.Xm), Poc = Vp * Vp / t.Rc;
      var k = three ? 3 : 1, Voc = ocLV ? t.V2 : t.V1, IocR = sg((ocLV ? Ioc * n : Ioc), 3), PocR = sg(Poc * k, 3);
      var Isc = sg(t.Ir, 4), Vsc = sg(t.Ir * Math.hypot(t.R, t.X) * (three ? SQ3 : 1), 3), Psc = sg(t.Ir * t.Ir * t.R * k, 3);
      // per-phase working values from the readings
      var vO = three ? Voc / SQ3 : Voc, pO = PocR / k, sO = vO * IocR, qO = Math.sqrt(Math.max(sO * sO - pO * pO, 0)), RcT = vO * vO / pO, XmT = vO * vO / qO;
      var vS = three ? Vsc / SQ3 : Vsc, pS = Psc / k, sS = vS * Isc, qS = Math.sqrt(Math.max(sS * sS - pS * pS, 0)), Rr = pS / (Isc * Isc), Xr = qS / (Isc * Isc);
      if (qO <= 0 || qS <= 0) return null;
      var data = { v: v, V1: t.V1, V2: t.V2, S: t.S, Voc: Voc, Ioc: IocR, Poc: PocR, Vsc: Vsc, Isc: Isc, Psc: Psc };
      var RcH = ocLV ? RcT * n * n : RcT, XmH = ocLV ? XmT * n * n : XmT;
      var toLV = v === 'to-lv', fR = toLV ? 1 / (n * n) : 1;
      var stem = 'The following tests are performed on a ' + xName(t) + ' transformer' + (three ? ' (all readings are line values / totals)' : '') + ':<br>• Short-circuit test, LV winding shorted, measured on the HV side: ' + F.eng(Vsc, 'V') + ', ' + F.eng(Isc, 'A') + ', ' + F.eng(Psc, 'W') + '.<br>• Open-circuit test, ' + (ocLV ? 'measured on the <b>LV side</b> (HV open)' : 'measured on the HV side (LV open)') + ': ' + F.eng(Voc, 'V') + ', ' + F.eng(IocR, 'A') + ', ' + F.eng(PocR, 'W') + '.';
      var askSide = toLV ? 'referred to the <b>LV</b> side' : 'referred to the HV (primary) side';
      var given = [['SC (HV side)', F.eng(Vsc, 'V') + ', ' + F.eng(Isc, 'A') + ', ' + F.eng(Psc, 'W')], ['OC (' + (ocLV ? 'LV' : 'HV') + ' side)', F.eng(Voc, 'V') + ', ' + F.eng(IocR, 'A') + ', ' + F.eng(PocR, 'W')]];
      var pp = three ? ['Convert to per-phase values first (star): ' + m('V_1 = V_L/\\sqrt3,\\ I_1 = I_L,\\ P_1 = P/3')] : [];
      var scSteps = pp.concat([m('V = ' + E(vS, 'V') + ',\\ I = ' + E(Isc, 'A') + ',\\ P = ' + E(pS, 'W')), m('S = VI = ' + E(sS, 'VA') + ',\\ Q = \\sqrt{S^2 - P^2} = ' + E(qS, 'VAr')), 'Series elements use $I^2$: ' + m('R = P/I^2 = ' + ohmT(Rr) + ',\\ X = Q/I^2 = ' + ohmT(Xr)), 'Check: ' + m('|Z| = V/I = ' + ohmT(vS / Isc) + ' = \\sqrt{R^2 + X^2}')]);
      if (toLV) scSteps.push('Refer to the LV side (÷ n², ' + m('n = ' + N(n)) + '): ' + m("R'' = " + ohmT(Rr * fR) + ",\\ X'' = " + ohmT(Xr * fR)));
      var ocSteps = pp.concat([m('V = ' + E(vO, 'V') + ',\\ I = ' + E(IocR, 'A') + ',\\ P = ' + E(pO, 'W')), m('S = VI = ' + E(sO, 'VA') + ',\\ Q = \\sqrt{S^2 - P^2} = ' + E(qO, 'VAr')), 'Parallel elements use $V^2$: ' + m('R_C = V^2/P = ' + ohmT(RcT) + ',\\ X_M = V^2/Q = ' + ohmT(XmT))]);
      if (ocLV) ocSteps.push('These are on the LV side. Refer to the HV side (× n², ' + m('n = ' + N(n) + ',\\ n^2 = ' + N(n * n)) + '): ' + m('R_C = ' + ohmT(RcH) + ',\\ X_M = ' + ohmT(XmH)));
      if (toLV) ocSteps.push('Refer to the LV side (÷ n²): ' + m("R_C'' = " + ohmT(RcT * fR) + ",\\ X_M'' = " + ohmT(XmT * fR)));
      return Q(stem + ' Find the simplified equivalent-circuit parameters' + (three ? ' per phase' : '') + ', ' + askSide + '.', figTest(ocLV ? 'oc' : 'sc', { side: ocLV ? 'LV' : 'HV' }), given,
        [P('(a) From the short-circuit test, find R and X.', [ans(toLV ? "$R''$" : '$R$', Rr * fR, 'Ω'), ans(toLV ? "$X''$" : '$X$', Xr * fR, 'Ω')], scSteps, (toLV ? "R'' = " : 'R = ') + ohmT(Rr * fR) + (toLV ? ",\\ X'' = " : ',\\ X = ') + ohmT(Xr * fR)),
          P('(b) From the open-circuit test, find $R_C$ and $X_M$.', [ans(toLV ? "$R_C''$" : '$R_C$', toLV ? RcT * fR : RcH, 'Ω'), ans(toLV ? "$X_M''$" : '$X_M$', toLV ? XmT * fR : XmH, 'Ω')], ocSteps, 'R_C = ' + ohmT(toLV ? RcT * fR : RcH) + ',\\ X_M = ' + ohmT(toLV ? XmT * fR : XmH))],
        trap('OC → parallel ($V^2/P$, $V^2/Q$); SC → series ($P/I^2$, $Q/I^2$). $V/I$ is $|Z|$, not X. Parameters come out on the side you measured.'), data);
    }
  });

  ADD({
    id: 'mach.mag.eqcct.divider', course: 'mach', module: 'mag', topic: 'eqcct',
    title: 'Secondary voltage by voltage divider, and the primary current', difficulty: 3, marks: 7,
    variants: [{ id: 'resistive', label: 'Resistive load' }, { id: 'lead', label: 'Leading-pf load' }, { id: 'lag', label: 'Lagging-pf load' }],
    tags: ['exam-style', 'Q2', 'Jun23 Q2c', 'M4 N4'],
    gen: function (r, v) {
      var t = xfmr(r, false), n = t.n, pf = v === 'resistive' ? 1 : r.pick([0.7, 0.8, 0.85, 0.9]), ang = v === 'lead' ? -acosd(pf) : v === 'lag' ? acosd(pf) : 0;
      var ZLm = sg(t.V2 * t.V2 / (t.S * r.float(0.5, 1, 2)), 3), ZL = CX.polar(ZLm, ang), ZLp = ZL.scale(n * n), Zs = CX(t.R, t.X), V1 = CX(t.V1, 0);
      var V2p = V1.mul(ZLp).div(ZLp.add(Zs)), I2p = V2p.div(ZLp), Ish = V1.div(t.Rc).add(V1.div(CX(0, t.Xm))), I1 = I2p.add(Ish);
      var data = { v: v, V1: t.V1, V2: t.V2, R: t.R, X: t.X, Rc: t.Rc, Xm: t.Xm, ZL: ZLm, ang: ang };
      var zt = v === 'resistive' ? F.eng(ZLm, 'Ω') + ' resistive' : F.eng(ZLm, 'Ω') + ' at ' + pf + ' pf ' + (v === 'lead' ? 'leading' : 'lagging');
      return Q('A ' + xName(t) + ' transformer has, referred to the primary, ' + m('R = ' + ohmT(t.R) + ',\\ X = ' + ohmT(t.X) + ',\\ R_C = ' + ohmT(t.Rc) + ',\\ X_M = ' + ohmT(t.Xm)) + '. Rated voltage ' + m('V_1 = ' + t.V1 + '\\angle 0^\\circ\\ \\text{V}') + ' is applied and the secondary supplies a load of ' + zt + ' (actual value).',
        xfig(t, { load: "Z_L'" }), xGiven(t).concat([['$Z_L$ (actual)', zt]]),
        [P("(a) Find the referred load impedance $Z_L'$.", [ans("$|Z_L'|$", ZLp.abs(), 'Ω')], [m('n = ' + t.V1 + '/' + t.V2 + ' = ' + N(n)), m("Z_L' = n^2Z_L = " + N(n * n) + '\\times' + PZ(ZL) + ' = ' + PZ(ZLp, 'Ω'))], "Z_L' = " + PZ(ZLp, 'Ω')),
          P("(b) Use the voltage-divider rule to find $V_2'$ (polar) and the actual secondary voltage.", [ans("$|V_2'|$", V2p.abs(), 'V'), angA("$\\angle V_2'$", V2p.argd(), { abs: 0.1 }), ans('$V_2$', V2p.abs() / n, 'V')],
            ['The shunt branch is across $V_1$, so it does not enter the divider.', m("V_2' = V_1\\dfrac{Z_L'}{Z_L' + R + jX} = " + t.V1 + '\\times\\dfrac{' + PZ(ZLp) + '}{' + PZ(ZLp.add(Zs)) + '} = ' + PZ(V2p, 'V')), m("V_2 = |V_2'|/n = " + E(V2p.abs() / n, 'V')), "$V_2'$ " + (V2p.argd() < 0 ? 'lags' : 'leads') + ' $V_1$' + (v !== 'lag' ? ': the series X makes $I_2\'$ lag, and for a ' + (v === 'resistive' ? 'resistive' : 'capacitive') + ' load $V_2\'$ is not ahead of $I_2\'$ by more than the series-impedance angle.' : '.')], "V_2' = " + PZ(V2p, 'V')),
          P('(c) Find the primary current $I_1$ in polar form.', [ans('$|I_1|$', I1.abs(), 'A'), angA('$\\angle I_1$', I1.argd())],
            [m("I_2' = V_2'/Z_L' = " + PZ(I2p, 'A')), m('I_{sh} = V_1/R_C + V_1/(jX_M) = ' + CR(Ish) + ' = ' + PZ(Ish, 'A')), m("I_1 = I_2' + I_{sh} = " + PZ(I1, 'A'))], 'I_1 = ' + PZ(I1, 'A'))],
        trap('Do not put $R_C$ and $X_M$ into the divider or the KVL for $V_2\'$; they hang across $V_1$.' + (v === 'lead' ? ' A leading load raises $|V_2\'|$ but $V_2\'$ still lags $V_1$.' : '')), data);
    }
  });

  ADD({
    id: 'mach.mag.eqcct.reverse', course: 'mach', module: 'mag', topic: 'eqcct',
    title: 'From parameters to test readings: no-load and short-circuit', difficulty: 2, marks: 5,
    variants: [{ id: 'no-load', label: 'No-load current, power and pf' }, { id: 'sc-full', label: 'Short circuit at full voltage' }, { id: 'vsc', label: 'Voltage for rated SC current' }],
    tags: ['PQ 3.27', 'PQ 3.28'],
    gen: function (r, v) {
      var t = xfmr(r, false), V = t.V1, Z = Math.hypot(t.R, t.X), data = { v: v, V1: t.V1, V2: t.V2, S: t.S, R: t.R, X: t.X, Rc: t.Rc, Xm: t.Xm };
      var stem = 'A ' + xName(t) + ' transformer has these simplified-circuit parameters referred to the primary: ' + m('R = ' + ohmT(t.R) + ',\\ X = ' + ohmT(t.X) + ',\\ R_C = ' + ohmT(t.Rc) + ',\\ X_M = ' + ohmT(t.Xm)) + '.';
      if (v === 'no-load') {
        var IC = V / t.Rc, IM = V / t.Xm, I0 = Math.hypot(IC, IM);
        return Q(stem + ' Rated voltage is applied with the secondary open.', xfig(t), xGiven(t),
          [P('(a) Find the core-loss and magnetising currents and the no-load current.', [ans('$I_C$', IC, 'A'), ans('$I_M$', IM, 'A'), ans('$I_0$', I0, 'A')], [m('I_C = V/R_C = ' + V + '/' + N(t.Rc) + ' = ' + E(IC, 'A')), m('I_M = V/X_M = ' + E(IM, 'A')), 'They are perpendicular: ' + m('I_0 = \\sqrt{I_C^2 + I_M^2} = ' + E(I0, 'A'))], 'I_0 = ' + E(I0, 'A')),
            P('(b) Find the no-load input power, the pf, and $I_0$ as a % of rated current.', [ans('$P_0$', V * V / t.Rc, 'W'), ans('pf', IC / I0, ''), pctA('$I_0/I_{rated}$', 100 * I0 / t.Ir)], [m('P_0 = V^2/R_C = ' + E(V * V / t.Rc, 'W')), m('\\text{pf} = I_C/I_0 = ' + N(IC / I0) + '\\ \\text{lag}'), m('I_{rated} = S/V = ' + E(t.Ir, 'A') + ',\\ I_0/I_{rated} = ' + N(100 * I0 / t.Ir) + '\\%')], 'P_0 = ' + E(V * V / t.Rc, 'W'))],
          tip('The no-load current is mostly magnetising, so its pf is low.'), data);
      }
      if (v === 'sc-full') {
        var Isc = V / Z;
        return Q(stem + ' The secondary is accidentally short-circuited with rated voltage on the primary. Neglect the shunt branch.', xfig(t), xGiven(t),
          [P('(a) Find the input current and power.', [ans('$I_{SC}$', Isc, 'A'), ans('$P_{SC}$', Isc * Isc * t.R, 'W')], [m('|Z| = \\sqrt{R^2+X^2} = ' + ohmT(Z)), m('I = V/|Z| = ' + V + '/' + N(Z) + ' = ' + E(Isc, 'A')), m('P = I^2R = ' + E(Isc * Isc * t.R, 'W'))], 'I_{SC} = ' + E(Isc, 'A')),
            P('(b) How many times rated current is this?', [ans('$I_{SC}/I_{rated}$', Isc / t.Ir, '')], [m('I_{rated} = S/V = ' + E(t.Ir, 'A')), m('I_{SC}/I_{rated} = ' + N(Isc / t.Ir)) + ' — a destructive overload.'], 'I_{SC}/I_{rated} = ' + N(Isc / t.Ir))], '', data);
      }
      var Vsc = t.Ir * Z;
      return Q(stem + ' A short-circuit test is to be run at rated current.', figTest('sc', { side: 'HV' }), xGiven(t),
        [P('(a) Find the rated primary current and the test voltage needed.', [ans('$I_{rated}$', t.Ir, 'A'), ans('$V_{SC}$', Vsc, 'V'), pctA('$V_{SC}$ (% of rated)', 100 * Vsc / V)], [m('I_{rated} = S/V_1 = ' + E(t.Ir, 'A')), m('V_{SC} = I|R + jX| = ' + N(t.Ir) + '\\times' + N(Z) + ' = ' + E(Vsc, 'V')), m(N(100 * Vsc / V) + '\\%\\ \\text{of rated}')], 'V_{SC} = ' + E(Vsc, 'V')),
          P('(b) Find the wattmeter reading in that test.', [ans('$P_{SC}$', t.Ir * t.Ir * t.R, 'W')], [m('P_{SC} = I^2R = ' + E(t.Ir * t.Ir * t.R, 'W')) + ' — the full-load copper loss.'], 'P_{SC} = ' + E(t.Ir * t.Ir * t.R, 'W'))],
        tip('At about 5 % voltage the shunt currents (∝ V) are negligible, which is why the SC test measures only R + jX.'), data);
    }
  });

  /* ---------- mag.regeff ---------- */
  function loadAt(r, t, v) {
    var x = r.pick([1, 1, 0.75, 0.8, 0.5]), pf = v === 'unity' ? 1 : r.pick([0.75, 0.8, 0.85, 0.87, 0.9, 0.95]), S = x * t.S, spec = v === 'unity' ? 'P' : r.pick(['S', 'P', 'SQ']);
    var phi = v === 'lead' ? acosd(pf) : v === 'lag' ? -acosd(pf) : 0, P0 = S * pf, Q0 = S * sind(-phi);
    var txtL;
    if (spec === 'S') txtL = (x === 1 ? 'rated load (' + F.eng(S, 'VA') + ')' : F.eng(S, 'VA')) + ' at ' + pf + ' pf ' + (v === 'lead' ? 'leading' : 'lagging');
    else if (spec === 'P') txtL = F.eng(P0, 'W') + ' at ' + (v === 'unity' ? 'unity pf' : pf + ' pf ' + (v === 'lead' ? 'leading' : 'lagging'));
    else { S = sg(S, 3); Q0 = sg(Math.abs(Q0), 3) * (v === 'lead' ? -1 : 1); P0 = Math.sqrt(S * S - Q0 * Q0); pf = P0 / S; phi = v === 'lead' ? acosd(pf) : -acosd(pf); txtL = 'a load of apparent power ' + F.eng(S, 'VA') + ' that is ' + (v === 'lead' ? 'generating ' : 'absorbing ') + F.eng(Math.abs(Q0), 'VAr') + ' of reactive power'; }
    return { S: S, pf: pf, phi: phi, P: P0, Q: Q0, txt: txtL, spec: spec };
  }
  ADD({
    id: 'mach.mag.regeff.regulation', course: 'mach', module: 'mag', topic: 'regeff',
    title: 'Required primary voltage and voltage regulation', difficulty: 2, marks: 7,
    variants: [{ id: 'lag', label: 'Lagging load' }, { id: 'lead', label: 'Leading load (negative regulation possible)' }, { id: 'unity', label: 'Unity-pf load' }],
    tags: ['exam-style', 'Q2', '2023 quiz Q6', 'PQ 3.29', 'PQ 3.30', 'mock Q2c', '2024 test Q7'],
    gen: function (r, v) {
      var t = xfmr(r, r.bool(0.5)), L = loadAt(r, t, v), k = t.three ? 3 : 1, Zs = CX(t.R, t.X);
      var V2p = t.Vph, I2m = L.S / (k * V2p), I2p = CX.polar(I2m, L.phi), V1 = CX(V2p, 0).add(I2p.mul(Zs)), VR = 100 * (V1.abs() - V2p) / V2p;
      var sinp = sind(-L.phi), approx = I2m * (t.R * L.pf + t.X * sinp);
      var data = { v: v, three: t.three, V1: t.V1, R: t.R, X: t.X, S: L.S, pf: L.pf, phi: L.phi };
      var ia = [ans("$|I_2'|$", I2m, 'A')]; if (v !== 'unity') ia.push(angA("$\\angle I_2'$", L.phi));
      var Ssteps = L.spec === 'P' ? [m('S = P/\\text{pf} = ' + N(L.P) + '/' + N(L.pf) + ' = ' + E(L.S, 'VA'))] : L.spec === 'SQ' ? ['Power triangle: ' + m('P = \\sqrt{S^2 - Q^2} = ' + E(L.P, 'W') + ',\\ \\text{pf} = P/S = ' + N(L.pf)) + (v === 'lead' ? ' (generating Q, so leading)' : '')] : [];
      var parts = [P("(a) Find $V_2'$ and $I_2'$ referred to the primary" + (t.three ? ' (per phase)' : '') + ', taking $V_2\'$ as reference.', [ans("$V_2'$", V2p, 'V')].concat(ia),
        [t.three ? m("V_2' = V_{L,rated}/\\sqrt3 = " + t.V1 + '/\\sqrt3 = ' + PL(V2p, 0, 'V')) : m("V_2' = nV_2 = " + PL(V2p, 0, 'V')) + ' (rated output voltage, referred)'].concat(Ssteps).concat([m("|I_2'| = \\dfrac{S}{" + (t.three ? '3' : '') + "V_2'} = \\dfrac{" + N(L.S) + '}{' + (t.three ? '3\\times' : '') + N(V2p) + '} = ' + E(I2m, 'A')), m('\\phi = ' + (v === 'lead' ? '+' : v === 'lag' ? '-' : '') + '\\cos^{-1}(' + N(L.pf) + ') = ' + DG(L.phi)) + (v === 'lead' ? ' (leading: positive)' : v === 'lag' ? ' (lagging: negative)' : '')]), "I_2' = " + PL(I2m, L.phi, 'A')),
        P('(b) Find the required primary voltage' + (t.three ? ' (phase, then line)' : '') + '.', [ans('$|V_1|$', V1.abs(), 'V'), angA('$\\angle V_1$', V1.argd(), { abs: 0.1 })].concat(t.three ? [ans('$V_{1L}$', SQ3 * V1.abs(), 'V')] : []),
          ['KVL round the series branch (a phasor sum):'].concat(v1Steps(V2p, I2p, Zs, V1)).concat(t.three ? [m('V_{1L} = \\sqrt3|V_1| = ' + E(SQ3 * V1.abs(), 'V'))] : []), (t.three ? 'V_{1L} = ' + E(SQ3 * V1.abs(), 'V') : 'V_1 = ' + PZ(V1, 'V'))),
        P('(c) Find the voltage regulation.', [pctA('$VR$', VR, { abs: 0.03 })],
          ["At no load $V_2' = V_1$, so " + m("VR = 100\\dfrac{|V_1| - |V_2'|}{|V_2'|} = 100\\times\\dfrac{" + N(V1.abs()) + ' - ' + N(V2p) + '}{' + N(V2p) + '} = ' + N(VR, 3) + '\\%'), 'Check (approximate): ' + m("I_2'(R\\cos\\phi " + (v === 'lead' ? '-' : '+') + ' X\\sin|\\phi|)/V_2\' = ' + N(100 * approx / V2p, 3) + '\\%'), v === 'lead' && VR < 0 ? 'Negative: the leading current turns the $jXI_2\'$ drop so that it partly opposes $V_2\'$; the output rises on load.' : ''], 'VR = ' + N(VR, 3) + '\\%')];
      return Q('A ' + xName(t) + ' transformer has ' + m('R = ' + ohmT(t.R)) + ' and ' + m('X = ' + ohmT(t.X)) + (t.three ? ' per phase' : '') + ', referred to the primary (shunt branch at the input terminals). It supplies ' + L.txt + ' at rated output voltage.', xfig(t, { load: 'load' }), xGiven(t).concat([['load', L.txt]]), parts,
        trap('$V_1 = V_2\' + I_2\'(R+jX)$ is a phasor sum: go to rectangular form. ' + (v === 'lead' ? 'Leading means $\\angle I_2\' > 0$.' : 'Lagging means $\\angle I_2\' < 0$.')), data);
    }
  });

  ADD({
    id: 'mach.mag.regeff.efficiency', course: 'mach', module: 'mag', topic: 'regeff',
    title: 'Copper loss, iron loss and efficiency', difficulty: 2, marks: 6,
    variants: [{ id: 'params', label: 'From the circuit at a given load (needs V1)' }, { id: 'pin', label: 'Input power given (2023 quiz Q5)' }, { id: 'tests', label: 'From OC/SC test powers at two loads' }],
    tags: ['exam-style', 'Q2', '2023 quiz Q5', 'PQ 3.29(d)', 'M5 N1'],
    gen: function (r, v) {
      var t = xfmr(r, r.bool(0.5)), k = t.three ? 3 : 1, data = { v: v, three: t.three, V1: t.V1, S: t.S };
      if (v === 'tests') {
        var Pfe = sg(t.Vph * t.Vph / t.Rc * k, 3), Pcu = sg(t.Ir * t.Ir * t.R * k, 3), x1 = 1, x2 = r.pick([0.25, 0.5, 0.75]), pf = r.pick([0.8, 0.85, 0.9, 1]);
        var e1 = x1 * t.S * pf / (x1 * t.S * pf + Pcu + Pfe), e2 = x2 * t.S * pf / (x2 * t.S * pf + x2 * x2 * Pcu + Pfe);
        Object.assign(data, { Pfe: Pfe, Pcu: Pcu, x2: x2, pf: pf });
        return Q('A ' + xName(t) + ' transformer gives an open-circuit test power of ' + F.eng(Pfe, 'W') + ' at rated voltage and a short-circuit test power of ' + F.eng(Pcu, 'W') + ' at rated current. Assume rated output voltage.', null,
          [['$S$', F.eng(t.S, 'VA')], ['$P_{OC}$ (rated V)', F.eng(Pfe, 'W')], ['$P_{SC}$ (rated I)', F.eng(Pcu, 'W')], ['pf', String(pf)]],
          [P('(a) Find the efficiency at full load, ' + pf + ' pf.', [pctA('$\\eta_{FL}$', 100 * e1, { abs: 0.02 })], ['$P_{FE}$ = OC power (constant); $P_{CU,FL}$ = SC power at rated current.', m('P_{OUT} = S\\,\\text{pf} = ' + E(t.S * pf, 'W')), m('\\eta = \\dfrac{' + N(t.S * pf) + '}{' + N(t.S * pf) + ' + ' + N(Pcu) + ' + ' + N(Pfe) + '} = ' + N(100 * e1) + '\\%')], '\\eta_{FL} = ' + N(100 * e1) + '\\%'),
            P('(b) Find the efficiency at ' + x2 * 100 + ' % load, same pf.', [ans('$P_{CU}$', x2 * x2 * Pcu, 'W'), pctA('$\\eta$', 100 * e2, { abs: 0.02 })], ['Copper loss ∝ (load)²; iron loss is constant.', m('P_{CU} = ' + x2 + '^2\\times' + N(Pcu) + ' = ' + E(x2 * x2 * Pcu, 'W')), m('\\eta = \\dfrac{' + N(x2 * t.S * pf) + '}{' + N(x2 * t.S * pf) + ' + ' + N(x2 * x2 * Pcu) + ' + ' + N(Pfe) + '} = ' + N(100 * e2) + '\\%')], '\\eta = ' + N(100 * e2) + '\\%')], '', data);
      }
      if (v === 'pin') {
        var Vl = sg(t.V1 * r.float(0.98, 1.06, 3), 3), Vp = t.three ? Vl / SQ3 : Vl, I2 = sg(t.Ir * r.float(0.5, 1, 2), 3), pf2 = r.float(0.75, 0.95, 2);
        var PcuB = k * I2 * I2 * t.R, PfeB = k * Vp * Vp / t.Rc, Pin = sg(k * t.Vph * I2 * pf2 + PcuB + PfeB, 3), eta = (Pin - PcuB - PfeB) / Pin;
        Object.assign(data, { R: t.R, Rc: t.Rc, Vl: Vl, I2: I2, Pin: Pin });
        return Q('A ' + (t.three ? 'three-phase' : 'single-phase') + ' transformer has simplified' + (t.three ? ' single-phase' : '') + ' equivalent-circuit parameters referred to the primary: ' + m('X_M = ' + ohmT(t.Xm) + ',\\ R_C = ' + ohmT(t.Rc) + ',\\ R = ' + ohmT(t.R) + ',\\ X = ' + ohmT(t.X)) + '. Under one operating condition the primary voltage is ' + F.eng(Vl, 'V') + (t.three ? ' (line)' : '') + ', the secondary current referred to the primary is ' + F.eng(I2, 'A') + ' and the input power is ' + F.eng(Pin, 'W') + '.', xfig(t), xGiven(t).concat([['$V_1$', F.eng(Vl, 'V')], ["$I_2'$", F.eng(I2, 'A')], ['$P_{IN}$', F.eng(Pin, 'W')]]),
          [P('Find the copper loss, the iron loss and the efficiency.', [ans('$P_{CU}$', PcuB, 'W'), ans('$P_{FE}$', PfeB, 'W'), pctA('$\\eta$', 100 * eta, { abs: 0.02 })], (t.three ? ['Assume star: ' + m('V_1 = ' + N(Vl) + '/\\sqrt3 = ' + E(Vp, 'V'))] : []).concat([m("P_{CU} = " + (t.three ? '3' : '') + "I_2'^2R = " + (t.three ? '3' : '') + '(' + N(I2) + ')^2(' + N(t.R) + ') = ' + E(PcuB, 'W')), m('P_{FE} = ' + (t.three ? '3' : '') + 'V_1^2/R_C = ' + E(PfeB, 'W')), 'The input is given, so subtract the losses: ' + m('\\eta = \\dfrac{P_{IN} - P_{CU} - P_{FE}}{P_{IN}} = ' + N(100 * eta) + '\\%')]), '\\eta = ' + N(100 * eta) + '\\%')],
          trap('Use $I_2\'$ (not $I_1$) for copper loss and $V_1$ for iron loss. Do not forget the factor 3.'), data);
      }
      var pfP = r.pick([0.8, 0.85, 0.87, 0.9, 1]), x = r.pick([1, 0.75, 0.5]), S = x * t.S, I2m = S / (k * t.Vph), phi = -acosd(pfP), I2p = CX.polar(I2m, phi), V1 = CX(t.Vph, 0).add(I2p.mul(CX(t.R, t.X)));
      var Pcu2 = k * I2m * I2m * t.R, Pfe2 = k * V1.abs() * V1.abs() / t.Rc, Po = S * pfP, eta2 = Po / (Po + Pcu2 + Pfe2);
      Object.assign(data, { R: t.R, X: t.X, Rc: t.Rc, x: x, pf: pfP });
      return Q('A ' + xName(t) + ' transformer has ' + m('R = ' + ohmT(t.R) + ',\\ X = ' + ohmT(t.X) + ',\\ R_C = ' + ohmT(t.Rc)) + (t.three ? ' per phase' : '') + ', referred to the primary. It delivers ' + (x === 1 ? 'rated load' : x * 100 + ' % of rated kVA') + ' at ' + (pfP === 1 ? 'unity pf' : pfP + ' pf lagging') + ' at rated output voltage.', xfig(t), xGiven(t).concat([['load', x * 100 + ' % at ' + pfP]]),
        [P('(a) Find $I_2\'$ and the primary voltage $V_1$' + (t.three ? ' (per phase)' : '') + '.', [ans("$|I_2'|$", I2m, 'A'), ans('$|V_1|$', V1.abs(), 'V')], [m("V_2' = " + PL(t.Vph, 0, 'V') + ",\\ |I_2'| = " + E(I2m, 'A') + ',\\ \\phi = ' + DG(phi))].concat(v1Steps(t.Vph, I2p, CX(t.R, t.X), V1)), '|V_1| = ' + E(V1.abs(), 'V')),
          P('(b) Find the output power, copper loss, iron loss and efficiency.', [ans('$P_{OUT}$', Po, 'W'), ans('$P_{CU}$', Pcu2, 'W'), ans('$P_{FE}$', Pfe2, 'W'), pctA('$\\eta$', 100 * eta2, { abs: 0.02 })],
            [m('P_{OUT} = S\\,\\text{pf} = ' + E(Po, 'W')), m("P_{CU} = " + (t.three ? '3' : '') + "|I_2'|^2R = " + E(Pcu2, 'W')), m('P_{FE} = ' + (t.three ? '3' : '') + '|V_1|^2/R_C = ' + E(Pfe2, 'W')) + ' (use $V_1$: $R_C$ is at the input)', m('\\eta = \\dfrac{P_{OUT}}{P_{OUT}+P_{CU}+P_{FE}} = ' + N(100 * eta2) + '\\%')], '\\eta = ' + N(100 * eta2) + '\\%')],
        '', data);
    }
  });

  ADD({
    id: 'mach.mag.regeff.max-eff', course: 'mach', module: 'mag', topic: 'regeff',
    title: 'Load for maximum efficiency', difficulty: 2, marks: 4,
    variants: [{ id: 'tests', label: 'From test (loss) powers' }, { id: 'params', label: 'From R and R_C' }, { id: 'two-loads', label: 'From efficiencies at two loads' }],
    tags: ['exam-style', 'Q2', 'mock Q2c(iv)', 'M5 N4(d)'],
    gen: function (r, v) {
      var t = xfmr(r, r.bool(0.5)), k = t.three ? 3 : 1, pf = r.pick([0.8, 0.85, 0.9, 1]), data = { v: v, S: t.S, pf: pf };
      var Pfe, Pcu, pre = [];
      if (v === 'params') {
        Pfe = k * t.Vph * t.Vph / t.Rc; Pcu = k * t.Ir * t.Ir * t.R; Object.assign(data, { three: t.three, V1: t.V1, R: t.R, Rc: t.Rc });
        pre = [m('P_{FE} = ' + (t.three ? '3' : '') + 'V_1^2/R_C = ' + (t.three ? '3\\times' : '') + N(t.Vph) + '^2/' + N(t.Rc) + ' = ' + E(Pfe, 'W')), m('I_{rated} = ' + E(t.Ir, 'A') + ',\\ P_{CU,FL} = ' + (t.three ? '3' : '') + 'I^2R = ' + E(Pcu, 'W'))];
      } else if (v === 'tests') {
        Pfe = sg(k * t.Vph * t.Vph / t.Rc, 3); Pcu = sg(k * t.Ir * t.Ir * t.R, 3); data.Pfe = Pfe; data.Pcu = Pcu;
        pre = ['Iron loss = OC power at rated V; full-load copper loss = SC power at rated current.'];
      } else {
        var PfeT = k * t.Vph * t.Vph / t.Rc, PcuT = k * t.Ir * t.Ir * t.R, xh = 0.5;
        var e1 = sg(100 * t.S * pf / (t.S * pf + PfeT + PcuT), 4), e2 = sg(100 * xh * t.S * pf / (xh * t.S * pf + PfeT + xh * xh * PcuT), 4);
        var L1 = t.S * pf * (100 / e1 - 1), L2 = xh * t.S * pf * (100 / e2 - 1);
        Pcu = (L1 - L2) / (1 - xh * xh); Pfe = L1 - Pcu;
        if (Pfe <= 0 || Pcu <= 0) return null;
        Object.assign(data, { e1: e1, e2: e2 });
        pre = [m('\\text{losses}_{FL} = P_{OUT}(1/\\eta - 1) = ' + N(t.S * pf) + '(100/' + e1 + ' - 1) = ' + E(L1, 'W') + ' = P_{FE} + P_{CU}'), m('\\text{losses}_{HL} = ' + N(xh * t.S * pf) + '(100/' + e2 + ' - 1) = ' + E(L2, 'W') + ' = P_{FE} + 0.25P_{CU}'), m('P_{CU} = \\dfrac{' + N(L1) + ' - ' + N(L2) + '}{0.75} = ' + E(Pcu, 'W') + ',\\ P_{FE} = ' + E(Pfe, 'W'))];
      }
      var x = Math.sqrt(Pfe / Pcu), Sx = x * t.S, em = Sx * pf / (Sx * pf + 2 * Pfe);
      var stem = v === 'two-loads' ? 'A ' + xName(t) + ' transformer has an efficiency of ' + data.e1 + ' % at full load and ' + data.e2 + ' % at half load, both at ' + pf + ' pf and rated voltage.' :
        v === 'tests' ? 'A ' + xName(t) + ' transformer has an iron loss of ' + F.eng(Pfe, 'W') + ' at rated voltage (OC test) and a full-load copper loss of ' + F.eng(Pcu, 'W') + ' (SC test at rated current).' :
          'A ' + xName(t) + ' transformer has ' + m('R = ' + ohmT(t.R)) + ' and ' + m('R_C = ' + ohmT(t.Rc)) + (t.three ? ' per phase' : '') + ', referred to the primary.';
      var parts = [];
      if (v === 'two-loads') parts.push(P('(a) Find the iron loss and the full-load copper loss.', [ans('$P_{FE}$', Pfe, 'W'), ans('$P_{CU,FL}$', Pcu, 'W')], pre, 'P_{FE} = ' + E(Pfe, 'W'))), pre = [];
      parts.push(P((v === 'two-loads' ? '(b)' : '(a)') + ' Find the load (kVA, and as a fraction of rated) at which the efficiency is greatest.', [ans('$x$', x, ''), ans('$S$', Sx, 'VA')], pre.concat(['Maximum efficiency where copper loss = iron loss: ' + m('x^2P_{CU,FL} = P_{FE} \\Rightarrow x = \\sqrt{' + N(Pfe) + '/' + N(Pcu) + '} = ' + N(x)), m('S = xS_{rated} = ' + E(Sx, 'VA'))]), 'S = ' + E(Sx, 'VA')));
      parts.push(P((v === 'two-loads' ? '(c)' : '(b)') + ' Find the maximum efficiency at ' + pf + ' pf.', [pctA('$\\eta_{max}$', 100 * em, { abs: 0.02 })], [m('\\eta_{max} = \\dfrac{xS\\,\\text{pf}}{xS\\,\\text{pf} + 2P_{FE}} = \\dfrac{' + N(Sx * pf) + '}{' + N(Sx * pf) + ' + 2\\times' + N(Pfe) + '} = ' + N(100 * em) + '\\%')], '\\eta_{max} = ' + N(100 * em) + '\\%'));
      return Q(stem, null, [['$S_{rated}$', F.eng(t.S, 'VA')], ['pf', String(pf)]], parts, tip('The peak is not at rated load unless the two losses happen to be equal there.'), data);
    }
  });

  ADD({
    id: 'mach.mag.regeff.all-day', course: 'mach', module: 'mag', topic: 'regeff',
    title: 'All-day (energy) efficiency over a load cycle', difficulty: 3, marks: 6,
    variants: [{ id: 'two-level', label: 'Two load levels' }, { id: 'three-level', label: 'Three periods including no load' }],
    tags: ['distribution transformer'],
    gen: function (r, v) {
      var S = r.pick([25, 50, 100, 200, 315, 500]) * 1e3, Pfe = sg(S * r.float(0.002, 0.006, 4), 3), Pcu = sg(S * r.float(0.008, 0.02, 4), 3);
      var per = v === 'two-level' ? [{ h: r.pick([6, 8, 10, 12]), x: r.pick([0.8, 1, 1.1]), pf: r.pick([0.8, 0.85, 0.9]) }] : [{ h: r.pick([4, 6, 8]), x: r.pick([1, 1.2]), pf: r.pick([0.8, 0.85]) }, { h: r.pick([6, 8, 10]), x: r.pick([0.4, 0.5, 0.6]), pf: r.pick([0.9, 0.95, 1]) }];
      var used = per.reduce(function (a, p) { return a + p.h; }, 0);
      if (v === 'two-level') per.push({ h: 24 - used, x: r.pick([0.2, 0.25, 0.3]), pf: r.pick([0.9, 0.95]) }); else per.push({ h: 24 - used, x: 0, pf: 1 });
      var Wout = 0, Wcu = 0, Wfe = 24 * Pfe;
      per.forEach(function (p) { Wout += p.x * S * p.pf * p.h; Wcu += p.x * p.x * Pcu * p.h; });
      var eta = Wout / (Wout + Wcu + Wfe), p0 = per[0], etaFL = S * p0.pf / (S * p0.pf + Pcu + Pfe);
      var fig = figProfile(per.map(function (p) { return { h: p.h, x: p.x, lab: p.x + ' FL, ' + p.pf }; }));
      var desc = per.map(function (p) { return p.x > 0 ? p.h + ' h at ' + (p.x * 100) + ' % of rating, ' + p.pf + ' pf' : p.h + ' h on no load'; }).join('; ');
      return Q('A ' + F.eng(S, 'VA') + ' distribution transformer has an iron loss of ' + F.eng(Pfe, 'W') + ' and a full-load copper loss of ' + F.eng(Pcu, 'W') + '. It stays energised all day with this daily cycle: ' + desc + '.', fig,
        [['$S$', F.eng(S, 'VA')], ['$P_{FE}$', F.eng(Pfe, 'W')], ['$P_{CU,FL}$', F.eng(Pcu, 'W')]],
        [P('(a) Find the energy delivered in a day, and the daily copper-loss and iron-loss energy.', [ans('$W_{out}$', Wout, 'Wh'), ans('$W_{CU}$', Wcu, 'Wh'), ans('$W_{FE}$', Wfe, 'Wh')],
          per.filter(function (p) { return p.x > 0; }).map(function (p) { return m(p.h + '\\ \\text{h}: W_{out} = ' + p.x + '\\times' + N(S) + '\\times' + p.pf + '\\times' + p.h + ' = ' + E(p.x * S * p.pf * p.h, 'Wh') + ',\\quad W_{CU} = ' + p.x + '^2\\times' + N(Pcu) + '\\times' + p.h + ' = ' + E(p.x * p.x * Pcu * p.h, 'Wh')); })
            .concat([m('W_{out} = ' + E(Wout, 'Wh') + ',\\ W_{CU} = ' + E(Wcu, 'Wh')), 'The core is energised for all 24 h: ' + m('W_{FE} = 24\\times' + N(Pfe) + ' = ' + E(Wfe, 'Wh'))]), 'W_{out} = ' + E(Wout, 'Wh')),
          P('(b) Find the all-day efficiency, and compare it with the efficiency at full load and ' + p0.pf + ' pf.', [pctA('$\\eta_{all-day}$', 100 * eta, { abs: 0.02 }), pctA('$\\eta_{FL}$', 100 * etaFL, { abs: 0.02 })],
            [m('\\eta_{all-day} = \\dfrac{W_{out}}{W_{out} + W_{CU} + W_{FE}} = \\dfrac{' + N(Wout) + '}{' + N(Wout) + ' + ' + N(Wcu) + ' + ' + N(Wfe) + '} = ' + N(100 * eta) + '\\%'), m('\\eta_{FL} = \\dfrac{' + N(S * p0.pf) + '}{' + N(S * p0.pf) + ' + ' + N(Pcu) + ' + ' + N(Pfe) + '} = ' + N(100 * etaFL) + '\\%'), 'The all-day value is lower because the iron loss runs for 24 h even when the load is light. Distribution transformers are therefore designed for low iron loss.'], '\\eta_{all-day} = ' + N(100 * eta) + '\\%')],
        tip('All-day efficiency is an energy ratio: integrate the output and both losses over 24 h.'), { v: v, S: S, Pfe: Pfe, Pcu: Pcu, per: per });
    }
  });

  /* ---------- mag.tx3ph ---------- */
  ADD({
    id: 'mach.mag.tx3ph.connections', course: 'mach', module: 'mag', topic: 'tx3ph',
    title: 'Three-phase transformer connections: line and phase quantities', difficulty: 2, marks: 6,
    variants: [{ id: 'Yy', label: 'Star–star (Yy)' }, { id: 'Yd', label: 'Star–delta (Yd)' }, { id: 'Dy', label: 'Delta–star (Dy)' }, { id: 'Dd', label: 'Delta–delta (Dd)' }],
    tags: ['3-phase transformers'],
    gen: function (r, v) {
      var S = r.pick([100, 250, 500, 1000, 2000, 5000]) * 1e3, pr = r.pick([[11000, 415], [11000, 433], [33000, 11000], [6600, 415], [22000, 400], [3300, 415]]), VH = pr[0], VL = pr[1];
      var hv = v[0] === 'Y' ? 'Y' : 'D', lv = v[1] === 'y' ? 'Y' : 'D';
      var VpH = hv === 'Y' ? VH / SQ3 : VH, VpL = lv === 'Y' ? VL / SQ3 : VL, ILH = S / (SQ3 * VH), ILL = S / (SQ3 * VL), IpH = hv === 'Y' ? ILH : ILH / SQ3, IpL = lv === 'Y' ? ILL : ILL / SQ3, a = VpH / VpL;
      function cv(c, VLx, Vp) { return c === 'Y' ? m('V_{ph} = V_L/\\sqrt3 = ' + N(VLx) + '/\\sqrt3 = ' + E(Vp, 'V')) : m('V_{ph} = V_L = ' + E(Vp, 'V')); }
      function ci(c, IL, Ip) { return c === 'Y' ? m('I_{ph} = I_L = ' + E(Ip, 'A')) : m('I_{ph} = I_L/\\sqrt3 = ' + E(Ip, 'A')); }
      var nm = { Y: 'star', D: 'delta' };
      return Q('A three-phase ' + F.eng(S, 'VA') + ', ' + F.eng(VH, 'V') + '/' + F.eng(VL, 'V') + ' (line) transformer has its HV winding in <b>' + nm[hv] + '</b> and its LV winding in <b>' + nm[lv] + '</b>. It runs at rated load.', figConn(hv, lv === 'Y' ? 'Y' : 'D', { hvV: F.eng(VH, 'V') + ' line', lvV: F.eng(VL, 'V') + ' line', mid: v }),
        [['$S$', F.eng(S, 'VA')], ['$V_{L,HV}/V_{L,LV}$', F.eng(VH, 'V') + ' / ' + F.eng(VL, 'V')], ['connection', v]],
        [P('(a) Find the phase (winding) voltage on each side and the turns ratio per phase $N_1/N_2$.', [ans('$V_{ph,HV}$', VpH, 'V'), ans('$V_{ph,LV}$', VpL, 'V'), ans('$N_1/N_2$', a, '')],
          ['HV ' + nm[hv] + ': ' + cv(hv, VH, VpH), 'LV ' + nm[lv] + ': ' + cv(lv, VL, VpL), 'Each winding pair shares one limb, so the turns ratio is the ratio of <b>phase</b> voltages: ' + m('N_1/N_2 = ' + N(VpH) + '/' + N(VpL) + ' = ' + N(a)) + (hv !== lv ? ' (not the line ratio ' + N(VH / VL) + ')' : '')], 'N_1/N_2 = ' + N(a)),
          P('(b) Find the line and winding currents on both sides at rated load.', [ans('$I_{L,HV}$', ILH, 'A'), ans('$I_{ph,HV}$', IpH, 'A'), ans('$I_{L,LV}$', ILL, 'A'), ans('$I_{ph,LV}$', IpL, 'A')],
            [m('I_{L} = \\dfrac{S}{\\sqrt3V_L}:\\quad I_{L,HV} = ' + E(ILH, 'A') + ',\\ I_{L,LV} = ' + E(ILL, 'A')), 'HV: ' + ci(hv, ILH, IpH), 'LV: ' + ci(lv, ILL, IpL), 'Check: ' + m('I_{ph,LV}/I_{ph,HV} = ' + N(IpL / IpH) + ' = N_1/N_2')], 'I_{ph,LV} = ' + E(IpL, 'A'))],
        trap('For Yd and Dy the per-phase turns ratio differs from the line-voltage ratio by $\\sqrt3$.'), { v: v, S: S, VH: VH, VL: VL });
    }
  });

  ADD({
    id: 'mach.mag.tx3ph.open-circuit', course: 'mach', module: 'mag', topic: 'tx3ph',
    title: 'Three-phase transformer on open circuit, and halving the voltage', difficulty: 2, marks: 8,
    variants: [{ id: 'star', label: 'Star primary (Jun24 Q2c)' }, { id: 'delta', label: 'Delta primary' }],
    tags: ['exam-style', 'Q2', 'Jun24 Q2c', 'M5 N3'],
    gen: function (r, v) {
      var t = xfmr(r, true), a = r.float(0.4, 0.6, 2), b = r.float(0.4, 0.6, 2), R1 = sg(t.R * a, 2), R2 = sg(t.R * (1 - a), 2), X1 = sg(t.X * b, 2), X2 = sg(t.X * (1 - b), 2);
      var star = v === 'star', Vp = star ? t.V1 / SQ3 : t.V1, Rc = star ? t.Rc : sg(t.Rc * 3, 3), Xm = star ? t.Xm : sg(t.Xm * 3, 3);
      var Y = CX(1 / Rc, -1 / Xm), Z = Y.inv(), I = Vp / Z.abs(), IL = star ? I : SQ3 * I, Pt = 3 * Vp * Vp / Rc, Qt = 3 * Vp * Vp / Xm, pf = Math.cos(Z.arg());
      var data = { v: v, V1: t.V1, S: t.S, R1: R1, R2: R2, X1: X1, X2: X2, Rc: Rc, Xm: Xm };
      return Q('A three-phase ' + F.eng(t.S, 'VA') + ', ' + F.eng(t.V1, 'V') + '/' + F.eng(t.V2, 'V') + ' transformer has a <b>' + (star ? 'star' : 'delta') + '</b>-connected primary. Its per-phase parameters (referred to the primary where appropriate) are ' + m('R_1 = ' + N(R1) + ',\\ R_2\' = ' + N(R2) + ',\\ X_1 = ' + N(X1) + ',\\ X_2\' = ' + N(X2) + ',\\ X_M = ' + N(Xm) + ',\\ R_C = ' + N(Rc) + '\\ \\Omega') + '.',
        figEquiv({ Rc: pv(Rc, 'Ω'), Xm: 'j' + pv(Xm, 'Ω'), R: pv(R1 + R2, 'Ω'), X: 'j' + pv(X1 + X2, 'Ω'), note: 'per phase; secondary open' }),
        [['rating', F.eng(t.S, 'VA') + ', ' + F.eng(t.V1, 'V') + '/' + F.eng(t.V2, 'V')], ['primary', star ? 'star' : 'delta'], ['$R_1, R_2\'$', R1 + ', ' + R2 + ' Ω'], ['$X_1, X_2\'$', X1 + ', ' + X2 + ' Ω'], ['$X_M$, $R_C$', Xm + ', ' + Rc + ' Ω']],
        [P('(i) Find the series R and X of the simplified circuit.', [ans('$R$', R1 + R2, 'Ω'), ans('$X$', X1 + X2, 'Ω')], [m("R = R_1 + R_2' = " + ohmT(R1 + R2) + ",\\ X = X_1 + X_2' = " + ohmT(X1 + X2)), 'The shunt branch $R_C \\parallel jX_M$ goes across the input.'], 'R + jX = ' + N(R1 + R2) + ' + j' + N(X1 + X2) + '\\ \\Omega'),
          P('(ii) With rated voltage and the secondary open, find the phase and line input currents, the total input power and the pf.', [ans('$I_{ph}$', I, 'A'), ans('$I_L$', IL, 'A'), ans('$P$', Pt, 'W'), ans('pf', pf, '')],
            [star ? m('V_1 = V_L/\\sqrt3 = ' + E(Vp, 'V')) : m('V_1 = V_L = ' + E(Vp, 'V')) + ' (delta phase)', 'On open circuit no current flows in $R + jX$:', m('Z = R_C\\parallel jX_M = \\dfrac{1}{1/' + N(Rc) + ' + 1/(j' + N(Xm) + ')} = ' + PZ(Z, 'Ω')), m('I_{ph} = V_1/|Z| = ' + E(I, 'A')) + (star ? ', and ' + m('I_L = I_{ph}') : ', ' + m('I_L = \\sqrt3I_{ph} = ' + E(IL, 'A'))), m('P = 3V_1^2/R_C = ' + E(Pt, 'W') + ',\\ Q = 3V_1^2/X_M = ' + E(Qt, 'VAr')), m('\\text{pf} = \\cos(' + DG(Z.argd()) + ') = ' + N(pf) + '\\ \\text{lag}')], 'I_L = ' + E(IL, 'A') + ',\\ P = ' + E(Pt, 'W')),
          P('(iii) If the input voltage is halved, by what factor do the input current, real power, reactive power and pf change?', [ans('×I', 0.5, ''), ans('×P', 0.25, ''), ans('×Q', 0.25, ''), ans('×pf', 1, '')],
            ['With constant $R_C$ and $X_M$: ' + m('I = V/|Z| \\Rightarrow \\times0.5;\\ P = 3V^2/R_C \\Rightarrow \\times0.25;\\ Q \\Rightarrow \\times0.25;\\ \\text{pf} = \\cos\\angle Z \\Rightarrow \\times1'), 'In a real core at half voltage the flux is further below the knee, $X_M$ rises, and the current falls by <b>more</b> than half.'], '\\times0.5,\\ \\times0.25,\\ \\times0.25,\\ \\times1')],
        trap('Do not include R + jX in the open-circuit calculation.'), data);
    }
  });

  ADD({
    id: 'mach.mag.tx3ph.per-phase-test', course: 'mach', module: 'mag', topic: 'tx3ph',
    title: 'Three-phase test readings to per-phase parameters (star or delta)', difficulty: 2, marks: 5,
    variants: [{ id: 'star', label: 'Star-connected primary' }, { id: 'delta', label: 'Delta-connected primary' }],
    tags: ['2024 test Q6', 'PQ 3.31'],
    gen: function (r, v) {
      var t = xfmr(r, true), star = v === 'star', Rp = star ? t.R : sg(3 * t.R, 3), Xp = star ? t.X : sg(3 * t.X, 3), Rcp = star ? t.Rc : sg(3 * t.Rc, 3), Xmp = star ? t.Xm : sg(3 * t.Xm, 3);
      var Vph = star ? t.V1 / SQ3 : t.V1, Iph = star ? t.Ir : t.Ir / SQ3;
      var Isc = sg(t.Ir, 4), IphS = star ? Isc : Isc / SQ3, VphS = IphS * Math.hypot(Rp, Xp), Vsc = sg(star ? VphS * SQ3 : VphS, 3), Psc = sg(3 * IphS * IphS * Rp, 3);
      var Voc = t.V1, IphO = Vph * Math.hypot(1 / Rcp, 1 / Xmp), Ioc = sg(star ? IphO : IphO * SQ3, 3), Poc = sg(3 * Vph * Vph / Rcp, 3);
      var vS = star ? Vsc / SQ3 : Vsc, iS = star ? Isc : Isc / SQ3, pS = Psc / 3, sS = vS * iS, qS = Math.sqrt(sS * sS - pS * pS), R = pS / (iS * iS), X = qS / (iS * iS);
      var vO = star ? Voc / SQ3 : Voc, iO = star ? Ioc : Ioc / SQ3, pO = Poc / 3, sO = vO * iO, qO = Math.sqrt(Math.max(sO * sO - pO * pO, 1e-9)), Rc = vO * vO / pO, Xm = vO * vO / qO;
      var conv = star ? m('V_{ph} = V_L/\\sqrt3,\\ I_{ph} = I_L,\\ P_{ph} = P/3') : m('V_{ph} = V_L,\\ I_{ph} = I_L/\\sqrt3,\\ P_{ph} = P/3');
      var data = { v: v, V1: t.V1, S: t.S, Vsc: Vsc, Isc: Isc, Psc: Psc, Voc: Voc, Ioc: Ioc, Poc: Poc };
      return Q('A three-phase ' + F.eng(t.S, 'VA') + ', ' + F.eng(t.V1, 'V') + '/' + F.eng(t.V2, 'V') + ' transformer has a <b>' + (star ? 'star' : 'delta') + '</b>-connected primary. Line readings on the primary:<br>• SC test: ' + F.eng(Vsc, 'V') + ', ' + F.eng(Isc, 'A') + ', ' + F.eng(Psc, 'W') + ' (total).<br>• OC test: ' + F.eng(Voc, 'V') + ', ' + F.eng(Ioc, 'A') + ', ' + F.eng(Poc, 'W') + ' (total).', figConn(star ? 'Y' : 'D', 'Y', { hvV: 'tests on this side', lvV: '' }),
        [['SC (line)', F.eng(Vsc, 'V') + ', ' + F.eng(Isc, 'A') + ', ' + F.eng(Psc, 'W')], ['OC (line)', F.eng(Voc, 'V') + ', ' + F.eng(Ioc, 'A') + ', ' + F.eng(Poc, 'W')], ['primary', star ? 'star' : 'delta']],
        [P('(a) Find the winding resistance R and leakage reactance X per ' + (star ? 'phase' : 'delta phase') + '.', [ans('$R$', R, 'Ω'), ans('$X$', X, 'Ω')], ['Convert to per-phase (winding) values first: ' + conv, m('V_{ph} = ' + E(vS, 'V') + ',\\ I_{ph} = ' + E(iS, 'A') + ',\\ P_{ph} = ' + E(pS, 'W')), m('R = P/I^2 = ' + ohmT(R)), m('|Z| = V/I = ' + ohmT(vS / iS) + ',\\ X = \\sqrt{|Z|^2 - R^2} = ' + ohmT(X))], 'R = ' + ohmT(R) + ',\\ X = ' + ohmT(X)),
          P('(b) Find $R_C$ and $X_M$ per phase.', [ans('$R_C$', Rc, 'Ω'), ans('$X_M$', Xm, 'Ω')], [m('V_{ph} = ' + E(vO, 'V') + ',\\ I_{ph} = ' + E(iO, 'A') + ',\\ P_{ph} = ' + E(pO, 'W')), m('S = ' + E(sO, 'VA') + ',\\ Q = ' + E(qO, 'VAr')), m('R_C = V^2/P = ' + ohmT(Rc) + ',\\ X_M = V^2/Q = ' + ohmT(Xm))], 'R_C = ' + ohmT(Rc) + ',\\ X_M = ' + ohmT(Xm)),
          P('(c) Check: is the SC test at rated current?', [ans('$I_{L,rated}$', t.S / (SQ3 * t.V1), 'A')], [m('I_{L,rated} = S/(\\sqrt3V_L) = ' + E(t.S / (SQ3 * t.V1), 'A')) + ' — the test current matches, so ' + m('P_{SC}') + ' is the full-load copper loss.'], 'I_{L,rated} = ' + E(t.S / (SQ3 * t.V1), 'A'))],
        trap(star ? 'Star: divide V by √3 and P by 3; I stays.' : 'Delta: V stays, divide I by √3 and P by 3. Getting this wrong puts R out by 3.'), data);
    }
  });

})();

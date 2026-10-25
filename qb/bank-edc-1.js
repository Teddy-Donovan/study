/* bank-edc-1.js — EDC question bank, part 1 (Module 1 Diodes, Module 2 BJTs)
 * =============================================================================
 * Course `edc`, modules `diode` (semi, models, dcct, rect, zener, clip) and
 * `bjt` (modes, bias, bias2, ss, ss2, multi). Boylestad notation throughout:
 * r_e = 26 mV / I_E, βr_e, Z_i, Z_o, A_v, A_vL, A_vs; V_T = kT/q with
 * T_K = T(°C) + 273 for the diode exponential (packs E1–E8, EPT, EX1, EX2).
 * Each generator also returns `data` (the raw inputs) so the Python
 * cross-check in tests/test-edc-1.py can recompute every answer.
 * Figures: BJT templates from qb-sch.js (guarded); diode circuits are drawn
 * here with the low-level QB.sch.drawing() API so the structure is exact.
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB;
  if (!QB || !QB.add) return;
  var S = QB.sch || {};
  var F = QB.fmt, TX = F.tex;
  var KB = 1.38e-23, QE = 1.6e-19, KEV = 8.62e-5;

  /* ------------------------------------------------------------ helpers */
  function te(x, u, s) { return TX.eng(x, u || '', s || 3); }     // TeX value + unit
  function tn(x, s) { return TX.num(x, s || 3); }                  // TeX number
  function pe(x, u, s) { return F.eng(x, u || '', s || 3); }       // plain value + unit
  function pn(x, s) { return F.num(x, s || 3); }
  function A(label, value, unit, o) { var a = { label: label, value: value, unit: unit || '' }; if (o) for (var k in o) a[k] = o[k]; return a; }
  function st(arr) { return QB.steps(arr); }
  function fin(t) { return QB.final(t); }
  function par() { return QB.par.apply(null, arguments); }
  function VTof(Tc) { return KB * (Tc + 273) / QE; }
  function sgn(x) { return x < 0 ? '-' : '+'; }
  function abs(x) { return Math.abs(x); }
  function mode(name) { return { active: 1, saturation: 2, cutoff: 3 }[name]; }
  var MODEQ = 'Enter 1 for active, 2 for saturation, 3 for cut-off.';
  function modeAns(lbl, m) { return A(lbl, mode(m), '', { tol: 0, abs: 0.4, sig: 1, hint: '1 = active, 2 = saturation, 3 = cut-off' }); }
  function tmpl(name, o) { return S[name] ? S[name](o) : null; }    // guarded template call
  function drw() { return S.drawing ? S.drawing() : null; }
  function svg(d, title) { return d ? d.svg({ title: title }) : null; }
  function R(x) { return pe(x, 'Ω'); }
  function V(x) { return pe(x, 'V'); }
  function rr(r, lo, hi, ser) { return r.eseries(ser || 'E12', lo, hi); }
  function c2(x) { return Math.round(x * 100) / 100; }
  function ok(x) { return typeof x === 'number' && isFinite(x); }

  /* ------------------------------------------------------------ figure builders (diodes) */
  // vertical dc source between (x,yb) and (x,yt); positive value => + at top
  function dcSrc(d, x, yt, yb, label, v) {
    if (Math.abs(v) < 1e-12) { d.line([x, yt], [x, yb]); d.ground([x, yb]); return; }
    if (v > 0) d.vsrc({ from: [x, yb], to: [x, yt], label: label, value: V(v), side: 'left' });
    else d.vsrc({ from: [x, yt], to: [x, yb], label: label, value: V(-v), side: 'left' });
    d.ground([x, yb]);
  }
  /** series string: V1 - R1 - A - [RA to gnd] - diodes - B(Vo) - R2 - V2 */
  function figSeries(p) {
    var d = drw(); if (!d) return null;
    var yt = 50, gy = 190, x = 40;
    dcSrc(d, x, yt, gy, 'V_1', p.V1);
    d.resistor({ from: [x, yt], to: [x + 110, yt], label: 'R_1', value: R(p.R1) });
    x += 110; var xA = x;
    d.dot([xA, yt]); d.labelNear([xA, yt], 'A', { prefer: ['top'], gap: 8 });
    if (p.RA) { d.resistor({ from: [xA, yt], to: [xA, gy], label: 'R_A', value: R(p.RA), side: 'left' }); d.ground([xA, gy]); }
    d.line([xA, yt], [xA + 20, yt]); x = xA + 20;
    p.diodes.forEach(function (dd, i) {
      var a = [x, yt], b = [x + 60, yt];
      d.diode({ from: dd.dir > 0 ? a : b, to: dd.dir > 0 ? b : a, label: 'D_' + (i + 1), value: dd.mat, side: 'top' });
      x += 60;
    });
    d.line([x, yt], [x + 20, yt]); x += 20;
    var xB = x; d.dot([xB, yt]);
    d.line([xB, yt], [xB, yt + 40]); d.terminal([xB, yt + 40], { label: 'V_o', side: 'bottom' });
    d.resistor({ from: [xB, yt], to: [xB + 110, yt], label: 'R_2', value: R(p.R2) });
    dcSrc(d, xB + 110, yt, gy, 'V_2', p.V2);
    return svg(d, 'Series diode string');
  }
  /** parallel pair: V1 - R1 - [series diode] - A - (DA || DB) - B(Vo) - R2 - V2 */
  function figParallel(p) {
    var d = drw(); if (!d) return null;
    var yt = 70, gy = 200, x = 40;
    dcSrc(d, x, yt, gy, 'V_1', p.V1);
    d.resistor({ from: [x, yt], to: [x + 110, yt], label: 'R_1', value: R(p.R1) });
    x += 110;
    if (p.Dser) { d.diode({ from: [x, yt], to: [x + 60, yt], label: 'D_s', value: p.Dser, side: 'top' }); x += 60; }
    d.line([x, yt], [x + 20, yt]); x += 20;
    var xA = x; d.dot([xA, yt]);
    d.line([xA, yt - 30], [xA, yt + 30]);
    d.diode({ from: [xA, yt - 30], to: [xA + 70, yt - 30], label: 'D_1', value: p.Da, side: 'top' });
    d.diode({ from: [xA, yt + 30], to: [xA + 70, yt + 30], label: 'D_2', value: p.Db, side: 'bottom' });
    var xB = xA + 70; d.line([xB, yt - 30], [xB, yt + 30]); d.dot([xB, yt]);
    d.line([xB, yt], [xB + 30, yt]); d.dot([xB + 30, yt]);
    d.labelNear([xB + 30, yt], 'V_o', { prefer: ['top'], gap: 8 });
    d.resistor({ from: [xB + 30, yt], to: [xB + 30, gy], label: 'R_2', value: R(p.R2), side: 'right' });
    dcSrc(d, xB + 30, gy, gy + 90, 'V_2', p.V2 || 0);
    return svg(d, 'Parallel diodes');
  }
  /** single-node diode network. branches: [{type:'src'|'diode'|'res', E, R, s, label, rD}] around node at top */
  function figNode(p) {
    var d = drw(); if (!d) return null;
    var yt = 50, yb = 230, xs = 40;
    var src = p.branches.filter(function (b) { return b.feed; });
    var down = p.branches.filter(function (b) { return !b.feed; });
    // feeding branches drawn on the left as source - R - (diode) - node
    var xN = 40 + 230;
    src.forEach(function (b, i) {
      var y = yt + i * 100;
      dcSrc(d, xs, y, y + 80, b.Elabel, b.E);
      var x = xs;
      d.resistor({ from: [x, y], to: [x + 100, y], label: b.Rlabel, value: R(b.R), side: 'top' }); x += 100;
      if (b.diode) {
        var a = [x + 10, y], c = [x + 70, y];
        d.line([x, y], a);
        d.diode({ from: b.s < 0 ? a : c, to: b.s < 0 ? c : a, label: b.diode, side: 'top' });
        x += 70;
      }
      if (i === 0) d.line([x, y], [xN, y]); else d.line([x, y], [xN, y], [xN, yt]);
    });
    d.dot([xN, yt]); d.labelNear([xN, yt], p.nodeLabel || 'V_o', { prefer: ['top'], gap: 8 });
    // shunt branches to the right of the node, each a column
    var x = xN;
    down.forEach(function (b, i) {
      var xc = xN + 70 + i * 90;
      d.line([x, yt], [xc, yt]); d.dot([xc, yt]); x = xc;
      var y = yt, seg = 0;
      if (b.diode) {
        var a = [xc, y], c = [xc, y + 60];
        d.diode({ from: b.s > 0 ? a : c, to: b.s > 0 ? c : a, label: b.diode, side: 'right' });
        y += 60;
      }
      if (b.tap) { d.dot([xc, y + 10]); d.line([xc, y], [xc, y + 10]); d.line([xc, y + 10], [xc + 30, y + 10]); d.terminal([xc + 30, y + 10], { label: b.tap, side: 'right' }); y += 10; }
      if (b.R) { d.resistor({ from: [xc, y], to: [xc, y + 70], label: b.Rlabel, value: R(b.R), side: b.tap ? 'left' : 'right' }); y += 70; }
      if (b.E) {
        var nb = [xc, y + 60];
        if (b.E > 0) d.vsrc({ from: nb, to: [xc, y], label: b.Elabel, value: V(b.E), side: 'right', style: 'battery' });
        else d.vsrc({ from: [xc, y], to: nb, label: b.Elabel, value: V(-b.E), side: 'right', style: 'battery' });
        y += 60;
      }
      if (y < yb) { d.line([xc, y], [xc, yb]); y = yb; }
      d.ground([xc, y]);
    });
    return svg(d, p.title || 'Diode network');
  }
  /** transformer front end: returns {d, s1, s2, sc} ; ac source on the left */
  function xfmr(d, ct, vlabel) {
    var tx = d.transformer({ at: [90, 50], h: 100, w: 70, ct: !!ct, dots: false });
    d.line(tx.p1, [40, 50]); d.line(tx.p2, [40, 150]);
    d.acsrc({ from: [40, 150], to: [40, 50], label: 'v_p', side: 'left' });
    d.labelNear([tx.s1[0] + 4, (tx.s1[1] + tx.s2[1]) / 2], vlabel || 'v_s', { prefer: ['right'], gap: 6 });
    return tx;
  }
  function loadCol(d, x, ytop, ybot, o) {
    // optional C and RL between ytop and ybot at x (C left, RL right)
    var xr = x;
    if (o.C) { d.line([x, ytop], [x + 50, ytop]); d.capacitor({ from: [x + 50, ytop], to: [x + 50, ybot], label: 'C', value: typeof o.C === 'string' ? o.C : null, side: 'left', polar: true }); d.line([x + 50, ybot], [x, ybot]); xr = x + 50; d.dot([x + 50, ytop]); d.dot([x + 50, ybot]); }
    d.line([xr, ytop], [xr + 70, ytop]);
    d.resistor({ from: [xr + 70, ytop], to: [xr + 70, ybot], label: 'R_L', value: o.RL, side: 'right' });
    d.line([xr + 70, ybot], [xr, ybot]);
    d.line([xr + 70, ytop], [xr + 110, ytop]); d.terminal([xr + 110, ytop], { label: 'v_o', side: 'right' });
    d.line([xr + 70, ybot], [xr + 110, ybot]); d.terminal([xr + 110, ybot], {});
  }
  function figRect(kind, o) {
    var d = drw(); if (!d) return null;
    if (kind === 'hw') {
      var tx = xfmr(d, false);
      d.diode({ from: tx.s1, to: [tx.s1[0] + 70, tx.s1[1]], label: 'D', side: 'top' });
      var x = tx.s1[0] + 70;
      d.line(tx.s2, [x, tx.s2[1]]);
      loadCol(d, x, tx.s1[1], tx.s2[1], o);
      return svg(d, 'Half-wave rectifier');
    }
    if (kind === 'ct') {
      var t2 = d.transformer({ at: [90, 30], h: 160, w: 70, ct: true, dots: false });
      d.line(t2.p1, [40, 30]); d.line(t2.p2, [40, 190]);
      d.acsrc({ from: [40, 190], to: [40, 30], label: 'v_p', side: 'left' });
      var xd = t2.s1[0] + 80;
      d.diode({ from: t2.s1, to: [xd, t2.s1[1]], label: 'D_1', side: 'top' });
      d.diode({ from: t2.s2, to: [xd, t2.s2[1]], label: 'D_2', side: 'bottom' });
      d.line([xd, t2.s2[1]], [xd, t2.s1[1]]); d.dot([xd, t2.s1[1]]);
      var yc = t2.sc[1];
      d.labelNear([t2.s1[0] + 4, (t2.s1[1] + yc) / 2], 'v_s', { prefer: ['right'], gap: 6 });
      d.labelNear([t2.s1[0] + 4, (t2.s2[1] + yc) / 2], 'v_s', { prefer: ['right'], gap: 6 });
      // output node top = xd, return = centre tap
      var xo = xd + 20;
      d.line([xd, t2.s1[1]], [xo, t2.s1[1]]);
      d.line(t2.sc, [xo, yc]);
      // load between (xo, top) and (xo, yc): place load column with ytop=s1, ybot=yc
      loadCol(d, xo, t2.s1[1], yc, o);
      return svg(d, 'Centre-tapped full-wave rectifier');
    }
    // bridge
    var t3 = xfmr(d, false);
    var cx = 300, cy = 100, h = 60;
    var L = [cx - h, cy], Rn = [cx + h, cy], T = [cx, cy - h], B = [cx, cy + h];
    d.diode({ from: L, to: T, label: 'D_1' });
    d.diode({ from: B, to: Rn, label: 'D_4' });
    d.diode({ from: Rn, to: T, label: 'D_2' });
    d.diode({ from: B, to: L, label: 'D_3' });
    d.line(t3.s1, [t3.s1[0] + 20, t3.s1[1]], [L[0] - 20, t3.s1[1]], [L[0] - 20, cy], L); d.dot(L);
    d.line(t3.s2, [t3.s2[0] + 20, t3.s2[1]], [t3.s2[0] + 20, cy + h + 30], [cx + h + 20, cy + h + 30], [cx + h + 20, cy], Rn); d.dot(Rn);
    d.dot(T); d.dot(B);
    var xo2 = cx + h + 60;
    d.line(T, [cx, cy - h - 20], [xo2, cy - h - 20]);
    d.line(B, [cx, cy + h + 50], [xo2, cy + h + 50]);
    loadCol(d, xo2, cy - h - 20, cy + h + 50, o);
    return svg(d, 'Bridge rectifier');
  }
  function figZener(o) {
    var d = drw(); if (!d) return null;
    var yt = 50, gy = 190;
    if (o.Vs == null) { d.vsrc({ from: [40, gy], to: [40, yt], label: 'V_i', side: 'left' }); d.ground([40, gy]); }
    else dcSrc(d, 40, yt, gy, 'V_s', o.Vs);
    d.resistor({ from: [40, yt], to: [170, yt], label: 'R_S', value: o.RS ? R(o.RS) : null, side: 'top' });
    d.dot([170, yt]); d.line([170, yt], [260, yt]);
    d.zener({ from: [170, gy], to: [170, yt], label: 'V_Z', value: o.Zlab, side: 'left' }); d.ground([170, gy]);
    if (o.RL !== false) {
      d.resistor({ from: [260, yt], to: [260, gy], label: 'R_L', value: o.RL ? (typeof o.RL === 'number' ? R(o.RL) : o.RL) : null, side: 'right' }); d.ground([260, gy]);
      d.dot([260, yt]);
    }
    d.line([260, yt], [310, yt]); d.terminal([310, yt], { label: 'V_O', side: 'right' });
    return svg(d, 'Zener shunt regulator');
  }
  /** series clipper: vi - [diode s] - [battery] - node vo - R to ground */
  function figClipSeries(o) {
    var d = drw(); if (!d) return null;
    var yt = 50, gy = 170;
    d.acsrc({ from: [40, gy], to: [40, yt], label: 'v_i', side: 'left', signs: true }); d.ground([40, gy]);
    var a = [70, yt], b = [130, yt];
    d.line([40, yt], a);
    d.diode({ from: o.s > 0 ? a : b, to: o.s > 0 ? b : a, label: 'D', value: o.dval, side: 'top' });
    // battery from 150 to 210; sigma=+1 opposes clockwise flow => + terminal at left (source side)
    d.line(b, [150, yt]);
    if (o.VB) {
      if (o.sb > 0) d.vsrc({ from: [210, yt], to: [150, yt], label: 'V', value: V(o.VB), style: 'battery', side: 'top' });
      else d.vsrc({ from: [150, yt], to: [210, yt], label: 'V', value: V(o.VB), style: 'battery', side: 'top' });
    } else d.line([150, yt], [210, yt]);
    d.line([210, yt], [250, yt]); d.dot([250, yt]);
    d.resistor({ from: [250, yt], to: [250, gy], label: 'R', value: R(o.R), side: 'right' }); d.ground([250, gy]);
    d.line([250, yt], [300, yt]); d.terminal([300, yt], { label: 'v_o', side: 'right' });
    return svg(d, 'Series clipper');
  }
  /** shunt clipper: vi - R - node vo ; branches [{s, E}] to ground ; optional RL */
  function figClipShunt(o) {
    var d = drw(); if (!d) return null;
    var yt = 50, gy = 230;
    d.acsrc({ from: [40, gy], to: [40, yt], label: 'v_i', side: 'left', signs: true }); d.ground([40, gy]);
    d.resistor({ from: [40, yt], to: [150, yt], label: 'R', value: R(o.R), side: 'top' });
    var x = 150;
    o.br.forEach(function (b, i) {
      var xc = 180 + i * 90; d.line([x, yt], [xc, yt]); d.dot([xc, yt]); x = xc;
      var p0 = [xc, yt + 10], p1 = [xc, yt + 70];
      d.line([xc, yt], p0);
      d.diode({ from: b.s > 0 ? p0 : p1, to: b.s > 0 ? p1 : p0, label: 'D_' + (i + 1), side: 'right' });
      if (b.E) {
        var q = [xc, yt + 140];
        if (b.E > 0) d.vsrc({ from: q, to: p1, label: 'V_' + (i + 1), value: V(b.E), side: 'right', style: 'battery' });
        else d.vsrc({ from: p1, to: q, label: 'V_' + (i + 1), value: V(-b.E), side: 'right', style: 'battery' });
        d.line(q, [xc, gy]);
      } else d.line(p1, [xc, gy]);
      d.ground([xc, gy]);
    });
    if (o.RL) { var xl = x + 80; d.line([x, yt], [xl, yt]); d.dot([xl, yt]); d.resistor({ from: [xl, yt], to: [xl, gy], label: 'R_L', value: R(o.RL), side: 'right' }); d.ground([xl, gy]); x = xl; }
    d.line([x, yt], [x + 50, yt]); d.terminal([x + 50, yt], { label: 'v_o', side: 'right' });
    return svg(d, 'Shunt clipper');
  }
  /** divider clipper: vi - (R1 || diode) - node vo - R2 - ground */
  function figClipDivider(o) {
    var d = drw(); if (!d) return null;
    var yt = 80, gy = 210;
    d.acsrc({ from: [40, gy], to: [40, yt], label: 'v_i', side: 'left', signs: true }); d.ground([40, gy]);
    d.line([40, yt], [90, yt]); d.dot([90, yt]);
    d.resistor({ from: [90, yt], to: [200, yt], label: 'R_1', value: R(o.R1), side: 'bottom' });
    d.line([90, yt], [90, yt - 40]); d.line([200, yt], [200, yt - 40]);
    var a = [90, yt - 40], b = [200, yt - 40];
    d.diode({ from: o.s > 0 ? a : b, to: o.s > 0 ? b : a, label: 'D', value: 'V_D = ' + V(o.VD), side: 'top' });
    d.dot([200, yt]); d.line([200, yt], [260, yt]); d.dot([260, yt]);
    d.resistor({ from: [260, yt], to: [260, gy], label: 'R_2', value: R(o.R2), side: 'right' }); d.ground([260, gy]);
    d.line([260, yt], [310, yt]); d.terminal([310, yt], { label: 'v_o', side: 'right' });
    return svg(d, 'Clipper on a divider');
  }
  /** clamper: vi - C - node vo ; diode (s) + battery E to ground ; RL */
  function figClamper(o) {
    var d = drw(); if (!d) return null;
    var yt = 50, gy = 210;
    d.acsrc({ from: [40, gy], to: [40, yt], label: 'v_i', side: 'left', signs: true }); d.ground([40, gy]);
    d.line([40, yt], [80, yt]);
    d.capacitor({ from: [80, yt], to: [140, yt], label: 'C', value: o.C, side: 'top' });
    d.line([140, yt], [180, yt]); d.dot([180, yt]);
    var p0 = [180, yt + 10], p1 = [180, yt + 70];
    d.line([180, yt], p0);
    d.diode({ from: o.s > 0 ? p0 : p1, to: o.s > 0 ? p1 : p0, label: 'D', side: 'right' });
    if (o.E) {
      var q = [180, yt + 130];
      if (o.E > 0) d.vsrc({ from: q, to: p1, label: 'V', value: V(o.E), side: 'right', style: 'battery' });
      else d.vsrc({ from: p1, to: q, label: 'V', value: V(-o.E), side: 'right', style: 'battery' });
      d.line(q, [180, gy]);
    } else d.line(p1, [180, gy]);
    d.ground([180, gy]);
    d.line([180, yt], [270, yt]); d.dot([270, yt]);
    d.resistor({ from: [270, yt], to: [270, gy], label: 'R', value: o.R ? R(o.R) : null, side: 'right' }); d.ground([270, gy]);
    d.line([270, yt], [320, yt]); d.terminal([320, yt], { label: 'v_o', side: 'right' });
    return svg(d, 'Clamper');
  }
  function figDoubler() {
    var d = drw(); if (!d) return null;
    var yt = 50, gy = 180;
    d.acsrc({ from: [40, gy], to: [40, yt], label: 'v_i', side: 'left', signs: true }); d.ground([40, gy]);
    d.line([40, yt], [70, yt]);
    d.capacitor({ from: [70, yt], to: [130, yt], label: 'C_1', side: 'top' });
    d.line([130, yt], [160, yt]); d.dot([160, yt]);
    d.diode({ from: [160, gy], to: [160, yt], label: 'D_1', side: 'left' }); d.ground([160, gy]);
    d.diode({ from: [160, yt], to: [240, yt], label: 'D_2', side: 'top' });
    d.dot([240, yt]);
    d.capacitor({ from: [240, yt], to: [240, gy], label: 'C_2', side: 'right', polar: true }); d.ground([240, gy]);
    d.line([240, yt], [300, yt]); d.terminal([300, yt], { label: 'v_o', side: 'right' });
    return svg(d, 'Half-wave voltage doubler');
  }
  /** semiconductor bar (rectangular or cylinder) sketch */
  function figBar(o) {
    var d = drw(); if (!d) return null;
    if (o.cyl) {
      d.path('M60,60 L260,60 M60,110 L260,110', { x0: 60, y0: 60, x1: 260, y1: 110 });
      d.path('M60,60 A12,25 0 0 0 60,110 A12,25 0 0 0 60,60 Z', { x0: 48, y0: 60, x1: 72, y1: 110 });
      d.path('M260,60 A12,25 0 0 1 260,110', { x0: 248, y0: 60, x1: 272, y1: 110 });
      d.path('M260,60 A12,25 0 0 0 260,110', { x0: 248, y0: 60, x1: 272, y1: 110 }, { dash: '3 3' });
      d.wire({ from: [60, 130], to: [260, 130], arrow: 'both' }); d.label([160, 142], 'L = ' + o.Ltxt, { plain: true, valign: 'top' });
      d.label([40, 85], 'D = ' + o.Dtxt, { plain: true, anchor: 'end' });
    } else {
      d.poly([[60, 70], [250, 70], [250, 120], [60, 120]], { closed: true });
      d.poly([[60, 70], [85, 50], [275, 50], [250, 70]], { closed: false });
      d.poly([[275, 50], [275, 100], [250, 120]], {});
      d.wire({ from: [60, 140], to: [250, 140], arrow: 'both' }); d.label([155, 152], 'L = ' + o.Ltxt, { plain: true, valign: 'top' });
      d.label([290, 80], o.Wtxt, { plain: true, anchor: 'start' });
    }
    d.wire({ from: [10, 85], to: [44, 85], arrow: 'end' }); d.label([16, 75], 'I', { valign: 'bottom' });
    return svg(d, 'Semiconductor bar');
  }
  /** simple load-line plot (I_C vs V_CE), optional Q point and I_B curve */
  function figLoadLine(o) {
    var d = drw(); if (!d) return null;
    var x0 = 60, y0 = 230, W = 300, H = 180;
    var vmax = o.VCC * 1.12, imax = o.Isat * 1.2;
    function X(v) { return x0 + W * v / vmax; } function Y(i) { return y0 - H * i / imax; }
    d.wire({ from: [x0, y0], to: [x0 + W + 15, y0], arrow: 'end' });
    d.wire({ from: [x0, y0], to: [x0, y0 - H - 15], arrow: 'end' });
    d.label([x0 + W + 18, y0], 'V_{CE}', { anchor: 'start' });
    d.label([x0, y0 - H - 22], 'I_C', { valign: 'bottom' });
    d.poly([[X(0), Y(o.Isat)], [X(o.VCC), Y(0)]], { sw: 2 });
    d.label([X(o.VCC), y0 + 6], pe(o.VCC, 'V'), { plain: true, valign: 'top' });
    d.label([x0 - 6, Y(o.Isat)], pe(o.Isat, 'A'), { plain: true, anchor: 'end' });
    if (o.Q) {
      d.poly([[X(0.4), Y(o.Q[1])], [X(vmax * 0.97), Y(o.Q[1] * 1.04)]], { dash: '4 3' });
      d.dot([X(o.Q[0]), Y(o.Q[1])], { r: 4 });
      d.labelNear([X(o.Q[0]), Y(o.Q[1])], 'Q', { prefer: ['topright'], gap: 8 });
      if (o.IBtxt) d.label([X(vmax * 0.97), Y(o.Q[1] * 1.04) - 6], o.IBtxt, { anchor: 'end', valign: 'bottom', plain: true });
    }
    return svg(d, 'DC load line');
  }
  /** direct-coupled divider-biased Q1 into emitter follower Q2 */
  function figDirect(o) {
    var d = drw(); if (!d) return null;
    var yT = 40, gy = 330, xb = 100, x1 = 210, x2 = 330;
    d.rail([x1, yT - 18], { label: 'V_{CC}', value: o.VCC }); d.line([x1, yT - 18], [x1, yT]);
    d.line([xb, yT], [x2, yT]); d.dot([x1, yT]); d.dot([xb, yT]);
    var q1 = d.bjt({ at: [x1, 170], anchor: 'collector', label: 'Q_1', value: o.b1 });
    d.resistor({ from: [x1, yT], to: [x1, 150], label: 'R_{C1}', value: o.RC1, side: 'right' }); d.line([x1, 150], q1.collector);
    d.resistor({ from: [xb, yT], to: [xb, q1.base[1]], label: 'R_1', value: o.R1, side: 'left' });
    d.resistor({ from: [xb, q1.base[1]], to: [xb, gy], label: 'R_2', value: o.R2, side: 'left' }); d.ground([xb, gy]);
    d.dot([xb, q1.base[1]]); d.line([xb, q1.base[1]], q1.base);
    d.resistor({ from: q1.emitter, to: [x1, gy], label: 'R_{E1}', value: o.RE1, side: 'right' }); d.ground([x1, gy]);
    var q2 = d.bjt({ at: [x2, 150], anchor: 'base', label: 'Q_2', value: o.b2 });
    d.dot([x1, 150]); d.line([x1, 150], q2.base);
    d.line(q2.collector, [q2.collector[0], yT], [x2, yT]);
    d.resistor({ from: q2.emitter, to: [q2.emitter[0], gy], label: 'R_{E2}', value: o.RE2, side: 'right' }); d.ground([q2.emitter[0], gy]);
    d.dot([q2.emitter[0], q2.emitter[1] + 15]); d.line([q2.emitter[0], q2.emitter[1] + 15], [q2.emitter[0] + 50, q2.emitter[1] + 15]);
    d.terminal([q2.emitter[0] + 50, q2.emitter[1] + 15], { label: 'V_{E2}', side: 'right' });
    return svg(d, 'Direct-coupled two-stage DC');
  }

  /* =========================================================================
   * MODULE 1 · DIODES
   * ========================================================================= */
  var NI300 = 1.5e10;
  function niT(TK) { return 7.3e15 * Math.pow(TK, 1.5) * Math.exp(-1.12 / (2 * KEV * TK)); }
  function concTex(x) { return tn(x, 3) + '\\ \\text{cm}^{-3}'; }

  /* ---------------------------------------------------------------- semi: carriers */
  QB.add({
    id: 'edc.diode.semi.carriers', course: 'edc', module: 'diode', topic: 'semi',
    title: 'Carrier concentrations: approximate or exact', difficulty: 1, marks: 4,
    variants: [{ id: 'n300', label: 'n-type at 300 K' }, { id: 'p300', label: 'p-type at 300 K' }, { id: 'hot', label: 'High temperature: n_i from the formula, exact method' }],
    tags: ['WS2 Q4', 'WS2 Q5', 'semiconductor'],
    gen: function (r, v) {
      var mun = r.pick([1350, 1300]), mup = 500;
      if (v === 'n300' || v === 'p300') {
        var nt = v === 'n300';
        var N = r.pick([1, 2, 2.5, 4, 5, 8]) * Math.pow(10, r.int(13, 17));
        var maj = N, mnr = NI300 * NI300 / N;
        var n = nt ? maj : mnr, p = nt ? mnr : maj;
        var sig = QE * (n * mun + p * mup), rho = 1 / sig;
        var dop = nt ? 'donors (phosphorus)' : 'acceptors (boron)';
        var ND = nt ? 'N_D' : 'N_A';
        return {
          stem: 'A silicon sample at 300 K is doped with ' + dop + ' at $' + ND + ' = ' + concTex(N) + '$. Take $n_i = 1.5\\times10^{10}\\ \\text{cm}^{-3}$, $\\mu_n = ' + mun + '$ and $\\mu_p = ' + mup + '\\ \\text{cm}^2/\\text{Vs}$, $q = 1.6\\times10^{-19}$ C.',
          figure: null,
          given: [['$' + ND + '$', pn(N) + ' cm⁻³'], ['$n_i$', '1.5×10¹⁰ cm⁻³'], ['$\\mu_n,\\ \\mu_p$', mun + ', ' + mup + ' cm²/Vs']],
          parts: [
            { q: '(a) Find the majority and minority carrier concentrations.',
              answers: [A(nt ? '$n_n$' : '$p_p$', maj, 'cm⁻³'), A(nt ? '$p_n$' : '$n_p$', mnr, 'cm⁻³')],
              working: st([
                (nt ? 'Donors give n-type material, so electrons are the majority carriers.' : 'Acceptors give p-type material, so holes are the majority carriers.'),
                'Check the approximation: $' + ND + ' = ' + tn(N) + '\\gg n_i = 1.5\\times10^{10}$, so the majority concentration is set by the doping: $' + (nt ? 'n_n' : 'p_p') + '\\approx ' + ND + ' = ' + concTex(maj) + '$.',
                'Mass action $n_0p_0 = n_i^2$: $' + (nt ? 'p_n' : 'n_p') + ' = \\dfrac{n_i^2}{' + ND + '} = \\dfrac{(1.5\\times10^{10})^2}{' + tn(N) + '} = ' + concTex(mnr) + '$.',
                'Check: majority ≫ minority ✓.'
              ]) + fin((nt ? 'n_n' : 'p_p') + ' = ' + concTex(maj) + ',\\quad ' + (nt ? 'p_n' : 'n_p') + ' = ' + concTex(mnr)) },
            { q: '(b) Find the conductivity and the resistivity.',
              answers: [A('$\\sigma$', sig, 'S/cm'), A('$\\rho$', rho, 'Ω·cm')],
              working: st([
                '$\\sigma = q(n\\mu_n + p\\mu_p) = 1.6\\times10^{-19}\\left(' + tn(n) + '\\times' + mun + ' + ' + tn(p) + '\\times' + mup + '\\right)$',
                'The minority term is negligible: $\\sigma = ' + tn(sig, 4) + '\\ (\\Omega\\text{-cm})^{-1}$.',
                '$\\rho = 1/\\sigma = ' + tn(rho, 4) + '\\ \\Omega\\text{-cm}$.'
              ]) + fin('\\sigma = ' + tn(sig) + '\\ (\\Omega\\text{-cm})^{-1},\\quad \\rho = ' + tn(rho) + '\\ \\Omega\\text{-cm}') }
          ],
          notes: QB.callout('trap', 'In doped material the minority concentration is $n_i^2/N$, not $n_i$.'),
          data: { v: v, N: N, mun: mun, mup: mup }
        };
      }
      // hot: compute ni, exact quadratic
      return r.retry(function () {
        var Tc = r.nice(100, 250, 25), TK = Tc + 273.15;
        var ntp = r.bool();
        var N = r.pick([1, 2, 3, 5]) * Math.pow(10, r.int(12, 14));
        var ni = niT(TK);
        var ratio = ni / N;
        if (ratio < 0.08 || ratio > 4) return null;
        var maj = N / 2 + Math.sqrt(N * N / 4 + ni * ni), mnr = ni * ni / maj;
        var mnrA = ni * ni / N;
        var err = (N - maj) / maj * 100;
        var ND = ntp ? 'N_D' : 'N_A', M = ntp ? 'n' : 'p', m = ntp ? 'p' : 'n';
        return {
          stem: 'Silicon doped with ' + (ntp ? 'donors' : 'acceptors') + ' at $' + ND + ' = ' + concTex(N) + '$ operates at ' + Tc + ' °C. Use $n_i = BT^{3/2}e^{-E_g/(2kT)}$ with $B = 7.3\\times10^{15}\\ \\text{cm}^{-3}\\text{K}^{-3/2}$, $E_g = 1.12$ eV and $k = 8.62\\times10^{-5}$ eV/K.',
          figure: null,
          given: [['$' + ND + '$', pn(N) + ' cm⁻³'], ['$T$', Tc + ' °C']],
          parts: [
            { q: '(a) Find $n_i$ at this temperature.', answers: [A('$n_i$', ni, 'cm⁻³')],
              working: st([
                '$T = ' + Tc + ' + 273.15 = ' + TK + '$ K (kelvin, and $k$ in eV/K because $E_g$ is in eV).',
                '$n_i = 7.3\\times10^{15}(' + TK + ')^{3/2}\\exp\\!\\left(-\\dfrac{1.12}{2(8.62\\times10^{-5})(' + TK + ')}\\right) = 7.3\\times10^{15}(' + tn(Math.pow(TK, 1.5), 4) + ')(' + tn(Math.exp(-1.12 / (2 * KEV * TK)), 4) + ')$'
              ]) + fin('n_i = ' + concTex(ni)) },
            { q: '(b) Is the approximation (' + M + ' ≈ ' + ND.replace('_', '') + ') safe? Find the majority and minority concentrations with the exact equations.',
              answers: [A('$' + M + '$', maj, 'cm⁻³'), A('$' + m + '$', mnr, 'cm⁻³')],
              working: st([
                '$n_i/' + ND + ' = ' + tn(ratio, 3) + '$. ' + (ratio >= 0.1 ? 'This is not ≪ 1, so the approximation fails: use the exact quadratic.' : 'This is close to the 0.1 limit, so use the exact quadratic to be safe.'),
                '$' + M + ' = \\dfrac{' + ND + '}{2} + \\sqrt{\\left(\\dfrac{' + ND + '}{2}\\right)^2 + n_i^2} = ' + tn(N / 2) + ' + \\sqrt{(' + tn(N / 2) + ')^2 + (' + tn(ni) + ')^2} = ' + concTex(maj) + '$',
                '$' + m + ' = n_i^2/' + M + ' = ' + concTex(mnr) + '$.',
                'The approximate method would give $' + M + ' = ' + concTex(N) + '$ (' + tn(Math.abs(err), 3) + ' % low) and $' + m + ' = ' + concTex(mnrA) + '$.'
              ]) + fin(M + ' = ' + concTex(maj) + ',\\quad ' + m + ' = ' + concTex(mnr)) }
          ],
          notes: QB.callout('trap', 'Use $k = 8.62\\times10^{-5}$ eV/K in the exponent and T in kelvin.'),
          data: { v: v, N: N, Tc: Tc, ntype: ntp }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- semi: bar resistance */
  QB.add({
    id: 'edc.diode.semi.bar', course: 'edc', module: 'diode', topic: 'semi',
    title: 'Resistance of a semiconductor bar', difficulty: 2, marks: 5,
    variants: [{ id: 'intrinsic', label: 'Intrinsic Si (temperature given)' }, { id: 'doped', label: 'Doped Si at 300 K' }, { id: 'drift', label: 'Applied voltage: field, drift velocity and current' }],
    tags: ['WS2 Q3', 'WS2 Q6', 'WS2 Q7'],
    gen: function (r, v) {
      var mun = 1350, mup = 500;
      var cyl = r.bool(0.35), Lcm, Acm, Ltxt, Wtxt, Dtxt, geomTex;
      if (cyl) {
        var Lmm = r.pick([4, 5, 8, 10]), Dmm = r.pick([0.5, 1, 2]);
        Lcm = Lmm / 10; Acm = Math.PI * Math.pow(Dmm / 10, 2) / 4;
        Ltxt = Lmm + ' mm'; Dtxt = Dmm + ' mm';
        geomTex = 'a cylinder $' + Lmm + '$ mm long and $' + Dmm + '$ mm in diameter, conducting lengthwise';
      } else if (r.bool()) {
        var Lum = r.pick([5, 10, 20, 50, 100]), a = r.pick([1, 2, 3, 5]), b = r.pick([1, 2, 3, 5]);
        Lcm = Lum * 1e-4; Acm = a * b * 1e-8; Ltxt = Lum + ' µm'; Wtxt = a + ' µm × ' + b + ' µm';
        geomTex = 'a bar with current path $L = ' + Lum + '\\ \\mu$m and cross-section $' + a + '\\ \\mu\\text{m}\\times' + b + '\\ \\mu$m';
      } else {
        var Lm2 = r.pick([1, 2, 5]), s = r.pick([0.1, 0.2, 0.5]);
        Lcm = Lm2 / 10; Acm = s * s / 100; Ltxt = Lm2 + ' mm'; Wtxt = s + ' mm × ' + s + ' mm';
        geomTex = 'a bar $' + Lm2 + '$ mm long with a square cross-section $' + s + '\\ \\text{mm}\\times' + s + '$ mm';
      }
      var fig = figBar({ cyl: cyl, Ltxt: Ltxt, Wtxt: Wtxt, Dtxt: Dtxt });
      var ni = NI300, Tc = 27, TK = 300, n, p, N = 0, ntp = r.bool();
      var steps = [];
      if (v === 'intrinsic') {
        Tc = r.pick([27, 40, 50, 60, 75]);
        if (Tc === 27) { TK = 300; ni = NI300; steps.push('At 300 K use $n_i = 1.5\\times10^{10}\\ \\text{cm}^{-3}$.'); }
        else { TK = Tc + 273.15; ni = niT(TK); steps.push('$T = ' + TK + '$ K: $n_i = 7.3\\times10^{15}(' + TK + ')^{3/2}e^{-1.12/(2\\cdot8.62\\times10^{-5}\\cdot' + TK + ')} = ' + concTex(ni) + '$.'); }
        n = p = ni; steps.push('Intrinsic: $n = p = n_i$.');
      } else {
        N = r.pick([1, 2, 5]) * Math.pow(10, r.int(14, 16));
        var mn = ni * ni / N; n = ntp ? N : mn; p = ntp ? mn : N;
        steps.push((ntp ? 'n-type: $n\\approx N_D = ' : 'p-type: $p\\approx N_A = ') + concTex(N) + '$, and the minority concentration is $n_i^2/N = ' + concTex(mn) + '$.');
      }
      var sig = QE * (n * mun + p * mup), rho = 1 / sig, Rb = rho * Lcm / Acm;
      steps.push('$\\sigma = q(n\\mu_n+p\\mu_p) = 1.6\\times10^{-19}(' + tn(n) + '\\cdot' + mun + ' + ' + tn(p) + '\\cdot' + mup + ') = ' + tn(sig, 4) + '\\ (\\Omega\\text{-cm})^{-1}$, so $\\rho = ' + tn(rho, 4) + '\\ \\Omega$-cm.');
      steps.push('Lengths in cm: $L = ' + tn(Lcm, 4) + '$ cm, $A = ' + tn(Acm, 4) + '\\ \\text{cm}^2$.');
      steps.push('$R = \\dfrac{\\rho L}{A} = \\dfrac{' + tn(rho, 4) + '\\times' + tn(Lcm, 4) + '}{' + tn(Acm, 4) + '} = ' + te(Rb, 'Ω', 4) + '$');
      var mat = v === 'intrinsic' ? 'intrinsic silicon at ' + (Tc === 27 ? '300 K' : Tc + ' °C') : 'silicon doped with ' + (ntp ? 'donors, $N_D' : 'acceptors, $N_A') + ' = ' + concTex(N) + '$, at 300 K';
      var parts = [{ q: '(a) Find the resistivity and the resistance of the sample.', answers: [A('$\\rho$', rho, 'Ω·cm'), A('$R$', Rb, 'Ω')].concat(v === 'intrinsic' && Tc !== 27 ? [A('$n_i$', ni, 'cm⁻³')] : []), working: st(steps) + fin('\\rho = ' + tn(rho) + '\\ \\Omega\\text{-cm},\\quad R = ' + te(Rb, 'Ω')) }];
      var Vap = 0;
      if (v === 'drift') {
        Vap = r.pick([1, 2, 5, 10]);
        var E = Vap / Lcm, vdn = mun * E, vdp = mup * E, I = Vap / Rb;
        parts.push({ q: '(b) ' + Vap + ' V is applied across the ends. Find the electric field, the electron and hole drift velocities, and the current.',
          answers: [A('$E$', E, 'V/cm'), A('$v_{dn}$', vdn, 'cm/s'), A('$v_{dp}$', vdp, 'cm/s'), A('$I$', I, 'A')],
          working: st([
            '$E = V/L = ' + Vap + '/' + tn(Lcm, 4) + ' = ' + tn(E, 4) + '$ V/cm.',
            '$v_{dn} = \\mu_nE = ' + mun + '\\times' + tn(E, 4) + ' = ' + tn(vdn, 4) + '$ cm/s; $v_{dp} = \\mu_pE = ' + tn(vdp, 4) + '$ cm/s.',
            '$I = V/R = ' + Vap + '/' + te(Rb, 'Ω', 4) + ' = ' + te(I, 'A', 4) + '$. Electrons drift against $E$, but their current is along $E$.'
          ]) + fin('E = ' + tn(E) + '\\ \\text{V/cm},\\ v_{dn} = ' + tn(vdn) + ',\\ v_{dp} = ' + tn(vdp) + '\\ \\text{cm/s},\\ I = ' + te(I, 'A')) });
      }
      return {
        stem: 'The sample is ' + geomTex + '. It is made of ' + mat + '. Use $\\mu_n = ' + mun + '$, $\\mu_p = ' + mup + '\\ \\text{cm}^2/\\text{Vs}$, $n_i(300\\text{ K}) = 1.5\\times10^{10}\\ \\text{cm}^{-3}$' + (v === 'intrinsic' && Tc !== 27 ? ' and $n_i = BT^{3/2}e^{-E_g/2kT}$ ($B = 7.3\\times10^{15}$, $E_g = 1.12$ eV, $k = 8.62\\times10^{-5}$ eV/K) at other temperatures' : '') + '.',
        figure: fig,
        given: [['$L$', Ltxt], [cyl ? '$D$' : '$A$', cyl ? Dtxt : Wtxt]],
        parts: parts,
        notes: QB.callout('trap', 'ρ is in Ω-cm, so convert every length to cm: 1 µm = 10⁻⁴ cm and 1 µm² = 10⁻⁸ cm².'),
        data: { v: v, Lcm: Lcm, Acm: Acm, Tc: Tc, N: N, ntype: ntp, mun: mun, mup: mup, V: Vap }
      };
    }
  });

  /* ---------------------------------------------------------------- semi: pn junction */
  QB.add({
    id: 'edc.diode.semi.junction', course: 'edc', module: 'diode', topic: 'semi',
    title: 'pn junction: built-in voltage and depletion split', difficulty: 2, marks: 4,
    variants: [{ id: 'v300', label: 'At 300 K' }, { id: 'hot', label: 'At a raised temperature' }],
    tags: ['pn junction'],
    gen: function (r, v) {
      var NA = r.pick([1, 2, 5]) * Math.pow(10, r.int(15, 18)), ND = r.pick([1, 2, 5]) * Math.pow(10, r.int(14, 17));
      if (NA === ND) ND *= 2;
      var TK = 300, Tc = 27, ni = NI300;
      if (v === 'hot') { Tc = r.pick([75, 100, 125]); TK = Tc + 273.15; ni = niT(TK); }
      var VT = KB * TK / QE;
      var V0 = VT * Math.log(NA * ND / (ni * ni));
      var Wum = r.pick([0.2, 0.4, 0.5, 0.8, 1]);
      var xn = Wum * 1e-6 * NA / (NA + ND), xp = Wum * 1e-6 * ND / (NA + ND);
      var light = NA > ND ? 'n' : 'p';
      return {
        stem: 'An abrupt silicon pn junction has $N_A = ' + concTex(NA) + '$ on the p side and $N_D = ' + concTex(ND) + '$ on the n side' + (v === 'hot' ? ', at ' + Tc + ' °C (find $n_i$ from $BT^{3/2}e^{-E_g/2kT}$, $B = 7.3\\times10^{15}$, $E_g = 1.12$ eV, $k = 8.62\\times10^{-5}$ eV/K)' : ' at 300 K ($n_i = 1.5\\times10^{10}\\ \\text{cm}^{-3}$)') + '. The total depletion width is ' + Wum + ' µm. Use $V_T = kT/q$ with $k = 1.38\\times10^{-23}$ J/K.',
        figure: null,
        given: [['$N_A$', pn(NA) + ' cm⁻³'], ['$N_D$', pn(ND) + ' cm⁻³'], ['$W$', Wum + ' µm']],
        parts: [
          { q: '(a) Find the built-in voltage $V_0$.', answers: [A('$V_0$', V0, 'V')],
            working: st([
              '$V_T = kT/q = 1.38\\times10^{-23}(' + TK + ')/1.6\\times10^{-19} = ' + te(VT, 'V', 4) + '$.',
              v === 'hot' ? '$n_i(' + TK + '\\text{ K}) = ' + concTex(ni) + '$.' : 'At 300 K, $n_i = 1.5\\times10^{10}$.',
              '$V_0 = V_T\\ln\\dfrac{N_AN_D}{n_i^2} = ' + tn(VT, 4) + '\\ln\\dfrac{' + tn(NA) + '\\times' + tn(ND) + '}{(' + tn(ni) + ')^2} = ' + tn(VT, 4) + '\\times' + tn(Math.log(NA * ND / ni / ni), 4) + '$'
            ]) + fin('V_0 = ' + te(V0, 'V')) },
          { q: '(b) How is the depletion width shared? Find $x_n$ and $x_p$.', answers: [A('$x_n$', xn, 'm'), A('$x_p$', xp, 'm')],
            working: st([
              'Charge balance: $qAx_nN_D = qAx_pN_A$, so $x_n/x_p = N_A/N_D = ' + tn(NA / ND, 3) + '$.',
              '$x_n = W\\dfrac{N_A}{N_A+N_D} = ' + te(xn, 'm') + '$, $x_p = W\\dfrac{N_D}{N_A+N_D} = ' + te(xp, 'm') + '$.',
              'The region extends further into the lightly doped (' + light + ') side.'
            ]) + fin('x_n = ' + te(xn, 'm') + ',\\quad x_p = ' + te(xp, 'm')) }
        ],
        data: { v: v, NA: NA, ND: ND, Tc: Tc, TK: TK, W: Wum * 1e-6 }
      };
    }
  });

  /* ---------------------------------------------------------------- models: Shockley */
  QB.add({
    id: 'edc.diode.models.shockley', course: 'edc', module: 'diode', topic: 'models',
    title: 'Shockley equation: V_D, I_D, ΔV_D, or n and I_S', difficulty: 2, marks: 5,
    variants: [{ id: 'findV', label: 'Find V_D from I_D' }, { id: 'findI', label: 'Find I_D from V_D (full equation)' }, { id: 'deltaV', label: 'Change in V_D for a change in current' }, { id: 'twopoint', label: 'Two operating points: find n and I_S' }],
    tags: ['PT Q2', 'WS2 Q8–9', 'WS3 Q1', 'WS3 Q4', 'exam-style'],
    gen: function (r, v) {
      var Tc = r.pick([20, 25, 27, 30, 50]), VT = VTof(Tc);
      var vtStep = '$V_T = \\dfrac{kT_K}{q} = \\dfrac{1.38\\times10^{-23}(' + (Tc + 273) + ')}{1.6\\times10^{-19}} = ' + te(VT, 'V', 4) + '$';
      var g = [['$T$', Tc + ' °C']];
      if (v === 'findV') {
        var n = r.pick([1, 1.5, 1.8, 2]), Is = r.pick([1, 2, 5]) * Math.pow(10, r.int(-15, -9)), I = r.pick([0.5, 1, 2, 5, 10, 20, 50, 100]) * 1e-3;
        var Vd = n * VT * Math.log(I / Is + 1), rd = n * VT / I;
        return {
          stem: 'A silicon diode at ' + Tc + ' °C has $I_S = ' + te(Is, 'A') + '$ and $n = ' + n + '$. It carries a forward current of ' + pe(I, 'A') + '.',
          figure: null, given: g.concat([['$I_S$', pe(Is, 'A')], ['$n$', String(n)], ['$I_D$', pe(I, 'A')]]),
          parts: [
            { q: '(a) Find the diode voltage $V_D$.', answers: [A('$V_D$', Vd, 'V', { sig: 4 })],
              working: st([vtStep, '$I_D\\gg I_S$, so $V_D = nV_T\\ln\\dfrac{I_D}{I_S} = ' + n + '\\times' + tn(VT, 4) + '\\times\\ln\\dfrac{' + tn(I) + '}{' + tn(Is) + '} = ' + tn(n * VT, 4) + '\\times' + tn(Math.log(I / Is), 4) + '$']) + fin('V_D = ' + te(Vd, 'V', 4)) },
            { q: '(b) Find the small-signal resistance $r_d$ at this current.', answers: [A('$r_d$', rd, 'Ω')],
              working: st(['$r_d = \\dfrac{nV_T}{I_D} = \\dfrac{' + n + '\\times' + tn(VT, 4) + '}{' + tn(I) + '}$']) + fin('r_d = ' + te(rd, 'Ω')) }
          ],
          data: { v: v, Tc: Tc, n: n, Is: Is, I: I }
        };
      }
      if (v === 'findI') {
        return r.retry(function () {
          var n = r.pick([1, 1.5, 2]), Is = r.pick([1, 4, 10, 40]) * Math.pow(10, r.int(-14, -9)), Vd = r.nice(0.35, 0.75, 0.05);
          var I = Is * (Math.exp(Vd / (n * VT)) - 1);
          if (I < 20e-6 || I > 0.3) return null;
          return {
            stem: 'A diode at ' + Tc + ' °C has $I_S = ' + te(Is, 'A') + '$ and $n = ' + n + '$. A forward bias of ' + pe(Vd, 'V') + ' is applied.',
            figure: null, given: g.concat([['$I_S$', pe(Is, 'A')], ['$n$', String(n)], ['$V_D$', pe(Vd, 'V')]]),
            parts: [
              { q: '(a) Find $V_T$ and the diode current $I_D$.', answers: [A('$V_T$', VT, 'V', { sig: 4 }), A('$I_D$', I, 'A')],
                working: st([vtStep, '$I_D = I_S\\left(e^{V_D/nV_T}-1\\right) = ' + tn(Is) + '\\left(e^{' + Vd + '/(' + n + '\\times' + tn(VT, 4) + ')}-1\\right) = ' + tn(Is) + '\\left(' + tn(Math.exp(Vd / (n * VT)), 4) + '-1\\right)$']) + fin('I_D = ' + te(I, 'A')) },
              { q: '(b) Find the small-signal resistance at this operating point.', answers: [A('$r_d$', n * VT / I, 'Ω')],
                working: st(['$r_d = nV_T/I_D = ' + tn(n * VT, 4) + '/' + tn(I) + '$']) + fin('r_d = ' + te(n * VT / I, 'Ω')) }
            ],
            data: { v: v, Tc: Tc, n: n, Is: Is, Vd: Vd }
          };
        });
      }
      if (v === 'deltaV') {
        var n2 = r.pick([1, 1.5, 2]), I1 = r.pick([0.1, 0.2, 0.5, 1, 2, 5]) * 1e-3, k = r.pick([0.01, 0.1, 0.2, 5, 10, 20, 50, 100]);
        if (I1 * k > 0.5) k = 1 / k;
        var I2 = I1 * k, V1 = r.nice(0.55, 0.7, 0.01);
        var dV = n2 * VT * Math.log(I2 / I1), V2 = V1 + dV;
        return {
          stem: 'A silicon diode with $n = ' + n2 + '$ operates at ' + Tc + ' °C. Its voltage is ' + pe(V1, 'V') + ' at ' + pe(I1, 'A') + '. The current changes to ' + pe(I2, 'A') + '.',
          figure: null, given: g.concat([['$n$', String(n2)], ['$I_1$', pe(I1, 'A')], ['$I_2$', pe(I2, 'A')], ['$V_1$', pe(V1, 'V')]]),
          parts: [
            { q: '(a) Find the change in diode voltage $\\Delta V_D = V_2 - V_1$ and the new voltage $V_2$.', answers: [A('$\\Delta V_D$', dV, 'V'), A('$V_2$', V2, 'V', { sig: 4 })],
              working: st([vtStep, '$I_S$ cancels: $\\Delta V_D = nV_T\\ln\\dfrac{I_2}{I_1} = ' + n2 + '\\times' + tn(VT, 4) + '\\times\\ln(' + tn(k, 4) + ')$', '$V_2 = V_1 + \\Delta V_D = ' + V1 + (dV < 0 ? ' - ' : ' + ') + tn(abs(dV), 4) + '$', 'Check: one decade costs $2.303nV_T = ' + te(2.303 * n2 * VT, 'V') + '$.']) + fin('\\Delta V_D = ' + te(dV, 'V') + ',\\quad V_2 = ' + te(V2, 'V', 4)) }
          ],
          notes: QB.callout('trap', 'Keep $n$ in the formula: with $n = 1.5$ a decade is about 89 mV, not 60 mV.'),
          data: { v: v, Tc: Tc, n: n2, I1: I1, I2: I2, V1: V1 }
        };
      }
      // twopoint
      return r.retry(function () {
        var nt = r.float(1.2, 1.9, 2), Ist = r.pick([1, 2, 5]) * Math.pow(10, r.int(-12, -9));
        var I1 = r.pick([0.2, 0.5, 1, 2]) * 1e-3, kk = r.pick([5, 10, 20, 50]), I2 = I1 * kk;
        var V1 = Math.round(nt * VT * Math.log(I1 / Ist) * 1000) / 1000, V2 = Math.round(nt * VT * Math.log(I2 / Ist) * 1000) / 1000;
        if (V1 < 0.3 || V2 > 0.95) return null;
        var n = (V2 - V1) / (VT * Math.log(I2 / I1)), Is = I1 * Math.exp(-V1 / (n * VT));
        var I3 = I2 * 2, V3 = V2 + n * VT * Math.log(2);
        return {
          stem: 'At ' + Tc + ' °C a diode carries ' + pe(I1, 'A') + ' at ' + pe(V1, 'V', 3) + ' and ' + pe(I2, 'A') + ' at ' + pe(V2, 'V', 3) + '.',
          figure: null, given: g.concat([['$(I_1, V_1)$', pe(I1, 'A') + ', ' + pe(V1, 'V')], ['$(I_2, V_2)$', pe(I2, 'A') + ', ' + pe(V2, 'V')]]),
          parts: [
            { q: '(a) Find the ideality factor $n$ and the saturation current $I_S$.', answers: [A('$n$', n, '', { tol: 0.01, sig: 4 }), A('$I_S$', Is, 'A', { tol: 0.05 })],
              working: st([vtStep, 'Both currents are ≫ $I_S$, so $I \\simeq I_Se^{V/nV_T}$. Divide the two equations: $\\dfrac{I_2}{I_1} = e^{(V_2-V_1)/nV_T}$.', '$n = \\dfrac{V_2-V_1}{V_T\\ln(I_2/I_1)} = \\dfrac{' + tn(V2 - V1, 3) + '}{' + tn(VT, 4) + '\\ln ' + kk + '} = ' + tn(n, 4) + '$', 'Back-substitute point 1: $I_S = I_1e^{-V_1/nV_T} = ' + tn(I1) + 'e^{-' + V1 + '/(' + tn(n, 4) + '\\times' + tn(VT, 4) + ')}$', 'Check with point 2: $I_2e^{-V_2/nV_T}$ gives the same $I_S$.']) + fin('n = ' + tn(n, 4) + ',\\quad I_S = ' + te(Is, 'A')) },
            { q: '(b) Predict $V_D$ at ' + pe(I3, 'A') + '.', answers: [A('$V_3$', V3, 'V', { sig: 4 })],
              working: st(['$V_3 = V_2 + nV_T\\ln(I_3/I_2) = ' + V2 + ' + ' + tn(n, 4) + '\\times' + tn(VT, 4) + '\\ln 2$']) + fin('V_3 = ' + te(V3, 'V', 4)) }
          ],
          data: { v: v, Tc: Tc, I1: I1, I2: I2, V1: V1, V2: V2, I3: I3 }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- models: temperature */
  QB.add({
    id: 'edc.diode.models.temp', course: 'edc', module: 'diode', topic: 'models',
    title: 'Diode temperature effects', difficulty: 1, marks: 4,
    variants: [{ id: 'vd', label: 'Forward drop and leakage at a new temperature' }, { id: 'rev', label: 'Reverse-biased diode feeding a resistor' }, { id: 'rd', label: 'Small-signal resistance at two temperatures' }],
    tags: ['WS3 Q2', 'temperature'],
    gen: function (r, v) {
      if (v === 'rev') {
        var T1 = r.pick([20, 25, 30]), Vr = r.pick([0.5, 1, 2]), Rr = r.pick([100e3, 470e3, 1e6]), up = r.pick([10, 20, 30]), dn = r.pick([10, 20]);
        var T2 = T1 + up, T3 = T1 - dn, Is1 = Vr / Rr, V2 = Vr * Math.pow(2, up / 10), V3 = Vr * Math.pow(2, -dn / 10);
        var Vs = r.pick([10, 12, 15]);
        var fig = null;
        var d = drw(); if (d) {
          dcSrc(d, 40, 50, 180, 'V_s', Vs); d.line([40, 50], [70, 50]);
          d.diode({ from: [140, 50], to: [70, 50], label: 'D', side: 'top' }); d.line([140, 50], [200, 50]);
          d.resistor({ from: [200, 50], to: [200, 180], label: 'R', value: R(Rr), side: 'right' }); d.ground([200, 180]);
          d.polarity({ a: [200, 60], b: [200, 170], label: 'V', side: 'left', gap: 16 });
          fig = svg(d, 'Reverse-biased diode and resistor');
        }
        return {
          stem: 'A large diode is reverse biased by a ' + Vs + ' V supply through $R = ' + R(Rr).replace(' ', '\\,') + '$. Its reverse current is independent of voltage and doubles for every 10 °C rise. At ' + T1 + ' °C the voltage across $R$ is $V = ' + Vr + '$ V.',
          figure: fig, given: [['$V$ at ' + T1 + ' °C', V(Vr)], ['$R$', R(Rr)]],
          parts: [
            { q: '(a) Find the reverse current at ' + T1 + ' °C.', answers: [A('$I_S$', Is1, 'A')], working: st(['Reverse biased, so the loop current is $I_S$: $I_S = V/R = ' + Vr + '/' + tn(Rr) + '$']) + fin('I_S = ' + te(Is1, 'A')) },
            { q: '(b) Find $V$ at ' + T2 + ' °C and at ' + T3 + ' °C.', answers: [A('$V(' + T2 + '^\\circ)$', V2, 'V'), A('$V(' + T3 + '^\\circ)$', V3, 'V')],
              working: st(['$I_S(T) = I_S(T_1)\\,2^{\\Delta T/10}$ and $V = I_SR$ scales by the same factor.', T2 + ' °C: $\\Delta T = +' + up + '$, factor $2^{' + (up / 10) + '} = ' + tn(Math.pow(2, up / 10), 3) + '$, $V = ' + tn(V2, 3) + '$ V.', T3 + ' °C: $\\Delta T = -' + dn + '$, factor $2^{-' + (dn / 10) + '} = ' + tn(Math.pow(2, -dn / 10), 3) + '$, $V = ' + tn(V3, 3) + '$ V.']) + fin('V = ' + te(V2, 'V') + '\\ \\text{and}\\ ' + te(V3, 'V')) }
          ],
          data: { v: v, Vr: Vr, R: Rr, up: up, dn: dn }
        };
      }
      var Ta = r.pick([20, 25, 27]), Tb = Ta + r.pick([20, 30, 40, 50]), dT = Tb - Ta;
      if (v === 'vd') {
        var V1 = r.nice(0.6, 0.72, 0.01), I = r.pick([1, 2, 5, 10]) * 1e-3, Is = r.pick([1, 2, 5, 10, 20]) * 1e-9;
        var V2 = V1 - 0.0025 * dT, Is2 = Is * Math.pow(2, dT / 10);
        var Tc2 = Ta - r.pick([10, 20]), Is3 = Is * Math.pow(2, (Tc2 - Ta) / 10);
        return {
          stem: 'A silicon diode drops ' + pe(V1, 'V') + ' at ' + pe(I, 'A') + ' and has a reverse current of ' + pe(Is, 'A') + ', both at ' + Ta + ' °C. Use the course rules: the forward drop falls 2.5 mV/°C at fixed current, and $I_S$ doubles every 10 °C.',
          figure: null, given: [['$V_D$', V(V1)], ['$I_D$', pe(I, 'A')], ['$I_S$', pe(Is, 'A')]],
          parts: [
            { q: '(a) Estimate $V_D$ at the same current when the diode is at ' + Tb + ' °C.', answers: [A('$V_D(' + Tb + '^\\circ)$', V2, 'V', { sig: 4 })], working: st(['$V_D(T_2) = V_D(T_1) - 2.5\\text{ mV}\\times\\Delta T = ' + V1 + ' - 0.0025\\times' + dT + '$']) + fin('V_D = ' + te(V2, 'V', 4)) },
            { q: '(b) Find the reverse current at ' + Tb + ' °C and at ' + Tc2 + ' °C.', answers: [A('$I_S(' + Tb + '^\\circ)$', Is2, 'A'), A('$I_S(' + Tc2 + '^\\circ)$', Is3, 'A')],
              working: st(['$I_S(' + Tb + ') = ' + tn(Is) + '\\times2^{' + dT + '/10} = ' + te(Is2, 'A') + '$', '$I_S(' + Tc2 + ') = ' + tn(Is) + '\\times2^{' + (Tc2 - Ta) + '/10} = ' + te(Is3, 'A') + '$', 'A hotter diode has a smaller forward drop but a larger leakage.']) + fin('I_S = ' + te(Is2, 'A') + ',\\ ' + te(Is3, 'A')) }
          ],
          data: { v: v, V1: V1, I: I, Is: Is, dT: dT, dT2: Tc2 - Ta }
        };
      }
      // rd
      var n = r.pick([1, 1.5, 2]), Id = r.pick([0.5, 1, 2, 5]) * 1e-3;
      var VTa = VTof(Ta), VTb = VTof(Tb), rda = n * VTa / Id, rdb = n * VTb / Id;
      return {
        stem: 'A diode with $n = ' + n + '$ is biased at a fixed ' + pe(Id, 'A') + '. The temperature rises from ' + Ta + ' °C to ' + Tb + ' °C. Use $V_T = kT_K/q$ with $T_K = T + 273$.',
        figure: null, given: [['$n$', String(n)], ['$I_D$', pe(Id, 'A')]],
        parts: [
          { q: '(a) Find $V_T$ and the small-signal resistance $r_d$ at both temperatures.', answers: [A('$r_d(' + Ta + '^\\circ)$', rda, 'Ω'), A('$r_d(' + Tb + '^\\circ)$', rdb, 'Ω')],
            working: st(['$V_T(' + Ta + ') = 1.38\\times10^{-23}(' + (Ta + 273) + ')/1.6\\times10^{-19} = ' + te(VTa, 'V', 4) + '$, $V_T(' + Tb + ') = ' + te(VTb, 'V', 4) + '$.', '$r_d = nV_T/I_D$: $' + n + '\\times' + tn(VTa, 4) + '/' + tn(Id) + ' = ' + te(rda, 'Ω') + '$ and $' + n + '\\times' + tn(VTb, 4) + '/' + tn(Id) + ' = ' + te(rdb, 'Ω') + '$.', '$r_d$ rises in proportion to $T_K$ at fixed current.']) + fin('r_d = ' + te(rda, 'Ω') + '\\ \\to\\ ' + te(rdb, 'Ω')) }
        ],
        data: { v: v, n: n, Id: Id, Ta: Ta, Tb: Tb }
      };
    }
  });

  /* ---------------------------------------------------------------- models: resistance levels and 3rd model */
  QB.add({
    id: 'edc.diode.models.resist', course: 'edc', module: 'diode', topic: 'models',
    title: 'DC, ac and average resistance; building the third model', difficulty: 2, marks: 5,
    variants: [{ id: 'dcac', label: 'Static R_D vs small-signal r_d' }, { id: 'pwl', label: 'Third model from two points, then use it' }, { id: 'signal', label: 'DC bias plus a small signal' }],
    tags: ['WS3 Q5', 'WS3 Q6', 'EX2 Q2'],
    gen: function (r, v) {
      if (v === 'dcac') {
        var Tc = r.pick([25, 27]), VT = VTof(Tc), n = r.pick([1, 1.5, 2]), Is = r.pick([1, 5, 10]) * Math.pow(10, r.int(-13, -10)), I = r.pick([1, 2, 4, 5, 10, 20]) * 1e-3;
        var Vd = n * VT * Math.log(I / Is + 1), RD = Vd / I, rd = n * VT / I;
        return {
          stem: 'At ' + Tc + ' °C a diode with $n = ' + n + '$ and $I_S = ' + te(Is, 'A') + '$ is biased at ' + pe(I, 'A') + '.',
          figure: null, given: [['$n$', String(n)], ['$I_S$', pe(Is, 'A')], ['$I_D$', pe(I, 'A')]],
          parts: [
            { q: '(a) Find $V_D$ and the static (dc) resistance $R_D$.', answers: [A('$V_D$', Vd, 'V', { sig: 4 }), A('$R_D$', RD, 'Ω')], working: st(['$V_T = ' + te(VT, 'V', 4) + '$.', '$V_D = nV_T\\ln(I_D/I_S) = ' + tn(Vd, 4) + '$ V.', '$R_D = V_D/I_D = ' + tn(Vd, 4) + '/' + tn(I) + '$']) + fin('R_D = ' + te(RD, 'Ω')) },
            { q: '(b) Find the small-signal resistance $r_d$. Which one does a 2 mV ac signal see?', answers: [A('$r_d$', rd, 'Ω')], working: st(['$r_d = nV_T/I_D = ' + tn(n * VT, 4) + '/' + tn(I) + ' = ' + te(rd, 'Ω') + '$.', 'A 2 mV signal is below about 5 mV, so it sees $r_d$ (the slope), which is ' + tn(RD / rd, 3) + ' times smaller than $R_D$.']) + fin('r_d = ' + te(rd, 'Ω')) }
          ],
          data: { v: v, Tc: Tc, n: n, Is: Is, I: I }
        };
      }
      if (v === 'pwl') {
        return r.retry(function () {
          var mat = r.pick([['Si', 0.7], ['Ge', 0.3], ['GaAs', 1.2]]), VK = mat[1];
          var I1 = r.pick([2, 4, 5]) * 1e-3, I2 = r.pick([20, 25, 30, 40]) * 1e-3, rav0 = r.float(2, 12, 1);
          var V1 = Math.round((VK + I1 * rav0) * 1000) / 1000, V2 = Math.round((VK + I2 * rav0) * 1000) / 1000;
          var rav = (V2 - V1) / (I2 - I1);
          var E = r.pick([1.5, 2, 3, 5]), Rs = r.pick([10, 22, 33, 47, 68, 100]);
          if (E < VK + 0.3) return null;
          var I = (E - VK) / (Rs + rav), Vd = VK + I * rav;
          var d = drw(), fig = null;
          if (d) { dcSrc(d, 40, 50, 170, 'E', E); d.resistor({ from: [40, 50], to: [150, 50], label: 'R', value: R(Rs) }); d.diode({ from: [150, 50], to: [150, 170], label: 'D', value: mat[0], side: 'right' }); d.ground([150, 170]); fig = svg(d, 'Diode and resistor'); }
          return {
            stem: 'Two points on the forward characteristic of a ' + mat[0] + ' diode are (' + pe(I1, 'A') + ', ' + V1.toFixed(3) + ' V) and (' + pe(I2, 'A') + ', ' + V2.toFixed(3) + ' V). The knee voltage is $V_K = ' + VK + '$ V. The diode is then connected in series with $R = ' + Rs + '\\ \\Omega$ across $E = ' + E + '$ V.',
            figure: fig, given: [['Point 1', pe(I1, 'A') + ', ' + V1.toFixed(3) + ' V'], ['Point 2', pe(I2, 'A') + ', ' + V2.toFixed(3) + ' V'], ['$V_K$', V(VK)]],
            parts: [
              { q: '(a) Find the average ac resistance $r_{av}$ for the third piecewise-linear model.', answers: [A('$r_{av}$', rav, 'Ω')], working: st(['Chord between the two points: $r_{av} = \\dfrac{\\Delta V_d}{\\Delta I_d} = \\dfrac{' + V2.toFixed(3) + ' - ' + V1.toFixed(3) + '}{' + tn(I2) + ' - ' + tn(I1) + '}$', 'Model: ideal diode + $V_K = ' + VK + '$ V + $r_{av}$.']) + fin('r_{av} = ' + te(rav, 'Ω')) },
              { q: '(b) Using that model, find the current and the diode voltage in the circuit.', answers: [A('$I_D$', I, 'A'), A('$V_D$', Vd, 'V', { sig: 4 })], working: st(['Assume ON. KVL: $E = IR + V_K + Ir_{av}$, so $I = \\dfrac{E - V_K}{R + r_{av}} = \\dfrac{' + E + ' - ' + VK + '}{' + Rs + ' + ' + tn(rav, 4) + '}$', 'Check: $I > 0$ ✓.', '$V_D = V_K + Ir_{av} = ' + VK + ' + ' + tn(I, 4) + '\\times' + tn(rav, 4) + '$ (more than $V_K$).']) + fin('I_D = ' + te(I, 'A') + ',\\quad V_D = ' + te(Vd, 'V', 4)) }
            ],
            data: { v: v, I1: I1, I2: I2, V1: V1, V2: V2, VK: VK, E: E, R: Rs }
          };
        });
      }
      // signal
      var VDD = r.pick([3, 5, 9, 10, 12]), Rr = r.eseries('E12', 1e3, 10e3), n2 = r.pick([1, 2]), vs = r.pick([5, 10, 20, 50]) * 1e-3, T = 27, VT2 = VTof(T);
      var ID = (VDD - 0.7) / Rr, rd2 = n2 * VT2 / ID, vd = vs * rd2 / (Rr + rd2);
      var d2 = drw(), fig2 = null;
      if (d2) { d2.acsrc({ from: [40, 200], to: [40, 140], label: 'v_s', side: 'left', signs: true }); d2.ground([40, 200]); d2.vsrc({ from: [40, 140], to: [40, 60], label: 'V_{DD}', value: V(VDD), side: 'left' }); d2.resistor({ from: [40, 60], to: [160, 60], label: 'R', value: R(Rr) }); d2.diode({ from: [160, 60], to: [160, 200], label: 'D', side: 'right' }); d2.ground([160, 200]); fig2 = svg(d2, 'Diode with dc bias and small signal'); }
      return {
        stem: 'A silicon diode ($n = ' + n2 + '$) is in series with $R = ' + R(Rr).replace(' ', '\\,') + '$ across $V_{DD} = ' + VDD + '$ V (anode towards the supply). A ' + pe(vs, 'V') + ' peak sinusoid is in series with the supply. Use $V_D = 0.7$ V for the dc analysis, at 27 °C.',
        figure: fig2, given: [['$V_{DD}$', V(VDD)], ['$R$', R(Rr)], ['$v_s$', pe(vs, 'V') + ' peak']],
        parts: [
          { q: '(a) Find the dc diode current and the small-signal resistance $r_d$.', answers: [A('$I_D$', ID, 'A'), A('$r_d$', rd2, 'Ω')], working: st(['DC (signal off): $I_D = \\dfrac{V_{DD} - 0.7}{R} = \\dfrac{' + VDD + ' - 0.7}{' + tn(Rr) + '}$', '$V_T = ' + te(VT2, 'V', 4) + '$, $r_d = nV_T/I_D = ' + tn(n2 * VT2, 4) + '/' + tn(ID, 4) + '$']) + fin('I_D = ' + te(ID, 'A') + ',\\quad r_d = ' + te(rd2, 'Ω')) },
          { q: '(b) Find the peak ac voltage across the diode.', answers: [A('$v_d$', vd, 'V')], working: st(['Small-signal circuit: $V_{DD}$ shorted, diode replaced by $r_d$. Voltage divider:', '$v_d = v_s\\dfrac{r_d}{R + r_d} = ' + tn(vs) + '\\times\\dfrac{' + tn(rd2, 4) + '}{' + tn(Rr) + ' + ' + tn(rd2, 4) + '}$']) + fin('v_d = ' + te(vd, 'V') + '\\ \\text{peak}') }
        ],
        data: { v: v, VDD: VDD, R: Rr, n: n2, vs: vs }
      };
    }
  });

  /* ---------------------------------------------------------------- models: decade rule diode string */
  function decadeV(I, m) { return 0.7 + m * Math.log10(I / 1e-3); }
  QB.add({
    id: 'edc.diode.models.decade', course: 'edc', module: 'diode', topic: 'models',
    title: 'Diode-string design with the decade rule', difficulty: 2, marks: 8,
    variants: [{ id: 'design', label: 'Design R for a target output' }, { id: 'supply', label: 'Design, then supply change via r_d' }, { id: 'load', label: 'Design, then add a load (iterate)' }],
    tags: ['WS3 Q3', 'EX1 Q2', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var N = r.int(2, 5), m = r.pick([0.06, 0.1, 0.12]), VDD = r.pick([5, 6, 9, 10, 12, 15]);
        var Vo = Math.round(N * r.float(0.6, 0.8, 3) * 10) / 10, Vd = Vo / N;
        if (VDD - Vo < 1.5) return null;
        var ID = 1e-3 * Math.pow(10, (Vd - 0.7) / m), Rr = (VDD - Vo) / ID;
        if (ID < 0.05e-3 || ID > 50e-3 || Rr < 100) return null;
        var d = drw(), fig = null;
        if (d) {
          dcSrc(d, 40, 50, 60 + N * 50 + 20, 'V_{DD}', VDD);
          d.resistor({ from: [40, 50], to: [160, 50], label: 'R' });
          for (var i = 0; i < N; i++) d.diode({ from: [160, 50 + i * 50], to: [160, 100 + i * 50], label: i === 0 ? 'D_1' : (i === N - 1 ? 'D_' + N : null), side: 'left' });
          d.line([160, 50 + N * 50], [160, 60 + N * 50 + 20]); d.ground([160, 60 + N * 50 + 20]);
          d.line([160, 50], [230, 50]);
          if (v === 'load') { d.dot([230, 50]); d.resistor({ from: [230, 50], to: [230, 60 + N * 50 + 20], label: 'R_L', side: 'right' }); d.ground([230, 60 + N * 50 + 20]); d.line([230, 50], [280, 50]); d.terminal([280, 50], { label: 'V_o', side: 'right' }); }
          else d.terminal([230, 50], { label: 'V_o', side: 'right' });
          fig = svg(d, 'Diode string');
        }
        var stem = 'A ' + VDD + ' V supply feeds a resistor $R$ into a string of ' + N + ' identical forward-biased silicon diodes in series. $V_o$ is taken across the whole string. Each diode drops 0.7 V at 1 mA, and the drop changes by ' + (m * 1000) + ' mV for every decade change in current.';
        var design = { q: '(a) Design for $V_o = ' + Vo + '$ V with no load: find the diode current and $R$.', answers: [A('$I_D$', ID, 'A'), A('$R$', Rr, 'Ω')],
          working: st(['Each diode drops $V_o/' + N + ' = ' + tn(Vd, 4) + '$ V.', 'That is $' + tn(Vd - 0.7, 3) + '$ V from 0.7 V, i.e. $' + tn((Vd - 0.7) / m, 3) + '$ decades: $I_D = 1\\text{ mA}\\times10^{(' + tn(Vd, 4) + '-0.7)/' + m + '} = ' + te(ID, 'A') + '$', '$R = \\dfrac{V_{DD} - V_o}{I_D} = \\dfrac{' + VDD + ' - ' + Vo + '}{' + tn(ID, 4) + '}$']) + fin('I_D = ' + te(ID, 'A') + ',\\quad R = ' + te(Rr, 'Ω')) };
        var parts = [design], data = { v: v, N: N, m: m, VDD: VDD, Vo: Vo };
        if (v === 'supply') {
          var dV = r.pick([0.5, 1]), nVT = m / Math.LN10, rd = nVT / ID, dVo = dV * N * rd / (Rr + N * rd);
          data.dV = dV;
          parts.push({ q: '(b) Find the incremental resistance of one diode at the design point, and estimate the change in $V_o$ when the supply changes by ±' + dV + ' V.', answers: [A('$r_d$', rd, 'Ω'), A('$\\Delta V_o$', dVo, 'V')],
            working: st([(m * 1000) + ' mV per decade means $2.303\\,nV_T = ' + m + '$ V, so $nV_T = ' + m + '/\\ln 10 = ' + te(nVT, 'V', 4) + '$.', '$r_d = nV_T/I_D = ' + tn(nVT, 4) + '/' + tn(ID, 4) + ' = ' + te(rd, 'Ω') + '$ per diode; the string is $' + N + 'r_d = ' + te(N * rd, 'Ω') + '$.', 'Small-signal divider: $\\Delta V_o = \\Delta V_{DD}\\dfrac{' + N + 'r_d}{R + ' + N + 'r_d} = ' + dV + '\\times\\dfrac{' + tn(N * rd, 4) + '}{' + tn(Rr, 4) + ' + ' + tn(N * rd, 4) + '}$']) + fin('r_d = ' + te(rd, 'Ω') + ',\\quad \\Delta V_o = \\pm' + te(dVo, 'V')) });
        }
        if (v === 'load') {
          var RL = r.eseries('E12', Vo / ID * 1.2, Vo / ID * 8);
          // solve Vo' = N*decadeV(ID'), ID' = (VDD-Vo')/R - Vo'/RL  (bisection on Vo')
          var lo = 0.01, hi = Vo, f = function (x) { var Ix = (VDD - x) / Rr - x / RL; if (Ix <= 0) return -1e9; return N * decadeV(Ix, m) - x; };
          if (f(lo) < 0) return null;
          for (var k = 0; k < 200; k++) { var mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
          var VoL = (lo + hi) / 2, IDL = (VDD - VoL) / Rr - VoL / RL;
          if (IDL < 0.01e-3 || IDL > 0.9 * ID) return null;
          // two iteration rows for the working
          var x0 = Math.round((Vo - N * m * 0.5) * 100) / 100, rows = [];
          var x = x0;
          for (var it = 0; it < 3; it++) { var IR = (VDD - x) / Rr, IL = x / RL, Id = IR - IL; var xn = Id > 0 ? N * decadeV(Id, m) : x; rows.push([String(it + 1) + ' ($V_o$ = ' + x.toFixed(4) + ' V)', pe(IR, 'A', 4), pe(IL, 'A', 4), pe(Id, 'A', 4), xn.toFixed(4) + ' V']); x = xn; }
          data.RL = RL; data.R = Rr;
          parts.push({ q: '(b) A load $R_L = ' + R(RL).replace(' ', '\\,') + '$ is connected across the string. Keeping $R$ from (a), find the new $V_o$ and the diode current by iteration.', answers: [A('$V_o$', VoL, 'V', { sig: 4 }), A('$I_D$', IDL, 'A')],
            working: st(['Diode law: $V_o = ' + N + '\\left[0.7 + ' + m + '\\log_{10}(I_D/1\\text{ mA})\\right]$. KCL: $I_D = (V_{DD} - V_o)/R - V_o/R_L$.', 'Iterate from a guess just below the no-load value:']) + QB.tbl(['Iteration', '$I_R$', '$I_L$', '$I_D$', 'new $V_o$'], rows) + st(['Converged: $V_o = ' + VoL.toFixed(4) + '$ V, $I_D = ' + te(IDL, 'A', 4) + '$.']) + fin('V_o = ' + te(VoL, 'V', 4) + ',\\quad I_D = ' + te(IDL, 'A')) });
        }
        return { stem: stem, figure: fig, given: [['$V_{DD}$', V(VDD)], ['$N$', String(N)], ['Decade step', (m * 1000) + ' mV']], parts: parts, notes: QB.callout('trap', 'The decade rule is the point of the question: do not force 0.7 V per diode.'), data: data };
      });
    }
  });

  /* ---------------------------------------------------------------- dcct: series string */
  var MODELS = {
    ideal: 'the ideal model (1st): ON = short circuit, OFF = open circuit',
    cvd: 'the constant-voltage-drop model (2nd): Si 0.7 V, Ge 0.3 V',
    pwl: 'the third piecewise-linear model: $V_D$ in series with $r_D$'
  };
  QB.add({
    id: 'edc.diode.dcct.series', course: 'edc', module: 'diode', topic: 'dcct',
    title: 'Series diode string: verify conduction, find I and V_o', difficulty: 2, marks: 8,
    variants: [{ id: 'ideal', label: 'Ideal diodes' }, { id: 'cvd', label: 'Constant drop (Si / Ge mix)' }, { id: 'pwl', label: 'Third model (V_D + r_D)' }],
    tags: ['PT Q3', 'WS3 Q7', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var N = r.int(1, 3);
        var orient = N >= 2 ? r.pickw([[6, 'fwd'], [2, 'rev'], [2, 'mixed']]) : r.pickw([[7, 'fwd'], [3, 'rev']]);
        var pV = r.pick([0.6, 0.7]), prD = r.pick([0.05, 0.1, 0.2]) * 1e3;
        var diodes = [];
        for (var i = 0; i < N; i++) {
          var mat = v === 'cvd' ? r.pick(['Si', 'Si', 'Ge']) : 'Si';
          var vd = v === 'ideal' ? 0 : v === 'pwl' ? pV : (mat === 'Si' ? 0.7 : 0.3);
          diodes.push({ dir: orient === 'rev' ? -1 : 1, mat: mat, VD: vd, rD: v === 'pwl' ? prD : 0 });
        }
        if (orient === 'mixed') diodes[r.int(0, N - 1)].dir = -1;
        var V1 = r.pick([3, 5, 6, 8, 10, 12, 15]), R1 = r.eseries('E12', 1e3, 10e3), R2 = r.eseries('E12', 1e3, 10e3);
        var RA = r.bool(v === 'pwl' ? 0.6 : 0.35) ? r.eseries('E12', 1e3, 10e3) : 0;
        var V2 = orient === 'rev' ? r.pick([5, 8, 10, 12, 15]) : r.pick([-5, -3, -2, 0, 0, 2, 3, 5]);
        if (orient === 'rev') V1 = r.pick([0, 0, 2, 3]);
        var VTh = RA ? V1 * RA / (R1 + RA) : V1, RTh = RA ? par(R1, RA) : R1;
        var sV = 0, srD = 0; diodes.forEach(function (x) { sV += x.VD; srD += x.rD; });
        var drive = orient === 'fwd' ? VTh - V2 - sV : orient === 'rev' ? V2 - VTh - sV : -1;
        var on = orient !== 'mixed' && drive > 0;
        if (orient !== 'mixed') { if (on && (drive < 0.2)) return null; if (!on && drive > -0.3) return null; }
        var Rt = RTh + R2 + srD, I = on ? drive / Rt : 0;
        if (on && I < 20e-6) return null;
        var dir = orient === 'rev' ? -1 : 1;
        var VB = on ? V2 + dir * I * R2 : V2, VA = on ? VTh - dir * I * RTh : VTh;
        var names = diodes.map(function (x, i) { return 'D_' + (i + 1); });
        var fig = figSeries({ V1: V1, R1: R1, RA: RA, diodes: diodes.map(function (x) { return { dir: x.dir, mat: v === 'cvd' ? x.mat : null }; }), R2: R2, V2: V2 });
        var mstr = v === 'ideal' ? 'ideal' : v === 'cvd' ? 'constant-drop (Si 0.7 V, Ge 0.3 V)' : 'third piecewise-linear ($V_D = ' + pV + '$ V, $r_D = ' + R(prD).replace(' ', '\\,') + '$ each)';
        var stem = 'In the circuit, ' + V1 + ' V feeds $R_1$ to node A' + (RA ? ', which also has $R_A$ to ground' : '') + '. ' + (N === 1 ? 'A diode connects' : N + ' diodes in series connect') + ' A to node B ($V_o$), and $R_2$ returns B to ' + (V2 === 0 ? 'ground' : 'the + terminal of a ' + abs(V2) + ' V source' + (V2 < 0 ? ' connected the other way up (B side at −' + abs(V2) + ' V)' : '')) + '. Use the ' + mstr + ' diode model.';
        var w = ['Model: ' + MODELS[v] + '.'];
        if (RA) w.push('Thévenin at A (the shunt $R_A$ must stay in): $V_{Th} = V_1\\dfrac{R_A}{R_1+R_A} = ' + V1 + '\\times\\dfrac{' + tn(RA) + '}{' + tn(R1 + RA) + '} = ' + te(VTh, 'V', 4) + '$, $R_{Th} = R_1\\parallel R_A = ' + te(RTh, 'Ω', 4) + '$.');
        else w.push('Node A is fed directly: $V_{Th} = ' + V1 + '$ V through $R_{Th} = R_1 = ' + te(R1, 'Ω') + '$.');
        var sumTxt = v === 'ideal' ? '0' : diodes.map(function (x) { return x.VD; }).join(' + ');
        if (orient === 'mixed') {
          var k = diodes.map(function (x) { return x.dir; }).indexOf(-1);
          w.push('$' + names[k] + '$ points the other way to the rest of the string, so no current can flow A→B or B→A: every diode in a series string must conduct in the same direction. All diodes are OFF and $I = 0$.');
          w.push('Check: with $I = 0$ no resistor drops anything, so $V_A = ' + tn(VTh, 4) + '$ V and $V_B = V_2 = ' + V2 + '$ V. The reversed diode blocks the ' + tn(abs(VTh - V2), 3) + ' V difference ✓.');
        } else {
          var fwd = orient === 'fwd';
          w.push((fwd ? 'All anodes face A' : 'All anodes face B') + ', so the only possible current is ' + (fwd ? 'A → B' : 'B → A') + '. Assume ' + (N === 1 ? 'the diode' : 'all ' + N) + ' ON with current $I$ ' + (fwd ? 'from A to B' : 'from B to A') + '.');
          var kvl = fwd ? 'V_{Th} - IR_{Th} - (' + sumTxt + ')' + (srD ? ' - ' + (N > 1 ? N : '') + 'r_DI' : '') + ' - IR_2 - (' + V2 + ') = 0' : 'V_2 - IR_2 - (' + sumTxt + ')' + (srD ? ' - ' + (N > 1 ? N : '') + 'r_DI' : '') + ' - IR_{Th} - V_{Th} = 0';
          w.push('KVL round the loop: $' + kvl + '$');
          var I0 = drive / Rt;
          w.push('$I = \\dfrac{' + (fwd ? tn(VTh, 4) + ' - (' + V2 + ')' : V2 + ' - ' + tn(VTh, 4)) + ' - ' + tn(sV, 3) + '}{' + tn(RTh, 4) + ' + ' + tn(R2) + (srD ? ' + ' + tn(srD * N) : '') + '} = ' + te(I0, 'A', 4) + '$');
          if (on) {
            w.push('Check: $I = ' + te(I, 'A', 3) + ' > 0$' + (N > 1 ? ', and the same current flows through every diode, so all ' + N + ' are conducting ✓.' : ', so the diode is conducting ✓.'));
            if (v === 'pwl') w.push('Each diode drops $V_D + Ir_D = ' + pV + ' + ' + tn(I * prD, 3) + ' = ' + tn(pV + I * prD, 4) + '$ V.');
            w.push('$V_o = V_B = V_2 ' + (fwd ? '+' : '-') + ' IR_2 = ' + V2 + (fwd ? ' + ' : ' - ') + tn(I * R2, 4) + '$');
          } else {
            w.push('$I < 0$: the assumption fails, so ' + (N > 1 ? 'the string is' : 'the diode is') + ' OFF and $I = 0$.');
            w.push('Check OFF: the string sees $V_A - V_B = ' + tn(VTh, 4) + ' - (' + V2 + ') = ' + tn(VTh - V2, 4) + '$ V ' + (fwd ? '' : '(i.e. $V_B - V_A = ' + tn(V2 - VTh, 4) + '$ V) ') + 'which is less than the ' + tn(sV, 3) + ' V needed to turn it on ✓. With no current, $V_o = V_2$.');
          }
        }
        return {
          stem: stem, figure: fig,
          given: [['$V_1$', V(V1)], ['$R_1$', R(R1)]].concat(RA ? [['$R_A$', R(RA)]] : []).concat([['$R_2$', R(R2)], ['$V_2$', V(V2)]]),
          parts: [
            { q: '(a) State and verify the state of the diodes, and find the current $I$ through the string (0 if off).', answers: [A('$I$', I, 'A', { abs: 2e-6 })], working: st(w) + fin('I = ' + te(I, 'A') + (on ? '\\ (\\text{all ON})' : '\\ (\\text{all OFF})')) },
            { q: '(b) Find the output voltage $V_o$.', answers: [A('$V_o$', VB, 'V', { abs: 0.01, sig: 4 })], working: st(on ? ['$V_o = V_B = ' + te(VB, 'V', 4) + '$', 'For reference, $V_A = ' + te(VA, 'V', 4) + '$.'] : ['No current flows in $R_2$, so $V_o = V_2 = ' + V2 + '$ V.']) + fin('V_o = ' + te(VB, 'V', 4)) }
          ],
          notes: QB.callout('trap', (RA ? 'Do not drop the shunt $R_A$ at node A: use the Thévenin source. ' : '') + 'ON needs a current check; OFF needs a voltage check.'),
          data: { v: v, V1: V1, R1: R1, RA: RA, R2: R2, V2: V2, diodes: diodes }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- dcct: parallel diodes */
  QB.add({
    id: 'edc.diode.dcct.parallel', course: 'edc', module: 'diode', topic: 'dcct',
    title: 'Parallel diodes: current sharing and which one conducts', difficulty: 2, marks: 5,
    variants: [{ id: 'same', label: 'Identical pair' }, { id: 'mixed', label: 'Si in parallel with Ge' }, { id: 'combo', label: 'Series diode plus a parallel pair' }],
    tags: ['WS3 Q7(b)'],
    gen: function (r, v) {
      return r.retry(function () {
        var V1 = r.pick([5, 8, 10, 12, 16, 20]), V2 = r.pick([-5, -4, 0, 0, 2]), R1 = r.eseries('E12', 0.47e3, 4.7e3), R2 = r.eseries('E12', 1e3, 10e3);
        var Da = 'Si', Db = 'Si', Ds = null;
        if (v === 'same') { Da = Db = r.pick(['Si', 'Ge']); }
        if (v === 'mixed') { if (r.bool()) { Da = 'Si'; Db = 'Ge'; } else { Da = 'Ge'; Db = 'Si'; } }
        if (v === 'combo') { Ds = r.pick(['Si', 'Ge']); Da = Db = 'Si'; }
        var vd = function (m) { return m === 'Si' ? 0.7 : 0.3; };
        var Vpar = Math.min(vd(Da), vd(Db)), Vs = Ds ? vd(Ds) : 0, drop = Vpar + Vs;
        var I = (V1 - drop - V2) / (R1 + R2);
        if (I < 0.2e-3) return null;
        var Ia, Ib;
        if (Da === Db) { Ia = Ib = I / 2; } else if (vd(Da) < vd(Db)) { Ia = I; Ib = 0; } else { Ia = 0; Ib = I; }
        var Vo = V2 + I * R2;
        var fig = figParallel({ V1: V1, R1: R1, Dser: Ds, Da: Da, Db: Db, R2: R2, V2: V2 });
        var w = ['Constant-drop model: Si 0.7 V, Ge 0.3 V.'];
        if (Da === Db) w.push('$D_1$ and $D_2$ are identical and in parallel: both conduct, and together they drop one ' + vd(Da) + ' V (not two). By symmetry each carries half the current.');
        else { var on = vd(Da) < vd(Db) ? 'D_1' : 'D_2', off = on === 'D_1' ? 'D_2' : 'D_1'; w.push('The Ge diode turns on first and clamps the pair at 0.3 V. The Si diode then sees only 0.3 V < 0.7 V, so $' + off + '$ (Si) is OFF and $' + on + '$ (Ge) carries all of $I$.'); }
        if (Ds) w.push('The series diode $D_s$ (' + Ds + ') adds ' + Vs + ' V.');
        w.push('KVL: $I = \\dfrac{V_1 - ' + tn(drop, 3) + ' - (' + V2 + ')}{R_1 + R_2} = \\dfrac{' + tn(V1 - drop - V2, 4) + '}{' + tn(R1 + R2, 4) + '} = ' + te(I, 'A', 4) + '$. $I > 0$ ✓.');
        w.push('$V_o = V_2 + IR_2 = ' + V2 + ' + ' + tn(I * R2, 4) + '$');
        return {
          stem: 'Find the currents and the output voltage for the network shown. Use the constant-voltage-drop model (Si 0.7 V, Ge 0.3 V).',
          figure: fig,
          given: [['$V_1$', V(V1)], ['$R_1$', R(R1)], ['$R_2$', R(R2)], ['$V_2$', V(V2)]],
          parts: [{ q: '(a) Find the total current $I$, the diode currents $I_{D1}$, $I_{D2}$, and $V_o$.', answers: [A('$I$', I, 'A'), A('$I_{D1}$', Ia, 'A', { abs: 2e-6 }), A('$I_{D2}$', Ib, 'A', { abs: 2e-6 }), A('$V_o$', Vo, 'V', { sig: 4 })], working: st(w) + fin('I = ' + te(I, 'A') + ',\\ I_{D1} = ' + te(Ia, 'A') + ',\\ I_{D2} = ' + te(Ib, 'A') + ',\\ V_o = ' + te(Vo, 'V', 4)) }],
          notes: QB.callout('trap', 'Two diodes in parallel drop one $V_D$, not two. A Ge diode in parallel with a Si one steals all the current.'),
          data: { v: v, V1: V1, V2: V2, R1: R1, R2: R2, Da: Da, Db: Db, Ds: Ds }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- dcct: assume and verify (single-node networks) */
  // branch: {E, R, s (0 plain, +1 anode at node, -1 cathode at node), VD, rD, name}
  function nodeSolve(br, on) {
    var num = 0, den = 0;
    br.forEach(function (b, i) {
      if (!b.s) { num += b.E / b.R; den += 1 / b.R; }
      else if (on[i]) { var Rt = b.R + (b.rD || 0); num += (b.E + b.s * b.VD) / Rt; den += 1 / Rt; }
    });
    var Vn = num / den;
    var res = br.map(function (b, i) {
      if (!b.s) return { i: (Vn - b.E) / b.R };
      if (on[i]) { var il = (Vn - b.s * b.VD - b.E) / (b.R + (b.rD || 0)); return { id: b.s * il, ok: b.s * il > 0 }; }
      var vdd = b.s * (Vn - b.E); return { id: 0, vd: vdd, ok: vdd < b.VD };
    });
    return { V: Vn, res: res, ok: res.every(function (x) { return x.ok !== false; }) };
  }
  QB.add({
    id: 'edc.diode.dcct.assume', course: 'edc', module: 'diode', topic: 'dcct',
    title: 'Which diodes are ON? Assume, analyse, verify', difficulty: 3, marks: 8,
    variants: [{ id: 'compete', label: 'Two diodes from one node, opposing source' }, { id: 'branches', label: 'Opposite diodes, input of either polarity' }, { id: 'orgate', label: 'Diode OR gate, unequal inputs' }],
    tags: ['WS3 Q16', 'WS3 Q17', 'E2 N4–N6', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var pwl = r.bool(0.4), VD = pwl ? 0.7 : r.pick([0.7, 0.7, 0.5]), rD = pwl ? r.pick([0.1, 0.2]) * 1e3 : 0;
        var br, guess, nodeLbl, stem, figp, tapIdx = -1, labels;
        if (v === 'compete') {
          var V1 = r.pick([8, 10, 12, 15]), R1 = r.eseries('E12', 1e3, 4.7e3), R2 = r.eseries('E12', 1e3, 4.7e3), R3 = r.eseries('E12', 0.47e3, 2.2e3), V2 = r.pick([3, 4, 5, 6, 8, 9]);
          br = [{ E: V1, R: R1, s: 0 }, { E: 0, R: R2, s: 1, VD: VD, rD: rD, name: 'D_1' }, { E: V2, R: R3, s: 1, VD: VD, rD: rD, name: 'D_2' }];
          guess = [false, true, true]; nodeLbl = 'V_A'; tapIdx = 1;
          stem = 'A ' + V1 + ' V supply feeds $R_1$ to node A. From A, diode $D_1$ (anode at A) goes to node B, which has $R_2$ to ground; $V_o$ is the voltage at B. Also from A, $D_2$ (anode at A) goes through $R_3$ to the + terminal of a ' + V2 + ' V source whose − terminal is grounded.';
          figp = { nodeLabel: 'A', branches: [{ feed: true, E: V1, R: R1, Elabel: 'V_1', Rlabel: 'R_1' }, { diode: 'D_1', s: 1, R: R2, Rlabel: 'R_2', tap: 'V_o' }, { diode: 'D_2', s: 1, R: R3, Rlabel: 'R_3', E: V2, Elabel: 'V_2' }] };
        } else if (v === 'branches') {
          var Vi = r.sign() * r.pick([5, 6, 8, 10, 12]), Rs = r.eseries('E12', 1e3, 2.2e3), Vb1 = r.pick([1, 2, 3]), Rb1 = r.eseries('E12', 0.47e3, 1.5e3), Rb2 = r.eseries('E12', 0.47e3, 2.2e3), Vb2 = r.pick([0, 0, 1, 2]), R3 = r.bool(0.6) ? r.eseries('E12', 2.2e3, 10e3) : 0;
          br = [{ E: Vi, R: Rs, s: 0 }, { E: Vb1, R: Rb1, s: 1, VD: VD, rD: rD, name: 'D_1' }, { E: -Vb2, R: Rb2, s: -1, VD: VD, rD: rD, name: 'D_2' }];
          if (R3) br.push({ E: 0, R: R3, s: 0 });
          guess = Vi > 0 ? [false, true, false, false] : [false, false, true, false];
          nodeLbl = 'V_o';
          stem = '$V_i = ' + Vi + '$ V feeds $R$ to node A ($V_o$). Branch 1 from A to ground: $D_1$ (anode at A), a ' + Vb1 + ' V battery with + facing $D_1$, and $R_1$. Branch 2: $D_2$ with its cathode at A, its anode through $R_2$' + (Vb2 ? ' to the − terminal of a ' + Vb2 + ' V battery (+ grounded)' : ' to ground') + '.' + (R3 ? ' Branch 3: $R_3$ to ground.' : '');
          figp = { nodeLabel: 'V_o', branches: [{ feed: true, E: Vi, R: Rs, Elabel: 'V_i', Rlabel: 'R' }, { diode: 'D_1', s: 1, R: Rb1, Rlabel: 'R_1', E: Vb1, Elabel: 'V_{B1}' }, { diode: 'D_2', s: -1, R: Rb2, Rlabel: 'R_2', E: -Vb2, Elabel: 'V_{B2}' }].concat(R3 ? [{ R: R3, Rlabel: 'R_3' }] : []) };
        } else {
          var Va = r.pick([5, 6, 8, 10]), Vb = r.bool(0.2) ? 0 : Va - r.pick([0.2, 0.4, 0.5, 1, 2, 3]), Ra = r.eseries('E12', 1e3, 2.2e3), Rb = r.bool(0.6) ? Ra : r.eseries('E12', 1e3, 2.2e3), RL = r.eseries('E12', 2.2e3, 10e3);
          br = [{ E: Va, R: Ra, s: -1, VD: VD, rD: rD, name: 'D_1' }, { E: Vb, R: Rb, s: -1, VD: VD, rD: rD, name: 'D_2' }, { E: 0, R: RL, s: 0 }];
          guess = [true, true, false]; nodeLbl = 'V_o';
          stem = 'Diode OR gate: $V_1 = ' + Va + '$ V feeds $R_1$ then $D_1$ (anode on the input side) to node $V_o$; $V_2 = ' + Vb + '$ V feeds $R_2$ then $D_2$ to the same node. $V_o$ has $R_L$ to ground.';
          figp = { nodeLabel: 'V_o', branches: [{ feed: true, E: Va, R: Ra, Elabel: 'V_1', Rlabel: 'R_1', diode: 'D_1', s: -1 }, { feed: true, E: Vb, R: Rb, Elabel: 'V_2', Rlabel: 'R_2', diode: 'D_2', s: -1 }, { R: RL, Rlabel: 'R_L' }] };
        }
        stem += ' Use ' + (pwl ? 'the third model, $V_D = ' + VD + '$ V and $r_D = ' + R(rD).replace(' ', '\\,') + '$.' : 'the constant-drop model, $V_D = ' + VD + '$ V.');
        // enumerate for uniqueness and margins
        var di = []; br.forEach(function (b, i) { if (b.s) di.push(i); });
        var sols = [];
        for (var mask = 0; mask < (1 << di.length); mask++) {
          var on = br.map(function () { return false; });
          di.forEach(function (ix, k) { on[ix] = !!(mask & (1 << k)); });
          var s = nodeSolve(br, on); if (s.ok) sols.push({ on: on, s: s });
        }
        if (sols.length !== 1) return null;
        var sol = sols[0];
        var marginOK = di.every(function (ix) { var x = sol.s.res[ix]; return sol.on[ix] ? x.id > 30e-6 : x.vd < br[ix].VD - 0.05; });
        if (!marginOK) return null;
        // assume-check iterations from the guess
        var state = guess.slice(), attempts = [], seen = {};
        for (var it = 0; it < 4; it++) {
          var key = state.join(','); if (seen[key]) break; seen[key] = 1;
          var s2 = nodeSolve(br, state); attempts.push({ on: state.slice(), s: s2 });
          if (s2.ok) break;
          var worst = -1, wv = 0;
          di.forEach(function (ix) { var x = s2.res[ix]; if (state[ix] && x.id <= 0 && -x.id >= wv) { wv = -x.id; worst = ix; } });
          if (worst < 0) di.forEach(function (ix) { var x = s2.res[ix]; if (!state[ix] && x.vd >= br[ix].VD && x.vd - br[ix].VD > wv) { wv = x.vd - br[ix].VD; worst = ix; } });
          if (worst < 0) break;
          state[worst] = !state[worst];
        }
        if (!attempts[attempts.length - 1].s.ok) return null;
        var w = [];
        attempts.forEach(function (at, k) {
          var desc = di.map(function (ix) { return '$' + br[ix].name + '$ ' + (at.on[ix] ? 'ON' : 'OFF'); }).join(', ');
          var line = '<b>Attempt ' + (k + 1) + ': assume ' + desc + '.</b> ';
          var terms = br.map(function (b, i) {
            if (!b.s) return '\\dfrac{V - (' + tn(b.E, 4) + ')}{' + tn(b.R, 4) + '}';
            if (!at.on[i]) return null;
            return '\\dfrac{V ' + (b.s > 0 ? '-' : '+') + ' ' + b.VD + ' - (' + tn(b.E, 4) + ')}{' + tn(b.R + (b.rD || 0), 4) + '}';
          }).filter(Boolean);
          line += 'KCL at the node (currents leaving, ON diodes replaced by ' + (pwl ? '$V_D$ + $r_D$' : '$V_D$') + ', OFF diodes open): $' + terms.join(' + ') + ' = 0$, so $V = ' + te(at.s.V, 'V', 4) + '$. ';
          var checks = di.map(function (ix) {
            var x = at.s.res[ix], nm = br[ix].name;
            if (at.on[ix]) return '$i_{' + nm.replace('D_', 'd') + '} = ' + te(x.id, 'A', 3) + (x.ok ? ' > 0$ ✓' : ' < 0$ ✗');
            return '$v_{' + nm.replace('D_', 'd') + '} = ' + te(x.vd, 'V', 3) + (x.ok ? ' < ' + br[ix].VD + '$ V ✓' : ' \\ge ' + br[ix].VD + '$ V ✗');
          });
          line += 'Check: ' + checks.join(', ') + '. ' + (at.s.ok ? 'All checks pass.' : 'The assumption fails; flip that diode.');
          w.push(line);
        });
        var fs = sol.s, Vn = fs.V;
        var Id1 = fs.res[di[0]].id, Id2 = fs.res[di[1]].id;
        var ansV = Vn, ansLbl = '$' + nodeLbl + '$';
        var parts = [{ q: '(a) Assume a state for each diode, analyse, and verify. Find the node voltage and both diode currents (0 for an OFF diode).',
          answers: [A(ansLbl, Vn, 'V', { abs: 0.01, sig: 4 }), A('$I_{D1}$', Id1, 'A', { abs: 5e-6 }), A('$I_{D2}$', Id2, 'A', { abs: 5e-6 })],
          working: st(w) + fin(nodeLbl + ' = ' + te(Vn, 'V', 4) + ',\\ I_{D1} = ' + te(Id1, 'A') + ',\\ I_{D2} = ' + te(Id2, 'A')) }];
        if (v === 'compete') {
          var Vo = Id1 * br[1].R;
          parts.push({ q: '(b) Find $V_o$ (the voltage at B).', answers: [A('$V_o$', Vo, 'V', { abs: 0.01, sig: 4 })], working: st(['$V_o = I_{D1}R_2 = ' + tn(Id1, 4) + '\\times' + tn(br[1].R) + '$']) + fin('V_o = ' + te(Vo, 'V', 4)) });
        }
        return {
          stem: stem, figure: figNode(figp),
          given: figp.branches.map(function (b) { return [b.feed ? '$' + b.Elabel + '$, $' + b.Rlabel + '$' + (b.diode ? ', $' + b.diode + '$' : '') : (b.diode ? '$' + b.diode + '$ branch' : '$' + b.Rlabel + '$'), (b.feed ? V(b.E) + ', ' : (b.E ? V(b.E) + ' battery, ' : '')) + R(b.R)]; }),
          parts: parts,
          notes: QB.callout('tip', 'Flip only the diode whose check failed (most negative current first), then re-solve. Write every check out: that is where the marks are.'),
          data: { v: v, br: br }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- rect: no filter */
  QB.add({
    id: 'edc.diode.rect.nofilter', course: 'edc', module: 'diode', topic: 'rect',
    title: 'Rectifier without a filter: V_P, V_dc, PIV and output frequency', difficulty: 1, marks: 5,
    variants: [{ id: 'hw', label: 'Half-wave' }, { id: 'ct', label: 'Centre-tapped full-wave' }, { id: 'bridge', label: 'Bridge' }, { id: 'rf', label: 'Diode resistance r_f: currents, powers, efficiency' }],
    tags: ['WS3 Q11', 'WS3 Q20', 'WS3 Q21'],
    gen: function (r, v) {
      var f = r.pick([50, 60]);
      if (v === 'rf') {
        var kind = r.pick(['hw', 'bridge']), Vm = r.pick([20, 50, 100, 120, 240]), rf = r.pick([10, 20, 25, 50]), RL = r.pick([200, 460, 500, 800, 1000]);
        var Rp = (kind === 'bridge' ? 2 * rf : rf) + RL, Im = Vm / Rp, fw = kind === 'bridge';
        var Idc = fw ? 2 * Im / Math.PI : Im / Math.PI, Irms = fw ? Im / Math.SQRT2 : Im / 2, Vdc = Idc * RL, Pac = Irms * Irms * Rp, Pdc = Idc * Idc * RL, eta = Pdc / Pac * 100;
        var fig = figRect(fw ? 'bridge' : 'hw', { RL: R(RL) });
        return {
          stem: 'A ' + (fw ? 'bridge' : 'half-wave') + ' rectifier is fed by $v_s = ' + Vm + '\\sin(2\\pi\\,' + f + 't)$ V. Each diode has zero forward drop but an internal resistance $r_f = ' + rf + '\\ \\Omega$. The load is $R_L = ' + RL + '\\ \\Omega$.',
          figure: fig, given: [['$V_m$', V(Vm)], ['$r_f$', R(rf)], ['$R_L$', R(RL)]],
          parts: [
            { q: '(a) Find the peak load current $I_m$, the dc load current $I_{dc}$ and the rms load current.', answers: [A('$I_m$', Im, 'A'), A('$I_{dc}$', Idc, 'A'), A('$I_{rms}$', Irms, 'A')],
              working: st([(fw ? 'Two diodes conduct in series at any instant, so the path resistance is $2r_f + R_L = ' + Rp + '\\ \\Omega$.' : 'One diode conducts, path resistance $r_f + R_L = ' + Rp + '\\ \\Omega$.'), '$I_m = V_m/' + Rp + ' = ' + te(Im, 'A', 4) + '$', fw ? '$I_{dc} = 2I_m/\\pi$, $I_{rms} = I_m/\\sqrt2$' : '$I_{dc} = I_m/\\pi$, $I_{rms} = I_m/2$ (current flows for half the cycle)']) + fin('I_m = ' + te(Im, 'A') + ',\\ I_{dc} = ' + te(Idc, 'A') + ',\\ I_{rms} = ' + te(Irms, 'A')) },
            { q: '(b) Find the dc load voltage, the input ac power, the dc output power and the efficiency.', answers: [A('$V_{dc}$', Vdc, 'V'), A('$P_{ac}$', Pac, 'W'), A('$P_{dc}$', Pdc, 'W'), A('$\\eta$', eta, '%')],
              working: st(['$V_{dc} = I_{dc}R_L = ' + te(Vdc, 'V', 4) + '$', '$P_{ac} = I_{rms}^2(' + (fw ? '2r_f' : 'r_f') + ' + R_L) = ' + te(Pac, 'W', 4) + '$', '$P_{dc} = I_{dc}^2R_L = ' + te(Pdc, 'W', 4) + '$', '$\\eta = P_{dc}/P_{ac} = ' + tn(eta, 3) + '\\%$']) + fin('\\eta = ' + tn(eta, 3) + '\\%') }
          ],
          data: { v: v, kind: kind, Vm: Vm, rf: rf, RL: RL }
        };
      }
      var Vrms = r.pick([6, 9, 10, 12, 15, 18, 24]), VD = r.bool(0.8) ? 0.7 : 0, RL = r.eseries('E12', 470, 10e3);
      var Vm = Math.SQRT2 * Vrms, nD = v === 'bridge' ? 2 : 1, VP = Vm - nD * VD, fw = v !== 'hw';
      var Vdc = fw ? 2 * VP / Math.PI : VP / Math.PI, Idc = Vdc / RL, PIV = v === 'hw' ? Vm : v === 'ct' ? 2 * Vm - VD : Vm - VD, fo = fw ? 2 * f : f;
      var fig = figRect(v, { RL: R(RL) });
      var nm = { hw: 'half-wave', ct: 'centre-tapped full-wave', bridge: 'bridge full-wave' }[v];
      return {
        stem: 'A ' + nm + ' rectifier is fed from a transformer secondary of ' + Vrms + ' V rms' + (v === 'ct' ? ' on <i>each half</i> of the winding' : '') + ' at ' + f + ' Hz. ' + (VD ? 'The diodes are silicon (0.7 V).' : 'Treat the diodes as ideal.') + ' There is no filter capacitor and the load is $R_L = ' + R(RL).replace(' ', '\\,') + '$.',
        figure: fig, given: [['$V_{s(rms)}$', V(Vrms)], ['$f$', f + ' Hz'], ['$V_D$', V(VD)], ['$R_L$', R(RL)]],
        parts: [
          { q: '(a) Find the peak output voltage $V_P$, the dc output voltage and the dc load current.', answers: [A('$V_P$', VP, 'V'), A('$V_{dc}$', Vdc, 'V'), A('$I_{dc}$', Idc, 'A')],
            working: st(['$V_m = \\sqrt2\\,V_{s(rms)} = \\sqrt2\\times' + Vrms + ' = ' + tn(Vm, 4) + '$ V' + (v === 'ct' ? ' (per half-winding)' : '') + '.', nD + ' diode drop' + (nD > 1 ? 's' : '') + ' in the conduction path: $V_P = ' + tn(Vm, 4) + ' - ' + (nD * VD) + ' = ' + tn(VP, 4) + '$ V.', fw ? '$V_{dc} = 2V_P/\\pi = 0.636V_P$' : '$V_{dc} = V_P/\\pi = 0.318V_P$', '$I_{dc} = V_{dc}/R_L$']) + fin('V_P = ' + te(VP, 'V') + ',\\ V_{dc} = ' + te(Vdc, 'V') + ',\\ I_{dc} = ' + te(Idc, 'A')) },
          { q: '(b) Find the peak inverse voltage of each diode and the output frequency.', answers: [A('PIV', PIV, 'V'), A('$f_o$', fo, 'Hz')],
            working: st([v === 'hw' ? 'Half-wave: the OFF diode sees the full secondary peak, PIV $= V_m$.' : v === 'ct' ? 'Centre tap: the OFF diode sees the whole secondary minus the output, PIV $= 2V_m - V_D$.' : 'Bridge: each OFF diode sees the secondary peak less one conducting drop, PIV $= V_m - V_D$.', 'PIV $= ' + tn(PIV, 4) + '$ V; choose a rating of at least $1.5\\times$ PIV $= ' + tn(1.5 * PIV, 3) + '$ V.', fw ? 'Full-wave: two pulses per input cycle, $f_o = 2f$.' : 'Half-wave: one pulse per cycle, $f_o = f$.']) + fin('\\text{PIV} = ' + te(PIV, 'V') + ',\\quad f_o = ' + fo + '\\ \\text{Hz}') }
        ],
        notes: QB.callout('trap', 'For the centre tap $V_{s(rms)}$ is one half-winding. A bridge loses two drops.'),
        data: { v: v, Vrms: Vrms, VD: VD, RL: RL, f: f }
      };
    }
  });

  /* ---------------------------------------------------------------- rect: capacitor filter */
  QB.add({
    id: 'edc.diode.rect.filter', course: 'edc', module: 'diode', topic: 'rect',
    title: 'Capacitor-filtered rectifier: ripple, V_dc, PIV or choose C', difficulty: 2, marks: 6,
    variants: [{ id: 'hw', label: 'Half-wave' }, { id: 'ct', label: 'Centre-tapped' }, { id: 'bridge', label: 'Bridge' }],
    tags: ['WS3 Q9', 'EX2 Q4', 'E3 N1–N2', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var f = r.pick([50, 60]), Vrms = r.pick([9, 12, 15, 18, 24]), VD = r.pick([0.7, 0.7, 0.8]), fw = v !== 'hw', k = fw ? 2 : 1;
        var Vm = Math.SQRT2 * Vrms, VP = Vm - (v === 'bridge' ? 2 : 1) * VD;
        var sub = r.pick(['ripple', 'designR', 'designI']);
        var RL = r.eseries('E12', 100, 2.2e3), C, Vr, IL;
        if (sub === 'ripple') { C = r.cap(100e-6, 4700e-6); Vr = VP / (k * f * C * RL); }
        else if (sub === 'designR') { Vr = r.pick([0.5, 0.8, 1, 1.5, 2]); C = VP / (k * f * RL * Vr); }
        else { IL = r.pick([0.1, 0.2, 0.25, 0.5, 1]); Vr = r.pick([0.5, 1, 1.5, 2]); C = IL / (k * f * Vr); }
        if (Vr / VP > 0.25 || Vr / VP < 0.01) return null;
        var Vdc = VP - Vr / 2, ILo = sub === 'designI' ? IL : Vdc / RL;
        var PIV = v === 'hw' ? 2 * Vm : v === 'ct' ? 2 * Vm - VD : Vm - VD;
        var rfac = Vr / (2 * Math.sqrt(3)) / Vdc * 100;
        var nm = { hw: 'half-wave', ct: 'centre-tapped full-wave', bridge: 'bridge' }[v];
        var load = sub === 'designI' ? 'supplies a dc load current of ' + pe(IL, 'A') : 'drives $R_L = ' + R(RL).replace(' ', '\\,') + '$';
        var fig = figRect(v, { RL: sub === 'designI' ? 'load' : R(RL), C: sub === 'ripple' ? pe(C, 'F') : true });
        var w1 = ['$V_m = \\sqrt2\\times' + Vrms + ' = ' + tn(Vm, 4) + '$ V; $V_P = V_m - ' + (v === 'bridge' ? '2V_D' : 'V_D') + ' = ' + tn(VP, 4) + '$ V.', '<b>' + (fw ? 'Full-wave: use $2f$' : 'Half-wave: use $f$') + '</b> (the capacitor is refilled ' + (fw ? 'every $T/2$' : 'once per period') + ').'];
        var p1;
        if (sub === 'ripple') p1 = { q: '(a) Find the peak-to-peak ripple $V_r$ and the dc output voltage.', answers: [A('$V_r$', Vr, 'V'), A('$V_{O(dc)}$', Vdc, 'V')], working: st(w1.concat(['$V_r = \\dfrac{V_P}{' + (fw ? '2' : '') + 'fCR} = \\dfrac{' + tn(VP, 4) + '}{' + (fw ? '2\\times' : '') + f + '\\times' + tn(C) + '\\times' + tn(RL) + '} = ' + te(Vr, 'V', 4) + '$', '$V_{O(dc)} = V_P - V_r/2 = ' + tn(Vdc, 4) + '$ V'])) + fin('V_r = ' + te(Vr, 'V') + ',\\quad V_{O(dc)} = ' + te(Vdc, 'V')) };
        else if (sub === 'designR') p1 = { q: '(a) Find the minimum C for a peak-to-peak ripple of at most ' + Vr + ' V, and the resulting dc output voltage.', answers: [A('$C$', C, 'F'), A('$V_{O(dc)}$', Vdc, 'V')], working: st(w1.concat(['$C = \\dfrac{V_P}{' + (fw ? '2' : '') + 'fRV_r} = \\dfrac{' + tn(VP, 4) + '}{' + (fw ? '2\\times' : '') + f + '\\times' + tn(RL) + '\\times' + Vr + '} = ' + te(C, 'F', 4) + '$ (choose the next standard value up).', '$V_{O(dc)} = V_P - V_r/2 = ' + tn(Vdc, 4) + '$ V'])) + fin('C = ' + te(C, 'F') + ',\\quad V_{O(dc)} = ' + te(Vdc, 'V')) };
        else p1 = { q: '(a) Find the minimum C for a peak-to-peak ripple of at most ' + Vr + ' V, and the dc output voltage.', answers: [A('$C$', C, 'F'), A('$V_{O(dc)}$', Vdc, 'V')], working: st(w1.concat(['With a known load current: $C = \\dfrac{I_L}{' + (fw ? '2' : '') + 'fV_r} = \\dfrac{' + IL + '}{' + (fw ? '2\\times' : '') + f + '\\times' + Vr + '} = ' + te(C, 'F', 4) + '$', '$V_{O(dc)} = V_P - V_r/2 = ' + tn(Vdc, 4) + '$ V'])) + fin('C = ' + te(C, 'F') + ',\\quad V_{O(dc)} = ' + te(Vdc, 'V')) };
        var parts = [p1, { q: '(b) Find the PIV of each diode and the ripple factor $r = V_{r(rms)}/V_{dc}$.', answers: [A('PIV', PIV, 'V'), A('$r$', rfac, '%')],
          working: st([v === 'hw' ? 'With C, the capacitor holds about $+V_P$ on the cathode while the source swings to $-V_m$: PIV $\\approx 2V_m$.' : v === 'ct' ? 'Centre tap: PIV $= 2V_m - V_D$.' : 'Bridge: PIV $= V_m - V_D$.', 'PIV $= ' + tn(PIV, 4) + '$ V.', 'Sawtooth: $V_{r(rms)} = V_{r(pp)}/(2\\sqrt3) = ' + tn(Vr / (2 * Math.sqrt(3)), 4) + '$ V, so $r = ' + tn(Vr / (2 * Math.sqrt(3)), 4) + '/' + tn(Vdc, 4) + ' = ' + tn(rfac, 3) + '\\%$.']) + fin('\\text{PIV} = ' + te(PIV, 'V') + ',\\quad r = ' + tn(rfac, 3) + '\\%') }];
        return {
          stem: 'A ' + nm + ' rectifier with a filter capacitor is fed from ' + Vrms + ' V rms' + (v === 'ct' ? ' per half-winding' : '') + ' at ' + f + ' Hz, with $V_D = ' + VD + '$ V per diode. It ' + load + (sub === 'ripple' ? ' with $C = ' + te(C, 'F') + '$' : '') + '.',
          figure: fig, given: [['$V_{s(rms)}$', V(Vrms)], ['$f$', f + ' Hz'], ['$V_D$', V(VD)]].concat(sub === 'designI' ? [['$I_L$', pe(IL, 'A')]] : [['$R_L$', R(RL)]]),
          parts: parts,
          notes: QB.callout('trap', 'The formula sheet prints $V_r = V_P/(fCR)$: for a full-wave rectifier you must use $2f$.'),
          data: { v: v, sub: sub, f: f, Vrms: Vrms, VD: VD, RL: RL, C: C, Vr: Vr, IL: IL || 0 }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- rect: conduction angle and diode currents */
  QB.add({
    id: 'edc.diode.rect.diodecur', course: 'edc', module: 'diode', topic: 'rect',
    title: 'Conduction angle and peak diode current', difficulty: 2, marks: 6,
    variants: [{ id: 'hw', label: 'Half-wave' }, { id: 'fw', label: 'Full-wave' }],
    tags: ['WS3 Q14', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var f = r.pick([50, 60]), VP = r.pick([12, 15, 20, 24, 50, 100]), RL = r.eseries('E12', 100, 10e3), Vr = Math.round(VP * r.float(0.02, 0.12, 3) * 10) / 10, fw = v === 'fw', k = fw ? 2 : 1;
        if (Vr < 0.2) return null;
        var C = VP / (k * f * RL * Vr), IL = VP / RL, wdt = Math.sqrt(2 * Vr / VP), frac = wdt / (2 * Math.PI) * 100, dt = wdt / (2 * Math.PI * f);
        var root = fw ? Math.sqrt(VP / (2 * Vr)) : Math.sqrt(2 * VP / Vr), iav = IL * (1 + Math.PI * root), imax = IL * (1 + 2 * Math.PI * root);
        var fig = figRect(fw ? 'bridge' : 'hw', { RL: R(RL), C: true });
        return {
          stem: 'A ' + (fw ? 'full-wave (bridge)' : 'half-wave') + ' rectifier with a filter capacitor gives a peak output $V_P = ' + VP + '$ V at ' + f + ' Hz into $R = ' + R(RL).replace(' ', '\\,') + '$. The required peak-to-peak ripple is ' + Vr + ' V. Use $I_L \\approx V_P/R$.',
          figure: fig, given: [['$V_P$', V(VP)], ['$f$', f + ' Hz'], ['$R$', R(RL)], ['$V_r$', V(Vr)]],
          parts: [
            { q: '(a) Find C.', answers: [A('$C$', C, 'F')], working: st(['$C = \\dfrac{V_P}{' + (fw ? '2' : '') + 'fRV_r} = \\dfrac{' + VP + '}{' + (fw ? '2\\times' : '') + f + '\\times' + tn(RL) + '\\times' + Vr + '}$']) + fin('C = ' + te(C, 'F')) },
            { q: '(b) Find the conduction angle $\\omega\\Delta t$, the fraction of the cycle the diode conducts, and $\\Delta t$.', answers: [A('$\\omega\\Delta t$', wdt, 'rad', { showPi: false }), A('fraction', frac, '%'), A('$\\Delta t$', dt, 's')],
              working: st(['$\\omega\\Delta t \\simeq \\sqrt{2V_r/V_P} = \\sqrt{2\\times' + Vr + '/' + VP + '} = ' + tn(wdt, 4) + '$ rad (' + tn(wdt * 180 / Math.PI, 3) + '°).', 'Fraction $= \\omega\\Delta t/2\\pi = ' + tn(frac, 3) + '\\%$; $\\Delta t = \\omega\\Delta t/(2\\pi f) = ' + te(dt, 's') + '$.']) + fin('\\omega\\Delta t = ' + tn(wdt, 3) + '\\ \\text{rad},\\ ' + tn(frac, 3) + '\\%,\\ \\Delta t = ' + te(dt, 's')) },
            { q: '(c) Find the average diode current during conduction $i_{Dav}$ and the peak diode current $i_{Dmax}$.', answers: [A('$i_{Dav}$', iav, 'A'), A('$i_{Dmax}$', imax, 'A')],
              working: st(['$I_L \\approx V_P/R = ' + te(IL, 'A', 4) + '$.', fw ? 'Full-wave form ("replace $T$ by $T/2$"): $\\sqrt{V_P/2V_r} = ' + tn(root, 4) + '$.' : 'Half-wave form: $\\sqrt{2V_P/V_r} = ' + tn(root, 4) + '$.', '$i_{Dav} = I_L(1 + \\pi\\cdot' + tn(root, 4) + ') = ' + te(iav, 'A', 4) + '$', '$i_{Dmax} = I_L(1 + 2\\pi\\cdot' + tn(root, 4) + ') = ' + te(imax, 'A', 4) + '$']) + fin('i_{Dav} = ' + te(iav, 'A') + ',\\quad i_{Dmax} = ' + te(imax, 'A')) }
          ],
          notes: QB.callout('trap', '$i_{Dav}$ is the average over the short conduction window only. Small ripple means a short window and a large current pulse.'),
          data: { v: v, f: f, VP: VP, RL: RL, Vr: Vr }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- zener: analysis */
  var ZV = [3.3, 4.7, 5.1, 5.6, 6.2, 6.8, 8.2, 9.1, 10, 12, 15];
  QB.add({
    id: 'edc.diode.zener.analysis', course: 'edc', module: 'diode', topic: 'zener',
    title: 'Zener regulator analysis: V_O, I_S, I_Z, P_Z', difficulty: 2, marks: 5,
    variants: [{ id: 'ideal', label: 'Ideal Zener' }, { id: 'rz', label: 'Zener with r_z (V_Z0 + r_z model)' }, { id: 'off', label: 'Heavy load: is the Zener on?' }],
    tags: ['WS3 Q10', 'E3 N3'],
    gen: function (r, v) {
      return r.retry(function () {
        var VZ = r.pick(ZV), Vs = Math.round(VZ + r.float(3, 10, 0)), RS = r.eseries('E12', 47, 1e3);
        var RL = v === 'off' ? r.eseries('E12', 22, 2.2e3) : r.eseries('E12', 100, 10e3), rz = v === 'rz' ? r.pick([2, 5, 10, 15, 20]) : 0;
        var Vopen = Vs * RL / (RS + RL);
        var fig = figZener({ Vs: Vs, RS: RS, RL: RL, Zlab: v === 'rz' ? pe(VZ, 'V') + ', r_z = ' + rz + ' Ω' : pe(VZ, 'V') });
        var g = [['$V_s$', V(Vs)], ['$R_S$', R(RS)], ['$R_L$', R(RL)], [v === 'rz' ? '$V_{Z0}$' : '$V_Z$', V(VZ)]].concat(rz ? [['$r_z$', R(rz)]] : []);
        if (v === 'off') {
          if (Vopen > 0.92 * VZ) return null;
          var VO = Vopen, IL = VO / RL;
          return {
            stem: 'A Zener regulator has $V_s = ' + Vs + '$ V, $R_S = ' + R(RS).replace(' ', '\\,') + '$, an ideal ' + VZ + ' V Zener and $R_L = ' + R(RL).replace(' ', '\\,') + '$.', figure: fig, given: g,
            parts: [{ q: '(a) Is the Zener in breakdown? Find $V_O$, $I_L$ and $I_Z$.', answers: [A('$V_O$', VO, 'V'), A('$I_L$', IL, 'A'), A('$I_Z$', 0, 'A', { abs: 1e-5 })],
              working: st(['Test: remove the Zener. The divider gives $V = V_s\\dfrac{R_L}{R_S+R_L} = ' + Vs + '\\times\\dfrac{' + tn(RL) + '}{' + tn(RS + RL) + '} = ' + tn(Vopen, 4) + '$ V.', 'This is below $V_Z = ' + VZ + '$ V, so the Zener cannot reach breakdown: it is OFF, $I_Z = 0$.', '$V_O = ' + tn(VO, 4) + '$ V and $I_L = V_O/R_L = ' + te(IL, 'A', 4) + '$. Regulation is lost.']) + fin('V_O = ' + te(VO, 'V') + ',\\ I_L = ' + te(IL, 'A') + ',\\ I_Z = 0') }],
            notes: QB.callout('trap', 'Always check the Zener is on before writing $V_O = V_Z$.'),
            data: { v: v, VZ: VZ, Vs: Vs, RS: RS, RL: RL, rz: 0 }
          };
        }
        if (Vopen < 1.1 * VZ) return null;
        var VO2 = rz ? (VZ / rz + Vs / RS) / (1 / rz + 1 / RL + 1 / RS) : VZ;
        var IS = (Vs - VO2) / RS, IL2 = VO2 / RL, IZ = IS - IL2, PZ = VO2 * IZ;
        if (IZ < 0.15 * IS) return null;
        var w = ['Test: without the Zener, $V = ' + tn(Vopen, 4) + '$ V > ' + VZ + ' V, so the Zener is in breakdown.'];
        if (rz) w.push('Zener model $V_O = V_{Z0} + r_zI_Z$. KCL at the output: $\\dfrac{V_O - ' + VZ + '}{' + rz + '} + \\dfrac{V_O}{' + tn(RL) + '} = \\dfrac{' + Vs + ' - V_O}{' + tn(RS) + '}$, so $V_O = ' + tn(VO2, 4) + '$ V.');
        else w.push('Ideal Zener: $V_O = V_Z = ' + VZ + '$ V.');
        w.push('$I_S = (V_s - V_O)/R_S = ' + te(IS, 'A', 4) + '$, $I_L = V_O/R_L = ' + te(IL2, 'A', 4) + '$.');
        w.push('$I_Z = I_S - I_L = ' + te(IZ, 'A', 4) + '$ (> 0 ✓). $P_Z = V_OI_Z = ' + te(PZ, 'W', 4) + '$.');
        return {
          stem: 'A Zener shunt regulator has $V_s = ' + Vs + '$ V, $R_S = ' + R(RS).replace(' ', '\\,') + '$ and $R_L = ' + R(RL).replace(' ', '\\,') + '$. ' + (rz ? 'The Zener has $V_{Z0} = ' + VZ + '$ V and $r_z = ' + rz + '\\ \\Omega$.' : 'The Zener is ideal with $V_Z = ' + VZ + '$ V.'),
          figure: fig, given: g,
          parts: [{ q: '(a) Find $V_O$, $I_S$, $I_L$, $I_Z$ and the Zener power $P_Z$.', answers: [A('$V_O$', VO2, 'V', { sig: 4 }), A('$I_S$', IS, 'A'), A('$I_L$', IL2, 'A'), A('$I_Z$', IZ, 'A'), A('$P_Z$', PZ, 'W')], working: st(w) + fin('V_O = ' + te(VO2, 'V', 4) + ',\\ I_Z = ' + te(IZ, 'A') + ',\\ P_Z = ' + te(PZ, 'W')) }],
          notes: QB.callout('tip', '$I_S$ is set by the supply and $V_Z$ alone; the load only decides how $I_S$ splits between $I_Z$ and $I_L$.'),
          data: { v: v, VZ: VZ, Vs: Vs, RS: RS, RL: RL, rz: rz }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- zener: design */
  QB.add({
    id: 'edc.diode.zener.design', course: 'edc', module: 'diode', topic: 'zener',
    title: 'Zener regulator design: R_S and Zener rating', difficulty: 2, marks: 5,
    variants: [{ id: 'pt', label: 'Fixed supply, load 0 to I_Lmax' }, { id: 'range', label: 'Supply and load both vary' }, { id: 'rsrange', label: 'Fixed load: allowed range of R_S' }],
    tags: ['PT Q4', 'WS3 Q13', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var VZ = r.pick(ZV), fig, g;
        if (v === 'pt') {
          var Vi = Math.round(VZ + r.float(2, 8, 0)), ILmax = r.pick([20, 50, 100, 150, 200]) * 1e-3, IZmin = r.bool() ? 0 : r.pick([1, 2, 5]) * 1e-3;
          var RS = (Vi - VZ) / (ILmax + IZmin), IS = (Vi - VZ) / RS, PZ = VZ * IS;
          fig = figZener({ Vs: Vi, RS: 0, RL: 'I_L', Zlab: '?' });
          return {
            stem: 'Design a Zener shunt regulator to hold $V_L = ' + VZ + '$ V for a load current from 0 to ' + pe(ILmax, 'A') + '. The supply is ' + Vi + ' V. ' + (IZmin ? 'The Zener needs at least $I_{Z,min} = ' + te(IZmin, 'A') + '$.' : 'Take $I_{Z,min} \\approx 0$ (ideal Zener).'),
            figure: fig, given: [['$V_i$', V(Vi)], ['$V_L$', V(VZ)], ['$I_{L,max}$', pe(ILmax, 'A')], ['$I_{Z,min}$', pe(IZmin, 'A')]],
            parts: [{ q: '(a) Choose $V_Z$ and find the largest $R_S$ that still regulates at full load.', answers: [A('$V_Z$', VZ, 'V'), A('$R_S$', RS, 'Ω')], working: st(['The Zener sets the output: $V_Z = ' + VZ + '$ V.', 'Worst case for $R_S$: heaviest load. $R_S = \\dfrac{V_i - V_Z}{I_{L,max} + I_{Z,min}} = \\dfrac{' + Vi + ' - ' + VZ + '}{' + tn(ILmax) + ' + ' + tn(IZmin) + '}$']) + fin('V_Z = ' + VZ + '\\ \\text{V},\\quad R_S = ' + te(RS, 'Ω')) },
              { q: '(b) Find the Zener power rating needed (the no-load case).', answers: [A('$P_{Z,max}$', PZ, 'W')], working: st(['At $I_L = 0$ the Zener takes all of $I_S = (V_i - V_Z)/R_S = ' + te(IS, 'A', 4) + '$.', '$P_Z = V_ZI_S = ' + VZ + '\\times' + tn(IS, 4) + '$']) + fin('P_{Z,max} = ' + te(PZ, 'W')) }],
            notes: QB.callout('trap', 'Size $R_S$ at maximum load and minimum supply; check $P_Z$ at no load and maximum supply.'),
            data: { v: v, VZ: VZ, Vi: Vi, ILmax: ILmax, IZmin: IZmin }
          };
        }
        if (v === 'range') {
          var Vn = Math.round(VZ + r.float(4, 10, 0)), dV = r.pick([1, 1.5, 2]), ILmin = r.pick([0, 5, 10]) * 1e-3, ILmax2 = r.pick([20, 30, 50, 80, 100]) * 1e-3, IZm = r.pick([1, 2, 5]) * 1e-3;
          var Vmin = Vn - dV, Vmax = Vn + dV;
          if (Vmin - VZ < 1.5 || ILmax2 <= ILmin) return null;
          var RS2 = (Vmin - VZ) / (ILmax2 + IZm), IZmax = (Vmax - VZ) / RS2 - ILmin, PZm = VZ * IZmax;
          fig = figZener({ Vs: Vn, RS: 0, RL: 'I_L', Zlab: V(VZ) });
          return {
            stem: 'A ' + VZ + ' V Zener regulator is fed from $V_s = ' + Vn + ' \\pm ' + dV + '$ V. The load current varies from ' + pe(ILmin, 'A') + ' to ' + pe(ILmax2, 'A') + ', and the Zener needs $I_{Z,min} = ' + te(IZm, 'A') + '$.',
            figure: fig, given: [['$V_s$', Vn + ' ± ' + dV + ' V'], ['$I_L$', pe(ILmin, 'A') + ' to ' + pe(ILmax2, 'A')], ['$I_{Z,min}$', pe(IZm, 'A')]],
            parts: [{ q: '(a) Find the largest $R_S$ that keeps regulation.', answers: [A('$R_{S,max}$', RS2, 'Ω')], working: st(['Worst case: lowest supply ($' + Vmin + '$ V) with the heaviest load.', '$R_S = \\dfrac{V_{s,min} - V_Z}{I_{L,max} + I_{Z,min}} = \\dfrac{' + Vmin + ' - ' + VZ + '}{' + tn(ILmax2) + ' + ' + tn(IZm) + '}$']) + fin('R_{S,max} = ' + te(RS2, 'Ω')) },
              { q: '(b) With that $R_S$, find the maximum Zener current and power.', answers: [A('$I_{Z,max}$', IZmax, 'A'), A('$P_{Z,max}$', PZm, 'W')], working: st(['Worst case for the Zener: highest supply ($' + Vmax + '$ V) with the lightest load.', '$I_{Z,max} = \\dfrac{V_{s,max} - V_Z}{R_S} - I_{L,min} = \\dfrac{' + Vmax + ' - ' + VZ + '}{' + tn(RS2, 4) + '} - ' + tn(ILmin) + ' = ' + te(IZmax, 'A', 4) + '$', '$P_{Z,max} = V_ZI_{Z,max}$']) + fin('I_{Z,max} = ' + te(IZmax, 'A') + ',\\quad P_{Z,max} = ' + te(PZm, 'W')) }],
            data: { v: v, VZ: VZ, Vn: Vn, dV: dV, ILmin: ILmin, ILmax: ILmax2, IZmin: IZm }
          };
        }
        // rsrange: fixed load, fixed Vi: Rs range from IZK and IZM
        var Vi3 = Math.round(VZ + r.float(4, 12, 0)), RL3 = r.eseries('E12', 220, 4.7e3), PZM = r.pick([0.25, 0.4, 0.5, 1]), IZK = r.pick([1, 2, 3]) * 1e-3;
        var IL3 = VZ / RL3, IZM = PZM / VZ;
        var RSmin = (Vi3 - VZ) / (IZM + IL3), RSmax = (Vi3 - VZ) / (IZK + IL3);
        if (RSmax < 1.3 * RSmin || IZM < 3 * IZK) return null;
        fig = figZener({ Vs: Vi3, RS: 0, RL: RL3, Zlab: V(VZ) });
        return {
          stem: 'A ' + VZ + ' V Zener ($P_{ZM} = ' + PZM + '$ W, $I_{ZK} = ' + te(IZK, 'A') + '$) regulates a fixed load $R_L = ' + R(RL3).replace(' ', '\\,') + '$ from $V_i = ' + Vi3 + '$ V. Find the range of $R_S$ that keeps $I_{ZK} \\le I_Z \\le I_{ZM}$.',
          figure: fig, given: [['$V_i$', V(Vi3)], ['$R_L$', R(RL3)], ['$P_{ZM}$', PZM + ' W'], ['$I_{ZK}$', pe(IZK, 'A')]],
          parts: [{ q: '(a) Find $I_L$ and $I_{ZM}$.', answers: [A('$I_L$', IL3, 'A'), A('$I_{ZM}$', IZM, 'A')], working: st(['$I_L = V_Z/R_L = ' + VZ + '/' + tn(RL3) + ' = ' + te(IL3, 'A', 4) + '$ (fixed while the Zener regulates).', '$I_{ZM} = P_{ZM}/V_Z = ' + PZM + '/' + VZ + ' = ' + te(IZM, 'A', 4) + '$']) + fin('I_L = ' + te(IL3, 'A') + ',\\quad I_{ZM} = ' + te(IZM, 'A')) },
            { q: '(b) Find $R_{S,min}$ and $R_{S,max}$.', answers: [A('$R_{S,min}$', RSmin, 'Ω'), A('$R_{S,max}$', RSmax, 'Ω')], working: st(['$I_S = I_Z + I_L$ and $R_S = (V_i - V_Z)/I_S$.', 'Smallest $R_S$ gives the largest $I_Z$: $R_{S,min} = \\dfrac{' + Vi3 + ' - ' + VZ + '}{' + tn(IZM, 4) + ' + ' + tn(IL3, 4) + '} = ' + te(RSmin, 'Ω', 4) + '$', 'Largest $R_S$ keeps $I_Z = I_{ZK}$: $R_{S,max} = \\dfrac{' + Vi3 + ' - ' + VZ + '}{' + tn(IZK) + ' + ' + tn(IL3, 4) + '} = ' + te(RSmax, 'Ω', 4) + '$']) + fin(te(RSmin, 'Ω') + ' \\le R_S \\le ' + te(RSmax, 'Ω')) }],
          data: { v: v, VZ: VZ, Vi: Vi3, RL: RL3, PZM: PZM, IZK: IZK }
        };
      });
    }
  });

  /* ---------------------------------------------------------------- zener: load / input range */
  QB.add({
    id: 'edc.diode.zener.loadrange', course: 'edc', module: 'diode', topic: 'zener',
    title: 'Zener regulator: load range or input range', difficulty: 2, marks: 6,
    variants: [{ id: 'rl', label: 'Supply varies: R_L range (WS3 Q22)' }, { id: 'boyl', label: 'Fixed supply: R_L and I_L range' }, { id: 'vi', label: 'Fixed load: V_i range' }],
    tags: ['WS3 Q22', 'Boylestad 2.11'],
    gen: function (r, v) {
      return r.retry(function () {
        var VZ = r.pick(ZV), RS = r.eseries('E12', 100, 1.5e3);
        if (v === 'rl') {
          var Vn = Math.round(VZ + r.float(3, 8, 0)), dV = r.pick([0.5, 1, 1.5]), IZmin = r.pick([0.2, 0.5, 1]) * 1e-3, IZmax = r.pick([5, 7, 10, 20, 30]) * 1e-3;
          var IRmax = (Vn + dV - VZ) / RS, IRmin = (Vn - dV - VZ) / RS, ILmax = IRmin - IZmin, ILmin = IRmax - IZmax;
          if (ILmax < 1e-3 || IRmax > 5 * IZmax) return null;
          var inf = ILmin <= 0, RLmin = VZ / ILmax, RLmax = inf ? Infinity : VZ / ILmin;
          if (!inf && ILmin > 0.8 * ILmax) return null;
          var parts = [{ q: '(a) Find the largest load current and the smallest load resistance.', answers: [A('$I_{L,max}$', ILmax, 'A'), A('$R_{L,min}$', RLmin, 'Ω')], working: st(['$I_R = (V_s - V_Z)/R_S$: $I_{R,max} = (' + (Vn + dV) + ' - ' + VZ + ')/' + tn(RS) + ' = ' + te(IRmax, 'A', 4) + '$, $I_{R,min} = (' + (Vn - dV) + ' - ' + VZ + ')/' + tn(RS) + ' = ' + te(IRmin, 'A', 4) + '$.', 'Largest load: lowest supply, Zener at $I_{Z,min}$: $I_{L,max} = I_{R,min} - I_{Z,min} = ' + te(ILmax, 'A', 4) + '$.', '$R_{L,min} = V_Z/I_{L,max} = ' + te(RLmin, 'Ω', 4) + '$']) + fin('I_{L,max} = ' + te(ILmax, 'A') + ',\\quad R_{L,min} = ' + te(RLmin, 'Ω')) },
            { q: '(b) Find the smallest load current' + (inf ? '. Is there a largest load resistance?' : ' and the largest load resistance.'), answers: [A('$I_{L,min}$', inf ? 0 : ILmin, 'A', { abs: 1e-5 })].concat(inf ? [] : [A('$R_{L,max}$', RLmax, 'Ω')]),
              working: st(['Lightest load: highest supply, Zener at $I_{Z,max}$: $I_{L,min} = I_{R,max} - I_{Z,max} = ' + tn(IRmax * 1e3, 4) + ' - ' + tn(IZmax * 1e3, 4) + '$ mA.', inf ? 'This is ≤ 0: even with no load the Zener current stays below $I_{Z,max}$. So $I_{L,min} = 0$ is allowed and $R_{L,max} = \\infty$.' : '$R_{L,max} = V_Z/I_{L,min} = ' + te(RLmax, 'Ω', 4) + '$']) + fin(inf ? 'I_{L,min} = 0,\\quad R_{L,max} = \\infty' : 'I_{L,min} = ' + te(ILmin, 'A') + ',\\quad R_{L,max} = ' + te(RLmax, 'Ω')) }];
          return { stem: 'A ' + VZ + ' V Zener regulator has $R_S = ' + R(RS).replace(' ', '\\,') + '$ and $V_s = ' + Vn + ' \\pm ' + dV + '$ V. The Zener works between $I_{Z,min} = ' + te(IZmin, 'A') + '$ and $I_{Z,max} = ' + te(IZmax, 'A') + '$. Find the load range for which $V_O$ stays at ' + VZ + ' V.', figure: figZener({ Vs: Vn, RS: RS, RL: true, Zlab: V(VZ) }), given: [['$V_s$', Vn + ' ± ' + dV + ' V'], ['$R_S$', R(RS)], ['$I_{Z,min}$', pe(IZmin, 'A')], ['$I_{Z,max}$', pe(IZmax, 'A')]], parts: parts, data: { v: v, VZ: VZ, RS: RS, Vn: Vn, dV: dV, IZmin: IZmin, IZmax: IZmax } };
        }
        if (v === 'boyl') {
          var Vi = Math.round(VZ + r.float(5, 15, 0)), IZM = r.pick([20, 30, 32, 40, 50, 60]) * 1e-3;
          var IR = (Vi - VZ) / RS, ILmin2 = IR - IZM;
          if (ILmin2 < 0.1 * IR) return null;
          var RLmin2 = RS * VZ / (Vi - VZ), ILmax2 = VZ / RLmin2, RLmax2 = VZ / ILmin2;
          return { stem: 'A ' + VZ + ' V Zener ($I_{ZM} = ' + te(IZM, 'A') + '$) and $R_S = ' + R(RS).replace(' ', '\\,') + '$ are fed from a fixed $V_i = ' + Vi + '$ V. Find the range of $R_L$ and $I_L$ that keeps $V_O = ' + VZ + '$ V.', figure: figZener({ Vs: Vi, RS: RS, RL: true, Zlab: V(VZ) }), given: [['$V_i$', V(Vi)], ['$R_S$', R(RS)], ['$I_{ZM}$', pe(IZM, 'A')]],
            parts: [{ q: '(a) Find $R_{L,min}$ and $I_{L,max}$.', answers: [A('$R_{L,min}$', RLmin2, 'Ω'), A('$I_{L,max}$', ILmax2, 'A')], working: st(['The Zener just turns on when the divider gives $V_Z$: $V_L = \\dfrac{R_LV_i}{R_L + R_S} = V_Z$.', '$R_{L,min} = \\dfrac{R_SV_Z}{V_i - V_Z} = \\dfrac{' + tn(RS) + '\\times' + VZ + '}{' + Vi + ' - ' + VZ + '} = ' + te(RLmin2, 'Ω', 4) + '$', '$I_{L,max} = V_Z/R_{L,min} = ' + te(ILmax2, 'A', 4) + '$']) + fin('R_{L,min} = ' + te(RLmin2, 'Ω') + ',\\ I_{L,max} = ' + te(ILmax2, 'A')) },
              { q: '(b) Find $I_{L,min}$ and $R_{L,max}$.', answers: [A('$I_{L,min}$', ILmin2, 'A'), A('$R_{L,max}$', RLmax2, 'Ω')], working: st(['$I_R = (V_i - V_Z)/R_S = ' + te(IR, 'A', 4) + '$ is fixed.', '$I_{L,min} = I_R - I_{ZM} = ' + te(ILmin2, 'A', 4) + '$', '$R_{L,max} = V_Z/I_{L,min} = ' + te(RLmax2, 'Ω', 4) + '$']) + fin('I_{L,min} = ' + te(ILmin2, 'A') + ',\\ R_{L,max} = ' + te(RLmax2, 'Ω')) }],
            data: { v: v, VZ: VZ, RS: RS, Vi: Vi, IZM: IZM } };
        }
        // vi
        var RL = r.eseries('E12', 470, 4.7e3), IZM2 = r.pick([20, 30, 40, 60]) * 1e-3;
        var Vimin = VZ * (RL + RS) / RL, Vimax = (IZM2 + VZ / RL) * RS + VZ;
        if (Vimax - Vimin < 2) return null;
        return { stem: 'A ' + VZ + ' V Zener ($I_{ZM} = ' + te(IZM2, 'A') + '$) with $R_S = ' + R(RS).replace(' ', '\\,') + '$ supplies a fixed load $R_L = ' + R(RL).replace(' ', '\\,') + '$. Find the range of $V_i$ that keeps the Zener in its working range.', figure: figZener({ Vs: null, RS: RS, RL: RL, Zlab: V(VZ) }), given: [['$R_S$', R(RS)], ['$R_L$', R(RL)], ['$I_{ZM}$', pe(IZM2, 'A')]],
          parts: [{ q: '(a) Find $V_{i,min}$ and $V_{i,max}$.', answers: [A('$V_{i,min}$', Vimin, 'V'), A('$V_{i,max}$', Vimax, 'V')], working: st(['$V_{i,min}$: the Zener just reaches $V_Z$ with $I_Z = 0$, so $V_{i,min} = \\dfrac{(R_L + R_S)V_Z}{R_L} = \\dfrac{(' + tn(RL) + ' + ' + tn(RS) + ')' + VZ + '}{' + tn(RL) + '} = ' + te(Vimin, 'V', 4) + '$', '$I_L = V_Z/R_L = ' + te(VZ / RL, 'A', 4) + '$, so $I_{R,max} = I_{ZM} + I_L = ' + te(IZM2 + VZ / RL, 'A', 4) + '$.', '$V_{i,max} = I_{R,max}R_S + V_Z = ' + te(Vimax, 'V', 4) + '$']) + fin(te(Vimin, 'V') + ' \\le V_i \\le ' + te(Vimax, 'V')) }],
          data: { v: v, VZ: VZ, RS: RS, RL: RL, IZM: IZM2 } };
      });
    }
  });

  /* ---------------------------------------------------------------- clip: series clipper */
  function seriesClipVo(vi, s, sb, VB, VD) { var u = vi - sb * VB; if (s > 0) return u > VD ? u - VD : 0; return u < -VD ? u + VD : 0; }
  QB.add({
    id: 'edc.diode.clip.series', course: 'edc', module: 'diode', topic: 'clip',
    title: 'Series clipper with a bias battery', difficulty: 2, marks: 5,
    variants: [{ id: 'square', label: 'Square-wave input: output levels' }, { id: 'sine', label: 'Sine input: transition and peaks' }],
    tags: ['PT Q5', 'WS3 Q12', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var s = r.sign(), sb = r.sign(), VB = r.pick([1, 2, 3, 4, 5, 6]), VD = r.bool(0.5) ? 0 : 0.7, Rr = r.eseries('E12', 1e3, 10e3);
        var viT = sb * VB + s * VD;
        var fig = figClipSeries({ s: s, sb: sb, VB: VB, R: Rr, dval: VD ? 'Si' : 'ideal' });
        var bat = sb > 0 ? 'its + terminal faces the source side (it opposes current flowing clockwise, from $v_i$ through the diode into $R$)' : 'its + terminal faces $R$ (it aids clockwise current)';
        var dio = s > 0 ? 'The diode points clockwise (anode towards $v_i$)' : 'The diode points anticlockwise (cathode towards $v_i$)';
        var stem = 'In the series clipper, $v_i$ drives ' + (VD ? 'a silicon diode (0.7 V)' : 'an ideal diode') + ' and a ' + VB + ' V battery in series with $R = ' + R(Rr).replace(' ', '\\,') + '$; $v_o$ is taken across $R$. ' + dio + ', and ' + bat + '.';
        var w0 = ['Clockwise KVL: $v_i - (' + (sb > 0 ? VB : -VB) + ') - v_D - v_o = 0$ with $v_o = iR$.', s > 0 ? 'The diode conducts clockwise when $v_i - (' + (sb * VB) + ') > ' + VD + '$, i.e. for $v_i > v_{iT} = ' + tn(viT, 3) + '$ V. Then $v_o = v_i - (' + (sb * VB) + ') - ' + VD + '$; otherwise $v_o = 0$.' : 'The diode conducts anticlockwise when $v_i - (' + (sb * VB) + ') < -' + VD + '$, i.e. for $v_i < v_{iT} = ' + tn(viT, 3) + '$ V. Then $v_o = v_i - (' + (sb * VB) + ') + ' + VD + '$ (negative); otherwise $v_o = 0$.'];
        if (v === 'square') {
          var Vh = r.pick([5, 8, 10, 12, 15, 20]), Vl = -r.pick([3, 5, 8, 10, 12, 15]);
          var oh = seriesClipVo(Vh, s, sb, VB, VD), ol = seriesClipVo(Vl, s, sb, VB, VD);
          if (oh === 0 && ol === 0) return null;
          if (Math.abs(Vh - viT) < 0.5 || Math.abs(Vl - viT) < 0.5) return null;
          return { stem: stem + ' The input is a square wave switching between $+' + Vh + '$ V and $' + Vl + '$ V.', figure: fig, given: [['$v_i$', '+' + Vh + ' V / ' + Vl + ' V'], ['$V$', V(VB)], ['$R$', R(Rr)]],
            parts: [{ q: '(a) Find the transition voltage and the two output levels.', answers: [A('$v_{iT}$', viT, 'V', { abs: 0.02 }), A('$v_o$ (at $+' + Vh + '$ V)', oh, 'V', { abs: 0.02 }), A('$v_o$ (at $' + Vl + '$ V)', ol, 'V', { abs: 0.02 })],
              working: st(w0.concat(['$v_i = +' + Vh + '$ V: ' + (oh !== 0 ? 'diode ON, $v_o = ' + tn(oh, 3) + '$ V.' : 'diode OFF (reverse biased), no current, $v_o = 0$.'), '$v_i = ' + Vl + '$ V: ' + (ol !== 0 ? 'diode ON, $v_o = ' + tn(ol, 3) + '$ V.' : 'diode OFF, $v_o = 0$.'), 'Sketch: a square wave in step with $v_i$ between these two levels.'])) + fin('v_o = ' + tn(oh, 3) + '\\ \\text{V and } ' + tn(ol, 3) + '\\ \\text{V}') }],
            notes: QB.callout('trap', 'Do not forget the battery in the ON-state KVL: the classic slip is $v_o = v_i$.'),
            data: { v: v, s: s, sb: sb, VB: VB, VD: VD, Vh: Vh, Vl: Vl } };
        }
        var Vm = r.pick([8, 10, 12, 15, 20]);
        if (VB > Vm - 2) return null;
        var omax = seriesClipVo(Vm, s, sb, VB, VD), omin = seriesClipVo(-Vm, s, sb, VB, VD);
        if (omax === 0 && omin === 0) return null;
        return { stem: stem + ' The input is $v_i = ' + Vm + '\\sin\\omega t$ V.', figure: fig, given: [['$V_m$', V(Vm)], ['$V$', V(VB)], ['$R$', R(Rr)]],
          parts: [{ q: '(a) Find the transition voltage $v_{iT}$ and the maximum and minimum of $v_o$.', answers: [A('$v_{iT}$', viT, 'V', { abs: 0.02 }), A('$v_{o,max}$', omax, 'V', { abs: 0.02 }), A('$v_{o,min}$', omin, 'V', { abs: 0.02 })],
            working: st(w0.concat(['At the positive peak ($v_i = ' + Vm + '$ V): $v_o = ' + tn(omax, 3) + '$ V. At the negative peak: $v_o = ' + tn(omin, 3) + '$ V.', 'Sketch: $v_o$ follows the shifted sine while the diode conducts and sits at 0 V otherwise; draw it under $v_i$ on the same time axis.'])) + fin('v_{iT} = ' + tn(viT, 3) + '\\ \\text{V},\\ v_{o,max} = ' + tn(omax, 3) + '\\ \\text{V},\\ v_{o,min} = ' + tn(omin, 3) + '\\ \\text{V}') }],
          data: { v: v, s: s, sb: sb, VB: VB, VD: VD, Vm: Vm } };
      });
    }
  });

  /* ---------------------------------------------------------------- clip: shunt clipper */
  QB.add({
    id: 'edc.diode.clip.shunt', course: 'edc', module: 'diode', topic: 'clip',
    title: 'Shunt clippers and transfer-characteristic breakpoints', difficulty: 2, marks: 5,
    variants: [{ id: 'single', label: 'One biased diode across the output' }, { id: 'double', label: 'Two-level clipper' }, { id: 'divider', label: 'Diode across one resistor of a divider' }],
    tags: ['WS3 Q18', 'EX2 Q3(a)', 'E3 N5'],
    gen: function (r, v) {
      return r.retry(function () {
        var VD = r.pick([0, 0.7, 0.7]), Rr = r.eseries('E12', 1e3, 4.7e3), Vm = r.pick([8, 10, 12, 15]);
        if (v === 'divider') {
          var s = r.sign(), R1 = r.eseries('E12', 1e3, 4.7e3), R2 = r.eseries('E12', 0.47e3, 4.7e3), VDd = 0.7, Vx = r.pick([5, 8, 10]);
          var viT = s * VDd * (R1 + R2) / R1, kk = R2 / (R1 + R2);
          if (abs(viT) > 0.7 * Vx) return null;
          var vo = function (x) { return s * x * R1 / (R1 + R2) > VDd ? x - s * VDd : kk * x; };
          var vp = vo(Vx), vn = vo(-Vx);
          return { stem: '$v_i$ drives $R_1 = ' + R(R1).replace(' ', '\\,') + '$ in series with $R_2 = ' + R(R2).replace(' ', '\\,') + '$ to ground; $v_o$ is taken across $R_2$. A silicon diode ($V_D = 0.7$ V) is connected across $R_1$ with its ' + (s > 0 ? 'anode' : 'cathode') + ' on the input side. Plot $v_o$ against $v_i$ for $-' + Vx + ' < v_i < ' + Vx + '$ V.', figure: figClipDivider({ s: s, R1: R1, R2: R2, VD: VDd }), given: [['$R_1$', R(R1)], ['$R_2$', R(R2)], ['$V_D$', '0.7 V']],
            parts: [{ q: '(a) Find the breakpoint $v_{iT}$ and the slope of the characteristic while the diode is off.', answers: [A('$v_{iT}$', viT, 'V'), A('slope', kk, '')], working: st(['Diode off: it sees $v_{R1} = v_i\\dfrac{R_1}{R_1+R_2}$' + (s < 0 ? ' (reversed: it conducts when this reaches $-0.7$ V)' : '') + '.', 'Turn-on: $' + (s > 0 ? '' : '-') + 'v_{iT}\\dfrac{' + tn(R1) + '}{' + tn(R1 + R2) + '} = 0.7 \\Rightarrow v_{iT} = ' + tn(viT, 4) + '$ V.', 'Off region: $v_o = v_i\\dfrac{R_2}{R_1+R_2} = ' + tn(kk, 4) + 'v_i$.']) + fin('v_{iT} = ' + te(viT, 'V') + ',\\quad \\text{slope} = ' + tn(kk, 3)) },
              { q: '(b) Find $v_o$ at $v_i = +' + Vx + '$ V and at $v_i = -' + Vx + '$ V.', answers: [A('$v_o(+' + Vx + ')$', vp, 'V'), A('$v_o(-' + Vx + ')$', vn, 'V')], working: st(['Diode on: it holds $R_1$ at ' + (s > 0 ? '+' : '−') + '0.7 V, so $v_o = v_i ' + (s > 0 ? '-' : '+') + ' 0.7$ (slope 1).', '$v_i = +' + Vx + '$: ' + (s * Vx * R1 / (R1 + R2) > VDd ? 'on, ' : 'off, ') + '$v_o = ' + tn(vp, 4) + '$ V. $v_i = -' + Vx + '$: ' + (s * -Vx * R1 / (R1 + R2) > VDd ? 'on, ' : 'off, ') + '$v_o = ' + tn(vn, 4) + '$ V.']) + fin('v_o = ' + te(vp, 'V') + ',\\ ' + te(vn, 'V')) }],
            data: { v: v, s: s, R1: R1, R2: R2, Vx: Vx } };
        }
        if (v === 'double') {
          var E1 = r.pick([2, 3, 4, 5, 6]), E2 = -r.pick([2, 3, 4, 5, 6]);
          var L1 = E1 + VD, L2 = E2 - VD;
          if (L1 > Vm - 1 || -L2 > Vm - 1) return null;
          var th1 = Math.asin(L1 / Vm) * 180 / Math.PI, th2 = 180 + Math.asin(-L2 / Vm) * 180 / Math.PI, Ipk = (Vm - L1) / Rr, Ipn = (Vm + L2) / Rr;
          return { stem: '$v_i = ' + Vm + '\\sin\\omega t$ V drives $R = ' + R(Rr).replace(' ', '\\,') + '$ to the output node $v_o$ (no load). $D_1$ has its anode at $v_o$ and its cathode at the + terminal of a ' + E1 + ' V battery (− grounded). $D_2$ has its cathode at $v_o$ and its anode at the − terminal of a ' + (-E2) + ' V battery (+ grounded). ' + (VD ? 'Use $V_D = 0.7$ V.' : 'The diodes are ideal.'), figure: figClipShunt({ R: Rr, br: [{ s: 1, E: E1 }, { s: -1, E: E2 }] }), given: [['$V_m$', V(Vm)], ['$V_1$', V(E1)], ['$V_2$', V(-E2)], ['$V_D$', V(VD)]],
            parts: [{ q: '(a) Find the two clipping levels.', answers: [A('$v_{o,max}$', L1, 'V', { abs: 0.02 }), A('$v_{o,min}$', L2, 'V', { abs: 0.02 })], working: st(['Both off: no current in $R$, so $v_o = v_i$.', '$D_1$ conducts when $v_o \\ge ' + E1 + ' + ' + VD + ' = ' + tn(L1, 3) + '$ V and then holds it there.', '$D_2$ conducts when $v_o \\le ' + E2 + ' - ' + VD + ' = ' + tn(L2, 3) + '$ V.']) + fin('v_o\\ \\text{clipped at } ' + tn(L1, 3) + '\\ \\text{V and } ' + tn(L2, 3) + '\\ \\text{V}') },
              { q: '(b) Find the angles at which positive and negative clipping start, and the peak current in $R$ at the positive peak.', answers: [A('$\\theta_1$', th1, '°'), A('$\\theta_2$', th2, '°'), A('$I_{pk}$', Ipk, 'A')], working: st(['Positive clipping starts at $\\sin^{-1}(' + tn(L1, 3) + '/' + Vm + ') = ' + tn(th1, 4) + '°$ and ends at $' + tn(180 - th1, 4) + '°$.', 'Negative clipping starts at $180° + \\sin^{-1}(' + tn(-L2, 3) + '/' + Vm + ') = ' + tn(th2, 4) + '°$ and ends at $' + tn(540 - th2, 4) + '°$.', 'At the positive peak $I = (' + Vm + ' - ' + tn(L1, 3) + ')/' + tn(Rr) + ' = ' + te(Ipk, 'A', 4) + '$ (at the negative peak: $' + te(Ipn, 'A', 3) + '$).']) + fin('\\theta_1 = ' + tn(th1, 3) + '^\\circ,\\ \\theta_2 = ' + tn(th2, 4) + '^\\circ,\\ I_{pk} = ' + te(Ipk, 'A')) }],
            data: { v: v, Vm: Vm, R: Rr, E1: E1, E2: E2, VD: VD } };
        }
        var s2 = r.sign(), E = r.pick([-4, -3, -2, 0, 2, 3, 4, 5]), RL = r.bool(0.35) ? r.eseries('E12', 2.2e3, 22e3) : 0;
        var k2 = RL ? RL / (Rr + RL) : 1, L = E + s2 * VD, viT2 = L / k2;
        if (abs(viT2) > Vm - 1) return null;
        var vof = function (x) { var u = k2 * x; return s2 > 0 ? Math.min(u, L) : Math.max(u, L); };
        var omax = vof(Vm), omin = vof(-Vm);
        return { stem: '$v_i = ' + Vm + '\\sin\\omega t$ V drives $R = ' + R(Rr).replace(' ', '\\,') + '$ to the output node $v_o$' + (RL ? ', which has a load $R_L = ' + R(RL).replace(' ', '\\,') + '$' : ' (no load)') + '. A diode with its ' + (s2 > 0 ? 'anode' : 'cathode') + ' at $v_o$ goes to ' + (E === 0 ? 'ground' : (E > 0 ? 'the + terminal' : 'the − terminal') + ' of a ' + abs(E) + ' V battery whose other terminal is grounded') + '. ' + (VD ? 'Use $V_D = 0.7$ V.' : 'The diode is ideal.'), figure: figClipShunt({ R: Rr, br: [{ s: s2, E: E }], RL: RL }), given: [['$V_m$', V(Vm)], ['$R$', R(Rr)], ['battery', E ? V(E) + ' at the diode' : 'none']].concat(RL ? [['$R_L$', R(RL)]] : []),
          parts: [{ q: '(a) Find the clipping level, the transition input $v_{iT}$, and the maximum and minimum of $v_o$.', answers: [A('clip level', L, 'V', { abs: 0.02 }), A('$v_{iT}$', viT2, 'V', { abs: 0.02 }), A('$v_{o,max}$', omax, 'V', { abs: 0.02 }), A('$v_{o,min}$', omin, 'V', { abs: 0.02 })],
            working: st(['Diode off: ' + (RL ? '$v_o = v_i\\dfrac{R_L}{R + R_L} = ' + tn(k2, 4) + 'v_i$.' : 'no current in $R$, so $v_o = v_i$.'), 'The diode ' + (s2 > 0 ? 'conducts when $v_o$ rises above' : 'conducts when $v_o$ falls below') + ' $' + E + (s2 > 0 ? ' + ' : ' - ') + VD + ' = ' + tn(L, 3) + '$ V, and then holds $v_o$ there.', 'Transition: $' + (RL ? tn(k2, 4) : '') + 'v_{iT} = ' + tn(L, 3) + '\\Rightarrow v_{iT} = ' + tn(viT2, 4) + '$ V.', 'So $v_o$ ranges from $' + tn(omin, 4) + '$ V to $' + tn(omax, 4) + '$ V: the ' + (s2 > 0 ? 'top' : 'bottom') + ' of the sine is flattened.']) + fin('\\text{clip at } ' + tn(L, 3) + '\\ \\text{V},\\ v_{o} \\in [' + tn(omin, 3) + ',\\ ' + tn(omax, 3) + ']\\ \\text{V}') }],
          data: { v: v, Vm: Vm, R: Rr, RL: RL, s: s2, E: E, VD: VD } };
      });
    }
  });

  /* ---------------------------------------------------------------- clip: clampers and doubler */
  QB.add({
    id: 'edc.diode.clip.clamper', course: 'edc', module: 'diode', topic: 'clip',
    title: 'Clampers and the voltage doubler', difficulty: 2, marks: 4,
    variants: [{ id: 'basic', label: 'Clamper (no bias)' }, { id: 'biased', label: 'Biased clamper' }, { id: 'doubler', label: 'Half-wave voltage doubler' }],
    tags: ['EX2 Q3(b)', 'E3 N6'],
    gen: function (r, v) {
      if (v === 'doubler') {
        var Vrms = r.pick([6, 9, 12, 15, 24]), VD = 0.7, Vm = Math.SQRT2 * Vrms;
        return { stem: 'A half-wave voltage doubler is fed from ' + Vrms + ' V rms.', figure: figDoubler(), given: [['$V_{rms}$', V(Vrms)]],
          parts: [{ q: '(a) Find the ideal output, the output with 0.7 V diodes, and the PIV of each diode.', answers: [A('$V_o$ (ideal)', 2 * Vm, 'V'), A('$V_o$ (0.7 V)', 2 * (Vm - VD), 'V'), A('PIV', 2 * Vm, 'V')], working: st(['$V_m = \\sqrt2\\times' + Vrms + ' = ' + tn(Vm, 4) + '$ V.', 'Negative half: $D_1$ conducts and $C_1$ charges to $V_m$. Positive half: $D_2$ sees $v_i + V_m$, which peaks at $2V_m$, and $C_2$ charges to it.', 'Ideal: $2V_m = ' + tn(2 * Vm, 4) + '$ V. With two drops: $2(V_m - 0.7) = ' + tn(2 * (Vm - VD), 4) + '$ V.', 'Each diode must block $2V_m = ' + tn(2 * Vm, 4) + '$ V.']) + fin('V_o = ' + te(2 * Vm, 'V') + '\\ (\\text{ideal}),\\ ' + te(2 * (Vm - VD), 'V') + ',\\ \\text{PIV} = ' + te(2 * Vm, 'V')) }],
          data: { v: v, Vrms: Vrms } };
      }
      return r.retry(function () {
        var s = r.sign(), E = v === 'biased' ? r.sign() * r.pick([1, 2, 3, 4, 5]) : 0, VD = r.pick([0, 0.7]), Vh = r.pick([5, 8, 10, 12, 15]), Vl = r.bool(0.5) ? -Vh : -r.pick([5, 8, 10, 12, 15]);
        var f = r.pick([100, 500, 1000]), C = r.cap(0.1e-6, 10e-6), Rr = r.eseries('E12', 10e3, 1e6);
        var tau = Rr * C, half = 1 / (2 * f);
        if (tau < 20 * half) return null;
        var omax, omin, VC;
        if (s > 0) { omax = E + VD; VC = Vh - omax; omin = Vl - VC; } else { omin = E - VD; VC = Vl - omin; omax = Vh - VC; }
        var fig = figClamper({ s: s, E: E, C: pe(C, 'F'), R: Rr });
        var w = [s > 0 ? 'The diode (anode at $v_o$) conducts when $v_o$ tries to rise above $' + E + ' + ' + VD + ' = ' + tn(E + VD, 3) + '$ V. Start in the half-cycle where it conducts: $v_i = +' + Vh + '$ V.' : 'The diode (cathode at $v_o$) conducts when $v_o$ tries to fall below $' + E + ' - ' + VD + ' = ' + tn(E - VD, 3) + '$ V. Start in the half-cycle where it conducts: $v_i = ' + Vl + '$ V.',
          (s > 0 ? '$v_o = ' + tn(omax, 3) + '$ V, so C charges to $V_C = v_i - v_o = ' + Vh + ' - (' + tn(omax, 3) + ') = ' + tn(VC, 3) + '$ V.' : '$v_o = ' + tn(omin, 3) + '$ V, so C charges to $V_C = v_i - v_o = ' + Vl + ' - (' + tn(omin, 3) + ') = ' + tn(VC, 3) + '$ V.'),
          'Other half-cycle: the diode is off and $v_o = v_i - V_C$: $v_o = ' + (s > 0 ? Vl + ' - (' + tn(VC, 3) + ') = ' + tn(omin, 3) : Vh + ' - (' + tn(VC, 3) + ') = ' + tn(omax, 3)) + '$ V. The diode is reverse biased there ✓.',
          'Check: $v_o$ peak-to-peak $= ' + tn(omax - omin, 3) + '$ V = input peak-to-peak ✓. $RC = ' + te(tau, 's') + '$ ≫ half-period $' + te(half, 's') + '$, so the levels are flat.'];
        return { stem: 'A square wave switching between $+' + Vh + '$ V and $' + Vl + '$ V at ' + f + ' Hz drives a ' + pe(C, 'F') + ' capacitor in series; the other plate is $v_o$, with $R = ' + R(Rr).replace(' ', '\\,') + '$ to ground. A ' + (VD ? 'silicon (0.7 V)' : 'ideal') + ' diode has its ' + (s > 0 ? 'anode' : 'cathode') + ' at $v_o$ and its other end ' + (E === 0 ? 'grounded' : 'at the ' + (E > 0 ? '+' : '−') + ' terminal of a ' + abs(E) + ' V battery (other terminal grounded)') + '.', figure: fig, given: [['$v_i$', '+' + Vh + ' / ' + Vl + ' V'], ['$C$', pe(C, 'F')], ['$R$', R(Rr)]],
          parts: [{ q: '(a) Find the two output levels and the voltage the capacitor holds ($V_C = v_i - v_o$).', answers: [A('$v_{o,max}$', omax, 'V', { abs: 0.02 }), A('$v_{o,min}$', omin, 'V', { abs: 0.02 }), A('$V_C$', VC, 'V', { abs: 0.02 })], working: st(w) + fin('v_o:\\ ' + tn(omax, 3) + '\\ \\text{V} \\leftrightarrow ' + tn(omin, 3) + '\\ \\text{V}') }],
          notes: QB.callout('trap', 'Start in the half-cycle where the diode conducts, and check the peak-to-peak is unchanged.'),
          data: { v: v, s: s, E: E, VD: VD, Vh: Vh, Vl: Vl } };
      });
    }
  });

  /* =========================================================================
   * MODULE 2 · BJTs
   * ========================================================================= */
  function rv(x) { return R(x); }
  /** active-mode solve of a Thévenin-base single-BJT stage (magnitudes) */
  function bjtActive(VBB, RBB, RC, RE, VCC, b) {
    var IB = (VBB - 0.7) / (RBB + (b + 1) * RE), IC = b * IB, IE = (b + 1) * IB;
    var VE = IE * RE, VC = VCC - IC * RC, VCE = VC - VE;
    return { IB: IB, IC: IC, IE: IE, VE: VE, VC: VC, VCE: VCE, VB: VE + 0.7 };
  }
  /** saturation solve: VBE = 0.7, VCE = 0.2 */
  function bjtSat(VBB, RBB, RC, RE, VCC) {
    // VBB - IB RBB - 0.7 - (IB+IC) RE = 0 ; VCC - IC RC - 0.2 - (IB+IC) RE = 0
    var a11 = RBB + RE, a12 = RE, b1 = VBB - 0.7, a21 = RE, a22 = RC + RE, b2 = VCC - 0.2;
    var det = a11 * a22 - a12 * a21;
    var IB = (b1 * a22 - a12 * b2) / det, IC = (a11 * b2 - a21 * b1) / det;
    return { IB: IB, IC: IC, IE: IB + IC, VE: (IB + IC) * RE, VC: VCC - IC * RC, VCE: 0.2 };
  }
  function bfmt(b) { return 'β = ' + b; }
  function activeCheck(s, pnp) { return 'Check: $I_B = ' + te(s.IB, 'A') + ' > 0$ and $' + (pnp ? 'V_{EC}' : 'V_{CE}') + ' = ' + te(s.VCE, 'V') + ' > 0.2$ V, so the transistor is <b>active</b> ✓.'; }

  /* ---------------------------------------------------------------- modes: current bookkeeping */
  QB.add({
    id: 'edc.bjt.modes.currents', course: 'edc', module: 'bjt', topic: 'modes',
    title: 'Current bookkeeping: I_E, I_C, I_B, α, β and leakage', difficulty: 1, marks: 3,
    variants: [{ id: 'ieib', label: 'Given I_E and I_B' }, { id: 'beta', label: 'Given β and one current' }, { id: 'alpha', label: 'Given α and I_E' }, { id: 'leak', label: 'Leakage: I_CBO to I_CEO' }],
    tags: ['WS4 Q9'],
    gen: function (r, v) {
      if (v === 'ieib') {
        var IE = r.pick([1, 2, 2.5, 4, 5, 8, 10]) * 1e-3, IB = IE / r.pick([41, 51, 61, 81, 101, 121, 151, 201]);
        IB = Math.round(IB * 1e7) / 1e7; var IC = IE - IB, al = IC / IE, be = IC / IB;
        return { stem: 'An npn BJT in active mode has $I_E = ' + te(IE, 'A') + '$ and $I_B = ' + te(IB, 'A', 3) + '$.', figure: null, given: [['$I_E$', pe(IE, 'A')], ['$I_B$', pe(IB, 'A')]],
          parts: [{ q: '(a) Find $I_C$, α and β.', answers: [A('$I_C$', IC, 'A', { sig: 4 }), A('$\\alpha$', al, '', { tol: 0.002, sig: 4 }), A('$\\beta$', be, '')], working: st(['KCL first: $I_C = I_E - I_B = ' + tn(IE * 1e3, 4) + ' - ' + tn(IB * 1e3, 4) + ' = ' + tn(IC * 1e3, 4) + '$ mA.', '$\\alpha = I_C/I_E = ' + tn(al, 4) + '$, $\\beta = I_C/I_B = ' + tn(be, 4) + '$.', 'Check: $\\beta = \\alpha/(1-\\alpha) = ' + tn(al / (1 - al), 4) + '$ ✓.']) + fin('I_C = ' + te(IC, 'A', 4) + ',\\ \\alpha = ' + tn(al, 4) + ',\\ \\beta = ' + tn(be, 4)) }],
          data: { v: v, IE: IE, IB: IB } };
      }
      if (v === 'beta') {
        var b = r.int(40, 300), which = r.pick(['IB', 'IC', 'IE']), x = which === 'IB' ? r.pick([5, 10, 20, 25, 40, 50, 100]) * 1e-6 : r.pick([0.5, 1, 2, 5, 10]) * 1e-3;
        var IBb = which === 'IB' ? x : which === 'IC' ? x / b : x / (b + 1), ICb = b * IBb, IEb = (b + 1) * IBb, alb = b / (b + 1);
        var lbl = { IB: 'I_B', IC: 'I_C', IE: 'I_E' }[which];
        return { stem: 'An npn BJT with $\\beta = ' + b + '$ is in the active region with $' + lbl + ' = ' + te(x, 'A') + '$.', figure: null, given: [['$\\beta$', String(b)], ['$' + lbl + '$', pe(x, 'A')]],
          parts: [{ q: '(a) Find the other two currents and α.', answers: [A('$I_B$', IBb, 'A'), A('$I_C$', ICb, 'A'), A('$I_E$', IEb, 'A'), A('$\\alpha$', alb, '', { tol: 0.002, sig: 4 })], working: st(['$I_C = \\beta I_B$, $I_E = (\\beta+1)I_B$.', '$I_B = ' + te(IBb, 'A', 4) + '$, $I_C = ' + te(ICb, 'A', 4) + '$, $I_E = ' + te(IEb, 'A', 4) + '$.', '$\\alpha = \\beta/(\\beta+1) = ' + b + '/' + (b + 1) + ' = ' + tn(alb, 4) + '$.']) + fin('I_B = ' + te(IBb, 'A') + ',\\ I_C = ' + te(ICb, 'A') + ',\\ I_E = ' + te(IEb, 'A') + ',\\ \\alpha = ' + tn(alb, 4)) }],
          data: { v: v, b: b, which: which, x: x } };
      }
      if (v === 'alpha') {
        var al2 = r.pick([0.98, 0.985, 0.99, 0.992, 0.995, 0.996]), IE2 = r.pick([1, 2, 3, 5, 10]) * 1e-3;
        var IC2 = al2 * IE2, IB2 = IE2 - IC2, b2 = al2 / (1 - al2);
        return { stem: 'In a common-base stage the transistor has $\\alpha = ' + al2 + '$ and carries $I_E = ' + te(IE2, 'A') + '$.', figure: null, given: [['$\\alpha$', String(al2)], ['$I_E$', pe(IE2, 'A')]],
          parts: [{ q: '(a) Find $I_C$, $I_B$ and β.', answers: [A('$I_C$', IC2, 'A', { sig: 4 }), A('$I_B$', IB2, 'A'), A('$\\beta$', b2, '')], working: st(['$I_C = \\alpha I_E = ' + al2 + '\\times' + tn(IE2) + ' = ' + te(IC2, 'A', 4) + '$', '$I_B = I_E - I_C = ' + te(IB2, 'A', 4) + '$', '$\\beta = \\alpha/(1-\\alpha) = ' + al2 + '/' + tn(1 - al2, 3) + ' = ' + tn(b2, 4) + '$ (β is very sensitive to α near 1).']) + fin('I_C = ' + te(IC2, 'A', 4) + ',\\ I_B = ' + te(IB2, 'A') + ',\\ \\beta = ' + tn(b2, 4)) }],
          data: { v: v, al: al2, IE: IE2 } };
      }
      var ICBO = r.pick([1, 2, 5, 10, 20]) * 1e-9, b3 = r.int(50, 250), IB3 = r.pick([10, 20, 30, 50]) * 1e-6;
      var ICEO = (b3 + 1) * ICBO, IC3 = b3 * IB3 + ICEO;
      return { stem: 'A BJT has $\\beta = ' + b3 + '$ and a collector–base leakage $I_{CBO} = ' + te(ICBO, 'A') + '$.', figure: null, given: [['$\\beta$', String(b3)], ['$I_{CBO}$', pe(ICBO, 'A')]],
        parts: [{ q: '(a) Find $I_{CEO}$ (base open). (b) Find $I_C$ when $I_B = ' + te(IB3, 'A') + '$, including the leakage.', answers: [A('$I_{CEO}$', ICEO, 'A'), A('$I_C$', IC3, 'A', { sig: 4 })], working: st(['$I_{CEO} = \\dfrac{I_{CBO}}{1-\\alpha} = (\\beta+1)I_{CBO} = ' + (b3 + 1) + '\\times' + tn(ICBO) + ' = ' + te(ICEO, 'A') + '$', '$I_C = \\beta I_B + I_{CEO} = ' + b3 + '\\times' + tn(IB3) + ' + ' + tn(ICEO) + ' = ' + te(IC3, 'A', 4) + '$', 'The CE leakage is about β times $I_{CBO}$.']) + fin('I_{CEO} = ' + te(ICEO, 'A') + ',\\quad I_C = ' + te(IC3, 'A', 4)) }],
        data: { v: v, ICBO: ICBO, b: b3, IB: IB3 } };
    }
  });

  /* ---------------------------------------------------------------- modes: identify the mode */
  QB.add({
    id: 'edc.bjt.modes.mode', course: 'edc', module: 'bjt', topic: 'modes',
    title: 'Operating mode from currents or node voltages', difficulty: 1, marks: 4,
    variants: [{ id: 'currents', label: 'From I_B, I_C and β' }, { id: 'voltages', label: 'From npn node voltages' }, { id: 'pnp', label: 'From pnp node voltages' }],
    tags: ['WS4 Q10', 'PT Q1'],
    gen: function (r, v) {
      var modes = r.shuffle(['active', 'saturation', 'cutoff']), parts = [], data = { v: v, cases: [] };
      if (v === 'currents') {
        var b = r.pick([50, 80, 100, 120, 150]);
        modes.forEach(function (m, k) {
          var IB, IC;
          if (m === 'cutoff') { IB = 0; IC = 0; }
          else { IB = r.pick([10, 20, 40, 50, 100]) * 1e-6; IC = m === 'active' ? b * IB : b * IB * r.pick([0.1, 0.2, 0.3, 0.5]); }
          data.cases.push({ IB: IB, IC: IC, b: b });
          parts.push({ q: '(' + 'abc'[k] + ') $I_B = ' + te(IB, 'A') + '$, $I_C = ' + te(IC, 'A') + '$. Which mode? ' + MODEQ + ' Also give $\\beta I_B$.', answers: [modeAns('mode', m), A('$\\beta I_B$', b * IB, 'A', { abs: 1e-9 })],
            working: st([m === 'cutoff' ? '$I_B = 0$: no base drive, so the transistor is in <b>cut-off</b>.' : '$\\beta I_B = ' + b + '\\times' + tn(IB) + ' = ' + te(b * IB, 'A') + '$. ' + (m === 'active' ? '$I_C = \\beta I_B$, so <b>active</b>.' : '$I_C < \\beta I_B$: the collector circuit cannot carry $\\beta I_B$, so <b>saturation</b> (forced β = ' + tn(IC / IB, 3) + ').')]) + fin('\\text{' + m + '}') });
        });
        return { stem: 'A BJT has $\\beta = ' + b + '$. Identify the operating mode in each case.', figure: null, given: [['$\\beta$', String(b)]], parts: parts, data: data };
      }
      var pnp = v === 'pnp';
      modes.forEach(function (m, k) {
        var VE = r.pick([0, 0, 1, 1.5, 2, 3]), VB, VC;
        if (m === 'active') { VB = VE + 0.7; VC = VB + r.pick([1, 2, 3, 4.3, 5]); }
        else if (m === 'saturation') { VB = VE + 0.7; VC = VE + 0.2; }
        else { VB = VE + r.pick([-1, -0.5, 0, 0.2, 0.3]); VC = VE + r.pick([3, 5, 8]); }
        var vE = VE, vB = VB, vC = VC;
        if (pnp) { var e0 = 5 - r.pick([0, 1, 2]); vE = e0; vB = m === 'cutoff' ? e0 - r.pick([-0.5, 0, 0.3]) : e0 - 0.7; vC = m === 'active' ? vB - r.pick([1, 2, 3]) : m === 'saturation' ? e0 - 0.2 : e0 - r.pick([3, 4]); }
        var vbe = pnp ? vE - vB : vB - vE, vbc = pnp ? vC - vB : vB - vC, vce = pnp ? vE - vC : vC - vE;
        data.cases.push({ VB: vB, VC: vC, VE: vE });
        var lab = pnp ? ['V_{EB}', 'V_{CB}', 'V_{EC}'] : ['V_{BE}', 'V_{BC}', 'V_{CE}'];
        var why = m === 'cutoff' ? '$' + lab[0] + ' = ' + tn(vbe, 3) + '$ V < 0.7 V: the emitter junction is not forward biased, so <b>cut-off</b>.' : m === 'active' ? '$' + lab[0] + ' = 0.7$ V (EBJ forward) and $' + lab[1] + ' = ' + tn(vbc, 3) + '$ V < 0.5 V (CBJ reverse); $' + lab[2] + ' = ' + tn(vce, 3) + '$ V > 0.2 V, so <b>active</b>.' : '$' + lab[0] + ' = 0.7$ V and $' + lab[2] + ' = 0.2$ V, so $' + lab[1] + ' = 0.5$ V: both junctions forward biased, <b>saturation</b>.';
        parts.push({ q: '(' + 'abc'[k] + ') $V_B = ' + tn(vB, 3) + '$ V, $V_C = ' + tn(vC, 3) + '$ V, $V_E = ' + tn(vE, 3) + '$ V. Find $' + lab[2] + '$ and the mode. ' + MODEQ, answers: [A('$' + lab[2] + '$', vce, 'V', { abs: 0.01 }), modeAns('mode', m)], working: st([(pnp ? 'pnp: flip every sign. ' : '') + '$' + lab[0] + ' = ' + tn(vbe, 3) + '$ V, $' + lab[1] + ' = ' + tn(vbc, 3) + '$ V, $' + lab[2] + ' = ' + tn(vce, 3) + '$ V.', why]) + fin('\\text{' + m + '}') });
      });
      return { stem: 'The node voltages of ' + (pnp ? 'a pnp' : 'an npn') + ' silicon BJT are given ($V_{BE(on)} = 0.7$ V, $V_{CE(sat)} = 0.2$ V). Identify the mode in each case.', figure: null, given: [], parts: parts, notes: QB.callout('trap', 'Saturation is forward/forward, cut-off is reverse/reverse (the WS4 handout has these rows swapped).'), data: data };
    }
  });

  /* ---------------------------------------------------------------- bias: fixed */
  QB.add({
    id: 'edc.bjt.bias.fixed', course: 'edc', module: 'bjt', topic: 'bias',
    title: 'Fixed bias: Q-point or design', difficulty: 1, marks: 5,
    variants: [{ id: 'analysis', label: 'Find I_B, I_C, V_CE' }, { id: 'design', label: 'Design R_B and R_C for a target Q-point' }],
    tags: ['Lecture 4', 'WS5'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15, 18, 20, 24]), b = r.int(50, 250);
        if (v === 'design') {
          var IC = r.pick([1, 1.5, 2, 2.5, 3, 4, 5]) * 1e-3, VCE = Math.round(VCC * r.float(0.35, 0.6, 2) * 10) / 10;
          var RC = (VCC - VCE) / IC, IB = IC / b, RB = (VCC - 0.7) / IB;
          return { stem: 'Design a fixed-bias npn stage on $V_{CC} = ' + VCC + '$ V with $\\beta = ' + b + '$ for $I_{CQ} = ' + te(IC, 'A') + '$ and $V_{CEQ} = ' + VCE + '$ V.', figure: tmpl('bjtFixedBias', { VCC: V(VCC), RB: true, RC: true, beta: b, nodes: true }), given: [['$V_{CC}$', V(VCC)], ['$\\beta$', String(b)], ['$I_{CQ}$', pe(IC, 'A')], ['$V_{CEQ}$', V(VCE)]],
            parts: [{ q: '(a) Find $R_C$ and $R_B$.', answers: [A('$R_C$', RC, 'Ω'), A('$R_B$', RB, 'Ω')], working: st(['Collector loop: $R_C = (V_{CC} - V_{CE})/I_C = (' + VCC + ' - ' + VCE + ')/' + tn(IC) + ' = ' + te(RC, 'Ω', 4) + '$', '$I_B = I_C/\\beta = ' + te(IB, 'A', 4) + '$', 'Base loop: $R_B = (V_{CC} - 0.7)/I_B = ' + te(RB, 'Ω', 4) + '$. Pick the nearest standard values and re-check.']) + fin('R_C = ' + te(RC, 'Ω') + ',\\quad R_B = ' + te(RB, 'Ω')) }],
            data: { v: v, VCC: VCC, b: b, IC: IC, VCE: VCE } };
        }
        var RB = r.eseries('E12', 100e3, 1.2e6), RC = r.eseries('E12', 0.47e3, 10e3);
        var s = bjtActive(VCC, RB, RC, 0, VCC, b);
        if (s.VCE < 1 || s.VCE > VCC - 0.5) return null;
        return { stem: 'For the fixed-bias circuit, $V_{CC} = ' + VCC + '$ V, $R_B = ' + rv(RB).replace(' ', '\\,') + '$, $R_C = ' + rv(RC).replace(' ', '\\,') + '$ and $\\beta = ' + b + '$.', figure: tmpl('bjtFixedBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), beta: b, nodes: true, currents: true }), given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_C$', rv(RC)], ['$\\beta$', String(b)]],
          parts: [{ q: '(a) Find $I_{BQ}$, $I_{CQ}$ and $V_{CEQ}$, and confirm the mode.', answers: [A('$I_B$', s.IB, 'A'), A('$I_C$', s.IC, 'A'), A('$V_{CE}$', s.VCE, 'V')], working: st(['Assume active. Base loop: $V_{CC} - I_BR_B - 0.7 = 0 \\Rightarrow I_B = \\dfrac{' + VCC + ' - 0.7}{' + tn(RB) + '} = ' + te(s.IB, 'A', 4) + '$', '$I_C = \\beta I_B = ' + b + '\\times' + tn(s.IB, 4) + ' = ' + te(s.IC, 'A', 4) + '$', 'Collector loop: $V_{CE} = V_{CC} - I_CR_C = ' + VCC + ' - ' + tn(s.IC * RC, 4) + ' = ' + te(s.VCE, 'V', 4) + '$', activeCheck(s)]) + fin('I_B = ' + te(s.IB, 'A') + ',\\ I_C = ' + te(s.IC, 'A') + ',\\ V_{CE} = ' + te(s.VCE, 'V')) },
            { q: '(b) Find the saturation current $I_{C,sat}$.', answers: [A('$I_{C,sat}$', VCC / RC, 'A')], working: st(['Short C–E: $I_{C,sat} = V_{CC}/R_C = ' + VCC + '/' + tn(RC) + '$']) + fin('I_{C,sat} = ' + te(VCC / RC, 'A')) }],
          data: { v: v, VCC: VCC, RB: RB, RC: RC, b: b } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias: emitter stabilised */
  QB.add({
    id: 'edc.bjt.bias.emitter', course: 'edc', module: 'bjt', topic: 'bias',
    title: 'Emitter-stabilised bias', difficulty: 2, marks: 6,
    variants: [{ id: 'analysis', label: 'Q-point and node voltages' }, { id: 'betastab', label: 'β doubles: how far does I_C move?' }],
    tags: ['WS5 Q9', 'PT Q6'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([10, 12, 15, 18, 20]), b = r.int(50, 200), RB = r.eseries('E12', 100e3, 680e3), RC = r.eseries('E12', 0.47e3, 4.7e3), RE = r.eseries('E12', 0.22e3, 2.2e3);
        var s = bjtActive(VCC, RB, RC, RE, VCC, b);
        if (s.VCE < 1) return null;
        var fig = tmpl('bjtEmitterBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), RE: rv(RE), beta: b, nodes: true, currents: true });
        var g = [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_C$', rv(RC)], ['$R_E$', rv(RE)], ['$\\beta$', String(b)]];
        var w = ['Assume active. Base loop with $I_E = (\\beta+1)I_B$: $V_{CC} - I_BR_B - 0.7 - (\\beta+1)I_BR_E = 0$', '$I_B = \\dfrac{' + VCC + ' - 0.7}{' + tn(RB) + ' + ' + (b + 1) + '\\times' + tn(RE) + '} = \\dfrac{' + tn(VCC - 0.7, 4) + '}{' + tn(RB + (b + 1) * RE, 4) + '} = ' + te(s.IB, 'A', 4) + '$', '$I_C = \\beta I_B = ' + te(s.IC, 'A', 4) + '$, $I_E = (\\beta+1)I_B = ' + te(s.IE, 'A', 4) + '$'];
        if (v === 'analysis') {
          return { stem: 'For the emitter-stabilised bias circuit, find the Q-point.', figure: fig, given: g,
            parts: [{ q: '(a) Find $I_B$, $I_C$ and $V_{CE}$.', answers: [A('$I_B$', s.IB, 'A'), A('$I_C$', s.IC, 'A'), A('$V_{CE}$', s.VCE, 'V')], working: st(w.concat(['$V_{CE} = V_{CC} - I_CR_C - I_ER_E = ' + VCC + ' - ' + tn(s.IC * RC, 4) + ' - ' + tn(s.IE * RE, 4) + ' = ' + te(s.VCE, 'V', 4) + '$', activeCheck(s)])) + fin('I_B = ' + te(s.IB, 'A') + ',\\ I_C = ' + te(s.IC, 'A') + ',\\ V_{CE} = ' + te(s.VCE, 'V')) },
              { q: '(b) Find $V_E$, $V_B$, $V_C$ and $V_{BC}$.', answers: [A('$V_E$', s.VE, 'V'), A('$V_B$', s.VB, 'V'), A('$V_C$', s.VC, 'V'), A('$V_{BC}$', s.VB - s.VC, 'V')], working: st(['$V_E = I_ER_E = ' + te(s.VE, 'V', 4) + '$, $V_B = V_E + 0.7 = ' + te(s.VB, 'V', 4) + '$', '$V_C = V_{CC} - I_CR_C = ' + te(s.VC, 'V', 4) + '$ (not equal to $V_{CE}$ because $R_E$ lifts the emitter)', '$V_{BC} = ' + te(s.VB - s.VC, 'V', 4) + '$ < 0: CBJ reverse biased ✓']) + fin('V_E = ' + te(s.VE, 'V') + ',\\ V_B = ' + te(s.VB, 'V') + ',\\ V_C = ' + te(s.VC, 'V')) }],
            notes: QB.callout('trap', 'The base loop has $(\\beta+1)R_E$: leaving it out makes $I_B$ several times too big.'),
            data: { v: v, VCC: VCC, RB: RB, RC: RC, RE: RE, b: b } };
        }
        var s2 = bjtActive(VCC, RB, RC, RE, VCC, 2 * b);
        if (s2.VCE < 0.5) return null;
        var pct = (s2.IC - s.IC) / s.IC * 100;
        return { stem: 'The transistor in the emitter-stabilised circuit is replaced by one with twice the β (' + b + ' → ' + (2 * b) + ').', figure: fig, given: g,
          parts: [{ q: '(a) Find $I_C$ and $V_{CE}$ with $\\beta = ' + b + '$.', answers: [A('$I_C$', s.IC, 'A'), A('$V_{CE}$', s.VCE, 'V')], working: st(w.concat(['$V_{CE} = ' + te(s.VCE, 'V', 4) + '$', activeCheck(s)])) + fin('I_C = ' + te(s.IC, 'A') + ',\\ V_{CE} = ' + te(s.VCE, 'V')) },
            { q: '(b) Find $I_C$ with $\\beta = ' + (2 * b) + '$ and the percentage change. Compare with fixed bias, where $I_C \\propto \\beta$.', answers: [A('$I_C$', s2.IC, 'A'), A('change', pct, '%')], working: st(['$I_B = \\dfrac{' + tn(VCC - 0.7, 4) + '}{' + tn(RB) + ' + ' + (2 * b + 1) + '\\times' + tn(RE) + '} = ' + te(s2.IB, 'A', 4) + '$, $I_C = ' + te(s2.IC, 'A', 4) + '$, $V_{CE} = ' + te(s2.VCE, 'V', 3) + '$.', 'Change $= ' + tn(pct, 3) + '\\%$ for a 100 % change in β. Fixed bias would change by 100 %: $(\\beta+1)R_E$ in the denominator is what stabilises the bias.']) + fin('I_C = ' + te(s2.IC, 'A') + ',\\ \\Delta I_C = ' + tn(pct, 3) + '\\%') }],
          data: { v: v, VCC: VCC, RB: RB, RC: RC, RE: RE, b: b } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias: voltage divider */
  QB.add({
    id: 'edc.bjt.bias.vdb', course: 'edc', module: 'bjt', topic: 'bias',
    title: 'Voltage-divider bias: exact vs approximate', difficulty: 2, marks: 8,
    variants: [{ id: 'exact', label: 'Test fails: exact (Thévenin) method' }, { id: 'approx', label: 'Test passes: approximate method' }, { id: 'compare', label: 'Both methods and the error' }],
    tags: ['WS5 Q7', 'WS5 Q8', 'PT Q7', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([10, 12, 15, 16, 18, 20, 22]), b = r.int(50, 250), R1 = r.eseries('E12', 10e3, 100e3), R2 = r.eseries('E12', 2.2e3, 22e3), RC = r.eseries('E12', 1e3, 6.8e3), RE = r.eseries('E12', 0.33e3, 2.2e3);
        var pass = b * RE >= 10 * R2;
        if (v === 'exact' && pass) return null;
        if (v === 'approx' && !pass) return null;
        var VTh = VCC * R2 / (R1 + R2), RTh = par(R1, R2);
        if (VTh < 1.2) return null;
        var s = bjtActive(VTh, RTh, RC, RE, VCC, b);
        var VEa = VTh - 0.7, IEa = VEa / RE, VCEa = VCC - IEa * (RC + RE);
        if (s.VCE < 1 || VCEa < 0.8) return null;
        var fig = tmpl('bjtVDB', { VCC: V(VCC), R1: rv(R1), R2: rv(R2), RC: rv(RC), RE: rv(RE), beta: b, nodes: true, currents: true });
        var g = [['$V_{CC}$', V(VCC)], ['$R_1$', rv(R1)], ['$R_2$', rv(R2)], ['$R_C$', rv(RC)], ['$R_E$', rv(RE)], ['$\\beta$', String(b)]];
        var test = 'Test: $\\beta R_E = ' + b + '\\times' + tn(RE) + ' = ' + te(b * RE, 'Ω') + '$ and $10R_2 = ' + te(10 * R2, 'Ω') + '$. ' + (pass ? 'Since $\\beta R_E \\ge 10R_2$, the approximate method is valid.' : 'Since $\\beta R_E < 10R_2$, the approximation is <b>not</b> valid: use the exact method.');
        var ex = [test, '$R_{Th} = R_1\\parallel R_2 = ' + te(RTh, 'Ω', 4) + '$, $E_{Th} = \\dfrac{R_2V_{CC}}{R_1+R_2} = \\dfrac{' + tn(R2) + '\\times' + VCC + '}{' + tn(R1 + R2) + '} = ' + te(VTh, 'V', 4) + '$', '$I_B = \\dfrac{E_{Th} - 0.7}{R_{Th} + (\\beta+1)R_E} = \\dfrac{' + tn(VTh - 0.7, 4) + '}{' + tn(RTh, 4) + ' + ' + (b + 1) + '\\times' + tn(RE) + '} = ' + te(s.IB, 'A', 4) + '$', '$I_C = \\beta I_B = ' + te(s.IC, 'A', 4) + '$, $I_E = ' + te(s.IE, 'A', 4) + '$', '$V_{CE} = V_{CC} - I_CR_C - I_ER_E = ' + te(s.VCE, 'V', 4) + '$; $V_E = ' + te(s.VE, 'V', 3) + '$, $V_C = ' + te(s.VC, 'V', 4) + '$', activeCheck(s)];
        var ap = [test, '$V_B = \\dfrac{R_2V_{CC}}{R_1+R_2} = ' + te(VTh, 'V', 4) + '$, $V_E = V_B - 0.7 = ' + te(VEa, 'V', 4) + '$', '$I_C \\approx I_E = V_E/R_E = ' + tn(VEa, 4) + '/' + tn(RE) + ' = ' + te(IEa, 'A', 4) + '$', '$V_{CE} \\approx V_{CC} - I_C(R_C + R_E) = ' + VCC + ' - ' + tn(IEa, 4) + '\\times' + tn(RC + RE) + ' = ' + te(VCEa, 'V', 4) + '$ > 0.2 V, active ✓'];
        if (v === 'exact') return { stem: 'For the voltage-divider bias circuit, decide whether the approximate method may be used, then find the Q-point.', figure: fig, given: g,
          parts: [{ q: '(a) Find $E_{Th}$, $R_{Th}$ and $I_B$.', answers: [A('$E_{Th}$', VTh, 'V', { sig: 4 }), A('$R_{Th}$', RTh, 'Ω'), A('$I_B$', s.IB, 'A')], working: st(ex.slice(0, 3)) + fin('I_B = ' + te(s.IB, 'A')) },
            { q: '(b) Find $I_C$, $V_{CE}$, $V_E$ and $V_C$.', answers: [A('$I_C$', s.IC, 'A'), A('$V_{CE}$', s.VCE, 'V'), A('$V_E$', s.VE, 'V'), A('$V_C$', s.VC, 'V')], working: st(ex.slice(3)) + fin('I_C = ' + te(s.IC, 'A') + ',\\ V_{CE} = ' + te(s.VCE, 'V')) }],
          notes: QB.callout('trap', 'Write the $\\beta R_E \\ge 10R_2$ test out every time; here the approximation would give $I_C = ' + te(IEa, 'A') + '$ (' + tn((IEa - s.IC) / s.IC * 100, 2) + ' % high).'),
          data: { v: v, VCC: VCC, R1: R1, R2: R2, RC: RC, RE: RE, b: b } };
        if (v === 'approx') return { stem: 'For the voltage-divider bias circuit, check the condition and use the approximate method.', figure: fig, given: g,
          parts: [{ q: '(a) Find $V_B$, $V_E$, $I_C$ and $V_{CE}$ by the approximate method.', answers: [A('$V_B$', VTh, 'V', { sig: 4 }), A('$V_E$', VEa, 'V'), A('$I_C$', IEa, 'A'), A('$V_{CE}$', VCEa, 'V')], working: st(ap) + fin('I_C \\approx ' + te(IEa, 'A') + ',\\ V_{CE} \\approx ' + te(VCEa, 'V')) }],
          data: { v: v, VCC: VCC, R1: R1, R2: R2, RC: RC, RE: RE, b: b } };
        var err = (IEa - s.IC) / s.IC * 100;
        return { stem: 'Analyse the voltage-divider bias circuit by both methods and compare.', figure: fig, given: g,
          parts: [{ q: '(a) Exact method: find $I_C$ and $V_{CE}$.', answers: [A('$I_C$', s.IC, 'A'), A('$V_{CE}$', s.VCE, 'V')], working: st(ex) + fin('I_C = ' + te(s.IC, 'A') + ',\\ V_{CE} = ' + te(s.VCE, 'V')) },
            { q: '(b) Approximate method: find $I_C$ and the percentage error in $I_C$.', answers: [A('$I_C$ (approx)', IEa, 'A'), A('error', err, '%', { abs: 0.3 })], working: st(ap.slice(1).concat(['Error $= \\dfrac{' + tn(IEa, 4) + ' - ' + tn(s.IC, 4) + '}{' + tn(s.IC, 4) + '} = ' + tn(err, 3) + '\\%$. ' + (pass ? 'The test passed, so the error is small.' : 'The test failed, which is why the error is large.')])) + fin('I_C \\approx ' + te(IEa, 'A') + ',\\ \\text{error} = ' + tn(err, 3) + '\\%') }],
          data: { v: v, VCC: VCC, R1: R1, R2: R2, RC: RC, RE: RE, b: b } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias: load line */
  QB.add({
    id: 'edc.bjt.bias.loadline', course: 'edc', module: 'bjt', topic: 'bias',
    title: 'DC load line and Q-point', difficulty: 2, marks: 6,
    variants: [{ id: 'fixed', label: 'Fixed bias' }, { id: 'emitter', label: 'Emitter bias' }, { id: 'design', label: 'Design from a given load line' }],
    tags: ['PT Q6', 'Lecture 4 design'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([10, 12, 15, 18, 20, 24]), b = r.int(80, 200);
        if (v === 'design') {
          var Isat = r.pick([4, 5, 6, 8, 10, 12]) * 1e-3, IBQ = r.pick([10, 15, 20, 25, 30, 40, 50]) * 1e-6;
          var RC = VCC / Isat, RB = (VCC - 0.7) / IBQ, ICQ = b * IBQ, VCEQ = VCC - ICQ * RC;
          if (VCEQ < 0.25 * VCC || VCEQ > 0.75 * VCC) return null;
          var fig = figLoadLine({ VCC: VCC, Isat: Isat, Q: [VCEQ, ICQ], IBtxt: 'I_B = ' + pe(IBQ, 'A') });
          return { stem: 'The dc load line of a fixed-bias stage meets the $V_{CE}$ axis at ' + VCC + ' V and the $I_C$ axis at ' + pe(Isat, 'A') + '. The Q-point lies on the $I_B = ' + te(IBQ, 'A') + '$ curve and the transistor has $\\beta = ' + b + '$.', figure: fig, given: [['cut-off intercept', V(VCC)], ['saturation intercept', pe(Isat, 'A')], ['$I_{BQ}$', pe(IBQ, 'A')], ['$\\beta$', String(b)]],
            parts: [{ q: '(a) Find $V_{CC}$, $R_C$ and $R_B$.', answers: [A('$V_{CC}$', VCC, 'V'), A('$R_C$', RC, 'Ω'), A('$R_B$', RB, 'Ω')], working: st(['Cut-off end ($I_C = 0$): $V_{CC} = ' + VCC + '$ V.', 'Saturation end: $R_C = V_{CC}/I_{C,sat} = ' + VCC + '/' + tn(Isat) + ' = ' + te(RC, 'Ω', 4) + '$', '$R_B = (V_{CC} - 0.7)/I_{BQ} = ' + tn(VCC - 0.7, 3) + '/' + tn(IBQ) + ' = ' + te(RB, 'Ω', 4) + '$ (then pick the nearest standard value).']) + fin('V_{CC} = ' + VCC + '\\ \\text{V},\\ R_C = ' + te(RC, 'Ω') + ',\\ R_B = ' + te(RB, 'Ω')) },
              { q: '(b) Find $I_{CQ}$ and $V_{CEQ}$.', answers: [A('$I_{CQ}$', ICQ, 'A'), A('$V_{CEQ}$', VCEQ, 'V')], working: st(['$I_{CQ} = \\beta I_{BQ} = ' + te(ICQ, 'A', 4) + '$', 'On the load line: $V_{CEQ} = V_{CC} - I_{CQ}R_C = ' + te(VCEQ, 'V', 4) + '$']) + fin('I_{CQ} = ' + te(ICQ, 'A') + ',\\ V_{CEQ} = ' + te(VCEQ, 'V')) }],
            data: { v: v, VCC: VCC, Isat: Isat, IBQ: IBQ, b: b } };
        }
        var RB = r.eseries('E12', 150e3, 1e6), RC = r.eseries('E12', 0.47e3, 4.7e3), RE = v === 'emitter' ? r.eseries('E12', 0.22e3, 2.2e3) : 0;
        var s = bjtActive(VCC, RB, RC, RE, VCC, b), Is = VCC / (RC + RE);
        if (s.VCE < 0.2 * VCC || s.VCE > 0.8 * VCC) return null;
        var fig2 = v === 'emitter' ? tmpl('bjtEmitterBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), RE: rv(RE), beta: b }) : tmpl('bjtFixedBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), beta: b });
        var ll = figLoadLine({ VCC: VCC, Isat: Is, Q: [s.VCE, s.IC], IBtxt: 'I_B = ' + pe(s.IB, 'A') });
        return { stem: 'Draw the dc load line for the ' + (RE ? 'emitter-bias' : 'fixed-bias') + ' circuit and locate the Q-point.', figure: fig2, given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_C$', rv(RC)]].concat(RE ? [['$R_E$', rv(RE)]] : []).concat([['$\\beta$', String(b)]]),
          parts: [{ q: '(a) Find both intercepts of the load line.', answers: [A('$V_{CE}$ intercept', VCC, 'V'), A('$I_{C,sat}$', Is, 'A')], working: st(['Output loop: $V_{CE} = V_{CC} - I_C(R_C' + (RE ? ' + R_E' : '') + ')$' + (RE ? ' with $I_E\\approx I_C$' : '') + '.', '$I_C = 0 \\Rightarrow V_{CE} = ' + VCC + '$ V; $V_{CE} = 0 \\Rightarrow I_C = ' + VCC + '/' + tn(RC + RE) + ' = ' + te(Is, 'A', 4) + '$.']) + (ll || '') + fin('(' + VCC + '\\ \\text{V},\\ 0)\\ \\text{and}\\ (0,\\ ' + te(Is, 'A') + ')') },
            { q: '(b) Find $I_{BQ}$, $I_{CQ}$ and $V_{CEQ}$.', answers: [A('$I_{BQ}$', s.IB, 'A'), A('$I_{CQ}$', s.IC, 'A'), A('$V_{CEQ}$', s.VCE, 'V')], working: st(['Base loop picks the curve: $I_{BQ} = \\dfrac{V_{CC} - 0.7}{R_B' + (RE ? ' + (\\beta+1)R_E' : '') + '} = ' + te(s.IB, 'A', 4) + '$', '$I_{CQ} = \\beta I_{BQ} = ' + te(s.IC, 'A', 4) + '$', '$V_{CEQ} = V_{CC} - I_CR_C' + (RE ? ' - I_ER_E' : '') + ' = ' + te(s.VCE, 'V', 4) + '$: Q sits on the load line ✓']) + fin('I_{CQ} = ' + te(s.IC, 'A') + ',\\ V_{CEQ} = ' + te(s.VCE, 'V')) }],
          notes: QB.callout('trap', RE ? 'With $R_E$ the saturation intercept is $V_{CC}/(R_C + R_E)$, not $V_{CC}/R_C$.' : 'Increasing $I_B$ slides Q up the line towards saturation.'),
          data: { v: v, VCC: VCC, RB: RB, RC: RC, RE: RE, b: b } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias: does it saturate? */
  QB.add({
    id: 'edc.bjt.bias.satcheck', course: 'edc', module: 'bjt', topic: 'bias',
    title: 'Does the design saturate? Guess, analyse, check', difficulty: 3, marks: 6,
    variants: [{ id: 'fixed', label: 'Fixed bias' }, { id: 'emitter', label: 'Emitter bias (two-loop saturation solve)' }, { id: 'rcmax', label: 'Largest R_C for active over a β range' }],
    tags: ['WS5 Q10–Q13', 'EX2 Q5(c)'],
    gen: function (r, v) {
      var wantSat = r.bool();
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15, 20]), RB = r.eseries('E12', 47e3, 470e3), RC = r.eseries('E12', 1e3, 10e3), RE = v === 'fixed' ? 0 : r.eseries('E12', 0.1e3, 1e3), b = r.int(60, 250);
        if (v === 'rcmax') {
          var bmin = r.pick([50, 60, 80, 100]), bmax = bmin * r.pick([2, 3]);
          var sA = bjtActive(VCC, RB, 0, RE, VCC, bmax);
          var RCmax = (VCC - 0.2 - sA.IE * RE) / sA.IC;
          if (RCmax < 300 || RCmax > 50e3) return null;
          var sB = bjtActive(VCC, RB, 0, RE, VCC, bmin);
          return { stem: 'An emitter-bias stage has $V_{CC} = ' + VCC + '$ V, $R_B = ' + rv(RB).replace(' ', '\\,') + '$ and $R_E = ' + rv(RE).replace(' ', '\\,') + '$. Transistors from the batch have ' + bmin + ' ≤ β ≤ ' + bmax + '. Find the largest $R_C$ that keeps every device active.', figure: tmpl('bjtEmitterBias', { VCC: V(VCC), RB: rv(RB), RC: true, RE: rv(RE), beta: bmin + '–' + bmax }), given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_E$', rv(RE)], ['β', bmin + ' to ' + bmax]],
            parts: [{ q: '(a) Which β is the worst case? Find $I_C$ for it.', answers: [A('$I_C(\\beta_{max})$', sA.IC, 'A')], working: st(['The largest β gives the largest $I_C$ and the smallest $V_{CE}$, so check $\\beta_{max} = ' + bmax + '$ to avoid saturation.', '$I_B = \\dfrac{' + VCC + ' - 0.7}{' + tn(RB) + ' + ' + (bmax + 1) + '\\times' + tn(RE) + '} = ' + te(sA.IB, 'A', 4) + '$, $I_C = ' + te(sA.IC, 'A', 4) + '$ (at $\\beta_{min}$: $' + te(sB.IC, 'A', 3) + '$).']) + fin('I_C = ' + te(sA.IC, 'A')) },
              { q: '(b) Find $R_{C,max}$ (edge of saturation, $V_{CE} = 0.2$ V).', answers: [A('$R_{C,max}$', RCmax, 'Ω')], working: st(['$V_{CC} - I_CR_C - I_ER_E \\ge 0.2$', '$R_C \\le \\dfrac{' + VCC + ' - 0.2 - ' + tn(sA.IE * RE, 4) + '}{' + tn(sA.IC, 4) + '} = ' + te(RCmax, 'Ω', 4) + '$']) + fin('R_{C,max} = ' + te(RCmax, 'Ω')) }],
            data: { v: v, VCC: VCC, RB: RB, RE: RE, bmax: bmax } };
        }
        var sa = bjtActive(VCC, RB, RC, RE, VCC, b);
        var sat = sa.VCE < 0.2;
        if (v !== 'rcmax' && sat !== wantSat) return null;
        if (Math.abs(sa.VCE - 0.2) < 0.6) return null;
        if (!sat && sa.VCE > VCC - 1) return null;
        var ss = sat ? bjtSat(VCC, RB, RC, RE, VCC) : null;
        if (sat && (ss.IB <= 0 || ss.IC <= 0 || ss.IC >= b * ss.IB)) return null;
        var fin2 = sat ? ss : sa, m = sat ? 'saturation' : 'active';
        var w = ['<b>Guess active.</b> $I_B = \\dfrac{' + VCC + ' - 0.7}{' + tn(RB) + (RE ? ' + ' + (b + 1) + '\\times' + tn(RE) : '') + '} = ' + te(sa.IB, 'A', 4) + '$, $I_C = \\beta I_B = ' + te(sa.IC, 'A', 4) + '$.', '$V_{CE} = V_{CC} - I_CR_C' + (RE ? ' - I_ER_E' : '') + ' = ' + te(sa.VCE, 'V', 4) + '$.'];
        if (!sat) w.push(activeCheck(sa));
        else {
          w.push('$V_{CE} < 0.2$ V: the collector circuit cannot carry $\\beta I_B$, so the guess fails. <b>Redo in saturation</b> ($V_{BE} = 0.7$, $V_{CE} = 0.2$; $I_C \\ne \\beta I_B$).');
          if (!RE) w.push('Emitter grounded, so $I_B$ is unchanged: $I_B = ' + te(ss.IB, 'A', 4) + '$, and $I_C = (V_{CC} - 0.2)/R_C = ' + te(ss.IC, 'A', 4) + '$.');
          else w.push('Base loop: $' + VCC + ' - ' + tn(RB) + 'I_B - 0.7 - ' + tn(RE) + '(I_B + I_C) = 0$; collector loop: $' + VCC + ' - ' + tn(RC) + 'I_C - 0.2 - ' + tn(RE) + '(I_B + I_C) = 0$. Solving: $I_B = ' + te(ss.IB, 'A', 4) + '$, $I_C = ' + te(ss.IC, 'A', 4) + '$.');
          w.push('Check: $I_B, I_C > 0$ and $I_C = ' + te(ss.IC, 'A', 3) + ' < \\beta I_B = ' + te(b * ss.IB, 'A', 3) + '$ (forced β = ' + tn(ss.IC / ss.IB, 3) + '), so the transistor is <b>saturated</b> ✓.');
        }
        var fig = RE ? tmpl('bjtEmitterBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), RE: rv(RE), beta: b }) : tmpl('bjtFixedBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), beta: b });
        return { stem: 'For the circuit shown ($V_{CC} = ' + VCC + '$ V, $\\beta = ' + b + '$, $V_{BE(on)} = 0.7$ V, $V_{CE(sat)} = 0.2$ V), find the operating mode and the actual collector current.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_C$', rv(RC)]].concat(RE ? [['$R_E$', rv(RE)]] : []).concat([['$\\beta$', String(b)]]),
          parts: [{ q: '(a) Find the mode, $I_C$ and $V_{CE}$. ' + MODEQ, answers: [modeAns('mode', m), A('$I_C$', fin2.IC, 'A'), A('$V_{CE}$', fin2.VCE, 'V', { abs: 0.02 })], working: st(w) + fin('\\text{' + m + '}:\\ I_C = ' + te(fin2.IC, 'A') + ',\\ V_{CE} = ' + te(fin2.VCE, 'V')) }],
          notes: QB.callout('trap', 'A negative $V_{CE}$ is not an arithmetic slip: it means the transistor is saturated. In saturation $I_C \\neq \\beta I_B$.'),
          data: { v: v, VCC: VCC, RB: RB, RC: RC, RE: RE, b: b } };
      }, 400);
    }
  });

  /* ---------------------------------------------------------------- bias2: collector feedback */
  QB.add({
    id: 'edc.bjt.bias2.cfb', course: 'edc', module: 'bjt', topic: 'bias2',
    title: 'Collector-feedback bias', difficulty: 2, marks: 6,
    variants: [{ id: 'basic', label: 'No emitter resistor' }, { id: 'withRE', label: 'With R_E' }, { id: 'betarange', label: 'β range: V_C at both ends' }],
    tags: ['WS5 Q16', 'Lecture 4 slide 39'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15, 20]), RF = r.eseries('E12', 82e3, 470e3), RC = r.eseries('E12', 1e3, 6.8e3), RE = v === 'basic' ? 0 : r.eseries('E12', 0.1e3, 1.2e3), b = r.int(60, 200);
        function solve(bb) { var IB = (VCC - 0.7) / (RF + (bb + 1) * (RC + RE)), IE = (bb + 1) * IB, IC = bb * IB, VC = VCC - IE * RC, VE = IE * RE; return { IB: IB, IE: IE, IC: IC, VC: VC, VE: VE, VCE: VC - VE }; }
        var s = solve(b);
        if (s.VCE < 1) return null;
        var fig = tmpl('bjtCollectorFeedback', { VCC: V(VCC), RF: rv(RF), RC: rv(RC), RE: RE ? rv(RE) : false, beta: v === 'betarange' ? null : b, currents: true });
        var g = [['$V_{CC}$', V(VCC)], ['$R_F$', rv(RF)], ['$R_C$', rv(RC)]].concat(RE ? [['$R_E$', rv(RE)]] : []);
        var w = function (bb, x) { return ['$R_C$ carries $I_C + I_B = I_E$. Loop $V_{CC} \\to R_C \\to R_F \\to$ B–E $\\to R_E$: $V_{CC} - I_ER_C - I_BR_F - 0.7' + (RE ? ' - I_ER_E' : '') + ' = 0$', '$I_B = \\dfrac{V_{CC} - 0.7}{R_F + (\\beta+1)(R_C' + (RE ? ' + R_E' : '') + ')} = \\dfrac{' + tn(VCC - 0.7, 4) + '}{' + tn(RF) + ' + ' + (bb + 1) + '\\times' + tn(RC + RE) + '} = ' + te(x.IB, 'A', 4) + '$', '$I_C = ' + te(x.IC, 'A', 4) + '$, $I_E = ' + te(x.IE, 'A', 4) + '$', '$V_C = V_{CC} - I_ER_C = ' + te(x.VC, 'V', 4) + '$, $V_{CE} = V_C - I_ER_E = ' + te(x.VCE, 'V', 4) + '$', 'Active ✓ ($V_{CE} > 0.2$ V). (The slides use $\\beta(R_C+R_E)$, which differs by under 1 %.)']; };
        if (v !== 'betarange') return { stem: 'For the collector-feedback circuit with $\\beta = ' + b + '$, find the Q-point.', figure: fig, given: g.concat([['$\\beta$', String(b)]]),
          parts: [{ q: '(a) Find $I_B$, $I_C$, $V_C$ and $V_{CE}$.', answers: [A('$I_B$', s.IB, 'A'), A('$I_C$', s.IC, 'A'), A('$V_C$', s.VC, 'V'), A('$V_{CE}$', s.VCE, 'V')], working: st(w(b, s)) + fin('I_C = ' + te(s.IC, 'A') + ',\\ V_{CE} = ' + te(s.VCE, 'V')) }],
          data: { v: v, VCC: VCC, RF: RF, RC: RC, RE: RE, b: b } };
        var b1 = r.pick([50, 60, 80, 100]), b2 = b1 + r.pick([40, 60, 100]), s1 = solve(b1), s2 = solve(b2);
        if (s2.VCE < 0.8) return null;
        var pct = (s2.IE - s1.IE) / s1.IE * 100;
        return { stem: 'The collector-feedback circuit uses transistors with ' + b1 + ' ≤ β ≤ ' + b2 + '. Find $V_C$ at both ends of the range.', figure: fig, given: g.concat([['β', b1 + ' to ' + b2]]),
          parts: [{ q: '(a) Find $I_E$ and $V_C$ with $\\beta = ' + b1 + '$.', answers: [A('$I_E$', s1.IE, 'A'), A('$V_C$', s1.VC, 'V')], working: st(w(b1, s1)) + fin('V_C = ' + te(s1.VC, 'V')) },
            { q: '(b) Find $I_E$ and $V_C$ with $\\beta = ' + b2 + '$, and the percentage change in $I_E$.', answers: [A('$I_E$', s2.IE, 'A'), A('$V_C$', s2.VC, 'V'), A('change', pct, '%')], working: st(w(b2, s2).slice(1, 4).concat(['$\\Delta I_E = ' + tn(pct, 3) + '\\%$ for a ' + tn((b2 - b1) / b1 * 100, 3) + ' % rise in β: the feedback through $R_F$ pulls $I_B$ down as $V_C$ falls.'])) + fin('V_C = ' + te(s2.VC, 'V') + ',\\ \\Delta I_E = ' + tn(pct, 3) + '\\%') }],
          data: { v: v, VCC: VCC, RF: RF, RC: RC, RE: RE, b1: b1, b2: b2 } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias2: emitter follower DC */
  QB.add({
    id: 'edc.bjt.bias2.ef', course: 'edc', module: 'bjt', topic: 'bias2',
    title: 'Emitter-follower DC bias', difficulty: 1, marks: 4,
    variants: [{ id: 'rb', label: 'R_B from V_CC' }, { id: 'divider', label: 'Divider bias (Thévenin)' }],
    tags: ['Lecture 4 slide 44', 'EX1 Q4(a)'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15, 18, 20]), b = r.int(60, 200), RE = r.eseries('E12', 0.47e3, 4.7e3), RB, R1, R2, VTh, RTh;
        if (v === 'rb') { RB = r.eseries('E12', 47e3, 470e3); VTh = VCC; RTh = RB; }
        else { R1 = r.eseries('E12', 10e3, 100e3); R2 = r.eseries('E12', 10e3, 100e3); VTh = VCC * R2 / (R1 + R2); RTh = par(R1, R2); }
        var s = bjtActive(VTh, RTh, 0, RE, VCC, b);
        if (s.VCE < 1 || s.IB <= 0) return null;
        var fig = tmpl('bjtEmitterFollower', v === 'rb' ? { VCC: V(VCC), RB: rv(RB), RE: rv(RE), beta: b, nodes: true } : { VCC: V(VCC), R1: rv(R1), R2: rv(R2), RE: rv(RE), beta: b, nodes: true });
        var w = (v === 'rb' ? [] : ['$E_{Th} = V_{CC}R_2/(R_1+R_2) = ' + te(VTh, 'V', 4) + '$, $R_{Th} = R_1\\parallel R_2 = ' + te(RTh, 'Ω', 4) + '$.']).concat(['Base loop: $I_B = \\dfrac{' + (v === 'rb' ? 'V_{CC}' : 'E_{Th}') + ' - 0.7}{' + (v === 'rb' ? 'R_B' : 'R_{Th}') + ' + (\\beta+1)R_E} = \\dfrac{' + tn(VTh - 0.7, 4) + '}{' + tn(RTh, 4) + ' + ' + (b + 1) + '\\times' + tn(RE) + '} = ' + te(s.IB, 'A', 4) + '$', '$I_E = (\\beta+1)I_B = ' + te(s.IE, 'A', 4) + '$, $V_E = I_ER_E = ' + te(s.VE, 'V', 4) + '$', 'Collector at $V_{CC}$: $V_{CE} = V_{CC} - V_E = ' + te(s.VCE, 'V', 4) + '$', activeCheck(s)]);
        return { stem: 'For the emitter follower ($\\beta = ' + b + '$), find the dc operating point.', figure: fig, given: [['$V_{CC}$', V(VCC)]].concat(v === 'rb' ? [['$R_B$', rv(RB)]] : [['$R_1$', rv(R1)], ['$R_2$', rv(R2)]]).concat([['$R_E$', rv(RE)], ['$\\beta$', String(b)]]),
          parts: [{ q: '(a) Find $I_B$, $I_E$, $V_E$ and $V_{CE}$.', answers: [A('$I_B$', s.IB, 'A'), A('$I_E$', s.IE, 'A'), A('$V_E$', s.VE, 'V'), A('$V_{CE}$', s.VCE, 'V')], working: st(w) + fin('I_E = ' + te(s.IE, 'A') + ',\\ V_E = ' + te(s.VE, 'V') + ',\\ V_{CE} = ' + te(s.VCE, 'V')) }],
          data: { v: v, VCC: VCC, RB: RB || 0, R1: R1 || 0, R2: R2 || 0, RE: RE, b: b } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias2: common base DC */
  QB.add({
    id: 'edc.bjt.bias2.cb', course: 'edc', module: 'bjt', topic: 'bias2',
    title: 'Common-base DC bias (dual supply)', difficulty: 2, marks: 5,
    variants: [{ id: 'npn', label: 'npn' }, { id: 'pnp', label: 'pnp' }],
    tags: ['Lecture 4 slide 46', 'WS5 Q10'],
    gen: function (r, v) {
      return r.retry(function () {
        var pnp = v === 'pnp', VEE = r.pick([2, 3, 4, 5, 6, 9]), VCC = r.pick([8, 10, 12, 15]), RE = r.eseries('E12', 0.47e3, 4.7e3), RC = r.eseries('E12', 1e3, 6.8e3), al = r.pick([0.98, 0.985, 0.99, 0.995]);
        var IE = (VEE - 0.7) / RE, IC = al * IE, IB = IE - IC, VCBm = VCC - IC * RC, VCEm = VCBm + 0.7;
        if (VCBm < 1) return null;
        var fig = tmpl('bjtCommonBase', { type: pnp ? 'pnp' : 'npn', VCC: pnp ? '−' + V(VCC) : V(VCC), VEE: pnp ? '+' + V(VEE) : '−' + V(VEE), RC: rv(RC), RE: rv(RE), alpha: al });
        var w = [pnp ? 'Base grounded, pnp active: $V_E = V_B + 0.7 = +0.7$ V.' : 'Base grounded, npn active: $V_E = V_B - 0.7 = -0.7$ V.', 'Emitter loop (find $I_E$ first): $I_E = \\dfrac{' + VEE + ' - 0.7}{R_E} = \\dfrac{' + tn(VEE - 0.7, 3) + '}{' + tn(RE) + '} = ' + te(IE, 'A', 4) + '$', '$I_C = \\alpha I_E = ' + te(IC, 'A', 4) + '$, $I_B = I_E - I_C = ' + te(IB, 'A', 4) + '$', pnp ? '$V_C = -V_{CC} + I_CR_C = ' + tn(-VCBm, 4) + '$ V, so $V_{BC} = ' + tn(VCBm, 4) + '$ V and $V_{EC} = 0.7 - V_C = ' + tn(VCEm, 4) + '$ V.' : '$V_C = V_{CB} = V_{CC} - I_CR_C = ' + tn(VCBm, 4) + '$ V, and $V_{CE} = V_C - V_E = ' + tn(VCEm, 4) + '$ V.', 'CB junction reverse biased ($|V_{CB}| > 0$) and $|V_{CE}| > 0.2$ V: active ✓.'];
        return { stem: 'In the common-base circuit the ' + (pnp ? 'pnp' : 'npn') + ' transistor ($\\alpha = ' + al + '$) has its base grounded. The emitter goes through $R_E$ to ' + (pnp ? '+' : '−') + VEE + ' V and the collector through $R_C$ to ' + (pnp ? '−' : '+') + VCC + ' V.', figure: fig, given: [['$V_{EE}$', (pnp ? '+' : '−') + V(VEE)], ['$V_{CC}$', (pnp ? '−' : '+') + V(VCC)], ['$R_E$', rv(RE)], ['$R_C$', rv(RC)], ['$\\alpha$', String(al)]],
          parts: [{ q: '(a) Find $I_E$, $I_C$ and $I_B$.', answers: [A('$I_E$', IE, 'A'), A('$I_C$', IC, 'A'), A('$I_B$', IB, 'A')], working: st(w.slice(0, 3)) + fin('I_E = ' + te(IE, 'A') + ',\\ I_C = ' + te(IC, 'A') + ',\\ I_B = ' + te(IB, 'A')) },
            { q: '(b) Find $|V_{CB}|$ and $|V_{CE}|$.', answers: [A('$|V_{CB}|$', VCBm, 'V'), A('$|V_{CE}|$', VCEm, 'V')], working: st(w.slice(3)) + fin('|V_{CB}| = ' + te(VCBm, 'V') + ',\\ |V_{CE}| = ' + te(VCEm, 'V')) }],
          notes: QB.callout('tip', 'β only enters a CB bias through $I_B = I_E/(\\beta+1)$.'),
          data: { v: v, VEE: VEE, VCC: VCC, RE: RE, RC: RC, al: al } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias2: pnp versions */
  QB.add({
    id: 'edc.bjt.bias2.pnp', course: 'edc', module: 'bjt', topic: 'bias2',
    title: 'pnp bias with a negative supply', difficulty: 2, marks: 6,
    variants: [{ id: 'fixed', label: 'pnp fixed bias' }, { id: 'emitter', label: 'pnp emitter bias' }, { id: 'vdb', label: 'pnp voltage divider (exact)' }],
    tags: ['EX2 Q5', 'WS5 Q10', 'PT Q8'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 12, 15, 18, 20]), b = r.int(60, 200), RC = r.eseries('E12', 1e3, 4.7e3), RE = v === 'fixed' ? 0 : r.eseries('E12', 0.33e3, 2.2e3);
        var RB, R1, R2, VTh, RTh;
        if (v === 'vdb') { R1 = r.eseries('E12', 10e3, 82e3); R2 = r.eseries('E12', 2.2e3, 22e3); VTh = VCC * R2 / (R1 + R2); RTh = par(R1, R2); if (VTh < 1.2) return null; }
        else { RB = r.eseries('E12', 100e3, 820e3); VTh = VCC; RTh = RB; }
        var s = bjtActive(VTh, RTh, RC, RE, VCC, b);
        if (s.VCE < 1) return null;
        var VC = -s.VC, VE = -s.VE, VB = -(s.VE + 0.7);
        var o = { type: 'pnp', VCC: '−' + V(VCC), RC: rv(RC), beta: b, nodes: true };
        if (v === 'vdb') { o.R1 = rv(R1); o.R2 = rv(R2); o.RE = rv(RE); } else { o.RB = rv(RB); if (RE) o.RE = rv(RE); }
        var fig = v === 'vdb' ? tmpl('bjtVDB', o) : v === 'emitter' ? tmpl('bjtEmitterBias', o) : tmpl('bjtFixedBias', o);
        var w = ['pnp: $I_E$ flows <i>into</i> the emitter, $I_B$ and $I_C$ flow <i>out</i>; $V_{EB} = 0.7$ V. Work in magnitudes with $|V_{CC}| = ' + VCC + '$ V.'];
        if (v === 'vdb') w.push('Thévenin at the base: $E_{Th} = -' + VCC + '\\dfrac{R_2}{R_1+R_2} = ' + tn(-VTh, 4) + '$ V, $R_{Th} = ' + te(RTh, 'Ω', 4) + '$.');
        w.push('Base loop (ground → $R_E$ → E–B → ' + (v === 'vdb' ? '$R_{Th}$ → $E_{Th}$' : '$R_B$ → $-V_{CC}$') + '): $I_B = \\dfrac{' + tn(VTh, 4) + ' - 0.7}{' + tn(RTh, 4) + (RE ? ' + ' + (b + 1) + '\\times' + tn(RE) : '') + '} = ' + te(s.IB, 'A', 4) + '$');
        w.push('$I_C = \\beta I_B = ' + te(s.IC, 'A', 4) + '$, $I_E = ' + te(s.IE, 'A', 4) + '$.');
        w.push('$V_E = -I_ER_E = ' + tn(VE, 4) + '$ V, $V_B = V_E - 0.7 = ' + tn(VB, 4) + '$ V, $V_C = -V_{CC} + I_CR_C = ' + tn(VC, 4) + '$ V.');
        w.push('$V_{EC} = V_E - V_C = ' + tn(s.VCE, 4) + '$ V > 0.2 V, so active ✓ ($V_{CE} = ' + tn(-s.VCE, 4) + '$ V).');
        return { stem: 'The pnp transistor ($\\beta = ' + b + '$) is biased from $-V_{CC} = -' + VCC + '$ V (collector side through $R_C$, emitter ' + (RE ? 'through $R_E$ to ground' : 'grounded') + '). Find the Q-point.', figure: fig, given: [['$-V_{CC}$', '−' + V(VCC)], ['$R_C$', rv(RC)]].concat(RE ? [['$R_E$', rv(RE)]] : []).concat(v === 'vdb' ? [['$R_1$', rv(R1)], ['$R_2$', rv(R2)]] : [['$R_B$', rv(RB)]]).concat([['$\\beta$', String(b)]]),
          parts: [{ q: '(a) Find $I_B$ and $I_C$.', answers: [A('$I_B$', s.IB, 'A'), A('$I_C$', s.IC, 'A')], working: st(w.slice(0, v === 'vdb' ? 4 : 3)) + fin('I_B = ' + te(s.IB, 'A') + ',\\ I_C = ' + te(s.IC, 'A')) },
            { q: '(b) Find $V_C$ (with its sign) and $V_{EC}$.', answers: [A('$V_C$', VC, 'V'), A('$V_{EC}$', s.VCE, 'V')], working: st(w.slice(v === 'vdb' ? 4 : 3)) + fin('V_C = ' + te(VC, 'V') + ',\\ V_{EC} = ' + te(s.VCE, 'V')) }],
          notes: QB.callout('trap', 'npn habits on a pnp: $V_B = V_E + 0.7$ or $I_B$ drawn into the base. With the emitter on a + rail instead (EX2 Q5) the same magnitudes apply.'),
          data: { v: v, VCC: VCC, b: b, RC: RC, RE: RE, RB: RB || 0, R1: R1 || 0, R2: R2 || 0 } };
      });
    }
  });

  /* ---------------------------------------------------------------- bias2: design */
  QB.add({
    id: 'edc.bjt.bias2.design', course: 'edc', module: 'bjt', topic: 'bias2',
    title: 'Bias design with the rules of thumb', difficulty: 2, marks: 6,
    variants: [{ id: 'vdb', label: 'Voltage-divider design' }, { id: 'emitter', label: 'Emitter-stabilised design' }],
    tags: ['WS5 Section 6', 'Prac 3 design'],
    gen: function (r, v) {
      var VCC = r.pick([9, 10, 12, 15, 18, 20, 24]), IC = r.pick([1, 1.5, 2, 2.5, 3, 4, 5]) * 1e-3, VCE = VCC / 2, VE = 0.1 * VCC;
      if (v === 'vdb') {
        var bmin = r.pick([80, 100, 120, 150]), RE = VE / IC, RC = (VCC - VCE - VE) / IC, R2 = bmin * RE / 10, VB = VE + 0.7, R1 = R2 * (VCC - VB) / VB;
        return { stem: 'Design a voltage-divider bias stage on $V_{CC} = ' + VCC + '$ V for $I_{CQ} = ' + te(IC, 'A') + '$ and $V_{CEQ} = V_{CC}/2$, with $\\beta_{min} = ' + bmin + '$. Use $V_E = 0.1V_{CC}$ and $I_E \\approx I_C$.', figure: tmpl('bjtVDB', { VCC: V(VCC), R1: true, R2: true, RC: true, RE: true, beta: 'β ≥ ' + bmin, nodes: true }), given: [['$V_{CC}$', V(VCC)], ['$I_{CQ}$', pe(IC, 'A')], ['$\\beta_{min}$', String(bmin)]],
          parts: [{ q: '(a) Find $R_E$ and $R_C$.', answers: [A('$R_E$', RE, 'Ω'), A('$R_C$', RC, 'Ω')], working: st(['$V_E = 0.1V_{CC} = ' + tn(VE, 3) + '$ V, $R_E = V_E/I_E \\approx ' + tn(VE, 3) + '/' + tn(IC) + ' = ' + te(RE, 'Ω', 4) + '$', '$R_C = \\dfrac{V_{CC} - V_{CE} - V_E}{I_C} = \\dfrac{' + VCC + ' - ' + tn(VCE, 3) + ' - ' + tn(VE, 3) + '}{' + tn(IC) + '} = ' + te(RC, 'Ω', 4) + '$']) + fin('R_E = ' + te(RE, 'Ω') + ',\\ R_C = ' + te(RC, 'Ω')) },
            { q: '(b) Find the largest $R_2$ that makes the approximate method valid, and the matching $R_1$.', answers: [A('$R_2$', R2, 'Ω'), A('$R_1$', R1, 'Ω')], working: st(['$\\beta_{min}R_E \\ge 10R_2 \\Rightarrow R_2 \\le ' + bmin + '\\times' + tn(RE, 4) + '/10 = ' + te(R2, 'Ω', 4) + '$', '$V_B = V_E + 0.7 = ' + tn(VB, 3) + '$ V; divider with base current neglected: $R_1 = R_2\\dfrac{V_{CC} - V_B}{V_B} = ' + tn(R2, 4) + '\\times\\dfrac{' + tn(VCC - VB, 3) + '}{' + tn(VB, 3) + '} = ' + te(R1, 'Ω', 4) + '$', 'Choose standard values and re-check with the exact method.']) + fin('R_2 = ' + te(R2, 'Ω') + ',\\ R_1 = ' + te(R1, 'Ω')) }],
          data: { v: v, VCC: VCC, IC: IC, bmin: bmin } };
      }
      var b = r.int(80, 200), IE = IC * (b + 1) / b, IB = IC / b, RE2 = VE / IE, RC2 = (VCC - VCE - VE) / IC, RB = (VCC - 0.7 - VE) / IB;
      return { stem: 'Design an emitter-stabilised stage on $V_{CC} = ' + VCC + '$ V with $\\beta = ' + b + '$ for $I_{CQ} = ' + te(IC, 'A') + '$, $V_{CEQ} = V_{CC}/2$ and $V_E = 0.1V_{CC}$.', figure: tmpl('bjtEmitterBias', { VCC: V(VCC), RB: true, RC: true, RE: true, beta: b, nodes: true }), given: [['$V_{CC}$', V(VCC)], ['$I_{CQ}$', pe(IC, 'A')], ['$\\beta$', String(b)]],
        parts: [{ q: '(a) Find $R_E$, $R_C$ and $R_B$.', answers: [A('$R_E$', RE2, 'Ω'), A('$R_C$', RC2, 'Ω'), A('$R_B$', RB, 'Ω')], working: st(['$I_E = I_C(\\beta+1)/\\beta = ' + te(IE, 'A', 4) + '$, $I_B = I_C/\\beta = ' + te(IB, 'A', 4) + '$.', '$R_E = V_E/I_E = ' + tn(VE, 3) + '/' + tn(IE, 4) + ' = ' + te(RE2, 'Ω', 4) + '$', '$R_C = (V_{CC} - V_{CE} - V_E)/I_C = ' + te(RC2, 'Ω', 4) + '$', 'Base loop: $R_B = \\dfrac{V_{CC} - 0.7 - V_E}{I_B} = \\dfrac{' + tn(VCC - 0.7 - VE, 4) + '}{' + tn(IB, 4) + '} = ' + te(RB, 'Ω', 4) + '$']) + fin('R_E = ' + te(RE2, 'Ω') + ',\\ R_C = ' + te(RC2, 'Ω') + ',\\ R_B = ' + te(RB, 'Ω')) }],
        data: { v: v, VCC: VCC, IC: IC, b: b } };
    }
  });

  /* ---------------------------------------------------------------- small-signal helpers */
  var VT26 = 0.026;
  function reOf(IE) { return VT26 / IE; }
  /** voltage-divider DC with the course rule: approximate if βRE ≥ 10R2, else exact */
  function vdbDC(VCC, R1, R2, RC, RE, b) {
    var VTh = VCC * R2 / (R1 + R2), RTh = par(R1, R2), pass = b * RE >= 10 * R2;
    var ex = bjtActive(VTh, RTh, RC, RE, VCC, b);
    var IE = pass ? (VTh - 0.7) / RE : ex.IE;
    var VCE = pass ? VCC - IE * (RC + RE) : ex.VCE;
    var w = ['Test: $\\beta R_E = ' + te(b * RE, 'Ω') + '$ vs $10R_2 = ' + te(10 * R2, 'Ω') + '$: ' + (pass ? 'passes, so use the approximate method.' : 'fails, so use the exact (Thévenin) method.')];
    if (pass) w.push('$V_B = \\dfrac{R_2V_{CC}}{R_1+R_2} = ' + te(VTh, 'V', 4) + '$, $V_E = V_B - 0.7 = ' + te(VTh - 0.7, 'V', 4) + '$, $I_E = V_E/R_E = ' + te(IE, 'A', 4) + '$.');
    else w.push('$E_{Th} = ' + te(VTh, 'V', 4) + '$, $R_{Th} = ' + te(RTh, 'Ω', 4) + '$, $I_B = \\dfrac{E_{Th} - 0.7}{R_{Th} + (\\beta+1)R_E} = ' + te(ex.IB, 'A', 4) + '$, $I_E = (\\beta+1)I_B = ' + te(IE, 'A', 4) + '$.');
    w.push('$V_{CE} \\approx ' + te(VCE, 'V', 3) + '$ > 0.2 V: active ✓.');
    return { IE: IE, VCE: VCE, pass: pass, w: w, RTh: RTh, VTh: VTh };
  }
  function phase(neg) { return neg ? '(180° phase shift)' : '(in phase)'; }

  /* ---------------------------------------------------------------- ss: parameters */
  QB.add({
    id: 'edc.bjt.ss.params', course: 'edc', module: 'bjt', topic: 'ss',
    title: 'Small-signal parameters: r_e, g_m, r_π, r_o', difficulty: 1, marks: 4,
    variants: [{ id: 're', label: 'r_e model (Boylestad, 26 mV, h-parameters)' }, { id: 'hybrid', label: 'Hybrid-π (Sedra, V_T given)' }],
    tags: ['WS6 Q1–Q2', 'E6 Type A'],
    gen: function (r, v) {
      var b = r.int(50, 250), IC = r.pick([0.5, 1, 1.5, 2, 2.5, 4, 5, 10]) * 1e-3;
      if (v === 're') {
        var IE = IC * (b + 1) / b, re = reOf(IE), hoe = r.pick([10, 20, 25, 30, 40, 50]) * 1e-6, ro = 1 / hoe;
        return { stem: 'A BJT with $\\beta = ' + b + '$ is biased at $I_C = ' + te(IC, 'A') + '$. Its output admittance is $h_{oe} = ' + te(hoe, 'S') + '$. Use $r_e = 26\\text{ mV}/I_E$.', figure: tmpl('reModel', { vi: true, ro: true, RC: false }), given: [['$\\beta$', String(b)], ['$I_C$', pe(IC, 'A')], ['$h_{oe}$', pe(hoe, 'S')]],
          parts: [{ q: '(a) Find $I_E$, $r_e$ and $\\beta r_e$ (= $h_{ie}$).', answers: [A('$I_E$', IE, 'A', { sig: 4 }), A('$r_e$', re, 'Ω'), A('$\\beta r_e$', b * re, 'Ω')], working: st(['$I_E = I_C(\\beta+1)/\\beta = ' + te(IE, 'A', 4) + '$', '$r_e = 26\\text{ mV}/I_E = ' + te(re, 'Ω', 4) + '$ (use $I_E$, not $I_C$)', '$h_{ie} = \\beta r_e = ' + te(b * re, 'Ω', 4) + '$']) + fin('r_e = ' + te(re, 'Ω') + ',\\ \\beta r_e = ' + te(b * re, 'Ω')) },
            { q: '(b) Find $r_o$ and state $h_{fe}$.', answers: [A('$r_o$', ro, 'Ω'), A('$h_{fe}$', b, '')], working: st(['$r_o = 1/h_{oe} = ' + te(ro, 'Ω') + '$', '$h_{fe} = \\beta_{ac} = ' + b + '$; $h_{re}$ is neglected.']) + fin('r_o = ' + te(ro, 'Ω') + ',\\ h_{fe} = ' + b) }],
          data: { v: v, b: b, IC: IC, hoe: hoe } };
      }
      var VT = r.pick([0.025, 0.026]), VA = r.pick([50, 75, 100, 120, 150, 200]);
      var gm = IC / VT, rpi = b / gm, IE2 = IC * (b + 1) / b, re2 = VT / IE2, ro2 = VA / IC;
      return { stem: 'A BJT with $\\beta = ' + b + '$ and Early voltage $V_A = ' + VA + '$ V is biased at $I_C = ' + te(IC, 'A') + '$. Use $V_T = ' + (VT * 1000) + '$ mV.', figure: tmpl('hybridPiModel', { vi: true, ro: true }), given: [['$\\beta$', String(b)], ['$I_C$', pe(IC, 'A')], ['$V_A$', V(VA)], ['$V_T$', pe(VT, 'V')]],
        parts: [{ q: '(a) Find $g_m$, $r_\\pi$ and $r_e$.', answers: [A('$g_m$', gm, 'S'), A('$r_\\pi$', rpi, 'Ω'), A('$r_e$', re2, 'Ω')], working: st(['$g_m = I_C/V_T = ' + tn(IC) + '/' + VT + ' = ' + te(gm, 'S', 4) + '$', '$r_\\pi = \\beta/g_m = ' + te(rpi, 'Ω', 4) + '$', '$r_e = V_T/I_E = \\alpha/g_m = ' + te(re2, 'Ω', 4) + '$', 'Check: $r_\\pi = (\\beta+1)r_e$ ✓ and $g_mr_e = \\alpha \\approx 1$.']) + fin('g_m = ' + te(gm, 'S') + ',\\ r_\\pi = ' + te(rpi, 'Ω') + ',\\ r_e = ' + te(re2, 'Ω')) },
          { q: '(b) Find $r_o$.', answers: [A('$r_o$', ro2, 'Ω')], working: st(['$r_o = V_A/I_C = ' + VA + '/' + tn(IC) + '$']) + fin('r_o = ' + te(ro2, 'Ω')) }],
        data: { v: v, b: b, IC: IC, VT: VT, VA: VA } };
    }
  });

  /* ---------------------------------------------------------------- ss: CE fixed bias */
  QB.add({
    id: 'edc.bjt.ss.cefixed', course: 'edc', module: 'bjt', topic: 'ss',
    title: 'CE fixed-bias amplifier: r_e, Z_i, Z_o, A_v', difficulty: 2, marks: 8,
    variants: [{ id: 'noro', label: 'r_o ignored' }, { id: 'ro', label: 'With r_o' }, { id: 'hybrid', label: 'Hybrid-π (g_m, r_π)' }],
    tags: ['Week 5 slide 34', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15, 18, 20]), b = r.int(60, 250), RB = r.eseries('E12', 150e3, 1.2e6), RC = r.eseries('E12', 1e3, 6.8e3), ro = v === 'noro' ? Infinity : r.pick([30, 40, 50, 60, 80, 100]) * 1e3;
        var s = bjtActive(VCC, RB, RC, 0, VCC, b);
        if (s.VCE < 1.5) return null;
        var re = reOf(s.IE), Zb = b * re, Zi = par(RB, Zb), RCo = isFinite(ro) ? par(RC, ro) : RC;
        var gm = s.IC / VT26, rpi = b / gm;
        var hy = v === 'hybrid';
        var Av = hy ? -gm * RCo : -RCo / re, Zi2 = hy ? par(RB, rpi) : Zi;
        var fig = tmpl('bjtFixedBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), beta: b, C1: true, C2: true, vi: true, vo: true });
        var model = hy ? tmpl('hybridPiModel', { vi: true, RB: true, ro: isFinite(ro), RC: true, Zi: true, Zo: true }) : tmpl('reModel', { vi: true, RB: true, ro: isFinite(ro), RC: true, Zi: true, Zo: true });
        var dc = ['DC (capacitors open): $I_B = \\dfrac{V_{CC} - 0.7}{R_B} = \\dfrac{' + tn(VCC - 0.7, 3) + '}{' + tn(RB) + '} = ' + te(s.IB, 'A', 4) + '$, $I_E = (\\beta+1)I_B = ' + te(s.IE, 'A', 4) + '$.', '$V_{CE} = V_{CC} - I_CR_C = ' + te(s.VCE, 'V', 3) + '$ > 0.2 V: active ✓.'];
        var p1 = hy ? { q: '(a) Find $g_m$ and $r_\\pi$ at the Q-point (26 mV).', answers: [A('$g_m$', gm, 'S'), A('$r_\\pi$', rpi, 'Ω')], working: st(dc.concat(['$g_m = I_C/V_T = ' + tn(s.IC, 4) + '/0.026 = ' + te(gm, 'S', 4) + '$, $r_\\pi = \\beta/g_m = ' + te(rpi, 'Ω', 4) + '$'])) + fin('g_m = ' + te(gm, 'S') + ',\\ r_\\pi = ' + te(rpi, 'Ω')) }
          : { q: '(a) Find the Q-point emitter current and $r_e$.', answers: [A('$I_E$', s.IE, 'A'), A('$r_e$', re, 'Ω')], working: st(dc.concat(['$r_e = 26\\text{ mV}/I_E = ' + te(re, 'Ω', 4) + '$'])) + fin('r_e = ' + te(re, 'Ω')) };
        var p2 = { q: '(b) Find $Z_i$, $Z_o$ and $A_v$' + (isFinite(ro) ? ' including $r_o = ' + te(ro, 'Ω') + '$' : ' ($r_o = \\infty$)') + '.', answers: [A('$Z_i$', Zi2, 'Ω'), A('$Z_o$', RCo, 'Ω'), A('$A_v$', Av, '')],
          working: (model || '') + st(['AC equivalent: $V_{CC}$ to ground and capacitors shorted, so $R_B$ and $R_C$ both go to ground.', hy ? '$Z_i = R_B\\parallel r_\\pi = ' + tn(RB) + '\\parallel' + tn(rpi, 4) + ' = ' + te(Zi2, 'Ω', 4) + '$' : '$Z_i = R_B\\parallel\\beta r_e = ' + tn(RB) + '\\parallel' + tn(Zb, 4) + ' = ' + te(Zi2, 'Ω', 4) + '$', 'Set $v_i = 0$: the controlled source is open, so $Z_o = R_C' + (isFinite(ro) ? '\\parallel r_o = ' + te(RCo, 'Ω', 4) : ' = ' + te(RC, 'Ω')) + '$', hy ? '$A_v = -g_m(R_C' + (isFinite(ro) ? '\\parallel r_o' : '') + ') = -' + tn(gm, 4) + '\\times' + tn(RCo, 4) + ' = ' + tn(Av, 4) + '$ ' + phase(true) : '$A_v = -\\dfrac{R_C' + (isFinite(ro) ? '\\parallel r_o' : '') + '}{r_e} = -\\dfrac{' + tn(RCo, 4) + '}{' + tn(re, 4) + '} = ' + tn(Av, 4) + '$ ' + phase(true), isFinite(ro) ? ('$r_o/R_C = ' + tn(ro / RC, 3) + '$: ' + (ro >= 10 * RC ? 'dropping $r_o$ would be acceptable here, but it was given, so use it.' : 'less than 10, so $r_o$ cannot be ignored.')) : 'Sanity check: $|A_v| \\approx V_{R_C}/V_T = ' + tn(s.IC * RC / VT26, 4) + '$.']) + fin('Z_i = ' + te(Zi2, 'Ω') + ',\\ Z_o = ' + te(RCo, 'Ω') + ',\\ A_v = ' + tn(Av, 4)) };
        return { stem: 'For the CE fixed-bias amplifier ($V_{CC} = ' + VCC + '$ V, $\\beta = ' + b + '$' + (isFinite(ro) ? ', $r_o = ' + te(ro, 'Ω') + '$' : '') + '), find the small-signal quantities. Use $r_e = 26\\text{ mV}/I_E$.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_C$', rv(RC)], ['$\\beta$', String(b)]].concat(isFinite(ro) ? [['$r_o$', rv(ro)]] : []), parts: [p1, p2],
          notes: QB.callout('trap', 'Every AC answer starts from the DC Q-point: no $I_E$, no $r_e$.'),
          data: { v: v, VCC: VCC, RB: RB, RC: RC, b: b, ro: isFinite(ro) ? ro : 0 } };
      });
    }
  });

  /* ---------------------------------------------------------------- ss: CE voltage divider, bypassed */
  QB.add({
    id: 'edc.bjt.ss.cevdb', course: 'edc', module: 'bjt', topic: 'ss',
    title: 'CE voltage-divider amplifier, R_E bypassed', difficulty: 2, marks: 8,
    variants: [{ id: 'approx', label: 'DC by the approximate method' }, { id: 'exact', label: 'DC by the exact method (test fails)' }, { id: 'ro', label: 'With r_o' }],
    tags: ['Week 5 slide 40', 'EX1 Q3', 'Prac 3', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([10, 12, 15, 18, 20, 22]), b = r.int(60, 250), R1 = r.eseries('E12', 22e3, 100e3), R2 = r.eseries('E12', 3.3e3, 22e3), RC = r.eseries('E12', 1e3, 6.8e3), RE = r.eseries('E12', 0.47e3, 2.2e3), ro = v === 'ro' ? r.pick([30, 40, 50, 80]) * 1e3 : Infinity;
        var dc = vdbDC(VCC, R1, R2, RC, RE, b);
        if (v === 'approx' && !dc.pass) return null;
        if (v === 'exact' && dc.pass) return null;
        if (dc.VCE < 1.5 || dc.VTh < 1.2) return null;
        var re = reOf(dc.IE), Rp = par(R1, R2), Zi = par(Rp, b * re), RCo = isFinite(ro) ? par(RC, ro) : RC, Av = -RCo / re;
        var fig = tmpl('bjtVDB', { VCC: V(VCC), R1: rv(R1), R2: rv(R2), RC: rv(RC), RE: rv(RE), CE: true, beta: b, C1: true, C2: true, vi: true, vo: true });
        return { stem: 'For the voltage-divider CE amplifier with $R_E$ fully bypassed ($\\beta = ' + b + '$' + (isFinite(ro) ? ', $r_o = ' + te(ro, 'Ω') + '$' : ', $r_o = \\infty$') + '), find $r_e$, $Z_i$, $Z_o$ and $A_v$.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_1$', rv(R1)], ['$R_2$', rv(R2)], ['$R_C$', rv(RC)], ['$R_E$', rv(RE)], ['$\\beta$', String(b)]].concat(isFinite(ro) ? [['$r_o$', rv(ro)]] : []),
          parts: [{ q: '(a) Find $I_E$ and $r_e$.', answers: [A('$I_E$', dc.IE, 'A'), A('$r_e$', re, 'Ω')], working: st(['DC: capacitors open, so $R_E$ is in circuit.'].concat(dc.w).concat(['$r_e = 26\\text{ mV}/I_E = ' + te(re, 'Ω', 4) + '$'])) + fin('r_e = ' + te(re, 'Ω')) },
            { q: '(b) Find $Z_i$, $Z_o$ and $A_v$.', answers: [A('$Z_i$', Zi, 'Ω'), A('$Z_o$', RCo, 'Ω'), A('$A_v$', Av, '')], working: (tmpl('reModel', { vi: true, RB: { label: 'R_1∥R_2' }, ro: isFinite(ro), RC: true, Zi: true, Zo: true }) || '') + st(['AC: $C_E$ shorts $R_E$; $R_1$ and $R_2$ both go to ground: $R\' = R_1\\parallel R_2 = ' + te(Rp, 'Ω', 4) + '$.', '$\\beta r_e = ' + te(b * re, 'Ω', 4) + '$, $Z_i = R\'\\parallel\\beta r_e = ' + te(Zi, 'Ω', 4) + '$', '$Z_o = R_C' + (isFinite(ro) ? '\\parallel r_o' : '') + ' = ' + te(RCo, 'Ω', 4) + '$', '$A_v = -\\dfrac{' + (isFinite(ro) ? 'R_C\\parallel r_o' : 'R_C') + '}{r_e} = -\\dfrac{' + tn(RCo, 4) + '}{' + tn(re, 4) + '} = ' + tn(Av, 4) + '$ ' + phase(true), '$R_E$ never appears in $Z_i$, $Z_o$ or $A_v$, but it set $I_E$ and hence $r_e$.']) + fin('Z_i = ' + te(Zi, 'Ω') + ',\\ Z_o = ' + te(RCo, 'Ω') + ',\\ A_v = ' + tn(Av, 4)) }],
          notes: QB.callout('trap', 'Leaving $R_E$ in the AC circuit when $C_E$ bypasses it, or writing $Z_i = \\beta r_e$ without $R_1\\parallel R_2$.'),
          data: { v: v, VCC: VCC, R1: R1, R2: R2, RC: RC, RE: RE, b: b, ro: isFinite(ro) ? ro : 0 } };
      });
    }
  });

  /* ---------------------------------------------------------------- ss: total waveforms */
  QB.add({
    id: 'edc.bjt.ss.wave', course: 'edc', module: 'bjt', topic: 'ss',
    title: 'Total instantaneous waveforms (DC + AC)', difficulty: 2, marks: 5,
    variants: [{ id: 'given', label: 'I_C given (Sedra style)' }, { id: 'fixed', label: 'Fixed-bias Q-point first' }],
    tags: ['WS6 Q3', 'E6 Type E'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([10, 12, 15, 20]), RC = r.eseries('E12', 1e3, 10e3), b = r.pick([50, 80, 100, 120, 150, 200]), VT = v === 'given' ? 0.025 : 0.026, vm = r.pick([2, 3, 4, 5, 8]) * 1e-3, IC, RB = 0;
        if (v === 'given') IC = r.pick([0.5, 1, 1.5, 2]) * 1e-3;
        else { RB = r.eseries('E12', 220e3, 2.2e6); IC = b * (VCC - 0.7) / RB; }
        var VC = VCC - IC * RC;
        if (VC < 2 || VC > VCC - 1) return null;
        var gm = IC / VT, Av = -gm * RC, rpi = b / gm, vc = Math.abs(Av) * vm, ib = vm / rpi, IB = IC / b, vmin = VC - vc;
        if (vmin < 1) return null;
        return { stem: (v === 'given' ? 'A CE stage with $R_C = ' + rv(RC).replace(' ', '\\,') + '$ on $V_{CC} = ' + VCC + '$ V has its dc $V_{BE}$ set so that $I_C = ' + te(IC, 'A') + '$; $\\beta = ' + b + '$.' : 'A fixed-bias CE stage has $V_{CC} = ' + VCC + '$ V, $R_B = ' + rv(RB).replace(' ', '\\,') + '$, $R_C = ' + rv(RC).replace(' ', '\\,') + '$ and $\\beta = ' + b + '$.') + ' A signal $v_{be} = ' + (vm * 1000) + '\\sin\\omega t$ mV is added at the base. Use $V_T = ' + (VT * 1000) + '$ mV.', figure: v === 'fixed' ? tmpl('bjtFixedBias', { VCC: V(VCC), RB: rv(RB), RC: rv(RC), beta: b, C1: true, vi: true, vo: true }) : null, given: [['$V_{CC}$', V(VCC)], ['$R_C$', rv(RC)], ['$\\beta$', String(b)], ['$v_{be}$', (vm * 1000) + ' mV peak']],
          parts: [{ q: '(a) Find the dc $V_C$, $g_m$ and the gain $v_{ce}/v_{be}$.', answers: [A('$V_C$', VC, 'V'), A('$g_m$', gm, 'S'), A('$A_v$', Av, '')], working: st((v === 'fixed' ? ['$I_B = (V_{CC} - 0.7)/R_B = ' + te(IB, 'A', 4) + '$, $I_C = \\beta I_B = ' + te(IC, 'A', 4) + '$.'] : []).concat(['$V_C = V_{CC} - I_CR_C = ' + te(VC, 'V', 4) + '$', '$g_m = I_C/V_T = ' + te(gm, 'S', 4) + '$', '$A_v = -g_mR_C = ' + tn(Av, 4) + '$'])) + fin('V_C = ' + te(VC, 'V') + ',\\ A_v = ' + tn(Av, 4)) },
            { q: '(b) Write $v_C(t)$ and $i_B(t)$: give the ac amplitudes and the minimum of $v_C$.', answers: [A('$\\hat v_c$', vc, 'V'), A('$\\hat i_b$', ib, 'A'), A('$v_{C,min}$', vmin, 'V')], working: st(['$v_c = A_vv_{be} = -' + tn(vc, 4) + '\\sin\\omega t$ V, so $v_C(t) = ' + tn(VC, 4) + ' - ' + tn(vc, 4) + '\\sin\\omega t$ V (inverted).', '$r_\\pi = \\beta/g_m = ' + te(rpi, 'Ω', 4) + '$, $i_b = v_{be}/r_\\pi$: $i_B(t) = ' + te(IB, 'A', 3) + ' + ' + te(ib, 'A', 3) + '\\sin\\omega t$ (in phase with $v_{be}$).', '$v_{C,min} = ' + te(vmin, 'V', 3) + '$, which stays well above the base (≈0.7 V), so the BJT stays active.']) + fin('v_C(t) = ' + tn(VC, 3) + ' - ' + tn(vc, 3) + '\\sin\\omega t\\ \\text{V}') }],
          data: { v: v, VCC: VCC, RC: RC, b: b, VT: VT, vm: vm, IC: IC, RB: RB } };
      });
    }
  });

  /* ---------------------------------------------------------------- ss2: unbypassed / partially bypassed */
  QB.add({
    id: 'edc.bjt.ss2.unbyp', course: 'edc', module: 'bjt', topic: 'ss2',
    title: 'CE with unbypassed or partially bypassed R_E', difficulty: 2, marks: 8,
    variants: [{ id: 'unbyp', label: 'R_E unbypassed' }, { id: 'partial', label: 'R_E1 unbypassed, R_E2 bypassed' }],
    tags: ['Week 5 slides 36–39', 'Prac 3', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var vdb = r.bool(), VCC = r.pick([12, 15, 18, 20]), b = r.int(80, 250), RC = r.eseries('E12', 1.5e3, 6.8e3);
        var RE1 = v === 'partial' ? r.eseries('E12', 47, 330) : r.eseries('E12', 0.33e3, 1.5e3), RE2 = v === 'partial' ? r.eseries('E12', 0.33e3, 1.5e3) : 0, REt = RE1 + RE2;
        var IE, dcw, RB = 0, R1 = 0, R2 = 0, Rbias;
        if (vdb) { R1 = r.eseries('E12', 22e3, 82e3); R2 = r.eseries('E12', 4.7e3, 22e3); var dc = bjtActive(VCC * R2 / (R1 + R2), par(R1, R2), RC, REt, VCC, b); if (dc.VCE < 1.5) return null; IE = dc.IE; Rbias = par(R1, R2); dcw = ['DC uses the whole $R_E = ' + te(REt, 'Ω') + '$ (capacitors open). Exact method: $E_{Th} = ' + te(VCC * R2 / (R1 + R2), 'V', 4) + '$, $R_{Th} = ' + te(par(R1, R2), 'Ω', 4) + '$, $I_B = ' + te(dc.IB, 'A', 4) + '$, $I_E = ' + te(IE, 'A', 4) + '$, $V_{CE} = ' + te(dc.VCE, 'V', 3) + '$ (active).']; }
        else { RB = r.eseries('E12', 220e3, 1e6); var dc2 = bjtActive(VCC, RB, RC, REt, VCC, b); if (dc2.VCE < 1.5) return null; IE = dc2.IE; Rbias = RB; dcw = ['DC uses the whole $R_E = ' + te(REt, 'Ω') + '$: $I_B = \\dfrac{V_{CC} - 0.7}{R_B + (\\beta+1)R_E} = ' + te(dc2.IB, 'A', 4) + '$, $I_E = ' + te(IE, 'A', 4) + '$, $V_{CE} = ' + te(dc2.VCE, 'V', 3) + '$ (active).']; }
        var re = reOf(IE), Zb = b * (re + RE1), Zi = par(Rbias, Zb), Av = -RC / (re + RE1);
        var o = { VCC: V(VCC), RC: rv(RC), beta: b, C1: true, C2: true, vi: true, vo: true };
        if (v === 'partial') { o.RE1 = rv(RE1); o.RE2 = rv(RE2); o.CE = true; } else o.RE = rv(RE1);
        if (vdb) { o.R1 = rv(R1); o.R2 = rv(R2); } else o.RB = rv(RB);
        var fig = vdb ? tmpl('bjtVDB', o) : tmpl('bjtEmitterBias', o);
        var Re = v === 'partial' ? 'R_{E1}' : 'R_E';
        return { stem: 'For the CE amplifier shown (' + (vdb ? 'divider' : 'emitter-resistor') + ' bias, $\\beta = ' + b + '$, $r_o$ ignored), ' + (v === 'partial' ? '$R_{E1}$ is unbypassed and $R_{E2}$ is bypassed by $C_E$' : '$R_E$ has no bypass capacitor') + '. Find $r_e$, $Z_i$, $Z_o$ and $A_v$.', figure: fig, given: [['$V_{CC}$', V(VCC)]].concat(vdb ? [['$R_1$', rv(R1)], ['$R_2$', rv(R2)]] : [['$R_B$', rv(RB)]]).concat([['$R_C$', rv(RC)]]).concat(v === 'partial' ? [['$R_{E1}$', rv(RE1)], ['$R_{E2}$', rv(RE2)]] : [['$R_E$', rv(RE1)]]).concat([['$\\beta$', String(b)]]),
          parts: [{ q: '(a) Find $I_E$ and $r_e$.', answers: [A('$I_E$', IE, 'A'), A('$r_e$', re, 'Ω')], working: st(dcw.concat(['$r_e = 26\\text{ mV}/I_E = ' + te(re, 'Ω', 4) + '$'])) + fin('r_e = ' + te(re, 'Ω')) },
            { q: '(b) Find $Z_b$, $Z_i$, $Z_o$ and $A_v$.', answers: [A('$Z_b$', Zb, 'Ω'), A('$Z_i$', Zi, 'Ω'), A('$Z_o$', RC, 'Ω'), A('$A_v$', Av, '')], working: (tmpl('reModel', { vi: true, RB: { label: vdb ? 'R_1∥R_2' : 'R_B' }, RC: true, RE: { label: Re } }) || '') + st(['At signal frequency only $' + Re + ' = ' + te(RE1, 'Ω') + '$ is in the emitter' + (v === 'partial' ? ' ($C_E$ shorts $R_{E2}$)' : '') + '. Reflect it into the base:', '$Z_b \\cong \\beta(r_e + ' + Re + ') = ' + b + '(' + tn(re, 4) + ' + ' + tn(RE1) + ') = ' + te(Zb, 'Ω', 4) + '$', '$Z_i = ' + (vdb ? 'R_1\\parallel R_2' : 'R_B') + '\\parallel Z_b = ' + tn(Rbias, 4) + '\\parallel' + tn(Zb, 4) + ' = ' + te(Zi, 'Ω', 4) + '$', '$Z_o = R_C = ' + te(RC, 'Ω') + '$', '$A_v = -\\dfrac{R_C}{r_e + ' + Re + '} = -\\dfrac{' + tn(RC) + '}{' + tn(re + RE1, 4) + '} = ' + tn(Av, 4) + '$ ' + phase(true) + ' (compare $-R_C/' + Re + ' = ' + tn(-RC / RE1, 3) + '$)']) + fin('Z_i = ' + te(Zi, 'Ω') + ',\\ Z_o = ' + te(RC, 'Ω') + ',\\ A_v = ' + tn(Av, 4)) }],
          notes: QB.callout('trap', 'DC uses the whole $R_E$; AC uses only the unbypassed part.'),
          data: { v: v, vdb: vdb, VCC: VCC, RB: RB, R1: R1, R2: R2, RC: RC, RE1: RE1, RE2: RE2, b: b } };
      });
    }
  });

  /* ---------------------------------------------------------------- ss2: emitter follower AC */
  QB.add({
    id: 'edc.bjt.ss2.ef', course: 'edc', module: 'bjt', topic: 'ss2',
    title: 'Emitter follower: Z_i, Z_o, A_v with source and load', difficulty: 2, marks: 9,
    variants: [{ id: 'noload', label: 'Unloaded, ideal source' }, { id: 'loaded', label: 'With R_s and R_L' }],
    tags: ['Week 5 slide 42', 'EX1 Q4', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15, 18]), b = r.int(60, 200), RB = r.eseries('E12', 100e3, 470e3), RE = r.eseries('E12', 1e3, 4.7e3);
        var s = bjtActive(VCC, RB, 0, RE, VCC, b);
        if (s.VCE < 1.5) return null;
        var re = reOf(s.IE);
        var Rs = r.pick([50, 100, 600, 1e3, 2.2e3]), RL = r.eseries('E12', 0.47e3, 4.7e3);
        var fig = tmpl('bjtEmitterFollower', v === 'loaded' ? { VCC: V(VCC), RB: rv(RB), RE: rv(RE), beta: b, C1: true, C2: true, Rs: rv(Rs), vs: true, RL: rv(RL), vo: true } : { VCC: V(VCC), RB: rv(RB), RE: rv(RE), beta: b, C1: true, C2: true, vi: true, vo: true });
        var dc = ['DC: $I_B = \\dfrac{V_{CC} - 0.7}{R_B + (\\beta+1)R_E} = ' + te(s.IB, 'A', 4) + '$, $I_E = ' + te(s.IE, 'A', 4) + '$, $V_{CE} = ' + te(s.VCE, 'V', 3) + '$ (active).', '$r_e = 26\\text{ mV}/I_E = ' + te(re, 'Ω', 4) + '$'];
        if (v === 'noload') {
          var Zb = b * (re + RE), Zi = par(RB, Zb), Zo = par(RE, re), Av = RE / (RE + re);
          return { stem: 'For the emitter follower ($\\beta = ' + b + '$, $r_o$ ignored), find the small-signal quantities with no load and an ideal source.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_E$', rv(RE)], ['$\\beta$', String(b)]],
            parts: [{ q: '(a) Find $r_e$.', answers: [A('$r_e$', re, 'Ω')], working: st(dc) + fin('r_e = ' + te(re, 'Ω')) },
              { q: '(b) Find $Z_i$, $Z_o$ and $A_v$.', answers: [A('$Z_i$', Zi, 'Ω'), A('$Z_o$', Zo, 'Ω'), A('$A_v$', Av, '', { tol: 0.005 })], working: st(['$Z_b \\cong \\beta(r_e + R_E) = ' + te(Zb, 'Ω', 4) + '$, $Z_i = R_B\\parallel Z_b = ' + te(Zi, 'Ω', 4) + '$', '$Z_o = R_E\\parallel r_e = ' + te(Zo, 'Ω', 4) + '$', '$A_v = \\dfrac{R_E}{R_E + r_e} = ' + tn(Av, 4) + '$ ' + phase(false)]) + fin('Z_i = ' + te(Zi, 'Ω') + ',\\ Z_o = ' + te(Zo, 'Ω') + ',\\ A_v = ' + tn(Av, 4)) }],
            data: { v: v, VCC: VCC, RB: RB, RE: RE, b: b } };
        }
        var REL = par(RE, RL), ZbL = b * (re + REL), ZiL = par(RB, ZbL), Rsp = par(Rs, RB), ZoS = par(RE, re + Rsp / b), AvL = REL / (REL + re), Avs = ZiL / (ZiL + Rs) * AvL, Ai = AvL * ZiL / RL;
        return { stem: 'The emitter follower ($\\beta = ' + b + '$) is driven from a source with $R_s = ' + rv(Rs).replace(' ', '\\,') + '$ and drives $R_L = ' + rv(RL).replace(' ', '\\,') + '$ through a coupling capacitor.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_E$', rv(RE)], ['$R_s$', rv(Rs)], ['$R_L$', rv(RL)], ['$\\beta$', String(b)]],
          parts: [{ q: '(a) Find $r_e$ and the loaded input impedance $Z_i$.', answers: [A('$r_e$', re, 'Ω'), A('$Z_i$', ZiL, 'Ω')], working: st(dc.concat(['$R_L$ sits in parallel with $R_E$ in the emitter: $R_E\\parallel R_L = ' + te(REL, 'Ω', 4) + '$.', '$Z_b \\cong \\beta(r_e + R_E\\parallel R_L) = ' + te(ZbL, 'Ω', 4) + '$, $Z_i = R_B\\parallel Z_b = ' + te(ZiL, 'Ω', 4) + '$ (it depends on $R_L$).'])) + fin('Z_i = ' + te(ZiL, 'Ω')) },
            { q: '(b) Find $Z_o$ seen by the load, including $R_s$.', answers: [A('$Z_o$', ZoS, 'Ω')], working: st(['Set $v_s = 0$. From the base the source side is $R_s\' = R_s\\parallel R_B = ' + te(Rsp, 'Ω', 4) + '$; from the emitter it looks β times smaller.', '$Z_o = R_E\\parallel\\left(r_e + \\dfrac{R_s\'}{\\beta}\\right) = ' + tn(RE) + '\\parallel(' + tn(re, 4) + ' + ' + tn(Rsp / b, 4) + ') = ' + te(ZoS, 'Ω', 4) + '$']) + fin('Z_o = ' + te(ZoS, 'Ω')) },
            { q: '(c) Find $A_{v_L}$, $A_{v_s}$ and the current gain $A_i = A_{v_L}Z_i/R_L$ (magnitude).', answers: [A('$A_{v_L}$', AvL, '', { tol: 0.005 }), A('$A_{v_s}$', Avs, '', { tol: 0.01 }), A('$|A_i|$', Ai, '')], working: st(['$A_{v_L} = \\dfrac{R_E\\parallel R_L}{R_E\\parallel R_L + r_e} = ' + tn(AvL, 4) + '$ ' + phase(false), '$A_{v_s} = \\dfrac{Z_i}{Z_i + R_s}A_{v_L} = ' + tn(ZiL / (ZiL + Rs), 4) + '\\times' + tn(AvL, 4) + ' = ' + tn(Avs, 4) + '$', '$|A_i| = A_{v_L}Z_i/R_L = ' + tn(Ai, 4) + '$: no voltage gain but a large current gain, which is what a buffer is for.']) + fin('A_{v_L} = ' + tn(AvL, 4) + ',\\ A_{v_s} = ' + tn(Avs, 4) + ',\\ |A_i| = ' + tn(Ai, 3)) }],
          notes: QB.callout('trap', 'For a follower $Z_i$ depends on $R_L$ and $Z_o$ depends on $R_s$: the slide formula $R_E\\parallel r_e$ assumes an ideal source.'),
          data: { v: v, VCC: VCC, RB: RB, RE: RE, b: b, Rs: Rs, RL: RL } };
      });
    }
  });

  /* ---------------------------------------------------------------- ss2: common base AC */
  QB.add({
    id: 'edc.bjt.ss2.cb', course: 'edc', module: 'bjt', topic: 'ss2',
    title: 'Common-base amplifier: Z_i, A_v and the source divider', difficulty: 2, marks: 6,
    variants: [{ id: 'noload', label: 'No load, ideal source' }, { id: 'loaded', label: 'With R_s and R_L' }],
    tags: ['Week 5 slide 43', 'WS6 Q7', 'EX2 Q6(b)'],
    gen: function (r, v) {
      return r.retry(function () {
        var VEE = r.pick([2, 3, 4, 5, 6]), VCC = r.pick([8, 10, 12, 15]), RE = r.eseries('E12', 0.47e3, 2.2e3), RC = r.eseries('E12', 1e3, 6.8e3), al = r.pick([0.98, 0.99, 0.995]);
        var IE = (VEE - 0.7) / RE, IC = al * IE, VCB = VCC - IC * RC;
        if (VCB < 1) return null;
        var re = reOf(IE), Zi = par(RE, re);
        var Rs = v === 'loaded' ? r.pick([10, 20, 50, 100]) : 0, RL = v === 'loaded' ? r.eseries('E12', 2.2e3, 22e3) : Infinity;
        var Rld = isFinite(RL) ? par(RC, RL) : RC, Av = al * Rld / re, Avs = Zi / (Zi + Rs) * Av;
        var fig = tmpl('bjtCommonBase', { VCC: V(VCC), VEE: '−' + V(VEE), RC: rv(RC), RE: rv(RE), alpha: al, C1: true, C2: true, vi: v !== 'loaded', vs: v === 'loaded', Rs: v === 'loaded' ? rv(Rs) : false, RL: v === 'loaded' ? rv(RL) : false, vo: true });
        var parts = [{ q: '(a) Find $I_E$ and $r_e$.', answers: [A('$I_E$', IE, 'A'), A('$r_e$', re, 'Ω')], working: st(['Base at 0 V, so $V_E = -0.7$ V: $I_E = \\dfrac{' + VEE + ' - 0.7}{' + tn(RE) + '} = ' + te(IE, 'A', 4) + '$', '$V_{CB} = V_{CC} - \\alpha I_ER_C = ' + te(VCB, 'V', 3) + '$ > 0: active ✓', '$r_e = 26\\text{ mV}/I_E = ' + te(re, 'Ω', 4) + '$']) + fin('r_e = ' + te(re, 'Ω')) },
          { q: '(b) Find $Z_i$, $Z_o$ and ' + (v === 'loaded' ? '$A_{v_L}$' : '$A_v$') + '.', answers: [A('$Z_i$', Zi, 'Ω'), A('$Z_o$', RC, 'Ω'), A(v === 'loaded' ? '$A_{v_L}$' : '$A_v$', Av, '')], working: st(['$Z_i = R_E\\parallel r_e = ' + te(Zi, 'Ω', 4) + '$ (only tens of ohms)', '$Z_o = R_C = ' + te(RC, 'Ω') + '$', '$A_v = \\dfrac{\\alpha(' + (isFinite(RL) ? 'R_C\\parallel R_L' : 'R_C') + ')}{r_e} = \\dfrac{' + al + '\\times' + tn(Rld, 4) + '}{' + tn(re, 4) + '} = ' + tn(Av, 4) + '$ ' + phase(false)]) + fin('Z_i = ' + te(Zi, 'Ω') + ',\\ A_v = ' + tn(Av, 4)) }];
        if (v === 'loaded') parts.push({ q: '(c) Find the overall gain $A_{v_s} = v_o/v_s$.', answers: [A('$A_{v_s}$', Avs, '')], working: st(['$A_{v_s} = \\dfrac{Z_i}{Z_i + R_s}A_{v_L} = \\dfrac{' + tn(Zi, 4) + '}{' + tn(Zi + Rs, 4) + '}\\times' + tn(Av, 4) + '$', 'The tiny $Z_i$ means even ' + Rs + ' Ω of source resistance throws away ' + tn(Rs / (Zi + Rs) * 100, 3) + ' % of the signal.']) + fin('A_{v_s} = ' + tn(Avs, 4)) });
        return { stem: 'An npn common-base stage has its base grounded, the emitter through $R_E$ to $-' + VEE + '$ V and the collector through $R_C$ to $+' + VCC + '$ V; $\\alpha = ' + al + '$.' + (v === 'loaded' ? ' The source has $R_s = ' + Rs + '\\ \\Omega$ and the load is $R_L = ' + rv(RL).replace(' ', '\\,') + '$.' : ''), figure: fig, given: [['$V_{EE}$', '−' + V(VEE)], ['$V_{CC}$', V(VCC)], ['$R_E$', rv(RE)], ['$R_C$', rv(RC)], ['$\\alpha$', String(al)]].concat(v === 'loaded' ? [['$R_s$', rv(Rs)], ['$R_L$', rv(RL)]] : []), parts: parts,
          notes: QB.callout('trap', 'CB does not invert: no minus sign on $A_v$.'),
          data: { v: v, VEE: VEE, VCC: VCC, RE: RE, RC: RC, al: al, Rs: Rs, RL: isFinite(RL) ? RL : 0 } };
      });
    }
  });

  /* ---------------------------------------------------------------- ss2: collector feedback AC */
  QB.add({
    id: 'edc.bjt.ss2.cfb', course: 'edc', module: 'bjt', topic: 'ss2',
    title: 'Collector-feedback amplifier (Miller view)', difficulty: 3, marks: 8,
    variants: [{ id: 'noload', label: 'No load' }, { id: 'loaded', label: 'With R_L (Z_i changes)' }],
    tags: ['WS6 Q8', 'Week 5 slide 44', 'EX2 Q6(a)'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15]), RF = r.eseries('E12', 100e3, 470e3), RC = r.eseries('E12', 1.5e3, 6.8e3), b = r.int(80, 200);
        var IB = (VCC - 0.7) / (RF + (b + 1) * RC), IE = (b + 1) * IB, VCE = VCC - IE * RC;
        if (VCE < 1.5) return null;
        var re = reOf(IE), RCF = par(RC, RF);
        var Zi = re / (1 / b + RC / (RC + RF)), Av = -RCF / re;
        var RL = v === 'loaded' ? r.eseries('E12', 2.2e3, 22e3) : 0, AvL = RL ? -par(RC, RF, RL) / re : Av, ZiL = RL ? par(b * re, RF / (1 - AvL)) : Zi;
        var fig = tmpl('bjtCollectorFeedback', { VCC: V(VCC), RF: rv(RF), RC: rv(RC), beta: b, C1: true, C2: true, vi: true, vo: true, RL: RL ? rv(RL) : false });
        var parts = [{ q: '(a) Find $I_E$ and $r_e$.', answers: [A('$I_E$', IE, 'A'), A('$r_e$', re, 'Ω')], working: st(['DC: $I_B = \\dfrac{V_{CC} - 0.7}{R_F + (\\beta+1)R_C} = ' + te(IB, 'A', 4) + '$ ($R_C$ carries $I_E$), $I_E = ' + te(IE, 'A', 4) + '$, $V_{CE} = ' + te(VCE, 'V', 3) + '$ (active).', '$r_e = 26\\text{ mV}/I_E = ' + te(re, 'Ω', 4) + '$']) + fin('r_e = ' + te(re, 'Ω')) },
          { q: '(b) Find $Z_o$, $A_v$ and $Z_i$ (no load).', answers: [A('$Z_o$', RCF, 'Ω'), A('$A_v$', Av, ''), A('$Z_i$', Zi, 'Ω')], working: st(['$Z_o \\cong R_C\\parallel R_F = ' + te(RCF, 'Ω', 4) + '$', '$A_v = -\\dfrac{R_C\\parallel R_F}{r_e} = ' + tn(Av, 4) + '$ ' + phase(true), '$Z_i = \\dfrac{r_e}{\\frac{1}{\\beta} + \\frac{R_C}{R_C+R_F}} = \\dfrac{' + tn(re, 4) + '}{' + tn(1 / b, 4) + ' + ' + tn(RC / (RC + RF), 4) + '} = ' + te(Zi, 'Ω', 4) + '$', 'Miller check: $\\beta r_e\\parallel\\dfrac{R_F}{1 - A_v} = ' + tn(b * re, 4) + '\\parallel' + tn(RF / (1 - Av), 4) + ' = ' + te(par(b * re, RF / (1 - Av)), 'Ω', 4) + '$ ✓']) + fin('Z_o = ' + te(RCF, 'Ω') + ',\\ A_v = ' + tn(Av, 4) + ',\\ Z_i = ' + te(Zi, 'Ω')) }];
        if (RL) parts.push({ q: '(c) With $R_L = ' + rv(RL).replace(' ', '\\,') + '$ coupled to the collector, find $A_{v_L}$ and the new $Z_i$.', answers: [A('$A_{v_L}$', AvL, ''), A('$Z_i$', ZiL, 'Ω')], working: st(['$A_{v_L} = -\\dfrac{R_C\\parallel R_F\\parallel R_L}{r_e} = ' + tn(AvL, 4) + '$', 'Miller with the loaded gain: $Z_i = \\beta r_e\\parallel\\dfrac{R_F}{1 - A_{v_L}} = ' + tn(b * re, 4) + '\\parallel' + tn(RF / (1 - AvL), 4) + ' = ' + te(ZiL, 'Ω', 4) + '$ (it rose because the gain fell).']) + fin('A_{v_L} = ' + tn(AvL, 4) + ',\\ Z_i = ' + te(ZiL, 'Ω')) });
        return { stem: 'An npn collector-feedback stage (emitter grounded, $\\beta = ' + b + '$, $r_o$ ignored) has $R_F$ from collector to base.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_F$', rv(RF)], ['$R_C$', rv(RC)], ['$\\beta$', String(b)]].concat(RL ? [['$R_L$', rv(RL)]] : []), parts: parts,
          notes: QB.callout('trap', '$Z_i$ depends on the gain, so it depends on $R_L$. The WS6 solution drops the $R_F/(R_C+R_F)$ factor in $A_v$.'),
          data: { v: v, VCC: VCC, RF: RF, RC: RC, b: b, RL: RL } };
      });
    }
  });

  /* ---------------------------------------------------------------- ss2: loading with Rs and RL */
  QB.add({
    id: 'edc.bjt.ss2.loading', course: 'edc', module: 'bjt', topic: 'ss2',
    title: 'Loading: A_vNL, A_vL, A_vs and A_i (two-port)', difficulty: 2, marks: 8,
    variants: [{ id: 'fixed', label: 'CE fixed bias' }, { id: 'vdb', label: 'CE voltage divider, bypassed' }, { id: 'unbyp', label: 'CE emitter bias, unbypassed' }],
    tags: ['Week 5 slides 46–52', 'EX1 Q3(c)', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([10, 12, 15, 18, 20]), b = r.int(80, 220), RC = r.eseries('E12', 1.5e3, 6.8e3), Rs = r.pick([300, 600, 1e3, 2.2e3]), RL = r.eseries('E12', 1e3, 10e3);
        var IE, Zi, AvNL, o = { VCC: V(VCC), RC: rv(RC), beta: b, C1: true, C2: true, Rs: rv(Rs), vs: true, RL: rv(RL), vo: true }, dcw, d = { v: v, VCC: VCC, b: b, RC: RC, Rs: Rs, RL: RL }, fig, re, zw;
        if (v === 'fixed') {
          var RB = r.eseries('E12', 220e3, 1.2e6), s = bjtActive(VCC, RB, RC, 0, VCC, b); if (s.VCE < 1.5) return null;
          IE = s.IE; re = reOf(IE); Zi = par(RB, b * re); AvNL = -RC / re; o.RB = rv(RB); fig = tmpl('bjtFixedBias', o); d.RB = RB;
          dcw = ['DC: $I_B = (V_{CC} - 0.7)/R_B = ' + te(s.IB, 'A', 4) + '$, $I_E = ' + te(IE, 'A', 4) + '$, $r_e = ' + te(re, 'Ω', 4) + '$.'];
          zw = '$Z_i = R_B\\parallel\\beta r_e = ' + te(Zi, 'Ω', 4) + '$, $Z_o = R_C$, $A_{v_{NL}} = -R_C/r_e = ' + tn(AvNL, 4) + '$';
        } else if (v === 'vdb') {
          var R1 = r.eseries('E12', 22e3, 82e3), R2 = r.eseries('E12', 4.7e3, 22e3), RE = r.eseries('E12', 0.47e3, 2.2e3), dc = vdbDC(VCC, R1, R2, RC, RE, b); if (dc.VCE < 1.5 || dc.VTh < 1.2) return null;
          IE = dc.IE; re = reOf(IE); Zi = par(R1, R2, b * re); AvNL = -RC / re; o.R1 = rv(R1); o.R2 = rv(R2); o.RE = rv(RE); o.CE = true; fig = tmpl('bjtVDB', o); d.R1 = R1; d.R2 = R2; d.RE = RE;
          dcw = dc.w.concat(['$r_e = ' + te(re, 'Ω', 4) + '$.']);
          zw = '$Z_i = R_1\\parallel R_2\\parallel\\beta r_e = ' + te(Zi, 'Ω', 4) + '$, $Z_o = R_C$, $A_{v_{NL}} = -R_C/r_e = ' + tn(AvNL, 4) + '$';
        } else {
          var RB2 = r.eseries('E12', 220e3, 1e6), RE2 = r.eseries('E12', 0.33e3, 1.2e3), s2 = bjtActive(VCC, RB2, RC, RE2, VCC, b); if (s2.VCE < 1.5) return null;
          IE = s2.IE; re = reOf(IE); Zi = par(RB2, b * (re + RE2)); AvNL = -RC / (re + RE2); o.RB = rv(RB2); o.RE = rv(RE2); fig = tmpl('bjtEmitterBias', o); d.RB = RB2; d.RE = RE2;
          dcw = ['DC: $I_B = \\dfrac{V_{CC} - 0.7}{R_B + (\\beta+1)R_E} = ' + te(s2.IB, 'A', 4) + '$, $I_E = ' + te(IE, 'A', 4) + '$, $r_e = ' + te(re, 'Ω', 4) + '$.'];
          zw = '$Z_i = R_B\\parallel\\beta(r_e + R_E) = ' + te(Zi, 'Ω', 4) + '$, $Z_o = R_C$, $A_{v_{NL}} = -R_C/(r_e + R_E) = ' + tn(AvNL, 4) + '$';
        }
        var AvL = AvNL * RL / (RL + RC), Avs = Zi / (Zi + Rs) * AvL, Ai = -AvL * Zi / RL;
        return { stem: 'The CE amplifier shown ($\\beta = ' + b + '$, $r_o$ ignored) is driven from $R_s = ' + rv(Rs).replace(' ', '\\,') + '$ and loaded by $R_L = ' + rv(RL).replace(' ', '\\,') + '$.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_C$', rv(RC)], ['$R_s$', rv(Rs)], ['$R_L$', rv(RL)], ['$\\beta$', String(b)]],
          parts: [{ q: '(a) Find $Z_i$, $Z_o$ and the no-load gain $A_{v_{NL}}$.', answers: [A('$Z_i$', Zi, 'Ω'), A('$Z_o$', RC, 'Ω'), A('$A_{v_{NL}}$', AvNL, '')], working: st(dcw.concat([zw])) + fin('Z_i = ' + te(Zi, 'Ω') + ',\\ Z_o = ' + te(RC, 'Ω') + ',\\ A_{v_{NL}} = ' + tn(AvNL, 4)) },
            { q: '(b) Find $A_{v_L}$, $A_{v_s}$ and $A_i = -A_{v_L}Z_i/R_L$.', answers: [A('$A_{v_L}$', AvL, ''), A('$A_{v_s}$', Avs, ''), A('$A_i$', Ai, '')], working: st(['Two-port (exact here, since $Z_i$ does not depend on $R_L$): $A_{v_L} = A_{v_{NL}}\\dfrac{R_L}{R_L + Z_o} = ' + tn(AvNL, 4) + '\\times' + tn(RL / (RL + RC), 4) + ' = ' + tn(AvL, 4) + '$ (same as replacing $R_C$ by $R_C\\parallel R_L$).', '$A_{v_s} = \\dfrac{Z_i}{Z_i + R_s}A_{v_L} = ' + tn(Zi / (Zi + Rs), 4) + '\\times' + tn(AvL, 4) + ' = ' + tn(Avs, 4) + '$', '$A_i = -A_{v_L}Z_i/R_L = ' + tn(Ai, 4) + '$', 'Check: $|A_{v_s}| < |A_{v_L}| < |A_{v_{NL}}|$ ✓.']) + fin('A_{v_L} = ' + tn(AvL, 4) + ',\\ A_{v_s} = ' + tn(Avs, 4) + ',\\ A_i = ' + tn(Ai, 4)) }],
          data: d };
      });
    }
  });

  /* ---------------------------------------------------------------- multi: RC-coupled cascade */
  QB.add({
    id: 'edc.bjt.multi.cascade', course: 'edc', module: 'bjt', topic: 'multi',
    title: 'Two-stage RC-coupled amplifier', difficulty: 3, marks: 10,
    variants: [{ id: 'bothbyp', label: 'Both stages bypassed' }, { id: 'unbyp2', label: 'Stage 2 unbypassed (Prac 4 Fig. 1)' }, { id: 'twoport', label: 'Two-port numbers given' }],
    tags: ['Week 5 slides 63–65', 'Prac 4', 'exam-style'],
    gen: function (r, v) {
      return r.retry(function () {
        if (v === 'twoport') {
          var A1 = -r.int(20, 300), Zi1 = r.eseries('E12', 1e3, 22e3), Zo1 = r.eseries('E12', 1e3, 10e3), A2 = r.bool() ? -r.int(5, 200) : r.float(0.9, 0.99, 2), Zi2 = r.eseries('E12', 1e3, 47e3), Zo2 = A2 > 0 ? r.pick([10, 20, 50, 100]) : r.eseries('E12', 1e3, 6.8e3), Rs = r.pick([600, 1e3, 2.2e3, 10e3]), RL = r.eseries('E12', 0.47e3, 10e3), vs = r.pick([1, 2, 5, 10]) * 1e-3;
          var k1 = Zi1 / (Zi1 + Rs), k2 = Zi2 / (Zi2 + Zo1), k3 = RL / (RL + Zo2), Avs = k1 * A1 * k2 * A2 * k3, vo = Avs * vs;
          return { stem: 'Two amplifier stages are cascaded. Stage 1: $A_{v_{NL1}} = ' + A1 + '$, $Z_{i1} = ' + rv(Zi1).replace(' ', '\\,') + '$, $Z_{o1} = ' + rv(Zo1).replace(' ', '\\,') + '$. Stage 2: $A_{v_{NL2}} = ' + A2 + '$, $Z_{i2} = ' + rv(Zi2).replace(' ', '\\,') + '$, $Z_{o2} = ' + rv(Zo2).replace(' ', '\\,') + '$. The source has $R_s = ' + rv(Rs).replace(' ', '\\,') + '$ and the load is $R_L = ' + rv(RL).replace(' ', '\\,') + '$.', figure: null, given: [['$A_{v_{NL1}}$, $Z_{i1}$, $Z_{o1}$', A1 + ', ' + rv(Zi1) + ', ' + rv(Zo1)], ['$A_{v_{NL2}}$, $Z_{i2}$, $Z_{o2}$', A2 + ', ' + rv(Zi2) + ', ' + rv(Zo2)], ['$R_s$, $R_L$', rv(Rs) + ', ' + rv(RL)]],
            parts: [{ q: '(a) Find the three divider factors and the overall gain $A_{v_s} = v_o/v_s$.', answers: [A('input divider', k1, ''), A('interstage divider', k2, ''), A('output divider', k3, ''), A('$A_{v_s}$', Avs, '')], working: st(['Input: $\\dfrac{Z_{i1}}{Z_{i1} + R_s} = ' + tn(k1, 4) + '$', 'Between stages: $\\dfrac{Z_{i2}}{Z_{i2} + Z_{o1}} = ' + tn(k2, 4) + '$', 'Output: $\\dfrac{R_L}{R_L + Z_{o2}} = ' + tn(k3, 4) + '$', '$A_{v_s} = ' + tn(k1, 4) + '(' + A1 + ')(' + tn(k2, 4) + ')(' + A2 + ')(' + tn(k3, 4) + ') = ' + tn(Avs, 4) + '$']) + fin('A_{v_s} = ' + tn(Avs, 4)) },
              { q: '(b) Find $v_o$ for $v_s = ' + (vs * 1000) + '$ mV peak.', answers: [A('$v_o$', vo, 'V')], working: st(['$v_o = A_{v_s}v_s = ' + tn(Avs, 4) + '\\times' + tn(vs) + '$']) + fin('v_o = ' + te(vo, 'V')) }],
            notes: QB.callout('trap', 'Multiplying the no-load gains ignores both interface dividers.'),
            data: { v: v, A1: A1, Zi1: Zi1, Zo1: Zo1, A2: A2, Zi2: Zi2, Zo2: Zo2, Rs: Rs, RL: RL, vs: vs } };
        }
        var VCC = r.pick([12, 15, 18, 20]), b = r.int(100, 250), R1 = r.eseries('E12', 10e3, 47e3), R2 = r.eseries('E12', 2.2e3, 10e3), RC = r.eseries('E12', 1e3, 4.7e3), RE = r.eseries('E12', 0.47e3, 1.5e3);
        var same = r.bool(0.6), R3 = same ? R1 : r.eseries('E12', 10e3, 47e3), R4 = same ? R2 : r.eseries('E12', 2.2e3, 10e3), RC2 = same ? RC : r.eseries('E12', 1e3, 4.7e3), RE2 = same ? RE : r.eseries('E12', 0.47e3, 1.5e3);
        var RL = r.bool(0.7) ? r.eseries('E12', 2.2e3, 10e3) : 0, vi = r.pick([10, 20, 25, 50, 100]) * 1e-6;
        var d1 = vdbDC(VCC, R1, R2, RC, RE, b), d2 = vdbDC(VCC, R3, R4, RC2, RE2, b);
        if (d1.VCE < 1.5 || d2.VCE < 1.5 || d1.VTh < 1.2 || d2.VTh < 1.2) return null;
        var re1 = reOf(d1.IE), re2 = reOf(d2.IE), byp2 = v === 'bothbyp';
        var Zb2 = byp2 ? b * re2 : b * (re2 + RE2), Zi2 = par(R3, R4, Zb2), Zi1 = par(R1, R2, b * re1);
        var A1 = -par(RC, Zi2) / re1, RL2 = RL ? par(RC2, RL) : RC2, A2 = -RL2 / (byp2 ? re2 : re2 + RE2), AT = A1 * A2, vo = AT * vi;
        if (Math.abs(vo) > 0.8 * Math.min(d2.VCE, VCC - d2.VCE)) vi = vi / 10;
        vo = AT * vi;
        var fig = tmpl('bjtTwoStageRC', { VCC: V(VCC), R1: rv(R1), R2: rv(R2), RC: rv(RC), RE: rv(RE), CE: true, beta: b, R3: rv(R3), R4: rv(R4), RC2: rv(RC2), RE2: rv(RE2), CE2: byp2, C1: true, vi: true, RL: RL ? rv(RL) : false, vo: true });
        var w1 = ['Stage 1: '].concat(d1.w).concat(['$r_{e1} = ' + te(re1, 'Ω', 4) + '$.']).join(' ');
        var w2 = (same ? 'Stage 2 is identical at DC: ' : 'Stage 2: ') + d2.w.join(' ') + ' $r_{e2} = ' + te(re2, 'Ω', 4) + '$.';
        return { stem: 'Two voltage-divider CE stages are RC coupled (β = ' + b + ' for both, $r_o$ ignored). Stage 1 has its emitter bypassed; stage 2 is ' + (byp2 ? 'also bypassed' : '<b>not</b> bypassed') + '. ' + (RL ? 'A load $R_L = ' + rv(RL).replace(' ', '\\,') + '$ is coupled to the output.' : 'There is no load.') + ' The input is $v_i = ' + te(vi, 'V') + '$ peak.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['Stage 1', rv(R1) + ', ' + rv(R2) + ', ' + rv(RC) + ', ' + rv(RE)], ['Stage 2', rv(R3) + ', ' + rv(R4) + ', ' + rv(RC2) + ', ' + rv(RE2)], ['$\\beta$', String(b)]].concat(RL ? [['$R_L$', rv(RL)]] : []),
          parts: [{ q: '(a) DC: find $r_{e1}$ and $r_{e2}$.', answers: [A('$r_{e1}$', re1, 'Ω'), A('$r_{e2}$', re2, 'Ω')], working: st([w1, w2, 'The coupling capacitor blocks DC, so each stage is biased on its own.']) + fin('r_{e1} = ' + te(re1, 'Ω') + ',\\ r_{e2} = ' + te(re2, 'Ω')) },
            { q: '(b) Find $Z_{i2}$ and the loaded gain of stage 1.', answers: [A('$Z_{i2}$', Zi2, 'Ω'), A('$A_{v1}$', A1, '')], working: st(['Stage 2 loads stage 1: $Z_{i2} = R_3\\parallel R_4\\parallel ' + (byp2 ? '\\beta r_{e2}' : '\\beta(r_{e2} + R_{E2})') + ' = ' + tn(R3) + '\\parallel' + tn(R4) + '\\parallel' + tn(Zb2, 4) + ' = ' + te(Zi2, 'Ω', 4) + '$', '$A_{v1} = -\\dfrac{R_{C1}\\parallel Z_{i2}}{r_{e1}} = -\\dfrac{' + tn(par(RC, Zi2), 4) + '}{' + tn(re1, 4) + '} = ' + tn(A1, 4) + '$']) + fin('Z_{i2} = ' + te(Zi2, 'Ω') + ',\\ A_{v1} = ' + tn(A1, 4)) },
            { q: '(c) Find $A_{v2}$, the overall gain $A_{vT}$, $v_o$ and $Z_{i1}$.', answers: [A('$A_{v2}$', A2, ''), A('$A_{vT}$', AT, ''), A('$v_o$', vo, 'V'), A('$Z_{i1}$', Zi1, 'Ω')], working: st(['$A_{v2} = -\\dfrac{' + (RL ? 'R_{C2}\\parallel R_L' : 'R_{C2}') + '}{' + (byp2 ? 'r_{e2}' : 'r_{e2} + R_{E2}') + '} = -\\dfrac{' + tn(RL2, 4) + '}{' + tn(byp2 ? re2 : re2 + RE2, 4) + '} = ' + tn(A2, 4) + '$', '$A_{vT} = A_{v1}A_{v2} = (' + tn(A1, 4) + ')(' + tn(A2, 4) + ') = ' + tn(AT, 4) + '$ (two inversions: in phase)', '$v_o = A_{vT}v_i = ' + te(vo, 'V', 3) + '$ peak; check it is well inside the supply.', '$Z_{i1} = R_1\\parallel R_2\\parallel\\beta r_{e1} = ' + te(Zi1, 'Ω', 4) + '$; $Z_o = R_{C2} = ' + te(RC2, 'Ω') + '$.']) + fin('A_{vT} = ' + tn(AT, 4) + ',\\ v_o = ' + te(vo, 'V')) }],
          notes: QB.callout('trap', 'Load stage 1 with $Z_{i2}$; multiplying no-load gains overestimates the total several times.'),
          data: { v: v, VCC: VCC, b: b, R1: R1, R2: R2, RC: RC, RE: RE, R3: R3, R4: R4, RC2: RC2, RE2: RE2, RL: RL, vi: vi } };
      });
    }
  });

  /* ---------------------------------------------------------------- multi: Darlington */
  QB.add({
    id: 'edc.bjt.multi.darlington', course: 'edc', module: 'bjt', topic: 'multi',
    title: 'Darlington emitter follower', difficulty: 2, marks: 6,
    variants: [{ id: 'betas', label: 'β1 and β2 given (V_BE = 1.4 V)' }, { id: 'betaD', label: 'β_D given (V_BE = 1.6 V)' }],
    tags: ['Week 5 slides 66–74'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([12, 15, 18, 20]), RB = r.eseries('E12', 1e6, 4.7e6), RE = r.eseries('E12', 100, 1e3), b1 = 0, b2 = 0, bD, VBE;
        if (v === 'betas') { b1 = r.int(50, 150); b2 = r.int(50, 150); bD = b1 * b2; VBE = 1.4; } else { bD = r.pick([2000, 4000, 5000, 6000, 8000]); VBE = 1.6; }
        var IB = (VCC - VBE) / (RB + bD * RE), IE = bD * IB, VE = IE * RE, VCE = VCC - VE;
        if (VCE < 2 || VCE > VCC - 2) return null;
        var Zi = par(RB, bD * RE), Ai = bD * RB / (RB + bD * RE);
        var fig = tmpl('darlington', { VCC: V(VCC), RB: rv(RB), RE: rv(RE), beta1: v === 'betas' ? 'β_1 = ' + b1 : 'β_D = ' + bD, beta2: v === 'betas' ? 'β_2 = ' + b2 : null, C1: true, C2: true, vi: true, vo: true, box: true });
        return { stem: 'A Darlington emitter follower has $R_B = ' + rv(RB).replace(' ', '\\,') + '$ from $V_{CC} = ' + VCC + '$ V and $R_E = ' + rv(RE).replace(' ', '\\,') + '$. ' + (v === 'betas' ? '$\\beta_1 = ' + b1 + '$, $\\beta_2 = ' + b2 + '$, 0.7 V per junction.' : '$\\beta_D = ' + bD + '$ and $V_{BE_D} = 1.6$ V (datasheet).'), figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_B$', rv(RB)], ['$R_E$', rv(RE)]].concat(v === 'betas' ? [['$\\beta_1$, $\\beta_2$', b1 + ', ' + b2]] : [['$\\beta_D$', String(bD)]]),
          parts: [{ q: '(a) Find $I_B$, $I_E$, $V_E$ and $V_{CE}$.', answers: [A('$I_B$', IB, 'A'), A('$I_E$', IE, 'A'), A('$V_E$', VE, 'V'), A('$V_{CE}$', VCE, 'V')], working: st([(v === 'betas' ? '$\\beta_D = \\beta_1\\beta_2 = ' + bD + '$, and two junctions in series: $V_{BE_D} = 1.4$ V.' : '$\\beta_D = ' + bD + '$, $V_{BE_D} = 1.6$ V.'), '$I_B = \\dfrac{V_{CC} - V_{BE_D}}{R_B + \\beta_DR_E} = \\dfrac{' + tn(VCC - VBE, 3) + '}{' + tn(RB) + ' + ' + bD + '\\times' + tn(RE) + '} = ' + te(IB, 'A', 4) + '$', '$I_E \\approx \\beta_DI_B = ' + te(IE, 'A', 4) + '$, $V_E = I_ER_E = ' + te(VE, 'V', 4) + '$, $V_{CE} = V_{CC} - V_E = ' + te(VCE, 'V', 4) + '$']) + fin('I_E = ' + te(IE, 'A') + ',\\ V_E = ' + te(VE, 'V')) },
            { q: '(b) Find $Z_i$ and the current gain $A_i$ (take $A_v \\approx 1$).', answers: [A('$Z_i$', Zi, 'Ω'), A('$A_i$', Ai, '')], working: st(['$Z_i = R_B\\parallel\\beta_DR_E = ' + tn(RB) + '\\parallel' + tn(bD * RE, 4) + ' = ' + te(Zi, 'Ω', 4) + '$', '$A_i \\approx \\dfrac{\\beta_DR_B}{R_B + \\beta_DR_E} = ' + tn(Ai, 4) + '$', '$A_v \\approx 1$ (it is an emitter follower).']) + fin('Z_i = ' + te(Zi, 'Ω') + ',\\ A_i = ' + tn(Ai, 4)) }],
          notes: QB.callout('trap', 'Two $V_{BE}$ drops are in series, not one.'),
          data: { v: v, VCC: VCC, RB: RB, RE: RE, bD: bD, VBE: VBE } };
      });
    }
  });

  /* ---------------------------------------------------------------- multi: current mirror */
  function figMirror(o) {
    var d = drw(); if (!d) return null;
    var x1 = 120, x2 = 300, yT = 40, yCp = 160, gy = 250;
    var q1 = d.bjt({ at: [x1, yCp], anchor: 'collector', flipX: true, label: 'Q_1' });
    var q2 = d.bjt({ at: [x2, yCp], anchor: 'collector', label: 'Q_2' });
    d.line(q1.base, q2.base);
    var yj = yCp - 20; d.line([x1, yj], q1.collector); d.dot([x1, yj]);
    var xj = q1.base[0] + 18; d.line([x1, yj], [xj, yj], [xj, q1.base[1]]); d.dot([xj, q1.base[1]]);
    d.line(q1.emitter, [x1, gy]); d.line(q2.emitter, [x2, gy]); d.line([x1, gy], [x2, gy]); d.dot([x1 + 90, gy]);
    if (o.VEE) { d.line([x1 + 90, gy], [x1 + 90, gy + 15]); d.rail([x1 + 90, gy + 15], { label: '−V_{EE}', value: o.VEE, dir: 'down' }); } else d.ground([x1 + 90, gy]);
    d.line([x1, yT], [x2, yT]); d.dot([x1, yT]);
    d.line([(x1 + x2) / 2, yT], [(x1 + x2) / 2, yT - 18]);
    d.rail([(x1 + x2) / 2, yT - 18], { label: o.top === 'gnd' ? '0 V' : 'V_{CC}', value: o.VCC || null });
    d.resistor({ from: [x1, yT], to: [x1, yj], label: 'R', value: o.R || null, side: 'left' });
    d.resistor({ from: [x2, yT], to: [x2, yj], label: 'R_L', value: o.RL || null, side: 'right' }); d.line([x2, yj], q2.collector);
    d.current({ at: [x1, yT + 22], dir: 'down', label: 'I_{REF}', side: 'right', len: 16 });
    d.current({ at: [x2, yj + 8], dir: 'down', label: 'I_o', side: 'left', len: 16 });
    return svg(d, 'BJT current mirror');
  }
  QB.add({
    id: 'edc.bjt.multi.mirror', course: 'edc', module: 'bjt', topic: 'multi',
    title: 'BJT current mirror: I_o, design and compliance', difficulty: 2, marks: 5,
    variants: [{ id: 'analysis', label: 'Find I_REF and I_o' }, { id: 'design', label: 'Choose R for a target I_o' }, { id: 'compliance', label: 'Emitters on −V_EE: R, R_L,max and β change' }],
    tags: ['WS6 Q18–Q19', 'EX2 Q7'],
    gen: function (r, v) {
      return r.retry(function () {
        var b = r.pick([50, 80, 100, 150, 200]);
        if (v === 'compliance') {
          var VEE = r.pick([5, 6, 9, 10, 12]), Io = r.pick([0.5, 1, 1.5, 2, 3]) * 1e-3, b2 = r.pick([30, 40, 50]);
          var Iref = Io * (1 + 2 / b), VB = -VEE + 0.7, Rr = (0 - VB) / Iref, RLmax = (0 - (-VEE + 0.2)) / Io, Io2 = Iref / (1 + 2 / b2);
          return { stem: 'Two matched npn transistors ($\\beta = ' + b + '$) form a mirror with both emitters on $-' + VEE + '$ V. Q1 is diode-connected; $R$ runs from ground (0 V) to Q1\'s collector, and Q2\'s collector draws $I_o$ from ground through $R_L$.', figure: figMirror({ VEE: V(VEE), top: 'gnd' }), given: [['$-V_{EE}$', '−' + V(VEE)], ['$\\beta$', String(b)], ['target $I_o$', pe(Io, 'A')]],
            parts: [{ q: '(a) Find $R$ for $I_o = ' + te(Io, 'A') + '$.', answers: [A('$I_{REF}$', Iref, 'A', { sig: 4 }), A('$R$', Rr, 'Ω')], working: st(['KCL at Q1\'s collector: $I_{REF} = I_C + 2I_B = I_o(1 + 2/\\beta) = ' + te(Iref, 'A', 4) + '$', 'Q1\'s collector sits at $V_{B1} = -' + VEE + ' + 0.7 = ' + tn(VB, 3) + '$ V, so $R = \\dfrac{0 - (' + tn(VB, 3) + ')}{' + tn(Iref, 4) + '} = ' + te(Rr, 'Ω', 4) + '$']) + fin('R = ' + te(Rr, 'Ω')) },
              { q: '(b) Find the largest $R_L$ for which Q2 stays active ($V_{CE,sat} = 0.2$ V).', answers: [A('$R_{L,max}$', RLmax, 'Ω')], working: st(['Active while $V_{C2} \\ge V_{E2} + 0.2 = ' + tn(-VEE + 0.2, 3) + '$ V, and $V_{C2} = -I_oR_L$.', '$R_L \\le \\dfrac{' + tn(VEE - 0.2, 3) + '}{' + tn(Io) + '} = ' + te(RLmax, 'Ω', 4) + '$']) + fin('R_{L,max} = ' + te(RLmax, 'Ω')) },
              { q: '(c) Keeping $R$, the pair is replaced by one with $\\beta = ' + b2 + '$. Find the new $I_o$.', answers: [A('$I_o$', Io2, 'A', { sig: 4 })], working: st(['$I_{REF}$ is set by $R$ alone: still $' + te(Iref, 'A', 4) + '$.', '$I_o = I_{REF}/(1 + 2/\\beta) = ' + te(Io2, 'A', 4) + '$ (a ' + tn((Io - Io2) / Io * 100, 3) + ' % change).']) + fin('I_o = ' + te(Io2, 'A', 4)) }],
            notes: QB.callout('trap', 'Both base currents come out of $I_{REF}$: the factor is $2/\\beta$. Measure $R$\'s voltage from Q1\'s collector, not from the rail.'),
            data: { v: v, b: b, VEE: VEE, Io: Io, b2: b2 } };
        }
        var VCC = r.pick([5, 9, 10, 12, 15]);
        if (v === 'design') {
          var Io3 = r.pick([0.5, 1, 2, 2.5, 5]) * 1e-3, Iref3 = Io3 * (1 + 2 / b), R3 = (VCC - 0.7) / Iref3;
          return { stem: 'Design a basic two-transistor mirror on $V_{CC} = ' + VCC + '$ V (emitters grounded, $\\beta = ' + b + '$) to sink $I_o = ' + te(Io3, 'A') + '$.', figure: figMirror({ VCC: V(VCC) }), given: [['$V_{CC}$', V(VCC)], ['$\\beta$', String(b)], ['$I_o$', pe(Io3, 'A')]],
            parts: [{ q: '(a) Find $I_{REF}$ and $R$.', answers: [A('$I_{REF}$', Iref3, 'A', { sig: 4 }), A('$R$', R3, 'Ω')], working: st(['$I_{REF} = I_o(1 + 2/\\beta) = ' + tn(Io3) + '(1 + 2/' + b + ') = ' + te(Iref3, 'A', 4) + '$', 'Q1 is diode-connected: its collector is at 0.7 V. $R = (V_{CC} - 0.7)/I_{REF} = ' + te(R3, 'Ω', 4) + '$']) + fin('R = ' + te(R3, 'Ω')) }],
            data: { v: v, b: b, VCC: VCC, Io: Io3 } };
        }
        var R4 = r.eseries('E12', 1e3, 22e3), Iref4 = (VCC - 0.7) / R4, Io4 = Iref4 / (1 + 2 / b);
        var RL4 = r.eseries('E12', 0.47e3, 4.7e3), VCE2 = VCC - Io4 * RL4;
        if (VCE2 < 0.5) return null;
        return { stem: 'A basic BJT current mirror ($\\beta = ' + b + '$, emitters grounded) has $R = ' + rv(R4).replace(' ', '\\,') + '$ from $V_{CC} = ' + VCC + '$ V to the diode-connected Q1. Q2 drives $R_L = ' + rv(RL4).replace(' ', '\\,') + '$ from $V_{CC}$.', figure: figMirror({ VCC: V(VCC), R: rv(R4), RL: rv(RL4) }), given: [['$V_{CC}$', V(VCC)], ['$R$', rv(R4)], ['$R_L$', rv(RL4)], ['$\\beta$', String(b)]],
          parts: [{ q: '(a) Find $I_{REF}$, $I_o$ and $V_{CE2}$.', answers: [A('$I_{REF}$', Iref4, 'A', { sig: 4 }), A('$I_o$', Io4, 'A', { sig: 4 }), A('$V_{CE2}$', VCE2, 'V')], working: st(['$I_{REF} = (V_{CC} - 0.7)/R = ' + te(Iref4, 'A', 4) + '$', '$I_o = \\dfrac{I_{REF}}{1 + 2/\\beta} = ' + te(Io4, 'A', 4) + '$ (≈ $I_{REF}$ for large β)', '$V_{CE2} = V_{CC} - I_oR_L = ' + te(VCE2, 'V', 4) + '$ > 0.2 V, so Q2 is active and the mirror works ✓']) + fin('I_o = ' + te(Io4, 'A', 4)) }],
          data: { v: v, b: b, VCC: VCC, R: R4, RL: RL4 } };
      });
    }
  });

  /* ---------------------------------------------------------------- multi: direct coupled */
  QB.add({
    id: 'edc.bjt.multi.direct', course: 'edc', module: 'bjt', topic: 'multi',
    title: 'Direct-coupled two-stage DC levels', difficulty: 3, marks: 7,
    variants: [{ id: 'ignore', label: 'Neglect I_B2 (lecture method)' }, { id: 'include', label: 'Include I_B2 at the shared node' }],
    tags: ['Week 5 slides 84–88', 'WS6 Q16'],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([12, 14, 15, 18, 20]), b1 = r.pick([80, 100, 120, 150]), b2 = r.pick([50, 80, 100]), R1 = r.eseries('E12', 22e3, 68e3), R2 = r.eseries('E12', 4.7e3, 15e3), RC1 = r.eseries('E12', 2.2e3, 10e3), RE1 = r.eseries('E12', 1e3, 3.3e3), RE2 = r.eseries('E12', 0.47e3, 2.2e3);
        var VTh = VCC * R2 / (R1 + R2), RTh = par(R1, R2);
        if (VTh < 1.5) return null;
        var s1 = bjtActive(VTh, RTh, RC1, RE1, VCC, b1);
        var k = RC1 / ((b2 + 1) * RE2);
        var VB2 = v === 'ignore' ? VCC - s1.IC * RC1 : (VCC - RC1 * s1.IC + 0.7 * k) / (1 + k);
        var VE2 = VB2 - 0.7, IE2 = VE2 / RE2, VCE2 = VCC - VE2, VCE1 = VB2 - s1.VE, IB2 = IE2 / (b2 + 1);
        if (VCE1 < 1 || VE2 < 0.5 || VCE2 < 1) return null;
        var fig = figDirect({ VCC: V(VCC), R1: rv(R1), R2: rv(R2), RC1: rv(RC1), RE1: rv(RE1), RE2: rv(RE2), b1: 'β_1 = ' + b1, b2: 'β_2 = ' + b2 });
        var w2 = v === 'ignore' ? ['Neglect $I_{B2}$ (the lecture method): $V_{B2} = V_{C1} = V_{CC} - I_{C1}R_{C1} = ' + VCC + ' - ' + tn(s1.IC * RC1, 4) + ' = ' + te(VB2, 'V', 4) + '$'] : ['$R_{C1}$ carries $I_{C1} + I_{B2}$ with $I_{B2} = \\dfrac{V_{B2} - 0.7}{(\\beta_2+1)R_{E2}}$.', 'KCL: $\\dfrac{V_{CC} - V_{B2}}{R_{C1}} = I_{C1} + \\dfrac{V_{B2} - 0.7}{' + tn((b2 + 1) * RE2, 4) + '}$, so $V_{B2} = ' + te(VB2, 'V', 4) + '$ (with $I_{B2} = ' + te(IB2, 'A', 3) + '$).'];
        return { stem: 'Q1 (β = ' + b1 + ') is divider biased with $R_{C1}$ and $R_{E1}$. Its collector drives the base of Q2 (β = ' + b2 + ') directly; Q2 is an emitter follower with its collector at $V_{CC} = ' + VCC + '$ V and $R_{E2}$ to ground.', figure: fig, given: [['$V_{CC}$', V(VCC)], ['$R_1$, $R_2$', rv(R1) + ', ' + rv(R2)], ['$R_{C1}$, $R_{E1}$', rv(RC1) + ', ' + rv(RE1)], ['$R_{E2}$', rv(RE2)]],
          parts: [{ q: '(a) Solve stage 1: find $I_{C1}$.', answers: [A('$I_{C1}$', s1.IC, 'A')], working: st(['$E_{Th} = ' + te(VTh, 'V', 4) + '$, $R_{Th} = ' + te(RTh, 'Ω', 4) + '$.', '$I_{B1} = \\dfrac{E_{Th} - 0.7}{R_{Th} + (\\beta_1+1)R_{E1}} = ' + te(s1.IB, 'A', 4) + '$, $I_{C1} = ' + te(s1.IC, 'A', 4) + '$']) + fin('I_{C1} = ' + te(s1.IC, 'A')) },
            { q: '(b) Find $V_{B2}$, $I_{E2}$ and $V_{CE2}$, and check both transistors are active.', answers: [A('$V_{B2}$', VB2, 'V', { sig: 4 }), A('$I_{E2}$', IE2, 'A'), A('$V_{CE2}$', VCE2, 'V')], working: st(w2.concat(['$V_{E2} = V_{B2} - 0.7 = ' + te(VE2, 'V', 4) + '$, $I_{E2} = V_{E2}/R_{E2} = ' + te(IE2, 'A', 4) + '$, $V_{CE2} = V_{CC} - V_{E2} = ' + te(VCE2, 'V', 4) + '$', 'Q1: $V_{CE1} = V_{C1} - V_{E1} = ' + tn(VB2, 4) + ' - ' + tn(s1.VE, 4) + ' = ' + te(VCE1, 'V', 3) + '$ > 0.2 V ✓; Q2 active ✓.', 'Here $I_{B2}/I_{C1} = ' + tn(IB2 / s1.IC * 100, 3) + '\\%$' + (v === 'ignore' ? ': say that $I_{B2}$ was neglected.' : '.')])) + fin('V_{B2} = ' + te(VB2, 'V', 4) + ',\\ I_{E2} = ' + te(IE2, 'A') + ',\\ V_{CE2} = ' + te(VCE2, 'V')) }],
          notes: QB.callout('trap', 'Stage 1\'s dc levels are stage 2\'s bias: any drift in stage 1 is amplified by stage 2.'),
          data: { v: v, VCC: VCC, b1: b1, b2: b2, R1: R1, R2: R2, RC1: RC1, RE1: RE1, RE2: RE2 } };
      });
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);

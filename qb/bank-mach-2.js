/* bank-mach-2.js — Electrical Machines question bank, part 2
 * =============================================================================
 * Range: course 'mach'
 *   basics: speed, dcm, rmf          (pack M6)
 *   im:     slip, eqcct, tests, tmax, vf, gen   (packs M7, M8, M9)
 *   sync:   pu, xs, phasor, pangle, pfc         (packs M10, M11)
 * Exam-paper styles from MX1 (Jun23), MX2 (Jun24), MX3 (mock), MXF (final pass).
 *
 * Course method kept throughout:
 *   torque is τ (\tau) · n_S = 60f/p with p = pole-pairs · rms phasors
 *   simplified induction circuit: R_C ∥ jX_M at the terminals, then R1 + jX + R2'/s
 *   stator copper loss uses I2' (the series branch) · τ = P_AG/ω_S
 *   synchronous machine, generator convention: E0 = V + I(R + jXs);
 *   motor with input current I_m: E0 = V − I_m(R + jXs)
 *
 * Every answer carries `key` (stable id) and every Q carries `meta.in` (the raw
 * inputs) so tests/test-mach-2.js can recompute the numbers independently.
 * Figures: uses QB.sch.imPerPhase / dcMachine / syncModel / ocTest ... when the
 * framework provides them, otherwise draws its own with QB.sch.drawing().
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB;
  if (!QB || !QB.add) return;
  var F = QB.fmt, T = F.tex, cx = QB.cx, SQ3 = Math.sqrt(3), PI = Math.PI;

  /* ------------------------------------------------------------ number formatting (TeX) */
  function n(x, s) { var t = T.num(x, s || 4); return t.indexOf('\\times') >= 0 ? '{' + t + '}' : t; }   // braced so a following ^2 is valid TeX
  function ang(d) { return T.num(Math.abs(d) < 5e-10 ? 0 : d, 4) + '^\\circ'; }
  function ph(z) { return F.phasor(z, 4); }
  function rc(z) { return F.cx(z, 4); }
  function U(x, unit, s) { return n(x, s) + '\\ \\text{' + unit + '}'; }
  function ohm(x, s) { return n(x, s) + '\\ \\Omega'; }
  function jo(x, s) { return 'j' + n(x, s) + '\\ \\Omega'; }
  function W(x) { return T.eng(x, 'W', 4); }
  function VAr(x) { return T.eng(x, 'VAr', 4); }
  function VA(x) { return T.eng(x, 'VA', 4); }
  function V_(x) { return T.eng(x, 'V', 4); }
  function A_(x) { return T.eng(x, 'A', 4); }
  function Nm(x) { return n(x) + '\\ \\text{N m}'; }
  function rpm(x) { return n(x) + '\\ \\text{rpm}'; }
  function rads(x) { return n(x) + '\\ \\text{rad/s}'; }
  function Hz(x) { return n(x) + '\\ \\text{Hz}'; }
  function pct(x) { return n(x) + '\\,\\%'; }
  function pu(x) { return n(x) + '\\ \\text{pu}'; }
  function sgn(x) { return x < 0 ? '(' + n(x) + ')' : n(x); }   // bracket negatives inside products
  function $(t) { return '$' + t + '$'; }
  function $$(t) { return '$$' + t + '$$'; }
  function lagLead(phiDeg) { return Math.abs(phiDeg) < 1e-6 ? 'unity' : (phiDeg < 0 ? 'lagging' : 'leading'); }

  /* plain-text values for the givens table */
  function pv(x, unit, s) { var t = F.num(x, s || 4); return unit ? t + ' ' + unit : t; }
  function pe(x, unit, s) { return F.eng(x, unit, s || 4); }
  function pj(x) { return 'j' + F.num(x, 4) + ' Ω'; }

  /* ------------------------------------------------------------ answers */
  function ans(key, label, value, unit, o) {
    var a = { key: key, label: label, value: value, unit: unit == null ? '' : unit, tol: 0.02, sig: 4 };
    if (o) for (var k in o) a[k] = o[k];
    if (a.unit === '°' && a.abs == null) a.abs = 0.3;
    return a;
  }

  /* ------------------------------------------------------------ machine maths */
  function wOf(nrpm) { return 2 * PI * nrpm / 60; }
  function nOf(w) { return w * 60 / (2 * PI); }
  function polesFromRated(f, nR) { var q = 60 * f / nR; var p = Math.floor(q + 1e-9); return { q: q, p: p, ns: 60 * f / p, integer: Math.abs(q - Math.round(q)) < 1e-9 }; }
  /** simplified IM circuit; returns everything (R2s may be negative) */
  function imSolve(V1, R1, R2, X, s, RC, XM, ws) {
    var R2s = R2 / s;
    var Z = cx(R1 + R2s, X);
    var I2 = cx(V1, 0).div(Z);
    var IM = cx(0, 0);
    if (RC) IM = IM.add(cx(V1 / RC, 0));
    if (XM) IM = IM.add(cx(0, -V1 / XM));
    var I1 = I2.add(IM);
    var Sin = cx(V1, 0).mul(I1.conj()).scale(3);
    var I2m = I2.abs();
    var PAG = 3 * I2m * I2m * R2s;
    var tau = PAG / ws;
    var w = (1 - s) * ws;
    var PM = tau * w;
    var Pcu1 = 3 * I2m * I2m * R1, Pcu2 = 3 * I2m * I2m * R2, Pfe = RC ? 3 * V1 * V1 / RC : 0;
    return { R2s: R2s, Z: Z, I2: I2, IM: IM, I1: I1, Pin: Sin.re, Qin: Sin.im, PAG: PAG, tau: tau, w: w, PM: PM, Pcu1: Pcu1, Pcu2: Pcu2, Pfe: Pfe, phi: I1.argd(), pf: Math.cos(I1.arg()) };
  }
  function tauFormula(V1, R1, R2s, X, ws) { return 3 * V1 * V1 * R2s / (ws * ((R1 + R2s) * (R1 + R2s) + X * X)); }
  function phaseOf(VL, conn) { return conn === 'delta' ? VL : VL / SQ3; }

  /* ------------------------------------------------------------ figures */
  function ok(svg) { return typeof svg === 'string' && svg.trim().indexOf('<svg') === 0 && !/NaN|undefined|Infinity/.test(svg); }
  /** call a framework template when it exists; fall back to our own drawing */
  function fig(name, opts, own) {
    try { if (QB.sch && typeof QB.sch[name] === 'function') { var s = QB.sch[name](opts); if (ok(s)) return s; } } catch (e) { /* fall through */ }
    try { if (QB.sch && QB.sch.drawing) { var t = own(); if (ok(t)) return t; } } catch (e2) { /* no figure */ }
    return null;
  }
  function plot(name, args) {
    try { if (QB.plot && typeof QB.plot[name] === 'function') { var s = QB.plot[name].apply(null, args); if (ok(s)) return s; } } catch (e) { /* none */ }
    return null;
  }
  function figBlock(svg) { return svg ? '<div class="qb-fig">' + svg + '</div>' : ''; }

  /** per-phase simplified induction-machine circuit
   *  o = {V, RC, XM, R1, X1, X2 | X, R2, R2lab, shunt, gen, Rext, title} (value strings) */
  function figIM(o) {
    // framework template always draws X_m, so use it only when the magnetising branch is part of the circuit
    var tpl = { kind: 'simplified', mode: o.gen ? 'gen' : 'motor', V1: o.V ? 'V_1 = ' + o.V : true, Rc: o.RC || false, Xm: o.XM || true, R1: o.R1, X1: o.X1, X2: o.X2, R2: o.R2 || true, I1: true, I2: true, I0: true };
    if (o.R2lab) tpl.labels = { R2: o.R2lab };
    return fig(o.shunt && o.XM && !o.X ? 'imPerPhase' : '__own__', tpl, function () {
      var d = QB.sch.drawing(), yt = 40, yb = 180, x = 0;
      d.acsrc({ from: [0, yb], to: [0, yt], label: 'V_1', value: o.V, side: 'left' });
      d.line([0, yt], [70, yt]);
      d.current({ at: [36, yt], dir: 'right', label: 'I_1', side: 'top' });
      x = 70;
      if (o.shunt) {
        if (o.RC) { d.dot([x, yt]); d.resistor({ from: [x, yt], to: [x, yb], label: 'R_C', value: o.RC, side: 'right' }); d.dot([x, yb]); }
        if (o.XM) { var xm = o.RC ? x + 80 : x; if (o.RC) d.line([x, yt], [xm, yt]); d.dot([xm, yt]); d.inductor({ from: [xm, yt], to: [xm, yb], label: 'jX_M', value: o.XM, side: 'right' }); d.dot([xm, yb]); x = xm; }
      }
      d.line([x, yt], [x + 50, yt]);
      d.current({ at: [x + 25, yt], dir: 'right', label: "I_2'", side: 'top', gap: 9 });
      x += 50;
      d.resistor({ from: [x, yt], to: [x + 70, yt], label: 'R_1', value: o.R1, side: 'top' }); x += 70;
      if (o.X) { d.inductor({ from: [x, yt], to: [x + 80, yt], label: 'jX', value: o.X, side: 'top' }); x += 80; }
      else {
        d.inductor({ from: [x, yt], to: [x + 70, yt], label: 'jX_1', value: o.X1, side: 'top' }); x += 70;
        d.inductor({ from: [x, yt], to: [x + 70, yt], label: "jX_2'", value: o.X2, side: 'top' }); x += 70;
      }
      d.line([x, yt], [x + 30, yt]); x += 30;
      d.resistor({ from: [x, yt], to: [x, yb], label: o.R2lab || "R_2'/s", value: o.R2, side: 'right' });
      d.line([x, yb], [0, yb]);
      return d.svg({ title: o.title || 'Simplified per-phase equivalent circuit' });
    });
  }
  /** induction-machine test circuits: no-load (shunt only) and blocked rotor (series only) */
  function figIMTests(o) {
    return fig('__imtests__', {}, function () {   // own drawing: both tests side by side
      var d = QB.sch.drawing(), yt = 50, yb = 180;
      d.label([60, 14], 'No-load test (s ≈ 0)', { italic: false });
      d.acsrc({ from: [0, yb], to: [0, yt], label: 'V_{NL}', value: o.Vnl, side: 'left' });
      d.line([0, yt], [70, yt]); d.current({ at: [36, yt], dir: 'right', label: 'I_{NL}', value: o.Inl, side: 'top' });
      d.dot([70, yt]); d.resistor({ from: [70, yt], to: [70, yb], label: 'R_C', side: 'right' }); d.dot([70, yb]);
      d.line([70, yt], [140, yt]); d.inductor({ from: [140, yt], to: [140, yb], label: 'jX_M', side: 'right' });
      d.line([140, yb], [0, yb]); d.label([70, yb + 22], 'P_{NL} = ' + o.Pnl, { italic: false });
      var x0 = 260;
      d.label([x0 + 110, 14], 'Blocked-rotor test (s = 1)', { italic: false });
      d.acsrc({ from: [x0, yb], to: [x0, yt], label: 'V_{BR}', value: o.Vbr, side: 'left' });
      d.line([x0, yt], [x0 + 40, yt]); d.current({ at: [x0 + 20, yt], dir: 'right', label: 'I_{BR}', value: o.Ibr, side: 'top', gap: 9 });
      d.resistor({ from: [x0 + 40, yt], to: [x0 + 110, yt], label: 'R_1', side: 'top' });
      d.inductor({ from: [x0 + 110, yt], to: [x0 + 190, yt], label: 'jX', side: 'top' });
      d.line([x0 + 190, yt], [x0 + 220, yt]);
      d.resistor({ from: [x0 + 220, yt], to: [x0 + 220, yb], label: "R_2'", side: 'right' });
      d.line([x0 + 220, yb], [x0, yb]); d.label([x0 + 110, yb + 22], 'P_{BR} = ' + o.Pbr, { italic: false });
      return d.svg({ title: 'Induction machine no-load and blocked-rotor tests' });
    });
  }
  /** DC machine: o = {V, R, k, gen, RF (shunt field), Ilab} */
  function figDC(o) {
    // the course PM model (R in series with E) is drawn here; wound-field machines use the framework template
    var tpl = o.kind ? { kind: o.kind, mode: o.gen ? 'gen' : 'motor', Ra: o.R, Rf: o.RF || true, VT: o.V, VF: o.kind === 'separate' ? true : undefined, currents: true } : null;
    return fig(tpl ? 'dcMachine' : '__own__', tpl, function () {
      var d = QB.sch.drawing(), yt = 50, yb = 170, x = 0;
      d.vsrc({ from: [0, yb], to: [0, yt], style: o.batt ? 'battery' : 'circle', label: 'V', value: o.V, side: 'left' });
      d.line([0, yt], [70, yt]);
      if (o.RF) {
        d.current({ at: [35, yt], dir: o.gen ? 'left' : 'right', label: 'I_L', side: 'top' });
        d.dot([70, yt]); d.resistor({ from: [70, yt], to: [70, yb], label: 'R_F', value: o.RF, side: 'right' }); d.dot([70, yb]);
        d.current({ at: [70, yt + 30], dir: 'down', label: 'I_F', side: 'left', gap: 12, len: 16 });
        d.line([70, yt], [120, yt]); x = 120;
      } else x = 70;
      d.current({ at: [x - 25, yt], dir: o.gen ? 'left' : 'right', label: o.RF ? 'I_a' : 'I', side: 'top', gap: o.RF ? 10 : 10 });
      d.resistor({ from: [x, yt], to: [x + 70, yt], label: o.RF ? 'R_a' : 'R', value: o.R, side: 'top' }); x += 70;
      d.line([x, yt], [x + 40, yt]); x += 40;
      d.vsrc({ from: [x, yb], to: [x, yt], label: 'E = k\\omega', value: o.k, side: 'right' });
      d.line([x, yb], [0, yb]);
      return d.svg({ title: o.gen ? 'DC generator equivalent circuit' : 'DC motor equivalent circuit' });
    });
  }
  /** synchronous machine per phase: o = {E, R, X, V, gen, Ilab} */
  function figSync(o) {
    return fig('syncModel', { mode: o.gen ? 'gen' : 'motor', Xs: o.X, Ra: o.R || false, E0: o.E ? { label: 'E_0', value: o.E === 'E_0' ? '' : o.E } : true, V: o.V, I: o.Ilab || (o.gen ? 'I' : 'I_m') }, function () {
      var d = QB.sch.drawing(), yt = 50, yb = 170, x = 0;
      d.acsrc({ from: [0, yb], to: [0, yt], label: 'E_0', value: o.E, side: 'left' });
      d.line([0, yt], [30, yt]); x = 30;
      if (o.R) { d.resistor({ from: [x, yt], to: [x + 70, yt], label: 'R', value: o.R, side: 'top' }); x += 70; }
      d.inductor({ from: [x, yt], to: [x + 80, yt], label: 'jX_S', value: o.X, side: 'top' }); x += 80;
      d.line([x, yt], [x + 70, yt]);
      d.current({ at: [x + 35, yt], dir: o.gen ? 'right' : 'left', label: o.Ilab || (o.gen ? 'I' : 'I_m'), side: 'top' });
      x += 70;
      d.terminal([x, yt]); d.terminal([x, yb]); d.line([x, yb], [0, yb]);
      d.polarity({ a: [x, yt + 10], b: [x, yb - 10], label: 'V', value: o.V, side: 'right' });
      return d.svg({ title: o.gen ? 'Synchronous generator per phase (I out of the machine)' : 'Synchronous motor per phase (I_m into the machine)' });
    });
  }
  /** OC/SC tests on a synchronous generator */
  function figOCSC(o) {
    return fig('__ocsc__', {}, function () {
      var d = QB.sch.drawing(), yt = 50, yb = 170;
      d.label([110, 14], 'Open-circuit test', { italic: false });
      d.acsrc({ from: [0, yb], to: [0, yt], label: 'E_0', side: 'left' });
      d.line([0, yt], [20, yt]);
      d.resistor({ from: [20, yt], to: [80, yt], label: 'R', side: 'top' });
      d.inductor({ from: [80, yt], to: [150, yt], label: 'jX_S', side: 'top' });
      d.line([150, yt], [200, yt]); d.meter({ kind: 'V', from: [200, yt], to: [200, yb], label: 'V_{OC}', value: o.Voc, side: 'right' }); d.line([200, yb], [0, yb]);
      d.label([100, yb + 22], 'I_F = ' + o.IF, { italic: false });
      var x0 = 300;
      d.label([x0 + 110, 14], 'Short-circuit test', { italic: false });
      d.acsrc({ from: [x0, yb], to: [x0, yt], label: 'E_0', side: 'left' });
      d.line([x0, yt], [x0 + 20, yt]);
      d.resistor({ from: [x0 + 20, yt], to: [x0 + 80, yt], label: 'R', side: 'top' });
      d.inductor({ from: [x0 + 80, yt], to: [x0 + 150, yt], label: 'jX_S', side: 'top' });
      d.line([x0 + 150, yt], [x0 + 200, yt]); d.meter({ kind: 'A', from: [x0 + 200, yt], to: [x0 + 200, yb], label: 'I_{SC}', value: o.Isc, side: 'right' }); d.line([x0 + 200, yb], [x0, yb]);
      d.label([x0 + 100, yb + 22], 'I_F = ' + o.IF, { italic: false });
      return d.svg({ title: 'Synchronous machine open- and short-circuit tests' });
    });
  }
  /** plant on a common supply: loads = [{text:'IM', label, value}] */
  function figPlant(loads) {
    return fig('__plant__', {}, function () {
      var d = QB.sch.drawing(), yt = 40, yb = 190;
      d.acsrc({ from: [0, yb], to: [0, yt], label: 'Supply', side: 'left' });
      var x = 0;
      loads.forEach(function (L, i) {
        var xn = 110 + i * 130;
        d.line([x, yt], [xn, yt]); d.line([x, yb], [xn, yb]);
        if (i < loads.length - 1) { d.dot([xn, yt]); d.dot([xn, yb]); }
        if (L.text) d.mach({ from: [xn, yt], to: [xn, yb], text: L.text, r: 20, label: L.label, value: L.value, side: 'right' });
        else d.zbox({ from: [xn, yt], to: [xn, yb], label: L.label, value: L.value, side: 'right' });
        x = xn;
      });
      return d.svg({ title: 'Plant loads on a common supply' });
    });
  }
  /** a phasor diagram (only when QB.plot.phasors exists) */
  function phasorFig(list) { return plot('phasors', [list, { title: 'Phasor diagram (not to scale)' }]); }

  function add(t) { QB.add(t); }
  /* common parameter pickers */
  function pickPF(r) { return r.pick([0.75, 0.8, 0.8, 0.82, 0.85, 0.85, 0.88, 0.9, 0.9, 0.92, 0.95]); }

  /* =====================================================================
   * MODULE 3 · basics.speed   (pack M6 §1.2–1.4, Types A–C; Jun23 Q3a, MX3 3a)
   * ===================================================================== */
  add({
    id: 'mach.basics.speed.poles', course: 'mach', module: 'basics', topic: 'speed',
    title: 'Poles, machine type and ideal efficiency from the rated speed',
    difficulty: 1, marks: 6, tags: ['exam-style', 'Jun23 Q3a', 'MX3 3a', 'Type A'],
    variants: [{ id: 'im', label: 'Induction machine (non-integer p)', weight: 3 }, { id: 'sync', label: 'Synchronous machine (integer p)' }],
    gen: function (r, v) {
      var f = r.pick([50, 50, 60]), p = r.int(1, 6), ns = 60 * f / p;
      var x = r.pick([0.25, 0.4, 0.5, 0.6, 0.75]);
      var nR, slipSp;
      if (v === 'im') {
        r.retry(function () {
          slipSp = r.int(Math.max(2, Math.round(0.015 * ns)), Math.round(0.07 * ns));
          nR = ns - slipSp;
          var q = 60 * f / nR;
          return Math.abs(q - Math.round(q)) > 1e-6 && Math.floor(q) === p ? true : null;
        });
      } else { nR = ns; slipSp = 0; }
      var q = 60 * f / nR;
      var PR = r.pick([0.75, 1.1, 2.2, 4, 5.5, 7.5, 11, 15, 22, 37]) * 1000;
      var parts = [];
      parts.push({
        q: '(a) How many poles does the machine have, and what is its synchronous speed? Is it a synchronous or an induction machine? Give the reason in one line.',
        answers: [ans('poles', 'poles', 2 * p, ''), ans('ns', '$n_S$', ns, 'rpm')],
        working: QB.steps([
          $('p = \\dfrac{60f}{n_R} = \\dfrac{60\\times' + f + '}{' + nR + '} = ' + n(q, 5)),
          v === 'im' ? 'Not an integer, so the machine is an <b>induction</b> machine. Round <b>down</b>: ' + $('p = ' + p) + ' pole-pairs, because an induction motor runs just below ' + $('n_S') + '.'
            : 'An exact integer, so ' + $('n_R') + ' is a synchronous speed: the machine is <b>synchronous</b>, ' + $('p = ' + p) + ' pole-pairs.',
          $('n_S = \\dfrac{60f}{p} = \\dfrac{60\\times' + f + '}{' + p + '} = ' + rpm(ns)) + ', poles ' + $('= 2p = ' + 2 * p),
          v === 'im' ? 'Reason: ' + nR + ' rpm is below the nearest synchronous speed (' + n(ns) + ' rpm), so the machine runs with slip: induction.' : 'Reason: it runs at exactly ' + $('n_S') + ' (no slip): synchronous.'
        ]) + QB.final('\\text{' + (2 * p) + ' poles},\\ n_S = ' + rpm(ns) + ',\\ \\text{' + (v === 'im' ? 'induction' : 'synchronous') + '}')
      });
      if (v === 'im') {
        var s = slipSp / ns, eta = (1 - s) * 100;
        parts.push({
          q: '(b) Find the rated slip, the rotor (slip) frequency and the ideal (maximum possible) efficiency at rated speed.',
          answers: [ans('s', '$s_R$', s, ''), ans('f2', '$f_2$', s * f, 'Hz'), ans('eta', '$\\eta_{max}$', eta, '%')],
          working: QB.steps([
            $('s_R = \\dfrac{n_S - n_R}{n_S} = \\dfrac{' + ns + ' - ' + nR + '}{' + ns + '} = ' + n(s)),
            $('f_2 = s f = ' + n(s) + '\\times' + f + ' = ' + Hz(s * f)),
            'Rotor copper loss is ' + $('sP_{AG}') + ', so at best ' + $('P_{out} = (1-s)P_{AG}') + ':',
            $('\\eta_{max} = 1 - s = \\dfrac{n_R}{n_S} = \\dfrac{' + nR + '}{' + ns + '} = ' + pct(eta))
          ]) + QB.final('s_R = ' + n(s) + ',\\ f_2 = ' + Hz(s * f) + ',\\ \\eta_{max} = ' + pct(eta))
        });
        var nx = ns - x * slipSp, Pp = x * nx / nR * 100;
        parts.push({
          q: '(c) The machine delivers ' + x * 100 + ' % of rated torque. Assuming a linear torque–speed curve, find the speed and the output power as a percentage of rated output power.',
          answers: [ans('nx', '$n$', nx, 'rpm'), ans('Pp', '$P/P_R$', Pp, '%')],
          working: QB.steps([
            'Slip speed at rated torque: ' + $('n_S - n_R = ' + ns + ' - ' + nR + ' = ' + rpm(slipSp)) + '. On the linear curve the slip speed is proportional to torque.',
            $('n = n_S - x(n_S - n_R) = ' + ns + ' - ' + x + '\\times' + slipSp + ' = ' + rpm(nx)),
            $('\\dfrac{P}{P_R} = \\dfrac{\\tau\\omega}{\\tau_R\\omega_R} = x\\dfrac{n}{n_R} = ' + x + '\\times\\dfrac{' + n(nx) + '}{' + nR + '} = ' + pct(Pp))
          ]) + QB.final('n = ' + rpm(nx) + ',\\ P = ' + pct(Pp) + '\\ \\text{of rated}'),
        });
        return { stem: 'A three-phase AC machine has a nameplate showing ' + f + ' Hz and a rated speed of ' + nR + ' rpm.', figure: null,
          given: [['$f$', f + ' Hz'], ['$n_R$', nR + ' rpm']], parts: parts,
          notes: QB.callout('trap', 'Round $p = 60f/n_R$ <b>down</b> for an induction machine, and remember $P/P_R \\ne x$: the speed rises at part load.'),
          meta: { in: { f: f, nR: nR, x: x } } };
      }
      var wR = wOf(ns), tR = PR / wR;
      parts.push({
        q: '(b) The machine is rated at ' + pe(PR, 'W', 3) + '. Find its rated speed and rated torque.',
        answers: [ans('tR', '$\\tau_R$', tR, 'N·m')],
        working: QB.steps([
          'A synchronous machine runs at ' + $('n_S') + ' at every load: ' + $('n_R = ' + rpm(ns)) + '.',
          $('\\omega_R = \\dfrac{2\\pi n_R}{60} = ' + rads(wR)),
          $('\\tau_R = \\dfrac{P_R}{\\omega_R} = \\dfrac{' + n(PR) + '}{' + n(wR) + '} = ' + Nm(tR))
        ]) + QB.final('\\tau_R = ' + Nm(tR))
      });
      parts.push({
        q: '(c) Find the speed and the output power at ' + x * 100 + ' % of rated torque.',
        answers: [ans('nx', '$n$', ns, 'rpm'), ans('Px', '$P$', x * PR, 'W')],
        working: QB.steps([
          'The τ–n line of a synchronous machine is vertical at ' + $('n_S') + ': ' + $('n = ' + rpm(ns)) + '.',
          'Speed is constant, so power is proportional to torque: ' + $('P = xP_R = ' + x + '\\times' + n(PR) + ' = ' + W(x * PR))
        ]) + QB.final('n = ' + rpm(ns) + ',\\ P = ' + W(x * PR))
      });
      return { stem: 'A three-phase AC machine rated ' + pe(PR, 'W', 3) + ' has a nameplate showing ' + f + ' Hz and a rated speed of ' + nR + ' rpm.', figure: null,
        given: [['$f$', f + ' Hz'], ['$n_R$', nR + ' rpm'], ['$P_R$', pe(PR, 'W', 3)]], parts: parts,
        notes: QB.callout('tip', 'An integer $60f/n_R$ means the machine runs at synchronous speed: it is synchronous, with no slip and no ideal-efficiency limit of $1-s$.'),
        meta: { in: { f: f, nR: nR, x: x, PR: PR } } };
    }
  });

  add({
    id: 'mach.basics.speed.linear', course: 'mach', module: 'basics', topic: 'speed',
    title: 'Linear τ–n curve: torque, speed and power at part load',
    difficulty: 1, marks: 6, tags: ['PQ 4.3', 'PQ 7.6', 'PQ 4.13', 'Type B'],
    variants: [{ id: 'dc', label: 'DC machine' }, { id: 'im', label: 'Induction motor' }, { id: 'imgen', label: 'Induction machine driven above n_S (generator)' }, { id: 'sync', label: 'Synchronous machine' }],
    gen: function (r, v) {
      var PR = r.pick([0.25, 0.5, 0.75, 1.1, 2.2, 4, 5.5, 7.5, 11, 15]) * 1000;
      var x = r.pick([0.25, 0.4, 0.5, 0.6, 0.75]);
      var n0, nR, f, p, kind;
      if (v === 'dc') { n0 = r.pick([1000, 1500, 2000, 3000, 4000, 6000, 10000, 12000]); nR = n0 - r.nice(0.08 * n0, 0.2 * n0, n0 >= 4000 ? 100 : 10); kind = 'DC'; }
      else {
        f = r.pick([50, 50, 60]); p = r.int(1, 4); n0 = 60 * f / p;
        nR = v === 'sync' ? n0 : n0 - r.int(Math.round(0.02 * n0), Math.round(0.06 * n0));
        kind = v === 'sync' ? 'synchronous' : 'induction';
      }
      var dn = n0 - nR, wR = wOf(nR), tR = PR / wR;
      var parts = [], given = [['$P_R$', pe(PR, 'W', 3)]];
      var stem;
      if (v === 'dc') { stem = 'A ' + pe(PR, 'W', 3) + ' DC machine has a no-load speed of ' + n0 + ' rpm and a rated speed of ' + nR + ' rpm at rated voltage.'; given.push(['$n_{NL}$', n0 + ' rpm'], ['$n_R$', nR + ' rpm']); }
      else if (v === 'sync') { stem = 'A ' + pe(PR, 'W', 3) + ', ' + 2 * p + '-pole synchronous motor operates from a ' + f + ' Hz supply.'; given.push(['poles', String(2 * p)], ['$f$', f + ' Hz']); }
      else { stem = 'A ' + pe(PR, 'W', 3) + ', ' + nR + ' rpm, ' + f + ' Hz three-phase induction machine operates at rated voltage.'; given.push(['$n_R$', nR + ' rpm'], ['$f$', f + ' Hz']); }
      var w0 = [];
      if (v !== 'dc') {
        var pf = polesFromRated(f, nR);
        w0.push(v === 'sync' ? $('n_S = \\dfrac{120f}{\\text{poles}} = \\dfrac{120\\times' + f + '}{' + 2 * p + '} = ' + rpm(n0)) + '; a synchronous machine runs at ' + $('n_S') + ', so ' + $('n_R = ' + rpm(nR)) + '.'
          : $('60f/n_R = ' + n(pf.q, 4)) + ', so ' + $('p = ' + p) + ' and ' + $('n_S = 60f/p = ' + rpm(n0)) + '. Rated slip speed ' + $('= ' + n0 + ' - ' + nR + ' = ' + rpm(dn)) + '.');
      } else w0.push('Rated speed drop ' + $('n_{NL} - n_R = ' + n0 + ' - ' + nR + ' = ' + rpm(dn)) + '.');
      w0.push($('\\omega_R = 2\\pi n_R/60 = ' + rads(wR)), $('\\tau_R = \\dfrac{P_R}{\\omega_R} = \\dfrac{' + n(PR) + '}{' + n(wR) + '} = ' + Nm(tR)));
      parts.push({ q: '(a) Find the rated speed drop (or slip speed) and the rated torque.', answers: [ans('tR', '$\\tau_R$', tR, 'N·m')], working: QB.steps(w0) + QB.final('\\tau_R = ' + Nm(tR)) });
      if (v === 'imgen') {
        var nd = n0 + r.int(Math.round(0.3 * dn), Math.round(0.9 * dn));
        var tg = -tR * (nd - n0) / dn, Pg = tg * wOf(nd);
        var xg = r.pick([0.5, 0.75, 1]); var ng = n0 + xg * dn;
        parts.push({
          q: '(b) The machine is driven at ' + nd + ' rpm. Is it a motor or a generator? Find the torque (sign included) and the mechanical power.',
          answers: [ans('tg', '$\\tau$', tg, 'N·m'), ans('Pg', '$P = \\tau\\omega$', Pg, 'W')],
          working: QB.steps([
            $(nd + ' > n_S = ' + n0) + ' rpm, so it is a <b>generator</b>. Slip speed ' + $('= ' + n0 + ' - ' + nd + ' = ' + rpm(n0 - nd)) + ' (negative).',
            $('\\tau = \\tau_R\\dfrac{n_S - n}{n_S - n_R} = ' + n(tR) + '\\times\\dfrac{' + (n0 - nd) + '}{' + dn + '} = ' + Nm(tg)),
            $('P = \\tau\\omega = ' + sgn(tg) + '\\times' + n(wOf(nd)) + ' = ' + W(Pg)) + ': negative, so the shaft drives the machine.'
          ]) + QB.final('\\text{generator},\\ \\tau = ' + Nm(tg) + ',\\ P = ' + W(Pg))
        });
        parts.push({
          q: '(c) At what speed must it be driven so that the input (driving) torque is ' + xg * 100 + ' % of rated torque?',
          answers: [ans('ng', '$n$', ng, 'rpm')],
          working: QB.steps(['A generator at ' + $('\\tau = -' + xg + '\\tau_R') + ' has a slip speed of ' + $('-' + xg + '\\times' + dn + ' = ' + n(-xg * dn)) + ' rpm.', $('n = n_S + ' + xg + '(n_S - n_R) = ' + n0 + ' + ' + n(xg * dn) + ' = ' + rpm(ng))]) + QB.final('n = ' + rpm(ng)),
        });
        return { stem: stem, figure: null, given: given, parts: parts, meta: { in: { PR: PR, n0: n0, nR: nR, nd: nd, xg: xg } } };
      }
      var nx = v === 'sync' ? n0 : n0 - x * dn, Px = x * tR * wOf(nx);
      parts.push({
        q: '(b) Find the speed and the output power at ' + x * 100 + ' % of rated torque. Express the power as a percentage of rated power.',
        answers: [ans('nx', '$n$', nx, 'rpm'), ans('Px', '$P$', Px, 'W'), ans('Pp', '$P/P_R$', Px / PR * 100, '%')],
        working: QB.steps(v === 'sync' ? ['Vertical τ–n line: ' + $('n = n_S = ' + rpm(nx)) + '.', $('P = xP_R = ' + W(Px)) + ' (' + pct(Px / PR * 100) + ').']
          : [$('n = n_0 - x(n_0 - n_R) = ' + n0 + ' - ' + x + '\\times' + dn + ' = ' + rpm(nx)),
            $('P = \\tau\\omega = (' + x + '\\times' + n(tR) + ')\\times\\dfrac{2\\pi\\times' + n(nx) + '}{60} = ' + W(Px)),
            $('P/P_R = ' + pct(Px / PR * 100)) + '. More than ' + x * 100 + ' % because the speed is higher than rated speed: ' + $('P/P_R = x\\,n/n_R') + '.'])
          + QB.final('n = ' + rpm(nx) + ',\\ P = ' + W(Px))
      });
      if (v !== 'sync') {
        var tL = r.nice(0.3 * tR, 0.9 * tR, tR > 20 ? 1 : 0.01); if (tL <= 0) tL = Math.round(tR * 50) / 100;
        var nL = n0 - dn * tL / tR;
        parts.push({
          q: '(c) Find the operating speed with a load torque of ' + pv(tL, 'N m') + '.',
          answers: [ans('nL', '$n$', nL, 'rpm')],
          working: QB.steps([$('\\text{drop} = (n_0 - n_R)\\dfrac{\\tau_L}{\\tau_R} = ' + dn + '\\times\\dfrac{' + n(tL) + '}{' + n(tR) + '} = ' + rpm(dn * tL / tR)), $('n = ' + n0 + ' - ' + n(dn * tL / tR) + ' = ' + rpm(nL))]) + QB.final('n = ' + rpm(nL))
        });
        return { stem: stem, figure: null, given: given, parts: parts, meta: { in: { PR: PR, n0: n0, nR: nR, x: x, tL: tL } } };
      }
      return { stem: stem, figure: null, given: given, parts: parts, meta: { in: { PR: PR, n0: n0, nR: nR, x: x } } };
    }
  });

  add({
    id: 'mach.basics.speed.control', course: 'mach', module: 'basics', topic: 'speed',
    title: 'Speed control: DC voltage and AC V/f',
    difficulty: 2, marks: 5, tags: ['PQ 4.4', 'PQ 4.7', 'N5', 'Jun24 Q3a(ii)', 'Type C'],
    variants: [{ id: 'dc-nl', label: 'DC: new no-load speed' }, { id: 'dc-op', label: 'DC: target speed at a given torque' }, { id: 'im-ns', label: 'Induction: new synchronous speed' }, { id: 'im-op', label: 'Induction: target speed at rated torque' }, { id: 'sync', label: 'Synchronous: new speed' }],
    gen: function (r, v) {
      var parts = [], given, stem, meta;
      if (v === 'dc-nl' || v === 'dc-op') {
        var VR = r.pick([12, 24, 48, 110, 220, 240]), nNL = r.pick([1000, 1500, 2000, 3000, 6000, 12000]);
        var dn = r.nice(0.1 * nNL, 0.2 * nNL, nNL >= 6000 ? 500 : 50), nR = nNL - dn;
        stem = 'A DC motor has a no-load speed of ' + nNL + ' rpm and a rated speed of ' + nR + ' rpm at its rated voltage of ' + VR + ' V. Assume a linear τ–n curve.';
        given = [['$V_R$', VR + ' V'], ['$n_{NL}$', nNL + ' rpm'], ['$n_R$', nR + ' rpm']];
        if (v === 'dc-nl') {
          var fr = r.pick([0.5, 0.25, 0.75, 0.6, 0.8]); var nNL2 = fr * nNL, V2 = VR * fr;
          parts.push({ q: '(a) What supply voltage gives a no-load speed of ' + n(nNL2) + ' rpm?', answers: [ans('V2', '$V$', V2, 'V')],
            working: QB.steps(['No-load speed ' + $('n_{NL} = V/k \\propto V') + '.', $('V = V_R\\dfrac{n_{NL,new}}{n_{NL}} = ' + VR + '\\times\\dfrac{' + n(nNL2) + '}{' + nNL + '} = ' + V_(V2))]) + QB.final('V = ' + V_(V2)) });
          parts.push({ q: '(b) At this voltage, find the speed at rated torque and at half rated torque.', answers: [ans('nR2', '$n$ (rated τ)', nNL2 - dn, 'rpm'), ans('nH2', '$n$ (half τ)', nNL2 - dn / 2, 'rpm')],
            working: QB.steps(['The speed <b>drop</b> at a given torque does not change with V (the curve slides parallel): ' + $(dn) + ' rpm at rated torque.', $('n = ' + n(nNL2) + ' - ' + dn + ' = ' + rpm(nNL2 - dn)), $('n_{1/2} = ' + n(nNL2) + ' - ' + n(dn / 2) + ' = ' + rpm(nNL2 - dn / 2))]) + QB.final('n_R = ' + rpm(nNL2 - dn) + ',\\ n_{1/2} = ' + rpm(nNL2 - dn / 2)) });
          meta = { VR: VR, nNL: nNL, nR: nR, fr: fr };
        } else {
          var x = r.pick([1, 0.5, 0.75]), nt = r.nice(0.25 * nNL, 0.7 * nNL, nNL >= 6000 ? 500 : 50);
          var n0n = nt + x * dn, V2b = VR * n0n / nNL;
          parts.push({ q: '(a) The motor must run at ' + nt + ' rpm with ' + (x === 1 ? 'rated' : x * 100 + ' % of rated') + ' torque. Find the new no-load speed and the supply voltage needed.', answers: [ans('n0n', '$n_{NL,new}$', n0n, 'rpm'), ans('V2', '$V$', V2b, 'V')],
            working: QB.steps(['Add back the speed drop at this torque: ' + $(x + '\\times' + dn + ' = ' + n(x * dn)) + ' rpm.', $('n_{NL,new} = ' + nt + ' + ' + n(x * dn) + ' = ' + rpm(n0n)), $('V = V_R\\dfrac{n_{NL,new}}{n_{NL}} = ' + VR + '\\times\\dfrac{' + n(n0n) + '}{' + nNL + '} = ' + V_(V2b))]) + QB.final('V = ' + V_(V2b)) });
          parts.push({ q: '(b) At this voltage, what is the speed at no load?', answers: [ans('nnl', '$n_{NL}$', n0n, 'rpm')], working: QB.steps(['At no load τ = 0, so ' + $('n = n_{NL,new} = ' + rpm(n0n)) + '.']) + QB.final('n = ' + rpm(n0n)) });
          meta = { VR: VR, nNL: nNL, nR: nR, x: x, nt: nt };
        }
        var n0b = meta.fr ? meta.fr * nNL : meta.nt + meta.x * dn;
        var dcfig = plot('curves', [[{ x: [nNL, nNL - 1.2 * dn], y: [0, 1.2], label: 'V_R' }, { x: [n0b, n0b - 1.2 * dn], y: [0, 1.2], label: 'new V', dash: '6 4' }], { xlabel: 'n (rpm)', ylabel: 'τ/τ_R', legend: true, hlines: [{ y: 1, label: 'rated τ' }] }]);
        return { stem: stem, figure: dcfig, given: given, parts: parts, notes: QB.callout('trap', 'Do not scale the rated speed in proportion. It is the speed <b>drop</b> that stays constant.'), meta: { in: meta } };
      }
      var f = r.pick([50, 50, 60]), p = r.int(1, 4), ns = 60 * f / p;
      var VR2 = f === 50 ? r.pick([400, 415, 415, 240]) : r.pick([110, 208, 460, 480]);
      if (v === 'sync') {
        var nT = r.nice(0.3 * ns, 0.9 * ns, ns >= 1500 ? 50 : 10); var fN = nT * p / 60, VN = VR2 * fN / f;
        stem = 'A ' + 2 * p + '-pole synchronous motor is rated ' + VR2 + ' V, ' + f + ' Hz. It is fed from a variable-frequency inverter and must run at ' + nT + ' rpm.';
        parts.push({ q: '(a) Find the inverter frequency and voltage.', answers: [ans('f', '$f$', fN, 'Hz'), ans('V', '$V$', VN, 'V')],
          working: QB.steps(['A synchronous machine has no slip, so ' + $('n_S = ' + nT) + ' rpm.', $('f = \\dfrac{n_S\\,p}{60} = \\dfrac{' + nT + '\\times' + p + '}{60} = ' + Hz(fN)), 'Keep V/f constant so the peak flux stays at its rated value: ' + $('V = ' + VR2 + '\\times\\dfrac{' + n(fN) + '}{' + f + '} = ' + V_(VN))]) + QB.final('f = ' + Hz(fN) + ',\\ V = ' + V_(VN)) });
        parts.push({ q: '(b) What is the speed at half rated torque?', answers: [ans('nh', '$n$', nT, 'rpm')], working: QB.steps(['Synchronous: the τ–n line is vertical, so ' + $('n = ' + rpm(nT)) + ' at any torque below pull-out.']) + QB.final('n = ' + rpm(nT)) });
        return { stem: stem, figure: null, given: [['poles', String(2 * p)], ['$V_R$', VR2 + ' V'], ['$f_R$', f + ' Hz']], parts: parts, notes: QB.callout('trap', 'Changing f without changing V saturates the core: halve V <b>and</b> f.'), meta: { in: { f: f, p: p, VR: VR2, nT: nT } } };
      }
      var dsl = r.int(Math.round(0.02 * ns), Math.round(0.06 * ns)), nR2 = ns - dsl;
      stem = 'An induction machine operates from a ' + VR2 + ' V, ' + f + ' Hz supply. Its synchronous speed is ' + n(ns) + ' rpm and its rated speed is ' + nR2 + ' rpm. It is fed from a constant-V/f inverter.';
      given = [['$V_R$', VR2 + ' V'], ['$f_R$', f + ' Hz'], ['$n_S$', n(ns) + ' rpm'], ['$n_R$', nR2 + ' rpm']];
      var nsN;
      if (v === 'im-ns') {
        nsN = r.nice(0.3 * ns, 0.8 * ns, ns >= 1500 ? 50 : 10);
        var fN2 = f * nsN / ns, VN2 = VR2 * fN2 / f;
        parts.push({ q: '(a) Find the supply voltage and frequency that give a synchronous speed of ' + nsN + ' rpm.', answers: [ans('f', '$f$', fN2, 'Hz'), ans('V', '$V$', VN2, 'V')],
          working: QB.steps([$('n_S \\propto f') + ': ' + $('f = ' + f + '\\times\\dfrac{' + nsN + '}{' + n(ns) + '} = ' + Hz(fN2)), 'Constant V/f: ' + $('V = ' + VR2 + '\\times\\dfrac{' + n(fN2) + '}{' + f + '} = ' + V_(VN2))]) + QB.final('f = ' + Hz(fN2) + ',\\ V = ' + V_(VN2)) });
        parts.push({ q: '(b) With this supply, find the speed at (i) rated torque and (ii) half rated torque.', answers: [ans('n1', '$n$ (rated)', nsN - dsl, 'rpm'), ans('n2', '$n$ (half)', nsN - dsl / 2, 'rpm')],
          working: QB.steps(['The slip speed at a given torque stays the same: ' + $(dsl) + ' rpm at rated torque, ' + $(n(dsl / 2)) + ' rpm at half torque.', $('n = ' + nsN + ' - ' + dsl + ' = ' + rpm(nsN - dsl)), $('n_{1/2} = ' + nsN + ' - ' + n(dsl / 2) + ' = ' + rpm(nsN - dsl / 2))]) + QB.final('n = ' + rpm(nsN - dsl) + ',\\ n_{1/2} = ' + rpm(nsN - dsl / 2)) });
        return { stem: stem, figure: null, given: given, parts: parts, notes: QB.callout('trap', 'Do not scale $n_R$ in proportion with f: the slip speed stays constant, so the rated-torque speed is $n_{S,new} - (n_S - n_R)$.'), meta: { in: { f: f, ns: ns, VR: VR2, nR: nR2, nsN: nsN } } };
      }
      var nT2 = r.nice(0.3 * ns, 0.8 * ns, ns >= 1500 ? 50 : 10);
      nsN = nT2 + dsl; var fN3 = nsN * p / 60, VN3 = VR2 * fN3 / f;
      parts.push({ q: '(a) Find the inverter frequency and voltage so that the motor runs at ' + nT2 + ' rpm at rated torque.', answers: [ans('nsN', '$n_{S,new}$', nsN, 'rpm'), ans('f', '$f$', fN3, 'Hz'), ans('V', '$V$', VN3, 'V')],
        working: QB.steps(['Rated slip speed ' + $('= ' + n(ns) + ' - ' + nR2 + ' = ' + dsl) + ' rpm, and it stays constant under V/f.', $('n_{S,new} = ' + nT2 + ' + ' + dsl + ' = ' + rpm(nsN)), $('p = 60f/n_S = ' + p) + ', so ' + $('f = \\dfrac{n_{S,new}\\,p}{60} = \\dfrac{' + nsN + '\\times' + p + '}{60} = ' + Hz(fN3)), $('V = ' + VR2 + '\\times\\dfrac{' + n(fN3) + '}{' + f + '} = ' + V_(VN3))]) + QB.final('f = ' + Hz(fN3) + ',\\ V = ' + V_(VN3)) });
      parts.push({ q: '(b) With those settings, find the speed at half rated torque.', answers: [ans('nh', '$n$', nsN - dsl / 2, 'rpm')], working: QB.steps([$('n = ' + nsN + ' - ' + n(dsl / 2) + ' = ' + rpm(nsN - dsl / 2))]) + QB.final('n = ' + rpm(nsN - dsl / 2)) });
      return { stem: stem, figure: null, given: given, parts: parts, notes: QB.callout('trap', 'Add the slip speed back before scaling: the target is an operating speed, not a synchronous speed.'), meta: { in: { f: f, ns: ns, p: p, VR: VR2, nR: nR2, nT: nT2 } } };
    }
  });

  add({
    id: 'mach.basics.speed.select', course: 'mach', module: 'basics', topic: 'speed',
    title: 'Choosing the pole number for a required speed',
    difficulty: 1, marks: 2, tags: ['PQ 4.11', 'PQ 6.9', 'PQ 7.4'],
    variants: [{ id: 'closest', label: 'Closest synchronous speed' }, { id: 'hydro', label: 'Exact speed (hydro generator)' }, { id: 'fromns', label: 'Poles and frequency from n_S' }],
    gen: function (r, v) {
      if (v === 'closest') {
        var f = r.pick([50, 60]), tgt, p1, p2, c;
        r.retry(function () {
          tgt = r.int(180, 3400); var q = 60 * f / tgt; p1 = Math.floor(q); p2 = p1 + 1; if (p1 < 1) return null;
          var d1 = Math.abs(60 * f / p1 - tgt), d2 = Math.abs(60 * f / p2 - tgt);
          if (Math.abs(q - Math.round(q)) < 0.05 || Math.abs(d1 - d2) < 0.08 * tgt) return null;
          c = d1 < d2 ? p1 : p2; return true;
        });
        var nsC = 60 * f / c;
        return { stem: 'An AC machine must run from the ' + f + ' Hz supply with a synchronous speed as close as possible to ' + tgt + ' rpm.', figure: null, given: [['$f$', f + ' Hz'], ['target', tgt + ' rpm']],
          parts: [{ q: 'Select the number of poles and find the exact synchronous speed.', answers: [ans('poles', 'poles', 2 * c, ''), ans('ns', '$n_S$', nsC, 'rpm')],
            working: QB.steps([$('p = \\dfrac{60f}{n} = \\dfrac{60\\times' + f + '}{' + tgt + '} = ' + n(60 * f / tgt)), 'The candidates are ' + $('p = ' + p1) + ' (' + n(60 * f / p1) + ' rpm) and ' + $('p = ' + p2) + ' (' + n(60 * f / p2) + ' rpm). Here you round to the <b>closest speed</b>, not down.', 'Closest: ' + $('p = ' + c) + ', i.e. <b>' + 2 * c + ' poles</b>, ' + $('n_S = ' + rpm(nsC)) + '.']) + QB.final(2 * c + '\\ \\text{poles},\\ n_S = ' + rpm(nsC)) }],
          meta: { in: { f: f, tgt: tgt } } };
      }
      if (v === 'hydro') {
        var nH, pp;
        r.retry(function () { pp = r.int(6, 40); nH = 3000 / pp; return Math.abs(nH - Math.round(nH * 10) / 10) < 1e-9 ? true : null; });
        var q60 = 3600 / nH;
        return { stem: 'A hydro-electric synchronous generator for the 50 Hz Australian grid is designed to turn at ' + n(nH) + ' rpm.', figure: null, given: [['$n$', n(nH) + ' rpm'], ['$f$', '50 Hz']],
          parts: [{ q: '(a) How many poles does it need?', answers: [ans('poles', 'poles', 2 * pp, '')], working: QB.steps([$('p = \\dfrac{60f}{n_S} = \\dfrac{60\\times50}{' + n(nH) + '} = ' + pp) + ' pole-pairs, so <b>' + 2 * pp + ' poles</b>.']) + QB.final(2 * pp + '\\ \\text{poles}') },
            { q: '(b) What is the highest speed a 50 Hz synchronous generator can run at, and with how many poles?', answers: [ans('nmax', '$n_{max}$', 3000, 'rpm'), ans('pmin', 'poles', 2, '')], working: QB.steps(['The fewest poles is 2 (' + $('p = 1') + '): ' + $('n_S = 60\\times50/1 = 3000') + ' rpm.']) + QB.final('3000\\ \\text{rpm, 2 poles}') },
            { q: '(c) How many poles would the same speed need on a 60 Hz grid?', answers: [ans('p60', 'poles', 2 * q60, '')], working: QB.steps([$('p = 60\\times60/' + n(nH) + ' = ' + n(q60))]) + QB.final(n(2 * q60) + '\\ \\text{poles}') }],
          notes: Math.abs(q60 - Math.round(q60)) > 1e-9 ? QB.callout('check', 'At 60 Hz the pole-pair number is not an integer, so this exact speed is impossible at 60 Hz: the nearest design would be ' + 2 * Math.round(q60) + ' poles.') : null,
          meta: { in: { nH: nH } } };
      }
      var f2, p3, ns3;
      r.retry(function () {
        f2 = r.pick([50, 60]); p3 = r.int(1, 12); ns3 = 60 * f2 / p3;
        var other = 60 * (f2 === 50 ? 60 : 50) / ns3;
        if (Math.abs(ns3 - Math.round(ns3)) > 1e-9) return null;
        return Math.abs(other - Math.round(other)) > 1e-6 ? true : null;
      });
      var oth = f2 === 50 ? 60 : 50;
      return { stem: 'An AC motor has a synchronous speed of ' + ns3 + ' rpm. Find its most likely supply frequency (50 or 60 Hz) and number of poles.', figure: null, given: [['$n_S$', ns3 + ' rpm']],
        parts: [{ q: 'Find the supply frequency and the number of poles.', answers: [ans('f', '$f$', f2, 'Hz'), ans('poles', 'poles', 2 * p3, '')],
          working: QB.steps(['Try both frequencies in ' + $('\\text{poles} = 120f/n_S') + ':', $(oth + '\\ \\text{Hz}: 120\\times' + oth + '/' + ns3 + ' = ' + n(120 * oth / ns3)) + ' (not an even integer)', $(f2 + '\\ \\text{Hz}: 120\\times' + f2 + '/' + ns3 + ' = ' + 2 * p3) + ' (even integer)']) + QB.final(f2 + '\\ \\text{Hz},\\ ' + 2 * p3 + '\\ \\text{poles}') }],
        meta: { in: { ns: ns3 } } };
    }
  });

  /* =====================================================================
   * MODULE 3 · basics.dcm   (pack M6 §1.5, Type D; PQ 5.7–5.12, 5.19, N2–N4)
   * ===================================================================== */
  function dcBase(r) {
    var V = r.pick([12, 24, 24, 48, 110, 220]);
    var nNL = r.pick([500, 1000, 1200, 1500, 2000, 3000]);
    var k = Number((V / wOf(nNL)).toPrecision(3));
    var R = Number((V / r.pick([10, 15, 20, 25, 30, 40]) / r.float(1.5, 3, 1)).toPrecision(2));
    return { V: V, k: k, R: R };
  }
  add({
    id: 'mach.basics.dcm.motor', course: 'mach', module: 'basics', topic: 'dcm',
    title: 'DC motor operating point (E = kω, τ = kI, V = E + IR)',
    difficulty: 1, marks: 6, tags: ['PQ 5.7', 'PQ 5.8', 'PQ 5.10', 'Type D'],
    variants: [{ id: 'givenI', label: 'Given current' }, { id: 'givenN', label: 'Given speed' }, { id: 'givenT', label: 'Given load torque' }, { id: 'stall', label: 'k and R from a stall test' }],
    gen: function (r, v) {
      var b = dcBase(r), V = b.V, k = b.k, R = b.R, IS = V / R;
      var I, E, w, nn, tau, given = [['$V$', V + ' V']], stem, steps = [], meta = { V: V };
      if (v === 'stall') {
        var Is = Math.round(IS * 10) / 10, ts = Number((k * Is).toPrecision(3));
        k = ts / Is; R = V / Is;
        var wNL = V / k;
        stem = 'A DC machine is connected to a ' + V + ' V supply. When it is held at zero speed (stall), a current of ' + pv(Is, 'A') + ' flows and the machine produces a torque of ' + pv(ts, 'N m') + '.';
        given.push(['$I_S$', pv(Is, 'A')], ['$\\tau_S$', pv(ts, 'N m')]);
        nn = Math.round(nOf(wNL) * r.float(0.6, 0.9, 2) / 10) * 10;
        w = wOf(nn); E = k * w; I = (V - E) / R; tau = k * I;
        meta.Is = Is; meta.ts = ts; meta.n = nn;
        var parts0 = [
          { q: '(a) Find the back-emf constant and the no-load speed.', answers: [ans('k', '$k$', k, 'V/(rad/s)'), ans('nNL', '$n_{NL}$', nOf(wNL), 'rpm')],
            working: QB.steps([$('k = \\dfrac{\\tau_S}{I_S} = \\dfrac{' + n(ts) + '}{' + n(Is) + '} = ' + n(k)) + ' Nm/A = V/(rad/s)', 'At no load ' + $('E = V') + ': ' + $('\\omega_{NL} = V/k = ' + V + '/' + n(k) + ' = ' + rads(wNL)) + ', i.e. ' + $(rpm(nOf(wNL)))]) + QB.final('k = ' + n(k) + ',\\ n_{NL} = ' + rpm(nOf(wNL))) },
          { q: '(b) Find the machine resistance.', answers: [ans('R', '$R$', R, 'Ω')], working: QB.steps(['At stall ' + $('E = 0') + ', so ' + $('R = V/I_S = ' + V + '/' + n(Is) + ' = ' + ohm(R))]) + QB.final('R = ' + ohm(R)) },
          { q: '(c) Find the current and the output power at ' + nn + ' rpm.', answers: [ans('I', '$I$', I, 'A'), ans('Pout', '$P_{out}$', E * I, 'W')],
            working: QB.steps([$('\\omega = 2\\pi\\times' + nn + '/60 = ' + rads(w)), $('E = k\\omega = ' + n(k) + '\\times' + n(w) + ' = ' + V_(E)), $('I = \\dfrac{V - E}{R} = \\dfrac{' + V + ' - ' + n(E) + '}{' + n(R) + '} = ' + A_(I)), $('P_{out} = EI = ' + n(E) + '\\times' + n(I) + ' = ' + W(E * I))]) + QB.final('I = ' + A_(I) + ',\\ P_{out} = ' + W(E * I)) }];
        return { stem: stem, figure: figDC({ V: V + ' V', R: 'R', k: 'k' }), given: given, parts: parts0, meta: { in: meta } };
      }
      given.push(['$k$', pv(k, 'V/(rad/s)')], ['$R$', pv(R, 'Ω')]);
      meta.k = k; meta.R = R;
      var parts = [];
      if (v === 'givenI') {
        I = Number((IS * r.float(0.05, 0.2, 2)).toPrecision(2)); meta.I = I;
        stem = 'A DC motor with back-emf constant ' + pv(k, 'V/(rad/s)') + ' and armature resistance ' + pv(R, 'Ω') + ' runs from a ' + V + ' V supply and draws ' + pv(I, 'A') + '.';
        given.push(['$I$', pv(I, 'A')]);
        tau = k * I; E = V - I * R; w = E / k;
        parts.push({ q: '(a) Find the torque, the back-emf and the speed in rpm.', answers: [ans('tau', '$\\tau$', tau, 'N·m'), ans('E', '$E$', E, 'V'), ans('n', '$n$', nOf(w), 'rpm')],
          working: QB.steps([$('\\tau = kI = ' + n(k) + '\\times' + n(I) + ' = ' + Nm(tau)), $('E = V - IR = ' + V + ' - ' + n(I) + '\\times' + n(R) + ' = ' + V_(E)), $('\\omega = E/k = ' + rads(w)) + ', so ' + $('n = 60\\omega/2\\pi = ' + rpm(nOf(w)))]) + QB.final('\\tau = ' + Nm(tau) + ',\\ n = ' + rpm(nOf(w))) });
      } else if (v === 'givenN') {
        var nNL0 = nOf(V / k); nn = Math.round(nNL0 * r.float(0.8, 0.95, 2) / 10) * 10; meta.n = nn;
        stem = 'A DC motor with back-emf constant ' + pv(k, 'V/(rad/s)') + ' and armature resistance ' + pv(R, 'Ω') + ' runs from a ' + V + ' V supply at ' + nn + ' rpm.';
        given.push(['$n$', nn + ' rpm']);
        w = wOf(nn); E = k * w; I = (V - E) / R; tau = k * I;
        parts.push({ q: '(a) Find the back-emf, the current and the torque.', answers: [ans('E', '$E$', E, 'V'), ans('I', '$I$', I, 'A'), ans('tau', '$\\tau$', tau, 'N·m')],
          working: QB.steps([$('\\omega = 2\\pi\\times' + nn + '/60 = ' + rads(w)) + ' (rad/s, never rpm, in ' + $('E = k\\omega') + ')', $('E = k\\omega = ' + n(k) + '\\times' + n(w) + ' = ' + V_(E)), $('I = \\dfrac{V - E}{R} = \\dfrac{' + V + ' - ' + n(E) + '}{' + n(R) + '} = ' + A_(I)), $('\\tau = kI = ' + Nm(tau))]) + QB.final('E = ' + V_(E) + ',\\ I = ' + A_(I) + ',\\ \\tau = ' + Nm(tau)) });
      } else {
        var tL = Number((k * IS * r.float(0.05, 0.2, 2)).toPrecision(2)); meta.tL = tL;
        stem = 'A DC motor with back-emf constant ' + pv(k, 'V/(rad/s)') + ' and armature resistance ' + pv(R, 'Ω') + ' runs from a ' + V + ' V supply and drives a load torque of ' + pv(tL, 'N m') + '.';
        given.push(['$\\tau_L$', pv(tL, 'N m')]);
        tau = tL; I = tL / k; E = V - I * R; w = E / k;
        parts.push({ q: '(a) Find the current, the back-emf and the speed in rpm.', answers: [ans('I', '$I$', I, 'A'), ans('E', '$E$', E, 'V'), ans('n', '$n$', nOf(w), 'rpm')],
          working: QB.steps([$('I = \\tau/k = ' + n(tL) + '/' + n(k) + ' = ' + A_(I)), $('E = V - IR = ' + V + ' - ' + n(I) + '\\times' + n(R) + ' = ' + V_(E)), $('\\omega = E/k = ' + rads(w)) + ', ' + $('n = ' + rpm(nOf(w)))]) + QB.final('I = ' + A_(I) + ',\\ n = ' + rpm(nOf(w))) });
      }
      var Pin = V * I, Pout = E * I, Pl = I * I * R, eta = Pout / Pin * 100;
      parts.push({ q: '(b) Find the input power, output power, copper loss and efficiency.', answers: [ans('Pin', '$P_{in}$', Pin, 'W'), ans('Pout', '$P_{out}$', Pout, 'W'), ans('Pl', '$P_{loss}$', Pl, 'W'), ans('eta', '$\\eta$', eta, '%')],
        working: QB.steps([$('P_{in} = VI = ' + V + '\\times' + n(I) + ' = ' + W(Pin)), $('P_{out} = EI = \\tau\\omega = ' + n(E) + '\\times' + n(I) + ' = ' + W(Pout)), $('P_{loss} = I^2R = ' + n(I) + '^2\\times' + n(R) + ' = ' + W(Pl)), $('\\eta = P_{out}/P_{in} = ' + pct(eta)) + '. Check: ' + $('E/V = ' + n(E) + '/' + V + ' = ' + pct(E / V * 100))]) + QB.final('\\eta = ' + pct(eta)) });
      var wNL2 = V / k;
      parts.push({ q: '(c) Find the no-load speed and the stall current and torque.', answers: [ans('nNL', '$n_{NL}$', nOf(wNL2), 'rpm'), ans('IS', '$I_S$', IS, 'A'), ans('tS', '$\\tau_S$', k * IS, 'N·m')],
        working: QB.steps(['No load: ' + $('I = 0,\\ E = V') + ', ' + $('\\omega_{NL} = V/k = ' + rads(wNL2)) + ' = ' + $(rpm(nOf(wNL2))), 'Stall: ' + $('\\omega = 0,\\ E = 0') + ', ' + $('I_S = V/R = ' + A_(IS)) + ', ' + $('\\tau_S = kI_S = ' + Nm(k * IS))]) + QB.final('n_{NL} = ' + rpm(nOf(wNL2)) + ',\\ I_S = ' + A_(IS) + ',\\ \\tau_S = ' + Nm(k * IS)) });
      return { stem: stem, figure: figDC({ V: V + ' V', R: pv(R, 'Ω'), k: 'k = ' + pv(k, 'V/(rad/s)') }), given: given, parts: parts,
        notes: QB.callout('trap', 'Use rad/s in $E = k\\omega$, and $P_{in} = VI$ (not $EI$).'), meta: { in: meta } };
    }
  });

  add({
    id: 'mach.basics.dcm.gen', course: 'mach', module: 'basics', topic: 'dcm',
    title: 'DC generator charging a battery',
    difficulty: 2, marks: 6, tags: ['PQ 5.19', 'N4', 'Lecture 5.3.3'],
    variants: [{ id: 'givenI', label: 'Given charging current' }, { id: 'speed-gen', label: 'Given speed above n_NL (generating)' }, { id: 'speed-motor', label: 'Given speed below n_NL (motoring, no diode)' }, { id: 'oc', label: 'k from an open-circuit test' }],
    gen: function (r, v) {
      var V = r.pick([12, 12.6, 14.6, 24, 48]), k = r.pick([0.1, 0.15, 0.2, 0.24, 0.3, 0.5, 0.6, 0.8]), R = r.pick([0.1, 0.2, 0.25, 0.4, 0.5, 0.8]);
      var wNL = V / k, nNL = nOf(wNL), meta = { V: V, k: k, R: R }, parts = [], stem, given;
      var noteDiode = QB.callout('tip', 'With $I$ out of the machine: $E = V + IR$ and $\\eta = V/E$. Without a series diode, a slow turbine ($E < V$) is driven by the battery as a motor (a fan).');
      if (v === 'oc') {
        var noc = r.pick([100, 150, 200, 250, 300, 500]), Eoc = Number((k * wOf(noc)).toPrecision(3));
        k = Eoc / wOf(noc); meta = { V: V, R: R, noc: noc, Eoc: Eoc }; wNL = V / k; nNL = nOf(wNL);
        var Ic = r.pick([2, 4, 5, 8, 10]); meta.Ic = Ic;
        var Ec = V + Ic * R, nc = nOf(Ec / k);
        stem = 'A DC machine is driven by a small wind turbine. At ' + noc + ' rpm the measured open-circuit voltage is ' + pv(Eoc, 'V') + '. The armature resistance is ' + pv(R, 'Ω') + '. The machine is connected to a battery that acts as a constant ' + V + ' V source.';
        given = [['$E_{OC}$', pv(Eoc, 'V') + ' at ' + noc + ' rpm'], ['$R$', pv(R, 'Ω')], ['$V$', V + ' V']];
        parts.push({ q: '(a) Find the back-emf constant.', answers: [ans('k', '$k$', k, 'V/(rad/s)')], working: QB.steps([$('k = \\dfrac{E}{\\omega} = \\dfrac{' + n(Eoc) + '}{2\\pi\\times' + noc + '/60} = \\dfrac{' + n(Eoc) + '}{' + n(wOf(noc)) + '} = ' + n(k))]) + QB.final('k = ' + n(k) + '\\ \\text{V/(rad/s)}') });
        parts.push({ q: '(b) At what speed does the induced voltage just equal the battery voltage? What is the current then?', answers: [ans('nNL', '$n$', nNL, 'rpm')], working: QB.steps([$('E = V = ' + V) + ' V: ' + $('\\omega = V/k = ' + rads(wNL)) + ' = ' + $(rpm(nNL)), 'With ' + $('E = V') + ' the current is 0 A.']) + QB.final('n = ' + rpm(nNL) + ',\\ I = 0') });
        parts.push({ q: '(c) At what speed is the charging current ' + Ic + ' A? Find the efficiency there.', answers: [ans('nc', '$n$', nc, 'rpm'), ans('eta', '$\\eta$', V / Ec * 100, '%')], working: QB.steps(['Generating, current out: ' + $('E = V + IR = ' + V + ' + ' + Ic + '\\times' + n(R) + ' = ' + V_(Ec)), $('\\omega = E/k = ' + rads(Ec / k)) + ' = ' + $(rpm(nc)), $('\\eta = V/E = ' + V + '/' + n(Ec) + ' = ' + pct(V / Ec * 100))]) + QB.final('n = ' + rpm(nc) + ',\\ \\eta = ' + pct(V / Ec * 100)) });
        return { stem: stem, figure: figDC({ V: V + ' V', R: pv(R, 'Ω'), k: 'k', gen: true, batt: true }), given: given, parts: parts, notes: noteDiode, meta: { in: meta } };
      }
      given = [['$k$', pv(k, 'V/(rad/s)')], ['$R$', pv(R, 'Ω')], ['$V$', V + ' V (battery)']];
      stem = 'A DC machine with $k = ' + n(k) + '$ V/(rad/s) and $R = ' + n(R) + '\\ \\Omega$ is driven by a wind turbine and connected directly to a ' + V + ' V battery.';
      if (v === 'givenI') {
        var I = r.pick([1, 2, 2.5, 4, 5, 8, 10]); meta.I = I;
        var E = V + I * R, w = E / k, nn = nOf(w);
        parts.push({ q: '(a) Find the turbine speed at which the charging current just becomes zero.', answers: [ans('nNL', '$n$', nNL, 'rpm')], working: QB.steps([$('I = 0') + ' when ' + $('E = V') + ': ' + $('\\omega = V/k = ' + V + '/' + n(k) + ' = ' + rads(wNL)) + ' = ' + $(rpm(nNL))]) + QB.final('n = ' + rpm(nNL)) });
        parts.push({ q: '(b) Find the speed needed to charge at ' + I + ' A, the shaft torque, the mechanical input power, the electrical power into the battery and the efficiency.', answers: [ans('n', '$n$', nn, 'rpm'), ans('tau', '$\\tau$', k * I, 'N·m'), ans('PM', '$P_M$', E * I, 'W'), ans('PE', '$P_E$', V * I, 'W'), ans('eta', '$\\eta$', V / E * 100, '%')],
          working: QB.steps(['The current flows <b>out</b> of the machine, so ' + $('E = V + IR = ' + V + ' + ' + I + '\\times' + n(R) + ' = ' + V_(E)), $('\\omega = E/k = ' + rads(w)) + ' = ' + $(rpm(nn)) + ' (above ' + $('n_{NL} = ' + rpm(nNL)) + ', so generating)', $('\\tau = kI = ' + Nm(k * I)) + ' (input torque)', $('P_M = EI = ' + W(E * I)) + ', ' + $('P_E = VI = ' + W(V * I)), $('\\eta = V/E = ' + pct(V / E * 100))]) + QB.final('n = ' + rpm(nn) + ',\\ \\eta = ' + pct(V / E * 100)) });
      } else {
        var nn2 = v === 'speed-gen' ? Math.round(nNL * r.float(1.05, 1.3, 2)) : Math.round(nNL * r.float(0.7, 0.95, 2));
        meta.n = nn2;
        var w2 = wOf(nn2), E2 = k * w2, I2 = (E2 - V) / R;   // positive = out of machine (charging)
        var gen = I2 > 0;
        parts.push({ q: '(a) The turbine turns at ' + nn2 + ' rpm. Find the induced voltage.', answers: [ans('E', '$E$', E2, 'V')], working: QB.steps([$('\\omega = 2\\pi\\times' + nn2 + '/60 = ' + rads(w2)), $('E = k\\omega = ' + n(k) + '\\times' + n(w2) + ' = ' + V_(E2))]) + QB.final('E = ' + V_(E2)) });
        parts.push({ q: '(b) Find the magnitude of the current and say which way it flows. Find the torque and say whether the machine is motoring or generating.', answers: [ans('I', '$|I|$', Math.abs(I2), 'A'), ans('tau', '$|\\tau|$', k * Math.abs(I2), 'N·m')],
          working: QB.steps(gen ? [$('E = ' + n(E2) + ' > V = ' + V) + ', so current flows <b>out</b> of the machine into the battery (charging).', $('I = \\dfrac{E - V}{R} = \\dfrac{' + n(E2) + ' - ' + V + '}{' + n(R) + '} = ' + A_(I2)), $('\\tau = kI = ' + Nm(k * I2)) + ' of input (driving) torque: <b>generating</b>. ' + $('\\eta = V/E = ' + pct(V / E2 * 100))]
            : [$('E = ' + n(E2) + ' < V = ' + V) + ', so current flows <b>from the battery into</b> the machine.', $('I = \\dfrac{V - E}{R} = \\dfrac{' + V + ' - ' + n(E2) + '}{' + n(R) + '} = ' + A_(-I2)), $('\\tau = kI = ' + Nm(-k * I2)) + ' of <b>motoring</b> torque: the battery discharges (' + $(W(-V * I2)) + ') and spins the turbine as a fan. A series diode would block this.'])
            + QB.final('|I| = ' + A_(Math.abs(I2)) + ',\\ |\\tau| = ' + Nm(k * Math.abs(I2)) + ',\\ \\text{' + (gen ? 'generating' : 'motoring') + '}') });
      }
      return { stem: stem, figure: figDC({ V: V + ' V', R: pv(R, 'Ω'), k: 'k = ' + pv(k, 'V/(rad/s)'), gen: true, batt: true }), given: given, parts: parts, notes: noteDiode, meta: { in: meta } };
    }
  });

  add({
    id: 'mach.basics.dcm.shunt', course: 'mach', module: 'basics', topic: 'dcm',
    title: 'Shunt and separately excited DC machines',
    difficulty: 2, marks: 6, tags: ['Lecture 5.4', 'wound field'],
    variants: [{ id: 'shunt-motor', label: 'Shunt motor' }, { id: 'shunt-gen', label: 'Shunt generator' }, { id: 'sep-motor', label: 'Separately excited motor, field weakening' }, { id: 'sep-gen', label: 'Separately excited generator on a resistive load' }],
    gen: function (r, v) {
      var V = r.pick([110, 220, 220, 240, 440]), Ra = Number((V / r.pick([200, 300, 400, 500])).toPrecision(2)), RF = Number((V / r.pick([0.8, 1, 1.5, 2, 2.5])).toPrecision(3));
      var k = Number((V / wOf(r.pick([1000, 1200, 1500, 1800]))).toPrecision(3));
      var parts = [], given, stem, meta = { V: V, Ra: Ra };
      var note = QB.callout('tip', 'Wound-field machines are described in Lecture 5.4 (marked not examinable). The same model applies: $E = k\\omega$, $\\tau = kI_a$, $V = E + I_aR_a$, with $k \\propto I_F$.');
      if (v === 'shunt-motor' || v === 'shunt-gen') {
        var IF = V / RF, mot = v === 'shunt-motor';
        var IL = Math.round(r.float(15, 60, 0) * V / 220);
        if (IL < 5) IL = 5;
        meta.RF = RF; meta.k = k; meta.IL = IL;
        var Ia = mot ? IL - IF : IL + IF, E = mot ? V - Ia * Ra : V + Ia * Ra, w = E / k, tau = k * Ia;
        stem = 'A ' + V + ' V shunt-wound DC ' + (mot ? 'motor draws a line current of ' + IL + ' A from the supply' : 'generator delivers ' + IL + ' A to a load at a terminal voltage of ' + V + ' V') + '. The armature resistance is ' + pv(Ra, 'Ω') + ', the shunt field resistance is ' + pv(RF, 'Ω') + ', and at this field current $k = ' + n(k) + '$ V/(rad/s).';
        given = [['$V$', V + ' V'], ['$I_L$', IL + ' A'], ['$R_a$', pv(Ra, 'Ω')], ['$R_F$', pv(RF, 'Ω')], ['$k$', pv(k, 'V/(rad/s)')]];
        parts.push({ q: '(a) Find the field current and the armature current.', answers: [ans('IF', '$I_F$', IF, 'A'), ans('Ia', '$I_a$', Ia, 'A')],
          working: QB.steps(['The field sits directly across the terminals: ' + $('I_F = V/R_F = ' + V + '/' + n(RF) + ' = ' + A_(IF)), mot ? 'Motor: the line current splits into field and armature: ' + $('I_a = I_L - I_F = ' + IL + ' - ' + n(IF) + ' = ' + A_(Ia)) : 'Generator: the armature feeds both the load and the field: ' + $('I_a = I_L + I_F = ' + IL + ' + ' + n(IF) + ' = ' + A_(Ia))]) + QB.final('I_F = ' + A_(IF) + ',\\ I_a = ' + A_(Ia)) });
        parts.push({ q: '(b) Find the induced voltage, the speed and the ' + (mot ? 'developed' : 'input (driving)') + ' torque.', answers: [ans('E', '$E$', E, 'V'), ans('n', '$n$', nOf(w), 'rpm'), ans('tau', '$\\tau$', tau, 'N·m')],
          working: QB.steps([mot ? $('E = V - I_aR_a = ' + V + ' - ' + n(Ia) + '\\times' + n(Ra) + ' = ' + V_(E)) : $('E = V + I_aR_a = ' + V + ' + ' + n(Ia) + '\\times' + n(Ra) + ' = ' + V_(E)), $('\\omega = E/k = ' + rads(w)) + ', ' + $('n = ' + rpm(nOf(w))), $('\\tau = kI_a = ' + n(k) + '\\times' + n(Ia) + ' = ' + Nm(tau))]) + QB.final('E = ' + V_(E) + ',\\ n = ' + rpm(nOf(w)) + ',\\ \\tau = ' + Nm(tau)) });
        var Pin = mot ? V * IL : E * Ia, Pout = mot ? E * Ia : V * IL, Pa = Ia * Ia * Ra, Pf = V * IF;
        parts.push({ q: '(c) Find the armature copper loss, the field loss and the efficiency (ignore rotational losses).', answers: [ans('Pa', '$P_{Cu,a}$', Pa, 'W'), ans('Pf', '$P_F$', Pf, 'W'), ans('eta', '$\\eta$', Pout / Pin * 100, '%')],
          working: QB.steps([$('P_{Cu,a} = I_a^2R_a = ' + n(Ia) + '^2\\times' + n(Ra) + ' = ' + W(Pa)), $('P_F = VI_F = ' + V + '\\times' + n(IF) + ' = ' + W(Pf)), mot ? $('P_{in} = VI_L = ' + W(Pin) + ',\\ P_{out} = EI_a = ' + W(Pout)) : $('P_{in} = EI_a = ' + W(Pin) + '\\ \\text{(shaft)},\\ P_{out} = VI_L = ' + W(Pout)), $('\\eta = ' + pct(Pout / Pin * 100)) + '. Check: ' + $('P_{in} - P_{out} = ' + W(Pin - Pout) + ' = P_{Cu,a} + P_F')]) + QB.final('\\eta = ' + pct(Pout / Pin * 100)) });
        return { stem: stem, figure: figDC({ V: V + ' V', R: pv(Ra, 'Ω'), k: 'k', RF: pv(RF, 'Ω'), gen: !mot, kind: 'shunt' }), given: given, parts: parts, notes: note, meta: { in: meta } };
      }
      if (v === 'sep-motor') {
        var tL = Number((k * r.float(10, 40, 0) * V / 220).toPrecision(3)), m = r.pick([0.7, 0.75, 0.8, 0.85, 0.9]);
        meta.k = k; meta.tL = tL; meta.m = m;
        var I1 = tL / k, E1 = V - I1 * Ra, n1 = nOf(E1 / k), k2 = m * k, I2 = tL / k2, E2 = V - I2 * Ra, n2 = nOf(E2 / k2);
        stem = 'A separately excited DC motor runs from a ' + V + ' V armature supply, with $R_a = ' + n(Ra) + '\\ \\Omega$. At rated field current $k = ' + n(k) + '$ V/(rad/s). It drives a constant load torque of ' + pv(tL, 'N m') + '.';
        given = [['$V$', V + ' V'], ['$R_a$', pv(Ra, 'Ω')], ['$k$ (rated field)', pv(k, 'V/(rad/s)')], ['$\\tau_L$', pv(tL, 'N m')]];
        parts.push({ q: '(a) Find the armature current and speed at rated field.', answers: [ans('I1', '$I_a$', I1, 'A'), ans('n1', '$n$', n1, 'rpm')], working: QB.steps([$('I_a = \\tau/k = ' + n(tL) + '/' + n(k) + ' = ' + A_(I1)), $('E = V - I_aR_a = ' + V_(E1)), $('n = \\dfrac{60}{2\\pi}\\dfrac{E}{k} = ' + rpm(n1))]) + QB.final('I_a = ' + A_(I1) + ',\\ n = ' + rpm(n1)) });
        parts.push({ q: '(b) The field current is reduced to ' + m * 100 + ' % of rated (no saturation, so $k \\propto I_F$). Find the new armature current and speed for the same load torque.', answers: [ans('I2', "$I_a'$", I2, 'A'), ans('n2', "$n'$", n2, 'rpm')],
          working: QB.steps([$("k' = " + m + '\\times' + n(k) + ' = ' + n(k2)), 'Same torque needs more current: ' + $("I_a' = \\tau/k' = " + A_(I2)), $("E' = V - I_a'R_a = " + V_(E2)), $("n' = \\dfrac{60}{2\\pi}\\dfrac{E'}{k'} = " + rpm(n2)) + ': weakening the field <b>raises</b> the speed (' + $('\\omega \\approx V/k \\propto 1/I_F') + ').']) + QB.final("I_a' = " + A_(I2) + ",\\ n' = " + rpm(n2)) });
        return { stem: stem, figure: figDC({ V: V + ' V', R: pv(Ra, 'Ω'), k: 'k ∝ I_F', kind: 'separate' }), given: given, parts: parts, notes: note, meta: { in: meta } };
      }
      var nG = r.pick([1000, 1200, 1500, 1800]), mF = r.pick([0.6, 0.8, 0.9, 1, 1.1]), RL = Number((V / r.pick([10, 20, 30, 40])).toPrecision(2));
      meta.k = k; meta.n = nG; meta.m = mF; meta.RL = RL;
      var kk = mF * k, EG = kk * wOf(nG), IG = EG / (Ra + RL), VG = IG * RL;
      stem = 'A separately excited DC generator has $R_a = ' + n(Ra) + '\\ \\Omega$ and $k = ' + n(k) + '$ V/(rad/s) at rated field current. It is driven at ' + nG + ' rpm with the field current at ' + mF * 100 + ' % of rated, and supplies a ' + pv(RL, 'Ω') + ' resistive load.';
      given = [['$R_a$', pv(Ra, 'Ω')], ['$k$ (rated field)', pv(k, 'V/(rad/s)')], ['$n$', nG + ' rpm'], ['$I_F$', mF * 100 + ' % of rated'], ['$R_L$', pv(RL, 'Ω')]];
      parts.push({ q: '(a) Find the induced voltage.', answers: [ans('E', '$E$', EG, 'V')], working: QB.steps([$("k' = " + mF + '\\times' + n(k) + ' = ' + n(kk)) + ' (' + $('k \\propto I_F') + ')', $("E = k'\\omega = " + n(kk) + '\\times' + n(wOf(nG)) + ' = ' + V_(EG))]) + QB.final('E = ' + V_(EG)) });
      parts.push({ q: '(b) Find the load current, terminal voltage, output power, driving torque and efficiency.', answers: [ans('I', '$I$', IG, 'A'), ans('V', '$V$', VG, 'V'), ans('P', '$P_{out}$', VG * IG, 'W'), ans('tau', '$\\tau$', kk * IG, 'N·m'), ans('eta', '$\\eta$', VG / EG * 100, '%')],
        working: QB.steps([$('I = \\dfrac{E}{R_a + R_L} = \\dfrac{' + n(EG) + '}{' + n(Ra) + ' + ' + n(RL) + '} = ' + A_(IG)), $('V = IR_L = ' + V_(VG)) + ' (generator: ' + $('V = E - IR_a') + ')', $('P_{out} = VI = ' + W(VG * IG)), $("\\tau = k'I = " + Nm(kk * IG)), $('\\eta = V/E = ' + pct(VG / EG * 100))]) + QB.final('I = ' + A_(IG) + ',\\ V = ' + V_(VG) + ',\\ \\eta = ' + pct(VG / EG * 100)) });
      return { stem: stem, figure: figDC({ V: 'V', R: pv(Ra, 'Ω'), k: 'k ∝ I_F', gen: true, kind: 'separate' }), given: given, parts: parts, notes: note, meta: { in: meta } };
    }
  });

  add({
    id: 'mach.basics.dcm.points', course: 'mach', module: 'basics', topic: 'dcm',
    title: 'DC motor: no-load, rated and stall points, maximum power and voltage control',
    difficulty: 2, marks: 6, tags: ['N2', 'N3', 'PQ 5.11', 'PQ 5.12'],
    variants: [{ id: 'givenI', label: 'Given no-load speed and rated current' }, { id: 'givenNR', label: 'Given no-load and rated speeds' }, { id: 'halfV', label: 'Reduced supply with a constant-torque load' }],
    gen: function (r, v) {
      var V = r.pick([12, 20, 24, 48, 96]), R = r.pick([0.1, 0.2, 0.25, 0.4, 0.5]), nNL = r.pick([1500, 2000, 3000, 4000, 6000, 10000]);
      var wNL = wOf(nNL), k = V / wNL, IS = V / R, parts = [], meta = { V: V, R: R, nNL: nNL };
      var IR, ER, nR;
      if (v === 'givenNR') { nR = nNL - r.nice(0.1 * nNL, 0.2 * nNL, nNL >= 4000 ? 500 : 100); ER = V * nR / nNL; IR = (V - ER) / R; meta.nR = nR; }
      else { IR = Math.round(IS * r.float(0.04, 0.1, 3)); if (IR < 1) IR = 1; ER = V - IR * R; nR = nOf(ER / k); meta.IR = IR; }
      var tR = k * IR;
      var stem = 'A PM DC motor has a rated voltage of ' + V + ' V, an armature resistance of ' + pv(R, 'Ω') + ' and a no-load speed of ' + nNL + ' rpm at rated voltage' + (v === 'givenNR' ? ', with a rated speed of ' + nR + ' rpm.' : ', with a rated current of ' + IR + ' A.');
      var given = [['$V$', V + ' V'], ['$R$', pv(R, 'Ω')], ['$n_{NL}$', nNL + ' rpm'], v === 'givenNR' ? ['$n_R$', nR + ' rpm'] : ['$I_R$', IR + ' A']];
      parts.push({ q: '(a) Find the back-emf constant $k$.', answers: [ans('k', '$k$', k, 'V/(rad/s)')], working: QB.steps([$('\\omega_{NL} = 2\\pi\\times' + nNL + '/60 = ' + rads(wNL)), 'At no load ' + $('E = V') + ', so ' + $('k = V/\\omega_{NL} = ' + V + '/' + n(wNL) + ' = ' + n(k))]) + QB.final('k = ' + n(k) + '\\ \\text{V/(rad/s)}') });
      parts.push({ q: '(b) Find the rated ' + (v === 'givenNR' ? 'current, ' : 'speed, ') + 'torque and efficiency.', answers: [v === 'givenNR' ? ans('IR', '$I_R$', IR, 'A') : ans('nR', '$n_R$', nR, 'rpm'), ans('tR', '$\\tau_R$', tR, 'N·m'), ans('eta', '$\\eta_R$', ER / V * 100, '%')],
        working: QB.steps(v === 'givenNR' ? [$('E_R = V\\dfrac{n_R}{n_{NL}} = ' + V + '\\times\\dfrac{' + nR + '}{' + nNL + '} = ' + V_(ER)), $('I_R = \\dfrac{V - E_R}{R} = ' + A_(IR)), $('\\tau_R = kI_R = ' + Nm(tR)), $('\\eta = E/V = ' + pct(ER / V * 100))]
          : [$('E_R = V - I_RR = ' + V + ' - ' + IR + '\\times' + n(R) + ' = ' + V_(ER)), $('n_R = \\dfrac{60}{2\\pi}\\dfrac{E_R}{k} = ' + rpm(nR)), $('\\tau_R = kI_R = ' + Nm(tR)), $('\\eta = E/V = ' + pct(ER / V * 100))]) + QB.final('\\tau_R = ' + Nm(tR) + ',\\ \\eta = ' + pct(ER / V * 100)) });
      if (v === 'halfV') {
        var Vn = r.pick([0.5, 0.6, 0.75]) * V, En = Vn - IR * R, nn = nOf(En / k);
        var nt = r.nice(0.25 * nNL, 0.45 * nNL, 50), Vt = k * wOf(nt) + IR * R;
        meta.Vn = Vn; meta.nt = nt;
        parts.push({ q: '(c) The motor drives a constant load torque equal to its rated torque. The supply is reduced to ' + n(Vn) + ' V. Find the new no-load speed, the operating speed and the efficiency.', answers: [ans('nNLn', '$n_{NL}$', nNL * Vn / V, 'rpm'), ans('nn', '$n$', nn, 'rpm'), ans('etan', '$\\eta$', En / Vn * 100, '%')],
          working: QB.steps([$('n_{NL} \\propto V') + ': ' + $('n_{NL} = ' + nNL + '\\times' + n(Vn) + '/' + V + ' = ' + rpm(nNL * Vn / V)), 'Rated torque means ' + $('I = I_R = ' + n(IR)) + ' A still: ' + $('E = ' + n(Vn) + ' - ' + n(IR) + '\\times' + n(R) + ' = ' + V_(En)), $('n = \\dfrac{60}{2\\pi}\\dfrac{E}{k} = ' + rpm(nn)) + ' (the drop is unchanged)', $('\\eta = E/V = ' + pct(En / Vn * 100))]) + QB.final('n = ' + rpm(nn) + ',\\ \\eta = ' + pct(En / Vn * 100)) });
        parts.push({ q: '(d) What supply voltage gives ' + nt + ' rpm with this load?', answers: [ans('Vt', '$V$', Vt, 'V')], working: QB.steps([$('E = k\\omega = ' + n(k) + '\\times' + n(wOf(nt)) + ' = ' + V_(k * wOf(nt))), $('V = E + I_RR = ' + V_(Vt))]) + QB.final('V = ' + V_(Vt)) });
      } else {
        parts.push({ q: '(c) Find the stall current and stall torque, and the stall torque as a multiple of rated torque.', answers: [ans('IS', '$I_S$', IS, 'A'), ans('tS', '$\\tau_S$', k * IS, 'N·m'), ans('ratio', '$\\tau_S/\\tau_R$', IS / IR, '')],
          working: QB.steps(['Stall: ' + $('E = 0') + ', ' + $('I_S = V/R = ' + A_(IS)), $('\\tau_S = kI_S = ' + Nm(k * IS)), $('\\tau_S/\\tau_R = I_S/I_R = ' + n(IS / IR))]) + QB.final('I_S = ' + A_(IS) + ',\\ \\tau_S = ' + Nm(k * IS)) });
        parts.push({ q: '(d) Find the maximum possible output power and the speed at which it occurs.', answers: [ans('Pmax', '$P_{max}$', V * V / (4 * R), 'W'), ans('nP', '$n$', nNL / 2, 'rpm')],
          working: QB.steps(['$P = EI$ is zero at no load and at stall; it peaks at ' + $('n_{NL}/2') + ', where ' + $('E = V/2') + ' and ' + $('I = I_S/2') + '.', $('P_{max} = \\dfrac{V}{2}\\cdot\\dfrac{I_S}{2} = \\dfrac{V^2}{4R} = ' + W(V * V / (4 * R))) + ' at ' + $(rpm(nNL / 2)), 'Efficiency there is only 50 % and the current is ' + n(IS / 2 / IR) + ' times rated: the motor would overheat.']) + QB.final('P_{max} = ' + W(V * V / (4 * R)) + '\\ \\text{at}\\ ' + rpm(nNL / 2)) });
      }
      return { stem: stem, figure: figDC({ V: V + ' V', R: pv(R, 'Ω'), k: 'k' }), given: given, parts: parts, meta: { in: meta } };
    }
  });

  /* =====================================================================
   * MODULE 3 · basics.rmf   (pack M6 §1.6, Type E; PQ 6.4–6.9, N6)
   * ===================================================================== */
  add({
    id: 'mach.basics.rmf.field', course: 'mach', module: 'basics', topic: 'rmf',
    title: 'Resultant stator field from the three phase currents',
    difficulty: 2, marks: 4, tags: ['Lecture 6', 'PQ 6.6'],
    variants: [{ id: 'abc', label: 'Balanced currents, sequence abc' }, { id: 'acb', label: 'Balanced currents, sequence acb' }, { id: 'step', label: 'Six-step (two phases conducting)' }],
    gen: function (r, v) {
      var N = r.pick([20, 50, 80, 100, 120, 200]), Im = r.pick([2, 4, 5, 8, 10, 12, 15]);
      var axes = [0, 120, 240], i = [], th = null, state = null;
      var labs = ['a', 'b', 'c'];
      if (v === 'step') {
        var states = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];
        state = r.pick(states); i = state.map(function (s) { return s * Im; });
      } else {
        th = r.pick([15, 30, 40, 45, 60, 75, 100, 135, 150, 200, 225, 300]);
        var off = v === 'abc' ? [0, -120, -240] : [0, -240, -120];
        i = off.map(function (o) { return Im * Math.cos((th + o) * PI / 180); });
      }
      var Fx = 0, Fy = 0;
      for (var k2 = 0; k2 < 3; k2++) { Fx += N * i[k2] * Math.cos(axes[k2] * PI / 180); Fy += N * i[k2] * Math.sin(axes[k2] * PI / 180); }
      var Fm = Math.hypot(Fx, Fy), Fa = Math.atan2(Fy, Fx) * 180 / PI;
      var stem = 'A 2-pole three-phase stator has phase windings of ' + N + ' effective turns each. Take the magnetic axes of phases a, b and c at 0°, 120° and 240° (anticlockwise). Positive current in a phase gives MMF along its own axis; negative current reverses it. ';
      stem += v === 'step' ? 'At one instant the currents are ' + $('i_a = ' + n(i[0]) + '\\ \\text{A},\\ i_b = ' + n(i[1]) + '\\ \\text{A},\\ i_c = ' + n(i[2]) + '\\ \\text{A}') + ' (six-step drive).'
        : 'The phase currents are balanced with peak ' + Im + ' A and phase sequence <b>' + v + '</b>: ' + (v === 'abc' ? $('i_a = I_m\\cos\\omega t,\\ i_b = I_m\\cos(\\omega t - 120^\\circ),\\ i_c = I_m\\cos(\\omega t - 240^\\circ)') : $('i_a = I_m\\cos\\omega t,\\ i_b = I_m\\cos(\\omega t - 240^\\circ),\\ i_c = I_m\\cos(\\omega t - 120^\\circ)')) + '. Consider the instant ' + $('\\omega t = ' + th + '^\\circ') + '.';
      var alt = [Fa - 360, Fa + 360];
      var parts = [];
      if (v !== 'step') parts.push({ q: '(a) Find the three phase currents at this instant.', answers: [ans('ia', '$i_a$', i[0], 'A', { abs: 0.01 }), ans('ib', '$i_b$', i[1], 'A', { abs: 0.01 }), ans('ic', '$i_c$', i[2], 'A', { abs: 0.01 })],
        working: QB.steps(labs.map(function (L, j) { return $('i_' + L + ' = ' + Im + '\\cos(' + th + '^\\circ' + (j === 0 ? '' : (v === 'abc' ? (j === 1 ? ' - 120^\\circ' : ' - 240^\\circ') : (j === 1 ? ' - 240^\\circ' : ' - 120^\\circ'))) + ') = ' + n(i[j]) + '\\ \\text{A}'); })) + QB.final('i_a = ' + n(i[0]) + ',\\ i_b = ' + n(i[1]) + ',\\ i_c = ' + n(i[2]) + '\\ \\text{A}') });
      parts.push({ q: (v === 'step' ? '(a)' : '(b)') + ' Find the magnitude (ampere-turns) and direction of the resultant MMF.', answers: [ans('Fm', '$|F|$', Fm, 'At'), ans('Fa', '$\\angle F$', Fa, '°', { alt: alt })],
        working: QB.steps([
          'Add the three MMF vectors ' + $('N i_k\\angle\\theta_k') + ':',
          $('F_x = N\\sum i_k\\cos\\theta_k = ' + N + '(' + n(i[0]) + '\\cos0^\\circ + ' + sgn(i[1]) + '\\cos120^\\circ + ' + sgn(i[2]) + '\\cos240^\\circ) = ' + n(Fx)),
          $('F_y = N\\sum i_k\\sin\\theta_k = ' + N + '(' + sgn(i[1]) + '\\sin120^\\circ + ' + sgn(i[2]) + '\\sin240^\\circ) = ' + n(Fy)),
          $('|F| = \\sqrt{F_x^2 + F_y^2} = ' + U(Fm, 'At')) + ', ' + $('\\angle F = ' + ang(Fa)),
          v === 'step' ? 'Two phases carry equal and opposite current, so ' + $('|F| = \\sqrt3 NI') + ' (' + n(SQ3 * N * Im) + ' At). Stepping through the six states turns the field in 60° steps.'
            : 'Check: a balanced set gives ' + $('|F| = 1.5NI_m = ' + n(1.5 * N * Im)) + ' At at every instant, at angle ' + $((v === 'abc' ? '+' : '-') + '\\omega t') + '. Sequence <b>' + v + '</b> turns the field ' + (v === 'abc' ? 'anticlockwise' : 'clockwise') + '.'
        ]) + QB.final('|F| = ' + U(Fm, 'At') + ',\\ \\angle F = ' + ang(Fa)) });
      return { stem: stem, figure: plot('phasors', [[{ re: N * i[0], im: 0, label: 'F_a' }, { re: N * i[1] * Math.cos(2 * PI / 3), im: N * i[1] * Math.sin(2 * PI / 3), label: 'F_b' }, { re: N * i[2] * Math.cos(4 * PI / 3), im: N * i[2] * Math.sin(4 * PI / 3), label: 'F_c' }], { title: 'Phase MMF vectors' }]),
        given: [['$N$', String(N)], v === 'step' ? ['$I$', Im + ' A'] : ['$I_m$', Im + ' A']], parts: parts, meta: { in: { N: N, Im: Im, th: th, seq: v, state: state } } };
    }
  });

  add({
    id: 'mach.basics.rmf.speed', course: 'mach', module: 'basics', topic: 'rmf',
    title: 'Rotating-field speed, pole pairs and reversing the rotation',
    difficulty: 1, marks: 4, tags: ['PQ 6.5', 'PQ 6.7', 'N6'],
    variants: [{ id: 'swap', label: 'Two supply leads swapped' }, { id: 'cyclic', label: 'Cyclic relabelling of the leads' }, { id: 'freq', label: 'Supply frequency changed' }],
    gen: function (r, v) {
      var poles = r.pick([2, 4, 6, 8, 10, 12]), p = poles / 2, f = r.pick([50, 60]), ns = 60 * f / p;
      var parts = [], meta = { poles: poles, f: f };
      parts.push({ q: '(a) Find the speed of the rotating field in rpm and in rad/s, and the number of electrical cycles per mechanical revolution of the field.', answers: [ans('ns', '$n_S$', ns, 'rpm'), ans('ws', '$\\omega_S$', wOf(ns), 'rad/s'), ans('cyc', 'cycles/rev', p, '')],
        working: QB.steps([$('p = ' + poles + '/2 = ' + p) + ' pole-pairs', $('n_S = \\dfrac{60f}{p} = \\dfrac{60\\times' + f + '}{' + p + '} = ' + rpm(ns)) + ', ' + $('\\omega_S = 2\\pi n_S/60 = ' + rads(wOf(ns))), 'One electrical cycle moves the field by one pole-pair (' + $('1/p') + ' of a revolution, ' + n(360 / p) + '° mechanical), so there are ' + $('p = ' + p) + ' cycles per revolution.']) + QB.final('n_S = ' + rpm(ns) + ',\\ ' + p + '\\ \\text{cycles/rev}') });
      var stem = 'A ' + poles + '-pole three-phase induction motor is connected with supply phases a, b, c to terminals A, B, C on a ' + f + ' Hz supply and runs clockwise.';
      if (v === 'freq') {
        var f2 = r.pick([20, 25, 30, 40, 45, 75]); meta.f2 = f2;
        var ns2 = 60 * f2 / p;
        parts.push({ q: '(b) The motor is moved to an inverter supply at ' + f2 + ' Hz (V/f held constant). Find the new field speed and the time for one revolution of the field.', answers: [ans('ns2', "$n_S'$", ns2, 'rpm'), ans('Trev', '$T_{rev}$', 60 / ns2, 's')],
          working: QB.steps([$("n_S' = 60\\times" + f2 + '/' + p + ' = ' + rpm(ns2)), $('T_{rev} = 60/n_S\' = ' + n(60 / ns2) + '\\ \\text{s}') + ' (' + $('= p/f') + ')']) + QB.final("n_S' = " + rpm(ns2)) });
      } else {
        var map = v === 'swap' ? r.pick([['b', 'a', 'c'], ['a', 'c', 'b'], ['c', 'b', 'a']]) : r.pick([['b', 'c', 'a'], ['c', 'a', 'b']]);
        meta.map = map;
        stem += ' An electrician reconnects it as ' + map[0] + ' → A, ' + map[1] + ' → B, ' + map[2] + ' → C.';
        parts.push({ q: '(b) Which way does it now run, and at what speed of the field?', answers: [ans('ns2', '$n_S$', ns, 'rpm')],
          working: QB.steps(['The terminal sequence A, B, C now sees ' + map.join(', ') + '.', v === 'swap' ? 'That is ' + map.join('') + ', a sequence of the <b>acb</b> family: two leads have been swapped, so the phase sequence reverses and the field (and rotor) runs <b>anticlockwise</b>.' : 'That is ' + map.join('') + ', a cyclic shift of abc, so the phase sequence is <b>unchanged</b>: the motor still runs <b>clockwise</b>.', 'The field speed does not depend on the connection: ' + $('n_S = ' + rpm(ns)) + '.']) + QB.final('\\text{' + (v === 'swap' ? 'anticlockwise (reversed)' : 'clockwise (unchanged)') + '},\\ n_S = ' + rpm(ns)) });
      }
      return { stem: stem, figure: null, given: [['poles', String(poles)], ['$f$', f + ' Hz']], parts: parts,
        notes: QB.callout('trap', 'Only swapping <b>two</b> leads reverses the rotation. A cyclic relabelling of all three keeps the same sequence.'), meta: { in: meta } };
    }
  });

  /* =====================================================================
   * MODULE 4 · induction machines   (packs M7, M8, M9; Jun23/Jun24 Q3, MX3 Q3)
   * ===================================================================== */
  /** a random machine: simplified-circuit parameters and a stable rated slip */
  function imMachine(r, o) {
    o = o || {};
    return r.retry(function () {
      var f = o.f || r.pick([50, 50, 50, 60]);
      var p = o.p || r.pick([1, 2, 2, 2, 3, 3, 4]);
      var ns = 60 * f / p;
      var conn = o.conn || 'star';
      var VL = f === 50 ? r.pick([400, 415, 415, 415, 460]) : r.pick([460, 480, 440]);
      var R1 = r.float(0.2, 2.5, 2), R2 = r.float(0.15, 2.0, 2);
      var X1 = r.float(0.5, 4, 1), X2 = r.bool(0.7) ? X1 : r.float(0.5, 4, 1);
      var X = Math.round((X1 + X2) * 100) / 100;
      var XM = r.int(25, 120), RC = r.int(150, 900);
      var slipSp = r.int(Math.max(2, Math.round(0.015 * ns)), Math.round(0.06 * ns));
      var nR = ns - slipSp, sR = slipSp / ns;
      var sT = R2 / Math.hypot(R1, X);
      if (sR > 0.55 * sT || sT < 0.08 || sT > 0.45) return null;
      if (Math.floor(60 * f / nR + 1e-9) !== p) return null;
      var V1 = phaseOf(VL, conn);
      var Ir = V1 / Math.hypot(R1 + R2 / sR, X);
      if (Ir < 2 || Ir > 150) return null;
      if (XM < 3 * X) return null;
      return { f: f, p: p, ns: ns, ws: wOf(ns), conn: conn, VL: VL, V1: V1, R1: R1, R2: R2, X1: X1, X2: X2, X: X, XM: XM, RC: RC, nR: nR, sR: sR, sT: sT };
    }, 200);
  }
  function imGiven(m, shunt) {
    var g = [['$V_L$', m.VL + ' V (' + m.conn + ')'], ['$f$', m.f + ' Hz'], ['$n_R$', m.nR + ' rpm'], ['$R_1$', pv(m.R1, 'Ω')], ["$R_2'$", pv(m.R2, 'Ω')], ['$X_1$', pv(m.X1, 'Ω')], ["$X_2'$", pv(m.X2, 'Ω')]];
    if (shunt) { g.push(['$X_M$', pv(m.XM, 'Ω')]); if (shunt !== 'XM') g.push(['$R_C$', pv(m.RC, 'Ω')]); }
    return g;
  }
  function imParamText(m, shunt) {
    var t = '$R_1 = ' + n(m.R1) + '\\ \\Omega$, $R_2\' = ' + n(m.R2) + '\\ \\Omega$, $X_1 = ' + n(m.X1) + '\\ \\Omega$, $X_2\' = ' + n(m.X2) + '\\ \\Omega$';
    if (shunt) t += ', $X_M = ' + n(m.XM) + '\\ \\Omega$' + (shunt !== 'XM' ? ', $R_C = ' + n(m.RC) + '\\ \\Omega$' : '');
    return t;
  }
  /** header working: V1, p, n_S, ω_S, s, R2'/s */
  function imHeaderSteps(m, nOp, sOp) {
    var st = [];
    st.push(m.conn === 'delta' ? 'Delta: ' + $('V_1 = V_L = ' + n(m.V1) + '\\angle0^\\circ\\ \\text{V}') : 'Star: ' + $('V_1 = V_L/\\sqrt3 = ' + m.VL + '/\\sqrt3 = ' + n(m.V1) + '\\angle0^\\circ\\ \\text{V}'));
    st.push($('60f/n_R = ' + n(60 * m.f / m.nR, 4)) + ' → ' + $('p = ' + m.p) + ' (' + 2 * m.p + ' poles), ' + $('n_S = 60f/p = ' + rpm(m.ns)) + ', ' + $('\\omega_S = ' + rads(m.ws)));
    if (nOp != null) st.push($('s = \\dfrac{n_S - n}{n_S} = \\dfrac{' + m.ns + ' - ' + n(nOp, 6) + '}{' + m.ns + '} = ' + n(sOp)));
    else st.push('Given ' + $('s = ' + n(sOp)) + ', so ' + $('n = (1-s)n_S = ' + rpm((1 - sOp) * m.ns)));
    st.push($("R_2'/s = " + n(m.R2) + '/' + sgn(sOp) + ' = ' + ohm(m.R2 / sOp)));
    return st;
  }
  function imFig(m, s, shunt, extra) {
    extra = extra || {};
    return figIM({ V: pv(m.V1, 'V'), RC: shunt && shunt !== 'XM' ? pv(m.RC, 'Ω') : null, XM: shunt ? pj(m.XM) : null, R1: pv(m.R1, 'Ω'), X1: pj(m.X1), X2: pj(m.X2),
      R2: s == null ? extra.R2 || '' : pv(m.R2 / s, 'Ω'), R2lab: extra.R2lab, shunt: !!shunt, gen: s != null && s < 0 });
  }

  /* ---------------------------------------------------------------- im.slip */
  add({
    id: 'mach.im.slip.slipfreq', course: 'mach', module: 'im', topic: 'slip',
    title: "Slip, rotor frequency and the effective rotor resistance R2'/s",
    difficulty: 1, marks: 4, tags: ['PQ 7.5', 'PQ 7.8', 'PQ 7.9', 'Type A'],
    variants: [{ id: 'rated', label: 'At rated speed' }, { id: 'speed', label: 'At another motoring speed' }, { id: 'gen', label: 'Generator (s < 0)' }, { id: 'standstill', label: 'Standstill (s = 1)' }],
    gen: function (r, v) {
      var f = r.pick([50, 50, 60]), p = r.pick([1, 2, 2, 3, 3, 4]), ns = 60 * f / p;
      var nR = ns - r.int(Math.max(2, Math.round(0.02 * ns)), Math.round(0.07 * ns));
      var R2 = r.float(0.2, 2.5, 2), nOp;
      if (v === 'rated') nOp = nR;
      else if (v === 'speed') nOp = ns - r.int(Math.round(0.005 * ns) + 1, Math.round(0.9 * (ns - nR)));
      else if (v === 'gen') nOp = ns + r.int(Math.round(0.01 * ns), Math.round(0.08 * ns));
      else nOp = 0;
      var s = (ns - nOp) / ns, R2s = R2 / s, Rm = R2 * (1 - s) / s;
      var q = 60 * f / nR;
      var parts = [{ q: '(a) Find the number of poles and the synchronous speed.', answers: [ans('poles', 'poles', 2 * p, ''), ans('ns', '$n_S$', ns, 'rpm')],
        working: QB.steps([$('60f/n_R = 60\\times' + f + '/' + nR + ' = ' + n(q)) + ', round down: ' + $('p = ' + p) + ', ' + 2 * p + ' poles', $('n_S = 60f/p = ' + rpm(ns))]) + QB.final(2 * p + '\\ \\text{poles},\\ n_S = ' + rpm(ns)) }];
      var opTxt = v === 'standstill' ? 'at standstill (locked rotor)' : 'at ' + nOp + ' rpm';
      parts.push({ q: '(b) Find the slip, the slip speed and the frequency of the rotor currents ' + opTxt + '.', answers: [ans('s', '$s$', s, ''), ans('ss', 'slip speed', ns - nOp, 'rpm'), ans('f2', '$f_2$', s * f, 'Hz')],
        working: QB.steps([$('s = \\dfrac{n_S - n}{n_S} = \\dfrac{' + ns + ' - ' + nOp + '}{' + ns + '} = ' + n(s)), 'Slip speed ' + $('= n_S - n = ' + rpm(ns - nOp)), $('f_2 = sf = ' + n(s) + '\\times' + f + ' = ' + Hz(s * f)) + (v === 'gen' ? ' (negative: reversed phase sequence in the rotor)' : v === 'standstill' ? ' (at standstill the rotor sees the full supply frequency)' : '')]) + QB.final('s = ' + n(s) + ',\\ f_2 = ' + Hz(s * f)) });
      var pc = { q: "(c) Find $R_2'/s$ and split it into the rotor copper-loss resistance and the mechanical-load resistance.", answers: [ans('R2s', "$R_2'/s$", R2s, 'Ω'), ans('Rm', "$R_2'(1-s)/s$", Rm, 'Ω', { abs: 1e-6 })],
        working: QB.steps([$("R_2'/s = " + n(R2) + '/' + sgn(s) + ' = ' + ohm(R2s)), $("R_2'/s = \\underbrace{R_2'}_{\\text{heat}} + \\underbrace{R_2'\\tfrac{1-s}{s}}_{\\text{mech}} = " + n(R2) + ' + ' + sgn(Rm) + '\\ \\Omega'),
          v === 'gen' ? 'Negative: the "resistor" delivers power. Mechanical power is absorbed and appears as electrical power.' : v === 'standstill' ? 'At ' + $('s = 1') + ' the mechanical resistance is zero: no mechanical power.' : 'Positive: motoring.']) + QB.final("R_2'/s = " + ohm(R2s)) };
      parts.push(pc);
      return { stem: 'A ' + f + ' Hz three-phase induction machine has a rated speed of ' + nR + ' rpm and a referred rotor resistance $R_2\' = ' + n(R2) + '\\ \\Omega$. ' + (v === 'gen' ? 'It is driven by a prime mover at ' + nOp + ' rpm.' : v === 'standstill' ? 'Consider it at standstill.' : 'It runs at ' + nOp + ' rpm.'),
        figure: null, given: [['$f$', f + ' Hz'], ['$n_R$', nR + ' rpm'], ["$R_2'$", pv(R2, 'Ω')], ['$n$', nOp + ' rpm']], parts: parts,
        notes: QB.callout('trap', 'The slip is at the <b>operating</b> speed; the rated speed only fixes the pole count. Keep $s$ to 4 s.f.'), meta: { in: { f: f, nR: nR, R2: R2, n: nOp } } };
    }
  });

  add({
    id: 'mach.im.slip.powerflow', course: 'mach', module: 'im', topic: 'slip',
    title: 'Induction motor power flow: airgap power, rotor copper loss and torque',
    difficulty: 1, marks: 4, tags: ['N2', 'Example 3 (M7)', 'Type B'],
    variants: [{ id: 'pin', label: 'Given input power and stator losses' }, { id: 'rotorcu', label: 'Given rotor copper loss' }, { id: 'pout', label: 'Given output power' }, { id: 'torque', label: 'Given torque' }],
    gen: function (r, v) {
      var f = r.pick([50, 50, 60]), p = r.pick([1, 2, 2, 3, 3, 4]), ns = 60 * f / p, ws = wOf(ns);
      var nn = ns - r.int(Math.max(2, Math.round(0.015 * ns)), Math.round(0.06 * ns)), s = (ns - nn) / ns, w = wOf(nn);
      var scale = r.pick([2, 5, 10, 15, 20, 40]) * 1000;
      var PAG, given = [['poles', String(2 * p)], ['$f$', f + ' Hz'], ['$n$', nn + ' rpm']], meta = { f: f, p: p, n: nn }, w0 = [], stem;
      var hdr = $('n_S = 60f/p = ' + rpm(ns)) + ', ' + $('\\omega_S = ' + rads(ws)) + ', ' + $('s = (' + ns + ' - ' + nn + ')/' + ns + ' = ' + n(s));
      w0.push(hdr);
      var Pin = null, Pcu1, Pfe;
      if (v === 'pin') {
        Pin = Math.round(scale * r.float(1, 1.2, 2) / 10) * 10; Pcu1 = Math.round(Pin * r.float(0.02, 0.05, 3)); Pfe = Math.round(Pin * r.float(0.015, 0.04, 3));
        PAG = Pin - Pcu1 - Pfe; meta.Pin = Pin; meta.Pcu1 = Pcu1; meta.Pfe = Pfe;
        stem = 'A ' + 2 * p + '-pole, ' + f + ' Hz induction motor runs at ' + nn + ' rpm and draws ' + pe(Pin, 'W') + '. The stator copper loss is ' + Pcu1 + ' W and the iron loss is ' + Pfe + ' W.';
        given.push(['$P_{IN}$', pe(Pin, 'W')], ['stator Cu', Pcu1 + ' W'], ['iron', Pfe + ' W']);
        w0.push($('P_{AG} = P_{IN} - P_{Cu1} - P_{Fe} = ' + n(Pin) + ' - ' + Pcu1 + ' - ' + Pfe + ' = ' + W(PAG)));
      } else if (v === 'rotorcu') {
        var Pr = Math.round(scale * r.float(0.02, 0.05, 3)); PAG = Pr / s; meta.Pcu2 = Pr;
        stem = 'A ' + 2 * p + '-pole, ' + f + ' Hz induction motor runs at ' + nn + ' rpm. Its rotor copper loss is ' + Pr + ' W.';
        given.push(['rotor Cu', Pr + ' W']);
        w0.push('Rotor Cu ' + $('= sP_{AG}') + ', so ' + $('P_{AG} = ' + Pr + '/' + n(s) + ' = ' + W(PAG)));
      } else if (v === 'pout') {
        var PM0 = scale * r.pick([0.75, 1, 1.1, 1.5]); PAG = PM0 / (1 - s); meta.PM = PM0;
        Pcu1 = Math.round(PM0 * r.float(0.02, 0.05, 3)); Pfe = Math.round(PM0 * r.float(0.015, 0.04, 3)); meta.Pcu1 = Pcu1; meta.Pfe = Pfe; Pin = PAG + Pcu1 + Pfe;
        stem = 'A ' + 2 * p + '-pole, ' + f + ' Hz induction motor delivers ' + pe(PM0, 'W') + ' of mechanical power at ' + nn + ' rpm. Its stator copper loss is ' + Pcu1 + ' W and its iron loss is ' + Pfe + ' W (neglect friction).';
        given.push(['$P_M$', pe(PM0, 'W')], ['stator Cu', Pcu1 + ' W'], ['iron', Pfe + ' W']);
        w0.push($('P_M = (1-s)P_{AG}') + ', so ' + $('P_{AG} = \\dfrac{' + n(PM0) + '}{1 - ' + n(s) + '} = ' + W(PAG)));
      } else {
        var tq = Math.round(scale / ws * r.float(0.8, 1.2, 2)); PAG = tq * ws; meta.tau = tq;
        stem = 'A ' + 2 * p + '-pole, ' + f + ' Hz induction motor runs at ' + nn + ' rpm, delivering a torque of ' + tq + ' N m.';
        given.push(['$\\tau$', tq + ' N m']);
        w0.push($('P_{AG} = \\tau\\omega_S = ' + tq + '\\times' + n(ws) + ' = ' + W(PAG)));
      }
      var Pr2 = s * PAG, PM = (1 - s) * PAG, tau = PAG / ws;
      var parts = [{ q: '(a) Find the slip and the airgap power.', answers: [ans('s', '$s$', s, ''), ans('PAG', '$P_{AG}$', PAG, 'W')], working: QB.steps(w0) + QB.final('P_{AG} = ' + W(PAG)) },
        { q: '(b) Find the rotor copper loss, the mechanical power and the torque.', answers: [ans('Pcu2', 'rotor Cu', Pr2, 'W'), ans('PM', '$P_M$', PM, 'W'), ans('tau', '$\\tau$', tau, 'N·m')],
          working: QB.steps(['The airgap power splits ' + $('s : (1-s)') + ':', $('P_{Cu2} = sP_{AG} = ' + n(s) + '\\times' + n(PAG) + ' = ' + W(Pr2)), $('P_M = (1-s)P_{AG} = ' + W(PM)), $('\\tau = P_{AG}/\\omega_S = ' + n(PAG) + '/' + n(ws) + ' = ' + Nm(tau)) + '. Check: ' + $('P_M/\\omega = ' + n(PM) + '/' + n(w) + ' = ' + Nm(PM / w))]) + QB.final('\\tau = ' + Nm(tau)) }];
      if (Pin != null) parts.push({ q: '(c) Find the efficiency and the ideal efficiency.', answers: [ans('eta', '$\\eta$', PM / Pin * 100, '%'), ans('etai', '$\\eta_{ideal}$', (1 - s) * 100, '%')],
        working: QB.steps([v === 'pout' ? $('P_{IN} = P_{AG} + P_{Cu1} + P_{Fe} = ' + W(Pin)) : null, $('\\eta = P_M/P_{IN} = ' + n(PM) + '/' + n(Pin) + ' = ' + pct(PM / Pin * 100)), 'Ideal ' + $('\\eta = 1 - s = ' + pct((1 - s) * 100)) + ': it counts only the rotor copper loss.']) + QB.final('\\eta = ' + pct(PM / Pin * 100)) });
      else parts.push({ q: '(c) What is the ideal (maximum possible) efficiency at this speed?', answers: [ans('etai', '$\\eta_{ideal}$', (1 - s) * 100, '%')], working: QB.steps([$('\\eta \\le P_M/P_{AG} = 1 - s = n/n_S = ' + pct((1 - s) * 100))]) + QB.final('\\eta_{ideal} = ' + pct((1 - s) * 100)) });
      return { stem: stem, figure: null, given: given, parts: parts, notes: QB.callout('trap', 'Rotor copper loss is $3I_2\'^2R_2\' = sP_{AG}$, not divided by $s$. Divide $P_{AG}$ by $\\omega_S$ and $P_M$ by $\\omega$.'), meta: { in: meta } };
    }
  });

  add({
    id: 'mach.im.slip.nameplate', course: 'mach', module: 'im', topic: 'slip',
    title: 'Nameplate data: rated torque, input power and efficiency',
    difficulty: 1, marks: 5, tags: ['PQ 7.11', 'Type D'],
    variants: [{ id: 'findI', label: 'Given η and pf, find the current (star)' }, { id: 'findEta', label: 'Given current and pf, find η' }, { id: 'delta', label: 'Delta: line and phase current' }],
    gen: function (r, v) {
      var P = r.pick([0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 22]) * 1000, f = r.pick([50, 50, 60]), p = r.pick([1, 2, 2, 3]), ns = 60 * f / p;
      var nR = ns - r.int(Math.round(0.025 * ns), Math.round(0.07 * ns)), VL = f === 50 ? r.pick([400, 415]) : r.pick([460, 480]);
      var eta = r.pick([0.78, 0.8, 0.82, 0.85, 0.87, 0.89, 0.9]), pf = r.pick([0.75, 0.78, 0.8, 0.82, 0.85, 0.87]);
      var wR = wOf(nR), tR = P / wR, Pin = P / eta, IL = Pin / (SQ3 * VL * pf);
      var meta = { P: P, f: f, nR: nR, VL: VL, pf: pf }, given = [['$P_R$', pe(P, 'W', 3)], ['$f$', f + ' Hz'], ['$n_R$', nR + ' rpm'], ['$V_L$', VL + ' V'], ['pf', String(pf)]];
      var parts = [{ q: '(a) Find the synchronous speed and the rated output torque.', answers: [ans('ns', '$n_S$', ns, 'rpm'), ans('tR', '$\\tau_R$', tR, 'N·m')],
        working: QB.steps([$('60f/n_R = ' + n(60 * f / nR)) + ' → ' + $('p = ' + p) + ', ' + $('n_S = ' + rpm(ns)), $('\\omega_R = 2\\pi\\times' + nR + '/60 = ' + rads(wR)), $('\\tau_R = P_R/\\omega_R = ' + n(P) + '/' + n(wR) + ' = ' + Nm(tR)) + ' (the plate power is the <b>output</b>)']) + QB.final('n_S = ' + rpm(ns) + ',\\ \\tau_R = ' + Nm(tR)) }];
      var stem;
      if (v === 'findEta') {
        IL = Math.round(IL * 10) / 10; meta.IL = IL; Pin = SQ3 * VL * IL * pf; eta = P / Pin;
        stem = 'A three-phase induction motor nameplate reads: ' + pe(P, 'W', 3) + ', ' + f + ' Hz, ' + nR + ' rpm, ' + VL + ' V, ' + IL + ' A, pf ' + pf + '.';
        given.push(['$I_L$', IL + ' A']);
        parts.push({ q: '(b) Find the rated input power and the rated efficiency.', answers: [ans('Pin', '$P_{IN}$', Pin, 'W'), ans('eta', '$\\eta$', eta * 100, '%')],
          working: QB.steps([$('P_{IN} = \\sqrt3V_LI_L\\cos\\phi = \\sqrt3\\times' + VL + '\\times' + IL + '\\times' + pf + ' = ' + W(Pin)), $('\\eta = P_R/P_{IN} = ' + pct(eta * 100))]) + QB.final('P_{IN} = ' + W(Pin) + ',\\ \\eta = ' + pct(eta * 100)) });
      } else {
        meta.eta = eta;
        stem = 'A three-phase, ' + (v === 'delta' ? 'delta' : 'star') + '-connected induction motor nameplate reads: ' + pe(P, 'W', 3) + ', ' + f + ' Hz, ' + nR + ' rpm, ' + VL + ' V, efficiency ' + eta + ', pf ' + pf + '.';
        given.push(['$\\eta$', String(eta)]);
        var Iph = v === 'delta' ? IL / SQ3 : IL;
        parts.push({ q: '(b) Find the rated input power, the line current' + (v === 'delta' ? ' and the phase (winding) current.' : '.'), answers: [ans('Pin', '$P_{IN}$', Pin, 'W'), ans('IL', '$I_L$', IL, 'A')].concat(v === 'delta' ? [ans('Iph', '$I_{ph}$', Iph, 'A')] : []),
          working: QB.steps([$('P_{IN} = P_R/\\eta = ' + n(P) + '/' + eta + ' = ' + W(Pin)), $('I_L = \\dfrac{P_{IN}}{\\sqrt3V_L\\cos\\phi} = \\dfrac{' + n(Pin) + '}{\\sqrt3\\times' + VL + '\\times' + pf + '} = ' + A_(IL)), v === 'delta' ? 'Delta: ' + $('I_{ph} = I_L/\\sqrt3 = ' + A_(Iph)) : 'Star: the phase current equals the line current.']) + QB.final('I_L = ' + A_(IL)) });
      }
      parts.push({ q: '(c) Find the ideal efficiency at rated speed. Why is the actual efficiency lower?', answers: [ans('etai', '$\\eta_{ideal}$', nR / ns * 100, '%')], working: QB.steps([$('\\eta_{ideal} = n_R/n_S = ' + nR + '/' + ns + ' = ' + pct(nR / ns * 100)), 'It counts only the rotor copper loss. Stator copper loss, iron loss and friction and windage make the real efficiency (' + $(pct(eta * 100)) + ') lower.']) + QB.final('\\eta_{ideal} = ' + pct(nR / ns * 100)) });
      return { stem: stem, figure: null, given: given, parts: parts, meta: { in: meta } };
    }
  });

  /* ---------------------------------------------------------------- im.eqcct */
  function imFullParts(m, s, shunt, nOp, label0) {
    var o = imSolve(m.V1, m.R1, m.R2, m.X, s, shunt && shunt !== 'XM' ? m.RC : 0, shunt ? m.XM : 0, m.ws);
    var parts = [];
    parts.push({ q: label0 || "(a) Find the synchronous speed, the slip and $R_2'/s$, and draw the per-phase circuit with values.", answers: [ans('ns', '$n_S$', m.ns, 'rpm'), ans('s', '$s$', s, ''), ans('R2s', "$R_2'/s$", o.R2s, 'Ω')],
      working: QB.steps(imHeaderSteps(m, nOp, s).concat(['Circuit: ' + (shunt ? (shunt !== 'XM' ? $(n(m.RC) + '\\ \\Omega') + ' ∥ ' : '') + $(jo(m.XM)) + ' across the terminals, then ' : '') + $(ohm(m.R1) + ' + ' + jo(m.X) + ' + ' + ohm(o.R2s)) + ' in series.'])) + QB.final('s = ' + n(s) + ',\\ R_2\'/s = ' + ohm(o.R2s)) });
    var w = [$('Z = (R_1 + R_2\'/s) + jX = (' + n(m.R1) + ' + ' + n(o.R2s) + ') + j' + n(m.X) + ' = ' + ph(o.Z) + '\\ \\Omega'),
      $("I_2' = \\dfrac{V_1}{Z} = \\dfrac{" + n(m.V1) + '\\angle0^\\circ}{' + ph(o.Z) + '} = ' + ph(o.I2) + '\\ \\text{A} = ' + rc(o.I2) + '\\ \\text{A}')];
    if (shunt) {
      w.push($('I_M = ' + (shunt !== 'XM' ? '\\dfrac{V_1}{R_C} + ' : '') + '\\dfrac{V_1}{jX_M} = ' + rc(o.IM) + '\\ \\text{A}'));
      w.push($("I_1 = I_2' + I_M = " + rc(o.I1) + ' = ' + ph(o.I1) + '\\ \\text{A}') + ' (add in rectangular form)');
    } else w.push('Magnetising branch neglected, so ' + $("I_1 = I_2' = " + ph(o.I1) + '\\ \\text{A}'));
    w.push('pf ' + $('= \\cos(' + ang(o.phi) + ') = ' + n(o.pf)) + ' ' + lagLead(o.phi));
    var ansB = [ans('I2', "$|I_2'|$", o.I2.abs(), 'A'), ans('I1', '$|I_1|$', o.I1.abs(), 'A'), ans('phi', '$\\angle I_1$', o.phi, '°'), ans('pf', 'pf', o.pf, '')];
    if (m.conn === 'delta') { ansB.push(ans('IL', '$I_L$', SQ3 * o.I1.abs(), 'A')); w.push('Delta: line current ' + $('I_L = \\sqrt3|I_1| = ' + A_(SQ3 * o.I1.abs()))); }
    parts.push({ q: "(b) Find the rotor current $I_2'$, the input phase current $I_1$ (magnitude and phase) and the power factor" + (m.conn === 'delta' ? ', and the line current.' : '.'), answers: ansB, working: QB.steps(w) + QB.final('I_1 = ' + ph(o.I1) + '\\ \\text{A},\\ \\text{pf} = ' + n(o.pf) + '\\ \\text{' + lagLead(o.phi) + '}') });
    parts.push({ q: '(c) Find the input power, the airgap power and the torque.', answers: [ans('Pin', '$P_{IN}$', o.Pin, 'W'), ans('PAG', '$P_{AG}$', o.PAG, 'W'), ans('tau', '$\\tau$', o.tau, 'N·m')],
      working: QB.steps([$('P_{IN} = 3V_1|I_1|\\cos\\phi = 3\\times' + n(m.V1) + '\\times' + n(o.I1.abs()) + '\\times' + n(o.pf) + ' = ' + W(o.Pin)),
        $("P_{AG} = 3|I_2'|^2R_2'/s = 3\\times" + n(o.I2.abs()) + '^2\\times' + n(o.R2s) + ' = ' + W(o.PAG)),
        $('\\tau = P_{AG}/\\omega_S = ' + n(o.PAG) + '/' + n(m.ws) + ' = ' + Nm(o.tau)),
        'Check with the torque formula: ' + $('\\tau = \\dfrac{3V_1^2(R_2\'/s)}{\\omega_S[(R_1 + R_2\'/s)^2 + X^2]} = ' + Nm(tauFormula(m.V1, m.R1, o.R2s, m.X, m.ws)))]) + QB.final('P_{IN} = ' + W(o.Pin) + ',\\ \\tau = ' + Nm(o.tau)) });
    parts.push({ q: '(d) Find the output power and the efficiency, and check with a loss breakdown.', answers: [ans('PM', '$P_M$', o.PM, 'W'), ans('eta', '$\\eta$', o.PM / o.Pin * 100, '%')],
      working: QB.steps([$('P_M = (1-s)P_{AG} = \\tau\\omega = ' + W(o.PM)), $('\\eta = P_M/P_{IN} = ' + pct(o.PM / o.Pin * 100)) + '; ideal ' + $('1 - s = ' + pct((1 - s) * 100)),
        'Losses: stator Cu ' + $("3|I_2'|^2R_1 = " + W(o.Pcu1)) + ', rotor Cu ' + $('sP_{AG} = ' + W(o.Pcu2)) + (shunt && shunt !== 'XM' ? ', iron ' + $('3V_1^2/R_C = ' + W(o.Pfe)) : '') + '. ' + $('P_M + \\text{losses} = ' + W(o.PM + o.Pcu1 + o.Pcu2 + o.Pfe) + ' = P_{IN}')]) + QB.final('\\eta = ' + pct(o.PM / o.Pin * 100)) });
    return { parts: parts, o: o };
  }
  add({
    id: 'mach.im.eqcct.full', course: 'mach', module: 'im', topic: 'eqcct',
    title: 'Full equivalent-circuit analysis: I1, pf, P_IN, τ and η',
    difficulty: 2, marks: 10, tags: ['exam-style', 'Jun24 Q3c', 'MX3 3c', 'PQ 7.12(c)', 'Type C'],
    variants: [{ id: 'star', label: 'Star, with magnetising branch' }, { id: 'delta', label: 'Delta, with magnetising branch' }, { id: 'noshunt', label: 'Magnetising branch neglected' }],
    gen: function (r, v) {
      var conn = v === 'delta' ? 'delta' : (v === 'noshunt' ? r.pick(['star', 'delta']) : 'star');
      var m = imMachine(r, { conn: conn });
      var shunt = v === 'noshunt' ? false : (r.bool(0.75) ? true : 'XM');
      var nOp = r.bool(0.6) ? m.nR : m.ns - r.int(Math.max(2, Math.round(0.4 * (m.ns - m.nR))), m.ns - m.nR + Math.round(0.3 * (m.ns - m.nR)));
      var s = (m.ns - nOp) / m.ns;
      var res = imFullParts(m, s, shunt, nOp);
      var stem = 'A ' + m.VL + ' V, ' + m.f + ' Hz, ' + m.nR + ' rpm, three-phase, <b>' + conn + '-connected</b> induction motor has (referred to the stator) ' + imParamText(m, shunt) + '.' + (shunt ? '' : ' The magnetising branch can be neglected.') + (shunt === 'XM' ? ' The core-loss resistance can be neglected.' : '') + ' Use the simplified equivalent circuit. The motor runs at rated voltage at ' + nOp + ' rpm.';
      return { stem: stem, figure: imFig(m, s, shunt), given: imGiven(m, shunt).concat([['$n$', nOp + ' rpm']]), parts: res.parts,
        notes: QB.callout('trap', (conn === 'delta' ? 'Delta: $V_1 = V_L$ (using $V_L/\\sqrt3$ gives one third of the torque). ' : 'Star: $V_1 = V_L/\\sqrt3$. ') + 'Add $I_2\'$ and $I_M$ in rectangular form. Stator copper loss uses $I_2\'$, and $\\tau = P_{AG}/\\omega_S$.'),
        meta: { in: { VL: m.VL, f: m.f, nR: m.nR, conn: conn, R1: m.R1, R2: m.R2, X1: m.X1, X2: m.X2, XM: shunt ? m.XM : 0, RC: shunt === true ? m.RC : 0, n: nOp } } };
    }
  });

  add({
    id: 'mach.im.eqcct.torque', course: 'mach', module: 'im', topic: 'eqcct',
    title: 'Torque from the course torque formula, given speed or slip',
    difficulty: 2, marks: 9, tags: ['exam-style', 'Jun23 Q3c', 'N3 (M7)'],
    variants: [{ id: 'speed', label: 'Given speed (motor/generator check)' }, { id: 'slip', label: 'Given slip' }, { id: 'delta', label: 'Delta connection, given speed' }],
    gen: function (r, v) {
      var m = imMachine(r, { conn: v === 'delta' ? 'delta' : 'star' });
      var parts = [], s, nOp, meta;
      var q = 60 * m.f / m.nR;
      if (v === 'slip') {
        s = Math.round(m.sR * r.float(0.6, 1.3, 2) * 10000) / 10000; nOp = (1 - s) * m.ns;
        parts.push({ q: '(a) Find the synchronous speed and the rotor speed.', answers: [ans('ns', '$n_S$', m.ns, 'rpm'), ans('n', '$n$', nOp, 'rpm')], working: QB.steps([$('60f/n_R = ' + n(q)) + ' → ' + $('p = ' + m.p) + ', ' + $('n_S = ' + rpm(m.ns)), $('n = (1 - s)n_S = (1 - ' + n(s) + ')\\times' + m.ns + ' = ' + rpm(nOp))]) + QB.final('n = ' + rpm(nOp)) });
        meta = { s: s };
      } else {
        nOp = m.nR; s = m.sR;
        var nG = m.ns + r.int(Math.round(0.005 * m.ns) + 1, Math.round(0.03 * m.ns));
        parts.push({ q: '(a) How many poles does the machine have? What is its synchronous speed?', answers: [ans('poles', 'poles', 2 * m.p, ''), ans('ns', '$n_S$', m.ns, 'rpm')], working: QB.steps([$('p = 60f/n_R = 60\\times' + m.f + '/' + m.nR + ' = ' + n(q)) + '. Round down: ' + $('p = ' + m.p) + ', ' + 2 * m.p + ' poles.', $('n_S = 60f/p = ' + rpm(m.ns))]) + QB.final(2 * m.p + '\\ \\text{poles},\\ n_S = ' + rpm(m.ns)) });
        var sg = (m.ns - nG) / m.ns;
        parts.push({ q: '(b) The machine is driven at ' + nG + ' rpm. Is it acting as a motor or a generator? Give the slip.', answers: [ans('sg', '$s$', sg, '')], working: QB.steps([$('n = ' + nG + ' > n_S = ' + m.ns) + ', so ' + $('s = (' + m.ns + ' - ' + nG + ')/' + m.ns + ' = ' + n(sg) + ' < 0') + ': <b>generator</b>. The rotor is driven faster than the field.']) + QB.final('\\text{generator},\\ s = ' + n(sg)) });
        meta = { nG: nG };
      }
      var V1 = m.V1, R2s = m.R2 / s, tau = tauFormula(V1, m.R1, R2s, m.X, m.ws), Z = cx(m.R1 + R2s, m.X), I1 = cx(V1, 0).div(Z);
      parts.push({ q: '(' + (v === 'slip' ? 'b' : 'c') + ') Use the torque formula to find the torque ' + (v === 'slip' ? 'at this slip.' : 'at rated speed.'), answers: [ans('tau', '$\\tau$', tau, 'N·m')],
        working: QB.steps([(m.conn === 'delta' ? $('V_1 = V_L = ' + n(V1)) : $('V_1 = ' + m.VL + '/\\sqrt3 = ' + n(V1))) + ' V, ' + $('s = ' + n(s)) + ', ' + $("R_2'/s = " + ohm(R2s)) + ', ' + $('\\omega_S = ' + rads(m.ws)),
          $('\\tau = \\dfrac{3V_1^2(R_2\'/s)}{\\omega_S[(R_1+R_2\'/s)^2 + (X_1+X_2\')^2]} = \\dfrac{3\\times' + n(V1) + '^2\\times' + n(R2s) + '}{' + n(m.ws) + '[' + n(m.R1 + R2s) + '^2 + ' + n(m.X) + '^2]}')]) + QB.final('\\tau = ' + Nm(tau)) });
      parts.push({ q: '(' + (v === 'slip' ? 'c' : 'd') + ') Neglecting $X_M$ and $R_C$, find the input phase current (magnitude and phase)' + (m.conn === 'delta' ? ' and the line current.' : '.'), answers: [ans('I1', '$|I_1|$', I1.abs(), 'A'), ans('phi', '$\\angle I_1$', I1.argd(), '°')].concat(m.conn === 'delta' ? [ans('IL', '$I_L$', SQ3 * I1.abs(), 'A')] : []),
        working: QB.steps([$('Z_1 = (' + n(m.R1) + ' + ' + n(R2s) + ') + j' + n(m.X) + ' = ' + ph(Z) + '\\ \\Omega'), $("I_1 = I_2' = \\dfrac{" + n(V1) + '\\angle0^\\circ}{' + ph(Z) + '} = ' + ph(I1) + '\\ \\text{A}'), m.conn === 'delta' ? $('I_L = \\sqrt3|I_1| = ' + A_(SQ3 * I1.abs())) : null]) + QB.final('I_1 = ' + ph(I1) + '\\ \\text{A}') });
      var PM = tau * (1 - s) * m.ws;
      parts.push({ q: '(' + (v === 'slip' ? 'd' : 'e') + ') Find the mechanical output power.', answers: [ans('PM', '$P_M$', PM, 'W')], working: QB.steps([$('P_M = \\tau\\omega = ' + n(tau) + '\\times' + n((1 - s) * m.ws) + ' = ' + W(PM))]) + QB.final('P_M = ' + W(PM)) });
      var stem = 'A ' + m.VL + ' V, ' + m.f + ' Hz, ' + m.nR + ' rpm, three-phase, <b>' + m.conn + '-connected</b> induction machine has ' + imParamText(m, true) + '. Use the simplified equivalent circuit at rated voltage' + (v === 'slip' ? '. It runs at a slip of ' + n(s * 100) + ' %.' : '.');
      meta.VL = m.VL; meta.f = m.f; meta.nR = m.nR; meta.conn = m.conn; meta.R1 = m.R1; meta.R2 = m.R2; meta.X1 = m.X1; meta.X2 = m.X2;
      return { stem: stem, figure: imFig(m, s, true), given: imGiven(m, true), parts: parts, notes: QB.callout('trap', 'Use the phase voltage and $\\omega_S$ in the torque formula. The magnetising branch does not change the torque.'), meta: { in: meta } };
    }
  });

  /** solve the torque formula for x = R2'/s (larger root = stable small slip) */
  function xForTorque(V1, R1, X, ws, tL) {
    var a = tL * ws, b = 2 * R1 * tL * ws - 3 * V1 * V1, c = tL * ws * (R1 * R1 + X * X);
    var D = b * b - 4 * a * c; if (D < 0) return null;
    return { a: a, b: b, c: c, x1: (-b + Math.sqrt(D)) / (2 * a), x2: (-b - Math.sqrt(D)) / (2 * a) };
  }
  add({
    id: 'mach.im.eqcct.loadspeed', course: 'mach', module: 'im', topic: 'eqcct',
    title: 'Operating speed for a given load torque (quadratic in R2\'/s)',
    difficulty: 3, marks: 8, tags: ['New Q3 (M9)', 'N5 (M7)'],
    variants: [{ id: 'exact', label: 'Exact speed and linear estimate' }, { id: 'sag', label: 'Supply voltage sag at constant load' }, { id: 'start', label: 'Can it start the load?' }],
    gen: function (r, v) {
      var m = imMachine(r, { conn: 'star' });
      var V1 = m.V1, X = m.X, ws = m.ws;
      var tR = tauFormula(V1, m.R1, m.R2 / m.sR, X, ws);
      var tL = Math.round(tR * r.float(0.5, 0.9, 2)), parts = [], meta = { VL: m.VL, f: m.f, p: m.p, R1: m.R1, R2: m.R2, X: X, nR: m.nR, tL: tL };
      if (tL < 1) tL = 1;
      var k = v === 'sag' ? r.pick([0.9, 0.85, 0.95]) : 1; meta.k = k;
      var q0 = xForTorque(V1, m.R1, X, ws, tL), x0 = q0.x1, s0 = m.R2 / x0, n0 = m.ns * (1 - s0);
      var stem = 'A ' + m.VL + ' V, ' + m.f + ' Hz, ' + 2 * m.p + '-pole, star-connected induction motor has $R_1 = ' + n(m.R1) + '\\ \\Omega$, $R_2\' = ' + n(m.R2) + '\\ \\Omega$ and $X_1 + X_2\' = ' + n(X) + '\\ \\Omega$. Neglect $X_M$ and $R_C$. It drives a constant-torque load of ' + tL + ' N m.';
      parts.push({ q: '(a) Find the torque at the rated speed of ' + m.nR + ' rpm.', answers: [ans('tR', '$\\tau_R$', tR, 'N·m')],
        working: QB.steps([$('V_1 = ' + n(V1)) + ' V, ' + $('n_S = ' + rpm(m.ns)) + ', ' + $('\\omega_S = ' + rads(ws)) + ', ' + $('s_R = ' + n(m.sR)) + ', ' + $("R_2'/s = " + ohm(m.R2 / m.sR)), $('\\tau_R = \\dfrac{3\\times' + n(V1) + '^2\\times' + n(m.R2 / m.sR) + '}{' + n(ws) + '[' + n(m.R1 + m.R2 / m.sR) + '^2 + ' + n(X) + '^2]} = ' + Nm(tR))]) + QB.final('\\tau_R = ' + Nm(tR)) });
      parts.push({ q: '(b) Find the exact operating slip and speed with the ' + tL + ' N m load. Which root do you choose?', answers: [ans('x', "$R_2'/s$", x0, 'Ω'), ans('s', '$s$', s0, ''), ans('n', '$n$', n0, 'rpm')],
        working: QB.steps(['Let ' + $("x = R_2'/s") + '. The torque formula rearranges to', $('\\tau_L\\omega_S x^2 + (2R_1\\tau_L\\omega_S - 3V_1^2)x + \\tau_L\\omega_S(R_1^2 + X^2) = 0'),
          $(n(q0.a) + 'x^2 ' + (q0.b < 0 ? '- ' : '+ ') + n(Math.abs(q0.b)) + 'x + ' + n(q0.c) + ' = 0'), 'Roots: ' + $('x = ' + ohm(q0.x1)) + ' or ' + $(ohm(q0.x2)) + '. The larger ' + $('x') + ' is the small slip on the stable, steep part of the curve.',
          $('s = ' + n(m.R2) + '/' + n(x0) + ' = ' + n(s0)) + ', ' + $('n = ' + m.ns + '(1 - ' + n(s0) + ') = ' + rpm(n0))]) + QB.final('s = ' + n(s0) + ',\\ n = ' + rpm(n0)) });
      if (v === 'exact') {
        var sl = m.sR * tL / tR, nl = m.ns * (1 - sl);
        parts.push({ q: '(c) Estimate the speed with the linear (low-slip) approximation and the result of (a).', answers: [ans('nl', '$n$ (linear)', nl, 'rpm')], working: QB.steps([$('s \\approx s_R\\dfrac{\\tau_L}{\\tau_R} = ' + n(m.sR) + '\\times\\dfrac{' + tL + '}{' + n(tR) + '} = ' + n(sl)), $('n \\approx ' + rpm(nl)) + ' (vs exact ' + n(n0) + ' rpm: close, because both points are at low slip where ' + $('\\tau \\propto s') + ')']) + QB.final('n \\approx ' + rpm(nl)) });
      } else if (v === 'sag') {
        var V1n = k * V1, q1 = xForTorque(V1n, m.R1, X, ws, tL), s1 = m.R2 / q1.x1, n1 = m.ns * (1 - s1), se = s0 / (k * k);
        parts.push({ q: '(c) The supply voltage falls by ' + Math.round((1 - k) * 100) + ' % with the same load. Find the new exact speed, and compare with the estimate $s \\propto 1/V^2$.', answers: [ans('s1', "$s'$", s1, ''), ans('n1', "$n'$", n1, 'rpm'), ans('ne', '$n$ (estimate)', m.ns * (1 - se), 'rpm')],
          working: QB.steps([$('V_1 = ' + k + '\\times' + n(V1) + ' = ' + n(V1n)) + ' V, so ' + $('3V_1^2') + ' falls by ' + $(n(k * k)), $(n(q1.a) + 'x^2 - ' + n(Math.abs(q1.b)) + 'x + ' + n(q1.c) + ' = 0') + ' → ' + $('x = ' + ohm(q1.x1)), $("s' = " + n(s1) + ',\\ n\' = ' + rpm(n1)), 'Estimate: ' + $('s \\approx ' + n(s0) + '/' + n(k * k) + ' = ' + n(se)) + ', ' + $('n \\approx ' + rpm(m.ns * (1 - se))), 'At constant torque ' + $('P_{AG}') + ' is unchanged, so the rotor copper loss ' + $('sP_{AG}') + ' rises: the motor runs hotter.']) + QB.final("n' = " + rpm(n1)) });
      } else {
        var tst = tauFormula(V1, m.R1, m.R2, X, ws), Ist = V1 / Math.hypot(m.R1 + m.R2, X), Irun = V1 / Math.hypot(m.R1 + x0, X);
        parts.push({ q: '(c) Find the starting torque. Can the motor start this load? Find the ratio of starting current to the running current in (b).', answers: [ans('tst', '$\\tau_{st}$', tst, 'N·m'), ans('ratio', '$I_{st}/I_{run}$', Ist / Irun, '')],
          working: QB.steps(['At standstill ' + $('s = 1') + ': ' + $('\\tau_{st} = \\dfrac{3\\times' + n(V1) + '^2\\times' + n(m.R2) + '}{' + n(ws) + '[' + n(m.R1 + m.R2) + '^2 + ' + n(X) + '^2]} = ' + Nm(tst)), tst > tL ? $(n(tst) + ' > ' + tL) + ' N m: it <b>can</b> start the load.' : $(n(tst) + ' < ' + tL) + ' N m: it <b>cannot</b> start the load.', $('I_{st} = ' + n(V1) + '/|' + n(m.R1 + m.R2) + ' + j' + n(X) + '| = ' + A_(Ist)) + ', ' + $('I_{run} = ' + n(V1) + '/|' + n(m.R1 + x0) + ' + j' + n(X) + '| = ' + A_(Irun)), 'Ratio ' + $('= ' + n(Ist / Irun))]) + QB.final('\\tau_{st} = ' + Nm(tst) + ',\\ I_{st}/I_{run} = ' + n(Ist / Irun)) });
      }
      return { stem: stem, figure: imFig(m, null, false, { R2: '', R2lab: "R_2'/s" }), given: [['$V_L$', m.VL + ' V (star)'], ['$f$', m.f + ' Hz'], ['poles', String(2 * m.p)], ['$n_R$', m.nR + ' rpm'], ['$R_1$', pv(m.R1, 'Ω')], ["$R_2'$", pv(m.R2, 'Ω')], ['$X$', pv(X, 'Ω')], ['$\\tau_L$', tL + ' N m']], parts: parts, meta: { in: meta } };
    }
  });

  /* ---------------------------------------------------------------- im.tests */
  /** make no-load and blocked-rotor readings from a hidden machine */
  function imTestData(r, m, conn) {
    var V1 = m.V1;
    var Ibr = r.pick([4, 5, 6, 8, 9, 10, 12, 15]);
    var Vbr1 = Ibr * Math.hypot(m.R1 + m.R2, m.X), Pbr1 = Ibr * Ibr * (m.R1 + m.R2);
    var Inl1 = V1 * Math.hypot(1 / m.RC, 1 / m.XM), Pnl1 = V1 * V1 / m.RC;
    var d = conn === 'delta';
    var rd = function (x, dp) { var k = Math.pow(10, dp); return Math.round(x * k) / k; };
    return {
      Vbr: rd(d ? Vbr1 : Vbr1 * SQ3, 1), Ibr: rd(d ? Ibr * SQ3 : Ibr, 2), Pbr: Math.round(3 * Pbr1),
      Vnl: m.VL, Inl: rd(d ? Inl1 * SQ3 : Inl1, 2), Pnl: Math.round(3 * Pnl1)
    };
  }
  function imTestSolve(t, conn, R1) {
    var d = conn === 'delta';
    var Vb = d ? t.Vbr : t.Vbr / SQ3, Ib = d ? t.Ibr / SQ3 : t.Ibr, Pb = t.Pbr / 3;
    var Vn = d ? t.Vnl : t.Vnl / SQ3, In = d ? t.Inl / SQ3 : t.Inl, Pn = t.Pnl / 3;
    var R = Pb / (Ib * Ib), Sb = Vb * Ib, Qb = Math.sqrt(Sb * Sb - Pb * Pb), X = Qb / (Ib * Ib);
    var RC = Vn * Vn / Pn, Sn = Vn * In, Qn = Math.sqrt(Sn * Sn - Pn * Pn), XM = Vn * Vn / Qn;
    return { Vb: Vb, Ib: Ib, Pb: Pb, Vn: Vn, In: In, Pn: Pn, R: R, R2: R - R1, Sb: Sb, Qb: Qb, X: X, RC: RC, Sn: Sn, Qn: Qn, XM: XM };
  }
  function imTestSteps(t, z, conn, R1, R1txt) {
    var d = conn === 'delta';
    return [R1txt,
      '<b>Blocked rotor</b>, per phase' + (d ? ' (delta: ' + $('V_1 = V_L,\\ I_1 = I_L/\\sqrt3') + ')' : ' (star: ' + $('V_1 = V_L/\\sqrt3') + ')') + ': ' + $('V_1 = ' + n(z.Vb) + '\\ \\text{V},\\ I_1 = ' + n(z.Ib) + '\\ \\text{A},\\ P_1 = ' + t.Pbr + '/3 = ' + n(z.Pb) + '\\ \\text{W}'),
      $("R = R_1 + R_2' = \\dfrac{P_1}{I_1^2} = \\dfrac{" + n(z.Pb) + '}{' + n(z.Ib) + '^2} = ' + ohm(z.R)) + ' → ' + $("R_2' = " + n(z.R) + ' - ' + n(R1) + ' = ' + ohm(z.R2)),
      $('S_1 = V_1I_1 = ' + VA(z.Sb) + ',\\ Q_1 = \\sqrt{S_1^2 - P_1^2} = ' + VAr(z.Qb)) + ', ' + $('X = Q_1/I_1^2 = ' + ohm(z.X)) + ' (' + $("X_1 = X_2' = " + ohm(z.X / 2)) + ')',
      '<b>No load</b>, per phase: ' + $('V_1 = ' + n(z.Vn) + '\\ \\text{V},\\ I_1 = ' + n(z.In) + '\\ \\text{A},\\ P_1 = ' + n(z.Pn) + '\\ \\text{W}'),
      $('R_C = \\dfrac{V_1^2}{P_1} = \\dfrac{' + n(z.Vn) + '^2}{' + n(z.Pn) + '} = ' + ohm(z.RC)),
      $('S_1 = ' + VA(z.Sn) + ',\\ Q_1 = ' + VAr(z.Qn) + ',\\ X_M = \\dfrac{V_1^2}{Q_1} = ' + ohm(z.XM))];
  }
  add({
    id: 'mach.im.tests.params', course: 'mach', module: 'im', topic: 'tests',
    title: 'Equivalent-circuit parameters from the no-load and blocked-rotor tests',
    difficulty: 2, marks: 5, tags: ['exam-style', 'Jun24 Q3b', 'MX3 3b', 'PQ 7.13', 'Type A (M8)'],
    variants: [{ id: 'star', label: 'Star, R1 given per phase' }, { id: 'star-ll', label: 'Star, DC test line-to-line' }, { id: 'delta', label: 'Delta, line readings' }],
    gen: function (r, v) {
      var conn = v === 'delta' ? 'delta' : 'star';
      var m = imMachine(r, { conn: conn }), t = imTestData(r, m, conn);
      var R1 = m.R1, Rdc = v === 'star-ll' ? Math.round(2 * R1 * 100) / 100 : R1; if (v === 'star-ll') R1 = Rdc / 2;
      var z = imTestSolve(t, conn, R1);
      var R1txt = v === 'star-ll' ? 'DC test: a line-to-line reading in star is two phases in series, so ' + $('R_1 = ' + n(Rdc) + '/2 = ' + ohm(R1)) : 'DC test: ' + $('R_1 = ' + ohm(R1)) + ' per phase' + (conn === 'delta' ? ' (per phase winding of the delta)' : '');
      var stem = 'The following tests are performed on a ' + m.VL + ' V, ' + m.f + ' Hz three-phase induction motor that is <b>' + conn + '-connected</b>. Voltages and currents are <b>line</b> values; powers are three-phase totals.<br>'
        + 'Stator resistance: ' + (v === 'star-ll' ? n(Rdc) + ' Ω measured between two lines' : n(R1) + ' Ω per phase') + '<br>No-load test: ' + t.Vnl + ' V, ' + n(t.Inl) + ' A, ' + t.Pnl + ' W<br>Blocked-rotor test: ' + n(t.Vbr) + ' V, ' + n(t.Ibr) + ' A, ' + t.Pbr + ' W';
      var steps = imTestSteps(t, z, conn, R1, R1txt);
      return { stem: stem, figure: figIMTests({ Vnl: t.Vnl + ' V', Inl: n(t.Inl) + ' A', Pnl: t.Pnl + ' W', Vbr: n(t.Vbr) + ' V', Ibr: n(t.Ibr) + ' A', Pbr: t.Pbr + ' W' }),
        given: [['$R_{DC}$', pv(Rdc, 'Ω')], ['no-load', t.Vnl + ' V, ' + n(t.Inl) + ' A, ' + t.Pnl + ' W'], ['blocked', n(t.Vbr) + ' V, ' + n(t.Ibr) + ' A, ' + t.Pbr + ' W']],
        parts: [{ q: "(a) Find the series parameters $R_1$, $R_2'$ and $X = X_1 + X_2'$.", answers: [ans('R1', '$R_1$', R1, 'Ω'), ans('R2', "$R_2'$", z.R2, 'Ω'), ans('X', '$X$', z.X, 'Ω')], working: QB.steps(steps.slice(0, 4)) + QB.final("R_1 = " + ohm(R1) + ",\\ R_2' = " + ohm(z.R2) + ',\\ X = ' + ohm(z.X)) },
          { q: '(b) Find the shunt parameters $R_C$ and $X_M$.', answers: [ans('RC', '$R_C$', z.RC, 'Ω'), ans('XM', '$X_M$', z.XM, 'Ω')], working: QB.steps(steps.slice(4)) + QB.final('R_C = ' + ohm(z.RC) + ',\\ X_M = ' + ohm(z.XM)) }],
        notes: QB.callout('trap', 'Convert to per-phase values before dividing. $X = V/I$ is wrong: $V/I$ is $|Z|$; use $X = Q_1/I_1^2$.'),
        meta: { in: { conn: conn, Rdc: Rdc, ll: v === 'star-ll', Vnl: t.Vnl, Inl: t.Inl, Pnl: t.Pnl, Vbr: t.Vbr, Ibr: t.Ibr, Pbr: t.Pbr } } };
    }
  });

  add({
    id: 'mach.im.tests.chain', course: 'mach', module: 'im', topic: 'tests',
    title: 'From test results to rated performance',
    difficulty: 3, marks: 12, tags: ['PQ 7.12', 'New Q4 (M9)'],
    variants: [{ id: 'star', label: 'Star-connected' }, { id: 'delta', label: 'Delta-connected' }],
    gen: function (r, v) {
      var conn = v;
      var m = imMachine(r, { conn: conn }), t = imTestData(r, m, conn), R1 = m.R1;
      var z = imTestSolve(t, conn, R1);
      var mm = { V1: z.Vn, R1: R1, R2: z.R2, X: z.X, RC: z.RC, XM: z.XM, ws: m.ws };
      var s = m.sR, o = imSolve(mm.V1, R1, z.R2, z.X, s, z.RC, z.XM, m.ws);
      var stem = 'The following tests are performed on a ' + m.VL + ' V, ' + m.nR + ' rpm, ' + m.f + ' Hz three-phase induction motor that is <b>' + conn + '-connected</b> (line values, three-phase powers).<br>Stator resistance: ' + n(R1) + ' Ω per phase<br>No-load test: ' + t.Vnl + ' V, ' + n(t.Inl) + ' A, ' + t.Pnl + ' W<br>Blocked-rotor test: ' + n(t.Vbr) + ' V, ' + n(t.Ibr) + ' A, ' + t.Pbr + ' W';
      var steps = imTestSteps(t, z, conn, R1, 'DC test: ' + $('R_1 = ' + ohm(R1)));
      var parts = [{ q: '(a) Find the simplified equivalent-circuit parameters.', answers: [ans('R2', "$R_2'$", z.R2, 'Ω'), ans('X', '$X$', z.X, 'Ω'), ans('RC', '$R_C$', z.RC, 'Ω'), ans('XM', '$X_M$', z.XM, 'Ω')], working: QB.steps(steps) + QB.final("R_2' = " + ohm(z.R2) + ',\\ X = ' + ohm(z.X) + ',\\ R_C = ' + ohm(z.RC) + ',\\ X_M = ' + ohm(z.XM)) }];
      var w = [$('p = ' + m.p) + ', ' + $('n_S = ' + rpm(m.ns)) + ', ' + $('s = ' + n(s)) + ', ' + $("R_2'/s = " + ohm(o.R2s)) + ', ' + $('V_1 = ' + n(mm.V1)) + ' V',
        $("I_2' = \\dfrac{" + n(mm.V1) + '}{' + n(R1 + o.R2s) + ' + j' + n(z.X) + '} = ' + ph(o.I2) + '\\ \\text{A}'),
        $("I_1 = I_2' + \\dfrac{V_1}{R_C} + \\dfrac{V_1}{jX_M} = " + ph(o.I1) + '\\ \\text{A}') + ', pf ' + $('= ' + n(o.pf)) + ' lag',
        $('P_{IN} = 3V_1|I_1|\\cos\\phi = ' + W(o.Pin)), $("\\tau = 3|I_2'|^2(R_2'/s)/\\omega_S = " + Nm(o.tau)), $('P_{OUT} = \\tau\\omega = ' + W(o.PM)) + ', ' + $('\\eta = ' + pct(o.PM / o.Pin * 100)),
        'Check: Cu ' + $("3|I_2'|^2(R_1 + R_2') = " + W(o.Pcu1 + o.Pcu2)) + ', Fe ' + $('= ' + W(o.Pfe)) + '; ' + $('P_{OUT}/(P_{OUT} + \\text{losses}) = ' + pct(o.PM / (o.PM + o.Pcu1 + o.Pcu2 + o.Pfe) * 100))];
      parts.push({ q: '(b) The motor runs at rated voltage and speed. Find the input current, power factor, input power, output torque, output power and efficiency.', answers: [ans('I1', '$|I_1|$', o.I1.abs(), 'A'), ans('pf', 'pf', o.pf, ''), ans('Pin', '$P_{IN}$', o.Pin, 'W'), ans('tau', '$\\tau$', o.tau, 'N·m'), ans('PM', '$P_{OUT}$', o.PM, 'W'), ans('eta', '$\\eta$', o.PM / o.Pin * 100, '%')], working: QB.steps(w) + QB.final('\\tau = ' + Nm(o.tau) + ',\\ \\eta = ' + pct(o.PM / o.Pin * 100)) });
      return { stem: stem, figure: figIMTests({ Vnl: t.Vnl + ' V', Inl: n(t.Inl) + ' A', Pnl: t.Pnl + ' W', Vbr: n(t.Vbr) + ' V', Ibr: n(t.Ibr) + ' A', Pbr: t.Pbr + ' W' }),
        given: [['$R_1$', pv(R1, 'Ω')], ['no-load', t.Vnl + ' V, ' + n(t.Inl) + ' A, ' + t.Pnl + ' W'], ['blocked', n(t.Vbr) + ' V, ' + n(t.Ibr) + ' A, ' + t.Pbr + ' W'], ['$n_R$', m.nR + ' rpm']], parts: parts,
        notes: QB.callout('tip', 'Copper loss uses $I_2\'$ through $R_1 + R_2\'$; the core-loss resistance here also includes friction and windage.'),
        meta: { in: { conn: conn, R1: R1, f: m.f, nR: m.nR, Vnl: t.Vnl, Inl: t.Inl, Pnl: t.Pnl, Vbr: t.Vbr, Ibr: t.Ibr, Pbr: t.Pbr } } };
    }
  });

  add({
    id: 'mach.im.tests.start', course: 'mach', module: 'im', topic: 'tests',
    title: 'Starting, rated and no-load currents from the circuit',
    difficulty: 2, marks: 8, tags: ['PQ 7.14', 'Jun24 Q4c(iii)'],
    variants: [{ id: 'xm', label: 'X_M only (R_C ignored)' }, { id: 'rc', label: 'With R_C and X_M' }, { id: 'reduced', label: 'Blocked-rotor test at reduced voltage' }],
    gen: function (r, v) {
      var m = imMachine(r, { conn: 'star' }), V1 = m.V1, X = m.X, RC = v === 'rc' ? m.RC : 0;
      var Zst = Math.hypot(m.R1 + m.R2, X), Ist = V1 / Zst, Pst = 3 * Ist * Ist * (m.R1 + m.R2), tst = 3 * Ist * Ist * m.R2 / m.ws;
      var o = imSolve(V1, m.R1, m.R2, X, m.sR, RC, m.XM, m.ws);
      var INL = cx(RC ? V1 / RC : 0, -V1 / m.XM).abs();
      var parts = [], meta = { VL: m.VL, f: m.f, nR: m.nR, R1: m.R1, R2: m.R2, X1: m.X1, X2: m.X2, XM: m.XM, RC: RC };
      if (v === 'reduced') {
        var k = r.pick([0.2, 0.25, 0.3]); var Vt = Math.round(m.VL * k), It = Vt / SQ3 / Zst;
        meta.Vt = Vt;
        parts.push({ q: '(a) A blocked-rotor test at ' + Vt + ' V (line) is planned. Ignoring $X_M$, find the test current and the torque on the clamp.', answers: [ans('It', '$I$', It, 'A'), ans('tt', '$\\tau$', 3 * It * It * m.R2 / m.ws, 'N·m')], working: QB.steps([$('V_1 = ' + Vt + '/\\sqrt3 = ' + n(Vt / SQ3)) + ' V, ' + $('s = 1'), $('I = \\dfrac{V_1}{|R_1 + R_2\' + jX|} = \\dfrac{' + n(Vt / SQ3) + '}{' + n(Zst) + '} = ' + A_(It)), $("\\tau = 3I^2R_2'/\\omega_S = " + Nm(3 * It * It * m.R2 / m.ws))]) + QB.final('I = ' + A_(It)) });
        parts.push({ q: '(b) Scale the test results to rated voltage to get the starting current and starting torque.', answers: [ans('Ist', '$I_{st}$', Ist, 'A'), ans('tst', '$\\tau_{st}$', tst, 'N·m')], working: QB.steps(['Current scales with ' + $('V') + ', torque with ' + $('V^2') + ':', $('I_{st} = ' + n(It) + '\\times\\dfrac{' + m.VL + '}{' + Vt + '} = ' + A_(Ist)), $('\\tau_{st} = ' + n(3 * It * It * m.R2 / m.ws) + '\\times\\left(\\dfrac{' + m.VL + '}{' + Vt + '}\\right)^2 = ' + Nm(tst))]) + QB.final('I_{st} = ' + A_(Ist) + ',\\ \\tau_{st} = ' + Nm(tst)) });
      } else {
        parts.push({ q: '(a) A locked-rotor test ($s = 1$) is done at rated voltage. Ignoring the magnetising branch for this part only, find the input current, input power and torque.', answers: [ans('Ist', '$I$', Ist, 'A'), ans('Pst', '$P$', Pst, 'W'), ans('tst', '$\\tau$', tst, 'N·m')],
          working: QB.steps([$('V_1 = ' + n(V1)) + ' V, ' + $('s = 1') + ' so ' + $("R_2'/s = R_2'"), $('I = \\dfrac{' + n(V1) + '}{|' + n(m.R1 + m.R2) + ' + j' + n(X) + '|} = ' + A_(Ist)), $("P = 3I^2(R_1 + R_2') = " + W(Pst)), $("\\tau = 3I^2R_2'/\\omega_S = " + Nm(tst))]) + QB.final('I = ' + A_(Ist) + ',\\ \\tau = ' + Nm(tst)) });
      }
      parts.push({ q: '(' + (v === 'reduced' ? 'c' : 'b') + ') At rated speed (do not neglect the magnetising branch), find the input current, the power factor and the rated torque.', answers: [ans('I1', '$|I_1|$', o.I1.abs(), 'A'), ans('pf', 'pf', o.pf, ''), ans('tR', '$\\tau_R$', o.tau, 'N·m')],
        working: QB.steps([$('s = ' + n(m.sR)) + ', ' + $("R_2'/s = " + ohm(o.R2s)), $("I_2' = " + ph(o.I2) + '\\ \\text{A}'), $("I_1 = I_2' + I_M = " + ph(o.I1) + '\\ \\text{A}') + ', pf ' + $('= ' + n(o.pf)) + ' lag', $("\\tau_R = 3|I_2'|^2(R_2'/s)/\\omega_S = " + Nm(o.tau))]) + QB.final('|I_1| = ' + A_(o.I1.abs()) + ',\\ \\tau_R = ' + Nm(o.tau)) });
      parts.push({ q: '(' + (v === 'reduced' ? 'd' : 'c') + ') Express the starting torque and starting current as fractions of the rated values.', answers: [ans('rt', '$\\tau_{st}/\\tau_R$', tst / o.tau, ''), ans('ri', '$I_{st}/I_R$', Ist / o.I1.abs(), '')], working: QB.steps([$('\\tau_{st}/\\tau_R = ' + n(tst) + '/' + n(o.tau) + ' = ' + n(tst / o.tau)), $('I_{st}/I_R = ' + n(Ist) + '/' + n(o.I1.abs()) + ' = ' + n(Ist / o.I1.abs())) + ' (starting current without ' + $('X_M') + ')']) + QB.final(n(tst / o.tau) + ',\\ ' + n(Ist / o.I1.abs())) });
      parts.push({ q: '(' + (v === 'reduced' ? 'e' : 'd') + ') Find the no-load input current and express it as a fraction of rated current.', answers: [ans('INL', '$I_{NL}$', INL, 'A'), ans('rNL', '$I_{NL}/I_R$', INL / o.I1.abs(), '')], working: QB.steps(['At no load ' + $("I_2' \\approx 0") + ', so only the magnetising branch draws current:', $('I_{NL} = |' + (RC ? 'V_1/R_C + ' : '') + 'V_1/jX_M| = ' + A_(INL)), $('I_{NL}/I_R = ' + n(INL / o.I1.abs())) + '. Typical: 25–60 % of rated, mostly magnetising current because of the airgap, so the no-load pf is low.']) + QB.final('I_{NL} = ' + A_(INL)) });
      var stem = 'A ' + m.VL + ' V, ' + m.f + ' Hz, ' + m.nR + ' rpm, three-phase, star-connected induction motor has (referred to the stator) ' + imParamText(m, RC ? true : 'XM') + '.' + (RC ? '' : ' Ignore the core-loss resistance.') + ' Use the simplified equivalent circuit at rated voltage.';
      return { stem: stem, figure: imFig(m, m.sR, RC ? true : 'XM'), given: imGiven(m, RC ? true : 'XM'), parts: parts, meta: { in: meta } };
    }
  });

  /* ---------------------------------------------------------------- im.tmax */
  add({
    id: 'mach.im.tmax.peak', course: 'mach', module: 'im', topic: 'tmax',
    title: 'Maximum (pull-out) torque and the slip at which it occurs',
    difficulty: 2, marks: 5, tags: ['PQ 7.14(e)', 'New Q2 (M8)', 'MX3 3c(iv)', 'Type B'],
    variants: [{ id: 'basic', label: 'τ_max, s and speed' }, { id: 'ratio', label: 'With τ_max/τ_R and τ_st/τ_R' }, { id: 'doubleR2', label: 'Effect of doubling R2\'' }],
    gen: function (r, v) {
      var m = imMachine(r, { conn: r.bool(0.8) ? 'star' : 'delta' });
      var V1 = m.V1, X = m.X, Z1 = Math.hypot(m.R1, X), sT = m.R2 / Z1, nT = (1 - sT) * m.ns;
      var tmax = tauFormula(V1, m.R1, Z1, X, m.ws), tcf = 3 * V1 * V1 / (2 * m.ws * (m.R1 + Z1));
      var tR = tauFormula(V1, m.R1, m.R2 / m.sR, X, m.ws), tst = tauFormula(V1, m.R1, m.R2, X, m.ws);
      var parts = [{ q: '(a) Find the slip and the speed at which maximum torque occurs.', answers: [ans('sT', '$s_{\\tau max}$', sT, ''), ans('nT', '$n_{\\tau max}$', nT, 'rpm')],
        working: QB.steps([(m.conn === 'delta' ? $('V_1 = V_L = ' + n(V1)) : $('V_1 = ' + m.VL + '/\\sqrt3 = ' + n(V1))) + ' V, ' + $('p = ' + m.p) + ', ' + $('n_S = ' + rpm(m.ns)) + ', ' + $('\\omega_S = ' + rads(m.ws)) + ', ' + $('X = ' + n(m.X1) + ' + ' + n(m.X2) + ' = ' + ohm(X)),
          'Maximum power transfer to ' + $("R_2'/s") + ': ' + $("R_2'/s_{\\tau max} = |R_1 + jX| = \\sqrt{" + n(m.R1) + '^2 + ' + n(X) + '^2} = ' + ohm(Z1)),
          $("s_{\\tau max} = \\dfrac{R_2'}{|R_1 + jX|} = \\dfrac{" + n(m.R2) + '}{' + n(Z1) + '} = ' + n(sT)), $('n_{\\tau max} = (1 - s_{\\tau max})n_S = ' + rpm(nT))]) + QB.final('s_{\\tau max} = ' + n(sT) + ',\\ n = ' + rpm(nT)) },
        { q: '(b) Find the maximum torque.', answers: [ans('tmax', '$\\tau_{max}$', tmax, 'N·m')],
          working: QB.steps(['Substitute ' + $("R_2'/s = " + n(Z1)) + ' into the torque formula:', $('\\tau_{max} = \\dfrac{3\\times' + n(V1) + '^2\\times' + n(Z1) + '}{' + n(m.ws) + '[(' + n(m.R1) + ' + ' + n(Z1) + ')^2 + ' + n(X) + '^2]} = ' + Nm(tmax)), 'Check: ' + $('\\tau_{max} = \\dfrac{3V_1^2}{2\\omega_S(R_1 + |R_1 + jX|)} = ' + Nm(tcf))]) + QB.final('\\tau_{max} = ' + Nm(tmax)) }];
      if (v === 'ratio') parts.push({ q: '(c) Find the rated torque (at ' + m.nR + ' rpm) and the starting torque, and express $\\tau_{max}$ and $\\tau_{st}$ as multiples of rated torque.', answers: [ans('tR', '$\\tau_R$', tR, 'N·m'), ans('tst', '$\\tau_{st}$', tst, 'N·m'), ans('rmax', '$\\tau_{max}/\\tau_R$', tmax / tR, ''), ans('rst', '$\\tau_{st}/\\tau_R$', tst / tR, '')],
        working: QB.steps([$('s_R = ' + n(m.sR)) + ': ' + $('\\tau_R = ' + Nm(tR)), $('s = 1') + ': ' + $('\\tau_{st} = \\dfrac{3V_1^2R_2\'}{\\omega_S[(R_1 + R_2\')^2 + X^2]} = ' + Nm(tst)), $('\\tau_{max}/\\tau_R = ' + n(tmax / tR)) + ' (typically about 2), ' + $('\\tau_{st}/\\tau_R = ' + n(tst / tR))]) + QB.final(n(tmax / tR) + ',\\ ' + n(tst / tR)) });
      if (v === 'doubleR2') {
        var tst2 = tauFormula(V1, m.R1, 2 * m.R2, X, m.ws);
        parts.push({ q: "(c) The rotor resistance is doubled (wound rotor). Find the new slip at maximum torque, the new maximum torque and the new starting torque.", answers: [ans('sT2', "$s_{\\tau max}'$", Math.min(2 * sT, 99), ''), ans('tmax2', "$\\tau_{max}'$", tmax, 'N·m'), ans('tst2', "$\\tau_{st}'$", tst2, 'N·m')],
          working: QB.steps([$("s_{\\tau max} \\propto R_2'") + ': ' + $("s_{\\tau max}' = 2\\times" + n(sT) + ' = ' + n(2 * sT)) + (2 * sT > 1 ? ' (beyond standstill: the peak is no longer reached in motoring)' : ''), $('\\tau_{max}') + ' does not contain ' + $("R_2'") + ': it stays ' + $(Nm(tmax)) + '.', $("\\tau_{st}' = \\dfrac{3V_1^2(2R_2')}{\\omega_S[(R_1 + 2R_2')^2 + X^2]} = " + Nm(tst2)) + ' (was ' + $(Nm(tst)) + ')']) + QB.final("s' = " + n(2 * sT) + ",\\ \\tau_{max}' = " + Nm(tmax)) });
      }
      var stem = 'A ' + m.VL + ' V, ' + m.f + ' Hz, ' + m.nR + ' rpm, three-phase, ' + m.conn + '-connected induction motor has ' + imParamText(m, false) + ' (simplified circuit, magnetising branch at the terminals).';
      return { stem: stem, figure: imFig(m, null, false, { R2: '', R2lab: "R_2'/s" }), given: imGiven(m, false), parts: parts,
        notes: QB.callout('trap', '$s_{\\tau max}$ uses the magnitude $|R_1 + jX|$, not $R_1 + X$. Changing $R_2\'$ moves the peak but not its height.'),
        meta: { in: { VL: m.VL, f: m.f, nR: m.nR, conn: m.conn, R1: m.R1, R2: m.R2, X1: m.X1, X2: m.X2 } } };
    }
  });

  add({
    id: 'mach.im.tmax.rext', course: 'mach', module: 'im', topic: 'tmax',
    title: 'External rotor resistance for maximum torque at standstill',
    difficulty: 2, marks: 5, tags: ['exam-style', 'Jun23 Q3b', 'PQ 7.15(d)', 'Type C'],
    variants: [{ id: 'external', label: 'External resistance and new starting current' }, { id: 'total', label: 'Total rotor resistance (PQ 7.15d)' }, { id: 'sketch', label: '0.5 pu and 1 pu of R_EXT (Jun23 sketch)' }],
    gen: function (r, v) {
      var m = imMachine(r, { conn: 'star' }), V1 = m.V1, X = m.X, Z1 = Math.hypot(m.R1, X), Rx = Z1 - m.R2;
      var tmax = 3 * V1 * V1 / (2 * m.ws * (m.R1 + Z1)), tst0 = tauFormula(V1, m.R1, m.R2, X, m.ws);
      var parts = [{ q: v === 'total' ? '(a) What total effective rotor resistance gives maximum torque at standstill? How much external resistance is that?' : '(a) Find the external rotor resistance (referred to the stator), $R_{EXT}\'$, that makes maximum torque occur at standstill.', answers: v === 'total' ? [ans('Rt', "$R_2' + R_{EXT}'$", Z1, 'Ω'), ans('Rx', "$R_{EXT}'$", Rx, 'Ω')] : [ans('Rx', "$R_{EXT}'$", Rx, 'Ω')],
        working: QB.steps([$('X = X_1 + X_2\' = ' + ohm(X)) + '. ' + $('X_M') + ' and ' + $('R_C') + ' are not needed: they sit at the terminals.', 'Maximum torque at ' + $('s = 1') + ': ' + $("\\dfrac{R_2' + R_{EXT}'}{1} = |R_1 + jX| = \\sqrt{" + n(m.R1) + '^2 + ' + n(X) + '^2} = ' + ohm(Z1)), $("R_{EXT}' = " + n(Z1) + ' - ' + n(m.R2) + ' = ' + ohm(Rx))]) + QB.final(v === 'total' ? "R_2' + R_{EXT}' = " + ohm(Z1) : "R_{EXT}' = " + ohm(Rx)) }];
      if (v === 'sketch') {
        var s5 = (m.R2 + 0.5 * Rx) / Z1, t5 = tauFormula(V1, m.R1, m.R2 + 0.5 * Rx, X, m.ws);
        parts.push({ q: '(b) For the τ–n sketch: find the slip at maximum torque and the starting torque for $R_{EXT} = 0$, 0.5 pu and 1 pu (1 pu = the value in (a)). What is the peak torque?', answers: [ans('s0', '$s_{\\tau max}$ (0)', m.R2 / Z1, ''), ans('s5', '$s_{\\tau max}$ (0.5 pu)', s5, ''), ans('t0', '$\\tau_{st}$ (0)', tst0, 'N·m'), ans('t5', '$\\tau_{st}$ (0.5 pu)', t5, 'N·m'), ans('tmax', '$\\tau_{max}$', tmax, 'N·m')],
          working: QB.steps([$("s_{\\tau max} = (R_2' + R_{EXT}')/|R_1 + jX|") + ':', $('R_{EXT} = 0') + ': ' + $('s = ' + n(m.R2) + '/' + n(Z1) + ' = ' + n(m.R2 / Z1)) + ', ' + $('\\tau_{st} = ' + Nm(tst0)), $('R_{EXT} = 0.5\\ \\text{pu} = ' + ohm(0.5 * Rx)) + ': ' + $('s = ' + n(s5)) + ', ' + $('\\tau_{st} = ' + Nm(t5)), $('R_{EXT} = 1\\ \\text{pu}') + ': ' + $('s = 1') + ', ' + $('\\tau_{st} = \\tau_{max}'), 'All three curves have the <b>same peak</b>: ' + $('\\tau_{max} = \\dfrac{3V_1^2}{2\\omega_S(R_1 + |R_1 + jX|)} = ' + Nm(tmax)) + '. Near ' + $('n_S') + ' the higher-resistance curves are less steep.']) + QB.final('\\tau_{max} = ' + Nm(tmax)) });
      } else {
        var Ist0 = V1 / Math.hypot(m.R1 + m.R2, X), Ist1 = V1 / Math.hypot(m.R1 + Z1, X);
        parts.push({ q: '(b) Find the starting torque and starting current (neglect the magnetising branch) without and with this resistance.', answers: [ans('t0', '$\\tau_{st}$ (no R_EXT)', tst0, 'N·m'), ans('I0', '$I_{st}$ (no R_EXT)', Ist0, 'A'), ans('t1', '$\\tau_{st}$ (with R_EXT)', tmax, 'N·m'), ans('I1', '$I_{st}$ (with R_EXT)', Ist1, 'A')],
          working: QB.steps(['Without: ' + $('\\tau_{st} = \\dfrac{3\\times' + n(V1) + '^2\\times' + n(m.R2) + '}{' + n(m.ws) + '[' + n(m.R1 + m.R2) + '^2 + ' + n(X) + '^2]} = ' + Nm(tst0)) + ', ' + $('I_{st} = ' + n(V1) + '/|' + n(m.R1 + m.R2) + ' + j' + n(X) + '| = ' + A_(Ist0)), 'With: the starting torque equals ' + $('\\tau_{max} = ' + Nm(tmax)) + ', and ' + $('I_{st} = ' + n(V1) + '/|' + n(m.R1 + Z1) + ' + j' + n(X) + '| = ' + A_(Ist1)), 'More starting torque with less current. Remove ' + $('R_{EXT}') + ' when running, for efficiency.']) + QB.final('\\tau_{st}: ' + Nm(tst0) + '\\to' + Nm(tmax)) });
      }
      var stem = 'The equivalent-circuit parameters of a ' + m.VL + ' V, ' + m.f + ' Hz, ' + 2 * m.p + '-pole, star-connected <b>wound-rotor</b> induction machine are ' + imParamText(m, true) + '.';
      var tsf = v === 'sketch' ? plot('torqueSpeed', [{ V: V1, R1: m.R1, X1: m.X1, X2: m.X2, f: m.f, poles: 2 * m.p, curves: [{ R2: m.R2, label: 'R_{EXT} = 0' }, { R2: m.R2 + 0.5 * Rx, label: '0.5 pu' }, { R2: Z1, label: '1 pu' }], mark: { tmax: true } }, { xlabel: 'n (rpm)', ylabel: 'τ (N m)', legend: true }]) : null;
      return { stem: stem, figure: tsf || imFig(m, null, true, { R2: '', R2lab: "(R_2' + R_{EXT}')/s" }), given: imGiven(m, true).filter(function (g) { return g[0] !== '$n_R$'; }), parts: parts,
        notes: QB.callout('trap', '"External resistance" means subtract $R_2\'$; "total effective rotor resistance" means $|R_1 + jX|$ itself.'),
        meta: { in: { VL: m.VL, f: m.f, p: m.p, R1: m.R1, R2: m.R2, X1: m.X1, X2: m.X2 } } };
    }
  });

  add({
    id: 'mach.im.tmax.curve', course: 'mach', module: 'im', topic: 'tmax',
    title: 'Points on the torque–speed curve (sync, rated, τ_max, standstill)',
    difficulty: 2, marks: 7, tags: ['PQ 7.15(a)–(c)', 'PQ 7.14(g)'],
    variants: [{ id: 'motor', label: 'Motoring points' }, { id: 'gen', label: 'Including a generating point' }],
    gen: function (r, v) {
      var m = imMachine(r, { conn: 'star' }), V1 = m.V1, X = m.X, Z1 = Math.hypot(m.R1, X), sT = m.R2 / Z1;
      var tR = tauFormula(V1, m.R1, m.R2 / m.sR, X, m.ws), tmax = tauFormula(V1, m.R1, Z1, X, m.ws), tst = tauFormula(V1, m.R1, m.R2, X, m.ws);
      var nG = m.ns + (m.ns - m.nR), sG = (m.ns - nG) / m.ns, tG = tauFormula(V1, m.R1, m.R2 / sG, X, m.ws);
      var parts = [{ q: '(a) Find the speed at which maximum torque occurs.', answers: [ans('nT', '$n_{\\tau max}$', (1 - sT) * m.ns, 'rpm')], working: QB.steps([$('V_1 = ' + n(V1)) + ' V, ' + $('n_S = ' + rpm(m.ns)) + ', ' + $('\\omega_S = ' + rads(m.ws)) + ', ' + $('|R_1 + jX| = ' + ohm(Z1)), $('s_{\\tau max} = ' + n(m.R2) + '/' + n(Z1) + ' = ' + n(sT)) + ', ' + $('n = ' + rpm((1 - sT) * m.ns))]) + QB.final('n_{\\tau max} = ' + rpm((1 - sT) * m.ns)) },
        { q: '(b) Using the torque formula, find the torque at (i) synchronous speed, (ii) rated speed, (iii) the speed of maximum torque and (iv) standstill.', answers: [ans('tR', '$\\tau$ (rated)', tR, 'N·m'), ans('tmax', '$\\tau_{max}$', tmax, 'N·m'), ans('tst', '$\\tau$ (standstill)', tst, 'N·m')],
          working: QB.steps(['(i) ' + $('n = n_S') + ': ' + $('s = 0') + ', no rotor current, ' + $('\\tau = 0'), '(ii) ' + $('s = ' + n(m.sR)) + ', ' + $("R_2'/s = " + ohm(m.R2 / m.sR)) + ': ' + $('\\tau = ' + Nm(tR)), '(iii) ' + $("R_2'/s = " + ohm(Z1)) + ': ' + $('\\tau = ' + Nm(tmax)), '(iv) ' + $('s = 1') + ': ' + $('\\tau = ' + Nm(tst))]) + QB.final('0,\\ ' + n(tR) + ',\\ ' + n(tmax) + ',\\ ' + n(tst) + '\\ \\text{N m}') }];
      if (v === 'gen') parts.push({ q: '(c) Find the torque when the machine is driven at ' + nG + ' rpm, and say what it means.', answers: [ans('tG', '$\\tau$', tG, 'N·m')], working: QB.steps([$('s = (' + m.ns + ' - ' + nG + ')/' + m.ns + ' = ' + n(sG)) + ', ' + $("R_2'/s = " + ohm(m.R2 / sG)), $('\\tau = ' + Nm(tG)) + ': negative, generating. The shaft must be driven against ' + $(Nm(-tG)) + '.']) + QB.final('\\tau = ' + Nm(tG)) });
      else parts.push({ q: '(c) Sketch the curve: list the points as $\\tau/\\tau_R$ against speed.', answers: [ans('rst', '$\\tau_{st}/\\tau_R$', tst / tR, ''), ans('rmax', '$\\tau_{max}/\\tau_R$', tmax / tR, '')], working: QB.steps(['0 rpm: ' + $(n(tst / tR)) + '; ' + n((1 - sT) * m.ns) + ' rpm: ' + $(n(tmax / tR)) + ' (peak); ' + m.nR + ' rpm: 1; ' + m.ns + ' rpm: 0. The curve rises from standstill to the peak, then falls steeply through the rated point to zero at ' + $('n_S') + '.']) + QB.final('\\tau_{st}/\\tau_R = ' + n(tst / tR) + ',\\ \\tau_{max}/\\tau_R = ' + n(tmax / tR)) });
      var curve = plot('torqueSpeed', [{ V: V1, R1: m.R1, X1: m.X1, X2: m.X2, R2: m.R2, f: m.f, poles: 2 * m.p, range: v === 'gen' ? 'full' : 'motor', mark: { tmax: true, start: true } }, { xlabel: 'n (rpm)', ylabel: 'τ (N m)' }]);
      var stem = 'A ' + m.VL + ' V, ' + m.f + ' Hz, ' + m.nR + ' rpm, star-connected wound-rotor induction motor has ' + imParamText(m, false) + '. Use the simplified circuit; the external rotor resistance is zero.';
      return { stem: stem, figure: curve || imFig(m, null, false, { R2: '', R2lab: "R_2'/s" }), given: imGiven(m, false), parts: parts, meta: { in: { VL: m.VL, f: m.f, nR: m.nR, R1: m.R1, R2: m.R2, X1: m.X1, X2: m.X2 } } };
    }
  });

  /* ---------------------------------------------------------------- im.vf */
  add({
    id: 'mach.im.vf.supply', course: 'mach', module: 'im', topic: 'vf',
    title: 'Constant V/f: supply voltage and speeds at a new frequency',
    difficulty: 1, marks: 4, tags: ['PQ 7.16', 'PQ 4.7', 'Lecture 7.9.4'],
    variants: [{ id: 'freq', label: 'Given new frequency' }, { id: 'speed', label: 'Given target speed at rated torque' }, { id: 'flux', label: 'Flux if V is not reduced' }],
    gen: function (r, v) {
      var f = r.pick([50, 60]), VR = f === 50 ? r.pick([400, 415, 240]) : r.pick([460, 480, 208]), p = r.pick([1, 2, 2, 3]), ns = 60 * f / p, sl = r.int(Math.round(0.02 * ns), Math.round(0.05 * ns)), nR = ns - sl;
      var parts = [], meta = { f: f, VR: VR, p: p, nR: nR };
      var stem = 'A ' + 2 * p + '-pole induction motor is rated ' + VR + ' V, ' + f + ' Hz, ' + nR + ' rpm. Constant volts-per-hertz control is used to keep the flux at its rated value.';
      if (v === 'speed') {
        var nt = r.nice(0.3 * ns, 0.85 * ns, ns >= 1500 ? 50 : 10), nsn = nt + sl, fn = nsn * p / 60; meta.nt = nt;
        parts.push({ q: '(a) Find the frequency and voltage for ' + nt + ' rpm at rated torque.', answers: [ans('f', '$f$', fn, 'Hz'), ans('V', '$V$', VR * fn / f, 'V')], working: QB.steps([$('n_S = ' + rpm(ns)) + ', rated slip speed ' + $('= ' + sl) + ' rpm (stays constant)', $('n_{S,new} = ' + nt + ' + ' + sl + ' = ' + rpm(nsn)) + ', ' + $('f = n_{S,new}p/60 = ' + Hz(fn)), $('V = ' + VR + '\\times' + n(fn) + '/' + f + ' = ' + V_(VR * fn / f))]) + QB.final('f = ' + Hz(fn) + ',\\ V = ' + V_(VR * fn / f)) });
        parts.push({ q: '(b) Find the speed at no load and at half rated torque with this supply.', answers: [ans('n0', '$n$ (no load)', nsn, 'rpm'), ans('nh', '$n$ (half)', nsn - sl / 2, 'rpm')], working: QB.steps(['No load: ' + $('n = n_S = ' + rpm(nsn)), 'Half torque: ' + $('n = ' + nsn + ' - ' + n(sl / 2) + ' = ' + rpm(nsn - sl / 2))]) + QB.final(rpm(nsn) + ',\\ ' + rpm(nsn - sl / 2)) });
      } else {
        var f2 = r.pick([10, 15, 20, 25, 30, 40, 45, 50, 60, 75].filter(function (x) { return x !== f; })); meta.f2 = f2;
        var V2 = VR * f2 / f, ns2 = 60 * f2 / p;
        parts.push({ q: '(a) Find the required stator voltage at ' + f2 + ' Hz.', answers: [ans('V', '$V$', Math.min(V2, 1e9), 'V')], working: QB.steps([$('\\hat\\Phi \\propto V/f') + ' (from ' + $('E = 4.44Nf\\hat\\Phi') + ', neglecting ' + $('R_1') + ')', $('V = V_R\\dfrac{f}{f_R} = ' + VR + '\\times\\dfrac{' + f2 + '}{' + f + '} = ' + V_(V2))]) + QB.final('V = ' + V_(V2)) + (f2 > f ? QB.callout('check', 'Above rated frequency the inverter usually cannot raise V above rated, so the flux falls (field weakening). The question asks for the constant-V/f value.') : '') });
        if (v === 'freq') parts.push({ q: '(b) Find the synchronous speed and the speed at rated torque at ' + f2 + ' Hz.', answers: [ans('ns2', '$n_S$', ns2, 'rpm'), ans('nr2', '$n$ (rated τ)', ns2 - sl, 'rpm')], working: QB.steps([$('n_S = 60\\times' + f2 + '/' + p + ' = ' + rpm(ns2)), 'The slip speed at rated torque stays ' + sl + ' rpm: ' + $('n = ' + rpm(ns2 - sl))]) + QB.final('n_S = ' + rpm(ns2) + ',\\ n = ' + rpm(ns2 - sl)) });
        else parts.push({ q: '(b) If the frequency were changed to ' + f2 + ' Hz with the voltage left at ' + VR + ' V, by what factor would the peak flux change? What would happen?', answers: [ans('k', '$\\hat\\Phi/\\hat\\Phi_R$', f / f2, '')], working: QB.steps([$('\\hat\\Phi \\propto V/f') + ': ' + $('\\dfrac{\\hat\\Phi}{\\hat\\Phi_R} = \\dfrac{V/f_2}{V/f_R} = \\dfrac{' + f + '}{' + f2 + '} = ' + n(f / f2)), f2 < f ? 'The flux rises: the core saturates and the magnetising current becomes very large (overcurrent, overheating).' : 'The flux falls: less torque per ampere (field weakening).']) + QB.final(n(f / f2)) });
      }
      return { stem: stem, figure: null, given: [['$V_R$', VR + ' V'], ['$f_R$', f + ' Hz'], ['poles', String(2 * p)], ['$n_R$', nR + ' rpm']], parts: parts, meta: { in: meta } };
    }
  });

  add({
    id: 'mach.im.vf.circuit', course: 'mach', module: 'im', topic: 'vf',
    title: 'V/f control in the equivalent circuit: τ_max and operating point at a new frequency',
    difficulty: 3, marks: 6, tags: ['New Q3 (M8)', 'Type E'],
    variants: [{ id: 'tmax', label: 'τ_max and its speed' }, { id: 'load', label: 'Speed for a load torque' }, { id: 'start', label: 'Starting torque at low frequency' }],
    gen: function (r, v) {
      var m = imMachine(r, { conn: 'star', f: 50 }), k = r.pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]), f2 = 50 * k;
      var V1 = m.V1, X = m.X, V2 = V1 * k, X2 = X * k, ws2 = m.ws * k, ns2 = m.ns * k;
      var parts = [], meta = { VL: m.VL, p: m.p, R1: m.R1, R2: m.R2, X: X, f2: f2 };
      parts.push({ q: '(a) What line voltage does the inverter supply at ' + f2 + ' Hz? Which quantities in the torque formula change?', answers: [ans('VL2', '$V_L$', m.VL * k, 'V')],
        working: QB.steps([$('V_L = ' + m.VL + '\\times' + f2 + '/50 = ' + V_(m.VL * k)) + ' (phase ' + n(V2) + ' V)', 'Scale with ' + $('f') + ': ' + $('V_1 \\to ' + n(V2) + '\\ \\text{V}') + ', ' + $('X = 2\\pi fL \\to ' + ohm(X2)) + ', ' + $('\\omega_S \\to ' + rads(ws2)) + ' (' + $('n_S = ' + rpm(ns2)) + '). ' + $('R_1') + ' and ' + $("R_2'") + ' do not change.']) + QB.final('V_L = ' + V_(m.VL * k)) });
      if (v === 'tmax') {
        var Z1 = Math.hypot(m.R1, X), Z2 = Math.hypot(m.R1, X2), t1 = 3 * V1 * V1 / (2 * m.ws * (m.R1 + Z1)), t2 = 3 * V2 * V2 / (2 * ws2 * (m.R1 + Z2)), sT2 = m.R2 / Z2, t0 = 3 * V1 * V1 / (2 * m.ws * X);
        parts.push({ q: '(b) Find the speed at maximum torque and the maximum torque at ' + f2 + ' Hz, and compare with 50 Hz.', answers: [ans('nT', '$n_{\\tau max}$', ns2 * (1 - sT2), 'rpm'), ans('t2', '$\\tau_{max}$ (' + f2 + ' Hz)', t2, 'N·m'), ans('t1', '$\\tau_{max}$ (50 Hz)', t1, 'N·m')],
          working: QB.steps([$('|R_1 + jX| = |' + n(m.R1) + ' + j' + n(X2) + '| = ' + ohm(Z2)) + ', ' + $('s_{\\tau max} = ' + n(m.R2) + '/' + n(Z2) + ' = ' + n(sT2)) + ', ' + $('n = ' + n(ns2) + '(1 - ' + n(sT2) + ') = ' + rpm(ns2 * (1 - sT2))), $('\\tau_{max} = \\dfrac{3\\times' + n(V2) + '^2}{2\\times' + n(ws2) + '(' + n(m.R1) + ' + ' + n(Z2) + ')} = ' + Nm(t2)), 'At 50 Hz: ' + $('\\tau_{max} = ' + Nm(t1)) + '. It is constant only if ' + $('R_1') + ' is neglected (both give ' + $('3V_1^2/(2\\omega_SX) = ' + Nm(t0)) + '). At low ' + $('f') + ', ' + $('X') + ' shrinks but ' + $('R_1') + ' does not, so ' + $('\\tau_{max}') + ' drops.']) + QB.final('\\tau_{max} = ' + Nm(t2) + '\\ (' + Nm(t1) + '\\ \\text{at 50 Hz})') });
      } else if (v === 'load') {
        var tR = tauFormula(V1, m.R1, m.R2 / m.sR, X, m.ws), tM2 = 3 * V2 * V2 / (2 * ws2 * (m.R1 + Math.hypot(m.R1, X2))), tL = Math.max(1, Math.round(Math.min(tR * r.float(0.5, 0.9, 2), 0.7 * tM2))); meta.tL = tL;
        var q1 = xForTorque(V1, m.R1, X, m.ws, tL), q2 = xForTorque(V2, m.R1, X2, ws2, tL);
        var s1 = m.R2 / q1.x1, s2 = m.R2 / q2.x1;
        parts.push({ q: '(b) The motor drives a ' + tL + ' N m load. Find the speed at 50 Hz and at ' + f2 + ' Hz, and the slip speed in each case.', answers: [ans('n1', '$n$ (50 Hz)', m.ns * (1 - s1), 'rpm'), ans('n2', '$n$ (' + f2 + ' Hz)', ns2 * (1 - s2), 'rpm')],
          working: QB.steps(['Solve ' + $('\\tau_L\\omega_Sx^2 + (2R_1\\tau_L\\omega_S - 3V_1^2)x + \\tau_L\\omega_S(R_1^2 + X^2) = 0') + ' for ' + $("x = R_2'/s") + ' (larger root):', '50 Hz: ' + $('x = ' + ohm(q1.x1)) + ', ' + $('s = ' + n(s1)) + ', ' + $('n = ' + rpm(m.ns * (1 - s1))) + ', slip speed ' + n(m.ns * s1) + ' rpm', f2 + ' Hz: ' + $('x = ' + ohm(q2.x1)) + ', ' + $('s = ' + n(s2)) + ', ' + $('n = ' + rpm(ns2 * (1 - s2))) + ', slip speed ' + n(ns2 * s2) + ' rpm', 'The slip speed is almost the same: the curve slides left with nearly the same shape. The fractional slip is larger, so the ideal efficiency is a little lower.']) + QB.final(rpm(m.ns * (1 - s1)) + ',\\ ' + rpm(ns2 * (1 - s2))) });
      } else {
        var ts1 = tauFormula(V1, m.R1, m.R2, X, m.ws), ts2 = tauFormula(V2, m.R1, m.R2, X2, ws2);
        parts.push({ q: '(b) Find the starting torque at 50 Hz (direct on line) and at ' + f2 + ' Hz with constant V/f, and the starting currents.', answers: [ans('ts1', '$\\tau_{st}$ (50 Hz)', ts1, 'N·m'), ans('ts2', '$\\tau_{st}$ (' + f2 + ' Hz)', ts2, 'N·m'), ans('Is2', '$I_{st}$ (' + f2 + ' Hz)', V2 / Math.hypot(m.R1 + m.R2, X2), 'A')],
          working: QB.steps([$('s = 1') + ' in both cases.', '50 Hz: ' + $('\\tau_{st} = \\dfrac{3\\times' + n(V1) + '^2\\times' + n(m.R2) + '}{' + n(m.ws) + '[' + n(m.R1 + m.R2) + '^2 + ' + n(X) + '^2]} = ' + Nm(ts1)) + ', ' + $('I_{st} = ' + A_(V1 / Math.hypot(m.R1 + m.R2, X))), f2 + ' Hz: ' + $('\\tau_{st} = \\dfrac{3\\times' + n(V2) + '^2\\times' + n(m.R2) + '}{' + n(ws2) + '[' + n(m.R1 + m.R2) + '^2 + ' + n(X2) + '^2]} = ' + Nm(ts2)) + ', ' + $('I_{st} = ' + A_(V2 / Math.hypot(m.R1 + m.R2, X2))), 'Starting at low frequency puts the operating point nearer the peak of the curve, so the inverter gives ' + (ts2 > ts1 ? 'more' : 'comparable') + ' starting torque with ' + (V2 / Math.hypot(m.R1 + m.R2, X2) < V1 / Math.hypot(m.R1 + m.R2, X) ? 'less' : 'similar') + ' current.']) + QB.final(Nm(ts1) + '\\to' + Nm(ts2)) });
      }
      var stem = 'A ' + m.VL + ' V, 50 Hz, ' + 2 * m.p + '-pole, star-connected induction motor has $R_1 = ' + n(m.R1) + '\\ \\Omega$, $R_2\' = ' + n(m.R2) + '\\ \\Omega$ and $X_1 + X_2\' = ' + n(X) + '\\ \\Omega$ at 50 Hz (simplified circuit; neglect the magnetising branch). It is fed from an inverter with constant V/f.';
      return { stem: stem, figure: null, given: [['$V_L$', m.VL + ' V (star, 50 Hz)'], ['poles', String(2 * m.p)], ['$R_1$', pv(m.R1, 'Ω')], ["$R_2'$", pv(m.R2, 'Ω')], ['$X$ (50 Hz)', pv(X, 'Ω')], ['new $f$', f2 + ' Hz']], parts: parts,
        notes: QB.callout('trap', 'Scale $V_1$, $X$ and $\\omega_S$ with $f$, not just $V$.'), meta: { in: meta } };
    }
  });

  /* ---------------------------------------------------------------- im.gen */
  add({
    id: 'mach.im.gen.circuit', course: 'mach', module: 'im', topic: 'gen',
    title: 'Induction generator from the equivalent circuit (s < 0)',
    difficulty: 2, marks: 10, tags: ['exam-style', 'Jun24 Q3c', 'New Q4 (M8)', 'Type D'],
    variants: [{ id: 'noshunt', label: 'Magnetising branch neglected' }, { id: 'shunt', label: 'With magnetising branch' }, { id: 'delta', label: 'Delta-connected' }],
    gen: function (r, v) {
      var conn = v === 'delta' ? 'delta' : 'star', m = imMachine(r, { conn: conn }), shunt = v === 'shunt' ? (r.bool(0.6) ? true : 'XM') : false;
      var nG = m.ns + r.int(Math.max(2, Math.round(0.3 * (m.ns - m.nR))), Math.round(1.2 * (m.ns - m.nR)) + 1);
      var s = (m.ns - nG) / m.ns, o = imSolve(m.V1, m.R1, m.R2, m.X, s, shunt === true ? m.RC : 0, shunt ? m.XM : 0, m.ws);
      var wn = wOf(nG), Psh = o.tau * wn, etaG = o.Pin / Psh * 100;
      var parts = [{ q: "(a) The machine is run as a generator at " + nG + " rpm. Find the synchronous speed, the slip and $R_2'/s$.", answers: [ans('ns', '$n_S$', m.ns, 'rpm'), ans('s', '$s$', s, ''), ans('R2s', "$R_2'/s$", o.R2s, 'Ω')],
        working: QB.steps(imHeaderSteps(m, nG, s).concat(['Negative ' + $("R_2'/s") + ': a source of power, not a load.'])) + QB.final('n_S = ' + rpm(m.ns) + ',\\ s = ' + n(s) + ',\\ R_2\'/s = ' + ohm(o.R2s)) }];
      var w = [$('Z = (' + n(m.R1) + ' ' + (o.R2s < 0 ? '- ' : '+ ') + n(Math.abs(o.R2s)) + ') + j' + n(m.X) + ' = ' + rc(o.Z) + ' = ' + ph(o.Z) + '\\ \\Omega'), $("I_2' = \\dfrac{" + n(m.V1) + '\\angle0^\\circ}{' + ph(o.Z) + '} = ' + ph(o.I2) + '\\ \\text{A}')];
      if (shunt) w.push($("I_1 = I_2' + I_M = " + rc(o.I2) + ' + (' + rc(o.IM) + ') = ' + ph(o.I1) + '\\ \\text{A}'));
      else w.push('No shunt branch: ' + $("I_1 = I_2' = " + ph(o.I1) + '\\ \\text{A}'));
      w.push($('P_{IN} = 3V_1|I_1|\\cos\\phi = 3\\times' + n(m.V1) + '\\times' + n(o.I1.abs()) + '\\times\\cos(' + ang(o.phi) + ') = ' + W(o.Pin)) + ': negative, so ' + $(W(-o.Pin)) + ' flows <b>into</b> the supply.');
      w.push($('Q_{IN} = ' + VAr(o.Qin)) + ': positive, it still <b>absorbs</b> reactive power to magnetise.');
      parts.push({ q: '(b) Find the input phase current (magnitude and phase, with $V_1$ at 0°), the input power and the reactive power.', answers: [ans('I1', '$|I_1|$', o.I1.abs(), 'A'), ans('phi', '$\\angle I_1$', o.phi, '°'), ans('Pin', '$P_{IN}$', o.Pin, 'W'), ans('Qin', '$Q_{IN}$', o.Qin, 'VAr')], working: QB.steps(w) + QB.final('I_1 = ' + ph(o.I1) + '\\ \\text{A},\\ P_{IN} = ' + W(o.Pin)) });
      parts.push({ q: '(c) Find the airgap power, the torque, the mechanical power the prime mover supplies, and the generator efficiency.', answers: [ans('PAG', '$P_{AG}$', o.PAG, 'W'), ans('tau', '$\\tau$', o.tau, 'N·m'), ans('Psh', '$P_{mech,in}$', -Psh, 'W'), ans('eta', '$\\eta_{gen}$', etaG, '%')],
        working: QB.steps([$("P_{AG} = 3|I_2'|^2R_2'/s = 3\\times" + n(o.I2.abs()) + '^2\\times(' + n(o.R2s) + ') = ' + W(o.PAG)), $('\\tau = P_{AG}/\\omega_S = ' + Nm(o.tau)) + ' (opposes the prime mover)', 'Shaft input ' + $('= |\\tau|\\omega = ' + n(-o.tau) + '\\times' + n(wn) + ' = ' + W(-Psh)) + ' ' + $('= |P_{AG}|(1-s)'),
          'Power flow: ' + $(W(-Psh)) + ' shaft → rotor Cu ' + $(W(o.Pcu2)) + ' → ' + $(W(-o.PAG)) + ' airgap → stator Cu ' + $(W(o.Pcu1)) + (o.Pfe ? ', iron ' + $(W(o.Pfe)) : '') + ' → ' + $(W(-o.Pin)) + ' electrical', $('\\eta_{gen} = |P_{IN}|/P_{mech} = ' + pct(etaG))]) + QB.final('P_{AG} = ' + W(o.PAG) + ',\\ \\tau = ' + Nm(o.tau)) });
      var stem = 'A ' + m.VL + ' V, ' + m.f + ' Hz, ' + m.nR + ' rpm, three-phase, <b>' + conn + '-connected</b> induction machine has (referred to the stator) ' + imParamText(m, shunt) + '.' + (shunt ? (shunt === 'XM' ? ' Neglect the core-loss resistance.' : '') : ' The magnetising reactance and core-loss resistance can be neglected.') + ' It is connected to the rated-voltage supply and driven by a prime mover at ' + nG + ' rpm.';
      return { stem: stem, figure: imFig(m, s, shunt), given: imGiven(m, shunt).concat([['$n$', nG + ' rpm']]), parts: parts,
        notes: QB.callout('trap', 'Keep the minus signs: $s$, $R_2\'/s$, $P_{IN}$, $P_{AG}$ and $\\tau$ are all negative, and an angle near ±180° is correct.'),
        meta: { in: { VL: m.VL, f: m.f, nR: m.nR, conn: conn, R1: m.R1, R2: m.R2, X1: m.X1, X2: m.X2, XM: shunt ? m.XM : 0, RC: shunt === true ? m.RC : 0, n: nG } } };
    }
  });

  add({
    id: 'mach.im.gen.flow', course: 'mach', module: 'im', topic: 'gen',
    title: 'Induction generator power flow and efficiency',
    difficulty: 2, marks: 5, tags: ['Lecture 7.3.2', 'M8 §1.7'],
    variants: [{ id: 'torque', label: 'Given driving torque' }, { id: 'pag', label: 'Given airgap power' }, { id: 'elec', label: 'Given electrical output' }],
    gen: function (r, v) {
      var f = r.pick([50, 60]), p = r.pick([1, 2, 2, 3]), ns = 60 * f / p, ws = wOf(ns);
      var nn = ns + r.int(Math.round(0.01 * ns), Math.round(0.05 * ns)), s = (ns - nn) / ns, w = wOf(nn);
      var sc = r.pick([5, 10, 20, 50, 100]) * 1000, Pcu1 = Math.round(sc * r.float(0.015, 0.04, 3)), Pfe = Math.round(sc * r.float(0.01, 0.03, 3));
      var PAGm, meta = { f: f, p: p, n: nn, Pcu1: Pcu1, Pfe: Pfe }, given = [['poles', String(2 * p)], ['$f$', f + ' Hz'], ['$n$', nn + ' rpm'], ['stator Cu', Pcu1 + ' W'], ['iron', Pfe + ' W']], first;
      if (v === 'torque') { var T0 = Math.round(sc / w); PAGm = T0 * w / (1 - s); meta.T = T0; given.push(['$|\\tau|$', T0 + ' N m']);
        first = [$('P_{mech} = |\\tau|\\omega = ' + T0 + '\\times' + n(w) + ' = ' + W(T0 * w)), 'Shaft power ' + $('= |P_{AG}|(1 - s)') + ', so ' + $('|P_{AG}| = ' + n(T0 * w) + '/(1 - (' + n(s) + ')) = ' + W(PAGm))]; }
      else if (v === 'pag') { PAGm = sc; meta.PAG = PAGm; given.push(['$|P_{AG}|$', pe(PAGm, 'W')]); first = ['Given ' + $('|P_{AG}| = ' + W(PAGm))]; }
      else { var Pe = sc; PAGm = Pe + Pcu1 + Pfe; meta.Pe = Pe; given.push(['$P_{elec}$', pe(Pe, 'W')]); first = [$('|P_{AG}| = P_{elec} + P_{Cu1} + P_{Fe} = ' + n(Pe) + ' + ' + Pcu1 + ' + ' + Pfe + ' = ' + W(PAGm))]; }
      var Pm = PAGm * (1 - s), Pr = -s * PAGm, Pel = PAGm - Pcu1 - Pfe, tau = PAGm / ws;
      var stem = 'A ' + 2 * p + '-pole, ' + f + ' Hz induction machine is driven at ' + nn + ' rpm by a wind turbine and feeds the grid. Its stator copper loss is ' + Pcu1 + ' W and its iron loss is ' + Pfe + ' W (neglect friction). ' + (v === 'torque' ? 'The turbine applies a torque of ' + meta.T + ' N m.' : v === 'pag' ? 'The airgap power is ' + pe(PAGm, 'W') + ' (from rotor to stator).' : 'It delivers ' + pe(meta.Pe, 'W') + ' to the grid.');
      var parts = [{ q: '(a) Find the slip and the magnitude of the airgap power.', answers: [ans('s', '$s$', s, ''), ans('PAG', '$|P_{AG}|$', PAGm, 'W')], working: QB.steps([$('n_S = ' + rpm(ns)) + ', ' + $('s = (' + ns + ' - ' + nn + ')/' + ns + ' = ' + n(s)) + ' (generator)'].concat(first)) + QB.final('|P_{AG}| = ' + W(PAGm)) },
        { q: '(b) Find the mechanical input power, the rotor copper loss, the electrical output and the efficiency. What torque does the turbine apply?', answers: [ans('Pm', '$P_{mech}$', Pm, 'W'), ans('Pr', 'rotor Cu', Pr, 'W'), ans('Pel', '$P_{elec}$', Pel, 'W'), ans('eta', '$\\eta$', Pel / Pm * 100, '%'), ans('tau', '$|\\tau|$', tau, 'N·m')],
          working: QB.steps([$('P_{mech} = |P_{AG}|(1 - s) = ' + n(PAGm) + '(1 + ' + n(-s) + ') = ' + W(Pm)), $('P_{Cu2} = |s||P_{AG}| = ' + W(Pr)), $('P_{elec} = |P_{AG}| - P_{Cu1} - P_{Fe} = ' + W(Pel)), $('\\eta = P_{elec}/P_{mech} = ' + pct(Pel / Pm * 100)), $('|\\tau| = |P_{AG}|/\\omega_S = ' + Nm(tau)) + ' (' + $('= P_{mech}/\\omega') + ')']) + QB.final('P_{mech} = ' + W(Pm) + ',\\ \\eta = ' + pct(Pel / Pm * 100)) }];
      return { stem: stem, figure: null, given: given, parts: parts, notes: QB.callout('tip', 'Generator: shaft power > airgap power > electrical power. The shaft power is $|P_{AG}|(1-s)$, larger because $s < 0$.'), meta: { in: meta } };
    }
  });

  add({
    id: 'mach.im.gen.linear', course: 'mach', module: 'im', topic: 'gen',
    title: 'Motor or generator? Linear τ–n line beyond synchronous speed',
    difficulty: 1, marks: 3, tags: ['PQ 7.6(h)', 'PQ 7.7(b)', 'Jun23 Q3c(ii)'],
    variants: [{ id: 'speed', label: 'Given drive speed' }, { id: 'torque', label: 'Given driving torque' }, { id: 'slip', label: 'Given slip' }],
    gen: function (r, v) {
      var P = r.pick([1.5, 2.2, 4, 7.5, 11, 15, 30, 55, 110]) * 1000, f = r.pick([50, 60]), p = r.pick([1, 2, 2, 3, 4]), ns = 60 * f / p, sl = r.int(Math.round(0.015 * ns), Math.round(0.05 * ns)), nR = ns - sl;
      var tR = P / wOf(nR), meta = { P: P, f: f, nR: nR }, parts = [];
      parts.push({ q: '(a) Find the synchronous speed and the rated torque.', answers: [ans('ns', '$n_S$', ns, 'rpm'), ans('tR', '$\\tau_R$', tR, 'N·m')], working: QB.steps([$('p = \\lfloor 60f/n_R \\rfloor = ' + p) + ', ' + $('n_S = ' + rpm(ns)) + ', slip speed ' + sl + ' rpm', $('\\tau_R = P_R/\\omega_R = ' + n(P) + '/' + n(wOf(nR)) + ' = ' + Nm(tR))]) + QB.final('n_S = ' + rpm(ns) + ',\\ \\tau_R = ' + Nm(tR)) });
      if (v === 'torque') {
        var x = r.pick([0.5, 0.75, 1, 1.2]); meta.x = x;
        parts.push({ q: '(b) It is driven as a generator with an input torque of ' + x * 100 + ' % of rated torque. Find its speed.', answers: [ans('n', '$n$', ns + x * sl, 'rpm')], working: QB.steps(['Generator at ' + $(x + '\\tau_R') + ': slip speed ' + $('= -' + x + '\\times' + sl + ' = ' + n(-x * sl)) + ' rpm', $('n = ' + ns + ' + ' + n(x * sl) + ' = ' + rpm(ns + x * sl))]) + QB.final('n = ' + rpm(ns + x * sl)) });
      } else {
        var nn, s;
        if (v === 'speed') { nn = ns + r.int(Math.round(0.3 * sl) + 1, Math.round(1.2 * sl)); s = (ns - nn) / ns; meta.n = nn; }
        else { s = -Math.round(sl / ns * r.float(0.4, 1.2, 2) * 10000) / 10000; nn = ns * (1 - s); meta.s = s; }
        var t = tR * (ns - nn) / sl;
        parts.push({ q: '(b) ' + (v === 'speed' ? 'The machine is driven at ' + nn + ' rpm.' : 'The machine runs at a slip of ' + n(s) + '.') + ' Is it a motor or a generator? Find the speed, the torque and the mechanical power.', answers: [ans('n', '$n$', nn, 'rpm'), ans('t', '$\\tau$', t, 'N·m'), ans('P', '$P = \\tau\\omega$', t * wOf(nn), 'W')],
          working: QB.steps([v === 'speed' ? $('s = (' + ns + ' - ' + nn + ')/' + ns + ' = ' + n(s)) : $('n = (1 - s)n_S = ' + rpm(nn)), $('n > n_S') + ' (' + $('s < 0') + '): <b>generator</b>.', $('\\tau = \\tau_R\\dfrac{n_S - n}{n_S - n_R} = ' + n(tR) + '\\times\\dfrac{' + n(ns - nn) + '}{' + sl + '} = ' + Nm(t)), $('P = \\tau\\omega = ' + W(t * wOf(nn))) + ' (negative: mechanical power in)']) + QB.final('\\text{generator},\\ \\tau = ' + Nm(t)) });
      }
      return { stem: 'A ' + pe(P, 'W', 3) + ', ' + nR + ' rpm, ' + f + ' Hz three-phase induction machine operates at rated voltage. Assume a linear torque–speed line through $(n_S, 0)$ and $(n_R, \\tau_R)$.', figure: null, given: [['$P_R$', pe(P, 'W', 3)], ['$n_R$', nR + ' rpm'], ['$f$', f + ' Hz']], parts: parts, meta: { in: meta } };
    }
  });

  /* =====================================================================
   * MODULE 5 · synchronous machines and per-unit   (packs M10, M11; Jun23/Jun24 Q4, MX3 Q4)
   * ===================================================================== */
  function genRating(r) {
    var S = r.pick([50, 60, 100, 120, 150, 180, 200, 250, 300, 400]) * 1e6, V = r.pick([11, 13.8, 14, 15, 16, 18, 20]) * 1e3;
    return { S: S, V: V, ZB: V * V / S, IB: S / (SQ3 * V) };
  }
  function baseSteps(S, V, three) {
    return three === false ? [$('I_B = S_B/V_B = ' + n(S) + '/' + n(V) + ' = ' + A_(S / V)), $('Z_B = V_B^2/S_B = ' + ohm(V * V / S))]
      : [$('I_B = \\dfrac{S_B}{\\sqrt3V_B} = \\dfrac{' + n(S) + '}{\\sqrt3\\times' + n(V) + '} = ' + A_(S / (SQ3 * V))), $('Z_B = \\dfrac{V_B^2}{S_B} = \\dfrac{(' + n(V) + ')^2}{' + n(S) + '} = ' + ohm(V * V / S))];
  }
  /** terminal current phasor (pu) from |S|, V and pf sense ('lag'|'lead'|'unity'), generator output or motor input */
  function curFrom(Smag, V, pf, sense) {
    var phi = sense === 'unity' ? 0 : (sense === 'lag' ? -1 : 1) * Math.acos(pf) * 180 / PI;
    return { phi: phi, I: cx.polar(Smag / V, phi) };
  }
  function e0Steps(V, I, R, Xs, motor) {
    var Zs = cx(R || 0, Xs), IZ = I.mul(Zs), E = motor ? cx(V, 0).sub(IZ) : cx(V, 0).add(IZ);
    var st = [];
    if (motor) st.push('Motor convention (current ' + $('I_m') + ' into the machine): ' + $('E_0 = V - I_m(R + jX_S)'));
    else st.push('Generator convention (current out): ' + $('E_0 = V + I(R + jX_S)'));
    st.push($((motor ? 'I_m' : 'I') + '(' + (R ? n(R) + ' + ' : '') + 'j' + n(Xs) + ') = (' + ph(I) + ')(' + ph(Zs) + ') = ' + ph(IZ) + ' = ' + rc(IZ)));
    st.push($('E_0 = ' + n(V) + (motor ? ' - (' : ' + (') + rc(IZ) + ') = ' + rc(E) + ' = ' + ph(E) + '\\ \\text{pu}'));
    return { E: E, steps: st };
  }

  /* ---------------------------------------------------------------- sync.pu */
  add({
    id: 'mach.sync.pu.bases', course: 'mach', module: 'sync', topic: 'pu',
    title: 'Per-unit bases and conversions',
    difficulty: 1, marks: 4, tags: ['PQ 8.1', 'PQ 8.4', 'PQ 8.5', 'New Q1 (M10)', 'Playbook A'],
    variants: [{ id: '3ph', label: 'Three-phase bases' }, { id: '1ph', label: 'Single-phase bases' }, { id: 'convert', label: 'Ohms to per-unit on two systems' }, { id: 'back', label: 'Per-unit back to real units' }],
    gen: function (r, v) {
      var parts = [], stem, given, meta;
      if (v === '1ph') {
        var Vb = r.pick([120, 200, 230, 240, 415]), Sb = r.pick([500, 1000, 2000, 2500, 5000]); meta = { V: Vb, S: Sb };
        var Zx = r.pick([5, 10, 12, 25, 40, 60]); meta.Z = Zx;
        stem = 'For a single-phase system, use a base voltage of ' + Vb + ' V and a base power of ' + Sb + ' VA.';
        given = [['$V_B$', Vb + ' V'], ['$S_B$', Sb + ' VA']];
        parts.push({ q: '(a) Find the base current and base impedance (= base resistance = base reactance).', answers: [ans('IB', '$I_B$', Sb / Vb, 'A'), ans('ZB', '$Z_B$', Vb * Vb / Sb, 'Ω')], working: QB.steps(['Single-phase: no ' + $('\\sqrt3') + '.'].concat(baseSteps(Sb, Vb, false), [$('R_B = X_B = Z_B')])) + QB.final('I_B = ' + A_(Sb / Vb) + ',\\ Z_B = ' + ohm(Vb * Vb / Sb)) });
        parts.push({ q: '(b) Express a ' + Zx + ' Ω resistor in per-unit, and find the per-unit current it draws from the ' + Vb + ' V supply.', answers: [ans('Zpu', '$R$', Zx / (Vb * Vb / Sb), 'pu'), ans('Ipu', '$I$', (Vb * Vb / Sb) / Zx, 'pu')], working: QB.steps([$('R = ' + Zx + '/' + n(Vb * Vb / Sb) + ' = ' + pu(Zx / (Vb * Vb / Sb))), $('I = V/R = 1/' + n(Zx / (Vb * Vb / Sb)) + ' = ' + pu(Vb * Vb / Sb / Zx)) + ' = ' + $(A_(Vb / Zx)) + ' (check: ' + $(Vb + '/' + Zx) + ')']) + QB.final('I = ' + pu(Vb * Vb / Sb / Zx)) });
        return { stem: stem, figure: null, given: given, parts: parts, meta: { in: meta } };
      }
      if (v === 'convert') {
        var S = r.pick([500, 750, 1000, 2000]) * 1e3, V1 = r.pick([3300, 6600, 11000]), V2 = r.pick([400, 415, 690]), X1 = r.pick([2, 5, 8, 10, 15]), R2 = r.pick([0.02, 0.05, 0.08, 0.1]);
        meta = { S: S, V1: V1, V2: V2, X1: X1, R2: R2 };
        stem = 'Express the following per-phase impedances in per-unit on a three-phase base of ' + pe(S, 'VA') + ', using each system\'s nominal line voltage as its voltage base: (i) a ' + X1 + ' Ω inductive reactance on a ' + V1 + ' V line; (ii) a ' + R2 + ' Ω resistance on a ' + V2 + ' V supply.';
        given = [['$S_B$', pe(S, 'VA')], ['system (i)', V1 + ' V, j' + X1 + ' Ω'], ['system (ii)', V2 + ' V, ' + R2 + ' Ω']];
        var Z1 = V1 * V1 / S, Z2 = V2 * V2 / S;
        parts.push({ q: 'Find each base impedance and the per-unit values.', answers: [ans('ZB1', '$Z_{B1}$', Z1, 'Ω'), ans('X1', '$X$ (i)', X1 / Z1, 'pu'), ans('ZB2', '$Z_{B2}$', Z2, 'Ω'), ans('R2', '$R$ (ii)', R2 / Z2, 'pu')],
          working: QB.steps([$('Z_{B1} = ' + V1 + '^2/' + n(S) + ' = ' + ohm(Z1)) + ', ' + $('X = j' + X1 + '/' + n(Z1) + ' = j' + pu(X1 / Z1)), $('Z_{B2} = ' + V2 + '^2/' + n(S) + ' = ' + ohm(Z2)) + ', ' + $('R = ' + R2 + '/' + n(Z2) + ' = ' + pu(R2 / Z2)), 'A tiny resistance on a low-voltage system can be a large per-unit value.']) + QB.final('j' + n(X1 / Z1) + '\\ \\text{pu},\\ ' + n(R2 / Z2) + '\\ \\text{pu}') });
        return { stem: stem, figure: null, given: given, parts: parts, meta: { in: meta } };
      }
      var g = genRating(r); meta = { S: g.S, V: g.V };
      stem = 'A three-phase, star-connected system has a base of ' + pe(g.S, 'VA') + ' and ' + pe(g.V, 'V') + ' (line).';
      given = [['$S_B$', pe(g.S, 'VA')], ['$V_B$', pe(g.V, 'V') + ' (line)']];
      parts.push({ q: '(a) Find the base phase voltage, base current and base impedance.', answers: [ans('Vph', '$V_{B,ph}$', g.V / SQ3, 'V'), ans('IB', '$I_B$', g.IB, 'A'), ans('ZB', '$Z_B$', g.ZB, 'Ω')],
        working: QB.steps([$('V_{B,ph} = V_B/\\sqrt3 = ' + V_(g.V / SQ3))].concat(baseSteps(g.S, g.V), ['Check: ' + $('V_{B,ph}/I_B = ' + ohm(g.V / SQ3 / g.IB)) + '. ' + $('P_B = Q_B = S_B') + ', ' + $('R_B = X_B = Z_B') + '.'])) + QB.final('I_B = ' + A_(g.IB) + ',\\ Z_B = ' + ohm(g.ZB)) });
      if (v === 'back') {
        var Vp = r.pick([0.95, 0.97, 1.02, 1.05, 1.1]), Ip = r.pick([0.4, 0.6, 0.75, 0.9, 1.2, 2.5]), Zp = r.pick([0.15, 0.3, 0.8, 1.2, 1.8]); meta.Vp = Vp; meta.Ip = Ip; meta.Zp = Zp;
        parts.push({ q: '(b) A bus voltage is ' + Vp + ' pu, a current is ' + Ip + ' pu and a reactance is ' + Zp + ' pu. Give the line and phase voltages, the current in amps and the reactance in ohms.', answers: [ans('VL', '$V_L$', Vp * g.V, 'V'), ans('VphB', '$V_{ph}$', Vp * g.V / SQ3, 'V'), ans('I', '$I$', Ip * g.IB, 'A'), ans('X', '$X$', Zp * g.ZB, 'Ω')],
          working: QB.steps(['The pu value of a line voltage equals the pu value of the phase voltage; only the base differs:', $('V_L = ' + Vp + '\\times' + n(g.V) + ' = ' + V_(Vp * g.V)) + ', ' + $('V_{ph} = ' + V_(Vp * g.V / SQ3)), $('I = ' + Ip + '\\times' + n(g.IB) + ' = ' + A_(Ip * g.IB)), $('X = ' + Zp + '\\times' + n(g.ZB) + ' = ' + ohm(Zp * g.ZB))]) + QB.final('V_L = ' + V_(Vp * g.V) + ',\\ I = ' + A_(Ip * g.IB)) });
      } else {
        var Xo = Number((g.ZB * r.float(0.1, 2, 2)).toPrecision(3)); meta.X = Xo;
        parts.push({ q: '(b) Express a ' + n(Xo) + ' Ω per-phase reactance in per-unit.', answers: [ans('Xpu', '$X$', Xo / g.ZB, 'pu')], working: QB.steps([$('X = ' + n(Xo) + '/' + n(g.ZB) + ' = ' + pu(Xo / g.ZB))]) + QB.final('X = ' + pu(Xo / g.ZB)) });
      }
      return { stem: stem, figure: null, given: given, parts: parts, notes: QB.callout('trap', '$Z_B = V_B^2/S_B$ uses the <b>line</b> voltage and the <b>total</b> VA. Mixing phase voltage with total VA is 3 times too small.'), meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.pu.circuit', course: 'mach', module: 'sync', topic: 'pu',
    title: 'Solving a three-phase circuit in per-unit',
    difficulty: 2, marks: 5, tags: ['PQ 8.6', 'Lecture 8.3.6', 'Playbook B'],
    variants: [{ id: 'sc', label: 'Short-circuit current' }, { id: 'load', label: 'Generator feeding a resistive load' }],
    gen: function (r, v) {
      var small = r.bool(0.4);
      var S = small ? r.pick([10, 20, 50, 100]) * 1e3 : r.pick([50, 100, 150, 200]) * 1e6, V = small ? r.pick([400, 415, 440]) : r.pick([11, 13.8, 16, 18]) * 1e3;
      var ZB = V * V / S, IB = S / (SQ3 * V), E = Number((V * r.float(1.02, 1.2, 2)).toPrecision(3)), X = Number((ZB * r.float(0.15, 0.6, 2)).toPrecision(2));
      var Ep = E / V, Xp = X / ZB, meta = { S: S, V: V, E: E, X: X }, parts = [];
      var stem = 'A three-phase synchronous generator rated ' + pe(S, 'VA') + ', ' + pe(V, 'V') + ' is represented by an internal (line) voltage of ' + pe(E, 'V') + ' behind a series reactance of ' + n(X) + ' Ω per phase. Use the machine rating as the base.';
      parts.push({ q: '(a) Find the base current and base impedance, and draw the per-unit circuit.', answers: [ans('IB', '$I_B$', IB, 'A'), ans('ZB', '$Z_B$', ZB, 'Ω'), ans('E', '$E$', Ep, 'pu'), ans('X', '$X$', Xp, 'pu')],
        working: QB.steps(baseSteps(S, V).concat([$('E = ' + n(E) + '/' + n(V) + ' = ' + n(Ep) + '\\angle0^\\circ\\ \\text{pu}') + ', ' + $('jX = j' + n(X) + '/' + n(ZB) + ' = j' + pu(Xp))])) + QB.final('E = ' + pu(Ep) + ',\\ X = j' + pu(Xp)) });
      if (v === 'sc') {
        var Ipu = Ep / Xp;
        parts.push({ q: '(b) Find the short-circuit current in per-unit and in amps. Check in real units.', answers: [ans('Ipu', '$I_{SC}$', Ipu, 'pu'), ans('IA', '$I_{SC}$', Ipu * IB, 'A')],
          working: QB.steps([$('I = E/(jX) = ' + n(Ep) + '/j' + n(Xp) + ' = ' + n(Ipu) + '\\angle-90^\\circ\\ \\text{pu}'), $('I = ' + n(Ipu) + '\\times' + n(IB) + ' = ' + A_(Ipu * IB)), 'Check per phase: ' + $('E_1 = ' + n(E) + '/\\sqrt3 = ' + V_(E / SQ3)) + ', ' + $('I = E_1/X = ' + A_(E / SQ3 / X))]) + QB.final('I_{SC} = ' + pu(Ipu) + ' = ' + A_(Ipu * IB)) });
      } else {
        var RL = Number((ZB * r.float(0.8, 2.5, 2)).toPrecision(3)); meta.RL = RL;
        var Rp = RL / ZB, Z = cx(Rp, Xp), I = cx(Ep, 0).div(Z), Vt = I.abs() * Rp, P = I.abs() * I.abs() * Rp;
        parts.push({ q: '(b) The generator supplies a balanced star-connected resistive load of ' + n(RL) + ' Ω per phase. Find the current, the terminal voltage (pu and line volts) and the power delivered.', answers: [ans('I', '$|I|$', I.abs(), 'pu'), ans('Vt', '$|V|$', Vt, 'pu'), ans('VL', '$V_L$', Vt * V, 'V'), ans('P', '$P$', P * S, 'W')],
          working: QB.steps([$('R_L = ' + n(RL) + '/' + n(ZB) + ' = ' + pu(Rp)), $('I = \\dfrac{E}{R_L + jX} = \\dfrac{' + n(Ep) + '}{' + rc(Z) + '} = ' + ph(I) + '\\ \\text{pu}') + ' = ' + $(A_(I.abs() * IB)), $('|V| = |I|R_L = ' + pu(Vt)) + ' → ' + $('V_L = ' + V_(Vt * V)), $('P = |I|^2R_L = ' + pu(P)) + ' = ' + $(W(P * S)) + ' (no ' + $('\\sqrt3') + ' or 3 in pu)']) + QB.final('P = ' + W(P * S)) });
      }
      return { stem: stem, figure: figSync({ E: 'E', X: v === 'sc' ? n(X) + ' Ω' : n(X) + ' Ω', V: v === 'sc' ? '0 (short)' : 'V', gen: true }), given: [['$S$', pe(S, 'VA')], ['$V$', pe(V, 'V')], ['$E$', pe(E, 'V') + ' (line)'], ['$X$', pv(X, 'Ω')]], parts: parts, meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.pu.basechange', course: 'mach', module: 'sync', topic: 'pu',
    title: 'Changing the per-unit base',
    difficulty: 2, marks: 5, tags: ['base change'],
    variants: [{ id: 'S', label: 'New VA base' }, { id: 'VS', label: 'New voltage and VA base' }, { id: 'combine', label: 'Generator and transformer on a common base' }],
    gen: function (r, v) {
      var parts = [], meta;
      var rule = $('Z_{pu,new} = Z_{pu,old}\\left(\\dfrac{V_{old}}{V_{new}}\\right)^2\\dfrac{S_{new}}{S_{old}}') + ' (the ohmic value is the same on both bases: ' + $('Z_\\Omega = Z_{pu}V_B^2/S_B') + ')';
      if (v === 'combine') {
        var Sg = r.pick([50, 80, 100, 150, 200]) * 1e6, Vg = r.pick([11, 13.8, 15, 18]) * 1e3, Xg = r.pick([0.15, 0.18, 0.2, 0.25, 0.3]);
        var St = r.pick([60, 100, 120, 150, 250]) * 1e6, Vh = r.pick([66, 110, 132, 220, 275]) * 1e3, Xt = r.pick([0.08, 0.1, 0.12, 0.15]);
        var SB = 100e6; meta = { Sg: Sg, Vg: Vg, Xg: Xg, St: St, Vh: Vh, Xt: Xt };
        var Xg2 = Xg * SB / Sg, Xt2 = Xt * SB / St, Ipu = 1 / (Xg2 + Xt2), IBh = SB / (SQ3 * Vh);
        var stem = 'A ' + pe(Sg, 'VA') + ', ' + pe(Vg, 'V') + ' generator has a reactance of ' + Xg + ' pu on its own rating. It feeds a ' + pe(St, 'VA') + ', ' + pe(Vg, 'V') + '/' + pe(Vh, 'V') + ' transformer with a leakage reactance of ' + Xt + ' pu on its own rating. Use a common base of 100 MVA, with ' + pe(Vg, 'V') + ' on the generator side and ' + pe(Vh, 'V') + ' on the high-voltage side.';
        parts.push({ q: '(a) Convert both reactances to the common base.', answers: [ans('Xg', '$X_g$', Xg2, 'pu'), ans('Xt', '$X_t$', Xt2, 'pu')], working: QB.steps([rule, 'The voltage bases match the ratings (the transformer ratio), so only ' + $('S') + ' changes:', $('X_g = ' + Xg + '\\times\\dfrac{100}{' + n(Sg / 1e6) + '} = ' + pu(Xg2)), $('X_t = ' + Xt + '\\times\\dfrac{100}{' + n(St / 1e6) + '} = ' + pu(Xt2)), 'With base voltages in the turns ratio, the ideal transformer disappears from the pu circuit.']) + QB.final('X_g = ' + pu(Xg2) + ',\\ X_t = ' + pu(Xt2)) });
        parts.push({ q: '(b) The generator is on no load at rated voltage ($E = 1$ pu) when a three-phase short circuit occurs at the transformer high-voltage terminals. Find the fault current in pu and in amps on the high-voltage side.', answers: [ans('Ipu', '$I_F$', Ipu, 'pu'), ans('IA', '$I_F$', Ipu * IBh, 'A')], working: QB.steps([$('I_F = \\dfrac{1}{j(' + n(Xg2) + ' + ' + n(Xt2) + ')} = ' + n(Ipu) + '\\angle-90^\\circ\\ \\text{pu}'), $('I_{B,HV} = \\dfrac{100\\times10^6}{\\sqrt3\\times' + n(Vh) + '} = ' + A_(IBh)), $('I_F = ' + n(Ipu) + '\\times' + n(IBh) + ' = ' + A_(Ipu * IBh))]) + QB.final('I_F = ' + pu(Ipu) + ' = ' + A_(Ipu * IBh)) });
        return { stem: stem, figure: null, given: [['generator', pe(Sg, 'VA') + ', ' + pe(Vg, 'V') + ', ' + Xg + ' pu'], ['transformer', pe(St, 'VA') + ', ' + Xt + ' pu'], ['$S_B$', '100 MVA']], parts: parts, meta: { in: meta } };
      }
      var S1 = r.pick([50, 75, 100, 150, 200, 250]) * 1e6, V1 = r.pick([11, 13.8, 15, 18]) * 1e3, X1 = r.pick([1.2, 1.5, 1.8, 2.0, 2.2]);
      var S2 = r.pick([100, 500, 1000].filter(function (x) { return x * 1e6 !== S1; })) * 1e6, V2 = v === 'VS' ? V1 * r.pick([0.95, 1.05, 1.1, 0.9]) : V1;
      V2 = Math.round(V2 / 100) * 100; meta = { S1: S1, V1: V1, X1: X1, S2: S2, V2: V2 };
      var X2 = X1 * (V1 / V2) * (V1 / V2) * S2 / S1, Xo = X1 * V1 * V1 / S1;
      var stem2 = 'A ' + pe(S1, 'VA') + ', ' + pe(V1, 'V') + ' synchronous generator has $X_S = ' + X1 + '$ pu on its own rating. A system study uses a base of ' + pe(S2, 'VA') + ' and ' + pe(V2, 'V') + '.';
      parts.push({ q: '(a) Find $X_S$ in ohms.', answers: [ans('Xo', '$X_S$', Xo, 'Ω')], working: QB.steps([$('Z_{B,old} = ' + n(V1) + '^2/' + n(S1) + ' = ' + ohm(V1 * V1 / S1)), $('X_S = ' + X1 + '\\times' + n(V1 * V1 / S1) + ' = ' + ohm(Xo))]) + QB.final('X_S = ' + ohm(Xo)) });
      parts.push({ q: '(b) Find $X_S$ in per-unit on the system base. Check it through the ohmic value.', answers: [ans('X2', '$X_S$ (new)', X2, 'pu')], working: QB.steps([rule, $('X_{new} = ' + X1 + '\\times\\left(\\dfrac{' + n(V1 / 1e3) + '}{' + n(V2 / 1e3) + '}\\right)^2\\times\\dfrac{' + n(S2 / 1e6) + '}{' + n(S1 / 1e6) + '} = ' + pu(X2)), 'Check: ' + $('Z_{B,new} = ' + n(V2) + '^2/' + n(S2) + ' = ' + ohm(V2 * V2 / S2)) + ', ' + $(n(Xo) + '/' + n(V2 * V2 / S2) + ' = ' + pu(Xo / (V2 * V2 / S2)))]) + QB.final('X_S = ' + pu(X2)) });
      return { stem: stem2, figure: null, given: [['rating', pe(S1, 'VA') + ', ' + pe(V1, 'V')], ['$X_S$', X1 + ' pu (own base)'], ['new base', pe(S2, 'VA') + ', ' + pe(V2, 'V')]], parts: parts, meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.pu.VI', course: 'mach', module: 'sync', topic: 'pu',
    title: 'Per-unit V and I phasors from the load',
    difficulty: 1, marks: 3, tags: ['exam-style', 'Jun23 Q4a(ii)', 'Jun24 Q4a(ii)', 'PQ 8.7', 'Playbook D'],
    variants: [{ id: 'lag', label: 'S and pf lagging' }, { id: 'lead', label: 'S and pf leading' }, { id: 'MW', label: 'MW at a pf' }, { id: 'PQ', label: 'MW and MVAr delivered' }, { id: 'absorb', label: 'MW delivered, MVAr absorbed' }],
    gen: function (r, v) {
      var g = genRating(r), Vp = r.pick([0.95, 0.97, 0.98, 1, 1, 1.02, 1.03, 1.05]), meta = { S: g.S, V: g.V, Vp: Vp }, Sp, phi, stem, w = [];
      var vtxt = Vp === 1 ? 'at rated terminal voltage' : 'with the terminal voltage ' + Math.round(Math.abs(Vp - 1) * 100) + ' % ' + (Vp > 1 ? 'above' : 'below') + ' rated';
      if (v === 'lag' || v === 'lead') {
        var fr = r.pick([0.5, 0.6, 0.75, 0.8, 1]), pf = pickPF(r); meta.fr = fr; meta.pf = pf; meta.sense = v;
        Sp = fr; phi = (v === 'lag' ? -1 : 1) * Math.acos(pf) * 180 / PI;
        stem = 'A ' + pe(g.S, 'VA') + ', ' + pe(g.V, 'V') + ' synchronous generator delivers ' + (fr === 1 ? 'its rated VA' : fr + ' of its rated VA') + ' at a power factor of ' + pf + ' ' + (v === 'lag' ? 'lagging' : 'leading') + ', ' + vtxt + '.';
        w.push($('S = ' + fr + '\\ \\text{pu}') + ' (VA, not W)', $('\\phi = ' + (v === 'lag' ? '-' : '+') + '\\cos^{-1}' + pf + ' = ' + ang(phi)) + ' (' + (v === 'lag' ? 'lagging: I behind V' : 'leading: I ahead of V') + ')');
      } else if (v === 'MW') {
        var pf2 = pickPF(r), P = Math.round(g.S / 1e6 * r.float(0.4, 0.9, 2)) * 1e6; if (P / pf2 > g.S) P = Math.round(0.8 * pf2 * g.S / 1e6) * 1e6;
        meta.P = P; meta.pf = pf2; var sense = r.pick(['lag', 'lead']); meta.sense = sense;
        Sp = P / g.S / pf2; phi = (sense === 'lag' ? -1 : 1) * Math.acos(pf2) * 180 / PI;
        stem = 'A ' + pe(g.S, 'VA') + ', ' + pe(g.V, 'V') + ' synchronous generator delivers ' + pe(P, 'W') + ' at a power factor of ' + pf2 + ' ' + (sense === 'lag' ? 'lagging' : 'leading') + ', ' + vtxt + '.';
        w.push($('P = ' + n(P / 1e6) + '/' + n(g.S / 1e6) + ' = ' + pu(P / g.S)), $('S = P/\\text{pf} = ' + pu(Sp)) + ' (MW is not MVA)', $('\\phi = ' + (sense === 'lag' ? '-' : '+') + '\\cos^{-1}' + pf2 + ' = ' + ang(phi)));
      } else {
        var Pm = Math.round(g.S / 1e6 * r.float(0.4, 0.8, 2)) * 1e6, Qm = Math.round(g.S / 1e6 * r.float(0.1, 0.4, 2)) * 1e6 * (v === 'absorb' ? -1 : 1);
        meta.P = Pm; meta.Q = Qm;
        var Sc = cx(Pm / g.S, Qm / g.S); Sp = Sc.abs(); phi = -Sc.argd();
        stem = 'A ' + pe(g.S, 'VA') + ', ' + pe(g.V, 'V') + ' synchronous generator delivers ' + pe(Pm, 'W') + ' and ' + (v === 'absorb' ? '<b>absorbs</b> ' + pe(-Qm, 'VAr') + ' from the grid' : 'delivers ' + pe(Qm, 'VAr')) + ', ' + vtxt + '.';
        w.push($('\\mathbf S = \\dfrac{' + n(Pm / 1e6) + (Qm < 0 ? ' - j' : ' + j') + n(Math.abs(Qm) / 1e6) + '}{' + n(g.S / 1e6) + '} = ' + rc(Sc) + '\\ \\text{pu}') + ', ' + $('|S| = ' + pu(Sp)), $('\\mathbf I = (\\mathbf S/\\mathbf V)^*') + ': ' + $('\\phi = -\\tan^{-1}(Q/P) = ' + ang(phi)) + (Qm < 0 ? ' (absorbing Q: leading)' : ' (delivering Q: lagging)'));
      }
      var I = cx.polar(Sp / Vp, phi);
      w.push($('|I| = S/V = ' + n(Sp) + '/' + n(Vp) + ' = ' + pu(Sp / Vp)) + ' (use the actual V)', $('\\mathbf V = ' + n(Vp) + '\\angle0^\\circ\\ \\text{pu},\\quad \\mathbf I = ' + ph(I) + '\\ \\text{pu}'), 'In amps: ' + $('I_B = ' + A_(g.IB)) + ', ' + $('I = ' + A_(I.abs() * g.IB)));
      return { stem: stem + ' Use the generator rating as the base and the terminal voltage as the reference.', figure: null, given: [['$S_B$', pe(g.S, 'VA')], ['$V_B$', pe(g.V, 'V')]],
        parts: [{ q: 'Find the per-unit stator voltage and current phasors (magnitude and phase), and the current in amps.', answers: [ans('V', '$|V|$', Vp, 'pu'), ans('I', '$|I|$', I.abs(), 'pu'), ans('phi', '$\\angle I$', phi, '°'), ans('IA', '$I$', I.abs() * g.IB, 'A')], working: QB.steps(w) + QB.final('\\mathbf V = ' + n(Vp) + '\\angle0^\\circ,\\ \\mathbf I = ' + ph(I) + '\\ \\text{pu}') }],
        notes: QB.callout('trap', 'Generator: lagging (delivering Q) means a <b>negative</b> current angle; leading (absorbing Q) a positive one.'), meta: { in: meta } };
    }
  });

  /* ---------------------------------------------------------------- sync.xs */
  function xsTest(r) {
    var g = genRating(r), Xp = r.float(1.0, 2.6, 2), Rp = r.float(0.005, 0.25, 3);
    var R = Math.max(0.01, Math.round(Rp * g.ZB * 100) / 100);
    var IF1 = r.pick([100, 150, 160, 180, 200, 240, 270, 300]), IFt = Math.round(IF1 * r.float(0.25, 0.6, 2) / 10) * 10;
    var Voc = Math.round(g.V * IFt / IF1 / 100) * 100;
    var Zs = Math.hypot(R, Xp * g.ZB), Isc = Math.round(Voc / SQ3 / Zs / 10) * 10;
    return { g: g, R: R, IF: IFt, Voc: Voc, Isc: Isc };
  }
  function xsSolve(t) {
    var Eph = t.Voc / SQ3, Zs = Eph / t.Isc, Xs = Math.sqrt(Zs * Zs - t.R * t.R);
    return { Eph: Eph, Zs: Zs, Xs: Xs, Xpu: Xs / t.g.ZB, Rpu: t.R / t.g.ZB, IF1: t.IF * t.g.V / t.Voc };
  }
  function xsSteps(t, z) {
    return ['Both readings are at the same ' + $('I_F = ' + t.IF) + ' A. The OC voltage is a <b>line</b> value:', $('E_{0,ph} = ' + n(t.Voc) + '/\\sqrt3 = ' + V_(z.Eph)), $('|Z_S| = \\dfrac{E_{0,ph}}{I_{SC}} = \\dfrac{' + n(z.Eph) + '}{' + n(t.Isc) + '} = ' + ohm(z.Zs)), $('X_S = \\sqrt{|Z_S|^2 - R^2} = \\sqrt{' + n(z.Zs) + '^2 - ' + n(t.R) + '^2} = ' + ohm(z.Xs))];
  }
  add({
    id: 'mach.sync.xs.tests', course: 'mach', module: 'sync', topic: 'xs',
    title: 'Synchronous reactance from open- and short-circuit tests',
    difficulty: 2, marks: 5, tags: ['exam-style', 'Jun23 Q4a(i)', 'Jun24 Q4a(i)', 'MX3 4a', 'PQ 8.10', 'Playbook C'],
    variants: [{ id: 'ohms', label: 'Test table, answer in ohms' }, { id: 'pu', label: 'Test table, answer in per-unit' }, { id: 'slopes', label: 'OC and SC slopes' }],
    gen: function (r, v) {
      var t = xsTest(r), g = t.g, parts = [], meta = { S: g.S, V: g.V, R: t.R };
      if (v === 'slopes') {
        var kOC = Math.round(t.Voc / t.IF), kSC = Math.round(t.Isc / t.IF); meta.kOC = kOC; meta.kSC = kSC;
        var Eph = kOC / SQ3, Zs = Eph / kSC, Xs = Math.sqrt(Zs * Zs - t.R * t.R), IF1 = g.V / kOC, E0 = r.pick([1.3, 1.5, 1.65, 1.8, 2.1]); meta.E0 = E0;
        var stem = 'A ' + pe(g.S, 'VA') + ', ' + pe(g.V, 'V') + ', star-connected synchronous generator is tested. Open-circuit test: slope of the linear portion ' + kOC + ' V (line) per field amp. Short-circuit test: slope ' + kSC + ' A per field amp. The stator resistance is ' + n(t.R) + ' Ω per phase. Neglect saturation.';
        parts.push({ q: '(a) Find the base current and base impedance.', answers: [ans('IB', '$I_B$', g.IB, 'A'), ans('ZB', '$Z_B$', g.ZB, 'Ω')], working: QB.steps(baseSteps(g.S, g.V)) + QB.final('I_B = ' + A_(g.IB) + ',\\ Z_B = ' + ohm(g.ZB)) });
        parts.push({ q: '(b) Find the unsaturated synchronous reactance in per-unit.', answers: [ans('Xpu', '$X_S$', Xs / g.ZB, 'pu')], working: QB.steps(['Choose ' + $('I_F = 1') + ' A: ' + $('V_{OC} = ' + kOC) + ' V (line), ' + $('I_{SC} = ' + kSC) + ' A.', $('|Z_S| = \\dfrac{' + kOC + '/\\sqrt3}{' + kSC + '} = ' + ohm(Zs)), $('X_S = \\sqrt{' + n(Zs) + '^2 - ' + n(t.R) + '^2} = ' + ohm(Xs)), $('X_S = ' + n(Xs) + '/' + n(g.ZB) + ' = ' + pu(Xs / g.ZB))]) + QB.final('X_S = ' + pu(Xs / g.ZB)) });
        parts.push({ q: '(c) What field current is needed for synchronisation ($E_0$ = rated voltage)? What field current gives $E_0 = ' + E0 + '$ pu?', answers: [ans('IF1', '$I_F$ (sync)', IF1, 'A'), ans('IF2', '$I_F$', E0 * IF1, 'A')], working: QB.steps([$('I_F = ' + n(g.V) + '/' + kOC + ' = ' + A_(IF1)) + ' (this gives ' + $('E_0 = 1') + ' pu)', $('I_F = ' + E0 + '\\times' + n(IF1) + ' = ' + A_(E0 * IF1)) + ' (linear, unsaturated)']) + QB.final(A_(IF1) + ',\\ ' + A_(E0 * IF1)) });
        return { stem: stem, figure: figOCSC({ Voc: kOC + ' V/A', Isc: kSC + ' A/A', IF: '1 A' }), given: [['rating', pe(g.S, 'VA') + ', ' + pe(g.V, 'V')], ['OC slope', kOC + ' V/A'], ['SC slope', kSC + ' A/A'], ['$R$', pv(t.R, 'Ω')]], parts: parts, meta: { in: meta } };
      }
      meta.IF = t.IF; meta.Voc = t.Voc; meta.Isc = t.Isc;
      var z = xsSolve(t);
      var stem2 = 'A ' + pe(g.S, 'VA') + ', ' + pe(g.V, 'V') + ', 50 Hz, star-connected synchronous generator gives these test results: at a field current of ' + t.IF + ' A the open-circuit line voltage is ' + pe(t.Voc, 'V') + ' and the short-circuit current is ' + pe(t.Isc, 'A') + '. The stator resistance is ' + n(t.R) + ' Ω per phase.';
      parts.push({ q: v === 'ohms' ? '(a) Find the synchronous reactance in ohms (not per-unit).' : '(a) Find the synchronous reactance and the stator resistance in per-unit.', answers: v === 'ohms' ? [ans('Zs', '$|Z_S|$', z.Zs, 'Ω'), ans('Xs', '$X_S$', z.Xs, 'Ω')] : [ans('Xpu', '$X_S$', z.Xpu, 'pu'), ans('Rpu', '$R$', z.Rpu, 'pu')],
        working: QB.steps(xsSteps(t, z).concat(v === 'ohms' ? ['Stop here: the question asks for ohms.'] : [$('Z_B = ' + n(g.V) + '^2/' + n(g.S) + ' = ' + ohm(g.ZB)), $('X_S = ' + n(z.Xs) + '/' + n(g.ZB) + ' = ' + pu(z.Xpu)) + ', ' + $('R = ' + n(t.R) + '/' + n(g.ZB) + ' = ' + pu(z.Rpu))])) + QB.final(v === 'ohms' ? 'X_S = ' + ohm(z.Xs) : 'X_S = ' + pu(z.Xpu)) });
      parts.push({ q: '(b) What field current gives rated voltage on open circuit (assume the OC characteristic is linear)?', answers: [ans('IF1', '$I_F$', z.IF1, 'A')], working: QB.steps([$('I_F = ' + t.IF + '\\times\\dfrac{' + n(g.V) + '}{' + n(t.Voc) + '} = ' + A_(z.IF1))]) + QB.final('I_F = ' + A_(z.IF1)) });
      return { stem: stem2, figure: figOCSC({ Voc: pe(t.Voc, 'V'), Isc: pe(t.Isc, 'A'), IF: t.IF + ' A' }), given: [['rating', pe(g.S, 'VA') + ', ' + pe(g.V, 'V')], ['$I_F$', t.IF + ' A'], ['$V_{OC}$', pe(t.Voc, 'V') + ' (line)'], ['$I_{SC}$', pe(t.Isc, 'A')], ['$R$', pv(t.R, 'Ω')]], parts: parts,
        notes: QB.callout('trap', 'Divide the OC line voltage by $\\sqrt3$ before dividing by $I_{SC}$, and answer in the units asked (ohms in Jun23, pu in Jun24).'), meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.xs.chain', course: 'mach', module: 'sync', topic: 'xs',
    title: 'From test results to E0, rotor angle and field current',
    difficulty: 3, marks: 9, tags: ['PQ 8.11', 'PQ 8.12', 'New Q4 (M10)', 'Playbook E'],
    variants: [{ id: 'lag', label: 'Lagging pf' }, { id: 'lead', label: 'Leading pf' }, { id: 'unity', label: 'Unity pf' }],
    gen: function (r, v) {
      var t = xsTest(r), g = t.g, z = xsSolve(t), pf = v === 'unity' ? 1 : pickPF(r), Vp = r.pick([0.97, 1, 1, 1.02, 1.05]);
      var Pmw = Math.round(g.S / 1e6 * pf * r.float(0.6, 1, 2)), Sp = Pmw * 1e6 / g.S / pf;
      var c = curFrom(Sp, Vp, pf, v), e = e0Steps(Vp, c.I, z.Rpu, z.Xpu, false), E = e.E;
      var meta = { S: g.S, V: g.V, R: t.R, IF: t.IF, Voc: t.Voc, Isc: t.Isc, P: Pmw * 1e6, pf: pf, sense: v, Vp: Vp };
      var stem = 'A ' + pe(g.S, 'VA') + ', ' + pe(g.V, 'V') + ', star-connected synchronous generator gives an open-circuit line voltage of ' + pe(t.Voc, 'V') + ' at a field current of ' + t.IF + ' A, and a short-circuit current of ' + pe(t.Isc, 'A') + ' at the same field current. The stator resistance is ' + n(t.R) + ' Ω. It supplies ' + Pmw + ' MW at ' + (v === 'unity' ? 'unity power factor' : 'a power factor of ' + pf + ' ' + (v === 'lag' ? 'lagging' : 'leading')) + ' with the terminal voltage ' + (Vp === 1 ? 'at rated value' : Math.round(Math.abs(Vp - 1) * 100) + ' % ' + (Vp > 1 ? 'above' : 'below') + ' rated') + '. Ignore saturation.';
      var parts = [{ q: '(a) Find $X_S$ and $R$ in per-unit.', answers: [ans('Xpu', '$X_S$', z.Xpu, 'pu'), ans('Rpu', '$R$', z.Rpu, 'pu')], working: QB.steps(xsSteps(t, z).concat([$('Z_B = ' + ohm(g.ZB)) + ', ' + $('X_S = ' + pu(z.Xpu)) + ', ' + $('R = ' + pu(z.Rpu))])) + QB.final('X_S = ' + pu(z.Xpu) + ',\\ R = ' + pu(z.Rpu)) },
        { q: '(b) Find the stator current phasor in per-unit and in amps.', answers: [ans('I', '$|I|$', c.I.abs(), 'pu'), ans('phi', '$\\angle I$', c.phi, '°'), ans('IA', '$I$', c.I.abs() * g.IB, 'A')], working: QB.steps([$('P = ' + Pmw + '/' + n(g.S / 1e6) + ' = ' + pu(Pmw * 1e6 / g.S)) + ', ' + $('S = P/\\text{pf} = ' + pu(Sp)), $('\\mathbf I = \\dfrac{S}{V}\\angle' + (v === 'unity' ? '0' : (v === 'lag' ? '-' : '+') + '\\cos^{-1}' + pf) + ' = ' + ph(c.I) + '\\ \\text{pu}'), $('I = ' + n(c.I.abs()) + '\\times' + n(g.IB) + ' = ' + A_(c.I.abs() * g.IB))]) + QB.final('\\mathbf I = ' + ph(c.I) + '\\ \\text{pu}') },
        { q: '(c) Find $E_0$ (pu, magnitude and angle), $E_0$ as a line voltage, the rotor angle and the field current. What is the ratio of this field current to the synchronising value?', answers: [ans('E0', '$|E_0|$', E.abs(), 'pu'), ans('delta', '$\\delta$', E.argd(), '°'), ans('E0L', '$E_{0,L}$', E.abs() * g.V, 'V'), ans('IF', '$I_F$', E.abs() * z.IF1, 'A')],
          working: QB.steps(e.steps.concat([$('E_{0,L} = ' + n(E.abs()) + '\\times' + n(g.V) + ' = ' + V_(E.abs() * g.V)), 'Rotor angle ' + $('\\delta = ' + ang(E.argd())) + ' (positive: generating)', $('I_F(E_0 = 1) = ' + t.IF + '\\times' + n(g.V) + '/' + n(t.Voc) + ' = ' + A_(z.IF1)) + ', so ' + $('I_F = ' + n(E.abs()) + '\\times' + n(z.IF1) + ' = ' + A_(E.abs() * z.IF1)) + '; ratio ' + $('= |E_0| = ' + n(E.abs()))])) + QB.final('E_0 = ' + ph(E) + '\\ \\text{pu},\\ I_F = ' + A_(E.abs() * z.IF1)) }];
      return { stem: stem, figure: figSync({ E: 'E_0', R: pv(z.Rpu, 'pu'), X: 'j' + F.num(z.Xpu, 4) + ' pu', V: n(Vp) + ' pu', gen: true }), given: [['rating', pe(g.S, 'VA') + ', ' + pe(g.V, 'V')], ['test at ' + t.IF + ' A', pe(t.Voc, 'V') + ' OC, ' + pe(t.Isc, 'A') + ' SC'], ['$R$', pv(t.R, 'Ω')], ['load', Pmw + ' MW, pf ' + pf + (v === 'unity' ? '' : ' ' + v)]], parts: parts, meta: { in: meta } };
    }
  });

  /* ---------------------------------------------------------------- sync.phasor */
  add({
    id: 'mach.sync.phasor.gen', course: 'mach', module: 'sync', topic: 'phasor',
    title: 'Generator E0 and rotor angle from terminal conditions',
    difficulty: 2, marks: 5, tags: ['exam-style', 'Jun24 Q4b(i)–(ii)', 'PQ 8.8', 'MX3 4b', 'Playbook A (M11)'],
    variants: [{ id: 'lag', label: 'Lagging pf (over-excited)' }, { id: 'lead', label: 'Leading pf (under-excited)' }, { id: 'unity', label: 'Unity pf' }],
    gen: function (r, v) {
      var Xs = r.pick([0.9, 1.0, 1.2, 1.339, 1.5, 1.6, 1.8, 2.0]), Vp = r.pick([0.95, 1, 1, 1, 1.02, 1.05]), pf = v === 'unity' ? 1 : pickPF(r), Sp = r.pick([0.5, 0.6, 0.75, 0.8, 0.9, 1]);
      var IF1 = r.bool(0.5) ? r.pick([120, 150, 200, 250, 270, 300]) : 0;
      var c = curFrom(Sp, Vp, pf, v), e = e0Steps(Vp, c.I, 0, Xs, false), E = e.E;
      var Q = (Vp * E.abs() * Math.cos(E.arg()) - Vp * Vp) / Xs;
      var parts = [{ q: '(a) Find the stator current phasor.', answers: [ans('I', '$|I|$', c.I.abs(), 'pu'), ans('phi', '$\\angle I$', c.phi, '°')], working: QB.steps([$('\\mathbf V = ' + n(Vp) + '\\angle0^\\circ\\ \\text{pu}') + ', ' + $('S = ' + Sp + '\\ \\text{pu}'), $('|I| = S/V = ' + pu(Sp / Vp)) + ', ' + $('\\phi = ' + ang(c.phi)) + ' (' + lagLead(c.phi) + ')', $('\\mathbf I = ' + ph(c.I) + ' = ' + rc(c.I) + '\\ \\text{pu}')]) + QB.final('\\mathbf I = ' + ph(c.I) + '\\ \\text{pu}') },
        { q: '(b) Find the excitation $E_0$ in per-unit and the rotor angle. Is the machine over- or under-excited?' + (IF1 ? ' Find the field current if ' + IF1 + ' A gives $E_0 = 1$ pu.' : ''), answers: [ans('E0', '$|E_0|$', E.abs(), 'pu'), ans('delta', '$\\delta$', E.argd(), '°')].concat(IF1 ? [ans('IF', '$I_F$', E.abs() * IF1, 'A')] : []),
          working: QB.steps(e.steps.concat(['Rotor angle ' + $('\\delta = ' + ang(E.argd())) + ' (positive: generating)', $('E_0\\cos\\delta = ' + n(E.abs() * Math.cos(E.arg()))) + (Q > 1e-9 ? ' > V: <b>over-excited</b>, delivers ' + $('Q = ' + pu(Q)) : Q < -1e-9 ? ' < V: <b>under-excited</b>, absorbs ' + $('|Q| = ' + pu(-Q)) : ' = V: normal excitation, Q = 0'), IF1 ? $('I_F = ' + n(E.abs()) + '\\times' + IF1 + ' = ' + A_(E.abs() * IF1)) : null])) + QB.final('E_0 = ' + ph(E) + '\\ \\text{pu}') }];
      var pf0 = phasorFig([{ re: Vp, im: 0, label: 'V' }, { re: c.I.re, im: c.I.im, label: 'I' }, { re: E.re, im: E.im, label: 'E_0' }]);
      if (pf0) parts[1].working += figBlock(pf0);
      return { stem: 'A round-rotor synchronous generator has a synchronous reactance of ' + Xs + ' pu. It delivers ' + (Sp === 1 ? 'its rated volt-amp output' : Sp + ' pu VA') + ' at ' + (v === 'unity' ? 'unity power factor' : pf + ' ' + (v === 'lag' ? 'lagging' : 'leading') + ' power factor') + ' with a terminal voltage of ' + Vp + ' pu. Neglect resistance and saturation.',
        figure: figSync({ E: 'E_0', X: 'j' + Xs + ' pu', V: Vp + ' pu', gen: true }), given: [['$X_S$', Xs + ' pu'], ['$V$', Vp + ' pu'], ['$S$', Sp + ' pu'], ['pf', pf + (v === 'unity' ? '' : ' ' + v)]], parts: parts,
        notes: QB.callout('trap', 'Leading output current means $+\\cos^{-1}$pf. Using the wrong sign gives a completely different $E_0$.'), meta: { in: { Xs: Xs, Vp: Vp, pf: pf, S: Sp, sense: v, IF1: IF1 } } };
    }
  });

  add({
    id: 'mach.sync.phasor.motor', course: 'mach', module: 'sync', topic: 'phasor',
    title: 'Synchronous motor E0 and rotor angle (motor convention)',
    difficulty: 2, marks: 5, tags: ['Worked Example 4 (M10)', 'New Q5 (M10)', 'Example 4 (M11)'],
    variants: [{ id: 'lead', label: 'Leading input pf (over-excited)' }, { id: 'lag', label: 'Lagging input pf (under-excited)' }, { id: 'unity', label: 'Unity pf' }],
    gen: function (r, v) {
      var S = r.pick([100, 250, 400, 500, 1000, 2000]) * 1e3, VL = r.pick([415, 415, 690, 3300, 6600, 11000]), Xs = r.pick([0.8, 0.9, 1.0, 1.2, 1.5]);
      var pf = v === 'unity' ? 1 : pickPF(r), P = Math.round(S / 1e3 * pf * r.float(0.5, 1, 2)) * 1e3, Sp = P / S / pf;
      var IB = S / (SQ3 * VL), c = curFrom(Sp, 1, pf, v), e = e0Steps(1, c.I, 0, Xs, true), E = e.E;
      var parts = [{ q: '(a) Find the input current in per-unit and in amps.', answers: [ans('I', '$|I_m|$', c.I.abs(), 'pu'), ans('phi', '$\\angle I_m$', c.phi, '°'), ans('IA', '$I_m$', c.I.abs() * IB, 'A')],
        working: QB.steps([$('I_B = \\dfrac{' + n(S) + '}{\\sqrt3\\times' + VL + '} = ' + A_(IB)), $('P = ' + n(P / 1e3) + '/' + n(S / 1e3) + ' = ' + pu(P / S)) + ', ' + $('S = P/\\text{pf} = ' + pu(Sp)), 'Input current ' + lagLead(c.phi) + ': ' + $('\\mathbf I_m = ' + ph(c.I) + ' = ' + rc(c.I) + '\\ \\text{pu}') + ' = ' + $(A_(c.I.abs() * IB))]) + QB.final('\\mathbf I_m = ' + ph(c.I) + '\\ \\text{pu}') },
        { q: '(b) Using the motor convention (current into the machine), find $E_0$ in per-unit and as a line voltage, and the rotor angle.', answers: [ans('E0', '$|E_0|$', E.abs(), 'pu'), ans('delta', '$\\delta$', E.argd(), '°'), ans('E0L', '$E_{0,L}$', E.abs() * VL, 'V')],
          working: QB.steps(e.steps.concat([$('E_{0,L} = ' + n(E.abs()) + '\\times' + VL + ' = ' + V_(E.abs() * VL)), 'Course check: the generator-convention current is ' + $('I = -I_m = ' + ph(c.I.neg())) + ', and ' + $('V + jX_SI') + ' gives the same ' + $('E_0') + '.',
            $('\\delta = ' + ang(E.argd()) + ' < 0') + ': motoring. ' + (v === 'lead' ? 'Leading input means over-excited (' + $('E_0\\cos\\delta > V') + '): the motor <b>supplies</b> Q.' : v === 'lag' ? 'Lagging input means under-excited: the motor absorbs Q.' : 'Unity pf: Q = 0.')])) + QB.final('E_0 = ' + ph(E) + '\\ \\text{pu}') }];
      var pf0 = phasorFig([{ re: 1, im: 0, label: 'V' }, { re: c.I.re, im: c.I.im, label: 'I_m' }, { re: E.re, im: E.im, label: 'E_0' }]);
      if (pf0) parts[1].working += figBlock(pf0);
      return { stem: 'A ' + pe(S, 'VA') + ', ' + VL + ' V synchronous motor has $X_S = ' + Xs + '$ pu on its own rating; neglect $R$. It draws ' + pe(P, 'W') + ' at ' + (v === 'unity' ? 'unity power factor' : 'a power factor of ' + pf + ' ' + (v === 'lag' ? 'lagging' : 'leading')) + ' at rated voltage.',
        figure: figSync({ E: 'E_0', X: 'j' + Xs + ' pu', V: '1 pu', gen: false }), given: [['rating', pe(S, 'VA') + ', ' + VL + ' V'], ['$X_S$', Xs + ' pu'], ['$P$', pe(P, 'W')], ['pf', pf + (v === 'unity' ? '' : ' ' + v)]], parts: parts,
        notes: QB.callout('trap', 'With the input current, use $E_0 = V - I_m(R + jX_S)$. Using $V + jX_SI_m$ gives the wrong $E_0$.'), meta: { in: { S: S, VL: VL, Xs: Xs, P: P, pf: pf, sense: v } } };
    }
  });

  add({
    id: 'mach.sync.phasor.pf', course: 'mach', module: 'sync', topic: 'phasor',
    title: 'Power factor and current for a given excitation',
    difficulty: 3, marks: 6, tags: ['M11 §1.4', 'N1 (M11)'],
    variants: [{ id: 'gen', label: 'Generator: given E0 and P' }, { id: 'motor', label: 'Motor: given E0 and P' }, { id: 'comp', label: 'Synchronous compensator (P = 0)' }],
    gen: function (r, v) {
      var Xs = r.pick([0.8, 1.0, 1.2, 1.5, 1.6, 1.8, 2.0]), Vp = r.pick([1, 1, 0.98, 1.02, 1.05]), E0, P = 0, parts = [], meta = { Xs: Xs, Vp: Vp, mode: v };
      if (v === 'comp') {
        E0 = r.pick([0.25, 0.5, 0.7, 1.3, 1.6, 1.8, 2.2]); meta.E0 = E0;
        var I = cx(E0 - Vp, 0).div(cx(0, Xs)), Q = Vp * (E0 - Vp) / Xs;
        parts.push({ q: '(a) Find the stator current phasor and the reactive power delivered to the bus. Is the machine over- or under-excited?', answers: [ans('I', '$|I|$', I.abs(), 'pu'), ans('Q', '$Q$', Q, 'pu')],
          working: QB.steps(['With ' + $('P = 0') + ', ' + $('\\delta = 0') + ': ' + $('E_0') + ' and ' + $('V') + ' are in line.', $('\\mathbf I = \\dfrac{E_0 - V}{jX_S} = \\dfrac{' + n(E0) + ' - ' + n(Vp) + '}{j' + Xs + '} = ' + ph(I) + '\\ \\text{pu}'), $('Q = \\dfrac{V(E_0 - V)}{X_S} = ' + pu(Q)) + (Q > 0 ? ': <b>over-excited</b>, supplies Q (lagging output, like a capacitor seen from the bus)' : ': <b>under-excited</b>, absorbs Q')]) + QB.final('Q = ' + pu(Q)) });
        var Qt = r.pick([0.3, 0.5, 0.8, -0.3, -0.5]); meta.Qt = Qt;
        var Et = Vp + Qt * Xs / Vp;
        parts.push({ q: '(b) What $E_0$ is needed to ' + (Qt > 0 ? 'supply ' + Qt : 'absorb ' + (-Qt)) + ' pu reactive power?', answers: [ans('Et', '$E_0$', Et, 'pu')], working: QB.steps([$('E_0 = V + \\dfrac{QX_S}{V} = ' + n(Vp) + ' + \\dfrac{' + sgn(Qt) + '\\times' + Xs + '}{' + n(Vp) + '} = ' + pu(Et))]) + QB.final('E_0 = ' + pu(Et)) });
        return { stem: 'A synchronous compensator (P = 0) with $X_S = ' + Xs + '$ pu is connected to a bus held at ' + Vp + ' pu. Neglect R. Its excitation is set to $E_0 = ' + E0 + '$ pu.', figure: figSync({ E: 'E_0', X: 'j' + Xs + ' pu', V: Vp + ' pu', gen: true }), given: [['$X_S$', Xs + ' pu'], ['$V$', Vp + ' pu'], ['$E_0$', E0 + ' pu']], parts: parts, meta: { in: meta } };
      }
      r.retry(function () { E0 = r.pick([0.9, 1.1, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2]); P = r.pick([0.3, 0.4, 0.5, 0.6, 0.7, 0.8]); return P * Xs / (Vp * E0) < 0.92 ? true : null; });
      meta.E0 = E0; meta.P = P;
      var mot = v === 'motor', sd = P * Xs / (Vp * E0), d = (mot ? -1 : 1) * Math.asin(sd) * 180 / PI, E = cx.polar(E0, d);
      var I2 = mot ? cx(Vp, 0).sub(E).div(cx(0, Xs)) : E.sub(cx(Vp, 0)).div(cx(0, Xs)), phi = I2.argd(), pf = Math.cos(I2.arg());
      var Qo = mot ? cx(Vp, 0).mul(I2.conj()).im : cx(Vp, 0).mul(I2.conj()).im;
      parts.push({ q: '(a) Find the rotor angle.', answers: [ans('delta', '$\\delta$', d, '°')], working: QB.steps([$('P = \\dfrac{VE_0}{X_S}\\sin|\\delta|') + ' → ' + $('\\sin|\\delta| = \\dfrac{PX_S}{VE_0} = \\dfrac{' + P + '\\times' + Xs + '}{' + n(Vp) + '\\times' + E0 + '} = ' + n(sd)), $('\\delta = ' + ang(d)) + (mot ? ' (negative: motoring)' : ' (positive: generating)')]) + QB.final('\\delta = ' + ang(d)) });
      parts.push({ q: '(b) Find the ' + (mot ? 'input' : 'stator') + ' current phasor, the power factor (lead or lag) and the reactive power ' + (mot ? 'drawn from the supply.' : 'delivered.'), answers: [ans('I', '$|I|$', I2.abs(), 'pu'), ans('phi', '$\\angle I$', phi, '°'), ans('pf', 'pf', pf, ''), ans('Q', '$Q$', Qo, 'pu')],
        working: QB.steps([mot ? $('\\mathbf I_m = \\dfrac{V - E_0}{jX_S} = \\dfrac{' + n(Vp) + ' - ' + ph(E) + '}{j' + Xs + '} = ' + ph(I2) + '\\ \\text{pu}') : $('\\mathbf I = \\dfrac{E_0 - V}{jX_S} = \\dfrac{' + ph(E) + ' - ' + n(Vp) + '}{j' + Xs + '} = ' + ph(I2) + '\\ \\text{pu}'),
          'pf ' + $('= \\cos(' + ang(phi) + ') = ' + n(pf)) + ' <b>' + lagLead(phi) + '</b>', mot ? $('Q_{in} = V|I_m|\\sin(-\\phi) = ' + pu(Qo)) + (Qo < 0 ? ': negative, the motor <b>supplies</b> Q (over-excited)' : ': the motor absorbs Q (under-excited)') : $('Q = V|I|\\sin(-\\phi) = ' + pu(Qo)) + ' (check: ' + $('(VE_0\\cos\\delta - V^2)/X_S = ' + pu((Vp * E0 * Math.cos(d * PI / 180) - Vp * Vp) / Xs)) + ')']) + QB.final('\\text{pf} = ' + n(pf) + '\\ \\text{' + lagLead(phi) + '}') });
      return { stem: 'A round-rotor synchronous ' + (mot ? 'motor' : 'generator') + ' with $X_S = ' + Xs + '$ pu is connected to a bus at ' + Vp + ' pu. Neglect R. The excitation is $E_0 = ' + E0 + '$ pu and the machine ' + (mot ? 'takes ' + P + ' pu electrical power from' : 'delivers ' + P + ' pu real power to') + ' the bus.',
        figure: figSync({ E: E0 + ' pu', X: 'j' + Xs + ' pu', V: Vp + ' pu', gen: !mot }), given: [['$X_S$', Xs + ' pu'], ['$V$', Vp + ' pu'], ['$E_0$', E0 + ' pu'], ['$P$', P + ' pu']], parts: parts,
        notes: QB.callout('tip', 'Over-excited ($E_0\\cos\\delta > V$) always generates Q: a lagging output for a generator, a leading input for a motor.'), meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.phasor.vcurve', course: 'mach', module: 'sync', topic: 'phasor',
    title: 'Changing the excitation at constant real power (V-curve)',
    difficulty: 3, marks: 6, tags: ['N3 (M11)', 'Lecture 8.6.3–8.6.4'],
    variants: [{ id: 'lag-lead', label: 'Lagging to leading' }, { id: 'lead-lag', label: 'Leading to lagging' }, { id: 'unity', label: 'Excitation for minimum current' }],
    gen: function (r, v) {
      var Xs = r.pick([1.0, 1.2, 1.5, 1.6, 1.8]), Sp = r.pick([0.6, 0.7, 0.8, 0.9, 1]), pf = pickPF(r), first = v === 'lead-lag' ? 'lead' : 'lag', second = v === 'unity' ? 'unity' : (first === 'lag' ? 'lead' : 'lag');
      var c1 = curFrom(Sp, 1, pf, first), E1 = cx(1, 0).add(c1.I.mul(cx(0, Xs)));
      var P = Sp * pf, c2 = second === 'unity' ? curFrom(P, 1, 1, 'unity') : curFrom(Sp, 1, pf, second), E2 = cx(1, 0).add(c2.I.mul(cx(0, Xs)));
      var parts = [{ q: '(a) Find $E_0$ and $\\delta$ at ' + pf + ' pf ' + (first === 'lag' ? 'lagging' : 'leading') + '.', answers: [ans('E1', '$|E_0|$', E1.abs(), 'pu'), ans('d1', '$\\delta$', E1.argd(), '°')], working: QB.steps([$('\\mathbf I = ' + ph(c1.I) + '\\ \\text{pu}'), $('E_0 = 1 + jX_S\\mathbf I = 1 + j' + Xs + '(' + ph(c1.I) + ') = ' + ph(E1) + '\\ \\text{pu}')]) + QB.final('E_0 = ' + ph(E1)) },
        { q: '(b) The real power is held constant and the excitation is changed until the ' + (second === 'unity' ? 'stator current is a minimum' : 'pf is ' + pf + ' ' + (second === 'lag' ? 'lagging' : 'leading')) + '. Find the new $E_0$, $\\delta$ and current.', answers: [ans('E2', '$|E_0|$', E2.abs(), 'pu'), ans('d2', '$\\delta$', E2.argd(), '°'), ans('I2', '$|I|$', c2.I.abs(), 'pu')],
          working: QB.steps(['Same ' + $('P = ' + n(Sp) + '\\times' + pf + ' = ' + pu(P)) + (second === 'unity' ? '. Minimum |I| is at the bottom of the V-curve: unity pf, ' + $('|I| = P/V = ' + pu(P)) : ', same pf magnitude, so ' + $('|I| = ' + pu(c2.I.abs())) + ' again'), $('\\mathbf I = ' + ph(c2.I)) + ', ' + $('E_0 = 1 + j' + Xs + '(' + ph(c2.I) + ') = ' + ph(E2) + '\\ \\text{pu}'), 'Check: ' + $('\\dfrac{E_0}{X_S}\\sin\\delta = ' + pu(E2.abs() * Math.sin(E2.arg()) / Xs)) + ' = P. The tip of ' + $('E_0') + ' moves along a vertical line.']) + QB.final('E_0 = ' + ph(E2)) },
        { q: '(c) Find $P_{max}$ for both excitations and comment on stability.', answers: [ans('P1', '$P_{max}$ (a)', E1.abs() / Xs, 'pu'), ans('P2', '$P_{max}$ (b)', E2.abs() / Xs, 'pu')], working: QB.steps([$('P_{max} = VE_0/X_S') + ': (a) ' + $(pu(E1.abs() / Xs)) + ', (b) ' + $(pu(E2.abs() / Xs)), 'Lower excitation (absorbing Q) cuts ' + $('P_{max}') + ' and pushes ' + $('\\delta') + ' towards 90°: less margin before pull-out.']) + QB.final(n(E1.abs() / Xs) + '\\ \\text{and}\\ ' + n(E2.abs() / Xs) + '\\ \\text{pu}') }];
      return { stem: 'A generator with $X_S = ' + Xs + '$ pu delivers $S = ' + Sp + '$ pu at $V = 1$ pu. Neglect R.', figure: figSync({ E: 'E_0', X: 'j' + Xs + ' pu', V: '1 pu', gen: true }), given: [['$X_S$', Xs + ' pu'], ['$S$', Sp + ' pu'], ['pf', pf + ' ' + first]], parts: parts, meta: { in: { Xs: Xs, S: Sp, pf: pf, first: first, second: second } } };
    }
  });

  /* ---------------------------------------------------------------- sync.pangle */
  add({
    id: 'mach.sync.pangle.pmax', course: 'mach', module: 'sync', topic: 'pangle',
    title: 'Maximum power at fixed excitation (stability limit)',
    difficulty: 2, marks: 6, tags: ['exam-style', 'Jun24 Q4b', 'PQ 8.8(c)', 'MX3 4b(iii)', 'Playbook B (M11)'],
    variants: [{ id: 'lag', label: 'Excitation set at a lagging load' }, { id: 'lead', label: 'Excitation set at a leading load' }, { id: 'unity', label: 'Excitation set at unity pf' }],
    gen: function (r, v) {
      var g = genRating(r), Xs = r.pick([1.2, 1.5, 1.6, 1.8, 2.0]), pf = v === 'unity' ? 1 : pickPF(r), Sp = r.pick([0.6, 0.75, 0.8, 1]);
      var c = curFrom(Sp, 1, pf, v), E = cx(1, 0).add(c.I.mul(cx(0, Xs))), Pmax = E.abs() / Xs, P = Sp * pf;
      var parts = [{ q: '(a) What excitation (pu) and rotor angle does this load need?', answers: [ans('E0', '$|E_0|$', E.abs(), 'pu'), ans('delta', '$\\delta$', E.argd(), '°')], working: QB.steps([$('\\mathbf I = ' + ph(c.I) + '\\ \\text{pu}'), $('E_0 = V + jX_S\\mathbf I = 1 + (' + Xs + '\\angle90^\\circ)(' + ph(c.I) + ') = ' + ph(E) + '\\ \\text{pu}')]) + QB.final('E_0 = ' + ph(E)) },
        { q: '(b) With the terminal voltage and excitation fixed, find the theoretical maximum power (pu and MW) that can be delivered without losing synchronism, and the rotor angle at which it occurs.', answers: [ans('Pmax', '$P_{max}$', Pmax, 'pu'), ans('PmaxW', '$P_{max}$', Pmax * g.S, 'W'), ans('dmax', '$\\delta$', 90, '°')],
          working: QB.steps(['Keep the <b>old</b> ' + $('E_0') + '. ' + $('P = \\dfrac{VE_0}{X_S}\\sin\\delta') + ' peaks at ' + $('\\delta = 90^\\circ') + ':', $('P_{max} = \\dfrac{1\\times' + n(E.abs()) + '}{' + Xs + '} = ' + pu(Pmax)) + ' = ' + $(W(Pmax * g.S)), 'Present load ' + $('P = ' + pu(P)) + ': margin ' + $(pct((Pmax - P) / P * 100)) + '. Beyond 90° more input gives less output and the rotor pulls out of step.']) + QB.final('P_{max} = ' + pu(Pmax) + '\\ \\text{at}\\ \\delta = 90^\\circ') }];
      return { stem: 'A ' + pe(g.S, 'VA') + ' round-rotor synchronous generator has $X_S = ' + Xs + '$ pu. Its terminal voltage is held at 1 pu. It delivers ' + (Sp === 1 ? 'its rated VA' : Sp + ' pu VA') + ' at ' + (v === 'unity' ? 'unity power factor' : pf + ' ' + (v === 'lag' ? 'lagging' : 'leading') + ' power factor') + '. Neglect resistance and saturation.',
        figure: (function () { var xs = [], ys = []; for (var i = 0; i <= 36; i++) { xs.push(i * 5); ys.push(Pmax * Math.sin(i * 5 * PI / 180)); } return plot('curves', [[{ x: xs, y: ys, label: 'P(δ)' }], { xlabel: 'δ (°)', ylabel: 'P (pu)' }]) || figSync({ E: 'E_0', X: 'j' + Xs + ' pu', V: '1 pu', gen: true }); })(), given: [['$S$', pe(g.S, 'VA')], ['$X_S$', Xs + ' pu'], ['load', Sp + ' pu, pf ' + pf + (v === 'unity' ? '' : ' ' + v)]], parts: parts,
        notes: QB.callout('trap', 'Do not recompute $E_0$ at 90°: "excitation fixed" means the $E_0$ found for the original load.'), meta: { in: { S: g.S, Xs: Xs, pf: pf, Sp: Sp, sense: v } } };
    }
  });

  add({
    id: 'mach.sync.pangle.delta', course: 'mach', module: 'sync', topic: 'pangle',
    title: 'Power–angle equation: power at an angle, angle for a power',
    difficulty: 2, marks: 4, tags: ['PQ 8.9', 'N2 (M11)'],
    variants: [{ id: 'limit', label: 'Power at a rotor-angle limit (pu)' }, { id: 'angle', label: 'Rotor angle for a given power' }, { id: 'SI', label: 'SI units with line voltages' }],
    gen: function (r, v) {
      var g = genRating(r), parts = [], meta = { S: g.S };
      if (v === 'SI') {
        var VL = g.V, XsO = Number((g.ZB * r.float(0.8, 1.6, 2)).toPrecision(3)), EL = Math.round(VL * r.float(1.1, 1.6, 2) / 100) * 100, d = r.pick([15, 20, 25, 30, 35, 40]);
        meta.V = VL; meta.Xs = XsO; meta.E = EL; meta.d = d;
        var Pph = (VL / SQ3) * (EL / SQ3) / XsO * Math.sin(d * PI / 180), Pt = 3 * Pph, Pm = VL * EL / XsO;
        parts.push({ q: '(a) Find the three-phase output power using per-phase quantities, then check with line quantities.', answers: [ans('P', '$P$', Pt, 'W')], working: QB.steps(['Per phase: ' + $('P_{ph} = \\dfrac{V_{ph}E_{ph}}{X_S}\\sin\\delta = \\dfrac{(' + n(VL) + '/\\sqrt3)(' + n(EL) + '/\\sqrt3)}{' + n(XsO) + '}\\sin' + d + '^\\circ = ' + W(Pph)), $('P = 3P_{ph} = ' + W(Pt)), 'Line: ' + $('P = \\dfrac{V_LE_L}{X_S}\\sin\\delta = ' + W(VL * EL / XsO * Math.sin(d * PI / 180))) + ' (already three-phase: do not multiply by 3)']) + QB.final('P = ' + W(Pt)) });
        parts.push({ q: '(b) Find the maximum power at this excitation, in MW and in per-unit on the machine rating.', answers: [ans('Pm', '$P_{max}$', Pm, 'W'), ans('Pmpu', '$P_{max}$', Pm / g.S, 'pu')], working: QB.steps([$('P_{max} = \\dfrac{V_LE_L}{X_S} = ' + W(Pm)) + ' at ' + $('\\delta = 90^\\circ'), 'In pu: ' + $('X_S = ' + n(XsO) + '/' + n(g.ZB) + ' = ' + pu(XsO / g.ZB)) + ', ' + $('E_0 = ' + n(EL / VL)) + ' pu: ' + $('P_{max} = ' + n(EL / VL) + '/' + n(XsO / g.ZB) + ' = ' + pu(Pm / g.S))]) + QB.final('P_{max} = ' + W(Pm) + ' = ' + pu(Pm / g.S)) });
        return { stem: 'A ' + pe(g.S, 'VA') + ', ' + pe(VL, 'V') + ' star-connected generator has $X_S = ' + n(XsO) + '\\ \\Omega$ per phase. Its excitation gives $E_0 = ' + n(EL / 1e3) + '$ kV (line). It runs at $\\delta = ' + d + '^\\circ$ on a ' + pe(VL, 'V') + ' bus. Neglect R.', figure: figSync({ E: pe(EL, 'V') + ' (line)', X: n(XsO) + ' Ω', V: pe(VL, 'V'), gen: true }), given: [['$X_S$', pv(XsO, 'Ω')], ['$E_0$', pe(EL, 'V') + ' line'], ['$V$', pe(VL, 'V')], ['$\\delta$', d + '°']], parts: parts, meta: { in: meta } };
      }
      var Xs = r.pick([1.2, 1.5, 1.6, 1.8, 2.0]), E0 = r.pick([1.3, 1.4, 1.5, 1.6, 1.8, 2.0]), Vp = r.pick([0.98, 1, 1.02, 1.05]);
      meta.Xs = Xs; meta.E0 = E0; meta.Vp = Vp;
      var Pm2 = Vp * E0 / Xs;
      if (v === 'limit') {
        var dl = r.pick([60, 65, 70, 75, 80]); meta.d = dl;
        var Pl = Pm2 * Math.sin(dl * PI / 180);
        parts.push({ q: '(a) What power (MW) can be delivered if the rotor angle must not exceed ' + dl + '°?', answers: [ans('P', '$P$', Pl * g.S, 'W')], working: QB.steps([$('P = \\dfrac{VE_0}{X_S}\\sin\\delta = \\dfrac{' + Vp + '\\times' + E0 + '}{' + Xs + '}\\sin' + dl + '^\\circ = ' + pu(Pl)), $('P = ' + n(Pl) + '\\times' + n(g.S / 1e6) + '\\ \\text{MW} = ' + W(Pl * g.S))]) + QB.final('P = ' + W(Pl * g.S)) });
        parts.push({ q: '(b) What is the theoretical maximum power?', answers: [ans('Pm', '$P_{max}$', Pm2 * g.S, 'W')], working: QB.steps([$('P_{max} = VE_0/X_S = ' + pu(Pm2)) + ' = ' + $(W(Pm2 * g.S)) + ' at 90°']) + QB.final('P_{max} = ' + W(Pm2 * g.S)) });
      } else {
        var Pt2 = Math.round(Pm2 * r.float(0.35, 0.9, 2) * g.S / 1e6) * 1e6; meta.P = Pt2;
        var sd = Pt2 / g.S / Pm2, dd = Math.asin(sd) * 180 / PI;
        parts.push({ q: '(a) Find the rotor angle when the generator delivers ' + pe(Pt2, 'W') + '.', answers: [ans('d', '$\\delta$', dd, '°')], working: QB.steps([$('P = ' + n(Pt2 / 1e6) + '/' + n(g.S / 1e6) + ' = ' + pu(Pt2 / g.S)), $('\\sin\\delta = \\dfrac{PX_S}{VE_0} = \\dfrac{' + n(Pt2 / g.S) + '\\times' + Xs + '}{' + Vp + '\\times' + E0 + '} = ' + n(sd)), $('\\delta = ' + ang(dd)) + (dd > 75 ? ' (above the usual 75° operating limit)' : '')]) + QB.final('\\delta = ' + ang(dd)) });
        parts.push({ q: '(b) By how much can the power rise before the theoretical stability limit?', answers: [ans('dP', '$P_{max} - P$', Pm2 * g.S - Pt2, 'W')], working: QB.steps([$('P_{max} = ' + pu(Pm2)) + ' = ' + $(W(Pm2 * g.S)), $('P_{max} - P = ' + W(Pm2 * g.S - Pt2))]) + QB.final(W(Pm2 * g.S - Pt2)) });
      }
      return { stem: 'A ' + pe(g.S, 'VA') + ' generator has an unsaturated synchronous reactance of ' + Xs + ' pu. The excitation gives an open-circuit voltage of ' + E0 + ' pu, and the terminal voltage is ' + Vp + ' pu. Neglect resistance and saturation.', figure: null, given: [['$S$', pe(g.S, 'VA')], ['$X_S$', Xs + ' pu'], ['$E_0$', E0 + ' pu'], ['$V$', Vp + ' pu']], parts: parts, meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.pangle.minexc', course: 'mach', module: 'sync', topic: 'pangle',
    title: 'Minimum excitation for a power at a rotor-angle limit',
    difficulty: 3, marks: 5, tags: ['N4 (M11)', 'MX3 4b(iii)'],
    variants: [{ id: 'limit', label: 'E0 at a δ limit, then I, Q, pf' }, { id: 'field', label: 'Minimum field current to make a power possible' }],
    gen: function (r, v) {
      var Xs = r.pick([1.2, 1.339, 1.5, 1.6, 1.8, 2.0]), parts = [], meta = { Xs: Xs };
      if (v === 'limit') {
        var P = r.pick([0.4, 0.5, 0.6, 0.7, 0.8]), dl = r.pick([60, 65, 70, 75]); meta.P = P; meta.d = dl;
        var Em = P * Xs / Math.sin(dl * PI / 180), E = cx.polar(Em, dl), I = E.sub(cx(1, 0)).div(cx(0, Xs)), Q = -I.abs() * Math.sin(I.arg());
        parts.push({ q: '(a) What is the minimum $E_0$ if $\\delta$ must not exceed ' + dl + '°?', answers: [ans('Em', '$E_{0,min}$', Em, 'pu')], working: QB.steps([$('E_{0,min} = \\dfrac{PX_S}{V\\sin\\delta_{lim}} = \\dfrac{' + P + '\\times' + Xs + '}{\\sin' + dl + '^\\circ} = ' + pu(Em))]) + QB.final('E_{0,min} = ' + pu(Em)) });
        parts.push({ q: '(b) At that point find the stator current phasor, the reactive power and the power factor.', answers: [ans('I', '$|I|$', I.abs(), 'pu'), ans('phi', '$\\angle I$', I.argd(), '°'), ans('Q', '$Q$', Q, 'pu'), ans('pf', 'pf', P / I.abs(), '')],
          working: QB.steps([$('\\mathbf I = \\dfrac{E_0 - V}{jX_S} = \\dfrac{' + ph(E) + ' - 1}{j' + Xs + '} = ' + ph(I) + '\\ \\text{pu}'), $('Q = S\\sin(-\\phi) = ' + pu(Q)) + (Q < 0 ? ': it absorbs ' + n(-Q) + ' pu' : ''), 'Check: ' + $('(E_0\\cos\\delta - V)/X_S = ' + pu((Em * Math.cos(dl * PI / 180) - 1) / Xs)), 'pf ' + $('= P/|I| = ' + n(P / I.abs())) + ' ' + lagLead(I.argd())]) + QB.final('\\mathbf I = ' + ph(I) + ',\\ Q = ' + pu(Q)) });
        return { stem: 'A generator with $X_S = ' + Xs + '$ pu at $V = 1$ pu supplies a constant $P = ' + P + '$ pu. The operator lowers the excitation to absorb reactive power. Neglect R.', figure: null, given: [['$X_S$', Xs + ' pu'], ['$P$', P + ' pu'], ['$\\delta_{lim}$', dl + '°']], parts: parts, meta: { in: meta } };
      }
      var g = genRating(r), pf = pickPF(r), Pmw = Math.round(g.S / 1e6 * r.float(0.5, 0.8, 2)), IF1 = r.pick([150, 200, 250, 270, 300]);
      var Sp = Pmw * 1e6 / g.S / pf, c = curFrom(Sp, 1, pf, 'lead'), E = cx(1, 0).add(c.I.mul(cx(0, Xs))), Pmax = E.abs() / Xs;
      var Pt = Math.max(Math.round(Pmax * g.S / 1e6 * r.float(1.1, 1.3, 2)), Math.ceil(Pmax * g.S / 1e6) + 1);
      if (Pt * 1e6 > 1.15 * g.S) Pt = Math.round(1.1 * g.S / 1e6);
      meta.S = g.S; meta.P = Pmw * 1e6; meta.pf = pf; meta.IF1 = IF1; meta.Pt = Pt * 1e6;
      var Emin = Pt * 1e6 / g.S * Xs;
      parts.push({ q: '(a) Find $E_0$ and the field current for the present load.', answers: [ans('E0', '$|E_0|$', E.abs(), 'pu'), ans('IF', '$I_F$', E.abs() * IF1, 'A')], working: QB.steps([$('\\mathbf I = \\dfrac{' + n(Sp) + '}{1}\\angle+\\cos^{-1}' + pf + ' = ' + ph(c.I)), $('E_0 = 1 + j' + Xs + '\\mathbf I = ' + ph(E) + '\\ \\text{pu}'), $('I_F = ' + n(E.abs()) + '\\times' + IF1 + ' = ' + A_(E.abs() * IF1))]) + QB.final('E_0 = ' + ph(E) + ',\\ I_F = ' + A_(E.abs() * IF1)) });
      parts.push({ q: '(b) With the field current held, the operator tries to raise the output to ' + Pt + ' MW. Find the theoretical maximum power and say whether this is possible. If not, find the minimum field current that would make it theoretically possible.', answers: [ans('Pmax', '$P_{max}$', Pmax * g.S, 'W'), ans('IFmin', '$I_{F,min}$', Emin * IF1, 'A')],
        working: QB.steps([$('P_{max} = E_0/X_S = ' + n(E.abs()) + '/' + Xs + ' = ' + pu(Pmax)) + ' = ' + $(W(Pmax * g.S)), Pt * 1e6 > Pmax * g.S ? Pt + ' MW is <b>not</b> possible: the machine would pull out of step first.' : Pt + ' MW is possible.', 'Need ' + $('E_0 \\ge PX_S/V = ' + n(Pt * 1e6 / g.S) + '\\times' + Xs + ' = ' + pu(Emin)) + ', so ' + $('I_F \\ge ' + n(Emin) + '\\times' + IF1 + ' = ' + A_(Emin * IF1)) + ' (more in practice, to keep δ well below 90°)']) + QB.final('P_{max} = ' + W(Pmax * g.S) + ',\\ I_{F,min} = ' + A_(Emin * IF1)) });
      return { stem: 'A ' + pe(g.S, 'VA') + ' generator with $X_S = ' + Xs + '$ pu is connected to a large grid at rated voltage. It delivers ' + Pmw + ' MW at a power factor of ' + pf + ' <b>leading</b>. A field current of ' + IF1 + ' A gives $E_0 = 1$ pu on open circuit. Neglect R and saturation.', figure: null, given: [['$S$', pe(g.S, 'VA')], ['$X_S$', Xs + ' pu'], ['load', Pmw + ' MW, ' + pf + ' lead'], ['$I_F(E_0 = 1)$', IF1 + ' A']], parts: parts, meta: { in: meta } };
    }
  });

  /* ---------------------------------------------------------------- sync.pfc */
  function imLoad(Pm, eta, pf) { var P = Pm / eta, S = P / pf; return { P: P, S: S, Q: S * Math.sin(Math.acos(pf)) }; }
  add({
    id: 'mach.sync.pfc.plant', course: 'mach', module: 'sync', topic: 'pfc',
    title: 'Plant power factor with a fully over-excited synchronous motor',
    difficulty: 2, marks: 7, tags: ['exam-style', 'Jun23 Q4b', 'PQ 8.14', 'PQ 8.15', 'Playbook C (M11)'],
    variants: [{ id: 'two', label: 'Induction motor plus synchronous motor' }, { id: 'replace', label: 'One of two motors replaced (Jun23)' }, { id: 'extension', label: 'Existing load plus an extension' }],
    gen: function (r, v) {
      var parts = [], meta = { v: v }, loads = [], fig, stem, w = [], Pt = 0, Qt = 0;
      var etaI = r.pick([0.85, 0.88, 0.89, 0.9, 0.92]), pfI = r.pick([0.75, 0.78, 0.8, 0.82, 0.83, 0.85]), etaS = r.pick([0.9, 0.92, 0.93, 0.95, 1]);
      meta.etaI = etaI; meta.pfI = pfI; meta.etaS = etaS;
      var PmI, PmS, SR, ex = null;
      if (v === 'extension') {
        var Sx = r.pick([1500, 2000, 2760, 3000]) * 1e3, pfx = r.pick([0.7, 0.71, 0.75, 0.78]); PmI = r.pick([500, 600, 800]) * 1e3; PmS = r.pick([500, 700, 900]) * 1e3; SR = Math.round(PmS / etaS / 1e3 * r.float(1.3, 1.9, 2) / 10) * 1e4;
        meta.Sx = Sx; meta.pfx = pfx; ex = { P: Sx * pfx, Q: Sx * Math.sin(Math.acos(pfx)) };
        stem = 'An industrial installation has an existing load of ' + pe(Sx, 'VA') + ' at a power factor of ' + pfx + ' lagging. An extension needs ' + pe(PmI + PmS, 'W') + ' of mechanical load: ' + pe(PmI, 'W') + ' from induction motors (η = ' + etaI + ', pf ' + pfI + ' lag) and the remainder from synchronous motors (η = ' + etaS + ', total rating ' + pe(SR, 'VA') + ').';
      } else {
        PmI = r.pick([100, 150, 200, 250, 300]) * 1e3; PmS = v === 'replace' ? PmI : r.pick([50, 80, 100, 150]) * 1e3;
        SR = Math.round(PmS / etaS / 1e3 * r.float(1.1, 1.6, 2) / 10) * 1e4;
        stem = v === 'replace' ? 'An industrial plant uses two identical induction motors, each driving a ' + pe(PmI, 'W') + ' mechanical load at an efficiency of ' + etaI * 100 + ' % and a power factor of ' + pfI + ' lag. One motor fails and is replaced with a synchronous motor rated ' + pe(SR, 'VA') + ' with an efficiency of ' + etaS * 100 + ' %, driving the same load.'
          : 'A production line uses an induction motor to drive a ' + pe(PmI, 'W') + ' load (η = ' + etaI + ', pf ' + pfI + ' lag). A ' + pe(SR, 'VA') + ' synchronous motor (η = ' + etaS + ') drives a ' + pe(PmS, 'W') + ' load nearby.';
      }
      meta.PmI = PmI; meta.PmS = PmS; meta.SR = SR;
      var L = imLoad(PmI, etaI, pfI), PS = PmS / etaS, QS = -Math.sqrt(Math.max(0, SR * SR - PS * PS));
      parts.push({ q: '(a) Find the input real and reactive power of the induction motor' + (v === 'extension' ? 's and of the existing load.' : '.'), answers: [ans('PI', '$P_{IM}$', L.P, 'W'), ans('QI', '$Q_{IM}$', L.Q, 'VAr')].concat(ex ? [ans('Px', '$P_{ex}$', ex.P, 'W'), ans('Qx', '$Q_{ex}$', ex.Q, 'VAr')] : []),
        working: QB.steps([$('P_{IM} = P_M/\\eta = ' + n(PmI) + '/' + etaI + ' = ' + W(L.P)), $('S = P/\\text{pf} = ' + VA(L.S)) + ', ' + $('Q_{IM} = S\\sin(\\cos^{-1}' + pfI + ') = +' + VAr(L.Q)) + ' (lagging)', ex ? 'Existing: ' + $('P = ' + n(meta.Sx) + '\\times' + meta.pfx + ' = ' + W(ex.P)) + ', ' + $('Q = +' + VAr(ex.Q)) : null]) + QB.final('P_{IM} = ' + W(L.P) + ',\\ Q_{IM} = ' + VAr(L.Q)) });
      parts.push({ q: '(b) Find the synchronous motor input power and its maximum reactive power capability (fully over-excited).', answers: [ans('PS', '$P_{SM}$', PS, 'W'), ans('QS', '$|Q_{SM}|$', -QS, 'VAr')],
        working: QB.steps([$('P_{SM} = ' + n(PmS) + '/' + etaS + ' = ' + W(PS)) + ' (use the electrical input in the triangle)', $('|Q|_{max} = \\sqrt{S_R^2 - P_{SM}^2} = \\sqrt{' + n(SR) + '^2 - ' + n(PS) + '^2} = ' + VAr(-QS)) + '; over-excited it <b>supplies</b> this, ' + $('Q_{SM} = -' + VAr(-QS))]) + QB.final('P_{SM} = ' + W(PS) + ',\\ Q_{SM} = -' + VAr(-QS)) });
      Pt = L.P + PS + (ex ? ex.P : 0); Qt = L.Q + QS + (ex ? ex.Q : 0);
      var pfT = Math.cos(Math.atan2(Qt, Pt));
      parts.push({ q: '(c) Find the maximum power factor of the ' + (v === 'two' ? 'two machines combined' : 'plant') + '.', answers: [ans('pf', 'pf', pfT, '', { tol: 0.005 })],
        working: QB.steps([$('P_{tot} = ' + (ex ? n(ex.P) + ' + ' : '') + n(L.P) + ' + ' + n(PS) + ' = ' + W(Pt)), $('Q_{tot} = ' + (ex ? n(ex.Q) + ' + ' : '') + n(L.Q) + ' - ' + n(-QS) + ' = ' + VAr(Qt)), $('\\text{pf} = \\cos\\left(\\tan^{-1}\\dfrac{' + n(Qt) + '}{' + n(Pt) + '}\\right) = ' + n(pfT)) + ' <b>' + (Qt >= 0 ? 'lag' : 'lead') + '</b>']) + QB.final('\\text{pf} = ' + n(pfT) + '\\ \\text{' + (Qt >= 0 ? 'lag' : 'lead') + '}') });
      loads = (ex ? [{ label: 'existing', value: pe(meta.Sx, 'VA') }] : []).concat([{ text: 'IM', label: 'IM', value: pe(PmI, 'W') }, { text: 'SM', label: 'SM', value: pe(SR, 'VA') }]);
      return { stem: stem, figure: figPlant(loads), given: [['IM', pe(PmI, 'W') + ', η ' + etaI + ', pf ' + pfI], ['SM', pe(SR, 'VA') + ', η ' + etaS + ', ' + pe(PmS, 'W') + ' load']], parts: parts,
        notes: QB.callout('trap', 'Add P and Q separately (lag +, lead −), never power factors or currents. Use $P_E = P_M/\\eta$ for every machine.'), meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.pfc.motor', course: 'mach', module: 'sync', topic: 'pfc',
    title: 'Synchronous motor for PFC: reactive capability and excitation',
    difficulty: 3, marks: 10, tags: ['PQ 8.13', 'N5 (M11)'],
    variants: [{ id: 'full', label: 'Fully over-excited' }, { id: 'unity', label: 'Unity pf' }, { id: 'target', label: 'Target plant pf' }],
    gen: function (r, v) {
      var Pp = r.pick([300, 400, 500, 600, 800]) * 1e3, pfp = r.pick([0.7, 0.72, 0.75, 0.8]), SR = r.pick([250, 300, 400, 500]) * 1e3, VL = r.pick([415, 415, 690, 3300]), Xs = r.pick([0.8, 1.0, 1.2]), eta = r.pick([0.9, 0.92, 0.95, 0.96]);
      var PmS = Math.round(SR / 1e3 * eta * r.float(0.55, 0.85, 2) / 10) * 1e4, PE = PmS / eta, Qp = Pp * Math.tan(Math.acos(pfp)), Qmax = Math.sqrt(SR * SR - PE * PE);
      var meta = { Pp: Pp, pfp: pfp, SR: SR, VL: VL, Xs: Xs, eta: eta, PmS: PmS }, parts = [], QS, tgt = null;
      parts.push({ q: '(a) Find the motor input power and its maximum reactive power.', answers: [ans('PE', '$P_E$', PE, 'W'), ans('Qmax', '$|Q|_{max}$', Qmax, 'VAr')], working: QB.steps([$('P_E = ' + n(PmS) + '/' + eta + ' = ' + W(PE)), $('|Q|_{max} = \\sqrt{' + n(SR) + '^2 - ' + n(PE) + '^2} = ' + VAr(Qmax)) + ' (either sign; over-excited it supplies Q)']) + QB.final('P_E = ' + W(PE) + ',\\ |Q|_{max} = ' + VAr(Qmax)) });
      if (v === 'full') QS = -Qmax;
      else if (v === 'unity') QS = 0;
      else {
        var cands = [0.8, 0.82, 0.85, 0.88, 0.9, 0.92, 0.95, 0.97, 0.98].filter(function (c) { var Qn = (Pp + PE) * Math.tan(Math.acos(c)) - Qp; return -Qn <= Qmax && Qn < 0; }); tgt = cands.length ? r.pick(cands) : Math.floor(Math.cos(Math.atan2(Qp - 0.5 * Qmax, Pp + PE)) * 100) / 100;
        QS = (Pp + PE) * Math.tan(Math.acos(tgt)) - Qp; meta.tgt = tgt;
      }
      var Pt = Pp + PE, Qt = Qp + QS, pfT = Math.cos(Math.atan2(Qt, Pt));
      var w2 = [$('Q_{plant} = ' + n(Pp) + '\\tan(\\cos^{-1}' + pfp + ') = +' + VAr(Qp))];
      if (v === 'target') w2.push('For ' + tgt + ' lag overall: ' + $('Q_{tot} = P_{tot}\\tan(\\cos^{-1}' + tgt + ') = ' + n(Pt) + '\\times' + n(Math.tan(Math.acos(tgt))) + ' = ' + VAr(Pt * Math.tan(Math.acos(tgt)))) + ', so ' + $('Q_{SM} = ' + VAr(QS)) + ' (within the ' + $(VAr(Qmax)) + ' capability)');
      else w2.push($('Q_{SM} = ' + (v === 'full' ? '-' + VAr(Qmax) : '0')));
      w2.push($('P_{tot} = ' + W(Pt)) + ', ' + $('Q_{tot} = ' + VAr(Qt)) + ', ' + $('\\text{pf} = \\cos(\\tan^{-1}(Q/P)) = ' + n(pfT)) + ' ' + (Qt >= 0 ? 'lag' : 'lead') + ' (was ' + pfp + ')');
      parts.push({ q: v === 'target' ? '(b) What motor reactive power gives an overall pf of ' + tgt + ' lagging?' : '(b) Find the plant\'s new power factor.', answers: v === 'target' ? [ans('QS', '$Q_{SM}$', QS, 'VAr')] : [ans('pf', 'pf', pfT, '', { tol: 0.005 })], working: QB.steps(w2) + QB.final(v === 'target' ? 'Q_{SM} = ' + VAr(QS) : '\\text{pf} = ' + n(pfT)) });
      var Sm = cx(PE / SR, QS / SR), Im = Sm.conj(), IB = SR / (SQ3 * VL), E = cx(1, 0).sub(Im.mul(cx(0, Xs)));
      parts.push({ q: '(c) On the motor\'s own base, find the motor current phasor (pu and amps) and the excitation $E_0$ (pu and line volts).', answers: [ans('Im', '$|I_m|$', Im.abs(), 'pu'), ans('phi', '$\\angle I_m$', Im.argd(), '°'), ans('IA', '$I_m$', Im.abs() * IB, 'A'), ans('E0', '$|E_0|$', E.abs(), 'pu'), ans('delta', '$\\delta$', E.argd(), '°'), ans('E0L', '$E_{0,L}$', E.abs() * VL, 'V')],
        working: QB.steps([$('S_m = \\dfrac{' + n(PE) + (QS < 0 ? ' - j' : ' + j') + n(Math.abs(QS)) + '}{' + n(SR) + '} = ' + rc(Sm) + '\\ \\text{pu}'), $('I_m = (S_m/V)^* = ' + ph(Im) + '\\ \\text{pu}') + ' (' + lagLead(Im.argd()) + '), ' + $('I_B = ' + A_(IB)) + ', ' + $('I_m = ' + A_(Im.abs() * IB)), $('E_0 = V - jX_SI_m = 1 - j' + Xs + '(' + ph(Im) + ') = ' + ph(E) + '\\ \\text{pu}'), $('E_{0,L} = ' + n(E.abs()) + '\\times' + VL + ' = ' + V_(E.abs() * VL)) + '; ' + $('\\delta < 0') + ': motoring']) + QB.final('E_0 = ' + ph(E) + '\\ \\text{pu}') });
      return { stem: 'A plant takes ' + pe(Pp, 'W') + ' at ' + pfp + ' pf lagging from a ' + VL + ' V supply. A new ' + pe(SR, 'VA') + ', ' + VL + ' V synchronous motor ($X_S = ' + Xs + '$ pu on its own rating, η = ' + eta * 100 + ' %) is installed to drive a ' + pe(PmS, 'W') + ' load. ' + (v === 'full' ? 'It is run fully over-excited to correct the pf.' : v === 'unity' ? 'It is run at unity power factor.' : 'Its excitation is set to give a chosen plant power factor.') + ' Neglect R; use the electrical input as the phasor power.',
        figure: figPlant([{ label: 'plant', value: pe(Pp, 'W') + ', ' + pfp + ' lag' }, { text: 'SM', label: 'SM', value: pe(SR, 'VA') }]), given: [['plant', pe(Pp, 'W') + ', pf ' + pfp + ' lag'], ['SM', pe(SR, 'VA') + ', ' + VL + ' V, $X_S$ = ' + Xs + ' pu, η ' + eta], ['SM load', pe(PmS, 'W')]], parts: parts, meta: { in: meta } };
    }
  });

  add({
    id: 'mach.sync.pfc.comp', course: 'mach', module: 'sync', topic: 'pfc',
    title: 'Synchronous compensator for power-factor correction',
    difficulty: 2, marks: 5, tags: ['N1 (M11)', 'Lecture 8.6.6'],
    variants: [{ id: 'size', label: 'Rating for a target pf, then E0' }, { id: 'supply', label: 'E0 to supply Q' }, { id: 'absorb', label: 'E0 to absorb Q' }],
    gen: function (r, v) {
      var Xs = r.pick([1.0, 1.2, 1.5, 1.8, 2.0]), parts = [], meta = { Xs: Xs };
      if (v === 'size') {
        var P = r.pick([1, 2, 5, 10, 20]) * 1e6, pf1 = r.pick([0.7, 0.75, 0.8]), pf2 = r.pick([0.9, 0.95, 0.98, 1]); meta.P = P; meta.pf1 = pf1; meta.pf2 = pf2;
        var Q1 = P * Math.tan(Math.acos(pf1)), Q2 = P * Math.tan(Math.acos(pf2)), Qc = Q1 - Q2;
        var E = 1 + Xs;  // compensator rated = Qc; at full output I = 1 pu (lagging out): E0 = 1 + Xs
        parts.push({ q: '(a) What reactive power must the compensator supply to raise the pf from ' + pf1 + ' to ' + pf2 + ' lagging? This sets its rating.', answers: [ans('Qc', '$Q_C$', Qc, 'VAr')], working: QB.steps([$('Q_1 = P\\tan(\\cos^{-1}' + pf1 + ') = ' + VAr(Q1)), $('Q_2 = P\\tan(\\cos^{-1}' + pf2 + ') = ' + VAr(Q2)), $('Q_C = Q_1 - Q_2 = ' + VAr(Qc)) + ' (P = 0, so the VA rating is ' + $(VA(Qc)) + ')']) + QB.final('Q_C = ' + VAr(Qc)) });
        parts.push({ q: '(b) At this output (rated current, terminal voltage 1 pu) find $E_0$ on the compensator\'s own base.', answers: [ans('E0', '$E_0$', E, 'pu')], working: QB.steps(['Supplying Q: lagging output current at rated value, ' + $('\\mathbf I = 1\\angle-90^\\circ = -j1\\ \\text{pu}'), $('E_0 = 1 + jX_S(-j1) = 1 + ' + Xs + ' = ' + pu(E)) + ' (over-excited)']) + QB.final('E_0 = ' + pu(E)) });
        return { stem: 'A plant draws ' + pe(P, 'W') + ' at ' + pf1 + ' pf lagging. A synchronous compensator with $X_S = ' + Xs + '$ pu (on its own rating) is to be installed at the bus (V = 1 pu). Neglect R and losses.', figure: figPlant([{ label: 'plant', value: pe(P, 'W') }, { text: 'SC', label: 'compensator' }]), given: [['plant', pe(P, 'W') + ', ' + pf1 + ' lag'], ['target', pf2 + ' lag'], ['$X_S$', Xs + ' pu']], parts: parts, meta: { in: meta } };
      }
      var S = r.pick([20, 50, 100]) * 1e6, Qp = r.pick([0.3, 0.5, 0.6, 0.8, 1]) * (v === 'supply' ? 1 : -1), Vp = r.pick([1, 1, 0.98, 1.02]); meta.S = S; meta.Q = Qp; meta.Vp = Vp;
      var I = cx(0, -Qp / Vp), E = cx(Vp, 0).add(I.mul(cx(0, Xs)));
      parts.push({ q: '(a) Find the stator current phasor in pu.', answers: [ans('I', '$|I|$', I.abs(), 'pu'), ans('phi', '$\\angle I$', I.argd(), '°')], working: QB.steps([$('P = 0') + ', so the current is at ±90° to V. ' + (Qp > 0 ? 'Supplying Q: output current lags, ' : 'Absorbing Q: output current leads, ') + $('\\mathbf I = (S/V)^* = ' + ph(I) + '\\ \\text{pu}')]) + QB.final('\\mathbf I = ' + ph(I)) });
      parts.push({ q: '(b) Find the excitation $E_0$. Is the machine over- or under-excited?', answers: [ans('E0', '$E_0$', E.abs(), 'pu')], working: QB.steps([$('E_0 = V + jX_S\\mathbf I = ' + n(Vp) + ' + j' + Xs + '(' + rc(I) + ') = ' + ph(E) + '\\ \\text{pu}'), E.abs() > Vp ? '<b>Over-excited</b> (' + $('E_0 > V') + ')' : '<b>Under-excited</b> (' + $('E_0 < V') + ')', 'Check: ' + $('Q = V(E_0 - V)/X_S = ' + pu(Vp * (E.re - Vp) / Xs))]) + QB.final('E_0 = ' + pu(E.abs())) });
      return { stem: 'A ' + pe(S, 'VA') + ' synchronous compensator (P = 0) has $X_S = ' + Xs + '$ pu and is connected to a bus at ' + Vp + ' pu. Neglect R. It must ' + (Qp > 0 ? 'supply ' + Qp : 'absorb ' + (-Qp)) + ' pu reactive power (' + pe(Math.abs(Qp) * S, 'VAr') + ').', figure: figSync({ E: 'E_0', X: 'j' + Xs + ' pu', V: Vp + ' pu', gen: true }), given: [['$S$', pe(S, 'VA')], ['$X_S$', Xs + ' pu'], ['$V$', Vp + ' pu'], ['$Q$', Qp + ' pu']], parts: parts, meta: { in: meta } };
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);

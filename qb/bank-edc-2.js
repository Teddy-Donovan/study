/* bank-edc-2.js — EDC question bank, part 2 (ENGE2003)
 * =============================================================================
 * Module 3 (FETs): fet.devices, fet.bias, fet.ss, fet.ss2
 * Module 4:        amp.diff, amp.opamp, amp.power
 * Packs: E9–E13, EX1, EX2.  Notation: Boylestad.
 *   Shockley  I_D = I_DSS(1 − V_GS/V_P)²       E-MOSFET  I_D = k(V_GS − V_GS(Th))²
 *   g_m0 = 2I_DSS/|V_P|, g_m = g_m0(1 − V_GSQ/V_P), E-MOS g_m = 2k(V_GSQ − V_GS(Th))
 *   r_e = 26 mV / I_E (diff pair: per-transistor current I_E/2)
 * Every Q carries q.data (the numeric inputs) and each answer a `key`, so the
 * Python cross-check (tests/test-edc-2.js -> py) can recompute independently.
 * Figures: QB.sch templates where they exist; op-amp, diff-pair and power-amp
 * figures fall back to local drawings built with QB.sch.drawing().
 * ============================================================================= */
(function (G) {
  'use strict';
  var QB = G.QB, F = QB.fmt, T = F.tex;
  var par = QB.par;
  var PI = Math.PI;
  var VT26 = QB.units.VT;     // 26 mV (Boylestad r_e)

  /* ------------------------------------------------------------ helpers */
  function te(x, u, s) { return T.eng(x, u == null ? '' : u, s || 3); }        // TeX value+unit
  function tn(x, s) { var v = T.num(x, s || 4); return v; }                       // TeX number
  function pe(x, u, s) { return F.eng(x, u == null ? '' : u, s || 3); }          // plain text
  function M(s) { return '$$' + s + '$$'; }
  function mA(x, s) { return tn(x * 1e3, s || 4); }      // number in mA
  function kO(x, s) { return tn(x / 1e3, s || 4); }      // number in kΩ
  function sgnum(x, s) { return x < 0 ? '-' + tn(-x, s) : tn(x, s); }
  function plus(x, s) { return x < 0 ? '- ' + tn(-x, s) : '+ ' + tn(x, s); }   // "+ 3" / "- 3"
  function A(key, label, value, unit, extra) {
    var a = { key: key, label: label, value: value, unit: unit || '' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return a;
  }
  function g(label, x, unit, s) { return [label, typeof x === 'string' ? x : pe(x, unit, s)]; }
  function pickE(r, series, lo, hi) { var l = QB.eseriesList(series, lo, hi); return l.length ? r.pick(l) : null; }
  function nearestE(x, series) {
    var l = QB.eseriesList(series || 'E12', x / 3, x * 3), best = l[0];
    l.forEach(function (v) { if (Math.abs(Math.log(v / x)) < Math.abs(Math.log(best / x))) best = v; });
    return best;
  }
  function S(name, o) { return (QB.sch && typeof QB.sch[name] === 'function') ? QB.sch[name](o) : null; }
  function hasS(name) { return !!(QB.sch && typeof QB.sch[name] === 'function'); }
  var steps = QB.steps, fin = QB.final, tbl = QB.tbl;
  function trap(h) { return QB.callout('trap', h); }
  function tip(h) { return QB.callout('tip', h); }
  function chk(h) { return QB.callout('check', h); }

  var IDSS = [4, 5, 6, 7.5, 8, 9, 10, 12, 15, 16];
  var VPS = [2.5, 3, 3.5, 4, 4.5, 5, 6, 8];
  var VDDS = [12, 15, 16, 18, 20, 24];
  var YOS = [10, 20, 25, 40, 50];

  /* ------------------------------------------------------------ FET device model (n-channel equivalent) */
  // dev = {kind:'jfet'|'dmos'|'emos', p:bool, Idss, Vp(<0) | k, Vt(>0)}; p-channel values are the negatives
  function idOf(dev, V) {
    if (dev.kind === 'emos') return V > dev.Vt ? dev.k * Math.pow(V - dev.Vt, 2) : 0;
    if (V <= dev.Vp) return 0;
    return dev.Idss * Math.pow(1 - V / dev.Vp, 2);
  }
  function sg(dev) { return dev.p ? -1 : 1; }
  function devText(dev) {
    var s = sg(dev);
    if (dev.kind === 'emos') return 'k = ' + F.num(dev.k * 1e3, 3) + ' mA/V², V_{GS(Th)} = ' + pe(s * dev.Vt, 'V');
    return 'I_{DSS} = ' + pe(dev.Idss, 'A') + ', V_P = ' + pe(s * dev.Vp, 'V');
  }
  function devGiven(dev, withK) {
    var s = sg(dev);
    if (dev.kind === 'emos') {
      var out = [];
      if (dev.Ion != null && !withK) { out.push(g('$V_{GS(Th)}$', s * dev.Vt, 'V')); out.push(g('$I_{D(on)}$', dev.Ion, 'A')); out.push(g('$V_{GS(on)}$', s * dev.Von, 'V')); }
      else { out.push(g('$k$', F.num(dev.k * 1e3, 3) + ' mA/V²')); out.push(g('$V_{GS(Th)}$', s * dev.Vt, 'V')); }
      return out;
    }
    return [g('$I_{DSS}$', dev.Idss, 'A'), g('$V_P$', s * dev.Vp, 'V')];
  }
  function devName(dev) {
    var c = dev.p ? 'p-channel' : 'n-channel';
    return c + ' ' + (dev.kind === 'jfet' ? 'JFET' : dev.kind === 'dmos' ? 'depletion-type MOSFET' : 'enhancement-type MOSFET');
  }
  function newJ(r, kind, p) { return { kind: kind || 'jfet', p: !!p, Idss: r.pick(IDSS) * 1e-3, Vp: -r.pick(VPS) }; }
  function newE(r, p) {
    var Vt = r.nice(1, 4, 0.5), dV = r.nice(3, 6, 0.5), Ion = r.nice(3, 12, 1) * 1e-3;
    return { kind: 'emos', p: !!p, Vt: Vt, Von: Vt + dV, Ion: Ion, k: Ion / (dV * dV) };
  }
  function kStep(dev) {
    var s = sg(dev);
    return 'Device constant from the data-sheet point:' + M('k=\\frac{I_{D(on)}}{\\left(V_{GS(on)}-V_{GS(Th)}\\right)^2}=\\frac{' + mA(dev.Ion) + '\\,\\text{mA}}{\\left(' + sgnum(s * dev.Von) + '-(' + sgnum(s * dev.Vt) + ')\\right)^2}=' + tn(dev.k * 1e3, 4) + '\\,\\text{mA/V}^2');
  }
  /** solve I_D with bias line V_GS = Aoff − R·I_D (n-equivalent). Returns {I,V,roots,steps} or null. */
  function solveQ(dev, Aoff, R, lineTex) {
    var s = sg(dev), out = { steps: [] };
    var Rk = R / 1e3;
    if (R === 0) {
      var V0 = Aoff, I0 = idOf(dev, V0);
      out.I = I0; out.V = V0;
      if (dev.kind === 'emos') out.steps.push('Square law at $V_{GS}=' + sgnum(s * V0) + '$ V:' + M('I_D=k\\left(V_{GS}-V_{GS(Th)}\\right)^2=' + tn(dev.k * 1e3) + '\\left(' + sgnum(s * V0) + '-(' + sgnum(s * dev.Vt) + ')\\right)^2=' + mA(I0) + '\\,\\text{mA}'));
      else out.steps.push('Shockley at $V_{GS}=' + sgnum(s * V0, 4) + '$ V:' + M('I_D=I_{DSS}\\left(1-\\frac{V_{GS}}{V_P}\\right)^2=' + mA(dev.Idss) + '\\left(1-\\frac{' + sgnum(s * V0) + '}{' + sgnum(s * dev.Vp) + '}\\right)^2=' + mA(I0) + '\\,\\text{mA}'));
      return out;
    }
    var a, b, c, sub;
    if (dev.kind === 'emos') {
      var x = Aoff - dev.Vt, kk = dev.k * 1e3;          // mA/V²
      a = kk * Rk * Rk; b = -(2 * kk * Rk * x + 1); c = kk * x * x;
      var inner = dev.p ? ('\\left(' + sgnum(-x) + '+' + tn(Rk) + 'I_D\\right)^2') : ('\\left(' + sgnum(x) + '-' + tn(Rk) + 'I_D\\right)^2');
      sub = 'I_D=k\\left(V_{GS}-V_{GS(Th)}\\right)^2=' + tn(kk) + inner;
    } else {
      var u = 1 - Aoff / dev.Vp, w = Rk / dev.Vp, Id = dev.Idss * 1e3;   // w < 0
      a = Id * w * w; b = 2 * Id * u * w - 1; c = Id * u * u;
      sub = 'I_D=I_{DSS}\\left(1-\\frac{V_{GS}}{V_P}\\right)^2=' + tn(Id) + '\\left(' + tn(u) + '-' + tn(-w) + 'I_D\\right)^2';
    }
    var disc = b * b - 4 * a * c;
    if (!(disc > 0)) return null;
    var I1 = (-b - Math.sqrt(disc)) / (2 * a) * 1e-3, I2 = (-b + Math.sqrt(disc)) / (2 * a) * 1e-3;
    var roots = [I1, I2].map(function (I) {
      var V = Aoff - R * I, ok, why;
      if (dev.kind === 'emos') { ok = V > dev.Vt + 1e-9; why = ok ? (dev.p ? '$V_{GS}\\lt V_{GS(Th)}$: device on, keep' : '$V_{GS}>V_{GS(Th)}$: device on, keep') : (dev.p ? '$V_{GS}>V_{GS(Th)}$: device would be off, reject' : '$V_{GS}\\lt V_{GS(Th)}$: device would be off, reject'); }
      else if (dev.kind === 'jfet') { ok = V >= dev.Vp - 1e-9 && V <= 1e-9; why = ok ? (dev.p ? '$0\\le V_{GS}\\le V_P$: keep' : '$V_P\\le V_{GS}\\le 0$: keep') : (V > 0 ? 'gate junction forward biased, reject' : (dev.p ? '$V_{GS}>V_P$: beyond pinch-off, reject' : '$V_{GS}\\lt V_P$: beyond pinch-off, reject')); }
      else { ok = V >= dev.Vp - 1e-9; why = ok ? (dev.p ? '$V_{GS}\\le V_P$: keep (D-MOSFET may enhance)' : '$V_{GS}\\ge V_P$: keep (D-MOSFET may enhance)') : (dev.p ? '$V_{GS}>V_P$: beyond pinch-off, reject' : '$V_{GS}\\lt V_P$: beyond pinch-off, reject'); }
      return { I: I, V: V, ok: ok, why: why };
    });
    var good = roots.filter(function (q) { return q.ok; });
    if (good.length !== 1 || good[0].I <= 0) return null;
    out.I = good[0].I; out.V = good[0].V; out.roots = roots;
    out.steps.push('Substitute the bias line into the device equation (mA, kΩ, V):' + M(sub));
    out.steps.push('Expand into a quadratic:' + M(tn(a) + 'I_D^2' + plus(b) + 'I_D' + plus(c) + '=0') +
      M('I_D=\\frac{' + tn(-b) + '\\pm\\sqrt{' + tn(b * b) + '-4(' + tn(a) + ')(' + tn(c) + ')}}{2(' + tn(a) + ')}=' + mA(I1) + '\\ \\text{mA}\\ \\text{or}\\ ' + mA(I2) + '\\ \\text{mA}'));
    out.steps.push('Check each root on the bias line ' + lineTex + ':' + tbl(['$I_D$ (mA)', '$V_{GS}$ (V)', 'Verdict'], roots.map(function (q) { return [mA(q.I), sgnum(s * q.V), q.why]; })));
    return out;
  }
  /** saturation line; VDS, VGS n-equivalent. returns {ok, html} */
  function satCheck(dev, VDS, VGS) {
    var s = sg(dev), off = dev.kind === 'emos' ? dev.Vt : dev.Vp, need = VGS - off, ok = VDS >= need - 1e-9;
    var offT = dev.kind === 'emos' ? 'V_{GS(Th)}' : 'V_P';
    var h = dev.p ? ('Saturation check: $|V_{GS}-' + offT + '|=' + tn(need) + '$ V and $|V_{DS}|=' + tn(VDS) + '$ V')
      : ('Saturation check: $V_{GS}-' + offT + '=' + tn(need) + '$ V and $V_{DS}=' + tn(VDS) + '$ V');
    h += ok ? ', so $' + (dev.p ? '|V_{DS}|\\ge|V_{GS}-' + offT + '|' : 'V_{DS}\\ge V_{GS}-' + offT) + '$: <b>saturation</b> (pinch-off), the square law holds.'
      : ': the check <b>fails</b>, so the device is ohmic and the square-law Q-point is not valid.';
    return { ok: ok, need: need, html: h };
  }

  /* ------------------------------------------------------------ FET figures */
  function fetFig(cfg, o) {
    // cfg: 'fixed'|'self'|'vdb'|'dfb'|'zero'|'vss'|'follower'|'cg'
    var dev = o.devObj, s = sg(dev);
    var oo = Object.assign({}, o); delete oo.devObj;
    oo.dev = o.dev === false ? undefined : devText(dev);
    if (dev.kind === 'jfet') { oo.device = 'jfet'; oo.type = dev.p ? 'p' : 'n'; }
    else oo.device = (dev.p ? 'p' : 'n') + (dev.kind === 'dmos' ? 'D' : 'E');
    if (cfg === 'fixed') return S('jfetFixedBias', oo);
    if (cfg === 'self') return S('jfetSelfBias', oo);
    if (cfg === 'zero') { oo.RS = false; return S('jfetSelfBias', oo); }
    if (cfg === 'vdb') return S('fetVDB', oo);
    if (cfg === 'dfb') return S('emosDrainFeedback', oo);
    if (cfg === 'follower') return S('sourceFollower', oo);
    if (cfg === 'cg') return S('commonGate', oo);
    if (cfg === 'vss') return vssFig(oo);
    return null;
  }
  /** gate grounded, R_D to +V_DD, R_S to −V_SS (common-gate DC bias) */
  function vssFig(o) {
    if (!hasS('drawing')) return null;
    var d = QB.sch.drawing();
    var xc = 220, q = o.device === 'jfet' ? d.jfet({ at: [xc, 150], anchor: 'drain', type: o.type === 'p' ? 'p' : 'n', value: o.dev }) : d.mosfet({ at: [xc, 150], anchor: 'drain', type: o.device, value: o.dev });
    var ys = o.ac ? 240 : q.source[1], ybot = ys + 70;
    d.rail([xc, 22], { label: 'V_{DD}', value: o.VDD });
    d.resistor({ from: [xc, 22], to: [xc, 120], label: 'R_D', value: o.RD, side: 'right' });
    d.line([xc, 120], q.drain);
    if (o.ac) d.line(q.source, [xc, ys]);
    d.resistor({ from: [xc, ys], to: [xc, ybot], label: 'R_S', value: o.RS, side: 'right' });
    d.rail([xc, ybot], { label: '−V_{SS}', value: o.VSS, dir: 'down' });
    var gx = q.gate[0] - 24;
    d.line(q.gate, [gx, q.gate[1]], [gx, q.gate[1] + 22]); d.ground([gx, q.gate[1] + 22]);
    if (o.ac) {
      d.dot([xc, ys]); d.line([xc, ys], [xc - 60, ys]);
      d.capacitor({ from: [xc - 60, ys], to: [xc - 120, ys], label: 'C_1', side: 'top' });
      d.line([xc - 120, ys], [xc - 150, ys]); d.terminal([xc - 150, ys], { label: 'v_i', side: 'left' });
      d.dot([xc, 120]); d.line([xc, 120], [xc + 40, 120]);
      d.capacitor({ from: [xc + 40, 120], to: [xc + 100, 120], label: 'C_2', side: 'top' });
      d.line([xc + 100, 120], [xc + 130, 120]); d.terminal([xc + 130, 120], { label: 'v_o', side: 'right' });
    } else if (o.nodes) { d.dot([xc, 120]); d.labelNear([xc, 120], 'V_D', { prefer: ['left'] }); d.dot(q.source); d.labelNear(q.source, 'V_S', { prefer: ['left'] }); }
    return d.svg({ title: o.ac ? 'Common-gate amplifier with R_S to −V_SS' : 'FET with R_S returned to −V_SS' });
  }
  function R(x) { return pe(x, 'Ω'); }
  function V(x) { return pe(x, 'V'); }

  /* ============================================================ FET DEVICES (E9) */
  QB.add({
    id: 'edc.fet.devices.shockley', course: 'edc', module: 'fet', topic: 'devices',
    title: 'Shockley’s equation: forward, inverse and finding I_DSS', difficulty: 1, marks: 3,
    tags: ['WS7 Q3', 'WS7 Q6', 'Shockley'],
    variants: [{ id: 'fwd', label: 'n-JFET: I_D from V_GS' }, { id: 'inv', label: 'n-JFET: V_GS from I_D' }, { id: 'idss', label: 'Find I_DSS from a Q-point' },
      { id: 'pch', label: 'p-channel JFET' }, { id: 'dmos', label: 'D-MOSFET, both modes' }],
    gen: function (r, v) {
      var dev = newJ(r, v === 'dmos' ? 'dmos' : 'jfet', v === 'pch'), s = sg(dev), Vp = dev.Vp, Idss = dev.Idss, aVp = -Vp;
      var parts = [], given = devGiven(dev), data = { v: v, Idss: Idss, Vp: s * Vp }, notes = '';
      var stem;
      if (v === 'fwd' || v === 'pch') {
        var VGS = -r.nice(0.2, 0.8 * aVp, 0.1), I = idOf(dev, VGS);
        data.VGS = s * VGS;
        stem = 'An ' + devName(dev) + ' has $I_{DSS}=' + te(Idss, 'A') + '$ and $V_P=' + te(s * Vp, 'V') + '$.';
        parts.push({ q: 'Find $I_D$ at $V_{GS}=' + te(s * VGS, 'V') + '$.', answers: [A('ID', '$I_D$', I, 'A')],
          working: steps(['$V_{GS}$ lies between ' + (dev.p ? '0 and $V_P$' : '$V_P$ and 0') + ', so Shockley applies (signs kept):' +
            M('I_D=I_{DSS}\\left(1-\\frac{V_{GS}}{V_P}\\right)^2=' + mA(Idss) + '\\left(1-\\frac{' + sgnum(s * VGS) + '}{' + sgnum(s * Vp) + '}\\right)^2=' + mA(Idss) + '(' + tn(1 - VGS / Vp) + ')^2')]) + fin('I_D=' + te(I, 'A'))
        });
        var Vsat = VGS - Vp;
        parts.push({ q: 'At this $V_{GS}$, what ' + (dev.p ? 'magnitude of $V_{DS}$' : '$V_{DS}$') + ' marks the edge of saturation (the pinch-off knee)?', answers: [A('Vsat', '$|V_{DS(sat)}|$', Vsat, 'V')],
          working: steps(['The knee sits at $V_{DS(sat)}=V_{GS}-V_P=' + sgnum(s * VGS) + '-(' + sgnum(s * Vp) + ')=' + sgnum(s * Vsat) + '$ V.' + (dev.p ? ' For a p-channel device $V_{DS}$ is negative, so the device saturates for $V_{DS}\\le' + sgnum(s * Vsat) + '$ V.' : '')]) + fin('|V_{DS(sat)}|=' + te(Vsat, 'V'))
        });
        data.beyond = r.bool(0.5);
        if (data.beyond) {
          var V2 = Vp - r.pick([0.5, 1, 1.5]); data.V2 = s * V2;
          parts.push({ q: 'Find $I_D$ at $V_{GS}=' + te(s * V2, 'V') + '$.', answers: [A('I2', '$I_D$', 0, 'A', { abs: 1e-5 })],
            working: steps(['$V_{GS}=' + sgnum(s * V2) + '$ V is beyond $V_P=' + sgnum(s * Vp) + '$ V, so the channel is pinched off completely. Shockley does not apply there (the parabola would rise again).']) + fin('I_D=0')
          });
        }
        if (dev.p) notes = trap('For a p-channel JFET $V_P>0$ and $0\\le V_{GS}\\le V_P$. The equation is unchanged: substitute the signed values. $I_D$ flows from source to drain and $V_{DS}$ is negative.');
        else notes = trap('$V_{GS}/V_P$ is a ratio of two negatives, so it is positive. Getting $(1+\\ldots)^2$ gives $I_D>I_{DSS}$, impossible for a JFET.');
      } else if (v === 'inv') {
        var Iq = Math.round(r.float(0.12, 0.88, 2) * Idss * 1e4) / 1e4;
        var Vq = Vp * (1 - Math.sqrt(Iq / Idss)); data.ID = Iq;
        stem = 'An n-channel JFET has $I_{DSS}=' + te(Idss, 'A') + '$ and $V_P=' + te(Vp, 'V') + '$.';
        parts.push({ q: 'Find the exact $V_{GS}$ that gives $I_D=' + te(Iq, 'A') + '$.', answers: [A('VGS', '$V_{GS}$', Vq, 'V', { abs: 0.005 })],
          working: steps(['Invert Shockley:' + M('V_{GS}=V_P\\left(1-\\sqrt{\\frac{I_D}{I_{DSS}}}\\right)=' + sgnum(Vp) + '\\left(1-\\sqrt{\\frac{' + mA(Iq) + '}{' + mA(Idss) + '}}\\right)=' + sgnum(Vp) + '(' + tn(1 - Math.sqrt(Iq / Idss)) + ')'),
            'Check: $V_{GS}$ has the sign of $V_P$ and $|V_{GS}|\\lt |V_P|$.']) + fin('V_{GS}=' + te(Vq, 'V', 4))
        });
        var Vh = Vp * (1 - Math.SQRT1_2);
        parts.push({ q: 'Find the exact $V_{GS}$ for $I_D=I_{DSS}/2$ and compare it with the sketch shorthand $0.3V_P$.', answers: [A('Vh', '$V_{GS}$', Vh, 'V', { abs: 0.005 })],
          working: steps([M('V_{GS}=V_P(1-\\sqrt{0.5})=0.293V_P=' + tn(Vh) + '\\ \\text{V}'), 'Shorthand: $0.3V_P=' + tn(0.3 * Vp) + '$ V, about ' + tn(Math.abs(0.3 * Vp - Vh), 2) + ' V away, which is fine for a sketch but not for a numerical answer.']) + fin('V_{GS}=' + te(Vh, 'V', 4))
        });
      } else if (v === 'idss') {
        var VG1 = -r.nice(0.2, 0.75 * aVp, 0.1); var Iq2 = Math.round(idOf(dev, VG1) * 1e5) / 1e5; if (Iq2 <= 0) Iq2 = 1e-4;
        var IdssC = Iq2 / Math.pow(1 - VG1 / Vp, 2); data.VGS = VG1; data.ID = Iq2;
        stem = 'An n-channel JFET with $V_P=' + te(Vp, 'V') + '$ is measured at the Q-point $I_{DQ}=' + te(Iq2, 'A') + '$, $V_{GSQ}=' + te(VG1, 'V') + '$.';
        given = [g('$V_P$', Vp, 'V'), g('$I_{DQ}$', Iq2, 'A'), g('$V_{GSQ}$', VG1, 'V')];
        parts.push({ q: 'Find $I_{DSS}$.', answers: [A('Idss', '$I_{DSS}$', IdssC, 'A')],
          working: steps(['Rearrange Shockley:' + M('I_{DSS}=\\frac{I_D}{\\left(1-V_{GS}/V_P\\right)^2}=\\frac{' + mA(Iq2) + '}{\\left(1-\\frac{' + sgnum(VG1) + '}{' + sgnum(Vp) + '}\\right)^2}=\\frac{' + mA(Iq2) + '}{' + tn(Math.pow(1 - VG1 / Vp, 2)) + '}')]) + fin('I_{DSS}=' + te(IdssC, 'A'))
        });
        parts.push({ q: 'Find $I_D$ at $V_{GS}=V_P/2$.', answers: [A('Ihalf', '$I_D$', IdssC / 4, 'A')],
          working: steps(['$(1-0.5)^2=0.25$, so $I_D=I_{DSS}/4=' + mA(IdssC / 4) + '$ mA.']) + fin('I_D=' + te(IdssC / 4, 'A'))
        });
      } else { // dmos
        var Vn = -r.nice(0.2, 0.7 * aVp, 0.1), Vpos = r.pick([0.5, 1, 1.5]), In = idOf(dev, Vn), Ipos = idOf(dev, Vpos);
        var f3 = r.pick([1.2, 1.25, 1.4, 1.5]), I3 = f3 * Idss, V3 = Vp * (1 - Math.sqrt(f3));
        data.Vn = Vn; data.Vpos = Vpos; data.I3 = I3;
        stem = 'An n-channel depletion-type MOSFET has $I_{DSS}=' + te(Idss, 'A') + '$ and $V_P=' + te(Vp, 'V') + '$.';
        parts.push({ q: 'Find $I_D$ at $V_{GS}=' + te(Vn, 'V') + '$ and at $V_{GS}=+' + te(Vpos, 'V') + '$.', answers: [A('In', '$I_D(' + tn(Vn) + '\\,\\text{V})$', In, 'A'), A('Ipos', '$I_D(+' + tn(Vpos) + '\\,\\text{V})$', Ipos, 'A')],
          working: steps([M('I_D(' + tn(Vn) + ')=' + mA(Idss) + '\\left(1-\\frac{' + tn(Vn) + '}{' + tn(Vp) + '}\\right)^2=' + mA(In) + '\\,\\text{mA}\\quad(\\text{depletion mode})'),
            M('I_D(+' + tn(Vpos) + ')=' + mA(Idss) + '\\left(1-\\frac{' + tn(Vpos) + '}{' + tn(Vp) + '}\\right)^2=' + mA(Idss) + '(' + tn(1 - Vpos / Vp) + ')^2=' + mA(Ipos) + '\\,\\text{mA}'),
            'The positive-$V_{GS}$ point is above $I_{DSS}$: enhancement mode, possible only for a D-MOSFET.']) + fin('I_D=' + te(In, 'A') + ',\\quad ' + te(Ipos, 'A'))
        });
        parts.push({ q: 'Find the $V_{GS}$ that gives $I_D=' + te(I3, 'A') + '$.', answers: [A('V3', '$V_{GS}$', V3, 'V', { abs: 0.005 })],
          working: steps([M('V_{GS}=V_P\\left(1-\\sqrt{I_D/I_{DSS}}\\right)=' + tn(Vp) + '\\left(1-\\sqrt{' + tn(f3) + '}\\right)=' + tn(V3) + '\\ \\text{V}'), '$I_D>I_{DSS}$, so $V_{GS}$ comes out positive (enhancement mode).']) + fin('V_{GS}=+' + te(V3, 'V', 4))
        });
        notes = trap('Only a D-MOSFET may exceed $I_{DSS}$. Stopping its transfer curve at $V_{GS}=0$ loses every enhancement-mode point.');
      }
      return { stem: stem, figure: null, given: given, parts: parts, notes: notes, data: data };
    }
  });

  QB.add({
    id: 'edc.fet.devices.transfer', course: 'edc', module: 'fet', topic: 'devices',
    title: 'Transfer-curve sketch points (JFET, D-MOSFET, p-channel)', difficulty: 1, marks: 4,
    tags: ['WS7 Q5', 'WS7 Q7', 'sketch'],
    variants: [{ id: 'jfet', label: 'n-channel JFET' }, { id: 'dmos', label: 'n-channel D-MOSFET' }, { id: 'pjfet', label: 'p-channel JFET' }],
    gen: function (r, v) {
      var dev = newJ(r, v === 'dmos' ? 'dmos' : 'jfet', v === 'pjfet'), s = sg(dev), Vp = dev.Vp, Idss = dev.Idss;
      var Vh = Vp * (1 - Math.SQRT1_2), extraV = v === 'dmos' ? r.pick([0.5, 1, 1.5, 2]) : r.pick([0.25, 0.75]) * Vp;
      var extraI = idOf(dev, extraV);
      var pts = [[0, Idss], [0.3 * Vp, Idss / 2], [Vp / 2, Idss / 4], [Vp, 0]];
      var rows = [['$0$', mA(Idss) + ' ($I_{DSS}$)'], ['$0.3V_P=' + sgnum(s * 0.3 * Vp) + '$', mA(Idss / 2) + ' ($I_{DSS}/2$)'], ['$V_P/2=' + sgnum(s * Vp / 2) + '$', mA(Idss / 4) + ' ($I_{DSS}/4$)'], ['$V_P=' + sgnum(s * Vp) + '$', '0']];
      var plot = null;
      if (QB.plot && typeof QB.plot.curves === 'function') {
        var xs = [], ys = [], lo = Vp, hi = v === 'dmos' ? Math.max(extraV, 1) : 0;
        for (var i = 0; i <= 40; i++) { var x = lo + (hi - lo) * i / 40; xs.push(s * x); ys.push(idOf(dev, x) * 1e3); }
        plot = QB.plot.curves([{ x: xs, y: ys }], { xlabel: 'V_{GS} (V)', ylabel: 'I_D (mA)', ymin: 0, points: pts.map(function (p) { return { x: s * p[0], y: p[1] * 1e3 }; }) });
      }
      var parts = [];
      parts.push({ q: 'Give the four shorthand sketch points. State $I_D$ at $V_{GS}=V_P/2$, and the exact $V_{GS}$ for $I_D=I_{DSS}/2$.', answers: [A('Iq', '$I_D(V_P/2)$', Idss / 4, 'A'), A('Vh', '$V_{GS}(I_{DSS}/2)$', s * Vh, 'V', { abs: 0.005 })],
        working: steps(['Shorthand points (V, mA):' + tbl(['$V_{GS}$ (V)', '$I_D$ (mA)'], rows),
          '$V_P/2$ is exact: $(1-0.5)^2=0.25$, so $I_D=I_{DSS}/4=' + mA(Idss / 4) + '$ mA.',
          'The half-current point exactly: $V_{GS}=V_P(1-\\sqrt{0.5})=' + sgnum(s * Vh) + '$ V (shorthand $0.3V_P=' + sgnum(s * 0.3 * Vp) + '$ V).',
          'Plot the points and draw a smooth curve, concave up, touching the $V_{GS}$ axis at $V_P$.' + (plot ? '<div class="qb-fig">' + plot + '</div>' : '')]) + fin('I_D=' + te(Idss / 4, 'A') + ',\\quad V_{GS}=' + te(s * Vh, 'V', 4))
      });
      parts.push({ q: v === 'dmos' ? 'Add one enhancement-mode point: find $I_D$ at $V_{GS}=+' + te(extraV, 'V') + '$.' : 'Add one more point from Shockley: find $I_D$ at $V_{GS}=' + te(s * extraV, 'V') + '$.',
        answers: [A('Ix', '$I_D$', extraI, 'A')],
        working: steps([M('I_D=' + mA(Idss) + '\\left(1-\\frac{' + sgnum(s * extraV) + '}{' + sgnum(s * Vp) + '}\\right)^2=' + mA(extraI) + '\\ \\text{mA}'), v === 'dmos' ? 'Above $I_{DSS}$: the D-MOSFET curve carries on to the right of the $I_D$ axis.' : 'Use it to check the curvature between the shorthand points.']) + fin('I_D=' + te(extraI, 'A'))
      });
      return {
        stem: 'Sketch the transfer characteristic of an ' + devName(dev) + ' with $I_{DSS}=' + te(Idss, 'A') + '$ and $V_P=' + te(s * Vp, 'V') + '$.',
        figure: null, given: devGiven(dev), parts: parts, data: { v: v, Idss: Idss, Vp: s * Vp, xV: s * extraV },
        notes: trap('A straight line from $(V_P,0)$ to $(0,I_{DSS})$ is wrong: the curve is a parabola, so it passes $I_{DSS}/4$ (not $I_{DSS}/2$) at $V_P/2$.')
      };
    }
  });

  QB.add({
    id: 'edc.fet.devices.emosk', course: 'edc', module: 'fet', topic: 'devices',
    title: 'E-MOSFET: k from a data-sheet point, then I_D and V_GS', difficulty: 2, marks: 4,
    tags: ['E-MOSFET', 'k'],
    variants: [{ id: 'n', label: 'n-channel' }, { id: 'p', label: 'p-channel (V_T < 0)' }, { id: 'vt', label: 'Find V_T and k from two points' }],
    gen: function (r, v) {
      var parts = [], data = { v: v }, stem, given;
      if (v === 'vt') {
        var Vt = r.nice(1, 3.5, 0.5), k = r.pick([0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8]) * 1e-3;
        var V1 = Vt + r.nice(1, 2.5, 0.5), V2 = V1 + r.nice(1.5, 4, 0.5);
        var I1 = Math.round(k * Math.pow(V1 - Vt, 2) * 1e6) / 1e6, I2 = Math.round(k * Math.pow(V2 - Vt, 2) * 1e6) / 1e6;
        var rr = Math.sqrt(I1 / I2), VtC = (V1 - rr * V2) / (1 - rr), kC = I1 / Math.pow(V1 - VtC, 2);
        var V3 = V2 + r.nice(0.5, 2, 0.5), I3 = kC * Math.pow(V3 - VtC, 2);
        data.V1 = V1; data.I1 = I1; data.V2 = V2; data.I2 = I2; data.V3 = V3;
        stem = 'An n-channel E-MOSFET in saturation is measured at two points: $I_D=' + te(I1, 'A', 4) + '$ at $V_{GS}=' + te(V1, 'V') + '$, and $I_D=' + te(I2, 'A', 4) + '$ at $V_{GS}=' + te(V2, 'V') + '$.';
        given = [g('$I_{D1}$ at $V_{GS1}$', pe(I1, 'A', 4) + ' at ' + V(V1)), g('$I_{D2}$ at $V_{GS2}$', pe(I2, 'A', 4) + ' at ' + V(V2))];
        parts.push({ q: 'Find the threshold $V_{GS(Th)}$.', answers: [A('Vt', '$V_{GS(Th)}$', VtC, 'V', { abs: 0.01 })],
          working: steps(['Take the ratio so that $k$ cancels:' + M('\\sqrt{\\frac{I_{D1}}{I_{D2}}}=\\frac{V_{GS1}-V_T}{V_{GS2}-V_T}\\ \\Rightarrow\\ ' + tn(rr) + '=\\frac{' + tn(V1) + '-V_T}{' + tn(V2) + '-V_T}'),
            M('V_T=\\frac{V_{GS1}-' + tn(rr) + 'V_{GS2}}{1-' + tn(rr) + '}=\\frac{' + tn(V1) + '-' + tn(rr * V2) + '}{' + tn(1 - rr) + '}')]) + fin('V_{GS(Th)}=' + te(VtC, 'V'))
        });
        parts.push({ q: 'Find $k$.', answers: [A('k', '$k$', kC, 'A/V²')],
          working: steps([M('k=\\frac{I_{D1}}{(V_{GS1}-V_T)^2}=\\frac{' + mA(I1) + '}{(' + tn(V1 - VtC) + ')^2}=' + tn(kC * 1e3) + '\\,\\text{mA/V}^2')]) + fin('k=' + tn(kC * 1e3, 3) + '\\,\\text{mA/V}^2')
        });
        parts.push({ q: 'Find $I_D$ at $V_{GS}=' + te(V3, 'V') + '$.', answers: [A('I3', '$I_D$', I3, 'A')],
          working: steps([M('I_D=k(V_{GS}-V_T)^2=' + tn(kC * 1e3) + '(' + tn(V3 - VtC) + ')^2=' + mA(I3) + '\\,\\text{mA}')]) + fin('I_D=' + te(I3, 'A'))
        });
        return { stem: stem, figure: null, given: given, parts: parts, data: data, notes: trap('Do not use $I_{DSS}$ or Shockley for an E-MOSFET. Two points fix the two unknowns $k$ and $V_T$.') };
      }
      var dev = newE(r, v === 'p'), s = sg(dev);
      data.Vt = s * dev.Vt; data.Von = s * dev.Von; data.Ion = dev.Ion;
      stem = 'An ' + devName(dev) + ' data sheet gives $V_{GS(Th)}=' + te(s * dev.Vt, 'V') + '$ and $I_{D(on)}=' + te(dev.Ion, 'A') + '$ at $V_{GS(on)}=' + te(s * dev.Von, 'V') + '$.';
      parts.push({ q: 'Find $k$.', answers: [A('k', '$k$', dev.k, 'A/V²')], working: steps([kStep(dev)]) + fin('k=' + tn(dev.k * 1e3, 3) + '\\,\\text{mA/V}^2') });
      var VG1 = dev.Vt + r.nice(1, dev.Von - dev.Vt + 2, 0.5), I1b = idOf(dev, VG1), below = r.bool(0.4), VGb = dev.Vt - r.pick([0.5, 1]);
      data.VG1 = s * VG1; data.below = below; data.VGb = s * VGb;
      var ans1 = [A('I1', '$I_D(' + tn(s * VG1) + '\\,\\text{V})$', I1b, 'A')], w1 = [M('I_D=k(V_{GS}-V_{GS(Th)})^2=' + tn(dev.k * 1e3) + '\\left(' + sgnum(s * VG1) + '-(' + sgnum(s * dev.Vt) + ')\\right)^2=' + mA(I1b) + '\\,\\text{mA}')];
      if (below) { ans1.push(A('Ib', '$I_D(' + tn(s * VGb) + '\\,\\text{V})$', 0, 'A', { abs: 1e-5 })); w1.push('At $V_{GS}=' + sgnum(s * VGb) + '$ V the gate has not reached the threshold, so there is no channel: $I_D=0$.'); }
      parts.push({ q: 'Find $|I_D|$ at $V_{GS}=' + te(s * VG1, 'V') + '$' + (below ? ' and at $V_{GS}=' + te(s * VGb, 'V') + '$' : '') + '.', answers: ans1, working: steps(w1) + fin('|I_D|=' + te(I1b, 'A')) });
      var ov2 = r.nice(1, 5, 0.5), I2b = Math.round(dev.k * ov2 * ov2 * 1e5) / 1e5, ovC = Math.sqrt(I2b / dev.k), VGx = dev.Vt + ovC;
      data.I2 = I2b;
      parts.push({ q: 'Find $V_{GS}$ for $|I_D|=' + te(I2b, 'A') + '$. Show both roots and justify your choice.', answers: [A('VGS', '$V_{GS}$', s * VGx, 'V', { abs: 0.005 })],
        working: steps([M('(V_{GS}-V_{GS(Th)})^2=\\frac{I_D}{k}=\\frac{' + mA(I2b) + '}{' + tn(dev.k * 1e3) + '}=' + tn(ovC * ovC) + '\\ \\Rightarrow\\ V_{GS}=' + sgnum(s * dev.Vt) + '\\pm' + tn(ovC)),
          'Roots: $' + tn(s * dev.Vt + ovC) + '$ V and $' + tn(s * dev.Vt - ovC) + '$ V. ' + (dev.p ? 'A p-channel E-MOSFET conducts only for $V_{GS}\\lt V_{GS(Th)}$, so keep the more negative root.' : 'The device conducts only for $V_{GS}>V_{GS(Th)}$, so keep the larger root.')]) + fin('V_{GS}=' + te(s * VGx, 'V', 4))
      });
      parts.push({ q: 'What ' + (dev.p ? '$|V_{DS}|$' : '$V_{DS}$') + ' is needed to keep the device in saturation at that point?', answers: [A('Vsat', '$|V_{DS(sat)}|$', ovC, 'V')],
        working: steps(['$V_{DS(sat)}=V_{GS}-V_{GS(Th)}=' + sgnum(s * ovC) + '$ V' + (dev.p ? ', so saturation needs $V_{DS}\\le' + sgnum(-ovC) + '$ V.' : ', so saturation needs $V_{DS}\\ge' + tn(ovC) + '$ V.')]) + fin('|V_{DS(sat)}|=' + te(ovC, 'V'))
      });
      return { stem: stem, figure: null, given: devGiven(dev), parts: parts, data: data, notes: trap('Units: keep $k$ in mA/V² with $I_D$ in mA. And $k=I_{D(on)}/(V_{GS(on)}-V_{GS(Th)})^2$, not $I_{D(on)}/V_{GS(on)}^2$.') };
    }
  });

  QB.add({
    id: 'edc.fet.devices.twopoint', course: 'edc', module: 'fet', topic: 'devices',
    title: 'Find V_P and I_DSS from two bias points; ohmic r_d', difficulty: 3, marks: 8,
    tags: ['chained', 'E9 Q4'],
    variants: [{ id: 'nch', label: 'n-channel JFET' }, { id: 'pch', label: 'p-channel JFET' }],
    gen: function (r, v) {
      var dev = newJ(r, 'jfet', v === 'pch'), s = sg(dev), aVp = -dev.Vp;
      var a1 = r.nice(0.1 * aVp, 0.4 * aVp, 0.1), a2 = r.nice(Math.max(0.55 * aVp, a1 + 0.5), 0.85 * aVp, 0.1);
      if (a2 <= a1) a2 = a1 + 0.5;
      var V1 = -a1, V2 = -a2;
      var I1 = Math.round(idOf(dev, V1) * 1e6) / 1e6, I2 = Math.round(idOf(dev, V2) * 1e6) / 1e6;
      var sq = Math.sqrt(I1 / I2), u = (1 - sq) / (V1 - sq * V2), VpC = 1 / u, IdssC = I1 / Math.pow(1 - V1 / VpC, 2);
      var ro = r.pick([100, 150, 200, 250, 300, 400, 500]), V3 = VpC / 2 * r.pick([0.5, 1]), rd = ro / Math.pow(1 - V3 / VpC, 2);
      var parts = [];
      parts.push({ q: 'Find $V_P$.', answers: [A('Vp', '$V_P$', s * VpC, 'V', { abs: 0.01 })],
        working: steps(['Take the ratio of the two Shockley equations so that $I_{DSS}$ cancels. With $u=1/V_P$:' + M('\\sqrt{\\frac{' + mA(I1) + '}{' + mA(I2) + '}}=' + tn(sq) + '=\\frac{1-(' + sgnum(s * V1) + ')u}{1-(' + sgnum(s * V2) + ')u}'),
          M(tn(sq) + '-' + tn(sq * s * V2) + 'u=1-' + tn(s * V1) + 'u\\ \\Rightarrow\\ u=\\frac{1-' + tn(sq) + '}{' + tn(s * V1) + '-' + tn(sq * s * V2) + '}=' + tn(s * u) + '\\ \\text{V}^{-1}')]) + fin('V_P=' + te(s * VpC, 'V'))
      });
      parts.push({ q: 'Find $I_{DSS}$.', answers: [A('Idss', '$I_{DSS}$', IdssC, 'A')],
        working: steps([M('I_{DSS}=\\frac{I_{D1}}{(1-V_{GS1}/V_P)^2}=\\frac{' + mA(I1) + '}{(1-' + tn(V1 / VpC) + ')^2}=' + mA(IdssC) + '\\,\\text{mA}'), 'Check with the second point: $' + mA(IdssC) + '(1-' + tn(V2 / VpC) + ')^2=' + mA(IdssC * Math.pow(1 - V2 / VpC, 2)) + '$ mA.']) + fin('I_{DSS}=' + te(IdssC, 'A'))
      });
      parts.push({ q: 'Find $I_D$ at $V_{GS}=V_P/2$ and the ' + (dev.p ? '$|V_{DS}|$' : '$V_{DS}$') + ' at which the device enters saturation there.', answers: [A('Ih', '$I_D$', IdssC / 4, 'A'), A('Vk', '$|V_{DS(sat)}|$', -VpC / 2, 'V')],
        working: steps(['$V_P/2$ is the $I_{DSS}/4$ shorthand point: $I_D=' + mA(IdssC / 4) + '$ mA.', 'Knee: $V_{DS(sat)}=V_{GS}-V_P=' + sgnum(s * VpC / 2) + '-(' + sgnum(s * VpC) + ')=' + sgnum(-s * VpC / 2) + '$ V.']) + fin('I_D=' + te(IdssC / 4, 'A') + ',\\quad |V_{DS(sat)}|=' + te(-VpC / 2, 'V'))
      });
      parts.push({ q: 'In the ohmic region the channel resistance at $V_{GS}=0$ is $r_o=' + te(ro, 'Ω') + '$. Find $r_d$ at $V_{GS}=' + te(s * V3, 'V', 4) + '$.', answers: [A('rd', '$r_d$', rd, 'Ω')],
        working: steps([M('r_d=\\frac{r_o}{(1-V_{GS}/V_P)^2}=\\frac{' + tn(ro) + '}{(' + tn(1 - V3 / VpC) + ')^2}=' + tn(rd) + '\\ \\Omega'), 'The resistance rises as $V_{GS}$ approaches $V_P$: a voltage-controlled resistor.']) + fin('r_d=' + te(rd, 'Ω'))
      });
      return {
        stem: 'An ' + devName(dev) + ' in saturation is measured at two bias points: $I_D=' + te(I1, 'A', 4) + '$ at $V_{GS}=' + te(s * V1, 'V') + '$, and $I_D=' + te(I2, 'A', 4) + '$ at $V_{GS}=' + te(s * V2, 'V') + '$.',
        figure: null, given: [g('Point 1', pe(I1, 'A', 4) + ' at ' + V(s * V1)), g('Point 2', pe(I2, 'A', 4) + ' at ' + V(s * V2)), g('$r_o$', ro, 'Ω')],
        parts: parts, data: { v: v, V1: s * V1, I1: I1, V2: s * V2, I2: I2, ro: ro, V3: s * V3 },
        notes: tip('Dividing the two Shockley equations removes $I_{DSS}$ and leaves one linear equation in $1/V_P$.')
      };
    }
  });

  /* ============================================================ FET DC BIAS (E10) */
  /** pick R_D so the device sits in saturation with margin; returns null if impossible */
  function pickRD(r, I, VDD, VS, need, lo) {
    if (I <= 0) return pickE(r, 'E12', 1000, 4700);
    var hi = (VDD - VS - need - 1) / I, lo2 = Math.max(lo || 470, 0.3 * hi);
    if (hi < 330) return null;
    return pickE(r, 'E12', Math.min(lo2, hi), hi);
  }
  function outSide(dev, I, VDD, RD, VS, VGS, extraLine) {
    var s = sg(dev), VD = VDD - I * RD, VDS = VD - VS;
    var w = ['Output side:' + M('V_D=V_{DD}' + (dev.p ? '+' : '-') + 'I_DR_D=' + sgnum(s * VDD) + (dev.p ? '+' : '-') + '(' + mA(I) + '\\,\\text{mA})(' + kO(RD) + '\\,\\text{k}\\Omega)=' + sgnum(s * VD) + '\\ \\text{V}') +
      M('V_S=' + sgnum(s * VS) + '\\ \\text{V},\\qquad V_{DS}=V_D-V_S=' + sgnum(s * VDS) + '\\ \\text{V}')];
    if (extraLine) w.push(extraLine);
    var sc = satCheck(dev, VDS, VGS);
    w.push(sc.html);
    return { VD: VD, VDS: VDS, sat: sc.ok, need: sc.need, w: w };
  }

  QB.add({
    id: 'edc.fet.bias.fixed', course: 'edc', module: 'fet', topic: 'bias',
    title: 'Fixed bias (JFET and D-MOSFET)', difficulty: 1, marks: 4,
    tags: ['WS8 Q1', 'WS8 Q2', 'fixed bias'],
    variants: [{ id: 'n', label: 'n-channel JFET' }, { id: 'p', label: 'p-channel JFET' }, { id: 'cutoff', label: 'V_GS at or beyond V_P' }, { id: 'dmos', label: 'D-MOSFET, positive gate' }],
    gen: function (r, v) {
      return r.retry(function () {
        var dev = newJ(r, v === 'dmos' ? 'dmos' : 'jfet', v === 'p'), s = sg(dev), aVp = -dev.Vp;
        var VGS;
        if (v === 'cutoff') VGS = dev.Vp - r.pick([0, 0, 0.5, 1]);
        else if (v === 'dmos') VGS = r.pick([0.5, 1, 1.5]);
        else VGS = -r.nice(0.2 * aVp, 0.7 * aVp, 0.1);
        if (v !== 'cutoff' && v !== 'dmos' && VGS === 0) return null;
        var VDD = r.pick(VDDS), I = idOf(dev, VGS);
        var RD = pickRD(r, I, VDD, 0, VGS - dev.Vp, 470); if (!RD) return null;
        var RG = r.pick([1e6, 2.2e6, 10e6]);
        var o = outSide(dev, I, VDD, RD, 0, VGS);
        if (I > 0 && (!o.sat || o.VDS < 1)) return null;
        var parts = [];
        var lineTex = v === 'dmos' ? 'V_{GS}=+V_{GG}' : (dev.p ? 'V_{GS}=+V_{GG}' : 'V_{GS}=-V_{GG}');
        var w1 = ['No gate current flows, so there is no drop across $R_G$: $' + lineTex + '=' + sgnum(s * VGS) + '$ V.'];
        if (v === 'cutoff') w1.push('$V_{GS}=' + sgnum(VGS) + '$ V ' + (VGS === dev.Vp ? 'equals' : 'is beyond') + ' $V_P=' + sgnum(dev.Vp) + '$ V, so the JFET is pinched off: $I_D=0$. No Shockley arithmetic is needed.');
        else w1 = w1.concat(solveQ(dev, VGS, 0).steps);
        parts.push({ q: 'Find $V_{GSQ}$ and ' + (dev.p ? '$|I_{DQ}|$' : '$I_{DQ}$') + '.', answers: [A('VGS', '$V_{GSQ}$', s * VGS, 'V', { abs: 0.01 }), A('ID', '$I_{DQ}$', I, 'A', I === 0 ? { abs: 1e-5 } : null)],
          working: steps(w1) + fin('V_{GSQ}=' + te(s * VGS, 'V') + ',\\quad I_{DQ}=' + (I === 0 ? '0' : te(I, 'A'))) });
        if (I === 0) {
          parts.push({ q: 'Find $V_D$.', answers: [A('VD', '$V_D$', s * VDD, 'V')], working: steps(['$V_D=V_{DD}-I_DR_D=' + tn(VDD) + '-0=' + tn(VDD) + '$ V. The device is cut off.']) + fin('V_D=' + te(VDD, 'V')) });
        } else {
          parts.push({ q: 'Find $V_{DS}$ and confirm the device is in saturation.', answers: [A('VDS', '$V_{DS}$', s * o.VDS, 'V')], working: steps(o.w) + fin('V_{DS}=' + te(s * o.VDS, 'V')) });
        }
        var fig = fetFig('fixed', { devObj: dev, VDD: V(s * VDD), VGG: V(Math.abs(VGS)), RG: R(RG), RD: R(RD), type: (v === 'dmos' || dev.p) ? 'p' : 'n', nodes: true });
        var stem = 'The ' + devName(dev) + ' below is fixed-biased: $V_{DD}=' + te(s * VDD, 'V') + '$, $R_D=' + te(RD, 'Ω') + '$, $R_G=' + te(RG, 'Ω') + '$ and a gate battery $V_{GG}=' + te(Math.abs(VGS), 'V') + '$ that makes the gate ' + ((s * VGS) < 0 ? 'negative' : 'positive') + '. The device has $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(s * dev.Vp, 'V') + '$.';
        return { stem: stem, figure: fig, given: [g('$V_{DD}$', s * VDD, 'V'), g('$V_{GG}$', Math.abs(VGS), 'V'), g('$R_D$', RD, 'Ω'), g('$R_G$', RG, 'Ω')].concat(devGiven(dev)), parts: parts,
          data: { v: v, Idss: dev.Idss, Vp: s * dev.Vp, VGS: s * VGS, VDD: s * VDD, RD: RD },
          notes: trap('Read the battery polarity: with its + terminal at ground the gate is at $-V_{GG}$. And $R_G$ carries no current, so it drops no voltage.') };
      });
    }
  });

  QB.add({
    id: 'edc.fet.bias.self', course: 'edc', module: 'fet', topic: 'bias',
    title: 'Self-bias JFET: solve the quadratic, pick the root', difficulty: 2, marks: 6,
    tags: ['WS8 Q3', 'WS8 Q4', 'quadratic', 'exam-style'],
    variants: [{ id: 'n', label: 'n-channel, find Q-point' }, { id: 'p', label: 'p-channel, find Q-point' }, { id: 'meas', label: 'Measured V_S given' }, { id: 'design', label: 'Design R_S and R_D' }],
    gen: function (r, v) {
      return r.retry(function () {
        var dev = newJ(r, 'jfet', v === 'p'), s = sg(dev), VDD = r.pick(VDDS), RG = r.pick([1e6, 2.2e6, 3.3e6, 10e6]);
        var parts = [], data = { v: v, Idss: dev.Idss, Vp: s * dev.Vp, VDD: s * VDD }, stem, fig, given;
        if (v === 'n' || v === 'p') {
          var RS = pickE(r, 'E12', 220, 2200);
          var lineTex = dev.p ? '$V_{GS}=+I_DR_S$' : '$V_{GS}=-I_DR_S$';
          var q = solveQ(dev, 0, RS, lineTex); if (!q) return null;
          var RD = pickRD(r, q.I, VDD, q.I * RS, q.V - dev.Vp, 680); if (!RD) return null;
          var o = outSide(dev, q.I, VDD, RD, q.I * RS, q.V); if (!o.sat) return null;
          data.RS = RS; data.RD = RD;
          parts.push({ q: 'Write the bias line, solve for $I_{DQ}$ and $V_{GSQ}$, and justify your choice of root.', answers: [A('ID', '$I_{DQ}$', q.I, 'A'), A('VGS', '$V_{GSQ}$', s * q.V, 'V', { abs: 0.01 })],
            working: steps(['$I_G=0$ so $V_G=0$, and $V_S=' + (dev.p ? '-' : '') + 'I_DR_S$. Bias line (mA, kΩ): ' + M('V_{GS}=' + (dev.p ? '+' : '-') + 'I_DR_S=' + (dev.p ? '' : '-') + kO(RS) + 'I_D')].concat(q.steps)) + fin('I_{DQ}=' + te(q.I, 'A') + ',\\quad V_{GSQ}=' + te(s * q.V, 'V')) });
          parts.push({ q: 'Find $V_S$, $V_D$ and $V_{DS}$, and check saturation.', answers: [A('VS', '$V_S$', s * q.I * RS, 'V'), A('VD', '$V_D$', s * o.VD, 'V'), A('VDS', '$V_{DS}$', s * o.VDS, 'V')], working: steps(o.w) + fin('V_{DS}=' + te(s * o.VDS, 'V')) });
          stem = 'The self-biased ' + devName(dev) + ' below has $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(s * dev.Vp, 'V') + '$. Use a purely mathematical approach.';
          fig = fetFig('self', { devObj: dev, VDD: V(s * VDD), RG: R(RG), RD: R(RD), RS: R(RS), nodes: true });
          given = [g('$V_{DD}$', s * VDD, 'V'), g('$R_D$', RD, 'Ω'), g('$R_S$', RS, 'Ω'), g('$R_G$', RG, 'Ω')].concat(devGiven(dev));
        } else if (v === 'meas') {
          var RSm = pickE(r, 'E12', 270, 1800), q2 = solveQ(dev, 0, RSm, ''); if (!q2) return null;
          var VSm = Math.round(q2.I * RSm * 100) / 100, Im = VSm / RSm, VGm = -VSm, IdssC = Im / Math.pow(1 - VGm / dev.Vp, 2);
          if (VSm <= 0.05 || VGm <= dev.Vp) return null;
          var RDm = pickRD(r, Im, VDD, VSm, VGm - dev.Vp, 680); if (!RDm) return null;
          var VDm = VDD - Im * RDm, VDSm = VDm - VSm;
          data.RS = RSm; data.RD = RDm; data.VSm = VSm; data.Idss = null;
          parts.push({ q: 'Find $I_{DQ}$ and $V_{GSQ}$.', answers: [A('ID', '$I_{DQ}$', Im, 'A'), A('VGS', '$V_{GSQ}$', VGm, 'V', { abs: 0.01 })],
            working: steps(['$I_{DQ}=V_S/R_S=' + tn(VSm) + '/' + kO(RSm) + '=' + mA(Im) + '$ mA.', '$V_G=0$, so $V_{GSQ}=V_G-V_S=' + tn(VGm) + '$ V.']) + fin('I_{DQ}=' + te(Im, 'A') + ',\\quad V_{GSQ}=' + te(VGm, 'V')) });
          parts.push({ q: 'Find $I_{DSS}$.', answers: [A('Idss', '$I_{DSS}$', IdssC, 'A')],
            working: steps([M('I_{DSS}=\\frac{I_D}{(1-V_{GS}/V_P)^2}=\\frac{' + mA(Im) + '}{(1-' + tn(VGm / dev.Vp) + ')^2}=' + mA(IdssC) + '\\,\\text{mA}')]) + fin('I_{DSS}=' + te(IdssC, 'A')) });
          parts.push({ q: 'Find $V_D$ and $V_{DS}$.', answers: [A('VD', '$V_D$', VDm, 'V'), A('VDS', '$V_{DS}$', VDSm, 'V')],
            working: steps(['$V_D=V_{DD}-I_DR_D=' + tn(VDD) + '-' + mA(Im) + '(' + kO(RDm) + ')=' + tn(VDm) + '$ V', '$V_{DS}=V_D-V_S=' + tn(VDSm) + '$ V', satCheck(dev, VDSm, VGm).html]) + fin('V_D=' + te(VDm, 'V') + ',\\quad V_{DS}=' + te(VDSm, 'V')) });
          stem = 'For the self-biased n-channel JFET below ($V_P=' + te(dev.Vp, 'V') + '$, $I_{DSS}$ unknown) the source voltage is measured as $V_S=' + te(VSm, 'V') + '$.';
          fig = fetFig('self', { devObj: dev, dev: false, VDD: V(VDD), RG: R(RG), RD: R(RDm), RS: R(RSm), nodes: true });
          given = [g('$V_{DD}$', VDD, 'V'), g('$R_D$', RDm, 'Ω'), g('$R_S$', RSm, 'Ω'), g('$V_P$', dev.Vp, 'V'), g('$V_S$ (measured)', VSm, 'V')];
        } else {
          var It = Math.round(r.float(0.25, 0.6, 2) * dev.Idss * 1e4) / 1e4, VGt = dev.Vp * (1 - Math.sqrt(It / dev.Idss)), RSd = -VGt / It;
          var need = VGt - dev.Vp, VDt = r.nice(Math.ceil(-VGt + need + 2), VDD - 3, 0.5);
          if (VDt >= VDD - 2) return null;
          var RDd = (VDD - VDt) / It, VDSd = VDt + VGt;
          data.It = It; data.VDt = VDt;
          parts.push({ q: 'Find $V_{GSQ}$ and the $R_S$ that gives $I_{DQ}=' + te(It, 'A') + '$.', answers: [A('VGS', '$V_{GSQ}$', VGt, 'V', { abs: 0.01 }), A('RS', '$R_S$', RSd, 'Ω')],
            working: steps(['Invert Shockley:' + M('V_{GS}=V_P\\left(1-\\sqrt{I_D/I_{DSS}}\\right)=' + tn(dev.Vp) + '\\left(1-\\sqrt{' + tn(It / dev.Idss) + '}\\right)=' + tn(VGt) + '\\ \\text{V}'),
              'Self-bias: $V_{GS}=-I_DR_S$, so $R_S=-V_{GS}/I_D=' + tn(-VGt) + '/' + mA(It) + '=' + kO(RSd) + '$ kΩ.']) + fin('R_S=' + te(RSd, 'Ω')) });
          parts.push({ q: 'Find $R_D$ for $V_D=' + te(VDt, 'V') + '$, then check saturation.', answers: [A('RD', '$R_D$', RDd, 'Ω'), A('VDS', '$V_{DS}$', VDSd, 'V')],
            working: steps(['$R_D=(V_{DD}-V_D)/I_D=(' + tn(VDD) + '-' + tn(VDt) + ')/' + mA(It) + '=' + kO(RDd) + '$ kΩ', '$V_{DS}=V_D-V_S=' + tn(VDt) + '-' + tn(-VGt) + '=' + tn(VDSd) + '$ V', satCheck(dev, VDSd, VGt).html, 'Then pick the nearest standard values (for example $R_S\\approx' + te(nearestE(RSd), 'Ω') + '$, $R_D\\approx' + te(nearestE(RDd), 'Ω') + '$) and recheck.']) + fin('R_D=' + te(RDd, 'Ω')) });
          stem = 'Design a self-bias stage for an n-channel JFET with $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(dev.Vp, 'V') + '$ on $V_{DD}=' + te(VDD, 'V') + '$. The targets are $I_{DQ}=' + te(It, 'A') + '$ and $V_D=' + te(VDt, 'V') + '$.';
          fig = fetFig('self', { devObj: dev, VDD: V(VDD), RG: R(RG), RD: { label: 'R_D', value: '?' }, RS: { label: 'R_S', value: '?' }, nodes: true });
          given = [g('$V_{DD}$', VDD, 'V'), g('target $I_{DQ}$', It, 'A'), g('target $V_D$', VDt, 'V')].concat(devGiven(dev));
        }
        return { stem: stem, figure: fig, given: given, parts: parts, data: data,
          notes: trap('Two roots come out of the quadratic. Compute $V_{GS}$ for each and reject the one beyond $V_P$ (the mirror half of the parabola). Work in mA and kΩ so the coefficients come out in volts.') };
      });
    }
  });

  QB.add({
    id: 'edc.fet.bias.vdb', course: 'edc', module: 'fet', topic: 'bias',
    title: 'Voltage-divider and common-gate (−V_SS) bias: JFET and D-MOSFET', difficulty: 2, marks: 7,
    tags: ['WS8 Q5', 'WS9 Q2', 'WS9 Q4', 'exam-style'],
    variants: [{ id: 'jfet', label: 'JFET divider' }, { id: 'dmos', label: 'D-MOSFET divider (V_GS may be +)' }, { id: 'design', label: 'Design R_S and R_D' }, { id: 'vss', label: 'Gate grounded, R_S to −V_SS' }],
    gen: function (r, v) {
      return r.retry(function () {
        var dev = newJ(r, v === 'dmos' ? 'dmos' : 'jfet'), VDD = r.pick(VDDS), parts = [], data = { v: v, Idss: dev.Idss, Vp: dev.Vp, VDD: VDD };
        var stem, fig, given;
        if (v === 'vss') {
          var VSS = r.pick([2, 3, 4, 5, 6, 8, 10]), RSv = pickE(r, 'E12', 680, 4700);
          var qv = solveQ(dev, VSS, RSv, '$V_{GS}=V_{SS}-I_DR_S$'); if (!qv) return null;
          var VSv = -VSS + qv.I * RSv, RDv = pickRD(r, qv.I, VDD, VSv, qv.V - dev.Vp, 680); if (!RDv) return null;
          var ov = outSide(dev, qv.I, VDD, RDv, VSv, qv.V, 'Check with the slide formula: $V_{DS}=V_{DD}+V_{SS}-I_D(R_D+R_S)=' + tn(VDD + VSS - qv.I * (RDv + RSv)) + '$ V.'); if (!ov.sat) return null;
          data.VSS = VSS; data.RS = RSv; data.RD = RDv;
          parts.push({ q: 'Find $I_{DQ}$ and $V_{GSQ}$.', answers: [A('ID', '$I_{DQ}$', qv.I, 'A'), A('VGS', '$V_{GSQ}$', qv.V, 'V', { abs: 0.01 })],
            working: steps(['The gate is grounded and $V_S=-V_{SS}+I_DR_S$, so' + M('V_{GS}=0-V_S=V_{SS}-I_DR_S=' + tn(VSS) + '-' + kO(RSv) + 'I_D')].concat(qv.steps)) + fin('I_{DQ}=' + te(qv.I, 'A') + ',\\quad V_{GSQ}=' + te(qv.V, 'V')) });
          parts.push({ q: 'Find $V_S$ and $V_{DS}$, and check saturation.', answers: [A('VS', '$V_S$', VSv, 'V', { abs: 0.01 }), A('VDS', '$V_{DS}$', ov.VDS, 'V')], working: steps(ov.w) + fin('V_S=' + te(VSv, 'V') + ',\\quad V_{DS}=' + te(ov.VDS, 'V')) });
          stem = 'The ' + devName(dev) + ' below has its gate grounded, $R_D$ to $V_{DD}=+' + te(VDD, 'V') + '$ and $R_S$ returned to $-V_{SS}=-' + te(VSS, 'V') + '$.';
          fig = fetFig('vss', { devObj: dev, VDD: V(VDD), VSS: V(VSS), RD: R(RDv), RS: R(RSv), nodes: true });
          given = [g('$V_{DD}$', VDD, 'V'), g('$V_{SS}$', VSS, 'V'), g('$R_D$', RDv, 'Ω'), g('$R_S$', RSv, 'Ω')].concat(devGiven(dev));
          return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('With $R_S$ returned to $-V_{SS}$, $V_S=-V_{SS}+I_DR_S$, not $I_DR_S$.') };
        }
        var mega = v === 'dmos' || r.bool(0.5);
        var R2 = mega ? pickE(r, 'E12', 1e6, 22e6) : pickE(r, 'E12', 100e3, 470e3);
        var VGt = v === 'dmos' ? r.float(1.5, 4, 2) : r.float(1.2, 4.5, 2);
        var R1 = nearestE(R2 * (VDD - VGt) / VGt, 'E12');
        var VG = VDD * R2 / (R1 + R2);
        var gLine = 'V_G=\\frac{R_2}{R_1+R_2}V_{DD}=\\frac{' + tn(R2 / 1e3) + '}{' + tn(R1 / 1e3) + '+' + tn(R2 / 1e3) + '}(' + tn(VDD) + ')=' + tn(VG) + '\\ \\text{V}';
        data.R1 = R1; data.R2 = R2;
        if (v === 'design') {
          var It = Math.round(r.float(0.25, 0.6, 2) * dev.Idss * 1e4) / 1e4, VGS = dev.Vp * (1 - Math.sqrt(It / dev.Idss));
          var VS = VG - VGS, RSd = VS / It, need = VGS - dev.Vp;
          var VDt = r.nice(Math.ceil(VS + need + 1.5), VDD - 2, 0.5); if (VDt >= VDD - 1.5) return null;
          var RDd = (VDD - VDt) / It, VDS = VDt - VS;
          data.It = It; data.VDt = VDt;
          parts.push({ q: 'Find $V_G$, $V_{GSQ}$ and the $R_S$ that gives $I_{DQ}=' + te(It, 'A') + '$.', answers: [A('VG', '$V_G$', VG, 'V'), A('VGS', '$V_{GSQ}$', VGS, 'V', { abs: 0.01 }), A('RS', '$R_S$', RSd, 'Ω')],
            working: steps([M(gLine), 'Invert Shockley: $V_{GS}=V_P(1-\\sqrt{I_D/I_{DSS}})=' + tn(dev.Vp) + '(1-\\sqrt{' + tn(It / dev.Idss) + '})=' + tn(VGS) + '$ V.', 'From the bias line $V_S=V_G-V_{GS}=' + tn(VG) + '-(' + tn(VGS) + ')=' + tn(VS) + '$ V, so $R_S=V_S/I_D=' + kO(RSd) + '$ kΩ.']) + fin('R_S=' + te(RSd, 'Ω')) });
          parts.push({ q: 'Find $R_D$ for $V_D=' + te(VDt, 'V') + '$ and check saturation.', answers: [A('RD', '$R_D$', RDd, 'Ω'), A('VDS', '$V_{DS}$', VDS, 'V')],
            working: steps(['$R_D=(V_{DD}-V_D)/I_D=(' + tn(VDD) + '-' + tn(VDt) + ')/' + mA(It) + '=' + kO(RDd) + '$ kΩ.', '$V_{DS}=V_D-V_S=' + tn(VDS) + '$ V.', satCheck(dev, VDS, VGS).html]) + fin('R_D=' + te(RDd, 'Ω')) });
          stem = 'An n-channel JFET with $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(dev.Vp, 'V') + '$ uses voltage-divider bias with $V_{DD}=' + te(VDD, 'V') + '$, $R_1=' + te(R1, 'Ω') + '$ and $R_2=' + te(R2, 'Ω') + '$. Design $R_S$ for $I_{DQ}=' + te(It, 'A') + '$ and $R_D$ for $V_D=' + te(VDt, 'V') + '$.';
          fig = fetFig('vdb', { devObj: dev, VDD: V(VDD), R1: R(R1), R2: R(R2), RD: { label: 'R_D', value: '?' }, RS: { label: 'R_S', value: '?' }, nodes: true });
          given = [g('$V_{DD}$', VDD, 'V'), g('$R_1$', R1, 'Ω'), g('$R_2$', R2, 'Ω')].concat(devGiven(dev));
          return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('A design that leaves the FET ohmic does not work. Recheck saturation with the designed values.') };
        }
        var RS = v === 'dmos' ? pickE(r, 'E12', 100, 680) : pickE(r, 'E12', 470, 3300);
        var q = solveQ(dev, VG, RS, '$V_{GS}=V_G-I_DR_S$'); if (!q) return null;
        if (v === 'dmos' && q.V < 0.03) return null;
        var RD = pickRD(r, q.I, VDD, q.I * RS, q.V - dev.Vp, 470); if (!RD) return null;
        var o = outSide(dev, q.I, VDD, RD, q.I * RS, q.V, 'Also $V_{DG}=V_D-V_G=' + tn(VDD - q.I * RD - VG) + '$ V.'); if (!o.sat) return null;
        data.RS = RS; data.RD = RD;
        parts.push({ q: 'Find $V_G$, then $I_{DQ}$ and $V_{GSQ}$ by solving the quadratic.', answers: [A('VG', '$V_G$', VG, 'V'), A('ID', '$I_{DQ}$', q.I, 'A'), A('VGS', '$V_{GSQ}$', q.V, 'V', { abs: 0.01 })],
          working: steps([M(gLine), 'Bias line (mA, kΩ):' + M('V_{GS}=V_G-I_DR_S=' + tn(VG) + '-' + kO(RS) + 'I_D')].concat(q.steps, v === 'dmos' ? ['$V_{GSQ}$ is positive, so the D-MOSFET runs in enhancement mode and $I_{DQ}>I_{DSS}$.'] : [])) + fin('I_{DQ}=' + te(q.I, 'A') + ',\\quad V_{GSQ}=' + te(q.V, 'V')) });
        parts.push({ q: 'Find $V_D$, $V_S$ and $V_{DS}$, and check saturation.', answers: [A('VD', '$V_D$', o.VD, 'V'), A('VS', '$V_S$', q.I * RS, 'V'), A('VDS', '$V_{DS}$', o.VDS, 'V')], working: steps(o.w) + fin('V_{DS}=' + te(o.VDS, 'V')) });
        stem = 'The ' + devName(dev) + ' below uses voltage-divider bias. Find its Q-point.';
        fig = fetFig('vdb', { devObj: dev, VDD: V(VDD), R1: R(R1), R2: R(R2), RD: R(RD), RS: R(RS), nodes: true });
        given = [g('$V_{DD}$', VDD, 'V'), g('$R_1$', R1, 'Ω'), g('$R_2$', R2, 'Ω'), g('$R_D$', RD, 'Ω'), g('$R_S$', RS, 'Ω')].concat(devGiven(dev));
        return { stem: stem, figure: fig, given: given, parts: parts, data: data,
          notes: v === 'dmos' ? trap('Do not stop the D-MOSFET curve at $V_{GS}=0$: the valid root may sit at positive $V_{GS}$ with $I_D>I_{DSS}$.') : trap('$I_G=0$: the divider sets $V_G$ with no loading, and the large root (with $V_{GS}\\lt V_P$) is rejected.') };
      });
    }
  });

  QB.add({
    id: 'edc.fet.bias.emos', course: 'edc', module: 'fet', topic: 'bias',
    title: 'E-MOSFET bias: drain feedback and voltage divider', difficulty: 2, marks: 7,
    tags: ['WS8 Q6', 'E10 N5', 'EX1 Q6', 'exam-style'],
    variants: [{ id: 'dfb', label: 'Drain feedback' }, { id: 'vdb', label: 'Voltage divider' }, { id: 'dfbdesign', label: 'Drain feedback, design R_D' }, { id: 'pvdb', label: 'p-channel voltage divider' }],
    gen: function (r, v) {
      return r.retry(function () {
        var dev = newE(r, v === 'pvdb'), s = sg(dev), VDD = r.pick([12, 15, 18, 20, 24]), parts = [], data = { v: v, Vt: s * dev.Vt, Von: s * dev.Von, Ion: dev.Ion, VDD: s * VDD };
        var stem, fig, given;
        if (v === 'dfb' || v === 'dfbdesign') {
          var RD = pickE(r, 'E12', 1000, 3300), RG = r.pick([4.7e6, 10e6, 12e6, 22e6]);
          var q = solveQ(dev, VDD, RD, '$V_{GS}=V_{DD}-I_DR_D$'); if (!q) return null;
          if (q.V < dev.Vt + 1 || q.V > VDD - 2) return null;
          data.RD = RD;
          parts.push({ q: 'Find $k$.', answers: [A('k', '$k$', dev.k, 'A/V²')], working: steps([kStep(dev)]) + fin('k=' + tn(dev.k * 1e3, 3) + '\\,\\text{mA/V}^2') });
          parts.push({ q: 'Find $I_{DQ}$ and $V_{GSQ}$.', answers: [A('ID', '$I_{DQ}$', q.I, 'A'), A('VGS', '$V_{GSQ}$', q.V, 'V', { abs: 0.01 })],
            working: steps(['$I_G=0$, so $R_G$ drops nothing and $V_G=V_D$:' + M('V_{GS}=V_{DS}=V_{DD}-I_DR_D=' + tn(VDD) + '-' + kO(RD) + 'I_D')].concat(q.steps)) + fin('I_{DQ}=' + te(q.I, 'A') + ',\\quad V_{GSQ}=' + te(q.V, 'V')) });
          if (v === 'dfb') {
            parts.push({ q: 'State $V_{DSQ}$ and explain why no saturation check is needed.', answers: [A('VDS', '$V_{DSQ}$', q.V, 'V')],
              working: steps(['$V_{DS}=V_{GS}=' + tn(q.V) + '$ V.', 'Saturation needs $V_{DS}\\ge V_{GS}-V_{GS(Th)}$; with $V_{DS}=V_{GS}$ this always holds.']) + fin('V_{DSQ}=' + te(q.V, 'V')) });
          } else {
            var VDSt = r.nice(Math.ceil(dev.Vt + 1), VDD - 3, 0.5); if (Math.abs(VDSt - q.V) < 0.4) return null;
            var It = dev.k * Math.pow(VDSt - dev.Vt, 2), RDn = (VDD - VDSt) / It; data.VDSt = VDSt;
            if (RDn < 100) return null;
            parts.push({ q: 'Find the new $R_D$ that gives $V_{DSQ}=' + te(VDSt, 'V') + '$.', answers: [A('ID2', '$I_D$', It, 'A'), A('RD2', '$R_D$', RDn, 'Ω')],
              working: steps(['$V_{GS}=V_{DS}=' + tn(VDSt) + '$ V, so $I_D=k(V_{GS}-V_{GS(Th)})^2=' + tn(dev.k * 1e3) + '(' + tn(VDSt - dev.Vt) + ')^2=' + mA(It) + '$ mA.', '$R_D=(V_{DD}-V_{DS})/I_D=(' + tn(VDD) + '-' + tn(VDSt) + ')/' + mA(It) + '=' + kO(RDn) + '$ kΩ.']) + fin('R_D=' + te(RDn, 'Ω')) });
          }
          stem = 'An n-channel E-MOSFET has $V_{GS(Th)}=' + te(dev.Vt, 'V') + '$ and $I_{D(on)}=' + te(dev.Ion, 'A') + '$ at $V_{GS(on)}=' + te(dev.Von, 'V') + '$. It is used in drain-feedback bias with $V_{DD}=' + te(VDD, 'V') + '$, $R_D=' + te(RD, 'Ω') + '$ and $R_G=' + te(RG, 'Ω') + '$ from drain to gate.';
          fig = fetFig('dfb', { devObj: dev, dev: 'V_{GS(Th)} = ' + V(dev.Vt), VDD: V(VDD), RG: R(RG), RD: R(RD), nodes: true });
          given = [g('$V_{DD}$', VDD, 'V'), g('$R_D$', RD, 'Ω'), g('$R_G$', RG, 'Ω')].concat(devGiven(dev));
          return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('An E-MOSFET has no $I_{DSS}$. Find $k$ first, and reject the root with $V_{GS}\\lt V_{GS(Th)}$.') };
        }
        var R2 = pickE(r, 'E12', 1e6, 22e6), VGt = r.float(dev.Vt + 1.5, Math.min(VDD * 0.55, dev.Vt + 8), 2), R1 = nearestE(R2 * (VDD - VGt) / VGt, 'E12');
        var VG = VDD * R2 / (R1 + R2), RS = pickE(r, 'E12', 220, 2200);
        var q2 = solveQ(dev, VG, RS, dev.p ? '$V_{GS}=V_G+I_DR_S$' : '$V_{GS}=V_G-I_DR_S$'); if (!q2) return null;
        var RD2 = pickRD(r, q2.I, VDD, q2.I * RS, q2.V - dev.Vt, 680); if (!RD2) return null;
        var o = outSide(dev, q2.I, VDD, RD2, q2.I * RS, q2.V); if (!o.sat) return null;
        data.R1 = R1; data.R2 = R2; data.RS = RS; data.RD = RD2;
        parts.push({ q: 'Find $k$ and $V_G$.', answers: [A('k', '$k$', dev.k, 'A/V²'), A('VG', '$V_G$', s * VG, 'V')],
          working: steps([kStep(dev), M('V_G=\\frac{R_2}{R_1+R_2}V_{DD}=\\frac{' + tn(R2 / 1e6) + '}{' + tn(R1 / 1e6) + '+' + tn(R2 / 1e6) + '}(' + sgnum(s * VDD) + ')=' + sgnum(s * VG) + '\\ \\text{V}')]) + fin('V_G=' + te(s * VG, 'V')) });
        parts.push({ q: 'Find ' + (dev.p ? '$|I_{DQ}|$' : '$I_{DQ}$') + ' and $V_{GSQ}$, justifying your root.', answers: [A('ID', '$I_{DQ}$', q2.I, 'A'), A('VGS', '$V_{GSQ}$', s * q2.V, 'V', { abs: 0.01 })],
          working: steps(['Bias line (mA, kΩ):' + M(dev.p ? 'V_{GS}=V_G-V_S=V_G+I_DR_S=' + sgnum(s * VG) + '+' + kO(RS) + 'I_D' : 'V_{GS}=V_G-I_DR_S=' + tn(VG) + '-' + kO(RS) + 'I_D')].concat(q2.steps)) + fin('I_{DQ}=' + te(q2.I, 'A') + ',\\quad V_{GSQ}=' + te(s * q2.V, 'V')) });
        parts.push({ q: 'Find $V_D$, $V_S$ and $V_{DS}$, and confirm saturation.', answers: [A('VD', '$V_D$', s * o.VD, 'V'), A('VS', '$V_S$', s * q2.I * RS, 'V'), A('VDS', '$V_{DS}$', s * o.VDS, 'V')], working: steps(o.w) + fin('V_{DS}=' + te(s * o.VDS, 'V')) });
        stem = 'An ' + devName(dev) + ' has $V_{GS(Th)}=' + te(s * dev.Vt, 'V') + '$ and $I_{D(on)}=' + te(dev.Ion, 'A') + '$ at $V_{GS(on)}=' + te(s * dev.Von, 'V') + '$. It is biased by the voltage divider shown' + (dev.p ? ' from a negative supply' : '') + '.';
        fig = fetFig('vdb', { devObj: dev, dev: 'V_{GS(Th)} = ' + V(s * dev.Vt), VDD: V(s * VDD), R1: R(R1), R2: R(R2), RD: R(RD2), RS: R(RS), nodes: true });
        given = [g('$V_{DD}$', s * VDD, 'V'), g('$R_1$', R1, 'Ω'), g('$R_2$', R2, 'Ω'), g('$R_D$', RD2, 'Ω'), g('$R_S$', RS, 'Ω')].concat(devGiven(dev));
        return { stem: stem, figure: fig, given: given, parts: parts, data: data,
          notes: dev.p ? trap('p-channel: $V_T\\lt 0$ and the device is on for $V_{GS}\\lt V_T$. Keep the signs; report $I_D$ as a magnitude flowing source to drain.') : trap('Use $I_D=k(V_{GS}-V_{GS(Th)})^2$, never Shockley, and keep the root with $V_{GS}>V_{GS(Th)}$.') };
      });
    }
  });

  /* ============================================================ FET SMALL SIGNAL (E11) */
  function gmOf(dev, Vq, Iq) {
    if (dev.kind === 'emos') return { gm: 2 * dev.k * (Vq - dev.Vt) };
    var gm0 = 2 * dev.Idss / -dev.Vp; return { gm0: gm0, gm: gm0 * (1 - Vq / dev.Vp) };
  }
  function gmSteps(dev, Vq, Iq) {
    var s = sg(dev), G = gmOf(dev, Vq, Iq);
    if (dev.kind === 'emos') return { G: G, w: ['E-MOSFET transconductance (no $I_{DSS}$ here):' + M('g_m=2k(V_{GSQ}-V_{GS(Th)})=2(' + tn(dev.k * 1e3) + '\\,\\text{mA/V}^2)(' + sgnum(s * Vq) + '-(' + sgnum(s * dev.Vt) + '))=' + tn(G.gm * 1e3) + '\\,\\text{mS}'), 'Check: $2I_D/(V_{GS}-V_{GS(Th)})=2(' + mA(Iq) + ')/' + tn(Vq - dev.Vt) + '=' + tn(2 * Iq / (Vq - dev.Vt) * 1e3) + '$ mS.'] };
    return { G: G, w: [M('g_{m0}=\\frac{2I_{DSS}}{|V_P|}=\\frac{2(' + mA(dev.Idss) + '\\,\\text{mA})}{' + tn(-dev.Vp) + '\\,\\text{V}}=' + tn(G.gm0 * 1e3) + '\\,\\text{mS}'),
      M('g_m=g_{m0}\\left(1-\\frac{V_{GSQ}}{V_P}\\right)=' + tn(G.gm0 * 1e3) + '\\left(1-\\frac{' + sgnum(s * Vq) + '}{' + sgnum(s * dev.Vp) + '}\\right)=' + tn(G.gm * 1e3) + '\\,\\text{mS}'),
      'Check: $g_{m0}\\sqrt{I_{DQ}/I_{DSS}}=' + tn(G.gm0 * Math.sqrt(Iq / dev.Idss) * 1e3) + '$ mS.'] };
  }
  function mS(x) { return tn(x * 1e3, 4); }
  /** build a CS stage DC: kind fixed|self|vdb|dmos|emos. returns null if invalid */
  function csBuild(r, kind, opt) {
    opt = opt || {};
    var VDD = r.pick(VDDS), RG = r.pick([1e6, 2.2e6, 3.3e6, 10e6]), dev, q, RS = 0, R1, R2, VG = 0, VGG, cfg, lines = [], zero = false;
    if (kind === 'emos') dev = newE(r); else dev = newJ(r, kind === 'dmos' ? 'dmos' : 'jfet');
    if (kind === 'dmos' && !opt.noZero && r.bool(0.4)) zero = true;
    if (kind === 'fixed') {
      VGG = r.nice(0.2 * -dev.Vp, 0.6 * -dev.Vp, 0.1); q = solveQ(dev, -VGG, 0); cfg = 'fixed';
      lines.push('Fixed bias: no current in $R_G$, so $V_{GSQ}=-V_{GG}=' + sgnum(-VGG) + '$ V.');
    } else if (kind === 'self') {
      RS = pickE(r, 'E12', 220, 1500); cfg = 'self';
      q = solveQ(dev, 0, RS, '$V_{GS}=-I_DR_S$');
      lines.push('Self-bias line (mA, kΩ): $V_{GS}=-I_DR_S=-' + kO(RS) + 'I_D$.');
    } else if (zero) {
      cfg = 'zero'; q = solveQ(dev, 0, 0);
      lines.push('Gate at 0 V through $R_G$ (no gate current) and source grounded, so $V_{GSQ}=0$ and $I_{DQ}=I_{DSS}$.');
    } else {
      cfg = 'vdb';
      R2 = pickE(r, 'E12', 1e6, 22e6);
      var VGt = kind === 'emos' ? r.float(dev.Vt + 1.5, Math.min(VDD * 0.5, dev.Vt + 6), 2) : r.float(1.2, 4, 2);
      R1 = nearestE(R2 * (VDD - VGt) / VGt, 'E12'); VG = VDD * R2 / (R1 + R2);
      RS = kind === 'dmos' ? pickE(r, 'E12', 100, 680) : pickE(r, 'E12', 330, 2200);
      q = solveQ(dev, VG, RS, '$V_{GS}=V_G-I_DR_S$');
      lines.push(M('V_G=\\frac{R_2}{R_1+R_2}V_{DD}=' + tn(VG) + '\\ \\text{V},\\qquad V_{GS}=V_G-I_DR_S=' + tn(VG) + '-' + kO(RS) + 'I_D'));
    }
    if (!q || !(q.I > 0)) return null;
    var off = dev.kind === 'emos' ? dev.Vt : dev.Vp;
    var RD = pickRD(r, q.I, VDD, q.I * RS, q.V - off, 680); if (!RD) return null;
    if (opt.maxRD && RD > opt.maxRD) RD = pickE(r, 'E12', 680, opt.maxRD) || RD;
    var o = outSide(dev, q.I, VDD, RD, q.I * RS, q.V); if (!o.sat || o.VDS < 1.5) return null;
    var dcW = lines.concat(q.steps, o.w);
    var Zi = cfg === 'vdb' ? par(R1, R2) : RG;
    var given = [g('$V_{DD}$', VDD, 'V'), g('$R_D$', RD, 'Ω')];
    if (cfg === 'fixed') given.push(g('$V_{GG}$', VGG, 'V'));
    if (cfg === 'vdb') { given.push(g('$R_1$', R1, 'Ω')); given.push(g('$R_2$', R2, 'Ω')); } else given.push(g('$R_G$', RG, 'Ω'));
    if (RS) given.push(g('$R_S$', RS, 'Ω'));
    given = given.concat(devGiven(dev, kind === 'emos'));
    return { dev: dev, kind: kind, cfg: cfg, VDD: VDD, RG: RG, R1: R1, R2: R2, VG: VG, VGG: VGG, RS: RS, RD: RD, I: q.I, V: q.V, VDS: o.VDS, dcW: dcW, Zi: Zi, given: given,
      ZiTex: cfg === 'vdb' ? 'Z_i=R_1\\parallel R_2=' + tn(R1 / 1e6) + '\\,\\text{M}\\Omega\\parallel' + tn(R2 / 1e6) + '\\,\\text{M}\\Omega=' + te(Zi, 'Ω') : 'Z_i=R_G=' + te(RG, 'Ω') };
  }
  function csFigOpts(b, extra) {
    var o = { devObj: b.dev, dev: false, VDD: V(b.VDD), RD: R(b.RD), C1: true, C2: true };
    if (b.cfg === 'vdb') { o.R1 = R(b.R1); o.R2 = R(b.R2); } else o.RG = R(b.RG);
    if (b.cfg === 'fixed') o.VGG = V(b.VGG);
    if (b.RS) o.RS = R(b.RS);
    return Object.assign(o, extra || {});
  }
  function devStem(b) {
    var d = b.dev;
    if (d.kind === 'emos') return 'an n-channel E-MOSFET with $k=' + tn(d.k * 1e3, 3) + '$ mA/V² and $V_{GS(Th)}=' + te(d.Vt, 'V') + '$';
    return 'an ' + devName(d) + ' with $I_{DSS}=' + te(d.Idss, 'A') + '$ and $V_P=' + te(d.Vp, 'V') + '$';
  }

  QB.add({
    id: 'edc.fet.ss.gm', course: 'edc', module: 'fet', topic: 'ss',
    title: 'Transconductance g_m, g_m0 and r_d', difficulty: 1, marks: 3,
    tags: ['WS8 Q7', 'WS8 Q8', 'WS8 Q9', 'g_m'],
    variants: [{ id: 'vgs', label: 'g_m at a given V_GSQ' }, { id: 'id', label: 'g_m from I_DQ' }, { id: 'idss', label: 'I_DSS from g_m0' }, { id: 'device', label: 'r_d and device gain from g_fs, g_os' }, { id: 'emos', label: 'E-MOSFET g_m' }],
    gen: function (r, v) {
      var parts = [], data = { v: v }, stem, given = [];
      if (v === 'vgs' || v === 'id' || v === 'idss') {
        var dev = newJ(r, r.bool(0.25) ? 'dmos' : 'jfet'), gm0 = 2 * dev.Idss / -dev.Vp;
        data.Idss = dev.Idss; data.Vp = dev.Vp; data.kind = dev.kind;
        if (v === 'vgs') {
          var VGS = dev.kind === 'dmos' && r.bool(0.5) ? r.pick([0.25, 0.5, 1]) : -r.nice(0.1 * -dev.Vp, 0.7 * -dev.Vp, 0.1), gm = gm0 * (1 - VGS / dev.Vp), Iq = idOf(dev, VGS);
          data.VGS = VGS;
          stem = 'An ' + devName(dev) + ' has $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(dev.Vp, 'V') + '$. It is biased at $V_{GSQ}=' + te(VGS, 'V') + '$.';
          given = devGiven(dev).concat([g('$V_{GSQ}$', VGS, 'V')]);
          parts.push({ q: 'Find $g_{m0}$.', answers: [A('gm0', '$g_{m0}$', gm0, 'S')], working: steps([M('g_{m0}=\\frac{2I_{DSS}}{|V_P|}=\\frac{2(' + mA(dev.Idss) + ')}{' + tn(-dev.Vp) + '}=' + mS(gm0) + '\\,\\text{mS}')]) + fin('g_{m0}=' + te(gm0, 'S')) });
          parts.push({ q: 'Find $g_m$ at the Q-point, and $I_{DQ}$.', answers: [A('gm', '$g_m$', gm, 'S'), A('ID', '$I_{DQ}$', Iq, 'A')],
            working: steps([M('g_m=g_{m0}\\left(1-\\frac{V_{GSQ}}{V_P}\\right)=' + mS(gm0) + '\\left(1-\\frac{' + sgnum(VGS) + '}{' + tn(dev.Vp) + '}\\right)=' + mS(gm) + '\\,\\text{mS}'), 'Shockley: $I_{DQ}=' + mA(dev.Idss) + '(1-' + tn(VGS / dev.Vp) + ')^2=' + mA(Iq) + '$ mA. Check: $g_{m0}\\sqrt{I_{DQ}/I_{DSS}}=' + mS(gm0 * Math.sqrt(Iq / dev.Idss)) + '$ mS.', VGS > 0 ? '$V_{GSQ}>0$ makes the bracket greater than 1, so $g_m>g_{m0}$ (D-MOSFET enhancement mode).' : '']) + fin('g_m=' + te(gm, 'S')) });
        } else if (v === 'id') {
          var fr = r.pick([0.0625, 0.25, 0.36, 0.49, 0.5, 0.64, 0.81]), Iq2 = Math.round(fr * dev.Idss * 1e5) / 1e5, gm2 = gm0 * Math.sqrt(Iq2 / dev.Idss), V2 = dev.Vp * (1 - Math.sqrt(Iq2 / dev.Idss));
          data.ID = Iq2;
          stem = 'An ' + devName(dev) + ' with $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(dev.Vp, 'V') + '$ runs at $I_{DQ}=' + te(Iq2, 'A') + '$.';
          given = devGiven(dev).concat([g('$I_{DQ}$', Iq2, 'A')]);
          parts.push({ q: 'Find $g_m$ without first finding $V_{GS}$.', answers: [A('gm', '$g_m$', gm2, 'S')], working: steps([M('g_{m0}=2I_{DSS}/|V_P|=' + mS(gm0) + '\\,\\text{mS}'), M('g_m=g_{m0}\\sqrt{\\frac{I_{DQ}}{I_{DSS}}}=' + mS(gm0) + '\\sqrt{' + tn(Iq2 / dev.Idss) + '}=' + mS(gm2) + '\\,\\text{mS}')]) + fin('g_m=' + te(gm2, 'S')) });
          parts.push({ q: 'Find $V_{GSQ}$ and confirm $g_m$ with the $V_{GS}$ form.', answers: [A('VGS', '$V_{GSQ}$', V2, 'V', { abs: 0.005 })], working: steps([M('V_{GS}=V_P(1-\\sqrt{I_D/I_{DSS}})=' + tn(V2) + '\\ \\text{V}'), '$g_{m0}(1-V_{GS}/V_P)=' + mS(gm0 * (1 - V2 / dev.Vp)) + '$ mS, the same.']) + fin('V_{GSQ}=' + te(V2, 'V', 4)) });
        } else {
          stem = 'A JFET has $g_{m0}=' + te(gm0, 'S') + '$ and $V_P=' + te(dev.Vp, 'V') + '$.';
          var V3 = -r.nice(0.1 * -dev.Vp, 0.7 * -dev.Vp, 0.1); data.gm0 = gm0; data.V3 = V3;
          given = [g('$g_{m0}$', gm0, 'S'), g('$V_P$', dev.Vp, 'V')];
          parts.push({ q: 'What is the drain current at $V_{GS}=0$?', answers: [A('Idss', '$I_{DSS}$', dev.Idss, 'A')], working: steps(['At $V_{GS}=0$, $I_D=I_{DSS}$. Rearranging $g_{m0}=2I_{DSS}/|V_P|$:' + M('I_{DSS}=\\frac{g_{m0}|V_P|}{2}=\\frac{(' + mS(gm0) + '\\,\\text{mS})(' + tn(-dev.Vp) + '\\,\\text{V})}{2}=' + mA(dev.Idss) + '\\,\\text{mA}')]) + fin('I_D=I_{DSS}=' + te(dev.Idss, 'A')) });
          parts.push({ q: 'Find $g_m$ at $V_{GS}=' + te(V3, 'V') + '$.', answers: [A('gm', '$g_m$', gm0 * (1 - V3 / dev.Vp), 'S')], working: steps([M('g_m=' + mS(gm0) + '\\left(1-\\frac{' + tn(V3) + '}{' + tn(dev.Vp) + '}\\right)=' + mS(gm0 * (1 - V3 / dev.Vp)) + '\\,\\text{mS}')]) + fin('g_m=' + te(gm0 * (1 - V3 / dev.Vp), 'S')) });
        }
      } else if (v === 'device') {
        var gfs = r.nice(1.5, 6, 0.5) * 1e-3, gos = r.pick(YOS) * 1e-6, rd = 1 / gos, RD = pickE(r, 'E12', 1000, 6800);
        data.gfs = gfs; data.gos = gos; data.RD = RD;
        stem = 'A JFET is specified with $g_{fs}=' + tn(gfs * 1e6, 4) + '\\ \\mu\\text{S}$ and $g_{os}=' + tn(gos * 1e6) + '\\ \\mu\\text{S}$.';
        given = [g('$g_{fs}$', gfs, 'S'), g('$g_{os}$', gos, 'S')];
        parts.push({ q: 'Find the device output impedance $Z_o(\\text{FET})$ and the device ideal gain $A_v(\\text{FET})$.', answers: [A('rd', '$r_d$', rd, 'Ω'), A('AvF', '$A_v(\\text{FET})$', -gfs * rd)],
          working: steps(['$Z_o(\\text{FET})=r_d=1/g_{os}=1/(' + tn(gos * 1e6) + '\\,\\mu\\text{S})=' + kO(rd) + '$ kΩ.', '$A_v(\\text{FET})=-g_mr_d=-(' + mS(gfs) + '\\,\\text{mS})(' + kO(rd) + '\\,\\text{k}\\Omega)=' + tn(-gfs * rd) + '$. This is the limit as $R_D\\to\\infty$.']) + fin('r_d=' + te(rd, 'Ω') + ',\\quad A_v=' + tn(-gfs * rd)) });
        parts.push({ q: 'The FET is used with $R_D=' + te(RD, 'Ω') + '$ (source at ac ground). Find $Z_o$ and $A_v$, and say whether the $r_d\\ge10R_D$ rule allows $r_d$ to be ignored.', answers: [A('Zo', '$Z_o$', par(RD, rd), 'Ω'), A('Av', '$A_v$', -gfs * par(RD, rd))],
          working: steps(['$Z_o=R_D\\parallel r_d=' + kO(RD) + '\\parallel' + kO(rd) + '=' + kO(par(RD, rd)) + '$ kΩ.', '$A_v=-g_m(R_D\\parallel r_d)=' + tn(-gfs * par(RD, rd)) + '$ (ignoring $r_d$: ' + tn(-gfs * RD) + ').', rd >= 10 * RD ? '$r_d=' + tn(rd / RD, 3) + 'R_D\\ge10R_D$, so ignoring $r_d$ is acceptable.' : '$r_d$ is only ' + tn(rd / RD, 3) + '$R_D$, so $r_d$ must be kept.']) + fin('A_v=' + tn(-gfs * par(RD, rd))) });
      } else {
        var Vt = r.nice(1, 3, 0.5), k = r.pick([0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1]) * 1e-3, VG = Vt + r.nice(1, 4, 0.5), Ie = k * Math.pow(VG - Vt, 2), gme = 2 * k * (VG - Vt);
        data.Vt = Vt; data.k = k; data.VGS = VG;
        stem = 'An n-channel E-MOSFET has $k=' + tn(k * 1e3, 3) + '$ mA/V² and $V_{GS(Th)}=' + te(Vt, 'V') + '$, biased at $V_{GSQ}=' + te(VG, 'V') + '$.';
        given = [g('$k$', F.num(k * 1e3, 3) + ' mA/V²'), g('$V_{GS(Th)}$', Vt, 'V'), g('$V_{GSQ}$', VG, 'V')];
        parts.push({ q: 'Find $I_{DQ}$.', answers: [A('ID', '$I_{DQ}$', Ie, 'A')], working: steps([M('I_{DQ}=k(V_{GSQ}-V_{GS(Th)})^2=' + tn(k * 1e3) + '(' + tn(VG - Vt) + ')^2=' + mA(Ie) + '\\,\\text{mA}')]) + fin('I_{DQ}=' + te(Ie, 'A')) });
        parts.push({ q: 'Find $g_m$ and confirm it with the overdrive form $2I_D/V_{ov}$.', answers: [A('gm', '$g_m$', gme, 'S')], working: steps([M('g_m=2k(V_{GSQ}-V_{GS(Th)})=2(' + tn(k * 1e3) + ')(' + tn(VG - Vt) + ')=' + mS(gme) + '\\,\\text{mS}'), 'Overdrive $V_{ov}=' + tn(VG - Vt) + '$ V: $2I_D/V_{ov}=' + mS(2 * Ie / (VG - Vt)) + '$ mS, the same.']) + fin('g_m=' + te(gme, 'S')) });
      }
      return { stem: stem, figure: null, given: given, parts: parts, data: data, notes: trap('$g_{m0}$ uses $|V_P|$, but the bracket $1-V_{GSQ}/V_P$ keeps both signs. Do not use the $g_{m0}$ formula for an E-MOSFET.') };
    }
  });

  QB.add({
    id: 'edc.fet.ss.cs', course: 'edc', module: 'fet', topic: 'ss',
    title: 'Common-source amplifier: DC, g_m, then Z_i, Z_o, A_v', difficulty: 2, marks: 10,
    tags: ['WS8 Q11–15', 'EX1 Q5', 'EX2 Q8', 'exam-style'],
    variants: [{ id: 'fixed', label: 'Fixed bias' }, { id: 'selfbyp', label: 'Self bias, R_S bypassed' }, { id: 'selfunbyp', label: 'Self bias, R_S unbypassed' },
      { id: 'vdb', label: 'JFET divider, bypassed' }, { id: 'dmos', label: 'D-MOSFET' }, { id: 'emos', label: 'E-MOSFET divider' }],
    gen: function (r, v) {
      return r.retry(function () {
        var kind = { fixed: 'fixed', selfbyp: 'self', selfunbyp: 'self', vdb: 'vdb', dmos: 'dmos', emos: 'emos' }[v];
        var b = csBuild(r, kind); if (!b) return null;
        var dev = b.dev, unb = v === 'selfunbyp';
        var hasRd = r.bool(0.6), yos = r.pick(YOS) * 1e-6, rd = hasRd ? 1 / yos : Infinity;
        var load = r.bool(0.45), RL = load ? pickE(r, 'E12', 2200, 22000) : null, Rsig = load ? r.pick([600, 1e3, 10e3, 47e3, 100e3, 470e3]) : null;
        var Vi = r.pick([1, 2, 5, 10, 20, 50]) * 1e-3;
        var gs = gmSteps(dev, b.V, b.I), gm = gs.G.gm;
        var data = { v: v, kind: kind, cfg: b.cfg, Idss: dev.Idss, Vp: dev.Vp, k: dev.k, Vt: dev.Vt, VDD: b.VDD, RD: b.RD, RS: b.RS, R1: b.R1, R2: b.R2, RG: b.RG, VGG: b.VGG, rd: hasRd ? rd : null, RL: RL, Rsig: Rsig, Vi: load ? null : Vi };
        var parts = [];
        parts.push({ q: 'Find the Q-point $I_{DQ}$, $V_{GSQ}$ and check saturation.', answers: [A('ID', '$I_{DQ}$', b.I, 'A'), A('VGS', '$V_{GSQ}$', b.V, 'V', { abs: 0.01 })], working: steps(b.dcW) + fin('I_{DQ}=' + te(b.I, 'A') + ',\\quad V_{GSQ}=' + te(b.V, 'V')) });
        var ga = [A('gm', '$g_m$', gm, 'S')];
        if (hasRd) ga.push(A('rd', '$r_d$', rd, 'Ω'));
        parts.push({ q: 'Find $g_m$' + (hasRd ? ' and $r_d$.' : '.'), answers: ga, working: steps(gs.w.concat([hasRd ? '$r_d=1/y_{os}=1/(' + tn(yos * 1e6) + '\\,\\mu\\text{S})=' + kO(rd) + '$ kΩ.' : '$r_d$ is not given, so take $r_d=\\infty$.'])) + fin('g_m=' + te(gm, 'S')) });
        var Zo, Av, wz = [M(b.ZiTex)], ans3 = [A('Zi', '$Z_i$', b.Zi, 'Ω')];
        if (!unb) {
          var Rp = hasRd ? par(b.RD, rd) : b.RD; Zo = Rp; Av = -gm * Rp;
          wz.push(b.RS ? '$C_S$ bypasses $R_S$, so the source is at ac ground.' : 'The source is grounded.');
          wz.push(M('Z_o=R_D' + (hasRd ? '\\parallel r_d=' + kO(b.RD) + '\\parallel' + kO(rd) : '') + '=' + te(Zo, 'Ω')));
          wz.push(M('A_v=-g_m(R_D' + (hasRd ? '\\parallel r_d' : '') + ')=-(' + mS(gm) + '\\,\\text{mS})(' + kO(Rp) + '\\,\\text{k}\\Omega)=' + tn(Av)));
          ans3.push(A('Zo', '$Z_o$', Zo, 'Ω')); ans3.push(A('Av', '$A_v$', Av));
        } else {
          Av = -gm * b.RD / (1 + gm * b.RS);
          wz.push('$R_S$ is unbypassed: $i_d=g_mv_{gs}$ flows in $R_S$, so $v_i=v_{gs}(1+g_mR_S)$ and $v_o=-g_mv_{gs}R_D$.');
          wz.push(M('A_v=-\\frac{g_mR_D}{1+g_mR_S}=-\\frac{(' + mS(gm) + ')(' + kO(b.RD) + ')}{1+(' + mS(gm) + ')(' + kO(b.RS) + ')}=' + tn(Av) + '\\quad(r_d\\ \\text{ignored})'));
          ans3.push(A('Av', '$A_v$ ($r_d$ ignored)', Av));
          if (hasRd) {
            var Avr = -gm * b.RD / (1 + gm * b.RS + (b.RD + b.RS) / rd);
            Zo = b.RD * (1 + gm * b.RS + b.RS / rd) / (1 + gm * b.RS + (b.RS + b.RD) / rd);
            wz.push('Including $r_d$:' + M('A_v=-\\frac{g_mR_D}{1+g_mR_S+(R_D+R_S)/r_d}=' + tn(Avr)) + M('Z_o=R_D\\frac{1+g_mR_S+R_S/r_d}{1+g_mR_S+(R_S+R_D)/r_d}=' + te(Zo, 'Ω') + '\\approx R_D'));
            ans3.push(A('Avr', '$A_v$ (with $r_d$)', Avr)); ans3.push(A('Zo', '$Z_o$', Zo, 'Ω', { alt: [b.RD] }));
          } else { Zo = b.RD; wz.push('With $r_d=\\infty$ nothing reduces $Z_o$ below $R_D$: $Z_o\\approx R_D=' + te(b.RD, 'Ω') + '$.'); ans3.push(A('Zo', '$Z_o$', Zo, 'Ω')); }
        }
        parts.push({ q: unb ? 'With $C_S$ absent ($R_S$ unbypassed), find $Z_i$, $Z_o$ and $A_v$ (ignoring $r_d$' + (hasRd ? ', then including it' : '') + ').' : 'Find $Z_i$, $Z_o$ and $A_v$.', answers: ans3, working: steps(wz.concat(['The output is 180° out of phase with the input.'])) + fin('A_v=' + tn(Av)) });
        if (load) {
          var Rpl = unb ? par(b.RD, RL) : par(b.RD, RL, rd), AvL = unb ? -gm * Rpl / (1 + gm * b.RS) : -gm * Rpl, Avs = b.Zi / (b.Zi + Rsig) * AvL;
          parts.push({ q: 'A load $R_L=' + te(RL, 'Ω') + '$ is coupled to the drain and the source has $R_{sig}=' + te(Rsig, 'Ω') + '$. Find $A_{vL}$ and $A_{vs}=v_o/v_s$' + (unb ? ' (ignore $r_d$)' : '') + '.', answers: [A('AvL', '$A_{vL}$', AvL), A('Avs', '$A_{vs}$', Avs)],
            working: steps([unb ? M('A_{vL}=-\\frac{g_m(R_D\\parallel R_L)}{1+g_mR_S}=-\\frac{' + mS(gm) + '(' + kO(Rpl) + ')}{1+' + tn(gm * b.RS) + '}=' + tn(AvL)) : M('A_{vL}=-g_m(r_d\\parallel R_D\\parallel R_L)=-(' + mS(gm) + ')(' + kO(Rpl) + '\\,\\text{k}\\Omega)=' + tn(AvL)),
              M('A_{vs}=\\frac{Z_i}{Z_i+R_{sig}}A_{vL}=\\frac{' + te(b.Zi, 'Ω') + '}{' + te(b.Zi, 'Ω') + '+' + te(Rsig, 'Ω') + '}(' + tn(AvL) + ')=' + tn(Avs)), 'The FET input impedance is huge, so $R_{sig}$ costs little; the load costs more. $Z_o$ excludes $R_L$.']) + fin('A_{vL}=' + tn(AvL) + ',\\quad A_{vs}=' + tn(Avs)) });
        } else {
          parts.push({ q: 'Find $V_o$ for $V_i=' + te(Vi, 'V') + '$.', answers: [A('Vo', '$V_o$', Av * Vi, 'V')], working: steps([M('V_o=A_vV_i=(' + tn(Av) + ')(' + te(Vi, 'V') + ')=' + te(Av * Vi, 'V'))]) + fin('V_o=' + te(Av * Vi, 'V') + '\\ (\\text{inverted})') });
        }
        var fo = csFigOpts(b, load ? { Rsig: R(Rsig), vs: true, RL: R(RL), vo: true } : { vi: true, vo: true });
        if (b.RS && !unb) fo.CS = true;
        var figCfg = b.cfg === 'zero' ? 'zero' : b.cfg;
        var fig = fetFig(figCfg, fo);
        var stem = 'The common-source amplifier below uses ' + devStem(b) + (hasRd ? ' and $y_{os}=' + tn(yos * 1e6) + '\\ \\mu\\text{S}$' : ' ($r_d$ not given)') + '.' + (unb ? ' The source resistor is <b>not</b> bypassed.' : '');
        return { stem: stem, figure: fig, given: b.given.concat(hasRd ? [g('$y_{os}$', yos, 'S')] : []), parts: parts, data: data,
          notes: unb ? trap('Without $C_S$ the gain drops by the factor $1+g_mR_S$. The DC point does not change: capacitors are open at DC.') : trap('$g_m$ depends on the Q-point: do the DC first. $Z_o=R_D\\parallel r_d$ does not include $R_L$.') };
      });
    }
  });

  QB.add({
    id: 'edc.fet.ss.design', course: 'edc', module: 'fet', topic: 'ss',
    title: 'Design a CS stage for a target gain (R_D, R_L, R_S)', difficulty: 3, marks: 8,
    tags: ['design', 'E11 N2', 'E12 N4'],
    variants: [{ id: 'rd', label: 'Choose R_D (fixed bias, with r_d)' }, { id: 'rl', label: 'Load that reduces the gain' }, { id: 'self', label: 'Self-bias design: R_S then R_D' }],
    gen: function (r, v) {
      return r.retry(function () {
        var dev = newJ(r), parts = [], data = { v: v, Idss: dev.Idss, Vp: dev.Vp }, stem, given, fig;
        var rd = 1 / (r.pick(YOS) * 1e-6), VGS, I, G, gm;
        if (v === 'rd' || v === 'rl') {
          VGS = r.bool(0.35) ? 0 : -r.nice(0.1 * -dev.Vp, 0.5 * -dev.Vp, 0.1); I = idOf(dev, VGS); G = gmOf(dev, VGS, I); gm = G.gm;
          data.VGS = VGS;
        }
        if (v === 'rd') {
          var Amax = Math.min(0.45 * gm * rd, 15); if (Amax < 3) return null;
          var Avt = r.int(3, Math.floor(Amax)), Rp = Avt / gm, RDx = 1 / (1 / Rp - 1 / rd), need = VGS - dev.Vp;
          var VDD = [12, 15, 18, 20, 24, 30].filter(function (x) { return x >= I * RDx + need + 2; })[0]; if (!VDD) return null;
          var RDs = nearestE(RDx), Avs = -gm * par(RDs, rd), VDS = VDD - I * RDx;
          data.rd = rd; data.Avt = Avt; data.VDD = VDD;
          parts.push({ q: 'Find $g_m$ at the Q-point.', answers: [A('gm', '$g_m$', gm, 'S')], working: steps(gmSteps(dev, VGS, I).w) + fin('g_m=' + te(gm, 'S')) });
          parts.push({ q: 'Find the exact $R_D$ for $A_v=-' + Avt + '$, then the gain with the nearest E12 value.', answers: [A('RD', '$R_D$', RDx, 'Ω'), A('Avs', '$A_v$ (E12 $R_D$)', Avs)],
            working: steps([M('R_D\\parallel r_d=\\frac{|A_v|}{g_m}=\\frac{' + Avt + '}{' + mS(gm) + '\\,\\text{mS}}=' + kO(Rp) + '\\,\\text{k}\\Omega'), M('R_D=\\frac{1}{1/(R_D\\parallel r_d)-1/r_d}=\\frac{1}{1/' + kO(Rp) + '-1/' + kO(rd) + '}=' + kO(RDx) + '\\,\\text{k}\\Omega'),
              'Nearest E12: $' + te(RDs, 'Ω') + '$, giving $A_v=-g_m(R_D\\parallel r_d)=' + tn(Avs) + '$.']) + fin('R_D=' + te(RDx, 'Ω')) });
          parts.push({ q: 'With the exact $R_D$, find $V_{DSQ}$ and confirm saturation.', answers: [A('VDS', '$V_{DS}$', VDS, 'V')], working: steps(['$V_{DS}=V_{DD}-I_DR_D=' + tn(VDD) + '-(' + mA(I) + ')(' + kO(RDx) + ')=' + tn(VDS) + '$ V.', satCheck(dev, VDS, VGS).html]) + fin('V_{DS}=' + te(VDS, 'V')) });
          stem = 'A fixed-bias JFET amplifier (source grounded) runs at $V_{GSQ}=' + te(VGS, 'V') + '$ from $V_{DD}=' + te(VDD, 'V') + '$. The JFET has $I_{DSS}=' + te(dev.Idss, 'A') + '$, $V_P=' + te(dev.Vp, 'V') + '$ and $r_d=' + te(rd, 'Ω') + '$. Choose $R_D$ for a gain of $-' + Avt + '$.';
          given = devGiven(dev).concat([g('$r_d$', rd, 'Ω'), g('$V_{GSQ}$', VGS, 'V'), g('$V_{DD}$', VDD, 'V')]);
          fig = VGS === 0 ? fetFig('zero', { devObj: dev, VDD: V(VDD), RG: R(10e6), RD: { label: 'R_D', value: '?' }, C1: true, C2: true, vi: true, vo: true })
            : fetFig('fixed', { devObj: dev, VDD: V(VDD), VGG: V(-VGS), RG: R(1e6), RD: { label: 'R_D', value: '?' }, C1: true, C2: true, vi: true, vo: true });
        } else if (v === 'rl') {
          var RD = pickE(r, 'E12', 1500, 6800); if (gm * RD < 3) return null;
          var At = r.nice(Math.max(1, Math.ceil(0.3 * gm * RD)), Math.floor(0.8 * gm * RD), 0.5); if (At >= 0.85 * gm * RD || At < 1) return null;
          var Rp2 = At / gm, RL = 1 / (1 / Rp2 - 1 / RD);
          data.RD = RD; data.At = At;
          parts.push({ q: 'Find $g_m$ and the no-load gain (take $r_d=\\infty$).', answers: [A('gm', '$g_m$', gm, 'S'), A('Av', '$A_{vNL}$', -gm * RD)], working: steps(gmSteps(dev, VGS, I).w.concat(['$A_{vNL}=-g_mR_D=' + tn(-gm * RD) + '$.'])) + fin('A_{vNL}=' + tn(-gm * RD)) });
          parts.push({ q: 'What load $R_L$ reduces $|A_v|$ to ' + tn(At) + '?', answers: [A('RL', '$R_L$', RL, 'Ω')], working: steps([M('R_D\\parallel R_L=\\frac{|A_v|}{g_m}=' + kO(Rp2) + '\\,\\text{k}\\Omega'), M('R_L=\\frac{1}{1/' + kO(Rp2) + '-1/' + kO(RD) + '}=' + kO(RL) + '\\,\\text{k}\\Omega')]) + fin('R_L=' + te(RL, 'Ω')) });
          stem = 'A CS stage (source at ac ground) uses a JFET with $I_{DSS}=' + te(dev.Idss, 'A') + '$, $V_P=' + te(dev.Vp, 'V') + '$, biased at $V_{GSQ}=' + te(VGS, 'V') + '$, with $R_D=' + te(RD, 'Ω') + '$.';
          given = devGiven(dev).concat([g('$V_{GSQ}$', VGS, 'V'), g('$R_D$', RD, 'Ω')]);
          fig = fetFig(VGS === 0 ? 'zero' : 'fixed', { devObj: dev, VDD: true, VGG: V(-VGS), RG: true, RD: R(RD), C1: true, C2: true, vi: true, vo: true, RL: { label: 'R_L', value: '?' } });
        } else {
          var It = Math.round(r.float(0.25, 0.55, 2) * dev.Idss * 1e4) / 1e4, VG3 = dev.Vp * (1 - Math.sqrt(It / dev.Idss)), RS = -VG3 / It;
          var G3 = gmOf(dev, VG3, It), gm3 = G3.gm, Avt3 = r.int(4, 12), Rp3 = Avt3 / gm3; if (Rp3 > 0.5 * rd) return null;
          var RD3 = 1 / (1 / Rp3 - 1 / rd), need3 = VG3 - dev.Vp;
          var VDD3 = [15, 18, 20, 24, 30].filter(function (x) { return x - It * (RD3 + RS) >= need3 + 2; })[0]; if (!VDD3) return null;
          var VDS3 = VDD3 - It * (RD3 + RS), Avu = -gm3 * RD3 / (1 + gm3 * RS + (RD3 + RS) / rd);
          data.It = It; data.Avt = Avt3; data.rd = rd; data.VDD = VDD3;
          parts.push({ q: 'Find $V_{GSQ}$ and $R_S$ for $I_{DQ}=' + te(It, 'A') + '$.', answers: [A('VGS', '$V_{GSQ}$', VG3, 'V', { abs: 0.01 }), A('RS', '$R_S$', RS, 'Ω')], working: steps([M('V_{GS}=V_P(1-\\sqrt{I_D/I_{DSS}})=' + tn(dev.Vp) + '(1-\\sqrt{' + tn(It / dev.Idss) + '})=' + tn(VG3) + '\\ \\text{V}'), '$R_S=-V_{GS}/I_D=' + kO(RS) + '$ kΩ.']) + fin('R_S=' + te(RS, 'Ω')) });
          parts.push({ q: 'Find $g_m$, then the $R_D$ that gives $A_v=-' + Avt3 + '$ with $R_S$ bypassed.', answers: [A('gm', '$g_m$', gm3, 'S'), A('RD', '$R_D$', RD3, 'Ω')], working: steps(gmSteps(dev, VG3, It).w.concat([M('R_D\\parallel r_d=' + Avt3 + '/' + mS(gm3) + '=' + kO(Rp3) + '\\,\\text{k}\\Omega,\\qquad R_D=\\frac{1}{1/' + kO(Rp3) + '-1/' + kO(rd) + '}=' + kO(RD3) + '\\,\\text{k}\\Omega')])) + fin('R_D=' + te(RD3, 'Ω')) });
          parts.push({ q: 'Check saturation, then find $A_v$ if $C_S$ is removed (include $r_d$).', answers: [A('VDS', '$V_{DS}$', VDS3, 'V'), A('Avu', '$A_v$ (unbypassed)', Avu)], working: steps(['$V_{DS}=V_{DD}-I_D(R_D+R_S)=' + tn(VDD3) + '-' + mA(It) + '(' + kO(RD3 + RS) + ')=' + tn(VDS3) + '$ V.', satCheck(dev, VDS3, VG3).html, M('A_v=-\\frac{g_mR_D}{1+g_mR_S+(R_D+R_S)/r_d}=' + tn(Avu))]) + fin('A_v=' + tn(Avu)) });
          stem = 'Design a self-bias JFET stage with $R_S$ fully bypassed. $I_{DSS}=' + te(dev.Idss, 'A') + '$, $V_P=' + te(dev.Vp, 'V') + '$, $r_d=' + te(rd, 'Ω') + '$, $V_{DD}=' + te(VDD3, 'V') + '$. Targets: $I_{DQ}=' + te(It, 'A') + '$ and $A_v=-' + Avt3 + '$.';
          given = devGiven(dev).concat([g('$r_d$', rd, 'Ω'), g('$V_{DD}$', VDD3, 'V')]);
          fig = fetFig('self', { devObj: dev, VDD: V(VDD3), RG: R(1e6), RD: { label: 'R_D', value: '?' }, RS: { label: 'R_S', value: '?' }, CS: true, C1: true, C2: true, vi: true, vo: true });
        }
        return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('After any gain design, recheck the DC: a bigger $R_D$ can push $V_{DS}$ below $V_{GS}-V_P$ and the design then fails.') };
      });
    }
  });

  /* ============================================================ FET SMALL SIGNAL II (E12) */
  QB.add({
    id: 'edc.fet.ss2.follower', course: 'edc', module: 'fet', topic: 'ss2',
    title: 'Source follower: Z_i, Z_o, A_v and loading', difficulty: 2, marks: 7,
    tags: ['E12 N2', 'EX2 Q9a', 'WS9 Q7', 'WS9 Q8'],
    variants: [{ id: 'self', label: 'Self-bias JFET follower' }, { id: 'emos', label: 'E-MOSFET divider follower' }, { id: 'load', label: 'With R_L and R_sig' }, { id: 'sedra', label: 'Overdrive form: bias for a target R_o' }],
    gen: function (r, v) {
      return r.retry(function () {
        var parts = [], data = { v: v }, stem, given, fig = null;
        if (v === 'sedra') {
          var Ro = r.pick([100, 125, 150, 200, 250, 400, 500]), Vov = r.pick([0.15, 0.2, 0.25, 0.3, 0.4]), gm = 1 / Ro, ID = gm * Vov / 2;
          var RL1 = pickE(r, 'E12', 470, 2200), RL2 = pickE(r, 'E12', 4700, 22000), wl = r.bool(0.5), kp = r.pick([0.1, 0.2, 0.4, 0.5]) * 1e-3;
          data.Ro = Ro; data.Vov = Vov; data.RL1 = RL1; data.RL2 = RL2; data.kp = wl ? kp : null;
          parts.push({ q: 'Find $g_m$ and the bias current $I_D$.', answers: [A('gm', '$g_m$', gm, 'S'), A('ID', '$I_D$', ID, 'A')], working: steps(['A follower with $r_o$ ignored and no separate $R_S$ has $R_o=1/g_m$, so $g_m=1/' + tn(Ro) + '\\,\\Omega=' + mS(gm) + '$ mA/V.', 'Overdrive form $g_m=2I_D/V_{ov}$:' + M('I_D=\\frac{g_mV_{ov}}{2}=\\frac{(' + mS(gm) + ')(' + tn(Vov) + ')}{2}=' + mA(ID) + '\\,\\text{mA}')]) + fin('I_D=' + te(ID, 'A')) });
          if (wl) parts.push({ q: 'With $\\mu_nC_{ox}=' + tn(kp * 1e3) + '$ mA/V², find $W/L$.', answers: [A('WL', '$W/L$', gm / (kp * Vov))], working: steps([M('\\frac{W}{L}=\\frac{g_m}{\\mu_nC_{ox}V_{ov}}=\\frac{' + mS(gm) + '}{(' + tn(kp * 1e3) + ')(' + tn(Vov) + ')}=' + tn(gm / (kp * Vov))), 'Course $k=\\tfrac12\\mu_nC_{ox}(W/L)=' + tn(0.5 * kp * gm / (kp * Vov) * 1e3) + '$ mA/V², and $2kV_{ov}=' + mS(gm) + '$ mS as required.']) + fin('W/L=' + tn(gm / (kp * Vov))) });
          var G1 = RL1 / (RL1 + Ro), G2 = RL2 / (RL2 + Ro);
          parts.push({ q: 'The load varies from $' + te(RL1, 'Ω') + '$ to $' + te(RL2, 'Ω') + '$. Find the range of $G_v$ (gate signal source negligible).', answers: [A('G1', '$G_v$ min', G1), A('G2', '$G_v$ max', G2)], working: steps([M('G_v=\\frac{R_L}{R_L+R_o}:\\quad \\frac{' + tn(RL1) + '}{' + tn(RL1 + Ro) + '}=' + tn(G1) + ',\\qquad \\frac{' + tn(RL2) + '}{' + tn(RL2 + Ro) + '}=' + tn(G2))]) + fin(tn(G1, 3) + '\\le G_v\\le ' + tn(G2, 3)) });
          stem = 'A MOSFET source follower is the output stage of a cascade. It must have an output resistance $R_o=' + te(Ro, 'Ω') + '$ and runs at an overdrive voltage $V_{ov}=' + te(Vov, 'V') + '$.';
          given = [g('$R_o$', Ro, 'Ω'), g('$V_{ov}$', Vov, 'V')];
          return { stem: stem, figure: null, given: given, parts: parts, data: data, notes: trap('If $W/L$ is asked for, the "$k$" given is the process parameter $\\mu_nC_{ox}$; the course $k$ is $\\tfrac12\\mu_nC_{ox}(W/L)$.') };
        }
        var VDD = r.pick(VDDS), dev, q, RS, R1, R2, RG = r.pick([1e6, 2.2e6, 10e6]), VG = 0, Zi, ziT;
        var hasRd = v !== 'load' && r.bool(0.5), rd = hasRd ? 1 / (r.pick(YOS) * 1e-6) : Infinity;
        if (v === 'emos') {
          dev = newE(r); R2 = pickE(r, 'E12', 1e6, 10e6); var VGt = r.float(dev.Vt + 2, Math.min(VDD * 0.6, dev.Vt + 7), 2); R1 = nearestE(R2 * (VDD - VGt) / VGt); VG = VDD * R2 / (R1 + R2);
          RS = pickE(r, 'E12', 470, 4700); q = solveQ(dev, VG, RS, '$V_{GS}=V_G-I_DR_S$'); Zi = par(R1, R2); ziT = 'Z_i=R_1\\parallel R_2=' + te(Zi, 'Ω');
        } else {
          dev = newJ(r); RS = pickE(r, 'E12', 680, 4700); q = solveQ(dev, 0, RS, '$V_{GS}=-I_DR_S$'); Zi = RG; ziT = 'Z_i=R_G=' + te(RG, 'Ω');
        }
        if (!q) return null;
        var VDS = VDD - q.I * RS, sc = satCheck(dev, VDS, q.V); if (!sc.ok || VDS < 2) return null;
        var gs = gmSteps(dev, q.V, q.I), gm = gs.G.gm, Rp = hasRd ? par(rd, RS) : RS;
        var Zo = par(Rp, 1 / gm), Av = gm * Rp / (1 + gm * Rp);
        data = { v: v, kind: dev.kind, Idss: dev.Idss, Vp: dev.Vp, k: dev.k, Vt: dev.Vt, VDD: VDD, RS: RS, R1: R1, R2: R2, RG: RG, rd: hasRd ? rd : null };
        var dcW = [v === 'emos' ? M('V_G=\\frac{R_2}{R_1+R_2}V_{DD}=' + tn(VG) + '\\ \\text{V},\\quad V_{GS}=V_G-I_DR_S=' + tn(VG) + '-' + kO(RS) + 'I_D') : 'Self bias: $V_{GS}=-I_DR_S=-' + kO(RS) + 'I_D$ (mA, kΩ).'].concat(q.steps, ['The drain is tied to $V_{DD}$: $V_{DS}=V_{DD}-I_DR_S=' + tn(VDS) + '$ V. ' + sc.html]);
        parts.push({ q: 'Find $I_{DQ}$, $V_{GSQ}$ and $g_m$.', answers: [A('ID', '$I_{DQ}$', q.I, 'A'), A('VGS', '$V_{GSQ}$', q.V, 'V', { abs: 0.01 }), A('gm', '$g_m$', gm, 'S')], working: steps(dcW.concat(gs.w)) + fin('g_m=' + te(gm, 'S')) });
        parts.push({ q: 'Find $Z_i$, $Z_o$ and the no-load $A_v$.', answers: [A('Zi', '$Z_i$', Zi, 'Ω'), A('Zo', '$Z_o$', Zo, 'Ω'), A('Av', '$A_v$', Av)],
          working: steps([M(ziT), M('Z_o=' + (hasRd ? 'r_d\\parallel ' : '') + 'R_S\\parallel\\frac{1}{g_m}=' + (hasRd ? kO(rd) + '\\text{k}\\parallel ' : '') + kO(RS) + '\\text{k}\\parallel' + tn(1 / gm) + '\\,\\Omega=' + te(Zo, 'Ω')),
            M('A_v=\\frac{g_m(' + (hasRd ? 'r_d\\parallel ' : '') + 'R_S)}{1+g_m(' + (hasRd ? 'r_d\\parallel ' : '') + 'R_S)}=\\frac{' + tn(gm * Rp) + '}{1+' + tn(gm * Rp) + '}=' + tn(Av)), 'In phase, and less than 1. $Z_o$ is dominated by $1/g_m$.']) + fin('Z_o=' + te(Zo, 'Ω') + ',\\quad A_v=' + tn(Av)) });
        if (v === 'load') {
          var RL = pickE(r, 'E12', 470, 4700), Rsig = r.pick([1e3, 10e3, 47e3, 100e3, 470e3]), vsP = r.pick([0.1, 0.2, 0.5, 1]);
          var Rpl = par(RS, RL), AvL = gm * Rpl / (1 + gm * Rpl), Avs = Zi / (Zi + Rsig) * AvL, vo = Avs * vsP, vgs = vsP * Zi / (Zi + Rsig) - vo;
          data.RL = RL; data.Rsig = Rsig; data.vs = vsP;
          parts.push({ q: 'The follower drives $R_L=' + te(RL, 'Ω') + '$ from a source with $R_{sig}=' + te(Rsig, 'Ω') + '$. Find $A_{vL}$, $A_{vs}$, and the peak $v_o$ and $v_{gs}$ for $v_s=' + te(vsP, 'V') + '$ peak.', answers: [A('AvL', '$A_{vL}$', AvL), A('Avs', '$A_{vs}$', Avs), A('vo', '$v_o$', vo, 'V'), A('vgs', '$v_{gs}$', vgs, 'V')],
            working: steps(['Replace $R_S$ by $R_S\\parallel R_L=' + kO(Rpl) + '$ kΩ:' + M('A_{vL}=\\frac{' + tn(gm * Rpl) + '}{1+' + tn(gm * Rpl) + '}=' + tn(AvL)), M('A_{vs}=\\frac{Z_i}{Z_i+R_{sig}}A_{vL}=' + tn(Zi / (Zi + Rsig)) + '\\times' + tn(AvL) + '=' + tn(Avs)), '$v_o=A_{vs}v_s=' + te(vo, 'V') + '$ peak, and $v_{gs}=v_i-v_o=' + te(vgs, 'V') + '$ peak.']) + fin('A_{vs}=' + tn(Avs)) });
          fig = fetFig('follower', { devObj: dev, VDD: V(VDD), RG: R(RG), RS: R(RS), C1: true, C2: true, Rsig: R(Rsig), vs: true, RL: R(RL), vo: true });
        } else if (v === 'emos') fig = fetFig('follower', { devObj: dev, dev: 'V_{GS(Th)} = ' + V(dev.Vt), VDD: V(VDD), R1: R(R1), R2: R(R2), RS: R(RS), C1: true, C2: true, vi: true, vo: true });
        else fig = fetFig('follower', { devObj: dev, VDD: V(VDD), RG: R(RG), RS: R(RS), C1: true, C2: true, vi: true, vo: true });
        stem = 'The source follower below uses ' + (dev.kind === 'emos' ? 'an n-channel E-MOSFET with $k=' + tn(dev.k * 1e3, 3) + '$ mA/V² and $V_{GS(Th)}=' + te(dev.Vt, 'V') + '$' : 'an n-channel JFET with $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(dev.Vp, 'V') + '$') + (hasRd ? ', $r_d=' + te(rd, 'Ω') + '$.' : ', with $r_d=\\infty$.');
        given = [g('$V_{DD}$', VDD, 'V'), g('$R_S$', RS, 'Ω')].concat(R1 ? [g('$R_1$', R1, 'Ω'), g('$R_2$', R2, 'Ω')] : [g('$R_G$', RG, 'Ω')], devGiven(dev, true), hasRd ? [g('$r_d$', rd, 'Ω')] : []);
        return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('$Z_o$ of a follower is $R_S\\parallel 1/g_m$, not $R_S$. The gain is positive and below 1.') };
      });
    }
  });

  QB.add({
    id: 'edc.fet.ss2.cg', course: 'edc', module: 'fet', topic: 'ss2',
    title: 'Common-gate amplifier: low Z_i and source loading', difficulty: 2, marks: 7,
    tags: ['WS9 Q5', 'WS9 Q6', 'E12 N3'],
    variants: [{ id: 'self', label: 'Gate grounded, self-bias DC' }, { id: 'vss', label: 'R_S to −V_SS' }, { id: 'given', label: 'g_m given, R_sig and R_L' }, { id: 'match', label: 'Match R_sig (overdrive form)' }],
    gen: function (r, v) {
      return r.retry(function () {
        var parts = [], data = { v: v }, stem, given, fig = null;
        if (v === 'match') {
          var Rsig = r.pick([50, 75, 100, 150, 200, 250]), Vov = r.pick([0.15, 0.2, 0.25, 0.3]), RD = pickE(r, 'E12', 1000, 10000), gm = 1 / Rsig, ID = gm * Vov / 2, Gv = 0.5 * gm * RD;
          data.Rsig = Rsig; data.Vov = Vov; data.RD = RD;
          parts.push({ q: 'At what drain current must the MOSFET be biased?', answers: [A('gm', '$g_m$', gm, 'S'), A('ID', '$I_D$', ID, 'A')], working: steps(['Matching means $R_{in}=1/g_m=R_{sig}$, so $g_m=1/' + tn(Rsig) + '\\,\\Omega=' + mS(gm) + '$ mA/V.', M('I_D=\\frac{g_mV_{ov}}{2}=\\frac{' + mS(gm) + '(' + tn(Vov) + ')}{2}=' + mA(ID) + '\\,\\text{mA}')]) + fin('I_D=' + te(ID, 'A')) });
          parts.push({ q: 'With a total drain resistance of $' + te(RD, 'Ω') + '$, what overall gain is realised?', answers: [A('Gv', '$G_v$', Gv)], working: steps([M('G_v=\\frac{R_{in}}{R_{in}+R_{sig}}g_mR_D=\\frac12(' + mS(gm) + ')(' + kO(RD) + ')=' + tn(Gv)), 'Matching costs half the signal at the input.']) + fin('G_v=' + tn(Gv)) });
          stem = 'A common-gate MOSFET amplifier must match a signal source with $R_{sig}=' + te(Rsig, 'Ω') + '$, operating at an overdrive voltage of $' + te(Vov, 'V') + '$.';
          return { stem: stem, figure: null, given: [g('$R_{sig}$', Rsig, 'Ω'), g('$V_{ov}$', Vov, 'V'), g('$R_D$', RD, 'Ω')], parts: parts, data: data, notes: tip('In course notation: $Z_i\\approx1/g_m$, $A_v\\approx g_mR_D$, $A_{vs}=\\frac{Z_i}{Z_i+R_{sig}}A_v$.') };
        }
        if (v === 'given') {
          var gm2 = r.nice(2, 8, 0.5) * 1e-3, RS2 = pickE(r, 'E12', 680, 3300), RD2 = pickE(r, 'E12', 1500, 6800), RL = pickE(r, 'E12', 2200, 22000), Rs2 = r.pick([50, 100, 150, 200, 300, 470, 600]);
          var Zi2 = par(RS2, 1 / gm2), Avnl = gm2 * RD2, AvL = gm2 * par(RD2, RL), Avs2 = Zi2 / (Zi2 + Rs2) * AvL;
          data.gm = gm2; data.RS = RS2; data.RD = RD2; data.RL = RL; data.Rsig = Rs2;
          parts.push({ q: 'Find $Z_i$ and $Z_o$.', answers: [A('Zi', '$Z_i$', Zi2, 'Ω'), A('Zo', '$Z_o$', RD2, 'Ω')], working: steps([M('Z_i=R_S\\parallel\\frac1{g_m}=' + tn(RS2) + '\\parallel' + tn(1 / gm2) + '=' + te(Zi2, 'Ω')), '$Z_o=R_D=' + te(RD2, 'Ω') + '$ ($r_d=\\infty$).']) + fin('Z_i=' + te(Zi2, 'Ω')) });
          parts.push({ q: 'Find the no-load gain, $A_{vL}$ and $A_{vs}$.', answers: [A('Avnl', '$A_{vNL}$', Avnl), A('AvL', '$A_{vL}$', AvL), A('Avs', '$A_{vs}$', Avs2)], working: steps(['$A_{vNL}=g_mR_D=' + tn(Avnl) + '$', '$A_{vL}=g_m(R_D\\parallel R_L)=' + mS(gm2) + '(' + kO(par(RD2, RL)) + ')=' + tn(AvL) + '$', M('A_{vs}=\\frac{Z_i}{Z_i+R_{sig}}A_{vL}=\\frac{' + tn(Zi2) + '}{' + tn(Zi2) + '+' + tn(Rs2) + '}(' + tn(AvL) + ')=' + tn(Avs2)), 'The CG input resistance is comparable with $R_{sig}$, so the input divider loses a large share of the signal.']) + fin('A_{vs}=' + tn(Avs2)) });
          stem = 'A common-gate stage has $g_m=' + te(gm2, 'S') + '$, $R_S=' + te(RS2, 'Ω') + '$, $R_D=' + te(RD2, 'Ω') + '$ and $r_d=\\infty$. It is fed from $R_{sig}=' + te(Rs2, 'Ω') + '$ and drives $R_L=' + te(RL, 'Ω') + '$.';
          fig = S('commonGate', { VDD: true, RD: R(RD2), RS: R(RS2), C1: true, C2: true, Rsig: R(Rs2), vs: true, RL: R(RL), vo: true });
          return { stem: stem, figure: fig, given: [g('$g_m$', gm2, 'S'), g('$R_S$', RS2, 'Ω'), g('$R_D$', RD2, 'Ω'), g('$R_{sig}$', Rs2, 'Ω'), g('$R_L$', RL, 'Ω')], parts: parts, data: data, notes: trap('Do not ignore $R_{sig}$ for a CG stage: $Z_i\\approx 1/g_m$ is only hundreds of ohms.') };
        }
        var dev = newJ(r), VDD = r.pick(VDDS), VSS = v === 'vss' ? r.pick([3, 4, 5, 6, 9, 10]) : 0;
        var RS = v === 'vss' ? pickE(r, 'E12', 1000, 4700) : pickE(r, 'E12', 330, 2200);
        var q = solveQ(dev, VSS, RS, v === 'vss' ? '$V_{GS}=V_{SS}-I_DR_S$' : '$V_{GS}=-I_DR_S$'); if (!q) return null;
        var VS = -VSS + q.I * RS, RD = pickRD(r, q.I, VDD, VS, q.V - dev.Vp, 1000); if (!RD) return null;
        var o = outSide(dev, q.I, VDD, RD, VS, q.V); if (!o.sat) return null;
        var hasRd = r.bool(0.6), rd = hasRd ? 1 / (r.pick(YOS) * 1e-6) : Infinity;
        var gs = gmSteps(dev, q.V, q.I), gm = gs.G.gm;
        var Zi = hasRd ? par(RS, (rd + RD) / (1 + gm * rd)) : par(RS, 1 / gm), Zo = hasRd ? par(RD, rd) : RD, Av = hasRd ? (gm * RD + RD / rd) / (1 + RD / rd) : gm * RD;
        data = { v: v, Idss: dev.Idss, Vp: dev.Vp, VDD: VDD, VSS: VSS, RS: RS, RD: RD, rd: hasRd ? rd : null };
        parts.push({ q: 'Find $I_{DQ}$, $V_{GSQ}$ and $g_m$.', answers: [A('ID', '$I_{DQ}$', q.I, 'A'), A('VGS', '$V_{GSQ}$', q.V, 'V', { abs: 0.01 }), A('gm', '$g_m$', gm, 'S')],
          working: steps([v === 'vss' ? 'Gate grounded, $V_S=-V_{SS}+I_DR_S$: $V_{GS}=' + tn(VSS) + '-' + kO(RS) + 'I_D$.' : 'Gate grounded, $V_S=I_DR_S$: $V_{GS}=-' + kO(RS) + 'I_D$.'].concat(q.steps, o.w, gs.w)) + fin('g_m=' + te(gm, 'S')) });
        parts.push({ q: 'Find $Z_i$, $Z_o$ and $A_v$' + (hasRd ? ' (use the full $r_d$ formulas)' : '') + '.', answers: [A('Zi', '$Z_i$', Zi, 'Ω'), A('Zo', '$Z_o$', Zo, 'Ω'), A('Av', '$A_v$', Av)],
          working: steps(hasRd ? [M('Z_i=R_S\\parallel\\frac{r_d+R_D}{1+g_mr_d}=' + kO(RS) + '\\text{k}\\parallel\\frac{' + kO(rd + RD) + '\\text{k}}{1+' + tn(gm * rd) + '}=' + te(Zi, 'Ω')), M('Z_o=R_D\\parallel r_d=' + te(Zo, 'Ω')), M('A_v=\\frac{g_mR_D+R_D/r_d}{1+R_D/r_d}=\\frac{' + tn(gm * RD) + '+' + tn(RD / rd) + '}{' + tn(1 + RD / rd) + '}=' + tn(Av)), 'Approximations: $Z_i\\approx R_S\\parallel1/g_m=' + te(par(RS, 1 / gm), 'Ω') + '$, $A_v\\approx g_mR_D=' + tn(gm * RD) + '$.']
            : [M('Z_i=R_S\\parallel\\frac{1}{g_m}=' + tn(RS) + '\\parallel' + tn(1 / gm) + '=' + te(Zi, 'Ω')), '$Z_o=R_D=' + te(RD, 'Ω') + '$', '$A_v=g_mR_D=' + mS(gm) + '(' + kO(RD) + ')=' + tn(Av) + '$, positive (in phase).']) + fin('Z_i=' + te(Zi, 'Ω') + ',\\quad A_v=' + tn(Av)) });
        stem = 'In the common-gate amplifier below the signal enters at the source and leaves at the drain. The JFET has $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(dev.Vp, 'V') + '$' + (hasRd ? ', $r_d=' + te(rd, 'Ω') + '$.' : ', $r_d=\\infty$.');
        fig = v === 'vss' ? vssFig({ device: 'jfet', type: 'n', dev: devText(dev), VDD: V(VDD), VSS: V(VSS), RD: R(RD), RS: R(RS), ac: true }) : S('commonGate', { VDD: V(VDD), RD: R(RD), RS: R(RS), dev: devText(dev), C1: true, C2: true, vi: true, vo: true });
        given = [g('$V_{DD}$', VDD, 'V')].concat(v === 'vss' ? [g('$V_{SS}$', VSS, 'V')] : [], [g('$R_D$', RD, 'Ω'), g('$R_S$', RS, 'Ω')], devGiven(dev), hasRd ? [g('$r_d$', rd, 'Ω')] : []);
        return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('CG gain is positive (in phase). Its $Z_i$ is low, roughly $R_S\\parallel 1/g_m$.') };
      });
    }
  });

  QB.add({
    id: 'edc.fet.ss2.dfb', course: 'edc', module: 'fet', topic: 'ss2',
    title: 'E-MOSFET drain-feedback amplifier: Z_i is not R_F', difficulty: 2, marks: 6,
    tags: ['EX2 Q9b', 'E12 Ex2'],
    variants: [{ id: 'ideal', label: 'r_d = ∞' }, { id: 'rd', label: 'Including r_d' }, { id: 'load', label: 'With a load R_L' }],
    gen: function (r, v) {
      return r.retry(function () {
        var dev = newE(r), VDD = r.pick([12, 15, 18, 20, 24]), RD = pickE(r, 'E12', 1000, 3300), RF = r.pick([4.7e6, 10e6, 12e6, 22e6]);
        var q = solveQ(dev, VDD, RD, '$V_{GS}=V_{DD}-I_DR_D$'); if (!q || q.V < dev.Vt + 1 || q.V > VDD - 2) return null;
        var rd = v === 'rd' ? 1 / (r.pick(YOS) * 1e-6) : Infinity, RL = v === 'load' ? pickE(r, 'E12', 2200, 22000) : null;
        var gs = gmSteps(dev, q.V, q.I), gm = gs.G.gm, Rd = v === 'rd' ? par(rd, RD) : v === 'load' ? par(RD, RL) : RD;
        var Zi = (RF + Rd) / (1 + gm * Rd), Zo = par(RF, Rd), Av = -gm * par(RF, Rd);
        var dlab = v === 'rd' ? 'r_d\\parallel R_D' : v === 'load' ? 'R_D\\parallel R_L' : 'R_D';
        var parts = [];
        parts.push({ q: 'Find $V_{GSQ}$, $I_{DQ}$ and $g_m$.', answers: [A('ID', '$I_{DQ}$', q.I, 'A'), A('VGS', '$V_{GSQ}$', q.V, 'V', { abs: 0.01 }), A('gm', '$g_m$', gm, 'S')],
          working: steps(['Drain feedback: $V_{GS}=V_{DS}=V_{DD}-I_DR_D=' + tn(VDD) + '-' + kO(RD) + 'I_D$ (so saturation is guaranteed).'].concat(q.steps, gs.w)) + fin('g_m=' + te(gm, 'S')) });
        parts.push({ q: 'Find $Z_i$, $Z_o$ and $A_v$' + (v === 'load' ? ' with $R_L=' + te(RL, 'Ω') + '$ connected' : '') + '.', answers: [A('Zi', '$Z_i$', Zi, 'Ω'), A('Zo', '$Z_o$', Zo, 'Ω'), A('Av', '$A_v$', Av)],
          working: steps([v === 'ideal' ? '$r_d=\\infty$.' : v === 'rd' ? '$r_d\\parallel R_D=' + kO(Rd) + '$ kΩ.' : 'The load sits across the drain: replace $R_D$ by $R_D\\parallel R_L=' + kO(Rd) + '$ kΩ ($r_d=\\infty$).',
            M('Z_i=\\frac{R_F+' + dlab + '}{1+g_m(' + dlab + ')}=\\frac{' + tn(RF / 1e6) + '\\,\\text{M}\\Omega+' + kO(Rd) + '\\,\\text{k}\\Omega}{1+' + tn(gm * Rd) + '}=' + te(Zi, 'Ω')),
            M('Z_o=R_F\\parallel ' + dlab + '=' + te(Zo, 'Ω') + ',\\qquad A_v=-g_m(R_F\\parallel ' + dlab + ')=' + tn(Av)), '$Z_i$ is only about $R_F/' + tn(1 + gm * Rd, 3) + '$: the Miller-type feedback divides $R_F$ by $1+g_mR_D$.']) + fin('Z_i=' + te(Zi, 'Ω') + ',\\quad A_v=' + tn(Av)) });
        var fig = fetFig('dfb', { devObj: dev, dev: 'k = ' + F.num(dev.k * 1e3, 3) + ' mA/V², V_{GS(Th)} = ' + V(dev.Vt), VDD: V(VDD), RG: { label: 'R_F', value: R(RF) }, RD: R(RD), C1: true, C2: true, vi: true, vo: true, RL: v === 'load' ? R(RL) : undefined });
        return {
          stem: 'The E-MOSFET drain-feedback amplifier below has $k=' + tn(dev.k * 1e3, 3) + '$ mA/V², $V_{GS(Th)}=' + te(dev.Vt, 'V') + '$' + (v === 'rd' ? ' and $r_d=' + te(rd, 'Ω') + '$' : '') + '. $R_F$ runs from drain to gate.',
          figure: fig, given: [g('$V_{DD}$', VDD, 'V'), g('$R_D$', RD, 'Ω'), g('$R_F$', RF, 'Ω')].concat(devGiven(dev, true), v === 'rd' ? [g('$r_d$', rd, 'Ω')] : [], RL ? [g('$R_L$', RL, 'Ω')] : []),
          parts: parts, data: { v: v, k: dev.k, Vt: dev.Vt, VDD: VDD, RD: RD, RF: RF, rd: v === 'rd' ? rd : null, RL: RL },
          notes: trap('$Z_i$ is not $R_F$: it is about $R_F/(1+g_mR_D)$, several times smaller.')
        };
      });
    }
  });

  function cascadeFig(st1, st2, kind2, extra) {
    if (!(QB.sch && QB.sch._stage && QB.sch._inputChain)) return null;
    var K = { dev: 'fet', supply: 'VDD', top: 'RD', bias: 'RG', b1: 'R1', b2: 'R2', em: 'RS', em1: 'RS1', em2: 'RS2', byp: 'CS', fb: 'RG', gate: 'VGG',
      sym: { VDD: 'V_{DD}', RD: 'R_D', RG: 'R_G', R1: 'R_1', R2: 'R_2', RS: 'R_S', RS1: 'R_{S1}', RS2: 'R_{S2}', CS: 'C_S', VGG: 'V_{GG}' }, nodes: ['V_G', 'V_D', 'V_S'], cur: ['I_G', 'I_D', 'I_S'], rs: 'R_{sig}' };
    var d = QB.sch.drawing();
    var a = QB.sch._stage(d, st1, { K: K, bias: 'self', xb: 120, xc: 220 });
    var b = QB.sch._stage(d, st2, { K: K, bias: 'self', xb: 400, xc: 500, takeoff: kind2 === 'follower' ? 'emitter' : null, topMandatory: kind2 !== 'follower', gy: a.gy });
    QB.sch._inputChain(d, a.bnode, Object.assign({ C1: true, labels: { Rs: 'R_{sig}' } }, extra.in), Math.max(a.gy, b.gy), {});
    var c = a.cnode; d.dot(c); d.line(c, [c[0] + 40, c[1]]);
    d.capacitor({ from: [c[0] + 40, c[1]], to: [c[0] + 100, c[1]], label: 'C_C', side: 'top' });
    d.line([c[0] + 100, c[1]], [400, c[1]], b.bnode);
    QB.sch._outputChain(d, b.out, Object.assign({ C2: true }, extra.out), Math.max(a.gy, b.gy), { gapRL: 50 });
    return d.svg({ title: 'Two-stage FET cascade' });
  }

  QB.add({
    id: 'edc.fet.ss2.cascade', course: 'edc', module: 'fet', topic: 'ss2',
    title: 'Two-stage FET cascade: loaded stage gains and V_o', difficulty: 3, marks: 9,
    tags: ['WS9 Q9', 'EX2 Q10', 'cascade', 'exam-style'],
    variants: [{ id: 'twocs', label: 'Two identical CS stages' }, { id: 'csfollow', label: 'CS stage into a source follower' }],
    gen: function (r, v) {
      return r.retry(function () {
        var dev = newJ(r), VDD = r.pick([15, 18, 20, 24]), RG = r.pick([1e6, 2.2e6, 3.3e6, 10e6]), RS = pickE(r, 'E12', 330, 1500);
        var q = solveQ(dev, 0, RS, '$V_{GS}=-I_DR_S$'); if (!q) return null;
        var RD = pickRD(r, q.I, VDD, q.I * RS, q.V - dev.Vp, 1000); if (!RD) return null;
        var o = outSide(dev, q.I, VDD, RD, q.I * RS, q.V); if (!o.sat) return null;
        var gs = gmSteps(dev, q.V, q.I), gm = gs.G.gm, hasRd = v === 'twocs' && r.bool(0.5), rd = hasRd ? 1 / (r.pick(YOS) * 1e-6) : Infinity;
        var RL = pickE(r, 'E12', 1000, 22000), Rsig = r.pick([1e3, 10e3, 47e3, 100e3]), Vi = r.pick([5, 10, 20, 50]) * 1e-3;
        var parts = [], data = { v: v, Idss: dev.Idss, Vp: dev.Vp, VDD: VDD, RG: RG, RS: RS, RD: RD, rd: hasRd ? rd : null, RL: RL, Rsig: Rsig, Vi: Vi };
        parts.push({ q: 'Find the stage-1 Q-point and $g_{m1}$.', answers: [A('ID', '$I_{DQ}$', q.I, 'A'), A('VGS', '$V_{GSQ}$', q.V, 'V', { abs: 0.01 }), A('gm', '$g_m$', gm, 'S')], working: steps(['Self bias: $V_{GS}=-' + kO(RS) + 'I_D$.'].concat(q.steps, o.w, gs.w)) + fin('g_m=' + te(gm, 'S')) });
        var Av1, Av2, Zo, w2 = [];
        if (v === 'twocs') {
          var Rp2 = hasRd ? par(RD, rd, RL) : par(RD, RL), Rp1 = hasRd ? par(RD, rd, RG) : par(RD, RG);
          Av2 = -gm * Rp2; Av1 = -gm * Rp1; Zo = hasRd ? par(RD, rd) : RD;
          w2 = ['Stage 2 first. It sees $R_L$: $A_{v2}=-g_m(' + (hasRd ? 'r_d\\parallel ' : '') + 'R_D\\parallel R_L)=-' + mS(gm) + '(' + kO(Rp2) + ')=' + tn(Av2) + '$.',
            'Stage 1 is loaded by $Z_{i2}=R_G=' + te(RG, 'Ω') + '$: $A_{v1}=-g_m(' + (hasRd ? 'r_d\\parallel ' : '') + 'R_D\\parallel R_G)=' + tn(Av1) + '$ (the megohm load barely matters).'];
        } else {
          // stage 2: identical JFET as a source follower with its own R_S2 (self bias)
          var RS2 = pickE(r, 'E12', 1000, 4700), q2 = solveQ(dev, 0, RS2, '$V_{GS2}=-I_{D2}R_{S2}$'); if (!q2) return null;
          if (VDD - q2.I * RS2 < q2.V - dev.Vp + 1) return null;
          var gm2 = gmOf(dev, q2.V, q2.I).gm, Rl2 = par(RS2, RL);
          Av2 = gm2 * Rl2 / (1 + gm2 * Rl2); Av1 = -gm * par(RD, RG); Zo = par(RS2, 1 / gm2);
          data.RS2 = RS2;
          w2 = ['Stage 2 (follower, identical JFET, $R_{S2}=' + te(RS2, 'Ω') + '$). Its DC: $V_{GS2}=-' + kO(RS2) + 'I_{D2}$ gives $I_{D2}=' + mA(q2.I) + '$ mA, $V_{GS2}=' + tn(q2.V) + '$ V (valid root), so $g_{m2}=' + mS(gm2) + '$ mS.',
            M('A_{v2}=\\frac{g_{m2}(R_{S2}\\parallel R_L)}{1+g_{m2}(R_{S2}\\parallel R_L)}=\\frac{' + tn(gm2 * Rl2) + '}{1+' + tn(gm2 * Rl2) + '}=' + tn(Av2)),
            'Stage 1 is loaded by $Z_{i2}=R_G$: $A_{v1}=-g_{m1}(R_D\\parallel R_G)=' + tn(Av1) + '$.'];
        }
        var AvT = Av1 * Av2, Vo = AvT * Vi, Avs = RG / (RG + Rsig) * AvT;
        parts.push({ q: 'Find the loaded gain of each stage and the overall $A_{vT}=v_o/v_i$.', answers: [A('Av1', '$A_{v1}$', Av1), A('Av2', '$A_{v2}$', Av2), A('AvT', '$A_{vT}$', AvT)], working: steps(w2.concat(['$A_{vT}=A_{v1}A_{v2}=(' + tn(Av1) + ')(' + tn(Av2) + ')=' + tn(AvT) + '$' + (AvT > 0 ? ', in phase (two inversions).' : ', inverted (one CS stage).')])) + fin('A_{vT}=' + tn(AvT)) });
        parts.push({ q: 'Find $V_o$ for $v_i=' + te(Vi, 'V') + '$, the amplifier $Z_i$ and $Z_o$, and $A_{vs}$ with $R_{sig}=' + te(Rsig, 'Ω') + '$.', answers: [A('Vo', '$V_o$', Vo, 'V'), A('Zi', '$Z_i$', RG, 'Ω'), A('Zo', '$Z_o$', Zo, 'Ω'), A('Avs', '$A_{vs}$', Avs)],
          working: steps(['$V_o=A_{vT}v_i=' + te(Vo, 'V') + '$', '$Z_i=Z_{i1}=R_G=' + te(RG, 'Ω') + '$, $Z_o=Z_{o2}=' + te(Zo, 'Ω') + '$', M('A_{vs}=\\frac{R_G}{R_G+R_{sig}}A_{vT}=' + tn(RG / (RG + Rsig)) + '\\times' + tn(AvT) + '=' + tn(Avs))]) + fin('V_o=' + te(Vo, 'V')) });
        var st = { VDD: V(VDD), RG: R(RG), RD: R(RD), RS: R(RS), CS: true };
        var fig = cascadeFig(st, v === 'twocs' ? st : { VDD: V(VDD), RG: R(RG), RS: { label: 'R_{S2}', value: R(data.RS2) } }, v === 'twocs' ? 'cs' : 'follower', { in: { Rs: R(Rsig), vs: true }, out: { RL: R(RL), vo: true } });
        return {
          stem: (v === 'twocs' ? 'Two identical self-bias JFET stages ($R_S$ bypassed) are RC-coupled.' : 'A self-bias JFET CS stage ($R_S$ bypassed) drives a JFET source follower built with an identical JFET.') + ' The JFETs have $I_{DSS}=' + te(dev.Idss, 'A') + '$ and $V_P=' + te(dev.Vp, 'V') + '$' + (hasRd ? ', $r_d=' + te(rd, 'Ω') + '$.' : ', $r_d=\\infty$.') + ' The output drives $R_L=' + te(RL, 'Ω') + '$.',
          figure: fig, given: [g('$V_{DD}$', VDD, 'V'), g('$R_G$', RG, 'Ω'), g('$R_D$', RD, 'Ω'), g('$R_S$', RS, 'Ω'), g('$R_L$', RL, 'Ω')].concat(devGiven(dev), hasRd ? [g('$r_d$', rd, 'Ω')] : []),
          parts: parts, data: data, notes: trap('Each stage gain must include the loading of the next stage. Do not round the stage gains before multiplying.')
        };
      });
    }
  });

  /* ============================================================ MODULE 4 FIGURES (local drawings) */
  function DR() { return QB.sch.drawing(); }
  function rv(lbl, val) { return { label: lbl, value: val }; }
  /** inverting stage / summer: inverting input pin at [x,y]; ins = [{label,value}] one per input */
  function opInvStage(d, x, y, ins, Rf) {
    var p = d.opamp({ at: [x, y], anchor: 'inv' }), nx = x - 30, starts = [];
    d.line([nx, y], [x, y]);
    ins.forEach(function (R, k) {
      var yk = y + 55 * k;
      d.resistor({ from: [nx - 90, yk], to: [nx, yk], label: R.label, value: R.value, side: 'top', labelStyle: 'line' });
      if (k > 0) d.dot([nx, yk]);
      starts.push([nx - 90, yk]);
    });
    if (ins.length > 1) d.line([nx, y], [nx, y + 55 * (ins.length - 1)]);
    d.dot([nx, y]);
    d.line([nx, y], [nx, y - 55]);
    d.resistor({ from: [nx, y - 55], to: [x + 110, y - 55], label: Rf.label, value: Rf.value, side: 'top', labelStyle: 'line' });
    d.line([x + 110, y - 55], [x + 110, y + 16]); d.line(p.out, [x + 110, y + 16]); d.dot([x + 110, y + 16]);
    d.line(p.noninv, [x - 10, y + 32], [x - 10, y + 46]); d.ground([x - 10, y + 46]);
    return { ins: starts, out: [x + 110, y + 16] };
  }
  /** non-inverting stage (+ on top at [x,y]); follower if R1 is null */
  function opNonStage(d, x, y, R1, Rf) {
    var p = d.opamp({ at: [x, y], anchor: 'noninv', plusTop: true });
    d.line([x - 40, y], [x, y]);
    if (!R1) { d.line(p.inv, [x - 15, y + 32], [x - 15, y + 62], [x + 110, y + 62], [x + 110, y + 16]); }
    else {
      d.line(p.inv, [x - 20, y + 32], [x - 20, y + 80]); d.dot([x - 20, y + 80]);
      d.resistor({ from: [x - 20, y + 80], to: [x - 20, y + 145], label: R1.label, value: R1.value, side: 'left' }); d.ground([x - 20, y + 145]);
      d.resistor({ from: [x - 20, y + 80], to: [x + 110, y + 80], label: Rf.label, value: Rf.value, side: 'bottom', labelStyle: 'line' });
      d.line([x + 110, y + 80], [x + 110, y + 16]);
    }
    d.line(p.out, [x + 110, y + 16]); d.dot([x + 110, y + 16]);
    return { inp: [x - 40, y], out: [x + 110, y + 16] };
  }
  function outTerm(d, p, lbl) { d.line(p, [p[0] + 35, p[1]]); d.terminal([p[0] + 35, p[1]], { label: lbl || 'V_o', side: 'right' }); }
  function opFig(kind, o) {
    if (hasS('opInverting') && kind === 'inv' && o.useTpl) return S('opInverting', o);
    var d = DR(), s;
    if (kind === 'inv') { s = opInvStage(d, 200, 100, [o.R1], o.Rf); d.terminal(s.ins[0], { label: o.vin || 'V_1', side: 'left' }); outTerm(d, s.out); }
    else if (kind === 'sum') { s = opInvStage(d, 220, 100, o.Rs, o.Rf); s.ins.forEach(function (p, k) { d.terminal(p, { label: 'V_' + (k + 1), side: 'left' }); }); outTerm(d, s.out); }
    else if (kind === 'non') { s = opNonStage(d, 200, 100, o.R1, o.Rf); d.terminal(s.inp, { label: o.vin || 'V_1', side: 'left' }); outTerm(d, s.out); }
    else if (kind === 'follower') {
      s = opNonStage(d, 260, 100, null, null);
      d.resistor({ from: [110, 100], to: [s.inp[0], 100], label: 'R_s', value: o.Rs, side: 'top', labelStyle: 'line' });
      d.terminal([110, 100], { label: 'V_s', side: 'left' });
      d.line(s.out, [s.out[0] + 40, s.out[1]]); d.resistor({ from: [s.out[0] + 40, s.out[1]], to: [s.out[0] + 40, s.out[1] + 80], label: 'R_L', value: o.RL, side: 'right' }); d.ground([s.out[0] + 40, s.out[1] + 80]);
    } else if (kind === 'casc') {
      var a = o.first === 'inv' ? opInvStage(d, 160, 100, [o.Ra], o.Rfa) : opNonStage(d, 160, 100, o.Ra, o.Rfa);
      d.terminal(o.first === 'inv' ? a.ins[0] : a.inp, { label: 'V_1', side: 'left' });
      var y2 = a.out[1], b;
      if (o.second === 'non') { b = opNonStage(d, a.out[0] + 80, y2, o.Rb, o.Rfb); d.line(a.out, b.inp); }
      else { b = opInvStage(d, a.out[0] + 150, y2, [o.Rb, o.Rc], o.Rfb); d.line(a.out, b.ins[0]); d.terminal(b.ins[1], { label: 'V_2', side: 'left' }); }
      d.labelNear([a.out[0] + 12, a.out[1]], 'V_{o1}', { prefer: ['top', 'bottom'], gap: 8 });
      outTerm(d, b.out);
    }
    return d.svg({ title: 'Op-amp circuit' });
  }
  function diffFig(o) {
    if (!hasS('drawing')) return null;
    var d = DR(), y = 160;
    var q1 = d.bjt({ at: [130, y], anchor: 'base', label: 'Q_1' }), q2 = d.bjt({ at: [330, y], anchor: 'base', flipX: true, label: 'Q_2' });
    var c1 = q1.collector, c2 = q2.collector, yt = 40;
    d.resistor({ from: [c1[0], yt], to: [c1[0], c1[1] - 15], label: 'R_C', value: o.RC, side: 'left' }); d.line([c1[0], c1[1] - 15], c1);
    d.resistor({ from: [c2[0], yt], to: [c2[0], c2[1] - 15], label: 'R_C', value: o.RC, side: 'right' }); d.line([c2[0], c2[1] - 15], c2);
    d.line([c1[0], yt], [c2[0], yt]); d.dot([230, yt]); d.line([230, yt], [230, yt - 12]); d.rail([230, yt - 12], { label: '+V_{CC}', value: o.VCC });
    var ye = q1.emitter[1] + 20;
    d.line(q1.emitter, [q1.emitter[0], ye], [q2.emitter[0], ye], q2.emitter); d.dot([230, ye]);
    d.resistor({ from: [230, ye], to: [230, ye + 75], label: 'R_E', value: o.RE, side: 'right' });
    d.rail([230, ye + 75], { label: '−V_{EE}', value: o.VEE, dir: 'down' });
    d.line(q1.base, [q1.base[0] - 30, y]); d.terminal([q1.base[0] - 30, y], { label: 'V_{i1}', side: 'left' });
    d.line(q2.base, [q2.base[0] + 30, y]); d.terminal([q2.base[0] + 30, y], { label: 'V_{i2}', side: 'right' });
    var yo = c1[1] - 15;
    d.dot([c1[0], yo]); d.line([c1[0], yo], [c1[0] + 34, yo]); d.terminal([c1[0] + 34, yo], { label: 'V_{o1}', side: 'right' });
    d.dot([c2[0], yo]); d.line([c2[0], yo], [c2[0] - 34, yo]); d.terminal([c2[0] - 34, yo], { label: 'V_{o2}', side: 'left' });
    return d.svg({ title: 'BJT differential amplifier' });
  }
  function classBFig(o) {
    if (hasS('classBPushPull') && o.useTpl) return S('classBPushPull', o);
    var d = DR(), x = 200, y = 160;
    var q1 = d.bjt({ at: [x, y - 50], anchor: 'base', label: 'Q_1', value: 'npn' }), q2 = d.bjt({ at: [x, y + 50], anchor: 'base', type: 'pnp', flipY: true, label: 'Q_2', value: 'pnp' });
    d.line(q1.collector, [q1.collector[0], q1.collector[1] - 20]); d.rail([q1.collector[0], q1.collector[1] - 20], { label: '+V_{CC}', value: o.VCC });
    d.line(q2.collector, [q2.collector[0], q2.collector[1] + 20]); d.rail([q2.collector[0], q2.collector[1] + 20], { label: '−V_{CC}', value: o.VCC, dir: 'down' });
    var xo = q1.emitter[0];
    d.line(q1.emitter, [xo, y], q2.emitter); d.dot([xo, y]);
    d.line(q1.base, [x - 30, y - 50], [x - 30, y + 50], q2.base); d.dot([x - 30, y]);
    d.line([x - 30, y], [x - 70, y]); d.terminal([x - 70, y], { label: 'v_i', side: 'left' });
    d.line([xo, y], [xo + 70, y]); d.resistor({ from: [xo + 70, y], to: [xo + 70, y + 80], label: 'R_L', value: o.RL, side: 'right' }); d.ground([xo + 70, y + 80]);
    d.labelNear([xo + 40, y], 'v_L', { prefer: ['top'], gap: 7 });
    return d.svg({ title: 'Class B complementary push-pull' });
  }
  function xfmrFig(o) {
    var d = DR(), xc = 220, xb = 110, yt = 30;
    d.rail([xc, yt - 12], { label: 'V_{CC}', value: o.VCC }); d.line([xc, yt - 12], [xc, yt]); d.dot([xc, yt]);
    d.line([xb, yt], [xc, yt]);
    var tr = d.transformer({ at: [xc, yt + 20], h: 80, ratio: o.ratio || 'a : 1' });
    d.line([xc, yt], tr.p1);
    var q = d.bjt({ at: [xc, tr.p2[1] + 30], anchor: 'collector', value: o.beta });
    d.line(tr.p2, q.collector); d.line(q.emitter, [q.emitter[0], q.emitter[1] + 20]); d.ground([q.emitter[0], q.emitter[1] + 20]);
    d.resistor({ from: [xb, yt], to: [xb, q.base[1]], label: 'R_B', value: o.RB, side: 'left' }); d.line([xb, q.base[1]], q.base); d.dot([xb, q.base[1]]);
    d.line([xb, q.base[1]], [xb - 30, q.base[1]]); d.terminal([xb - 30, q.base[1]], { label: 'v_i', side: 'left' });
    var xl = tr.s1[0] + 40;
    d.line(tr.s1, [xl, tr.s1[1]]); d.resistor({ from: [xl, tr.s1[1]], to: [xl, tr.s2[1]], label: 'R_L', value: o.RL, side: 'right' }); d.line([xl, tr.s2[1]], tr.s2);
    return d.svg({ title: 'Transformer-coupled class A amplifier' });
  }
  function sigTex(x, mode) { return mode === 'dc' ? te(x, 'V') : te(Math.abs(x), 'V') + '\\ \\text{rms}'; }

  /* ============================================================ DIFFERENTIAL AMPLIFIERS (E13) */
  function db(x) { return 20 * Math.log10(x); }
  QB.add({
    id: 'edc.amp.diff.cmrr', course: 'edc', module: 'amp', topic: 'diff',
    title: 'CMRR: from measurements, and output with finite CMRR', difficulty: 1, marks: 4,
    tags: ['WS10 Q1', 'WS10 Q2', 'EX1 Q8a', 'CMRR'],
    variants: [{ id: 'measure', label: 'CMRR from two measurements' }, { id: 'ratio', label: 'V_o with CMRR as a ratio' }, { id: 'db', label: 'V_o for two CMRR values in dB' }, { id: 'need', label: 'A_c and the CMRR needed' }],
    gen: function (r, v) {
      var parts = [], data = { v: v }, stem, given = [];
      if (v === 'measure') {
        var Vd = r.pick([0.5, 1, 2, 5]) * 1e-3, Vc = r.pick([0.5, 1, 2, 5]) * 1e-3, Ad = r.pick([80, 100, 120, 150, 200, 250, 500, 1000, 2000]), Ac = r.pick([0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
        var Vo1 = Ad * Vd, Vo2 = Ac * Vc, C = Ad / Ac; data.Vd = Vd; data.Vo1 = Vo1; data.Vc = Vc; data.Vo2 = Vo2;
        stem = 'Measurements on a differential amplifier give $V_o=' + te(Vo1, 'V') + '$ for a difference input $V_d=' + te(Vd, 'V') + '$, and $V_o=' + te(Vo2, 'V') + '$ with both inputs tied to $V_c=' + te(Vc, 'V') + '$.';
        given = [g('$V_d$ test', pe(Vd, 'V') + ' → ' + pe(Vo1, 'V')), g('$V_c$ test', pe(Vc, 'V') + ' → ' + pe(Vo2, 'V'))];
        parts.push({ q: 'Find $A_d$ and $A_c$.', answers: [A('Ad', '$A_d$', Ad), A('Ac', '$A_c$', Ac)], working: steps(['$A_d=V_o/V_d=' + te(Vo1, 'V') + '/' + te(Vd, 'V') + '=' + tn(Ad) + '$', '$A_c=V_o/V_c=' + te(Vo2, 'V') + '/' + te(Vc, 'V') + '=' + tn(Ac) + '$']) + fin('A_d=' + tn(Ad) + ',\\quad A_c=' + tn(Ac)) });
        parts.push({ q: 'Find the CMRR as a ratio and in dB.', answers: [A('C', 'CMRR', C), A('CdB', 'CMRR (dB)', db(C), 'dB', { abs: 0.05 })], working: steps(['$\\text{CMRR}=A_d/A_c=' + tn(C) + '$', '$\\text{CMRR(dB)}=20\\log_{10}' + tn(C) + '=' + tn(db(C)) + '$ dB']) + fin('\\text{CMRR}=' + tn(C) + '=' + tn(db(C)) + '\\,\\text{dB}') });
      } else if (v === 'ratio' || v === 'db') {
        var Ad2 = r.pick([1000, 2000, 4000, 5000, 6000, 8000, 10000]), Vd2 = r.nice(20, 150, 10) * 1e-6, Vc2 = r.nice(0.2, 2, 0.1) * 1e-3;
        if (Ad2 * Vd2 > 10) Vd2 = Math.round(8 / Ad2 * 1e6) / 1e6;
        var Vi1 = Vc2 + Vd2 / 2, Vi2 = Vc2 - Vd2 / 2;
        var Cs = v === 'ratio' ? [r.pick([100, 200, 500, 1000, 1e4, 1e5])] : r.shuffle([40, 60, 80, 100, 120]).slice(0, 2).sort(function (a, b) { return a - b; });
        data.Ad = Ad2; data.Vi1 = Vi1; data.Vi2 = Vi2; data.C = Cs; data.isdb = v === 'db';
        stem = 'An op-amp has differential gain $A_d=' + Ad2 + '$. The inputs are $V_{i1}=' + te(Vi1, 'V', 4) + '$ and $V_{i2}=' + te(Vi2, 'V', 4) + '$.';
        given = [g('$A_d$', String(Ad2)), g('$V_{i1}$', Vi1, 'V', 4), g('$V_{i2}$', Vi2, 'V', 4)];
        parts.push({ q: 'Find $V_d$ and $V_c$.', answers: [A('Vd', '$V_d$', Vd2, 'V'), A('Vc', '$V_c$', Vc2, 'V')], working: steps(['$V_d=V_{i1}-V_{i2}=' + te(Vd2, 'V', 4) + '$', '$V_c=\\tfrac12(V_{i1}+V_{i2})=' + te(Vc2, 'V', 4) + '$ (the average, not the sum).']) + fin('V_d=' + te(Vd2, 'V') + ',\\quad V_c=' + te(Vc2, 'V')) });
        Cs.forEach(function (c, i) {
          var ratio = v === 'db' ? Math.pow(10, c / 20) : c, Vo = Ad2 * Vd2 * (1 + Vc2 / (ratio * Vd2));
          parts.push({ q: 'Find $V_o$ when CMRR $=' + (v === 'db' ? c + '$ dB' : tn(c) + '$') + '.', answers: [A('Vo' + i, '$V_o$', Vo, 'V', { tol: 0.002 })],
            working: steps([v === 'db' ? 'Convert: $\\text{CMRR}=10^{' + c + '/20}=' + tn(ratio) + '$.' : '', M('V_o=A_dV_d\\left(1+\\frac{1}{\\text{CMRR}}\\frac{V_c}{V_d}\\right)=' + te(Ad2 * Vd2, 'V', 4) + '\\left(1+\\frac{' + tn(Vc2 / Vd2) + '}{' + tn(ratio) + '}\\right)=' + te(Vo, 'V', 5)),
              'Split: $A_dV_d=' + te(Ad2 * Vd2, 'V', 4) + '$ and the common-mode error $A_cV_c=(A_d/\\text{CMRR})V_c=' + te(Ad2 / ratio * Vc2, 'V') + '$.']) + fin('V_o=' + te(Vo, 'V', 5)) });
        });
      } else {
        var Ad3 = r.pick([2000, 4000, 5000, 10000, 20000]), CdB = r.pick([60, 70, 80, 86, 90, 100]), Ac3 = Ad3 / Math.pow(10, CdB / 20);
        var Vd3 = r.nice(0.05, 0.5, 0.05) * 1e-3, Vc3 = r.nice(0.5, 5, 0.5) * 1e-3, p = r.pick([0.1, 0.5, 1, 2]), Cmin = (Vc3 / Vd3) / (p / 100);
        data.Ad = Ad3; data.CdB = CdB; data.Vd = Vd3; data.Vc = Vc3; data.p = p;
        stem = 'An op-amp has $A_d=' + Ad3 + '$ and a CMRR of ' + CdB + ' dB.';
        given = [g('$A_d$', String(Ad3)), g('CMRR', CdB + ' dB')];
        parts.push({ q: 'Find $A_c$.', answers: [A('Ac', '$A_c$', Ac3)], working: steps(['$\\text{CMRR}=10^{' + CdB + '/20}=' + tn(Math.pow(10, CdB / 20)) + '$', '$A_c=A_d/\\text{CMRR}=' + tn(Ac3) + '$']) + fin('A_c=' + tn(Ac3)) });
        parts.push({ q: 'A signal with $V_d=' + te(Vd3, 'V') + '$ rides on a common-mode level $V_c=' + te(Vc3, 'V') + '$. Find $V_o$, and the smallest CMRR (in dB) that keeps the common-mode error below ' + p + '% of $A_dV_d$.', answers: [A('Vo', '$V_o$', Ad3 * Vd3 + Ac3 * Vc3, 'V', { tol: 0.002 }), A('Cmin', 'CMRR min (dB)', db(Cmin), 'dB', { abs: 0.1 })],
          working: steps(['$V_o=A_dV_d+A_cV_c=' + te(Ad3 * Vd3, 'V', 4) + '+' + te(Ac3 * Vc3, 'V') + '=' + te(Ad3 * Vd3 + Ac3 * Vc3, 'V', 5) + '$',
            'The error ratio is $\\frac{A_cV_c}{A_dV_d}=\\frac{V_c}{\\text{CMRR}\\,V_d}\\le' + tn(p / 100) + '$, so' + M('\\text{CMRR}\\ge\\frac{V_c/V_d}{' + tn(p / 100) + '}=\\frac{' + tn(Vc3 / Vd3) + '}{' + tn(p / 100) + '}=' + tn(Cmin) + '=' + tn(db(Cmin)) + '\\ \\text{dB}')]) + fin('\\text{CMRR}\\ge' + tn(db(Cmin)) + '\\,\\text{dB}') });
      }
      return { stem: stem, figure: null, given: given, parts: parts, data: data, notes: trap('$V_c$ is the average of the inputs, and a CMRR in dB must be converted with $10^{\\text{dB}/20}$ before it goes into a formula.') };
    }
  });

  QB.add({
    id: 'edc.amp.diff.pair', course: 'edc', module: 'amp', topic: 'diff',
    title: 'BJT differential pair: I_E, V_C, A_d, A_c and CMRR', difficulty: 2, marks: 6,
    tags: ['EX1 Q8b', 'E13 N3', 'exam-style'],
    variants: [{ id: 'single', label: 'Single-ended output, A_c ≈ R_C/2R_E' }, { id: 'double', label: 'Double-ended output' }, { id: 'exact', label: 'Exact A_c with β' }],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([9, 10, 12, 15]), VEE = r.bool(0.7) ? VCC : r.pick([9, 10, 12, 15]), RE = pickE(r, 'E12', 4700, 56000), RC = pickE(r, 'E12', 2200, 47000), beta = r.nice(80, 200, 10);
        var IE = (VEE - 0.7) / RE, IC = IE / 2, VC = VCC - IC * RC; if (VC < 2 || VC > VCC - 1) return null;
        var re = VT26 / IC, Ase = RC / (2 * re), Adb = RC / re, Ac = v === 'exact' ? beta * RC / (beta * re + 2 * (beta + 1) * RE) : RC / (2 * RE);
        var data = { v: v, VCC: VCC, VEE: VEE, RE: RE, RC: RC, beta: beta }, parts = [];
        parts.push({ q: 'Find the tail current $I_E$, the collector current of each transistor, and $V_C$.', answers: [A('IE', '$I_E$ (tail)', IE, 'A'), A('IC', '$I_C$ each', IC, 'A'), A('VC', '$V_C$', VC, 'V')],
          working: steps(['Bases at 0 V, so the emitters sit at $-0.7$ V.' + M('I_E=\\frac{V_{EE}-0.7}{R_E}=\\frac{' + tn(VEE) + '-0.7}{' + kO(RE) + '\\,\\text{k}\\Omega}=' + te(IE, 'A', 4)), 'The tail current splits equally: $I_C\\approx I_E/2=' + te(IC, 'A', 4) + '$.', M('V_C=V_{CC}-I_CR_C=' + tn(VCC) + '-(' + tn(IC * 1e3) + '\\,\\text{mA})(' + kO(RC) + '\\,\\text{k}\\Omega)=' + tn(VC) + '\\ \\text{V}')]) + fin('I_E=' + te(IE, 'A') + ',\\ I_C=' + te(IC, 'A') + ',\\ V_C=' + te(VC, 'V')) });
        var reW = '$r_e=26\\,\\text{mV}/I_C=26\\,\\text{mV}/' + te(IC, 'A', 4) + '=' + tn(re) + '\\ \\Omega$ (per-transistor current).';
        if (v === 'double') {
          var vd = r.pick([0.5, 1, 2, 5]) * 1e-3;
          data.vd = vd;
          parts.push({ q: 'Find $r_e$, the single-ended gain with one input driven, and the double-ended differential gain.', answers: [A('re', '$r_e$', re, 'Ω'), A('Ase', '$A_v$ single-ended', Ase), A('Ad', '$A_d$ double-ended', Adb)], working: steps([reW, M('A_v(\\text{single})=\\frac{R_C}{2r_e}=\\frac{' + tn(RC) + '}{2(' + tn(re) + ')}=' + tn(Ase)), M('A_d(\\text{double})=\\frac{R_C}{r_e}=' + tn(Adb))]) + fin('A_d=' + tn(Adb)) });
          parts.push({ q: 'Find the double-ended output $V_{o1}-V_{o2}$ for a difference input $V_d=' + te(vd, 'V') + '$.', answers: [A('Vo', '$V_o$', Adb * vd, 'V')], working: steps(['$V_o=A_dV_d=' + tn(Adb) + '\\times' + te(vd, 'V') + '=' + te(Adb * vd, 'V') + '$. With matched transistors a common-mode input cancels in the double-ended output.']) + fin('V_o=' + te(Adb * vd, 'V')) });
        } else {
          parts.push({ q: 'Find $r_e$ and the single-ended differential gain $A_d$.', answers: [A('re', '$r_e$', re, 'Ω'), A('Ad', '$A_d$', Ase)], working: steps([reW, M('A_d=\\frac{R_C}{2r_e}=\\frac{' + tn(RC) + '}{' + tn(2 * re) + '}=' + tn(Ase))]) + fin('A_d=' + tn(Ase)) });
          var C = Ase / Ac;
          parts.push({ q: 'Find the common-mode gain $A_c$ and the CMRR as a ratio and in dB.', answers: [A('Ac', '$A_c$', Ac), A('C', 'CMRR', C), A('CdB', 'CMRR (dB)', db(C), 'dB', { abs: 0.05 })],
            working: steps([v === 'exact' ? M('A_c=\\frac{\\beta R_C}{\\beta r_e+2(\\beta+1)R_E}=\\frac{' + tn(beta) + '(' + tn(RC) + ')}{' + tn(beta * re) + '+2(' + tn(beta + 1) + ')(' + tn(RE) + ')}=' + tn(Ac) + '\\quad(\\approx R_C/2R_E=' + tn(RC / (2 * RE)) + ')') : M('A_c\\approx\\frac{R_C}{2R_E}=\\frac{' + tn(RC) + '}{2(' + tn(RE) + ')}=' + tn(Ac)),
              '$\\text{CMRR}=A_d/A_c=' + tn(C) + '=20\\log_{10}' + tn(C) + '=' + tn(db(C)) + '$ dB.', 'A larger $R_E$ (or a current source in the tail) lowers $A_c$ and raises the CMRR.']) + fin('\\text{CMRR}=' + tn(C) + '=' + tn(db(C)) + '\\,\\text{dB}') });
        }
        return {
          stem: 'A BJT differential amplifier uses two matched npn transistors ($\\beta=' + beta + '$). Each collector goes to $+V_{CC}=+' + te(VCC, 'V') + '$ through $R_C=' + te(RC, 'Ω') + '$, and the joined emitters go to $-V_{EE}=-' + te(VEE, 'V') + '$ through the tail resistor $R_E=' + te(RE, 'Ω') + '$. Both bases are at 0 V dc.' + (v === 'double' ? ' The output is taken between the two collectors.' : ' The output is taken single-ended from one collector.'),
          figure: diffFig({ RC: R(RC), RE: R(RE), VCC: V(VCC), VEE: V(VEE) }),
          given: [g('$V_{CC}$', VCC, 'V'), g('$V_{EE}$', VEE, 'V'), g('$R_C$', RC, 'Ω'), g('$R_E$', RE, 'Ω'), g('$\\beta$', String(beta))],
          parts: parts, data: data, notes: trap('Each transistor carries half the tail current: use $I_E/2$ for $r_e$ and $V_C$. Use $20\\log_{10}$ for a voltage-gain ratio.')
        };
      });
    }
  });

  /* ============================================================ OP-AMPS (E13) */
  function sigPick(r) { var dc = r.bool(0.5); return { dc: dc, v: dc ? r.sign() * r.nice(0.05, 1, 0.05) : r.nice(5, 200, 5) * 1e-3 }; }
  function sigT(s, x) { return s.dc ? te(x, 'V') : te(x, 'V') + '\\ \\text{rms}'; }
  function railOk(Vo, dc, rail) { var pk = dc ? Math.abs(Vo) : Math.abs(Vo) * Math.SQRT2; return pk < rail - 1.5 && Math.abs(Vo) > 1e-3; }
  QB.add({
    id: 'edc.amp.opamp.basic', course: 'edc', module: 'amp', topic: 'opamp',
    title: 'Inverting, non-inverting and follower circuits', difficulty: 1, marks: 3,
    tags: ['WS10 Q3', 'op-amp'],
    variants: [{ id: 'inv', label: 'Inverting amplifier' }, { id: 'non', label: 'Non-inverting amplifier' }, { id: 'follower', label: 'Unity follower as a buffer' }],
    gen: function (r, v) {
      return r.retry(function () {
        var rail = r.pick([9, 12, 15]), parts = [], data = { v: v, rail: rail }, stem, given, fig;
        if (v === 'follower') {
          var Vs = r.nice(0.5, 5, 0.5), Rs = pickE(r, 'E12', 4700, 100000), RL = pickE(r, 'E12', 100, 4700);
          var VLd = Vs * RL / (Rs + RL);
          data.Vs = Vs; data.Rs = Rs; data.RL = RL;
          parts.push({ q: 'Find the load voltage when $R_L$ is connected straight to the source.', answers: [A('VLd', '$V_L$ (direct)', VLd, 'V')], working: steps([M('V_L=V_s\\frac{R_L}{R_s+R_L}=' + tn(Vs) + '\\frac{' + tn(RL) + '}{' + tn(Rs) + '+' + tn(RL) + '}=' + te(VLd, 'V'))]) + fin('V_L=' + te(VLd, 'V')) });
          parts.push({ q: 'Find the load voltage with the unity follower between source and load, and the factor gained.', answers: [A('VLb', '$V_L$ (buffered)', Vs, 'V'), A('ratio', 'gain factor', Vs / VLd)], working: steps(['No current flows into the + input, so there is no drop across $R_s$: $V_+=V_s$.', 'Negative feedback forces $V_o=V_-=V_+$, so $V_L=V_s=' + te(Vs, 'V') + '$ whatever $R_L$ is (very high $Z_i$, very low $Z_o$).', 'Improvement: $' + tn(Vs) + '/' + tn(VLd) + '=' + tn(Vs / VLd) + '$.']) + fin('V_L=' + te(Vs, 'V')) });
          stem = 'A sensor with open-circuit voltage $V_s=' + te(Vs, 'V') + '$ (dc) and internal resistance $R_s=' + te(Rs, 'Ω') + '$ must drive $R_L=' + te(RL, 'Ω') + '$.';
          fig = opFig('follower', { Rs: R(Rs), RL: R(RL) });
          given = [g('$V_s$', Vs, 'V'), g('$R_s$', Rs, 'Ω'), g('$R_L$', RL, 'Ω')];
          return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: tip('The follower’s job is impedance buffering, not gain.') };
        }
        var R1 = pickE(r, 'E12', 1000, 47000), gain = r.pick([2, 3.3, 4.7, 5, 6.8, 10, 15, 20, 22, 33, 47]), Rf = nearestE(gain * R1), s = sigPick(r);
        var Av = v === 'inv' ? -Rf / R1 : 1 + Rf / R1, Vo = Av * s.v; if (!railOk(Vo, s.dc, rail) || Rf > 2.2e6) return null;
        data.R1 = R1; data.Rf = Rf; data.V1 = s.v;
        parts.push({ q: 'Find the voltage gain and the output voltage.', answers: [A('Av', '$A_v$', Av), A('Vo', '$V_o$', Vo, 'V')],
          working: steps([v === 'inv' ? 'Input through $R_1$ to the − pin, + grounded: an inverting amplifier. $V_-$ is a virtual ground.' + M('A_v=-\\frac{R_f}{R_1}=-\\frac{' + kO(Rf) + '}{' + kO(R1) + '}=' + tn(Av)) : 'Input straight into the + pin, $R_1$ from − to ground: a non-inverting amplifier.' + M('A_v=1+\\frac{R_f}{R_1}=1+\\frac{' + kO(Rf) + '}{' + kO(R1) + '}=' + tn(Av)),
            M('V_o=A_vV_1=' + tn(Av) + '\\times' + sigT(s, s.v) + '=' + sigT(s, Vo)), s.dc ? '' : (v === 'inv' ? 'The output is 180° out of phase with the input.' : 'The output is in phase with the input.'), 'Rail check: peak $' + te(Math.abs(Vo) * (s.dc ? 1 : Math.SQRT2), 'V') + '$ is inside $\\pm' + rail + '$ V.']) + fin('V_o=' + sigT(s, Vo)) });
        parts.push({ q: 'What input impedance does the source see?', answers: v === 'inv' ? [A('Zi', '$Z_i$', R1, 'Ω')] : [], working: steps([v === 'inv' ? '$Z_i=R_1=' + te(R1, 'Ω') + '$, because the − input is a virtual ground.' : 'No current flows into the + input, so $Z_i$ is very high (ideally infinite).']) + (v === 'inv' ? fin('Z_i=' + te(R1, 'Ω')) : fin('Z_i\\to\\infty')) });
        stem = 'The ideal op-amp circuit below runs from $\\pm' + rail + '$ V. The input is $V_1=' + sigT(s, s.v) + '$.';
        fig = opFig(v === 'inv' ? 'inv' : 'non', { R1: rv('R_1', R(R1)), Rf: rv('R_f', R(Rf)) });
        given = [g('$R_1$', R1, 'Ω'), g('$R_f$', Rf, 'Ω'), g('$V_1$', s.dc ? V(s.v) : pe(s.v, 'V') + ' rms')];
        return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: v === 'inv' ? trap('Keep the minus sign of the inverting gain.') : trap('The non-inverting gain is $1+R_f/R_1$, not $R_f/R_1$.') };
      });
    }
  });

  QB.add({
    id: 'edc.amp.opamp.sum', course: 'edc', module: 'amp', topic: 'opamp',
    title: 'Inverting summing amplifier: output and design', difficulty: 2, marks: 4,
    tags: ['WS10 Q4', 'E13 N2b', 'summer'],
    variants: [{ id: 'two', label: 'Two inputs' }, { id: 'three', label: 'Three inputs, mixed signs' }, { id: 'design', label: 'Choose input resistors for set weights' }],
    gen: function (r, v) {
      return r.retry(function () {
        var rail = r.pick([12, 15]), Rf = pickE(r, 'E12', 10e3, 470e3), parts = [], data = { v: v, Rf: Rf };
        var n = v === 'three' ? 3 : 2, dc = v === 'three' ? true : r.bool(0.5), Rs = [], Vs = [], wts = [];
        if (v === 'design') {
          for (var i = 0; i < 2; i++) { wts.push(r.pick([0.5, 1, 2, 2.5, 4, 5, 10])); Rs.push(Rf / wts[i]); }
          if (wts[0] === wts[1]) return null;
        } else for (var j = 0; j < n; j++) Rs.push(nearestE(Rf / r.pick([0.5, 1, 1.5, 2, 3, 4.7, 5, 10, 20])));
        for (var k = 0; k < n; k++) Vs.push(dc ? (v === 'three' || r.bool(0.4) ? r.sign() : 1) * r.nice(0.05, 1, 0.05) : r.nice(5, 100, 5) * 1e-3);
        var terms = Rs.map(function (Rk, k) { return Rf / Rk * Vs[k]; }), Vo = -terms.reduce(function (a, b) { return a + b; }, 0);
        if (!railOk(Vo, dc, rail)) return null;
        data.Rs = Rs; data.Vs = Vs; data.dc = dc;
        var sT = function (x) { return dc ? te(x, 'V') : te(x, 'V') + '\\ \\text{rms}'; };
        if (v === 'design') {
          parts.push({ q: 'Choose $R_1$ and $R_2$ so that $V_o=-(' + tn(wts[0]) + 'V_1+' + tn(wts[1]) + 'V_2)$.', answers: [A('R1', '$R_1$', Rs[0], 'Ω'), A('R2', '$R_2$', Rs[1], 'Ω')], working: steps(['Each input has its own gain $R_f/R_k$, so $R_k=R_f/w_k$:', '$R_1=' + kO(Rf) + '/' + tn(wts[0]) + '=' + kO(Rs[0]) + '$ kΩ, $R_2=' + kO(Rf) + '/' + tn(wts[1]) + '=' + kO(Rs[1]) + '$ kΩ.']) + fin('R_1=' + te(Rs[0], 'Ω') + ',\\quad R_2=' + te(Rs[1], 'Ω')) });
        }
        var wlines = ['Several inputs into the − pin (a virtual ground), so the currents add in $R_f$:' + M('V_o=-\\left(' + Rs.map(function (Rk, k) { return '\\frac{R_f}{R_' + (k + 1) + '}V_' + (k + 1); }).join('+') + '\\right)'),
          M('V_o=-\\left(' + Rs.map(function (Rk, k) { return tn(Rf / Rk) + '(' + sT(Vs[k]) + ')'; }).join('+') + '\\right)=-\\left(' + terms.map(function (t) { return te(t, 'V'); }).join('+').replace(/\+-/g, '-') + '\\right)'),
          dc ? '' : 'The inputs are in phase, so the rms terms add directly. The output is 180° out of phase with them.', 'Rail check: inside $\\pm' + rail + '$ V.'];
        parts.push({ q: 'Find $V_o$ for ' + Vs.map(function (x, k) { return '$V_' + (k + 1) + '=' + sT(x) + '$'; }).join(', ') + '.', answers: [A('Vo', '$V_o$', Vo, 'V')], working: steps(wlines) + fin('V_o=' + sT(Vo)) });
        var fig = opFig('sum', { Rs: Rs.map(function (Rk, k) { return rv('R_' + (k + 1), v === 'design' ? '?' : R(Rk)); }), Rf: rv('R_f', R(Rf)) });
        return {
          stem: 'The inverting summing amplifier below (ideal op-amp, $\\pm' + rail + '$ V supplies) has $R_f=' + te(Rf, 'Ω') + '$' + (v === 'design' ? '.' : ' and input resistors ' + Rs.map(function (Rk, k) { return '$R_' + (k + 1) + '=' + te(Rk, 'Ω') + '$'; }).join(', ') + '.'),
          figure: fig, given: [g('$R_f$', Rf, 'Ω')].concat(v === 'design' ? [] : Rs.map(function (Rk, k) { return g('$R_' + (k + 1) + '$', Rk, 'Ω'); })),
          parts: parts, data: data, notes: trap('Each input gets its own gain $R_f/R_k$; do not add the gains before multiplying. Keep the signs of dc inputs.')
        };
      });
    }
  });

  QB.add({
    id: 'edc.amp.opamp.cascade', course: 'edc', module: 'amp', topic: 'opamp',
    title: 'Multi-stage op-amp circuits', difficulty: 2, marks: 5,
    tags: ['WS10 Q5', 'EX1 Q9', 'E13 N2a'],
    variants: [{ id: 'invnon', label: 'Inverting → non-inverting' }, { id: 'nonsum', label: 'Non-inverting → summer' }, { id: 'invsum', label: 'Inverting → summer' }],
    gen: function (r, v) {
      return r.retry(function () {
        var rail = r.pick([12, 15]), dc = r.bool(0.5), parts = [], data = { v: v, dc: dc };
        var Ra = pickE(r, 'E12', 1000, 47000), Rfa = nearestE(Ra * r.pick([2, 3.3, 4.7, 5, 10, 15, 22])), V1 = dc ? r.sign() * r.nice(0.01, 0.3, 0.01) : r.nice(5, 60, 5) * 1e-3;
        var first = v === 'nonsum' ? 'non' : 'inv', g1 = first === 'inv' ? -Rfa / Ra : 1 + Rfa / Ra, Vo1 = g1 * V1;
        var Rb, Rc, Rfb, V2 = null, Vo, w2;
        var sT = function (x) { return dc ? te(x, 'V') : te(x, 'V') + '\\ \\text{rms}'; };
        if (v === 'invnon') {
          Rb = pickE(r, 'E12', 1000, 47000); Rfb = nearestE(Rb * r.pick([1, 1.2, 2.2, 3.3, 4.7])); Vo = (1 + Rfb / Rb) * Vo1;
          w2 = 'Stage 2 is non-inverting:' + M('V_o=\\left(1+\\frac{R_{f2}}{R_3}\\right)V_{o1}=' + tn(1 + Rfb / Rb) + '(' + sT(Vo1) + ')=' + sT(Vo));
        } else {
          Rfb = pickE(r, 'E12', 47000, 470000); Rb = nearestE(Rfb / r.pick([1, 2, 3, 5, 10])); Rc = nearestE(Rfb / r.pick([1, 2, 5, 10])); V2 = dc ? r.sign() * r.nice(0.01, 0.5, 0.01) : r.nice(5, 80, 5) * 1e-3;
          Vo = -(Rfb / Rb * Vo1 + Rfb / Rc * V2);
          w2 = 'Stage 2 is an inverting summer with inputs $V_{o1}$ (through $R_3$) and $V_2$ (through $R_4$):' + M('V_o=-\\left(\\frac{R_{f2}}{R_3}V_{o1}+\\frac{R_{f2}}{R_4}V_2\\right)=-\\left(' + tn(Rfb / Rb) + '(' + sT(Vo1) + ')+' + tn(Rfb / Rc) + '(' + sT(V2) + ')\\right)=' + sT(Vo));
        }
        if (!railOk(Vo1, dc, rail) || !railOk(Vo, dc, rail)) return null;
        data.Ra = Ra; data.Rfa = Rfa; data.Rb = Rb; data.Rc = Rc; data.Rfb = Rfb; data.V1 = V1; data.V2 = V2;
        parts.push({ q: 'Find the output of stage 1, $V_{o1}$.', answers: [A('Vo1', '$V_{o1}$', Vo1, 'V')], working: steps([first === 'inv' ? 'Stage 1 is inverting: $V_{o1}=-\\frac{R_{f1}}{R_1}V_1=-' + tn(Rfa / Ra) + '(' + sT(V1) + ')=' + sT(Vo1) + '$' : 'Stage 1 is non-inverting: $V_{o1}=(1+R_{f1}/R_1)V_1=' + tn(g1) + '(' + sT(V1) + ')=' + sT(Vo1) + '$']) + fin('V_{o1}=' + sT(Vo1)) });
        parts.push({ q: 'Find the final output $V_o$' + (dc ? '.' : ' (inputs in phase).'), answers: [A('Vo', '$V_o$', Vo, 'V')], working: steps([w2, 'Ideal stages do not load each other, so stage 1 output feeds stage 2 unchanged. ' + (dc ? '' : (Vo < 0 ? 'Negative result: 180° out of phase with the inputs.' : 'Positive result: in phase with the inputs.'))]) + fin('V_o=' + sT(Vo)) });
        var fig = opFig('casc', { first: first, second: v === 'invnon' ? 'non' : 'sum', Ra: rv('R_1', R(Ra)), Rfa: rv('R_{f1}', R(Rfa)), Rb: rv('R_3', R(Rb)), Rc: Rc ? rv('R_4', R(Rc)) : null, Rfb: rv('R_{f2}', R(Rfb)) });
        return {
          stem: 'Two ideal op-amps on $\\pm' + rail + '$ V are connected as shown. $V_1=' + sT(V1) + '$' + (V2 != null ? ' and $V_2=' + sT(V2) + '$.' : '.'),
          figure: fig, given: [g('$R_1$', Ra, 'Ω'), g('$R_{f1}$', Rfa, 'Ω'), g('$R_3$', Rb, 'Ω')].concat(Rc ? [g('$R_4$', Rc, 'Ω')] : [], [g('$R_{f2}$', Rfb, 'Ω')]),
          parts: parts, data: data, notes: trap('Work left to right and keep every sign: two inversions cancel on the $V_1$ path.')
        };
      });
    }
  });

  QB.add({
    id: 'edc.amp.opamp.design', course: 'edc', module: 'amp', topic: 'opamp',
    title: 'Choose resistors for a target op-amp gain', difficulty: 2, marks: 4,
    tags: ['design', 'op-amp'],
    variants: [{ id: 'inv', label: 'Inverting: find R_f' }, { id: 'non', label: 'Non-inverting: find R_1' }, { id: 'zin', label: 'Inverting with a required Z_i' }],
    gen: function (r, v) {
      return r.retry(function () {
        var A0 = r.pick([2.5, 4, 6, 8, 12, 15, 25, 30, 40, 50, 75, 100]), parts = [], data = { v: v, A: A0 }, stem, fig, given;
        if (v === 'inv' || v === 'zin') {
          var R1 = v === 'zin' ? pickE(r, 'E12', 4700, 100000) : pickE(r, 'E12', 1000, 22000), Rf = A0 * R1; if (Rf > 4.7e6) return null;
          var Rfs = nearestE(Rf), Aact = -Rfs / R1, Vi = r.nice(10, 100, 5) * 1e-3;
          data.R1 = R1; data.Vi = Vi;
          parts.push({ q: v === 'zin' ? 'The source requires $Z_i=' + te(R1, 'Ω') + '$. Choose $R_1$ and $R_f$.' : 'With $R_1=' + te(R1, 'Ω') + '$, find $R_f$.', answers: (v === 'zin' ? [A('R1', '$R_1$', R1, 'Ω')] : []).concat([A('Rf', '$R_f$', Rf, 'Ω')]),
            working: steps([v === 'zin' ? 'The − input is a virtual ground, so $Z_i=R_1$: $R_1=' + te(R1, 'Ω') + '$.' : '', '$|A_v|=R_f/R_1$, so $R_f=' + tn(A0) + '\\times' + kO(R1) + '\\,\\text{k}\\Omega=' + te(Rf, 'Ω') + '$.']) + fin('R_f=' + te(Rf, 'Ω')) });
          parts.push({ q: 'Using the nearest E12 value for $R_f$, find the actual gain and $V_o$ for $V_i=' + te(Vi, 'V') + '$ dc.', answers: [A('Aact', '$A_v$', Aact), A('Vo', '$V_o$', Aact * Vi, 'V')], working: steps(['Nearest E12: $R_f=' + te(Rfs, 'Ω') + '$, so $A_v=-' + kO(Rfs) + '/' + kO(R1) + '=' + tn(Aact) + '$.', '$V_o=' + tn(Aact) + '\\times' + te(Vi, 'V') + '=' + te(Aact * Vi, 'V') + '$.']) + fin('A_v=' + tn(Aact)) });
          stem = 'Design an inverting amplifier with $A_v=-' + tn(A0) + '$ using an ideal op-amp.';
          fig = opFig('inv', { R1: rv('R_1', v === 'zin' ? '?' : R(R1)), Rf: rv('R_f', '?') });
          given = [g('target $A_v$', '−' + F.num(A0, 3))].concat(v === 'zin' ? [g('$Z_i$', R1, 'Ω')] : [g('$R_1$', R1, 'Ω')]);
        } else {
          var Rf2 = pickE(r, 'E12', 10000, 470000), R1n = Rf2 / (A0 - 1), R1s = nearestE(R1n), Aact2 = 1 + Rf2 / R1s;
          data.Rf = Rf2;
          parts.push({ q: 'With $R_f=' + te(Rf2, 'Ω') + '$, find $R_1$.', answers: [A('R1', '$R_1$', R1n, 'Ω')], working: steps(['$A_v=1+R_f/R_1$, so $R_1=R_f/(A_v-1)=' + kO(Rf2) + '/' + tn(A0 - 1) + '=' + te(R1n, 'Ω') + '$.']) + fin('R_1=' + te(R1n, 'Ω')) });
          parts.push({ q: 'Using the nearest E12 value for $R_1$, find the actual gain and its error.', answers: [A('Aact', '$A_v$', Aact2), A('err', 'error', (Aact2 - A0) / A0 * 100, '%', { abs: 0.2 })], working: steps(['Nearest E12: $R_1=' + te(R1s, 'Ω') + '$, so $A_v=1+' + kO(Rf2) + '/' + kO(R1s) + '=' + tn(Aact2) + '$.', 'Error $=(' + tn(Aact2) + '-' + tn(A0) + ')/' + tn(A0) + '=' + tn((Aact2 - A0) / A0 * 100, 3) + '\\%$.']) + fin('A_v=' + tn(Aact2)) });
          stem = 'Design a non-inverting amplifier with $A_v=+' + tn(A0) + '$ using an ideal op-amp.';
          fig = opFig('non', { R1: rv('R_1', '?'), Rf: rv('R_f', R(Rf2)) });
          given = [g('target $A_v$', F.num(A0, 3)), g('$R_f$', Rf2, 'Ω')];
        }
        return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('A non-inverting stage needs $R_f/R_1=A_v-1$, not $A_v$.') };
      });
    }
  });

  /* ============================================================ POWER AMPLIFIERS (E13) */
  QB.add({
    id: 'edc.amp.power.classA', course: 'edc', module: 'amp', topic: 'power',
    title: 'Series-fed class A: P_i, P_o, efficiency and maximum output', difficulty: 2, marks: 6,
    tags: ['WS10 Q6', 'WS10 Q7', 'WS10 Q8', 'EX1 Q10a'],
    variants: [{ id: 'rms', label: 'rms base current' }, { id: 'peak', label: 'peak base current' }, { id: 'pp', label: 'peak-to-peak collector current' }, { id: 'max', label: 'maximum undistorted output' }],
    gen: function (r, v) {
      return r.retry(function () {
        var VCC = r.pick([12, 15, 18, 20, 24]), RC = r.pick([8.2, 10, 12, 15, 16, 18, 20, 22, 24, 27, 33]), beta = r.nice(25, 80, 5);
        var VCEt = r.float(0.35, 0.65, 2) * VCC, RB = nearestE((VCC - 0.7) * beta * RC / (VCC - VCEt), 'E24');
        var IB = (VCC - 0.7) / RB, ICQ = beta * IB, VCEQ = VCC - ICQ * RC; if (VCEQ < 0.25 * VCC || VCEQ > 0.8 * VCC) return null;
        var lim = Math.min(ICQ, VCC / RC - ICQ), Pi = VCC * ICQ, parts = [], data = { v: v, VCC: VCC, RC: RC, RB: RB, beta: beta };
        parts.push({ q: 'Find $I_{CQ}$ and $V_{CEQ}$.', answers: [A('ICQ', '$I_{CQ}$', ICQ, 'A'), A('VCEQ', '$V_{CEQ}$', VCEQ, 'V')], working: steps([M('I_B=\\frac{V_{CC}-0.7}{R_B}=\\frac{' + tn(VCC - 0.7) + '}{' + tn(RB) + '}=' + te(IB, 'A', 4) + ',\\qquad I_{CQ}=\\beta I_B=' + te(ICQ, 'A', 4)), M('V_{CEQ}=V_{CC}-I_{CQ}R_C=' + tn(VCC) + '-(' + tn(ICQ) + ')(' + tn(RC) + ')=' + tn(VCEQ) + '\\ \\text{V}\\quad(\\text{active})')]) + fin('I_{CQ}=' + te(ICQ, 'A') + ',\\quad V_{CEQ}=' + te(VCEQ, 'V')) });
        var Po, ws;
        if (v === 'max') {
          Po = lim * lim * RC / 2;
          ws = ['Largest undistorted collector-current peak: the smaller of $I_{CQ}=' + te(ICQ, 'A', 4) + '$ (cut-off) and $V_{CC}/R_C-I_{CQ}=' + te(VCC / RC - ICQ, 'A', 4) + '$ (saturation), so $I_c(p)=' + te(lim, 'A', 4) + '$.', M('P_o(\\max)=\\frac{I_c^2(p)}{2}R_C=\\frac{(' + tn(lim) + ')^2}{2}(' + tn(RC) + ')=' + te(Po, 'W'))];
        } else {
          var mult = v === 'rms' ? Math.SQRT2 : v === 'peak' ? 1 : 0.5, maxIb = 0.85 * lim / (beta * mult), step = v === 'pp' ? 0.01 : 0.0005;
          var x;
          if (v === 'pp') { x = Math.floor(0.85 * lim * 2 / 0.01) * 0.01 * r.float(0.4, 1, 2); x = Math.round(x * 100) / 100; if (x <= 0.02) return null; var Icpp = x; Po = Icpp * Icpp * RC / 8; data.Icpp = Icpp;
            ws = [M('P_o(\\text{ac})=\\frac{I_C^2(p\\text{-}p)}{8}R_C=\\frac{(' + tn(Icpp) + ')^2}{8}(' + tn(RC) + ')=' + te(Po, 'W')), 'Clipping check: peak $' + te(Icpp / 2, 'A') + '\\lt ' + te(lim, 'A') + '$, undistorted.']; }
          else { x = Math.floor(maxIb * r.float(0.4, 1, 2) / step) * step; if (x <= 0) return null; var Ic = beta * x; data.Ib = x;
            Po = v === 'rms' ? Ic * Ic * RC : Ic * Ic * RC / 2;
            ws = ['$I_c(' + (v === 'rms' ? '\\text{rms}' : 'p') + ')=\\beta I_b=' + tn(beta) + '(' + te(x, 'A') + ')=' + te(Ic, 'A') + '$', M(v === 'rms' ? 'P_o(\\text{ac})=I_C^2(\\text{rms})R_C=(' + tn(Ic) + ')^2(' + tn(RC) + ')=' + te(Po, 'W') : 'P_o(\\text{ac})=\\frac{I_C^2(p)}{2}R_C=\\frac{(' + tn(Ic) + ')^2}{2}(' + tn(RC) + ')=' + te(Po, 'W')), 'Clipping check: the collector-current peak $' + te(Ic * (v === 'rms' ? Math.SQRT2 : 1), 'A') + '$ is below $' + te(lim, 'A') + '$, so the output is undistorted.']; }
        }
        var eta = Po / Pi * 100;
        parts.push({ q: 'Find $P_i(\\text{dc})$ and $P_o(\\text{ac})$.', answers: [A('Pi', '$P_i$', Pi, 'W'), A('Po', '$P_o$', Po, 'W')], working: steps(['$P_i(\\text{dc})=V_{CC}I_{CQ}=' + tn(VCC) + '(' + tn(ICQ) + ')=' + te(Pi, 'W') + '$, fixed by the bias, not by the signal.'].concat(ws)) + fin('P_i=' + te(Pi, 'W') + ',\\quad P_o=' + te(Po, 'W')) });
        parts.push({ q: 'Find the efficiency and the transistor dissipation.', answers: [A('eta', '$\\eta$', eta, '%', { abs: 0.1 }), A('PQ', '$P_Q$', Pi - Po, 'W')], working: steps(['$\\eta=P_o/P_i=' + tn(eta, 3) + '\\%$ (at most 25% for series-fed class A).', '$P_Q=P_i-P_o=' + te(Pi - Po, 'W') + '$']) + fin('\\eta=' + tn(eta, 3) + '\\%') });
        var sigTxt = v === 'rms' ? 'a base current of $' + te(data.Ib, 'A') + '$ rms' : v === 'peak' ? 'a sinusoidal base current of $' + te(data.Ib, 'A') + '$ peak' : v === 'pp' ? 'a collector current swing of $' + te(data.Icpp, 'A') + '$ peak-to-peak' : 'the largest undistorted signal';
        return {
          stem: 'The series-fed class A amplifier below has $V_{CC}=' + te(VCC, 'V') + '$, $R_B=' + te(RB, 'Ω') + '$, $R_C=' + te(RC, 'Ω') + '$ and $\\beta=' + beta + '$. The input produces ' + sigTxt + '.',
          figure: S('bjtFixedBias', { VCC: V(VCC), RB: R(RB), RC: R(RC), beta: beta, C1: true, vi: true }),
          given: [g('$V_{CC}$', VCC, 'V'), g('$R_B$', RB, 'Ω'), g('$R_C$', RC, 'Ω'), g('$\\beta$', String(beta))],
          parts: parts, data: data, notes: trap('Do not mix rms, peak and peak-to-peak: $P=I_{rms}^2R=I_p^2R/2=I_{p\\text{-}p}^2R/8$.')
        };
      });
    }
  });

  QB.add({
    id: 'edc.amp.power.xfmr', course: 'edc', module: 'amp', topic: 'power',
    title: 'Transformer-coupled class A: turns ratio, P_o and efficiency', difficulty: 2, marks: 6,
    tags: ['WS10 Q9', 'E13 N4', 'EX2 Q11a'],
    variants: [{ id: 'ratio', label: 'Turns ratio for speakers' }, { id: 'swing', label: 'Power from the collector swings' }, { id: 'max', label: 'Maximum ideal output' }],
    gen: function (r, v) {
      return r.retry(function () {
        var parts = [], data = { v: v }, stem, given, RLs;
        var Rsp = r.pick([4, 8, 16]), N = r.pick([1, 2, 3, 4]), parl = r.bool(0.7);
        var RL = N === 1 ? Rsp : (parl ? Rsp / N : Rsp * N);
        var spk = N === 1 ? 'one $' + Rsp + '\\ \\Omega$ speaker' : N + ' $' + Rsp + '\\ \\Omega$ speakers in ' + (parl ? 'parallel' : 'series');
        var comb = N === 1 ? '$R_L=' + Rsp + '\\ \\Omega$.' : 'Combine the speakers first: $R_L=' + (parl ? Rsp + '/' + N : N + '\\times' + Rsp) + '=' + tn(RL) + '\\ \\Omega$.';
        data.Rsp = Rsp; data.N = N; data.parl = parl;
        if (v === 'ratio') {
          var Rp = pickE(r, 'E12', 1000, 10000), a = Math.sqrt(Rp / RL), V1 = r.nice(2, 20, 1);
          data.Rp = Rp; data.V1 = V1;
          parts.push({ q: 'Find the turns ratio $a=N_1/N_2$ so the load appears as $' + te(Rp, 'Ω') + '$ on the primary.', answers: [A('RL', '$R_L$', RL, 'Ω'), A('a', '$a$', a)], working: steps([comb, M('a=\\sqrt{\\frac{R_L\'}{R_L}}=\\sqrt{\\frac{' + tn(Rp) + '}{' + tn(RL) + '}}=' + tn(a)), 'A ' + tn(a) + ' : 1 step-down transformer (primary on the collector side).']) + fin('a=' + tn(a) + ':1') });
          parts.push({ q: 'If the primary signal is $' + te(V1, 'V') + '$ rms, find the secondary voltage and the load power.', answers: [A('V2', '$V_2$', V1 / a, 'V'), A('PL', '$P_L$', Math.pow(V1 / a, 2) / RL, 'W')], working: steps(['$V_2=V_1/a=' + te(V1 / a, 'V') + '$ rms', '$P_L=V_2^2/R_L=' + te(Math.pow(V1 / a, 2) / RL, 'W') + '$ (equal to $V_1^2/R_L\'$, as it must be).']) + fin('V_2=' + te(V1 / a, 'V')) });
          stem = 'A transformer-coupled class A stage drives ' + spk + '.';
          given = [g('Load', N + ' × ' + Rsp + ' Ω' + (N > 1 ? (parl ? ' in parallel' : ' in series') : '')), g("$R_L'$", Rp, 'Ω')];
          RLs = (N > 1 ? N + '×' : '') + Rsp + ' Ω';
        } else if (v === 'swing') {
          var VCC = r.pick([9, 12, 15, 18, 20, 24]), ICQ = r.nice(50, 500, 10) * 1e-3, VCEmin = r.nice(1, 3, 0.5), VCEmax = 2 * VCC - VCEmin - r.nice(0, 2, 0.5);
          var ICmin = r.nice(5, 0.2 * ICQ * 1e3, 5) * 1e-3, ICmax = 2 * ICQ - ICmin;
          var Po = (VCEmax - VCEmin) * (ICmax - ICmin) / 8, Pi = VCC * ICQ, eta = Po / Pi * 100, Rp2 = (VCEmax - VCEmin) / (ICmax - ICmin), a2 = Math.sqrt(Rp2 / RL);
          if (eta >= 50) return null;
          data.VCC = VCC; data.ICQ = ICQ; data.VCEmin = VCEmin; data.VCEmax = VCEmax; data.ICmin = ICmin; data.ICmax = ICmax;
          parts.push({ q: 'Find $P_o$, $P_i$ and $\\eta$.', answers: [A('Po', '$P_o$', Po, 'W'), A('Pi', '$P_i$', Pi, 'W'), A('eta', '$\\eta$', eta, '%', { abs: 0.1 })], working: steps([M('P_o=\\frac{(V_{CE\\max}-V_{CE\\min})(I_{C\\max}-I_{C\\min})}{8}=\\frac{(' + tn(VCEmax - VCEmin) + ')(' + tn(ICmax - ICmin) + ')}{8}=' + te(Po, 'W')), '$P_i=V_{CC}I_{CQ}=' + te(Pi, 'W') + '$', '$\\eta=' + tn(eta, 3) + '\\%$ (below the 50% limit).']) + fin('\\eta=' + tn(eta, 3) + '\\%') });
          parts.push({ q: 'Find the transistor dissipation, the effective load on the collector and the turns ratio.', answers: [A('PQ', '$P_Q$', Pi - Po, 'W'), A('Rp', "$R_L'$", Rp2, 'Ω'), A('a', '$a$', a2)], working: steps(['$P_Q=P_i-P_o=' + te(Pi - Po, 'W') + '$', "$R_L'=\\Delta V_{CE}/\\Delta I_C=" + tn(VCEmax - VCEmin) + '/' + tn(ICmax - ICmin) + '=' + te(Rp2, 'Ω') + '$', comb + ' $a=\\sqrt{R_L\'/R_L}=' + tn(a2) + '$.']) + fin('a=' + tn(a2) + ':1') });
          stem = 'A transformer-coupled class A amplifier runs from $V_{CC}=' + te(VCC, 'V') + '$ with $I_{CQ}=' + te(ICQ, 'A') + '$. The signal swings $V_{CE}$ from $' + te(VCEmin, 'V') + '$ to $' + te(VCEmax, 'V') + '$ and $I_C$ from $' + te(ICmin, 'A') + '$ to $' + te(ICmax, 'A') + '$. The load is ' + spk + '.';
          given = [g('$V_{CC}$', VCC, 'V'), g('$I_{CQ}$', ICQ, 'A'), g('$V_{CE}$ swing', V(VCEmin) + ' to ' + V(VCEmax)), g('$I_C$ swing', pe(ICmin, 'A') + ' to ' + pe(ICmax, 'A'))];
        } else {
          var VCC3 = r.pick([9, 12, 15, 18, 24]), ICQ3 = r.nice(50, 400, 10) * 1e-3, Rp3 = VCC3 / ICQ3, a3 = Math.sqrt(Rp3 / RL), Pi3 = VCC3 * ICQ3, Po3 = Pi3 / 2;
          data.VCC = VCC3; data.ICQ = ICQ3;
          parts.push({ q: "For the largest symmetric swing the reflected load must be $R_L'=V_{CC}/I_{CQ}$. Find $R_L'$ and the turns ratio.", answers: [A('Rp', "$R_L'$", Rp3, 'Ω'), A('a', '$a$', a3)], working: steps(["$R_L'=V_{CC}/I_{CQ}=" + tn(VCC3) + '/' + tn(ICQ3) + '=' + te(Rp3, 'Ω') + '$', comb, M('a=\\sqrt{R_L\'/R_L}=\\sqrt{' + tn(Rp3) + '/' + tn(RL) + '}=' + tn(a3))]) + fin('a=' + tn(a3) + ':1') });
          parts.push({ q: 'Find the maximum ideal output power, $P_i$ and the efficiency at that point.', answers: [A('Po', '$P_o(\\max)$', Po3, 'W'), A('Pi', '$P_i$', Pi3, 'W'), A('eta', '$\\eta$', 50, '%', { abs: 0.1 })], working: steps(['The collector swings from about 0 to $2V_{CC}$ and the current from 0 to $2I_{CQ}$:' + M('P_o(\\max)=\\frac{(2V_{CC})(2I_{CQ})}{8}=\\tfrac12V_{CC}I_{CQ}=' + te(Po3, 'W')), '$P_i=V_{CC}I_{CQ}=' + te(Pi3, 'W') + '$, so $\\eta=50\\%$, the class A transformer-coupled maximum.']) + fin('P_o=' + te(Po3, 'W') + ',\\ \\eta=50\\%') });
          stem = 'A transformer-coupled class A amplifier runs from $V_{CC}=' + te(VCC3, 'V') + '$ with $I_{CQ}=' + te(ICQ3, 'A') + '$ and drives ' + spk + '.';
          given = [g('$V_{CC}$', VCC3, 'V'), g('$I_{CQ}$', ICQ3, 'A'), g('Load', N + ' × ' + Rsp + ' Ω' + (N > 1 ? (parl ? ' in parallel' : ' in series') : ''))];
        }
        var fig = xfmrFig({ VCC: data.VCC ? V(data.VCC) : null, RL: N === 1 ? R(Rsp) : (N + ' × ' + Rsp + ' Ω' + (parl ? ' ∥' : ' series')), RB: null });
        return { stem: stem, figure: fig, given: given, parts: parts, data: data, notes: trap('Combine parallel speakers first, then $a=\\sqrt{R_L\'/R_L}$ (primary to secondary), not the inverse.') };
      });
    }
  });

  QB.add({
    id: 'edc.amp.power.classB', course: 'edc', module: 'amp', topic: 'power',
    title: 'Class B push-pull: P_i, P_o, efficiency and worst-case dissipation', difficulty: 2, marks: 7,
    tags: ['WS10 Q10', 'E13 N5', 'EX2 Q11b', 'exam-style'],
    variants: [{ id: 'peak', label: 'Given peak output' }, { id: 'rms', label: 'Given rms output' }, { id: 'max', label: 'Maximum ratings' }, { id: 'worst', label: 'Worst-case transistor dissipation' }],
    gen: function (r, v) {
      var VCC = r.pick([12, 15, 18, 20, 24, 25, 30]), RL = r.pick([4, 8, 16]), parts = [], data = { v: v, VCC: VCC, RL: RL };
      var stem = 'A class B complementary push-pull amplifier runs from $\\pm' + te(VCC, 'V') + '$ and drives $R_L=' + RL + '\\ \\Omega$ directly.';
      if (v === 'peak' || v === 'rms') {
        var VLp, VLr;
        if (v === 'peak') VLp = r.nice(0.3 * VCC, 0.95 * VCC, 0.5); else { VLr = r.nice(0.25 * VCC, 0.65 * VCC, 0.5); VLp = VLr * Math.SQRT2; }
        data.VLp = v === 'peak' ? VLp : null; data.VLr = VLr || null;
        var Ip = VLp / RL, Pi = 2 * VCC * Ip / PI, Po = VLp * VLp / (2 * RL), eta = Po / Pi * 100, P2Q = Pi - Po;
        stem += v === 'peak' ? ' The output is a sine wave of $' + te(VLp, 'V') + '$ peak.' : ' The output is a sine wave of $' + te(VLr, 'V') + '$ rms.';
        parts.push({ q: 'Find the peak load current $I_p$, $P_i(\\text{dc})$ and $P_o(\\text{ac})$.', answers: [A('Ip', '$I_p$', Ip, 'A'), A('Pi', '$P_i$', Pi, 'W'), A('Po', '$P_o$', Po, 'W')],
          working: steps([v === 'rms' ? '$V_L(p)=\\sqrt2\\,V_L(\\text{rms})=' + te(VLp, 'V', 4) + '$.' : '', '$I_p=V_L(p)/R_L=' + tn(VLp) + '/' + RL + '=' + te(Ip, 'A', 4) + '$',
            'The supply sees a full-wave current of average $\\tfrac2\\pi I_p$:' + M('P_i=\\frac{2V_{CC}I_p}{\\pi}=\\frac{2(' + tn(VCC) + ')(' + tn(Ip) + ')}{\\pi}=' + te(Pi, 'W', 4)), M('P_o=\\frac{V_L^2(p)}{2R_L}=\\frac{(' + tn(VLp) + ')^2}{2(' + RL + ')}=' + te(Po, 'W', 4))]) + fin('P_i=' + te(Pi, 'W') + ',\\quad P_o=' + te(Po, 'W')) });
        parts.push({ q: 'Find the efficiency and the dissipation in each transistor.', answers: [A('eta', '$\\eta$', eta, '%', { abs: 0.1 }), A('PQ', '$P_Q$ each', P2Q / 2, 'W')], working: steps(['$\\eta=P_o/P_i=' + tn(eta, 3) + '\\%$. Check: $\\frac\\pi4\\frac{V_L(p)}{V_{CC}}=' + tn(PI / 4 * VLp / VCC * 100, 3) + '\\%$.', '$P_{2Q}=P_i-P_o=' + te(P2Q, 'W') + '$ for both, so $P_Q=' + te(P2Q / 2, 'W') + '$ each.']) + fin('\\eta=' + tn(eta, 3) + '\\%,\\quad P_Q=' + te(P2Q / 2, 'W')) });
      } else if (v === 'max') {
        var Pim = 2 * VCC * VCC / (PI * RL), Pom = VCC * VCC / (2 * RL);
        parts.push({ q: 'Find the maximum input power, the maximum output power and the maximum efficiency.', answers: [A('Pi', '$P_i(\\max)$', Pim, 'W'), A('Po', '$P_o(\\max)$', Pom, 'W'), A('eta', '$\\eta_{\\max}$', 78.54, '%', { abs: 0.1 })],
          working: steps(['Maximum output means $V_L(p)=V_{CC}$, $I_p=V_{CC}/R_L=' + te(VCC / RL, 'A', 4) + '$.', M('P_i(\\max)=\\frac{2V_{CC}^2}{\\pi R_L}=\\frac{2(' + tn(VCC) + ')^2}{\\pi(' + RL + ')}=' + te(Pim, 'W', 4)), M('P_o(\\max)=\\frac{V_{CC}^2}{2R_L}=' + te(Pom, 'W', 4)), '$\\eta_{\\max}=P_o/P_i=\\pi/4=78.54\\%$.']) + fin('\\eta_{\\max}=78.54\\%') });
        parts.push({ q: 'What is the total transistor dissipation at that maximum output?', answers: [A('P2Q', '$P_{2Q}$', Pim - Pom, 'W')], working: steps(['$P_{2Q}=P_i-P_o=' + te(Pim - Pom, 'W') + '$. This is <b>not</b> the worst case: dissipation peaks at $V_L(p)\\approx0.636V_{CC}$.']) + fin('P_{2Q}=' + te(Pim - Pom, 'W')) });
      } else {
        var P2m = 2 * VCC * VCC / (PI * PI * RL), VLw = 2 * VCC / PI;
        parts.push({ q: 'Find the worst-case total transistor dissipation, the dissipation per transistor, and the peak output voltage at which it occurs.', answers: [A('P2Q', '$P_{2Q}(\\max)$', P2m, 'W'), A('PQ', '$P_Q$ each', P2m / 2, 'W'), A('VLp', '$V_L(p)$', VLw, 'V')],
          working: steps(['$P_{2Q}=\\frac{2V_{CC}V_L(p)}{\\pi R_L}-\\frac{V_L^2(p)}{2R_L}$ is largest where its derivative is zero, at $V_L(p)=2V_{CC}/\\pi=' + te(VLw, 'V', 4) + '$.', M('P_{2Q}(\\max)=\\frac{2V_{CC}^2}{\\pi^2R_L}=\\frac{2(' + tn(VCC) + ')^2}{\\pi^2(' + RL + ')}=' + te(P2m, 'W', 4)), 'Each transistor: $' + te(P2m / 2, 'W') + '$.']) + fin('P_{2Q}(\\max)=' + te(P2m, 'W')) });
        parts.push({ q: 'Find the efficiency at that operating point.', answers: [A('eta', '$\\eta$', 50, '%', { abs: 0.1 })], working: steps(['$\\eta=\\frac\\pi4\\frac{V_L(p)}{V_{CC}}=\\frac\\pi4\\cdot\\frac2\\pi=50\\%$.', 'Heatsinks must be sized for this point, not for full output.']) + fin('\\eta=50\\%') });
      }
      return { stem: stem, figure: classBFig({ VCC: V(VCC), RL: RL + ' Ω' }), given: [g('$V_{CC}$', VCC, 'V'), g('$R_L$', RL, 'Ω')], parts: parts, data: data,
        notes: trap('Maximum transistor dissipation does not occur at maximum output; and $P_{2Q}$ is for both transistors together.') };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

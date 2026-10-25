/* bank-dsp-1.js — DSP question bank, part 1 (ENGE3000)
 * =============================================================================
 * Modules covered:
 *   sig  : sampling, seq, adc, props, corr, lccde, conv          (packs D1, D2)
 *   freq : dtft, dtftprop, freqresp, pzgeom, dft, circconv,
 *          spectral, block                                       (packs D3–D6)
 * Conventions (ctx_D.md): uppercase F, Ω for continuous time; lowercase f, ω
 * for discrete time. sinc x = sin x / x. H(ω) is the course's notation for the
 * frequency response H(e^{jω}). Correlation r_xy(l) = Σ x(n) y(n−l) (L03).
 * Every generator only calls QB.add. Figures: QB.plot.stem when present
 * (guarded), otherwise a built-in stem plot; pole-zero and block figures are
 * drawn here (they need vectors / custom blocks not in the SPEC list).
 * Each Q carries q.data (raw parameters) so tests can recompute answers.
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB, R = String.raw, PI = Math.PI;

  /* ------------------------------------------------------------ registry */
  /** inside $..$ / $$..$$ only: '<' and '>' become \lt / \gt so the HTML parser never sees a tag */
  function sanit(s) {
    if (typeof s !== 'string') return s;
    return s.replace(/<svg[\s\S]*?<\/svg>|\$\$[\s\S]*?\$\$|\$[^$]*\$/g, function (m) { return m.charAt(0) === '<' ? m : m.replace(/</g, '\\lt ').replace(/>/g, '\\gt '); });
  }
  function add(mod, topic, slug, o) {
    o.id = 'dsp.' + mod + '.' + topic + '.' + slug;
    o.course = 'dsp'; o.module = mod; o.topic = topic;
    var g = o.gen;
    o.gen = function (r, v) {
      var q = g(r, v);
      q.stem = sanit(q.stem); q.notes = sanit(q.notes);
      (q.given || []).forEach(function (gv) { gv[0] = sanit(gv[0]); gv[1] = sanit(gv[1]); });
      (q.parts || []).forEach(function (p) { p.q = sanit(p.q); p.working = sanit(p.working); (p.answers || []).forEach(function (a) { a.label = sanit(a.label); }); });
      return q;
    };
    QB.add(o);
  }

  /* ------------------------------------------------------------ numbers */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }
  function cl(x) { return Math.abs(x) < 1e-10 ? 0 : x; }
  /** TeX number: integers exact, otherwise sig significant digits, trailing zeros dropped */
  function F(x, sig) {
    sig = sig || 4;
    if (!isFinite(x)) return '?';
    if (Math.abs(x) < 1e-10) return '0';
    var r = Math.round(x);
    if (Math.abs(x - r) < 1e-9 * Math.max(1, Math.abs(x))) return String(r);
    var s = String(parseFloat(x.toPrecision(sig)));
    if (/e/.test(s)) return QB.fmt.tex.num(x, sig);
    return s;
  }
  /** plain-text number for SVG labels (unicode minus) */
  function Fu(x, sig) { return F(x, sig || 3).replace(/^-/, '−'); }
  /** parenthesise negative numbers */
  function Fp(x, sig) { var s = F(x, sig); return x < 0 && s !== '0' ? '(' + s + ')' : s; }
  /** join [coef, body] terms into a signed TeX sum */
  function J(terms, sig) {
    var out = '';
    terms.forEach(function (t) {
      var c = t[0], b = t[1] || '';
      if (Math.abs(c) < 1e-12) return;
      var neg = c < 0, a = Math.abs(c), s = (b && Math.abs(a - 1) < 1e-12) ? '' : F(a, sig);
      out += (out ? (neg ? ' - ' : ' + ') : (neg ? '-' : '')) + s + b;
    });
    return out || '0';
  }
  /** angle as a fraction of π (TeX) */
  function P(w) {
    var k = w / PI;
    for (var q = 1; q <= 24; q++) {
      var p = Math.round(k * q);
      if (Math.abs(k * q - p) < 1e-7) {
        if (p === 0) return '0';
        var g = gcd(p, q); p /= g; var qq = q / g;
        var sg = p < 0 ? '-' : ''; p = Math.abs(p);
        if (qq === 1) return sg + (p === 1 ? '' : p) + '\\pi';
        return sg + '\\frac{' + (p === 1 ? '' : p) + '\\pi}{' + qq + '}';
      }
    }
    return F(k, 4) + '\\pi';
  }
  /** angle as a decimal multiple of π (0.8\pi style used in L02) */
  function Pd(w) { var k = cl(w / PI); if (k === 0) return '0'; var s = F(k, 4); return (s === '1' ? '' : s === '-1' ? '-' : s) + '\\pi'; }
  /** a fraction p/q in TeX (reduced), for coefficients like 1/4 */
  function Fr(x) {
    for (var q = 1; q <= 64; q++) { var p = Math.round(x * q); if (Math.abs(x * q - p) < 1e-9) { if (q === 1) return String(p); var g = gcd(p, q); return (p < 0 ? '-' : '') + '\\tfrac{' + Math.abs(p / g) + '}{' + q / g + '}'; } }
    return F(x, 4);
  }
  function deg(w) { return w * 180 / PI; }
  function wrapPi(w) { var x = w - 2 * PI * Math.round(w / (2 * PI)); if (x <= -PI + 1e-12) x += 2 * PI; return x; }
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }

  /* ------------------------------------------------------------ sequences */
  /** sequence object {v:[...], n0} ; value at n */
  function at(s, n) { var i = n - s.n0; return (i >= 0 && i < s.v.length) ? s.v[i] : 0; }
  function trim(s) {
    var v = s.v.slice(), n0 = s.n0;
    while (v.length > 1 && Math.abs(v[0]) < 1e-12) { v.shift(); n0++; }
    while (v.length > 1 && Math.abs(v[v.length - 1]) < 1e-12) v.pop();
    if (v.length === 1 && Math.abs(v[0]) < 1e-12) n0 = 0;
    return { v: v, n0: n0 };
  }
  /** TeX sequence with the ↑ under n = 0 */
  function seqT(s, sig) {
    var v = s.v, n0 = s.n0;
    var parts = v.map(function (x, i) { var t = F(x, sig || 4); if (x < 0 && t !== '0') t = '{' + t + '}'; return (n0 + i === 0) ? '\\underset{\\uparrow}{' + t + '}' : t; });
    var out = '\\{' + parts.join(',\\ ') + '\\}';
    if (n0 > 0 || n0 + v.length - 1 < 0) out += '\\ (n=' + n0 + ',\\dots,' + (n0 + v.length - 1) + ')';
    return out;
  }
  function conv(a, b) { var y = []; for (var i = 0; i < a.length + b.length - 1; i++) y.push(0); a.forEach(function (x, i) { b.forEach(function (h, j) { y[i + j] += x * h; }); }); return y.map(cl); }
  function convS(x, h) { return { v: conv(x.v, h.v), n0: x.n0 + h.n0 }; }
  function pad(a, N) { var o = a.slice(0, N); while (o.length < N) o.push(0); return o; }
  function circ(a, b, N) { var A = pad(a, N), B = pad(b, N), y = []; for (var n = 0; n < N; n++) { var s = 0; for (var m = 0; m < N; m++) s += A[m] * B[((n - m) % N + N) % N]; y.push(cl(s)); } return y; }
  function wrapN(y, N) { var o = pad([], N); y.forEach(function (v, i) { o[i % N] += v; }); return o.map(cl); }
  function dft(x, N) { var X = []; for (var k = 0; k < N; k++) { var z = QB.cx(0, 0); for (var n = 0; n < x.length; n++) z = z.add(QB.cx.polar(x[n], -360 * k * n / N)); X.push(QB.cx(cl(z.re), cl(z.im))); } return X; }
  function idft(X, N) { var x = []; for (var n = 0; n < N; n++) { var z = QB.cx(0, 0); for (var k = 0; k < N; k++) z = z.add(X[k].mul(QB.cx.polar(1, 360 * k * n / N))); x.push(QB.cx(cl(z.re / N), cl(z.im / N))); } return x; }
  /** DTFT of a finite sequence at ω */
  function dtft(s, w) { var z = QB.cx(0, 0); s.v.forEach(function (x, i) { z = z.add(QB.cx.polar(x, -deg(w) * (s.n0 + i))); }); return z; }
  /** polynomial in e^{-jω}: Σ c_k e^{-jkω} */
  function polyE(c, w) { var z = QB.cx(0, 0); c.forEach(function (x, k) { z = z.add(QB.cx.polar(x, -deg(w) * k)); }); return z; }
  function cxT(z, sig) { return QB.fmt.cx(QB.cx(cl(z.re), cl(z.im)), sig || 4); }
  function randSeq(r, len, lo, hi, nz) {
    return r.retry(function () {
      var v = []; for (var i = 0; i < len; i++) v.push(r.int(lo, hi));
      if (v[0] === 0 || v[len - 1] === 0) return null;
      if (nz && v.some(function (x) { return x === 0; })) return null;
      return v;
    }, 200);
  }

  /* ------------------------------------------------------------ answers */
  function nA(label, v, unit, o) { var a = { label: label, value: cl(v), unit: unit || '' }; if (o) for (var k in o) a[k] = o[k]; return a; }
  function iA(label, v, unit, o) { return nA(label, Math.round(v), unit, Object.assign({ tol: 0, abs: 0.01, sig: 6 }, o || {})); }
  function sA(label, v, o) { return nA(label, v, '', Object.assign({ tol: 0.01, abs: 0.005, sig: 4 }, o || {})); }
  function bA(label, b) { return { label: label, value: b ? 1 : 0, unit: '', tol: 0, abs: 0.1, sig: 1, hint: '1 = yes, 0 = no' }; }
  function rA(label, w, o) {
    var a = nA(label, w, 'rad', Object.assign({ tol: 0.005, abs: 0.012, sig: 3 }, o || {}));
    if (Math.abs(Math.abs(w) - PI) < 0.03) a.alt = [-w];
    return a;
  }
  function yes(b) { return b ? '<b>Yes</b>' : '<b>No</b>'; }

  /* ------------------------------------------------------------ figures */
  var INK = '#1a1a1a', FONT = 'Arial, Helvetica, sans-serif';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /** built-in stem plot (used when QB.plot.stem is absent) */
  function ownStem(p) {
    var v = p.v, n = v.length, dx = 28, x0 = 40, top = 22, H = 96;
    var pos = Math.max(0, Math.max.apply(null, v)), neg = Math.max(0, -Math.min.apply(null, v));
    var tot = (pos + neg) || 1, sc = H / tot, yz = top + H * pos / tot;
    var W = x0 + dx * n + 28, Ht = top + H + 34;
    var o = [];
    o.push('<line x1="' + (x0 - 14) + '" y1="' + yz + '" x2="' + (x0 + dx * n + 4) + '" y2="' + yz + '" stroke="' + INK + '" stroke-width="1"/>');
    o.push('<path d="M' + (x0 + dx * n + 4) + ' ' + (yz - 3.5) + 'L' + (x0 + dx * n + 11) + ' ' + yz + 'L' + (x0 + dx * n + 4) + ' ' + (yz + 3.5) + 'Z" fill="' + INK + '"/>');
    o.push('<text x="' + (x0 + dx * n + 13) + '" y="' + (yz + 4) + '" font-size="12" font-style="italic">' + esc(p.xl || 'n') + '</text>');
    v.forEach(function (val, i) {
      var x = x0 + dx * i + 6, y = yz - val * sc;
      if (Math.abs(val) > 1e-12) {
        o.push('<line x1="' + x + '" y1="' + yz + '" x2="' + x + '" y2="' + y.toFixed(1) + '" stroke="#215f9f" stroke-width="1.8"/>');
        o.push('<circle cx="' + x + '" cy="' + y.toFixed(1) + '" r="3.3" fill="#215f9f"/>');
        var ly = val > 0 ? y - 6 : y + 13;
        o.push('<text x="' + x + '" y="' + ly.toFixed(1) + '" font-size="10" text-anchor="middle">' + esc(Fu(val, 3)) + '</text>');
      } else {
        o.push('<circle cx="' + x + '" cy="' + yz + '" r="2.6" fill="#fff" stroke="#215f9f" stroke-width="1.2"/>');
      }
      var nn = p.n0 + i;
      o.push('<text x="' + x + '" y="' + (top + H + 26) + '" font-size="10" text-anchor="middle"' + (nn === 0 ? ' font-weight="bold"' : '') + '>' + esc(Fu(nn)) + '</text>');
    });
    o.push('<line x1="' + (x0 - 14) + '" y1="' + (top + H + 14) + '" x2="' + (x0 + dx * n + 4) + '" y2="' + (top + H + 14) + '" stroke="#bbb" stroke-width="0.6"/>');
    var lab = esc(p.label || 'x(n)').replace(/_\{([^}]*)\}|_(.)/g, function (m, a, b) { return '<tspan baseline-shift="sub" font-size="9">' + (a || b) + '</tspan>'; });
    o.push('<text x="6" y="14" font-size="12" font-style="italic">' + lab + '</text>');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + Ht + '" width="' + W + '" height="' + Ht + '" font-family="' + FONT + '"><rect width="' + W + '" height="' + Ht + '" fill="#fff"/><g fill="' + INK + '">' + o.join('') + '</g></svg>';
  }
  function cat(svgs, vertical) {
    var off = 0, W = 0, H = 0, parts = [];
    svgs.forEach(function (s) {
      var m = s.match(/viewBox="\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/);
      var w = m ? +m[3] : 300, h = m ? +m[4] : 160;
      var open = s.match(/^\s*<svg[^>]*>/)[0];
      var x = vertical ? 0 : off, y = vertical ? off : 0;
      var nopen = open.replace(/\s(width|height|x|y)="[^"]*"/g, '').replace(/^\s*<svg/, '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"');
      parts.push(nopen + s.trim().slice(open.trim().length));
      if (vertical) { off += h + 8; W = Math.max(W, w); H = off - 8; } else { off += w + 14; H = Math.max(H, h); W = off - 14; }
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"><rect width="' + W + '" height="' + H + '" fill="#fff"/>' + parts.join('') + '</svg>';
  }
  /** stem figure; panels = [{v, n0, label}] */
  function stemFig(panels) {
    var svgs = panels.map(function (p) {
      var s = null;
      if (QB.plot && typeof QB.plot.stem === 'function') {
        try { s = QB.plot.stem(p.v.map(function (_, i) { return p.n0 + i; }), p.v.slice(), { ylabel: p.label, xlabel: p.xl || 'n', values: p.v.length <= 9 && p.v.every(function (a) { return F(a, 3).replace('-', '').length <= 4; }), n0: true }); } catch (e) { s = null; }
      }
      if (typeof s !== 'string' || s.trim().indexOf('<svg') !== 0 || /NaN|undefined|Infinity/.test(s)) s = ownStem(p);
      return s;
    });
    if (svgs.length === 1) return svgs[0];
    var tw = 0; svgs.forEach(function (s) { var m = s.match(/viewBox="[^"]*?([\d.]+)\s+([\d.]+)\s*"/); tw += m ? +m[1] : 300; });
    return cat(svgs, tw > 660);
  }
  /** pole-zero plot with optional vectors to e^{jω0} */
  function pzFig(o) {
    var S = 230, c = S / 2, Rr = 78, sc = Rr;
    function X(z) { return (c + z[0] * sc).toFixed(1); }
    function Y(z) { return (c - z[1] * sc).toFixed(1); }
    var g = [];
    g.push('<line x1="10" y1="' + c + '" x2="' + (S - 10) + '" y2="' + c + '" stroke="#999" stroke-width="0.8"/>');
    g.push('<line x1="' + c + '" y1="10" x2="' + c + '" y2="' + (S - 10) + '" stroke="#999" stroke-width="0.8"/>');
    g.push('<circle cx="' + c + '" cy="' + c + '" r="' + Rr + '" fill="none" stroke="' + INK + '" stroke-width="1" stroke-dasharray="4 3"/>');
    g.push('<text x="' + (S - 24) + '" y="' + (c + 16) + '" font-size="11">Re</text><text x="' + (c + 5) + '" y="20" font-size="11">Im</text>');
    g.push('<text x="' + (c + Rr - 9) + '" y="' + (c + 15) + '" font-size="10">1</text>');
    var pt = o.w0 != null ? [Math.cos(o.w0), Math.sin(o.w0)] : null;
    if (pt && o.vectors !== false) {
      (o.zeros || []).concat(o.poles || []).forEach(function (z) {
        g.push('<line x1="' + X(z) + '" y1="' + Y(z) + '" x2="' + X(pt) + '" y2="' + Y(pt) + '" stroke="#a33" stroke-width="1" stroke-dasharray="3 2"/>');
      });
    }
    var cnt = {};
    function key(z) { return z[0].toFixed(3) + ',' + z[1].toFixed(3); }
    (o.zeros || []).forEach(function (z) { var k = 'z' + key(z); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] === 1) g.push('<circle cx="' + X(z) + '" cy="' + Y(z) + '" r="5" fill="#fff" stroke="#215f9f" stroke-width="1.8"/>'); });
    (o.poles || []).forEach(function (z) { var k = 'p' + key(z); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] === 1) { var x = +X(z), y = +Y(z); g.push('<path d="M' + (x - 5) + ' ' + (y - 5) + 'L' + (x + 5) + ' ' + (y + 5) + 'M' + (x - 5) + ' ' + (y + 5) + 'L' + (x + 5) + ' ' + (y - 5) + '" stroke="#a85a18" stroke-width="2"/>'); } });
    Object.keys(cnt).forEach(function (k) { if (cnt[k] > 1) { var p = k.slice(1).split(',').map(Number); g.push('<text x="' + (+X(p) + 7) + '" y="' + (+Y(p) - 6) + '" font-size="10">(' + cnt[k] + ')</text>'); } });
    if (pt) { g.push('<circle cx="' + X(pt) + '" cy="' + Y(pt) + '" r="3.2" fill="#a33"/>'); g.push('<text x="' + (+X(pt) + 6) + '" y="' + (+Y(pt) - 6) + '" font-size="11" fill="#a33">e<tspan dy="-5" font-size="8">jω₀</tspan></text>'); }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + S + ' ' + S + '" width="' + S + '" height="' + S + '" font-family="' + FONT + '"><rect width="' + S + '" height="' + S + '" fill="#fff"/>' + g.join('') + '</svg>';
  }
  /** guarded call of a template that may not exist yet */
  function tpl(name, opts) {
    var f = QB.sch && QB.sch[name];
    if (typeof f !== 'function') return null;
    try { var s = f(opts); return (typeof s === 'string' && s.trim().indexOf('<svg') === 0 && !/NaN|undefined|Infinity/.test(s)) ? s : null; } catch (e) { return null; }
  }
  /** our own block diagram: chain of items {box:'label'} or {split:[[...],[...]], signs:['+','−']} */
  function blockFig(spec) {
    try {
      var d = QB.sch.drawing();
      var y = 0, x = 0;
      d.terminal([x, y], { label: 'x(n)', side: 'left' });
      var here = [x, y];
      spec.forEach(function (it) {
        if (it.box) {
          d.wire({ from: here, to: [here[0] + 30, y], arrow: 'end' });
          var b = d.box({ at: [here[0] + 30, y], anchor: 'in', label: it.box });
          here = b.out;
        } else if (it.split) {
          var sx = here[0] + 20;
          d.wire({ from: here, to: [sx, y] }); d.dot([sx, y]);
          var rows = it.split, gap = 56, ys = rows.map(function (_, i) { return y + (i - (rows.length - 1) / 2) * gap; });
          var ends = [], maxx = sx;
          rows.forEach(function (row, i) {
            var p = [sx, ys[i]];
            if (ys[i] !== y) d.wire({ from: [sx, y], to: p });
            if (!row.length) { ends.push(p); return; }
            row.forEach(function (lab) { d.wire({ from: p, to: [p[0] + 26, ys[i]], arrow: 'end' }); var b = d.box({ at: [p[0] + 26, ys[i]], anchor: 'in', label: lab }); p = b.out; });
            ends.push(p); maxx = Math.max(maxx, p[0]);
          });
          var cx = maxx + 40;
          var sm = d.sum({ at: [cx, y], r: 11 });
          rows.forEach(function (row, i) {
            var p = ends[i], sg = (it.signs && it.signs[i]) || '+';
            if (ys[i] < y) { d.wire({ from: p, to: [cx, ys[i]] }); d.wire({ from: [cx, ys[i]], to: sm.top, arrow: 'end' }); d.label([cx + 9, sm.top[1] - 9], sg === '-' ? '−' : '+', { plain: true, size: 12 }); }
            else if (ys[i] > y) { d.wire({ from: p, to: [cx, ys[i]] }); d.wire({ from: [cx, ys[i]], to: sm.bottom, arrow: 'end' }); d.label([cx + 9, sm.bottom[1] + 10], sg === '-' ? '−' : '+', { plain: true, size: 12 }); }
            else { d.wire({ from: p, to: sm.left, arrow: 'end' }); d.label([sm.left[0] - 8, y - 10], sg === '-' ? '−' : '+', { plain: true, size: 12 }); }
          });
          here = sm.right;
        }
      });
      d.wire({ from: here, to: [here[0] + 34, y], arrow: 'end' });
      d.label([here[0] + 38, y], 'y(n)', { anchor: 'start' });
      var s = d.svg({ scale: 1.15 });
      return /NaN|undefined|Infinity/.test(s) ? null : s;
    } catch (e) { return null; }
  }

  /* =====================================================================
   * sig.sampling — Sampling and aliasing (D1 Playbook A; T1 Q2; Sample Test Q1)
   * ===================================================================== */
  function trig(t, arg) { return '\\' + t + '(' + arg + ')'; }
  function Ft(Fq) { return F(2 * Fq) + '\\pi t'; }

  add('sig', 'sampling', 'alias-recon', {
    title: 'Two-tone sampling, aliasing and ideal D/A output',
    difficulty: 2, marks: 5,
    variants: [{ id: 'sin', label: 'Aliased tone is a sine (sign flips)' }, { id: 'cos', label: 'Aliased tone is a cosine' }, { id: 'ok', label: 'Adequate F_s (no aliasing)' }],
    tags: ['exam-style', 'Sample Test Q1', 'T1 Q2', 'DX1 Q1'],
    gen: function (r, v) {
      var Fs = r.pick([200, 400, 500, 600, 800, 1000, 1200, 1600, 2000]);
      var d = r.retry(function () {
        var p = r.int(1, 9), q = v === 'ok' ? r.int(1, 9) : r.int(11, 29);
        if (q === 20 || q === p) return null;
        var t1 = r.pick(['cos', 'sin']), t2 = v === 'sin' ? 'sin' : v === 'cos' ? 'cos' : r.pick(['cos', 'sin']);
        if (v === 'sin' && q > 20 && r.bool(0.7)) return null; /* q < 20 folds to a negative frequency: sign flip */
        var A1 = r.int(1, 5), A2 = r.int(1, 5);
        var F1 = Fs * p / 20, F2 = Fs * q / 20;
        if (F1 % 1 || F2 % 1) return null;
        var q2 = q - 20 * Math.round(q / 20);
        if (Math.abs(q2) === 10) return null;
        var c2 = (t2 === 'sin' && q2 < 0) ? -A2 : A2, k2 = Math.abs(q2);
        var merged = (t1 === t2 && k2 === p);
        if (merged && A1 + c2 === 0) return null;
        return { Fs: Fs, p: p, q: q, q2: q2, k2: k2, t1: t1, t2: t2, A1: A1, A2: A2, F1: F1, F2: F2, c2: c2, merged: merged };
      });
      var Fmax = Math.max(d.F1, d.F2), Ny = 2 * Fmax, ok = Fs > Ny;
      var w1 = d.p * PI / 10, w2u = d.q * PI / 10, w2 = d.q2 * PI / 10, Fa = d.k2 * Fs / 20;
      var xa = J([[d.A1, trig(d.t1, Ft(d.F1))], [d.A2, trig(d.t2, Ft(d.F2))]]);
      var xn0 = J([[d.A1, trig(d.t1, Pd(w1) + ' n')], [d.A2, trig(d.t2, Pd(w2u) + ' n')]]);
      var t2red = J([[d.c2, trig(d.t2, Pd(Math.abs(w2)) + ' n')]]);
      var xn = d.merged ? J([[d.A1 + d.c2, trig(d.t1, Pd(w1) + ' n')]]) : J([[d.A1, trig(d.t1, Pd(w1) + ' n')], [d.c2, trig(d.t2, Pd(Math.abs(w2)) + ' n')]]);
      var cF = d.merged ? d.A1 + d.c2 : d.c2;
      var yt = d.merged ? J([[cF, trig(d.t1, Ft(d.F1))]]) : J([[d.A1, trig(d.t1, Ft(d.F1))], [d.c2, trig(d.t2, Ft(Fa))]]);
      var stem = 'The analogue signal $$x_a(t)=' + xa + '\\qquad(t\\text{ in seconds})$$ is sampled at $F_s=' + Fs + '$ Hz to give $x(n)=x_a(nT_s)$. The samples are then passed to an ideal D/A converter running at the same $F_s$.';
      var redStep;
      if (d.q === d.q2) redStep = '$\\omega_2=' + Pd(w2u) + '$ is already in $(-\\pi,\\pi]$, so nothing aliases.';
      else redStep = '$\\omega_2=' + Pd(w2u) + '$ is outside $(-\\pi,\\pi]$. Subtract $' + (Math.round(d.q / 20) === 1 ? '' : Math.round(d.q / 20)) + '2\\pi$: $\\omega_2=' + Pd(w2u) + '-' + (Math.round(d.q / 20) === 1 ? '' : Math.round(d.q / 20)) + '2\\pi=' + Pd(w2) + '$.' +
        (d.t2 === 'sin' && d.q2 < 0 ? ' Since $\\sin(-\\theta)=-\\sin\\theta$, the term becomes $' + t2red + '$ (the sign flips).' : d.q2 < 0 ? ' Since $\\cos(-\\theta)=\\cos\\theta$, the term becomes $' + t2red + '$ (no sign change for a cosine).' : '');
      var parts = [
        { q: '(a) Find the Nyquist rate of $x_a(t)$ and state whether $F_s=' + Fs + '$ Hz is adequate (1 = yes, 0 = no).',
          answers: [nA('Nyquist rate', Ny, 'Hz'), bA('$F_s$ adequate?', ok)],
          working: QB.steps([
            'Divide each $t$ coefficient by $2\\pi$: $F_1=' + d.F1 + '$ Hz and $F_2=' + d.F2 + '$ Hz.',
            'Nyquist rate $=2F_{\\max}=2(' + Fmax + ')=' + Ny + '$ Hz.',
            ok ? '$F_s=' + Fs + '>' + Ny + '$, so the sampling is adequate.' : '$F_s=' + Fs + '<' + Ny + '$, so the ' + d.F2 + ' Hz tone aliases.'
          ]) + QB.final('2F_{\\max}=' + Ny + '\\ \\text{Hz}') },
        { q: '(b) Write $x(n)$ with every digital frequency in $(-\\pi,\\pi]$. Give $\\omega_1$ and the principal value of $\\omega_2$ (rad/sample).',
          answers: [rA('$\\omega_1$', w1), Object.assign(rA('$\\omega_2$', w2), { alt: [-w2] })],
          working: QB.steps([
            '$T_s=1/F_s=' + F(1 / Fs, 4) + '$ s. Substitute $t=nT_s$, so each tone gets $\\omega=2\\pi F/F_s$.',
            '$\\omega_1=2\\pi(' + d.F1 + '/' + Fs + ')=' + Pd(w1) + '$ and $\\omega_2=2\\pi(' + d.F2 + '/' + Fs + ')=' + Pd(w2u) + '$, giving $x(n)=' + xn0 + '$.',
            redStep,
            d.merged ? 'Both terms are now ' + d.t1 + 'es at $' + Pd(w1) + '$, so combine them: $' + d.A1 + (d.c2 < 0 ? '' : '+') + d.c2 + '=' + (d.A1 + d.c2) + '$.' : ''
          ]) + QB.final('x(n)=' + xn) },
        { q: '(c) Find the reconstructed signal $y(t)$. Give the frequency $F_a$ at which the second tone reappears and the coefficient (with sign) of the $\\' + (d.merged ? d.t1 : d.t2) + '(2\\pi F_a t)$ term in $y(t)$.',
          answers: [nA('$F_a$', d.merged ? d.F1 : Fa, 'Hz'), nA('coefficient', cF, '', { tol: 0, abs: 0.01 })],
          working: QB.steps([
            'The ideal D/A substitutes $n=F_st$ <i>after</i> the reduction, so each $\\omega$ maps back to $F=\\omega F_s/2\\pi$.',
            '$|\\omega_2|=' + Pd(Math.abs(w2)) + '\\Rightarrow F_a=' + F(Math.abs(w2) / PI / 2, 4) + '\\times' + Fs + '=' + Fa + '$ Hz' + (ok ? ' (the original tone).' : ' (alias check: $F_a=F_2-kF_s=' + d.F2 + '-' + Math.round(d.q / 20) + '(' + Fs + ')=' + (d.F2 - Math.round(d.q / 20) * Fs) + '$ Hz).'),
            'So $y(t)=' + yt + '$' + (ok ? ', which equals $x_a(t)$.' : (d.merged ? '. The alias lands on top of the first tone.' : ', which is not $x_a(t)$.'))
          ]) + QB.final('y(t)=' + yt) }
      ];
      return {
        stem: stem, figure: tpl('adcChain', { Fs: Fs + ' Hz' }), parts: parts,
        notes: QB.callout('trap', 'Reduce $\\omega$ into $(-\\pi,\\pi]$ <b>before</b> substituting $n=F_st$, otherwise you just get $x_a(t)$ back. A sine that folds to a negative frequency changes sign; a cosine does not.'),
        data: d
      };
    }
  });

  add('sig', 'sampling', 'apparent', {
    title: 'Apparent frequency of a sampled tone (Hz or normalised)',
    difficulty: 1, marks: 3,
    variants: [{ id: 'hz', label: 'Apparent frequency in Hz' }, { id: 'norm', label: 'Normalised f and ω' }, { id: 'decimate', label: 'Drop samples: y(n) = x(Mn)' }],
    tags: ['aliasing', 'D1', 'DX1 Q1(d)'],
    gen: function (r, v) {
      if (v === 'decimate') {
        var dd = r.retry(function () {
          var q = r.pick([4, 5, 6, 8, 10, 12]), p = r.int(1, q - 1), M = r.pick([2, 3]);
          if (gcd(p, q) !== 1) return null;
          var w0 = p * PI / q, wy = wrapPi(M * w0);
          if (Math.abs(Math.abs(wy) - PI) < 1e-9 || Math.abs(wy) < 1e-9) return null;
          var Fs = r.pick([600, 1200, 2400, 4800, 9600]);
          return { p: p, q: q, M: M, w0: w0, wy: wy, Fs: Fs, A: r.int(2, 6) };
        });
        var Fapp = Math.abs(dd.wy) * (dd.Fs / dd.M) / (2 * PI);
        return {
          stem: 'The DT signal $x(n)=' + dd.A + '\\cos\\left(' + P(dd.w0) + 'n\\right)$ was obtained by sampling at $F_s=' + dd.Fs + '$ Hz. Every ' + (dd.M === 2 ? 'second' : 'third') + ' sample is kept, giving $y(n)=x(' + dd.M + 'n)$.',
          parts: [
            { q: '(a) Find the digital frequency of $y(n)$ in $(-\\pi,\\pi]$ (rad/sample).',
              answers: [Object.assign(rA('$\\omega_y$', dd.wy), { alt: [-dd.wy] })],
              working: QB.steps([
                '$y(n)=' + dd.A + '\\cos\\left(' + P(dd.w0) + '\\cdot' + dd.M + 'n\\right)=' + dd.A + '\\cos\\left(' + P(dd.M * dd.w0) + 'n\\right)$. Keeping every $M$-th sample multiplies every digital frequency by $M$.',
                Math.abs(dd.M * dd.w0) > PI ? 'Reduce: $' + P(dd.M * dd.w0) + '-2\\pi=' + P(dd.wy) + '$, and $\\cos$ is even, so the frequency is $' + P(Math.abs(dd.wy)) + '$.' : '$' + P(dd.M * dd.w0) + '$ is already in range.'
              ]) + QB.final('\\omega_y=' + P(dd.wy)) },
            { q: '(b) $y(n)$ is the same as sampling $x_a(t)$ at a lower rate. Give that rate and the frequency (Hz) an ideal D/A at that rate would output.',
              answers: [nA('effective rate', dd.Fs / dd.M, 'Hz'), nA('$F$ out', Fapp, 'Hz')],
              working: QB.steps([
                'Keeping every ' + dd.M + 'th sample means $T_s\\to' + dd.M + 'T_s$, so the rate is $F_s/' + dd.M + '=' + F(dd.Fs / dd.M) + '$ Hz.',
                'Output frequency $F=|\\omega_y|\\,(F_s/M)/2\\pi=' + F(Math.abs(dd.wy) / PI, 4) + '\\pi\\times' + F(dd.Fs / dd.M) + '/(2\\pi)=' + F(Fapp, 4) + '$ Hz.'
              ]) + QB.final('F=' + F(Fapp, 4) + '\\ \\text{Hz}') }
          ],
          notes: QB.callout('trap', 'Discarding samples <b>doubles</b> (or triples) every digital frequency; it does not halve it. Aliasing gets worse.'),
          data: dd
        };
      }
      var d = r.retry(function () {
        var Fs = r.pick([1000, 2000, 4000, 5000, 8000, 10000, 48000]);
        var F0 = r.nice(0.55 * Fs, 3.4 * Fs, Fs / 100);
        var k = Math.round(F0 / Fs), Fa = F0 - k * Fs;
        if (Math.abs(Math.abs(Fa) - Fs / 2) < 1e-9 || Math.abs(Fa) < Fs / 50) return null;
        return { Fs: Fs, F0: F0, k: k, Fa: Fa, A: r.int(1, 5), type: r.pick(['cos', 'sin']) };
      });
      var f0 = d.F0 / d.Fs, f = d.Fa / d.Fs, w = 2 * PI * f;
      var stemTxt = 'A tone $x_a(t)=' + d.A + '\\' + d.type + '(2\\pi\\cdot ' + d.F0 + 't)$ is sampled at $F_s=' + (d.Fs >= 1000 ? F(d.Fs / 1000) + '$ kHz' : d.Fs + '$ Hz') + ' with no anti-aliasing filter.';
      var w0Steps = [
        '$f_0=F_0/F_s=' + d.F0 + '/' + d.Fs + '=' + F(f0, 5) + '$ cycles/sample, i.e. $\\omega_0=2\\pi f_0=' + Pd(2 * PI * f0) + '$.',
        'DT frequencies are unique only for $-\\tfrac12<f\\le\\tfrac12$. Subtract the integer $k=' + d.k + '$: $f=' + F(f0, 5) + '-' + d.k + '=' + F(f, 5) + '$.',
        'Equivalently $F_a=F_0-kF_s=' + d.F0 + '-' + d.k + '(' + d.Fs + ')=' + F(d.Fa) + '$ Hz, in $(-F_s/2,F_s/2]$.'
      ];
      if (v === 'norm') {
        return {
          stem: stemTxt,
          parts: [
            { q: '(a) Find the normalised frequency $f_0=F_0/F_s$ before reduction.', answers: [nA('$f_0$', f0, '', { tol: 0.002 })], working: QB.steps(w0Steps.slice(0, 1)) + QB.final('f_0=' + F(f0, 5)) },
            { q: '(b) Give the principal value $f\\in(-\\tfrac12,\\tfrac12]$ (cycles/sample) and $\\omega\\in(-\\pi,\\pi]$ (rad/sample).',
              answers: [Object.assign(nA('$f$', f, '', { tol: 0.002 }), { alt: [-f] }), Object.assign(rA('$\\omega$', w), { alt: [-w] })],
              working: QB.steps(w0Steps.slice(1, 2).concat(['$\\omega=2\\pi f=' + Pd(w) + '$ rad/sample.' + (d.type === 'sin' && f < 0 ? ' For the sine, $\\sin(-\\theta)=-\\sin\\theta$, so the samples are $-' + d.A + '\\sin(' + Pd(-w) + 'n)$.' : '')])) + QB.final('f=' + F(f, 5) + ',\\quad\\omega=' + Pd(w)) },
            { q: '(c) What analogue frequency (Hz) does an ideal D/A at $F_s$ reproduce?', answers: [nA('$|F_a|$', Math.abs(d.Fa), 'Hz')], working: QB.steps(['$|F_a|=|f|\\,F_s=' + F(Math.abs(f), 5) + '\\times' + d.Fs + '=' + F(Math.abs(d.Fa)) + '$ Hz.']) + QB.final('|F_a|=' + F(Math.abs(d.Fa)) + '\\ \\text{Hz}') }
          ],
          data: d
        };
      }
      return {
        stem: stemTxt,
        parts: [
          { q: '(a) At what frequency (Hz) does the tone appear after ideal reconstruction? Give $|F_a|$ and the integer $k$ in $F_a=F_0-kF_s$.',
            answers: [nA('$|F_a|$', Math.abs(d.Fa), 'Hz'), iA('$k$', d.k)],
            working: QB.steps(w0Steps.slice(1)) + QB.final('|F_a|=' + F(Math.abs(d.Fa)) + '\\ \\text{Hz}') },
          { q: '(b) What is the smallest sampling rate that avoids aliasing (the Nyquist rate)?', answers: [nA('Nyquist rate', 2 * d.F0, 'Hz')],
            working: QB.steps(['Nyquist rate $=2F_{\\max}=2(' + d.F0 + ')=' + 2 * d.F0 + '$ Hz. The folding frequency for the given $F_s$ is only $F_s/2=' + F(d.Fs / 2) + '$ Hz.']) + QB.final('F_{s,\\min}=' + 2 * d.F0 + '\\ \\text{Hz}') }
        ],
        notes: d.type === 'sin' && d.Fa < 0 ? QB.callout('trap', 'Here $F_a<0$, so the reconstructed sine also changes sign: $-' + d.A + '\\sin(2\\pi\\cdot' + F(-d.Fa) + 't)$.') : '',
        data: d
      };
    }
  });

  add('sig', 'sampling', 'samples', {
    title: 'Evaluate the samples of a sampled damped tone',
    difficulty: 1, marks: 3,
    variants: [{ id: 'dc', label: 'Tone at a multiple of F_s (aliases to DC)' }, { id: 'alt', label: 'Tone at an odd multiple of F_s/2' }, { id: 'quarter', label: 'Tone at (k + 1/4) F_s' }],
    tags: ['Sample Test Q1(a)', 'exam-style'],
    gen: function (r, v) {
      var Fs = r.pick([50, 100, 200, 250, 400, 500, 1000]), k = r.int(1, 3);
      var mult = v === 'dc' ? k : v === 'alt' ? k + 0.5 : k + 0.25;
      var F0 = mult * Fs, A = r.pick([2, 5, 10, 20]), al = r.pick([0.01, 0.02, 0.05, 0.1, 0.5, 1, 2, 5]);
      var cpat = v === 'dc' ? [1, 1, 1, 1, 1, 1, 1, 1] : v === 'alt' ? [1, -1, 1, -1, 1, -1, 1, -1] : [1, 0, -1, 0, 1, 0, -1, 0];
      var xs = range(0, 7).map(function (n) { return cl(A * Math.exp(-al * n / Fs) * cpat[n]); });
      var Fa = v === 'dc' ? 0 : v === 'alt' ? Fs / 2 : Fs / 4;
      var cosStep = v === 'dc' ? '$\\cos(' + 2 * k + '\\pi n)=1$ for every integer $n$' : v === 'alt' ? '$\\cos(' + (2 * k + 1) + '\\pi n)=(-1)^n$' : '$\\cos\\left(' + P(2 * PI * mult) + 'n\\right)=\\cos\\left(\\tfrac{\\pi}{2}n\\right)=\\{1,0,-1,0,\\dots\\}$';
      return {
        stem: 'The continuous-time signal $x_a(t)=' + A + 'e^{-' + F(al) + 't}\\cos(' + F(2 * F0) + '\\pi t)$ ($t$ in seconds) is sampled at $F_s=' + Fs + '$ Hz.',
        figure: null,
        parts: [
          { q: '(a) Determine the sampling interval $T_s$.', answers: [nA('$T_s$', 1 / Fs, 's')], working: QB.steps(['$T_s=1/F_s=1/' + Fs + '=' + F(1 / Fs) + '$ s.']) + QB.final('T_s=' + F(1 / Fs) + '\\ \\text{s}') },
          { q: '(b) Evaluate $x(n)$ for $n=1,2,3$ (4 decimal places).',
            answers: [1, 2, 3].map(function (n) { return nA('$x(' + n + ')$', xs[n], '', { tol: 0.0005, abs: 1e-4, sig: 5 }); }),
            working: QB.steps([
              'Substitute $t=nT_s$: $x(n)=' + A + 'e^{-' + F(al / Fs, 4) + 'n}\\cos\\left(' + P(2 * PI * mult) + 'n\\right)$.',
              'Evaluate the cosine exactly: ' + cosStep + '. Do not use a calculator on $\\cos(' + F(2 * F0 / Fs) + '\\pi n)$; rounding error hides the pattern.',
              QB.tbl(['$n$', '0', '1', '2', '3'], [['$x(n)$'].concat([0, 1, 2, 3].map(function (n) { return F(xs[n], 5); }))])
            ]) + QB.final('x(n)=\\{' + [0, 1, 2, 3].map(function (n) { return F(xs[n], 5); }).join(',\\ ') + ',\\dots\\}') + stemFig([{ v: xs, n0: 0, label: 'x(n)' }]) },
          { q: '(c) At what frequency $F_a$ (Hz) does the tone appear after sampling?', answers: [nA('$F_a$', Fa, 'Hz', { abs: 0.01 })],
            working: QB.steps(['$F_0=' + F0 + '$ Hz $=' + F(mult) + 'F_s$. $F_a=F_0-kF_s$ in $(-F_s/2,F_s/2]$ gives $F_a=' + F(Fa) + '$ Hz' + (v === 'dc' ? ' (DC: the samples are a pure decaying exponential).' : v === 'alt' ? ' (the folding frequency, so the samples alternate in sign).' : '.')]) + QB.final('F_a=' + F(Fa) + '\\ \\text{Hz}') }
        ],
        data: { Fs: Fs, F0: F0, A: A, al: al, v: v }
      };
    }
  });

  /* =====================================================================
   * sig.seq — sequences, periodicity, energy (D1 Playbooks B and D)
   * ===================================================================== */
  function seqTable(rows, ns) {
    return QB.tbl(['$n$'].concat(ns.map(function (n) { return n === 0 ? '<b>0</b>' : F(n); })), rows.map(function (rw) { return [rw[0]].concat(ns.map(function (n) { var x = rw[1](n); return x === null ? '' : F(x); })); }));
  }

  add('sig', 'seq', 'ops', {
    title: 'Sequence operations: shift, reverse, scale and energy',
    difficulty: 2, marks: 4,
    variants: [{ id: 'shift', label: 'x(n−a) ± x(n+b)' }, { id: 'reverse', label: 'x(c − n)' }, { id: 'down', label: 'x(αn + β) (downsampling)' }, { id: 'up', label: 'x(n/2) (upsampling)' }, { id: 'parts', label: 'Even/odd parts and (−1)ⁿx(n)' }],
    tags: ['Sample Test Q2', 'exam-style'],
    gen: function (r, v) {
      var len = r.int(5, 6), xv = randSeq(r, len, -3, 9, true), n0 = r.int(-3, -1);
      var x = { v: xv, n0: n0 }, nL = n0 + len - 1, E = sum(xv.map(function (a) { return a * a; }));
      var fx = function (n) { return at(x, n); };
      var stem = 'Consider the DT signal $x(n)=' + seqT(x) + '$ (the arrow marks $n=0$). Samples at all other $n$ are zero.';
      var Epart = { q: 'Calculate the energy $E_x$.', answers: [iA('$E_x$', E)], working: QB.steps(['$E_x=\\sum|x(n)|^2=' + xv.map(function (a) { return Fp(a) + '^2'; }).join('+') + '=' + E + '$. It is finite, so $x(n)$ is an energy signal.']) + QB.final('E_x=' + E) };
      var fig = stemFig([{ v: xv, n0: n0, label: 'x(n)' }]);
      var data = { x: xv, n0: n0, v: v };
      var y, desc, ask, rows, ns, steps = [], yT;
      if (v === 'shift') {
        var a = r.int(1, 3), b = r.int(1, 2), sg = r.pick([1, -1]);
        var lo = n0 - b, hi = nL + a; ns = range(lo, hi);
        y = trim({ v: ns.map(function (n) { return at(x, n - a) + sg * at(x, n + b); }), n0: lo });
        desc = 'x(n-' + a + ')' + (sg > 0 ? '+' : '-') + 'x(n+' + b + ')';
        var ov = ns.filter(function (n) { return n - a >= n0 && n - a <= nL && n + b >= n0 && n + b <= nL; });
        var pickN = (ov.length >= 2 ? ov.slice(0, 2) : ov).concat([hi]);
        ask = pickN.filter(function (n, i, arr) { return arr.indexOf(n) === i; });
        data.a = a; data.b = b; data.sg = sg; data.ask = ask;
        steps = ['$x(n-' + a + ')$ is $x$ delayed by ' + a + ' (it occupies $n=' + (n0 + a) + '..' + (nL + a) + '$). $x(n+' + b + ')$ is advanced by ' + b + ' ($n=' + (n0 - b) + '..' + (nL - b) + '$).',
          'Line up the index rows and ' + (sg > 0 ? 'add' : 'subtract') + ' column by column:' + seqTable([['$x(n-' + a + ')$', function (n) { return n - a >= n0 && n - a <= nL ? fx(n - a) : null; }], ['$x(n+' + b + ')$', function (n) { return n + b >= n0 && n + b <= nL ? fx(n + b) : null; }], ['$y(n)$', function (n) { return at(x, n - a) + sg * at(x, n + b); }]], ns)];
      } else if (v === 'reverse') {
        var c = r.int(-2, 3); ns = range(c - nL, c - n0);
        y = { v: ns.map(function (n) { return fx(c - n); }), n0: c - nL };
        desc = 'x(' + (c === 0 ? '' : c) + '-n)'; ask = [0, 1, c - nL].filter(function (n, i, a) { return a.indexOf(n) === i; }); data.c = c; data.ask = ask;
        steps = ['Direct substitution: for each $n$ compute the index $' + (c === 0 ? '' : c) + '-n$ and read $x$ there. (Lecture order: shift ' + (c >= 0 ? 'left' : 'right') + ' by ' + Math.abs(c) + ' to get $x(n+' + c + ')$, then reverse.)',
          seqTable([['index $' + (c === 0 ? '' : c) + '-n$', function (n) { return c - n; }], ['$y(n)$', function (n) { return fx(c - n); }]], ns),
          'The support starts at $n=' + (c - nL) + '$ (where the index reaches the last sample $n=' + nL + '$).'];
      } else if (v === 'down') {
        var al = r.pick([2, -2]), be = r.pick([0, 1, -1]);
        var nn = range(-12, 12).filter(function (n) { var i = al * n + be; return i >= n0 && i <= nL; });
        ns = range(nn[0], nn[nn.length - 1]);
        y = { v: ns.map(function (n) { return fx(al * n + be); }), n0: ns[0] };
        desc = 'x(' + (al === 2 ? '2n' : '-2n') + (be > 0 ? '+' + be : be < 0 ? '-' + (-be) : '') + ')'; ask = [-1, 0, 1];
        data.al = al; data.be = be; data.ask = ask;
        steps = ['Substitute directly: $y(n)=x(' + (al === 2 ? '2n' : '-2n') + (be ? (be > 0 ? '+' : '') + be : '') + ')$. Only indices inside $' + n0 + '\\le' + (al === 2 ? '2n' : '-2n') + (be ? (be > 0 ? '+' : '') + be : '') + '\\le' + nL + '$ give non-zero samples.',
          seqTable([['index', function (n) { return al * n + be; }], ['$y(n)$', function (n) { return fx(al * n + be); }]], ns),
          'The samples of $x$ at the other indices are lost (downsampling keeps every second sample).'];
        data.count = ns.length;
      } else if (v === 'up') {
        ns = range(2 * n0, 2 * nL);
        y = { v: ns.map(function (n) { return n % 2 === 0 ? fx(n / 2) : 0; }), n0: 2 * n0 };
        desc = 'x(n/2)'; ask = [-2, 2, 3]; data.ask = ask;
        steps = ['$x(n/2)$ is defined only where $n/2$ is an integer: $y(2m)=x(m)$, and $y(n)=0$ for odd $n$ (zeros inserted between samples).',
          seqTable([['$y(n)$', function (n) { return n % 2 === 0 ? fx(n / 2) : 0; }]], ns)];
      } else {
        ns = range(-Math.max(-n0, nL), Math.max(-n0, nL));
        var xe = function (n) { return 0.5 * (fx(n) + fx(-n)); }, xo = function (n) { return 0.5 * (fx(n) - fx(-n)); };
        var alt = sum(xv.map(function (a, i) { return a * ((n0 + i) % 2 === 0 ? 1 : -1); }));
        data.alt = alt;
        return {
          stem: stem, figure: fig, data: data,
          parts: [
            { q: '(a) Find the even part $x_e(n)=\\tfrac12[x(n)+x(-n)]$ at $n=0$ and $n=1$, and the odd part $x_o(n)=\\tfrac12[x(n)-x(-n)]$ at $n=1$ and $n=2$.',
              answers: [sA('$x_e(0)$', xe(0)), sA('$x_e(1)$', xe(1)), sA('$x_o(1)$', xo(1)), sA('$x_o(2)$', xo(2))],
              working: QB.steps(['Reverse $x$ about $n=0$ and line it up with the original:', seqTable([['$x(n)$', fx], ['$x(-n)$', function (n) { return fx(-n); }], ['$x_e(n)$', xe], ['$x_o(n)$', xo]], ns), 'Check: $x_e$ is even, $x_o$ is odd, $x_o(0)=0$ and $x_e+x_o=x$.']) + QB.final('x_e(0)=' + F(xe(0)) + ',\\ x_e(1)=' + F(xe(1)) + ',\\ x_o(1)=' + F(xo(1)) + ',\\ x_o(2)=' + F(xo(2))) },
            { q: '(b) Find $\\sum_n (-1)^n x(n)$, the sum of $x(n)(-1)^n$.', answers: [iA('$\\sum(-1)^nx(n)$', alt)],
              working: QB.steps(['$(-1)^n$ is $+1$ for even $n$ (including $n=0$) and $-1$ for odd $n$, negative $n$ included.', '$x(n)(-1)^n=' + seqT({ v: xv.map(function (a, i) { return a * ((n0 + i) % 2 === 0 ? 1 : -1); }), n0: n0 }) + '$, which sums to $' + alt + '$.']) + QB.final(String(alt)) },
            Object.assign({}, Epart, { q: '(c) ' + Epart.q })
          ]
        };
      }
      yT = seqT(trim(y));
      return {
        stem: stem, figure: fig, data: data,
        parts: [
          { q: '(a) Write $y(n)=' + desc + '$ in sequential form. Give ' + ask.map(function (n) { return '$y(' + n + ')$'; }).join(', ') + (v === 'down' ? ' and the number of samples of $x$ that survive.' : v === 'up' ? ' and the number of samples from the first to the last non-zero one.' : '.'),
            answers: ask.map(function (n) { return iA('$y(' + n + ')$', at(y, n)); }).concat(v === 'down' ? [iA('surviving samples', y.v.filter(function (a) { return a !== 0; }).length)] : v === 'up' ? [iA('span', 2 * (len - 1) + 1)] : []),
            working: QB.steps(steps) + QB.final('y(n)=' + yT) + stemFig([{ v: y.v, n0: y.n0, label: 'y(n)' }]) },
          Object.assign({}, Epart, { q: '(b) ' + Epart.q })
        ],
        notes: v === 'reverse' ? QB.callout('trap', 'For $x(\\alpha n+\\beta)$ shift by $\\beta$ first, then reverse. Direct substitution avoids the order problem altogether.') : ''
      };
    }
  });

  add('sig', 'seq', 'periodic', {
    title: 'Periodicity and fundamental period',
    difficulty: 1, marks: 2,
    variants: [{ id: 'sum', label: 'Sum of DT sinusoids (LCM)' }, { id: 'aperiodic', label: 'One component has no π (aperiodic)' }, { id: 'ct', label: 'CT signal, then sampled' }],
    tags: ['T1 Q1', 'D1 Playbook B'],
    gen: function (r, v) {
      var Ns = [3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 40];
      function comp() {
        return r.retry(function () { var N = r.pick(Ns), k = r.int(1, Math.floor((N - 1) / 2)); if (gcd(k, N) !== 1) return null; return { N: N, k: k, w: 2 * PI * k / N, t: r.pick(['cos', 'sin', 'exp']), A: r.int(1, 4), ph: r.pick([0, 0, PI / 6, PI / 4, PI / 3]) }; });
      }
      function compT(c, i) {
        var arg = P(c.w) + 'n' + (c.ph ? '+' + P(c.ph) : '');
        if (c.t === 'exp') return (i ? '+' : '') + (c.A === 1 ? '' : c.A) + 'e^{j(' + arg + ')}';
        return (i ? (c.sg < 0 ? '-' : '+') : (c.sg < 0 ? '-' : '')) + (c.A === 1 ? '' : c.A) + '\\' + c.t + '\\left(' + arg + '\\right)';
      }
      if (v === 'ct') {
        var d = r.retry(function () {
          var g = r.pick([5, 10, 20, 25, 50, 100]), m1 = r.int(1, 9), m2 = r.int(1, 9);
          if (m1 === m2 || gcd(m1, m2) !== 1) return null;
          var F1 = g * m1, F2 = g * m2, Fs = r.pick([200, 400, 500, 800, 1000, 1500, 2000, 3000]);
          if (Fs <= 2 * Math.max(F1, F2)) return null;
          var N1 = Fs / gcd(F1, Fs), N2 = Fs / gcd(F2, Fs);
          return { F1: F1, F2: F2, Fs: Fs, N1: N1, N2: N2, N: lcm(N1, N2), T0: 1 / gcd(F1, F2), A1: r.int(1, 4), A2: r.int(1, 4) };
        });
        return {
          stem: 'Consider $x(t)=' + d.A1 + '\\cos(' + 2 * d.F1 + '\\pi t)+' + d.A2 + '\\sin(' + 2 * d.F2 + '\\pi t)$.',
          parts: [
            { q: '(a) Find the fundamental period $T_0$ of $x(t)$.', answers: [nA('$T_0$', d.T0, 's')],
              working: QB.steps(['$F_1=' + d.F1 + '$ Hz and $F_2=' + d.F2 + '$ Hz. A sum of CT sinusoids is periodic when $F_1/F_2$ is rational; the fundamental frequency is $\\gcd(F_1,F_2)=' + gcd(d.F1, d.F2) + '$ Hz.', '$T_0=1/' + gcd(d.F1, d.F2) + '=' + F(d.T0) + '$ s.']) + QB.final('T_0=' + F(d.T0) + '\\ \\text{s}') },
            { q: '(b) $x(t)$ is sampled at $F_s=' + d.Fs + '$ Hz. Find the fundamental period $N$ of $x(n)$ (samples).', answers: [iA('$N_1$', d.N1), iA('$N_2$', d.N2), iA('$N$', d.N)],
              working: QB.steps(['$f_1=F_1/F_s=' + d.F1 + '/' + d.Fs + '=' + Fr(d.F1 / d.Fs) + '$ in lowest terms, so $N_1=' + d.N1 + '$.', '$f_2=' + d.F2 + '/' + d.Fs + '=' + Fr(d.F2 / d.Fs) + '$, so $N_2=' + d.N2 + '$.', '$N=\\mathrm{LCM}(' + d.N1 + ',' + d.N2 + ')=' + d.N + '$.']) + QB.final('N=' + d.N) }
          ],
          data: d
        };
      }
      var nc = v === 'aperiodic' ? 2 : r.int(2, 3), cs = [];
      var dd = r.retry(function () {
        cs = []; for (var i = 0; i < nc; i++) { var c = comp(); c.sg = r.sign(); cs.push(c); }
        if (cs.some(function (c, i) { return cs.some(function (c2, j) { return j < i && c2.N === c.N && c2.k === c.k; }); })) return null;
        return cs;
      });
      var bad = null;
      if (v === 'aperiodic') { bad = { t: r.pick(['cos', 'sin']), num: r.pick([1, 2, 3, 5]), den: r.pick([3, 4, 5, 6, 8, 10]), A: r.int(1, 3) }; if (gcd(bad.num, bad.den) !== 1) bad.den = 7; }
      var expr = dd.map(compT).join('') + (bad ? '+' + (bad.A === 1 ? '' : bad.A) + '\\' + bad.t + '(' + (bad.num === 1 ? '' : bad.num) + 'n/' + bad.den + ')' : '');
      var Nall = dd.reduce(function (s, c) { return lcm(s, c.N); }, 1);
      var steps = dd.map(function (c, i) { return 'Component ' + (i + 1) + ': $\\omega=' + P(c.w) + '$, so $f=\\omega/2\\pi=' + Fr(c.k / c.N) + '$ (lowest terms) and $N_' + (i + 1) + '=' + c.N + '$.'; });
      if (bad) steps.push('Last component: $\\omega=' + Fr(bad.num / bad.den) + '$ rad (no $\\pi$), so $f=' + Fr(bad.num / bad.den) + '/(2\\pi)$ is irrational. That component never repeats, so $x(n)$ is <b>not periodic</b>.');
      else steps.push('All $f_i$ are rational, so $N=\\mathrm{LCM}(' + dd.map(function (c) { return c.N; }).join(',') + ')=' + Nall + '$.');
      return {
        stem: 'Determine whether $x(n)=' + expr + '$ is periodic. If it is, find its fundamental period (enter $N=0$ if it is not periodic).',
        parts: [{ q: 'Give the period of each sinusoid that is periodic, and the fundamental period $N$ of $x(n)$.',
          answers: dd.map(function (c, i) { return iA('$N_' + (i + 1) + '$', c.N); }).concat([iA('$N$', bad ? 0 : Nall, '', { hint: 'enter 0 if not periodic' })]),
          working: QB.steps(steps) + QB.final(bad ? '\\text{not periodic}' : 'N=' + Nall) }],
        notes: QB.callout('trap', '$\\cos(5n)$ is not periodic, but $\\cos(5t)$ is. In DT the frequency must be a rational multiple of $2\\pi$.'),
        data: { comps: dd.map(function (c) { return { N: c.N, k: c.k }; }), bad: bad }
      };
    }
  });

  add('sig', 'seq', 'window', {
    title: 'Sequence from step windows and impulses: values and energy',
    difficulty: 1, marks: 3,
    variants: [{ id: 'exp', label: 'Exponential envelope' }, { id: 'ramp', label: 'Ramp envelope (a − n)' }],
    tags: ['Sample Test Q1(b)', 'D1 Example 2'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var p = r.int(0, 2), q = r.int(1, 3); if (p + q < 2) return null;
        var A = r.pick([1, 2, 3]), base = r.pick([0.5, 2, -0.5]), a = r.int(2, 5), c = r.pick([1, -1, 2, -2]);
        var dpos = r.pick([q, q + 1, -p - 1, -p - 2]);
        return { p: p, q: q, A: A, base: base, a: a, c: c, d: dpos };
      });
      function env(n) { return v === 'exp' ? d.A * Math.pow(d.base, n) : (d.a - n); }
      function xf(n) { return cl((n >= -d.p && n <= d.q - 1 ? env(n) : 0) + (n === d.d ? d.c : 0)); }
      var lo = Math.min(-d.p, d.d), hi = Math.max(d.q - 1, d.d), ns = range(lo, hi), xs = ns.map(xf);
      var E = sum(xs.map(function (a) { return a * a; }));
      var envT = v === 'exp' ? (d.A === 1 ? '' : d.A) + (d.base === 0.5 ? '2^{-n}' : d.base === 2 ? '2^{n}' : '(-0.5)^{n}') : '(' + d.a + '-n)';
      var expr = envT + '\\left[u(n' + (d.p ? '+' + d.p : '') + ')-u(n-' + d.q + ')\\right]' + (d.c > 0 ? '+' : '-') + (Math.abs(d.c) === 1 ? '' : Math.abs(d.c)) + '\\delta(n' + (d.d > 0 ? '-' + d.d : d.d < 0 ? '+' + (-d.d) : '') + ')';
      var askN = [-d.p, d.q - 1, d.d];
      return {
        stem: 'Consider the DT signal $$x(n)=' + expr + '.$$',
        parts: [
          { q: '(a) Evaluate $x(n)$ at ' + askN.map(function (n) { return '$n=' + n + '$'; }).join(', ') + ' and sketch the stem plot.',
            answers: askN.map(function (n) { return sA('$x(' + n + ')$', xf(n)); }),
            working: QB.steps([
              'The window $u(n' + (d.p ? '+' + d.p : '') + ')-u(n-' + d.q + ')$ equals 1 for $' + (-d.p) + '\\le n\\le ' + (d.q - 1) + '$ and 0 elsewhere.',
              'On the window the envelope $' + envT + '$ gives ' + range(-d.p, d.q - 1).map(function (n) { return '$' + F(env(n)) + '$'; }).join(', ') + '.',
              'Add a spike of $' + d.c + '$ at $n=' + d.d + '$ (outside the window, so it does not add to an envelope sample).',
              seqTable([['$x(n)$', xf]], ns)
            ]) + QB.final('x(n)=' + seqT({ v: xs, n0: lo })) + stemFig([{ v: xs, n0: lo, label: 'x(n)' }]) },
          { q: '(b) Find the energy $E_x$.', answers: [sA('$E_x$', E)],
            working: QB.steps(['$E_x=\\sum|x(n)|^2=' + xs.filter(function (a) { return a; }).map(function (a) { return Fp(a) + '^2'; }).join('+') + '=' + F(E) + '$.']) + QB.final('E_x=' + F(E)) }
        ],
        notes: QB.callout('trap', '$u(n+a)-u(n-b)$ is 1 for $-a\\le n\\le b-1$: the upper end is $b-1$, not $b$.'),
        data: { d: d, v: v, lo: lo, xs: xs }
      };
    }
  });

  /* =====================================================================
   * sig.adc — quantisation and the ADC (D1 Playbook C; T1 Q3–Q4)
   * ===================================================================== */
  add('sig', 'adc', 'bits', {
    title: 'ADC sizing: resolution, levels, bits and bit rate',
    difficulty: 1, marks: 3,
    variants: [{ id: 'delta', label: 'Given Δ → bits' }, { id: 'bits', label: 'Given bits → Δ' }],
    tags: ['T1 Q3', 'T1 Q4', 'D1 N3'],
    gen: function (r, v) {
      var span = r.pick([{ t: 'cos', A: r.pick([1.27, 2.5, 3.3, 5, 6.35, 10, 12.7]) }, { t: 'span', lo: -2.5, hi: 2.5 }, { t: 'span', lo: 0, hi: 5 }, { t: 'span', lo: 0, hi: 3.3 }, { t: 'span', lo: -10, hi: 10 }, { t: 'span', lo: -1, hi: 1 }, { t: 'span', lo: 0, hi: 1 }]);
      var Rg = span.t === 'cos' ? 2 * span.A : span.hi - span.lo;
      var Fs = r.pick([20, 100, 1000, 8000, 16000, 44100, 48000]);
      var desc = span.t === 'cos' ? 'The signal $x(n)=' + span.A + '\\cos(\\pi n/10)$' : 'A sensor signal spanning $' + span.lo + '$ V to $+' + span.hi + '$ V';
      var rangeStep = span.t === 'cos' ? 'Range $=x_{\\max}-x_{\\min}=2(' + span.A + ')=' + F(Rg) + '$.' : 'Range $=' + span.hi + '-(' + span.lo + ')=' + F(Rg) + '$ V.';
      if (v === 'bits') {
        var b = r.int(6, 16), D = Rg / (Math.pow(2, b) - 1);
        return {
          stem: desc + ' is sampled at $F_s=' + Fs + '$ samples/s by a ' + b + '-bit A/D converter that uses rounding.',
          figure: tpl('adcChain', { Fs: Fs + ' Hz', bits: b }),
          parts: [
            { q: '(a) Find the resolution $\\Delta$ and the worst-case quantisation error.', answers: [nA('$\\Delta$', D, 'V'), nA('$|e_q|_{\\max}$', D / 2, 'V')],
              working: QB.steps([rangeStep, '$L=2^b=2^{' + b + '}=' + Math.pow(2, b) + '$ levels.', '$\\Delta=\\dfrac{x_{\\max}-x_{\\min}}{L-1}=\\dfrac{' + F(Rg) + '}{' + (Math.pow(2, b) - 1) + '}=' + F(D, 4) + '$ V.', 'Rounding gives $|e_q|\\le\\Delta/2=' + F(D / 2, 4) + '$ V.']) + QB.final('\\Delta=' + QB.fmt.tex.eng(D, 'V', 4)) },
            { q: '(b) Find the bit rate and the highest signal frequency that can be recovered without distortion.', answers: [nA('bit rate', b * Fs, 'bit/s'), nA('$F_{\\max}$', Fs / 2, 'Hz')],
              working: QB.steps(['Bit rate $=bF_s=' + b + '\\times' + Fs + '=' + b * Fs + '$ bit/s.', '$F_{\\max}=F_s/2=' + F(Fs / 2) + '$ Hz.']) + QB.final(QB.fmt.tex.eng(b * Fs, 'bit/s', 4)) }
          ],
          data: { Rg: Rg, b: b, Fs: Fs, v: v }
        };
      }
      var d = r.retry(function () {
        var Dm = r.pick([0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001]);
        var Lr = Rg / Dm + 1, L = Math.ceil(Lr - 1e-9), b = Math.ceil(Math.log2(L) - 1e-12);
        if (b < 4 || b > 16) return null;
        return { Dm: Dm, Lr: Lr, L: L, b: b };
      });
      var Da = Rg / (Math.pow(2, d.b) - 1);
      return {
        stem: desc + ' is to be quantised (by rounding) with a resolution of at most $\\Delta=' + F(d.Dm) + '$ V, at $F_s=' + Fs + '$ samples/s.',
        figure: tpl('adcChain', { Fs: Fs + ' Hz' }),
        parts: [
          { q: '(a) How many quantisation levels and how many bits are required?', answers: [iA('$L$', d.L), iA('$b$', d.b)],
            working: QB.steps([rangeStep, '$L=\\dfrac{x_{\\max}-x_{\\min}}{\\Delta}+1=\\dfrac{' + F(Rg) + '}{' + F(d.Dm) + '}+1=' + F(d.Lr, 6) + (Math.abs(d.Lr - d.L) > 1e-9 ? '\\Rightarrow' + d.L : '') + '$ levels.', '$b\\ge\\log_2 L=\\log_2' + d.L + '=' + F(Math.log2(d.L), 4) + '$, and $b$ always rounds <b>up</b>: $b=' + d.b + '$.']) + QB.final('b=' + d.b + '\\ \\text{bits}') },
          { q: '(b) With that many bits, find the actual resolution and the worst-case error.', answers: [nA('$\\Delta$', Da, 'V'), nA('$|e_q|_{\\max}$', Da / 2, 'V')],
            working: QB.steps(['$\\Delta=\\dfrac{' + F(Rg) + '}{2^{' + d.b + '}-1}=\\dfrac{' + F(Rg) + '}{' + (Math.pow(2, d.b) - 1) + '}=' + F(Da, 4) + '$ V (better than required).', '$|e_q|\\le\\Delta/2=' + F(Da / 2, 4) + '$ V.']) + QB.final('\\Delta=' + QB.fmt.tex.eng(Da, 'V', 4)) },
          { q: '(c) Find the bit rate.', answers: [nA('bit rate', d.b * Fs, 'bit/s')], working: QB.steps(['Bit rate $=bF_s=' + d.b + '\\times' + Fs + '=' + d.b * Fs + '$ bit/s.']) + QB.final(QB.fmt.tex.eng(d.b * Fs, 'bit/s', 4)) }
        ],
        notes: QB.callout('trap', 'It is $L-1$ steps across the range, not $L$. And $b$ always rounds up: 636 levels needs 10 bits, not 9.'),
        data: { Rg: Rg, Dm: d.Dm, Fs: Fs, v: v }
      };
    }
  });

  add('sig', 'adc', 'sqnr', {
    title: 'Quantisation noise and SQNR ↔ number of bits',
    difficulty: 2, marks: 3,
    variants: [{ id: 'b2s', label: 'Bits → SQNR' }, { id: 's2b', label: 'Required SQNR → bits' }, { id: 'backoff', label: 'Signal below full scale' }],
    tags: ['quantisation', 'beyond L02 (standard result)'],
    gen: function (r, v) {
      var Vfs = r.pick([1, 2.5, 5, 10]);
      function sq(b, rho) { return 10 * Math.log10(1.5 * Math.pow(Math.pow(2, b) - 1, 2) * rho * rho); }
      var model = 'Model: a full-scale sinusoid $A\\cos(\\cdot)$ with $A=V_{fs}$ has power $A^2/2$. With rounding, the error is uniform on $[-\\Delta/2,\\Delta/2]$, so its power is $\\Delta^2/12$. With the course step $\\Delta=2A/(2^b-1)$: $$\\text{SQNR}=\\frac{A^2/2}{\\Delta^2/12}=\\tfrac32(2^b-1)^2\\approx 6.02b+1.76\\ \\text{dB}.$$';
      if (v === 'b2s') {
        var b = r.int(6, 16), D = 2 * Vfs / (Math.pow(2, b) - 1), Pn = D * D / 12, S = sq(b, 1);
        return {
          stem: 'A ' + b + '-bit rounding A/D converter has a full-scale range of $\\pm' + Vfs + '$ V. The input is a sinusoid that just fills the range.',
          parts: [
            { q: '(a) Find the step $\\Delta$ and the quantisation-noise power $\\Delta^2/12$.', answers: [nA('$\\Delta$', D, 'V'), nA('$P_e$', Pn, 'V²', { hint: 'in V²' })],
              working: QB.steps(['$\\Delta=\\dfrac{2(' + Vfs + ')}{2^{' + b + '}-1}=' + F(D, 4) + '$ V.', '$P_e=\\Delta^2/12=' + F(Pn, 4) + '\\ \\text{V}^2$.']) + QB.final('P_e=' + F(Pn, 4) + '\\ \\text{V}^2') },
            { q: '(b) Find the signal-to-quantisation-noise ratio in dB.', answers: [nA('SQNR', S, 'dB', { tol: 0.005 })],
              working: model + QB.steps(['$P_x=' + Vfs + '^2/2=' + F(Vfs * Vfs / 2) + '\\ \\text{V}^2$.', '$\\text{SQNR}=10\\log_{10}\\dfrac{' + F(Vfs * Vfs / 2) + '}{' + F(Pn, 4) + '}=' + F(S, 4) + '$ dB (rule of thumb $6.02(' + b + ')+1.76=' + F(6.02 * b + 1.76, 4) + '$ dB).']) + QB.final('\\text{SQNR}=' + F(S, 4) + '\\ \\text{dB}') }
          ],
          notes: QB.callout('tip', 'Each extra bit halves $\\Delta$ and so adds about 6 dB of SQNR.'),
          data: { b: b, Vfs: Vfs, rho: 1, v: v }
        };
      }
      var rho = v === 'backoff' ? r.pick([0.5, 0.25, 0.1]) : 1;
      var d = r.retry(function () {
        var S = r.int(40, 100), be = (S - 1.76 - 20 * Math.log10(rho)) / 6.02;
        var fr = be - Math.floor(be); if (fr < 0.12 || fr > 0.88) return null;
        var b = 1; while (sq(b, rho) < S) b++;
        if (b > 18) return null;
        return { S: S, b: b };
      });
      var loss = -20 * Math.log10(rho), got = sq(d.b, rho);
      var parts = [];
      if (v === 'backoff') parts.push({ q: '(a) By how many dB does the SQNR fall because the signal peak is only ' + F(rho) + ' of full scale?', answers: [nA('loss', loss, 'dB')],
        working: QB.steps(['Signal power scales with amplitude squared, while the noise $\\Delta^2/12$ is fixed by the converter.', 'Loss $=20\\log_{10}(1/' + F(rho) + ')=' + F(loss, 4) + '$ dB.']) + QB.final(F(loss, 4) + '\\ \\text{dB}') });
      parts.push({ q: (v === 'backoff' ? '(b)' : '(a)') + ' Find the minimum number of bits.', answers: [iA('$b$', d.b)],
        working: model + QB.steps([v === 'backoff' ? 'With peak $\\rho V_{fs}$, $\\text{SQNR}=\\tfrac32(2^b-1)^2\\rho^2$, i.e. about $6.02b+1.76-' + F(loss, 4) + '$ dB.' : '',
          'Need $6.02b+1.76' + (v === 'backoff' ? '-' + F(loss, 4) : '') + '\\ge' + d.S + '$, so $b\\ge' + F((d.S - 1.76 + (v === 'backoff' ? loss : 0)) / 6.02, 4) + '$. Round up: $b=' + d.b + '$.']) + QB.final('b=' + d.b) });
      parts.push({ q: (v === 'backoff' ? '(c)' : '(b)') + ' What SQNR does that converter actually give?', answers: [nA('SQNR', got, 'dB', { tol: 0.005 })],
        working: QB.steps(['$10\\log_{10}\\left[\\tfrac32(2^{' + d.b + '}-1)^2' + (rho !== 1 ? '(' + F(rho) + ')^2' : '') + '\\right]=' + F(got, 4) + '$ dB $\\ge' + d.S + '$ dB.']) + QB.final(F(got, 4) + '\\ \\text{dB}') });
      return {
        stem: 'A sinusoidal signal is digitised by a rounding A/D converter with full-scale range $\\pm' + Vfs + '$ V' + (v === 'backoff' ? '. The signal peak is only $' + F(rho) + 'V_{fs}$' : ' and the signal fills that range') + '. The SQNR must be at least $' + d.S + '$ dB.',
        parts: parts,
        data: { S: d.S, rho: rho, Vfs: Vfs, v: v }
      };
    }
  });

  /* =====================================================================
   * sig.props — system properties (D1 Playbook E; T2 Q1; Sample Test Q3)
   * ===================================================================== */
  var PROPS = ['S', 'L', 'TI', 'C', 'St'];
  var PNAME = { S: 'Static (memoryless)', L: 'Linear', TI: 'Time-invariant', C: 'Causal', St: 'BIBO stable' };
  /* each term: flags + reasons for each failing property + a bound for stability */
  var TERMS = [
    { id: 'x', f: [1, 1, 1, 1, 1], mk: function () { return { t: 'x(n)', b: 'M_x' }; } },
    { id: 'del', f: [0, 1, 1, 1, 1], mk: function (r) { var k = r.int(1, 3); return { t: 'x(n-' + k + ')', b: 'M_x', S: '$x(n-' + k + ')$ is a past input: $y(n)$ needs memory.' }; } },
    { id: 'adv', f: [0, 1, 1, 0, 1], mk: function (r) { var k = r.int(1, 2); return { t: 'x(n+' + k + ')', b: 'M_x', S: '$x(n+' + k + ')$ is an input at another time.', C: '$y(0)$ needs the future input $x(' + k + ')$.' }; } },
    { id: 'rev', f: [0, 1, 0, 0, 1], mk: null },
    { id: 'dec', f: [0, 1, 0, 0, 1], mk: function (r) { var M = r.pick([2, 3]); return { t: 'x(' + M + 'n)', b: 'M_x', S: '$y(1)=x(' + M + ')$.', TI: 'Delay the input: $x(' + M + 'n-d)$. Delay the output: $y(n-d)=x(' + M + 'n-' + M + 'd)$. Not equal.', C: '$y(1)=x(' + M + ')$ is a future input.' }; } },
    { id: 'nsq', f: [0, 1, 0, 0, 1], mk: function () { return { t: 'x(n^2)', b: 'M_x', S: '$y(2)=x(4)$.', TI: 'Delay the input: $x(n^2-d)$; delay the output: $x((n-d)^2)$. Not equal.', C: '$y(2)=x(4)$ is a future input.' }; } },
    { id: 'nx', f: [1, 1, 0, 1, 0], mk: function () { return { t: 'n\\,x(n)', S0: 1, TI: 'The gain $n$ changes with time: delaying the input gives $n\\,x(n-d)$ but $y(n-d)=(n-d)x(n-d)$.', St: 'The bounded input $x=u(n)$ gives $n\\,u(n)\\to\\infty$.' }; } },
    { id: 'nxd', f: [0, 1, 0, 1, 0], mk: function () { return { t: 'n\\,x(n-1)', S: '$x(n-1)$ is a past input.', TI: 'Delaying the input gives $n\\,x(n-1-d)$ but $y(n-d)=(n-d)x(n-1-d)$.', St: '$x=u(n)$ gives a term $n\\,u(n-1)\\to\\infty$.' }; } },
    { id: 'cosn', f: [1, 1, 0, 1, 1], mk: function (r) { var w = r.pick([PI / 4, PI / 3, PI / 2, 0.2 * PI]); return { t: '\\cos(' + (Math.abs(w - 0.2 * PI) < 1e-9 ? '0.2\\pi' : P(w)) + 'n)\\,x(n)', b: 'M_x', TI: 'The gain $\\cos(\\omega_0 n)$ varies with $n$: $x(n-d)\\cos(\\omega_0n)\\ne y(n-d)=x(n-d)\\cos(\\omega_0(n-d))$.' }; } },
    { id: 'cosc', f: [1, 1, 1, 1, 1], mk: function () { return { t: '\\cos(0.2\\pi)\\,x(n)', b: '0.81M_x', tip: '$\\cos(0.2\\pi)=0.809$ is a constant gain, not a time-varying one.' }; } },
    { id: 'sq', f: [1, 0, 1, 1, 1], mk: function () { return { t: 'x^2(n)', b: 'M_x^2', L: 'Doubling the input quadruples this term: $(2x)^2=4x^2\\ne2x^2$.' }; } },
    { id: 'abs', f: [1, 0, 1, 1, 1], mk: function () { return { t: '|x(n)|', b: 'M_x', L: '$|-x(n)|=|x(n)|\\ne-|x(n)|$, so scaling by $-1$ fails.' }; } },
    { id: 'absadv', f: [0, 0, 1, 0, 1], mk: function () { return { t: '|x(n+1)|', b: 'M_x', S: '$x(n+1)$ is an input at another time.', L: '$|-x|\\ne-|x|$.', C: '$y(0)$ needs the future input $x(1)$.' }; } },
    { id: 'exp', f: [1, 0, 1, 1, 1], mk: function () { return { t: 'e^{x(n)}', b: 'e^{M_x}', L: '$x=0$ gives $e^0=1\\ne0$.' }; } },
    { id: 'cosx', f: [1, 0, 1, 1, 1], mk: function () { return { t: '\\cos\\big(x(n)\\big)', b: '1', L: '$x=0$ gives $\\cos 0=1\\ne0$.' }; } },
    { id: 'prod', f: [0, 0, 1, 1, 1], mk: function () { return { t: 'x(n)\\,x(n-1)', b: 'M_x^2', S: '$x(n-1)$ is a past input.', L: 'Doubling the input quadruples this term.' }; } },
    { id: 'acc', f: [0, 1, 1, 1, 0], mk: function () { return { t: '\\sum_{k=-\\infty}^{n}x(k)', S: 'It sums all past inputs.', St: 'The bounded input $x=u(n)$ gives $(n+1)u(n)\\to\\infty$.' }; } },
    { id: 'accadv', f: [0, 1, 1, 0, 0], mk: function () { return { t: '\\sum_{k=-\\infty}^{n+1}x(k)', S: 'It sums inputs at other times.', C: 'The sum includes the future input $x(n+1)$.', St: 'With $x=u(n)$ the sum grows without bound.' }; } },
    { id: 'ma', f: [0, 1, 1, 1, 1], mk: function (r) { var K = r.int(1, 3); return { t: '\\sum_{k=n-' + K + '}^{n}x(k)', b: (K + 1) + 'M_x', S: 'It uses $x(n-1),\\dots,x(n-' + K + ')$.' }; } },
    { id: 'mac', f: [0, 1, 1, 0, 1], mk: function (r) { var K = r.int(1, 2); return { t: '\\sum_{k=n-' + K + '}^{n+' + K + '}x(k)', b: (2 * K + 1) + 'M_x', S: 'It uses inputs at other times.', C: 'It uses the future inputs up to $x(n+' + K + ')$.' }; } }
  ];
  // fix the rev reason text (kept short and correct)
  TERMS[3].mk = function (r) {
    var c = r.pick([0, 1, 2]), cs = c ? c + '-n' : '-n';
    var ns = c === 2 ? 0 : c - 1, ix = c - ns;
    return { t: 'x(' + cs + ')', b: 'M_x', S: '$y(' + ns + ')=x(' + ix + ')$ uses an input at another time.',
      TI: 'Delay the input: $x(' + cs + '-d)$. Delay the output: $y(n-d)=x(' + cs + '+d)$. They differ (with $x=\\delta(n)$ the output is $\\delta(n' + (c ? '-' + c : '') + ')$; with $x=\\delta(n-1)$ it is $\\delta(n' + (c - 1 > 0 ? '-' + (c - 1) : c - 1 < 0 ? '+1' : '') + ')$, which moved the wrong way).',
      C: '$y(' + ns + ')=x(' + ix + ')$ is a future input.' };
  };

  function propsWork(terms, offset) {
    var out = {};
    PROPS.forEach(function (p, i) {
      var bad = terms.filter(function (t) { return !t.f[i]; });
      var ok = !bad.length && !(p === 'L' && offset);
      var why;
      if (p === 'L' && offset) why = 'The constant $' + F(offset) + '$ means $x=0$ gives $y=' + F(offset) + '\\ne0$.';
      else if (!ok) why = bad[0].d[p] || ('$' + bad[0].d.t + '$ fails this test.');
      else why = ({ S: 'Every term uses only $x(n)$ at the same $n$.', L: 'Every term is linear in $x$ and there is no constant offset. Gains that depend on $n$ are allowed.', TI: 'No coefficient depends on $n$ and every index has the form $n-k$, so delaying the input simply delays the output.', C: 'No term uses an input $x(n+k)$ with $k>0$, for any $n$.', St: 'With $|x(n)|\\le M_x$: $|y(n)|\\le ' + terms.map(function (t) { return (t.c !== 1 ? F(Math.abs(t.c)) : '') + (t.d.b || 'M_x'); }).join('+') + (offset ? '+' + F(Math.abs(offset)) : '') + '<\\infty$.' })[p];
      out[p] = { ok: ok, why: why };
    });
    return out;
  }

  add('sig', 'props', 'classify', {
    title: 'Classify a system: static, linear, TI, causal, stable',
    difficulty: 2, marks: 4,
    variants: [{ id: 'single', label: 'One term' }, { id: 'two', label: 'Sum of two terms' }, { id: 'offset', label: 'Term plus a constant' }],
    tags: ['T2 Q1', 'D1 N5', 'exam-style'],
    gen: function (r, v) {
      var nt = v === 'two' ? 2 : 1, terms = [];
      r.retry(function () {
        terms = [];
        var pool = TERMS.filter(function (t) { return v === 'two' || t.id !== 'x'; });
        for (var i = 0; i < nt; i++) { var T = r.pick(pool); if (terms.some(function (u) { return u.id === T.id; })) return null; terms.push({ id: T.id, f: T.f, d: T.mk(r), c: i === 0 ? r.pick([1, 1, 2, 3]) : r.pick([1, -1, 2, -2, 0.5]) }); }
        if (nt === 2 && terms[0].id === 'x' && terms[1].id === 'cosc') return null;
        return terms;
      });
      var offset = v === 'offset' ? r.pick([1, 2, -1, 3, -2]) : 0;
      var expr = J(terms.map(function (t) { return [t.c, t.d.t]; }).concat(offset ? [[offset, '']] : []));
      var pw = propsWork(terms, offset);
      var tip = terms.filter(function (t) { return t.d.tip; }).map(function (t) { return t.d.tip; }).join(' ');
      return {
        stem: 'Determine whether the system $$y(n)=' + expr + '$$ is static, linear, time-invariant, causal and BIBO stable. Enter 1 for yes and 0 for no.',
        parts: [{ q: 'Classify the system. Prove each property that holds and give a reason or counterexample for each that fails.',
          answers: PROPS.map(function (p) { return bA(PNAME[p], pw[p].ok); }),
          working: QB.steps(PROPS.map(function (p) { return '<b>' + PNAME[p] + ':</b> ' + yes(pw[p].ok) + '. ' + pw[p].why; })) +
            QB.final(PROPS.map(function (p) { return (pw[p].ok ? '' : '\\text{not }') + '\\text{' + PNAME[p].split(' ')[0].replace('BIBO', 'stable').toLowerCase() + '}'; }).join(',\\ ')) },
        ],
        notes: (tip ? QB.callout('trap', tip) + ' ' : '') + QB.callout('tip', 'To disprove a property one concrete counterexample is enough. Order: static, linear ($x=0\\Rightarrow y=0$?), TI (two-column test), causal (check negative $n$ too), stable ($u(n)$ is the usual test input).'),
        data: { terms: terms.map(function (t) { return t.id; }), flags: terms.map(function (t) { return t.f; }), offset: offset }
      };
    }
  });

  add('sig', 'props', 'lccde', {
    title: 'Properties of a difference equation (tick the boxes)',
    difficulty: 2, marks: 1,
    variants: [{ id: 'feedback', label: 'Recursive (y terms on the left)' }, { id: 'fir', label: 'No feedback' }],
    tags: ['Sample Test Q3', 'exam-style'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var fb = v === 'feedback' ? r.pick([[1], [1, 2], [2], [1, 4], [1, 2]]) : [];
        var cs = fb.map(function () { return r.pick([1, -1, 0.5, -0.5, 0.1, -0.1, 0.25]); });
        var ncoef = fb.length && r.bool(0.3) ? r.int(0, fb.length - 1) : -1;
        var g = r.pickw([[3, '1'], [1.5, 'cc'], [1.5, 'cn']]);
        var xd = r.bool(0.45), xa = r.bool(0.35), cst = r.bool(0.25) ? r.pick([1, -1, 2]) : 0;
        if (v === 'fir' && r.bool(0.4)) { xd = false; xa = false; }
        return { fb: fb, cs: cs, ncoef: ncoef, g: g, xd: xd, xa: xa, cst: cst };
      });
      var lhs = 'y[n]' + d.fb.map(function (k, i) {
        var c = d.cs[i];
        if (i === d.ncoef) return (c < 0 ? '+' : '-') + (Math.abs(c) === 1 ? '' : F(Math.abs(c))) + 'n\\,y[n-' + k + ']';
        return (c < 0 ? '+' : '-') + (Math.abs(c) === 1 ? '' : F(Math.abs(c))) + 'y[n-' + k + ']';
      }).join('');
      var gt = d.g === '1' ? '' : d.g === 'cc' ? '\\cos(0.2\\pi)\\,' : '\\cos(0.2\\pi n)\\,';
      var rhs = gt + 'x[n]' + (d.xd ? '+x[n-1]' : '') + (d.xa ? '+x[n+1]' : '') + (d.cst ? (d.cst > 0 ? '+' : '-') + Math.abs(d.cst) : '');
      var L = !d.cst, TI = d.ncoef < 0 && d.g !== 'cn', C = !d.xa, S = !d.fb.length && !d.xd && !d.xa;
      return {
        stem: 'For the system $$' + lhs + '=' + rhs + '$$ tick every box that applies (1 = ticked, 0 = not): Linear, Time invariant, Causal, Static/memoryless. Assume the system is initially at rest.',
        parts: [{ q: 'Which properties hold?',
          answers: [bA('Linear', L), bA('Time invariant', TI), bA('Causal', C), bA('Static', S)],
          working: QB.steps([
            '<b>Linear:</b> ' + yes(L) + '. ' + (L ? 'No constant term and no nonlinear function of $x$ or $y$.' : 'The constant $' + d.cst + '$ means a zero input gives a non-zero output.'),
            '<b>Time invariant:</b> ' + yes(TI) + '. ' + (TI ? 'Every coefficient is constant' + (d.g === 'cc' ? ' ($\\cos(0.2\\pi)=0.809$ is a number, not a function of $n$)' : '') + '.' : d.ncoef >= 0 ? 'The coefficient $n$ on a $y$ term changes with time.' : 'The gain $\\cos(0.2\\pi n)$ changes with time.'),
            '<b>Causal:</b> ' + yes(C) + '. ' + (C ? 'Only present and past inputs appear.' : '$x[n+1]$ is a future input.'),
            '<b>Static:</b> ' + yes(S) + '. ' + (S ? '$y[n]$ depends only on $x[n]$.' : d.fb.length ? 'The $y[n-k]$ feedback gives the output memory.' : 'Inputs at other times appear.')
          ]) + QB.final([L ? '\\text{L}' : '', TI ? '\\text{TI}' : '', C ? '\\text{C}' : '', S ? '\\text{S}' : ''].filter(Boolean).join(',\\ ') || '\\text{none}') }],
        notes: QB.callout('trap', '$\\cos(0.2\\pi)\\,x[n]$ is time invariant (constant gain). Only $\\cos(0.2\\pi n)$ would vary. A $-1$ on the right makes the system nonlinear.'),
        data: { L: L, TI: TI, C: C, S: S, d: d }
      };
    }
  });

  var TSYS = {
    dec: { t: 'x(2n)', f: function (x, n) { return x(2 * n); }, ti: false, lin: true },
    nx: { t: 'n\\,x(n)', f: function (x, n) { return n * x(n); }, ti: false, lin: true },
    rev: { t: 'x(-n)', f: function (x, n) { return x(-n); }, ti: false, lin: true },
    evn: { t: 'x(n)+x(-n)', f: function (x, n) { return x(n) + x(-n); }, ti: false, lin: true },
    cosn: { t: '\\cos(\\pi n/2)\\,x(n)', f: function (x, n) { return Math.round(Math.cos(PI * n / 2)) * x(n); }, ti: false, lin: true },
    fir: { t: 'x(n)-2x(n-1)', f: function (x, n) { return x(n) - 2 * x(n - 1); }, ti: true, lin: true },
    sq: { t: 'x^2(n)', f: function (x, n) { return x(n) * x(n); }, ti: true, lin: false },
    aff: { t: '2x(n)+1', f: function (x, n) { return 2 * x(n) + 1; }, ti: true, lin: false },
    prod: { t: 'x(n)\\,x(n-1)', f: function (x, n) { return x(n) * x(n - 1); }, ti: true, lin: false },
    abs: { t: '|x(n)|', f: function (x, n) { return Math.abs(x(n)); }, ti: true, lin: false }
  };
  add('sig', 'props', 'test', {
    title: 'Test time invariance or linearity with a specific input',
    difficulty: 2, marks: 3,
    variants: [{ id: 'ti', label: 'Shift test (time invariance)' }, { id: 'lin', label: 'Scaling test (linearity)' }],
    tags: ['counterexample', 'D1 Example 3'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var key = v === 'ti' ? r.pick(['dec', 'nx', 'rev', 'evn', 'cosn', 'fir']) : r.pick(['sq', 'aff', 'prod', 'abs', 'nx', 'fir']);
        var xv = randSeq(r, 3, -2, 3, true), S = TSYS[key];
        var x1 = function (n) { return at({ v: xv, n0: 0 }, n); };
        if (v === 'ti') {
          var dd = r.pick([1, 2]), x2 = function (n) { return x1(n - dd); };
          var ns = range(-4, 6), cand = ns.filter(function (n) { return S.f(x2, n) !== S.f(x1, n - dd); });
          var n1 = S.ti ? r.pick([1, 2, 3]) : (cand.length ? r.pick(cand) : null);
          if (n1 === null) return null;
          return { key: key, x: xv, dd: dd, n1: n1, A: S.f(x2, n1), B: S.f(x1, n1 - dd), prop: S.ti };
        }
        var a = key === 'abs' ? r.pick([-1, -2]) : r.pick([2, -1, 3]);
        var ns2 = range(0, 3), cand2 = ns2.filter(function (n) { return S.f(function (m) { return a * x1(m); }, n) !== a * S.f(x1, n); });
        var n2 = S.lin ? r.pick([1, 2]) : (cand2.length ? r.pick(cand2) : null);
        if (n2 === null) return null;
        return { key: key, x: xv, a: a, n1: n2, A: S.f(function (m) { return a * x1(m); }, n2), B: a * S.f(x1, n2), prop: S.lin };
      });
      var S = TSYS[d.key], xs = { v: d.x, n0: 0 };
      if (v === 'ti') {
        return {
          stem: 'The system $y(n)=' + S.t + '$ is driven by $x_1(n)=' + seqT(xs) + '$ and then by the delayed input $x_2(n)=x_1(n-' + d.dd + ')$.',
          figure: stemFig([{ v: d.x, n0: 0, label: 'x_1(n)' }]),
          parts: [{ q: 'Find $y_2(' + d.n1 + ')=T\\{x_2\\}$ at $n=' + d.n1 + '$ and the delayed first output $y_1(' + d.n1 + '-' + d.dd + ')$. Is the system time invariant?',
            answers: [iA('$y_2(' + d.n1 + ')$', d.A), iA('$y_1(' + (d.n1 - d.dd) + ')$', d.B), bA('time invariant', d.prop)],
            working: QB.steps([
              '$x_2(n)=x_1(n-' + d.dd + ')=' + seqT({ v: d.x, n0: d.dd }) + '$.',
              '$y_2(' + d.n1 + ')=' + S.t.replace(/n/g, '(' + d.n1 + ')').replace(/x\(/g, 'x_2(') + '=' + d.A + '$.',
              '$y_1(' + (d.n1 - d.dd) + ')=' + S.t.replace(/n/g, '(' + (d.n1 - d.dd) + ')').replace(/x\(/g, 'x_1(') + '=' + d.B + '$.',
              d.prop ? 'The two agree (and they agree for every $n$, since the coefficients are constant and every index is $n-k$): time invariant.' : 'They differ, so delaying the input does <b>not</b> just delay the output: time-varying. One counterexample is enough.'
            ]) + QB.final('y_2(' + d.n1 + ')=' + d.A + (d.prop ? '=' : '\\ne') + 'y_1(' + (d.n1 - d.dd) + ')=' + d.B) }],
          data: d
        };
      }
      return {
        stem: 'The system $y(n)=' + S.t + '$ is driven by $x_1(n)=' + seqT(xs) + '$ and then by the scaled input $x_2(n)=' + d.a + 'x_1(n)$.',
        parts: [{ q: 'Find $T\\{x_2\\}$ at $n=' + d.n1 + '$ and $' + d.a + 'T\\{x_1\\}$ at $n=' + d.n1 + '$. Is the system linear?',
          answers: [iA('$T\\{x_2\\}(' + d.n1 + ')$', d.A), iA('$' + d.a + 'y_1(' + d.n1 + ')$', d.B), bA('linear', d.prop)],
          working: QB.steps([
            '$x_2(n)=' + seqT({ v: d.x.map(function (a) { return d.a * a; }), n0: 0 }) + '$.',
            '$T\\{x_2\\}(' + d.n1 + ')=' + d.A + '$, while $' + d.a + 'y_1(' + d.n1 + ')=' + d.a + '\\times' + Fp(d.B / d.a) + '=' + d.B + '$.',
            d.prop ? 'Equal (and homogeneity plus additivity hold in general for this system): linear.' : 'They differ, so the scaling (homogeneity) test fails: <b>nonlinear</b>.'
          ]) + QB.final(d.A + (d.prop ? '=' : '\\ne') + d.B) }],
        data: d
      };
    }
  });

  /* =====================================================================
   * sig.corr — correlation (D1 Playbook F; DX2 Q1)
   * ===================================================================== */
  /** r_xy(l) = Σ_n x(n) y(n − l) */
  function xcorr(x, y, l) { var s = 0; x.v.forEach(function (a, i) { s += a * at(y, x.n0 + i - l); }); return cl(s); }
  function lagRange(x, y) { return [x.n0 - (y.n0 + y.v.length - 1), x.n0 + x.v.length - 1 - y.n0]; }

  add('sig', 'corr', 'xcorr', {
    title: 'Autocorrelation and cross-correlation of short sequences',
    difficulty: 2, marks: 3,
    variants: [{ id: 'auto', label: 'Autocorrelation r_xx(l)' }, { id: 'cross', label: 'Cross-correlation r_xy(l)' }],
    tags: ['L03', 'D1 Example 4'],
    gen: function (r, v) {
      var x = { v: randSeq(r, r.int(3, 4), -3, 4, false), n0: r.pick([0, -1]) };
      if (v === 'auto') {
        var Lx = x.v.length, rr = range(0, Lx - 1).map(function (l) { return xcorr(x, x, l); });
        var full = { v: range(-(Lx - 1), Lx - 1).map(function (l) { return xcorr(x, x, l); }), n0: -(Lx - 1) };
        return {
          stem: 'Given $x(n)=' + seqT(x) + '$, find the autocorrelation $r_{xx}(l)=\\sum_n x(n)\\,x(n-l)$.',
          figure: stemFig([{ v: x.v, n0: x.n0, label: 'x(n)' }]),
          parts: [{ q: 'Find $r_{xx}(0)$, $r_{xx}(1)$ and $r_{xx}(2)$, then write $r_{xx}(l)$ for all $l$.',
            answers: [0, 1, 2].map(function (l) { return iA('$r_{xx}(' + l + ')$', rr[l]); }),
            working: QB.steps([0, 1, 2].map(function (l) {
              var tm = x.v.map(function (a, i) { var b = at(x, x.n0 + i - l); return b ? Fp(a) + '\\cdot' + Fp(b) : null; }).filter(Boolean);
              return '$l=' + l + '$: shift $x$ right by ' + l + ' (no flip), multiply and add: $' + (tm.join('+') || '0') + '=' + rr[l] + '$' + (l === 0 ? ' $(=E_x)$' : '') + '.';
            }).concat(['$r_{xx}$ is even, so $r_{xx}(-l)=r_{xx}(l)$.'])) + QB.final('r_{xx}(l)=' + seqT(full)) + stemFig([{ v: full.v, n0: full.n0, label: 'r_{xx}(l)', xl: 'l' }]) }],
          data: { x: x, v: v }
        };
      }
      var y = { v: randSeq(r, r.int(3, 4), -3, 4, false), n0: r.pick([-1, 0, 1]) };
      var lr = lagRange(x, y), lags = [-1, 0, 1];
      var full2 = { v: range(lr[0], lr[1]).map(function (l) { return xcorr(x, y, l); }), n0: lr[0] };
      return {
        stem: 'Given $x(n)=' + seqT(x) + '$ and $y(n)=' + seqT(y) + '$. Use the L03 definition $r_{xy}(l)=\\sum_n x(n)\\,y(n-l)$.',
        figure: stemFig([{ v: x.v, n0: x.n0, label: 'x(n)' }, { v: y.v, n0: y.n0, label: 'y(n)' }]),
        parts: [
          { q: '(a) Find $r_{xy}(l)$ for $l=-1,0,1$.', answers: lags.map(function (l) { return iA('$r_{xy}(' + l + ')$', xcorr(x, y, l)); }),
            working: QB.steps(lags.map(function (l) {
              var tm = x.v.map(function (a, i) { var b = at(y, x.n0 + i - l); return b ? Fp(a) + '\\cdot' + Fp(b) : null; }).filter(Boolean);
              return '$l=' + l + '$: shift $y$ ' + (l > 0 ? 'right by ' + l : l < 0 ? 'left by ' + (-l) : 'not at all') + ', multiply by $x(n)$ sample by sample and add: $' + (tm.join('+') || '0') + '=' + xcorr(x, y, l) + '$.';
            })) + QB.final('r_{xy}(l)=' + seqT(full2)) },
          { q: '(b) Without a new sum, give $r_{yx}(1)$ and the range of lags where $r_{xy}(l)$ can be non-zero.', answers: [iA('$r_{yx}(1)$', xcorr(y, x, 1)), iA('lowest lag', lr[0]), iA('highest lag', lr[1])],
            working: QB.steps(['$r_{yx}(l)=r_{xy}(-l)$, so $r_{yx}(1)=r_{xy}(-1)=' + xcorr(x, y, -1) + '$.', 'Overlap needs $n-l$ inside $y$\'s support while $n$ is inside $x$\'s: $l$ runs from $' + x.n0 + '-' + Fp(y.n0 + y.v.length - 1) + '=' + lr[0] + '$ to $' + (x.n0 + x.v.length - 1) + '-' + Fp(y.n0) + '=' + lr[1] + '$.']) + QB.final('r_{yx}(1)=' + xcorr(y, x, 1)) }
        ],
        notes: QB.callout('trap', 'Correlation is convolution <b>without the flip</b>. State which definition you use: $r_{xy}$ and $r_{yx}$ are mirror images.'),
        data: { x: x, y: y, v: v }
      };
    }
  });

  add('sig', 'corr', 'radar', {
    title: 'Radar delay and range from cross-correlation',
    difficulty: 3, marks: 5,
    variants: [{ id: 'clean', label: 'Clean scaled echo' }, { id: 'noisy', label: 'Echo with interference' }],
    tags: ['D1 N6', 'DX2 Q1'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var x = { v: randSeq(r, 3, -2, 3, true), n0: 0 }, D = r.int(2, 6), a = r.pick([0.5, 2, 0.25, 0.8, 1.5]);
        var yv = range(0, D + 3).map(function (n) { return a * at(x, n - D); });
        if (v === 'noisy') { var k1 = r.int(0, D + 3), k2 = r.int(0, D + 3); if (k1 === k2) return null; yv[k1] += r.pick([1, -1]); yv[k2] += r.pick([1, -1, 2]); }
        yv = yv.map(cl); while (yv.length > 1 && yv[yv.length - 1] === 0) yv.pop();
        var y = { v: yv, n0: 0 };
        var ls = range(-2, D + 5), rv = ls.map(function (l) { return xcorr(y, x, l); });
        var mx = Math.max.apply(null, rv.map(Math.abs)), arg = ls.filter(function (l, i) { return Math.abs(Math.abs(rv[i]) - mx) < 1e-9; });
        if (arg.length !== 1 || arg[0] !== D) return null;
        return { x: x, D: D, a: a, y: y, Fs: r.pick([1, 2, 5, 10, 20]) * 1e6 };
      });
      var c = 3e8, Ex = xcorr(d.x, d.x, 0), pk = xcorr(d.y, d.x, d.D), ah = pk / Ex, rng = d.D * c / (2 * d.Fs), res = c / (2 * d.Fs);
      var lo = d.y.n0 - 2, hi = d.y.n0 + d.y.v.length - 1;
      var full = { v: range(lo, hi).map(function (l) { return xcorr(d.y, d.x, l); }), n0: lo };
      return {
        stem: 'A radar transmits $x(n)=' + seqT(d.x) + '$. The echo, sampled at $F_s=' + F(d.Fs / 1e6) + '$ MHz, is $$y(n)=' + seqT(d.y) + '.$$ Use $r_{yx}(l)=\\sum_n y(n)\\,x(n-l)$ and $c=3\\times10^8$ m/s.',
        figure: stemFig([{ v: d.x.v, n0: 0, label: 'x(n)' }, { v: d.y.v, n0: d.y.n0, label: 'y(n)' }]),
        parts: [
          { q: '(a) Find $r_{xx}(0)$ and the peak value of $r_{yx}(l)$.', answers: [iA('$r_{xx}(0)$', Ex), sA('$\\max|r_{yx}|$', Math.abs(pk))],
            working: QB.steps(['$r_{xx}(0)=E_x=' + d.x.v.map(function (a) { return Fp(a) + '^2'; }).join('+') + '=' + Ex + '$.', 'Slide $x$ right by $l$ (no flip) under $y$, multiply and add, for each lag:', QB.tbl(['$l$'].concat(range(lo, hi).map(String)), [['$r_{yx}(l)$'].concat(full.v.map(function (a) { return F(a); }))])]) + QB.final('r_{yx}(' + d.D + ')=' + F(pk)) + stemFig([{ v: full.v, n0: full.n0, label: 'r_{yx}(l)', xl: 'l' }]) },
          { q: '(b) Estimate the delay $\\hat d$ (samples) and the target range $r$.', answers: [iA('$\\hat d$', d.D), nA('$r$', rng, 'm')],
            working: QB.steps(['$\\hat d=\\arg\\max_l|r_{yx}(l)|=' + d.D + '$.', 'The pulse travels out and back: $d=2F_sr/c$, so $r=\\dfrac{\\hat d\\,c}{2F_s}=\\dfrac{' + d.D + '(3\\times10^8)}{2(' + QB.fmt.tex.num(d.Fs) + ')}=' + F(rng) + '$ m.']) + QB.final('r=' + F(rng) + '\\ \\text{m}') },
          { q: '(c) Model the echo as $y(n)\\approx a\\,x(n-\\hat d)$. Estimate $a$, and give the range resolution (change in range for one sample of delay).', answers: [nA('$\\hat a$', ah, ''), nA('$\\Delta r$', res, 'm')],
            working: QB.steps(['If $y=a\\,x(n-\\hat d)$ then $r_{yx}(\\hat d)=a\\,r_{xx}(0)$, so $\\hat a=' + F(pk) + '/' + Ex + '=' + F(ah, 4) + '$' + (v === 'clean' ? ' (exact here).' : ' (the interference perturbs it slightly).'), '$\\Delta r=c/(2F_s)=' + F(res) + '$ m.']) + QB.final('\\hat a=' + F(ah, 4) + ',\\ \\Delta r=' + F(res) + '\\ \\text{m}') }
        ],
        data: { x: d.x, y: d.y, Fs: d.Fs, D: d.D }
      };
    }
  });

  /* =====================================================================
   * sig.lccde — modes, recursion, h(n), full solution (D2 Playbooks A–D)
   * ===================================================================== */
  var REAL = [0.5, -0.5, 0.25, -0.25, 1 / 3, -1 / 3, 0.2, -0.4, 0.8, -0.8, 0.6, 0.75];
  var CPLX = [[Math.SQRT1_2, PI / 4], [1, PI / 3], [0.5, PI / 3], [0.5, PI / 2], [0.9, PI / 3], [0.8, PI / 2], [Math.SQRT1_2, 3 * PI / 4], [0.5, 2 * PI / 3], [1, PI / 2], [0.6, PI / 2]];
  var REP = [0.5, -0.5, 0.25, -0.25, 1, 0.8];
  /** signed sum with fraction-style coefficients */
  function Jf(terms) {
    var out = '';
    terms.forEach(function (t) {
      var c = t[0], b = t[1] || '';
      if (Math.abs(c) < 1e-12) return;
      var neg = c < 0, a = Math.abs(c), s = (b && Math.abs(a - 1) < 1e-12) ? '' : Fr(a);
      out += (out ? (neg ? ' - ' : ' + ') : (neg ? '-' : '')) + s + b;
    });
    return out || '0';
  }
  function rootT(l) { return Fr(l); }
  function powT(l) { if (l === 1) return '1'; var t = Fr(l); return (l < 0 || /frac|\./.test(t)) ? '\\left(' + t + '\\right)^n' : t + '^n'; }
  function sysT(a, b) { // a = [1, a1, a2, ...], b = [b0, b1, ...]
    var lhs = Jf(a.map(function (c, k) { return [c, k ? 'y(n-' + k + ')' : 'y(n)']; }));
    var rhs = Jf(b.map(function (c, k) { return [c, k ? 'x(n-' + k + ')' : 'x(n)']; }));
    return lhs + '=' + rhs;
  }
  function recur(a, b, x, yic, N) { // yic = {-1: y(-1), -2: y(-2)}
    var y = {}; Object.keys(yic || {}).forEach(function (k) { y[k] = yic[k]; });
    var out = [];
    for (var n = 0; n < N; n++) {
      var s = 0;
      for (var k = 0; k < b.length; k++) s += b[k] * x(n - k);
      for (var j = 1; j < a.length; j++) s -= a[j] * (y[n - j] || 0);
      y[n] = cl(s); out.push(y[n]);
    }
    return out;
  }
  function recurRow(a, b, x, y, n) { // TeX of the computation at step n
    var terms = [];
    for (var j = 1; j < a.length; j++) if (a[j]) terms.push([-a[j], '\\cdot' + Fp(y(n - j), 4)]);
    for (var k = 0; k < b.length; k++) if (b[k]) terms.push([b[k], '\\cdot' + Fp(x(n - k), 4)]);
    return terms.map(function (t, i) { return (i ? (t[0] < 0 ? ' - ' : ' + ') : (t[0] < 0 ? '-' : '')) + Fr(Math.abs(t[0])) + t[1]; }).join('') || '0';
  }
  function pickSys(r, kind) {
    if (kind === 'complex') { var c = r.pick(CPLX); return { kind: kind, r: c[0], th: c[1], a: [1, cl(-2 * c[0] * Math.cos(c[1])), cl(c[0] * c[0])] }; }
    if (kind === 'repeated') { var l = r.pick(REP); return { kind: kind, l: l, a: [1, -2 * l, l * l] }; }
    var l1, l2; r.retry(function () { l1 = r.pick(REAL); l2 = r.pick(REAL); return Math.abs(l1 - l2) > 1e-9 ? true : null; });
    if (l1 < l2) { var t = l1; l1 = l2; l2 = t; }
    return { kind: 'distinct', l1: l1, l2: l2, a: [1, cl(-(l1 + l2)), cl(l1 * l2)] };
  }
  function charEq(s) { return '\\lambda^2' + Jf([[s.a[1], '\\lambda'], [s.a[2], '']]).replace(/^(?!-)/, '+').replace(/^\+0$/, '') + '=0'; }
  function modesWork(s) {
    if (s.kind === 'distinct') return 'Characteristic equation (the $y$ coefficients only): $' + charEq(s) + '$, so $(\\lambda-' + Fp(s.l1) + ')(\\lambda-' + Fp(s.l2) + ')=0$ and $\\lambda_1=' + rootT(s.l1) + '$, $\\lambda_2=' + rootT(s.l2) + '$. Modes: $' + powT(s.l1) + '$ and $' + powT(s.l2) + '$.';
    if (s.kind === 'repeated') return 'Characteristic equation: $' + charEq(s) + '$, i.e. $(\\lambda-' + Fp(s.l) + ')^2=0$, a double root $\\lambda=' + rootT(s.l) + '$. Modes: $' + powT(s.l) + '$ and $n' + powT(s.l) + '$.';
    var disc = s.a[1] * s.a[1] - 4 * s.a[2];
    return 'Characteristic equation: $' + charEq(s) + '$. Discriminant $' + F(disc, 4) + '<0$, so $\\lambda=' + F(-s.a[1] / 2, 4) + '\\pm j' + F(Math.sqrt(-disc) / 2, 4) + '=' + F(s.r, 4) + 'e^{\\pm j' + P(s.th) + '}$ ($r=' + F(s.r, 4) + '$, $\\theta=' + P(s.th) + '$). Real modes: $' + (s.r === 1 ? '' : F(s.r, 4) + '^n') + '\\cos(' + P(s.th) + 'n)$ and $' + (s.r === 1 ? '' : F(s.r, 4) + '^n') + '\\sin(' + P(s.th) + 'n)$.';
  }
  function stableOf(s) { return s.kind === 'distinct' ? Math.max(Math.abs(s.l1), Math.abs(s.l2)) < 1 : s.kind === 'repeated' ? Math.abs(s.l) < 1 : s.r < 1; }
  function inpT(rho) { return rho === 1 ? 'u(n)' : powT(rho) + 'u(n)'; }

  add('sig', 'lccde', 'modes', {
    title: 'Characteristic modes and stability of an LCCDE',
    difficulty: 1, marks: 1,
    variants: [{ id: 'distinct', label: 'Distinct real roots' }, { id: 'repeated', label: 'Repeated root' }, { id: 'complex', label: 'Complex pair' }, { id: 'fir', label: 'No feedback (FIR)' }],
    tags: ['Sample Test Q4(a)', 'T3 Q2', 'T3 Q5'],
    gen: function (r, v) {
      if (v === 'fir') {
        var b = randSeq(r, r.int(3, 5), -3, 4, false);
        var eq = 'y(n)=' + Jf(b.map(function (c, k) { return [c, k ? 'x(n-' + k + ')' : 'x(n)']; }));
        return {
          stem: 'An LSI system is described by $$' + eq + '.$$',
          parts: [{ q: 'How many characteristic modes does it have? Give $h(2)$ and state whether it is BIBO stable.', answers: [iA('number of modes', 0), iA('$h(2)$', b[2]), bA('stable', true)],
            working: QB.steps(['There are no past outputs $y(n-k)$, so there is no feedback: <b>the characteristic modes are zero (there are none)</b>.', 'With $x=\\delta(n)$: $h(n)=' + seqT({ v: b, n0: 0 }) + '$, so $h(2)=' + b[2] + '$ (FIR: $h(n)=b_n$).', 'FIR, so $\\sum|h|=' + sum(b.map(Math.abs)) + '<\\infty$: stable.']) + QB.final('\\text{no modes},\\ h(2)=' + b[2]) }],
          data: { v: v, b: b }
        };
      }
      var s = pickSys(r, v), b1 = r.pick([0, 1, 2, -1, 4, 0.5]);
      var st = stableOf(s);
      var ans = v === 'distinct' ? [nA('larger root $\\lambda_1$', s.l1), nA('smaller root $\\lambda_2$', s.l2)] : v === 'repeated' ? [nA('$\\lambda$', s.l)] : [nA('$r=|\\lambda|$', s.r), rA('$\\theta$ (positive)', s.th)];
      return {
        stem: 'A causal LSI system is described by $$' + sysT(s.a, [1, b1]) + '.$$',
        parts: [{ q: 'Find the characteristic modes. Hence state whether the system is BIBO stable.', answers: ans.concat([bA('stable', st)]),
          working: QB.steps([modesWork(s), st ? 'All $|\\lambda|<1$, so the modes decay and the (causal) system is <b>stable</b>.' : 'A root has $|\\lambda|\\ge1$, so the modes do not decay: <b>not BIBO stable</b>' + ((s.kind === 'complex' && s.r === 1) ? ' (marginal modes still give $\\sum|h|=\\infty$).' : '.'), 'The $x$ coefficients never enter the characteristic equation.']) + QB.final(s.kind === 'distinct' ? '\\lambda=' + rootT(s.l1) + ',\\ ' + rootT(s.l2) : s.kind === 'repeated' ? '\\lambda=' + rootT(s.l) + '\\ (\\text{double})' : '\\lambda=' + F(s.r, 4) + 'e^{\\pm j' + P(s.th) + '}') }],
        data: { v: v, a: s.a }
      };
    }
  });

  add('sig', 'lccde', 'recursion', {
    title: 'Output by recursion (with or without initial conditions)',
    difficulty: 1, marks: 2,
    variants: [{ id: 'rest', label: 'Initially at rest' }, { id: 'ic', label: 'Non-zero initial conditions' }],
    tags: ['Sample Test Q4(b)', 'DX1 Q2(b)'],
    gen: function (r, v) {
      var s = pickSys(r, r.pick(['distinct', 'complex', 'distinct'])), b = [1, r.pick([0, 1, 2, 4, -1, 0.5])];
      var rho = r.pick([1, 0.5, 1 / 3, 0.25, -0.5]);
      var x = function (n) { return n < 0 ? 0 : Math.pow(rho, n); };
      var ic = v === 'ic' ? { '-1': r.int(-2, 3), '-2': r.int(-2, 3) } : {};
      if (v === 'ic' && !ic['-1'] && !ic['-2']) ic['-1'] = 1;
      var y = recur(s.a, b, x, ic, 5);
      var yf = function (n) { return n < 0 ? (ic[n] || 0) : y[n]; };
      var rows = range(0, 3).map(function (n) { return ['$' + n + '$', '$' + F(x(n), 5) + '$', '$' + recurRow(s.a, b, x, yf, n) + '$', '$' + F(y[n], 6) + '$']; });
      var rec = 'y(n)=' + Jf([[-s.a[1], 'y(n-1)'], [-s.a[2], 'y(n-2)'], [b[0], 'x(n)'], [b[1], 'x(n-1)']]);
      return {
        stem: 'A causal system is described by $$' + sysT(s.a, b) + '.$$ The input is $x(n)=' + inpT(rho) + '$' + (v === 'ic' ? ' and the initial conditions are $y(-1)=' + ic['-1'] + '$, $y(-2)=' + ic['-2'] + '$.' : '. Assume $y(n)=0$ for $n<0$.'),
        parts: [{ q: 'Using recursion, evaluate $y(n)$ for $0\\le n\\le3$.', answers: range(0, 3).map(function (n) { return nA('$y(' + n + ')$', y[n], '', { tol: 0.005, abs: 0.002, sig: 5 }); }),
          working: QB.steps(['Recursive form (move the $y$ terms right and <b>flip their signs</b>): $' + rec + '$.', (v === 'ic' ? 'Use $y(-1)=' + ic['-1'] + '$, $y(-2)=' + ic['-2'] + '$ in the first two rows.' : 'Initially at rest: $y(-1)=y(-2)=0$.'), QB.tbl(['$n$', '$x(n)$', 'computation', '$y(n)$'], rows)]) + QB.final('y(n)=\\{' + y.slice(0, 4).map(function (a, i) { var t = F(a, 5); return i === 0 ? '\\underset{\\uparrow}{' + t + '}' : t; }).join(',\\ ') + ',\\dots\\}') }],
        notes: QB.callout('trap', 'One sign error in the recursive form ruins every later sample. Check: $y(0)=b_0x(0)' + (v === 'ic' ? '-a_1y(-1)-a_2y(-2)' : '') + '$.'),
        data: { a: s.a, b: b, rho: rho, ic: [ic['-1'] || 0, ic['-2'] || 0] }
      };
    }
  });

  add('sig', 'lccde', 'impulse', {
    title: 'Impulse response h(n) from an LCCDE (recursion + closed form)',
    difficulty: 2, marks: 3,
    variants: [{ id: 'distinct', label: 'Distinct real roots' }, { id: 'complex', label: 'Complex roots (real form)' }, { id: 'repeated', label: 'Repeated root' }, { id: 'delta', label: 'First order with m = k (extra δ term)' }],
    tags: ['Sample Test Q4(c)', 'T3 Q5', 'D2 Q3', 'D2 Q5'],
    gen: function (r, v) {
      var del = function (n) { return n === 0 ? 1 : 0; };
      if (v === 'delta') {
        var l = r.pick([0.5, -0.5, 0.8, 0.25, -0.25, 0.6, 0.9]), b0 = r.pick([1, 2]), b1 = r.pick([-1, 1, 2, -2, 0.5, 3]);
        var a = [1, -l], bb = [b0, b1], h = recur(a, bb, del, {}, 8), C = h[1] / l, D = b0 - C;
        return {
          stem: 'A causal system is described by $$' + sysT(a, bb) + '.$$', figure: tpl('directFormII', { b: bb, a: a }),
          parts: [
            { q: '(a) Using recursion with $x(n)=\\delta(n)$, find $h(0)$, $h(1)$ and $h(2)$.', answers: [0, 1, 2].map(function (n) { return nA('$h(' + n + ')$', h[n], '', { tol: 0.005, abs: 0.002 }); }),
              working: QB.steps(['$h(n)=' + Fr(l) + 'h(n-1)+' + Fr(b0) + '\\delta(n)' + (b1 < 0 ? '-' : '+') + Fr(Math.abs(b1)) + '\\delta(n-1)$, zero initial conditions.', '$h(0)=' + F(h[0]) + '$, $h(1)=' + Fr(l) + '(' + F(h[0]) + ')' + (b1 < 0 ? '-' : '+') + Fr(Math.abs(b1)) + '=' + F(h[1], 5) + '$, $h(2)=' + Fr(l) + '(' + F(h[1], 5) + ')=' + F(h[2], 5) + '$.']) + QB.final('h(n)=\\{' + h.slice(0, 4).map(function (x, i) { return i ? F(x, 4) : '\\underset{\\uparrow}{' + F(x, 4) + '}'; }).join(',\\ ') + ',\\dots\\}') },
            { q: '(b) Write $h(n)=D\\,\\delta(n)+C' + powT(l) + 'u(n)$. Find $D$ and $C$. Is the system stable?', answers: [nA('$D$', D, '', { abs: 0.002 }), nA('$C$', C, '', { abs: 0.002 }), bA('stable', Math.abs(l) < 1)],
              working: QB.steps(['The mode is $\\lambda=' + rootT(l) + '$. Here $m=k=1$, so the mode form only holds from $n=1$: $h(n)=C' + powT(l) + '$ for $n\\ge1$.', 'From $h(1)$: $C=h(1)/\\lambda=' + F(h[1], 5) + '/' + Fp(l) + '=' + F(C, 5) + '$.', 'At $n=0$: $D+C=h(0)=' + b0 + '$, so $D=' + F(D, 5) + '$.', 'Check $h(2)=C\\lambda^2=' + F(C * l * l, 5) + '$, which matches the recursion.', '$|\\lambda|' + (Math.abs(l) < 1 ? '<' : '\\ge') + '1$, so the system is ' + (Math.abs(l) < 1 ? 'stable (IIR, causal).' : 'unstable.')]) + QB.final('h(n)=' + F(D, 4) + '\\delta(n)' + (C < 0 ? '-' : '+') + F(Math.abs(C), 4) + powT(l) + 'u(n)') + stemFig([{ v: h, n0: 0, label: 'h(n)' }]) }
          ],
          notes: QB.callout('trap', 'When $m\\ge k$ the mode form does not fit $h(0)$. Add the $\\delta(n)$ term (D2 trap list).'),
          data: { v: v, a: a, b: bb }
        };
      }
      var s = pickSys(r, v), b1 = r.pick([0, 1, 2, -1, 4, 0.5, 3]), b = [1, b1];
      var h = recur(s.a, b, del, {}, 10);
      var c1, c2, form, names, check;
      if (v === 'distinct') {
        c2 = (h[1] - s.l1 * h[0]) / (s.l2 - s.l1); c1 = h[0] - c2;
        form = 'h(n)=\\left[C_1' + powT(s.l1) + '+C_2' + powT(s.l2) + '\\right]u(n)'; names = ['$C_1$ (on $' + powT(s.l1) + '$)', '$C_2$ (on $' + powT(s.l2) + '$)'];
        check = 'C_1+C_2=' + F(h[0]) + ',\\quad ' + Fr(s.l1) + 'C_1' + (s.l2 < 0 ? '-' : '+') + Fr(Math.abs(s.l2)) + 'C_2=' + F(h[1], 5);
      } else if (v === 'repeated') {
        c1 = h[0]; c2 = h[1] / s.l - c1;
        form = 'h(n)=\\left[C_1+C_2n\\right]' + powT(s.l) + 'u(n)'; names = ['$C_1$', '$C_2$'];
        check = 'C_1=' + F(h[0]) + ',\\quad ' + Fr(s.l) + '(C_1+C_2)=' + F(h[1], 5);
      } else {
        c1 = h[0]; c2 = (h[1] / s.r - c1 * Math.cos(s.th)) / Math.sin(s.th);
        form = 'h(n)=' + (s.r === 1 ? '' : F(s.r, 4) + '^n') + '\\left[A\\cos(' + P(s.th) + 'n)+B\\sin(' + P(s.th) + 'n)\\right]u(n)'; names = ['$A$', '$B$'];
        check = 'A=' + F(h[0]) + ',\\quad ' + F(s.r, 4) + '\\left[A\\cos' + P(s.th) + '+B\\sin' + P(s.th) + '\\right]=' + F(h[1], 5);
      }
      var final = v === 'distinct' ? 'h(n)=\\left[' + J([[c1, powT(s.l1)], [c2, powT(s.l2)]]) + '\\right]u(n)' : v === 'repeated' ? 'h(n)=\\left[' + J([[c1, ''], [c2, 'n']]) + '\\right]' + powT(s.l) + 'u(n)' : 'h(n)=' + (s.r === 1 ? '' : F(s.r, 4) + '^n') + '\\left[' + J([[c1, '\\cos(' + P(s.th) + 'n)'], [c2, '\\sin(' + P(s.th) + 'n)']]) + '\\right]u(n)';
      var st = stableOf(s);
      return {
        stem: 'A causal LSI system, initially at rest, is described by $$' + sysT(s.a, b) + '.$$', figure: tpl('directFormII', { b: b, a: s.a }),
        parts: [
          { q: '(a) Using recursion with $x(n)=\\delta(n)$, find $h(0)$, $h(1)$, $h(2)$ and $h(3)$.', answers: range(0, 3).map(function (n) { return nA('$h(' + n + ')$', h[n], '', { tol: 0.005, abs: 0.002, sig: 5 }); }),
            working: QB.steps(['$h(n)=' + Jf([[-s.a[1], 'h(n-1)'], [-s.a[2], 'h(n-2)'], [1, '\\delta(n)'], [b1, '\\delta(n-1)']]) + '$ with zero initial conditions.', QB.tbl(['$n$', '0', '1', '2', '3'], [['$h(n)$'].concat(range(0, 3).map(function (n) { return '$' + F(h[n], 5) + '$'; }))])]) + QB.final('h(n)=\\{\\underset{\\uparrow}{' + F(h[0]) + '},\\ ' + h.slice(1, 4).map(function (x) { return F(x, 5); }).join(',\\ ') + ',\\dots\\}') },
          { q: '(b) Find the closed form $' + form + '$. Give the constants and state whether the system is stable.', answers: [nA(names[0], c1, '', { abs: 0.002 }), nA(names[1], c2, '', { abs: 0.002 }), bA('stable', st)],
            working: QB.steps([modesWork(s), 'Here $m=1\\lt k=2$, so the mode form holds from $n=0$. Fit $h(0)$ and $h(1)$: $' + check + '$.', 'Solving: ' + names[0] + ' $=' + F(c1, 5) + '$, ' + names[1] + ' $=' + F(c2, 5) + '$.', 'Check $h(2)$ from the formula: $' + F(h[2], 5) + '$, matching the recursion.', st ? 'All modes decay ($|\\lambda|<1$): causal, IIR and <b>stable</b>.' : 'A mode has $|\\lambda|\\ge1$, so $\\sum|h|=\\infty$: <b>unstable</b>.']) + QB.final(final) + stemFig([{ v: h.slice(0, 9), n0: 0, label: 'h(n)' }]) }
        ],
        data: { v: v, a: s.a, b: b }
      };
    }
  });

  add('sig', 'lccde', 'full', {
    title: 'Total solution: homogeneous + particular, with initial conditions',
    difficulty: 3, marks: 4,
    variants: [{ id: 'rest', label: 'At rest' }, { id: 'ic', label: 'Given y(−1), y(−2)' }],
    tags: ['T3 Q3', 'T3 Q4', 'D2 Q4'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var s = pickSys(r, 'distinct'), rho = r.pick([1 / 3, 0.25, 0.5, -0.5, 1, 0.2, 2 / 3]);
        if (Math.abs(rho - s.l1) < 1e-9 || Math.abs(rho - s.l2) < 1e-9) return null;
        if (Math.abs(s.l1) >= 1 || Math.abs(s.l2) >= 1) return null;
        return { s: s, rho: rho, b1: r.pick([0, 0, -1, 1]) };
      });
      var s = d.s, a = s.a, b = [1, d.b1], rho = d.rho;
      var ic = v === 'ic' ? { '-1': r.int(-2, 3), '-2': r.int(-2, 3) } : {};
      if (v === 'ic' && !ic['-1'] && !ic['-2']) ic['-2'] = 2;
      var x = function (n) { return n < 0 ? 0 : Math.pow(rho, n); };
      var y = recur(a, b, x, ic, 4);
      var K = (1 + d.b1 / rho) / (1 + a[1] / rho + a[2] / (rho * rho));
      var c2 = ((y[1] - K * rho) - s.l1 * (y[0] - K)) / (s.l2 - s.l1), c1 = (y[0] - K) - c2;
      var fin = 'y(n)=\\left[' + J([[c1, powT(s.l1)], [c2, powT(s.l2)], [K, rho === 1 ? '' : powT(rho)]]) + '\\right]u(n)';
      return {
        stem: 'A causal system is described by $$' + sysT(a, b) + '$$ with input $x(n)=' + inpT(rho) + '$' + (v === 'ic' ? ' and initial conditions $y(-1)=' + ic['-1'] + '$, $y(-2)=' + ic['-2'] + '$.' : ', initially at rest.'),
        parts: [
          { q: '(a) Find the particular solution $y_p(n)=K' + (rho === 1 ? '' : powT(rho)) + '$.', answers: [nA('$K$', K, '', { abs: 0.002 })],
            working: QB.steps([modesWork(s), 'Try $y_p=K' + (rho === 1 ? '' : powT(rho)) + '$ ($' + Fr(rho) + '$ is not a root, so no extra $n$). Substitute into the full LCCDE and cancel the common factor:', '$K\\left(1' + (a[1] ? (a[1] < 0 ? '-' : '+') + Fr(Math.abs(a[1])) + '\\cdot' + Fp(1 / rho, 4) : '') + (a[2] ? (a[2] < 0 ? '-' : '+') + Fr(Math.abs(a[2])) + '\\cdot' + Fp(1 / (rho * rho), 4) : '') + '\\right)=1' + (d.b1 ? (d.b1 < 0 ? '-' : '+') + Fp(1 / rho, 4) : '') + '$, so $K=' + F(K, 5) + '$.']) + QB.final('K=' + F(K, 5)) },
          { q: '(b) Find $y(0)$ and $y(1)$ by recursion, then the constants $C_1$ (on $' + powT(s.l1) + '$) and $C_2$ (on $' + powT(s.l2) + '$).', answers: [nA('$y(0)$', y[0], '', { abs: 0.002 }), nA('$y(1)$', y[1], '', { abs: 0.002 }), nA('$C_1$', c1, '', { abs: 0.002 }), nA('$C_2$', c2, '', { abs: 0.002 })],
            working: QB.steps(['The ICs enter <b>only</b> through the recursion: $y(0)=' + F(y[0], 5) + '$, $y(1)=' + F(y[1], 5) + '$.', 'Fit $y=C_1' + powT(s.l1) + '+C_2' + powT(s.l2) + '+y_p$ at $n=0,1$: $C_1+C_2=' + F(y[0] - K, 5) + '$ and $' + Fr(s.l1) + 'C_1' + (s.l2 < 0 ? '-' : '+') + Fr(Math.abs(s.l2)) + 'C_2=' + F(y[1] - K * rho, 5) + '$.', '$C_1=' + F(c1, 5) + '$, $C_2=' + F(c2, 5) + '$.']) + QB.final(fin) },
          { q: '(c) Check: evaluate $y(2)$.', answers: [nA('$y(2)$', y[2], '', { abs: 0.002, tol: 0.005 })],
            working: QB.steps(['Recursion: $y(2)=' + F(y[2], 5) + '$. Formula: $' + F(c1 * s.l1 * s.l1 + c2 * s.l2 * s.l2 + K * rho * rho, 5) + '$. They agree.']) + QB.final('y(2)=' + F(y[2], 5)) }
        ],
        notes: QB.callout('trap', 'Never put $y(-1)$ into the closed form: it only holds for $n\\ge0$.'),
        data: { a: a, b: b, rho: rho, ic: [ic['-1'] || 0, ic['-2'] || 0], l1: s.l1, l2: s.l2 }
      };
    }
  });

  /* =====================================================================
   * sig.conv — convolution (D2 Playbooks E–G; T3 Q6; T2 Q3–Q4)
   * ===================================================================== */
  add('sig', 'conv', 'finite', {
    title: 'Linear convolution of short sequences',
    difficulty: 1, marks: 2,
    variants: [{ id: 'table', label: 'Tabular (long multiplication)' }, { id: 'flip', label: 'Flip-and-slide for given n' }],
    tags: ['T3 Q6(a)', 'D2 Q1', 'exam-style'],
    gen: function (r, v) {
      var x = { v: randSeq(r, r.int(3, 4), -3, 4, false), n0: r.int(-2, 1) }, h = { v: randSeq(r, r.int(3, 4), -2, 4, false), n0: r.int(-1, 1) };
      var y = convS(x, h), Ny = y.v.length, ns = range(y.n0, y.n0 + Ny - 1);
      var figs = stemFig([{ v: x.v, n0: x.n0, label: 'x(n)' }, { v: h.v, n0: h.n0, label: 'h(n)' }]);
      var stem = 'Compute $y(n)=x(n)*h(n)$ for $x(n)=' + seqT(x) + '$ and $h(n)=' + seqT(h) + '$.';
      var fin = QB.final('y(n)=' + seqT(y)) + stemFig([{ v: y.v, n0: y.n0, label: 'y(n)' }]);
      if (v === 'table') {
        var rows = x.v.map(function (xa, i) { return ['$' + F(xa) + '\\cdot h$'].concat(ns.map(function (n) { var j = n - (y.n0 + i); return j >= 0 && j < h.v.length ? F(xa * h.v[j]) : ''; })); });
        rows.push(['$y(n)$'].concat(y.v.map(function (a) { return '<b>' + F(a) + '</b>'; })));
        return {
          stem: stem, figure: figs,
          parts: [{ q: 'Give the starting index, the length, and every sample of $y(n)$ (in order from the first).',
            answers: [iA('first $n$', y.n0), iA('length', Ny)].concat(y.v.map(function (a, i) { return iA('$y(' + (y.n0 + i) + ')$', a); })),
            working: QB.steps(['$y$ starts at $n_x+n_h=' + x.n0 + '+' + Fp(h.n0) + '=' + y.n0 + '$ and has $N_x+N_h-1=' + x.v.length + '+' + h.v.length + '-1=' + Ny + '$ samples.', 'Write each $x(k)h$ shifted one place further right and add the columns (no carrying):', QB.tbl(['$n$'].concat(ns.map(function (n) { return n === 0 ? '<b>0</b>' : String(n); })), rows), 'Check: $\\sum y=' + sum(y.v) + '=(\\sum x)(\\sum h)=(' + sum(x.v) + ')(' + sum(h.v) + ')$.']) + fin }],
          data: { x: x, h: h, v: v }
        };
      }
      var pk = r.shuffle(ns.slice(1, -1)).slice(0, 2).sort(function (a, b) { return a - b; });
      return {
        stem: stem, figure: figs,
        parts: [
          { q: '(a) Using $y(n)=\\sum_k x(k)\\,h(n-k)$ (flip $h$, slide, multiply, add), find ' + pk.map(function (n) { return '$y(' + n + ')$'; }).join(' and ') + '.', answers: pk.map(function (n) { return iA('$y(' + n + ')$', at(y, n)); }),
            working: QB.steps(pk.map(function (n) {
              var tm = x.v.map(function (xa, i) { var k = x.n0 + i, hv = at(h, n - k); return hv ? 'x(' + k + ')h(' + (n - k) + ')=' + Fp(xa) + '\\cdot' + Fp(hv) : null; }).filter(Boolean);
              return '$y(' + n + ')$: the flipped $h(' + n + '-k)$ overlaps $x(k)$ at $k=' + x.v.map(function (_, i) { return x.n0 + i; }).filter(function (k) { return at(h, n - k); }).join(',') + '$: $' + tm.join('+') + '=' + at(y, n) + '$.';
            })) + QB.final(pk.map(function (n) { return 'y(' + n + ')=' + at(y, n); }).join(',\\ ')) },
          { q: '(b) Over which range of $n$ is $y(n)$ non-zero, and what is $\\sum_n y(n)$?', answers: [iA('first $n$', y.n0), iA('last $n$', y.n0 + Ny - 1), iA('$\\sum y$', sum(y.v))],
            working: QB.steps(['First sample at $n_x+n_h=' + y.n0 + '$; last at $' + (x.n0 + x.v.length - 1) + '+' + Fp(h.n0 + h.v.length - 1) + '=' + (y.n0 + Ny - 1) + '$.', '$\\sum y=(\\sum x)(\\sum h)=' + sum(x.v) + '\\times' + sum(h.v) + '=' + sum(y.v) + '$.']) + fin }
        ],
        data: { x: x, h: h, v: v, pk: pk }
      };
    }
  });

  add('sig', 'conv', 'closed', {
    title: 'Closed-form convolution with step limits',
    difficulty: 2, marks: 2,
    variants: [{ id: 'ab', label: 'aⁿu(n) * bⁿu(n), a ≠ b' }, { id: 'aa', label: 'aⁿu(n) * aⁿu(n)' }, { id: 'pulse', label: 'Finite pulse * aⁿu(n)' }],
    tags: ['Sample Test Q4(d)', 'T3 Q6(b)', 'D2 Q2'],
    gen: function (r, v) {
      var A = [0.5, 1 / 3, 0.25, -0.5, 2 / 3, 0.75, 0.8, 0.6, -1 / 3];
      if (v === 'pulse') {
        var a = r.pick([0.5, 0.25, 1 / 3, 0.8, -0.5]), M = r.int(3, 5), K = 0;
        for (var k = 0; k < M; k++) K += Math.pow(a, -k);
        var yv = function (n) { var s = 0; for (var k2 = 0; k2 < M; k2++) if (n - k2 >= 0) s += Math.pow(a, n - k2); return s; };
        var n1 = r.int(1, M - 2 >= 1 ? M - 2 : 1), n2 = M + r.int(0, 2);
        return {
          stem: 'Find $y(n)=x(n)*h(n)$ in closed form for $x(n)=u(n)-u(n-' + M + ')$ and $h(n)=' + powT(a) + 'u(n)$.',
          parts: [{ q: 'Evaluate $y(' + n1 + ')$ and $y(' + n2 + ')$, and find $K$ such that $y(n)=K' + powT(a) + '$ for $n\\ge' + (M - 1) + '$.', answers: [nA('$y(' + n1 + ')$', yv(n1), '', { abs: 0.002 }), nA('$y(' + n2 + ')$', yv(n2), '', { abs: 0.002 }), nA('$K$', K, '', { abs: 0.002 })],
            working: QB.steps([
              '$y(n)=\\sum_k x(k)h(n-k)=\\sum_k ' + Fp(a) + '^{\\,n-k}$ over $0\\le k\\le' + (M - 1) + '$ (from $x$) and $k\\le n$ (from $u(n-k)$).',
              '$n<0$: no overlap, $y=0$.',
              '$0\\le n\\le ' + (M - 1) + '$: $y(n)=\\sum_{k=0}^{n}' + Fp(a) + '^{n-k}=\\dfrac{1-' + Fp(a) + '^{n+1}}{1-' + Fp(a) + '}$. So $y(' + n1 + ')=' + F(yv(n1), 5) + '$.',
              '$n\\ge' + (M - 1) + '$: $y(n)=' + Fp(a) + '^n\\sum_{k=0}^{' + (M - 1) + '}' + Fp(a) + '^{-k}=K' + powT(a) + '$ with $K=' + range(0, M - 1).map(function (k) { return F(Math.pow(a, -k), 4); }).join('+') + '=' + F(K, 5) + '$.',
              'So $y(' + n2 + ')=' + F(K, 5) + '\\times' + Fp(a) + '^{' + n2 + '}=' + F(yv(n2), 5) + '$.'
            ]) + QB.final('y(n)=\\begin{cases}0 & n<0\\\\ \\dfrac{1-' + Fp(a) + '^{n+1}}{1-' + Fp(a) + '} & 0\\le n\\le ' + (M - 1) + '\\\\ ' + F(K, 5) + powT(a) + ' & n\\ge ' + (M - 1) + '\\end{cases}') }],
          notes: QB.callout('trap', 'A finite pulse gives separate cases in $n$, each with its own summation limits.'),
          data: { v: v, a: a, M: M, n1: n1, n2: n2 }
        };
      }
      var a1, b1;
      r.retry(function () { a1 = r.pick(A); b1 = v === 'aa' ? a1 : r.pick(A); return (v === 'aa' || Math.abs(a1 - b1) > 1e-9) ? true : null; });
      if (v === 'aa') {
        var y2 = 3 * a1 * a1, y3 = 4 * a1 * a1 * a1;
        return {
          stem: 'Find $y(n)=x(n)*h(n)$ in closed form for $x(n)=h(n)=' + powT(a1) + 'u(n)$.',
          parts: [{ q: 'Find the closed form, then evaluate $y(0)$, $y(2)$ and $y(3)$.', answers: [nA('$y(0)$', 1), nA('$y(2)$', y2, '', { abs: 0.002 }), nA('$y(3)$', y3, '', { abs: 0.002 })],
            working: QB.steps(['Both steps give $0\\le k\\le n$, so $y(n)=\\sum_{k=0}^{n}' + Fp(a1) + '^k' + Fp(a1) + '^{n-k}=' + Fp(a1) + '^n\\sum_{k=0}^{n}1=(n+1)' + powT(a1) + '$ for $n\\ge0$.', '$y(0)=1$, $y(2)=3' + Fp(a1) + '^2=' + F(y2, 5) + '$, $y(3)=4' + Fp(a1) + '^3=' + F(y3, 5) + '$.', 'The $a\\ne b$ formula would give $0/0$ here.']) + QB.final('y(n)=(n+1)' + powT(a1) + 'u(n)') }],
          data: { v: v, a: a1, b: a1 }
        };
      }
      var cA = a1 / (a1 - b1), cB = -b1 / (a1 - b1), yy2 = cA * a1 * a1 + cB * b1 * b1;
      return {
        stem: 'Find $y(n)=x(n)*h(n)$ in closed form for $x(n)=' + powT(a1) + 'u(n)$ and $h(n)=' + powT(b1) + 'u(n)$.',
        parts: [{ q: 'Write $y(n)=\\left[A' + powT(a1) + '+B' + powT(b1) + '\\right]u(n)$. Find $A$, $B$ and $y(2)$.', answers: [nA('$A$', cA, '', { abs: 0.002 }), nA('$B$', cB, '', { abs: 0.002 }), nA('$y(2)$', yy2, '', { abs: 0.002 })],
          working: QB.steps(['Turn the steps into limits: $u(k)\\Rightarrow k\\ge0$, $u(n-k)\\Rightarrow k\\le n$. So for $n\\ge0$: $y(n)=\\sum_{k=0}^{n}' + Fp(b1) + '^k' + Fp(a1) + '^{n-k}=' + Fp(a1) + '^n\\sum_{k=0}^{n}\\left(' + F(b1 / a1, 4) + '\\right)^k$.', 'Geometric sum: $=\\dfrac{a^{n+1}-b^{n+1}}{a-b}=\\dfrac{' + Fp(a1) + '^{n+1}-' + Fp(b1) + '^{n+1}}{' + F(a1 - b1, 4) + '}$.', '$A=\\dfrac{a}{a-b}=' + F(cA, 5) + '$, $B=\\dfrac{-b}{a-b}=' + F(cB, 5) + '$.', 'Check: $y(0)=A+B=1=h(0)x(0)$; $y(2)=' + F(yy2, 5) + '$.']) + QB.final('y(n)=\\left[' + J([[cA, powT(a1)], [cB, powT(b1)]]) + '\\right]u(n)') }],
        notes: QB.callout('trap', '$\\sum_{k=0}^{n}r^k$ has $n+1$ terms: the numerator is $1-r^{n+1}$.'),
        data: { v: v, a: a1, b: b1 }
      };
    }
  });

  add('sig', 'conv', 'interconnect', {
    title: 'Overall impulse response of interconnected systems',
    difficulty: 2, marks: 3,
    variants: [{ id: 'cascade', label: 'Cascade' }, { id: 'parallel', label: 'Parallel then cascade' }, { id: 'mixed', label: 'h₁ * (h₂ − h₃ * δ(n−d))' }],
    tags: ['T2 Q4', 'D2 Example 4'],
    gen: function (r, v) {
      var h1 = randSeq(r, r.int(2, 3), -2, 3, false), h2 = randSeq(r, r.int(2, 3), -2, 3, false), h3 = randSeq(r, 2, -2, 3, false);
      var S = function (a) { return { v: a, n0: 0 }; };
      var h, fig, expr, steps, sg = 1, dd = 1;
      if (v === 'cascade') {
        h = convS(S(h1), S(h2)); fig = blockFig([{ box: 'h_1(n)' }, { box: 'h_2(n)' }]); expr = 'h_1(n)*h_2(n)';
        steps = ['Blocks in series convolve (the order does not matter): $h=h_1*h_2$.', '$' + seqT(S(h1)) + '*' + seqT(S(h2)) + '=' + seqT(h) + '$.'];
      } else if (v === 'parallel') {
        sg = r.pick([1, -1]);
        var n = Math.max(h1.length, h2.length), p = { v: range(0, n - 1).map(function (i) { return (h1[i] || 0) + sg * (h2[i] || 0); }), n0: 0 };
        h = convS(p, S(h3)); fig = blockFig([{ split: [['h_1(n)'], ['h_2(n)']], signs: ['+', sg > 0 ? '+' : '-'] }, { box: 'h_3(n)' }]);
        expr = '\\big(h_1(n)' + (sg > 0 ? '+' : '-') + 'h_2(n)\\big)*h_3(n)';
        steps = ['Parallel paths add (' + (sg > 0 ? '+' : 'the lower path subtracts') + '): $h_1' + (sg > 0 ? '+' : '-') + 'h_2=' + seqT(p) + '$.', 'Then cascade with $h_3$: $' + seqT(p) + '*' + seqT(S(h3)) + '=' + seqT(h) + '$.'];
      } else {
        dd = r.pick([1, 2]);
        var h34 = { v: h3, n0: dd }, lo = 0, hi = Math.max(h2.length - 1, dd + h3.length - 1);
        var diff = { v: range(lo, hi).map(function (k) { return at(S(h2), k) - at(h34, k); }), n0: 0 };
        h = convS(S(h1), diff); fig = blockFig([{ box: 'h_1(n)' }, { split: [['h_2(n)'], ['h_3(n)', 'h_4(n)']], signs: ['+', '-'] }]);
        expr = 'h_1(n)*\\big(h_2(n)-h_3(n)*h_4(n)\\big)';
        steps = ['The lower path is a cascade, $h_3*h_4=h_3(n-' + dd + ')=' + seqT(h34) + '$ (convolving with $\\delta(n-' + dd + ')$ is a shift).', 'It enters the junction with a minus sign: $h_2-h_3*h_4=' + seqT(trim(diff)) + '$ (subtract sample by sample).', 'Cascade with $h_1$: $' + seqT(S(h1)) + '*' + seqT(trim(diff)) + '=' + seqT(h) + '$.'];
        h = { v: h.v, n0: h.n0 };
      }
      var ht = trim(h);
      return {
        stem: 'In the interconnection shown, $h_1(n)=' + seqT(S(h1)) + '$, $h_2(n)=' + seqT(S(h2)) + '$' + (v !== 'cascade' ? ', $h_3(n)=' + seqT(S(h3)) + '$' : '') + (v === 'mixed' ? ' and $h_4(n)=\\delta(n-' + dd + ')$' : '') + '.',
        figure: fig,
        parts: [{ q: 'Express $h(n)$ in terms of the blocks, then give every sample of the overall $h(n)$ from $n=0$ to $n=' + (ht.n0 + ht.v.length - 1) + '$.',
          answers: range(0, ht.n0 + ht.v.length - 1).map(function (n) { return iA('$h(' + n + ')$', at(ht, n)); }),
          working: QB.steps(['$h(n)=' + expr + '$.'].concat(steps).concat(['Causal ($h(n)=0$ for $n<0$) and FIR, hence stable.'])) + QB.final('h(n)=' + seqT(ht)) }],
        data: { v: v, h1: h1, h2: h2, h3: h3, sg: sg, dd: dd }
      };
    }
  });

  /* =====================================================================
   * freq.dtft — DTFT of finite sequences and exponentials (D3; T4 Q1)
   * ===================================================================== */
  var W0S = [PI / 2, PI / 3, 2 * PI / 3, PI / 4, 3 * PI / 4];
  function cxPolarT(z) { return F(z.abs(), 4) + 'e^{j' + F(z.arg(), 4) + '}'; }
  function expT(k) { return k === 0 ? '' : 'e^{' + (k > 0 ? '-' : '') + 'j' + (Math.abs(k) === 1 ? '' : Math.abs(k)) + '\\omega}'; }

  add('freq', 'dtft', 'finite', {
    title: 'DTFT of a finite sequence: evaluate X(ω)',
    difficulty: 2, marks: 3,
    variants: [{ id: 'general', label: 'General sequence' }, { id: 'even', label: 'Even sequence (real X)' }, { id: 'odd', label: 'Odd sequence (imaginary X)' }],
    tags: ['T4 Q1(d)', 'D3 N1'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var x;
        if (v === 'general') { var L = r.int(3, 5); x = { v: randSeq(r, L, -3, 4, false), n0: r.int(-(L - 1), 0) }; }
        else {
          var K = r.int(1, 2), side = randSeq(r, K, -3, 4, true);
          var c0 = v === 'even' ? r.int(-3, 5) : 0;
          var vv = side.slice().reverse().map(function (a) { return v === 'even' ? a : -a; }).concat([c0]).concat(side);
          x = { v: vv, n0: -K };
        }
        var w0 = r.pick(W0S), X = dtft(x, w0);
        if (X.abs() < 0.15) return null;
        if (v === 'general' && sum(x.v) === 0) return null;
        return { x: x, w0: w0, X: X };
      });
      var x = d.x, X0 = sum(x.v), Xpi = sum(x.v.map(function (a, i) { return (x.n0 + i) % 2 ? -a : a; }));
      var defn = 'X(\\omega)=\\sum_n x(n)e^{-j\\omega n}=' + J(x.v.map(function (a, i) { return [a, expT(x.n0 + i)]; }));
      var stem = 'Consider $x(n)=' + seqT(x) + '$ with DTFT $X(\\omega)$.', fig = stemFig([{ v: x.v, n0: x.n0, label: 'x(n)' }]);
      var chk = 'Check with the shortcuts: $X(0)=\\sum x(n)=' + X0 + '$ and $X(\\pi)=\\sum(-1)^nx(n)=' + Xpi + '$.';
      if (v === 'general') {
        return {
          stem: stem, figure: fig,
          parts: [
            { q: '(a) Write $X(\\omega)$ and find $X(0)$ and $X(\\pi)$.', answers: [iA('$X(0)$', X0), iA('$X(\\pi)$', Xpi)],
              working: QB.steps(['The arrow sets each exponent: $' + defn + '$.', chk]) + QB.final('X(0)=' + X0 + ',\\ X(\\pi)=' + Xpi) },
            { q: '(b) Find $|X(\\omega_0)|$ and $\\angle X(\\omega_0)$ at $\\omega_0=' + P(d.w0) + '$.', answers: [nA('$|X(\\omega_0)|$', d.X.abs()), rA('$\\angle X(\\omega_0)$', d.X.arg())],
              working: QB.steps(['Substitute $e^{-j\\omega_0 n}=\\cos(\\omega_0n)-j\\sin(\\omega_0n)$ for each sample:', QB.tbl(['$n$', '$x(n)$', '$e^{-j\\omega_0n}$'], x.v.map(function (a, i) { var n = x.n0 + i; return ['$' + n + '$', '$' + a + '$', '$' + cxT(QB.cx.polar(1, -deg(d.w0) * n), 4) + '$']; })), '$X(' + P(d.w0) + ')=' + cxT(d.X, 4) + '=' + cxPolarT(d.X) + '$.']) + QB.final('|X|=' + F(d.X.abs(), 4) + ',\\ \\angle X=' + F(d.X.arg(), 4) + '\\ \\text{rad}') }
          ],
          data: { x: x, w0: d.w0, v: v }
        };
      }
      var K2 = -x.n0, cf = range(1, K2).map(function (k) { return at(x, k); });
      if (v === 'even') {
        var real = 'X(\\omega)=' + J([[at(x, 0), '']].concat(cf.map(function (c, i) { return [2 * c, '\\cos' + (i ? '(' + (i + 1) + '\\omega)' : '\\omega')]; })));
        return {
          stem: stem, figure: fig,
          parts: [{ q: 'Write $X(\\omega)$ in real form. Evaluate $X(0)$, $X(\\pi)$ and $X(' + P(d.w0) + ')$.', answers: [iA('$X(0)$', X0), iA('$X(\\pi)$', Xpi), nA('$X(\\omega_0)$', d.X.re, '', { abs: 0.002 })],
            working: QB.steps(['$' + defn + '$.', 'Pair $n$ with $-n$: $e^{j k\\omega}+e^{-jk\\omega}=2\\cos(k\\omega)$, so $' + real + '$. Real and even $x$ gives real, even $X$.', 'At $\\omega_0=' + P(d.w0) + '$: $X=' + F(d.X.re, 5) + '$.', chk]) + QB.final(real) }],
          data: { x: x, w0: d.w0, v: v }
        };
      }
      var im = 'X(\\omega)=-2j\\left[' + J(cf.map(function (c, i) { return [c, '\\sin' + (i ? '(' + (i + 1) + '\\omega)' : '\\omega')]; })) + '\\right]';
      return {
        stem: stem, figure: fig,
        parts: [{ q: 'Write $X(\\omega)$ using Euler\'s identity. Give $\\mathrm{Im}\\,X(\\omega_0)$ at $\\omega_0=' + P(d.w0) + '$, and $X(0)$.', answers: [nA('$\\mathrm{Im}\\,X(\\omega_0)$', d.X.im, '', { abs: 0.002 }), iA('$X(0)$', 0)],
          working: QB.steps(['$' + defn + '$.', 'Pair $n$ with $-n$: $-e^{jk\\omega}+e^{-jk\\omega}=-2j\\sin(k\\omega)$, so $' + im + '$. Real, odd $x$ gives purely imaginary, odd $X$.', 'At $\\omega_0$: $X=' + cxT(QB.cx(0, d.X.im), 5) + '$. $X(0)=\\sum x=0$.']) + QB.final(im) }],
        data: { x: x, w0: d.w0, v: v }
      };
    }
  });

  add('freq', 'dtft', 'exp', {
    title: 'DTFT of exponential sequences (right-, left- and two-sided)',
    difficulty: 2, marks: 3,
    variants: [{ id: 'right', label: 'aⁿu(n − n₀)' }, { id: 'left', label: 'bⁿu(−n)' }, { id: 'two', label: 'a^|n|' }],
    tags: ['T4 Q1(b)(c)', 'D3 Example 1'],
    gen: function (r, v) {
      var X0, Xpi, Xh, form, steps, data;
      if (v === 'left') {
        var b = r.pick([2, 3, -2, 4, 1.25, -3]), ib = 1 / b;
        X0 = 1 / (1 - ib); Xpi = 1 / (1 + ib); Xh = 1 / Math.sqrt(1 + ib * ib);
        form = '\\frac{1}{1-' + Fp(ib, 4) + 'e^{j\\omega}}';
        steps = ['Left-sided: substitute $m=-n$: $X(\\omega)=\\sum_{n=-\\infty}^{0}' + Fp(b) + '^ne^{-j\\omega n}=\\sum_{m=0}^{\\infty}\\left(' + F(ib, 4) + 'e^{j\\omega}\\right)^m$.', 'Converges since $|1/b|=' + F(Math.abs(ib), 4) + '<1$: $X(\\omega)=' + form + '$.'];
        data = { v: v, b: b };
        var stem = 'Compute the DTFT of $x(n)=' + Fp(b) + '^nu(-n)$.';
      } else if (v === 'two') {
        var a2 = r.pick([0.5, 0.8, 0.25, 0.6, -0.5, 0.9]);
        X0 = (1 + a2) / (1 - a2); Xpi = (1 - a2) / (1 + a2); Xh = (1 - a2 * a2) / (1 + a2 * a2);
        form = '\\frac{' + F(1 - a2 * a2, 4) + '}{' + F(1 + a2 * a2, 4) + (a2 > 0 ? '-' : '+') + F(Math.abs(2 * a2), 4) + '\\cos\\omega}';
        steps = ['Two-sided: split at $n=0$. $\\sum_{n\\ge0}(' + F(a2) + 'e^{-j\\omega})^n+\\sum_{m\\ge1}(' + F(a2) + 'e^{j\\omega})^m=\\dfrac{1}{1-' + Fp(a2) + 'e^{-j\\omega}}+\\dfrac{' + F(a2) + 'e^{j\\omega}}{1-' + Fp(a2) + 'e^{j\\omega}}$ (do not count $n=0$ twice).', 'Combine: $X(\\omega)=\\dfrac{1-a^2}{1-2a\\cos\\omega+a^2}=' + form + '$, real and even.'];
        data = { v: v, a: a2 };
        stem = 'Compute the DTFT of $x(n)=' + (a2 < 0 ? '(' + F(a2) + ')' : F(a2)) + '^{|n|}$.';
      } else {
        var a = r.pick([0.5, -0.5, 1 / 3, 0.8, 0.25, -0.8, 0.6]), n0 = r.pick([-3, -2, -1, 1, 2, 3]);
        var c = Math.pow(a, n0);
        X0 = c / (1 - a); Xpi = c * (n0 % 2 ? -1 : 1) / (1 + a); Xh = Math.abs(c) / Math.sqrt(1 + a * a);
        form = '\\frac{' + F(c, 4) + 'e^{' + (n0 > 0 ? '-' : '') + 'j' + (Math.abs(n0) === 1 ? '' : Math.abs(n0)) + '\\omega}}{1-' + Fp(a, 4) + 'e^{-j\\omega}}';
        steps = ['Right-sided starting at $n=' + n0 + '$, and $|a|=' + F(Math.abs(a), 4) + '<1$. Let $m=n' + (n0 > 0 ? '-' : '+') + Math.abs(n0) + '$: $X(\\omega)=\\sum_{m=0}^{\\infty}' + Fp(a, 4) + '^{m' + (n0 > 0 ? '+' : '-') + Math.abs(n0) + '}e^{-j\\omega(m' + (n0 > 0 ? '+' : '-') + Math.abs(n0) + ')}$.', 'Pull out the constant $a^{' + n0 + '}e^{' + (n0 > 0 ? '-' : '') + 'j' + Math.abs(n0) + '\\omega}=' + F(c, 4) + 'e^{' + (n0 > 0 ? '-' : '') + 'j' + Math.abs(n0) + '\\omega}$ and sum the geometric series: $X(\\omega)=' + form + '$.'];
        data = { v: v, a: a, n0: n0 };
        stem = 'Compute the DTFT of $x(n)=' + powT(a) + 'u(n' + (n0 > 0 ? '-' + n0 : '+' + (-n0)) + ')$.';
      }
      return {
        stem: stem,
        parts: [
          { q: '(a) Find $X(\\omega)$, then evaluate $X(0)$ and $X(\\pi)$.', answers: [nA('$X(0)$', X0, '', { abs: 0.002 }), nA('$X(\\pi)$', Xpi, '', { abs: 0.002 })],
            working: QB.steps(steps.concat(['$X(0)$: set $e^{\\pm j0}=1$: $' + F(X0, 5) + '$. $X(\\pi)$: set $e^{\\pm j\\pi}=-1$: $' + F(Xpi, 5) + '$. (Check: $X(0)=\\sum x(n)$.)'])) + QB.final('X(\\omega)=' + form) },
          { q: '(b) Find $|X(\\pi/2)|$.', answers: [nA('$|X(\\pi/2)|$', Xh, '', { abs: 0.002 })],
            working: QB.steps(['At $\\omega=\\pi/2$, $e^{\\mp j\\pi/2}=\\mp j$. Substitute and take the magnitude: $|X(\\pi/2)|=' + F(Xh, 5) + '$.']) + QB.final('|X(\\pi/2)|=' + F(Xh, 4)) }
        ],
        notes: QB.callout('trap', 'State the convergence condition ($|ae^{-j\\omega}|<1$) before summing. $2^nu(n)$ has no DTFT, but $2^nu(-n)$ does.'),
        data: data
      };
    }
  });

  add('freq', 'dtft', 'pulse', {
    title: 'Rectangular pulse: DTFT, nulls and main lobe',
    difficulty: 2, marks: 3,
    variants: [{ id: 'causal', label: 'u(n) − u(n − M)' }, { id: 'centred', label: 'Symmetric about n = 0' }],
    tags: ['T4 Q1(a)', 'D3 figure'],
    gen: function (r, v) {
      var M = v === 'causal' ? r.int(3, 8) : 2 * r.int(1, 3) + 1, K = (M - 1) / 2;
      var w1 = PI / M, mag1 = 1 / Math.sin(PI / (2 * M));
      var Xpi = v === 'causal' ? (M % 2 ? 1 : 0) : (K % 2 ? -1 : 1);
      var th = v === 'causal' ? -(M - 1) * w1 / 2 : 0;
      var form = v === 'causal' ? 'e^{-j' + (M - 1 === 2 ? '' : F((M - 1) / 2)) + '\\omega}\\frac{\\sin(' + (M === 2 ? '' : F(M / 2)) + '\\omega)}{\\sin(\\omega/2)}' : '\\frac{\\sin(' + F(M / 2) + '\\omega)}{\\sin(\\omega/2)}';
      var xs = v === 'causal' ? { v: range(0, M - 1).map(function () { return 1; }), n0: 0 } : { v: range(0, M - 1).map(function () { return 1; }), n0: -K };
      return {
        stem: 'Let $x(n)=' + (v === 'causal' ? 'u(n)-u(n-' + M + ')' : 'u(n+' + K + ')-u(n-' + (K + 1) + ')') + '$, a pulse of $M=' + M + '$ ones.',
        figure: stemFig([{ v: xs.v, n0: xs.n0, label: 'x(n)' }]),
        parts: [
          { q: '(a) Find $X(\\omega)$ and $X(0)$.', answers: [iA('$X(0)$', M)],
            working: QB.steps(['Finite geometric series with $M=' + M + '$ terms: $X(\\omega)=' + (v === 'causal' ? '\\sum_{n=0}^{' + (M - 1) + '}e^{-j\\omega n}=\\dfrac{1-e^{-j' + M + '\\omega}}{1-e^{-j\\omega}}' : '\\sum_{n=-' + K + '}^{' + K + '}e^{-j\\omega n}') + '$.', 'Factor out half-angle exponentials: $X(\\omega)=' + form + '$' + (v === 'causal' ? ' (linear phase).' : ' (real, since $x$ is even).'), '$X(0)=\\sum x(n)=M=' + M + '$.']) + QB.final('X(\\omega)=' + form) },
          { q: '(b) Find the first null $\\omega_1>0$ and the null-to-null main-lobe width.', answers: [rA('$\\omega_1$', 2 * PI / M), rA('width', 4 * PI / M)],
            working: QB.steps(['$\\sin(M\\omega/2)=0$ at $\\omega=2\\pi k/M$, $k\\ne0$, so $\\omega_1=2\\pi/' + M + '=' + P(2 * PI / M) + '$.', 'Main lobe from $-2\\pi/M$ to $2\\pi/M$: width $4\\pi/M=' + P(4 * PI / M) + '$. A longer pulse gives a narrower lobe.']) + QB.final('\\omega_1=' + P(2 * PI / M)) },
          { q: '(c) Evaluate $X(\\pi)$, $|X(\\pi/' + M + ')|$ and $\\angle X(\\pi/' + M + ')$.', answers: [iA('$X(\\pi)$', Xpi), nA('$|X(\\pi/' + M + ')|$', mag1), rA('$\\angle X(\\pi/' + M + ')$', th)],
            working: QB.steps(['$X(\\pi)=\\sum(-1)^nx(n)=' + Xpi + '$.', 'At $\\omega=\\pi/' + M + '$: $\\sin(M\\omega/2)=\\sin(\\pi/2)=1$, so $|X|=1/\\sin(\\pi/' + 2 * M + ')=' + F(mag1, 4) + '$.', v === 'causal' ? 'The amplitude is positive inside the main lobe, so $\\angle X=-' + F((M - 1) / 2) + '\\omega=' + P(th) + '$.' : '$X$ is real and positive here, so the phase is 0.']) + QB.final('|X(\\pi/' + M + ')|=' + F(mag1, 4)) }
        ],
        notes: QB.callout('tip', 'Course convention: $\\operatorname{sinc}x=\\sin x/x$. The pulse spectrum $\\sin(M\\omega/2)/\\sin(\\omega/2)$ is the periodic ("digital sinc") version.'),
        data: { v: v, M: M }
      };
    }
  });

  /* =====================================================================
   * freq.dtftprop — shortcuts and properties (D3 Playbooks B and C; T4 Q2)
   * ===================================================================== */
  add('freq', 'dtftprop', 'shortcuts', {
    title: 'DTFT quantities without computing X(ω)',
    difficulty: 1, marks: 5,
    variants: [{ id: 'basic', label: 'X(0), ∠X(0), ∫X, X(π), ∫|X|²' }, { id: 'extended', label: '∫X e^{jωn₀}, X′(0), ∫|X′|²' }, { id: 'infinite', label: 'Infinite sequence aⁿu(n)' }],
    tags: ['T4 Q2', 'DX2 Q3', 'D3 N3'],
    gen: function (r, v) {
      if (v === 'infinite') {
        var a = r.pick([0.5, -0.5, 0.25, 0.8, -0.8, 0.6, 1 / 3]);
        var E = 1 / (1 - a * a);
        return {
          stem: 'Let $x(n)=' + powT(a) + 'u(n)$ with DTFT $X(\\omega)$. Without writing $X(\\omega)$, find:',
          parts: [{ q: '$X(0)$, $X(\\pi)$, $\\int_{-\\pi}^{\\pi}X(\\omega)\\,d\\omega$ and $\\int_{-\\pi}^{\\pi}|X(\\omega)|^2d\\omega$. (You may type answers such as 2pi.)',
            answers: [nA('$X(0)$', 1 / (1 - a)), nA('$X(\\pi)$', 1 / (1 + a)), nA('$\\int X$', 2 * PI), nA('$\\int|X|^2$', 2 * PI * E)],
            working: QB.steps(['$X(0)=\\sum_{n\\ge0}' + Fp(a, 4) + '^n=\\dfrac{1}{1-' + Fp(a, 4) + '}=' + F(1 / (1 - a), 5) + '$.', '$X(\\pi)=\\sum(-1)^n' + Fp(a, 4) + '^n=\\dfrac{1}{1+' + Fp(a, 4) + '}=' + F(1 / (1 + a), 5) + '$.', '$\\int X\\,d\\omega=2\\pi x(0)=2\\pi$.', 'Parseval: $\\int|X|^2d\\omega=2\\pi\\sum' + Fp(a * a, 4) + '^n=\\dfrac{2\\pi}{1-' + F(a * a, 4) + '}=' + F(2 * PI * E, 5) + '$.']) + QB.final('2\\pi E_x=' + F(2 * PI * E, 5)) }],
          data: { v: v, a: a }
        };
      }
      var d = r.retry(function () {
        var L = r.int(5, 6), x = { v: randSeq(r, L, -4, 4, false), n0: r.int(-(L - 2), -1) };
        if (sum(x.v) === 0 || at(x, 0) === 0) return null;
        return x;
      });
      var x = d, X0 = sum(x.v), Xpi = sum(x.v.map(function (a, i) { return (x.n0 + i) % 2 ? -a : a; })), E = sum(x.v.map(function (a) { return a * a; }));
      var idx = '$' + x.v.map(function (a, i) { return 'x(' + (x.n0 + i) + ')=' + a; }).join(',\\ ') + '$';
      if (v === 'basic') {
        return {
          stem: 'Consider $x(n)=' + seqT(x) + '$ with DTFT $X(\\omega)$. Compute the following without explicitly computing $X(\\omega)$. (You may type multiples of π, e.g. -6pi.)',
          figure: stemFig([{ v: x.v, n0: x.n0, label: 'x(n)' }]),
          parts: [{ q: '$X(0)$, $\\angle X(0)$, $\\int_{-\\pi}^{\\pi}X(\\omega)d\\omega$, $X(\\pi)$ and $\\int_{-\\pi}^{\\pi}|X(\\omega)|^2d\\omega$.',
            answers: [iA('$X(0)$', X0), Object.assign(rA('$\\angle X(0)$', X0 > 0 ? 0 : PI), X0 < 0 ? { alt: [-PI] } : {}), nA('$\\int X$', 2 * PI * at(x, 0)), iA('$X(\\pi)$', Xpi), nA('$\\int|X|^2$', 2 * PI * E)],
            working: QB.steps(['Indices from the arrow: ' + idx + '.', '$X(0)=\\sum x(n)=' + X0 + '$.', '$\\angle X(0)=' + (X0 > 0 ? '0' : '\\pm\\pi') + '$ (' + (X0 > 0 ? 'positive real' : 'a negative real number has phase $\\pm\\pi$, not 0') + ').', '$\\int X\\,d\\omega=2\\pi x(0)=2\\pi(' + at(x, 0) + ')=' + F(2 * at(x, 0)) + '\\pi$.', '$X(\\pi)=\\sum(-1)^nx(n)=' + Xpi + '$ (odd $n$, negative ones too, get a minus sign).', 'Parseval: $\\int|X|^2d\\omega=2\\pi\\sum|x|^2=2\\pi(' + E + ')=' + 2 * E + '\\pi$.']) + QB.final('X(0)=' + X0 + ',\\ X(\\pi)=' + Xpi + ',\\ \\int|X|^2=' + 2 * E + '\\pi') }],
          data: { v: v, x: x }
        };
      }
      var cand = x.v.map(function (a, i) { return x.n0 + i; }).filter(function (n) { return n !== 0 && at(x, n) !== 0; });
      var n1 = r.pick(cand), S1 = sum(x.v.map(function (a, i) { return (x.n0 + i) * a; })), S2 = sum(x.v.map(function (a, i) { return (x.n0 + i) * (x.n0 + i) * a * a; }));
      return {
        stem: 'Consider $x(n)=' + seqT(x) + '$ with DTFT $X(\\omega)$. Compute the following without explicitly computing $X(\\omega)$. (You may type multiples of π.)',
        figure: stemFig([{ v: x.v, n0: x.n0, label: 'x(n)' }]),
        parts: [{ q: '$\\int_{-\\pi}^{\\pi}X(\\omega)e^{j' + (n1 === 1 ? '' : n1 === -1 ? '-' : n1) + '\\omega}d\\omega$, the imaginary part of $\\left.\\dfrac{dX}{d\\omega}\\right|_{\\omega=0}$, and $\\int_{-\\pi}^{\\pi}\\left|\\dfrac{dX}{d\\omega}\\right|^2d\\omega$.',
          answers: [nA('$\\int Xe^{j\\omega n_0}$', 2 * PI * at(x, n1)), iA('$\\mathrm{Im}\\,X\'(0)$', -S1), nA('$\\int|X\'|^2$', 2 * PI * S2)],
          working: QB.steps(['Indices from the arrow: ' + idx + '.', 'Inverse DTFT at $n=' + n1 + '$: $\\int Xe^{j\\omega n_0}d\\omega=2\\pi x(' + n1 + ')=' + F(2 * at(x, n1)) + '\\pi$. (Using $x(' + (-n1) + ')$ by mistake gives $' + F(2 * at(x, -n1)) + '\\pi$.)', 'Differentiate the definition: $X\'(0)=-j\\sum n\\,x(n)=-j(' + S1 + ')$, so $\\mathrm{Im}\\,X\'(0)=' + (-S1) + '$.', 'Parseval on $n\\,x(n)\\leftrightarrow j\\,dX/d\\omega$: $\\int|X\'|^2=2\\pi\\sum n^2|x(n)|^2=2\\pi(' + S2 + ')=' + 2 * S2 + '\\pi$.']) + QB.final('2\\pi x(' + n1 + ')=' + F(2 * at(x, n1)) + '\\pi,\\ X\'(0)=' + cxT(QB.cx(0, -S1)) + ',\\ ' + 2 * S2 + '\\pi') }],
        data: { v: v, x: x, n1: n1 }
      };
    }
  });

  add('freq', 'dtftprop', 'modify', {
    title: 'DTFT of a modified signal using properties',
    difficulty: 2, marks: 3,
    variants: [{ id: 'nx', label: 'n x(n) (differentiation)' }, { id: 'mod', label: '(−1)ⁿ x(n − n₀) (shift + modulation)' }, { id: 'rev', label: 'x(−n + n₀) (reversal + shift)' }, { id: 'expand', label: 'Time expansion x₍₂₎(n)' }, { id: 'cos', label: 'cos(πn/2) x(n)' }],
    tags: ['D3 Example 3', 'D3 Playbook C'],
    gen: function (r, v) {
      var a = r.pick([0.5, -0.5, 0.25, 0.8, 0.6, 1 / 3]), n0 = r.int(1, 3);
      var Xw = function (w) { return QB.cx(1, 0).div(QB.cx(1, 0).sub(QB.cx.polar(a, -deg(w)))); };
      var y, Y, ydesc, chain, Yform, third, thirdLabel;
      if (v === 'nx') {
        ydesc = 'n' + powT(a) + 'u(n)'; Y = function (w) { var e = QB.cx.polar(a, -deg(w)); var dd = QB.cx(1, 0).sub(e); return e.div(dd.mul(dd)); };
        chain = ['Differentiation in frequency: $n\\,x(n)\\leftrightarrow j\\,\\dfrac{dX}{d\\omega}$.', '$\\dfrac{dX}{d\\omega}=\\dfrac{-ja e^{-j\\omega}}{(1-ae^{-j\\omega})^2}$, so $Y(\\omega)=j\\cdot\\dfrac{-jae^{-j\\omega}}{(1-ae^{-j\\omega})^2}$.'];
        Yform = '\\frac{' + F(a, 4) + 'e^{-j\\omega}}{(1-' + Fp(a, 4) + 'e^{-j\\omega})^2}';
      } else if (v === 'mod') {
        ydesc = '(-1)^n' + powT(a).replace('^n', '^{n-' + n0 + '}') + 'u(n-' + n0 + ')';
        Y = function (w) { return QB.cx.polar(1, -deg(w - PI) * n0).mul(Xw(w - PI)); };
        chain = ['Inner operation first: delay by ' + n0 + ', $x(n-' + n0 + ')\\leftrightarrow e^{-j' + n0 + '\\omega}X(\\omega)$.', 'Then modulation: $(-1)^n=e^{j\\pi n}$ shifts the spectrum by $\\pi$: $Y(\\omega)=e^{-j' + n0 + '(\\omega-\\pi)}X(\\omega-\\pi)$.'];
        Yform = '\\frac{(-1)^{' + n0 + '}e^{-j' + n0 + '\\omega}}{1+' + Fp(a, 4) + 'e^{-j\\omega}}';
      } else if (v === 'rev') {
        ydesc = 'x(-n+' + n0 + ')';
        Y = function (w) { return QB.cx.polar(1, -deg(w) * n0).mul(Xw(-w)); };
        chain = ['Write $x(-n+' + n0 + ')=x(-(n-' + n0 + '))$: reverse first, then delay by ' + n0 + '.', 'Time reversal: $x(-n)\\leftrightarrow X(-\\omega)$. Delay: multiply by $e^{-j' + n0 + '\\omega}$. So $Y(\\omega)=e^{-j' + n0 + '\\omega}X(-\\omega)$.'];
        Yform = '\\frac{e^{-j' + n0 + '\\omega}}{1-' + Fp(a, 4) + 'e^{j\\omega}}';
      } else if (v === 'expand') {
        ydesc = 'x_{(2)}(n)'; Y = function (w) { return Xw(2 * w); };
        chain = ['Time expansion by 2 (a zero between samples): $x_{(2)}(n)\\leftrightarrow X(2\\omega)$, which compresses the spectrum.'];
        Yform = '\\frac{1}{1-' + Fp(a, 4) + 'e^{-j2\\omega}}';
      } else {
        ydesc = '\\cos(\\pi n/2)\\,x(n)'; Y = function (w) { return Xw(w - PI / 2).add(Xw(w + PI / 2)).scale(0.5); };
        chain = ['Modulation: $\\cos(\\omega_0 n)x(n)\\leftrightarrow\\tfrac12[X(\\omega-\\omega_0)+X(\\omega+\\omega_0)]$ with $\\omega_0=\\pi/2$.'];
        Yform = '\\tfrac12\\left[X(\\omega-\\tfrac{\\pi}{2})+X(\\omega+\\tfrac{\\pi}{2})\\right]';
      }
      var Y0 = Y(0).re, Ypi = Y(PI).re, Yh = Y(PI / 2);
      if (v === 'expand' || v === 'cos') { third = Yh.re; thirdLabel = '$Y(\\pi/2)$'; } else { third = Yh.abs(); thirdLabel = '$|Y(\\pi/2)|$'; }
      return {
        stem: 'Let $x(n)=' + powT(a) + 'u(n)\\leftrightarrow X(\\omega)=\\dfrac{1}{1-' + Fp(a, 4) + 'e^{-j\\omega}}$. Find the DTFT $Y(\\omega)$ of $y(n)=' + ydesc + '$' + (v === 'expand' ? ' (zeros inserted between the samples of $x$)' : '') + '.',
        parts: [{ q: 'Find $Y(\\omega)$ using properties, then evaluate $Y(0)$, $Y(\\pi)$ and ' + thirdLabel + '.', answers: [nA('$Y(0)$', Y0, '', { abs: 0.002 }), nA('$Y(\\pi)$', Ypi, '', { abs: 0.002 }), nA(thirdLabel, third, '', { abs: 0.002 })],
          working: QB.steps(chain.concat(['$Y(\\omega)=' + Yform + '$.', '$Y(0)=' + F(Y0, 5) + '$, $Y(\\pi)=' + F(Ypi, 5) + '$, ' + thirdLabel + ' $=' + F(third, 5) + '$.', v === 'expand' ? 'Note $Y(\\pi)=X(2\\pi)=X(0)$: upsampling puts an image of the DC peak at $\\omega=\\pi$.' : v === 'mod' ? 'The modulation swaps low and high frequencies: $Y(\\pi)=X(0)$ up to the delay phase.' : ''])) + QB.final('Y(\\omega)=' + Yform) }],
        notes: QB.callout('tip', 'Apply one property per line, innermost operation first, and name each property. Check $Y(0)=\\sum y(n)$.'),
        data: { v: v, a: a, n0: n0 }
      };
    }
  });

  add('freq', 'dtftprop', 'convexp', {
    title: 'Convolution property with exponentials, then upsampling',
    difficulty: 2, marks: 4,
    variants: [{ id: 'distinct', label: 'aⁿu(n) * bⁿu(n)' }, { id: 'same', label: 'aⁿu(n) * aⁿu(n)' }],
    tags: ['D3 N4', 'convolution property'],
    gen: function (r, v) {
      var a, b;
      r.retry(function () { a = r.pick([0.5, -0.5, 0.25, 0.8, 1 / 3]); b = v === 'same' ? a : r.pick([0.5, -0.5, 0.25, 0.8, 1 / 3]); return v === 'same' || Math.abs(a - b) > 1e-9 ? true : null; });
      var Y0 = 1 / ((1 - a) * (1 - b)), Ypi = 1 / ((1 + a) * (1 + b)), y3 = 0;
      for (var k = 0; k <= 3; k++) y3 += Math.pow(a, k) * Math.pow(b, 3 - k);
      return {
        stem: 'Let $x_1(n)=' + powT(a) + 'u(n)$, $x_2(n)=' + powT(b) + 'u(n)$ and $y(n)=x_1(n)*x_2(n)$. Let $v(n)=y_{(2)}(n)$, the time expansion of $y$ by 2.',
        parts: [
          { q: '(a) Find $Y(\\omega)$, $Y(0)$ and $Y(\\pi)$.', answers: [nA('$Y(0)$', Y0, '', { abs: 0.002 }), nA('$Y(\\pi)$', Ypi, '', { abs: 0.002 })],
            working: QB.steps(['Convolution property: $Y(\\omega)=X_1(\\omega)X_2(\\omega)=\\dfrac{1}{(1-' + Fp(a, 4) + 'e^{-j\\omega})(1-' + Fp(b, 4) + 'e^{-j\\omega})}$.', '$Y(0)=\\dfrac{1}{(' + F(1 - a, 4) + ')(' + F(1 - b, 4) + ')}=' + F(Y0, 5) + '$; $Y(\\pi)=\\dfrac{1}{(' + F(1 + a, 4) + ')(' + F(1 + b, 4) + ')}=' + F(Ypi, 5) + '$.']) + QB.final('Y(0)=' + F(Y0, 5) + ',\\ Y(\\pi)=' + F(Ypi, 5)) },
          { q: '(b) Find $y(3)$.', answers: [nA('$y(3)$', y3, '', { abs: 0.002 })],
            working: QB.steps([v === 'same' ? '$a^nu(n)*a^nu(n)=(n+1)a^nu(n)$ (equivalently $1/(1-ae^{-j\\omega})^2$), so $y(3)=4' + Fp(a, 4) + '^3=' + F(y3, 5) + '$.' : '$a^nu(n)*b^nu(n)=\\dfrac{a^{n+1}-b^{n+1}}{a-b}u(n)$, so $y(3)=\\dfrac{' + Fp(a, 4) + '^4-' + Fp(b, 4) + '^4}{' + F(a - b, 4) + '}=' + F(y3, 5) + '$.']) + QB.final('y(3)=' + F(y3, 5)) },
          { q: '(c) Find $V(\\pi/2)$ and $V(\\pi)$.', answers: [nA('$V(\\pi/2)$', Ypi, '', { abs: 0.002 }), nA('$V(\\pi)$', Y0, '', { abs: 0.002 })],
            working: QB.steps(['Time expansion: $V(\\omega)=Y(2\\omega)$.', '$V(\\pi/2)=Y(\\pi)=' + F(Ypi, 5) + '$ and $V(\\pi)=Y(2\\pi)=Y(0)=' + F(Y0, 5) + '$ (the image created by upsampling).']) + QB.final('V(\\pi)=Y(0)=' + F(Y0, 5)) }
        ],
        data: { v: v, a: a, b: b }
      };
    }
  });

  /* =====================================================================
   * freq.freqresp — H(ω), sinusoidal steady state (D4 Playbooks A–C)
   * ===================================================================== */
  function phAns(label, w) { var a = rA(label, w); a.alt = (a.alt || []).concat([w + 2 * PI, w - 2 * PI]); return a; }
  function ampPhaseT(z) { return '|H|=' + F(z.abs(), 4) + ',\\ \\theta=' + F(z.arg(), 4) + '\\ \\text{rad}'; }

  add('freq', 'freqresp', 'fir', {
    title: 'FIR frequency response: magnitude and phase at ω₀',
    difficulty: 2, marks: 3,
    variants: [{ id: 'symmetric', label: 'Symmetric (linear phase)' }, { id: 'general', label: 'General taps' }],
    tags: ['T4 Q4(a)', 'D4 N1', 'DX1 Q3'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var h;
        if (v === 'symmetric') { var M = r.int(3, 5), half = randSeq(r, Math.ceil(M / 2), -2, 3, false); h = half.concat(half.slice(0, Math.floor(M / 2)).reverse()); }
        else h = randSeq(r, r.int(2, 4), -3, 3, false);
        var w0 = r.pick([PI / 6, PI / 4, PI / 3, PI / 2, 2 * PI / 3, 3 * PI / 4, 5 * PI / 6]), H = polyE(h, w0);
        if (H.abs() < 0.1) return null;
        return { h: h, w0: w0, H: H };
      });
      var h = d.h, M = h.length, H0 = sum(h), Hpi = sum(h.map(function (a, k) { return k % 2 ? -a : a; }));
      var Ht = 'H(\\omega)=' + J(h.map(function (a, k) { return [a, expT(k)]; }));
      var steps = ['DTFT both sides (time-shift property): $' + Ht + '$.'];
      if (v === 'symmetric') {
        var Kc = (M - 1) / 2, terms = [];
        for (var k = 0; k < Math.floor(M / 2); k++) terms.push([2 * h[k], '\\cos(' + (Kc - k === 1 ? '' : F(Kc - k)) + '\\omega)']);
        if (M % 2) terms.push([h[Kc], '']);
        var Am = J(terms), Aw = d.H.mul(QB.cx.polar(1, deg(Kc * d.w0))).re;
        steps.push('Symmetric taps: factor out the middle delay: $H(\\omega)=e^{-j' + (Kc === 1 ? '' : F(Kc)) + '\\omega}\\left[' + Am + '\\right]$.');
        steps.push('At $\\omega_0=' + P(d.w0) + '$ the real amplitude is $' + F(Aw, 5) + '$' + (Aw < 0 ? ', which is negative: $|H|=' + F(-Aw, 5) + '$ and add $\\pi$ to the phase.' : ', so $|H|=' + F(Aw, 5) + '$.'));
        steps.push('$\\theta(\\omega_0)=-' + (Kc === 1 ? '' : F(Kc)) + '\\omega_0' + (Aw < 0 ? '+\\pi' : '') + '=' + F(-Kc * d.w0 + (Aw < 0 ? PI : 0), 4) + '$ rad' + (Math.abs(wrapPi(-Kc * d.w0 + (Aw < 0 ? PI : 0)) - (-Kc * d.w0 + (Aw < 0 ? PI : 0))) > 1e-9 ? ', i.e. $' + F(d.H.arg(), 4) + '$ rad in $(-\\pi,\\pi]$.' : '.'));
        steps.push('Group delay $=' + F(Kc) + '$ samples (linear phase).');
      } else {
        steps.push('At $\\omega_0=' + P(d.w0) + '$: $H=' + h.map(function (a, k) { return Fp(a) + '(' + cxT(QB.cx.polar(1, -deg(d.w0) * k), 4) + ')'; }).join('+') + '=' + cxT(d.H, 4) + '$.');
        steps.push('$|H|=' + F(d.H.abs(), 4) + '$, $\\theta=\\tan^{-1}$ in the right quadrant $=' + F(d.H.arg(), 4) + '$ rad.');
      }
      return {
        stem: 'An FIR system has $h(n)=' + seqT({ v: h, n0: 0 }) + '$.',
        figure: stemFig([{ v: h, n0: 0, label: 'h(n)' }]),
        parts: [
          { q: '(a) Find $H(0)$ and $H(\\pi)$.', answers: [iA('$H(0)$', H0), iA('$H(\\pi)$', Hpi)], working: QB.steps(['$H(0)=\\sum h(n)=' + H0 + '$; $H(\\pi)=\\sum(-1)^nh(n)=' + Hpi + '$.']) + QB.final('H(0)=' + H0 + ',\\ H(\\pi)=' + Hpi) },
          { q: '(b) Find $|H(\\omega_0)|$ and $\\theta(\\omega_0)$ at $\\omega_0=' + P(d.w0) + '$.', answers: [nA('$|H(\\omega_0)|$', d.H.abs()), phAns('$\\theta(\\omega_0)$', d.H.arg())],
            working: QB.steps(steps) + QB.final(ampPhaseT(d.H)) }
        ],
        notes: QB.callout('trap', 'A magnitude is never negative. If the real amplitude is negative, its sign goes into the phase as $\\pm\\pi$.'),
        data: { h: h, w0: d.w0 }
      };
    }
  });

  add('freq', 'freqresp', 'steady', {
    title: 'Steady-state response to DC + sinusoid + (−1)ⁿ',
    difficulty: 2, marks: 4,
    variants: [{ id: 'iir1', label: 'First-order recursive system' }, { id: 'fir', label: 'Symmetric FIR' }],
    tags: ['T4 Q4(b)', 'D4 Example 2', 'DX1 Q3(d)'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var a, b;
        if (v === 'iir1') { var p = r.pick([0.5, -0.5, 0.8, 0.25, -0.25, 0.6]); a = [1, -p]; b = r.bool(0.6) ? [1] : [1, r.pick([1, -1, 0.5])]; }
        else { var c0 = r.pick([0.5, 1, 0.25, -0.5]), c1 = r.pick([1, 2, 0.5, -1]); a = [1]; b = [c0, c1, c0]; }
        var w1 = r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3]), ph = r.pick([0, PI / 6, PI / 4, PI / 3, -PI / 4, PI / 2]);
        var H = function (w) { return polyE(b, w).div(polyE(a, w)); };
        if (H(w1).abs() < 0.08) return null;
        return { a: a, b: b, w1: w1, ph: ph, C: r.int(1, 5), A: r.int(1, 4), B: r.int(1, 3), H: H };
      });
      var H0 = d.H(0).re, H1 = d.H(d.w1), Hp = d.H(PI).re;
      var outPh = wrapPi(d.ph + H1.arg());
      var sysEq = d.a.length > 1 ? sysT(d.a, d.b) : 'y(n)=' + Jf(d.b.map(function (c, k) { return [c, k ? 'x(n-' + k + ')' : 'x(n)']; }));
      var Hform = 'H(\\omega)=\\dfrac{' + Jf(d.b.map(function (c, k) { return [c, expT(k)]; })) + '}{' + (d.a.length > 1 ? Jf(d.a.map(function (c, k) { return [c, expT(k)]; })) : '1') + '}';
      var xin = J([[d.C, ''], [d.A, '\\cos\\left(' + P(d.w1) + 'n' + (d.ph ? (d.ph > 0 ? '+' : '-') + P(Math.abs(d.ph)) : '') + '\\right)'], [d.B, '(-1)^n']]);
      var yout = J([[d.C * H0, ''], [d.A * H1.abs(), '\\cos\\left(' + P(d.w1) + 'n' + (outPh >= 0 ? '+' : '-') + F(Math.abs(outPh), 4) + '\\right)'], [d.B * Hp, '(-1)^n']]);
      return {
        stem: 'A stable LTI system is described by $$' + sysEq + '.$$ Find its steady-state output for $$x(n)=' + xin + '.$$',
        parts: [
          { q: '(a) Find $H(\\omega)$ and the DC output.', answers: [nA('$H(0)$', H0, '', { abs: 0.002 }), nA('DC out', d.C * H0, '', { abs: 0.002 })],
            working: QB.steps(['DTFT both sides: $' + Hform + '$.' + (d.a.length > 1 ? ' The pole at $' + F(-d.a[1]) + '$ is inside the unit circle, so the steady state exists.' : ''), 'A constant is $\\omega=0$: $H(0)=' + F(H0, 5) + '$ (real), so the DC output is $' + d.C + '\\times' + F(H0, 5) + '=' + F(d.C * H0, 5) + '$.']) + QB.final('H(0)=' + F(H0, 5)) },
          { q: '(b) Find the amplitude and phase of the $\\omega=' + P(d.w1) + '$ output term.', answers: [nA('amplitude', d.A * H1.abs()), phAns('phase', outPh)],
            working: QB.steps(['$H(' + P(d.w1) + ')=' + cxT(H1, 4) + '$, so $|H|=' + F(H1.abs(), 4) + '$ and $\\theta=' + F(H1.arg(), 4) + '$ rad.', 'Eigenfunction rule: $A\\cos(\\omega n+\\varphi)\\to A|H|\\cos(\\omega n+\\varphi+\\theta)$. Amplitude $' + d.A + '\\times' + F(H1.abs(), 4) + '=' + F(d.A * H1.abs(), 4) + '$; phase $' + F(d.ph, 4) + (H1.arg() < 0 ? '' : '+') + F(H1.arg(), 4) + '=' + F(outPh, 4) + '$ rad.']) + QB.final(F(d.A * H1.abs(), 4) + '\\cos\\left(' + P(d.w1) + 'n' + (outPh >= 0 ? '+' : '-') + F(Math.abs(outPh), 4) + '\\right)') },
          { q: '(c) Find the coefficient of $(-1)^n$ in the output, and write $y_{ss}(n)$.', answers: [nA('$(-1)^n$ coefficient', d.B * Hp, '', { abs: 0.002 })],
            working: QB.steps(['$(-1)^n=\\cos(\\pi n)$ is $\\omega=\\pi$: $H(\\pi)=' + F(Hp, 5) + '$ (real), so the coefficient is $' + d.B + '\\times' + Fp(Hp, 5) + '=' + F(d.B * Hp, 5) + '$.', 'Superposition (the system is linear): add the three terms.']) + QB.final('y_{ss}(n)=' + yout) }
        ],
        notes: QB.callout('trap', 'Keep the input phase and add $\\theta(\\omega)$ to it. A constant is multiplied by $H(0)$, not by 1.'),
        data: { a: d.a, b: d.b, w1: d.w1, ph: d.ph, C: d.C, A: d.A, B: d.B }
      };
    }
  });

  add('freq', 'freqresp', 'lccde', {
    title: 'H(ω) from an LCCDE: evaluate at DC, π and ω₀',
    difficulty: 2, marks: 3,
    variants: [{ id: 'iir1', label: 'First order' }, { id: 'iir2', label: 'Second order' }],
    tags: ['L05 slide 30', 'D4 Playbook A'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var a, b;
        if (v === 'iir1') { a = [1, -r.pick([0.5, -0.5, 0.8, 0.9, -0.8, 0.25])]; b = [r.pick([1, 0.5, 2]), r.pick([0, 1, -1, 0.5])]; }
        else { var s = pickSys(r, r.pick(['complex', 'distinct'])); if (!stableOf(s)) return null; a = s.a; b = r.pick([[1, 0, -1], [1, 1], [1, 2, 1], [1, 0, 1], [0.5, 0.5], [1, -1]]); }
        var w0 = r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3]);
        var H = function (w) { return polyE(b, w).div(polyE(a, w)); };
        if (H(w0).abs() < 0.08) return null;
        return { a: a, b: b, w0: w0, H: H };
      });
      var H0 = d.H(0).re, Hp = d.H(PI).re, Hw = d.H(d.w0);
      var Hform = '\\dfrac{' + Jf(d.b.map(function (c, k) { return [c, expT(k)]; })) + '}{' + Jf(d.a.map(function (c, k) { return [c, expT(k)]; })) + '}';
      return {
        stem: 'A stable causal system is described by $$' + sysT(d.a, d.b) + '.$$',
        figure: tpl('directFormII', { b: d.b, a: d.a }),
        parts: [
          { q: '(a) Find $H(\\omega)$, $H(0)$ and $H(\\pi)$.', answers: [nA('$H(0)$', H0, '', { abs: 0.002 }), nA('$H(\\pi)$', Hp, '', { abs: 0.002 })],
            working: QB.steps(['Put all $y$ terms on the left, DTFT both sides ($y(n-k)\\to e^{-jk\\omega}Y$) and divide: $H(\\omega)=' + Hform + '$.', '$H(0)=\\dfrac{\\sum b_k}{\\sum a_k}=\\dfrac{' + F(sum(d.b)) + '}{' + F(sum(d.a), 4) + '}=' + F(H0, 5) + '$.', '$H(\\pi)=\\dfrac{\\sum(-1)^kb_k}{\\sum(-1)^ka_k}=' + F(Hp, 5) + '$.']) + QB.final('H(\\omega)=' + Hform) },
          { q: '(b) Find $|H(\\omega_0)|$ and $\\theta(\\omega_0)$ at $\\omega_0=' + P(d.w0) + '$.', answers: [nA('$|H(\\omega_0)|$', Hw.abs()), phAns('$\\theta(\\omega_0)$', Hw.arg())],
            working: QB.steps(['Numerator at $\\omega_0$: $' + cxT(polyE(d.b, d.w0), 4) + '$; denominator: $' + cxT(polyE(d.a, d.w0), 4) + '$.', '$H(\\omega_0)=' + cxT(Hw, 4) + '$, so $|H|=' + F(Hw.abs(), 4) + '$ and $\\theta=' + F(Hw.arg(), 4) + '$ rad.']) + QB.final(ampPhaseT(Hw)) }
        ],
        notes: QB.callout('trap', 'Read the denominator with all $y$ terms on the left: $y(n)-0.5y(n-1)\\to1-0.5e^{-j\\omega}$.'),
        data: { a: d.a, b: d.b, w0: d.w0 }
      };
    }
  });

  add('freq', 'freqresp', 'identify', {
    title: 'Identify H(ω) from input–output observations',
    difficulty: 2, marks: 3,
    variants: [{ id: 'twotap', label: 'Two experiments → b₀, b₁' }, { id: 'eigen', label: 'Complex-exponential pair' }, { id: 'ratio', label: 'Exponential in, exponential out' }],
    tags: ['T4 Q3', 'D4 N2'],
    gen: function (r, v) {
      if (v === 'twotap') {
        var b0, b1; r.retry(function () { b0 = r.int(-3, 3); b1 = r.int(-3, 3); return b0 && b1 && b0 !== b1 && b0 !== -b1 ? true : null; });
        var Hh = QB.cx(b0, -b1);
        return {
          stem: 'A causal FIR system has the form $y(n)=b_0x(n)+b_1x(n-1)$. The constant input $x(n)=1$ gives $y(n)=' + (b0 + b1) + '$, and $x(n)=(-1)^n$ gives $y(n)=' + J([[b0 - b1, '(-1)^n']]) + '$.',
          parts: [
            { q: '(a) Find $b_0$ and $b_1$.', answers: [iA('$b_0$', b0), iA('$b_1$', b1)],
              working: QB.steps(['$H(\\omega)=b_0+b_1e^{-j\\omega}$. DC: $H(0)=b_0+b_1=' + (b0 + b1) + '$. $(-1)^n$ is $\\omega=\\pi$: $H(\\pi)=b_0-b_1=' + (b0 - b1) + '$.', 'Solve: $b_0=' + b0 + '$, $b_1=' + b1 + '$.']) + QB.final('b_0=' + b0 + ',\\ b_1=' + b1) },
            { q: '(b) Find the output for $x(n)=\\cos(\\tfrac{\\pi}{2}n)$: give the amplitude and phase.', answers: [nA('amplitude', Hh.abs()), phAns('phase', Hh.arg())],
              working: QB.steps(['$H(\\pi/2)=' + b0 + '+' + Fp(b1) + '(-j)=' + cxT(Hh) + '$.', '$|H|=' + F(Hh.abs(), 4) + '$, $\\theta=' + F(Hh.arg(), 4) + '$ rad, so $y(n)=' + F(Hh.abs(), 4) + '\\cos(\\tfrac{\\pi}{2}n' + (Hh.arg() < 0 ? '-' : '+') + F(Math.abs(Hh.arg()), 4) + ')$.']) + QB.final(ampPhaseT(Hh)) }
          ],
          data: { v: v, b0: b0, b1: b1 }
        };
      }
      if (v === 'eigen') {
        var w0 = r.pick([PI / 5, PI / 4, PI / 3, PI / 6, 2 * PI / 3]), A = r.pick([0.5, 2, 3, 1.5, 4]), ph = r.pick([-PI / 3, -PI / 4, PI / 6, -PI / 2, PI / 4, -2 * PI / 3]), Ain = r.int(1, 4), psi = r.pick([0, PI / 6, PI / 4, -PI / 3]);
        var oph = wrapPi(psi + ph);
        return {
          stem: 'For an LTI system with real $h(n)$, the input $x(n)=e^{j' + P(w0) + 'n}$ produces $y(n)=' + F(A) + 'e^{j(' + P(w0) + 'n' + (ph < 0 ? '-' : '+') + P(Math.abs(ph)) + ')}$.',
          parts: [
            { q: '(a) What can you say about $H(\\omega)$? Give $|H(\\omega_0)|$ and $\\theta(\\omega_0)$, and state whether $H$ at other frequencies is determined (1 = yes, 0 = no).', answers: [nA('$|H(\\omega_0)|$', A), phAns('$\\theta(\\omega_0)$', ph), bA('determined elsewhere?', false)],
              working: QB.steps(['$e^{j\\omega n}$ is an eigenfunction: $y=H(\\omega_0)e^{j\\omega_0n}$, so $H(' + P(w0) + ')=' + F(A) + 'e^{' + (ph < 0 ? '-' : '') + 'j' + P(Math.abs(ph)) + '}$.', 'One pair gives one value only. $H$ at other frequencies <b>cannot</b> be found (T4 Q3b).']) + QB.final('H(' + P(w0) + ')=' + F(A) + 'e^{' + (ph < 0 ? '-' : '') + 'j' + P(Math.abs(ph)) + '}') },
            { q: '(b) Find the output for $x(n)=' + Ain + '\\cos(' + P(w0) + 'n' + (psi ? (psi < 0 ? '-' : '+') + P(Math.abs(psi)) : '') + ')$: amplitude and phase.', answers: [nA('amplitude', Ain * A), phAns('phase', oph)],
              working: QB.steps(['Real $h$ means $H(-\\omega_0)=H^*(\\omega_0)$, so a cosine at $\\omega_0$ is scaled by $|H|$ and shifted by $\\theta$.', 'Amplitude $' + Ain + '\\times' + F(A) + '=' + F(Ain * A) + '$; phase $' + F(psi, 4) + (ph < 0 ? '' : '+') + F(ph, 4) + '=' + F(oph, 4) + '$ rad.']) + QB.final(F(Ain * A) + '\\cos\\left(' + P(w0) + 'n' + (oph < 0 ? '-' : '+') + F(Math.abs(oph), 4) + '\\right)') }
          ],
          data: { v: v, w0: w0, A: A, ph: ph, Ain: Ain, psi: psi }
        };
      }
      var a, b; r.retry(function () { a = r.pick([0.5, 0.25, -0.5, 1 / 3, 0.8]); b = r.pick([0.125, 0.2, 0.5, -0.25, 0.25, 0.75]); return Math.abs(a - b) > 1e-9 ? true : null; });
      return {
        stem: 'For an LTI system, the input $x(n)=' + powT(a) + 'u(n)$ produces $y(n)=' + powT(b) + 'u(n)$.',
        parts: [{ q: 'Find $H(\\omega)$, evaluate $H(0)$ and $H(\\pi)$, and find $h(1)$.', answers: [nA('$H(0)$', (1 - a) / (1 - b), '', { abs: 0.002 }), nA('$H(\\pi)$', (1 + a) / (1 + b), '', { abs: 0.002 }), nA('$h(1)$', b - a, '', { abs: 0.002 })],
          working: QB.steps(['Convolution property: $H=Y/X=\\dfrac{1/(1-' + Fp(b, 4) + 'e^{-j\\omega})}{1/(1-' + Fp(a, 4) + 'e^{-j\\omega})}=\\dfrac{1-' + Fp(a, 4) + 'e^{-j\\omega}}{1-' + Fp(b, 4) + 'e^{-j\\omega}}$.', '$H(0)=\\dfrac{' + F(1 - a, 4) + '}{' + F(1 - b, 4) + '}=' + F((1 - a) / (1 - b), 5) + '$, $H(\\pi)=\\dfrac{' + F(1 + a, 4) + '}{' + F(1 + b, 4) + '}=' + F((1 + a) / (1 + b), 5) + '$.', '$h(n)=' + powT(b) + 'u(n)-' + Fp(a, 4) + '\\,' + powT(b).replace('^n', '^{n-1}') + 'u(n-1)$, so $h(1)=' + F(b, 4) + '-' + Fp(a, 4) + '=' + F(b - a, 5) + '$.']) + QB.final('H(\\omega)=\\dfrac{1-' + Fp(a, 4) + 'e^{-j\\omega}}{1-' + Fp(b, 4) + 'e^{-j\\omega}}') }],
        data: { v: v, a: a, b: b }
      };
    }
  });

  /* =====================================================================
   * freq.pzgeom — pole-zero geometry (D4 Playbook E; T4 Q6–Q7)
   * ===================================================================== */
  function polyRoots(rs) { // real-coefficient polynomial in z^{-1} from roots: Π(1 - r z^{-1})
    var c = [QB.cx(1, 0)];
    rs.forEach(function (q) { var n = [c[0]]; for (var i = 1; i < c.length; i++) n.push(c[i].sub(c[i - 1].mul(q))); n.push(c[c.length - 1].mul(q).neg()); c = n; });
    return c.map(function (z) { return cl(z.re); });
  }
  function Hpz(zs, ps, w) { var e = QB.cx.polar(1, deg(w)), h = QB.cx(1, 0); zs.forEach(function (z) { h = h.mul(e.sub(z)); }); ps.forEach(function (p) { h = h.div(e.sub(p)); }); return h; }
  /** list of roots in TeX; a conjugate pair becomes r e^{±jθ} */
  function rootsT(list) {
    if (list.length === 2 && Math.abs(list[0].im) > 1e-9 && Math.abs(list[0].re - list[1].re) < 1e-9 && Math.abs(list[0].im + list[1].im) < 1e-9) {
      var m = list[0].abs(); return '$' + (Math.abs(m - 1) < 1e-9 ? '' : F(m, 4)) + 'e^{\\pm j' + P(Math.abs(list[0].arg())) + '}$';
    }
    if (list.length === 2 && Math.abs(list[0].im) < 1e-9 && Math.abs(list[1].im) < 1e-9 && Math.abs(list[0].re + list[1].re) < 1e-9) return '$z=\\pm' + F(Math.abs(list[0].re)) + '$';
    return list.map(function (z) { return '$' + zT(z) + '$'; }).join(' and ');
  }
  function zT(z) { return Math.abs(z.im) < 1e-12 ? F(z.re, 4) : (Math.abs(z.re) < 1e-12 ? '' : F(z.re, 4)) + (z.im < 0 ? '-' : (Math.abs(z.re) < 1e-12 ? '' : '+')) + 'j' + F(Math.abs(z.im), 4); }

  add('freq', 'pzgeom', 'vector', {
    title: 'Evaluate |H(ω₀)| and θ(ω₀) with pole and zero vectors',
    difficulty: 2, marks: 4,
    variants: [{ id: 'resonator', label: 'Resonator (zeros at ±1)' }, { id: 'notch', label: 'Notch (zeros on the circle)' }, { id: 'first', label: 'One real zero, one real pole' }],
    tags: ['D4 Example 3', 'D4 N4(c)', 'T4 Q6'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var zs, ps, w0;
        if (v === 'first') { var z0 = r.pick([-1, 1, 0.5, -0.5]), p0 = r.pick([0.5, 0.8, -0.5, 0.9, -0.8]); if (z0 === p0) return null; zs = [QB.cx(z0, 0)]; ps = [QB.cx(p0, 0)]; w0 = r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3]); }
        else {
          var th = r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3]), rr = r.pick([0.8, 0.9, 0.95]);
          ps = [QB.cx.polar(rr, deg(th)), QB.cx.polar(rr, -deg(th))];
          zs = v === 'resonator' ? [QB.cx(1, 0), QB.cx(-1, 0)] : [QB.cx.polar(1, deg(th)), QB.cx.polar(1, -deg(th))];
          w0 = v === 'resonator' ? (r.bool(0.5) ? th : r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3])) : r.pick([0, PI / 4, PI / 2, 3 * PI / 4, PI / 3].filter(function (w) { return Math.abs(w - th) > 0.2; }));
        }
        var H = Hpz(zs, ps, w0); if (H.abs() < 0.05) return null;
        return { zs: zs, ps: ps, w0: w0, H: H };
      });
      var e = QB.cx.polar(1, deg(d.w0));
      var rows = d.zs.map(function (z, i) { var vv = e.sub(z); return ['zero $' + zT(z) + '$', '$' + zT(vv) + '$', '$V_' + (i + 1) + '=' + F(vv.abs(), 4) + '$', '$' + F(vv.argd(), 4) + '^\\circ$']; })
        .concat(d.ps.map(function (p, i) { var vv = e.sub(p); return ['pole $' + zT(p) + '$', '$' + zT(vv) + '$', '$U_' + (i + 1) + '=' + F(vv.abs(), 4) + '$', '$' + F(vv.argd(), 4) + '^\\circ$']; }));
      var V = d.zs.map(function (z) { return e.sub(z).abs(); }), U = d.ps.map(function (p) { return e.sub(p).abs(); });
      var angS = sum(d.zs.map(function (z) { return e.sub(z).argd(); })) - sum(d.ps.map(function (p) { return e.sub(p).argd(); }));
      var bq = polyRoots(d.zs), aq = polyRoots(d.ps);
      var Hz = '\\dfrac{' + Jf(bq.map(function (c, k) { return [c, k ? 'z^{-' + k + '}' : '']; })) + '}{' + Jf(aq.map(function (c, k) { return [c, k ? 'z^{-' + k + '}' : '']; })) + '}';
      return {
        stem: 'A system has $b_0=1$, zeros at ' + rootsT(d.zs) + ' and poles at ' + rootsT(d.ps) + ', i.e. $H(z)=' + Hz + '$. Evaluate the response at $\\omega_0=' + P(d.w0) + '$ by the vector method.',
        figure: pzFig({ zeros: d.zs.map(function (z) { return [z.re, z.im]; }), poles: d.ps.map(function (p) { return [p.re, p.im]; }), w0: d.w0 }),
        parts: [
          { q: '(a) Find the length of each zero vector and each pole vector to $e^{j\\omega_0}$ (zeros first).', answers: V.map(function (x, i) { return nA('$V_' + (i + 1) + '$', x); }).concat(U.map(function (x, i) { return nA('$U_' + (i + 1) + '$', x); })),
            working: QB.steps(['$e^{j\\omega_0}=' + zT(e) + '$. Each vector goes <b>from</b> the pole or zero <b>to</b> $e^{j\\omega_0}$: $|e^{j\\omega}-q|=\\sqrt{(\\cos\\omega-\\mathrm{Re}\\,q)^2+(\\sin\\omega-\\mathrm{Im}\\,q)^2}$.', QB.tbl(['from', 'vector', 'length', 'angle'], rows)]) + QB.final(V.map(function (x, i) { return 'V_' + (i + 1) + '=' + F(x, 4); }).concat(U.map(function (x, i) { return 'U_' + (i + 1) + '=' + F(x, 4); })).join(',\\ ')) },
          { q: '(b) Find $|H(\\omega_0)|$ and $\\theta(\\omega_0)$.', answers: [nA('$|H(\\omega_0)|$', d.H.abs()), phAns('$\\theta(\\omega_0)$', d.H.arg())],
            working: QB.steps(['$|H|=|b_0|\\dfrac{\\prod V_k}{\\prod U_k}=\\dfrac{' + V.map(function (x) { return F(x, 4); }).join('\\times') + '}{' + U.map(function (x) { return F(x, 4); }).join('\\times') + '}=' + F(d.H.abs(), 4) + '$.', 'Here $N=M$, so there is no $\\omega(N-M)$ term. $\\theta=\\sum\\angle(\\text{zero vectors})-\\sum\\angle(\\text{pole vectors})=' + F(angS, 4) + '^\\circ$' + (Math.abs(wrapPi(angS * PI / 180) - angS * PI / 180) > 1e-9 ? ', i.e. $' + F(d.H.argd(), 4) + '^\\circ$ in $(-180^\\circ,180^\\circ]$' : '') + ' $=' + F(d.H.arg(), 4) + '$ rad.']) + QB.final(ampPhaseT(d.H)) }
        ],
        notes: QB.callout('trap', 'Use $e^{j\\omega}-q$ (from $q$ to the circle), not $q-e^{j\\omega}$: reversing a vector adds $180^\\circ$.'),
        data: { zs: d.zs.map(function (z) { return [z.re, z.im]; }), ps: d.ps.map(function (p) { return [p.re, p.im]; }), w0: d.w0 }
      };
    }
  });

  /** guarded |H(ω)| sketch on [0, π] */
  function magCurve(mag) {
    if (!(QB.plot && typeof QB.plot.curves === 'function')) return '';
    try {
      var xs = range(0, 200).map(function (i) { return i * PI / 200; });
      var s = QB.plot.curves([{ x: xs, y: xs.map(mag), label: '|H(\\omega)|' }], { xlabel: '\\omega', ylabel: '|H(\\omega)|', xpi: true, grid: true });
      return (typeof s === 'string' && s.trim().indexOf('<svg') === 0 && !/NaN|undefined|Infinity/.test(s)) ? '<div>' + s + '</div>' : '';
    } catch (e) { return ''; }
  }
  add('freq', 'pzgeom', 'sketch', {
    title: 'Read the magnitude-response shape from a pole-zero plot',
    difficulty: 2, marks: 3,
    variants: [{ id: 'lowpass', label: 'Zero at −1, real pole' }, { id: 'highpass', label: 'Zero at +1, real pole' }, { id: 'bandpass', label: 'Resonator' }, { id: 'notch', label: 'Notch' }, { id: 'comb', label: 'Comb 1 − z⁻ᴸ' }],
    tags: ['T4 Q6', 'sketch'],
    gen: function (r, v) {
      var zs, ps, desc, peakW, extra = [], th = null, L = 0;
      if (v === 'lowpass' || v === 'highpass') {
        var p = r.pick([0.5, 0.8, 0.9, 0.6]) * (v === 'lowpass' ? 1 : -1);
        zs = [QB.cx(v === 'lowpass' ? -1 : 1, 0)]; ps = [QB.cx(p, 0)]; peakW = v === 'lowpass' ? 0 : PI;
        desc = 'one zero at $z=' + (v === 'lowpass' ? '-1' : '1') + '$ and one pole at $z=' + F(p) + '$';
      } else if (v === 'bandpass' || v === 'notch') {
        th = r.pick([PI / 4, PI / 3, PI / 2, 2 * PI / 3]); var rr = r.pick([0.85, 0.9, 0.95]);
        ps = [QB.cx.polar(rr, deg(th)), QB.cx.polar(rr, -deg(th))];
        zs = v === 'bandpass' ? [QB.cx(1, 0), QB.cx(-1, 0)] : [QB.cx.polar(1, deg(th)), QB.cx.polar(1, -deg(th))];
        desc = v === 'bandpass' ? 'zeros at $z=\\pm1$ and poles at $' + F(rr) + 'e^{\\pm j' + P(th) + '}$' : 'zeros at $e^{\\pm j' + P(th) + '}$ and poles at $' + F(rr) + 'e^{\\pm j' + P(th) + '}$';
      } else {
        L = r.int(4, 8); zs = range(0, L - 1).map(function (k) { return QB.cx.polar(1, 360 * k / L); }); ps = range(0, L - 1).map(function () { return QB.cx(0, 0); });
        desc = '$' + L + '$ zeros equally spaced on the unit circle at $e^{j2\\pi k/' + L + '}$ (including $z=1$) and an order-' + L + ' pole at the origin';
      }
      var mag = function (w) { return Hpz(zs, ps, w).abs(); };
      var grid = range(0, 2000).map(function (i) { return i * PI / 2000; }), best = 0, bw = 0;
      grid.forEach(function (w) { var m = mag(w); if (m > best + 1e-12) { best = m; bw = w; } });
      if (v === 'bandpass') peakW = bw;
      var answers, steps;
      var H0 = mag(0), Hp = mag(PI);
      if (v === 'comb') {
        var nulls = Math.floor(L / 2) + 1;
        answers = [iA('nulls in $[0,\\pi]$', nulls), nA('max $|H|$', 2), rA('first peak $\\omega$', PI / L)];
        steps = ['$H(z)=1-z^{-' + L + '}$, so $|H(\\omega)|=2|\\sin(' + F(L / 2) + '\\omega)|$.', 'Zeros on the circle at $\\omega=2\\pi k/' + L + '$; in $[0,\\pi]$ these are $k=0,\\dots,' + Math.floor(L / 2) + '$: ' + nulls + ' nulls.', 'Between them are equal humps of height 2, the first at $\\omega=\\pi/' + L + '$. A comb filter.'];
      } else if (v === 'notch') {
        answers = [nA('$|H(0)|$', H0), nA('$|H(\\pi)|$', Hp), rA('null at $\\omega$', th)];
        steps = ['Zeros on the circle at $\\pm' + P(th) + '$ make $|H(' + P(th) + ')|=0$ exactly.', 'Each pole sits just behind its zero, so away from $' + P(th) + '$ the zero and pole vectors are almost equal: $|H|\\approx1$. $|H(0)|=' + F(H0, 4) + '$, $|H(\\pi)|=' + F(Hp, 4) + '$.', 'Shape: flat near 1 with a narrow notch to 0 at $\\omega=' + P(th) + '$. The closer the poles to the circle, the narrower the notch.'];
      } else if (v === 'bandpass') {
        var Hth = mag(th), e0 = QB.cx.polar(1, deg(th));
        answers = [nA('$|H(0)|$', 0, '', { abs: 0.01 }), nA('$|H(\\pi)|$', 0, '', { abs: 0.01 }), rA('peak at $\\omega$', peakW, { abs: 0.05 * PI }), nA('$|H|$ at $\\omega=\\theta$', Hth)];
        steps = ['Zeros on the circle at $z=\\pm1$: $|H(0)|=|H(\\pi)|=0$.', 'The pole at angle $\\theta=' + P(th) + '$ is close to the circle, so the pole vector is short near $\\omega=' + P(th) + '$ and $|H|$ peaks there (numerically at $' + F(peakW / PI, 3) + '\\pi$, height $' + F(best, 4) + '$).', 'At $\\omega=\\theta$: $|H|=\\dfrac{V_1V_2}{U_1U_2}=\\dfrac{' + zs.map(function (z) { return F(e0.sub(z).abs(), 4); }).join('\\times') + '}{' + ps.map(function (q) { return F(e0.sub(q).abs(), 4); }).join('\\times') + '}=' + F(Hth, 4) + '$.', 'Shape: band-pass, zero at both ends with one peak near $' + P(th) + '$.'];
      } else {
        answers = [nA('$|H(0)|$', H0, '', { abs: 0.01 }), nA('$|H(\\pi)|$', Hp, '', { abs: 0.01 }), rA('$\\omega$ of max $|H|$', peakW, { abs: 0.03 })];
        steps = ['$|H(\\omega)|=V/U$ with $V$ from the zero and $U$ from the pole.', '$\\omega=0$ (point $z=1$): $|H(0)|=' + F(H0, 4) + '$. $\\omega=\\pi$ (point $z=-1$): $|H(\\pi)|=' + F(Hp, 4) + '$.', v === 'lowpass' ? 'The zero at $-1$ blocks $\\omega=\\pi$ and the pole near $z=1$ lifts $\\omega=0$: low-pass, maximum at $\\omega=0$.' : 'The zero at $+1$ blocks DC and the pole near $z=-1$ lifts $\\omega=\\pi$: high-pass, maximum at $\\omega=\\pi$.'];
      }
      return {
        stem: 'A filter has ' + desc + ' ($b_0=1$). Walk $e^{j\\omega}$ round the upper half of the unit circle to sketch $|H(\\omega)|$ for $0\\le\\omega\\le\\pi$.',
        figure: pzFig({ zeros: zs.map(function (z) { return [z.re, z.im]; }), poles: ps.map(function (q) { return [q.re, q.im]; }) }),
        parts: [{ q: 'Give the key values of the sketch.', answers: answers, working: QB.steps(steps.concat(['Poles or zeros at the origin have unit distance to the circle and do not affect $|H|$.'])) + magCurve(mag) + QB.final(v === 'comb' ? '|H|=2|\\sin(' + F(L / 2) + '\\omega)|' : '|H(0)|=' + F(H0, 3) + ',\\ |H(\\pi)|=' + F(Hp, 3)) }],
        data: { v: v, zs: zs.map(function (z) { return [z.re, z.im]; }), ps: ps.map(function (q) { return [q.re, q.im]; }), L: L, th: th }
      };
    }
  });

  /* =====================================================================
   * freq.dft — N-point DFT and IDFT (D5 Playbooks A–C; T5 Q3, Q6)
   * ===================================================================== */
  var W4T = '\\begin{bmatrix}1&1&1&1\\\\1&-j&-1&j\\\\1&-1&1&-1\\\\1&j&-1&-j\\end{bmatrix}';
  function colT(v) { return '\\begin{bmatrix}' + v.map(function (a) { return typeof a === 'number' ? F(a) : a; }).join('\\\\') + '\\end{bmatrix}'; }
  function Xlist(X, sig) { return '\\{' + X.map(function (z) { return cxT(z, sig || 4); }).join(',\\ ') + '\\}'; }
  function reim(label, z) { return [nA('Re ' + label, z.re, '', { abs: 0.002 }), nA('Im ' + label, z.im, '', { abs: 0.002 })]; }
  function dftRow(x, k, N) {
    return x.map(function (a, n) { var w = QB.cx.polar(1, -360 * k * n / N); return Fp(a) + '(' + cxT(w, 3) + ')'; }).join('+');
  }

  add('freq', 'dft', 'direct', {
    title: 'N-point DFT by hand (N = 4 or 8) and the 4-point IDFT',
    difficulty: 2, marks: 3,
    variants: [{ id: 'N4', label: '4-point DFT (W₄ matrix)' }, { id: 'N8', label: '8-point DFT' }, { id: 'idft', label: '4-point IDFT' }],
    tags: ['T5 Q2', 'T5 Q3', 'D5 Example 2'],
    gen: function (r, v) {
      if (v === 'N8') {
        var x8 = r.bool(0.5) ? pad(range(1, r.int(2, 5)).map(function () { return 1; }), 8) : pad(randSeq(r, r.int(3, 5), -2, 3, false), 8);
        var X8 = dft(x8, 8);
        return {
          stem: 'Compute the 8-point DFT of $x(n)=' + seqT({ v: x8, n0: 0 }) + '$, $0\\le n\\le7$.',
          figure: stemFig([{ v: x8, n0: 0, label: 'x(n)' }]),
          parts: [{ q: 'Give $X(0)$, $X(1)$ (real and imaginary parts), $|X(2)|$ and $X(4)$.', answers: [nA('$X(0)$', X8[0].re, '', { abs: 0.002 })].concat(reim('$X(1)$', X8[1])).concat([nA('$|X(2)|$', X8[2].abs(), '', { abs: 0.002 }), nA('$X(4)$', X8[4].re, '', { abs: 0.002 })]),
            working: QB.steps(['$W_8=e^{-j\\pi/4}=\\tfrac{1}{\\sqrt2}(1-j)$; $X(k)=\\sum_{n=0}^{7}x(n)W_8^{kn}$ with exponents reduced mod 8.', '$X(0)=\\sum x(n)=' + F(X8[0].re) + '$.', '$X(1)=' + x8.map(function (a, n) { return a ? Fp(a) + 'W_8^{' + n + '}' : null; }).filter(Boolean).join('+') + '=' + cxT(X8[1]) + '$.', '$X(2)=' + x8.map(function (a, n) { return a ? Fp(a) + '(-j)^{' + n + '}' : null; }).filter(Boolean).join('+') + '=' + cxT(X8[2]) + '$, so $|X(2)|=' + F(X8[2].abs(), 4) + '$.', '$X(4)=\\sum(-1)^nx(n)=' + F(X8[4].re) + '$.', 'Real $x$: $X(8-k)=X^*(k)$, so the full set is $' + Xlist(X8, 3) + '$.']) + QB.final('X(1)=' + cxT(X8[1])) }],
          data: { v: v, x: x8 }
        };
      }
      var x = pad(randSeq(r, r.int(3, 4), -3, 4, false), 4), X = dft(x, 4);
      if (v === 'idft') {
        return {
          stem: 'A real sequence $x(n)$, $0\\le n\\le3$, has 4-point DFT $$X(k)=' + Xlist(X) + '.$$',
          parts: [{ q: 'Find $x(n)$ using the 4-point IDFT.', answers: x.map(function (a, n) { return iA('$x(' + n + ')$', a); }),
            working: QB.steps(['$x(n)=\\tfrac14\\sum_k X(k)e^{+j2\\pi kn/4}$: $\\mathbf W_4^{-1}=\\tfrac14\\mathbf W_4^*$ (swap $-j\\leftrightarrow j$, divide by 4).', '$x(0)=\\tfrac14\\sum X(k)=\\tfrac14(' + X.map(function (z) { return cxT(z); }).join('+') + ')=' + x[0] + '$.'].concat([1, 2, 3].map(function (n) { return '$x(' + n + ')=\\tfrac14\\left[' + X.map(function (z, k) { return '(' + cxT(z) + ')(' + cxT(QB.cx.polar(1, 90 * k * n), 2) + ')'; }).join('+') + '\\right]=' + x[n] + '$.'; })).concat(['Check: $X(0)=\\sum x(n)=' + sum(x) + '$.'])) + QB.final('x(n)=' + seqT({ v: x, n0: 0 })) }],
          data: { v: v, x: x }
        };
      }
      return {
        stem: 'Compute the 4-point DFT of $x(n)=' + seqT({ v: x, n0: 0 }) + '$ using the $\\mathbf W_4$ matrix.',
        figure: stemFig([{ v: x, n0: 0, label: 'x(n)' }]),
        parts: [{ q: 'Give $X(0)$, $X(1)$, $X(2)$ and $X(3)$ (real and imaginary parts where needed).', answers: [iA('$X(0)$', X[0].re)].concat(reim('$X(1)$', X[1])).concat([iA('$X(2)$', X[2].re)]).concat(reim('$X(3)$', X[3])),
          working: QB.steps(['$W_4=e^{-j\\pi/2}=-j$, so $\\mathbf X=' + W4T + colT(x) + '$.', '$X(0)=' + x.join('+').replace(/\+-/g, '-') + '=' + F(X[0].re) + '$.', '$X(1)=' + dftRow(x, 1, 4) + '=' + cxT(X[1]) + '$.', '$X(2)=' + dftRow(x, 2, 4) + '=' + cxT(X[2]) + '$.', '$X(3)=X^*(1)=' + cxT(X[3]) + '$ (real $x$). Check: $\\tfrac14\\sum X(k)=' + x[0] + '=x(0)$.']) + QB.final('X(k)=' + Xlist(X)) }],
        notes: QB.callout('trap', 'The forward kernel is $W_4=-j$, not $+j$. The IDFT has $+j$ and the factor $1/N$.'),
        data: { v: v, x: x }
      };
    }
  });

  add('freq', 'dft', 'props', {
    title: 'DFT properties: circular shift, reversal, modulation, Parseval',
    difficulty: 2, marks: 3,
    variants: [{ id: 'shift', label: 'Circular shift x((n − l))₄' }, { id: 'reverse', label: 'Circular reversal x((−n))₄' }, { id: 'mod', label: '(−1)ⁿ x(n)' }, { id: 'parseval', label: 'Parseval' }],
    tags: ['D5 Q5', 'T5 Q3'],
    gen: function (r, v) {
      var x = randSeq(r, 4, -3, 5, false), X = dft(x, 4);
      var stem = '$x(n)=' + seqT({ v: x, n0: 0 }) + '$ has 4-point DFT $X(k)=' + Xlist(X) + '$. Without computing a new DFT sum:';
      if (v === 'parseval') {
        var E = sum(x.map(function (a) { return a * a; })), SX = sum(X.map(function (z) { return z.abs() * z.abs(); }));
        return { stem: stem, parts: [{ q: 'Find $\\sum_k|X(k)|^2$ and use Parseval to get $\\sum_n x^2(n)$.', answers: [nA('$\\sum|X(k)|^2$', SX, '', { abs: 0.01 }), iA('$\\sum x^2(n)$', E)],
          working: QB.steps(['$\\sum|X|^2=' + X.map(function (z) { return F(z.abs() * z.abs(), 4); }).join('+') + '=' + F(SX, 5) + '$.', 'Parseval: $\\sum|x(n)|^2=\\tfrac1N\\sum|X(k)|^2=' + F(SX, 5) + '/4=' + F(SX / 4, 5) + '$. Direct: $' + x.map(function (a) { return Fp(a) + '^2'; }).join('+') + '=' + E + '$.']) + QB.final(String(E)) }], data: { v: v, x: x } };
      }
      var l = r.int(1, 3), Y, xn, desc, steps;
      if (v === 'shift') {
        xn = range(0, 3).map(function (n) { return x[((n - l) % 4 + 4) % 4]; }); Y = X.map(function (z, k) { return z.mul(QB.cx.polar(1, -90 * k * l)); });
        desc = 'x_a(n)=x((n-' + l + '))_4'; steps = ['Circular shift: $x((n-l))_N\\leftrightarrow X(k)W_N^{kl}=X(k)(-j)^{' + l + 'k}$.', Y.map(function (z, k) { return '$k=' + k + '$: $(' + cxT(X[k]) + ')(' + cxT(QB.cx.polar(1, -90 * k * l), 2) + ')=' + cxT(z) + '$'; }).join('; ') + '.', 'Check: $x_a=' + seqT({ v: xn, n0: 0 }) + '$ and $X_a(0)=' + sum(xn) + '$.'];
      } else if (v === 'reverse') {
        xn = range(0, 3).map(function (n) { return x[(4 - n) % 4]; }); Y = range(0, 3).map(function (k) { return X[(4 - k) % 4]; });
        desc = 'x_b(n)=x((-n))_4'; steps = ['Circular reversal: $x((-n))_N\\leftrightarrow X((-k))_N=X(N-k)$.', '$x_b=\\{x_0,x_3,x_2,x_1\\}=' + seqT({ v: xn, n0: 0 }) + '$ (not $\\{x_3,x_2,x_1,x_0\\}$).', '$X_b=\\{X(0),X(3),X(2),X(1)\\}=' + Xlist(Y) + '$, which equals $X^*(k)$ for real $x$.'];
      } else {
        xn = x.map(function (a, n) { return n % 2 ? -a : a; }); Y = range(0, 3).map(function (k) { return X[(k + 2) % 4]; });
        desc = 'x_c(n)=(-1)^nx(n)'; steps = ['$(-1)^n=e^{j2\\pi(2)n/4}$, so the frequency-shift property gives $X_c(k)=X((k-2))_4$.', '$X_c=\\{X(2),X(3),X(0),X(1)\\}=' + Xlist(Y) + '$.'];
      }
      return {
        stem: stem,
        parts: [{ q: 'Find the 4-point DFT of $' + desc + '$: give $X(0)$ of the new sequence and the real and imaginary parts of its $k=1$ value, plus its $n=1$ sample.',
          answers: [nA('new $X(0)$', Y[0].re, '', { abs: 0.002 })].concat(reim('new $X(1)$', Y[1])).concat([iA('new $x(1)$', xn[1])]),
          working: QB.steps(steps) + QB.final(Xlist(Y)) }],
        data: { v: v, x: x, l: l }
      };
    }
  });

  add('freq', 'dft', 'sampling', {
    title: 'Frequency sampling of the DTFT: time aliasing and X(k) = X(2πk/N)',
    difficulty: 2, marks: 3,
    variants: [{ id: 'alias', label: 'N < L: time aliasing' }, { id: 'dtft', label: 'Two-sided x(n), V(k) = X(2πk/N)' }],
    tags: ['D5 Example 1', 'T5 Q6', 'D5 Q2'],
    gen: function (r, v) {
      if (v === 'dtft') {
        var c = randSeq(r, 3, -1, 4, false), N = r.pick([5, 6, 8]), xs = { v: [c[2], c[1], c[0], c[1], c[2]], n0: -2 };
        var vv = range(0, N - 1).map(function (n) { var s = 0; for (var m = -3; m <= 3; m++) s += at(xs, n - m * N); return s; });
        var V = dft(vv, N);
        return {
          stem: 'The DTFT $X(\\omega)$ of $x(n)=' + seqT(xs) + '$ is sampled at $\\omega_k=2\\pi k/' + N + '$, $k=0,\\dots,' + (N - 1) + '$.',
          figure: stemFig([{ v: xs.v, n0: -2, label: 'x(n)' }]),
          parts: [
            { q: '(a) Find $X(\\omega)$ in real form and the ' + N + '-point sequence $v(n)$, $0\\le n\\le' + (N - 1) + '$, whose DFT is $V(k)=X(2\\pi k/' + N + ')$. Give $v(' + (N - 1) + ')$ and $v(' + (N - 2) + ')$.', answers: [iA('$v(' + (N - 1) + ')$', vv[N - 1]), iA('$v(' + (N - 2) + ')$', vv[N - 2])],
              working: QB.steps(['$X(\\omega)=' + J([[c[0], ''], [2 * c[1], '\\cos\\omega'], [2 * c[2], '\\cos2\\omega']]) + '$ (pair $n$ with $-n$).', 'Sampling $X(\\omega)$ at $N$ points corresponds to the periodic extension $x_p(n)=\\sum_m x(n-m' + N + ')$. One period from $n=0$: $v(n)=' + seqT({ v: vv, n0: 0 }) + '$ (the negative-index samples wrap to the end).']) + QB.final('v(n)=' + seqT({ v: vv, n0: 0 })) },
            { q: '(b) Find $V(0)$, $V(1)$ and $V(2)$.', answers: [0, 1, 2].map(function (k) { return nA('$V(' + k + ')$', V[k].re, '', { abs: 0.002 }); }),
              working: QB.steps(['$V(k)=X(\\omega)|_{\\omega=2\\pi k/' + N + '}=' + c[0] + '+' + Fp(2 * c[1]) + '\\cos\\frac{2\\pi k}{' + N + '}+' + Fp(2 * c[2]) + '\\cos\\frac{4\\pi k}{' + N + '}$.', [0, 1, 2].map(function (k) { return '$V(' + k + ')=' + F(V[k].re, 4) + '$'; }).join(', ') + '. Real, because $v$ is circularly even.']) + QB.final('V(k)=X(2\\pi k/' + N + ')') }
          ],
          data: { v: v, x: xs, N: N }
        };
      }
      var L = r.int(5, 7), x = randSeq(r, L, -2, 6, false), Nn = r.int(3, L - 1), xt = wrapN(x, Nn);
      var rows = []; for (var i = 0; i < L; i += Nn) rows.push(pad(x.slice(i, i + Nn), Nn));
      return {
        stem: 'The DTFT of $x(n)=' + seqT({ v: x, n0: 0 }) + '$ is sampled at $\\omega_k=2\\pi k/' + Nn + '$, $k=0,\\dots,' + (Nn - 1) + '$, and the ' + Nn + '-point IDFT of those samples is taken.',
        parts: [
          { q: '(a) Find the returned sequence $\\tilde x(n)$, $0\\le n\\le' + (Nn - 1) + '$.', answers: xt.map(function (a, n) { return iA('$\\tilde x(' + n + ')$', a); }),
            working: QB.steps(['Frequency sampling makes the time signal periodic: $x_p(n)=\\sum_m x(n-m' + Nn + ')$. Since $N=' + Nn + '<L=' + L + '$, the copies overlap (time aliasing).', 'Write $x$ in rows of ' + Nn + ' and add the columns: ' + QB.tbl(null, rows.map(function (rw) { return rw.map(function (a) { return F(a); }); }).concat([xt.map(function (a) { return '<b>' + F(a) + '</b>'; })]))]) + QB.final('\\tilde x(n)=' + seqT({ v: xt, n0: 0 })) },
          { q: '(b) Find $\\tilde X(0)$ and the smallest $N$ for which the IDFT returns $x(n)$ exactly.', answers: [iA('$\\tilde X(0)$', sum(xt)), iA('$N_{\\min}$', L)],
            working: QB.steps(['$\\tilde X(0)=\\sum\\tilde x=' + sum(xt) + '=X(0)=\\sum x$: the frequency samples are exact; only the time sequence is aliased.', 'No aliasing needs $N\\ge L=' + L + '$.']) + QB.final('N_{\\min}=' + L) }
        ],
        data: { v: v, x: x, N: Nn }
      };
    }
  });

  /* =====================================================================
   * freq.circconv — circular vs linear convolution (D5 Playbooks D–F)
   * ===================================================================== */
  function circMatT(x2, N) {
    var p = pad(x2, N), rows = [];
    for (var i = 0; i < N; i++) { var rw = []; for (var j = 0; j < N; j++) rw.push(F(p[((i - j) % N + N) % N])); rows.push(rw.join('&')); }
    return '\\begin{bmatrix}' + rows.join('\\\\') + '\\end{bmatrix}';
  }
  add('freq', 'circconv', 'direct', {
    title: 'N-point circular convolution by hand',
    difficulty: 2, marks: 3,
    variants: [{ id: 'matrix', label: 'Circulant matrix' }, { id: 'wrap', label: 'Linear convolution, then wrap' }],
    tags: ['T5 Q1', 'D5 Example 3', 'D5 Q3'],
    gen: function (r, v) {
      var N = r.pick([4, 4, 5]);
      var x1 = pad(randSeq(r, r.int(3, N), -2, 4, false), N), x2 = randSeq(r, r.int(2, N), -2, 4, false);
      var y = circ(x1, x2, N), lin = conv(x1.slice(0, lastNZ(x1) + 1), x2);
      function lastNZ(a) { for (var i = a.length - 1; i >= 0; i--) if (a[i]) return i; return 0; }
      var steps = v === 'matrix' ?
        ['Pad $x_2$ to length ' + N + '. Build the circulant from $x_2$ (column 0 is $x_2$, each next column shifted down with wrap-round): $$\\mathbf y=' + circMatT(x2, N) + colT(x1) + '.$$', 'Multiply row by row: $y=' + seqT({ v: y, n0: 0 }) + '$.', 'Check: $\\sum y=' + sum(y) + '=(\\sum x_1)(\\sum x_2)=(' + sum(x1) + ')(' + sum(x2) + ')$.'] :
        ['Linear convolution first: $x_1*x_2=' + seqT({ v: lin, n0: 0 }) + '$ (length ' + lin.length + ').', lin.length > N ? 'Fold every sample at $n\\ge' + N + '$ back by ' + N + ' and add (time aliasing): $y_N(n)=\\sum_m y_{lin}(n+m' + N + ')$.' : 'The linear result already fits in ' + N + ' samples, so no wrapping occurs.', 'Result: $y=' + seqT({ v: y, n0: 0 }) + '$.'];
      return {
        stem: 'Determine the ' + N + '-point circular convolution $y(n)=x_1(n)\\circledast_{' + N + '}x_2(n)$ for $x_1(n)=' + seqT({ v: x1, n0: 0 }) + '$ and $x_2(n)=' + seqT({ v: x2, n0: 0 }) + '$.',
        parts: [{ q: 'Give $y(n)$ for $0\\le n\\le' + (N - 1) + '$.', answers: y.map(function (a, n) { return iA('$y(' + n + ')$', a); }), working: QB.steps(steps) + QB.final('y(n)=' + seqT({ v: y, n0: 0 })) }],
        notes: QB.callout('trap', 'A circular result always has exactly $N$ samples. Circular reversal of $\\{x_0,x_1,x_2,x_3\\}$ is $\\{x_0,x_3,x_2,x_1\\}$.'),
        data: { v: v, x1: x1, x2: x2, N: N }
      };
    }
  });

  add('freq', 'circconv', 'padding', {
    title: 'Zero-padding for linear convolution via the DFT',
    difficulty: 1, marks: 3,
    variants: [{ id: 'minN', label: 'Minimum N and corrupted samples' }, { id: 'wrapped', label: 'Too-small N: wrapped result' }],
    tags: ['L06 slide 24', 'D5 Example 4', 'DX1 Q4(b)'],
    gen: function (r, v) {
      if (v === 'minN') {
        var L = r.int(5, 200), M = r.int(3, 64), Nmin = L + M - 1, N2 = Math.pow(2, Math.ceil(Math.log2(Nmin)));
        var Ns = r.int(Math.max(L, M), Nmin - 1);
        return {
          stem: 'An input of length $L=' + L + '$ is filtered by an FIR filter of length $M=' + M + '$ using DFTs.',
          parts: [
            { q: '(a) What is the minimum DFT length for the circular result to equal the linear convolution? What size would a radix-2 FFT use?', answers: [iA('$N_{\\min}$', Nmin), iA('radix-2 $N$', N2)],
              working: QB.steps(['The linear result has length $L+M-1=' + L + '+' + M + '-1=' + Nmin + '$, so $N\\ge' + Nmin + '$.', 'Next power of 2: $' + N2 + '$.']) + QB.final('N\\ge' + Nmin) },
            { q: '(b) If $N=' + Ns + '$ is used instead, how many output samples are corrupted by wrap-around, and how many are correct?', answers: [iA('corrupted', Nmin - Ns), iA('correct', Ns - (Nmin - Ns))],
              working: QB.steps(['The last $L+M-1-N=' + (Nmin - Ns) + '$ linear samples wrap onto $n=0,\\dots,' + (Nmin - Ns - 1) + '$.', 'So $' + (Nmin - Ns) + '$ samples are corrupted and $N-' + (Nmin - Ns) + '=' + (2 * Ns - Nmin) + '$ (from $n=' + (Nmin - Ns) + '$ to $' + (Ns - 1) + '$) are correct.']) + QB.final(String(Nmin - Ns)) }
          ],
          data: { v: v, L: L, M: M, Ns: Ns }
        };
      }
      var x = randSeq(r, r.int(3, 4), -2, 4, false), h = randSeq(r, r.int(2, 3), -2, 3, false), Lt = x.length + h.length - 1;
      var N = r.int(Math.max(x.length, h.length), Lt - 1), lin = conv(x, h), y = wrapN(lin, N);
      return {
        stem: 'Let $x(n)=' + seqT({ v: x, n0: 0 }) + '$ and $h(n)=' + seqT({ v: h, n0: 0 }) + '$. Both are zero-padded to $N=' + N + '$, their DFTs multiplied, and the IDFT taken.',
        parts: [
          { q: '(a) What is the smallest $N$ that would give the linear convolution?', answers: [iA('$N_{\\min}$', Lt)], working: QB.steps(['$L+M-1=' + x.length + '+' + h.length + '-1=' + Lt + '$.']) + QB.final('N_{\\min}=' + Lt) },
          { q: '(b) Find the ' + N + '-point result and the number of samples that agree with the linear convolution.', answers: y.map(function (a, n) { return iA('$y_{' + N + '}(' + n + ')$', a); }).concat([iA('correct samples', N - (Lt - N))]),
            working: QB.steps(['Linear: $y=' + seqT({ v: lin, n0: 0 }) + '$.', 'With $N=' + N + '$, samples $n\\ge' + N + '$ fold back by ' + N + ': $y_{' + N + '}=' + seqT({ v: y, n0: 0 }) + '$.', 'Only $n\\ge L+M-1-N=' + (Lt - N) + '$ are uncorrupted: ' + (N - (Lt - N)) + ' samples.']) + QB.final('y_{' + N + '}(n)=' + seqT({ v: y, n0: 0 })) }
        ],
        data: { v: v, x: x, h: h, N: N }
      };
    }
  });

  add('freq', 'circconv', 'viadft', {
    title: 'Convolution through 4-point DFTs (and deconvolution)',
    difficulty: 3, marks: 6,
    variants: [{ id: 'circ', label: 'Circular convolution via DFT' }, { id: 'linear', label: 'Linear convolution via DFT (N = L + M − 1)' }, { id: 'deconv', label: 'Deconvolution X = Y/H' }],
    tags: ['T5 Q2', 'D5 Q4', 'D5 Q6', 'DX2 Q4'],
    gen: function (r, v) {
      if (v === 'deconv') {
        var h, x;
        r.retry(function () { h = [r.int(1, 3) * r.sign(), r.int(1, 3) * r.sign()]; return Math.abs(h[0]) !== Math.abs(h[1]) ? true : null; });
        x = randSeq(r, 3, -2, 3, false);
        var y = conv(x, h), Y = dft(y, 4), H = dft(h, 4), X = Y.map(function (z, k) { return z.div(H[k]); });
        return {
          stem: 'An unknown input $x(n)$ of length 3 passes through the FIR channel $h(n)=' + seqT({ v: h, n0: 0 }) + '$. The complete output is $y(n)=' + seqT({ v: y, n0: 0 }) + '$.',
          parts: [
            { q: '(a) Compute $H(k)$ and $Y(k)$ for $N=4$. Give $H(2)$ and $Y(1)$.', answers: [nA('$H(2)$', H[2].re)].concat(reim('$Y(1)$', Y[1])),
              working: QB.steps(['$N=4\\ge$ length of $y$, so there is no time aliasing.', '$H(k)=' + h[0] + '+' + Fp(h[1]) + '(-j)^k$: $H=' + Xlist(H) + '$. None is zero, so division is allowed.', '$Y=' + Xlist(Y) + '$.']) + QB.final('H(2)=' + F(H[2].re)) },
            { q: '(b) Find $X(k)=Y(k)/H(k)$ and recover $x(n)$ by the 4-point IDFT.', answers: x.map(function (a, n) { return iA('$x(' + n + ')$', a); }),
              working: QB.steps(['$X(k)=Y(k)/H(k)=' + Xlist(X) + '$.', 'IDFT: $x(n)=\\tfrac14\\sum X(k)j^{kn}=' + seqT({ v: x.concat([0]), n0: 0 }) + '$.', 'Check: $x*h=' + seqT({ v: conv(x, h), n0: 0 }) + '=y$.']) + QB.final('x(n)=' + seqT({ v: x, n0: 0 })) }
          ],
          notes: QB.callout('trap', 'Deconvolution fails where $H(k)=0$ (e.g. $h=\\{1,1\\}$ has $H(2)=0$ for $N=4$).'),
          data: { v: v, h: h, x: x }
        };
      }
      var x1, x2, N = 4;
      if (v === 'linear') { x1 = randSeq(r, 3, -2, 3, false); x2 = randSeq(r, 2, -2, 2, true); }
      else { x1 = randSeq(r, 4, -2, 4, false); x2 = randSeq(r, r.int(3, 4), -2, 4, false); }
      var X1 = dft(x1, 4), X2 = dft(x2, 4), Yk = X1.map(function (z, k) { return z.mul(X2[k]); }), y = idft(Yk, 4).map(function (z) { return z.re; });
      var nm = v === 'linear' ? ['x', 'h'] : ['x_1', 'x_2'];
      return {
        stem: v === 'linear' ? 'An FIR filter $h(n)=' + seqT({ v: x2, n0: 0 }) + '$ is driven by $x(n)=' + seqT({ v: x1, n0: 0 }) + '$. Use 4-point DFTs to compute the output.' : 'Use the 4-point DFT and IDFT to compute $x_1(n)\\circledast_4x_2(n)$ for $x_1(n)=' + seqT({ v: x1, n0: 0 }) + '$ and $x_2(n)=' + seqT({ v: x2, n0: 0 }) + '$.',
        parts: [
          { q: '(a) Compute $' + nm[0].toUpperCase().replace('_', '_') + '(k)$ and $' + (v === 'linear' ? 'H' : 'X_2') + '(k)$. Give the $k=1$ values (real and imaginary parts).', answers: reim('$' + (v === 'linear' ? 'X' : 'X_1') + '(1)$', X1[1]).concat(reim('$' + (v === 'linear' ? 'H' : 'X_2') + '(1)$', X2[1])),
            working: QB.steps([(v === 'linear' ? 'Minimum length $L+M-1=3+2-1=4$, so $N=4$ gives the linear convolution. ' : '') + 'Zero-pad to 4 and use $\\mathbf W_4$.', '$' + (v === 'linear' ? 'X' : 'X_1') + '(k)=' + Xlist(X1) + '$.', '$' + (v === 'linear' ? 'H' : 'X_2') + '(k)=' + Xlist(X2) + '$.']) + QB.final((v === 'linear' ? 'X' : 'X_1') + '(1)=' + cxT(X1[1])) },
          { q: '(b) Form $Y(k)$ and take the IDFT. Give $Y(1)$ and $y(n)$ for $0\\le n\\le3$.', answers: reim('$Y(1)$', Yk[1]).concat(y.map(function (a, n) { return iA('$y(' + n + ')$', a); })),
            working: QB.steps(['$Y(k)=' + (v === 'linear' ? 'X(k)H(k)' : 'X_1(k)X_2(k)') + '=' + Xlist(Yk) + '$.', 'IDFT ($+j$, divide by 4): $y(n)=\\tfrac14\\sum_kY(k)j^{kn}$.', '$y=' + seqT({ v: y, n0: 0 }) + '$.', v === 'linear' ? 'Check against direct linear convolution: $' + seqT({ v: conv(x1, x2), n0: 0 }) + '$.' : 'Check against the circulant matrix (or linear convolution wrapped mod 4): $' + seqT({ v: circ(x1, x2, 4), n0: 0 }) + '$.']) + QB.final('y(n)=' + seqT({ v: y, n0: 0 })) }
        ],
        data: { v: v, x1: x1, x2: x2 }
      };
    }
  });

  /* =====================================================================
   * freq.spectral — Fs, N, T0, resolution, bins (D6 Playbooks A–C; T5 Q5)
   * ===================================================================== */
  add('freq', 'spectral', 'design', {
    title: 'Choose Fs, N = 2ᵐ and record length T₀ for a resolution',
    difficulty: 1, marks: 3,
    variants: [{ id: 'pow2', label: 'Minimum Fs, rectangular window' }, { id: 'givenfs', label: 'ADC rate fixed' }, { id: 'hann', label: 'Hanning window (≈ 2× record)' }],
    tags: ['T5 Q5', 'D6 Example 1', 'DX1 Q4(d)'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var B = r.pick([3, 4, 5, 8, 10, 20, 2.5]) * 1000, dF = r.pick([50, 25, 10, 100, 20, 5, 30, 40]);
        var Fs = v === 'givenfs' ? r.pick([2.4, 2.5, 3]) * B : 2 * B;
        var need = (v === 'hann' ? 2 : 1) * Fs / dF, m = Math.ceil(Math.log2(need) - 1e-12), N = Math.pow(2, m);
        if (need / Math.pow(2, Math.floor(Math.log2(need))) < 1.05 && Math.abs(Math.log2(need) - Math.round(Math.log2(need))) > 1e-9) return null;
        if (N > 65536) return null;
        return { B: B, dF: dF, Fs: Fs, need: need, N: N, m: m };
      });
      var T0 = d.N / d.Fs, res = d.Fs / d.N;
      return {
        stem: 'An analogue signal has bandwidth $B=' + F(d.B / 1000) + '$ kHz. ' + (v === 'givenfs' ? 'It is sampled by an ADC fixed at $F_s=' + F(d.Fs / 1000) + '$ kHz. ' : '') + 'An $N=2^m$-point DFT' + (v === 'hann' ? ' with a Hanning window' : '') + ' must resolve components $' + d.dF + '$ Hz apart (resolution $\\le' + d.dF + '$ Hz).',
        parts: [
          { q: '(a) ' + (v === 'givenfs' ? 'Is $F_s$ adequate? (1 = yes)' : 'Find the minimum sampling rate.'), answers: [v === 'givenfs' ? bA('$F_s$ adequate', true) : nA('$F_s$', d.Fs, 'Hz')],
            working: QB.steps(['$F_s\\ge2B=' + F(2 * d.B / 1000) + '$ kHz' + (v === 'givenfs' ? '; $' + F(d.Fs / 1000) + '$ kHz satisfies this.' : ', so $F_s=' + F(d.Fs / 1000) + '$ kHz (use the minimum: a higher $F_s$ needs a larger $N$).')]) + QB.final('F_s=' + F(d.Fs / 1000) + '\\ \\text{kHz}') },
          { q: '(b) Find the minimum number of samples $N=2^m$ and the minimum record length $T_0$.', answers: [iA('$N$', d.N), nA('$T_0$', T0, 's')],
            working: QB.steps([v === 'hann' ? 'Hanning doubles the main-lobe width, so budget $L\\ge2F_s/\\Delta F=' + F(d.need, 5) + '$ (rule of thumb).' : 'Resolution $=F_s/N\\le\\Delta F$, so $N\\ge F_s/\\Delta F=' + F(d.Fs) + '/' + d.dF + '=' + F(d.need, 5) + '$.', '$m=\\lceil\\log_2' + F(d.need, 5) + '\\rceil=\\lceil' + F(Math.log2(d.need), 4) + '\\rceil=' + d.m + '$, so $N=2^{' + d.m + '}=' + d.N + '$ (always round <b>up</b>).', '$T_0=N/F_s=' + d.N + '/' + F(d.Fs) + '=' + F(T0, 4) + '$ s.']) + QB.final('N=' + d.N + ',\\ T_0=' + QB.fmt.tex.eng(T0, 's', 4)) },
          { q: '(c) What is the actual bin spacing $F_s/N$?', answers: [nA('$F_s/N$', res, 'Hz')],
            working: QB.steps(['$F_s/N=' + F(d.Fs) + '/' + d.N + '=' + F(res, 4) + '$ Hz' + (v === 'hann' ? '; the Hanning main lobe is about 4 bins $\\approx' + F(4 * res, 4) + '$ Hz wide null to null.' : ' $\\le' + d.dF + '$ Hz, as required.')]) + QB.final(F(res, 4) + '\\ \\text{Hz}') }
        ],
        data: { v: v, B: d.B, dF: d.dF, Fs: d.Fs }
      };
    }
  });

  add('freq', 'spectral', 'bins', {
    title: 'DFT bin frequencies, mirror bins and leakage',
    difficulty: 1, marks: 3,
    variants: [{ id: 'aligned', label: 'Bin-aligned tone' }, { id: 'binfreq', label: 'Frequency of a given bin' }, { id: 'leak', label: 'Off-bin tone (leakage)' }],
    tags: ['D6 N1', 'D6 Example 2'],
    gen: function (r, v) {
      var Fs = r.pick([1000, 2000, 8000, 10000, 16000, 12000]), N = r.pick([64, 100, 128, 200, 256, 500, 512]), sp = Fs / N;
      if (v === 'binfreq') {
        var k1 = r.int(1, Math.floor(N / 2) - 1), k2 = r.int(Math.floor(N / 2) + 1, N - 1);
        return {
          stem: 'A signal sampled at $F_s=' + Fs + '$ Hz is analysed with an $N=' + N + '$-point DFT (no zero-padding).',
          parts: [{ q: 'Find the frequency resolution, the record length, and the analogue frequency of bins $k=' + k1 + '$ and $k=' + k2 + '$.', answers: [nA('$F_s/N$', sp, 'Hz'), nA('$T_0$', N / Fs, 's'), nA('$F_{' + k1 + '}$', k1 * sp, 'Hz'), nA('$F_{' + k2 + '}$', -(N - k2) * sp, 'Hz')],
            working: QB.steps(['Resolution $F_s/N=' + F(sp, 4) + '$ Hz; $T_0=N/F_s=' + F(N / Fs, 4) + '$ s.', '$F_k=kF_s/N$ for $0\\le k\\le N/2$: $F_{' + k1 + '}=' + F(k1 * sp, 5) + '$ Hz.', '$k=' + k2 + '>N/2$ is a negative frequency: $-(N-k)F_s/N=-' + (N - k2) + '\\times' + F(sp, 4) + '=' + F(-(N - k2) * sp, 5) + '$ Hz (mirror of bin ' + (N - k2) + ', not $' + F(k2 * sp, 5) + '$ Hz).']) + QB.final('F_{' + k2 + '}=' + F(-(N - k2) * sp, 5) + '\\ \\text{Hz}') }],
          data: { v: v, Fs: Fs, N: N, k1: k1, k2: k2 }
        };
      }
      var A = r.int(1, 4);
      if (v === 'aligned') {
        var k0 = r.int(2, Math.floor(N / 2) - 2), F0 = k0 * sp;
        return {
          stem: '$x(n)=' + A + '\\cos(2\\pi F_0n/F_s)$ with $F_0=' + F(F0, 6) + '$ Hz is sampled at $F_s=' + Fs + '$ Hz, and $N=L=' + N + '$ samples go into a DFT (rectangular window).',
          parts: [{ q: 'In which two bins does the tone appear, and what is $|X(k_0)|$?', answers: [iA('$k_0$', k0), iA('mirror bin', N - k0), nA('$|X(k_0)|$', A * N / 2)],
            working: QB.steps(['Bin spacing $F_s/N=' + F(sp, 4) + '$ Hz; $k_0=F_0N/F_s=' + F(F0, 6) + '/' + F(sp, 4) + '=' + k0 + '$, an integer: the record holds a whole number of cycles.', 'A real cosine also appears at $N-k_0=' + (N - k0) + '$.', 'Bin-aligned with $N=L$: one clean line of height $AN/2=' + A + '\\times' + N + '/2=' + F(A * N / 2) + '$; all other bins are 0 (no leakage).']) + QB.final('k=' + k0 + ',\\ ' + (N - k0) + ';\\ |X|=' + F(A * N / 2)) }],
          data: { v: v, Fs: Fs, N: N, k0: k0, A: A }
        };
      }
      var kk = r.retry(function () { var k = r.int(4, Math.floor(N / 2) - 4) + r.pick([0.25, 0.5, 0.3, 0.7, 0.4, 0.6]); return k; });
      var Fl = kk * sp;
      return {
        stem: '$x(n)=' + A + '\\cos(2\\pi F_0n/F_s)$ with $F_0=' + F(Fl, 6) + '$ Hz is sampled at $F_s=' + Fs + '$ Hz and analysed with $N=L=' + N + '$ (rectangular window).',
        parts: [{ q: 'Find the (non-integer) bin position $k_0$, the two bins with the largest values, and say whether there is leakage (1 = yes).', answers: [nA('$k_0$', kk), iA('lower bin', Math.floor(kk)), iA('upper bin', Math.ceil(kk)), bA('leakage', true)],
          working: QB.steps(['$k_0=F_0N/F_s=' + F(Fl, 6) + '\\times' + N + '/' + Fs + '=' + F(kk, 4) + '$.', 'Not bin-aligned: the DFT samples land on the side lobes of the window transform, so every bin gets some energy (leakage), with peaks in bins $' + Math.floor(kk) + '$ and $' + Math.ceil(kk) + '$ and a lower peak height (scalloping).', 'A Hanning window reduces the leakage (side lobes $-31$ dB instead of $-13$ dB) at the cost of a main lobe about twice as wide.']) + QB.final('k_0=' + F(kk, 4)) }],
        data: { v: v, Fs: Fs, N: N, kk: kk }
      };
    }
  });

  add('freq', 'spectral', 'zeropad', {
    title: 'Zero-padding: bin spacing vs true resolution',
    difficulty: 2, marks: 3,
    variants: [{ id: 'merge', label: 'Tones too close (merge)' }, { id: 'resolve', label: 'Tones far enough apart' }],
    tags: ['D6 N2', 'DX1 Q4(e)', 'D6 N6(d)'],
    gen: function (r, v) {
      var d = r.retry(function () {
        var Fs = r.pick([1000, 8000, 12000, 2000, 10000]), L = r.pick([100, 128, 200, 256, 400, 500]), N = r.pick([512, 1024, 2048, 4096]);
        if (N <= L) return null;
        var res = Fs / L, dF = v === 'merge' ? r.pick([0.3, 0.5, 0.6, 0.8]) * res : r.pick([1.3, 1.6, 2, 2.5]) * res;
        dF = Math.round(dF * 10) / 10; if (dF <= 0) return null;
        if ((v === 'merge') !== (dF < res)) return null;
        var F1 = Math.round(r.pick([0.1, 0.15, 0.2, 0.25]) * Fs);
        var Lmin = Math.ceil(Fs / dF - 1e-9), N2 = Math.pow(2, Math.ceil(Math.log2(Lmin) - 1e-12));
        return { Fs: Fs, L: L, N: N, res: res, dF: dF, F1: F1, Lmin: Lmin, N2: N2 };
      });
      return {
        stem: '$L=' + d.L + '$ samples of a signal are taken at $F_s=' + F(d.Fs) + '$ Hz and zero-padded to $N=' + d.N + '$ before the DFT. The signal contains tones at $' + d.F1 + '$ Hz and $' + F(d.F1 + d.dF, 6) + '$ Hz.',
        parts: [
          { q: '(a) Find the bin spacing and the frequency resolution.', answers: [nA('bin spacing', d.Fs / d.N, 'Hz'), nA('resolution', d.res, 'Hz')],
            working: QB.steps(['Bin spacing $=F_s/N=' + F(d.Fs) + '/' + d.N + '=' + F(d.Fs / d.N, 4) + '$ Hz (grid only).', 'Resolution $=1/T_0$ with $T_0=L/F_s=' + F(d.L / d.Fs, 4) + '$ s: $F_s/L=' + F(d.res, 4) + '$ Hz.']) + QB.final('\\Delta F=' + F(d.res, 4) + '\\ \\text{Hz}') },
          { q: '(b) Are the two tones resolved (1 = yes)? Find the minimum number of real samples needed, and the matching power-of-2 length.', answers: [bA('resolved', v === 'resolve'), iA('$L_{\\min}$', d.Lmin), iA('power-of-2 $L$', d.N2)],
            working: QB.steps(['Separation $' + F(d.dF) + '$ Hz ' + (v === 'resolve' ? '$\\ge$' : '$<$') + ' $' + F(d.res, 4) + '$ Hz, so ' + (v === 'resolve' ? 'they are resolved (course rule).' : 'they merge into one lobe. Zero-padding only interpolates the same smeared DTFT; it cannot separate them.'), 'Need $F_s/L\\le' + F(d.dF) + '$: $L\\ge' + F(d.Fs) + '/' + F(d.dF) + '=' + F(d.Fs / d.dF, 5) + '\\Rightarrow L_{\\min}=' + d.Lmin + '$; power of 2: $' + d.N2 + '$.']) + QB.final(v === 'resolve' ? '\\text{resolved}' : '\\text{not resolved}') }
        ],
        notes: QB.callout('trap', 'Write "bin spacing" for $F_s/N$ and "resolution" for $1/T_0=F_s/L$. Zero-padding changes only the first.'),
        data: { v: v, Fs: d.Fs, L: d.L, N: d.N, dF: d.dF }
      };
    }
  });

  /* =====================================================================
   * freq.block — overlap-add / overlap-save (D6 Playbook E; DX2 Q5)
   * ===================================================================== */
  add('freq', 'block', 'ola', {
    title: 'Overlap-add by hand',
    difficulty: 2, marks: 5,
    variants: [{ id: 'L3', label: 'Blocks of L = 3' }, { id: 'L4', label: 'Blocks of L = 4' }],
    tags: ['D6 Example 3', 'D6 N3'],
    gen: function (r, v) {
      var L = v === 'L3' ? 3 : 4, Lx = r.int(L + 3, 2 * L + 1), x = randSeq(r, Lx, -2, 4, false), h = randSeq(r, r.int(2, 3), -2, 3, false), M = h.length, N = L + M - 1;
      var nb = Math.ceil(Lx / L), y = conv(x, h), blocks = [];
      for (var i = 0; i < nb; i++) { var xb = pad(x.slice(i * L, i * L + L), L); blocks.push({ x: xb, y: conv(xb, h), at: i * L }); }
      var ov = []; for (var i2 = 1; i2 < nb; i2++) for (var j = 0; j < M - 1; j++) if (i2 * L + j < y.length) ov.push(i2 * L + j);
      var tblRows = blocks.map(function (b, i) { return ['$y_' + i + '$'].concat(range(0, y.length - 1).map(function (n) { var k = n - b.at; return k >= 0 && k < N ? F(b.y[k]) : ''; })); });
      tblRows.push(['$y$'].concat(y.map(function (a) { return '<b>' + F(a) + '</b>'; })));
      return {
        stem: 'The FIR filter $h(n)=' + seqT({ v: h, n0: 0 }) + '$ is applied to $x(n)=' + seqT({ v: x, n0: 0 }) + '$ by the <b>overlap-add</b> method with blocks of $L=' + L + '$ input samples.',
        figure: stemFig([{ v: x, n0: 0, label: 'x(n)' }, { v: h, n0: 0, label: 'h(n)' }]),
        parts: [
          { q: '(a) What DFT length $N$ is needed, and how many blocks?', answers: [iA('$N$', N), iA('blocks', nb)],
            working: QB.steps(['$M=' + M + '$, so $N=L+M-1=' + L + '+' + M + '-1=' + N + '$; $h$ is zero-padded to $N$ once.', 'Blocks: $\\lceil L_x/L\\rceil=\\lceil' + Lx + '/' + L + '\\rceil=' + nb + '$ (the last block is padded with zeros).']) + QB.final('N=' + N + ',\\ ' + nb + '\\ \\text{blocks}') },
          { q: '(b) Find the output samples where block outputs overlap (n = ' + ov.join(', ') + ') and the last output sample.', answers: ov.map(function (n) { return iA('$y(' + n + ')$', y[n]); }).concat([iA('$y(' + (y.length - 1) + ')$', y[y.length - 1])]),
            working: QB.steps(blocks.map(function (b, i) { return 'Block ' + i + ': $' + seqT({ v: b.x, n0: 0 }) + '$ plus ' + (M - 1) + ' zeros; a length-' + L + ' block convolved with length-' + M + ' $h$ is exactly ' + N + ' long, so the circular result is the linear one: $y_' + i + '=' + seqT({ v: b.y, n0: 0 }) + '$, placed from $n=' + b.at + '$.'; }).concat(['Overlap by $M-1=' + (M - 1) + '$ and <b>add</b>:', QB.tbl(['$n$'].concat(range(0, y.length - 1).map(String)), tblRows), 'Check: length $L_x+M-1=' + y.length + '$; e.g. $y(' + ov[0] + ')=\\sum_k h(k)x(' + ov[0] + '-k)=' + y[ov[0]] + '$.'])) + QB.final('y(n)=' + seqT({ v: y, n0: 0 })) }
        ],
        data: { v: v, x: x, h: h, L: L }
      };
    }
  });

  add('freq', 'block', 'ols', {
    title: 'Overlap-save by hand',
    difficulty: 3, marks: 6,
    variants: [{ id: 'N4', label: 'N = 4' }, { id: 'N5', label: 'N = 5' }, { id: 'N6', label: 'N = 6' }],
    tags: ['D6 Example 4', 'D6 N4', 'DX2 Q5'],
    gen: function (r, v) {
      var N = +v.slice(1), h = randSeq(r, r.int(2, Math.min(3, N - 2)), -2, 3, false), M = h.length, L = N - M + 1;
      var Lx = r.int(L + 2, Math.min(9, 3 * L)), x = randSeq(r, Lx, -2, 4, false), Ly = Lx + M - 1, nb = Math.ceil(Ly / L), y = conv(x, h);
      var xp = pad([], M - 1).concat(x).concat(pad([], nb * L + M));
      var blocks = []; for (var i = 0; i < nb; i++) { var xb = xp.slice(i * L, i * L + N); var c = circ(xb, h, N); blocks.push({ x: xb, c: c, keep: c.slice(M - 1) }); }
      var b1 = blocks[1];
      return {
        stem: 'The filter $h(n)=' + seqT({ v: h, n0: 0 }) + '$ is applied to $x(n)=' + seqT({ v: x, n0: 0 }) + '$ by the <b>overlap-save</b> method with $N=' + N + '$-point circular convolutions.',
        parts: [
          { q: '(a) How many new input samples does each block carry, how many outputs per block are discarded, and how many blocks are needed?', answers: [iA('$L$', L), iA('discarded', M - 1), iA('blocks', nb)],
            working: QB.steps(['$M=' + M + '$, so $L=N-M+1=' + N + '-' + M + '+1=' + L + '$. Discard the first $M-1=' + (M - 1) + '$ outputs of each block.', 'Total output length $L_x+M-1=' + Ly + '$, so $\\lceil' + Ly + '/' + L + '\\rceil=' + nb + '$ blocks.']) + QB.final('L=' + L + ',\\ ' + nb + '\\ \\text{blocks}') },
          { q: '(b) Write block 1 (the second block), its ' + N + '-point circular convolution with $h$, and the samples you keep.', answers: b1.c.map(function (a, n) { return iA('block-1 output ' + n, a); }),
            working: QB.steps(['Each block is the last $M-1$ samples of the previous block followed by $L$ new ones; block 0 starts with $M-1$ zeros.', blocks.map(function (b, i) { return '$x_' + i + '=' + seqT({ v: b.x, n0: 0 }) + '$'; }).join(', ') + '.', 'Circular convolution by hand: linear convolution of the block with $h$ (length ' + (N + M - 1) + '), then fold the last $M-1$ samples onto the first $M-1$: $x_1*h=' + seqT({ v: conv(b1.x, h), n0: 0 }) + '\\Rightarrow x_1\\circledast_' + N + 'h=' + seqT({ v: b1.c, n0: 0 }) + '$.', 'Discard $' + seqT({ v: b1.c.slice(0, M - 1), n0: 0 }).replace(/\\underset\{\\uparrow\}\{([^}]*)\}/, '$1') + '$ (time-aliased) and keep $' + seqT({ v: b1.keep, n0: 0 }).replace(/\\underset\{\\uparrow\}\{([^}]*)\}/, '$1') + '$.']) + QB.final('x_1\\circledast_' + N + 'h=' + seqT({ v: b1.c, n0: 0 })) },
          { q: '(c) Assemble $y(n)$. Give $y(' + L + ')$ and the last sample $y(' + (Ly - 1) + ')$.', answers: [iA('$y(' + L + ')$', y[L]), iA('$y(' + (Ly - 1) + ')$', y[Ly - 1])],
            working: QB.steps(blocks.map(function (b, i) { return 'Block ' + i + ': circular $' + seqT({ v: b.c, n0: 0 }) + '$, keep $\\{' + b.keep.map(function (a) { return F(a); }).join(',') + '\\}$.'; }).concat(['Concatenate the kept samples and truncate to $' + Ly + '$: $y=' + seqT({ v: y, n0: 0 }) + '$.', 'Direct check: $y(' + L + ')=\\sum_k h(k)x(' + L + '-k)=' + y[L] + '$.'])) + QB.final('y(n)=' + seqT({ v: y, n0: 0 })) }
        ],
        notes: QB.callout('trap', 'Discard the <b>first</b> $M-1$ outputs, not the last, and carry over $M-1$ samples, not $L$.'),
        data: { v: v, x: x, h: h, N: N }
      };
    }
  });

  add('freq', 'block', 'counts', {
    title: 'Block convolution sizing: L, N and block counts',
    difficulty: 1, marks: 3,
    variants: [{ id: 'givenN', label: 'FFT size N given' }, { id: 'givenL', label: 'Block length L given' }],
    tags: ['D6 table', 'D6 N4(d)'],
    gen: function (r, v) {
      var M = r.pick([31, 33, 63, 65, 101, 129, 17, 21]), Lx = r.int(5, 200) * 50;
      var N, L;
      if (v === 'givenN') { N = r.pick([128, 256, 512, 1024, 2048].filter(function (n) { return n > 2 * M; })); L = N - M + 1; }
      else { L = r.pick([100, 200, 256, 400, 500, 1000]); N = L + M - 1; }
      var ola = Math.ceil(Lx / L), ols = Math.ceil((Lx + M - 1) / L), N2 = Math.pow(2, Math.ceil(Math.log2(N) - 1e-12));
      var ans = v === 'givenN' ? [iA('$L$', L), iA('OLA blocks', ola), iA('OLS blocks', ols), iA('output length', Lx + M - 1)] : [iA('$N$', N), iA('radix-2 $N$', N2), iA('OLA blocks', ola), iA('OLS blocks', ols)];
      return {
        stem: 'A length-$' + M + '$ FIR filter is applied to an input of $L_x=' + Lx + '$ samples using block convolution ' + (v === 'givenN' ? 'with $N=' + N + '$-point DFTs.' : 'with $L=' + L + '$ new input samples per block.'),
        parts: [{ q: v === 'givenN' ? 'Find the new samples per block $L$, the number of blocks for overlap-add and for overlap-save, and the total output length.' : 'Find the DFT length $N$ (and the radix-2 FFT size), and the number of blocks for overlap-add and overlap-save.', answers: ans,
          working: QB.steps([v === 'givenN' ? '$L=N-M+1=' + N + '-' + M + '+1=' + L + '$.' : '$N=L+M-1=' + L + '+' + M + '-1=' + N + '$; next power of 2: $' + N2 + '$ (then $L$ could be raised to $' + (N2 - M + 1) + '$).', 'Overlap-add: blocks of $L$ new samples plus $M-1$ zeros; $\\lceil L_x/L\\rceil=\\lceil' + Lx + '/' + L + '\\rceil=' + ola + '$ blocks; add the $M-1=' + (M - 1) + '$ overlapping outputs.', 'Overlap-save: each block delivers $L$ good outputs after discarding the first $M-1=' + (M - 1) + '$; $\\lceil(L_x+M-1)/L\\rceil=\\lceil' + (Lx + M - 1) + '/' + L + '\\rceil=' + ols + '$ blocks.', 'Total output length $L_x+M-1=' + (Lx + M - 1) + '$. $H(k)$ is computed once and reused for every block.']) + QB.final('\\text{OLA }' + ola + ',\\ \\text{OLS }' + ols) }],
        data: { v: v, M: M, Lx: Lx, N: N, L: L }
      };
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);

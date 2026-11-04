/* ink.js: draw on questions (Apple Pencil, finger or mouse). Global `SRInk` (window.Ink is a native browser API).
 *
 *   SRInk.attach(el, key, {blocks, btnHost, title}) -> handle {detach(), el}
 *     el      a position:relative container (a question card)
 *     key     stable id used for storage, e.g. 'pack:M7#q-4073bad8' or 'qb:mach.im.x@123:motor'
 *     blocks  CSS selector (relative to el, :scope allowed) for the layout blocks that strokes
 *             anchor to; default ':scope > *'. Each stroke is stored relative to the block it
 *             starts on, so opening a solution or "Show working" moves the ink with the content.
 *   SRInk.exportAll() -> Promise<{key: record}>   SRInk.importAll(obj) -> Promise
 *
 * Storage: IndexedDB 'studyres-ink' (falls back to localStorage). Coordinates are in units of
 * 1/1000 of the card width, so ink scales with rotation and window size.
 * Pencil vs finger: once an Apple Pencil touches the page, fingers scroll and only the pencil
 * draws (toggle "Finger draws" to change). Before that, finger/mouse draw.
 */
(function (G) {
  'use strict';
  if (G.SRInk) return;
  var doc = G.document;
  var COLOURS = [['#1b1b1f', 'Black'], ['#1f5fbf', 'Blue'], ['#c0362c', 'Red'], ['#1f8a4c', 'Green']];
  var HL = ['#ffd84d', 'Highlighter'];
  var PEN_W = 2.6, HL_W = 16, ERASE_R = 14, PAD_STEP = 320; // units (1/1000 of width)

  /* ---------- storage ---------- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var rq = G.indexedDB.open('studyres-ink', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('ink'); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function lsKey(k) { return 'studyres.ink.' + k; }
  function load(k) {
    return db().then(function (d) {
      if (!d) { try { return JSON.parse(localStorage.getItem(lsKey(k)) || 'null'); } catch (e) { return null; } }
      return new Promise(function (res) { try { var r = d.transaction('ink').objectStore('ink').get(k); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } });
    });
  }
  function save(k, rec) {
    var empty = !rec || (!rec.s.length && !rec.pad);
    return db().then(function (d) {
      if (!d) { try { if (empty) localStorage.removeItem(lsKey(k)); else localStorage.setItem(lsKey(k), JSON.stringify(rec)); } catch (e) {} return; }
      return new Promise(function (res) { try { var tx = d.transaction('ink', 'readwrite'), st = tx.objectStore('ink'); if (empty) st.delete(k); else st.put(rec, k); tx.oncomplete = tx.onerror = function () { res(); }; } catch (e) { res(); } });
    });
  }
  function all() {
    return db().then(function (d) {
      var out = {};
      if (!d) { try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('studyres.ink.') === 0) out[k.slice(13)] = JSON.parse(localStorage.getItem(k)); } } catch (e) {} return out; }
      return new Promise(function (res) {
        try { var st = d.transaction('ink').objectStore('ink'), rq = st.openCursor(); rq.onsuccess = function () { var c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; rq.onerror = function () { res(out); }; } catch (e) { res(out); }
      });
    });
  }

  /* ---------- styles ---------- */
  var CSS = [
    '.ink-host{position:relative}',
    '.ink-layer{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:3;overflow:hidden;border-radius:inherit}',
    '.ink-layer canvas{position:absolute;left:0;top:0;display:block}',
    '.ink-host.ink-on .ink-layer{pointer-events:auto;touch-action:none;cursor:crosshair}',
    '.ink-host.ink-on{outline:2px dashed var(--c,#555);outline-offset:3px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    '.ink-hidden .ink-layer{display:none}',
    '.ink-pad{display:block;margin:10px 0 4px;border:1px dashed var(--line,#ccc);border-radius:10px;background-image:radial-gradient(circle,rgba(127,127,127,.32) 1px,transparent 1.2px);background-size:22px 22px;position:relative}',
    '.ink-pad[hidden]{display:none}',
    '.ink-pad::after{content:"Working space";position:absolute;left:10px;top:6px;font:600 11px/1 var(--f-mono,ui-monospace,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#888);opacity:.7}',
    '.inkbtn{position:absolute;top:52px;right:6px;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;border:0;border-radius:10px;background:transparent;color:var(--muted,#777);cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:4;font:inherit}',
    '.inkbtn:hover{background:var(--soft,rgba(127,127,127,.12));color:var(--c,#333)}',
    '.inkbtn.has::after{content:"";position:absolute;right:8px;bottom:9px;width:7px;height:7px;border-radius:50%;background:var(--c,#333)}',
    '.inkbtn.on{color:#fff;background:var(--c,#333)}',
    '.inkbar{position:fixed;left:50%;bottom:max(14px,calc(env(safe-area-inset-bottom,0px) + 10px));transform:translateX(-50%);z-index:80;display:flex;align-items:center;gap:4px;padding:6px 8px;background:var(--card,#fff);color:var(--fg,#222);border:1px solid var(--line,#ccc);border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.22);max-width:calc(100vw - 16px);overflow-x:auto;-webkit-overflow-scrolling:touch;font:500 13px/1 var(--f-sans,system-ui,sans-serif)}',
    '.inkbar[hidden]{display:none!important}',
    '.inkbar button{flex:none;min-width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 8px;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent}',
    '.inkbar button:hover{background:var(--soft,rgba(127,127,127,.12))}',
    '.inkbar button[aria-pressed="true"]{background:var(--soft,rgba(127,127,127,.16));box-shadow:inset 0 0 0 2px var(--c,#333)}',
    '.inkbar button:disabled{opacity:.35;cursor:default}',
    '.inkbar .sw{width:20px;height:20px;border-radius:50%;display:block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}',
    '.inkbar .sep{flex:none;width:1px;height:28px;background:var(--line,#ccc);margin:0 3px}',
    '.inkbar .done{background:var(--c,#333);color:#fff;font-weight:600;padding:0 14px}',
    '.inkbar .done:hover{background:var(--c,#333);filter:brightness(1.08)}',
    '.inkbar .lbl{white-space:nowrap}',
    '@media (max-width:520px){.inkbar .lbl{display:none}}',
    '.pm-body .inkbtn{top:6px}',
    '@media print{.inkbtn,.inkbar,.ink-pad::after{display:none!important}.ink-host.ink-on{outline:0}}'
  ].join('\n');
  function injectCSS() { if (doc.getElementById('ink-css')) return; var s = doc.createElement('style'); s.id = 'ink-css'; s.textContent = CSS; doc.head.appendChild(s); }

  var ICON_PEN = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z M13.8 6.8l3.4 3.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  function ic(d, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  var I = {
    hl: ic('M9 15l-3 3h4l1.6-1.6M9 15l7.5-9.5a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L10 16z M4 21h16'),
    er: ic('M8 20h12 M5.5 14.5l7-7a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 19H8.6z M9 11l5 5'),
    undo: ic('M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3'),
    redo: ic('M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3'),
    pad: ic('M12 5v14 M5 12h14'),
    clear: ic('M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13'),
    hand: ic('M8 12V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4.5a1.5 1.5 0 0 1 3 0V11 M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.4 0-4-1.2-5.3-3.2L3.6 13a1.5 1.5 0 0 1 2.5-1.6L8 14')
  };

  /* ---------- global tool state ---------- */
  var T = { tool: 'pen', colour: COLOURS[0][0], finger: null, penSeen: false };
  try { var sv = JSON.parse(localStorage.getItem('studyres.inktool') || '{}'); if (sv.colour) T.colour = sv.colour; if (sv.tool) T.tool = sv.tool; if (sv.penSeen) T.penSeen = true; if (typeof sv.finger === 'boolean') T.finger = sv.finger; } catch (e) {}
  function saveTool() { try { localStorage.setItem('studyres.inktool', JSON.stringify(T)); } catch (e) {} }
  var active = null, bar = null;

  function fingerDraws() { return T.finger != null ? T.finger : !T.penSeen; }

  /* ---------- one inked element ---------- */
  function Inked(el, key, opts) {
    var self = this; opts = opts || {};
    this.el = el; this.key = key; this.opts = opts;
    this.rec = { v: 1, s: [], pad: 0 };
    this.hist = []; this.fut = [];
    el.classList.add('ink-host');
    var pad = doc.createElement('div'); pad.className = 'ink-pad'; pad.hidden = true; pad.setAttribute('data-ink-skip', '');
    el.appendChild(pad); this.pad = pad;
    var layer = doc.createElement('div'); layer.className = 'ink-layer'; layer.setAttribute('data-ink-skip', '');
    var c1 = doc.createElement('canvas'), c2 = doc.createElement('canvas');
    layer.appendChild(c1); layer.appendChild(c2); el.appendChild(layer);
    this.layer = layer; this.c1 = c1; this.c2 = c2;
    var btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'inkbtn'; btn.innerHTML = ICON_PEN;
    btn.title = 'Draw on this question'; btn.setAttribute('aria-label', 'Draw on this question'); btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('data-ink-skip', '');
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (active === self) stop(); else start(self); });
    (opts.btnHost || el).appendChild(btn); this.btn = btn;
    this.ro = (G.ResizeObserver ? new ResizeObserver(function () { self.schedule(); }) : null);
    if (this.ro) this.ro.observe(el); else G.addEventListener('resize', function () { self.schedule(); });
    // re-render when <details> inside toggle (ResizeObserver catches it too, this is a backup)
    el.addEventListener('toggle', function () { self.schedule(); }, true);
    this.bindPointer();
    load(key).then(function (r) { if (r && r.s) { self.rec = r; self.pad.hidden = !r.pad; self.layout(); } self.mark(); });
    this.layout();
  }
  Inked.prototype.detach = function () {
    if (active === this) stop();
    if (this.ro) this.ro.disconnect();
    [this.layer, this.pad, this.btn].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    this.el.classList.remove('ink-host', 'ink-on');
    this.dead = true;
  };
  Inked.prototype.mark = function () { this.btn.classList.toggle('has', this.rec.s.length > 0); };
  Inked.prototype.schedule = function () { var self = this; if (this._raf) return; this._raf = G.requestAnimationFrame(function () { self._raf = 0; self.layout(); }); };
  Inked.prototype.blocks = function () {
    var sel = this.opts.blocks || ':scope > *', list;
    try { list = this.el.querySelectorAll(sel); } catch (e) { list = this.el.children; }
    var out = [], r0 = this.el.getBoundingClientRect();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.hasAttribute('data-ink-skip') && b !== this.pad) continue;
      if (b.classList.contains('inkbtn') || b.classList.contains('flagbtn') || b.classList.contains('fanchor')) continue;
      out.push(b);
    }
    // the pad is always the last block (index -1 in storage)
    this._blocks = out.filter(function (b) { return b !== this.pad; }, this);
    var w = this.el.clientWidth || 1;
    this.scale = w / 1000;
    this._tops = this._blocks.map(function (b) { var r = b.getBoundingClientRect(); return (r.height || r.width) ? (r.top - r0.top) : null; });
    var pr = this.pad.getBoundingClientRect();
    this._padTop = this.pad.hidden ? null : pr.top - r0.top;
    return this._blocks;
  };
  Inked.prototype.topOf = function (b) {
    if (b === -1) return this._padTop != null ? this._padTop : null;
    var t = this._tops[b];
    if (t == null) { for (var j = b; j >= 0; j--) if (this._tops[j] != null) return this._tops[j]; return 0; }
    return t;
  };
  Inked.prototype.blockAt = function (y) {
    if (this._padTop != null && y >= this._padTop - 2) return -1;
    var best = 0;
    for (var i = 0; i < this._tops.length; i++) { var t = this._tops[i]; if (t != null && t <= y + 0.5) best = i; }
    return best;
  };
  Inked.prototype.layout = function () {
    if (this.dead) return;
    this.pad.hidden = !this.rec.pad;
    this.pad.style.height = this.rec.pad ? (this.rec.pad * (this.el.clientWidth || 1) / 1000) + 'px' : '';
    this.blocks();
    var w = this.el.clientWidth, h = this.el.scrollHeight;
    var dpr = Math.min(G.devicePixelRatio || 1, 2);
    while (dpr > 1 && w * h * dpr * dpr > 14e6) dpr -= 0.25;
    this.dpr = dpr;
    [this.c1, this.c2].forEach(function (c) {
      var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      c.style.width = w + 'px'; c.style.height = h + 'px';
    });
    this.layer.style.height = h + 'px';
    this.dark = isDark(this.el);
    this.layer.style.mixBlendMode = this.dark ? 'normal' : 'multiply';
    this.redraw();
  };
  function isDark(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var m = (G.getComputedStyle(n).backgroundColor || '').match(/[\d.]+/g);
      if (m && m.length >= 3 && (m.length < 4 || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 110;
    }
    return false;
  }
  var DARKMAP = { '#1b1b1f': '#ececf0', '#1f5fbf': '#6ea8ff', '#c0362c': '#ff7a6e', '#1f8a4c': '#5fd38f' };
  Inked.prototype.col = function (c) { return this.dark ? (DARKMAP[c] || c) : c; };
  Inked.prototype.ctx = function (c) { var x = c.getContext('2d'); x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); return x; };
  Inked.prototype.redraw = function () {
    var x = this.ctx(this.c1); x.clearRect(0, 0, this.c1.width, this.c1.height);
    for (var i = 0; i < this.rec.s.length; i++) this.paint(x, this.rec.s[i]);
    this.ctx(this.c2).clearRect(0, 0, this.c2.width, this.c2.height);
  };
  Inked.prototype.pts = function (st) {
    var top = this.topOf(st.b); if (top == null) return null;
    var s = this.scale, p = st.p, out = [];
    for (var i = 0; i < p.length; i += 3) out.push(p[i] * s, top + p[i + 1] * s, p[i + 2] / 100);
    return out;
  };
  Inked.prototype.paint = function (x, st) {
    var q = this.pts(st); if (!q || !q.length) return;
    var s = this.scale;
    x.lineCap = 'round'; x.lineJoin = 'round';
    if (st.t === 'h') {
      x.save(); x.globalAlpha = this.dark ? 0.3 : 0.38; x.strokeStyle = st.c; x.lineWidth = st.w * s;
      if (!this.dark) x.globalCompositeOperation = 'multiply';
      x.beginPath(); x.moveTo(q[0], q[1]);
      for (var i = 3; i < q.length; i += 3) x.lineTo(q[i], q[i + 1]);
      if (q.length === 3) x.lineTo(q[0] + 0.01, q[1]);
      x.stroke(); x.restore(); return;
    }
    x.strokeStyle = x.fillStyle = this.col(st.c);
    if (q.length === 3) { x.beginPath(); x.arc(q[0], q[1], Math.max(0.6, st.w * s * (0.35 + q[2]) / 2), 0, 7); x.fill(); return; }
    // variable width: draw smoothed segments using midpoints
    for (var j = 3; j < q.length; j += 3) {
      var x0 = q[j - 3], y0 = q[j - 2], x1 = q[j], y1 = q[j + 1];
      var pr = (q[j - 1] + q[j + 2]) / 2;
      x.lineWidth = Math.max(0.6, st.w * s * (0.35 + 1.1 * pr));
      x.beginPath();
      if (j >= 6) { var mx = (q[j - 6] + x0) / 2, my = (q[j - 5] + y0) / 2; x.moveTo(mx, my); x.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2); }
      else { x.moveTo(x0, y0); x.lineTo((x0 + x1) / 2, (y0 + y1) / 2); }
      if (j === q.length - 3) x.lineTo(x1, y1);
      x.stroke();
    }
  };
  Inked.prototype.snapshot = function () { this.hist.push({ s: this.rec.s.slice(), pad: this.rec.pad }); if (this.hist.length > 60) this.hist.shift(); this.fut = []; };
  Inked.prototype.commit = function () {
    var self = this; clearTimeout(this._sv);
    this._sv = setTimeout(function () { save(self.key, self.rec); }, 350);
    this.mark(); updateBar();
  };
  Inked.prototype.undo = function () { if (!this.hist.length) return; this.fut.push({ s: this.rec.s.slice(), pad: this.rec.pad }); var h = this.hist.pop(); this.rec.s = h.s; this.rec.pad = h.pad; this.layout(); this.commit(); };
  Inked.prototype.redo = function () { if (!this.fut.length) return; this.hist.push({ s: this.rec.s.slice(), pad: this.rec.pad }); var h = this.fut.pop(); this.rec.s = h.s; this.rec.pad = h.pad; this.layout(); this.commit(); };
  Inked.prototype.addSpace = function () { this.snapshot(); this.rec.pad = (this.rec.pad || 0) + PAD_STEP; this.layout(); this.commit(); var self = this; setTimeout(function () { try { self.pad.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }, 30); };
  Inked.prototype.clear = function () { if (!this.rec.s.length && !this.rec.pad) return; this.snapshot(); this.rec.s = []; this.rec.pad = 0; this.layout(); this.commit(); };
  Inked.prototype.local = function (e) { var r = this.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  Inked.prototype.erase = function (px, py) {
    var r = ERASE_R * this.scale, r2 = r * r, hit = false, keep = [];
    for (var i = 0; i < this.rec.s.length; i++) {
      var st = this.rec.s[i], q = this.pts(st), on = false;
      if (q) for (var j = 0; j < q.length; j += 3) { var dx = q[j] - px, dy = q[j + 1] - py; if (dx * dx + dy * dy <= r2 + Math.pow(st.w * this.scale / 2, 2)) { on = true; break; } }
      if (on) hit = true; else keep.push(st);
    }
    if (hit) { if (!this._erSnap) { this.snapshot(); this._erSnap = true; } this.rec.s = keep; this.redraw(); }
  };
  Inked.prototype.bindPointer = function () {
    var self = this, L = this.c2, cur = null, scroll = null;
    function down(e) {
      if (active !== self) return;
      if (e.pointerType === 'pen' && !T.penSeen) { T.penSeen = true; saveTool(); updateBar(); }
      if (e.pointerType === 'touch' && !fingerDraws()) { scroll = { id: e.pointerId, y: e.clientY, x: e.clientX }; return; }
      if (e.button > 0) return;
      e.preventDefault();
      try { L.setPointerCapture(e.pointerId); } catch (x) {}
      self.blocks();
      var p = self.local(e);
      if (T.tool === 'eraser') { cur = { er: true, id: e.pointerId }; self._erSnap = false; self.erase(p[0], p[1]); return; }
      var b = self.blockAt(p[1]), top = self.topOf(b) || 0;
      var hl = T.tool === 'hl';
      cur = { id: e.pointerId, top: top, st: { t: hl ? 'h' : 'p', c: hl ? HL[0] : T.colour, w: hl ? HL_W : PEN_W, b: b, p: [] }, last: null };
      addPt(e);
    }
    function addPt(e) {
      var p = self.local(e), s = self.scale;
      var pr = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
      var ux = Math.round(p[0] / s * 10) / 10, uy = Math.round((p[1] - cur.top) / s * 10) / 10, up = Math.round(pr * 100);
      var P = cur.st.p, n = P.length;
      if (n && Math.abs(P[n - 3] - ux) < 0.4 && Math.abs(P[n - 2] - uy) < 0.4) return;
      P.push(ux, uy, up);
      live();
    }
    function live() {
      var x = self.ctx(L); x.clearRect(0, 0, L.width, L.height);
      // live canvas uses current block top (unchanged during a stroke)
      var st = cur.st, q = [], s = self.scale;
      for (var i = 0; i < st.p.length; i += 3) q.push(st.p[i] * s, cur.top + st.p[i + 1] * s, st.p[i + 2] / 100);
      var saved = self.pts; self.pts = function () { return q; }; self.paint(x, st); self.pts = saved;
    }
    function move(e) {
      if (scroll && e.pointerId === scroll.id) { var dy = scroll.y - e.clientY, dx = scroll.x - e.clientX; scroll.y = e.clientY; scroll.x = e.clientX; G.scrollBy(dx * 0, dy); return; }
      if (!cur || e.pointerId !== cur.id) return;
      e.preventDefault();
      var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
      if (!evs.length) evs = [e];
      if (cur.er) { var p = self.local(evs[evs.length - 1]); self.erase(p[0], p[1]); return; }
      for (var i = 0; i < evs.length; i++) addPt(evs[i]);
    }
    function up(e) {
      if (scroll && e.pointerId === scroll.id) { scroll = null; return; }
      if (!cur || e.pointerId !== cur.id) return;
      if (cur.er) { if (self._erSnap) self.commit(); cur = null; return; }
      if (cur.st.p.length) { self.snapshot(); self.rec.s.push(cur.st); self.paint(self.ctx(self.c1), cur.st); self.commit(); }
      self.ctx(L).clearRect(0, 0, L.width, L.height);
      cur = null;
    }
    L.addEventListener('pointerdown', down);
    L.addEventListener('pointermove', move);
    L.addEventListener('pointerup', up);
    L.addEventListener('pointercancel', up);
    // stop iOS from treating pencil drags as text selection / scroll
    L.addEventListener('touchstart', function (e) { if (active === self && fingerDraws()) e.preventDefault(); }, { passive: false });
  };

  /* ---------- toolbar ---------- */
  function mkBar() {
    bar = doc.createElement('div'); bar.className = 'inkbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Drawing tools');
    var h = '';
    COLOURS.forEach(function (c) { h += '<button type="button" data-k="pen" data-c="' + c[0] + '" title="' + c[1] + ' pen" aria-label="' + c[1] + ' pen"><span class="sw" style="background:' + c[0] + '"></span></button>'; });
    h += '<button type="button" data-k="hl" title="Highlighter" aria-label="Highlighter">' + I.hl.replace('stroke="currentColor"', 'stroke="#c9a400"') + '</button>';
    h += '<button type="button" data-k="eraser" title="Eraser (removes whole strokes)" aria-label="Eraser">' + I.er + '</button>';
    h += '<span class="sep"></span>';
    h += '<button type="button" data-a="undo" title="Undo" aria-label="Undo">' + I.undo + '</button>';
    h += '<button type="button" data-a="redo" title="Redo" aria-label="Redo">' + I.redo + '</button>';
    h += '<button type="button" data-a="pad" title="Add working space below" aria-label="Add working space">' + I.pad + '<span class="lbl">Space</span></button>';
    h += '<button type="button" data-a="clear" title="Clear all ink on this question" aria-label="Clear ink">' + I.clear + '</button>';
    h += '<button type="button" data-a="finger" title="Let your finger draw (otherwise fingers scroll once a Pencil is used)" aria-label="Finger draws">' + I.hand + '<span class="lbl">Finger</span></button>';
    h += '<span class="sep"></span>';
    h += '<button type="button" class="done" data-a="done">Done</button>';
    bar.innerHTML = h;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !active) return;
      var k = b.getAttribute('data-k'), a = b.getAttribute('data-a');
      if (k) { T.tool = k; if (b.getAttribute('data-c')) T.colour = b.getAttribute('data-c'); saveTool(); updateBar(); return; }
      if (a === 'undo') active.undo(); else if (a === 'redo') active.redo();
      else if (a === 'pad') active.addSpace();
      else if (a === 'clear') { if (active.rec.s.length < 4 || G.confirm('Clear all ink on this question?')) active.clear(); }
      else if (a === 'finger') { T.finger = !fingerDraws(); saveTool(); updateBar(); }
      else if (a === 'done') stop();
    });
    doc.body.appendChild(bar);
  }
  function updateBar() {
    if (!bar || !active) return;
    bar.querySelectorAll('[data-k]').forEach(function (b) {
      var k = b.getAttribute('data-k'), on = k === T.tool && (k !== 'pen' || b.getAttribute('data-c') === T.colour);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    bar.querySelector('[data-a="undo"]').disabled = !active.hist.length;
    bar.querySelector('[data-a="redo"]').disabled = !active.fut.length;
    bar.querySelector('[data-a="finger"]').setAttribute('aria-pressed', fingerDraws() ? 'true' : 'false');
  }
  function start(ink) {
    if (active) stop();
    active = ink; ink.el.classList.add('ink-on'); ink.btn.classList.add('on'); ink.btn.setAttribute('aria-pressed', 'true');
    ink.layout();
    if (!bar) mkBar(); bar.hidden = false;
    try { var cc = G.getComputedStyle(ink.el).getPropertyValue('--c').trim(); if (cc) bar.style.setProperty('--c', cc); } catch (e) {}
    updateBar();
    clearInterval(start._t); start._t = setInterval(function () { if (active && !active.el.isConnected) stop(); if (!active) clearInterval(start._t); }, 800);
    doc.addEventListener('keydown', keys);
  }
  function stop() {
    if (!active) return;
    var ink = active; active = null;
    ink.el.classList.remove('ink-on'); ink.btn.classList.remove('on'); ink.btn.setAttribute('aria-pressed', 'false');
    save(ink.key, ink.rec); ink.mark();
    if (bar) bar.hidden = true;
    doc.removeEventListener('keydown', keys);
  }
  function keys(e) {
    if (!active) return;
    if (e.key === 'Escape') { stop(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) active.redo(); else active.undo(); }
  }

  G.SRInk = {
    attach: function (el, key, opts) { injectCSS(); return new Inked(el, key, opts); },
    stop: stop,
    exportAll: all,
    importAll: function (obj) { var ks = Object.keys(obj || {}); return Promise.all(ks.map(function (k) { return obj[k] && obj[k].s ? save(k, obj[k]) : null; })); }
  };
})(window);

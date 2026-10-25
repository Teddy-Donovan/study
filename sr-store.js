/* sr-store.js: shared storage for the Study Resources app (packs, question bank, tracker).
 * Everything sits in localStorage under one key, so pages on the same origin share it
 * (GitHub Pages: every file in the repo is on the same origin).
 *
 *   SR.get(path, dflt)      path like 'tracker.M7.slip'
 *   SR.set(path, value)     writes and saves, then fires 'sr-change'
 *   SR.flags.has(id) / SR.flags.toggle(id, meta) -> bool (true = now flagged) / SR.flags.list()
 *     id:   'pack:M7#card-pq-7-4' | 'qb:mach.im.torque@12345:motor' | 'theory:M7#sec-slip'
 *     meta: {kind:'question'|'theory', title, href, course:'mach'|'dsp'|'edc', pack}
 *   SR.qb.record(typeId, ok)   attempt/correct counts; SR.qb.stats(typeId) -> {att, ok}
 *   SR.qb.mistake(item) / SR.qb.mistakes()   wrong answers from the bank (auto-logged)
 *   SR.exportJSON() -> string · SR.importJSON(str) (merges, newest wins)
 *   --- added by the app shell (existing API above is unchanged) ---
 *   SR.flags.remove(id)
 *   SR.qb.removeMistake(t) (t = item timestamp) · SR.qb.clearMistakes(pred?)
 *   SR.tracker.get(key) -> {s:0..4, note, t} | null · SR.tracker.set(key, patch) · SR.tracker.all()
 *     keys: 'T:mach/im/slip' (topic) · 'S:M7/sec-id' (skill) · 'P:M7' (pack done flag {done:true})
 *     s: 0 Not started · 1 Learning · 2 Not confident · 3 Confident · 4 Exam-ready
 *   SR.cards.get(id) · SR.cards.review(id, grade 0 Again|1 Hard|2 Good|3 Easy) -> state · SR.cards.all()
 *   SR.reset()
 *   window 'sr-change' event (also fires on cross-tab 'storage' updates)
 */
(function (G) {
  'use strict';
  var KEY = 'studyres.v1', mem = null;
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { mem = {}; }
    return mem;
  }
  function save() {
    mem._ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {}
    try { G.dispatchEvent(new CustomEvent('sr-change')); } catch (e) {}
  }
  function walk(path, create) {
    var o = load(), ks = path.split('.');
    for (var i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') { if (!create) return [null]; o[ks[i]] = {}; }
      o = o[ks[i]];
    }
    return [o, ks[ks.length - 1]];
  }
  var SR = G.SR = {
    get: function (path, d) { var w = walk(path, false); if (!w[0]) return d; var v = w[0][w[1]]; return v === undefined ? d : v; },
    set: function (path, v) { var w = walk(path, true); if (v === undefined) delete w[0][w[1]]; else w[0][w[1]] = v; save(); },
    flags: {
      has: function (id) { return !!(load().flags || {})[id]; },
      toggle: function (id, meta) {
        var f = load().flags || (mem.flags = {});
        if (f[id]) { delete f[id]; save(); return false; }
        f[id] = Object.assign({ t: Date.now() }, meta || {}); save(); return true;
      },
      remove: function (id) { var f = load().flags || {}; if (f[id]) { delete f[id]; save(); } },
      list: function () { var f = load().flags || {}; return Object.keys(f).map(function (k) { return Object.assign({ id: k }, f[k]); }).sort(function (a, b) { return b.t - a.t; }); }
    },
    qb: {
      record: function (tid, ok) {
        var s = load().qbstats || (mem.qbstats = {}); var e = s[tid] || (s[tid] = { att: 0, ok: 0 });
        e.att++; if (ok) e.ok++; e.last = Date.now(); save();
      },
      stats: function (tid) { return ((load().qbstats || {})[tid]) || { att: 0, ok: 0 }; },
      mistake: function (item) { var m = load().mistakes || (mem.mistakes = []); m.unshift(Object.assign({ t: Date.now() }, item)); if (m.length > 300) m.length = 300; save(); },
      mistakes: function () { return (load().mistakes || []).slice(); },
      removeMistake: function (t) { var m = load().mistakes || []; mem.mistakes = m.filter(function (x) { return x.t !== t; }); save(); },
      clearMistakes: function (pred) { var m = load().mistakes || []; mem.mistakes = pred ? m.filter(function (x) { return !pred(x); }) : []; save(); }
    },
    tracker: {
      get: function (k) { return ((load().tracker || {})[k]) || null; },
      set: function (k, patch) {
        var tr = load().tracker || (mem.tracker = {}); var e = tr[k] || {};
        if (patch && 's' in patch && patch.s !== e.s) e.t = Date.now();
        Object.assign(e, patch || {}); if (patch && patch.reviewed) { e.t = Date.now(); delete e.reviewed; }
        tr[k] = e; save(); return e;
      },
      all: function () { return load().tracker || {}; }
    },
    cards: {
      get: function (id) { return ((load().cards || {})[id]) || null; },
      all: function () { return load().cards || {}; },
      /* SM-2 style: ef ease, iv interval (days), due (ms). Again re-queues in ~1 min. */
      review: function (id, g) {
        var cs = load().cards || (mem.cards = {}); var c = cs[id] || { ef: 2.5, iv: 0, reps: 0, lapses: 0 };
        var now = Date.now(), DAY = 864e5;
        if (g === 0) { c.reps = 0; c.lapses++; c.iv = 0; c.ef = Math.max(1.3, c.ef - 0.2); c.due = now + 60e3; }
        else {
          if (g === 1) { c.ef = Math.max(1.3, c.ef - 0.15); c.iv = c.reps === 0 ? 0 : Math.max(1, Math.round(c.iv * 1.2)); }
          else if (g === 2) { c.iv = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.iv * c.ef); }
          else { c.ef += 0.15; c.iv = c.reps === 0 ? 3 : Math.round(Math.max(c.iv, 1) * c.ef * 1.3); }
          c.reps++; c.due = c.iv === 0 ? now + 10 * 60e3 : now + c.iv * DAY;
        }
        c.last = now; c.g = g; cs[id] = c; save(); return c;
      }
    },
    reset: function () { mem = {}; save(); },
    exportJSON: function () { return JSON.stringify(load(), null, 1); },
    importJSON: function (str) {
      var inc = JSON.parse(str), cur = load();
      function merge(a, b) { for (var k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else if (!(k in a) || (inc._ts || 0) >= (cur._ts || 0)) a[k] = b[k]; } }
      merge(cur, inc); save();
    }
  };
  G.addEventListener && G.addEventListener('storage', function (e) { if (e.key === KEY) { mem = null; try { G.dispatchEvent(new CustomEvent('sr-change')); } catch (x) {} } });
})(typeof window !== 'undefined' ? window : globalThis);

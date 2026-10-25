/* qb-ui.js — embeddable question-bank UI (global `QBUI`)
 * =============================================================================
 *   QBUI.mount(containerEl, opts)   builds the UI inside containerEl (call once per container)
 *     opts.sr          storage (default window.SR from app/sr-store.js; falls back to localStorage)
 *     opts.embedded    true when hosted inside the app (the host owns routing; we only replaceState)
 *     opts.hashPrefix  default '#qb/'  -> links look like  #qb/<typeId>@<seed>[:variant]
 *     opts.mathjax     MathJax object (default window.MathJax)
 *     opts.packHref    fn(packId) -> URL of the study pack (default 'packs/<id>.html' when embedded)
 *     opts.listenHash  standalone: react to hashchange (default !embedded)
 *   QBUI.open(typeId, seed, variant)   open a question (seed null -> new); returns false if unknown
 *   QBUI.practice(set)                 show a ready-made set [{id, seed, variant}] in the practice view
 *   QBUI.view('bank'|'practice'|'progress')
 *   QBUI.parseHash(str) -> {id, seed, variant} | null ;  QBUI.hashFor(id, seed, variant) -> '#qb/...'
 * Requires qb-core.js (+ qb-sch.js, qb-plot.js and the bank files) loaded first.
 * Storage: SR.qb.record(typeId, ok) on each whole-question check, SR.qb.mistake({...}) when a check has a ✗,
 *          SR.flags.toggle('qb:<id>@<seed>[:variant]', {kind:'question', title, href, course}).
 * =============================================================================
 */
(function (G) {
  'use strict';
  var QB = G.QB;
  var UI = G.QBUI = {};
  var D = G.document;
  var DIFF = ['', 'Easy', 'Exam', 'Hard'];
  var FLAG_PATH = 'M6 3h12v18l-6-4.5L6 21z';
  function flagSVG() { return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="' + FLAG_PATH + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function $(root, sel) { return root.querySelector(sel); }
  function $$(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

  /* ---------------------------------------------------------- storage */
  function fallbackSR() {
    var KEY = 'studyres.v1', mem = null;
    function load() { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { mem = {}; } return mem; }
    function save() { mem._ts = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
    return {
      get: function (k, d) { var v = load()[k]; return v === undefined ? d : v; },
      set: function (k, v) { load()[k] = v; save(); },
      flags: {
        has: function (id) { return !!(load().flags || {})[id]; },
        toggle: function (id, meta) { var f = load().flags || (mem.flags = {}); if (f[id]) { delete f[id]; save(); return false; } f[id] = Object.assign({ t: Date.now() }, meta || {}); save(); return true; },
        list: function () { var f = load().flags || {}; return Object.keys(f).map(function (k) { return Object.assign({ id: k }, f[k]); }); }
      },
      qb: {
        record: function (tid, ok) { var s = load().qbstats || (mem.qbstats = {}); var e = s[tid] || (s[tid] = { att: 0, ok: 0 }); e.att++; if (ok) e.ok++; e.last = Date.now(); save(); },
        stats: function (tid) { return ((load().qbstats || {})[tid]) || { att: 0, ok: 0 }; },
        mistake: function (it) { var m = load().mistakes || (mem.mistakes = []); m.unshift(Object.assign({ t: Date.now() }, it)); if (m.length > 300) m.length = 300; save(); },
        mistakes: function () { return (load().mistakes || []).slice(); }
      }
    };
  }
  var LS = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem('qbui.' + k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('qbui.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------------------------------------------------------- hash */
  var PREFIX = '#qb/';
  UI.hashFor = function (id, seed, variant) { return PREFIX + id + (seed != null ? '@' + seed : '') + (variant ? ':' + variant : ''); };
  UI.parseHash = function (h) {
    if (!h) return null;
    h = decodeURIComponent(String(h)).replace(/^#/, '').replace(/^qb\//, '');
    var m = h.match(/^([A-Za-z0-9_.\-]+)(?:@(\d+))?(?::([A-Za-z0-9_.\-]+))?$/);
    if (!m || !QB.byId[m[1]]) return null;
    return { id: m[1], seed: m[2] != null ? +m[2] : null, variant: m[3] || null };
  };

  /* ---------------------------------------------------------- MathJax */
  var MJ = null;
  function typeset(node) {
    var M = MJ || G.MathJax;
    if (!M || !node) return Promise.resolve();
    if (M.typesetPromise) {
      var p = M.startup && M.startup.promise ? M.startup.promise : Promise.resolve();
      return p.then(function () { try { if (M.typesetClear) M.typesetClear([node]); } catch (e) {} return M.typesetPromise([node]); }).catch(function (e) { if (G.console) console.warn('MathJax', e); });
    }
    // MathJax still loading (config object only): retry when it arrives
    return new Promise(function (res) {
      var n = 0, iv = setInterval(function () { var M2 = G.MathJax; if ((M2 && M2.typesetPromise) || ++n > 100) { clearInterval(iv); typeset(node).then(res); } }, 100);
    });
  }

  /* ---------------------------------------------------------- state */
  var S = { root: null, sr: null, opts: {}, cur: null, view: 'bank', practice: null };
  function course(id) { return QB.courses[id] || { id: id, title: id, colour: '#6b5b8f' }; }
  function topicOf(t) { return QB.getTopic(t.course, t.module, t.topic) || { title: t.topic }; }
  function moduleOf(t) { var c = QB.courses[t.course]; return (c && c.modules[t.module]) || { title: t.module }; }
  function stats(id) { try { return S.sr.qb.stats(id) || { att: 0, ok: 0 }; } catch (e) { return { att: 0, ok: 0 }; } }
  function dots(n) { var s = '<span class="qbui-dots" title="' + DIFF[n || 2] + '" aria-label="Difficulty: ' + DIFF[n || 2] + '">'; for (var i = 1; i <= 3; i++) s += '<i class="' + (i <= (n || 2) ? 'on' : '') + '"></i>'; return s + '</span>'; }
  function cssCourse(cid) { return 'qbui-c-' + cid; }

  /* ---------------------------------------------------------- mount */
  UI.mount = function (container, opts) {
    opts = opts || {};
    S.opts = opts; S.sr = opts.sr || G.SR || fallbackSR(); MJ = opts.mathjax || null;
    PREFIX = opts.hashPrefix || '#qb/';
    if (opts.packHref) S.packHref = opts.packHref; else if (opts.embedded) S.packHref = function (p) { return 'packs/' + p + '.html'; };
    var root = el('div', 'qbui' + (opts.embedded ? ' qbui-embedded' : ''));
    root.innerHTML =
      '<div class="qbui-bar">' +
        '<button type="button" class="qbui-btn qbui-drawer-btn" aria-expanded="false" aria-controls="qbui-side"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>Topics</span></button>' +
        '<div class="qbui-tabs" role="tablist">' +
          '<button type="button" role="tab" data-view="bank" aria-selected="true">Questions</button>' +
          '<button type="button" role="tab" data-view="practice" aria-selected="false">Practice set</button>' +
          '<button type="button" role="tab" data-view="progress" aria-selected="false">Progress</button>' +
        '</div>' +
      '</div>' +
      '<div class="qbui-body">' +
        '<aside class="qbui-side" id="qbui-side" aria-label="Question types">' +
          '<div class="qbui-side-head"><input type="search" class="qbui-search" placeholder="Search question types" aria-label="Search question types" autocomplete="off" spellcheck="false"><button type="button" class="qbui-x qbui-drawer-close" aria-label="Close topics">×</button></div>' +
          '<div class="qbui-count" aria-live="polite"></div>' +
          '<div class="qbui-tree"></div>' +
        '</aside>' +
        '<div class="qbui-scrim" hidden></div>' +
        '<section class="qbui-main" aria-live="polite"></section>' +
      '</div>';
    container.innerHTML = ''; container.appendChild(root);
    S.root = root;
    // events
    $$(root, '.qbui-tabs [data-view]').forEach(function (b) { b.addEventListener('click', function () { UI.view(b.getAttribute('data-view')); }); });
    $(root, '.qbui-drawer-btn').addEventListener('click', function () { drawer(true); });
    $(root, '.qbui-drawer-close').addEventListener('click', function () { drawer(false); });
    $(root, '.qbui-scrim').addEventListener('click', function () { drawer(false); });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('drawer-open')) drawer(false); });
    var sb = $(root, '.qbui-search');
    sb.addEventListener('input', function () { clearTimeout(S._st); S._st = setTimeout(function () { renderTree(sb.value); }, 120); });
    renderTree('');
    var listen = opts.listenHash != null ? opts.listenHash : !opts.embedded;
    if (listen) {
      G.addEventListener('hashchange', function () {
        var w = UI.parseHash(location.hash); if (!w) return;
        if (S.cur && location.hash === UI.hashFor(S.cur.typeId, S.cur.seed, S.cur.variant)) return;
        UI.open(w.id, w.seed, w.variant);
      });
    }
    G.addEventListener('sr-change', function () { clearTimeout(S._rt); S._rt = setTimeout(refreshBadges, 250); });
    // tap a figure to see it full size
    $(root, '.qbui-main').addEventListener('click', function (e) { var f = e.target.closest('.qbui-fig'); if (f && f.querySelector('svg')) zoom(f.querySelector('svg')); });
    var w0 = listen ? UI.parseHash(location.hash) : null;
    if (w0) UI.open(w0.id, w0.seed, w0.variant); else renderHome();
    return UI;
  };
  function zoom(svg) {
    var z = el('div', 'qbui-zoom');
    z.setAttribute('role', 'dialog'); z.setAttribute('aria-modal', 'true'); z.setAttribute('aria-label', 'Figure, full size');
    var vb = (svg.getAttribute('viewBox') || '0 0 400 300').split(/\s+/).map(Number);
    var w = Math.max(+svg.getAttribute('width') || vb[2], Math.min(G.innerWidth - 40, vb[2] * 1.8));
    z.innerHTML = '<div class="qbui-zoom-in"></div><button type="button" class="qbui-zoom-x" aria-label="Close">×</button>';
    var c = svg.cloneNode(true); c.setAttribute('width', Math.round(w)); c.setAttribute('height', Math.round(w * vb[3] / vb[2])); c.style.maxWidth = 'none';
    z.firstChild.appendChild(c);
    function close() { z.remove(); D.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    z.addEventListener('click', function (e) { if (e.target === z || e.target.classList.contains('qbui-zoom-x')) close(); });
    D.addEventListener('keydown', key);
    D.body.appendChild(z); $(z, '.qbui-zoom-x').focus();
  }
  function drawer(open) {
    var r = S.root; if (!r) return;
    r.classList.toggle('drawer-open', !!open);
    $(r, '.qbui-scrim').hidden = !open;
    $(r, '.qbui-drawer-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(function () { var s = $(r, '.qbui-search'); if (s) s.focus(); }, 50);
  }
  UI.view = function (v) {
    S.view = v;
    $$(S.root, '.qbui-tabs [data-view]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-view') === v ? 'true' : 'false'); });
    S.root.setAttribute('data-view', v);
    if (v === 'practice') renderPractice();
    else if (v === 'progress') renderProgress();
    else if (S.cur) renderQuestion(); else renderHome();
  };

  /* ---------------------------------------------------------- sidebar tree */
  function matches(t, q) {
    if (!q) return true;
    var tp = topicOf(t), hay = (t.title + ' ' + (t.tags || []).join(' ') + ' ' + t.id + ' ' + tp.title + ' ' + course(t.course).title + ' ' + (t.variants || []).map(function (v) { return v.label; }).join(' ')).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function renderTree(q) {
    var tree = $(S.root, '.qbui-tree'), open = LS.get('open', {}), h = '', total = 0;
    QB.tree().forEach(function (C) {
      var c = C.course, ch = '', ccount = 0;
      C.modules.forEach(function (M) {
        var mh = '', mcount = 0;
        M.topics.forEach(function (T) {
          var types = T.types.filter(function (t) { return matches(t, q); });
          if (q && !types.length) return;
          if (!T.types.length && !q) { mh += '<div class="qbui-topic empty"><span class="qbui-tt">' + esc(T.title) + '</span><span class="qbui-n">soon</span></div>'; return; }
          mcount += types.length;
          var key = T.key, isOpen = q ? true : !!open[key];
          mh += '<details class="qbui-topic" data-key="' + esc(key) + '"' + (isOpen ? ' open' : '') + '><summary><span class="qbui-tt">' + esc(T.title) + '</span><span class="qbui-n">' + types.length + '</span></summary><div class="qbui-cards">' +
            types.map(cardHTML).join('') + '</div></details>';
        });
        if (q && !mcount) return;
        ccount += mcount;
        var mk = c.id + '.' + M.module.id, mOpen = q ? true : open[mk] !== false && (open[mk] || false);
        ch += '<details class="qbui-mod" data-key="' + esc(mk) + '"' + (mOpen ? ' open' : '') + '><summary><span>' + esc(M.module.title) + '</span><span class="qbui-n">' + mcount + '</span></summary>' + mh + '</details>';
      });
      if (q && !ccount) return;
      total += ccount;
      var cOpen = q ? true : open[c.id] !== false;
      h += '<details class="qbui-course ' + cssCourse(c.id) + '" data-key="' + esc(c.id) + '"' + (cOpen ? ' open' : '') + '><summary><i class="qbui-chip"></i><span><b>' + esc(c.short || c.title) + '</b><small>' + esc(c.code || '') + '</small></span><span class="qbui-n">' + ccount + '</span></summary>' + ch + '</details>';
    });
    tree.innerHTML = h || '<p class="qbui-none">No question types match “' + esc(q) + '”.</p>';
    $(S.root, '.qbui-count').textContent = q ? total + ' match' + (total === 1 ? '' : 'es') : QB.types.length + ' question types';
    $$(tree, 'details').forEach(function (d) {
      d.addEventListener('toggle', function () { if ($(S.root, '.qbui-search').value) return; var o = LS.get('open', {}); o[d.getAttribute('data-key')] = d.open; LS.set('open', o); });
    });
    $$(tree, '.qbui-card').forEach(function (cd) {
      var id = cd.getAttribute('data-id');
      cd.addEventListener('click', function (e) {
        if (e.target.closest('select')) return;
        var sel = $(cd, 'select'); UI.open(id, null, sel && sel.value ? sel.value : null); drawer(false);
      });
      cd.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === cd) { e.preventDefault(); cd.click(); } });
    });
    markActive();
  }
  function cardHTML(t) {
    var st = stats(t.id);
    var vs = t.variants && t.variants.length ? '<select class="qbui-vsel" aria-label="Variant for ' + esc(t.title) + '"><option value="">Random variant</option>' + t.variants.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.label) + '</option>'; }).join('') + '</select>' : '';
    return '<div class="qbui-card" role="button" tabindex="0" data-id="' + esc(t.id) + '"><span class="qbui-ct">' + esc(t.title) + '</span><span class="qbui-meta">' + dots(t.difficulty) + (t.marks ? '<span>' + t.marks + ' marks</span>' : '') +
      '<span class="qbui-prog" data-prog="' + esc(t.id) + '">' + (st.att ? st.ok + '/' + st.att : '') + '</span></span>' + vs + '</div>';
  }
  function markActive() {
    $$(S.root, '.qbui-card').forEach(function (c) { var on = S.cur && c.getAttribute('data-id') === S.cur.typeId; c.classList.toggle('on', !!on); if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
  }
  function refreshBadges() {
    $$(S.root, '[data-prog]').forEach(function (e) { var s = stats(e.getAttribute('data-prog')); e.textContent = s.att ? s.ok + '/' + s.att : ''; });
    if (S.view === 'progress') renderProgress();
    var fb = S.root && $(S.root, '.qbui-flag'); if (fb && S.cur) setFlagState(fb, S.sr.flags.has(flagId(S.cur)));
  }

  /* ---------------------------------------------------------- home */
  function renderHome() {
    var main = $(S.root, '.qbui-main');
    S.root.setAttribute('data-view', 'bank');
    var h = '<div class="qbui-home"><h2>Question bank</h2><p class="qbui-lede">Every question type regenerates with fresh numbers and, where it can, a different circuit or variant. Type your answers (SI prefixes like <code>2.3m</code>, <code>4k7</code> or <code>1.2e-3</code> work), press Check, then open the working.</p><div class="qbui-cgrid">';
    QB.tree().forEach(function (C) {
      var n = 0, att = 0, ok = 0, topics = 0;
      C.modules.forEach(function (M) { M.topics.forEach(function (T) { if (T.types.length) topics++; T.types.forEach(function (t) { n++; var s = stats(t.id); att += s.att; ok += s.ok; }); }); });
      h += '<div class="qbui-ccard ' + cssCourse(C.course.id) + '"><b>' + esc(C.course.title) + '</b><span>' + esc(C.course.code || '') + '</span><span class="qbui-big">' + n + '<small> question types · ' + topics + ' topics</small></span><span>' + (att ? ok + ' of ' + att + ' checks correct' : 'Not started') + '</span>' +
        (n ? '<button type="button" class="qbui-btn pri" data-rand="' + esc(C.course.id) + '">Random ' + esc(C.course.short || C.course.title) + ' question</button>' : '') + '</div>';
    });
    h += '</div></div>';
    main.innerHTML = h;
    $$(main, '[data-rand]').forEach(function (b) { b.addEventListener('click', function () { var cid = b.getAttribute('data-rand'); var pool = QB.types.filter(function (t) { return t.course === cid; }); if (pool.length) UI.open(pool[Math.floor(Math.random() * pool.length)].id, null, null); }); });
  }

  /* ---------------------------------------------------------- question */
  function flagId(q) { return 'qb:' + q.typeId + '@' + q.seed + (q.variant ? ':' + q.variant : ''); }
  function setFlagState(b, on) {
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on ? 'Flagged' : 'Flag for review';
    b.setAttribute('aria-label', on ? 'Flagged' : 'Flag for review');
    var p = b.querySelector('path'); if (p) p.setAttribute('fill', on ? 'currentColor' : 'none');
  }
  UI.open = function (id, seed, variant) {
    var t = QB.byId[id];
    if (!t) return false;
    if (seed == null || seed === '') seed = QB.newSeed();
    seed = +seed;
    var q;
    try { q = QB.make(t, seed, variant || null); q.error = null; }
    catch (e) { q = { typeId: t.id, type: t, seed: seed, variant: variant || null, error: e, parts: [] }; }
    q.state = { shown: false, partsChecked: {}, recorded: false, mistakeLogged: false };
    q.pinned = S._pin !== undefined ? S._pin : (variant || null); S._pin = undefined;
    S.cur = q;
    if (S.view !== 'bank') { S.view = 'bank'; $$(S.root, '.qbui-tabs [data-view]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-view') === 'bank' ? 'true' : 'false'); }); S.root.setAttribute('data-view', 'bank'); }
    var hsh = UI.hashFor(t.id, q.seed, q.variant);
    try { if (location.hash !== hsh) history.replaceState(history.state, '', hsh); } catch (e) {}
    // open the topic in the tree so the active card is visible
    var o = LS.get('open', {}); o[t.course] = true; o[t.course + '.' + t.module] = true; o[t.course + '.' + t.module + '.' + t.topic] = true; LS.set('open', o);
    if (!$(S.root, '.qbui-search').value) { var dt = $(S.root, '.qbui-topic[data-key="' + t.course + '.' + t.module + '.' + t.topic + '"]'); if (dt && !dt.open) { renderTree(''); } }
    renderQuestion();
    markActive();
    return true;
  };
  function linkFor(q) { return location.href.split('#')[0] + UI.hashFor(q.typeId, q.seed, q.variant); }
  function partLabel(qtext, i) { return /^\s*(<[^>]+>\s*)*\(?[a-z]\)/i.test(qtext || '') ? '' : '<span class="qbui-plab">(' + String.fromCharCode(97 + i) + ')</span> '; }
  function answerKey(a) { return '<span class="qbui-key">' + a.label + ' = <b>' + esc(QB.answerText(a)) + '</b></span>'; }
  function qBodyHTML(q, mode, num) {
    // mode: 'live' (inputs) | 'q' (print, questions) | 'a' (print, answers)
    var h = '';
    if (q.stem) h += '<div class="qbui-stem">' + q.stem + '</div>';
    if (q.figure && mode !== 'a') h += '<figure class="qbui-fig">' + q.figure + '</figure>';
    if (q.given && q.given.length && mode !== 'a') h += '<div class="qbui-given"><table><tbody>' + q.given.map(function (g) { return '<tr><th>' + g[0] + '</th><td>' + g[1] + '</td></tr>'; }).join('') + '</tbody></table></div>';
    (q.parts || []).forEach(function (p, i) {
      h += '<div class="qbui-part" data-i="' + i + '">';
      h += '<div class="qbui-pq">' + partLabel(p.q, i) + (p.q || '') + (p.marks ? ' <span class="qbui-pm">[' + p.marks + ']</span>' : '') + '</div>';
      if (mode === 'live' && p.answers.length) {
        h += '<div class="qbui-ans">' + p.answers.map(function (a, j) {
          var idd = 'qa-' + q.seed + '-' + i + '-' + j;
          return '<div class="qbui-arow" data-j="' + j + '"><label for="' + idd + '">' + a.label + '</label><span class="qbui-inwrap"><input id="' + idd + '" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-describedby="' + idd + '-r"><span class="qbui-unit">' + esc(a.unit === 'rad' ? 'rad' : a.unit || '') + '</span></span><span class="qbui-res" id="' + idd + '-r" aria-live="polite"></span>' + (a.hint ? '<small class="qbui-hint">' + a.hint + '</small>' : '') + '<span class="qbui-reveal" hidden>' + answerKey(a) + '</span></div>';
        }).join('') + '</div>';
        h += '<div class="qbui-pact"><button type="button" class="qbui-btn pri" data-check="' + i + '">Check</button><button type="button" class="qbui-btn" data-work="' + i + '" aria-expanded="false">Show working</button></div>';
      } else if (mode === 'live') {
        h += '<div class="qbui-pact"><button type="button" class="qbui-btn" data-work="' + i + '" aria-expanded="false">Show working</button></div>';
      } else if (mode === 'q' && p.answers.length) {
        h += '<div class="qbui-blanks">' + p.answers.map(function (a) { return '<span>' + a.label + ' = <i></i> ' + esc(a.unit || '') + '</span>'; }).join('') + '</div>';
      }
      if (mode === 'live') h += '<div class="qbui-work" hidden><div class="qbui-wk-key">' + (p.answers.length ? '<b>Answer' + (p.answers.length > 1 ? 's' : '') + ':</b> ' + p.answers.map(answerKey).join(' · ') : '') + '</div>' + (p.working || '') + '</div>';
      if (mode === 'a') h += '<div class="qbui-work">' + (p.answers.length ? '<div class="qbui-wk-key"><b>Answer' + (p.answers.length > 1 ? 's' : '') + ':</b> ' + p.answers.map(answerKey).join(' · ') + '</div>' : '') + (p.working || '') + '</div>';
      h += '</div>';
    });
    if (q.notes && mode !== 'q') h += '<div class="qbui-notes"' + (mode === 'live' ? ' hidden' : '') + '>' + q.notes + '</div>';
    return h;
  }
  function renderQuestion() {
    var q = S.cur, main = $(S.root, '.qbui-main'), t = q.type, c = course(t.course), tp = topicOf(t), md = moduleOf(t);
    S.root.setAttribute('data-view', 'bank');
    var vsel = t.variants && t.variants.length ? '<label class="qbui-vlab"><span>Variant</span><select class="qbui-variant"><option value="">Random</option>' + t.variants.map(function (v) { return '<option value="' + esc(v.id) + '"' + (q.pinned === v.id ? ' selected' : '') + '>' + esc(v.label) + '</option>'; }).join('') + '</select></label>' : '';
    var vlabel = q.variant ? (t.variants.filter(function (v) { return v.id === q.variant; })[0] || {}).label : null;
    var packs = String(tp.pack || '').split(',').filter(Boolean);
    var packH = packs.length ? '<span class="qbui-packs">Reread: ' + packs.map(function (p) { return S.packHref ? '<a href="' + esc(S.packHref(p)) + '">' + esc(p) + '</a>' : '<span>' + esc(p) + '</span>'; }).join(', ') + '</span>' : '';
    var h = '<article class="qbui-q ' + cssCourse(t.course) + '">' +
      '<header class="qbui-qhead">' +
        '<nav class="qbui-crumb" aria-label="Breadcrumb"><span>' + esc(c.short || c.title) + '</span><span>' + esc(md.title) + '</span><span>' + esc(tp.title) + '</span></nav>' +
        '<h2>' + esc(t.title) + '</h2>' +
        '<div class="qbui-qmeta">' + dots(t.difficulty) + '<span>' + DIFF[t.difficulty] + '</span>' + (t.marks ? '<span>' + t.marks + ' marks</span>' : '') + (vlabel ? '<span class="qbui-vtag">' + esc(vlabel) + '</span>' : '') + '<span class="qbui-seed">seed ' + q.seed + '</span>' + packH + '</div>' +
        '<div class="qbui-ctl">' + vsel +
          '<button type="button" class="qbui-btn pri" data-act="new">New question</button>' +
          '<button type="button" class="qbui-btn" data-act="solution" aria-pressed="false">Same numbers, show solution</button>' +
          '<button type="button" class="qbui-btn" data-act="allwork" aria-pressed="false">Show all working</button>' +
          '<button type="button" class="qbui-btn" data-act="copy">Copy link</button>' +
        '</div>' +
      '</header>' +
      '<div class="qbui-card-q">' +
        '<button type="button" class="qbui-flag" aria-pressed="false" title="Flag for review" aria-label="Flag for review">' + flagSVG() + '</button>' +
        (q.error ? '<div class="qbui-err"><b>This instance could not be generated.</b> <code>' + esc(q.error.message) + '</code> Press New question to try another seed.</div>' : qBodyHTML(q, 'live')) +
        (q.error ? '' : '<div class="qbui-qfoot"><button type="button" class="qbui-btn pri" data-act="checkall">Check all</button><span class="qbui-score" aria-live="polite"></span></div>') +
      '</div>' +
    '</article>';
    main.innerHTML = h;
    var card = $(main, '.qbui-card-q');
    // flag
    var fb = $(main, '.qbui-flag');
    setFlagState(fb, S.sr.flags.has(flagId(q)));
    fb.addEventListener('click', function () {
      var on = S.sr.flags.toggle(flagId(q), { kind: 'question', title: t.title, href: UI.hashFor(q.typeId, q.seed, q.variant), course: t.course });
      setFlagState(fb, on);
    });
    // controls
    var vs = $(main, '.qbui-variant');
    if (vs) { vs.value = q.pinned || ''; vs.addEventListener('change', function () { var v = vs.value || null; S._pin = v; UI.open(t.id, null, v); }); }
    $(main, '[data-act="new"]').addEventListener('click', function () { var v = vs ? vs.value || null : null; S._pin = v; UI.open(t.id, null, v); });
    $(main, '[data-act="solution"]').addEventListener('click', function (e) { showSolution(!q.state.shown); });
    $(main, '[data-act="allwork"]').addEventListener('click', function (e) {
      var b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true';
      $$(card, '[data-work]').forEach(function (wb) { toggleWork(+wb.getAttribute('data-work'), on); });
      b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? 'Hide all working' : 'Show all working';
    });
    $(main, '[data-act="copy"]').addEventListener('click', function (e) { copyText(linkFor(q), e.currentTarget); });
    if (!q.error) {
      $$(card, '[data-check]').forEach(function (b) { b.addEventListener('click', function () { checkPart(+b.getAttribute('data-check'), true); }); });
      $$(card, '[data-work]').forEach(function (b) { b.addEventListener('click', function () { toggleWork(+b.getAttribute('data-work')); }); });
      $$(card, '.qbui-part input').forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var pi = +inp.closest('.qbui-part').getAttribute('data-i'); checkPart(pi, true); } }); inp.addEventListener('input', function () { var row = inp.closest('.qbui-arow'); row.classList.remove('ok', 'bad'); $(row, '.qbui-res').textContent = ''; }); });
      $(main, '[data-act="checkall"]').addEventListener('click', checkAll);
    }
    typeset(main);
  }
  function showSolution(on) {
    var q = S.cur, main = $(S.root, '.qbui-main'), card = $(main, '.qbui-card-q');
    q.state.shown = on;
    $$(card, '.qbui-reveal').forEach(function (r) { r.hidden = !on; });
    $$(card, '[data-work]').forEach(function (wb) { toggleWork(+wb.getAttribute('data-work'), on); });
    var n = $(card, '.qbui-notes'); if (n) n.hidden = !on;
    var b = $(main, '[data-act="solution"]'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? 'Hide solution' : 'Same numbers, show solution';
    var aw = $(main, '[data-act="allwork"]'); aw.setAttribute('aria-pressed', on ? 'true' : 'false'); aw.textContent = on ? 'Hide all working' : 'Show all working';
  }
  function toggleWork(i, force) {
    var card = $(S.root, '.qbui-card-q'), part = $(card, '.qbui-part[data-i="' + i + '"]'); if (!part) return;
    var w = $(part, '.qbui-work'), b = $(part, '[data-work]');
    var on = force != null ? force : w.hidden;
    w.hidden = !on;
    if (b) { b.setAttribute('aria-expanded', on ? 'true' : 'false'); b.textContent = on ? 'Hide working' : 'Show working'; }
    if (on && S.cur.notes && i === S.cur.parts.length - 1) { var n = $(card, '.qbui-notes'); if (n) n.hidden = false; }
  }
  /** check one part; returns {n, ok, blank} */
  function checkPart(i, userAction) {
    var q = S.cur, card = $(S.root, '.qbui-card-q'), part = $(card, '.qbui-part[data-i="' + i + '"]'), p = q.parts[i];
    var res = { n: 0, ok: 0, blank: 0 };
    if (!part || !p) return res;
    p.answers.forEach(function (a, j) {
      var row = $(part, '.qbui-arow[data-j="' + j + '"]'), inp = $(row, 'input'), out = $(row, '.qbui-res');
      res.n++;
      var txt = inp.value.trim();
      row.classList.remove('ok', 'bad');
      if (!txt) { res.blank++; out.innerHTML = '<span class="qbui-blank">—</span>'; inp.setAttribute('aria-invalid', 'false'); return; }
      var r = QB.checkAnswer(a, txt);
      if (r.ok) { res.ok++; row.classList.add('ok'); out.innerHTML = '<span aria-label="correct">✓</span>'; inp.setAttribute('aria-invalid', 'false'); }
      else { row.classList.add('bad'); out.innerHTML = '<span aria-label="incorrect">✗</span>' + (r.msg ? '<small>' + esc(r.msg) + '</small>' : (isFinite(r.val) ? '<small>read as ' + esc(QB.fmt.eng(r.val, a.unit === 'rad' ? '' : a.unit, 4)) + '</small>' : '')); inp.setAttribute('aria-invalid', 'true'); }
    });
    if (userAction) {
      q.state.partsChecked[i] = res;
      if (res.n - res.blank > res.ok) logMistake();
      // whole question completed through per-part checks: record once
      var withAns = q.parts.map(function (pp, k) { return pp.answers.length ? k : -1; }).filter(function (k) { return k >= 0; });
      if (!q.state.recorded && withAns.every(function (k) { var c = q.state.partsChecked[k]; return c && c.blank === 0; })) {
        var allOk = withAns.every(function (k) { var c = q.state.partsChecked[k]; return c.ok === c.n; });
        record(allOk);
      }
    }
    return res;
  }
  function record(ok) { var q = S.cur; q.state.recorded = true; try { S.sr.qb.record(q.typeId, !!ok); } catch (e) {} refreshBadges(); }
  function logMistake() {
    var q = S.cur; if (q.state.mistakeLogged) return; q.state.mistakeLogged = true;
    try { S.sr.qb.mistake({ typeId: q.typeId, seed: q.seed, variant: q.variant, title: q.type.title, course: q.type.course, href: UI.hashFor(q.typeId, q.seed, q.variant) }); } catch (e) {}
  }
  function checkAll() {
    var q = S.cur, tot = { n: 0, ok: 0, blank: 0 };
    q.parts.forEach(function (p, i) { var r = checkPart(i, false); q.state.partsChecked[i] = r; tot.n += r.n; tot.ok += r.ok; tot.blank += r.blank; });
    var sc = $(S.root, '.qbui-score');
    if (!tot.n) { sc.textContent = 'This question has no answer boxes; compare with the working.'; return; }
    sc.innerHTML = '<b>' + tot.ok + ' / ' + tot.n + '</b> correct' + (tot.blank ? ' · ' + tot.blank + ' blank' : '');
    sc.className = 'qbui-score ' + (tot.ok === tot.n ? 'all' : tot.ok ? 'some' : 'none');
    if (tot.ok < tot.n) logMistake();
    record(tot.ok === tot.n);
  }
  function copyText(s, btn) {
    function done(ok) { var t0 = btn.textContent; btn.textContent = ok ? 'Link copied' : 'Copy failed'; setTimeout(function () { btn.textContent = t0; }, 1600); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(s).then(function () { done(true); }, function () { done(legacy()); }); return; }
    } catch (e) {}
    done(legacy());
    function legacy() { try { var ta = D.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; D.body.appendChild(ta); ta.select(); var ok = D.execCommand('copy'); D.body.removeChild(ta); return ok; } catch (e) { return false; } }
  }

  /* ---------------------------------------------------------- practice set */
  function renderPractice() {
    var main = $(S.root, '.qbui-main'), sel = LS.get('psel', {}), n = LS.get('pn', 6);
    var h = '<div class="qbui-practice"><h2>Practice set</h2><p class="qbui-lede">Pick topics, choose how many questions, and build a sheet: questions in one section, answers and working in the other.</p>' +
      '<div class="qbui-pbuild"><div class="qbui-ptopics">';
    QB.tree().forEach(function (C) {
      var any = false, ch = '';
      C.modules.forEach(function (M) { M.topics.forEach(function (T) { if (!T.types.length) return; any = true; ch += '<label class="qbui-chk"><input type="checkbox" value="' + esc(T.key) + '"' + (sel[T.key] ? ' checked' : '') + '><span>' + esc(T.title) + '</span><small>' + T.types.length + '</small></label>'; }); });
      if (!any) return;
      h += '<fieldset class="qbui-pc ' + cssCourse(C.course.id) + '"><legend><i class="qbui-chip"></i>' + esc(C.course.short || C.course.title) + ' <button type="button" class="qbui-link" data-all="' + esc(C.course.id) + '">all</button> <button type="button" class="qbui-link" data-none="' + esc(C.course.id) + '">none</button></legend>' + ch + '</fieldset>';
    });
    h += '</div><div class="qbui-prow"><label>Questions <input type="number" class="qbui-pn" min="1" max="40" value="' + n + '"></label><button type="button" class="qbui-btn pri" data-act="build">Build set</button><span class="qbui-pmsg" aria-live="polite"></span></div></div>' +
      '<div class="qbui-sheetwrap"></div></div>';
    main.innerHTML = h;
    function saveSel() { var o = {}; $$(main, '.qbui-ptopics input:checked').forEach(function (c) { o[c.value] = 1; }); LS.set('psel', o); }
    $$(main, '.qbui-ptopics input').forEach(function (c) { c.addEventListener('change', saveSel); });
    $$(main, '[data-all],[data-none]').forEach(function (b) { b.addEventListener('click', function () { var all = b.hasAttribute('data-all'); $$(b.closest('fieldset'), 'input').forEach(function (c) { c.checked = all; }); saveSel(); }); });
    $(main, '[data-act="build"]').addEventListener('click', function () {
      var keys = $$(main, '.qbui-ptopics input:checked').map(function (c) { return c.value; });
      var N = Math.max(1, Math.min(40, +$(main, '.qbui-pn').value || 6)); LS.set('pn', N);
      var pool = QB.types.filter(function (t) { return keys.indexOf(t.course + '.' + t.module + '.' + t.topic) >= 0; });
      if (!pool.length) { $(main, '.qbui-pmsg').textContent = 'Tick at least one topic that has question types.'; return; }
      $(main, '.qbui-pmsg').textContent = '';
      var set = [], bag = [];
      for (var i = 0; i < N; i++) { if (!bag.length) bag = shuffle(pool.slice()); var t = bag.pop(); set.push({ id: t.id, seed: QB.newSeed(), variant: null }); }
      S.practice = set; renderSheet();
    });
    if (S.practice) renderSheet();
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  UI.practice = function (set) {
    S.practice = (set || []).filter(function (x) { return x && QB.byId[x.id]; }).map(function (x) { return { id: x.id, seed: x.seed != null ? +x.seed : QB.newSeed(), variant: x.variant || null }; });
    if (S.root) UI.view('practice');
  };
  function setQs() {
    return (S.practice || []).map(function (x) { try { return QB.make(x.id, x.seed, x.variant); } catch (e) { return null; } }).filter(Boolean);
  }
  function sheetHTML(qs, which) {
    var marks = qs.reduce(function (s, q) { return s + (q.type.marks || 0); }, 0);
    var head = '<header class="qbui-shead"><h2>Practice set</h2><p>' + qs.length + ' questions' + (marks ? ' · about ' + marks + ' marks' : '') + ' · ' + new Date().toLocaleDateString() + '</p></header>';
    var Qs = '<section class="qbui-sheet-q"><h3>Section A · Questions</h3>' + qs.map(function (q, i) {
      return '<div class="qbui-sq ' + cssCourse(q.type.course) + '"><h4><span>Q' + (i + 1) + '</span> ' + esc(q.type.title) + (q.type.marks ? ' <small>[' + q.type.marks + ' marks]</small>' : '') + '</h4>' + qBodyHTML(q, 'q') + '</div>';
    }).join('') + '</section>';
    var As = '<section class="qbui-sheet-a"><h3>Section B · Answers and working</h3>' + qs.map(function (q, i) {
      return '<div class="qbui-sq ' + cssCourse(q.type.course) + '"><h4><span>Q' + (i + 1) + '</span> ' + esc(q.type.title) + ' <small><a href="' + esc(UI.hashFor(q.typeId, q.seed, q.variant)) + '">open</a></small></h4>' + qBodyHTML(q, 'a') + '</div>';
    }).join('') + '</section>';
    return head + (which === 'a' ? As : which === 'q' ? Qs : Qs + As);
  }
  function renderSheet() {
    var main = $(S.root, '.qbui-main'), wrap = $(main, '.qbui-sheetwrap'); if (!wrap) return;
    var qs = setQs();
    wrap.innerHTML = '<div class="qbui-sheet-act"><button type="button" class="qbui-btn" data-print="q">Print questions only</button><button type="button" class="qbui-btn" data-print="a">Print answers only</button><button type="button" class="qbui-btn" data-act="openprint">Open printable view</button><a class="qbui-btn" data-act="dl" download="practice-set.html">Download .html</a><button type="button" class="qbui-btn" data-act="reroll">New numbers</button></div>' +
      '<div class="qbui-sheet">' + sheetHTML(qs) + '</div>';
    $$(wrap, '[data-print]').forEach(function (b) { b.addEventListener('click', function () { printSheet(b.getAttribute('data-print')); }); });
    var html = printableDoc(qs);
    var dl = $(wrap, '[data-act="dl"]');
    try { dl.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); } catch (e) { dl.hidden = true; }
    $(wrap, '[data-act="openprint"]').addEventListener('click', function () {
      var w = null; try { w = G.open(dl.href, '_blank'); } catch (e) {}
      if (!w) { var m = $(main, '.qbui-pmsg'); if (m) m.textContent = 'Pop-ups are blocked here: use Download .html and open the file in your browser to print.'; }
    });
    $(wrap, '[data-act="reroll"]').addEventListener('click', function () { S.practice = S.practice.map(function (x) { return { id: x.id, seed: QB.newSeed(), variant: x.variant }; }); renderSheet(); });
    $$(wrap, '.qbui-sheet-a a[href^="#"]').forEach(function (a) { a.addEventListener('click', function (e) { var w = UI.parseHash(a.getAttribute('href')); if (w) { e.preventDefault(); UI.open(w.id, w.seed, w.variant); } }); });
    typeset(wrap);
  }
  function printSheet(which) {
    var cls = which === 'a' ? 'qbui-print-a' : 'qbui-print-q';
    D.body.classList.add(cls);
    var done = function () { D.body.classList.remove(cls); G.removeEventListener('afterprint', done); };
    G.addEventListener('afterprint', done);
    try { G.print(); } catch (e) {}
    setTimeout(done, 1500);
  }
  function printableDoc(qs) {
    var css = 'body{font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:780px;margin:24px auto;padding:0 16px}h2,h3,h4{font-family:Archivo,"Arial Narrow",sans-serif}h3{border-bottom:2px solid #111;padding-bottom:4px;margin-top:28px}h4{margin:18px 0 6px}h4 span{display:inline-block;min-width:2.2em}' +
      '.qbui-sq{break-inside:avoid;page-break-inside:avoid;margin-bottom:18px}.qbui-fig{margin:10px 0;text-align:center}.qbui-fig svg{max-width:100%;height:auto}.qbui-given table{border-collapse:collapse;margin:8px 0}.qbui-given th,.qbui-given td{border:1px solid #bbb;padding:3px 8px;text-align:left;font-weight:normal}' +
      '.qbui-blanks{display:flex;flex-wrap:wrap;gap:6px 22px;margin:6px 0 10px}.qbui-blanks i{display:inline-block;width:110px;border-bottom:1px solid #555}.qbui-work{background:#f6f7f9;border-left:3px solid #555;padding:6px 12px;margin:6px 0}.qbui-key{margin-right:14px}' +
      '.qb-callout{border-left:3px solid #b4531a;background:#fdf1e8;padding:4px 10px;margin:8px 0}.qbui-sheet-a{break-before:page;page-break-before:always}.tools{margin:12px 0}.tools button{font:inherit;padding:6px 12px;margin-right:8px}' +
      'body.only-q .qbui-sheet-a,body.only-a .qbui-sheet-q{display:none}body.only-a .qbui-sheet-a{break-before:auto}@media print{.tools{display:none}}a{color:inherit}';
    var mj = '<script>window.MathJax={tex:{inlineMath:[["$","$"],["\\\\(","\\\\)"]],displayMath:[["$$","$$"],["\\\\[","\\\\]"]],processEscapes:true},svg:{fontCache:"local"}};<\/script><script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg-full.js" async><\/script>';
    var tools = '<div class="tools"><button onclick="document.body.className=\'only-q\';print()">Print questions</button><button onclick="document.body.className=\'only-a\';print()">Print answers</button><button onclick="document.body.className=\'\';print()">Print both</button></div>';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Practice set</title><style>' + css + '</style>' + mj + '</head><body>' + tools + sheetHTML(qs).replace(/<a href="#[^"]*">open<\/a>/g, '') + '</body></html>';
  }

  /* ---------------------------------------------------------- progress */
  function renderProgress() {
    var main = $(S.root, '.qbui-main');
    var h = '<div class="qbui-progress"><h2>Progress</h2><p class="qbui-lede">Counts are whole-question checks: a check is correct when every box is right.</p>';
    var tot = { att: 0, ok: 0, types: 0, tried: 0 };
    var body = '';
    QB.tree().forEach(function (C) {
      var rows = '', ca = 0, co = 0;
      C.modules.forEach(function (M) {
        M.topics.forEach(function (T) {
          if (!T.types.length) return;
          rows += '<tr class="qbui-trow"><th colspan="4">' + esc(T.title) + '</th></tr>';
          T.types.forEach(function (t) {
            var s = stats(t.id); tot.types++; if (s.att) tot.tried++; tot.att += s.att; tot.ok += s.ok; ca += s.att; co += s.ok;
            var pc = s.att ? Math.round(100 * s.ok / s.att) : 0;
            rows += '<tr><td><a href="' + esc(UI.hashFor(t.id)) + '" data-open="' + esc(t.id) + '">' + esc(t.title) + '</a></td><td class="n">' + (s.att || '–') + '</td><td class="n">' + (s.att ? s.ok : '–') + '</td><td><span class="qbui-bar2" role="img" aria-label="' + pc + '% correct"><i style="width:' + pc + '%"></i></span>' + (s.att ? '<small>' + pc + '%</small>' : '') + '</td></tr>';
          });
        });
      });
      if (!rows) return;
      body += '<details class="qbui-pcourse ' + cssCourse(C.course.id) + '" open><summary><i class="qbui-chip"></i>' + esc(C.course.title) + '<span class="qbui-n">' + (ca ? co + '/' + ca : '0') + '</span></summary><div class="qbui-tblw"><table class="qbui-ptab"><thead><tr><th>Question type</th><th class="n">Tried</th><th class="n">Right</th><th>Accuracy</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
    });
    h += '<div class="qbui-kpis"><div><b>' + tot.tried + '<small>/' + tot.types + '</small></b><span>types tried</span></div><div><b>' + tot.att + '</b><span>checks</span></div><div><b>' + (tot.att ? Math.round(100 * tot.ok / tot.att) + '%' : '–') + '</b><span>correct</span></div></div>';
    var fl = []; try { fl = S.sr.flags.list().filter(function (f) { return f.kind === 'question' && /^qb:/.test(f.id); }); } catch (e) {}
    var ms = []; try { ms = S.sr.qb.mistakes().slice(0, 12); } catch (e) {}
    if (fl.length || ms.length) {
      h += '<div class="qbui-lists">';
      if (fl.length) h += '<div><h3>Flagged</h3><ul>' + fl.slice(0, 20).map(function (f) { return '<li class="' + cssCourse(f.course) + '"><a href="' + esc(f.href) + '" data-hash="' + esc(f.href) + '">' + esc(f.title || f.id) + '</a></li>'; }).join('') + '</ul></div>';
      if (ms.length) h += '<div><h3>Recent mistakes</h3><ul>' + ms.map(function (m) { return '<li class="' + cssCourse(m.course) + '"><a href="' + esc(m.href) + '" data-hash="' + esc(m.href) + '">' + esc(m.title) + '</a> <small>' + new Date(m.t).toLocaleDateString() + '</small></li>'; }).join('') + '</ul></div>';
      h += '</div>';
    }
    main.innerHTML = h + body + '</div>';
    $$(main, '[data-open]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); UI.open(a.getAttribute('data-open'), null, null); }); });
    $$(main, '[data-hash]').forEach(function (a) { a.addEventListener('click', function (e) { var w = UI.parseHash(a.getAttribute('data-hash')); if (w) { e.preventDefault(); UI.open(w.id, w.seed, w.variant); } }); });
  }
})(typeof window !== 'undefined' ? window : globalThis);

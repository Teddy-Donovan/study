/* Study app shell: Today, Packs, Bank, Progress (tracker), Mistakes, Exam, Search, Cards, Settings.
 * All state goes through window.SR (sr-store.js). Data files come from mkdata.py.
 */
(function () {
  'use strict';
  var SR = window.SR;
  var TZ = 'Australia/Adelaide';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var D = null, CARDS = null, IDX = null, PK = {};
  var view = $('#view');
  var COURSES = { mach: { s: 'M', t: 'Electrical Machines', short: 'Machines' }, dsp: { s: 'D', t: 'DSP', short: 'DSP' }, edc: { s: 'E', t: 'EDC', short: 'EDC' }, rev: { s: 'R', t: 'Review', short: 'Review' } };
  var S2C = { M: 'mach', D: 'dsp', E: 'edc', R: 'rev' };
  var ST = ['Not started', 'Learning', 'Not confident', 'Confident', 'Exam-ready'];
  var W = [0, 0.3, 0.5, 0.85, 1];
  var PDFL = { q: 'Questions', a: 'Answers', n: 'Cheat sheet' };

  /* ------------------------------------------------------------ icons */
  var IP = {
    today: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14.5h3"/>',
    packs: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7"/>',
    bank: '<path d="M12 3 3 7.5l9 4.5 9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>',
    progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    mistakes: '<path d="M6 3h12v18l-6-4.5L6 21z" stroke-linejoin="round"/>',
    exam: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5V6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    cards: '<rect x="3" y="6.5" width="14" height="14" rx="2.5"/><path d="M7 3.5h11.5A2.5 2.5 0 0 1 21 6v11"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    pdf: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    dots: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    q: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 3.7M12 17.2v.1"/>',
    theory: '<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
    share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>'
  };
  function ic(n, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + (IP[n] || '') + '</svg>'; }
  var FLAG_OUT = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var FLAG_ON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  /* ------------------------------------------------------------ dates (Australia/Adelaide) */
  var DBG_TODAY = (location.search.match(/[?&]today=(\d{4}-\d{2}-\d{2})/) || [])[1];
  function todayISO() {
    if (DBG_TODAY) return DBG_TODAY;
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dayDiff(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
  function fmtD(iso, o) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-AU', Object.assign({ timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }, o || {})); }
  function fmtTs(ms, withTime) {
    var o = { timeZone: TZ, day: 'numeric', month: 'short' };
    if (withTime) { o.hour = 'numeric'; o.minute = '2-digit'; }
    try { return new Date(ms).toLocaleString('en-AU', o); } catch (e) { return new Date(ms).toLocaleString(); }
  }
  function isoOfTs(ms) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); } catch (e) { return new Date(ms).toISOString().slice(0, 10); } }
  function hms(sec) { sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
  function hm(sec) { sec = Math.max(0, Math.round(sec / 60)); var h = Math.floor(sec / 60), m = sec % 60; return h ? h + ' h ' + (m ? m + ' min' : '') : m + ' min'; }

  /* ------------------------------------------------------------ toast, sheet */
  var toastT = 0;
  function toast(m, ms) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, ms || 2000); }
  var sheetEl = $('#sheet'), sheetClose = null;
  function openSheet(html, onClose) {
    sheetEl.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    sheetEl.hidden = false; sheetClose = onClose || null;
    var f = $('.sheet-in [autofocus]') || $('.sheet-in button'); if (f && !('ontouchstart' in window)) try { f.focus(); } catch (e) {}
    return $('.sheet-in', sheetEl);
  }
  function closeSheet() { if (sheetEl.hidden) return; var c = sheetClose; sheetClose = null; sheetEl.hidden = true; sheetEl.innerHTML = ''; if (c) c(); }
  sheetEl.addEventListener('click', function (e) { if (e.target === sheetEl || e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  function confirmSheet(title, text, yes, cb, danger) {
    var el = openSheet('<h3>' + esc(title) + '</h3><p class="sh-sub">' + text + '</p><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn ' + (danger ? 'danger' : 'ink') + '" id="cfy">' + esc(yes) + '</button></div>');
    $('#cfy', el).onclick = function () { sheetClose = null; closeSheet(); cb(); };
  }

  /* ------------------------------------------------------------ tracker model */
  function stOf(k) { var e = SR.tracker.get(k); return e && typeof e.s === 'number' ? e.s : 0; }
  function topicKey(c, m, t) { return 'T:' + c + '/' + m + '/' + t; }
  function skillKey(p, sid) { return 'S:' + p + '/' + sid; }
  function packsOf(t) { return String(t.pack || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function moduleItems(c, m) {
    var keys = [], seen = {};
    m.topics.forEach(function (t) {
      keys.push(topicKey(c.id, m.id, t.id));
      packsOf(t).forEach(function (p) { if (seen[p] || !PK[p]) return; seen[p] = 1; PK[p].skills.forEach(function (s) { keys.push(skillKey(p, s.id)); }); });
    });
    return keys;
  }
  function progressOf(keys) { if (!keys.length) return 0; var s = 0; keys.forEach(function (k) { s += W[stOf(k)]; }); return s / keys.length; }
  function courseItems(cid) { var c = D.tree.filter(function (x) { return x.id === cid; })[0]; if (!c) return []; var all = []; c.modules.forEach(function (m) { all = all.concat(moduleItems(c, m)); }); return all.filter(function (k, i, a) { return a.indexOf(k) === i; }); }
  function packProgress(p) { var P = PK[p]; if (!P || !P.skills.length) return null; return progressOf(P.skills.map(function (s) { return skillKey(p, s.id); })); }
  function attemptsOf(pid) { return (SR.get('exam', {}).attempts || []).filter(function (a) { return a.paper === pid; }); }
  function packDone(p) {
    var e = SR.tracker.get('P:' + p); if (e && e.done) return true;
    var P = PK[p]; if (!P) return false;
    if (P.skills.length && P.skills.every(function (s) { return stOf(skillKey(p, s.id)) >= 3; })) return true;
    if ((P.kind === 'mock' || P.kind === 'paper') && attemptsOf(p).length) return true;
    return false;
  }
  function pctTxt(x) { return Math.round(x * 100) + '%'; }
  function bar(x) { return '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(x * 100) + '"><i style="width:' + (x * 100).toFixed(1) + '%"></i></div>'; }
  function chip(k, sm, label) {
    var s = stOf(k);
    return '<span class="stx"><button type="button" class="st s' + s + (sm ? ' sm' : '') + '" data-k="' + esc(k) + '" aria-label="' + esc((label ? label + ': ' : '') + ST[s] + '. Tap to change, long-press for options') + '"><i></i>' + ST[s] + '</button>' +
      '<button type="button" class="more" data-km="' + esc(k) + '" data-kl="' + esc(label || '') + '" aria-label="More options">' + ic('dots') + '</button></span>';
  }
  function setStatus(k, s) { SR.tracker.set(k, { s: s }); refreshChips(k); afterTrackerChange(); }
  function refreshChips(k) {
    var s = stOf(k);
    $$('.st[data-k]').forEach(function (b) { if (b.getAttribute('data-k') !== k) return; b.className = 'st s' + s + (b.classList.contains('sm') ? ' sm' : ''); b.innerHTML = '<i></i>' + ST[s]; });
  }
  var afterT = 0;
  function afterTrackerChange() { clearTimeout(afterT); afterT = setTimeout(function () { if (cur.refresh) cur.refresh(); updateBadges(); }, 250); }
  function openPicker(k, label) {
    var e = SR.tracker.get(k) || {}, s = stOf(k);
    var el = openSheet('<h3>' + esc(label || 'Status') + '</h3><div class="sh-sub">' + (e.t ? 'Last reviewed ' + fmtTs(e.t, true) : 'Not reviewed yet') + '</div>' +
      '<div class="stpick">' + ST.map(function (n, i) { return '<button type="button" class="st s' + i + (i === s ? ' cur' : '') + '" data-pick="' + i + '"><i></i>' + n + '</button>'; }).join('') + '</div>' +
      '<label class="field"><span>Note (optional)</span><textarea id="pknote" placeholder="e.g. redo PQ 7.12, mixed up ω and ω_s">' + esc(e.note || '') + '</textarea></label>' +
      '<div class="foot"><button class="btn" id="pkrev">' + ic('check') + 'Reviewed today</button><button class="btn ink" data-close>Done</button></div>', function () {
      var v = $('#pknote') ? $('#pknote').value : null;
      if (v !== null && v !== (e.note || '')) { SR.tracker.set(k, { note: v.trim() }); afterTrackerChange(); }
    });
    $$('[data-pick]', el).forEach(function (b) { b.onclick = function () { var v = $('#pknote').value; SR.tracker.set(k, { s: +b.getAttribute('data-pick'), note: v.trim() }); e.note = v.trim(); refreshChips(k); afterTrackerChange(); closeSheet(); }; });
    $('#pkrev', el).onclick = function () { SR.tracker.set(k, { reviewed: true, note: $('#pknote').value.trim() }); e.note = $('#pknote').value.trim(); afterTrackerChange(); toast('Marked as reviewed today'); closeSheet(); };
  }
  // chip interactions: tap cycles; long-press / right-click / ⋯ opens the picker
  var lp = { t: 0, fired: false, x: 0, y: 0 };
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.st[data-k]'); if (!b) return;
    lp.fired = false; lp.x = e.clientX; lp.y = e.clientY; clearTimeout(lp.t);
    lp.t = setTimeout(function () { lp.fired = true; if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(12); } catch (x) {} openPicker(b.getAttribute('data-k'), labelFor(b)); }, 480);
  });
  document.addEventListener('pointermove', function (e) { if (lp.t && (Math.abs(e.clientX - lp.x) > 8 || Math.abs(e.clientY - lp.y) > 8)) { clearTimeout(lp.t); lp.t = 0; } }, { passive: true });
  ['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { clearTimeout(lp.t); lp.t = 0; }); });
  document.addEventListener('contextmenu', function (e) { var b = e.target.closest && e.target.closest('.st[data-k]'); if (b) { e.preventDefault(); if (!lp.fired) { lp.fired = true; openPicker(b.getAttribute('data-k'), labelFor(b)); } } });
  function labelFor(b) { var m = b.parentElement.querySelector('[data-km]'); return (m && m.getAttribute('data-kl')) || ''; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.st[data-k]');
    if (b && !b.closest('.sheet')) { e.preventDefault(); if (lp.fired) { lp.fired = false; return; } var k = b.getAttribute('data-k'); setStatus(k, (stOf(k) + 1) % 5); return; }
    var m = e.target.closest && e.target.closest('[data-km]');
    if (m) { e.preventDefault(); openPicker(m.getAttribute('data-km'), m.getAttribute('data-kl')); }
  });

  /* ------------------------------------------------------------ cards model */
  function cardsDue(list) { var now = Date.now(), d = 0, n = 0; list.forEach(function (c) { var s = SR.cards.get(c.id); if (!s) n++; else if (s.due <= now) d++; }); return { due: d, nw: n }; }

  /* ------------------------------------------------------------ navigation */
  var TABS = [
    { id: 'today', t: 'Today', ic: 'today' }, { id: 'packs', t: 'Packs', ic: 'packs' }, { id: 'bank', t: 'Bank', ic: 'bank', title: 'Question bank' },
    { id: 'progress', t: 'Progress', ic: 'progress', title: 'Progress' }, { id: 'mistakes', t: 'Mistakes', ic: 'mistakes', title: 'Mistake log', wide: 1 },
    { id: 'exam', t: 'Exam', ic: 'exam', title: 'Timed exam', wide: 1 }, { id: 'cards', t: 'Cards', ic: 'cards', title: 'Flashcards', wide: 1 },
    { id: 'search', t: 'Search', ic: 'search', title: 'Search', wide: 1 }, { id: 'settings', t: 'Settings', ic: 'settings', wide: 1 }
  ];
  function buildNav() {
    $('#sidenav').innerHTML = TABS.map(function (t) { return '<a class="nav" href="#' + t.id + '" data-tab="' + t.id + '">' + ic(t.ic) + '<span>' + (t.title || t.t) + '</span><span class="cnt" data-cnt="' + t.id + '"></span></a>'; }).join('');
    $('#tabbar').innerHTML = TABS.map(function (t) { return '<a class="tab' + (t.wide ? ' wide-only' : '') + '" href="#' + t.id + '" data-tab="' + t.id + '">' + ic(t.ic) + '<span>' + t.t + '</span><b class="badge" data-badge="' + t.id + '" hidden></b></a>'; }).join('') +
      '<button class="tab more-btn" type="button" id="morebtn" aria-label="More">' + ic('more') + '<span>More</span><b class="badge" data-badge="more" hidden></b></button>';
    $('#searchbtn').innerHTML = ic('search');
    $('#morebtn').onclick = function () {
      openSheet('<h3>More</h3><div class="morelist">' + TABS.filter(function (t) { return t.wide; }).map(function (t) { return '<a href="#' + t.id + '" data-close>' + ic(t.ic) + (t.title || t.t) + '<b class="badge" data-badge="' + t.id + '" hidden></b></a>'; }).join('') + '</div>');
      updateBadges();
    };
  }
  function updateBadges() {
    if (!D) return;
    var due = CARDS ? cardsDue(CARDS).due : 0;
    var nm = SR.flags.list().length + SR.qb.mistakes().length;
    function setB(id, n) { $$('[data-badge="' + id + '"]').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }); }
    setB('cards', due); setB('more', due);
    $$('[data-cnt]').forEach(function (c) { var id = c.getAttribute('data-cnt'); c.textContent = id === 'cards' ? (due || '') : id === 'mistakes' ? (nm || '') : ''; });
    var sf = $('#sidefoot'); var t = todayISO();
    sf.innerHTML = D.exams.map(function (x) { var n = dayDiff(t, x.date); return '<div class="sfcd ' + x.course + '"><span>' + esc(x.title) + '</span><b>' + (n > 0 ? n + ' d' : n === 0 ? 'today' : 'done') + '</b></div>'; }).join('');
  }
  var cur = { id: null };
  function route() {
    closeSheet();
    var h = decodeURIComponent((location.hash || '#today').slice(1));
    var id = h.split(/[\/?]/)[0] || 'today';
    if (id === 'qb') id = 'bank';
    if (!VIEWS[id]) id = 'today';
    var tab = TABS.filter(function (t) { return t.id === id; })[0];
    var leaving = cur.id;
    if (cur.leave) try { cur.leave(); } catch (e) {}
    cur = { id: id };
    $$('[data-tab]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-tab') === id); if (a.getAttribute('data-tab') === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#vtitle').textContent = id === 'today' ? 'Today' : (tab ? (tab.title || tab.t) : '');
    document.title = (tab ? (tab.title || tab.t) : 'Study') + ' · Study Resources';
    var arg = h.slice(id === 'bank' && h.indexOf('qb/') === 0 ? 0 : id.length).replace(/^[\/?]/, '');
    try { VIEWS[id](arg, leaving === id); } catch (e) { console.error(e); view.innerHTML = '<div class="empty">Something went wrong showing this tab.<br><code>' + esc(e.message) + '</code></div>'; }
    if (leaving !== id) { window.scrollTo(0, 0); try { view.focus({ preventScroll: true }); } catch (e) {} }
    renderExamBar();
  }
  function rerender() { var y = window.scrollY; var h = decodeURIComponent((location.hash || '#today').slice(1)); var id = cur.id; var arg = h.slice(id.length).replace(/^[\/?]/, ''); VIEWS[id](arg, true); window.scrollTo(0, y); }
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', function () { $('#appbar').classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  window.addEventListener('storage', function (e) { if (e.key === 'studyres.v1' && cur.id && cur.id !== 'bank' && cur.id !== 'exam' && sheetEl.hidden) { rerender(); updateBadges(); } });
  window.addEventListener('sr-change', function () { clearTimeout(window.__bT); window.__bT = setTimeout(updateBadges, 200); });

  /* ------------------------------------------------------------ pack helpers */
  function packHref(p, a) { return 'packs/' + p + '.html' + (a ? '#' + a : ''); }
  function pdfHref(f) { return '#pdf?f=' + encodeURIComponent(f); }
  function pdfBtns(P, cls) {
    return ['q', 'a', 'n'].filter(function (m) { return P.pdf && P.pdf[m]; }).map(function (m) {
      return '<a class="btn ' + (cls || 'sm') + '" href="' + pdfHref('pdf/' + P.id + '-' + m + '.pdf') + '">' + ic('pdf') + PDFL[m] + '</a>';
    }).join('');
  }
  function doneBtn(p) { var on = packDone(p); return '<button type="button" class="donebtn' + (on ? ' on' : '') + '" data-done="' + p + '" aria-pressed="' + on + '">' + ic('check') + (on ? 'Done' : 'Mark done') + '</button>'; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-done]'); if (!b) return;
    var p = b.getAttribute('data-done'), e0 = SR.tracker.get('P:' + p) || {}, was = packDone(p);
    if (was && !e0.done) { toast('Done because every skill is Confident or better'); return; }
    SR.tracker.set('P:' + p, { done: !e0.done });
    var on = packDone(p); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = ic('check') + (on ? 'Done' : 'Mark done');
    toast(on ? p + ' marked done' : p + ' not done'); afterTrackerChange();
  });
  function kindLabel(k) { return { topic: '2-hour block', paper: 'Past paper', mock: 'Mock exam', quiz: 'Review', ref: 'Reference sheet' }[k] || k; }
  function subjName(s) { return (COURSES[S2C[s]] || {}).t || s; }

  /* ================================================================== VIEWS */
  var VIEWS = {};

  /* ------------------------------------------------------------ Today */
  VIEWS.today = function () {
    var t = todayISO(), tm = addDays(t, 1);
    var blocks = D.packs.filter(function (p) { return p.date === t && p.kind !== 'ref'; });
    var tomo = D.packs.filter(function (p) { return p.date === tm && p.kind !== 'ref'; });
    var nextDay = null;
    if (!blocks.length) { var fut = D.packs.filter(function (p) { return p.date > t && p.kind !== 'ref'; }).map(function (p) { return p.date; }).sort(); nextDay = fut[0] || null; }
    var h = '';
    h += '<div class="hello">' + esc(fmtD(t, { weekday: 'long', day: 'numeric', month: 'long' })) + ' · Adelaide</div>';
    h += a2hsHint();
    var ex = SR.get('exam', {}).current;
    if (ex) h += '<a class="mini rev" href="#exam" style="margin-bottom:12px"><b>Timed exam in progress: ' + esc(ex.title) + '</b><span class="chip">Return</span></a>';
    h += '<div class="cds">' + D.exams.map(function (x) {
      var n = dayDiff(t, x.date), pr = progressOf(courseItems(x.course));
      return '<a class="cd ' + x.course + '" href="#progress/' + x.course + '"><span class="t">' + esc(x.title) + '</span><span class="n">' + (n > 0 ? n : n === 0 ? '0' : '✓') + '</span><span class="u">' + (n > 1 ? 'days to go' : n === 1 ? 'day to go' : n === 0 ? 'exam today' : 'finished') + '</span><span class="d">' + esc(fmtD(x.date)) + '</span>' + bar(pr) + '<span class="d">' + pctTxt(pr) + ' ready</span></a>';
    }).join('') + '</div>';
    h += '<div class="sec"><h2>Today’s blocks</h2><span class="sub">2 × 2 h</span></div>';
    if (blocks.length) h += '<div class="blocks">' + blocks.map(function (p, i) { return blockCard(p, i + 1); }).join('') + '</div>';
    else {
      var exToday = D.exams.filter(function (x) { return x.date === t; })[0];
      h += '<div class="panel pad">' + (exToday ? '<b>' + esc(exToday.title) + ' exam today.</b> Good luck. Your reference sheet is in <a href="#packs">Packs</a>.' : 'No study blocks scheduled today.') +
        (nextDay ? ' Next blocks: <b>' + esc(fmtD(nextDay)) + '</b>.' : '') + '</div>';
      if (nextDay && !exToday) h += '<div class="minis" style="margin-top:10px">' + D.packs.filter(function (p) { return p.date === nextDay && p.kind !== 'ref'; }).map(miniRow).join('') + '</div>';
    }
    h += '<div class="sec"><h2>Tomorrow</h2><span class="sub">' + esc(fmtD(tm)) + '</span></div>';
    h += tomo.length ? '<div class="minis">' + tomo.map(miniRow).join('') + '</div>' : '<div class="panel pad muted">Nothing scheduled.</div>';
    // next up
    var nu = nextUp(6);
    h += '<div class="sec"><h2>Next up from your tracker</h2><a class="sub" href="#progress">Open tracker →</a></div>';
    h += nu.length ? '<div class="nextup">' + nu.map(function (x) {
      return '<div class="nu ' + x.course + '"><span class="dot"></span><div class="tt"><b>' + esc(x.title) + '</b><span>' + esc(COURSES[x.course].short) + ' · exam in ' + x.days + ' d · ' + x.packs.map(function (p) { return '<a href="' + packHref(p) + '">' + p + '</a>'; }).join(' ') + '</span></div>' + chip(x.key, true, x.title) + '</div>';
    }).join('') + '</div>' : '<div class="panel pad muted">Nothing is Not started or Not confident. Nice.</div>';
    // stats
    var cd = CARDS ? cardsDue(CARDS) : { due: 0, nw: 0 };
    var fl = SR.flags.list(), mk = SR.qb.mistakes();
    h += '<div class="sec"><h2>At a glance</h2></div><div class="stats">' +
      '<a class="stat" href="#cards"><b>' + cd.due + '</b><span>flashcards due' + (cd.nw ? ' · ' + cd.nw + ' new' : '') + '</span></a>' +
      '<a class="stat" href="#mistakes"><b>' + (fl.filter(function (f) { return f.kind === 'question'; }).length + mk.length) + '</b><span>questions to redo</span></a>' +
      '<a class="stat" href="#mistakes"><b>' + fl.filter(function (f) { return f.kind !== 'question'; }).length + '</b><span>theory to revisit</span></a></div>';
    view.innerHTML = h;
    bindA2hs();
    cur.refresh = function () { VIEWS.today(); };
  };
  function blockCard(p, n) {
    var pr = packProgress(p.id), done = packDone(p.id);
    return '<div class="block ' + p.course + (done ? ' done' : '') + '"><div class="top"><span class="bn">Block ' + n + ' · ' + esc(kindLabel(p.kind)) + '</span><span class="chip">' + esc(subjName(p.s)) + ' · ' + esc(p.code) + '</span></div>' +
      '<h3><a href="' + packHref(p.id) + '">' + esc(p.title) + '</a></h3>' +
      '<div class="meta">Pack ' + p.id + (p.skills.length ? ' · ' + p.skills.length + ' skills' : '') + (p.nq ? ' · ' + p.nq + ' questions' : '') + '</div>' +
      (pr !== null ? '<div class="row" style="gap:10px"><div style="flex:1">' + bar(pr) + '</div><span class="pct">' + pctTxt(pr) + '</span></div>' : '') +
      '<div class="row"><a class="btn pri" href="' + packHref(p.id) + '">Open pack</a>' + (p.kind === 'mock' || p.kind === 'paper' ? '<a class="btn" href="#exam/pick/' + p.id + '">' + ic('exam') + 'Sit timed</a>' : '') + doneBtn(p.id) + '</div>' +
      (pdfBtns(p) ? '<div class="row">' + pdfBtns(p) + '</div>' : '') + '</div>';
  }
  function miniRow(p) { return '<a class="mini ' + p.course + '" href="' + packHref(p.id) + '"><span class="chip">' + esc(p.code) + '</span><b>' + esc(p.title) + '</b>' + (packDone(p.id) ? '<span class="donebadge">' + ic('check') + 'Done</span>' : '<span class="kind">' + p.id + '</span>') + '</a>'; }
  function nextUp(n) {
    var t = todayISO(), out = [];
    var ex = {}; D.exams.forEach(function (x) { ex[x.course] = x.date; });
    D.tree.forEach(function (c) {
      var d = dayDiff(t, ex[c.id] || '2099-01-01'); if (d < 0) return;
      c.modules.forEach(function (m) {
        m.topics.forEach(function (tp) {
          var k = topicKey(c.id, m.id, tp.id), s = stOf(k);
          if (s !== 0 && s !== 2) return;
          var ps = packsOf(tp), pd = ps.map(function (p) { return PK[p] ? PK[p].date : '2099'; }).sort()[0] || '2099';
          out.push({ key: k, title: tp.title, course: c.id, days: d, s: s, packs: ps, pd: pd });
        });
      });
    });
    out.sort(function (a, b) { return a.days - b.days || (b.s === 2) - (a.s === 2) || (a.pd < b.pd ? -1 : a.pd > b.pd ? 1 : 0); });
    return out.slice(0, n);
  }
  function a2hsHint() {
    var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (standalone || !ios || SR.get('ui', {}).a2hs) return '';
    return '<div class="a2hs" id="a2hs">' + ic('share') + '<p><b>Install on your iPad:</b> tap the Share button ' + '(square with an arrow) in Safari, then <b>Add to Home Screen</b>. It then opens full screen and works offline.</p><button class="iconbtn x" id="a2hsx" aria-label="Dismiss">' + ic('x') + '</button></div>';
  }
  function bindA2hs() { var x = $('#a2hsx'); if (x) x.onclick = function () { var u = SR.get('ui', {}); u.a2hs = 1; SR.set('ui', u); $('#a2hs').remove(); }; }

  /* ------------------------------------------------------------ Packs */
  VIEWS.packs = function (arg, same) {
    var ui = SR.get('ui', {}), f = ui.packf || 'all', t = todayISO();
    var subj = { all: null, mach: 'M', dsp: 'D', edc: 'E', rev: 'R' }[f];
    var list = D.packs.filter(function (p) { return !subj || p.s === subj; });
    var h = '<div class="toolbar"><div class="seg" role="tablist">' + [['all', 'All'], ['mach', 'Machines'], ['dsp', 'DSP'], ['edc', 'EDC'], ['rev', 'Review']].map(function (x) { return '<button role="tab" data-pf="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '" aria-selected="' + (f === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<span class="pct">' + list.filter(function (p) { return p.kind !== 'ref' && packDone(p.id); }).length + ' of ' + list.filter(function (p) { return p.kind !== 'ref'; }).length + ' done</span></div>';
    var refs = list.filter(function (p) { return p.kind === 'ref'; });
    if (refs.length) h += '<div class="sec"><h2>Open-book reference sheets</h2></div><div class="prow g2 grid">' + refs.map(function (p) { return packCard(p, true); }).join('') + '</div>';
    var comb = D.combined.filter(function (c) { return !subj || (COURSES[S2C[subj]] && (c.subject === COURSES[S2C[subj]].t)); });
    if (comb.length) h += '<div class="sec"><h2>Combined PDFs</h2><span class="sub">per subject</span></div><div class="combo">' + comb.map(function (c) {
      var cs = c.subject === 'Electrical Machines' ? 'mach' : c.subject === 'DSP' ? 'dsp' : 'edc';
      return '<a class="' + cs + '" href="' + pdfHref(c.file) + '">' + ic('pdf') + esc(c.subject + ': ' + c.name) + '<span>' + (c.size / 1048576).toFixed(1) + ' MB</span></a>';
    }).join('') + '</div>';
    var days = {}; list.filter(function (p) { return p.kind !== 'ref'; }).forEach(function (p) { (days[p.date] = days[p.date] || []).push(p); });
    var start = '2026-10-24';
    h += '<div class="sec"><h2>Day by day</h2><span class="sub">roadmap</span></div><div class="panel" style="padding:0 16px">' + Object.keys(days).sort().map(function (d) {
      return '<div class="day' + (d === t ? ' today' : d < t ? ' past' : '') + '" id="day-' + d + '"><div class="dt"><b>' + esc(fmtD(d)) + '</b><span>Day ' + String(dayDiff(start, d) + 1).padStart(2, '0') + (d === t ? ' · today' : '') + '</span></div><div class="prow">' + days[d].map(function (p) { return packCard(p); }).join('') + '</div></div>';
    }).join('') + '</div>';
    view.innerHTML = h;
    $$('[data-pf]').forEach(function (b) { b.onclick = function () { var u = SR.get('ui', {}); u.packf = b.getAttribute('data-pf'); SR.set('ui', u); VIEWS.packs(null, true); }; });
    if (!same) { var td = $('#day-' + t); if (td) setTimeout(function () { var y = td.getBoundingClientRect().top + window.scrollY - 70; if (y > 300) window.scrollTo(0, y); }, 30); }
    cur.refresh = function () { rerender(); };
  };
  function packCard(p, ref) {
    var pr = packProgress(p.id);
    return '<div class="pk ' + p.course + '"><div class="h"><div><a href="' + packHref(p.id) + '">' + esc(p.title) + '</a><div class="kind" style="margin-top:3px">' + esc(subjName(p.s)) + ' · ' + esc(p.code) + ' · ' + p.id + (ref ? ' · use from ' + esc(fmtD(p.date)) : ' · ' + esc(kindLabel(p.kind))) + '</div></div>' + (ref ? '' : doneBtn(p.id)) + '</div>' +
      (pr !== null ? '<div class="prog">' + bar(pr) + '<span class="pct">' + pctTxt(pr) + '</span></div>' : '') +
      '<div class="acts"><a class="btn pri" href="' + packHref(p.id) + '">Open</a>' + pdfBtns(p) + ((p.kind === 'mock' || p.kind === 'paper') ? '<a class="btn" href="#exam/pick/' + p.id + '">' + ic('exam') + 'Timed</a>' : '') + '</div></div>';
  }

  /* ------------------------------------------------------------ PDF viewer */
  VIEWS.pdf = function (arg) {
    var f = decodeURIComponent((arg.match(/f=([^&]+)/) || [])[1] || '');
    if (!/^pdf\/[^?#]+\.pdf$/.test(f)) { view.innerHTML = '<div class="empty">No PDF selected.</div>'; return; }
    $('#vtitle').textContent = f.split('/').pop().replace(/\.pdf$/, '');
    view.innerHTML = '<div class="toolbar"><button class="btn" onclick="history.length>1?history.back():location.hash=\'#packs\'">' + ic('back') + 'Back</button><a class="btn" href="' + esc(f) + '" target="_blank" rel="noopener">' + ic('open') + 'Open in new tab</a><a class="btn" href="' + esc(f) + '" download>' + ic('download') + 'Download</a></div>' +
      '<iframe class="exframe" src="' + esc(f) + '" title="PDF"></iframe>';
  };

  /* ------------------------------------------------------------ Question bank */
  var QBL = { p: null, ui: false, host: null, lastOpen: '' };
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if ($('script[data-src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.async = false; s.setAttribute('data-src', src);
      s.onload = function () { res(); }; s.onerror = function () { s.remove(); rej(new Error('missing ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadCss(href) { if ($('link[data-href="' + href + '"]')) return; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-href', href); document.head.appendChild(l); }
  function qbHas(f) { return (D.qbFiles || []).indexOf(f) >= 0; }
  function loadBank() {
    if (QBL.p) return QBL.p;
    QBL.p = (async function () {
      if (!qbHas('qb-core.js')) throw new Error('The question bank has not been copied into qb/ yet.');
      await loadScript('qb/qb-core.js');
      for (var f of ['qb-sch.js', 'qb-plot.js']) if (qbHas(f)) await loadScript('qb/' + f).catch(function () {});
      if (qbHas('banks.js')) {
        await loadScript('qb/banks.js').catch(function () {});
        var lst = window.QB_BANKS || (window.QB && (QB.banks || QB.bankFiles)) || null;
        if (Array.isArray(lst)) {
          // banks.js is the authoritative list (it skips demo/unfinished files)
          for (var b of lst) { if (typeof b === 'string' && /\.js$/.test(b)) await loadScript('qb/' + b.replace(/^.*\//, '')).catch(function () {}); }
          return window.QB;
        }
      }
      for (var g of (D.qbFiles || [])) if (/^bank-.*\.js$/.test(g) && !/demo/.test(g)) await loadScript('qb/' + g).catch(function () {});
      return window.QB;
    })();
    QBL.p.catch(function () { QBL.p = null; });
    return QBL.p;
  }
  function loadBankUI() {
    return loadBank().then(async function () {
      if (!qbHas('qb-ui.js')) throw new Error('qb-ui.js is not in qb/ yet');
      if (qbHas('qb-ui.css')) loadCss('qb/qb-ui.css');
      await loadScript('qb/qb-ui.js');
      if (!window.QBUI || !QBUI.mount) throw new Error('QBUI did not load');
      return window.QBUI;
    });
  }
  function parseQbHash(s) { var m = /^qb\/([^@:]+)(?:@(\d+))?(?::(.+))?$/.exec(s || ''); return m ? { id: m[1], seed: m[2] ? +m[2] : null, variant: m[3] || null } : null; }
  VIEWS.bank = function (arg) {
    if (!QBL.host) { QBL.host = document.createElement('div'); QBL.host.className = 'qbwrap'; QBL.host.id = 'qbhost'; }
    view.innerHTML = '';
    view.appendChild(QBL.host);
    var want = parseQbHash(arg);
    if (QBL.ui) { if (want) openQb(want); return; }
    QBL.host.innerHTML = '<div class="empty">' + ic('bank') + 'Loading the question bank…</div>';
    loadBankUI().then(function (UI) {
      if (QBL.ui) return;
      QBL.host.innerHTML = '';
      var mnt = document.createElement('div'); mnt.className = 'qb-mount'; QBL.host.appendChild(mnt);
      UI.mount(mnt, { sr: SR, base: 'qb/', basePath: 'qb/', embedded: true, hashPrefix: '#qb/', mathjax: window.MathJax });
      QBL.ui = true;
      if (want) openQb(want);
    }).catch(function (e) {
      var n = window.QB && QB.types ? QB.types.length : 0;
      QBL.host.innerHTML = '<div class="ph-card">' + ic('bank') + '<b>The question bank is on its way</b><span>Regenerating questions with worked solutions for every topic are being written now. Once <code>qb/qb-ui.js</code> lands, run <code>sync.sh</code> and this tab will show the bank.</span>' +
        (n ? '<span>' + n + ' question types are already loaded and searchable.</span>' : '') + '<span class="mono" style="font-size:12px">' + esc(e.message) + '</span>' +
        (want ? '<span>Requested: <code>' + esc(want.id) + (want.seed ? '@' + want.seed : '') + '</code></span>' : '') + '</div>';
    });
  };
  function openQb(w) {
    var key = w.id + '@' + w.seed + ':' + w.variant; if (key === QBL.lastOpen && location.hash.indexOf('#qb/') === 0) return;
    QBL.lastOpen = key;
    try { if (window.QBUI && QBUI.open) QBUI.open(w.id, w.seed, w.variant); } catch (e) { console.error(e); }
  }

  /* ------------------------------------------------------------ Progress / tracker */
  VIEWS.progress = function (arg, same) {
    var open = SR.get('ui', {}).openMods || {};
    var h = '<p class="lede">Tap a status to step it on. Long-press it (or tap ⋯) to pick one directly, add a note and mark it reviewed.</p><div class="legend">' + ST.map(function (n, i) { return '<span class="st s' + i + '"><i></i>' + n + '</span>'; }).join('') + '</div>';
    h += '<div class="sec"><h2>Overview</h2><span class="sub">course × module</span></div><div class="panel pad"><div class="mx">' + D.tree.map(function (c) {
      var pc = progressOf(courseItems(c.id));
      return '<div class="mx-row ' + c.id + '"><div class="ttl"><b>' + esc(c.short || c.title) + '</b>' + bar(pc) + '<span class="pct">' + pctTxt(pc) + ' complete</span></div><div class="mx-cells">' + c.modules.map(function (m) {
        var p = progressOf(moduleItems(c, m));
        return '<a class="mx-cell' + (p > 0.55 ? ' hi' : '') + '" style="--p:' + Math.round(p * 100) + '" href="#progress/' + c.id + '/' + m.id + '" title="' + esc(m.title) + '"><span>' + esc(m.title.replace(/^Module \d+ · /, '')) + '</span><em>' + pctTxt(p) + '</em></a>';
      }).join('') + '</div></div>';
    }).join('') + '</div></div>';
    D.tree.forEach(function (c) {
      var pc = progressOf(courseItems(c.id));
      h += '<section class="course ' + c.id + '" id="course-' + c.id + '"><h2>' + esc(c.title) + '<span class="pct">' + pctTxt(pc) + '</span></h2>' + bar(pc);
      c.modules.forEach(function (m) {
        var mid = c.id + '/' + m.id, p = progressOf(moduleItems(c, m));
        h += '<details class="mod" id="mod-' + c.id + '-' + m.id + '" data-mod="' + mid + '"' + (open[mid] ? ' open' : '') + '><summary><div><b>' + esc(m.title) + '</b><div class="span">' + esc(m.span || '') + ' · ' + m.topics.length + ' topics · ' + pctTxt(p) + '</div></div>' + ic('chev', ' class="chev"') + bar(p) + '</summary><div class="mod-body">';
        var seen = [];
        m.topics.forEach(function (t) {
          var k = topicKey(c.id, m.id, t.id), e = SR.tracker.get(k) || {};
          var ps = packsOf(t);
          ps.forEach(function (x) { if (seen.indexOf(x) < 0 && PK[x]) seen.push(x); });
          h += '<div class="trow"><div class="tn"><b>' + esc(t.title) + '</b><div class="sub">' + ps.map(function (x) { return '<a href="' + packHref(x) + '">' + x + ' ↗</a>'; }).join('') + (e.t ? '<span>reviewed ' + esc(fmtTs(e.t)) + '</span>' : '') + '</div>' + (e.note ? '<div class="note">' + esc(e.note) + '</div>' : '') + '</div>' + chip(k, false, t.title) + '</div>';
        });
        seen.forEach(function (x) {
          var P = PK[x]; if (!P.skills.length) return;
          var pp = packProgress(x);
          h += '<div class="packsk ' + P.course + '"><div class="ph"><a href="' + packHref(x) + '">' + x + '</a><span>' + esc(P.title) + '</span><span class="pct" style="margin-left:auto">' + pctTxt(pp) + '</span></div>';
          ['theory', 'method'].forEach(function (g) {
            var sk = P.skills.filter(function (s) { return s.g === g; }); if (!sk.length) return;
            h += '<div class="grp">' + (g === 'theory' ? 'Theory' : 'Method') + '</div>';
            sk.forEach(function (s) {
              var k = skillKey(x, s.id), e = SR.tracker.get(k) || {};
              h += '<div class="trow"><div class="tn"><b><a href="' + packHref(x, s.a || s.id) + '" style="text-decoration:none">' + esc(s.t) + '</a></b>' + (e.t || s.ref ? '<div class="sub">' + (s.ref ? '<span>' + esc(s.ref) + '</span>' : '') + (e.t ? '<span>reviewed ' + esc(fmtTs(e.t)) + '</span>' : '') + '</div>' : '') + (e.note ? '<div class="note">' + esc(e.note) + '</div>' : '') + '</div>' + chip(k, true, s.t) + '</div>';
            });
          });
          h += '</div>';
        });
        h += '</div></details>';
      });
      h += '</section>';
    });
    view.innerHTML = h;
    $$('details.mod').forEach(function (d) { d.addEventListener('toggle', function () { var u = SR.get('ui', {}); u.openMods = u.openMods || {}; if (d.open) u.openMods[d.getAttribute('data-mod')] = 1; else delete u.openMods[d.getAttribute('data-mod')]; SR.set('ui', u); }); });
    if (arg && !same) {
      var bits = arg.split('/'), tgt = bits[1] ? $('#mod-' + bits[0] + '-' + bits[1]) : $('#course-' + bits[0]);
      if (tgt) { if (tgt.tagName === 'DETAILS') tgt.open = true; setTimeout(function () { tgt.scrollIntoView({ block: 'start' }); window.scrollBy(0, -64); }, 20); }
    }
    cur.refresh = function () { rerender(); };
  };

  /* ------------------------------------------------------------ Mistakes */
  function qbTitle(id) { return (window.QB && QB.byId && QB.byId[id] && QB.byId[id].title) || id; }
  function mistakeItems() {
    var items = [];
    SR.flags.list().forEach(function (f) {
      var href = f.href || (f.id.indexOf('qb:') === 0 ? '#qb/' + f.id.slice(3) : '#');
      if (/^packs\//.test(href) || /^#/.test(href)) {} else href = '#';
      var course = f.course || (f.pack ? S2C[f.pack[0]] : '') || (f.id.indexOf('qb:') === 0 ? f.id.slice(3).split('.')[0] : '');
      items.push({ src: 'flag', id: f.id, kind: f.kind === 'question' ? 'question' : 'theory', title: f.title || f.id, href: href, course: course, t: f.t, pack: f.pack || '', where: f.pack ? 'Pack ' + f.pack : (f.id.indexOf('qb:') === 0 ? 'Question bank' : '') });
    });
    var seen = {};
    SR.qb.mistakes().forEach(function (m) {
      var tid = m.typeId || m.type || m.tid || m.id || '';
      var seed = m.seed != null ? m.seed : '';
      var key = tid + '@' + seed + ':' + (m.variant || '');
      if (seen[key]) return; seen[key] = 1;
      var href = m.href || ('#qb/' + tid + (seed !== '' ? '@' + seed : '') + (m.variant ? ':' + m.variant : ''));
      items.push({ src: 'qb', t: m.t, kind: 'question', title: m.title || qbTitle(tid), href: href, course: m.course || tid.split('.')[0], where: 'Bank · wrong answer' + (m.part != null ? ' · part ' + m.part : ''), mt: m.t });
    });
    return items;
  }
  VIEWS.mistakes = function () {
    var ui = SR.get('ui', {}), f = ui.mf || 'all';
    var all = mistakeItems().filter(function (x) { return f === 'all' || x.course === f; });
    var qs = all.filter(function (x) { return x.kind === 'question'; }), th = all.filter(function (x) { return x.kind !== 'question'; });
    function row(x) {
      var c = COURSES[x.course] ? x.course : 'rev';
      return '<div class="mi ' + c + '"><span class="ic">' + ic(x.kind === 'question' ? 'q' : 'theory') + '</span><a class="go" href="' + esc(x.href) + '"><b>' + esc(x.title) + '</b><span>' + esc(x.where) + ' · ' + esc(fmtTs(x.t)) + '</span></a><div class="acts">' +
        (x.src === 'flag' ? '<button class="flag" data-unflag="' + esc(x.id) + '" aria-label="Unflag" title="Unflag">' + FLAG_ON + '</button>' : '<button data-clr="' + x.mt + '" aria-label="Clear from log" title="Clear from log">' + ic('x') + '</button>') + '</div></div>';
    }
    var h = '<div class="toolbar"><div class="seg">' + [['all', 'All'], ['mach', 'Machines'], ['dsp', 'DSP'], ['edc', 'EDC'], ['rev', 'Review']].map(function (x) { return '<button data-mf="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    h += '<p class="lede">Tap the ' + FLAG_OUT.replace('width="22" height="22"', 'width="16" height="16" style="vertical-align:-3px"') + ' on any question, formula or theory section in a pack to add it here. Wrong answers in the question bank are logged automatically.</p>';
    h += '<div class="sec"><h2>Questions to redo</h2><span class="sub">' + qs.length + '</span></div>';
    h += qs.length ? '<div class="mlist">' + qs.map(row).join('') + '</div>' : '<div class="panel empty">' + ic('q') + 'No questions flagged' + (f === 'all' ? '' : ' for this course') + '.</div>';
    if (qs.some(function (x) { return x.src === 'qb'; })) h += '<div class="row" style="margin-top:8px"><button class="btn sm danger" id="clrqb">' + ic('trash') + 'Clear auto-logged wrong answers</button></div>';
    h += '<div class="sec"><h2>Theory to revisit</h2><span class="sub">' + th.length + '</span></div>';
    h += th.length ? '<div class="mlist">' + th.map(row).join('') + '</div>' : '<div class="panel empty">' + ic('theory') + 'No theory or formulas flagged yet.</div>';
    view.innerHTML = h;
    $$('[data-mf]').forEach(function (b) { b.onclick = function () { var u = SR.get('ui', {}); u.mf = b.getAttribute('data-mf'); SR.set('ui', u); VIEWS.mistakes(); }; });
    $$('[data-unflag]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-unflag'); var meta = SR.flags.list().filter(function (x) { return x.id === id; })[0]; SR.flags.remove(id); rerender(); undoToast('Flag removed', function () { if (meta) { var m = Object.assign({}, meta); delete m.id; SR.flags.toggle(id, m); rerender(); } }); }; });
    $$('[data-clr]').forEach(function (b) { b.onclick = function () { var t = +b.getAttribute('data-clr'); var item = SR.qb.mistakes().filter(function (x) { return x.t === t; })[0]; SR.qb.removeMistake(t); rerender(); toast('Cleared from the log'); void item; }; });
    var cq = $('#clrqb'); if (cq) cq.onclick = function () { confirmSheet('Clear wrong answers?', 'This removes every auto-logged wrong answer' + (f === 'all' ? '' : ' for this course') + ' from the log. Flags stay.', 'Clear', function () { SR.qb.clearMistakes(f === 'all' ? null : function (x) { var tid = x.typeId || x.type || x.id || ''; return (x.course || tid.split('.')[0]) === f; }); rerender(); }, true); };
    cur.refresh = function () { rerender(); };
    if (!window.QB && qbHas('qb-core.js') && SR.qb.mistakes().length) loadBank().then(function () { if (cur.id === 'mistakes') rerender(); }).catch(function () {});
  };
  function undoToast(msg, undo) {
    var t = $('#toast'); t.innerHTML = esc(msg) + ' · <u style="cursor:pointer;pointer-events:auto" id="undo">Undo</u>'; t.style.pointerEvents = 'auto'; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); t.style.pointerEvents = ''; }, 3500);
    $('#undo').onclick = function () { t.classList.remove('show'); t.style.pointerEvents = ''; undo(); };
  }

  /* ------------------------------------------------------------ Exam mode */
  var ex = { sel: null, tick: 0 };
  function examState() { return SR.get('exam', {}); }
  function saveExam(st) { SR.set('exam', st); }
  function exElapsed(c) { var now = Date.now(); return (now - c.start - (c.pausedMs || 0) - (c.paused ? now - c.pausedAt : 0)) / 1000; }
  VIEWS.exam = function (arg) {
    var st = examState(), c = st.current;
    if (c) return examRunning(c);
    var m = /^review\/(.+)$/.exec(arg || ''); if (m) return examReview(m[1]);
    var pk = /^pick\/(\w+)/.exec(arg || ''); if (pk && D.papers.indexOf(pk[1]) >= 0) ex.sel = pk[1];
    var o = st.opts || { dur: 120, read: true, readMin: 10, n: 6, topics: {} };
    var h = '<p class="lede">Sit a paper under exam conditions. The questions open full screen with a timer; when you finish, the answers and marking guide open and the attempt is logged.</p>';
    h += '<div class="sec"><h2>1. Pick a paper</h2></div><div class="papers">' + D.papers.map(function (id) {
      var P = PK[id]; if (!P) return '';
      var at = attemptsOf(id);
      return '<button type="button" class="paper ' + P.course + (ex.sel === id ? ' sel' : '') + '" data-paper="' + id + '"><span class="tick">' + ic('check') + '</span><span class="chip">' + esc(COURSES[P.course].short) + ' · ' + id + '</span><b>' + esc(P.title) + '</b><span class="meta">' + esc(kindLabel(P.kind)) + (at.length ? ' · sat ' + at.length + '×' : '') + '</span></button>';
    }).join('') + '<button type="button" class="paper rev' + (ex.sel === 'set' ? ' sel' : '') + '" data-paper="set"><span class="tick">' + ic('check') + '</span><span class="chip">Question bank</span><b>Random set from the bank</b><span class="meta">N question types from topics you choose</span></button></div>';
    h += '<div id="setopts"' + (ex.sel === 'set' ? '' : ' hidden') + '><div class="sec"><h2>Topics for the random set</h2><span class="sub" id="setcnt"></span></div><div class="topicpick" id="tpick">' + D.tree.map(function (c) {
      return '<div class="cg">' + esc(c.title) + '</div>' + c.modules.filter(function (m) { return m.id !== 'xp'; }).map(function (m) { return m.topics.map(function (t) { var k = c.id + '.' + m.id + '.' + t.id; return '<label class="chk"><input type="checkbox" data-tp="' + k + '"' + (o.topics && o.topics[k] ? ' checked' : '') + '><span>' + esc(t.title) + ' <span class="muted mono" style="font-size:11.5px" data-tpn="' + k + '"></span></span></label>'; }).join(''); }).join('');
    }).join('') + '</div><div class="row" style="margin-top:8px"><button class="btn sm" id="tpall">Select all</button><button class="btn sm" id="tpnone">Clear</button></div></div>';
    h += '<div class="sec"><h2>2. Time</h2></div><div class="panel pad"><div class="opts">' +
      '<label class="field"><span>Writing time (minutes)</span><div class="stepper"><button class="btn" data-step="dur:-10" aria-label="10 minutes less">' + ic('minus') + '</button><input type="number" inputmode="numeric" id="odur" min="5" max="300" value="' + o.dur + '"><button class="btn" data-step="dur:10" aria-label="10 minutes more">' + ic('plus') + '</button></div></label>' +
      '<label class="field"><span>Reading time (minutes)</span><div class="stepper"><button class="btn" data-step="read:-5" aria-label="5 minutes less">' + ic('minus') + '</button><input type="number" inputmode="numeric" id="oread" min="0" max="30" value="' + (o.readMin == null ? 10 : o.readMin) + '"><button class="btn" data-step="read:5" aria-label="5 minutes more">' + ic('plus') + '</button></div></label>' +
      '<label class="chk"><input type="checkbox" id="oreadon"' + (o.read ? ' checked' : '') + '><span>Include reading time</span></label>' +
      '<label class="field" id="nfield"' + (ex.sel === 'set' ? '' : ' hidden') + '><span>Questions in the set</span><div class="stepper"><button class="btn" data-step="n:-1" aria-label="One fewer">' + ic('minus') + '</button><input type="number" inputmode="numeric" id="on" min="1" max="30" value="' + (o.n || 6) + '"><button class="btn" data-step="n:1" aria-label="One more">' + ic('plus') + '</button></div></label>' +
      '</div><p class="muted" style="margin:10px 0 0;font-size:14px">Warnings at 30, 10 and 5 minutes left. You can pause if you are interrupted.</p></div>';
    h += '<div class="row" style="margin-top:14px"><button class="btn ink" id="exgo" style="min-width:200px">' + ic('play') + 'Start</button><span class="muted" id="exsel">' + (ex.sel ? esc(ex.sel === 'set' ? 'Random set' : PK[ex.sel].title) : 'Pick a paper first') + '</span></div>';
    var at = (st.attempts || []).slice().sort(function (a, b) { return b.start - a.start; });
    h += '<div class="sec"><h2>History</h2><span class="sub">' + at.length + ' attempts</span></div>';
    h += at.length ? '<div class="hist">' + at.map(histRow).join('') + '</div>' : '<div class="panel empty">' + ic('exam') + 'No attempts yet.</div>';
    view.innerHTML = h;
    function opts() { var o2 = { dur: Math.max(5, +$('#odur').value || 120), readMin: Math.max(0, +$('#oread').value || 0), read: $('#oreadon').checked, n: Math.max(1, Math.min(30, +$('#on').value || 6)), topics: {} }; $$('[data-tp]').forEach(function (x) { if (x.checked) o2.topics[x.getAttribute('data-tp')] = 1; }); var s2 = examState(); s2.opts = o2; saveExam(s2); return o2; }
    $$('[data-paper]').forEach(function (b) { b.onclick = function () { ex.sel = b.getAttribute('data-paper'); $$('[data-paper]').forEach(function (x) { x.classList.toggle('sel', x === b); }); $('#setopts').hidden = ex.sel !== 'set'; $('#nfield').hidden = ex.sel !== 'set'; $('#exsel').textContent = ex.sel === 'set' ? 'Random set' : PK[ex.sel].title; if (ex.sel === 'set') countTopics(); }; });
    $$('[data-step]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); var p = b.getAttribute('data-step').split(':'), inp = { dur: '#odur', read: '#oread', n: '#on' }[p[0]]; var v = (+$(inp).value || 0) + (+p[1]); $(inp).value = Math.max(p[0] === 'read' ? 0 : 1, v); if (p[0] === 'read' && v > 0) $('#oreadon').checked = true; opts(); }; });
    ['#odur', '#oread', '#on', '#oreadon'].forEach(function (s) { $(s).onchange = opts; });
    $$('[data-tp]').forEach(function (x) { x.onchange = function () { opts(); countTopics(); }; });
    $('#tpall').onclick = function () { $$('[data-tp]').forEach(function (x) { x.checked = true; }); opts(); countTopics(); };
    $('#tpnone').onclick = function () { $$('[data-tp]').forEach(function (x) { x.checked = false; }); opts(); countTopics(); };
    $('#exgo').onclick = function () {
      if (!ex.sel) { toast('Pick a paper first'); return; }
      var o2 = opts();
      if (ex.sel === 'set') return startSet(o2);
      startExam({ paper: ex.sel, title: PK[ex.sel].title, course: PK[ex.sel].course }, o2);
    };
    bindHist();
    if (ex.sel === 'set') countTopics();
    if (pk) { var s = $('[data-paper="' + ex.sel + '"]'); if (s) s.scrollIntoView({ block: 'center' }); }
  };
  function countTopics() {
    loadBank().then(function (QB) {
      var by = {}; QB.types.forEach(function (t) { var k = t.course + '.' + t.module + '.' + t.topic; by[k] = (by[k] || 0) + 1; });
      $$('[data-tpn]').forEach(function (s) { var n = by[s.getAttribute('data-tpn')] || 0; s.textContent = n ? n + ' types' : 'none yet'; });
      var sel = 0; $$('[data-tp]').forEach(function (x) { if (x.checked) sel += by[x.getAttribute('data-tp')] || 0; });
      var c = $('#setcnt'); if (c) c.textContent = sel + ' types selected · ' + QB.types.length + ' in the bank';
    }).catch(function () { var c = $('#setcnt'); if (c) c.textContent = 'bank not available yet'; });
  }
  function startSet(o) {
    loadBank().then(function (QB) {
      var pool = QB.types.filter(function (t) { return o.topics[t.course + '.' + t.module + '.' + t.topic]; });
      if (!pool.length) { toast(QB.types.length ? 'Choose topics that have question types' : 'The bank has no question types yet'); return; }
      var pick = pool.slice().sort(function () { return Math.random() - 0.5; }).slice(0, o.n);
      var set = pick.map(function (t) { var seed = QB.newSeed ? QB.newSeed() : 1 + Math.floor(Math.random() * 999998); var v = t.variants && t.variants.length ? t.variants[Math.floor(Math.random() * t.variants.length)].id : null; return { id: t.id, seed: seed, variant: v, title: t.title, course: t.course, marks: t.marks || 0 }; });
      var courses = set.map(function (x) { return x.course; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      startExam({ paper: 'set', title: 'Random set · ' + set.length + ' questions', course: courses.length === 1 ? courses[0] : 'rev', set: set }, o);
      try { if (window.QBUI && QBUI.practice) QBUI.practice(set); } catch (e) {}
    }).catch(function (e) { toast('Question bank not available: ' + e.message, 3500); });
  }
  function startExam(meta, o) {
    var st = examState();
    st.current = Object.assign({ start: Date.now(), dur: o.dur * 60, read: o.read ? (o.readMin || 0) * 60 : 0, paused: false, pausedMs: 0, warned: [] }, meta);
    saveExam(st);
    ensureAudio();
    location.hash = '#exam';
    route();
  }
  function examRunning(c) {
    var h = '';
    if (c.paper === 'set') {
      h += '<p class="lede">Work through these in the bank. Your timer keeps running at the top while you switch tabs.</p><div class="qset">' + c.set.map(function (q) { return '<a class="' + (COURSES[q.course] ? q.course : 'rev') + '" href="#qb/' + esc(q.id) + '@' + q.seed + (q.variant ? ':' + esc(q.variant) : '') + '"><b>' + esc(q.title) + '</b>' + (q.marks ? '<span class="kind" style="margin-left:auto">' + q.marks + ' marks</span>' : '') + '</a>'; }).join('') + '</div>';
    } else {
      h += '<iframe class="exframe" id="exfr" src="' + packHref(c.paper).replace('.html', '.html?pm=q') + '" title="Questions"></iframe>';
    }
    view.innerHTML = h;
  }
  function finishExam() {
    var st = examState(), c = st.current; if (!c) return;
    var used = Math.max(0, exElapsed(c));
    confirmSheet('Finish ' + (c.paper === 'set' ? 'this set' : c.paper) + '?', 'Time used: <b>' + hms(used) + '</b> of ' + hm(c.read + c.dur) + '. The answers open next.', 'Finish and mark', function () {
      var s2 = examState(), c2 = s2.current; if (!c2) return;
      var used2 = Math.max(0, exElapsed(c2));
      var a = { id: 'a' + Date.now().toString(36), paper: c2.paper, title: c2.title, course: c2.course, start: c2.start, end: Date.now(), used: Math.round(used2), planned: c2.dur, read: c2.read, score: null, outOf: null, set: c2.set || null };
      s2.attempts = (s2.attempts || []).concat([a]); delete s2.current; saveExam(s2);
      location.hash = '#exam/review/' + a.id;
    });
  }
  function examReview(aid) {
    var st = examState(), a = (st.attempts || []).filter(function (x) { return x.id === aid; })[0];
    if (!a) { location.hash = '#exam'; return; }
    var h = '<div class="panel pad" style="display:grid;gap:10px;margin-bottom:12px"><div class="row" style="justify-content:space-between"><div><b>' + esc(a.title) + '</b><div class="kind">' + esc(fmtTs(a.start, true)) + ' · used ' + hms(a.used) + ' of ' + hm(a.planned + (a.read || 0)) + '</div></div><a class="btn sm" href="#exam">' + ic('back') + 'Exam mode</a></div>' +
      '<div class="row"><label class="field" style="width:120px"><span>Your mark</span><input type="number" inputmode="decimal" id="sc" value="' + (a.score == null ? '' : a.score) + '" placeholder="e.g. 42"></label><label class="field" style="width:120px"><span>Out of</span><input type="number" inputmode="decimal" id="so" value="' + (a.outOf == null ? '' : a.outOf) + '" placeholder="e.g. 60"></label><button class="btn ink" id="scsave" style="align-self:end">Save mark</button></div><span class="muted" style="font-size:14px">Self-mark with the guide below (optional). It is saved with this attempt in your history.</span></div>';
    if (a.paper === 'set') h += '<div class="qset">' + (a.set || []).map(function (q) { return '<a class="' + (COURSES[q.course] ? q.course : 'rev') + '" href="#qb/' + esc(q.id) + '@' + q.seed + (q.variant ? ':' + esc(q.variant) : '') + '"><b>' + esc(q.title) + '</b><span class="kind" style="margin-left:auto">show solution</span></a>'; }).join('') + '</div>';
    else h += '<iframe class="exframe" src="' + packHref(a.paper).replace('.html', '.html?pm=a') + '" title="Answers"></iframe>';
    view.innerHTML = h;
    $('#vtitle').textContent = 'Answers · ' + (a.paper === 'set' ? 'Random set' : a.paper);
    $('#scsave').onclick = function () { var s2 = examState(); (s2.attempts || []).forEach(function (x) { if (x.id === aid) { x.score = $('#sc').value === '' ? null : +$('#sc').value; x.outOf = $('#so').value === '' ? null : +$('#so').value; } }); saveExam(s2); toast('Mark saved'); };
  }
  function histRow(a) {
    var c = COURSES[a.course] ? a.course : 'rev';
    return '<div class="hi ' + c + '"><div><b>' + esc(a.title) + '</b><div class="meta">' + esc(fmtTs(a.start, true)) + ' · ' + hms(a.used) + ' used of ' + hm(a.planned + (a.read || 0)) + '</div><div class="row" style="margin-top:6px"><a class="btn sm" href="#exam/review/' + a.id + '">Answers &amp; mark</a><button class="btn sm ghost" data-delat="' + a.id + '">' + ic('trash') + 'Delete</button></div></div><div class="sc">' + (a.score != null ? esc(a.score) + (a.outOf ? '<span class="pct">/' + esc(a.outOf) + '</span><div class="pct">' + Math.round(100 * a.score / a.outOf) + '%</div>' : '') : '<span class="pct">no mark</span>') + '</div></div>';
  }
  function bindHist() { $$('[data-delat]').forEach(function (b) { b.onclick = function () { confirmSheet('Delete this attempt?', 'It is removed from your history.', 'Delete', function () { var s2 = examState(); s2.attempts = (s2.attempts || []).filter(function (x) { return x.id !== b.getAttribute('data-delat'); }); saveExam(s2); rerender(); }, true); }; }); }
  var actx = null;
  function ensureAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
  function beep(n) {
    if (!actx) return; try {
      for (var i = 0; i < n; i++) { var o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); var t0 = actx.currentTime + i * 0.28; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2); o.start(t0); o.stop(t0 + 0.22); }
    } catch (e) {}
  }
  function renderExamBar() {
    var c = examState().current, b = $('#exambar');
    clearInterval(ex.tick);
    if (!c) { b.hidden = true; b.innerHTML = ''; return; }
    b.hidden = false;
    b.innerHTML = '<div><div class="ph" id="exph"></div><div class="tm" id="extm" aria-live="off"></div></div><div class="nm">' + esc(c.title) + '</div>' +
      (cur.id !== 'exam' ? '<a class="btn sm" href="#exam">Questions</a>' : '') +
      '<button class="btn sm" id="expause">' + ic(c.paused ? 'play' : 'pause') + (c.paused ? 'Resume' : 'Pause') + '</button><button class="btn sm fin" id="exfin">' + ic('stop') + 'Finish</button><div class="prog"><i id="exprog"></i></div>';
    $('#expause').onclick = function () { var s = examState(), cc = s.current; if (!cc) return; if (cc.paused) { cc.pausedMs = (cc.pausedMs || 0) + (Date.now() - cc.pausedAt); cc.paused = false; } else { cc.paused = true; cc.pausedAt = Date.now(); } saveExam(s); ensureAudio(); renderExamBar(); };
    $('#exfin').onclick = finishExam;
    function tick() {
      var s = examState(), cc = s.current; if (!cc) { renderExamBar(); return; }
      var el = exElapsed(cc), reading = el < cc.read;
      var left = reading ? cc.read - el : cc.read + cc.dur - el;
      $('#exph').textContent = cc.paused ? 'Paused' : reading ? 'Reading time' : left >= 0 ? 'Time left' : 'Over time';
      $('#extm').textContent = (left < 0 ? '+' : '') + hms(Math.abs(left));
      $('#exprog').style.width = Math.min(100, 100 * el / (cc.read + cc.dur)) + '%';
      b.classList.toggle('paused', !!cc.paused);
      b.classList.toggle('over', !reading && left < 0);
      b.classList.toggle('warn', !reading && left >= 0 && left <= 300);
      if (!reading && !cc.paused) {
        [30, 10, 5].forEach(function (m) {
          if (left <= m * 60 && left > m * 60 - 90 && (cc.warned || []).indexOf(m) < 0) {
            cc.warned = (cc.warned || []).concat([m]); saveExam(s); toast(m + ' minutes left', 5000); beep(m === 5 ? 3 : m === 10 ? 2 : 1); if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate([200, 100, 200]); } catch (e) {}
          }
        });
        if (cc.read && el >= cc.read && el < cc.read + 2 && (cc.warned || []).indexOf('w') < 0) { cc.warned = (cc.warned || []).concat(['w']); saveExam(s); toast('Reading time over. Start writing.', 4000); beep(1); }
        if (left <= 0 && (cc.warned || []).indexOf(0) < 0) { cc.warned = (cc.warned || []).concat([0]); saveExam(s); toast('Time is up', 5000); beep(4); }
      }
    }
    tick(); ex.tick = setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------ Search */
  var GR = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'Γ': 'gamma', 'δ': 'delta', 'Δ': 'delta', 'ε': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'Θ': 'theta', 'κ': 'kappa', 'λ': 'lambda', 'Λ': 'lambda', 'µ': 'mu', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'π': 'pi', 'Π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'Σ': 'sigma', 'τ': 'tau', 'φ': 'phi', 'ϕ': 'phi', 'Φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'Ψ': 'psi', 'ω': 'omega', 'Ω': 'omega' };
  var GRN = {}; Object.keys(GR).forEach(function (k) { (GRN[GR[k]] = GRN[GR[k]] || []).push(k); });
  var GRRE = new RegExp('[' + Object.keys(GR).join('') + ']', 'g');
  function norm(s) { return String(s || '').replace(GRRE, function (c) { return GR[c]; }).toLowerCase().replace(/[{}$\\]/g, '').replace(/[−–—]/g, '-').replace(/[’‘]/g, "'"); }
  function termRe(t) {
    var src = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    Object.keys(GRN).sort(function (a, b) { return b.length - a.length; }).forEach(function (n) { if (src.indexOf(n) >= 0) src = src.split(n).join('(?:' + n + '|' + GRN[n].join('|') + ')'); });
    src = src.replace(/_/g, '_?\\{?');
    return src;
  }
  function loadIndex() {
    if (IDX) return Promise.resolve(IDX);
    return fetch('search-index.json').then(function (r) { return r.json(); }).then(function (j) {
      IDX = j.items.map(function (it) { return { p: it[0], a: it[1], k: it[2], x: it[3], c: it[4], nx: norm(it[3]), nc: norm(it[4]) }; });
      D.packs.forEach(function (p) { IDX.push({ p: p.id, a: '', k: 'pk', x: p.id + ' · ' + p.title, c: subjName(p.s) + ' · ' + p.code, nx: norm(p.id + ' ' + p.title + ' ' + p.code), nc: '' }); });
      return IDX;
    });
  }
  function bankItems() {
    if (!window.QB || !QB.types) return [];
    if (bankItems._n === QB.types.length) return bankItems._c;
    bankItems._n = QB.types.length;
    bankItems._c = QB.types.map(function (t) { var tp = QB.topicOf ? QB.topicOf(t) : null; var s = t.title + ' ' + (t.tags || []).join(' ') + ' ' + (t.variants || []).map(function (v) { return v.label; }).join(' '); return { p: '', a: '', k: 'qb', id: t.id, course: t.course, x: t.title, c: 'Question bank · ' + (tp ? tp.title : t.topic) + ((t.tags || []).length ? ' · ' + t.tags.join(', ') : ''), nx: norm(s), nc: norm(tp ? tp.title : '') }; });
    return bankItems._c;
  }
  var KW = { h: 7, q: 4, f: 4, r: 3, pk: 9, qb: 5, t: 1, p: 0 };
  function doSearch(q) {
    var terms = norm(q).split(/\s+/).filter(Boolean); if (!terms.length) return [];
    var phrase = terms.join(' ');
    var res = [];
    (IDX || []).concat(bankItems()).forEach(function (it) {
      var sc = 0;
      for (var i = 0; i < terms.length; i++) {
        var tm = terms[i], j = it.nx.indexOf(tm), jc = it.nc.indexOf(tm);
        if (j < 0 && jc < 0) return;
        if (j >= 0) { var pre = j ? it.nx.charAt(j - 1) : ' '; sc += /[a-z0-9]/.test(pre) ? 1 : 4; var post = it.nx.charAt(j + tm.length); if (!/[a-z0-9]/.test(post)) sc += 2; }
        else sc += 1;
      }
      if (terms.length > 1 && it.nx.indexOf(phrase) >= 0) sc += 6;
      sc += KW[it.k] || 0;
      sc -= Math.min(3, it.x.length / 160);
      res.push([sc, it]);
    });
    res.sort(function (a, b) { return b[0] - a[0]; });
    return res;
  }
  function hilite(text, q) {
    var terms = norm(q).split(/\s+/).filter(Boolean); if (!terms.length) return esc(text);
    var re; try { re = new RegExp(terms.map(termRe).join('|'), 'gi'); } catch (e) { return esc(text); }
    var out = '', last = 0, m, guard = 0;
    while ((m = re.exec(text)) && guard++ < 200) { if (!m[0].length) { re.lastIndex++; continue; } out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
    return out + esc(text.slice(last));
  }
  function snippet(text, q) {
    if (text.length <= 230) return text;
    var terms = norm(q).split(/\s+/).filter(Boolean), nt = norm(text), j = -1;
    terms.forEach(function (t) { var k = nt.indexOf(t); if (k >= 0 && (j < 0 || k < j)) j = k; });
    if (j < 90) return text.slice(0, 220) + '…';
    var s = Math.max(0, j - 80); return '…' + text.slice(s, s + 220) + (s + 220 < text.length ? '…' : '');
  }
  var KL = { h: 'Heading', q: 'Question', f: 'Formula', r: 'Ref sheet', p: '', t: 'Table', pk: 'Pack', qb: 'Bank' };
  VIEWS.search = function (arg, same) {
    var q = decodeURIComponent((arg.match(/q=([^&]*)/) || [])[1] || '');
    if (same && $('#sq')) { return; }
    view.innerHTML = '<div class="sbox"><input type="search" id="sq" placeholder="Search packs, formulas, questions and the bank" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="' + esc(q) + '" aria-label="Search"></div><div id="sout"></div>';
    var inp = $('#sq'), out = $('#sout'), t = 0;
    function run() {
      var v = inp.value.trim();
      try { history.replaceState(null, '', '#search' + (v ? '?q=' + encodeURIComponent(v) : '')); } catch (e) {}
      if (!v) { out.innerHTML = '<div class="sec"><h2>Try</h2></div><div class="sugg">' + ['slip', 'CMRR', 'ROC', 'bilinear', 'tau', 'n_s', 'Zener', 'per-unit', 'overlap-save', 'r_e'].map(function (s) { return '<button data-sg="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div><p class="lede" style="margin-top:14px">Maths is searchable as text: “tau” and “τ” both work, and so does “n_s”.</p>'; $$('[data-sg]').forEach(function (b) { b.onclick = function () { inp.value = b.getAttribute('data-sg'); run(); }; }); return; }
      if (!IDX) { out.innerHTML = '<div class="empty">Loading the index…</div>'; return; }
      var r = doSearch(v), top = r.slice(0, 80);
      out.innerHTML = '<div class="sec"><h2>' + r.length + ' result' + (r.length === 1 ? '' : 's') + '</h2>' + (r.length > 80 ? '<span class="sub">showing the best 80</span>' : '') + '</div>' + (top.length ? '<div class="sres">' + top.map(function (x) {
        var it = x[1], P = PK[it.p], cls = it.k === 'qb' ? (it.course || 'rev') : P ? P.course : 'rev';
        var href = it.k === 'qb' ? '#qb/' + it.id : packHref(it.p, it.a);
        return '<a class="sr-it k-' + it.k + ' ' + cls + '" href="' + esc(href) + '"><div class="h"><span class="chip">' + esc(it.k === 'qb' ? 'Bank' : it.p) + '</span>' + (KL[it.k] ? '<span class="kind">' + KL[it.k] + '</span>' : '') + '<span class="ctx">' + esc(it.c || (P ? P.title : '')) + '</span></div><div class="x">' + hilite(snippet(it.x, v), v) + '</div></a>';
      }).join('') + '</div>' : '<div class="panel empty">' + ic('search') + 'Nothing found for “' + esc(v) + '”.</div>');
    }
    inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 90); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { inp.blur(); } });
    run();
    loadIndex().then(function () { run(); });
    if (qbHas('qb-core.js') && !window.QB) loadBank().then(function () { if (cur.id === 'search') run(); }).catch(function () {});
    setTimeout(function () { if (!('ontouchstart' in window) || !q) try { inp.focus(); } catch (e) {} }, 50);
  };

  /* ------------------------------------------------------------ Flashcards */
  var fc = null;
  function typeset(el) {
    if (window.MathJax && MathJax.typesetPromise) { try { if (MathJax.typesetClear) MathJax.typesetClear([el]); } catch (e) {} return MathJax.typesetPromise([el]).catch(function () {}); }
    if (!typeset._w) { typeset._w = 1; var s = $('#mjx'); if (s) s.addEventListener('load', function () { var c = $('.fc'); if (c && window.MathJax && MathJax.startup) MathJax.startup.promise.then(function () { typeset(c); }); }); }
    return Promise.resolve();
  }
  function deckLists() {
    var by = {}; CARDS.forEach(function (c) { (by[c.p] = by[c.p] || []).push(c); }); return by;
  }
  VIEWS.cards = function (arg) {
    if (!CARDS) { view.innerHTML = '<div class="empty">Loading cards…</div>'; loadCards().then(function () { if (cur.id === 'cards') VIEWS.cards(arg); }); return; }
    var m = /^study\/(.+)$/.exec(arg || '');
    if (m) return studyDeck(m[1]);
    var by = deckLists(), all = cardsDue(CARDS);
    var h = '<p class="lede">Cards come from every pack’s quick-recall check and its reference-sheet formula lines. Spaced repetition: <b>Again</b> brings a card back in a minute, <b>Good</b> and <b>Easy</b> push it out to days or weeks.</p>';
    h += '<div class="panel pad row" style="justify-content:space-between"><div><b style="font-size:20px">' + all.due + ' due</b> <span class="muted">· ' + all.nw + ' new · ' + CARDS.length + ' cards</span></div><a class="btn ink" href="#cards/study/all">' + ic('play') + (all.due ? 'Review all due' : 'Study new cards') + '</a></div>';
    D.tree.concat([{ id: 'rev', title: 'Review days' }]).forEach(function (c) {
      var packs = D.packs.filter(function (p) { return p.course === c.id && by[p.id]; });
      if (!packs.length) return;
      var cc = []; packs.forEach(function (p) { cc = cc.concat(by[p.id]); });
      var cd = cardsDue(cc);
      h += '<div class="sec"><h2 class="' + c.id + '" style="color:var(--c)">' + esc(c.title) + '</h2><span class="sub">' + cc.length + ' cards</span></div>';
      h += '<div class="decks"><div class="deck ' + c.id + '"><div><b>All ' + esc(COURSES[c.id].short) + ' cards</b><span class="meta">recall + formulas</span></div><div class="cnts"><span class="due" title="due">' + cd.due + '</span><span class="new" title="new">' + cd.nw + '</span></div><a class="btn sm pri" href="#cards/study/c:' + c.id + '">Study</a></div></div>';
      h += '<details class="cdeck"><summary>' + ic('chev', ' style="width:18px;height:18px"') + 'By pack (' + packs.length + ')</summary><div class="decks">' + packs.map(function (p) {
        var d = cardsDue(by[p.id]);
        return '<div class="deck ' + p.course + '"><div><b>' + esc(p.id + ' · ' + p.title) + '</b><span class="meta">' + by[p.id].length + ' cards · ' + by[p.id].filter(function (x) { return x.k === 'recall'; }).length + ' recall</span></div><div class="cnts"><span class="due">' + d.due + '</span><span class="new">' + d.nw + '</span></div><a class="btn sm" href="#cards/study/p:' + p.id + '">Study</a></div>';
      }).join('') + '</div></details>';
    });
    h += '<p class="muted" style="font-size:13px;margin-top:16px"><span style="color:var(--danger);font-weight:700">red</span> = due now · <span style="color:var(--tip);font-weight:700">blue</span> = new</p>';
    view.innerHTML = h;
    cur.refresh = function () { rerender(); };
  };
  function studyDeck(spec) {
    var list = spec === 'all' ? CARDS : spec.indexOf('c:') === 0 ? CARDS.filter(function (c) { return c.c === spec.slice(2); }) : CARDS.filter(function (c) { return c.p === spec.slice(2); });
    var now = Date.now();
    var due = list.filter(function (c) { var s = SR.cards.get(c.id); return s && s.due <= now; }).sort(function (a, b) { return SR.cards.get(a.id).due - SR.cards.get(b.id).due; });
    var order = {}; D.packs.forEach(function (p, i) { order[p.id] = p.date + String(i).padStart(3, '0'); });
    var nw = list.filter(function (c) { return !SR.cards.get(c.id); }).sort(function (a, b) { return order[a.p] < order[b.p] ? -1 : order[a.p] > order[b.p] ? 1 : 0; }).slice(0, 20);
    var cram = false;
    var q = due.concat(nw);
    if (!q.length) { q = list.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 20); cram = true; }
    var name = spec === 'all' ? 'All decks' : spec.indexOf('c:') === 0 ? COURSES[spec.slice(2)].t : spec.slice(2) + ' · ' + (PK[spec.slice(2)] || {}).title;
    fc = { q: q, done: 0, total: q.length, name: name, cram: cram, shown: false, spec: spec };
    showCard();
  }
  function ivLabel(c, g) {
    var s = SR.cards.get(c.id) || { ef: 2.5, iv: 0, reps: 0 };
    if (g === 0) return '1 min';
    var iv;
    if (g === 1) iv = s.reps === 0 ? 0 : Math.max(1, Math.round(s.iv * 1.2));
    else if (g === 2) iv = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.iv * s.ef);
    else iv = s.reps === 0 ? 3 : Math.round(Math.max(s.iv, 1) * (s.ef + 0.15) * 1.3);
    return iv === 0 ? '10 min' : iv < 30 ? iv + ' d' : Math.round(iv / 30) + ' mo';
  }
  function showCard() {
    if (!fc) return;
    if (!fc.q.length) {
      view.innerHTML = '<div class="fc-wrap"><div class="panel pad empty">' + ic('check') + '<b style="font-size:20px;color:var(--fg)">Session done</b><br>' + fc.done + ' review' + (fc.done === 1 ? '' : 's') + ' in ' + esc(fc.name) + '.</div><div class="row" style="justify-content:center"><a class="btn ink" href="#cards">Back to decks</a></div></div>';
      fc = null; updateBadges(); return;
    }
    var c = fc.q[0], P = PK[c.p] || {}, st = SR.cards.get(c.id), mono = c.k === 'ref';
    var h = '<div class="fc-wrap"><div class="fc-top"><a class="btn sm" href="#cards">' + ic('back') + 'Decks</a><div class="bar"><i style="width:' + (100 * fc.done / Math.max(1, fc.done + fc.q.length)) + '%"></i></div><span class="pct">' + fc.q.length + ' left' + (fc.cram ? ' · practice' : '') + '</span></div>' +
      '<div class="fc ' + (P.course || 'rev') + '"><div class="lab"><span class="chip">' + esc(c.p) + ' · ' + (c.k === 'ref' ? 'Formula' : 'Recall') + '</span><span class="kind">' + (st ? (st.lapses ? st.lapses + ' lapses · ' : '') + 'seen ' + st.reps + '×' : 'new') + '</span></div>' +
      (c.h && c.k === 'ref' ? '<div class="ctx">' + esc(c.h) + '</div>' : '') +
      '<div class="q' + (mono ? ' mono' : '') + '">' + c.f + '</div>' +
      '<div class="a' + (mono ? ' mono' : '') + '" id="fcA"' + (fc.shown ? '' : ' hidden') + '>' + c.b + (c.ctx && c.ctx !== c.b ? '<div class="ctx" style="margin-top:8px">line: ' + c.ctx + '</div>' : '') + '<div style="margin-top:10px"><a class="sub mono" style="font-size:12px;color:var(--c)" href="' + packHref(c.p, c.a) + '">Open in ' + esc(c.p) + ' →</a></div></div></div>' +
      (fc.shown ? '<div class="grades">' + ['Again', 'Hard', 'Good', 'Easy'].map(function (n, i) { return '<button class="gr' + i + '" data-g="' + i + '">' + n + '<span>' + ivLabel(c, i) + '</span></button>'; }).join('') + '</div><div class="kbd">keys 1 – 4</div>'
        : '<button class="btn ink showans" id="fcshow">Show answer</button><div class="kbd">space to show</div>') + '</div>';
    view.innerHTML = h;
    typeset($('.fc'));
    var sb = $('#fcshow'); if (sb) sb.onclick = function () { fc.shown = true; showCard(); };
    $$('[data-g]').forEach(function (b) { b.onclick = function () { grade(+b.getAttribute('data-g')); }; });
  }
  function grade(g) {
    if (!fc || !fc.q.length) return;
    var c = fc.q.shift();
    var s = fc.cram && SR.cards.get(c.id) && g > 0 ? SR.cards.get(c.id) : SR.cards.review(c.id, g);
    fc.done++;
    if (g === 0) fc.q.splice(Math.min(3, fc.q.length), 0, c);
    else if (s && s.iv === 0 && !fc.cram) fc.q.push(c);
    fc.shown = false; showCard();
  }
  document.addEventListener('keydown', function (e) {
    if (cur.id !== 'cards' || !fc || !sheetEl.hidden || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
    if (!fc.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); fc.shown = true; showCard(); }
    else if (fc.shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); grade(+e.key - 1); }
  });
  function loadCards() { if (CARDS) return Promise.resolve(CARDS); return fetch('cards.json').then(function (r) { return r.json(); }).then(function (j) { CARDS = j.cards; updateBadges(); return CARDS; }).catch(function () { CARDS = []; return CARDS; }); }

  /* ------------------------------------------------------------ Settings */
  VIEWS.settings = function () {
    var th = SR.get('theme', 'auto');
    var h = '<div class="set">';
    h += '<div class="panel pad"><h3>Appearance</h3><div class="seg" style="width:max-content">' + [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(function (x) { return '<button data-th="' + x[0] + '" class="' + (th === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="panel pad"><h3>Your data</h3><p>Everything (tracker, flags, mistakes, flashcards, exam history) is stored on this device only, in this browser. Export it regularly.</p>' +
      '<div class="note"><b>Back it up:</b> export now and then and save the file to your OneDrive (for example <span class="mono">OneDrive/Study/</span>). To move to your laptop, export here and import there; import merges, newest wins.</div>' +
      '<div class="row"><button class="btn ink" id="exp">' + ic('download') + 'Export my data</button><label class="btn" for="impf">' + ic('share') + 'Import…</label><input type="file" id="impf" accept="application/json,.json" hidden><button class="btn danger" id="rst">' + ic('trash') + 'Reset…</button></div><dl class="kv" id="dstats"></dl></div>';
    h += '<div class="panel pad"><h3>Offline</h3><p>Pages you open are saved automatically. To be safe before the exams, save everything now (do it on Wi-Fi).</p>' +
      '<dl class="kv"><dt>Offline support</dt><dd id="swst">checking…</dd><dt>Storage</dt><dd id="stor">…</dd></dl>' +
      '<label class="chk"><input type="checkbox" id="wpdf"><span>Include the PDFs (' + (D.pdfBytes / 1048576).toFixed(0) + ' MB more)</span></label>' +
      '<div class="row"><button class="btn ink" id="dl">' + ic('download') + 'Download everything for offline</button><span class="muted" id="dlsz">packs ' + (D.packBytes / 1048576).toFixed(0) + ' MB + bank + fonts</span></div><div class="progressline" id="dlp" hidden><div class="bar"><i id="dlbar" style="width:0"></i></div><span class="pct" id="dltxt"></span></div></div>';
    h += '<div class="panel pad"><h3>Install on iPad</h3><p>In Safari, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>. The app then opens full screen, without the browser bars, and works offline. On a laptop with Chrome or Edge, use the install icon in the address bar.</p></div>';
    h += '<div class="panel pad"><h3>About</h3><dl class="kv"><dt>Data version</dt><dd>' + esc(D.version) + '</dd><dt>Packs</dt><dd>' + D.packs.length + '</dd><dt>Flashcards</dt><dd>' + (CARDS ? CARDS.length : '…') + '</dd><dt>Bank files</dt><dd>' + esc((D.qbFiles || []).join(', ') || 'none yet') + '</dd><dt>Time zone</dt><dd>' + TZ + ' · today is ' + todayISO() + '</dd></dl></div>';
    h += '</div>';
    view.innerHTML = h;
    $$('[data-th]').forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-th'); SR.set('theme', v); if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); VIEWS.settings(); }; });
    function stats() { var raw = SR.exportJSON(), o = JSON.parse(raw); $('#dstats').innerHTML = '<dt>Tracker entries</dt><dd>' + Object.keys(o.tracker || {}).length + '</dd><dt>Flags</dt><dd>' + Object.keys(o.flags || {}).length + '</dd><dt>Bank mistakes</dt><dd>' + (o.mistakes || []).length + '</dd><dt>Cards reviewed</dt><dd>' + Object.keys(o.cards || {}).length + '</dd><dt>Exam attempts</dt><dd>' + ((o.exam || {}).attempts || []).length + '</dd><dt>Size</dt><dd>' + (raw.length / 1024).toFixed(1) + ' KB</dd>'; }
    stats();
    $('#exp').onclick = function () {
      var blob = new Blob([SR.exportJSON()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'study-data-' + todayISO() + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('Exported. Save it to OneDrive.');
    };
    $('#impf').onchange = function () {
      var f = this.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { try { JSON.parse(rd.result); SR.importJSON(rd.result); toast('Imported and merged'); stats(); updateBadges(); } catch (e) { toast('That file is not a Study export'); } };
      rd.readAsText(f); this.value = '';
    };
    $('#rst').onclick = function () { confirmSheet('Reset everything?', 'This deletes your tracker, flags, mistake log, flashcard progress and exam history on this device. Export first if you might want it back.', 'Reset all data', function () { SR.reset(); document.documentElement.removeAttribute('data-theme'); toast('All data reset'); VIEWS.settings(); updateBadges(); }, true); };
    swStatus(); storageEst();
    $('#dl').onclick = function () { downloadAll($('#wpdf').checked); };
  };
  function swStatus() {
    var el = $('#swst'); if (!el) return;
    if (!('serviceWorker' in navigator)) { el.textContent = 'not supported in this browser'; return; }
    navigator.serviceWorker.getRegistration().then(function (r) { if (!$('#swst')) return; el.textContent = r && r.active ? 'on (app shell saved)' : r ? 'installing…' : 'not registered'; });
  }
  function storageEst() {
    var el = $('#stor'); if (!el) return;
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { if ($('#stor')) el.textContent = (e.usage / 1048576).toFixed(0) + ' MB used of ' + (e.quota / 1048576 / 1024).toFixed(1) + ' GB available'; });
    else el.textContent = 'unknown';
  }
  async function downloadAll(withPdf) {
    if (!('caches' in window)) { toast('Offline storage is not available here'); return; }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    var jobs = [];
    D.packs.forEach(function (p) { if (!p.missing) jobs.push(['study-packs-v1', 'packs/' + p.id + '.html']); });
    jobs.push(['study-packs-v1', 'packs/index.html']);
    (D.qbFiles || []).forEach(function (f) { jobs.push(['study-rt-v1', 'qb/' + f]); });
    jobs.push(['study-rt-v1', 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg-full.js']);
    if (withPdf) { D.pdfs.forEach(function (f) { jobs.push(['study-pdf-v1', f]); }); D.combined.forEach(function (c) { jobs.push(['study-pdf-v1', c.file]); }); }
    var box = $('#dlp'), b = $('#dlbar'), tx = $('#dltxt'), btn = $('#dl'); if (box) box.hidden = false; if (btn) btn.disabled = true;
    var done = 0, fail = 0, bytes = 0, i = 0;
    async function worker() {
      while (i < jobs.length) {
        var j = jobs[i++];
        try {
          var u = new URL(j[1], location.href), cache = await caches.open(j[0]);
          var key = u.origin === location.origin ? u.origin + u.pathname : u.href;
          var r = await fetch(u.href, { cache: 'no-cache', mode: u.origin === location.origin ? 'same-origin' : 'cors' });
          if (!r.ok) throw new Error(r.status);
          var bl = await r.clone().blob(); bytes += bl.size;
          await cache.put(key, r);
        } catch (e) { fail++; }
        done++;
        if ($('#dlbar')) { b.style.width = (100 * done / jobs.length) + '%'; tx.textContent = done + ' / ' + jobs.length + ' files · ' + (bytes / 1048576).toFixed(0) + ' MB' + (fail ? ' · ' + fail + ' failed' : ''); }
      }
    }
    // fonts: fetch the CSS the page uses, then its font files
    try {
      var fl = $('link[href*="fonts.googleapis"]'); if (fl) { var fr = await fetch(fl.href); var css = await fr.clone().text(); var c = await caches.open('study-rt-v1'); await c.put(fl.href, fr); (css.match(/url\((https:[^)]+)\)/g) || []).forEach(function (m) { jobs.push(['study-rt-v1', m.slice(4, -1)]); }); }
    } catch (e) {}
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (btn) btn.disabled = false;
    toast(fail ? 'Saved with ' + fail + ' failures. Try again on Wi-Fi.' : 'Everything is saved for offline use', 3500);
    var s = SR.get('ui', {}); s.offlineAt = Date.now(); s.offlinePdf = withPdf; SR.set('ui', s);
    storageEst();
  }

  /* ------------------------------------------------------------ boot */
  function boot() {
    buildNav();
    fetch('data.json').then(function (r) { if (!r.ok) throw new Error('data.json ' + r.status); return r.json(); }).then(function (d) {
      D = d; D.packs.forEach(function (p) { PK[p.id] = p; });
      route(); updateBadges();
      loadCards().then(function () { if (cur.id === 'today') VIEWS.today(); });
    }).catch(function (e) { view.innerHTML = '<div class="empty">Could not load the app data (' + esc(e.message) + '). Run <code>sync.sh</code>, then reload.</div>'; });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').then(function (reg) { if (!reg) return;
        reg.addEventListener('updatefound', function () { var w = reg.installing; if (!w) return; w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) { w.postMessage('skipWaiting'); toast('Updated. New content loads next time.', 3000); } }); });
      }).catch(function (e) { console.warn('SW', e); });
    }
  }
  window.StudyApp = { route: route, views: VIEWS, nextUp: nextUp, doSearch: function (q) { return loadIndex().then(function () { return doSearch(q).slice(0, 20).map(function (x) { return { s: x[0], p: x[1].p, a: x[1].a, k: x[1].k, x: x[1].x.slice(0, 120) }; }); }); } };
  boot();
})();

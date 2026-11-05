/* fx-panel.js: "Formulas needed" button + panel. Global `SRFx`.
 *   SRFx.button(cardEl, onClick)  adds the ƒx button to a question card (top-right, under the flag and pen)
 *   SRFx.show({title, items:[{name, html?, tex?, note?}], empty?})
 *       opens the panel: a side panel on wide screens, a bottom sheet on phones.
 *       html = pre-rendered formula markup (packs); tex = rendered at runtime with MathJax (app).
 *   SRFx.hide()
 * The panel lives in <body> (not in the card), so it never disturbs drawings or layout.
 */
(function (G) {
  'use strict';
  if (G.SRFx) return;
  var doc = G.document, panel = null, cur = null;
  var CSS = [
    '.fxbtn{position:absolute;top:98px;right:6px;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;border:0;border-radius:10px;background:transparent;color:var(--muted,#777);cursor:pointer;z-index:4;font:italic 600 17px/1 Georgia,"Times New Roman",serif;-webkit-tap-highlight-color:transparent}',
    '.fxbtn:hover{background:var(--soft,rgba(127,127,127,.12));color:var(--c,#333)}',
    '.fxbtn.on{color:#fff;background:var(--c,#333)}',
    '.pm-body .fxbtn{top:52px}',
    '.fxp{position:fixed;z-index:70;background:var(--card,#fff);color:var(--fg,#1d1d22);border:1px solid var(--line,#d8d8de);box-shadow:0 10px 34px rgba(0,0,0,.2);display:flex;flex-direction:column;font:400 15px/1.45 var(--f-sans,system-ui,sans-serif)}',
    '.fxp[hidden]{display:none}',
    '.fxp header{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 16px;border-bottom:1px solid var(--line,#e2e2e8)}',
    '.fxp header .t{flex:1;min-width:0}',
    '.fxp header b{display:block;font:600 11px/1.2 var(--f-mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--c,#555)}',
    '.fxp header span{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.fxp header button{flex:none;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:inherit;font-size:22px;cursor:pointer}',
    '.fxp header button:hover{background:var(--soft,rgba(127,127,127,.12))}',
    '.fxp .fxl{overflow:auto;-webkit-overflow-scrolling:touch;padding:6px 14px 16px;flex:1}',
    '.fxp .fxi{padding:10px 0;border-bottom:1px solid var(--line,#ececf0)}',
    '.fxp .fxi:last-child{border-bottom:0}',
    '.fxp .fxn{display:flex;gap:8px;align-items:baseline;font-weight:600;font-size:13.5px;color:var(--muted,#555);margin-bottom:4px}',
    '.fxp .fxn i{font-style:normal;font:600 11px/1 var(--f-mono,ui-monospace,monospace);color:var(--c,#555);opacity:.8}',
    '.fxp .fxm{overflow-x:auto;overflow-y:hidden;padding:2px 0;text-align:left}',
    '.fxp .fxm svg{max-width:none}',
    '.fxp .fxm .mathd{display:block!important;text-align:left!important;margin:2px 0!important;padding:0!important;overflow:visible!important}',
    '.fxp .fxm mjx-container[display="true"]{margin:.2em 0!important;text-align:left!important}',
    '.fxp .fxo{font-size:13px;color:var(--muted,#666);margin-top:4px}',
    '.fxp .fxe{padding:18px 4px;color:var(--muted,#666)}',
    '@media (min-width:900px){.fxp{top:12px;right:12px;bottom:12px;width:min(380px,34vw);border-radius:16px}body.fx-open{padding-right:calc(min(380px,34vw) + 24px);box-sizing:border-box}body.fx-open .totop{right:calc(min(380px,34vw) + 36px)}}',
    '@media (max-width:899px){.fxp{left:0;right:0;bottom:0;max-height:52vh;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}}',
    '@media (max-width:899px){body.fx-open{padding-bottom:52vh}body.fx-open .inkbar{bottom:calc(52vh + 10px)}}',
    '@media (min-width:900px){body.fx-open .inkbar{bottom:max(14px,calc(env(safe-area-inset-bottom,0px) + 10px));left:calc(50% - 200px)}}',
    /* inside the app shell (body.fx-sheet) a side panel would squeeze the 3-column bank, so use a bottom sheet until the screen is very wide */
    '@media (min-width:900px) and (max-width:1499px){body.fx-sheet .fxp{top:auto;left:0;right:0;bottom:0;width:auto;max-height:46vh;border-radius:16px 16px 0 0}body.fx-sheet.fx-open{padding-right:0;padding-bottom:46vh}body.fx-sheet.fx-open .inkbar{bottom:calc(46vh + 10px);left:50%}body.fx-sheet.fx-open .totop{right:16px}}',
    '@media print{.fxbtn,.fxp{display:none!important}}'
  ].join('\n');
  function css() { if (doc.getElementById('fx-css')) return; var s = doc.createElement('style'); s.id = 'fx-css'; s.textContent = CSS; doc.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mk() {
    css();
    panel = doc.createElement('aside'); panel.className = 'fxp'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Formulas needed'); panel.setAttribute('data-ink-skip', '');
    panel.innerHTML = '<header><div class="t"><b>Formulas needed</b><span class="fxt"></span></div><button type="button" class="fxx" aria-label="Close formulas">×</button></header><div class="fxl"></div>';
    panel.querySelector('.fxx').addEventListener('click', hide);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel && !panel.hidden) hide(); });
    doc.body.appendChild(panel);
  }
  function hide() {
    var anchor = cur && cur.parentElement, t0 = anchor ? anchor.getBoundingClientRect().top : 0;
    if (panel) panel.hidden = true;
    doc.body.classList.remove('fx-open');
    if (anchor) { var t1 = anchor.getBoundingClientRect().top; if (Math.abs(t1 - t0) > 2) G.scrollBy(0, t1 - t0); }
    if (cur) { cur.classList.remove('on'); cur.setAttribute('aria-expanded', 'false'); cur = null; }
  }
  function show(o, btn) {
    if (!panel) mk();
    if (cur && cur !== btn) { cur.classList.remove('on'); cur.setAttribute('aria-expanded', 'false'); }
    cur = btn || null;
    if (cur) { cur.classList.add('on'); cur.setAttribute('aria-expanded', 'true'); }
    try { var c = btn && G.getComputedStyle(btn).getPropertyValue('--c').trim(); if (c) panel.style.setProperty('--c', c); } catch (e) {}
    panel.querySelector('.fxt').textContent = o.title || '';
    var L = panel.querySelector('.fxl'), h = '';
    if (!o.items || !o.items.length) h = '<div class="fxe">' + (o.empty || 'No formulas needed: this is a concept question.') + '</div>';
    else o.items.forEach(function (it, i) {
      h += '<div class="fxi"><div class="fxn"><i>' + (i + 1) + '</i>' + esc(it.name) + '</div><div class="fxm">' + (it.html || ('$$' + esc(it.tex) + '$$')) + '</div>' + (it.note ? '<div class="fxo">' + it.note + '</div>' : '') + '</div>';
    });
    L.innerHTML = h; L.scrollTop = 0;
    var anchor = btn && btn.parentElement, t0 = anchor ? anchor.getBoundingClientRect().top : 0;
    panel.hidden = false; doc.body.classList.add('fx-open');
    if (anchor) {
      var t1 = anchor.getBoundingClientRect().top; if (Math.abs(t1 - t0) > 2) G.scrollBy(0, t1 - t0);
      // bottom-sheet mode: make sure the question is not hidden behind the sheet
      var pr = panel.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      if (pr.left < 20 && ar.top > pr.top - 120) { anchor.style.scrollMarginTop = '84px'; try { anchor.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { anchor.scrollIntoView(true); } }
    }
    if (o.items && o.items.some(function (it) { return !it.html; }) && G.MathJax && G.MathJax.typesetPromise) { try { G.MathJax.typesetPromise([L]); } catch (e) {} }
  }
  function button(card, onClick) {
    css();
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'fxbtn'; b.setAttribute('data-ink-skip', '');
    b.innerHTML = 'ƒx'; b.title = 'Formulas needed'; b.setAttribute('aria-label', 'Show formulas needed'); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (cur === b && panel && !panel.hidden) hide(); else onClick(b); });
    card.appendChild(b);
    return b;
  }
  G.SRFx = { button: button, show: show, hide: hide };
})(window);

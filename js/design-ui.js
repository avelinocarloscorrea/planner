/* Planner Studio — js/design-ui.js
   Painéis de design com as peças do núcleo (as mesmas do Calendar e do
   Polaroide): Fundo das páginas (EPBackground — do documento ou só de uma
   seção), Marca d'água (EPWatermark) e Meus projetos (EPProjects).
   (parte de app; carregado depois de sheet-edit.js) */
"use strict";

const _designGate = EPStudio.gate(() => pushHistory('design'));
function designRefresh(live) { if (live) refreshWindow(true); else { svgCache.clear(); render(); save(); } if (typeof sheetEditor !== 'undefined') sheetEditor.refresh(); }
function setBackground(bg, live) { _designGate(live); state.settings.bg = EPBackground.clean(bg); designRefresh(live); if (!live) designSync(); }
function setSectionBackground(sec, bg, live) {
  _designGate(live);
  const b = EPBackground.clean(bg);
  if (b.kind === 'none') delete sec.opts.pageBg; else sec.opts.pageBg = b;
  designRefresh(live); if (!live) designSync();
}
function setWatermark(wm, live) { _designGate(live); state.settings.wm = EPWatermark.clean(wm); designRefresh(live); if (!live) designSync(); }
const designColors = () => { const s = state.settings; return [s.ink, s.accent, s.paperBg, mixHex(s.accent, s.paperBg, 0.5)]; };
const bgOpts = () => ({ get: () => state.settings.bg, set: setBackground, pickImage: cb => pickImage(cb), colors: designColors });
const wmOpts = () => ({ get: () => state.settings.wm, set: setWatermark, pickImage: cb => pickImage(cb), colors: designColors,
  ctx: () => ({ ink: state.settings.ink, fam: state.settings.headingFont }), coversLabel: 'Também na capa, divisórias e frases', defaultText: 'Esmeralda Paper' });

let _bgPanel = null, _wmPanel = null, _popPanel = null;
// fundo aberto a partir da folha: da seção tocada ou do documento inteiro
function openBackgroundPop(sec) {
  let target = sec && sec.opts && sec.opts.pageBg ? 'sec' : 'doc';
  EPStudio.pop({ id: 'bg', title: 'Fundo das páginas', build: host => {
    const draw = () => {
      host.innerHTML = sec ? `<div class="grp epbg-target"><button type="button" class="chip${target === 'doc' ? ' on' : ''}" data-t="doc">Todo o documento</button><button type="button" class="chip${target === 'sec' ? ' on' : ''}" data-t="sec">Só “${esc(sectionLabel(sec, []))}”</button></div>` : '';
      _popPanel = EPBackground.panel(host, target === 'sec'
        ? { ...bgOpts(), get: () => sec.opts.pageBg || { kind: 'none' }, set: (b, live) => setSectionBackground(sec, b, live) }
        : bgOpts());
      host.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { target = b.dataset.t; draw(); });
    };
    draw();
  }, onClose: () => { _popPanel = null; } });
}
function openWatermarkPop() { EPStudio.pop({ id: 'wm', title: "Marca d'água", build: h => { _popPanel = EPWatermark.panel(h, wmOpts()); }, onClose: () => { _popPanel = null; } }); }
function designSync() { [_bgPanel, _wmPanel, _popPanel].forEach(p => p && p.refresh()); }

(function initDesign() {
  const pane = document.querySelector('.pane[data-pane="estilo"]');
  if (pane && !$('#bgHost')) {
    const first = pane.querySelector('.grp-block');
    const bgb = document.createElement('div'); bgb.className = 'grp-block';
    bgb.innerHTML = '<div class="grp-title">Fundo das páginas</div><p class="hint">Vale para o documento todo. Para uma seção só, toque na página e use <b>Fundo</b>.</p><div id="bgHost"></div>';
    const wmb = document.createElement('div'); wmb.className = 'grp-block';
    wmb.innerHTML = '<div class="grp-title">Marca d\'água</div><div id="wmHost"></div>';
    (first || pane.lastElementChild).after(bgb, wmb);
    _bgPanel = EPBackground.panel($('#bgHost'), bgOpts());
    _wmPanel = EPWatermark.panel($('#wmHost'), wmOpts());
  }
  { const _sync = syncDocControls; syncDocControls = function () { _sync.apply(this, arguments); designSync(); }; }

  /* ---------- Meus projetos ---------- */
  EPProjects.init({
    app: 'plannerstudio', label: 'Planner Studio', toast,
    serialize: async () => JSON.stringify({ app: 'planner-studio', v: 1, state }),
    restore: async d => {
      const o = typeof d === 'string' ? JSON.parse(d) : d;
      state = migrate(o && o.state ? o.state : o);
      selId = state.sections[0] ? state.sections[0].id : null;
      past = []; future = []; histMeta = []; svgCache.clear(); currentPage = 0;
      if (typeof sheetEditor !== 'undefined') sheetEditor.clear();
      syncDocControls(); render(); save(); fit();
      if (typeof closeStart === 'function') closeStart();
      const ra = $('#resumeAsk'); if (ra && !ra.hidden) { ra.hidden = true; document.body.classList.remove('onboarding'); }
    },
    download: (d, name) => downloadBlob(new Blob([d], { type: 'application/json' }), (String(name || 'planner').replace(/[^\wÀ-ÿ .-]/g, '').trim() || 'planner') + '.json'),
    hasContent: () => state.sections.length > 0,
    docName: () => docName(),
    thumb: async () => { const pages = expand(); if (!pages.length) return ''; await EPArt.ensure(usedArtIds(state)).catch(() => {}); return EPStudio.svgToDataURL(exportPageSVG(pages, 0, pages.length), 300); },
  });
  { const _save = save; save = function () { _save.apply(this, arguments); EPProjects.changed(); }; }
  const menuClose = () => { const m = $('#menu'); if (m) m.hidden = true; if (typeof syncScrim === 'function') syncScrim(); };
  { const b = $('#m_projects'); if (b) b.onclick = () => { menuClose(); EPProjects.dialog(); }; }
  { const b = $('#m_saveLocal'); if (b) b.onclick = () => { menuClose(); if (!state.sections.length) { toast('Crie um documento primeiro.'); return; } EPProjects.save(); }; }
  { const b = $('#m_new'); if (b) b.addEventListener('click', () => setTimeout(() => { if (!past.length) EPProjects.detach(); }, 0)); }
  { const b = $('#mx_projects'); if (b) b.onclick = () => EPProjects.dialog(); }
  { const h = $('#ob_projects'); if (h) EPProjects.strip(h); }
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (state.sections.length) EPProjects.save(); } });
  if (typeof injectIcons === 'function') injectIcons();
})();

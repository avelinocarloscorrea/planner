/* Planner Studio — js/sheet-edit.js
   Edição direta na folha (estilo Canva) em qualquer página: tocar/clicar num
   elemento seleciona; arrastar move; alças mudam o tamanho; tocar de novo
   digita ali mesmo; a barra de ícones faz o resto. Tocar na página sem
   elemento abre a barra "Adicionar" (texto, ilustração, imagem).
   Motor genérico em vendor/core/canvas-edit*.js (EPCanvasEdit).
   Os ajustes ficam em sec.opts.el[chave] e os elementos livres em
   sec.opts.extras (js/decor.js) — desenhados igual na tela e no PDF.
   Painel lateral e galeria de capas: js/sheet-panel.js.
   (parte de app; carregado depois de ui.js) */
"use strict";

// chave do elemento -> campo de texto da seção
const SHEET_TEXT_FIELD = { title: 'title', subtitle: 'subtitle', year: 'subtitle', owner: 'owner', name: 'owner', text: 'text', author: 'author', tagline: 'subtitle' };
const SHEET_TEXT_LABEL = { initial: 'Inicial', title: 'Título', subtitle: 'Subtítulo', year: 'Ano / destaque', owner: 'Nome (pertence a…)', name: 'Nome', text: 'Frase', author: 'Autor', tagline: 'Frase curta' };
const SHEET_ICON = {
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  art: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4-3-8-6-8-10a4 4 0 017.5-2A4 4 0 0120 10c0 4-4 7-8 10z"/><path d="M18 2.5l.8 1.7 1.7.8-1.7.8L18 7.5l-.8-1.7-1.7-.8 1.7-.8z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
  panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
};

function sheetPageInfo(pageEl) {
  if (!pageEl || pageEl.dataset.idx == null) return null;
  const idx = +pageEl.dataset.idx, pages = expand(), pd = pages[idx];
  if (!pd || pd.type === 'calibration' || pd.filler) return null;
  const sec = state.sections.find(x => x.id === pd.sectionId);
  return sec ? { idx, pd, sec, pages } : null;
}
const sheetExtra = (o, key) => key.startsWith('x:') ? (o.extras || []).find(z => 'x:' + z.id === key) : null;
function sheetFonts() {
  const F = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  return Object.entries(F).map(([v, f]) => ({ v, label: f.label.split(' — ')[0] }));
}
// redesenha as páginas montadas desta seção (os elementos valem para todas)
let _sheetRaf = 0;
function sheetRedraw(info, live) {
  const draw = () => {
    _sheetRaf = 0;
    const pages = expand(), total = pages.length;
    [...sheetsEl.children].forEach((el, i) => {
      if (!pages[i] || pages[i].sectionId !== info.sec.id || !el.dataset.sig) return;
      if (live && Math.abs(i - info.idx) > 1) return;          // ao vivo: só a página em edição e as vizinhas
      el.innerHTML = buildSVG(i, pages[i], total);
      el.dataset.sig = pageSig(i, pages[i]) + '|' + total;
    });
    if (!live) { save(); if (typeof fillRight === 'function' && curSection() && curSection().id === info.sec.id) { const a = document.activeElement; if (!(a && a.closest && a.closest('#right'))) fillRight(); } }
  };
  if (live) { if (!_sheetRaf) _sheetRaf = requestAnimationFrame(draw); }
  else { if (_sheetRaf) cancelAnimationFrame(_sheetRaf); draw(); }
}
function sheetReselect(idx, key) {
  sheetEditor.clear();
  setTimeout(() => { const pg = sheetsEl.querySelector(`.page[data-idx="${idx}"]`); if (pg) sheetEditor.select(pg, key); }, 40);
}

const sheetEditor = EPCanvasEdit.create({
  sheets: sheetsEl,
  zoom: () => zoom,
  isMobile: () => isMobile(),
  scroller: () => stage,
  fonts: sheetFonts(),
  addTools: [
    { a: 'text', label: 'Texto', icon: SHEET_ICON.text, title: 'Adicionar texto' },
    { a: 'art', label: 'Ilustração', icon: SHEET_ICON.art, title: 'Adicionar ilustração do catálogo' },
    { a: 'image', label: 'Imagem', icon: SHEET_ICON.image, title: 'Adicionar imagem do aparelho' },
    { a: 'panel', label: 'Ajustes', icon: SHEET_ICON.panel, title: 'Ajustes desta página' },
  ],
  add(pageEl, a) {
    const info = sheetPageInfo(pageEl); if (!info) return;
    if (a !== 'panel') { sheetAdd(a, info); return; }
    sheetEditor.clear();
    if (isMobile() && typeof mOpenTab === 'function') mOpenTab('secao');
    else { const r = $('#right'); if (r) r.scrollTop = 0; }
  },
  hits(pageEl) {
    const info = sheetPageInfo(pageEl); if (!info) return null;
    const [W, H] = paperWH(), hits = [];
    try { drawPageInto(SvgPen(W, H, {}), info.pd, info.idx, { screen: true, hits, total: info.pages.length }); } catch (e) { return null; }
    return { w: W, h: H, items: hits };
  },
  get(pageEl, key) {
    const info = sheetPageInfo(pageEl); if (!info) return null;
    const o = info.sec.opts, e = (o.el && o.el[key]) || {};
    const out = { dx: e.dx || 0, dy: e.dy || 0, s: e.s || 1, color: e.color || null, fam: e.fam || '', bold: e.bold == null ? null : e.bold };
    const x = sheetExtra(o, key);
    if (x) {
      if (x.type === 'text') { out.text = x.text; out.textLabel = 'Texto'; out.multiline = true; out.maxlength = 400; }
      out.removable = true; out.duplicable = true;
      out.canReplace = x.type !== 'text';
      if (x.type === 'art') { const it = EPArt.get(x.art); out.colorable = !it || it.mono; }
    } else if (SHEET_TEXT_FIELD[key]) {
      out.text = o[SHEET_TEXT_FIELD[key]] || ''; out.textLabel = SHEET_TEXT_LABEL[key];
      out.multiline = key === 'text'; out.maxlength = key === 'text' ? 400 : 80;
    }
    if (key === 'logo') out.canReplace = true;
    if (key === 'orn') out.colorable = true;
    if (key === 'bg') { out.canReplace = true; out.removable = true; }
    return out;
  },
  begin(pageEl, key) { pushHistory('sheet-' + key); },
  // foto de fundo da capa: enquadrar direto na folha
  photo(pageEl, key, win, tools) {
    const info = sheetPageInfo(pageEl); if (!info || key !== 'bg' || !info.sec.opts.bgSrc) return null;
    const [W, H] = paperWH(), o = info.sec.opts;
    return EPImgEdit.onSheet(win, tools, {
      src: o.bgSrc, edit: o.bgEdit, aspect: W / H, outMax: 2400,
      onHistoryPoint: () => pushHistory('sheet-bg'),
      onCommit: res => { o.bg = res.dataURL; o.bgEdit = res.edit; sheetRedraw(info, false); },
    });
  },
  set(pageEl, key, patch, opts) {
    const info = sheetPageInfo(pageEl); if (!info) return;
    const o = info.sec.opts;
    if ('text' in patch) {
      const x = sheetExtra(o, key);
      if (x) x.text = sanitizeText(patch.text, 400);
      else if (SHEET_TEXT_FIELD[key]) o[SHEET_TEXT_FIELD[key]] = sanitizeText(patch.text, key === 'text' ? 4000 : 80);
    }
    const geo = {};
    ['dx', 'dy', 's', 'color', 'fam', 'bold'].forEach(k => { if (k in patch) geo[k] = patch[k]; });
    if (Object.keys(geo).length) {
      o.el = o.el || {};
      const e = o.el[key] = { ...(o.el[key] || {}), ...geo };
      Object.keys(e).forEach(k => { if (e[k] === null || e[k] === '' || e[k] === undefined) delete e[k]; });
      delete e.hide;
    }
    sheetRedraw(info, opts && opts.live);
  },
  action(pageEl, key, name) {
    const info = sheetPageInfo(pageEl); if (!info) return;
    const o = info.sec.opts, x = sheetExtra(o, key);
    if (name === 'reset') { if (o.el) delete o.el[key]; }
    else if (name === 'hide') { o.el = o.el || {}; o.el[key] = { ...(o.el[key] || {}), hide: true }; toast('Elemento oculto — para mostrar de novo use “Elementos na folha” nos ajustes.'); }
    else if (name === 'delete' && key === 'bg') { delete o.bg; delete o.bgSrc; delete o.bgEdit; }
    else if (name === 'delete') { o.extras = (o.extras || []).filter(z => 'x:' + z.id !== key); if (o.el) delete o.el[key]; }
    else if (name === 'duplicate' && x) {
      const id = uid(), e = (o.el && o.el[key]) || {};
      o.extras = [...o.extras, { ...x, id }];
      o.el = { ...(o.el || {}), ['x:' + id]: { ...e, dx: (+e.dx || 0) + 8, dy: (+e.dy || 0) + 8 } };
      sheetRedraw(info, false);
      return 'x:' + id;
    }
    else if (name === 'image' && key === 'bg') {
      pickNewImage({ cb: res => {
        const [W, H] = paperWH();
        EPImgEdit.loadImage(res.photoSrc).then(im => {
          const [ow, oh] = W >= H ? [2400, Math.round(2400 * H / W)] : [Math.round(2400 * W / H), 2400];
          o.bgSrc = res.photoSrc; o.bgEdit = EPImgEdit.defaultEdit(); o.bg = EPImgEdit.bakeDataURL(im, o.bgEdit, ow, oh);
          sheetRedraw(info, false); sheetReselect(info.idx, 'bg');
        });
      } });
      return;
    }
    else if (name === 'image' && x && x.type === 'art') {
      EPArtPicker.open({ title: 'Trocar ilustração', current: x.art, onPick: id => {
        pushHistory('sheet-art'); x.art = id;
        EPArt.ensure([id]).then(() => { sheetRedraw(info, false); sheetReselect(info.idx, key); });
      } });
      return;
    }
    else if (name === 'image') {
      pickImage(src => {
        pushHistory('sheet-img');
        if (key === 'logo') o.logo = src; else if (x) x.src = src;
        sheetRedraw(info, false); sheetEditor.refresh();
      });
      return;
    }
    sheetRedraw(info, false);
  },
  colors() {
    const s = state.settings;
    return [...new Set([s.ink, s.accent, s.paperBg, '#1f2522', '#ffffff', mixHex(s.accent, s.paperBg, 0.5), '#8a2f2f', '#35594d', '#1f3a52', '#c9a24a', '#d98c9a'].map(c => c.toLowerCase()))];
  },
});

// adicionar texto / ilustração / imagem livre na seção (aparece em todas as páginas dela)
function sheetAdd(type, info) {
  const sec = info ? info.sec : curSection(); if (!sec || sec.type === 'calibration') return;
  const idx = info ? info.idx : expand().findIndex(p => p.sectionId === sec.id);
  const add = patch => {
    pushHistory('sheet-add');
    const id = uid();
    sec.opts.extras = [...(sec.opts.extras || []), { id, type, text: '', src: '', art: '', ...patch }];
    save(); refreshWindow(true);
    if (!info && idx >= 0) { if (isMobile() && typeof mOpenTab === 'function') mOpenTab('paginas'); gotoPage(idx); }
    sheetReselect(idx, 'x:' + id);
    if (typeof fillRight === 'function') fillRight();
    if (sec.count > 1) toast(`Aparece nas ${sec.count} páginas desta seção.`);
  };
  if (type === 'image') pickImage(src => add({ src }));
  else if (type === 'art') EPArtPicker.open({ title: 'Adicionar ilustração', onPick: id => EPArt.ensure([id]).then(() => add({ art: id })) });
  else add({ text: 'Seu texto' });
}

// ilustrações chegam sob demanda: redesenha quando uma categoria carrega
let _sheetArtT = 0;
EPArt.onLoad(() => { clearTimeout(_sheetArtT); _sheetArtT = setTimeout(() => { if (sheetsEl.children.length) { refreshWindow(true); sheetEditor.refresh(); } }, 30); });

// o editor acompanha os redesenhos da prancheta
{
  const _render = render;
  render = function () { _render.apply(this, arguments); sheetEditor.refresh(); };
  const _rw = refreshWindow;
  refreshWindow = function () { _rw.apply(this, arguments); if (!sheetEditor.isBusy()) sheetEditor.refresh(); };
  const _sel = selectSection;
  selectSection = function (id) {
    _sel.apply(this, arguments);
    const c = sheetEditor.current();
    if (c && (!id || (sheetPageInfo(c.page) || {}).sec?.id !== id)) sheetEditor.clear();
  };
  const _zoom = applyZoom;
  applyZoom = function () { _zoom.apply(this, arguments); if (sheetEditor.current()) sheetEditor.refresh(); };
}

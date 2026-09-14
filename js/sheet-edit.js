/* Planner Studio — js/sheet-edit.js
   Edição direta na folha (estilo Canva) para capa, divisória e frase:
   tocar/clicar num elemento seleciona; arrastar move; alças mudam o tamanho;
   barra com texto, fonte, cor, negrito, centralizar, restaurar e ocultar.
   Motor genérico em vendor/core/canvas-edit.js (EPCanvasEdit).
   Os ajustes ficam em sec.opts.el[chave] e textos/imagens livres em
   sec.opts.extras — desenhados pelas mesmas funções da tela e do PDF.
   (parte de app; carregado depois de ui.js) */
"use strict";

const SHEET_EDITABLE = { cover: true, tab: true, quote: true };
// chave do elemento -> campo de texto da seção
const SHEET_TEXT_FIELD = { title: 'title', subtitle: 'subtitle', year: 'subtitle', owner: 'owner', text: 'text', author: 'author' };
const SHEET_TEXT_LABEL = { title: 'Título', subtitle: 'Subtítulo', year: 'Ano / destaque', owner: 'Nome (pertence a…)', text: 'Frase', author: 'Autor' };

function sheetPageInfo(pageEl) {
  if (!pageEl || pageEl.dataset.idx == null) return null;
  const idx = +pageEl.dataset.idx, pages = expand(), pd = pages[idx];
  if (!pd || !SHEET_EDITABLE[pd.type]) return null;
  const sec = state.sections.find(x => x.id === pd.sectionId);
  return sec ? { idx, pd, sec, pages } : null;
}
function sheetFonts() {
  const F = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  return Object.entries(F).map(([v, f]) => ({ v, label: f.label.split(' — ')[0] }));
}
// redesenha só esta página (e as outras páginas da mesma seção que estiverem montadas)
let _sheetRaf = 0;
function sheetRedraw(info, live) {
  const draw = () => {
    _sheetRaf = 0;
    const pages = expand(), total = pages.length;
    [...sheetsEl.children].forEach((el, i) => {
      if (!pages[i] || pages[i].sectionId !== info.sec.id || !el.dataset.sig) return;
      el.innerHTML = buildSVG(i, pages[i], total);
      el.dataset.sig = pageSig(i, pages[i]) + '|' + total;
    });
    if (!live) { save(); if (typeof fillRight === 'function' && curSection() && curSection().id === info.sec.id) { const a = document.activeElement; if (!(a && a.closest && a.closest('#right'))) fillRight(); } }
  };
  if (live) { if (!_sheetRaf) _sheetRaf = requestAnimationFrame(draw); }
  else { if (_sheetRaf) cancelAnimationFrame(_sheetRaf); draw(); }
}

const sheetEditor = EPCanvasEdit.create({
  sheets: sheetsEl,
  zoom: () => zoom,
  isMobile: () => isMobile(),
  scroller: () => stage,
  fonts: sheetFonts(),
  hits(pageEl) {
    const info = sheetPageInfo(pageEl); if (!info) return null;
    const [W, H] = paperWH(), hits = [];
    const pen = SvgPen(W, H, {});
    try { drawPageInto(pen, info.pd, info.idx, { screen: true, hits, total: info.pages.length }); } catch (e) { return null; }
    return { w: W, h: H, items: hits };
  },
  get(pageEl, key) {
    const info = sheetPageInfo(pageEl); if (!info) return null;
    const o = info.sec.opts, e = (o.el && o.el[key]) || {};
    const out = { dx: e.dx || 0, dy: e.dy || 0, s: e.s || 1, color: e.color || null, fam: e.fam || '', bold: e.bold == null ? null : e.bold };
    if (key.startsWith('x:')) {
      const x = (o.extras || []).find(z => 'x:' + z.id === key);
      if (x && x.type === 'text') { out.text = x.text; out.textLabel = 'Texto'; out.multiline = true; }
      out.removable = true; out.canReplace = !!(x && x.type === 'image');
    } else if (SHEET_TEXT_FIELD[key]) {
      out.text = o[SHEET_TEXT_FIELD[key]] || ''; out.textLabel = SHEET_TEXT_LABEL[key]; out.multiline = key === 'text';
    }
    if (key === 'logo') out.canReplace = true;
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
      if (key.startsWith('x:')) { const x = (o.extras || []).find(z => 'x:' + z.id === key); if (x) x.text = sanitizeText(patch.text, 400); }
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
    const o = info.sec.opts;
    if (name === 'reset') { if (o.el) delete o.el[key]; }
    else if (name === 'hide') { o.el = o.el || {}; o.el[key] = { ...(o.el[key] || {}), hide: true }; toast('Elemento oculto — para mostrar de novo use “Elementos na folha” nos ajustes.'); }
    else if (name === 'delete' && key === 'bg') { delete o.bg; delete o.bgSrc; delete o.bgEdit; }
    else if (name === 'delete') { o.extras = (o.extras || []).filter(z => 'x:' + z.id !== key); if (o.el) delete o.el[key]; }
    else if (name === 'image' && key === 'bg') {
      pickNewImage({ cb: res => {
        const [W, H] = paperWH();
        EPImgEdit.loadImage(res.photoSrc).then(im => {
          const [ow, oh] = W >= H ? [2400, Math.round(2400 * H / W)] : [Math.round(2400 * W / H), 2400];
          o.bgSrc = res.photoSrc; o.bgEdit = EPImgEdit.defaultEdit(); o.bg = EPImgEdit.bakeDataURL(im, o.bgEdit, ow, oh);
          sheetRedraw(info, false); sheetEditor.clear(); setTimeout(() => sheetEditor.select(sheetsEl.children[info.idx], 'bg'), 50);
        });
      } });
      return;
    }
    else if (name === 'image') {
      pickImage(src => {
        pushHistory('sheet-img');
        if (key === 'logo') o.logo = src;
        else { const x = (o.extras || []).find(z => 'x:' + z.id === key); if (x) x.src = src; }
        sheetRedraw(info, false); sheetEditor.refresh();
      });
      return;
    }
    sheetRedraw(info, false);
  },
  colors(pageEl) {
    const s = state.settings;
    return [...new Set([s.ink, s.accent, s.paperBg, '#1f2522', '#ffffff', mixHex(s.accent, s.paperBg, 0.5), '#8a2f2f', '#35594d', '#1f3a52'].map(c => c.toLowerCase()))];
  },
});

// adicionar texto / imagem livre na página da seção selecionada
function sheetAdd(type) {
  const sec = curSection(); if (!sec || !SHEET_EDITABLE[sec.type]) return;
  const add = src => {
    pushHistory('sheet-add');
    const id = uid();
    sec.opts.extras = [...(sec.opts.extras || []), { id, type, text: type === 'text' ? 'Seu texto' : '', src: src || '' }];
    save(); refreshWindow(true);
    const pages = expand(), idx = pages.findIndex(p => p.sectionId === sec.id);
    const pg = sheetsEl.children[idx];
    if (pg) { if (isMobile() && typeof mOpenTab === 'function') mOpenTab('paginas'); gotoPage(idx); setTimeout(() => sheetEditor.select(pg, 'x:' + id), 60); }
    fillRight();
  };
  if (type === 'image') pickImage(src => add(src)); else add();
}
function sheetShowHidden(key) {
  const sec = curSection(); if (!sec || !sec.opts.el || !sec.opts.el[key]) return;
  pushHistory('sheet-show'); delete sec.opts.el[key].hide; save(); refreshWindow(true); fillRight();
}
function sheetResetAll() {
  const sec = curSection(); if (!sec) return;
  pushHistory('sheet-reset'); delete sec.opts.el; save(); refreshWindow(true); sheetEditor.refresh(); fillRight();
  toast('Posições, tamanhos e cores dos elementos restaurados.');
}

// bloco "Elementos na folha" no painel de ajustes da seção
{
  const _fill = fillRight;
  fillRight = function () {
    _fill.apply(this, arguments);
    const sec = curSection(), wrap = $('#rs_fields');
    const old = $('#rs_sheet'); if (old) old.remove();
    if (!sec || !wrap || !SHEET_EDITABLE[sec.type]) return;
    const el = sec.opts.el || {}, hidden = Object.keys(el).filter(k => el[k] && el[k].hide);
    const box = document.createElement('div');
    box.id = 'rs_sheet'; box.className = 'grp-block rs-sheet';
    box.innerHTML = `<div class="grp-title">Elementos na folha</div>
      <p class="hint">${isMobile() ? 'Toque' : 'Clique'} num texto ou imagem <b>na própria página</b> para mover, mudar tamanho, fonte e cor.</p>
      <div class="rs-sheet__acts"><button type="button" data-sa="text">＋ Texto</button><button type="button" data-sa="image">＋ Imagem</button></div>
      ${hidden.length ? `<div class="rs-sheet__hidden"><span class="fld-lbl">Ocultos</span>${hidden.map(k => `<button type="button" class="chip" data-show="${esc(k)}">Mostrar ${esc(SHEET_TEXT_LABEL[k] || (k === 'logo' ? 'logo' : k === 'monogram' ? 'monograma' : 'elemento'))}</button>`).join('')}</div>` : ''}
      ${Object.keys(el).length ? '<button type="button" class="ep-linkbtn" data-sa="reset">Restaurar posições e tamanhos</button>' : ''}`;
    wrap.prepend(box);
    // estilo da capa: galeria visual com a capa real em cada estilo (em vez de lista)
    const stSel = sec.type === 'cover' && $('#fld_style');
    if (stSel) {
      const lab = stSel.closest('label');
      const gal = document.createElement('div'); gal.className = 'cover-gal';
      const [W, H] = paperWH();
      gal.innerHTML = `<span class="fld-lbl">Estilo da capa</span><div class="cover-gal__grid">${[...stSel.options].map(op => {
        const opts = { ...sec.opts, style: op.value };
        const svg = withTemplateState({ settings: state.settings, sections: [{ type: 'cover', count: 1, opts }] }, () => { const pg = expand(); return pg.length ? exportPageSVG(pg, 0, 1) : ''; });
        return `<button type="button" class="cover-gal__it${op.value === stSel.value ? ' on' : ''}" data-st="${esc(op.value)}" title="${esc(op.textContent)}"><span class="cover-gal__pg" data-ar="${(W / H).toFixed(4)}">${svg}</span><span class="cover-gal__nm">${esc(op.textContent.replace(/\s*\(.*\)$/, ''))}</span></button>`;
      }).join('')}</div>`;
      gal.querySelectorAll('.cover-gal__pg').forEach(e => { e.style.aspectRatio = e.dataset.ar; });
      lab.hidden = true;
      lab.after(gal);
      gal.addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; gal.querySelectorAll('.cover-gal__it').forEach(x => x.classList.toggle('on', x === b)); stSel.value = b.dataset.st; stSel.dispatchEvent(new Event('change', { bubbles: true })); });
    }
    const typeRow = wrap.querySelector('label'); if (typeRow && typeRow.nextSibling) wrap.insertBefore(box, typeRow.nextSibling);
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sa === 'text' || b.dataset.sa === 'image') sheetAdd(b.dataset.sa);
      else if (b.dataset.sa === 'reset') sheetResetAll();
      else if (b.dataset.show) sheetShowHidden(b.dataset.show);
    });
  };
}

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

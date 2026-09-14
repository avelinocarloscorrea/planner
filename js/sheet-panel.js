/* Planner Studio — js/sheet-panel.js
   No painel de ajustes da seção: bloco "Elementos na folha" (adicionar texto,
   ilustração e imagem; mostrar ocultos; restaurar) e, na capa, a galeria
   visual de estilos com a capa real desenhada em cada um.
   (parte de app; carregado depois de sheet-edit.js) */
"use strict";

function sheetShowHidden(key) {
  const sec = curSection(); if (!sec || !sec.opts.el || !sec.opts.el[key]) return;
  pushHistory('sheet-show'); delete sec.opts.el[key].hide; save(); refreshWindow(true); fillRight();
}
function sheetResetAll() {
  const sec = curSection(); if (!sec) return;
  pushHistory('sheet-reset'); delete sec.opts.el; save(); refreshWindow(true); sheetEditor.refresh(); fillRight();
  toast('Posições, tamanhos e cores dos elementos restaurados.');
}
const SHEET_HIDDEN_LABEL = { logo: 'logo', monogram: 'monograma', initial: 'inicial', orn: 'enfeite' };

function coverGallery(sec, stSel) {
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
  gal.addEventListener('click', e => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    gal.querySelectorAll('.cover-gal__it').forEach(x => x.classList.toggle('on', x === b));
    stSel.value = b.dataset.st; stSel.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

{
  const _fill = fillRight;
  fillRight = function () {
    _fill.apply(this, arguments);
    const sec = curSection(), wrap = $('#rs_fields');
    const old = $('#rs_sheet'); if (old) old.remove();
    if (!sec || !wrap || sec.type === 'calibration') return;
    const el = sec.opts.el || {}, hidden = Object.keys(el).filter(k => el[k] && el[k].hide);
    const n = (sec.opts.extras || []).length;
    const box = document.createElement('div');
    box.id = 'rs_sheet'; box.className = 'grp-block rs-sheet';
    box.innerHTML = `<div class="grp-title">Elementos na folha${n ? ` <span class="rs-sheet__n">${n}</span>` : ''}</div>
      <p class="hint">${isMobile() ? 'Toque' : 'Clique'} <b>na própria página</b> para mover, aumentar, trocar fonte e cor — ou para adicionar.${sec.count > 1 ? ` O que adicionar aparece nas ${sec.count} páginas desta seção.` : ''}</p>
      <div class="rs-sheet__acts"><button type="button" data-sa="text">+ Texto</button><button type="button" data-sa="art">+ Ilustração</button><button type="button" data-sa="image">+ Imagem</button></div>
      ${hidden.length ? `<div class="rs-sheet__hidden"><span class="fld-lbl">Ocultos</span>${hidden.map(k => `<button type="button" class="chip" data-show="${esc(k)}">Mostrar ${esc(SHEET_TEXT_LABEL[k] || SHEET_HIDDEN_LABEL[k] || 'elemento')}</button>`).join('')}</div>` : ''}
      ${Object.keys(el).length ? '<button type="button" class="ep-linkbtn" data-sa="reset">Restaurar posições e tamanhos</button>' : ''}`;
    wrap.prepend(box);
    const stSel = sec.type === 'cover' && $('#fld_style');
    if (stSel) coverGallery(sec, stSel);
    const typeRow = wrap.querySelector('label'); if (typeRow && typeRow.nextSibling) wrap.insertBefore(box, typeRow.nextSibling);
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (['text', 'image', 'art'].includes(b.dataset.sa)) sheetAdd(b.dataset.sa);
      else if (b.dataset.sa === 'reset') sheetResetAll();
      else if (b.dataset.show) sheetShowHidden(b.dataset.show);
    });
  };
}

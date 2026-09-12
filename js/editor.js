/* Planner Studio — js/editor.js
   Construtor de páginas por blocos: o campo "Layout" no painel da seção
   "Página personalizada" e o editor de tela cheia (arrastar / redimensionar /
   propriedades). O desenho em si vem de vendor/core/blocks.js (EPBlocks) — aqui
   é só a interface. Também guarda "Meus modelos" no armazenamento local.
   (parte de app; carregado em ordem por index.html, depois de ui.js) */
"use strict";

/* ================= "Meus modelos" (localStorage + .json) ================= */
const MODELS_KEY = 'plannerstudio-models-v1';

function loadModels() {
  try {
    const a = JSON.parse(localStorage.getItem(MODELS_KEY) || '[]');
    return Array.isArray(a) ? a.map(m => EPBlocks.migrateModel(m)) : [];
  } catch (e) { return []; }
}
function persistModels(list) {
  try { localStorage.setItem(MODELS_KEY, JSON.stringify(list.slice(0, 80))); }
  catch (e) { toast('Não coube no armazenamento do navegador.'); }
}
function addModel(name, layout) {
  const list = loadModels();
  const m = EPBlocks.migrateModel({ name, layout, updated: new Date().toISOString().slice(0, 10) });
  list.unshift(m);
  persistModels(list);
  return m;
}
function deleteModel(id) { persistModels(loadModels().filter(m => m.id !== id)); }
function exportModel(m) {
  const name = String(m.name || 'modelo').replace(/[^\wÀ-ÿ .-]/g, '').trim() || 'modelo';
  downloadBlob(new Blob([JSON.stringify(m, null, 0)], { type: 'application/json' }), name + '.esmeralda-blocos.json');
}
function importModelFile(file, cb) {
  if (!file || file.size > 4 * 1024 * 1024) { toast('Arquivo inválido ou grande demais.'); return; }
  const fr = new FileReader();
  fr.onerror = () => toast('Não consegui ler o arquivo.');
  fr.onload = () => {
    try {
      const raw = JSON.parse(fr.result);
      const m = EPBlocks.migrateModel(raw);
      if (!m.layout.blocks.length) { toast('Esse arquivo não tem blocos.'); return; }
      const list = loadModels(); list.unshift(m); persistModels(list);
      toast('Modelo "' + m.name + '" importado.');
      cb && cb(m);
    } catch (e) { toast('Arquivo de modelo inválido.'); }
  };
  fr.readAsText(file);
}

/* ================= campo "Layout" no painel da seção ================= */
function mountLayoutField(host, sec) {
  if (!host) return;
  const layout = (sec.opts.layout && Array.isArray(sec.opts.layout.blocks)) ? sec.opts.layout : EPBlocks.emptyLayout();
  const n = layout.blocks.length;
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'lf-wrap';
  wrap.innerHTML =
    `<div class="lf-preview" id="lf_pv"></div>` +
    `<button type="button" class="wfull primary" id="lf_edit">${iconSVG('layout')} ${n ? 'Editar layout (' + n + ' bloco' + (n === 1 ? '' : 's') + ')' : 'Montar o layout'}</button>` +
    `<div class="lf-models">` +
      `<label>Meus modelos <select id="lf_models"></select></label>` +
      `<div class="lf-mrow">` +
        `<button type="button" id="lf_apply">Usar este</button>` +
        `<button type="button" id="lf_savem">Salvar atual…</button>` +
      `</div>` +
      `<div class="lf-mrow">` +
        `<button type="button" id="lf_import">Importar .json</button>` +
        `<button type="button" id="lf_exportm">Exportar</button>` +
        `<button type="button" id="lf_delm" class="danger">Apagar</button>` +
      `</div>` +
    `</div>` +
    `<p class="hint">Blocos posicionados em mm. Textos aceitam <b>{dia}</b>, <b>{mes}</b>, <b>{ano}</b>, <b>{semana_numero}</b>, <b>{pagina}</b>, <b>{secao}</b>, <b>{nome_dono}</b>, <b>{campo:chave}</b>…</p>`;
  host.appendChild(wrap);

  // miniatura
  try {
    const [W, H] = paperWH();
    const pen = SvgPen(W, H, { bg: state.settings.paperBg });
    const box = contentBox(0);
    if (n) EPBlocks.drawLayout(pen, box, layout, layoutCtx(sec, null));
    else pen.text('vazio', W / 2, H / 2, { size: 10, color: '#bbb', align: 'c', baseline: 'middle' });
    $('#lf_pv', wrap).innerHTML = pen.svg();
  } catch (e) { /* miniatura é opcional */ }

  $('#lf_edit', wrap).onclick = () => openBlockEditor(sec.id);

  // lista de modelos
  const msel = $('#lf_models', wrap);
  const refreshModels = () => {
    const list = loadModels();
    msel.innerHTML = list.length
      ? list.map(m => `<option value="${esc(m.id)}">${esc(m.name)} · ${m.layout.blocks.length} bloco(s)</option>`).join('')
      : '<option value="">— nenhum salvo —</option>';
  };
  refreshModels();
  $('#lf_apply', wrap).onclick = () => {
    const m = loadModels().find(x => x.id === msel.value); if (!m) { toast('Salve um modelo primeiro.'); return; }
    const s = curSection(); if (!s) return;
    pushHistory('custom-applyModel');
    s.opts.layout = EPBlocks.validateLayout(JSON.parse(JSON.stringify(m.layout)));
    svgCache.clear(); render(); save(); fillRight();
    toast('Modelo "' + m.name + '" aplicado.');
  };
  $('#lf_savem', wrap).onclick = () => {
    const s = curSection(); if (!s || !s.opts.layout || !s.opts.layout.blocks.length) { toast('Este layout está vazio.'); return; }
    const name = prompt('Nome do modelo:', s.opts.title || 'Meu modelo');
    if (name == null) return;
    const m = addModel(name, s.opts.layout);
    refreshModels(); msel.value = m.id;
    toast('Modelo "' + m.name + '" salvo neste navegador.');
  };
  $('#lf_exportm', wrap).onclick = () => {
    const m = loadModels().find(x => x.id === msel.value); if (!m) { toast('Nada para exportar.'); return; }
    exportModel(m);
  };
  $('#lf_delm', wrap).onclick = () => {
    const m = loadModels().find(x => x.id === msel.value); if (!m) return;
    if (confirm('Apagar o modelo "' + m.name + '"?')) { deleteModel(m.id); refreshModels(); toast('Modelo apagado.'); }
  };
  $('#lf_import', wrap).onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => { if (inp.files[0]) importModelFile(inp.files[0], () => { refreshModels(); }); };
    inp.click();
  };
}

/* contexto de desenho para a miniatura / editor (cores + variáveis) */
function layoutCtx(sec, date) {
  const s = state.settings;
  const ink = (sec && sec.opts && sec.opts.ink && HEX.test(sec.opts.ink)) ? sec.opts.ink : s.ink;
  return {
    S: s, ink,
    faint: mixHex(ink, s.paperBg, 0.60),
    hair: mixHex(ink, s.paperBg, 0.82),
    accent: s.accent,
    date: date || (sec && sec.opts.startDate ? parseYMD(sec.opts.startDate) : new Date(s.year, 0, 1)),
    weekStart: s.weekStart,
    highlightWeekends: s.highlightWeekends !== false,
    hfam: s.headingFont || 'sans',
    varPage: 1,
    varSection: (sec && sec.opts.title) || 'Seção',
    varOwner: (sec && sec.opts.owner) || '',
    varFields: (typeof parseVarFields === 'function') ? parseVarFields(sec && sec.opts.varFields) : {}
  };
}

/* ================= editor de tela cheia ================= */
let ed = null;   // { secId, layout, sel, scale, past, future, box:[w,h] }

function edSnap(v) { const g = ed.layout.grid || 5; return Math.round(v / g) * g; }
function edPush() {
  ed.past.push(JSON.stringify(ed.layout));
  if (ed.past.length > 80) ed.past.shift();
  ed.future.length = 0;
  edButtons();
}
function edUndo() { if (!ed.past.length) return; ed.future.push(JSON.stringify(ed.layout)); ed.layout = JSON.parse(ed.past.pop()); ed.sel = null; edRender(); edButtons(); }
function edRedo() { if (!ed.future.length) return; ed.past.push(JSON.stringify(ed.layout)); ed.layout = JSON.parse(ed.future.pop()); ed.sel = null; edRender(); edButtons(); }
function edButtons() {
  const u = $('#be_undo'), r = $('#be_redo');
  if (u) u.disabled = !ed.past.length;
  if (r) r.disabled = !ed.future.length;
}
function edSelBlock() { return ed.layout.blocks.find(b => b.id === ed.sel) || null; }

function openBlockEditor(secId) {
  const sec = state.sections.find(s => s.id === secId);
  if (!sec) return;
  const src = (sec.opts.layout && Array.isArray(sec.opts.layout.blocks)) ? sec.opts.layout : EPBlocks.emptyLayout();
  const [W, H] = paperWH();
  const box = contentBox(0);
  ed = {
    secId, sel: null, past: [], future: [],
    layout: EPBlocks.validateLayout(JSON.parse(JSON.stringify(src))),
    box: { w: box.w, h: box.h }, page: { W, H }, boxOff: { x: box.x, y: box.y }
  };

  const root = document.createElement('div');
  root.id = 'blockEditor';
  root.innerHTML =
    `<div class="be-bar">` +
      `<button id="be_done" class="primary">${iconSVG('check')} Concluir</button>` +
      `<button id="be_cancel" class="ghost">Cancelar</button>` +
      `<span class="be-sep"></span>` +
      `<label class="be-grid">Grade <select id="be_grid">` +
        [1, 2, 2.5, 5, 10].map(g => `<option value="${g}" ${g === (ed.layout.grid || 5) ? 'selected' : ''}>${g} mm</option>`).join('') +
      `</select></label>` +
      `<button id="be_add">${iconSVG('plus')} Bloco</button>` +
      `<span class="be-sep"></span>` +
      `<button id="be_undo" class="iconbtn" title="Desfazer">${iconSVG('undo')}</button>` +
      `<button id="be_redo" class="iconbtn" title="Refazer">${iconSVG('redo')}</button>` +
      `<span class="be-grow"></span>` +
      `<span class="be-hint" id="be_stat"></span>` +
    `</div>` +
    `<div class="be-body">` +
      `<div class="be-canvas" id="be_canvas"><div class="be-page" id="be_page"><div class="be-bg" id="be_bg"></div><div class="be-layer" id="be_layer"></div></div></div>` +
      `<aside class="be-props scrl" id="be_props"></aside>` +
    `</div>`;
  document.body.appendChild(root);
  document.body.classList.add('be-open');

  $('#be_done').onclick = edCommit;
  $('#be_cancel').onclick = edClose;
  $('#be_grid').onchange = e => { ed.layout.grid = +e.target.value || 5; edRender(); };
  $('#be_add').onclick = e => { e.stopPropagation(); edAddMenu(e.currentTarget); };
  $('#be_undo').onclick = edUndo;
  $('#be_redo').onclick = edRedo;
  $('#be_canvas').addEventListener('pointerdown', e => { if (e.target.id === 'be_canvas' || e.target.id === 'be_page' || e.target.id === 'be_bg') { ed.sel = null; edRenderProps(); edRenderLayer(); } });
  window.addEventListener('resize', edFit);
  document.addEventListener('keydown', edKey, true);

  edFit();
  edRender();
  edButtons();
}

function edClose() {
  if (!ed) return;
  window.removeEventListener('resize', edFit);
  document.removeEventListener('keydown', edKey, true);
  const r = $('#blockEditor'); if (r) r.remove();
  document.body.classList.remove('be-open');
  ed = null;
}
function edCommit() {
  const sec = state.sections.find(s => s.id === ed.secId);
  if (sec) {
    pushHistory('custom-layout');
    sec.opts.layout = EPBlocks.validateLayout(ed.layout);
    svgCache.clear(); render(); save();
    if (typeof fillRight === 'function') fillRight();
  }
  edClose();
  toast('Layout aplicado à seção.');
}

function edFit() {
  if (!ed) return;
  const c = $('#be_canvas'); if (!c) return;
  const availW = c.clientWidth - 48, availH = c.clientHeight - 48;
  const s = Math.max(0.4, Math.min(availW / (ed.box.w * MM), availH / (ed.box.h * MM), 6));
  ed.scale = s;
  const pg = $('#be_page');
  pg.style.width = (ed.box.w * MM * s) + 'px';
  pg.style.height = (ed.box.h * MM * s) + 'px';
  edRenderLayer();
}

/* px <-> mm no espaço da área útil */
function edPx(mm) { return mm * MM * ed.scale; }
function edMm(px) { return px / (MM * ed.scale); }

function edRender() {
  edRenderBg();
  edRenderLayer();
  edRenderProps();
  const st = $('#be_stat');
  if (st) st.textContent = ed.layout.blocks.length + ' bloco(s) · área útil ' + Math.round(ed.box.w) + '×' + Math.round(ed.box.h) + ' mm';
}
let _bgT = 0;
function edRenderBg() {
  clearTimeout(_bgT);
  _bgT = setTimeout(() => {
    const sec = state.sections.find(s => s.id === ed.secId);
    const pen = SvgPen(ed.box.w, ed.box.h, { bg: state.settings.paperBg });
    // grade de fundo
    const g = ed.layout.grid || 5;
    if (g >= 2) for (let gx = 0; gx <= ed.box.w + 0.01; gx += g) pen.line(gx, 0, gx, ed.box.h, { w: 0.08, color: '#d9d4c8' });
    if (g >= 2) for (let gy = 0; gy <= ed.box.h + 0.01; gy += g) pen.line(0, gy, ed.box.w, gy, { w: 0.08, color: '#d9d4c8' });
    try { EPBlocks.drawLayout(pen, { x: 0, y: 0, w: ed.box.w, h: ed.box.h }, ed.layout, layoutCtx(sec, null)); } catch (e) {}
    $('#be_bg').innerHTML = pen.svg();
  }, 40);
}
function edRenderLayer() {
  const layer = $('#be_layer'); if (!layer) return;
  layer.innerHTML = '';
  ed.layout.blocks.forEach(b => {
    const el = document.createElement('div');
    el.className = 'be-block' + (b.id === ed.sel ? ' sel' : '');
    el.dataset.id = b.id;
    el.style.left = edPx(b.x) + 'px';
    el.style.top = edPx(b.y) + 'px';
    el.style.width = edPx(b.w) + 'px';
    el.style.height = edPx(b.h) + 'px';
    el.innerHTML = `<span class="be-tag">${esc(EPBlocks.TYPES[b.type].label)}</span>` +
      (b.id === ed.sel ? '<span class="be-h be-h-e" data-h="e"></span><span class="be-h be-h-s" data-h="s"></span><span class="be-h be-h-se" data-h="se"></span>' : '');
    edBindBlock(el, b);
    layer.appendChild(el);
  });
}

function edBindBlock(el, b) {
  el.addEventListener('pointerdown', e => {
    if (e.button != null && e.button !== 0) return;
    e.stopPropagation();
    const handle = e.target.dataset ? e.target.dataset.h : null;
    ed.sel = b.id;
    edRenderLayer(); edRenderProps();
    const startX = e.clientX, startY = e.clientY;
    const o = { x: b.x, y: b.y, w: b.w, h: b.h };
    let moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    const move = ev => {
      const dxmm = edMm(ev.clientX - startX), dymm = edMm(ev.clientY - startY);
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 3) { moved = true; edPush(); }
      if (!moved) return;
      if (handle === 'e' || handle === 'se') b.w = clamp(edSnap(o.w + dxmm), 5, ed.box.w - b.x);
      if (handle === 's' || handle === 'se') b.h = clamp(edSnap(o.h + dymm), 5, ed.box.h - b.y);
      if (!handle) {
        b.x = clamp(edSnap(o.x + dxmm), 0, Math.max(0, ed.box.w - b.w));
        b.y = clamp(edSnap(o.y + dymm), 0, Math.max(0, ed.box.h - b.h));
      }
      // atualização barata: move só este div + redesenha bg com debounce
      el.style.left = edPx(b.x) + 'px'; el.style.top = edPx(b.y) + 'px';
      el.style.width = edPx(b.w) + 'px'; el.style.height = edPx(b.h) + 'px';
      edRenderBg();
    };
    const up = ev => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      try { el.releasePointerCapture(ev.pointerId); } catch (_) {}
      if (moved) { edRenderProps(); }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
}

function edKey(e) {
  if (!ed) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  if (e.key === 'Escape') { e.preventDefault(); if (ed.sel) { ed.sel = null; edRenderLayer(); edRenderProps(); } else edClose(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); edUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); edRedo(); return; }
  if (typing) return;
  const b = edSelBlock(); if (!b) return;
  const step = e.shiftKey ? 1 : (ed.layout.grid || 5);
  if (e.key === 'ArrowLeft') { edPush(); b.x = clamp(b.x - step, 0, ed.box.w - b.w); }
  else if (e.key === 'ArrowRight') { edPush(); b.x = clamp(b.x + step, 0, ed.box.w - b.w); }
  else if (e.key === 'ArrowUp') { edPush(); b.y = clamp(b.y - step, 0, ed.box.h - b.h); }
  else if (e.key === 'ArrowDown') { edPush(); b.y = clamp(b.y + step, 0, ed.box.h - b.h); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { edPush(); ed.layout.blocks = ed.layout.blocks.filter(x => x.id !== b.id); ed.sel = null; }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { edDuplicate(b); }
  else return;
  e.preventDefault();
  edRender();
}

function edDuplicate(b) {
  edPush();
  const c = JSON.parse(JSON.stringify(b));
  c.id = EPBlocks.uid();
  c.x = clamp(b.x + (ed.layout.grid || 5), 0, ed.box.w - c.w);
  c.y = clamp(b.y + (ed.layout.grid || 5), 0, ed.box.h - c.h);
  ed.layout.blocks.push(c); ed.sel = c.id;
  edRender();
}
function edZ(b, dir) {
  const i = ed.layout.blocks.indexOf(b); if (i < 0) return;
  edPush();
  ed.layout.blocks.splice(i, 1);
  ed.layout.blocks.splice(dir < 0 ? 0 : ed.layout.blocks.length, 0, b);
  edRender();
}

function edAddMenu(anchor) {
  closePop();
  const pop = document.createElement('div'); pop.className = 'popmenu typemenu scrl';
  EPBlocks.GROUPS.forEach(g => {
    pop.insertAdjacentHTML('beforeend', `<div class="tm-h">${esc(g)}</div>`);
    EPBlocks.TYPE_LIST.filter(t => EPBlocks.TYPES[t].group === g).forEach(t => {
      pop.insertAdjacentHTML('beforeend', `<button data-t="${t}" class="tm-item"><span class="tm-lb">${esc(EPBlocks.TYPES[t].label)}</span></button>`);
    });
  });
  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return; closePop();
    edPush();
    const nb = EPBlocks.makeBlock(b.dataset.t, { x: edSnap(8), y: edSnap(8) });
    nb.w = Math.min(nb.w, ed.box.w - nb.x); nb.h = Math.min(nb.h, ed.box.h - nb.y);
    ed.layout.blocks.push(nb); ed.sel = nb.id;
    edRender();
  });
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  _pop = pop;
}

/* ----- painel de propriedades ----- */
function edRenderProps() {
  const host = $('#be_props'); if (!host) return;
  const b = edSelBlock();
  if (!b) {
    host.innerHTML = `<div class="be-empty"><b>Nenhum bloco selecionado</b><p>Toque num bloco para editar. Use <b>Bloco</b> na barra para adicionar.</p>` +
      `<p class="hint">Setas movem o bloco; <kbd>Shift</kbd>+setas ajustam fino. <kbd>Del</kbd> remove. <kbd>Ctrl</kbd>+<kbd>D</kbd> duplica.</p></div>`;
    return;
  }
  const T = EPBlocks.TYPES[b.type];
  let html = `<div class="be-ph"><b>${esc(T.label)}</b>` +
    `<span class="be-pa">` +
      `<button data-a="dup" title="Duplicar">${iconSVG('copy')}</button>` +
      `<button data-a="front" title="Trazer para a frente">${iconSVG('chevright')}</button>` +
      `<button data-a="back" title="Enviar para trás">${iconSVG('chevleft')}</button>` +
      `<button data-a="del" class="danger" title="Remover">${iconSVG('trash')}</button>` +
    `</span></div>`;
  html += `<div class="be-xy">` +
    ['x', 'y', 'w', 'h'].map(k => `<label>${k.toUpperCase()}<input type="number" data-xy="${k}" value="${Math.round(b[k] * 10) / 10}" step="${ed.layout.grid || 1}" min="0"></label>`).join('') +
    `</div>`;
  (T.fields || []).forEach(f => {
    const cur = b[f.k] != null ? b[f.k] : f.def;
    const id = 'bp_' + f.k;
    if (f.type === 'toggle') html += `<label class="row"><input type="checkbox" data-f="${f.k}" id="${id}" ${cur ? 'checked' : ''}> ${esc(f.label)}</label>`;
    else if (f.type === 'range') html += `<label>${esc(f.label)} <span class="v" id="${id}v">${cur}${f.unit ? ' ' + f.unit : ''}</span><input type="range" data-f="${f.k}" id="${id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${cur}"></label>`;
    else if (f.type === 'select') html += `<label>${esc(f.label)}<select data-f="${f.k}" id="${id}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(cur) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    else if (f.type === 'color') html += edColorField(f, cur, id);
    else if (f.type === 'text') html += `<label>${esc(f.label)}<span class="be-txt"><input type="text" data-f="${f.k}" id="${id}" maxlength="300" value="${esc(cur || '')}"><button type="button" class="be-var" data-var-for="${id}">{ }</button></span></label>`;
    else if (f.type === 'textarea') html += `<label>${esc(f.label)}<span class="be-txt"><textarea data-f="${f.k}" id="${id}" rows="${f.rows || 3}" maxlength="4000">${esc(cur || '')}</textarea><button type="button" class="be-var" data-var-for="${id}">{ }</button></span></label>`;
    else if (f.type === 'image') {
      const has = typeof cur === 'string' && cur.slice(0, 5) === 'data:';
      html += `<label>${esc(f.label)}<span class="img-fld"><button type="button" id="${id}_pick">${has ? 'Trocar imagem…' : 'Escolher imagem…'}</button>` +
        (has ? `<img class="img-prev" src="${esc(cur)}" alt=""><button type="button" class="img-x danger" id="${id}_clr">Remover</button>` : '') + `</span></label>`;
    }
  });
  host.innerHTML = html;

  host.querySelector('.be-ph').addEventListener('click', e => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'dup') edDuplicate(b);
    else if (a.dataset.a === 'front') edZ(b, 1);
    else if (a.dataset.a === 'back') edZ(b, -1);
    else if (a.dataset.a === 'del') { edPush(); ed.layout.blocks = ed.layout.blocks.filter(x => x.id !== b.id); ed.sel = null; edRender(); }
  });
  host.querySelectorAll('[data-xy]').forEach(inp => {
    inp.onchange = () => { edPush(); const k = inp.dataset.xy; const max = (k === 'x' || k === 'w') ? ed.box.w : ed.box.h;
      b[k] = clamp(num(inp.value, b[k]), (k === 'w' || k === 'h') ? 5 : 0, max);
      edRender(); };
  });
  host.querySelectorAll('[data-f]').forEach(inp => {
    const k = inp.dataset.f, f = T.fields.find(x => x.k === k);
    const commit = (v, live) => { if (!live) edPush(); b[k] = v; live ? edRenderBg() : edRender(); };
    if (f.type === 'toggle') inp.onchange = () => commit(inp.checked);
    else if (f.type === 'range') {
      inp.addEventListener('pointerdown', () => edPush());
      inp.addEventListener('input', () => { const o = $('#bp_' + k + 'v'); if (o) o.textContent = inp.value + (f.unit ? ' ' + f.unit : ''); b[k] = parseFloat(inp.value); edRenderBg(); });
      inp.addEventListener('change', () => edRender());
    }
    else if (f.type === 'select') inp.onchange = () => commit(isNaN(+inp.value) || inp.value === '' ? inp.value : +inp.value);
    else if (f.type === 'text' || f.type === 'textarea') {
      inp.addEventListener('input', () => { b[k] = String(inp.value).slice(0, f.type === 'textarea' ? 4000 : 300); clearTimeout(inp._t); inp._t = setTimeout(() => edRenderBg(), 140); });
      inp.addEventListener('change', () => edPush());
    }
    else if (f.type === 'color') edBindColorField(host, inp, b, k);
  });
  // botões de imagem
  (T.fields || []).filter(f => f.type === 'image').forEach(f => {
    const pk = $('#bp_' + f.k + '_pick', host), cl = $('#bp_' + f.k + '_clr', host);
    if (pk) pk.onclick = () => pickImage(uri => { edPush(); b[f.k] = uri; edRender(); });
    if (cl) cl.onclick = () => { edPush(); b[f.k] = ''; edRender(); };
  });
  // inserir variável
  host.querySelectorAll('[data-var-for]').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); edVarMenu(btn, $('#' + btn.dataset.varFor, host)); };
  });
}

const COLOR_OPTS = [
  { v: 'ink', label: 'Tinta' }, { v: 'faint', label: 'Suave' }, { v: 'hair', label: 'Fina' },
  { v: 'accent', label: 'Destaque' }, { v: 'paper', label: 'Papel' }, { v: '__hex__', label: 'Personalizada…' }
];
function edColorField(f, cur, id) {
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cur);
  return `<label>${esc(f.label)}<span class="be-cf">` +
    `<select data-f="${f.k}" id="${id}">` +
    COLOR_OPTS.map(o => `<option value="${o.v}" ${(o.v === cur || (o.v === '__hex__' && isHex)) ? 'selected' : ''}>${o.label}</option>`).join('') +
    `</select><input type="color" id="${id}_hex" value="${isHex ? cur : '#333333'}" ${isHex ? '' : 'hidden'}></span></label>`;
}
function edBindColorField(host, sel, b, k) {
  const hex = $('#' + sel.id + '_hex', host);
  sel.onchange = () => {
    if (sel.value === '__hex__') { hex.hidden = false; edPush(); b[k] = hex.value; edRender(); }
    else { hex.hidden = true; edPush(); b[k] = sel.value; edRender(); }
  };
  if (hex) hex.oninput = () => { b[k] = hex.value; edRenderBg(); };
  if (hex) hex.onchange = () => { edPush(); b[k] = hex.value; edRender(); };
}

function edVarMenu(anchor, field) {
  closePop();
  const pop = document.createElement('div'); pop.className = 'popmenu scrl';
  EPDates.VAR_NAMES.forEach(v => {
    const b = document.createElement('button');
    b.textContent = '{' + v + '}';
    b.onclick = () => {
      const ins = '{' + v + '}';
      const s = field.selectionStart != null ? field.selectionStart : field.value.length;
      const e2 = field.selectionEnd != null ? field.selectionEnd : field.value.length;
      field.value = field.value.slice(0, s) + ins + field.value.slice(e2);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.focus();
      closePop();
    };
    pop.appendChild(b);
  });
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left - 40)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  _pop = pop;
}

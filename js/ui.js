/* Planner Studio — js/ui.js
   controles do documento, lista de seções, painel direito, menus, atalhos, init.
   (parte de app; carregado em ordem por index.html) */
"use strict";

/* ================= feedback ================= */
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3600); }
function busy(m) { $('#busyTxt').textContent = m || 'Processando…'; $('#busy').hidden = false; }
function unbusy() { $('#busy').hidden = true; }
const isMobile = () => matchMedia('(max-width:820px)').matches;

/* ================= controles do documento (painel esquerdo) ================= */
function syncDocControls() {
  const s = state.settings;
  const set = (id, v) => { const e = $(id); if (e) e.value = v; };
  const chk = (id, v) => { const e = $(id); if (e) e.checked = !!v; };
  const rng = (id, v, txt) => { const e = $(id); if (e) { e.value = v; const o = $(id.replace('#d_', '#v_')); if (o) o.textContent = txt; } };
  set('#d_paper', s.paper);
  $('#d_customRow').hidden = s.paper !== 'custom';
  set('#d_cw', s.customW); set('#d_ch', s.customH);
  chk('#d_landscape', s.landscape);
  rng('#d_mt', s.marginTop, s.marginTop + ' mm');
  rng('#d_mb', s.marginBottom, s.marginBottom + ' mm');
  rng('#d_mi', s.marginInner, s.marginInner + ' mm');
  rng('#d_mo', s.marginOuter, s.marginOuter + ' mm');
  chk('#d_mirror', s.mirrorMargins);
  set('#d_binding', s.binding);
  chk('#d_punch', s.showPunch);
  chk('#d_printPunch', s.printPunch);
  $('#d_printPunchRow').hidden = !(BINDINGS[s.binding] && BINDINGS[s.binding].punch);
  set('#d_pnum', s.pageNumber);
  rng('#d_pnumStart', s.pageNumberStart, String(s.pageNumberStart));
  rng('#d_pnumSkip', s.pageNumberSkip, String(s.pageNumberSkip));
  rng('#d_bleed', s.bleedMm, s.bleedMm + ' mm');
  chk('#d_crop', s.cropMarks);
  $('#d_cropRow').hidden = s.bleedMm <= 0;
  chk('#d_pnumTotal', s.pageNumberTotal);
  set('#d_pnumPrefix', s.pageNumberPrefix);
  set('#d_footer', s.footerText);
  set('#d_year', s.year);
  set('#d_startDate', s.startDate);
  set('#d_week', s.weekStart);
  chk('#d_weekend', s.highlightWeekends);
  set('#d_holUF', s.holUF);
  chk('#d_holNacional', s.holNacional);
  chk('#d_holFacultativo', s.holFacultativo);
  chk('#d_holComemorativa', s.holComemorativa);
  set('#d_events', s.events);
  set('#d_bindGsm', s.bindPaperGsm);
  set('#d_bindKind', s.bindPaperKind);
  if (typeof updateBindHint === 'function') updateBindHint();
  rng('#d_lineW', s.lineWeight, Math.round(s.lineWeight * 100) + ' %');
  set('#d_ink', s.ink); set('#d_accent', s.accent); set('#d_paperbg', s.paperBg);
  set('#d_exportMode', s.exportMode);
  set('#d_sheet', s.sheet);
  set('#d_twoUpOrder', s.twoUpOrder);
  set('#d_headingFont', s.headingFont);
  { const sr = $('#d_sheetRow'); if (sr) sr.hidden = (s.exportMode === 'real' || s.exportMode === 'auto'); }
  { const tr = $('#d_twoUpRow'); if (tr) tr.hidden = (s.exportMode !== '2up'); }
  { const eh = $('#d_exportHint'); if (eh) {
    const eff = effectiveExportMode();
    const [W, H] = paperWH();
    const now = eff.mode === 'fit'
      ? `Como está agora: o miolo (${W.toFixed(0)}×${H.toFixed(0)} mm) sai centralizado numa folha ${({ a4: 'A4', letter: 'Carta', a3: 'A3' })[eff.sheet] || 'A4'} com <b>marcas de corte</b> — imprima e corte.`
      : `Como está agora: o miolo sai no tamanho exato (${W.toFixed(0)}×${H.toFixed(0)} mm), sem marca de corte.`;
    eh.innerHTML = s.exportMode === 'auto'
      ? `<b>Automático</b>: se o papel escolhido cabe numa A4 mas não é uma A4 inteira (A5, A6, pocket…), centraliza numa A4 com marcas de corte; senão sai no tamanho exato. ${now} Imprima sempre em <b>100%</b>, margens <b>Nenhuma</b>.`
      : '';
  } }
  chk('#d_guide', s.showSafeGuide);
  set('#d_dpi', s.exportDPI);
  if (typeof buildLabelFields === 'function') buildLabelFields();
  refreshColorFields();
  if (typeof mSync === 'function') mSync();
}
function bindDoc() {
  const P = PAGE_SIZES;
  const psel = $('#d_paper');
  Object.entries(P).forEach(([k, v]) => psel.add(new Option(v.label, k)));
  Object.entries(BINDINGS).forEach(([k, v]) => $('#d_binding').add(new Option(v.label, k)));

  const commit = (key, val, opts = {}) => {
    pushHistory('doc-' + key);
    state.settings[key] = val;
    state.settings = migrate(state).settings;
    svgCache.clear();
    syncDocControls(); render(); save();
    if (opts.fit && !userZoomed) fit();
  };
  const bindRange = (id, key, unit) => {
    const e = $(id), o = $(id.replace('#d_', '#v_'));
    e.addEventListener('pointerdown', () => pushHistory('rng-' + key));
    e.addEventListener('input', () => {
      state.settings[key] = parseFloat(e.value);
      if (o) o.textContent = e.value + (unit || '');
      rafDocRender();
    });
  };
  $('#d_paper').onchange = e => commit('paper', e.target.value, { fit: true });
  $('#d_cw').onchange = e => commit('customW', parseFloat(e.target.value), { fit: true });
  $('#d_ch').onchange = e => commit('customH', parseFloat(e.target.value), { fit: true });
  $('#d_landscape').onchange = e => commit('landscape', e.target.checked, { fit: true });
  bindRange('#d_mt', 'marginTop', ' mm'); bindRange('#d_mb', 'marginBottom', ' mm');
  bindRange('#d_mi', 'marginInner', ' mm'); bindRange('#d_mo', 'marginOuter', ' mm');
  $('#d_mirror').onchange = e => commit('mirrorMargins', e.target.checked);
  $('#d_binding').onchange = e => commit('binding', e.target.value, { fit: true });
  $('#d_punch').onchange = e => commit('showPunch', e.target.checked);
  $('#d_printPunch').onchange = e => commit('printPunch', e.target.checked);
  $('#d_pnum').onchange = e => commit('pageNumber', e.target.value);
  bindRange('#d_pnumStart', 'pageNumberStart', ''); bindRange('#d_pnumSkip', 'pageNumberSkip', '');
  if ($('#d_pnumTotal')) $('#d_pnumTotal').onchange = e => commit('pageNumberTotal', e.target.checked);
  if ($('#d_pnumPrefix')) $('#d_pnumPrefix').onchange = e => commit('pageNumberPrefix', e.target.value);
  if ($('#d_footer')) $('#d_footer').onchange = e => commit('footerText', e.target.value);
  bindRange('#d_bleed', 'bleedMm', ' mm');
  $('#d_bleed').addEventListener('change', () => commit('bleedMm', state.settings.bleedMm));
  $('#d_crop').onchange = e => commit('cropMarks', e.target.checked);
  $('#d_year').onchange = e => commit('year', parseInt(e.target.value, 10));
  if ($('#d_startDate')) $('#d_startDate').onchange = e => commit('startDate', e.target.value.trim());
  $('#d_week').onchange = e => commit('weekStart', e.target.value);
  if ($('#d_weekend')) $('#d_weekend').onchange = e => commit('highlightWeekends', e.target.checked);
  // datas especiais (feriados + eventos)
  const ufSel = $('#d_holUF');
  if (ufSel && typeof EPDates !== 'undefined') EPDates.UFS.forEach(uf => ufSel.add(new Option(uf, uf)));
  if (ufSel) ufSel.onchange = e => commit('holUF', e.target.value);
  ['holNacional', 'holFacultativo', 'holComemorativa'].forEach(k => {
    const el = $('#d_' + k); if (el) el.onchange = e => commit(k, e.target.checked);
  });
  if ($('#d_events')) $('#d_events').oninput = e => {
    const el = e.target;
    state.settings.events = sanitizeText(el.value, 8000);
    clearTimeout(el._t); el._t = setTimeout(() => { pushHistory('doc-events'); state.settings = migrate(state).settings; svgCache.clear(); render(); save(); }, 350);
  };
  // estimativa de anel wire-o / espiral
  if ($('#d_bindGsm')) $('#d_bindGsm').onchange = e => { state.settings.bindPaperGsm = +e.target.value; state.settings = migrate(state).settings; save(); updateBindHint(); };
  if ($('#d_bindKind')) $('#d_bindKind').onchange = e => { state.settings.bindPaperKind = e.target.value; state.settings = migrate(state).settings; save(); updateBindHint(); };
  if ($('#d_lineW')) {
    const lw = $('#d_lineW'), lwo = $('#v_lineW');
    const lwtxt = v => Math.round(parseFloat(v) * 100) + ' %';
    lw.addEventListener('pointerdown', () => pushHistory('rng-lineWeight'));
    lw.addEventListener('input', () => {
      state.settings.lineWeight = parseFloat(lw.value);
      if (lwo) lwo.textContent = lwtxt(lw.value);
      rafDocRender();
    });
  }
  const EXP_LABEL = { auto: 'automático — decide sozinho', real: 'tamanho real (1 por folha)', fit: '1 por folha + marcas de corte', '2up': '2 por folha (cortar ao meio)', booklet: 'livreto — dobrar ao meio' };
  if ($('#d_exportMode')) $('#d_exportMode').onchange = e => {
    state.settings.exportMode = e.target.value; state.settings = migrate(state).settings;
    syncDocControls(); save();
    toast('Montagem: ' + (EXP_LABEL[e.target.value] || e.target.value));
  };
  if ($('#d_sheet')) $('#d_sheet').onchange = e => {
    state.settings.sheet = e.target.value; state.settings = migrate(state).settings; save();
    toast('Folha de saída: ' + e.target.selectedOptions[0].text.split(' — ')[0]);
  };
  if ($('#d_twoUpOrder')) $('#d_twoUpOrder').onchange = e => {
    state.settings.twoUpOrder = e.target.value; state.settings = migrate(state).settings; save();
    toast(e.target.value === 'seq' ? 'Páginas em ordem sequencial na folha' : 'Corte e empilhe — sem intercalar');
  };
  if ($('#d_headingFont')) $('#d_headingFont').onchange = e => {
    pushHistory('doc-headingFont');
    state.settings.headingFont = e.target.value; state.settings = migrate(state).settings;
    svgCache.clear(); render(); save();
  };
  buildLabelFields();
  $('#d_mPreset') && $('#d_mPreset').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const P = {
      min: [5, 5, 6, 5], std: [DEFAULTS.marginTop, DEFAULTS.marginBottom, DEFAULTS.marginInner, DEFAULTS.marginOuter],
      wide: [16, 18, 16, 16], bind: [12, 14, 20, 12]
    }[b.dataset.m];
    if (!P) return;
    pushHistory('doc-mPreset');
    Object.assign(state.settings, { marginTop: P[0], marginBottom: P[1], marginInner: P[2], marginOuter: P[3] });
    state.settings = migrate(state).settings;
    svgCache.clear(); syncDocControls(); render(); save();
    if (!userZoomed) fit();
  });
  $('#d_guide').onchange = e => commit('showSafeGuide', e.target.checked);
  $('#d_dpi').onchange = e => { state.settings.exportDPI = +e.target.value; save(); };
  $('#d_ink').oninput = e => { pushHistory('ink'); state.settings.ink = e.target.value; svgCache.clear(); render(); save(); };
  $('#d_accent').oninput = e => { pushHistory('accent'); state.settings.accent = e.target.value; svgCache.clear(); render(); save(); };
  $('#d_paperbg').oninput = e => { pushHistory('paperbg'); state.settings.paperBg = e.target.value; svgCache.clear(); render(); save(); };
  $('#d_resetColors').onclick = () => {
    pushHistory('resetColors');
    Object.assign(state.settings, { ink: DEFAULTS.ink, accent: DEFAULTS.accent, paperBg: DEFAULTS.paperBg });
    svgCache.clear(); syncDocControls(); render(); save();
  };
  const pbox = $('#d_palette');
  if (pbox && typeof PALETTES === 'object') {
    // sem style="" inline (a CSP bloqueia): cria os nós e pinta via CSSOM
    Object.entries(PALETTES).forEach(([k, p]) => {
      const bt = document.createElement('button');
      bt.className = 'chip'; bt.dataset.pal = k; bt.title = p.label;
      const s1 = document.createElement('span'), s2 = document.createElement('span');
      s1.className = s2.className = 'palsw';
      s1.style.background = p.ink; s2.style.background = p.accent;
      bt.append(s1, s2, ' ' + p.label);
      bt.onclick = () => {
        pushHistory('doc-palette');
        Object.assign(state.settings, { ink: p.ink, accent: p.accent, paperBg: p.paperBg });
        svgCache.clear(); syncDocControls(); render(); save();
        toast('Paleta: ' + p.label);
      };
      pbox.appendChild(bt);
    });
  }
}

/* estimativa de folhas físicas + anel wire-o / espiral (packages/core/binding.js) */
function updateBindHint() {
  const el = $('#d_bindHint'); if (!el) return;
  const s = state.settings;
  const n = (typeof pageCount === 'function') ? pageCount() : 0;
  if (!n || typeof EPBinding === 'undefined') { el.textContent = ''; return; }
  const e = EPBinding.estimate({ pages: n, gsm: s.bindPaperGsm, paperKind: s.bindPaperKind });
  const bind = s.binding || 'none';
  const parts = [`${n} pág. = ${e.sheets} folha(s) físicas`, `miolo ≈ ${e.thicknessMm.toFixed(1)} mm`];
  if (bind === 'wireo') parts.push(`garra wire-o ≈ ${e.wireo.label} (${e.wireo.mm} mm, passo ${e.wireo.pitch})`);
  else if (bind === 'spiral') parts.push(`espiral ≈ ${e.coil.mm} mm`);
  else parts.push(`wire-o ≈ ${e.wireo.label} · espiral ≈ ${e.coil.mm} mm`);
  if (bind === 'staple' && !e.multipleOf4) parts.push('livreto: use múltiplo de 4 páginas');
  el.textContent = parts.join(' · ') + '. Estimativa — confira com o papel real.';
}

/* editor dos rótulos fixos das páginas ("Textos das páginas") */
const LABEL_NAMES = {
  notas: 'Notas', tarefas: 'Tarefas', prioridades: 'Prioridades', metasNotas: 'Metas / notas',
  gratidao: 'Gratidão', agua: 'Água', principais: '3 principais', resumo: 'Resumo (Cornell)',
  compras: 'Compras', tarefasMes: 'Tarefas do mês', data: 'Data (cabeçalho)', indice: 'Índice',
  cafe: 'Refeição 1', almoco: 'Refeição 2', jantar: 'Refeição 3', pertenceA: 'Capa: "pertence a"',
};
function buildLabelFields() {
  const box = $('#d_labels'); if (!box) return;
  box.innerHTML = '';
  Object.keys(DEFAULT_LABELS).forEach(k => {
    const cur = (state.settings.labels && state.settings.labels[k]) || '';
    const id = 'lbl_' + k;
    box.insertAdjacentHTML('beforeend',
      `<label>${esc(LABEL_NAMES[k] || k)} <input type="text" id="${id}" maxlength="40" placeholder="${esc(DEFAULT_LABELS[k])}" value="${esc(cur)}"></label>`);
    const el = $('#' + id);
    el.oninput = () => {
      const v = sanitizeText(el.value, 40).trim();
      if (!state.settings.labels || typeof state.settings.labels !== 'object') state.settings.labels = {};
      if (v) state.settings.labels[k] = v; else delete state.settings.labels[k];
      clearTimeout(el._t); el._t = setTimeout(() => { svgCache.clear(); render(); save(); }, 250);
    };
  });
}

/* ================= lista de seções ================= */
// nome amigável da seção na lista: usa o título dado, ou o mês / intervalo de
// datas real das páginas da seção — em vez de repetir "Mês · calendário" 12×.
function sectionLabel(sec, mine) {
  const T = PAGE_TYPES[sec.type];
  const o = { ...T.defaults, ...sec.opts };
  const t = (typeof o.title === 'string' ? o.title : '').trim();
  if (sec.type === 'cover') return t || 'Capa';
  if (sec.type === 'tab') return t || 'Divisória';
  const dts = (mine || []).map(p => p.date).filter(Boolean);
  if (dts.length) {
    const a = dts[0], b = dts[dts.length - 1];
    if (T.dated === 'month') {
      const ma = MONTHS_PT[a.getMonth()], mb = MONTHS_PT[b.getMonth()];
      return ma === mb && a.getFullYear() === b.getFullYear() ? `${ma} ${a.getFullYear()}` : `${ma}–${mb}`;
    }
    const sd = d => `${d.getDate()}/${d.getMonth() + 1}`;
    if (T.dated === 'week') return dts.length > 1 ? `Semanas · ${sd(a)}–${sd(b)}` : `Semana de ${sd(a)}`;
    return dts.length > 1 ? `${sd(a)}–${sd(b)}` : sd(a);   // day / day2
  }
  return t || T.label;
}

function renderSectionList() {
  const list = $('#secList'); if (!list) return;
  list.innerHTML = '';
  if (!state.sections.length) { list.innerHTML = '<p class="hint">Nenhuma seção ainda. Use <b>Adicionar seção</b>.</p>'; }
  const pages = expand();
  const bySec = new Map();                 // 1 passada, em vez de filtrar por seção
  for (const p of pages) { let a = bySec.get(p.sectionId); if (!a) bySec.set(p.sectionId, a = []); a.push(p); }
  const frag = document.createDocumentFragment();
  state.sections.forEach((sec, idx) => {
    const T = PAGE_TYPES[sec.type];
    const mine = bySec.get(sec.id) || [];
    const npages = mine.length;
    const name = sectionLabel(sec, mine);
    const sub = (name === T.label ? '' : T.label + ' · ') + npages + ' pág.';
    const row = document.createElement('div');
    row.className = 'sec-row' + (sec.id === selId ? ' on' : '');
    row.dataset.id = sec.id;
    // arrastar HTML5 trava a rolagem no toque — no celular reordena-se pelo menu ⋯
    row.draggable = !isMobile();
    row.innerHTML =
      `<span class="sec-grip" title="Arraste para reordenar">${iconSVG('grip')}</span>` +
      `<span class="sec-ic">${iconSVG(T.icon)}</span>` +
      `<span class="sec-name" title="${esc(name)}">${esc(name)}<i>${esc(sub)}</i></span>` +
      (T.repeat ? `<span class="sec-count"><button data-a="dec">−</button><b>${sec.count}</b><button data-a="inc">+</button></span>` : '') +
      `<button class="sec-menu" data-a="menu" title="Mais">${iconSVG('more')}</button>`;
    row.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if (!a) { selectSection(sec.id); return; }
      const act = a.dataset.a;
      if (act === 'inc') setSectionCount(sec.id, sec.count + (sec.count >= 100 ? 10 : 5 > sec.count ? 1 : 5));
      else if (act === 'dec') setSectionCount(sec.id, sec.count - (sec.count > 100 ? 10 : sec.count > 5 ? 5 : 1));
      else if (act === 'menu') openSecMenu(a, sec.id);
    });
    if (row.draggable) {
      row.addEventListener('dragstart', e => { dragId = sec.id; e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
      row.addEventListener('dragend', () => { dragId = null; row.classList.remove('dragging'); $$('.sec-row.over', list).forEach(x => x.classList.remove('over')); });
      row.addEventListener('dragover', e => { if (dragId && dragId !== sec.id) { e.preventDefault(); row.classList.add('over'); } });
      row.addEventListener('dragleave', () => row.classList.remove('over'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('over'); if (dragId && dragId !== sec.id) { reorderSection(dragId, sec.id); selectSection(dragId, { noScroll: true }); } });
    }
    frag.appendChild(row);
  });
  list.appendChild(frag);
}
function openSecMenu(anchor, id) {
  closePop();
  const mob = isMobile();
  const sec = state.sections.find(x => x.id === id);
  const pop = document.createElement('div'); pop.className = 'popmenu' + (mob ? ' pop-sheet' : '');
  if (mob) pop.insertAdjacentHTML('beforeend',
    `<div class="tm-head"><span>${sec ? esc(sectionLabel(sec, [])) : 'Seção'}</span><button class="iconbtn ghost" data-tmx title="Fechar">${iconSVG('x')}</button></div>`);
  pop.insertAdjacentHTML('beforeend',
    `<button data-a="up">${iconSVG('chevleft')}<span>Mover para cima</span></button>` +
    `<button data-a="down">${iconSVG('chevright')}<span>Mover para baixo</span></button>` +
    `<button data-a="dup">${iconSVG('copy')}<span>Duplicar</span></button>` +
    `<button data-a="del" class="danger">${iconSVG('trash')}<span>Remover</span></button>`);
  pop.addEventListener('click', e => {
    if (e.target.closest('[data-tmx]')) { closePop(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a; closePop();
    if (a === 'up') moveSection(id, -1);
    else if (a === 'down') moveSection(id, 1);
    else if (a === 'dup') dupSection(id);
    else if (a === 'del') removeSection(id);
  });
  document.body.appendChild(pop);
  if (mob) { mScrim(true); document.body.classList.add('sheet-open'); _pop = pop; return; }
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  _pop = pop;
}
let _pop = null, _popScrim = null;
function mScrim(on) {
  if (on) {
    if (!_popScrim) { _popScrim = document.createElement('div'); _popScrim.className = 'm-scrim'; document.body.appendChild(_popScrim); _popScrim.addEventListener('pointerdown', closePop); }
  } else if (_popScrim) { _popScrim.remove(); _popScrim = null; }
}
/* scrim do menu "⋯" no celular — fecha ao tocar fora */
let _menuScrimEl = null;
function menuScrim(on) {
  if (on && isMobile()) {
    if (!_menuScrimEl) {
      _menuScrimEl = document.createElement('div'); _menuScrimEl.className = 'm-scrim';
      document.body.appendChild(_menuScrimEl);
      _menuScrimEl.addEventListener('pointerdown', () => { const m = $('#menu'); if (m) m.hidden = true; menuScrim(false); });
    }
  } else if (_menuScrimEl) { _menuScrimEl.remove(); _menuScrimEl = null; }
}
function closePop() { if (_pop) { _pop.remove(); _pop = null; } mScrim(false); document.body.classList.remove('sheet-open'); }
document.addEventListener('pointerdown', e => { if (_pop && !_pop.contains(e.target) && !(_popScrim && e.target === _popScrim)) closePop(); });

/* ---- menu "Adicionar seção" ---- */
function openTypeMenu(anchor) {
  closePop();
  const mob = isMobile();
  const pop = document.createElement('div'); pop.className = 'popmenu typemenu scrl' + (mob ? ' tm-sheet' : '');
  if (mob) pop.insertAdjacentHTML('beforeend',
    `<div class="tm-head"><span>Adicionar seção</span><button class="iconbtn ghost" data-tmx title="Fechar">${iconSVG('x')}</button></div>`);
  PAGE_GROUPS.forEach(g => {
    pop.insertAdjacentHTML('beforeend', `<div class="tm-h">${g}</div>`);
    Object.entries(PAGE_TYPES).filter(([, T]) => T.group === g).forEach(([k, T]) => {
      pop.insertAdjacentHTML('beforeend', `<button data-t="${k}" class="tm-item"><span class="tm-pv">${typePreviewSVG(k)}</span><span class="tm-lb">${esc(T.label)}</span></button>`);
    });
  });
  pop.addEventListener('click', e => {
    if (e.target.closest('[data-tmx]')) { closePop(); return; }
    const b = e.target.closest('[data-t]'); if (!b) return; closePop(); addSection(b.dataset.t);
  });
  document.body.appendChild(pop);
  if (mob) { mScrim(true); document.body.classList.add('sheet-open'); _pop = pop; return; }
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  _pop = pop;
}

/* ================= painel direito (opções da seção) ================= */
function fillRight() {
  const sec = curSection();
  $('#rightEmpty').hidden = !!sec;
  $('#rightSel').hidden = !sec;
  if (!sec) { if (typeof mSyncRight === 'function') mSyncRight(null); return; }
  const T = PAGE_TYPES[sec.type];
  $('#rs_title').textContent = T.label;
  $('#rs_group').textContent = T.group;
  const cr = $('#rs_countRow');
  const hasItems = /\S/.test(sec.opts.items || '');
  cr.hidden = !T.repeat || hasItems;
  if (T.repeat) { $('#rs_count').value = sec.count; $('#rs_countv').textContent = sec.count; }
  buildFields(sec, T);
  if (hasItems) cr.hidden = true;
  if (typeof mSyncRight === 'function') mSyncRight(sec);
}
function buildFields(sec, T) {
  const wrap = $('#rs_fields'); wrap.innerHTML = '';
  // trocar o TIPO da seção sem perder a contagem/opções universais
  const optgroups = PAGE_GROUPS.map(g =>
    `<optgroup label="${esc(g)}">` +
    Object.entries(PAGE_TYPES).filter(([, x]) => x.group === g)
      .map(([k, x]) => `<option value="${k}" ${k === sec.type ? 'selected' : ''}>${esc(x.label)}</option>`).join('') +
    `</optgroup>`).join('');
  wrap.insertAdjacentHTML('beforeend', `<label>Tipo de página <select id="fld_secType">${optgroups}</select></label>`);
  $('#fld_secType').onchange = e => { changeSectionType(sec.id, e.target.value); };

  (T.fields || []).forEach(f => {
    const cur = sec.opts[f.k] != null ? sec.opts[f.k] : f.def;
    const id = 'fld_' + f.k;
    let html = '';
    if (f.type === 'toggle') {
      html = `<label class="row"><input type="checkbox" id="${id}" ${cur ? 'checked' : ''}> ${esc(f.label)}</label>`;
    } else if (f.type === 'range') {
      html = `<label>${esc(f.label)} <span class="v" id="${id}v">${cur}${f.unit ? ' ' + f.unit : ''}</span>` +
        `<input type="range" id="${id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${cur}"></label>`;
    } else if (f.type === 'select') {
      html = `<label>${esc(f.label)}<select id="${id}">` +
        f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(cur) ? 'selected' : ''}>${esc(o.label)}</option>`).join('') +
        `</select></label>`;
    } else if (f.type === 'text') {
      html = `<label>${esc(f.label)}<input type="text" id="${id}" maxlength="80" value="${esc(cur || '')}"></label>`;
    } else if (f.type === 'textarea') {
      html = `<label>${esc(f.label)}<textarea id="${id}" rows="${f.rows || 4}" maxlength="4000">${esc(cur || '')}</textarea></label>` +
        (f.hint ? `<p class="hint">${esc(f.hint)}</p>` : '');
    } else if (f.type === 'image') {
      const has = typeof cur === 'string' && cur.slice(0, 5) === 'data:';
      const hasSrc = f.editAspect && typeof sec.opts[f.k + 'Src'] === 'string' && sec.opts[f.k + 'Src'].slice(0, 5) === 'data:';
      if (f.editAspect && hasSrc) {
        // editor embutido (packages/core/imgedit.js) — sem popup, igual ao
        // painel do Polaroide Studio: arrasta/ajusta aqui mesmo, ao vivo.
        html = `<label>${esc(f.label)}</label><span class="img-fld">` +
          `<span class="img-btnrow"><button type="button" id="${id}_pick" data-i="imagedown">Trocar…</button>` +
          `<button type="button" class="img-x danger" id="${id}_clr">Remover imagem</button></span>` +
          `<div id="${id}_host"></div></span>`;
      } else {
        html = `<label>${esc(f.label)}<span class="img-fld">` +
          (has ? `<img class="img-prev" id="${id}_prev" alt="prévia" src="${esc(cur)}">` : '') +
          `<button type="button" class="wfull" id="${id}_pick" data-i="imagedown">${has ? 'Trocar…' : 'Escolher imagem…'}</button>` +
          (has ? `<button type="button" class="img-x danger" id="${id}_clr">Remover imagem</button>` : '') +
          `</span></label>`;
      }
    } else if (f.type === 'layout') {
      html = `<div id="${id}_host" class="layout-fld"></div>`;
    }
    wrap.insertAdjacentHTML('beforeend', html);
    if (f.type === 'layout') {
      if (typeof mountLayoutField === 'function') mountLayoutField($('#' + id + '_host'), sec);
      return;
    }
    if (f.type === 'image') {
      injectIcons(wrap);
      const pk = $('#' + id + '_pick'), cl = $('#' + id + '_clr');
      if (f.editAspect) {
        const hasSrc = typeof sec.opts[f.k + 'Src'] === 'string' && sec.opts[f.k + 'Src'].slice(0, 5) === 'data:';
        if (pk) pk.onclick = () => { const s = curSection(); if (!s) return;
          pickNewImage({ keepEdit: s.opts[f.k + 'Edit'], cb: res => {
            s.opts[f.k + 'Src'] = res.photoSrc; s.opts[f.k + 'Edit'] = res.photoEdit;
            pushHistory('opt-' + f.k); svgCache.clear(); render(); save(); fillRight();
          } }); };
        if (cl) cl.onclick = () => { const s = curSection(); if (!s) return;
          pushHistory('opt-' + f.k); delete s.opts[f.k]; delete s.opts[f.k + 'Src']; delete s.opts[f.k + 'Edit'];
          svgCache.clear(); render(); save(); fillRight(); };
        if (hasSrc) {
          const host = $('#' + id + '_host');
          const [W, H] = paperWH();
          EPImgEdit.mount(host, {
            key: sec.id + ':' + f.k, src: sec.opts[f.k + 'Src'], aspect: W / H, edit: sec.opts[f.k + 'Edit'],
            onHistoryPoint: () => pushHistory('opt-' + f.k),
            onCommit: res => { const s = curSection(); if (!s) return;
              s.opts[f.k] = res.dataURL; s.opts[f.k + 'Edit'] = res.edit;
              svgCache.clear(); render(); save(); },
          });
        }
      } else {
        if (pk) pk.onclick = () => pickImage(uri => { const s = curSection(); if (!s) return; s.opts[f.k] = uri; svgCache.clear(); render(); save(); fillRight(); });
        if (cl) cl.onclick = () => { const s = curSection(); if (!s) return; delete s.opts[f.k]; svgCache.clear(); render(); save(); fillRight(); };
      }
      return;
    }
    const el = $('#' + id);
    if (!el) return;
    if (f.type === 'toggle') el.onchange = () => setSectionOpt(sec.id, f.k, el.checked);
    else if (f.type === 'textarea') el.oninput = () => { const s = curSection(); if (s) { s.opts[f.k] = sanitizeText(el.value, 4000); clearTimeout(el._t); el._t = setTimeout(() => { render(); save(); }, 250); } };
    else if (f.type === 'range') {
      el.addEventListener('pointerdown', () => pushHistory('opt-' + f.k));
      el.addEventListener('input', () => { $('#' + id + 'v').textContent = el.value + (f.unit ? ' ' + f.unit : ''); const s = curSection(); if (s) { s.opts[f.k] = parseFloat(el.value); rafRender(); save(); } });
    }
    else if (f.type === 'select') el.onchange = () => setSectionOpt(sec.id, f.k, isNaN(+el.value) ? el.value : +el.value);
    else if (f.type === 'text') el.oninput = () => { const s = curSection(); if (s) { s.opts[f.k] = sanitizeText(el.value, 80); clearTimeout(el._t); el._t = setTimeout(() => { render(); save(); }, 200); } };
  });
  // começar em página à direita (insere folha em branco se preciso)
  wrap.insertAdjacentHTML('beforeend',
    `<label class="row"><input type="checkbox" id="fld_breakBefore" ${sec.opts.breakBefore ? 'checked' : ''}> Começar em página à direita (frente e verso)</label>` +
    `<label>Rodapé só desta seção (opcional) <input type="text" id="fld_footer" maxlength="80" value="${esc(sec.opts.footer || '')}"></label>`);
  $('#fld_breakBefore').onchange = e => {
    const s = curSection(); if (!s) return;
    pushHistory('opt-breakBefore');
    if (e.target.checked) s.opts.breakBefore = true; else delete s.opts.breakBefore;
    render(); save();
  };
  $('#fld_footer').oninput = e => {
    const s = curSection(); if (!s) return;
    const v = sanitizeText(e.target.value, 80);
    if (v.trim()) s.opts.footer = v; else delete s.opts.footer;
    clearTimeout(e.target._t); e.target._t = setTimeout(() => { render(); save(); }, 200);
  };
  // override de cor da seção
  const inkOn = !!(sec.opts.ink && HEX.test(sec.opts.ink));
  wrap.insertAdjacentHTML('beforeend',
    `<label class="row"><input type="checkbox" id="fld_inkOn" ${inkOn ? 'checked' : ''}> Cor de tinta própria desta seção</label>` +
    `<label id="fld_inkRow" ${inkOn ? '' : 'hidden'}>Tinta da seção <input type="color" id="fld_ink" value="${inkOn ? sec.opts.ink : state.settings.ink}"></label>`);
  $('#fld_inkOn').onchange = e => {
    const s = curSection(); if (!s) return;
    pushHistory('opt-inkOn');
    if (e.target.checked) s.opts.ink = state.settings.ink; else delete s.opts.ink;
    $('#fld_inkRow').hidden = !e.target.checked;
    render(); save();
  };
  $('#fld_ink').oninput = e => { const s = curSection(); if (s) { s.opts.ink = e.target.value; render(); save(); } };
  setupColorFields();   // aplica o seletor bonito ao campo de tinta da seção
}

/* ================= seletor de cor (input color -> botão + popover) ================= */
const CF_SW = ['#2f3b37', '#000000', '#3d5c52', '#5b5750', '#8a857a', '#a97f3d', '#b23b2c', '#2b5f8a', '#c8c8c8', '#e5dfd3', '#faf8f3', '#ffffff'];
let cfOpen = null;
function closeCF() { if (cfOpen) { cfOpen.pop.remove(); cfOpen = null; } }
function paintCF(btn, hex) { btn.querySelector('.sw').style.background = hex; btn.querySelector('.hx').textContent = hex; }
function refreshColorFields() { $$('.cf-btn').forEach(b => { const inp = document.getElementById(b.dataset.for); if (inp) paintCF(b, inp.value); }); }
function setupColorFields() {
  $$('input[type=color]').forEach(inp => {
    if (inp.classList.contains('cf-native')) return;
    inp.classList.add('cf-native');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'cf-btn'; btn.dataset.for = inp.id;
    btn.innerHTML = '<span class="sw"></span><span class="hx"></span>';
    inp.after(btn);
    paintCF(btn, inp.value);
    inp.addEventListener('input', () => paintCF(btn, inp.value));
    btn.addEventListener('click', e => { e.stopPropagation(); openCF(btn, inp); });
  });
}
function openCF(btn, inp) {
  if (cfOpen && cfOpen.input === inp) { closeCF(); return; }
  closeCF();
  const pop = document.createElement('div'); pop.className = 'cfpop';
  const grid = document.createElement('div'); grid.className = 'row1';
  CF_SW.forEach(hex => {
    const s = document.createElement('button'); s.type = 'button'; s.className = 's'; s.style.background = hex; s.title = hex;
    s.onclick = () => { inp.value = hex; inp.dispatchEvent(new Event('input', { bubbles: true })); closeCF(); };
    grid.appendChild(s);
  });
  const custom = document.createElement('button'); custom.type = 'button'; custom.className = 'custom'; custom.textContent = 'Personalizada…';
  custom.onclick = () => { closeCF(); inp.click(); };
  pop.append(grid, custom); document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > innerHeight ? r.top - 6 - pop.offsetHeight : r.bottom + 6) + 'px';
  cfOpen = { pop, input: inp, btn };
}
document.addEventListener('pointerdown', e => { if (cfOpen && !cfOpen.pop.contains(e.target) && !cfOpen.btn.contains(e.target)) closeCF(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { closeCF(); closePop(); } }, true);
// fecha os popovers quando a PÁGINA rola — mas não quando o scroll acontece
// DENTRO do próprio popover (a lista de "Adicionar seção" tem rolagem própria).
addEventListener('scroll', e => {
  const t = e.target;
  if (_pop && (_pop === t || (t && t.nodeType === 1 && _pop.contains(t)))) return;
  if (cfOpen && cfOpen.pop && (cfOpen.pop === t || (t && t.nodeType === 1 && cfOpen.pop.contains(t)))) return;
  closeCF(); closePop();
}, true);
addEventListener('resize', () => { closeCF(); closePop(); });

/* ================= painéis / zen ================= */
function togglePanel(side, on) {
  if (on === undefined) on = !(side === 'left' ? uiState.left : uiState.right);
  if (side === 'left') { uiState.left = on; if (on && isMobile()) uiState.right = false; }
  else { uiState.right = on; if (on && isMobile()) uiState.left = false; }
  applyUI();
}
function applyUI() {
  appEl.classList.toggle('hide-left', !uiState.left);
  appEl.classList.toggle('hide-right', !uiState.right);
  appEl.classList.toggle('zen', zen);
  $('#b_pl').classList.toggle('on', uiState.left && !zen);
  $('#b_pr').classList.toggle('on', uiState.right && !zen);
  $('#b_zen').classList.toggle('on', zen);
  $('#zenExit').hidden = !zen;
  try { localStorage.setItem(UIKEY, JSON.stringify(uiState)); } catch (e) {}
  clearTimeout(applyUI._t); applyUI._t = setTimeout(() => { if (!userZoomed && !isMobile()) fit(); }, 240);
}

/* ================= bind da barra + menu ================= */
function bindBar() {
  $('#rs_count').addEventListener('pointerdown', () => pushHistory('count'));
  $('#rs_count').addEventListener('input', e => { const s = curSection(); if (s) { s.count = clamp(Math.round(+e.target.value), 1, 2000); $('#rs_countv').textContent = s.count; rafRender(); save(); } });
  $('#rs_dup').onclick = () => { const s = curSection(); if (s) dupSection(s.id); };
  $('#rs_del').onclick = () => { const s = curSection(); if (s) removeSection(s.id); };

  const openAdd = anchor => e => { e.stopPropagation(); openTypeMenu(anchor || e.currentTarget); };
  $('#b_addSec').onclick = openAdd($('#b_addSec'));
  if ($('#b_addSec2')) $('#b_addSec2').onclick = openAdd($('#b_addSec2'));
  if ($('#e_add')) $('#e_add').onclick = openAdd($('#e_add'));
  $('#b_undo').onclick = undo; $('#b_redo').onclick = redo;
  $('#b_prev').onclick = () => gotoPage(currentPage - 1);
  $('#b_next').onclick = () => gotoPage(currentPage + 1);
  $('#b_zin').onclick = () => { userZoomed = true; zoom = clamp(zoom + .1, .08, 3); applyZoom(); };
  $('#b_zout').onclick = () => { userZoomed = true; zoom = clamp(zoom - .1, .08, 3); applyZoom(); };
  $('#b_fit').onclick = fit;
  $('#b_pdf').onclick = exportPDF; $('#b_png').onclick = exportPNG;
  $('#b_print').onclick = printDoc;
  $('#b_pl').onclick = () => togglePanel('left');
  $('#b_pr').onclick = () => togglePanel('right');
  $('#b_zen').onclick = () => { zen = !zen; applyUI(); };
  $('#zenExit').onclick = () => { zen = false; applyUI(); };

  const menu = $('#menu');
  const mclose = () => { menu.hidden = true; menuScrim(false); };
  const mtoggle = () => { if (menu.hidden) { menu.hidden = false; menuScrim(true); } else mclose(); };
  $('#b_more').onclick = e => { e.stopPropagation(); mtoggle(); };
  $('#mu_more') && ($('#mu_more').onclick = e => { e.stopPropagation(); mtoggle(); });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !(e.target.closest && e.target.closest('#b_more,#mu_more')) && !(e.target.classList && e.target.classList.contains('m-scrim'))) mclose(); });
  $('#m_pdf').onclick = () => { mclose(); exportPDF(); };
  $('#m_png').onclick = () => { mclose(); exportPNG(); };
  $('#m_print').onclick = () => { mclose(); printDoc(); };
  $('#m_new').onclick = () => { mclose(); if (!state.sections.length || confirm('Começar um novo documento? O atual será descartado.')) { newDoc(TEMPLATES.find(t => t.id === 'branco')); toast('Novo documento.'); } };
  $('#m_save').onclick = () => { mclose(); exportProject(); };
  $('#m_open').onclick = () => { mclose(); $('#file_open').click(); };
  $('#m_help').onclick = () => { mclose(); $('#help').showModal(); };
  $('#m_privacy').onclick = () => { mclose(); $('#privacy').showModal(); };
  $('#m_about').onclick = () => { mclose(); $('#about').showModal(); };
  $('#m_install') && ($('#m_install').onclick = () => { mclose(); if (typeof doInstall === 'function') doInstall(); });
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#p_wipe').onclick = () => { if (confirm('Apagar o documento e as configurações guardadas neste navegador?')) { try { localStorage.removeItem(KEY); localStorage.removeItem(UIKEY); } catch (e) {} newDoc(TEMPLATES.find(t => t.id === 'branco')); try { $('#privacy').close(); } catch (e) {} toast('Tudo apagado.'); } };
  $('#file_open').addEventListener('change', e => { if (e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; });

  if (ACERVO_URL) {
    const bl = $('#brandLink'); bl.href = ACERVO_URL; bl.target = '_blank';
    const ma = $('#m_acervo'); if (ma) { ma.href = ACERVO_URL; ma.target = '_blank'; ma.hidden = false; }
  }
  if (typeof FEEDBACK_URL !== 'undefined' && FEEDBACK_URL) {
    const mf = $('#m_feedback'); if (mf) { mf.href = FEEDBACK_URL; mf.target = '_blank'; mf.hidden = false; }
  }
  // templates da tela inicial
  const tl = $('#tplList');
  if (tl) TEMPLATES.forEach(t => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'tpl-card' + (t.id === 'branco' ? ' tpl-card--blank' : '');
    b.innerHTML = `<span class="tpl-card__thumb">${tplThumbSVG(t)}</span>
      <span class="tpl-card__name">${esc(t.name)}</span>
      <span class="tpl-card__desc">${esc(t.desc)}</span>`;
    b.onclick = () => { newDoc(t); toast('Modelo: ' + t.name); };
    tl.appendChild(b);
  });
}

/* ============ miniaturas gráficas dos modelos (tela inicial) ============
   Sem renderizar página real (custaria caro pra uma lista) — um SVG pequeno
   e curado por modelo: uma "capa" colorida + um padrão que lembra o miolo
   predominante (pontilhado, pautado, grade, semanal, calendário, hábitos…). */
const TPL_VISUAL = {
  bujo: { pat: 'dot', band: 'brand' },
  semanal: { pat: 'week', band: 'brand' },
  diario: { pat: 'calendar', band: 'brand' },
  pautado: { pat: 'lined', band: 'brand' },
  estudos: { pat: 'cornell', band: 'brand' },
  refeicoes: { pat: 'checklist', band: 'gold' },
  financeiro: { pat: 'table', band: 'brand' },
  executiva: { pat: 'week', band: 'brand' },
  'cinco-min': { pat: 'checklist', band: 'gold' },
  habitos: { pat: 'habit', band: 'gold' },
  projetos: { pat: 'checklist', band: 'brand' },
  bemestar: { pat: 'habit', band: 'gold' },
  leitura: { pat: 'lined', band: 'gold' },
  patrimonio: { pat: 'table', band: 'brand' },
  branco: { pat: 'blank', band: 'muted' },
};

function tplPatternSVG(pat, x, y, w, h) {
  const lines = [];
  const strokeThin = 'stroke="var(--line-2)" stroke-width="1.4"';
  if (pat === 'dot') {
    const gap = 8;
    for (let yy = y + 6; yy < y + h - 2; yy += gap)
      for (let xx = x + 6; xx < x + w - 2; xx += gap)
        lines.push(`<circle cx="${xx}" cy="${yy}" r="1" fill="var(--faint)"/>`);
  } else if (pat === 'lined') {
    for (let yy = y + 8; yy < y + h - 2; yy += 9)
      lines.push(`<line x1="${x + 4}" y1="${yy}" x2="${x + w - 4}" y2="${yy}" ${strokeThin}/>`);
  } else if (pat === 'grid') {
    for (let yy = y + 8; yy < y + h - 2; yy += 9)
      lines.push(`<line x1="${x + 4}" y1="${yy}" x2="${x + w - 4}" y2="${yy}" ${strokeThin}/>`);
    for (let xx = x + 4; xx < x + w - 2; xx += 9)
      lines.push(`<line x1="${xx}" y1="${y + 4}" x2="${xx}" y2="${y + h - 2}" ${strokeThin}/>`);
  } else if (pat === 'cornell') {
    const cueW = w * 0.32, sumH = h * 0.24;
    lines.push(`<line x1="${x + cueW}" y1="${y}" x2="${x + cueW}" y2="${y + h - sumH}" ${strokeThin}/>`);
    lines.push(`<line x1="${x}" y1="${y + h - sumH}" x2="${x + w}" y2="${y + h - sumH}" ${strokeThin}/>`);
    for (let yy = y + 9; yy < y + h - sumH - 2; yy += 9)
      lines.push(`<line x1="${x + cueW + 4}" y1="${yy}" x2="${x + w - 4}" y2="${yy}" ${strokeThin}/>`);
  } else if (pat === 'calendar') {
    const cols = 4, rows = 3, gap = 3;
    const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      lines.push(`<rect x="${x + c * (cw + gap)}" y="${y + r * (ch + gap)}" width="${cw}" height="${ch}" rx="1.5" fill="none" stroke="var(--line-2)" stroke-width="1.4"/>`);
  } else if (pat === 'week') {
    const rows = 5, gap = 4;
    const rh = (h - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      const yy = y + r * (rh + gap);
      lines.push(`<rect x="${x}" y="${yy}" width="${w}" height="${rh}" rx="1.5" fill="none" stroke="var(--line-2)" stroke-width="1.4"/>`);
      lines.push(`<line x1="${x + w * 0.26}" y1="${yy}" x2="${x + w * 0.26}" y2="${yy + rh}" stroke="var(--line-2)" stroke-width="1.4"/>`);
    }
  } else if (pat === 'habit') {
    const cols = 7, rows = 5, gap = 3.2;
    const cw = (w - gap * (cols - 1)) / cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      lines.push(`<circle cx="${x + c * (cw + gap) + cw / 2}" cy="${y + r * ((h - cw) / (rows - 1)) + cw / 2}" r="${cw / 2.3}" fill="none" stroke="var(--faint)" stroke-width="1.3"/>`);
  } else if (pat === 'table') {
    const rows = 6, gap = 3.5, colX = x + w * 0.62;
    const rh = (h - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      const yy = y + r * (rh + gap);
      lines.push(`<rect x="${x}" y="${yy}" width="${w}" height="${rh}" rx="1.2" fill="none" stroke="var(--line-2)" stroke-width="1.3"/>`);
      lines.push(`<line x1="${colX}" y1="${yy}" x2="${colX}" y2="${yy + rh}" stroke="var(--line-2)" stroke-width="1.3"/>`);
    }
  } else if (pat === 'checklist') {
    const rows = 7, gap = (h - 4) / rows;
    for (let r = 0; r < rows; r++) {
      const yy = y + 6 + r * gap;
      lines.push(`<rect x="${x}" y="${yy - 3}" width="6" height="6" rx="1.3" fill="none" stroke="var(--faint)" stroke-width="1.3"/>`);
      lines.push(`<line x1="${x + 11}" y1="${yy}" x2="${x + w - (r % 3 === 0 ? 14 : 4)}" y2="${yy}" ${strokeThin}/>`);
    }
  } else if (pat === 'blank') {
    lines.push(`<line x1="${x + w / 2 - 9}" y1="${y + h / 2}" x2="${x + w / 2 + 9}" y2="${y + h / 2}" stroke="var(--faint)" stroke-width="2.4" stroke-linecap="round"/>`);
    lines.push(`<line x1="${x + w / 2}" y1="${y + h / 2 - 9}" x2="${x + w / 2}" y2="${y + h / 2 + 9}" stroke="var(--faint)" stroke-width="2.4" stroke-linecap="round"/>`);
  }
  return lines.join('');
}

function tplThumbSVG(t) {
  const v = TPL_VISUAL[t.id] || { pat: 'dot', band: 'brand' };
  const paperId = (t.settings && t.settings.paper) || 'a5';
  const ps = PAGE_SIZES[paperId] || PAGE_SIZES.a5;
  const W = 100, H = Math.round(W * (ps.h / ps.w)), R = 7, bandH = v.pat === 'blank' ? 0 : 26;
  const bind = t.binding && BINDINGS[t.binding];
  const bindPad = (bind && bind.punch) ? 9 : 0;
  const cid = 'tc-' + t.id;
  const bandFill = v.band === 'gold' ? 'var(--gold)' : v.band === 'muted' ? 'var(--line)' : 'var(--brand)';
  const titleColor = v.band === 'muted' ? 'var(--muted)' : '#fff';
  let band = '';
  if (bandH) {
    band = `<rect x="${bindPad}" y="0" width="${W - bindPad}" height="${bandH}" fill="${bandFill}"/>
      <rect x="${bindPad + 8}" y="${bandH / 2 - 5}" width="${Math.min(W - bindPad - 16, 34)}" height="3.2" rx="1.6" fill="${titleColor}" opacity=".92"/>
      <rect x="${bindPad + 8}" y="${bandH / 2 + 1}" width="${Math.min(W - bindPad - 16, 20)}" height="2.4" rx="1.2" fill="${titleColor}" opacity=".55"/>`;
  }
  const pattern = tplPatternSVG(v.pat, bindPad + 8, bandH + 8, W - bindPad - 16, H - bandH - 16);
  let bindMarks = '';
  if (bindPad) {
    const n = 6, gap = H / (n + 1);
    for (let i = 1; i <= n; i++) bindMarks += `<circle cx="${(bindPad / 2).toFixed(1)}" cy="${(gap * i).toFixed(1)}" r="1.3" fill="#fff" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>`;
  } else if (t.binding === 'staple') {
    bindMarks = `<path d="M2 ${H * 0.32}h4M2 ${H * 0.68}h4" stroke="rgba(0,0,0,.4)" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (t.binding === 'perfect') {
    bindMarks = `<rect x="0" y="0" width="3" height="${H}" fill="rgba(0,0,0,.12)"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><clipPath id="${cid}"><rect x="0" y="0" width="${W}" height="${H}" rx="${R}"/></clipPath></defs>
    <g clip-path="url(#${cid})">
      <rect x="0" y="0" width="${W}" height="${H}" fill="var(--surface)"/>
      ${band}
      ${pattern}
      ${bindMarks}
      <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="none" stroke="var(--line)" stroke-width="1"/>
    </g>
  </svg>`;
}

/* ============ escolher imagem (logo/fundo) — 100% local ============
   Reprocessa via canvas: reduz para no máx. ~1000 px e RE-CODIFICA, o que
   REMOVE todos os metadados (EXIF/GPS). Nada é enviado a servidor nenhum. */
function pickImage(cb) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
  inp.onchange = () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast('Imagem muito grande (máx. 16 MB).'); return; }
    const fr = new FileReader();
    fr.onerror = () => toast('Não consegui ler o arquivo.');
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => toast('Arquivo de imagem inválido.');
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { toast('Imagem sem dimensões.'); return; }
        const scale = Math.min(1, 1000 / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const keepAlpha = /^data:image\/(png|gif|webp)/i.test(String(fr.result));
        let out;
        try { out = keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85); }
        catch (e) { toast('Não consegui processar a imagem.'); return; }
        if (out.length > 4.5e6) { try { out = cv.toDataURL('image/jpeg', 0.68); } catch (e) {} }
        if (out.length > 4.6e6) { toast('Imagem grande demais mesmo otimizada — use uma menor.'); return; }
        cb(out);
        toast('Imagem adicionada — fica só neste aparelho.');
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  inp.click();
}

/* ============ imagem COM editor embutido (arrastar/zoom/girar/filtros) ============
   Usado só pelos campos marcados `editAspect:true` (hoje: fundo da capa) —
   um logo (fit:'meet', cabe inteiro) não faz sentido recortar, por isso
   continua no pickImage() simples acima. Reprocessa igual (tira EXIF/GPS),
   guarda a fonte saneada (pra poder reajustar depois sem perder qualidade
   de novo) — o editor em si é montado direto no painel por
   `EPImgEdit.mount()` (ver buildFields, ramo `image`+`editAspect`), sem
   popup, igual ao painel do Polaroide Studio. */
function readAndSanitizeImage(file, maxSide) {
  return new Promise((resolve, reject) => {
    if (file.size > 20 * 1024 * 1024) { reject(new Error('Imagem muito grande (máx. 20 MB).')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { reject(new Error('Imagem sem dimensões.')); return; }
        const scale = Math.min(1, (maxSide || 1800) / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        let out;
        try { out = cv.toDataURL('image/jpeg', 0.88); }
        catch (e) { reject(new Error('Não consegui processar a imagem.')); return; }
        if (out.length > 5.5e6) { try { out = cv.toDataURL('image/jpeg', 0.7); } catch (e) {} }
        if (out.length > 6e6) { reject(new Error('Imagem grande demais mesmo otimizada — use uma menor.')); return; }
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
// escolher um arquivo novo (ou trocar um existente) -> sanear ->
// cb({photoSrc, photoEdit}). Quem monta o editor (e assa a 1ª prévia assim
// que a imagem carrega) é o EPImgEdit.mount() no próprio buildFields().
function pickNewImage(opts) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
  inp.onchange = () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    readAndSanitizeImage(file).then(src => opts.cb({ photoSrc: src, photoEdit: opts.keepEdit || null }))
      .catch(err => toast(err.message || 'Não consegui processar a imagem.'));
  };
  inp.click();
}

/* ============ edição inline: clique duplo na página (estilo Canva) ============ */
let _inlineEl = null;
function closeInlineEditor() { if (_inlineEl) { _inlineEl.remove(); _inlineEl = null; } }
function inlineFields(T) {
  return (T.fields || []).filter(f => (f.type === 'text' || f.type === 'textarea') && !['items', 'startDate'].includes(f.k));
}
function openInlineEditor(sec, pageEl) {
  closeInlineEditor();
  const T = PAGE_TYPES[sec.type], flds = inlineFields(T);
  if (!flds.length) { toast('Esta página não tem texto pra editar aqui — use o painel à direita.'); return; }
  const box = document.createElement('div');
  box.className = 'inline-ed scrl';
  box.innerHTML = `<div class="ie-h"><span>Editar: ${esc(T.label)}</span><button class="iconbtn ghost" data-x title="Fechar (Esc)">${iconSVG('x')}</button></div>`;
  flds.forEach(f => {
    const cur = sec.opts[f.k] != null ? sec.opts[f.k] : (f.def || '');
    const id = 'ie_' + f.k;
    box.insertAdjacentHTML('beforeend', f.type === 'textarea'
      ? `<label>${esc(f.label)}<textarea id="${id}" rows="${f.rows || 4}">${esc(cur)}</textarea></label>`
      : `<label>${esc(f.label)}<input type="text" id="${id}" maxlength="120" value="${esc(cur)}"></label>`);
    const el = box.querySelector('#' + id);
    el.addEventListener('input', () => {
      const s = curSection(); if (!s) return;
      s.opts[f.k] = sanitizeText(el.value, f.type === 'textarea' ? 4000 : 80);
      clearTimeout(el._t); el._t = setTimeout(() => { rafRender(); save(); }, 120);
    });
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && f.type !== 'textarea') { ev.preventDefault(); closeInlineEditor(); } });
  });
  box.querySelector('[data-x]').onclick = closeInlineEditor;
  document.body.appendChild(box);
  _inlineEl = box;
  if (isMobile()) {
    box.classList.add('ie-mobile');
    const first = box.querySelector('input,textarea'); if (first) { first.focus(); if (first.select) first.select(); }
    return;
  }
  const r = pageEl.getBoundingClientRect();
  const w = Math.round(Math.min(340, Math.max(240, r.width * 0.82)));
  box.style.width = w + 'px';
  box.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + (r.width - w) / 2)) + 'px';
  box.style.top = Math.max(54, Math.min(innerHeight - box.offsetHeight - 12, r.top + 16)) + 'px';
  const first = box.querySelector('input,textarea'); if (first) { first.focus(); if (first.select) first.select(); }
}
document.addEventListener('pointerdown', e => {
  if (_inlineEl && !_inlineEl.contains(e.target) && !(e.target.closest && e.target.closest('.page'))) closeInlineEditor();
}, true);
addEventListener('keydown', e => { if (e.key === 'Escape') closeInlineEditor(); });

/* ================= eventos globais ================= */
function bindGlobal() {
  addEventListener('scroll', e => {
    const el = e.target;
    if (el instanceof Element && el.classList.contains('scrl')) { el.classList.add('is-scrolling'); clearTimeout(el._sT); el._sT = setTimeout(() => el.classList.remove('is-scrolling'), 1400); }
  }, true);

  stage.addEventListener('pointerdown', e => { if (e.target === stage || e.target === sheetsEl) { selectSection(null); closeInlineEditor(); } });

  // clicar numa página seleciona a seção dela; clicar 2× edita o texto ali mesmo
  const pageAt = t => { const pg = t.closest && t.closest('.page'); if (!pg) return null;
    const i = [...sheetsEl.children].indexOf(pg); const pages = expand();
    return pages[i] ? { pg, sec: state.sections.find(s => s.id === pages[i].sectionId) } : null; };
  let _mTapPg = null, _mTapT = 0;
  sheetsEl.addEventListener('click', e => {
    if (_inlineEl && _inlineEl.contains(e.target)) return;
    const hit = pageAt(e.target); if (!hit || !hit.sec) { _mTapPg = null; return; }
    if (!isMobile()) {
      if (hit.sec.id !== selId) selectSection(hit.sec.id, { noScroll: true });
      return;
    }
    // celular, estilo Canva: tocar numa página que JÁ está selecionada abre o
    // editor de texto ali mesmo; tocar numa página de outra seção só seleciona
    // (o 2º toque então edita).
    const already = hit.sec.id === selId;
    if ((already || _mTapPg === hit.pg) && inlineFields(PAGE_TYPES[hit.sec.type]).length) {
      _mTapPg = null; openInlineEditor(hit.sec, hit.pg); return;
    }
    _mTapPg = hit.pg;
    clearTimeout(_mTapT); _mTapT = setTimeout(() => { _mTapPg = null; }, 2500);
    if (!already) selectSection(hit.sec.id, { noScroll: true, fromPage: true });
  });
  sheetsEl.addEventListener('dblclick', e => {
    if (isMobile()) return;   // no celular quem cuida disso é o handler de "click" (2 toques)
    const hit = pageAt(e.target); if (hit && hit.sec) { e.preventDefault(); selectSection(hit.sec.id, { noScroll: true }); openInlineEditor(hit.sec, hit.pg); }
  });
  stage.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  let _pan = null;
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 1) return; e.preventDefault();
    _pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
    try { stage.setPointerCapture(e.pointerId); } catch (_) {} document.body.classList.add('panning');
  }, true);
  stage.addEventListener('pointermove', e => { if (!_pan) return; stage.scrollLeft = _pan.sl - (e.clientX - _pan.x); stage.scrollTop = _pan.st - (e.clientY - _pan.y); });
  const endPan = e => { if (!_pan) return; _pan = null; document.body.classList.remove('panning'); try { stage.releasePointerCapture(e.pointerId); } catch (_) {} };
  stage.addEventListener('pointerup', endPan); stage.addEventListener('pointercancel', endPan);

  stage.addEventListener('scroll', () => {
    const n = pageCount(); if (n < 2) return;
    const mid = stage.scrollTop + stage.clientHeight / 2;
    let best = 0, bd = 1e9;
    [...sheetsEl.children].forEach((pg, i) => { const c = pg.offsetTop * zoom + pg.offsetHeight * zoom / 2; const d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
    if (best !== currentPage) {
      currentPage = best;
      $('#pageLbl').textContent = `${best + 1} / ${n}`;
      const mpg = $('#mpg'); if (mpg) mpg.textContent = `Pág. ${best + 1}/${n}`;
      clearTimeout(stage._wT); stage._wT = setTimeout(() => refreshWindow(false), 90);
    }
  });

  let _pinch = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  stage.addEventListener('touchstart', e => { if (e.touches.length === 2) _pinch = { d: dist(e.touches) }; }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (!_pinch || e.touches.length !== 2) return; e.preventDefault();
    const d = dist(e.touches), cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    if (_pinch.d > 0 && d > 0) zoomAt(cx, cy, d / _pinch.d); _pinch.d = d;
  }, { passive: false });
  const endPinch = e => { if (_pinch && (!e.touches || e.touches.length < 2)) _pinch = null; };
  stage.addEventListener('touchend', endPinch); stage.addEventListener('touchcancel', endPinch);

  addEventListener('keydown', e => {
    const t = e.target, typing = t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); printDoc(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') {
      if (!$('#menu').hidden) { $('#menu').hidden = true; menuScrim(false); return; }
      if (zen) { zen = false; applyUI(); return; }
      if (selId) { selectSection(null); return; }
    }
    if (typing) return;
    if (e.key === '[') { togglePanel('left'); e.preventDefault(); }
    else if (e.key === ']') { togglePanel('right'); e.preventDefault(); }
    else if (e.key === '.') { zen = !zen; applyUI(); e.preventDefault(); }
    else if (e.key === 'PageDown' || e.key === 'ArrowDown') { gotoPage(currentPage + 1); e.preventDefault(); }
    else if (e.key === 'PageUp' || e.key === 'ArrowUp') { gotoPage(currentPage - 1); e.preventDefault(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { removeSection(selId); e.preventDefault(); }
  });
  addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
  addEventListener('dragleave', e => { if (e.relatedTarget === null) document.body.classList.remove('dropping'); });
  addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && /\.json$/i.test(f.name)) { e.preventDefault(); document.body.classList.remove('dropping'); importProject(f); }
  });
  let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { applyUI(); if (!userZoomed) fit(); }, 150); });
}

/* ================= init ================= */
(function init() {
  injectIcons();
  try {
    const u = JSON.parse(localStorage.getItem(UIKEY) || 'null');
    if (u && typeof u === 'object') { uiState.left = u.left !== false; uiState.right = u.right !== false; }
    else if (innerWidth < 1200) { uiState.right = false; if (innerWidth < 980) uiState.left = false; }
  } catch (e) {}
  if (isMobile()) { uiState.left = false; uiState.right = false; }
  bindDoc(); bindBar(); bindGlobal();
  if (typeof mSetup === 'function') mSetup();
  if (typeof initInstall === 'function') initInstall();
  setupColorFields();
  load();
  const hasSaved = state.sections.length > 0;
  const alreadyAsked = (() => { try { return sessionStorage.getItem('plannerstudio-resumed') === '1'; } catch (e) { return false; } })();
  if (hasSaved && !alreadyAsked) {
    showResumeAsk();
  } else {
    finishInit();
  }
  function finishInit() {
    if (state.sections.length) selId = state.sections[0].id;
    syncDocControls();
    applyUI();
    render();
    fit();
    injectIcons();
  }
  function markAsked() { try { sessionStorage.setItem('plannerstudio-resumed', '1'); } catch (e) {} }
  function showResumeAsk() {
    const box = $('#resumeAsk'); if (!box) { finishInit(); return; }
    const pageCount = expand().length;
    $('#ra_desc').textContent = `Encontramos um documento salvo neste navegador — ${state.sections.length} seç${state.sections.length === 1 ? 'ão' : 'ões'}, ${pageCount} página${pageCount === 1 ? '' : 's'}.`;
    box.hidden = false;
    document.body.classList.add('onboarding');
    $('#ra_continue').onclick = () => { markAsked(); box.hidden = true; document.body.classList.remove('onboarding'); finishInit(); };
    $('#ra_new').onclick = () => {
      if (!confirm('Começar um novo documento? O salvo continuará guardado até você editar algo.')) return;
      markAsked(); box.hidden = true;
      state = { settings: { ...DEFAULTS }, sections: [] };
      finishInit();
    };
  }
})();

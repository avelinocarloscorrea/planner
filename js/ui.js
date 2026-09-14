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
  chk('#d_reg', s.registration);
  chk('#d_tabs', s.monthTabs); set('#d_exportPart', s.exportPart);
  chk('#d_creep', s.bookletCreep);
  rng('#d_safe', s.safeMm, s.safeMm + ' mm');
  rng('#d_inkSave', s.inkSave, s.inkSave ? s.inkSave + '%' : 'desligada');
  set('#d_twoUpFit', s.twoUpFit); set('#d_duplexFlip', s.duplexFlip); set('#d_pdfColor', s.pdfColor);
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
    const size = `${W.toFixed(0)}×${H.toFixed(0)} mm`;
    const sheetLabel = ({ a4: 'A4', letter: 'Carta', a3: 'A3' })[eff.sheet] || 'A4';
    const twoUpHint = s.twoUpOrder === 'seq'
      ? `Duas páginas lado a lado por folha, em sequência (1-2, 3-4…). Imprima só a <b>frente</b>. Imprima em <b>100%</b>${s.twoUpFit === 'shrink' ? '' : ', sem margens'}.`
      : s.twoUpOrder === 'duplex'
      ? `Miolo dividido em 2 metades. Imprima <b>frente e verso</b> virando pela borda ${s.duplexFlip === 'long' ? 'longa' : 'curta'} e corte ao meio: cada metade já sai pronta, na ordem certa — sem reempilhar nada. Imprima em <b>100%</b>${s.twoUpFit === 'shrink' ? '' : ', sem margens'}.`
      : `Duas páginas lado a lado por folha. Imprima só a <b>frente</b>, corte ao meio e ponha a metade da direita sob a da esquerda — mantém a ordem. Imprima em <b>100%</b>${s.twoUpFit === 'shrink' ? '' : ', sem margens'}.`;
    const HINTS = {
      auto: eff.mode === '2up'
        ? `Decide sozinho: como duas páginas do miolo (${size} cada) cabem lado a lado numa folha ${sheetLabel}, aproveita a folha inteira. ${twoUpHint}`
        : eff.mode === 'fit'
        ? `Decide sozinho: como o miolo (${size}) não fecha uma folha ${sheetLabel}, sai centralizado com <b>marcas de corte</b>. Imprima em <b>100%</b>${s.twoUpFit === 'shrink' ? '' : ', sem margens'}.`
        : `Decide sozinho: como o miolo (${size}) já fecha (ou passa de) uma folha ${sheetLabel}, sai no <b>tamanho exato</b>. Imprima em <b>100%</b>.`,
      real: `Página no tamanho exato do miolo (${size})${s.bleedMm > 0 ? `, com ${s.bleedMm} mm de sangria` : ''}${s.cropMarks ? ' e marcas de corte fora da sangria' : ''}${s.pdfColor === 'cmyk' ? ' — PDF/X-4 em CMYK, pronto para a gráfica' : ''}. Imprima em <b>100%</b>.`,
      fit: `Miolo centralizado numa folha ${sheetLabel} com <b>marcas de corte</b>. Imprima em <b>100%</b>, sem margens, e corte na marca.`,
      '2up': twoUpHint,
      booklet: `Páginas reordenadas para virar livreto: imprima <b>frente e verso</b> virando pela borda ${s.duplexFlip === 'long' ? 'longa' : 'curta'}, empilhe e <b>dobre ao meio</b>. Imprima em <b>100%</b>${s.twoUpFit === 'shrink' ? '' : ', sem margens'}.`,
    };
    eh.innerHTML = HINTS[s.exportMode] || '';
  } }
  chk('#d_guide', s.showSafeGuide);
  set('#d_dpi', s.exportDPI);
  chk('#d_acrylic', s.acrylic);
  document.body.classList.toggle('acrylic', s.acrylic);
  if (typeof buildLabelFields === 'function') buildLabelFields();
  refreshColorFields();
  if (typeof mSync === 'function') mSync();
}
function bindDoc() {
  const P = PAGE_SIZES;
  const psel = $('#d_paper');
  Object.entries(P).forEach(([k, v]) => psel.add(new Option(v.label, k)));
  Object.entries(BINDINGS).forEach(([k, v]) => $('#d_binding').add(new Option(v.label, k)));
  // famílias de título: todas as fontes do núcleo (mesma fonte na tela e incorporada no PDF)
  if (typeof EPFontMetrics !== 'undefined' && $('#d_headingFont')) {
    const sel = $('#d_headingFont'); sel.innerHTML = '';
    const KIND = { texto: 'Texto', titulo: 'Títulos', manuscrita: 'Manuscritas e decorativas' };
    Object.entries(KIND).forEach(([kind, lbl]) => {
      const g = document.createElement('optgroup'); g.label = lbl;
      Object.entries(EPFontMetrics.families).filter(([, f]) => f.kind === kind).forEach(([k, f]) => g.appendChild(new Option(f.label, k)));
      sel.appendChild(g);
    });
  }

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
  $('#d_reg').onchange = e => commit('registration', e.target.checked);
  $('#d_tabs').onchange = e => commit('monthTabs', e.target.checked);
  $('#d_exportPart').onchange = e => { state.settings.exportPart = e.target.value; state.settings = migrate(state).settings; save(); };
  $('#b_calib').onclick = async () => {
    busy('Gerando folha de calibração…');
    try { const bytes = await EPPen.calibrationPdf({ color: state.settings.pdfColor }); downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'folha-de-calibracao.pdf'); }
    catch (e) { console.error(e); toast('Erro ao gerar a folha de calibração.'); }
    unbusy();
  };
  $('#d_creep').onchange = e => commit('bookletCreep', e.target.checked);
  bindRange('#d_safe', 'safeMm', ' mm');
  $('#d_safe').addEventListener('change', () => commit('safeMm', state.settings.safeMm));
  bindRange('#d_inkSave', 'inkSave', '%');
  $('#d_inkSave').addEventListener('change', () => commit('inkSave', state.settings.inkSave));
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
  // Sem pushHistory: é preferência de tela (como a do Polaroide Studio), não
  // conteúdo do documento — não deveria empurrar o Ctrl+Z de quem está editando.
  $('#d_acrylic').onchange = e => { state.settings.acrylic = e.target.checked; document.body.classList.toggle('acrylic', e.target.checked); save(); };
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
  const mm = v => v.toFixed(1).replace('.', ',');
  let t = `${n} páginas em ${e.sheets} ${e.sheets === 1 ? 'folha' : 'folhas'} · miolo com cerca de ${mm(e.thicknessMm)} mm`;
  if (bind === 'wireo') t += ` · garra wire-o ${e.wireo.label}`;
  else if (bind === 'spiral') t += ` · espiral de ${e.coil.mm} mm`;
  if (bind === 'staple' && !e.multipleOf4) t += ' · para grampear, use páginas em múltiplo de 4';
  el.textContent = t + '.';
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
  if (T.repeat) { $('#rs_count').value = Math.min(400, sec.count); $('#rs_countv').textContent = sec.count; const cn = $('#rs_countn'); if (cn && document.activeElement !== cn) cn.value = sec.count; }
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
addEventListener('keydown', e => { if (e.key === 'Escape') { closeCF(); closePop(); closeExportPop(); } }, true);
// fecha os popovers quando a PÁGINA rola — mas não quando o scroll acontece
// DENTRO do próprio popover (a lista de "Adicionar seção" tem rolagem própria).
addEventListener('scroll', e => {
  const t = e.target;
  if (_pop && (_pop === t || (t && t.nodeType === 1 && _pop.contains(t)))) return;
  if (cfOpen && cfOpen.pop && (cfOpen.pop === t || (t && t.nodeType === 1 && cfOpen.pop.contains(t)))) return;
  if (exportPopOpen && (t === $('#d_exportWrap') || (t && t.nodeType === 1 && $('#d_exportWrap').contains(t)))) return;
  closeCF(); closePop(); closeExportPop();
}, true);
addEventListener('resize', () => { closeCF(); closePop(); closeExportPop(); });

/* ================= popover "Configurar exportação" (ancorado no botão da barra) ================= */
// Regra transversal do plano: Exportação sai da lista do painel esquerdo — os campos
// (modo, folha, ordem 2-up, DPI) continuam sendo os MESMOS nós do DOM (mesmos ids,
// mesmos listeners já ligados em bindLeft), só exibidos como popover ancorado no
// botão da barra em vez de aberto dentro da lista que rola. No celular quem manda
// é o mobile.js (aba "Exportar" própria) — este popover só existe no desktop.
let exportPopOpen = false;
function closeExportPop() {
  const exp = $('#d_exportWrap');
  if (!exp || !exportPopOpen) return;
  exp.classList.remove('pop-open'); exp.open = false; exportPopOpen = false;
  $('#b_exportCfg') && $('#b_exportCfg').classList.remove('on');
}
function toggleExportPop(anchor) {
  const exp = $('#d_exportWrap');
  if (!exp || isMobile()) return;
  if (exportPopOpen) { closeExportPop(); return; }
  closeCF(); closePop();
  exp.open = true; exp.classList.add('pop-open'); exportPopOpen = true;
  anchor.classList.add('on');
  const r = anchor.getBoundingClientRect();
  exp.style.left = Math.max(8, Math.min(innerWidth - exp.offsetWidth - 8, r.right - exp.offsetWidth)) + 'px';
  exp.style.top = (r.bottom + 6 + exp.offsetHeight > innerHeight ? Math.max(8, r.top - 6 - exp.offsetHeight) : r.bottom + 6) + 'px';
}
document.addEventListener('pointerdown', e => {
  const exp = $('#d_exportWrap'), btn = $('#b_exportCfg');
  if (exportPopOpen && exp && !exp.contains(e.target) && !(btn && btn.contains(e.target))) closeExportPop();
});

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
  // quantidade exata: − / campo / + (o slider sozinho era impreciso no dedo)
  const setCount = n => { const s = curSection(); if (!s) return; pushHistory('count'); s.count = clamp(Math.round(n), 1, 2000);
    $('#rs_countv').textContent = s.count; $('#rs_count').value = Math.min(400, s.count); const cn = $('#rs_countn'); if (cn && document.activeElement !== cn) cn.value = s.count; rafRender(); save(); };
  $$('#rs_countRow [data-cnt]').forEach(b => b.onclick = () => { const s = curSection(); if (s) setCount(s.count + +b.dataset.cnt); });
  { const cn = $('#rs_countn'); if (cn) { cn.addEventListener('change', () => setCount(+cn.value || 1)); cn.addEventListener('keydown', e => { if (e.key === 'Enter') cn.blur(); }); } }
  $('#rs_count').addEventListener('input', () => { const cn = $('#rs_countn'); if (cn) cn.value = $('#rs_count').value; });
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
  {
    const zi = $('#zval');
    const commitZoom = () => {
      const v = clamp(parseFloat(zi.value) || Math.round(zoom * 100), 8, 300);
      userZoomed = true; zoom = v / 100; applyZoom();
    };
    zi.addEventListener('change', commitZoom);
    zi.addEventListener('keydown', e => { if (e.key === 'Enter') { commitZoom(); zi.blur(); } });
  }
  $('#pageLbl').onclick = e => { e.stopPropagation(); openGotoPagePop(e.currentTarget); };
  $('#b_pdf').onclick = exportPDF; $('#b_png').onclick = exportPNG;
  $('#b_print').onclick = printDoc;
  $('#b_exportCfg').onclick = e => { e.stopPropagation(); toggleExportPop(e.currentTarget); };
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
  $('#m_dupPage').onclick = () => { mclose(); dupCurrentPage(); };
  $('#m_pageGrid').onclick = () => { mclose(); openPageGrid(); };
  $('#m_history').onclick = () => { mclose(); openHistoryPop($('#b_more')); };
  $('#m_new').onclick = () => { mclose(); if (!state.sections.length || confirm('Começar um novo documento? O atual será descartado.')) { newDoc(TEMPLATES.find(t => t.id === 'branco')); toast('Novo documento.'); } };
  $('#m_save').onclick = () => { mclose(); exportProject(); };
  // predefinição: só os ajustes (papel, margens, cores, saída…), sem páginas nem fotos.
  // Abrir o arquivo em "Abrir projeto…" aplica os ajustes ao documento atual.
  $('#m_preset').onclick = () => { mclose(); const keep = PRESET_DROP.reduce((o, k) => (delete o[k], o), JSON.parse(JSON.stringify(state.settings)));
    downloadBlob(new Blob([JSON.stringify({ preset: true, app: 'plannerstudio', settings: keep })], { type: 'application/json' }), 'predefinicao-planner.json'); toast('Predefinição salva.'); };
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
  if (typeof PRINT_CTA_URL !== 'undefined' && PRINT_CTA_URL) {
    const mp = $('#m_print_cta'); if (mp) { mp.href = PRINT_CTA_URL; mp.target = '_blank'; mp.hidden = false; }
  }
  if (typeof FEEDBACK_URL !== 'undefined' && FEEDBACK_URL) {
    const mf = $('#m_feedback'); if (mf) { mf.href = FEEDBACK_URL; mf.target = '_blank'; mf.hidden = false; }
  }
  function buildTplCard(t) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'tpl-card' + (t.id === 'branco' ? ' tpl-card--blank' : '');
    b.innerHTML = `<span class="tpl-card__thumb">${tplThumbSVG(t)}</span>
      <span class="tpl-card__name">${esc(t.name)}</span>
      <span class="tpl-card__desc">${esc(t.desc)}</span>`;
    return b;
  }
  // templates da tela inicial (sem confirmação — não há nada a perder ainda)
  const tl = $('#tplList');
  if (tl) TEMPLATES.forEach(t => {
    const b = buildTplCard(t);
    b.onclick = () => { newDoc(t); toast('Modelo: ' + t.name); };
    tl.appendChild(b);
  });
  // mesma galeria, sempre acessível no painel esquerdo — com documento em
  // andamento, troca de modelo é destrutiva (igual "Novo documento"), então
  // pede confirmação antes (achado da auditoria: reabrir a galeria hoje só
  // existe na tela vazia, forçando "Novo documento" — que também apaga tudo
  // — como único caminho pra trocar de ideia no meio de um documento).
  const tlp = $('#tplListPanel');
  if (tlp) TEMPLATES.forEach(t => {
    const b = buildTplCard(t);
    b.onclick = () => {
      if (state.sections.length && !confirm('Aplicar o modelo "' + t.name + '"? O documento atual será substituído.')) return;
      newDoc(t); toast('Modelo: ' + t.name);
    };
    tlp.appendChild(b);
  });
}

/* edição de texto: direto na folha (js/sheet-edit.js + vendor/core/canvas-edit*.js) */
function closeInlineEditor() { if (typeof EPCanvasEditText !== 'undefined') EPCanvasEditText.close(); }

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
  // tocar/clicar numa página seleciona a seção e mostra os elementos editáveis;
  // tocar num elemento seleciona; tocar de novo (ou clique duplo) digita ali mesmo
  sheetsEl.addEventListener('click', e => {
    const hit = pageAt(e.target); if (!hit || !hit.sec) return;
    if (hit.sec.id !== selId) selectSection(hit.sec.id, { noScroll: true, fromPage: isMobile() });
    if (!sheetPageInfo(hit.pg)) { sheetEditor.clear(); return; }
    if (!sheetEditor.pick(hit.pg, e.clientX, e.clientY)) sheetEditor.show(hit.pg);
  });
  sheetsEl.addEventListener('dblclick', e => {
    if (isMobile()) return;
    const hit = pageAt(e.target); if (!hit || !hit.sec || !sheetPageInfo(hit.pg)) return;
    if (sheetEditor.pick(hit.pg, e.clientX, e.clientY)) { e.preventDefault(); sheetEditor.editText(); }
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
    [...sheetsEl.children].forEach((pg, i) => { if (pg.hidden) return; const c = pg.offsetTop * zoom + pg.offsetHeight * zoom / 2; const d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
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
      markAsked(); box.hidden = true;
      state = { settings: { ...DEFAULTS }, sections: [] };
      finishInit();
    };
  }
})();

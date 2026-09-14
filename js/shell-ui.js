/* Planner Studio — js/shell-ui.js
   Casca de interface: trilho de abas do painel esquerdo, etapas da barra
   (Modelo → Personalizar → Imprimir), diálogo "Imprimir e baixar" com a
   prévia REAL da folha (mesma imposição do PDF), verificação antes de
   imprimir e a galeria inicial com miniaturas desenhadas pelo próprio motor.
   Carregado por último: só liga peças novas nos mesmos ids/funções que
   ui.js/engine.js/io.js já definem. */
"use strict";

const SH_ICON = {
  auto: '<path d="M5 19L15 9"/><path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>',
  twoUp: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M12 5v14" stroke-dasharray="2 2"/>',
  fit: '<rect x="7" y="6" width="10" height="12" rx="1"/><path d="M3 6h2M6 3v2M19 6h2M18 3v2M3 18h2M6 19v2M19 18h2M18 19v2"/>',
  booklet: '<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5c-3-.5-6 0-8 1.5z"/><path d="M12 6v14.5"/>',
  real: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
  wand: '<path d="M4 20l10-10"/><path d="M15 3v3M13.5 4.5h3M19 8v2M18 9h2M9 3v2M8 4h2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const shIcon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SH_ICON[n]}</svg>`;
const SHEET_NAME = { a4: 'A4', letter: 'Carta', a3: 'A3' };
const paperShort = s => {
  const p = PAGE_SIZES[s.paper];
  if (s.paper === 'custom') return `${s.customW}×${s.customH} mm`;
  return p ? p.label.split(' — ')[0].replace(/\s*\(.*\)$/, '') : 'A5';
};

/* ================= trilho de abas ================= */
EPShell.initRail({
  rail: $('#rail'), panes: $('#panes'), storageKey: 'plannerstudio-pane', initial: 'paginas',
  isCollapsed: () => !isMobile() && !uiState.left,
  onCollapse: hide => { if (!isMobile()) togglePanel('left', !hide); },
});

/* ================= etapas da barra ================= */
function setStep(k) {
  ['st_model', 'st_edit', 'st_print'].forEach((id, i) => {
    const b = $('#' + id); if (!b) return;
    b.classList.toggle('on', i === k);
    b.classList.toggle('done', i < k);
  });
}
$('#st_model').onclick = () => openStart();
$('#st_edit').onclick = () => { const d = $('#exportDlg'); if (d.open) d.close(); closeStart(); };
$('#st_print').onclick = () => openExportDlg();

/* ================= tela inicial (galeria) ================= */
const TPL_CATS = [
  { id: 'estilo', label: 'Com estilo' },
  { id: 'agenda', label: 'Agendas' },
  { id: 'planner', label: 'Planners' },
  { id: 'caderno', label: 'Cadernos' },
];
const TPL_CAT = {
  semanal: 'agenda', diario: 'agenda', executiva: 'agenda',
  'semana-dupla': 'agenda', universitario: 'caderno', brochura: 'caderno', desenho: 'caderno',
  bujo: 'caderno', pautado: 'caderno', estudos: 'caderno', quadriculado: 'caderno', musica: 'caderno', projetos: 'caderno', 'bloco-notas': 'caderno',
  'rosa-poa': 'estilo', kraft: 'estilo', 'estudos-cor': 'estilo', 'agenda-marca': 'estilo', boho: 'estilo',
  refeicoes: 'planner', financeiro: 'planner', patrimonio: 'planner', 'cinco-min': 'planner', habitos: 'planner', bemestar: 'planner', leitura: 'planner',
};

// roda fn() com o documento do modelo no lugar do estado atual (o motor de
// desenho lê `state` global) e devolve o estado original em seguida.
function withTemplateState(t, fn) {
  const saved = state;
  try {
    state = migrate({ settings: { ...DEFAULTS, ...(t.settings || {}) }, sections: t.sections || [] });
    return fn();
  } finally { state = saved; }
}
function exportPageSVG(pages, i, total) {
  const [W, H] = paperWH();
  const pen = SvgPen(W, H, { bg: state.settings.paperBg });
  drawPageInto(pen, pages[i], i, { screen: false, print: true, total });
  return pen.svg();
}
// página "representativa" do miolo: 1ª página da seção com mais páginas
function representativePage(pages) {
  const counts = new Map();
  pages.forEach((p, i) => { if (p.type === 'cover' || p.filler) return; const c = counts.get(p.sectionId) || { n: 0, first: i }; c.n++; counts.set(p.sectionId, c); });
  let best = null;
  counts.forEach(c => { if (!best || c.n > best.n) best = c; });
  return best ? best.first : Math.min(1, pages.length - 1);
}
function pairThumbHTML(front, back, W, H) {
  const land = W / H > 1.05;
  const pg = (svg, cls) => `<span class="tt-pg ${cls}" data-ar="${(W / H).toFixed(4)}" data-land="${land ? 1 : 0}">${svg}</span>`;
  return `<span class="tt">${back != null ? pg(back, 'tt-back') : ''}${pg(front, 'tt-front')}</span>`;
}
// aplica proporção/posição via CSSOM (a CSP proíbe style="" no HTML)
function layoutPairThumb(host) {
  host.querySelectorAll('.tt-pg').forEach(el => {
    const ar = +el.dataset.ar, land = el.dataset.land === '1';
    el.style.aspectRatio = String(ar);
    const two = host.querySelectorAll('.tt-pg').length > 1;
    if (land) { el.style.width = two ? '62%' : '74%'; }
    else { el.style.height = two ? '80%' : '84%'; }
    if (!two) { el.style.left = '50%'; el.style.top = '50%'; el.style.transform = 'translate(-50%,-50%)'; return; }
    if (el.classList.contains('tt-back')) { el.style.right = '11%'; el.style.top = '6%'; el.style.transform = 'rotate(3deg)'; }
    else { el.style.left = '11%'; el.style.bottom = '6%'; }
  });
}
function templateThumb(t) {
  return withTemplateState(t, () => {
    const pages = expand(); const n = pages.length;
    if (!n) return '';
    const [W, H] = paperWH();
    const front = exportPageSVG(pages, 0, n);
    const bi = n > 1 ? representativePage(pages) : null;
    const back = bi != null && bi > 0 ? exportPageSVG(pages, bi, n) : null;
    return pairThumbHTML(front, back, W, H);
  });
}
function templateMeta(t) {
  return withTemplateState(t, () => `${paperShort(state.settings)} · ${expand().length} páginas`);
}
function specialThumb(icon) { return `<span class="tt-ic"><span>${shIcon(icon)}</span></span>`; }

function galleryItems(forPanel) {
  const items = [];
  if (!forPanel) {
    items.push({ id: '_wiz', name: 'Montar passo a passo', desc: 'Tipo, papel, capa, cores, encadernação e impressão — com prévia real a cada passo.', variant: 'wizard', always: true, thumb: () => specialThumb('wand') });
  }
  TEMPLATES.filter(t => t.id !== 'branco').forEach(t => items.push({
    id: t.id, name: t.name.replace(/\s+(A4|A5|B5)$/, ''), desc: t.desc, cat: TPL_CAT[t.id] || 'caderno', tpl: t,
    meta: templateMeta(t), thumb: () => templateThumb(t),
  }));
  const blank = TEMPLATES.find(t => t.id === 'branco');
  if (blank) items.push({ id: 'branco', name: 'Em branco', desc: 'Um caderno pontilhado simples para montar do seu jeito.', variant: 'blank', always: true, tpl: blank, meta: 'A5 · 40 páginas', thumb: () => specialThumb('plus') });
  return items;
}
function pickTemplate(it) {
  if (it.id === '_wiz') { if (typeof showWizardPane === 'function') showWizardPane(); $('#empty').scrollTop = 0; return; }
  const t = it.tpl; if (!t) return;
  const replacing = state.sections.length > 0;
  if (replacing && !confirm(`Trocar para o modelo "${t.name}"? O documento atual será substituído.`)) return;
  newDoc(t);
  closeStart();
  if (state.sections[0] && !isMobile()) selectSection(state.sections[0].id, { noScroll: true, fromPage: true });
  toast(isMobile() ? `"${t.name}" pronto. Ajuste e toque em Imprimir.` : `"${t.name}" pronto — ajuste o que quiser e clique em Imprimir e baixar.`);
}
const _gal = EPShell.gallery({
  grid: $('#tplList'), filters: $('#tplFilters'), categories: TPL_CATS,
  items: galleryItems(false), onPick: pickTemplate,
});
const _galPanel = EPShell.gallery({ grid: $('#tplListPanel'), items: galleryItems(true), onPick: pickTemplate });
$('#tplListPanel').className = 'ep-tpls ep-tpls--panel';
// miniaturas: aplica o posicionamento quando o SVG entra no cartão
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(nd => {
  if (nd.nodeType !== 1) return;
  if (nd.classList.contains('tt')) layoutPairThumb(nd);
  else nd.querySelectorAll && nd.querySelectorAll('.tt').forEach(layoutPairThumb);
}))).observe(document.body, { childList: true, subtree: true });

function openStart() {
  const d = $('#exportDlg'); if (d.open) d.close();
  if (typeof showTemplatesPane === 'function') showTemplatesPane();
  stage.scrollTop = 0;
  $('#empty').hidden = false;
  $('#ob_close').hidden = !state.sections.length;
  document.body.classList.add('onboarding');
  setStep(0);
}
function closeStart() {
  if (!state.sections.length) return;         // sem documento, a galeria é a tela
  $('#empty').hidden = true;
  document.body.classList.remove('onboarding');
  setStep(1);
  requestAnimationFrame(() => { if (!userZoomed) fit(); });
}
$('#ob_close').onclick = closeStart;
$('#ob_open').onclick = e => { e.preventDefault(); $('#file_open').click(); };
{ // o botão "voltar" do assistente, no 1º passo, volta pra galeria
  const back = $('#ob_wizBack');
  if (back) back.addEventListener('click', () => { $('#empty').scrollTop = 0; });
}

// "Bem-vindo de volta": miniatura do documento salvo
(function resumeThumb() {
  const ra = $('#resumeAsk'); if (!ra || ra.hidden) return;
  const pages = expand(); if (!pages.length) return;
  const [W, H] = paperWH();
  const bi = pages.length > 1 ? representativePage(pages) : null;
  $('#ra_thumb').innerHTML = pairThumbHTML(exportPageSVG(pages, 0, pages.length), bi ? exportPageSVG(pages, bi, pages.length) : null, W, H);
  const cov = state.sections.find(x => x.type === 'cover');
  const name = (cov && cov.opts && cov.opts.title) || 'Documento sem título';
  $('#ra_desc').innerHTML = `<b>${esc(name)}</b> · ${esc(paperShort(state.settings))} · ${pages.length} páginas, salvo neste navegador.`;
})();

/* ================= Imprimir e baixar ================= */
let xpIdx = 0;                  // índice (par) da 1ª folha mostrada na prévia
let xpCards = null, xpSheetSeg = null, xpOrderSeg = null, xpFitSeg = null, xpFlipSeg = null, xpColorSeg = null;

function xpSetup() {
  if (xpCards) return;
  xpCards = EPShell.optionCards($('#xp_modes'), $('#d_exportMode'), [
    { v: 'auto', title: 'Automático', badge: 'recomendado', icon: shIcon('auto'), desc: () => {
      const e = effectiveExportModeFor('auto');
      return `Escolhe o melhor aproveitamento da folha. Para este caderno: <b>${modeName(e)}</b>.`;
    } },
    { v: '2up', title: 'Em casa · 2 páginas por folha', icon: shIcon('twoUp'), desc: 'Duas páginas lado a lado. Imprima e corte a folha ao meio.' },
    { v: 'fit', title: 'Em casa · 1 página por folha', icon: shIcon('fit'), desc: 'Página centralizada com marcas de corte nos cantos.' },
    { v: 'booklet', title: 'Livreto dobrado', icon: shIcon('booklet'), desc: 'Frente e verso; empilhe, dobre ao meio e grampeie.' },
    { v: 'real', title: 'Gráfica · tamanho exato', icon: shIcon('real'), desc: 'Uma página por folha no tamanho final, com sangria opcional.' },
  ]);
  xpSheetSeg = EPShell.segmented($('#xp_sheet'), $('#d_sheet'));
  xpOrderSeg = EPShell.segmented($('#xp_order'), $('#d_twoUpOrder'));
  xpFitSeg = EPShell.segmented($('#xp_fit'), $('#d_twoUpFit'));
  xpFlipSeg = EPShell.segmented($('#xp_flip'), $('#d_duplexFlip'));
  xpColorSeg = EPShell.segmented($('#xp_color'), $('#d_pdfColor'));
  // sem aviso a cada troca (o próprio diálogo já mostra o resultado)
  const commitExp = (k, v) => { state.settings[k] = v; state.settings = migrate(state).settings; syncDocControls(); save(); };
  $('#d_exportMode').onchange = e => commitExp('exportMode', e.target.value);
  $('#d_sheet').onchange = e => commitExp('sheet', e.target.value);
  $('#d_twoUpOrder').onchange = e => commitExp('twoUpOrder', e.target.value);
  $('#d_twoUpFit').onchange = e => commitExp('twoUpFit', e.target.value);
  $('#d_duplexFlip').onchange = e => commitExp('duplexFlip', e.target.value);
  $('#d_pdfColor').onchange = e => commitExp('pdfColor', e.target.value);
  let t;
  $('#xp_body').addEventListener('input', () => { clearTimeout(t); t = setTimeout(xpRefresh, 120); });
  $('#xp_body').addEventListener('change', () => { clearTimeout(t); t = setTimeout(xpRefresh, 30); });
}
function effectiveExportModeFor(mode) {
  const old = state.settings.exportMode;
  state.settings.exportMode = mode;
  try { return effectiveExportMode(); } finally { state.settings.exportMode = old; }
}
function modeName(e) {
  const sh = SHEET_NAME[e.sheet] || 'A4';
  return ({ real: 'tamanho exato', fit: `1 por folha ${sh}`, '2up': `2 por folha ${sh}`, booklet: `livreto em ${sh}` })[e.mode] || e.mode;
}

function xpRefresh() {
  const dlg = $('#exportDlg');
  const pages = expand(), n = pages.length;
  if (!n) return;
  const s = state.settings, [W, H] = paperWH();
  const eff = effectiveExportMode();
  const plan = impositionPlan(n);
  const duplex = !!plan.duplex;
  const total = plan.sheets.length;
  if (xpCards) xpCards.build();
  if (xpSheetSeg) xpSheetSeg.sync();
  if (xpOrderSeg) xpOrderSeg.sync();
  [xpFitSeg, xpFlipSeg, xpColorSeg].forEach(g => g && g.sync());
  $('#d_sheetRow').hidden = eff.mode === 'real' || s.exportMode === 'auto';
  $('#d_twoUpRow').hidden = eff.mode !== '2up';
  $('#d_fitRow').hidden = !(eff.mode === '2up' || eff.mode === 'booklet');
  $('#d_flipRow').hidden = !duplex;
  $('#d_regRow').hidden = !(s.cropMarks && eff.mode === 'real');
  $('#d_creepRow').hidden = eff.mode !== 'booklet';
  xpIdx = clamp(xpIdx - (xpIdx % 2), 0, Math.max(0, total - 1 - ((total - 1) % 2)));

  // ---- prévia: 2 lados (frente/verso) ou 2 folhas seguidas ----
  const sheetView = k => {
    const sh = plan.sheets[k]; if (!sh) return null;
    const dopt = slotDrawOpts(plan, n);
    const slots = sh.slots.map(sl => ({
      x: sl.ox, y: sl.oy, w: W * sl.sc, h: H * sl.sc, num: sl.src + 1, rot: sl.rot, clip: sl.clip,
      svg: (() => { const pen = SvgPen(W, H, { bg: s.paperBg });
        drawPageInto(pen, pages[sl.src], sl.src, dopt);
        return pen.svg(); })(),
    }));
    // prévia com as caixas de corte (azul) e sangria (vermelho) — o que a gráfica vai refilar
    return EPShell.sheetSVG({ w: plan.sheetW, h: plan.sheetH, slots, marks: sh.marks, foldX: sh.foldX, foldY: sh.foldY,
      trimBox: sh.trimBox, bleedBox: sh.bleedBox, trimBoxes: sh.trimBoxes, guides: plan.paper || plan.mode === 'fit' });
  };
  const a = sheetView(xpIdx), b = sheetView(xpIdx + 1);
  const physical = duplex ? Math.ceil(total / 2) : total;
  const capA = duplex ? `Folha ${xpIdx / 2 + 1} · frente` : `Folha ${xpIdx + 1}`;
  const capB = duplex ? `Folha ${xpIdx / 2 + 1} · verso` : `Folha ${xpIdx + 2}`;
  const box = $('#xp_preview');
  box.innerHTML = `<div class="ep-sheet__stage${plan.sheetW > plan.sheetH * 1.05 ? ' ep-sheet__stage--col' : ''}">` +
    (a ? `<div class="ep-sheet__page">${a}<span class="ep-sheet__cap">${capA}</span></div>` : '') +
    (b ? `<div class="ep-sheet__page">${b}<span class="ep-sheet__cap">${capB}</span></div>` : '') +
    `</div><div class="ep-sheet__nav"><button type="button" class="iconbtn ghost" data-nav="-2" title="Anterior">${iconSVG('chevleft')}</button>` +
    `<span>${duplex ? `folha ${xpIdx / 2 + 1} de ${physical}` : `folhas ${xpIdx + 1}–${Math.min(total, xpIdx + 2)} de ${total}`}</span>` +
    `<button type="button" class="iconbtn ghost" data-nav="2" title="Próxima">${iconSVG('chevright')}</button></div>`;
  box.querySelectorAll('[data-nav]').forEach(bt => {
    const d = +bt.dataset.nav;
    bt.disabled = (d < 0 && xpIdx === 0) || (d > 0 && xpIdx + 2 >= total);
    bt.onclick = () => { xpIdx = clamp(xpIdx + d, 0, total - 1); xpRefresh(); };
  });

  // ---- resumo ----
  const sheetName = plan.paper ? `${W.toFixed(0)}×${H.toFixed(0)} mm` : (SHEET_NAME[eff.sheet] || 'A4');
  const sides = duplex ? `imprimir <b>frente e verso</b>, virando pela borda ${s.duplexFlip === 'long' ? 'longa' : 'curta'}` : (eff.mode === '2up' || !s.mirrorMargins) ? 'imprimir só a <b>frente</b>' : `frente e verso: <b>${Math.ceil(total / 2)} folhas</b>`;
  $('#xp_summary').innerHTML = `<span class="big">${physical}</span><span class="txt"><b>${physical === 1 ? 'folha' : 'folhas'} ${esc(sheetName)}</b> para ${n} páginas · ${sides}</span>`;
  $('#xp_sub').textContent = `${paperShort(s)} · ${n} páginas · ${modeName(eff)}`;

  // ---- verificação ----
  const chk = [];
  const sc = plan.sheets[0] && plan.sheets[0].slots[0] ? plan.sheets[0].slots[0].sc : 1;
  chk.push({ level: 'ok', text: `Páginas de <b>${W.toFixed(1).replace('.0', '')}×${H.toFixed(1).replace('.0', '')} mm</b>, PDF vetorial com <b>fontes incorporadas</b>.` });
  if (s.pdfColor === 'cmyk') {
    chk.push({ level: 'ok', text: 'Cores em <b>CMYK (FOGRA39)</b>, textos e linhas cinza só no preto (K), caixas de corte e sangria: <b>PDF/X-4</b>.' });
    if (eff.mode === 'real' && !(s.bleedMm >= 3) && state.sections.some(x => x.type === 'cover'))
      chk.push({ level: 'warn', text: 'Para gráfica, use <b>3 mm de sangria</b> — sem ela, a capa pode ficar com filete branco no refile.',
        action: { label: 'Usar 3 mm', fn: () => { state.settings.bleedMm = 3; state.settings = migrate(state).settings; syncDocControls(); save(); xpRefresh(); } } });
  }
  if (eff.mode === '2up' && sc >= 0.999 && plan.overflow === false && Math.min(plan.sheets[0] ? plan.sheets[0].trimBox.x : 9, plan.sheets[0] ? plan.sheets[0].trimBox.y : 9) < 3) {
    chk.push({ level: 'info', text: 'Tamanho exato: as páginas encostam na borda da folha. Se a sua impressora não imprime sem margem, a borda externa pode sair cortada.',
      action: { label: 'Reduzir para caber', fn: () => { $('#d_twoUpFit').value = 'shrink'; $('#d_twoUpFit').dispatchEvent(new Event('change', { bubbles: true })); } } });
  }
  if (plan.overflow) chk.push({ level: 'warn', text: `Duas páginas de ${W.toFixed(0)}×${H.toFixed(0)} mm <b>não cabem</b> na folha ${SHEET_NAME[eff.sheet] || ''} em tamanho exato.`,
    action: { label: 'Reduzir para caber', fn: () => { $('#d_twoUpFit').value = 'shrink'; $('#d_twoUpFit').dispatchEvent(new Event('change', { bubbles: true })); } } });
  if (duplex && total % 2) chk.push({ level: 'info', text: 'Frente e verso com número ímpar de lados: o último verso fica em branco.' });
  if (sc < 0.985) {
    chk.push({ level: 'warn', text: `As páginas vão sair <b>reduzidas a ${Math.round(sc * 100)}%</b> para caber na folha ${SHEET_NAME[eff.sheet] || ''}.`,
      action: eff.sheet !== 'a3' && s.exportMode !== 'auto' ? { label: 'Usar A3', fn: () => { $('#d_sheet').value = 'a3'; $('#d_sheet').dispatchEvent(new Event('change', { bubbles: true })); } }
        : { label: 'Tamanho exato', fn: () => { $('#d_exportMode').value = 'real'; $('#d_exportMode').dispatchEvent(new Event('change', { bubbles: true })); } } });
  }
  if (eff.mode === 'booklet') {
    const pad = Math.max(4, Math.ceil(n / 4) * 4) - n;
    if (pad) chk.push({ level: 'info', text: `Livreto precisa de páginas em múltiplo de 4: <b>${pad} em branco</b> no final.` });
    if (n > 64) chk.push({ level: 'warn', text: `Livreto com ${n} páginas fica grosso demais para dobrar. Para cadernos grandes, prefira <b>2 por folha</b> e espiral/wire-o.`,
      action: { label: 'Usar 2 por folha', fn: () => { $('#d_exportMode').value = '2up'; $('#d_exportMode').dispatchEvent(new Event('change', { bubbles: true })); } } });
  }
  const bind = BINDINGS[s.binding];
  if (bind && bind.punch) {
    chk.push({ level: 'info', text: `Margem de <b>${bindingInner().toFixed(0)} mm</b> reservada para ${esc(bind.label.toLowerCase())}${outputDuplex() ? ' — no verso ela passa para a direita' : ''}${s.printPunch ? ', com guia de furos na medida da máquina' : ''}.` });
  } else if (s.binding === 'none' && n > 40) {
    chk.push({ level: 'info', text: `Sem encadernação definida. Vai usar espiral ou wire-o? Reserve a margem certa.`,
      action: { label: 'Definir', fn: () => { $('#exportDlg').close(); showPane('papel'); } } });
  }
  const cov = state.sections.find(x => x.type === 'cover');
  if (cov && eff.mode !== 'real' && (['solid', 'split'].includes(cov.opts.style) || cov.opts.bg)) {
    chk.push({ level: 'info', text: 'A capa tem cor até a borda. Impressoras de casa costumam deixar <b>3–5 mm brancos</b> na borda da folha — para capa sangrada, use gráfica ou apare depois.' });
  }
  if (cov && !String(cov.opts.title || '').trim()) {
    chk.push({ level: 'warn', text: 'A capa está <b>sem título</b>.', action: { label: 'Editar capa', fn: () => { $('#exportDlg').close(); selectSection(cov.id); } } });
  }
  if (typeof EPBinding !== 'undefined' && typeof EPBinding.estimate === 'function' && n > 1) {
    try {
      const e = EPBinding.estimate({ pages: n, gsm: s.bindPaperGsm, paperKind: s.bindPaperKind });
      chk.push({ level: 'info', text: `Miolo com cerca de <b>${e.thicknessMm.toFixed(1)} mm</b> de espessura em papel ${s.bindPaperGsm} g${bind && bind.punch === 'wireo' ? ` · garra wire-o ${esc(e.wireo.label)}` : ''}.` });
    } catch (e) {}
  }
  EPShell.checklist($('#xp_check'), chk);
  if (dlg && dlg.open) injectIcons(dlg);
}
function showPane(id) {
  const b = $(`#rail [data-pane="${id}"]`); if (!b) return;
  if (!uiState.left && !isMobile()) togglePanel('left', true);
  if (!b.classList.contains('on')) b.click();
  if (isMobile() && typeof mOpenTab === 'function') mOpenTab('documento');
}
function openExportDlg() {
  if (!expand().length) { toast('Escolha um modelo ou adicione uma seção primeiro.'); return; }
  closePop(); closeInlineEditor();
  xpSetup();
  xpIdx = 0;
  if (isMobile()) { if (typeof mOpenTab === 'function') mOpenTab('exportar'); xpRefresh(); return; }
  syncDocControls();
  xpRefresh();
  const d = $('#exportDlg');
  if (!d.open) d.showModal();
  setStep(2);
}
$('#exportDlg').addEventListener('close', () => setStep(1));
$('#b_exportCfg').onclick = e => { e.stopPropagation(); openExportDlg(); };
$('#b_grid').onclick = () => openPageGrid();
$('#m_print').onclick = () => { $('#menu').hidden = true; menuScrim(false); openExportDlg(); };

// syncDocControls também atualiza a prévia se o diálogo/aba estiver aberto
{
  const _sync = syncDocControls;
  syncDocControls = function () {
    _sync();
    const d = $('#exportDlg');
    if ((d && d.open) || (isMobile() && typeof mTab !== 'undefined' && mTab === 'exportar')) { clearTimeout(syncDocControls._t); syncDocControls._t = setTimeout(xpRefresh, 20); }
  };
}
// Ctrl/Cmd+P abre o diálogo (com a prévia) em vez de imprimir às cegas;
// dentro do diálogo, Ctrl+P imprime de verdade.
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    const d = $('#exportDlg');
    if (d && d.open) return;                 // deixa o handler de ui.js imprimir
    e.preventDefault(); e.stopImmediatePropagation(); openExportDlg();
  }
}, true);

injectIcons();
setStep(document.body.classList.contains('onboarding') ? 0 : 1);

// Esc com um diálogo aberto só fecha o diálogo (não desmarca a seção atrás dele)
addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.querySelector('dialog[open]')) e.stopImmediatePropagation();
}, true);

// campos da capa que só fazem sentido com logo / imagem de fundo
{
  const _fill = fillRight;
  fillRight = function () {
    _fill();
    const sec = curSection(); if (!sec || sec.type !== 'cover') return;
    const hide = (id, on) => { const el = $('#' + id); const lb = el && el.closest('label'); if (lb) lb.hidden = on; };
    hide('fld_logoScale', !sec.opts.logo); hide('fld_logoPos', !sec.opts.logo);
    hide('fld_bgDim', !sec.opts.bg);
  };
}

EPShell.ready();

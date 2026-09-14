/* Planner Studio — js/mobile.js
   Casca de celular (≤ 820 px). O MESMO DOM do desktop é reaproveitado: o palco
   e os painéis esquerdo/direito são movidos entre a casca de desktop (#app) e a
   de celular (#mroot) conforme a largura. O motor (engine/io) é o mesmo.
   (parte de app; carregado em ordem por index.html) */
"use strict";

let mTab = 'paginas';

function mPlace() {
  const app = $('#app'), stg = $('#stage'), left = $('#left'), right = $('#right');
  const wrap = $('#mstageWrap'), shL = $('#msheet_doc'), shR = $('#msheet_sec');
  // corpo do "Imprimir e baixar": no desktop mora no diálogo #exportDlg; no
  // celular vai para a aba "Imprimir" (mesmos nós, mesmos listeners).
  const exp = $('#xp_body'), mxMount = $('#mx_settings'), dlgHost = $('#xp_bodyHost');
  const prev = $('#xp_prevHost'), dlgMain = $('#exportDlg .xdlg-main');
  const cbar = $('#canvasbar');
  if (!app || !stg || !wrap) return;
  if (isMobile()) {
    if (stg.parentElement !== wrap) wrap.appendChild(stg);
    if (left && left.parentElement !== shL) shL.appendChild(left);
    if (right && right.parentElement !== shR) shR.appendChild(right);
    if (prev && mxMount && prev.parentElement !== mxMount) mxMount.appendChild(prev);
    if (exp && mxMount && exp.parentElement !== mxMount) mxMount.appendChild(exp);
    document.body.classList.add('is-mobile');
  } else if (stg.parentElement !== app) {
    // restaura a ordem: #bar (fixo), #left, #stage, barra flutuante, #right
    if (exp && dlgHost && exp.parentElement !== dlgHost) dlgHost.appendChild(exp);
    if (prev && dlgMain && prev.parentElement !== dlgMain) dlgMain.insertBefore(prev, dlgMain.firstChild);
    if (left) app.appendChild(left);
    app.appendChild(stg);
    if (cbar) app.appendChild(cbar);
    if (right) app.appendChild(right);
    document.body.classList.remove('is-mobile');
  }
}

let _mCollapsedOnce = false;
function mCollapseDocPanels() {
  // No celular a aba "Documento" junta a lista de seções + todos os ajustes.
  // Deixa só a lista aberta na primeira vez, pra não enterrar Papel/Margens/etc.
  if (_mCollapsedOnce || !isMobile()) return;
  _mCollapsedOnce = true;
  const dets = $$('#left > details');
  dets.forEach((d, i) => { d.open = i === 0; });
}

// Arrastar pra baixo fecha — portado do Polaroide Studio (js/m-core.js).
// `grab` é a barrinha (só ela recebe o gesto, o resto da folha rola normal);
// `sheet` é o elemento que desliza; `onClose` roda quando o arraste passa do
// limiar de distância OU de velocidade (arraste rápido mas curto também
// fecha, exatamente como no Polaroide).
function mDragClose(grab, sheet, onClose) {
  if (!grab || !sheet) return;
  let y0 = 0, dy = 0, t0 = 0, on = false;
  grab.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); on = true;
    sheet.style.transition = 'none';
  }, { passive: true });
  grab.addEventListener('touchmove', e => {
    if (!on) return;
    dy = e.touches[0].clientY - y0; if (dy < 0) dy = 0;
    sheet.style.transform = 'translateY(' + dy + 'px)';
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  grab.addEventListener('touchend', () => {
    if (!on) return;
    on = false;
    const vy = dy / Math.max(1, Date.now() - t0);
    sheet.style.transition = ''; sheet.style.transform = '';
    if (dy > 120 || (dy > 44 && vy > 0.5)) onClose();
  }, { passive: true });
  // gesto interrompido (notificação, troca de app, edge-swipe do sistema) —
  // sem isso a folha ficava com transform/transition presos a meio caminho
  // até o próximo arraste, já que #menu é reaproveitado (não recriado).
  grab.addEventListener('touchcancel', () => {
    if (!on) return;
    on = false;
    sheet.style.transition = ''; sheet.style.transform = '';
  }, { passive: true });
}
// Garante a pega num elemento de folha (#menu, ou um popmenu criado na hora
// — ver ui.js) sem duplicar se já existir.
function mEnsureGrab(sheet) {
  let g = sheet.querySelector('.m-grab');
  if (!g) { g = document.createElement('div'); g.className = 'm-grab'; g.appendChild(document.createElement('i')); sheet.insertBefore(g, sheet.firstChild); }
  return g;
}

function mSetup() {
  mPlace();
  mCollapseDocPanels();
  { const men = $('#menu'); if (men) mDragClose(mEnsureGrab(men), men, () => { men.hidden = true; menuScrim(false); }); }
  $$('#mtabs button').forEach(b => b.onclick = () => mOpenTab(b.dataset.tab));
  const fab = $('#mfab'); if (fab) fab.onclick = () => openTypeMenu(fab);
  const goSec = $('#re_goSecoes'); if (goSec) goSec.onclick = () => mOpenTab('documento');
  $('#mu_undo') && ($('#mu_undo').onclick = undo);
  $('#mu_redo') && ($('#mu_redo').onclick = redo);
  /* #mu_more é religado por ui.js depois (ordem de carga); a lógica de scrim
     mora lá, em menuScrim(). Nada a fazer aqui. */
  $('#mx_pdf') && ($('#mx_pdf').onclick = exportPDF);
  $('#mx_png') && ($('#mx_png').onclick = exportPNG);
  $('#mx_print') && ($('#mx_print').onclick = printDoc);
  $('#mx_save') && ($('#mx_save').onclick = exportProject);
  $('#mx_open') && ($('#mx_open').onclick = () => $('#file_open').click());
  $('#msel_adjust') && ($('#msel_adjust').onclick = () => { _selBarExpanded = !_selBarExpanded; mSyncRight(curSection()); });
  mOpenTab('paginas');
  let rt, wasMob = isMobile();
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      mPlace();
      const nowMob = isMobile();
      if (nowMob !== wasMob) { wasMob = nowMob; if (typeof renderSectionList === 'function') renderSectionList(); }
      if (!userZoomed) fit();
    }, 160);
  });
}

function mOpenTab(tab) {
  if (!isMobile()) return;
  if (typeof closePop === 'function') closePop();
  if (typeof closeInlineEditor === 'function') closeInlineEditor();
  { const mn = $('#menu'); if (mn) mn.hidden = true; }
  if (typeof menuScrim === 'function') menuScrim(false);
  mTab = tab;
  $$('#mtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.msheet').forEach(s => s.hidden = (s.dataset.tab !== tab));
  const w = $('#mstageWrap'); if (w) w.hidden = (tab !== 'paginas');
  // O "+" (adicionar seção) só faz sentido vendo as páginas ou a lista de seções.
  const fab = $('#mfab'); if (fab) fab.hidden = !(tab === 'paginas' || tab === 'documento');
  if (tab === 'paginas' && !userZoomed) requestAnimationFrame(fit);
  if (tab === 'exportar' && typeof xpRefresh === 'function') { if (typeof xpSetup === 'function') xpSetup(); requestAnimationFrame(xpRefresh); }
  const sh = $$('.msheet').find(s => s.dataset.tab === tab); if (sh) sh.scrollTop = 0;
}

function mSync() {
  const mp = $('#mpg');
  if (mp) { const n = pageCount(); mp.textContent = n > 1 ? `Pág. ${currentPage + 1}/${n}` : ''; }
  // sem seções ainda: a tela de boas-vindas já traz os modelos + "do zero",
  // o "+" flutuante só atrapalha por cima dos cards.
  const fab = $('#mfab');
  if (fab && isMobile()) {
    const empty = !state.sections.length;
    if (empty) fab.hidden = true;
    else if ((mTab === 'paginas' || mTab === 'documento')) fab.hidden = false;
  }
}

/* ================= barra de seleção curta (aba "Seção", só mobile) =================
   Padrão portado do Polaroide Studio: tocar numa seção mostra uma barrinha
   curta (nome + "Ajustar") em vez de despejar o painel #right inteiro (denso,
   com Tipo/Contagem/todos os campos daquele tipo de página) — o painel
   completo só abre se a pessoa pedir. Cada seleção NOVA volta a nascer
   recolhida, igual ao comportamento do Polaroide. */
let _selBarExpanded = false, _selBarLastId = null;
function mSyncRight(sec) {
  const bar = $('#msel_bar'), sheet = $('#msheet_sec');
  if (!bar || !sheet) return;
  if (!isMobile() || !sec) {
    bar.hidden = true; sheet.classList.remove('collapsed');
    _selBarLastId = null;
    return;
  }
  if (sec.id !== _selBarLastId) { _selBarExpanded = false; _selBarLastId = sec.id; }
  bar.hidden = false;
  $('#msel_name').textContent = sectionLabel(sec, []);
  $('#msel_adjust').textContent = _selBarExpanded ? 'Recolher' : 'Ajustar';
  sheet.classList.toggle('collapsed', !_selBarExpanded);
}

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
  const exp = $('#d_exportWrap'), mxMount = $('#mx_settings'), privNote = $('#d_privadoNote');
  if (!app || !stg || !wrap) return;
  if (isMobile()) {
    if (stg.parentElement !== wrap) wrap.appendChild(stg);
    if (left && left.parentElement !== shL) shL.appendChild(left);
    if (right && right.parentElement !== shR) shR.appendChild(right);
    // os ajustes de montagem/folha/dpi vivem na aba "Exportar", não no meio dos
    // ajustes de documento.
    if (exp && mxMount && exp.parentElement !== mxMount) { mxMount.appendChild(exp); exp.open = true; }
    document.body.classList.add('is-mobile');
  } else if (stg.parentElement !== app) {
    // restaura a ordem: #bar (fixo), #left, #stage, #right
    if (exp && left && privNote && exp.parentElement !== left) left.insertBefore(exp, privNote);
    if (left) app.appendChild(left);
    app.appendChild(stg);
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

function mSetup() {
  mPlace();
  mCollapseDocPanels();
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
function mSyncRight() {/* mesmo DOM do desktop; nada a fazer */ }

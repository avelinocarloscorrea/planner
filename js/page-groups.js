/* Planner Studio — js/page-groups.js
   Páginas repetidas agrupadas na prévia: uma seção com 120 páginas pautadas
   (ou 53 semanas) aparece como UMA miniatura com o selo "×120". Tocar nela
   seleciona a seção para editar. Padrão no celular; no computador liga/desliga
   pelo menu ⋯. O PDF e a impressão continuam com todas as páginas.
   (parte de app; carregado depois de ui.js) */
"use strict";

const PG_KEY = 'plannerstudio-groups';
let pageGroupsOn = (() => { try { const v = localStorage.getItem(PG_KEY); return v == null ? isMobile() : v === '1'; } catch (e) { return isMobile(); } })();

// sequências: índice da 1ª página e tamanho de cada seção contínua
function pageRuns(pages) {
  const runs = [];
  pages.forEach((p, i) => {
    const last = runs[runs.length - 1];
    if (last && !p.filler && last.sec === p.sectionId && last.type === p.type) { last.n++; return; }
    runs.push({ first: i, n: 1, sec: p.filler ? null : p.sectionId, type: p.type });
  });
  return runs;
}
function applyPageGroups() {
  const pages = expand(), kids = sheetsEl.children;
  if (kids.length < pages.length) return;
  const runs = pageRuns(pages);
  runs.forEach(r => {
    for (let k = 0; k < r.n; k++) {
      const el = kids[r.first + k]; if (!el) continue;
      const grouped = pageGroupsOn && r.n > 1;
      el.hidden = grouped && k > 0;
      if (grouped && k === 0) { el.dataset.rep = '×' + r.n; el.dataset.repLabel = 'páginas'; }
      else { delete el.dataset.rep; delete el.dataset.repLabel; }
    }
  });
  const b = $('#m_groups'); if (b) b.checked = pageGroupsOn;
}
// página visível que representa o índice i (a 1ª da sequência quando agrupado)
function visiblePageFor(i) {
  const kids = sheetsEl.children; let j = i;
  while (j > 0 && kids[j] && kids[j].hidden) j--;
  return kids[j];
}
function setPageGroups(on) {
  pageGroupsOn = !!on;
  try { localStorage.setItem(PG_KEY, on ? '1' : '0'); } catch (e) {}
  applyPageGroups(); refreshWindow(true);
  const pg = visiblePageFor(currentPage); if (pg) pg.scrollIntoView({ block: 'center' });
}
{
  const _render = render;
  render = function () { _render.apply(this, arguments); applyPageGroups(); groupWindow(); };
  const _rw = refreshWindow;
  refreshWindow = function () { _rw.apply(this, arguments); groupWindow(); };
  // com as páginas agrupadas, as miniaturas vizinhas na TELA podem estar longe no
  // índice — desenha as visíveis próximas da atual (em ordem de tela)
  function groupWindow() {
    if (!pageGroupsOn) return;
    const pages = expand(), total = pages.length, kids = [...sheetsEl.children];
    if (kids.length !== total) return;
    const vis = kids.map((el, i) => ({ el, i })).filter(x => !x.el.hidden);
    const at = Math.max(0, vis.findIndex(x => x.i >= currentPage) - 1);
    vis.slice(Math.max(0, at - WINDOW), at + WINDOW + 1).forEach(({ el, i }) => {
      const sig = pageSig(i, pages[i]) + '|' + total;
      if (el.dataset.sig !== sig) { el.innerHTML = buildSVG(i, pages[i], total); el.dataset.sig = sig; }
    });
  }
  const _goto = gotoPage;
  gotoPage = function (i) {
    _goto.apply(this, arguments);
    if (!pageGroupsOn) return;
    const pg = visiblePageFor(currentPage); if (pg) pg.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
}
{ const b = $('#m_groups'); if (b) b.addEventListener('change', e => setPageGroups(e.target.checked)); }

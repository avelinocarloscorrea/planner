/* Planner Studio — js/ui-sections.js
   Lista de seções do painel esquerdo, menus flutuantes (seção, histórico,
   ir para página, grade de páginas, tipos de página).
   (parte de app; carregado antes de ui.js, que chama estas funções no init) */
"use strict";

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
    `<div class="m-grab"><i></i></div><div class="tm-head"><span>${sec ? esc(sectionLabel(sec, [])) : 'Seção'}</span><button class="iconbtn ghost" data-tmx title="Fechar">${iconSVG('x')}</button></div>`);
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
  if (mob) { mScrim(true); document.body.classList.add('sheet-open'); if (typeof mDragClose === 'function') mDragClose(pop.querySelector('.m-grab'), pop, closePop); _pop = pop; return; }
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

/* ---- histórico visual (lista de passos pra voltar, não só Ctrl+Z às cegas) ---- */
function relTime(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return 'agora mesmo';
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  return `há ${Math.round(m / 60)} h`;
}
function openHistoryPop(anchor) {
  closePop();
  if (!histMeta.length) { toast('Nada no histórico ainda.'); return; }
  const mob = isMobile();
  const pop = document.createElement('div'); pop.className = 'popmenu histpop scrl' + (mob ? ' pop-sheet' : '');
  if (mob) pop.insertAdjacentHTML('beforeend',
    `<div class="m-grab"><i></i></div><div class="tm-head"><span>Voltar até…</span><button class="iconbtn ghost" data-tmx title="Fechar">${iconSVG('x')}</button></div>`);
  else pop.insertAdjacentHTML('beforeend', `<div class="tm-h">Voltar até…</div>`);
  for (let i = histMeta.length - 1; i >= 0; i--) {
    const n = histMeta.length - i;
    pop.insertAdjacentHTML('beforeend', `<button type="button" data-n="${n}">${relTime(histMeta[i].t)}</button>`);
  }
  pop.addEventListener('click', e => {
    if (e.target.closest('[data-tmx]')) { closePop(); return; }
    const b = e.target.closest('[data-n]'); if (!b) return; closePop(); undoTo(+b.dataset.n);
  });
  document.body.appendChild(pop);
  if (mob) { mScrim(true); document.body.classList.add('sheet-open'); if (typeof mDragClose === 'function') mDragClose(pop.querySelector('.m-grab'), pop, closePop); _pop = pop; return; }
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  _pop = pop;
}

/* ---- grade com todas as páginas (revisar um documento grande de uma vez) ----
   Não desenha o SVG real de cada página — o palco principal já usa uma
   janela de renderização (refreshWindow/WINDOW) justamente porque desenhar
   todas as páginas de um documento de 200+ páginas de uma vez pesa. Em vez
   disso, cada card é só número + rótulo da seção + uma cor por seção (pra
   ver de relance onde uma seção começa e termina) — leve mesmo em
   documentos grandes. */
function openPageGrid() {
  const pages = expand();
  const box = $('#pg_grid'); box.innerHTML = '';
  const frag = document.createDocumentFragment();
  pages.forEach((pd, i) => {
    const sec = state.sections.find(s => s.id === pd.sectionId);
    const label = sec ? sectionLabel(sec, []) : 'Página';
    const hue = ((pd.si || 0) * 47) % 360;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pg-card' + (i === currentPage ? ' on' : '');
    card.style.setProperty('--accent', `hsl(${hue} 55% 45%)`);
    card.innerHTML = `<span class="pg-num">${i + 1}</span><span class="pg-lb">${esc(label)}</span>`;
    card.onclick = () => { $('#pageGrid').close(); gotoPage(i); };
    frag.appendChild(card);
  });
  box.appendChild(frag);
  $('#pageGrid').showModal();
}

/* ---- ir direto para a página N (clique no contador "N / total") ---- */
function openGotoPagePop(anchor) {
  closePop();
  const pop = document.createElement('div'); pop.className = 'popmenu gotopop';
  const n = pageCount();
  pop.innerHTML = `<label>Ir para a página (1–${n})
    <input type="number" id="gp_input" min="1" max="${n}" step="1" value="${currentPage + 1}"></label>
    <button type="button" data-go class="primary wfull">Ir</button>`;
  const inp = pop.querySelector('#gp_input');
  const go = () => { const v = clamp(Math.round(+inp.value || 1), 1, n); closePop(); gotoPage(v - 1); };
  pop.querySelector('[data-go]').onclick = go;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  _pop = pop;
  inp.focus(); inp.select();
}

/* ---- menu "Adicionar seção" ---- */
// Busca por nome: filtra os .tm-item pelo rótulo (data-label, já em minúsculas)
// e some com o cabeçalho de grupo (.tm-h) quando nenhum item dele sobra —
// achado de maior impacto da auditoria (44 tipos em 3 grupos, sem filtro).
function filterTypeMenu(pop, q) {
  q = (q || '').trim().toLowerCase();
  pop.querySelectorAll('.tm-item').forEach(b => { b.hidden = !!q && !b.dataset.label.includes(q); });
  pop.querySelectorAll('.tm-h').forEach(h => {
    let any = false, n = h.nextElementSibling;
    while (n && !n.classList.contains('tm-h')) { if (n.classList.contains('tm-item') && !n.hidden) any = true; n = n.nextElementSibling; }
    h.hidden = !any;
  });
}
function openTypeMenu(anchor) {
  closePop();
  const mob = isMobile();
  const pop = document.createElement('div'); pop.className = 'popmenu typemenu scrl' + (mob ? ' tm-sheet' : '');
  if (mob) pop.insertAdjacentHTML('beforeend',
    `<div class="m-grab"><i></i></div><div class="tm-head"><span>Adicionar seção</span><button class="iconbtn ghost" data-tmx title="Fechar">${iconSVG('x')}</button></div>`);
  pop.insertAdjacentHTML('beforeend', `<input type="text" class="tm-search" placeholder="Buscar tipo de página…" autocomplete="off">`);
  PAGE_GROUPS.forEach(g => {
    pop.insertAdjacentHTML('beforeend', `<div class="tm-h">${g}</div>`);
    Object.entries(PAGE_TYPES).filter(([, T]) => T.group === g).forEach(([k, T]) => {
      pop.insertAdjacentHTML('beforeend', `<button data-t="${k}" data-label="${esc(T.label.toLowerCase())}" class="tm-item"><span class="tm-pv">${typePreviewSVG(k)}</span><span class="tm-lb">${esc(T.label)}</span></button>`);
    });
  });
  pop.addEventListener('click', e => {
    if (e.target.closest('[data-tmx]')) { closePop(); return; }
    const b = e.target.closest('[data-t]'); if (!b) return; closePop(); addSection(b.dataset.t);
  });
  const search = pop.querySelector('.tm-search');
  search.addEventListener('input', () => filterTypeMenu(pop, search.value));
  document.body.appendChild(pop);
  if (mob) { mScrim(true); document.body.classList.add('sheet-open'); if (typeof mDragClose === 'function') mDragClose(pop.querySelector('.m-grab'), pop, closePop); _pop = pop; return; }
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  _pop = pop;
}

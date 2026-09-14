/* Planner Studio — js/wizard.js
   "Montar passo a passo": do zero a um documento pronto em 8 passos curtos —
   tipo → papel → capa (nome, textos e estilo, com miniaturas reais) → cores e
   fontes → toques finais (marca d'água e ilustração nas páginas) →
   encadernação → onde vai imprimir → resumo. Cada miniatura é
   desenhada pelo mesmo motor da página/PDF, com as escolhas acumuladas.
   (parte de app; carregado depois de ui.js/editor.js/shell-ui.js) */
"use strict";

const WIZ_STARTERS = ['semana-dupla', 'semanal', 'diario', 'executiva', 'universitario', 'brochura', 'pautado', 'quadriculado', 'bujo', 'estudos', 'desenho', 'habitos', 'financeiro', 'branco'];
const WIZ_PAPER_TIP = {
  a5: 'O tamanho mais comum de agenda e planner — cabe na bolsa.', a4: 'Folha inteira: cadernos de estudo, planners de mesa.',
  b5: 'Entre A5 e A4: ótimo para estudos e journaling.', a6: 'Bolso: listas, anotações rápidas.',
  universitario: 'Padrão dos cadernos universitários brasileiros.', brochura: 'Caderno escolar pequeno (brochura).',
  desenho: 'Deitado, para desenho e cartografia.', half: 'Meia carta — padrão americano de planner.',
  trav: 'Formato alto e estreito dos traveler’s notebooks.', pocket: 'Mini caderno de bolso.',
  letter: 'Carta americana.', a3: 'Grande: planejadores de parede e pôsteres.', square: 'Quadrado: álbuns e diários criativos.',
};
const WIZ_BIND_TIP = {
  none: 'Folhas soltas — para fichário próprio ou para decidir depois.',
  staple: 'Grampo ou costura no meio (livreto). Até ~60 páginas.',
  perfect: 'Lombada colada, como livro. Precisa de margem interna maior.',
  spiral: 'Espiral plástica ou metálica: abre 360°. Reserva margem para os furos.',
  wireo: 'Garra dupla wire-o: acabamento profissional de agenda. Reserva margem para os furos.',
  disc: 'Sistema de discos: dá para tirar e recolocar páginas.',
  ring6: 'Fichário de 6 furos (A5 / pessoal).', ring2: 'Fichário de 2 furos.',
};

let wizStep = 0;
let wizDraft = null;
const wizDefaultDraft = () => ({ starterId: 'semana-dupla', paper: 'a5', cover: { title: '', subtitle: String(DEFAULTS.year), owner: '', style: 'nameScript' },
  palette: 'esmeralda', headingFont: 'playfair', binding: 'wireo', print: 'home', wm: 'none', wmText: '', art: '', artPos: 'corner', coverFilter: 'name', touched: {} });

// posição da ilustração repetida nas páginas (dx/dy a partir do centro, escala)
const WIZ_ART_POS = { corner: { label: 'Canto de baixo', f: (W, H) => ({ dx: W / 2 - 16, dy: H / 2 - 20, s: 0.55 }) },
  top: { label: 'Topo', f: (W, H) => ({ dx: W / 2 - 16, dy: -H / 2 + 18, s: 0.5 }) }, center: { label: 'Centro, grande', f: () => ({ s: 1.8 }) } };

// documento que o assistente vai criar, a partir do rascunho
function wizDoc(d) {
  const starter = TEMPLATES.find(t => t.id === d.starterId) || TEMPLATES.find(t => t.id === 'branco');
  const pal = PALETTES[d.palette] || PALETTES.esmeralda;
  const settings = { ...starter.settings, paper: d.paper, ink: pal.ink, accent: pal.accent, paperBg: pal.paperBg,
    headingFont: d.headingFont, binding: d.binding };
  if (d.print === 'shop') Object.assign(settings, { exportMode: 'real', pdfColor: 'cmyk', bleedMm: 3, cropMarks: true });
  else Object.assign(settings, { exportMode: 'auto', pdfColor: 'rgb' });
  const sections = starter.sections.map(s => ({ ...s, opts: { ...s.opts } }));
  let cov = sections.find(s => s.type === 'cover');
  if (!cov) { cov = { type: 'cover', count: 1, opts: {} }; sections.unshift(cov); }
  const c = d.cover;
  cov.opts.title = c.title || cov.opts.title || starter.name;
  cov.opts.subtitle = c.subtitle;
  cov.opts.owner = c.owner; cov.opts.showOwner = true;
  cov.opts.style = c.style;
  // toques finais: marca d'água e ilustração repetida nas páginas do miolo
  if (d.wm !== 'none') settings.wm = { on: true, kind: 'text', text: d.wm === 'name' ? (c.owner || 'Seu Nome') : (d.wmText || 'Esmeralda Paper'), pos: 'tile', opacity: 0.08, rot: -30, size: 0.8 };
  if (d.art) {
    const [W, H] = withTemplateState({ settings, sections: [] }, () => paperWH());
    sections.forEach((sec, i) => {
      if (sec.type === 'cover' || sec.type === 'calibration' || !((sec.count || 1) > 1)) return;
      const id = 'w' + i;
      sec.opts.extras = [{ id, type: 'art', art: d.art, text: '', src: '' }];
      sec.opts.el = { ['x:' + id]: (WIZ_ART_POS[d.artPos] || WIZ_ART_POS.corner).f(W, H) };
    });
  }
  return { settings, sections };
}
function wizCoverSVG(d, style) {
  const doc = wizDoc({ ...d, cover: { ...d.cover, style } });
  doc.sections = [doc.sections.find(s => s.type === 'cover')];
  return withTemplateState(doc, () => { const pages = expand(); return pages.length ? exportPageSVG(pages, 0, 1) : ''; });
}
function wizCoverThumb(d, style) {
  const doc = wizDoc({ ...d, cover: { ...d.cover, style } });
  const [W, H] = withTemplateState(doc, () => paperWH());
  return pairThumbHTML(wizCoverSVG(d, style), null, W, H);
}

const WIZ_STEPS = [
  { key: 'starter', title: 'O que você vai criar?', desc: 'Escolha a base. Tudo pode ser mudado depois: adicionar, remover e reordenar seções.',
    options: () => WIZ_STARTERS.map(id => TEMPLATES.find(x => x.id === id)).filter(Boolean).map(t => ({ id: t.id, label: t.name, desc: t.desc })),
    selected: d => d.starterId,
    pick: (d, id) => { d.starterId = id; const t = TEMPLATES.find(x => x.id === id); if (t && !d.touched.paper) d.paper = t.settings.paper || d.paper; },
    preview: (opt, d) => { const t = TEMPLATES.find(x => x.id === opt.id); return t && t.id !== 'branco' ? templateThumb({ ...t, settings: { ...t.settings } }) : specialThumb('plus'); } },
  { key: 'paper', title: 'Qual o tamanho da página?', desc: 'O tamanho final de cada página, depois de refilada.',
    options: () => ['a5', 'a4', 'b5', 'a6', 'universitario', 'brochura', 'desenho', 'half', 'trav', 'pocket', 'letter', 'a3', 'square'].filter(id => PAGE_SIZES[id]).map(id => {
      const parts = PAGE_SIZES[id].label.split('—'); return { id, label: parts[0].trim(), desc: `${(parts[1] || '').trim()} · ${WIZ_PAPER_TIP[id] || ''}` }; }),
    selected: d => d.paper, pick: (d, id) => { d.paper = id; d.touched.paper = true; },
    preview: opt => paperSizeThumb(opt.id) },
  { key: 'cover', title: 'Como vai ser a capa?', desc: 'Escreva os textos e escolha um estilo. Na folha você ainda pode mover, aumentar e trocar a fonte de cada texto.',
    cover: true },
  { key: 'look', title: 'Cores e letras', desc: 'Paleta de cores do documento e a fonte dos títulos. As linhas das páginas usam a cor principal.',
    look: true },
  { key: 'extras', title: 'Toques finais', desc: 'Opcional: marca d’água discreta e uma ilustração que se repete nas páginas. Tudo dá para mudar ou tirar depois.',
    extras: true },
  { key: 'binding', title: 'Como vai encadernar?', desc: 'Define a margem reservada para lombada ou furos — nada fica em cima deles.',
    options: () => Object.keys(BINDINGS).map(id => ({ id, label: BINDINGS[id].label, desc: WIZ_BIND_TIP[id] || '' })),
    selected: d => d.binding, pick: (d, id) => { d.binding = id; },
    preview: (opt, d) => tplThumbSVG({ id: d.starterId || 'branco', settings: { paper: d.paper }, binding: opt.id }) },
  { key: 'print', title: 'Onde vai imprimir?', desc: 'Ajusta a saída do PDF. Dá para trocar na hora de baixar.',
    options: () => [
      { id: 'home', label: 'Em casa ou papelaria', desc: 'PDF em RGB, montagem automática na folha A4 (2 por folha, livreto…), sem sangria.' },
      { id: 'shop', label: 'Gráfica', desc: 'PDF/X-4 em CMYK (FOGRA39), tamanho exato, 3 mm de sangria e marcas de corte.' },
    ],
    selected: d => d.print, pick: (d, id) => { d.print = id; },
    preview: opt => specialThumb(opt.id === 'shop' ? 'real' : 'fit') },
  { key: 'summary', title: 'Tudo pronto', desc: 'Confira e crie o documento. Depois é só ajustar os detalhes e imprimir.', summary: true },
];

// página em escala real relativa (A3 grande, A6 pequena) com as linhas de pauta
function paperSizeThumb(id) {
  const p = PAGE_SIZES[id] || PAGE_SIZES.a5, k = 92 / 420;
  const w = p.w * k, h = p.h * k, x = (100 - w) / 2, y = 100 - 4 - h;
  let lines = '';
  for (let yy = y + 7; yy < y + h - 4; yy += Math.max(3.2, h / 14)) lines += `<line x1="${(x + 4).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(x + w - 4).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="var(--line)" stroke-width=".7"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="#fff" stroke="var(--brand)" stroke-width="1"/>${lines}</svg>`;
}

function showTemplatesPane() {
  $('#ob_wizard').hidden = true;
  $('#ob_templates').hidden = false;
}
function showWizardPane() {
  wizStep = 0; wizDraft = wizDefaultDraft();
  $('#ob_templates').hidden = true;
  $('#ob_wizard').hidden = false;
  renderWizStep();
}
function wizGo(delta) {
  const n = wizStep + delta;
  if (n < 0) { showTemplatesPane(); return; }
  if (n >= WIZ_STEPS.length) { finishWizard(); return; }
  wizStep = n; renderWizStep();
  const sc = $('#empty'); if (sc) sc.scrollTop = 0;
}

function renderWizStep() {
  const step = WIZ_STEPS[wizStep], d = wizDraft;
  $('#ob_wizStep').innerHTML = `Passo ${wizStep + 1} de ${WIZ_STEPS.length}<span class="wiz-dots">${WIZ_STEPS.map((_, i) => `<i class="${i <= wizStep ? 'on' : ''}"></i>`).join('')}</span>`;
  $('#ob_wizTitle').textContent = step.title;
  $('#ob_wizDesc').textContent = step.desc || '';
  const grid = $('#ob_wizGrid'); grid.innerHTML = ''; grid.className = 'tpl-list';
  const foot = document.createElement('div'); foot.className = 'wiz-foot';
  foot.innerHTML = `<button type="button" class="ghost" data-w="back">Voltar</button><span class="grow"></span>` +
    `<button type="button" class="primary" data-w="next">${wizStep === WIZ_STEPS.length - 1 ? 'Criar documento' : 'Continuar'}</button>`;
  foot.querySelector('[data-w="back"]').onclick = () => wizGo(-1);
  foot.querySelector('[data-w="next"]').onclick = () => wizGo(1);

  if (step.options) {
    step.options().forEach(opt => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'tpl-card' + (step.selected(d) === opt.id ? ' on' : '') + (opt.id === 'branco' ? ' tpl-card--blank' : '');
      b.innerHTML = `<span class="tpl-card__thumb">${step.preview(opt, d)}</span>
        <span class="tpl-card__name">${esc(opt.label)}</span>
        ${opt.desc ? `<span class="tpl-card__desc">${esc(opt.desc)}</span>` : ''}`;
      b.onclick = () => {
        const again = step.selected(d) === opt.id;
        step.pick(d, opt.id);
        if (again) { wizGo(1); return; }        // tocar de novo na escolha avança
        grid.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('on')); b.classList.add('on');
      };
      grid.appendChild(b);
    });
  } else if (step.cover) renderWizCover(grid);
  else if (step.look) renderWizLook(grid);
  else if (step.extras) renderWizExtras(grid);
  else if (step.summary) renderWizSummary(grid);
  grid.after(foot);
  const oldFoot = grid.parentNode.querySelectorAll('.wiz-foot'); oldFoot.forEach(f => { if (f !== foot) f.remove(); });
}

function renderWizCover(grid) {
  const d = wizDraft;
  grid.className = 'wiz-cover';
  const fields = [
    { k: 'owner', label: 'Seu nome (capa personalizada)', ph: 'ex.: Mariana Alves' },
    { k: 'title', label: 'Título', ph: ((TEMPLATES.find(t => t.id === d.starterId) || {}).sections || []).find(x => x.type === 'cover')?.opts?.title || 'Meu Planner' },
    { k: 'subtitle', label: 'Subtítulo ou ano', ph: 'ex.: 2027' },
  ];
  const form = document.createElement('div'); form.className = 'wiz-coverForm';
  form.innerHTML = fields.map(f => `<label>${esc(f.label)}<input type="text" maxlength="60" data-k="${f.k}" placeholder="${esc(f.ph)}" value="${esc(d.cover[f.k] || '')}"></label>`).join('') +
    `<div class="wiz-bigprev" id="wiz_bigprev"></div>`;
  const filt = document.createElement('div'); filt.className = 'grp wiz-coverFilt';
  filt.innerHTML = [['name', 'Com nome'], ['classic', 'Clássicas'], ['all', 'Todas']].map(([v, l]) => `<button type="button" class="chip${d.coverFilter === v ? ' on' : ''}" data-f="${v}">${l}</button>`).join('');
  const gal = document.createElement('div'); gal.className = 'wiz-coverGal';
  grid.append(form, filt, gal);
  const allStyles = PAGE_TYPES.cover.fields.find(f => f.k === 'style').options;
  filt.addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    d.coverFilter = b.dataset.f; filt.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); paint();
  });
  const paint = () => {
    const styles = allStyles.filter(o => d.coverFilter === 'all' || (d.coverFilter === 'name') === /^name/.test(o.v));
    gal.innerHTML = styles.map(o => `<button type="button" class="tpl-card tpl-card--cover${d.cover.style === o.v ? ' on' : ''}" data-st="${esc(o.v)}"><span class="tpl-card__thumb">${wizCoverThumb(d, o.v)}</span><span class="tpl-card__name">${esc(o.label.replace(/\s*\(.*\)$/, ''))}</span></button>`).join('');
    bigPrev();
  };
  const bigPrev = () => { const doc = wizDoc(d); const [W, H] = withTemplateState(doc, () => paperWH()); $('#wiz_bigprev').innerHTML = pairThumbHTML(wizCoverSVG(d, d.cover.style), null, W, H); };
  gal.addEventListener('click', e => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    d.cover.style = b.dataset.st;
    gal.querySelectorAll('.tpl-card').forEach(c => c.classList.toggle('on', c === b));
    bigPrev();
  });
  let t;
  form.addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    d.cover[k] = e.target.value;
    clearTimeout(t); t = setTimeout(paint, 260);
  });
  if (typeof EPArt !== 'undefined' && !EPArt.get('enfeites/ramo')) { gal.innerHTML = '<p class="hint">Carregando estilos…</p>'; EPArt.load('enfeites').then(paint); }
  else paint();
}

function renderWizExtras(grid) {
  const d = wizDraft;
  grid.className = 'wiz-look';
  const chip = (attr, v, l, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-${attr}="${v}">${esc(l)}</button>`;
  grid.innerHTML = `<div class="wiz-lookL">
      <span class="fld-lbl">Marca d'água</span>
      <div class="grp">${chip('wm', 'none', 'Sem marca d’água', d.wm === 'none')}${chip('wm', 'name', 'Com meu nome', d.wm === 'name')}${chip('wm', 'text', 'Texto próprio', d.wm === 'text')}</div>
      <label id="wiz_wmText"${d.wm === 'text' ? '' : ' hidden'}>Texto <input type="text" maxlength="60" value="${esc(d.wmText)}" placeholder="ex.: sua marca"></label>
      <span class="fld-lbl">Ilustração nas páginas</span>
      <div class="wiz-art"><span class="wm-pick__prev" id="wiz_artPrev"></span>
        <button type="button" data-art="pick">${d.art ? 'Trocar ilustração' : 'Escolher ilustração'}</button>
        ${d.art ? '<button type="button" class="ghost" data-art="none">Tirar</button>' : ''}</div>
      <div class="grp"${d.art ? '' : ' hidden'}>${Object.entries(WIZ_ART_POS).map(([k, p]) => chip('pos', k, p.label, d.artPos === k)).join('')}</div>
      <p class="hint">A ilustração entra nas seções com várias páginas. Na folha você move, aumenta, troca a cor ou exclui.</p>
    </div><div class="wiz-bigprev" id="wiz_extprev"></div>`;
  const prev = () => {
    const doc = wizDoc(d); const [W, H] = withTemplateState(doc, () => paperWH());
    const back = withTemplateState(doc, () => { const pages = expand(); const bi = representativePage(pages); return bi > 0 ? exportPageSVG(pages, bi, pages.length) : null; });
    $('#wiz_extprev').innerHTML = pairThumbHTML(wizCoverSVG(d, d.cover.style), back, W, H);
    $('#wiz_artPrev').innerHTML = d.art ? EPArt.svg(d.art, '#35594d') : '';
  };
  grid.addEventListener('click', e => {
    const w = e.target.closest('[data-wm]'), a = e.target.closest('[data-art]'), p = e.target.closest('[data-pos]');
    if (w) { d.wm = w.dataset.wm; renderWizExtras(grid); return; }
    if (p) { d.artPos = p.dataset.pos; renderWizExtras(grid); return; }
    if (a && a.dataset.art === 'none') { d.art = ''; renderWizExtras(grid); return; }
    if (a) EPArtPicker.open({ title: 'Ilustração nas páginas', current: d.art, onPick: id => EPArt.ensure([id]).then(() => { d.art = id; renderWizExtras(grid); }) });
  });
  const t = grid.querySelector('#wiz_wmText input');
  if (t) { let tm; t.addEventListener('input', () => { d.wmText = t.value; clearTimeout(tm); tm = setTimeout(prev, 250); }); }
  EPArt.ensure(d.art ? [d.art, 'enfeites/ramo'] : ['enfeites/ramo']).then(prev);
}

function renderWizLook(grid) {
  const d = wizDraft;
  grid.className = 'wiz-look';
  const fams = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  const pal = Object.entries(PALETTES);
  grid.innerHTML = `<div class="wiz-lookL">
      <span class="fld-lbl">Paleta</span>
      <div class="wiz-pals">${pal.map(([k, p]) => `<button type="button" class="wiz-pal${d.palette === k ? ' on' : ''}" data-wpal="${k}"><span class="wiz-pal__sw"><i data-c="${p.ink}"></i><i data-c="${p.accent}"></i><i data-c="${p.paperBg}"></i></span><span>${esc(p.label)}</span></button>`).join('')}</div>
      <span class="fld-lbl">Fonte dos títulos</span>
      <div class="wiz-fonts">${Object.entries(fams).map(([k, f]) => `<button type="button" class="wiz-font${d.headingFont === k ? ' on' : ''}" data-wfont="${k}"><b data-ff="${esc(f.css)}">Aa</b><span>${esc(f.label.split(' — ')[0])}<small>${esc(f.label.split(' — ')[1] || '')}</small></span></button>`).join('')}</div>
    </div><div class="wiz-bigprev" id="wiz_lookprev"></div>`;
  grid.querySelectorAll('[data-c]').forEach(i => { i.style.background = i.dataset.c; });
  grid.querySelectorAll('[data-ff]').forEach(i => { i.style.fontFamily = i.dataset.ff; });
  const prev = () => {
    const doc = wizDoc(d); const [W, H] = withTemplateState(doc, () => paperWH());
    const back = withTemplateState(doc, () => { const pages = expand(); const bi = representativePage(pages); return bi > 0 ? exportPageSVG(pages, bi, pages.length) : null; });
    $('#wiz_lookprev').innerHTML = pairThumbHTML(wizCoverSVG(d, d.cover.style), back, W, H);
  };
  grid.addEventListener('click', e => {
    const p = e.target.closest('[data-wpal]'), f = e.target.closest('[data-wfont]');
    if (p) { d.palette = p.dataset.wpal; grid.querySelectorAll('[data-wpal]').forEach(x => x.classList.toggle('on', x === p)); prev(); }
    if (f) { d.headingFont = f.dataset.wfont; grid.querySelectorAll('[data-wfont]').forEach(x => x.classList.toggle('on', x === f)); prev(); }
  });
  prev();
}

function renderWizSummary(grid) {
  const d = wizDraft, doc = wizDoc(d);
  grid.className = 'wiz-look';
  const starter = TEMPLATES.find(t => t.id === d.starterId);
  const n = withTemplateState(doc, () => expand().length);
  const fams = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  const styleLbl = (PAGE_TYPES.cover.fields.find(f => f.k === 'style').options.find(o => o.v === d.cover.style) || {}).label || d.cover.style;
  const rows = [
    ['Base', starter ? starter.name : '—'],
    ['Páginas', `${n} páginas (${Math.ceil(n / 2)} folhas frente e verso)`],
    ['Tamanho', PAGE_SIZES[d.paper] ? PAGE_SIZES[d.paper].label : d.paper],
    ['Capa', `${d.cover.title || (starter && starter.name) || ''} · estilo ${styleLbl.replace(/\s*\(.*\)$/, '').toLowerCase()}`],
    ['Toques finais', [d.wm === 'none' ? 'sem marca d’água' : 'marca d’água “' + (d.wm === 'name' ? (d.cover.owner || 'Seu Nome') : d.wmText) + '”', d.art ? 'ilustração ' + ((EPArt.get(d.art) || {}).label || '').toLowerCase() + ' nas páginas' : ''].filter(Boolean).join(' · ')],
    ['Cores e fonte', `${(PALETTES[d.palette] || {}).label || ''} · ${(fams[d.headingFont] ? fams[d.headingFont].label.split(' — ')[0] : '')}`],
    ['Encadernação', BINDINGS[d.binding] ? BINDINGS[d.binding].label : '—'],
    ['Impressão', d.print === 'shop' ? 'Gráfica — PDF/X-4 CMYK, sangria 3 mm, marcas de corte' : 'Em casa — montagem automática na folha'],
  ];
  const [W, H] = withTemplateState(doc, () => paperWH());
  grid.innerHTML = `<div class="wiz-lookL"><dl class="wiz-sum">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <p class="hint">Na folha, toque ou clique no título, no subtítulo ou no nome da capa para mover, aumentar, trocar a fonte e a cor.</p></div>
    <div class="wiz-bigprev">${pairThumbHTML(wizCoverSVG(d, d.cover.style), null, W, H)}</div>`;
}

function finishWizard() {
  const doc = wizDoc(wizDraft);
  newDoc(doc);
  if (typeof closeStart === 'function') closeStart();
  toast('Documento pronto — toque nos textos da capa para ajustar direto na folha.');
}

(function initWizard() {
  $('#ob_wizStart').onclick = showWizardPane;
  $('#ob_wizBack').onclick = () => wizGo(-1);
})();

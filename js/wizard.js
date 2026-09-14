/* Planner Studio — js/wizard.js
   Tela inicial sem menus: modelos prontos OU montar do zero em 3 passos
   curtos (tamanho do papel → por onde começar → encadernação). Cada opção
   já mostra a miniatura real (tplThumbSVG, de ui.js) com as escolhas
   acumuladas até ali — ao chegar no editor o documento já está quase
   pronto, só falta ajustar os detalhes.
   (parte de app; carregado depois de ui.js/editor.js — usa
   tplThumbSVG/esc/$/newDoc dela) */
"use strict";

const WIZ_STARTERS = ['bujo', 'semanal', 'diario', 'pautado', 'bloco-notas', 'estudos', 'habitos', 'financeiro', 'branco'];

const WIZ_STEPS = [
  { title: 'Que tamanho de papel?', desc: 'Dá pra mudar depois, nas configurações do documento.',
    options: ['a5', 'a4', 'b5', 'a6', 'half', 'trav', 'pocket', 'letter', 'a3', 'square'].filter(id => PAGE_SIZES[id]).map(id => {
      const parts = PAGE_SIZES[id].label.split('—');
      return { id, label: parts[0].trim(), desc: (parts[1] || '').trim() };
    }),
    preview: (opt) => paperSizeThumb(opt.id) },
  { title: 'Por onde você quer começar?', desc: 'Depois dá pra adicionar, remover e reordenar seções à vontade.',
    options: WIZ_STARTERS.map(id => { const t = TEMPLATES.find(x => x.id === id); return { id: t.id, label: t.name, desc: t.desc }; }),
    preview: (opt, draft) => {
      const t = TEMPLATES.find(x => x.id === opt.id);
      if (t && t.id !== 'branco' && typeof templateThumb === 'function') return templateThumb({ ...t, settings: { ...t.settings, paper: draft.paper } });
      return tplThumbSVG({ id: opt.id, settings: { paper: draft.paper } });
    } },
  { title: 'Como vai ser a capa?', desc: 'Pode deixar em branco e ajustar depois, no painel da seção Capa.',
    form: true,
    fields: [
      { k: 'title', label: 'Título', placeholder: 'Meu Planner' },
      { k: 'subtitle', label: 'Subtítulo (opcional)', placeholder: 'ex.: 2026' },
      { k: 'owner', label: 'Nome — "pertence a" (opcional)', placeholder: '' },
    ] },
  { title: 'Vai encadernar como?', desc: '',
    options: Object.keys(BINDINGS).map(id => ({ id, label: BINDINGS[id].label, desc: '' })),
    preview: (opt, draft) => tplThumbSVG({ id: draft.starterId || 'branco', settings: { paper: draft.paper }, binding: opt.id }) },
];

// página em escala real relativa (A3 grande, A6 pequena) com as linhas de pauta
function paperSizeThumb(id) {
  const p = PAGE_SIZES[id] || PAGE_SIZES.a5, k = 92 / 420;
  const w = p.w * k, h = p.h * k, x = (100 - w) / 2, y = 100 - 4 - h;
  let lines = '';
  for (let yy = y + 7; yy < y + h - 4; yy += Math.max(3.2, h / 14)) lines += `<line x1="${(x + 4).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(x + w - 4).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="var(--line)" stroke-width=".7"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="#fff" stroke="var(--brand)" stroke-width="1"/>${lines}</svg>`;
}

let wizStep = 0;
let wizDraft = null;
const wizDefaultDraft = () => ({ paper: 'a5', starterId: 'branco', binding: 'none', cover: { title: '', subtitle: '', owner: '' } });

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
function wizAdvance() {
  if (wizStep < WIZ_STEPS.length - 1) { wizStep++; renderWizStep(); }
  else finishWizard();
}
function renderWizStep() {
  const step = WIZ_STEPS[wizStep];
  $('#ob_wizStep').textContent = `Passo ${wizStep + 1} de ${WIZ_STEPS.length}`;
  $('#ob_wizTitle').textContent = step.title;
  $('#ob_wizDesc').textContent = step.desc || '';
  const grid = $('#ob_wizGrid'); grid.innerHTML = '';

  if (step.form) {
    grid.classList.add('wiz-form');
    const form = document.createElement('form');
    form.className = 'wiz-formInner';
    step.fields.forEach(f => {
      const label = document.createElement('label');
      label.innerHTML = `${esc(f.label)}<input type="text" maxlength="60" data-k="${f.k}">`;
      const input = label.querySelector('input');
      input.value = wizDraft.cover[f.k] || '';
      input.placeholder = f.placeholder || '';
      form.appendChild(label);
    });
    const go = document.createElement('button');
    go.type = 'submit'; go.className = 'primary wfull mt4';
    go.textContent = wizStep < WIZ_STEPS.length - 1 ? 'Continuar' : 'Criar documento';
    form.appendChild(go);
    form.onsubmit = e => {
      e.preventDefault();
      step.fields.forEach(f => { wizDraft.cover[f.k] = form.querySelector(`[data-k="${f.k}"]`).value.trim(); });
      wizAdvance();
    };
    grid.appendChild(form);
    return;
  }
  grid.classList.remove('wiz-form');

  step.options.forEach(opt => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'tpl-card' + (wizStep === 1 && opt.id === 'branco' ? ' tpl-card--blank' : '');
    b.innerHTML = `<span class="tpl-card__thumb">${step.preview(opt, wizDraft)}</span>
      <span class="tpl-card__name">${esc(opt.label)}</span>
      ${opt.desc ? `<span class="tpl-card__desc">${esc(opt.desc)}</span>` : ''}`;
    b.onclick = () => {
      if (wizStep === 0) wizDraft.paper = opt.id;
      else if (wizStep === 1) wizDraft.starterId = opt.id;
      else wizDraft.binding = opt.id;
      wizAdvance();
    };
    grid.appendChild(b);
  });
}
function finishWizard() {
  const starter = TEMPLATES.find(t => t.id === wizDraft.starterId) || TEMPLATES.find(t => t.id === 'branco');
  const settings = { ...starter.settings, paper: wizDraft.paper, binding: wizDraft.binding };
  const sections = starter.sections.map(s => ({ ...s, opts: { ...s.opts } }));
  const { title, subtitle, owner } = wizDraft.cover;
  if (title || subtitle || owner) {
    const cov = sections.find(s => s.type === 'cover');
    if (cov) {
      if (title) cov.opts.title = title;
      if (subtitle) cov.opts.subtitle = subtitle;
      if (owner) { cov.opts.owner = owner; cov.opts.showOwner = true; }
    } else {
      sections.unshift({ type: 'cover', count: 1, opts: { title: title || 'Meu Planner', subtitle, owner, showOwner: !!owner, style: 'modern' } });
    }
  }
  newDoc({ settings, sections });
  toast('Documento pronto — é só ajustar os detalhes.');
}

(function initWizard() {
  $('#ob_wizStart').onclick = showWizardPane;
  $('#ob_wizBack').onclick = () => { if (wizStep > 0) { wizStep--; renderWizStep(); } else showTemplatesPane(); };
})();

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
    options: Object.keys(PAGE_SIZES).map(id => {
      const parts = PAGE_SIZES[id].label.split('—');
      return { id, label: parts[0].trim(), desc: (parts[1] || '').trim() };
    }),
    preview: (opt) => tplThumbSVG({ id: 'branco', settings: { paper: opt.id } }) },
  { title: 'Por onde você quer começar?', desc: 'Depois dá pra adicionar, remover e reordenar seções à vontade.',
    options: WIZ_STARTERS.map(id => { const t = TEMPLATES.find(x => x.id === id); return { id: t.id, label: t.name, desc: t.desc }; }),
    preview: (opt, draft) => tplThumbSVG({ id: opt.id, settings: { paper: draft.paper } }) },
  { title: 'Vai encadernar como?', desc: '',
    options: Object.keys(BINDINGS).map(id => ({ id, label: BINDINGS[id].label, desc: '' })),
    preview: (opt, draft) => tplThumbSVG({ id: draft.starterId || 'branco', settings: { paper: draft.paper }, binding: opt.id }) },
];

let wizStep = 0;
let wizDraft = null;
const wizDefaultDraft = () => ({ paper: 'a5', starterId: 'branco', binding: 'none' });

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
function renderWizStep() {
  const step = WIZ_STEPS[wizStep];
  $('#ob_wizStep').textContent = `Passo ${wizStep + 1} de ${WIZ_STEPS.length}`;
  $('#ob_wizTitle').textContent = step.title;
  $('#ob_wizDesc').textContent = step.desc || '';
  const grid = $('#ob_wizGrid'); grid.innerHTML = '';
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
      if (wizStep < WIZ_STEPS.length - 1) { wizStep++; renderWizStep(); }
      else finishWizard();
    };
    grid.appendChild(b);
  });
}
function finishWizard() {
  const starter = TEMPLATES.find(t => t.id === wizDraft.starterId) || TEMPLATES.find(t => t.id === 'branco');
  const settings = { ...starter.settings, paper: wizDraft.paper, binding: wizDraft.binding };
  newDoc({ settings, sections: starter.sections });
  toast('Documento pronto — é só ajustar os detalhes.');
}

(function initWizard() {
  $('#ob_wizStart').onclick = showWizardPane;
  $('#ob_wizBack').onclick = () => { if (wizStep > 0) { wizStep--; renderWizStep(); } else showTemplatesPane(); };
})();

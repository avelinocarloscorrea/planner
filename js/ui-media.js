/* Planner Studio — js/ui-media.js
   Miniaturas gráficas dos modelos (tela inicial) e escolha de imagens do
   aparelho — logo, fundo e imagens livres, com o editor embutido. Tudo local.
   (parte de app; carregado antes de ui.js) */
"use strict";

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

/* Planner Studio — js/io.js
   exportar PDF vetorial (multipágina), PNG da página atual e salvar/abrir
   projeto .json. Tudo no navegador — nada é enviado.
   (parte de app; carregado em ordem por index.html) */
"use strict";

/* ================== imposição (montagem na folha) ==================
   Traduz a lista de páginas do miolo num conjunto de FOLHAS de saída.
   - real   : 1 folha = 1 página do miolo (+ sangria). Para a gráfica.
   - fit    : 1 página do miolo centralizada na folha escolhida + marcas de corte.
   - 2up    : 2 páginas por folha, lado a lado, com linha de corte no meio.
   - booklet: livreto (dobradinha) — 4 págs/folha, frente e verso, dobrar ao meio. */
const OUT_SHEETS = { a4: [210, 297], letter: [215.9, 279.4], a3: [297, 420] };
function outSheet(id) { return OUT_SHEETS[id] || OUT_SHEETS.a4; }

function impositionPlan(nPages) {
  const s = state.settings, [W, H] = paperWH();
  const eff = effectiveExportMode();
  const mode = ['real', 'fit', '2up', 'booklet'].includes(eff.mode) ? eff.mode : 'real';

  if (mode === 'real') {
    const bleed = Math.max(0, s.bleedMm || 0);
    const sheets = [];
    for (let i = 0; i < nPages; i++)
      sheets.push({ slots: [{ src: i, ox: bleed, oy: bleed, sc: 1 }], trims: [], foldX: null, foldY: null });
    if (s.mirrorMargins && sheets.length % 2) sheets.push({ slots: [], trims: [], foldX: null, foldY: null });
    return { mode, paper: true, bleed, sheetW: W + 2 * bleed, sheetH: H + 2 * bleed, sheets };
  }

  const B = outSheet(eff.sheet);

  if (mode === 'fit') {
    let sw = B[0], sh = B[1];
    if (W > sw || H > sh) { sw = B[1]; sh = B[0]; }                 // gira a folha
    const sc = Math.min(1, (sw - 6) / W, (sh - 6) / H);
    const pw = W * sc, ph = H * sc, ox = (sw - pw) / 2, oy = (sh - ph) / 2;
    const sheets = [];
    for (let i = 0; i < nPages; i++)
      sheets.push({ slots: [{ src: i, ox, oy, sc }], trims: [[ox, oy, pw, ph]], foldX: null, foldY: null });
    if (s.mirrorMargins && sheets.length % 2) sheets.push({ slots: [], trims: [], foldX: null, foldY: null });
    return { mode, sheetW: sw, sheetH: sh, sheets };
  }

  // 2up / booklet — duas páginas por folha
  const portrait = H >= W;
  let sw, sh, cols, rows;
  if (portrait) { sw = Math.max(B[0], B[1]); sh = Math.min(B[0], B[1]); cols = 2; rows = 1; }
  else { sw = Math.min(B[0], B[1]); sh = Math.max(B[0], B[1]); cols = 1; rows = 2; }
  const sc = Math.min(1, (sw - 2) / (cols * W), (sh - 2) / (rows * H));
  const pw = W * sc, ph = H * sc, bw = cols * pw, bh = rows * ph;
  const bx = (sw - bw) / 2, by = (sh - bh) / 2;
  const pos = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pos.push({ ox: bx + c * pw, oy: by + r * ph });
  const foldX = cols === 2 ? sw / 2 : null;
  const foldY = rows === 2 ? sh / 2 : null;
  // Marcas: se sobra ~7 mm de folha, L nos 4 cantos do bloco (para aparar).
  // Se o bloco quase preenche a folha (2×A5 ≈ A4), NÃO desenha marca de canto
  // nenhuma — a folha é só dobrada/cortada ao meio na linha central.
  const block = [bx, by, bw, bh];
  const outside = (bx >= 7 && by >= 7);
  const snug = (bx < 4 && by < 4);
  const trims = outside ? [block] : [];
  const ticks = (outside || snug) ? null : block;
  const slot = (src, k) => (src != null && src >= 0 && src < nPages) ? { src, ox: pos[k].ox, oy: pos[k].oy, sc } : null;
  const mk = (a, b) => ({ slots: [slot(a, 0), slot(b, 1)].filter(Boolean), trims, ticks, foldX, foldY });

  const sheets = [];
  if (mode === '2up') {
    if (s.twoUpOrder === 'duplex') {
      // Frente e verso sincronizados: o miolo é dividido ao meio (pilha
      // esquerda = páginas 1..H1; pilha direita = H1+1..N). Cada folha A4 é
      // impressa nos dois lados e cortada ao meio — as duas metades já saem
      // com a ordem certa, sem precisar reempilhar nada.
      // Depende de "virar pela borda curta" (mesma convenção do livreto):
      // a virada espelha a folha esquerda/direita, então o verso troca de
      // lado em relação à frente — por isso mk(rb, lb) e não mk(lb, rb).
      const H1 = Math.ceil(nPages / 2);
      const pairs = Math.ceil(H1 / 2);
      for (let k = 0; k < pairs; k++) {
        const lf = 2 * k, lb = 2 * k + 1;             // pilha esquerda: recto/verso
        const rf = H1 + 2 * k, rb = H1 + 2 * k + 1;   // pilha direita: recto/verso
        sheets.push(mk(lf < H1 ? lf : null, rf));     // frente da folha
        sheets.push(mk(rb, lb < H1 ? lb : null));     // verso — lados trocados
      }
    } else if (s.twoUpOrder === 'seq') {
      // sequencial: cada folha traz duas páginas seguidas (1-2, 3-4…).
      const Hn = Math.ceil(nPages / 2);
      for (let k = 0; k < Hn; k++) sheets.push(mk(2 * k, 2 * k + 1));
    } else {
      // corte-e-empilhe: metade esquerda k, metade direita k+H; corte ao meio e
      // ponha a pilha da direita embaixo da esquerda → ordem 1..N, sem intercalar.
      const Hn = Math.ceil(nPages / 2);
      for (let k = 0; k < Hn; k++) sheets.push(mk(k, k + Hn));
    }
  } else {
    const Np = Math.max(4, Math.ceil(nPages / 4) * 4);
    for (let k = 0; k < Np / 4; k++) {
      sheets.push(mk(Np - 1 - 2 * k, 2 * k));       // frente da folha
      sheets.push(mk(2 * k + 1, Np - 2 - 2 * k));   // verso da folha
    }
  }
  return { mode, sheetW: sw, sheetH: sh, sheets, duplex: mode === 'booklet' || (mode === '2up' && s.twoUpOrder === 'duplex') };
}

function sheetFileTag(s) {
  const eff = effectiveExportMode();
  if (eff.mode === 'real') return '';
  const sh = ({ a4: 'A4', letter: 'Carta', a3: 'A3' })[eff.sheet] || 'A4';
  return '-' + sh + ({ fit: '', '2up': '-2up', booklet: '-livreto' }[eff.mode] || '');
}
function modeLabel(s) {
  const eff = effectiveExportMode();
  const base = ({ real: 'tamanho real', fit: 'uma página por folha + corte',
    '2up': 'duas por folha (cortar ao meio)', booklet: 'livreto — dobrar ao meio' })[eff.mode] || 'tamanho real';
  return eff.auto ? base + ' (automático)' : base;
}
// marcas em L nos 4 cantos de um retângulo (fora dele), ou ticks internos se
// não houver folga, + linha de dobra/corte.
function drawSheetMarks(pen, sheet, sheetW, sheetH) {
  const L = 5, g = 2.2, o = { w: 0.15, color: '#000' };
  (sheet.trims || []).forEach(([x, y, w, h]) => {
    [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]].forEach(([px, py, dx, dy]) => {
      pen.line(px + dx * g, py, px + dx * (g + L), py, o);
      pen.line(px, py + dy * g, px, py + dy * (g + L), o);
    });
  });
  if (sheet.ticks) {
    const [x, y, w, h] = sheet.ticks, t = 3.5;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, dx, dy]) => {
      pen.line(px, py, px + dx * t, py, o);
      pen.line(px, py, px, py + dy * t, o);
    });
  }
  const fd = { w: 0.1, color: '#000', dash: [1.2, 1.2] };
  if (sheet.foldX != null) pen.line(sheet.foldX, 0, sheet.foldX, sheetH, fd);
  if (sheet.foldY != null) pen.line(0, sheet.foldY, sheetW, sheet.foldY, fd);
}

async function exportPDF() {
  const pages = expand();
  if (!pages.length) { toast('Adicione ao menos uma seção.'); return; }
  if (typeof resetPdfImages === 'function') resetPdfImages();
  const s = state.settings, [W, H] = paperWH();
  const plan = impositionPlan(pages.length);
  busy('Gerando PDF — ' + plan.sheets.length + ' folha(s)…');
  await new Promise(r => setTimeout(r, 20));
  try {
    const f = v => (+v).toFixed(3);
    const bgHex = plan.paper ? s.paperBg : '#ffffff';
    const paintMioloBg = !plan.paper && s.paperBg && s.paperBg.toLowerCase() !== '#ffffff';
    const out = [];
    for (let si = 0; si < plan.sheets.length; si++) {
      const sheet = plan.sheets[si];
      const bg = PdfPen(plan.sheetW, plan.sheetH, 0, 0);
      bg.rect(0, 0, plan.sheetW, plan.sheetH, { fill: bgHex });
      let content = bg.stream();
      for (const slot of sheet.slots) {
        const sp = PdfPen(W, H, 0, 0);
        if (paintMioloBg) sp.rect(0, 0, W, H, { fill: s.paperBg });
        drawPageInto(sp, pages[slot.src], slot.src,
          plan.paper ? { screen: false, bleed: plan.bleed, total: pages.length }
                     : { screen: false, print: true, total: pages.length });
        const tx = slot.ox * PT, ty = (plan.sheetH - slot.oy - H * slot.sc) * PT;
        content += '\nq ' + f(slot.sc) + ' 0 0 ' + f(slot.sc) + ' ' + f(tx) + ' ' + f(ty) + ' cm\n' + sp.stream() + '\nQ';
      }
      const deco = PdfPen(plan.sheetW, plan.sheetH, 0, 0);
      drawSheetMarks(deco, sheet, plan.sheetW, plan.sheetH);
      content += '\n' + deco.stream();
      out.push({ stream: content, wPt: plan.sheetW * PT, hPt: plan.sheetH * PT });
      if (si % 20 === 0) { busy('Folha ' + (si + 1) + ' / ' + plan.sheets.length + '…'); await new Promise(r => setTimeout(r, 0)); }
    }
    busy('Montando o arquivo…'); await new Promise(r => setTimeout(r, 0));
    const bytes = await buildPDF(out);
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), (docName() || 'planner') + sheetFileTag(s) + '.pdf');
    toast('PDF: ' + plan.sheets.length + ' folha(s) · ' + pages.length + ' pág. · ' +
      (bytes.length / 1024).toFixed(0) + ' KB · ' + modeLabel(s));
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF.'); }
  unbusy();
}

async function exportPNG() {
  const pages = expand();
  if (!pages.length) { toast('Adicione ao menos uma seção.'); return; }
  const i = clamp(currentPage, 0, pages.length - 1);
  busy('Gerando PNG da página ' + (i + 1) + '…');
  try {
    const [W, H] = paperWH();
    const dpi = s_dpi();
    try { await document.fonts.ready; } catch (e) {}
    let svg = buildSVG(i, pages[i]);
    if (typeof embeddedFontStyle === 'function') svg = svg.replace(/(<svg[^>]*>)/, '$1' + embeddedFontStyle());
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const cv = document.createElement('canvas');
    cv.width = Math.round(W / 25.4 * dpi); cv.height = Math.round(H / 25.4 * dpi);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = state.settings.paperBg; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    downloadBlob(blob, (docName() || 'planner') + '-pag-' + (i + 1) + '.png');
  } catch (e) { console.error(e); toast('Erro ao gerar o PNG.'); }
  unbusy();
}
function s_dpi() { return clamp(Math.round(num(state.settings.exportDPI, 300)), 150, 600); }

/* ---------- Impressão pronta (WYSIWYG com o PDF) ----------
   Monta um documento de impressão dedicado usando a MESMA imposição do PDF
   (tamanho real / 1 por folha / 2 por folha / livreto). Nada de imprimir a
   prancheta da tela — que só renderiza uma janela de páginas. */
function n2(v) { return (Math.round(v * 100) / 100); }
function planMarksSVG(sw, sh, sheet) {
  const L = 5, g = 2.2, w = 0.15;
  const seg = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${w}"/>`;
  let p = '';
  (sheet.trims || []).forEach(([x, y, ww, hh]) => {
    [[x, y, -1, -1], [x + ww, y, 1, -1], [x, y + hh, -1, 1], [x + ww, y + hh, 1, 1]].forEach(([px, py, dx, dy]) => {
      p += seg(px + dx * g, py, px + dx * (g + L), py) + seg(px, py + dy * g, px, py + dy * (g + L));
    });
  });
  if (sheet.ticks) {
    const [x, y, ww, hh] = sheet.ticks, t = 3.5;
    [[x, y, 1, 1], [x + ww, y, -1, 1], [x, y + hh, 1, -1], [x + ww, y + hh, -1, -1]].forEach(([px, py, dx, dy]) => {
      p += seg(px, py, px + dx * t, py) + seg(px, py, px, py + dy * t);
    });
  }
  if (sheet.foldX != null) p += `<line x1="${sheet.foldX}" y1="0" x2="${sheet.foldX}" y2="${n2(sh)}" stroke="#000" stroke-width="0.1" stroke-dasharray="1.2 1.2"/>`;
  if (sheet.foldY != null) p += `<line x1="0" y1="${sheet.foldY}" x2="${n2(sw)}" y2="${sheet.foldY}" stroke="#000" stroke-width="0.1" stroke-dasharray="1.2 1.2"/>`;
  return p ? `<svg class="pmarks" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(sw)} ${n2(sh)}">${p}</svg>` : '';
}

/* injeta regras de impressão sem <style> inline (a CSP proíbe): usa
   constructable stylesheet, ou, na falta dele, a CSSOM da própria print.css.
   Devolve uma função de limpeza. */
function installPrintRules(ruleList) {
  let sheet = null, constructed = null;
  // 1º: CSSOM de uma folha própria já carregada (a fragmentação de página do
  //     Blink respeita estas; adoptedStyleSheets nem sempre).
  for (const ss of document.styleSheets) {
    try { if (ss.href && /(print|studio|base)\.css(\?|$)/.test(ss.href) && ss.cssRules) { sheet = ss; break; } } catch (e) {}
  }
  // 2º: constructable stylesheet
  if (!sheet) {
    try {
      if ('adoptedStyleSheets' in document && typeof CSSStyleSheet === 'function') {
        constructed = new CSSStyleSheet();
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, constructed];
        sheet = constructed;
      }
    } catch (e) { constructed = null; sheet = null; }
  }
  if (!sheet) return null;
  const added = [];
  ruleList.forEach(r => { try { added.push(sheet.insertRule(r, sheet.cssRules.length)); } catch (e) { console.warn('print rule falhou', e); } });
  return () => {
    if (constructed) { try { document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== constructed); } catch (e) {} return; }
    added.sort((a, b) => b - a).forEach(i => { try { sheet.deleteRule(i); } catch (e) {} });
  };
}

// CSS @page: id de folha conhecido (a4/letter/a3) vira "A4 landscape" em vez
// de "297mm 210mm" — a forma com PALAVRA-CHAVE é o que faz o navegador
// sincronizar o seletor Retrato/Paisagem do diálogo de impressão sozinho.
// (Girar o CONTEÚDO pra caber numa folha retrato foi tentado e revertido:
// 2 páginas lado a lado viram 2 empilhadas na vertical quando giradas pra
// caber numa largura de retrato — geometricamente 2×A5 [296mm] não cabe
// nos 210mm de largura de uma A4 retrato. Paisagem de verdade é a única
// forma de manter o layout lado a lado como desenhado.) Se o diálogo não
// sincronizar sozinho, o toast abaixo pede pra escolher Paisagem à mão —
// 1 clique, sem trocar o tamanho nem o conteúdo.
const PAGE_SIZE_KEYWORD = { a4: 'A4', letter: 'letter', a3: 'A3' };
function printPageSizeCss(plan, eff) {
  const kw = !plan.paper && PAGE_SIZE_KEYWORD[eff.sheet];
  if (kw) return kw + ' ' + (plan.sheetW > plan.sheetH ? 'landscape' : 'portrait');
  return n2(plan.sheetW) + 'mm ' + n2(plan.sheetH) + 'mm';
}

async function printDoc() {
  const pages = expand();
  if (!pages.length) { toast('Adicione ao menos uma seção.'); return; }
  const s = state.settings, [W, H] = paperWH();
  const eff = effectiveExportMode();
  const plan = impositionPlan(pages.length);
  busy('Preparando impressão — ' + plan.sheets.length + ' folha(s)…');
  await new Promise(r => setTimeout(r, 20));
  try {
    const old = document.getElementById('printRoot'); if (old) old.remove();
    if (window.__printCleanup) { try { window.__printCleanup(); } catch (e) {} window.__printCleanup = null; }

    const SW = n2(plan.sheetW), SH = n2(plan.sheetH);
    const removeRules = installPrintRules([
      '@page{size:' + printPageSizeCss(plan, eff) + ';margin:0}',
      '@media print{' +
        'html,body{margin:0!important;padding:0!important;background:#fff!important;' +
          'height:auto!important;min-height:0!important;overflow:visible!important}' +
        'body>*{display:none!important}' +
        'body>#printRoot{display:block!important}' +
        '#printRoot .psheet{position:relative;width:' + SW + 'mm;height:' + n2(plan.sheetH - 0.2) + 'mm;' +
          'overflow:hidden;background:#fff;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}' +
        '#printRoot .psheet:last-child{page-break-after:auto;break-after:auto}' +
        '#printRoot .pslot{position:absolute}' +
        '#printRoot .pslot>svg{display:block;width:100%;height:100%}' +
        '#printRoot .pmarks{position:absolute;left:0;top:0;width:100%;height:100%}' +
      '}'
    ]);
    if (!removeRules) { toast('Seu navegador bloqueou o preparo da impressão. Use o botão PDF.'); unbusy(); return; }

    const root = document.createElement('div');
    root.id = 'printRoot';
    for (let si = 0; si < plan.sheets.length; si++) {
      const sheet = plan.sheets[si];
      const psheet = document.createElement('div');
      psheet.className = 'psheet';
      for (const slot of sheet.slots) {
        const pen = SvgPen(W, H, { bg: s.paperBg });
        drawPageInto(pen, pages[slot.src], slot.src,
          plan.paper ? { screen: false, bleed: plan.bleed, total: pages.length }
                     : { screen: false, print: true, total: pages.length });
        const sl = document.createElement('div');
        sl.className = 'pslot';
        sl.style.left = n2(slot.ox) + 'mm';
        sl.style.top = n2(slot.oy) + 'mm';
        sl.style.width = n2(W * slot.sc) + 'mm';
        sl.style.height = n2(H * slot.sc) + 'mm';
        sl.innerHTML = pen.svg();
        psheet.appendChild(sl);
      }
      const ms = planMarksSVG(plan.sheetW, plan.sheetH, sheet);
      if (ms) psheet.insertAdjacentHTML('beforeend', ms);
      root.appendChild(psheet);
      if (si % 40 === 0) { busy('Renderizando ' + (si + 1) + ' / ' + plan.sheets.length + '…'); await new Promise(r => setTimeout(r, 0)); }
    }
    document.body.appendChild(root);
    try { await document.fonts.ready; } catch (e) {}
    await new Promise(r => setTimeout(r, 80));
    unbusy();

    let done = false;
    const cleanup = () => {
      if (done) return; done = true;
      root.remove();
      try { removeRules(); } catch (e) {}
      window.__printCleanup = null;
      window.removeEventListener('afterprint', onAfter);
      clearTimeout(fallback);
    };
    // limpa só DEPOIS que o trabalho de impressão foi enfileirado — alguns
    // navegadores disparam 'afterprint' cedo demais e cortariam as páginas.
    const onAfter = () => setTimeout(cleanup, 4000);
    window.__printCleanup = cleanup;
    const fallback = setTimeout(cleanup, 120000);
    window.addEventListener('afterprint', onAfter);
    const extra = plan.mode === 'booklet' ? ' · frente e verso, virar pela borda curta, depois dobrar'
      : plan.mode === '2up' ? ' · imprima e corte na linha do meio'
      : ' · deixe escala 100% e margens Nenhuma';
    const landscapeHint = plan.sheetW > plan.sheetH ? ' · se o diálogo não marcar Paisagem sozinho, escolha Paisagem' : '';
    toast('Impressão: ' + plan.sheets.length + ' folha(s) — ' + modeLabel(s) + extra + landscapeHint);
    window.print();
  } catch (e) { console.error(e); toast('Erro ao preparar a impressão.'); unbusy(); }
}

function docName() {
  const cov = state.sections.find(s => s.type === 'cover');
  const t = cov && cov.opts && cov.opts.title;
  return (t ? String(t) : 'Planner Studio').replace(/[^\wÀ-ÿ .-]/g, '').trim().slice(0, 60);
}

/* ---------- projeto .json ---------- */
function exportProject() {
  try {
    const data = JSON.stringify({ app: 'planner-studio', v: 1, state }, null, 0);
    downloadBlob(new Blob([data], { type: 'application/json' }), (docName() || 'planner') + '.json');
    toast('Projeto salvo.');
  } catch (e) { toast('Erro ao salvar o projeto.'); }
}
async function importProject(file) {
  if (file.size > 8 * 1024 * 1024) { alert('Arquivo grande demais para um projeto do Planner.'); return; }
  busy('Abrindo projeto…');
  try {
    const d = JSON.parse(await file.text());
    const st = d && d.state ? d.state : d;
    if (!st || typeof st !== 'object') throw new Error('estrutura');
    state = migrate(st);
    selId = state.sections[0] ? state.sections[0].id : null;
    past = []; future = []; histMeta = []; svgCache.clear(); currentPage = 0;
    syncDocControls(); render(); save(); fit();
    toast('Projeto carregado.');
  } catch (e) { console.error(e); alert('Arquivo de projeto inválido.'); }
  unbusy();
}

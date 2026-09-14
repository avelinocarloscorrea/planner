/* Planner Studio — js/io.js
   exportar PDF vetorial (multipágina), PNG da página atual e salvar/abrir
   projeto .json. Tudo no navegador — nada é enviado.
   (parte de app; carregado em ordem por index.html) */
"use strict";

/* ================== imposição (montagem na folha) ==================
   Traduz a lista de páginas do miolo num conjunto de FOLHAS de saída.
   Toda a matemática vem de vendor/core/print.js (EPPrint) — a mesma do
   Calendar Studio.
   - real   : 1 folha = 1 página no tamanho final. Sangria opcional; com marcas
              de corte a folha ganha uma faixa (slug) para as marcas ficarem
              FORA da sangria. TrimBox/BleedBox no PDF.
   - fit    : 1 página centralizada numa folha comum + marcas de corte.
   - 2up    : 2 páginas por folha — "exato" (100 %) ou "reduzir para caber".
   - booklet: livreto (dobra ao meio) com compensação de creep.
   Duplex (2up frente e verso, livreto): o verso é montado para a borda de
   virada escolhida (curta/longa) — se a virada espelha no outro eixo, a folha
   do verso é girada 180°.
   Cada folha: { slots:[{src,ox,oy,sc,rot,clip}], marks:[[x1,y1,x2,y2]…], foldX, foldY, trimBox, bleedBox } */
const OUT_SHEETS = { a4: [210, 297], letter: [215.9, 279.4], a3: [297, 420] };
function outSheet(id) { return OUT_SHEETS[id] || OUT_SHEETS.a4; }

// a saída é frente e verso? (define o lado da lombada/furo em cada página)
function outputDuplex() {
  const s = state.settings, eff = effectiveExportMode();
  if (eff.mode === 'booklet') return true;
  if (eff.mode === '2up') return s.twoUpOrder === 'duplex';
  return !!s.mirrorMargins;
}

function impositionPlan(nPages) {
  const s = state.settings, [W, H] = paperWH();
  const eff = effectiveExportMode();
  const mode = ['real', 'fit', '2up', 'booklet'].includes(eff.mode) ? eff.mode : 'real';
  const P = EPPrint;
  const blank = () => ({ slots: [], marks: [], foldX: null, foldY: null });

  if (mode === 'real') {
    const bleed = Math.max(0, s.bleedMm || 0), marks = !!s.cropMarks;
    const bx = P.boxes(W, H, { bleed, marks, safe: s.safeMm });
    const segs = marks ? P.markSegments(bx.trim, { bleed }) : [];
    if (marks && s.registration) segs.push(...registrationSegs(bx));
    const mk = i => ({ slots: [{ src: i, ox: bx.slug, oy: bx.slug, sc: 1 }], marks: segs, foldX: null, foldY: null, trimBox: bx.trim, bleedBox: bx.bleed });
    const sheets = [];
    for (let i = 0; i < nPages; i++) sheets.push(mk(i));
    if (s.mirrorMargins && sheets.length % 2) sheets.push({ ...blank(), trimBox: bx.trim, bleedBox: bx.bleed, marks: segs });
    return { mode, paper: true, bleed, slug: bx.slug, sheetW: bx.media.w, sheetH: bx.media.h, sheets, duplex: false, boxes: bx };
  }

  const B = outSheet(eff.sheet);

  if (mode === 'fit') {
    let sw = B[0], sh = B[1];
    if (W > sw || H > sh) { sw = B[1]; sh = B[0]; }                 // gira a folha
    // sangria cabe se sobrar espaço; marcas sempre fora dela
    const bleed = Math.max(0, s.bleedMm || 0);
    const reach = P.markReach();
    const sc = Math.min(1, (sw - 2 * (bleed + reach)) / W, (sh - 2 * (bleed + reach)) / H);
    const pw = W * sc, ph = H * sc, ox = (sw - pw) / 2, oy = (sh - ph) / 2;
    const trim = { x: ox, y: oy, w: pw, h: ph };
    const bl = { x: ox - bleed * sc, y: oy - bleed * sc, w: pw + 2 * bleed * sc, h: ph + 2 * bleed * sc };
    const segs = P.markSegments(trim, { bleed: bleed * sc });
    const sheets = [];
    for (let i = 0; i < nPages; i++) sheets.push({ slots: [{ src: i, ox, oy, sc }], marks: segs, foldX: null, foldY: null, trimBox: trim, bleedBox: bl });
    if (s.mirrorMargins && sheets.length % 2) sheets.push(blank());
    return { mode, bleed, sheetW: sw, sheetH: sh, sheets, duplex: false, scale: sc };
  }

  // 2up / booklet — duas páginas por folha
  const t = P.twoUp(B[0], B[1], W, H, { fit: s.twoUpFit, margin: 4 });
  const sw = t.sheetW, sh = t.sheetH, sc = t.sc;
  const pos = t.slots;
  const block = t.block;
  // marcas: se sobra folha em volta do bloco, marcas nos cantos (fora da arte);
  // se o bloco preenche a folha (2×A5 = A4), só a linha de corte no meio.
  const room = Math.min(block.x, block.y);
  const segs = room >= P.markReach() ? P.markSegments(block, {}) : [];
  // marcas das bordas internas (corte ao meio) nas margens
  if (room >= P.markReach()) {
    if (t.foldX != null) { segs.push([t.foldX, block.y - 1, t.foldX, block.y - 1 - P.MARK.len]); segs.push([t.foldX, block.y + block.h + 1, t.foldX, block.y + block.h + 1 + P.MARK.len]); }
    if (t.foldY != null) { segs.push([block.x - 1, t.foldY, block.x - 1 - P.MARK.len, t.foldY]); segs.push([block.x + block.w + 1, t.foldY, block.x + block.w + 1 + P.MARK.len, t.foldY]); }
  }
  const trimBoxes = pos.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
  const slot = (src, k, extra) => (src != null && src >= 0 && src < nPages) ? Object.assign({ src, ox: pos[k].x, oy: pos[k].y, sc,
    clip: { x: pos[k].x, y: pos[k].y, w: pos[k].w, h: pos[k].h } }, extra || {}) : null;
  const mk = (a, b, ea, eb) => ({ slots: [slot(a, 0, ea), slot(b, 1, eb)].filter(Boolean), marks: segs, foldX: t.foldX, foldY: t.foldY,
    trimBox: block, bleedBox: block, trimBoxes });
  // verso: montado para virar como página de livro (espelho no eixo x). Se a
  // virada escolhida espelha em y, a folha do verso gira 180°.
  const rotateBack = P.duplexAxis(sw, sh, s.duplexFlip) === 'y';
  const back = sheet => {
    if (!rotateBack) return sheet;
    sheet.slots.forEach(sl => {
      const w = W * sl.sc, h = H * sl.sc;
      sl.ox = sw - sl.ox - w; sl.oy = sh - sl.oy - h; sl.rot = 180;
      if (sl.clip) sl.clip = { x: sw - sl.clip.x - sl.clip.w, y: sh - sl.clip.y - sl.clip.h, w: sl.clip.w, h: sl.clip.h };
    });
    return sheet;
  };
  // quando o 2 por folha é empilhado na vertical (página deitada), "lado de
  // livro" é o eixo y: a regra de troca vale igual, só muda o eixo.
  const sheets = [];
  if (mode === '2up') {
    if (s.twoUpOrder === 'duplex') {
      // Frente e verso sincronizados: pilha esquerda = 1..H1, pilha direita =
      // H1+1..N. Cada folha é impressa dos dois lados e cortada ao meio — as
      // metades já saem na ordem certa. No verso as posições trocam de lado
      // (a virada espelha a folha).
      const H1 = Math.ceil(nPages / 2);
      const pairs = Math.ceil(H1 / 2);
      for (let k = 0; k < pairs; k++) {
        const lf = 2 * k, lb = 2 * k + 1, rf = H1 + 2 * k, rb = H1 + 2 * k + 1;
        sheets.push(mk(lf < H1 ? lf : null, rf));
        sheets.push(back(mk(rb, lb < H1 ? lb : null)));
      }
    } else if (s.twoUpOrder === 'seq') {
      const Hn = Math.ceil(nPages / 2);
      for (let k = 0; k < Hn; k++) sheets.push(mk(2 * k, 2 * k + 1));
    } else {
      // corte-e-empilhe: metade esquerda k, direita k+H; empilhe a direita sob a esquerda
      const Hn = Math.ceil(nPages / 2);
      for (let k = 0; k < Hn; k++) sheets.push(mk(k, k + Hn));
    }
  } else {
    // livreto: creep — as folhas internas avançam na borda de fora ao dobrar;
    // a arte delas se desloca para a dobra pela espessura do papel.
    const caliper = s.bookletCreep && typeof EPBinding !== 'undefined' ? EPBinding.sheetCaliperMm(s.bindPaperGsm, s.bindPaperKind) : 0;
    const order = P.bookletOrder(nPages, { caliperMm: caliper });
    // eixo da dobra: x (lado a lado) ou y (empilhado)
    const alongX = t.cols === 2;
    const shiftOf = (k, first) => {
      const d = order.sides[k].shift;
      return first ? (alongX ? { dx: d } : { dy: d }) : (alongX ? { dx: -d } : { dy: -d });
    };
    for (let k = 0; k < order.sides.length; k++) {
      const sd = order.sides[k];
      const e0 = shiftOf(k, true), e1 = shiftOf(k, false);
      const sheet = mk(sd.left, sd.right);
      sheet.slots.forEach((sl, i) => {
        const e = (sl.src === sd.left) ? e0 : e1;
        sl.ox += e.dx || 0; sl.oy += e.dy || 0; sl.creep = order.sides[k].shift;
      });
      sheets.push(sd.side === 'back' ? back(sheet) : sheet);
    }
  }
  return { mode, sheetW: sw, sheetH: sh, sheets, scale: sc, overflow: t.overflow,
    duplex: mode === 'booklet' || (mode === '2up' && s.twoUpOrder === 'duplex') };
}
// alvos de registro (círculo + cruz) no meio de cada lado, na faixa do slug
function registrationSegs(bx) {
  const r = 2.2, segs = [], c = (x, y) => {
    segs.push([x - r - 1, y, x + r + 1, y], [x, y - r - 1, x, y + r + 1]);
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      segs.push([x + r * Math.cos(a0), y + r * Math.sin(a0), x + r * Math.cos(a1), y + r * Math.sin(a1)]);
    }
  };
  const off = (bx.bleed.x) / 2;                         // meio da faixa entre a folha e a sangria
  c(bx.media.w / 2, off); c(bx.media.w / 2, bx.media.h - off);
  c(off, bx.media.h / 2); c(bx.media.w - off, bx.media.h / 2);
  return segs;
}

function sheetFileTag(s) {
  const eff = effectiveExportMode();
  const color = s.pdfColor === 'cmyk' ? '-grafica-CMYK' : '';
  if (eff.mode === 'real') return color;
  const sh = ({ a4: 'A4', letter: 'Carta', a3: 'A3' })[eff.sheet] || 'A4';
  return '-' + sh + ({ fit: '', '2up': '-2up', booklet: '-livreto' }[eff.mode] || '') + color;
}
function modeLabel(s) {
  const eff = effectiveExportMode();
  const base = ({ real: 'tamanho real', fit: 'uma página por folha + corte',
    '2up': 'duas por folha (cortar ao meio)', booklet: 'livreto — dobrar ao meio' })[eff.mode] || 'tamanho real';
  return eff.auto ? base + ' (automático)' : base;
}
// opções de desenho de uma página do slot, iguais no PDF, na prévia e na impressão
function slotDrawOpts(plan, total) {
  return plan.paper ? { screen: false, bleed: plan.bleed, total }
    : { screen: false, print: true, bleed: plan.mode === 'fit' ? plan.bleed : 0, total };
}

// capa e miolo em arquivos separados (gráficas imprimem a capa em outro papel)
function exportSelection() {
  const s = state.settings, all = expand().map((pd, idx) => ({ pd, idx }));
  if (s.exportPart === 'cover') return all.filter(x => x.pd.type === 'cover');
  if (s.exportPart === 'body') return all.filter(x => x.pd.type !== 'cover');
  return all;
}
async function exportPDF() {
  const sel = exportSelection();
  if (typeof EPArt !== 'undefined') await EPArt.ensure(usedArtIds(state));   // ilustrações do catálogo
  if (!sel.length) { toast(state.settings.exportPart === 'cover' ? 'O documento não tem capa.' : 'Adicione ao menos uma seção.'); return; }
  const pages = expand();
  if (typeof resetPdfImages === 'function') resetPdfImages();
  const s = state.settings, [W, H] = paperWH();
  const plan = impositionPlan(sel.length);
  const cmyk = s.pdfColor === 'cmyk';
  busy('Gerando PDF — ' + plan.sheets.length + ' folha(s)…');
  await new Promise(r => setTimeout(r, 20));
  try {
    const bgHex = plan.paper ? s.paperBg : '#ffffff';
    const paintMioloBg = !plan.paper && s.paperBg && s.paperBg.toLowerCase() !== '#ffffff';
    const dopt = slotDrawOpts(plan, pages.length);
    const out = [];
    for (let si = 0; si < plan.sheets.length; si++) {
      const sheet = plan.sheets[si];
      out.push(composeSheetPdf({ sheet, sheetW: plan.sheetW, sheetH: plan.sheetH, W, H, bg: bgHex,
        draw: (sp, slot) => {
          if (paintMioloBg) { const b = dopt.bleed || 0; sp.rect(-b, -b, W + 2 * b, H + 2 * b, { fill: s.paperBg }); }
          drawPageInto(sp, sel[slot.src].pd, sel[slot.src].idx, dopt);
        } }));
      if (si % 20 === 0) { busy('Folha ' + (si + 1) + ' / ' + plan.sheets.length + '…'); await new Promise(r => setTimeout(r, 0)); }
    }
    busy(cmyk ? 'Convertendo para CMYK (FOGRA39) e incorporando fontes…' : 'Incorporando fontes e montando o arquivo…');
    await new Promise(r => setTimeout(r, 0));
    const bytes = await buildPDF(out, { color: s.pdfColor, inkSave: (s.inkSave || 0) / 100, title: docName() || 'Planner', creator: 'Planner Studio — Esmeralda Paper' });
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), (docName() || 'planner') + ({ cover: '-capa', body: '-miolo' }[s.exportPart] || '') + sheetFileTag(s) + '.pdf');
    toast('PDF' + (cmyk ? ' para gráfica (CMYK · PDF/X-4)' : '') + ': ' + plan.sheets.length + ' folha(s) · ' + sel.length + ' pág. · ' +
      (bytes.length / 1024).toFixed(0) + ' KB · ' + modeLabel(s));
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF.'); }
  unbusy();
}

async function exportPNG() {
  const pages = expand();
  if (typeof EPArt !== 'undefined') await EPArt.ensure(usedArtIds(state));
  if (!pages.length) { toast('Adicione ao menos uma seção.'); return; }
  const i = clamp(currentPage, 0, pages.length - 1);
  busy('Gerando PNG da página ' + (i + 1) + '…');
  try {
    const [W, H] = paperWH();
    const dpi = s_dpi();
    try { await document.fonts.ready; } catch (e) {}
    let svg = buildSVG(i, pages[i]);
    { const fcss = await embeddedFontStyle(svg); svg = svg.replace(/(<svg[^>]*>)/, m => m + fcss); }
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
  if (typeof EPArt !== 'undefined') await EPArt.ensure(usedArtIds(state));
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
      const dopt = slotDrawOpts(plan, pages.length);
      const slots = sheet.slots.map(slot => {
        const pen = SvgPen(W, H, { bg: s.paperBg });
        drawPageInto(pen, pages[slot.src], slot.src, dopt);
        return { x: slot.ox, y: slot.oy, w: W * slot.sc, h: H * slot.sc, rot: slot.rot, clip: slot.clip, svg: pen.svg() };
      });
      // folha inteira como um SVG — mesma geometria do PDF (marcas, giro, recorte)
      psheet.innerHTML = EPShell.sheetSVG({ w: plan.sheetW, h: plan.sheetH, slots, marks: sheet.marks, foldX: sheet.foldX, foldY: sheet.foldY, print: true })
        .replace('class="ep-sheet__svg"', 'class="pmarks"');
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
    const extra = plan.mode === 'booklet' ? ` · frente e verso, virar pela borda ${s.duplexFlip === 'long' ? 'longa' : 'curta'}, depois dobrar`
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
const PRESET_DROP = ['events', 'footerText', 'labels'];
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
    if (d && d.preset === true && d.settings && typeof d.settings === 'object') {
      pushHistory('preset'); state.settings = { ...state.settings, ...d.settings }; state = migrate(state);
      svgCache.clear(); syncDocControls(); render(); save(); fit(); toast('Predefinição aplicada.'); unbusy(); return;
    }
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

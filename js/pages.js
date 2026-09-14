/* Planner Studio — js/pages.js
   Desenho de cada tipo de página. Tudo em mm. O conteúdo já é recortado à área
   útil por engine.js (drawPageInto), então layouts nunca "vazam" da margem;
   ainda assim cada tipo se adapta ao tamanho da caixa (texto encolhe/quebra).
     pen  — SvgPen (tela) ou PdfPen (PDF); mesma API
     box  — {x,y,w,h,recto} área útil
     o    — opções da seção mescladas com os defaults do tipo
     ctx  — { S, ink, faint, hair, accent, date, date2, weekStart, ... }
   (parte de app; carregado em ordem por index.html) */
"use strict";

/* ---------- cor ---------- */
function mixHex(a, b, t) {
  const [ar, ag, ab] = hexRGB(a), [br, bg, bb] = hexRGB(b);
  const m = (x, y) => Math.round(x + (y - x) * t);
  return '#' + [m(ar, br), m(ag, bg), m(ab, bb)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/* ---------- datas (pt-BR) ---------- */
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DOW_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DOW3_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function startOfWeek(d, weekStart) {
  const x = new Date(d), dow = x.getDay();
  x.setDate(x.getDate() - (weekStart === 'sun' ? dow : (dow + 6) % 7));
  x.setHours(0, 0, 0, 0); return x;
}
const orderedDOW = ws => ws === 'sun' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
const isWknd = dow => dow === 0 || dow === 6;
const wkCol = (ctx, dow) => (ctx.highlightWeekends !== false && isWknd(dow)) ? ctx.accent : ctx.ink;
const pad2 = v => String(v).padStart(2, '0');
const fmtDMY = d => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const weekDates = (d, ws) => { const s = startOfWeek(d, ws); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };

/* ---------- primitivas ---------- */
let HEAD_FAM = 'sans';   // família dos títulos (engine.js ajusta por página)
let HEAD_EL = null;      // { o, ctx, done } — o título da seção vira elemento editável na folha
// título que sempre cabe: encolhe até min, depois trunca.
function heading(pen, str, x, y, maxW, startPt, minPt, o) {
  let fam = (o && o.family) || HEAD_FAM, bold = true;
  const ed = HEAD_EL && !HEAD_EL.done && String(str) === String(HEAD_EL.o.title) ? HEAD_EL : null;
  if (ed) {
    ed.done = true;
    const f = elFx(ed.o, 'title');
    if (f.hide) return startPt;
    x += f.dx; y += f.dy; startPt *= f.s; minPt = (minPt || startPt / f.s * 0.6) * f.s; maxW *= Math.max(1, f.s);
    if (f.fam) fam = f.fam;
    if (f.bold === false) bold = false;
    o = Object.assign({}, o, f.color ? { color: f.color } : null);
  }
  const size = pen.fitText(str, maxW, startPt, minPt || startPt * 0.6, bold, fam);
  let s = String(str), lim = maxW * 0.98;
  if (pen.textWidth(s, size, bold, fam) > lim) {
    while (s.length > 1 && pen.textWidth(s + '…', size, bold, fam) > lim) s = s.slice(0, -1);
    s = s.replace(/[ ·–-]+$/, '') + '…';
  }
  pen.text(s, x, y, Object.assign({ size, font: bold ? 'bold' : undefined, baseline: 'top' }, o, { family: fam }));
  if (ed) {
    const tw = pen.textWidth(s, size, bold, fam), al = o && o.align;
    elHit(ed.ctx, 'title', 'Título', 'text', al === 'c' ? x - tw / 2 : al === 'r' ? x - tw : x, y, tw, size / PT * 1.2);
  }
  return size;
}
// EDGE: recuo mínimo pra nenhum ponto/linha do padrão ficar em cima do recorte
// (era o que dava a impressão de "linha cortada"). O padrão é sempre centrado.
// uma linha de texto que nunca passa de maxW: corta com reticências
function clipLine(pen, str, maxW, size, bold) {
  let t = String(str || '');
  if (pen.textWidth(t, size, !!bold) <= maxW) return t;
  while (t.length > 1 && pen.textWidth(t + '…', size, !!bold) > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
const EDGE = 0.6;
function fitCells(len, step) {
  const n = Math.max(1, Math.floor((len - 2 * EDGE) / step));
  return { n, off: (len - n * step) / 2 };
}
// cor do padrão a partir da "intensidade" (0,08 = fantasma … 1 = tinta cheia; padrão 0,42)
function patColor(ctx, o, mult = 1) {
  const t = clamp((o && o.intensity != null ? +o.intensity : 0.42) * mult, 0.05, 1);
  return mixHex(ctx.ink, ctx.S.paperBg, 1 - t);
}
// traço de linha por estilo: solid | dashed | dotted
function lineDash(style, w) {
  if (style === 'dashed') return [Math.max(1.4, w * 8), Math.max(1.1, w * 6)];
  if (style === 'dotted') return [Math.max(0.35, w * 2.5), Math.max(0.8, w * 5)];
  return null;
}
function fillDots(pen, b, step, r, color, opts = {}) {
  if (b.w <= 2 || b.h <= 2) return;
  const cx = fitCells(b.w, step), cy = fitCells(b.h, step);
  const shape = opts.shape || 'dot';
  for (let j = 0; j <= cy.n; j++) for (let i = 0; i <= cx.n; i++) {
    const x = b.x + cx.off + i * step, y = b.y + cy.off + j * step;
    if (shape === 'plus') { const a = r * 3.2; pen.line(x - a, y, x + a, y, { w: r * 1.4, color }); pen.line(x, y - a, x, y + a, { w: r * 1.4, color }); }
    else if (shape === 'cross') { const a = r * 2.4; pen.line(x - a, y - a, x + a, y + a, { w: r * 1.3, color }); pen.line(x - a, y + a, x + a, y - a, { w: r * 1.3, color }); }
    else pen.dot(x, y, r, { fill: color });
  }
}
function fillGrid(pen, b, step, w, color, opts = {}) {
  if (b.w <= 2 || b.h <= 2) return;
  const cx = fitCells(b.w, step), cy = fitCells(b.h, step);
  const x0 = b.x + cx.off, y0 = b.y + cy.off, x1 = x0 + cx.n * step, y1 = y0 + cy.n * step;
  const dash = opts.dash || null;
  if (opts.subStep && opts.subColor) {
    const s = opts.subStep;
    for (let x = x0; x <= x1 + 0.01; x += s) pen.line(x, y0, x, y1, { w: w * 0.6, color: opts.subColor });
    for (let y = y0; y <= y1 + 0.01; y += s) pen.line(x0, y, x1, y, { w: w * 0.6, color: opts.subColor });
  }
  for (let i = 0; i <= cx.n; i++) pen.line(x0 + i * step, y0, x0 + i * step, y1, { w, color, dash });
  for (let j = 0; j <= cy.n; j++) pen.line(x0, y0 + j * step, x1, y0 + j * step, { w, color, dash });
}
function fillLines(pen, b, step, w, color, from, opts = {}) {
  const x0 = b.x + EDGE, x1 = b.x + b.w - EDGE, top = (from == null ? b.y + step : from);
  const dash = opts.dash || null;
  for (let y = top; y <= b.y + b.h - EDGE + 0.01; y += step) pen.line(x0, y, x1, y, { w, color, dash });
}
const frameOf = (pen, b, color, w) => pen.rect(b.x, b.y, b.w, b.h, { stroke: color, w: w || 0.3 });
const cbox = (pen, x, y, size, color) => pen.rect(x, y - size, size, size, { stroke: color, w: 0.3 });
// estrela de 5 pontas (contorno) — desenhada com segmentos, serve em SVG e PDF
function star(pen, cx, cy, r, color) {
  const ri = r * 0.42, pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  for (let i = 0; i < 10; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 10];
    pen.line(x1, y1, x2, y2, { w: 0.18, color, cap: 'round' });
  }
}

/* cabeçalho: faixa opcional com título (à esquerda) e "DATA ___" (à direita) */
function drawHeader(pen, box, ctx, label, showDate) {
  const { ink, faint } = ctx;
  const bandH = Math.min(13, box.h * 0.1);
  const dateW = showDate === false ? 0 : Math.min(42, box.w * 0.34);
  if (label) heading(pen, label, box.x, box.y + 1, box.w - dateW - 3, 12, 8, { color: ink });
  if (dateW) {
    pen.text(ctx.L('data'), box.x + box.w - dateW, box.y + 2, { size: 6, color: faint, tracking: 0.4 });
    pen.line(box.x + box.w - dateW, box.y + bandH - 2.5, box.x + box.w, box.y + bandH - 2.5, { w: 0.3, color: faint });
  }
  pen.line(box.x, box.y + bandH, box.x + box.w, box.y + bandH, { w: 0.4, color: ink });
  return { x: box.x, y: box.y + bandH + 4, w: box.w, h: box.h - bandH - 4, recto: box.recto };
}

/* ================================================================= */
const PAGE_DRAW = {};

PAGE_DRAW.blank = (pen, box, o, ctx) => { if (o.header) drawHeader(pen, box, ctx, o.title || ''); };

PAGE_DRAW.dot = (pen, box, o, ctx) => {
  const b = o.header ? drawHeader(pen, box, ctx, o.title || '') : box;
  const pc = patColor(ctx, o);
  if (o.frame) frameOf(pen, b, pc, 0.3);
  fillDots(pen, b, o.spacing, o.dotSize, pc, { shape: o.dotShape || 'dot' });
};
PAGE_DRAW.grid = (pen, box, o, ctx) => {
  const b = o.header ? drawHeader(pen, box, ctx, o.title || '') : box;
  const pc = patColor(ctx, o);
  if (o.frame) frameOf(pen, b, pc, 0.3);
  fillGrid(pen, b, o.spacing, o.lineW, pc, {
    dash: lineDash(o.lineStyle, o.lineW),
    subStep: o.subGrid && o.spacing >= 4 ? o.spacing / 5 : 0,
    subColor: patColor(ctx, o, 0.45),
  });
};
PAGE_DRAW.graph5 = (pen, box, o, ctx) => {
  const b = o.header ? drawHeader(pen, box, ctx, o.title || '') : box;
  const pc = patColor(ctx, o, 0.8);
  fillGrid(pen, b, o.spacing, o.lineW, pc);
  const cx = fitCells(b.w, o.spacing), cy = fitCells(b.h, o.spacing);
  const x0 = b.x + cx.off, y0 = b.y + cy.off;
  const pcM = patColor(ctx, o);
  for (let i = 0; i <= cx.n; i += 5) pen.line(x0 + i * o.spacing, y0, x0 + i * o.spacing, y0 + cy.n * o.spacing, { w: o.lineW * 2.2, color: pcM });
  for (let j = 0; j <= cy.n; j += 5) pen.line(x0, y0 + j * o.spacing, x0 + cx.n * o.spacing, y0 + j * o.spacing, { w: o.lineW * 2.2, color: pcM });
};
PAGE_DRAW.lined = (pen, box, o, ctx) => {
  let b = o.header ? drawHeader(pen, box, ctx, o.title || '') : box;
  const pc = patColor(ctx, o);
  const mcol = (o.marginColor && HEX.test(o.marginColor)) ? o.marginColor : ctx.accent;
  if (o.marginRule) {
    const mx = b.x + Math.min(18, b.w * 0.14);
    pen.line(mx, b.y - 2, mx, b.y + b.h, { w: 0.3, color: mcol });
    b = { x: mx + 3, y: b.y, w: b.w - (mx + 3 - b.x), h: b.h };
  }
  const dash = lineDash(o.lineStyle, o.lineW);
  const step = o.spacing, top = b.y + step;
  if (o.headerRule) pen.line(b.x + EDGE, top, b.x + b.w - EDGE, top, { w: Math.max(0.35, o.lineW * 2.4), color: patColor(ctx, o, 1.4) });
  fillLines(pen, b, step, o.lineW, pc, o.headerRule ? top + step : null, { dash });
  if (o.guideLine) for (let y = top + step / 2; y <= b.y + b.h - EDGE + 0.01; y += step)
    pen.line(b.x + EDGE, y, b.x + b.w - EDGE, y, { w: o.lineW * 0.7, color: patColor(ctx, o, 0.4), dash: [0.6, 1.4] });
};
PAGE_DRAW.linedNarrow = PAGE_DRAW.lined;

// helper: aplica margem vertical opcional e devolve a caixa reduzida
function withMargin(pen, b, o, ctx) {
  if (!o.marginRule) return b;
  const mx = b.x + Math.min(18, b.w * 0.14);
  pen.line(mx, b.y - 2, mx, b.y + b.h, { w: 0.3, color: ctx.accent });
  return { x: mx + 3, y: b.y, w: b.w - (mx + 3 - b.x), h: b.h, recto: b.recto };
}

PAGE_DRAW.ruledDouble = (pen, box, o, ctx) => {
  let b = o.header ? drawHeader(pen, box, ctx, o.title || '') : box;
  b = withMargin(pen, b, o, ctx);
  const pc = patColor(ctx, o, 1.1), x0 = b.x + EDGE, x1 = b.x + b.w - EDGE;
  const step = Math.max(o.gap + 1.5, o.spacing), gap = clamp(+o.gap || 2.4, 1, step - 1);
  for (let y = b.y + step; y <= b.y + b.h - EDGE + 0.01; y += step) {
    pen.line(x0, y - gap, x1, y - gap, { w: Math.max(0.13, o.lineW * 0.7), color: patColor(ctx, o, 0.55) });
    pen.line(x0, y, x1, y, { w: Math.max(0.22, o.lineW), color: pc });
  }
};

PAGE_DRAW.seyes = (pen, box, o, ctx) => {
  let b = o.header ? drawHeader(pen, box, ctx, o.title || '') : box;
  b = withMargin(pen, b, o, ctx);
  const x0 = b.x + EDGE, x1 = b.x + b.w - EDGE;
  const H = clamp(+o.spacing || 8, 4, 14), subs = clamp(+o.subs || 3, 1, 4);
  const strong = patColor(ctx, o, 1.2), thin = patColor(ctx, o, 0.42);
  for (let y = b.y + H; y <= b.y + b.h - EDGE + 0.01; y += H) {
    for (let k = 1; k <= subs; k++) {
      const yy = y - (H / (subs + 1)) * k;
      if (yy > b.y + EDGE) pen.line(x0, yy, x1, yy, { w: 0.12, color: thin });
    }
    pen.line(x0, y, x1, y, { w: 0.26, color: strong });
  }
  if (o.verticals !== false) for (let x = x0; x <= x1 + 0.01; x += H) pen.line(x, b.y + EDGE, x, b.y + b.h - EDGE, { w: 0.1, color: thin });
};

PAGE_DRAW.penmanship = (pen, box, o, ctx) => {
  let b = o.header ? drawHeader(pen, box, ctx, o.title || '') : box;
  const x0 = b.x + EDGE, x1 = b.x + b.w - EDGE, H = clamp(+o.spacing || 12, 7, 20);
  const base = patColor(ctx, o), faint = patColor(ctx, o, 0.4);
  for (let y = b.y + H; y <= b.y + b.h - EDGE + 0.01; y += H) {
    pen.line(x0, y - H, x1, y - H, { w: (o.lineW || 0.2) * 0.8, color: faint });      // teto
    if (o.dashMid !== false) pen.line(x0, y - H / 2, x1, y - H / 2, { w: 0.14, color: faint, dash: [1, 1.3] });
    pen.line(x0, y, x1, y, { w: Math.max(0.28, (o.lineW || 0.2) * 1.4), color: base }); // linha de base
    if (o.slant) for (let x = x0 + 10; x < x1; x += 22) pen.line(x, y, x - H * 0.28, y - H, { w: 0.1, color: faint });
  }
};

PAGE_DRAW.ledger = (pen, box, o, ctx) => {
  let b = o.header ? drawHeader(pen, box, ctx, o.title || (o.header ? 'Registro' : '')) : box;
  const x0 = b.x, x1 = b.x + b.w, cols = clamp(+o.cols || 3, 1, 5);
  const colW = Math.min(24, b.w * 0.16), descW = b.w - cols * colW;
  const step = clamp(+o.spacing || 8, 5, 12), pc = patColor(ctx, o), strong = patColor(ctx, o, 1.3);
  const labels = String(o.labels || '').split(',').map(s => s.trim()).filter(Boolean);
  let top = b.y;
  if (labels.length || true) {
    pen.text('Descrição', x0 + 1, top, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' });
    for (let c = 0; c < cols; c++) {
      const cx = x0 + descW + c * colW;
      pen.text(labels[c] || (cols > 1 ? 'Valor ' + (c + 1) : 'Valor'), cx + 1, top, { size: 6, font: 'bold', color: ctx.faint, baseline: 'top' });
    }
    top += 5;
    pen.line(x0, top, x1, top, { w: 0.35, color: strong });
  }
  const n = Math.floor((b.y + b.h - top) / step);
  for (let i = 0; i <= n; i++) pen.line(x0, top + i * step, x1, top + i * step, { w: o.lineW, color: pc });
  for (let c = 0; c <= cols; c++) pen.line(x0 + descW + c * colW, top, x0 + descW + c * colW, top + n * step, { w: 0.15, color: patColor(ctx, o, 0.7) });
  pen.line(x0 + descW, top - 5, x0 + descW, top + n * step, { w: 0.25, color: patColor(ctx, o, 0.9) });
};

PAGE_DRAW.isometric = (pen, box, o, ctx) => {
  const s = o.spacing, w = o.lineW, col = patColor(ctx, o, 0.85), x = box.x + EDGE, y = box.y + EDGE, W = box.w - 2 * EDGE, Hh = box.h - 2 * EDGE;
  const run = Hh / Math.tan(Math.PI / 6);
  for (let vx = x; vx <= x + W + 0.01; vx += s) pen.line(vx, y, vx, y + Hh, { w, color: col });
  for (let x0 = x - run; x0 <= x + W + 0.01; x0 += s) {
    pen.line(x0, y + Hh, x0 + run, y, { w, color: col });
    pen.line(x0, y, x0 + run, y + Hh, { w, color: col });
  }
};
PAGE_DRAW.music = (pen, box, o, ctx) => {
  const gap = (box.h - 2 * EDGE) / o.staves, lh = Math.min(2.8, gap * 0.42);
  const x0 = box.x + EDGE, x1 = box.x + box.w - EDGE;
  for (let i = 0; i < o.staves; i++) {
    const y0 = box.y + EDGE + i * gap + (gap - lh) / 2;
    for (let k = 0; k < 5; k++) pen.line(x0, y0 + k * (lh / 4), x1, y0 + k * (lh / 4), { w: 0.18, color: ctx.faint });
  }
};
PAGE_DRAW.handwriting = (pen, box, o, ctx) => {
  const g = o.spacing, x0 = box.x + EDGE, x1 = box.x + box.w - EDGE;
  const base = patColor(ctx, o), mid = patColor(ctx, o, 0.5), top = patColor(ctx, o, 0.4);
  for (let y = box.y + g; y <= box.y + box.h - EDGE + 0.01; y += g) {
    pen.line(x0, y, x1, y, { w: 0.3, color: base });
    pen.line(x0, y - g * 0.5, x1, y - g * 0.5, { w: 0.14, color: mid, dash: [1, 1.4] });
    pen.line(x0, y - g, x1, y - g, { w: 0.12, color: top });
    if (o.slant) for (let x = x0 + 10; x < x1; x += 24) pen.line(x, y, x - g * 0.45, y - g, { w: 0.1, color: top });
  }
};
PAGE_DRAW.cornell = (pen, box, o, ctx) => {
  const cueX = box.x + Math.min(o.cue, box.w * 0.45);
  const sumY = box.y + box.h - Math.min(o.summary, box.h * 0.3);
  pen.line(cueX, box.y, cueX, sumY, { w: 0.3, color: ctx.faint });
  pen.line(box.x, sumY, box.x + box.w, sumY, { w: 0.4, color: ctx.ink });
  pen.text(ctx.L('resumo'), box.x, sumY + 2, { size: 7, font: 'bold', color: ctx.faint, tracking: 0.4, baseline: 'top' });
  fillLines(pen, { x: cueX + 3, y: box.y, w: box.x + box.w - cueX - 3, h: sumY - box.y }, o.spacing, 0.2, ctx.hair);
  fillLines(pen, { x: box.x, y: sumY + 7, w: box.w, h: box.y + box.h - sumY - 9 }, o.spacing, 0.2, ctx.hair);
};
PAGE_DRAW.todo = (pen, box, o, ctx) => {
  const b = o.header ? drawHeader(pen, box, ctx, o.title || 'A fazer') : box;
  const cols = o.split ? 2 : 1, cw = (b.w - (cols - 1) * 8) / cols;
  for (let c = 0; c < cols; c++) {
    const x0 = b.x + c * (cw + 8);
    for (let y = b.y + o.spacing; y <= b.y + b.h + 0.01; y += o.spacing) {
      cbox(pen, x0, y, 3.2, ctx.ink);
      pen.line(x0 + 6, y, x0 + cw, y, { w: 0.18, color: ctx.hair });
    }
  }
};
PAGE_DRAW.split = (pen, box, o, ctx) => {
  const g = o.spacing || 6, pc = patColor(ctx, o);
  const h1 = { x: box.x, y: box.y, w: box.w, h: box.h / 2 - 3 };
  const h2 = { x: box.x, y: box.y + box.h / 2 + 3, w: box.w, h: box.h / 2 - 3 };
  pen.line(box.x, box.y + box.h / 2, box.x + box.w, box.y + box.h / 2, { w: 0.25, color: pc, dash: [2, 2] });
  const sub = (bx, kind) => {
    if (kind === 'dot') fillDots(pen, bx, g, 0.2, pc);
    else if (kind === 'grid') fillGrid(pen, bx, g, 0.15, pc);
    else if (kind === 'lined') fillLines(pen, bx, g, 0.2, pc);
  };
  sub(h1, o.top); sub(h2, o.bottom);
};
PAGE_DRAW.notesDot = (pen, box, o, ctx) => {
  const b = drawHeader(pen, box, ctx, o.title || '');
  const pc = patColor(ctx, o);
  if (o.body === 'dot') fillDots(pen, b, 5, 0.2, pc);
  else if (o.body === 'grid') fillGrid(pen, b, 5, 0.15, pc);
  else if (o.body === 'lined') fillLines(pen, b, 7, 0.2, pc);
};

// wrapMultiline: parágrafos separados por linha em branco; devolve linhas prontas
function proseLines(pen, str, maxW, sizePt) {
  const out = [];
  String(str == null ? '' : str).split('\n').forEach(p => {
    if (!p.trim()) { out.push(''); return; }
    pen.wrapText(p, maxW, sizePt, false).forEach(l => out.push(l));
  });
  return out;
}
PAGE_DRAW.prose = (pen, box, o, ctx) => {
  let y = box.y;
  if (o.title) {
    const sz = heading(pen, String(o.title), box.x, y, box.w, 18, 12, { color: ctx.ink });
    y += sz / PT + 3.5;
    pen.line(box.x, y, box.x + box.w, y, { w: 0.3, color: ctx.hair });
    y += 5.5;
  }
  const body = String(o.body || '');
  if (!body.trim()) { fillLines(pen, { x: box.x, y: y + 1, w: box.w, h: box.y + box.h - y - 2 }, 7.5, 0.14, ctx.hair); return; }
  const size = 10.5, lh = size * 1.42 / PT;
  const align = o.align === 'c' ? 'c' : 'l';
  const ax = align === 'c' ? box.x + box.w / 2 : box.x;
  for (const ln of proseLines(pen, body, box.w, size)) {
    if (y > box.y + box.h - lh * 0.5) break;
    if (ln) pen.text(ln, ax, y, { size, color: ctx.ink, align, baseline: 'top' });
    y += ln ? lh : lh * 0.72;
  }
};

/* capa, divisória e frase: js/covers.js · elementos livres na folha: js/decor.js */

PAGE_DRAW.moodYear = (pen, box, o, ctx) => {
  const span = yearSpan(ctx);
  heading(pen, String(o.title || 'Meu ano em cores') + ' · ' + span.label, box.x, box.y, box.w, 15, 10, { color: ctx.ink });
  const legend = String(o.legend || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
  const top = box.y + 9, botPad = legend.length ? 12 : 2;
  const labelW = 10, gw = box.w - labelW, cw = gw / 31;
  const gh = box.y + box.h - top - botPad, rh = gh / 12;
  for (let d = 1; d <= 31; d++) if (d % 2 === 1) pen.text(String(d), box.x + labelW + (d - 0.5) * cw, top - 3.5, { size: 3.2, color: ctx.faint, align: 'c', baseline: 'top' });
  for (let m = 0; m < 12; m++) {
    const fm = span.month(m), y = top + m * rh, dim = new Date(fm.getFullYear(), fm.getMonth() + 1, 0).getDate();
    pen.text(MONTHS_PT[fm.getMonth()].slice(0, 3), box.x, y + rh / 2, { size: 4.6, color: ctx.ink, baseline: 'middle' });
    for (let d = 0; d < 31; d++) {
      if (d >= dim) continue;
      pen.rect(box.x + labelW + d * cw + 0.15, y + 0.15, cw - 0.3, rh - 0.3, { stroke: ctx.hair, w: 0.1 });
    }
  }
  legend.forEach((lg, i) => {
    const lx = box.x + i * (box.w / legend.length);
    pen.rect(lx, box.y + box.h - 8, 3.5, 3.5, { stroke: ctx.faint, w: 0.25 });
    pen.text(lg, lx + 5, box.y + box.h - 6.2, { size: 5, color: ctx.faint, baseline: 'middle' });
  });
};

PAGE_DRAW.tracker = (pen, box, o, ctx) => {
  const days = clamp(+o.days || 31, 7, 31);
  heading(pen, String(o.title || 'Rastreador'), box.x, box.y, box.w, 14, 9, { color: ctx.ink });
  const names = String(o.entries || '').split('\n').map(s => s.trim()).filter(Boolean);
  const rows = names.length ? Math.max(names.length, 3) : 14;
  const top = box.y + 9, labelW = Math.min(box.w * 0.34, 44);
  const gw = box.w - labelW, cw = gw / days, rowH = (box.y + box.h - top - 4) / rows;
  for (let i = 1; i <= days; i++) pen.text(String(i), box.x + labelW + (i - 0.5) * cw, top, { size: 3.4, color: ctx.faint, align: 'c', baseline: 'top' });
  for (let r = 0; r <= rows; r++) pen.line(box.x, top + 4 + r * rowH, box.x + box.w, top + 4 + r * rowH, { w: 0.13, color: ctx.hair });
  for (let c = 0; c <= days; c++) pen.line(box.x + labelW + c * cw, top + 4, box.x + labelW + c * cw, top + 4 + rows * rowH, { w: 0.1, color: ctx.hair });
  pen.line(box.x + labelW, top, box.x + labelW, top + 4 + rows * rowH, { w: 0.25, color: ctx.faint });
  names.forEach((nm, i) => { if (i < rows) pen.text(nm, box.x + 1, top + 4 + i * rowH + rowH / 2, { size: pen.fitText(nm, labelW - 2, 7, 4.5), color: ctx.ink, baseline: 'middle' }); });
};

PAGE_DRAW.sleepLog = (pen, box, o, ctx) => {
  heading(pen, String(o.title || 'Registro de sono'), box.x, box.y, box.w, 14, 9, { color: ctx.ink });
  const days = clamp(+o.days || 14, 7, 31);
  const from = clamp(+o.from || 18, 12, 23), to = clamp(+o.to || 12, 4, 15) + 24;
  const hrs = to - from;
  const top = box.y + 11, labelW = 16, totW = 9;
  const gx = box.x + labelW, gw = box.w - labelW - totW;
  const cw = gw / hrs, rowH = (box.y + box.h - top - 4) / days;
  for (let h = from; h <= to; h++) {
    const x = gx + (h - from) * cw, on2 = (h % 2 === 0);
    pen.line(x, top + 4, x, top + 4 + days * rowH, { w: on2 ? 0.18 : 0.08, color: on2 ? ctx.faint : ctx.hair });
    if (on2) pen.text(String(((h % 24) + 24) % 24), x, top, { size: 4.6, color: ctx.faint, align: 'c', baseline: 'top' });
  }
  for (let r = 0; r <= days; r++) pen.line(box.x, top + 4 + r * rowH, box.x + box.w - totW, top + 4 + r * rowH, { w: 0.12, color: ctx.hair });
  pen.line(gx, top, gx, top + 4 + days * rowH, { w: 0.25, color: ctx.faint });
  pen.line(box.x + box.w - totW, top, box.x + box.w - totW, top + 4 + days * rowH, { w: 0.2, color: ctx.faint });
  pen.text('h', box.x + box.w - totW / 2, top, { size: 4.6, color: ctx.faint, align: 'c', baseline: 'top' });
  for (let i = 0; i < days; i++) pen.line(box.x + 1, top + 4 + i * rowH + rowH - 1.2, gx - 1.5, top + 4 + i * rowH + rowH - 1.2, { w: 0.12, color: ctx.hair });
};

PAGE_DRAW.finance = (pen, box, o, ctx) => {
  const kind = o.kind || 'goal';
  const title = o.title || (kind === 'net' ? 'Patrimônio líquido' : kind === 'debt' ? 'Quitar dívida' : 'Meta de poupança');
  heading(pen, String(title), box.x, box.y, box.w, 15, 10, { color: ctx.ink });
  let y = box.y + 10;
  if (kind === 'net') {
    pen.line(box.x, y, box.x + box.w, y, { w: 0.4, color: ctx.ink }); y += 3;
    const colW = (box.w - 8) / 2, rows = clamp(+o.rows || 16, 6, 30);
    const rh = Math.min(8, (box.y + box.h - y - 18) / rows);
    ['Ativos — o que eu tenho', 'Passivos — o que eu devo'].forEach((lab, c) => {
      const x0 = box.x + c * (colW + 8);
      pen.text(lab, x0 + 1, y, { size: 7, font: 'bold', color: ctx.accent, baseline: 'top' });
      pen.line(x0 + colW * 0.6, y + 6, x0 + colW * 0.6, y + 6 + rows * rh, { w: 0.15, color: ctx.hair });
      for (let i = 0; i <= rows; i++) pen.line(x0, y + 6 + i * rh, x0 + colW, y + 6 + i * rh, { w: 0.13, color: ctx.hair });
      pen.text('Total', x0 + 1, y + 6 + rows * rh + 2, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' });
      pen.line(x0 + colW * 0.6, y + 6 + rows * rh + 8, x0 + colW, y + 6 + rows * rh + 8, { w: 0.3, color: ctx.ink });
    });
    const by = box.y + box.h - 7;
    pen.text('Patrimônio líquido  (ativos − passivos)', box.x, by - 3.5, { size: 8, font: 'bold', color: ctx.ink, baseline: 'top' });
    pen.line(box.x + box.w * 0.6, by + 3.5, box.x + box.w, by + 3.5, { w: 0.4, color: ctx.accent });
    return;
  }
  if (o.target) pen.text((kind === 'debt' ? 'Dívida: ' : 'Meta: ') + String(o.target), box.x, y, { size: 9, color: ctx.faint, baseline: 'top' });
  y += 7;
  const segs = 20, barH = Math.min(14, box.h * 0.09), barW = box.w;
  for (let i = 0; i < segs; i++) pen.rect(box.x + i * (barW / segs), y, barW / segs - 0.4, barH, { stroke: ctx.faint, w: 0.2 });
  pen.text(kind === 'debt' ? '100%' : '0%', box.x, y + barH + 1.5, { size: 5, color: ctx.faint, baseline: 'top' });
  pen.text(kind === 'debt' ? '0%' : '100%', box.x + barW, y + barH + 1.5, { size: 5, color: ctx.faint, align: 'r', baseline: 'top' });
  y += barH + 9;
  const cols = [['Data', 0.16], ['Descrição', 0.4], ['Valor', 0.2], [kind === 'debt' ? 'Restante' : 'Acumulado', 0.24]];
  const rows = clamp(+o.rows || 16, 8, 30);
  const rh = (box.y + box.h - y - 2) / rows;
  let x = box.x;
  cols.forEach(([lab, f]) => { pen.text(lab, x + 1, y, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' }); pen.line(x, y + 5, x, y + 5 + rows * rh, { w: 0.1, color: ctx.hair }); x += box.w * f; });
  pen.line(box.x + box.w, y + 5, box.x + box.w, y + 5 + rows * rh, { w: 0.1, color: ctx.hair });
  for (let i = 0; i <= rows; i++) pen.line(box.x, y + 5 + i * rh, box.x + box.w, y + 5 + i * rh, { w: 0.13, color: ctx.hair });
};

PAGE_DRAW.index = (pen, box, o, ctx) => {
  const b = drawHeader(pen, box, ctx, ctx.L('indice'), false);
  const cols = +o.cols || 1, gw = (b.w - (cols - 1) * 8) / cols;
  const step = (b.h - 2) / o.rows;
  // entradas preenchidas: "assunto | 12"  (o " | pág." é opcional)
  const rowsData = String(o.entries || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)\s*\|\s*(\S+)\s*$/);
    return m ? { t: m[1], p: m[2] } : { t: s, p: '' };
  });
  const pageBase = (ctx.indexInSection || 0) * cols * o.rows;   // entradas fluem entre as páginas do índice
  for (let c = 0; c < cols; c++) {
    const x0 = b.x + c * (gw + 8);
    pen.text('#', x0 + 1, b.y - 2, { size: 6, color: ctx.faint, baseline: 'top' });
    pen.text('assunto', x0 + 12, b.y - 2, { size: 6, color: ctx.faint, baseline: 'top' });
    pen.line(x0 + 10, b.y, x0 + 10, b.y + o.rows * step, { w: 0.2, color: ctx.hair });
    for (let i = 0; i <= o.rows; i++) pen.line(x0, b.y + i * step, x0 + gw, b.y + i * step, { w: 0.15, color: ctx.hair });
    for (let i = 0; i < o.rows; i++) {
      const d = rowsData[pageBase + c * o.rows + i]; if (!d) continue;
      const yc = b.y + i * step + step / 2;
      if (d.p) pen.text(d.p, x0 + 8, yc, { size: 6.5, color: ctx.faint, align: 'r', baseline: 'middle' });
      const tSize = pen.fitText(d.t, gw - 15, 7.5, 5.5);
      pen.text(d.t, x0 + 12, yc, { size: tSize, color: ctx.ink, baseline: 'middle' });
    }
  }
};

// período de 12 meses do documento: começa no mês da data inicial (ano letivo
// ago–jul, fiscal etc.) ou em janeiro. Título "2027" ou "ago 2026 – jul 2027". (A6)
/* páginas com data (ano, mês, semana, dia…): js/pages-dates.js */

/* ---- página personalizada (construtor por blocos, vendor/core/blocks.js) ---- */
PAGE_DRAW.custom = (pen, box, o, ctx) => {
  const layout = (o.layout && Array.isArray(o.layout.blocks)) ? o.layout : null;
  if (!layout || !layout.blocks.length) {
    pen.text('Página personalizada — abra "Editar layout"', box.x + box.w / 2, box.y + box.h / 2,
      { size: 8, color: ctx.hair, align: 'c', baseline: 'middle', family: ctx.hfam });
    return;
  }
  if (typeof EPBlocks !== 'undefined') EPBlocks.drawLayout(pen, box, layout, ctx);
};

function pageTypeHasDate(type) {
  return !!(PAGE_TYPES[type] && (PAGE_TYPES[type].dated ||
    (type === 'custom')));
}

/* ---------- semana em duas páginas ---------- */
PAGE_DRAW.weekSpread = (pen, box, o, ctx) => {
  const ws = o.weekStart || ctx.weekStart, days = weekDates(ctx.date || new Date(ctx.S.year, 0, 1), ws);
  const left = ctx.half !== 'R';
  const idxs = left ? [0, 1, 2] : [3, 4, 5, 6];
  const label = left ? `${MONTHS_PT[days[0].getMonth()]} ${days[0].getFullYear()}` : `Semana ${isoWeek(days[0])} · ${fmtDMY(days[0])} – ${fmtDMY(days[6])}`;
  heading(pen, label, box.x, box.y, box.w, 11, 8, { color: ctx.ink });
  const top = box.y + 9;
  const slots = left ? 3 : 4 + (o.notes !== false ? 0 : 0);
  const rows = left ? 3 : (o.notes !== false ? 4 : 4);
  const cols = !left && o.notes !== false ? 2 : 1;
  const markFn = typeof ctx.markOn === 'function' ? ctx.markOn : null;
  if (cols === 1) {
    const h = (box.y + box.h - top) / rows;
    idxs.forEach((di, i) => dayBlock(pen, { x: box.x, y: top + i * h, w: box.w, h: h - 2 }, days[di], o, ctx, markFn));
  } else {
    // direita: qui/sex/sáb/dom numa grade 2×2 + faixa de notas embaixo
    const notesH = (box.y + box.h - top) * 0.22, gh = box.y + box.h - top - notesH - 3;
    const cw = (box.w - 3) / 2, h = gh / 2;
    idxs.forEach((di, i) => dayBlock(pen, { x: box.x + (i % 2) * (cw + 3), y: top + Math.floor(i / 2) * h, w: cw, h: h - 2 }, days[di], o, ctx, markFn));
    const ny = top + gh + 3;
    pen.text(ctx.L('notas'), box.x, ny, { size: 6, font: 'bold', color: ctx.faint, baseline: 'top', tracking: 0.4 });
    fillLines(pen, { x: box.x, y: ny + 3, w: box.w, h: notesH - 3 }, 6, 0.14, ctx.hair);
  }
  void slots;
};
function dayBlock(pen, b, dt, o, ctx, markFn) {
  const col = wkCol(ctx, dt.getDay());
  pen.line(b.x, b.y + 6, b.x + b.w, b.y + 6, { w: 0.35, color: ctx.ink });
  pen.text(DOW_PT[dt.getDay()].toUpperCase(), b.x, b.y + 3, { size: 6.5, font: 'bold', color: col, baseline: 'middle', tracking: 0.4 });
  pen.text(String(dt.getDate()), b.x + b.w, b.y + 3, { size: 10, font: 'bold', color: ctx.faint, align: 'r', baseline: 'middle' });
  const nm = markFn && markFn(dt);
  if (nm) pen.text(clipLine(pen, nm, b.w * 0.6, 4.2), b.x + b.w - 8, b.y + 3, { size: 4.2, color: ctx.accent, align: 'r', baseline: 'middle' });
  if (o.lines !== false) fillLines(pen, { x: b.x, y: b.y + 6, w: b.w, h: b.h - 6 }, 6, 0.14, ctx.hair);
}

/* ---------- dados pessoais ---------- */
PAGE_DRAW.personal = (pen, box, o, ctx) => {
  heading(pen, String(o.title || 'Este caderno pertence a'), box.x, box.y, box.w, 16, 10, { color: ctx.ink });
  pen.line(box.x, box.y + 10, box.x + 24, box.y + 10, { w: 0.6, color: ctx.accent });
  const fields = String(o.fields || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 16);
  const top = box.y + 20, step = Math.min(16, (box.y + box.h - top) / Math.max(1, fields.length));
  fields.forEach((f, i) => {
    const y = top + i * step;
    pen.text(f.toUpperCase(), box.x, y, { size: 6, font: 'bold', color: ctx.faint, baseline: 'top', tracking: 0.5 });
    pen.line(box.x, y + step - 3, box.x + box.w, y + step - 3, { w: 0.25, color: ctx.hair });
  });
  if (ctx.varOwner && fields.length) pen.text(ctx.varOwner, box.x, top + step - 5, { size: 11, font: 'it', family: ctx.hfam, color: ctx.ink, baseline: 'bottom' });
};

/* ---------- sumário automático ---------- */
PAGE_DRAW.toc = (pen, box, o, ctx) => {
  heading(pen, String(o.title || 'Sumário'), box.x, box.y, box.w, 16, 10, { color: ctx.ink });
  const list = typeof ctx.toc === 'function' ? ctx.toc() : [];
  const top = box.y + 14, step = clamp((box.y + box.h - top) / Math.max(12, list.length), 5, 9);
  const size = clamp(step * 1.25, 6.5, 10);
  list.slice(0, Math.floor((box.y + box.h - top) / step)).forEach((e, i) => {
    const y = top + i * step + step / 2;
    const num = e.page == null ? '' : String(e.page);
    const nw = pen.textWidth(num, size);
    const t = clipLine(pen, e.title, box.w - nw - 12, size);
    pen.text(t, box.x, y, { size, color: ctx.ink, baseline: 'middle' });
    const tw = pen.textWidth(t, size);
    for (let x = box.x + tw + 2; x < box.x + box.w - nw - 2; x += 1.6) pen.dot(x, y + size * 0.12, 0.13, { fill: ctx.faint });
    if (num) pen.text(num, box.x + box.w, y, { size, font: 'bold', color: ctx.ink, align: 'r', baseline: 'middle' });
  });
};

/* ---------- folha de calibração (núcleo) ---------- */
PAGE_DRAW.calibration = (pen, box, o, ctx) => { drawCalibration(pen, ctx.pageW || box.w, ctx.pageH || box.h, { title: 'Folha de calibração' }); };

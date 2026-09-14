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
// título que sempre cabe: encolhe até min, depois trunca.
function heading(pen, str, x, y, maxW, startPt, minPt, o) {
  const fam = (o && o.family) || HEAD_FAM;
  const size = pen.fitText(str, maxW, startPt, minPt || startPt * 0.6, true, fam);
  let s = String(str), lim = maxW * 0.98;
  if (pen.textWidth(s, size, true, fam) > lim) {
    while (s.length > 1 && pen.textWidth(s + '…', size, true, fam) > lim) s = s.slice(0, -1);
    s = s.replace(/[ ·–-]+$/, '') + '…';
  }
  pen.text(s, x, y, Object.assign({ size, font: 'bold', baseline: 'top', family: fam }, o));
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

/* ---------------- planejador ---------------- */

function monogramOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
/* ---------- elementos editáveis na folha (EPCanvasEdit) ----------
   o.el[key] = { dx, dy (mm), s (escala), color, fam, bold, hide }
   ctx.hits (só quando a tela pede) recebe a caixa de cada elemento desenhado. */
function elFx(o, key) {
  const e = (o && o.el && o.el[key]) || {};
  const fams = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  return { dx: +e.dx || 0, dy: +e.dy || 0, s: clamp(+e.s || 1, 0.25, 5), color: HEX.test(e.color || '') ? e.color : null,
    fam: e.fam && fams[e.fam] ? e.fam : null, bold: e.bold == null ? null : !!e.bold, hide: !!e.hide };
}
function elHit(ctx, key, label, kind, x, y, w, h) { if (ctx && ctx.hits) ctx.hits.push({ key, label, kind, x, y, w, h }); }
// textos e imagens livres adicionados pela pessoa (capa, divisória, frase)
function drawExtras(pen, o, ctx) {
  const list = Array.isArray(o.extras) ? o.extras : [];
  const PW = ctx.pageW || 148, PH = ctx.pageH || 210;
  list.forEach((x, i) => {
    const key = 'x:' + x.id, f = elFx(o, key);
    if (f.hide) return;
    const cx = PW / 2 + f.dx, cy = PH / 2 + f.dy;
    if (x.type === 'image') {
      if (!x.src || !pen.image) return;
      const w = 40 * f.s, dim = typeof imageDims === 'function' ? imageDims(x.src) : null;
      const h = dim && dim.w ? w * dim.h / dim.w : w;
      pen.image(x.src, cx - w / 2, cy - h / 2, w, h, { fit: 'meet' });
      elHit(ctx, key, 'Imagem', 'image', cx - w / 2, cy - h / 2, w, h);
      return;
    }
    const str = String(x.text || 'Texto'), size = 14 * f.s, fam = f.fam || ctx.hfam || 'sans';
    const lines = str.split('\n'), lh = size * 1.25 / PT;
    let wmax = 0;
    lines.forEach((l, j) => {
      wmax = Math.max(wmax, pen.textWidth(l, size, !!f.bold, fam));
      pen.text(l, cx, cy - (lines.length - 1) * lh / 2 + j * lh, { size, color: f.color || ctx.ink, align: 'c', baseline: 'middle', family: fam, font: f.bold ? 'bold' : undefined });
    });
    elHit(ctx, key, 'Texto', 'text', cx - wmax / 2, cy - lines.length * lh / 2, wmax, lines.length * lh);
  });
}
PAGE_DRAW.cover = (pen, box, o, ctx) => {
  coverClassic(pen, box, o, ctx);
  drawExtras(pen, o, ctx);
};
function coverClassic(pen, box, o, ctx) {
  const S = ctx.S, paper = S.paperBg;
  const W = box.w, H = box.h, cx = box.x + W / 2;
  const PW = ctx.pageW || (box.x * 2 + W), PH = ctx.pageH || (box.y * 2 + H), bl = ctx.bleed || 0;
  const full = { x: -bl, y: -bl, w: PW + 2 * bl, h: PH + 2 * bl };
  const inset = Math.max(6, Math.min(W, H) * 0.06);
  const style = o.style || 'modern';
  const fam = ctx.hfam || 'sans';
  const heavy = fam !== 'serif';                       // serifada fica elegante em peso normal
  const FT = elFx(o, 'title'), famT = FT.fam || fam, heavyT = FT.bold != null ? FT.bold : famT !== 'serif';
  const dark = style === 'solid';
  const soft = mixHex(ctx.ink, paper, 0.45);
  const accentSoft = mixHex(ctx.accent, paper, 0.86);
  const fg = dark ? paper : (o.accentTitle ? ctx.accent : ctx.ink);
  const fgFaint = dark ? mixHex(paper, ctx.ink, 0.38) : ctx.faint;
  const acc = dark ? mixHex(ctx.accent, paper, 0.3) : ctx.accent;
  const title = String(o.title || 'Meu planner');
  const sub = String(o.subtitle || '').trim();
  const posFrac = o.titlePos === 'top' ? 0.27 : o.titlePos === 'bottom' ? 0.64 : null;

  // texto espaçado (tracking) com centralização correta nas duas canetas
  const spaced = (str, x, y, size, color, align, trk, extra = {}) => {
    str = String(str); if (!str) return;
    const w = pen.textWidth(str, size, extra.font === 'bold', extra.family) + Math.max(0, str.length - 1) * trk;
    const lx = align === 'c' ? x - w / 2 : align === 'r' ? x - w : x;
    pen.text(str, lx, y, { size, color, align: 'l', tracking: trk, baseline: extra.baseline || 'middle', font: extra.font, family: extra.family });
  };
  // bloco do título: maior tamanho com até `maxLines` linhas cabendo em maxW
  const titleFit = (maxW, startPt, minPt, maxLines) => {
    let size = startPt, lines = [title];
    for (let guard = 0; guard < 80; guard++) {
      lines = pen.wrapText(title, maxW, size, heavyT, 0, famT);
      const widest = Math.max(...lines.map(l => pen.textWidth(l, size, heavyT, famT)));
      if ((lines.length <= maxLines && widest <= maxW * (famT === 'sans' ? 0.97 : 0.92)) || size <= minPt) break;
      size -= 1;
    }
    if (lines.length > maxLines) lines = pen.wrapText(title, maxW, size, heavyT, maxLines, famT);
    return { size, lines, lh: size * (famT === 'serif' ? 1.08 : 1.12) / PT };
  };
  const drawTitle = (t, x, yTop, align, color) => {
    if (FT.hide) return yTop + t.lines.length * t.lh;
    // filetes e textos presos ao título acompanham a posição/tamanho dele
    const end = yTop + FT.dy + t.lines.length * t.lh * FT.s - (t.lh * FT.s - t.lh) * t.lines.length / 2;
    const size = t.size * FT.s, lh = t.lh * FT.s, X = x + FT.dx, Y0 = yTop + FT.dy - (lh - t.lh) * t.lines.length / 2;
    let y = Y0 + lh / 2, wmax = 0;
    t.lines.forEach(l => { wmax = Math.max(wmax, pen.textWidth(l, size, heavyT, famT)); pen.text(l, X, y, { size, font: heavyT ? 'bold' : undefined, color: FT.color || color, align, baseline: 'middle', family: famT }); y += lh; });
    elHit(ctx, 'title', 'Título', 'text', align === 'c' ? X - wmax / 2 : align === 'r' ? X - wmax : X, Y0, wmax, t.lines.length * lh);
    return end;
  };
  // subtítulo (texto espaçado em caixa alta)
  const subText = (x, y, size, color, align, trk) => {
    const f = elFx(o, 'subtitle'); if (f.hide || !sub) return;
    const str = sub.toUpperCase(), S = size * f.s, X = x + f.dx, Y = y + f.dy, fm = f.fam || undefined, bd = f.bold ? 'bold' : undefined;
    const w = pen.textWidth(str, S, !!f.bold, fm) + Math.max(0, str.length - 1) * trk * f.s;
    spaced(str, X, Y, S, f.color || color, align, trk * f.s, { font: bd, family: fm });
    elHit(ctx, 'subtitle', 'Subtítulo', 'text', align === 'c' ? X - w / 2 : align === 'r' ? X - w : X, Y - S / PT * 0.62, w, S / PT * 1.24);
  };
  const ownerLine = (x0, y0, align, w0, color, lineCol) => {
    const f = elFx(o, 'owner');
    if (o.showOwner === false || f.hide) return;
    const k = f.s, x = x0 + f.dx, y = y0 + f.dy, w = w0 * k;
    spaced(ctx.L('pertenceA').toUpperCase(), x, y, 7.5 * k, f.color || color, align, 1 * k);
    const nameFam = f.fam || (fam === 'mono' ? 'mono' : 'serif');
    let wName = 0;
    if (o.owner) { wName = pen.textWidth(String(o.owner), 12 * k, false, nameFam); pen.text(String(o.owner), x, y + 6.5 * k, { size: 12 * k, font: f.bold ? 'bold' : 'it', color: f.color || (dark ? paper : ctx.ink), align, baseline: 'top', family: nameFam }); }
    const bw = Math.max(w, wName), bx = align === 'c' ? x - bw / 2 : align === 'r' ? x - bw : x;
    if (!o.owner) pen.line(bx, y + 11 * k, bx + w, y + 11 * k, { w: 0.3, color: lineCol || ctx.hair });
    elHit(ctx, 'owner', 'Nome', 'text', bx, y - 3 * k, bw, 16 * k);
  };

  // ---------- fundo sólido / imagem ----------
  if (dark) pen.rect(full.x, full.y, full.w, full.h, { fill: ctx.ink });
  if (o.bg && pen.image) {
    pen.image(o.bg, full.x, full.y, full.w, full.h, { fit: 'cover' });
    if (o.bgSrc) elHit(ctx, 'bg', 'Imagem de fundo', 'photo', 0, 0, PW, PH);
    const dim = clamp(+o.bgDim || 0, 0, 0.85);
    if (dim > 0.001) pen.rect(full.x, full.y, full.w, full.h, { fill: dark ? ctx.ink : paper, fillOpacity: dim });
  }
  // ---------- logo ----------
  const drawLogo = (defaultY) => {
    if (!(o.logo && pen.image)) return;
    const fl = elFx(o, 'logo'); if (fl.hide) return;
    const scl = clamp(+o.logoScale || 24, 6, 70) / 100;
    const lw = W * scl * fl.s, lh = lw;
    let ly = defaultY - lh - 6;
    if (o.logoPos === 'top') ly = box.y + inset + 3;
    else if (o.logoPos === 'foot') ly = box.y + H - inset - lh - 2;
    else if (o.logoPos === 'below') ly = defaultY + 8;
    const leftAl = ['modern', 'split', 'left'].includes(style);
    const lx = (leftAl ? box.x + inset : cx - lw / 2) + fl.dx, lyy = Math.max(box.y + 2, ly) + fl.dy;
    pen.image(o.logo, lx, lyy, lw, lh, { fit: 'meet' });
    elHit(ctx, 'logo', 'Logo', 'image', lx, lyy, lw, lh);
  };
  const monogram = (y0) => {
    if (!o.monogram || o.logo) return false;
    const mg = monogramOf(o.owner) || monogramOf(o.title); if (!mg) return false;
    const f = elFx(o, 'monogram'); if (f.hide) return true;
    const r = Math.min(12, W * 0.085) * f.s, x = cx + f.dx, y = y0 + f.dy;
    pen.circle(x, y, r, { stroke: f.color || acc, w: 0.45 });
    pen.text(mg, x, y, { size: r * 1.15, color: f.color || fg, align: 'c', baseline: 'middle', family: f.fam || 'serif', font: f.bold ? 'bold' : undefined });
    elHit(ctx, 'monogram', 'Monograma', 'text', x - r, y - r, 2 * r, 2 * r);
    return true;
  };

  // ======================= estilos novos =======================
  if (style === 'modern') {
    const x = box.x + inset, maxW = W - 2 * inset;
    const t = titleFit(maxW, Math.min(58, W * 0.36), 16, 3);
    const top = box.y + H * (posFrac != null ? posFrac : 0.46) - t.lines.length * t.lh / 2;
    subText(x, top - 8, 10, ctx.accent, 'l', 1.8);
    drawLogo(sub ? top - 12 : top);
    const end = drawTitle(t, x, top, 'l', fg);
    pen.rect(x, end + 5, Math.min(22, maxW * 0.2), 0.9, { fill: ctx.accent });
    pen.line(box.x + inset, box.y + inset, box.x + W - inset, box.y + inset, { w: 0.25, color: ctx.hair });
    ownerLine(x, box.y + H - inset - 16, 'l', Math.min(64, maxW * 0.62));
    return;
  }
  if (style === 'solid') {
    const fr = inset * 0.8;
    pen.rect(box.x + fr, box.y + fr, W - 2 * fr, H - 2 * fr, { stroke: mixHex(ctx.accent, ctx.ink, 0.25), w: 0.45 });
    pen.rect(box.x + fr + 1.8, box.y + fr + 1.8, W - 2 * fr - 3.6, H - 2 * fr - 3.6, { stroke: mixHex(ctx.accent, ctx.ink, 0.6), w: 0.25 });
    const maxW = W - 2 * inset - 14;
    const t = titleFit(maxW, Math.min(44, W * 0.27), 14, 3);
    const mid = box.y + H * (posFrac != null ? posFrac : 0.44);
    const top = mid - t.lines.length * t.lh / 2;
    const hasMg = monogram(top - 20);
    drawLogo(hasMg ? top - 34 : top);
    const end = drawTitle(t, cx, top, 'c', fg);
    if (sub) {
      pen.line(cx - 7, end + 5, cx + 7, end + 5, { w: 0.4, color: acc });
      subText(cx, end + 12, 10, acc, 'c', 2.2);
    }
    ownerLine(cx, box.y + H - inset - 20, 'c', Math.min(56, W * 0.46), fgFaint, mixHex(paper, ctx.ink, 0.55));
    return;
  }
  if (style === 'split') {
    const cut = PH * 0.6;
    pen.rect(full.x, full.y, full.w, cut - full.y, { fill: mixHex(ctx.accent, paper, 0.8) });
    pen.rect(full.x, cut - 0.6, full.w, 1.2, { fill: ctx.accent });
    const x = box.x + inset, maxW = W - 2 * inset;
    const t = titleFit(maxW, Math.min(52, W * 0.32), 15, 3);
    const top = cut - 11 - t.lines.length * t.lh;
    subText(x, top - 8, 10, mixHex(ctx.ink, ctx.accent, 0.35), 'l', 1.8);
    drawLogo(box.y + inset + 40);
    drawTitle(t, x, top, 'l', ctx.ink);
    ownerLine(x, cut + (PH - cut) * 0.42, 'l', Math.min(70, maxW * 0.7));
    return;
  }
  if (style === 'year') {
    const big = sub || String(S.year || '');
    const maxW = W - 2 * inset - 4;
    const bigSize = pen.fitText(big, maxW, Math.min(150, W * 0.9), 20, true, 'sans');
    const bigY = box.y + H * 0.36;
    const fy = elFx(o, 'year');
    if (!fy.hide) {
      const bs = bigSize * fy.s, bf = fy.fam || 'sans', bx = cx + fy.dx, by = bigY + fy.dy, bwid = pen.textWidth(big, bs, fy.bold !== false, bf);
      pen.text(big, bx, by, { size: bs, font: fy.bold === false ? undefined : 'bold', color: fy.color || mixHex(ctx.accent, paper, 0.55), align: 'c', baseline: 'middle', family: bf });
      elHit(ctx, 'year', 'Ano', 'text', bx - bwid / 2, by - bs / PT * 0.42, bwid, bs / PT * 0.84);
    }
    const t = titleFit(maxW, Math.min(30, W * 0.2), 12, 2);
    const top = bigY + bigSize * 0.42 / PT + 6;
    const end = drawTitle(t, cx, top, 'c', fg);
    pen.line(cx - 10, end + 5, cx + 10, end + 5, { w: 0.5, color: ctx.accent });
    drawLogo(box.y + inset + 30);
    ownerLine(cx, box.y + H - inset - 18, 'c', Math.min(56, W * 0.45));
    return;
  }
  if (style === 'arch') {
    const aw = Math.min(W * 0.72, 118), ah = Math.min(H * 0.62, aw * 1.55);
    const ax0 = cx - aw / 2, top = box.y + H * 0.14, r = aw / 2, base = top + ah;
    const arch = (off, col, w) => {
      const rr = r - off, x0 = cx - rr, x1 = cx + rr, yc = top + r, yb = base - off;
      pen.line(x0, yc, x0, yb, { w, color: col }); pen.line(x1, yc, x1, yb, { w, color: col });
      pen.line(x0, yb, x1, yb, { w, color: col });
      const N = 48; let px = x0, py = yc;
      for (let i = 1; i <= N; i++) { const a = Math.PI + Math.PI * i / N; const nx = cx + rr * Math.cos(a), ny = yc + rr * Math.sin(a); pen.line(px, py, nx, ny, { w, color: col, cap: 'round' }); px = nx; py = ny; }
    };
    arch(0, ctx.accent, 0.5); arch(2.2, mixHex(ctx.accent, paper, 0.5), 0.25);
    const maxW = aw - 16;
    const t = titleFit(maxW, Math.min(34, aw * 0.26), 12, 3);
    const mid = top + r + (ah - r) * 0.42;
    const tTop = mid - t.lines.length * t.lh / 2;
    if (!monogram(top + r * 0.62)) drawLogo(tTop - 4);
    const end = drawTitle(t, cx, tTop, 'c', fg);
    subText(cx, end + 7, 9.5, ctx.accent, 'c', 2);
    ownerLine(cx, Math.min(box.y + H - inset - 14, base + 12), 'c', Math.min(56, W * 0.45));
    return;
  }

  // ======================= coleção 2026 =======================
  const tint = k => mixHex(ctx.accent, paper, k);
  const inkTint = k => mixHex(ctx.ink, paper, k);
  if (style === 'minimal') {
    const maxW = W * 0.62;
    const t = titleFit(maxW, Math.min(26, W * 0.16), 11, 2);
    const top = box.y + H * (posFrac != null ? posFrac : 0.42) - t.lines.length * t.lh / 2;
    drawLogo(top - 8);
    const end = drawTitle(t, cx, top, 'c', fg);
    pen.line(cx - 4, end + 6, cx + 4, end + 6, { w: 0.35, color: ctx.accent });
    subText(cx, end + 12, 8, ctx.faint, 'c', 2.4);
    ownerLine(cx, box.y + H - inset - 12, 'c', Math.min(44, W * 0.34));
    return;
  }
  if (style === 'botanical') {
    // ramos de linha fina nos cantos (desenhados com polilinhas — vetor puro)
    const leaf = (x, y, ang, L, Wd, col) => {
      const pts = [];
      for (let i = 0; i <= 20; i++) { const u = i / 20, t2 = u * Math.PI * 2; const px = Math.cos(t2) * L / 2 + L / 2, py = Math.sin(t2) * Wd / 2 * Math.sin(Math.acos(Math.cos(t2)) || 0.0001);
        pts.push([x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)]); }
      pen.poly(pts, { fill: col });
    };
    const branch = (x0, y0, dir, len, rot) => {
      const pts = [];
      for (let i = 0; i <= 30; i++) { const u = i / 30, bend = Math.sin(u * Math.PI) * len * 0.12;
        pts.push([x0 + dir * (u * len * Math.cos(rot) - bend * Math.sin(rot)), y0 + u * len * Math.sin(rot) + bend * Math.cos(rot)]); }
      pen.poly(pts, { stroke: mixHex(ctx.accent, ctx.ink, 0.2), w: 0.4, close: false });
      for (let j = 1; j <= 6; j++) {
        const [lx, ly] = pts[j * 4], [nx, ny] = pts[j * 4 + 1];
        const base = Math.atan2(ny - ly, nx - lx), side = j % 2 ? 1 : -1, L = len * (0.2 - j * 0.012);
        leaf(lx, ly, base + side * 0.75, L, L * 0.42, j % 3 === 0 ? tint(0.35) : tint(0.6));
      }
      leaf(pts[30][0], pts[30][1], Math.atan2(pts[30][1] - pts[29][1], pts[30][0] - pts[29][0]), len * 0.16, len * 0.07, tint(0.45));
    };
    branch(box.x + inset, box.y + inset + 4, 1, Math.min(48, W * 0.36), 0.55);
    branch(box.x + W - inset, box.y + H - inset - 30, -1, Math.min(48, W * 0.36), 0.55);
    const maxW = W - 2 * inset - 16;
    const t = titleFit(maxW, Math.min(36, W * 0.22), 13, 3);
    const top = box.y + H * (posFrac != null ? posFrac : 0.44) - t.lines.length * t.lh / 2;
    if (!monogram(top - 18)) drawLogo(top - 4);
    const end = drawTitle(t, cx, top, 'c', fg);
    subText(cx, end + 9, 9.5, ctx.accent, 'c', 2);
    ownerLine(cx, box.y + H - inset - 22, 'c', Math.min(54, W * 0.42));
    return;
  }
  if (style === 'geometric') {
    const R = Math.min(W, H) * 0.34;
    pen.circle(box.x + W - R * 0.55, box.y + R * 0.7, R, { fill: tint(0.72) });
    pen.circle(box.x + W - R * 1.25, box.y + R * 1.35, R * 0.55, { fill: tint(0.45) });
    pen.rect(box.x + W - R * 0.9, box.y + R * 1.55, R * 0.9, R * 0.9, { stroke: ctx.ink, w: 0.5 });
    const x = box.x + inset, maxW = W - 2 * inset;
    const t = titleFit(maxW, Math.min(46, W * 0.3), 15, 3);
    const top = box.y + H * (posFrac != null ? posFrac : 0.62) - t.lines.length * t.lh / 2;
    subText(x, top - 8, 9.5, ctx.accent, 'l', 1.8);
    drawLogo(box.y + inset + 30);
    const end = drawTitle(t, x, top, 'l', fg);
    pen.rect(x, end + 5, 14, 1.4, { fill: ctx.accent });
    ownerLine(x, box.y + H - inset - 16, 'l', Math.min(60, maxW * 0.6));
    return;
  }
  if (style === 'stripes') {
    const sw = Math.max(3, W * 0.035), n = 5, x0 = full.x;
    for (let i = 0; i < n; i++) pen.rect(x0 + i * sw * 1.7, full.y, sw, full.h, { fill: tint(0.25 + i * 0.13) });
    const left = x0 + n * sw * 1.7 + inset * 0.8, maxW = box.x + W - inset - left;
    const t = titleFit(maxW, Math.min(40, W * 0.26), 13, 4);
    const top = box.y + H * (posFrac != null ? posFrac : 0.45) - t.lines.length * t.lh / 2;
    subText(left, top - 8, 9.5, ctx.accent, 'l', 1.8);
    drawLogo(box.y + inset + 30);
    drawTitle(t, left, top, 'l', fg);
    ownerLine(left, box.y + H - inset - 16, 'l', Math.min(56, maxW * 0.7));
    return;
  }
  if (style === 'label') {
    const lw = Math.min(W * 0.7, 110), maxW = lw - 16;
    const t = titleFit(maxW, Math.min(28, lw * 0.22), 11, 2);
    const lh = Math.max(40, t.lines.length * t.lh + (sub ? 20 : 12) + 10);
    const lx = cx - lw / 2, ly = box.y + H * (posFrac != null ? posFrac : 0.36) - lh / 2;
    pen.rect(full.x, full.y, full.w, full.h, { fill: tint(0.82) });
    pen.rect(lx, ly, lw, lh, { fill: paper, stroke: ctx.ink, w: 0.5, rx: 3 });
    pen.rect(lx + 2, ly + 2, lw - 4, lh - 4, { stroke: inkTint(0.55), w: 0.25, rx: 2 });
    const top = ly + (lh - t.lines.length * t.lh - (sub ? 10 : 0)) / 2;
    const end = drawTitle(t, cx, top, 'c', ctx.ink);
    subText(cx, end + 6, 8.5, ctx.accent, 'c', 1.8);
    drawLogo(ly - 4);
    ownerLine(cx, ly + lh + 14, 'c', Math.min(56, lw * 0.6));
    return;
  }
  if (style === 'grid') {
    const g = 5;
    for (let x = full.x; x <= full.x + full.w; x += g) pen.line(x, full.y, x, full.y + full.h, { w: 0.12, color: tint(0.8) });
    for (let y = full.y; y <= full.y + full.h; y += g) pen.line(full.x, y, full.x + full.w, y, { w: 0.12, color: tint(0.8) });
    const maxW = W - 2 * inset - 20;
    const t = titleFit(maxW, Math.min(38, W * 0.24), 13, 3);
    const bh = t.lines.length * t.lh + (sub ? 22 : 14), by = box.y + H * (posFrac != null ? posFrac : 0.42) - bh / 2;
    pen.rect(box.x + inset, by, W - 2 * inset, bh, { fill: dark ? ctx.ink : paper, stroke: ctx.ink, w: 0.45 });
    const end = drawTitle(t, cx, by + 7, 'c', fg);
    subText(cx, end + 6, 9, ctx.accent, 'c', 2);
    drawLogo(by - 4);
    ownerLine(cx, box.y + H - inset - 18, 'c', Math.min(56, W * 0.45));
    return;
  }
  if (style === 'monogramBig') {
    const f = elFx(o, 'monogram');
    const mg = monogramOf(o.owner) || monogramOf(o.title) || 'EP';
    if (!f.hide) {
      const size = Math.min(160, W * 0.95) * f.s, mx = cx + f.dx, my = box.y + H * 0.38 + f.dy, mf = f.fam || 'serif';
      const mw = pen.textWidth(mg, size, false, mf);
      pen.text(mg, mx, my, { size, color: f.color || tint(0.55), align: 'c', baseline: 'middle', family: mf, font: f.bold ? 'bold' : undefined });
      elHit(ctx, 'monogram', 'Monograma', 'text', mx - mw / 2, my - size / PT * 0.4, mw, size / PT * 0.8);
    }
    const t = titleFit(W - 2 * inset - 10, Math.min(24, W * 0.15), 11, 2);
    const top = box.y + H * (posFrac != null ? posFrac : 0.66);
    const end = drawTitle(t, cx, top, 'c', fg);
    subText(cx, end + 8, 8.5, ctx.accent, 'c', 2.4);
    drawLogo(box.y + inset + 26);
    ownerLine(cx, box.y + H - inset - 16, 'c', Math.min(50, W * 0.4));
    return;
  }
  if (style === 'photo') {
    // foto (imagem de fundo) com o título num cartão branco embaixo; sem foto, bloco da cor de destaque
    if (!o.bg) pen.rect(full.x, full.y, full.w, full.h * 0.72 - full.y, { fill: tint(0.3) });
    const cardH = Math.max(46, H * 0.26), cardY = box.y + H - inset - cardH;
    pen.rect(box.x + inset, cardY, W - 2 * inset, cardH, { fill: paper });
    const maxW = W - 2 * inset - 16;
    const t = titleFit(maxW, Math.min(32, W * 0.2), 12, 2);
    const top = cardY + 8;
    const end = drawTitle(t, cx, top, 'c', ctx.ink);
    subText(cx, end + 6, 8.5, ctx.accent, 'c', 2);
    drawLogo(box.y + inset + 30);
    ownerLine(cx, cardY + cardH - 16, 'c', Math.min(50, W * 0.4));
    return;
  }
  if (style === 'wave') {
    const base = full.y + full.h * 0.7, ptsA = [], ptsB = [];
    for (let i = 0; i <= 40; i++) { const x = full.x + full.w * i / 40; ptsA.push([x, base + Math.sin(i / 40 * Math.PI * 2) * 6]); ptsB.push([x, base + 10 + Math.sin(i / 40 * Math.PI * 2 + 1.3) * 5]); }
    pen.poly([...ptsA, [full.x + full.w, full.y + full.h], [full.x, full.y + full.h]], { fill: tint(0.7) });
    pen.poly([...ptsB, [full.x + full.w, full.y + full.h], [full.x, full.y + full.h]], { fill: tint(0.35) });
    const maxW = W - 2 * inset - 10;
    const t = titleFit(maxW, Math.min(40, W * 0.26), 13, 3);
    const top = box.y + H * (posFrac != null ? posFrac : 0.36) - t.lines.length * t.lh / 2;
    if (!monogram(top - 18)) drawLogo(top - 4);
    const end = drawTitle(t, cx, top, 'c', fg);
    subText(cx, end + 9, 9.5, ctx.accent, 'c', 2);
    ownerLine(cx, box.y + H * 0.58, 'c', Math.min(54, W * 0.42));
    return;
  }
  if (style === 'sunset') {
    const R = W * 0.42, cyS = box.y + H * 0.66;
    for (let i = 0; i < 4; i++) {
      const r = R - i * R * 0.18, pts = [];
      for (let a = 0; a <= 32; a++) { const t2 = Math.PI + Math.PI * a / 32; pts.push([cx + r * Math.cos(t2), cyS + r * Math.sin(t2)]); }
      pen.poly(pts, { fill: tint(0.25 + i * 0.18) });
    }
    pen.rect(full.x, cyS, full.w, 0.8, { fill: ctx.accent });
    const maxW = W - 2 * inset - 10;
    const t = titleFit(maxW, Math.min(34, W * 0.22), 12, 2);
    const top = cyS + 10;
    const end = drawTitle(t, cx, top, 'c', fg);
    subText(cx, end + 8, 9, ctx.accent, 'c', 2);
    drawLogo(box.y + inset + 26);
    ownerLine(cx, box.y + H - inset - 14, 'c', Math.min(50, W * 0.4));
    return;
  }

  // ======================= estilos clássicos =======================
  if (style === 'border') pen.rect(box.x + inset, box.y + inset, W - 2 * inset, H - 2 * inset, { stroke: soft, w: 0.4 });
  else if (style === 'frameDouble') {
    pen.rect(box.x + inset, box.y + inset, W - 2 * inset, H - 2 * inset, { stroke: ctx.ink, w: 0.5 });
    pen.rect(box.x + inset + 2.5, box.y + inset + 2.5, W - 2 * inset - 5, H - 2 * inset - 5, { stroke: soft, w: 0.3 });
  } else if (style === 'block') pen.rect(box.x + inset, box.y + inset, W - 2 * inset, H - 2 * inset, { fill: accentSoft });
  else if (style === 'corner') {
    const L = Math.min(22, W * 0.16), m = inset;
    [[box.x + m, box.y + m, 1, 1], [box.x + W - m, box.y + m, -1, 1], [box.x + m, box.y + H - m, 1, -1], [box.x + W - m, box.y + H - m, -1, -1]]
      .forEach(([px, py, dx, dy]) => { pen.line(px, py, px + dx * L, py, { w: 0.6, color: ctx.accent }); pen.line(px, py, px, py + dy * L, { w: 0.6, color: ctx.accent }); });
  } else if (style === 'left') pen.rect(box.x + inset, box.y + inset, 2.5, H - 2 * inset, { fill: ctx.accent });

  const editorial = style === 'left';
  const align = editorial ? 'l' : 'c';
  const ax = editorial ? box.x + inset + 8 : cx;
  const maxW = editorial ? W - inset - 8 - inset : W - 2 * inset - 12;
  const t = titleFit(maxW, Math.min(editorial ? 40 : 38, W * (editorial ? 0.26 : 0.24)), 13, 3);
  const blockH = t.lines.length * t.lh;
  const midY = box.y + H * (posFrac != null ? posFrac : (style === 'stack' ? 0.30 : 0.40));
  if (style === 'band') pen.rect(box.x + inset, midY - blockH / 2 - 6, W - 2 * inset, blockH + 12, { fill: accentSoft });
  if (style === 'rule') {
    pen.line(cx - maxW * 0.32, midY - blockH / 2 - 6, cx + maxW * 0.32, midY - blockH / 2 - 6, { w: 0.5, color: ctx.accent });
    pen.line(cx - maxW * 0.32, midY + blockH / 2 + 6, cx + maxW * 0.32, midY + blockH / 2 + 6, { w: 0.5, color: ctx.accent });
  }
  const hasMg = monogram(box.y + H * (o.titlePos === 'top' ? 0.5 : 0.2));
  if (!hasMg) drawLogo(midY - blockH / 2);
  drawTitle(t, ax, midY - blockH / 2, align, fg);
  subText(ax, midY + blockH / 2 + (style === 'band' || style === 'rule' ? 12 : 8), Math.min(11, Math.max(8.5, t.size * 0.34)), ctx.accent, align, 1.8);
  ownerLine(ax, box.y + H * (o.titlePos === 'bottom' ? 0.84 : 0.74), align, editorial ? Math.min(60, maxW * 0.6) : Math.min(56, W * 0.46));
};

PAGE_DRAW.tab = (pen, box, o, ctx) => {
  const W = box.w, H = box.h, cy = box.y + H / 2;
  const bandH = Math.min(46, H * 0.26), style = o.style || 'band';
  const t = String(o.title || 'Seção').toUpperCase();
  if (style === 'block') pen.rect(box.x, box.y, W, H, { fill: mixHex(ctx.accent, ctx.S.paperBg, 0.8) });
  else if (style === 'band') pen.rect(box.x, cy - bandH / 2, W, bandH, { fill: mixHex(ctx.accent, ctx.S.paperBg, 0.86) });
  else if (style === 'sidebar') { pen.rect(box.x, box.y, Math.min(16, W * 0.14), H, { fill: mixHex(ctx.accent, ctx.S.paperBg, 0.75) }); }
  if (style === 'band' || style === 'line') {
    pen.line(box.x, cy - bandH / 2, box.x + W, cy - bandH / 2, { w: 0.5, color: ctx.accent });
    pen.line(box.x, cy + bandH / 2, box.x + W, cy + bandH / 2, { w: 0.5, color: ctx.accent });
  }
  const cxT = style === 'sidebar' ? box.x + Math.min(16, W * 0.14) + (W - Math.min(16, W * 0.14)) / 2 : box.x + W / 2;
  const ft = elFx(o, 'title'), famT = ft.fam || ctx.hfam;
  const size = pen.fitText(t, W - 24, Math.min(30, W * 0.14), 12, true, famT) * ft.s;
  if (!ft.hide) {
    const X = cxT + ft.dx, Y = cy + ft.dy, tw = pen.textWidth(t, size, ft.bold !== false, famT) + Math.max(0, t.length - 1) * 1.5 * ft.s;
    pen.text(t, X, Y, { size, font: ft.bold === false ? undefined : 'bold', color: ft.color || ctx.ink, align: 'c', baseline: 'middle', tracking: 1.5 * ft.s, family: famT });
    elHit(ctx, 'title', 'Título', 'text', X - tw / 2, Y - size / PT * 0.6, tw, size / PT * 1.2);
  }
  drawExtras(pen, o, ctx);
};

PAGE_DRAW.quote = (pen, box, o, ctx) => {
  const cx = box.x + box.w / 2, midY = box.y + box.h * 0.42;
  const txt = String(o.title || o.text || '').trim();
  if (!txt) { pen.text('“  ”', cx, midY, { size: 40, color: ctx.hair, align: 'c', baseline: 'middle' }); return; }
  pen.text('“', cx, box.y + box.h * 0.24, { size: 34, color: mixHex(ctx.accent, ctx.S.paperBg, 0.4), align: 'c', baseline: 'middle', family: ctx.hfam });
  const fq = elFx(o, 'text'), famQ = fq.fam || ctx.hfam;
  const size0 = pen.fitText(txt.length > 60 ? 'x'.repeat(30) : txt, box.w * 0.86, 17, 10, false, famQ);
  const lines = pen.wrapText(txt, box.w * 0.86, size0, !!fq.bold, 8, famQ);
  const size = size0 * fq.s, lh = size * 1.5 / PT;
  let ty = midY - (lines.length - 1) * lh / 2 + fq.dy;
  const qx = cx + fq.dx;
  if (!fq.hide) {
    let wq = 0;
    lines.forEach(l => { wq = Math.max(wq, pen.textWidth(l, size, !!fq.bold, famQ)); pen.text(l, qx, ty, { size, font: fq.bold ? 'bold' : 'it', color: fq.color || ctx.ink, align: 'c', baseline: 'middle', family: famQ }); ty += lh; });
    elHit(ctx, 'text', 'Frase', 'text', qx - wq / 2, ty - lines.length * lh - lh / 2, wq, lines.length * lh);
  } else ty += lines.length * lh;
  if (o.author) {
    const fa = elFx(o, 'author');
    if (!fa.hide) {
      const ax = cx + fa.dx, ay = ty - fq.dy + fa.dy, as = 9 * fa.s, str = '— ' + String(o.author), aw = pen.textWidth(str, as, !!fa.bold, fa.fam || undefined);
      pen.line(ax - 14 * fa.s, ay + 3, ax + 14 * fa.s, ay + 3, { w: 0.4, color: ctx.accent });
      pen.text(str, ax, ay + 9, { size: as, color: fa.color || ctx.faint, align: 'c', baseline: 'top', family: fa.fam || undefined, font: fa.bold ? 'bold' : undefined });
      elHit(ctx, 'author', 'Autor', 'text', ax - aw / 2, ay + 1, aw, as / PT * 1.2 + 8);
    }
  }
  drawExtras(pen, o, ctx);
};

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
function yearSpan(ctx) {
  const st = ctx.yearStart || new Date(ctx.S.year, 0, 1);
  const y0 = st.getFullYear(), m0 = st.getMonth();
  const end = new Date(y0, m0 + 11, 1);
  const label = m0 === 0 ? String(y0) : `${MONTHS_PT[m0].slice(0, 3).toLowerCase()} ${y0} – ${MONTHS_PT[end.getMonth()].slice(0, 3).toLowerCase()} ${end.getFullYear()}`;
  return { y0, m0, label, month: k => new Date(y0, m0 + k, 1) };
}
PAGE_DRAW.yearOverview = (pen, box, o, ctx) => {
  const span = yearSpan(ctx), ws = o.weekStart || ctx.weekStart, dow = orderedDOW(ws);
  let top = box.y;
  if (o.title !== false) { heading(pen, span.label, box.x, box.y, box.w, 26, 14, { color: ctx.ink }); top = box.y + 12; }
  const gx = 4, gy = 5;
  const cw = (box.w - gx * 3) / 4, ch = (box.y + box.h - top - gy * 2) / 3;
  for (let m = 0; m < 12; m++) {
    const bx = box.x + (m % 4) * (cw + gx), by = top + Math.floor(m / 4) * (ch + gy);
    const first = span.month(m), year = first.getFullYear(), mm = first.getMonth();
    pen.text(MONTHS_PT[mm] + (span.m0 && mm === 0 ? ' ' + year : ''), bx, by, { size: 7, font: 'bold', color: ctx.ink, baseline: 'top' });
    const sc = dow.indexOf(first.getDay());
    const dim = new Date(year, mm + 1, 0).getDate();
    const cellW = cw / 7, cellH = (ch - 6) / 7;
    for (let d = 0; d < 7; d++) pen.text(DOW3_PT[dow[d]][0].toUpperCase(), bx + d * cellW + cellW / 2, by + 4.5, { size: 4.2, color: ctx.faint, align: 'c', baseline: 'top' });
    for (let day = 1; day <= dim; day++) {
      const idx = sc + day - 1, r = Math.floor(idx / 7), c = idx % 7;
      pen.text(String(day), bx + c * cellW + cellW / 2, by + 9 + r * cellH, { size: 4.4, color: wkCol(ctx, dow[c]), align: 'c', baseline: 'top' });
    }
  }
};

PAGE_DRAW.yearGoals = (pen, box, o, ctx) => {
  heading(pen, 'Metas de ' + yearSpan(ctx).label, box.x, box.y, box.w, 16, 11, { color: ctx.ink });
  const custom = String(o.entries || '').split('\n').map(s => s.trim()).filter(Boolean);
  const areas = custom.length ? custom.slice(0, 12)
    : ['Saúde & bem-estar', 'Trabalho & finanças', 'Aprendizado', 'Relações', 'Casa & organização', 'Lazer & criatividade'];
  const top = box.y + 10, rowH = (box.y + box.h - top) / areas.length;
  areas.forEach((a, i) => {
    const y = top + i * rowH;
    pen.rect(box.x, y, box.w, rowH - 4, { stroke: ctx.hair, w: 0.25 });
    pen.text(a, box.x + 3, y + 3, { size: 8.5, font: 'bold', color: ctx.accent, baseline: 'top' });
    for (let k = 1; k <= 3; k++) { const ly = y + 10 + k * 6; if (ly > y + rowH - 4) break; cbox(pen, box.x + 4, ly, 2.8, ctx.faint); pen.line(box.x + 9, ly, box.x + box.w - 4, ly, { w: 0.15, color: ctx.hair }); }
  });
};

// semana ISO 8601 da linha: vem do núcleo (EPDates) e é medida na quinta-feira
// da linha — com a semana começando no domingo, o 1º dia da linha é da semana ISO anterior.
function isoWeek(rowStart) { const t = new Date(rowStart); t.setDate(t.getDate() + ((4 - t.getDay() + 7) % 7)); return EPDates.isoWeek(t); }
function calGrid(pen, x, y, w, h, d, ws, ctx, opts = {}) {
  const year = d.getFullYear(), month = d.getMonth(), dow = orderedDOW(ws);
  const first = new Date(year, month, 1), sc = dow.indexOf(first.getDay());
  const dim = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((sc + dim) / 7);
  const headH = opts.small ? 3.5 : 6;
  const wnW = opts.weekNums && !opts.small ? 5 : 0;
  const gx = x + wnW, gw = w - wnW;
  const cw = gw / 7, chh = (h - headH) / rows;
  for (let c = 0; c < 7; c++) pen.text(opts.small ? DOW3_PT[dow[c]][0].toUpperCase() : DOW3_PT[dow[c]].toUpperCase(),
    gx + c * cw + (opts.small ? cw / 2 : 1.5), y + (opts.small ? 0 : 1),
    { size: opts.small ? 4 : 7, font: 'bold', color: wkCol(ctx, dow[c]), align: opts.small ? 'c' : 'l', baseline: 'top' });
  if (!opts.small) {
    for (let r = 0; r <= rows; r++) pen.line(gx, y + headH + r * chh, gx + gw, y + headH + r * chh, { w: 0.25, color: ctx.faint });
    for (let c = 0; c <= 7; c++) pen.line(gx + c * cw, y + headH, gx + c * cw, y + headH + rows * chh, { w: 0.25, color: ctx.faint });
    if (wnW) for (let r = 0; r < rows; r++) {
      const rowStart = new Date(year, month, 1 - sc + r * 7 + 3);   // meio da semana → nº estável
      pen.text(String(isoWeek(rowStart)), x + 0.5, y + headH + r * chh + chh / 2, { size: 4, color: ctx.hair, baseline: 'middle' });
    }
  }
  const ev = opts.events || null;
  for (let day = 1; day <= dim; day++) {
    const idx = sc + day - 1, r = Math.floor(idx / 7), c = idx % 7;
    pen.text(String(day), gx + c * cw + (opts.small ? cw / 2 : 1.8), y + headH + r * chh + (opts.small ? 0.5 : 1.4),
      { size: opts.small ? 3.6 : 8, font: opts.small ? 'reg' : 'bold', color: wkCol(ctx, dow[c]), align: opts.small ? 'c' : 'l', baseline: 'top' });
    if (ev && ev[day]) {
      // palavras longas ("Confraternização") não quebram: reduz a letra até
      // caber na célula e, no limite, corta com reticências — nunca invade o dia vizinho.
      const maxW = cw - 2.6;
      let sz = 4.6, lines = pen.wrapText(ev[day], maxW, sz, false, 2);
      while (sz > 3.2 && lines.some(l => pen.textWidth(l, sz, false) > maxW)) { sz -= 0.2; lines = pen.wrapText(ev[day], maxW, sz, false, 2); }
      lines = lines.map(l => { let t = l; while (t.length > 1 && pen.textWidth(t, sz, false) > maxW) t = t.slice(0, -2) + '…'; return t; });
      lines.forEach((ln, li) => pen.text(ln, gx + c * cw + 1.6, y + headH + r * chh + 6 + li * sz * 0.96, { size: sz, color: ctx.accent, baseline: 'top' }));
    }
  }
}
PAGE_DRAW.monthCalendar = (pen, box, o, ctx) => {
  const d = ctx.date || new Date(ctx.S.year, 0, 1);
  const ws = o.weekStart || ctx.weekStart;
  const tSize = heading(pen, MONTHS_PT[d.getMonth()], box.x, box.y, box.w * (box.w < 100 ? 0.98 : 0.68), 18, 12, { color: ctx.ink });
  if (box.w >= 100) pen.text(String(d.getFullYear()), box.x + box.w, box.y + 1.5, { size: 10, color: ctx.faint, align: 'r', baseline: 'top' });
  else pen.text(String(d.getFullYear()), box.x, box.y + tSize / PT + 1, { size: 7, color: ctx.faint, baseline: 'top' });
  const top = box.y + tSize / PT + (box.w >= 100 ? 4 : 8);
  const bodyH = box.y + box.h - top;
  let calW = box.w, note = null;
  const wide = box.w >= 110;
  if (o.notes === 'side' && wide) { calW = box.w * 0.68; note = { x: box.x + calW + 5, y: top, w: box.w - calW - 5, h: bodyH }; }
  else if (o.notes === 'below') { note = { x: box.x, y: top + bodyH * 0.78, w: box.w, h: bodyH * 0.22 }; }
  const calH = note && o.notes === 'below' ? bodyH * 0.74 : bodyH - (o.mini && wide ? 0 : 0);
  const gridH = o.mini ? calH - 24 : calH;
  const evMap = {};
  // feriados / eventos do documento (opções "Datas especiais")
  if (typeof ctx.markOn === 'function') {
    const dim2 = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (let dd = 1; dd <= dim2; dd++) {
      const nm = ctx.markOn(new Date(d.getFullYear(), d.getMonth(), dd));
      if (nm) evMap[dd] = nm;
    }
  }
  String(o.events || '').split('\n').forEach(ln => {
    // "12 texto"  ou  "12/03 texto" (só nesse mês)
    const m = ln.trim().match(/^(\d{1,2})(?:\/(\d{1,2}))?\s+(.+)$/);
    if (!m) return;
    if (m[2] && +m[2] !== d.getMonth() + 1) return;
    evMap[+m[1]] = m[3].trim();   // evento da própria seção sobrepõe
  });
  calGrid(pen, box.x, top, calW, gridH, d, ws, ctx, { weekNums: !!o.weekNumbers, events: evMap });
  if (o.mini) {
    const my = top + gridH + 5, mw = Math.min(30, calW / 2.4);
    calGrid(pen, box.x, my, mw, 18, new Date(d.getFullYear(), d.getMonth() - 1, 1), ws, ctx, { small: true });
    pen.text(MONTHS_PT[(d.getMonth() + 11) % 12].slice(0, 3), box.x, my - 3.5, { size: 5, color: ctx.faint, baseline: 'top' });
    calGrid(pen, box.x + mw + 8, my, mw, 18, new Date(d.getFullYear(), d.getMonth() + 1, 1), ws, ctx, { small: true });
    pen.text(MONTHS_PT[(d.getMonth() + 1) % 12].slice(0, 3), box.x + mw + 8, my - 3.5, { size: 5, color: ctx.faint, baseline: 'top' });
  }
  if (note) {
    pen.text(ctx.L('notas'), note.x, note.y, { size: 7, font: 'bold', color: ctx.faint, tracking: 0.4, baseline: 'top' });
    fillDots(pen, { x: note.x, y: note.y + 6, w: note.w, h: note.h - 8 }, 5, 0.25, ctx.faint);
  }
};

PAGE_DRAW.monthLog = (pen, box, o, ctx) => {
  const d = ctx.date || new Date(ctx.S.year, 0, 1);
  const y0 = d.getFullYear(), mo = d.getMonth(), dim = new Date(y0, mo + 1, 0).getDate();
  heading(pen, MONTHS_PT[mo] + ' ' + y0, box.x, box.y, box.w, 15, 10, { color: ctx.ink });
  const top = box.y + 9, listW = o.tasks && box.w >= 110 ? box.w * 0.62 : box.w;
  const step = (box.y + box.h - top) / dim;
  pen.line(box.x + 15, top, box.x + 15, top + dim * step, { w: 0.2, color: ctx.faint });
  for (let i = 0; i < dim; i++) {
    const y = top + i * step, dd = new Date(y0, mo, i + 1), col = wkCol(ctx, dd.getDay());
    pen.text(pad2(i + 1), box.x, y + step / 2, { size: 7, color: col, font: 'bold', baseline: 'middle' });
    pen.text(DOW3_PT[dd.getDay()], box.x + 8, y + step / 2, { size: 5.5, color: ctx.faint, baseline: 'middle' });
    pen.line(box.x + 17, y + step, listW - 2, y + step, { w: 0.13, color: ctx.hair });
  }
  if (listW < box.w) {
    const tx = box.x + listW + 4;
    pen.line(box.x + listW, top - 2, box.x + listW, box.y + box.h, { w: 0.2, color: ctx.faint });
    pen.text(ctx.L('tarefasMes'), tx, top - 2, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' });
    for (let y = top + 8; y <= box.y + box.h; y += 8) { cbox(pen, tx, y, 3, ctx.faint); pen.line(tx + 5, y, box.x + box.w, y, { w: 0.15, color: ctx.hair }); }
  }
};

PAGE_DRAW.monthHabit = (pen, box, o, ctx) => {
  const d = ctx.date || new Date(ctx.S.year, 0, 1);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  heading(pen, 'Hábitos · ' + MONTHS_PT[d.getMonth()] + ' ' + d.getFullYear(), box.x, box.y, box.w, 13, 9, { color: ctx.ink });
  const names = String(o.entries || '').split('\n').map(s => s.trim()).filter(Boolean);
  const rows = names.length ? Math.max(names.length, 3) : o.habits;
  const top = box.y + 9, labelW = Math.min(box.w * 0.34, 42);
  const gw = box.w - labelW, cw = gw / dim, rowH = (box.y + box.h - top - 4) / rows;
  for (let i = 1; i <= dim; i++) pen.text(String(i), box.x + labelW + (i - 0.5) * cw, top, { size: 3.6, color: ctx.faint, align: 'c', baseline: 'top' });
  for (let r = 0; r <= rows; r++) pen.line(box.x, top + 4 + r * rowH, box.x + box.w, top + 4 + r * rowH, { w: 0.13, color: ctx.hair });
  names.forEach((nm, i) => { if (i < rows) pen.text(nm, box.x + 1, top + 4 + i * rowH + rowH / 2, { size: Math.min(7, pen.fitText(nm, labelW - 2, 7, 4.5)), color: ctx.ink, baseline: 'middle' }); });
  for (let c = 0; c <= dim; c++) pen.line(box.x + labelW + c * cw, top + 4, box.x + labelW + c * cw, top + 4 + rows * rowH, { w: 0.1, color: ctx.hair });
  pen.line(box.x + labelW, top, box.x + labelW, top + 4 + rows * rowH, { w: 0.25, color: ctx.faint });
};

PAGE_DRAW.weekVertical = (pen, box, o, ctx) => {
  const ws = o.weekStart || ctx.weekStart, days = weekDates(ctx.date || new Date(ctx.S.year, 0, 1), ws);
  heading(pen, 'Semana · ' + fmtDMY(days[0]) + ' – ' + fmtDMY(days[6]), box.x, box.y, box.w, 11, 8, { color: ctx.ink });
  const top = box.y + 8, ch = box.y + box.h - top;
  const split = !!o.weekendSplit;
  // colunas: 5 dias úteis (+1 coluna com sáb/dom empilhados) ou 7 dias.
  // `days[5]`/`days[6]` só são sábado/domingo quando a semana começa na
  // segunda — com weekStart:'sun' eles seriam sexta/sábado (domingo vira
  // days[0], no início do array). Por isso os índices são achados pelo
  // dia da semana de verdade (getDay()), não por posição fixa.
  const weekdayIdx = [], weekendIdx = [];
  days.forEach((dt, i) => ((dt.getDay() === 0 || dt.getDay() === 6) ? weekendIdx : weekdayIdx).push(i));
  weekendIdx.sort((a, b) => (days[a].getDay() === 6 ? 0 : 1) - (days[b].getDay() === 6 ? 0 : 1)); // sábado antes de domingo
  const dayCols = split ? 6 : 7;
  const notesCol = o.notes && box.w >= 120 ? 1 : 0;
  const cw = box.w / (dayCols + notesCol);
  pen.line(box.x, top + 6, box.x + box.w, top + 6, { w: 0.4, color: ctx.ink });
  const fillDay = (x, w, y0, h, dt) => {
    if (h < 6) return;
    if (o.hours) {
      const hs = clamp(+o.hourStart || 7, 0, 20), he = clamp(+o.hourEnd || 21, hs + 2, 24);
      const n = he - hs, rh = h / n;
      for (let k = 0; k <= n; k++) {
        pen.line(x, y0 + k * rh, x + w, y0 + k * rh, { w: 0.12, color: ctx.hair });
        if (k < n) pen.text(pad2(hs + k), x + 0.6, y0 + k * rh + 0.4, { size: 3.6, color: ctx.faint, baseline: 'top' });
      }
    } else if (o.lines !== false) {
      fillLines(pen, { x: x + 1.5, y: y0, w: w - 3, h: h }, 7, 0.14, ctx.hair);
    }
  };
  const markFn = typeof ctx.markOn === 'function' ? ctx.markOn : null;
  const dayHead = (x, w, dt) => {
    const col = wkCol(ctx, dt.getDay());
    pen.text(DOW3_PT[dt.getDay()].toUpperCase(), x + 1.6, top, { size: 6, font: 'bold', color: col, baseline: 'top' });
    pen.text(String(dt.getDate()), x + w - 1.6, top, { size: 7, color: ctx.faint, align: 'r', baseline: 'top' });
    const nm = markFn && markFn(dt);
    if (nm) { const t = clipLine(pen, nm, w - 3, 3.6); pen.text(t, x + 1.6, top + 4.3, { size: 3.6, color: ctx.accent, baseline: 'top' }); }
  };
  for (let i = 0; i < (split ? weekdayIdx.length : 5); i++) {
    const x = box.x + i * cw, dt = split ? days[weekdayIdx[i]] : days[i];
    if (i) pen.line(x, top + 6, x, top + ch, { w: 0.2, color: ctx.faint });
    dayHead(x, cw, dt);
    fillDay(x + 1.5, cw - 3, top + 8, ch - 10, dt);
  }
  if (split) {
    const x = box.x + 5 * cw, halfH = (ch - 8) / 2;
    const dSat = days[weekendIdx[0]], dSun = days[weekendIdx[1]];
    pen.line(x, top + 6, x, top + ch, { w: 0.2, color: ctx.faint });
    pen.line(x, top + 8 + halfH, x + cw, top + 8 + halfH, { w: 0.15, color: ctx.faint });
    dayHead(x, cw, dSat);
    fillDay(x + 1.5, cw - 3, top + 8, halfH - 3, dSat);
    pen.text(DOW3_PT[dSun.getDay()].toUpperCase() + ' ' + dSun.getDate(), x + 1.6, top + 8 + halfH + 1, { size: 5.5, font: 'bold', color: wkCol(ctx, dSun.getDay()), baseline: 'top' });
    fillDay(x + 1.5, cw - 3, top + 8 + halfH + 6, halfH - 6, dSun);
  } else {
    for (let i = 5; i < 7; i++) {
      const x = box.x + i * cw;
      pen.line(x, top + 6, x, top + ch, { w: 0.2, color: ctx.faint });
      dayHead(x, cw, days[i]);
      fillDay(x + 1.5, cw - 3, top + 8, ch - 10, days[i]);
    }
  }
  if (notesCol) {
    const x = box.x + dayCols * cw;
    pen.line(x, top + 6, x, top + ch, { w: 0.2, color: ctx.faint });
    pen.text(ctx.L('notas'), x + 1.6, top, { size: 6, font: 'bold', color: ctx.faint, baseline: 'top' });
    fillDots(pen, { x: x + 1.5, y: top + 8, w: cw - 3, h: ch - 10 }, 5, 0.25, ctx.faint);
  }
};

PAGE_DRAW.weekHorizontal = (pen, box, o, ctx) => {
  const ws = o.weekStart || ctx.weekStart, days = weekDates(ctx.date || new Date(ctx.S.year, 0, 1), ws);
  heading(pen, 'Semana · ' + fmtDMY(days[0]), box.x, box.y, box.w, 11, 8, { color: ctx.ink });
  const top = box.y + 8, rows = o.notes ? 8 : 7, rh = (box.y + box.h - top) / rows;
  for (let i = 0; i < 7; i++) {
    const y = top + i * rh, col = wkCol(ctx, days[i].getDay());
    pen.line(box.x, y, box.x + box.w, y, { w: 0.25, color: ctx.faint });
    pen.text(DOW3_PT[days[i].getDay()].toUpperCase() + ' ' + days[i].getDate(), box.x, y + 1, { size: 7, font: 'bold', color: col, baseline: 'top' });
    fillLines(pen, { x: box.x + 20, y: y + rh * 0.45, w: box.w - 22, h: rh * 0.55 - 1 }, Math.max(4.5, rh / 3), 0.12, ctx.hair);
  }
  if (o.notes) {
    const y = top + 7 * rh;
    pen.line(box.x, y, box.x + box.w, y, { w: 0.4, color: ctx.ink });
    pen.text(ctx.L('metasNotas'), box.x, y + 1, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' });
    fillDots(pen, { x: box.x, y: y + 7, w: box.w, h: box.y + box.h - y - 9 }, 5, 0.25, ctx.faint);
  }
};

function hourColumn(pen, x, y, w, h, o, ctx, showLabels) {
  const step = +o.hourStep || 60;
  const rows = Math.max(1, Math.round((o.hourEnd - o.hourStart) * 60 / step));
  const rh = h / rows;
  for (let i = 0; i <= rows; i++) {
    const yy = y + i * rh, mins = o.hourStart * 60 + i * step, onHour = mins % 60 === 0;
    pen.line(x, yy, x + w, yy, { w: onHour ? 0.22 : 0.1, color: onHour ? ctx.faint : ctx.hair });
    if (showLabels && onHour && i < rows) pen.text(pad2(mins / 60) + 'h', x - 1.5, yy, { size: 5.5, color: ctx.faint, align: 'r', baseline: 'top' });
  }
}
PAGE_DRAW.weekHourly = (pen, box, o, ctx) => {
  const ws = o.weekStart || ctx.weekStart, days = weekDates(ctx.date || new Date(ctx.S.year, 0, 1), ws);
  heading(pen, 'Semana · ' + fmtDMY(days[0]), box.x, box.y, box.w, 11, 8, { color: ctx.ink });
  const top = box.y + 9, labelW = 9, gw = box.w - labelW, cw = gw / 7, gy = top + 5;
  for (let i = 0; i < 7; i++) {
    const x = box.x + labelW + i * cw, col = wkCol(ctx, days[i].getDay());
    pen.text(DOW3_PT[days[i].getDay()].toUpperCase() + ' ' + days[i].getDate(), x + cw / 2, top, { size: 5.5, font: 'bold', color: col, align: 'c', baseline: 'top' });
    pen.line(x, gy, x, box.y + box.h, { w: 0.14, color: ctx.hair });
    hourColumn(pen, x, gy, cw, box.y + box.h - gy, o, ctx, i === 0 ? false : false);
  }
  hourColumn(pen, box.x + labelW, gy, gw, box.y + box.h - gy, o, ctx, true);
  pen.line(box.x + labelW, gy, box.x + labelW, box.y + box.h, { w: 0.25, color: ctx.faint });
};

PAGE_DRAW.daySchedule = (pen, box, o, ctx) => {
  const d = ctx.date || new Date(ctx.S.year, 0, 1);
  const wide = box.w >= 100;
  heading(pen, DOW_PT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_PT[d.getMonth()].toLowerCase() + (wide ? '' : ' ' + pad2(d.getMonth() + 1) + '/' + d.getFullYear()), box.x, box.y, box.w * (wide ? 0.72 : 0.98), 13, 8, { color: ctx.ink });
  if (wide) pen.text(fmtDMY(d), box.x + box.w, box.y + 1.5, { size: 9, color: ctx.faint, align: 'r', baseline: 'top' });
  const dmark = typeof ctx.markOn === 'function' ? ctx.markOn(d) : null;
  if (dmark) pen.text(clipLine(pen, dmark, box.w, 6), box.x, box.y + 7, { size: 6, color: ctx.accent, baseline: 'top' });
  const top = box.y + (dmark ? 12.5 : 9), side = o.side && box.w >= 115;
  const schedW = side ? box.w * 0.6 : box.w;
  pen.rect(box.x + 9, top, schedW - 9, box.y + box.h - top, { stroke: ctx.faint, w: 0.25 });
  hourColumn(pen, box.x + 9, top, schedW - 9, box.y + box.h - top, o, ctx, true);
  if (side) {
    const sx = box.x + schedW + 5, sw = box.w - schedW - 5;
    let y = top;
    pen.text(ctx.L('prioridades'), sx, y, { size: 6.5, font: 'bold', color: ctx.accent, baseline: 'top' }); y += 6;
    for (let k = 0; k < 3; k++) { cbox(pen, sx, y + 4, 3.4, ctx.ink); pen.line(sx + 6, y + 4, sx + sw, y + 4, { w: 0.18, color: ctx.hair }); y += 8; }
    y += 4; pen.text(ctx.L('tarefas'), sx, y, { size: 6.5, font: 'bold', color: ctx.accent, baseline: 'top' }); y += 6;
    const tEnd = top + (box.y + box.h - top) * 0.68;
    for (; y < tEnd; y += 7) { cbox(pen, sx, y, 3, ctx.faint); pen.line(sx + 5, y, sx + sw, y, { w: 0.14, color: ctx.hair }); }
    y += 2; pen.text(ctx.L('notas'), sx, y, { size: 6.5, font: 'bold', color: ctx.accent, baseline: 'top' }); y += 5;
    fillLines(pen, { x: sx, y: y, w: sw, h: box.y + box.h - y - 1 }, 7, 0.14, ctx.hair);
    pen.line(box.x + schedW, top, box.x + schedW, box.y + box.h, { w: 0.2, color: ctx.faint });
  }
};

PAGE_DRAW.daySimple = (pen, box, o, ctx) => {
  const d = ctx.date || new Date(ctx.S.year, 0, 1);
  const wide = box.w >= 95;
  heading(pen, DOW_PT[d.getDay()] + (wide ? '' : ' ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1)), box.x, box.y, box.w * (wide ? 0.62 : 0.98), 16, 10, { color: ctx.ink });
  if (wide) pen.text(fmtDMY(d), box.x + box.w, box.y + 2, { size: 10, color: ctx.faint, align: 'r', baseline: 'top' });
  pen.line(box.x, box.y + 9, box.x + box.w, box.y + 9, { w: 0.4, color: ctx.ink });
  const dmark = typeof ctx.markOn === 'function' ? ctx.markOn(d) : null;
  const bottom = box.y + box.h;
  let y = box.y + 14;
  if (dmark) { pen.text(clipLine(pen, dmark, box.w, 6.5), box.x, y, { size: 6.5, color: ctx.accent, baseline: 'top' }); y += 6; }
  pen.text(ctx.L('principais'), box.x, y, { size: 7.5, font: 'bold', color: ctx.accent, baseline: 'top' }); y += 6;
  for (let k = 0; k < 3; k++) { cbox(pen, box.x, y + 5, 4, ctx.ink); pen.line(box.x + 7, y + 5, box.x + box.w, y + 5, { w: 0.2, color: ctx.hair }); y += 10; }
  y += 3;
  pen.text(ctx.L('tarefas'), box.x, y, { size: 7.5, font: 'bold', color: ctx.accent, baseline: 'top' }); y += 5;
  const tEnd = bottom - (o.gratitude ? 22 : 8) - (o.water ? 8 : 0);
  for (; y < tEnd; y += 7) { cbox(pen, box.x, y + 3, 3, ctx.faint); pen.line(box.x + 5, y + 3, box.x + box.w, y + 3, { w: 0.14, color: ctx.hair }); }
  if (o.water) { const wy = tEnd + 5; pen.text(ctx.L('agua'), box.x, wy - 1.5, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' }); for (let k = 0; k < 8; k++) pen.circle(box.x + 16 + k * 7, wy, 2.2, { stroke: ctx.faint, w: 0.25 }); }
  if (o.gratitude) { const gy = bottom - 8; pen.text(ctx.L('gratidao'), box.x, gy - 4, { size: 6.5, font: 'bold', color: ctx.accent, baseline: 'top' }); pen.line(box.x + 22, gy, box.x + box.w, gy, { w: 0.2, color: ctx.hair }); }
};

PAGE_DRAW.day2 = (pen, box, o, ctx) => {
  const halves = [{ y: box.y, d: ctx.date }, { y: box.y + box.h / 2 + 3, d: ctx.date2 }];
  pen.line(box.x, box.y + box.h / 2, box.x + box.w, box.y + box.h / 2, { w: 0.25, color: ctx.faint, dash: [2, 2] });
  halves.forEach(({ y, d }) => {
    if (!d) return;
    pen.text(DOW_PT[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1), box.x, y, { size: 10, font: 'bold', color: ctx.ink, baseline: 'top' });
    pen.line(box.x, y + 7, box.x + box.w, y + 7, { w: 0.35, color: ctx.ink });
    fillLines(pen, { x: box.x, y: y + 13, w: box.w, h: box.h / 2 - 17 }, 7, 0.14, ctx.hair);
  });
};

PAGE_DRAW.mealPlan = (pen, box, o, ctx) => {
  const ws = o.weekStart || ctx.weekStart, days = weekDates(ctx.date || new Date(ctx.S.year, 0, 1), ws);
  heading(pen, 'Refeições · ' + fmtDMY(days[0]), box.x, box.y, box.w, 11, 8, { color: ctx.ink });
  const top = box.y + 8, planW = o.shopping && box.w >= 120 ? box.w * 0.64 : box.w;
  const labelW = 15, colW = (planW - labelW) / 3, rowH = (box.y + box.h - top - 5) / 7;
  [ctx.L('cafe'), ctx.L('almoco'), ctx.L('jantar')].forEach((mm, i) => pen.text(mm, box.x + labelW + i * colW + colW / 2, top, { size: 6.5, font: 'bold', color: ctx.accent, align: 'c', baseline: 'top' }));
  for (let i = 0; i < 7; i++) {
    const y = top + 5 + i * rowH;
    pen.text(DOW3_PT[days[i].getDay()].toUpperCase(), box.x, y + rowH / 2, { size: 6, font: 'bold', color: ctx.ink, baseline: 'middle' });
    pen.line(box.x, y, box.x + planW, y, { w: 0.14, color: ctx.hair });
  }
  for (let c = 0; c <= 3; c++) pen.line(box.x + labelW + c * colW, top + 5, box.x + labelW + c * colW, top + 5 + 7 * rowH, { w: 0.1, color: ctx.hair });
  if (planW < box.w) {
    const sx = box.x + planW + 5;
    pen.line(box.x + planW, top, box.x + planW, box.y + box.h, { w: 0.2, color: ctx.faint });
    pen.text(ctx.L('compras'), sx, top, { size: 6.5, font: 'bold', color: ctx.accent, baseline: 'top' });
    for (let y = top + 8; y < box.y + box.h; y += 7) { cbox(pen, sx, y, 2.8, ctx.faint); pen.line(sx + 5, y, box.x + box.w, y, { w: 0.14, color: ctx.hair }); }
  }
};

PAGE_DRAW.budget = (pen, box, o, ctx) => {
  const b = drawHeader(pen, box, ctx, 'Gastos');
  const cols = [['Data', 0.14], ['Descrição', 0.44], ['Categoria', 0.24], ['Valor', 0.18]];
  const top = b.y + 4, step = (b.h - (o.summary ? 22 : 2) - 4) / o.rows;
  let x = b.x;
  cols.forEach(([lab, f]) => { pen.text(lab, x + 1, b.y, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' }); pen.line(x, top, x, top + o.rows * step, { w: 0.1, color: ctx.hair }); x += b.w * f; });
  pen.line(b.x + b.w, top, b.x + b.w, top + o.rows * step, { w: 0.1, color: ctx.hair });
  for (let i = 0; i <= o.rows; i++) pen.line(b.x, top + i * step, b.x + b.w, top + i * step, { w: 0.13, color: ctx.hair });
  if (o.summary) {
    const sy = top + o.rows * step + 5;
    pen.rect(b.x, sy, b.w, 15, { stroke: ctx.faint, w: 0.25 });
    ['Entradas', 'Saídas', 'Saldo'].forEach((lab, i) => {
      const cx = b.x + (i + 0.5) * b.w / 3;
      pen.text(lab, cx, sy + 3, { size: 6.5, font: 'bold', color: ctx.accent, align: 'c', baseline: 'top' });
      pen.line(cx - b.w / 8, sy + 11, cx + b.w / 8, sy + 11, { w: 0.2, color: ctx.hair });
      if (i) pen.line(b.x + i * b.w / 3, sy, b.x + i * b.w / 3, sy + 15, { w: 0.12, color: ctx.hair });
    });
  }
};

PAGE_DRAW.project = (pen, box, o, ctx) => {
  heading(pen, 'Projeto', box.x, box.y, box.w, 15, 10, { color: ctx.ink });
  pen.line(box.x, box.y + 8, box.x + box.w, box.y + 8, { w: 0.4, color: ctx.ink });
  const blocks = [['Objetivo', 0.12], ['Por quê / resultado', 0.12], ['Marcos e prazos', 0.24], ['Tarefas', 0.34], ['Recursos & riscos', 0.18]];
  const avail = box.y + box.h - (box.y + 12);
  let y = box.y + 12;
  blocks.forEach(([lab, frac]) => {
    const h = avail * frac;
    pen.text(lab.toUpperCase(), box.x, y, { size: 7, font: 'bold', color: ctx.accent, baseline: 'top' });
    if (lab === 'Tarefas') for (let ty = y + 8; ty < y + h - 1; ty += 7) { cbox(pen, box.x, ty, 3, ctx.faint); pen.line(box.x + 5, ty, box.x + box.w, ty, { w: 0.14, color: ctx.hair }); }
    else fillLines(pen, { x: box.x, y: y + 5, w: box.w, h: h - 7 }, 6.5, 0.14, ctx.hair);
    y += h;
  });
};

PAGE_DRAW.review = (pen, box, o, ctx) => {
  const t = { week: 'Revisão da semana', month: 'Revisão do mês', year: 'Revisão do ano' }[o.period || 'week'];
  heading(pen, t, box.x, box.y, box.w, 14, 10, { color: ctx.ink });
  pen.line(box.x, box.y + 8, box.x + box.w, box.y + 8, { w: 0.4, color: ctx.ink });
  const prompts = ['O que foi bem?', 'O que não foi bem?', 'O que aprendi?', 'Prioridades para o próximo período', 'Grato(a) por'];
  const top = box.y + 12, h = (box.y + box.h - top) / prompts.length;
  prompts.forEach((p, i) => {
    const y = top + i * h;
    pen.text(p, box.x, y, { size: 8.5, font: 'bold', color: ctx.accent, baseline: 'top' });
    fillLines(pen, { x: box.x, y: y + 5, w: box.w, h: h - 7 }, 7, 0.14, ctx.hair);
  });
};

PAGE_DRAW.reading = (pen, box, o, ctx) => {
  const watch = o.kind === 'watch';
  const b = drawHeader(pen, box, ctx, watch ? 'Filmes & séries' : 'Leituras', false);
  const cols = watch ? [['Título', 0.5], ['Onde', 0.22], ['Nota', 0.28]] : [['Título', 0.46], ['Autor', 0.26], ['Nota', 0.28]];
  let x = b.x;
  cols.forEach(([lab, f]) => { pen.text(lab, x + 1, b.y - 2, { size: 6.5, font: 'bold', color: ctx.faint, baseline: 'top' }); pen.line(x, b.y, x, b.y + b.h, { w: 0.1, color: ctx.hair }); x += b.w * f; });
  const rows = Math.floor(b.h / 8);
  for (let i = 0; i <= rows; i++) pen.line(b.x, b.y + i * 8, b.x + b.w, b.y + i * 8, { w: 0.14, color: ctx.hair });
  // coluna "Nota": 5 estrelas desenhadas (o glifo ☆ não existe na fonte do PDF)
  const noteX = b.x + b.w * 0.72, noteW = b.w * 0.28;
  const gap = Math.min(4, (noteW - 3) / 5);
  // entradas preenchidas: "título | autor/onde" (fluem entre as páginas da seção)
  const data = String(o.entries || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)\s*\|\s*(.+)$/);
    return m ? [m[1], m[2]] : [s, ''];
  });
  const rBase = (ctx.indexInSection || 0) * rows;
  for (let i = 0; i < rows; i++) {
    const cy = b.y + i * 8 + 4;
    const d = data[rBase + i];
    if (d) {
      pen.text(d[0], b.x + 1.5, cy, { size: pen.fitText(d[0], b.w * (watch ? 0.48 : 0.44), 7.5, 5), color: ctx.ink, baseline: 'middle' });
      if (d[1]) pen.text(d[1], b.x + b.w * (watch ? 0.5 : 0.46) + 1.5, cy, { size: pen.fitText(d[1], b.w * (watch ? 0.2 : 0.24), 6.5, 4.5), color: ctx.faint, baseline: 'middle' });
    }
    for (let sIdx = 0; sIdx < 5; sIdx++) star(pen, noteX + 2 + sIdx * gap, cy, 1.4, ctx.hair);
  }
};

PAGE_DRAW.contacts = (pen, box, o, ctx) => {
  const b = drawHeader(pen, box, ctx, 'Contatos', false);
  const step = b.h / o.rows;
  for (let i = 0; i < o.rows; i++) {
    const y = b.y + i * step;
    pen.rect(b.x, y, b.w, step - 2, { stroke: ctx.hair, w: 0.2 });
    pen.text('nome', b.x + 2, y + 2, { size: 5, color: ctx.faint, baseline: 'top' });
    pen.text('telefone', b.x + b.w * 0.55 + 2, y + 2, { size: 5, color: ctx.faint, baseline: 'top' });
    pen.text('e-mail / notas', b.x + 2, y + step / 2 + 1, { size: 5, color: ctx.faint, baseline: 'top' });
    pen.line(b.x + b.w * 0.55, y, b.x + b.w * 0.55, y + step / 2, { w: 0.13, color: ctx.hair });
    pen.line(b.x, y + step / 2, b.x + b.w, y + step / 2, { w: 0.1, color: ctx.hair });
  }
};

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

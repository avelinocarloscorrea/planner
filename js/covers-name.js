/* Planner Studio — js/covers-name.js
   Capas com NOME personalizado (as que mais vendem): o nome da pessoa é o
   protagonista — em caligrafia, empilhado moderno, com inicial gigante, em
   arco, selo, coroa de folhas, boho e minimalista. Usa o campo "Nome" da capa
   (owner); título e ano ficam como apoio. Todos os textos e o enfeite são
   elementos editáveis na folha (chaves name, title, year, orn).
   Enfeites vêm do catálogo (vendor/core/art/enfeites.js).
   (parte de app; carregado depois de covers.js) */
"use strict";

if (typeof EPArt !== 'undefined') EPArt.load('enfeites');

// texto editável: aplica os ajustes do elemento e registra a caixa
function nmText(pen, ctx, o, key, label, str, x, y, st) {
  const f = elFx(o, key);
  if (f.hide || !str) return null;
  const fam = f.fam || st.fam || ctx.hfam, bold = f.bold == null ? !!st.bold : f.bold;
  const tr = st.tracking || 0;
  let size = st.maxW ? pen.fitText(str, st.maxW - tr * str.length, st.size, st.minSize || st.size * 0.35, bold, fam) : st.size;
  size *= f.s;
  const X = x + f.dx, Y = y + f.dy, al = st.align || 'c', bl = st.baseline || 'middle';
  pen.text(str, X, Y, { size, family: fam, font: bold ? 'bold' : st.italic ? 'it' : undefined, color: f.color || st.color,
    align: al, baseline: bl, tracking: tr ? tr * f.s : undefined });
  const w = pen.textWidth(str, size, bold, fam) + (tr ? (str.length - 1) * tr * f.s : 0), h = size / PT * 1.2;
  elHit(ctx, key, label, 'text', al === 'c' ? X - w / 2 : al === 'r' ? X - w : X, bl === 'middle' ? Y - h / 2 : bl === 'top' ? Y : Y - h * 0.8, w, h);
  return { size, w, h };
}
// enfeite do catálogo (move/aumenta/recolore/oculta como elemento "orn")
function nmArt(pen, ctx, o, id, cx, cy, w, h, color) {
  const f = elFx(o, 'orn');
  if (f.hide || !pen.art) return;
  const W = w * f.s, H = h * f.s, X = cx + f.dx - W / 2, Y = cy + f.dy - H / 2;
  pen.art(id, X, Y, W, H, { color: f.color || color });
  elHit(ctx, 'orn', 'Enfeite', 'art', X, Y, W, H);
}
function nmPage(ctx) {
  const b = ctx.bleed || 0, W = ctx.pageW || 148, H = ctx.pageH || 210;
  return { W, H, b, fill: (pen, color) => pen.rect(-b, -b, W + 2 * b, H + 2 * b, { fill: color }) };
}
const nmName = o => String(o.owner || '').trim() || 'Seu Nome';
const nmYear = (o, ctx) => String(o.subtitle || '').trim() || String(ctx.S.year || '');
const nmTitle = o => String(o.title || '').trim();

const COVER_NAME_STYLES = {
  // nome em caligrafia no centro, título em versalete acima e raminho abaixo
  nameScript(pen, box, o, ctx) {
    const P = nmPage(ctx), cx = P.W / 2, cy = P.H * 0.47;
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o).toUpperCase(), cx, cy - P.H * 0.12, { size: 11, fam: 'montserrat', tracking: 1.6, color: ctx.accent, maxW: box.w * 0.9 });
    nmText(pen, ctx, o, 'name', 'Nome', nmName(o), cx, cy, { size: 64, fam: 'dancing', bold: true, color: ctx.ink, maxW: box.w * 0.95, minSize: 20 });
    nmArt(pen, ctx, o, 'enfeites/ramo', cx, cy + P.H * 0.1, P.W * 0.42, P.W * 0.21, ctx.accent);
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), cx, P.H * 0.86, { size: 12, fam: 'montserrat', tracking: 3, color: ctx.faint });
  },
  // bloco de cor no topo com o ano; nome enorme empilhado embaixo, à esquerda
  nameStacked(pen, box, o, ctx) {
    const P = nmPage(ctx), bandH = P.H * 0.42;
    pen.rect(-P.b, -P.b, P.W + 2 * P.b, bandH + P.b, { fill: ctx.accent });
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), box.x, bandH - 8, { size: 72, fam: 'montserrat', bold: true, color: ctx.S.paperBg, align: 'l', baseline: 'bottom', maxW: box.w });
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o).toUpperCase(), box.x, box.y + 4, { size: 10, fam: 'montserrat', tracking: 1.8, color: ctx.S.paperBg, align: 'l', baseline: 'top', maxW: box.w });
    const words = nmName(o).split(/\s+/).slice(0, 3), f = elFx(o, 'name');
    if (f.hide) return;
    const fam = f.fam || 'montserrat', bold = f.bold !== false;
    const size = Math.min(...words.map(w => pen.fitText(w.toUpperCase(), box.w, 60, 16, bold, fam))) * f.s, lh = size / PT * 1.02;
    const x0 = box.x + f.dx, y0 = bandH + P.H * 0.1 + f.dy;
    let wmax = 0;
    words.forEach((w, i) => {
      const s = w.toUpperCase();
      pen.text(s, x0, y0 + i * lh, { size, family: fam, font: bold ? 'bold' : undefined, color: f.color || ctx.ink, baseline: 'top' });
      wmax = Math.max(wmax, pen.textWidth(s, size, bold, fam));
    });
    elHit(ctx, 'name', 'Nome', 'text', x0, y0, wmax, words.length * lh);
  },
  // inicial gigante em tom claro, nome em caligrafia por cima
  nameInitial(pen, box, o, ctx) {
    const P = nmPage(ctx), cx = P.W / 2, cy = P.H * 0.45, nm = nmName(o);
    nmText(pen, ctx, o, 'initial', 'Inicial', nm[0].toUpperCase(), cx, cy, { size: 300, fam: 'playfair', color: mixHex(ctx.accent, ctx.S.paperBg, 0.78), maxW: box.w * 0.95 });
    nmText(pen, ctx, o, 'name', 'Nome', nm, cx, cy + P.H * 0.03, { size: 54, fam: 'dancing', bold: true, color: ctx.ink, maxW: box.w * 0.92, minSize: 18 });
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o).toUpperCase(), cx, P.H * 0.8, { size: 10, fam: 'montserrat', tracking: 2, color: ctx.ink, maxW: box.w * 0.9 });
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), cx, P.H * 0.85, { size: 10, fam: 'montserrat', tracking: 2, color: ctx.accent });
  },
  // arco-íris boho acima, nome no meio, título embaixo
  nameArch(pen, box, o, ctx) {
    const P = nmPage(ctx), cx = P.W / 2;
    P.fill(pen, mixHex(ctx.accent, ctx.S.paperBg, 0.9));
    nmArt(pen, ctx, o, 'enfeites/arco-iris-boho', cx, P.H * 0.3, P.W * 0.62, P.W * 0.34, ctx.accent);
    nmText(pen, ctx, o, 'name', 'Nome', nmName(o), cx, P.H * 0.5, { size: 46, fam: 'playfair', bold: true, color: ctx.ink, maxW: box.w * 0.9, minSize: 16 });
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o), cx, P.H * 0.585, { size: 15, fam: 'dancing', color: ctx.accent, maxW: box.w * 0.85 });
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), cx, P.H * 0.88, { size: 11, fam: 'montserrat', tracking: 3, color: ctx.ink });
  },
  // selo ondulado com o nome em branco
  nameBadge(pen, box, o, ctx) {
    const P = nmPage(ctx), cx = P.W / 2, cy = P.H * 0.44, d = Math.min(box.w * 0.82, P.H * 0.5);
    nmArt(pen, ctx, o, 'enfeites/selo-ondulado', cx, cy, d, d, ctx.accent);
    nmText(pen, ctx, o, 'name', 'Nome', nmName(o), cx, cy, { size: 40, fam: 'dancing', bold: true, color: '#ffffff', maxW: d * 0.66, minSize: 12 });
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o).toUpperCase(), cx, cy + d / 2 + 14, { size: 13, fam: 'montserrat', bold: true, tracking: 1.4, color: ctx.ink, maxW: box.w * 0.9 });
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), cx, cy + d / 2 + 22, { size: 11, fam: 'montserrat', tracking: 2.4, color: ctx.faint });
  },
  // coroa de folhas em volta do nome
  nameFloral(pen, box, o, ctx) {
    const P = nmPage(ctx), cx = P.W / 2, cy = P.H * 0.45, d = Math.min(box.w * 0.86, P.H * 0.52);
    nmArt(pen, ctx, o, 'enfeites/coroa-louros', cx, cy, d, d, mixHex(ctx.accent, ctx.ink, 0.25));
    nmText(pen, ctx, o, 'name', 'Nome', nmName(o), cx, cy, { size: 40, fam: 'dancing', bold: true, color: ctx.ink, maxW: d * 0.62, minSize: 12 });
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), cx, cy + d * 0.16, { size: 10, fam: 'montserrat', tracking: 2.4, color: ctx.accent });
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o).toUpperCase(), cx, P.H * 0.84, { size: 12, fam: 'montserrat', tracking: 2.2, color: ctx.ink, maxW: box.w * 0.9 });
  },
  // sol boho no rodapé de uma faixa, nome manuscrito
  nameBoho(pen, box, o, ctx) {
    const P = nmPage(ctx), cx = P.W / 2;
    P.fill(pen, mixHex(ctx.accent, ctx.S.paperBg, 0.82));
    pen.rect(-P.b, P.H * 0.62, P.W + 2 * P.b, P.H * 0.38 + P.b, { fill: mixHex(ctx.accent, ctx.S.paperBg, 0.55) });
    nmArt(pen, ctx, o, 'enfeites/sol-boho', cx, P.H * 0.62 - P.W * 0.14, P.W * 0.5, P.W * 0.29, ctx.S.paperBg);
    nmText(pen, ctx, o, 'name', 'Nome', nmName(o), cx, P.H * 0.3, { size: 50, fam: 'caveat', bold: true, color: ctx.ink, maxW: box.w * 0.92, minSize: 16 });
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o), cx, P.H * 0.39, { size: 14, fam: 'lora', italic: true, color: ctx.ink, maxW: box.w * 0.85 });
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), cx, P.H * 0.8, { size: 26, fam: 'montserrat', bold: true, tracking: 2, color: ctx.S.paperBg });
  },
  // ano grande e fino no topo, nome espaçado em maiúsculas no pé
  nameMinimal(pen, box, o, ctx) {
    const P = nmPage(ctx), cx = P.W / 2;
    nmText(pen, ctx, o, 'year', 'Ano', nmYear(o, ctx), cx, P.H * 0.3, { size: 90, fam: 'playfair', color: ctx.ink, maxW: box.w });
    nmText(pen, ctx, o, 'title', 'Título', nmTitle(o).toLowerCase(), cx, P.H * 0.42, { size: 14, fam: 'lora', italic: true, color: ctx.accent, maxW: box.w * 0.9 });
    pen.line(cx - 10, P.H * 0.78, cx + 10, P.H * 0.78, { w: 0.4, color: ctx.accent });
    nmText(pen, ctx, o, 'name', 'Nome', nmName(o).toUpperCase(), cx, P.H * 0.83, { size: 13, fam: 'montserrat', tracking: 3.2, color: ctx.ink, maxW: box.w * 0.92, minSize: 7 });
  },
};

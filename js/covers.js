/* Planner Studio — js/covers.js
   Capa (estilos clássicos), divisória e frase. Os textos e o logo são
   "elementos" editáveis na folha: cada um lê seus ajustes com elFx() e
   registra a caixa com elHit() (js/decor.js). Os estilos com nome
   personalizado ficam em js/covers-name.js. Textos, ilustrações e imagens
   livres são desenhados por drawPageInto (engine.js), em qualquer página.
   (parte de app; carregado depois de pages.js) */
"use strict";

function monogramOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
PAGE_DRAW.cover = (pen, box, o, ctx) => {
  if (typeof COVER_NAME_STYLES !== 'undefined' && COVER_NAME_STYLES[o.style]) COVER_NAME_STYLES[o.style](pen, box, o, ctx);
  else coverClassic(pen, box, o, ctx);
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
};

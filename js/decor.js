/* Planner Studio — js/decor.js
   Personalização que vale para qualquer página:
   - elementos editáveis na folha: ajustes por elemento em sec.opts.el[chave]
     = { dx, dy (mm), s (escala), color, fam, bold, hide } — elFx()/elHit();
   - elementos livres da seção (sec.opts.extras): texto, imagem ou ilustração
     do catálogo (EPArt), repetidos em todas as páginas da seção;
   - marca d'água do documento (settings.wm): texto, ilustração ou imagem,
     por baixo do conteúdo.
   Validação (migrate) e desenho (tela e PDF) ficam juntos aqui.
   (parte de app; carregado antes de pages.js) */
"use strict";

const EL_KEYS = /^(title|subtitle|owner|logo|monogram|year|text|author|name|initial|tagline|orn|x:[A-Za-z0-9_-]{1,24})$/;
const DATA_IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function elFx(o, key) {
  const e = (o && o.el && o.el[key]) || {};
  const fams = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  return { dx: +e.dx || 0, dy: +e.dy || 0, s: clamp(+e.s || 1, 0.25, 5), color: HEX.test(e.color || '') ? e.color : null,
    fam: e.fam && fams[e.fam] ? e.fam : null, bold: e.bold == null ? null : !!e.bold, hide: !!e.hide };
}
// ctx.hits só existe quando a tela pede as caixas (edição na folha)
function elHit(ctx, key, label, kind, x, y, w, h) { if (ctx && ctx.hits) ctx.hits.push({ key, label, kind, x, y, w, h }); }

/* ---------- elementos livres ---------- */
const EXTRA_LABEL = { text: 'Texto', image: 'Imagem', art: 'Ilustração' };
// caixa de uma ilustração: lado maior ~ base, respeitando a proporção do desenho
function artBox(id, base) {
  const it = typeof EPArt !== 'undefined' ? EPArt.get(id) : null;
  const ar = it ? it.w / it.h : 1;
  return ar >= 1 ? [base, base / ar] : [base * ar, base];
}
function drawExtras(pen, o, ctx) {
  const list = Array.isArray(o.extras) ? o.extras : [];
  const PW = ctx.pageW || 148, PH = ctx.pageH || 210;
  list.forEach(x => {
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
    if (x.type === 'art') {
      const [w, h] = artBox(x.art, 34 * f.s);
      if (pen.art) pen.art(x.art, cx - w / 2, cy - h / 2, w, h, { color: f.color || ctx.accent });
      elHit(ctx, key, 'Ilustração', 'art', cx - w / 2, cy - h / 2, w, h);
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

/* ---------- marca d'água ---------- */
const WM_DEFAULT = { on: false, kind: 'text', text: '', art: '', src: '', opacity: 0.1, size: 1, rot: -30, pos: 'center', color: '', fam: '', covers: false };
function drawWatermark(pen, W, H, ctx, wm) {
  const color = wm.color || ctx.ink, op = wm.opacity;
  const unit = (cx, cy) => {
    if (pen.rotate && wm.rot) pen.rotate(wm.rot, cx, cy);
    if (wm.kind === 'art' && wm.art && pen.art) {
      const [w, h] = artBox(wm.art, 70 * wm.size);
      pen.art(wm.art, cx - w / 2, cy - h / 2, w, h, { color, opacity: op });
    } else if (wm.kind === 'image' && wm.src) {
      const w = 70 * wm.size, dim = typeof imageDims === 'function' ? imageDims(wm.src) : null, h = dim && dim.w ? w * dim.h / dim.w : w;
      pen.image(wm.src, cx - w / 2, cy - h / 2, w, h, { fit: 'meet', opacity: op });
    } else if (wm.text) {
      const fam = wm.fam || ctx.hfam || 'sans';
      const size = pen.fitText(wm.text, (wm.pos === 'center' ? W * 0.9 : W * 0.5) * wm.size, 54 * wm.size, 8, true, fam);
      pen.text(wm.text, cx, cy, { size, font: 'bold', color, align: 'c', baseline: 'middle', family: fam, opacity: op });
    }
    if (pen.rotate && wm.rot) pen.unclip();
  };
  if (wm.pos === 'tile') {
    const step = 62 * wm.size;
    for (let y = step * 0.35, r = 0; y < H + step / 2; y += step * 0.8, r++)
      for (let x = (r % 2 ? step / 2 : 0) + step * 0.2; x < W + step / 2; x += step) unit(x, y);
  } else if (wm.pos === 'bottom') unit(W / 2, H * 0.86);
  else if (wm.pos === 'corner') unit(W * 0.78, H * 0.88);
  else unit(W / 2, H / 2);
}

/* ---------- validação (migrate) ---------- */
function cleanSheetEl(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const el = {};
  Object.keys(raw).slice(0, 80).forEach(k => {
    if (!EL_KEYS.test(k)) return;
    const e = raw[k] && typeof raw[k] === 'object' ? raw[k] : {}, v = {};
    ['dx', 'dy'].forEach(q => { if (e[q] != null && isFinite(+e[q])) v[q] = clamp(+e[q], -800, 800); });
    if (e.s != null && isFinite(+e.s)) v.s = clamp(+e.s, 0.25, 5);
    if (HEX.test(e.color || '')) v.color = e.color;
    if (typeof e.fam === 'string' && /^[A-Za-z]{2,24}$/.test(e.fam)) v.fam = e.fam;
    if (e.bold != null) v.bold = !!e.bold;
    if (e.hide) v.hide = true;
    el[k] = v;
  });
  return el;
}
function cleanExtras(raw) {
  if (!Array.isArray(raw)) return null;
  const isArt = id => typeof EPArt !== 'undefined' ? EPArt.isId(id) : /^[a-z0-9-]+\/[a-z0-9-]+$/.test(id || '');
  return raw.slice(0, 40).map(x => {
    x = x && typeof x === 'object' ? x : {};
    const type = ['image', 'art'].includes(x.type) ? x.type : 'text';
    return { id: /^[A-Za-z0-9_-]{1,24}$/.test(x.id || '') ? x.id : uid(), type,
      text: type === 'text' ? sanitizeText(x.text || '', 400) : '',
      src: type === 'image' && typeof x.src === 'string' && DATA_IMG.test(x.src) && x.src.length < 5e6 ? x.src : '',
      art: type === 'art' && isArt(x.art) ? x.art : '' };
  }).filter(x => x.type === 'text' || x.src || x.art);
}
function cleanWatermark(w) {
  w = w && typeof w === 'object' ? w : {};
  const fams = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  return {
    on: !!w.on, kind: ['text', 'art', 'image'].includes(w.kind) ? w.kind : 'text',
    text: sanitizeText(w.text || '', 60),
    art: typeof EPArt !== 'undefined' && EPArt.isId(w.art) ? w.art : '',
    src: typeof w.src === 'string' && DATA_IMG.test(w.src) && w.src.length < 5e6 ? w.src : '',
    opacity: clamp(num(w.opacity, WM_DEFAULT.opacity), 0.03, 0.6),
    size: clamp(num(w.size, 1), 0.3, 3),
    rot: clamp(Math.round(num(w.rot, WM_DEFAULT.rot)), -90, 90),
    pos: ['center', 'bottom', 'corner', 'tile'].includes(w.pos) ? w.pos : 'center',
    color: HEX.test(w.color || '') ? w.color : '',
    fam: w.fam && fams[w.fam] ? w.fam : '',
    covers: !!w.covers,
  };
}
// ilustrações usadas no documento (para carregar antes de gerar PDF/PNG)
function usedArtIds(st) {
  const ids = [];
  ((st && st.sections) || []).forEach(sec => ((sec.opts && sec.opts.extras) || []).forEach(x => { if (x.type === 'art' && x.art) ids.push(x.art); }));
  if (((st && st.sections) || []).some(sec => sec.type === 'cover' && /^name/.test((sec.opts && sec.opts.style) || ''))) ids.push('enfeites/ramo');
  const wm = st && st.settings && st.settings.wm;
  if (wm && wm.on && wm.kind === 'art' && wm.art) ids.push(wm.art);
  return ids;
}

/* Planner Studio — js/decor.js
   Personalização que vale para qualquer página:
   - elementos editáveis na folha: ajustes por elemento em sec.opts.el[chave]
     no modelo do núcleo (EPTextFx: posição, escala, fonte, cor, efeitos) — elFx()/elPen()/elHit();
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
  // modelo único do núcleo (text-fx.js): posição, escala, fonte, cor, efeitos…
  return EPTextFx.norm((o && o.el && o.el[key]) || {});
}
// ctx.hits só existe quando a tela pede as caixas (edição na folha).
// P (opcional) = caneta com estilo do elemento: aplica fundo/sombra/contorno/giro em volta da caixa.
function elHit(ctx, key, label, kind, x, y, w, h, P) {
  if (P && P.done) P.done({ x, y, w, h });
  if (ctx && ctx.hits) ctx.hits.push({ key, label, kind, x, y, w, h });
}
const elPen = (pen, f) => EPTextFx.pen(pen, f);

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
    if (x.type === 'text') {
      const b = EPTextFx.block(pen, String(x.text || 'Texto'), cx, cy, 14 * f.s, f, { fam: ctx.hfam || 'sans', color: ctx.ink, lh: 1.25 });
      elHit(ctx, key, 'Texto', 'text', b.x, b.y, b.w, b.h);
      return;
    }
    const P = elPen(pen, f);
    if (x.type === 'image') {
      if (!x.src || !pen.image) return;
      const w = 40 * f.s, dim = typeof imageDims === 'function' ? imageDims(x.src) : null;
      const h = dim && dim.w ? w * dim.h / dim.w : w;
      P.image(x.src, cx - w / 2, cy - h / 2, w, h, { fit: 'meet' });
      elHit(ctx, key, 'Imagem', 'image', cx - w / 2, cy - h / 2, w, h, P);
      return;
    }
    const [w, h] = artBox(x.art, 34 * f.s);
    if (pen.art) P.art(x.art, cx - w / 2, cy - h / 2, w, h, { color: f.color || ctx.accent });
    elHit(ctx, key, 'Ilustração', 'art', cx - w / 2, cy - h / 2, w, h, P);
  });
}

/* ---------- marca d'água ---------- */
// marca d'água e fundo: núcleo (watermark.js / background.js), iguais nas três ferramentas
function drawWatermark(pen, W, H, ctx, wm) { EPWatermark.draw(pen, W, H, wm, { ink: ctx.ink, paper: ctx.S && ctx.S.paperBg, fam: ctx.hfam }); }

/* ---------- validação (migrate) ---------- */
function cleanSheetEl(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const el = {};
  Object.keys(raw).slice(0, 80).forEach(k => { if (EL_KEYS.test(k)) el[k] = EPTextFx.clean(raw[k]); });
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
const cleanWatermark = w => EPWatermark.clean(w);
// ilustrações usadas no documento (para carregar antes de gerar PDF/PNG)
function usedArtIds(st) {
  const ids = [];
  ((st && st.sections) || []).forEach(sec => ((sec.opts && sec.opts.extras) || []).forEach(x => { if (x.type === 'art' && x.art) ids.push(x.art); }));
  if (((st && st.sections) || []).some(sec => sec.type === 'cover' && /^name/.test((sec.opts && sec.opts.style) || ''))) ids.push('enfeites/ramo');
  const wm = st && st.settings && st.settings.wm;
  if (wm && wm.on && wm.kind === 'art' && wm.art) ids.push(wm.art);
  const bgs = [st && st.settings && st.settings.bg, ...((st && st.sections) || []).map(sec => sec.opts && sec.opts.pageBg)];
  bgs.forEach(b => { if (b && b.kind === 'pattern' && b.pat === 'art' && b.art) ids.push(b.art); });
  return ids;
}

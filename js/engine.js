/* Planner Studio — js/engine.js
   estado, validação, geometria da página, expansão seções -> páginas,
   render da tela (SVG com janela), zoom/navegação e histórico.
   (parte de app; carregado em ordem por index.html) */
"use strict";

const KEY = 'plannerstudio-v1';
const UIKEY = 'plannerstudio-ui-v1';

let state = { settings: { ...DEFAULTS }, sections: [] };
let selId = null;
let zoom = 0.5, userZoomed = false, currentPage = 0, dragId = null;
let zen = false;
const uiState = { left: true, right: true };
const svgCache = new Map();               // pageIndex -> {sig, svg}
const stage = $('#stage'), sheetsEl = $('#sheets'), appEl = $('#app');
const WINDOW = 6;                          // páginas renderadas de cada lado

/* ================= validação ================= */
function migrate(st) {
  const s = { ...DEFAULTS, ...(st && st.settings || {}) };
  s.paper = PAGE_SIZES[s.paper] ? s.paper : 'a5';
  s.landscape = !!s.landscape;
  s.customW = clamp(num(s.customW, 148), 40, 700);
  s.customH = clamp(num(s.customH, 210), 40, 700);
  ['marginTop', 'marginBottom', 'marginInner', 'marginOuter'].forEach(k => s[k] = clamp(num(s[k], 10), 0, 60));
  s.mirrorMargins = s.mirrorMargins !== false;
  s.bleedMm = clamp(num(s.bleedMm, 0), 0, 10);
  s.cropMarks = !!s.cropMarks;
  s.registration = !!s.registration;
  s.binding = BINDINGS[s.binding] ? s.binding : 'none';
  s.showPunch = !!s.showPunch;
  s.printPunch = !!s.printPunch;
  s.pageNumber = ['none', 'center', 'outer', 'inner'].includes(s.pageNumber) ? s.pageNumber : 'outer';
  s.pageNumberStart = clamp(Math.round(num(s.pageNumberStart, 1)), 0, 9999);
  s.pageNumberSkip = clamp(Math.round(num(s.pageNumberSkip, 1)), 0, 50);
  s.pageNumberSize = clamp(num(s.pageNumberSize, 8), 5, 14);
  s.pageNumberTotal = !!s.pageNumberTotal;
  s.pageNumberPrefix = sanitizeText(s.pageNumberPrefix, 12);
  s.ink = hexOr(s.ink, '#33403b');
  s.accent = hexOr(s.accent, '#a97f3d');
  s.paperBg = hexOr(s.paperBg, '#ffffff');
  s.lineWeight = clamp(num(s.lineWeight, 1), 0.5, 2);
  s.gridSpacing = clamp(num(s.gridSpacing, 5), 3, 12);
  s.ruleSpacing = clamp(num(s.ruleSpacing, 7), 5, 12);
  s.headerShow = !!s.headerShow;
  s.highlightWeekends = s.highlightWeekends !== false;
  s.year = clamp(Math.round(num(s.year, DEFAULTS.year)), 1900, 2200);
  s.startDate = parseYMD(s.startDate) ? String(s.startDate).trim() : '';
  s.weekStart = s.weekStart === 'sun' ? 'sun' : 'mon';
  s.footerText = sanitizeText(s.footerText, 80);
  // compat: modos antigos 'a4'/'letter' viram 'fit' + folha correspondente
  if (s.exportMode === 'a4') { s.exportMode = 'fit'; if (!s.sheet) s.sheet = 'a4'; }
  else if (s.exportMode === 'letter') { s.exportMode = 'fit'; if (!s.sheet) s.sheet = 'letter'; }
  s.exportMode = ['real', 'fit', '2up', 'booklet'].includes(s.exportMode) ? s.exportMode : 'real';
  s.sheet = ['a4', 'letter', 'a3'].includes(s.sheet) ? s.sheet : 'a4';
  s.twoUpOrder = s.twoUpOrder === 'seq' ? 'seq' : 'stack';
  s.headingFont = ['sans', 'serif', 'mono'].includes(s.headingFont) ? s.headingFont : 'sans';
  s.exportDPI = clamp(Math.round(num(s.exportDPI, 300)), 150, 600);
  s.showSafeGuide = !!s.showSafeGuide;
  s.labels = (s.labels && typeof s.labels === 'object' && !Array.isArray(s.labels)) ? s.labels : {};
  for (const k of Object.keys(s.labels)) {
    if (typeof s.labels[k] !== 'string') { delete s.labels[k]; continue; }
    s.labels[k] = sanitizeText(s.labels[k], 40);
  }

  const secs = Array.isArray(st && st.sections) ? st.sections : [];
  const outSec = [];
  for (const raw of secs.slice(0, 400)) {
    if (!raw || !PAGE_TYPES[raw.type]) continue;
    const T = PAGE_TYPES[raw.type];
    const sec = { id: raw.id && typeof raw.id === 'string' ? raw.id.slice(0, 24) : uid(), type: raw.type, opts: {} };
    sec.count = T.repeat ? clamp(Math.round(num(raw.count, 1)), 1, 600) : 1;
    const src = raw.opts && typeof raw.opts === 'object' ? raw.opts : {};
    (T.fields || []).forEach(f => {
      let v = src[f.k];
      if (f.type === 'toggle') v = (v == null ? f.def : !!v);
      else if (f.type === 'range') v = clamp(num(v, f.def), f.min, f.max);
      else if (f.type === 'select') v = (f.options.some(o => String(o.v) === String(v)) ? v : f.def);
      else if (f.type === 'text') v = sanitizeText(v == null ? f.def : v, 80);
      else if (f.type === 'textarea') v = sanitizeText(v == null ? f.def : v, 4000);
      else if (f.type === 'image') v = (typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 5e6) ? v : '';
      else v = (v == null ? f.def : v);
      sec.opts[f.k] = v;
    });
    if (src.ink && HEX.test(src.ink)) sec.opts.ink = src.ink;
    if (src.breakBefore) sec.opts.breakBefore = true;
    if (typeof src.footer === 'string' && src.footer.trim()) sec.opts.footer = sanitizeText(src.footer, 80);
    outSec.push(sec);
  }
  return { settings: s, sections: outSec };
}

/* ================= persistência ================= */
let saveT;
let _saveWarned = false;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); _saveWarned = false; }
    catch (e) {
      if (!_saveWarned) { _saveWarned = true; try { toast('Não coube no armazenamento do navegador (imagem grande?). Use "Salvar projeto" no menu para não perder.'); } catch (_) {} }
    }
  }, 300);
}
function load() {
  let d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (d && typeof d === 'object') state = migrate(d);
}

/* ================= geometria ================= */
function paperWH() {
  const s = state.settings;
  let w, h;
  if (s.paper === 'custom') { w = s.customW; h = s.customH; }
  else { const p = PAGE_SIZES[s.paper]; w = p.w; h = p.h; }
  return s.landscape ? [h, w] : [w, h];
}
// caixa útil da página `idx` (0-based). recto = página ímpar = índice par.
function contentBox(idx) {
  const s = state.settings, [W, H] = paperWH();
  const recto = (idx % 2 === 0);
  const innerAdd = BINDINGS[s.binding] ? BINDINGS[s.binding].innerAdd : 0;
  const inner = s.marginInner + innerAdd;
  let left, right;
  if (s.mirrorMargins) {
    left = recto ? inner : s.marginOuter;
    right = recto ? s.marginOuter : inner;
  } else { left = inner; right = s.marginOuter; }
  return {
    x: left, y: s.marginTop,
    w: Math.max(20, W - left - right),
    h: Math.max(20, H - s.marginTop - s.marginBottom),
    recto,
  };
}

/* ================= seções -> páginas ================= */
function parseYMD(v) {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(String(v || ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(+d) ? null : d;
}
// memo: expand() é chamado várias vezes por interação (render, lista, navegação…).
// A saída só depende de settings de data + das seções; guarda-se por assinatura.
let _expandMemo = { sig: '\0', pages: [] };
// assinatura barata de opts — strings longas (data: URIs de imagem) entram só
// pelo tamanho + pontas, para não stringificar centenas de KB a cada chamada.
function cheapOptsSig(o) {
  if (!o) return '';
  let s = '';
  for (const k in o) {
    const v = o[k];
    s += k + '=' + (typeof v === 'string' && v.length > 160 ? 'L' + v.length + v.slice(0, 20) + v.slice(-20) : v) + ',';
  }
  return s;
}
function expandSig() {
  const s = state.settings;
  let sig = s.year + '|' + s.startDate + '|' + s.weekStart;
  for (const sec of state.sections) sig += '\x1e' + sec.id + ':' + sec.type + ':' + sec.count + ':' + cheapOptsSig(sec.opts);
  return sig;
}
function expand() {
  const sig = expandSig();
  if (sig === _expandMemo.sig) return _expandMemo.pages;
  const pages = expandCompute();
  _expandMemo = { sig, pages };
  return pages;
}
function expandCompute() {
  const s = state.settings;
  const pages = [];
  let cursor = parseYMD(s.startDate) || new Date(s.year, 0, 1);
  state.sections.forEach((sec, si) => {
    const T = PAGE_TYPES[sec.type];
    const opts = { ...T.defaults, ...sec.opts };
    // "Começar em página à direita": insere uma folha em branco se necessário
    if (opts.breakBefore && pages.length % 2 === 1) {
      pages.push({ type: 'blank', opts: { header: false }, sectionId: sec.id, si, k: 0, date: null, filler: true });
    }
    // "Blocos ao montar a seção": um título por linha → 1 página por item.
    const items = String(opts.items || '').split('\n').map(x => x.trim()).filter(Boolean);
    let cnt = items.length ? items.length : (T.repeat ? sec.count : 1);
    // Índice/Rastreador/etc.: se as entradas não cabem, gera páginas suficientes
    if (!items.length && typeof opts.entries === 'string' && opts.entries.trim() && T.repeat) {
      const perPage = sec.type === 'index' ? (+opts.cols || 1) * (+opts.rows || 28)
        : sec.type === 'reading' ? 24 : 999;
      cnt = Math.max(cnt, Math.ceil(opts.entries.split('\n').filter(x => x.trim()).length / perPage));
    }
    const push = (p) => { if (items[p.k] != null) p.title = items[p.k]; pages.push(p); };
    // início explícito da seção (data ou mês) sobrepõe o encadeamento automático
    const explicit = parseYMD(opts.startDate);
    if (explicit) cursor = explicit;
    else if (T.dated === 'month' && opts.month && +opts.month >= 1 && +opts.month <= 12) cursor = new Date(s.year, +opts.month - 1, 1);
    if (T.dated === 'month') {
      const baseM = cursor.getMonth(), baseY = cursor.getFullYear();
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: new Date(baseY, baseM + k, 1) });
      cursor = new Date(baseY, baseM + cnt, 1);
    } else if (T.dated === 'week') {
      const w0 = startOfWeek(cursor, opts.weekStart || s.weekStart);
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: addDays(w0, k * 7) });
      cursor = addDays(w0, cnt * 7);
    } else if (T.dated === 'day') {
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: addDays(cursor, k) });
      cursor = addDays(cursor, cnt);
    } else if (T.dated === 'day2') {
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: addDays(cursor, k * 2), date2: addDays(cursor, k * 2 + 1) });
      cursor = addDays(cursor, cnt * 2);
    } else if (opts.autoDate) {
      // "Data automática": tipo não datado, mas 1 dia por página a partir do cursor
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: addDays(cursor, k), autoDated: true });
      cursor = addDays(cursor, cnt);
    } else {
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: null });
    }
  });
  return pages;
}
function pageCount() { return expand().length; }

/* ================= desenho de uma página (SVG ou PDF) ================= */
function drawCropMarks(pen, W, H, bleed) {
  const L = 4, g = 1.5, col = '#000';
  const seg = (x1, y1, x2, y2) => pen.line(x1, y1, x2, y2, { w: 0.12, color: col });
  [[bleed, bleed], [W - bleed, bleed], [bleed, H - bleed], [W - bleed, H - bleed]].forEach(([x, y], i) => {
    const sx = (i % 2 === 0) ? -1 : 1, sy = (i < 2) ? -1 : 1;
    seg(x + sx * g, y, x + sx * (g + L), y);
    seg(x, y + sy * g, x, y + sy * (g + L));
  });
}
function drawPunch(pen, W, H, box, kind, forPrint) {
  const b = BINDINGS[kind]; if (!b || !b.punch) return;
  const edgeLeft = box.recto;
  const cx = edgeLeft ? Math.max(4.5, box.x / 2) : W - Math.max(4.5, (W - box.x - box.w) / 2);
  const style = forPrint ? { stroke: '#000', w: 0.15 } : { stroke: '#c4b9a6', w: 0.3 };
  const hole = (y, r) => pen.circle(cx, y, r, style);
  if (b.punch === 'spiral' || b.punch === 'wireo') {
    const pitch = b.punch === 'wireo' ? (25.4 / 3) : (25.4 / 4);   // 3:1 / 4:1
    const r = b.punch === 'wireo' ? 1.6 : 1.5;
    const n = Math.floor((H - 20) / pitch);
    const y0 = (H - n * pitch) / 2 + pitch / 2;
    for (let i = 0; i < n; i++) hole(y0 + i * pitch, r);
  } else if (b.punch === 'ring6') {
    const groups = [-1, 1];
    const within = [-9.5, 9.5];
    groups.forEach(g => within.forEach(w => hole(H / 2 + g * 40 + w, 2.2)));
  } else if (b.punch === 'ring2') {
    hole(H / 2 - 40, 3); hole(H / 2 + 40, 3);
  } else if (b.punch === 'disc') {
    const n = 11, pitch = (H - 24) / (n - 1);
    for (let i = 0; i < n; i++) hole(12 + i * pitch, 2.6);
  }
}
function pageCtx(pd) {
  const s = state.settings;
  const sec = state.sections.find(x => x.id === pd.sectionId);
  const ink = (sec && sec.opts && sec.opts.ink && HEX.test(sec.opts.ink)) ? sec.opts.ink : s.ink;
  const lw = s.lineWeight || 1;
  return {
    S: s, ink,
    faint: mixHex(ink, s.paperBg, 0.60),
    hair: mixHex(ink, s.paperBg, 0.82),
    accent: s.accent,
    date: pd.date, date2: pd.date2,
    weekStart: s.weekStart,
    highlightWeekends: s.highlightWeekends !== false,
    lw,
    pageIndex: pd.pageIndexGlobal || 0,
    isRight: true,
    indexInSection: pd.k,
    L: (k) => LBL(s, k),           // rótulo editável ("NOTAS", "TAREFAS"…)
    hfam: s.headingFont || 'sans', // família dos títulos
  };
}
function drawPageInto(pen, pd, idx, opt = {}) {
  const s = state.settings, [W, H] = paperWH();
  if (pen.setLineScale) pen.setLineScale(s.lineWeight || 1);
  const o = { ...PAGE_TYPES[pd.type].defaults, ...pd.opts };
  // título por página (vindo de "um item por linha") sobrepõe o da seção
  if (pd.title != null && pd.title !== '') o.title = pd.title;
  const ctx = pageCtx({ ...pd, pageIndexGlobal: idx });
  // Capa e divisória usam uma caixa CENTRADA na página (ignoram o desvio da
  // lombada), pra não ficarem tortas. Os demais tipos usam a área útil real.
  const isFull = pd.type === 'cover' || pd.type === 'tab';
  const mo = Math.min(s.marginOuter, s.marginTop);
  let box = isFull
    ? { x: mo, y: s.marginTop, w: Math.max(20, W - 2 * mo), h: Math.max(20, H - s.marginTop - s.marginBottom), recto: (idx % 2 === 0) }
    : contentBox(idx);

  // furos (na margem, fora do recorte)
  if ((opt.screen && s.showPunch) || (!opt.screen && s.printPunch)) drawPunch(pen, W, H, contentBox(idx), s.binding, !opt.screen);

  // "Data automática": cabeçalho com o dia da semana + data, cede o resto à escrita
  if (pd.autoDated && pd.date && !isFull) {
    const dd = pd.date;
    pen.text(DOW_PT[dd.getDay()], box.x, box.y, { size: 10, font: 'bold', color: ctx.ink, baseline: 'top', family: ctx.hfam });
    pen.text(dd.getDate() + ' ' + MONTHS_PT[dd.getMonth()].toLowerCase() + ' ' + dd.getFullYear(), box.x + box.w, box.y + 1.5, { size: 8, color: ctx.faint, align: 'r', baseline: 'top' });
    pen.line(box.x, box.y + 8, box.x + box.w, box.y + 8, { w: 0.4, color: ctx.ink });
    box = { x: box.x, y: box.y + 11, w: box.w, h: box.h - 11, recto: box.recto };
  }

  // conteúdo do tipo — SEMPRE recortado: nada escapa da página.
  // folga de 0,5 mm no recorte da área útil: molduras e as linhas de tabela que
  // encostam na borda da caixa não saem cortadas ao meio (some contra a margem).
  const CP = 0.5;
  const clipBox = isFull
    ? { x: 2, y: 2, w: W - 4, h: H - 4 }
    : { x: box.x - CP, y: box.y - CP, w: box.w + 2 * CP, h: box.h + 2 * CP };
  pen.clip(clipBox.x, clipBox.y, clipBox.w, clipBox.h);
  // guia de margem (só tela, opcional)
  if (opt.screen && s.showSafeGuide && !isFull) {
    pen.rect(box.x, box.y, box.w, box.h, { stroke: mixHex(s.accent, s.paperBg, 0.5), w: 0.15, dash: [1.4, 1.4] });
  }
  HEAD_FAM = ctx.hfam || 'sans';
  try { (PAGE_DRAW[pd.type] || PAGE_DRAW.blank)(pen, box, o, ctx); }
  catch (e) { console.error('draw ' + pd.type, e); }
  HEAD_FAM = 'sans';
  pen.unclip();

  // número de página + rodapé (fora do recorte, sempre alinhados à borda da
  // área útil e crescendo para dentro — nunca são cortados na margem).
  const footY = H - Math.max(3, s.marginBottom * 0.55);
  const bxL = box.x, bxR = box.x + box.w;                 // bordas esquerda/direita da área útil
  // lado externo da página (fora da lombada): direita nas ímpares (recto), esquerda nas pares
  const outerRight = box.recto !== false;
  let pnumSide = 'center';                                 // 'left' | 'right' | 'center'
  if (s.pageNumber === 'outer') pnumSide = outerRight ? 'right' : 'left';
  else if (s.pageNumber === 'inner') pnumSide = outerRight ? 'left' : 'right';
  else if (s.pageNumber === 'center') pnumSide = 'center';

  if (!pd.filler && s.pageNumber !== 'none' && idx >= s.pageNumberSkip) {
    const nreal = s.pageNumberStart + idx - s.pageNumberSkip;
    if (nreal >= 0) {
      let label = (s.pageNumberPrefix ? s.pageNumberPrefix + ' ' : '') + nreal;
      const tot = Math.round(s.pageNumberStart + (opt.total || 0) - 1 - s.pageNumberSkip);
      if (s.pageNumberTotal && opt.total && isFinite(tot) && tot >= nreal) label += ' / ' + tot;
      let x, align;
      if (pnumSide === 'center') { x = W / 2; align = 'c'; }
      else if (pnumSide === 'right') { x = bxR; align = 'r'; }
      else { x = bxL; align = 'l'; }
      pen.text(String(label), x, footY, { size: s.pageNumberSize, color: ctx.faint, align, baseline: 'middle' });
    }
  }
  const footTxt = (typeof o.footer === 'string' && o.footer.trim()) ? o.footer : s.footerText;
  if (footTxt && !pd.filler) {
    // rodapé no lado oposto ao número (ou centralizado se o número está no centro/ausente)
    let fx, fa;
    if (pnumSide === 'center') { fx = W / 2; fa = 'c'; }
    else if (pnumSide === 'right') { fx = bxL; fa = 'l'; }
    else { fx = bxR; fa = 'r'; }
    const fSize = pen.fitText(footTxt, box.w * 0.66, Math.max(6, s.pageNumberSize - 1.5), 5);
    pen.text(footTxt, fx, footY, { size: fSize, color: ctx.hair, align: fa, baseline: 'middle' });
  }
  // corte / sangria (só PDF, e só quando há sangria; nunca na impressão em folha)
  if (!opt.screen && !opt.print && s.cropMarks && s.bleedMm > 0) drawCropMarks(pen, W, H, s.bleedMm);
}


/* mini pré-visualização de um tipo de página (para o menu "Adicionar seção") */
const _previewCache = new Map();          // typeId -> svg string (é estático)
function typePreviewSVG(typeId) {
  if (_previewCache.has(typeId)) return _previewCache.get(typeId);
  const svg = buildTypePreviewSVG(typeId);
  _previewCache.set(typeId, svg);
  return svg;
}
function buildTypePreviewSVG(typeId) {
  const W = 52, H = 68;
  const pen = SvgPen(W, H, { bg: '#fff' });
  const box = { x: 5, y: 5, w: W - 10, h: H - 10, recto: true };
  const ink = '#33403b', paper = '#fff';
  // cores mais fortes: numa miniatura, o traço fino real fica invisível
  const ctx = {
    S: { ...DEFAULTS, paperBg: paper },
    ink, faint: mixHex(ink, paper, 0.42), hair: mixHex(ink, paper, 0.58), accent: '#a97f3d',
    date: new Date(DEFAULTS.year, 6, 5), date2: new Date(DEFAULTS.year, 6, 6),
    weekStart: 'mon', indexInSection: 0, pageIndex: 0, isRight: true,
  };
  const o = { ...(PAGE_TYPES[typeId] && PAGE_TYPES[typeId].defaults) };
  if ('header' in o) o.header = false;
  if ('title' in o) o.title = '';
  // padrões básicos: espessura/passo exagerados para ficarem legíveis na miniatura
  const bump = { dot: { spacing: box.w / 7, dotSize: 0.55 }, grid: { spacing: box.w / 7, lineW: 0.3 },
    graph5: { spacing: box.w / 14, lineW: 0.2 }, lined: { spacing: box.h / 9, lineW: 0.4 },
    linedNarrow: { spacing: box.h / 11, lineW: 0.35 }, isometric: { spacing: box.w / 7, lineW: 0.25 },
    handwriting: { spacing: box.h / 5 }, music: { staves: 5 },
    ruledDouble: { spacing: box.h / 7, gap: box.h / 22, lineW: 0.4, intensity: 0.6 },
    seyes: { spacing: box.h / 8, subs: 3, intensity: 0.7 },
    penmanship: { spacing: box.h / 4.5, lineW: 0.4, intensity: 0.7 },
    ledger: { spacing: box.h / 9, cols: 3, lineW: 0.35, intensity: 0.6 } };
  Object.assign(o, bump[typeId] || {});
  pen.rect(0.5, 0.5, W - 1, H - 1, { fill: '#fff', stroke: '#e2ddd2', w: 0.6 });
  pen.clip(box.x, box.y, box.w, box.h);
  try { (PAGE_DRAW[typeId] || PAGE_DRAW.blank)(pen, box, o, ctx); } catch (e) {}
  pen.unclip();
  return pen.svg();
}

/* ================= render da tela (janela) ================= */
function pageSig(idx, pd) {
  const s = state.settings;
  return [idx, pd.type, pd.filler ? 'F' : '', cheapOptsSig(pd.opts), pd.title || '', pd.date ? +pd.date : 0, pd.date2 ? +pd.date2 : 0,
    JSON.stringify(s.labels || {}),
    s.paper, s.landscape, s.binding, s.marginInner, s.marginOuter, s.marginTop, s.marginBottom,
    s.mirrorMargins, s.ink, s.accent, s.paperBg, s.lineWeight,
    s.pageNumber, s.pageNumberStart, s.pageNumberSkip, s.pageNumberTotal, s.pageNumberPrefix, s.pageNumberSize,
    s.showPunch, s.showSafeGuide, s.highlightWeekends, s.footerText, s.headingFont,
    s.year, s.startDate, s.weekStart, s.customW, s.customH].join('|');
}
function buildSVG(idx, pd, total) {
  const [W, H] = paperWH();
  const pen = SvgPen(W, H, { bg: state.settings.paperBg });
  drawPageInto(pen, pd, idx, { screen: true, total: total });
  return pen.svg();
}
// render coalescido: chamadas em rajada (arrastar slider) viram 1 por frame
let _rafR = 0;
function rafRender() { if (!_rafR) _rafR = requestAnimationFrame(() => { _rafR = 0; render(); }); }
// idem, mas revalidando o documento (para sliders que mexem em settings)
let _rafD = 0;
function rafDocRender() {
  if (_rafD) return;
  _rafD = requestAnimationFrame(() => { _rafD = 0; state.settings = migrate(state).settings; svgCache.clear(); render(); save(); });
}
function render() {
  const s = state.settings, [W, H] = paperWH();
  const pages = expand();
  currentPage = clamp(currentPage, 0, Math.max(0, pages.length - 1));
  sheetsEl.style.setProperty('--pw', W + 'mm');
  sheetsEl.style.setProperty('--ph', H + 'mm');
  sheetsEl.innerHTML = '';
  for (let i = 0; i < pages.length; i++) {
    const d = document.createElement('div');
    d.className = 'page'; d.dataset.idx = i;
    d.style.width = W + 'mm'; d.style.height = H + 'mm';
    sheetsEl.appendChild(d);
  }
  $('#empty').hidden = pages.length > 0;
  refreshWindow(true);
  applyZoom();
  const sec = curSection();
  $('#stat').textContent = `${state.sections.length} seção(ões) · ${pages.length} página(s) · ${W.toFixed(0)}×${H.toFixed(0)} mm`
    + (sec ? ` · seção: ${PAGE_TYPES[sec.type].label}` : '');
  $('#pageLbl').textContent = `${currentPage + 1} / ${Math.max(1, pages.length)}`;
  { const mpg = $('#mpg'); if (mpg) mpg.textContent = pages.length > 1 ? `Pág. ${currentPage + 1}/${pages.length}` : ''; }
  renderSectionList();
  updateHistoryButtons();
  if (typeof mSync === 'function') mSync();
}
function refreshWindow(force) {
  const pages = expand();
  const total = pages.length;
  const kids = sheetsEl.children;
  // se o DOM ficou à frente do modelo (edição muito rápida), re-render e sai
  if (kids.length !== total) { render(); return; }
  for (let i = 0; i < kids.length; i++) {
    const near = Math.abs(i - currentPage) <= WINDOW;
    const el = kids[i];
    if (near) {
      const sig = pageSig(i, pages[i]) + '|' + total;
      if (force || el.dataset.sig !== sig) {
        el.innerHTML = buildSVG(i, pages[i], total);
        el.dataset.sig = sig;
        const secId = pages[i].sectionId;
        el.classList.toggle('inSel', secId === selId);
      }
    } else if (el.dataset.sig) {
      el.innerHTML = ''; delete el.dataset.sig;
    }
  }
}

/* ================= seleção de seção ================= */
function curSection() { return state.sections.find(x => x.id === selId) || null; }
function selectSection(id, opts = {}) {
  selId = state.sections.some(x => x.id === id) ? id : null;
  renderSectionList();
  fillRight();
  $$('.page', sheetsEl).forEach(p => p.classList.remove('inSel'));
  const pages = expand();
  $$('.page', sheetsEl).forEach((p, i) => { if (pages[i] && pages[i].sectionId === selId) p.classList.add('inSel'); });
  if (selId && !opts.noScroll) {
    const first = pages.findIndex(p => p.sectionId === selId);
    if (first >= 0) gotoPage(first);
  }
  // No celular, escolher uma seção na LISTA abre a aba "Seção" com as opções.
  // Mas tocar numa PÁGINA (opts.fromPage) mantém você nas Páginas — assim o
  // 2º toque abre o editor de texto ali mesmo, estilo Canva.
  const mob = matchMedia('(max-width:820px)').matches;
  if (mob && selId && !opts.fromPage && typeof mOpenTab === 'function') mOpenTab('secao');
}

/* ================= zoom / navegação ================= */
function applyZoom() { sheetsEl.style.zoom = zoom; $('#zval').textContent = Math.round(zoom * 100) + '%'; }
function fit() {
  const [W, H] = paperWH();
  const cs = getComputedStyle(stage);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const zw = (stage.clientWidth - padX - 24) / (W * MM);
  const zh = (stage.clientHeight - padY - 24) / (H * MM);
  zoom = clamp(Math.min(zw, zh * 1.02), .08, 2.4); userZoomed = false; applyZoom();
}
function zoomAt(cx, cy, factor) {
  const z0 = zoom, z1 = clamp(z0 * factor, .08, 3);
  if (z1 === z0) return;
  const r = stage.getBoundingClientRect();
  const px = stage.scrollLeft + (cx - r.left), py = stage.scrollTop + (cy - r.top);
  userZoomed = true; zoom = z1; applyZoom();
  stage.scrollLeft = px * (z1 / z0) - (cx - r.left);
  stage.scrollTop = py * (z1 / z0) - (cy - r.top);
}
function gotoPage(i) {
  const n = pageCount();
  currentPage = clamp(i, 0, Math.max(0, n - 1));
  $('#pageLbl').textContent = `${currentPage + 1} / ${Math.max(1, n)}`;
  refreshWindow(false);
  const pg = sheetsEl.children[currentPage];
  if (pg) pg.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/* ================= histórico ================= */
let past = [], future = [], lastKey = '', lastTime = 0;
const snap = () => JSON.stringify(state);
function pushHistory(key) {
  const now = Date.now();
  if (key && key === lastKey && now - lastTime < 600) { lastTime = now; return; }
  lastKey = key || ''; lastTime = now;
  past.push(snap()); if (past.length > 60) past.shift(); future.length = 0;
  updateHistoryButtons();
}
function applySnap(str) {
  state = migrate(JSON.parse(str));
  if (!state.sections.some(s => s.id === selId)) selId = null;
  svgCache.clear();
  syncDocControls(); render(); save();
}
function undo() { if (!past.length) return; future.push(snap()); applySnap(past.pop()); toast('Desfeito'); }
function redo() { if (!future.length) return; past.push(snap()); applySnap(future.pop()); }
function updateHistoryButtons() {
  const set = (id, on) => { const e = $(id); if (e) e.disabled = !on; };
  set('#b_undo', past.length); set('#b_redo', future.length);
  set('#mu_undo', past.length); set('#mu_redo', future.length);
}
function mutate(key, fn) { pushHistory(key); fn(); render(); save(); }

/* ================= mutações de seção ================= */
function addSection(type, at) {
  const T = PAGE_TYPES[type]; if (!T) return;
  const sec = { id: uid(), type, count: T.repeat ? (T.id === 'dot' ? 40 : 20) : 1, opts: {} };
  (T.fields || []).forEach(f => sec.opts[f.k] = f.def);
  if (!T.repeat) sec.count = 1;
  if (['dot', 'grid', 'lined', 'linedNarrow', 'blank', 'ruledDouble', 'seyes', 'penmanship', 'ledger', 'graph5', 'isometric'].includes(type)) sec.count = 40;
  if (['prose', 'project', 'quote', 'tracker', 'sleepLog', 'finance'].includes(type)) sec.count = 1;   // 1 pág.; "itens" multiplica
  mutate('addSection', () => {
    const i = (at == null) ? state.sections.length : at;
    state.sections.splice(i, 0, sec);
    selId = sec.id;
  });
  selectSection(sec.id);
}
function removeSection(id) {
  mutate('removeSection', () => {
    state.sections = state.sections.filter(s => s.id !== id);
    if (selId === id) selId = null;
  });
}
// troca o TIPO de página da seção, preservando o que faz sentido
function changeSectionType(id, type) {
  const T = PAGE_TYPES[type]; if (!T) return;
  const sec = state.sections.find(s => s.id === id); if (!sec || sec.type === type) return;
  mutate('changeSectionType', () => {
    const keep = {};
    ['ink', 'breakBefore', 'footer', 'items', 'title'].forEach(k => { if (sec.opts[k] != null) keep[k] = sec.opts[k]; });
    sec.type = type;
    sec.opts = {};
    (T.fields || []).forEach(f => { sec.opts[f.k] = f.def; });
    Object.keys(keep).forEach(k => {
      // só devolve title/items se o novo tipo tiver esse campo (ink/breakBefore/footer são universais)
      if (k === 'ink' || k === 'breakBefore' || k === 'footer' || (T.fields || []).some(f => f.k === k)) sec.opts[k] = keep[k];
    });
    if (!T.repeat) sec.count = 1;
    else sec.count = clamp(sec.count || 20, 1, 600);
  });
  selectSection(id, { noScroll: true });
}
function dupSection(id) {
  const i = state.sections.findIndex(s => s.id === id); if (i < 0) return;
  mutate('dupSection', () => {
    const c = JSON.parse(JSON.stringify(state.sections[i])); c.id = uid();
    state.sections.splice(i + 1, 0, c); selId = c.id;
  });
  selectSection(selId);
}
function moveSection(id, dir) {
  const i = state.sections.findIndex(s => s.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= state.sections.length) return;
  mutate('moveSection', () => { [state.sections[i], state.sections[j]] = [state.sections[j], state.sections[i]]; });
}
function reorderSection(fromId, toId) {
  const from = state.sections.findIndex(s => s.id === fromId), to = state.sections.findIndex(s => s.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  mutate('reorderSection', () => { const [m] = state.sections.splice(from, 1); state.sections.splice(to, 0, m); });
}
function setSectionCount(id, n) {
  const s = state.sections.find(x => x.id === id); if (!s) return;
  mutate('count', () => { s.count = clamp(Math.round(n), 1, 600); });
}
function setSectionOpt(id, k, v) {
  const s = state.sections.find(x => x.id === id); if (!s) return;
  pushHistory('opt-' + k);
  s.opts[k] = v; render(); save();
}
function newDoc(preset) {
  state = migrate({ settings: { ...DEFAULTS, ...(preset && preset.settings || {}) }, sections: (preset && preset.sections || []) });
  selId = state.sections[0] ? state.sections[0].id : null;
  past = []; future = []; svgCache.clear(); currentPage = 0;
  syncDocControls(); render(); save(); fit();
}

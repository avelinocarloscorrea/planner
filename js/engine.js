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
  s.acrylic = s.acrylic !== false;
  s.bleedMm = clamp(num(s.bleedMm, 0), 0, 10);
  s.cropMarks = !!s.cropMarks;
  s.registration = !!s.registration;       // alvos de registro junto das marcas de corte
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
  delete s.headerShow;                       // era gravado mas nada desenhava (A17)
  s.highlightWeekends = s.highlightWeekends !== false;
  s.year = clamp(Math.round(num(s.year, DEFAULTS.year)), 1900, 2200);
  s.startDate = parseYMD(s.startDate) ? String(s.startDate).trim() : '';
  s.weekStart = s.weekStart === 'sun' ? 'sun' : 'mon';
  s.footerText = sanitizeText(s.footerText, 80);
  // datas especiais (feriados + eventos)
  s.holUF = (typeof EPDates !== 'undefined' && EPDates.UFS.includes(String(s.holUF || '').toUpperCase()))
    ? String(s.holUF).toUpperCase() : '';
  s.holNacional = s.holNacional !== false;
  s.holFacultativo = !!s.holFacultativo;
  s.holComemorativa = !!s.holComemorativa;
  s.events = sanitizeText(s.events, 8000);
  s.bindPaperGsm = clamp(Math.round(num(s.bindPaperGsm, 75)), 40, 400);
  s.bindPaperKind = ['offset', 'polen', 'couche', 'reciclado'].includes(s.bindPaperKind) ? s.bindPaperKind : 'offset';
  // compat: modos antigos 'a4'/'letter' viram 'fit' + folha correspondente
  if (s.exportMode === 'a4') { s.exportMode = 'fit'; if (!s.sheet) s.sheet = 'a4'; }
  else if (s.exportMode === 'letter') { s.exportMode = 'fit'; if (!s.sheet) s.sheet = 'letter'; }
  s.exportMode = ['auto', 'real', 'fit', '2up', 'booklet'].includes(s.exportMode) ? s.exportMode : 'real';
  s.sheet = ['a4', 'letter', 'a3'].includes(s.sheet) ? s.sheet : 'a4';
  s.twoUpOrder = ['seq', 'duplex'].includes(s.twoUpOrder) ? s.twoUpOrder : 'stack';
  s.headingFont = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families[s.headingFont]) ? s.headingFont : 'sans';
  // saída: cor do PDF, escala do 2 por folha, virada do duplex, creep do livreto, economia de tinta
  s.monthTabs = !!s.monthTabs;
  s.exportPart = ['all', 'cover', 'body'].includes(s.exportPart) ? s.exportPart : 'all';
  s.pdfColor = s.pdfColor === 'cmyk' ? 'cmyk' : 'rgb';
  s.twoUpFit = s.twoUpFit === 'shrink' ? 'shrink' : 'exact';
  s.duplexFlip = s.duplexFlip === 'long' ? 'long' : 'short';
  s.bookletCreep = s.bookletCreep !== false;
  s.inkSave = clamp(Math.round(num(s.inkSave, 0)), 0, 60);
  s.safeMm = clamp(num(s.safeMm, 4), 0, 15);
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
    sec.count = T.repeat ? clamp(Math.round(num(raw.count, 1)), 1, 2000) : 1;
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
      // campos de imagem com editor (packages/core/imgedit.js): preserva a
      // fonte original + os parâmetros de ajuste, pra poder reenquadrar sem
      // perder qualidade de novo. Sem isso, migrate() (chamado a cada commit)
      // apagaria essas 2 chaves por não estarem na lista de `fields`.
      if (f.type === 'image' && f.editAspect) {
        const srcKey = f.k + 'Src', editKey = f.k + 'Edit';
        sec.opts[srcKey] = (typeof src[srcKey] === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src[srcKey]) && src[srcKey].length < 6e6) ? src[srcKey] : '';
        sec.opts[editKey] = (src[editKey] && typeof src[editKey] === 'object' && typeof EPImgEdit !== 'undefined' && EPImgEdit.normEdit) ? EPImgEdit.normEdit(src[editKey]) : null;
      }
    });
    if (src.ink && HEX.test(src.ink)) sec.opts.ink = src.ink;
    if (src.breakBefore) sec.opts.breakBefore = true;
    if (typeof src.footer === 'string' && src.footer.trim()) sec.opts.footer = sanitizeText(src.footer, 80);
    // edição na folha: ajustes por elemento e textos/imagens livres (validados — vêm de arquivo/localStorage)
    if (src.el && typeof src.el === 'object') {
      const el = {};
      Object.keys(src.el).slice(0, 80).forEach(k => {
        if (!/^(title|subtitle|owner|logo|monogram|year|text|author|x:[A-Za-z0-9_-]{1,24})$/.test(k)) return;
        const e = src.el[k] && typeof src.el[k] === 'object' ? src.el[k] : {}, v = {};
        ['dx', 'dy'].forEach(q => { if (e[q] != null && isFinite(+e[q])) v[q] = clamp(+e[q], -800, 800); });
        if (e.s != null && isFinite(+e.s)) v.s = clamp(+e.s, 0.25, 5);
        if (HEX.test(e.color || '')) v.color = e.color;
        if (typeof e.fam === 'string' && /^[A-Za-z]{2,24}$/.test(e.fam)) v.fam = e.fam;
        if (e.bold != null) v.bold = !!e.bold;
        if (e.hide) v.hide = true;
        el[k] = v;
      });
      sec.opts.el = el;
    }
    if (Array.isArray(src.extras)) {
      sec.opts.extras = src.extras.slice(0, 40).map(x => {
        x = x && typeof x === 'object' ? x : {};
        const img = x.type === 'image';
        return { id: /^[A-Za-z0-9_-]{1,24}$/.test(x.id || '') ? x.id : uid(), type: img ? 'image' : 'text',
          text: img ? '' : sanitizeText(x.text || '', 400),
          src: img && typeof x.src === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x.src) && x.src.length < 5e6 ? x.src : '' };
      }).filter(x => x.type === 'text' || x.src);
    }
    // página personalizada: valida/migra a grade de blocos (schema versionado)
    if (raw.type === 'custom') {
      sec.opts.layout = (typeof EPBlocks !== 'undefined')
        ? EPBlocks.validateLayout(src.layout || sec.opts.layout)
        : (src.layout && typeof src.layout === 'object' ? src.layout : null);
    }
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
// decide sozinho a montagem (real | fit) quando settings.exportMode==='auto'
// (padrão): se o papel escolhido já É uma folha A4 inteira, tamanho real
// (nada pra cortar); se CABE dentro de uma A4 (A5, A6, pocket, meia carta…),
// centraliza numa A4 com marcas de corte — pronto pra imprimir em casa e
// cortar; maior que A4 (A4 mesmo, A3, carta larga…), tamanho real (gráfica).
// '2up'/'booklet' continuam só manuais — não fazem parte desta decisão.
function fitsWithinA4(w, h) { return (w <= 210.5 && h <= 297.5) || (w <= 297.5 && h <= 210.5); }
function isFullSheetWH(w, h, sw, sh) { return (Math.abs(w - sw) < 0.5 && Math.abs(h - sh) < 0.5) || (Math.abs(w - sh) < 0.5 && Math.abs(h - sw) < 0.5); }
// Duas páginas do miolo cabem lado a lado numa A4 aproveitando pelo menos
// 85% da folha (ex.: A5 é literalmente a metade de uma A4)? Usa a MESMA
// geometria de impositionPlan (cols/rows por orientação) para decidir.
function fits2upEfficiently(w, h, sw, sh) {
  const portrait = h >= w;
  const bw = portrait ? Math.max(sw, sh) : Math.min(sw, sh);
  const bh = portrait ? Math.min(sw, sh) : Math.max(sw, sh);
  const cols = portrait ? 2 : 1, rows = portrait ? 1 : 2;
  if (cols * w > bw + 0.5 || rows * h > bh + 0.5) return false;
  return (cols * w * rows * h) / (bw * bh) >= 0.85;
}
function effectiveExportMode() {
  const s = state.settings;
  if (s.exportMode !== 'auto') return { mode: s.exportMode, sheet: s.sheet, auto: false };
  const [W, H] = paperWH();
  if (isFullSheetWH(W, H, 210, 297)) return { mode: 'real', sheet: s.sheet, auto: true };
  if (fits2upEfficiently(W, H, 210, 297)) return { mode: '2up', sheet: 'a4', auto: true };
  if (fitsWithinA4(W, H)) return { mode: 'fit', sheet: 'a4', auto: true };
  return { mode: 'real', sheet: s.sheet, auto: true };
}
// caixa útil da página `idx` (0-based). recto = página ímpar = índice par.
//
// Lombada/furo: numa folha impressa FRENTE E VERSO, a lombada fica à esquerda
// na frente e à DIREITA no verso (é a mesma borda física vista do outro lado).
// Isso vale para qualquer encadernação — colada, costurada, espiral, wire-o,
// discos ou fichário. Só quando cada página ocupa uma folha própria impressa
// de um lado só é que a lombada fica sempre à esquerda. (outputDuplex, io.js)
const PUNCH_SPEC = { spiral: 'coil41', wireo: 'wireo31', disc: 'disc', ring6: 'ring6', ring2: 'ring2' };
function bindingSideOf(idx) {
  return EPPrint.bindingSide(idx, { duplex: typeof outputDuplex === 'function' ? outputDuplex() : !!state.settings.mirrorMargins });
}
function bindingInner() {
  const s = state.settings, bind = BINDINGS[s.binding];
  const innerAdd = bind ? bind.innerAdd : 0;
  // nunca menos que a zona de furação da norma + 3 mm de segurança
  const spec = bind && bind.punch && PUNCH_SPEC[bind.punch];
  return Math.max(s.marginInner + innerAdd, spec ? EPPrint.bindingMargin(spec) : 0);
}
function contentBox(idx) {
  const s = state.settings, [W, H] = paperWH();
  const recto = (idx % 2 === 0);
  const inner = bindingInner();
  const side = bindingSideOf(idx);
  const left = side === 'left' ? inner : s.marginOuter;
  const right = side === 'right' ? inner : s.marginOuter;
  return {
    x: left, y: s.marginTop,
    w: Math.max(20, W - left - right),
    h: Math.max(20, H - s.marginTop - s.marginBottom),
    recto, bindSide: side,
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
    let v = o[k];
    if (v && typeof v === 'object') v = JSON.stringify(v, (kk, vv) => typeof vv === 'string' && vv.length > 160 ? 'L' + vv.length + vv.slice(-24) : vv);
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
// início do documento: data inicial (ano letivo, fiscal…) ou 1º de janeiro do ano
function docStart() { const s = state.settings; return parseYMD(s.startDate) || new Date(s.year, 0, 1); }
// mês 1–12 dentro dos 12 meses do documento (ago 2026 → jul 2027): meses antes
// do mês inicial caem no ano seguinte. (A6)
function monthInSpan(m) {
  const st = docStart();
  return new Date(st.getFullYear() + (m - 1 < st.getMonth() ? 1 : 0), m - 1, 1);
}
function expandCompute() {
  const s = state.settings;
  const pages = [];
  let cursor = docStart();
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
    // "Página personalizada" replica os modos datados via opts.dating
    const datedMode = T.dated ||
      (sec.type === 'custom' && ['day', 'week', 'month'].includes(opts.dating) ? opts.dating : null);
    // início explícito da seção (data ou mês) sobrepõe o encadeamento automático
    const explicit = parseYMD(opts.startDate);
    if (explicit) cursor = explicit;
    else if (datedMode === 'month' && opts.month && +opts.month >= 1 && +opts.month <= 12) cursor = monthInSpan(+opts.month);
    if (datedMode === 'month') {
      const baseM = cursor.getMonth(), baseY = cursor.getFullYear();
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: new Date(baseY, baseM + k, 1) });
      cursor = new Date(baseY, baseM + cnt, 1);
    } else if (datedMode === 'week') {
      const w0 = startOfWeek(cursor, opts.weekStart || s.weekStart);
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: addDays(w0, k * 7) });
      cursor = addDays(w0, cnt * 7);
    } else if (datedMode === 'day') {
      for (let k = 0; k < cnt; k++) push({ type: sec.type, opts, sectionId: sec.id, si, k, date: addDays(cursor, k) });
      cursor = addDays(cursor, cnt);
    } else if (T.dated === 'weekSpread') {
      // semana aberta: esquerda (verso) + direita (recto). A esquerda precisa cair
      // numa página par (índice ímpar) — senão a semana fica frente/verso da mesma folha.
      if (pages.length % 2 === 0) pages.push({ type: 'blank', opts: { header: false }, sectionId: sec.id, si, k: 0, date: null, filler: true });
      const w0 = startOfWeek(cursor, opts.weekStart || s.weekStart);
      for (let k = 0; k < cnt; k++) {
        const d = addDays(w0, k * 7);
        push({ type: sec.type, opts, sectionId: sec.id, si, k, date: d, half: 'L' });
        pages.push({ type: sec.type, opts, sectionId: sec.id, si, k, date: d, half: 'R' });
      }
      cursor = addDays(w0, cnt * 7);
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
// Guia de furação pela norma (EPPrint.BINDING_SPECS): passo real (wire-o 3:1 =
// 8,47 mm, espiral 4:1 = 6,35 mm, fichário ISO 838 = 80 mm), fileira
// centralizada na altura, centro do furo à distância padrão da borda da
// lombada — que troca de lado no verso (bindingSideOf).
function drawPunch(pen, W, H, idx, kind, forPrint) {
  const b = BINDINGS[kind]; if (!b || !b.punch) return;
  const spec = PUNCH_SPEC[b.punch]; if (!spec) return;
  const side = bindingSideOf(idx);
  const style = forPrint ? { stroke: '#000000', w: 0.15 } : { stroke: '#c4b9a6', w: 0.3 };
  EPPrint.holes(spec, H).forEach(h => {
    const cx = side === 'right' ? W - h.edge : h.edge, cy = h.t;
    if (h.shape === 'rect') pen.rect(cx - h.w / 2, cy - h.h / 2, h.w, h.h, style);
    else if (h.shape === 'disc') {
      // disco (cogumelo): furo + canal até a borda
      pen.circle(cx, cy, h.r, style);
      const ex = side === 'right' ? W : 0, dir = side === 'right' ? 1 : -1;
      pen.line(cx + dir * h.r * 0.2, cy - h.r * 0.55, ex, cy - h.r * 0.55, style.stroke ? { color: style.stroke, w: style.w } : {});
      pen.line(cx + dir * h.r * 0.2, cy + h.r * 0.55, ex, cy + h.r * 0.55, { color: style.stroke, w: style.w });
    } else pen.circle(cx, cy, h.r, style);
  });
}
function parseVarFields(txt) {
  const out = {};
  String(txt || '').split('\n').forEach(l => {
    const m = /^\s*([^:\n]{1,40}?)\s*:\s*(.{1,120}?)\s*$/.exec(l);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

/* ---- marcas do documento: feriados (por opções) + eventos do usuário ----
   Memoizado por assinatura das opções relevantes. markOn(date) -> nome | null. */
let _marksMemo = { sig: '\0', fn: () => null };
function docMarks() {
  const s = state.settings;
  const sig = [s.year, s.holUF, s.holNacional, s.holFacultativo, s.holComemorativa, s.events].join('|');
  if (sig === _marksMemo.sig) return _marksMemo.fn;
  let holMap = null, evIndex = null;
  if (typeof EPDates !== 'undefined') {
    if (s.holNacional || s.holUF || s.holFacultativo || s.holComemorativa) {
      holMap = EPDates.holidayMap(s.year - 1, s.year + 1, {
        uf: s.holUF || null,
        includeOptional: !!s.holFacultativo,
        includeCommemorative: !!s.holComemorativa,
      });
      // quando o usuário NÃO quer os nacionais, remove os de tipo 'nacional'
      if (!s.holNacional) {
        for (let y = s.year - 1; y <= s.year + 1; y++) {
          EPDates.holidaysForYear(y, { uf: s.holUF || null, includeOptional: !!s.holFacultativo, includeCommemorative: !!s.holComemorativa })
            .forEach(h => { if (h.type === 'nacional' && holMap[h.ymd]) { holMap[h.ymd] = holMap[h.ymd].filter(n => n !== h.name); if (!holMap[h.ymd].length) delete holMap[h.ymd]; } });
        }
      }
    }
    if (s.events && s.events.trim()) evIndex = EPDates.indexEvents(EPDates.parseEvents(s.events));
  }
  const ymdOf = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  const holiday = dt => { if (!dt || !holMap) return null; const a = holMap[ymdOf(dt)]; return a && a.length ? a.join(' · ') : null; };
  const event = dt => { if (!dt || !evIndex) return null; const a = evIndex.on(dt); return a.length ? a.join(' · ') : null; };
  const fn = (dt) => { const h = holiday(dt), e = event(dt); return [h, e].filter(Boolean).join(' · ') || null; };
  fn.holiday = holiday; fn.event = event;
  _marksMemo = { sig, fn };
  return fn;
}
function pageCtx(pd) {
  const s = state.settings;
  const sec = state.sections.find(x => x.id === pd.sectionId);
  const ink = (sec && sec.opts && sec.opts.ink && HEX.test(sec.opts.ink)) ? sec.opts.ink : s.ink;
  const lw = s.lineWeight || 1;
  const mk = docMarks();
  const cov = state.sections.find(x => x.type === 'cover');
  const varOwner = (sec && sec.opts && sec.opts.owner) ? String(sec.opts.owner)
    : (cov && cov.opts && cov.opts.owner ? String(cov.opts.owner) : '');
  const varSection = (sec && sec.opts && typeof sec.opts.title === 'string' && sec.opts.title.trim())
    ? sec.opts.title.trim()
    : (PAGE_TYPES[pd.type] ? PAGE_TYPES[pd.type].label : '');
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
    yearStart: docStart(),         // início dos 12 meses (visão anual, metas…)
    half: pd.half,                 // semana em duas páginas: 'L' | 'R'
    toc: tocEntries,               // sumário automático (lazy)
    // contexto das variáveis dinâmicas dos blocos ({pagina}, {secao}, {nome_dono}, {campo:x})
    varPage: (pd.pageIndexGlobal || 0) + 1,
    varSection: varSection,
    varOwner: varOwner,
    varFields: parseVarFields(sec && sec.opts && sec.opts.varFields),
    // datas especiais do documento
    markOn: mk,
    markHoliday: pd.date ? mk.holiday(pd.date) : null,
    markEvent: pd.date ? mk.event(pd.date) : null,
  };
}
// sumário: primeira página de cada seção, com o número impresso
let _tocMemo = { sig: '\0', list: [] };
function tocEntries() {
  const s = state.settings, sig = expandSig() + '|' + s.pageNumberStart + '|' + s.pageNumberSkip;
  if (sig === _tocMemo.sig) return _tocMemo.list;
  const list = [], seen = new Set();
  expand().forEach((pd, idx) => {
    if (pd.filler || seen.has(pd.sectionId) || pd.type === 'toc' || pd.type === 'cover') return;
    seen.add(pd.sectionId);
    const sec = state.sections.find(x => x.id === pd.sectionId);
    const t = (sec && sec.opts && typeof sec.opts.title === 'string' && sec.opts.title.trim()) || (PAGE_TYPES[pd.type] ? PAGE_TYPES[pd.type].label : '');
    const n = s.pageNumberStart + idx - s.pageNumberSkip;
    list.push({ title: t, page: idx >= s.pageNumberSkip && n >= 0 ? n : null, idx });
  });
  _tocMemo = { sig, list };
  return list;
}
// abas laterais por mês, na borda externa (sangram até o corte)
function drawMonthTabs(pen, W, H, idx, pd, ctx, bleed) {
  if (!pd.date || pd.filler) return;
  const s = state.settings, side = bindingSideOf(idx) === 'right' ? 'left' : 'right';
  const tabW = clamp(s.marginOuter * 0.55, 4, 8), top = s.marginTop, h = (H - s.marginTop - s.marginBottom) / 12;
  const span = ctx.yearStart || new Date(s.year, 0, 1);
  const cur = (pd.date.getFullYear() - span.getFullYear()) * 12 + pd.date.getMonth() - span.getMonth();
  if (cur < 0 || cur > 11) return;
  for (let k = 0; k < 12; k++) {
    const m = (span.getMonth() + k) % 12, on = k === cur, y = top + k * h;
    const x = side === 'right' ? W - tabW : -bleed, w = tabW + bleed;
    pen.rect(x, y + 0.3, w, h - 0.6, { fill: on ? s.accent : mixHex(s.accent, s.paperBg, 0.86) });
    const tx = side === 'right' ? W - tabW / 2 : tabW / 2;
    pen.text(MONTHS_PT[m].slice(0, 3).toUpperCase(), tx, y + h / 2, { size: clamp(tabW * 0.62, 3, 5.2), font: 'bold', color: on ? s.paperBg : mixHex(s.ink, s.paperBg, 0.35), align: 'c', baseline: 'middle' });
  }
}
function drawPageInto(pen, pd, idx, opt = {}) {
  const s = state.settings, [W, H] = paperWH();
  if (pen.setLineScale) pen.setLineScale(s.lineWeight || 1);
  const o = { ...PAGE_TYPES[pd.type].defaults, ...pd.opts };
  // título por página (vindo de "um item por linha") sobrepõe o da seção
  if (pd.title != null && pd.title !== '') o.title = pd.title;
  const ctx = pageCtx({ ...pd, pageIndexGlobal: idx });
  ctx.pageW = W; ctx.pageH = H; ctx.bleed = Math.max(0, +opt.bleed || 0);
  if (opt.hits) ctx.hits = opt.hits;              // edição na folha: caixas dos elementos
  // Capa e divisória usam uma caixa CENTRADA na página (ignoram o desvio da
  // lombada), pra não ficarem tortas. Os demais tipos usam a área útil real.
  const isFull = pd.type === 'cover' || pd.type === 'tab' || pd.type === 'calibration';
  const mo = Math.min(s.marginOuter, s.marginTop);
  // capa/divisória: caixa centrada na área que sobra DEPOIS da zona de lombada/furo
  // (antes ignorava a encadernação e o título podia cair nos furos — A3)
  let box;
  if (isFull) {
    const bind = BINDINGS[s.binding], side = bindingSideOf(idx);
    const zone = bind && bind.innerAdd ? bindingInner() : 0;
    const l = side === 'left' ? Math.max(mo, zone) : mo, r = side === 'right' ? Math.max(mo, zone) : mo;
    box = { x: l, y: s.marginTop, w: Math.max(20, W - l - r), h: Math.max(20, H - s.marginTop - s.marginBottom), recto: (idx % 2 === 0), bindSide: side };
  } else box = contentBox(idx);

  // furos (na margem, fora do recorte)
  if ((opt.screen && s.showPunch) || (!opt.screen && s.printPunch)) drawPunch(pen, W, H, idx, s.binding, !opt.screen);

  // "Data automática": cabeçalho com o dia da semana + data, cede o resto à escrita
  if (pd.autoDated && pd.date && !isFull) {
    const dd = pd.date;
    pen.text(DOW_PT[dd.getDay()], box.x, box.y, { size: 10, font: 'bold', color: ctx.ink, baseline: 'top', family: ctx.hfam });
    pen.text(dd.getDate() + ' ' + MONTHS_PT[dd.getMonth()].toLowerCase() + ' ' + dd.getFullYear(), box.x + box.w, box.y + 1.5, { size: 8, color: ctx.faint, align: 'r', baseline: 'top' });
    pen.line(box.x, box.y + 8, box.x + box.w, box.y + 8, { w: 0.4, color: ctx.ink });
    box = { x: box.x, y: box.y + 11, w: box.w, h: box.h - 11, recto: box.recto };
  }

  if (s.monthTabs) drawMonthTabs(pen, W, H, idx, pd, ctx, Math.max(0, +opt.bleed || 0));

  // conteúdo do tipo — SEMPRE recortado: nada escapa da página.
  // folga de 0,5 mm no recorte da área útil: molduras e as linhas de tabela que
  // encostam na borda da caixa não saem cortadas ao meio (some contra a margem).
  const CP = 0.5;
  // capa/divisória: recorte na página inteira (+ sangria no modo gráfica),
  // pra fundos de cor e imagem chegarem até a borda do corte.
  const clipBox = isFull
    ? { x: -ctx.bleed, y: -ctx.bleed, w: W + 2 * ctx.bleed, h: H + 2 * ctx.bleed }
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
  const outerRight = bindingSideOf(idx) !== 'right';   // lado externo = oposto à lombada
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
  // marcas de corte: desenhadas na FOLHA (io.js impositionPlan), fora da sangria — A1
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
    s.year, s.startDate, s.weekStart, s.customW, s.customH,
    s.holUF, s.holNacional, s.holFacultativo, s.holComemorativa, s.events].join('|');
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
  document.body.classList.toggle('onboarding', pages.length === 0);
  refreshWindow(true);
  applyZoom();
  const sec = curSection();
  { const ps = PAGE_SIZES[s.paper]; const pl = s.paper === 'custom' ? `${W.toFixed(0)}×${H.toFixed(0)} mm` : (ps ? ps.label.split(' — ')[0].replace(/\s*\(.*\)$/, '') : '');
    $('#stat').textContent = `${pl}${s.landscape ? ' deitado' : ''} · ${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}`; }
  $('#pageLbl').textContent = `${currentPage + 1} / ${Math.max(1, pages.length)}`;
  { const mpg = $('#mpg'); if (mpg) mpg.textContent = pages.length > 1 ? `Pág. ${currentPage + 1}/${pages.length}` : ''; }
  renderSectionList();
  updateHistoryButtons();
  if (typeof updateBindHint === 'function') updateBindHint();
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
  const had = selId;
  selId = state.sections.some(x => x.id === id) ? id : null;
  renderSectionList();
  fillRight();
  // igual ao Polaroide Studio: clicar numa seção/página nova abre os
  // ajustes dela no painel direito, mesmo se o painel estava fechado.
  const mobNow = matchMedia('(max-width:820px)').matches;
  if (selId && selId !== had && !mobNow && !uiState.right && !zen) {
    if (typeof togglePanel === 'function') togglePanel('right', true); else { uiState.right = true; applyUI(); }
  }
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
function applyZoom() { sheetsEl.style.zoom = zoom; const zi = $('#zval'); if (zi && document.activeElement !== zi) zi.value = Math.round(zoom * 100); }
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
// histMeta é paralelo a `past` (mesmo índice, mesmo tamanho) — só a hora de
// cada passo, pra desenhar o histórico visual (openHistoryPop) sem duplicar
// o snapshot inteiro nem mudar a forma de `past`/`future` que undo()/redo()
// já usam.
let histMeta = [];
const snap = () => JSON.stringify(state);
function pushHistory(key) {
  const now = Date.now();
  if (key && key === lastKey && now - lastTime < 600) { lastTime = now; return; }
  lastKey = key || ''; lastTime = now;
  past.push(snap()); histMeta.push({ t: now });
  if (past.length > 60) { past.shift(); histMeta.shift(); }
  future.length = 0;
  updateHistoryButtons();
}
function applySnap(str) {
  state = migrate(JSON.parse(str));
  if (!state.sections.some(s => s.id === selId)) selId = null;
  svgCache.clear();
  syncDocControls(); render(); save();
}
function undo() { if (!past.length) return; future.push(snap()); applySnap(past.pop()); histMeta.pop(); toast('Desfeito'); }
function redo() { if (!future.length) return; past.push(snap()); histMeta.push({ t: Date.now() }); applySnap(future.pop()); }
// Volta N passos de uma vez (histórico visual) — os passos intermediários
// vão pro `future` na ordem certa, então redo() continua funcionando normal
// depois de um salto de vários passos.
function undoTo(n) {
  if (n < 1 || n > past.length) return;
  future.push(snap());
  let target;
  for (let i = 0; i < n; i++) { target = past.pop(); histMeta.pop(); if (i < n - 1) future.push(target); }
  applySnap(target);
  toast(n > 1 ? `Voltou ${n} passos.` : 'Desfeito');
}
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
  if (type === 'custom') {
    sec.count = 1;
    sec.opts.layout = (typeof EPBlocks !== 'undefined') ? EPBlocks.emptyLayout() : { schema: 1, grid: 5, blocks: [] };
  }
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
    else sec.count = clamp(sec.count || 20, 1, 2000);
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
// "Duplicar esta página específica" — achado da auditoria: só existia
// duplicar a SEÇÃO inteira. Como cada página dentro de uma seção já é gerada
// proceduralmente (mesmo tipo/opções — não há conteúdo próprio por página,
// exceto quando "opts.items" já define um título por linha), "duplicar a
// página atual" na prática é "esta seção ganha +1 página" — sem precisar
// achar a seção na lista e mexer no controle de quantidade lá.
function dupCurrentPage() {
  const p = expand()[currentPage];
  if (!p || !p.sectionId || p.filler) { toast('Esta página não pertence a uma seção que aceite duplicar.'); return; }
  const sec = state.sections.find(s => s.id === p.sectionId);
  const T = sec && PAGE_TYPES[sec.type];
  // "items" (um título por linha) e páginas DATADAS (dia/semana/mês — p.date
  // não nulo) não têm uma página igual à outra: incrementar count não copia
  // a página vista, só acrescenta a próxima data em sequência no fim da
  // seção — achado de correção, não é "duplicar", é outra coisa.
  if (!sec || !T || !T.repeat || /\S/.test(sec.opts.items || '') || p.date != null) { toast('Este tipo de página não aceita duplicar individualmente.'); return; }
  if (sec.count >= 1000) { toast('Esta seção já está no limite de 1000 páginas.'); return; }
  mutate('dupPage', () => { sec.count = clamp(sec.count + 1, 1, 1000); });
  const pages = expand();
  let last = currentPage;
  for (let i = 0; i < pages.length; i++) if (pages[i].sectionId === sec.id) last = i;
  gotoPage(last);
  toast('Página duplicada.');
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
  mutate('count', () => { s.count = clamp(Math.round(n), 1, 2000); });
}
function setSectionOpt(id, k, v) {
  const s = state.sections.find(x => x.id === id); if (!s) return;
  pushHistory('opt-' + k);
  s.opts[k] = v; render(); save();
}
function newDoc(preset) {
  state = migrate({ settings: { ...DEFAULTS, ...(preset && preset.settings || {}) }, sections: (preset && preset.sections || []) });
  selId = state.sections[0] ? state.sections[0].id : null;
  past = []; future = []; histMeta = []; svgCache.clear(); currentPage = 0;
  syncDocControls(); render(); save(); fit();
}

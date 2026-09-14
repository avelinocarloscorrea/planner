/* Planner Studio — js/pages-dates.js
   Páginas com data: visão do ano, metas do ano, calendário do mês, registro e
   hábitos do mês, semanas (vertical, horizontal, por horário), dias e as
   páginas de planejamento que dependem de datas. Mesmas convenções de
   pages.js (pen, box, o, ctx — tudo em mm).
   (parte de app; carregado depois de pages.js) */
"use strict";

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

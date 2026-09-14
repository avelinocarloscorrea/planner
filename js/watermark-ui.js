/* Planner Studio — js/watermark-ui.js
   Painel "Marca d'água" (aba Estilo): opcional, com texto, ilustração do
   catálogo ou imagem; transparência, tamanho, giro e posição. O desenho e a
   validação ficam em js/decor.js (settings.wm).
   (parte de app; carregado depois de ui.js) */
"use strict";

const WM_POS = [['center', 'Centro'], ['bottom', 'Embaixo'], ['corner', 'Canto'], ['tile', 'Repetida']];

function wmSet(patch, live) {
  if (!live) pushHistory('doc-wm');
  state.settings.wm = cleanWatermark({ ...state.settings.wm, ...patch });
  if (live) refreshWindow(true); else { svgCache.clear(); render(); }
  save();
  wmSync();
}
function wmBuild() {
  const pane = document.querySelector('.pane[data-pane="estilo"]'); if (!pane || $('#wm_block')) return;
  const box = document.createElement('div');
  box.className = 'grp-block'; box.id = 'wm_block';
  box.innerHTML = `<div class="grp-title">Marca d'água</div>
    <label class="row"><input type="checkbox" id="wm_on"> Usar marca d'água nas páginas</label>
    <div id="wm_body">
      <div class="grp" id="wm_kind" role="radiogroup" aria-label="Tipo"><button type="button" class="chip" data-k="text">Texto</button><button type="button" class="chip" data-k="art">Ilustração</button><button type="button" class="chip" data-k="image">Imagem</button></div>
      <label id="wm_textRow">Texto <input type="text" id="wm_text" maxlength="60" placeholder="ex.: seu nome ou marca"></label>
      <div id="wm_artRow" class="wm-pick"><span class="wm-pick__prev" id="wm_artPrev"></span><button type="button" id="wm_artBtn">Escolher ilustração</button></div>
      <div id="wm_imgRow" class="wm-pick"><span class="wm-pick__prev" id="wm_imgPrev"></span><button type="button" id="wm_imgBtn">Escolher imagem</button></div>
      <div class="grp" id="wm_pos">${WM_POS.map(([v, l]) => `<button type="button" class="chip" data-p="${v}">${l}</button>`).join('')}</div>
      <label>Transparência <span class="v" id="wm_opV"></span><input type="range" id="wm_op" min="3" max="60" step="1"></label>
      <div class="two">
        <label>Tamanho <span class="v" id="wm_sizeV"></span><input type="range" id="wm_size" min="30" max="300" step="5"></label>
        <label>Giro <span class="v" id="wm_rotV"></span><input type="range" id="wm_rot" min="-90" max="90" step="5"></label>
      </div>
      <label>Cor <input type="color" id="wm_color"></label>
      <label class="row"><input type="checkbox" id="wm_covers"> Também na capa, divisórias e frases</label>
    </div>`;
  const blocks = pane.querySelectorAll('.grp-block');
  (blocks[1] || blocks[0]).after(box);
  $('#wm_on').onchange = e => wmSet({ on: e.target.checked, text: state.settings.wm.text || (state.settings.wm.kind === 'text' ? 'Esmeralda Paper' : '') });
  $('#wm_kind').onclick = e => { const b = e.target.closest('[data-k]'); if (b) wmSet({ kind: b.dataset.k }); };
  $('#wm_pos').onclick = e => { const b = e.target.closest('[data-p]'); if (b) wmSet({ pos: b.dataset.p, rot: b.dataset.p === 'corner' || b.dataset.p === 'bottom' ? 0 : state.settings.wm.rot }); };
  const t = $('#wm_text'); let tBegan = false;
  t.oninput = () => { if (!tBegan) { pushHistory('doc-wm'); tBegan = true; } state.settings.wm.text = sanitizeText(t.value, 60); refreshWindow(true); save(); };
  t.onchange = () => { tBegan = false; };
  const range = (id, key, f) => {
    const el = $(id); let began = false;
    el.oninput = () => { if (!began) { pushHistory('doc-wm'); began = true; } wmSet({ [key]: f(+el.value) }, true); };
    el.onchange = () => { began = false; };
  };
  range('#wm_op', 'opacity', v => v / 100);
  range('#wm_size', 'size', v => v / 100);
  range('#wm_rot', 'rot', v => v);
  $('#wm_color').onchange = e => wmSet({ color: e.target.value });
  $('#wm_covers').onchange = e => wmSet({ covers: e.target.checked });
  $('#wm_artBtn').onclick = () => EPArtPicker.open({ title: "Ilustração da marca d'água", current: state.settings.wm.art,
    onPick: id => EPArt.ensure([id]).then(() => wmSet({ art: id, kind: 'art', on: true })) });
  $('#wm_imgBtn').onclick = () => pickImage(src => wmSet({ src, kind: 'image', on: true }));
  wmSync();
}
function wmSync() {
  if (!$('#wm_block')) return;
  const w = state.settings.wm || cleanWatermark({});
  $('#wm_on').checked = w.on;
  $('#wm_body').hidden = !w.on;
  $('#wm_kind').querySelectorAll('[data-k]').forEach(b => { b.classList.toggle('on', b.dataset.k === w.kind); b.setAttribute('aria-checked', b.dataset.k === w.kind); });
  $('#wm_pos').querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === w.pos));
  $('#wm_textRow').hidden = w.kind !== 'text';
  $('#wm_artRow').hidden = w.kind !== 'art';
  $('#wm_imgRow').hidden = w.kind !== 'image';
  if (document.activeElement !== $('#wm_text')) $('#wm_text').value = w.text;
  $('#wm_op').value = Math.round(w.opacity * 100); $('#wm_opV').textContent = Math.round(w.opacity * 100) + '%';
  $('#wm_size').value = Math.round(w.size * 100); $('#wm_sizeV').textContent = Math.round(w.size * 100) + '%';
  $('#wm_rot').value = w.rot; $('#wm_rotV').textContent = w.rot + '°';
  $('#wm_color').value = w.color || state.settings.ink;
  $('#wm_covers').checked = w.covers;
  $('#wm_artPrev').innerHTML = w.art ? EPArt.svg(w.art, w.color || state.settings.ink) : '';
  if (w.art && !EPArt.get(w.art)) EPArt.ensure([w.art]).then(wmSync);
  const ip = $('#wm_imgPrev'); ip.innerHTML = '';
  if (w.src) { const im = new Image(); im.src = w.src; im.alt = ''; ip.appendChild(im); }
}
wmBuild();
{ const _sync = syncDocControls; syncDocControls = function () { _sync.apply(this, arguments); wmSync(); }; }

/**
 * 3D Studio mode — mounts our own Three.js scene (editor/src/3d) and builds the
 * controls: insert a model/primitive, orbit, select INDIVIDUAL meshes, recolor,
 * PBR (metal/rough), rotate/scale/move. The engine makes 3D editable instead of
 * "one image". (Physics is a follow-on lane.)
 * MIT — RHOBEAR Designs (original)
 */
import { create3DScene } from '../3d/index.js';

const PRIMS = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane'];

export function createThreeMode(refs) {
  const { host, railEl, inspectorEl, fileInput, onStatus } = refs;
  let scene = null;
  const setStatus = (m) => onStatus && onStatus(m);

  function ensure() {
    if (scene) return scene;
    scene = create3DScene(host);
    if (scene.onChange) scene.onChange(() => { renderRail(); renderInspector(); });
    renderRail(); renderInspector();
    setStatus('3D Studio — insert a model or primitive, drag to orbit, click a part to edit it');
    return scene;
  }

  function addPrimitive(type) { ensure().addPrimitive(type); renderRail(); renderInspector(); setStatus(`Added ${type}`); }
  function loadModelFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    Promise.resolve(ensure().loadModel(url)).then(() => { renderRail(); renderInspector(); setStatus(`Loaded ${file.name}`); })
      .catch((e) => setStatus(`Load failed: ${e.message}`));
  }

  // ---- rail: insert + object list ----
  function renderRail() {
    if (!railEl) return;
    railEl.innerHTML = '';
    const ins = document.createElement('div'); ins.className = 'rb-quick';
    ins.innerHTML = '<span class="rb-field__label">Insert primitive</span>';
    const grid = document.createElement('div'); grid.className = 'rb-quick-grid';
    for (const p of PRIMS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-quick-btn'; b.textContent = p;
      b.addEventListener('click', () => addPrimitive(p)); grid.appendChild(b);
    }
    ins.appendChild(grid);
    const load = document.createElement('button'); load.type = 'button'; load.className = 'rb-btn'; load.style.width = '100%'; load.style.marginTop = '8px';
    load.textContent = '⬆ Load 3D model (.glb / .gltf)';
    load.addEventListener('click', () => fileInput && fileInput.click());
    ins.appendChild(load);
    railEl.appendChild(ins);

    const lbl = document.createElement('p'); lbl.className = 'rb-field__label'; lbl.textContent = 'Objects';
    railEl.appendChild(lbl);
    const list = document.createElement('div'); list.className = 'rb-lib-grid';
    const objs = (scene && scene.listObjects && scene.listObjects()) || [];
    if (!objs.length) { const h = document.createElement('p'); h.className = 'rb-lib-hint'; h.textContent = 'No objects yet — insert a primitive or load a model.'; railEl.appendChild(h); return; }
    const sel = scene.getSelected && scene.getSelected();
    const selId = sel && (sel.id || sel);
    for (const o of objs) {
      const card = document.createElement('button'); card.type = 'button';
      card.className = 'rb-lib-card' + (o.id === selId ? ' is-active' : '');
      card.innerHTML = `<span class="rb-lib-card__name">${escapeHtml(o.name || o.id)}</span>`;
      card.addEventListener('click', () => { scene.select(o.id); renderRail(); renderInspector(); });
      list.appendChild(card);
    }
    railEl.appendChild(list);
  }

  // ---- inspector: selected object controls ----
  const rot = { x: 0, y: 0, z: 0 }; let scaleV = 1;
  function renderInspector() {
    if (!inspectorEl) return;
    inspectorEl.innerHTML = '';
    const sel = scene && scene.getSelected && scene.getSelected();
    const id = sel && (sel.id || sel);
    if (!id) { const h = document.createElement('p'); h.className = 'rb-lib-hint'; h.style.padding = '14px'; h.textContent = 'Click an object (in the scene or the Objects list) to edit it.'; inspectorEl.appendChild(h); return; }

    inspectorEl.appendChild(field('Color', colorInput(sel.color || '#2dd4bf', (hex) => scene.setColor(id, hex))));
    inspectorEl.appendChild(field('Metalness', slider(0, 100, Math.round((sel.metalness ?? 0) * 100), (v) => scene.setMetalness(id, v / 100))));
    inspectorEl.appendChild(field('Roughness', slider(0, 100, Math.round((sel.roughness ?? 1) * 100), (v) => scene.setRoughness(id, v / 100))));
    for (const axis of ['x', 'y', 'z']) {
      inspectorEl.appendChild(field(`Rotate ${axis.toUpperCase()}`, slider(0, 360, rot[axis], (v) => { rot[axis] = v; scene.setTransform(id, { rotation: { x: deg(rot.x), y: deg(rot.y), z: deg(rot.z) } }); })));
    }
    inspectorEl.appendChild(field('Scale', slider(10, 300, scaleV * 100, (v) => { scaleV = v / 100; scene.setTransform(id, { scale: { x: scaleV, y: scaleV, z: scaleV } }); })));
    // transform gizmo mode
    const modes = document.createElement('div'); modes.className = 'rb-preset-row'; modes.style.padding = '0 14px 14px';
    for (const [label, m] of [['Move', 'translate'], ['Rotate', 'rotate'], ['Scale', 'scale']]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-preset'; b.textContent = label;
      b.addEventListener('click', () => { scene.setTransformMode(m); modes.querySelectorAll('.rb-preset').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); });
      modes.appendChild(b);
    }
    const mh = document.createElement('p'); mh.className = 'rb-field__label'; mh.style.padding = '0 14px'; mh.textContent = 'Gizmo';
    inspectorEl.appendChild(mh); inspectorEl.appendChild(modes);
  }

  function field(label, control) {
    const w = document.createElement('div'); w.className = 'rb-field'; w.style.padding = '0 14px';
    const l = document.createElement('span'); l.className = 'rb-field__label'; l.textContent = label;
    const row = document.createElement('div'); row.className = 'rb-field__row'; row.appendChild(control);
    w.appendChild(l); w.appendChild(row); return w;
  }
  function colorInput(val, cb) {
    const i = document.createElement('input'); i.type = 'color'; i.className = 'rb-swatch'; i.value = hex6(val);
    i.addEventListener('input', () => cb(i.value)); return i;
  }
  function slider(min, max, val, cb) {
    const wrap = document.createElement('div'); wrap.className = 'rb-field__row'; wrap.style.flex = '1';
    const s = document.createElement('input'); s.type = 'range'; s.min = String(min); s.max = String(max); s.value = String(val); s.className = 'rb-range';
    const out = document.createElement('span'); out.className = 'rb-range__val'; out.textContent = String(val);
    s.addEventListener('input', () => { out.textContent = s.value; cb(Number(s.value)); });
    wrap.appendChild(s); wrap.appendChild(out); return wrap;
  }

  function dispose() { if (scene) { scene.dispose && scene.dispose(); scene = null; } }
  return { ensure, renderRail, renderInspector, loadModelFile, dispose, get scene() { return scene; } };
}

function deg(d) { return (d * Math.PI) / 180; }
function hex6(v) { const s = String(v || ''); return /^#[0-9a-f]{6}$/i.test(s) ? s : '#2dd4bf'; }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/**
 * 3D Studio mode — controls over the owned Three.js engine (editor/src/3d).
 * Insert model/primitive, orbit, select INDIVIDUAL meshes, recolor + PBR,
 * rotate/scale/move, undo, deselect ("set it down"), delete, and SAVE a scene
 * to the stash as a self-contained 3D embed usable in any page.
 * MIT — RHOBEAR Designs (original)
 */
import { create3DScene } from '../3d/index.js';

const PRIMS = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane'];

export function createThreeMode(refs) {
  const { host, railEl, inspectorEl, fileInput, onStatus, onSaveToStash } = refs;
  let scene = null;
  let history = []; let hi = -1; let snapTimer = null; let restoring = false;
  const setStatus = (m) => onStatus && onStatus(m);

  function ensure() {
    if (scene) return scene;
    scene = create3DScene(host);
    if (scene.onChange) scene.onChange((evt) => {
      // Only rebuild panels on SELECTION change — rebuilding on every color/transform
      // tick would reset the control the user is dragging.
      if (evt && evt.type === 'select') { renderRail(); renderInspector(); }
      if (!restoring) snapDebounced();
    });
    renderRail(); renderInspector(); snap();
    setStatus('3D Studio — insert or load a model · drag to orbit · click a part to edit · Esc to set it down');
    return scene;
  }

  // ---- undo / redo (snapshot scene JSON) ----
  function snap() { if (!scene || restoring) return; const j = scene.toJSON(); /* already a JSON string */ if (history[hi] === j) return; history = history.slice(0, hi + 1); history.push(j); hi = history.length - 1; if (history.length > 40) { history.shift(); hi--; } }
  function snapDebounced() { clearTimeout(snapTimer); snapTimer = setTimeout(snap, 300); }
  function restore(j) { restoring = true; scene.fromJSON(j); renderRail(); renderInspector(); setTimeout(() => { restoring = false; }, 0); }
  function undo() { if (hi > 0) { hi--; restore(history[hi]); setStatus('Undo'); } else setStatus('Nothing to undo'); }
  function redo() { if (hi < history.length - 1) { hi++; restore(history[hi]); setStatus('Redo'); } }

  function addPrimitive(t) { ensure().addPrimitive(t); snap(); renderRail(); renderInspector(); setStatus(`Added ${t}`); }
  function loadModelFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    Promise.resolve(ensure().loadModel(url)).then(() => { snap(); renderRail(); renderInspector(); setStatus(`Loaded ${file.name}`); })
      .catch((e) => setStatus(`Load failed: ${e.message}`));
  }
  function removeSelected() {
    const id = scene && scene.getSelected(); if (!id) return;
    const j = JSON.parse(scene.toJSON()); j.objects = (j.objects || []).filter((o) => o.id !== id); j.selectedId = null;
    scene.fromJSON(j); snap(); renderRail(); renderInspector(); setStatus('Removed object');
  }
  function deselect() { if (scene && scene.deselect) { scene.deselect(); renderRail(); renderInspector(); setStatus('Set down — nothing selected'); } }

  function curState() {
    const id = scene && scene.getSelected(); if (!id) return null;
    const o = (JSON.parse(scene.toJSON()).objects || []).find((x) => x.id === id);
    return o ? { ...o, id } : { id };
  }

  // ---- rail ----
  function renderRail() {
    if (!railEl) return;
    railEl.innerHTML = '';
    const ins = document.createElement('div'); ins.className = 'rb-quick';
    ins.innerHTML = '<span class="rb-field__label">Insert primitive</span>';
    const grid = document.createElement('div'); grid.className = 'rb-quick-grid';
    for (const p of PRIMS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-quick-btn'; b.textContent = p; b.addEventListener('click', () => addPrimitive(p)); grid.appendChild(b); }
    ins.appendChild(grid);
    const load = document.createElement('button'); load.type = 'button'; load.className = 'rb-btn'; load.style.cssText = 'width:100%;margin-top:8px';
    load.textContent = '⬆ Load 3D model (.glb / .gltf)'; load.addEventListener('click', () => fileInput && fileInput.click()); ins.appendChild(load);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'rb-btn rb-btn--primary'; save.style.cssText = 'width:100%;margin-top:6px';
    save.textContent = '★ Save scene to stash'; save.addEventListener('click', saveToStash); ins.appendChild(save);
    railEl.appendChild(ins);

    const lbl = document.createElement('p'); lbl.className = 'rb-field__label'; lbl.textContent = 'Objects'; railEl.appendChild(lbl);
    const objs = (scene && scene.listObjects && scene.listObjects()) || [];
    if (!objs.length) { const h = document.createElement('p'); h.className = 'rb-lib-hint'; h.textContent = 'No objects yet — insert a primitive or load a model.'; railEl.appendChild(h); return; }
    const selId = scene.getSelected && scene.getSelected();
    const list = document.createElement('div'); list.className = 'rb-lib-grid';
    for (const o of objs) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'rb-lib-card' + (o.id === selId ? ' is-active' : '');
      card.innerHTML = `<span class="rb-lib-card__name">${escapeHtml(o.name || o.id)}</span>`;
      card.addEventListener('click', () => { scene.select(o.id); renderRail(); renderInspector(); });
      list.appendChild(card);
    }
    railEl.appendChild(list);
  }

  // ---- inspector ----
  function renderInspector() {
    if (!inspectorEl) return;
    inspectorEl.innerHTML = '';
    const st = curState();
    if (!st) { const h = document.createElement('p'); h.className = 'rb-lib-hint'; h.style.padding = '14px'; h.textContent = 'Click an object (in the scene or the Objects list) to edit it.'; inspectorEl.appendChild(h); return; }
    const id = st.id;
    const rotDeg = (st.rotation || [0, 0, 0]).map((r) => Math.round((r * 180) / Math.PI));
    const sc = Math.round(((st.scale && st.scale[0]) || 1) * 100);

    inspectorEl.appendChild(field('Color', colorInput(st.color || '#2dd4bf', (hex) => scene.setColor(id, hex))));
    inspectorEl.appendChild(field('Metalness', slider(0, 100, Math.round((st.metalness ?? 0) * 100), (v) => scene.setMetalness(id, v / 100))));
    inspectorEl.appendChild(field('Roughness', slider(0, 100, Math.round((st.roughness ?? 1) * 100), (v) => scene.setRoughness(id, v / 100))));
    const rot = rotDeg.slice();
    ['x', 'y', 'z'].forEach((axis, i) => {
      inspectorEl.appendChild(field(`Rotate ${axis.toUpperCase()}`, slider(0, 360, ((rot[i] % 360) + 360) % 360, (v) => { rot[i] = v; scene.setTransform(id, { rotation: [deg(rot[0]), deg(rot[1]), deg(rot[2])] }); })));
    });
    inspectorEl.appendChild(field('Scale', slider(10, 300, sc, (v) => scene.setTransform(id, { scale: [v / 100, v / 100, v / 100] }))));

    const gh = document.createElement('p'); gh.className = 'rb-field__label'; gh.style.padding = '0 14px'; gh.textContent = 'Gizmo'; inspectorEl.appendChild(gh);
    const modes = document.createElement('div'); modes.className = 'rb-preset-row'; modes.style.padding = '0 14px 12px';
    for (const [label, m] of [['Move', 'translate'], ['Rotate', 'rotate'], ['Scale', 'scale']]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-preset'; b.textContent = label;
      b.addEventListener('click', () => { scene.setTransformMode(m); modes.querySelectorAll('.rb-preset').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); });
      modes.appendChild(b);
    }
    inspectorEl.appendChild(modes);

    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;padding:0 14px 14px';
    const done = document.createElement('button'); done.type = 'button'; done.className = 'rb-btn'; done.style.flex = '1'; done.textContent = '✓ Set it down'; done.addEventListener('click', deselect);
    const del = document.createElement('button'); del.type = 'button'; del.className = 'rb-btn'; del.style.flex = '1'; del.textContent = '🗑 Delete'; del.addEventListener('click', removeSelected);
    actions.appendChild(done); actions.appendChild(del); inspectorEl.appendChild(actions);
  }

  // ---- save scene → self-contained 3D embed for the stash ----
  function saveToStash() {
    if (!scene) return;
    const json = JSON.parse(scene.toJSON());
    if (!(json.objects || []).length) { setStatus('Add an object first, then save'); return; }
    const html = buildEmbedHtml(json);
    const name = `3D scene (${json.objects.length} obj)`;
    onSaveToStash && onSaveToStash({ id: `u3d-${Date.now()}`, category: 'saved', name, html });
    setStatus('Saved to stash — find it under "Saved" in the Add panel (Edit Live Site), then drop it on a page');
  }

  function field(label, control) {
    const w = document.createElement('div'); w.className = 'rb-field'; w.style.padding = '0 14px';
    const l = document.createElement('span'); l.className = 'rb-field__label'; l.textContent = label;
    const row = document.createElement('div'); row.className = 'rb-field__row'; row.appendChild(control);
    w.appendChild(l); w.appendChild(row); return w;
  }
  function colorInput(val, cb) { const i = document.createElement('input'); i.type = 'color'; i.className = 'rb-swatch'; i.value = hex6(val); i.addEventListener('input', () => cb(i.value)); return i; }
  function slider(min, max, val, cb) {
    const wrap = document.createElement('div'); wrap.className = 'rb-field__row'; wrap.style.flex = '1';
    const s = document.createElement('input'); s.type = 'range'; s.min = String(min); s.max = String(max); s.value = String(val); s.className = 'rb-range';
    const out = document.createElement('span'); out.className = 'rb-range__val'; out.textContent = String(val);
    s.addEventListener('input', () => { out.textContent = s.value; cb(Number(s.value)); });
    wrap.appendChild(s); wrap.appendChild(out); return wrap;
  }
  function loadScene(json) {
    ensure();
    try { scene.fromJSON(json); } catch (_e) { setStatus('Could not load that 3D scene'); return; }
    snap(); renderRail(); renderInspector(); setStatus('Opened in 3D Studio — edit, then ★ Save to update');
  }
  function dispose() { if (scene) { scene.dispose && scene.dispose(); scene = null; } }
  return { ensure, undo, redo, deselect, removeSelected, dispose, saveToStash, loadScene, get scene() { return scene; } };
}

function deg(d) { return (d * Math.PI) / 180; }
function hex6(v) { const s = String(v || ''); return /^#[0-9a-f]{6}$/i.test(s) ? s : '#2dd4bf'; }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/** A self-contained 3D embed. The scene data rides in a `data-rb-3d` attribute and
 * a constant runtime scans for any unmounted `.rb-3d-embed` and mounts it — so it
 * works whether the script ran on page load (export) OR was re-executed after being
 * inserted in the editor (innerHTML-inserted scripts don't auto-run; we re-run them).
 * Not relying on document.currentScript means re-executed copies still work. */
const EMBED_RUNTIME = `
import * as THREE from 'https://esm.sh/three@0.161.0';
import { OrbitControls } from 'https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls.js';
const G = { box:()=>new THREE.BoxGeometry(1,1,1), sphere:()=>new THREE.SphereGeometry(0.7,32,32), cylinder:()=>new THREE.CylinderGeometry(0.5,0.5,1.4,32), cone:()=>new THREE.ConeGeometry(0.6,1.4,32), torus:()=>new THREE.TorusGeometry(0.6,0.22,24,80), plane:()=>new THREE.PlaneGeometry(2,2) };
for (const host of document.querySelectorAll('.rb-3d-embed[data-rb-3d]:not([data-rb-mounted])')) {
  host.setAttribute('data-rb-mounted','1');
  let DATA; try { DATA = JSON.parse(host.getAttribute('data-rb-3d')); } catch (e) { continue; }
  const W = host.clientWidth || 800, H = host.clientHeight || 520;
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, W/H, 0.1, 100); cam.position.set(3,2,4);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dl = new THREE.DirectionalLight(0xffffff, 1.15); dl.position.set(5,8,5); scene.add(dl);
  for (const o of (DATA.objects||[])) {
    const geo = (G[o.type]||G.box)();
    const mat = new THREE.MeshStandardMaterial({ color:o.color||'#2dd4bf', metalness:o.metalness??0, roughness:o.roughness??1 });
    const mesh = new THREE.Mesh(geo, mat);
    if (o.position) mesh.position.set(o.position[0],o.position[1],o.position[2]);
    if (o.rotation) mesh.rotation.set(o.rotation[0],o.rotation[1],o.rotation[2]);
    if (o.scale) mesh.scale.set(o.scale[0],o.scale[1],o.scale[2]);
    scene.add(mesh);
  }
  const ctr = new OrbitControls(cam, renderer.domElement); ctr.enableDamping = true;
  new ResizeObserver(()=>{ const w=host.clientWidth,h=host.clientHeight; if(w&&h){ renderer.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix(); } }).observe(host);
  (function loop(){ requestAnimationFrame(loop); ctr.update(); renderer.render(scene,cam); })();
}`;

function buildEmbedHtml(json) {
  const attr = JSON.stringify(json).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div class="rb-3d-embed" data-rb-3d="${attr}" style="width:100%;height:520px;position:relative;background:#0d0f10;border-radius:12px;overflow:hidden">` +
    `<script type="module">${EMBED_RUNTIME}</script></div>`;
}

/**
 * @file Three.js scene setup — renderer, camera, lights, environment,
 *       ground, controls, render loop, resize observer, dispose. This
 *       file is the ONLY place in the engine that imports the heavy
 *       `three` package; everything else stays pure so `node --test`
 *       runs without WebGL.
 *
 *       The exported `setupThreeScene(container, opts)` returns a
 *       context bag the handle API consumes:
 *         { renderer, scene, camera, controls, transformControls,
 *           raycaster, pointer, pmrem, envTexture, ground, grid,
 *           container, clock, render(), frame(), resize(w,h),
 *           observeResize(), addObject3D(obj), removeObject3D(obj),
 *           frameObject(obj), dispose() }
 *
 *       Public API the handle uses (everything else is internal):
 *
 *         opts = {
 *           background?: string | null,    // CSS color or null (transparent)
 *           camera?: { fov, near, far, position, target },
 *           showGround?: boolean,          // default true
 *           showGrid?:   boolean,          // default true
 *           shadows?:    boolean,          // default true
 *         }
 *
 *       Style: the scene chrome (controls, transform gizmo) is
 *       always present, but the gizmo starts hidden. The handle
 *       surfaces `setTransformMode()` which flips it on / off.
 *
 *       MIT — RHOBEAR Designs.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Set up the full 3D scene in `container` and return the context the
 * handle API consumes. `container` must be a DOM element; we mount
 * the renderer's canvas as a direct child.
 *
 * @param {HTMLElement} container
 * @param {object} [opts]
 * @returns {object} scene context
 */
export function setupThreeScene(container, opts = {}) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('setupThreeScene: container must be an HTMLElement');
  }

  // -- Options ---------------------------------------------------------
  const background = opts.background !== undefined ? opts.background : null;
  const showGround = opts.showGround !== false;
  const showGrid = opts.showGrid !== false;
  const shadows = opts.shadows !== false;
  const cameraOpts = opts.camera || {};

  // -- Renderer --------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const initialWidth = Math.max(1, container.clientWidth || 1);
  const initialHeight = Math.max(1, container.clientHeight || 1);
  renderer.setSize(initialWidth, initialHeight, false);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.outline = 'none';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  // -- Scene -----------------------------------------------------------
  const scene = new THREE.Scene();
  if (background != null) {
    // THREE accepts hex ints or CSS strings.
    scene.background = new THREE.Color(background);
  }

  // -- Camera ----------------------------------------------------------
  const camPos = cameraOpts.position || [3, 2.5, 5];
  const camTarget = cameraOpts.target || [0, 0, 0];
  const camera = new THREE.PerspectiveCamera(
    cameraOpts.fov || 50,
    initialWidth / initialHeight,
    cameraOpts.near || 0.1,
    cameraOpts.far || 1000,
  );
  camera.position.set(camPos[0], camPos[1], camPos[2]);
  camera.lookAt(camTarget[0], camTarget[1], camTarget[2]);

  // -- Lights ----------------------------------------------------------
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 8, 6);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
  }
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xbcd6ff, 0.4);
  fill.position.set(-5, 3, -3);
  scene.add(fill);

  // -- Environment (PBR reflections) -----------------------------------
  let envTexture = null;
  let pmrem = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
  } catch (err) {
    // RoomEnvironment is a soft feature; the scene still renders
    // without it (just no IBL reflections).
    envTexture = null;
    pmrem = null;
    // eslint-disable-next-line no-console
    console.warn('[3d] RoomEnvironment unavailable, falling back to lights only:', err);
  }

  // -- Ground + grid ---------------------------------------------------
  const ground = new THREE.Object3D();
  if (showGround) {
    const groundMesh = new THREE.Mesh(
      new THREE.CircleGeometry(8, 64),
      new THREE.MeshStandardMaterial({
        color: 0xe5e7eb,
        roughness: 0.95,
        metalness: 0.02,
      }),
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundMesh.name = '__ground__';
    ground.add(groundMesh);
    scene.add(ground);
  }

  let grid = null;
  if (showGrid) {
    grid = new THREE.GridHelper(16, 16, 0x7c5cff, 0xbcbccf);
    grid.material.opacity = 0.4;
    grid.material.transparent = true;
    grid.position.y = 0.001;
    scene.add(grid);
  }

  // -- Controls --------------------------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(camTarget[0], camTarget[1], camTarget[2]);
  controls.update();

  // -- Transform gizmo -------------------------------------------------
  // We attach it as a sibling of the scene root. It's invisible until
  // the handle attaches an object via setTransformMode() + selection.
  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode('translate');
  transformControls.setSize(0.85);
  transformControls.visible = false;
  transformControls.enabled = false;
  // TransformControls in Three.js >= 0.166 exposes getHelper() which
  // is the actual Object3D to add to the scene. Older versions were
  // themselves Object3D. Support both.
  const gizmoObject = (typeof transformControls.getHelper === 'function')
    ? transformControls.getHelper()
    : transformControls;
  scene.add(gizmoObject);

  // -- Raycaster (pointer picking) -------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerActive = false;
  let suppressOrbitClick = false;
  const pickListeners = new Set();

  function onPointerMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (transformControls.dragging) return;
    pointerActive = true;
    onPointerMove(e);
  }

  function onPointerUp(e) {
    if (!pointerActive) return;
    pointerActive = false;
    if (e.button !== 0) return;
    if (transformControls.dragging) {
      // TransformControls consumed this gesture — don't raycast.
      return;
    }
    onPointerMove(e);
    const hits = pickables.length ? raycaster.intersectObjects(pickables, true) : [];
    const first = hits.length ? hits[0].object : null;
    for (const cb of pickListeners) {
      try { cb({ mesh: first, point: hits.length ? hits[0].point : null }); }
      catch (_) { /* listener errors don't break the picker */ }
    }
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  // Picking list — meshes the raycaster should hit. Populated as
  // objects are added/removed via addObject3D/removeObject3D.
  /** @type {THREE.Object3D[]} */
  const pickables = [];

  // -- Render loop -----------------------------------------------------
  const clock = new THREE.Clock();
  let running = false;
  let rafId = 0;

  function frame() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const dt = clock.getDelta();
    controls.update();
    // Suppress orbit while gizmo is being dragged.
    transformControls.enabled = transformControls.visible && !!transformControls.object;
    // After TransformControls moves an object, listeners on the gizmo
    // fire 'objectChange' — the handle installs one to mark dirty.
    renderer.render(scene, camera);
    // tick hook (engine-installed; not used by setupThreeScene itself)
    if (onTick) onTick(dt);
  }

  let onTick = null;
  function setOnTick(fn) { onTick = typeof fn === 'function' ? fn : null; }

  function start() {
    if (running) return;
    running = true;
    clock.start();
    frame();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // -- Resize handling -------------------------------------------------
  function resize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let resizeObserver = null;
  function observeResize() {
    if (typeof ResizeObserver === 'undefined') {
      // Fall back to window resize.
      const onWin = () => resize(container.clientWidth, container.clientHeight);
      window.addEventListener('resize', onWin);
      resizeObserver = { disconnect() { window.removeEventListener('resize', onWin); } };
      return resizeObserver;
    }
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const r = entry.contentRect;
        if (r.width > 0 && r.height > 0) resize(r.width, r.height);
      }
    });
    resizeObserver.observe(container);
    return resizeObserver;
  }

  // -- Object management helpers (used by the handle) -----------------
  function addObject3D(obj) {
    if (obj) scene.add(obj);
  }

  function removeObject3D(obj) {
    if (obj && obj.parent === scene) scene.remove(obj);
  }

  function frameObject(obj) {
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    if (!isFinite(box.min.x) || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    if (size <= 0) return;
    const fitOffset = 1.6;
    camera.near = Math.max(0.01, size / 100);
    camera.far = Math.max(1000, size * 100);
    camera.updateProjectionMatrix();
    const dir = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .normalize();
    camera.position.copy(center).add(dir.multiplyScalar(size * fitOffset));
    controls.target.copy(center);
    controls.update();
  }

  function onPick(cb) {
    pickListeners.add(cb);
    return () => pickListeners.delete(cb);
  }

  function addPickable(obj) { if (obj) pickables.push(obj); }
  function removePickable(obj) {
    const i = pickables.indexOf(obj);
    if (i !== -1) pickables.splice(i, 1);
  }

  function clearPickables() { pickables.length = 0; }

  // -- Suppress / restore orbit while dragging -------------------------
  // TransformControls swallows its own events, but on some browsers
  // the OrbitControls still gets a stray "drag" if the gizmo wasn't
  // clicked. We toggle enabled state explicitly:
  //   - disable orbit when gizmo dragging starts
  //   - re-enable when dragging ends
  // TransformControls fires 'dragging-changed'.
  transformControls.addEventListener('dragging-changed', (e) => {
    controls.enabled = !e.value;
  });

  // -- Dispose ---------------------------------------------------------
  function dispose() {
    stop();
    if (resizeObserver) {
      try { resizeObserver.disconnect(); } catch (_) { console.error('resizeObserver disconnect:', _); }
      resizeObserver = null;
    }
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    pickListeners.clear();
    if (transformControls.parent) transformControls.parent.remove(gizmoObject);
    if (typeof transformControls.dispose === 'function') transformControls.dispose();
    if (controls && typeof controls.dispose === 'function') controls.dispose();
    if (envTexture) envTexture.dispose();
    if (pmrem) pmrem.dispose();
    scene.traverse((child) => {
      if (child.geometry && typeof child.geometry.dispose === 'function') {
        child.geometry.dispose();
      }
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (m && typeof m.dispose === 'function') m.dispose();
        }
      }
    });
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
    renderer.dispose();
  }

  // Kick off the render loop immediately so the scene isn't a black
  // box. The handle can stop it during teardown.
  start();

  return {
    renderer,
    scene,
    camera,
    controls,
    transformControls,
    gizmoObject,
    raycaster,
    pointer,
    pmrem,
    envTexture,
    ground,
    grid,
    container,
    clock,
    // actions
    render: () => renderer.render(scene, camera),
    start, stop, frame,
    resize, observeResize,
    addObject3D, removeObject3D,
    addPickable, removePickable, clearPickables,
    frameObject,
    onPick,
    setOnTick,
    dispose,
    // exposed for tests / debugging
    _suppressOrbitClick: () => suppressOrbitClick,
    _pickablesRef: () => pickables,
  };
}

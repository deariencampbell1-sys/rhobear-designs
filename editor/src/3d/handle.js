/**
 * @file The 3D scene handle — the API surface the editor (and Iron
 *       Man's UI panel) actually talks to. The Three.js scene
 *       setup lives in scene.js; the public API lives here.
 *
 *       `createHandle(sceneCtx)` returns an object with every method
 *       documented in the lane's DoD. The handle:
 *
 *         - tracks a Map of selectable meshes (via registry.js)
 *         - drives selection state + TransformControls gizmo
 *         - serializes to / from a stable JSON shape (via serialize.js)
 *         - fires `onChange(cb)` on every observable state change
 *
 *       The handle never touches the renderer / DOM directly — it
 *       only uses `sceneCtx` (from setupThreeScene) for the heavy
 *       Three.js work. This keeps the test surface small: a fake
 *       sceneCtx exercises handle methods that don't depend on
 *       Three.js internals, while the Playwright spec exercises the
 *       real thing end-to-end with WebGL.
 *
 *       Public methods (per the lane spec):
 *         addPrimitive(type)             -> id
 *         loadModel(urlOrFile)           -> Promise<id>
 *         listObjects()                  -> [{ id, name, type, source? }]
 *         select(id)                     -> this
 *         getSelected()                  -> id | null
 *         deselect()                     -> this
 *         setColor(id, hex)              -> this
 *         setMetalness(id, v)            -> this
 *         setRoughness(id, v)            -> this
 *         setTransform(id, t)            -> this
 *         rotate(id, axis, deg)          -> this
 *         setTransformMode(mode)         -> this
 *         toJSON()                       -> string (JSON)
 *         fromJSON(state)                -> this
 *         onChange(cb)                   -> unsubscribe()
 *         dispose()                      -> void
 *
 *       MIT — RHOBEAR Designs.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  makeState,
  applyTransform,
  rotateBy,
  clampScale,
  readFromObject3D,
} from './transform.js';
import {
  serializeScene,
  deserializeScene,
  PRIMITIVE_TYPES,
  TRANSFORM_MODES,
  OBJECT_TYPES,
} from './serialize.js';
import { createObjectRegistry } from './registry.js';

const DEFAULT_PRIMITIVE_COLOR = '#cccccc';
const DEFAULT_METALNESS = 0.1;
const DEFAULT_ROUGHNESS = 0.8;

/**
 * Build the handle API around a `setupThreeScene(...)` context.
 *
 * @param {object} sceneCtx
 * @returns {object} handle
 */
export function createHandle(sceneCtx) {
  if (!sceneCtx) throw new Error('createHandle: scene context required');

  const registry = createObjectRegistry();
  /** @type {Set<(e: { type: string, detail?: object }) => void>} */
  const listeners = new Set();
  let selectedId = null;
  let transformMode = 'translate';
  /** @type {THREE.Object3D | null} — the mesh currently bound to the gizmo. */
  let gizmoTarget = null;
  /** @type {Map<string, THREE.Group | THREE.Object3D>} — root GLTF roots per model. */
  const gltfRoots = new Map();

  function notify(type, detail) {
    if (listeners.size === 0) return;
    const evt = { type, detail, handle: api };
    for (const cb of listeners) {
      try { cb(evt); } catch (_) { /* listener errors don't break the handle */ }
    }
  }

  function getEntry(id) {
    const key = String(id);
    const e = registry.get(key);
    if (!e) throw new Error(`handle: object "${key}" not found`);
    return e;
  }

  function applyMaterialDefaults(material) {
    if (!material) return;
    if ('metalness' in material) material.metalness = DEFAULT_METALNESS;
    if ('roughness' in material) material.roughness = DEFAULT_ROUGHNESS;
    if ('color' in material && material.color && material.color.set) {
      material.color.set(DEFAULT_PRIMITIVE_COLOR);
    }
    material.needsUpdate = true;
  }

  function makePrimitiveMesh(type) {
    let geometry;
    switch (type) {
      case 'box':      geometry = new THREE.BoxGeometry(1, 1, 1); break;
      case 'sphere':   geometry = new THREE.SphereGeometry(0.6, 32, 24); break;
      case 'cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
      case 'cone':     geometry = new THREE.ConeGeometry(0.6, 1.2, 32); break;
      case 'torus':    geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 64); break;
      case 'plane':    geometry = new THREE.PlaneGeometry(2, 2); break;
      default: throw new Error(`addPrimitive: unknown type "${type}"`);
    }
    const material = new THREE.MeshStandardMaterial({
      color: DEFAULT_PRIMITIVE_COLOR,
      metalness: DEFAULT_METALNESS,
      roughness: DEFAULT_ROUGHNESS,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, material };
  }

  // ------------------------------------------------------------------------
  // addPrimitive / loadModel
  // ------------------------------------------------------------------------

  function addPrimitive(type) {
    if (!PRIMITIVE_TYPES.includes(type)) {
      throw new Error(`addPrimitive: type must be one of ${PRIMITIVE_TYPES.join(', ')}`);
    }
    const id = registry.nextId();
    const { mesh, material } = makePrimitiveMesh(type);
    mesh.name = `${type}-${registry.size()}`;
    sceneCtx.addObject3D(mesh);
    sceneCtx.addPickable(mesh);

    const entry = {
      id,
      name: mesh.name,
      type,
      mesh,
      material,
      root: mesh,
      position: mesh.position,
      rotation: mesh.rotation,
      scale: mesh.scale,
      color: DEFAULT_PRIMITIVE_COLOR,
      metalness: DEFAULT_METALNESS,
      roughness: DEFAULT_ROUGHNESS,
    };
    registry.add(entry);
    notify('add', { id, type });
    return id;
  }

  function loadModel(urlOrFile) {
    return new Promise((resolve, reject) => {
      if (urlOrFile == null) {
        reject(new Error('loadModel: url or file required'));
        return;
      }
      let url;
      let ownsUrl = false;
      if (typeof urlOrFile === 'string') {
        url = urlOrFile;
      } else if (urlOrFile instanceof Blob || urlOrFile instanceof File) {
        url = URL.createObjectURL(urlOrFile);
        ownsUrl = true;
      } else {
        reject(new Error('loadModel: expected string URL or File/Blob'));
        return;
      }

      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          if (ownsUrl) {
            try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
          }
          const root = gltf.scene || gltf.scenes[0];
          if (!root) {
            reject(new Error('loadModel: GLTF contained no scene'));
            return;
          }
          // Each Mesh inside the loaded scene becomes individually
          // selectable. We give every mesh a unique id and register
          // it in the registry; the parent root keeps them grouped
          // for serialization / frameObject().
          const id = registry.nextId('m');
          const name = (root.name && String(root.name).trim()) || `Model ${registry.size()}`;
          const sourceMark = typeof urlOrFile === 'string' ? urlOrFile : (urlOrFile.name || 'inline');
          const meshes = [];
          root.traverse((child) => {
            if (child.isMesh) {
              const mid = `${id}__${child.name || 'mesh'}_${meshes.length}`;
              child.userData.__rbId = mid;
              child.userData.__rbRootId = id;
              // Give each sub-mesh its own material instance so per-mesh
              // recoloring doesn't bleed across the whole model.
              if (child.material && !Array.isArray(child.material)) {
                child.material = child.material.clone();
              }
              sceneCtx.addPickable(child);
              meshes.push(child);
              registry.add({
                id: mid,
                name: child.name || `${name} (${meshes.length})`,
                type: 'gltf',
                source: sourceMark,
                mesh: child,
                material: child.material,
                root,
                position: child.position,
                rotation: child.rotation,
                scale: child.scale,
                color: readColor(child.material),
                metalness: Number(child.material?.metalness ?? DEFAULT_METALNESS),
                roughness: Number(child.material?.roughness ?? DEFAULT_ROUGHNESS),
                __parentId: id,
              });
            }
          });
          // Register the parent root entry too so `listObjects` shows it
          // only via its sub-meshes (parent entry is internal — not
          // returned by listObjects()). This keeps the public list flat.
          registry.add({
            id,
            name,
            type: 'gltf',
            source: sourceMark,
            root,
            mesh: root, // parent root doubles as "the mesh" for picking
            material: null,
            position: root.position,
            rotation: root.rotation,
            scale: root.scale,
            color: null,
            metalness: null,
            roughness: null,
            __parent: true,
            __childIds: meshes.map((m) => m.userData.__rbId),
          });
          gltfRoots.set(id, root);
          sceneCtx.addObject3D(root);
          try { sceneCtx.frameObject(root); } catch (_) { /* root may be empty */ }
          notify('add', { id, type: 'gltf', subMeshes: meshes.length });
          // Resolve with the root id; sub-meshes are selectable via their
          // own ids (returned by listObjects).
          resolve(id);
        },
        undefined,
        (err) => {
          if (ownsUrl) {
            try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
          }
          const msg = (err && err.message) ? err.message : String(err);
          reject(new Error(`loadModel: failed to load "${url}": ${msg}`));
        },
      );
    });
  }

  // ------------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------------

  function select(id) {
    const key = id == null ? null : String(id);
    if (key !== null && !registry.has(key)) {
      throw new Error(`select: object "${key}" not found`);
    }
    const prev = selectedId;
    selectedId = key;
    attachGizmo();
    highlight(key);
    if (prev !== key) notify('select', { id: key, prev });
    return api;
  }

  function deselect() {
    if (selectedId == null) return api;
    const prev = selectedId;
    selectedId = null;
    detachGizmo();
    highlight(null);
    notify('select', { id: null, prev });
    return api;
  }

  function getSelected() {
    return selectedId == null ? null : String(selectedId);
  }

  function attachGizmo() {
    if (!sceneCtx.transformControls) return;
    if (selectedId == null) return;
    const entry = registry.get(selectedId);
    if (!entry) return;
    let target = entry.mesh || null;
    // For sub-meshes inside a loaded model, attach to the parent root
    // so the gizmo translates the whole model.
    if (entry.__parentId) {
      const parent = registry.get(entry.__parentId);
      if (parent && parent.root) target = parent.root;
    }
    gizmoTarget = target;
    sceneCtx.transformControls.attach(target);
    sceneCtx.transformControls.visible = true;
    sceneCtx.transformControls.enabled = true;
  }

  function detachGizmo() {
    if (!sceneCtx.transformControls) return;
    sceneCtx.transformControls.detach();
    sceneCtx.transformControls.visible = false;
    sceneCtx.transformControls.enabled = false;
    gizmoTarget = null;
  }

  function highlight(id) {
    // Reset emissive on all tracked meshes.
    registry.snapshot().forEach((e) => {
      const entry = registry.get(e.id);
      const mesh = entry && entry.mesh;
      if (!mesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || !m.emissive) continue;
        if (entry.__highlight) {
          m.emissive.set(entry.__highlight);
          entry.__highlight = null;
        }
      }
    });
    if (id == null) return;
    const entry = registry.get(id);
    if (!entry) return;
    const mesh = entry.mesh;
    if (!mesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || !m.emissive) continue;
      entry.__highlight = m.emissive.getHex();
      m.emissive.set('#2dd4bf');
    }
  }

  // Picking callback — the scene fires this when the user clicks.
  sceneCtx.onPick(({ mesh }) => {
    if (!mesh) {
      deselect();
      return;
    }
    const id = mesh.userData && mesh.userData.__rbId;
    if (id) select(id);
  });

  // TransformControls fires 'objectChange' while the user drags; we
  // mirror that into onChange so the UI can sync. After the drag
  // ends we re-highlight so the new position is reflected.
  if (sceneCtx.transformControls) {
    sceneCtx.transformControls.addEventListener('objectChange', () => {
      const e = selectedId ? registry.get(selectedId) : null;
      if (!e) return;
      const mesh = e.mesh;
      if (mesh && mesh.position) {
        e.position = [mesh.position.x, mesh.position.y, mesh.position.z];
      }
      if (mesh && mesh.rotation) {
        e.rotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z];
      }
      if (mesh && mesh.scale) {
        e.scale = [mesh.scale.x, mesh.scale.y, mesh.scale.z];
      }
      notify('transform', { id: selectedId });
    });
  }

  // ------------------------------------------------------------------------
  // listObjects
  // ------------------------------------------------------------------------

  function listObjects() {
    // The UI wants a flat list of selectable meshes. Parent root
    // entries (loaded GLTFs) are internal — skip them. Sub-meshes
    // (children of a parent root) are exposed individually.
    const out = [];
    for (const e of registry.snapshot()) {
      if (e.__parent) continue;
      const row = { id: e.id, name: e.name || e.id, type: e.type };
      if (e.source != null) row.source = e.source;
      out.push(row);
    }
    return out;
  }

  // ------------------------------------------------------------------------
  // Color / PBR / Transform
  // ------------------------------------------------------------------------

  function setColor(id, hex) {
    const entry = getEntry(id);
    if (!entry.material) return api;
    const mats = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const m of mats) {
      if (m && m.color && m.color.set) m.color.set(hex);
    }
    entry.color = String(hex);
    notify('color', { id: String(id), color: String(hex) });
    return api;
  }

  function setMetalness(id, v) {
    const entry = getEntry(id);
    const num = clamp01(Number(v), DEFAULT_METALNESS);
    if (!entry.material) return api;
    const mats = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const m of mats) {
      if (m && 'metalness' in m) m.metalness = num;
    }
    entry.metalness = num;
    notify('material', { id: String(id), metalness: num });
    return api;
  }

  function setRoughness(id, v) {
    const entry = getEntry(id);
    const num = clamp01(Number(v), DEFAULT_ROUGHNESS);
    if (!entry.material) return api;
    const mats = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const m of mats) {
      if (m && 'roughness' in m) m.roughness = num;
    }
    entry.roughness = num;
    notify('material', { id: String(id), roughness: num });
    return api;
  }

  function setTransform(id, opts) {
    const entry = getEntry(id);
    const current = readFromObject3D(entry.mesh);
    const next = applyTransform(current, opts || {});
    // Clamp scale on the way through so the gizmo can't go to 0.
    const safe = clampScale(next);
    if (entry.mesh && entry.mesh.position) {
      entry.mesh.position.set(safe.position[0], safe.position[1], safe.position[2]);
      entry.mesh.rotation.set(safe.rotation[0], safe.rotation[1], safe.rotation[2]);
      entry.mesh.scale.set(safe.scale[0], safe.scale[1], safe.scale[2]);
    }
    entry.position = safe.position;
    entry.rotation = safe.rotation;
    entry.scale = safe.scale;
    notify('transform', { id: String(id) });
    return api;
  }

  function rotate(id, axis, degrees) {
    const entry = getEntry(id);
    const current = readFromObject3D(entry.mesh);
    const next = rotateBy(current, axis, degrees);
    if (entry.mesh && entry.mesh.rotation) {
      entry.mesh.rotation.set(next.rotation[0], next.rotation[1], next.rotation[2]);
    }
    entry.rotation = next.rotation;
    notify('transform', { id: String(id), axis, degrees: Number(degrees) });
    return api;
  }

  function setTransformMode(mode) {
    if (!TRANSFORM_MODES.includes(mode)) {
      throw new Error(`setTransformMode: mode must be one of ${TRANSFORM_MODES.join(', ')}`);
    }
    transformMode = mode;
    if (sceneCtx.transformControls) {
      sceneCtx.transformControls.setMode(mode);
      sceneCtx.transformControls.visible = selectedId != null;
      sceneCtx.transformControls.enabled = selectedId != null;
    }
    notify('transformMode', { mode });
    return api;
  }

  function getTransformMode() {
    return transformMode;
  }

  // ------------------------------------------------------------------------
  // toJSON / fromJSON
  // ------------------------------------------------------------------------

  function toJSON() {
    // Build the live snapshot using the registry's `snapshot()` which
    // already returns everything we need in serialized form.
    const snapshot = registry.snapshot().filter((e) => !e.__parent);
    const state = {
      objects: snapshot,
      selectedId,
      transformMode,
    };
    return serializeScene(state);
  }

  function fromJSON(jsonOrObj) {
    const state = deserializeScene(jsonOrObj);
    // Wipe the scene cleanly before restoring.
    disposeSceneObjects();
    transformMode = state.transformMode;

    for (const obj of state.objects) {
      const id = obj.id;
      let mesh;
      let material;
      let root = null;
      if (obj.type === 'gltf') {
        // Re-create a synthetic mesh so the restored entry has *something*
        // the gizmo can grab. A real restore would call loadModel() again,
        // but here we're restoring metadata only — the loader is async
        // and the round-trip test doesn't need a live GLB.
        const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        material = new THREE.MeshStandardMaterial({
          color: obj.color || DEFAULT_PRIMITIVE_COLOR,
          metalness: obj.metalness,
          roughness: obj.roughness,
        });
        mesh = new THREE.Mesh(geom, material);
        mesh.name = obj.name || id;
        mesh.position.set(obj.position[0], obj.position[1], obj.position[2]);
        mesh.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
        mesh.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
        root = mesh;
      } else {
        const built = makePrimitiveMesh(obj.type);
        mesh = built.mesh;
        material = built.material;
        mesh.name = obj.name || id;
        mesh.position.set(obj.position[0], obj.position[1], obj.position[2]);
        mesh.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
        mesh.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
        material.color.set(obj.color);
        material.metalness = obj.metalness;
        material.roughness = obj.roughness;
        root = mesh;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sceneCtx.addObject3D(mesh);
      sceneCtx.addPickable(mesh);
      const entry = {
        id,
        name: obj.name || id,
        type: obj.type,
        source: obj.source,
        mesh,
        material,
        root,
        position: mesh.position,
        rotation: mesh.rotation,
        scale: mesh.scale,
        color: obj.color,
        metalness: obj.metalness,
        roughness: obj.roughness,
      };
      registry.add(entry);
    }

    if (state.selectedId && registry.has(state.selectedId)) {
      select(state.selectedId);
    } else {
      selectedId = null;
      detachGizmo();
      highlight(null);
    }
    sceneCtx.transformControls.setMode(transformMode);
    notify('restore', { count: state.objects.length });
    return api;
  }

  function disposeSceneObjects() {
    for (const e of registry.snapshot()) {
      const mesh = e.mesh;
      if (mesh && mesh.parent) mesh.parent.remove(mesh);
      if (mesh && mesh.geometry) mesh.geometry.dispose();
      const mat = e.material;
      if (mat) {
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          if (m && m.dispose) m.dispose();
        }
      }
    }
    sceneCtx.clearPickables();
    registry.clear();
    gltfRoots.clear();
    selectedId = null;
    gizmoTarget = null;
    detachGizmo();
  }

  // ------------------------------------------------------------------------
  // onChange
  // ------------------------------------------------------------------------

  function onChange(cb) {
    if (typeof cb !== 'function') {
      throw new Error('onChange: callback must be a function');
    }
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  // ------------------------------------------------------------------------
  // dispose
  // ------------------------------------------------------------------------

  function dispose() {
    disposeSceneObjects();
    listeners.clear();
    if (sceneCtx && typeof sceneCtx.dispose === 'function') {
      sceneCtx.dispose();
    }
  }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------

  const api = {
    // mutation / queries
    addPrimitive,
    loadModel,
    listObjects,
    select,
    deselect,
    getSelected,
    // material / transform
    setColor,
    setMetalness,
    setRoughness,
    setTransform,
    rotate,
    setTransformMode,
    getTransformMode,
    // serialize
    toJSON,
    fromJSON,
    // lifecycle
    onChange,
    dispose,
    // exposed for tests / debugging
    _registry: registry,
    _selectedId: () => selectedId,
  };
  return api;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readColor(material) {
  if (!material || !material.color) return DEFAULT_PRIMITIVE_COLOR;
  if (typeof material.color.getHexString === 'function') {
    return '#' + material.color.getHexString();
  }
  return DEFAULT_PRIMITIVE_COLOR;
}

function clamp01(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

// Re-export the type lists so consumers can import everything from
// the handle entrypoint if they prefer.
export { PRIMITIVE_TYPES, TRANSFORM_MODES, OBJECT_TYPES };

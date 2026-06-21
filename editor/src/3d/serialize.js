/**
 * @file Pure JSON serialize / deserialize for 3D scene state.
 *
 *       The 3D engine's handle exposes `toJSON()` and `fromJSON(state)`
 *       so a scene can persist across reloads, snapshot mid-edit, or
 *       ship to the AI for inspection. We split the helpers from the
 *       Three.js scene code so they unit-test in plain Node without
 *       WebGL.
 *
 *       Scene state shape (what toJSON returns / fromJSON accepts):
 *
 *           {
 *             version: 1,
 *             objects: [
 *               {
 *                 id: "o-7",
 *                 name: "Box 1",
 *                 type: "box" | "sphere" | "cylinder" | "cone" |
 *                       "torus" | "plane" | "gltf",
 *                 source?: "https://.../model.glb",   // gltf only
 *                 position: [x, y, z],
 *                 rotation: [x, y, z],                 // degrees, Euler XYZ
 *                 scale:    [x, y, z],
 *                 color:    "#2dd4bf",                 // hex string
 *                 metalness: 0..1,
 *                 roughness: 0..1,
 *               },
 *               ...
 *             ],
 *             selectedId:   "o-7" | null,
 *             transformMode: "translate" | "rotate" | "scale",
 *           }
 *
 *       Round-trip stability contract (tested):
 *         - JSON.parse(JSON.stringify(state)) preserves everything
 *         - parseSceneState(buildSceneState(x)) deep-equals x for all
 *           field shapes that round-trip cleanly
 *         - The parse step is forgiving (clamps, falls back) and
 *           throws a descriptive error on truly malformed input
 *
 *       Run with: `node --test src/3d/`
 */

/** Current schema version. Bump on breaking changes; parseSceneState
 *  accepts any 1.x. */
export const SERIALIZE_VERSION = 1;

/** Object types the engine knows how to construct from a serialized
 *  scene. The runtime types may also include "gltf" once a model has
 *  been loaded — that's the only "loaded" kind we serialize. */
export const PRIMITIVE_TYPES = Object.freeze([
  'box', 'sphere', 'cylinder', 'cone', 'torus', 'plane',
]);
export const OBJECT_TYPES = Object.freeze([...PRIMITIVE_TYPES, 'gltf']);
export const TRANSFORM_MODES = Object.freeze(['translate', 'rotate', 'scale']);

const VALID_TYPES_SET = new Set(OBJECT_TYPES);
const VALID_MODES_SET = new Set(TRANSFORM_MODES);

/**
 * @typedef {Object} SerializedObject
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} [source]
 * @property {[number,number,number]} position
 * @property {[number,number,number]} rotation
 * @property {[number,number,number]} scale
 * @property {string} color
 * @property {number} metalness
 * @property {number} roughness
 */

/**
 * @typedef {Object} SceneState
 * @property {number} version
 * @property {SerializedObject[]} objects
 * @property {string|null} selectedId
 * @property {string} transformMode
 */

/**
 * Build a normalized SceneState from a live engine snapshot.
 *
 * The input may have either the runtime shape (Vector3 / Euler
 * duck-typed objects with .x/.y/.z) or already-serialized
 * length-3 arrays. Both are accepted because `toJSON()` and
 * `fromJSON()` both call through here — round-trip stable.
 *
 * @param {{
 *   objects: Array<{
 *     id: string|number,
 *     name?: string,
 *     type: string,
 *     source?: string,
 *     position?: Array|{x:number,y:number,z:number},
 *     rotation?: Array|{x:number,y:number,z:number},
 *     scale?:    Array|{x:number,y:number,z:number},
 *     color?: string|number,
 *     metalness?: number,
 *     roughness?: number,
 *   }>,
 *   selectedId?: string|null,
 *   transformMode?: string,
 * }} input
 * @returns {SceneState}
 */
export function buildSceneState(input = {}) {
  const objects = Array.isArray(input.objects) ? input.objects : [];
  return {
    version: SERIALIZE_VERSION,
    objects: objects.map(normalizeObject),
    selectedId: input.selectedId == null ? null : String(input.selectedId),
    transformMode: normalizeTransformMode(input.transformMode),
  };
}

/**
 * Convenience: build + JSON.stringify. Output is a single line so
 * the editor can drop it into a `<script type="application/json">`
 * tag or localStorage without whitespace bloat.
 *
 * @param {object} input
 * @returns {string}
 */
export function serializeScene(input) {
  return JSON.stringify(buildSceneState(input));
}

/**
 * Convenience: JSON.parse + parseSceneState. Accepts either a JSON
 * string or an already-parsed object (handy for round-trip tests).
 *
 * @param {string|object} json
 * @returns {SceneState}
 */
export function deserializeScene(json) {
  if (json == null) throw new Error('deserializeScene: input required');
  const obj = typeof json === 'string' ? JSON.parse(json) : json;
  return parseSceneState(obj);
}

/**
 * Validate + normalize a SceneState object. Throws on malformed
 * input; returns a fresh object with safe defaults filled in.
 *
 * @param {object} state
 * @returns {SceneState}
 */
export function parseSceneState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('parseSceneState: state must be an object');
  }

  const version = state.version;
  if (version !== SERIALIZE_VERSION) {
    if (typeof version !== 'number' || Math.floor(version) !== 1) {
      throw new Error(
        `parseSceneState: unsupported version ${version} (expected ${SERIALIZE_VERSION})`,
      );
    }
    // Future 1.x versions are accepted by the parser but coerced
    // down to the current one so consumers don't see a version bump
    // they can't handle.
  }

  if (!Array.isArray(state.objects)) {
    throw new Error('parseSceneState: objects must be an array');
  }

  const objects = state.objects.map((o, i) => normalizeParsedObject(o, i));
  const selectedId = state.selectedId == null ? null : String(state.selectedId);
  const transformMode = normalizeTransformMode(state.transformMode);

  return {
    version: SERIALIZE_VERSION,
    objects,
    selectedId,
    transformMode,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeObject(o, i) {
  if (!o || typeof o !== 'object') {
    throw new Error(`buildSceneState: objects[${i}] must be an object`);
  }
  return {
    id: String(o.id ?? `o-${i + 1}`),
    name: String(o.name ?? o.id ?? `Object ${i + 1}`),
    type: normalizeType(o.type, i),
    source: o.source != null ? String(o.source) : undefined,
    position: tupleFrom(o.position, 'position', i, [0, 0, 0], 0),
    rotation: tupleFrom(o.rotation, 'rotation', i, [0, 0, 0], 0),
    scale: tupleFrom(o.scale, 'scale', i, [1, 1, 1], 1),
    color: normalizeColor(o.color, '#cccccc'),
    metalness: clamp01(o.metalness, 0.1),
    roughness: clamp01(o.roughness, 0.8),
  };
}

function normalizeParsedObject(o, i) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    throw new Error(`parseSceneState: objects[${i}] must be an object`);
  }
  if (!o.id) throw new Error(`parseSceneState: objects[${i}].id required`);
  return {
    id: String(o.id),
    name: String(o.name ?? o.id),
    type: normalizeType(o.type, i),
    source: o.source != null ? String(o.source) : undefined,
    position: tupleFrom(o.position, 'position', i, [0, 0, 0], 0),
    rotation: tupleFrom(o.rotation, 'rotation', i, [0, 0, 0], 0),
    scale: tupleFrom(o.scale, 'scale', i, [1, 1, 1], 1),
    color: normalizeColor(o.color, '#cccccc'),
    metalness: clamp01(o.metalness, 0.1),
    roughness: clamp01(o.roughness, 0.8),
  };
}

function normalizeType(t, i) {
  const s = String(t ?? '');
  if (!VALID_TYPES_SET.has(s)) {
    throw new Error(
      `parseSceneState: objects[${i}].type "${t}" invalid — must be one of ${OBJECT_TYPES.join(', ')}`,
    );
  }
  return s;
}

function normalizeTransformMode(m) {
  if (m == null) return 'translate';
  const s = String(m);
  if (!VALID_MODES_SET.has(s)) {
    throw new Error(`parseSceneState: transformMode "${m}" invalid — must be one of ${TRANSFORM_MODES.join(', ')}`);
  }
  return s;
}

function tupleFrom(v, name, i, fallback, defaultComp) {
  if (v == null) return [fallback[0], fallback[1], fallback[2]];
  if (Array.isArray(v)) {
    if (v.length !== 3) {
      throw new Error(`parseSceneState: objects[${i}].${name} must have length 3 (got ${v.length})`);
    }
    return [
      Number.isFinite(Number(v[0])) ? Number(v[0]) : defaultComp,
      Number.isFinite(Number(v[1])) ? Number(v[1]) : defaultComp,
      Number.isFinite(Number(v[2])) ? Number(v[2]) : defaultComp,
    ];
  }
  if (typeof v === 'object') {
    return [
      Number.isFinite(Number(v.x)) ? Number(v.x) : defaultComp,
      Number.isFinite(Number(v.y)) ? Number(v.y) : defaultComp,
      Number.isFinite(Number(v.z)) ? Number(v.z) : defaultComp,
    ];
  }
  throw new Error(`parseSceneState: objects[${i}].${name} must be array or {x,y,z}`);
}

function normalizeColor(c, fallback) {
  if (c == null) return fallback;
  // Accept THREE.Color (has .getHexString), hex number, or string.
  if (typeof c === 'object' && typeof c.getHexString === 'function') {
    return '#' + c.getHexString();
  }
  if (typeof c === 'number' && Number.isFinite(c)) {
    return '#' + c.toString(16).padStart(6, '0');
  }
  if (typeof c === 'string') {
    return c.startsWith('#') ? c : `#${c}`;
  }
  return fallback;
}

function clamp01(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * @file Pure transform helpers — operate on plain JS objects, no Three.js.
 *
 *       The 3D engine's handle API returns / accepts transform state as
 *       plain objects of the form
 *
 *           { position: [x, y, z], rotation: [x, y, z], scale: [x, y, z] }
 *
 *       so they are:
 *         - JSON-friendly (round-trip via serialize.js without weirdness)
 *         - easy to test in node (no WebGL, no DOM, no Three.js dep)
 *         - trivial to apply to a THREE.Object3D via `applyToObject3D()`
 *
 *       Rotations are Euler angles in DEGREES, in Three.js's default
 *       'XYZ' order — same units the editor exposes on screen. Keep
 *       degrees; never silently switch to radians here.
 *
 *       All functions in this module are PURE: no mutation of inputs,
 *       no globals, no I/O. The 3D engine calls them from the handle
 *       to compute new states; the handle then applies the state to
 *       live Three.js objects.
 *
 *       Public surface:
 *         - makeState({ position?, rotation?, scale? }) -> TransformState
 *         - applyTransform(state, opts)                 -> TransformState
 *         - rotateBy(state, axis, degrees)              -> TransformState
 *         - clampScale(state, min?)                     -> TransformState
 *         - positionArray(state) / rotationArray(state) / scaleArray(state)
 *         - applyToObject3D(obj, state)                 -> obj     (side effect)
 *         - readFromObject3D(obj)                       -> TransformState
 *         - identity()                                  -> TransformState
 *
 *       Run with: `node --test src/3d/`
 */

const DEFAULT_POSITION = [0, 0, 0];
const DEFAULT_ROTATION = [0, 0, 0];
const DEFAULT_SCALE = [1, 1, 1];

const AXIS_INDEX = { x: 0, y: 1, z: 2, X: 0, Y: 1, Z: 2 };

/**
 * @typedef {Object} TransformState
 * @property {[number, number, number]} position
 * @property {[number, number, number]} rotation  - degrees, Euler XYZ
 * @property {[number, number, number]} scale
 */

/**
 * Coerce a length-3 array-ish value (array, {x,y,z}, or null) to a
 * [n,n,n] tuple. Used internally by makeState/applyToObject3D.
 *
 * @param {Array | {x:number, y:number, z:number} | null | undefined} v
 * @param {[number,number,number]} fallback
 * @returns {[number,number,number]}
 */
export function toTuple(v, fallback) {
  if (v == null) return [fallback[0], fallback[1], fallback[2]];
  if (Array.isArray(v)) {
    if (v.length !== 3) {
      throw new Error(`toTuple: expected length 3, got ${v.length}`);
    }
    return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
  }
  if (typeof v === 'object' && ('x' in v || 'y' in v || 'z' in v)) {
    return [Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0];
  }
  throw new Error('toTuple: expected array, {x,y,z}, or null');
}

/**
 * Construct a new TransformState. Missing fields fall back to the
 * identity for that component (position 0,0,0; rotation 0,0,0;
 * scale 1,1,1).
 *
 * @param {{ position?: Array|{x,y,z}, rotation?: Array|{x,y,z}, scale?: Array|{x,y,z} }} [opts]
 * @returns {TransformState}
 */
export function makeState(opts = {}) {
  return {
    position: toTuple(opts.position, DEFAULT_POSITION),
    rotation: toTuple(opts.rotation, DEFAULT_ROTATION),
    scale: toTuple(opts.scale, DEFAULT_SCALE),
  };
}

/**
 * Identity transform — all defaults.
 * @returns {TransformState}
 */
export function identity() {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

/**
 * Apply a partial transform on top of an existing state and return a
 * NEW state. Inputs are not mutated. Any of position / rotation /
 * scale may be omitted to keep the current value.
 *
 * @param {TransformState} state
 * @param {{ position?: Array|{x,y,z}, rotation?: Array|{x,y,z}, scale?: Array|{x,y,z} }} [opts]
 * @returns {TransformState}
 */
export function applyTransform(state, opts = {}) {
  if (!state || typeof state !== 'object') {
    throw new Error('applyTransform: state required');
  }
  return makeState({
    position: opts.position !== undefined ? opts.position : state.position,
    rotation: opts.rotation !== undefined ? opts.rotation : state.rotation,
    scale: opts.scale !== undefined ? opts.scale : state.scale,
  });
}

/**
 * Add `degrees` to a single rotation axis and return a NEW state.
 * Unknown axis throws.
 *
 * @param {TransformState} state
 * @param {'x'|'y'|'z'|'X'|'Y'|'Z'} axis
 * @param {number} degrees
 * @returns {TransformState}
 */
export function rotateBy(state, axis, degrees) {
  if (!state) throw new Error('rotateBy: state required');
  const i = AXIS_INDEX[axis];
  if (i === undefined) {
    throw new Error(`rotateBy: invalid axis "${axis}" — use 'x' | 'y' | 'z'`);
  }
  const d = Number(degrees);
  if (!Number.isFinite(d)) {
    throw new Error(`rotateBy: degrees must be a finite number, got ${degrees}`);
  }
  const rotation = [state.rotation[0], state.rotation[1], state.rotation[2]];
  rotation[i] = (Number(rotation[i]) || 0) + d;
  return {
    position: [state.position[0], state.position[1], state.position[2]],
    rotation,
    scale: [state.scale[0], state.scale[1], state.scale[2]],
  };
}

/**
 * Clamp each scale component to a minimum absolute value. Negative
 * scale flips the mesh; we keep the sign but enforce a minimum
 * magnitude so handles can't crash the gizmo at 0.
 *
 * @param {TransformState} state
 * @param {number} [min=0.0001]
 * @returns {TransformState}
 */
export function clampScale(state, min = 0.0001) {
  if (!state) throw new Error('clampScale: state required');
  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0) {
    throw new Error(`clampScale: min must be a positive finite number, got ${min}`);
  }
  return {
    position: [state.position[0], state.position[1], state.position[2]],
    rotation: [state.rotation[0], state.rotation[1], state.rotation[2]],
    scale: state.scale.map((s) => {
      const n = Number(s);
      if (!Number.isFinite(n) || n === 0) return m; // treat 0 / NaN as min
      return Math.sign(n) * Math.max(m, Math.abs(n));
    }),
  };
}

/** @returns {[number,number,number]} */
export function positionArray(state) {
  return [state.position[0], state.position[1], state.position[2]];
}
/** @returns {[number,number,number]} */
export function rotationArray(state) {
  return [state.rotation[0], state.rotation[1], state.rotation[2]];
}
/** @returns {[number,number,number]} */
export function scaleArray(state) {
  return [state.scale[0], state.scale[1], state.scale[2]];
}

/**
 * Apply a TransformState to a Three.js Object3D (or any object that
 * duck-types position / rotation / scale with `.set(x,y,z)`). Mutates
 * the object in place and returns it for chaining. Used by the engine
 * glue; never imported by tests.
 *
 * @param {{ position?: {set:(x,y,z)=>any}, rotation?: {set:(x,y,z)=>any}, scale?: {set:(x,y,z)=>any} }} obj
 * @param {TransformState} state
 * @returns {object}
 */
export function applyToObject3D(obj, state) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('applyToObject3D: object required');
  }
  if (!state) throw new Error('applyToObject3D: state required');
  if (obj.position && typeof obj.position.set === 'function') {
    obj.position.set(state.position[0], state.position[1], state.position[2]);
  }
  if (obj.rotation && typeof obj.rotation.set === 'function') {
    obj.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
  }
  if (obj.scale && typeof obj.scale.set === 'function') {
    obj.scale.set(state.scale[0], state.scale[1], state.scale[2]);
  }
  return obj;
}

/**
 * Read a TransformState back from a Three.js Object3D (or duck-typed).
 * Used by `toJSON` and by tests.
 *
 * @param {{ position?: {x:number,y:number,z:number}, rotation?: {x:number,y:number,z:number}, scale?: {x:number,y:number,z:number} }} obj
 * @returns {TransformState}
 */
export function readFromObject3D(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('readFromObject3D: object required');
  }
  return makeState({
    position: obj.position ? [obj.position.x, obj.position.y, obj.position.z] : undefined,
    rotation: obj.rotation ? [obj.rotation.x, obj.rotation.y, obj.rotation.z] : undefined,
    scale: obj.scale ? [obj.scale.x, obj.scale.y, obj.scale.z] : undefined,
  });
}

/**
 * Two TransformStates are "equal" when their numeric components match
 * exactly. Used by the round-trip / idempotence tests.
 *
 * @param {TransformState} a
 * @param {TransformState} b
 * @returns {boolean}
 */
export function statesEqual(a, b) {
  if (!a || !b) return a === b;
  for (let i = 0; i < 3; i++) {
    if (a.position[i] !== b.position[i]) return false;
    if (a.rotation[i] !== b.rotation[i]) return false;
    if (a.scale[i] !== b.scale[i]) return false;
  }
  return true;
}

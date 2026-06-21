/**
 * @file Tests for the pure transform helpers (no Three.js, no DOM).
 *
 *       Covers:
 *         - makeState defaults
 *         - toTuple: arrays, {x,y,z}, null, length errors
 *         - applyTransform: partial / full / identity preservation
 *         - rotateBy: axis index, accumulation, error on bad axis / NaN
 *         - clampScale: minimum magnitude, sign preservation, zero handling
 *         - positionArray / rotationArray / scaleArray: pure copies
 *         - applyToObject3D / readFromObject3D: duck-typed bridge
 *         - statesEqual: equality
 *         - identity matches defaults
 *
 *       Run with: `node --test src/3d/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toTuple,
  makeState,
  identity,
  applyTransform,
  rotateBy,
  clampScale,
  positionArray,
  rotationArray,
  scaleArray,
  applyToObject3D,
  readFromObject3D,
  statesEqual,
} from './transform.js';

// ---------------------------------------------------------------------------
// makeState / identity
// ---------------------------------------------------------------------------

test('makeState: defaults to identity (position 0,0,0 rotation 0,0,0 scale 1,1,1)', () => {
  const s = makeState();
  assert.deepEqual(s.position, [0, 0, 0]);
  assert.deepEqual(s.rotation, [0, 0, 0]);
  assert.deepEqual(s.scale, [1, 1, 1]);
});

test('identity: same as makeState()', () => {
  assert.deepEqual(identity(), makeState());
});

test('makeState: accepts arrays of length 3', () => {
  const s = makeState({ position: [1, 2, 3], rotation: [10, 20, 30], scale: [2, 3, 4] });
  assert.deepEqual(s.position, [1, 2, 3]);
  assert.deepEqual(s.rotation, [10, 20, 30]);
  assert.deepEqual(s.scale, [2, 3, 4]);
});

test('makeState: accepts {x,y,z} shaped values', () => {
  const s = makeState({
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 4, y: 5, z: 6 },
    scale:    { x: 7, y: 8, z: 9 },
  });
  assert.deepEqual(s.position, [1, 2, 3]);
  assert.deepEqual(s.rotation, [4, 5, 6]);
  assert.deepEqual(s.scale, [7, 8, 9]);
});

test('makeState: only some fields provided → missing fall back to defaults', () => {
  const s = makeState({ position: [1, 2, 3] });
  assert.deepEqual(s.position, [1, 2, 3]);
  assert.deepEqual(s.rotation, [0, 0, 0]);
  assert.deepEqual(s.scale, [1, 1, 1]);
});

// ---------------------------------------------------------------------------
// toTuple
// ---------------------------------------------------------------------------

test('toTuple: array → tuple', () => {
  assert.deepEqual(toTuple([1, 2, 3], [0, 0, 0]), [1, 2, 3]);
});

test('toTuple: null / undefined → fallback', () => {
  assert.deepEqual(toTuple(null, [9, 9, 9]), [9, 9, 9]);
  assert.deepEqual(toTuple(undefined, [9, 9, 9]), [9, 9, 9]);
});

test('toTuple: {x,y,z} object → tuple', () => {
  assert.deepEqual(toTuple({ x: 1, y: 2, z: 3 }, [0, 0, 0]), [1, 2, 3]);
});

test('toTuple: bad length throws', () => {
  assert.throws(() => toTuple([1, 2], [0, 0, 0]), /length 3/);
});

test('toTuple: bad shape throws', () => {
  assert.throws(() => toTuple(42, [0, 0, 0]), /expected array/);
});

// ---------------------------------------------------------------------------
// applyTransform
// ---------------------------------------------------------------------------

test('applyTransform: partial update keeps other fields', () => {
  const a = makeState({ position: [1, 2, 3], rotation: [4, 5, 6], scale: [7, 8, 9] });
  const b = applyTransform(a, { position: [10, 20, 30] });
  assert.deepEqual(b.position, [10, 20, 30]);
  assert.deepEqual(b.rotation, [4, 5, 6]);
  assert.deepEqual(b.scale, [7, 8, 9]);
});

test('applyTransform: full update replaces all fields', () => {
  const a = makeState();
  const b = applyTransform(a, { position: [1, 1, 1], rotation: [2, 2, 2], scale: [3, 3, 3] });
  assert.deepEqual(b.position, [1, 1, 1]);
  assert.deepEqual(b.rotation, [2, 2, 2]);
  assert.deepEqual(b.scale, [3, 3, 3]);
});

test('applyTransform: empty opts returns equivalent new state', () => {
  const a = makeState({ position: [1, 2, 3] });
  const b = applyTransform(a, {});
  assert.deepEqual(b, a);
  assert.notEqual(b, a, 'applyTransform returns a fresh object');
});

test('applyTransform: does NOT mutate the input', () => {
  const a = makeState({ position: [1, 2, 3] });
  const before = JSON.stringify(a);
  applyTransform(a, { position: [9, 9, 9], rotation: [8, 8, 8], scale: [7, 7, 7] });
  assert.equal(JSON.stringify(a), before);
});

test('applyTransform: requires state', () => {
  assert.throws(() => applyTransform(null, {}), /state required/);
  assert.throws(() => applyTransform(undefined, {}), /state required/);
});

// ---------------------------------------------------------------------------
// rotateBy
// ---------------------------------------------------------------------------

test('rotateBy: x axis accumulates', () => {
  const a = makeState({ rotation: [10, 20, 30] });
  const b = rotateBy(a, 'x', 5);
  assert.deepEqual(b.rotation, [15, 20, 30]);
  // Original is untouched.
  assert.deepEqual(a.rotation, [10, 20, 30]);
});

test('rotateBy: y / z axes', () => {
  const a = makeState();
  assert.deepEqual(rotateBy(a, 'y', 45).rotation, [0, 45, 0]);
  assert.deepEqual(rotateBy(a, 'z', 90).rotation, [0, 0, 90]);
});

test('rotateBy: case-insensitive axis', () => {
  const a = makeState();
  assert.deepEqual(rotateBy(a, 'X', 1).rotation, [1, 0, 0]);
  assert.deepEqual(rotateBy(a, 'Z', 1).rotation, [0, 0, 1]);
});

test('rotateBy: bad axis throws', () => {
  const a = makeState();
  assert.throws(() => rotateBy(a, 'w', 10), /invalid axis/);
});

test('rotateBy: NaN degrees throws', () => {
  const a = makeState();
  assert.throws(() => rotateBy(a, 'x', NaN), /finite number/);
});

test('rotateBy: zero degrees is a no-op rotation', () => {
  const a = makeState({ rotation: [1, 2, 3] });
  assert.deepEqual(rotateBy(a, 'y', 0), { position: [0, 0, 0], rotation: [1, 2, 3], scale: [1, 1, 1] });
});

test('rotateBy: negative degrees rotate the other way', () => {
  const a = makeState({ rotation: [10, 10, 10] });
  const b = rotateBy(a, 'y', -5);
  assert.deepEqual(b.rotation, [10, 5, 10]);
});

// ---------------------------------------------------------------------------
// clampScale
// ---------------------------------------------------------------------------

test('clampScale: positive scale is preserved', () => {
  const a = makeState({ scale: [2, 3, 4] });
  assert.deepEqual(clampScale(a).scale, [2, 3, 4]);
});

test('clampScale: zero scale replaced with min; small negative scale replaced with -min', () => {
  const a = makeState({ scale: [0, -0.0001, 4] });
  const b = clampScale(a, 0.01);
  assert.equal(b.scale[0], 0.01);
  assert.equal(b.scale[1], -0.01, 'sign of tiny negative scale preserved');
  assert.equal(b.scale[2], 4);
});

test('clampScale: large negative scale preserved (magnitude > min)', () => {
  const a = makeState({ scale: [-5, -10, 2] });
  const b = clampScale(a, 0.01);
  assert.equal(b.scale[0], -5);
  assert.equal(b.scale[1], -10);
  assert.equal(b.scale[2], 2);
});

test('clampScale: tiny positive scale clamped to min', () => {
  const a = makeState({ scale: [0.0000001, 1, 1] });
  const b = clampScale(a, 0.01);
  assert.equal(b.scale[0], 0.01);
});

test('clampScale: bad min throws', () => {
  const a = makeState();
  assert.throws(() => clampScale(a, 0), /positive finite/);
  assert.throws(() => clampScale(a, -1), /positive finite/);
});

// ---------------------------------------------------------------------------
// positionArray / rotationArray / scaleArray
// ---------------------------------------------------------------------------

test('positionArray / rotationArray / scaleArray: return copies', () => {
  const s = makeState({ position: [1, 2, 3], rotation: [4, 5, 6], scale: [7, 8, 9] });
  assert.deepEqual(positionArray(s), [1, 2, 3]);
  assert.deepEqual(rotationArray(s), [4, 5, 6]);
  assert.deepEqual(scaleArray(s), [7, 8, 9]);

  // Mutate the returned arrays — original state is untouched.
  const p = positionArray(s); p[0] = 999;
  assert.equal(s.position[0], 1, 'original position should not be mutated');
});

// ---------------------------------------------------------------------------
// applyToObject3D / readFromObject3D
// ---------------------------------------------------------------------------

test('applyToObject3D: writes position/rotation/scale to a duck-typed object', () => {
  let written = { x: 0, y: 0, z: 0 };
  const makeVec = () => {
    const v = { x: 0, y: 0, z: 0 };
    v.set = (x, y, z) => { v.x = x; v.y = y; v.z = z; return v; };
    return v;
  };
  const obj = {
    position: makeVec(),
    rotation: makeVec(),
    scale:    makeVec(),
  };
  const s = makeState({ position: [1, 2, 3], rotation: [4, 5, 6], scale: [7, 8, 9] });
  applyToObject3D(obj, s);
  assert.equal(written.x, 0); // sanity
  assert.equal(obj.position.x, 1);
  assert.equal(obj.position.y, 2);
  assert.equal(obj.position.z, 3);
  assert.equal(obj.rotation.x, 4);
  assert.equal(obj.scale.x, 7);
  assert.equal(obj.scale.y, 8);
  assert.equal(obj.scale.z, 9);
});

test('applyToObject3D: throws on bad input', () => {
  assert.throws(() => applyToObject3D(null, makeState()), /object required/);
  assert.throws(() => applyToObject3D({}, null), /state required/);
});

test('readFromObject3D: extracts position/rotation/scale from a duck-typed object', () => {
  const obj = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 4, y: 5, z: 6 },
    scale:    { x: 7, y: 8, z: 9 },
  };
  const s = readFromObject3D(obj);
  assert.deepEqual(s.position, [1, 2, 3]);
  assert.deepEqual(s.rotation, [4, 5, 6]);
  assert.deepEqual(s.scale, [7, 8, 9]);
});

test('readFromObject3D: missing components fall back to defaults', () => {
  const s = readFromObject3D({ position: { x: 1, y: 2, z: 3 } });
  assert.deepEqual(s.position, [1, 2, 3]);
  assert.deepEqual(s.rotation, [0, 0, 0]);
  assert.deepEqual(s.scale, [1, 1, 1]);
});

// ---------------------------------------------------------------------------
// statesEqual
// ---------------------------------------------------------------------------

test('statesEqual: identical states are equal', () => {
  const a = makeState({ position: [1, 2, 3], rotation: [4, 5, 6], scale: [7, 8, 9] });
  const b = makeState({ position: [1, 2, 3], rotation: [4, 5, 6], scale: [7, 8, 9] });
  assert.equal(statesEqual(a, b), true);
});

test('statesEqual: differing states are not equal', () => {
  const a = makeState({ position: [1, 2, 3] });
  const b = makeState({ position: [1, 2, 4] });
  assert.equal(statesEqual(a, b), false);
});

test('statesEqual: two nulls are equal, mixed null/obj are not', () => {
  assert.equal(statesEqual(null, null), true);
  assert.equal(statesEqual(null, makeState()), false);
});

// ---------------------------------------------------------------------------
// Idempotence / round-trip sanity
// ---------------------------------------------------------------------------

test('applyTransform then readFromObject3D yields the same shape', () => {
  const makeVec = (x = 0, y = 0, z = 0) => {
    const v = { x, y, z };
    v.set = (nx, ny, nz) => { v.x = nx; v.y = ny; v.z = nz; return v; };
    return v;
  };
  const obj = {
    position: makeVec(),
    rotation: makeVec(),
    scale: makeVec(1, 1, 1),
  };
  applyToObject3D(obj, makeState({
    position: [1.5, -2, 3.25],
    rotation: [10, 20, 30],
    scale: [0.5, 1.5, 2.5],
  }));
  const s = readFromObject3D(obj);
  assert.deepEqual(s.position, [1.5, -2, 3.25]);
  assert.deepEqual(s.rotation, [10, 20, 30]);
  assert.deepEqual(s.scale, [0.5, 1.5, 2.5]);
});

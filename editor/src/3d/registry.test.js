/**
 * @file Tests for the pure object registry (no Three.js, no DOM).
 *
 *       Covers:
 *         - add / remove / get / has / size / clear
 *         - list() returns the shape the UI panel consumes
 *         - list() only includes sub-meshes (parent entries hidden)
 *         - snapshot() returns the shape toJSON() consumes
 *         - replaceAll() wipes and re-installs entries
 *         - nextId() generates sequential ids
 *
 *       Run with: `node --test src/3d/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createObjectRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// add / remove / get / has / size / clear
// ---------------------------------------------------------------------------

test('add: registers an entry and returns its id', () => {
  const r = createObjectRegistry();
  const id = r.add({ id: 'o-1', type: 'box', name: 'Box' });
  assert.equal(id, 'o-1');
  assert.equal(r.size(), 1);
});

test('add: requires id and type', () => {
  const r = createObjectRegistry();
  assert.throws(() => r.add({ type: 'box' }), /id required/);
  assert.throws(() => r.add({ id: 'o-1' }), /type required/);
});

test('get / has / remove', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-1', type: 'box' });
  r.add({ id: 'o-2', type: 'sphere' });
  assert.equal(r.has('o-1'), true);
  assert.equal(r.has('o-3'), false);
  assert.equal(r.get('o-1').type, 'box');
  assert.equal(r.remove('o-1'), true);
  assert.equal(r.has('o-1'), false);
  assert.equal(r.remove('o-1'), false, 'removing a missing id returns false');
  assert.equal(r.size(), 1);
});

test('clear: empties everything and resets counter', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-1', type: 'box' });
  r.add({ id: 'o-2', type: 'sphere' });
  r.clear();
  assert.equal(r.size(), 0);
  // After clear, nextId starts fresh at 1.
  assert.equal(r.nextId(), 'o-1');
});

// ---------------------------------------------------------------------------
// list — the shape the UI panel consumes
// ---------------------------------------------------------------------------

test('list: flat list of { id, name, type } (source when present)', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-1', type: 'box',   name: 'Box' });
  r.add({ id: 'o-2', type: 'sphere', name: 'Ball' });
  const list = r.list();
  assert.deepEqual(list, [
    { id: 'o-1', name: 'Box',  type: 'box' },
    { id: 'o-2', name: 'Ball', type: 'sphere' },
  ]);
});

test('list: hides internal __parent entries', () => {
  const r = createObjectRegistry();
  r.add({ id: 'm-1', type: 'gltf', name: 'Robot', __parent: true, __childIds: ['m-1__mesh_0'] });
  r.add({ id: 'm-1__mesh_0', type: 'gltf', name: 'Robot arm', source: 'robot.glb' });
  const list = r.list();
  assert.equal(list.length, 1, 'parent entry hidden from UI');
  assert.equal(list[0].id, 'm-1__mesh_0');
  assert.equal(list[0].source, 'robot.glb');
});

test('list: missing name falls back to id', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-1', type: 'box' });
  assert.equal(r.list()[0].name, 'o-1');
});

// ---------------------------------------------------------------------------
// snapshot — the shape toJSON() consumes
// ---------------------------------------------------------------------------

test('snapshot: includes position/rotation/scale/color/metalness/roughness', () => {
  const r = createObjectRegistry();
  r.add({
    id: 'o-1', type: 'box', name: 'Box',
    position: [1, 2, 3], rotation: [10, 20, 30], scale: [2, 2, 2],
    color: '#ff00aa', metalness: 0.4, roughness: 0.6,
  });
  const snap = r.snapshot();
  assert.equal(snap.length, 1);
  assert.deepEqual(snap[0].position, [1, 2, 3]);
  assert.deepEqual(snap[0].rotation, [10, 20, 30]);
  assert.deepEqual(snap[0].scale, [2, 2, 2]);
  assert.equal(snap[0].color, '#ff00aa');
  assert.equal(snap[0].metalness, 0.4);
  assert.equal(snap[0].roughness, 0.6);
});

test('snapshot: reads Three.js Vector3 / Euler duck-typed values', () => {
  const r = createObjectRegistry();
  r.add({
    id: 'o-1', type: 'box',
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0 },
    scale:    { x: 1, y: 1, z: 1 },
    color: { getHexString: () => '00ffaa' },
  });
  const snap = r.snapshot();
  assert.deepEqual(snap[0].position, [1, 2, 3]);
  assert.deepEqual(snap[0].scale, [1, 1, 1]);
  assert.equal(snap[0].color, '#00ffaa');
});

test('snapshot: defaults for missing fields', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-1', type: 'box' });
  const s = r.snapshot()[0];
  assert.deepEqual(s.position, [0, 0, 0]);
  assert.deepEqual(s.rotation, [0, 0, 0]);
  assert.deepEqual(s.scale, [1, 1, 1]);
  assert.equal(s.color, '#cccccc');
  assert.equal(s.metalness, 0.1);
  assert.equal(s.roughness, 0.8);
});

// ---------------------------------------------------------------------------
// replaceAll / nextId
// ---------------------------------------------------------------------------

test('replaceAll: wipes and re-installs', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-1', type: 'box' });
  r.add({ id: 'o-2', type: 'sphere' });
  r.replaceAll([{ id: 'p-1', type: 'plane' }]);
  assert.equal(r.size(), 1);
  assert.equal(r.has('p-1'), true);
  assert.equal(r.has('o-1'), false);
});

test('replaceAll: empty / non-array is a clear', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-1', type: 'box' });
  r.replaceAll([]);
  assert.equal(r.size(), 0);
  r.add({ id: 'o-1', type: 'box' });
  r.replaceAll(null);
  assert.equal(r.size(), 0);
});

test('nextId: sequential, with custom prefix', () => {
  const r = createObjectRegistry();
  assert.equal(r.nextId(), 'o-1');
  assert.equal(r.nextId(), 'o-2');
  assert.equal(r.nextId('m'), 'm-3');
  assert.equal(r.nextId('m'), 'm-4');
});

test('nextId: counter advances past numeric suffix of explicit ids', () => {
  const r = createObjectRegistry();
  r.add({ id: 'o-9', type: 'box' });
  // After installing o-9 explicitly, nextId should still be at least 10.
  assert.equal(r.nextId(), 'o-10');
});

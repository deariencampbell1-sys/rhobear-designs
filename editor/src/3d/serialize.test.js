/**
 * @file Tests for the pure scene serializer (no Three.js, no DOM).
 *
 *       Covers:
 *         - buildSceneState normalizes input
 *         - serializeScene / deserializeScene round-trip is stable
 *         - parseSceneState rejects bad shapes
 *         - parseSceneState falls back gracefully on partial input
 *         - selectedId / transformMode persistence
 *         - color from THREE.Color-style or hex number or string
 *         - source field only present for 'gltf' types
 *         - listObjects shape (via registry snapshot) round-trips
 *
 *       Run with: `node --test src/3d/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SERIALIZE_VERSION,
  PRIMITIVE_TYPES,
  OBJECT_TYPES,
  TRANSFORM_MODES,
  serializeScene,
  deserializeScene,
  buildSceneState,
  parseSceneState,
} from './serialize.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test('SERIALIZE_VERSION is a positive integer', () => {
  assert.equal(typeof SERIALIZE_VERSION, 'number');
  assert.ok(SERIALIZE_VERSION >= 1);
});

test('PRIMITIVE_TYPES / OBJECT_TYPES / TRANSFORM_MODES lists', () => {
  assert.deepEqual([...PRIMITIVE_TYPES], ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane']);
  assert.ok(OBJECT_TYPES.includes('gltf'));
  assert.deepEqual([...TRANSFORM_MODES], ['translate', 'rotate', 'scale']);
});

// ---------------------------------------------------------------------------
// buildSceneState
// ---------------------------------------------------------------------------

test('buildSceneState: empty input → empty objects, defaults', () => {
  const s = buildSceneState({});
  assert.equal(s.version, SERIALIZE_VERSION);
  assert.deepEqual(s.objects, []);
  assert.equal(s.selectedId, null);
  assert.equal(s.transformMode, 'translate');
});

test('buildSceneState: normalizes a runtime-style entry', () => {
  const s = buildSceneState({
    objects: [
      {
        id: 'o-1',
        name: 'Box',
        type: 'box',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 10, y: 20, z: 30 },
        scale:    { x: 2, y: 2, z: 2 },
        color: '#2dd4bf',
        metalness: 0.4,
        roughness: 0.6,
      },
    ],
  });
  assert.equal(s.objects.length, 1);
  assert.equal(s.objects[0].id, 'o-1');
  assert.deepEqual(s.objects[0].position, [1, 2, 3]);
  assert.equal(s.objects[0].color, '#2dd4bf');
  assert.equal(s.objects[0].metalness, 0.4);
});

test('buildSceneState: coerces THREE.Color-like {getHexString}', () => {
  const colorObj = { getHexString: () => 'ff00aa' };
  const s = buildSceneState({
    objects: [{ id: 'x', type: 'sphere', color: colorObj }],
  });
  assert.equal(s.objects[0].color, '#ff00aa');
});

test('buildSceneState: coerces numeric color (hex int)', () => {
  const s = buildSceneState({
    objects: [{ id: 'x', type: 'sphere', color: 0x2dd4bf }],
  });
  assert.equal(s.objects[0].color, '#2dd4bf');
});

test('buildSceneState: missing color falls back to #cccccc', () => {
  const s = buildSceneState({
    objects: [{ id: 'x', type: 'sphere' }],
  });
  assert.equal(s.objects[0].color, '#cccccc');
});

test('buildSceneState: source field captured for gltf only', () => {
  const s = buildSceneState({
    objects: [
      { id: 'g', type: 'gltf', source: 'https://x.glb' },
      { id: 'b', type: 'box' },
    ],
  });
  assert.equal(s.objects[0].source, 'https://x.glb');
  assert.equal(s.objects[1].source, undefined);
});

test('buildSceneState: invalid type throws', () => {
  assert.throws(
    () => buildSceneState({ objects: [{ id: 'x', type: 'banana' }] }),
    /invalid — must be one of/,
  );
});

test('buildSceneState: missing type throws', () => {
  assert.throws(
    () => buildSceneState({ objects: [{ id: 'x' }] }),
    /invalid — must be one of/,
  );
});

test('buildSceneState: invalid transformMode throws', () => {
  assert.throws(
    () => buildSceneState({ objects: [], transformMode: 'pumpkin' }),
    /transformMode/,
  );
});

test('buildSceneState: missing transformMode defaults to translate', () => {
  const s = buildSceneState({ objects: [] });
  assert.equal(s.transformMode, 'translate');
});

// ---------------------------------------------------------------------------
// parseSceneState
// ---------------------------------------------------------------------------

test('parseSceneState: rejects non-object input', () => {
  assert.throws(() => parseSceneState(null), /state must be an object/);
  assert.throws(() => parseSceneState(42), /state must be an object/);
  assert.throws(() => parseSceneState('nope'), /state must be an object/);
});

test('parseSceneState: rejects wrong version', () => {
  assert.throws(
    () => parseSceneState({ version: 99, objects: [] }),
    /unsupported version/,
  );
});

test('parseSceneState: rejects missing objects array', () => {
  assert.throws(() => parseSceneState({ version: 1 }), /objects must be an array/);
});

test('parseSceneState: clamps metalness / roughness into [0,1]', () => {
  const s = parseSceneState({
    version: 1,
    objects: [
      { id: 'o-1', type: 'box', metalness: 5, roughness: -1 },
    ],
  });
  assert.equal(s.objects[0].metalness, 1);
  assert.equal(s.objects[0].roughness, 0);
});

test('parseSceneState: NaN / missing metalness falls back', () => {
  const s = parseSceneState({
    version: 1,
    objects: [
      { id: 'o-1', type: 'box', metalness: 'not a number', roughness: undefined },
    ],
  });
  assert.equal(typeof s.objects[0].metalness, 'number');
  assert.equal(s.objects[0].metalness, 0.1);
  assert.equal(s.objects[0].roughness, 0.8);
});

test('parseSceneState: rejects bad position shape', () => {
  assert.throws(
    () => parseSceneState({
      version: 1,
      objects: [{ id: 'o-1', type: 'box', position: [1, 2] }],
    }),
    /position must have length 3/,
  );
});

test('parseSceneState: missing arrays → defaults', () => {
  const s = parseSceneState({
    version: 1,
    objects: [{ id: 'o-1', type: 'box' }],
  });
  assert.deepEqual(s.objects[0].position, [0, 0, 0]);
  assert.deepEqual(s.objects[0].rotation, [0, 0, 0]);
  assert.deepEqual(s.objects[0].scale, [1, 1, 1]);
});

test('parseSceneState: object form {x,y,z} accepted', () => {
  const s = parseSceneState({
    version: 1,
    objects: [{ id: 'o-1', type: 'box', position: { x: 1, y: 2, z: 3 } }],
  });
  assert.deepEqual(s.objects[0].position, [1, 2, 3]);
});

test('parseSceneState: bad transformMode throws (be loud, not silent)', () => {
  assert.throws(
    () => parseSceneState({ version: 1, objects: [], transformMode: 'warp' }),
    /transformMode/,
  );
});

test('parseSceneState: missing transformMode defaults to translate', () => {
  const s = parseSceneState({ version: 1, objects: [] });
  assert.equal(s.transformMode, 'translate');
});

test('parseSceneState: selectedId persisted as string or null', () => {
  const a = parseSceneState({ version: 1, objects: [], selectedId: 7 });
  assert.equal(a.selectedId, '7');
  const b = parseSceneState({ version: 1, objects: [], selectedId: null });
  assert.equal(b.selectedId, null);
});

// ---------------------------------------------------------------------------
// serializeScene / deserializeScene round-trip
// ---------------------------------------------------------------------------

test('serializeScene → deserializeScene: simple scene', () => {
  const original = {
    objects: [
      {
        id: 'o-1', name: 'Box A', type: 'box',
        position: [1, 2, 3], rotation: [10, 20, 30], scale: [1, 1, 1],
        color: '#2dd4bf', metalness: 0.2, roughness: 0.7,
      },
      {
        id: 'o-2', name: 'Sphere', type: 'sphere',
        position: [-1, 0, 0.5], rotation: [0, 45, 0], scale: [2, 2, 2],
        color: '#7c5cff', metalness: 0.5, roughness: 0.3,
      },
    ],
    selectedId: 'o-2',
    transformMode: 'rotate',
  };
  const json = serializeScene(original);
  assert.equal(typeof json, 'string');
  const parsed = deserializeScene(json);
  assert.equal(parsed.version, SERIALIZE_VERSION);
  assert.equal(parsed.objects.length, 2);
  assert.equal(parsed.objects[0].id, 'o-1');
  assert.equal(parsed.objects[0].name, 'Box A');
  assert.equal(parsed.objects[0].type, 'box');
  assert.deepEqual(parsed.objects[0].position, [1, 2, 3]);
  assert.deepEqual(parsed.objects[0].rotation, [10, 20, 30]);
  assert.deepEqual(parsed.objects[0].scale, [1, 1, 1]);
  assert.equal(parsed.objects[0].color, '#2dd4bf');
  assert.equal(parsed.objects[1].id, 'o-2');
  assert.equal(parsed.selectedId, 'o-2');
  assert.equal(parsed.transformMode, 'rotate');
});

test('round-trip: many objects (stress)', () => {
  const original = {
    objects: Array.from({ length: 50 }, (_, i) => ({
      id: `o-${i}`,
      name: `Object ${i}`,
      type: PRIMITIVE_TYPES[i % PRIMITIVE_TYPES.length],
      position: [i * 0.5, Math.sin(i), Math.cos(i)],
      rotation: [0, i * 3, 0],
      scale: [1 + (i % 3) * 0.25, 1, 1],
      color: '#' + ((i * 0x123456) & 0xffffff).toString(16).padStart(6, '0'),
      metalness: (i % 10) / 10,
      roughness: ((i * 7) % 10) / 10,
    })),
    selectedId: 'o-7',
    transformMode: 'scale',
  };
  const a = serializeScene(original);
  const b = serializeScene(deserializeScene(a));
  assert.equal(a, b, 'serialize→deserialize→serialize must be byte-stable');
});

test('round-trip: gltf object preserves source', () => {
  const original = {
    objects: [
      {
        id: 'm-1', name: 'Robot', type: 'gltf',
        source: 'https://example.com/robot.glb',
        position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
        color: '#cccccc', metalness: 0.5, roughness: 0.5,
      },
    ],
    selectedId: null,
    transformMode: 'translate',
  };
  const a = serializeScene(original);
  const b = deserializeScene(a);
  assert.equal(b.objects[0].type, 'gltf');
  assert.equal(b.objects[0].source, 'https://example.com/robot.glb');
});

test('round-trip: serialize(deserialize(serialize(x))) is stable', () => {
  const x = {
    objects: [
      { id: 'o-1', type: 'box', color: '#ffaa00', metalness: 0.3, roughness: 0.6,
        position: [1, 2, 3], rotation: [4, 5, 6], scale: [7, 8, 9] },
    ],
    selectedId: 'o-1',
    transformMode: 'translate',
  };
  const a = serializeScene(x);
  const b = serializeScene(deserializeScene(a));
  assert.equal(a, b);
});

test('deserializeScene: accepts an already-parsed object', () => {
  const obj = { version: 1, objects: [], selectedId: null, transformMode: 'translate' };
  const s = deserializeScene(obj);
  assert.equal(s.version, 1);
});

// ---------------------------------------------------------------------------
// listObjects shape (the surface the UI lists in its panel)
// ---------------------------------------------------------------------------

test('listObjects shape (via registry + serialize): each row is {id, name, type, source?}', () => {
  // The engine's handle.listObjects() goes through the registry, but
  // its serialized equivalent is exactly the `objects` array. We
  // assert the SHAPE here so the UI panel can rely on it.
  const state = {
    objects: [
      { id: 'o-1', name: 'Box',  type: 'box' },
      { id: 'o-2', name: 'Ball', type: 'sphere' },
      { id: 'm-1__mesh_0', name: 'Robot arm', type: 'gltf', source: 'r.glb' },
    ],
    selectedId: null,
    transformMode: 'translate',
  };
  const json = serializeScene(state);
  const parsed = deserializeScene(json);
  for (const o of parsed.objects) {
    assert.equal(typeof o.id, 'string');
    assert.equal(typeof o.name, 'string');
    assert.equal(typeof o.type, 'string');
    assert.ok(OBJECT_TYPES.includes(o.type), `type ${o.type} must be in OBJECT_TYPES`);
    if (o.type === 'gltf') {
      assert.equal(typeof o.source, 'string', 'gltf rows must carry a source');
    }
  }
  assert.equal(parsed.objects.length, 3);
  assert.equal(parsed.objects[2].source, 'r.glb');
});

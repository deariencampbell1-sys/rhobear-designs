/**
 * @file 3D scene engine — public entrypoint.
 *
 *       `create3DScene(container, opts?) -> handle`
 *
 *       Mounts a fully-wired Three.js scene into `container` and
 *       returns a stable handle with the documented API:
 *
 *         addPrimitive(type)             -> id
 *         loadModel(urlOrFile)           -> Promise<id>
 *         listObjects()                  -> [{ id, name, type, source? }]
 *         select(id) / getSelected() / deselect()
 *         setColor(id, hex)
 *         setMetalness / setRoughness
 *         setTransform(id, { position?, rotation?, scale? })
 *         rotate(id, axis, deg)
 *         setTransformMode('translate' | 'rotate' | 'scale')
 *         toJSON() / fromJSON(state)
 *         onChange(cb) -> unsubscribe
 *         dispose()
 *
 *       Internals:
 *         - `scene.js`    — renderer, camera, scene, lights, environment,
 *                           ground, grid, controls, render loop, resize
 *         - `handle.js`   — selection, transforms, materials, serialize
 *         - `serialize.js` — pure JSON serializer (unit-tested in node)
 *         - `transform.js` — pure transform math (unit-tested in node)
 *         - `registry.js`  — pure selectable-object registry
 *
 *       The lane deliberately ships NO editor UI here. The Iron Man
 *       builds controls (color picker, transform mode toggle, list of
 *       "the 36 objects") on top of this API.
 *
 *       MIT — RHOBEAR Designs.
 */

export { create3DScene } from './create.js';
export {
  PRIMITIVE_TYPES,
  TRANSFORM_MODES,
  OBJECT_TYPES,
  SERIALIZE_VERSION,
  serializeScene,
  deserializeScene,
  buildSceneState,
  parseSceneState,
} from './serialize.js';
export {
  makeState,
  applyTransform,
  rotateBy,
  clampScale,
  identity,
  readFromObject3D,
  applyToObject3D,
  statesEqual,
} from './transform.js';
export { createObjectRegistry } from './registry.js';

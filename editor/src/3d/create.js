/**
 * @file `create3DScene` — the one public function the editor calls.
 *
 *       Wraps `setupThreeScene()` + `createHandle()` so consumers
 *       don't have to wire both pieces themselves. Options flow
 *       through to the renderer / camera / lights.
 *
 *       This file is intentionally tiny — its only job is composition.
 *       The real work lives in `scene.js` and `handle.js`.
 *
 *       MIT — RHOBEAR Designs.
 */

import { setupThreeScene } from './scene.js';
import { createHandle } from './handle.js';

/**
 * Create a 3D scene in `container` and return a handle.
 *
 * @param {HTMLElement} container - DOM element to mount the canvas in.
 * @param {object} [opts]
 * @param {string | number | null} [opts.background=null]
 *   CSS color / hex int for the scene background. Default `null` (transparent).
 * @param {boolean} [opts.showGround=true]
 *   Subtle white disc at y=0.
 * @param {boolean} [opts.showGrid=true]
 *   Faint purple grid.
 * @param {boolean} [opts.shadows=true]
 *   PCF soft shadows on the directional key light.
 * @param {object} [opts.camera]
 *   Perspective camera overrides:
 *     - fov (default 50)
 *     - near (default 0.1)
 *     - far (default 1000)
 *     - position (default [3, 2.5, 5])
 *     - target   (default [0, 0, 0])
 *
 * @returns {object} handle — see `./index.js` for the API.
 */
export function create3DScene(container, opts) {
  const sceneCtx = setupThreeScene(container, opts || {});
  // Start observing resize as soon as the scene is up. The handle
  // calls no resize APIs directly.
  if (typeof sceneCtx.observeResize === 'function') {
    sceneCtx.observeResize();
  }
  return createHandle(sceneCtx);
}

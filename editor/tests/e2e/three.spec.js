/**
 * @file E2E spec for the 3D scene engine.
 *
 *       Runs against the Vite dev server (Playwright's `webServer`
 *       config in playwright.config.js). Loads the blank fixture at
 *       /tests/fixtures/three-blank.html, mounts a `create3DScene`
 *       handle on a real canvas with real WebGL (Chromium uses
 *       SwiftShader headless), and walks the documented handle API:
 *
 *         1. addPrimitive('box')
 *         2. select the new box
 *         3. setColor('#2dd4bf')  — verify the material color changed
 *         4. listObjects()       — verify the box is listed
 *         5. toJSON() / fromJSON() round-trip — verify state survives
 *
 *       The spec never modifies editor/src/app/** or editor/src/styles/**
 *       or index.html. The fixture is a standalone page that imports
 *       the engine module directly.
 *
 *       Headless WebGL caveat: chromium-headless-shell renders WebGL
 *       via SwiftShader. The renderer's first frame might be a few
 *       frames late. We don't assert pixels — only the engine's
 *       observable state (registry, material color, JSON shape).
 */

import { test, expect } from '@playwright/test';

const FIXTURE_URL = '/tests/fixtures/three-blank.html';

test.describe('3D engine — own Three.js scene', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      // Surface page errors clearly in the test report.
      // eslint-disable-next-line no-console
      console.error('[page error]', err.message);
    });

    await page.goto(FIXTURE_URL);
    await page.waitForFunction(() => window.__RB_3D__?.ready === true, null, { timeout: 15_000 });

    // Wait for the canvas to actually appear in the DOM (mount is async).
    await page.waitForSelector('[data-testid="three-stage"] canvas', { timeout: 15_000 });
  });

  test('engine: mounts, exposes a handle, and renders a canvas', async ({ page }) => {
    const ready = await page.evaluate(() => window.__RB_3D__.ready);
    expect(ready).toBe(true);

    const handlesHandle = await page.evaluate(() => {
      const h = window.__RB_3D__.handle;
      return {
        hasAddPrimitive: typeof h.addPrimitive === 'function',
        hasLoadModel: typeof h.loadModel === 'function',
        hasListObjects: typeof h.listObjects === 'function',
        hasSelect: typeof h.select === 'function',
        hasGetSelected: typeof h.getSelected === 'function',
        hasDeselect: typeof h.deselect === 'function',
        hasSetColor: typeof h.setColor === 'function',
        hasSetMetalness: typeof h.setMetalness === 'function',
        hasSetRoughness: typeof h.setRoughness === 'function',
        hasSetTransform: typeof h.setTransform === 'function',
        hasRotate: typeof h.rotate === 'function',
        hasSetTransformMode: typeof h.setTransformMode === 'function',
        hasToJSON: typeof h.toJSON === 'function',
        hasFromJSON: typeof h.fromJSON === 'function',
        hasOnChange: typeof h.onChange === 'function',
        hasDispose: typeof h.dispose === 'function',
      };
    });
    for (const [name, present] of Object.entries(handlesHandle)) {
      expect(present, `handle.${name} should be a function`).toBe(true);
    }
  });

  test('addPrimitive + select + setColor: full happy path', async ({ page }) => {
    const result = await page.evaluate(() => {
      const h = window.__RB_3D__.handle;
      // 1. add a primitive
      const id = h.addPrimitive('box');
      // 2. select it
      h.select(id);
      // 3. recolor
      h.setColor(id, '#2dd4bf');
      // 4. check listObjects() shape
      const list = h.listObjects();
      // 5. check the material color changed (the engine stores
      //    `color` on the entry; the live Three.js material.color
      //    should also reflect it).
      const entry = h._registry.get(id);
      const liveColor = entry && entry.material && entry.material.color
        ? entry.material.color.getHexString()
        : null;
      // 6. selection is wired
      const selected = h.getSelected();
      return { id, list, liveColor, selected, entryColor: entry && entry.color };
    });

    expect(result.id).toMatch(/^o-\d+$/);
    expect(result.list.length).toBe(1);
    expect(result.list[0]).toMatchObject({ id: result.id, type: 'box' });
    expect(result.list[0].name).toMatch(/^box/);
    expect(result.liveColor).toBe('2dd4bf', 'material.color.getHexString() should match');
    expect(result.entryColor).toBe('#2dd4bf', 'registry entry color should match');
    expect(result.selected).toBe(result.id, 'getSelected() should return the box id');
  });

  test('setMetalness / setRoughness clamp to [0,1] and update the material', async ({ page }) => {
    const r = await page.evaluate(() => {
      const h = window.__RB_3D__.handle;
      const id = h.addPrimitive('sphere');
      // Out-of-range values should clamp, not NaN out.
      h.setMetalness(id, 5);
      h.setRoughness(id, -1);
      const entry = h._registry.get(id);
      const liveMetalness = entry.material.metalness;
      const liveRoughness = entry.material.roughness;
      return { liveMetalness, liveRoughness };
    });
    expect(r.liveMetalness).toBe(1);
    expect(r.liveRoughness).toBe(0);
  });

  test('setTransform / rotate: mutate position + rotation', async ({ page }) => {
    const r = await page.evaluate(() => {
      const h = window.__RB_3D__.handle;
      const id = h.addPrimitive('cylinder');
      h.setTransform(id, { position: [1, 2, 3], scale: [2, 2, 2] });
      h.rotate(id, 'y', 45);
      const entry = h._registry.get(id);
      return {
        pos: [entry.mesh.position.x, entry.mesh.position.y, entry.mesh.position.z],
        rot: [entry.mesh.rotation.x, entry.mesh.rotation.y, entry.mesh.rotation.z],
        scl: [entry.mesh.scale.x, entry.mesh.scale.y, entry.mesh.scale.z],
      };
    });
    expect(r.pos).toEqual([1, 2, 3]);
    expect(r.scl).toEqual([2, 2, 2]);
    expect(r.rot[1]).toBeCloseTo(45, 6);
  });

  test('setTransformMode: rotates between translate/rotate/scale', async ({ page }) => {
    const r = await page.evaluate(() => {
      const h = window.__RB_3D__.handle;
      h.setTransformMode('rotate');
      const rotateMode = h.getTransformMode();
      h.setTransformMode('scale');
      const scaleMode = h.getTransformMode();
      h.setTransformMode('translate');
      const translateMode = h.getTransformMode();
      let threw = false;
      try { h.setTransformMode('warp'); } catch (_) { threw = true; }
      return { rotateMode, scaleMode, translateMode, threw };
    });
    expect(r.rotateMode).toBe('rotate');
    expect(r.scaleMode).toBe('scale');
    expect(r.translateMode).toBe('translate');
    expect(r.threw).toBe(true, 'setTransformMode must reject unknown modes');
  });

  test('onChange: fires for add/select/color/transform', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const h = window.__RB_3D__.handle;
      const events = [];
      const unsub = h.onChange((e) => events.push({ type: e.type, detail: e.detail }));
      const id = h.addPrimitive('box');
      h.select(id);
      h.setColor(id, '#ff00aa');
      h.setTransform(id, { position: [1, 1, 1] });
      h.rotate(id, 'x', 15);
      h.setTransformMode('rotate');
      unsub();
      return events;
    });
    // We expect at least these event types in order. Don't assert
    // exact order or count beyond "we got all the high-level kinds",
    // since TransformControls' objectChange can add extras.
    const types = new Set(r.map((e) => e.type));
    expect(types.has('add')).toBe(true);
    expect(types.has('select')).toBe(true);
    expect(types.has('color')).toBe(true);
    expect(types.has('transform')).toBe(true);
    expect(types.has('transformMode')).toBe(true);
  });

  test('toJSON → fromJSON: round-trip is stable', async ({ page }) => {
    const r = await page.evaluate(() => {
      const h = window.__RB_3D__.handle;
      // Build a small scene.
      h.addPrimitive('box');
      const sphere = h.addPrimitive('sphere');
      h.select(sphere);
      h.setColor(sphere, '#7c5cff');
      h.setMetalness(sphere, 0.5);
      h.setRoughness(sphere, 0.25);
      h.setTransform(sphere, { position: [2, 0, -1], scale: [1.5, 1.5, 1.5] });
      h.rotate(sphere, 'y', 30);

      const a = h.toJSON();
      const parsedA = JSON.parse(a);

      // Wipe + restore.
      const handle2 = window.__RB_3D__.handle; // same handle
      handle2.fromJSON(a);

      // Re-serialize the restored scene.
      const b = handle2.toJSON();
      const parsedB = JSON.parse(b);

      // Capture restored object colors / positions for direct assertions.
      const restored = handle2.listObjects().map((row) => {
        const entry = handle2._registry.get(row.id);
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          color: entry.material.color.getHexString(),
          metalness: entry.material.metalness,
          roughness: entry.material.roughness,
          position: [entry.mesh.position.x, entry.mesh.position.y, entry.mesh.position.z],
          rotation: [entry.mesh.rotation.x, entry.mesh.rotation.y, entry.mesh.rotation.z],
          scale: [entry.mesh.scale.x, entry.mesh.scale.y, entry.mesh.scale.z],
        };
      });

      return { a, b, parsedA, parsedB, restored };
    });

    // The two JSON strings should be byte-equal: build → serialize →
    // restore → serialize is stable (ids differ is allowed only if
    // a counter wraps; here ids are stable because we restore in
    // order so o-1, o-2 stay).
    expect(r.b).toBe(r.a);

    // Sphere (o-2) was selected; it should restore as selected and
    // keep its color / position / scale / rotation / metalness /
    // roughness.
    const sphere = r.restored.find((o) => o.type === 'sphere');
    expect(sphere).toBeTruthy();
    expect(sphere.color).toBe('7c5cff');
    expect(sphere.metalness).toBe(0.5);
    expect(sphere.roughness).toBe(0.25);
    expect(sphere.position).toEqual([2, 0, -1]);
    expect(sphere.scale).toEqual([1.5, 1.5, 1.5]);
    expect(sphere.rotation[1]).toBeCloseTo(30, 6);

    // The box should also be present with its defaults.
    const box = r.restored.find((o) => o.type === 'box');
    expect(box).toBeTruthy();
  });

  test('addPrimitive: rejects unknown types', async ({ page }) => {
    const threw = await page.evaluate(() => {
      try { window.__RB_3D__.handle.addPrimitive('banana'); return false; }
      catch (_) { return true; }
    });
    expect(threw).toBe(true);
  });

  test('select: rejects unknown ids', async ({ page }) => {
    const threw = await page.evaluate(() => {
      try { window.__RB_3D__.handle.select('nope'); return false; }
      catch (_) { return true; }
    });
    expect(threw).toBe(true);
  });

  test('dispose: tears down the scene cleanly', async ({ page }) => {
    const r = await page.evaluate(() => {
      const h = window.__RB_3D__.handle;
      h.addPrimitive('box');
      const beforeCanvases = document.querySelectorAll('[data-testid="three-stage"] canvas').length;
      h.dispose();
      const afterCanvases = document.querySelectorAll('[data-testid="three-stage"] canvas').length;
      const afterList = h.listObjects();
      return { beforeCanvases, afterCanvases, afterList };
    });
    expect(r.beforeCanvases).toBeGreaterThan(0);
    expect(r.afterCanvases).toBe(0, 'canvas removed from DOM after dispose');
    expect(r.afterList).toEqual([], 'listObjects() returns [] after dispose');
  });
});

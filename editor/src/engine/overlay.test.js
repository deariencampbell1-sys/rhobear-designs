/**
 * @file Tests for the overlay module.
 *
 *       Covers pure geometry: makeRect, clampRect,
 *       projectIframeRectToContainer, computeOverlayRect. The DOM
 *       controller is exercised end-to-end by the Playwright spec at
 *       tests/e2e/overlay.spec.js.
 *
 *       Run with: `node --test src/engine/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeRect,
  clampRect,
  projectIframeRectToContainer,
  computeOverlayRect,
} from './overlay.js';

// ---------------------------------------------------------------------------
// makeRect
// ---------------------------------------------------------------------------

test('makeRect: stores numbers, coerces NaN to 0', () => {
  assert.deepEqual(makeRect(1, 2, 3, 4), { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(makeRect(NaN, NaN, NaN, NaN), { x: 0, y: 0, width: 0, height: 0 });
  assert.deepEqual(makeRect(-1, -2, -3, -4), { x: -1, y: -2, width: 0, height: 0 });
});

test('makeRect: coerces missing/undefined to 0', () => {
  assert.deepEqual(makeRect(), { x: 0, y: 0, width: 0, height: 0 });
});

// ---------------------------------------------------------------------------
// clampRect
// ---------------------------------------------------------------------------

test('clampRect: keeps a rect fully inside the viewport', () => {
  const r = clampRect(makeRect(10, 20, 30, 40), makeRect(0, 0, 100, 100));
  assert.deepEqual(r, { x: 10, y: 20, width: 30, height: 40 });
});

test('clampRect: trims rects that overflow the right / bottom edges', () => {
  const r = clampRect(makeRect(80, 80, 50, 50), makeRect(0, 0, 100, 100));
  assert.deepEqual(r, { x: 80, y: 80, width: 20, height: 20 });
});

test('clampRect: pushes rects up/left when they start above/left of the viewport', () => {
  const r = clampRect(makeRect(-10, -20, 30, 40), makeRect(0, 0, 100, 100));
  assert.deepEqual(r, { x: 0, y: 0, width: 20, height: 20 });
});

test('clampRect: drops a rect that is entirely outside', () => {
  const r = clampRect(makeRect(200, 200, 30, 30), makeRect(0, 0, 100, 100));
  assert.deepEqual(r, { x: 200, y: 200, width: 0, height: 0 });
});

test('clampRect: never mutates the input', () => {
  const inp = makeRect(10, 20, 30, 40);
  const vp = makeRect(0, 0, 100, 100);
  const snap = { ...inp };
  clampRect(inp, vp);
  assert.deepEqual(inp, snap);
});

// ---------------------------------------------------------------------------
// projectIframeRectToContainer
// ---------------------------------------------------------------------------

test('projectIframeRectToContainer: simple add (no scroll)', () => {
  const iframeRect = makeRect(50, 30, 200, 100);
  const iframeBox  = makeRect(10, 20, 800, 600);
  const out = projectIframeRectToContainer(iframeRect, iframeBox);
  assert.deepEqual(out, { x: 60, y: 50, width: 200, height: 100 });
});

test('projectIframeRectToContainer: subtracts scroll offsets', () => {
  const iframeRect = makeRect(50, 30, 200, 100);
  const iframeBox  = makeRect(10, 20, 800, 600);
  const out = projectIframeRectToContainer(iframeRect, iframeBox, { x: 10, y: 5 });
  // 10 + (50 - 10) = 50 ; 20 + (30 - 5) = 45
  assert.deepEqual(out, { x: 50, y: 45, width: 200, height: 100 });
});

test('projectIframeRectToContainer: treats missing scroll as zero', () => {
  const iframeRect = makeRect(50, 30, 200, 100);
  const iframeBox  = makeRect(10, 20, 800, 600);
  const out = projectIframeRectToContainer(iframeRect, iframeBox, {});
  assert.deepEqual(out, { x: 60, y: 50, width: 200, height: 100 });
});

test('projectIframeRectToContainer: handles scroll > rect (negative coords)', () => {
  const iframeRect = makeRect(5, 5, 20, 20);
  const iframeBox  = makeRect(0, 0, 800, 600);
  const out = projectIframeRectToContainer(iframeRect, iframeBox, { x: 100, y: 100 });
  // rect is now off-screen above/left
  assert.deepEqual(out, { x: -95, y: -95, width: 20, height: 20 });
});

// ---------------------------------------------------------------------------
// computeOverlayRect (end-to-end projection + clamping)
// ---------------------------------------------------------------------------

test('computeOverlayRect: project then clamp to container', () => {
  const iframeRect   = makeRect(50, 30, 200, 100);
  const iframeBox    = makeRect(10, 20, 800, 600);
  const containerVp  = makeRect(0, 0, 400, 300);
  const out = computeOverlayRect(iframeRect, iframeBox, containerVp);
  // Projected = {x:60,y:50,w:200,h:100}, viewport 400x300 → fully inside → unchanged.
  assert.deepEqual(out, { x: 60, y: 50, width: 200, height: 100 });
});

test('computeOverlayRect: clamps overflow on both axes', () => {
  const iframeRect   = makeRect(350, 260, 200, 100);
  const iframeBox    = makeRect(10, 20, 800, 600);
  const containerVp  = makeRect(0, 0, 400, 300);
  const out = computeOverlayRect(iframeRect, iframeBox, containerVp);
  // Projected = {x:360,y:280,w:200,h:100}; viewport = 400x300.
  // x:360..560 clipped to 360..400 → width=40
  // y:280..380 clipped to 280..300 → height=20
  assert.deepEqual(out, { x: 360, y: 280, width: 40, height: 20 });
});

test('computeOverlayRect: respects scroll offset', () => {
  // iframe is at (100,100) size 800x600. Inside the iframe, an element is at (10,10) size 200x100.
  // iframe is scrolled by (50,50). So the element should appear at container coords (60,60).
  const iframeRect  = makeRect(10, 10, 200, 100);
  const iframeBox   = makeRect(100, 100, 800, 600);
  const containerVp = makeRect(0, 0, 1200, 900);
  const out = computeOverlayRect(iframeRect, iframeBox, containerVp, { x: 50, y: 50 });
  assert.deepEqual(out, { x: 60, y: 60, width: 200, height: 100 });
});

test('computeOverlayRect: never mutates inputs', () => {
  const iframeRect  = makeRect(50, 30, 200, 100);
  const iframeBox   = makeRect(10, 20, 800, 600);
  const containerVp = makeRect(0, 0, 400, 300);
  const a = { ...iframeRect };
  const b = { ...iframeBox };
  const c = { ...containerVp };
  computeOverlayRect(iframeRect, iframeBox, containerVp);
  assert.deepEqual(iframeRect, a);
  assert.deepEqual(iframeBox, b);
  assert.deepEqual(containerVp, c);
});
/**
 * @file Tests for the Mode-B (build-from-scratch) headless lifecycle
 *       wrapper.
 *
 *       Headless test scope (this file):
 *         - normalizeContent: input sanitization
 *         - readEditorContent: graceful handling of missing/broken
 *           editor methods
 *         - writeEditorContent: only-applied-when-present semantics
 *         - coreRoundTripFromEditor: getContent() must round-trip
 *           through the headless `core` serializer
 *         - createHandleForEditor: change event fan-out, payload
 *           shape, onChange dispose semantics
 *         - destroy() idempotency: double-destroy, no-op methods
 *           after destroy, listeners cleared
 *         - addSection/addText/addImage/insertEmbed/undo/redo:
 *           guard against post-destroy calls, delegate to the
 *           underlying editor's helpers/UndoManager
 *         - resolveContainer: element vs selector handling
 *
 *       DOM-dependent mount is covered by
 *         editor/tests/e2e/mode-b.spec.js
 *
 *       Run with: `cd editor && node --test src/engine/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mountModeB,
  createHandleForEditor,
  normalizeContent,
  readEditorContent,
  writeEditorContent,
  coreRoundTripFromEditor,
  resolveContainer,
} from './mode-b.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * A minimal in-memory GrapesJS look-alike. Records every setComponents
 * / setStyle call, supports the UndoManager surface our handle uses,
 * and lets tests drive `emit(ev, ...)` to simulate GrapesJS events.
 * No DOM, no real GrapesJS, no Backbone.
 *
 * @param {{
 *   initialHtml?: string,
 *   initialCss?: string,
 *   undoCount?: number,
 *   redoCount?: number,
 * }} [seed]
 */
function makeMockEditor(seed) {
  const s = seed || {};
  let html = s.initialHtml || '';
  let css  = s.initialCss  || '';
  const componentsCalls = [];
  const styleCalls = [];

  const listeners = new Map();
  function on(ev, cb) {
    if (!listeners.has(ev)) listeners.set(ev, new Set());
    listeners.get(ev).add(cb);
  }
  function off(ev) {
    if (ev === undefined) listeners.clear();
    else listeners.delete(ev);
  }
  function emit(ev) {
    const set = listeners.get(ev);
    if (!set) return;
    for (const cb of Array.from(set)) {
      try { cb({}); } catch (_err) { /* swallow */ }
    }
  }

  const undoManager = {
    _undoLeft: s.undoCount == null ? 0 : s.undoCount,
    _redoLeft: s.redoCount == null ? 0 : s.redoCount,
    hasUndo() { return this._undoLeft > 0; },
    hasRedo() { return this._redoLeft > 0; },
    undo()     { if (this._undoLeft > 0) this._undoLeft--; },
    redo()     { if (this._redoLeft > 0) this._redoLeft--; },
  };

  return {
    // Event surface.
    on, off, emit,
    UndoManager: undoManager,

    // Read surface.
    getHtml() { return html; },
    getCss()  { return css;  },

    // Write surface.
    setComponents(input) {
      componentsCalls.push(input);
      html = (typeof input === 'string') ? input : '';
    },
    setStyle(input) {
      styleCalls.push(input);
      css = (typeof input === 'string') ? input : '';
    },

    // Expose recorded calls for assertions.
    _componentsCalls: componentsCalls,
    _styleCalls:      styleCalls,
  };
}

// ---------------------------------------------------------------------------
// normalizeContent
// ---------------------------------------------------------------------------

test('normalizeContent: nullish / non-object returns empty shape', () => {
  assert.deepEqual(normalizeContent(null),      { html: '', css: '' });
  assert.deepEqual(normalizeContent(undefined), { html: '', css: '' });
  assert.deepEqual(normalizeContent(42),        { html: '', css: '' });
  assert.deepEqual(normalizeContent('hi'),      { html: '', css: '' });
});

test('normalizeContent: missing fields default to empty strings', () => {
  assert.deepEqual(normalizeContent({}),         { html: '', css: '' });
  assert.deepEqual(normalizeContent({ html: '' }), { html: '', css: '' });
  assert.deepEqual(normalizeContent({ css: '' }),  { html: '', css: '' });
});

test('normalizeContent: keeps string fields verbatim', () => {
  const c = normalizeContent({ html: '<p>hi</p>', css: 'p { color: red; }' });
  assert.equal(c.html, '<p>hi</p>');
  assert.equal(c.css,  'p { color: red; }');
});

test('normalizeContent: ignores non-string field values', () => {
  const c = normalizeContent({ html: 123, css: { a: 1 } });
  assert.equal(c.html, '');
  assert.equal(c.css,  '');
});

// ---------------------------------------------------------------------------
// readEditorContent
// ---------------------------------------------------------------------------

test('readEditorContent: returns html+css from a working editor', () => {
  const ed = makeMockEditor({ initialHtml: '<p>x</p>', initialCss: 'p{}' });
  const out = readEditorContent(ed);
  assert.equal(out.html, '<p>x</p>');
  assert.equal(out.css,  'p{}');
});

test('readEditorContent: missing methods return empty fields', () => {
  assert.deepEqual(readEditorContent({}),                 { html: '', css: '' });
  assert.deepEqual(readEditorContent(null),               { html: '', css: '' });
  assert.deepEqual(readEditorContent({ getHtml: () => 42 }), { html: '', css: '' });
});

test('readEditorContent: throwing getHtml/getCss is swallowed', () => {
  const ed = {
    getHtml() { throw new Error('boom'); },
    getCss()  { throw new Error('boom'); },
  };
  assert.deepEqual(readEditorContent(ed), { html: '', css: '' });
});

// ---------------------------------------------------------------------------
// writeEditorContent
// ---------------------------------------------------------------------------

test('writeEditorContent: applies both html and css when present', () => {
  const ed = makeMockEditor();
  const res = writeEditorContent(ed, { html: '<h1>hi</h1>', css: 'h1{}' });
  assert.equal(res.htmlApplied, true);
  assert.equal(res.cssApplied,  true);
  assert.equal(ed.getHtml(), '<h1>hi</h1>');
  assert.equal(ed.getCss(),  'h1{}');
});

test('writeEditorContent: empty css slot is a no-op', () => {
  const ed = makeMockEditor({ initialCss: 'p{}' });
  const res = writeEditorContent(ed, { html: '<h1>hi</h1>', css: '' });
  assert.equal(res.htmlApplied, true);
  assert.equal(res.cssApplied,  false);
  // Existing CSS must NOT be cleared by an empty write.
  assert.equal(ed.getCss(), 'p{}');
  assert.equal(ed._styleCalls.length, 0);
});

test('writeEditorContent: empty html slot is a no-op', () => {
  const ed = makeMockEditor({ initialHtml: '<p>x</p>' });
  const res = writeEditorContent(ed, { html: '', css: 'a{}' });
  assert.equal(res.htmlApplied, false);
  assert.equal(res.cssApplied,  true);
  assert.equal(ed.getHtml(), '<p>x</p>');
  assert.equal(ed._componentsCalls.length, 0);
});

test('writeEditorContent: editor missing setComponents/setStyle is tolerated', () => {
  const partial = { getHtml: () => '', getCss: () => '' };
  const res = writeEditorContent(partial, { html: '<p>x</p>', css: 'p{}' });
  assert.equal(res.htmlApplied, false);
  assert.equal(res.cssApplied,  false);
});

test('writeEditorContent: throwing methods are swallowed', () => {
  const ed = {
    setComponents() { throw new Error('boom'); },
    setStyle()      { throw new Error('boom'); },
  };
  const res = writeEditorContent(ed, { html: '<p>x</p>', css: 'p{}' });
  assert.equal(res.htmlApplied, false);
  assert.equal(res.cssApplied,  false);
});

// ---------------------------------------------------------------------------
// coreRoundTripFromEditor
// ---------------------------------------------------------------------------

test('coreRoundTripFromEditor: getContent round-trips through core serializer', () => {
  // A canonical body-level fragment the core serializer knows how to
  // re-emit. The double round-trip must produce the same string twice.
  const ed = makeMockEditor({
    initialHtml: '<section><h1>Title</h1><p>Body</p></section>',
    initialCss:  'p { color: red; }',
  });

  const t1 = coreRoundTripFromEditor(ed);
  assert.equal(t1.ok, true);
  assert.match(t1.content.html, /<section/);
  assert.match(t1.content.html, /<h1[^>]*>Title<\/h1>/);
  assert.match(t1.content.html, /<p[^>]*>Body<\/p>/);
  assert.equal(t1.content.css, 'p { color: red; }');

  // Now re-apply the round-tripped shape to a fresh editor and re-read.
  const ed2 = makeMockEditor();
  writeEditorContent(ed2, t1.content);
  const t2 = coreRoundTripFromEditor(ed2);
  assert.equal(t2.ok, true);
  assert.equal(t2.content.html, t1.content.html);
  assert.equal(t2.content.css,  t1.content.css);
});

test('coreRoundTripFromEditor: empty editor reports ok=false', () => {
  const ed = makeMockEditor();
  const t = coreRoundTripFromEditor(ed);
  assert.equal(t.ok, false);
  assert.deepEqual(t.content, { html: '', css: '' });
});

test('coreRoundTripFromEditor: void elements survive the round-trip', () => {
  // <img> is a void tag and must remain a single self-closing tag in
  // both the first and second serialize() passes.
  const ed = makeMockEditor({
    initialHtml: '<p>before</p><img src="x.png" alt="x"><p>after</p>',
  });
  const t1 = coreRoundTripFromEditor(ed);
  assert.equal(t1.ok, true);
  assert.match(t1.content.html, /<img src="x\.png" alt="x">/);

  const ed2 = makeMockEditor();
  writeEditorContent(ed2, t1.content);
  const t2 = coreRoundTripFromEditor(ed2);
  assert.equal(t2.content.html, t1.content.html);
});

// ---------------------------------------------------------------------------
// resolveContainer
// ---------------------------------------------------------------------------

test('resolveContainer: in Node, a non-Element object returns null', () => {
  // In Node `Element` is undefined so the `instanceof Element` guard
  // throws. resolveContainer is required to never throw on a
  // non-string non-Element input; this is the explicit contract.
  // We exercise the "any other value" path with a plain object.
  const out = resolveContainer({ nodeType: 1, id: 'fake' });
  assert.equal(out, null);
});

test('resolveContainer: in Node, string selector returns null (no document)', () => {
  // Node has no `document`, so the selector path is a no-op.
  assert.equal(resolveContainer('#missing'), null);
});

test('resolveContainer: nullish returns null', () => {
  assert.equal(resolveContainer(null), null);
  assert.equal(resolveContainer(undefined), null);
  assert.equal(resolveContainer(0), null);
});

// ---------------------------------------------------------------------------
// createHandleForEditor: change events + payload shape
// ---------------------------------------------------------------------------

test('handle.onChange: receives a normalized payload on component:update', () => {
  const ed = makeMockEditor({
    initialHtml: '<p>orig</p>',
    initialCss:  'p{}',
  });
  const h = createHandleForEditor(ed);
  const events = [];
  h.onChange((p) => events.push(p));

  ed.emit('component:update');
  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'component');
  assert.equal(events[0].html, '<p>orig</p>');
  assert.equal(events[0].css,  'p{}');
});

test('handle.onChange: source reflects the triggering event family', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  const events = [];
  h.onChange((p) => events.push(p.source));

  ed.emit('style:update');     events.length && assert.equal(events.at(-1), 'style');
  ed.emit('undo');             assert.equal(events.at(-1), 'reset');
  ed.emit('redo');             assert.equal(events.at(-1), 'reset');
  ed.emit('project:load');     assert.equal(events.at(-1), 'project');
  ed.emit('load');             assert.equal(events.at(-1), 'project');
  ed.emit('change:style');     assert.equal(events.at(-1), 'style');

  // Total count: 6 distinct event emissions.
  assert.equal(events.length, 6);
});

test('handle.onChange: dispose() unsubscribes a single listener', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  const a = [];
  const b = [];
  const da = h.onChange((p) => a.push(p));
  h.onChange((p) => b.push(p));

  ed.emit('component:update');
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);

  da();
  ed.emit('component:update');
  assert.equal(a.length, 1);  // unchanged
  assert.equal(b.length, 2);
});

test('handle.onChange: multiple listeners all fire on each event', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  let n = 0;
  h.onChange(() => n++);
  h.onChange(() => n++);
  h.onChange(() => n++);
  ed.emit('component:update');
  assert.equal(n, 3);
});

test('handle.onChange: non-function callback returns a no-op disposer', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  const d1 = h.onChange(null);
  const d2 = h.onChange(undefined);
  // Disposers must be callable and side-effect-free.
  assert.equal(typeof d1, 'function');
  assert.equal(typeof d2, 'function');
  d1(); d2();
  // No throw = pass.
});

// ---------------------------------------------------------------------------
// setContent / getContent through the handle
// ---------------------------------------------------------------------------

test('handle.setContent: writes both slots through the editor methods', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  const res = h.setContent({ html: '<h1>x</h1>', css: 'h1{}' });
  assert.equal(res.htmlApplied, true);
  assert.equal(res.cssApplied,  true);
  assert.equal(ed._componentsCalls[0], '<h1>x</h1>');
  assert.equal(ed._styleCalls[0], 'h1{}');
});

test('handle.setContent: only-applied-when-present', () => {
  const ed = makeMockEditor({ initialCss: 'p{}' });
  const h = createHandleForEditor(ed);
  const res = h.setContent({ html: '<h1>x</h1>' });
  assert.equal(res.htmlApplied, true);
  assert.equal(res.cssApplied,  false);
  assert.equal(ed._styleCalls.length, 0);
  assert.equal(ed.getCss(), 'p{}');
});

test('handle.setContent: fires a reset change with the new content', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  const events = [];
  h.onChange((p) => events.push(p));

  h.setContent({ html: '<h1>x</h1>', css: 'h1{}' });
  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'reset');
  // The reset event should reflect the new content.
  assert.equal(events[0].html, '<h1>x</h1>');
  assert.equal(events[0].css,  'h1{}');
});

test('handle.getContent: returns the editor snapshot verbatim', () => {
  const ed = makeMockEditor({ initialHtml: '<p>y</p>', initialCss: 'p{}' });
  const h = createHandleForEditor(ed);
  const out = h.getContent();
  assert.equal(out.html, '<p>y</p>');
  assert.equal(out.css,  'p{}');
});

// ---------------------------------------------------------------------------
// Insert helpers
// ---------------------------------------------------------------------------

test('handle.addSection / addText / addImage / insertEmbed: delegate to insert helpers', () => {
  const calls = [];
  const ed = { getWrapper: () => ({}), getSelected: () => null };
  const helpers = {
    addSection:    (e) => calls.push(['addSection', e]),
    addTextBlock:  (e) => calls.push(['addTextBlock', e]),
    addImageBlock: (e, src) => calls.push(['addImageBlock', e, src]),
    insertEmbed:   (e, code) => calls.push(['insertEmbed', e, code]),
  };
  const h = createHandleForEditor(ed, { insertHelpers: helpers });
  h.addSection();
  h.addText();
  h.addImage('https://example.com/x.png');
  h.insertEmbed('<iframe src="x"></iframe>');
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], 'addSection');
  assert.equal(calls[1][0], 'addTextBlock');
  assert.equal(calls[2][0], 'addImageBlock');
  assert.equal(calls[2][2], 'https://example.com/x.png');
  assert.equal(calls[3][0], 'insertEmbed');
  assert.equal(calls[3][2], '<iframe src="x"></iframe>');
});

test('handle.insertEmbed: ignores empty / non-string code', () => {
  const calls = [];
  const helpers = {
    addSection:    () => {},
    addTextBlock:  () => {},
    addImageBlock: () => {},
    insertEmbed:   (e, code) => calls.push(code),
  };
  const h = createHandleForEditor({}, { insertHelpers: helpers });
  h.insertEmbed('');
  h.insertEmbed(null);
  h.insertEmbed(42);
  h.insertEmbed(undefined);
  assert.equal(calls.length, 0);
});

test('handle insert methods: no-op when no insertHelpers are provided', () => {
  const ed = { getWrapper: () => ({}), getSelected: () => null };
  const h = createHandleForEditor(ed);
  // No throw, no observable effect.
  h.addSection();
  h.addText();
  h.addImage('x');
  h.insertEmbed('<i></i>');
});

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------

test('handle.undo / handle.redo: returns true when the UndoManager had a step', () => {
  const ed = makeMockEditor({ undoCount: 1, redoCount: 1 });
  const h = createHandleForEditor(ed);
  assert.equal(h.undo(), true);
  assert.equal(h.redo(), true);
});

test('handle.undo / handle.redo: returns false when nothing to undo/redo', () => {
  const ed = makeMockEditor({ undoCount: 0, redoCount: 0 });
  const h = createHandleForEditor(ed);
  assert.equal(h.undo(), false);
  assert.equal(h.redo(), false);
});

test('handle.undo / handle.redo: missing UndoManager is a no-op (false)', () => {
  const h = createHandleForEditor({});
  assert.equal(h.undo(), false);
  assert.equal(h.redo(), false);
});

// ---------------------------------------------------------------------------
// Destroy — idempotency, post-destroy no-op, listener cleanup
// ---------------------------------------------------------------------------

test('handle.destroy: idempotent and flips isDestroyed', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  assert.equal(h.isDestroyed(), false);
  h.destroy();
  assert.equal(h.isDestroyed(), true);
  // Calling destroy() again must not throw and must remain destroyed.
  h.destroy();
  assert.equal(h.isDestroyed(), true);
});

test('handle.destroy: invokes editor.destroyAll() exactly once per call', () => {
  let count = 0;
  const ed = makeMockEditor();
  ed.destroyAll = () => { count++; };
  const h = createHandleForEditor(ed);
  h.destroy();
  h.destroy();   // second call is a no-op
  assert.equal(count, 1);
});

test('handle.destroy: invokes the onDomTeardown callback once', () => {
  const ed = makeMockEditor();
  let domCalls = 0;
  const h = createHandleForEditor(ed, { onDomTeardown: () => { domCalls++; } });
  h.destroy();
  h.destroy();
  assert.equal(domCalls, 1);
});

test('handle.destroy: clears all onChange listeners', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  let n = 0;
  h.onChange(() => n++);
  h.onChange(() => n++);
  h.destroy();
  ed.emit('component:update');
  // After destroy, the editor's event-emit cannot reach listeners
  // (we offed them, and we also cleared our internal Set). Even if a
  // misbehaving emit snuck through, our fan-out is gated on
  // `destroyed`. Either way, n must be 0.
  assert.equal(n, 0);
});

test('handle.destroy: editor.destroyAll() throwing is swallowed', () => {
  const ed = makeMockEditor();
  ed.destroyAll = () => { throw new Error('boom'); };
  const h = createHandleForEditor(ed);
  // Must not throw.
  h.destroy();
  assert.equal(h.isDestroyed(), true);
});

test('handle methods after destroy: all return no-op / empty / false', () => {
  const ed = makeMockEditor({ undoCount: 1, redoCount: 1 });
  const h = createHandleForEditor(ed);
  h.destroy();

  assert.deepEqual(h.getContent(), { html: '', css: '' });
  assert.deepEqual(h.setContent({ html: '<p>x</p>', css: 'p{}' }),
                   { htmlApplied: false, cssApplied: false });
  assert.equal(h.undo(), false);
  assert.equal(h.redo(), false);

  // Insert helpers must not throw after destroy. They have no return
  // value to inspect, so we just confirm no exception.
  h.addSection();
  h.addText();
  h.addImage('x');
  h.insertEmbed('<i></i>');
});

test('handle.onChange after destroy: subscribe is a no-op, listener not retained', () => {
  const ed = makeMockEditor();
  const h = createHandleForEditor(ed);
  h.destroy();
  let called = false;
  const d = h.onChange(() => { called = true; });
  d();
  // Even if a stray emit made it through, the listener we just
  // registered must not have been retained (destroyed===true skips
  // `listeners.add`).
  ed.emit('component:update');
  assert.equal(called, false);
});

// ---------------------------------------------------------------------------
// Editor event surface — graceful degradation
// ---------------------------------------------------------------------------

test('handle: an editor without `on` does not throw on construction', () => {
  // The handle factory calls wireChangeEvents() which guards on
  // `typeof editor.on === 'function'`. With a bare object, the
  // constructor must succeed.
  const h = createHandleForEditor({});
  assert.equal(typeof h.setContent, 'function');
  assert.equal(typeof h.getContent, 'function');
  assert.equal(typeof h.destroy,    'function');
  h.destroy();
});

// ---------------------------------------------------------------------------
// mountModeB in Node — rejects because there's no document
// ---------------------------------------------------------------------------

test('mountModeB: rejects in Node (no document)', async () => {
  // Document is not defined in the Node test runner, so mountModeB
  // takes the early-exit branch and rejects with a clear error. The
  // shell only ever calls this from a browser, but the error path is
  // part of the API surface and is tested here.
  await assert.rejects(
    mountModeB('#gjs-host'),
    /requires a browser environment/,
  );
});

test('mountModeB: rejects on a nullish / invalid container', async () => {
  // In Node there's no document, so every call short-circuits with
  // the "requires a browser environment" error. In a real browser
  // the same calls would reject with "container not found"; that
  // branch is exercised by the Playwright spec at
  // editor/tests/e2e/mode-b.spec.js.
  await assert.rejects(mountModeB(null),      /requires a browser/);
  await assert.rejects(mountModeB(undefined), /requires a browser/);
  await assert.rejects(mountModeB(42),        /requires a browser/);
  await assert.rejects(mountModeB('#nope'),   /requires a browser/);
});

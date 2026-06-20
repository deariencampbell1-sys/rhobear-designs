/**
 * @file Tests for the iframe-bridge module.
 *
 *       Covers: serializeMessage / deserializeMessage round-trips,
 *       invalid envelope rejection, origin guards, parent-side dispatch,
 *       agent-side guard. Browser MessageEvent handling is covered by
 *       the Playwright spec at tests/e2e/overlay.spec.js.
 *
 *       Run with: `node --test src/engine/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRIDGE_VERSION,
  MESSAGE_TYPE,
  serializeMessage,
  deserializeMessage,
  isValidOrigin,
  guardIncomingEvent,
  createBridge,
  createAgent,
} from './iframe-bridge.js';

// ---------------------------------------------------------------------------
// serializeMessage
// ---------------------------------------------------------------------------

test('serializeMessage: produces a frozen envelope with required fields', () => {
  const m = serializeMessage({ role: 'agent', kind: 'select', payload: { path: 'p' } });
  assert.equal(m.type, MESSAGE_TYPE);
  assert.equal(m.version, BRIDGE_VERSION);
  assert.equal(m.role, 'agent');
  assert.equal(m.kind, 'select');
  assert.deepEqual(m.payload, { path: 'p' });
  assert.equal(Object.isFrozen(m), true);
  assert.equal(m.id, undefined);
});

test('serializeMessage: passes through correlation id when provided', () => {
  const m = serializeMessage({ role: 'parent', kind: 'request-rect', id: 'r-1' });
  assert.equal(m.id, 'r-1');
});

test('serializeMessage: defaults payload to {} when missing', () => {
  const m = serializeMessage({ role: 'parent', kind: 'ready' });
  assert.deepEqual(m.payload, {});
});

test('serializeMessage: rejects invalid role / kind / input', () => {
  assert.throws(() => serializeMessage(null),                /msg must be an object/);
  assert.throws(() => serializeMessage({}),                  /invalid role/);
  assert.throws(() => serializeMessage({ role: 'other' }),   /invalid role/);
  assert.throws(() => serializeMessage({ role: 'parent' }),  /kind required/);
  assert.throws(() => serializeMessage({ role: 'parent', kind: '' }), /kind required/);
});

// ---------------------------------------------------------------------------
// deserializeMessage
// ---------------------------------------------------------------------------

test('deserializeMessage: round-trips an envelope', () => {
  const m = serializeMessage({ role: 'agent', kind: 'hover', payload: { x: 1 } });
  const parsed = deserializeMessage(m, { expectedRole: 'agent' });
  assert.equal(parsed.role, 'agent');
  assert.equal(parsed.kind, 'hover');
  assert.deepEqual(parsed.payload, { x: 1 });
});

test('deserializeMessage: returns null for non-matching type / version / role', () => {
  assert.equal(deserializeMessage({ type: 'other', version: 1, role: 'agent', kind: 'a' }), null);
  assert.equal(deserializeMessage({ type: MESSAGE_TYPE, version: 99, role: 'agent', kind: 'a' }), null);
  assert.equal(deserializeMessage({ type: MESSAGE_TYPE, version: 1, role: 'agent', kind: '' }), null);
  assert.equal(
    deserializeMessage({ type: MESSAGE_TYPE, version: 1, role: 'agent', kind: 'a' }, { expectedRole: 'parent' }),
    null,
  );
});

test('deserializeMessage: defaults payload to {}', () => {
  const m = serializeMessage({ role: 'agent', kind: 'deselect' });
  const parsed = deserializeMessage(m);
  assert.deepEqual(parsed.payload, {});
});

// ---------------------------------------------------------------------------
// Origin guard
// ---------------------------------------------------------------------------

test('isValidOrigin: matches exact origin or accepts *', () => {
  assert.equal(isValidOrigin('https://x.test', 'https://x.test'), true);
  assert.equal(isValidOrigin('https://x.test', '*'),              true);
  assert.equal(isValidOrigin('https://x.test', ''),               true);
  assert.equal(isValidOrigin('https://x.test', 'https://y.test'), false);
  assert.equal(isValidOrigin(undefined, 'https://x.test'),        false);
});

// ---------------------------------------------------------------------------
// guardIncomingEvent
// ---------------------------------------------------------------------------

function fakeEvent({ origin = 'https://x.test', source = null, data = null } = {}) {
  return { origin, source, data };
}

test('guardIncomingEvent: accepts well-formed message with matching origin/source', () => {
  const src = {};
  const ev = fakeEvent({
    origin: 'https://x.test',
    source: src,
    data: serializeMessage({ role: 'agent', kind: 'select', payload: { p: 1 } }),
  });
  const v = guardIncomingEvent(ev, { expectedOrigin: 'https://x.test', expectedSource: src, expectedRole: 'agent' });
  assert.equal(v.accept, true);
  assert.equal(v.msg.kind, 'select');
});

test('guardIncomingEvent: rejects on origin mismatch', () => {
  const src = {};
  const ev = fakeEvent({
    origin: 'https://evil.test',
    source: src,
    data: serializeMessage({ role: 'agent', kind: 'select' }),
  });
  const v = guardIncomingEvent(ev, { expectedOrigin: 'https://x.test', expectedSource: src });
  assert.equal(v.accept, false);
  assert.match(v.reason, /origin mismatch/);
});

test('guardIncomingEvent: rejects on source mismatch', () => {
  const src = {};
  const ev = fakeEvent({
    origin: 'https://x.test',
    source: { diff: true },
    data: serializeMessage({ role: 'agent', kind: 'select' }),
  });
  const v = guardIncomingEvent(ev, { expectedOrigin: 'https://x.test', expectedSource: src });
  assert.equal(v.accept, false);
  assert.equal(v.reason, 'source mismatch');
});

test('guardIncomingEvent: rejects when envelope is malformed', () => {
  const src = {};
  const ev = fakeEvent({
    origin: 'https://x.test',
    source: src,
    data: { type: 'other', version: 1, role: 'agent', kind: 'a' },
  });
  const v = guardIncomingEvent(ev, { expectedOrigin: 'https://x.test', expectedSource: src });
  assert.equal(v.accept, false);
  assert.match(v.reason, /envelope invalid/);
});

test('guardIncomingEvent: wildcard origin accepts anything', () => {
  const src = {};
  const ev = fakeEvent({
    origin: 'https://anywhere.test',
    source: src,
    data: serializeMessage({ role: 'agent', kind: 'ready', payload: { caps: ['select'] } }),
  });
  const v = guardIncomingEvent(ev, { expectedOrigin: '*', expectedSource: src });
  assert.equal(v.accept, true);
});

// ---------------------------------------------------------------------------
// createBridge — exercises onMessage dispatch + filtering
// ---------------------------------------------------------------------------

test('createBridge: onMessage dispatches select/hover/deselect/text-changed/ready', () => {
  const fakeIframe = { contentWindow: {} };
  const events = [];
  const bridge = createBridge(fakeIframe, {
    onSelect:     (p) => events.push(['select', p]),
    onHover:      (p) => events.push(['hover', p]),
    onDeselect:   ()  => events.push(['deselect']),
    onTextChange: (p) => events.push(['text-changed', p]),
    onReady:      (p) => events.push(['ready', p]),
  });

  // Five incoming messages, all accepted. The event.source MUST match
  // the iframe's contentWindow so the source guard passes.
  const src = fakeIframe.contentWindow;
  bridge.onMessage(fakeEvent({ source: src, data: serializeMessage({ role: 'agent', kind: 'select', payload: { path: 'a' } }) }));
  bridge.onMessage(fakeEvent({ source: src, data: serializeMessage({ role: 'agent', kind: 'hover', payload: { path: 'b' } }) }));
  bridge.onMessage(fakeEvent({ source: src, data: serializeMessage({ role: 'agent', kind: 'deselect' }) }));
  bridge.onMessage(fakeEvent({ source: src, data: serializeMessage({ role: 'agent', kind: 'text-changed', payload: { path: 'c', prevText: 'x', text: 'y' } }) }));
  bridge.onMessage(fakeEvent({ source: src, data: serializeMessage({ role: 'agent', kind: 'ready', payload: { capabilities: ['select'] } }) }));

  assert.deepEqual(events.map((e) => e[0]), ['select', 'hover', 'deselect', 'text-changed', 'ready']);
  assert.deepEqual(events[0][1], { path: 'a' });
  assert.deepEqual(events[4][1], { capabilities: ['select'] });
});

test('createBridge: parent-side ignores request-rect inbound (parent → agent only)', () => {
  const fakeIframe = { contentWindow: {} };
  let gotReady = false;
  const bridge = createBridge(fakeIframe, { onReady: () => { gotReady = true; } });
  // The bridge configures expectedRole: 'agent', so a parent-role inbound is rejected.
  const accepted = bridge.onMessage(fakeEvent({
    data: serializeMessage({ role: 'parent', kind: 'request-rect', payload: { path: 'p' } }),
  }));
  assert.equal(accepted, false);
  assert.equal(gotReady, false);
});

test('createBridge: rejects messages from the wrong source', () => {
  const fakeIframe = { contentWindow: { id: 'real' } };
  let received = 0;
  const bridge = createBridge(fakeIframe, { onSelect: () => { received += 1; } });
  const accepted = bridge.onMessage(fakeEvent({
    source: { id: 'fake' },
    data: serializeMessage({ role: 'agent', kind: 'select' }),
  }));
  assert.equal(accepted, false);
  assert.equal(received, 0);
});

test('createBridge: post returns true on the happy path and false when postMessage throws', () => {
  const calls = [];
  const fakeIframe = { contentWindow: { postMessage: (m, origin) => calls.push({ m, origin }) } };
  const bridge = createBridge(fakeIframe, {});

  const okHappy = bridge.post('request-rect', { path: 'p' });
  assert.equal(okHappy, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].m.role, 'parent');
  assert.equal(calls[0].m.kind, 'request-rect');

  // Now make postMessage throw — post() must catch and return false.
  fakeIframe.contentWindow.postMessage = () => { throw new Error('boom'); };
  const okFail = bridge.post('request-rect', { path: 'p' });
  assert.equal(okFail, false);
});

test('createBridge: throws when iframe has no contentWindow', () => {
  assert.throws(() => createBridge(null, {}), /contentWindow required/);
  assert.throws(() => createBridge({}, {}), /contentWindow required/);
});

// ---------------------------------------------------------------------------
// createAgent — exercises onParentMessage guard + dispatch to handler
// ---------------------------------------------------------------------------

test('createAgent: onParentMessage rejects wrong role', () => {
  // Construct a fake window object that mimics just enough of Window.
  const fakeWin = {
    addEventListener: () => {},
    removeEventListener: () => {},
    parent: {},
    postMessage: () => {},
  };
  const agent = createAgent(fakeWin, { autoStart: false });
  const accepted = agent.onParentMessage({
    origin: 'https://x.test',
    source: fakeWin.parent,
    data: serializeMessage({ role: 'agent', kind: 'select' }), // wrong role
  });
  assert.equal(accepted, false);
});

test('createAgent: onParentMessage dispatches request-rect to handler', () => {
  const fakeWin = {
    addEventListener: () => {},
    removeEventListener: () => {},
    parent: {},
    postMessage: () => {},
  };
  const agent = createAgent(fakeWin, { autoStart: false });
  let received = null;
  agent.onParentRequest((payload, id) => { received = { payload, id }; });
  const ok = agent.onParentMessage({
    origin: 'https://x.test',
    source: fakeWin.parent,
    data: serializeMessage({ role: 'parent', kind: 'request-rect', payload: { path: 'p' }, id: 'q-1' }),
  });
  assert.equal(ok, true);
  assert.deepEqual(received, { payload: { path: 'p' }, id: 'q-1' });
});

test('createAgent: emit posts serialized envelope via window.parent.postMessage', () => {
  const calls = [];
  const fakeWin = {
    addEventListener: () => {},
    removeEventListener: () => {},
    parent: { postMessage: (m, origin) => calls.push({ m, origin }) },
    postMessage: () => {},
  };
  const agent = createAgent(fakeWin, { autoStart: false });
  const ok = agent.emit('select', { path: 'a' });
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].m.role, 'agent');
  assert.equal(calls[0].m.kind, 'select');
  assert.deepEqual(calls[0].m.payload, { path: 'a' });
});

test('createAgent: throws when windowObj is not a Window', () => {
  assert.throws(() => createAgent(null),     /windowObj must be a Window/);
  assert.throws(() => createAgent({}),       /windowObj must be a Window/);
});
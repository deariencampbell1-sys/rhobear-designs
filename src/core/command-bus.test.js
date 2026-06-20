/**
 * @file Tests for the command bus.
 *
 *       Covers: dispatch applies do; undo reverses; redo reapplies;
 *       new dispatch truncates the redo stack; full sequences of
 *       insert/update/remove/move all round-trip through undo + redo;
 *       custom commands work; onChange fires; canUndo/canRedo flags.
 *
 *       Run with: `node --test src/core/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDocument } from './document-model.js';
import {
  createCommandBus,
  updateNodeCommand,
  insertNodeCommand,
  removeNodeCommand,
  moveNodeCommand,
} from './command-bus.js';

// ---------------------------------------------------------------------------
// Basic dispatch / undo / redo
// ---------------------------------------------------------------------------

test('dispatch: runs do, pushes to undo stack, clears redo stack', () => {
  const doc = createDocument('<p>hi</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);

  const cmd = bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'x' } }));
  assert.equal(cmd.label, `Update ${p.id}`);
  assert.equal(p.attrs.class, 'x');
  assert.equal(bus.canUndo(), true);
  assert.equal(bus.canRedo(), false);
});

test('undo: reverses the most recent command and pushes to redo stack', () => {
  const doc = createDocument('<p>hi</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);

  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'x' } }));
  assert.equal(p.attrs.class, 'x');
  assert.equal(bus.undo(), true);
  assert.equal(p.attrs.class, undefined);
  assert.equal(bus.canUndo(), false);
  assert.equal(bus.canRedo(), true);
});

test('redo: reapplies the most recent undone command', () => {
  const doc = createDocument('<p>hi</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);

  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'x' } }));
  bus.undo();
  assert.equal(bus.redo(), true);
  assert.equal(p.attrs.class, 'x');
  assert.equal(bus.canUndo(), true);
  assert.equal(bus.canRedo(), false);
});

test('undo / redo: return false on empty stacks', () => {
  const doc = createDocument();
  const bus = createCommandBus(doc);
  assert.equal(bus.undo(), false);
  assert.equal(bus.redo(), false);
});

// ---------------------------------------------------------------------------
// Truncation: redo stack is cleared when a new command is dispatched
// ---------------------------------------------------------------------------

test('new dispatch truncates the redo stack', () => {
  const doc = createDocument('<p>hi</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);

  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'x' } })); // A
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'y' } })); // B
  bus.undo(); // back to A
  assert.equal(p.attrs.class, 'x');
  assert.equal(bus.canRedo(), true);

  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'z' } })); // C
  assert.equal(p.attrs.class, 'z');
  assert.equal(bus.canRedo(), false, 'redo stack must be empty after a new dispatch');
});

test('truncation: undo → undo → redo → redo → undo → dispatch is clean', () => {
  const doc = createDocument('<p>hi</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);

  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'a' } })); // 1
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'b' } })); // 2
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'c' } })); // 3

  bus.undo(); // c → b
  assert.equal(p.attrs.class, 'b');
  bus.undo(); // b → a
  assert.equal(p.attrs.class, 'a');
  bus.redo(); // a → b
  assert.equal(p.attrs.class, 'b');
  bus.redo(); // b → c
  assert.equal(p.attrs.class, 'c');
  bus.undo(); // c → b
  assert.equal(p.attrs.class, 'b');
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'd' } })); // truncates redo
  assert.equal(p.attrs.class, 'd');
  assert.equal(bus.canRedo(), false);
});

// ---------------------------------------------------------------------------
// Insert / remove / move factories
// ---------------------------------------------------------------------------

test('insertNodeCommand: do inserts and exposes insertedId; undo removes', () => {
  const doc = createDocument();
  const bus = createCommandBus(doc);

  const cmd = bus.dispatch(insertNodeCommand('root', { tag: 'div' }));
  assert.equal(doc.root.children.length, 1);
  const div = doc.root.children[0];
  assert.equal(cmd.insertedId, div.id);
  assert.equal(div.tag, 'div');

  bus.undo();
  assert.equal(doc.root.children.length, 0);
  assert.equal(doc.getNode(div.id), null);

  bus.redo();
  assert.equal(doc.root.children.length, 1);
  assert.equal(doc.root.children[0].id, div.id);
});

test('removeNodeCommand: removes with subtree and undo restores exact position', () => {
  const doc = createDocument('<section><div><p>hi</p></div><span></span></section>');
  const section = doc.root.children[0];
  const div = section.children[0];
  const span = section.children[1];
  const pId = div.children[0].id;
  const bus = createCommandBus(doc);

  bus.dispatch(removeNodeCommand(div.id));
  assert.equal(section.children.length, 1);
  assert.equal(section.children[0], span);
  assert.equal(doc.getNode(pId), null);

  bus.undo();
  assert.equal(section.children.length, 2);
  assert.equal(section.children[0], div);
  assert.equal(section.children[1], span);
  assert.equal(div.children[0].id, pId);
  assert.equal(div.children[0].children[0].text, 'hi');
});

test('moveNodeCommand: moves across parents and undo restores original slot', () => {
  const doc = createDocument('<div><p>a</p><p>b</p></div><section></section>');
  const div = doc.root.children[0];
  const a = div.children[0];
  const section = doc.root.children[1];
  const bus = createCommandBus(doc);

  bus.dispatch(moveNodeCommand(a.id, section.id, 0));
  assert.equal(div.children.length, 1);
  assert.equal(section.children.length, 1);
  assert.equal(section.children[0], a);

  bus.undo();
  assert.equal(div.children.length, 2);
  assert.equal(div.children[0], a);
  assert.equal(section.children.length, 0);
});

test('updateNodeCommand: replaces attrs / styles and restores exactly', () => {
  const doc = createDocument('<p class="a" id="b" style="color: red">x</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);

  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'z' } }));
  bus.dispatch(updateNodeCommand(p.id, { styles: { color: 'blue' } }));
  assert.equal(p.attrs.class, 'z');
  assert.equal(p.attrs.id, undefined);
  assert.equal(p.styles.color, 'blue');

  bus.undo(); // color restored
  assert.equal(p.styles.color, 'red');

  bus.undo(); // attrs restored
  assert.equal(p.attrs.class, 'a');
  assert.equal(p.attrs.id, 'b');
});

// ---------------------------------------------------------------------------
// Long sequence: insert → insert → update → move → remove
// ---------------------------------------------------------------------------

test('long sequence: insert/update/move/remove all undo and redo cleanly', () => {
  const doc = createDocument();
  const bus = createCommandBus(doc);

  const c1 = bus.dispatch(insertNodeCommand('root', { tag: 'div' }));
  const divId = c1.insertedId;

  const c2 = bus.dispatch(insertNodeCommand(divId, { tag: 'p' }));
  const pId = c2.insertedId;

  const c3 = bus.dispatch(insertNodeCommand(divId, { tag: 'p' }));
  const p2Id = c3.insertedId;

  bus.dispatch(updateNodeCommand(pId, { styles: { color: 'red' } }));
  bus.dispatch(moveNodeCommand(p2Id, 'root', 0));
  bus.dispatch(removeNodeCommand(pId));

  // Current state: root has [p2, div]; div has []; pId gone.
  assert.equal(doc.root.children.length, 2);
  assert.equal(doc.root.children[0].id, p2Id);
  assert.equal(doc.root.children[1].id, divId);
  assert.equal(doc.getNode(pId), null);

  // Undo everything in reverse.
  bus.undo(); // undo remove
  assert.ok(doc.getNode(pId), 'p should be restored');
  bus.undo(); // undo move
  assert.equal(doc.getNode(divId).children.length >= 1, true);
  bus.undo(); bus.undo(); bus.undo(); bus.undo();
  assert.equal(doc.root.children.length, 0);
  assert.equal(bus.canUndo(), false);

  // Redo back to the end state.
  for (let i = 0; i < 6; i++) bus.redo();
  assert.equal(doc.root.children.length, 2);
  assert.equal(doc.root.children[0].id, p2Id);
  assert.equal(doc.root.children[1].id, divId);
  assert.equal(doc.getNode(pId), null);
});

test('factory error messages are descriptive', () => {
  const doc = createDocument();
  const bus = createCommandBus(doc);
  assert.throws(
    () => bus.dispatch(insertNodeCommand('nope', { tag: 'div' })),
    /parent not found/,
  );
  const p = doc.insertNode('root', { tag: 'p' });
  bus.dispatch(removeNodeCommand(p.id));
  assert.throws(
    () => bus.dispatch(removeNodeCommand(p.id)),
    /node not found/,
  );
});

// ---------------------------------------------------------------------------
// Custom commands
// ---------------------------------------------------------------------------

test('custom commands: do/undo called with the doc', () => {
  const doc = createDocument('<p>hi</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);
  let lastSeenDoc = null;
  const custom = {
    label: 'custom',
    do(d) { lastSeenDoc = d; p.attrs['data-x'] = '1'; },
    undo(d) { lastSeenDoc = d; delete p.attrs['data-x']; },
  };
  bus.dispatch(custom);
  assert.equal(lastSeenDoc, doc);
  assert.equal(p.attrs['data-x'], '1');
  bus.undo();
  assert.equal(p.attrs['data-x'], undefined);
  bus.redo();
  assert.equal(p.attrs['data-x'], '1');
});

test('custom commands: invalid command throws', () => {
  const doc = createDocument();
  const bus = createCommandBus(doc);
  assert.throws(() => bus.dispatch(null), /do\(doc\) and undo\(doc\)/);
  assert.throws(() => bus.dispatch({}), /do\(doc\) and undo\(doc\)/);
});

// ---------------------------------------------------------------------------
// onChange
// ---------------------------------------------------------------------------

test('onChange: fires on dispatch, undo, redo, clear', () => {
  const doc = createDocument('<p>x</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);
  const events = [];
  const unsub = bus.onChange((e) => events.push(e.reason));
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'a' } }));
  bus.undo();
  bus.redo();
  bus.clear();
  assert.deepEqual(events, ['dispatch', 'undo', 'redo', 'clear']);
  unsub();
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'b' } }));
  assert.deepEqual(events, ['dispatch', 'undo', 'redo', 'clear']);
});

test('onChange: listener errors do not break the bus', () => {
  const doc = createDocument('<p>x</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);
  bus.onChange(() => { throw new Error('boom'); });
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'a' } }));
  assert.equal(p.attrs.class, 'a');
  bus.undo();
  assert.equal(p.attrs.class, undefined);
});

// ---------------------------------------------------------------------------
// history()
// ---------------------------------------------------------------------------

test('history: reports command labels in each stack', () => {
  const doc = createDocument('<p>x</p>');
  const p = doc.root.children[0];
  const bus = createCommandBus(doc);
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'a' } }));
  bus.dispatch(updateNodeCommand(p.id, { attrs: { class: 'b' } }));
  bus.undo();
  const h = bus.history();
  assert.equal(h.undo.length, 1);
  assert.equal(h.redo.length, 1);
  assert.match(h.undo[0], /Update/);
  assert.match(h.redo[0], /Update/);
});

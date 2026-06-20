/**
 * @file Undo/redo command bus operating on a document model.
 *
 *       A command is a plain object of the form:
 *         {
 *           label?: string,         // human-readable, used in history()
 *           do(doc):  void,         // apply the edit; capture undo state in closure
 *           undo(doc): void,        // reverse the edit
 *         }
 *
 *       Commands mutate the doc in place. They capture any state they
 *       need to reverse themselves inside their closure when `do` runs.
 *       This pattern keeps the bus itself trivial (just two stacks) and
 *       makes commands easy to compose, serialize, and replay (e.g. for
 *       a future AI phase that proposes batches of edits).
 *
 *       Factories are exported for the four canonical editor edits:
 *         updateNodeCommand, insertNodeCommand, removeNodeCommand, moveNodeCommand.
 *
 *       Redo truncation: dispatching a new command clears the redo stack
 *       (standard editor behavior). Stack size is capped at 500 to bound
 *       memory in long sessions.
 */

const MAX_HISTORY = 500;

/**
 * Create a command bus bound to a document.
 *
 * @param {object} doc - A document from createDocument()
 * @returns {{
 *   dispatch: (command: object) => object,
 *   undo: () => boolean,
 *   redo: () => boolean,
 *   canUndo: () => boolean,
 *   canRedo: () => boolean,
 *   clear: () => void,
 *   onChange: (cb: (e: object) => void) => () => void,
 *   history: () => {undo: string[], redo: string[]},
 *   getDoc: () => object,
 * }}
 */
export function createCommandBus(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('createCommandBus: a document is required');
  }
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set();

  function notify(reason) {
    if (listeners.size === 0) return;
    const evt = { type: 'change', reason, doc, bus: api };
    for (const cb of listeners) {
      try { cb(evt); } catch (_) { /* listener errors must not break the bus */ }
    }
  }

  /**
   * Run a command's `do` against the doc and push it onto the undo stack.
   * Truncates the redo stack (a new edit invalidates redo history).
   * @param {{do: function, undo: function, label?: string}} command
   * @returns {object} the command (so callers can read insertedId etc.)
   */
  function dispatch(command) {
    if (!command || typeof command.do !== 'function' || typeof command.undo !== 'function') {
      throw new Error('dispatch: command must have do(doc) and undo(doc) methods');
    }
    command.do(doc);
    undoStack.push(command);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    notify('dispatch');
    return command;
  }

  /**
   * Pop the most recent command, call its undo, push it onto the redo stack.
   * @returns {boolean} true if a command was undone
   */
  function undo() {
    if (!undoStack.length) return false;
    const cmd = undoStack.pop();
    cmd.undo(doc);
    redoStack.push(cmd);
    notify('undo');
    return true;
  }

  /**
   * Pop the most recent undone command, call its do, push it back onto undo.
   * @returns {boolean} true if a command was redone
   */
  function redo() {
    if (!redoStack.length) return false;
    const cmd = redoStack.pop();
    cmd.do(doc);
    undoStack.push(cmd);
    notify('redo');
    return true;
  }

  /** @returns {boolean} */
  function canUndo() { return undoStack.length > 0; }
  /** @returns {boolean} */
  function canRedo() { return redoStack.length > 0; }

  /** Clear both stacks (e.g. when opening a new document). */
  function clear() {
    undoStack.length = 0;
    redoStack.length = 0;
    notify('clear');
  }

  /**
   * Subscribe to bus events. The callback receives
   *   { type: 'change', reason: 'dispatch'|'undo'|'redo'|'clear', doc, bus }.
   * @returns {() => void} unsubscribe
   */
  function onChange(cb) {
    if (typeof cb !== 'function') {
      throw new Error('onChange: callback must be a function');
    }
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Snapshot of command labels in each stack (for UI menus). */
  function history() {
    return {
      undo: undoStack.map((c) => c.label || 'command'),
      redo: redoStack.map((c) => c.label || 'command'),
    };
  }

  const api = {
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    onChange,
    history,
    getDoc: () => doc,
  };
  return api;
}

// ---------------------------------------------------------------------------
// Factory commands. Each returns a fresh command object every time. State
// for the inverse is captured in the closure when `do` runs.
// ---------------------------------------------------------------------------

/**
 * Patch one or more fields on a node. Undo restores the pre-patch state.
 *
 * @param {string} id
 * @param {{attrs?: object, styles?: object, text?: string, tag?: string}} patch
 */
export function updateNodeCommand(id, patch) {
  let snapshot = null;
  const cmd = {
    label: `Update ${id}`,
    do(_doc) {
      const node = _doc.getNode(id);
      if (!node) throw new Error(`updateNodeCommand: node not found: ${id}`);
      // Snapshot every field the model tracks so undo can fully restore.
      // The snapshot is captured on the FIRST do; on redo we reuse it.
      if (!snapshot) {
        snapshot = {
          id,
          attrs: node.attrs ? { ...node.attrs } : {},
          styles: node.styles ? { ...node.styles } : {},
          text: node.text,
          tag: node.tag,
        };
      }
      _doc.updateNode(id, patch);
    },
    undo(_doc) {
      if (!snapshot) return;
      _doc.updateNode(snapshot.id, {
        attrs: snapshot.attrs,
        styles: snapshot.styles,
        text: snapshot.text,
        tag: snapshot.tag,
      });
    },
  };
  return cmd;
}

/**
 * Insert a new node. If `node.id` is missing, one is generated from the doc.
 * The id is captured on the first `do()` call and reused on redo so the
 * node's identity is stable across the full do→undo→redo cycle.
 * The resulting command exposes `insertedId` (set during do) so callers can
 * follow up with further edits.
 *
 * @param {string} parentId
 * @param {object} node
 * @param {number} [index]
 */
export function insertNodeCommand(parentId, node, index) {
  /** @type {{id: string, parentId: string, index: number} | null} */
  let snapshot = null;
  const cmd = {
    label: `Insert into ${parentId}`,
    insertedId: null,
    do(_doc) {
      const parent = _doc.getNode(parentId);
      if (!parent) throw new Error(`insertNodeCommand: parent not found: ${parentId}`);
      const newNode = { ...node };
      // Reuse the id from the first do() so redo puts the same node back.
      if (!newNode.id) {
        newNode.id = (snapshot && snapshot.id) || _doc.generateId();
      }
      snapshot = {
        id: newNode.id,
        parentId,
        index: typeof index === 'number' ? index : -1,
      };
      _doc.insertNode(parentId, newNode, index);
      cmd.insertedId = newNode.id;
    },
    undo(_doc) {
      if (!snapshot) return;
      _doc.removeNode(snapshot.id);
    },
  };
  return cmd;
}

/**
 * Remove a node. Undo re-inserts the same subtree (same reference) at the
 * original position. The original node reference is captured on the first
 * `do()` call; on redo we reuse that snapshot and re-remove the same id.
 *
 * @param {string} id
 */
export function removeNodeCommand(id) {
  /** @type {{id: string, parentId: string|null, index: number, node: object} | null} */
  let snapshot = null;
  const cmd = {
    label: `Remove ${id}`,
    do(_doc) {
      if (id === 'root') throw new Error('removeNodeCommand: cannot remove the root');
      if (!snapshot) {
        // First do: capture the node's original parent / index / reference.
        const node = _doc.getNode(id);
        if (!node) throw new Error(`removeNodeCommand: node not found: ${id}`);
        const parent = _doc.parentOf(id);
        snapshot = {
          id,
          parentId: parent ? parent.id : null,
          index: parent ? parent.children.indexOf(node) : -1,
          node, // keep the original reference so undo restores it identity-preservingly
        };
      }
      _doc.removeNode(snapshot.id);
    },
    undo(_doc) {
      if (!snapshot || !snapshot.parentId) return;
      _doc.insertNode(snapshot.parentId, snapshot.node, snapshot.index);
    },
  };
  return cmd;
}

/**
 * Move a node to a new parent / position. Undo moves it back to the
 * original parent / index. The original parent / index is captured on
 * the first `do()` call; on redo we re-apply the same forward move.
 *
 * @param {string} id
 * @param {string} newParentId
 * @param {number} [index]
 */
export function moveNodeCommand(id, newParentId, index) {
  /** @type {{id: string, oldParentId: string|null, oldIndex: number, newParentId: string, newIndex: number} | null} */
  let snapshot = null;
  const cmd = {
    label: `Move ${id} → ${newParentId}`,
    do(_doc) {
      const node = _doc.getNode(id);
      if (!node) throw new Error(`moveNodeCommand: node not found: ${id}`);
      if (!snapshot) {
        const oldParent = _doc.parentOf(id);
        snapshot = {
          id,
          oldParentId: oldParent ? oldParent.id : null,
          oldIndex: oldParent ? oldParent.children.indexOf(node) : -1,
          newParentId,
          newIndex: typeof index === 'number' ? index : -1,
        };
      }
      _doc.moveNode(snapshot.id, snapshot.newParentId, snapshot.newIndex);
    },
    undo(_doc) {
      if (!snapshot || !snapshot.oldParentId) return;
      _doc.moveNode(snapshot.id, snapshot.oldParentId, snapshot.oldIndex);
    },
  };
  return cmd;
}

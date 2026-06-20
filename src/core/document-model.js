/**
 * @file Headless document model — framework-agnostic, in-memory tree of
 *       editable nodes with a flat id→node index.
 *
 *       Pure logic. No DOM, no UI, no React, no styling. Safe to use in
 *       Node, browsers, or workers. ES module, JSDoc-typed.
 *
 * Node shape:
 *   {
 *     id:      string,                       // unique within the doc
 *     tag:     string,                       // 'div' | 'p' | ... | '#text' | '#document'
 *     attrs:   { [name]: string | true },    // HTML attribute map (value, or true for boolean attrs)
 *     styles:  { [prop]: string },           // inline CSS declarations
 *     children: Node[],                      // child element nodes (empty for #text and void elements)
 *     text:    string | undefined,           // text content for #text nodes only
 *   }
 *
 * Document shape (the object returned by createDocument):
 *   {
 *     id:        string,                     // unique document id
 *     css:       string,                     // collected <style> content / external CSS
 *     root:      Node,                       // synthetic #document root
 *     index:     Map<string, Node>,          // flat id→node lookup, kept in sync
 *     _idCounter: number,                    // monotonic counter for generated ids
 *
 *     // methods
 *     generateId(), getNode(id), parentOf(id), updateNode(id, patch),
 *     insertNode(parentId, node, index?), removeNode(id),
 *     moveNode(id, newParentId, index), toJSON(), fromJSON(obj),
 *   }
 *
 * Stability contract: ids are unique within a document and stable across
 * edits (a node keeps its id until removed). Serialized output omits ids;
 * deserialized documents get freshly generated ids, so round-trip equality
 * holds at the structural level (tags/attrs/styles/text/hierarchy).
 */

let _docCounter = 0;
function nextDocId() {
  _docCounter += 1;
  return 'd' + _docCounter;
}

/** HTML5 void elements — never have children and are serialized without a closing tag. */
export const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** @returns {boolean} */
function isTextNode(n) { return !!n && n.tag === '#text'; }

/** Deep-clone a node, breaking all references to the original tree. */
function cloneNode(node) {
  if (!node) return null;
  return {
    id: node.id,
    tag: node.tag,
    attrs: node.attrs ? { ...node.attrs } : {},
    styles: node.styles ? { ...node.styles } : {},
    children: Array.isArray(node.children) ? node.children.map(cloneNode) : [],
    text: node.text,
  };
}

/** Index every node in a subtree by id into doc.index. */
function indexSubtree(doc, node) {
  if (!node) return;
  if (node.id) doc.index.set(node.id, node);
  if (Array.isArray(node.children)) {
    for (const c of node.children) indexSubtree(doc, c);
  }
}

/** Remove every node in a subtree from doc.index. */
function unindexSubtree(doc, node) {
  if (!node) return;
  if (node.id) doc.index.delete(node.id);
  if (Array.isArray(node.children)) {
    for (const c of node.children) unindexSubtree(doc, c);
  }
}

/** Find the direct parent of a node by walking the root tree. */
function findParent(root, id) {
  for (const c of (root.children || [])) {
    if (c.id === id) return root;
    const found = findParent(c, id);
    if (found) return found;
  }
  return null;
}

/**
 * Returns true if `ancestorId` is an ancestor of (or equal to) `descendantId`.
 * Used for cycle detection on insert/move.
 */
function isAncestorOf(doc, ancestorId, descendantId) {
  if (ancestorId === descendantId) return true;
  const n = doc.index.get(descendantId);
  if (!n) return false;
  let cur = n;
  while (cur && cur.tag !== '#document') {
    const parent = findParent(doc.root, cur.id);
    if (!parent) return false;
    if (parent.id === ancestorId) return true;
    cur = parent;
  }
  return false;
}

/** Parse a "k:v;k:v" string into a styles object. */
export function parseStyleString(str) {
  const out = {};
  if (typeof str !== 'string' || !str) return out;
  for (const decl of str.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const k = decl.slice(0, idx).trim();
    const v = decl.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/** Decode the small set of HTML entities we round-trip. */
function decodeEntities(s) {
  if (s.indexOf('&') === -1) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * Tokenize a single opening or self-closing tag's attribute list.
 *   ` attr="v" attr2='v2' attr3=val boolean` → { attr: 'v', attr2: 'v2', attr3: 'val', boolean: true }
 */
function parseAttrs(s) {
  const attrs = {};
  if (!s) return attrs;
  const re = /([a-zA-Z_:][a-zA-Z0-9_:\-.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=`]+)))?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const name = m[1];
    let val;
    if (m[2] != null) val = decodeEntities(m[2]);
    else if (m[3] != null) val = decodeEntities(m[3]);
    else if (m[4] != null) val = decodeEntities(m[4]);
    else val = true; // boolean attribute (no =)
    attrs[name] = val;
  }
  return attrs;
}

/**
 * Tiny, dependency-free HTML tokenizer → tree.
 *
 * Returns: { tree: Node[], styleCss: string }
 *   - tree: array of element / #text nodes (the body-level children)
 *   - styleCss: concatenated content of any <style> blocks encountered
 *
 * Recognizes:
 *   - opening tags  `<p class="a">`
 *   - self-closing  `<br />` or `<br/>`
 *   - closing tags  `</p>`
 *   - void elements (no closing tag required)
 *   - <style>...</style>  (extracted into styleCss, dropped from the tree)
 *   - <script>...</script> (dropped from the tree)
 *   - comments `<!-- ... -->`
 *   - doctype  `<!DOCTYPE ...>`
 *   - CDATA    `<![CDATA[ ... ]]>`
 *   - HTML entities in text and attribute values
 *
 * Not handled: nested foreign content (SVG/MathML namespaces), raw < in
 * script bodies, processing instructions. Good enough for editor export
 * shapes and HTML fragments the application produces.
 */
export function parseHtmlFragment(input) {
  if (typeof input !== 'string') return { tree: [], styleCss: '' };
  const tree = [];
  let styleCss = '';
  /** @type {Array<{tag: string, children: any[]}>} */
  const stack = [{ tag: '#fragment', children: tree }];

  let i = 0;
  const len = input.length;

  /** Append text to the current parent's children, coalescing adjacent #text nodes. */
  const pushText = (text) => {
    if (!text) return;
    const parent = stack[stack.length - 1];
    const last = parent.children[parent.children.length - 1];
    if (last && last.tag === '#text') {
      last.text += text;
    } else {
      parent.children.push({
        id: '',
        tag: '#text',
        attrs: {},
        styles: {},
        children: [],
        text,
      });
    }
  };

  while (i < len) {
    const ch = input[i];
    if (ch !== '<') {
      // Plain text up to the next '<'.
      const next = input.indexOf('<', i);
      const end = next === -1 ? len : next;
      pushText(decodeEntities(input.slice(i, end)));
      i = end;
      continue;
    }

    // We're at '<' — figure out what kind.

    // Comment.
    if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }

    // Doctype.
    if (/^<!doctype/i.test(input.slice(i, i + 9))) {
      const end = input.indexOf('>', i);
      i = end === -1 ? len : end + 1;
      continue;
    }

    // CDATA.
    if (input.startsWith('<![CDATA[', i)) {
      const end = input.indexOf(']]>', i + 9);
      const textEnd = end === -1 ? len : end;
      pushText(input.slice(i + 9, textEnd));
      i = end === -1 ? len : end + 3;
      continue;
    }

    // Closing tag.
    if (input[i + 1] === '/') {
      const m = /^<\/\s*([a-zA-Z][a-zA-Z0-9-]*)\s*>/.exec(input.slice(i));
      if (m) {
        const name = m[1].toLowerCase();
        for (let s = stack.length - 1; s > 0; s--) {
          if (stack[s].tag.toLowerCase() === name) {
            // Pop everything from the matching tag (inclusive) — the tag
            // is now closed, so the parent becomes the new top of stack.
            stack.length = s;
            break;
          }
        }
        i += m[0].length;
        continue;
      }
      // Malformed close; skip the '<' and keep going.
      pushText('<');
      i += 1;
      continue;
    }

    // Opening or self-closing tag.
    const m = /^<\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)(\/?)>/.exec(input.slice(i));
    if (!m) {
      // Not a tag — emit '<' as text and advance one char.
      pushText('<');
      i += 1;
      continue;
    }

    const name = m[1].toLowerCase();
    const attrStr = m[2] || '';
    const selfClosing = m[3] === '/';
    i += m[0].length;

    // <script> and <style> capture raw text until their closing tag.
    if (name === 'script' || name === 'style') {
      const closeRe = new RegExp(`</\\s*${name}\\s*>`, 'i');
      const rest = input.slice(i);
      const cm = closeRe.exec(rest);
      const rawText = cm ? rest.slice(0, cm.index) : rest;
      if (name === 'style') {
        styleCss += (styleCss && rawText ? '\n' : '') + rawText;
      }
      // Both <script> and <style> are dropped from the body tree.
      i += cm ? cm.index + cm[0].length : rest.length;
      continue;
    }

    const node = {
      id: '', // assigned later by the doc
      tag: name,
      attrs: parseAttrs(attrStr),
      styles: {}, // populated from style="..." attribute below
      children: [],
      text: undefined,
    };

    // Hoist `style="..."` into node.styles.
    if (typeof node.attrs.style === 'string') {
      node.styles = parseStyleString(node.attrs.style);
      delete node.attrs.style;
    }

    const parent = stack[stack.length - 1];
    parent.children.push(node);

    if (selfClosing || VOID_TAGS.has(name)) {
      // don't push onto the open-tag stack
    } else {
      stack.push(node);
    }
  }

  return { tree, styleCss };
}

/**
 * Walk a parsed tree and assign ids from a doc (including #text nodes,
 * so every node in the doc has a stable lookup key).
 */
function assignIdsToTree(doc, tree) {
  for (const node of tree) {
    assignIdsToNode(doc, node);
  }
}

/** @param {any} node */
function assignIdsToNode(doc, node) {
  if (!node) return;
  if (!node.id) node.id = doc.generateId();
  if (Array.isArray(node.children)) {
    for (const c of node.children) assignIdsToNode(doc, c);
  }
}

/**
 * Walk a subtree and collect every node id (for duplicate detection
 * before insertion).
 * @param {object} node
 * @returns {Set<string>}
 */
function collectIdsInTree(node) {
  const ids = new Set();
  (function walk(n) {
    if (!n) return;
    if (n.id) ids.add(n.id);
    if (Array.isArray(n.children)) for (const c of n.children) walk(c);
  })(node);
  return ids;
}

/**
 * Assign ids to every node in a subtree that doesn't already have one.
 * Used by insertNode so descendants are addressable via getNode().
 */
function ensureIds(doc, node) {
  if (!node) return;
  if (!node.id) node.id = doc.generateId();
  if (Array.isArray(node.children)) {
    for (const c of node.children) ensureIds(doc, c);
  }
}

/**
 * Returns true if `id` appears anywhere inside `node` (the node itself
 * or any descendant). Used to detect cycles in insertNode — the new
 * node isn't in the doc yet, so we walk its own tree.
 */
function isDescendantInTree(node, id) {
  if (!node) return false;
  if (node.id === id) return true;
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      if (isDescendantInTree(c, id)) return true;
    }
  }
  return false;
}

/**
 * Create a new document.
 *
 * @param {string} [html] - Optional HTML fragment to parse as the body.
 *                           May include <style> blocks; their content is
 *                           concatenated into doc.css and the elements
 *                           are dropped from the tree.
 * @returns {object} A document object with a rich mutation API.
 */
export function createDocument(html) {
  const doc = {
    id: nextDocId(),
    root: null,
    css: '',
    index: new Map(),
    _idCounter: 0,
  };

  // Root is a synthetic #document node — never serialized, never removed.
  doc.root = {
    id: 'root',
    tag: '#document',
    attrs: {},
    styles: {},
    children: [],
    text: undefined,
  };
  doc.index.set('root', doc.root);

  /** Allocate a fresh unique id. @returns {string} */
  doc.generateId = function () {
    doc._idCounter += 1;
    return 'n' + doc._idCounter;
  };

  /**
   * Look up a node by id.
   * @param {string} id
   * @returns {object|null}
   */
  doc.getNode = function (id) {
    return doc.index.get(id) || null;
  };

  /**
   * Get the direct parent of a node, or null for the root / unknown.
   * @param {string} id
   * @returns {object|null}
   */
  doc.parentOf = function (id) {
    const node = doc.index.get(id);
    if (!node) return null;
    if (node.tag === '#document') return null;
    return findParent(doc.root, id);
  };

  /**
   * Patch a node. Recognized fields: attrs, styles, text, tag.
   * Setting `text` on an element is ignored; element text lives in #text
   * children. The root's tag cannot be changed.
   *
   * @param {string} id
   * @param {{attrs?: object, styles?: object, text?: string, tag?: string}} patch
   * @returns {object} the updated node
   */
  doc.updateNode = function (id, patch) {
    const node = doc.index.get(id);
    if (!node) throw new Error(`updateNode: node not found: ${id}`);
    if (patch && typeof patch === 'object') {
      if ('attrs' in patch) {
        node.attrs = patch.attrs ? { ...patch.attrs } : {};
      }
      if ('styles' in patch) {
        node.styles = patch.styles ? { ...patch.styles } : {};
      }
      if ('text' in patch) {
        if (node.tag === '#text') node.text = patch.text == null ? '' : String(patch.text);
        // For element nodes, `text` is intentionally ignored — the text
        // content lives in #text children. This keeps the model consistent.
      }
      if ('tag' in patch) {
        if (node.tag === '#document' || node.tag === '#text') {
          throw new Error(`updateNode: cannot change tag of ${node.tag} node`);
        }
        node.tag = String(patch.tag);
      }
    }
    return node;
  };

  /**
   * Insert a node into the document. The supplied node is taken by
   * reference (not deep-cloned) — callers MUST NOT mutate it after insert.
   * If it has no id, one is generated; ids for all descendants are
   * generated as well. The whole subtree is indexed.
   *
   * @param {string} parentId
   * @param {object} node - { tag, attrs?, styles?, children?, text? }
   * @param {number} [index] - Position in parent.children. Defaults to append.
   * @returns {object} the inserted node (same reference as input)
   */
  doc.insertNode = function (parentId, node, index) {
    const parent = doc.index.get(parentId);
    if (!parent) throw new Error(`insertNode: parent not found: ${parentId}`);
    if (parent.tag === '#text') {
      throw new Error('insertNode: cannot insert into a #text node');
    }
    if (!node || typeof node !== 'object') {
      throw new Error('insertNode: node must be an object');
    }
    if (!node.id) node.id = doc.generateId();
    if (doc.index.has(node.id)) {
      throw new Error(`insertNode: duplicate id ${node.id}`);
    }
    // Normalize the node shape.
    if (!node.tag) node.tag = 'div';
    if (!node.attrs) node.attrs = {};
    if (!node.styles) node.styles = {};
    if (!Array.isArray(node.children)) node.children = [];
    if (node.tag === '#text') {
      node.children = [];
      node.text = node.text == null ? '' : String(node.text);
    }
    // Cycle check: parent must not be a descendant of the new node.
    // Walk the new node's own tree, not the doc (the new node isn't in the doc yet).
    if (node.id === parentId || isDescendantInTree(node, parentId)) {
      throw new Error('insertNode: cannot make a node a descendant of itself');
    }
    // Ensure every descendant has an id, then check none collide.
    const usedIds = collectIdsInTree(node);
    for (const id of usedIds) {
      if (doc.index.has(id)) {
        throw new Error(`insertNode: duplicate id ${id} in inserted subtree`);
      }
    }
    ensureIds(doc, node);
    if (typeof index !== 'number' || index < 0 || index > parent.children.length) {
      parent.children.push(node);
    } else {
      parent.children.splice(index, 0, node);
    }
    indexSubtree(doc, node);
    return node;
  };

  /**
   * Remove a node and all of its descendants from the document.
   * The root cannot be removed.
   *
   * @param {string} id
   * @returns {object} the removed node
   */
  doc.removeNode = function (id) {
    if (id === 'root') throw new Error('removeNode: cannot remove the document root');
    const node = doc.index.get(id);
    if (!node) throw new Error(`removeNode: node not found: ${id}`);
    const parent = doc.parentOf(id);
    if (!parent) throw new Error(`removeNode: orphan node: ${id}`);
    const idx = parent.children.indexOf(node);
    if (idx === -1) throw new Error(`removeNode: not in parent: ${id}`);
    parent.children.splice(idx, 1);
    unindexSubtree(doc, node);
    return node;
  };

  /**
   * Move a node to a new parent / position. Rejects cycles and moves
   * into #text parents.
   *
   * @param {string} id
   * @param {string} newParentId
   * @param {number} [index]
   * @returns {object} the moved node
   */
  doc.moveNode = function (id, newParentId, index) {
    if (id === 'root') throw new Error('moveNode: cannot move the document root');
    const node = doc.index.get(id);
    if (!node) throw new Error(`moveNode: node not found: ${id}`);
    const newParent = doc.index.get(newParentId);
    if (!newParent) throw new Error(`moveNode: parent not found: ${newParentId}`);
    if (newParent.tag === '#text') {
      throw new Error('moveNode: cannot move into a #text node');
    }
    if (id === newParentId) {
      throw new Error('moveNode: cannot move a node into itself');
    }
    if (isAncestorOf(doc, id, newParentId)) {
      throw new Error('moveNode: cannot move a node into its own descendant');
    }
    const oldParent = doc.parentOf(id);
    if (oldParent) {
      const oldIdx = oldParent.children.indexOf(node);
      if (oldIdx !== -1) oldParent.children.splice(oldIdx, 1);
    }
    let pos;
    if (typeof index !== 'number' || index < 0 || index > newParent.children.length) {
      pos = newParent.children.length;
      newParent.children.push(node);
    } else {
      pos = index;
      newParent.children.splice(index, 0, node);
    }
    return node;
  };

  /**
   * Serialize the document to a plain-data object suitable for JSON.
   * The id→node index is omitted; methods are not enumerable on the
   * returned shape (it's a fresh object, not the live doc).
   * @returns {{id: string, css: string, idCounter: number, root: object}}
   */
  doc.toJSON = function () {
    return {
      id: doc.id,
      css: doc.css || '',
      idCounter: doc._idCounter,
      root: cloneNode(doc.root),
    };
  };

  /**
   * Replace this document's contents with a previously-serialized one.
   * @param {{id?: string, css?: string, idCounter?: number, root: object}} data
   * @returns {object} the doc (for chaining)
   */
  doc.fromJSON = function (data) {
    if (!data || typeof data !== 'object') {
      throw new Error('fromJSON: data required');
    }
    doc.id = data.id || doc.id;
    doc.css = data.css || '';
    doc._idCounter = data.idCounter || 0;
    doc.root = data.root
      ? cloneNode(data.root)
      : { id: 'root', tag: '#document', attrs: {}, styles: {}, children: [] };
    // Ensure root tag is always #document.
    doc.root.tag = '#document';
    doc.root.id = 'root';
    doc.index = new Map();
    doc.index.set('root', doc.root);
    indexSubtree(doc, doc.root);
    return doc;
  };

  // Parse initial HTML if provided.
  if (typeof html === 'string' && html.length) {
    const { tree, styleCss } = parseHtmlFragment(html);
    if (styleCss) doc.css = (doc.css || '') + styleCss;
    assignIdsToTree(doc, tree);
    for (const n of tree) doc.root.children.push(n);
    indexSubtree(doc, doc.root);
  }

  return doc;
}

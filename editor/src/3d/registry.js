/**
 * @file Pure object registry — tracks the "selectable meshes" in a 3D
 *       scene without any Three.js dependency. The handle API's
 *       `listObjects()` is just a thin wrapper around this.
 *
 *       Each entry carries enough metadata to surface in a UI panel
 *       (id, name, type) plus everything needed to push transforms
 *       back to a Three.js object on `fromJSON()`. The mesh / material
 *       references are kept here so the handle stays a single
 *       source of truth — no parallel data structures.
 *
 *       Run with: `node --test src/3d/`
 */

/**
 * @typedef {Object} RegistryEntry
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} [source]
 * @property {Array | {x:number,y:number,z:number}} [position]
 * @property {Array | {x:number,y:number,z:number}} [rotation]
 * @property {Array | {x:number,y:number,z:number}} [scale]
 * @property {string | number | {getHexString: () => string}} [color]
 * @property {number} [metalness]
 * @property {number} [roughness]
 * @property {object} [mesh]       - Live Three.js mesh (engine only).
 * @property {object} [material]   - Live Three.js material (engine only).
 * @property {object} [root]       - Live Three.js root / group (engine only).
 */

/**
 * Create a new object registry.
 *
 * @returns {{
 *   add: (entry: RegistryEntry) => string,
 *   remove: (id: string) => boolean,
 *   get: (id: string) => (RegistryEntry | undefined),
 *   has: (id: string) => boolean,
 *   list: () => Array<{id: string, name: string, type: string, source?: string}>,
 *   snapshot: () => RegistryEntry[],
 *   replaceAll: (entries: RegistryEntry[]) => void,
 *   size: () => number,
 *   clear: () => void,
 *   nextId: (prefix?: string) => string,
 * }}
 */
export function createObjectRegistry() {
  /** @type {Map<string, RegistryEntry>} */
  const map = new Map();
  let counter = 0;

  /** Generate the next sequential id like "o-1", "o-2", ... */
  function nextId(prefix = 'o') {
    counter += 1;
    return `${prefix}-${counter}`;
  }

  function add(entry) {
    if (!entry || typeof entry !== 'object' || !entry.id) {
      throw new Error('createObjectRegistry.add: entry.id required');
    }
    if (!entry.type) {
      throw new Error('createObjectRegistry.add: entry.type required');
    }
    map.set(String(entry.id), entry);
    // Keep the counter at least ahead of explicit numeric suffixes
    // (e.g. importing an o-9 should push nextId to o-10+).
    const m = /(\d+)$/.exec(String(entry.id));
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= counter) counter = n;
    }
    return String(entry.id);
  }

  function remove(id) {
    return map.delete(String(id));
  }

  function get(id) {
    return map.get(String(id));
  }

  function has(id) {
    return map.has(String(id));
  }

  /** Stable flat list of selectable meshes — what the UI shows.
   *  Internal "parent" entries (a loaded GLTF root) are hidden —
   *  only their individual sub-meshes appear here. */
  function list() {
    return [...map.values()]
      .filter((e) => !e.__parent)
      .map((e) => {
        const out = { id: e.id, name: e.name || e.id, type: e.type };
        if (e.source != null) out.source = e.source;
        return out;
      });
  }

  /** Deep-ish snapshot of every entry for `toJSON()`. Parent roots
   *  (loaded GLTFs) are excluded — only selectable sub-meshes ship. */
  function snapshot() {
    return [...map.values()]
      .filter((e) => !e.__parent)
      .map((e) => {
        const out = {
          id: e.id,
          name: e.name || e.id,
          type: e.type,
        };
        if (e.source != null) out.source = e.source;
        out.position = vecToArr(e.position, [0, 0, 0]);
        out.rotation = vecToArr(e.rotation, [0, 0, 0]);
        out.scale    = vecToArr(e.scale,    [1, 1, 1]);
        out.color    = colorToString(e.color, '#cccccc');
        out.metalness = Number.isFinite(Number(e.metalness)) ? Number(e.metalness) : 0.1;
        out.roughness = Number.isFinite(Number(e.roughness)) ? Number(e.roughness) : 0.8;
        return out;
      });
  }

  function replaceAll(entries) {
    map.clear();
    counter = 0;
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      if (e && typeof e === 'object' && e.id) {
        map.set(String(e.id), { ...e });
        // Keep the counter at least ahead of explicit numeric ids.
        const m = /(\d+)$/.exec(String(e.id));
        if (m) {
          const n = Number(m[1]);
          if (Number.isFinite(n) && n >= counter) counter = n;
        }
      }
    }
  }

  function size() { return map.size; }
  function clear() { map.clear(); counter = 0; }

  return { add, remove, get, has, list, snapshot, replaceAll, size, clear, nextId };
}

function vecToArr(v, fallback) {
  if (v == null) return [...fallback];
  if (Array.isArray(v)) return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
  if (typeof v === 'object') return [Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0];
  return [...fallback];
}

function colorToString(c, fallback) {
  if (c == null) return fallback;
  if (typeof c === 'object' && typeof c.getHexString === 'function') {
    return '#' + c.getHexString();
  }
  if (typeof c === 'number' && Number.isFinite(c)) {
    return '#' + c.toString(16).padStart(6, '0');
  }
  if (typeof c === 'string') return c.startsWith('#') ? c : `#${c}`;
  return fallback;
}

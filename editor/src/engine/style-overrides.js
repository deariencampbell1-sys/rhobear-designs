/**
 * @file Non-destructive style override store + CSS emitter.
 *
 *       The editor's core promise: editing a live site must NEVER destroy
 *       its original look or functions. All user edits are captured here
 *       as an OVERRIDE LAYER keyed by a stable CSS selector, and applied
 *       on top of the untouched original CSS via a generated <style>
 *       block that can be injected into the live document.
 *
 *       Pure data/string logic. No DOM, no UI, no React. ES module,
 *       JSDoc-typed. Safe in Node, browsers, and workers.
 *
 *       Data shape (stable across JSON round-trips):
 *         store.toJSON() -> { [selector]: { [prop]: value, ... }, ... }
 *
 *       Specificity-aware toStylesheet():
 *         Rules are emitted in ascending order of specificity so that
 *         the LAST rule wins for equal specificity AND higher specificity
 *         always wins regardless of source order. Within a single
 *         specificity bucket, rules appear in insertion order — the
 *         latest edit to the same selector wins.
 *
 *       Reused by diff-serializer.js to fold overrides into export output.
 */

// ---------------------------------------------------------------------------
// Specificity
// ---------------------------------------------------------------------------

/**
 * Compute CSS specificity for a single (non comma-list) selector.
 *
 * Returns `[ids, classes, types]` — three non-negative integers in the
 * canonical order. Supports: type, class, id, attribute, pseudo-class,
 * pseudo-element, universal (`*`), and combinators (descendant ' ',
 * child '>', adjacent '+', general '~').
 *
 * Functional pseudo-classes:
 *   - `:not(X)` / `:is(X)` / `:has(X)` / `:matches(X)` use the HIGHEST
 *     specificity of their argument selectors (per CSS Selectors L4).
 *   - `:where(X)` contributes zero.
 *   - Other functional pseudos (`:nth-child(2n+1)`, `:lang(en)`, …) count
 *     as a single class each.
 *
 * A top-level comma in the selector stops parsing (this function returns
 * the specificity of the prefix). For comma-separated lists, call it
 * once per part and take the maximum.
 *
 * @param {string} selector
 * @returns {[number, number, number]}
 */
export function specificity(selector) {
  if (typeof selector !== 'string') return [0, 0, 0];
  const s = selector;

  let ids = 0;
  let classes = 0;
  let types = 0;
  let i = 0;

  const isNameChar = (c) =>
    (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z') ||
    (c >= '0' && c <= '9') ||
    c === '-' || c === '_';
  const isNameStart = (c) =>
    (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z') ||
    c === '-' || c === '_';

  // Walk past whitespace and CSS combinators between simple selectors.
  function skipWhitespaceAndCombinators() {
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        i++;
        continue;
      }
      if (c === '>' || c === '+' || c === '~') {
        i++;
        while (i < s.length && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++;
        continue;
      }
      break;
    }
  }

  while (i < s.length) {
    // Top-level comma terminates a comma-separated list — stop parsing
    // and return the specificity of the prefix.
    if (s[i] === ',') break;
    skipWhitespaceAndCombinators();
    if (i >= s.length) break;
    if (s[i] === ',') break;

    const c = s[i];

    // Universal selector — contributes nothing.
    if (c === '*') { i++; continue; }

    // ID selector.
    if (c === '#') {
      i++;
      while (i < s.length && isNameChar(s[i])) i++;
      ids++;
      continue;
    }

    // Class selector.
    if (c === '.') {
      i++;
      while (i < s.length && isNameChar(s[i])) i++;
      classes++;
      continue;
    }

    // Attribute selector.
    if (c === '[') {
      i++;
      let depth = 1;
      while (i < s.length && depth > 0) {
        if (s[i] === '[') depth++;
        else if (s[i] === ']') depth--;
        if (depth > 0) i++;
      }
      if (i < s.length) i++; // consume closing ']'
      classes++;
      continue;
    }

    // Pseudo-class / pseudo-element.
    if (c === ':') {
      i++;
      let isDouble = false;
      if (s[i] === ':') { isDouble = true; i++; }
      const nameStart = i;
      while (i < s.length && isNameChar(s[i])) i++;
      const name = s.slice(nameStart, i);

      if (s[i] === '(') {
        // Functional pseudo with arguments.
        i++; // consume '('
        let depth = 1;
        const argStart = i;
        while (i < s.length && depth > 0) {
          const cc = s[i];
          if (cc === '(' || cc === '[') depth++;
          else if (cc === ')' || cc === ']') depth--;
          if (depth > 0) i++;
        }
        const args = s.slice(argStart, i);
        if (i < s.length) i++; // consume ')'

        if (name === 'where') {
          // Zero specificity.
        } else if (name === 'not' || name === 'is' || name === 'has' || name === 'matches') {
          // Highest specificity of the argument selectors.
          let maxSpec = [0, 0, 0];
          for (const part of splitTopLevelCommas(args)) {
            const sp = specificity(part.trim());
            if (compareSpec(sp, maxSpec) > 0) maxSpec = sp;
          }
          ids += maxSpec[0]; classes += maxSpec[1]; types += maxSpec[2];
        } else if (isDouble) {
          // Pseudo-element with arguments (e.g. ::part, ::slotted) → type.
          types++;
        } else {
          // Functional pseudo-class (e.g. :nth-child(2n+1), :lang(en)) → class.
          classes++;
        }
      } else if (name.length) {
        // No arguments.
        if (isDouble) types++; else classes++;
      }
      continue;
    }

    // Type / element selector.
    if (isNameStart(c)) {
      while (i < s.length && isNameChar(s[i])) i++;
      types++;
      continue;
    }

    // Unknown character — skip without contributing.
    i++;
  }

  return [ids, classes, types];
}

/** Split a string on top-level commas (ignoring those inside () or []). */
function splitTopLevelCommas(s) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

/** Compare two [ids, classes, types] specificity tuples. */
function compareSpec(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

// ---------------------------------------------------------------------------
// Prop / value validation
// ---------------------------------------------------------------------------

/**
 * Validate a CSS property name. Rejects names containing characters that
 * would break out of a declaration (`;`, `{`, `}`, `:`, newlines, NULs).
 *
 * @param {string} prop
 * @returns {boolean}
 */
export function isValidPropName(prop) {
  if (typeof prop !== 'string' || !prop) return false;
  // Property names allow letters, digits, hyphens; the leading character
  // must be a letter or hyphen (no digit start). The forbidden chars are
  // the structural ones that would split a declaration.
  for (let i = 0; i < prop.length; i++) {
    const c = prop.charCodeAt(i);
    const ok =
      (c >= 0x61 && c <= 0x7A) || // a-z
      (c >= 0x41 && c <= 0x5A) || // A-Z
      (c >= 0x30 && c <= 0x39) || // 0-9
      c === 0x2D || // -
      c === 0x5F;   // _
    if (!ok) return false;
  }
  // First char must be a letter or hyphen.
  const first = prop.charCodeAt(0);
  if (!((first >= 0x61 && first <= 0x7A) ||
        (first >= 0x41 && first <= 0x5A) ||
        first === 0x2D)) {
    return false;
  }
  return true;
}

/**
 * Validate a CSS declaration value. Rejects values that contain the
 * structural characters that would break a single-line declaration
 * (`;`, `{`, `}`, NULs, raw newlines). Commas, parentheses, colons and
 * strings are allowed (modern CSS values frequently contain them).
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isValidValue(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 0x3B /* ; */ || c === 0x7B /* { */ || c === 0x7D /* } */ ||
        c === 0x00 /* NUL */ || c === 0x0A /* \n */ || c === 0x0D /* \r */) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Override store
// ---------------------------------------------------------------------------

/**
 * Create a fresh override store.
 *
 * @returns {{
 *   setStyle:       (selector: string, prop: string, value: string|number) => boolean,
 *   setStyles:      (selector: string, obj: object) => boolean,
 *   removeOverride: (selector: string, prop: string) => boolean,
 *   getOverridesFor:(selector: string) => { [prop: string]: string },
 *   getSelectors:   () => string[],
 *   hasOverrides:   () => boolean,
 *   size:           () => number,
 *   clear:          () => void,
 *   toJSON:         () => { [selector: string]: { [prop: string]: string } },
 *   fromJSON:       (obj: object) => boolean,
 * }}
 */
export function createOverrideStore() {
  /** @type {Map<string, Map<string, string>>} selector → (prop → value) */
  const data = new Map();

  function ensureSelector(selector) {
    let m = data.get(selector);
    if (!m) { m = new Map(); data.set(selector, m); }
    return m;
  }

  function isOkSelector(selector) {
    if (typeof selector !== 'string' || selector.length === 0) return false;
    // Defense-in-depth: block keys that, if used as a selector, would
    // mutate Object.prototype when the store is later round-tripped
    // through toJSON() (which builds a plain `{}` and assigns by key).
    if (selector === '__proto__' || selector === 'constructor' ||
        selector === 'prototype') {
      return false;
    }
    return true;
  }

  /**
   * Set a single property override.
   * @param {string} selector
   * @param {string} prop
   * @param {string|number} value
   * @returns {boolean} true if accepted
   */
  function setStyle(selector, prop, value) {
    if (!isOkSelector(selector)) return false;
    if (!isValidPropName(prop)) return false;
    if (value === null || value === undefined) return false;
    const str = String(value);
    if (!isValidValue(str)) return false;
    ensureSelector(selector).set(prop, str);
    return true;
  }

  /**
   * Set multiple property overrides for one selector at once.
   * Invalid entries are silently skipped; valid ones are still applied.
   * @param {string} selector
   * @param {object} obj
   * @returns {number} number of entries actually applied
   */
  function setStyles(selector, obj) {
    if (!isOkSelector(selector)) return 0;
    if (!obj || typeof obj !== 'object') return 0;
    let applied = 0;
    const m = ensureSelector(selector);
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === null || v === undefined) continue;
      if (!isValidPropName(k)) continue;
      const str = String(v);
      if (!isValidValue(str)) continue;
      m.set(k, str);
      applied++;
    }
    return applied;
  }

  /**
   * Remove a single property override. Cleans up the selector entry
   * when its last property is removed.
   * @param {string} selector
   * @param {string} prop
   * @returns {boolean} true if a property was removed
   */
  function removeOverride(selector, prop) {
    const m = data.get(selector);
    if (!m) return false;
    const had = m.delete(prop);
    if (m.size === 0) data.delete(selector);
    return had;
  }

  /**
   * Return a plain-object snapshot of the overrides for one selector.
   * @param {string} selector
   * @returns {{[prop: string]: string}}
   */
  function getOverridesFor(selector) {
    const m = data.get(selector);
    if (!m) return {};
    const out = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  /**
   * List the selectors currently in the store, in insertion order.
   * @returns {string[]}
   */
  function getSelectors() {
    return Array.from(data.keys());
  }

  /** @returns {boolean} */
  function hasOverrides() {
    if (data.size === 0) return false;
    for (const m of data.values()) if (m.size > 0) return true;
    return false;
  }

  /** @returns {number} total property overrides across all selectors */
  function size() {
    let n = 0;
    for (const m of data.values()) n += m.size;
    return n;
  }

  function clear() { data.clear(); }

  /**
   * Serialize to a JSON-safe object. Insertion order is preserved via
   * the keys-of-objects iteration order (V8 / ES2015+ guarantee this
   * for string keys, and JSON.stringify preserves it).
   *
   * @returns {{[selector: string]: {[prop: string]: string}}}
   */
  function toJSON() {
    const out = {};
    for (const [sel, props] of data) {
      const o = {};
      for (const [k, v] of props) o[k] = v;
      out[sel] = o;
    }
    return out;
  }

  /**
   * Replace the store contents from a previously serialized object.
   * Invalid entries are silently dropped; valid ones are still applied.
   *
   * Defensive: if `obj` is not a plain object (null, undefined,
   * non-object), the existing store contents are LEFT UNTOUCHED and 0
   * is returned. This protects the editor's current edits from being
   * wiped by an accidentally bad snapshot.
   *
   * @param {object} obj
   * @returns {number} number of property entries actually applied
   */
  function fromJSON(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 0;
    data.clear();
    let applied = 0;
    for (const sel of Object.keys(obj)) {
      if (!isOkSelector(sel)) continue;
      const props = obj[sel];
      if (!props || typeof props !== 'object') continue;
      const m = new Map();
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v === null || v === undefined) continue;
        if (!isValidPropName(k)) continue;
        const str = String(v);
        if (!isValidValue(str)) continue;
        m.set(k, str);
        applied++;
      }
      if (m.size) data.set(sel, m);
    }
    return applied;
  }

  return {
    setStyle, setStyles, removeOverride,
    getOverridesFor, getSelectors,
    hasOverrides, size, clear,
    toJSON, fromJSON,
  };
}

// ---------------------------------------------------------------------------
// Stylesheet emitter
// ---------------------------------------------------------------------------

/**
 * Emit a CSS text body for the given override store.
 *
 * Output is a sequence of one-rule-per-selector blocks. Rules are sorted
 * by ascending CSS specificity so that more specific selectors come LAST
 * and therefore win ties (higher specificity always wins regardless of
 * source order). Within a single specificity bucket, rules appear in
 * insertion order so the LATEST edit to the same selector wins.
 *
 * Empty rules (a selector with no remaining properties) are skipped.
 * The returned string is plain CSS — wrap it in a `<style>...</style>`
 * block before injecting it into a document.
 *
 * @param {object} store  override store from createOverrideStore()
 * @returns {string}      the CSS text body (empty string if no overrides)
 */
export function toStylesheet(store) {
  if (!store || typeof store.getSelectors !== 'function') return '';
  const selectors = store.getSelectors();
  if (!selectors.length) return '';

  // Tag each selector with its insertion index so we have an explicit,
  // stable tiebreaker (Array#sort is stable in V8, but the explicit index
  // documents intent and protects against engine quirks).
  const indexed = selectors.map((sel, idx) => ({
    sel, idx, spec: specificity(sel),
  }));
  indexed.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a.spec[i] !== b.spec[i]) return a.spec[i] - b.spec[i];
    }
    return a.idx - b.idx;
  });

  const blocks = [];
  for (const { sel } of indexed) {
    const props = store.getOverridesFor(sel);
    const keys = Object.keys(props);
    if (!keys.length) continue;
    const decls = keys.map((k) => `${k}:${props[k]}`).join(';');
    blocks.push(`${sel}{${decls}}`);
  }
  return blocks.join('\n');
}

/**
 * @file postMessage bridge between the editor (parent) and an agent
 *       script injected into the iframe that hosts the live page.
 *
 *       Pure logic + two factories:
 *
 *         createBridge(iframe, callbacks)  — parent side
 *         createAgent(windowObj, opts)     — iframe side
 *
 *       The bridge is layered:
 *         1. Pure serialization helpers (serializeMessage, deserializeMessage,
 *            isValidOrigin, guardIncoming) — usable in Node tests.
 *         2. Parent-side factory that listens for messages from the iframe
 *            and exposes `post(kind, payload)` to send back.
 *         3. Agent-side factory that listens for messages from the parent
 *            and exposes `emit(kind, payload)`, `enable()`, `disable()`.
 *
 *       --------------------------------------------------------------------------
 *       Wire format
 *       --------------------------------------------------------------------------
 *       { type: 'rb-bridge',
 *         version: 1,
 *         role: 'parent' | 'agent',
 *         kind: 'ready' | 'select' | 'hover' | 'deselect' | 'text-changed' | 'request-rect',
 *         id?:  string,                       // optional correlation id for replies
 *         payload: object }                   // kind-specific
 *
 *       `type` MUST be 'rb-bridge' so the listener can discard unrelated
 *       postMessage traffic on the window. `version` lets us evolve the
 *       protocol; mismatched versions are dropped with a console warning.
 *
 *       --------------------------------------------------------------------------
 *       Cross-origin behavior
 *       --------------------------------------------------------------------------
 *       When the iframe's document is same-origin as the parent (e.g. loaded
 *       via srcdoc, a local file, or the same dev server), this module
 *       works end-to-end. The agent script can be injected by the parent
 *       (write a <script> tag into the iframe's contentDocument) before
 *       creating the bridge.
 *
 *       When the iframe is loaded from a foreign origin (e.g. https://example.com),
 *       the parent cannot reach into its contentDocument — the agent script
 *       must be loaded into the iframe by some other means (the page author
 *       inlines it, an extension injects it, etc.). The bridge here will
 *       STILL work for messaging as long as:
 *
 *         - the foreign page opts in by including & running the agent,
 *         - both sides set `expectedOrigin` to the exact origin of the
 *           other side (NEVER '*' in production for cross-origin traffic),
 *
 *       and the parent must pass `expectedOrigin` matching the iframe's
 *       origin to validate inbound messages. Outbound messages from the
 *       parent target the iframe's contentWindow with the iframe's origin.
 *
 *       Limits: this module does NOT implement message encryption, replay
 *       protection, or large payload chunking. For binary or >1MB payloads
 *       the caller should encode them separately (e.g. via transferables).
 *
 * @example parent side
 *   const bridge = createBridge(iframe, {
 *     expectedOrigin: window.location.origin,         // or '*' in dev
 *     onSelect:  ({ path, rect, tagName }) => { ... },
 *     onHover:   ({ path, rect }) => { ... },
 *     onDeselect: () => { ... },
 *     onTextChange: ({ path, prevText, text }) => { ... },
 *     onReady:  ({ capabilities }) => { ... },
 *   });
 *   bridge.post('request-rect', { path: 'body > p' });
 *
 * @example agent side
 *   const agent = createAgent(window);
 *   agent.onParentRequest = (kind, payload) => { ... };   // optional
 *   // Then the agent's own code emits via:
 *   agent.emit('select', { path, rect, tagName });
 *
 * @typedef {Object} IframeRect
 * @property {number} x       left in the iframe's document
 * @property {number} y       top in the iframe's document
 * @property {number} width   width in CSS px
 * @property {number} height  height in CSS px
 *
 * @typedef {'parent'|'agent'} BridgeRole
 * @typedef {'ready'|'select'|'hover'|'deselect'|'text-changed'|'request-rect'} BridgeKind
 */

export const BRIDGE_VERSION = 1;
export const MESSAGE_TYPE = 'rb-bridge';

/** Default target origin for outbound messages. '*' is unsafe in production. */
const DEFAULT_TARGET_ORIGIN = '*';

/** Default accept list for inbound messages. '*' means accept any origin. */
const DEFAULT_EXPECTED_ORIGIN = '*';

// ---------------------------------------------------------------------------
// Pure helpers (no DOM) — fully testable in Node.
// ---------------------------------------------------------------------------

/**
 * Serialize an outgoing message. Returns a frozen plain object suitable
 * for `postMessage(...)`. Throws on missing required fields.
 *
 * @param {Object} msg
 * @param {BridgeRole} msg.role     — who is sending
 * @param {BridgeKind}  msg.kind    — what they are saying
 * @param {Object}      [msg.payload] — kind-specific payload (must be JSON-safe)
 * @param {string}      [msg.id]    — optional correlation id
 * @returns {{type: string, version: number, role: BridgeRole, kind: BridgeKind, payload: object, id?: string}}
 */
export function serializeMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    throw new Error('serializeMessage: msg must be an object');
  }
  const { role, kind, payload, id } = msg;
  if (role !== 'parent' && role !== 'agent') {
    throw new Error(`serializeMessage: invalid role ${JSON.stringify(role)}`);
  }
  if (typeof kind !== 'string' || !kind) {
    throw new Error('serializeMessage: kind required');
  }
  const out = {
    type: MESSAGE_TYPE,
    version: BRIDGE_VERSION,
    role,
    kind,
    payload: payload == null ? {} : payload,
  };
  if (typeof id === 'string' && id) out.id = id;
  return Object.freeze(out);
}

/**
 * Validate an inbound message envelope. Returns the parsed message
 * object (with cloned payload) if valid, or null if the message is
 * not for us / not valid.
 *
 * The `source` argument is the window the message is expected to
 * come from (iframe.contentWindow on the parent side; window.parent
 * on the agent side). It is checked against `event.source` when
 * supplied. `expectedOrigin === '*'` skips the origin check.
 *
 * @param {*} raw                    — the postMessage payload
 * @param {Object}  [opts]
 * @param {string}  [opts.expectedOrigin='*']
 * @param {*}       [opts.source]    — expected event.source
 * @param {string}  [opts.expectedRole]  — if set, only this role is accepted
 * @returns {Object|null}            — { role, kind, payload, id } or null
 */
export function deserializeMessage(raw, opts) {
  const { expectedOrigin, source, expectedRole } = opts || {};
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type !== MESSAGE_TYPE) return null;
  if (raw.version !== BRIDGE_VERSION) return null;
  if (raw.role !== 'parent' && raw.role !== 'agent') return null;
  if (typeof raw.kind !== 'string' || !raw.kind) return null;
  if (expectedRole && raw.role !== expectedRole) return null;
  // Origin / source checks are performed by guardIncomingEvent below; here we
  // just return the parsed envelope. The caller decides what to do with it.
  return {
    role: raw.role,
    kind: raw.kind,
    payload: raw.payload == null ? {} : raw.payload,
    id: typeof raw.id === 'string' ? raw.id : undefined,
    _origin: expectedOrigin,
    _source: source,
  };
}

/**
 * Origin guard. '*' matches any origin (dev-only).
 * @param {string} eventOrigin
 * @param {string} expectedOrigin
 * @returns {boolean}
 */
export function isValidOrigin(eventOrigin, expectedOrigin) {
  if (!expectedOrigin || expectedOrigin === '*') return true;
  if (typeof eventOrigin !== 'string') return false;
  return eventOrigin === expectedOrigin;
}

/**
 * Decide whether to accept an inbound MessageEvent. Returns
 * `{ accept: true, msg }` or `{ accept: false, reason }`.
 *
 * @param {MessageEvent} event
 * @param {Object} opts
 * @param {string} [opts.expectedOrigin='*']
 * @param {*}      [opts.expectedSource]   — e.g. iframe.contentWindow or window.parent
 * @param {string} [opts.expectedRole]
 * @returns {{accept: boolean, msg?: Object, reason?: string}}
 */
export function guardIncomingEvent(event, opts) {
  const o = opts || {};
  const expectedOrigin = o.expectedOrigin || DEFAULT_EXPECTED_ORIGIN;
  if (!isValidOrigin(event.origin, expectedOrigin)) {
    return { accept: false, reason: `origin mismatch: ${event.origin} !== ${expectedOrigin}` };
  }
  if (o.expectedSource && event.source !== o.expectedSource) {
    return { accept: false, reason: 'source mismatch' };
  }
  const msg = deserializeMessage(event.data, {
    expectedOrigin,
    source: o.expectedSource,
    expectedRole: o.expectedRole,
  });
  if (!msg) {
    return { accept: false, reason: 'envelope invalid (type/version/role/kind)' };
  }
  return { accept: true, msg };
}

// ---------------------------------------------------------------------------
// Parent side
// ---------------------------------------------------------------------------

/**
 * Create the parent-side bridge.
 *
 * @param {HTMLIFrameElement} iframe
 * @param {Object} [callbacks]
 * @param {(m: {path: string, rect: IframeRect, tagName: string, textPreview?: string}) => void} [callbacks.onSelect]
 * @param {(m: {path: string, rect: IframeRect}) => void} [callbacks.onHover]
 * @param {(m: {path: string, prevText: string, text: string}) => void} [callbacks.onTextChange]
 * @param {() => void} [callbacks.onDeselect]
 * @param {(m: {capabilities: string[]}) => void} [callbacks.onReady]
 * @param {string} [callbacks.expectedOrigin='*']   — origin of incoming messages from the iframe
 * @param {string} [callbacks.targetOrigin='*']      — origin used on outgoing postMessage
 * @returns {{
 *   post: (kind: BridgeKind, payload?: object) => boolean,
 *   destroy: () => void,
 *   onMessage: (event: MessageEvent) => boolean,
 * }}
 */
export function createBridge(iframe, callbacks) {
  const cb = callbacks || {};
  const expectedOrigin = cb.expectedOrigin || DEFAULT_EXPECTED_ORIGIN;
  const targetOrigin = cb.targetOrigin || DEFAULT_TARGET_ORIGIN;

  if (!iframe || typeof iframe.contentWindow !== 'object') {
    throw new Error('createBridge: iframe.contentWindow required');
  }

  const target = iframe.contentWindow;
  const source = target;

  /** Dispatch a single accepted message to the matching callback. */
  function dispatch(msg) {
    switch (msg.kind) {
      case 'select':       if (cb.onSelect)     cb.onSelect(msg.payload); return;
      case 'hover':        if (cb.onHover)      cb.onHover(msg.payload); return;
      case 'deselect':     if (cb.onDeselect)   cb.onDeselect(); return;
      case 'text-changed': if (cb.onTextChange) cb.onTextChange(msg.payload); return;
      case 'ready':        if (cb.onReady)      cb.onReady(msg.payload); return;
      case 'request-rect': return; // parent → agent; ignore inbound
      default: return;
    }
  }

  /**
   * Handle one inbound MessageEvent. Returns true if accepted.
   * Exposed so tests can drive the bridge without a real MessageEvent listener.
   * @param {MessageEvent} event
   */
  function onMessage(event) {
    const verdict = guardIncomingEvent(event, {
      expectedOrigin,
      expectedSource: source,
      expectedRole: 'agent',
    });
    if (!verdict.accept) return false;
    dispatch(verdict.msg);
    return true;
  }

  const listener = (event) => { onMessage(event); };

  if (typeof window !== 'undefined') {
    window.addEventListener('message', listener);
  }

  /**
   * Send a message to the agent.
   * @param {BridgeKind} kind
   * @param {Object} [payload]
   * @returns {boolean} true if posted
   */
  function post(kind, payload) {
    try {
      const msg = serializeMessage({ role: 'parent', kind, payload: payload || {} });
      target.postMessage(msg, targetOrigin);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', listener);
    }
  }

  return { post, destroy, onMessage };
}

// ---------------------------------------------------------------------------
// Agent side (iframe)
// ---------------------------------------------------------------------------

/**
 * Create the iframe-side agent.
 *
 * @param {Window} windowObj         — the iframe's window (usually `window`)
 * @param {Object} [opts]
 * @param {string} [opts.expectedParentOrigin='*']  — origin of incoming parent messages
 * @param {string} [opts.targetOrigin='*']          — origin used on outgoing postMessage to parent
 * @param {boolean} [opts.autoStart=true]           — bind listeners immediately
 * @returns {{
 *   emit: (kind: BridgeKind, payload?: object, id?: string) => boolean,
 *   onParentMessage: (event: MessageEvent) => boolean,
 *   enable: () => void,
 *   disable: () => void,
 *   destroy: () => void,
 * }}
 */
export function createAgent(windowObj, opts) {
  const o = opts || {};
  const expectedParentOrigin = o.expectedParentOrigin || DEFAULT_EXPECTED_ORIGIN;
  const targetOrigin = o.targetOrigin || DEFAULT_TARGET_ORIGIN;
  const autoStart = o.autoStart !== false;

  if (!windowObj || typeof windowObj.postMessage !== 'function') {
    throw new Error('createAgent: windowObj must be a Window');
  }

  const parentSource = windowObj.parent;
  let enabled = false;

  /**
   * Outbound send.
   * @param {BridgeKind} kind
   * @param {Object} [payload]
   * @param {string} [id]
   * @returns {boolean}
   */
  function emit(kind, payload, id) {
    try {
      const msg = serializeMessage({ role: 'agent', kind, payload: payload || {}, id });
      windowObj.parent.postMessage(msg, targetOrigin);
      return true;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Inbound handler. Public so tests can drive it without an event listener.
   * @param {MessageEvent} event
   * @returns {boolean}
   */
  function onParentMessage(event) {
    const verdict = guardIncomingEvent(event, {
      expectedOrigin: expectedParentOrigin,
      expectedSource: parentSource,
      expectedRole: 'parent',
    });
    if (!verdict.accept) return false;
    // For now the parent only sends 'request-rect'. The agent's higher-level
    // listeners (added by the consumer of createAgent) can subscribe via
    // attachRequestHandler. We keep this hook minimal so the module stays
    // small and testable.
    if (verdict.msg.kind === 'request-rect' && typeof _onRequestRect === 'function') {
      _onRequestRect(verdict.msg.payload, verdict.msg.id);
      return true;
    }
    return true;
  }

  let _onRequestRect = null;

  const listener = (event) => { onParentMessage(event); };

  function enable() {
    if (enabled) return;
    windowObj.addEventListener('message', listener);
    enabled = true;
    emit('ready', { capabilities: ['select', 'hover', 'deselect', 'text-changed', 'request-rect'] });
  }

  function disable() {
    if (!enabled) return;
    windowObj.removeEventListener('message', listener);
    enabled = false;
  }

  function destroy() {
    disable();
  }

  /**
   * Subscribe to parent-side request-rect events. Optional.
   * @param {(payload: {path: string}, id?: string) => void} fn
   */
  function onParentRequest(fn) { _onRequestRect = fn; }

  if (autoStart) enable();

  return { emit, onParentMessage, enable, disable, destroy, onParentRequest };
}
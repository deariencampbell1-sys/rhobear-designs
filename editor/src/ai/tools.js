/**
 * Editor tools for a paired LLM — the "MCP tools" surface.
 *
 * RHOBEAR Designs is BYO-LLM: you point it at your own model (a local/self-hosted
 * one via the OpenAI-compatible endpoint, or a hosted provider). A bare chat model
 * can only hand back one HTML blob. These tools give the model real, named actions
 * it can CALL to inspect and change the page — the same primitives the editor uses
 * itself — so a local model can actually drive the editor instead of guessing.
 *
 * The specs are emitted in OpenAI/JSON-Schema function-calling shape (what local +
 * MiniMax-style endpoints accept). `runTool` is pure and adapter-driven: it validates
 * the call and dispatches to an injected `adapter` whose methods are bound to the live
 * editor in shell.js. That split keeps this module unit-testable in plain Node with a
 * fake adapter — every tool's contract is exercised without a browser or a real model.
 *
 * MIT — RHOBEAR Designs (original)
 *
 * Run with: `node --test src/ai/`
 */

/**
 * @typedef {Object} ToolSpec
 * @property {string} name
 * @property {string} description
 * @property {{ type:'object', properties:Object, required:string[] }} parameters
 */

/** The tools a paired model may call. Each maps 1:1 to an adapter method of the
 *  same name. Keep these backed by primitives the editor genuinely exposes — a tool
 *  the editor can't honor is worse than no tool. */
export const EDITOR_TOOLS = Object.freeze([
  {
    name: 'get_page_outline',
    description:
      'List the page\'s elements as a flat outline (index, nesting depth, tag/class label, ' +
      'and a short text snippet). Call this FIRST to see what is on the page before changing anything.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_selection_html',
    description:
      'Return the complete HTML of the currently selected element (or the page body if nothing ' +
      'is selected). Use it to read the exact markup before you replace it.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'select_element',
    description:
      'Select an element by its `index` from get_page_outline so the next replace_selection ' +
      'targets it. Returns a short confirmation label.',
    parameters: {
      type: 'object',
      properties: { index: { type: 'integer', description: 'Index from get_page_outline (0-based).' } },
      required: ['index'],
    },
  },
  {
    name: 'replace_selection',
    description:
      'Replace the currently selected element with new, COMPLETE, self-contained HTML ' +
      '(inline styles only). Preserve the element\'s intent; make it tasteful.',
    parameters: {
      type: 'object',
      properties: { html: { type: 'string', description: 'The full replacement HTML for the selected element.' } },
      required: ['html'],
    },
  },
  {
    name: 'insert_html',
    description:
      'Insert a NEW element into the page near the current selection. Provide complete, ' +
      'self-contained HTML with inline styles.',
    parameters: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'The full HTML of the element to insert.' },
        name: { type: 'string', description: 'Short human label for the element (optional).' },
      },
      required: ['html'],
    },
  },
]);

const TOOL_BY_NAME = new Map(EDITOR_TOOLS.map((t) => [t.name, t]));

/** System prompt for tool mode — tells the model the loop exists and to use it. */
export const TOOLS_SYSTEM_PROMPT =
  'You are a web-design assistant wired DIRECTLY into a live visual website editor through a set of ' +
  'tools. The user is editing a real web page. Prefer ACTING over describing: call get_page_outline to ' +
  'see the page, get_selection_html to read the target, select_element to choose what to change, then ' +
  'replace_selection or insert_html to make the change. Replacement/inserted HTML must be complete and ' +
  'self-contained with inline styles. When the work is done, reply with one short sentence describing ' +
  'what you changed. If the user only asks a question, just answer — no tool calls.';

/**
 * Emit the tools in OpenAI/MiniMax function-calling shape:
 *   [{ type:'function', function:{ name, description, parameters } }, ...]
 * @returns {Array<object>}
 */
export function openAiToolsParam() {
  return EDITOR_TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/**
 * Validate + dispatch one tool call against an editor adapter. Pure w.r.t. this
 * module — all side effects live in `adapter`. Never throws; always returns a
 * structured result the caller can feed straight back to the model as a tool message.
 *
 * @param {string} name
 * @param {object} args
 * @param {Record<string, (args:object)=>any>} adapter
 * @returns {{ ok:true, result:any } | { ok:false, error:string }}
 */
export function runTool(name, args, adapter) {
  const spec = TOOL_BY_NAME.get(name);
  if (!spec) return { ok: false, error: `Unknown tool: ${name}` };

  const a = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  for (const req of spec.parameters.required) {
    const v = a[req];
    if (v == null || (typeof v === 'string' && v.trim() === '')) {
      return { ok: false, error: `Tool "${name}": missing required argument "${req}".` };
    }
  }
  // Light type coercion/validation for declared properties.
  for (const [key, schema] of Object.entries(spec.parameters.properties)) {
    if (a[key] == null) continue;
    if (schema.type === 'integer' || schema.type === 'number') {
      const n = Number(a[key]);
      if (!Number.isFinite(n)) return { ok: false, error: `Tool "${name}": "${key}" must be a number.` };
      a[key] = schema.type === 'integer' ? Math.trunc(n) : n;
    } else if (schema.type === 'string' && typeof a[key] !== 'string') {
      a[key] = String(a[key]);
    }
  }

  const fn = adapter && adapter[name];
  if (typeof fn !== 'function') {
    return { ok: false, error: `Tool "${name}" is not available in the current mode (open "Edit Live Site").` };
  }
  try {
    const result = fn(a);
    return { ok: true, result: result == null ? 'done' : result };
  } catch (e) {
    return { ok: false, error: `Tool "${name}" failed: ${(e && e.message) || e}` };
  }
}

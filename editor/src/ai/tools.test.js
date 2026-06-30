/**
 * Tests for the editor tool surface (the "MCP tools" a paired LLM calls).
 * Pure — a fake adapter stands in for the live editor, so every tool's contract
 * (schema shape, validation, dispatch, error handling) is exercised in plain Node.
 *
 * Run with: `node --test src/ai/`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDITOR_TOOLS, openAiToolsParam, runTool, TOOLS_SYSTEM_PROMPT } from './tools.js';

function fakeAdapter() {
  const log = [];
  return {
    log,
    get_page_outline() { log.push(['outline']); return [{ index: 0, depth: 0, label: 'div', text: 'hi' }]; },
    get_selection_html() { log.push(['sel']); return '<div>hi</div>'; },
    select_element(a) { log.push(['select', a.index]); return `selected ${a.index}`; },
    replace_selection(a) { log.push(['replace', a.html]); return 'replaced'; },
    insert_html(a) { log.push(['insert', a.html, a.name]); return 'inserted'; },
  };
}

test('every tool spec is well-formed JSON-Schema function shape', () => {
  for (const t of EDITOR_TOOLS) {
    assert.equal(typeof t.name, 'string');
    assert.ok(t.name.length, `tool has a name`);
    assert.ok(t.description.length > 10, `${t.name} has a real description`);
    assert.equal(t.parameters.type, 'object');
    assert.ok(Array.isArray(t.parameters.required), `${t.name}.required is an array`);
    for (const req of t.parameters.required) {
      assert.ok(req in t.parameters.properties, `${t.name}: required "${req}" is declared in properties`);
    }
  }
});

test('openAiToolsParam wraps every tool in {type:function}', () => {
  const params = openAiToolsParam();
  assert.equal(params.length, EDITOR_TOOLS.length);
  for (const p of params) {
    assert.equal(p.type, 'function');
    assert.equal(typeof p.function.name, 'string');
    assert.ok(p.function.parameters);
  }
});

test('every advertised tool has a matching adapter method (no dead tools)', () => {
  const a = fakeAdapter();
  for (const t of EDITOR_TOOLS) {
    assert.equal(typeof a[t.name], 'function', `adapter implements ${t.name}`);
  }
});

test('runTool dispatches and returns ok+result', () => {
  const a = fakeAdapter();
  assert.deepEqual(runTool('get_page_outline', {}, a), { ok: true, result: [{ index: 0, depth: 0, label: 'div', text: 'hi' }] });
  assert.deepEqual(runTool('replace_selection', { html: '<p>x</p>' }, a), { ok: true, result: 'replaced' });
  assert.deepEqual(a.log, [['outline'], ['replace', '<p>x</p>']]);
});

test('runTool rejects unknown tools', () => {
  const r = runTool('drop_database', {}, fakeAdapter());
  assert.equal(r.ok, false);
  assert.match(r.error, /Unknown tool/);
});

test('runTool enforces required args', () => {
  const r = runTool('replace_selection', {}, fakeAdapter());
  assert.equal(r.ok, false);
  assert.match(r.error, /missing required argument "html"/);
});

test('runTool treats empty/whitespace string args as missing', () => {
  const r = runTool('replace_selection', { html: '   ' }, fakeAdapter());
  assert.equal(r.ok, false);
});

test('runTool coerces integer args (string index -> number)', () => {
  const a = fakeAdapter();
  const r = runTool('select_element', { index: '2' }, a);
  assert.deepEqual(r, { ok: true, result: 'selected 2' });
  assert.deepEqual(a.log, [['select', 2]]);
});

test('runTool flags non-numeric integer args', () => {
  const r = runTool('select_element', { index: 'abc' }, fakeAdapter());
  assert.equal(r.ok, false);
  assert.match(r.error, /must be a number/);
});

test('runTool reports tools unavailable in the current mode', () => {
  const r = runTool('insert_html', { html: '<b>x</b>' }, {});
  assert.equal(r.ok, false);
  assert.match(r.error, /not available/);
});

test('runTool catches adapter throws and returns a clean error', () => {
  const a = fakeAdapter();
  a.select_element = () => { throw new Error('no element at index 9'); };
  const r = runTool('select_element', { index: 9 }, a);
  assert.equal(r.ok, false);
  assert.match(r.error, /no element at index 9/);
});

test('TOOLS_SYSTEM_PROMPT steers the model toward acting', () => {
  assert.match(TOOLS_SYSTEM_PROMPT, /tool/i);
  assert.match(TOOLS_SYSTEM_PROMPT, /get_page_outline/);
});

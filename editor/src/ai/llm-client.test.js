/**
 * Tests for chatWithTools — the OpenAI-compatible tool-calling loop that lets a
 * paired local model drive the editor. A stubbed global.fetch simulates a model
 * that first calls a tool, then (given the result) returns a final answer.
 *
 * Run with: `node --test src/ai/`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatWithTools } from './llm-client.js';

function mockFetch(responses) {
  let i = 0;
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    seen.push({ url, body: JSON.parse(opts.body) });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return { ok: true, status: 200, json: async () => r };
  };
  return seen;
}

function assistantToolCall(name, args) {
  return { choices: [{ message: { role: 'assistant', content: null,
    tool_calls: [{ id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] };
}
function assistantText(text) {
  return { choices: [{ message: { role: 'assistant', content: text } }] };
}

test('runs a tool, feeds the result back, then returns the final text', async () => {
  const seen = mockFetch([
    assistantToolCall('get_page_outline', {}),
    assistantText('Made the heading bigger.'),
  ]);
  const dispatched = [];
  const { text, calls } = await chatWithTools({
    apiKey: 'k', baseUrl: 'http://local/v1', system: 's', user: 'u',
    tools: [{ type: 'function', function: { name: 'get_page_outline' } }],
    dispatch: (name, args) => { dispatched.push([name, args]); return { ok: true, result: ['h1'] }; },
  });
  assert.equal(text, 'Made the heading bigger.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'get_page_outline');
  assert.deepEqual(dispatched, [['get_page_outline', {}]]);
  // Second request must carry the tool result message back to the model.
  const toolMsg = seen[1].body.messages.find((m) => m.role === 'tool');
  assert.ok(toolMsg, 'tool result is sent back');
  assert.match(toolMsg.content, /h1/);
});

test('returns immediately when the model answers without tools', async () => {
  mockFetch([assistantText('Hello, nothing to change.')]);
  const { text, calls } = await chatWithTools({
    apiKey: 'k', baseUrl: 'http://local/v1', system: 's', user: 'u', tools: [], dispatch: () => ({}),
  });
  assert.equal(text, 'Hello, nothing to change.');
  assert.equal(calls.length, 0);
});

test('stops at the round cap and summarizes successful calls', async () => {
  mockFetch([assistantToolCall('insert_html', { html: '<b>x</b>' })]); // always asks for a tool
  const { text, calls } = await chatWithTools({
    apiKey: 'k', baseUrl: 'http://local/v1', system: 's', user: 'u',
    tools: [], maxRounds: 3, dispatch: () => ({ ok: true, result: 'inserted' }),
  });
  assert.equal(calls.length, 3);
  assert.match(text, /insert_html/);
});

test('throws an actionable error on provider HTTP failure', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'bad key' } }) });
  await assert.rejects(
    () => chatWithTools({ apiKey: 'k', baseUrl: 'http://local/v1', system: 's', user: 'u', tools: [], dispatch: () => ({}) }),
    /bad key.*check your API key/s,
  );
});

test('requires an API key', async () => {
  await assert.rejects(
    () => chatWithTools({ apiKey: '', system: 's', user: 'u', tools: [], dispatch: () => ({}) }),
    /No API key/,
  );
});

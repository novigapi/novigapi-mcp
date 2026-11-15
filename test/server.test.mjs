// Run: node --test test/   (no network: a local HTTP server stands in for novigapi.com)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { forward, parseBody } from "../bin/novigapi-mcp.mjs";

const BIN = fileURLToPath(new URL("../bin/novigapi-mcp.mjs", import.meta.url));

test("parses plain JSON and server-sent events", () => {
  assert.deepEqual(parseBody('{"jsonrpc":"2.0","id":1,"result":{}}', "application/json"), [{ jsonrpc: "2.0", id: 1, result: {} }]);
  assert.deepEqual(parseBody('event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n', "text/event-stream"), [{ jsonrpc: "2.0", id: 2, result: { ok: true } }]);
  assert.deepEqual(parseBody("", "application/json"), []);
});

test("forwards with the key, drops notification replies, turns failures into JSON-RPC errors", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push(init.headers); return new Response('{"jsonrpc":"2.0","id":7,"result":{"tools":[]}}', { headers: { "content-type": "application/json" } }); };
  assert.deepEqual(await forward({ jsonrpc: "2.0", id: 7, method: "tools/list" }, { url: "http://x", key: "nv_k", fetchImpl }), [{ jsonrpc: "2.0", id: 7, result: { tools: [] } }]);
  assert.equal(seen[0].Authorization, "Bearer nv_k");
  assert.deepEqual(await forward({ jsonrpc: "2.0", method: "notifications/initialized" }, { url: "http://x", key: "", fetchImpl }), []);
  assert.equal(seen[1].Authorization, undefined);
  const down = async () => { throw new Error("ECONNREFUSED"); };
  const [err] = await forward({ jsonrpc: "2.0", id: 9, method: "ping" }, { url: "http://x", fetchImpl: down });
  assert.equal(err.id, 9);
  assert.equal(err.error.code, -32603);
});

test("end to end over stdio against a stand-in server", async () => {
  const bodies = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const msg = JSON.parse(raw);
      bodies.push({ msg, auth: req.headers.authorization });
      if (msg.id === undefined) { res.writeHead(202); res.end(); return; }
      const result = msg.method === "initialize" ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "novigapi", version: "1.0.0" } } : { content: [{ type: "text", text: "ok" }] };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/api/mcp`;
  const child = spawn(process.execPath, [BIN], { env: { ...process.env, NOVIGAPI_MCP_URL: url, NOVIGAPI_KEY: "nv_test" } });
  let out = "";
  child.stdout.on("data", (c) => (out += c));
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { query: "mahomes" } } }) + "\n");
  child.stdin.end();
  await new Promise((r) => child.on("close", r));
  server.close();
  const lines = out.trim().split("\n").map((l) => JSON.parse(l)).sort((a, b) => a.id - b.id);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].result.serverInfo.name, "novigapi");
  assert.equal(lines[1].result.content[0].text, "ok");
  assert.equal(bodies.length, 3);
  assert.ok(bodies.every((b) => b.auth === "Bearer nv_test"));
});

#!/usr/bin/env node
// novigapi-mcp: a stdio MCP server for novigapi.com, a read-only Novig market data API.
// It forwards each JSON-RPC message from stdin to the public MCP endpoint (https://novigapi.com/api/mcp)
// and writes each reply to stdout, one JSON object per line. No dependencies; Node 18 or newer.
//
// Environment:
//   NOVIGAPI_KEY      optional nv_... key. Without it the search, fetch and devig tools still work (no credits).
//   NOVIGAPI_MCP_URL  optional override of the endpoint (tests, staging).
//
// Independent. Not affiliated with, endorsed by or sponsored by Novig.
import { createInterface } from "node:readline";

export const VERSION = "0.1.0";
const URL_ = process.env.NOVIGAPI_MCP_URL || "https://novigapi.com/api/mcp";
const KEY = process.env.NOVIGAPI_KEY || "";
const TIMEOUT_MS = Number(process.env.NOVIGAPI_TIMEOUT_MS || 30000);

if (KEY && !KEY.startsWith("nv_")) {
  process.stderr.write("novigapi-mcp: NOVIGAPI_KEY should start with nv_ (free keys: https://novigapi.com/sign-up)\n");
}

const write = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** The JSON-RPC objects in a response body: plain JSON, or server-sent events with data: lines. */
export function parseBody(text, contentType = "") {
  if (!text.trim()) return [];
  if (contentType.includes("text/event-stream")) {
    return text.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean).map((l) => JSON.parse(l));
  }
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function forward(message, { url = URL_, key = KEY, fetchImpl = fetch } = {}) {
  const isRequest = message && message.id !== undefined && message.id !== null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "User-Agent": `novigapi-mcp/${VERSION}` };
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(message), signal: controller.signal });
    const text = await res.text();
    if (res.status === 202 || !isRequest) return [];
    let out;
    try { out = parseBody(text, res.headers.get("content-type") || ""); } catch { out = []; }
    if (!out.length) return [rpcError(message.id, -32603, `novigapi.com answered HTTP ${res.status} with no JSON-RPC body`)];
    return out;
  } catch (e) {
    return isRequest ? [rpcError(message.id, -32603, `novigapi.com unreachable: ${e && e.name === "AbortError" ? "timed out" : (e && e.message) || e}`)] : [];
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const pending = new Set();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { write(rpcError(null, -32700, "Parse error")); return; }
    const msgs = Array.isArray(msg) ? msg : [msg];
    for (const m of msgs) {
      const p = forward(m).then((replies) => replies.forEach(write));
      pending.add(p);
      p.finally(() => pending.delete(p));
    }
  });
  rl.on("close", async () => { await Promise.allSettled([...pending]); process.exit(0); });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("novigapi-mcp") || process.argv[1]?.endsWith("novigapi-mcp.mjs")) main();

# novigapi-mcp

[![npm](https://img.shields.io/npm/v/novigapi-mcp.svg)](https://www.npmjs.com/package/novigapi-mcp)

A stdio MCP server for [novigapi.com](https://novigapi.com), a read-only Novig market data API. It gives Claude Desktop, Claude Code, Cursor, Windsurf and any other MCP client live Novig data: open markets with both sides of the book, player props, intraday line history, fair (no-vig) prices, closing-line value, line moves, +EV and arbitrage against FanDuel and DraftKings, and a devig tool.

It is a thin bridge: each JSON-RPC message from your client goes to the public endpoint `https://novigapi.com/api/mcp` and the reply comes back unchanged. No dependencies, Node 18 or newer. If your client supports remote servers, you can also point it straight at that URL.

Novig has an official trading API and free daily CSVs. novigapi.com is the read-only data layer on top: no Novig account, names resolved, intraday line history, fair prices and alerts. To place orders, use Novig's official API at [docs.novig.com](https://docs.novig.com).

Independent. Not affiliated with, endorsed by or sponsored by Novig.

## Install

Nothing to install ahead of time: MCP clients start it with npx, which fetches the package from [npm](https://www.npmjs.com/package/novigapi-mcp).

```bash
npx -y novigapi-mcp
```

Put your key in `NOVIGAPI_KEY` (optional for the free tools below). For a TypeScript client instead of MCP, `npm install novigapi`.

## No key needed to start

`search`, `fetch` and `devig` work without a key and cost no credits. For markets, props, line history, fair prices and the rest, add a free key from [novigapi.com/sign-up](https://novigapi.com/sign-up) (100 credits a month, no card), or let your agent call `start_signup` and approve the code it shows you.

## Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "novig": {
      "command": "npx",
      "args": ["-y", "novigapi-mcp"],
      "env": { "NOVIGAPI_KEY": "nv_..." }
    }
  }
}
```

## Claude Code

```bash
claude mcp add novig --env NOVIGAPI_KEY=nv_... -- npx -y novigapi-mcp
```

## Cursor

`.cursor/mcp.json`: the same block as Claude Desktop.

## Try it from a shell

This is a real exchange with the live server, no key, run on 15 Nov 2026:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"shell","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"query":"jalen hurts"}}}' \
  | npx -y novigapi-mcp
```

```text
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"novigapi","version":"1.0.0"},...}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\"results\":[{\"id\":\"player:NFL:jalen-hurts\",\"title\":\"Jalen Hurts (NFL) Novig props and line history\",\"url\":\"https://novigapi.com/nfl/players/jalen-hurts\"},...]}"}]}}
```

## Tools

The list comes from the server, so new tools appear without an update here. On 15 Nov 2026 they included:

| Tool | Key | What it returns |
|---|---|---|
| `search`, `fetch` | No | Players, markets, teams and pages; one result with current prices and a citation URL |
| `devig` | No | Fair probabilities from 2 to 20 prices by the multiplicative, additive, power or Shin method |
| `get_markets`, `get_market`, `get_orderbook`, `get_trades` | Yes | Markets with both sides of the book, the full resting book, fills |
| `get_player_props`, `get_players`, `get_teams`, `get_leagues`, `get_events` | Yes | Props by player, and the slugs other tools take |
| `get_line_history`, `get_line_moves`, `get_ohlc_daily`, `get_clv`, `get_results`, `get_market_summary` | Yes | History, moves and steam, daily candles, closing-line value, graded results |
| `fair_price`, `find_ev_bets`, `find_arbitrage`, `compare_market` | Yes | Fair no-vig price, +EV and arbitrage against FanDuel and DraftKings on the same line |
| `start_signup`, `finish_signup` | No | Agent signup: you approve a code, the key arrives once |

Credits per call are in each tool's description and at [novigapi.com/pricing](https://novigapi.com/pricing).

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `NOVIGAPI_KEY` | none | Your `nv_...` key. Optional for the keyless tools. |
| `NOVIGAPI_MCP_URL` | `https://novigapi.com/api/mcp` | Endpoint override, for tests. |
| `NOVIGAPI_TIMEOUT_MS` | `30000` | Per-request timeout. |

## Tests

`npm test` runs against a local stand-in server: no network, no key.

MIT licensed. Operated by Stunning Couches LLC.

## Gemini CLI

```sh
gemini extensions install https://github.com/novigapi/novigapi-mcp
```

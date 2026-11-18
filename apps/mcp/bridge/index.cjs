#!/usr/bin/env node
/**
 * Pramāṇa's bridge for Claude Desktop (and any MCP client that can only start a program): it speaks
 * MCP over stdio to the client and forwards every message to Pramāṇa's HTTP endpoint on this
 * computer, with the key. It needs nothing but Node.js, which Claude Desktop includes, so it ships
 * inside the desktop extension (/connect/extension) as server/index.js.
 *
 *   PRAMANA_MCP_URL    http://127.0.0.1:3000/api/mcp (only this computer's addresses are accepted)
 *   PRAMANA_MCP_TOKEN  the key from /connect
 *
 * When Pramāṇa restarts, its HTTP session is gone: the bridge starts a new one with the client's
 * original `initialize` and resends the message, so the client never notices.
 */
"use strict";

const LOCAL = new Set(["127.0.0.1", "localhost", "[::1]"]);
const url = process.env.PRAMANA_MCP_URL || "http://127.0.0.1:3000/api/mcp";
const token = process.env.PRAMANA_MCP_TOKEN || "";
const site = (() => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
})();

function log(...args) {
  process.stderr.write(`[pramana] ${args.join(" ")}\n`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

/** Answers a request the bridge could not forward, in words the person reading Claude's reply can act on. */
function fail(message, text) {
  if (message && message.id !== undefined && message.method) {
    send({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: text } });
  }
}

const home = site ? `${site.protocol}//${site.host}` : url;
const NOT_RUNNING = `Pramāṇa is not running at ${home}. Start it on this computer, then try again.`;
const BAD_KEY = `Pramāṇa did not accept the key. Open ${home}/connect and install the extension again.`;

let sessionId = null;
let protocolVersion = null;
/** The client's initialize request, kept to start a new session after Pramāṇa restarts. */
let initialize = null;
/** Settles once the current session is set up; other messages wait for it. */
let ready = Promise.resolve();
/** Messages being forwarded. */
const inFlight = new Set();

function headers() {
  const h = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
  };
  if (sessionId) h["Mcp-Session-Id"] = sessionId;
  if (protocolVersion) h["MCP-Protocol-Version"] = protocolVersion;
  return h;
}

/** The JSON-RPC messages of a response, as they arrive (plain JSON, or a stream of `data:` events). */
async function forward(response, onMessage) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/event-stream")) {
    const body = await response.text();
    if (!body.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`Pramāṇa answered ${response.status} with something other than MCP.`);
    }
    for (const m of Array.isArray(parsed) ? parsed : [parsed]) onMessage(m);
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let data = [];
  const flush = () => {
    if (data.length) {
      const text = data.join("\n");
      data = [];
      try {
        onMessage(JSON.parse(text));
      } catch {
        log("skipped an event that is not JSON");
      }
    }
  };
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line === "") flush();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
  }
  flush();
}

async function post(message) {
  return fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(message) });
}

/** Starts an HTTP session with the client's initialize; `answer` passes the result back to the client. */
async function startSession(answer) {
  sessionId = null;
  const response = await post(initialize);
  if (response.status === 401 || response.status === 403) throw new Error(BAD_KEY);
  if (!response.ok) throw new Error(`Pramāṇa answered ${response.status} when the AI connected.`);
  sessionId = response.headers.get("mcp-session-id");
  await forward(response, (m) => {
    if (m.id === initialize.id && m.result && m.result.protocolVersion) protocolVersion = m.result.protocolVersion;
    if (answer) send(m);
  });
}

/** A new session for a client that already initialized (after Pramāṇa restarted, or was not running yet). */
function reconnect() {
  ready = startSession(false).then(() =>
    post({ jsonrpc: "2.0", method: "notifications/initialized" }).then((r) => r.body?.cancel()),
  );
  return ready;
}

async function handle(message, retried) {
  if (message.method === "initialize") {
    initialize = message;
    ready = startSession(true);
    return ready;
  }
  await ready.catch(() => {});
  if (!sessionId && initialize) await (retried ? ready : reconnect());
  const response = await post(message);
  if (response.status === 404 && sessionId && initialize && !retried) {
    log("session ended; starting a new one");
    await response.body?.cancel();
    sessionId = null;
    await reconnect();
    return handle(message, true);
  }
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    throw new Error(BAD_KEY);
  }
  if (response.status === 202) return response.body?.cancel();
  await forward(response, send);
}

function main() {
  if (!site || !LOCAL.has(site.hostname)) {
    log(`refusing ${url}: Pramāṇa's bridge connects only to this computer`);
    process.exit(1);
  }
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        log("skipped a line that is not JSON");
        continue;
      }
      const done = handle(message).catch((error) => {
        // fetch throws a TypeError when nothing answers at the address.
        const text = error instanceof TypeError ? NOT_RUNNING : String(error && error.message ? error.message : error);
        log(text);
        fail(message, text);
      });
      inFlight.add(done);
      void done.finally(() => inFlight.delete(done));
    }
  });
  process.stdin.on("end", async () => {
    // The client closed its side: finish what it asked for, then end the session.
    while (inFlight.size) await Promise.allSettled([...inFlight]);
    if (sessionId) {
      await fetch(url, { method: "DELETE", headers: headers() }).catch(() => {});
    }
    process.exit(0);
  });
}

main();

// src/index.js  — ES-module Worker (no Durable Objects)

// ── 1. Utility: ISO-8601 timestamp in America/New_York ───────────────
function getEasternTime() {
  const now  = new Date();
  const fmt  = new Intl.DateTimeFormat('en-US', {
    timeZone : 'America/New_York',
    year     : 'numeric', month :'2-digit', day   :'2-digit',
    hour     : '2-digit', minute:'2-digit', second:'2-digit',
    hour12   : false
  });

  const parts = Object.fromEntries(fmt.formatToParts(now).map(o => [o.type, o.value]));
  const date  = `${parts.year}-${parts.month}-${parts.day}`;
  const time  = `${parts.hour}:${parts.minute}:${parts.second}`;

  const offsetMin = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
                      .getTimezoneOffset();             // minutes west of UTC
  const sign = offsetMin <= 0 ? '+' : '-';
  const abs  = Math.abs(offsetMin);
  const hh   = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm   = String(abs % 60).padStart(2, '0');

  return `${date}T${time}${sign}${hh}:${mm}`;
}

// ── 2. JSON-RPC helpers ──────────────────────────────────────────────
const ok  = (id, result)        => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const PARSE_ERR = -32700, NOT_FOUND = -32601;

// ── 3. Main request handler ──────────────────────────────────────────
async function handleRequest(request) {
  // Quick GET: /?method=get_eastern_time
  if (request.method === 'GET') {
    const m = new URL(request.url).searchParams.get('method');
    if (m) {
      const res = m === 'get_eastern_time'
        ? getEasternTime()
        : `Unknown method ${m}`;
      return json(ok('mcp-id', res));
    }
  }

  if (request.method !== 'POST')
    return new Response('Use POST with JSON-RPC 2.0', { status: 405 });

  let payload;
  try { payload = await request.json(); }
  catch { return json(err(null, PARSE_ERR, 'Parse error'), 400); }

  const id = payload.id ?? 'mcp-id';
  const { method, params } = payload;

  // ── Supported methods ────────────────────────────────────────────
  if (method === 'initialize')
    return json(ok(id, {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'eastern-time-server',
        version: '1.0.0',
        description: 'Provides Eastern Time ISO timestamps'
      },
      capabilities: {
        tools: {
          get_eastern_time: {
            description: 'Returns ISO 8601 Eastern Time string',
            inputSchema:  { type: 'object', properties: {}, additionalProperties: false },
            outputFormat: 'string'
          }
        }
      }
    }));

  if (method === 'tools/list')
    return json(ok(id, {
      tools: [{
        name: 'get_eastern_time',
        description: 'Get Eastern Time ISO string',
        inputSchema:  { type: 'object', properties: {}, additionalProperties: false },
        outputFormat: 'string'
      }]
    }));

  if (method === 'tools/call' && params?.name === 'get_eastern_time')
    return json(ok(id, getEasternTime()));

  // Anything else
  return json(err(id, NOT_FOUND, `Method not found: ${method}`));
}

// Helper to return JSON
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// ── 4. Export for Cloudflare Workers (module syntax) ─────────────────
export default { fetch: handleRequest };

// src/index.js  (module syntax)

// ── 1. utility: ISO string in America/New_York ──────────────────────
function getEasternTime () {
  const now  = new Date();
  const opts = {
    timeZone : 'America/New_York',
    year     : 'numeric', month  : '2-digit', day    : '2-digit',
    hour     : '2-digit', minute : '2-digit', second : '2-digit',
    hour12   : false
  };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', opts)
      .formatToParts(now)
      .map(({ type, value }) => [type, value])
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;

  // work out NY offset vs UTC
  const nyOffsetMin = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
                        .getTimezoneOffset();               // minutes west of UTC
  const sign        = nyOffsetMin <= 0 ? '+' : '-';
  const abs         = Math.abs(nyOffsetMin);
  const hh          = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm          = String(abs % 60).padStart(2, '0');

  return `${date}T${time}${sign}${hh}:${mm}`;
}

// ── 2. helpers for JSON-RPC 2.0 responses ───────────────────────────
const ok     = (id, result)           => ({ jsonrpc: '2.0', id, result });
const err    = (id, code, message)    => ({ jsonrpc: '2.0', id, error: { code, message } });
const PARSE  = -32700, NOT_FOUND = -32601;

// ── 3. main fetch handler ────────────────────────────────────────────
async function handleRequest (request) {
  // allow “quick GET” style: /?method=get_eastern_time
  if (request.method === 'GET') {
    const m = new URL(request.url).searchParams.get('method');
    if (m) return json(ok('mcp-id', m === 'get_eastern_time' ? getEasternTime() : `Unknown method ${m}`));
  }

  if (request.method !== 'POST')
    return new Response('Send JSON-RPC via POST', { status: 405 });

  let payload;
  try { payload = await request.json(); }
  catch { return json(err(null, PARSE, 'Parse error'), 400); }

  const id     = payload.id ?? 'mcp-id';
  const method = payload.method;

  if (method === 'initialize')
    return json(ok(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'eastern-time-server', version: '1.0.0',
                    description: 'Provides Eastern Time ISO timestamps' },
      capabilities: { tools: { get_eastern_time: {
        description: 'Returns ISO 8601 Eastern Time string',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        outputFormat: 'string' } } }
    }));

  if (method === 'tools/list')
    return json(ok(id, { tools: [{ name: 'get_eastern_time',
                                   description: 'Get Eastern Time ISO string',
                                   inputSchema: { type: 'object', properties: {}, additionalProperties: false },
                                   outputFormat: 'string' }] }));

  if (method === 'tools/call' && payload.params?.name === 'get_eastern_time')
    return json(ok(id, getEasternTime()));

  return json(err(id, NOT_FOUND, `Method not found: ${method}`));
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// ── 4. Cloudflare export (module syntax) ─────────────────────────────
export default { fetch: handleRequest };

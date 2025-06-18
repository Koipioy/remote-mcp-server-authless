// MCP JSON-RPC Worker for Eastern Time timestamps
// Supports Claude web-based MCP integration (no token auth)
// - No authentication required
// - ISO 8601 timestamp in America/New_York timezone

declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };

interface RpcPayload {
  jsonrpc?: string;
  id?: string;
  method: string;
  params?: { name?: string };
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

function getEasternTime(): string {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
  const m: Record<string, string> = {};
  for (const { type, value } of parts) m[type] = value;
  const date = `${m.year}-${m.month}-${m.day}`;
  const time = `${m.hour}:${m.minute}:${m.second}`;
  const localOffset = now.getTimezoneOffset();
  const nyOffset = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getTimezoneOffset();
  const diff = nyOffset - localOffset;
  const sign = diff <= 0 ? '+' : '-';
  const absMin = Math.abs(diff);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  return `${date}T${time}${sign}${hh}:${mm}`;
}

function createResponse(id: string | null, result: unknown, error: RpcError | null = null) {
  const resp: { jsonrpc: '2.0'; id: string | null; result?: unknown; error?: RpcError } = {
    jsonrpc: '2.0',
    id,
  };
  if (error) resp.error = error; else resp.result = result;
  return resp;
}

function createError(id: string | null, code: number, message: string, data?: unknown) {
  const err: RpcError = { code, message };
  if (data !== undefined) err.data = data;
  return createResponse(id, null, err);
}

async function handleRPC(payload: RpcPayload) {
  const id = payload.id ?? "mcp-id";
  const method = payload.method;

  switch (method) {
    case 'initialize':
      return createResponse(id, {
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
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
              outputFormat: 'string (ISO 8601 / RFC 3339, e.g. 2025-06-14T14:23:45-04:00)'
            }
          }
        }
      });

    case 'tools/list':
      return createResponse(id, {
        tools: [
          {
            name: 'get_eastern_time',
            description: 'Get Eastern Time ISO string',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            outputFormat: 'string (ISO 8601 / RFC 3339)'
          }
        ]
      });

    case 'tools/call': {
      const tool = payload.params?.name;
      if (tool !== 'get_eastern_time') {
        return createError(id, -32602, `Unknown tool: ${tool}`);
      }
      try {
        const timestamp = getEasternTime();
        await new Promise(resolve => setTimeout(resolve, 100)); // Delay before response
        return createResponse(id, timestamp);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return createError(id, -32603, 'Internal error', msg);
      }
    }

    default:
      return createError(id, -32601, `Method not found: ${method}`);
  }
}

// --- NEW NETWORK LAYER ----------------------------------------------------
Deno.serve(async req => {
  const { method, url } = req;
  const u              = new URL(url);
  const rpcMethodParam = u.searchParams.get("method"); // e.g. ?method=get_eastern_time

  /* ────────────────────────── 1. HTTP  GET  ───────────────────────── */
  if (method === "GET") {
    if (rpcMethodParam) {
      // Build a pseudo-RPC payload from the query string
      const payload: RpcPayload = { jsonrpc: "2.0", id: "mcp-id", method: rpcMethodParam };

      // In case the caller specified `name=` for tools/call
      if (payload.method === "tools/call") {
        payload.params = { name: u.searchParams.get("name") ?? undefined };
      }

      const reply = await handleRPC(payload);

      return new Response(JSON.stringify(reply), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // default GET with no method just returns current time
    return new Response(JSON.stringify({ timestamp: getEasternTime() }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  /* ────────────────────────── 3. HTTP  POST ───────────────────────── */
  if (method === "POST") {
    return (req.json() as Promise<RpcPayload>)
      .then(handleRPC)
      .then(reply => new Response(JSON.stringify(reply), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .catch(() => new Response(
        JSON.stringify(createError(null, -32700, "Parse error")),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
  }

  /* ────────────────────────── 4. Unsupported verb ─────────────────── */
  return new Response("Only GET (with ?method=…), or POST supported", { status: 405 });
});
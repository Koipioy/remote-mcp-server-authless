import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Utility to generate an ISO-8601 string in America/New_York
function getEasternTime(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;

  const offset = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");

  return `${date}T${time}${sign}${hh}:${mm}`;
}

// Durable Object implementing our MCP server
export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Eastern Time Server",
    version: "1.0.0",
  });

  async init() {
    this.server.tool(
      "get_eastern_time",
      z.object({}),
      async () => ({ content: [{ type: "text", text: getEasternTime() }] })
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return MyMCP.serve("/sse").fetch(request, env, ctx);
  },
};

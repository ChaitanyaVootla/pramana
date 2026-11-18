/** Smoke test for the MCP server: lists tools, checks the instructions, and calls overview. */
import { connectMcp } from "./lib/mcp-client";

const mcp = await connectMcp("mcp-smoke");
const tools = await mcp.client.listTools();
console.log(`${tools.tools.length} tools: ${tools.tools.map((t) => t.name).join(", ")}`);
console.log(`instructions: ${mcp.client.getInstructions()?.length ?? 0} chars`);
console.log("overview:", JSON.stringify((await mcp.call<{ stats: unknown }>("overview")).stats));
const bad = await mcp.client.callTool({
  name: "propose_changes",
  arguments: {
    title: "invalid",
    rationale: "",
    ops: [{ op: "create_claim", text: "x", kind: "nonsense" }],
  },
});
console.log("invalid input rejected:", bad.isError === true);
await mcp.close();

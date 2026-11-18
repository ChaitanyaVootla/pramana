import { desktopExtension } from "@pramana/mcp/extension";
import { checkLocalRequest, getMcpToken } from "@pramana/services";

export const dynamic = "force-dynamic";

/**
 * "Download the extension" on /connect: the desktop extension for this server, with its
 * address and key inside. Only this computer gets it (Host and Origin checks), as with /connect.
 */
export async function GET(request: Request) {
  const local = checkLocalRequest(request.headers);
  if (!local.ok) return new Response(local.reason, { status: local.status });
  // Only from this site's own page (a link elsewhere could not read it anyway, but need not start it).
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return new Response("open /connect on this computer to download the extension", { status: 403 });
  // 127.0.0.1 rather than "localhost", which Node may look up as ::1 while the server listens on IPv4.
  const port = new URL(request.url).port || "80";
  const { filename, bytes } = desktopExtension({
    url: `http://127.0.0.1:${port}/api/mcp`,
    token: getMcpToken(),
  });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

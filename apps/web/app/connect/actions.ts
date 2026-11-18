"use server";

import * as svc from "@pramana/services";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions";

/** Makes a new MCP token. Clients still using the old one are refused from now on. */
export async function rotateTokenAction(): Promise<ActionResult> {
  try {
    const local = svc.checkLocalRequest(await headers());
    if (!local.ok) return { ok: false, error: local.reason };
    await svc.rotateMcpToken(await svc.humanContext());
    revalidatePath("/connect");
    return { ok: true, message: "New key made. Set up your AI again: for Claude Desktop, download the extension and install it again." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

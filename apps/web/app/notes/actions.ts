"use server";

import { NoteStatus } from "@pramana/core";
import * as svc from "@pramana/services";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions";
import { writerContext } from "@/lib/auth";

/** Pin, archive or restore a note, as the local reader. */
export async function setNoteStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    await svc.setNoteStatus(await writerContext(), z.uuid().parse(id), NoteStatus.parse(status));
    revalidatePath("/notes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

"use server";

import {
  Appearance,
  CanvasItemContent,
  CanvasLayout,
  CanvasLinkInput,
  CanvasRelation,
  SITE_VIEW_ID,
  UserViewPatch,
  type AppearanceInput,
  type CanvasItemContentInput,
  type UserViewPatch as UserViewPatchInput,
} from "@pramana/core";
import * as svc from "@pramana/services";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Canvas and "your view" actions, run as the local human through the
 * services (validated, owner-checked, audited). Arguments are parsed at
 * runtime: server actions are reachable by POST.
 */

const Id = z.uuid();
const Title = z.string().trim().min(1).max(120);

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? z.prettifyError(error)
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, error: message };
  }
}

export interface CanvasChoice {
  id: string;
  title: string;
  itemCount: number;
  /** This canvas already holds the thing being added. */
  holds: boolean;
}

/** The learner's canvases for the "Add to canvas" picker, marking those that already hold the thing. */
export async function canvasChoicesAction(
  holding?: { kind: CanvasItemContent["kind"]; id: string; chapterId?: string } | null,
): Promise<Result<CanvasChoice[]>> {
  return attempt(async () => {
    const ctx = await svc.humanContext();
    const list = await svc.listCanvases(ctx);
    const held = holding
      ? new Set(
          await svc.canvasesHolding(ctx, {
            kind: z.enum(["claim", "entity", "chapter", "excerpt", "media", "map", "timeline", "note", "viz", "text", "section"]).parse(holding.kind),
            id: z.string().max(100).parse(holding.id),
            chapterId: holding.chapterId ? z.string().max(64).parse(holding.chapterId) : undefined,
          }),
        )
      : new Set<string>();
    return list.map((c) => ({ id: c.id, title: c.title, itemCount: c.itemCount, holds: held.has(c.id) }));
  });
}

export async function createCanvasAction(title: string, description?: string): Promise<Result<{ id: string }>> {
  return attempt(async () => {
    const c = await svc.createCanvas(await svc.humanContext(), {
      title: Title.parse(title),
      ...(description ? { description: z.string().max(2000).parse(description) } : {}),
    });
    revalidatePath("/canvas");
    return { id: c.id };
  });
}

/** "Add to canvas": onto an existing canvas, or a new one with the given title. */
export async function addToCanvasAction(
  target: { canvasId: string } | { newTitle: string },
  content: CanvasItemContentInput,
): Promise<Result<{ canvasId: string; title: string }>> {
  return attempt(async () => {
    const ctx = await svc.humanContext();
    const item = CanvasItemContent.parse(content);
    if ("newTitle" in target) {
      const c = await svc.createCanvas(ctx, { title: Title.parse(target.newTitle), items: [{ content: item }] });
      revalidatePath("/canvas");
      return { canvasId: c.id, title: c.title };
    }
    const id = Id.parse(target.canvasId);
    await svc.addCanvasItems(ctx, id, { items: [{ content: item }] });
    const c = (await svc.listCanvases(ctx)).find((x) => x.id === id);
    revalidatePath("/canvas");
    return { canvasId: id, title: c?.title ?? "your canvas" };
  });
}

export async function addItemsAction(
  canvasId: string,
  items: { content: CanvasItemContentInput; layout?: z.input<typeof CanvasLayout> }[],
): Promise<Result<{ ids: string[]; version: number }>> {
  return attempt(async () =>
    svc.addCanvasItems(await svc.humanContext(), Id.parse(canvasId), { items: items as never }),
  );
}

export async function updateItemAction(
  canvasId: string,
  itemId: string,
  patch: { content?: CanvasItemContentInput; layout?: z.input<typeof CanvasLayout> },
): Promise<Result<{ version: number }>> {
  return attempt(async () =>
    svc.updateCanvasItem(await svc.humanContext(), Id.parse(canvasId), Id.parse(itemId), patch as never),
  );
}

/** "Use the current wording": the tile stops flagging that the claim or quote changed. */
export async function refreshPlacedAction(canvasId: string, itemId: string): Promise<Result<{ version: number }>> {
  return attempt(async () =>
    svc.updateCanvasItem(await svc.humanContext(), Id.parse(canvasId), Id.parse(itemId), {}, { refreshPlaced: true }),
  );
}

/** Keep what the AI added (it becomes the learner's), or take the whole batch back. */
export async function decideBatchAction(
  canvasId: string,
  decision: { batch?: string; items?: string[]; keep: boolean },
): Promise<Result<{ items: number; links: number; version: number }>> {
  return attempt(async () =>
    svc.decideCanvasBatch(await svc.humanContext(), Id.parse(canvasId), {
      batch: decision.batch ? Id.parse(decision.batch) : undefined,
      items: decision.items ? z.array(Id).max(200).parse(decision.items) : undefined,
      keep: z.boolean().parse(decision.keep),
    }),
  );
}

export async function addLinksAction(
  canvasId: string,
  links: { from: string; to: string; relation?: string; label?: string }[],
): Promise<Result<{ ids: string[]; version: number }>> {
  return attempt(async () =>
    svc.addCanvasLinks(await svc.humanContext(), Id.parse(canvasId), links.map((l) => CanvasLinkInput.parse(l))),
  );
}

export async function updateLinkAction(
  canvasId: string,
  linkId: string,
  patch: { relation?: string; label?: string | null },
): Promise<Result<{ version: number }>> {
  return attempt(async () =>
    svc.updateCanvasLink(await svc.humanContext(), Id.parse(canvasId), Id.parse(linkId), {
      relation: patch.relation === undefined ? undefined : CanvasRelation.parse(patch.relation),
      label: patch.label === undefined ? undefined : z.string().max(80).nullable().parse(patch.label),
    }),
  );
}

export async function removeLinksAction(canvasId: string, ids: string[]): Promise<Result<{ version: number }>> {
  return attempt(async () =>
    svc.removeCanvasLinks(await svc.humanContext(), Id.parse(canvasId), z.array(Id).max(100).parse(ids)),
  );
}

export async function removeItemsAction(canvasId: string, ids: string[]): Promise<Result<{ version: number }>> {
  return attempt(async () =>
    svc.removeCanvasItems(await svc.humanContext(), Id.parse(canvasId), z.array(Id).max(200).parse(ids)),
  );
}

export async function arrangeAction(
  canvasId: string,
  input: { layouts?: { id: string; layout: z.input<typeof CanvasLayout> }[]; tidy?: boolean },
): Promise<Result<{ moved: number; version: number }>> {
  return attempt(async () =>
    svc.arrangeCanvas(await svc.humanContext(), Id.parse(canvasId), input as never),
  );
}

export async function renameCanvasAction(
  canvasId: string,
  fields: { title?: string; description?: string | null },
): Promise<Result<{ version: number }>> {
  return attempt(async () => {
    const c = await svc.updateCanvas(await svc.humanContext(), Id.parse(canvasId), {
      title: fields.title === undefined ? undefined : Title.parse(fields.title),
      description: fields.description === undefined ? undefined : z.string().max(2000).nullable().parse(fields.description),
    });
    revalidatePath("/canvas");
    return { version: c.version };
  });
}

export async function deleteCanvasAction(canvasId: string): Promise<Result> {
  return attempt(async () => {
    await svc.deleteCanvas(await svc.humanContext(), Id.parse(canvasId));
    revalidatePath("/canvas");
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Your view of a page
// ---------------------------------------------------------------------------

const Subject = z.object({ type: z.enum(["page", "entity", "site"]), id: Id });
type SubjectInput = { type: "page" | "entity" | "site"; id: string };

export async function setViewAction(
  subject: SubjectInput,
  patch: UserViewPatchInput,
): Promise<Result<svc.UserViewState>> {
  return attempt(async () => {
    const s = Subject.parse(subject);
    return svc.setUserView(await svc.humanContext(), s.type, s.id, UserViewPatch.parse(patch));
  });
}

export async function resetViewAction(subject: SubjectInput): Promise<Result<svc.UserViewState>> {
  return attempt(async () => {
    const s = Subject.parse(subject);
    return svc.resetUserView(await svc.humanContext(), s.type, s.id);
  });
}

export async function undoViewAction(subject: SubjectInput): Promise<Result<svc.UserViewState>> {
  return attempt(async () => {
    const s = Subject.parse(subject);
    return svc.undoUserView(await svc.humanContext(), s.type, s.id);
  });
}

export async function keepViewAction(subject: SubjectInput): Promise<Result<svc.UserViewState>> {
  return attempt(async () => {
    const s = Subject.parse(subject);
    return svc.keepUserViewChange(await svc.humanContext(), s.type, s.id);
  });
}

/** The appearance panel's choices (text size, line width, evidence density, theme), kept in the learner's site-wide view. */
export async function setAppearanceAction(appearance: AppearanceInput): Promise<Result<svc.UserViewState>> {
  return attempt(async () =>
    svc.setUserView(await svc.humanContext(), "site", SITE_VIEW_ID, { appearance: Appearance.parse(appearance) }),
  );
}

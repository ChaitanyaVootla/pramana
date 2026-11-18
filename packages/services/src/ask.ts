import { isUuid, type AskSubject, type NoteSubject } from "@pramana/core";
import { claims, entities, getDb, pages, sources } from "@pramana/db";
import { eq } from "drizzle-orm";
import { ownerOf, type ActorContext } from "./context";
import { canvasTitle } from "./notes";
import { NotFoundError } from "./util";

/** Looks up what "Ask your AI about this" needs to name one thing: its label and stable reference. */
export async function askSubject(
  s: Exclude<NoteSubject, { type: "general" }>,
  /** Who is asking: a canvas must be theirs. */
  viewer: ActorContext,
): Promise<AskSubject> {
  const db = getDb();
  switch (s.type) {
    case "page": {
      const page = await db.query.pages.findFirst({
        where: isUuid(s.page) ? eq(pages.id, s.page) : eq(pages.slug, s.page),
      });
      if (!page) throw new NotFoundError(`page "${s.page}" not found`);
      if (!s.chapter) return { type: "page", page: page.slug, label: page.title };
      const block = page.blocks.find((b) => b.id === s.chapter);
      if (!block) throw new NotFoundError(`page "${page.slug}" has no block "${s.chapter}"`);
      const label = "title" in block && block.title ? block.title : s.chapter;
      return { type: "chapter", page: page.slug, chapter: s.chapter, label, pageTitle: page.title };
    }
    case "entity": {
      const row = await db.query.entities.findFirst({
        where: isUuid(s.entity) ? eq(entities.id, s.entity) : eq(entities.slug, s.entity),
      });
      if (!row) throw new NotFoundError(`entity "${s.entity}" not found`);
      return { type: "entity", entity: row.slug, label: row.label };
    }
    case "claim": {
      const row = await db.query.claims.findFirst({ where: eq(claims.id, s.id) });
      if (!row) throw new NotFoundError(`claim ${s.id} not found`);
      return { type: "claim", id: row.id, label: row.text };
    }
    case "source": {
      const row = await db.query.sources.findFirst({ where: eq(sources.id, s.id) });
      if (!row) throw new NotFoundError(`source ${s.id} not found`);
      return { type: "source", id: row.id, label: row.title };
    }
    case "canvas": {
      const title = await canvasTitle(s.id, ownerOf(viewer));
      if (title === null) throw new NotFoundError(`canvas ${s.id} not found`);
      return { type: "canvas", id: s.id, label: title };
    }
  }
}

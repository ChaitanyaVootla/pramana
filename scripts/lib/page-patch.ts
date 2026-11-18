/**
 * Builds a patch_page op from a page as it is now and as a script wants it,
 * so a script that used to propose update_page with the whole block list
 * proposes only what it changes instead:
 *
 *   const op = pagePatchOp(slug, view.page.blocks, blocks);
 *   if (op) ops.push(op);
 *
 * Each removed or replaced block is guarded by a fingerprint of the block as
 * read (from get_page, json), so the proposal goes stale only if someone else
 * changes that same block before it is approved; edits of other blocks, and
 * other pending page edits, do not conflict with it.
 */
import { isEmptyPatch, pagePatchFrom, specPatchFrom, type ChangeOpInput } from "@pramana/core";

type Blockish = { id: string };

export function pagePatchOp(
  page: string,
  before: readonly Blockish[],
  after: readonly Blockish[],
  /** Spec keys to set: the spec as read (get_page's `spec`, defaults filled in), the one wanted, and the paths that may differ ("atlas", "hero.media"). */
  spec?: { before: Record<string, unknown>; after: Record<string, unknown>; paths: string[] },
): ChangeOpInput | null {
  const patch = {
    ...pagePatchFrom(before, after),
    ...(spec ? { spec: specPatchFrom(spec.before, spec.after, spec.paths) } : {}),
  };
  if (isEmptyPatch(patch)) return null;
  if (!patch.spec?.length) delete patch.spec;
  return { op: "patch_page", page, ...patch } as ChangeOpInput;
}

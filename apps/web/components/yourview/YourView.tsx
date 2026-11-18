"use client";

import {
  applyUserView,
  EMPTY_VIEW,
  patchUserView,
  type UserView,
  type UserViewPatch,
  type ViewPanel,
} from "@pramana/core";
import type { PageView, UserViewState, ViewSubjectType } from "@pramana/services";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { keepViewAction, resetViewAction, setViewAction, undoViewAction } from "@/app/canvas/actions";
import { PartnerViewChange } from "@/components/ai/partner";
import { useLiveEvents } from "@/lib/useLiveEvents";

/**
 * "Your view": the learner's own arrangement of this page, over the page as
 * published. The provider holds it, saves every change at once, and takes in
 * changes the learner's AI makes over MCP as they happen. Components read it
 * with useYourView(); outside a provider they get null and render the page
 * exactly as published.
 */

export interface YourView {
  subject: { type: ViewSubjectType; id: string };
  view: UserView;
  state: UserViewState;
  set: (patch: UserViewPatch) => void;
  reset: () => void;
  undo: () => void;
  keep: () => void;
  hides: (panel: ViewPanel) => boolean;
  highlight: (claimId: string) => "remember" | "question" | null;
  emphasised: (entityId: string, slug?: string) => boolean;
  /** Bumped when a change arrives from elsewhere (the AI), so the page can re-apply reading modes. */
  revision: number;
}

const Ctx = createContext<YourView | null>(null);

export function useYourView(): YourView | null {
  return useContext(Ctx);
}

export function YourViewProvider({
  initial,
  children,
}: {
  initial: UserViewState;
  children: React.ReactNode;
}) {
  const [state, setState] = useState(initial);
  const current = useRef(initial);
  current.current = state;
  const [revision, setRevision] = useState(0);
  const subject = initial.subject;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const busy = useRef(0);

  const commit = useCallback(
    (optimistic: UserView | null, call: () => ReturnType<typeof setViewAction>) => {
      if (optimistic) setState((s) => ({ ...s, view: optimistic }));
      busy.current += 1;
      queue.current = queue.current.then(async () => {
        const r = await call();
        busy.current -= 1;
        if (r.ok) setState(r.value);
        else toast.error(r.error);
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    await queue.current;
    if (busy.current) return;
    const res = await fetch(`/api/views?type=${subject.type}&id=${subject.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as UserViewState;
    const cur = current.current;
    if (next.version === cur.version) return;
    if (next.pendingAiChange && next.pendingAiChange.at !== cur.pendingAiChange?.at) setRevision((r) => r + 1);
    setState(next);
  }, [subject.type, subject.id]);

  useLiveEvents((e) => {
    if (e.table === "user_views" && e.id === subject.id) void refresh();
  });

  const value = useMemo<YourView>(() => {
    const view = state.view;
    const marks = new Map(view.highlights.map((h) => [h.claimId, h.tone]));
    const emph = new Set(view.emphasis);
    return {
      subject,
      view,
      state,
      revision,
      set: (patch) => commit(patchUserView(view, patch), () => setViewAction(subject, patch)),
      reset: () => commit(EMPTY_VIEW, () => resetViewAction(subject)),
      undo: () => {
        commit(null, () => undoViewAction(subject));
        setRevision((r) => r + 1);
      },
      keep: () => commit(null, () => keepViewAction(subject)),
      hides: (panel) => view.hide.includes(panel),
      highlight: (id) => marks.get(id) ?? null,
      emphasised: (id, slug) => emph.has(id) || (slug ? emph.has(slug) : false),
    };
  }, [state, subject, commit, revision]);

  return (
    <Ctx.Provider value={value}>
      {/* The AI's pending change, with Undo and Keep, is offered in the partner's popover too. */}
      <PartnerViewChange change={state.pendingAiChange} undo={value.undo} keep={value.keep} />
      {children}
    </Ctx.Provider>
  );
}

/** The page as this learner sees it: its spec with their view laid over it (the page itself is unchanged). */
export function usePageViewFor(view: PageView): PageView {
  const yv = useYourView();
  const v = yv?.view;
  return useMemo(() => {
    if (!v) return view;
    // Polities the learner emphasised are drawn strong on the atlas too.
    const polities = v.emphasis.filter((ref) => view.entities[ref]?.kind === "polity");
    const spec = applyUserView(view.page.spec, v);
    const atlas = spec.atlas && polities.length ? { ...spec.atlas, focus: [...new Set([...spec.atlas.focus, ...polities])].slice(0, 12) } : spec.atlas;
    return { ...view, page: { ...view.page, spec: { ...spec, ...(atlas ? { atlas } : {}) } } };
  }, [view, v]);
}

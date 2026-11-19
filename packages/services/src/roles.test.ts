import { describe, expect, it } from "vitest";
import { assertMayRecord } from "./audit";
import {
  GUEST_ACTOR_ID,
  PermissionError,
  SignInRequired,
  canEditContent,
  guestContext,
  requireEditor,
  requireHuman,
  type ActorContext,
} from "./context";

const human = (role?: ActorContext["role"]): ActorContext => ({
  actorId: "01900000-0000-7000-8000-000000000001",
  kind: "human",
  handle: "someone",
  onBehalfOfId: null,
  sessionId: null,
  ...(role ? { role } : {}),
});

describe("hosted roles", () => {
  it("lets a guest keep nothing, with an actor id that is never stored", () => {
    const guest = guestContext();
    expect(guest.actorId).toBe(GUEST_ACTOR_ID);
    expect(() => assertMayRecord(guest, "card.reviewed")).toThrow(SignInRequired);
    expect(() => assertMayRecord(guest, "note.posted")).toThrow(SignInRequired);
    expect(() => assertMayRecord(guest, "changeset.applied")).toThrow(SignInRequired);
    expect(() => requireHuman(guest, "keeping a canvas item")).toThrow(SignInRequired);
  });

  it("lets a signed-in learner keep their own learning but never change content", () => {
    const learner = human("learner");
    for (const action of [
      "card.reviewed",
      "cards.added",
      "guess.recorded",
      "check.answered",
      "belief.recorded",
      "chapter.read",
      "first_steps.answered",
      "note.posted",
      "canvas.created",
      "view.changed",
    ]) {
      expect(() => assertMayRecord(learner, action)).not.toThrow();
    }
    for (const action of [
      "changeset.applied",
      "changeset.proposed",
      "excerpt.verified",
      "claim.support_checked",
      "citation.support_checked",
      "snapshot.captured",
      "mcp.token_rotated",
      "approval_delegation.granted",
    ]) {
      expect(() => assertMayRecord(learner, action)).toThrow(PermissionError);
    }
    expect(canEditContent(learner)).toBe(false);
    expect(() => requireEditor(learner, "approving a changeset")).toThrow(PermissionError);
    expect(() => requireHuman(learner, "keeping a canvas item")).not.toThrow();
  });

  it("leaves the owner, and the local user without a role, free to edit", () => {
    for (const ctx of [human("owner"), human()]) {
      expect(() => assertMayRecord(ctx, "changeset.applied")).not.toThrow();
      expect(() => requireEditor(ctx, "approving a changeset")).not.toThrow();
      expect(canEditContent(ctx)).toBe(true);
    }
  });

  it("still lets agents and importers record (they act for the local user)", () => {
    const agent: ActorContext = { ...human(), kind: "agent", onBehalfOfId: human().actorId };
    expect(() => assertMayRecord(agent, "changeset.proposed")).not.toThrow();
  });
});

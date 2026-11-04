import { describe, expect, it } from "vitest";
import { availableActions, canTransition } from "./status-machine";

describe("status machine", () => {
  it("lets an assignee take a new task and send it to review", () => {
    expect(
      availableActions({ status: "new", role: "executor", isAssignee: true }).map((a) => a.to),
    ).toEqual(["in_progress"]);
    expect(
      availableActions({ status: "in_progress", role: "executor", isAssignee: true }).map((a) => a.to),
    ).toEqual(["review"]);
  });

  it("hides executor actions from another executor", () => {
    expect(availableActions({ status: "new", role: "executor", isAssignee: false })).toEqual([]);
  });

  it("lets staff accept or return a task in review", () => {
    const actions = availableActions({ status: "review", role: "assigner", isAssignee: false });
    expect(actions.map((a) => a.to).sort()).toEqual(["accepted", "rework"]);
  });

  it("requires a comment when returning to rework", () => {
    const denied = canTransition({
      from: "review",
      to: "rework",
      role: "assigner",
      isAssignee: false,
      comment: "ok",
    });
    expect(denied.ok).toBe(false);

    const allowed = canTransition({
      from: "review",
      to: "rework",
      role: "assigner",
      isAssignee: false,
      comment: "Переделать швы",
    });
    expect(allowed.ok).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(
      canTransition({
        from: "new",
        to: "accepted",
        role: "admin",
        isAssignee: false,
      }).ok,
    ).toBe(false);

    expect(
      canTransition({
        from: "review",
        to: "in_progress",
        role: "executor",
        isAssignee: true,
      }).ok,
    ).toBe(false);
  });

  it("lets the assignee resume work after rework", () => {
    expect(
      canTransition({
        from: "rework",
        to: "in_progress",
        role: "executor",
        isAssignee: true,
      }).ok,
    ).toBe(true);
  });
});

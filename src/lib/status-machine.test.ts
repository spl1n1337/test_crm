import { describe, expect, it } from "vitest";
import { availableActions, canTransition } from "./status-machine";

describe("availableActions", () => {
  it("shows take-in-progress only to the assigned executor", () => {
    expect(availableActions({ status: "new", role: "executor", isAssignee: true }).map((a) => a.to)).toEqual([
      "in_progress",
    ]);
    expect(availableActions({ status: "new", role: "executor", isAssignee: false })).toEqual([]);
  });

  it("does not let an assigner skip the workflow", () => {
    expect(availableActions({ status: "new", role: "assigner", isAssignee: false })).toEqual([]);
    expect(availableActions({ status: "in_progress", role: "admin", isAssignee: false })).toEqual([]);
  });

  it("lets staff accept or return from review", () => {
    const actions = availableActions({ status: "review", role: "assigner", isAssignee: false });
    expect(actions.map((a) => a.to)).toEqual(["accepted", "rework"]);
    expect(actions.find((a) => a.to === "rework")?.commentRequired).toBe(true);
  });
});

describe("canTransition", () => {
  it("blocks new → accepted", () => {
    expect(
      canTransition({ from: "new", to: "accepted", role: "admin", isAssignee: false }).ok,
    ).toBe(false);
  });

  it("does not let an executor accept a task", () => {
    expect(
      canTransition({ from: "review", to: "accepted", role: "executor", isAssignee: true }).ok,
    ).toBe(false);
  });

  it("requires a real comment for rework", () => {
    expect(
      canTransition({ from: "review", to: "rework", role: "assigner", isAssignee: false, comment: "  " }).ok,
    ).toBe(false);
    expect(
      canTransition({
        from: "review",
        to: "rework",
        role: "assigner",
        isAssignee: false,
        comment: "Переделать швы",
      }).ok,
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { deadlineState } from "@/lib/deadlines";

describe("deadlineState", () => {
  const now = Date.parse("2026-11-04T12:00:00.000Z");

  it("is soon when due within 15 minutes", () => {
    expect(
      deadlineState({
        deadline: "2026-11-04T12:10:00.000Z",
        status: "in_progress",
        now,
      }),
    ).toEqual({ soon: true, expired: false });
  });

  it("is expired after the deadline", () => {
    expect(
      deadlineState({
        deadline: "2026-11-04T11:59:00.000Z",
        status: "review",
        now,
      }),
    ).toEqual({ soon: false, expired: true });
  });

  it("ignores accepted tasks", () => {
    expect(
      deadlineState({
        deadline: "2026-11-04T11:00:00.000Z",
        status: "accepted",
        now,
      }),
    ).toEqual({ soon: false, expired: false });
  });
});

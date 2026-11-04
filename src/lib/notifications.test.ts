import { describe, expect, it } from "vitest";
import { notificationHref, notificationLinkLabel } from "./notifications";

describe("notificationHref", () => {
  it("sends registration notices to the staff page", () => {
    expect(
      notificationHref({ type: "registration", object_id: null, task_id: "11111111-1111-1111-1111-111111111111" }),
    ).toBe("/admin");
    expect(notificationLinkLabel({ type: "registration", object_id: null, task_id: null })).toBe("К сотрудникам");
    expect(
      notificationHref({ type: "status_change", title: "Новая регистрация", object_id: null, task_id: null }),
    ).toBe("/admin");
  });

  it("prefers the object over the task", () => {
    expect(
      notificationHref({
        type: "new_task",
        object_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        task_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      }),
    ).toBe("/objects/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(
      notificationLinkLabel({
        type: "deadline_soon",
        object_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        task_id: null,
      }),
    ).toBe("Открыть объект");
  });

  it("falls back to the task when the object is missing", () => {
    expect(
      notificationHref({
        type: "status_change",
        object_id: null,
        task_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      }),
    ).toBe("/tasks/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  });
});

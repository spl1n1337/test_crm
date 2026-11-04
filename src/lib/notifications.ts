import type { AppNotification } from "@/lib/types";

function isRegistrationNotice(item: Pick<AppNotification, "type" | "object_id" | "task_id"> & { title?: string }) {
  return item.type === "registration" || item.title === "Новая регистрация";
}

export function notificationHref(
  item: Pick<AppNotification, "type" | "object_id" | "task_id"> & { title?: string },
) {
  if (isRegistrationNotice(item)) return "/admin";
  if (item.object_id) return `/objects/${item.object_id}`;
  if (item.task_id) return `/tasks/${item.task_id}`;
  return "/objects";
}

export function notificationLinkLabel(
  item: Pick<AppNotification, "type" | "object_id" | "task_id"> & { title?: string },
) {
  if (isRegistrationNotice(item)) return "К сотрудникам";
  if (item.object_id) return "Открыть объект";
  if (item.task_id) return "Открыть задачу";
  return "Открыть";
}

import type { TaskStatus, UserRole } from "./types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
};

export type TransitionAction = {
  to: TaskStatus;
  label: string;
  commentRequired: boolean;
};

const EXECUTOR_TRANSITIONS: Partial<Record<TaskStatus, TransitionAction>> = {
  new: { to: "in_progress", label: "Взять в работу", commentRequired: false },
  in_progress: { to: "review", label: "Отправить на проверку", commentRequired: false },
  rework: { to: "in_progress", label: "Вернуть в работу", commentRequired: false },
};

const STAFF_TRANSITIONS: Partial<Record<TaskStatus, TransitionAction[]>> = {
  review: [
    { to: "accepted", label: "Принять", commentRequired: false },
    { to: "rework", label: "Вернуть на доработку", commentRequired: true },
  ],
};

export function isStaff(role: UserRole) {
  return role === "admin" || role === "assigner";
}

export function availableActions(input: {
  status: TaskStatus;
  role: UserRole;
  isAssignee: boolean;
}): TransitionAction[] {
  const actions: TransitionAction[] = [];
  if (input.isAssignee) {
    const action = EXECUTOR_TRANSITIONS[input.status];
    if (action) actions.push(action);
  }
  if (isStaff(input.role)) {
    actions.push(...(STAFF_TRANSITIONS[input.status] ?? []));
  }
  return actions;
}

export function canTransition(input: {
  from: TaskStatus;
  to: TaskStatus;
  role: UserRole;
  isAssignee: boolean;
  comment?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const match = availableActions({
    status: input.from,
    role: input.role,
    isAssignee: input.isAssignee,
  }).find((action) => action.to === input.to);

  if (!match) {
    return { ok: false, reason: "Этот переход статуса запрещён" };
  }
  if (match.commentRequired) {
    const comment = input.comment?.trim() ?? "";
    if (comment.length < 3) {
      return { ok: false, reason: "Комментарий обязателен при возврате на доработку" };
    }
  }
  return { ok: true };
}

import type { TaskStatus, UserRole } from "@/lib/types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  assigner: "Постановщик",
  executor: "Исполнитель",
};

export const STATUS_TONES: Record<TaskStatus, string> = {
  new: "bg-sky-100 text-sky-800 border-sky-200",
  in_progress: "bg-amber-100 text-amber-900 border-amber-200",
  review: "bg-violet-100 text-violet-800 border-violet-200",
  accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rework: "bg-rose-100 text-rose-800 border-rose-200",
};

export type TransitionAction = {
  to: TaskStatus;
  label: string;
  commentRequired: boolean;
  variant: "default" | "secondary" | "destructive" | "outline";
};

const EXECUTOR_TRANSITIONS: Partial<Record<TaskStatus, TransitionAction>> = {
  new: { to: "in_progress", label: "Взять в работу", commentRequired: false, variant: "default" },
  in_progress: { to: "review", label: "Отправить на проверку", commentRequired: false, variant: "default" },
  rework: { to: "in_progress", label: "Вернуть в работу", commentRequired: false, variant: "default" },
};

const STAFF_TRANSITIONS: Partial<Record<TaskStatus, TransitionAction[]>> = {
  review: [
    { to: "accepted", label: "Принять", commentRequired: false, variant: "default" },
    { to: "rework", label: "Вернуть на доработку", commentRequired: true, variant: "destructive" },
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
    const staff = STAFF_TRANSITIONS[input.status] ?? [];
    actions.push(...staff);
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
  const actions = availableActions({
    status: input.from,
    role: input.role,
    isAssignee: input.isAssignee,
  });
  const match = actions.find((action) => action.to === input.to);
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

export const ALLOWED_EDGES: Array<[TaskStatus | null, TaskStatus, "staff" | "assignee"]> = [
  [null, "new", "staff"],
  ["new", "in_progress", "assignee"],
  ["in_progress", "review", "assignee"],
  ["review", "accepted", "staff"],
  ["review", "rework", "staff"],
  ["rework", "in_progress", "assignee"],
];

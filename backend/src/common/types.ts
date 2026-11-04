export const USER_ROLES = ["admin", "assigner", "executor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TASK_STATUSES = [
  "new",
  "in_progress",
  "review",
  "accepted",
  "rework",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  role: UserRole;
  requested_role: UserRole;
  is_approved: boolean;
  is_blocked: boolean;
};

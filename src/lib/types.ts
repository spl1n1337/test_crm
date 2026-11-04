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

export const NOTIFICATION_TYPES = [
  "status_change",
  "new_task",
  "deadline_soon",
  "deadline_expired",
  "registration",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REQUESTABLE_ROLES = ["assigner", "executor"] as const;
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

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
  created_at: string;
  updated_at: string;
};

export type ConstructionObject = {
  id: string;
  name: string;
  address: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  object_id: string;
  title: string;
  description: string;
  assignee_id: string;
  author_id: string;
  status: TaskStatus;
  deadline: string | null;
  deadline_soon_notified: boolean;
  deadline_expired_notified: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskStatusHistory = {
  id: string;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  changed_by: string;
  comment: string | null;
  created_at: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_key: string;
  file_url: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  task_id: string | null;
  object_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type TaskWithJoins = Task & {
  object?: Pick<ConstructionObject, "id" | "name" | "address"> | null;
  assignee?: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
  author?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type PresenceMeta = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  online_at: string;
};

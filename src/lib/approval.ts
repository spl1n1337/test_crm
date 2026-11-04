type ApprovalSource = {
  is_approved?: boolean | null;
  requested_role?: string | null;
};

export function isAwaitingApproval(
  profile?: ApprovalSource | null,
  metadata?: ApprovalSource | null,
) {
  return profile?.is_approved === false || metadata?.is_approved === false;
}

export function requestedRoleOf(
  profile?: ApprovalSource | null,
  metadata?: ApprovalSource | null,
) {
  return metadata?.requested_role || profile?.requested_role || undefined;
}

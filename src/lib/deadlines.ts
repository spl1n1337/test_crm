const SOON_MS = 15 * 60 * 1000;

export function deadlineState(input: {
  deadline: string | Date | null;
  status: string;
  now?: number;
}) {
  if (!input.deadline || input.status === "accepted") {
    return { soon: false, expired: false };
  }
  const due = new Date(input.deadline).getTime();
  if (Number.isNaN(due)) return { soon: false, expired: false };
  const now = input.now ?? Date.now();
  return {
    soon: due > now && due - now <= SOON_MS,
    expired: due <= now,
  };
}

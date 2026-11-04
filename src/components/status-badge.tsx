"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/status-machine";
import { useLiveTaskStatus } from "@/lib/use-live-task-status";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

export function StatusBadge({
  status,
  taskId,
  className,
}: {
  status: TaskStatus;
  taskId?: string;
  className?: string;
}) {
  const liveStatus = useLiveTaskStatus(taskId, status);
  return (
    <Badge variant="outline" className={cn("border", STATUS_TONES[liveStatus], className)}>
      {STATUS_LABELS[liveStatus]}
    </Badge>
  );
}

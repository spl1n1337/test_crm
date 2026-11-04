"use client";

import { useEffect, useState } from "react";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";

type LiveTaskPayload = {
  task?: {
    id?: string;
    status?: string;
  };
};

function isTaskStatus(value: string | undefined): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

export function useLiveTaskStatus(taskId: string | undefined, initial: TaskStatus): TaskStatus {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    setStatus(initial);
  }, [initial, taskId]);

  useEffect(() => {
    if (!taskId) return;

    function onTask(event: Event) {
      const task = (event as CustomEvent<LiveTaskPayload>).detail?.task;
      if (!task || task.id !== taskId || !isTaskStatus(task.status)) return;
      setStatus(task.status);
    }

    window.addEventListener("crm:task", onTask);
    return () => window.removeEventListener("crm:task", onTask);
  }, [taskId]);

  return status;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { availableActions, type TransitionAction } from "@/lib/status-machine";
import { createClient } from "@/lib/supabase/client";
import { useLiveTaskStatus } from "@/lib/use-live-task-status";
import { reworkCommentSchema } from "@/lib/validations";
import type { Profile, Task } from "@/lib/types";

export function StatusActions({ task, profile }: { task: Task; profile: Profile }) {
  const router = useRouter();
  const status = useLiveTaskStatus(task.id, task.status);
  const [pending, setPending] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const actions = availableActions({
    status,
    role: profile.role,
    isAssignee: task.assignee_id === profile.id,
  });

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground">Сейчас для вас нет доступных действий.</p>;
  }

  async function run(action: TransitionAction, commentValue?: string) {
    setPending(action.to);
    const supabase = createClient();
    const { error } = await supabase.rpc("transition_task_status", {
      p_task_id: task.id,
      p_to_status: action.to,
      p_comment: commentValue ?? null,
    });
    setPending(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Статус: ${action.label}`);
    setOpen(false);
    setComment("");
    router.refresh();
  }

  function handle(action: TransitionAction) {
    if (action.commentRequired) {
      setOpen(true);
      return;
    }
    void run(action);
  }

  const rework = actions.find((action) => action.commentRequired);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {actions.map((action) => (
        <Button
          key={action.to}
          variant={action.variant}
          disabled={pending !== null}
          onClick={() => handle(action)}
        >
          {pending === action.to ? "Сохраняем…" : action.label}
        </Button>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Возврат на доработку</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rework-comment">Комментарий (обязательно)</Label>
            <Textarea
              id="rework-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Что нужно исправить"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={pending !== null}
              onClick={() => {
                const parsed = reworkCommentSchema.safeParse({ comment });
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Нужен комментарий");
                  return;
                }
                if (rework) void run(rework, parsed.data.comment);
              }}
            >
              Вернуть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

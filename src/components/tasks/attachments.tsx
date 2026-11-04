"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { validateImageFile } from "@/lib/validations";
import { isStaff } from "@/lib/status-machine";
import type { Profile, Task, TaskAttachment } from "@/lib/types";

export function TaskAttachments({
  task,
  profile,
  attachments,
}: {
  task: Task;
  profile: Profile;
  attachments: TaskAttachment[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const canUpload =
    isStaff(profile.role) ||
    (task.assignee_id === profile.id && ["new", "in_progress", "rework"].includes(task.status));

  async function onFile(file: File | undefined) {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "tasks");
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const payload = (await response.json()) as {
      error?: string;
      url?: string;
      key?: string;
      fileName?: string;
      contentType?: string;
      sizeBytes?: number;
    };
    if (!response.ok || !payload.url || !payload.key) {
      setUploading(false);
      toast.error(payload.error ?? "Не удалось загрузить файл");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("task_attachments").insert({
      task_id: task.id,
      file_key: payload.key,
      file_url: payload.url,
      file_name: payload.fileName ?? file.name,
      content_type: payload.contentType ?? file.type,
      size_bytes: payload.sizeBytes ?? file.size,
      uploaded_by: profile.id,
    });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Файл прикреплён");
    router.refresh();
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("task_attachments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Файл удалён");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {canUpload ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP до 5 МБ</p>
        </div>
      ) : null}
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Вложений нет</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((file) => (
            <figure key={file.id} className="overflow-hidden rounded-lg border bg-card">
              <a href={file.file_url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.file_url} alt={file.file_name} className="h-28 w-full object-cover" />
              </a>
              <figcaption className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs">{file.file_name}</span>
                {file.uploaded_by === profile.id || isStaff(profile.role) ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void remove(file.id)}>
                    Удалить
                  </Button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

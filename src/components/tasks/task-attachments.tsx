"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload";
import { validateImageFile } from "@/lib/validations";
import type { TaskAttachment } from "@/lib/types";

export function TaskAttachments({
  taskId,
  attachments,
  canUpload,
}: {
  taskId: string;
  attachments: TaskAttachment[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function onFile(file: File) {
    const invalid = validateImageFile({ type: file.type, size: file.size, name: file.name });
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setPending(true);
    try {
      const uploaded = await uploadImage(file, "tasks");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Сессия истекла");
      const { error } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_key: uploaded.key,
        file_url: uploaded.url,
        file_name: uploaded.fileName,
        content_type: uploaded.contentType,
        size_bytes: uploaded.sizeBytes,
        uploaded_by: user.id,
      });
      if (error) throw error;
      toast.success("Фото добавлено");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Фото</CardTitle>
        {canUpload ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onFile(file);
              }}
            />
            <Button size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
              {pending ? "Загружаем…" : "Прикрепить"}
            </Button>
          </>
        ) : null}
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Вложений нет</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachments.map((file) => (
              <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.file_url} alt={file.file_name} className="h-28 w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

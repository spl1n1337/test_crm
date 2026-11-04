"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { taskSchema, type TaskInput } from "@/lib/validations";
import type { ConstructionObject, Profile, Task } from "@/lib/types";

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TaskForm({
  task,
  objects,
  executors,
  defaultObjectId,
}: {
  task?: Task;
  objects: Pick<ConstructionObject, "id" | "name">[];
  executors: Pick<Profile, "id" | "full_name" | "email">[];
  defaultObjectId?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<TaskInput>({
    resolver: zodResolver(taskSchema) as never,
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      objectId: task?.object_id ?? defaultObjectId ?? "",
      assigneeId: task?.assignee_id ?? "",
      deadline: toLocalInput(task?.deadline ?? null),
    },
  });

  async function onSubmit(values: TaskInput) {
    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Сессия истекла");
      setSubmitting(false);
      return;
    }

    const deadline = values.deadline.trim() ? new Date(values.deadline).toISOString() : null;
    if (task) {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: values.title,
          description: values.description,
          object_id: values.objectId,
          assignee_id: values.assigneeId,
          deadline,
        })
        .eq("id", task.id);
      setSubmitting(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Задача обновлена");
      router.push(`/tasks/${task.id}`);
      router.refresh();
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: values.title,
        description: values.description,
        object_id: values.objectId,
        assignee_id: values.assigneeId,
        author_id: user.id,
        status: "new",
        deadline,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Не удалось создать задачу");
      return;
    }
    toast.success("Задача создана");
    router.push(`/tasks/${data.id}`);
    router.refresh();
  }

  return (
    <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">Название</Label>
        <Input id="title" placeholder="Проверить опалубку 3 этажа" {...form.register("title")} />
        {form.formState.errors.title ? (
          <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea id="description" rows={5} {...form.register("description")} />
        {form.formState.errors.description ? (
          <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="objectId">Объект</Label>
          <select
            id="objectId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("objectId")}
          >
            <option value="">Выберите объект</option>
            {objects.map((object) => (
              <option key={object.id} value={object.id}>
                {object.name}
              </option>
            ))}
          </select>
          {form.formState.errors.objectId ? (
            <p className="text-sm text-destructive">{form.formState.errors.objectId.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="assigneeId">Исполнитель</Label>
          <select
            id="assigneeId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("assigneeId")}
          >
            <option value="">Выберите исполнителя</option>
            {executors.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name || person.email}
              </option>
            ))}
          </select>
          {form.formState.errors.assigneeId ? (
            <p className="text-sm text-destructive">{form.formState.errors.assigneeId.message}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deadline">Дедлайн</Label>
        <Controller
          control={form.control}
          name="deadline"
          render={({ field }) => <DateTimePicker id="deadline" value={field.value} onChange={field.onChange} />}
        />
        {form.formState.errors.deadline ? (
          <p className="text-sm text-destructive">{form.formState.errors.deadline.message}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохраняем…" : task ? "Сохранить" : "Создать задачу"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

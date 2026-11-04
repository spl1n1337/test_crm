"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { objectSchema, type ObjectInput } from "@/lib/validations";
import type { ConstructionObject } from "@/lib/types";

export function ObjectForm({ object }: { object?: ConstructionObject }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ObjectInput>({
    resolver: zodResolver(objectSchema),
    defaultValues: { name: object?.name ?? "", address: object?.address ?? "" },
  });

  async function onSubmit(values: ObjectInput) {
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

    if (object) {
      const { error } = await supabase.from("objects").update(values).eq("id", object.id);
      setSubmitting(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Объект обновлён");
      router.push(`/objects/${object.id}`);
      router.refresh();
      return;
    }

    const { data, error } = await supabase
      .from("objects")
      .insert({ name: values.name, address: values.address, created_by: user.id })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Не удалось создать объект");
      return;
    }
    toast.success("Объект создан");
    router.push(`/objects/${data.id}`);
    router.refresh();
  }

  return (
    <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Название</Label>
        <Input id="name" placeholder="ЖК Солнечный, корпус 3" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Адрес</Label>
        <Input id="address" placeholder="Москва, ул. Строителей, 10" {...form.register("address")} />
        {form.formState.errors.address ? (
          <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохраняем…" : object ? "Сохранить" : "Создать объект"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

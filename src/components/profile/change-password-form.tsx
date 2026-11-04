"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations";

export function ChangePasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setSubmitting(true);
    setDevLink(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setSubmitting(false);
      toast.error("Сессия истекла");
      return;
    }

    const response = await fetch("/api/auth/password-change", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as {
      error?: string;
      mocked?: boolean;
      confirmUrl?: string;
    };
    setSubmitting(false);
    if (!response.ok) {
      toast.error(payload.error ?? "Не удалось запросить смену пароля");
      return;
    }
    form.reset();
    if (payload.mocked && payload.confirmUrl) {
      setDevLink(payload.confirmUrl);
      toast.message("SMTP не настроен — откройте ссылку ниже");
      return;
    }
    toast.success("Письмо отправлено. Подтвердите смену пароля по ссылке.");
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div>
        <h2 className="text-base font-semibold">Смена пароля</h2>
        <p className="text-sm text-muted-foreground">Новый пароль заработает после подтверждения по почте.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Текущий пароль</Label>
        <PasswordInput id="currentPassword" autoComplete="current-password" {...form.register("currentPassword")} />
        {form.formState.errors.currentPassword ? (
          <p className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Новый пароль</Label>
        <PasswordInput id="newPassword" autoComplete="new-password" {...form.register("password")} />
        {form.formState.errors.password ? (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmNewPassword">Повтор нового пароля</Label>
        <PasswordInput
          id="confirmNewPassword"
          autoComplete="new-password"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Отправляем…" : "Отправить подтверждение"}
      </Button>
      {devLink ? (
        <p className="text-sm">
          <a className="text-primary underline" href={devLink}>
            Подтвердить смену пароля
          </a>
        </p>
      ) : null}
    </form>
  );
}

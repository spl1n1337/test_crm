"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations";

export function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setSubmitting(true);
    const response = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, token: values.token || token }),
    });
    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);
    if (!response.ok) {
      toast.error(payload.error ?? "Не удалось сохранить пароль");
      return;
    }
    setDone(true);
    toast.success("Пароль обновлён");
  }

  if (!token) {
    return (
      <p className="text-sm text-muted-foreground">
        В ссылке нет токена. Запросите восстановление ещё раз на странице{" "}
        <Link className="text-primary underline" href="/forgot">
          «Забыли пароль»
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 text-sm">
        <p>Новый пароль сохранён. Войдите с ним.</p>
        <Button asChild className="w-full">
          <Link href="/login">Войти</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <input type="hidden" {...form.register("token")} />
      <div className="space-y-2">
        <Label htmlFor="password">Новый пароль</Label>
        <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
        {form.formState.errors.password ? (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Повтор пароля</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <Button className="w-full" type="submit" disabled={submitting}>
        {submitting ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}

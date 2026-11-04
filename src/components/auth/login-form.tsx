"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      const message = error.message.toLowerCase().includes("email not confirmed")
        ? "Почта ещё не подтверждена. Проверьте письмо."
        : error.message.toLowerCase().includes("invalid")
          ? "Неверный email или пароль"
          : error.message;
      toast.error(message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("is_blocked").eq("id", user.id).maybeSingle()
      : { data: null };
    const awaiting = (user?.user_metadata as { is_approved?: boolean } | undefined)?.is_approved === false;

    toast.success("Вход выполнен");
    if (profile?.is_blocked) {
      router.replace("/blocked");
    } else if (awaiting) {
      router.replace("/pending");
    } else {
      router.replace(searchParams.get("next") || "/objects");
    }
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.ru"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Пароль</Label>
          <Link href="/forgot" className="text-xs text-primary hover:underline">
            Забыли пароль?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      <Button className="w-full" type="submit" disabled={submitting}>
        {submitting ? "Входим…" : "Войти"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <Link className="font-medium text-primary hover:underline" href="/register">
          Регистрация
        </Link>
      </p>
    </form>
  );
}

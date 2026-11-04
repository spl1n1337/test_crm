"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations";

export function ForgotForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setSubmitting(true);
    const response = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as {
      error?: string;
      mocked?: boolean;
      confirmUrl?: string;
    };
    setSubmitting(false);
    if (!response.ok) {
      toast.error(payload.error ?? "Не удалось отправить письмо");
      return;
    }
    setDone(true);
    if (payload.mocked && payload.confirmUrl) {
      setDevLink(payload.confirmUrl);
    }
    toast.success("Если такой аккаунт есть, мы отправили письмо");
  }

  if (done) {
    return (
      <div className="space-y-3 text-sm">
        <p>Проверьте почту. Если аккаунт существует, там будет ссылка для нового пароля.</p>
        {devLink ? (
          <p>
            SMTP в режиме разработки.{" "}
            <a className="font-medium text-primary underline" href={devLink}>
              Открыть ссылку сброса
            </a>
          </p>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">К входу</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <Button className="w-full" type="submit" disabled={submitting}>
        {submitting ? "Отправляем…" : "Отправить ссылку"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="font-medium text-primary hover:underline" href="/login">
          Вернуться ко входу
        </Link>
      </p>
    </form>
  );
}

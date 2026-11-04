"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/lib/validations";

export function RegisterForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", role: "executor", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterInput) {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(20_000),
      });
      const payload = (await response.json()) as {
        error?: string;
        mocked?: boolean;
        confirmUrl?: string;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Не удалось зарегистрироваться");
        return;
      }
      setDone(true);
      if (payload.mocked && payload.confirmUrl) {
        setDevLink(payload.confirmUrl);
        toast.message("SMTP не настроен — используйте ссылку на экране");
      } else {
        toast.success("Письмо отправлено. Проверьте почту.");
      }
    } catch {
      toast.error("Сервер почты не ответил. Попробуйте ещё раз через минуту.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3 text-sm">
        <p>Аккаунт создан. Подтвердите почту. После этого администратор подтвердит выбранную роль.</p>
        {devLink ? (
          <p>
            Режим разработки, письмо не ушло.{" "}
            <a className="font-medium text-primary underline" href={devLink}>
              Подтвердить сейчас
            </a>
          </p>
        ) : (
          <p className="text-muted-foreground">Если письма нет, проверьте папку «Спам».</p>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">К входу</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Имя</Label>
        <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
        {form.formState.errors.fullName ? (
          <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Роль</legend>
        <label className="flex items-start gap-2 rounded-lg border p-3">
          <input type="radio" value="executor" className="mt-1" {...form.register("role")} />
          <span>
            <span className="block text-sm font-medium">Исполнитель</span>
            <span className="text-xs text-muted-foreground">Беру задачи в работу и сдаю на проверку</span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-lg border p-3">
          <input type="radio" value="assigner" className="mt-1" {...form.register("role")} />
          <span>
            <span className="block text-sm font-medium">Постановщик</span>
            <span className="text-xs text-muted-foreground">Создаю объекты и задачи, принимаю работу</span>
          </span>
        </label>
        {form.formState.errors.role ? (
          <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">Администратор подтвердит роль после проверки почты.</p>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="password">Пароль</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          {...form.register("password")}
        />
        <p className="text-xs text-muted-foreground">Минимум 8 символов, буква и цифра.</p>
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
        {submitting ? "Создаём…" : "Зарегистрироваться"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link className="font-medium text-primary hover:underline" href="/login">
          Войти
        </Link>
      </p>
    </form>
  );
}

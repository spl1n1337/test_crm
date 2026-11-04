"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarCropper } from "@/components/profile/avatar-cropper";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { ROLE_LABELS } from "@/lib/status-machine";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload";
import { getInitials } from "@/lib/utils";
import { profileSchema, validateImageFile, type ProfileInput } from "@/lib/validations";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile.full_name, phone: profile.phone },
  });

  async function onSubmit(values: ProfileInput) {
    setSubmitting(true);
    const { error } = await createClient()
      .from("profiles")
      .update({ full_name: values.fullName, phone: values.phone })
      .eq("id", profile.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Профиль сохранён");
    router.refresh();
  }

  async function onCropped(blob: Blob) {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    try {
      const uploaded = await uploadImage(file, "avatars");
      const { error } = await createClient()
        .from("profiles")
        .update({ avatar_url: uploaded.url })
        .eq("id", profile.id);
      if (error) throw error;
      setAvatarUrl(uploaded.url);
      toast.success("Фото обновлено");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить фото");
      throw error;
    }
  }

  return (
    <div className="grid max-w-xl gap-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border">
          <AvatarImage src={avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{getInitials(profile.full_name, profile.email)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{ROLE_LABELS[profile.role]}</p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const invalid = validateImageFile({ type: file.type, size: file.size, name: file.name });
              if (invalid) {
                toast.error(invalid);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setCropSrc(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
          <Button className="mt-2" type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Загрузить фото
          </Button>
        </div>
      </div>

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName">Имя</Label>
          <Input id="fullName" {...form.register("fullName")} />
          {form.formState.errors.fullName ? (
            <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input id="phone" type="tel" placeholder="+7 900 000-00-00" {...form.register("phone")} />
          {form.formState.errors.phone ? (
            <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохраняем…" : "Сохранить"}
        </Button>
      </form>

      <div className="border-t pt-6">
        <ChangePasswordForm />
      </div>

      <AvatarCropper
        open={Boolean(cropSrc)}
        imageSrc={cropSrc}
        onOpenChange={(open) => {
          if (!open) setCropSrc(null);
        }}
        onCropped={onCropped}
      />
    </div>
  );
}

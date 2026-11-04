import { z } from "zod";

export const REQUESTABLE_ROLES = ["assigner", "executor"] as const;

export const passwordSchema = z
  .string()
  .min(8, "Пароль должен содержать минимум 8 символов")
  .max(72, "Пароль слишком длинный")
  .regex(/[A-Za-zА-Яа-я]/, "Пароль должен содержать хотя бы одну букву")
  .regex(/\d/, "Пароль должен содержать хотя бы одну цифру");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Укажите email")
  .email("Некорректный email")
  .max(120, "Email слишком длинный");

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Имя слишком короткое")
      .max(120, "Имя слишком длинное")
      .regex(/^[\p{L}\s.'-]+$/u, "Имя может содержать только буквы, пробелы, дефис и точку"),
    email: emailSchema,
    role: z.enum(REQUESTABLE_ROLES, { required_error: "Выберите роль" }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "Некорректная ссылка"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  })
  .refine((data) => data.currentPassword !== data.password, {
    path: ["password"],
    message: "Новый пароль должен отличаться от текущего",
  });

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: { type: string; size: number; name: string }) {
  if (!IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number])) {
    return "Можно прикрепить только JPG, PNG или WEBP";
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return "Размер файла должен быть от 1 байта до 5 МБ";
  }
  if (!file.name.trim()) {
    return "У файла должно быть имя";
  }
  return null;
}

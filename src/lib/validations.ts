import { z } from "zod";
import { REQUESTABLE_ROLES, TASK_STATUSES, USER_ROLES } from "@/lib/types";

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

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введите пароль").max(72),
});

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

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Имя слишком короткое")
    .max(120, "Имя слишком длинное"),
  phone: z
    .string()
    .trim()
    .max(32, "Телефон слишком длинный")
    .refine((value) => value === "" || /^[+0-9()\s-]+$/.test(value), "Некорректный телефон")
    .refine((value) => value === "" || value.replace(/\D/g, "").length >= 10, "Слишком короткий телефон"),
});

export const objectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название слишком короткое")
    .max(120, "Название слишком длинное"),
  address: z
    .string()
    .trim()
    .min(5, "Адрес слишком короткий")
    .max(300, "Адрес слишком длинный"),
});

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Название слишком короткое")
    .max(160, "Название слишком длинное"),
  description: z.string().trim().max(4000, "Описание слишком длинное"),
  objectId: z.string().uuid("Выберите объект"),
  assigneeId: z.string().uuid("Выберите исполнителя"),
  deadline: z
    .string()
    .refine((value) => {
      if (!value.trim()) return true;
      return !Number.isNaN(new Date(value).getTime());
    }, "Некорректная дата дедлайна"),
});

export const reworkCommentSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(3, "Комментарий обязателен — минимум 3 символа")
    .max(1000, "Комментарий слишком длинный"),
});

export const transitionSchema = z.object({
  taskId: z.string().uuid(),
  toStatus: z.enum(TASK_STATUSES),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export const adminRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(USER_ROLES),
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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ObjectInput = z.infer<typeof objectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;

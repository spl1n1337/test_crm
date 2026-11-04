import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  objectSchema,
  registerSchema,
  resetPasswordSchema,
  taskSchema,
  validateImageFile,
} from "./validations";

describe("loginSchema", () => {
  it("rejects an empty password and a bad email", () => {
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.c", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "boss@stroy.ru", password: "secret" }).success).toBe(true);
  });
});

describe("registerSchema", () => {
  it("requires a strong password and matching confirmation", () => {
    expect(
      registerSchema.safeParse({
        fullName: "Иван",
        email: "ivan@stroy.ru",
        password: "password",
        confirmPassword: "password",
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        fullName: "Иван Иванов",
        email: "ivan@stroy.ru",
        role: "executor",
        password: "Secret123",
        confirmPassword: "Secret123",
      }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        fullName: "Иван Иванов",
        email: "ivan@stroy.ru",
        role: "admin",
        password: "Secret123",
        confirmPassword: "Secret123",
      }).success,
    ).toBe(false);
  });
});

describe("password recovery schemas", () => {
  it("accepts a valid reset payload", () => {
    expect(forgotPasswordSchema.safeParse({ email: "boss@stroy.ru" }).success).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        token: "a".repeat(24),
        password: "Secret123",
        confirmPassword: "Secret123",
      }).success,
    ).toBe(true);
  });

  it("requires a different new password", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Secret123",
        password: "Secret123",
        confirmPassword: "Secret123",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Secret123",
        password: "Secret124",
        confirmPassword: "Secret124",
      }).success,
    ).toBe(true);
  });
});

describe("crm cards", () => {
  it("validates object and task payloads", () => {
    expect(objectSchema.safeParse({ name: "X", address: "abc" }).success).toBe(false);
    expect(objectSchema.safeParse({ name: "ЖК Солнечный", address: "Москва, ул. Ленина, 1" }).success).toBe(true);
    expect(
      taskSchema.safeParse({
        title: "A",
        description: "",
        objectId: "not-uuid",
        assigneeId: "not-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("images", () => {
  it("accepts jpeg and rejects pdf", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 2048, name: "a.jpg" })).toBeNull();
    expect(validateImageFile({ type: "application/pdf", size: 2048, name: "a.pdf" })).toBeTruthy();
  });
});

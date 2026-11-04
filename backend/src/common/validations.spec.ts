import { describe, expect, it } from "vitest";
import { registerSchema, validateImageFile } from "./validations";

describe("registerSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = registerSchema.safeParse({
      fullName: "Иван Петров",
      email: "ivan@company.ru",
      role: "executor",
      password: "Secret123",
      confirmPassword: "Secret123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a weak password and mismatched confirmation", () => {
    const weak = registerSchema.safeParse({
      fullName: "Иван",
      email: "ivan@company.ru",
      password: "short",
      confirmPassword: "short",
    });
    expect(weak.success).toBe(false);

    const mismatch = registerSchema.safeParse({
      fullName: "Иван",
      email: "ivan@company.ru",
      password: "Secret123",
      confirmPassword: "Secret124",
    });
    expect(mismatch.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const parsed = registerSchema.safeParse({
      fullName: "Иван",
      email: "not-an-email",
      password: "Secret123",
      confirmPassword: "Secret123",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("validateImageFile", () => {
  it("allows a jpeg under 5 MB", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 1024, name: "a.jpg" })).toBeNull();
  });

  it("rejects pdf and oversized files", () => {
    expect(validateImageFile({ type: "application/pdf", size: 100, name: "a.pdf" })).toBeTruthy();
    expect(validateImageFile({ type: "image/png", size: 6 * 1024 * 1024, name: "a.png" })).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import { registerSchema } from "../common/validations";

describe("AuthService register payload", () => {
  it("keeps the same contract the controller forwards", () => {
    const parsed = registerSchema.parse({
      fullName: "Анна Смирнова",
      email: "anna@stroy.ru",
      role: "assigner",
      password: "Workpass1",
      confirmPassword: "Workpass1",
    });
    expect(parsed.email).toBe("anna@stroy.ru");
    expect(parsed.role).toBe("assigner");
  });
});

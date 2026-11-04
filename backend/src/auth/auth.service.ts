import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
} from "../common/validations";
import { MailService } from "../mail/mail.service";
import { SupabaseService } from "../supabase/supabase.service";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  assigner: "Постановщик",
  executor: "Исполнитель",
};

type TokenPurpose = "email_confirm" | "password_reset" | "password_change";
type TokenPayload = { password?: string };
type TokenStash = {
  hash: string;
  purpose: TokenPurpose;
  sealed: string;
  expires_at: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private appUrl() {
    return this.config.get<string>("APP_URL") || "http://localhost:3000";
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private tokenSecret() {
    return (
      this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY") ||
      this.config.get<string>("CRON_SECRET") ||
      "stroycrm-email-token"
    );
  }

  private seal(payload: TokenPayload) {
    const key = createHash("sha256").update(this.tokenSecret()).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  }

  private unseal(sealed: string): TokenPayload {
    const key = createHash("sha256").update(this.tokenSecret()).digest();
    const buf = Buffer.from(sealed, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return JSON.parse(json) as TokenPayload;
  }

  private async stashToken(userId: string, stash: TokenStash) {
    const { data } = await this.supabase.admin.auth.admin.getUserById(userId);
    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    await this.supabase.admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...meta, crm_email_token: stash },
    });
  }

  private async readStash(userId: string, tokenHash: string) {
    const { data } = await this.supabase.admin.auth.admin.getUserById(userId);
    const stash = (data.user?.user_metadata as { crm_email_token?: TokenStash } | undefined)?.crm_email_token;
    if (!stash || stash.hash !== tokenHash) return null;
    return stash;
  }

  private async clearStash(userId: string, tokenHash: string) {
    const { data } = await this.supabase.admin.auth.admin.getUserById(userId);
    const stash = (data.user?.user_metadata as { crm_email_token?: TokenStash } | undefined)?.crm_email_token;
    if (stash?.hash !== tokenHash) return;
    const meta = { ...(data.user?.user_metadata ?? {}) } as Record<string, unknown>;
    await this.supabase.admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...meta, crm_email_token: null },
    });
  }

  private async notifyAdminsOfRegistration(profile: {
    email?: string;
    full_name?: string;
    requested_role?: string | null;
  }) {
    const { data: admins } = await this.supabase.admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_blocked", false);

    const requested = profile.requested_role || "executor";
    const roleName = ROLE_LABELS[requested] ?? requested;
    const title = "Новая регистрация";
    const body = `${profile.full_name || profile.email} подтвердил почту и запросил роль «${roleName}». Откройте список сотрудников.`;

    for (const admin of admins ?? []) {
      const row = { user_id: admin.id, title, body, task_id: null as string | null };
      const withEnum = await this.supabase.admin.from("notifications").insert({
        ...row,
        type: "registration",
      });
      if (!withEnum.error) continue;
      await this.supabase.admin.from("notifications").insert({
        ...row,
        type: "status_change",
      });
    }
  }

  private async issueToken(input: {
    userId: string;
    purpose: TokenPurpose;
    hours: number;
    payload?: TokenPayload;
  }) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + input.hours * 60 * 60 * 1000).toISOString();
    const tokenHash = this.hashToken(token);
    const payload = input.payload ?? {};
    const full = await this.supabase.admin.from("email_tokens").insert({
      user_id: input.userId,
      token_hash: tokenHash,
      purpose: input.purpose,
      payload,
      expires_at: expiresAt,
    });
    if (!full.error) return token;

    this.logger.warn(`email_tokens full insert failed, using legacy columns: ${full.error.message}`);
    const fallback = await this.supabase.admin.from("email_tokens").insert({
      user_id: input.userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (fallback.error) {
      this.logger.error(fallback.error.message);
      throw new BadRequestException("Не удалось создать ссылку подтверждения");
    }

    await this.stashToken(input.userId, {
      hash: tokenHash,
      purpose: input.purpose,
      sealed: this.seal(payload),
      expires_at: expiresAt,
    });
    return token;
  }

  private async consumeToken(token: string, purpose: TokenPurpose) {
    if (!token || token.length < 20) {
      throw new BadRequestException("Некорректная ссылка");
    }
    type TokenRow = {
      id: string;
      user_id: string;
      expires_at: string;
      used_at: string | null;
      purpose?: string;
      payload?: TokenPayload;
    };

    const tokenHash = this.hashToken(token);
    let row: TokenRow | null = null;
    let { data, error } = await this.supabase.admin
      .from("email_tokens")
      .select("id, user_id, expires_at, used_at, purpose, payload")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error?.message?.includes("purpose") || error?.message?.includes("payload")) {
      const legacy = await this.supabase.admin
        .from("email_tokens")
        .select("id, user_id, expires_at, used_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      error = legacy.error;
      if (legacy.data) {
        const stash = await this.readStash(legacy.data.user_id, tokenHash);
        data = {
          ...legacy.data,
          purpose: stash?.purpose ?? "email_confirm",
          payload: stash ? this.unseal(stash.sealed) : {},
        };
      } else {
        data = null;
      }
    }
    row = (data as TokenRow | null) ?? null;

    if (error || !row) {
      throw new BadRequestException("Ссылка недействительна");
    }
    if (row.purpose && row.purpose !== purpose) {
      throw new BadRequestException("Ссылка недействительна");
    }
    if (row.used_at) {
      throw new BadRequestException("Ссылка уже использована");
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new BadRequestException("Срок ссылки истёк");
    }

    await this.supabase.admin
      .from("email_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);
    await this.clearStash(row.user_id, tokenHash);

    return row as {
      id: string;
      user_id: string;
      payload: TokenPayload;
    };
  }

  async register(payload: unknown) {
    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Проверьте поля формы");
    }

    const { email, password, fullName, role } = parsed.data;
    const { data: created, error } = await this.supabase.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName, requested_role: role, is_approved: false },
    });

    if (error || !created.user) {
      const message = error?.message?.includes("already")
        ? "Пользователь с таким email уже существует"
        : error?.message ?? "Не удалось создать пользователя";
      throw new BadRequestException(message);
    }

    const profileUpdate = await this.supabase.admin
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        requested_role: role,
        role: "executor",
        is_approved: false,
      })
      .eq("id", created.user.id);
    if (profileUpdate.error) {
      await this.supabase.admin
        .from("profiles")
        .update({ full_name: fullName, email, role: "executor" })
        .eq("id", created.user.id);
    }

    let token: string;
    try {
      token = await this.issueToken({
        userId: created.user.id,
        purpose: "email_confirm",
        hours: 24,
      });
    } catch (error) {
      await this.supabase.admin.auth.admin.deleteUser(created.user.id);
      throw error;
    }
    const confirmUrl = `${this.appUrl()}/confirm?token=${token}`;
    const mailed = await this.mail.sendConfirmationEmail({
      to: email,
      name: fullName,
      confirmUrl,
    });

    return {
      ok: true,
      mocked: mailed.mocked,
      confirmUrl: mailed.mocked ? mailed.confirmUrl : undefined,
    };
  }

  async confirm(token?: string) {
    const row = await this.consumeToken(token ?? "", "email_confirm");

    const { data: authUser } = await this.supabase.admin.auth.admin.getUserById(row.user_id);
    const meta = (authUser.user?.user_metadata ?? {}) as {
      is_approved?: boolean;
      requested_role?: string;
    };
    const { error: confirmError } = await this.supabase.admin.auth.admin.updateUserById(row.user_id, {
      email_confirm: true,
      user_metadata: {
        ...meta,
        is_approved: meta.is_approved === true,
      },
    });
    if (confirmError) {
      throw new BadRequestException(confirmError.message);
    }

    const profileQuery = await this.supabase.admin
      .from("profiles")
      .select("id, email, full_name, requested_role")
      .eq("id", row.user_id)
      .maybeSingle();
    const profile =
      profileQuery.data ??
      (
        await this.supabase.admin
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", row.user_id)
          .maybeSingle()
      ).data;

    if (profile) {
      await this.notifyAdminsOfRegistration({
        ...profile,
        requested_role:
          (profile as { requested_role?: string }).requested_role || meta.requested_role || "executor",
      });
    }

    return { ok: true };
  }

  async forgotPassword(payload: unknown) {
    const parsed = forgotPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Укажите email");
    }

    const email = parsed.data.email.toLowerCase();
    const { data: profile } = await this.supabase.admin
      .from("profiles")
      .select("id, email, full_name, is_blocked")
      .eq("email", email)
      .maybeSingle();

    if (!profile || profile.is_blocked) {
      return { ok: true };
    }

    const { data: user } = await this.supabase.admin.auth.admin.getUserById(profile.id);
    if (!user.user?.email_confirmed_at) {
      return { ok: true };
    }

    const token = await this.issueToken({
      userId: profile.id,
      purpose: "password_reset",
      hours: 1,
    });
    const resetUrl = `${this.appUrl()}/reset-password?token=${token}`;
    const mailed = await this.mail.sendResetPasswordEmail({
      to: profile.email,
      name: profile.full_name,
      resetUrl,
    });

    return {
      ok: true,
      mocked: mailed.mocked,
      confirmUrl: mailed.mocked ? mailed.confirmUrl : undefined,
    };
  }

  async resetPassword(payload: unknown) {
    const parsed = resetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Проверьте поля формы");
    }
    const row = await this.consumeToken(parsed.data.token, "password_reset");
    const { error } = await this.supabase.admin.auth.admin.updateUserById(row.user_id, {
      password: parsed.data.password,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return { ok: true };
  }

  async requestPasswordChange(accessToken: string, payload: unknown) {
    const parsed = changePasswordSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Проверьте поля формы");
    }

    const { data, error } = await this.supabase.admin.auth.getUser(accessToken);
    if (error || !data.user?.email) {
      throw new UnauthorizedException("Сессия недействительна");
    }

    const url = this.config.get<string>("SUPABASE_URL") || this.config.getOrThrow<string>("NEXT_PUBLIC_SUPABASE_URL");
    const anon =
      this.config.get<string>("SUPABASE_ANON_KEY") || this.config.getOrThrow<string>("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const probe = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: loginError } = await probe.auth.signInWithPassword({
      email: data.user.email,
      password: parsed.data.currentPassword,
    });
    if (loginError) {
      throw new BadRequestException("Текущий пароль неверный");
    }

    const token = await this.issueToken({
      userId: data.user.id,
      purpose: "password_change",
      hours: 1,
      payload: { password: parsed.data.password },
    });
    const confirmUrl = `${this.appUrl()}/confirm-password?token=${token}`;
    const { data: profile } = await this.supabase.admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.user.id)
      .maybeSingle();

    const mailed = await this.mail.sendChangePasswordEmail({
      to: data.user.email,
      name: profile?.full_name ?? "",
      confirmUrl,
    });

    return {
      ok: true,
      mocked: mailed.mocked,
      confirmUrl: mailed.mocked ? mailed.confirmUrl : undefined,
    };
  }

  async confirmPasswordChange(token?: string) {
    const row = await this.consumeToken(token ?? "", "password_change");
    const password = row.payload?.password;
    if (!password) {
      throw new BadRequestException("В ссылке нет нового пароля. Запросите смену ещё раз.");
    }
    const { error } = await this.supabase.admin.auth.admin.updateUserById(row.user_id, { password });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return { ok: true };
  }
}

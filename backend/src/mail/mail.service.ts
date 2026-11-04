import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { ChangePasswordEmail } from "./change-password-email";
import { ConfirmEmail } from "./confirm-email";
import { ResetPasswordEmail } from "./reset-password-email";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private resendKey() {
    return this.config.get<string>("RESEND_API_KEY")?.trim() || "";
  }

  private smtpConfigured() {
    return Boolean(this.config.get("SMTP_HOST") && this.config.get("SMTP_USER") && this.config.get("SMTP_PASS"));
  }

  private isConfigured() {
    return Boolean(this.resendKey() || this.smtpConfigured());
  }

  private transporter(port: number, secure: boolean) {
    return nodemailer.createTransport({
      host: this.config.get<string>("SMTP_HOST"),
      port,
      secure,
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
      auth: {
        user: this.config.get<string>("SMTP_USER"),
        pass: this.config.get<string>("SMTP_PASS"),
      },
    });
  }

  private async sendViaResend(input: { to: string; subject: string; html: string }) {
    const from =
      this.config.get<string>("RESEND_FROM")?.trim() || "СтройCRM <onboarding@resend.dev>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.resendKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend ${response.status}: ${body}`);
    }
  }

  private async send(input: { to: string; subject: string; html: string; urlForMock: string }) {
    if (!this.isConfigured()) {
      this.logger.warn(`SMTP is not configured. URL: ${input.urlForMock}`);
      return { mocked: true as const, confirmUrl: input.urlForMock };
    }

    if (this.smtpConfigured()) {
      const configuredPort = Number(this.config.get("SMTP_PORT") || 587);
      const attempts = [
        { port: configuredPort, secure: this.config.get("SMTP_SECURE") === "true" || configuredPort === 465 },
        { port: 465, secure: true },
      ].filter(
        (attempt, index, list) =>
          list.findIndex((item) => item.port === attempt.port && item.secure === attempt.secure) === index,
      );

      const mail = {
        from: this.config.get("SMTP_FROM") || this.config.get("SMTP_USER"),
        to: input.to,
        subject: input.subject,
        html: input.html,
      };

      for (const attempt of attempts) {
        try {
          await this.transporter(attempt.port, attempt.secure).sendMail(mail);
          return { mocked: false as const };
        } catch (error) {
          this.logger.warn(
            `SMTP ${attempt.port}/${attempt.secure ? "ssl" : "starttls"} failed: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }

    if (this.resendKey()) {
      await this.sendViaResend(input);
      return { mocked: false as const };
    }

    throw new Error("Не удалось отправить письмо. Проверьте SMTP на сервере.");
  }

  async sendConfirmationEmail(input: { to: string; name: string; confirmUrl: string }) {
    const html = await render(ConfirmEmail({ name: input.name, confirmUrl: input.confirmUrl }));
    return this.send({
      to: input.to,
      subject: "Подтвердите почту — СтройCRM",
      html,
      urlForMock: input.confirmUrl,
    });
  }

  async sendResetPasswordEmail(input: { to: string; name: string; resetUrl: string }) {
    const html = await render(ResetPasswordEmail({ name: input.name, resetUrl: input.resetUrl }));
    return this.send({
      to: input.to,
      subject: "Сброс пароля — СтройCRM",
      html,
      urlForMock: input.resetUrl,
    });
  }

  async sendChangePasswordEmail(input: { to: string; name: string; confirmUrl: string }) {
    const html = await render(ChangePasswordEmail({ name: input.name, confirmUrl: input.confirmUrl }));
    return this.send({
      to: input.to,
      subject: "Подтвердите смену пароля — СтройCRM",
      html,
      urlForMock: input.confirmUrl,
    });
  }
}

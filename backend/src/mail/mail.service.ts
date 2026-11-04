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

  private isConfigured() {
    return Boolean(this.config.get("SMTP_HOST") && this.config.get("SMTP_USER") && this.config.get("SMTP_PASS"));
  }

  private async send(input: { to: string; subject: string; html: string; urlForMock: string }) {
    if (!this.isConfigured()) {
      this.logger.warn(`SMTP is not configured. URL: ${input.urlForMock}`);
      return { mocked: true as const, confirmUrl: input.urlForMock };
    }

    const transporter = nodemailer.createTransport({
      host: this.config.get<string>("SMTP_HOST"),
      port: Number(this.config.get("SMTP_PORT") || 587),
      secure: this.config.get("SMTP_SECURE") === "true",
      auth: {
        user: this.config.get<string>("SMTP_USER"),
        pass: this.config.get<string>("SMTP_PASS"),
      },
    });

    await transporter.sendMail({
      from: this.config.get("SMTP_FROM") || this.config.get("SMTP_USER"),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    return { mocked: false as const };
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

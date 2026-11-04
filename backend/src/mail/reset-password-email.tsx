import { Text } from "@react-email/components";
import { EmailShell, emailText } from "./email-shell";

export function ResetPasswordEmail({ name, resetUrl }: { name: string; resetUrl: string }) {
  return (
    <EmailShell
      preview="Сброс пароля в СтройCRM"
      title={`Здравствуйте${name ? `, ${name}` : ""}!`}
      actionUrl={resetUrl}
      actionLabel="Задать новый пароль"
      footer="Ссылка действует 1 час. Если вы не просили сброс пароля, просто проигнорируйте письмо."
    >
      <Text style={emailText}>
        Мы получили запрос на восстановление пароля. Нажмите кнопку, чтобы задать новый пароль для
        входа в СтройCRM.
      </Text>
    </EmailShell>
  );
}

export default ResetPasswordEmail;

import { Text } from "@react-email/components";
import { EmailShell, emailText } from "./email-shell";

export function ChangePasswordEmail({ name, confirmUrl }: { name: string; confirmUrl: string }) {
  return (
    <EmailShell
      preview="Подтвердите смену пароля в СтройCRM"
      title={`Здравствуйте${name ? `, ${name}` : ""}!`}
      actionUrl={confirmUrl}
      actionLabel="Подтвердить смену пароля"
      footer="Ссылка действует 1 час. Если вы не меняли пароль, проигнорируйте письмо — текущий пароль останется."
    >
      <Text style={emailText}>
        Вы запросили смену пароля в СтройCRM. Чтобы новый пароль вступил в силу, подтвердите действие
        по ссылке.
      </Text>
    </EmailShell>
  );
}

export default ChangePasswordEmail;

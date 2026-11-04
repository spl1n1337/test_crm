import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotForm } from "@/components/auth/forgot-form";

export default function ForgotPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Восстановление пароля</CardTitle>
        <CardDescription>Пришлём ссылку на почту, если такой аккаунт есть</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotForm />
      </CardContent>
    </Card>
  );
}

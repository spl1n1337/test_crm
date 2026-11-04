import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetForm } from "@/components/auth/reset-form";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый пароль</CardTitle>
        <CardDescription>Придумайте пароль после перехода из письма</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ResetForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}

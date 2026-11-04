import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUser } from "@/lib/require-user";

export default async function ProfilePage() {
  const { profile } = await requireUser();
  return (
    <>
      <PageHeader title="Профиль" description="Имя, телефон и фото. Роль меняет только администратор." />
      <ProfileForm profile={profile} />
    </>
  );
}

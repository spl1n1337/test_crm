import { PageHeader } from "@/components/layout/page-header";
import { ObjectForm } from "@/components/objects/object-form";
import { requireStaff } from "@/lib/require-user";

export default async function NewObjectPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Новый объект" description="Название и адрес стройки" />
      <ObjectForm />
    </>
  );
}

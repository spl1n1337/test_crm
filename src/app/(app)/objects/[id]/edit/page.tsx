import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ObjectForm } from "@/components/objects/object-form";
import { requireStaff } from "@/lib/require-user";
import type { ConstructionObject } from "@/lib/types";

export default async function EditObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("objects").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <PageHeader title="Редактирование объекта" />
      <ObjectForm object={data as ConstructionObject} />
    </>
  );
}

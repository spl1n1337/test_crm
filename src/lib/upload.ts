import { createClient } from "@/lib/supabase/client";

export async function uploadImage(file: File, kind: "avatars" | "tasks") {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Сессия истекла");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);

  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });

  const raw = await response.text();
  let payload: {
    error?: string;
    url?: string;
    key?: string;
    fileName?: string;
    contentType?: string;
    sizeBytes?: number;
    message?: string;
  } = {};
  try {
    payload = raw ? (JSON.parse(raw) as typeof payload) : {};
  } catch {
    throw new Error("Не удалось загрузить файл");
  }

  if (!response.ok || !payload.url || !payload.key) {
    throw new Error(payload.error || payload.message || "Не удалось загрузить файл");
  }

  return {
    url: payload.url,
    key: payload.key,
    fileName: payload.fileName || file.name,
    contentType: payload.contentType || file.type,
    sizeBytes: payload.sizeBytes || file.size,
  };
}

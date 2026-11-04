import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(__dirname, "../.env") });
loadEnv({ path: resolve(__dirname, "../.env.local") });
loadEnv({ path: resolve(__dirname, "../../.env") });
loadEnv({ path: resolve(__dirname, "../../.env.local") });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "assigner" | "executor";
  phone: string;
};

export const SEED_USERS: SeedUser[] = [
  {
    email: "admin@stroycrm.test",
    password: "Admin12345",
    fullName: "Анна Админова",
    role: "admin",
    phone: "+7 900 111-11-11",
  },
  {
    email: "assigner@stroycrm.test",
    password: "Assigner12345",
    fullName: "Павел Постановщик",
    role: "assigner",
    phone: "+7 900 222-22-22",
  },
  {
    email: "executor1@stroycrm.test",
    password: "Executor12345",
    fullName: "Егор Исполнителев",
    role: "executor",
    phone: "+7 900 333-33-33",
  },
  {
    email: "executor2@stroycrm.test",
    password: "Executor12345",
    fullName: "Ирина Прораб",
    role: "executor",
    phone: "+7 900 444-44-44",
  },
];

async function upsertUser(user: SeedUser) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find((item) => item.email === user.email);

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });
    await admin
      .from("profiles")
      .update({
        full_name: user.fullName,
        role: user.role,
        requested_role: user.role,
        is_approved: true,
        is_blocked: false,
        phone: user.phone,
        email: user.email,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });
  if (error || !data.user) {
    throw error ?? new Error(`Failed to create ${user.email}`);
  }

  await admin
    .from("profiles")
    .update({
      full_name: user.fullName,
      role: user.role,
      requested_role: user.role,
      is_approved: true,
      is_blocked: false,
      phone: user.phone,
      email: user.email,
    })
    .eq("id", data.user.id);

  return data.user.id;
}

async function main() {
  console.log("Seeding users…");
  const ids: Record<string, string> = {};
  for (const user of SEED_USERS) {
    ids[user.email] = await upsertUser(user);
    console.log(`  ${user.role.padEnd(9)} ${user.email}`);
  }

  const assignerId = ids["assigner@stroycrm.test"]!;
  const exec1 = ids["executor1@stroycrm.test"]!;
  const exec2 = ids["executor2@stroycrm.test"]!;

  const { data: oldObjects } = await admin.from("objects").select("id").in("name", [
    "ЖК Солнечный, корпус 3",
    "Школа на Набережной",
    "Складской комплекс Восток",
  ]);
  if (oldObjects?.length) {
    const oldIds = oldObjects.map((row) => row.id);
    const { data: oldTasks } = await admin.from("tasks").select("id").in("object_id", oldIds);
    if (oldTasks?.length) {
      await admin.rpc("seed_cleanup_history", { p_task_ids: oldTasks.map((row) => row.id) });
      await admin.from("tasks").delete().in("id", oldTasks.map((row) => row.id));
    }
    await admin.from("objects").delete().in("id", oldIds);
  }

  const { data: insertedObjects, error: objectError } = await admin
    .from("objects")
    .insert([
      { name: "ЖК Солнечный, корпус 3", address: "Москва, ул. Строителей, 10", created_by: assignerId },
      { name: "Школа на Набережной", address: "Казань, ул. Набережная, 5", created_by: assignerId },
      { name: "Складской комплекс Восток", address: "Подольск, Промышленный пр-д, 2", created_by: assignerId },
    ])
    .select("id, name");

  if (objectError || !insertedObjects) {
    throw objectError ?? new Error("Failed to insert objects");
  }

  const byName = Object.fromEntries(insertedObjects.map((row) => [row.name, row.id]));
  const hours = (value: number) => new Date(Date.now() + value * 3600_000).toISOString();

  const { error: taskError } = await admin.from("tasks").insert([
    {
      title: "Принять арматуру 5 этажа",
      description: "Сверить партии с накладными и зафиксировать фото.",
      object_id: byName["ЖК Солнечный, корпус 3"],
      assignee_id: exec1,
      author_id: assignerId,
      status: "new",
      deadline: hours(4),
    },
    {
      title: "Проверить опалубку лифтовой шахты",
      description: "Осмотреть крепления, доложить о люфтах.",
      object_id: byName["ЖК Солнечный, корпус 3"],
      assignee_id: exec1,
      author_id: assignerId,
      status: "in_progress",
      deadline: hours(1),
    },
    {
      title: "Сдать акт скрытых работ по гидроизоляции",
      description: "Комплект фото и подписи субподрядчика.",
      object_id: byName["Школа на Набережной"],
      assignee_id: exec2,
      author_id: assignerId,
      status: "review",
      deadline: hours(8),
    },
    {
      title: "Убрать строительный мусор с кровли",
      description: "Площадка сдана, задача принята.",
      object_id: byName["Школа на Набережной"],
      assignee_id: exec2,
      author_id: assignerId,
      status: "accepted",
      deadline: hours(-20),
    },
    {
      title: "Переложить маяки в санузлах 2 этажа",
      description: "Вернули на доработку: маяки стоят с отклонением.",
      object_id: byName["Складской комплекс Восток"],
      assignee_id: exec1,
      author_id: assignerId,
      status: "rework",
      deadline: hours(12),
    },
    {
      title: "Заказать доставку бетона на пятницу",
      description: "Согласовать окно с прорабом. Дедлайн близко.",
      object_id: byName["Складской комплекс Восток"],
      assignee_id: exec2,
      author_id: assignerId,
      status: "new",
      deadline: hours(0.2),
    },
  ]);

  if (taskError) {
    throw taskError;
  }

  console.log("Seed complete.");
  console.log("Logins:");
  for (const user of SEED_USERS) {
    console.log(`  ${user.email} / ${user.password}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

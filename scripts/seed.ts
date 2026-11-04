import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "assigner" | "executor";
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env.local`);
  return value;
}

async function upsertUser(
  admin: SupabaseClient,
  user: SeedUser,
) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let existing = list.users.find((item) => item.email === user.email);

  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    existing = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });
    if (error) throw error;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      is_blocked: false,
    })
    .eq("id", existing.id);
  if (profileError) throw profileError;

  return existing;
}

async function asUser(email: string, password: string) {
  const client = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function main() {
  const admin = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users: SeedUser[] = [
    {
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@stroycrm.local",
      password: process.env.SEED_ADMIN_PASSWORD ?? "Admin12345",
      fullName: "Анна Админова",
      role: "admin",
    },
    {
      email: process.env.SEED_ASSIGNER_EMAIL ?? "assigner@stroycrm.local",
      password: process.env.SEED_ASSIGNER_PASSWORD ?? "Assigner123",
      fullName: "Пётр Постановщик",
      role: "assigner",
    },
    {
      email: process.env.SEED_EXECUTOR1_EMAIL ?? "executor1@stroycrm.local",
      password: process.env.SEED_EXECUTOR1_PASSWORD ?? "Executor123",
      fullName: "Иван Исполнителев",
      role: "executor",
    },
    {
      email: process.env.SEED_EXECUTOR2_EMAIL ?? "executor2@stroycrm.local",
      password: process.env.SEED_EXECUTOR2_PASSWORD ?? "Executor123",
      fullName: "Ольга Прораб",
      role: "executor",
    },
  ];

  const created = [];
  for (const user of users) {
    created.push(await upsertUser(admin, user));
  }
  const [, assigner, executor1, executor2] = created;
  if (!assigner || !executor1 || !executor2) throw new Error("Users were not created");

  await admin.from("objects").delete().neq("name", "__keep_none__");

  const { data: objects, error: objectError } = await admin
    .from("objects")
    .insert([
      {
        name: "ЖК Северный",
        address: "Москва, ул. Лесная, 12",
        created_by: assigner.id,
      },
      {
        name: "Школа на Набережной",
        address: "Санкт-Петербург, Набережная, 5",
        created_by: assigner.id,
      },
      {
        name: "Складской комплекс",
        address: "Подольск, Промышленная, 8",
        created_by: assigner.id,
      },
    ])
    .select("id, name");
  if (objectError || !objects) throw objectError ?? new Error("objects insert failed");

  const [siteA, siteB, siteC] = objects;
  const soon = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tasks, error: taskError } = await admin
    .from("tasks")
    .insert([
      {
        title: "Проверить опалубку 3 этажа",
        description: "Сверить геометрию и крепление щитов перед заливкой.",
        object_id: siteA!.id,
        assignee_id: executor1.id,
        author_id: assigner.id,
        status: "new",
        deadline: later,
      },
      {
        title: "Принять скрытые работы по электрике",
        description: "Фотофиксация и акт скрытых работ.",
        object_id: siteA!.id,
        assignee_id: executor1.id,
        author_id: assigner.id,
        status: "new",
        deadline: soon,
      },
      {
        title: "Разметить оси на 1 этаже",
        description: "Вынести оси по проекту АР.",
        object_id: siteB!.id,
        assignee_id: executor2.id,
        author_id: assigner.id,
        status: "new",
        deadline: later,
      },
      {
        title: "Убрать строительный мусор с площадки",
        description: "Контейнер у ворот, фото до/после.",
        object_id: siteB!.id,
        assignee_id: executor2.id,
        author_id: assigner.id,
        status: "new",
        deadline: later,
      },
      {
        title: "Проверить ограждение котлована",
        description: "Поручни и сигнальная лента по периметру.",
        object_id: siteC!.id,
        assignee_id: executor1.id,
        author_id: assigner.id,
        status: "new",
        deadline: later,
      },
    ])
    .select("id, title");
  if (taskError || !tasks) throw taskError ?? new Error("tasks insert failed");

  const executorClient = await asUser(users[2]!.email, users[2]!.password);
  const executor2Client = await asUser(users[3]!.email, users[3]!.password);
  const assignerClient = await asUser(users[1]!.email, users[1]!.password);

  // tasks[1] → in_progress
  await executorClient.rpc("transition_task_status", {
    p_task_id: tasks[1]!.id,
    p_to_status: "in_progress",
  });
  // tasks[2] → review
  await executor2Client.rpc("transition_task_status", {
    p_task_id: tasks[2]!.id,
    p_to_status: "in_progress",
  });
  await executor2Client.rpc("transition_task_status", {
    p_task_id: tasks[2]!.id,
    p_to_status: "review",
  });
  // tasks[3] → accepted
  await executor2Client.rpc("transition_task_status", {
    p_task_id: tasks[3]!.id,
    p_to_status: "in_progress",
  });
  await executor2Client.rpc("transition_task_status", {
    p_task_id: tasks[3]!.id,
    p_to_status: "review",
  });
  await assignerClient.rpc("transition_task_status", {
    p_task_id: tasks[3]!.id,
    p_to_status: "accepted",
  });
  // tasks[4] → rework
  await executorClient.rpc("transition_task_status", {
    p_task_id: tasks[4]!.id,
    p_to_status: "in_progress",
  });
  await executorClient.rpc("transition_task_status", {
    p_task_id: tasks[4]!.id,
    p_to_status: "review",
  });
  await assignerClient.rpc("transition_task_status", {
    p_task_id: tasks[4]!.id,
    p_to_status: "rework",
    p_comment: "Нет фото ограждения с северной стороны — доделайте.",
  });

  console.log("Seed complete.");
  console.log("Accounts:");
  for (const user of users) {
    console.log(`  ${user.role.padEnd(9)}  ${user.email}  /  ${user.password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

-- Mini-CRM «Объекты и задачи»
-- Schema, status machine, history, RLS.
-- Run this in the Supabase SQL editor (or via supabase db push).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'assigner', 'executor');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_type as enum (
    'status_change',
    'new_task',
    'deadline_soon',
    'deadline_expired'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  role public.user_role not null default 'executor',
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_len check (char_length(full_name) <= 120),
  constraint profiles_phone_len check (char_length(phone) <= 32)
);

create table if not exists public.email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint objects_name_len check (char_length(trim(name)) between 2 and 120),
  constraint objects_address_len check (char_length(trim(address)) between 5 and 300)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id uuid not null references public.profiles (id),
  author_id uuid not null references public.profiles (id),
  status public.task_status not null default 'new',
  deadline timestamptz,
  deadline_soon_notified boolean not null default false,
  deadline_expired_notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_len check (char_length(trim(title)) between 2 and 160),
  constraint tasks_description_len check (char_length(description) <= 4000)
);

create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,
  to_status public.task_status not null,
  changed_by uuid not null references public.profiles (id),
  comment text,
  created_at timestamptz not null default now(),
  constraint history_comment_len check (comment is null or char_length(comment) <= 1000)
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  file_key text not null,
  file_url text not null,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  task_id uuid references public.tasks (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists objects_created_by_idx on public.objects (created_by);
create index if not exists tasks_object_id_idx on public.tasks (object_id);
create index if not exists tasks_assignee_id_idx on public.tasks (assignee_id);
create index if not exists tasks_author_id_idx on public.tasks (author_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_deadline_idx on public.tasks (deadline);
create index if not exists history_task_id_idx on public.task_status_history (task_id, created_at);
create index if not exists attachments_task_id_idx on public.task_attachments (task_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index if not exists email_tokens_user_id_idx on public.email_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists objects_set_updated_at on public.objects;
create trigger objects_set_updated_at
before update on public.objects
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create a profile for every new user.
-- Role is ALWAYS executor here. Elevating a role is an admin-only RPC.
-- This blocks privilege escalation via user_metadata on signup.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'executor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Current user helpers (used by RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.is_blocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_blocked from public.profiles where id = auth.uid()), true);
$$;

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('admin', 'assigner') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_see_object(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_staff()
    or exists (
      select 1 from public.tasks t
      where t.object_id = p_object_id
        and t.assignee_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- Status labels (for notifications)
-- ---------------------------------------------------------------------------
create or replace function public.status_label(p_status public.task_status)
returns text
language sql
immutable
as $$
  select case p_status
    when 'new' then 'Новая'
    when 'in_progress' then 'В работе'
    when 'review' then 'На проверке'
    when 'accepted' then 'Принята'
    when 'rework' then 'На доработке'
    else p_status::text
  end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications helper
-- ---------------------------------------------------------------------------
create or replace function public.push_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, task_id)
  values (p_user_id, p_type, p_title, p_body, p_task_id);
end;
$$;

create or replace function public.notify_assigners(
  p_actor uuid,
  p_title text,
  p_body text,
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.profiles
    where role in ('admin', 'assigner')
      and is_blocked = false
      and id is distinct from p_actor
  loop
    perform public.push_notification(r.id, 'status_change', p_title, p_body, p_task_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Task created: history row + notify executor
-- ---------------------------------------------------------------------------
create or replace function public.on_task_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.writing_history', '1', true);
  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (new.id, null, new.status, new.author_id, null);
  perform set_config('app.writing_history', '', true);

  if new.assignee_id is distinct from new.author_id then
    perform public.push_notification(
      new.assignee_id,
      'new_task',
      'Новая задача',
      format('Вам назначена задача «%s».', new.title),
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_on_insert on public.tasks;
create trigger tasks_on_insert
after insert on public.tasks
for each row execute function public.on_task_inserted();

-- Reassign → notify the new executor
create or replace function public.on_task_assignee_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is distinct from old.assignee_id then
    perform public.push_notification(
      new.assignee_id,
      'new_task',
      'Новая задача',
      format('Вам назначена задача «%s».', new.title),
      new.id
    );
    new.deadline_soon_notified := false;
    new.deadline_expired_notified := false;
  end if;
  if new.deadline is distinct from old.deadline then
    new.deadline_soon_notified := false;
    new.deadline_expired_notified := false;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_on_assignee_change on public.tasks;
create trigger tasks_on_assignee_change
before update on public.tasks
for each row execute function public.on_task_assignee_changed();

-- History is append-only: updates are always rejected.
-- Deletes are not granted to authenticated (see GRANTs below). Task/object
-- removal goes through staff_delete_* security definer functions.
create or replace function public.forbid_history_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Историю статусов нельзя изменять';
end;
$$;

drop trigger if exists history_no_update on public.task_status_history;
create trigger history_no_update
before update on public.task_status_history
for each row execute function public.forbid_history_update();

create or replace function public.forbid_history_forge()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.writing_history', true), '') <> '1' then
    raise exception 'Историю статусов нельзя подделать';
  end if;
  return new;
end;
$$;

drop trigger if exists history_no_forge on public.task_status_history;
create trigger history_no_forge
before insert on public.task_status_history
for each row execute function public.forbid_history_forge();

create or replace function public.forbid_history_delete()
returns trigger
language plpgsql
as $$
begin
  -- Direct API deletes are blocked. Task/object removal may clear history
  -- only from staff_delete_* after setting this transaction-local flag.
  if coalesce(current_setting('app.allow_history_delete', true), '') <> '1' then
    raise exception 'Историю статусов нельзя удалять';
  end if;
  return old;
end;
$$;

drop trigger if exists history_no_delete on public.task_status_history;
create trigger history_no_delete
before delete on public.task_status_history
for each row execute function public.forbid_history_delete();

create or replace function public.ensure_assignee_is_executor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = new.assignee_id;
  if v_role is null or v_role <> 'executor' then
    raise exception 'Исполнителем можно назначить только пользователя с ролью «исполнитель»';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_assignee_role on public.tasks;
create trigger tasks_assignee_role
before insert or update of assignee_id on public.tasks
for each row execute function public.ensure_assignee_is_executor();

-- Direct status updates from clients are forbidden. Only transition_task_status
-- (security definer) may change status, via a transaction-local flag.
create or replace function public.protect_task_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.allow_status_change', true), '') <> '1' then
    raise exception 'Статус задачи можно менять только через разрешённый переход';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_protect_status on public.tasks;
create trigger tasks_protect_status
before update on public.tasks
for each row execute function public.protect_task_status();

-- ---------------------------------------------------------------------------
-- Allowed status transitions (source of truth)
-- ---------------------------------------------------------------------------
create or replace function public.transition_task_status(
  p_task_id uuid,
  p_to_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_task public.tasks;
  v_from public.task_status;
  v_allowed boolean := false;
  v_comment text;
begin
  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.id is null then
    raise exception 'Необходима авторизация';
  end if;
  if v_profile.is_blocked then
    raise exception 'Аккаунт заблокирован';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception 'Задача не найдена';
  end if;

  -- Visibility: executor may only touch their own tasks
  if v_profile.role = 'executor' and v_task.assignee_id <> auth.uid() then
    raise exception 'Недостаточно прав';
  end if;

  v_from := v_task.status;
  v_comment := nullif(trim(coalesce(p_comment, '')), '');

  -- Executor (assigned) transitions
  if v_task.assignee_id = auth.uid() then
    if v_from = 'new' and p_to_status = 'in_progress' then
      v_allowed := true;
    elsif v_from = 'in_progress' and p_to_status = 'review' then
      v_allowed := true;
    elsif v_from = 'rework' and p_to_status = 'in_progress' then
      v_allowed := true;
    end if;
  end if;

  -- Assigner / admin transitions
  if v_profile.role in ('admin', 'assigner') then
    if v_from = 'review' and p_to_status = 'accepted' then
      v_allowed := true;
    elsif v_from = 'review' and p_to_status = 'rework' then
      if v_comment is null or char_length(v_comment) < 3 then
        raise exception 'Комментарий обязателен при возврате на доработку';
      end if;
      v_allowed := true;
    end if;
  end if;

  if not v_allowed then
    raise exception 'Переход статуса запрещён';
  end if;

  perform set_config('app.allow_status_change', '1', true);

  update public.tasks
  set status = p_to_status
  where id = p_task_id
  returning * into v_task;

  perform set_config('app.writing_history', '1', true);
  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_from, p_to_status, auth.uid(), v_comment);
  perform set_config('app.writing_history', '', true);

  -- Notify assigners about every status change (except the actor)
  perform public.notify_assigners(
    auth.uid(),
    'Изменение статуса задачи',
    format('Задача «%s»: %s → %s', v_task.title, public.status_label(v_from), public.status_label(p_to_status)),
    v_task.id
  );

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deadline notifications (called from /api/cron/deadlines with service role)
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_deadline_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select t.*
    from public.tasks t
    where t.deadline is not null
      and t.status <> 'accepted'
  loop
    -- 15 minutes before
    if r.deadline > now()
       and r.deadline <= now() + interval '15 minutes'
       and r.deadline_soon_notified = false then
      perform public.push_notification(
        r.assignee_id, 'deadline_soon',
        'Дедлайн через 15 минут',
        format('До срока задачи «%s» осталось меньше 15 минут.', r.title),
        r.id
      );
      if r.author_id is distinct from r.assignee_id then
        perform public.push_notification(
          r.author_id, 'deadline_soon',
          'Дедлайн через 15 минут',
          format('До срока задачи «%s» осталось меньше 15 минут.', r.title),
          r.id
        );
      end if;
      update public.tasks set deadline_soon_notified = true where id = r.id;
      n := n + 1;
    end if;

    if r.deadline <= now() and r.deadline_expired_notified = false then
      perform public.push_notification(
        r.assignee_id, 'deadline_expired',
        'Срок задачи истёк',
        format('Время на выполнение задачи «%s» истекло.', r.title),
        r.id
      );
      if r.author_id is distinct from r.assignee_id then
        perform public.push_notification(
          r.author_id, 'deadline_expired',
          'Срок задачи истёк',
          format('Время на выполнение задачи «%s» истекло.', r.title),
          r.id
        );
      end if;
      update public.tasks set deadline_expired_notified = true where id = r.id;
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_blocked(p_user_id uuid, p_blocked boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Только администратор';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Нельзя заблокировать самого себя';
  end if;

  update public.profiles
  set is_blocked = p_blocked
  where id = p_user_id
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Пользователь не найден';
  end if;
  return v_profile;
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Только администратор';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Нельзя сменить собственную роль';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Пользователь не найден';
  end if;
  return v_profile;
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any (p_ids));
$$;

create or replace function public.staff_delete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked() or not public.is_staff() then
    raise exception 'Недостаточно прав';
  end if;
  perform set_config('app.allow_history_delete', '1', true);
  delete from public.task_status_history where task_id = p_task_id;
  perform set_config('app.allow_history_delete', '', true);
  delete from public.tasks where id = p_task_id;
end;
$$;

create or replace function public.staff_delete_object(p_object_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked() or not public.is_staff() then
    raise exception 'Недостаточно прав';
  end if;
  perform set_config('app.allow_history_delete', '1', true);
  delete from public.task_status_history
  where task_id in (select id from public.tasks where object_id = p_object_id);
  perform set_config('app.allow_history_delete', '', true);
  delete from public.objects where id = p_object_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.email_tokens enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;
alter table public.task_attachments enable row level security;
alter table public.notifications enable row level security;

-- email_tokens: no policies → only service_role (bypasses RLS)
-- Force RLS so even the table owner via PostgREST cannot read tokens
alter table public.email_tokens force row level security;

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  not public.is_blocked()
  and (
    id = auth.uid()
    or public.is_staff()
    or exists (
      select 1 from public.tasks t
      where (t.assignee_id = profiles.id or t.author_id = profiles.id)
        and (t.assignee_id = auth.uid() or t.author_id = auth.uid())
    )
  )
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid() and not public.is_blocked())
with check (
  id = auth.uid()
  and not public.is_blocked()
  and role = (public.current_profile()).role
  and is_blocked = (public.current_profile()).is_blocked
);

-- Objects
drop policy if exists objects_select on public.objects;
create policy objects_select on public.objects
for select to authenticated
using (not public.is_blocked() and public.can_see_object(id));

drop policy if exists objects_insert on public.objects;
create policy objects_insert on public.objects
for insert to authenticated
with check (not public.is_blocked() and public.is_staff() and created_by = auth.uid());

drop policy if exists objects_update on public.objects;
create policy objects_update on public.objects
for update to authenticated
using (not public.is_blocked() and public.is_staff())
with check (not public.is_blocked() and public.is_staff());

drop policy if exists objects_delete on public.objects;
create policy objects_delete on public.objects
for delete to authenticated
using (not public.is_blocked() and public.is_staff());

-- Tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
for select to authenticated
using (
  not public.is_blocked()
  and (public.is_staff() or assignee_id = auth.uid())
);

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
for insert to authenticated
with check (
  not public.is_blocked()
  and public.is_staff()
  and author_id = auth.uid()
  and status = 'new'
);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
for update to authenticated
using (not public.is_blocked() and public.is_staff())
with check (not public.is_blocked() and public.is_staff());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
for delete to authenticated
using (not public.is_blocked() and public.is_staff());

-- History: readable if the task is readable. No insert/update/delete policies.
drop policy if exists history_select on public.task_status_history;
create policy history_select on public.task_status_history
for select to authenticated
using (
  not public.is_blocked()
  and exists (
    select 1 from public.tasks t
    where t.id = task_status_history.task_id
      and (public.is_staff() or t.assignee_id = auth.uid())
  )
);

-- Attachments
drop policy if exists attachments_select on public.task_attachments;
create policy attachments_select on public.task_attachments
for select to authenticated
using (
  not public.is_blocked()
  and exists (
    select 1 from public.tasks t
    where t.id = task_attachments.task_id
      and (public.is_staff() or t.assignee_id = auth.uid())
  )
);

drop policy if exists attachments_insert on public.task_attachments;
create policy attachments_insert on public.task_attachments
for insert to authenticated
with check (
  not public.is_blocked()
  and uploaded_by = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_attachments.task_id
      and (
        public.is_staff()
        or (t.assignee_id = auth.uid() and t.status in ('new', 'in_progress', 'rework'))
      )
  )
);

drop policy if exists attachments_delete on public.task_attachments;
create policy attachments_delete on public.task_attachments
for delete to authenticated
using (
  not public.is_blocked()
  and (uploaded_by = auth.uid() or public.is_staff())
);

-- Notifications
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated
using (not public.is_blocked() and user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants: lock down history and status
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.email_tokens from anon, authenticated;
revoke all on table public.objects from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.task_status_history from anon, authenticated;
revoke all on table public.task_attachments from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.objects to authenticated;
grant select, insert, delete on table public.tasks to authenticated;
-- status / notification flags are not in the column grant → cannot be patched via API
grant update (
  object_id, title, description, assignee_id, deadline, updated_at
) on table public.tasks to authenticated;
grant select on table public.task_status_history to authenticated;
grant select, insert, delete on table public.task_attachments to authenticated;
grant select, update on table public.notifications to authenticated;

revoke all on function public.transition_task_status(uuid, public.task_status, text) from public;
grant execute on function public.transition_task_status(uuid, public.task_status, text) to authenticated;

revoke all on function public.admin_set_blocked(uuid, boolean) from public;
grant execute on function public.admin_set_blocked(uuid, boolean) to authenticated;

revoke all on function public.admin_set_role(uuid, public.user_role) from public;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;

revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

revoke all on function public.staff_delete_task(uuid) from public;
grant execute on function public.staff_delete_task(uuid) to authenticated;

revoke all on function public.staff_delete_object(uuid) from public;
grant execute on function public.staff_delete_object(uuid) to authenticated;

revoke all on function public.dispatch_deadline_notifications() from public;
-- only service_role (bypasses) and postgres should call this

create or replace function public.seed_cleanup_history(p_task_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.allow_history_delete', '1', true);
  delete from public.task_status_history where task_id = any (p_task_ids);
  perform set_config('app.allow_history_delete', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime (WebSocket)
-- ---------------------------------------------------------------------------
alter table public.notifications replica identity full;
alter table public.tasks replica identity full;
alter table public.objects replica identity full;
alter table public.profiles replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.objects;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
end $$;

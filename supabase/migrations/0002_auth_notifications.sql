-- Approval flow, richer notifications, email token purposes.

alter table public.profiles
  add column if not exists requested_role public.user_role not null default 'executor';

alter table public.profiles
  add column if not exists is_approved boolean not null default false;

alter table public.email_tokens
  add column if not exists purpose text not null default 'email_confirm';

alter table public.email_tokens
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.notifications
  add column if not exists object_id uuid references public.objects (id) on delete cascade;

create index if not exists notifications_object_id_idx on public.notifications (object_id);

do $$ begin
  alter type public.notification_type add value if not exists 'registration';
exception when duplicate_object then null;
end $$;

alter table public.email_tokens drop constraint if exists email_tokens_purpose_check;
alter table public.email_tokens
  add constraint email_tokens_purpose_check
  check (purpose in ('email_confirm', 'password_reset', 'password_change'));

-- Existing seeded / already-created users stay usable.
update public.profiles
set is_approved = true,
    requested_role = role;

create or replace function public.role_label(p_role public.user_role)
returns text
language sql
immutable
as $$
  select case p_role
    when 'admin' then 'Администратор'
    when 'assigner' then 'Постановщик'
    when 'executor' then 'Исполнитель'
    else p_role::text
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested public.user_role := 'executor';
begin
  if coalesce(new.raw_user_meta_data->>'requested_role', '') in ('executor', 'assigner') then
    v_requested := (new.raw_user_meta_data->>'requested_role')::public.user_role;
  end if;

  insert into public.profiles (id, email, full_name, role, requested_role, is_approved)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'executor',
    v_requested,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_approved from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_see_object(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_approved()
    and (
      public.is_staff()
      or exists (
        select 1 from public.tasks t
        where t.object_id = p_object_id
          and t.assignee_id = auth.uid()
      )
    );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role in ('admin', 'assigner') and is_approved
    from public.profiles
    where id = auth.uid()
  ), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role = 'admin' and is_approved
    from public.profiles
    where id = auth.uid()
  ), false);
$$;

drop function if exists public.push_notification(uuid, public.notification_type, text, text, uuid);

create or replace function public.push_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_task_id uuid default null,
  p_object_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_object_id uuid := p_object_id;
  v_object_name text;
begin
  if p_user_id is null then
    return;
  end if;

  if v_object_id is null and p_task_id is not null then
    select object_id into v_object_id from public.tasks where id = p_task_id;
  end if;

  if v_object_id is not null then
    select name into v_object_name from public.objects where id = v_object_id;
    if v_object_name is not null and position('Объект:' in p_body) = 0 then
      p_body := trim(p_body) || format(' Объект: «%s».', v_object_name);
    end if;
  end if;

  insert into public.notifications (user_id, type, title, body, task_id, object_id)
  values (p_user_id, p_type, p_title, p_body, p_task_id, v_object_id);
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
  v_object_id uuid;
begin
  select object_id into v_object_id from public.tasks where id = p_task_id;
  for r in
    select id from public.profiles
    where role in ('admin', 'assigner')
      and is_blocked = false
      and is_approved = true
      and id is distinct from p_actor
  loop
    perform public.push_notification(r.id, 'status_change', p_title, p_body, p_task_id, v_object_id);
  end loop;
end;
$$;

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
      new.id,
      new.object_id
    );
  end if;

  return new;
end;
$$;

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
      new.id,
      new.object_id
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
    if r.deadline > now()
       and r.deadline <= now() + interval '15 minutes'
       and r.deadline_soon_notified = false then
      perform public.push_notification(
        r.assignee_id, 'deadline_soon',
        'Дедлайн через 15 минут',
        format('До срока задачи «%s» осталось меньше 15 минут.', r.title),
        r.id,
        r.object_id
      );
      if r.author_id is distinct from r.assignee_id then
        perform public.push_notification(
          r.author_id, 'deadline_soon',
          'Дедлайн через 15 минут',
          format('До срока задачи «%s» осталось меньше 15 минут.', r.title),
          r.id,
          r.object_id
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
        r.id,
        r.object_id
      );
      if r.author_id is distinct from r.assignee_id then
        perform public.push_notification(
          r.author_id, 'deadline_expired',
          'Срок задачи истёк',
          format('Время на выполнение задачи «%s» истекло.', r.title),
          r.id,
          r.object_id
        );
      end if;
      update public.tasks set deadline_expired_notified = true where id = r.id;
      n := n + 1;
    end if;
  end loop;

  return n;
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
  set role = p_role,
      requested_role = p_role,
      is_approved = true
  where id = p_user_id
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Пользователь не найден';
  end if;
  return v_profile;
end;
$$;

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid() and not public.is_blocked())
with check (
  id = auth.uid()
  and not public.is_blocked()
  and role = (public.current_profile()).role
  and is_blocked = (public.current_profile()).is_blocked
  and is_approved = (public.current_profile()).is_approved
  and requested_role = (public.current_profile()).requested_role
);

revoke all on function public.push_notification(uuid, public.notification_type, text, text, uuid, uuid) from public;
grant execute on function public.push_notification(uuid, public.notification_type, text, text, uuid, uuid) to authenticated;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
for select to authenticated
using (
  public.is_approved()
  and not public.is_blocked()
  and (public.is_staff() or assignee_id = auth.uid())
);

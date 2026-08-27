create table if not exists public.class_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.class_role_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.class_roles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, role_id, student_id)
);

insert into public.class_roles (user_id,name,sort_order)
select u.id,v.name,v.sort_order from auth.users u cross join (values
  ('中文',1),('數學',2),('英文',3),('地理',4),('歷史',5),('綜合科學',6),
  ('公民',7),('音樂',8),('體育',9),('清紀',10),('壁報',11),('電器',12)
) as v(name,sort_order)
on conflict (user_id,name) do nothing;

create index if not exists idx_class_roles_user_order on public.class_roles(user_id,sort_order);
create index if not exists idx_class_role_members_user_role on public.class_role_members(user_id,role_id);

alter table public.class_roles enable row level security;
alter table public.class_role_members enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.class_roles, public.class_role_members to authenticated;
revoke all on table public.class_roles, public.class_role_members from anon;

do $$ declare t text; begin
  foreach t in array array['class_roles','class_role_members'] loop
    execute format('drop policy if exists owner_select on public.%I',t);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_insert on public.%I',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_update on public.%I',t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_delete on public.%I',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',t);
  end loop;
end $$;

create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  student_no integer not null, name text not null, guardian_name text not null default '', guardian_phone text not null default '',
  tags text[] not null default '{}', notes text not null default '', archived boolean not null default false, created_at timestamptz not null default now(),
  unique(user_id, student_no)
);
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, date date not null,
  status text not null check(status in ('present','late','personal','sick','absent')), notes text not null default '', updated_at timestamptz not null default now(),
  unique(user_id, student_id, date)
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, due_at timestamp not null, priority text not null default 'normal' check(priority in ('low','normal','high')),
  completed boolean not null default false, student_id uuid references public.students(id) on delete set null, category text not null default '班級事務', created_at timestamptz not null default now()
);
create table if not exists public.schedule (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  weekday integer not null check(weekday between 1 and 7), period integer not null, start_time time not null, subject text not null, location text not null default '',
  unique(user_id, weekday, period)
);
create table if not exists public.student_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, record_date date not null, record_type text not null,
  content text not null, follow_up_date date, created_at timestamptz not null default now()
);
create table if not exists public.class_settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  class_name text not null default '我的班級', school_year text not null default '', semester text not null default '', teacher_name text not null default '老師'
);
create table if not exists public.seating_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null default current_date, layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), check (jsonb_typeof(layout) = 'array')
);

create index if not exists idx_attendance_user_date on public.attendance(user_id,date);
create index if not exists idx_tasks_user_due on public.tasks(user_id,due_at) where completed=false;
create index if not exists idx_records_user_followup on public.student_records(user_id,follow_up_date) where follow_up_date is not null;
create index if not exists idx_schedule_user_weekday on public.schedule(user_id,weekday,period);
create index if not exists idx_seating_user_created on public.seating_plans(user_id,created_at desc);

alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.tasks enable row level security;
alter table public.schedule enable row level security;
alter table public.student_records enable row level security;
alter table public.class_settings enable row level security;
alter table public.seating_plans enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.students,
  public.attendance,
  public.tasks,
  public.schedule,
  public.student_records,
  public.class_settings,
  public.seating_plans
to authenticated;

revoke all on table
  public.students,
  public.attendance,
  public.tasks,
  public.schedule,
  public.student_records,
  public.class_settings,
  public.seating_plans
from anon;

do $$ declare t text; begin
  foreach t in array array['students','attendance','tasks','schedule','student_records','class_settings','seating_plans'] loop
    execute format('drop policy if exists owner_select on public.%I',t); execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_insert on public.%I',t); execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_update on public.%I',t); execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_delete on public.%I',t); execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',t);
  end loop;
end $$;

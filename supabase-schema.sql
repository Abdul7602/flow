-- ═══════════════════════════════════════════════════
-- FLOW — Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════

-- NOTES table
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default '',
  body text default '',
  pinned boolean default false,
  archived boolean default false,
  priority text default 'normal' check (priority in ('normal','priority','urgent')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TASKS table
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.notes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  date date,
  time time,
  done boolean default false,
  manual boolean default false,
  priority text default 'normal' check (priority in ('normal','priority','urgent')),
  foreign_time time,
  foreign_tz text,
  foreign_city text,
  address text,
  address_display text,
  address_detail text,
  venue text,
  created_at timestamptz default now()
);

-- SETTINGS table (one row per user)
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  review_time time default '22:00',
  timezone text default 'Europe/Helsinki',
  daily_reset_date date,
  review_shown_date date,
  first_open timestamptz default now()
);

-- ═══ ROW LEVEL SECURITY ═══
-- Each user can only ever see and modify their own data

alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.settings enable row level security;

-- Notes policies
create policy "Users can view own notes"
  on public.notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes"
  on public.notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes"
  on public.notes for update using (auth.uid() = user_id);
create policy "Users can delete own notes"
  on public.notes for delete using (auth.uid() = user_id);

-- Tasks policies
create policy "Users can view own tasks"
  on public.tasks for select using (auth.uid() = user_id);
create policy "Users can insert own tasks"
  on public.tasks for insert with check (auth.uid() = user_id);
create policy "Users can update own tasks"
  on public.tasks for update using (auth.uid() = user_id);
create policy "Users can delete own tasks"
  on public.tasks for delete using (auth.uid() = user_id);

-- Settings policies
create policy "Users can view own settings"
  on public.settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings"
  on public.settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on public.settings for update using (auth.uid() = user_id);

-- ═══ INDEXES for fast queries ═══
create index idx_notes_user on public.notes(user_id);
create index idx_tasks_user on public.tasks(user_id);
create index idx_tasks_note on public.tasks(note_id);
create index idx_tasks_date on public.tasks(user_id, date);

-- ═══ AUTO-UPDATE updated_at on notes ═══
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.handle_updated_at();

-- ═══ AUTO-CREATE settings row when user signs up ═══
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

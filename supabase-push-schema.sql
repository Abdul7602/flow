-- Push notifications — run in Supabase SQL Editor

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  subscription jsonb not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- guard against duplicate daily sends
alter table public.settings add column if not exists last_push_date date;

-- Pocket Advisor cloud schema. Run this once in your Supabase project's
-- SQL editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- The whole app stores its data as a single JSON snapshot per user, protected
-- by row-level security so each account can only ever read/write its own row.

create table if not exists public.snapshots (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;

-- A user may only touch their own snapshot.
drop policy if exists "own snapshot select" on public.snapshots;
create policy "own snapshot select" on public.snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "own snapshot upsert" on public.snapshots;
create policy "own snapshot upsert" on public.snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists "own snapshot update" on public.snapshots;
create policy "own snapshot update" on public.snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

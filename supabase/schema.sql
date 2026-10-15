-- Run once in the Supabase SQL editor for optional Atlas cloud backup.
create table if not exists public.atlas_trips (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.atlas_trips enable row level security;

create policy "Owners can read their Atlas trips"
  on public.atlas_trips for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can add Atlas trips"
  on public.atlas_trips for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners can update their Atlas trips"
  on public.atlas_trips for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners can delete their Atlas trips"
  on public.atlas_trips for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists atlas_trips_user_updated
  on public.atlas_trips (user_id, updated_at desc);

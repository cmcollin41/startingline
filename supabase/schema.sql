-- Run this in the Supabase SQL editor (or via supabase db push).

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- The app only talks to Supabase from the server with the service role key,
-- so lock the table down for anon/authenticated clients entirely.
alter table public.signups enable row level security;

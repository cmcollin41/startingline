-- Run this in the Supabase SQL editor (or via supabase db push).

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now(),
  -- Weekly lotto: the ticket dealt on page load, locked in at signup. The
  -- winning number is derived server-side from a keyed hash, never stored.
  ticket_number smallint,
  ticket_week text,
  is_winner boolean not null default false,
  win_week text,
  -- Set on first click of the emailed confirmation link; a win only counts
  -- once the address is confirmed.
  verified_at timestamptz
);

-- The app only talks to Supabase from the server with the service role key,
-- so lock the table down for anon/authenticated clients entirely.
alter table public.signups enable row level security;

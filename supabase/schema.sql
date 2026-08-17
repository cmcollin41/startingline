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
  verified_at timestamptz,
  -- Referral loop: this signup's share code, and who invited them.
  ref_code text unique,
  referred_by uuid references public.signups (id),
  -- 'admin' unlocks the /admin dashboard; everyone else is 'user'.
  role text not null default 'user' check (role in ('user', 'admin'))
);

-- Bonus tickets earned by inviting friends: one per invitee who signs up and
-- confirms their email (referred_signup_id is globally unique).
create table if not exists public.bonus_tickets (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.signups (id) on delete cascade,
  referred_signup_id uuid not null unique references public.signups (id) on delete cascade,
  ticket_number smallint not null,
  ticket_week text not null,
  is_winner boolean not null default false,
  created_at timestamptz not null default now()
);

-- A signup can opt into any number of school digest lists (school identity
-- comes from the sportsmarks.com API).
create table if not exists public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.signups (id) on delete cascade,
  school_slug text not null,
  school_name text not null,
  created_at timestamptz not null default now(),
  unique (signup_id, school_slug)
);

-- The app only talks to Supabase from the server with the service role key,
-- so lock the tables down for anon/authenticated clients entirely.
alter table public.signups enable row level security;
-- One row per (school, week) digest send — the unique pair is the idempotency
-- lock against double-sending.
create table if not exists public.digest_sends (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null,
  school_name text not null,
  week text not null,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (school_slug, week)
);

-- Stories each digest edition covered — read back by the AI editor so later
-- editions don't repeat news.
create table if not exists public.digest_stories (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null,
  week text not null,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

-- Digest engagement, recorded by our own tracking pixel and click redirect.
create table if not exists public.digest_opens (
  id uuid primary key default gen_random_uuid(),
  digest_send_id uuid not null references public.digest_sends (id) on delete cascade,
  signup_id uuid not null references public.signups (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (digest_send_id, signup_id)
);

create table if not exists public.digest_clicks (
  id uuid primary key default gen_random_uuid(),
  digest_send_id uuid not null references public.digest_sends (id) on delete cascade,
  signup_id uuid not null references public.signups (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.school_subscriptions enable row level security;
alter table public.bonus_tickets enable row level security;
alter table public.digest_sends enable row level security;
alter table public.digest_stories enable row level security;
alter table public.digest_opens enable row level security;
alter table public.digest_clicks enable row level security;

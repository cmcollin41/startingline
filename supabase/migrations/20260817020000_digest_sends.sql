-- One row per (school, week) digest send — the unique constraint is the
-- idempotency lock, so a cron retry or a manual admin trigger can never
-- double-send the same week's digest to a list.

create table if not exists public.digest_sends (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null,
  school_name text not null,
  week text not null,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (school_slug, week)
);

alter table public.digest_sends enable row level security;

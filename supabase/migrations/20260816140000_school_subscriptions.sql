-- A signup can opt into any number of school digest lists. School identity
-- comes from the sportsmarks.com API; the name is denormalized so the admin
-- view doesn't need an API call per row.

create table if not exists public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.signups (id) on delete cascade,
  school_slug text not null,
  school_name text not null,
  created_at timestamptz not null default now(),
  unique (signup_id, school_slug)
);

alter table public.school_subscriptions enable row level security;

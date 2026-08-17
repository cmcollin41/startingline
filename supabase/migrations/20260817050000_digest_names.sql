-- Each school's digest masthead — an original, newspapery name evoking the
-- school's mascot/culture without using the institution's licensed name.
-- Generated once and stored so the masthead is stable week to week.

create table if not exists public.digest_names (
  school_slug text primary key,
  school_name text not null,
  digest_name text not null,
  created_at timestamptz not null default now()
);

alter table public.digest_names enable row level security;

-- Every story a digest actually covered, per school and week. The AI editor
-- reads recent rows to avoid repeating a story in later weeks unless there's
-- a genuine new development.

create table if not exists public.digest_stories (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null,
  week text not null,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists digest_stories_school_created_idx
  on public.digest_stories (school_slug, created_at desc);

alter table public.digest_stories enable row level security;

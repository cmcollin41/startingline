-- Digest engagement analytics, recorded by our own tracking pixel and click
-- redirect (no third-party configuration). One open row per recipient per
-- send; every click keeps its target URL.

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

alter table public.digest_opens enable row level security;
alter table public.digest_clicks enable row level security;

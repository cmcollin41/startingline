-- Results are revealed on-site via a signed confirmation link emailed at
-- signup. verified_at records the first click — a winner isn't confirmed
-- until they've proven they control the inbox.

alter table public.signups
  add column if not exists verified_at timestamptz;

-- Referral loop: every confirmed signup gets a share code; each invited
-- person who signs up AND confirms their email earns the referrer one bonus
-- ticket. The unique referred_signup_id means an invitee can only ever grant
-- one bonus ticket, no matter how many times their link is clicked.

alter table public.signups
  add column if not exists ref_code text unique,
  add column if not exists referred_by uuid references public.signups (id);

create table if not exists public.bonus_tickets (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.signups (id) on delete cascade,
  referred_signup_id uuid not null unique references public.signups (id) on delete cascade,
  ticket_number smallint not null,
  ticket_week text not null,
  is_winner boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bonus_tickets enable row level security;

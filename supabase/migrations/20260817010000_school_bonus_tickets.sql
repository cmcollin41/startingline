-- Bonus tickets can now come from two places: inviting a friend (referral) or
-- coming back to opt into another school's digest. referred_signup_id becomes
-- nullable; school-sourced tickets record the school instead, unique per
-- (signup, school) so re-adding the same school can't farm tickets.

alter table public.bonus_tickets
  alter column referred_signup_id drop not null;

alter table public.bonus_tickets
  add column if not exists source text not null default 'referral',
  add column if not exists school_slug text;

create unique index if not exists bonus_tickets_signup_school_key
  on public.bonus_tickets (signup_id, school_slug)
  where school_slug is not null;

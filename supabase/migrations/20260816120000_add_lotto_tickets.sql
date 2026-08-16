-- Weekly lotto tickets: every signup locks in the ticket shown on their page
-- load. A signup wins if its ticket matches that week's secret number (derived
-- server-side from a keyed hash, so there is nothing to store or leak here).

alter table public.signups
  add column if not exists ticket_number smallint,
  add column if not exists ticket_week text,
  add column if not exists is_winner boolean not null default false,
  add column if not exists win_week text;

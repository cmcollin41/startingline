-- Normal vs admin users: a role on the signup itself. The /admin dashboard
-- is gated on role = 'admin' instead of the old shared ADMIN_PASSWORD login.
alter table public.signups
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

# Decision log

## Planned vs shipped

Planned: Next.js + Tailwind + shadcn/ui frontend, Supabase for storage, Resend
for email, deployed on Vercel — the core requirements plus simple admin
authentication from the bonus list.

Shipped exactly that:

- Public waitlist page (name + email) with client + server validation (zod),
  duplicate-email handling, and loading/success/error states.
- Supabase Postgres `signups` table with a unique constraint on email.
- Password-protected `/admin` view (HMAC session cookie, timing-safe compare)
  listing signups newest-first with a live count.
- "Send test email" button that sends a real email via the official Resend SDK,
  including the current signup count in the body.

Key choices:

- **Server actions over API routes** — less plumbing, typed end-to-end, and the
  form works with progressive enhancement.
- **Service-role Supabase client, server-only** — the browser never gets a
  Supabase key. RLS is enabled with no policies as a belt-and-suspenders lock.
- **Env-var password + HMAC cookie instead of a full auth provider** — the
  brief needs "only you can see the admin view"; Supabase Auth would be more
  moving parts than the requirement justifies in a 3–5 hour window.
- **Duplicate signups return a friendly "you're already on the list"** rather
  than an error — a real waitlist shouldn't punish enthusiasm.

## Where I got stuck / how I got unstuck

- The shadcn CLI's newer versions are interactive-first; non-interactive init
  needed the right combination of `-b radix -p nova` flags, found via
  `--help` rather than guessing.
- Resend's free tier without a verified domain only sends from
  `onboarding@resend.dev` to the account owner's email. Rather than fight it,
  the sender/recipient are env vars (`RESEND_FROM`, `TEST_EMAIL_TO`) with
  sensible defaults, so it works on the free tier and upgrades cleanly with a
  verified domain.

## What I'd improve with more time

- Resend webhooks (delivered/bounced) stored per-signup and shown as status
  badges in the admin table.
- Multi-tenancy: a `waitlists` table, per-waitlist slugs and admin scoping.
- Rate limiting on the join endpoint (e.g. Upstash free tier) to deter abuse.
- Email confirmation (double opt-in) for signups instead of trusting the input.
- Tests around the server actions (validation, duplicate handling, auth).

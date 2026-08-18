# startingline

The weekly digest for alumni: pick your school, and every Monday an
AI-edited email covers all things your alma mater — sports, campus, and
everything in between — in a 2–3 minute read. Signing up deals you a raffle
ticket; match the weekly number and win a $100 Woodn Grail (woodngrail.com)
gift card. Inviting friends or following more schools earns bonus tickets.

**Live:** https://startingline.vercel.app · admin at
[/admin](https://startingline.vercel.app/admin) (admin accounts only)

## Tools

- **[Next.js](https://nextjs.org) (App Router)** — the whole app: server
  components for every page, server actions for every mutation (no hand-rolled
  API layer), and a handful of route handlers for email-clickable links
  (login, verify, unsubscribe, open/click tracking).
- **[Supabase](https://supabase.com)** — Postgres for all data: signups,
  school subscriptions, raffle/bonus tickets, digest editions and their
  stories, and open/click analytics. Access is server-side only via the
  service-role key (RLS stays on as a second lock; the browser never talks to
  Supabase). It also backs auth: user records and roles live in the `signups`
  table, and sessions are passwordless — clicking any emailed link proves
  control of the inbox and sets an HMAC-signed cookie. Admins are just users
  with `role = 'admin'`.
- **[Vercel](https://vercel.com)** — hosting and the platform glue: cron
  triggers the Monday digest run, and the [Workflow
  DevKit](https://useworkflow.dev) runs digest generation as a durable
  background workflow (one retryable step per school) so no request ever
  waits on the multi-minute AI pass.
- **[Tailwind CSS](https://tailwindcss.com)** — all styling, including the
  lotto-ticket component (container queries so tickets scale to their column,
  a CSS mask for the torn-stub edge).
- **[shadcn/ui](https://ui.shadcn.com)** — the component layer: cards,
  tables, tabs (the account dashboard's tabs are real routes), dialogs,
  toasts, carousel (the mobile ticket deck).
- **[Resend](https://resend.com)** — every email: confirmations, digests,
  winner/referral notices, batched 100 at a time.
- **[Anthropic API](https://docs.anthropic.com)** — the digest editor: turns
  a week of Google News headlines into a five-story edition with summaries,
  skipping stories covered in past weeks.

## How it works

- `/` — landing page. Every load deals a fresh signed ticket; opting in locks
  it to your email and sends a confirmation link.
- `/verify` — the emailed reveal: confirms the address, shows torn tickets
  with match/no-match stamps, and surfaces your referral link.
- `/account` — passwordless dashboard (tabs are real routes): overview with
  referral link and school subscriptions, your ticket collection, and a
  readable web archive of every digest sent to your schools.
- `/admin` — role-gated: winning number, per-school digest stats (logo,
  subscribers, last edition performance), per-school or all-pending digest
  sends (queued as background workflows), per-subscriber digest resend, and
  the signup list with referral attribution.
- `/api/digest` — Monday 14:00 UTC cron; queues the digest workflow for every
  school with confirmed subscribers that hasn't received this week's edition.

## Local setup

1. **Supabase**: create a project, run `supabase/schema.sql` (or
   `supabase db push` with the CLI) against it.
2. **Resend**: create an API key. Without a verified domain you can only send
   from `onboarding@resend.dev` to your own account email.
3. **Anthropic**: an API key for the digest editor (optional — without it,
   digests fall back to raw headlines).
4. Copy the env file and fill it in: `cp .env.example .env.local`
5. `npm install && npm run dev`

## Deploy (Vercel)

Import the repo, add the env vars from `.env.example`, deploy. Cron and the
digest workflow are picked up automatically from `vercel.json` and the
`workflow/next` build plugin.

## Decision log

**What was planned vs what shipped.** The plan was a simple waitlist: a
name-and-email form, a Supabase table, a password-protected admin list, and a
Resend test-email button. That shipped early — and then the product grew into
what's live now: school-specific AI-edited weekly digests with a web archive,
a raffle loop (signed per-request tickets, bonus tickets for referrals and
extra schools, torn-stub ticket art), passwordless accounts with a tabbed
dashboard, role-based admin (replacing the shared password), per-school
digest stats and resends, and digest generation moved into durable background
workflows.

**Where I got stuck and how I got unstuck.** The admin "send digest" button
hung for minutes — the AI research pass ran inside a server action; fixed by
splitting the run into `listPendingSchools` + `sendSchoolDigest` and
orchestrating them with the Workflow DevKit, so the action just enqueues and
returns. Digest emails once embedded `localhost` links — the site origin was
derived from the triggering request's headers; fixed with a canonical
`SITE_URL`/`VERCEL_PROJECT_PRODUCTION_URL` origin, keeping the header
fallback for dev only. Wiping test data stranded valid session cookies in an
infinite `/signin ↔ /account` redirect loop — sessions are now verified
against the database, and stale cookies get cleared through a dedicated
`/api/logout` route because server-component renders can't mutate cookies.
Earlier: the shadcn CLI's interactive-first init needed the right
non-interactive flags (found via `--help`), and Resend's free-tier
sender/recipient limits were absorbed into env vars rather than fought.

**What I'd improve with more time.** Store the AI-written intro with each
edition so resends and the web archive match the email exactly; give resends
their own tracking rows (today they reuse the original send's, so open rates
can exceed 100% and are capped in the UI); delivery/bounce webhooks from
Resend surfaced as status badges in admin; rate limiting on the join action;
tests around the server actions and the digest pipeline (validation,
duplicate handling, the idempotency lock); and a verified sending domain with
timezone-aware digest scheduling instead of a single UTC cron.

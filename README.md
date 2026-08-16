# startingline

A simple waitlist tool: a public page to join (name + email), an admin view of
signups, and a button that sends a real email through Resend.

**Stack:** Next.js (App Router) · Tailwind CSS · shadcn/ui · Supabase (Postgres) · Resend · Vercel

## How it works

- `/` — public waitlist form. Submits via a server action, validated with zod,
  stored in a Supabase `signups` table (unique on email, duplicates handled
  gracefully).
- `/admin` — password-protected admin view listing all signups, newest first,
  with a **Send test email** button that sends a real email through the Resend
  SDK to a configured test address.
- All database access happens server-side with the Supabase service role key;
  the browser never talks to Supabase directly, and RLS is enabled on the table
  as a second lock.

## Local setup

1. **Supabase**: create a free project, then run `supabase/schema.sql` in the
   SQL editor.
2. **Resend**: create a free account and an API key. Without a verified domain
   you can only send from `onboarding@resend.dev` to your own account email —
   that is fine for this app.
3. Copy the env file and fill it in:

   ```sh
   cp .env.example .env.local
   ```

4. Install and run:

   ```sh
   npm install
   npm run dev
   ```

Visit http://localhost:3000 (waitlist) and http://localhost:3000/admin
(admin — use `ADMIN_PASSWORD`).

## Deploy (Vercel)

1. Push this repo to GitHub and import it into Vercel.
2. Add the same environment variables from `.env.example` in the Vercel
   project settings.
3. Deploy. Everything runs comfortably within the Vercel, Supabase, and Resend
   free tiers.

## Decision log

See [DECISIONS.md](./DECISIONS.md).

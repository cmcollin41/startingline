import { createClient } from "@supabase/supabase-js";

export type Signup = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

// Server-only client. Uses the service role key so all reads/writes go
// through server actions — the browser never talks to Supabase directly.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

import { sendWeeklyDigest } from "@/lib/digest";
import { siteOrigin } from "@/lib/referrals";

// The editorial research pass takes minutes — use the full function window.
export const maxDuration = 300;

// Triggered by Vercel Cron (Mondays 14:00 UTC — see vercel.json), guarded by
// CRON_SECRET. Idempotent per (school, week), so retries are harmless.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await sendWeeklyDigest(await siteOrigin());
  return Response.json(result);
}

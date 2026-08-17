import { start } from "workflow/api";
import { listPendingSchools } from "@/lib/digest";
import { siteOrigin } from "@/lib/referrals";
import { digestRunWorkflow } from "@/workflows/digest";

// Triggered by Vercel Cron (Mondays 14:00 UTC — see vercel.json), guarded by
// CRON_SECRET. Queues the digest run as a background workflow — the
// research pass takes minutes per school. Idempotent per (school, week), so
// retries are harmless.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const pending = await listPendingSchools();
  if (pending.length === 0) {
    return Response.json({ queued: [] });
  }
  const run = await start(digestRunWorkflow, [
    pending.map(({ slug, name }) => ({ slug, name })),
    await siteOrigin(),
  ]);
  return Response.json({
    queued: pending.map((p) => p.name),
    runId: run.runId,
  });
}

import {
  sendSchoolDigest,
  type SchoolSendOutcome,
} from "@/lib/digest";

// One durable step per school: the multi-minute research/edit/send pass gets
// its own retryable unit, so one school failing doesn't take down the run.
async function sendOne(
  slug: string,
  name: string,
  origin: string
): Promise<SchoolSendOutcome> {
  "use step";
  return sendSchoolDigest(slug, name, origin);
}

// Background digest run. Callers decide which schools need an edition (via
// listPendingSchools) and enqueue them here; each school still re-checks the
// (school, week) lock, so double-queuing can't double-send.
export async function digestRunWorkflow(
  schools: { slug: string; name: string }[],
  origin: string
): Promise<SchoolSendOutcome[]> {
  "use workflow";
  const outcomes: SchoolSendOutcome[] = [];
  // Sequential on purpose — the editorial pass is Anthropic-API heavy, and
  // there's no deadline pressure in the background.
  for (const school of schools) {
    outcomes.push(await sendOne(school.slug, school.name, origin));
  }
  return outcomes;
}

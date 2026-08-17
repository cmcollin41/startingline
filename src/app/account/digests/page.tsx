import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Newspaper } from "lucide-react";
import { currentUserId } from "@/lib/user-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { formatWeek } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Digests tab: every edition that has gone out for the schools this account
// follows, newest first. Each one opens as a readable page.
export default async function AccountDigestsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin");

  const { data: subsData } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("school_slug, school_name")
    .eq("signup_id", userId)
    .order("created_at");
  const subs = subsData ?? [];

  const slugs = subs.map((s) => s.school_slug);
  const [{ data: sendsData }, { data: mastheadData }] = await Promise.all([
    slugs.length
      ? supabaseAdmin()
          .from("digest_sends")
          .select("id, school_slug, school_name, week, created_at")
          .in("school_slug", slugs)
          .order("week", { ascending: false })
          .order("school_name")
      : Promise.resolve({ data: [] }),
    slugs.length
      ? supabaseAdmin()
          .from("digest_names")
          .select("school_slug, digest_name")
          .in("school_slug", slugs)
      : Promise.resolve({ data: [] }),
  ]);
  const sends = sendsData ?? [];
  const mastheads = new Map(
    (mastheadData ?? []).map((m) => [m.school_slug, m.digest_name])
  );

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Weekly digests</h2>
        <p className="text-muted-foreground text-sm">
          Every edition we&apos;ve sent for your schools — tap one to read it.
        </p>
      </div>
      {sends.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Newspaper className="text-muted-foreground size-8" />
            <p className="text-sm font-medium">No digests yet</p>
            <p className="text-muted-foreground text-sm">
              {subs.length === 0
                ? "Follow a school on the Overview tab and its digest will land here every Monday."
                : "Your first edition goes out Monday — it'll show up here as soon as it's sent."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {sends.map((d) => (
            <li key={d.id}>
              <Link
                href={`/account/digests/${d.id}`}
                className="border-border hover:bg-muted/50 focus-visible:ring-ring/50 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors outline-none focus-visible:ring-[3px]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {mastheads.get(d.school_slug) ?? `${d.school_name} weekly`}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {d.school_name} · {formatWeek(d.week)}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { redirect } from "next/navigation";
import { Plus, UserPlus, X } from "lucide-react";
import { currentUserId } from "@/lib/user-auth";
import { ensureRefCode, siteOrigin } from "@/lib/referrals";
import { listSchools } from "@/lib/sportsmarks";
import { supabaseAdmin } from "@/lib/supabase";
import { ShareLink } from "@/components/share-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addSubscription, removeSubscription } from "./actions";

export const dynamic = "force-dynamic";

// Overview tab: the referral link front and center, then the school
// subscriptions. Tickets and past digests live on their own tabs.
export default async function AccountOverviewPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin");

  const { data: signup } = await supabaseAdmin()
    .from("signups")
    .select("id, ref_code")
    .eq("id", userId)
    .maybeSingle();
  if (!signup) redirect("/api/logout");

  const [{ data: subsData }, { count: bonusCount }, { data: inviteeData }, schools] =
    await Promise.all([
      supabaseAdmin()
        .from("school_subscriptions")
        .select("school_slug, school_name")
        .eq("signup_id", signup.id)
        .order("created_at"),
      supabaseAdmin()
        .from("bonus_tickets")
        .select("id", { count: "exact", head: true })
        .eq("signup_id", signup.id),
      supabaseAdmin()
        .from("signups")
        .select("id, name, verified_at")
        .eq("referred_by", signup.id)
        .order("created_at"),
      listSchools(),
    ]);
  const subs = subsData ?? [];
  const bonuses = bonusCount ?? 0;
  const invitees = (inviteeData ?? []).map((i) => ({
    id: i.id,
    firstName: i.name.trim().split(/\s+/)[0],
    confirmed: i.verified_at !== null,
  }));

  const { data: mastheadData } = await supabaseAdmin()
    .from("digest_names")
    .select("school_slug, digest_name")
    .in(
      "school_slug",
      subs.map((s) => s.school_slug)
    );
  const mastheads = new Map(
    (mastheadData ?? []).map((m) => [m.school_slug, m.digest_name])
  );

  const shareUrl = `${await siteOrigin()}/?ref=${await ensureRefCode(signup.id, signup.ref_code)}`;
  const subscribed = new Set(subs.map((s) => s.school_slug));
  const available = schools.filter((s) => !subscribed.has(s.slug));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Invite friends, earn tickets
          </CardTitle>
          <CardDescription>
            Every friend who joins with your link and confirms their email
            earns you another ticket in that week&apos;s draw.
            {bonuses > 0 &&
              ` You've earned ${bonuses} bonus ticket${bonuses === 1 ? "" : "s"} so far.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ShareLink url={shareUrl} />
          {invitees.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm">
              {invitees.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{i.firstName}</span>
                  <span
                    className={
                      i.confirmed
                        ? "text-primary text-xs"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {i.confirmed
                      ? "confirmed ✓ — ticket earned"
                      : "waiting on email confirmation"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your digests</CardTitle>
          <CardDescription>
            One subscription per school — every Monday, all things that school
            in your inbox. Each new school you follow deals you a fresh bonus
            ticket.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {subs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You&apos;re not following any schools yet — pick one below.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {subs.map((s) => (
                <li
                  key={s.school_slug}
                  className="flex items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span>
                    <span className="font-medium">{s.school_name}</span>
                    {mastheads.has(s.school_slug) && (
                      <span className="text-muted-foreground">
                        {" "}
                        — “{mastheads.get(s.school_slug)}”
                      </span>
                    )}
                  </span>
                  <form action={removeSubscription}>
                    <input type="hidden" name="school" value={s.school_slug} />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="submit"
                      aria-label={`Unsubscribe from ${s.school_name}`}
                    >
                      <X className="size-4" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {available.length > 0 && (
            <form action={addSubscription} className="flex items-center gap-2">
              <select
                name="school"
                required
                defaultValue=""
                className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
              >
                <option value="" disabled>
                  Add a school…
                </option>
                {available.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                    {s.conference ? ` (${s.conference})` : ""}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" className="shrink-0">
                <Plus className="size-4" />
                Follow
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

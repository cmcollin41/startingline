import { redirect } from "next/navigation";
import { LogOut, Plus, UserPlus, X } from "lucide-react";
import { currentUserId } from "@/lib/user-auth";
import { ensureRefCode, siteOrigin } from "@/lib/referrals";
import {
  getSchoolTheme,
  listSchools,
  type SchoolTheme,
} from "@/lib/sportsmarks";
import { supabaseAdmin } from "@/lib/supabase";
import { LottoTicket } from "@/components/lotto-ticket";
import { ShareLink } from "@/components/share-link";
import { TicketDeck, type DeckTicket } from "@/components/ticket-deck";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addSubscription, removeSubscription, signOut } from "./actions";

export const dynamic = "force-dynamic";

type TicketRow = {
  key: string;
  number: number;
  week: string;
  winner: boolean;
  label: string;
  themeSlug: string | null;
};

export default async function AccountPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin");

  const { data: signup } = await supabaseAdmin()
    .from("signups")
    .select(
      "id, name, email, ticket_number, ticket_week, is_winner, verified_at, ref_code"
    )
    .eq("id", userId)
    .maybeSingle();
  // Session cookie outlived the signup row (account deleted) — clear it via
  // the logout route, since a render can't mutate cookies itself.
  if (!signup) redirect("/api/logout");

  const [{ data: subsData }, { data: bonusData }, { data: inviteeData }, schools] =
    await Promise.all([
      supabaseAdmin()
        .from("school_subscriptions")
        .select("school_slug, school_name")
        .eq("signup_id", signup.id)
        .order("created_at"),
      supabaseAdmin()
        .from("bonus_tickets")
        .select("id, ticket_number, ticket_week, is_winner, source, school_slug")
        .eq("signup_id", signup.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin()
        .from("signups")
        .select("id, name, verified_at")
        .eq("referred_by", signup.id)
        .order("created_at"),
      listSchools(),
    ]);
  const subs = subsData ?? [];
  const bonuses = bonusData ?? [];
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
  const schoolNames = new Map(schools.map((s) => [s.slug, s.name]));

  // Every ticket wears the school it came from: school bonuses use their
  // source school, referral bonuses and the original entry use the account's
  // first-followed school. Newest first.
  const firstSlug = subs[0]?.school_slug ?? null;
  const tickets: TicketRow[] = [
    ...bonuses.map((b) => ({
      key: b.id,
      number: b.ticket_number,
      week: b.ticket_week,
      winner: b.is_winner,
      label:
        b.source === "school" && b.school_slug
          ? `Bonus — followed ${schoolNames.get(b.school_slug) ?? b.school_slug}`
          : "Bonus — invite confirmed",
      themeSlug: b.source === "school" && b.school_slug ? b.school_slug : firstSlug,
    })),
    ...(signup.ticket_number !== null
      ? [
          {
            key: "original",
            number: signup.ticket_number,
            week: signup.ticket_week ?? "",
            winner: signup.is_winner,
            label: "Original entry",
            themeSlug: firstSlug,
          },
        ]
      : []),
  ];

  const themeSlugs = [...new Set(tickets.map((t) => t.themeSlug).filter(Boolean))] as string[];
  const themes = new Map<string, SchoolTheme | null>(
    await Promise.all(
      themeSlugs.map(
        async (slug) => [slug, await getSchoolTheme(slug)] as const
      )
    )
  );

  const shareUrl = `${await siteOrigin()}/?ref=${await ensureRefCode(signup.id, signup.ref_code)}`;
  const subscribed = new Set(subs.map((s) => s.school_slug));
  const available = schools.filter((s) => !subscribed.has(s.slug));
  const wonAny = tickets.some((t) => t.winner);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hey, {signup.name.trim().split(/\s+/)[0]}
          </h1>
          <p className="text-muted-foreground text-sm">{signup.email}</p>
        </div>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Invite friends, earn tickets
          </CardTitle>
          <CardDescription>
            Every friend who joins with your link and confirms their email
            earns you another ticket in that week&apos;s draw.
            {bonuses.length > 0 &&
              ` You've earned ${bonuses.length} bonus ticket${bonuses.length === 1 ? "" : "s"} so far.`}
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

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">
            Your tickets{" "}
            <span className="text-muted-foreground text-sm font-normal">
              · newest first
            </span>
          </h2>
          {wonAny && <Badge>Winner · $100 Woodn Grail gift card</Badge>}
        </div>
        {/* mobile: swipeable deck — the top card cycles to the bottom of the pile */}
        <div className="sm:hidden">
          <TicketDeck
            tickets={tickets.map(
              (t): DeckTicket => ({
                key: t.key,
                number: t.number,
                week: t.week,
                winner: t.winner,
                label: t.label,
                theme: (t.themeSlug ? themes.get(t.themeSlug) : null) ?? null,
              })
            )}
          />
        </div>
        {/* desktop: the full spread */}
        <div className="hidden gap-x-6 gap-y-5 sm:grid sm:grid-cols-2">
          {tickets.map((t) => (
            <figure key={t.key} className="flex min-w-0 flex-col gap-1.5">
              <LottoTicket
                number={t.number}
                week={t.week}
                stamp={t.winner ? "winner" : "nomatch"}
                theme={t.themeSlug ? themes.get(t.themeSlug) : null}
                torn
                className="w-full"
              />
              <figcaption className="text-muted-foreground text-center text-xs">
                {t.label} · {t.week}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="text-muted-foreground text-center text-xs">
          A new winning number is drawn every Monday — earn more tickets by
          inviting friends or following another school.
        </p>
      </section>
    </main>
  );
}

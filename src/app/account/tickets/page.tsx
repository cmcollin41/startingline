import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/user-auth";
import { getSchoolTheme, listSchools, type SchoolTheme } from "@/lib/sportsmarks";
import { supabaseAdmin } from "@/lib/supabase";
import { LottoTicket } from "@/components/lotto-ticket";
import { TicketDeck, type DeckTicket } from "@/components/ticket-deck";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type TicketRow = {
  key: string;
  number: number;
  week: string;
  winner: boolean;
  label: string;
  themeSlug: string | null;
};

// Tickets tab: swipeable deck on mobile, the full spread on desktop.
export default async function AccountTicketsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin");

  const { data: signup } = await supabaseAdmin()
    .from("signups")
    .select("id, ticket_number, ticket_week, is_winner")
    .eq("id", userId)
    .maybeSingle();
  if (!signup) redirect("/api/logout");

  const [{ data: subsData }, { data: bonusData }, schools] = await Promise.all([
    supabaseAdmin()
      .from("school_subscriptions")
      .select("school_slug")
      .eq("signup_id", signup.id)
      .order("created_at"),
    supabaseAdmin()
      .from("bonus_tickets")
      .select("id, ticket_number, ticket_week, is_winner, source, school_slug")
      .eq("signup_id", signup.id)
      .order("created_at", { ascending: false }),
    listSchools(),
  ]);
  const subs = subsData ?? [];
  const bonuses = bonusData ?? [];
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
      themeSlugs.map(async (slug) => [slug, await getSchoolTheme(slug)] as const)
    )
  );
  const wonAny = tickets.some((t) => t.winner);

  return (
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
      {tickets.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No tickets yet — follow a school to get your first one.
        </p>
      ) : (
        <>
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
        </>
      )}
      <p className="text-muted-foreground text-center text-xs">
        A new winning number is drawn every Monday — earn more tickets by
        inviting friends or following another school.
      </p>
    </section>
  );
}

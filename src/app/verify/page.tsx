import Link from "next/link";
import { CircleX, PartyPopper, Ticket, UserPlus } from "lucide-react";
import { parseSignupToken } from "@/lib/lotto";
import {
  confirmSignup,
  ensureRefCode,
  siteOrigin,
} from "@/lib/referrals";
import { getSchoolTheme } from "@/lib/sportsmarks";
import { supabaseAdmin } from "@/lib/supabase";
import { LottoTicket, formatTicket } from "@/components/lotto-ticket";
import { ShareLink } from "@/components/share-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: PageProps<"/verify">) {
  const { token } = await searchParams;
  const id = typeof token === "string" ? parseSignupToken(token) : null;

  const { data: signup } = id
    ? await supabaseAdmin()
        .from("signups")
        .select(
          "id, name, ticket_number, ticket_week, is_winner, verified_at, ref_code, referred_by"
        )
        .eq("id", id)
        .maybeSingle()
    : { data: null };

  if (!signup || signup.ticket_number === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CircleX className="text-destructive size-10" />
            <p className="text-lg font-medium">This link isn&apos;t valid</p>
            <p className="text-muted-foreground text-sm">
              Check that you opened the exact link from your email — or grab a
              fresh ticket and join again.
            </p>
            <Button asChild className="mt-2">
              <Link href="/">Get a ticket</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // First click confirms the address (and triggers the inviter's bonus
  // ticket — signup alone isn't enough, so fake emails earn nothing).
  await confirmSignup(signup.id);

  // Dress the tickets in their first-picked school's colors.
  const { data: firstSub } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("school_slug")
    .eq("signup_id", signup.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const theme = firstSub ? await getSchoolTheme(firstSub.school_slug) : null;

  // Newest first — bonus tickets are always younger than the original entry,
  // so the signup ticket brings up the rear.
  const { data: bonusData } = await supabaseAdmin()
    .from("bonus_tickets")
    .select("id, ticket_number, ticket_week, is_winner")
    .eq("signup_id", signup.id)
    .order("created_at", { ascending: false });
  const bonuses = bonusData ?? [];

  const wonAny = signup.is_winner || bonuses.some((b) => b.is_winner);
  const shareUrl = `${await siteOrigin()}/?ref=${await ensureRefCode(signup.id, signup.ref_code)}`;

  // Who came in through this signup's link — first names only.
  const { data: inviteeData } = await supabaseAdmin()
    .from("signups")
    .select("id, name, verified_at")
    .eq("referred_by", signup.id)
    .order("created_at");
  const invitees = (inviteeData ?? []).map((i) => ({
    id: i.id,
    firstName: i.name.trim().split(/\s+/)[0],
    confirmed: i.verified_at !== null,
  }));

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Email confirmed, {signup.name} — here&apos;s how your{" "}
          {bonuses.length > 0 ? "tickets" : "ticket"} did
          {bonuses.length > 0 ? ", newest first" : ""}.
        </p>
      </div>

      <div className="flex w-full max-w-md min-w-0 flex-col items-center gap-6">
        {bonuses.map((b) => (
          <LottoTicket
            key={b.id}
            number={b.ticket_number}
            week={b.ticket_week}
            stamp={b.is_winner ? "winner" : "nomatch"}
            theme={theme}
            torn
            className="w-full"
          />
        ))}

        <LottoTicket
          number={signup.ticket_number}
          week={signup.ticket_week ?? ""}
          stamp={signup.is_winner ? "winner" : "nomatch"}
          theme={theme}
          torn
          className="w-full"
        />

        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {wonAny ? (
              <>
                <PartyPopper className="size-10 text-[#C13527]" />
                <p className="text-lg font-medium">
                  You have a match — a $100 Woodn Grail gift card is yours
                </p>
                <p className="text-muted-foreground text-sm">
                  Good at woodngrail.com. Your win is confirmed to this email
                  address — your gift card is on the way.
                </p>
              </>
            ) : (
              <>
                <Ticket className="text-primary size-10" />
                <p className="text-lg font-medium">
                  No match this week — but you&apos;re on the list
                </p>
                <p className="text-muted-foreground text-sm">
                  {bonuses.length > 0
                    ? `None of your ${bonuses.length + 1} tickets matched this time.`
                    : `Ticket № ${formatTicket(signup.ticket_number)} didn't match ${signup.ticket_week}'s number.`}{" "}
                  We&apos;ll email you the moment we open.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4" />
              Invite friends, earn tickets
            </CardTitle>
            <CardDescription>
              Every friend who joins with your link and confirms their email
              earns you another ticket in that week&apos;s draw — so does
              opting into another school.
              {bonuses.length > 0 &&
                ` You've earned ${bonuses.length} bonus ticket${bonuses.length === 1 ? "" : "s"} so far.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="self-center">
              <a href={`/api/login?token=${encodeURIComponent(String(token))}&next=%2Faccount`}>
                Manage my account
              </a>
            </Button>
            <ShareLink url={shareUrl} />
            {invitees.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-sm">
                {invitees.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2"
                  >
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
      </div>
    </main>
  );
}

import Link from "next/link";
import { CircleX, PartyPopper, Ticket, UserPlus } from "lucide-react";
import { parseSignupToken } from "@/lib/lotto";
import {
  ensureRefCode,
  grantReferralBonus,
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

  // First click confirms the address; later clicks just re-show the result.
  // Confirming is also the moment the person who invited them earns their
  // bonus ticket — signup alone isn't enough, so fake emails earn nothing.
  if (!signup.verified_at) {
    await supabaseAdmin()
      .from("signups")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", signup.id)
      .is("verified_at", null);
    if (signup.referred_by) {
      await grantReferralBonus(signup.referred_by, signup.id);
    }
  }

  // Dress the tickets in their first-picked school's colors.
  const { data: firstSub } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("school_slug")
    .eq("signup_id", signup.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const theme = firstSub ? await getSchoolTheme(firstSub.school_slug) : null;

  const { data: bonusData } = await supabaseAdmin()
    .from("bonus_tickets")
    .select("id, ticket_number, ticket_week, is_winner")
    .eq("signup_id", signup.id)
    .order("created_at");
  const bonuses = bonusData ?? [];

  const wonAny = signup.is_winner || bonuses.some((b) => b.is_winner);
  const shareUrl = `${await siteOrigin()}/?ref=${await ensureRefCode(signup.id, signup.ref_code)}`;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Email confirmed, {signup.name} — here&apos;s how your{" "}
          {bonuses.length > 0 ? "tickets" : "ticket"} did.
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <LottoTicket
          number={signup.ticket_number}
          week={signup.ticket_week ?? ""}
          stamp={signup.is_winner ? "winner" : "nomatch"}
          theme={theme}
          className="w-full"
        />

        {bonuses.map((b) => (
          <LottoTicket
            key={b.id}
            number={b.ticket_number}
            week={b.ticket_week}
            stamp={b.is_winner ? "winner" : "nomatch"}
            theme={theme}
            className="w-full"
          />
        ))}

        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {wonAny ? (
              <>
                <PartyPopper className="size-10 text-[#C13527]" />
                <p className="text-lg font-medium">
                  You have a match — a $100 gift card is yours
                </p>
                <p className="text-muted-foreground text-sm">
                  Good for officially licensed school gear from brands like
                  woodngrail.com. Your win is confirmed to this email address —
                  redemption details are on the way.
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
              earns you another ticket in that week&apos;s draw.
              {bonuses.length > 0 &&
                ` You've earned ${bonuses.length} so far.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShareLink url={shareUrl} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

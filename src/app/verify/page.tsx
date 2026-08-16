import Link from "next/link";
import { CircleX, PartyPopper, Ticket } from "lucide-react";
import { parseSignupToken } from "@/lib/lotto";
import { getSchoolTheme } from "@/lib/sportsmarks";
import { supabaseAdmin } from "@/lib/supabase";
import { LottoTicket, formatTicket } from "@/components/lotto-ticket";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: PageProps<"/verify">) {
  const { token } = await searchParams;
  const id = typeof token === "string" ? parseSignupToken(token) : null;

  const { data: signup } = id
    ? await supabaseAdmin()
        .from("signups")
        .select("id, name, ticket_number, ticket_week, is_winner, verified_at")
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
  if (!signup.verified_at) {
    await supabaseAdmin()
      .from("signups")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", signup.id)
      .is("verified_at", null);
  }

  // Dress the ticket in their first-picked school's colors.
  const { data: firstSub } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("school_slug")
    .eq("signup_id", signup.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const theme = firstSub ? await getSchoolTheme(firstSub.school_slug) : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Email confirmed, {signup.name} — here&apos;s how your ticket did.
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
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {signup.is_winner ? (
              <>
                <PartyPopper className="size-10 text-[#C13527]" />
                <p className="text-lg font-medium">
                  Ticket № {formatTicket(signup.ticket_number)} is a match —
                  $100 off is yours
                </p>
                <p className="text-muted-foreground text-sm">
                  Your win is confirmed to this email address. We&apos;ll send
                  redemption details with the opening announcement.
                </p>
              </>
            ) : (
              <>
                <Ticket className="text-primary size-10" />
                <p className="text-lg font-medium">
                  No match this week — but you&apos;re on the list
                </p>
                <p className="text-muted-foreground text-sm">
                  Ticket № {formatTicket(signup.ticket_number)} didn&apos;t
                  match {signup.ticket_week}&apos;s number. We&apos;ll email
                  you the moment we open.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

"use client";

import { useActionState } from "react";
import { Loader2, PartyPopper, Ticket } from "lucide-react";
import { joinWaitlist, type JoinResult } from "@/app/actions";
import { LottoTicket, formatTicket } from "@/components/lotto-ticket";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type IssuedTicket = { number: number; week: string; sig: string };

export function WaitlistForm({ ticket }: { ticket: IssuedTicket }) {
  const [result, formAction, pending] = useActionState<
    JoinResult | null,
    FormData
  >(joinWaitlist, null);

  const settled =
    result?.status === "success" || result?.status === "duplicate";

  if (settled) {
    const shownTicket = result.ticket;
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {shownTicket !== null && (
          <LottoTicket
            number={shownTicket}
            week={ticket.week}
            stamp={result.won ? "winner" : "nomatch"}
            className="w-full"
          />
        )}
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {result.won ? (
              <>
                <PartyPopper className="size-10 text-[#C13527]" />
                <p className="text-lg font-medium">
                  Ticket № {shownTicket !== null && formatTicket(shownTicket)}{" "}
                  is a match — $100 off is yours
                </p>
                <p className="text-muted-foreground text-sm">
                  We emailed you your claim. You&apos;ll get redemption details
                  with the opening announcement.
                </p>
              </>
            ) : (
              <>
                <Ticket className="text-primary size-10" />
                <p className="text-lg font-medium">
                  {result.status === "duplicate"
                    ? shownTicket === null
                      ? "You're already on the list!"
                      : `You're already in — ticket № ${formatTicket(shownTicket)} is your entry`
                    : "No match this week — but you're on the list"}
                </p>
                <p className="text-muted-foreground text-sm">
                  A new number is drawn every Monday. We&apos;ll email you the
                  moment we open.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <LottoTicket number={ticket.number} week={ticket.week} className="w-full" />

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Check your ticket</CardTitle>
          <CardDescription>
            Join the waitlist to see if № {formatTicket(ticket.number)} matches
            this week&apos;s winning number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="ticket" value={ticket.number} />
            <input type="hidden" name="week" value={ticket.week} />
            <input type="hidden" name="sig" value={ticket.sig} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ada Lovelace"
                required
                maxLength={100}
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ada@example.com"
                required
                maxLength={254}
                disabled={pending}
              />
            </div>
            {result?.status === "error" && (
              <Alert variant="destructive">
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Checking…" : "Join and check my ticket"}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              One ticket per email · winner gets $100 off when the store opens.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

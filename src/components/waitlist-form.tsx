"use client";

import { useActionState } from "react";
import { Loader2, MailCheck, MailWarning, Ticket } from "lucide-react";
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

  if (result?.status === "success") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <LottoTicket
          number={result.ticket}
          week={ticket.week}
          className="w-full"
        />
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {result.emailed ? (
              <>
                <MailCheck className="text-primary size-10" />
                <p className="text-lg font-medium">
                  Your result is in your inbox
                </p>
                <p className="text-muted-foreground text-sm">
                  We emailed you whether ticket №{" "}
                  {formatTicket(result.ticket)} matched this week&apos;s
                  number. Don&apos;t see it? Check spam.
                </p>
              </>
            ) : (
              <>
                <MailWarning className="text-destructive size-10" />
                <p className="text-lg font-medium">
                  We couldn&apos;t reach that inbox
                </p>
                <p className="text-muted-foreground text-sm">
                  You&apos;re on the list, but results only go out by email —
                  an address we can&apos;t deliver to can&apos;t win.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result?.status === "duplicate") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {result.ticket !== null && (
          <LottoTicket
            number={result.ticket}
            week={ticket.week}
            className="w-full"
          />
        )}
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Ticket className="text-primary size-10" />
            <p className="text-lg font-medium">
              {result.ticket === null
                ? "You're already on the list!"
                : `You're already in — ticket № ${formatTicket(result.ticket)} is your entry`}
            </p>
            <p className="text-muted-foreground text-sm">
              Your result was emailed when you joined. We&apos;ll email you
              the moment we open.
            </p>
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
            Join the waitlist and we&apos;ll email you whether №{" "}
            {formatTicket(ticket.number)} matches this week&apos;s winning
            number.
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
              {pending ? "Sending…" : "Join and email my result"}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Results go out by email only — one ticket per email, winner gets
              $100 off when the store opens.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

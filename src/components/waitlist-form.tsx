"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, MailCheck, MailWarning, Ticket } from "lucide-react";
import {
  fetchSchoolTheme,
  joinWaitlist,
  type JoinResult,
} from "@/app/actions";
import type { School, SchoolTheme } from "@/lib/sportsmarks";
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

export function WaitlistForm({
  ticket,
  schools,
  refCode = "",
}: {
  ticket: IssuedTicket;
  schools: School[];
  refCode?: string;
}) {
  const [result, formAction, pending] = useActionState<
    JoinResult | null,
    FormData
  >(joinWaitlist, null);
  const [selected, setSelected] = useState<SchoolTheme | null>(null);
  const [loadingTheme, startTheme] = useTransition();
  const theme = selected;

  function pickSchool(slug: string) {
    if (!slug || selected?.slug === slug) return;
    startTheme(async () => {
      const t = await fetchSchoolTheme(slug);
      if (t) setSelected(t);
    });
  }

  if (result?.status === "success") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <LottoTicket
          number={result.ticket}
          week={ticket.week}
          theme={theme}
          className="w-full"
        />
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {result.emailed ? (
              <>
                <MailCheck className="text-primary size-10" />
                <p className="text-lg font-medium">
                  Check your inbox to reveal your result
                </p>
                <p className="text-muted-foreground text-sm">
                  We emailed you a confirmation link for ticket №{" "}
                  {formatTicket(result.ticket)}. Click it to see whether you
                  matched this week&apos;s number. Want another school&apos;s
                  digest? Come back and opt in again anytime.
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
            theme={theme}
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
              {result.bonusTicket
                ? "New school digest added — and it earned you a fresh bonus ticket. Check your email to reveal it."
                : result.resent
                  ? "We re-sent your confirmation link — click it to reveal your result."
                  : "Your result lives behind the confirmation link we emailed you. We'll email you the moment we open."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <LottoTicket
        number={ticket.number}
        week={ticket.week}
        theme={theme}
        className="w-full"
      />

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pick your school, check your ticket</CardTitle>
          <CardDescription>
            {selected
              ? `You're opting into the ${selected.name} weekly digest — not just sports, all things ${selected.name}.`
              : "You're opting into your school's weekly digest — not just sports, everything about your school."}{" "}
            Join to see if № {formatTicket(ticket.number)} matches this
            week&apos;s winning number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="ticket" value={ticket.number} />
            <input type="hidden" name="week" value={ticket.week} />
            <input type="hidden" name="sig" value={ticket.sig} />
            <input type="hidden" name="ref" value={refCode} />
            <input
              type="hidden"
              name="schools"
              value={JSON.stringify(selected ? [selected.slug] : [])}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="school">
                School{" "}
                <span className="text-muted-foreground font-normal">
                  — one per signup, come back to add another
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <select
                  id="school"
                  value={selected?.slug ?? ""}
                  onChange={(e) => pickSchool(e.target.value)}
                  required
                  disabled={pending}
                  className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>
                    {schools.length === 0
                      ? "School list unavailable right now"
                      : "Select your school…"}
                  </option>
                  {schools.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                      {s.conference ? ` (${s.conference})` : ""}
                    </option>
                  ))}
                </select>
                {loadingTheme && (
                  <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
                )}
              </div>
            </div>
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
              Results go out by email only. The weekly winner gets a $100
              Woodn Grail gift card (woodngrail.com).
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, MailCheck, MailWarning, Ticket, X } from "lucide-react";
import {
  fetchSchoolTheme,
  joinWaitlist,
  type JoinResult,
} from "@/app/actions";
import type { School, SchoolTheme } from "@/lib/sportsmarks";
import { LottoTicket, formatTicket } from "@/components/lotto-ticket";
import { Badge } from "@/components/ui/badge";
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
}: {
  ticket: IssuedTicket;
  schools: School[];
}) {
  const [result, formAction, pending] = useActionState<
    JoinResult | null,
    FormData
  >(joinWaitlist, null);
  const [selected, setSelected] = useState<SchoolTheme[]>([]);
  const [loadingTheme, startTheme] = useTransition();

  // The first school picked wears the ticket.
  const theme = selected[0] ?? null;

  function addSchool(slug: string) {
    if (!slug || selected.some((s) => s.slug === slug)) return;
    startTheme(async () => {
      const t = await fetchSchoolTheme(slug);
      if (t) {
        setSelected((prev) =>
          prev.some((s) => s.slug === t.slug) ? prev : [...prev, t]
        );
      }
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
                  matched this week&apos;s number. Don&apos;t see it? Check
                  spam.
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
              {result.addedSchools > 0 &&
                `We added ${result.addedSchools} new school ${result.addedSchools === 1 ? "digest" : "digests"} to your lists. `}
              {result.resent
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
            Choose the digests you want, then join to see if №{" "}
            {formatTicket(ticket.number)} matches this week&apos;s winning
            number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="ticket" value={ticket.number} />
            <input type="hidden" name="week" value={ticket.week} />
            <input type="hidden" name="sig" value={ticket.sig} />
            <input
              type="hidden"
              name="schools"
              value={JSON.stringify(selected.map((s) => s.slug))}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="school">
                School{" "}
                <span className="text-muted-foreground font-normal">
                  — add as many as you like
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <select
                  id="school"
                  value=""
                  onChange={(e) => addSchool(e.target.value)}
                  required={selected.length === 0}
                  disabled={pending}
                  className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>
                    {schools.length === 0
                      ? "School list unavailable right now"
                      : "Select a school…"}
                  </option>
                  {schools.map((s) => (
                    <option
                      key={s.slug}
                      value={s.slug}
                      disabled={selected.some((sel) => sel.slug === s.slug)}
                    >
                      {s.name}
                      {s.conference ? ` (${s.conference})` : ""}
                    </option>
                  ))}
                </select>
                {loadingTheme && (
                  <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
                )}
              </div>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((s) => (
                    <Badge
                      key={s.slug}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {s.name}
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() =>
                          setSelected((prev) =>
                            prev.filter((p) => p.slug !== s.slug)
                          )
                        }
                        className="hover:bg-foreground/10 rounded-full p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
              Results go out by email only — one ticket per email, winner gets
              $100 off when the store opens.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

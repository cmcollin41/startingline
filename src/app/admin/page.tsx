import Link from "next/link";
import { isAdminUser } from "@/lib/user-auth";
import { currentWeek, winningNumber } from "@/lib/lotto";
import { getSchoolTheme } from "@/lib/sportsmarks";
import { formatTicket } from "@/components/lotto-ticket";
import { supabaseAdmin, type Signup } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { DeleteUserButton } from "@/components/delete-user-button";
import { ResendDigestButton } from "@/components/resend-digest-button";
import { SendDigestButton } from "@/components/send-digest-button";
import { SendTestEmailButton } from "@/components/send-test-email-button";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminUser())) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Admins only
        </h1>
        <p className="text-muted-foreground max-w-md text-balance">
          This dashboard requires an admin account. Sign in with your email
          link and come back.
        </p>
        <Button asChild size="sm">
          <Link href="/signin">Log in</Link>
        </Button>
      </main>
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("signups")
    .select(
      "id, name, email, created_at, ticket_number, ticket_week, is_winner, verified_at, referred_by"
    )
    .order("created_at", { ascending: false });

  const signups = (data ?? []) as (Signup & { referred_by: string | null })[];
  // Referrers are signups themselves, so the inviter's name resolves locally.
  const nameById = new Map(signups.map((s) => [s.id, s.name]));
  const week = currentWeek();

  const { data: bonusData } = await supabaseAdmin()
    .from("bonus_tickets")
    .select("signup_id, is_winner");
  const bonusBySignup = new Map<string, { count: number; wins: number }>();
  for (const b of bonusData ?? []) {
    const entry = bonusBySignup.get(b.signup_id) ?? { count: 0, wins: 0 };
    entry.count += 1;
    if (b.is_winner) entry.wins += 1;
    bonusBySignup.set(b.signup_id, entry);
  }
  const winners = signups.filter(
    (s) => s.is_winner || (bonusBySignup.get(s.id)?.wins ?? 0) > 0
  ).length;

  const { data: digestSendData } = await supabaseAdmin()
    .from("digest_sends")
    .select("id, school_name, week, recipient_count, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const digestSends = digestSendData ?? [];

  const [{ data: openRows }, { data: clickRows }] = await Promise.all([
    supabaseAdmin().from("digest_opens").select("digest_send_id, signup_id"),
    supabaseAdmin().from("digest_clicks").select("digest_send_id, signup_id"),
  ]);
  const opensBySend = new Map<string, number>();
  for (const o of openRows ?? []) {
    opensBySend.set(o.digest_send_id, (opensBySend.get(o.digest_send_id) ?? 0) + 1);
  }
  const clickersBySend = new Map<string, Set<string>>();
  for (const c of clickRows ?? []) {
    const set = clickersBySend.get(c.digest_send_id) ?? new Set<string>();
    set.add(c.signup_id);
    clickersBySend.set(c.digest_send_id, set);
  }

  const { data: mastheadData } = await supabaseAdmin()
    .from("digest_names")
    .select("school_name, digest_name")
    .order("school_name");
  const mastheads = new Map(
    (mastheadData ?? []).map((m) => [m.school_name, m.digest_name])
  );

  const { data: subs } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("signup_id, school_slug, school_name")
    .order("created_at");
  const schoolsBySignup = new Map<string, string[]>();
  const listBySlug = new Map<string, { name: string; count: number }>();
  for (const sub of subs ?? []) {
    schoolsBySignup.set(sub.signup_id, [
      ...(schoolsBySignup.get(sub.signup_id) ?? []),
      sub.school_name,
    ]);
    const entry = listBySlug.get(sub.school_slug) ?? {
      name: sub.school_name,
      count: 0,
    };
    entry.count += 1;
    listBySlug.set(sub.school_slug, entry);
  }

  // One scannable row per school: logo, subscribers, latest edition stats.
  const lists = await Promise.all(
    [...listBySlug.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
      .map(async ([slug, { name, count }]) => {
        const lastSend = digestSends.find((d) => d.school_name === name) ?? null;
        return {
          slug,
          name,
          count,
          masthead: mastheads.get(name) ?? null,
          logoUrl: (await getSchoolTheme(slug))?.logoUrl ?? null,
          lastSend: lastSend
            ? {
                week: lastSend.week,
                recipients: lastSend.recipient_count,
                opens: opensBySend.get(lastSend.id) ?? 0,
                clickers: clickersBySend.get(lastSend.id)?.size ?? 0,
              }
            : null,
        };
      })
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Waitlist admin
          </h1>
          <p className="text-muted-foreground text-sm">
            Everyone who has joined the startingline waitlist.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SendDigestButton />
          <SendTestEmailButton />
          <LogoutButton />
        </div>
      </div>

      <Separator className="my-6" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            This week&apos;s winning number
            <Badge variant="secondary">{week}</Badge>
          </CardTitle>
          <CardDescription>
            A signup wins $100 off if their ticket matches. Only you can see
            this — it rolls over every Monday (UTC).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-baseline gap-4">
          <span className="font-mono text-4xl font-bold tabular-nums">
            № {formatTicket(winningNumber(week))}
          </span>
          <span className="text-muted-foreground text-sm">
            {winners === 0
              ? "No winners yet."
              : `${winners} winner${winners === 1 ? "" : "s"} all-time.`}
          </span>
        </CardContent>
      </Card>

      {lists.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Digest lists</CardTitle>
            <CardDescription>
              Subscribers per school. Digests go out automatically every
              Monday at 14:00 UTC to confirmed subscribers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead className="text-right">Subscribers</TableHead>
                  <TableHead className="text-right">Last edition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((l) => (
                  <TableRow key={l.slug}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <span className="border-border grid size-9 shrink-0 place-items-center rounded-md border bg-white p-1 text-[#1D1812]">
                          {l.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external CDN asset, unknown dimensions
                            <img
                              src={l.logoUrl}
                              alt=""
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs font-semibold">
                              {l.name.charAt(0)}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {l.name}
                          </span>
                          {l.masthead && (
                            <span className="text-muted-foreground block truncate text-xs">
                              “{l.masthead}”
                            </span>
                          )}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-base font-semibold tabular-nums">
                      {l.count}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.lastSend ? (
                        <span className="text-muted-foreground text-xs">
                          <span className="text-foreground font-medium">
                            {l.lastSend.week}
                          </span>
                          {" · "}
                          {l.lastSend.recipients} sent · {l.lastSend.opens}{" "}
                          opened
                          {l.lastSend.recipients > 0 &&
                            ` (${Math.round((l.lastSend.opens / l.lastSend.recipients) * 100)}%)`}{" "}
                          · {l.lastSend.clickers} clicked
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          not sent yet
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load signups</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Signups
              <Badge variant="secondary">{signups.length}</Badge>
            </CardTitle>
            <CardDescription>Newest first</CardDescription>
          </CardHeader>
          <CardContent>
            {signups.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No one has signed up yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Schools</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signups.map((signup) => (
                    <TableRow key={signup.id}>
                      <TableCell>
                        <span className="block font-medium">{signup.name}</span>
                        {signup.referred_by && (
                          <span className="text-muted-foreground block text-xs">
                            invited by{" "}
                            {nameById.get(signup.referred_by) ?? "a deleted user"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{signup.email}</TableCell>
                      <TableCell className="max-w-48">
                        {schoolsBySignup.has(signup.id) ? (
                          <span className="text-muted-foreground text-xs">
                            {schoolsBySignup.get(signup.id)!.join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {signup.ticket_number === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="font-mono tabular-nums">
                              {formatTicket(signup.ticket_number)}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {signup.ticket_week}
                            </span>
                            {(bonusBySignup.get(signup.id)?.count ?? 0) >
                              0 && (
                              <span className="text-muted-foreground text-xs">
                                +{bonusBySignup.get(signup.id)!.count} bonus
                              </span>
                            )}
                            {(signup.is_winner ||
                              (bonusBySignup.get(signup.id)?.wins ?? 0) >
                                0) &&
                              (signup.verified_at ? (
                                <Badge>Winner · $100</Badge>
                              ) : (
                                <Badge variant="outline">
                                  Winner — unconfirmed
                                </Badge>
                              ))}
                            {!signup.is_winner && !signup.verified_at && (
                              <span className="text-muted-foreground text-xs">
                                unconfirmed
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {new Date(signup.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        })}{" "}
                        UTC
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center justify-end gap-0.5">
                          {schoolsBySignup.has(signup.id) && (
                            <ResendDigestButton
                              id={signup.id}
                              email={signup.email}
                            />
                          )}
                          <DeleteUserButton
                            id={signup.id}
                            email={signup.email}
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

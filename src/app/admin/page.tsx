import { isAdmin } from "@/lib/admin-auth";
import { currentWeek, winningNumber } from "@/lib/lotto";
import { formatTicket } from "@/components/lotto-ticket";
import { supabaseAdmin, type Signup } from "@/lib/supabase";
import { AdminLoginForm } from "@/components/admin-login-form";
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
  if (!(await isAdmin())) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <AdminLoginForm />
      </main>
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("signups")
    .select(
      "id, name, email, created_at, ticket_number, ticket_week, is_winner, verified_at"
    )
    .order("created_at", { ascending: false });

  const signups = (data ?? []) as Signup[];
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

  const { data: subs } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("signup_id, school_name")
    .order("created_at");
  const schoolsBySignup = new Map<string, string[]>();
  const listCounts = new Map<string, number>();
  for (const sub of subs ?? []) {
    schoolsBySignup.set(sub.signup_id, [
      ...(schoolsBySignup.get(sub.signup_id) ?? []),
      sub.school_name,
    ]);
    listCounts.set(sub.school_name, (listCounts.get(sub.school_name) ?? 0) + 1);
  }

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

      {listCounts.size > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Digest lists</CardTitle>
            <CardDescription>
              Subscribers per school. Digests go out automatically every
              Monday at 14:00 UTC to confirmed subscribers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              {[...listCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([school, count]) => (
                  <Badge key={school} variant="secondary">
                    {school} · {count}
                  </Badge>
                ))}
            </div>
            {digestSends.length > 0 && (
              <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                {digestSends.map((d) => (
                  <span key={d.id}>
                    {d.week} · {d.school_name} → {d.recipient_count}{" "}
                    recipient{d.recipient_count === 1 ? "" : "s"} (
                    {new Date(d.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    })}{" "}
                    UTC)
                  </span>
                ))}
              </div>
            )}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signups.map((signup) => (
                    <TableRow key={signup.id}>
                      <TableCell className="font-medium">
                        {signup.name}
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

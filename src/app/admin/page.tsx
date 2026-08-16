import { isAdmin } from "@/lib/admin-auth";
import { currentWeek, winningNumber } from "@/lib/lotto";
import { formatTicket } from "@/components/lotto-ticket";
import { supabaseAdmin, type Signup } from "@/lib/supabase";
import { AdminLoginForm } from "@/components/admin-login-form";
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
  const winners = signups.filter((s) => s.is_winner).length;

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
                            {signup.is_winner &&
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

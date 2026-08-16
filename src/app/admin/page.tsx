import { isAdmin } from "@/lib/admin-auth";
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
    .select("id, name, email, created_at")
    .order("created_at", { ascending: false });

  const signups = (data ?? []) as Signup[];

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

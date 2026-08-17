"use client";

import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { sendLoginLink, type LoginLinkResult } from "@/app/actions";
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

export function SignInForm({ invalidToken }: { invalidToken: boolean }) {
  const [result, formAction, pending] = useActionState<LoginLinkResult, FormData>(
    sendLoginLink,
    null
  );

  if (result?.status === "sent") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <MailCheck className="text-primary size-10" />
          <p className="text-lg font-medium">Check your inbox</p>
          <p className="text-muted-foreground text-sm">
            If that email is on the list, a sign-in link is on its way. Click
            it to open your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          We&apos;ll email you a sign-in link — no password needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {invalidToken && (
            <Alert variant="destructive">
              <AlertDescription>
                That sign-in link wasn&apos;t valid or has been tampered with —
                request a fresh one below.
              </AlertDescription>
            </Alert>
          )}
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
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

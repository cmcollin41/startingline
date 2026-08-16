"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { joinWaitlist, type JoinResult } from "@/app/actions";
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

export function WaitlistForm() {
  const [result, formAction, pending] = useActionState<
    JoinResult | null,
    FormData
  >(joinWaitlist, null);

  if (result?.status === "success" || result?.status === "duplicate") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="text-primary size-10" />
          <p className="text-lg font-medium">
            {result.status === "success"
              ? "You're on the list!"
              : "You're already on the list!"}
          </p>
          <p className="text-muted-foreground text-sm">
            We&apos;ll email you as soon as we launch.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join the waitlist</CardTitle>
        <CardDescription>
          Drop your name and email — no spam, ever.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
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
            {pending ? "Joining…" : "Join waitlist"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

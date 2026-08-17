import Link from "next/link";
import { CircleX, MailX } from "lucide-react";
import { parseSignupToken } from "@/lib/lotto";
import { supabaseAdmin } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: PageProps<"/unsubscribe">) {
  const { token, school } = await searchParams;
  const id = typeof token === "string" ? parseSignupToken(token) : null;
  const slug = typeof school === "string" ? school : "";

  let removedSchool: string | null = null;
  if (id && slug) {
    const { data } = await supabaseAdmin()
      .from("school_subscriptions")
      .delete()
      .eq("signup_id", id)
      .eq("school_slug", slug)
      .select("school_name")
      .maybeSingle();
    removedSchool = data?.school_name ?? null;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          {removedSchool ? (
            <>
              <MailX className="text-primary size-10" />
              <p className="text-lg font-medium">
                Unsubscribed from the {removedSchool} digest
              </p>
              <p className="text-muted-foreground text-sm">
                You won&apos;t get that weekly email anymore. You&apos;re still
                on the startingline waitlist, and any other school digests you
                follow are unchanged.
              </p>
            </>
          ) : (
            <>
              <CircleX className="text-destructive size-10" />
              <p className="text-lg font-medium">
                Nothing to unsubscribe
              </p>
              <p className="text-muted-foreground text-sm">
                This link is invalid, or you already left this digest.
              </p>
            </>
          )}
          <Button asChild variant="outline" className="mt-2">
            <Link href="/">Back to startingline</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

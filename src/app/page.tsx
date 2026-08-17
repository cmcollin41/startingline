import { WaitlistForm } from "@/components/waitlist-form";
import { issueTicket } from "@/lib/lotto";
import { listSchools } from "@/lib/sportsmarks";

// Every page load deals a fresh ticket, so this page renders per-request.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { ref } = await searchParams;
  const refCode = typeof ref === "string" ? ref : "";
  const ticket = issueTicket();
  const schools = await listSchools();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="max-w-md text-balance text-lg font-medium">
          The best weekly digest for alumni — all things your alma mater in one
          email.
        </p>
        <p className="text-muted-foreground max-w-md text-balance">
          Stay in the loop on sports, campus, and everything in between in just
          2&ndash;3 minutes every week. Opt in below and grab your ticket — if
          it matches this week&apos;s number, you win a $100 Woodn Grail
          (woodngrail.com) gift card.
        </p>
      </div>
      <WaitlistForm ticket={ticket} schools={schools} refCode={refCode} />
    </main>
  );
}

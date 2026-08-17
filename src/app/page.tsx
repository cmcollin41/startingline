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
        <p className="text-muted-foreground max-w-md text-balance">
          The weekly digest for all things your school — sports, campus, and
          everything in between. Pick your school, grab your ticket, and
          we&apos;ll email you whether it matches this week&apos;s number — a
          match wins a $100 gift card for officially licensed school gear.
        </p>
      </div>
      <WaitlistForm ticket={ticket} schools={schools} refCode={refCode} />
    </main>
  );
}

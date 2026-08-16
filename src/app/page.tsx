import { WaitlistForm } from "@/components/waitlist-form";
import { issueTicket } from "@/lib/lotto";
import { listSchools } from "@/lib/sportsmarks";

// Every page load deals a fresh ticket, so this page renders per-request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const ticket = issueTicket();
  const schools = await listSchools();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          The weekly email digest for your school&apos;s sports. Pick your
          schools, grab your ticket, and we&apos;ll email you whether it
          matches this week&apos;s number — a match is $100 off when our store
          opens.
        </p>
      </div>
      <WaitlistForm ticket={ticket} schools={schools} />
    </main>
  );
}

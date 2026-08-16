import { WaitlistForm } from "@/components/waitlist-form";
import { issueTicket } from "@/lib/lotto";

// Every page load deals a fresh ticket, so this page renders per-request.
export const dynamic = "force-dynamic";

export default function Home() {
  const ticket = issueTicket();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Every visit deals you a ticket. Join the waitlist and we&apos;ll
          email you whether it matches this week&apos;s number — a match is
          $100 off when we open.
        </p>
      </div>
      <WaitlistForm ticket={ticket} />
    </main>
  );
}

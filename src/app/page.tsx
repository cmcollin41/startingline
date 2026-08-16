import { WaitlistForm } from "@/components/waitlist-form";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Be first out of the gate. Join the waitlist and we&apos;ll let you
          know the moment we launch.
        </p>
      </div>
      <WaitlistForm />
    </main>
  );
}

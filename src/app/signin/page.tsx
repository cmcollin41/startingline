import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/user-auth";
import { SignInForm } from "@/components/signin-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  if (await currentUserId()) redirect("/account");
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">startingline</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Manage your school digests, tickets, and invites.
        </p>
      </div>
      <SignInForm invalidToken={error === "invalid"} />
    </main>
  );
}

import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { currentSignup, currentUserId } from "@/lib/user-auth";
import { AccountTabs } from "@/components/account-tabs";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

// Shared dashboard chrome: greeting, sign-out, and the tab strip. Each tab
// is its own route, so the pages below fetch their own data and guard
// themselves — this layout only guards the initial load.
export default async function AccountLayout({
  children,
}: LayoutProps<"/account">) {
  const signup = await currentSignup();
  // Stale cookie (row deleted) goes through /api/logout to be cleared.
  if (!signup) redirect((await currentUserId()) ? "/api/logout" : "/signin");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hey, {signup.name.trim().split(/\s+/)[0]}
          </h1>
          <p className="text-muted-foreground text-sm">{signup.email}</p>
        </div>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
      <AccountTabs />
      {children}
    </main>
  );
}

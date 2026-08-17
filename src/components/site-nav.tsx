import Link from "next/link";
import { Ticket } from "lucide-react";
import { currentSignupId } from "@/lib/user-auth";
import { Button } from "@/components/ui/button";

// Session-aware site header, rendered on every page.
export async function SiteNav() {
  const userId = await currentSignupId();
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <Ticket className="size-4" />
          startingline
        </Link>
        <nav className="flex items-center gap-1">
          {userId ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/account">My account</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

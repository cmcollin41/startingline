import Link from "next/link";
import { ShieldCheck, Ticket } from "lucide-react";
import { currentSignup, currentUserId } from "@/lib/user-auth";
import { Button } from "@/components/ui/button";

// Session-aware site header, rendered on every page.
export async function SiteNav() {
  const signup = await currentSignup();
  // A cookie with no matching signup is a stale session — route the button
  // through /api/logout so clicking it clears the cookie before sign-in.
  const stale = !signup && (await currentUserId()) !== null;
  const firstName = signup?.name.trim().split(/\s+/)[0];
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
          {signup ? (
            <>
              {signup.role === "admin" && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">
                    <ShieldCheck className="size-4" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/account">Hello, {firstName}</Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href={stale ? "/api/logout" : "/signin"}>Log in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

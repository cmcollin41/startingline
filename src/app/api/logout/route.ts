import { NextResponse } from "next/server";
import { destroyUserSession } from "@/lib/user-auth";

// Clears the session cookie outside a server-component render — pages can't
// mutate cookies, so stale sessions (cookie outlives the signup row) get
// redirected here to be cleaned up.
export async function GET(request: Request) {
  await destroyUserSession();
  return NextResponse.redirect(new URL("/signin", request.url));
}

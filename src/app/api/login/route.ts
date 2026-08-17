import { parseSignupToken } from "@/lib/lotto";
import { confirmSignup } from "@/lib/referrals";
import { createUserSession } from "@/lib/user-auth";

// Magic-link sign-in: every emailed link carries a signed token, so landing
// here with a valid one both confirms the address (first time) and starts a
// session. `next` must be a local path — never an external redirect.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const rawNext = url.searchParams.get("next") ?? "/account";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";

  const id = parseSignupToken(token);
  if (!id || !(await confirmSignup(id))) {
    return Response.redirect(new URL("/signin?error=invalid", url.origin), 302);
  }
  await createUserSession(id);
  return Response.redirect(new URL(next, url.origin), 302);
}

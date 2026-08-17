import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

// User sessions ride the same passwordless trust chain as everything else:
// a session is only ever created by /api/login, which requires a signed
// token from an email we sent — so being signed in means having proven
// control of the inbox.

const SESSION_COOKIE = "user_session";

function secret() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD environment variable");
  }
  return createHmac("sha256", password)
    .update("startingline-user-session")
    .digest();
}

function sessionSig(id: string) {
  return createHmac("sha256", secret()).update(`session-${id}`).digest("hex");
}

export async function createUserSession(signupId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${signupId}.${sessionSig(signupId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // thirty days
  });
}

export async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot === -1) return null;
  const id = value.slice(0, dot);
  const expected = Buffer.from(sessionSig(id));
  const given = Buffer.from(value.slice(dot + 1));
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? id
    : null;
}

// A signed cookie can outlive its signup row (e.g. the account was deleted),
// so anything that branches on "signed in" must confirm the row still exists.
export async function currentSignup(): Promise<{
  id: string;
  name: string;
} | null> {
  const id = await currentUserId();
  if (!id) return null;
  const { data } = await supabaseAdmin()
    .from("signups")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function destroyUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

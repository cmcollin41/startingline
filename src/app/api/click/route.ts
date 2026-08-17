import { parseSignupToken } from "@/lib/lotto";
import { supabaseAdmin } from "@/lib/supabase";

// Digest click tracking: record the click, then send the reader on to the
// article. Only http(s) targets are ever redirected to.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sendId = url.searchParams.get("d") ?? "";
  const signupId = parseSignupToken(url.searchParams.get("t") ?? "");
  const target = url.searchParams.get("u") ?? "";

  let targetUrl: URL | null = null;
  try {
    const parsed = new URL(target);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      targetUrl = parsed;
    }
  } catch {
    targetUrl = null;
  }
  if (!targetUrl) {
    return Response.redirect(new URL("/", url.origin), 302);
  }

  if (signupId && /^[0-9a-f-]{36}$/.test(sendId)) {
    const { error } = await supabaseAdmin()
      .from("digest_clicks")
      .insert({ digest_send_id: sendId, signup_id: signupId, url: targetUrl.href });
    if (error && error.code !== "23503") {
      console.error("click tracking insert failed:", error);
    }
    // A click is also proof the email was opened — image blocking can hide
    // the pixel, so backfill the open.
    await supabaseAdmin()
      .from("digest_opens")
      .insert({ digest_send_id: sendId, signup_id: signupId })
      .then(() => {});
  }

  return Response.redirect(targetUrl.href, 302);
}

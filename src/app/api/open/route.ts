import { parseSignupToken } from "@/lib/lotto";
import { supabaseAdmin } from "@/lib/supabase";

// The digest's tracking pixel. Records at most one open per recipient per
// send (unique constraint), then returns a 1x1 transparent gif either way.
const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sendId = url.searchParams.get("d") ?? "";
  const signupId = parseSignupToken(url.searchParams.get("t") ?? "");

  if (signupId && /^[0-9a-f-]{36}$/.test(sendId)) {
    const { error } = await supabaseAdmin()
      .from("digest_opens")
      .insert({ digest_send_id: sendId, signup_id: signupId });
    if (error && error.code !== "23505" && error.code !== "23503") {
      console.error("open tracking insert failed:", error);
    }
  }

  return new Response(new Uint8Array(GIF), {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, max-age=0",
    },
  });
}

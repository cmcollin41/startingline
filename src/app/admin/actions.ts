"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { isAdminUser } from "@/lib/user-auth";
import {
  resendLatestDigests,
  sendWeeklyDigest,
  type DigestRunResult,
  type ResendResult,
} from "@/lib/digest";
import { siteOrigin } from "@/lib/referrals";
import { supabaseAdmin } from "@/lib/supabase";

export type DigestNowResult =
  | { status: "success"; result: DigestRunResult }
  | { status: "error"; message: string };

// Manual trigger for this week's digest run. Idempotent — schools already
// sent this week are skipped, so clicking twice can't double-send.
export async function sendDigestNow(): Promise<DigestNowResult> {
  if (!(await isAdminUser())) {
    return { status: "error", message: "Not authorized" };
  }
  const result = await sendWeeklyDigest(await siteOrigin());
  revalidatePath("/admin");
  return { status: "success", result };
}

export type ResendDigestResult =
  | { status: "success"; result: ResendResult }
  | { status: "error"; message: string };

// Re-send the latest edition of each subscribed school's digest to one
// signup — rebuilt from the stored stories, so no research pass runs.
export async function resendDigest(
  signupId: string
): Promise<ResendDigestResult> {
  if (!(await isAdminUser())) {
    return { status: "error", message: "Not authorized" };
  }
  const result = await resendLatestDigests(signupId, await siteOrigin());
  return { status: "success", result };
}

export type DeleteSignupResult =
  | { status: "success" }
  | { status: "error"; message: string };

// Removes a user and everything attached to them (subscriptions, bonus
// tickets, referral links, analytics rows) via cascade.
export async function deleteSignup(id: string): Promise<DeleteSignupResult> {
  if (!(await isAdminUser())) {
    return { status: "error", message: "Not authorized" };
  }
  const { error } = await supabaseAdmin().from("signups").delete().eq("id", id);
  if (error) {
    console.error("deleteSignup failed:", error);
    return { status: "error", message: error.message };
  }
  revalidatePath("/admin");
  return { status: "success" };
}

export type SendEmailResult =
  | { status: "success"; id: string; to: string }
  | { status: "error"; message: string };

export async function sendTestEmail(): Promise<SendEmailResult> {
  if (!(await isAdminUser())) {
    return { status: "error", message: "Not authorized" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "error", message: "RESEND_API_KEY is not configured" };
  }

  const to = process.env.TEST_EMAIL_TO ?? "delivered@resend.dev";
  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";

  const { count, error: countError } = await supabaseAdmin()
    .from("signups")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("sendTestEmail count failed:", countError);
    return { status: "error", message: "Could not read signup count" };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `startingline waitlist update — ${count ?? 0} signup${count === 1 ? "" : "s"}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 20px;">startingline</h1>
        <p>This is a test email sent from the startingline admin dashboard.</p>
        <p><strong>${count ?? 0}</strong> ${count === 1 ? "person has" : "people have"} joined the waitlist so far.</p>
        <p style="color: #6b7280; font-size: 13px;">Sent via Resend on ${new Date().toUTCString()}.</p>
      </div>
    `,
  });

  if (error || !data) {
    console.error("sendTestEmail send failed:", error);
    return {
      status: "error",
      message: error?.message ?? "Failed to send email",
    };
  }

  return { status: "success", id: data.id, to };
}

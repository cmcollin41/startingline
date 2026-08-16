"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import {
  createSession,
  destroySession,
  isAdmin,
  verifyPassword,
} from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export type LoginResult = { status: "error"; message: string } | null;

export async function login(
  _prev: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const password = formData.get("password");
  if (typeof password !== "string" || !verifyPassword(password)) {
    return { status: "error", message: "Incorrect password" };
  }
  await createSession();
  revalidatePath("/admin");
  return null;
}

export async function logout() {
  await destroySession();
  revalidatePath("/admin");
}

export type SendEmailResult =
  | { status: "success"; id: string; to: string }
  | { status: "error"; message: string };

export async function sendTestEmail(): Promise<SendEmailResult> {
  if (!(await isAdmin())) {
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

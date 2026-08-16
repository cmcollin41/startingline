"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { issueTicket, signupToken, verifyTicket, winningNumber } from "@/lib/lotto";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.email("Please enter a valid email address").max(254),
});

// The win/no-match outcome is deliberately never returned to the browser —
// the reveal lives behind the emailed confirmation link, so an unreachable
// address can't learn the result or claim a win.
export type JoinResult =
  | { status: "success"; ticket: number; emailed: boolean }
  | { status: "duplicate"; ticket: number | null; resent: boolean }
  | { status: "error"; message: string };

export async function joinWaitlist(
  _prev: JoinResult | null,
  formData: FormData
): Promise<JoinResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { name, email } = parsed.data;

  // The ticket shown on the page rides along as signed hidden fields. If the
  // signature doesn't check out (tampered, or a tab left open past the weekly
  // rollover), quietly issue a fresh ticket instead of failing the signup.
  const rawNumber = Number(formData.get("ticket"));
  const rawWeek = String(formData.get("week") ?? "");
  const rawSig = String(formData.get("sig") ?? "");
  const ticket =
    Number.isInteger(rawNumber) && verifyTicket(rawNumber, rawWeek, rawSig)
      ? { number: rawNumber, week: rawWeek }
      : issueTicket();

  const won = ticket.number === winningNumber(ticket.week);

  const { data: inserted, error } = await supabaseAdmin()
    .from("signups")
    .insert({
      name,
      email: email.toLowerCase(),
      ticket_number: ticket.number,
      ticket_week: ticket.week,
      is_winner: won,
      win_week: won ? ticket.week : null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // 23505 = unique_violation: the email is already on the list. If they
    // haven't confirmed yet, re-send their link (same inbox, so it's safe);
    // never reveal anything on-page.
    if (error?.code === "23505") {
      const { data } = await supabaseAdmin()
        .from("signups")
        .select("id, name, ticket_number, verified_at")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      let resent = false;
      if (data && !data.verified_at) {
        resent = await sendConfirmEmail(
          data.name,
          email.toLowerCase(),
          data.ticket_number,
          data.id
        );
      }
      return {
        status: "duplicate",
        ticket: data?.ticket_number ?? null,
        resent,
      };
    }
    console.error("joinWaitlist insert failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  const emailed = await sendConfirmEmail(
    name,
    email.toLowerCase(),
    ticket.number,
    inserted.id
  );

  if (won) {
    await notifyOwnerOfWin(name, email.toLowerCase(), ticket.number, ticket.week);
  }

  return { status: "success", ticket: ticket.number, emailed };
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// The confirmation email never states the result — clicking the link routes
// back to /verify, which records the click and reveals the stamped ticket.
async function sendConfirmEmail(
  name: string,
  email: string,
  ticket: number | null,
  id: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("sendConfirmEmail: RESEND_API_KEY is not configured");
    return false;
  }

  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
  const ticketLabel = ticket === null ? "—" : String(ticket).padStart(3, "0");
  const confirmUrl = `${await siteOrigin()}/verify?token=${signupToken(id)}`;

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: `Confirm your email to reveal ticket № ${ticketLabel}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 20px;">One click to your result, ${name}</h1>
        <p>Ticket <strong>№ ${ticketLabel}</strong> is locked in. Confirm this
        email address to see whether it matched this week's winning number —
        a match is <strong>$100 off</strong> when the startingline store opens.</p>
        <p style="margin: 24px 0;">
          <a href="${confirmUrl}"
             style="background: #171717; color: #fafafa; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Reveal my result
          </a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">Or paste this link into your
        browser:<br/>${confirmUrl}</p>
        <p style="color: #6b7280; font-size: 13px;">Results are only revealed to
        confirmed addresses. One ticket per email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("confirm email failed:", error);
    return false;
  }
  return true;
}

// Heads-up so a win never goes unnoticed — sent at signup, before the winner
// confirms. /admin shows whether they've confirmed yet.
async function notifyOwnerOfWin(
  name: string,
  email: string,
  ticket: number,
  week: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.TEST_EMAIL_TO;
  if (!apiKey || !to) return;

  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
  const ticketLabel = String(ticket).padStart(3, "0");
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    subject: `Lotto winner: ${email} (ticket ${ticketLabel}, ${week})`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <p><strong>${name}</strong> (${email}) just won the weekly draw with
        ticket <strong>№ ${ticketLabel}</strong> in ${week}.</p>
        <p>The win counts once they confirm their email — check the admin
        dashboard for their status. They're owed $100 off at opening.</p>
      </div>
    `,
  });
  if (error) console.error("owner win email failed:", error);
}

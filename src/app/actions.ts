"use server";

import { z } from "zod";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { issueTicket, verifyTicket, winningNumber } from "@/lib/lotto";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.email("Please enter a valid email address").max(254),
});

// The win/no-match outcome is deliberately never returned to the browser —
// results go out by email only, so an unreachable address can't claim a win.
export type JoinResult =
  | { status: "success"; ticket: number; emailed: boolean }
  | { status: "duplicate"; ticket: number | null }
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

  const { error } = await supabaseAdmin().from("signups").insert({
    name,
    email: email.toLowerCase(),
    ticket_number: ticket.number,
    ticket_week: ticket.week,
    is_winner: won,
    win_week: won ? ticket.week : null,
  });

  if (error) {
    // 23505 = unique_violation: the email is already on the list. Their
    // result was emailed when they first joined — don't resend or reveal it.
    if (error.code === "23505") {
      const { data } = await supabaseAdmin()
        .from("signups")
        .select("ticket_number")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      return { status: "duplicate", ticket: data?.ticket_number ?? null };
    }
    console.error("joinWaitlist insert failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  const emailed = await sendResultEmail(
    name,
    email.toLowerCase(),
    ticket.number,
    ticket.week,
    won
  );

  return { status: "success", ticket: ticket.number, emailed };
}

// The result email is the only reveal channel. Returns whether the send was
// accepted, so the UI can warn when an address is unreachable — the win (if
// any) is already recorded, and the owner heads-up below covers follow-up.
async function sendResultEmail(
  name: string,
  email: string,
  ticket: number,
  week: string,
  won: boolean
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("sendResultEmail: RESEND_API_KEY is not configured");
    return false;
  }

  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
  const ticketLabel = String(ticket).padStart(3, "0");
  const resend = new Resend(apiKey);

  const result = won
    ? {
        subject: "Your startingline ticket won — $100 off at opening",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="font-size: 20px;">You won, ${name}!</h1>
            <p>Ticket <strong>№ ${ticketLabel}</strong> matched this week's number (${week}).</p>
            <p>That's <strong>$100 off</strong> when the startingline store opens. Keep this email — it's your claim.</p>
            <p style="color: #6b7280; font-size: 13px;">We'll send redemption details with the opening announcement.</p>
          </div>
        `,
      }
    : {
        subject: `Ticket № ${ticketLabel} — this week's result`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="font-size: 20px;">You're on the list, ${name}</h1>
            <p>Ticket <strong>№ ${ticketLabel}</strong> didn't match this week's number (${week}) — no win this time.</p>
            <p>You're on the startingline waitlist and we'll email you the moment we open.</p>
            <p style="color: #6b7280; font-size: 13px;">One ticket per email · a new number is drawn every Monday.</p>
          </div>
        `,
      };

  const sends = await Promise.allSettled([
    resend.emails.send({ from, to: email, ...result }),
    // Heads-up to the store owner on wins so winners never go unnoticed —
    // this also covers Resend's free tier, which only delivers to the
    // account owner.
    won && process.env.TEST_EMAIL_TO
      ? resend.emails.send({
          from,
          to: process.env.TEST_EMAIL_TO,
          subject: `Lotto winner: ${email} (ticket ${ticketLabel}, ${week})`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
              <p><strong>${name}</strong> (${email}) just won the weekly draw with ticket <strong>№ ${ticketLabel}</strong> in ${week}.</p>
              <p>They're owed $100 off at opening.</p>
            </div>
          `,
        })
      : Promise.resolve(null),
  ]);

  for (const r of sends) {
    if (r.status === "rejected") console.error("result email failed:", r.reason);
    else if (r.value && "error" in r.value && r.value.error)
      console.error("result email failed:", r.value.error);
  }

  const recipientSend = sends[0];
  return (
    recipientSend.status === "fulfilled" &&
    !(recipientSend.value && "error" in recipientSend.value && recipientSend.value.error)
  );
}

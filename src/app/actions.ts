"use server";

import { z } from "zod";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { issueTicket, verifyTicket, winningNumber } from "@/lib/lotto";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.email("Please enter a valid email address").max(254),
});

export type JoinResult =
  | { status: "success"; ticket: number; won: boolean }
  | { status: "duplicate"; ticket: number | null; won: boolean }
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
    // original ticket is the one that counts — show it back to them.
    if (error.code === "23505") {
      const { data } = await supabaseAdmin()
        .from("signups")
        .select("ticket_number, is_winner")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      return {
        status: "duplicate",
        ticket: data?.ticket_number ?? null,
        won: data?.is_winner ?? false,
      };
    }
    console.error("joinWaitlist insert failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  if (won) {
    await notifyWinner(name, email.toLowerCase(), ticket.number, ticket.week);
  }

  return { status: "success", ticket: ticket.number, won };
}

// Best-effort: a win is recorded in the database regardless, so email trouble
// never turns a winning signup into an error.
async function notifyWinner(
  name: string,
  email: string,
  ticket: number,
  week: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
  const ticketLabel = String(ticket).padStart(3, "0");
  const resend = new Resend(apiKey);

  const results = await Promise.allSettled([
    resend.emails.send({
      from,
      to: email,
      subject: "Your startingline ticket won — $100 off at opening",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size: 20px;">You won, ${name}!</h1>
          <p>Ticket <strong>№ ${ticketLabel}</strong> matched this week's number (${week}).</p>
          <p>That's <strong>$100 off</strong> when the startingline store opens. Keep this email — it's your claim.</p>
          <p style="color: #6b7280; font-size: 13px;">We'll send redemption details with the opening announcement.</p>
        </div>
      `,
    }),
    // Heads-up to the store owner so winners never go unnoticed — this also
    // covers Resend's free tier, which only delivers to the account owner.
    process.env.TEST_EMAIL_TO
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

  for (const r of results) {
    if (r.status === "rejected") console.error("winner email failed:", r.reason);
    else if (r.value && "error" in r.value && r.value.error)
      console.error("winner email failed:", r.value.error);
  }
}

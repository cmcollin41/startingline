import "server-only";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { issueTicket, signupToken, winningNumber } from "@/lib/lotto";

export const REF_CODE_RE = /^[a-f0-9]{10}$/;

// Returns the signup's share code, minting one on first use.
export async function ensureRefCode(
  signupId: string,
  existing: string | null
): Promise<string> {
  if (existing) return existing;
  const code = randomBytes(5).toString("hex");
  const { error } = await supabaseAdmin()
    .from("signups")
    .update({ ref_code: code })
    .eq("id", signupId)
    .is("ref_code", null);
  if (error) {
    console.error("ensureRefCode update failed:", error);
  }
  // If a concurrent request minted first, read back the winning code.
  const { data } = await supabaseAdmin()
    .from("signups")
    .select("ref_code")
    .eq("id", signupId)
    .single();
  return data?.ref_code ?? code;
}

export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Called when an invitee confirms their email for the first time. Deals the
// referrer one fresh ticket in the current week's draw and tells them about
// it. The unique constraint on referred_signup_id makes this idempotent.
export async function grantReferralBonus(
  referrerId: string,
  referredId: string
) {
  if (referrerId === referredId) return;

  const ticket = issueTicket();
  const won = ticket.number === winningNumber(ticket.week);

  const { error } = await supabaseAdmin().from("bonus_tickets").insert({
    signup_id: referrerId,
    referred_signup_id: referredId,
    ticket_number: ticket.number,
    ticket_week: ticket.week,
    is_winner: won,
  });
  if (error) {
    // 23505 = unique_violation: this invitee already granted a bonus.
    if (error.code !== "23505") {
      console.error("grantReferralBonus insert failed:", error);
    }
    return;
  }

  const { data: referrer } = await supabaseAdmin()
    .from("signups")
    .select("name, email")
    .eq("id", referrerId)
    .maybeSingle();
  if (!referrer) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
  const ticketLabel = String(ticket.number).padStart(3, "0");
  const revealUrl = `${await siteOrigin()}/verify?token=${signupToken(referrerId)}`;
  const resend = new Resend(apiKey);

  const sends = await Promise.allSettled([
    resend.emails.send({
      from,
      to: referrer.email,
      subject: `Your invite joined — bonus ticket № ${ticketLabel} is yours`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size: 20px;">Nice one, ${referrer.name}</h1>
          <p>Someone you invited just confirmed their signup, so you earned a
          bonus ticket in this week's draw: <strong>№ ${ticketLabel}</strong>
          (${ticket.week}).</p>
          <p style="margin: 24px 0;">
            <a href="${revealUrl}"
               style="background: #171717; color: #fafafa; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              See all my tickets
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">Every friend who joins and
          confirms earns you another ticket. A match wins a $100 gift card for
          officially licensed school gear.</p>
        </div>
      `,
    }),
    won && process.env.TEST_EMAIL_TO
      ? resend.emails.send({
          from,
          to: process.env.TEST_EMAIL_TO,
          subject: `Lotto winner (bonus ticket): ${referrer.email} (ticket ${ticketLabel}, ${ticket.week})`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
              <p><strong>${referrer.name}</strong> (${referrer.email}) just won
              the weekly draw with referral bonus ticket
              <strong>№ ${ticketLabel}</strong> in ${ticket.week}.</p>
              <p>They're owed a $100 gift card toward officially licensed
              school gear (e.g. woodngrail.com).</p>
            </div>
          `,
        })
      : Promise.resolve(null),
  ]);
  for (const r of sends) {
    if (r.status === "rejected")
      console.error("referral email failed:", r.reason);
    else if (r.value && "error" in r.value && r.value.error)
      console.error("referral email failed:", r.value.error);
  }
}

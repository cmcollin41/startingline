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

// Marks a signup's email as confirmed (first time only) and triggers the
// referral bonus for whoever invited them. Called from both the /verify
// reveal page and /api/login — any click on an emailed link proves the inbox.
export async function confirmSignup(signupId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("signups")
    .select("id, verified_at, referred_by")
    .eq("id", signupId)
    .maybeSingle();
  if (!data) return false;
  if (!data.verified_at) {
    await supabaseAdmin()
      .from("signups")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", signupId)
      .is("verified_at", null);
    if (data.referred_by) {
      await grantReferralBonus(data.referred_by, signupId);
    }
  }
  return true;
}

// Called when an invitee confirms their email for the first time. Deals the
// referrer one fresh ticket in the current week's draw and tells them about
// it. The unique constraint on referred_signup_id makes this idempotent.
export async function grantReferralBonus(
  referrerId: string,
  referredId: string
) {
  if (referrerId === referredId) return;

  const granted = await grantBonusTicket(referrerId, {
    source: "referral",
    referred_signup_id: referredId,
  });
  if (!granted) return;

  await sendBonusEmails(referrerId, granted, {
    subject: (label) => `Your invite joined — bonus ticket № ${label} is yours`,
    intro: (name, label, week) =>
      `<h1 style="font-size: 20px;">Nice one, ${name}</h1>
       <p>Someone you invited just confirmed their signup, so you earned a
       bonus ticket in this week's draw: <strong>№ ${label}</strong>
       (${week}).</p>`,
    footer: `Every friend who joins and confirms earns you another ticket. A
      match wins a $100 gift card for officially licensed school gear.`,
    winnerNote: "referral bonus ticket",
  });
}

// Called when an existing signup comes back and opts into another school's
// digest — each new school deals one fresh ticket, unique per (signup,
// school) so re-adding the same school earns nothing.
export async function grantSchoolBonus(
  signupId: string,
  school: { slug: string; name: string }
) {
  const granted = await grantBonusTicket(signupId, {
    source: "school",
    school_slug: school.slug,
  });
  if (!granted) return;

  await sendBonusEmails(signupId, granted, {
    subject: (label) =>
      `You're following ${school.name} — bonus ticket № ${label}`,
    intro: (name, label, week) =>
      `<h1 style="font-size: 20px;">Welcome to the ${school.name} digest, ${name}</h1>
       <p>You're opting into the <strong>${school.name}</strong> weekly digest —
       not just sports, all things ${school.name}.</p>
       <p>Adding a school earns you a fresh ticket in this week's draw:
       <strong>№ ${label}</strong> (${week}).</p>`,
    footer: `A match wins a $100 gift card for officially licensed school gear
      from brands like woodngrail.com.`,
    winnerNote: "school-opt-in bonus ticket",
  });
}

type GrantedTicket = { number: number; week: string; won: boolean };

async function grantBonusTicket(
  signupId: string,
  extra: Record<string, string>
): Promise<GrantedTicket | null> {
  const ticket = issueTicket();
  const won = ticket.number === winningNumber(ticket.week);
  const { error } = await supabaseAdmin().from("bonus_tickets").insert({
    signup_id: signupId,
    ticket_number: ticket.number,
    ticket_week: ticket.week,
    is_winner: won,
    ...extra,
  });
  if (error) {
    // 23505 = unique_violation: this bonus was already granted.
    if (error.code !== "23505") {
      console.error("grantBonusTicket insert failed:", error);
    }
    return null;
  }
  return { number: ticket.number, week: ticket.week, won };
}

async function sendBonusEmails(
  signupId: string,
  ticket: GrantedTicket,
  copy: {
    subject: (label: string) => string;
    intro: (name: string, label: string, week: string) => string;
    footer: string;
    winnerNote: string;
  }
) {
  const { data: person } = await supabaseAdmin()
    .from("signups")
    .select("name, email")
    .eq("id", signupId)
    .maybeSingle();
  if (!person) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
  const label = String(ticket.number).padStart(3, "0");
  const revealUrl = `${await siteOrigin()}/verify?token=${signupToken(signupId)}`;
  const resend = new Resend(apiKey);

  const sends = await Promise.allSettled([
    resend.emails.send({
      from,
      to: person.email,
      subject: copy.subject(label),
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          ${copy.intro(person.name, label, ticket.week)}
          <p style="margin: 24px 0;">
            <a href="${revealUrl}"
               style="background: #171717; color: #fafafa; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              See all my tickets
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">${copy.footer}</p>
        </div>
      `,
    }),
    ticket.won && process.env.TEST_EMAIL_TO
      ? resend.emails.send({
          from,
          to: process.env.TEST_EMAIL_TO,
          subject: `Lotto winner (${copy.winnerNote}): ${person.email} (ticket ${label}, ${ticket.week})`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
              <p><strong>${person.name}</strong> (${person.email}) just won the
              weekly draw with a ${copy.winnerNote}
              <strong>№ ${label}</strong> in ${ticket.week}.</p>
              <p>They're owed a $100 gift card toward officially licensed
              school gear (e.g. woodngrail.com).</p>
            </div>
          `,
        })
      : Promise.resolve(null),
  ]);
  for (const r of sends) {
    if (r.status === "rejected") console.error("bonus email failed:", r.reason);
    else if (r.value && "error" in r.value && r.value.error)
      console.error("bonus email failed:", r.value.error);
  }
}

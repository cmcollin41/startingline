"use server";

import { z } from "zod";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { getSchoolTheme, type SchoolTheme } from "@/lib/sportsmarks";
import { REF_CODE_RE, grantSchoolBonus, siteOrigin } from "@/lib/referrals";
import { issueTicket, signupToken, verifyTicket, winningNumber } from "@/lib/lotto";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.email("Please enter a valid email address").max(254),
});

// One school per opt-in — returning visitors opt into additional schools by
// signing up again with the same email.
const schoolsSchema = z
  .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
  .max(1);

// Called from the client when a school is picked, so the ticket can dress in
// the school's colors before submitting. Public brand data only.
export async function fetchSchoolTheme(
  slug: string
): Promise<SchoolTheme | null> {
  return getSchoolTheme(slug);
}

// The win/no-match outcome is deliberately never returned to the browser —
// the reveal lives behind the emailed confirmation link, so an unreachable
// address can't learn the result or claim a win.
export type JoinResult =
  | { status: "success"; ticket: number; emailed: boolean }
  | {
      status: "duplicate";
      ticket: number | null;
      resent: boolean;
      addedSchools: number;
      bonusTicket: boolean;
    }
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

  // Resolve the selected school lists against the sportsmarks API — anything
  // that doesn't resolve (bad slug, tampered input) is dropped.
  let slugs: string[] = [];
  try {
    slugs = schoolsSchema.parse(JSON.parse(String(formData.get("schools") ?? "[]")));
  } catch {
    slugs = [];
  }
  const schools = (
    await Promise.all(slugs.map((slug) => getSchoolTheme(slug)))
  ).filter((s): s is SchoolTheme => s !== null);

  if (schools.length === 0) {
    return {
      status: "error",
      message: "Pick at least one school to follow.",
    };
  }

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

  // Arrived via a share link? Credit the referrer — the bonus ticket itself
  // is granted later, when this signup confirms their email.
  let referredBy: string | null = null;
  const refCode = String(formData.get("ref") ?? "");
  if (REF_CODE_RE.test(refCode)) {
    const { data: referrer } = await supabaseAdmin()
      .from("signups")
      .select("id")
      .eq("ref_code", refCode)
      .maybeSingle();
    referredBy = referrer?.id ?? null;
  }

  const { data: inserted, error } = await supabaseAdmin()
    .from("signups")
    .insert({
      name,
      email: email.toLowerCase(),
      ticket_number: ticket.number,
      ticket_week: ticket.week,
      is_winner: won,
      win_week: won ? ticket.week : null,
      referred_by: referredBy,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // 23505 = unique_violation: the email is already on the list. Add any new
    // school lists to their existing signup, and if they haven't confirmed
    // yet, re-send their link (same inbox, so it's safe).
    if (error?.code === "23505") {
      const { data } = await supabaseAdmin()
        .from("signups")
        .select("id, name, ticket_number, verified_at")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      let resent = false;
      let addedSchools = 0;
      let bonusTicket = false;
      if (data) {
        addedSchools = await subscribeToSchools(data.id, schools);
        if (addedSchools > 0) {
          // Opting into a new school deals a fresh bonus ticket; the email it
          // sends links to /verify, which also confirms unverified addresses.
          await grantSchoolBonus(data.id, {
            slug: schools[0].slug,
            name: schools[0].name,
          });
          bonusTicket = true;
        } else if (!data.verified_at) {
          resent = await sendConfirmEmail(
            data.name,
            email.toLowerCase(),
            data.ticket_number,
            data.id,
            schools.map((s) => s.name)
          );
        }
      }
      return {
        status: "duplicate",
        ticket: data?.ticket_number ?? null,
        resent,
        addedSchools,
        bonusTicket,
      };
    }
    console.error("joinWaitlist insert failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  await subscribeToSchools(inserted.id, schools);

  const emailed = await sendConfirmEmail(
    name,
    email.toLowerCase(),
    ticket.number,
    inserted.id,
    schools.map((s) => s.name)
  );

  if (won) {
    await notifyOwnerOfWin(name, email.toLowerCase(), ticket.number, ticket.week);
  }

  return { status: "success", ticket: ticket.number, emailed };
}

// Returns how many of the given schools were newly added (existing
// subscriptions are left untouched).
async function subscribeToSchools(
  signupId: string,
  schools: SchoolTheme[]
): Promise<number> {
  if (schools.length === 0) return 0;
  const { data: existing } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("school_slug")
    .eq("signup_id", signupId);
  const have = new Set((existing ?? []).map((r) => r.school_slug));
  const fresh = schools.filter((s) => !have.has(s.slug));
  if (fresh.length === 0) return 0;
  const { error } = await supabaseAdmin().from("school_subscriptions").insert(
    fresh.map((s) => ({
      signup_id: signupId,
      school_slug: s.slug,
      school_name: s.name,
    }))
  );
  if (error) {
    console.error("subscribeToSchools insert failed:", error);
    return 0;
  }
  return fresh.length;
}

// The confirmation email never states the result — clicking the link routes
// back to /verify, which records the click and reveals the stamped ticket.
async function sendConfirmEmail(
  name: string,
  email: string,
  ticket: number | null,
  id: string,
  schoolNames: string[]
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("sendConfirmEmail: RESEND_API_KEY is not configured");
    return false;
  }

  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
  const ticketLabel = ticket === null ? "—" : String(ticket).padStart(3, "0");
  const confirmUrl = `${await siteOrigin()}/verify?token=${signupToken(id)}`;
  const school = schoolNames[0];
  const lists = school
    ? `<p>You're opting into the <strong>${school}</strong> weekly digest —
       not just sports, all things ${school}.</p>`
    : "";

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: `Confirm your email to reveal ticket № ${ticketLabel}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 20px;">One click to your result, ${name}</h1>
        ${lists}
        <p>Ticket <strong>№ ${ticketLabel}</strong> is locked in. Confirm this
        email address to see whether it matched this week's winning number —
        a match wins a <strong>$100 gift card</strong> toward officially
        licensed ${school ?? "school"} gear from brands like woodngrail.com.</p>
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

export type LoginLinkResult = { status: "sent" } | null;

// Passwordless sign-in: email a magic link. The response never reveals
// whether the address is on the list.
export async function sendLoginLink(
  _prev: LoginLinkResult,
  formData: FormData
): Promise<LoginLinkResult> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { status: "sent" };

  const { data } = await supabaseAdmin()
    .from("signups")
    .select("id, name")
    .eq("email", parsed.data.toLowerCase())
    .maybeSingle();

  const apiKey = process.env.RESEND_API_KEY;
  if (data && apiKey) {
    const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";
    const loginUrl = `${await siteOrigin()}/api/login?token=${signupToken(data.id)}&next=%2Faccount`;
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: parsed.data.toLowerCase(),
      subject: "Your startingline sign-in link",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size: 20px;">Sign in, ${data.name}</h1>
          <p>Click below to open your startingline account — your digests,
          tickets, and invite link.</p>
          <p style="margin: 24px 0;">
            <a href="${loginUrl}"
               style="background: #171717; color: #fafafa; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Sign in to my account
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">If you didn't request this,
          you can ignore this email.</p>
        </div>
      `,
    });
    if (error) console.error("login link email failed:", error);
  }
  return { status: "sent" };
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
        dashboard for their status. They're owed a $100 gift card toward
        officially licensed school gear (e.g. woodngrail.com).</p>
      </div>
    `,
  });
  if (error) console.error("owner win email failed:", error);
}

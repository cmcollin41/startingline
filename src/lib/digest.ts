import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { currentWeek, signupToken } from "@/lib/lotto";
import { editDigest, type EditedDigest } from "@/lib/digest-editor";
import { getMasthead } from "@/lib/masthead";
import { getSchoolTheme, type SchoolTheme } from "@/lib/sportsmarks";

export type Headline = { title: string; link: string; source: string | null };

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:x27|39);/g, "'")
    .trim();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The week's top stories about a school — sports, campus, everything — via
// Google News RSS. No API key, works for every school.
export async function fetchHeadlines(schoolName: string): Promise<Headline[]> {
  const q = encodeURIComponent(`"${schoolName}" when:7d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`headlines for ${schoolName} failed: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items: Headline[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      const title = decodeEntities(
        block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? ""
      );
      const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
      const source = decodeEntities(
        block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? ""
      );
      if (title && link.startsWith("http")) {
        items.push({ title, link, source: source || null });
      }
      // Gather generously — the AI editor dedupes and filters down to 5.
      if (items.length >= 15) break;
    }
    return items;
  } catch (err) {
    console.error(`headlines for ${schoolName} failed:`, err);
    return [];
  }
}

type Recipient = {
  id: string;
  name: string;
  email: string;
  refCode: string | null;
};

export type PendingSchool = {
  slug: string;
  name: string;
  subscribers: number;
};

// Schools with confirmed subscribers that haven't received this week's
// edition yet — e.g. a school whose first subscriber arrived after Monday's
// run. These are what a digest run still needs to produce.
export async function listPendingSchools(): Promise<PendingSchool[]> {
  const week = currentWeek();
  const [{ data: subs }, { data: sent }] = await Promise.all([
    supabaseAdmin()
      .from("school_subscriptions")
      .select("school_slug, school_name, signups!inner(verified_at)")
      .not("signups.verified_at", "is", null),
    supabaseAdmin().from("digest_sends").select("school_slug").eq("week", week),
  ]);
  const already = new Set((sent ?? []).map((s) => s.school_slug));
  const bySlug = new Map<string, PendingSchool>();
  for (const row of subs ?? []) {
    if (already.has(row.school_slug)) continue;
    const entry = bySlug.get(row.school_slug) ?? {
      slug: row.school_slug,
      name: row.school_name,
      subscribers: 0,
    };
    entry.subscribers += 1;
    bySlug.set(row.school_slug, entry);
  }
  return [...bySlug.values()];
}

export type SchoolSendOutcome = {
  school: string;
  week: string;
  status: "sent" | "skipped" | "error";
  recipients: number;
  message?: string;
};

// Produce and send one school's digest for the current week: research the
// stories, run the AI editor, email every confirmed subscriber. Safe to call
// repeatedly — the (school, week) lock means each edition sends at most once.
export async function sendSchoolDigest(
  slug: string,
  name: string,
  origin: string
): Promise<SchoolSendOutcome> {
  const week = currentWeek();
  const fail = (message: string): SchoolSendOutcome => ({
    school: name,
    week,
    status: "error",
    recipients: 0,
    message,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return fail("RESEND_API_KEY is not configured");
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";

  // Confirmed subscribers only — an unconfirmed address never gets the digest.
  const { data: subs, error } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("signups!inner(id, name, email, ref_code, verified_at)")
    .eq("school_slug", slug)
    .not("signups.verified_at", "is", null);
  if (error) return fail(`subscription query failed: ${error.message}`);
  const recipients: Recipient[] = (subs ?? []).map((row) => {
    const s = row.signups as unknown as {
      id: string;
      name: string;
      email: string;
      ref_code: string | null;
    };
    return { id: s.id, name: s.name, email: s.email, refCode: s.ref_code };
  });
  if (recipients.length === 0) {
    return { school: name, week, status: "skipped", recipients: 0 };
  }

  // Idempotency lock: claiming the (school, week) row must succeed before
  // any email goes out. The row's id keys open/click analytics.
  const { data: lock, error: lockError } = await supabaseAdmin()
    .from("digest_sends")
    .insert({
      school_slug: slug,
      school_name: name,
      week,
      recipient_count: recipients.length,
    })
    .select("id")
    .single();
  if (lockError || !lock) {
    if (lockError?.code === "23505") {
      return { school: name, week, status: "skipped", recipients: 0 };
    }
    return fail(`lock failed (${lockError?.message})`);
  }
  const sendId = lock.id as string;

  const theme = await getSchoolTheme(slug);
  const headlines = await fetchHeadlines(name);
  const masthead = await getMasthead(slug, name);

  // Everything covered in the past four weeks — the editor won't repeat it.
  const { data: prior } = await supabaseAdmin()
    .from("digest_stories")
    .select("title")
    .eq("school_slug", slug)
    .gte(
      "created_at",
      new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString()
    )
    .order("created_at", { ascending: false })
    .limit(40);
  const previouslyCovered = (prior ?? []).map((p) => p.title);

  const edited = await editDigest(
    name,
    masthead,
    week,
    headlines,
    previouslyCovered
  );

  // Record what this edition covered, so future editions don't repeat it —
  // for the fallback path, that's the raw headlines we're about to send.
  const covered = edited
    ? edited.stories.map((s) => ({
        title: s.headline,
        url: s.link,
        summary: s.summary,
      }))
    : headlines
        .slice(0, 5)
        .map((h) => ({ title: h.title, url: h.link, summary: null }));
  if (covered.length > 0) {
    const { error: storiesError } = await supabaseAdmin()
      .from("digest_stories")
      .insert(
        covered.map((c) => ({
          school_slug: slug,
          week,
          title: c.title,
          url: c.url,
          summary: c.summary,
        }))
      );
    if (storiesError) {
      console.error(`${name}: digest_stories insert failed:`, storiesError);
    }
  }

  const subjectLead =
    edited?.stories[0]?.headline ?? headlines[0]?.title ?? `your ${week} digest`;
  const emails = recipients.map((r) => ({
    from,
    to: r.email,
    subject: `${masthead} — ${subjectLead}`,
    html: digestHtml(slug, name, masthead, week, theme, headlines, edited, r, origin, sendId),
  }));

  // Resend batch accepts up to 100 emails per call.
  let sent = 0;
  const sendErrors: string[] = [];
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error: sendError } = await resend.batch.send(chunk);
    if (sendError) {
      sendErrors.push(sendError.message);
    } else {
      sent += data?.data?.length ?? chunk.length;
    }
  }
  if (sendErrors.length > 0 && sent === 0) {
    return fail(`batch send failed (${sendErrors.join("; ")})`);
  }
  return {
    school: name,
    week,
    status: "sent",
    recipients: sent,
    message: sendErrors.length ? `partial: ${sendErrors.join("; ")}` : undefined,
  };
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export type ResendResult = {
  sent: { school: string; week: string }[];
  skipped: string[]; // schools with no edition on file
  errors: string[];
};

// Re-send the most recent edition of each subscribed school's digest to one
// signup, rebuilt from the stored stories — no research pass, no new
// digest_sends row (opens/clicks keep keying off the original send).
export async function resendLatestDigests(
  signupId: string,
  origin: string
): Promise<ResendResult> {
  const result: ResendResult = { sent: [], skipped: [], errors: [] };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    result.errors.push("RESEND_API_KEY is not configured");
    return result;
  }
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";

  const { data: signup } = await supabaseAdmin()
    .from("signups")
    .select("id, name, email, ref_code")
    .eq("id", signupId)
    .maybeSingle();
  if (!signup) {
    result.errors.push("Signup not found");
    return result;
  }
  const recipient: Recipient = {
    id: signup.id,
    name: signup.name,
    email: signup.email,
    refCode: signup.ref_code,
  };

  const { data: subs } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("school_slug, school_name")
    .eq("signup_id", signupId)
    .order("created_at");
  if (!subs?.length) {
    result.errors.push("This signup follows no schools");
    return result;
  }

  for (const sub of subs) {
    const { data: send } = await supabaseAdmin()
      .from("digest_sends")
      .select("id, week")
      .eq("school_slug", sub.school_slug)
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!send) {
      result.skipped.push(sub.school_name);
      continue;
    }

    const { data: storiesData } = await supabaseAdmin()
      .from("digest_stories")
      .select("title, url, summary")
      .eq("school_slug", sub.school_slug)
      .eq("week", send.week)
      .order("created_at");
    const stories = storiesData ?? [];
    if (stories.length === 0) {
      result.skipped.push(sub.school_name);
      continue;
    }

    const theme = await getSchoolTheme(sub.school_slug);
    const masthead = await getMasthead(sub.school_slug, sub.school_name);

    // Editions with stored summaries rebuild the edited layout (minus the
    // intro, which isn't kept); older ones fall back to plain headlines.
    const edited: EditedDigest | null = stories.every((s) => s.summary)
      ? {
          intro: "",
          stories: stories.map((s) => ({
            headline: s.title,
            summary: s.summary as string,
            source: sourceHost(s.url),
            link: s.url,
          })),
        }
      : null;
    const headlines: Headline[] = stories.map((s) => ({
      title: s.title,
      link: s.url,
      source: sourceHost(s.url) || null,
    }));

    const subjectLead = stories[0].title;
    const { error: sendError } = await resend.emails.send({
      from,
      to: recipient.email,
      subject: `${masthead} — ${subjectLead}`,
      html: digestHtml(
        sub.school_slug,
        sub.school_name,
        masthead,
        send.week,
        theme,
        headlines,
        edited,
        recipient,
        origin,
        send.id as string
      ),
    });
    if (sendError) {
      result.errors.push(`${sub.school_name}: ${sendError.message}`);
    } else {
      result.sent.push({ school: sub.school_name, week: send.week });
    }
  }

  return result;
}

function digestHtml(
  schoolSlug: string,
  schoolName: string,
  masthead: string,
  week: string,
  theme: SchoolTheme | null,
  headlines: Headline[],
  edited: EditedDigest | null,
  recipient: Recipient,
  origin: string,
  sendId: string
) {
  const token = signupToken(recipient.id);
  // Story links route through /api/click so we can count readers who engage.
  const track = (target: string) =>
    `${origin}/api/click?d=${sendId}&t=${token}&u=${encodeURIComponent(target)}`;
  const paper = theme?.paper ?? "#F2A93B";
  const ink = theme?.ink ?? "#1D1812";
  const logo = theme?.pngLogoUrl
    ? `<img src="${theme.pngLogoUrl}" alt="" width="44" height="44"
         style="display: block; max-width: 44px; max-height: 44px; object-fit: contain; background: #ffffff; border-radius: 8px; padding: 4px;" />`
    : "";
  const intro = edited?.intro
    ? `<p style="margin: 0 0 20px; color: #374151; font-size: 15px;">${escapeHtml(edited.intro)}</p>`
    : "";
  const stories = edited
    ? edited.stories
        .map(
          (s) => `
      <div style="margin: 0 0 18px;">
        <a href="${track(s.link)}" style="color: #111827; font-weight: 600; text-decoration: none; font-size: 15px;">${escapeHtml(s.headline)}</a>
        <p style="margin: 4px 0 0; color: #4b5563; font-size: 13px;">${escapeHtml(s.summary)}
        <span style="color: #9ca3af;">· ${escapeHtml(s.source)}</span></p>
      </div>`
        )
        .join("")
    : headlines.length
      ? headlines
          .slice(0, 5)
          .map(
            (h) => `
      <p style="margin: 0 0 16px;">
        <a href="${track(h.link)}" style="color: #111827; font-weight: 600; text-decoration: none; font-size: 15px;">${escapeHtml(h.title)}</a>
        ${h.source ? `<br/><span style="color: #6b7280; font-size: 12px;">${escapeHtml(h.source)}</span>` : ""}
      </p>`
          )
          .join("")
      : `<p style="color: #6b7280;">A quiet week for ${escapeHtml(schoolName)} news — we'll be back with more next Monday.</p>`;
  const inviteUrl = recipient.refCode
    ? `${origin}/?ref=${recipient.refCode}`
    : origin;
  const accountUrl = `${origin}/api/login?token=${token}&next=%2Faccount`;
  const unsubUrl = `${origin}/unsubscribe?token=${token}&school=${encodeURIComponent(schoolSlug)}`;

  return `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
      <div style="background: ${paper}; color: ${ink}; border-radius: 12px 12px 0 0; padding: 20px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8;">startingline presents</div>
            <div style="font-size: 22px; font-weight: 700; margin-top: 2px;">${escapeHtml(masthead)}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">${week} · your weekly digest of all things ${escapeHtml(schoolName)}</div>
          </td>
          <td align="right" width="52">${logo}</td>
        </tr></table>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; padding: 24px;">
        ${intro}
        ${stories}
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 24px;">
          <p style="margin: 0 0 8px; font-weight: 600; font-size: 14px;">This week's draw is live 🎟️</p>
          <p style="margin: 0; color: #4b5563; font-size: 13px;">Every friend who joins with your link and confirms
          earns you another ticket — a match wins a $100 Woodn Grail gift card
          (woodngrail.com).</p>
          <p style="margin: 12px 0 0;"><a href="${inviteUrl}" style="color: #111827; font-weight: 600; font-size: 13px;">${inviteUrl}</a></p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; margin: 24px 0 0;">
          You're getting this because you joined the ${escapeHtml(schoolName)} list on startingline.
          <a href="${accountUrl}" style="color: #9ca3af;">Manage your subscriptions</a> ·
          <a href="${unsubUrl}" style="color: #9ca3af;">Unsubscribe from this digest</a>
        </p>
      </div>
      <img src="${origin}/api/open?d=${sendId}&t=${token}" width="1" height="1" alt="" style="display: block;" />
    </div>
  `;
}

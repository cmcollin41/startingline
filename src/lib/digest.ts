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

export type DigestRunResult = {
  week: string;
  sent: { school: string; recipients: number }[];
  skipped: string[]; // already sent this week
  errors: string[];
};

// Send this week's digest for every school that has confirmed subscribers.
// Safe to call repeatedly: each (school, week) sends at most once.
export async function sendWeeklyDigest(
  origin: string
): Promise<DigestRunResult> {
  const week = currentWeek();
  const result: DigestRunResult = { week, sent: [], skipped: [], errors: [] };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    result.errors.push("RESEND_API_KEY is not configured");
    return result;
  }
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM ?? "startingline <onboarding@resend.dev>";

  // Confirmed subscribers only — an unconfirmed address never gets the digest.
  const { data: subs, error } = await supabaseAdmin()
    .from("school_subscriptions")
    .select(
      "school_slug, school_name, signups!inner(id, name, email, ref_code, verified_at)"
    )
    .not("signups.verified_at", "is", null);
  if (error) {
    result.errors.push(`subscription query failed: ${error.message}`);
    return result;
  }

  const bySchool = new Map<
    string,
    { name: string; recipients: Recipient[] }
  >();
  for (const row of subs ?? []) {
    const signup = row.signups as unknown as {
      id: string;
      name: string;
      email: string;
      ref_code: string | null;
    };
    const entry: { name: string; recipients: Recipient[] } = bySchool.get(
      row.school_slug
    ) ?? { name: row.school_name, recipients: [] };
    entry.recipients.push({
      id: signup.id,
      name: signup.name,
      email: signup.email,
      refCode: signup.ref_code,
    });
    bySchool.set(row.school_slug, entry);
  }

  const processSchool = async (
    slug: string,
    name: string,
    recipients: Recipient[]
  ) => {
    // Idempotency lock: claiming the (school, week) row must succeed before
    // any email goes out.
    const { error: lockError } = await supabaseAdmin()
      .from("digest_sends")
      .insert({
        school_slug: slug,
        school_name: name,
        week,
        recipient_count: recipients.length,
      });
    if (lockError) {
      if (lockError.code === "23505") {
        result.skipped.push(name);
      } else {
        result.errors.push(`${name}: lock failed (${lockError.message})`);
      }
      return;
    }

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
      html: digestHtml(slug, name, masthead, week, theme, headlines, edited, r, origin),
    }));

    // Resend batch accepts up to 100 emails per call.
    let sent = 0;
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100);
      const { data, error: sendError } = await resend.batch.send(chunk);
      if (sendError) {
        result.errors.push(`${name}: batch send failed (${sendError.message})`);
      } else {
        sent += data?.data?.length ?? chunk.length;
      }
    }
    result.sent.push({ school: name, recipients: sent });
  };

  // The editorial research pass is the slow part (minutes per school), so
  // schools run concurrently, a few at a time.
  const queue = [...bySchool.entries()];
  const workers = Array.from(
    { length: Math.min(4, queue.length) },
    async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        const [slug, { name, recipients }] = next;
        try {
          await processSchool(slug, name, recipients);
        } catch (err) {
          result.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  );
  await Promise.all(workers);

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
  origin: string
) {
  const paper = theme?.paper ?? "#F2A93B";
  const ink = theme?.ink ?? "#1D1812";
  const logo = theme?.pngLogoUrl
    ? `<img src="${theme.pngLogoUrl}" alt="" width="44" height="44"
         style="display: block; max-width: 44px; max-height: 44px; object-fit: contain; background: #ffffff; border-radius: 8px; padding: 4px;" />`
    : "";
  const intro = edited
    ? `<p style="margin: 0 0 20px; color: #374151; font-size: 15px;">${escapeHtml(edited.intro)}</p>`
    : "";
  const stories = edited
    ? edited.stories
        .map(
          (s) => `
      <div style="margin: 0 0 18px;">
        <a href="${s.link}" style="color: #111827; font-weight: 600; text-decoration: none; font-size: 15px;">${escapeHtml(s.headline)}</a>
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
        <a href="${h.link}" style="color: #111827; font-weight: 600; text-decoration: none; font-size: 15px;">${escapeHtml(h.title)}</a>
        ${h.source ? `<br/><span style="color: #6b7280; font-size: 12px;">${escapeHtml(h.source)}</span>` : ""}
      </p>`
          )
          .join("")
      : `<p style="color: #6b7280;">A quiet week for ${escapeHtml(schoolName)} news — we'll be back with more next Monday.</p>`;
  const inviteUrl = recipient.refCode
    ? `${origin}/?ref=${recipient.refCode}`
    : origin;
  const unsubUrl = `${origin}/unsubscribe?token=${signupToken(recipient.id)}&school=${encodeURIComponent(schoolSlug)}`;

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
          earns you another ticket — a match wins a $100 gift card for officially licensed
          ${escapeHtml(schoolName)} gear.</p>
          <p style="margin: 12px 0 0;"><a href="${inviteUrl}" style="color: #111827; font-weight: 600; font-size: 13px;">${inviteUrl}</a></p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; margin: 24px 0 0;">
          You're getting this because you joined the ${escapeHtml(schoolName)} list on startingline.
          <a href="${unsubUrl}" style="color: #9ca3af;">Unsubscribe from this digest</a>
        </p>
      </div>
    </div>
  `;
}

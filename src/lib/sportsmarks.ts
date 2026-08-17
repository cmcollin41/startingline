import "server-only";

// Use the www host: the apex 308-redirects to www and the Authorization
// header is dropped on the cross-origin redirect.
const BASE = "https://www.sportsmarks.com/api/v1";

function apiKey() {
  const key = process.env.SPORTSMARK_API_KEY;
  if (!key) {
    throw new Error("Missing SPORTSMARK_API_KEY environment variable");
  }
  return key;
}

// Brand data is public and changes rarely — cache every call for an hour.
async function api<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`sportsmarks ${path} failed: ${res.status}`);
      }
      return null;
    }
    const json = (await res.json()) as { data: T };
    return json.data;
  } catch (err) {
    console.error(`sportsmarks ${path} failed:`, err);
    return null;
  }
}

export type School = {
  slug: string;
  name: string;
  conference: string | null;
};

export async function listSchools(): Promise<School[]> {
  const schools: School[] = [];
  for (let page = 1; page <= 5; page++) {
    const data = await api<{
      institutions: {
        slug: string;
        name: string;
        conference: { name: string } | null;
      }[];
      pagination: { has_next: boolean };
    }>(`/institutions?league=NCAA&per_page=100&page=${page}&sort=name`);
    if (!data) break;
    schools.push(
      ...data.institutions.map((i) => ({
        slug: i.slug,
        name: i.name,
        conference: i.conference?.name ?? null,
      }))
    );
    if (!data.pagination?.has_next) break;
  }
  return schools;
}

// Everything the LottoTicket needs to wear a school's brand.
export type SchoolTheme = {
  slug: string;
  name: string;
  paper: string; // ticket body
  paperAlt: string; // stub shade
  ink: string; // text/barcode, chosen for contrast against paper
  logoUrl: string | null;
  // PNG variant for emails — Gmail and friends block SVG and data: images.
  pngLogoUrl: string | null;
};

const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Mix a hex color toward black (negative amt) or white (positive amt).
function shade(hex: string, amt: number) {
  const target = amt < 0 ? 0 : 255;
  const t = Math.abs(amt);
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (target - c) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export async function getSchoolTheme(
  slug: string
): Promise<SchoolTheme | null> {
  if (!SLUG_RE.test(slug)) return null;

  const colorData = await api<{
    institution: { name: string };
    colors: { name: string; hex: string; is_primary: boolean }[];
  }>(`/institutions/${slug}/colors?format=hex`);
  if (!colorData) return null;

  const valid = colorData.colors.filter((c) => HEX_RE.test(c.hex));
  const primaries = valid.filter((c) => c.is_primary);
  // Paper is the school's lead color; skip whites/near-whites, which make the
  // ticket disappear into the page.
  const paper =
    (primaries.length ? primaries : valid).find(
      (c) => luminance(c.hex) < 0.85
    )?.hex ?? "#F2A93B";

  const dark = luminance(paper) < 0.45;
  const ink = dark ? "#FCFAF4" : "#1D1812";
  const paperAlt = shade(paper, dark ? 0.12 : -0.1);

  const logoData = await api<{
    logos: {
      is_primary: boolean;
      files: { url: string; file_type: string; display_order: number }[];
    }[];
  }>(`/institutions/${slug}/logos`);
  const logos = logoData?.logos ?? [];
  const logo = logos.find((l) => l.is_primary) ?? logos[0];
  const files = logo?.files ?? [];
  const logoUrl = await resolveLogoUrl(files);
  const pngLogoUrl = files.find((f) => f.file_type === "png")?.url ?? null;

  return {
    slug,
    name: colorData.institution.name,
    paper,
    paperAlt,
    ink,
    logoUrl,
    pngLogoUrl,
  };
}

// SVG logos from the catalog sometimes ship without a viewBox, which makes
// them render as a cropped corner instead of scaling into the ticket's logo
// patch. Fetch the SVG (cached for a day), inject a viewBox derived from its
// width/height when missing, and inline it as a data URI. PNG is the fallback.
async function resolveLogoUrl(
  files: { url: string; file_type: string }[]
): Promise<string | null> {
  const svg = files.find((f) => f.file_type === "svg");
  const png = files.find((f) => f.file_type === "png");

  if (svg) {
    try {
      const res = await fetch(svg.url, { next: { revalidate: 86400 } });
      if (res.ok) {
        let text = await res.text();
        if (!/viewBox=/i.test(text)) {
          const tag = text.match(/<svg[^>]*>/i)?.[0] ?? "";
          const w = tag.match(/\swidth="([\d.]+)(?:px)?"/i)?.[1];
          const h = tag.match(/\sheight="([\d.]+)(?:px)?"/i)?.[1];
          if (w && h) {
            text = text.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
          }
        }
        return `data:image/svg+xml;base64,${Buffer.from(text).toString("base64")}`;
      }
    } catch (err) {
      console.error("logo svg fetch failed:", err);
    }
  }
  return png?.url ?? null;
}

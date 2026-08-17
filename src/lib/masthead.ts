import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { supabaseAdmin } from "@/lib/supabase";

// We aren't licensed to use a school's name as the name of the digest, so
// each list gets an original, newspapery masthead evoking the school's
// mascot, colors, geography, or culture — generated once by Claude and
// stored so the name never drifts between editions. The school may still be
// referred to descriptively in body copy ("all things X"); only the
// masthead itself must be original.

const FALLBACK_NAME = "The Weekly Dispatch";

const MastheadSchema = z.object({
  name: z
    .string()
    .describe("The digest's masthead name, e.g. \"The Riverside Howl\""),
  rationale: z
    .string()
    .describe("One sentence on what the name evokes about the school"),
});

async function trademarkedPhrases(slug: string): Promise<string[]> {
  const key = process.env.SPORTSMARK_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://www.sportsmarks.com/api/v1/institutions/${slug}/verbiage`,
      { headers: { Authorization: `Bearer ${key}` }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data: { verbiage: { phrase: string }[] };
    };
    return json.data.verbiage.map((v) => v.phrase.replace(/[®™©]/g, "").trim());
  } catch {
    return [];
  }
}

async function generateMasthead(
  slug: string,
  schoolName: string
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const avoid = await trademarkedPhrases(slug);
  const avoidList = avoid.length
    ? avoid.map((p) => `- ${p}`).join("\n")
    : "(none listed — still avoid the institution's name and acronyms)";

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: `You name email newspapers. Given a university, invent the masthead for an unofficial weekly digest covering all things that school — sports, campus, culture.

Rules:
- The name must feel like a classic newspaper masthead: think Courier, Chronicle, Gazette, Dispatch, Herald, Ledger, Register, Bulletin, Beacon, Sentinel — or a fresher construction with the same editorial weight.
- It must clearly evoke THIS school to its fans — through the mascot, school colors, geography, nickname culture, chants, or local identity.
- It must NOT contain the institution's official name, common short forms, or acronym in any casing.
- It must not reproduce any of the school's registered or trademarked phrases (listed by the caller) verbatim.
- 2 to 4 words. "The" openers are welcome. No puns so obscure a freshman wouldn't get them.

Example of the register (fictional school, wolf mascot, river town): "The Riverside Howl".`,
      messages: [
        {
          role: "user",
          content: `School: ${schoolName}\n\nRegistered/trademarked phrases to avoid verbatim:\n${avoidList}`,
        },
      ],
      output_config: { format: zodOutputFormat(MastheadSchema) },
    });

    const name = response.parsed_output?.name.trim();
    if (!name) return null;

    // Hard checks mirroring the rules: never ship a masthead containing the
    // school's name/acronym or an exact protected phrase.
    const lower = name.toLowerCase();
    const acronym = schoolName
      .split(/\s+/)
      .filter((w) => /^[A-Z]/.test(w))
      .map((w) => w[0])
      .join("")
      .toLowerCase();
    const banned = [
      schoolName.toLowerCase(),
      ...avoid.map((p) => p.toLowerCase()),
      ...(acronym.length >= 2 ? [acronym] : []),
    ];
    if (banned.some((b) => b && lower.includes(b))) {
      console.error(`masthead for ${slug} rejected (contains protected term): ${name}`);
      return null;
    }
    return name;
  } catch (err) {
    console.error(`masthead generation for ${slug} failed:`, err);
    return null;
  }
}

// Returns the school's stored masthead, generating and storing it on first
// use. Falls back to a generic name (without storing it) if generation
// fails, so a digest still sends.
export async function getMasthead(
  slug: string,
  schoolName: string
): Promise<string> {
  const { data } = await supabaseAdmin()
    .from("digest_names")
    .select("digest_name")
    .eq("school_slug", slug)
    .maybeSingle();
  if (data?.digest_name) return data.digest_name;

  const generated = await generateMasthead(slug, schoolName);
  if (!generated) return FALLBACK_NAME;

  const { error } = await supabaseAdmin()
    .from("digest_names")
    .insert({ school_slug: slug, school_name: schoolName, digest_name: generated });
  if (error && error.code !== "23505") {
    console.error(`masthead insert for ${slug} failed:`, error);
  }
  // If a concurrent run inserted first, read back the winning name.
  if (error?.code === "23505") {
    const { data: winner } = await supabaseAdmin()
      .from("digest_names")
      .select("digest_name")
      .eq("school_slug", slug)
      .maybeSingle();
    return winner?.digest_name ?? generated;
  }
  return generated;
}

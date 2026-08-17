import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Headline } from "@/lib/digest";

// The AI editor: given the week's raw Google News headlines and what we've
// already covered in recent weeks, it dedupes, drops irrelevant hits (name
// collisions, tangential mentions), skips previously covered stories unless
// there's a real new development, and writes clean headlines + one-line
// summaries with an intro. Returns null on any failure so the digest can
// fall back to raw headlines and still send on schedule.

const EditedDigestSchema = z.object({
  intro: z
    .string()
    .describe(
      "One or two engaging sentences opening this week's digest, referencing the actual stories"
    ),
  stories: z
    .array(
      z.object({
        headline: z
          .string()
          .describe("Clean, rewritten headline without the publisher suffix"),
        summary: z
          .string()
          .describe("One sentence on what happened and why readers care"),
        link: z
          .string()
          .describe("The url of the source item this story is based on, copied exactly"),
        source: z.string().describe("Publisher name, e.g. 'BYU News'"),
      })
    )
    .describe("Up to 5 distinct stories, most important first"),
});

export type EditedDigest = z.infer<typeof EditedDigestSchema>;

export async function editDigest(
  schoolName: string,
  week: string,
  headlines: Headline[],
  previouslyCovered: string[]
): Promise<EditedDigest | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("editDigest: ANTHROPIC_API_KEY not configured — sending raw headlines");
    return null;
  }
  if (headlines.length === 0) return null;

  const items = headlines
    .map((h, i) => `${i + 1}. ${h.title}\n   url: ${h.link}${h.source ? `\n   source: ${h.source}` : ""}`)
    .join("\n");
  const covered =
    previouslyCovered.length > 0
      ? previouslyCovered.map((t) => `- ${t}`).join("\n")
      : "(none yet)";

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: `You are the editor of "The ${schoolName} Weekly", an email digest covering all things ${schoolName} — sports, campus, research, culture, everything. Your readers are fans and community members who opted in.

You are given raw Google News items from the past week and the titles of stories covered in previous editions. Produce this week's edition (${week}):

- Select up to 5 distinct stories, most important first. Fewer is fine if the week is thin; quality over quantity.
- Merge duplicate coverage of the same story into one entry, choosing the strongest source item.
- Drop items that are not genuinely about ${schoolName} (name collisions, passing mentions, unrelated institutions).
- Never repeat a story already covered in a previous edition unless there is a significant new development this week — and if so, the summary must lead with what's new.
- Rewrite headlines cleanly (no trailing " - Publisher" suffixes, no clickbait).
- Each story's link must be copied exactly from one of the provided items — never invent or modify a URL.
- Keep the tone warm and sharp, like a well-run local newsletter. No hype, no filler.`,
      messages: [
        {
          role: "user",
          content: `This week's raw news items:\n\n${items}\n\nStories covered in previous editions (do not repeat without a new development):\n${covered}`,
        },
      ],
      output_config: {
        format: zodOutputFormat(EditedDigestSchema),
      },
    });

    const edited = response.parsed_output;
    if (!edited) return null;

    // Belt and suspenders: a story may only cite a link we actually provided.
    const validLinks = new Set(headlines.map((h) => h.link));
    const stories = edited.stories.filter((s) => validLinks.has(s.link)).slice(0, 5);
    if (stories.length === 0) return null;
    return { intro: edited.intro, stories };
  } catch (err) {
    console.error(`editDigest for ${schoolName} failed:`, err);
    return null;
  }
}

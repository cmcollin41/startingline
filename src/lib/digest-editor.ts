import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Headline } from "@/lib/digest";

// The AI editor: given the week's raw Google News headlines and what we've
// already covered in recent weeks, it researches each candidate story with
// web search/fetch, then writes headlines + summaries that carry the actual
// substance — the finding, the score, the name, the number — never a teaser.
// Returns null on any failure so the digest can fall back to raw headlines
// and still send on schedule.

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
          .describe(
            "One or two sentences that deliver the story's key fact — the reader learns the substance without clicking"
          ),
        link: z
          .string()
          .describe(
            "URL of the best article for this story — from the provided items or from your research, copied exactly"
          ),
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
      // Research tools. max_uses are capped so the server-side tool loop
      // stays under its 10-iteration limit — exceeding it would pause the
      // turn and break the one-shot parse.
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 3 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
      ],
      system: `You are the editor of "The ${schoolName} Weekly", an email digest covering all things ${schoolName} — sports, campus, research, culture, everything. Your readers are fans and community members who opted in.

You are given raw Google News items from the past week and the titles of stories covered in previous editions. Produce this week's edition (${week}):

- Select up to 5 distinct stories, most important first. Fewer is fine if the week is thin; quality over quantity.
- Merge duplicate coverage of the same story into one entry.
- Drop items that are not genuinely about ${schoolName} (name collisions, passing mentions, unrelated institutions).
- Never repeat a story already covered in a previous edition unless there is a significant new development this week — and if so, the summary must lead with what's new.
- RESEARCH BEFORE WRITING: use web search and web fetch to read the actual reporting behind the stories you select. Budget your limited tool calls on the stories where the headline alone doesn't tell you the substance.
- EVERY SUMMARY MUST DELIVER THE PUNCHLINE. The reader learns the actual fact without clicking: name the finding, the person, the score, the number, the decision. Never write a teaser like "a small, repeatable practice" — say what the practice is. If your research can't surface the substance of a story, drop that story rather than tease it.
- Rewrite headlines cleanly (no trailing " - Publisher" suffixes, no clickbait).
- Each story's link must be a real URL — copied exactly from a provided item or from an article you found during research. Prefer the publisher's direct URL over aggregator links. Never invent or modify a URL.
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

    if (response.stop_reason === "pause_turn" || response.stop_reason === "refusal") {
      console.error(`editDigest for ${schoolName}: stop_reason=${response.stop_reason} — falling back`);
      return null;
    }
    const edited = response.parsed_output;
    if (!edited) return null;

    // A link must at least be a well-formed http(s) URL.
    const stories = edited.stories
      .filter((s) => {
        try {
          return new URL(s.link).protocol.startsWith("http");
        } catch {
          return false;
        }
      })
      .slice(0, 5);
    if (stories.length === 0) return null;
    return { intro: edited.intro, stories };
  } catch (err) {
    console.error(`editDigest for ${schoolName} failed:`, err);
    return null;
  }
}

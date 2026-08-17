import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { currentUserId } from "@/lib/user-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { formatWeek } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// A past digest edition, readable on the web. Only subscribers of the
// edition's school can open it.
export default async function DigestReadPage({
  params,
}: PageProps<"/account/digests/[id]">) {
  const userId = await currentUserId();
  if (!userId) redirect("/signin");
  const { id } = await params;

  const { data: send } = await supabaseAdmin()
    .from("digest_sends")
    .select("id, school_slug, school_name, week, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!send) notFound();

  const { data: sub } = await supabaseAdmin()
    .from("school_subscriptions")
    .select("id")
    .eq("signup_id", userId)
    .eq("school_slug", send.school_slug)
    .maybeSingle();
  if (!sub) notFound();

  const [{ data: storiesData }, { data: masthead }] = await Promise.all([
    supabaseAdmin()
      .from("digest_stories")
      .select("id, title, url, summary")
      .eq("school_slug", send.school_slug)
      .eq("week", send.week)
      .order("created_at"),
    supabaseAdmin()
      .from("digest_names")
      .select("digest_name")
      .eq("school_slug", send.school_slug)
      .maybeSingle(),
  ]);
  const stories = storiesData ?? [];
  const sentOn = new Date(send.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="flex flex-col gap-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
          <Link href="/account/digests">
            <ArrowLeft className="size-4" />
            All digests
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          {send.school_name}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-balance">
          {masthead?.digest_name ?? `${send.school_name} weekly`}
        </h2>
        <p className="text-muted-foreground text-sm">
          {formatWeek(send.week)} · sent {sentOn}
        </p>
      </header>

      <Separator />

      {stories.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          We don&apos;t have the stories for this edition on file — it lives on
          in your inbox.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {stories.map((s) => {
            const host = sourceHost(s.url);
            return (
              <section key={s.id} className="flex flex-col gap-1">
                <h3 className="font-medium text-balance">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {s.title}
                  </a>
                </h3>
                {s.summary && (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {s.summary}
                  </p>
                )}
                {host && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                  >
                    <ExternalLink className="size-3" />
                    {host}
                  </a>
                )}
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

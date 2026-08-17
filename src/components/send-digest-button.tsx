"use client";

import { useState, useTransition } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { queueDigests } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

// Queues digest generation in the background: for one school (slug given) or
// for every school still missing this week's edition. The action returns as
// soon as the workflow is enqueued.
export function SendDigestButton({
  slug,
  school,
  size = "default",
}: {
  slug?: string;
  school?: string;
  size?: "default" | "sm";
}) {
  const [pending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await queueDigests(slug ? [slug] : undefined);
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      if (res.status === "none") {
        toast.info(
          slug
            ? `${school ?? "This school"} has nothing to send — no confirmed subscribers, or this week's edition already went out.`
            : "Nothing to send — every list already got this week's edition."
        );
        return;
      }
      setQueued(true);
      toast.success(
        `Generating ${res.schools.length === 1 ? "the digest" : "digests"} for ${res.schools.join(", ")}`,
        {
          description:
            "Writing and sending in the background — refresh in a few minutes to see the send stats.",
        }
      );
    });
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={run}
      disabled={pending || queued}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Newspaper className="size-4" />
      )}
      {queued ? "Queued" : slug ? "Send digest" : "Send all pending"}
    </Button>
  );
}

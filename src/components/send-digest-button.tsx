"use client";

import { useState, useTransition } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { sendDigestNow } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function SendDigestButton() {
  const [pending, startTransition] = useTransition();
  const [ranOnce, setRanOnce] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await sendDigestNow();
      setRanOnce(true);
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      const { sent, skipped, errors, week } = res.result;
      const delivered = sent.reduce((n, s) => n + s.recipients, 0);
      if (sent.length > 0) {
        toast.success(
          `Sent ${week} digest for ${sent.length} school${sent.length === 1 ? "" : "s"} (${delivered} email${delivered === 1 ? "" : "s"}).`
        );
      } else if (skipped.length > 0) {
        toast.info(`All ${skipped.length} lists already got their ${week} digest.`);
      } else {
        toast.info("No confirmed subscribers to send to yet.");
      }
      for (const e of errors) toast.error(e);
    });
  }

  return (
    <Button variant="outline" onClick={run} disabled={pending || ranOnce}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Newspaper className="size-4" />
      )}
      {pending ? "Sending…" : "Send weekly digest"}
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { Loader2, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { resendDigest } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

// Per-signup resend: fires the latest stored edition of every digest this
// subscriber follows at their inbox again.
export function ResendDigestButton({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await resendDigest(id);
      if (res.status === "error") {
        toast.error("Resend failed", { description: res.message });
        return;
      }
      const { sent, skipped, errors } = res.result;
      if (sent.length > 0) {
        toast.success(
          `Resent ${sent.length} digest${sent.length === 1 ? "" : "s"} to ${email}`,
          {
            description: sent
              .map((s) => `${s.school} (${s.week})`)
              .join(", "),
          }
        );
      }
      if (skipped.length > 0) {
        toast.info(`No edition on file for ${skipped.join(", ")}`);
      }
      for (const e of errors) toast.error("Resend failed", { description: e });
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Resend latest digest to ${email}`}
      title="Resend latest digest"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <MailPlus className="size-4" />
      )}
    </Button>
  );
}

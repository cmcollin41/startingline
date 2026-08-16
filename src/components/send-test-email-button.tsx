"use client";

import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { sendTestEmail } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function SendTestEmailButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendTestEmail();
      if (result.status === "success") {
        toast.success(`Test email sent to ${result.to}`, {
          description: `Resend message ID: ${result.id}`,
        });
      } else {
        toast.error("Failed to send test email", {
          description: result.message,
        });
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Send className="size-4" />
      )}
      {pending ? "Sending…" : "Send test email"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions, http) — the input is selectable.
    }
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="font-mono text-xs"
        aria-label="Your invite link"
      />
      <Button
        type="button"
        variant="outline"
        onClick={copy}
        className="shrink-0"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

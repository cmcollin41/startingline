"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSignup } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

// Deleting a user is destructive, so the button arms on first click and
// deletes on the second.
export function DeleteUserButton({ id, email }: { id: string; email: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await deleteSignup(id);
      if (res.status === "error") toast.error(res.message);
      else toast.success(`Deleted ${email}`);
    });
  }

  return (
    <Button
      variant={armed ? "destructive" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-label={armed ? `Confirm delete ${email}` : `Delete ${email}`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      {armed && !pending ? "Confirm" : null}
    </Button>
  );
}

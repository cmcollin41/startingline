"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.email("Please enter a valid email address").max(254),
});

export type JoinResult =
  | { status: "success" }
  | { status: "duplicate" }
  | { status: "error"; message: string };

export async function joinWaitlist(
  _prev: JoinResult | null,
  formData: FormData
): Promise<JoinResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { name, email } = parsed.data;

  const { error } = await supabaseAdmin()
    .from("signups")
    .insert({ name, email: email.toLowerCase() });

  if (error) {
    // 23505 = unique_violation: the email is already on the list
    if (error.code === "23505") {
      return { status: "duplicate" };
    }
    console.error("joinWaitlist insert failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  return { status: "success" };
}

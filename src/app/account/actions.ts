"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUserId, destroyUserSession } from "@/lib/user-auth";
import { grantSchoolBonus } from "@/lib/referrals";
import { getSchoolTheme } from "@/lib/sportsmarks";
import { supabaseAdmin } from "@/lib/supabase";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);

// Adds a school digest to the signed-in user's account. New schools earn a
// bonus ticket, exactly like re-opting-in through the homepage.
export async function addSubscription(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/signin");

  const parsed = slugSchema.safeParse(formData.get("school"));
  if (!parsed.success) return;
  const school = await getSchoolTheme(parsed.data);
  if (!school) return;

  const { error } = await supabaseAdmin().from("school_subscriptions").insert({
    signup_id: userId,
    school_slug: school.slug,
    school_name: school.name,
  });
  if (!error) {
    await grantSchoolBonus(userId, { slug: school.slug, name: school.name });
  } else if (error.code !== "23505") {
    console.error("addSubscription failed:", error);
  }
  revalidatePath("/account");
}

export async function removeSubscription(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/signin");

  const parsed = slugSchema.safeParse(formData.get("school"));
  if (!parsed.success) return;

  await supabaseAdmin()
    .from("school_subscriptions")
    .delete()
    .eq("signup_id", userId)
    .eq("school_slug", parsed.data);
  revalidatePath("/account");
}

export async function signOut() {
  await destroyUserSession();
  redirect("/");
}

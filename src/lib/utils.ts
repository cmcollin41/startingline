import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// "2026-W34" → "Week 34, 2026"
export function formatWeek(week: string) {
  const m = week.match(/^(\d{4})-W(\d{2})$/)
  return m ? `Week ${Number(m[2])}, ${m[1]}` : week
}

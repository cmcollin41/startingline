import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";

// Tickets are three digits: 000–999. One winning number per ISO week.
export const TICKET_RANGE = 1000;

function lottoSecret() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD environment variable");
  }
  return createHmac("sha256", password)
    .update("startingline-lotto-secret")
    .digest();
}

// ISO 8601 week in UTC, e.g. "2026-W33". The draw rolls over at midnight UTC
// on Monday.
export function currentWeek(now = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// The week's winning number is derived, not stored — nothing in the database
// or client bundle can reveal it.
export function winningNumber(week: string): number {
  const digest = createHmac("sha256", lottoSecret())
    .update(`winning-${week}`)
    .digest();
  return digest.readUInt32BE(0) % TICKET_RANGE;
}

export type IssuedTicket = { number: number; week: string; sig: string };

function ticketSig(number: number, week: string): string {
  return createHmac("sha256", lottoSecret())
    .update(`ticket-${number}-${week}`)
    .digest("hex");
}

// Tickets are issued server-side and signed so the number submitted with the
// form is provably one we handed out this week.
export function issueTicket(): IssuedTicket {
  const week = currentWeek();
  const number = randomInt(TICKET_RANGE);
  return { number, week, sig: ticketSig(number, week) };
}

export function verifyTicket(number: number, week: string, sig: string) {
  if (week !== currentWeek()) return false; // stale tab from a past week
  const expected = Buffer.from(ticketSig(number, week));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

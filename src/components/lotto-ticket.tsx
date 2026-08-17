import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function formatTicket(number: number) {
  return String(number).padStart(3, "0");
}

// The school skin for a ticket — serializable so it can cross the
// server/client boundary from the sportsmarks lookup.
export type TicketTheme = {
  name: string;
  paper: string;
  paperAlt: string;
  ink: string;
  logoUrl: string | null;
};

const DEFAULT_THEME: TicketTheme = {
  name: "Opening draw",
  paper: "#F2A93B",
  paperAlt: "#ED9E22",
  ink: "#1D1812",
  logoUrl: null,
};

// Barcode stripes derived from the ticket number so server and client render
// identically (no randomness at render time).
function barcodeStripes(seed: number) {
  const widths: number[] = [];
  let state = seed * 2654435761 + 1;
  for (let i = 0; i < 28; i++) {
    state = (state * 1103515245 + 12345) % 2147483648;
    widths.push(1 + (state % 3));
  }
  return widths;
}

type Stamp = "winner" | "nomatch";

export function LottoTicket({
  number,
  week,
  stamp,
  theme,
  torn = false,
  className,
}: {
  number: number;
  week: string;
  stamp?: Stamp;
  theme?: TicketTheme | null;
  // A used ticket: the stub has been torn off and dropped in the pot, so
  // only the main panel remains, with a perforated tear down its right edge.
  torn?: boolean;
  className?: string;
}) {
  const t = theme ?? DEFAULT_THEME;
  // Scalloped bite marks down the right edge where the stub tore away.
  const tornEdgeMask: CSSProperties = {
    maskImage:
      "radial-gradient(circle 5px at 100% 8px, transparent 98%, black), linear-gradient(black, black)",
    maskSize: "12px 16px, calc(100% - 12px) 100%",
    maskPosition: "100% 0, 0 0",
    maskRepeat: "repeat-y, no-repeat",
  };
  return (
    <div
      className={cn(
        "-rotate-1 drop-shadow-[0_10px_24px_rgba(20,16,12,0.28)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-500",
        className
      )}
      style={
        {
          "--tk-paper": t.paper,
          "--tk-paper-alt": t.paperAlt,
          "--tk-ink": t.ink,
        } as CSSProperties
      }
    >
      {/* @container so the ticket sizes off its own width, not the viewport —
          it has to survive a narrow phone and a two-up grid column alike */}
      <div
        className={cn(
          "@container relative flex w-full max-w-md overflow-hidden bg-[var(--tk-paper)] text-[var(--tk-ink)] select-none",
          torn ? "rounded-l-lg" : "rounded-lg"
        )}
        style={torn ? tornEdgeMask : undefined}
      >
        {/* hairline rules, like a ticket printed from a roll */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, var(--tk-ink) 0px, var(--tk-ink) 1px, transparent 1px, transparent 4px)",
          }}
        />

        {/* main panel — min-w-0 so it yields to the stub instead of pushing
            the ticket wider than the space it was given */}
        <div className="relative min-w-0 flex-1 p-4 @xs:p-5 @sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            {/* letter-spacing relaxes as the ticket narrows, so a long school
                name keeps more of itself before the ellipsis */}
            <span className="font-ticket shrink-0 text-sm font-semibold tracking-[0.18em] uppercase @sm:tracking-[0.25em]">
              Startingline
            </span>
            <span className="font-ticket min-w-0 truncate text-[11px] font-semibold tracking-[0.08em] uppercase opacity-70 @xs:tracking-[0.12em] @sm:text-xs @sm:tracking-[0.18em]">
              {t.name}
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="flex min-w-0 items-end gap-2">
              <span className="font-mono text-2xl leading-none font-bold opacity-60">
                №
              </span>
              <span className="font-mono text-[clamp(2.5rem,17cqw,4.5rem)] leading-none font-bold tracking-[0.08em] tabular-nums">
                {formatTicket(number)}
              </span>
            </div>
            {t.logoUrl && (
              // explicit dark color so SVG logos using currentColor don't
              // inherit the ticket's white ink and vanish on the patch
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-white p-1.5 text-[#1D1812] shadow-sm @sm:size-14">
                {/* eslint-disable-next-line @next/next/no-img-element -- external CDN asset, unknown dimensions */}
                <img
                  src={t.logoUrl}
                  alt={`${t.name} logo`}
                  className="max-h-full max-w-full object-contain"
                />
              </span>
            )}
          </div>

          <div
            className="mt-4 flex h-8 items-stretch gap-px overflow-hidden"
            aria-hidden
          >
            {barcodeStripes(number).map((w, i) => (
              <div
                key={i}
                className="bg-[var(--tk-ink)]"
                style={{ width: `${w}px`, marginRight: `${(w * 7) % 3}px` }}
              />
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-snug opacity-70">
            Match the weekly number to win a $100 Woodn Grail gift card. One
            ticket per email · draw resets every Monday.
            {torn && (
              <>
                {" · "}
                <span className="font-mono whitespace-nowrap">{week}</span>
              </>
            )}
          </p>
        </div>

        {!torn && (
          <>
            {/* perforation with tear notches */}
            <div className="relative border-l-2 border-dashed border-[var(--tk-ink)]/30">
              <div className="bg-background absolute -top-2.5 -left-2 size-4 rounded-full" />
              <div className="bg-background absolute -bottom-2.5 -left-2 size-4 rounded-full" />
            </div>

            {/* stub — carries the number too, so it can be torn off and
                dropped in the pot like a real raffle ticket */}
            <div className="relative flex w-18 shrink-0 flex-col items-center justify-between bg-[var(--tk-paper-alt)] px-2 py-4 text-center @xs:w-20 @sm:w-24">
              <span className="font-ticket text-[10px] font-semibold tracking-[0.3em] uppercase [writing-mode:vertical-rl] opacity-70">
                Weekly draw
              </span>
              <span className="font-mono text-lg font-bold tracking-[0.08em] tabular-nums">
                № {formatTicket(number)}
              </span>
              <span className="font-ticket text-2xl font-bold">$100</span>
              <span className="font-mono text-[10px] tracking-wider whitespace-nowrap opacity-70 @sm:tracking-widest">
                {week}
              </span>
            </div>
          </>
        )}

        {stamp && (
          <div className="absolute inset-0 grid place-items-center">
            <span
              className={cn(
                "font-ticket -rotate-6 rounded-md border-4 border-double px-3 py-1.5 text-lg tracking-[0.15em] @xs:px-4 @xs:text-xl @sm:text-2xl @sm:tracking-[0.2em] font-bold uppercase motion-safe:animate-in motion-safe:zoom-in-150 motion-safe:fade-in motion-safe:duration-300",
                stamp === "winner"
                  ? "bg-white/80 border-[#C13527] text-[#C13527]"
                  : "bg-[var(--tk-paper)]/70 border-[var(--tk-ink)]/60 text-[var(--tk-ink)]/70"
              )}
            >
              {stamp === "winner" ? "Winner · $100" : "No match"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

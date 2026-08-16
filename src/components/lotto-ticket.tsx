import { cn } from "@/lib/utils";

export function formatTicket(number: number) {
  return String(number).padStart(3, "0");
}

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
  className,
}: {
  number: number;
  week: string;
  stamp?: Stamp;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-rotate-1 drop-shadow-[0_10px_24px_rgba(35,26,16,0.25)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-500",
        className
      )}
    >
      <div className="relative flex w-full max-w-md overflow-hidden rounded-lg bg-[#F2A93B] text-[#231A10] select-none">
        {/* hairline rules, like a ticket printed from a roll */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #231A10 0px, #231A10 1px, transparent 1px, transparent 4px)",
          }}
        />

        {/* main panel */}
        <div className="relative flex-1 p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-ticket text-sm font-semibold tracking-[0.25em] uppercase">
              Startingline
            </span>
            <span className="font-ticket text-xs font-semibold tracking-[0.18em] uppercase opacity-70">
              Opening draw
            </span>
          </div>

          <div className="mt-3 flex items-end gap-2">
            <span className="font-mono text-2xl leading-none font-bold opacity-60">
              №
            </span>
            <span className="font-mono text-6xl leading-none font-bold tracking-[0.08em] tabular-nums sm:text-7xl">
              {formatTicket(number)}
            </span>
          </div>

          <div className="mt-4 flex h-8 items-stretch gap-px" aria-hidden>
            {barcodeStripes(number).map((w, i) => (
              <div
                key={i}
                className="bg-[#231A10]"
                style={{ width: `${w}px`, marginRight: `${(w * 7) % 3}px` }}
              />
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-snug opacity-70">
            Match the weekly number and take $100 off when the store opens. One
            ticket per email · draw resets every Monday.
          </p>
        </div>

        {/* perforation with tear notches */}
        <div className="relative border-l-2 border-dashed border-[#231A10]/30">
          <div className="bg-background absolute -top-2.5 -left-2 size-4 rounded-full" />
          <div className="bg-background absolute -bottom-2.5 -left-2 size-4 rounded-full" />
        </div>

        {/* stub */}
        <div className="relative flex w-20 flex-col items-center justify-between bg-[#ED9E22] px-2 py-4 text-center sm:w-24">
          <span className="font-ticket text-[10px] font-semibold tracking-[0.3em] uppercase [writing-mode:vertical-rl] opacity-70">
            Weekly draw
          </span>
          <span className="font-ticket text-2xl font-bold">$100</span>
          <span className="font-mono text-[10px] tracking-widest opacity-70">
            {week}
          </span>
        </div>

        {stamp && (
          <div className="absolute inset-0 grid place-items-center">
            <span
              className={cn(
                "font-ticket -rotate-6 rounded-md border-4 border-double px-4 py-1.5 text-2xl font-bold tracking-[0.2em] uppercase mix-blend-multiply motion-safe:animate-in motion-safe:zoom-in-150 motion-safe:fade-in motion-safe:duration-300",
                stamp === "winner"
                  ? "border-[#C13527] text-[#C13527]"
                  : "border-[#231A10]/60 text-[#231A10]/60"
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

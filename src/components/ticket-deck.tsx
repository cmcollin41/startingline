"use client";

import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { LottoTicket, type TicketTheme } from "@/components/lotto-ticket";

export type DeckTicket = {
  key: string;
  number: number;
  week: string;
  winner: boolean;
  label: string;
  theme: TicketTheme | null;
};

// Mobile ticket deck: one ticket showing, the next two peeking out beneath
// like a pile. Swiping sends the top card away and — because the carousel
// loops — it cycles around to the bottom of the pile.
export function TicketDeck({ tickets }: { tickets: DeckTicket[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const n = tickets.length;
  const peek1 = n > 1 ? tickets[(current + 1) % n] : null;
  const peek2 = n > 2 ? tickets[(current + 2) % n] : null;

  return (
    <div className="relative">
      {/* the pile underneath — the next tickets, scaled and tucked behind */}
      {peek2 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 origin-top scale-[0.88] opacity-40 transition-all duration-300"
          style={{ transform: "translateY(44px) scale(0.88)" }}
        >
          <LottoTicket number={peek2.number} week={peek2.week} theme={peek2.theme} torn />
        </div>
      )}
      {peek1 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 origin-top opacity-70 transition-all duration-300"
          style={{ transform: "translateY(24px) scale(0.94)" }}
        >
          <LottoTicket number={peek1.number} week={peek1.week} theme={peek1.theme} torn />
        </div>
      )}

      <Carousel setApi={setApi} opts={{ loop: true }} className="relative">
        <CarouselContent>
          {tickets.map((t) => (
            <CarouselItem key={t.key}>
              <LottoTicket
                number={t.number}
                week={t.week}
                stamp={t.winner ? "winner" : "nomatch"}
                theme={t.theme}
                torn
                className="w-full"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* caption + progress for whichever ticket is on top of the pile */}
      <div
        className="relative flex flex-col items-center gap-2"
        style={{ marginTop: n > 1 ? 34 : 8 }}
      >
        <p className="text-muted-foreground text-center text-xs">
          {tickets[current].label} · {tickets[current].week}
        </p>
        {n > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {tickets.map((t, i) => (
              <span
                key={t.key}
                className={
                  i === current
                    ? "bg-foreground h-1.5 w-4 rounded-full transition-all"
                    : "bg-muted-foreground/30 size-1.5 rounded-full transition-all"
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

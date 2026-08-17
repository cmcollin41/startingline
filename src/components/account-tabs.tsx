"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "overview", href: "/account", label: "Overview" },
  { value: "tickets", href: "/account/tickets", label: "Tickets" },
  { value: "digests", href: "/account/digests", label: "Digests" },
] as const;

// Tab strip for the account dashboard. Each tab is a real route — the Tabs
// component only reflects the current pathname, navigation is plain links.
export function AccountTabs() {
  const pathname = usePathname();
  const active =
    TABS.findLast((t) => pathname.startsWith(t.href))?.value ?? "overview";
  return (
    <Tabs value={active}>
      <TabsList className="w-full sm:w-fit">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value} asChild>
            <Link href={t.href} className="sm:px-4">
              {t.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

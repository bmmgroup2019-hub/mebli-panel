"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useCanManage, useCurrentUser, useSeesOffice, useSeesPurchases } from "@/lib/week-store";

type Who = { admin: boolean; buyer: boolean; office: boolean; managers: boolean; purchases: boolean };

/**
 * show — кому пункт видно. office — не для складальників; managers — адміністратор і менеджери;
 * purchases — адміністратор, менеджери й закупівельник.
 * main — чи видно пункт на телефоні завжди; решта ховається під «Ще».
 */
const SECTIONS: { href: string; label: string; show: (w: Who) => boolean; main: (w: Who) => boolean }[] = [
  { href: "/", label: "Головна", show: (w) => w.office, main: () => true },
  { href: "/week", label: "Тиждень", show: () => true, main: () => true },
  { href: "/issues", label: "Проблеми", show: () => true, main: () => true },
  { href: "/projects", label: "Проекти", show: (w) => w.office, main: () => true },
  { href: "/purchases", label: "Закупка", show: (w) => w.purchases, main: (w) => w.buyer },
  { href: "/clients", label: "Замовники", show: (w) => w.managers, main: () => false },
  // Закупівельник не має відрядної зарплати, тож «Виконано» йому ні до чого.
  { href: "/done", label: "Виконано", show: (w) => !w.buyer, main: (w) => !w.office },
  { href: "/materials", label: "Матеріали", show: (w) => w.office || w.buyer, main: () => false },
  { href: "/admin", label: "Адмін", show: (w) => w.admin, main: () => false },
];

const tab = "rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-wash aria-[current=page]:bg-accent-wash aria-[current=page]:font-semibold aria-[current=page]:text-accent-ink";

export function MainNav() {
  const path = usePathname();
  const user = useCurrentUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const who: Who = {
    admin: user?.role === "admin",
    buyer: user?.role === "buyer",
    office: useSeesOffice(),
    managers: useCanManage(),
    purchases: useSeesPurchases(),
  };
  const sections = SECTIONS.filter((section) => section.show(who));
  const isCurrent = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const isMain = (section: (typeof SECTIONS)[number]) => section.main(who);
  const extra = sections.filter((section) => !isMain(section));

  const link = ({ href, label }: (typeof SECTIONS)[number], className: string) => (
    <Link
      key={href}
      href={href}
      aria-current={isCurrent(href) ? "page" : undefined}
      className={className}
      onClick={() => setMoreOpen(false)}
    >
      {label}
    </Link>
  );

  return (
    <nav aria-label="Розділи" className="border-b border-line bg-surface print:hidden">
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-x-4 px-4 py-2">
        <div className="flex gap-0.5">
          {sections.map((section) => link(section, `${tab} ${isMain(section) ? "" : "hidden sm:block"}`))}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-current={extra.some((section) => isCurrent(section.href)) ? "page" : undefined}
            className={`${tab} sm:hidden`}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            Ще
          </button>
        </div>

        <div className="hidden items-center gap-2 text-sm text-ink-2 sm:flex">
          {user?.name}
          <button type="button" className="underline" onClick={signOut}>Вийти</button>
        </div>

        {moreOpen && (
          <div className="absolute right-4 top-full z-20 mt-1 grid min-w-44 gap-0.5 rounded-lg border border-line bg-surface p-1.5 shadow-lg sm:hidden">
            {extra.map((section) => link(section, tab))}
            <div className={`px-2 text-sm text-ink-2 ${extra.length ? "mt-1 border-t border-line pt-2" : "py-1"}`}>
              {user?.name}
              <button type="button" className="ml-2 underline" onClick={signOut}>Вийти</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

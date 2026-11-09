"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useCurrentUser, useSeesOffice } from "@/lib/week-store";

/**
 * main — пункти, що на телефоні видно завжди; решта ховається під «Ще» («worker» — завжди видно лише складальникам).
 * office — не для складальників.
 */
const SECTIONS = [
  { href: "/", label: "Головна", main: true, office: true },
  { href: "/week", label: "Тиждень", main: true },
  { href: "/issues", label: "Проблеми", main: true },
  { href: "/projects", label: "Проекти", main: true, office: true },
  { href: "/done", label: "Виконано", main: "worker" },
  { href: "/materials", label: "Матеріали", main: false, office: true },
  { href: "/admin", label: "Адмін", main: false, adminOnly: true },
];

const tab = "rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-wash aria-[current=page]:bg-accent-wash aria-[current=page]:font-semibold aria-[current=page]:text-accent-ink";

export function MainNav() {
  const path = usePathname();
  const user = useCurrentUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const seesOffice = useSeesOffice();
  const sections = SECTIONS.filter(
    (section) => (!section.adminOnly || user?.role === "admin") && (!section.office || seesOffice),
  );
  const isCurrent = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  // Пункт «worker» на телефоні під «Ще» в офісу, щоб меню влізло в ширину.
  const isMain = (main: boolean | string) => (main === "worker" ? !seesOffice : main);
  const extra = sections.filter((section) => !isMain(section.main));

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
          {sections.map((section) => link(section, `${tab} ${isMain(section.main) ? "" : "hidden sm:block"}`))}
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

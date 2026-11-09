"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useIsAdmin, useWeekData, type WeekData } from "@/lib/week-store";

/** Розділи панелі. count — що показати на картці меню. */
export const ADMIN_SECTIONS = [
  {
    href: "/admin/people",
    label: "Люди",
    about: "Логіни, паролі, ролі й етапи, на яких працює людина.",
    count: (d: WeekData) => `Людей: ${d.people.length}`,
  },
  {
    href: "/admin/clients",
    label: "Замовники",
    about: "Замовники з контактами й проектами: додавання, зміна, пошук і фільтри.",
    count: (d: WeekData) => `Замовників: ${d.clients.length}`,
  },
  {
    href: "/admin/stages",
    label: "Етапи",
    about: "Етапи виробництва, їх порядок і де створюється специфікація.",
    count: (d: WeekData) => `Етапів: ${d.stages.length}`,
  },
  {
    href: "/admin/issue-types",
    label: "Типи проблем",
    about: "Види проблем, які пишуть на «Головній».",
    count: (d: WeekData) => `Типів: ${d.issueTypes.length}`,
  },
  {
    href: "/admin/materials",
    label: "Матеріали",
    about: "Групи матеріалів, одиниці виміру й виробники.",
    count: (d: WeekData) => `Груп: ${d.specGroups.length}, виробників: ${d.makers.length}`,
  },
  {
    href: "/admin/calc",
    label: "Розрахунки",
    about: "Роботи з цінами, ставки зарплати, націнка й заноска.",
    count: (d: WeekData) => `Робіт: ${d.works.length}, націнка ${d.pricing.marginPercent}%`,
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const data = useWeekData();
  const isAdmin = useIsAdmin();
  const path = usePathname();
  if (!data) return null;
  if (!isAdmin) return <p className="text-sm text-ink-2">Цей розділ доступний лише адміністратору.</p>;

  const home = path === "/admin";
  return (
    <>
      <header className="grid gap-3">
        {home ? (
          <h1 className="text-xl font-semibold">Адміністратор</h1>
        ) : (
          <Link href="/admin" className="text-sm text-ink-2 hover:underline">← Адміністратор</Link>
        )}
        {!home && (
          <nav aria-label="Розділи адміністратора" className="flex flex-wrap gap-1 border-b border-line pb-2">
            {ADMIN_SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                aria-current={path === section.href ? "page" : undefined}
                className="rounded-md px-2.5 py-1.5 text-sm text-ink-2 hover:bg-wash aria-[current=page]:bg-wash aria-[current=page]:font-semibold aria-[current=page]:text-ink"
              >
                {section.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {children}
    </>
  );
}

export function AdminHome() {
  const data = useWeekData();
  if (!data) return null;
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ADMIN_SECTIONS.map((section) => (
          <li key={section.href}>
            <Link href={section.href} className="grid h-full gap-1 rounded-lg border border-line bg-surface p-4 hover:bg-wash">
              <span className="font-semibold">{section.label}</span>
              <span className="text-sm text-ink-2">{section.about}</span>
              <span className="mt-1 text-sm">{section.count(data)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">Прототип: паролі видно й вони лежать у браузері. Справжні паролі будуть захищені разом із базою.</p>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useIsAdmin, useWeekData } from "@/lib/week-store";
import { type WeekData } from "@/lib/model";

/** Розділи панелі. count — що показати на картці меню. */
export const ADMIN_SECTIONS = [
  {
    href: "/admin/company",
    label: "Фірма",
    about: "Назва, телефон і адреса для шапки бланків.",
    count: (d: WeekData) => d.company.name || "Не вказано",
  },
  {
    href: "/admin/people",
    label: "Люди",
    about: "Логіни, паролі, ролі й етапи, на яких працює людина.",
    count: (d: WeekData) => `Людей: ${d.people.length}`,
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
    href: "/admin/refusal-reasons",
    label: "Причини відмов",
    about: "Чому клієнти відмовляються до авансу: список для менеджерів.",
    count: (d: WeekData) => `Причин: ${d.refusalReasons.length}`,
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
          <h1 className="text-2xl font-semibold sm:text-3xl">Адміністратор</h1>
        ) : (
          <Link href="/admin" className="w-fit text-sm text-ink-2 hover:text-ink">← Адміністратор</Link>
        )}
        {!home && (
          <nav aria-label="Розділи адміністратора" className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
            {ADMIN_SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                aria-current={path === section.href ? "page" : undefined}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-ink-2 hover:text-ink aria-[current=page]:bg-wash aria-[current=page]:font-semibold aria-[current=page]:text-ink"
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
            <Link
              href={section.href}
              className="group flex h-full flex-col gap-1.5 rounded-lg border border-line bg-surface p-5 hover:border-ink-2/40 hover:bg-wash/40"
            >
              <span className="flex items-center justify-between gap-2 font-semibold">
                {section.label}
                {/* Стрілка зсувається при наведенні — видно, що плитка веде в розділ */}
                <span aria-hidden="true" className="text-ink-2 transition-transform group-hover:translate-x-0.5 group-hover:text-accent">→</span>
              </span>
              <span className="text-sm text-ink-2">{section.about}</span>
              <span className="mt-auto w-fit rounded-full bg-wash px-2.5 py-1 text-xs text-ink-2">{section.count(data)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">Прототип: паролі видно й вони лежать у браузері. Справжні паролі будуть захищені разом із базою.</p>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { signOut, useCanManage, useCurrentUser, useSeesOffice, useSeesPurchases } from "@/lib/week-store";
import { Logo, LogoMark } from "./Logo";

/** Назва системи під лого: за функціями сайт — система управління виробництвом цеху. */
export const SYSTEM_NAME = "Система управління виробництвом";

/**
 * Бічне меню можна згорнути до іконок (прохання користувача 2026-11-21: більше місця для «Тижня»).
 * Вибір запам’ятовується лише в цьому браузері; якщо сховище недоступне — до перезавантаження.
 */
const NAV_KEY = "nav-collapsed";
const NAV_EVENT = "nav-collapsed-change";
let navMemory = false;
const readCollapsed = () => {
  try {
    return localStorage.getItem(NAV_KEY) === "1";
  } catch {
    return navMemory;
  }
};
const subscribeCollapsed = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(NAV_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(NAV_EVENT, callback);
  };
};
const setCollapsed = (value: boolean) => {
  navMemory = value;
  try {
    localStorage.setItem(NAV_KEY, value ? "1" : "0");
  } catch {
    // Сховище недоступне: пам’ятаємо лише до перезавантаження.
  }
  window.dispatchEvent(new Event(NAV_EVENT));
};

type Who = { admin: boolean; buyer: boolean; office: boolean; managers: boolean; purchases: boolean };

/** Лінійні іконки 24×24 (контур), колір — currentColor. */
const ICONS: Record<string, ReactNode> = {
  "/": <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  "/week": (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>
  ),
  "/issues": <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />,
  "/intake": (
    <>
      <rect x="5" y="3.5" width="14" height="18" rx="2" />
      <path d="M9 3.5h6v2.5H9zM8.5 11h7M8.5 15h4.5" />
    </>
  ),
  "/projects": <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />,
  "/purchases": (
    <>
      <circle cx="8" cy="20.5" r="1" />
      <circle cx="19" cy="20.5" r="1" />
      <path d="M2 2.5h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.9-1.5L22 7H5.1" />
    </>
  ),
  "/clients": (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  "/done": (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  "/materials": <path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />,
  "/salary": (
    <>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M16 6V4.5A1.5 1.5 0 0 0 14.5 3h-9A1.5 1.5 0 0 0 4 4.5V6M16 13h.01" />
    </>
  ),
  "/admin": <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  exit: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  collapse: <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />,
  expand: <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />,
};

function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {ICONS[name]}
    </svg>
  );
}

/**
 * show — кому пункт видно. office — не для складальників; managers — адміністратор і менеджери;
 * purchases — адміністратор, менеджери й закупівельник.
 * main — чи стоїть пункт на нижній панелі телефона; решта ховається під «Ще».
 */
const SECTIONS: { href: string; label: string; show: (w: Who) => boolean; main: (w: Who) => boolean }[] = [
  { href: "/", label: "Головна", show: (w) => w.office, main: () => true },
  { href: "/week", label: "Тиждень", show: () => true, main: () => true },
  { href: "/issues", label: "Проблеми", show: () => true, main: () => true },
  // Прийом окремо від «Тижня» (2026-11-26): у менеджерів там 8–10 прорахованих замовлень.
  { href: "/intake", label: "Прийом", show: (w) => w.managers, main: (w) => w.managers },
  { href: "/projects", label: "Проекти", show: (w) => w.office, main: () => true },
  { href: "/purchases", label: "Закупка", show: (w) => w.purchases, main: (w) => w.buyer },
  { href: "/clients", label: "Замовники", show: (w) => w.managers, main: () => false },
  // Закупівельник не має відрядної зарплати, тож «Виконано» йому ні до чого.
  { href: "/done", label: "Виконано", show: (w) => !w.buyer, main: (w) => !w.office },
  { href: "/materials", label: "Матеріали", show: (w) => w.office || w.buyer, main: () => false },
  { href: "/salary", label: "Зарплата", show: (w) => w.admin, main: () => false },
  { href: "/admin", label: "Адмін", show: (w) => w.admin, main: () => false },
];

/** Пункт бічного меню й меню «Ще»: активний — світлий фон і шампань-риска зліва. */
const sideItem =
  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-wash hover:text-ink " +
  "aria-[current=page]:bg-wash aria-[current=page]:font-semibold aria-[current=page]:text-ink " +
  "aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:-left-3 aria-[current=page]:before:w-0.5 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-accent";

/** Кнопка нижньої панелі телефона: іконка над підписом, активна — шампань. */
const barItem =
  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] text-ink-2 transition-colors aria-[current=page]:text-accent-ink";

export function MainNav() {
  const path = usePathname();
  const user = useCurrentUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // Ширина меню — змінна --nav-w на <html>, від неї відступ вмісту в layout.tsx.
  useEffect(() => {
    document.documentElement.dataset.nav = collapsed ? "collapsed" : "open";
  }, [collapsed]);
  const who: Who = {
    admin: user?.role === "admin",
    buyer: user?.role === "buyer",
    office: useSeesOffice(),
    managers: useCanManage(),
    purchases: useSeesPurchases(),
  };
  const sections = SECTIONS.filter((section) => section.show(who));
  const isCurrent = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const main = sections.filter((section) => section.main(who));
  const extra = sections.filter((section) => !section.main(who));

  const link = ({ href, label }: (typeof SECTIONS)[number], className: string, labelClass = "", title?: string) => (
    <Link
      key={href}
      href={href}
      title={title}
      aria-current={isCurrent(href) ? "page" : undefined}
      className={className}
      onClick={() => setMoreOpen(false)}
    >
      <Icon name={href} />
      <span className={labelClass}>{label}</span>
    </Link>
  );

  const initials = (user?.name ?? "")
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userRow = (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-wash text-xs font-semibold text-ink ring-1 ring-line">
        {initials}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{user?.name}</span>
      <button
        type="button"
        onClick={signOut}
        title="Вийти"
        aria-label="Вийти"
        className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-wash hover:text-ink"
      >
        <Icon name="exit" className="size-4" />
      </button>
    </div>
  );

  return (
    <div className="print:hidden">
      {/* ПК: бічне меню */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-60"
        }`}
      >
        {collapsed ? (
          <Link href={sections[0]?.href ?? "/week"} title={`Luxury Mebli · ${SYSTEM_NAME}`} className="grid place-items-center px-3 pb-6 pt-7 text-ink">
            <LogoMark className="h-7 w-auto" />
          </Link>
        ) : (
          <Link href={sections[0]?.href ?? "/week"} className="grid gap-4 px-6 pb-6 pt-7">
            <Logo />
            {/* Що це за сайт: система управління виробництвом цеху */}
            <span className="border-t border-line pt-3 text-[11px] font-medium leading-snug text-accent">{SYSTEM_NAME}</span>
          </Link>
        )}
        <nav aria-label="Розділи" className="grid flex-1 content-start gap-0.5 overflow-y-auto overflow-x-hidden px-3">
          {sections.map((section) =>
            collapsed ? link(section, `${sideItem} justify-center px-0`, "sr-only", section.label) : link(section, sideItem),
          )}
        </nav>
        <div className="grid gap-1 border-t border-line p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Розгорнути меню" : "Згорнути меню"}
            aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}
            aria-expanded={!collapsed}
            className={`flex items-center gap-3 rounded-lg py-2 text-sm text-ink-2 hover:bg-wash hover:text-ink ${collapsed ? "justify-center" : "px-3"}`}
          >
            <Icon name={collapsed ? "expand" : "collapse"} />
            {!collapsed && <span>Згорнути меню</span>}
          </button>
          {collapsed ? (
            <div className="grid justify-items-center gap-1 py-1">
              <span title={user?.name} className="grid size-8 place-items-center rounded-full bg-wash text-xs font-semibold text-ink ring-1 ring-line">
                {initials}
              </span>
              <button
                type="button"
                onClick={signOut}
                title="Вийти"
                aria-label="Вийти"
                className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-wash hover:text-ink"
              >
                <Icon name="exit" className="size-4" />
              </button>
            </div>
          ) : (
            userRow
          )}
        </div>
      </aside>

      {/* Телефон і планшет: верхній рядок з лого */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-page/85 px-4 py-3 backdrop-blur-md lg:hidden">
        <span className="grid min-w-0 gap-1">
          <Logo compact />
          <span className="truncate pl-[2.85rem] text-[10px] leading-none text-accent">{SYSTEM_NAME}</span>
        </span>
        <span className="truncate pl-4 text-xs text-ink-2">{user?.name}</span>
      </header>

      {/* Телефон і планшет: нижня панель */}
      <nav
        aria-label="Розділи"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-xl gap-1 py-1.5">
          {main.map((section) => link(section, barItem, "max-w-full truncate"))}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-current={extra.some((section) => isCurrent(section.href)) ? "page" : undefined}
            className={barItem}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <Icon name="more" />
            <span>Ще</span>
          </button>
        </div>
      </nav>

      {/* Меню «Ще» — аркуш над нижньою панеллю */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mx-auto grid max-w-xl gap-0.5 rounded-2xl border border-line bg-surface p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {extra.map((section) => link(section, sideItem))}
            <div className={extra.length ? "mt-1 border-t border-line pt-1" : ""}>{userRow}</div>
          </div>
        </div>
      )}
    </div>
  );
}

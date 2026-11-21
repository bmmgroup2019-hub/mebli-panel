"use client";

import { useState, type ReactNode } from "react";
import { signIn, useCurrentUser, useWeekData } from "@/lib/week-store";
import { LogoMark } from "./Logo";

const field = "rounded-lg border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-ink-2 focus:border-accent";

/** Показує сайт лише після входу. */
export function AuthGate({ children }: { children: ReactNode }) {
  const data = useWeekData();
  const user = useCurrentUser();
  if (!data) return <p className="py-16 text-center text-ink-2">Завантаження…</p>;
  return user ? <>{children}</> : <LoginForm />;
}

function LoginForm() {
  const [failed, setFailed] = useState(false);
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-5 px-4 py-16">
      {/* Лого фірми над формою входу */}
      <div className="mb-4 grid justify-items-center gap-4 text-ink">
        <LogoMark className="h-20 w-auto" />
        <div className="grid justify-items-center gap-2 leading-none">
          <span className="text-xl font-light uppercase tracking-[0.24em]">Luxury Mebli</span>
          <span className="text-[11px] uppercase tracking-[0.36em] text-ink-2">Корпусні меблі</span>
        </div>
      </div>
      <h1 className="text-lg font-semibold">Вхід</h1>
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setFailed(!signIn(String(values.get("login")).trim(), String(values.get("password"))));
        }}
      >
        <input name="login" aria-label="Логін" placeholder="Логін" autoComplete="username" className={field} />
        <input
          name="password"
          type="password"
          aria-label="Пароль"
          placeholder="Пароль"
          autoComplete="current-password"
          className={field}
        />
        {failed && <p role="alert" className="text-sm text-critical">Неправильний логін або пароль.</p>}
        <button type="submit" className="rounded-lg bg-accent-fill px-3 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-fill-hover">Увійти</button>
      </form>
      <p className="text-sm text-ink-2">
        Прототип, дані вигадані. Адміністратор: admin / admin. Менеджер: manager / 2222. Менеджер 2: manager2 / 6666. Конструктор: konstruktor / 3333. Оператор ЧПУ: chpu / 4444. Крайка: kraika / 5555. Складальник: zbirka1 / 1111. Монтажник: montazh1 / 7777. Закупівельник: zakupka / 8888.
      </p>
    </main>
  );
}

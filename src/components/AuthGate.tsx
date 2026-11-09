"use client";

import { useState, type ReactNode } from "react";
import { signIn, useCurrentUser, useWeekData } from "@/lib/week-store";

const field = "rounded-md border border-line bg-surface px-3 py-2 text-sm";

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
    <main className="mx-auto grid w-full max-w-sm gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold">Вхід</h1>
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
        <button type="submit" className="rounded-md bg-accent-fill px-3 py-2 text-sm font-semibold text-white hover:bg-accent-fill-hover">Увійти</button>
      </form>
      <p className="text-sm text-ink-2">
        Прототип, дані вигадані. Адміністратор: admin / admin. Менеджер: manager / 2222. Менеджер 2: manager2 / 6666. Конструктор: konstruktor / 3333. Оператор ЧПУ: chpu / 4444. Крайка: kraika / 5555. Складальник: zbirka1 / 1111.
      </p>
    </main>
  );
}

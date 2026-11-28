"use client";

import { useState, type ReactNode } from "react";
import { signIn, useCurrentUser, useDataProblem, useSyncStatus, useWeekData } from "@/lib/week-store";
import { LogoMark } from "./Logo";

const field = "rounded-lg border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-ink-2 focus:border-accent";

/** Показує сайт лише після входу. Помилку зв'язку з базою видно над сторінкою. */
export function AuthGate({ children }: { children: ReactNode }) {
  const data = useWeekData();
  const user = useCurrentUser();
  const problem = useDataProblem();
  const { offline, waiting } = useSyncStatus();
  // Червона — помилка; жовта — немає зв'язку, зміни чекають тут і підуть самі.
  const banner = problem ? (
    <p role="alert" className="sticky top-0 z-50 bg-critical px-4 py-2 text-center text-sm font-medium text-white">{problem}</p>
  ) : offline ? (
    <p role="status" className="sticky top-0 z-50 bg-warning px-4 py-2 text-center text-sm font-medium text-black">
      Немає зв&apos;язку з сервером.{" "}
      {waiting > 0 ? `Змін чекає відправлення: ${waiting} — підуть самі, щойно зв'язок повернеться. Не закривайте сторінку.` : "Дані можуть бути не найсвіжіші."}
    </p>
  ) : null;
  if (!data) return banner || <p className="py-16 text-center text-ink-2">Завантаження…</p>;
  return (
    <>
      {banner}
      {user ? children : <LoginForm />}
    </>
  );
}

function LoginForm() {
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState(false);
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
          setBusy(true);
          signIn(String(values.get("login")).trim(), String(values.get("password")))
            .then((ok) => setFailed(ok ? "" : "Неправильний логін або пароль."))
            .catch((error: Error) => setFailed(`Не вдалося перевірити вхід: ${error.message}`))
            .finally(() => setBusy(false));
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
        {failed && <p role="alert" className="text-sm text-critical">{failed}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-accent-fill px-3 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-fill-hover disabled:opacity-60">
          {busy ? "Перевіряю…" : "Увійти"}
        </button>
      </form>
      <p className="text-sm text-ink-2">
        Прототип, дані вигадані. Адміністратор: admin / admin. Менеджер: manager / 2222. Менеджер 2: manager2 / 6666. Конструктор: konstruktor / 3333. Оператор ЧПУ: chpu / 4444. Крайка: kraika / 5555. Складальник: zbirka1 / 1111. Монтажник: montazh1 / 7777. Закупівельник: zakupka / 8888.
      </p>
    </main>
  );
}

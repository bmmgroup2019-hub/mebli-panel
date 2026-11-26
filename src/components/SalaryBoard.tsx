"use client";

import { useState } from "react";
import { monthLabel, shiftMonth, todayIso } from "@/lib/dates";
import { money, parseNumber } from "@/lib/materials";
import { accruedTotal, balanceOf, paidTotal } from "@/lib/salary";
import { addPayout, removePayout, useIsAdmin, useWeekData, type Person } from "@/lib/week-store";

const input = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
const button = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-wash";
const dayLabel = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}`;

/**
 * Зарплата всіх людей для адміністратора (рішення користувача 2026-11-26): нараховано й виплачено за місяць,
 * залишок за весь час і виплати. Нараховане — від виконаних етапів, як у «Виконано».
 * Закупівельника й адміністратора тут немає: у них немає відрядної зарплати.
 */
export function SalaryBoard() {
  const data = useWeekData();
  const isAdmin = useIsAdmin();
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [paying, setPaying] = useState<Person | null>(null);
  if (!data) return null;
  if (!isAdmin) return <p className="text-sm text-ink-2">Цей розділ доступний лише адміністратору.</p>;

  const people = data.people.filter((p) => p.role === "manager" || p.role === "worker");
  const rows = people.map((person) => ({
    person,
    accrued: accruedTotal(data, person.id, month),
    paid: paidTotal(data, person.id, month),
    balance: balanceOf(data, person.id),
  }));
  const sum = (key: "accrued" | "paid" | "balance") => rows.reduce((total, row) => total + row[key], 0);
  const payouts = data.payouts.filter((p) => p.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const nameOf = (id: string) => data.people.find((p) => p.id === id)?.name ?? "людину прибрано";

  return (
    <>
      <div className="flex w-fit items-stretch overflow-hidden rounded-lg border border-line bg-surface">
        <button type="button" aria-label="Попередній місяць" className="px-3 py-1.5 text-sm text-ink-2 hover:bg-wash hover:text-ink" onClick={() => setMonth(shiftMonth(month, -1))}>←</button>
        <span className="grid min-w-36 place-items-center border-x border-line px-3 text-sm font-semibold">{monthLabel(month)}</span>
        <button type="button" aria-label="Наступний місяць" className="px-3 py-1.5 text-sm text-ink-2 hover:bg-wash hover:text-ink" onClick={() => setMonth(shiftMonth(month, 1))}>→</button>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-ink-2">Нараховано за місяць</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(sum("accrued"))}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-ink-2">Виплачено за місяць</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(sum("paid"))}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-ink-2">Винні людям усього</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-warning">{money(rows.reduce((t, r) => t + Math.max(0, r.balance), 0))}</dd>
          <dd className="text-xs text-ink-2">залишки за весь час</dd>
        </div>
      </dl>

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
        {rows.map(({ person, accrued, paid, balance }) => (
          <li key={person.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid gap-1">
              <span className="font-medium">{person.name}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-2">
                <span>Нараховано: <span className="text-ink tabular-nums">{money(accrued)}</span></span>
                <span>Виплачено: <span className="text-ink tabular-nums">{money(paid)}</span></span>
                <span>
                  {balance < 0 ? "Переплата" : "Залишок"}:{" "}
                  <span className={`font-semibold tabular-nums ${balance > 0 ? "text-warning" : balance < 0 ? "text-critical" : "text-success"}`}>{money(Math.abs(balance))}</span>
                </span>
              </span>
            </div>
            <button type="button" className={`${button} w-fit`} onClick={() => setPaying(person)}>Виплатити</button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-2">Нараховано й виплачено — за вибраний місяць; залишок — за весь час. Деталі по людині — у «Виконано».</p>

      <section className="grid gap-2">
        <h2 className="font-semibold">Виплати за місяць</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-ink-2">Виплат ще немає.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{nameOf(payout.personId)}</span>
                  <span className="block text-xs text-ink-2">
                    {dayLabel(payout.date)}
                    {payout.note && ` · ${payout.note}`}
                  </span>
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {money(payout.amount)}
                  <button type="button" aria-label={`Прибрати виплату ${money(payout.amount)}`} className="px-1 text-ink-2 hover:text-ink" onClick={() => removePayout(payout.id)}>
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {paying && <PayDialog person={paying} balance={balanceOf(data, paying.id)} month={month} onClose={() => setPaying(null)} />}
    </>
  );
}

function PayDialog({ person, balance, month, onClose }: { person: Person; balance: number; month: string; onClose: () => void }) {
  const [error, setError] = useState("");
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby="pay-title"
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <form
        className="grid grid-cols-2 gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const amount = parseNumber(String(values.get("amount") ?? ""));
          const date = String(values.get("date") ?? "");
          if (!amount || !date) {
            setError("Вкажіть суму й дату.");
            return;
          }
          addPayout(person.id, date, amount, String(values.get("note") ?? ""));
          onClose();
        }}
      >
        <h2 id="pay-title" className="col-span-2 text-lg font-semibold">Виплата: {person.name}</h2>
        <p className="col-span-2 text-sm text-ink-2">
          {balance > 0 ? `Залишок до виплати: ${money(balance)}.` : balance < 0 ? `Уже переплачено: ${money(-balance)}.` : "Усе нараховане вже виплачено."}
        </p>
        <label className="grid gap-1 text-xs font-medium text-ink-2">
          Сума, грн
          <input name="amount" inputMode="decimal" aria-label="Сума виплати" defaultValue={balance > 0 ? String(balance).replace(".", ",") : ""} autoFocus className={input} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-ink-2">
          Дата
          <input name="date" type="date" aria-label="Дата виплати" defaultValue={todayIso()} className={input} />
        </label>
        <label className="col-span-2 grid gap-1 text-xs font-medium text-ink-2">
          Примітка
          <input name="note" aria-label="Примітка до виплати" defaultValue={`Зарплата за ${monthLabel(month).toLowerCase()}`} className={input} />
        </label>
        {error && <p role="alert" className="col-span-2 text-sm text-critical">{error}</p>}
        <div className="col-span-2 flex flex-wrap gap-1.5">
          <button type="submit" className="rounded-lg bg-accent-fill px-3.5 py-2 text-sm font-semibold text-accent-on hover:bg-accent-fill-hover">Записати виплату</button>
          <button type="button" className={button} onClick={onClose}>Скасувати</button>
        </div>
      </form>
    </dialog>
  );
}

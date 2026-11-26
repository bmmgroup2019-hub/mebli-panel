"use client";

import { useState } from "react";
import { monthLabel, shiftMonth, todayIso } from "@/lib/dates";
import { money } from "@/lib/materials";
import { accrualOf, balanceOf, doneInMonth, paidTotal } from "@/lib/salary";
import { useCurrentUser, useIsAdmin, useWeekData } from "@/lib/week-store";
import { AccrualDetails } from "./AccrualDetails";

const field = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
const dayLabel = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}`;

/**
 * Виконане за місяць, нарахована зарплата, виплати й залишок. Кожен бачить своє, адміністратор — будь-кого.
 * Виплати вносить адміністратор на сторінці «Зарплата» (рішення користувача 2026-11-26).
 */
export function DoneList() {
  const data = useWeekData();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [personId, setPersonId] = useState<string | null>(null);
  if (!data || !user) return null;

  const person = data.people.find((p) => p.id === (isAdmin ? (personId ?? user.id) : user.id)) ?? user;
  const done = doneInMonth(data, person.id, month).map((entry) => ({ ...entry, accrual: accrualOf(data, entry) }));
  const total = done.reduce((sum, { accrual }) => sum + accrual.total, 0);
  const stageName = (id: string) => data.stages.find((stage) => stage.id === id)?.label ?? "етап прибрано";
  const paid = paidTotal(data, person.id, month);
  const payouts = data.payouts.filter((p) => p.personId === person.id && p.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const balance = balanceOf(data, person.id);

  return (
    <>
      <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        {isAdmin ? (
          <select aria-label="Працівник" value={person.id} onChange={(event) => setPersonId(event.target.value)} className={field}>
            {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <span className="font-semibold">{person.name}</span>
        )}
        {/* Перемикач місяця однією групою */}
        <div className="flex w-fit items-stretch overflow-hidden rounded-lg border border-line bg-surface">
          <button type="button" aria-label="Попередній місяць" className="px-3 py-1.5 text-sm text-ink-2 hover:bg-wash hover:text-ink" onClick={() => setMonth(shiftMonth(month, -1))}>←</button>
          <span className="grid min-w-36 place-items-center border-x border-line px-3 text-sm font-semibold">{monthLabel(month)}</span>
          <button type="button" aria-label="Наступний місяць" className="px-3 py-1.5 text-sm text-ink-2 hover:bg-wash hover:text-ink" onClick={() => setMonth(shiftMonth(month, 1))}>→</button>
        </div>
      </div>

      {/* Підсумок місяця */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-ink-2">Нараховано</dt>
          <dd className={`mt-1 text-2xl font-semibold tabular-nums ${total > 0 ? "text-success" : ""}`}>{money(total)}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-ink-2">Виконано етапів</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{done.length}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-ink-2">Виплачено за місяць</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(paid)}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-ink-2">{balance < 0 ? "Переплата" : "Залишок до виплати"}</dt>
          <dd className={`mt-1 text-2xl font-semibold tabular-nums ${balance > 0 ? "text-warning" : ""}`}>{money(Math.abs(balance))}</dd>
          <dd className="text-xs text-ink-2">за весь час</dd>
        </div>
      </dl>

      {payouts.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-semibold">Виплати за місяць</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  {dayLabel(payout.date)}
                  {payout.note && <span className="text-ink-2"> · {payout.note}</span>}
                </span>
                <span className="font-semibold tabular-nums">{money(payout.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length === 0 ? (
        <p className="text-sm text-ink-2">За цей місяць відмічених етапів немає.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {done.map(({ item, handover, on, accrual }) => (
            <li key={item.id + (handover ? "-h" : "")} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3">
              <span className="min-w-0">
                <span className="font-medium">{item.order}</span>
                <span className="block text-xs text-ink-2">
                  {dayLabel(on)} · {handover ? "Здача замовлення (монтаж завершено)" : stageName(item.stage)}
                </span>
              </span>
              <span className="text-right font-semibold tabular-nums">{money(accrual.total)}</span>
              <span className="col-span-2 text-xs text-ink-2">
                <AccrualDetails accrual={accrual} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-2">Прототип: суми рахуються з кошторису менеджера за цінами й ставками, зафіксованими для кошторису; дані вигадані.</p>
    </>
  );
}

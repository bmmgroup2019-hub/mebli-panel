"use client";

import { useState } from "react";
import { todayIso } from "@/lib/dates";
import { money } from "@/lib/materials";
import { accrualOf, doneInMonth } from "@/lib/salary";
import { useCurrentUser, useIsAdmin, useWeekData } from "@/lib/week-store";
import { AccrualDetails } from "./AccrualDetails";

const field = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];

/** «РРРР-ММ» на delta місяців уперед або назад. */
function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const dayLabel = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}`;

/** Виконане за місяць і нарахована зарплата. Кожен бачить своє, адміністратор — будь-кого. */
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
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Попередній місяць" className={button} onClick={() => setMonth(shiftMonth(month, -1))}>←</button>
          <span className="min-w-32 text-center text-sm font-semibold">{monthLabel(month)}</span>
          <button type="button" aria-label="Наступний місяць" className={button} onClick={() => setMonth(shiftMonth(month, 1))}>→</button>
        </div>
      </div>

      <p className="text-sm">
        <span className="text-ink-2">Виконано: {done.length} · нараховано </span>
        <span className="font-semibold">{money(total)}</span>
      </p>

      {done.length === 0 ? (
        <p className="text-sm text-ink-2">За цей місяць відмічених етапів немає.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {done.map(({ item, handover, on, accrual }) => (
            <li key={item.id + (handover ? "-h" : "")} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-2">
              <span className="min-w-0">
                {item.order}
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
      <p className="text-xs text-ink-2">Прототип: суми рахуються з кошторису менеджера за поточними цінами й ставками, дані вигадані.</p>
    </>
  );
}

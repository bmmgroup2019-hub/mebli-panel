"use client";

import { amount, money } from "@/lib/materials";
import type { Project } from "@/lib/mock-projects";
import { projectProfit } from "@/lib/salary";
import { useWeekData } from "@/lib/week-store";

const round = (value: number) => money(Math.round(value));

/** Доходи та витрати проекту: лише для адміністратора. Усе з кошторису за поточними цінами й ставками. */
export function ProjectProfit({ project }: { project: Project }) {
  const data = useWeekData();
  if (!data) return null;
  if (!project.estimate.length) return <p className="text-sm text-ink-2">Кошторису ще немає: доходи й витрати порахуються, коли менеджер його складе.</p>;

  const { cost, income, expenses, profit, profitPercent } = projectProfit(data, project);

  return (
    <>
      <section className="grid grid-cols-3 gap-2">
        <Card
          label="Дохід"
          value={round(income)}
          note={project.clientPrice === null ? "розрахункова вартість: для клієнта ще не вписано" : `вартість для клієнта; розрахункова ${round(cost.total)}`}
        />
        <Card label="Витрати" value={round(expenses)} note="матеріали, роботи, інше" />
        <Card label="Чистий прибуток" value={round(profit)} note={`рентабельність ${amount(Math.round(profitPercent * 10) / 10)}%`} strong />
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">Витрати</h2>
        <dl className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          <Row label="Матеріали" value={cost.materials} note={cost.unpriced ? `рядків без ціни: ${cost.unpriced}` : undefined} />
          {cost.wages.map(({ stage, accrual }) => (
            <Row key={stage.id} label={`Роботи: ${stage.label}`} value={accrual.total} />
          ))}
          <Row label="Додаткові витрати" value={cost.extras} />
          <div className="flex items-baseline justify-between gap-3 px-3 py-2 font-semibold">
            <dt>Усього витрат</dt>
            <dd className="tabular-nums">{round(expenses)}</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-2">
          Націнка {amount(data.pricing.marginPercent)}% від матеріалів дає прибуток; ставки — у панелі адміністратора, розділ «Розрахунки». Рентабельність — прибуток від вартості для клієнта.
        </p>
      </section>
    </>
  );
}

function Card({ label, value, note, strong = false }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</p>
      <p className="text-xs text-ink-2">{note}</p>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="min-w-0">
        {label}
        {note && <span className="block text-xs text-critical">{note}</span>}
      </dt>
      <dd className="tabular-nums">{round(value)}</dd>
    </div>
  );
}

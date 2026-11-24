"use client";

import { amount, money } from "@/lib/materials";
import type { Project } from "@/lib/mock-projects";
import { frozenNote, pricedData } from "@/lib/prices";
import { projectProfit } from "@/lib/salary";
import { useWeekData } from "@/lib/week-store";

const round = (value: number) => money(Math.round(value));

/** Доходи та витрати проекту: лише для адміністратора. Усе з кошторису: ціни й ставки — зафіксовані для кошторису. */
export function ProjectProfit({ project }: { project: Project }) {
  const data = useWeekData();
  if (!data) return null;
  if (!project.estimate.length) return <p className="text-sm text-ink-2">Кошторису ще немає: доходи й витрати порахуються, коли менеджер його складе.</p>;

  const { cost, income, expenses, profit, profitPercent } = projectProfit(data, project);
  const pricing = pricedData(data, project).pricing;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        <Card
          label="Дохід"
          value={round(income)}
          note={project.clientPrice === null ? "розрахункова вартість: для клієнта ще не вписано" : `вартість для клієнта; розрахункова ${round(cost.total)}`}
        />
        <Card label="Витрати" value={round(expenses)} note="матеріали, роботи, інше" />
        <Card label="Чистий прибуток" value={round(profit)} note={`рентабельність ${amount(Math.round(profitPercent * 10) / 10)}%`} tone={profit < 0 ? "text-critical" : "text-success"} />
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
          Націнка {amount(pricing.marginPercent)}% від матеріалів дає прибуток; ставки — у панелі адміністратора, розділ «Розрахунки». Рентабельність — прибуток від вартості для клієнта.
        </p>
        {project.frozen && <p className="text-xs text-ink-2">{frozenNote(project.frozen)}</p>}
      </section>
    </>
  );
}

/** tone — колір суми (прибуток зелений, збиток червоний). */
function Card({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
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

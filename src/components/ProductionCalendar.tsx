"use client";

import { useState, useSyncExternalStore } from "react";
import {
  WEEKDAYS,
  addDays,
  dayOfMonth,
  diffDays,
  formatShort,
  formatSpan,
  mondayOf,
  todayIso,
  weekdayIndex,
} from "@/lib/dates";
import { STAGES, mockOrders, type PlanOrder, type PlanStage } from "@/lib/mock-plan";

const RANGES = [
  { weeks: 2, label: "2 тижні" },
  { weeks: 4, label: "4 тижні" },
  { weeks: 8, label: "8 тижнів" },
];

const stageLabel = (id: PlanStage["stage"]) => STAGES.find((s) => s.id === id)?.label ?? id;
const stageColor = (id: PlanStage["stage"]) => `var(--stage-${id})`;

const lastDay = (order: PlanOrder) => order.stages[order.stages.length - 1].end;
const daysLate = (order: PlanOrder) => Math.max(0, diffDays(order.deadline, lastDay(order)));
const stageOn = (order: PlanOrder, day: string) =>
  order.stages.find((s) => s.start <= day && day <= s.end);

// Дату знає лише браузер: на сервері в іншому часовому поясі «сьогодні» могло б відрізнятися.
const noSubscription = () => () => {};
const useToday = () => useSyncExternalStore(noSubscription, todayIso, () => null);

type Hover = { order: PlanOrder; stage: PlanStage; x: number; y: number };

export function ProductionCalendar() {
  const today = useToday();
  if (!today) return <p className="py-16 text-center text-ink-2">Завантаження календаря…</p>;
  return <Calendar today={today} />;
}

function Calendar({ today }: { today: string }) {
  const orders = mockOrders(today);
  const [weeks, setWeeks] = useState(4);
  const [shift, setShift] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [opened, setOpened] = useState<PlanOrder | null>(null);

  const thisMonday = mondayOf(today);
  const start = addDays(thisMonday, shift * 7);
  const dayCount = weeks * 7;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(start, i));
  const end = days[days.length - 1];

  const inShop = orders.filter((o) => stageOn(o, today)?.stage === "vyrobnytstvo").length;
  const weekEnd = addDays(thisMonday, 6);
  const installs = orders.filter((o) =>
    o.stages.some((s) => s.stage === "montazh" && s.start <= weekEnd && s.end >= thisMonday),
  ).length;
  const atRisk = orders.filter((o) => daysLate(o) > 0).length;

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="У цеху сьогодні" value={inShop} />
        <Stat label="Монтажі цього тижня" value={installs} />
        <Stat label="Не встигають у термін" value={atRisk} warn={atRisk > 0} />
      </dl>

      <section className="rounded-lg border border-line bg-surface" aria-label="Календар виробництва">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <div className="flex items-center gap-1">
            <NavButton label="Попередній тиждень" onClick={() => setShift(shift - 1)}>←</NavButton>
            <NavButton onClick={() => setShift(0)}>Сьогодні</NavButton>
            <NavButton label="Наступний тиждень" onClick={() => setShift(shift + 1)}>→</NavButton>
            <span className="ml-2 text-sm text-ink-2 tabular-nums">{formatSpan(start, end)}</span>
          </div>
          <div className="flex gap-1" role="group" aria-label="Період">
            {RANGES.map((range) => (
              <button
                key={range.weeks}
                type="button"
                aria-pressed={weeks === range.weeks}
                onClick={() => setWeeks(range.weeks)}
                className="rounded-md px-2.5 py-1.5 text-sm text-ink-2 hover:bg-wash aria-pressed:bg-ink aria-pressed:text-surface"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="sticky top-0 z-10 bg-surface pt-2 md:grid md:grid-cols-[210px_minmax(0,1fr)]">
            <div className="hidden md:block" />
            <DayHeader days={days} today={today} compact={weeks > 2} />
          </div>

          <ul>
            {orders.map((order) => (
              <li key={order.id} className="border-t border-line py-2 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:items-center">
                <OrderName order={order} today={today} onOpen={() => setOpened(order)} />
                <Track
                  order={order}
                  days={days}
                  today={today}
                  compact={weeks > 2}
                  onHover={setHover}
                  onOpen={() => setOpened(order)}
                />
              </li>
            ))}
          </ul>
        </div>

        <Legend />
      </section>

      {hover && <Tooltip hover={hover} />}
      {opened && <OrderDialog order={opened} today={today} onClose={() => setOpened(null)} />}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-1 rounded-lg border border-line bg-surface p-3">
      <dt className="text-xs leading-tight text-ink-2 sm:text-sm">
        {warn && <span aria-hidden="true">⚠ </span>}
        {label}
      </dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function NavButton({ label, onClick, children }: { label?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-wash"
    >
      {children}
    </button>
  );
}

const dayGrid = (count: number) => ({ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` });

function DayHeader({ days, today, compact }: { days: string[]; today: string; compact: boolean }) {
  return (
    <div className="grid pb-1 text-[11px] text-ink-2 tabular-nums" style={dayGrid(days.length)} aria-hidden="true">
      {days.map((day) => {
        const isToday = day === today;
        if (compact) {
          return (
            <div key={day} className="relative whitespace-nowrap">
              {weekdayIndex(day) === 0 ? formatShort(day) : ""}
              {isToday && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-ink">▼</span>}
            </div>
          );
        }
        return (
          <div key={day} className={`text-center leading-tight ${isToday ? "font-semibold text-ink" : ""}`}>
            <div>{WEEKDAYS[weekdayIndex(day)]}</div>
            <div>{dayOfMonth(day)}</div>
          </div>
        );
      })}
    </div>
  );
}

function OrderName({ order, today, onOpen }: { order: PlanOrder; today: string; onOpen: () => void }) {
  const current = stageOn(order, today);
  const late = daysLate(order);
  return (
    <button type="button" onClick={onOpen} className="mb-1 block w-full min-w-0 pr-3 text-left md:mb-0">
      <span className="block truncate text-sm font-medium hover:underline">{order.name}</span>
      <span className="block truncate text-xs text-ink-2">
        {late > 0 ? (
          <><span aria-hidden="true">⚠ </span>Запізнення {late} дн.</>
        ) : current ? (
          `${stageLabel(current.stage)} до ${formatShort(current.end)}`
        ) : order.stages[0].start > today ? (
          `Старт ${formatShort(order.stages[0].start)}`
        ) : (
          `Термін ${formatShort(order.deadline)}`
        )}
      </span>
    </button>
  );
}

function Track({
  order,
  days,
  today,
  compact,
  onHover,
  onOpen,
}: {
  order: PlanOrder;
  days: string[];
  today: string;
  compact: boolean;
  onHover: (hover: Hover | null) => void;
  onOpen: () => void;
}) {
  const start = days[0];
  const end = days[days.length - 1];
  const percent = (count: number) => (count / days.length) * 100;
  const deadlineVisible = order.deadline >= start && order.deadline <= end;

  return (
    <div className="relative h-8">
      <div className="absolute inset-0 grid" style={dayGrid(days.length)} aria-hidden="true">
        {days.map((day) => {
          const weekday = weekdayIndex(day);
          const tone = day === today ? "bg-today" : weekday >= 5 ? "bg-wash" : "";
          const rule = !compact || weekday === 0 ? "border-l border-line" : "";
          return <div key={day} className={`${tone} ${rule}`} />;
        })}
      </div>

      {order.stages
        .filter((s) => s.end >= start && s.start <= end)
        .map((s) => {
          const from = s.start < start ? start : s.start;
          const to = s.end > end ? end : s.end;
          const left = percent(diffDays(start, from));
          const width = percent(diffDays(from, to) + 1);
          const describe = (x: number, y: number) => onHover({ order, stage: s, x, y });
          return (
            <button
              key={s.stage}
              type="button"
              aria-label={`${order.name}: ${stageLabel(s.stage)}, ${formatSpan(s.start, s.end)}`}
              onClick={onOpen}
              onMouseMove={(e) => describe(e.clientX, e.clientY)}
              onMouseLeave={() => onHover(null)}
              onFocus={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                describe(box.left + box.width / 2, box.top);
              }}
              onBlur={() => onHover(null)}
              className="group absolute inset-y-0 flex items-center"
              style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)` }}
            >
              <span
                className="h-4 w-full rounded group-hover:h-5"
                style={{ background: stageColor(s.stage) }}
              />
            </button>
          );
        })}

      {deadlineVisible && (
        <span
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink"
          style={{ left: `${percent(diffDays(start, order.deadline) + 1)}%` }}
          aria-label={`Термін здачі ${formatShort(order.deadline)}`}
          role="img"
        >
          <span className="absolute -top-0.5 left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-ink" />
        </span>
      )}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line p-3 text-xs text-ink-2">
      {STAGES.map((stage) => (
        <li key={stage.id} className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: stageColor(stage.id) }} />
          {stage.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rotate-45 bg-ink" />
        Термін здачі
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm border border-line bg-today" />
        Сьогодні
      </li>
    </ul>
  );
}

function Tooltip({ hover }: { hover: Hover }) {
  const { order, stage, x, y } = hover;
  const halfWidth = 110;
  const left = Math.min(Math.max(x, halfWidth + 8), window.innerWidth - halfWidth - 8);
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-30 w-[220px] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface p-2 text-xs shadow-lg"
      style={{ left, top: y - 10 }}
    >
      <div className="font-medium">{order.name}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: stageColor(stage.stage) }} />
        {stageLabel(stage.stage)}
      </div>
      <div className="text-ink-2 tabular-nums">
        {formatSpan(stage.start, stage.end)}, днів: {diffDays(stage.start, stage.end) + 1}
      </div>
    </div>
  );
}

function OrderDialog({ order, today, onClose }: { order: PlanOrder; today: string; onClose: () => void }) {
  const late = daysLate(order);
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{order.name}</h2>
            <p className="text-sm text-ink-2">Термін здачі: {formatShort(order.deadline)}</p>
          </div>
          <form method="dialog">
            <button type="submit" aria-label="Закрити" className="rounded-md px-2 py-1 text-ink-2 hover:bg-wash">
              ✕
            </button>
          </form>
        </div>

        {late > 0 && (
          <p className="rounded-md bg-wash p-2 text-sm">
            <span aria-hidden="true">⚠ </span>
            Монтаж закінчується {formatShort(lastDay(order))}, це на {late} дн. пізніше терміну.
          </p>
        )}

        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Етап</th>
              <th>Дати</th>
              <th>Днів</th>
            </tr>
          </thead>
          <tbody>
            {order.stages.map((s) => {
              const isNow = s.start <= today && today <= s.end;
              return (
                <tr key={s.stage} className={`border-t border-line ${isNow ? "font-medium" : ""}`}>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: stageColor(s.stage) }} />
                      {stageLabel(s.stage)}
                      {isNow && <span className="text-xs font-normal text-ink-2">зараз</span>}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatSpan(s.start, s.end)}</td>
                  <td className="w-10 py-1.5 text-right text-ink-2 tabular-nums">{diffDays(s.start, s.end) + 1}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}

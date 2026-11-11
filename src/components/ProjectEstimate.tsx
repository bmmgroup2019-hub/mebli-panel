"use client";

import { amount, money, parseNumber } from "@/lib/materials";
import type { Project } from "@/lib/mock-projects";
import { projectCost } from "@/lib/salary";
import { addExtra, clientOf, ownsStagePay, removeExtra, updateProject, useCurrentUser, useIsAdmin, useProjectAccess, useWeekData } from "@/lib/week-store";
import { AccrualDetails } from "./AccrualDetails";
import { ProjectSpec } from "./ProjectSpec";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";

/**
 * Кошторис менеджера: матеріали, додаткові витрати, поверх для заноски й вартість проекту.
 * Не пов'язаний зі специфікацією конструктора. Бачать лише адміністратор і менеджер.
 * Менеджер у підсумку не бачить націнки й зарплат інших етапів: лише матеріали, свою зарплату, заноску, додаткові витрати й разом.
 */
export function ProjectEstimate({ project }: { project: Project }) {
  const data = useWeekData();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const { canEdit } = useProjectAccess(project);
  if (!data) return null;
  const cost = projectCost(data, project);
  // Лише зарплата, яка справді належить цій людині (у чужому проекті прийом — не її).
  const mine = cost.wages.filter(({ stage }) => ownsStagePay(data, user, project, stage.id));
  const carry = cost.wages.reduce((sum, { accrual }) => sum + (accrual.carry?.sum ?? 0), 0);

  return (
    <>
      <ProjectSpec project={project} list="estimate" />

      <section className="grid gap-2">
        <h2 className="font-semibold">Додаткові витрати</h2>
        {project.extras.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {project.extras.map((extra) => (
              <li key={extra.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">{extra.name}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  {money(extra.amount)}
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Прибрати витрату ${extra.name}`}
                      className="px-1 text-ink-2 hover:text-ink"
                      onClick={() => removeExtra(project.id, extra.id)}
                    >
                      ×
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!canEdit && project.extras.length === 0 && <p className="text-sm text-ink-2">Немає.</p>}
        {canEdit && (
          <form
            className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const values = new FormData(form);
              const name = String(values.get("name") ?? "").trim();
              const sum = parseNumber(String(values.get("amount") ?? ""));
              if (!name || !sum) return;
              addExtra(project.id, { name, amount: sum });
              form.reset();
            }}
          >
            <input name="name" aria-label="Нова витрата" placeholder="Силікон, доставка…" className={input} />
            <input name="amount" inputMode="decimal" aria-label="Сума витрати" placeholder="Сума, грн" className={input} />
            <button type="submit" className={button}>Додати</button>
          </form>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">Заноска</h2>
        <p className="text-sm">
          Поверх: <span className="font-semibold">{clientOf(data, project)?.floor ?? "не вказано"}</span>
          <span className="text-ink-2">
            {data.pricing.floorRate ? ` · ${money(data.pricing.floorRate)} за поверх` : " · ціну за поверх не задано"} · з даних замовника («Загальне»)
          </span>
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">Вартість проекту</h2>
        <dl className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          <Line label="Матеріали" value={cost.materials} note={cost.unpriced ? `без ціни рядків: ${cost.unpriced}` : undefined} />
          {isAdmin ? (
            <>
              <Line label={`Націнка ${amount(data.pricing.marginPercent)}%`} value={cost.margin} />
              {cost.wages.map(({ stage, accrual }) => (
                <Line key={stage.id} label={`Зарплата: ${stage.label}`} value={accrual.total} details={<AccrualDetails accrual={accrual} />} />
              ))}
            </>
          ) : (
            <>
              {mine.map(({ stage, accrual }) => (
                <Line
                  key={stage.id}
                  label={mine.length > 1 ? `Ваша зарплата: ${stage.label}` : "Ваша зарплата"}
                  value={accrual.total - (accrual.carry?.sum ?? 0)}
                  details={<AccrualDetails accrual={{ ...accrual, carry: null, total: accrual.total - (accrual.carry?.sum ?? 0) }} />}
                />
              ))}
              <Line label="Заноска" value={carry} />
            </>
          )}
          <Line label="Додаткові витрати" value={cost.extras} />
          <div className="flex items-baseline justify-between gap-3 px-3 py-2 font-semibold">
            <dt>Розрахункова вартість</dt>
            <dd className="tabular-nums">{money(cost.total)}</dd>
          </div>
        </dl>
        <div className="grid gap-1 rounded-lg border border-line bg-surface p-3">
          <label className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-3 text-sm font-semibold">
            Вартість для клієнта
            {canEdit ? (
              <input
                key={project.clientPrice ?? "none"}
                inputMode="decimal"
                defaultValue={project.clientPrice ?? ""}
                placeholder="Сума, грн"
                className={`${input} text-right tabular-nums`}
                onBlur={(event) => {
                  const value = parseNumber(event.target.value);
                  if (value !== project.clientPrice) updateProject(project.id, { clientPrice: value && value > 0 ? value : null });
                }}
              />
            ) : (
              <span className="text-right tabular-nums">{project.clientPrice === null ? "Не вписано" : money(project.clientPrice)}</span>
            )}
          </label>
          <p className="text-xs text-ink-2">
            Цю суму озвучують клієнтові й від неї рахують оплати; зарплати — від розрахункової.
            {project.clientPrice !== null &&
              (project.clientPrice >= cost.total
                ? ` Запас: ${money(Math.round(project.clientPrice - cost.total))}.`
                : ` Нижче за розрахункову на ${money(Math.round(cost.total - project.clientPrice))}.`)}
          </p>
        </div>
        <p className="text-xs text-ink-2">
          {isAdmin
            ? "Ціни матеріалів і робіт — з довідника, націнка й ставки — з панелі адміністратора."
            : "У розрахункову вартість також входять націнка й роботи інших етапів — їх задає адміністратор."}
        </p>
      </section>

      {project.changes.length > 0 && <Changes project={project} />}
    </>
  );
}

/** Зміни після авансу, новіші першими: що було й що стало, хто й коли. Їх треба погодити із замовником. */
function Changes({ project }: { project: Project }) {
  const day = (iso: string) => iso.split("-").reverse().join(".");
  return (
    <section className="grid gap-2">
      <h2 className="font-semibold">Зміни після авансу</h2>
      <p className="text-xs text-ink-2">Аванс уже внесено: ці зміни треба погодити із замовником.</p>
      <ul className="divide-y divide-line rounded-lg border border-warning/40 bg-surface text-sm">
        {[...project.changes].reverse().map((change) => (
          <li key={change.id} className="grid gap-0.5 px-3 py-2">
            <span className="min-w-0">{change.label}</span>
            <span className="tabular-nums">
              {change.from === "—" ? (
                <>додано: <span className="font-medium">{change.to}</span></>
              ) : (
                <>
                  <span className="text-ink-2 line-through decoration-ink-2/60">{change.from}</span> → <span className="font-medium">{change.to}</span>
                </>
              )}
            </span>
            <span className="text-xs text-ink-2">
              {day(change.date)}
              {change.author && ` · ${change.author}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Line({ label, value, note, details }: { label: string; value: number; note?: string; details?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2">
      <dt className="min-w-0">
        {label}
        {note && <span className="block text-xs text-critical">{note}</span>}
        {details && <span className="block text-xs text-ink-2">{details}</span>}
      </dt>
      <dd className="tabular-nums">{money(value)}</dd>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { dueLabel, formatShort, todayIso } from "@/lib/dates";
import { projectLabel, type Project } from "@/lib/mock-projects";
import { addPayment, clientOf, removePayment, isFinished, ownsStagePay, projectAccess, specAccess, useProjectAccess, updateProject, useCanManage, useCurrentUser, useIsAdmin, useWeekData } from "@/lib/week-store";
import { ClientDialog } from "./ClientDialog";
import { stageAccrual } from "@/lib/salary";
import { AccrualDetails } from "./AccrualDetails";
import { ProjectEstimate } from "./ProjectEstimate";
import { ProjectProfit } from "./ProjectProfit";
import { ProjectSpec } from "./ProjectSpec";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
const money = (value: number) => `${value.toLocaleString("uk-UA")} грн`;

type Tab = "main" | "estimate" | "spec" | "finance" | "profit";

export function ProjectCard({ id }: { id: string }) {
  const data = useWeekData();
  const canManage = useCanManage();
  const isAdmin = useIsAdmin();
  const user = useCurrentUser();
  const [tab, setTab] = useState<Tab>("main");
  if (!data) return null;

  const project = data.projects.find((p) => p.id === id);
  if (!project) {
    return (
      <p className="text-sm text-ink-2">
        Проект не знайдено. <Link href="/projects" className="underline">До списку</Link>
      </p>
    );
  }

  const label = projectLabel(project);
  const finished = isFinished(data, label);
  const access = projectAccess(data, user, project);
  const managerName = data.people.find((person) => person.id === project.managerId)?.name;
  const readOnlyNote =
    user?.role !== "manager" || access.canEdit
      ? ""
      : access.own
        ? finished
          ? "Виробництво завершено: змінює лише адміністратор."
          : "Проект передано на наступний етап: змінює лише адміністратор."
        : "Проект іншого менеджера: лише перегляд.";

  const tabs: { id: Tab; label: string; note?: string }[] = [
    { id: "main", label: "Загальне" },
    // Кошторис і гроші бачать лише адміністратор і менеджер.
    ...(canManage ? [{ id: "estimate" as const, label: "Кошторис" }] : []),
    {
      id: "spec",
      label: "Специфікація",
      note: project.spec.length > 0 && specAccess(data, user, project).sees ? String(project.spec.length) : undefined,
    },
    ...(canManage ? [{ id: "finance" as const, label: "Розрахунки" }] : []),
    // Прибуток бачить лише адміністратор.
    ...(isAdmin ? [{ id: "profit" as const, label: "Доходи та витрати" }] : []),
  ];
  // Працівник не бачить розрахунків, навіть якщо вкладку вибрали раніше під іншою роллю.
  const current = tabs.some((t) => t.id === tab) ? tab : "main";

  return (
    <>
      <header>
        <Link href="/projects" className="text-sm text-ink-2 hover:underline">← Проекти</Link>
        <h1 className="mt-1 text-xl font-semibold">{project.product}</h1>
        <p className="text-sm text-ink-2">
          №{project.number} · {project.client}
          {!finished && ` · ${dueLabel(project.dueOn, todayIso())}`}
          {canManage && managerName && ` · менеджер: ${managerName}`}
        </p>
        {project.adminEditedOn && (
          <p className="text-xs text-ink-2">Змінено адміністратором {project.adminEditedOn.split("-").reverse().join(".")}</p>
        )}
        {canManage && project.changes.length > 0 && (
          <p className="text-xs text-warning">
            Змінено після авансу {project.changes.at(-1)!.date.split("-").reverse().join(".")} — що саме, у «Кошторисі»
          </p>
        )}
        {readOnlyNote && <p className="text-xs text-ink-2">{readOnlyNote}</p>}
      </header>

      <div role="tablist" aria-label="Розділи проекту" className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-line print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={current === t.id}
            aria-controls="project-tab"
            onClick={() => setTab(t.id)}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-2.5 py-2 text-sm text-ink-2 hover:text-ink aria-selected:border-accent aria-selected:font-semibold aria-selected:text-ink"
          >
            {t.label}
            {t.note && <span className="ml-1.5 font-normal text-ink-2">{t.note}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="project-tab" aria-labelledby={`tab-${current}`} className="grid gap-5">
        {current === "main" && <MainFields project={project} />}
        {current === "estimate" && <ProjectEstimate project={project} />}
        {current === "spec" && <ProjectSpec project={project} />}
        {current === "finance" && <Finance project={project} />}
        {current === "profit" && <ProjectProfit project={project} />}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-0.5 text-xs text-ink-2">
      {label}
      {children}
    </label>
  );
}

function MainFields({ project }: { project: Project }) {
  const data = useWeekData();
  const canManage = useProjectAccess(project).canEdit;
  const [clientDialog, setClientDialog] = useState<"edit" | "new" | null>(null);
  if (!data) return null;
  const client = clientOf(data, project);

  const item = (label: string, value: ReactNode, wide = false) => (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd>{value || "Не вказано"}</dd>
    </div>
  );
  const contacts = (
    <>
      {item("Телефон", client?.phone && <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="underline">{client.phone}</a>)}
      {item("Поверх", client?.floor)}
      {item("Адреса", client?.address, true)}
    </>
  );

  if (!canManage) {
    return (
      <>
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
          {item("Замовник", project.client)}
          {contacts}
          {item("Дата прийому", project.acceptedOn && formatShort(project.acceptedOn))}
          {item("Дата здачі", project.dueOn && formatShort(project.dueOn))}
        </dl>
        <MyPay project={project} />
      </>
    );
  }

  /** Порожню назву не зберігаємо, повертаємо попередню. */
  const saveProduct = (target: HTMLInputElement) => {
    const value = target.value.trim();
    if (value === project.product) return;
    if (value === "") target.value = project.product;
    else updateProject(project.id, { product: value });
  };
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name, "uk"));

  return (
    <>
      <section className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2">
        <Field label="Номер">
          {/* Номер проставляється автоматично й не змінюється. */}
          <span className="py-1.5 text-sm font-semibold text-ink tabular-nums">№{project.number}</span>
        </Field>
        <Field label="Виріб">
          <input defaultValue={project.product} className={input} onBlur={(e) => saveProduct(e.target)} />
        </Field>
        <Field label="Дата прийому">
          <input
            type="date"
            className={input}
            value={project.acceptedOn}
            onChange={(e) => updateProject(project.id, { acceptedOn: e.target.value })}
          />
        </Field>
        <Field label="Дата здачі">
          <input
            type="date"
            className={input}
            value={project.dueOn}
            onChange={(e) => updateProject(project.id, { dueOn: e.target.value })}
          />
        </Field>
      </section>

      <section className="grid gap-2 rounded-lg border border-line bg-surface p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Field label="Замовник">
            <select
              value={project.clientId}
              className={input}
              onChange={(e) => {
                if (e.target.value === "new") setClientDialog("new");
                else updateProject(project.id, { clientId: e.target.value });
              }}
            >
              {!client && <option value={project.clientId}>{project.client}</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
              <option value="new">+ Новий замовник…</option>
            </select>
          </Field>
          {client && (
            <button type="button" className={button} onClick={() => setClientDialog("edit")}>
              Змінити дані
            </button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">{contacts}</dl>
      </section>

      {clientDialog === "edit" && client && <ClientDialog client={client} onClose={() => setClientDialog(null)} />}
      {clientDialog === "new" && (
        <ClientDialog
          onClose={() => setClientDialog(null)}
          onAdded={(clientId) => updateProject(project.id, { clientId })}
        />
      )}
    </>
  );
}

/** Працівнику — лише його зарплата за проект: вартості й розрахунків він не бачить. */
function MyPay({ project }: { project: Project }) {
  const data = useWeekData();
  const user = useCurrentUser();
  if (!data || !user) return null;
  const mine = data.stages
    .filter((stage) => ownsStagePay(data, user, project, stage.id))
    .map((stage) => ({ stage, accrual: stageAccrual(data, project, stage.id) }))
    .filter(({ accrual }) => accrual.kind !== "none" || accrual.carry);
  if (mine.length === 0) return null;
  const total = mine.reduce((sum, { accrual }) => sum + accrual.total, 0);
  return (
    <section className="grid gap-1 rounded-lg border border-line bg-surface p-3 text-sm">
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">Ваша зарплата за проект</span>
        <span className="font-semibold tabular-nums">{money(Math.round(total * 100) / 100)}</span>
      </p>
      {mine.map(({ stage, accrual }) => (
        <p key={stage.id} className="text-xs text-ink-2">
          {mine.length > 1 && <span className="block text-ink">{stage.label}</span>}
          <AccrualDetails accrual={accrual} />
        </p>
      ))}
    </section>
  );
}

function Finance({ project }: { project: Project }) {
  const { canPay, own } = useProjectAccess(project);
  const data = useWeekData();
  const isAdmin = useIsAdmin();
  const finished = data ? isFinished(data, projectLabel(project)) : false;
  // Менеджер прибирає лише оплати свого періоду: до передачі — аванс, після завершення — доплати.
  // Аванс, внесений до передачі, після неї змінює лише адміністратор.
  const canRemove = (payment: Project["payments"][number]) => isAdmin || (canPay && Boolean(payment.final) === finished);
  const paid =project.payments.reduce((sum, payment) => sum + payment.amount, 0);
  // Клієнт платить вартість, яку вписав менеджер (не розрахункову).
  const price = project.clientPrice;
  const left = price === null ? null : price - paid;
  const payments = [...project.payments].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="grid gap-2">
      <h2 className="font-semibold">Розрахунки</h2>

      <dl className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-lg border border-line bg-surface p-3">
          <dt className="text-xs text-ink-2">Вартість</dt>
          <dd className="font-semibold">{price === null ? "Не вписано" : money(Math.round(price))}</dd>
          <dd className="text-xs text-ink-2">для клієнта, з кошторису</dd>
        </div>
        <div className="min-w-0 rounded-lg border border-line bg-surface p-3">
          <dt className="text-xs text-ink-2">Оплачено</dt>
          <dd className="font-semibold">{money(paid)}</dd>
        </div>
        <div className="min-w-0 rounded-lg border border-line bg-surface p-3">
          <dt className="text-xs text-ink-2">{left !== null && left < 0 ? "Переплата" : "Залишок"}</dt>
          <dd className="font-semibold">{left === null ? "—" : money(Math.round(Math.abs(left)))}</dd>
        </div>
      </dl>

      {payments.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {payments.map((payment, index) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>{index === 0 ? "Аванс" : "Оплата"} · {formatShort(payment.date)}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {money(payment.amount)}
                {canRemove(payment) && (
                  <button
                    type="button"
                    aria-label={`Прибрати оплату ${money(payment.amount)}`}
                    className="px-1 text-ink-2 hover:text-ink"
                    onClick={() => removePayment(project.id, payment.id)}
                  >
                    ×
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">Оплат ще немає.</p>
      )}

      {!canPay && (
        <p className="text-xs text-ink-2">
          {own ? "Доплату можна внести, коли монтаж завершено." : "Оплати вносить менеджер проекту: аванс — до передачі у виробництво, доплату — після монтажу."}
        </p>
      )}
      {canPay && (
        <form
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            const amount = Number(values.get("amount"));
            const date = String(values.get("date") ?? "");
            if (!date || !(amount > 0)) return;
            addPayment(project.id, date, amount);
            form.reset();
          }}
        >
          <input name="date" type="date" aria-label="Дата оплати" defaultValue={todayIso()} className={input} />
          <input name="amount" type="number" min="1" aria-label="Сума оплати" placeholder="Сума" className={input} />
          <button type="submit" className={button}>Додати</button>
        </form>
      )}
    </section>
  );
}


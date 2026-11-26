"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { dueLabel, formatShort, todayIso } from "@/lib/dates";
import { parseNumber } from "@/lib/materials";
import { DETAIL_FIELDS, isKitchen, projectLabel, type Project } from "@/lib/mock-projects";
import { addPayment, clientOf, estimateLocked, removePayment, isFinished, ownsStagePay, projectAccess, specAccess, useProjectAccess, updateProject, useCanManage, useCurrentUser, useIsAdmin, useWeekData } from "@/lib/week-store";
import { ClientDialog } from "./ClientDialog";
import { stageAccrual } from "@/lib/salary";
import { AccrualDetails } from "./AccrualDetails";
import { ProjectEstimate } from "./ProjectEstimate";
import { ProjectProfit } from "./ProjectProfit";
import { ProjectSpec } from "./ProjectSpec";
import { OrderBlank } from "./OrderBlank";
import { RefuseButton, RefusalNote } from "./ProjectRefusal";

const input = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
const button = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-wash";
/** Картка-розділ усередині проекту. */
const panel = "rounded-lg border border-line bg-surface p-4";
const money = (value: number) => `${value.toLocaleString("uk-UA")} грн`;

type Tab = "main" | "estimate" | "spec" | "finance" | "profit";

export function ProjectCard({ id }: { id: string }) {
  const data = useWeekData();
  const canManage = useCanManage();
  const isAdmin = useIsAdmin();
  const user = useCurrentUser();
  const [tab, setTab] = useState<Tab>("main");
  const [blank, setBlank] = useState(false);
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
    user?.role !== "manager" || access.canEdit || project.refusal
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
  // Бланк прийому замовлення — замість вкладок, поки його не закрили.
  if (blank && canManage) return <OrderBlank project={project} onBack={() => setBlank(false)} />;

  return (
    <>
      <header className="grid gap-3">
        <Link href="/projects" className="w-fit text-sm text-ink-2 hover:text-ink">← Проекти</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              №{project.number} · {project.client}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{project.product}</h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
          <RefuseButton project={project} />
          {canManage && (
            <button type="button" className={`${button} inline-flex items-center gap-2 print:hidden`} onClick={() => setBlank(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
              </svg>
              Друк бланка
            </button>
          )}
          </div>
        </div>
        {/* Мітки: строк, менеджер, позначки змін */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {project.refusal ? (
            <span className="rounded-full bg-critical/15 px-2.5 py-1 text-critical">Відмова {project.refusal.on.split("-").reverse().join(".")}</span>
          ) : finished ? (
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-success">Завершено</span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 ${project.dueOn && project.dueOn < todayIso() ? "bg-critical/15 text-critical" : "bg-wash text-ink-2"}`}
            >
              {dueLabel(project.dueOn, todayIso())}
            </span>
          )}
          {canManage && managerName && <span className="rounded-full bg-wash px-2.5 py-1 text-ink-2">Менеджер: {managerName}</span>}
          {project.adminEditedOn && (
            <span className="rounded-full bg-wash px-2.5 py-1 text-ink-2">
              Змінено адміністратором {project.adminEditedOn.split("-").reverse().join(".")}
            </span>
          )}
          {canManage && project.changes.length > 0 && (
            <span className="rounded-full bg-warning/15 px-2.5 py-1 text-warning">
              Змінено після авансу {project.changes.at(-1)!.date.split("-").reverse().join(".")} — що саме, у «Кошторисі»
            </span>
          )}
        </div>
        {readOnlyNote && <p className="text-xs text-ink-2">{readOnlyNote}</p>}
      </header>

      <RefusalNote project={project} />

      <div
        role="tablist"
        aria-label="Розділи проекту"
        className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1 print:hidden"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={current === t.id}
            aria-controls="project-tab"
            onClick={() => setTab(t.id)}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-ink-2 hover:text-ink aria-selected:bg-wash aria-selected:font-semibold aria-selected:text-ink"
          >
            {t.label}
            {t.note && <span className="ml-1.5 rounded-full bg-page px-1.5 py-0.5 text-[11px] font-normal text-ink-2 tabular-nums">{t.note}</span>}
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
    <label className="grid min-w-0 gap-1 text-xs font-medium text-ink-2">
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
      <dt className="mb-0.5 text-xs font-medium text-ink-2">{label}</dt>
      <dd>{value || "Не вказано"}</dd>
    </div>
  );
  const contacts = (
    <>
      {item("Телефон", client?.phone && <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="underline">{client.phone}</a>)}
      {item("Адреса", client?.address, true)}
    </>
  );

  if (!canManage) {
    return (
      <>
        <dl className={`grid grid-cols-2 gap-4 ${panel} text-sm`}>
          {item("Замовник", project.client)}
          {contacts}
          {item("Поверх", project.floor)}
          {item("Дата прийому", project.acceptedOn && formatShort(project.acceptedOn))}
          {item("Дата здачі", project.dueOn && formatShort(project.dueOn))}
        </dl>
        <OrderDetailsSection project={project} canEdit={false} />
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
  /** Поверх — ціле число; порожнє поле — не вказано. Заноска однаково рахується мінімум за 3 поверхи. */
  const saveFloor = (target: HTMLInputElement) => {
    const value = parseNumber(target.value);
    const floor = value ? Math.round(value) : null;
    if (floor !== project.floor) updateProject(project.id, { floor });
    target.value = floor === null ? "" : String(floor);
  };
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name, "uk"));

  return (
    <>
      <section className={`grid gap-3 ${panel} sm:grid-cols-2`}>
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
        <Field label="Поверх (для заноски)">
          {estimateLocked(project) ? (
            <span className="grid gap-0.5 py-1.5">
              <span className="text-sm text-ink">{project.floor ?? "Не вказано"}</span>
              <span className="font-normal">Аванс внесено: поверх закрито, від нього заноска.</span>
            </span>
          ) : (
            <input
              key={project.floor ?? "none"}
              inputMode="numeric"
              defaultValue={project.floor ?? ""}
              placeholder="Не вказано"
              className={input}
              onBlur={(e) => saveFloor(e.target)}
            />
          )}
        </Field>
      </section>

      <section className={`grid gap-3 ${panel}`}>
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
        <dl className="grid grid-cols-2 gap-4 border-t border-line pt-3 text-sm">{contacts}</dl>
      </section>

      <OrderDetailsSection project={project} canEdit />

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

/**
 * Загальні відомості для бланка прийому: фасад, фурнітура, техніка (лише кухня), стіни й підготовка, особливі примітки.
 * Хто не може змінювати — бачить лише заповнене.
 */
function OrderDetailsSection({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const fields = DETAIL_FIELDS.filter((field) => !field.kitchen || isKitchen(project.product));
  if (!canEdit) {
    const filled = fields.filter((field) => project.details[field.key]);
    if (filled.length === 0) return null;
    return (
      <dl className={`grid gap-4 ${panel} text-sm`}>
        {filled.map((field) => (
          <div key={field.key}>
            <dt className="mb-0.5 text-xs font-medium text-ink-2">{field.label}</dt>
            <dd className="whitespace-pre-line">{project.details[field.key]}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <section className={`grid gap-3 ${panel}`}>
      <h2 className="font-semibold">Відомості для бланка</h2>
      {fields.map((field) => (
        <Field key={field.key} label={field.label}>
          <textarea
            key={project.details[field.key]}
            rows={2}
            defaultValue={project.details[field.key]}
            placeholder={field.placeholder}
            className={input}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value !== project.details[field.key]) updateProject(project.id, { details: { ...project.details, [field.key]: value } });
            }}
          />
        </Field>
      ))}
    </section>
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
    <section className={`grid gap-1.5 ${panel} text-sm`}>
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
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Розрахунки</h2>

      <div className={`grid gap-4 ${panel}`}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs font-medium text-ink-2">Вартість</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{price === null ? "Не вписано" : money(Math.round(price))}</dd>
            <dd className="text-xs text-ink-2">для клієнта, з кошторису</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-ink-2">Оплачено</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${left !== null && left <= 0 ? "text-success" : ""}`}>{money(paid)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-ink-2">{left !== null && left < 0 ? "Переплата" : "Залишок"}</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${left !== null && left < 0 ? "text-warning" : ""}`}>
              {left === null ? "—" : money(Math.round(Math.abs(left)))}
            </dd>
          </div>
        </dl>
        {/* Скільки від вартості вже внесено */}
        {price !== null && price > 0 && (
          <span className="block h-1.5 rounded-full bg-wash" aria-hidden="true">
            <span
              className={`block h-full rounded-full ${left !== null && left <= 0 ? "bg-success" : "bg-accent"}`}
              style={{ width: `${Math.min(100, (paid / price) * 100)}%` }}
            />
          </span>
        )}
      </div>

      {payments.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {payments.map((payment, index) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
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


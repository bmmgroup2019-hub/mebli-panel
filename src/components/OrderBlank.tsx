"use client";

import type { ReactNode } from "react";
import { DETAIL_FIELDS, isKitchen, type Project } from "@/lib/mock-projects";
import { clientOf, useWeekData } from "@/lib/week-store";

const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
const money = (value: number) => `${Math.round(value).toLocaleString("uk-UA")} грн`;
const day = (iso: string) => (iso ? iso.split("-").reverse().join(".") : "");

/**
 * Бланк прийому замовлення: шапка фірми, замовник, замовлення, загальні відомості (фасад, фурнітура, техніка для кухні,
 * стіни й підготовка), особливі примітки, вартість і аванс, умови підготовки до монтажу, підписи.
 * На екрані — як аркуш паперу, друкується лише він (#print-blank у globals.css).
 */
export function OrderBlank({ project, onBack }: { project: Project; onBack: () => void }) {
  const data = useWeekData();
  if (!data) return null;
  const { company } = data;
  const client = clientOf(data, project);
  const manager = data.people.find((person) => person.id === project.managerId)?.name ?? "";
  // Аванс — оплати до завершення виробництва (доплати позначені final).
  const advance = project.payments.filter((payment) => !payment.final).reduce((sum, payment) => sum + payment.amount, 0);
  const price = project.clientPrice;
  const general = DETAIL_FIELDS.filter((field) => field.key !== "notes" && (!field.kitchen || isKitchen(project.product)));

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        <button
          type="button"
          className="rounded-md bg-accent-fill px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-fill-hover"
          onClick={() => window.print()}
        >
          Друкувати
        </button>
        <button type="button" className={button} onClick={onBack}>
          ← До проекту
        </button>
      </div>

      <article id="print-blank" className="grid gap-5 rounded-lg bg-white p-5 text-sm text-black sm:p-8 print:rounded-none print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/40 pb-3">
          <div className="flex items-start gap-3">
            {company.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- логотип із даних (data URL), не з файлів сайту
              <img src={company.logo} alt="" className="h-16 max-w-40 object-contain" />
            )}
            <div>
              <p className="text-base font-bold">{company.name || "Назва фірми"}</p>
              {company.phone && <p>{company.phone}</p>}
              {company.address && <p>{company.address}</p>}
              {company.extra && <p>{company.extra}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-bold">Бланк прийому замовлення №{project.number}</p>
            <p>від {day(project.acceptedOn)}</p>
          </div>
        </header>

        <Block title="Замовник">
          <Row label="Ім'я" value={client?.name ?? project.client} />
          <Row label="Телефон" value={client?.phone} />
          <Row label="Адреса" value={client?.address} />
          <Row label="Поверх" value={client?.floor ?? undefined} />
        </Block>

        <Block title="Замовлення">
          <Row label="Виріб" value={project.product} />
          <Row label="Дата прийому" value={day(project.acceptedOn)} />
          <Row label="Орієнтовна дата здачі" value={day(project.dueOn)} />
          <Row label="Менеджер" value={manager} />
        </Block>

        <Block title="Загальні відомості">
          {general.map((field) => (
            <Row key={field.key} label={field.label} value={project.details[field.key]} />
          ))}
        </Block>

        <section className="grid gap-1">
          <h2 className="font-bold">Особливі примітки</h2>
          {project.details.notes ? (
            <p className="whitespace-pre-line">{project.details.notes}</p>
          ) : (
            // Порожньо — три лінії, щоб дописати від руки.
            <div className="grid gap-5 pt-3">
              {[0, 1, 2].map((line) => (
                <span key={line} className="border-b border-black/40" />
              ))}
            </div>
          )}
        </section>

        <Block title="Розрахунок">
          <Row label="Вартість замовлення" value={price === null ? undefined : money(price)} strong />
          <Row label="Аванс" value={advance ? money(advance) : undefined} />
          <Row label="Залишок до сплати" value={price === null ? undefined : money(Math.max(price - advance, 0))} strong />
        </Block>

        {company.installTerms && (
          <section className="grid gap-1 text-xs">
            <h2 className="font-bold">Підготовка до монтажу</h2>
            <p className="whitespace-pre-line">{company.installTerms}</p>
          </section>
        )}

        <div className="grid gap-6 pt-6 sm:grid-cols-2">
          <Signature who="Замовник" name={client?.name ?? project.client} />
          <Signature who="Менеджер" name={manager} />
        </div>
      </article>
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <h2 className="font-bold">{title}</h2>
      <dl className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-3 gap-y-1">{children}</dl>
    </section>
  );
}

/** Порожнє значення — лінія, щоб дописати від руки. */
function Row({ label, value, strong = false }: { label: string; value?: ReactNode; strong?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <>
      <dt className="text-black/70">{label}</dt>
      <dd className={`whitespace-pre-line ${strong ? "font-bold" : ""} ${empty ? "border-b border-black/40" : ""}`}>
        {empty ? " " : value}
      </dd>
    </>
  );
}

function Signature({ who, name }: { who: string; name: string }) {
  return (
    <div className="grid gap-2">
      <p className="font-bold">{who}</p>
      <p className="flex items-end gap-2">
        <span className="h-5 min-w-0 flex-1 border-b border-black/60" aria-label="Місце для підпису" />
        {name && <span className="whitespace-nowrap">/ {name} /</span>}
      </p>
      <p className="text-black/70">Дата: «____» ______________ 20___ р.</p>
    </div>
  );
}

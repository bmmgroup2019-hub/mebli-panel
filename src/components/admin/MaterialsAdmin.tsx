"use client";

import { useState } from "react";
import { parseNumber } from "@/lib/materials";
import type { StagePay } from "@/lib/mock-projects";
import {
  addMaker,
  addSpecGroup,
  addUnit,
  addWork,
  removeMaker,
  removeSpecGroup,
  removeUnit,
  removeWork,
  renameMaker,
  updateSpecGroup,
  updatePricing,
  updateStage,
  updateWork,
  useWeekData,
  type WeekData,
} from "@/lib/week-store";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";

type Tab = "groups" | "units" | "makers" | "works" | "pay" | "pricing";

/** Два розділи панелі з одного набору вкладок: «Матеріали» й «Розрахунки». */
const PARTS = {
  materials: {
    title: "Матеріали",
    about: "Групи, одиниці виміру й виробники. Самі матеріали додають у розділі «Матеріали» → «Довідник».",
    tabs: [
      { id: "groups", label: "Групи" },
      { id: "units", label: "Одиниці виміру" },
      { id: "makers", label: "Виробники" },
    ],
  },
  calc: {
    title: "Розрахунки",
    about: "Роботи з цінами, ставки зарплати етапів, націнка й заноска — від них вартість проекту й зарплата.",
    tabs: [
      { id: "works", label: "Роботи" },
      { id: "pay", label: "Зарплата" },
      { id: "pricing", label: "Вартість" },
    ],
  },
} satisfies Record<string, { title: string; about: string; tabs: { id: Tab; label: string }[] }>;
export type AdminPart = keyof typeof PARTS;

/** Панель адміна: довідники для матеріалів (part="materials") або налаштування розрахунків (part="calc"). */
export function MaterialsAdmin({ data, part = "materials" }: { data: WeekData; part?: AdminPart }) {
  const { title, about, tabs } = PARTS[part];
  const [tab, setTab] = useState<Tab>(tabs[0].id);
  const [error, setError] = useState("");
  const counts: Record<Tab, number | null> = {
    groups: data.specGroups.length,
    units: data.units.length,
    makers: data.makers.length,
    works: data.works.length,
    pay: null,
    pricing: null,
  };

  return (
    <section className="grid gap-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-ink-2">{about}</p>
      </div>

      <div role="tablist" aria-label={title} className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setError("");
            }}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-2.5 py-2 text-sm text-ink-2 hover:text-ink aria-selected:border-accent aria-selected:font-semibold aria-selected:text-ink"
          >
            {t.label} <span className="font-normal text-ink-2">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {tab === "groups" && <Groups data={data} onError={setError} />}
      {tab === "units" && <Units data={data} onError={setError} />}
      {tab === "makers" && <Makers data={data} onError={setError} />}
      {tab === "works" && <Works data={data} onError={setError} />}
      {tab === "pay" && <Pay data={data} />}
      {tab === "pricing" && <Pricing data={data} />}

      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
    </section>
  );
}

type Props = { data: WeekData; onError: (text: string) => void };

/** Форма з одним полем «назва». */
function AddForm({ label, onAdd }: { label: string; onAdd: (name: string) => boolean }) {
  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const name = String(new FormData(form).get("name") ?? "").trim();
        if (name && onAdd(name)) form.reset();
      }}
    >
      <input name="name" aria-label={label} placeholder={label} className={input} />
      <button type="submit" className={button}>Додати</button>
    </form>
  );
}

/** Рядок із назвою, яку можна змінити, і кнопкою «Прибрати». */
function NameRow({
  name,
  label,
  note,
  onRename,
  onRemove,
}: {
  name: string;
  label: string;
  note: string;
  onRename: (name: string) => boolean;
  onRemove: () => void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-2">
      <input
        aria-label={label}
        defaultValue={name}
        className={input}
        onBlur={(event) => {
          const next = event.target.value.trim();
          if (next === name) return;
          if (!next || !onRename(next)) event.target.value = name;
        }}
      />
      <span className="whitespace-nowrap text-xs text-ink-2">{note}</span>
      <button type="button" className={button} onClick={onRemove}>Прибрати</button>
    </li>
  );
}

const countLabel = (count: number) => `матеріалів: ${count}`;

function Groups({ data, onError }: Props) {
  const inSpecs = (groupId: string) =>
    data.projects.reduce((sum, project) => sum + project.spec.filter((row) => row.groupId === groupId).length, 0);
  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-2">Групи матеріалів і специфікації.</p>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {data.specGroups.map((group) => {
          const count = data.materials.filter((m) => m.groupId === group.id).length;
          return (
            <NameRow
              key={group.id}
              name={group.name}
              label="Назва групи"
              note={countLabel(count)}
              onRename={(name) => {
                const saved = updateSpecGroup(group.id, { name });
                onError(saved ? "" : "Така група вже є.");
                return saved;
              }}
              onRemove={() =>
                onError(
                  removeSpecGroup(group.id)
                    ? ""
                    : `У групі «${group.name}» є матеріали: у довіднику ${count}, у специфікаціях ${inSpecs(group.id)}.`,
                )
              }
            />
          );
        })}
      </ul>
      <AddForm
        label="Нова група"
        onAdd={(name) => {
          const added = addSpecGroup(name);
          onError(added ? "" : "Така група вже є.");
          return added;
        }}
      />
    </div>
  );
}

function Units({ data, onError }: Props) {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-2">Одиницю вибирають у кожному матеріалі й рядку специфікації.</p>
      <ul className="flex flex-wrap gap-1.5">
        {data.units.map((unit) => (
          <li key={unit} className="flex items-center gap-1 rounded-md border border-line bg-surface py-1 pl-2.5 pr-1 text-sm">
            {unit}
            <button
              type="button"
              aria-label={`Прибрати одиницю ${unit}`}
              className="px-1 text-ink-2 hover:text-ink"
              onClick={() => onError(removeUnit(unit) ? "" : `Одиницю «${unit}» має матеріал довідника.`)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <AddForm
        label="Нова одиниця"
        onAdd={(name) => {
          const added = addUnit(name);
          onError(added ? "" : "Така одиниця вже є.");
          return added;
        }}
      />
    </div>
  );
}

function Makers({ data, onError }: Props) {
  const makers = [...data.makers].sort((a, b) => a.localeCompare(b, "uk"));
  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-2">Нова назва виробника переходить і в його матеріали.</p>
      {makers.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {makers.map((maker) => {
            const count = data.materials.filter((m) => m.maker === maker).length;
            return (
              <NameRow
                key={maker}
                name={maker}
                label="Назва виробника"
                note={countLabel(count)}
                onRename={(name) => {
                  const saved = renameMaker(maker, name);
                  onError(saved ? "" : "Такий виробник уже є.");
                  return saved;
                }}
                onRemove={() => onError(removeMaker(maker) ? "" : `У виробника «${maker}» є матеріали: ${count}.`)}
              />
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">Виробників ще немає.</p>
      )}
      <AddForm
        label="Новий виробник"
        onAdd={(name) => {
          const added = addMaker(name);
          onError(added ? "" : "Такий виробник уже є.");
          return added;
        }}
      />
    </div>
  );
}

const shownNumber = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

/** Роботи, за які платять від кількості матеріалу: назва, одиниця, етап і ціна за одиницю. */
function Works({ data, onError }: Props) {
  const row = "grid grid-cols-2 items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_110px_auto]";
  const workStages = data.stages.filter((stage) => stage.pay.kind === "works");
  const stageOptions = workStages.length ? workStages : data.stages;
  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-2">
        Наприклад «Порізка ДСП» — грн за м², «Поклейка крайки» — грн за пог. м. Матеріалу в довіднику вказують його роботу,
        а кількість береться з кошторису проекту.
      </p>
      {data.works.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {data.works.map((work) => {
            const linked = data.materials.filter((m) => m.workId === work.id).length;
            return (
              <li key={work.id} className={`${row} p-2`}>
                <input
                  aria-label="Назва роботи"
                  defaultValue={work.name}
                  className={`${input} col-span-2 sm:col-span-1`}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name === work.name) return;
                    const saved = name !== "" && updateWork(work.id, { name });
                    if (!saved) event.target.value = work.name;
                    onError(name !== "" && !saved ? "Така робота вже є." : "");
                  }}
                />
                <select aria-label={`Одиниця: ${work.name}`} value={work.unit} className={input} onChange={(e) => updateWork(work.id, { unit: e.target.value })}>
                  {[...new Set([...data.units, work.unit])].map((unit) => <option key={unit}>{unit}</option>)}
                </select>
                <select aria-label={`Етап: ${work.name}`} value={work.stageId} className={input} onChange={(e) => updateWork(work.id, { stageId: e.target.value })}>
                  {[...new Set([...stageOptions.map((s) => s.id), work.stageId])].map((id) => (
                    <option key={id} value={id}>{data.stages.find((s) => s.id === id)?.label ?? "етап прибрано"}</option>
                  ))}
                </select>
                <input
                  aria-label={`Ціна, грн за ${work.unit}: ${work.name}`}
                  inputMode="decimal"
                  defaultValue={shownNumber(work.price)}
                  placeholder={`грн / ${work.unit}`}
                  className={input}
                  onBlur={(event) => {
                    const price = parseNumber(event.target.value);
                    event.target.value = shownNumber(price);
                    if (price !== work.price) updateWork(work.id, { price });
                  }}
                />
                <button
                  type="button"
                  className={button}
                  onClick={() => onError(removeWork(work.id) ? "" : `До роботи «${work.name}» прив'язано матеріалів: ${linked}.`)}
                >
                  Прибрати
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className={row}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = new FormData(form);
          const text = (key: string) => String(values.get(key) ?? "").trim();
          const name = text("name");
          if (!name) return;
          const added = addWork({ name, unit: text("unit"), stageId: text("stageId"), price: parseNumber(text("price")) });
          onError(added ? "" : "Така робота вже є.");
          if (added) form.reset();
        }}
      >
        <input name="name" aria-label="Нова робота" placeholder="Нова робота, напр. Порізка ДСП" className={`${input} col-span-2 sm:col-span-1`} />
        <select name="unit" aria-label="Одиниця нової роботи" className={input}>
          {data.units.map((unit) => <option key={unit}>{unit}</option>)}
        </select>
        <select name="stageId" aria-label="Етап нової роботи" className={input}>
          {stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </select>
        <input name="price" inputMode="decimal" aria-label="Ціна нової роботи" placeholder="Ціна, грн" className={input} />
        <button type="submit" className={button}>Додати</button>
      </form>
    </div>
  );
}

/** Ставки зарплати етапів: відсоток від вартості матеріалів замовлення або за роботами. */
function Pay({ data }: { data: WeekData }) {
  const setKind = (stageId: string, kind: StagePay["kind"], current: StagePay) => {
    const pay: StagePay = kind === "percent" ? (current.kind === "percent" ? current : { kind, percent: 0 }) : { kind };
    updateStage(stageId, { pay });
  };
  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-2">
        Нараховується, коли працівник відмітив етап на «Тижні». Відсоток — від вартості всіх матеріалів замовлення за цінами довідника.
        Зарплата першого етапу (менеджер) — з двох частин: за прийом замовлення і за здачу, коли завершено останній етап.
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {data.stages.map((stage, index) => {
          const works = data.works.filter((w) => w.stageId === stage.id);
          const pay = stage.pay;
          return (
            <li key={stage.id} className="grid gap-1.5 p-2 sm:grid-cols-[minmax(0,1fr)_200px_170px] sm:items-center">
              <span className="text-sm font-semibold">{stage.label}</span>
              <select
                aria-label={`Як платити: ${stage.label}`}
                value={stage.pay.kind}
                className={input}
                onChange={(event) => setKind(stage.id, event.target.value as StagePay["kind"], stage.pay)}
              >
                <option value="percent">Відсоток від матеріалів</option>
                <option value="works">За роботами</option>
                <option value="none">Не нараховується</option>
              </select>
              {pay.kind === "percent" ? (
                index === 0 ? (
                  <span className="grid gap-1 sm:col-span-1">
                    <PercentInput label="за прийом" stage={stage.label} value={pay.percent} onSave={(percent) => updateStage(stage.id, { pay: { ...pay, percent } })} />
                    <PercentInput label="за здачу" stage={stage.label} value={pay.handover ?? 0} onSave={(handover) => updateStage(stage.id, { pay: { ...pay, handover } })} />
                  </span>
                ) : (
                  <PercentInput stage={stage.label} value={pay.percent} onSave={(percent) => updateStage(stage.id, { pay: { kind: "percent", percent } })} />
                )
              ) : (
                <span className="text-xs text-ink-2">
                  {stage.pay.kind === "works" ? (works.length ? works.map((w) => w.name).join(", ") : "Робіт ще немає") : ""}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Поле відсотка зарплати; зберігається, коли поле втрачає фокус. */
function PercentInput({ label, stage, value, onSave }: { label?: string; stage: string; value: number; onSave: (value: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      {label && <span className="w-16 shrink-0 text-xs text-ink-2">{label}</span>}
      <input
        key={value}
        aria-label={`Відсоток${label ? " " + label : ""}: ${stage}`}
        inputMode="decimal"
        defaultValue={shownNumber(value)}
        className={input}
        onBlur={(event) => {
          const next = parseNumber(event.target.value) ?? 0;
          event.target.value = shownNumber(next);
          onSave(next);
        }}
      />
      %
    </label>
  );
}

/** Вартість проекту: націнка виробництва й заноска на поверх. */
function Pricing({ data }: { data: WeekData }) {
  const { marginPercent, floorRate, floorStageId } = data.pricing;
  const percentStages = data.stages.filter((stage) => stage.pay.kind === "percent");
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-2">
        Вартість проекту = матеріали кошторису + націнка + зарплата всіх етапів (відсотки, роботи ЧПУ й крайки, заноска) + додаткові
        витрати.
      </p>
      <div className="grid gap-2 rounded-lg border border-line bg-surface p-3 text-sm">
        <label className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2">
          <span>Націнка виробництва від вартості матеріалів</span>
          <input
            key={marginPercent}
            aria-label="Націнка, %"
            inputMode="decimal"
            defaultValue={shownNumber(marginPercent)}
            className={input}
            onBlur={(event) => {
              const value = parseNumber(event.target.value) ?? 0;
              event.target.value = shownNumber(value);
              updatePricing({ marginPercent: value });
            }}
          />
          %
        </label>
        {percentStages.length > 0 && (
          <p className="text-xs text-ink-2">
            Відсотки зарплати (вкладка «Зарплата»): {percentStages.map((s) => `${s.label} ${s.pay.kind === "percent" ? s.pay.percent + (s.id === data.stages[0]?.id ? (s.pay.handover ?? 0) : 0) : 0}%`).join(", ")}.
          </p>
        )}
      </div>
      <div className="grid gap-2 rounded-lg border border-line bg-surface p-3 text-sm">
        <label className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2">
          <span>Заноска, ціна за поверх</span>
          <input
            key={floorRate ?? "none"}
            aria-label="Заноска, грн за поверх"
            inputMode="decimal"
            defaultValue={shownNumber(floorRate)}
            placeholder="грн"
            className={input}
            onBlur={(event) => {
              const value = parseNumber(event.target.value);
              event.target.value = shownNumber(value);
              updatePricing({ floorRate: value });
            }}
          />
          грн
        </label>
        <label className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
          <span>Кому нараховується</span>
          <select
            aria-label="Етап заноски"
            value={floorStageId ?? ""}
            className={input}
            onChange={(event) => updatePricing({ floorStageId: event.target.value || null })}
          >
            <option value="">Нікому</option>
            {data.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          </select>
        </label>
        <p className="text-xs text-ink-2">Поверх вписує менеджер у кошторисі проекту. Заноска йде в зарплату етапу й у вартість проекту.</p>
      </div>
    </div>
  );
}

/** Розділ панелі: бере дані зі сховища сам. */
export function MaterialsSection() {
  const data = useWeekData();
  return data ? <MaterialsAdmin data={data} /> : null;
}

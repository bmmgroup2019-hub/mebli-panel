"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import { addDays, formatShort, formatSpan, isoWeek, mondayOf, todayIso } from "@/lib/dates";
import { projectLabel, type StageId } from "@/lib/mock-projects";
import {
  addIssue,
  addItem,
  assigneeOf,
  assignItem,
  canReopen,
  blockedReason,
  completeItem,
  issueTypeName,
  itemsOfWeek,
  removeItem,
  startItem,
  reopenItem,
  resetWeekData,
  toggleIssue,
  useCanManage,
  useCurrentUser,
  useIsAdmin,
  useSeesOffice,
  useWeekData,
  type Issue,
  type Person,
  type WeekData,
  type WorkItem,
} from "@/lib/week-store";

const field = "min-w-0 rounded-lg border border-line px-2.5 py-1.5 text-sm";
const button = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-wash";
const ORDER_LIST = "order-names";

export function WeekPlan() {
  const data = useWeekData();
  if (!data) return <p className="py-16 text-center text-ink-2">Завантаження…</p>;
  return <Plan data={data} />;
}

function Plan({ data }: { data: WeekData }) {
  const [thisWeek] = useState(() => mondayOf(todayIso()));
  const [week, setWeek] = useState(thisWeek);
  const isAdmin = useIsAdmin();
  const items = itemsOfWeek(data.items, week);
  const doneCount = items.filter((i) => i.doneWeek === week).length;
  const navButton = "px-3 py-1.5 text-sm text-ink-2 hover:bg-wash hover:text-ink";

  return (
    <div className="grid gap-5">
      <OrderDatalist projects={data.projects} />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            {formatSpan(week, addDays(week, 6))}
            {week === thisWeek && " · поточний"}
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Тиждень {isoWeek(week)}</h1>
          {/* Загальний поступ тижня */}
          <div className="mt-1 flex items-center gap-2.5 text-sm text-ink-2">
            <span className="block h-1.5 w-32 rounded-full bg-wash" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-success"
                style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
              />
            </span>
            <span>
              Зроблено <span className="text-ink tabular-nums">{doneCount}</span> із <span className="tabular-nums">{items.length}</span>
            </span>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-line bg-surface">
          <button type="button" className={navButton} aria-label="Попередній тиждень" onClick={() => setWeek(addDays(week, -7))}>←</button>
          <button
            type="button"
            className={`${navButton} border-x border-line ${week === thisWeek ? "text-ink" : ""}`}
            onClick={() => setWeek(thisWeek)}
          >
            Цей тиждень
          </button>
          <button type="button" className={navButton} aria-label="Наступний тиждень" onClick={() => setWeek(addDays(week, 7))}>→</button>
        </div>
      </header>

      {/*
        Усі етапи видно одразу, без прокрутки вбік (прохання користувача 2026-11-21):
        телефон — одна під одною, планшет — по дві, ноутбук — по три, ПК від 1280 px — усі в один ряд рівними колонками.
      */}
      <section
        aria-label="Фронт робіт"
        style={{ "--cols": data.stages.length } as CSSProperties}
        className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(var(--cols),minmax(0,1fr))] xl:gap-2"
      >
        {data.stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage.id}
            label={stage.label}
            week={week}
            items={items.filter((item) => item.stage === stage.id)}
            allItems={data.items}
            staff={data.people.filter((person) => person.stages.includes(stage.id))}
          />
        ))}
      </section>

      <p className="text-sm text-ink-2">
        Прототип: дані вигадані, зміни зберігаються лише в цьому браузері.{" "}
        {isAdmin && <button type="button" className="underline" onClick={resetWeekData}>Повернути приклади</button>}
      </p>
    </div>
  );
}

/** Підказки назв замовлень для полів «Замовлення». */
function OrderDatalist({ projects }: { projects: WeekData["projects"] }) {
  return (
    <datalist id={ORDER_LIST}>
      {projects.map((project) => <option key={project.id} value={projectLabel(project)} />)}
    </datalist>
  );
}

/** Окрема сторінка «Проблеми». */
export function IssuesBoard() {
  const data = useWeekData();
  if (!data) return <p className="py-16 text-center text-ink-2">Завантаження…</p>;
  return (
    <>
      <OrderDatalist projects={data.projects} />
      <IssuesSection issues={data.issues} />
    </>
  );
}

/** Читає поля форми й очищує їх. */
function takeForm(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  form.reset();
  return {
    order: String(values.get("order") ?? "").trim(),
    text: String(values.get("text") ?? "").trim(),
    typeId: String(values.get("type") ?? "") || null,
  };
}

function TypeSelect({ className = "" }: { className?: string }) {
  const types = useWeekData()?.issueTypes ?? [];
  return (
    <select name="type" aria-label="Тип проблеми" className={`${field} ${className}`} defaultValue={types[0]?.id ?? ""}>
      {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      <option value="">Без типу</option>
    </select>
  );
}

/** Посилання на проект лише тим, хто бачить «Проекти»; складальнику — просто назва. */
function OrderName({ name }: { name: string }) {
  const project = useWeekData()?.projects.find((p) => projectLabel(p) === name);
  const seesOffice = useSeesOffice();
  return project && seesOffice ? <Link href={`/projects/${project.id}`} className="hover:underline">{name}</Link> : <>{name}</>;
}

function StageColumn({
  stage,
  label,
  week,
  items,
  allItems,
  staff,
}: {
  stage: StageId;
  label: string;
  week: string;
  items: WorkItem[];
  allItems: WorkItem[];
  staff: Person[];
}) {
  const isAdmin = useIsAdmin();
  const rows = (list: WorkItem[]) => (
    <ul className="grid grid-cols-1 gap-1.5">
      {list.map((item) => <WorkRow key={item.id} item={item} week={week} allItems={allItems} staff={staff} />)}
    </ul>
  );
  const unassigned = items.filter((item) => !assigneeOf(item, staff));
  const doneCount = items.filter((i) => i.doneWeek === week).length;
  const allDone = items.length > 0 && doneCount === items.length;

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-3 xl:p-2">
      <div className="grid gap-2">
        <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
          {label}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${allDone ? "bg-success/15 text-success" : "bg-wash text-ink-2"}`}
          >
            {doneCount}/{items.length}
          </span>
        </h2>
        <span className="block h-1 rounded-full bg-wash" aria-hidden="true">
          <span className="block h-full rounded-full bg-success" style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
        </span>
      </div>

      {staff.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {staff.map((person) => {
            const own = items.filter((item) => assigneeOf(item, staff) === person.id);
            return (
              <div key={person.id} className="grid grid-cols-1 gap-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider [overflow-wrap:anywhere] text-ink-2">{person.name}</h3>
                {own.length > 0 ? rows(own) : <p className="text-sm text-ink-2">Немає замовлень</p>}
              </div>
            );
          })}
          {unassigned.length > 0 && (
            <div className="grid grid-cols-1 gap-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider [overflow-wrap:anywhere] text-warning">Не призначено</h3>
              {rows(unassigned)}
            </div>
          )}
        </div>
      ) : items.length > 0 ? (
        rows(items)
      ) : (
        <p className="text-sm text-ink-2">Замовлень немає</p>
      )}

      {isAdmin && (
        <form
          className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 border-t border-line pt-3 xl:grid-cols-1"
          onSubmit={(event) => {
            const { order } = takeForm(event);
            if (order) addItem(order, stage, week);
          }}
        >
          <input name="order" list={ORDER_LIST} aria-label={`Додати замовлення: ${label}`} placeholder="Назва замовлення" className={field} />
          <button type="submit" className={button}>Додати</button>
        </form>
      )}
    </div>
  );
}

function WorkRow({
  item,
  week,
  allItems,
  staff,
}: {
  item: WorkItem;
  week: string;
  allItems: WorkItem[];
  staff: Person[];
}) {
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const canManage = useCanManage();
  const data = useWeekData();
  const assignee = assigneeOf(item, staff) === user?.id;
  const mine = isAdmin || assignee;
  // Призначати людей менеджер може лише в замовленнях своїх проектів і лише поки етап не зроблено;
  // у зробленому етапі виконавця (а з ним і зарплату) змінює тільки адміністратор.
  const project = data?.projects.find((p) => projectLabel(p) === item.order);
  const canAssign = isAdmin || (canManage && project?.managerId === user?.id && item.doneWeek === null);
  const done = item.doneWeek === week;
  const doneLater = item.doneWeek !== null && item.doneWeek > week;
  const blocked = !done && data ? blockedReason(data, item) : null;
  const nextStarted = done && !canReopen(allItems, item);
  const locked = !mine || doneLater || Boolean(blocked) || nextStarted;
  const note = blocked && mine
    ? blocked
    : nextStarted && mine
    ? "Наступний етап уже взяли в роботу: скасувати не можна"
    : doneLater
    ? `Зроблено на тижні ${isoWeek(item.doneWeek!)}`
    : !done && item.week < week
      ? `Перенесено з тижня ${isoWeek(item.week)}`
      : "";

  return (
    <li
      className={`flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-sm transition-colors xl:gap-1.5 xl:px-1.5 xl:text-[13px] ${
        done ? "border-transparent bg-wash/50" : "border-line bg-page hover:border-ink-2/40"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 flex-none"
        checked={done}
        disabled={locked}
        aria-label={`Етап зроблено: ${item.order}`}
        onChange={() => (done ? reopenItem(item.id) : completeItem(item.id, week))}
      />
      <span className="min-w-0 flex-1 break-words">
        <span className={done ? "text-ink-2 line-through" : ""}><OrderName name={item.order} /></span>
        {note && <span className="block text-xs text-ink-2">{note}</span>}
        {/* Взяти в роботу: після цього попередній етап уже не скасувати. */}
        {!done && !doneLater && item.startedOn && (
          <span className="block text-xs text-accent-ink">
            В роботі з {item.startedOn.slice(8)}.{item.startedOn.slice(5, 7)}
            {mine && (
              <button type="button" className="ml-2 text-ink-2 underline hover:text-ink" onClick={() => startItem(item.id, false)}>
                скасувати
              </button>
            )}
          </span>
        )}
        {!done && !doneLater && !item.startedOn && assignee && !blocked && (
          <button
            type="button"
            className="mt-1.5 block rounded-md bg-accent-fill px-2 py-1 text-xs font-medium text-accent-on hover:bg-accent-fill-hover"
            onClick={() => startItem(item.id, true)}
          >
            Взяти в роботу
          </button>
        )}
        {item.adminMarkedOn && (
          <span className="block text-xs text-ink-2">Змінено адміністратором {item.adminMarkedOn.slice(8)}.{item.adminMarkedOn.slice(5, 7)}</span>
        )}
        {canAssign && staff.length > 1 && (
          <select
            aria-label={`Хто бере: ${item.order}`}
            className="mt-1.5 block max-w-full rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-ink-2"
            value={assigneeOf(item, staff) ?? ""}
            onChange={(event) => assignItem(item.id, event.target.value || null)}
          >
            <option value="">Не призначено</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        )}
      </span>
      {isAdmin && (
        <button
          type="button"
          aria-label={`Прибрати: ${item.order}`}
          className="-mr-0.5 flex-none px-0.5 leading-none text-ink-2 hover:text-ink"
          onClick={() => removeItem(item.id)}
        >
          ×
        </button>
      )}
    </li>
  );
}

function IssuesSection({ issues }: { issues: Issue[] }) {
  const author = useCurrentUser()?.name ?? "";
  const open = issues.filter((i) => !i.resolved);
  const orders = [...new Set(open.filter((i) => i.order).map((i) => i.order))];
  const resolved = issues.filter((i) => i.resolved);

  return (
    <section id="issues" className="grid scroll-mt-4 gap-3">
      <div className="grid gap-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Відкрито: {open.length}</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">Проблеми й питання</h1>
        <p className="text-sm text-ink-2">Проблеми згруповані за замовленням. Записи без замовлення — загальні питання.</p>
      </div>

      <form
        className="grid gap-1.5 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[220px_180px_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          const { order, text, typeId } = takeForm(event);
          if (text) addIssue(order, order ? typeId : null, text, author);
        }}
      >
        <input name="order" list={ORDER_LIST} aria-label="Замовлення" placeholder="Замовлення або порожньо" className={field} />
        <TypeSelect />
        <input name="text" aria-label="Опис проблеми" placeholder="Що зависло або що треба вирішити" className={field} />
        <button type="submit" className={button}>Додати</button>
      </form>

      {orders.length === 0 && !open.some((i) => !i.order) && (
        <p className="text-sm text-ink-2">Відкритих проблем і питань немає.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {orders.map((order) => (
          <IssueGroup key={order} order={order} issues={open.filter((i) => i.order === order)} />
        ))}
        {open.some((i) => !i.order) && <IssueGroup order="" issues={open.filter((i) => !i.order)} />}
      </div>

      {resolved.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2">Вирішено: {resolved.length}</summary>
          <ul className="mt-1.5 divide-y divide-line rounded-lg border border-line bg-surface">
            {resolved.map((issue) => <IssueRow key={issue.id} issue={issue} showOrder />)}
          </ul>
        </details>
      )}
    </section>
  );
}

function IssueGroup({ order, issues }: { order: string; issues: Issue[] }) {
  const author = useCurrentUser()?.name ?? "";
  return (
    <article
      className={`relative overflow-hidden rounded-lg border border-line bg-surface ${
        order ? "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-critical" : ""
      }`}
    >
      <h3 className="flex items-center justify-between gap-2 p-4 pb-1 text-sm font-semibold">
        <span className="min-w-0 break-words">
          {order ? <><span aria-hidden="true" className="text-critical">⚠ </span><OrderName name={order} /></> : "Загальні питання"}
        </span>
        <span className="rounded-full bg-wash px-2 py-0.5 text-xs font-medium text-ink-2 tabular-nums">{issues.length}</span>
      </h3>
      <ul className="divide-y divide-line">
        {issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
      </ul>
      <form
        className={`grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 border-t border-line p-4 ${order ? "sm:grid-cols-[150px_minmax(0,1fr)_auto]" : ""}`}
        onSubmit={(event) => {
          const { text, typeId } = takeForm(event);
          if (text) addIssue(order, order ? typeId : null, text, author);
        }}
      >
        {order && <TypeSelect className="col-span-2 sm:col-span-1" />}
        <input
          name="text"
          aria-label={order ? `Ще одна проблема: ${order}` : "Ще одне питання"}
          placeholder={order ? "Ще одна проблема" : "Ще одне питання"}
          className={field}
        />
        <button type="submit" className={button}>Додати</button>
      </form>
    </article>
  );
}

function IssueRow({ issue, showOrder }: { issue: Issue; showOrder?: boolean }) {
  const canManage = useCanManage();
  const typeName = issueTypeName(useWeekData()?.issueTypes ?? [], issue.typeId);
  const meta = [showOrder && issue.order, issue.author, formatShort(issue.createdOn)].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start gap-3 px-4 py-2.5 text-sm">
      <span className="min-w-0 flex-1 break-words">
        {typeName && <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider [overflow-wrap:anywhere] text-critical">{typeName}</span>}
        <span className={issue.resolved ? "text-ink-2 line-through" : ""}>{issue.text}</span>
        <span className="block text-xs text-ink-2">{meta}</span>
      </span>
      {canManage && (
        <button type="button" className={`${button} flex-none`} onClick={() => toggleIssue(issue.id)}>
          {issue.resolved ? "Відкрити" : "Вирішено"}
        </button>
      )}
    </li>
  );
}

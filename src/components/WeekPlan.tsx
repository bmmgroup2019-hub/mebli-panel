"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
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

const field = "min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
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

  return (
    <div className="grid gap-5">
      <OrderDatalist projects={data.projects} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Тиждень {isoWeek(week)}, {formatSpan(week, addDays(week, 6))}</h1>
          <p className="text-sm text-ink-2">
            Зроблено {items.filter((i) => i.doneWeek === week).length} із {items.length}
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" className={button} aria-label="Попередній тиждень" onClick={() => setWeek(addDays(week, -7))}>←</button>
          <button type="button" className={button} onClick={() => setWeek(thisWeek)}>Цей тиждень</button>
          <button type="button" className={button} aria-label="Наступний тиждень" onClick={() => setWeek(addDays(week, 7))}>→</button>
        </div>
      </header>

      <section aria-label="Фронт робіт" className="grid gap-3 sm:grid-cols-2 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none">
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
    <ul className="grid gap-1.5">
      {list.map((item) => <WorkRow key={item.id} item={item} week={week} allItems={allItems} staff={staff} />)}
    </ul>
  );
  const unassigned = items.filter((item) => !assigneeOf(item, staff));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <h2 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
        {label}
        <span className="font-normal text-ink-2 tabular-nums">
          {items.filter((i) => i.doneWeek === week).length}/{items.length}
        </span>
      </h2>

      {staff.length > 0 ? (
        <div className="grid gap-3">
          {staff.map((person) => {
            const own = items.filter((item) => assigneeOf(item, staff) === person.id);
            return (
              <div key={person.id} className="grid gap-1.5">
                <h3 className="text-xs font-semibold text-ink-2">{person.name}</h3>
                {own.length > 0 ? rows(own) : <p className="text-sm text-ink-2">Немає замовлень</p>}
              </div>
            );
          })}
          {unassigned.length > 0 && (
            <div className="grid gap-1.5">
              <h3 className="text-xs font-semibold text-ink-2">Не призначено</h3>
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
          className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 border-t border-line pt-2"
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
  const mine = isAdmin || assigneeOf(item, staff) === user?.id;
  // Призначати людей менеджер може лише в замовленнях своїх проектів; адміністратор — у всіх.
  const project = data?.projects.find((p) => projectLabel(p) === item.order);
  const canAssign = isAdmin || (canManage && project?.managerId === user?.id);
  const done = item.doneWeek === week;
  const doneLater = item.doneWeek !== null && item.doneWeek > week;
  const blocked = !done && data ? blockedReason(data, item) : null;
  const locked = !mine || doneLater || Boolean(blocked) || (done && !canReopen(allItems, item));
  const note = blocked && mine
    ? blocked
    : doneLater
    ? `Зроблено на тижні ${isoWeek(item.doneWeek!)}`
    : !done && item.week < week
      ? `Перенесено з тижня ${isoWeek(item.week)}`
      : "";

  return (
    <li className="flex items-start gap-2 text-sm">
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
        {item.adminMarkedOn && (
          <span className="block text-xs text-ink-2">Змінено адміністратором {item.adminMarkedOn.slice(8)}.{item.adminMarkedOn.slice(5, 7)}</span>
        )}
        {canAssign && staff.length > 1 && (
          <select
            aria-label={`Хто бере: ${item.order}`}
            className="mt-1 block max-w-full rounded border border-line bg-surface px-1 py-0.5 text-xs text-ink-2"
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
          className="px-1 text-ink-2 hover:text-ink"
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
      <div>
        <h1 className="text-xl font-semibold">Проблеми й питання</h1>
        <p className="text-sm text-ink-2">Проблеми згруповані за замовленням. Записи без замовлення — загальні питання.</p>
      </div>

      <form
        className="grid gap-1.5 sm:grid-cols-[220px_180px_minmax(0,1fr)_auto]"
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
    <article className={`rounded-lg border border-line bg-surface ${order ? "border-l-4 border-l-critical" : ""}`}>
      <h3 className="flex items-baseline justify-between gap-2 p-3 pb-1 text-sm font-semibold">
        <span className="min-w-0 break-words">
          {order ? <><span aria-hidden="true">⚠ </span><OrderName name={order} /></> : "Загальні питання"}
        </span>
        <span className="font-normal text-ink-2 tabular-nums">{issues.length}</span>
      </h3>
      <ul className="divide-y divide-line">
        {issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
      </ul>
      <form
        className={`grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 border-t border-line p-3 ${order ? "sm:grid-cols-[150px_minmax(0,1fr)_auto]" : ""}`}
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
    <li className="flex items-start gap-3 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 break-words">
        {typeName && <span className="block text-xs font-semibold text-ink-2">{typeName}</span>}
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

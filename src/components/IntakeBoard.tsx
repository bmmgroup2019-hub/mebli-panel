"use client";

import Link from "next/link";
import { useState } from "react";
import { diffDays, formatShort, mondayOf, monthLabel, todayIso } from "@/lib/dates";
import { money } from "@/lib/materials";
import { projectLabel, type Project } from "@/lib/mock-projects";
import {
  assigneeOf,
  assignItem,
  blockedReason,
  canReopen,
  completeItem,
  isIntake,
  reopenItem,
  useCanManage,
  useCurrentUser,
  useIsAdmin,
  useWeekData,
  type WeekData,
  type WorkItem,
} from "@/lib/week-store";
import { NewProjectButton } from "./NewProjectButton";
import { RefuseButton } from "./ProjectRefusal";

const field = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
const button = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-wash";

type Entry = { item: WorkItem; project: Project | undefined; managerId: string | null };

/**
 * «Прийом» (рішення користувача 2026-11-26): замовлення, які менеджер прийняв і прорахував, але ще не передав у виробництво.
 * Їх буває багато (8–10 на менеджера), тож вони тут, а не на «Тижні»: «Тиждень» лишається для цеху.
 * Передати у виробництво можна лише з авансом — це та сама галочка першого етапу, від неї зарплата менеджера за прийом.
 */
export function IntakeBoard() {
  const data = useWeekData();
  const user = useCurrentUser();
  const canManage = useCanManage();
  // Менеджер за замовчуванням бачить свої замовлення, адміністратор — усі.
  const [managerId, setManagerId] = useState(() => (user?.role === "manager" ? user.id : ""));
  const [show, setShow] = useState<"all" | "paid" | "waiting">("all");
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  // На телефоні фільтри сховано за кнопкою, щоб список було видно одразу.
  const [filtersOpen, setFiltersOpen] = useState(false);
  if (!data) return <p className="py-16 text-center text-ink-2">Завантаження…</p>;
  if (!canManage) return <p className="text-sm text-ink-2">Цей розділ доступний адміністратору й менеджерам.</p>;

  const week = mondayOf(todayIso());
  const today = todayIso();
  const first = data.stages[0];
  const staff = data.people.filter((person) => first && person.stages.includes(first.id));
  const entryOf = (item: WorkItem): Entry => ({
    item,
    project: data.projects.find((p) => projectLabel(p) === item.order),
    managerId: assigneeOf(item, data.people),
  });
  const intake = data.items.filter((item) => isIntake(data, item.stage));
  const open = intake.filter((item) => item.doneWeek === null).map(entryOf);
  const passed = intake.filter((item) => item.doneWeek === week).map(entryOf);

  const paid = (entry: Entry) => (entry.project?.payments.length ?? 0) > 0;
  const byManager = (entry: Entry) => !managerId || entry.managerId === managerId;
  const mineAll = open.filter(byManager);
  // Пошук: кожне слово має бути в номері чи назві виробу («№» можна не писати).
  const words = query.toLowerCase().replace(/№/g, "").split(/\s+/).filter(Boolean);
  const matches = ({ project }: Entry) => {
    const text = `${project?.number ?? ""} ${project?.product ?? ""}`.toLowerCase();
    const accepted = project?.acceptedOn ?? "";
    return (
      words.every((word) => text.includes(word)) &&
      (!clientId || project?.clientId === clientId) &&
      (!month || accepted.startsWith(month)) &&
      (!date || accepted === date)
    );
  };
  // Замовники й місяці — лише ті, що є серед замовлень на прийомі.
  const clients = data.clients
    .filter((client) => mineAll.some((entry) => entry.project?.clientId === client.id))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const months = [...new Set(mineAll.map((entry) => entry.project?.acceptedOn.slice(0, 7) ?? "").filter(Boolean))].sort().reverse();
  const activeFilters = [query, clientId, month, date, show !== "all"].filter(Boolean).length;
  const filtered = activeFilters > 0;
  const reset = () => {
    setQuery("");
    setClientId("");
    setMonth("");
    setDate("");
    setShow("all");
  };
  const list = mineAll
    .filter(matches)
    .filter((entry) => (show === "paid" ? paid(entry) : show === "waiting" ? !paid(entry) : true))
    // Спершу з авансом (їх можна передавати), далі ті, що чекають найдовше.
    .sort((a, b) => Number(paid(b)) - Number(paid(a)) || (a.project?.acceptedOn ?? "").localeCompare(b.project?.acceptedOn ?? ""));
  const sum = mineAll.reduce((total, entry) => total + (entry.project?.clientPrice ?? 0), 0);
  const paidCount = mineAll.filter(paid).length;
  const passedMine = passed.filter(byManager);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">Прийом</h1>
          <p className="text-sm text-ink-2">Прораховані замовлення, які ще не передано у виробництво. Прототип: дані вигадані.</p>
        </div>
        <NewProjectButton />
      </div>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="На прийомі" value={String(mineAll.length)} />
        <Tile label="З авансом" value={String(paidCount)} good={paidCount > 0} />
        <Tile label="На суму" value={money(sum)} />
      </dl>

      <button
        type="button"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen(!filtersOpen)}
        className={`${button} flex w-full items-center justify-between sm:hidden`}
      >
        <span>
          Фільтри
          {activeFilters > 0 && <span className="ml-1.5 rounded-full bg-accent-wash px-1.5 text-xs text-accent-ink tabular-nums">{activeFilters}</span>}
        </span>
        <span aria-hidden="true" className="text-ink-2">{filtersOpen ? "▲" : "▼"}</span>
      </button>
      <div className={`${filtersOpen ? "grid" : "hidden"} gap-2 rounded-lg border border-line bg-surface p-3 sm:grid sm:grid-cols-2 sm:p-4 lg:grid-cols-3`}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Пошук за назвою або номером"
          placeholder="Назва або номер"
          className={field}
        />
        <select aria-label="Замовник" value={clientId} onChange={(e) => setClientId(e.target.value)} className={field}>
          <option value="">Усі замовники</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <select aria-label="Місяць прийому" value={month} onChange={(e) => setMonth(e.target.value)} className={field}>
          <option value="">Усі місяці</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <label className="grid gap-0.5 text-xs text-ink-2">
          Дата прийому
          <input type="date" aria-label="Дата прийому" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <select aria-label="Менеджер" value={managerId} onChange={(e) => setManagerId(e.target.value)} className={field}>
          <option value="">Усі менеджери</option>
          {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
        <select aria-label="Що показати" value={show} onChange={(e) => setShow(e.target.value as typeof show)} className={field}>
          <option value="all">Усі на прийомі</option>
          <option value="paid">З авансом: можна передавати</option>
          <option value="waiting">Чекають рішення клієнта</option>
        </select>
        {filtered && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <span className="text-ink-2">Знайдено: <span className="tabular-nums text-ink">{list.length}</span> із {mineAll.length}</span>
            <button type="button" className={button} onClick={reset}>Скинути фільтри</button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-ink-2">{mineAll.length ? "Таких замовлень немає." : "На прийомі нічого немає."}</p>
      ) : (
        <ul className="grid gap-2">
          {list.map((entry) => (
            <IntakeRow key={entry.item.id} entry={entry} data={data} week={week} today={today} showManager={!managerId} />
          ))}
        </ul>
      )}

      {passedMine.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-semibold">Передано у виробництво цього тижня</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {passedMine.map((entry) => (
              <PassedRow key={entry.item.id} entry={entry} data={data} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Tile({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums sm:text-2xl ${good ? "text-success" : ""}`}>{value}</dd>
    </div>
  );
}

/** Хто може передати чи повернути: адміністратор або менеджер, за яким записано прийом. */
function useMayMark(entry: Entry) {
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  return isAdmin || (Boolean(user) && entry.managerId === user?.id);
}

function IntakeRow({ entry, data, week, today, showManager }: { entry: Entry; data: WeekData; week: string; today: string; showManager: boolean }) {
  const { item, project } = entry;
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const mayMark = useMayMark(entry);
  const paidSum = project?.payments.reduce((total, p) => total + p.amount, 0) ?? 0;
  const waitingDays = project?.acceptedOn ? Math.max(0, diffDays(project.acceptedOn, today)) : 0;
  const blocked = blockedReason(data, item);
  // Менеджера прийому змінює адміністратор або менеджер цього проекту, як на «Тижні».
  const canAssign = isAdmin || (user?.role === "manager" && project?.managerId === user.id);
  const staff = data.people.filter((person) => person.stages.includes(item.stage));
  const manager = data.people.find((person) => person.id === entry.managerId);

  return (
    <li className={`grid gap-2 rounded-lg border bg-surface p-3.5 sm:p-4 ${paidSum > 0 ? "border-success/40" : "border-line"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 break-words font-semibold">
          {project ? <Link href={`/projects/${project.id}`} className="hover:text-accent-ink">{item.order}</Link> : item.order}
        </span>
        <span className="tabular-nums">{project?.clientPrice ? money(project.clientPrice) : <span className="text-ink-2">ціну не вписано</span>}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        {project?.acceptedOn && <span>Прийнято {formatShort(project.acceptedOn)}</span>}
        <span className={waitingDays >= 21 ? "text-warning" : ""}>чекає {waitingDays} дн.</span>
        {paidSum > 0 ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">Аванс {money(paidSum)}</span>
        ) : (
          <span className="rounded-full bg-wash px-2 py-0.5">Без авансу</span>
        )}
        {showManager && <span>{manager?.name ?? "⚠ без менеджера"}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {mayMark && !blocked && (
          <button
            type="button"
            className="rounded-lg bg-accent-fill px-3 py-1.5 text-sm font-semibold text-accent-on hover:bg-accent-fill-hover"
            onClick={() => completeItem(item.id, week)}
          >
            Передати у виробництво
          </button>
        )}
        {mayMark && blocked && <span className="text-xs text-ink-2">{blocked === "Спершу внесіть аванс" ? "Передати можна після авансу" : blocked}</span>}
        {project && <RefuseButton project={project} />}
        {canAssign && staff.length > 1 && (
          <select
            aria-label={`Менеджер прийому: ${item.order}`}
            value={entry.managerId ?? ""}
            onChange={(e) => assignItem(item.id, e.target.value || null)}
            className="ml-auto rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-ink-2"
          >
            <option value="">Не призначено</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        )}
      </div>
    </li>
  );
}

function PassedRow({ entry, data }: { entry: Entry; data: WeekData }) {
  const mayMark = useMayMark(entry);
  const { item, project } = entry;
  const reopenable = canReopen(data.items, item);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <span className="min-w-0 break-words">
        {project ? <Link href={`/projects/${project.id}`} className="hover:underline">{item.order}</Link> : item.order}
        {item.doneOn && <span className="block text-xs text-ink-2">Передано {formatShort(item.doneOn)}</span>}
      </span>
      {mayMark &&
        (reopenable ? (
          <button type="button" className={button} onClick={() => reopenItem(item.id)}>Повернути на прийом</button>
        ) : (
          <span className="text-xs text-ink-2">Наступний етап уже взяли в роботу</span>
        ))}
    </li>
  );
}

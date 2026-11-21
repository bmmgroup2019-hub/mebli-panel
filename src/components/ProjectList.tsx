"use client";

import Link from "next/link";
import { useState } from "react";
import { isFinished, specRole, stageStatus, useCanManage, useCurrentUser, useWeekData } from "@/lib/week-store";
import { projectLabel, type Project } from "@/lib/mock-projects";
import { NewProjectButton } from "./NewProjectButton";

const field = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
const MONTH_NAMES = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];

const money = (value: number) => `${Math.round(value).toLocaleString("uk-UA")} грн`;
const dateLabel = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/**
 * Список проектів карточками з фільтрами: місяць і дата прийому, назва або номер, замовник, менеджер.
 * Менеджер за замовчуванням бачить свої проекти; фільтр менеджера — коли менеджерів кілька.
 * Фільтр етапу: за замовчуванням усі в роботі, завершені — лише якщо їх вибрати.
 * Конструктор (людина етапу «Специфікація») бачить свої проекти двома вкладками: у черзі на обробку й передані далі.
 * Менеджер — теж двома: в роботі (прийом не завершено, можна змінювати) і передані далі (змінює лише адміністратор).
 */
export function ProjectList() {
  const data = useWeekData();
  const canManage = useCanManage();
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState(""); // "" — усі в роботі, "finished", "all", "none" або id етапу
  const [managerChoice, setManagerChoice] = useState<string | null>(null); // null — за замовчуванням
  const user = useCurrentUser();
  const [view, setView] = useState<"queue" | "passed">("queue");
  if (!data) return null;

  // Конструктор: проекти, призначені йому (або ще нікому), — у черзі, поки етап не завершено, далі — передані.
  const specUser = !canManage && user && data.stages.some((s) => s.createsSpec && user.stages.includes(s.id)) ? user : null;
  const roles = new Map(specUser ? data.projects.map((project) => [project.id, specRole(data, specUser, project)]) : []);
  const managerTabs = user?.role === "manager";
  const first = data.stages[0]?.id;
  /** Чи проект у вкладці «Передані далі»: у конструктора — етап «Специфікація» завершено, у менеджера — прийом. */
  const passed = (project: Project) =>
    specUser ? roles.get(project.id)?.done : first !== undefined && stageStatus(data.items, projectLabel(project), first) === "done";
  const tabs = Boolean(specUser || managerTabs);

  const managers = data.people.filter((person) => person.role === "manager");
  const managerId = managerChoice ?? (user?.role === "manager" ? user.id : "");
  const managerName = (id: string) => data.people.find((person) => person.id === id)?.name ?? "—";

  /** Де зараз проект: id етапу в роботі, "finished" або "none" (ще не у виробництві). */
  const stageOf = (project: Project) => {
    const label = projectLabel(project);
    if (isFinished(data, label)) return "finished";
    return data.stages.find((s) => stageStatus(data.items, label, s.id) === "wip")?.id ?? "none";
  };
  const stageName = (id: string) =>
    id === "finished" ? "Завершено" : id === "none" ? "Ще не у виробництві" : (data.stages.find((s) => s.id === id)?.label ?? "—");
  const stages = new Map(data.projects.map((project) => [project.id, stageOf(project)]));
  const hasNone = [...stages.values()].includes("none");

  // Місяці, у які приймали проекти, — новіші першими.
  const months = [...new Set(data.projects.map((p) => p.acceptedOn.slice(0, 7)))].sort().reverse();
  const clients = data.clients
    .filter((client) => data.projects.some((p) => p.clientId === client.id))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const words = query.toLowerCase().replace(/№/g, "").split(/\s+/).filter(Boolean);
  const all = [...data.projects].sort((a, b) => b.acceptedOn.localeCompare(a.acceptedOn));
  const found = all.filter((project) => {
    const text = `${project.number} ${project.product}`.toLowerCase();
    return (
      words.every((word) => text.includes(word)) &&
      (!month || project.acceptedOn.startsWith(month)) &&
      (!date || project.acceptedOn === date) &&
      (!clientId || project.clientId === clientId) &&
      (!managerId || project.managerId === managerId) &&
      (!specUser || roles.get(project.id)?.creator) &&
      (!tabs || passed(project) === (view === "passed")) &&
      // Фільтр етапу — для всіх, крім конструктора й вкладки «В роботі» менеджера.
      (specUser || (managerTabs && view === "queue") || stage === "all" || (stage === "" ? stages.get(project.id) !== "finished" : stages.get(project.id) === stage))
    );
  });
  // У черзі першими ті, що вже на етапі конструктора, далі — ті, що ще на попередніх етапах.
  const specStage = data.stages.find((s) => s.createsSpec)?.id;
  if (specUser && view === "queue") found.sort((a, b) => Number(stages.get(b.id) === specStage) - Number(stages.get(a.id) === specStage));
  const countOf = (wanted: boolean) =>
    data.projects.filter((p) => (specUser ? roles.get(p.id)?.creator : !managerId || p.managerId === managerId) && Boolean(passed(p)) === wanted).length;
  const showStage = !specUser && !(managerTabs && view === "queue");
  const filtered = query || month || date || clientId || stage || managerChoice !== null;

  const reset = () => {
    setQuery("");
    setMonth("");
    setDate("");
    setClientId("");
    setStage("");
    setManagerChoice(null);
  };

  return (
    <>
      {tabs && (
        <div role="tablist" className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1 text-sm">
          {([["queue", specUser ? "В черзі на обробку" : "В роботі", countOf(false)], ["passed", "Передані далі", countOf(true)]] as const).map(([id, text, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className="shrink-0 rounded-md px-3 py-1.5 text-ink-2 hover:text-ink aria-selected:bg-wash aria-selected:font-semibold aria-selected:text-ink"
            >
              {text} <span className="ml-1 tabular-nums text-ink-2">{count}</span>
            </button>
          ))}
        </div>
      )}
      {managerTabs && (
        <p className="text-xs text-ink-2">
          {view === "queue" ? "Прийом ще не завершено: свої проекти можна змінювати." : "Передано на наступний етап: змінює лише адміністратор."}
        </p>
      )}

      {/* Панель фільтрів; кнопка нового проекту — праворуч над нею. */}
      <div className="grid gap-3 rounded-lg border border-line bg-surface p-3 sm:p-4">
      {canManage && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Фільтри</span>
          <NewProjectButton />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Пошук за назвою або номером"
          placeholder="Назва або номер"
          className={field}
        />
        <select aria-label="Замовник" value={clientId} onChange={(event) => setClientId(event.target.value)} className={field}>
          <option value="">Усі замовники</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select aria-label="Місяць прийому" value={month} onChange={(event) => setMonth(event.target.value)} className={field}>
          <option value="">Усі місяці</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        {showStage && (
          <select aria-label="Етап" value={stage} onChange={(event) => setStage(event.target.value)} className={field}>
            <option value="">Усі в роботі</option>
            {data.stages.filter((s) => !managerTabs || s.id !== first).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            {hasNone && !managerTabs && <option value="none">Ще не у виробництві</option>}
            <option value="finished">Завершені</option>
            <option value="all">Усі, разом із завершеними</option>
          </select>
        )}
        {managers.length > 1 && (
          <select aria-label="Менеджер" value={managerId} onChange={(event) => setManagerChoice(event.target.value)} className={field}>
            <option value="">Усі менеджери</option>
            {managers.map((person) => (
              <option key={person.id} value={person.id}>
                {person.id === user?.id ? `${person.name} (мої)` : person.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <span className="shrink-0">Дата прийому</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} />
        </label>
      </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
        <span>
          Проектів: <span className="text-ink tabular-nums">{found.length}</span>
          {!tabs && found.length !== all.length && ` із ${all.length}`}
        </span>
        {filtered && (
          <button type="button" className="underline hover:text-ink" onClick={reset}>
            Скинути фільтри
          </button>
        )}
      </p>

      {found.length === 0 ? (
        <p className="text-sm text-ink-2">Нічого не знайдено.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {found.map((project) => {
            const paid = project.payments.reduce((sum, payment) => sum + payment.amount, 0);
            const cost = project.clientPrice;
            const left = cost === null ? null : Math.round(cost - paid);
            const finishedProject = stages.get(project.id) === "finished";
            const paidShare = cost ? Math.min(1, paid / cost) : 0;
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-4 hover:border-ink-2/40 hover:bg-wash/40"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-ink-2">№{project.number}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        finishedProject
                          ? "bg-success/15 text-success"
                          : stages.get(project.id) === "none"
                            ? "bg-wash text-ink-2"
                            : "bg-accent-wash text-accent-ink"
                      }`}
                    >
                      {stageName(stages.get(project.id)!)}
                    </span>
                  </span>
                  <span className="grid gap-1">
                    <span className="text-base font-semibold leading-snug group-hover:text-accent-ink">{project.product}</span>
                    <span className="truncate text-sm text-ink-2">
                      {project.client} · {dateLabel(project.acceptedOn)}
                      {managers.length > 1 && ` · ${managerName(project.managerId)}`}
                    </span>
                  </span>
                  {canManage && (
                    <span className="mt-auto grid gap-2 border-t border-line pt-3 text-sm">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold tabular-nums">{cost === null ? "Не вписано" : money(cost)}</span>
                        <span
                          className={`text-xs tabular-nums ${left === 0 ? "text-success" : left !== null && left < 0 ? "text-warning" : "text-ink-2"}`}
                        >
                          {left === null
                            ? ""
                            : left === 0
                              ? "оплачено"
                              : left < 0
                                ? `переплата ${money(-left)}`
                                : `залишок ${money(left)}`}
                        </span>
                      </span>
                      {/* Смужка оплати: скільки від вартості вже внесено. */}
                      <span className="block h-1 rounded-full bg-wash" aria-hidden="true">
                        <span
                          className={`block h-full rounded-full ${left !== null && left <= 0 ? "bg-success" : "bg-accent"}`}
                          style={{ width: `${paidShare * 100}%` }}
                        />
                      </span>
                      <span className="text-xs text-ink-2">Оплачено {paid ? money(paid) : "—"}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

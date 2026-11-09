"use client";

import Link from "next/link";
import { useState } from "react";
import { isFinished, stageStatus, useCanManage, useCurrentUser, useWeekData } from "@/lib/week-store";
import { projectLabel, type Project } from "@/lib/mock-projects";
import { NewProjectButton } from "./NewProjectButton";

const field = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const MONTH_NAMES = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];

const money = (value: number) => `${Math.round(value).toLocaleString("uk-UA")} грн`;
const dateLabel = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/**
 * Список проектів карточками з фільтрами: місяць і дата прийому, назва або номер, замовник, менеджер.
 * Менеджер за замовчуванням бачить свої проекти; фільтр менеджера — коли менеджерів кілька.
 * Фільтр етапу: за замовчуванням усі в роботі, завершені — лише якщо їх вибрати.
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
  if (!data) return null;

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
      (stage === "all" || (stage === "" ? stages.get(project.id) !== "finished" : stages.get(project.id) === stage))
    );
  });
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
      {canManage && (
        <div className="flex justify-end">
          <NewProjectButton />
        </div>
      )}

      <div className="grid gap-1.5 sm:grid-cols-2">
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
        <select aria-label="Етап" value={stage} onChange={(event) => setStage(event.target.value)} className={field}>
          <option value="">Усі в роботі</option>
          {data.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          {hasNone && <option value="none">Ще не у виробництві</option>}
          <option value="finished">Завершені</option>
          <option value="all">Усі, разом із завершеними</option>
        </select>
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

      <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
        <span>
          Проектів: {found.length}
          {found.length !== all.length && ` із ${all.length}`}
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
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {found.map((project) => {
            const paid = project.payments.reduce((sum, payment) => sum + payment.amount, 0);
            const cost = project.clientPrice;
            const left = cost === null ? null : Math.round(cost - paid);
            return (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`} className="grid h-full gap-1.5 rounded-lg border border-line bg-surface p-2.5 hover:border-accent hover:bg-wash">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold">
                      <span className="text-ink-2">№{project.number}</span> {project.product}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                        stages.get(project.id) === "finished" ? "border-success/50 text-success" : "border-accent font-medium text-accent-ink"
                      }`}
                    >
                      {stageName(stages.get(project.id)!)}
                    </span>
                  </span>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
                    <dt className="text-ink-2">Прийнято</dt>
                    <dd>{dateLabel(project.acceptedOn)}</dd>
                    <dt className="text-ink-2">Замовник</dt>
                    <dd className="truncate">{project.client}</dd>
                    {managers.length > 1 && (
                      <>
                        <dt className="text-ink-2">Менеджер</dt>
                        <dd className="truncate">{managerName(project.managerId)}</dd>
                      </>
                    )}
                    {canManage && (
                      <>
                        <dt className="text-ink-2">Вартість</dt>
                        <dd className="font-medium tabular-nums">{cost === null ? "Не вписано" : money(cost)}</dd>
                        <dt className="text-ink-2">Оплачено</dt>
                        <dd className="font-medium tabular-nums">{paid ? money(paid) : "—"}</dd>
                        <dt className="text-ink-2">{left !== null && left < 0 ? "Переплата" : "Залишок"}</dt>
                        <dd className={`font-medium tabular-nums ${left === 0 ? "text-success" : left !== null && left < 0 ? "text-warning" : ""}`}>
                          {left === null ? "—" : left === 0 ? "оплачено" : money(Math.abs(left))}
                        </dd>
                      </>
                    )}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

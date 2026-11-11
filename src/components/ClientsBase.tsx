"use client";

import Link from "next/link";
import { useState } from "react";
import { projectLabel, type Client, type Project } from "@/lib/mock-projects";
import { isFinished, useCanManage, useCurrentUser, useWeekData } from "@/lib/week-store";
import { ClientDialog } from "./ClientDialog";

const field = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";

type Status = "" | "active" | "finished" | "none";

/**
 * База замовників для адміністратора й менеджерів: контакти й проекти, пошук і фільтр за станом проектів.
 * Дані замовника змінює будь-який менеджер (з одним замовником можуть працювати різні менеджери),
 * а проект іншого менеджера відкривається лише для перегляду — це обмежує картка проекту.
 */
export function ClientsBase() {
  const data = useWeekData();
  const user = useCurrentUser();
  const canManage = useCanManage();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  if (!data) return null;
  if (!canManage) return <p className="text-sm text-ink-2">Цей розділ доступний лише адміністратору й менеджерам.</p>;

  const done = (project: Project) => isFinished(data, projectLabel(project));
  const projectsOf = (client: Client) => data.projects.filter((p) => p.clientId === client.id);
  const managerName = (project: Project) => data.people.find((person) => person.id === project.managerId)?.name ?? "";
  // Позначка «не ваш» має сенс лише менеджеру: адміністратор змінює будь-який проект.
  const foreign = (project: Project) => user?.role === "manager" && project.managerId !== user.id;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const digits = query.replace(/\D/g, "");
  const all = [...data.clients].sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const found = all.filter((client) => {
    const projects = projectsOf(client);
    const text = [client.name, client.phone, client.address, ...projects.map((p) => `№${p.number} ${p.product}`)]
      .join(" ")
      .toLowerCase();
    const byText = words.every((word) => text.includes(word)) || (digits.length >= 3 && client.phone.replace(/\D/g, "").includes(digits));
    const active = projects.some((project) => !done(project));
    const byStatus =
      !status ||
      (status === "active" && active) ||
      (status === "finished" && projects.length > 0 && !active) ||
      (status === "none" && projects.length === 0);
    return byText && byStatus;
  });
  // Відкрите вікно показує свіжі дані замовника.
  const current = editing && editing !== "new" ? data.clients.find((c) => c.id === editing.id) : undefined;

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-ink-2">
          Дані замовника спільні для всіх його проектів. Натисніть на замовника, щоб змінити.
          {user?.role === "manager" && " Проекти інших менеджерів відкриваються лише для перегляду."}
        </p>
        <button type="button" className="rounded-md bg-success-fill px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-success-fill-hover" onClick={() => setEditing("new")}>
          + Додати замовника
        </button>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_200px]">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Пошук замовника"
          placeholder="Пошук: ім'я, телефон, адреса, номер проекту"
          className={field}
        />
        <select aria-label="Стан проектів" value={status} onChange={(event) => setStatus(event.target.value as Status)} className={field}>
          <option value="">Усі замовники</option>
          <option value="active">Є проект у роботі</option>
          <option value="finished">Усі проекти завершено</option>
          <option value="none">Без проектів</option>
        </select>
      </div>

      <p className="text-sm text-ink-2">
        Замовників: {found.length}
        {found.length !== all.length && ` із ${all.length}`}
      </p>

      {found.length === 0 ? (
        <p className="text-sm text-ink-2">Нічого не знайдено.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {found.map((client) => {
            const projects = projectsOf(client);
            return (
              <li key={client.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-x-4">
                <button type="button" aria-label={`Змінити замовника ${client.name}`} className="min-w-0 text-left hover:underline" onClick={() => setEditing(client)}>
                  <span className="font-semibold">{client.name}</span>
                  {client.phone && <span className="block text-ink-2">{client.phone}</span>}
                  <span className="block text-xs text-ink-2">
                    {client.address || "Адресу не вказано"}
                    {client.floor ? ` · поверх ${client.floor}` : ""}
                  </span>
                </button>
                {projects.length > 0 ? (
                  <ul className="grid gap-1">
                    {projects.map((project) => (
                      <li key={project.id} className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <Link href={`/projects/${project.id}`} className="hover:underline">
                            №{project.number} {project.product}
                          </Link>
                          <span className="block text-xs text-ink-2">
                            менеджер: {managerName(project) || "—"}
                            {foreign(project) && " · лише перегляд"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-2">{done(project) ? "завершено" : "у роботі"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-ink-2">Проектів ще немає</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing === "new" && <ClientDialog onClose={() => setEditing(null)} />}
      {current && <ClientDialog key={current.id} client={current} onClose={() => setEditing(null)} />}
    </section>
  );
}

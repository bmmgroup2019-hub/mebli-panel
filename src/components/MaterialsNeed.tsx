"use client";

import Link from "next/link";
import { useState } from "react";
import { rowsWord } from "@/lib/materials";
import type { Project } from "@/lib/mock-projects";
import { specReady, useSeesOffice, useWeekData } from "@/lib/week-store";

type Need = {
  name: string;
  unit: string;
  total: number;
  unknown: number; // рядків без кількості
  projects: { project: Project; quantity: number | null }[];
};

const chip =
  "rounded-full border border-line bg-surface px-3 py-1 text-sm hover:bg-wash aria-pressed:border-accent aria-pressed:bg-accent-wash aria-pressed:font-semibold aria-pressed:text-accent-ink";

const amount = (value: number) => value.toLocaleString("uk-UA", { maximumFractionDigits: 2 });

/** Скільки матеріалів потрібно на проекти, де специфікація готова, а виріб ще в роботі. */
export function MaterialsNeed() {
  const data = useWeekData();
  const seesOffice = useSeesOffice();
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // порожньо — усі проекти разом
  if (!data) return null;

  const ready = data.projects.filter((project) => specReady(data, project));
  const counted = ready.filter((project) => project.spec.length > 0);
  const empty = ready.filter((project) => project.spec.length === 0);
  const specStage = data.stages.find((stage) => stage.createsSpec)?.label ?? "Специфікація";
  // Вибрати можна один проект або кілька; нічого не вибрано — усі.
  const selected = counted.filter((project) => selectedIds.includes(project.id));
  const shown = selected.length > 0 ? selected : counted;
  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));

  // Однакова назва й одиниця в групі складаються, без різниці у великих літерах.
  // Куплене (відмітка «Куплено» в специфікації) не рахуємо: показуємо, що ще треба купити.
  const needs = new Map<string, Need & { groupId: string }>();
  let boughtRows = 0;
  for (const project of shown) {
    for (const row of project.spec) {
      if (row.purchase === "bought") {
        boughtRows += 1;
        continue;
      }
      const key = `${row.groupId}|${row.name.toLowerCase()}|${row.unit}`;
      const need = needs.get(key) ?? { groupId: row.groupId, name: row.name, unit: row.unit, total: 0, unknown: 0, projects: [] };
      if (row.quantity === null) need.unknown += 1;
      else need.total += row.quantity;
      need.projects.push({ project, quantity: row.quantity });
      needs.set(key, need);
    }
  }
  const groups = data.specGroups
    .map((group) => ({
      group,
      list: [...needs.values()].filter((need) => need.groupId === group.id).sort((a, b) => a.name.localeCompare(b.name, "uk")),
    }))
    .filter(({ list }) => list.length > 0);

  return (
    <>
      <div className="grid gap-1 text-sm">
        <p className="text-ink-2">
          Проекти, де етап «{specStage}» зроблено, а виріб ще в роботі. Куплене не враховується.
        </p>
        {counted.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Проекти в потребі">
            <button type="button" aria-pressed={selected.length === 0} onClick={() => setSelectedIds([])} className={chip}>
              Усі разом · {counted.length}
            </button>
            {counted.map((project) => {
              const on = selected.includes(project);
              return (
                <button key={project.id} type="button" aria-pressed={on} onClick={() => toggle(project.id)} className={chip}>
                  {on && <span aria-hidden="true">✓ </span>}№{project.number} {project.product}
                </button>
              );
            })}
          </div>
        )}
        {counted.length > 1 && (
          <p className="text-xs text-ink-2">
            {selected.length === 0 ? "Можна вибрати один проект або кілька." : `Вибрано проектів: ${selected.length} із ${counted.length}`}
          </p>
        )}
        {/* Закупівельник карток проектів не відкриває. */}
        {seesOffice && selected.length === 1 && (
          <Link href={`/projects/${selected[0].id}`} className="text-ink-2 hover:underline">
            Відкрити проект №{selected[0].number} →
          </Link>
        )}
        {empty.length > 0 && (
          <p className="text-critical">
            Специфікацію не заповнено: {empty.map((project) => `№${project.number} ${project.product}`).join(", ")}
          </p>
        )}
      </div>

      {boughtRows > 0 && (
        <p className="text-sm text-ink-2">
          Уже куплено й не враховано: <span className="tabular-nums">{boughtRows}</span> {rowsWord(boughtRows)} специфікацій.
        </p>
      )}
      {groups.length === 0 &&
        (shown.length > 0 ? (
          <p className="text-sm text-ink-2">Усе за специфікаціями вже куплено.</p>
        ) : (
          <p className="text-sm text-ink-2">Зараз немає проектів із готовою специфікацією.</p>
        ))}

      {groups.map(({ group, list }) => (
        <section key={group.id} className="grid gap-1.5">
          <h2 className="font-semibold">{group.name}</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {list.map((need) => (
              <li key={`${need.name}|${need.unit}`} className="grid gap-0.5 px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">{need.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {need.unknown === need.projects.length ? "?" : amount(need.total)} {need.unit}
                    {need.unknown > 0 && need.unknown < need.projects.length && <span className="font-normal text-critical"> + ?</span>}
                  </span>
                </div>
                {shown.length > 1 && <p className="text-xs text-ink-2">
                  {need.projects
                    .map(({ project, quantity }) => `№${project.number}: ${quantity === null ? "к-сть не вказано" : amount(quantity)}`)
                    .join(" · ")}
                </p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

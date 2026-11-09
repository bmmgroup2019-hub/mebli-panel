"use client";

import Link from "next/link";
import { useState } from "react";
import { projectLabel, type Project } from "@/lib/mock-projects";
import { isFinished, stageStatus, useWeekData, type WeekData } from "@/lib/week-store";

type Need = {
  name: string;
  unit: string;
  total: number;
  unknown: number; // рядків без кількості
  projects: { project: Project; quantity: number | null }[];
};

/** Специфікація готова, коли зроблено всі етапи з позначкою «Специфікація» (у прикладі «Робочий проект»). */
function specReady(data: WeekData, project: Project) {
  const label = projectLabel(project);
  const specStages = data.stages.filter((stage) => stage.createsSpec);
  return (
    specStages.length > 0 &&
    specStages.every((stage) => stageStatus(data.items, label, stage.id) === "done") &&
    !isFinished(data, label)
  );
}

const amount = (value: number) => value.toLocaleString("uk-UA", { maximumFractionDigits: 2 });

/** Скільки матеріалів потрібно на проекти, де специфікація готова, а виріб ще в роботі. */
export function MaterialsNeed() {
  const data = useWeekData();
  const [selectedId, setSelectedId] = useState<string | null>(null); // null — усі проекти разом
  if (!data) return null;

  const ready = data.projects.filter((project) => specReady(data, project));
  const counted = ready.filter((project) => project.spec.length > 0);
  const empty = ready.filter((project) => project.spec.length === 0);
  const specStage = data.stages.find((stage) => stage.createsSpec)?.label ?? "Специфікація";
  const selected = counted.find((project) => project.id === selectedId) ?? null;
  const shown = selected ? [selected] : counted;

  // Однакова назва й одиниця в групі складаються, без різниці у великих літерах.
  const needs = new Map<string, Need & { groupId: string }>();
  for (const project of shown) {
    for (const row of project.spec) {
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
          Проекти, де етап «{specStage}» зроблено, а виріб ще в роботі.
        </p>
        {counted.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Проекти в потребі">
            {[{ id: null, label: `Усі разом · ${counted.length}` }, ...counted.map((project) => ({ id: project.id, label: `№${project.number} ${project.product}` }))].map(
              (option) => (
                <button
                  key={option.id ?? "all"}
                  type="button"
                  aria-pressed={(selected?.id ?? null) === option.id}
                  onClick={() => setSelectedId(option.id)}
                  className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-wash aria-pressed:bg-wash aria-pressed:font-semibold"
                >
                  {option.label}
                </button>
              ),
            )}
          </div>
        )}
        {selected && (
          <Link href={`/projects/${selected.id}`} className="text-ink-2 hover:underline">
            Відкрити проект №{selected.number} →
          </Link>
        )}
        {empty.length > 0 && (
          <p className="text-critical">
            Специфікацію не заповнено: {empty.map((project) => `№${project.number} ${project.product}`).join(", ")}
          </p>
        )}
      </div>

      {groups.length === 0 && <p className="text-sm text-ink-2">Зараз немає проектів із готовою специфікацією.</p>}

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
                {!selected && <p className="text-xs text-ink-2">
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

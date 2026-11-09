"use client";

import type { StageStatus } from "@/lib/mock-projects";
import { stageStatus, useWeekData } from "@/lib/week-store";

const STATUS: Record<StageStatus, { icon: string; label: string }> = {
  done: { icon: "✓", label: "Готово" },
  wip: { icon: "●", label: "В роботі" },
  todo: { icon: "○", label: "Не почато" },
};

export function ProjectStages({ name }: { name: string }) {
  const data = useWeekData();
  if (!data) return null;
  return (
    <ol className="grid gap-2 sm:auto-cols-fr sm:grid-flow-col">
      {data.stages.map((stage, index) => {
        const status = stageStatus(data.items, name, stage.id);
        const active = status === "wip";
        return (
          <li
            key={stage.id}
            className={`rounded-lg border bg-surface p-3 ${active ? "border-ink" : "border-line"}`}
          >
            <p className="text-sm font-medium leading-snug">
              {index + 1}. {stage.label}
              {stage.hint && <span className="font-normal text-ink-2"> ({stage.hint})</span>}
            </p>
            <p className={`mt-1 text-sm ${active ? "font-medium" : "text-ink-2"}`}>
              <span aria-hidden="true">{STATUS[status].icon} </span>
              {STATUS[status].label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}


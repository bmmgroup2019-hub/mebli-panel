"use client";

import { mondayOf, todayIso } from "@/lib/dates";
import { projectLabel, type Project, type WeekData } from "@/lib/model";
import { completeItem, reopenItem, useCurrentUser, useWeekData } from "@/lib/week-store";
import { assigneeOf, blockedReason, canReopen, isIntake } from "@/lib/rules";
import { RefuseButton } from "./ProjectRefusal";
import { button } from "./ui";


/** Запис прийому проекту на «Тижні»: незроблений (на прийомі) або останній зроблений. */
export function intakeItemOf(data: WeekData, project: Project) {
  const label = projectLabel(project);
  const items = data.items.filter((item) => item.order === label && isIntake(data, item.stage));
  return items.find((item) => item.doneWeek === null) ?? items.at(-1) ?? null;
}

/**
 * Дії прийому (рішення користувача 2026-11-26: прийом — у «Проектах», без окремої сторінки).
 * «Передати у виробництво» — галочка першого етапу: лише з авансом, адміністратор або менеджер прийому.
 * Без авансу — сіра «Позначити відмову». Після передачі — «Повернути на прийом», поки наступний етап не взяли.
 */
export function IntakeActions({ project, compact = false }: { project: Project; compact?: boolean }) {
  const data = useWeekData();
  const user = useCurrentUser();
  if (!data || !user || project.refusal) return null;
  const item = intakeItemOf(data, project);
  if (!item) return <RefuseButton project={project} />;
  const mayMark = user.role === "admin" || assigneeOf(item, data.people) === user.id;
  const week = mondayOf(todayIso());

  if (item.doneWeek !== null) {
    // Повернути можна лише щойно передане: поки конструктор не взяв його в роботу.
    if (!mayMark || !canReopen(data.items, item) || compact) return null;
    return (
      <button type="button" className={button} onClick={() => reopenItem(item.id)}>
        Повернути на прийом
      </button>
    );
  }

  const blocked = blockedReason(data, item);
  return (
    <>
      {mayMark && !blocked && (
        <button
          type="button"
          className="rounded-lg bg-accent-fill px-3 py-1.5 text-sm font-semibold text-accent-on hover:bg-accent-fill-hover"
          onClick={() => completeItem(item.id, week)}
        >
          Передати у виробництво
        </button>
      )}
      {mayMark && blocked && !compact && (
        <span className="self-center text-xs text-ink-2">{blocked === "Спершу внесіть аванс" ? "Передати у виробництво можна після авансу" : blocked}</span>
      )}
      <RefuseButton project={project} />
    </>
  );
}

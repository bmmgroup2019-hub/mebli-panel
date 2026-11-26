"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, diffDays, dueLabel, formatSpan, isoWeek, mondayOf, todayIso } from "@/lib/dates";
import { projectLabel, type Project, type Stage } from "@/lib/mock-projects";
import { NewProjectButton } from "./NewProjectButton";
import {
  assigneeOf,
  isFinished,
  isIntake,
  issueTypeName,
  stageStatus,
  useWeekData,
  type Issue,
  type WeekData,
  type WorkItem,
} from "@/lib/week-store";

/** «Головна»: лише огляд, без форм. */
export function Home() {
  const data = useWeekData();
  const [week] = useState(() => mondayOf(todayIso()));
  if (!data) return <p className="py-16 text-center text-ink-2">Завантаження…</p>;
  return <Overview data={data} week={week} />;
}

type Row = {
  order: string;
  project?: Project;
  items: WorkItem[];
  problems: Issue[];
  overdue: boolean;
  unassigned: boolean;
};

const stageLabel = (stages: Stage[], id: string) => stages.find((s) => s.id === id)?.label ?? id;

/** Загальна картина на зараз: не залежить від тижня, вибраного у фронті робіт. */
export function Overview({ data, week }: { data: WeekData; week: string }) {
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const today = todayIso();
  // Виробництво окремо від прийому: прорахованих замовлень на прийомі буває багато, вони не робота цеху.
  const all = data.items.filter((item) => item.doneWeek === null && item.week <= week);
  const open = all.filter((item) => !isIntake(data, item.stage));
  const intake = all.filter((item) => isIntake(data, item.stage));
  const intakeOrders = new Set(intake.map((item) => item.order));
  const intakePaid = data.projects.filter((p) => intakeOrders.has(projectLabel(p)) && p.payments.length > 0).length;
  const problems = data.issues.filter((issue) => issue.order && !issue.resolved);
  const hasNobody = (item: WorkItem) =>
    data.people.some((p) => p.stages.includes(item.stage)) && !assigneeOf(item, data.people);

  const rows: Row[] = [...new Set(open.map((item) => item.order))].map((order) => {
    const project = data.projects.find((p) => projectLabel(p) === order);
    const items = open.filter((item) => item.order === order);
    return {
      order,
      project,
      items,
      unassigned: items.some(hasNobody),
      problems: problems.filter((issue) => issue.order === order),
      overdue: Boolean(project?.dueOn && project.dueOn < today),
    };
  });
  // Спершу те, що потребує уваги, далі за найближчою датою здачі.
  const urgency = (row: Row) => (row.problems.length > 0 ? 0 : row.overdue ? 1 : 2);
  rows.sort(
    (a, b) =>
      urgency(a) - urgency(b) ||
      (a.project?.dueOn || "9999").localeCompare(b.project?.dueOn || "9999"),
  );

  const waiting = data.projects.filter((project) => {
    const label = projectLabel(project);
    return !project.refusal && !rows.some((row) => row.order === label) && !intakeOrders.has(label) && !isFinished(data, label);
  });
  const unassigned = open.filter(hasNobody);
  const lastStage = data.stages.at(-1)?.id;
  const finished = data.items.filter((item) => item.stage === lastStage && item.doneWeek === week);

  const filters: Record<string, { label: string; test: (row: Row) => boolean }> = {
    problems: { label: "Проблеми", test: (row) => row.problems.length > 0 },
    overdue: { label: "Прострочено", test: (row) => row.overdue },
    unassigned: { label: "Не призначено", test: (row) => row.unassigned },
    carried: { label: "Перенесено", test: (row) => row.items.some((item) => item.week < week) },
  };
  for (const type of data.issueTypes) {
    filters[type.id] = { label: type.name, test: (row) => row.problems.some((p) => p.typeId === type.id) };
  }
  const active = filterKey ? filters[filterKey] : undefined;
  const visible = active ? rows.filter(active.test) : rows;
  const toggle = (key: string) => () => setFilterKey(filterKey === key ? null : key);
  const types = data.issueTypes
    .map((type) => ({ ...type, count: problems.filter((p) => p.typeId === type.id).length }))
    .filter((type) => type.count > 0);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Тиждень {isoWeek(week)} · {formatSpan(week, addDays(week, 6))}
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Виробництво</h1>
        </div>
        <NewProjectButton />
      </header>

      <div role="group" aria-label="Стан виробництва" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-7">
        <Stat label="У роботі" value={rows.length} pressed={!active} onClick={() => setFilterKey(null)} />
        <Stat label="На прийомі" value={intake.length} note={`з авансом ${intakePaid}`} href="/intake" />
        <Stat label="Проблеми" value={problems.length} warn pressed={filterKey === "problems"} onClick={toggle("problems")} />
        <Stat label="Прострочено" value={rows.filter((row) => row.overdue).length} warn pressed={filterKey === "overdue"} onClick={toggle("overdue")} />
        <Stat label="Не призначено" value={unassigned.length} warn pressed={filterKey === "unassigned"} onClick={toggle("unassigned")} />
        <Stat label="Перенесено" value={open.filter((item) => item.week < week).length} pressed={filterKey === "carried"} onClick={toggle("carried")} />
        <Stat label="Завершено за тиждень" value={finished.length} good />
      </div>

      {types.length > 0 && (
        <div role="group" aria-label="Проблеми за типами" className="flex flex-wrap gap-1.5">
          {types.map((type) => (
            <button
              key={type.id}
              type="button"
              aria-pressed={filterKey === type.id}
              onClick={toggle(type.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm hover:bg-wash aria-pressed:border-accent aria-pressed:bg-accent-wash aria-pressed:text-accent-ink"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-critical" />
              {type.name}
              <span className="tabular-nums text-ink-2">{type.count}</span>
            </button>
          ))}
          <Link href="/issues" className="px-2 py-1 text-sm text-ink-2 hover:text-ink">Усі проблеми →</Link>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Проекти в роботі{active && `: ${active.label.toLowerCase()} (${visible.length})`}
            </h2>
            {active && (
              <button type="button" className="text-sm underline" onClick={() => setFilterKey(null)}>Показати всі</button>
            )}
          </div>
          {visible.length > 0 ? (
            <ul className="grid gap-2">
              {visible.map((row) => <ProjectRow key={row.order} row={row} data={data} week={week} today={today} />)}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">{active ? "Таких проектів немає." : "Проектів у роботі немає."}</p>
          )}
          {!active && waiting.length > 0 && (
            <p className="text-sm text-ink-2">
              Ще не у виробництві:{" "}
              {waiting.map((project, index) => (
                <span key={project.id}>
                  {index > 0 && ", "}
                  <Link href={`/projects/${project.id}`} className="underline">{projectLabel(project)}</Link>
                </span>
              ))}
            </p>
          )}
        </section>

        <div className="grid gap-4">
          <StageLoad stages={data.stages.filter((stage) => !isIntake(data, stage.id))} open={open} week={week} />
          <People data={data} open={open} intake={intake} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
  good,
  pressed,
  onClick,
  note,
  href,
}: {
  label: string;
  value: number;
  warn?: boolean;
  good?: boolean;
  pressed?: boolean;
  onClick?: () => void;
  note?: string;
  href?: string;
}) {
  const alert = warn && value > 0;
  // Тривожна плитка — з червоною рамкою й ледь червоним фоном.
  const tone = alert ? "border-critical/50 bg-critical/[0.06]" : "border-line bg-surface";
  const dot = alert ? "bg-critical" : good && value > 0 ? "bg-success" : "bg-line";
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs leading-tight text-ink-2">
        <span aria-hidden="true" className={`size-1.5 flex-none rounded-full ${dot}`} />
        {label}
      </span>
      <span className={`mt-2 block text-3xl font-semibold leading-none tabular-nums ${good && value > 0 ? "text-success" : alert ? "text-critical" : ""}`}>
        {value}
      </span>
      {note && <span className="mt-1 block text-xs text-ink-2">{note}</span>}
    </>
  );
  const box = `rounded-lg border p-3 sm:p-4 ${tone}`;
  if (href) return <Link href={href} className={`${box} hover:border-ink-2/40`}>{body}</Link>;
  if (!onClick) return <div className={box}>{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${box} text-left hover:border-ink-2/40 aria-pressed:border-accent aria-pressed:ring-1 aria-pressed:ring-accent`}
    >
      {body}
    </button>
  );
}

function ProjectRow({ row, data, week, today }: { row: Row; data: WeekData; week: string; today: string }) {
  const { order, project, items, problems, overdue, unassigned } = row;
  const people = [...new Set(items.map((item) => assigneeOf(item, data.people)))]
    .map((id) => data.people.find((person) => person.id === id)?.name)
    .filter(Boolean);
  const stuckWeeks = Math.max(...items.map((item) => diffDays(item.week, week) / 7));
  const details = [
    items.map((item) => stageLabel(data.stages, item.stage)).join(" + "),
    ...people,
    unassigned && "⚠ не призначено",
    stuckWeeks >= 1 && `перенесено ${stuckWeeks} тиж.`,
  ].filter(Boolean).join(" · ");

  return (
    <li
      className={`relative overflow-hidden rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-ink-2/40 sm:p-4 ${
        problems.length > 0 ? "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-critical" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 break-words font-semibold">
          {project ? <Link href={`/projects/${project.id}`} className="hover:text-accent-ink">{order}</Link> : order}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${overdue ? "bg-critical/15 font-medium text-critical" : "bg-wash text-ink-2"}`}
        >
          {project ? dueLabel(project.dueOn, today) : "Немає картки проекту"}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <span
          className="grid w-28 flex-none gap-1"
          style={{ gridTemplateColumns: `repeat(${data.stages.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {data.stages.map((stage) => {
            const status = stageStatus(data.items, order, stage.id);
            const tone = status === "done" ? "bg-success" : status === "wip" ? "bg-stage-now" : "bg-line";
            return <span key={stage.id} className={`h-1.5 rounded-full ${tone}`} />;
          })}
        </span>
        <span className="min-w-0 text-sm text-ink-2">{details}</span>
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 grid gap-1 rounded-md bg-critical/[0.08] px-3 py-2 text-sm">
          {problems.map((issue) => (
            <li key={issue.id} className="break-words">
              <span aria-hidden="true" className="text-critical">⚠ </span>
              {issue.typeId && <span className="font-medium text-critical">{issueTypeName(data.issueTypes, issue.typeId)}: </span>}
              {issue.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function StageLoad({ stages, open, week }: { stages: Stage[]; open: WorkItem[]; week: string }) {
  const counts = stages.map((stage) => {
    const items = open.filter((item) => item.stage === stage.id);
    return { stage, total: items.length, carried: items.filter((item) => item.week < week).length };
  });
  const max = Math.max(1, ...counts.map((c) => c.total));

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="font-semibold">Завантаження етапів</h2>
      <ul className="grid gap-3">
        {counts.map(({ stage, total, carried }) => (
          <li key={stage.id} className="grid gap-1.5 text-sm">
            <span className="flex items-baseline justify-between gap-2">
              {stage.label}
              <span className="flex-none whitespace-nowrap text-ink-2 tabular-nums">
                <span className="text-ink">{total}</span>
                {carried > 0 && <span className="text-warning"> · перенесено {carried}</span>}
              </span>
            </span>
            <span className="block h-1.5 rounded-full bg-wash" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
                style={{ width: `${(total / max) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function People({ data, open, intake }: { data: WeekData; open: WorkItem[]; intake: WorkItem[] }) {
  const people = data.people.filter((person) => person.stages.length > 0);
  if (people.length === 0) return null;

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="font-semibold">Люди</h2>
      <ul className="grid gap-2.5 text-sm">
        {people.map((person) => {
          const own = open.filter((item) => assigneeOf(item, data.people) === person.id);
          // Менеджеру — скільки на прийомі, а не довгий список номерів.
          const onIntake = intake.filter((item) => assigneeOf(item, data.people) === person.id).length;
          const numbers = [...new Set(own.map((item) => item.order.split(" · ")[0]))];
          const initials = person.name
            .split(/\s+/)
            .map((word) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <li key={person.id} className="flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-full bg-wash text-[11px] font-semibold ring-1 ring-line">
                {initials}
              </span>
              <span className="min-w-0 flex-1 break-words">{person.name}</span>
              {onIntake > 0 ? (
                <Link href="/intake" className="flex-none text-right text-ink-2 hover:text-ink">на прийомі {onIntake}</Link>
              ) : numbers.length > 0 ? (
                <span className="flex-none text-right text-ink-2 tabular-nums">{numbers.join(", ")}</span>
              ) : (
                <span className="flex-none rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Вільний</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import { amount, findMaterial, money, rowsWord } from "@/lib/materials";
import { type Project, type PurchaseStatus, type SpecRow } from "@/lib/mock-projects";
import { clientOf, projectAccess, setPurchaseMany, specReady, useCurrentUser, useWeekData, type WeekData } from "@/lib/week-store";

const field = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
const small = "rounded-lg border border-line bg-surface px-2.5 py-1 text-xs hover:bg-wash";

const LABEL: Record<PurchaseStatus | "none", string> = { none: "Не замовлено", ordered: "Замовлено", bought: "Куплено" };

/** Що показувати: за замовчуванням усе; «need» — ще не куплено (не замовлено й замовлено). */
const STATES = [
  { id: "all", label: "Усі стани" },
  { id: "need", label: "Ще не куплено" },
  { id: "none", label: "Не замовлено" },
  { id: "ordered", label: "Замовлено" },
  { id: "bought", label: "Куплено" },
] as const;
type State = (typeof STATES)[number]["id"];

/** Рядок специфікації з усім, що треба закупівельнику. */
type Line = {
  project: Project;
  row: SpecRow;
  status: PurchaseStatus | "none";
  canMark: boolean;
  unit: string;
  price: number | null;
  sum: number | null;
  article: string | null; // артикул із довідника; null — назви немає в довіднику
};

/**
 * Кольори станів (рішення користувача 2026-11-21: відмічене не ховати, а виділяти кольором):
 * не замовлено — червоний, замовлено — жовтий, куплено — зелений.
 */
const TONE: Record<Line["status"], { pill: string; row: string; stripe: string }> = {
  none: { pill: "border-critical/40 bg-critical/15 text-critical", row: "bg-critical/[0.05]", stripe: "border-l-critical" },
  ordered: { pill: "border-warning/40 bg-warning/15 text-warning", row: "bg-warning/[0.06]", stripe: "border-l-warning" },
  bought: { pill: "border-success/40 bg-success/15 text-success", row: "bg-success/[0.06]", stripe: "border-l-success" },
};

/** Загальний стан кількох рядків: є не замовлене — «none», усе куплено — «bought», інакше «ordered». */
const overall = (lines: Line[]): Line["status"] =>
  lines.some((line) => line.status === "none") ? "none" : lines.every((line) => line.status === "bought") ? "bought" : "ordered";

const lineKey = (line: Line) => `${line.project.id}|${line.row.id}`;

const statusFits = (status: Line["status"], state: State) =>
  state === "all" || (state === "need" ? status !== "bought" : status === state);

/** Скільки рядків у якому стані: «2 не замовлено · 1 куплено». */
function statusSummary(lines: Line[]) {
  const count = (status: Line["status"]) => lines.filter((line) => line.status === status).length;
  return (["none", "ordered", "bought"] as const)
    .filter((status) => count(status) > 0)
    .map((status) => `${LABEL[status].toLowerCase()}: ${count(status)}`)
    .join(" · ");
}

const quantityText = (lines: Line[]) => {
  const known = lines.filter((line) => line.row.quantity !== null);
  const total = known.reduce((sum, line) => sum + line.row.quantity!, 0);
  if (known.length === 0) return "?";
  return `${amount(total)}${known.length < lines.length ? " + ?" : ""}`;
};

const sumOf = (lines: Line[]) => lines.reduce((sum, line) => sum + (line.sum ?? 0), 0);

/**
 * Закупка за специфікаціями: зведено по матеріалу або по замовленнях.
 * Відмічають закупівельник і адміністратор (усі проекти) та менеджер (свої проекти); специфікацію тут не змінюють.
 */
export function Purchases() {
  const data = useWeekData();
  const user = useCurrentUser();
  const [view, setView] = useState<"material" | "project">("material");
  const [state, setState] = useState<State>("all");
  // Рядки, відмічені після вибору фільтра, лишаються на місці, навіть якщо вже не підходять під фільтр.
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [groupId, setGroupId] = useState("");
  const [projectId, setProjectId] = useState("");
  if (!data) return null;

  const projects = data.projects
    .filter((project) => specReady(data, project))
    .sort((a, b) => a.number.localeCompare(b.number, "uk", { numeric: true }));
  const empty = projects.filter((project) => project.spec.length === 0);

  const all: Line[] = projects.flatMap((project) => {
    const canMark = projectAccess(data, user, project).canPurchase;
    return project.spec.map((row) => {
      const material = findMaterial(data.materials, row.name);
      const price = material?.price ?? null;
      return {
        project,
        row,
        status: row.purchase ?? "none",
        canMark,
        unit: material?.unit ?? row.unit,
        price,
        sum: price !== null && row.quantity !== null ? price * row.quantity : null,
        article: material?.article ?? null,
      };
    });
  });
  const lines = all.filter(
    (line) =>
      (statusFits(line.status, state) || kept.has(lineKey(line))) &&
      (!groupId || line.row.groupId === groupId) &&
      (!projectId || line.project.id === projectId),
  );
  const noPrice = lines.filter((line) => line.sum === null).length;
  const canMarkAny = all.some((line) => line.canMark);

  const mark = (list: Line[], status: PurchaseStatus | null) => {
    const marked = list.filter((line) => line.canMark);
    setKept(new Set([...kept, ...marked.map(lineKey)]));
    setPurchaseMany(
      marked.map((line) => ({ projectId: line.project.id, rowId: line.row.id })),
      status,
    );
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5 sm:grid-cols-3">
        <select aria-label="Стан закупки" value={state} onChange={(e) => {
          setState(e.target.value as State);
          setKept(new Set());
        }} className={field}>
          {STATES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select aria-label="Група" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={field}>
          <option value="">Усі групи</option>
          {data.specGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select aria-label="Замовлення" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
          <option value="">Усі замовлення · {projects.length}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>№{project.number} {project.product}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Вигляд" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {([["material", "По матеріалах"], ["project", "По замовленнях"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:text-ink aria-pressed:bg-wash aria-pressed:font-semibold aria-pressed:text-ink"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-2">
          <span className="tabular-nums">{lines.length}</span> {rowsWord(lines.length)} · разом{" "}
          <span className="font-semibold text-ink tabular-nums">{money(Math.round(sumOf(lines)))}</span>
          {noPrice > 0 && <> · без ціни: <span className="tabular-nums">{noPrice}</span></>}
        </p>
      </div>

      {!canMarkAny && all.length > 0 && (
        <p className="text-sm text-ink-2">Відмічати закупку можна лише у своїх проектах.</p>
      )}
      {empty.length > 0 && (
        <p className="text-sm text-critical">
          Специфікацію не заповнено: {empty.map((project) => `№${project.number} ${project.product}`).join(", ")}
        </p>
      )}
      {lines.length === 0 && (
        <p className="text-sm text-ink-2">
          {projects.length === 0
            ? "Зараз немає проектів із готовою специфікацією."
            : state === "need"
              ? "Усе за специфікаціями вже куплено."
              : "Нічого не знайдено за цими фільтрами."}
        </p>
      )}

      {view === "material" ? <ByMaterial lines={lines} mark={mark} /> : <ByProject lines={lines} mark={mark} data={data} />}
    </div>
  );
}

type MarkFn = (list: Line[], status: PurchaseStatus | null) => void;

/** Кнопки «Замовлено / Куплено / Скинути» для кількох рядків одразу. */
function MarkAll({ lines, mark, label }: { lines: Line[]; mark: MarkFn; label: string }) {
  if (!lines.some((line) => line.canMark)) return null;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={`Позначити все: ${label}`}>
      <button type="button" className={`${small} ${TONE.ordered.pill} hover:bg-warning/25`} onClick={() => mark(lines, "ordered")}>Замовлено</button>
      <button type="button" className={`${small} ${TONE.bought.pill} font-semibold hover:bg-success/25`} onClick={() => mark(lines, "bought")}>Куплено</button>
      <button type="button" className={`${small} text-ink-2`} onClick={() => mark(lines, null)}>Скинути</button>
    </div>
  );
}

/** Відмітка одного рядка. */
function Status({ line, mark }: { line: Line; mark: MarkFn }) {
  const tone = `border font-medium ${TONE[line.status].pill}`;
  if (!line.canMark) return <span className={`rounded-full px-2.5 py-1 text-xs ${tone}`}>{LABEL[line.status]}</span>;
  return (
    <select
      aria-label={`Закупка: №${line.project.number} ${line.row.name}`}
      value={line.status === "none" ? "" : line.status}
      onChange={(e) => mark([line], (e.target.value || null) as PurchaseStatus | null)}
      className={`rounded-full px-2.5 py-1 text-xs ${tone}`}
    >
      <option value="">{LABEL.none}</option>
      <option value="ordered">{LABEL.ordered}</option>
      <option value="bought">{LABEL.bought}</option>
    </select>
  );
}

const priceText = (line: Line) => (line.price === null ? "ціни немає" : `${money(line.price)} за ${line.unit}`);

/** Зведено: один рядок на матеріал (назва й одиниця), під ним — по замовленнях. */
function ByMaterial({ lines, mark }: { lines: Line[]; mark: MarkFn }) {
  const data = useWeekData();
  if (!data) return null;
  const byKey = new Map<string, Line[]>();
  for (const line of lines) {
    const key = `${line.row.groupId}|${line.row.name.trim().toLowerCase()}|${line.unit}`;
    byKey.set(key, [...(byKey.get(key) ?? []), line]);
  }
  const groups = data.specGroups
    .map((group) => ({
      group,
      items: [...byKey.values()]
        .filter((list) => list[0].row.groupId === group.id)
        .sort((a, b) => a[0].row.name.localeCompare(b[0].row.name, "uk")),
    }))
    .filter(({ items }) => items.length > 0);

  return (
    <>
      {groups.map(({ group, items }) => (
        <section key={group.id} className="grid gap-1.5">
          <h2 className="font-semibold">{group.name}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {items.map((list) => {
              const first = list[0];
              return (
                <li key={`${first.row.groupId}|${first.row.name}|${first.unit}`} className={`grid gap-2 border-l-4 px-4 py-3 text-sm ${TONE[overall(list)].stripe}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 font-medium">
                      {first.row.name}
                      {first.article && <span className="ml-1.5 text-xs font-normal text-ink-2">арт. <span className="tabular-nums">{first.article}</span></span>}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-semibold">{quantityText(list)} {first.unit}</span>
                      {first.price !== null && <span className="text-ink-2"> · {money(Math.round(sumOf(list)))}</span>}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                    <span>{priceText(first)} · {statusSummary(list)}</span>
                    <MarkAll lines={list} mark={mark} label={first.row.name} />
                  </div>
                  <ul className="grid gap-1">
                    {list.map((line) => (
                      <li key={lineKey(line)} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2.5 py-1.5 text-xs ${TONE[line.status].row}`}>
                        <span className="min-w-0 text-ink">
                          №{line.project.number} {line.project.product}
                          {line.row.note && <> · {line.row.note}</>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{line.row.quantity === null ? "к-сть не вказано" : `${amount(line.row.quantity)} ${line.unit}`}</span>
                          <Status line={line} mark={mark} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

/** По замовленнях: блок на кожне замовлення, як у специфікації. */
function ByProject({ lines, mark, data }: { lines: Line[]; mark: MarkFn; data: WeekData }) {
  const byProject = new Map<string, Line[]>();
  for (const line of lines) byProject.set(line.project.id, [...(byProject.get(line.project.id) ?? []), line]);
  const groupName = (id: string) => data.specGroups.find((group) => group.id === id)?.name ?? "";
  const groupOrder = (id: string) => data.specGroups.findIndex((group) => group.id === id);

  return (
    <>
      {[...byProject.values()].map((list) => {
        const project = list[0].project;
        const client = clientOf(data, project);
        const sorted = [...list].sort(
          (a, b) => groupOrder(a.row.groupId) - groupOrder(b.row.groupId) || a.row.name.localeCompare(b.row.name, "uk"),
        );
        return (
          <section key={project.id} className="grid gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                №{project.number} · {project.product}
                {client && <span className="font-normal text-ink-2"> · {client.name}</span>}
              </h2>
              <MarkAll lines={list} mark={mark} label={`№${project.number}`} />
            </div>
            <p className="text-xs text-ink-2">
              {statusSummary(list)} · разом <span className="tabular-nums">{money(Math.round(sumOf(list)))}</span>
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {sorted.map((line) => (
                <li key={line.row.id} className={`grid gap-1 border-l-4 px-4 py-2.5 text-sm ${TONE[line.status].stripe} ${TONE[line.status].row}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0">
                      {line.row.name}
                      <span className="text-xs text-ink-2">
                        {line.article && <> · арт. <span className="tabular-nums">{line.article}</span></>} · {groupName(line.row.groupId)}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {line.row.quantity === null ? "?" : amount(line.row.quantity)} {line.unit}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                    <span>
                      {priceText(line)}
                      {line.sum !== null && <> · <span className="text-ink tabular-nums">{money(Math.round(line.sum))}</span></>}
                      {line.row.note && <> · {line.row.note}</>}
                    </span>
                    <Status line={line} mark={mark} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

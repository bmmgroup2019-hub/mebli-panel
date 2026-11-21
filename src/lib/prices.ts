// Заморожені ціни проекту (рішення користувача 2026-11-21): з авансу проект рахується за цінами того дня.
// Зміна довідника, робіт, ставок зарплати чи націнки після авансу на проект уже не впливає.
import type { PriceSnapshot, Project, SpecRow } from "./mock-projects";
import type { WeekData } from "./week-store";

type PriceData = Pick<WeekData, "materials" | "works" | "stages" | "pricing">;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const matches = (row: SpecRow) => (m: { groupId: string; name: string }) => m.groupId === row.groupId && same(m.name, row.name);

/**
 * Додає до знімка матеріали рядків кошторису, яких у ньому ще немає (і їхні роботи):
 * рядок, доданий після авансу, заморожується за ціною дня, коли його додали.
 */
function withRows(data: PriceData, frozen: PriceSnapshot, rows: SpecRow[]): PriceSnapshot {
  let { materials, works } = frozen;
  for (const row of rows) {
    if (materials.some(matches(row))) continue;
    const material = data.materials.find(matches(row));
    if (!material || materials.some((m) => m.id === material.id)) continue;
    materials = [...materials, material];
    const work = data.works.find((w) => w.id === material.workId);
    if (work && !works.some((w) => w.id === work.id)) works = [...works, work];
  }
  return materials === frozen.materials && works === frozen.works ? frozen : { ...frozen, materials, works };
}

/** Знімок цін для проекту: день першої оплати, ставки всіх етапів, націнка й заноска, ціни матеріалів кошторису. */
function freezePrices(data: PriceData, project: Project): PriceSnapshot {
  const on = [...project.payments].map((p) => p.date).sort()[0] ?? "";
  const snapshot: PriceSnapshot = {
    on,
    materials: [],
    works: [],
    pay: Object.fromEntries(data.stages.map((stage) => [stage.id, stage.pay])),
    pricing: { ...data.pricing },
  };
  return withRows(data, snapshot, project.estimate);
}

/** Знімок проекту після зміни: з першою оплатою з'являється, без оплат (аванс прибрали) — зникає. */
export function keepFrozen(data: PriceData, project: Project): PriceSnapshot | null {
  if (project.payments.length === 0) return null;
  return withRows(data, project.frozen ?? freezePrices(data, project), project.estimate);
}

/**
 * Дані для розрахунку проекту: заморожені ціни замість поточних. Заморожені матеріали стоять першими,
 * тож рядок кошторису знаходить саме їх; решта довідника лишається для вибору нових рядків.
 */
export function pricedData<T extends PriceData>(data: T, project: Project | undefined): T {
  const frozen = project?.frozen;
  if (!frozen) return data;
  const materialIds = new Set(frozen.materials.map((m) => m.id));
  const workIds = new Set(frozen.works.map((w) => w.id));
  return {
    ...data,
    materials: [...frozen.materials, ...data.materials.filter((m) => !materialIds.has(m.id))],
    works: [...frozen.works, ...data.works.filter((w) => !workIds.has(w.id))],
    stages: data.stages.map((stage) => (stage.id in frozen.pay ? { ...stage, pay: frozen.pay[stage.id] } : stage)),
    pricing: frozen.pricing,
  };
}

/** Підпис для картки: з якого дня ціни заморожено. */
export const frozenNote = (frozen: PriceSnapshot) =>
  `Ціни заморожено з авансу${frozen.on ? ` ${frozen.on.split("-").reverse().join(".")}` : ""}: зміни довідника, робіт, ставок і націнки на цей проект не впливають.`;

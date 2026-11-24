// Зафіксовані ціни проекту (рішення користувача 2026-11-24): сума вже складеного кошторису не змінюється,
// навіть якщо авансу ще немає — її могли погодити із замовником. Матеріал фіксується, коли його додали в кошторис;
// ставки зарплати, націнка й заноска — коли в кошторисі з'явився перший запис.
import { todayIso } from "./dates";
import type { PriceSnapshot, Project, SpecRow } from "./mock-projects";
import type { WeekData } from "./week-store";

type PriceData = Pick<WeekData, "materials" | "works" | "stages" | "pricing">;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const matches = (row: Pick<SpecRow, "groupId" | "name">) => (m: { groupId: string; name: string }) => m.groupId === row.groupId && same(m.name, row.name);

/**
 * Додає до знімка матеріали рядків кошторису, яких у ньому ще немає (і їхні роботи), за ціною цього дня.
 * Ціна, якої на момент додавання не було, береться, щойно її вписали: це не зміна, а перша ціна.
 */
function withRows(data: PriceData, frozen: PriceSnapshot, rows: SpecRow[]): PriceSnapshot {
  let { materials, works } = frozen;
  const firstPrice = <T extends { id: string; price: number | null }>(list: T[], now: T[]) =>
    list.some((x) => x.price === null && (now.find((n) => n.id === x.id)?.price ?? null) !== null)
      ? list.map((x) => (x.price === null ? { ...x, price: now.find((n) => n.id === x.id)?.price ?? null } : x))
      : list;
  materials = firstPrice(materials, data.materials);
  works = firstPrice(works, data.works);
  for (const row of rows) {
    if (materials.some(matches(row))) continue;
    const material = data.materials.find(matches(row));
    if (!material) continue;
    materials = [...materials, material];
    const work = data.works.find((w) => w.id === material.workId);
    if (work && !works.some((w) => w.id === work.id)) works = [...works, work];
  }
  return materials === frozen.materials && works === frozen.works ? frozen : { ...frozen, materials, works };
}

/** Знімок цін для проекту: день фіксації, ставки всіх етапів, націнка й заноска, ціни матеріалів кошторису. */
function freezePrices(data: PriceData, project: Project): PriceSnapshot {
  // У прикладах із оплатами — день першої оплати.
  const on = [...project.payments].map((p) => p.date).sort()[0] ?? todayIso();
  const snapshot: PriceSnapshot = {
    on,
    materials: [],
    works: [],
    pay: Object.fromEntries(data.stages.map((stage) => [stage.id, stage.pay])),
    pricing: { ...data.pricing },
  };
  return withRows(data, snapshot, project.estimate);
}

/** Знімок проекту після зміни: з'являється з першим записом кошторису або оплатою, зникає, коли прибрали все. */
export function keepFrozen(data: PriceData, project: Project): PriceSnapshot | null {
  if (project.payments.length === 0 && project.estimate.length === 0 && project.extras.length === 0) return null;
  return withRows(data, project.frozen ?? freezePrices(data, project), project.estimate);
}

/**
 * Дані для розрахунку проекту: зафіксовані ціни замість поточних. Заморожені матеріали стоять першими,
 * тож рядок кошторису знаходить саме їх; решта довідника лишається для вибору нових рядків.
 */
export function pricedData<T extends PriceData>(data: T, project: Project | undefined): T {
  const frozen = project?.frozen;
  if (!frozen) return data;
  const workIds = new Set(frozen.works.map((w) => w.id));
  return {
    ...data,
    materials: [...frozen.materials, ...data.materials.filter((m) => !frozen.materials.some(matches(m)))],
    works: [...frozen.works, ...data.works.filter((w) => !workIds.has(w.id))],
    stages: data.stages.map((stage) => (stage.id in frozen.pay ? { ...stage, pay: frozen.pay[stage.id] } : stage)),
    pricing: frozen.pricing,
  };
}

/** Підпис для картки: з якого дня ціни зафіксовано. */
export const frozenNote = (frozen: PriceSnapshot) =>
  `Ціни зафіксовано${frozen.on ? ` ${frozen.on.split("-").reverse().join(".")}` : ""}: зміни довідника, робіт, ставок і націнки на цей кошторис не впливають.`;

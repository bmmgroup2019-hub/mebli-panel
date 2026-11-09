// Вартість проекту й зарплата. Усе рахується від кошторису менеджера (не від специфікації конструктора):
// якщо менеджер помилився в кошторисі, це видно всім. Рахується з поточних цін і ставок.
import { projectLabel, type Project, type SpecRow } from "./mock-projects";
import { assigneeOf, clientOf, type WeekData, type WorkItem } from "./week-store";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Матеріал довідника для рядка: та сама група й назва. */
export const materialOf = (data: WeekData, row: SpecRow) =>
  data.materials.find((m) => m.groupId === row.groupId && same(m.name, row.name));

export const projectOf = (data: WeekData, order: string): Project | undefined =>
  data.projects.find((project) => projectLabel(project) === order);

/** Вартість матеріалів кошторису: кількість × вартість за одиницю з довідника. */
export function materialsCost(data: WeekData, project: Project | undefined) {
  let total = 0;
  let unpriced = 0; // рядки без кількості або без ціни в довіднику
  for (const row of project?.estimate ?? []) {
    const price = materialOf(data, row)?.price ?? null;
    if (row.quantity === null || price === null) unpriced += 1;
    else total += row.quantity * price;
  }
  return { total, unpriced };
}

export type WorkLine = { name: string; unit: string; quantity: number; price: number; sum: number };

/** Роботи етапу (порізка, поклейка) за кількістю з кошторису. */
function workLines(data: WeekData, project: Project | undefined, stageId: string) {
  const lines = new Map<string, WorkLine>();
  let missing = 0;
  for (const row of project?.estimate ?? []) {
    const workId = materialOf(data, row)?.workId;
    const work = data.works.find((w) => w.id === workId && w.stageId === stageId);
    if (!work) continue;
    if (row.quantity === null || work.price === null) {
      missing += 1;
      continue;
    }
    const line = lines.get(work.id) ?? { name: work.name, unit: work.unit, quantity: 0, price: work.price, sum: 0 };
    line.quantity += row.quantity;
    line.sum += row.quantity * work.price;
    lines.set(work.id, line);
  }
  return { lines: [...lines.values()], missing };
}

/** Заноска: поверх замовника × ціна за поверх, для етапу, який вибрав адміністратор. */
function carryOf(data: WeekData, project: Project | undefined, stageId: string) {
  const { floorRate, floorStageId } = data.pricing;
  const floor = project ? clientOf(data, project)?.floor : null;
  if (stageId !== floorStageId || !floor || !floorRate) return null;
  return { floor, rate: floorRate, sum: floor * floorRate };
}

/** Яка частина зарплати етапу: уся, лише за сам етап або лише за здачу (друга частина менеджера). */
export type AccrualPart = "all" | "stage" | "handover";

export type Accrual = {
  kind: "none" | "percent" | "works";
  part: AccrualPart;
  percent: number; // відсоток за етап (для менеджера — за прийом)
  handover: number; // відсоток за здачу, лише для першого етапу
  base: number; // вартість матеріалів кошторису для відсотка
  lines: WorkLine[]; // для оплати за роботами
  carry: { floor: number; rate: number; sum: number } | null; // заноска на поверх
  total: number;
  missing: number; // рядки, які не вдалося порахувати
  emptyEstimate: boolean; // кошторис ще не складено
};

/** Скільки нараховано (або закладено у вартість) за етап замовлення. */
export function stageAccrual(data: WeekData, project: Project | undefined, stageId: string, part: AccrualPart = "all"): Accrual {
  const pay = data.stages.find((stage) => stage.id === stageId)?.pay ?? { kind: "none" };
  // Заноска й роботи — за сам етап, не за здачу.
  const carry = part === "handover" ? null : carryOf(data, project, stageId);
  const result: Accrual = {
    kind: part === "handover" && pay.kind !== "percent" ? "none" : pay.kind,
    part,
    percent: 0,
    handover: 0,
    base: 0,
    lines: [],
    carry,
    total: carry?.sum ?? 0,
    missing: 0,
    emptyEstimate: !project?.estimate.length,
  };
  if (pay.kind === "percent") {
    const { total, unpriced } = materialsCost(data, project);
    result.percent = part === "handover" ? 0 : pay.percent;
    result.handover = part === "stage" || stageId !== data.stages[0]?.id ? 0 : (pay.handover ?? 0);
    result.base = total;
    result.total += (total * (result.percent + result.handover)) / 100;
    result.missing = unpriced;
  }
  if (pay.kind === "works" && part !== "handover") {
    const { lines, missing } = workLines(data, project, stageId);
    result.lines = lines;
    result.total += lines.reduce((sum, line) => sum + line.sum, 0);
    result.missing = missing;
  }
  return result;
}

/** Нарахування за один виконаний етап замовлення (або за здачу, якщо handover). */
export const accrualOf = (data: WeekData, entry: DoneEntry) =>
  stageAccrual(data, projectOf(data, entry.item.order), entry.item.stage, entry.handover ? "handover" : "stage");

/**
 * Вартість проекту для замовника: матеріали + націнка + зарплата всіх етапів
 * (відсотки, роботи ЧПУ й крайки, заноска) + додаткові витрати.
 */
export function projectCost(data: WeekData, project: Project) {
  const materials = materialsCost(data, project);
  const margin = (materials.total * data.pricing.marginPercent) / 100;
  const wages = data.stages
    .map((stage) => ({ stage, accrual: stageAccrual(data, project, stage.id) }))
    .filter(({ accrual }) => accrual.total > 0 || accrual.kind !== "none");
  const wagesTotal = wages.reduce((sum, { accrual }) => sum + accrual.total, 0);
  const extras = project.extras.reduce((sum, extra) => sum + extra.amount, 0);
  return {
    materials: materials.total,
    unpriced: materials.unpriced,
    margin,
    wages,
    wagesTotal,
    extras,
    total: materials.total + margin + wagesTotal + extras,
  };
}

/**
 * Доходи й витрати проекту: дохід — вартість для клієнта (або розрахункова, поки її не вписали); витрати — матеріали, зарплата всіх етапів,
 * додаткові витрати; чистий прибуток — різниця (по суті націнка). Рентабельність — прибуток від вартості.
 */
export function projectProfit(data: WeekData, project: Project) {
  const cost = projectCost(data, project);
  const expenses = cost.materials + cost.wagesTotal + cost.extras;
  // Дохід — вартість для клієнта (менеджер вписав); поки її немає — розрахункова.
  const income = project.clientPrice ?? cost.total;
  const profit = income - expenses;
  const profitPercent = income > 0 ? (profit / income) * 100 : 0;
  return { cost, income, expenses, profit, profitPercent };
}

/**
 * Запис у «Виконано»: відмічений етап або здача замовлення.
 * Здача — друга частина зарплати менеджера (того, хто відмітив перший етап); день — коли завершили останній етап.
 */
export type DoneEntry = { item: WorkItem; handover: boolean; on: string };

/** Етапи, які людина відмітила за місяць (month — «РРРР-ММ»), і здачі її замовлень, новіші першими. */
export function doneInMonth(data: WeekData, personId: string, month: string): DoneEntry[] {
  const mine = data.items.filter((item) => item.doneOn && assigneeOf(item, data.people) === personId);
  const entries: DoneEntry[] = mine
    .filter((item) => item.doneOn!.startsWith(month))
    .map((item) => ({ item, handover: false, on: item.doneOn! }));
  const first = data.stages[0];
  const last = data.stages.at(-1);
  if (first && last && first.pay.kind === "percent" && first.pay.handover) {
    for (const item of mine.filter((i) => i.stage === first.id)) {
      const finish = data.items.find((i) => i.order === item.order && i.stage === last.id && i.doneOn);
      if (finish?.doneOn?.startsWith(month)) entries.push({ item, handover: true, on: finish.doneOn });
    }
  }
  return entries.sort((a, b) => b.on.localeCompare(a.on));
}

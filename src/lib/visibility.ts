// Які дані сервер віддає людині (рішення користувача 2026-11-28): ціни бачать усі,
// приховано лише дохід і чужі зарплати. Адміністратор отримує все.
// - Дохід (вартість для клієнта, оплати, журнал змін після авансу — там і вартість) — лише адміністратору й менеджерам.
// - Зарплата: кожен, крім адміністратора, отримує лише свої виплати; працівник і закупівельник — ще й ставки
//   лише своїх етапів, тож свою зарплату рахують самі, а чужу порахувати нема з чого.
//   Менеджерові ставки всіх етапів потрібні для розрахункової вартості кошторису.
// - Логіни інших людей — лише адміністратору.
import type { Person, PriceSnapshot, Pricing, Project, StagePay, WeekData } from "./model";

const NO_PAY: StagePay = { kind: "none" };

export function visibleData(data: WeekData, user: Person): WeekData {
  if (user.role === "admin") return data;
  const common: WeekData = {
    ...data,
    payouts: data.payouts.filter((p) => p.personId === user.id),
    people: data.people.map((p) => (p.id === user.id ? p : { ...p, login: "" })),
  };
  if (user.role === "manager") return common;

  const own = new Set(user.stages);
  const pricing = (value: Pricing): Pricing => ({
    marginPercent: 0,
    // Заноска — частина зарплати свого етапу (монтажу).
    floorRate: value.floorStageId && own.has(value.floorStageId) ? value.floorRate : null,
    floorStageId: value.floorStageId,
  });
  const pay = (all: Record<string, StagePay>) =>
    Object.fromEntries(Object.entries(all).map(([stage, value]) => [stage, own.has(stage) ? value : NO_PAY]));
  const frozen = (snapshot: PriceSnapshot | null): PriceSnapshot | null =>
    snapshot && { ...snapshot, pay: pay(snapshot.pay), pricing: pricing(snapshot.pricing) };
  const project = (p: Project): Project => ({ ...p, clientPrice: null, payments: [], changes: [], frozen: frozen(p.frozen) });

  return {
    ...common,
    stages: data.stages.map((stage) => (own.has(stage.id) ? stage : { ...stage, pay: NO_PAY })),
    pricing: pricing(data.pricing),
    projects: data.projects.map(project),
  };
}

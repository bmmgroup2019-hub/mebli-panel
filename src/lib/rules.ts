// Правила й обчислення над даними: статуси етапів, хто що бачить і змінює.
// Чисті функції: однаково працюють у браузері й (згодом) на сервері.
import { type IssueType, type Person, type Project, projectLabel, type StageId, type StageStatus, type WeekData, type WorkItem } from "./model";

/**
 * Хто бачить і змінює специфікацію проекту.
 * Змінюють адміністратор і той, хто її створює: людина етапу «Специфікація», призначена на цей проект
 * (або будь-хто з цього етапу, поки нікого не призначено). Менеджер бачить її лише після того,
 * як етап «Специфікація» завершено, і без права змін. Інші люди етапу — лише перегляд.
 */
export function specAccess(data: WeekData, user: Person | null, project: Project) {
  if (!user) return { sees: false, canEdit: false };
  if (user.role === "admin") return { sees: true, canEdit: true };
  const { creator, mine, done } = specRole(data, user, project);
  // Після передачі робочого проекту далі конструктор специфікацію лише переглядає.
  if (creator) return { sees: true, canEdit: !done };
  if (mine) return { sees: true, canEdit: false };
  return { sees: done, canEdit: false };
}

/**
 * Місце людини в етапі «Специфікація» проекту: mine — людина цього етапу; creator — призначена на проект
 * (або ще нікого не призначено); done — етап завершено, робочий проект передано далі.
 */
export function specRole(data: WeekData, user: Person, project: Project) {
  const order = projectLabel(project);
  const specStages = data.stages.filter((stage) => stage.createsSpec);
  const mine = specStages.filter((stage) => user.stages.includes(stage.id));
  const creator = mine.some((stage) => {
    const items = data.items.filter((item) => item.order === order && item.stage === stage.id);
    if (items.length === 0) return true;
    return items.some((item) => {
      const assignee = assigneeOf(item, data.people);
      return assignee === user.id || assignee === null;
    });
  });
  const done = specStages.length > 0 && specStages.every((stage) => stageStatus(data.items, order, stage.id) === "done");
  return { mine: mine.length > 0, creator, done };
}

/**
 * Права на проект. Змінює адміністратор (будь-який проект) і менеджер, який його створив, —
 * поки прийом не завершено (проект не пішов на наступний етап).
 * Оплати: власник — аванс до передачі й доплата після завершення останнього етапу.
 */
export function projectAccess(data: WeekData, user: Person | null, project: Project) {
  if (!user) return { canEdit: false, canPay: false, canPurchase: false, own: false };
  // Відмова: проект лише для перегляду, поки його не повернули в роботу.
  if (project.refusal) return { canEdit: false, canPay: false, canPurchase: false, own: user.role === "manager" && project.managerId === user.id };
  if (user.role === "admin") return { canEdit: true, canPay: true, canPurchase: true, own: project.managerId === user.id };
  // Закупівельник відмічає закупки в усіх проектах, решту не змінює.
  if (user.role === "buyer") return { canEdit: false, canPay: false, canPurchase: true, own: false };
  const own =user.role === "manager" && project.managerId === user.id;
  const order = projectLabel(project);
  const first = data.stages[0];
  const intakeDone = first ? stageStatus(data.items, order, first.id) === "done" : false;
  // Закупки за специфікацією веде менеджер проекту на будь-якому етапі.
  return { canEdit: own && !intakeDone, canPay: own && (!intakeDone || isFinished(data, order)), canPurchase: own, own };
}

/**
 * Чи належить людині зарплата за етап цього проекту.
 * Перший етап (прийом) — менеджеру проекту. Інші — тому, хто виконує запис етапу на «Тижні»;
 * поки запису немає — людині етапу, якщо вона на ньому одна.
 */
export function ownsStagePay(data: WeekData, user: Person | null, project: Project, stageId: StageId) {
  if (!user || !user.stages.includes(stageId)) return false;
  if (stageId === data.stages[0]?.id) return project.managerId === user.id;
  const order = projectLabel(project);
  const items = data.items.filter((item) => item.order === order && item.stage === stageId);
  if (items.length > 0) return items.some((item) => assigneeOf(item, data.people) === user.id);
  return data.people.filter((person) => person.stages.includes(stageId)).length === 1;
}

/** Записи, які показуємо в цьому тижні. */
export const itemsOfWeek = (items: WorkItem[], week: string) =>
  items.filter((item) => item.week <= week && (item.doneWeek === null || item.doneWeek >= week));

/** Хто виконує запис. Якщо на етапі одна людина, це вона, навіть без призначення. */
export function assigneeOf(item: WorkItem, people: Person[]) {
  const staff = people.filter((person) => person.stages.includes(item.stage));
  if (staff.some((person) => person.id === item.assigneeId)) return item.assigneeId;
  return staff.length === 1 ? staff[0].id : null;
}

export function stageStatus(items: WorkItem[], order: string, stage: StageId): StageStatus {
  const own = items.filter((item) => item.order === order && item.stage === stage);
  if (own.length === 0) return "todo";
  return own.some((item) => item.doneWeek === null) ? "wip" : "done";
}

/** Замовник проекту. */
export const clientOf = (data: WeekData, project: Project) => data.clients.find((client) => client.id === project.clientId);

/** Номер наступного замовлення: найбільший числовий номер + 1. */
export const nextProjectNumber = (projects: Project[]) =>
  String(projects.reduce((max, p) => Math.max(max, Number.parseInt(p.number, 10) || 0), 0) + 1);

/**
 * Кошторис (рядки, додаткові витрати) і поверх для заноски закрито для всіх, щойно внесено аванс (рішення користувача 2026-11-24):
 * від нього рахуються вартість і зарплата. Прибрали всі оплати — знову можна змінювати.
 */
export const estimateLocked = (project: Project) => project.payments.length > 0;

/** Замовлення завершене, коли зроблено останній етап. */
export function isFinished(data: WeekData, order: string) {
  const last = data.stages.at(-1);
  return last ? stageStatus(data.items, order, last.id) === "done" : false;
}

/**
 * Специфікація готова до закупки: зроблено всі етапи з позначкою «Специфікація» (у прикладі «Робочий проект»),
 * а виріб ще в роботі.
 */
export function specReady(data: WeekData, project: Project) {
  const label = projectLabel(project);
  const specStages = data.stages.filter((stage) => stage.createsSpec);
  return (
    specStages.length > 0 &&
    specStages.every((stage) => stageStatus(data.items, label, stage.id) === "done") &&
    !isFinished(data, label)
  );
}

/** Перший етап — прийом і розрахунок: з нього менеджер починає замовлення. */
export const isIntake = (data: Pick<WeekData, "stages">, stage: StageId) => stage === data.stages[0]?.id;

/**
 * Чого бракує, щоб передати замовлення далі.
 * Без виконавця не можна: зарплата нараховується саме йому, інакше вона не дісталася б нікому.
 * Перший етап (прийом) — ще й лише після авансу.
 */
export function blockedReason(data: WeekData, item: WorkItem) {
  if (!assigneeOf(item, data.people)) return "Спершу виберіть, хто бере";
  if (item.stage !== data.stages[0]?.id) return null;
  const project = data.projects.find((p) => projectLabel(p) === item.order);
  return project && project.payments.length === 0 ? "Спершу внесіть аванс" : null;
}

/** Скасувати галочку можна, поки виконавець наступного етапу не взяв замовлення в роботу (і, звісно, не зробив). */
export function canReopen(items: WorkItem[], item: WorkItem) {
  const next = items.find((i) => i.id === item.nextId);
  return !next?.doneWeek && !next?.startedOn;
}

export const issueTypeName = (types: IssueType[], id: string | null) => types.find((t) => t.id === id)?.name ?? "";

/**
 * Позначити відмову клієнта може менеджер проекту й адміністратор — лише до авансу.
 * Повернути в роботу — ті самі люди.
 */
export function canRefuse(user: Person | null, project: Project) {
  if (!user || project.payments.length > 0) return false;
  return user.role === "admin" || (user.role === "manager" && project.managerId === user.id);
}

export const refusalReasonName = (data: WeekData, id: string | null) =>
  data.refusalReasons.find((r) => r.id === id)?.name ?? "Без причини";

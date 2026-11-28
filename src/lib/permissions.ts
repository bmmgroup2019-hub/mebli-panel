// Хто може виконати кожну дію (actions.ts). Перевіряє сервер перед виконанням: сторінка лише ховає кнопки,
// а тут — справжня заборона, навіть якщо запит підробити. Дія без правила тут не виконується взагалі.
// Правила — ті самі, що на сторінках (rules.ts): хто що бачить і змінює.
import { type Person, type Project, projectLabel, type WeekData } from "./model";
import { assigneeOf, canRefuse, isFinished, isIntake, projectAccess, specAccess } from "./rules";

/* eslint-disable @typescript-eslint/no-explicit-any -- аргументи приходять із запиту й перевіряються тут */
type Guard = (data: WeekData, user: Person, ...args: any[]) => boolean;

const admin: Guard = (_data, user) => user.role === "admin";
const office: Guard = (_data, user) => user.role === "admin" || user.role === "manager";
const materials: Guard = (_data, user) => user.role === "admin" || user.role === "manager" || user.role === "buyer";

const isText = (value: unknown) => typeof value === "string";
const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const projectOf = (data: WeekData, id: unknown) => data.projects.find((p) => p.id === id);
const itemOf = (data: WeekData, id: unknown) => data.items.find((i) => i.id === id);
const access = (data: WeekData, user: Person, id: unknown) => {
  const project = projectOf(data, id);
  return project ? projectAccess(data, user, project) : null;
};

/** Поля проекту, які сторінка змінює через updateProject. Решту (оплати, рядки, відмову) — лише окремими діями. */
const PROJECT_FIELDS = new Set(["product", "acceptedOn", "dueOn", "clientId", "clientPrice", "floor", "details"]);

/** Рядки кошторису змінює той, хто змінює проект, рядки специфікації — той, хто її створює. */
function canEditRows(data: WeekData, user: Person, projectId: unknown, list: unknown) {
  const project = projectOf(data, projectId);
  if (!project || (list !== undefined && list !== "spec" && list !== "estimate")) return false;
  return list === "estimate" ? projectAccess(data, user, project).canEdit : specAccess(data, user, project).canEdit;
}

/** Відмітити етап зроблено або зняти відмітку: виконавець запису або адміністратор. */
const marksItem: Guard = (data, user, id) => {
  const item = itemOf(data, id);
  return Boolean(item) && (user.role === "admin" || assigneeOf(item!, data.people) === user.id);
};

/**
 * Прибрати оплату: адміністратор — будь-яку; менеджер проекту — лише свого періоду:
 * до передачі аванс, після завершення виробництва лише доплати.
 */
function canRemovePayment(data: WeekData, user: Person, project: Project, paymentId: unknown) {
  const payment = project.payments.find((p) => p.id === paymentId);
  if (!payment || !projectAccess(data, user, project).canPay) return false;
  if (user.role === "admin") return true;
  return isFinished(data, projectLabel(project)) ? Boolean(payment.final) : !payment.final;
}

export const GUARDS: Record<string, Guard> = {
  // Довідники й налаштування веде адміністратор.
  updateCompany: admin,
  updatePricing: admin,
  addSpecGroup: admin,
  updateSpecGroup: admin,
  removeSpecGroup: admin,
  addUnit: admin,
  removeUnit: admin,
  addMaker: admin,
  renameMaker: admin,
  removeMaker: admin,
  addWork: admin,
  updateWork: admin,
  removeWork: admin,
  addStage: admin,
  updateStage: admin,
  moveStage: admin,
  removeStage: admin,
  addPerson: admin,
  updatePerson: admin,
  removePerson: admin,
  addIssueType: admin,
  renameIssueType: admin,
  removeIssueType: admin,
  addRefusalReason: admin,
  renameRefusalReason: admin,
  removeRefusalReason: admin,
  addPayout: admin,
  removePayout: admin,
  resetWeekData: admin,

  // Довідник матеріалів: адміністратор, менеджер, закупівельник.
  addMaterial: materials,
  updateMaterial: materials,
  removeMaterial: materials,

  // Замовники й нові проекти: адміністратор і менеджери.
  addClient: office,
  updateClient: office,
  removeClient: office,
  addProject: office,

  updateProject: (data, user, id, fields) =>
    Boolean(fields) && typeof fields === "object" && Object.keys(fields).every((key) => PROJECT_FIELDS.has(key)) &&
    Boolean(access(data, user, id)?.canEdit),
  addPayment: (data, user, id, date, amount) => isDate(date) && typeof amount === "number" && amount > 0 && Boolean(access(data, user, id)?.canPay),
  removePayment: (data, user, id, paymentId) => {
    const project = projectOf(data, id);
    return Boolean(project) && canRemovePayment(data, user, project!, paymentId);
  },
  addSpecRow: (data, user, id, _fields, list) => canEditRows(data, user, id, list),
  updateSpecRow: (data, user, id, _rowId, _fields, list) => canEditRows(data, user, id, list),
  removeSpecRow: (data, user, id, _rowId, list) => canEditRows(data, user, id, list),
  addExtra: (data, user, id) => Boolean(access(data, user, id)?.canEdit),
  removeExtra: (data, user, id) => Boolean(access(data, user, id)?.canEdit),
  setPurchase: (data, user, id) => Boolean(access(data, user, id)?.canPurchase),
  setPurchaseMany: (data, user, rows) =>
    Array.isArray(rows) && rows.every((row) => Boolean(access(data, user, row?.projectId)?.canPurchase)),
  refuseProject: (data, user, id) => {
    const project = projectOf(data, id);
    return Boolean(project) && canRefuse(user, project!);
  },
  returnProject: (data, user, id) => {
    const project = projectOf(data, id);
    return Boolean(project) && canRefuse(user, project!);
  },

  // «Тиждень»: план складає адміністратор; призначає ще й менеджер — у незроблених етапах своїх проектів.
  addItem: admin,
  removeItem: admin,
  assignItem: (data, user, id, assigneeId) => {
    const item = itemOf(data, id);
    if (!item) return false;
    if (assigneeId !== null && !data.people.some((p) => p.id === assigneeId && p.stages.includes(item.stage))) return false;
    if (user.role === "admin") return true;
    const project = data.projects.find((p) => projectLabel(p) === item.order);
    return user.role === "manager" && project?.managerId === user.id && item.doneWeek === null;
  },
  // Узяти в роботу — лише виконавець (адміністратор теж); прийом не беруть.
  startItem: (data, user, id) => {
    const item = itemOf(data, id);
    return Boolean(item) && !isIntake(data, item!.stage) && (user.role === "admin" || assigneeOf(item!, data.people) === user.id);
  },
  completeItem: (data, user, id, week) => isDate(week) && marksItem(data, user, id),
  reopenItem: marksItem,

  // Проблеми пише будь-хто від свого імені; закривають адміністратор і менеджер.
  addIssue: (_data, user, order, _typeId, text, author) => isText(order) && isText(text) && author === user.name,
  toggleIssue: office,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Чи можна людині виконати дію з такими аргументами. Невідома дія — ні. */
export function allowed(data: WeekData, user: Person | null, name: string, args: unknown[]) {
  const guard = Object.hasOwn(GUARDS, name) ? GUARDS[name] : null;
  return Boolean(user && guard && guard(data, user, ...args));
}

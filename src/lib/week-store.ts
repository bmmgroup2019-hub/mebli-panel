// Сховище прототипу: localStorage цього браузера. Із базою тут зміниться лише цей файл.
import { useSyncExternalStore } from "react";
import { addDays, mondayOf, todayIso } from "./dates";
import {
  type PurchaseStatus,
  MOCK_CLIENTS,
  MOCK_MAKERS,
  MOCK_MATERIALS,
  MOCK_SPEC_GROUPS,
  MOCK_UNITS,
  MOCK_WORKS,
  MOCK_STAGES,
  mockProjects,
  projectLabel,
  type ChangeNote,
  DETAIL_FIELDS,
  EMPTY_DETAILS,
  type Client,
  type Material,
  type Project,
  type SpecGroup,
  type SpecRow,
  type Extra,
  type Stage,
  type StageId,
  type StageStatus,
  type Work,
} from "./mock-projects";

/** Замовлення на етапі. Незроблене видно в кожному наступному тижні, поки його не відмітять. */
export type WorkItem = {
  id: string;
  order: string;
  stage: StageId;
  week: string; // понеділок тижня, з якого замовлення на етапі
  doneWeek: string | null; // понеділок тижня, коли етап зроблено
  doneOn: string | null; // день, коли відмітили: від нього рахується місяць зарплати
  nextId: string | null; // запис наступного етапу, створений галочкою
  assigneeId: string | null; // хто взяв замовлення
  startedOn: string | null; // день, коли виконавець узяв замовлення в роботу (натиснув «Почати»)
  adminMarkedOn: string | null; // день, коли адміністратор відмітив або скасував чужий етап
};

export type Person = {
  id: string;
  name: string;
  login: string;
  password: string; // лише для прототипу: із базою паролі тут не зберігатимуться
  role: "admin" | "manager" | "worker";
  stages: StageId[]; // одна людина може працювати на кількох етапах
};

export type Issue = {
  id: string;
  order: string; // порожньо — загальне питання
  typeId: string | null;
  text: string;
  author: string;
  createdOn: string;
  resolved: boolean;
};

export type IssueType = { id: string; name: string };

/**
 * Налаштування вартості проекту, веде адміністратор.
 * marginPercent — націнка виробництва від вартості матеріалів; floorRate — заноска, грн за поверх;
 * floorStageId — етап, якому нараховується заноска (монтаж).
 */
export type Pricing = { marginPercent: number; floorRate: number | null; floorStageId: StageId | null };

/** Реквізити фірми для шапки бланків. Веде адміністратор. */
/** logo — зображення логотипу (data URL, зменшене до 400 px), порожньо — без логотипу. */
export type Company = { name: string; phone: string; address: string; extra: string; installTerms: string; logo: string };

export type WeekData = {
  company: Company;
  stages: Stage[];
  issueTypes: IssueType[];
  specGroups: SpecGroup[];
  units: string[];
  makers: string[]; // виробники матеріалів, веде адміністратор
  materials: Material[];
  works: Work[]; // роботи з ціною для зарплати за кількістю
  pricing: Pricing;
  clients: Client[]; // замовники, проекти посилаються на них
  projects: Project[];
  items: WorkItem[];
  issues: Issue[];
  people: Person[];
  sessionId: string | null;
};

const KEY = "panel-week-v43";
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function seed(): WeekData {
  const today = todayIso();
  const week = mondayOf(today);
  const lastWeek = addDays(week, -7);
  const owner: Person = { id: newId(), name: "Власник", login: "admin", password: "admin", role: "admin", stages: [] };
  const manager: Person = { id: newId(), name: "Менеджер", login: "manager", password: "2222", role: "manager", stages: ["intake"] };
  const manager2: Person = { id: newId(), name: "Менеджер 2", login: "manager2", password: "6666", role: "manager", stages: ["intake"] };
  const constructor: Person = { id: newId(), name: "Конструктор", login: "konstruktor", password: "3333", role: "worker", stages: ["project"] };
  const cncOperator: Person = { id: newId(), name: "Оператор ЧПУ", login: "chpu", password: "4444", role: "worker", stages: ["cnc"] };
  const edger: Person = { id: newId(), name: "Крайкообліцювальник", login: "kraika", password: "5555", role: "worker", stages: ["edge"] };
  const workers: Person[] = [1, 2, 3].map((n) => ({
    id: newId(),
    name: `Складальник ${n}`,
    login: `zbirka${n}`,
    password: "1111",
    role: "worker",
    stages: ["assembly"],
  }));
  // Монтажники — окремі люди, не складальники.
  const installers: Person[] = [1, 2].map((n) => ({
    id: newId(),
    name: `Монтажник ${n}`,
    login: `montazh${n}`,
    password: "7777",
    role: "worker",
    stages: ["install"],
  }));
  const item = (
    order: string,
    stage: StageId,
    start: string,
    doneWeek: string | null = null,
    assigneeId: string | null = null,
  ): WorkItem => ({
    id: newId(),
    order,
    stage,
    week: start,
    doneWeek,
    // У прикладі етап відмічено в четвер свого тижня, але не пізніше сьогодні.
    doneOn: doneWeek ? (addDays(doneWeek, 3) < today ? addDays(doneWeek, 3) : today) : null,
    nextId: null,
    assigneeId,
    startedOn: null,
    adminMarkedOn: null,
  });
  const issueTypes: IssueType[] = ["Немає матеріалів", "Брак, перезамовити", "Інше"].map((name) => ({ id: newId(), name }));
  const [noMaterials, defect, other] = issueTypes;
  const issue = (order: string, type: IssueType | null, text: string, author = owner.name): Issue => ({
    id: newId(), order, typeId: type?.id ?? null, text, author, createdOn: today, resolved: false,
  });
  // У прикладі шафа й тумба — проекти другого менеджера, решта — першого.
  const projects = mockProjects(week).map((project) => ({
    ...project,
    managerId: ["shafa", "tumba"].includes(project.id) ? manager2.id : manager.id,
  }));
  const [kitchen, wardrobe, hallway, dressing, stand, chest] = [
    "kukhnya", "shafa", "peredpokiy", "garderobna", "tumba", "komod",
  ].map((id) => projectLabel(projects.find((project) => project.id === id)!));
  return {
    sessionId: null,
    // Вигадані реквізити: справжні вписує адміністратор у розділі «Фірма».
    company: { name: "Меблева майстерня (приклад)", phone: "000 000 00 00", address: "м. Київ, вул. Прикладна, 1", extra: "", installTerms: "", logo: "" },
    stages: MOCK_STAGES,
    issueTypes,
    specGroups: MOCK_SPEC_GROUPS,
    units: MOCK_UNITS,
    makers: MOCK_MAKERS,
    materials: MOCK_MATERIALS,
    works: MOCK_WORKS,
    pricing: { marginPercent: 60, floorRate: 150, floorStageId: "install" },
    clients: MOCK_CLIENTS,
    projects,
    people: [owner, manager, manager2, constructor, cncOperator, edger, ...workers, ...installers],
    items: linkNext([
      // Прийом і розрахунок: тиждень прийому замовлення.
      ...projects.map((project) => {
        const accepted = mondayOf(project.acceptedOn);
        // Шафа-купе ще на прийомі: аванс є, на наступний етап не передано.
        return item(projectLabel(project), "intake", accepted, project.id === "kupe" ? null : accepted, project.managerId);
      }),
      item(kitchen, "project", addDays(week, -28), lastWeek),
      item(kitchen, "cnc", lastWeek, week),
      item(kitchen, "edge", week),
      item(wardrobe, "project", addDays(week, -14), lastWeek),
      item(wardrobe, "cnc", lastWeek),
      item(stand, "project", week),
      item(dressing, "project", addDays(week, -28), addDays(week, -21)),
      item(dressing, "cnc", addDays(week, -21), addDays(week, -14)),
      item(dressing, "edge", addDays(week, -14), lastWeek),
      // Зборку гардеробної вже почали: крайка свою галочку зняти не може.
      { ...item(dressing, "assembly", lastWeek, null, workers[0].id), startedOn: addDays(lastWeek, 4) },
      item(chest, "project", addDays(week, -28), addDays(week, -21)),
      item(chest, "cnc", addDays(week, -21), addDays(week, -14)),
      item(chest, "edge", addDays(week, -14), lastWeek),
      item(chest, "assembly", week),
      item(hallway, "project", addDays(week, -28), addDays(week, -21)),
      item(hallway, "cnc", addDays(week, -21), addDays(week, -14)),
      item(hallway, "edge", addDays(week, -14), addDays(week, -14)),
      item(hallway, "assembly", addDays(week, -14), week, workers[1].id),
      item(hallway, "install", week, null, installers[0].id),
    ]),
    issues: [
      issue(wardrobe, noMaterials, "Не привезли фасади, зупиниться зборка", workers[2].name),
      issue(wardrobe, other, "Не підтверджено колір ручок"),
      issue(kitchen, other, "Замовник досі не підтвердив модель духовки"),
      issue(dressing, defect, "Зіпсували фасад, треба перезамовити", workers[0].name),
      issue("", null, "Хто виходить на монтаж у суботу?"),
    ],
  };
}

/** Приклад: зроблений етап посилається на запис наступного етапу того ж замовлення, як після галочки. */
function linkNext(items: WorkItem[]) {
  const order = MOCK_STAGES.map((stage) => stage.id);
  return items.map((item) => {
    if (!item.doneWeek) return item;
    const nextStage = order[order.indexOf(item.stage) + 1];
    const next = items.find((i) => i.order === item.order && i.stage === nextStage);
    return next ? { ...item, nextId: next.id } : item;
  });
}

let data: WeekData | null = null;
const listeners = new Set<() => void>();

function read(): WeekData {
  if (data) return data;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) data = JSON.parse(saved) as WeekData;
  } catch {
    // Пошкоджені або недоступні дані: починаємо з прикладів.
  }
  data ??= seed();
  return data;
}

function write(next: WeekData) {
  data = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Без сховища зміни просто живуть до перезавантаження сторінки.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** null на сервері: дані є лише в браузері. */
export const useWeekData = () => useSyncExternalStore(subscribe, read, () => null);

export function useCurrentUser() {
  const data = useWeekData();
  return data?.people.find((person) => person.id === data.sessionId) ?? null;
}

export const useIsAdmin = () => useCurrentUser()?.role === "admin";

/** Закривати проблеми й призначати людей на замовлення. */
export function useCanManage() {
  const role = useCurrentUser()?.role;
  return role === "admin" || role === "manager";
}

/**
 * «Головну», «Проекти» й «Матеріали» бачать адміністратор, менеджер і люди етапів зі специфікацією (конструктор).
 * Складальникам та іншим працівникам лишаються «Тиждень» і «Проблеми».
 */
export function useSeesOffice() {
  const user = useCurrentUser();
  const specStages = useWeekData()?.stages.filter((stage) => stage.createsSpec).map((stage) => stage.id) ?? [];
  return user?.role === "admin" || user?.role === "manager" || Boolean(user?.stages.some((id) => specStages.includes(id)));
}

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
  if (user.role === "admin") return { canEdit: true, canPay: true, canPurchase: true, own: project.managerId === user.id };
  const own = user.role === "manager" && project.managerId === user.id;
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

export function useProjectAccess(project: Project) {
  const data = useWeekData();
  const user = useCurrentUser();
  return data ? projectAccess(data, user, project) : { canEdit: false, canPay: false, canPurchase: false, own: false };
}

export function useSpecAccess(project: Project) {
  const data = useWeekData();
  const user = useCurrentUser();
  return data ? specAccess(data, user, project) : { sees: false, canEdit: false };
}

/** true, якщо логін і пароль правильні. */
export function signIn(login: string, password: string) {
  const current = read();
  const person = current.people.find((p) => p.login === login && p.password === password);
  if (person) write({ ...current, sessionId: person.id });
  return Boolean(person);
}

export function signOut() {
  write({ ...read(), sessionId: null });
}

const loginTaken = (login: string, exceptId?: string) =>
  read().people.some((p) => p.login === login && p.id !== exceptId);

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

const numberTaken = (projects: Project[], number: string, exceptId?: string) =>
  projects.some((p) => p.number === number && p.id !== exceptId);

/** Замовник проекту. */
export const clientOf = (data: WeekData, project: Project) => data.clients.find((client) => client.id === project.clientId);

/** id нового замовника. Однакові імена можливі: замовників розрізняє телефон. */
export function addClient(fields: Omit<Client, "id">) {
  const current = read();
  const client = { ...fields, id: newId() };
  write({ ...current, clients: [...current.clients, client] });
  return client.id;
}

/** Нове ім'я переходить у підписи всіх проектів замовника, а з ними — у план і проблеми. */
export function updateClient(id: string, fields: Partial<Omit<Client, "id">>) {
  const current = read();
  write({ ...current, clients: current.clients.map((c) => (c.id === id ? { ...c, ...fields } : c)) });
  if (fields.name) {
    for (const project of read().projects.filter((p) => p.clientId === id)) updateProject(project.id, { client: fields.name });
  }
}

/** false, якщо в замовника є проекти. */
export function removeClient(id: string) {
  const current = read();
  if (current.projects.some((p) => p.clientId === id)) return false;
  write({ ...current, clients: current.clients.filter((c) => c.id !== id) });
  return true;
}

/** Номер наступного замовлення: найбільший числовий номер + 1. */
export const nextProjectNumber = (projects: Project[]) =>
  String(projects.reduce((max, p) => Math.max(max, Number.parseInt(p.number, 10) || 0), 0) + 1);

/** id нового проекту або null, якщо замовника немає. Номер проставляється автоматично. */
export function addProject(
  fields: Omit<Project, "id" | "number" | "client" | "payments" | "spec" | "estimate" | "extras" | "clientPrice" | "managerId" | "adminEditedOn" | "changes" | "details">,
) {
  const current = read();
  const client = current.clients.find((c) => c.id === fields.clientId);
  if (!client) return null;
  // Проект належить тому, хто його створив.
  const project: Project = {
    ...fields,
    number: nextProjectNumber(current.projects),
    client: client.name,
    id: newId(),
    payments: [],
    spec: [],
    estimate: [],
    extras: [],
    clientPrice: null,
    managerId: current.sessionId ?? "",
    adminEditedOn: null,
    changes: [],
    details: { ...EMPTY_DETAILS },
  };
  write({ ...current, projects: [...current.projects, project] });
  // Новий проект одразу стає на прийом у поточному тижні.
  const first = current.stages[0];
  if (first) addItem(projectLabel(project), first.id, mondayOf(todayIso()));
  return project.id;
}

type ChangeDraft = Pick<ChangeNote, "key" | "label" | "from" | "to">;

const changeMoney = (value: number | null) => (value === null ? "не вписано" : `${Math.round(value).toLocaleString("uk-UA")} грн`);
const changeDate = (iso: string) => (iso ? iso.split("-").reverse().join(".") : "не вказано");
const changeRow = (row: SpecRow) => `${row.quantity === null ? "без кількості" : row.quantity.toLocaleString("uk-UA")} ${row.unit}`;

/** Що змінилось у проекті для замовника: виріб, дати, замовник, вартість, рядки кошторису, додаткові витрати. */
function changesBetween(data: WeekData, before: Project, after: Project): ChangeDraft[] {
  const list: ChangeDraft[] = [];
  const field = (key: string, label: string, from: string, to: string) => {
    if (from !== to) list.push({ key, label, from, to });
  };
  field("product", "Виріб", before.product, after.product);
  field("acceptedOn", "Дата прийому", changeDate(before.acceptedOn), changeDate(after.acceptedOn));
  field("dueOn", "Дата здачі", changeDate(before.dueOn), changeDate(after.dueOn));
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? "—";
  field("clientId", "Замовник", clientName(before.clientId), clientName(after.clientId));
  field("clientPrice", "Вартість для клієнта", changeMoney(before.clientPrice), changeMoney(after.clientPrice));
  for (const { key, label } of DETAIL_FIELDS) field(`details:${key}`, label, before.details[key] || "—", after.details[key] || "—");
  // Рядки кошторису: додано, прибрано, інша кількість або назва.
  for (const row of after.estimate) {
    const old = before.estimate.find((r) => r.id === row.id);
    const from = !old ? "—" : old.name === row.name ? changeRow(old) : `${old.name}, ${changeRow(old)}`;
    const to = !old || old.name === row.name ? changeRow(row) : `${row.name}, ${changeRow(row)}`;
    field(`row:${row.id}`, `Кошторис: ${row.name}`, from, to);
  }
  for (const row of before.estimate.filter((r) => !after.estimate.some((a) => a.id === r.id))) {
    field(`row:${row.id}`, `Кошторис: ${row.name}`, changeRow(row), "прибрано");
  }
  for (const extra of after.extras.filter((e) => !before.extras.some((b) => b.id === e.id))) {
    field(`extra:${extra.id}`, `Додаткові витрати: ${extra.name}`, "—", changeMoney(extra.amount));
  }
  for (const extra of before.extras.filter((e) => !after.extras.some((a) => a.id === e.id))) {
    field(`extra:${extra.id}`, `Додаткові витрати: ${extra.name}`, changeMoney(extra.amount), "прибрано");
  }
  return list;
}

/**
 * Додає зміни до журналу. Та сама річ, змінена тією ж людиною того ж дня, — один запис «було → стало»;
 * якщо повернули як було — запис зникає. Доданий і того ж дня прибраний рядок теж зникає.
 */
function mergeChanges(notes: ChangeNote[], drafts: ChangeDraft[], author: string): ChangeNote[] {
  const date = todayIso();
  let next = [...notes];
  for (const draft of drafts) {
    const same = next.find((note) => note.key === draft.key && note.date === date && note.author === author);
    if (!same) {
      next.push({ ...draft, id: newId(), date, author });
      continue;
    }
    const merged = { ...same, label: draft.label, to: draft.to };
    const undone = merged.from === merged.to || (merged.from === "—" && merged.to === "прибрано");
    next = undone ? next.filter((note) => note !== same) : next.map((note) => (note === same ? merged : note));
  }
  return next;
}

/** Нова назва проекту переходить і в план, і в проблеми. false, якщо такий номер уже є. */
export function updateProject(id: string, fields: Partial<Omit<Project, "id">>) {
  const current = read();
  const project = current.projects.find((p) => p.id === id);
  if (!project) return false;
  const next = { ...project, ...fields };
  // Адміністратор змінив чужий проект — це позначається.
  const user = current.people.find((person) => person.id === current.sessionId);
  if (user?.role === "admin" && project.managerId !== user.id) next.adminEditedOn = todayIso();
  // Інший замовник — інше ім'я в підписі.
  if (fields.clientId) next.client = current.clients.find((c) => c.id === fields.clientId)?.name ?? next.client;
  if (numberTaken(current.projects, next.number, id)) return false;
  // Після авансу кожну зміну позначаємо: її треба погодити із замовником.
  if (project.payments.length > 0) next.changes = mergeChanges(project.changes, changesBetween(current, project, next), user?.name ?? "");
  const oldLabel = projectLabel(project);
  const newLabel = projectLabel(next);
  const rename = <T extends { order: string }>(list: T[]) =>
    list.map((entry) => (entry.order === oldLabel ? { ...entry, order: newLabel } : entry));
  write({
    ...current,
    projects: current.projects.map((p) => (p.id === id ? next : p)),
    items: rename(current.items),
    issues: rename(current.issues),
  });
  return true;
}

export function addPayment(projectId: string, date: string, amount: number) {
  const current = read();
  const project = current.projects.find((p) => p.id === projectId);
  if (!project) return;
  const final = isFinished(current, projectLabel(project));
  updateProject(projectId, { payments: [...project.payments, { id: newId(), date, amount, ...(final && { final }) }] });
}

export function removePayment(projectId: string, paymentId: string) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project) updateProject(projectId, { payments: project.payments.filter((p) => p.id !== paymentId) });
}

/** Таблиця рядків проекту: специфікація конструктора або кошторис менеджера. Вони не пов'язані. */
export type RowList = "spec" | "estimate";

export function addSpecRow(projectId: string, fields: Omit<SpecRow, "id">, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project) updateProject(projectId, { [list]: [...project[list], { ...fields, id: newId() }] });
}

export function updateSpecRow(projectId: string, rowId: string, fields: Partial<Omit<SpecRow, "id">>, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project) {
    updateProject(projectId, { [list]: project[list].map((row) => (row.id === rowId ? { ...row, ...fields } : row)) });
  }
}

/**
 * Закупка рядка специфікації. Окремо від змін проекту: адміністратор веде закупки сам,
 * тому це не позначається як «Змінено адміністратором».
 */
export function setPurchase(projectId: string, rowId: string, purchase: PurchaseStatus | null) {
  const current = read();
  write({
    ...current,
    projects: current.projects.map((p) =>
      p.id !== projectId
        ? p
        : { ...p, spec: p.spec.map((row) => (row.id === rowId ? { ...row, purchase: purchase ?? undefined } : row)) },
    ),
  });
}

export function removeSpecRow(projectId: string, rowId: string, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project) updateProject(projectId, { [list]: project[list].filter((row) => row.id !== rowId) });
}

export function addExtra(projectId: string, fields: Omit<Extra, "id">) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project) updateProject(projectId, { extras: [...project.extras, { ...fields, id: newId() }] });
}

export function removeExtra(projectId: string, extraId: string) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project) updateProject(projectId, { extras: project.extras.filter((extra) => extra.id !== extraId) });
}

export function updateCompany(fields: Partial<Company>) {
  const current = read();
  write({ ...current, company: { ...current.company, ...fields } });
}

export function updatePricing(fields: Partial<Pricing>) {
  const current = read();
  write({ ...current, pricing: { ...current.pricing, ...fields } });
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** false, якщо така група вже є. */
export function addSpecGroup(name: string) {
  const current = read();
  if (current.specGroups.some((g) => sameName(g.name, name))) return false;
  write({ ...current, specGroups: [...current.specGroups, { id: newId(), name }] });
  return true;
}

/** false, якщо така група вже є. */
export function updateSpecGroup(id: string, fields: Partial<Omit<SpecGroup, "id">>) {
  const current = read();
  const { name } = fields;
  if (name && current.specGroups.some((g) => g.id !== id && sameName(g.name, name))) return false;
  write({ ...current, specGroups: current.specGroups.map((g) => (g.id === id ? { ...g, ...fields } : g)) });
  return true;
}

/** false, якщо в групі є матеріали довідника або специфікацій: інакше вони зникли б. */
export function removeSpecGroup(id: string) {
  const current = read();
  if (current.materials.some((m) => m.groupId === id)) return false;
  if (current.projects.some((project) => [...project.spec, ...project.estimate].some((row) => row.groupId === id))) return false;
  write({ ...current, specGroups: current.specGroups.filter((g) => g.id !== id) });
  return true;
}

/** false, якщо така одиниця вже є. */
export function addUnit(name: string) {
  const current = read();
  if (current.units.some((unit) => sameName(unit, name))) return false;
  write({ ...current, units: [...current.units, name] });
  return true;
}

/** false, якщо одиницю має матеріал довідника. Рядки специфікації зберігають свою одиницю. */
export function removeUnit(name: string) {
  const current = read();
  if (current.materials.some((m) => m.unit === name)) return false;
  write({ ...current, units: current.units.filter((unit) => unit !== name) });
  return true;
}

/** false, якщо такий виробник уже є. */
export function addMaker(name: string) {
  const current = read();
  if (current.makers.some((maker) => sameName(maker, name))) return false;
  write({ ...current, makers: [...current.makers, name] });
  return true;
}

/** Нова назва переходить і в матеріали. false, якщо такий виробник уже є. */
export function renameMaker(oldName: string, name: string) {
  const current = read();
  if (current.makers.some((maker) => maker !== oldName && sameName(maker, name))) return false;
  write({
    ...current,
    makers: current.makers.map((maker) => (maker === oldName ? name : maker)),
    materials: current.materials.map((m) => (m.maker === oldName ? { ...m, maker: name } : m)),
  });
  return true;
}

/** false, якщо виробника мають матеріали довідника. */
export function removeMaker(name: string) {
  const current = read();
  if (current.materials.some((m) => m.maker === name)) return false;
  write({ ...current, makers: current.makers.filter((maker) => maker !== name) });
  return true;
}

const workTaken = (name: string, exceptId?: string) =>
  read().works.some((w) => w.id !== exceptId && sameName(w.name, name));

/** false, якщо така робота вже є. */
export function addWork(fields: Omit<Work, "id">) {
  if (workTaken(fields.name)) return false;
  const current = read();
  write({ ...current, works: [...current.works, { ...fields, id: newId() }] });
  return true;
}

/** false, якщо робота з такою назвою вже є. */
export function updateWork(id: string, fields: Partial<Omit<Work, "id">>) {
  if (fields.name && workTaken(fields.name, id)) return false;
  const current = read();
  write({ ...current, works: current.works.map((w) => (w.id === id ? { ...w, ...fields } : w)) });
  return true;
}

/** false, якщо до роботи прив'язано матеріали. */
export function removeWork(id: string) {
  const current = read();
  if (current.materials.some((m) => m.workId === id)) return false;
  write({ ...current, works: current.works.filter((w) => w.id !== id) });
  return true;
}

/** Однакова назва можлива в різних виробників, але не двічі в одного. */
const materialTaken = (fields: Pick<Material, "groupId" | "name" | "maker">, exceptId?: string) =>
  read().materials.some(
    (m) => m.groupId === fields.groupId && m.id !== exceptId && sameName(m.name, fields.name) && sameName(m.maker, fields.maker),
  );

/** false, якщо такий матеріал цього виробника в групі вже є. */
export function addMaterial(fields: Omit<Material, "id">) {
  if (materialTaken(fields)) return false;
  const current = read();
  write({ ...current, materials: [...current.materials, { ...fields, id: newId() }] });
  return true;
}

/** false, якщо такий матеріал цього виробника в групі вже є. */
export function updateMaterial(id: string, fields: Partial<Omit<Material, "id">>) {
  const current = read();
  const material = current.materials.find((m) => m.id === id);
  if (!material) return false;
  const next = { ...material, ...fields };
  if (materialTaken(next, id)) return false;
  write({ ...current, materials: current.materials.map((m) => (m.id === id ? next : m)) });
  return true;
}

/** Рядки специфікацій зберігають свою назву, тому прибрати матеріал можна завжди. */
export function removeMaterial(id: string) {
  const current = read();
  write({ ...current, materials: current.materials.filter((m) => m.id !== id) });
}

/** Замовлення завершене, коли зроблено останній етап. */
export function isFinished(data: WeekData, order: string) {
  const last = data.stages.at(-1);
  return last ? stageStatus(data.items, order, last.id) === "done" : false;
}

const stageTaken = (label: string, exceptId?: string) =>
  read().stages.some((s) => s.id !== exceptId && s.label.toLowerCase() === label.toLowerCase());

/** Новий етап стає останнім. false, якщо такий уже є. */
export function addStage(label: string) {
  if (stageTaken(label)) return false;
  const current = read();
  write({ ...current, stages: [...current.stages, { id: newId(), label, hint: "", createsSpec: false, pay: { kind: "none" } }] });
  return true;
}

/** false, якщо етап із такою назвою вже є. */
export function updateStage(id: string, fields: Partial<Omit<Stage, "id">>) {
  if (fields.label && stageTaken(fields.label, id)) return false;
  const current = read();
  write({ ...current, stages: current.stages.map((s) => (s.id === id ? { ...s, ...fields } : s)) });
  return true;
}

/** Переставити етап на одну позицію: -1 вище, 1 нижче. */
export function moveStage(id: string, delta: -1 | 1) {
  const current = read();
  const stages = [...current.stages];
  const from = stages.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= stages.length) return;
  [stages[from], stages[to]] = [stages[to], stages[from]];
  write({ ...current, stages });
}

/** false, якщо на етапі є замовлення або це останній етап, що лишився. */
export function removeStage(id: string) {
  const current = read();
  if (current.stages.length <= 1 || current.items.some((item) => item.stage === id)) return false;
  write({
    ...current,
    stages: current.stages.filter((s) => s.id !== id),
    people: current.people.map((p) => ({ ...p, stages: p.stages.filter((stage) => stage !== id) })),
  });
  return true;
}

/** Прийом (перший етап) одразу належить менеджеру проекту, якщо він працює на цьому етапі. */
function defaultAssignee(current: WeekData, order: string, stage: StageId) {
  if (stage !== current.stages[0]?.id) return null;
  const managerId = current.projects.find((p) => projectLabel(p) === order)?.managerId;
  return current.people.some((person) => person.id === managerId && person.stages.includes(stage)) ? managerId! : null;
}

export function addItem(order: string, stage: StageId, week: string) {
  const current = read();
  const duplicate = itemsOfWeek(current.items, week).some((i) => i.order === order && i.stage === stage);
  if (duplicate) return;
  const item: WorkItem = {
    id: newId(),
    order,
    stage,
    week,
    doneWeek: null,
    doneOn: null,
    nextId: null,
    assigneeId: defaultAssignee(current, order, stage),
    startedOn: null,
    adminMarkedOn: null,
  };
  write({ ...current, items: [...current.items, item] });
}

/** Інший виконавець ще не починав: позначка «в роботі» знімається. */
export function assignItem(id: string, assigneeId: string | null) {
  const current = read();
  write({
    ...current,
    items: current.items.map((i) => (i.id === id ? { ...i, assigneeId, startedOn: i.assigneeId === assigneeId ? i.startedOn : null } : i)),
  });
}

/** Виконавець узяв замовлення в роботу (або скасував це, поки етап не зроблено). */
export function startItem(id: string, started: boolean) {
  const current = read();
  const item = current.items.find((i) => i.id === id);
  if (!item || item.doneWeek || (started && blockedReason(current, item))) return;
  write({ ...current, items: current.items.map((i) => (i.id === id ? { ...i, startedOn: started ? todayIso() : null } : i)) });
}

/** false, якщо такий логін уже зайнято. */
export function addPerson(fields: Omit<Person, "id">) {
  if (loginTaken(fields.login)) return false;
  const current = read();
  write({ ...current, people: [...current.people, { ...fields, id: newId() }] });
  return true;
}

/** false, якщо такий логін уже зайнято. */
export function updatePerson(id: string, fields: Partial<Omit<Person, "id">>) {
  if (fields.login && loginTaken(fields.login, id)) return false;
  const current = read();
  write({ ...current, people: current.people.map((p) => (p.id === id ? { ...p, ...fields } : p)) });
  return true;
}

/** Замовлення людини повертаються в «Не призначено». */
export function removePerson(id: string) {
  const current = read();
  write({
    ...current,
    people: current.people.filter((p) => p.id !== id),
    items: current.items.map((i) => (i.assigneeId === id ? { ...i, assigneeId: null } : i)),
  });
}

const nextStageOf = (stage: StageId) => {
  const stages = read().stages;
  const index = stages.findIndex((s) => s.id === stage);
  return index < 0 ? null : (stages[index + 1]?.id ?? null);
};

/** Адміністратор відмічає чужий етап — це позначається (день), інакше позначка лишається як була. */
function adminMark(current: WeekData, item: WorkItem) {
  const user = current.people.find((person) => person.id === current.sessionId);
  if (user?.role !== "admin" || assigneeOf(item, current.people) === user.id) return item.adminMarkedOn;
  return todayIso();
}

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

/** Етап зроблено: замовлення переходить на наступний етап у цьому самому тижні. */
export function completeItem(id: string, week: string) {
  const current = read();
  const item = current.items.find((i) => i.id === id);
  if (!item || blockedReason(current, item)) return;
  const stage = nextStageOf(item.stage);
  const waiting = current.items.some(
    (i) => i.order === item.order && i.stage === stage && i.doneWeek === null,
  );
  const next: WorkItem | null =
    stage && !waiting
      ? { id: newId(), order: item.order, stage, week, doneWeek: null, doneOn: null, nextId: null, assigneeId: null, startedOn: null, adminMarkedOn: null }
      : null;
  const adminMarkedOn = adminMark(current, item);
  const items = current.items.map((i) =>
    i.id === id ? { ...i, doneWeek: week, doneOn: todayIso(), startedOn: i.startedOn ?? todayIso(), nextId: next?.id ?? null, adminMarkedOn } : i,
  );
  write({ ...current, items: next ? [...items, next] : items });
}

/** Скасувати галочку можна, поки виконавець наступного етапу не взяв замовлення в роботу (і, звісно, не зробив). */
export function canReopen(items: WorkItem[], item: WorkItem) {
  const next = items.find((i) => i.id === item.nextId);
  return !next?.doneWeek && !next?.startedOn;
}

export function reopenItem(id: string) {
  const current = read();
  const item = current.items.find((i) => i.id === id);
  if (!item || !canReopen(current.items, item)) return;
  const items = current.items
    .filter((i) => i.id !== item.nextId)
    .map((i) => (i.id === id ? { ...i, doneWeek: null, doneOn: null, nextId: null, adminMarkedOn: adminMark(current, item) } : i));
  write({ ...current, items });
}

export function removeItem(id: string) {
  const current = read();
  const items = current.items
    .filter((i) => i.id !== id)
    .map((i) => (i.nextId === id ? { ...i, nextId: null } : i));
  write({ ...current, items });
}

const typeNameTaken = (name: string, exceptId?: string) =>
  read().issueTypes.some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== exceptId);

/** false, якщо такий тип уже є. */
export function addIssueType(name: string) {
  if (typeNameTaken(name)) return false;
  const current = read();
  write({ ...current, issueTypes: [...current.issueTypes, { id: newId(), name }] });
  return true;
}

/** false, якщо такий тип уже є. */
export function renameIssueType(id: string, name: string) {
  if (typeNameTaken(name, id)) return false;
  const current = read();
  write({ ...current, issueTypes: current.issueTypes.map((t) => (t.id === id ? { ...t, name } : t)) });
  return true;
}

/** Проблеми цього типу лишаються, але вже без типу. */
export function removeIssueType(id: string) {
  const current = read();
  write({
    ...current,
    issueTypes: current.issueTypes.filter((t) => t.id !== id),
    issues: current.issues.map((i) => (i.typeId === id ? { ...i, typeId: null } : i)),
  });
}

export const issueTypeName = (types: IssueType[], id: string | null) => types.find((t) => t.id === id)?.name ?? "";

export function addIssue(order: string, typeId: string | null, text: string, author: string) {
  const current = read();
  const issue = { id: newId(), order, typeId, text, author, createdOn: todayIso(), resolved: false };
  write({ ...current, issues: [...current.issues, issue] });
}

export function toggleIssue(id: string) {
  const current = read();
  write({ ...current, issues: current.issues.map((i) => (i.id === id ? { ...i, resolved: !i.resolved } : i)) });
}

/** Приклади створюють нових людей, тому після скидання треба ввійти знову. */
export const resetWeekData = () => write(seed());

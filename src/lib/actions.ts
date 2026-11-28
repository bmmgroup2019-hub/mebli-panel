// Дії, що змінюють дані. Кожну виконують двічі: у браузері (одразу на екрані) і на сервері
// (перевірка прав — permissions.ts, остаточний результат, запис у базу). Тому дії — лише над даними,
// без мережі: де саме лежать дані, задає setActionTarget (браузер) або runAction (сервер).
import { mondayOf, todayIso, formatDate } from "./dates";
import { type ChangeNote, type Client, type Company, DETAIL_FIELDS, EMPTY_DETAILS, type Extra, type Material, type Person, type Pricing, type Project, projectLabel, type PurchaseStatus, type RowList, type SpecGroup, type SpecRow, type Stage, type StageId, type WeekData, type Work, type WorkItem } from "./model";
import { assigneeOf, blockedReason, canRefuse, canReopen, estimateLocked, isFinished, isIntake, itemsOfWeek, nextProjectNumber } from "./rules";
import { seed } from "./seed";
import { newId, recordIds, replayIds, sameName } from "./util";
import { keepFrozen } from "./prices";
import { nextArticle, wholeMoney } from "./materials";

type Target = { get: () => WeekData; set: (next: WeekData) => void };
let target: Target | null = null;

/** Браузер: дії читають і пишуть його дані. */
export const setActionTarget = (next: Target) => {
  target = next;
};

function read(): WeekData {
  if (!target) throw new Error("Дані ще не завантажено");
  return target.get();
}

function write(changed: WeekData) {
  if (!target) throw new Error("Дані ще не завантажено");
  target.set(withFrozen(changed));
}

/** Ціни кошторисів фіксуються при кожному записі, тож зміна довідника чи ставок їх уже не зачепить. */
export function withFrozen(next: WeekData): WeekData {
  const projects = next.projects.map((project) => {
    const frozen = keepFrozen(next, project);
    return frozen === project.frozen ? project : { ...project, frozen };
  });
  return projects.every((project, index) => project === next.projects[index]) ? next : { ...next, projects };
}

/** Куди браузер віддає виконану дію: назва, аргументи, видані id і чи змінились дані. */
type Sink = (name: string, args: unknown[], ids: string[], changed: boolean) => void;
let sink: Sink | null = null;

export const setActionSink = (next: Sink) => {
  sink = next;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- аргументи дій різні, перевіряє їх permissions.ts */
type Fn = (...args: any[]) => any;
const REGISTRY: Record<string, Fn> = {};
/** Дія всередині іншої дії (addPayment → updateProject) виконується як частина зовнішньої. */
let depth = 0;

function action<F extends Fn>(name: string, fn: F): F {
  REGISTRY[name] = fn;
  return ((...args: any[]) => {
    if (depth > 0) return fn(...args);
    depth++;
    try {
      const before = target?.get();
      const ids: string[] = [];
      const result = recordIds(ids, () => fn(...args));
      sink?.(name, args, ids, target?.get() !== before);
      return result;
    } finally {
      depth--;
    }
  }) as F;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const isAction = (name: string) => Object.hasOwn(REGISTRY, name);

/** Сервер: виконати дію над даними від імені людини me, видаючи ті самі id, що й у браузері. */
export function runAction(data: WeekData, me: string | null, name: string, args: unknown[], ids: string[]): WeekData {
  const fn = REGISTRY[name];
  if (!fn) throw new Error(`Невідома дія: ${name}`);
  let current: WeekData = { ...data, sessionId: me };
  const previous = target;
  target = { get: () => current, set: (next) => { current = next; } };
  depth++;
  try {
    replayIds(ids, () => fn(...args));
  } finally {
    depth--;
    target = previous;
  }
  return current;
}

const loginTaken = (login: string, exceptId?: string) =>
  read().people.some((p) => p.login === login && p.id !== exceptId);

const numberTaken = (projects: Project[], number: string, exceptId?: string) =>
  projects.some((p) => p.number === number && p.id !== exceptId);

/** id нового замовника. Однакові імена можливі: замовників розрізняє телефон. */
export const addClient = action("addClient", function (fields: Omit<Client, "id">) {
  const current = read();
  const client = { ...fields, id: newId() };
  write({ ...current, clients: [...current.clients, client] });
  return client.id;
});

/** Нове ім'я переходить у підписи всіх проектів замовника, а з ними — у план і проблеми. */
export const updateClient = action("updateClient", function (id: string, fields: Partial<Omit<Client, "id">>) {
  const current = read();
  write({ ...current, clients: current.clients.map((c) => (c.id === id ? { ...c, ...fields } : c)) });
  if (fields.name) {
    for (const project of read().projects.filter((p) => p.clientId === id)) updateProject(project.id, { client: fields.name });
  }
});

/** false, якщо в замовника є проекти. */
export const removeClient = action("removeClient", function (id: string) {
  const current = read();
  if (current.projects.some((p) => p.clientId === id)) return false;
  write({ ...current, clients: current.clients.filter((c) => c.id !== id) });
  return true;
});

/** id нового проекту або null, якщо замовника немає. Номер проставляється автоматично. */
export const addProject = action("addProject", function (
  fields: Omit<Project, "id" | "number" | "client" | "payments" | "spec" | "estimate" | "extras" | "clientPrice" | "managerId" | "adminEditedOn" | "changes" | "details" | "frozen" | "refusal">,
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
    refusal: null,
    frozen: null,
  };
  write({ ...current, projects: [...current.projects, project] });
  // Новий проект одразу стає на прийом у поточному тижні.
  const first = current.stages[0];
  if (first) addItem(projectLabel(project), first.id, mondayOf(todayIso()));
  return project.id;
});

type ChangeDraft = Pick<ChangeNote, "key" | "label" | "from" | "to">;

const changeMoney = (value: number | null) => (value === null ? "не вписано" : wholeMoney(value));
const changeDate = (iso: string) => (iso ? formatDate(iso) : "не вказано");
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
export const updateProject = action("updateProject", function (id: string, fields: Partial<Omit<Project, "id">>) {
  const current = read();
  const project = current.projects.find((p) => p.id === id);
  if (!project) return false;
  const next = { ...project, ...fields };
  // Від поверху рахується заноска (зарплата монтажу), тож після авансу він закритий разом із кошторисом.
  if (estimateLocked(project)) next.floor = project.floor;
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
});

export const addPayment = action("addPayment", function (projectId: string, date: string, amount: number) {
  const current = read();
  const project = current.projects.find((p) => p.id === projectId);
  if (!project) return;
  const final = isFinished(current, projectLabel(project));
  updateProject(projectId, { payments: [...project.payments, { id: newId(), date, amount, ...(final && { final }) }] });
});

export const removePayment = action("removePayment", function (projectId: string, paymentId: string) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project) updateProject(projectId, { payments: project.payments.filter((p) => p.id !== paymentId) });
});
const rowsLocked = (project: Project, list: RowList) => list === "estimate" && estimateLocked(project);

export const addSpecRow = action("addSpecRow", function (projectId: string, fields: Omit<SpecRow, "id">, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !rowsLocked(project, list)) updateProject(projectId, { [list]: [...project[list], { ...fields, id: newId() }] });
});

export const updateSpecRow = action("updateSpecRow", function (projectId: string, rowId: string, fields: Partial<Omit<SpecRow, "id">>, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !rowsLocked(project, list)) {
    updateProject(projectId, { [list]: project[list].map((row) => (row.id === rowId ? { ...row, ...fields } : row)) });
  }
});

/**
 * Закупка рядка специфікації. Окремо від змін проекту: адміністратор веде закупки сам,
 * тому це не позначається як «Змінено адміністратором».
 */
export const setPurchase = action("setPurchase", function (projectId: string, rowId: string, purchase: PurchaseStatus | null) {
  const current = read();
  write({
    ...current,
    projects: current.projects.map((p) =>
      p.id !== projectId
        ? p
        : { ...p, spec: p.spec.map((row) => (row.id === rowId ? { ...row, purchase: purchase ?? undefined } : row)) },
    ),
  });
});

/** Закупка кількох рядків одразу (наприклад, увесь матеріал на сторінці «Закупка»). */
export const setPurchaseMany = action("setPurchaseMany", function (rows: { projectId: string; rowId: string }[], purchase: PurchaseStatus | null) {
  const current = read();
  const marked = new Set(rows.map((r) => `${r.projectId}|${r.rowId}`));
  write({
    ...current,
    projects: current.projects.map((p) => ({
      ...p,
      spec: p.spec.map((row) => (marked.has(`${p.id}|${row.id}`) ? { ...row, purchase: purchase ?? undefined } : row)),
    })),
  });
});

export const removeSpecRow = action("removeSpecRow", function (projectId: string, rowId: string, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !rowsLocked(project, list)) updateProject(projectId, { [list]: project[list].filter((row) => row.id !== rowId) });
});

export const addExtra = action("addExtra", function (projectId: string, fields: Omit<Extra, "id">) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !estimateLocked(project)) updateProject(projectId, { extras: [...project.extras, { ...fields, id: newId() }] });
});

export const removeExtra = action("removeExtra", function (projectId: string, extraId: string) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !estimateLocked(project)) updateProject(projectId, { extras: project.extras.filter((extra) => extra.id !== extraId) });
});

export const updateCompany = action("updateCompany", function (fields: Partial<Company>) {
  const current = read();
  write({ ...current, company: { ...current.company, ...fields } });
});

export const updatePricing = action("updatePricing", function (fields: Partial<Pricing>) {
  const current = read();
  write({ ...current, pricing: { ...current.pricing, ...fields } });
});

/** false, якщо така група вже є. */
export const addSpecGroup = action("addSpecGroup", function (name: string) {
  const current = read();
  if (current.specGroups.some((g) => sameName(g.name, name))) return false;
  write({ ...current, specGroups: [...current.specGroups, { id: newId(), name }] });
  return true;
});

/** false, якщо така група вже є. */
export const updateSpecGroup = action("updateSpecGroup", function (id: string, fields: Partial<Omit<SpecGroup, "id">>) {
  const current = read();
  const { name } = fields;
  if (name && current.specGroups.some((g) => g.id !== id && sameName(g.name, name))) return false;
  write({ ...current, specGroups: current.specGroups.map((g) => (g.id === id ? { ...g, ...fields } : g)) });
  return true;
});

/** false, якщо в групі є матеріали довідника або специфікацій: інакше вони зникли б. */
export const removeSpecGroup = action("removeSpecGroup", function (id: string) {
  const current = read();
  if (current.materials.some((m) => m.groupId === id)) return false;
  if (current.projects.some((project) => [...project.spec, ...project.estimate].some((row) => row.groupId === id))) return false;
  write({ ...current, specGroups: current.specGroups.filter((g) => g.id !== id) });
  return true;
});

/** false, якщо така одиниця вже є. */
export const addUnit = action("addUnit", function (name: string) {
  const current = read();
  if (current.units.some((unit) => sameName(unit, name))) return false;
  write({ ...current, units: [...current.units, name] });
  return true;
});

/** false, якщо одиницю має матеріал довідника. Рядки специфікації зберігають свою одиницю. */
export const removeUnit = action("removeUnit", function (name: string) {
  const current = read();
  if (current.materials.some((m) => m.unit === name)) return false;
  write({ ...current, units: current.units.filter((unit) => unit !== name) });
  return true;
});

/** false, якщо такий виробник уже є. */
export const addMaker = action("addMaker", function (name: string) {
  const current = read();
  if (current.makers.some((maker) => sameName(maker, name))) return false;
  write({ ...current, makers: [...current.makers, name] });
  return true;
});

/** Нова назва переходить і в матеріали. false, якщо такий виробник уже є. */
export const renameMaker = action("renameMaker", function (oldName: string, name: string) {
  const current = read();
  if (current.makers.some((maker) => maker !== oldName && sameName(maker, name))) return false;
  write({
    ...current,
    makers: current.makers.map((maker) => (maker === oldName ? name : maker)),
    materials: current.materials.map((m) => (m.maker === oldName ? { ...m, maker: name } : m)),
  });
  return true;
});

/** false, якщо виробника мають матеріали довідника. */
export const removeMaker = action("removeMaker", function (name: string) {
  const current = read();
  if (current.materials.some((m) => m.maker === name)) return false;
  write({ ...current, makers: current.makers.filter((maker) => maker !== name) });
  return true;
});

const workTaken = (name: string, exceptId?: string) =>
  read().works.some((w) => w.id !== exceptId && sameName(w.name, name));

/** false, якщо така робота вже є. */
export const addWork = action("addWork", function (fields: Omit<Work, "id">) {
  if (workTaken(fields.name)) return false;
  const current = read();
  write({ ...current, works: [...current.works, { ...fields, id: newId() }] });
  return true;
});

/** false, якщо робота з такою назвою вже є. */
export const updateWork = action("updateWork", function (id: string, fields: Partial<Omit<Work, "id">>) {
  if (fields.name && workTaken(fields.name, id)) return false;
  const current = read();
  write({ ...current, works: current.works.map((w) => (w.id === id ? { ...w, ...fields } : w)) });
  return true;
});

/** false, якщо до роботи прив'язано матеріали. */
export const removeWork = action("removeWork", function (id: string) {
  const current = read();
  if (current.materials.some((m) => m.workId === id)) return false;
  write({ ...current, works: current.works.filter((w) => w.id !== id) });
  return true;
});

/** Однакова назва можлива в різних виробників, але не двічі в одного. */
const materialTaken = (fields: Pick<Material, "groupId" | "name" | "maker">, exceptId?: string) =>
  read().materials.some(
    (m) => m.groupId === fields.groupId && m.id !== exceptId && sameName(m.name, fields.name) && sameName(m.maker, fields.maker),
  );

const articleTaken = (article: string, exceptId?: string) =>
  read().materials.some((m) => m.id !== exceptId && sameName(m.article, article));

/**
 * Перевірка й артикул перед записом: порожній артикул сайт присвоює сам («М-0001»…),
 * свій зберігається як є. Повертає текст помилки або готовий артикул.
 */
function checkMaterial(fields: Omit<Material, "id">, exceptId?: string): { error: string } | { article: string } {
  if (materialTaken(fields, exceptId)) return { error: "Такий матеріал цього виробника в групі вже є." };
  const own = fields.article.trim();
  if (!own) return { article: nextArticle(read().materials) };
  if (articleTaken(own, exceptId)) return { error: `Артикул «${own}» уже є в іншого матеріалу.` };
  return { article: own };
}

/** Текст помилки або null, якщо матеріал додано. */
export const addMaterial = action("addMaterial", function (fields: Omit<Material, "id">) {
  const checked = checkMaterial(fields);
  if ("error" in checked) return checked.error;
  const current = read();
  write({ ...current, materials: [...current.materials, { ...fields, article: checked.article, id: newId() }] });
  return null;
});

/** Текст помилки або null, якщо зміни збережено. */
export const updateMaterial = action("updateMaterial", function (id: string, fields: Partial<Omit<Material, "id">>) {
  const current = read();
  const material = current.materials.find((m) => m.id === id);
  if (!material) return "Матеріал не знайдено.";
  const next = { ...material, ...fields };
  const checked = checkMaterial(next, id);
  if ("error" in checked) return checked.error;
  write({ ...current, materials: current.materials.map((m) => (m.id === id ? { ...next, article: checked.article } : m)) });
  return null;
});

/** Рядки специфікацій зберігають свою назву, тому прибрати матеріал можна завжди. */
export const removeMaterial = action("removeMaterial", function (id: string) {
  const current = read();
  write({ ...current, materials: current.materials.filter((m) => m.id !== id) });
});

const stageTaken = (label: string, exceptId?: string) =>
  read().stages.some((s) => s.id !== exceptId && s.label.toLowerCase() === label.toLowerCase());

/** Новий етап стає останнім. false, якщо такий уже є. */
export const addStage = action("addStage", function (label: string) {
  if (stageTaken(label)) return false;
  const current = read();
  write({ ...current, stages: [...current.stages, { id: newId(), label, hint: "", createsSpec: false, pay: { kind: "none" } }] });
  return true;
});

/** false, якщо етап із такою назвою вже є. */
export const updateStage = action("updateStage", function (id: string, fields: Partial<Omit<Stage, "id">>) {
  if (fields.label && stageTaken(fields.label, id)) return false;
  const current = read();
  write({ ...current, stages: current.stages.map((s) => (s.id === id ? { ...s, ...fields } : s)) });
  return true;
});

/** Переставити етап на одну позицію: -1 вище, 1 нижче. */
export const moveStage = action("moveStage", function (id: string, delta: -1 | 1) {
  const current = read();
  const stages = [...current.stages];
  const from = stages.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= stages.length) return;
  [stages[from], stages[to]] = [stages[to], stages[from]];
  write({ ...current, stages });
});

/** false, якщо на етапі є замовлення або це останній етап, що лишився. */
export const removeStage = action("removeStage", function (id: string) {
  const current = read();
  if (current.stages.length <= 1 || current.items.some((item) => item.stage === id)) return false;
  write({
    ...current,
    stages: current.stages.filter((s) => s.id !== id),
    people: current.people.map((p) => ({ ...p, stages: p.stages.filter((stage) => stage !== id) })),
  });
  return true;
});

/** Прийом (перший етап) одразу належить менеджеру проекту, якщо він працює на цьому етапі. */
function defaultAssignee(current: WeekData, order: string, stage: StageId) {
  if (stage !== current.stages[0]?.id) return null;
  const managerId = current.projects.find((p) => projectLabel(p) === order)?.managerId;
  return current.people.some((person) => person.id === managerId && person.stages.includes(stage)) ? managerId! : null;
}

export const addItem = action("addItem", function (order: string, stage: StageId, week: string) {
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
    // Прийом менеджер не «бере»: замовлення в нього в роботі, щойно він його створив.
    startedOn: isIntake(current, stage) ? todayIso() : null,
    adminMarkedOn: null,
  };
  write({ ...current, items: [...current.items, item] });
});

/** Інший виконавець ще не починав: позначка «в роботі» знімається. */
export const assignItem = action("assignItem", function (id: string, assigneeId: string | null) {
  const current = read();
  // Виконавця зробленого етапу змінює лише адміністратор: від нього залежить зарплата.
  const user = current.people.find((person) => person.id === current.sessionId);
  if (current.items.find((i) => i.id === id)?.doneWeek && user?.role !== "admin") return;
  write({
    ...current,
    items: current.items.map((i) =>
      i.id !== id
        ? i
        : // Прийом лишається в роботі й в іншого менеджера.
          { ...i, assigneeId, startedOn: isIntake(current, i.stage) ? (i.startedOn ?? todayIso()) : i.assigneeId === assigneeId ? i.startedOn : null },
    ),
  });
});

/** Виконавець узяв замовлення в роботу (або скасував це, поки етап не зроблено). */
export const startItem = action("startItem", function (id: string, started: boolean) {
  const current = read();
  const item = current.items.find((i) => i.id === id);
  // Прийом у роботі з моменту створення: його не беруть і не скасовують.
  if (!item || item.doneWeek || isIntake(current, item.stage) || (started && blockedReason(current, item))) return;
  write({ ...current, items: current.items.map((i) => (i.id === id ? { ...i, startedOn: started ? todayIso() : null } : i)) });
});

/** false, якщо такий логін уже зайнято. */
export const addPerson = action("addPerson", function (fields: Omit<Person, "id">) {
  if (loginTaken(fields.login)) return false;
  const current = read();
  write({ ...current, people: [...current.people, { ...fields, id: newId() }] });
  return true;
});

/** false, якщо такий логін уже зайнято. */
export const updatePerson = action("updatePerson", function (id: string, fields: Partial<Omit<Person, "id">>) {
  if (fields.login && loginTaken(fields.login, id)) return false;
  const current = read();
  write({ ...current, people: current.people.map((p) => (p.id === id ? { ...p, ...fields } : p)) });
  return true;
});

/** Замовлення людини повертаються в «Не призначено». */
/** false, якщо в людини є виплати: їхня історія не має зникнути (у базі так само заборонено). */
export const removePerson = action("removePerson", function (id: string) {
  const current = read();
  if (current.payouts.some((p) => p.personId === id)) return false;
  write({
    ...current,
    people: current.people.filter((p) => p.id !== id),
    items: current.items.map((i) => (i.assigneeId === id ? { ...i, assigneeId: null } : i)),
  });
  return true;
});

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

/** Етап зроблено: замовлення переходить на наступний етап у цьому самому тижні. */
export const completeItem = action("completeItem", function (id: string, week: string) {
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
});

export const reopenItem = action("reopenItem", function (id: string) {
  const current = read();
  const item = current.items.find((i) => i.id === id);
  if (!item || !canReopen(current.items, item)) return;
  const items = current.items
    .filter((i) => i.id !== item.nextId)
    .map((i) => (i.id === id ? { ...i, doneWeek: null, doneOn: null, nextId: null, adminMarkedOn: adminMark(current, item) } : i));
  write({ ...current, items });
});

export const removeItem = action("removeItem", function (id: string) {
  const current = read();
  const items = current.items
    .filter((i) => i.id !== id)
    .map((i) => (i.nextId === id ? { ...i, nextId: null } : i));
  write({ ...current, items });
});

const typeNameTaken = (name: string, exceptId?: string) =>
  read().issueTypes.some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== exceptId);

/** false, якщо такий тип уже є. */
export const addIssueType = action("addIssueType", function (name: string) {
  if (typeNameTaken(name)) return false;
  const current = read();
  write({ ...current, issueTypes: [...current.issueTypes, { id: newId(), name }] });
  return true;
});

/** false, якщо такий тип уже є. */
export const renameIssueType = action("renameIssueType", function (id: string, name: string) {
  if (typeNameTaken(name, id)) return false;
  const current = read();
  write({ ...current, issueTypes: current.issueTypes.map((t) => (t.id === id ? { ...t, name } : t)) });
  return true;
});

/** Проблеми цього типу лишаються, але вже без типу. */
export const removeIssueType = action("removeIssueType", function (id: string) {
  const current = read();
  write({
    ...current,
    issueTypes: current.issueTypes.filter((t) => t.id !== id),
    issues: current.issues.map((i) => (i.typeId === id ? { ...i, typeId: null } : i)),
  });
});

export const addIssue = action("addIssue", function (order: string, typeId: string | null, text: string, author: string) {
  const current = read();
  const issue = { id: newId(), order, typeId, text, author, createdOn: todayIso(), resolved: false };
  write({ ...current, issues: [...current.issues, issue] });
});

export const toggleIssue = action("toggleIssue", function (id: string) {
  const current = read();
  write({ ...current, issues: current.issues.map((i) => (i.id === id ? { ...i, resolved: !i.resolved } : i)) });
});

/** Відмова: незроблені записи проекту йдуть з «Тижня». false, якщо вже є аванс. */
export const refuseProject = action("refuseProject", function (id: string, reasonId: string | null, note: string) {
  const current = read();
  const project = current.projects.find((p) => p.id === id);
  const user = current.people.find((person) => person.id === current.sessionId) ?? null;
  if (!project || project.refusal || !canRefuse(user, project)) return false;
  const label = projectLabel(project);
  write({
    ...current,
    projects: current.projects.map((p) => (p.id === id ? { ...p, refusal: { on: todayIso(), reasonId, note: note.trim(), by: user?.name ?? "" } } : p)),
    items: current.items.filter((item) => !(item.order === label && item.doneWeek === null)),
  });
  return true;
});

/** Повернути в роботу: проект знову стає на прийом у поточному тижні. */
export const returnProject = action("returnProject", function (id: string) {
  const current = read();
  const project = current.projects.find((p) => p.id === id);
  const user = current.people.find((person) => person.id === current.sessionId) ?? null;
  if (!project?.refusal || !canRefuse(user, project)) return;
  write({ ...current, projects: current.projects.map((p) => (p.id === id ? { ...p, refusal: null } : p)) });
  const first = current.stages[0];
  if (first) addItem(projectLabel(project), first.id, mondayOf(todayIso()));
});

const reasonTaken = (name: string, exceptId?: string) =>
  read().refusalReasons.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== exceptId);

/** false, якщо така причина вже є. */
export const addRefusalReason = action("addRefusalReason", function (name: string) {
  if (reasonTaken(name)) return false;
  const current = read();
  write({ ...current, refusalReasons: [...current.refusalReasons, { id: newId(), name }] });
  return true;
});

export const renameRefusalReason = action("renameRefusalReason", function (id: string, name: string) {
  if (reasonTaken(name, id)) return false;
  const current = read();
  write({ ...current, refusalReasons: current.refusalReasons.map((r) => (r.id === id ? { ...r, name } : r)) });
  return true;
});

/** Відмови з цією причиною лишаються, але вже без причини. */
export const removeRefusalReason = action("removeRefusalReason", function (id: string) {
  const current = read();
  write({
    ...current,
    refusalReasons: current.refusalReasons.filter((r) => r.id !== id),
    projects: current.projects.map((p) => (p.refusal?.reasonId === id ? { ...p, refusal: { ...p.refusal, reasonId: null } } : p)),
  });
});

export const addPayout = action("addPayout", function (personId: string, date: string, amount: number, note: string) {
  if (!(amount > 0) || !date) return;
  const current = read();
  write({ ...current, payouts: [...current.payouts, { id: newId(), personId, date, amount, note: note.trim() }] });
});

export const removePayout = action("removePayout", function (id: string) {
  const current = read();
  write({ ...current, payouts: current.payouts.filter((p) => p.id !== id) });
});

/** Приклади створюють нових людей, тому після скидання треба ввійти знову. */
export const resetWeekData = action("resetWeekData", function () {
  write(seed());
});

// Сховище прототипу: localStorage цього браузера, дії, що змінюють дані, і хуки для сторінок.
// Модель — model.ts, правила (хто що бачить, статуси) — rules.ts, приклади — seed.ts і mock-projects.ts.
// Із базою зміниться саме цей файл: дії підуть на сервер, правила й розрахунки лишаться спільними.
import { useSyncExternalStore } from "react";
import { mondayOf, todayIso, formatDate } from "./dates";
import { type ChangeNote, type Client, type Company, DETAIL_FIELDS, EMPTY_DETAILS, type Extra, type Material, type Person, type Pricing, type Project, projectLabel, type PurchaseStatus, type RowList, type SpecGroup, type SpecRow, type Stage, type StageId, type WeekData, type Work, type WorkItem } from "./model";
import { assigneeOf, blockedReason, canRefuse, canReopen, estimateLocked, isFinished, isIntake, itemsOfWeek, nextProjectNumber, projectAccess, specAccess } from "./rules";
import { seed } from "./seed";
import { newId, sameName } from "./util";
import { keepFrozen } from "./prices";
import { nextArticle, wholeMoney } from "./materials";

const KEY = "panel-week-v50";

let data: WeekData | null = null;
const listeners = new Set<() => void>();

function read(): WeekData {
  if (data) return data;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) data = withFrozen(JSON.parse(saved) as WeekData);
  } catch {
    // Пошкоджені або недоступні дані: починаємо з прикладів.
  }
  data ??= seed();
  return data;
}

/** Ціни кошторисів фіксуються при кожному записі, тож зміна довідника чи ставок їх уже не зачепить. */
function withFrozen(next: WeekData): WeekData {
  const projects = next.projects.map((project) => {
    const frozen = keepFrozen(next, project);
    return frozen === project.frozen ? project : { ...project, frozen };
  });
  return projects.every((project, index) => project === next.projects[index]) ? next : { ...next, projects };
}

function write(changed: WeekData) {
  const next = withFrozen(changed);
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

/** «Закупку» ведуть адміністратор, менеджери й закупівельник. */
export function useSeesPurchases() {
  const role = useCurrentUser()?.role;
  return role === "admin" || role === "manager" || role === "buyer";
}

/** Додавати матеріали й змінювати ціни в довіднику: адміністратор, менеджер, закупівельник. */
export const useCanEditMaterials = useSeesPurchases;

/**
 * «Головну», «Проекти» й «Матеріали» бачать адміністратор, менеджер і люди етапів зі специфікацією (конструктор).
 * Складальникам та іншим працівникам лишаються «Тиждень» і «Проблеми».
 */
export function useSeesOffice() {
  const user = useCurrentUser();
  const specStages = useWeekData()?.stages.filter((stage) => stage.createsSpec).map((stage) => stage.id) ?? [];
  return user?.role === "admin" || user?.role === "manager" || Boolean(user?.stages.some((id) => specStages.includes(id)));
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

const numberTaken = (projects: Project[], number: string, exceptId?: string) =>
  projects.some((p) => p.number === number && p.id !== exceptId);

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

/** id нового проекту або null, якщо замовника немає. Номер проставляється автоматично. */
export function addProject(
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
}

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
export function updateProject(id: string, fields: Partial<Omit<Project, "id">>) {
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
const rowsLocked = (project: Project, list: RowList) => list === "estimate" && estimateLocked(project);

export function addSpecRow(projectId: string, fields: Omit<SpecRow, "id">, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !rowsLocked(project, list)) updateProject(projectId, { [list]: [...project[list], { ...fields, id: newId() }] });
}

export function updateSpecRow(projectId: string, rowId: string, fields: Partial<Omit<SpecRow, "id">>, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !rowsLocked(project, list)) {
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

/** Закупка кількох рядків одразу (наприклад, увесь матеріал на сторінці «Закупка»). */
export function setPurchaseMany(rows: { projectId: string; rowId: string }[], purchase: PurchaseStatus | null) {
  const current = read();
  const marked = new Set(rows.map((r) => `${r.projectId}|${r.rowId}`));
  write({
    ...current,
    projects: current.projects.map((p) => ({
      ...p,
      spec: p.spec.map((row) => (marked.has(`${p.id}|${row.id}`) ? { ...row, purchase: purchase ?? undefined } : row)),
    })),
  });
}

export function removeSpecRow(projectId: string, rowId: string, list: RowList = "spec") {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !rowsLocked(project, list)) updateProject(projectId, { [list]: project[list].filter((row) => row.id !== rowId) });
}

export function addExtra(projectId: string, fields: Omit<Extra, "id">) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !estimateLocked(project)) updateProject(projectId, { extras: [...project.extras, { ...fields, id: newId() }] });
}

export function removeExtra(projectId: string, extraId: string) {
  const project = read().projects.find((p) => p.id === projectId);
  if (project && !estimateLocked(project)) updateProject(projectId, { extras: project.extras.filter((extra) => extra.id !== extraId) });
}

export function updateCompany(fields: Partial<Company>) {
  const current = read();
  write({ ...current, company: { ...current.company, ...fields } });
}

export function updatePricing(fields: Partial<Pricing>) {
  const current = read();
  write({ ...current, pricing: { ...current.pricing, ...fields } });
}

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
export function addMaterial(fields: Omit<Material, "id">) {
  const checked = checkMaterial(fields);
  if ("error" in checked) return checked.error;
  const current = read();
  write({ ...current, materials: [...current.materials, { ...fields, article: checked.article, id: newId() }] });
  return null;
}

/** Текст помилки або null, якщо зміни збережено. */
export function updateMaterial(id: string, fields: Partial<Omit<Material, "id">>) {
  const current = read();
  const material = current.materials.find((m) => m.id === id);
  if (!material) return "Матеріал не знайдено.";
  const next = { ...material, ...fields };
  const checked = checkMaterial(next, id);
  if ("error" in checked) return checked.error;
  write({ ...current, materials: current.materials.map((m) => (m.id === id ? { ...next, article: checked.article } : m)) });
  return null;
}

/** Рядки специфікацій зберігають свою назву, тому прибрати матеріал можна завжди. */
export function removeMaterial(id: string) {
  const current = read();
  write({ ...current, materials: current.materials.filter((m) => m.id !== id) });
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
    // Прийом менеджер не «бере»: замовлення в нього в роботі, щойно він його створив.
    startedOn: isIntake(current, stage) ? todayIso() : null,
    adminMarkedOn: null,
  };
  write({ ...current, items: [...current.items, item] });
}

/** Інший виконавець ще не починав: позначка «в роботі» знімається. */
export function assignItem(id: string, assigneeId: string | null) {
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
}

/** Виконавець узяв замовлення в роботу (або скасував це, поки етап не зроблено). */
export function startItem(id: string, started: boolean) {
  const current = read();
  const item = current.items.find((i) => i.id === id);
  // Прийом у роботі з моменту створення: його не беруть і не скасовують.
  if (!item || item.doneWeek || isIntake(current, item.stage) || (started && blockedReason(current, item))) return;
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

export function addIssue(order: string, typeId: string | null, text: string, author: string) {
  const current = read();
  const issue = { id: newId(), order, typeId, text, author, createdOn: todayIso(), resolved: false };
  write({ ...current, issues: [...current.issues, issue] });
}

export function toggleIssue(id: string) {
  const current = read();
  write({ ...current, issues: current.issues.map((i) => (i.id === id ? { ...i, resolved: !i.resolved } : i)) });
}

/** Відмова: незроблені записи проекту йдуть з «Тижня». false, якщо вже є аванс. */
export function refuseProject(id: string, reasonId: string | null, note: string) {
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
}

/** Повернути в роботу: проект знову стає на прийом у поточному тижні. */
export function returnProject(id: string) {
  const current = read();
  const project = current.projects.find((p) => p.id === id);
  const user = current.people.find((person) => person.id === current.sessionId) ?? null;
  if (!project?.refusal || !canRefuse(user, project)) return;
  write({ ...current, projects: current.projects.map((p) => (p.id === id ? { ...p, refusal: null } : p)) });
  const first = current.stages[0];
  if (first) addItem(projectLabel(project), first.id, mondayOf(todayIso()));
}

const reasonTaken = (name: string, exceptId?: string) =>
  read().refusalReasons.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== exceptId);

/** false, якщо така причина вже є. */
export function addRefusalReason(name: string) {
  if (reasonTaken(name)) return false;
  const current = read();
  write({ ...current, refusalReasons: [...current.refusalReasons, { id: newId(), name }] });
  return true;
}

export function renameRefusalReason(id: string, name: string) {
  if (reasonTaken(name, id)) return false;
  const current = read();
  write({ ...current, refusalReasons: current.refusalReasons.map((r) => (r.id === id ? { ...r, name } : r)) });
  return true;
}

/** Відмови з цією причиною лишаються, але вже без причини. */
export function removeRefusalReason(id: string) {
  const current = read();
  write({
    ...current,
    refusalReasons: current.refusalReasons.filter((r) => r.id !== id),
    projects: current.projects.map((p) => (p.refusal?.reasonId === id ? { ...p, refusal: { ...p.refusal, reasonId: null } } : p)),
  });
}

export function addPayout(personId: string, date: string, amount: number, note: string) {
  if (!(amount > 0) || !date) return;
  const current = read();
  write({ ...current, payouts: [...current.payouts, { id: newId(), personId, date, amount, note: note.trim() }] });
}

export function removePayout(id: string) {
  const current = read();
  write({ ...current, payouts: current.payouts.filter((p) => p.id !== id) });
}

/** Приклади створюють нових людей, тому після скидання треба ввійти знову. */
export const resetWeekData = () => write(seed());

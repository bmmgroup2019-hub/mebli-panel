// Приклади для прототипу: перший запуск і «Повернути приклади». Дані вигадані.
import { addDays, mondayOf, todayIso } from "./dates";
import { MOCK_CLIENTS, MOCK_INTAKE, MOCK_MAKERS, MOCK_MATERIALS, MOCK_SPEC_GROUPS, MOCK_UNITS, MOCK_WORKS, MOCK_STAGES, mockProjects } from "./mock-projects";
import { EMPTY_DETAILS, type Issue, type IssueType, type Person, type Pricing, type Project, projectLabel, type RefusalReason, type StageId, type WeekData, type WorkItem } from "./model";
import { keepFrozen } from "./prices";
import { newId } from "./util";

export const PRICING: Pricing = { marginPercent: 60, floorRate: 150, floorStageId: "install" };

export function seed(): WeekData {
  const today = todayIso();
  const week = mondayOf(today);
  const lastWeek = addDays(week, -7);
  const owner: Person = { id: newId(), name: "Власник", login: "admin", password: "admin", role: "admin", stages: [] };
  const manager: Person = { id: newId(), name: "Менеджер", login: "manager", password: "2222", role: "manager", stages: ["intake"] };
  const manager2: Person = { id: newId(), name: "Менеджер 2", login: "manager2", password: "6666", role: "manager", stages: ["intake"] };
  const constructor: Person = { id: newId(), name: "Конструктор", login: "konstruktor", password: "3333", role: "worker", stages: ["project"] };
  const cncOperator: Person = { id: newId(), name: "Оператор ЧПУ", login: "chpu", password: "4444", role: "worker", stages: ["cnc"] };
  const edger: Person = { id: newId(), name: "Крайкообліцювальник", login: "kraika", password: "5555", role: "worker", stages: ["edge"] };
  const buyer: Person = { id: newId(), name: "Закупівельник", login: "zakupka", password: "8888", role: "buyer", stages: [] };
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
  const refusalReasons: RefusalReason[] = ["Дорого", "Довго чекати", "Пішов до інших", "Передумав", "Інше"].map((name) => ({ id: newId(), name }));
  const issue = (order: string, type: IssueType | null, text: string, author = owner.name): Issue => ({
    id: newId(), order, typeId: type?.id ?? null, text, author, createdOn: today, resolved: false,
  });
  // У прикладі шафа й тумба — проекти другого менеджера, решта — першого.
  // Проекти прикладу вже мають кошториси, тож ціни одразу зафіксовано.
  const prices = { materials: MOCK_MATERIALS, works: MOCK_WORKS, stages: MOCK_STAGES, pricing: PRICING };
  // Приклад відмови: другий менеджер прорахував шафу, клієнт пішов до інших.
  const refused: Project = {
    id: "vidmova",
    number: "245",
    clientId: "c-bondar",
    client: "Бондар",
    product: "Шафа в передпокій",
    acceptedOn: addDays(week, -10),
    dueOn: "",
    payments: [],
    spec: [],
    estimate: [
      { id: "vidmova-e0", groupId: "boards", name: "ДСП Kronospan 0110 SM Білий корпусний, 18 мм", quantity: 2, unit: "лист" },
      { id: "vidmova-e1", groupId: "fasteners", name: "Конфірмат Muller 7×50 мм", quantity: 80, unit: "шт" },
    ],
    extras: [],
    clientPrice: 18500,
    managerId: "",
    adminEditedOn: null,
    changes: [],
    details: { ...EMPTY_DETAILS },
    floor: null,
    refusal: { on: addDays(week, -3), reasonId: refusalReasons[2].id, note: "Знайшли дешевше в іншій майстерні", by: "Менеджер 2" },
    frozen: null,
  };
  const projects = [...mockProjects(week), refused].map((project) => ({
    ...project,
    managerId: ["shafa", "tumba", "vidmova"].includes(project.id) || MOCK_INTAKE.find((q) => q.id === project.id)?.manager === 2 ? manager2.id : manager.id,
    frozen: keepFrozen(prices, project),
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
    refusalReasons,
    // Приклад виплати: аванс конструктору.
    payouts: [{ id: newId(), personId: constructor.id, date: addDays(week, -1) < today ? addDays(week, -1) : today, amount: 1000, note: "Аванс" }],
    specGroups: MOCK_SPEC_GROUPS,
    units: MOCK_UNITS,
    makers: MOCK_MAKERS,
    materials: MOCK_MATERIALS,
    works: MOCK_WORKS,
    pricing: PRICING,
    clients: MOCK_CLIENTS,
    projects,
    people: [owner, manager, manager2, constructor, cncOperator, edger, ...workers, ...installers, buyer],
    items: linkNext([
      // Прийом і розрахунок: тиждень прийому замовлення.
      ...projects.map((project) => {
        const accepted = mondayOf(project.acceptedOn);
        // Шафа-купе й прораховані замовлення ще на прийомі: на наступний етап не передано.
        const waiting = project.id === "kupe" || MOCK_INTAKE.some((q) => q.id === project.id);
        // Прийом у роботі в менеджера з дня, коли він прийняв замовлення.
        return { ...item(projectLabel(project), "intake", accepted, waiting ? null : accepted, project.managerId), startedOn: project.acceptedOn };
      }).filter((entry) => !entry.order.startsWith("№245")), // відмова: на «Тижні» її вже немає
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
export function linkNext(items: WorkItem[]) {
  const order = MOCK_STAGES.map((stage) => stage.id);
  return items.map((item) => {
    if (!item.doneWeek) return item;
    const nextStage = order[order.indexOf(item.stage) + 1];
    const next = items.find((i) => i.order === item.order && i.stage === nextStage);
    return next ? { ...item, nextId: next.id } : item;
  });
}

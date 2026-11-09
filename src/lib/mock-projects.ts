// Вигадані дані прототипу. Один виріб = один проект.
import { addDays } from "./dates";

/**
 * Як нараховується зарплата за етап: не нараховується, відсоток від вартості всіх матеріалів замовлення
 * або за роботами (порізка, поклейка крайки) — кількість матеріалу × ціна роботи.
 * handover — друга частина відсотка, яка нараховується за здачу (останній етап завершено).
 * Використовується лише для першого етапу (менеджер: прийом замовлення і здача).
 */
export type StagePay = { kind: "none" } | { kind: "percent"; percent: number; handover?: number } | { kind: "works" };

export type Stage = { id: string; label: string; hint: string; createsSpec: boolean; pay: StagePay };
export type StageId = string;

/** Етапи прикладу, ставки вигадані. Адміністратор змінює їх у панелі. */
export const MOCK_STAGES: Stage[] = [
  { id: "intake", label: "Прийом і розрахунок", hint: "менеджер: прийом замовлення, вартість", createsSpec: false, pay: { kind: "percent", percent: 2, handover: 1 } },
  { id: "project", label: "Робочий проект", hint: "креслення, УП на ЧПУ", createsSpec: true, pay: { kind: "percent", percent: 3 } },
  { id: "cnc", label: "ЧПУ: порізка і присадка", hint: "нестінг", createsSpec: false, pay: { kind: "works" } },
  { id: "edge", label: "Поклейка крайки", hint: "", createsSpec: false, pay: { kind: "works" } },
  { id: "assembly", label: "Зборка", hint: "", createsSpec: false, pay: { kind: "percent", percent: 6 } },
  { id: "install", label: "Монтаж", hint: "", createsSpec: false, pay: { kind: "percent", percent: 4 } },
];

/** Робота, за яку платять від кількості матеріалу: «Порізка ДСП», «Поклейка крайки». Ціна — грн за одиницю. */
export type Work = { id: string; name: string; unit: string; stageId: StageId; price: number | null };

/** Приклади робіт, ціни вигадані. */
export const MOCK_WORKS: Work[] = [
  { id: "w-cut-chip", name: "Порізка ДСП", unit: "м²", stageId: "cnc", price: 40 },
  { id: "w-cut-hdf", name: "Порізка ДВП", unit: "м²", stageId: "cnc", price: 15 },
  { id: "w-cut-mdf", name: "Порізка МДФ", unit: "м²", stageId: "cnc", price: 60 },
  { id: "w-edge-thin", name: "Поклейка крайки 0,8 мм", unit: "пог. м", stageId: "edge", price: 5 },
  { id: "w-edge-thick", name: "Поклейка крайки 2 мм", unit: "пог. м", stageId: "edge", price: 8 },
];
export type StageStatus = "todo" | "wip" | "done";

/** Група специфікації. Одиниць у групи немає: одиницю вибирають у кожному рядку. */
export type SpecGroup = { id: string; name: string };
/** Стан закупки рядка специфікації: замовлено або куплено (порожньо — ще ні). */
export type PurchaseStatus = "ordered" | "bought";
export type SpecRow = { id: string; groupId: string; name: string; quantity: number | null; unit: string; purchase?: PurchaseStatus };

export type Payment = { id: string; date: string; amount: number };

/** Додаткові витрати в кошторисі: силікон, доставка тощо. */
export type Extra = { id: string; name: string; amount: number };

/** Замовник: окремий запис, проекти посилаються на нього. Поверх — для заноски. */
export type Client = { id: string; name: string; phone: string; address: string; floor: number | null };

export type Project = {
  id: string;
  number: string;
  clientId: string;
  client: string; // ім'я замовника, копія для підпису проекту; оновлюється разом із замовником
  product: string;
  acceptedOn: string;
  dueOn: string;
  payments: Payment[];
  spec: SpecRow[]; // технічний документ конструктора, від нього нічого не рахуємо
  estimate: SpecRow[]; // попередній кошторис менеджера: від нього вартість і зарплата
  extras: Extra[];
  clientPrice: number | null; // вартість для клієнта: менеджер вписує вручну, зазвичай із запасом над розрахунковою
  managerId: string; // менеджер, який створив проект: лише він (і адміністратор) його змінює
  adminEditedOn: string | null; // день, коли адміністратор востаннє змінив чужий проект
};

export const MOCK_UNITS = ["м²", "лист", "пог. м", "шт", "компл."];

export const MOCK_SPEC_GROUPS: SpecGroup[] = [
  { id: "boards", name: "Плитний матеріал" },
  { id: "edging", name: "Крайка" },
  { id: "facade", name: "Фасадний матеріал" },
  { id: "countertop", name: "Стільниця" },
  { id: "fasteners", name: "Кріплення" },
  { id: "hardware", name: "Фурнітура" },
];

/**
 * Матеріал довідника. maker — виробник зі списку виробників (порожньо, якщо не важливо).
 * price — ціна за одиницю, грн; null — не вказано. Кількості немає: складу поки немає.
 * workId — робота, за яку платять від кількості цього матеріалу (порізка, поклейка), або null.
 */
export type Material = {
  id: string;
  groupId: string;
  name: string;
  maker: string;
  unit: string;
  price: number | null;
  workId: string | null;
};

/** Приклади виробників, вигадані. */
export const MOCK_MAKERS = ["Деревпласт", "Кромтех", "Метал-Дім", "ПлитаПром", "Стільниця-Про", "Фасад-Майстер", "Фурніс"];

/** Яка робота в прикладі прив'язана до матеріалу. */
function workOf(name: string) {
  if (name.startsWith("ДСП")) return "w-cut-chip";
  if (name.startsWith("ДВП")) return "w-cut-hdf";
  if (name.startsWith("МДФ")) return "w-cut-mdf";
  if (name.startsWith("Крайка")) return name.includes("0,8") ? "w-edge-thin" : "w-edge-thick";
  return null;
}

/** Приклади довідника: назви, виробники й ціни вигадані. */
export const MOCK_MATERIALS: Material[] = (
  [
    ["boards", "ДСП Білий, 18 мм", "ПлитаПром", "м²", 310],
    ["boards", "ДСП Дуб, 18 мм", "ПлитаПром", "м²", 345],
    ["boards", "ДСП Графіт, 18 мм", "Деревпласт", "м²", 360],
    ["boards", "ДВП Білий, 3 мм", "Деревпласт", "м²", 95],
    ["edging", "Крайка ПВХ Біла, 0,8 мм", "Кромтех", "пог. м", 6],
    ["edging", "Крайка ПВХ Дуб, 2 мм", "Кромтех", "пог. м", 14],
    ["facade", "МДФ фарбований, 19 мм", "Фасад-Майстер", "м²", 2400],
    ["facade", "AGT панель глянець біла, 18 мм", "Фасад-Майстер", "лист", 5200],
    ["countertop", "Компакт-плита кремова, 12 мм", "Стільниця-Про", "м²", 4800],
    ["fasteners", "Конфірмат", "", "шт", 1.2],
    ["fasteners", "Шкант", "", "шт", 0.4],
    ["fasteners", "Шуруп 4×16", "", "шт", 0.3],
    ["hardware", "Напрямні прихованого монтажу, 450 мм", "Фурніс", "компл.", 720],
    ["hardware", "Завіси з доводчиком", "Фурніс", "шт", 95],
    ["hardware", "Ніжки 100 мм", "Метал-Дім", "шт", 22],
    ["hardware", "Штанга з кріпленням", "Метал-Дім", "шт", 180],
    ["hardware", "Сушка для посуду, 600 мм", "Фурніс", "компл.", 1350],
  ] as const
).map(([groupId, name, maker, unit, price], index) => ({
  id: `m${index}`,
  groupId,
  name,
  maker,
  unit,
  price,
  workId: workOf(name),
}));

/** Назва замовлення в плані й проблемах. */
export const projectLabel = (project: Pick<Project, "number" | "client" | "product">) =>
  `№${project.number} · ${project.client} · ${project.product}`;

const rows = (id: string, list: [groupId: string, name: string, quantity: number, unit: string][]): SpecRow[] =>
  list.map(([groupId, name, quantity, unit], index) => ({ id: `${id}-s${index}`, groupId, name, quantity, unit }));

type ProjectDraft = Omit<Project, "estimate" | "extras" | "clientId" | "clientPrice" | "managerId" | "adminEditedOn">;

/** Вартість, яку менеджер назвав клієнтові (вигадана, трохи вища за розрахункову). */
const MOCK_CLIENT_PRICES: Record<string, number> = {
  kukhnya: 110000,
  shafa: 30000,
  peredpokiy: 8800,
  garderobna: 16500,
  tumba: 6500,
  komod: 9000,
};

/** Кошторис прикладу: що менеджер заклав до детальної розробки. Кількості трохи інші, ніж у конструктора. */
const MOCK_ESTIMATES: Record<string, [groupId: string, name: string, quantity: number, unit: string][]> = {
  garderobna: [
    ["boards", "ДСП Білий, 18 мм", 16, "м²"],
    ["boards", "ДВП Білий, 3 мм", 5, "м²"],
    ["edging", "Крайка ПВХ Біла, 0,8 мм", 70, "пог. м"],
    ["fasteners", "Конфірмат", 200, "шт"],
    ["hardware", "Штанга з кріпленням", 4, "шт"],
  ],
  tumba: [
    ["boards", "ДСП Графіт, 18 мм", 3.5, "м²"],
    ["edging", "Крайка ПВХ Дуб, 2 мм", 14, "пог. м"],
    ["hardware", "Напрямні прихованого монтажу, 450 мм", 2, "компл."],
  ],
  komod: [
    ["boards", "ДСП Дуб, 18 мм", 4, "м²"],
    ["edging", "Крайка ПВХ Дуб, 2 мм", 22, "пог. м"],
    ["hardware", "Напрямні прихованого монтажу, 450 мм", 4, "компл."],
  ],
};
const MOCK_EXTRAS: Record<string, [name: string, amount: number][]> = {
  kukhnya: [["Силікон, герметик", 350], ["Доставка", 1500]],
  garderobna: [["Доставка", 1200]],
};
/** Замовники прикладу вигадані: телефони з нулями, вулиці неіснуючі. */
export const MOCK_CLIENTS: Client[] = [
  { id: "c-koval", name: "Коваль", phone: "067 000 00 01", address: "м. Київ, вул. Прикладна, 12, кв. 45", floor: 5 },
  { id: "c-tkachenko", name: "Ткаченко", phone: "050 000 00 02", address: "м. Бровари, вул. Умовна, 3, кв. 8", floor: 2 },
  { id: "c-lytvyn", name: "Литвин", phone: "063 000 00 03", address: "м. Київ, просп. Вигаданий, 101, кв. 17", floor: 3 },
  { id: "c-moroz", name: "Мороз", phone: "097 000 00 04", address: "м. Ірпінь, вул. Тестова, 5, кв. 90", floor: 9 },
  { id: "c-bondar", name: "Бондар", phone: "066 000 00 05", address: "с. Зразкове, вул. Садова, 7", floor: null },
];

/** Кошторис зі специфікації прикладу: менеджер заклав із запасом (округлено вгору). */
const roughly = (id: string, spec: SpecRow[]): SpecRow[] =>
  spec.map((row, index) => ({
    ...row,
    id: `${id}-e${index}`,
    quantity: row.quantity === null ? null : row.unit === "м²" ? Math.ceil(row.quantity * 1.1) : Math.ceil(row.quantity * 1.05),
  }));

function withEstimate(project: ProjectDraft): Project {
  const listed = MOCK_ESTIMATES[project.id];
  return {
    ...project,
    estimate: listed ? rows(`${project.id}-e`, listed) : roughly(project.id, project.spec),
    extras: (MOCK_EXTRAS[project.id] ?? []).map(([name, amount], index) => ({ id: `${project.id}-x${index}`, name, amount })),
    clientId: MOCK_CLIENTS.find((client) => client.name === project.client)?.id ?? "",
    clientPrice: MOCK_CLIENT_PRICES[project.id] ?? null,
    managerId: "", // підставляється разом із людьми прикладу
    adminEditedOn: null,
  };
}

/** Приклади. Дати рахуються від понеділка поточного тижня. */
export function mockProjects(week: string): Project[] {
  return mockDrafts(week).map(withEstimate);
}

function mockDrafts(week: string): ProjectDraft[] {
  const day = (offset: number) => addDays(week, offset);
  const paid = (id: string, ...list: [offset: number, amount: number][]) =>
    list.map(([offset, amount], index) => ({ id: `${id}-${index}`, date: day(offset), amount }));

  return [
    {
      id: "kukhnya",
      number: "241",
      client: "Коваль",
      product: "Кухня кутова",
      acceptedOn: day(-35),
      dueOn: day(16),
      payments: paid("kukhnya", [-35, 40000]),
      spec: rows("kukhnya", [
        ["boards", "ДСП Білий, 18 мм", 14.6, "м²"],
        ["boards", "ДВП Білий, 3 мм", 4.2, "м²"],
        ["edging", "Крайка ПВХ Біла, 0,8 мм", 62, "пог. м"],
        ["facade", "МДФ фарбований, 19 мм", 7.8, "м²"],
        ["countertop", "Компакт-плита кремова, 12 мм", 3.4, "м²"],
        ["fasteners", "Конфірмат", 180, "шт"],
        ["fasteners", "Шкант", 84, "шт"],
        ["hardware", "Напрямні прихованого монтажу, 450 мм", 10, "компл."],
        ["hardware", "Завіси з доводчиком", 14, "шт"],
        ["hardware", "Ніжки 100 мм", 32, "шт"],
      ]),
    },
    {
      id: "shafa",
      number: "242",
      client: "Ткаченко",
      product: "Шафа в спальню",
      acceptedOn: day(-21),
      dueOn: day(23),
      payments: paid("shafa", [-21, 10000]),
      spec: rows("shafa", [
        ["boards", "ДСП Дуб, 18 мм", 9.2, "м²"],
        ["boards", "ДВП Білий, 3 мм", 2.8, "м²"],
        ["facade", "МДФ фарбований, 19 мм", 3.1, "м²"],
        ["fasteners", "Конфірмат", 48, "шт"],
        ["hardware", "Завіси з доводчиком", 9, "шт"],
        ["hardware", "Штанга з кріпленням", 2, "шт"],
      ]),
    },
    {
      id: "peredpokiy",
      number: "239",
      client: "Литвин",
      product: "Передпокій",
      acceptedOn: day(-42),
      dueOn: day(-1),
      payments: paid("peredpokiy", [-42, 3000], [-7, 2000]),
      spec: rows("peredpokiy", [
        ["boards", "ДСП Дуб, 18 мм", 6.4, "м²"],
        ["boards", "ДВП Білий, 3 мм", 1.5, "м²"],
        ["edging", "Крайка ПВХ Дуб, 2 мм", 28, "пог. м"],
        ["fasteners", "Конфірмат", 32, "шт"],
        ["hardware", "Завіси з доводчиком", 6, "шт"],
      ]),
    },
    {
      id: "garderobna",
      number: "240",
      client: "Мороз",
      product: "Гардеробна",
      acceptedOn: day(-40),
      dueOn: day(9),
      payments: paid("garderobna", [-40, 5000]),
      spec: [],
    },
    {
      id: "tumba",
      number: "243",
      client: "Коваль",
      product: "Тумба під ТВ",
      acceptedOn: day(-3),
      dueOn: day(30),
      payments: paid("tumba", [-3, 3000]),
      spec: [],
    },
    {
      id: "komod",
      number: "238",
      client: "Бондар",
      product: "Комод",
      acceptedOn: day(-30),
      dueOn: day(6),
      payments: paid("komod", [-30, 6000]),
      spec: [],
    },
  ];
}

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
  { id: "w-cut-chip", name: "Порізка ДСП", unit: "лист", stageId: "cnc", price: 230 },
  { id: "w-cut-hdf", name: "Порізка ДВП", unit: "лист", stageId: "cnc", price: 90 },
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

/** `final` — доплату внесено після завершення виробництва (аванс до передачі його не має). */
export type Payment = { id: string; date: string; amount: number; final?: boolean };

/** Додаткові витрати в кошторисі: силікон, доставка тощо. */
export type Extra = { id: string; name: string; amount: number };

/**
 * Зміна проекту після внесення авансу: що було й що стало, хто й коли змінив.
 * key — що саме змінено (поле, рядок кошторису, витрата): зміни того самого за день зливаються в один запис.
 */
export type ChangeNote = { id: string; date: string; author: string; key: string; label: string; from: string; to: string };

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
  changes: ChangeNote[]; // зміни після авансу, щоб погодити їх із замовником
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

/** Виробники матеріалів прикладу. */
export const MOCK_MAKERS = ["Kronospan", "Hranipex", "Muller"];

/** Яка робота в прикладі прив'язана до матеріалу. Крайка тонша за 1 мм — «0,8 мм», товща — «2 мм». */
function workOf(name: string) {
  if (name.startsWith("ДСП")) return "w-cut-chip";
  if (name.startsWith("ДВП")) return "w-cut-hdf";
  if (name.startsWith("МДФ")) return "w-cut-mdf";
  if (name.startsWith("Крайка")) return name.includes("×0,") ? "w-edge-thin" : "w-edge-thick";
  return null;
}

/**
 * Приклади довідника: позиції й роздрібні ціни з каталогу viyar.ua на 11.11.2026, округлено.
 * ДСП і ДВП — за лист 2800×2070 (5,796 м²); МДФ — за м² із ціни листа 2800×1220 (3,416 м²);
 * стільниці — за пог. м із ціни 4,1 м.
 */
export const MOCK_MATERIALS: Material[] = (
  [
    ["boards", "ДСП Kronospan 0110 SM Білий корпусний, 18 мм", "Kronospan", "лист", 3834.3],
    ["boards", "ДСП Kronospan 0110 SM Білий корпусний, 16 мм", "Kronospan", "лист", 3662.64],
    ["boards", "ДСП Kronospan 0164 PE Антрацит, 18 мм", "Kronospan", "лист", 3960.48],
    ["boards", "ДСП Kronospan 3025 PR Дуб Сонома світлий, 18 мм", "Kronospan", "лист", 3899.94],
    ["boards", "ДСП Kronospan K003 PW Дуб Крафт золотий, 18 мм", "Kronospan", "лист", 3960.48],
    ["boards", "ДСП Kronospan K001 PW Дуб Крафт білий, 18 мм", "Kronospan", "лист", 4142.46],
    ["boards", "ДСП Kronospan 5981 BS Кашемір, 18 мм", "Kronospan", "лист", 3960.48],
    ["boards", "ДВП (ЛХДФ) Kronospan 0110 PE Білий, 3 мм", "Kronospan", "лист", 1235.34],
    ["edging", "Крайка ПВХ 0110 SM Білий, 21×0,8 мм", "", "пог. м", 19.74],
    ["edging", "Крайка ПВХ Біла, 22×1,8 мм", "Hranipex", "пог. м", 38.34],
    ["edging", "Крайка ПВХ 0164 PE Антрацит, 21×0,8 мм", "", "пог. м", 19.74],
    ["edging", "Крайка ПВХ 3025 Дуб Сонома світлий, 21×0,6 мм", "", "пог. м", 14.16],
    ["edging", "Крайка ПВХ K003 Дуб Крафт золотий, 21×0,8 мм", "", "пог. м", 21.66],
    ["facade", "МДФ Kronospan Feelness 5981 Кашемір Ultra Matt, 18 мм", "Kronospan", "м²", 2689],
    ["facade", "МДФ Kronospan Feelness 8685 Білий сніг Ultra Matt, 18 мм", "Kronospan", "м²", 2599],
    ["countertop", "Стільниця Kronospan K201 RS Бетон темно-сірий, 600×38 мм", "Kronospan", "пог. м", 1650],
    ["countertop", "Стільниця Kronospan K349 RT Шовковий камінь, 635×38 мм", "Kronospan", "пог. м", 1767],
    ["countertop", "Стільниця Kronospan K003 FP Дуб Крафт золотий, 635×38 мм", "Kronospan", "пог. м", 1767],
    ["countertop", "Стільниця Kronospan K551 SU Калакатта Олімпус, 900×38 мм", "Kronospan", "пог. м", 2686],
    ["fasteners", "Конфірмат Muller 7×50 мм", "Muller", "шт", 2.18],
    ["fasteners", "Шкант бук 8×30 мм", "Muller", "шт", 0.4],
    ["hardware", "Завіса Clip-On 105° накладна з дотягувачем 3D, Profi Line", "Muller", "шт", 72.12],
    ["hardware", "Завіса Clip-On 105° напівнакладна з дотягувачем 3D, Profi Line", "Muller", "шт", 74.28],
    ["hardware", "Завіса Clip-On 105° внутрішня з дотягувачем 3D, Profi Line", "Muller", "шт", 74.28],
    ["hardware", "Завіса Clip-On 45° кутова з дотягувачем 3D, Profi Line", "Muller", "шт", 126.3],
    ["hardware", "Завіса Clip-On 105° накладна з дотягувачем", "Muller", "шт", 37.44],
    ["hardware", "Напрямні прихованого монтажу SC 450 мм 3D, Profi Line", "Muller", "компл.", 638.04],
    ["hardware", "Напрямні прихованого монтажу SC 500 мм 3D, Profi Line", "Muller", "компл.", 662.4],
    ["hardware", "Напрямні прихованого монтажу SC 450 мм 3D", "Muller", "компл.", 550.62],
    ["hardware", "Напрямні прихованого монтажу SC 350 мм 3D", "Muller", "компл.", 486.36],
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

type ProjectDraft = Omit<Project, "estimate" | "extras" | "clientId" | "clientPrice" | "managerId" | "adminEditedOn" | "changes">;

/** Вартість, яку менеджер назвав клієнтові (вигадана, трохи вища за розрахункову). */
const MOCK_CLIENT_PRICES: Record<string, number> = {
  kukhnya: 108000,
  shafa: 39500,
  peredpokiy: 20500,
  garderobna: 32000,
  tumba: 11800,
  komod: 13500,
  kupe: 42000,
};

/** Кошторис прикладу: що менеджер заклав до детальної розробки. Кількості трохи інші, ніж у конструктора. */
const MOCK_ESTIMATES: Record<string, [groupId: string, name: string, quantity: number, unit: string][]> = {
  kupe: [
    ["boards", "ДСП Kronospan K003 PW Дуб Крафт золотий, 18 мм", 4, "лист"],
    ["boards", "ДВП (ЛХДФ) Kronospan 0110 PE Білий, 3 мм", 1, "лист"],
    ["edging", "Крайка ПВХ K003 Дуб Крафт золотий, 21×0,8 мм", 60, "пог. м"],
    ["fasteners", "Конфірмат Muller 7×50 мм", 120, "шт"],
    ["hardware", "Напрямні прихованого монтажу SC 450 мм 3D", 3, "компл."],
  ],
  garderobna: [
    ["boards", "ДСП Kronospan 0110 SM Білий корпусний, 18 мм", 3, "лист"],
    ["boards", "ДВП (ЛХДФ) Kronospan 0110 PE Білий, 3 мм", 1, "лист"],
    ["edging", "Крайка ПВХ 0110 SM Білий, 21×0,8 мм", 70, "пог. м"],
    ["fasteners", "Конфірмат Muller 7×50 мм", 200, "шт"],
  ],
  tumba: [
    ["boards", "ДСП Kronospan 0164 PE Антрацит, 18 мм", 1, "лист"],
    ["edging", "Крайка ПВХ 0164 PE Антрацит, 21×0,8 мм", 14, "пог. м"],
    ["hardware", "Напрямні прихованого монтажу SC 450 мм 3D, Profi Line", 2, "компл."],
  ],
  komod: [
    ["boards", "ДСП Kronospan 3025 PR Дуб Сонома світлий, 18 мм", 1, "лист"],
    ["edging", "Крайка ПВХ 3025 Дуб Сонома світлий, 21×0,6 мм", 22, "пог. м"],
    ["hardware", "Напрямні прихованого монтажу SC 450 мм 3D, Profi Line", 4, "компл."],
  ],
};
/** Приклад: після авансу менеджер додав третій ящик і підняв вартість для клієнта. */
const MOCK_CHANGES: Record<string, ChangeNote[]> = {
  kupe: [
    { id: "kupe-c0", date: "", author: "Менеджер", key: "row:kupe-e-s4", label: "Кошторис: Напрямні прихованого монтажу SC 450 мм 3D", from: "2 компл.", to: "3 компл." },
    { id: "kupe-c1", date: "", author: "Менеджер", key: "clientPrice", label: "Вартість для клієнта", from: "40 000 грн", to: "42 000 грн" },
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

/** Кошторис зі специфікації прикладу: менеджер заклав із запасом (округлено вгору); листи ДСП і ДВП конструктор уже рахує цілими. */
const roughly = (id: string, spec: SpecRow[]): SpecRow[] =>
  spec.map((row, index) => ({
    ...row,
    id: `${id}-e${index}`,
    quantity: row.quantity === null ? null : row.unit === "лист" ? row.quantity : row.unit === "м²" ? Math.ceil(row.quantity * 1.1) : Math.ceil(row.quantity * 1.05),
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
    changes: MOCK_CHANGES[project.id] ?? [],
  };
}

/** Приклади. Дати рахуються від понеділка поточного тижня. */
export function mockProjects(week: string): Project[] {
  // Зміни прикладу — наступного дня після авансу.
  return mockDrafts(week)
    .map(withEstimate)
    .map((project) => ({ ...project, changes: project.changes.map((change) => ({ ...change, date: addDays(week, 1) })) }));
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
        ["boards", "ДСП Kronospan 0110 SM Білий корпусний, 18 мм", 3, "лист"],
        ["boards", "ДВП (ЛХДФ) Kronospan 0110 PE Білий, 3 мм", 1, "лист"],
        ["edging", "Крайка ПВХ 0110 SM Білий, 21×0,8 мм", 62, "пог. м"],
        ["facade", "МДФ Kronospan Feelness 5981 Кашемір Ultra Matt, 18 мм", 7.8, "м²"],
        ["countertop", "Стільниця Kronospan K349 RT Шовковий камінь, 635×38 мм", 3.4, "пог. м"],
        ["fasteners", "Конфірмат Muller 7×50 мм", 180, "шт"],
        ["fasteners", "Шкант бук 8×30 мм", 84, "шт"],
        ["hardware", "Напрямні прихованого монтажу SC 450 мм 3D, Profi Line", 10, "компл."],
        ["hardware", "Завіса Clip-On 105° накладна з дотягувачем 3D, Profi Line", 14, "шт"],
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
        ["boards", "ДСП Kronospan 3025 PR Дуб Сонома світлий, 18 мм", 2, "лист"],
        ["boards", "ДВП (ЛХДФ) Kronospan 0110 PE Білий, 3 мм", 1, "лист"],
        ["facade", "МДФ Kronospan Feelness 5981 Кашемір Ultra Matt, 18 мм", 3.1, "м²"],
        ["fasteners", "Конфірмат Muller 7×50 мм", 48, "шт"],
        ["hardware", "Завіса Clip-On 105° накладна з дотягувачем 3D, Profi Line", 9, "шт"],
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
        ["boards", "ДСП Kronospan 3025 PR Дуб Сонома світлий, 18 мм", 2, "лист"],
        ["boards", "ДВП (ЛХДФ) Kronospan 0110 PE Білий, 3 мм", 1, "лист"],
        ["edging", "Крайка ПВХ 3025 Дуб Сонома світлий, 21×0,6 мм", 28, "пог. м"],
        ["fasteners", "Конфірмат Muller 7×50 мм", 32, "шт"],
        ["hardware", "Завіса Clip-On 105° накладна з дотягувачем 3D, Profi Line", 6, "шт"],
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
    {
      // Аванс уже внесено, прийом ще не завершено: менеджер ще може змінювати проект.
      id: "kupe",
      number: "244",
      client: "Мороз",
      product: "Шафа-купе",
      acceptedOn: day(0),
      dueOn: day(35),
      payments: paid("kupe", [0, 15000]),
      spec: [],
    },
  ];
}

// Модель даних панелі: типи й незмінні довідкові константи. Без сховища й без вигаданих даних.

/**
 * Як нараховується зарплата за етап: не нараховується, відсоток від вартості всіх матеріалів замовлення
 * або за роботами (порізка, поклейка крайки) — кількість матеріалу × ціна роботи.
 * handover — друга частина відсотка, яка нараховується за здачу (останній етап завершено).
 * Використовується лише для першого етапу (менеджер: прийом замовлення і здача).
 */
export type StagePay = { kind: "none" } | { kind: "percent"; percent: number; handover?: number } | { kind: "works" };

export type Stage = { id: string; label: string; hint: string; createsSpec: boolean; pay: StagePay };

export type StageId = string;

/** Робота, за яку платять від кількості матеріалу: «Порізка ДСП», «Поклейка крайки». Ціна — грн за одиницю. */
export type Work = { id: string; name: string; unit: string; stageId: StageId; price: number | null };

export type StageStatus = "todo" | "wip" | "done";

/** Група специфікації. Одиниць у групи немає: одиницю вибирають у кожному рядку. */
export type SpecGroup = { id: string; name: string };

/** Стан закупки рядка специфікації: замовлено або куплено (порожньо — ще ні). */
export type PurchaseStatus = "ordered" | "bought";

/** note — довільна примітка до рядка для уточнень (колір кромки, розмір, у кого замовити тощо). */
export type SpecRow = { id: string; groupId: string; name: string; quantity: number | null; unit: string; note?: string; purchase?: PurchaseStatus };

/** `final` — доплату внесено після завершення виробництва (аванс до передачі його не має). */
export type Payment = { id: string; date: string; amount: number; final?: boolean };

/** Додаткові витрати в кошторисі: силікон, доставка тощо. */
export type Extra = { id: string; name: string; amount: number };

/**
 * Зміна проекту після внесення авансу: що було й що стало, хто й коли змінив.
 * key — що саме змінено (поле, рядок кошторису, витрата): зміни того самого за день зливаються в один запис.
 */
export type ChangeNote = { id: string; date: string; author: string; key: string; label: string; from: string; to: string };

/**
 * Відмова клієнта до авансу (рішення користувача 2026-11-26): проект іде з «Тижня» й «В роботі» до «Відмов».
 * reasonId — причина зі списку адміністратора (null — без причини або причину прибрали); note — коментар менеджера.
 */
export type Refusal = { on: string; reasonId: string | null; note: string; by: string };

/** Замовник: окремий запис, проекти посилаються на нього. Поверх — для заноски. */
export type Client = { id: string; name: string; phone: string; address: string };

/** Загальні відомості про замовлення для бланка прийому: що домовились із замовником. */
export type OrderDetails = { facade: string; hardware: string; appliances: string; walls: string; notes: string };

/** Поля відомостей у порядку показу. kitchen — лише для кухонь (техніка). */
export const DETAIL_FIELDS: { key: keyof OrderDetails; label: string; placeholder: string; kitchen?: boolean }[] = [
  { key: "facade", label: "Фасад", placeholder: "Матеріал, колір, фрезерування, ручки…" },
  { key: "hardware", label: "Фурнітура", placeholder: "Завіси, напрямні, підйомники, виробник…" },
  { key: "appliances", label: "Техніка", placeholder: "Модель і розміри: духовка, варильна, витяжка, мийка, посудомийка, холодильник…", kitchen: true },
  { key: "walls", label: "Стіни й підготовка до монтажу", placeholder: "Рівність стін, кути, що має зробити замовник до монтажу…" },
  { key: "notes", label: "Особливі примітки", placeholder: "Усе, що треба врахувати" },
];

export const EMPTY_DETAILS: OrderDetails = { facade: "", hardware: "", appliances: "", walls: "", notes: "" };

/** Кухня за назвою виробу: для неї в бланку є техніка. */
export const isKitchen = (product: string) => /кух/i.test(product);

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
  details: OrderDetails; // загальні відомості для бланка прийому
  floor: number | null; // поверх для заноски: в замовленні, бо один замовник може замовляти на різні адреси
  refusal: Refusal | null; // клієнт відмовився (лише до авансу); null — проект живий
  frozen: PriceSnapshot | null; // ціни, зафіксовані з першого запису кошторису (prices.ts); порожній кошторис — null
};

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
  /** Артикул постачальника або присвоєний сайтом («М-0001»), якщо свій не вписали. Унікальний. */
  article: string;
};

/** Назва замовлення в плані й проблемах. */
export const projectLabel = (project: Pick<Project, "number" | "client" | "product">) =>
  `№${project.number} · ${project.client} · ${project.product}`;

/**
 * Знімок цін проекту: матеріали кошторису (копії з довідника), їхні роботи,
 * оплата кожного етапу й налаштування вартості. on — день фіксації.
 */
export type PriceSnapshot = {
  on: string;
  materials: Material[];
  works: Work[];
  pay: Record<string, StagePay>;
  pricing: Pricing;
};

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
  role: "admin" | "manager" | "worker" | "buyer"; // buyer — закупівельник: закупки й довідник матеріалів
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

/** Причина відмови клієнта: список веде адміністратор. */
export type RefusalReason = { id: string; name: string };

/** Виплата працівнику (аванс чи зарплата): вносить адміністратор. Залишок = нараховане − виплачене. */
export type Payout = { id: string; personId: string; date: string; amount: number; note: string };

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
  refusalReasons: RefusalReason[];
  payouts: Payout[];
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

/** Таблиця рядків проекту: специфікація конструктора або кошторис менеджера. Вони не пов'язані. */
export type RowList = "spec" | "estimate";

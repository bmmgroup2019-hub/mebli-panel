// Сховище сайту в браузері: дані з бази через сервер сайту (/api/data), хуки для сторінок і вхід (/api/login).
// Дії — actions.ts: кожна одразу змінює дані тут, а потім іде на сервер (/api/action), який перевіряє права,
// виконує ту саму дію над даними бази й повертає остаточний результат.
// Модель — model.ts, правила (хто що бачить, статуси) — rules.ts, права на дії — permissions.ts.
import { useSyncExternalStore } from "react";
import { setActionSink, setActionTarget } from "./actions";
import { emptyData } from "./db-map";
import type { Project, WeekData } from "./model";
import { projectAccess, specAccess } from "./rules";

export * from "./actions";

let data: WeekData | null = null;
/** Версія даних, яку показує сторінка: за нею видно, що хтось інший щось змінив. */
let version: number | null = null;
let loading = false;
/** Текст помилки зв'язку з базою або відмови сервера, або null. */
let problem: string | null = null;
/** Стан зв'язку: offline — сервер недоступний; waiting — скільки змін ще не відправлено. */
let sync = { offline: false, waiting: 0 };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const loggedOut = (): WeekData => ({ ...emptyData(), sessionId: null });

function setSync(offline: boolean) {
  if (sync.offline !== offline || sync.waiting !== outbox.length) sync = { offline, waiting: outbox.length };
}

/** Дані з сервера. Без входу сервер їх не віддає: тоді лише форма входу. */
async function refresh() {
  const response = await fetch("/api/data", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  // Поки чекали, тут зробили зміни, що ще не дійшли до сервера: їх не затираємо, свіжі дані прийдуть із відповіддю.
  if (outbox.length > 0) return;
  data = body.data ? { ...(body.data as WeekData), sessionId: body.me } : loggedOut();
  version = body.version ?? null;
  notify();
}

async function load() {
  if (loading || data) return;
  loading = true;
  try {
    await refresh();
  } catch (error) {
    problem = `Немає зв'язку з базою: ${message(error)}`;
    notify();
  } finally {
    loading = false;
  }
}

// Дії змінюють дані цього браузера. Паролі тут не лишаються: вони йдуть лише на сервер (у Supabase Auth).
setActionTarget({
  get: () => {
    if (!data) throw new Error("Дані ще не завантажено");
    return data;
  },
  set: (next) => {
    data = { ...next, people: next.people.map((p) => (p.password ? { ...p, password: "" } : p)) };
    notify();
  },
});

/**
 * Черга змін для сервера, у тому порядку, в якому їх зробили. Немає зв'язку — зміна лишається тут
 * (на екрані її вже видно) і відправляється знову, щойно зв'язок повернеться. Номер запиту однаковий
 * при кожній спробі, тож якщо сервер уже виконав дію, а відповідь загубилась, повтору не буде.
 */
type Outgoing = { requestId: string; body: string };
const outbox: Outgoing[] = [];
let sending = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;

/** Сервер не відповів: немає інтернету або Render саме прокидається. */
const unreachable = (status: number) => status === 502 || status === 503 || status === 504;

function retryLater() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30000);
}

async function flush() {
  if (sending) return;
  sending = true;
  try {
    while (outbox.length > 0) {
      const next = outbox[0];
      let response: Response;
      try {
        response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: next.body });
      } catch {
        response = new Response(null, { status: 503 });
      }
      if (unreachable(response.status)) {
        setSync(true);
        notify();
        retryLater();
        return;
      }
      retryDelay = 2000;
      outbox.shift();
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        // Сесія завершилась (новий пароль, людину прибрали, пів року без входу): показуємо вхід.
        outbox.length = 0;
        data = loggedOut();
        problem = "Сесія завершилась, останню зміну не збережено: увійдіть знову.";
      } else if (!response.ok) {
        problem = response.status === 403 ? result.error : `Зміну не збережено в базі: ${result.error ?? response.statusText}. Перезавантажте сторінку.`;
      }
      // Остаточний стан — від сервера (з чужими змінами), якщо тут не чекають відправлення інші зміни.
      if (result.data && outbox.length === 0) {
        data = { ...(result.data as WeekData), sessionId: result.me };
        version = result.version ?? version;
      }
      // Людини вже немає (наприклад, після «Повернути приклади»): вхід заново.
      if (response.ok && !result.me) data = loggedOut();
      setSync(false);
      notify();
    }
  } finally {
    sending = false;
  }
}

setActionSink((name, args, ids, changed) => {
  // Нічого не змінилось (дію відхилено ще тут) — серверу нема що робити.
  if (!changed) return;
  // JSON губить undefined у масиві: передаємо, які аргументи пропущено.
  const skipped = args.flatMap((arg, index) => (arg === undefined ? [index] : []));
  const requestId = crypto.randomUUID();
  outbox.push({ requestId, body: JSON.stringify({ name, args, skipped, ids, requestId }) });
  setSync(sync.offline);
  notify();
  void flush();
});

/** Раз на кілька секунд — чи не змінив хтось дані. Лише номер версії, без самих даних. */
const POLL_MS = 10000;
let polling: ReturnType<typeof setInterval> | null = null;

async function poll() {
  if (!data?.sessionId || outbox.length > 0 || loading || document.visibilityState !== "visible") return;
  try {
    const response = await fetch("/api/version", { cache: "no-store" });
    if (unreachable(response.status)) throw new Error("немає зв'язку");
    if (response.status === 401) {
      data = loggedOut();
      problem = "Сесія завершилась: увійдіть знову.";
      notify();
      return;
    }
    const body = await response.json();
    const wasOffline = sync.offline;
    setSync(false);
    if (body.version !== version) await refresh();
    else if (wasOffline) notify();
  } catch {
    if (!sync.offline) {
      setSync(true);
      notify();
    }
  }
}

function startSync() {
  if (polling || typeof window === "undefined") return;
  polling = setInterval(() => void poll(), POLL_MS);
  // Повернулись на вкладку — одразу перевірити; повернувся інтернет — одразу відправити чергу.
  document.addEventListener("visibilitychange", () => void poll());
  window.addEventListener("online", () => {
    retryDelay = 2000;
    void flush();
    void poll();
  });
  // Закрити сторінку з невідправленими змінами — браузер перепитає.
  window.addEventListener("beforeunload", (event) => {
    if (outbox.length > 0) event.preventDefault();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startSync();
  void load();
  return () => listeners.delete(listener);
}

/** null, поки дані не прийшли з бази (і на сервері). */
export const useWeekData = () => useSyncExternalStore(subscribe, () => data, () => null);

/** Помилка зв'язку з базою або відмова сервера, або null. */
export const useDataProblem = () => useSyncExternalStore(subscribe, () => problem, () => null);

const NO_SYNC = { offline: false, waiting: 0 };
/** Зв'язок із сервером: чи він є і скільки змін чекають відправлення. */
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => sync, () => NO_SYNC);

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

/** true, якщо логін і пароль правильні. Перевіряє сервер (Supabase Auth), ставить cookie сесії, потім дає дані. */
export async function signIn(login: string, password: string) {
  const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  if (!body.personId) return false;
  problem = null;
  await refresh();
  return true;
}

/** Вихід: дані зі сторінки прибираються одразу, сервер прибирає cookie. Невідправлені зміни — лише з підтвердженням. */
export function signOut() {
  if (outbox.length > 0 && !window.confirm(`Ще не відправлено змін: ${outbox.length} (немає зв'язку). Якщо вийти зараз, вони пропадуть. Вийти?`)) return;
  outbox.length = 0;
  setSync(false);
  void fetch("/api/logout", { method: "POST" }).catch(() => undefined);
  data = loggedOut();
  version = null;
  notify();
}

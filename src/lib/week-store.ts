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
let loading = false;
/** Текст помилки зв'язку з базою або відмови сервера, або null. */
let problem: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Дані з сервера. Без входу сервер їх не віддає: тоді лише форма входу. */
async function refresh() {
  const response = await fetch("/api/data", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  data = body.data ? { ...(body.data as WeekData), sessionId: body.me } : { ...emptyData(), sessionId: null };
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

/** Дії йдуть на сервер по черзі, у тому порядку, в якому їх зробили. */
let queue = Promise.resolve();
let pending = 0;

setActionSink((name, args, ids, changed) => {
  // Нічого не змінилось (дію відхилено ще тут) — серверу нема що робити.
  if (!changed) return;
  // JSON губить undefined у масиві: передаємо, які аргументи пропущено.
  const skipped = args.flatMap((arg, index) => (arg === undefined ? [index] : []));
  const body = JSON.stringify({ name, args, skipped, ids });
  pending++;
  queue = queue.then(async () => {
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        // Сесія завершилась (новий пароль, людину прибрали, пів року без входу): показуємо вхід.
        data = { ...emptyData(), sessionId: null };
        problem = "Сесія завершилась, останню зміну не збережено: увійдіть знову.";
      } else if (!response.ok) {
        problem = response.status === 403 ? result.error : `Зміну не збережено в базі: ${result.error ?? response.statusText}. Перезавантажте сторінку.`;
      }
      // Остаточний стан — від сервера (з чужими змінами), якщо поки чекали, тут не зробили нових дій.
      if (result.data && pending === 1) data = { ...(result.data as WeekData), sessionId: result.me };
    } catch (error) {
      problem = `Зміну не збережено в базі: ${message(error)}. Перезавантажте сторінку.`;
    } finally {
      pending--;
      notify();
    }
  });
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

/** null, поки дані не прийшли з бази (і на сервері). */
export const useWeekData = () => useSyncExternalStore(subscribe, () => data, () => null);

/** Помилка зв'язку з базою або відмова сервера, або null. */
export const useDataProblem = () => useSyncExternalStore(subscribe, () => problem, () => null);

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

/** Вихід: дані зі сторінки прибираються одразу, сервер прибирає cookie. */
export function signOut() {
  // Після дій, що ще йдуть: інакше вони прийшли б уже без сесії.
  queue = queue.then(() => fetch("/api/logout", { method: "POST" })).then(() => undefined, () => undefined);
  data = { ...emptyData(), sessionId: null };
  notify();
}

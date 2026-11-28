// Виконання дії на сервері: свіжі дані з бази → перевірка прав → та сама дія, що в браузері → запис змін.
// Якщо поки рахували, базу змінив хтось інший, — усе спочатку з новими даними (чужі зміни не затираються).
import { isAction, runAction } from "../actions";
import { diffTables, emptyData, toDb } from "../db-map";
import type { WeekData } from "../model";
import { allowed } from "../permissions";
import { isIdLike } from "../util";
import { visibleData } from "../visibility";
import { hasPeople, loadData, saveChanges } from "./db";

const ATTEMPTS = 5;

/** Паролі з даних — окремо (у Supabase Auth), а самі дані — без них. */
function takePasswords(data: WeekData) {
  const passwords: Record<string, string> = {};
  for (const person of data.people) if (person.password) passwords[person.id] = person.password;
  return { passwords, data: { ...data, people: data.people.map((p) => (p.password ? { ...p, password: "" } : p)) } };
}

/** Усі id, які вже є в базі: нові записи не можуть їх зайняти (інакше підмінили б чужий запис). */
function usedIds(data: WeekData) {
  return new Set(Object.values(toDb(data)).flatMap((rows) => rows.map((row) => row.id)));
}

type Outcome =
  | { status: 200; data: WeekData | null; me: string | null }
  | { status: 400 | 401 | 403 | 409; data: WeekData | null; me: string | null; error: string };

export async function perform(me: string, name: string, args: unknown[], ids: unknown[]): Promise<Outcome> {
  if (!isAction(name)) return { status: 400, data: null, me, error: `Невідома дія: ${name}` };
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { version, data } = await loadData();
    const user = data.people.find((person) => person.id === me) ?? null;
    if (!user) return { status: 401, data: null, me: null, error: "Сесія завершилась: увійдіть знову." };
    // Людині — лише те, що їй можна бачити (visibility.ts).
    const shown = visibleData(data, user);
    if (!allowed(data, user, name, args)) {
      return { status: 403, data: shown, me, error: "Немає права на цю зміну: її скасовано, на екрані — дані з бази." };
    }
    const used = usedIds(data);
    if (!ids.every((id) => isIdLike(id) && !used.has(id as string))) {
      return { status: 400, data: shown, me, error: "Неправильні id нових записів." };
    }
    const { passwords, data: next } = takePasswords(runAction(data, me, name, args, ids as string[]));
    const changes = diffTables(toDb(data), toDb(next));
    if (changes.length === 0 && Object.keys(passwords).length === 0) return { status: 200, data: shown, me };
    const saved = await saveChanges(changes, passwords, version);
    if (saved === null) continue;
    // Людину могли прибрати (наприклад, «Повернути приклади»): тоді її сесії вже немає.
    const after = next.people.find((p) => p.id === me);
    return after ? { status: 200, data: visibleData(next, after), me } : { status: 200, data: null, me: null };
  }
  return { status: 409, data: null, me, error: "Базу саме змінюють інші: спробуйте ще раз." };
}

/** Порожня база (ще жодної людини) заповнюється вигаданими прикладами — без входу, бо входити ще нікому. */
export async function seedIfEmpty() {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (await hasPeople()) return;
    const { version, data } = await loadData();
    const { passwords, data: next } = takePasswords(runAction({ ...emptyData(), ...data }, null, "resetWeekData", [], []));
    if ((await saveChanges(diffTables(toDb(data), toDb(next)), passwords, version)) !== null) return;
  }
}

// Робота з базою Supabase. Лише для сервера сайту: тут секретний ключ, у браузер цей файл не потрапляє.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fromDb, TABLES, type DbChange } from "../db-map";
import type { WeekData } from "../model";

function env(name: "SUPABASE_URL" | "SUPABASE_SECRET_KEY" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Не задано ${name} у .env.local`);
  return value;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
let admin: SupabaseClient | null = null;

/** Клієнт із секретним ключем: бачить і змінює все. */
function db() {
  admin ??= createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), options);
  return admin;
}

/**
 * Supabase Auth потребує пошту й пароль від 6 символів. Пошта — технічна, від id людини (листів не буде);
 * до пароля додаємо приставку, щоб короткі паролі прикладів («1111») теж годились. Людина бачить лише свій логін і пароль.
 */
const authEmail = (personId: string) => `${personId.toLowerCase()}@people.mebli-panel.app`;
const authPassword = (password: string) => `lm-pw:${password}`;

export async function loadData(): Promise<{ version: number; data: WeekData }> {
  const { data, error } = await db().rpc("load_data");
  if (error) throw new Error(`load_data: ${error.message}`);
  return { version: Number(data.version), data: fromDb(data) };
}

/**
 * Записує зміни однією транзакцією, якщо в базі досі версія expected. Паролі — у Supabase Auth, після запису людей.
 * Повертає нову версію або null, якщо базу тим часом змінив хтось інший (тоді зміни не записано).
 */
export async function saveChanges(changes: DbChange[], passwords: Record<string, string>, expected: number) {
  for (const change of changes) {
    if (!TABLES.includes(change.table)) throw new Error(`Невідома таблиця: ${change.table}`);
  }
  // Облікові записи людей, яких прибирають, — щоб прибрати і їх.
  const removedPeople = changes.find((c) => c.table === "people")?.delete ?? [];
  const removedAuth = removedPeople.length ? await authIdsOf(removedPeople) : [];

  const { data, error } = await db().rpc("apply_changes", { expected, changes });
  if (error) throw new Error(`apply_changes: ${error.message}`);
  if (data === null) return null;
  const version = Number(data);

  for (const id of removedAuth) await db().auth.admin.deleteUser(id);
  for (const [personId, password] of Object.entries(passwords)) await setPassword(personId, password);
  return version;
}

async function authIdsOf(personIds: string[]) {
  const { data, error } = await db().from("people").select("auth_user_id").in("id", personIds);
  if (error) throw new Error(`people: ${error.message}`);
  return data.map((row) => row.auth_user_id as string | null).filter((id): id is string => Boolean(id));
}

/** Час (мс), з якого дійсні сесії людини, або null, якщо такої людини немає. */
export async function sessionsFrom(personId: string) {
  const { data, error } = await db().from("people").select("sessions_from").eq("id", personId).maybeSingle();
  if (error) throw new Error(`people: ${error.message}`);
  return data ? Date.parse(data.sessions_from) : null;
}

/** Чи є в базі хоч одна людина: порожню базу заповнюють прикладами ще до входу. */
export async function hasPeople() {
  const { count, error } = await db().from("people").select("id", { count: "exact", head: true });
  if (error) throw new Error(`people: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Новий пароль людини: обліковий запис Supabase Auth створюється, якщо його ще немає.
 * Змінений пароль завершує всі попередні входи людини.
 */
async function setPassword(personId: string, password: string) {
  const [authId] = await authIdsOf([personId]);
  if (authId) {
    const { error } = await db().auth.admin.updateUserById(authId, { password: authPassword(password) });
    if (error) throw new Error(`Пароль: ${error.message}`);
    const ended = await db().from("people").update({ sessions_from: new Date().toISOString() }).eq("id", personId);
    if (ended.error) throw new Error(`people: ${ended.error.message}`);
    return;
  }
  const created = await db().auth.admin.createUser({ email: authEmail(personId), password: authPassword(password), email_confirm: true });
  if (created.error) throw new Error(`Обліковий запис: ${created.error.message}`);
  const { error } = await db().from("people").update({ auth_user_id: created.data.user.id }).eq("id", personId);
  if (error) throw new Error(`people: ${error.message}`);
}

/** id людини, якщо логін і пароль правильні, інакше null. */
export async function checkLogin(login: string, password: string) {
  const { data, error } = await db().from("people").select("id, auth_user_id").ilike("login", login.replace(/[\\%_]/g, "\\$&"));
  if (error) throw new Error(`people: ${error.message}`);
  const person = data.find((row) => row.auth_user_id);
  if (!person) return null;
  // Окремий клієнт із публічним ключем: перевірка пароля не має змінювати серверний клієнт.
  const auth = createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), options);
  const { error: failed } = await auth.auth.signInWithPassword({ email: authEmail(person.id), password: authPassword(password) });
  return failed ? null : (person.id as string);
}

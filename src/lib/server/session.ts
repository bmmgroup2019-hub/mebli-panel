// Сесія входу: підписане cookie, яке браузер не може ні прочитати зі сторінки, ні підробити.
// У cookie — id людини й час входу; підпис — HMAC від секретного ключа сервера.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sessionsFrom } from "./db";

const COOKIE = "mebli-session";
/** Вхід пам'ятається пів року від останнього відкриття сайту, доки людина не натисне «Вийти». */
const MAX_AGE = 180 * 24 * 60 * 60;
/** Раз на добу cookie оновлюється, тож пів року рахується від останнього відкриття. */
const RENEW_AFTER = 24 * 60 * 60 * 1000;

function key() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Не задано SUPABASE_SECRET_KEY у .env.local");
  // Окремий ключ для підпису сесій, похідний від секретного: сам секретний ключ ніде не повторюється.
  return createHash("sha256").update(`mebli-session:${secret}`).digest();
}

const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

/** Поставити cookie входу. issued — час входу (мс). */
export async function startSession(personId: string, issued = Date.now()) {
  const payload = `${personId}.${issued}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * id людини, яка ввійшла, або null. Перевіряє підпис, строк, що людина ще є
 * і що після входу їй не змінювали пароль. Старе cookie оновлює.
 */
export async function currentPerson(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [personId, issuedText, signature] = value.split(".");
  if (!personId || !issuedText || !signature) return null;
  const expected = Buffer.from(sign(`${personId}.${issuedText}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const issued = Number(issuedText);
  if (!(issued > 0) || Date.now() - issued > MAX_AGE * 1000) return null;
  const from = await sessionsFrom(personId);
  if (from === null || issued < from) return null;
  if (Date.now() - issued > RENEW_AFTER) await startSession(personId);
  return personId;
}

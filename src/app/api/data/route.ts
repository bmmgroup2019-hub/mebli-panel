// Дані сайту: GET — усе одним знімком і хто ввійшов, POST — записати зміни (лише після входу).
// Права на окремі дані ще не перевіряються: це наступний крок підключення бази.
import { hasPeople, loadData, saveChanges } from "@/lib/server/db";
import { currentPerson, startSession } from "@/lib/server/session";
import type { DbChange } from "@/lib/db-map";

const failure = (error: unknown) =>
  Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });

export async function GET() {
  try {
    const me = await currentPerson();
    return Response.json({ ...(await loadData()), me });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const me = await currentPerson();
    // Без входу можна лише заповнити порожню базу прикладами.
    if (!me && (await hasPeople())) return Response.json({ error: "Сесія завершилась: увійдіть знову." }, { status: 401 });
    const body = (await request.json()) as { changes?: DbChange[]; passwords?: Record<string, string> };
    const passwords = body.passwords ?? {};
    const version = await saveChanges(body.changes ?? [], passwords);
    // Людина змінила свій пароль: інші її входи завершено, а цей лишається.
    if (me && passwords[me]) await startSession(me, Date.now() + 1);
    return Response.json({ version });
  } catch (error) {
    return failure(error);
  }
}

// Дані сайту одним знімком — лише тому, хто ввійшов. Зміни — через /api/action.
// Порожню базу сервер спершу заповнює вигаданими прикладами.
import { loadData } from "@/lib/server/db";
import { seedIfEmpty } from "@/lib/server/perform";
import { currentPerson } from "@/lib/server/session";

export async function GET() {
  try {
    await seedIfEmpty();
    const me = await currentPerson();
    if (!me) return Response.json({ me: null, data: null });
    const { version, data } = await loadData();
    return Response.json({ me, version, data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

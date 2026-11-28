// Дані сайту: GET — усе одним знімком, POST — записати зміни.
// Крок 1 підключення бази: права ще не перевіряються (лише тестова база з вигаданими даними).
import { loadData, saveChanges } from "@/lib/server/db";
import type { DbChange } from "@/lib/db-map";

const failure = (error: unknown) =>
  Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });

export async function GET(request: Request) {
  void request; // запит до бази щоразу, без кешу
  try {
    return Response.json(await loadData());
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { changes?: DbChange[]; passwords?: Record<string, string> };
    const version = await saveChanges(body.changes ?? [], body.passwords ?? {});
    return Response.json({ version });
  } catch (error) {
    return failure(error);
  }
}

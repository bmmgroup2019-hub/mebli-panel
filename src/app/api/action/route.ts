// Дія зі сторінки: сервер перевіряє права, виконує ту саму дію над даними бази й повертає остаточні дані.
import { perform } from "@/lib/server/perform";
import { currentPerson } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    const me = await currentPerson();
    if (!me) return Response.json({ error: "Сесія завершилась: увійдіть знову." }, { status: 401 });
    const body = (await request.json()) as { name?: unknown; args?: unknown; skipped?: unknown; ids?: unknown; requestId?: unknown };
    if (
      typeof body.name !== "string" || !Array.isArray(body.args) || !Array.isArray(body.ids) ||
      typeof body.requestId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)
    ) {
      return Response.json({ error: "Неправильний запит." }, { status: 400 });
    }
    // Пропущені аргументи (undefined) JSON передає як null: повертаємо, щоб спрацювали значення за замовчуванням.
    const skipped = new Set(Array.isArray(body.skipped) ? body.skipped : []);
    const args = body.args.map((arg, index) => (skipped.has(index) ? undefined : arg));
    const { status, ...result } = await perform(me, body.name, args, body.ids, body.requestId);
    return Response.json(result, { status });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

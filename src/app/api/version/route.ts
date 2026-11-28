// Номер версії даних — браузер раз на кілька секунд питає його, щоб побачити чужі зміни без перезавантаження.
// Лише після входу; самих даних тут немає, тож запит легкий.
import { currentVersion } from "@/lib/server/db";
import { currentPerson } from "@/lib/server/session";

export async function GET() {
  try {
    const me = await currentPerson();
    if (!me) return Response.json({ me: null }, { status: 401 });
    return Response.json({ me, version: await currentVersion() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

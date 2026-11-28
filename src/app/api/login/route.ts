// Вхід: логін і пароль перевіряє Supabase Auth, сервер ставить cookie сесії. Повертає id людини.
import { checkLogin } from "@/lib/server/db";
import { startSession } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    const { login, password } = (await request.json()) as { login?: string; password?: string };
    if (!login || !password) return Response.json({ personId: null });
    const personId = await checkLogin(login.trim(), password);
    if (personId) await startSession(personId);
    return Response.json({ personId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

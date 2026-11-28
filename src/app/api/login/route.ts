// Вхід: логін і пароль перевіряє Supabase Auth. Повертає id людини.
import { checkLogin } from "@/lib/server/db";

export async function POST(request: Request) {
  try {
    const { login, password } = (await request.json()) as { login?: string; password?: string };
    if (!login || !password) return Response.json({ personId: null });
    return Response.json({ personId: await checkLogin(login.trim(), password) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

import { ClientsBase } from "@/components/ClientsBase";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function ClientsPage() {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold">Замовники</h1>
        <p className="text-sm text-ink-2">Прототип: дані вигадані.</p>
      </header>
      <ClientsBase />
    </main>
  );
}

import { ClientsBase } from "@/components/ClientsBase";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function ClientsPage() {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Замовники</h1>
        <p className="text-sm text-ink-2">Прототип: дані вигадані.</p>
      </header>
      <ClientsBase />
    </main>
  );
}

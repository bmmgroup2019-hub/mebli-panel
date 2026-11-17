import { Purchases } from "@/components/Purchases";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function PurchasesPage() {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold">Закупка</h1>
        <p className="text-sm text-ink-2">
          Матеріали за специфікаціями проектів, де робочий проект готовий, а виріб ще в роботі. Прототип: дані вигадані.
        </p>
      </header>
      <Purchases />
    </main>
  );
}

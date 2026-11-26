import { SalaryBoard } from "@/components/SalaryBoard";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function SalaryPage() {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Зарплата</h1>
        <p className="text-sm text-ink-2">Скільки нараховано, скільки виплачено й скільки ще винні кожному. Прототип: дані вигадані.</p>
      </div>
      <SalaryBoard />
    </main>
  );
}

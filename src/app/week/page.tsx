import { WeekPlan } from "@/components/WeekPlan";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function WeekPage() {
  return (
    <main className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:py-8">
      <WeekPlan />
    </main>
  );
}

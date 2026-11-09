import { WeekPlan } from "@/components/WeekPlan";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function WeekPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4">
      <WeekPlan />
    </main>
  );
}

import { IssuesBoard } from "@/components/WeekPlan";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function IssuesPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <IssuesBoard />
    </main>
  );
}

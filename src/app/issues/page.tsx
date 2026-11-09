import { IssuesBoard } from "@/components/WeekPlan";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function IssuesPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4">
      <IssuesBoard />
    </main>
  );
}

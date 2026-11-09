import { ProjectList } from "@/components/ProjectList";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function ProjectsPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold">Проекти</h1>
        <p className="text-sm text-ink-2">Прототип: дані вигадані.</p>
      </header>
      <ProjectList />
    </main>
  );
}

import { ProjectList } from "@/components/ProjectList";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function ProjectsPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="grid gap-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Прототип · дані вигадані</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">Проекти</h1>
      </header>
      <ProjectList />
    </main>
  );
}

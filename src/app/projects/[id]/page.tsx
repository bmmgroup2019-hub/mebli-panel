import { ProjectCard } from "@/components/ProjectCard";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <ProjectCard id={id} />
    </main>
  );
}

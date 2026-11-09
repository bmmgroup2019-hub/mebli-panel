import { ProjectCard } from "@/components/ProjectCard";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-4">
      <ProjectCard id={id} />
    </main>
  );
}

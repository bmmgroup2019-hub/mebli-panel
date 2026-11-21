import { MaterialsTabs } from "@/components/MaterialsTabs";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function MaterialsPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Матеріали</h1>
        <p className="text-sm text-ink-2">Довідник матеріалів і потреба на проекти. Склад і залишки — пізніше.</p>
      </div>
      <MaterialsTabs />
    </main>
  );
}

import { MaterialsTabs } from "@/components/MaterialsTabs";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function MaterialsPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">Матеріали</h1>
        <p className="text-sm text-ink-2">Довідник матеріалів і потреба на проекти. Склад і залишки — пізніше.</p>
      </div>
      <MaterialsTabs />
    </main>
  );
}

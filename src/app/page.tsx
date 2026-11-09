import { OfficeOnly } from "@/components/OfficeOnly";
import { Home } from "@/components/Overview";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4">
      <OfficeOnly>
        <Home />
      </OfficeOnly>
    </main>
  );
}

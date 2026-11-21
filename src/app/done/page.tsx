import { DoneList } from "@/components/DoneList";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function DonePage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Виконано</h1>
        <p className="text-sm text-ink-2">Етапи, які відмічено за місяць, і нарахована зарплата.</p>
      </div>
      <DoneList />
    </main>
  );
}

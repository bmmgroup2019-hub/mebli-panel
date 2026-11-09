import { DoneList } from "@/components/DoneList";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function DonePage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">Виконано</h1>
        <p className="text-sm text-ink-2">Етапи, які відмічено за місяць, і нарахована зарплата.</p>
      </div>
      <DoneList />
    </main>
  );
}

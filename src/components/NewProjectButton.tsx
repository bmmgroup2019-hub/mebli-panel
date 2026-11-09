"use client";

import { todayIso } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addClient, addProject, useCanManage, useWeekData } from "@/lib/week-store";
import { ClientFields, readClient } from "./ClientDialog";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";

/** Кнопка «+ Новий проект» з вікном. Бачать адміністратор і менеджер; після створення — картка проекту. */
export function NewProjectButton() {
  const canManage = useCanManage();
  const [open, setOpen] = useState(false);
  if (!canManage) return null;
  return (
    <>
      <button type="button" className="rounded-md bg-accent-fill px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-fill-hover" onClick={() => setOpen(true)}>
        + Новий проект
      </button>
      {open && <NewProjectDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const data = useWeekData();
  const router = useRouter();
  const [error, setError] = useState("");
  // Порожньо — ще не вибрали; «new» — новий замовник прямо в цьому вікні.
  const [clientId, setClientId] = useState(data?.clients.length ? "" : "new");
  const clients = [...(data?.clients ?? [])].sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const label = (text: string, name: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <label className={`grid gap-0.5 text-xs text-ink-2 ${wide ? "col-span-2" : ""}`}>
      {text}
      <input name={name} className={input} {...extra} />
    </label>
  );

  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby="new-project-title"
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="new-project-title" className="text-lg font-semibold">Новий проект</h2>
          <form method="dialog">
            <button type="submit" aria-label="Закрити" className="rounded-md px-2 py-1 text-ink-2 hover:bg-wash">✕</button>
          </form>
        </div>
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const text = (name: string) => String(values.get(name) ?? "").trim();
            const newClient = readClient(values, "client_");
            if (!text("number") || !text("product") || !clientId || (clientId === "new" && !newClient.name)) {
              setError("Заповніть номер, виріб і замовника.");
              return;
            }
            // Номер перевіряємо до створення замовника, щоб не лишити зайвого запису.
            if (data?.projects.some((project) => project.number === text("number"))) {
              setError("Такий номер уже є.");
              return;
            }
            const id = addProject({
              number: text("number"),
              clientId: clientId === "new" ? addClient(newClient) : clientId,
              product: text("product"),
              acceptedOn: text("acceptedOn"),
              dueOn: text("dueOn"),
            });
            if (!id) {
              setError("Не вдалося створити проект.");
              return;
            }
            onClose();
            router.push(`/projects/${id}`);
          }}
        >
          {label("Номер", "number", { autoFocus: true })}
          {label("Виріб", "product")}
          <label className="col-span-2 grid gap-0.5 text-xs text-ink-2">
            Замовник
            <select aria-label="Замовник" value={clientId} onChange={(e) => setClientId(e.target.value)} className={input}>
              <option value="" disabled>Виберіть замовника</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
              <option value="new">+ Новий замовник</option>
            </select>
          </label>
          {clientId === "new" && (
            <div className="col-span-2 grid grid-cols-2 gap-2 rounded-md bg-wash p-2">
              <ClientFields prefix="client_" />
            </div>
          )}
          {label("Дата прийому", "acceptedOn", { type: "date", defaultValue: todayIso() })}
          {label("Дата здачі", "dueOn", { type: "date" }, true)}
          <div className="col-span-2 flex flex-wrap items-center gap-1.5 pt-1">
            <button type="submit" className="rounded-md bg-accent-fill px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-fill-hover">Створити</button>
            <button type="button" className={button} onClick={onClose}>Скасувати</button>
            {error && <p role="alert" className="w-full text-sm text-critical">{error}</p>}
          </div>
        </form>
      </div>
    </dialog>
  );
}

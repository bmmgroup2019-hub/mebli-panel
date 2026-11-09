"use client";

import { useState } from "react";
import { parseNumber } from "@/lib/materials";
import type { Client } from "@/lib/mock-projects";
import { addClient, removeClient, updateClient, useWeekData } from "@/lib/week-store";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";

/** Поля замовника для форми; prefix — щоб не плутати з полями проекту. */
export function ClientFields({ client, prefix = "" }: { client?: Client; prefix?: string }) {
  const field = (text: string, name: string, value: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <label className={`grid gap-0.5 text-xs text-ink-2 ${wide ? "col-span-2" : ""}`}>
      {text}
      <input name={prefix + name} defaultValue={value} className={input} {...extra} />
    </label>
  );
  return (
    <>
      {field("Ім'я замовника", "name", client?.name ?? "")}
      {field("Телефон", "phone", client?.phone ?? "", { type: "tel" })}
      {field("Адреса", "address", client?.address ?? "", {}, true)}
      {field("Поверх (для заноски)", "floor", client?.floor ? String(client.floor) : "", { inputMode: "numeric" })}
    </>
  );
}

/** Дані замовника з форми. */
export function readClient(values: FormData, prefix = ""): Omit<Client, "id"> {
  const text = (name: string) => String(values.get(prefix + name) ?? "").trim();
  const floor = parseNumber(text("floor"));
  return { name: text("name"), phone: text("phone"), address: text("address"), floor: floor ? Math.round(floor) : null };
}

/** Вікно замовника: новий (без client) або зміна наявного. Зміни видно в усіх його проектах. */
export function ClientDialog({
  client,
  onClose,
  onAdded,
}: {
  client?: Client;
  onClose: () => void;
  onAdded?: (id: string) => void;
}) {
  const data = useWeekData();
  const [error, setError] = useState("");
  const projects = client ? (data?.projects.filter((p) => p.clientId === client.id).length ?? 0) : 0;

  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby="client-dialog-title"
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="client-dialog-title" className="text-lg font-semibold">{client ? "Замовник" : "Новий замовник"}</h2>
            {projects > 0 && <p className="text-xs text-ink-2">Зміни видно в усіх проектах замовника: {projects}</p>}
          </div>
          <form method="dialog">
            <button type="submit" aria-label="Закрити" className="rounded-md px-2 py-1 text-ink-2 hover:bg-wash">✕</button>
          </form>
        </div>
        <form
          aria-label={client ? `Зміна замовника ${client.name}` : "Новий замовник"}
          className="grid grid-cols-2 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = readClient(new FormData(event.currentTarget));
            if (!fields.name) {
              setError("Вкажіть ім'я замовника.");
              return;
            }
            if (client) updateClient(client.id, fields);
            else onAdded?.(addClient(fields));
            onClose();
          }}
        >
          <ClientFields client={client} />
          <div className="col-span-2 flex flex-wrap items-center gap-1.5 pt-1">
            <button type="submit" className="rounded-md bg-accent-fill px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-fill-hover">{client ? "Зберегти" : "Додати"}</button>
            <button type="button" className={button} onClick={onClose}>Скасувати</button>
            {client && (
              <button
                type="button"
                className={`${button} ml-auto text-ink-2`}
                onClick={() => {
                  if (removeClient(client.id)) onClose();
                  else setError(`У замовника є проекти: ${projects}. Прибрати можна лише без проектів.`);
                }}
              >
                Прибрати
              </button>
            )}
            {error && <p role="alert" className="w-full text-sm text-critical">{error}</p>}
          </div>
        </form>
      </div>
    </dialog>
  );
}

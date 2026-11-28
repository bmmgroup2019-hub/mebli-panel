"use client";

import { useState } from "react";
import { addRefusalReason, removeRefusalReason, renameRefusalReason } from "@/lib/week-store";
import { type WeekData } from "@/lib/model";
import { field as input, button } from "./ui";

const TAKEN = "Така причина вже є.";

/** Панель адміна: причини відмов клієнтів, без правок коду. */
export function RefusalReasons({ data }: { data: WeekData }) {
  const [error, setError] = useState("");
  return (
    <section className="grid gap-2">
      <div>
        <h2 className="font-semibold">Причини відмов</h2>
        <p className="text-sm text-ink-2">Менеджер вибирає причину, коли клієнт відмовився до авансу. Якщо прибрати причину, відмови лишаться, але вже без причини.</p>
      </div>

      {data.refusalReasons.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {data.refusalReasons.map((reason) => {
            const count = data.projects.filter((p) => p.refusal?.reasonId === reason.id).length;
            return (
              <li key={reason.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-2">
                <input
                  aria-label="Назва причини"
                  key={String(reason.name)} defaultValue={reason.name}
                  className={input}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name === reason.name) return;
                    const saved = name !== "" && renameRefusalReason(reason.id, name);
                    if (!saved) event.target.value = reason.name;
                    setError(name !== "" && !saved ? TAKEN : "");
                  }}
                />
                <span className="text-sm text-ink-2">Відмов: {count}</span>
                <button type="button" className={button} onClick={() => removeRefusalReason(reason.id)}>Прибрати</button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const name = String(new FormData(form).get("name") ?? "").trim();
          if (!name) return;
          const added = addRefusalReason(name);
          setError(added ? "" : TAKEN);
          if (added) form.reset();
        }}
      >
        <input name="name" aria-label="Нова причина відмови" placeholder="Нова причина" className={input} />
        <button type="submit" className={button}>Додати</button>
      </form>
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
    </section>
  );
}

"use client";

import { useState } from "react";
import { addIssueType, removeIssueType, renameIssueType, type WeekData } from "@/lib/week-store";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
const TAKEN = "Такий тип уже є.";

/** Панель адміна: типи проблем, без правок коду. */
export function IssueTypes({ data }: { data: WeekData }) {
  const [error, setError] = useState("");
  return (
    <section className="grid gap-2">
      <div>
        <h2 className="font-semibold">Типи проблем</h2>
        <p className="text-sm text-ink-2">Якщо прибрати тип, його проблеми лишаться, але вже без типу.</p>
      </div>

      {data.issueTypes.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {data.issueTypes.map((type) => {
            const count = data.issues.filter((i) => i.typeId === type.id && !i.resolved).length;
            return (
              <li key={type.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-2">
                <input
                  aria-label="Назва типу"
                  defaultValue={type.name}
                  className={input}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name === type.name) return;
                    const saved = name !== "" && renameIssueType(type.id, name);
                    if (!saved) event.target.value = type.name;
                    setError(name !== "" && !saved ? TAKEN : "");
                  }}
                />
                <span className="text-sm text-ink-2">Відкрито: {count}</span>
                <button type="button" className={button} onClick={() => removeIssueType(type.id)}>Прибрати</button>
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
          const added = addIssueType(name);
          setError(added ? "" : TAKEN);
          if (added) form.reset();
        }}
      >
        <input name="name" aria-label="Новий тип проблеми" placeholder="Новий тип проблеми" className={input} />
        <button type="submit" className={button}>Додати</button>
      </form>
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
    </section>
  );
}

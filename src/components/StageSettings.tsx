"use client";

import { useState } from "react";
import { addStage, moveStage, removeStage, updateStage, type WeekData } from "@/lib/week-store";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash disabled:opacity-40";
const TAKEN = "Такий етап уже є.";

/** Панель адміна: етапи виробництва, без правок коду. */
export function StageSettings({ data }: { data: WeekData }) {
  const [error, setError] = useState("");
  const last = data.stages.length - 1;

  return (
    <section className="grid gap-2">
      <div>
        <h2 className="font-semibold">Етапи виробництва</h2>
        <p className="text-sm text-ink-2">
          Замовлення проходить етапи згори вниз, останній означає, що виробництво завершено. Люди етапу з позначкою
          «Специфікація» можуть її заповнювати. Етап, на якому є замовлення, прибрати не можна.
        </p>
      </div>

      <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
        {data.stages.map((stage, index) => (
          <li key={stage.id} className="grid gap-2 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-center">
            <input
              aria-label="Назва етапу"
              defaultValue={stage.label}
              className={input}
              onBlur={(event) => {
                const label = event.target.value.trim();
                if (label === stage.label) return;
                const saved = label !== "" && updateStage(stage.id, { label });
                if (!saved) event.target.value = stage.label;
                setError(label !== "" && !saved ? TAKEN : "");
              }}
            />
            <input
              aria-label={`Пояснення: ${stage.label}`}
              placeholder="Пояснення, необов'язково"
              defaultValue={stage.hint}
              className={input}
              onBlur={(event) => {
                const hint = event.target.value.trim();
                if (hint !== stage.hint) updateStage(stage.id, { hint });
              }}
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={stage.createsSpec}
                onChange={(event) => updateStage(stage.id, { createsSpec: event.target.checked })}
              />
              Специфікація
            </label>
            <div className="flex gap-1">
              <button type="button" className={button} aria-label={`Вище: ${stage.label}`} disabled={index === 0} onClick={() => moveStage(stage.id, -1)}>↑</button>
              <button type="button" className={button} aria-label={`Нижче: ${stage.label}`} disabled={index === last} onClick={() => moveStage(stage.id, 1)}>↓</button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  const count = data.items.filter((item) => item.stage === stage.id).length;
                  const removed = removeStage(stage.id);
                  setError(
                    removed ? "" : count > 0 ? `На етапі «${stage.label}» є замовлення: ${count}.` : "Має лишитися хоча б один етап.",
                  );
                }}
              >
                Прибрати
              </button>
            </div>
          </li>
        ))}
      </ol>

      <form
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const label = String(new FormData(form).get("label") ?? "").trim();
          if (!label) return;
          const added = addStage(label);
          setError(added ? "" : TAKEN);
          if (added) form.reset();
        }}
      >
        <input name="label" aria-label="Новий етап" placeholder="Новий етап, додається в кінець" className={input} />
        <button type="submit" className={button}>Додати</button>
      </form>
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
    </section>
  );
}

"use client";

import { useState } from "react";
import { parseNumber } from "@/lib/materials";
import type { Material } from "@/lib/mock-projects";
import { addMaterial, removeMaterial, updateMaterial, type WeekData } from "@/lib/week-store";

const field = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
const TAKEN = "Такий матеріал цього виробника в групі вже є.";

export type MaterialDraft = Omit<Material, "id">;

/** Форма матеріалу: нового (без id) або наявного. Виробник і одиниця — зі списків адміністратора. */
export function MaterialForm({
  data,
  material,
  draft,
  onDone,
  stacked = false,
}: {
  data: WeekData;
  material?: Material;
  draft?: Partial<MaterialDraft>;
  onDone: () => void;
  stacked?: boolean; // у вікні: поля в дві колонки, без рамки
}) {
  const [error, setError] = useState("");
  const start: MaterialDraft = {
    groupId: data.specGroups[0]?.id ?? "",
    name: "",
    maker: "",
    unit: data.units[0] ?? "",
    price: null,
    workId: null,
    ...draft,
    ...material,
  };
  const label = material ? `Зміна: ${material.name}` : "Новий матеріал";
  const options = (list: string[], current: string) => [...new Set(current ? [...list, current] : list)];

  return (
    <form
      aria-label={label}
      className={
        stacked
          ? "grid grid-cols-2 gap-2"
          : "grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]"
      }
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const text = (key: string) => String(values.get(key) ?? "").trim();
        const next: MaterialDraft = {
          groupId: text("groupId"),
          name: text("name"),
          maker: text("maker"),
          unit: text("unit"),
          price: parseNumber(text("price")),
          workId: text("workId") || null,
        };
        if (!next.name) {
          setError("Вкажіть назву.");
          return;
        }
        const saved = material ? updateMaterial(material.id, next) : addMaterial(next);
        if (!saved) {
          setError(TAKEN);
          return;
        }
        onDone();
      }}
    >
      <input
        name="name"
        aria-label="Назва"
        placeholder="Назва матеріалу"
        defaultValue={start.name}
        autoFocus
        className={`${field} col-span-2 ${stacked ? "" : "sm:col-span-1"}`}
      />
      <select name="groupId" aria-label="Група" defaultValue={start.groupId} className={field}>
        {data.specGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
      <select name="maker" aria-label="Виробник" defaultValue={start.maker} className={field}>
        <option value="">Без виробника</option>
        {options(data.makers, start.maker).map((maker) => <option key={maker}>{maker}</option>)}
      </select>
      <select name="unit" aria-label="Одиниця" defaultValue={start.unit} className={field}>
        {options(data.units, start.unit).map((unit) => <option key={unit}>{unit}</option>)}
      </select>
      <input
        name="price"
        inputMode="decimal"
        aria-label="Вартість за одиницю, грн"
        placeholder="Вартість за од., грн"
        defaultValue={start.price === null ? "" : String(start.price).replace(".", ",")}
        className={field}
      />
      {data.works.length > 0 && (
        <label className={`col-span-2 grid gap-1 text-xs text-ink-2 ${stacked ? "" : "sm:col-span-5"}`}>
          Робота для зарплати (порізка, поклейка)
          <select name="workId" aria-label="Робота для зарплати" defaultValue={start.workId ?? ""} className={field}>
            <option value="">Немає</option>
            {data.works.map((work) => (
              <option key={work.id} value={work.id}>
                {work.name} · {data.stages.find((stage) => stage.id === work.stageId)?.label ?? "етап прибрано"}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={`col-span-2 flex flex-wrap items-center gap-1.5 ${stacked ? "pt-1" : "sm:col-span-5"}`}>
        <button type="submit" className="rounded-md bg-accent-fill px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-fill-hover">{material ? "Зберегти" : "Додати"}</button>
        <button type="button" className={button} onClick={onDone}>Скасувати</button>
        {material && (
          <button
            type="button"
            className={`${button} ml-auto text-ink-2`}
            onClick={() => {
              removeMaterial(material.id);
              onDone();
            }}
          >
            Прибрати з довідника
          </button>
        )}
        {error && <p role="alert" className="w-full text-sm text-critical">{error}</p>}
      </div>
    </form>
  );
}

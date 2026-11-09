"use client";

import type { Material } from "@/lib/mock-projects";
import type { WeekData } from "@/lib/week-store";
import { MaterialForm, type MaterialDraft } from "./MaterialForm";

/** Окреме вікно для нового або наявного матеріалу. Закривається кнопкою, Esc або кліком повз вікно. */
export function MaterialDialog({
  data,
  material,
  draft,
  onClose,
}: {
  data: WeekData;
  material?: Material;
  draft?: Partial<MaterialDraft>;
  onClose: () => void;
}) {
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby="material-dialog-title"
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="material-dialog-title" className="text-lg font-semibold">{material ? "Зміна матеріалу" : "Новий матеріал"}</h2>
          <form method="dialog">
            <button type="submit" aria-label="Закрити" className="rounded-md px-2 py-1 text-ink-2 hover:bg-wash">
              ✕
            </button>
          </form>
        </div>
        <MaterialForm data={data} material={material} draft={draft} onDone={onClose} stacked />
      </div>
    </dialog>
  );
}

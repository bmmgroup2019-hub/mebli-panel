"use client";

import { type Material, type WeekData } from "@/lib/model";
import { MaterialForm, type MaterialDraft } from "./MaterialForm";
import { Modal } from "./ui";

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
    <Modal labelledBy="material-dialog-title" onClose={onClose}>
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
    </Modal>
  );
}

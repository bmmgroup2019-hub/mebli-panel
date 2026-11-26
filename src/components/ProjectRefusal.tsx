"use client";

import { useState } from "react";
import type { Project } from "@/lib/mock-projects";
import { canRefuse, refusalReasonName, refuseProject, returnProject, useCurrentUser, useWeekData } from "@/lib/week-store";

const input = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
const button = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-wash";
const day = (iso: string) => iso.split("-").reverse().join(".");

/** Кнопка «Клієнт відмовився» з вікном причини. Лише до авансу, для менеджера проекту й адміністратора. */
export function RefuseButton({ project }: { project: Project }) {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  if (project.refusal || !canRefuse(user, project)) return null;
  return (
    <>
      <button type="button" className={`${button} text-critical print:hidden`} onClick={() => setOpen(true)}>
        Клієнт відмовився
      </button>
      {open && <RefuseDialog project={project} onClose={() => setOpen(false)} />}
    </>
  );
}

function RefuseDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const data = useWeekData();
  const [error, setError] = useState("");
  if (!data) return null;
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby="refuse-title"
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <form
        className="grid gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const reasonId = String(values.get("reason") ?? "") || null;
          const note = String(values.get("note") ?? "");
          if (!reasonId && !note.trim()) {
            setError("Виберіть причину або напишіть коментар.");
            return;
          }
          if (!refuseProject(project.id, reasonId, note)) {
            setError("Не вдалося: можливо, вже внесено аванс.");
            return;
          }
          onClose();
        }}
      >
        <h2 id="refuse-title" className="text-lg font-semibold">Клієнт відмовився</h2>
        <p className="text-sm text-ink-2">
          №{project.number} {project.product} піде з «Прийому» до «Відмов». Повернути в роботу можна будь-коли.
        </p>
        <label className="grid gap-1 text-xs font-medium text-ink-2">
          Причина
          <select name="reason" aria-label="Причина відмови" defaultValue="" className={input}>
            <option value="">Без причини зі списку</option>
            {data.refusalReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-ink-2">
          Коментар
          <textarea name="note" aria-label="Коментар до відмови" rows={2} placeholder="Що сказав клієнт" className={input} />
        </label>
        {error && <p role="alert" className="text-sm text-critical">{error}</p>}
        <div className="flex flex-wrap gap-1.5">
          <button type="submit" className="rounded-lg bg-accent-fill px-3.5 py-2 text-sm font-semibold text-accent-on hover:bg-accent-fill-hover">
            Позначити відмову
          </button>
          <button type="button" className={button} onClick={onClose}>Скасувати</button>
        </div>
      </form>
    </dialog>
  );
}

/** Блок у картці: коли й чому клієнт відмовився, і «Повернути в роботу». */
export function RefusalNote({ project }: { project: Project }) {
  const data = useWeekData();
  const user = useCurrentUser();
  if (!data || !project.refusal) return null;
  const { on, reasonId, note, by } = project.refusal;
  return (
    <section className="grid gap-2 rounded-lg border border-critical/40 bg-critical/[0.06] p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="font-semibold text-critical">Відмова клієнта · {day(on)}</p>
          <p>
            {refusalReasonName(data, reasonId)}
            {note && <span className="text-ink-2"> · {note}</span>}
          </p>
          {by && <p className="text-xs text-ink-2">Позначив(-ла): {by}</p>}
        </div>
        {canRefuse(user, project) && (
          <button type="button" className={button} onClick={() => returnProject(project.id)}>
            Повернути в роботу
          </button>
        )}
      </div>
      <p className="text-xs text-ink-2">Проект лише для перегляду. Після повернення він знову стане на прийом у цьому тижні.</p>
    </section>
  );
}

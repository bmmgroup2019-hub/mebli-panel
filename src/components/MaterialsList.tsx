"use client";

import { useState } from "react";
import { matches, money } from "@/lib/materials";
import { useCanManage, useWeekData, type WeekData } from "@/lib/week-store";
import { MaterialDialog } from "./MaterialDialog";
import type { MaterialDraft } from "./MaterialForm";

const field = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";

/** Назви, вписані в специфікації вручну: їх варто додати в довідник. */
function namesNotInDirectory(data: WeekData) {
  const known = new Set(data.materials.map((m) => `${m.groupId}|${m.name.toLowerCase()}`));
  const found = new Map<string, Partial<MaterialDraft>>();
  for (const row of data.projects.flatMap((project) => project.spec)) {
    const key = `${row.groupId}|${row.name.toLowerCase()}`;
    if (!known.has(key) && !found.has(key)) found.set(key, { groupId: row.groupId, name: row.name, unit: row.unit });
  }
  return [...found.values()];
}

/**
 * Довідник для всіх: компактна таблиця з фільтрами.
 * Адміністратор і менеджер бачать вартість, додають і змінюють матеріали.
 */
export function MaterialsList() {
  const data = useWeekData();
  const canEdit = useCanManage();
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [maker, setMaker] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Partial<MaterialDraft> | null>(null);
  if (!data) return null;

  const makers = [...new Set([...data.makers, ...data.materials.map((m) => m.maker)].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "uk"),
  );
  const found = data.materials.filter(
    (m) => (!groupId || m.groupId === groupId) && (!maker || m.maker === maker) && matches(m, query),
  );
  const groups = data.specGroups
    .map((group) => ({
      group,
      list: found.filter((m) => m.groupId === group.id).sort((a, b) => a.name.localeCompare(b.name, "uk")),
    }))
    .filter(({ list }) => list.length > 0);
  const missing = canEdit ? namesNotInDirectory(data) : [];
  const editing = data.materials.find((m) => m.id === editingId);

  const startAdding = (draft: Partial<MaterialDraft>) => {
    setEditingId(null);
    setAdding(draft);
  };

  // На телефоні назва з виробником зліва, вартість або одиниця справа; на ПК — колонки таблиці.
  const columns = canEdit ? "sm:grid-cols-[minmax(0,1fr)_150px_80px_130px]" : "sm:grid-cols-[minmax(0,1fr)_150px_80px]";

  return (
    <>
      <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Пошук матеріалу"
          placeholder="Пошук: назва або виробник"
          className={field}
        />
        <select aria-label="Група" value={groupId} onChange={(event) => setGroupId(event.target.value)} className={field}>
          <option value="">Усі групи</option>
          {data.specGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        {makers.length > 0 && (
          <select aria-label="Виробник" value={maker} onChange={(event) => setMaker(event.target.value)} className={field}>
            <option value="">Усі виробники</option>
            {makers.map((name) => <option key={name}>{name}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="text-ink-2">
          Позицій: {found.length}
          {found.length !== data.materials.length && ` із ${data.materials.length}`}
        </span>
        {canEdit && (
          <button type="button" className="rounded-md bg-accent-fill px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-fill-hover" onClick={() => startAdding({ groupId: groupId || undefined, maker })}>
            + Додати матеріал
          </button>
        )}
      </div>

      {editing && <MaterialDialog key={editing.id} data={data} material={editing} onClose={() => setEditingId(null)} />}
      {adding && <MaterialDialog key={JSON.stringify(adding)} data={data} draft={adding} onClose={() => setAdding(null)} />}

      {groups.length === 0 ? (
        <p className="text-sm text-ink-2">{data.materials.length ? "Нічого не знайдено." : "Довідник порожній."}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface text-sm">
          <div className={`hidden gap-2 border-b border-line px-3 py-1.5 text-xs text-ink-2 sm:grid ${columns}`}>
            <span>Назва</span>
            <span>Виробник</span>
            <span>Одиниця</span>
            {canEdit && <span className="text-right">Вартість за од.</span>}
          </div>
          {groups.map(({ group, list }) => (
            <section key={group.id} aria-label={group.name}>
              <h2 className="border-b border-line bg-wash px-3 py-1 text-xs font-semibold">
                {group.name} <span className="font-normal text-ink-2">{list.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {list.map((m) => {
                  const cells = (
                    <>
                      <span className="min-w-0">
                        {m.name}
                        {m.maker && <span className="block text-xs text-ink-2 sm:hidden">{m.maker}</span>}
                      </span>
                      <span className="hidden truncate text-ink-2 sm:block">{m.maker}</span>
                      <span className={`text-ink-2 ${canEdit ? "hidden sm:block" : "text-right sm:text-left"}`}>{m.unit}</span>
                      {canEdit && (
                        <span className="text-right tabular-nums">
                          {m.price === null ? "—" : money(m.price)}
                          <span className="text-ink-2 sm:hidden"> / {m.unit}</span>
                        </span>
                      )}
                    </>
                  );
                  const row = `grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 px-3 py-1.5 text-left ${columns}`;
                  return (
                    <li key={m.id}>
                      {canEdit ? (
                        <button
                          type="button"
                          aria-label={`Змінити: ${m.name}${m.maker ? `, ${m.maker}` : ""}`}
                          className={`${row} hover:bg-wash`}
                          onClick={() => {
                            setAdding(null);
                            setEditingId(m.id);
                          }}
                        >
                          {cells}
                        </button>
                      ) : (
                        <div className={row}>{cells}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2">Є в специфікаціях, але не в довіднику: {missing.length}</summary>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {missing.map((draft) => (
              <li key={`${draft.groupId}|${draft.name}`}>
                <button
                  type="button"
                  className="rounded-md border border-dashed border-line px-2.5 py-1 hover:bg-wash"
                  onClick={() => startAdding(draft)}
                >
                  + {draft.name} <span className="text-ink-2">{draft.unit}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

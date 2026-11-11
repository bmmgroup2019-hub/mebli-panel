"use client";

import { useState } from "react";
import { projectLabel, type Material, type Project, type PurchaseStatus, type SpecGroup, type SpecRow } from "@/lib/mock-projects";
import { money } from "@/lib/materials";
import {
  addSpecRow,
  removeSpecRow,
  setPurchase,
  updateSpecRow,
  useProjectAccess,
  useSpecAccess,
  useWeekData,
  type RowList,
} from "@/lib/week-store";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
const columns = "grid grid-cols-[minmax(0,1fr)_96px_auto] gap-1.5 sm:grid-cols-[minmax(0,1fr)_64px_96px_auto]";
const nameCell = "col-span-3 sm:col-span-1";

/** Текст із кількості: порожнє поле або не число дає null. */
function parseQuantity(value: string) {
  const number = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(number) || number < 0 ? null : number;
}

/** Матеріал довідника з такою назвою, без різниці у великих літерах. */
const findMaterial = (materials: Material[], name: string) =>
  materials.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());

/**
 * Таблиця матеріалів проекту за групами. list="spec" — специфікація конструктора (технічний документ),
 * list="estimate" — кошторис менеджера з вартістю (від нього рахуються вартість проекту й зарплата).
 */
export function ProjectSpec({ project, list = "spec" }: { project: Project; list?: RowList }) {
  const data = useWeekData();
  const spec = useSpecAccess(project);
  const access = useProjectAccess(project);
  const canManage = access.canEdit;
  if (!data) return null;

  const estimate = list === "estimate";
  const canEdit = estimate ? canManage : spec.canEdit;
  if (!estimate && !spec.sees) {
    return (
      <section className="grid gap-2">
        <h2 className="font-semibold">Специфікація</h2>
        <p className="text-sm text-ink-2">Специфікація з&apos;явиться тут, коли конструктор завершить свій етап.</p>
      </section>
    );
  }
  const allRows = project[list];
  const empty = allRows.length === 0;
  const title = estimate ? "Кошторис" : "Специфікація";
  // Закупки показуємо лише в специфікації; відмічають адміністратор і менеджер проекту.
  const purchase = estimate ? null : { canMark: access.canPurchase };
  const bought = allRows.filter((row) => row.purchase === "bought").length;
  const ordered = allRows.filter((row) => row.purchase === "ordered").length;

  return (
    <section id="print-spec" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="hidden text-sm print:block">{projectLabel(project)}</p>
          {purchase && !empty && (
            <p className="text-xs text-ink-2 print:hidden">
              Закупка: куплено {bought} із {allRows.length}
              {ordered > 0 && `, замовлено ${ordered}`}
            </p>
          )}
        </div>
        {!empty && (
          <button type="button" className={`${button} print:hidden`} onClick={() => window.print()}>Друк</button>
        )}
      </div>

      {empty && !canEdit && <p className="text-sm text-ink-2">{estimate ? "Кошторис ще не складено." : "Специфікацію ще не заповнено."}</p>}

      {data.specGroups.map((group) => (
        <GroupBlock
          key={group.id}
          project={project}
          group={group}
          units={data.units}
          materials={data.materials.filter((m) => m.groupId === group.id)}
          rows={allRows.filter((row) => row.groupId === group.id)}
          canEdit={canEdit}
          list={list}
          purchase={purchase}
        />
      ))}
    </section>
  );
}

function GroupBlock({
  project,
  group,
  units,
  materials,
  rows,
  canEdit,
  list,
  purchase,
}: {
  project: Project;
  group: SpecGroup;
  units: string[];
  materials: Material[];
  rows: SpecRow[];
  canEdit: boolean;
  list: RowList;
  purchase: { canMark: boolean } | null;
}) {
  if (!canEdit && rows.length === 0) return null;
  const listId = `materials-${group.id}`;
  // У кошторисі видно вартість групи за цінами довідника.
  const groupCost =
    list === "estimate"
      ? rows.reduce((sum, row) => sum + (row.quantity ?? 0) * (findMaterial(materials, row.name)?.price ?? 0), 0)
      : null;

  return (
    <div className={`grid gap-1 ${rows.length === 0 ? "print:hidden" : ""}`}>
      <h3 className="flex justify-between gap-2 text-sm font-semibold text-ink-2">
        {group.name}
        {groupCost !== null && rows.length > 0 && <span className="font-normal tabular-nums">{money(groupCost)}</span>}
      </h3>

      {rows.length > 0 && (
        <table className={`w-full rounded-lg border border-line bg-surface text-sm ${canEdit ? "hidden print:table" : ""}`}>
          <thead className="sr-only">
            <tr>
              <th>Найменування</th>
              <th>Кількість</th>
              {purchase && <th>Закупка</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line first:border-t-0">
                <td className="p-2">
                  {row.name}
                  {list === "estimate" && <RowCost row={row} material={findMaterial(materials, row.name)} />}
                </td>
                <td className="whitespace-nowrap p-2 text-right align-top tabular-nums">
                  {row.quantity === null ? "" : row.quantity.toLocaleString("uk-UA")} {findMaterial(materials, row.name)?.unit ?? row.unit}
                </td>
                {purchase && (
                  <td className="w-px whitespace-nowrap p-2 text-right print:hidden">
                    <Purchase projectId={project.id} row={row} canMark={purchase.canMark} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canEdit && (
        <div className="grid gap-1.5 rounded-lg border border-line bg-surface p-2 print:hidden">
          {/* Підказки з довідника; назву не з довідника теж можна вписати. */}
          <datalist id={listId}>
            {materials.map((m) => <option key={m.id} value={m.name} label={m.maker || undefined} />)}
          </datalist>
          {rows.map((row) => (
            <EditRow
              key={row.id}
              projectId={project.id}
              row={row}
              units={units}
              materials={materials}
              listId={listId}
              list={list}
              purchase={purchase}
            />
          ))}
          <AddRow project={project} group={group} units={units} materials={materials} listId={listId} list={list} />
        </div>
      )}
    </div>
  );
}

/** Рядок для нового матеріалу. Одиниця матеріалу з довідника — та, що в довіднику, без вибору; для іншого — вибір. */
function AddRow({
  project,
  group,
  units,
  materials,
  listId,
  list,
}: {
  project: Project;
  group: SpecGroup;
  units: string[];
  materials: Material[];
  listId: string;
  list: RowList;
}) {
  const [typed, setTyped] = useState("");
  const material = findMaterial(materials, typed);
  return (
    <form
      className={columns}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const name = typed.trim();
        if (!name) return;
        addSpecRow(project.id, {
          groupId: group.id,
          name: material?.name ?? name,
          quantity: parseQuantity(String(values.get("quantity") ?? "")),
          unit: material?.unit ?? String(values.get("unit") ?? units[0] ?? ""),
        }, list);
        form.reset();
        setTyped("");
      }}
    >
      <input
        name="name"
        list={listId}
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        aria-label={`Новий матеріал: ${group.name}`}
        placeholder={materials.length ? "Почніть вводити назву" : "Новий матеріал"}
        className={`${input} ${nameCell}`}
      />
      <input name="quantity" inputMode="decimal" aria-label="Кількість" placeholder="К-сть" className={input} />
      {material ? (
        <span className="self-center px-2 text-sm text-ink-2">{material.unit}</span>
      ) : (
        <select name="unit" aria-label="Одиниця" className={input}>
          {units.map((unit) => <option key={unit}>{unit}</option>)}
        </select>
      )}
      <button type="submit" className={button}>Додати</button>
    </form>
  );
}

/** Вартість рядка кошторису за ціною довідника: ціна за одиницю й сума. */
function RowCost({ row, material }: { row: SpecRow; material: Material | undefined }) {
  if (!material || material.price === null) return null;
  return (
    <span className="block text-xs text-ink-2 tabular-nums">
      {money(material.price)} за {material.unit}
      {row.quantity !== null && <> · <span className="text-ink">{money(row.quantity * material.price)}</span></>}
    </span>
  );
}

function EditRow({
  projectId,
  row,
  units,
  materials,
  listId,
  list,
  purchase,
}: {
  projectId: string;
  row: SpecRow;
  units: string[];
  materials: Material[];
  listId: string;
  list: RowList;
  purchase: { canMark: boolean } | null;
}) {
  const material = findMaterial(materials, row.name);
  const known = Boolean(material);
  const cost = list === "estimate" && material?.price != null;
  return (
    <div className={columns}>
      <input
        aria-label="Найменування"
        list={listId}
        autoComplete="off"
        defaultValue={row.name}
        className={`${input} ${nameCell}`}
        onBlur={(event) => {
          const typed = event.target.value.trim();
          if (!typed) {
            event.target.value = row.name;
            return;
          }
          const material = findMaterial(materials, typed);
          const name = material?.name ?? typed;
          event.target.value = name;
          if (name !== row.name) updateSpecRow(projectId, row.id, material ? { name, unit: material.unit } : { name }, list);
        }}
      />
      <input
        aria-label={`Кількість: ${row.name}`}
        inputMode="decimal"
        defaultValue={row.quantity ?? ""}
        className={input}
        onBlur={(event) => updateSpecRow(projectId, row.id, { quantity: parseQuantity(event.target.value) }, list)}
      />
      {material ? (
        // Одиниця матеріалу з довідника — як у довіднику, вибирати не треба.
        <span className="self-center px-2 text-sm text-ink-2">{material.unit}</span>
      ) : (
        <select
          aria-label={`Одиниця: ${row.name}`}
          className={input}
          value={row.unit}
          onChange={(event) => updateSpecRow(projectId, row.id, { unit: event.target.value }, list)}
        >
          {[...new Set([...units, row.unit])].map((unit) => <option key={unit}>{unit}</option>)}
        </select>
      )}
      <button
        type="button"
        aria-label={`Прибрати: ${row.name}`}
        className="px-2 text-ink-2 hover:text-ink"
        onClick={() => removeSpecRow(projectId, row.id, list)}
      >
        ×
      </button>
      {(!known || cost || (purchase && (purchase.canMark || row.purchase))) && (
        <p className="col-span-3 -mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2 sm:col-span-4">
          {cost ? (
            <RowCost row={row} material={material} />
          ) : (
            <span>{known ? "" : list === "estimate" ? "Не з довідника: без ціни, у вартість не входить" : "Не з довідника"}</span>
          )}
          {purchase && <Purchase projectId={projectId} row={row} canMark={purchase.canMark} />}
        </p>
      )}
    </div>
  );
}

const PURCHASE_LABEL: Record<PurchaseStatus, string> = { ordered: "Замовлено", bought: "Куплено" };

/** Стан закупки рядка: вибір для адміністратора й менеджера проекту, підпис для решти. */
function Purchase({ projectId, row, canMark }: { projectId: string; row: SpecRow; canMark: boolean }) {
  if (!canMark) {
    return row.purchase ? (
      <span className={`text-xs ${row.purchase === "bought" ? "font-medium text-ink" : "text-ink-2"}`}>{PURCHASE_LABEL[row.purchase]}</span>
    ) : null;
  }
  return (
    <select
      aria-label={`Закупка: ${row.name}`}
      value={row.purchase ?? ""}
      onChange={(event) => setPurchase(projectId, row.id, (event.target.value || null) as PurchaseStatus | null)}
      className={`rounded border border-line bg-surface px-1 py-0.5 text-xs ${row.purchase === "bought" ? "font-medium text-ink" : "text-ink-2"}`}
    >
      <option value="">Не замовлено</option>
      <option value="ordered">Замовлено</option>
      <option value="bought">Куплено</option>
    </select>
  );
}
